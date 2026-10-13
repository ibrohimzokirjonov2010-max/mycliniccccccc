/** Umumiy HTTP yordamchilari. MUHIM: so'rov tanasi (karta ma'lumoti) hech qachon log qilinmaydi. */
import crypto from 'node:crypto';
import { supabaseAdmin } from './supabaseAdmin.js';

const WINDOW_SEC = 10 * 60;
const hits = new Map();

export function send(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(body);
}

function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'ip').split(',')[0].trim();
}

/** Xotiradagi (instansiya bo'yicha) zaxira cheklov. */
export function memoryHit(key, limit, now = Date.now()) {
  const arr = (hits.get(key) || []).filter((t) => now - t < WINDOW_SEC * 1000);
  if (arr.length >= limit) { hits.set(key, arr); return false; }
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 5000) hits.delete(hits.keys().next().value);
  return true;
}

/**
 * Bardoshli tezlik cheklovi: Supabase `rate_limit_hit` RPC (migratsiya 20261013_billing_hardening.sql).
 * Supabase sozlanmagan yoki RPC xato bersa — xotiradagi cheklovga qaytadi (fail-open emas, best-effort).
 * Kalit IP'ning sha256 xeshi bilan saqlanadi (xom IP DB'ga yozilmaydi).
 */
export async function rateLimitAllow(key, limit, { sb = supabaseAdmin(), now = Date.now() } = {}) {
  if (sb && typeof sb.rpc === 'function') {
    try {
      const hashed = crypto.createHash('sha256').update(key).digest('hex');
      const { data, error } = await sb.rpc('rate_limit_hit', { p_key: hashed, p_window_seconds: WINDOW_SEC, p_limit: limit });
      if (!error && typeof data === 'boolean') {
        memoryHit(key, Number.MAX_SAFE_INTEGER, now); // statistikani ham yuritamiz
        return data;
      }
    } catch { /* fallback */ }
  }
  return memoryHit(key, limit, now);
}

export async function guard(req, res, { method = 'POST', limit = 0, sb } = {}) {
  if (req.method !== method) {
    res.setHeader('Allow', method);
    send(res, 405, { ok: false, error: 'method_not_allowed' });
    return false;
  }
  // Brauzer so'rovlari faqat shu saytning o'zidan (CORS ochilmaydi).
  const origin = req.headers.origin;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) {
        send(res, 403, { ok: false, error: 'forbidden_origin' });
        return false;
      }
    } catch {
      send(res, 403, { ok: false, error: 'forbidden_origin' });
      return false;
    }
  }
  if (limit > 0) {
    const path = String(req.url || '').split('?')[0];
    const allowed = await rateLimitAllow(`${path}|${clientIp(req)}`, limit, sb === undefined ? {} : { sb });
    if (!allowed) {
      send(res, 429, { ok: false, error: 'too_many_requests' });
      return false;
    }
  }
  return true;
}

/** Server-to-server (cron/admin) Bearer tekshiruvi, vaqt bo'yicha xavfsiz taqqoslash. */
export function bearerOk(req, ...secrets) {
  const header = String(req.headers.authorization || '');
  for (const s of secrets) {
    if (!s) continue;
    const a = Buffer.from(header);
    const b = Buffer.from(`Bearer ${s}`);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
  }
  return false;
}

export function bodyOf(req) {
  const b = req.body;
  if (b && typeof b === 'object') return b;
  if (typeof b === 'string') {
    try { return JSON.parse(b); } catch { return {}; }
  }
  return {};
}
