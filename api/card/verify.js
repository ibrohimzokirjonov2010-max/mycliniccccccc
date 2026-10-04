import { clickConfig, verifyCardToken } from '../_lib/click.js';
import { bodyOf, guard, send } from '../_lib/http.js';
import { signProof } from '../_lib/proof.js';

export const MOCK_SMS_CODE = '123456';

/**
 * POST /api/card/verify  { card_token, sms_code, expire_date }
 * Click SMS-kodni tekshiradi; muvaffaqiyatda serverda imzolangan "proof" qaytadi
 * (attach shu isbotsiz karta biriktirmaydi).
 */
export default async function handler(req, res) {
  if (!guard(req, res, { limit: 12 })) return;
  const body = bodyOf(req);
  const cardToken = String(body.card_token || '').trim();
  const smsCode = String(body.sms_code || '').replace(/\D/g, '');
  const exp = String(body.expire_date || '').replace(/\D/g, '');
  if (!cardToken || cardToken.length > 100) return send(res, 400, { ok: false, error: 'invalid_token' });
  if (!/^\d{4,8}$/.test(smsCode)) return send(res, 400, { ok: false, error: 'invalid_sms_code' });
  if (!/^\d{4}$/.test(exp)) return send(res, 400, { ok: false, error: 'invalid_expiry' });
  const expiry = `${exp.slice(0, 2)}/${exp.slice(2)}`;

  const cfg = clickConfig();
  if (!cfg.configured) {
    if (!cardToken.startsWith('MOCK-') || smsCode !== MOCK_SMS_CODE) {
      return send(res, 400, { ok: false, error: 'click_error', message: `TEST REJIM: SMS-kod ${MOCK_SMS_CODE}` });
    }
    const masked = '8600 **** **** 0000';
    return send(res, 200, { ok: true, mode: 'mock', masked_pan: masked, expiry, proof: signProof({ ct: cardToken, mp: masked, ex: expiry, mock: true }) });
  }
  if (cardToken.startsWith('MOCK-')) return send(res, 400, { ok: false, error: 'invalid_token' });
  try {
    const r = await verifyCardToken({ cardToken, smsCode }, cfg);
    if (r.error_code !== 0) {
      return send(res, 400, { ok: false, error: 'click_error', code: r.error_code, message: r.error_note || 'Kod noto\'g\'ri' });
    }
    const masked = String(r.card_number || '');
    return send(res, 200, { ok: true, mode: 'live', masked_pan: masked, expiry, proof: signProof({ ct: cardToken, mp: masked, ex: expiry }) });
  } catch {
    return send(res, 502, { ok: false, error: 'click_unavailable' });
  }
}
