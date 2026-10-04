/**
 * "14 kunlik bepul sinov uchun karta biriktirish" sozlamalari.
 *
 * VITE_CARD_BINDING_REQUIRED=1  -> /register (Klinika Admin) oqimida karta qadami MAJBURIY.
 * Default: o'chiq (eski ro'yxatdan o'tish ishlayveradi). Click kalitlari (server env) qo'yilmaguncha yoqmang:
 * kalitlarsiz oqim TEST REJIMda (mock token, haqiqiy yechish yo'q) ishlaydi.
 * `/register?card_demo=1` — flagni yoqmasdan oqimni ko'rish uchun (faqat server TEST REJIMda bo'lsa ishlaydi).
 */
export const CARD_BINDING_REQUIRED = ['1', 'true', 'yes'].includes(String(import.meta.env.VITE_CARD_BINDING_REQUIRED || '').toLowerCase());

/** Rozilik matni versiyasi: matn o'zgarsa versiyani ham oshiring (DB'da consent_version sifatida saqlanadi). */
export const CONSENT_VERSION = 'v1-2026-10';

export const CONSENT_TEXT =
  "14 kunlik sinov tugagach tanlangan tarif bo'yicha kartamdan avtomatik pul yechilishiga roziman";

export const LEGAL_LINKS = { privacy: '/maxfiylik', offer: '/oferta' };

/** TEST REJIMda ishlatiladigan SMS-kod (faqat mock). */
export const MOCK_SMS_CODE = '123456';
