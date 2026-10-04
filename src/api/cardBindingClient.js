/**
 * Karta biriktirish: brauzer -> bizning /api/card/* (Vercel serverless) -> Click.
 * Karta raqami faqat shu so'rovlarning tanasida ketadi: brauzer xotirasi, konsol yoki DB ga YOZILMAYDI.
 * Click secret_key brauzerda yo'q (faqat server env).
 *
 * Rejimlar:
 *  - 'live'       : server Click kalitlari bilan sozlangan (haqiqiy);
 *  - 'mock'       : server bor, lekin Click kalitlari yo'q (TEST REJIM);
 *  - 'local-mock' : /api umuman yo'q (dev server / statik hosting) — brauzer ichida TEST REJIM;
 *  - 'unavailable': /api bor, lekin xato beryapti — karta qadami bloklanadi (mock'ga TUSHMAYDI).
 */
import { MOCK_SMS_CODE } from '@/config/cardBinding';

async function post(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
    credentials: 'same-origin',
    cache: 'no-store',
  });
  let json = null;
  try { json = await res.json(); } catch { /* JSON emas */ }
  if (!json || json.ok !== true) {
    const err = new Error(json?.message || errorText(json?.error));
    err.code = json?.error || 'request_failed';
    throw err;
  }
  return json;
}

export function errorText(code) {
  const map = {
    invalid_card_number: "Karta raqami noto'g'ri (16 raqam)",
    invalid_expiry: "Amal qilish muddati noto'g'ri (OO/YY)",
    invalid_sms_code: "SMS-kod noto'g'ri",
    click_unavailable: "Click hozir javob bermayapti. Birozdan so'ng qayta urinib ko'ring",
    too_many_requests: "Juda ko'p urinish. Bir necha daqiqadan so'ng qayta urinib ko'ring",
    invalid_or_expired_proof: "Karta tasdig'i eskirgan. Kartani qaytadan tasdiqlang",
    consent_required: "Avtomatik yechishga rozilik bering",
    clinic_not_eligible: "Klinika uchun karta biriktirib bo'lmadi",
    already_attached: "Bu klinikaga karta allaqachon biriktirilgan",
  };
  return map[code] || 'Xatolik yuz berdi. Qayta urinib ko\'ring';
}

export async function getBindingStatus() {
  try {
    const res = await fetch('/api/card/status', { headers: { Accept: 'application/json' }, cache: 'no-store' });
    const type = res.headers.get('content-type') || '';
    if (res.status === 404 || !type.includes('json')) return { mode: 'local-mock' };
    if (!res.ok) return { mode: 'unavailable' };
    const json = await res.json();
    return { mode: json.mode === 'live' ? 'live' : 'mock' };
  } catch {
    return { mode: 'unavailable' };
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function requestCard(mode, { cardNumber, expiry }) {
  if (mode === 'local-mock') {
    await sleep(500);
    return { card_token: `MOCK-local-${Math.random().toString(36).slice(2, 10)}`, phone_mask: '+998 ** *** ** 00' };
  }
  return post('/api/card/request', { card_number: cardNumber, expire_date: expiry });
}

export async function verifyCard(mode, { cardToken, smsCode, expiry }) {
  if (mode === 'local-mock') {
    await sleep(500);
    if (String(smsCode) !== MOCK_SMS_CODE) throw new Error(`TEST REJIM: SMS-kod ${MOCK_SMS_CODE}`);
    return { masked_pan: '8600 **** **** 0000', expiry, proof: `local-mock.${cardToken}` };
  }
  return post('/api/card/verify', { card_token: cardToken, sms_code: smsCode, expire_date: expiry });
}

export async function attachCard(mode, { clinicId, proof, consentVersion }) {
  if (mode === 'local-mock') return { ok: true, stored: false };
  return post('/api/card/attach', { clinic_id: clinicId, proof, consent: true, consent_version: consentVersion });
}

/** Luhn (Uzcard/Humo kartalari uchun ham amal qiladi) — faqat yozuv xatolarini ushlash uchun. */
export function luhnValid(digits) {
  const s = String(digits || '').replace(/\D/g, '');
  if (s.length < 12) return false;
  let sum = 0;
  let alt = false;
  for (let i = s.length - 1; i >= 0; i -= 1) {
    let n = Number(s[i]);
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}
