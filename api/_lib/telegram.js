import { decodeExt } from './clinicExt.js';
import { tashkentToday } from './dates.js';

/** Telegram Bot API (server tomonda). Token faqat TELEGRAM_BOT_TOKEN env'da — brauzerga hech qachon chiqmaydi. */
export function botToken(env = process.env) {
  return String(env.TELEGRAM_BOT_TOKEN || '').trim();
}

export async function tg(method, payload, { token = botToken(), fetchImpl = fetch } = {}) {
  const res = await fetchImpl(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
    signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* */ }
  return { status: res.status, json };
}

/**
 * Server tomonidagi obuna tekshiruvi: klinika mavjud, 'Inactive' emas va muddati o'tmagan
 * (expires_at >= bugun, Asia/Tashkent). Natija: { ok, clinic, reason }.
 */
export async function clinicAccess(sb, clinicId, today = tashkentToday()) {
  const { data: clinic, error } = await sb.from('clinics').select('id,name,logo,status,expires_at').eq('id', clinicId).maybeSingle();
  if (error) return { ok: false, reason: 'db_error' };
  if (!clinic) return { ok: false, reason: 'clinic_not_found' };
  if (clinic.status === 'Inactive') return { ok: false, reason: 'clinic_inactive', clinic };
  const exp = clinic.expires_at ? String(clinic.expires_at).slice(0, 10) : null;
  if (exp && exp < today) return { ok: false, reason: 'subscription_expired', clinic };
  return { ok: true, clinic, ext: decodeExt(clinic.logo).ext };
}

export function validChatId(v) {
  const s = String(v ?? '').trim();
  return /^-?\d{3,20}$/.test(s) ? s : null;
}

const esc = (s) => String(s || '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));

export function startWelcome(firstName, clinic, ext = {}) {
  const name = firstName ? ` <b>${esc(firstName)}</b>` : '';
  const clinicName = esc(clinic?.name || 'My Clinic');
  const phone = esc(ext.phone || ext.contact_phone || '');
  const address = esc(ext.address || ext.location || '');
  const workHours = esc(ext.work_hours || 'Du–Sha: 09:00–18:00');
  let msg = `🦷 <b>Assalomu alaykum${name}!</b>\n\n`;
  msg += `Siz <b>${clinicName}</b> klinikasining Telegram botiga ulangansiz.\n\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n🏥 <b>Klinika haqida:</b>\n`;
  if (address) msg += `📍 Manzil: ${address}\n`;
  if (phone) msg += `📞 Telefon: ${phone}\n`;
  if (workHours) msg += `🕐 Ish vaqti: ${workHours}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;
  msg += `📲 <b>Bu bot orqali siz quyidagilarni olasiz:</b>\n\n`;
  msg += `⏰ <b>2 soat oldin eslatma</b> — qabul vaqtidan 2 soat oldin avtomatik xabar keladi\n\n`;
  msg += `🌅 <b>Ertalabki eslatma</b> — bugungi qabulingiz haqida 07:00 da xabar\n\n`;
  msg += `✅ <b>Tasdiqlash</b> — qabul vaqtini tasdiqlash yoki o'zgartirish imkoniyati\n\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `✨ Sizning ma'lumotlaringiz <b>klinika tizimiga bog'liq</b> — shifokoringiz sizni tizimga qo'shganida eslatmalar avtomatik yoqiladi.\n\n`;
  msg += `Sog'lig'ingiz mustahkam bo'lsin! 🙏`;
  return msg;
}
