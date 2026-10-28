import crypto from 'node:crypto';
import { bodyOf, guard, send } from './_lib/http.js';
import { clinicExpired, loadClinic, PAY_TABLE } from './_lib/payments.js';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';

/**
 * SuperAdmin (platforma egasi) server endpointi.
 *   POST /api/admin?action=login     { username, password } -> { token, expires_at }
 *   GET  /api/admin?action=me        (Authorization: Bearer <token>)
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
    return send(res, 200, { ok: true, token: s.token, expires_at: s.exp });
  }
  if (!guard(req, res, { method: 'GET' })) return;
  if (!c) return send(res, 503, { ok: false, error: 'not_configured' });
  if (!verifySession(req.headers.authorization, c)) return send(res, 401, { ok: false, error: 'unauthorized' });
  if (action === 'me') return send(res, 200, { ok: true });
  if (action === 'payments') {
    const sb = supabaseAdmin();
    if (!sb) return send(res, 503, { ok: false, error: 'server_not_configured' });
    const { data, error } = await sb.from(PAY_TABLE)
      .select('id,clinic_id,amount,months,provider,status,provider_txn_id,paid_at,created_at,note')
      .order('created_at', { ascending: false }).limit(1000);
    if (error) return send(res, 200, { ok: true, payments: [], table_missing: true });
    return send(res, 200, { ok: true, payments: data || [] });
  }
  return send(res, 400, { ok: false, error: 'bad_request' });
}
