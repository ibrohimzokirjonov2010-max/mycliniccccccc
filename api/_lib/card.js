/** Karta kiritish tekshiruvi (server). Natija faqat Click'ga uzatiladi. */
export function parseCard(body) {
  const cardNumber = String(body.card_number || '').replace(/\D/g, '');
  const exp = String(body.expire_date || '').replace(/\D/g, '');
  const month = Number(exp.slice(0, 2));
  if (!/^\d{16}$/.test(cardNumber)) return { error: 'invalid_card_number' };
  if (!/^\d{4}$/.test(exp) || month < 1 || month > 12) return { error: 'invalid_expiry' };
  return { cardNumber, expireDate: exp };
}
