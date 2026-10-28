import crypto from 'node:crypto';

/** Click SHOP API (Prepare/Complete) imzosi: https://docs.click.uz/click-api-request/ */
export function clickSign(p, secretKey) {
  const parts = [p.click_trans_id, p.service_id, secretKey, p.merchant_trans_id];
  if (Number(p.action) === 1) parts.push(p.merchant_prepare_id);
  parts.push(p.amount, p.action, p.sign_time);
  return crypto.createHash('md5').update(parts.map((v) => String(v ?? '')).join('')).digest('hex');
}

export function clickSignOk(p, secretKey) {
  if (!secretKey || !p?.sign_string) return false;
  const a = Buffer.from(String(p.sign_string).toLowerCase());
  const b = Buffer.from(clickSign(p, secretKey));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function clickParams(req) {
  const b = req.body;
  if (b && typeof b === 'object') return b;
  if (typeof b === 'string') {
    try { return Object.fromEntries(new URLSearchParams(b)); } catch { return {}; }
  }
  return {};
}
