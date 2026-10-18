/**
 * Telegram bot token FAQAT server tomonda. Brauzer /api/agent?action=telegram-* orqali proksi qiladi.
 * TELEGRAM_BOT_TOKEN env o'rnatilishi kerak. Vaqtinchalik fallback (avvalgi frontend tokeni) reminderlar
 * to'xtab qolmasligi uchun qoldirildi — BotFather'da token almashtirilgach env'ga yangi token qo'ying va fallbackni o'chiring.
 */
const LEGACY_FALLBACK = '8878208387:AAEdKJKfUkevXREmWGi41B-0IBYzL6sB1Zk';
export function botToken() {
  return process.env.TELEGRAM_BOT_TOKEN || LEGACY_FALLBACK;
}
