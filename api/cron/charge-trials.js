import { clickConfig, payWithToken } from '../_lib/click.js';
import { decodeExt, encodeExt } from '../_lib/clinicExt.js';
import { addMonths, tashkentToday } from '../_lib/dates.js';
import { send } from '../_lib/http.js';
import { planPrice } from '../_lib/plans.js';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';

const MAX_ATTEMPTS = 3;

/**
 * Kunlik cron (vercel.json -> crons). GET /api/cron/charge-trials
 * Vercel CRON_SECRET env berilganda "Authorization: Bearer <CRON_SECRET>" yuboradi; bo'lmasa so'rov rad etiladi.
 *
 * Mantiq:
 *  - Faol karta tokeni (clinic_payment_methods.status='active', provider='click') bor klinikalar;
 *  - subscription_status='trialing' va trial_ends_at <= bugun (Asia/Tashkent) -> birinchi yechish;
 *    subscription_status='past_due' (oxirgi urinish aniq muvaffaqiyatsiz, < MAX_ATTEMPTS) -> qayta urinish;
 *  - muvaffaqiyat: subscription_status='active', expires_at = bugun + 1 oy, last_payment_date, monthly_fee;
 *  - muvaffaqiyatsiz: 'past_due' (muddat o'tgach mavjud blok mexanizmi yopadi);
 *  - natija noaniq (tarmoq xatosi): 'unknown' — qayta YECHILMAYDI (ikki marta yechish xavfi), qo'lda tekshiriladi.
 * Bir kunda bir klinika uchun bitta urinish (clinic_payment_charges: unique(clinic_id, attempt_date)).
 */
export default async function handler(req, res) {
  const expected = process.env.CRON_SECRET;
  if (!expected || req.headers.authorization !== `Bearer ${expected}`) {
    return send(res, 401, { ok: false, error: 'unauthorized' });
  }
  const cfg = clickConfig();
  if (!cfg.configured) return send(res, 200, { ok: true, skipped: 'click_not_configured' });
  const sb = supabaseAdmin();
  if (!sb) return send(res, 503, { ok: false, error: 'server_not_configured' });
  const out = await runCharges({ sb, cfg, pay: payWithToken, today: tashkentToday() });
  return send(res, out.status, out.body);
}

/** Sinash uchun ajratilgan asosiy mantiq (sb, pay, today inyeksiya qilinadi). */
export async function runCharges({ sb, cfg, pay, today }) {
  const summary = { today, charged: 0, failed: 0, unknown: 0, skipped: 0 };

  const { data: methods, error } = await sb
    .from('clinic_payment_methods').select('id,clinic_id,card_token').eq('status', 'active').eq('provider', 'click');
  if (error) return { status: 500, body: { ok: false, error: 'db_error' } };

  for (const pm of methods || []) {
    try {
      const { data: clinic } = await sb.from('clinics').select('id,name,logo,plan,status,expires_at').eq('id', pm.clinic_id).maybeSingle();
      if (!clinic || clinic.status === 'Inactive') { summary.skipped += 1; continue; }
      const { ext, rawLogo } = decodeExt(clinic.logo);

      const { data: prior } = await sb.from('clinic_payment_charges')
        .select('status,attempt_no,attempt_date').eq('clinic_id', clinic.id).order('created_at', { ascending: false }).limit(10);
      const charges = prior || [];
      const hasUnknown = charges.some((c) => c.status === 'unknown' || c.status === 'pending');
      const failedCount = charges.filter((c) => c.status === 'failed').length;
      const alreadyToday = charges.some((c) => c.attempt_date === today);

      const trialDue = ext.subscription_status === 'trialing' && ext.trial_ends_at && ext.trial_ends_at <= today;
      const retryDue = ext.subscription_status === 'past_due' && failedCount > 0 && failedCount < MAX_ATTEMPTS;
      if (!(trialDue || retryDue) || hasUnknown || alreadyToday) { summary.skipped += 1; continue; }

      const amount = planPrice(ext.tariff || clinic.plan);
      const attemptNo = failedCount + 1;
      const txParam = `myclinic:${clinic.id}:${today}:${attemptNo}`;

      const { data: row, error: insErr } = await sb.from('clinic_payment_charges').insert({
        clinic_id: clinic.id, payment_method_id: pm.id, amount, status: 'pending',
        attempt_date: today, attempt_no: attemptNo, transaction_parameter: txParam,
      }).select('id').single();
      if (insErr || !row) { summary.skipped += 1; continue; } // unique buzildi — boshqa instansiya allaqachon urindi

      let result = null;
      try {
        result = await pay({ cardToken: pm.card_token, amount, transactionParameter: txParam }, cfg);
      } catch {
        await sb.from('clinic_payment_charges').update({ status: 'unknown', click_error_note: 'no_response', updated_at: new Date().toISOString() }).eq('id', row.id);
        summary.unknown += 1;
        continue;
      }

      const ok = result.error_code === 0;
      await sb.from('clinic_payment_charges').update({
        status: ok ? 'success' : 'failed',
        click_payment_id: result.payment_id != null ? String(result.payment_id) : null,
        click_error_code: result.error_code,
        click_error_note: String(result.error_note || '').slice(0, 200),
        updated_at: new Date().toISOString(),
      }).eq('id', row.id);

      const ledger = Array.isArray(ext.payment_ledger) ? [...ext.payment_ledger] : [];
      ledger.push({
        id: `pay_${Date.now().toString(36)}_${attemptNo}`,
        clinic_id: clinic.id, clinic_name: clinic.name, date: today, paidAt: today,
        amount, amountUzs: amount, method: 'click', status: ok ? 'paid' : 'failed',
        subscriptionStatus: ok ? 'active' : 'past_due', orderId: txParam,
        note: ok ? 'Sinov tugadi: avtomatik yechish (Click)' : `Avtomatik yechish muvaffaqiyatsiz (${result.error_code})`,
        created_at: new Date().toISOString(),
      });

      if (ok) {
        const newExpiry = addMonths(today, 1);
        const nextExt = { ...ext, subscription_status: 'active', billing_status: 'paid', payment_provider: 'click', period_ends_at: newExpiry, payment_ledger: ledger.slice(-50) };
        await sb.from('clinics').update({ logo: encodeExt(nextExt, rawLogo), expires_at: newExpiry, last_payment_date: today, monthly_fee: amount }).eq('id', clinic.id);
        summary.charged += 1;
      } else {
        const nextExt = { ...ext, subscription_status: 'past_due', billing_status: 'failed', payment_ledger: ledger.slice(-50) };
        await sb.from('clinics').update({ logo: encodeExt(nextExt, rawLogo) }).eq('id', clinic.id);
        summary.failed += 1;
      }
    } catch {
      summary.skipped += 1;
    }
  }
  return { status: 200, body: { ok: true, ...summary } };
}
