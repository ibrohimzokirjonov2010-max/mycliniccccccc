import bcrypt from 'bcryptjs';
import { decodeExt, encodeExt } from './_lib/clinicExt.js';
import { normalizePlan, planPrice } from './_lib/plans.js';
import { botToken } from './_lib/telegram.js';
import { bodyOf, guard, send } from './_lib/http.js';
import { clinicExpired } from './_lib/payments.js';
import { mintSession } from './_lib/crmSession.js';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';

/**
 * Klinika foydalanuvchilari uchun server auth + RLS yoqilganda kerak bo'ladigan ochiq (public) amallar.
 *   POST /api/auth?action=login     { clinic_id, username, password } -> { user, clinic, session }
 *   POST /api/auth?action=register  { clinic, admin:{ username, password, name } } -> { clinic_id }
 *   GET  /api/auth?action=clinic-available&id=..       -> { available }
 *   POST /api/auth?action=doctor-register { clinic_id, name, username, password, phone, specialty, commission_rate }
 *   POST /api/auth?action=handoff { token } -> landing token server tomonda tekshiriladi -> { user, clinic, session }
 *   GET  /api/auth?action=public-clinic&slug=..        -> { clinic, doctors }   (faqat xavfsiz maydonlar)
 *   GET  /api/auth?action=public-slots&clinic_id=..    -> { appointments }      (faqat band vaqtlar)
 *   POST /api/auth?action=public-book { clinic_id, doctor_id, name, phone, notes, date, time }
 * session = Supabase Auth sessiyasi (Supabase ES256 bilan imzolagan), app_metadata.clinic_id bilan.
 * Parollar/hashlar hech qachon javobga qo'shilmaydi.
 */
const BCRYPT_RE = /^\$2[aby]\$\d{2}\$/;
const PRIVATE_EXT = new Set(['api_key', 'license_key', 'payme_merchant_id', 'click_service_id', 'click_merchant_id',
  'payment_ledger', 'pending_order', 'owner_email', 'owner_phone', 'webhook_status', 'last_webhook_at', 'billing_status',
  'payment_provider', 'billing_cycle']);
const TRIAL_DAYS = 14; // src/config/landingPricing.js bilan bir xil
const BILLING_EXT = new Set(['tariff', 'subscription_status', 'trial_ends_at', 'payment_ledger', 'pending_order', 'billing_status',
  'billing_cycle', 'payment_provider', 'charge_failures', 'card_token', 'masked_pan', 'payment_method_id', 'period_ends_at',
  'first_charge_date', 'last_payment_date', 'expires_at', 'monthly_fee', 'plan', 'status', 'api_key', 'license_key']);
const CLINIC_COLS = ['id', 'name', 'password', 'status', 'created_at', 'expires_at', 'monthly_fee', 'last_payment_date', 'plan', 'logo'];

const norm = (id) => String(id || '').toLowerCase().trim().replace(/-/g, '_');
const likeId = (id) => String(id || '').toLowerCase().trim().replace(/[%\\]/g, '').replace(/[-_]/g, '_');
const str = (v, max = 300) => String(v ?? '').trim().slice(0, max);

async function checkPassword(plain, stored) {
  if (!plain || !stored) return false;
  if (BCRYPT_RE.test(stored)) {
    try { return await bcrypt.compare(String(plain), stored); } catch { return false; }
  }
  return String(stored) === String(plain);
}

function sanitizeUser(u) {
  if (!u) return u;
  const { password, ...rest } = u;
  return rest;
}

function safeClinic(row, { full = false } = {}) {
  if (!row) return null;
  const { password, ...rest } = row;
  if (full) return rest;
  const { ext, rawLogo } = decodeExt(row.logo);
  const pub = {};
  Object.entries(ext).forEach(([k, v]) => { if (!PRIVATE_EXT.has(k)) pub[k] = v; });
  return { ...rest, ...pub, logo: rawLogo };
}

async function findClinicBySlug(sb, slug) {
  const s = str(slug, 80).toLowerCase();
  if (!s) return null;
  const { data: direct } = await sb.from('clinics').select('*').ilike('id', likeId(s)).limit(1);
  if (direct && direct[0]) return direct[0];
  const { data: all } = await sb.from('clinics').select('*').ilike('logo', '[EXT]%').limit(5000);
  return (all || []).find((c) => {
    const { ext } = decodeExt(c.logo);
    return String(ext.slug || '').toLowerCase() === s || String(c.id).replace(/-/g, '') === s.replace(/-/g, '');
  }) || null;
}

/** RLS SQL'dan keyin hash crm_private.user_passwords'da (faqat service_role RPC). Undan oldin users.password. */
async function storedHash(sb, u) {
  try {
    const { data, error } = await sb.rpc('crm_user_password_hash', { p_user_id: String(u.id) });
    if (!error && typeof data === 'string' && data) return data;
  } catch { /* RPC hali yo'q */ }
  return u.password;
}

function decodeTech(notes) {
  const n = typeof notes === 'string' ? notes : '';
  if (!n.startsWith('[TECH_DATA]')) return {};
  const end = n.indexOf('[END_TECH]');
  if (end === -1) return {};
  try { return JSON.parse(n.substring(11, end)) || {}; } catch { return {}; }
}

const esc = (v) => String(v ?? '').replace(/[<>&]/g, (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[ch]));

/** Klinika lead chatiga Telegram xabari (bot token faqat serverda). Xato bo'lsa jim o'tadi. */
async function notifyClinic(sb, clinicId, clinicName, text) {
  try {
    const { data: rows } = await sb.from('botconfigs').select('*').eq('clinic_id', clinicId).limit(20);
    const cfg = (rows || []).map((r) => ({ ...r, ...decodeTech(r.notes) }))
      .find((r) => r.isActive !== false && (r.leadChatId || r.lead_chat_id));
    if (!cfg) return false;
    const chatId = String(cfg.leadChatId || cfg.lead_chat_id).trim();
    const token = String(cfg.botToken || '').trim() || botToken();
    if (!token || !/^-?\d{3,20}$/.test(chatId)) return false;
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: `🧾 <b>Nomi:</b> ${esc(clinicName)}\n${text}`.slice(0, 4000), parse_mode: 'HTML' }),
      signal: AbortSignal.timeout(5000),
    });
    return r.ok;
  } catch { return false; }
}

async function login(sb, body) {
  const clinicId = str(body.clinic_id, 80);
  const username = str(body.username, 80).toLowerCase();
  const password = String(body.password || '');
  if (!clinicId || !username || !password) return [400, { ok: false, error: 'missing_fields' }];

  const { data: users, error } = await sb.from('users').select('*').ilike('clinic_id', likeId(clinicId)).limit(2000);
  if (error) return [500, { ok: false, error: 'db_error' }];
  let user = null;
  for (const u of users || []) {
    if (!u?.username || norm(u.clinic_id) !== norm(clinicId)) continue;
    if (String(u.username).toLowerCase().trim() !== username) continue;
    if (await checkPassword(password, await storedHash(sb, u))) { user = u; break; }
  }
  if (!user) return [401, { ok: false, error: 'invalid_credentials' }];

  if (user.password && !BCRYPT_RE.test(user.password)) {
    // (RLS SQL'dan keyin users.password bo'sh; trigger hashni crm_private'ga ko'chiradi)
    try { await sb.from('users').update({ password: await bcrypt.hash(password, 10) }).eq('id', user.id); } catch { /* keyingi safar */ }
  }

  const { data: clinic } = await sb.from('clinics').select(CLINIC_COLS.join(',')).ilike('id', likeId(user.clinic_id)).limit(1).maybeSingle();
  if (!clinic) return [404, { ok: false, error: 'clinic_not_found' }];
  if (clinic.status !== 'Active') return [403, { ok: false, error: 'clinic_inactive' }];
  if (clinicExpired(clinic)) return [402, { ok: false, error: 'subscription_expired' }];

  const session = await mintSession(sb, { key: `user:${user.id}`, clinicId: clinic.id, role: String(user.role || 'staff'), userId: user.id });
  return [200, { ok: true, user: sanitizeUser(user), clinic: safeClinic(clinic, { full: true }), session }];
}

async function register(sb, body) {
  const c = body.clinic && typeof body.clinic === 'object' ? body.clinic : null;
  const a = body.admin && typeof body.admin === 'object' ? body.admin : null;
  const id = str(c?.id, 60).toLowerCase();
  if (!c || !a || !/^[a-z0-9]+([_-][a-z0-9]+)*$/.test(id) || !str(c.name) || !str(a.username, 80) || !a.password) {
    return [400, { ok: false, error: 'invalid_payload' }];
  }
  const { data: taken } = await sb.from('clinics').select('id').ilike('id', likeId(id)).limit(1);
  if (taken && taken.length) return [409, { ok: false, error: 'clinic_taken' }];

  // Tarif/sinov/billing maydonlari FAQAT serverda belgilanadi (klientdan kelgani e'tiborsiz).
  const plan = normalizePlan(c.plan);
  const now = new Date();
  const trialEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + TRIAL_DAYS)).toISOString().slice(0, 10);
  const { ext: clientExt, rawLogo } = decodeExt(c.logo);
  const ext = {};
  Object.entries(clientExt).forEach(([k, v]) => { if (!BILLING_EXT.has(k) && !PRIVATE_EXT.has(k)) ext[k] = v; });
  ext.signup_source = clientExt.signup_source === 'landing' ? 'landing' : 'manual';
  ext.subscription_status = 'trialing';
  ext.trial_ends_at = trialEnd;
  ext.tariff = plan;
  if (['click', 'mock'].includes(clientExt.payment_provider)) ext.payment_provider = clientExt.payment_provider;
  const row = {
    id,
    name: str(c.name, 200),
    status: 'Active',
    created_at: now.toISOString(),
    expires_at: trialEnd,
    monthly_fee: planPrice(plan),
    plan,
    logo: encodeExt(ext, rawLogo),
  };
  const passHash = await bcrypt.hash(String(a.password), 10);
  row.password = passHash; // clinics.password NOT NULL; ochiq parol saqlanmaydi
  const ins = await sb.from('clinics').insert(row);
  if (ins.error) return [ins.error.code === '23505' ? 409 : 500, { ok: false, error: ins.error.code === '23505' ? 'clinic_taken' : 'db_error' }];

  const userRow = {
    id: str(a.id, 60) || `user-${Math.random().toString(36).slice(2, 11)}`,
    clinic_id: id,
    username: str(a.username, 80),
    password: passHash,
    role: 'admin',
    name: str(a.name || a.username, 120),
    full_name: str(a.full_name || a.name || a.username, 120),
    commission_rate: 0,
    created_at: new Date().toISOString(),
  };
  const u = await sb.from('users').insert(userRow);
  if (u.error) {
    await sb.from('clinics').delete().eq('id', id);
    return [500, { ok: false, error: 'db_error' }];
  }
  return [200, { ok: true, clinic_id: id, user_id: userRow.id }];
}

async function publicClinic(sb, q) {
  const clinic = await findClinicBySlug(sb, q.slug);
  if (!clinic) return [404, { ok: false, error: 'clinic_not_found' }];
  const { data: users } = await sb.from('users').select('id,name,full_name,role,specialty,clinic_id').eq('clinic_id', clinic.id).limit(500);
  return [200, { ok: true, clinic: safeClinic(clinic), doctors: users || [] }];
}

async function publicSlots(sb, q) {
  const clinicId = str(q.clinic_id, 80);
  if (!clinicId) return [400, { ok: false, error: 'missing_clinic' }];
  const { data, error } = await sb.from('appointments').select('date,time,duration,duration_minutes,doctor_id,doctor_name,status').eq('clinic_id', clinicId).limit(5000);
  if (error) return [500, { ok: false, error: 'db_error' }];
  return [200, { ok: true, appointments: data || [] }];
}

async function publicBook(sb, b) {
  const clinicId = str(b.clinic_id, 80);
  const name = str(b.name, 120);
  const phone = str(b.phone, 40);
  const date = str(b.date, 20);
  const time = str(b.time, 10);
  const note = str(b.notes, 1000);
  if (!clinicId || !name || !phone || !date || !time) return [400, { ok: false, error: 'missing_fields' }];
  const { data: clinic } = await sb.from('clinics').select('id,name,status').eq('id', clinicId).maybeSingle();
  if (!clinic || clinic.status !== 'Active') return [404, { ok: false, error: 'clinic_not_found' }];
  let doctor = null;
  if (b.doctor_id) {
    const { data } = await sb.from('users').select('id,name').eq('id', str(b.doctor_id, 80)).eq('clinic_id', clinicId).maybeSingle();
    doctor = data;
  }
  const now = new Date().toISOString();
  const rid = () => Math.random().toString(36).slice(2, 11);
  const pid = `patient-${rid()}`;
  const p = await sb.from('patients').insert({ id: pid, clinic_id: clinicId, full_name: name, phone, status: 'Active', notes: '[ONLINE YOZILISH] Public sahifa orqali', created_date: now }).select('id').single();
  if (p.error) return [500, { ok: false, error: 'db_error' }];
  await sb.from('leads').insert({ id: `lead-${rid()}`, clinic_id: clinicId, name, phone, notes: `Shifokor: ${doctor?.name || ''}. Xabar: ${note}`, status: 'new', source: 'Website', created_date: now });
  const ap = await sb.from('appointments').insert({
    id: `appointment-${rid()}${rid()}`.slice(0, 24), clinic_id: clinicId, doctor_id: doctor ? String(doctor.id) : null, doctor_name: doctor?.name || null,
    patient_id: p.data.id, patient_name: name, patient_phone: phone, date, time, status: 'Scheduled',
    service_name: 'Online yozilish', price: 0, duration: 30, notes: `ONLINE YOZILISH. Izoh: ${note}`, created_date: now,
  });
  if (ap.error) return [500, { ok: false, error: 'db_error' }];
  await notifyClinic(sb, clinicId, clinic.name || clinicId,
    `🥳 <b>Online yozilish:</b>\n1. Ismi: ${esc(name)}\n2. Telefon: ${esc(phone)}\n📅 ${esc(date)} ${esc(time)}${doctor?.name ? `\n👨‍⚕️ ${esc(doctor.name)}` : ''}${note ? `\nℹ️ ${esc(note)}` : ''}\nℹ️ <b>Manba:</b> Website`);
  return [200, { ok: true, patient_id: p.data.id }];
}

async function doctorRegister(sb, b) {
  const clinicId = str(b.clinic_id, 80).toLowerCase();
  const name = str(b.name, 120);
  const username = str(b.username, 60);
  const password = String(b.password || '');
  if (!clinicId || !name || !username || !password) return [400, { ok: false, error: 'missing_fields' }];
  if (!/^[A-Za-z0-9._@-]{3,60}$/.test(username)) return [400, { ok: false, error: 'bad_username' }];
  if (password.length < 4 || password.length > 128) return [400, { ok: false, error: 'weak_password' }];
  const { data: clinic } = await sb.from('clinics').select('id,name,status,expires_at').ilike('id', likeId(clinicId)).limit(1).maybeSingle();
  if (!clinic) return [404, { ok: false, error: 'clinic_not_found' }];
  if (clinic.status !== 'Active') return [403, { ok: false, error: 'clinic_inactive' }];
  if (clinicExpired(clinic)) return [402, { ok: false, error: 'subscription_expired' }];
  const { data: staff, error: se } = await sb.from('users').select('id,username').eq('clinic_id', clinic.id).limit(2000);
  if (se) return [500, { ok: false, error: 'db_error' }];
  if ((staff || []).some((u) => String(u.username || '').toLowerCase().trim() === username.toLowerCase())) return [409, { ok: false, error: 'username_taken' }];
  const commission = Math.min(100, Math.max(0, Number(b.commission_rate) || 0));
  const row = {
    id: `user-${Math.random().toString(36).slice(2, 11)}`,
    clinic_id: clinic.id,
    username,
    password: await bcrypt.hash(password, 10),
    role: 'doctor', // klient roli e'tiborsiz: o'zi ro'yxatdan o'tgan faqat shifokor bo'ladi
    name,
    full_name: name,
    phone: str(b.phone, 40) || null,
    specialty: str(b.specialty, 80) || null,
    commission_rate: commission,
    created_at: new Date().toISOString(),
  };
  const ins = await sb.from('users').insert(row);
  if (ins.error) return [ins.error.code === '23505' ? 409 : 500, { ok: false, error: ins.error.code === '23505' ? 'username_taken' : 'db_error' }];
  await notifyClinic(sb, clinic.id, clinic.name || clinic.id,
    `👨‍⚕️ <b>Yangi shifokor o'zi ro'yxatdan o'tdi:</b> ${esc(name)} (login: ${esc(username)}). Tanimasangiz, Xodimlar bo'limidan o'chiring.`);
  return [200, { ok: true, user_id: row.id }];
}

async function handoff(sb, b) {
  const landing = String(process.env.LANDING_URL || process.env.VITE_LANDING_URL || '').trim().replace(/\/$/, '');
  const token = str(b.token, 4000);
  if (!landing) return [503, { ok: false, error: 'handoff_not_configured' }];
  if (!token) return [400, { ok: false, error: 'missing_token' }];
  let data = null;
  try {
    const r = await fetch(`${landing}/api/auth/handoff`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }), signal: AbortSignal.timeout(8000),
    });
    data = await r.json().catch(() => null);
    if (!r.ok || !data?.user) return [401, { ok: false, error: data?.error || 'handoff_rejected' }];
  } catch { return [502, { ok: false, error: 'handoff_upstream' }]; }
  // Landing javobidagi foydalanuvchi bizning bazada aynan shu klinikada bo'lishi shart.
  const { data: user } = await sb.from('users').select('*').eq('id', str(data.user.id, 80)).maybeSingle();
  if (!user || norm(user.clinic_id) !== norm(data.user.clinic_id)) return [401, { ok: false, error: 'handoff_user_mismatch' }];
  const { data: clinic } = await sb.from('clinics').select(CLINIC_COLS.join(',')).ilike('id', likeId(user.clinic_id)).limit(1).maybeSingle();
  if (!clinic) return [404, { ok: false, error: 'clinic_not_found' }];
  if (clinic.status !== 'Active') return [403, { ok: false, error: 'clinic_inactive' }];
  if (clinicExpired(clinic)) return [402, { ok: false, error: 'subscription_expired' }];
  const session = await mintSession(sb, { key: `user:${user.id}`, clinicId: clinic.id, role: String(user.role || 'staff'), userId: user.id });
  return [200, { ok: true, user: sanitizeUser(user), clinic: safeClinic(clinic, { full: true }), session }];
}

export default async function handler(req, res) {
  const action = String(req.query?.action || '');
  const isGet = ['clinic-available', 'public-clinic', 'public-slots'].includes(action);
  const limits = { login: 20, register: 5, 'public-book': 10, 'doctor-register': 5, handoff: 20 };
  if (!guard(req, res, { method: isGet ? 'GET' : 'POST', limit: limits[action] || 0 })) return;
  const sb = supabaseAdmin();
  if (!sb) return send(res, 503, { ok: false, error: 'server_not_configured' });
  try {
    let out;
    if (action === 'login') out = await login(sb, bodyOf(req));
    else if (action === 'register') out = await register(sb, bodyOf(req));
    else if (action === 'public-clinic') out = await publicClinic(sb, req.query || {});
    else if (action === 'public-slots') out = await publicSlots(sb, req.query || {});
    else if (action === 'public-book') out = await publicBook(sb, bodyOf(req));
    else if (action === 'doctor-register') out = await doctorRegister(sb, bodyOf(req));
    else if (action === 'handoff') out = await handoff(sb, bodyOf(req));
    else if (action === 'clinic-available') {
      const id = str(req.query?.id, 60);
      const { data } = await sb.from('clinics').select('id').ilike('id', likeId(id)).limit(1);
      out = [200, { ok: true, available: !(data && data.length) }];
    } else out = [400, { ok: false, error: 'bad_request' }];
    return send(res, out[0], out[1]);
  } catch (e) {
    const msg = String(e?.message || '');
    return send(res, msg.startsWith('auth_') ? 503 : 500, { ok: false, error: msg.startsWith('auth_') ? 'session_unavailable' : 'server_error' });
  }
}
