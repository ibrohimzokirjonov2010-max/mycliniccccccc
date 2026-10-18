import { applyResult, STUCK_PENDING_MINUTES } from './billing.js';
import { classifyPayment, paymentStatus } from './click.js';

const nowIso = () => new Date().toISOString();

/** 'pending' X daqiqadan ko'p osilib qolgan bo'lsa -> 'unknown' (funksiya timeout bo'lgan bo'lishi mumkin). */
export async function markStuckPending(sb, { now = Date.now(), minutes = STUCK_PENDING_MINUTES } = {}) {
  const cutoff = new Date(now - minutes * 60 * 1000).toISOString();
  const { data, error } = await sb.from('clinic_payment_charges').update({ status: 'unknown', click_error_note: 'stuck_pending', updated_at: nowIso() })
    .eq('status', 'pending').lt('created_at', cutoff).select('id');
  if (error) return { error };
  return { count: (data || []).length };
}

/**
 * 'unknown' urinishlarni Click payment status API orqali aniqlash.
 * success -> charge 'success' + klinika faollashtiriladi; failed -> 'failed' (davrdagi 3 urinish limitiga kiradi);
 * hali ham noaniq -> o'zgarmaydi. Natija noaniq bo'lsa hech qachon qayta yechilmaydi.
 */
export async function reconcileUnknown(sb, cfg, { lookup = paymentStatus, limit = 25, today, chargeId } = {}) {
  const out = { checked: 0, success: 0, failed: 0, still_unknown: 0, errors: 0 };
  let q = sb.from('clinic_payment_charges').select('id,clinic_id,amount,status,attempt_date,attempt_no,period_start,transaction_parameter,click_payment_id,created_at');
  q = chargeId ? q.eq('id', chargeId) : q.eq('status', 'unknown').order('created_at', { ascending: true }).limit(limit);
  const { data: rows, error } = await q;
  if (error) return { ...out, errors: 1, error: 'db_error' };
  for (const ch of rows || []) {
    if (ch.status !== 'unknown') continue;
    out.checked += 1;
    let r;
    try {
      r = await lookup({ paymentId: ch.click_payment_id, merchantTransId: ch.transaction_parameter, date: String(ch.attempt_date).slice(0, 10) }, cfg);
    } catch { out.still_unknown += 1; continue; }
    let verdict = classifyPayment(r, cfg);
    // "Topilmadi" kabi xatolar faqat 1 soatdan keyin yakuniy hisoblanadi.
    if (verdict === 'failed' && Date.now() - new Date(ch.created_at).getTime() < 60 * 60 * 1000) verdict = 'pending';
    if (verdict === 'pending') { out.still_unknown += 1; continue; }
    const ok = verdict === 'success';
    const { data: upd, error: uErr } = await sb.from('clinic_payment_charges').update({
      status: ok ? 'success' : 'failed', reconciled_at: nowIso(), updated_at: nowIso(),
      click_payment_id: r.payment_id != null ? String(r.payment_id) : ch.click_payment_id,
      click_payment_status: Number.isFinite(Number(r.payment_status)) ? Number(r.payment_status) : null,
      click_error_code: r.error_code, click_error_note: String(r.error_note || '').slice(0, 200),
    }).eq('id', ch.id).eq('status', 'unknown').select('id');
    if (uErr || !upd || upd.length === 0) { out.errors += 1; continue; }
    const { data: clinic } = await sb.from('clinics').select('id,name,logo,plan,status,expires_at').eq('id', ch.clinic_id).maybeSingle();
    if (clinic) {
      const e = await applyResult(sb, { clinic, ok, amount: ch.amount, period: String(ch.period_start).slice(0, 10), today, tx: ch.transaction_parameter, attemptNo: ch.attempt_no, chargeId: ch.id });
      if (e) out.errors += 1;
    }
    out[ok ? 'success' : 'failed'] += 1;
  }
  return out;
}
