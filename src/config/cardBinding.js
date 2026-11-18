/**
 * "14 kunlik bepul sinov uchun karta biriktirish" sozlamalari.
 *
 * VITE_CARD_BINDING_REQUIRED=1  -> /register (Klinika Admin) oqimida karta qadami MAJBURIY.
 * Default: o'chiq (eski ro'yxatdan o'tish ishlayveradi). Click kalitlari (server env) qo'yilmaguncha yoqmang:
 * kalitlarsiz oqim TEST REJIMda (mock token, haqiqiy yechish yo'q) ishlaydi.
 * `/register?card_demo=1` — flagni yoqmasdan oqimni ko'rish uchun (faqat server TEST REJIMda bo'lsa ishlaydi).
 */
const viteEnv = import.meta.env || {};
export const CARD_BINDING_REQUIRED = ['1', 'true', 'yes'].includes(String(viteEnv.VITE_CARD_BINDING_REQUIRED || '').toLowerCase());

/** Rozilik matni versiyasi: matn o'zgarsa versiyani ham oshiring (DB'da consent_version sifatida saqlanadi). */
export const CONSENT_VERSION = 'v3-2026-11';

export const CONSENT_TEXT =
  "14 kunlik bepul sinovdan keyin kartangizdan tarif narxi avtomatik yechiladi";

/** Rozilik matni: aniq jumla + tarif narxi. */
export function consentText({ amountText, planName, dateText, trialDays = 14 } = {}) {
  const days = Number(trialDays) || 14;
  const lead = days === 14
    ? CONSENT_TEXT
    : `${days} kunlik bepul sinovdan keyin kartangizdan tarif narxi avtomatik yechiladi`;
  const price = [planName, amountText ? `${amountText} so'm / oy` : ''].filter(Boolean).join(': ');
  const when = dateText ? ` Birinchi yechilish: ${dateText}.` : '';
  return `${lead}${price ? ` (${price})` : ''}.${when}`.trim();
}

export const LEGAL_LINKS = { privacy: '/maxfiylik', offer: '/oferta' };

/** TEST REJIMda ishlatiladigan SMS-kod (faqat mock). */
export const MOCK_SMS_CODE = '123456';
