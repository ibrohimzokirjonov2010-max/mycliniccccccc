import { bodyOf, guard, send } from '../_lib/http.js';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';
import { botToken, clinicAccess, tg, validChatId } from '../_lib/telegram.js';

/**
 * POST /api/telegram/send { clinic_id, chat_id, text, reply_markup? }
 * Faqat shu klinikaning bemoriga bog'langan chat_id ga yuboriladi (spam/suiiste'molga qarshi)
 * va faqat obunasi faol klinika uchun (server tomonidagi obuna tekshiruvi).
 * Env: TELEGRAM_BOT_TOKEN, SUPABASE_SERVICE_ROLE_KEY (+ SUPABASE_URL yoki VITE_SUPABASE_URL).
 */
export default async function handler(req, res) {
  if (!(await guard(req, res, { limit: 300 }))) return;
  if (!botToken()) return send(res, 503, { ok: false, error: 'telegram_not_configured' });
  const sb = supabaseAdmin();
  if (!sb) return send(res, 503, { ok: false, error: 'server_not_configured' });

  const body = bodyOf(req);
  const clinicId = String(body.clinic_id || '').trim().toLowerCase();
  const chatId = validChatId(body.chat_id);
  const text = String(body.text || '');
  if (!clinicId || !chatId || !text || text.length > 4096) return send(res, 400, { ok: false, error: 'invalid_request' });

  try {
    const access = await clinicAccess(sb, clinicId);
    if (!access.ok) return send(res, access.reason === 'db_error' ? 500 : 402, { ok: false, error: access.reason });

    const { data: patients, error } = await sb.from('patients').select('id').eq('clinic_id', clinicId)
      .ilike('notes', `%${chatId}%`).limit(1);
    if (error) return send(res, 500, { ok: false, error: 'db_error' });
    let linked = !!(patients && patients.length);
    if (!linked) {
      // Ba'zi sxemalarda alohida telegram_chat_id ustuni bor (bo'lmasa so'rov xato beradi — e'tiborsiz).
      const r2 = await sb.from('patients').select('id').eq('clinic_id', clinicId).eq('telegram_chat_id', chatId).limit(1);
      linked = !r2.error && !!(r2.data && r2.data.length);
    }
    if (!linked) return send(res, 403, { ok: false, error: 'chat_not_linked' });

    const payload = { chat_id: chatId, text, parse_mode: 'HTML' };
    if (body.reply_markup && typeof body.reply_markup === 'object') payload.reply_markup = body.reply_markup;
    const r = await tg('sendMessage', payload);
    if (r.json?.ok) return send(res, 200, { ok: true, message_id: r.json.result?.message_id ?? null });
    return send(res, 502, { ok: false, error: 'telegram_error', telegram_status: r.status });
  } catch {
    return send(res, 502, { ok: false, error: 'telegram_unavailable' });
  }
}
