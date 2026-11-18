// node scripts/assert-self-serve-signup.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { signupClinic, loginAvailable } from '../api/_lib/signup.js';
import { signupPlan } from '../api/_lib/plans.js';
import { isReadOnlyClinic } from '../api/_lib/payments.js';
import { encodeExt } from '../api/_lib/clinicExt.js';
import { CONSENT_TEXT, consentText } from '../src/config/cardBinding.js';
import { signupFieldErrors } from '../src/lib/signupRules.js';
import { slugifyClinic } from '../src/lib/clinicSlug.js';

assert.equal(signupPlan(''), 'basic');
assert.equal(signupPlan('nope'), 'basic');
assert.equal(signupPlan('pro'), 'pro');
assert.equal(signupPlan('klinika'), 'premium');
assert.equal(slugifyClinic('Grand Dental'), 'grand-dental');
assert.equal(slugifyClinic('Шаҳар'), 'shahar');
assert.equal(CONSENT_TEXT, "14 kunlik bepul sinovdan keyin kartangizdan tarif narxi avtomatik yechiladi");
assert.ok(consentText({ amountText: '99\u00A0000', planName: 'Basic', trialDays: 14 }).includes(CONSENT_TEXT));
assert.ok(consentText({ amountText: '99\u00A0000', planName: 'Basic' }).includes('99'));
assert.equal(signupFieldErrors({ ownerName: '', clinicName: 'A', username: 'ab', password: 'short' }).password, "Parol kamida 8 ta belgidan iborat bo'lishi kerak");
assert.ok(signupFieldErrors({ ownerName: 'Ali', clinicName: 'A', username: 'ali', password: '12345678' }).username === undefined);

const registerSrc = fs.readFileSync('src/pages/Register.jsx', 'utf8');
assert.ok(registerSrc.includes("Google bilan ro'yxatdan o'tish"));
assert.ok(registerSrc.includes('autoComplete="new-password"'));
assert.ok(registerSrc.includes('Bu login band'));
const adminSrc = fs.readFileSync('api/admin.js', 'utf8');
const cardsAt = adminSrc.indexOf("action === 'cards'");
assert.ok(cardsAt > 0);
assert.ok(!adminSrc.slice(cardsAt, cardsAt + 700).includes('card_token'));
assert.ok(isReadOnlyClinic({ logo: encodeExt({ subscription_status: 'past_due' }, '') }));
assert.equal(isReadOnlyClinic({ logo: encodeExt({ subscription_status: 'trialing' }, '') }), false);

function fakeDb(seed) {
  const tables = { clinics: [], users: [], ...JSON.parse(JSON.stringify(seed || {})) };
  const from = (name) => {
    const rows = tables[name] || (tables[name] = []);
    const st = { op: 'select', filters: [], payload: null, lim: null, single: false };
    const exec = () => {
      const matched = rows.filter((r) => st.filters.every(([k, v]) => r[k] === v));
      if (st.op === 'insert') {
        if (name === 'clinics' && rows.some((r) => r.id === st.payload.id)) return { data: null, error: { code: '23505' } };
        if (name === 'users' && rows.some((r) => r.clinic_id === st.payload.clinic_id && String(r.username).toLowerCase() === String(st.payload.username).toLowerCase())) {
          return { data: null, error: { code: '23505' } };
        }
        rows.push({ ...st.payload });
        return { data: st.payload, error: null };
      }
      if (st.op === 'delete') {
        for (let i = rows.length - 1; i >= 0; i -= 1) {
          if (st.filters.every(([k, v]) => rows[i][k] === v)) rows.splice(i, 1);
        }
        return { data: null, error: null };
      }
      const sliced = st.lim ? matched.slice(0, st.lim) : matched;
      if (st.single) return { data: sliced[0] || null, error: null };
      return { data: sliced, error: null };
    };
    const b = {
      select() { return b; },
      insert(p) { st.op = 'insert'; st.payload = p; return b; },
      delete() { st.op = 'delete'; return b; },
      eq(k, v) { st.filters.push([k, v]); return b; },
      limit(n) { st.lim = n; return b; },
      maybeSingle() { st.single = true; return b; },
      then(res, rej) { return Promise.resolve(exec()).then(res, rej); },
    };
    return b;
  };
  return { tables, sb: { from, auth: { async getUser(token) {
    if (token !== 'good-google') return { data: { user: null }, error: { message: 'bad' } };
    return { data: { user: { email: 'ali@example.com', user_metadata: { full_name: 'Ali Valiyev' } } }, error: null };
  } } } };
}

const now = new Date('2026-10-04T12:00:00Z');
const deps = {
  now: () => now,
  hash: async () => 'hashed-secret',
  mint: async () => ({ access_token: 'a', refresh_token: 'r', expires_at: 1, expires_in: 3600, token_type: 'bearer' }),
};
const body = { owner_name: 'Ali', clinic_name: 'Grand Dental', username: 'Ali.Doc', password: 'parol1234', plan: '' };

{
  const { sb, tables } = fakeDb();
  const [status, data] = await signupClinic(sb, body, deps);
  assert.equal(status, 200);
  assert.equal(data.clinic.plan, 'basic');
  assert.equal(data.clinic.expires_at, '2026-10-18');
  assert.equal(data.user.username, 'ali.doc');
  assert.equal(data.user.role, 'admin');
  assert.equal(data.user.password, undefined);
  assert.equal(data.clinic.password, undefined);
  assert.ok(data.session.access_token);
  assert.ok(!JSON.stringify(data).includes('parol1234'));
  assert.ok(!JSON.stringify(data).includes('card_token'));
  assert.equal(tables.clinics[0].plan, 'basic');
  assert.ok(tables.users[0].password === 'hashed-secret');
  const again = await signupClinic(sb, body, deps);
  assert.equal(again[0], 409);
  assert.equal(again[1].error, 'username_taken');
  const otherLogin = await signupClinic(sb, { ...body, username: 'boshqa' }, deps);
  assert.equal(otherLogin[1].error, 'clinic_taken');
}

{
  const { sb } = fakeDb();
  const [status, data] = await signupClinic(sb, { ...body, password: 'short' }, deps);
  assert.equal(status, 400);
  assert.equal(data.error, 'weak_password');
  const googleBad = await signupClinic(sb, { ...body, clinic_name: 'Boshqa', google_access_token: 'nope' }, deps);
  assert.equal(googleBad[0], 401);
  const googleOk = await signupClinic(sb, { clinic_name: 'Nur Klinika', username: 'nur', password: 'parol1234', google_access_token: 'good-google' }, deps);
  assert.equal(googleOk[0], 200);
  assert.equal(googleOk[1].user.name, 'Ali Valiyev');
  assert.ok(googleOk[1].clinic.logo.includes('ali@example.com'));
  assert.ok(googleOk[1].clinic.logo.includes('"signup_source":"google"'));
}

{
  const { sb } = fakeDb({ clinics: [{ id: 'grand-dental' }], users: [{ clinic_id: 'grand-dental', username: 'ali.doc' }] });
  const [status, data] = await loginAvailable(sb, { clinic_name: 'Grand Dental', username: 'ali.doc' });
  assert.equal(status, 200);
  assert.equal(data.available, false);
  assert.equal(data.reason, 'username_taken');
  const free = await loginAvailable(sb, { clinic_name: 'Yangi Klinika', username: 'ali.doc' });
  assert.equal(free[1].available, true);
}

console.log('assert-self-serve-signup: OK');
