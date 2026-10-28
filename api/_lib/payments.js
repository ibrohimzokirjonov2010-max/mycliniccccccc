import { decodeExt, encodeExt } from './clinicExt.js';
import { addMonths, tashkentToday } from './dates.js';
import { planPrice } from './plans.js';

/** Obuna to'lovlari: `subscription_payments` jadvali (bemor to'lovlari `payments` bilan aralashmaydi). */
export const PAY_TABLE = 'subscription_payments';
export const MAX_MONTHS = 12;

export async function loadClinic(sb, clinicId) {
  const id = String(clinicId || '').trim().toLowerCase();
  if (!id) return null;
  const { data } = await sb.from('clinics').select('id,name,logo,plan,status,expires_at,monthly_fee,last_payment_date').eq('id', id).maybeSingle();
  if (!data) return null;
  const { ext, rawLogo } = decodeExt(data.logo);
  return { ...data, ext, rawLogo };
}

export function clinicPrice(clinic) {
  return planPrice(clinic?.ext?.tariff || clinic?.plan);
}

/** Summa (so'm) tarif narxiga karrali bo'lsa — necha oy; aks holda 0. */
export function monthsFor(clinic, amountUzs) {
  const price = clinicPrice(clinic);
  const amount = Number(amountUzs);
  if (!price || !Number.isFinite(amount) || amount <= 0) return 0;
  const n = amount / price;
  return Number.isInteger(n) && n >= 1 && n <= MAX_MONTHS ? n : 0;
}

/** Muddat tugagan yoki klinika nofaolmi (server tomonida bloklash uchun). */
export function clinicExpired(clinic, today = tashkentToday()) {
  if (!clinic) return true;
  if (['Inactive', 'Blocked'].includes(String(clinic.status || ''))) return true;
  const exp = String(clinic.expires_at || '').slice(0, 10);
  return Boolean(exp) && exp < today;
}

/**
 * To'lov muvaffaqiyatli: muddatni max(bugun, expires_at) + N oyga uzaytiradi, ledger'ga yozadi.
 * Klinika jadvali sxemasi o'zgarmaydi (qo'shimcha maydonlar logo [EXT] ichida).
 */
export async function applyPaidMonths(sb, clinic, { months, amount, provider, txnId, note }) {
  const today = tashkentToday();
  const cur = String(clinic.expires_at || '').slice(0, 10);
  const base = cur && cur > today ? cur : today;
  const newExpiry = addMonths(base, months);
  const ledger = Array.isArray(clinic.ext.payment_ledger) ? [...clinic.ext.payment_ledger] : [];
  ledger.push({
    id: `pay_${provider}_${txnId}`, clinic_id: clinic.id, clinic_name: clinic.name, date: today, paidAt: today,
    amount, amountUzs: amount, months, method: provider.startsWith('click') ? 'click' : provider, status: 'paid',
    subscriptionStatus: 'active', orderId: String(txnId), note: note || `${provider} to'lovi`, created_at: new Date().toISOString(),
  });
  const ext = { ...clinic.ext, subscription_status: 'active', billing_status: 'paid', charge_failures: 0, payment_provider: provider, period_ends_at: newExpiry, payment_ledger: ledger.slice(-50) };
  const { error } = await sb.from('clinics').update({
    logo: encodeExt(ext, clinic.rawLogo), expires_at: newExpiry, last_payment_date: today, monthly_fee: clinicPrice(clinic), status: 'Active',
  }).eq('id', clinic.id);
  if (error) throw new Error('clinic_update_failed');
  return newExpiry;
}

/** Bekor qilingan (Payme -2) to'lov: uzaytirilgan oylarni qaytarib oladi. */
export async function revokePaidMonths(sb, clinic, months) {
  const cur = String(clinic.expires_at || '').slice(0, 10);
  if (!cur) return;
  await sb.from('clinics').update({ expires_at: addMonths(cur, -Number(months || 0)) }).eq('id', clinic.id);
}
