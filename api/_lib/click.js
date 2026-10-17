import crypto from 'node:crypto';

/**
 * Click Merchant API (https://docs.click.uz/en/merchant-api-request) — karta tokeni va to'lov holati.
 *   POST /v2/merchant/card_token/request  body: service_id, card_number, expire_date(MMYY), temporary   (Auth'siz)
 *   POST /v2/merchant/card_token/verify   body: service_id, card_token, sms_code            + Auth
 *   POST /v2/merchant/card_token/payment  body: service_id, card_token, amount, transaction_parameter + Auth
 *   GET  /v2/merchant/payment/status/:service_id/:payment_id                                + Auth
 *   GET  /v2/merchant/payment/status_by_mti/:service_id/:merchant_trans_id/:YYYY-MM-DD      + Auth
 *   Auth: "merchant_user_id:digest:timestamp", digest = sha1(timestamp + secret_key), timestamp = 10 xonali UNIX sekund.
 * Env: CLICK_SERVICE_ID, CLICK_MERCHANT_USER_ID, CLICK_SECRET_KEY,
 *      CLICK_PAID_STATUSES (ixtiyoriy, vergul bilan; standart "2") — qaysi payment_status "muvaffaqiyatli o'tdi" deb hisoblanadi.
 */
export const CLICK_BASE = 'https://api.click.uz/v2/merchant';
const TIMEOUT_MS = 15000;

export function clickConfig(env = process.env) {
  const serviceId = Number(env.CLICK_SERVICE_ID);
  const merchantUserId = String(env.CLICK_MERCHANT_USER_ID || '').trim();
  const secretKey = String(env.CLICK_SECRET_KEY || '').trim();
  const configured = Number.isFinite(serviceId) && serviceId > 0 && !!merchantUserId && !!secretKey;
  const paidStatuses = String(env.CLICK_PAID_STATUSES || '2').split(',').map((s) => Number(s.trim())).filter(Number.isFinite);
  return { configured, serviceId, merchantUserId, secretKey, paidStatuses };
}

export function authHeader({ merchantUserId, secretKey }, nowMs = Date.now()) {
  const timestamp = String(Math.floor(nowMs / 1000));
  const digest = crypto.createHash('sha1').update(timestamp + secretKey).digest('hex');
  return `${merchantUserId}:${digest}:${timestamp}`;
}

async function call(path, body, cfg, { auth = true, fetchImpl = fetch, method = 'POST' } = {}) {
  const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
  if (auth) headers.Auth = authHeader(cfg);
  const init = { method, headers };
  if (body !== undefined) init.body = JSON.stringify(body);
  if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) init.signal = AbortSignal.timeout(TIMEOUT_MS);
  const res = await fetchImpl(`${CLICK_BASE}${path}`, init);
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

/** 4) To'lov holati: payment_id ma'lum bo'lsa shu bo'yicha, aks holda merchant_trans_id + sana bo'yicha. */
export function paymentStatus({ paymentId, merchantTransId, date }, cfg, opts) {
  const sid = encodeURIComponent(cfg.serviceId);
  const path = paymentId
    ? `/payment/status/${sid}/${encodeURIComponent(paymentId)}`
    : `/payment/status_by_mti/${sid}/${encodeURIComponent(merchantTransId)}/${encodeURIComponent(date)}`;
  return call(path, undefined, cfg, { ...opts, method: 'GET' });
}

/**
 * Click javobini yakuniy holatga o'giradi: 'success' | 'failed' | 'pending'.
 *  - error_code < 0                         -> failed (Click aniq rad etgan)
 *  - payment_status < 0                     -> failed (to'lov bekor/xato)
 *  - error_code = 0 va payment_status ∈ paidStatuses (standart 2) -> success
 *  - qolgan hammasi (0/1 = yaratilgan/jarayonda, yoki payment_status yo'q) -> pending (reconcile aniqlaydi)
 */
export function classifyPayment(result, cfg = {}) {
  const paid = cfg.paidStatuses && cfg.paidStatuses.length ? cfg.paidStatuses : [2];
  if (!result || typeof result.error_code !== 'number') return 'pending';
  if (result.error_code < 0) return 'failed';
  if (result.error_code > 0) return 'pending';
  const ps = Number(result.payment_status);
  if (!Number.isFinite(ps)) return 'pending';
  if (ps < 0) return 'failed';
  if (paid.includes(ps)) return 'success';
  return 'pending';
}
