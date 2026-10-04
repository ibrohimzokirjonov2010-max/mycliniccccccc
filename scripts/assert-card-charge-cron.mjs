// node scripts/assert-card-charge-cron.mjs — kunlik avtomatik yechish mantiqi (xotiradagi soxta Supabase + soxta Click).
import assert from 'node:assert/strict';
import { runCharges } from '../api/cron/charge-trials.js';
import { decodeExt, encodeExt } from '../api/_lib/clinicExt.js';

function fakeDb(seed) {
  const tables = JSON.parse(JSON.stringify(seed));
  let seq = 0;
  const from = (name) => {
    const rows = tables[name];
    const st = { filters: [], op: 'select', payload: null, orderBy: null, lim: null, single: false, maybe: false };
    const exec = () => {
      let matched = rows.filter((r) => st.filters.every(([k, v]) => r[k] === v));
      if (st.op === 'insert') {
        const row = { id: `id${++seq}`, created_at: new Date(Date.now() + seq).toISOString(), ...st.payload };
        if (name === 'clinic_payment_charges' && rows.some((r) => (r.clinic_id === row.clinic_id && r.attempt_date === row.attempt_date) || r.transaction_parameter === row.transaction_parameter)) {
          return { data: null, error: { code: '23505' } };
        }
        rows.push(row);
        return { data: st.single ? row : [row], error: null };
      }
      if (st.op === 'update') { matched.forEach((r) => Object.assign(r, st.payload)); return { data: matched, error: null }; }
      if (st.orderBy) matched = [...matched].sort((a, b) => String(b[st.orderBy]).localeCompare(String(a[st.orderBy])));
      if (st.lim) matched = matched.slice(0, st.lim);
      if (st.single || st.maybe) return { data: matched[0] || null, error: null };
      return { data: matched, error: null };
    };
    const b = {
      select() { return b; }, insert(p) { st.op = 'insert'; st.payload = p; return b; }, update(p) { st.op = 'update'; st.payload = p; return b; },
      eq(k, v) { st.filters.push([k, v]); return b; }, order(k) { st.orderBy = k; return b; }, limit(n) { st.lim = n; return b; },
      single() { st.single = true; return b; }, maybeSingle() { st.maybe = true; return b; },
      then(res, rej) { return Promise.resolve(exec()).then(res, rej); },
    };
    return b;
  };
  return { sb: { from }, tables };
}

const clinic = (id, ext, extra = {}) => ({ id, name: id, plan: ext.tariff || 'pro', status: 'Active', expires_at: ext.trial_ends_at, logo: encodeExt(ext, 'LOGO'), ...extra });
const trial = (end, tariff = 'pro') => ({ subscription_status: 'trialing', trial_ends_at: end, tariff });
const seed = () => ({
  clinic_payment_methods: [
    { id: 'pm1', clinic_id: 'due', card_token: 'T1', status: 'active', provider: 'click' },
    { id: 'pm2', clinic_id: 'future', card_token: 'T2', status: 'active', provider: 'click' },
    { id: 'pm3', clinic_id: 'basicdue', card_token: 'T3', status: 'active', provider: 'click' },
    { id: 'pm4', clinic_id: 'inactive', card_token: 'T4', status: 'active', provider: 'click' },
  ],
  clinics: [
    clinic('due', trial('2026-10-18', 'pro')),
    clinic('future', trial('2026-10-25')),
    clinic('basicdue', trial('2026-10-10', 'basic')),
    clinic('inactive', trial('2026-10-10'), { status: 'Inactive' }),
    clinic('nocard', trial('2026-10-10')),
  ],
  clinic_payment_charges: [],
});
const cfg = { serviceId: 1 };
const ok = async () => ({ error_code: 0, error_note: 'Success', payment_id: 555, payment_status: 1 });

// Muvaffaqiyat: faqat muddati kelgan + kartali + faol klinikalar yechiladi, narx tarifga mos
{
  const { sb, tables } = fakeDb(seed());
  const calls = [];
  const out = await runCharges({ sb, cfg, today: '2026-10-18', pay: async (a) => { calls.push(a); return ok(); } });
  assert.deepEqual([out.body.charged, out.body.failed, out.body.unknown], [2, 0, 0]);
  assert.deepEqual(calls.map((c) => [c.cardToken, c.amount]).sort(), [['T1', 189000], ['T3', 99000]]);
  const due = tables.clinics.find((c) => c.id === 'due');
  const { ext, rawLogo } = decodeExt(due.logo);
  assert.equal(ext.subscription_status, 'active'); assert.equal(due.expires_at, '2026-11-18');
  assert.equal(due.last_payment_date, '2026-10-18'); assert.equal(due.monthly_fee, 189000); assert.equal(rawLogo, 'LOGO');
  assert.equal(ext.payment_ledger.at(-1).method, 'click');
  assert.equal(tables.clinics.find((c) => c.id === 'future').expires_at, '2026-10-25');
  // Xuddi shu kuni cron qayta ishlasa — ikkinchi marta YECHILMAYDI
  const again = await runCharges({ sb, cfg, today: '2026-10-18', pay: async (a) => { calls.push(a); return ok(); } });
  assert.equal(again.body.charged, 0); assert.equal(calls.length, 2);
}
// Muvaffaqiyatsiz -> past_due, keyingi kunlarda 3 martagacha qayta urinish
{
  const { sb, tables } = fakeDb(seed());
  const fail = async () => ({ error_code: -5017, error_note: 'Not enough funds' });
  let out = await runCharges({ sb, cfg, today: '2026-10-18', pay: fail });
  assert.equal(out.body.failed, 2);
  assert.equal(decodeExt(tables.clinics.find((c) => c.id === 'due').logo).ext.subscription_status, 'past_due');
  assert.equal(tables.clinics.find((c) => c.id === 'due').expires_at, '2026-10-18'); // muddat o'zgarmaydi -> mavjud blok ishlaydi
  out = await runCharges({ sb, cfg, today: '2026-10-19', pay: fail }); assert.equal(out.body.failed, 2);
  out = await runCharges({ sb, cfg, today: '2026-10-20', pay: fail }); assert.equal(out.body.failed, 2);
  out = await runCharges({ sb, cfg, today: '2026-10-21', pay: fail }); assert.equal(out.body.failed + out.body.charged, 0); // MAX 3
  // 2-urinishda muvaffaqiyat bo'lsa ham ishlaydi
  const s2 = fakeDb(seed());
  await runCharges({ sb: s2.sb, cfg, today: '2026-10-18', pay: fail });
  out = await runCharges({ sb: s2.sb, cfg, today: '2026-10-19', pay: ok });
  assert.equal(out.body.charged, 2);
  assert.equal(s2.tables.clinics.find((c) => c.id === 'due').expires_at, '2026-11-19');
}
// Natija noaniq (tarmoq xatosi) -> 'unknown', hech qachon qayta yechilmaydi
{
  const { sb, tables } = fakeDb(seed());
  let n = 0;
  let out = await runCharges({ sb, cfg, today: '2026-10-18', pay: async () => { n += 1; throw new Error('timeout'); } });
  assert.equal(out.body.unknown, 2);
  out = await runCharges({ sb, cfg, today: '2026-10-19', pay: async () => { n += 1; return ok(); } });
  assert.equal(n, 2); assert.equal(out.body.charged, 0);
  assert.equal(decodeExt(tables.clinics.find((c) => c.id === 'due').logo).ext.subscription_status, 'trialing');
}
console.log('assert-card-charge-cron: OK');
