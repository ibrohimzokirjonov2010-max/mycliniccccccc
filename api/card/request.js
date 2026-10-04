import crypto from 'node:crypto';
import { clickConfig, requestCardToken } from '../_lib/click.js';
import { parseCard } from '../_lib/card.js';
import { bodyOf, guard, send } from '../_lib/http.js';

/**
 * POST /api/card/request  { card_number, expire_date }  (expire_date: MMYY yoki MM/YY)
 * Karta ma'lumoti faqat Click'ga uzatiladi: DB'ga yozilmaydi va log qilinmaydi (bu faylda hech qayerda console.* yo'q).
 * Javob: { ok, mode, card_token, phone_mask }
 */
export default async function handler(req, res) {
  if (!guard(req, res, { limit: 8 })) return;
  const parsed = parseCard(bodyOf(req));
  if (parsed.error) return send(res, 400, { ok: false, error: parsed.error });

  const cfg = clickConfig();
  if (!cfg.configured) {
    // TEST REJIM: Click ulanmagan, haqiqiy so'rov yuborilmaydi.
    return send(res, 200, { ok: true, mode: 'mock', card_token: `MOCK-${crypto.randomUUID()}`, phone_mask: '+998 ** *** ** 00' });
  }
  try {
    const r = await requestCardToken(parsed, cfg);
    if (r.error_code !== 0 || !r.card_token) {
      return send(res, 400, { ok: false, error: 'click_error', code: r.error_code, message: r.error_note || 'Karta qabul qilinmadi' });
    }
    return send(res, 200, { ok: true, mode: 'live', card_token: r.card_token, phone_mask: r.phone_number || '' });
  } catch {
    return send(res, 502, { ok: false, error: 'click_unavailable' });
  }
}
