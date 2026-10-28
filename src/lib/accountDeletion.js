import { supabase } from '@/api/supabaseClient';
import { supportContacts } from '@/lib/clinicExpiry';

/**
 * Hisobni o'chirish so'rovi (Google Play / App Store talabi).
 * Server tomonda o'chirish service-role kalitni talab qiladi, shuning uchun mijoz
 * faqat `account_deletion_requests` jadvaliga SO'ROV yozadi (anon: faqat INSERT).
 * Jadval hali yaratilmagan bo'lsa — Telegram qo'llab-quvvatlashga tayyor matn bilan yo'naltiriladi.
 * SQL: supabase/migrations/20261028_account_deletion_requests.sql
 */
export const DELETION_RETENTION_DAYS = 30;

export function deletionTelegramUrl({ clinicId, username, scope, reason }) {
  const text = `Salom! My Clinic hisobini o'chirishni so'rayman.\nKlinika ID: ${clinicId || '-'}\nLogin: ${username || '-'}\nTur: ${scope === 'clinic' ? "butun klinika va barcha ma'lumotlar" : 'faqat mening hisobim'}${reason ? `\nSabab: ${reason}` : ''}`;
  const base = supportContacts().url;
  return `${base}${base.includes('?') ? '&' : '?'}text=${encodeURIComponent(text)}`;
}

export async function submitDeletionRequest({ clinicId, userId, username, contact, scope = 'user', reason = '', source = 'app' }) {
  const row = {
    clinic_id: clinicId || null,
    user_id: userId ? String(userId) : null,
    username: username || null,
    contact: contact || null,
    scope: scope === 'clinic' ? 'clinic' : 'user',
    reason: reason ? String(reason).slice(0, 1000) : null,
    source,
  };
  try {
    const { error } = await supabase.from('account_deletion_requests').insert(row);
    if (!error) return { ok: true, channel: 'database' };
  } catch { /* jadval yo'q yoki tarmoq xatosi */ }
  return { ok: false, channel: 'telegram', url: deletionTelegramUrl({ clinicId, username, scope, reason }) };
}
