import { bodyOf, guard, send } from '../_lib/http.js';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';
import { botToken, clinicAccess, startWelcome, tg, validChatId } from '../_lib/telegram.js';

/**
 * POST /api/telegram/poll { clinic_id }
 * Bot'ga kelgan /start xabarlariga server tomonda javob beradi (getUpdates + offset bilan tasdiqlash).
 * Webhook o'rnatilgan bo'lsa (409) yoki token yo'q bo'lsa — { ok: true, disabled: true }.
 */
export default async function handler(req, res) {
  if (!(await guard(req, res, { limit: 60 }))) return;
  if (!botToken()) return send(res, 200, { ok: true, disabled: true, reason: 'telegram_not_configured' });
  const sb = supabaseAdmin();
  if (!sb) return send(res, 503, { ok: false, error: 'server_not_configured' });
  const clinicId = String(bodyOf(req).clinic_id || '').trim().toLowerCase();
  if (!clinicId) return send(res, 400, { ok: false, error: 'invalid_request' });

  try {
    const access = await clinicAccess(sb, clinicId);
    if (!access.ok) return send(res, access.reason === 'db_error' ? 500 : 402, { ok: false, error: access.reason });

    const r = await tg('getUpdates', { timeout: 0, limit: 20, allowed_updates: ['message'] });
    if (r.status === 409) return send(res, 200, { ok: true, disabled: true, reason: 'webhook_set' });
    if (r.status === 401 || r.status === 403 || r.status === 404) return send(res, 200, { ok: true, disabled: true, reason: 'token_rejected' });
    const updates = Array.isArray(r.json?.result) ? r.json.result : [];
    let last = 0;
    let handled = 0;
    for (const u of updates) {
      if (u.update_id > last) last = u.update_id;
      const msg = u.message;
      const chatId = validChatId(msg?.chat?.id);
      if (!chatId || !String(msg?.text || '').trim().startsWith('/start')) continue;
      const firstName = msg.from?.first_name || msg.chat?.first_name || '';
      await tg('sendMessage', { chat_id: chatId, text: startWelcome(firstName, access.clinic, access.ext), parse_mode: 'HTML' });
      handled += 1;
    }
    if (last) await tg('getUpdates', { offset: last + 1, timeout: 0, limit: 1 }); // qayta ishlanganlarni tasdiqlash
    return send(res, 200, { ok: true, handled });
  } catch {
    return send(res, 502, { ok: false, error: 'telegram_unavailable' });
  }
}
