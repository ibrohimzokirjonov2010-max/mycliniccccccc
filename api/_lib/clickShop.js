import { send } from './http.js';
import { clickParams, clickSignOk } from './clickSign.js';
import { applyPaidMonths, loadClinic, monthsFor, PAY_TABLE } from './payments.js';
import { supabaseAdmin } from './supabaseAdmin.js';

/**
 * Click SHOP API (merchant callback'lari). Click kabinetida:
 *   Prepare URL:  https://<domen>/api/click/prepare
 *   Complete URL: https://<domen>/api/click/complete
 * merchant_trans_id = klinika ID (masalan "ibrohim-dent"); amount = oylik narx x N oy (1..12).
 * Env: CLICK_SERVICE_ID, CLICK_SECRET_KEY (+ SUPABASE_SERVICE_ROLE_KEY).
 */
const E = {
  OK: [0, 'Success'], SIGN: [-1, 'SIGN CHECK FAILED!'], AMOUNT: [-2, 'Incorrect parameter amount'],
  ACTION: [-3, 'Action not found'], PAID: [-4, 'Already paid'], USER: [-5, 'User does not exist'],
  TXN: [-6, 'Transaction does not exist'], UPDATE: [-7, 'Failed to update user'], REQ: [-8, 'Error in request from click'],
  CANCELLED: [-9, 'Transaction cancelled'],
};

export async function clickShopHandler(req, res, stage) {
  if (req.method !== 'POST') return send(res, 405, { error: -8, error_note: 'Method not allowed' });
  const p = clickParams(req);
  const action = Number(stage === 'prepare' ? 0 : 1);
  const base = { click_trans_id: p.click_trans_id, merchant_trans_id: p.merchant_trans_id };
  const reply = (code, extra = {}) => send(res, 200, { ...base, ...extra, error: code[0], error_note: code[1] });

  const secret = String(process.env.CLICK_SECRET_KEY || '').trim();
  const serviceId = String(process.env.CLICK_SERVICE_ID || '').trim();
  if (!secret || !serviceId) return reply([-8, 'Merchant not configured']);
  const required = ['click_trans_id', 'service_id', 'merchant_trans_id', 'amount', 'action', 'sign_time', 'sign_string'];
  if (required.some((k) => p[k] === undefined || p[k] === '') || (action === 1 && !p.merchant_prepare_id)) return reply(E.REQ);
  if (Number(p.action) !== action) return reply(E.ACTION);
  if (!clickSignOk(p, secret)) return reply(E.SIGN);
  if (String(p.service_id) !== serviceId) return reply(E.REQ);

  const sb = supabaseAdmin();
  if (!sb) return reply([-8, 'Server not configured']);
  const clinic = await loadClinic(sb, p.merchant_trans_id);
  if (!clinic) return reply(E.USER);
  const amount = Math.round(Number(p.amount));
  const months = monthsFor(clinic, amount);
  if (!months || Math.abs(Number(p.amount) - amount) > 0.001) return reply(E.AMOUNT);
  const txn = String(p.click_trans_id);

  const { data: existing } = await sb.from(PAY_TABLE).select('*').eq('provider', 'click').eq('provider_txn_id', txn).maybeSingle();

  if (stage === 'prepare') {
    if (existing) {
      if (existing.status === 'paid') return reply(E.PAID);
      if (existing.status === 'cancelled') return reply(E.CANCELLED);
      return reply(E.OK, { merchant_prepare_id: existing.id });
    }
    const { data: row, error } = await sb.from(PAY_TABLE).insert({
      clinic_id: clinic.id, amount, months, provider: 'click', status: 'pending', provider_txn_id: txn,
      note: `click_paydoc_id=${String(p.click_paydoc_id || '').slice(0, 40)}`,
    }).select('id').single();
    if (error || !row) return reply(E.UPDATE);
    return reply(E.OK, { merchant_prepare_id: row.id });
  }

  // complete
  if (!existing || String(existing.id) !== String(p.merchant_prepare_id)) return reply(E.TXN);
  if (existing.status === 'paid') return reply(E.PAID, { merchant_confirm_id: existing.id });
  if (existing.status === 'cancelled') return reply(E.CANCELLED);
  if (Number(existing.amount) !== amount) return reply(E.AMOUNT);
  const now = new Date().toISOString();
  if (Number(p.error) < 0) {
    await sb.from(PAY_TABLE).update({ status: 'cancelled', note: String(p.error_note || 'click error').slice(0, 200), updated_at: now }).eq('id', existing.id);
    return reply(E.CANCELLED);
  }
  // Ikki marta qo'llamaslik: faqat pending -> paid o'tishi muvaffaqiyatli bo'lsa muddat uzaytiriladi.
  const { data: flipped } = await sb.from(PAY_TABLE).update({ status: 'paid', paid_at: now, updated_at: now })
    .eq('id', existing.id).eq('status', 'pending').select('id');
  if (!flipped || flipped.length === 0) return reply(E.PAID, { merchant_confirm_id: existing.id });
  try {
    await applyPaidMonths(sb, clinic, { months: existing.months || months, amount, provider: 'click', txnId: txn, note: 'Click orqali to\'lov' });
  } catch {
    return reply(E.UPDATE);
  }
  return reply(E.OK, { merchant_confirm_id: existing.id });
}
