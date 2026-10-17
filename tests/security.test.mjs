import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { signRegistrationToken, verifyRegistrationToken, consumeRegistrationToken } from '../api/_lib/regToken.js';
import { rateLimitAllow, memoryHit } from '../api/_lib/http.js';
import { fakeDb } from './fakeDb.mjs';

test('registration token: imzo, clinic_id, muddat, bir martalik', async () => {
  const t = signRegistrationToken('clinic-a');
  assert.ok(verifyRegistrationToken(t, 'clinic-a'));
  assert.equal(verifyRegistrationToken(t, 'clinic-b'), null);
  assert.equal(verifyRegistrationToken(`${t.slice(0, -2)}xx`, 'clinic-a'), null);
  assert.equal(verifyRegistrationToken(t, 'clinic-a', { now: Date.now() + 31 * 60 * 1000 }), null);
  const { sb } = fakeDb({});
  const tok = verifyRegistrationToken(t, 'clinic-a');
  assert.equal(await consumeRegistrationToken(sb, tok), true);
  assert.equal(await consumeRegistrationToken(sb, tok), false);
});

test('rate limit: Supabase RPC va xotira zaxirasi', async () => {
  const { sb } = fakeDb({});
  assert.equal(await rateLimitAllow('k1', 2, { sb }), true);
  assert.equal(await rateLimitAllow('k1', 2, { sb }), true);
  assert.equal(await rateLimitAllow('k1', 2, { sb }), false);
  const broken = { rpc: async () => ({ data: null, error: { message: 'missing fn' } }) };
  assert.equal(await rateLimitAllow('k2', 1, { sb: broken }), true);
  assert.equal(await rateLimitAllow('k2', 1, { sb: broken }), false);
  assert.equal(memoryHit('k3', 1, 0), true); assert.equal(memoryHit('k3', 1, 11 * 60 * 1000), true);
});

test('frontend kodida Telegram bot tokeni va service-role JWT yo\'q', () => {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${d}/${e.name}`) : [`${d}/${e.name}`]));
  for (const f of walk('src')) {
    const s = fs.readFileSync(f, 'utf8');
    assert.ok(!/\d{8,10}:AA[\w-]{30,}/.test(s), `${f}: telegram bot token`);
    for (const m of s.matchAll(/eyJ[\w-]+\.(eyJ[\w-]+)\.[\w-]+/g)) {
      const payload = JSON.parse(Buffer.from(m[1], 'base64url').toString());
      assert.notEqual(payload.role, 'service_role', `${f}: service_role key`);
    }
  }
});
