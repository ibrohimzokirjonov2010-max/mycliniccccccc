/** Umumiy HTTP yordamchilari. MUHIM: so'rov tanasi (karta ma'lumoti) hech qachon log qilinmaydi. */
const hits = new Map();

export function send(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(body);
}

export function guard(req, res, { method = 'POST', limit = 0 } = {}) {
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
    // Best-effort (har bir serverless instansiya uchun alohida) tezlik cheklovi.
    const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'ip').split(',')[0].trim();
    const key = `${req.url}|${ip}`;
    const now = Date.now();
    const arr = (hits.get(key) || []).filter((t) => now - t < 10 * 60 * 1000);
    if (arr.length >= limit) {
      send(res, 429, { ok: false, error: 'too_many_requests' });
      return false;
    }
    arr.push(now);
    hits.set(key, arr);
  }
  return true;
}

export function bodyOf(req) {
  const b = req.body;
  if (b && typeof b === 'object') return b;
  if (typeof b === 'string') {
    try { return JSON.parse(b); } catch { return {}; }
  }
  return {};
}
