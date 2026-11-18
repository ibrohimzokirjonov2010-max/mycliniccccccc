import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { passwordError } from '../src/lib/passwordPolicy.js';
import { decodeExt, encodeExt } from './_lib/clinicExt.js';
import { bodyOf, guard, send } from './_lib/http.js';
import { clinicExpired, loadClinic, PAY_TABLE } from './_lib/payments.js';
import { normalizePlan, planPrice } from './_lib/plans.js';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import { mintSession } from './_lib/crmSession.js';

/** SuperAdmin uchun Supabase sessiyasi (app_metadata.crm_role = 'superadmin'); xato bo'lsa null. */
async function superSession() {
  const sb = supabaseAdmin();
  if (!sb) return null;
  try { return await mintSession(sb, { key: 'superadmin', clinicId: null, role: 'superadmin', userId: 'superadmin' }); } catch { return null; }
}

/**
 * SuperAdmin (platforma egasi) server endpointi.
 *   POST /api/admin?action=login     { username, password } -> { token, expires_at }
 *   GET  /api/admin?action=me        (Authorization: Bearer <token>)
 *   GET  /api/admin?action=session   (Bearer) -> { session } Supabase sessiyasi (RLS uchun)
 *   GET  /api/admin?action=payments  (Bearer) -> subscription_payments ro'yxati
 * Env: SUPERADMIN_USERNAME, SUPERADMIN_PASSWORD (majburiy), SUPERADMIN_SESSION_SECRET (tavsiya).
 * Env bo'lmasa login RAD etiladi (503). Parol bundle'da yo'q.
 */
const TTL_SEC = 12 * 60 * 60;
const sha = (v) => crypto.createHash('sha256').update(String(v ?? '')).digest();

function creds() {
  const username = String(process.env.SUPERADMIN_USERNAME || '').trim();
  const password = String(process.env.SUPERADMIN_PASSWORD || '');
  return username && password ? { username, password } : null;
}
function secret(c) {
  return process.env.SUPERADMIN_SESSION_SECRET || crypto.createHash('sha256').update(`superadmin:${c.username}:${c.password}`).digest('hex');
}
const eq = (a, b) => crypto.timingSafeEqual(sha(a), sha(b));

export function signSession(c, now = Date.now()) {
  const body = Buffer.from(JSON.stringify({ sub: c.username, role: 'superadmin', exp: Math.floor(now / 1000) + TTL_SEC })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret(c)).update(body).digest('base64url');
  return { token: `${body}.${sig}`, exp: Math.floor(now / 1000) + TTL_SEC };
}

export function verifySession(header, c = creds(), now = Date.now()) {
  if (!c) return null;
  const m = /^Bearer\s+([\w-]+)\.([\w-]+)$/.exec(String(header || ''));
  if (!m) return null;
  const expected = crypto.createHmac('sha256', secret(c)).update(m[1]).digest('base64url');
  if (!eq(m[2], expected)) return null;
  try {
    const p = JSON.parse(Buffer.from(m[1], 'base64url').toString('utf8'));
    if (p.role !== 'superadmin' || p.sub !== c.username || !p.exp || p.exp < Math.floor(now / 1000)) return null;
    return p;
  } catch { return null; }
}

const clip = (value, max = 200) => String(value ?? '').trim().slice(0, max);

async function setAdminPassword(sb, body) {
  const clinicId = clip(body.clinic_id, 80);
  const password = String(body.password || '');
  if (!clinicId || !password) return [400, { ok: false, error: 'missing_fields' }];
  if (passwordError(password)) return [400, { ok: false, error: 'weak_password' }];
  const { data: staff, error } = await sb.from('users').select('id,role,username').eq('clinic_id', clinicId).limit(2000);
  if (error) return [500, { ok: false, error: 'db_error' }];
  const admin = (staff || []).find((user) => String(user.role || '').toLowerCase() === 'admin') || (staff || [])[0];
  if (!admin) return [404, { ok: false, error: 'user_not_found' }];
  const updated = await sb.from('users').update({ password: await bcrypt.hash(password, 10) }).eq('id', admin.id);
  if (updated.error) return [500, { ok: false, error: 'db_error' }];
  return [200, { ok: true, user_id: admin.id }];
}

async function createClinic(sb, body) {
  const source = body.clinic && typeof body.clinic === 'object' ? body.clinic : body;
  const admin = body.admin && typeof body.admin === 'object' ? body.admin : {};
  const id = clip(source.id, 60);
  const name = clip(source.name, 200);
  if (!/^[A-Za-z0-9_]+$/.test(id) || !name) return [400, { ok: false, error: 'invalid_payload' }];
  const adminPassword = String(admin.password || source.password || '');
  const adminUsername = clip(admin.username || id, 80);
  if (!adminUsername || !adminPassword) return [400, { ok: false, error: 'invalid_payload' }];
  if (passwordError(adminPassword)) return [400, { ok: false, error: 'weak_password' }];
  const { data: taken } = await sb.from('clinics').select('id').eq('id', id).limit(1);
  if (taken && taken.length) return [409, { ok: false, error: 'clinic_taken' }];

  const plan = normalizePlan(source.plan);
  const life = clip(source.subscription_status, 40) || 'active';
  const allowedLife = new Set(['trialing', 'active', 'past_due', 'expired']);
  const subscription = allowedLife.has(life) ? life : 'active';
  const { ext: incoming } = decodeExt(source.logo);
  const ext = { ...incoming };
  const keep = ['owner_email', 'owner_phone', 'signup_source', 'phone', 'email', 'doctor_name', 'payment_provider', 'payme_merchant_id', 'click_service_id', 'click_merchant_id', 'webhook_status', 'description', 'address'];
  for (const key of keep) {
    const value = source[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') ext[key] = clip(value, 300);
  }
  ext.subscription_status = subscription;
  ext.tariff = plan;
  if (subscription === 'trialing') {
    ext.trial_ends_at = clip(source.trial_ends_at || source.expires_at, 10);
  } else if (source.trial_ends_at) {
    ext.trial_ends_at = clip(source.trial_ends_at, 10);
  } else {
    delete ext.trial_ends_at;
  }
  const expires = clip(source.expires_at, 10);
  const row = {
    id,
    name,
    status: source.status === 'Inactive' ? 'Inactive' : 'Active',
    created_at: new Date().toISOString(),
    expires_at: expires || null,
    monthly_fee: Number(source.monthly_fee) > 0 ? Number(source.monthly_fee) : planPrice(plan),
    last_payment_date: clip(source.last_payment_date, 10) || null,
    plan,
    password: `sealed-${crypto.randomBytes(9).toString('hex')}`,
    logo: encodeExt(ext, ''),
  };
  const inserted = await sb.from('clinics').insert(row);
  if (inserted.error) return [inserted.error.code === '23505' ? 409 : 500, { ok: false, error: inserted.error.code === '23505' ? 'clinic_taken' : 'db_error' }];
  const userRow = {
    id: clip(admin.id, 60) || `user-${crypto.randomBytes(6).toString('hex')}`,
    clinic_id: id,
    username: adminUsername,
    password: await bcrypt.hash(adminPassword, 10),
    role: 'admin',
    name: clip(admin.name || admin.full_name || `${name} Admin`, 120),
    full_name: clip(admin.full_name || admin.name || `${name} Admin`, 120),
    phone: clip(source.owner_phone, 40) || null,
    commission_rate: 0,
    created_at: new Date().toISOString(),
  };
  const userInsert = await sb.from('users').insert(userRow);
  if (userInsert.error) {
    await sb.from('clinics').delete().eq('id', id);
    return [userInsert.error.code === '23505' ? 409 : 500, { ok: false, error: userInsert.error.code === '23505' ? 'username_taken' : 'db_error' }];
  }
  return [200, { ok: true, clinic_id: id, user_id: userRow.id }];
}

export default async function handler(req, res) {
  const action = String(req.query?.action || '');
  if (action === 'access') {
    // Server tomonidagi tekshiruv: muddati tugagan klinika -> 402.
    if (!guard(req, res, { method: 'GET' })) return;
    const sb = supabaseAdmin();
    if (!sb) return send(res, 503, { ok: false, error: 'server_not_configured' });
    const clinic = await loadClinic(sb, req.query?.clinic_id);
    if (!clinic) return send(res, 404, { ok: false, error: 'clinic_not_found' });
    if (clinicExpired(clinic)) return send(res, 402, { ok: false, error: 'subscription_expired', expires_at: clinic.expires_at });
    return send(res, 200, { ok: true, expires_at: clinic.expires_at });
  }
  const c = creds();
  if (action === 'login') {
    if (!guard(req, res, { limit: 10 })) return;
    if (!c) return send(res, 503, { ok: false, error: 'not_configured', message: 'SUPERADMIN_USERNAME / SUPERADMIN_PASSWORD sozlanmagan' });
    const body = bodyOf(req);
    const userOk = eq(String(body.username || '').trim(), c.username);
    const passOk = eq(String(body.password || ''), c.password);
    if (!(userOk && passOk)) return send(res, 401, { ok: false, error: 'invalid_credentials' });
    const s = signSession(c);
    return send(res, 200, { ok: true, token: s.token, expires_at: s.exp, session: await superSession() });
  }
  if (action === 'create-clinic' || action === 'set-admin-password') {
    if (!guard(req, res, { method: 'POST', limit: 20 })) return;
    if (!c) return send(res, 503, { ok: false, error: 'not_configured' });
    if (!verifySession(req.headers.authorization, c)) return send(res, 401, { ok: false, error: 'unauthorized' });
    const sb = supabaseAdmin();
    if (!sb) return send(res, 503, { ok: false, error: 'server_not_configured' });
    const body = bodyOf(req);
    try {
      const out = action === 'set-admin-password' ? await setAdminPassword(sb, body) : await createClinic(sb, body);
      return send(res, out[0], out[1]);
    } catch {
      return send(res, 500, { ok: false, error: 'server_error' });
    }
  }
  if (!guard(req, res, { method: 'GET' })) return;
  if (!c) return send(res, 503, { ok: false, error: 'not_configured' });
  if (!verifySession(req.headers.authorization, c)) return send(res, 401, { ok: false, error: 'unauthorized' });
  if (action === 'me') return send(res, 200, { ok: true });
  if (action === 'session') return send(res, 200, { ok: true, session: await superSession() });
  if (action === 'payments') {
    const sb = supabaseAdmin();
    if (!sb) return send(res, 503, { ok: false, error: 'server_not_configured' });
    const { data, error } = await sb.from(PAY_TABLE)
      .select('id,clinic_id,amount,months,provider,status,provider_txn_id,paid_at,created_at,note')
      .order('created_at', { ascending: false }).limit(1000);
    let charges = [];
    const chargeQuery = await sb.from('clinic_payment_charges')
      .select('id,clinic_id,amount,status,attempt_date,transaction_parameter,click_payment_id,click_error_note,created_at')
      .order('created_at', { ascending: false }).limit(1000);
    if (!chargeQuery.error && Array.isArray(chargeQuery.data)) charges = chargeQuery.data;
    if (error) return send(res, 200, { ok: true, payments: [], charges, table_missing: true });
    return send(res, 200, { ok: true, payments: data || [], charges });
  }
  return send(res, 400, { ok: false, error: 'bad_request' });
}
