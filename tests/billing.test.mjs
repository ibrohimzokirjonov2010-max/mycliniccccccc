import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runCharges } from '../api/cron/charge-trials.js';
import { decide, nextExpiry, currentPeriodStart } from '../api/_lib/billing.js';
import { classifyPayment } from '../api/_lib/click.js';
import { decodeExt, encodeExt } from '../api/_lib/clinicExt.js';
import { markStuckPending, reconcileUnknown } from '../api/_lib/reconcile.js';
import { fakeDb } from './fakeDb.mjs';

const cfg = { serviceId: 1, paidStatuses: [2] };
const PAID = { error_code: 0, error_note: 'Success', payment_id: 555, payment_status: 2 };
const ok = async () => PAID;
const fail = async () => ({ error_code: -5017, error_note: 'Not enough funds' });
const clinic = (id, ext, extra = {}) => ({ id, name: id, plan: ext.tariff || 'pro', status: 'Active', expires_at: ext.trial_ends_at || ext.period_ends_at, logo: encodeExt(ext, 'LOGO'), ...extra });
const trial = (end, tariff = 'pro') => ({ subscription_status: 'trialing', trial_ends_at: end, tariff });
const active = (end, tariff = 'pro') => ({ subscription_status: 'active', period_ends_at: end, tariff });
const pm = (id, clinicId) => ({ id, clinic_id: clinicId, card_token: `T-${clinicId}`, status: 'active', provider: 'click' });
const one = (c) => ({ clinic_payment_methods: [pm('pm1', c.id)], clinics: [c], clinic_payment_charges: [] });
const extOf = (t, id) => decodeExt(t.clinics.find((c) => c.id === id).logo).ext;

test('classifyPayment: payment_status bo\'yicha yakuniy holat', () => {
  assert.equal(classifyPayment(PAID, cfg), 'success');
  assert.equal(classifyPayment({ error_code: 0, payment_status: 1 }, cfg), 'pending');
  assert.equal(classifyPayment({ error_code: 0, payment_status: 0 }, cfg), 'pending');
  assert.equal(classifyPayment({ error_code: 0 }, cfg), 'pending');
  assert.equal(classifyPayment({ error_code: 0, payment_status: -1 }, cfg), 'failed');
  assert.equal(classifyPayment({ error_code: -5017 }, cfg), 'failed');
  assert.equal(classifyPayment({ error_code: 0, payment_status: 1 }, { paidStatuses: [1, 2] }), 'success');
});

test('trial tugaganda birinchi yechish, keyin oylik yangilanish (active)', async () => {
  const { sb, tables } = fakeDb(one(clinic('c', trial('2026-10-18'))));
  let out = await runCharges({ sb, cfg, today: '2026-10-18', pay: ok });
  assert.equal(out.body.charged, 1);
  let c = tables.clinics[0];
  assert.equal(c.expires_at, '2026-11-18'); assert.equal(extOf(tables, 'c').subscription_status, 'active');
  // Davr o'rtasida — yechilmaydi
  out = await runCharges({ sb, cfg, today: '2026-11-01', pay: ok }); assert.equal(out.body.charged, 0);
  // Muddat keldi -> ACTIVE klinika qayta yechiladi
  out = await runCharges({ sb, cfg, today: '2026-11-18', pay: ok });
  assert.equal(out.body.charged, 1);
  c = tables.clinics[0];
  assert.equal(c.expires_at, '2026-12-18'); assert.equal(extOf(tables, 'c').period_ends_at, '2026-12-18');
  assert.equal(tables.clinic_payment_charges.filter((x) => x.status === 'success').length, 2);
  assert.ok(tables.billing_ledger.length === 2);
});

test('active klinika expires_at fallback ([EXT].period_ends_at yo\'q)', async () => {
  const c = clinic('c', { subscription_status: 'active', tariff: 'basic' }, { expires_at: '2026-10-10' });
  const { sb, tables } = fakeDb(one(c));
  const calls = [];
  const out = await runCharges({ sb, cfg, today: '2026-10-13', pay: async (a) => { calls.push(a); return PAID; } });
  assert.equal(out.body.charged, 1); assert.equal(calls[0].amount, 99000);
  // Kechikkan yechish: period anchor (10.11) bugundan keyin -> 2026-11-10
  assert.equal(tables.clinics[0].expires_at, '2026-11-10');
});

test('nextExpiry: anchor bugundan oldin qolsa bugundan +1 oy', () => {
  assert.equal(nextExpiry('2026-08-01', '2026-10-13'), '2026-11-13');
  assert.equal(nextExpiry('2026-01-31', '2026-01-31'), '2026-02-28');
});

test('urinishlar davr bo\'yicha: davrda 3 ta, yangi davrda yana 3 ta', async () => {
  const { sb, tables } = fakeDb(one(clinic('c', trial('2026-10-18'))));
  for (const d of ['2026-10-18', '2026-10-19', '2026-10-20']) assert.equal((await runCharges({ sb, cfg, today: d, pay: fail })).body.failed, 1);
  assert.equal((await runCharges({ sb, cfg, today: '2026-10-21', pay: fail })).body.failed, 0);
  assert.equal(extOf(tables, 'c').subscription_status, 'past_due');
  assert.equal(tables.clinics[0].expires_at, '2026-10-18');
  // Admin muddatni uzaytirib, yangi davr ochsa (masalan qo'lda to'lov) — keyingi davrda yana urinish mumkin
  const c = tables.clinics[0];
  const { ext, rawLogo } = decodeExt(c.logo);
  c.logo = encodeExt({ ...ext, subscription_status: 'active', period_ends_at: '2026-11-18' }, rawLogo); c.expires_at = '2026-11-18';
  assert.equal((await runCharges({ sb, cfg, today: '2026-11-18', pay: ok })).body.charged, 1);
});

test('past_due 2-urinishda muvaffaqiyat: muddat davrga bog\'lanadi', async () => {
  const { sb, tables } = fakeDb(one(clinic('c', trial('2026-10-18'))));
  await runCharges({ sb, cfg, today: '2026-10-18', pay: fail });
  const out = await runCharges({ sb, cfg, today: '2026-10-19', pay: ok });
  assert.equal(out.body.charged, 1); assert.equal(tables.clinics[0].expires_at, '2026-11-18');
});

test('unknown faqat o\'z davrini bloklaydi va reconcile uni hal qiladi', async () => {
  const { sb, tables } = fakeDb(one(clinic('c', trial('2026-10-18'))));
  let n = 0;
  let out = await runCharges({ sb, cfg, today: '2026-10-18', pay: async () => { n += 1; throw new Error('timeout'); } });
  assert.equal(out.body.unknown, 1);
  out = await runCharges({ sb, cfg, today: '2026-10-19', pay: async () => { n += 1; return PAID; } });
  assert.equal(n, 1); assert.equal(out.body.charged, 0); // qayta YECHILMAYDI
  const r = await reconcileUnknown(sb, cfg, { today: '2026-10-19', lookup: async (q) => { assert.equal(q.merchantTransId, 'myclinic:c:2026-10-18:1'); return PAID; } });
  assert.equal(r.success, 1);
  assert.equal(tables.clinics[0].expires_at, '2026-11-18');
  assert.equal(extOf(tables, 'c').subscription_status, 'active');
});

test('reconcile: failed -> davr limitiga kiradi va qayta urinish mumkin', async () => {
  const { sb, tables } = fakeDb(one(clinic('c', trial('2026-10-18'))));
  await runCharges({ sb, cfg, today: '2026-10-18', pay: async () => { throw new Error('x'); } });
  tables.clinic_payment_charges[0].created_at = '2020-01-01T00:00:00.000Z'; // 1 soatdan eski
  const r = await reconcileUnknown(sb, cfg, { today: '2026-10-19', lookup: async () => ({ error_code: 0, payment_status: -1 }) });
  assert.equal(r.failed, 1);
  const out = await runCharges({ sb, cfg, today: '2026-10-19', pay: ok });
  assert.equal(out.body.charged, 1);
  assert.equal(tables.clinic_payment_charges.find((x) => x.status === 'success').attempt_no, 2);
});

test('payment_status=1 (jarayonda) -> unknown, klinika o\'zgarmaydi', async () => {
  const { sb, tables } = fakeDb(one(clinic('c', trial('2026-10-18'))));
  const out = await runCharges({ sb, cfg, today: '2026-10-18', pay: async () => ({ error_code: 0, payment_id: 9, payment_status: 1 }) });
  assert.equal(out.body.pending, 1);
  assert.equal(tables.clinic_payment_charges[0].status, 'unknown');
  assert.equal(tables.clinic_payment_charges[0].click_payment_id, '9');
  assert.equal(extOf(tables, 'c').subscription_status, 'trialing');
});

test('DB xatosi: charge insert xato bersa to\'lov YUBORILMAYDI', async () => {
  const { sb } = fakeDb(one(clinic('c', trial('2026-10-18'))), { failOn: { 'clinic_payment_charges.insert': () => true } });
  let paid = 0;
  const out = await runCharges({ sb, cfg, today: '2026-10-18', pay: async () => { paid += 1; return PAID; } });
  assert.equal(paid, 0); assert.equal(out.body.errors, 1);
});

test('clinic update xato bersa: keyingi run qayta yechmaydi, faqat "repair" qiladi', async () => {
  let failClinic = true;
  const { sb, tables } = fakeDb(one(clinic('c', trial('2026-10-18'))), { failOn: { 'clinics.update': () => failClinic } });
  let paid = 0;
  const pay = async () => { paid += 1; return PAID; };
  let out = await runCharges({ sb, cfg, today: '2026-10-18', pay });
  assert.equal(out.body.errors, 1); assert.equal(paid, 1);
  failClinic = false;
  out = await runCharges({ sb, cfg, today: '2026-10-19', pay });
  assert.equal(paid, 1); assert.equal(out.body.repaired, 1);
  assert.equal(tables.clinics[0].expires_at, '2026-11-18');
  out = await runCharges({ sb, cfg, today: '2026-10-20', pay });
  assert.equal(paid, 1); assert.equal(out.body.repaired + out.body.charged, 0);
});

test('charge update xato bersa klinika faollashtirilmaydi (pending -> keyin unknown)', async () => {
  const { sb, tables } = fakeDb(one(clinic('c', trial('2026-10-18'))), { failOn: { 'clinic_payment_charges.update': (p) => p.status === 'success' } });
  const out = await runCharges({ sb, cfg, today: '2026-10-18', pay: ok });
  assert.equal(out.body.errors, 1); assert.equal(tables.clinic_payment_charges[0].status, 'pending');
  assert.equal(extOf(tables, 'c').subscription_status, 'trialing');
});

test('osilib qolgan pending -> unknown', async () => {
  const { sb, tables } = fakeDb({ clinic_payment_charges: [
    { id: 'a', clinic_id: 'x1', transaction_parameter: 't1', status: 'pending', created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString() },
    { id: 'b', clinic_id: 'x2', transaction_parameter: 't2', status: 'pending', created_at: new Date().toISOString() },
  ] });
  const r = await markStuckPending(sb);
  assert.equal(r.count, 1);
  assert.deepEqual(tables.clinic_payment_charges.map((x) => x.status), ['unknown', 'pending']);
});

test('batch limiti va vaqt byudjeti', async () => {
  const seed = { clinic_payment_methods: [], clinics: [], clinic_payment_charges: [] };
  for (let i = 0; i < 5; i += 1) { seed.clinics.push(clinic(`c${i}`, trial('2026-10-18'))); seed.clinic_payment_methods.push(pm(`pm${i}`, `c${i}`)); }
  const { sb } = fakeDb(seed);
  let out = await runCharges({ sb, cfg, today: '2026-10-18', pay: ok, batch: 2 });
  assert.equal(out.body.charged, 2); assert.equal(out.body.deferred, 3);
  out = await runCharges({ sb, cfg, today: '2026-10-18', pay: ok, batch: 10, budgetMs: -1 });
  assert.equal(out.body.charged, 0); assert.equal(out.body.deferred, 5);
});

test('decide: Inactive/expired statuslar va currentPeriodStart', () => {
  assert.equal(currentPeriodStart({}, { subscription_status: 'expired' }), null);
  assert.equal(decide({ clinic: { expires_at: '2026-10-01' }, ext: { subscription_status: 'active' }, charges: [], today: '2026-10-13' }).action, 'charge');
  assert.equal(decide({ clinic: {}, ext: trial('2026-10-20'), charges: [], today: '2026-10-13' }).reason, 'not_due');
});
