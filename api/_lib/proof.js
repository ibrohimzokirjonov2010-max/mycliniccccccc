import crypto from 'node:crypto';

/**
 * "Karta tasdiqlandi" isboti: server (verify) imzolaydi, attach tekshiradi.
 * Brauzer card_token'ni soxtalashtira olmasligi uchun HMAC-SHA256 ishlatiladi.
 * Imzo kaliti: CARD_BINDING_SECRET (tavsiya), bo'lmasa CLICK_SECRET_KEY dan hosil qilinadi.
 */
const PROOF_TTL_SEC = 30 * 60;

function secret() {
  if (process.env.CARD_BINDING_SECRET) return process.env.CARD_BINDING_SECRET;
  if (process.env.CLICK_SECRET_KEY) return crypto.createHash('sha256').update(`card-binding:${process.env.CLICK_SECRET_KEY}`).digest('hex');
  return 'mock-only-not-a-secret'; // faqat mock rejimda (hech narsa saqlanmaydi)
}

const b64 = (buf) => Buffer.from(buf).toString('base64url');

export function signProof(payload, now = Date.now()) {
  const body = { ...payload, iat: Math.floor(now / 1000), exp: Math.floor(now / 1000) + PROOF_TTL_SEC };
  const data = b64(JSON.stringify(body));
  const sig = crypto.createHmac('sha256', secret()).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function verifyProof(token, now = Date.now()) {
  const [data, sig] = String(token || '').split('.');
  if (!data || !sig) return null;
  const expected = crypto.createHmac('sha256', secret()).update(data).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const body = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (!body?.exp || body.exp < Math.floor(now / 1000)) return null;
    return body;
  } catch {
    return null;
  }
}
