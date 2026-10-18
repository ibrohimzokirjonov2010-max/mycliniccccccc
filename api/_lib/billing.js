/**
 * Oylik obuna billing mantiqi (sof funksiyalar + Supabase yordamchilari). Cron va reconcile shu yerdan foydalanadi.
 *
 * Hisob davri (period_start) = shu yechish yopadigan muddat boshi:
 *   - trialing  -> trial_ends_at
 *   - active / past_due -> period_ends_at ([EXT]) yoki clinics.expires_at
 * Muvaffaqiyatli yechish: expires_at = period_start + 1 oy (sanaga bog'langan, kechikkan urinish muddatni surmaydi
 * — lekin agar u bugundan oldin qolsa, bugundan +1 oy beriladi).
 */
import { decodeExt, encodeExt } from './clinicExt.js';
import { addMonths } from './dates.js';

export const MAX_ATTEMPTS_PER_PERIOD = 3;
export const STUCK_PENDING_MINUTES = 15;
export const RENEWABLE = new Set(['trialing', 'active', 'past_due']);

const day = (v) => (v ? String(v).slice(0, 10) : null);

/** Klinika uchun hozirgi to'lov davri boshi (yoki null — yechiladigan narsa yo'q). */
export function currentPeriodStart(clinic, ext) {
  const st = ext.subscription_status;
  if (!RENEWABLE.has(st)) return null;
  if (st === 'trialing') return day(ext.trial_ends_at) || day(clinic.expires_at);
  return day(ext.period_ends_at) || day(clinic.expires_at);
}

/**
 * Shu davrdagi urinishlar asosida qaror: { action: 'charge'|'skip'|'repair', reason, attemptNo }
 *  - 'repair': davr uchun success bor, lekin klinika yangilanmagan (avvalgi run'da clinic update xato bergan) -> faqat klinikani yangilash.
 */
export function decide({ clinic, ext, charges, today }) {
  const period = currentPeriodStart(clinic, ext);
  if (!period) return { action: 'skip', reason: 'not_renewable' };
  if (period > today) return { action: 'skip', reason: 'not_due', period };
  const inPeriod = charges.filter((c) => day(c.period_start) === period);
  const success = inPeriod.find((c) => c.status === 'success');
  if (success) return { action: 'repair', reason: 'already_paid', period, charge: success };
  if (inPeriod.some((c) => c.status === 'pending' || c.status === 'unknown')) return { action: 'skip', reason: 'open_charge', period };
  if (charges.some((c) => day(c.attempt_date) === today)) return { action: 'skip', reason: 'already_today', period };
  const failed = inPeriod.filter((c) => c.status === 'failed').length;
  if (failed >= MAX_ATTEMPTS_PER_PERIOD) return { action: 'skip', reason: 'max_attempts', period };
  return { action: 'charge', period, attemptNo: failed + 1 };
}

export function nextExpiry(period, today) {
  const anchored = addMonths(period, 1);
  return anchored > today ? anchored : addMonths(today, 1);
}

export function txParam(clinicId, period, attemptNo) {
  return `myclinic:${clinicId}:${period}:${attemptNo}`;
}

function ledgerEntry({ clinic, today, amount, ok, tx, attemptNo, chargeId, note }) {
  return {
    id: `pay_${tx.replace(/[^\w-]/g, '_')}`,
    clinic_id: clinic.id, clinic_name: clinic.name, date: today, paidAt: today,
    amount, amountUzs: amount, method: 'click', status: ok ? 'paid' : 'failed',
    subscriptionStatus: ok ? 'active' : 'past_due', orderId: tx, charge_id: chargeId || null,
    note: note || (ok ? 'Avtomatik oylik yechish (Click)' : `Avtomatik yechish muvaffaqiyatsiz (urinish ${attemptNo})`),
    created_at: new Date().toISOString(),
  };
}

/** billing_ledger jadvaliga yozish (jadval hali yo'q bo'lsa jim o'tadi; UI uchun [EXT] ledger ham yuritiladi). */
async function writeLedgerRow(sb, e) {
  try {
    await sb.from('billing_ledger').upsert({
      id: e.id, clinic_id: e.clinic_id, charge_id: e.charge_id, paid_at: e.paidAt, amount_uzs: e.amountUzs,
      method: e.method, status: e.status, subscription_status: e.subscriptionStatus, order_id: e.orderId, note: e.note,
    }, { onConflict: 'id' });
  } catch { /* ixtiyoriy */ }
}

/**
 * Charge natijasini klinikaga qo'llash. Xatoni qaytaradi (cron uni summary.errors ga yozadi).
 * Idempotent: ledger yozuvi id = tx bo'yicha, takror qo'llansa dublikat bo'lmaydi.
 */
export async function applyResult(sb, { clinic, ok, amount, period, today, tx, attemptNo, chargeId }) {
  const { ext, rawLogo } = decodeExt(clinic.logo);
  const entry = ledgerEntry({ clinic, today, amount, ok, tx, attemptNo, chargeId });
  const prev = Array.isArray(ext.payment_ledger) ? ext.payment_ledger.filter((x) => x && x.id !== entry.id) : [];
  const ledger = [...prev, entry].slice(-50);
  let patch;
  if (ok) {
    const exp = nextExpiry(period, today);
    const nextExt = { ...ext, subscription_status: 'active', billing_status: 'paid', payment_provider: 'click', period_ends_at: exp, payment_ledger: ledger };
    patch = { logo: encodeExt(nextExt, rawLogo), expires_at: exp, last_payment_date: today, monthly_fee: amount };
  } else {
    const nextExt = { ...ext, subscription_status: 'past_due', billing_status: 'failed', period_ends_at: period, payment_ledger: ledger };
    patch = { logo: encodeExt(nextExt, rawLogo) };
  }
  const { error } = await sb.from('clinics').update(patch).eq('id', clinic.id);
  if (!error) await writeLedgerRow(sb, entry);
  return error || null;
}
