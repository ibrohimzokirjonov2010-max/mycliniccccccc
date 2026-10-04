import crypto from 'node:crypto';

/**
 * Click Merchant API (https://docs.click.uz/en/merchant-api/requests) — karta tokeni.
 *   POST /v2/merchant/card_token/request  body: service_id, card_number, expire_date(MMYY), temporary   (hujjatda Auth ko'rsatilmagan)
 *   POST /v2/merchant/card_token/verify   body: service_id, card_token, sms_code            + Auth
 *   POST /v2/merchant/card_token/payment  body: service_id, card_token, amount, transaction_parameter + Auth
 *   Auth: "merchant_user_id:digest:timestamp", digest = sha1(timestamp + secret_key), timestamp = 10 xonali UNIX sekund.
 * Env: CLICK_SERVICE_ID, CLICK_MERCHANT_ID (hozir ishlatilmaydi), CLICK_MERCHANT_USER_ID, CLICK_SECRET_KEY.
 */
export const CLICK_BASE = 'https://api.click.uz/v2/merchant';

export function clickConfig(env = process.env) {
  const serviceId = Number(env.CLICK_SERVICE_ID);
  const merchantUserId = String(env.CLICK_MERCHANT_USER_ID || '').trim();
  const secretKey = String(env.CLICK_SECRET_KEY || '').trim();
  const configured = Number.isFinite(serviceId) && serviceId > 0 && !!merchantUserId && !!secretKey;
  return { configured, serviceId, merchantUserId, secretKey };
}

export function authHeader({ merchantUserId, secretKey }, nowMs = Date.now()) {
  const timestamp = String(Math.floor(nowMs / 1000));
  const digest = crypto.createHash('sha1').update(timestamp + secretKey).digest('hex');
  return `${merchantUserId}:${digest}:${timestamp}`;
}

async function call(path, body, cfg, { auth = true, fetchImpl = fetch } = {}) {
  const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
  if (auth) headers.Auth = authHeader(cfg);
  const res = await fetchImpl(`${CLICK_BASE}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  let json = null;
  try { json = await res.json(); } catch { /* javob JSON emas */ }
  if (!json || typeof json.error_code !== 'number') {
    const err = new Error('click_bad_response');
    err.httpStatus = res.status;
    throw err;
  }
  return json;
}

/** 1) Karta tokeni so'rovi (karta raqami Click'ga ketadi, bizda saqlanmaydi). temporary=0 — qayta ishlatiladigan token. */
export function requestCardToken({ cardNumber, expireDate }, cfg, opts) {
  return call('/card_token/request', {
    service_id: cfg.serviceId, card_number: cardNumber, expire_date: expireDate, temporary: 0,
  }, cfg, { ...opts, auth: false });
}

/** 2) SMS-kod bilan tasdiqlash. Javobda maskalangan karta raqami (card_number) keladi. */
export function verifyCardToken({ cardToken, smsCode }, cfg, opts) {
  return call('/card_token/verify', {
    service_id: cfg.serviceId, card_token: cardToken, sms_code: Number(smsCode),
  }, cfg, opts);
}

/** 3) Token bilan to'lov (takroriy yechish). */
export function payWithToken({ cardToken, amount, transactionParameter }, cfg, opts) {
  return call('/card_token/payment', {
    service_id: cfg.serviceId, card_token: cardToken, amount, transaction_parameter: transactionParameter,
  }, cfg, opts);
}
