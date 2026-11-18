import crypto from 'node:crypto';
import { passwordError } from '../../src/lib/passwordPolicy.js';
import { SIGNUP_USERNAME_RE } from '../../src/lib/signupRules.js';
import { slugifyClinic } from '../../src/lib/clinicSlug.js';
import { encodeExt } from './clinicExt.js';
import { addDays, tashkentToday } from './dates.js';
import { mintSession } from './crmSession.js';
import { planPrice, signupPlan } from './plans.js';

const TRIAL_DAYS = 14;

function str(v, max = 300) {
  return String(v ?? '').trim().slice(0, max);
}

/**
 * O'z-o'ziga xizmat: klinika + admin faqat service role bilan.
 * Tarif va sinov muddatini klient belgilay olmaydi (tarif ruxsat etilgan ro'yxatdan, bo'sh bo'lsa basic).
 * Sessiya /api/auth orqali qaytadi. Parol va karta tokeni javobda yo'q.
 */
export async function signupClinic(sb, body, deps = {}) {
  const mint = deps.mint || mintSession;
  const hash = deps.hash || (async (plain) => {
    const { default: bcrypt } = await import('bcryptjs');
    return bcrypt.hash(String(plain), 10);
  });
  const now = (deps.now || (() => new Date()))();

  let googleEmail = '';
  let googleName = '';
  const googleToken = str(body?.google_access_token, 4000);
  if (googleToken) {
    if (!sb.auth?.getUser) return [503, { ok: false, error: 'server_not_configured' }];
    const got = await sb.auth.getUser(googleToken);
    if (got?.error || !got?.data?.user) return [401, { ok: false, error: 'google_invalid' }];
    const meta = got.data.user.user_metadata || {};
    googleName = str(meta.full_name || meta.name || [meta.given_name, meta.family_name].filter(Boolean).join(' '), 120);
    googleEmail = str(got.data.user.email, 200).toLowerCase();
  }

  const clinicName = str(body?.clinic_name, 200);
  const ownerName = str(body?.owner_name, 120) || googleName;
  const username = str(body?.username, 40).toLowerCase();
  const password = String(body?.password || '');
  if (!clinicName || !ownerName || !username || !password) return [400, { ok: false, error: 'missing_fields' }];
  if (!SIGNUP_USERNAME_RE.test(username)) return [400, { ok: false, error: 'bad_username' }];
  if (passwordError(password)) return [400, { ok: false, error: 'weak_password' }];

  const id = slugifyClinic(clinicName);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) return [400, { ok: false, error: 'bad_clinic_name' }];

  const { data: existing, error: existErr } = await sb.from('clinics').select('id').eq('id', id).maybeSingle();
  if (existErr) return [500, { ok: false, error: 'db_error' }];
  if (existing) {
    const { data: staff, error: staffErr } = await sb.from('users').select('username').eq('clinic_id', existing.id).limit(2000);
    if (staffErr) return [500, { ok: false, error: 'db_error' }];
    const taken = (staff || []).some((u) => String(u.username || '').toLowerCase() === username);
    if (taken) return [409, { ok: false, error: 'username_taken' }];
    return [409, { ok: false, error: 'clinic_taken' }];
  }

  const plan = signupPlan(body?.plan);
  const trialEnd = addDays(tashkentToday(now), TRIAL_DAYS);
  const source = googleEmail ? 'google' : (body?.signup_source === 'landing' ? 'landing' : 'manual');
  const phone = str(body?.phone, 40);
  const ext = {
    signup_source: source,
    subscription_status: 'trialing',
    trial_ends_at: trialEnd,
    tariff: plan,
  };
  if (phone && phone !== '+998') ext.phone = phone;
  if (googleEmail) ext.owner_email = googleEmail;

  const row = {
    id,
    name: clinicName,
    status: 'Active',
    created_at: now.toISOString(),
    expires_at: trialEnd,
    monthly_fee: planPrice(plan),
    plan,
    logo: encodeExt(ext, ''),
    password: `sealed-${crypto.randomBytes(9).toString('hex')}`,
  };
  const ins = await sb.from('clinics').insert(row);
  if (ins.error) {
    return [ins.error.code === '23505' ? 409 : 500, { ok: false, error: ins.error.code === '23505' ? 'clinic_taken' : 'db_error' }];
  }

  const userRow = {
    id: `user-${crypto.randomBytes(6).toString('hex')}`,
    clinic_id: id,
    username,
    password: await hash(password),
    role: 'admin',
    name: ownerName,
    full_name: ownerName,
    commission_rate: 0,
    created_at: now.toISOString(),
  };
  const u = await sb.from('users').insert(userRow);
  if (u.error) {
    await sb.from('clinics').delete().eq('id', id);
    return [u.error.code === '23505' ? 409 : 500, { ok: false, error: u.error.code === '23505' ? 'username_taken' : 'db_error' }];
  }

  let session;
  try {
    session = await mint(sb, { key: `user:${userRow.id}`, clinicId: id, role: 'admin', userId: userRow.id });
  } catch {
    return [503, { ok: false, error: 'session_unavailable', clinic_id: id }];
  }
  const user = { ...userRow };
  delete user.password;
  const clinic = { ...row };
  delete clinic.password;
  return [200, { ok: true, clinic_id: id, user_id: userRow.id, user, clinic, session }];
}

/** Login bandligini shu klinika ichida tekshiradi. Boshqa klinikaning loginini oshkor qilmaydi. */
export async function loginAvailable(sb, query) {
  const username = str(query?.username, 40).toLowerCase();
  const clinicId = slugifyClinic(query?.clinic_name || '') || str(query?.clinic_id, 60).toLowerCase();
  if (!SIGNUP_USERNAME_RE.test(username)) return [200, { ok: true, available: false, reason: 'bad_username' }];
  if (!clinicId) return [200, { ok: true, available: true }];
  const { data: existing, error } = await sb.from('clinics').select('id').eq('id', clinicId).maybeSingle();
  if (error) return [500, { ok: false, error: 'db_error' }];
  if (!existing) return [200, { ok: true, available: true }];
  const { data: staff, error: staffErr } = await sb.from('users').select('username').eq('clinic_id', existing.id).limit(2000);
  if (staffErr) return [500, { ok: false, error: 'db_error' }];
  const taken = (staff || []).some((u) => String(u.username || '').toLowerCase() === username);
  if (taken) return [200, { ok: true, available: false, reason: 'username_taken' }];
  return [200, { ok: true, available: true, reason: 'clinic_taken' }];
}
