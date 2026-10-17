import { applyResult } from '../_lib/billing.js';
import { clickConfig } from '../_lib/click.js';
import { tashkentToday } from '../_lib/dates.js';
import { bearerOk, bodyOf, send } from '../_lib/http.js';
import { reconcileUnknown } from '../_lib/reconcile.js';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';

/**
 * POST /api/admin/reconcile-charges   Authorization: Bearer <ADMIN_API_SECRET>
 *  {}                                     -> barcha 'unknown' urinishlarni Click payment status orqali tekshiradi
 *  { charge_id }                          -> faqat bitta urinish
 *  { charge_id, resolve: 'success'|'failed', note } -> Click kabinetida qo'lda tekshirilgandan so'ng majburiy hal qilish
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return send(res, 405, { ok: false, error: 'method_not_allowed' }); }
  if (!process.env.ADMIN_API_SECRET || !bearerOk(req, process.env.ADMIN_API_SECRET)) return send(res, 401, { ok: false, error: 'unauthorized' });
  const sb = supabaseAdmin();
  if (!sb) return send(res, 503, { ok: false, error: 'server_not_configured' });
  const body = bodyOf(req);
  const chargeId = body.charge_id ? String(body.charge_id) : undefined;
  const today = tashkentToday();

  if (body.resolve) {
    if (!chargeId || !['success', 'failed'].includes(body.resolve)) return send(res, 400, { ok: false, error: 'invalid_request' });
    const ok = body.resolve === 'success';
    const { data: rows, error } = await sb.from('clinic_payment_charges').update({
      status: body.resolve, reconciled_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      click_error_note: `manual:${String(body.note || '').slice(0, 180)}`,
    }).eq('id', chargeId).in('status', ['unknown', 'pending']).select('id,clinic_id,amount,period_start,transaction_parameter,attempt_no');
    if (error) return send(res, 500, { ok: false, error: 'db_error' });
    if (!rows || rows.length === 0) return send(res, 409, { ok: false, error: 'not_open' });
    const ch = rows[0];
    const { data: clinic } = await sb.from('clinics').select('id,name,logo,plan,status,expires_at').eq('id', ch.clinic_id).maybeSingle();
    if (clinic) {
      const e = await applyResult(sb, { clinic, ok, amount: ch.amount, period: String(ch.period_start).slice(0, 10), today, tx: ch.transaction_parameter, attemptNo: ch.attempt_no, chargeId: ch.id });
      if (e) return send(res, 500, { ok: false, error: 'clinic_update_failed', charge_status: body.resolve });
    }
    return send(res, 200, { ok: true, resolved: body.resolve, charge_id: chargeId });
  }

  const cfg = clickConfig();
  if (!cfg.configured) return send(res, 200, { ok: true, skipped: 'click_not_configured' });
  const out = await reconcileUnknown(sb, cfg, { today, chargeId, limit: 50 });
  return send(res, 200, { ok: true, ...out });
}
