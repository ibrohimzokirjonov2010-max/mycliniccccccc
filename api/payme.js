import crypto from 'node:crypto';
import { applyPaidMonths, loadClinic, monthsFor, PAY_TABLE, revokePaidMonths } from './_lib/payments.js';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';

/**
 * Payme Merchant API (JSON-RPC 2.0): https://developer.help.paycom.uz/
 * Payme kabinetida Endpoint URL: https://<domen>/api/payme
 * Hisob (account) maydoni: clinic_id (klinika ID). Summa tiyinda: oylik narx x 100 x N oy (1..12).
 * Avtorizatsiya: Basic base64("Paycom:" + PAYME_KEY). Env: PAYME_KEY (test: PAYME_TEST_KEY ham qabul qilinadi).
 */
const TIMEOUT_MS = 12 * 60 * 60 * 1000;
const ERR = {
  auth: [-32504, 'Insufficient privileges'], method: [-32601, 'Method not found'], parse: [-32700, 'Parse error'],
  rpc: [-32600, 'Invalid request'], amount: [-31001, 'Incorrect amount'], notFound: [-31003, 'Transaction not found'],
  cantPerform: [-31008, 'Unable to perform operation'], cantCancel: [-31007, 'Order completed, cannot cancel'],
  account: [-31050, 'Clinic not found'], busy: [-31051, 'Another transaction in progress for this clinic'], server: [-32400, 'System error'],
};
const msg = (text) => ({ uz: text, ru: text, en: text });

function reply(res, id, payload) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ jsonrpc: '2.0', id: id ?? null, ...payload });
}
const fail = (res, id, e, data) => reply(res, id, { error: { code: e[0], message: msg(e[1]), ...(data ? { data } : {}) } });

function authOk(header) {
  const keys = [process.env.PAYME_KEY, process.env.PAYME_TEST_KEY].map((k) => String(k || '').trim()).filter(Boolean);
  const m = /^Basic\s+(.+)$/i.exec(String(header || ''));
  if (!m || keys.length === 0) return false;
  const given = Buffer.from(Buffer.from(m[1], 'base64').toString('utf8'));
  return keys.some((k) => {
    const exp = Buffer.from(`Paycom:${k}`);
    return exp.length === given.length && crypto.timingSafeEqual(exp, given);
  });
}

function txView(t) {
  return {
    create_time: Number(t.create_time || 0), perform_time: Number(t.perform_time || 0), cancel_time: Number(t.cancel_time || 0),
    transaction: String(t.id), state: Number(t.state), reason: t.reason == null ? null : Number(t.reason),
  };
}

async function checkPerform(sb, params) {
  const clinic = await loadClinic(sb, params?.account?.clinic_id);
  if (!clinic) return { error: ERR.account, data: 'clinic_id' };
  const tiyin = Number(params?.amount);
  if (!Number.isInteger(tiyin) || tiyin % 100 !== 0) return { error: ERR.amount };
  const months = monthsFor(clinic, tiyin / 100);
  if (!months) return { error: ERR.amount };
  return { clinic, months, amount: tiyin / 100 };
}

const byTxn = (sb, id) => sb.from(PAY_TABLE).select('*').eq('provider', 'payme').eq('provider_txn_id', String(id || '')).maybeSingle();

export default async function handler(req, res) {
  if (req.method !== 'POST') return fail(res, null, ERR.rpc);
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { return fail(res, null, ERR.parse); } }
  const id = body?.id;
  if (!authOk(req.headers.authorization)) return fail(res, id, ERR.auth);
  const { method, params = {} } = body || {};
  const sb = supabaseAdmin();
  if (!sb) return fail(res, id, ERR.server);
  const now = Date.now();

  try {
    switch (method) {
      case 'CheckPerformTransaction': {
        const r = await checkPerform(sb, params);
        if (r.error) return fail(res, id, r.error, r.data);
        return reply(res, id, { result: { allow: true } });
      }
      case 'CreateTransaction': {
        const { data: t } = await byTxn(sb, params.id);
        if (t) {
          if (Number(t.state) !== 1) return fail(res, id, ERR.cantPerform);
          if (now - Number(t.create_time) > TIMEOUT_MS) {
            await sb.from(PAY_TABLE).update({ state: -1, status: 'cancelled', reason: 4, cancel_time: now, updated_at: new Date().toISOString() }).eq('id', t.id);
            return fail(res, id, ERR.cantPerform);
          }
          return reply(res, id, { result: { create_time: Number(t.create_time), transaction: String(t.id), state: 1 } });
        }
        const r = await checkPerform(sb, params);
        if (r.error) return fail(res, id, r.error, r.data);
        const { data: open } = await sb.from(PAY_TABLE).select('id').eq('provider', 'payme').eq('clinic_id', r.clinic.id).eq('state', 1).limit(1);
        if (open && open.length > 0) return fail(res, id, ERR.busy);
        const createTime = Number(params.time) || now;
        const { data: row, error } = await sb.from(PAY_TABLE).insert({
          clinic_id: r.clinic.id, amount: r.amount, months: r.months, provider: 'payme', status: 'pending',
          provider_txn_id: String(params.id), state: 1, create_time: createTime,
        }).select('*').single();
        if (error || !row) return fail(res, id, ERR.server);
        return reply(res, id, { result: { create_time: createTime, transaction: String(row.id), state: 1 } });
      }
      case 'PerformTransaction': {
        const { data: t } = await byTxn(sb, params.id);
        if (!t) return fail(res, id, ERR.notFound);
        if (Number(t.state) === 2) return reply(res, id, { result: { transaction: String(t.id), perform_time: Number(t.perform_time), state: 2 } });
        if (Number(t.state) !== 1) return fail(res, id, ERR.cantPerform);
        if (now - Number(t.create_time) > TIMEOUT_MS) {
          await sb.from(PAY_TABLE).update({ state: -1, status: 'cancelled', reason: 4, cancel_time: now, updated_at: new Date().toISOString() }).eq('id', t.id);
          return fail(res, id, ERR.cantPerform);
        }
        const { data: flipped } = await sb.from(PAY_TABLE).update({ state: 2, status: 'paid', perform_time: now, paid_at: new Date(now).toISOString(), updated_at: new Date().toISOString() })
          .eq('id', t.id).eq('state', 1).select('id');
        if (flipped && flipped.length > 0) {
          const clinic = await loadClinic(sb, t.clinic_id);
          if (clinic) await applyPaidMonths(sb, clinic, { months: t.months, amount: t.amount, provider: 'payme', txnId: params.id, note: 'Payme orqali to\'lov' });
          return reply(res, id, { result: { transaction: String(t.id), perform_time: now, state: 2 } });
        }
        const { data: again } = await byTxn(sb, params.id);
        return reply(res, id, { result: { transaction: String(again.id), perform_time: Number(again.perform_time), state: Number(again.state) } });
      }
      case 'CancelTransaction': {
        const { data: t } = await byTxn(sb, params.id);
        if (!t) return fail(res, id, ERR.notFound);
        const st = Number(t.state);
        if (st < 0) return reply(res, id, { result: { transaction: String(t.id), cancel_time: Number(t.cancel_time), state: st } });
        const nextState = st === 2 ? -2 : -1;
        await sb.from(PAY_TABLE).update({ state: nextState, status: 'cancelled', reason: Number(params.reason) || null, cancel_time: now, updated_at: new Date().toISOString() }).eq('id', t.id);
        if (st === 2) {
          const clinic = await loadClinic(sb, t.clinic_id);
          if (clinic) await revokePaidMonths(sb, clinic, t.months);
        }
        return reply(res, id, { result: { transaction: String(t.id), cancel_time: now, state: nextState } });
      }
      case 'CheckTransaction': {
        const { data: t } = await byTxn(sb, params.id);
        if (!t) return fail(res, id, ERR.notFound);
        return reply(res, id, { result: txView(t) });
      }
      case 'GetStatement': {
        const { data } = await sb.from(PAY_TABLE).select('*').eq('provider', 'payme')
          .gte('create_time', Number(params.from) || 0).lte('create_time', Number(params.to) || now).order('create_time', { ascending: true });
        return reply(res, id, {
          result: {
            transactions: (data || []).map((t) => ({
              id: t.provider_txn_id, time: Number(t.create_time), amount: Number(t.amount) * 100, account: { clinic_id: t.clinic_id }, ...txView(t),
            })),
          },
        });
      }
      default:
        return fail(res, id, ERR.method);
    }
  } catch {
    return fail(res, id, ERR.server);
  }
}
