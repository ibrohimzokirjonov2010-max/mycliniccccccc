import crypto from 'node:crypto';

/**
 * Bir martalik ro'yxatdan o'tish tokeni (HMAC-SHA256, qisqa TTL).
 * /api/register/token klinika HALI YARATILMAGAN paytda beradi (clinic_id ga bog'lanadi),
 * /api/card/attach uni tekshiradi: imzo, muddat, clinic_id mosligi, klinika token berilgandan keyin yaratilgani
 * va jti bir martaligi (registration_token_uses jadvali). Shunday qilib begona odam mavjud klinikaga karta biriktira olmaydi.
 * Kalit: REGISTRATION_TOKEN_SECRET (tavsiya), bo'lmasa CARD_BINDING_SECRET / CLICK_SECRET_KEY dan hosil qilinadi.
 */
export const REG_TOKEN_TTL_SEC = 30 * 60;

function secret(env = process.env) {
  if (env.REGISTRATION_TOKEN_SECRET) return env.REGISTRATION_TOKEN_SECRET;
  const base = env.CARD_BINDING_SECRET || env.CLICK_SECRET_KEY;
  if (base) return crypto.createHash('sha256').update(`registration:${base}`).digest('hex');
  return 'mock-only-registration-secret'; // faqat mock rejim (hech narsa saqlanmaydi)
}

export function signRegistrationToken(clinicId, { now = Date.now(), env } = {}) {
  const iat = Math.floor(now / 1000);
  const body = { typ: 'reg', cid: String(clinicId), jti: crypto.randomUUID(), iat, exp: iat + REG_TOKEN_TTL_SEC };
  const data = Buffer.from(JSON.stringify(body)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret(env)).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function verifyRegistrationToken(token, clinicId, { now = Date.now(), env } = {}) {
  const [data, sig, extra] = String(token || '').split('.');
  if (!data || !sig || extra !== undefined) return null;
  const expected = crypto.createHmac('sha256', secret(env)).update(data).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const body = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (body?.typ !== 'reg' || !body.jti || !body.exp || body.exp < Math.floor(now / 1000)) return null;
    if (String(body.cid) !== String(clinicId)) return null;
    return body;
  } catch {
    return null;
  }
}

/** jti ni bir martalik qilib "ishlatildi" deb belgilaydi. true = birinchi marta, false = qayta ishlatish/xato. */
export async function consumeRegistrationToken(sb, tok) {
  const { error } = await sb.from('registration_token_uses').insert({
    jti: tok.jti, clinic_id: tok.cid, expires_at: new Date(tok.exp * 1000).toISOString(),
  });
  return !error;
}
