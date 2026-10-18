/**
 * Telegram bot token FAQAT server tomonda (Vercel env TELEGRAM_BOT_TOKEN).
 * Brauzer /api/agent?action=telegram-* orqali proksi qiladi; token hech qachon frontend'ga chiqmaydi.
 */
export function botToken() {
  return process.env.TELEGRAM_BOT_TOKEN || '';
}
