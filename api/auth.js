import bcrypt from 'bcryptjs';
import { decodeExt } from './_lib/clinicExt.js';
import { bodyOf, guard, send } from './_lib/http.js';
import { clinicExpired } from './_lib/payments.js';
import { mintSession } from './_lib/crmSession.js';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';

/**
 * Klinika foydalanuvchilari uchun server auth + RLS yoqilganda kerak bo'ladigan ochiq (public) amallar.
 *   POST /api/auth?action=login     { clinic_id, username, password } -> { user, clinic, session }
 *   POST /api/auth?action=register  { clinic, admin:{ username, password, name } } -> { clinic_id }
 *   GET  /api/auth?action=clinic-available&id=..       -> { available }
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
    if (await checkPassword(password, u.password)) { user = u; break; }
  }
  if (!user) return [401, { ok: false, error: 'invalid_credentials' }];

  if (user.password && !BCRYPT_RE.test(user.password)) {
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

  const row = {};
  CLINIC_COLS.forEach((k) => { if (c[k] !== undefined && c[k] !== null && c[k] !== '') row[k] = c[k]; });
  row.id = id;
  row.status = 'Active';
  row.created_at = new Date().toISOString();
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
  const { data: clinic } = await sb.from('clinics').select('id,status').eq('id', clinicId).maybeSingle();
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
  return [200, { ok: true, patient_id: p.data.id }];
}

export default async function handler(req, res) {
  const action = String(req.query?.action || '');
  const isGet = ['clinic-available', 'public-clinic', 'public-slots'].includes(action);
  const limits = { login: 20, register: 5, 'public-book': 10 };
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
