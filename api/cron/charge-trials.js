import { applyResult, decide, txParam } from '../_lib/billing.js';
import { classifyPayment, clickConfig, payWithToken } from '../_lib/click.js';
import { decodeExt } from '../_lib/clinicExt.js';
import { tashkentToday } from '../_lib/dates.js';
import { bearerOk, send } from '../_lib/http.js';
import { planPrice } from '../_lib/plans.js';
import { markStuckPending, reconcileUnknown } from '../_lib/reconcile.js';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';

export const config = { maxDuration: 60 };
const DEFAULT_BATCH = 50;
const TIME_BUDGET_MS = 45 * 1000;

/**
 * Kunlik cron (vercel.json -> crons). GET /api/cron/charge-trials   Authorization: Bearer <CRON_SECRET>
 *
 * 1) 15 daqiqadan ortiq 'pending' qolgan urinishlar -> 'unknown';
 * 2) 'unknown' urinishlar Click payment status API orqali aniqlanadi (reconcile);
 * 3) Faol kartali klinikalar: trialing (sinov tugadi), active (oylik yangilanish, expires_at <= bugun),
 *    past_due (shu davrda < 3 muvaffaqiyatsiz urinish) -> token bilan yechish.
 * Har bir davr (period_start) uchun: ko'pi bilan 3 urinish, bitta success (DB unique index), ochiq urinish bo'lsa yechilmaydi.
 * Batch limiti (CHARGE_BATCH_LIMIT, standart 50) va vaqt byudjeti (45 s) — qolganlari keyingi run'da.
 */
export default async function handler(req, res) {
  if (!bearerOk(req, process.env.CRON_SECRET)) return send(res, 401, { ok: false, error: 'unauthorized' });
  const cfg = clickConfig();
  if (!cfg.configured) return send(res, 200, { ok: true, skipped: 'click_not_configured' });
  const sb = supabaseAdmin();
  if (!sb) return send(res, 503, { ok: false, error: 'server_not_configured' });
  const today = tashkentToday();
  const stuck = await markStuckPending(sb);
  const reconciled = await reconcileUnknown(sb, cfg, { today });
  const batch = Number(process.env.CHARGE_BATCH_LIMIT) > 0 ? Number(process.env.CHARGE_BATCH_LIMIT) : DEFAULT_BATCH;
  const out = await runCharges({ sb, cfg, pay: payWithToken, today, batch });
  return send(res, out.status, { ...out.body, stuck_marked_unknown: stuck.count ?? 0, reconciled });
}

/** Sinash uchun ajratilgan asosiy mantiq (sb, pay, today inyeksiya qilinadi). */
export async function runCharges({ sb, cfg, pay, today, batch = DEFAULT_BATCH, budgetMs = TIME_BUDGET_MS, now = () => Date.now() }) {
  const started = now();
  const summary = { today, charged: 0, failed: 0, unknown: 0, pending: 0, repaired: 0, skipped: 0, errors: 0, deferred: 0 };

  const { data: methods, error } = await sb
    .from('clinic_payment_methods').select('id,clinic_id,card_token').eq('status', 'active').eq('provider', 'click')
    .order('clinic_id', { ascending: true });
  if (error) return { status: 500, body: { ok: false, error: 'db_error' } };

  let attempts = 0;
  for (const pm of methods || []) {
    if (attempts >= batch || now() - started > budgetMs) { summary.deferred += 1; continue; }
    try {
      const { data: clinic, error: cErr } = await sb.from('clinics').select('id,name,logo,plan,status,expires_at').eq('id', pm.clinic_id).maybeSingle();
      if (cErr) { summary.errors += 1; continue; }
      if (!clinic || clinic.status === 'Inactive') { summary.skipped += 1; continue; }
      const { ext } = decodeExt(clinic.logo);

      const { data: prior, error: pErr } = await sb.from('clinic_payment_charges')
        .select('id,status,attempt_no,attempt_date,period_start,amount,transaction_parameter').eq('clinic_id', clinic.id)
        .order('created_at', { ascending: false }).limit(20);
      if (pErr) { summary.errors += 1; continue; }

      const d = decide({ clinic, ext, charges: prior || [], today });
      if (d.action === 'repair') {
        const e = await applyResult(sb, { clinic, ok: true, amount: d.charge.amount, period: d.period, today, tx: d.charge.transaction_parameter, attemptNo: d.charge.attempt_no, chargeId: d.charge.id });
        summary[e ? 'errors' : 'repaired'] += 1;
        continue;
      }
      if (d.action !== 'charge') { summary.skipped += 1; continue; }

      const amount = planPrice(ext.tariff || clinic.plan);
      const tx = txParam(clinic.id, d.period, d.attemptNo);
      attempts += 1;

      const { data: row, error: insErr } = await sb.from('clinic_payment_charges').insert({
        clinic_id: clinic.id, payment_method_id: pm.id, amount, status: 'pending',
        attempt_date: today, attempt_no: d.attemptNo, period_start: d.period, transaction_parameter: tx,
      }).select('id').single();
      if (insErr || !row) {
        // 23505 = unique buzildi (boshqa instansiya allaqachon urindi). Boshqa xato = DB muammo: YECHILMAYDI.
        summary[insErr?.code === '23505' ? 'skipped' : 'errors'] += 1;
        continue;
      }

      let result = null;
      try {
        result = await pay({ cardToken: pm.card_token, amount, transactionParameter: tx }, cfg);
      } catch {
        await sb.from('clinic_payment_charges').update({ status: 'unknown', click_error_note: 'no_response', updated_at: new Date().toISOString() }).eq('id', row.id);
        summary.unknown += 1;
        continue;
      }

      const verdict = classifyPayment(result, cfg);
      const chargeStatus = verdict === 'pending' ? 'unknown' : verdict; // noaniq -> reconcile hal qiladi
      const { error: uErr } = await sb.from('clinic_payment_charges').update({
        status: chargeStatus,
        click_payment_id: result.payment_id != null ? String(result.payment_id) : null,
        click_payment_status: Number.isFinite(Number(result.payment_status)) ? Number(result.payment_status) : null,
        click_error_code: result.error_code,
        click_error_note: String(result.error_note || '').slice(0, 200),
        updated_at: new Date().toISOString(),
      }).eq('id', row.id);
      if (uErr) {
        // Charge yozuvi 'pending' qoladi -> keyingi run'da 'unknown' -> reconcile. Klinika hozircha o'zgartirilmaydi.
        summary.errors += 1;
        continue;
      }
      if (chargeStatus === 'unknown') { summary.pending += 1; continue; }

      const ok = chargeStatus === 'success';
      const e = await applyResult(sb, { clinic, ok, amount, period: d.period, today, tx, attemptNo: d.attemptNo, chargeId: row.id });
      if (e) summary.errors += 1; // success bo'lsa keyingi run 'repair' qiladi
      summary[ok ? 'charged' : 'failed'] += 1;
    } catch {
      summary.errors += 1;
    }
  }
  return { status: 200, body: { ok: true, ...summary } };
}
