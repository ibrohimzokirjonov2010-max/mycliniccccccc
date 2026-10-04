// node scripts/assert-card-binding.mjs — karta biriktirish serveri uchun tezkor tekshiruvlar (tarmoqsiz).
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { authHeader, clickConfig, payWithToken, requestCardToken, verifyCardToken } from '../api/_lib/click.js';
import { decodeExt, encodeExt } from '../api/_lib/clinicExt.js';
import { parseCard } from '../api/_lib/card.js';
import { addMonths } from '../api/_lib/dates.js';
import { PLAN_PRICES_UZS, planPrice } from '../api/_lib/plans.js';
import { signProof, verifyProof } from '../api/_lib/proof.js';
import { LANDING_TARIFFS, LEGACY_FEES } from '../src/utils/superAdminBilling.js';
import requestHandler from '../api/card/request.js';
import verifyHandler from '../api/card/verify.js';
import attachHandler from '../api/card/attach.js';
import statusHandler from '../api/card/status.js';
import cronHandler from '../api/cron/charge-trials.js';

for (const k of ['CLICK_SERVICE_ID', 'CLICK_MERCHANT_USER_ID', 'CLICK_SECRET_KEY', 'CRON_SECRET']) delete process.env[k];

// 1) Narxlar ilovadagi katalog bilan bir xil
assert.deepEqual(PLAN_PRICES_UZS, LEGACY_FEES);
for (const t of LANDING_TARIFFS.filter((x) => x.id !== 'trial')) assert.equal(planPrice(t.id), t.priceUzs);

// 2) Click imzosi: sha1(timestamp + secret_key), "merchant_user_id:digest:timestamp"
const auth = authHeader({ merchantUserId: '77', secretKey: 'S3CRET' }, 1519051543000);
assert.equal(auth, `77:${crypto.createHash('sha1').update('1519051543S3CRET').digest('hex')}:1519051543`);

// 3) Click so'rov shakllari (hujjat bo'yicha): request — Auth'siz; verify/payment — Auth bilan
const calls = [];
const fake = async (url, init) => { calls.push({ url, init }); return { status: 200, json: async () => ({ error_code: 0, card_token: 'T', card_number: '8600 55** **** 3244', payment_id: 1, payment_status: 1 }) }; };
const cfg = { serviceId: 12345, merchantUserId: '77', secretKey: 'S3CRET' };
await requestCardToken({ cardNumber: '8600123412341234', expireDate: '0526' }, cfg, { fetchImpl: fake });
await verifyCardToken({ cardToken: 'T', smsCode: '123456' }, cfg, { fetchImpl: fake });
await payWithToken({ cardToken: 'T', amount: 99000, transactionParameter: 'tx1' }, cfg, { fetchImpl: fake });
assert.equal(calls[0].url, 'https://api.click.uz/v2/merchant/card_token/request');
assert.equal(calls[0].init.headers.Auth, undefined);
assert.deepEqual(JSON.parse(calls[0].init.body), { service_id: 12345, card_number: '8600123412341234', expire_date: '0526', temporary: 0 });
assert.equal(calls[1].url, 'https://api.click.uz/v2/merchant/card_token/verify');
assert.match(calls[1].init.headers.Auth, /^77:[0-9a-f]{40}:\d{10}$/);
assert.deepEqual(JSON.parse(calls[1].init.body), { service_id: 12345, card_token: 'T', sms_code: 123456 });
assert.equal(calls[2].url, 'https://api.click.uz/v2/merchant/card_token/payment');
assert.deepEqual(JSON.parse(calls[2].init.body), { service_id: 12345, card_token: 'T', amount: 99000, transaction_parameter: 'tx1' });
assert.equal(clickConfig({}).configured, false);
assert.equal(clickConfig({ CLICK_SERVICE_ID: '1', CLICK_MERCHANT_USER_ID: '2', CLICK_SECRET_KEY: 'x' }).configured, true);

// 4) Proof: imzo, buzilish, muddat
const proof = signProof({ ct: 'TOK', mp: '8600 **** **** 1234', ex: '05/26' });
assert.equal(verifyProof(proof).ct, 'TOK');
assert.equal(verifyProof(proof.slice(0, -2) + 'xx'), null);
assert.equal(verifyProof(`${Buffer.from('{"ct":"EVIL","exp":9999999999}').toString('base64url')}.${proof.split('.')[1]}`), null);
assert.equal(verifyProof(proof, Date.now() + 31 * 60 * 1000), null);

// 5) clinics.logo [EXT] formati (base44Client._encodeClinicNotes bilan mos)
const enc = encodeExt({ subscription_status: 'trialing', trial_ends_at: '2026-10-18', tariff: 'pro', empty: '' }, 'LOGO64');
assert.ok(enc.startsWith('[EXT]{') && enc.endsWith('[/EXT]LOGO64'));
assert.deepEqual(decodeExt(enc), { ext: { subscription_status: 'trialing', trial_ends_at: '2026-10-18', tariff: 'pro' }, rawLogo: 'LOGO64' });
assert.equal(encodeExt({}, 'x'), 'x');

// 6) Sana va karta tekshiruvi
assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
assert.equal(addMonths('2026-10-18', 1), '2026-11-18');
assert.deepEqual(parseCard({ card_number: '8600 1234 1234 1234', expire_date: '05/26' }), { cardNumber: '8600123412341234', expireDate: '0526' });
assert.equal(parseCard({ card_number: '8600', expire_date: '0526' }).error, 'invalid_card_number');
assert.equal(parseCard({ card_number: '8600123412341234', expire_date: '1326' }).error, 'invalid_expiry');

// 7) Handlerlar (Click kalitlarisiz = TEST REJIM, tarmoq yo'q)
function mock(method, body, headers = {}) {
  const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
  return { req: { method, body, headers: { host: 'x.test', ...headers }, url: '/t', socket: { remoteAddress: '1.1.1.1' } }, res };
}
{
  const { req, res } = mock('GET'); statusHandler(req, res);
  assert.equal(res.body.mode, 'mock'); assert.equal(res.headers['Cache-Control'], 'no-store');
}
let token;
{
  const { req, res } = mock('POST', { card_number: '8600123412341234', expire_date: '0526' });
  await requestHandler(req, res);
  assert.equal(res.code, 200); assert.equal(res.body.mode, 'mock'); assert.match(res.body.card_token, /^MOCK-/);
  assert.ok(!JSON.stringify(res.body).includes('8600123412341234'));
  token = res.body.card_token;
}
{ const { req, res } = mock('POST', { card_number: '123', expire_date: '0526' }); await requestHandler(req, res); assert.equal(res.code, 400); }
{ const { req, res } = mock('POST', { card_token: token, sms_code: '000000', expire_date: '0526' }); await verifyHandler(req, res); assert.equal(res.code, 400); }
let issued;
{
  const { req, res } = mock('POST', { card_token: token, sms_code: '123456', expire_date: '0526' });
  await verifyHandler(req, res);
  assert.equal(res.code, 200); assert.ok(res.body.proof); issued = res.body.proof;
}
{ const { req, res } = mock('POST', { clinic_id: 'c1', proof: issued, consent: false, consent_version: 'v1' }); await attachHandler(req, res); assert.equal(res.body.error, 'consent_required'); }
{ const { req, res } = mock('POST', { clinic_id: 'c1', proof: 'bad.proof', consent: true, consent_version: 'v1' }); await attachHandler(req, res); assert.equal(res.body.error, 'invalid_or_expired_proof'); }
{ const { req, res } = mock('POST', { clinic_id: 'c1', proof: issued, consent: true, consent_version: 'v1' }); await attachHandler(req, res); assert.equal(res.code, 200); assert.equal(res.body.stored, false); }
{ const { req, res } = mock('POST', { card_number: '8600123412341234', expire_date: '0526' }, { origin: 'https://evil.test' }); await requestHandler(req, res); assert.equal(res.code, 403); }
{ const { req, res } = mock('GET', null); await cronHandler(req, res); assert.equal(res.code, 401); }

// 8) Karta ma'lumoti log/saqlashga tushmaydi (api/ va client kodida console/storage yo'q)
function walk(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(`${dir}/${d.name}`) : [`${dir}/${d.name}`])); }
for (const f of [...walk('api'), 'src/api/cardBindingClient.js', 'src/components/register/CardBindingStep.jsx']) {
  const src = fs.readFileSync(f, 'utf8');
  assert.ok(!/console\.(log|info|debug|warn|error)/.test(src), `${f}: console.* ishlatilgan`);
  assert.ok(!/(localStorage|sessionStorage|indexedDB)/.test(src), `${f}: brauzer saqlash ishlatilgan`);
}
assert.ok(!/CLICK_SECRET_KEY|SERVICE_ROLE/.test(fs.readFileSync('src/api/cardBindingClient.js', 'utf8')));
console.log('assert-card-binding: OK');
