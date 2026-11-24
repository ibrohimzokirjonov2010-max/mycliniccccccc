// node scripts/assert-account-deletion.mjs — account deletion, no network and no database.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { shadowId } from '../api/_lib/crmSession.js';
import { accountLoginBlocked, readSession } from '../api/_lib/crmActor.js';
import {
  ACCOUNT_REFERENCED_MESSAGE,
  DELETION_REQUESTED_MESSAGE,
  LAST_ADMIN_BLOCKED_MESSAGE,
  deleteAccount,
} from '../api/_lib/deleteAccount.js';

const BANNED = new Set([
  'patients', 'appointments', 'payments', 'clinics', 'treatment_plans',
  'implants', 'leads', 'debts', 'expenses', 'notes',
]);

function world(setup = {}) {
  const state = {
    users: (setup.users || []).map((user) => ({ ...user })),
    passwords: { ...(setup.passwords || {}) },
    passwordColumn: setup.passwordColumn || 'password_hash',
    requests: setup.requests === undefined ? [] : setup.requests,
    events: setup.events === undefined ? [] : setup.events,
    missing: new Set(setup.missing || ['auth_user_id', 'supabase_user_id']),
    missingRpc: new Set(setup.missingRpc || []),
    fk: new Set(setup.fk || []),
    insertConflict: Boolean(setup.insertConflict),
    sessions: setup.sessions || {},
    calls: [],
    rpcs: [],
    signOuts: [],
    authDeletes: [],
    trace: [],
  };

  function execute(ctx) {
    state.calls.push({ table: ctx.table, action: ctx.action, payload: ctx.payload, filters: [...ctx.filters] });
    if (BANNED.has(ctx.table)) throw new Error(`clinic data touched: ${ctx.table}`);

    if (ctx.table === 'users') {
      if (ctx.action === 'select') {
        const requested = String(ctx.cols || '').split(',').map((column) => column.trim());
        const missing = requested.find((column) => state.missing.has(column));
        if (missing) {
          return { data: null, error: { code: '42703', message: `column "${missing}" does not exist` } };
        }
        const rows = state.users.filter((user) => ctx.filters.every(([key, value]) => user[key] === value));
        return { data: ctx.single ? (rows[0] || null) : rows, error: null };
      }
      const id = ctx.filters.find(([key]) => key === 'id')?.[1];
      if (ctx.action === 'delete') {
        if (state.fk.has(id)) return { data: null, error: { code: '23503', message: 'fk' } };
        state.trace.push('delete-user');
        state.users = state.users.filter((user) => user.id !== id);
        return { data: null, error: null };
      }
      if (ctx.action === 'update') {
        if (Object.prototype.hasOwnProperty.call(ctx.payload, 'login_disabled') && state.missing.has('login_disabled')) {
          return { data: null, error: { code: 'PGRST204', message: "Could not find the 'login_disabled' column of 'users' in the schema cache" } };
        }
        const user = state.users.find((item) => item.id === id);
        if (user) Object.assign(user, ctx.payload);
        return { data: null, error: null };
      }
    }

    if (ctx.table === 'clinic_deletion_requests') {
      if (state.requests === null) {
        return { data: null, error: { code: '42P01', message: 'relation "public.clinic_deletion_requests" does not exist' } };
      }
      if (ctx.action === 'select') {
        const rows = state.requests.filter((row) => ctx.filters.every(([key, value]) => row[key] === value));
        return { data: rows, error: null };
      }
      if (ctx.action === 'insert') {
        if (state.insertConflict) return { data: null, error: { code: '23505', message: 'duplicate' } };
        state.requests.push({ ...ctx.payload });
        return { data: null, error: null };
      }
    }

    if (ctx.table === 'account_deletion_events') {
      if (state.events === null) {
        return { data: null, error: { code: '42P01', message: 'relation "public.account_deletion_events" does not exist' } };
      }
      if (ctx.action === 'insert') {
        state.events.push({ ...ctx.payload });
        return { data: null, error: null };
      }
    }

    if (ctx.table === 'crm_private.user_passwords') {
      const userId = ctx.filters.find(([key]) => key === 'user_id')?.[1];
      if (ctx.action === 'delete') {
        delete state.passwords[userId];
        return { data: null, error: null };
      }
      if (ctx.action === 'update') {
        const column = Object.keys(ctx.payload)[0];
        if (column !== state.passwordColumn) {
          return { data: null, error: { code: 'PGRST204', message: `Could not find the '${column}' column of 'user_passwords' in the schema cache` } };
        }
        state.passwords[userId] = ctx.payload[column];
        return { data: null, error: null };
      }
    }

    throw new Error(`unexpected ${ctx.action} ${ctx.table}`);
  }

  function builder(table) {
    const ctx = { table, action: 'select', cols: '*', filters: [], payload: null, single: false };
    const api = {
      select(cols) { ctx.action = 'select'; ctx.cols = cols; return api; },
      insert(payload) { ctx.action = 'insert'; ctx.payload = payload; return api; },
      update(payload) { ctx.action = 'update'; ctx.payload = payload; return api; },
      delete() { ctx.action = 'delete'; return api; },
      eq(key, value) { ctx.filters.push([key, value]); return api; },
      limit() { return Promise.resolve(execute(ctx)); },
      maybeSingle() { ctx.single = true; return Promise.resolve(execute(ctx)); },
      then(resolve, reject) { return Promise.resolve(execute(ctx)).then(resolve, reject); },
    };
    return api;
  }

  const sb = {
    from: builder,
    schema(name) {
      return { from(table) { return builder(`${name}.${table}`); } };
    },
    async rpc(name, args) {
      state.rpcs.push({ name, args });
      if (state.missingRpc.has(name)) {
        return { data: null, error: { code: 'PGRST202', message: `Could not find the function public.${name}` } };
      }
      if (name === 'crm_account_delete_login') {
        if (state.fk.has(args.p_user_id)) {
          return { data: null, error: { code: '23503', message: 'foreign key' } };
        }
        state.trace.push('delete-user');
        state.users = state.users.filter((user) => user.id !== args.p_user_id);
        delete state.passwords[args.p_user_id];
        return { data: null, error: null };
      }
      if (name === 'crm_account_disable_login') {
        state.trace.push('disable');
        state.passwords[args.p_user_id] = 'scrambled';
        const user = state.users.find((item) => item.id === args.p_user_id);
        if (user) {
          user.password = 'scrambled';
          user.login_disabled = true;
        }
        return { data: null, error: null };
      }
      return { data: null, error: { code: '42883', message: 'function does not exist' } };
    },
    auth: {
      async getUser(jwt) {
        return state.sessions[jwt] || { data: { user: null }, error: { message: 'invalid' } };
      },
      admin: {
        async signOut(jwt, scope) {
          state.trace.push('signOut');
          state.signOuts.push({ jwt, scope });
          return { data: null, error: null };
        },
        async deleteUser(id) {
          state.trace.push(`deleteAuth:${id}`);
          state.authDeletes.push(id);
          return { data: null, error: null };
        },
      },
    },
  };
  return { sb, state };
}

function sessionFor(user, extra = {}) {
  return {
    data: {
      user: {
        id: extra.authUserId || shadowId(`user:${user.id}`),
        app_metadata: {
          crm_role: extra.jwtRole || user.role,
          crm_user_id: extra.crmUserId === undefined ? user.id : extra.crmUserId,
          clinic_id: user.clinic_id,
        },
        user_metadata: extra.user_metadata || {},
      },
    },
    error: null,
  };
}

function people() {
  return [
    { id: 'user-doc', clinic_id: 'clinic-a', username: 'doc1', role: 'doctor', password: 'hash-doc' },
    { id: 'user-victim', clinic_id: 'clinic-a', username: 'victim', role: 'doctor', password: 'hash-victim' },
    { id: 'user-owner', clinic_id: 'clinic-a', username: 'owner1', role: 'owner', password: 'hash-owner' },
    { id: 'user-admin', clinic_id: 'clinic-a', username: 'admin2', role: 'admin', password: 'hash-admin' },
    { id: 'user-other', clinic_id: 'clinic-b', username: 'adminb', role: 'admin', password: 'hash-b' },
  ];
}

function passwords() {
  return {
    'user-doc': 'hash-doc',
    'user-victim': 'hash-victim',
    'user-owner': 'hash-owner',
    'user-admin': 'hash-admin',
    'user-other': 'hash-b',
  };
}

async function call(sb, token, body) {
  const [status, payload] = await deleteAccount(
    sb,
    { headers: token ? { authorization: `Bearer ${token}` } : {} },
    body,
  );
  return { status, payload };
}

function noSecrets(value) {
  const text = JSON.stringify(value);
  assert.equal(text.includes('super-secret-password'), false);
  assert.equal(text.includes('$2'), false);
  assert.equal(text.includes('hash-doc'), false);
  assert.equal(text.includes('scrambled'), false);
}

assert.equal(accountLoginBlocked({ login_disabled: true }), true);
assert.equal(accountLoginBlocked({ login_disabled: false }), false);
assert.equal(accountLoginBlocked({}), false);

{
  const { sb, state } = world();
  const result = await call(sb, '', { confirm: true });
  assert.equal(result.status, 401);
  assert.deepEqual(result.payload, { ok: false, error: 'unauthorized' });
  assert.equal(state.calls.length, 0);
}

{
  const doc = people()[0];
  const { sb, state } = world({
    users: people(),
    passwords: passwords(),
    sessions: { bad: { data: { user: null }, error: { message: 'invalid' } } },
  });
  const result = await call(sb, 'bad', { confirm: true });
  assert.equal(result.status, 401);
  assert.equal(state.users.length, 5);
  assert.equal(state.rpcs.length, 0);
}

{
  const doc = people()[0];
  const { sb, state } = world({
    users: people(),
    passwords: passwords(),
    sessions: { doc: sessionFor(doc) },
  });
  const missing = await call(sb, 'doc', {});
  assert.equal(missing.status, 400);
  assert.deepEqual(missing.payload, { ok: false, error: 'confirm_required' });
  const text = await call(sb, 'doc', { confirm: 'true' });
  assert.equal(text.status, 400);
  assert.equal(state.users.length, 5);
  assert.equal(state.rpcs.length, 0);
  assert.equal(state.passwords['user-doc'], 'hash-doc');
}

{
  const doc = people()[0];
  const { sb, state } = world({
    users: people(),
    passwords: passwords(),
    sessions: {
      doc: sessionFor(doc, { user_metadata: { crm_user_id: 'user-victim' } }),
    },
  });
  const result = await call(sb, 'doc', { confirm: true, user_id: 'user-victim', password: 'super-secret-password', clinic_id: 'clinic-b' });
  assert.equal(result.status, 200);
  assert.deepEqual(result.payload, { ok: true, deleted: true });
  noSecrets(result.payload);
  noSecrets(state.events);
  noSecrets(state.calls);
  assert.equal(state.users.some((user) => user.id === 'user-doc'), false);
  assert.equal(state.users.some((user) => user.id === 'user-victim'), true);
  assert.equal(state.passwords['user-doc'], undefined);
  assert.equal(state.passwords['user-victim'], 'hash-victim');
  assert.deepEqual(state.rpcs.map((item) => item.name), ['crm_account_delete_login']);
  assert.equal(state.calls.some((item) => item.table === 'users' && item.action === 'delete'), false);
  assert.equal(state.rpcs[0].args.p_user_id, 'user-doc');
  assert.deepEqual(state.signOuts, [{ jwt: 'doc', scope: 'global' }]);
  assert.deepEqual(state.authDeletes, [shadowId('user:user-doc')]);
  assert.ok(state.trace.indexOf('delete-user') < state.trace.indexOf('signOut'));
  assert.ok(state.trace.indexOf('signOut') < state.trace.findIndex((item) => item.startsWith('deleteAuth')));
  assert.equal(state.events[0].action, 'deleted');
  assert.equal(state.events[0].username, 'doc1');
  assert.equal(state.events[0].user_id, 'user-doc');
  assert.equal(Object.prototype.hasOwnProperty.call(state.events[0], 'password'), false);
  assert.equal(state.requests.length, 0);
}

{
  const owner = people()[2];
  const { sb, state } = world({
    users: people(),
    passwords: passwords(),
    sessions: { owner: sessionFor(owner) },
  });
  const result = await call(sb, 'owner', { confirm: true });
  assert.equal(result.status, 200);
  assert.deepEqual(result.payload, { ok: true, deleted: true });
  assert.equal(state.users.some((user) => user.id === 'user-owner'), false);
  assert.equal(state.users.some((user) => user.id === 'user-admin'), true);
  assert.equal(state.passwords['user-admin'], 'hash-admin');
  assert.equal(state.requests.length, 0);
}

{
  const owner = people()[2];
  const users = people().filter((user) => user.id !== 'user-admin');
  const { sb, state } = world({
    users,
    passwords: passwords(),
    sessions: { owner: sessionFor(owner) },
  });
  const result = await call(sb, 'owner', { confirm: true, password: 'super-secret-password' });
  assert.equal(result.status, 200);
  assert.deepEqual(result.payload, { ok: true, deletion_requested: true, message: DELETION_REQUESTED_MESSAGE });
  noSecrets(result.payload);
  assert.equal(state.users.some((user) => user.id === 'user-owner'), true);
  assert.equal(state.users.find((user) => user.id === 'user-owner').login_disabled, true);
  assert.equal(state.passwords['user-owner'], 'scrambled');
  assert.equal(state.passwords['user-other'], 'hash-b');
  assert.equal(state.requests.length, 1);
  assert.equal(state.requests[0].clinic_id, 'clinic-a');
  assert.equal(state.requests[0].user_id, 'user-owner');
  assert.equal(state.requests[0].username, 'owner1');
  assert.equal(state.requests[0].status, 'pending');
  assert.equal(Object.prototype.hasOwnProperty.call(state.requests[0], 'password'), false);
  assert.equal(state.trace.includes('delete-user'), false);
  assert.ok(state.trace.indexOf('disable') < state.trace.indexOf('signOut'));
  assert.deepEqual(state.authDeletes, [shadowId('user:user-owner')]);
  assert.equal(state.events[0].action, 'deletion_requested');
  assert.equal(state.rpcs.some((item) => item.name === 'crm_account_delete_login'), false);
}

{
  const owner = people()[2];
  const { sb, state } = world({
    users: people().filter((user) => user.id !== 'user-admin'),
    passwords: passwords(),
    requests: null,
    sessions: { owner: sessionFor(owner) },
  });
  const result = await call(sb, 'owner', { confirm: true });
  assert.equal(result.status, 409);
  assert.deepEqual(result.payload, { ok: false, error: 'last_admin', message: LAST_ADMIN_BLOCKED_MESSAGE });
  assert.equal(state.users.length, 4);
  assert.equal(state.passwords['user-owner'], 'hash-owner');
  assert.equal(state.rpcs.length, 0);
  assert.equal(state.signOuts.length, 0);
  assert.equal(state.trace.includes('delete-user'), false);
}

{
  const owner = people()[2];
  const disabledAdmin = { ...people()[3], login_disabled: true };
  const { sb, state } = world({
    users: [owner, disabledAdmin],
    passwords: passwords(),
    sessions: { owner: sessionFor(owner) },
  });
  const result = await call(sb, 'owner', { confirm: true });
  assert.equal(result.status, 200);
  assert.equal(result.payload.deletion_requested, true);
  assert.equal(state.users.some((user) => user.id === 'user-admin'), true);
  assert.equal(state.passwords['user-admin'], 'hash-admin');
}

{
  const owner = { ...people()[2], role: 'Admin' };
  const { sb, state } = world({
    users: [owner],
    passwords: { 'user-owner': 'hash-owner' },
    sessions: { owner: sessionFor(owner, { jwtRole: 'admin' }) },
  });
  const result = await call(sb, 'owner', { confirm: true });
  assert.equal(result.status, 200);
  assert.equal(result.payload.deletion_requested, true);
  assert.equal(state.requests[0].role, 'admin');
}

{
  const doc = people()[0];
  const { sb, state } = world({
    users: [doc],
    passwords: { 'user-doc': 'hash-doc' },
    fk: ['user-doc'],
    sessions: { doc: sessionFor(doc) },
  });
  const result = await call(sb, 'doc', { confirm: true });
  assert.equal(result.status, 409);
  assert.deepEqual(result.payload, { ok: false, error: 'account_referenced', message: ACCOUNT_REFERENCED_MESSAGE });
  assert.equal(state.users.length, 1);
  assert.equal(state.passwords['user-doc'], 'hash-doc');
  assert.deepEqual(state.rpcs.map((item) => item.name), ['crm_account_delete_login']);
  assert.equal(state.trace.includes('delete-user'), false);
  assert.equal(state.signOuts.length, 0);
}

{
  const doc = { ...people()[0], auth_user_id: '22222222-2222-4222-8222-222222222222' };
  const { sb, state } = world({
    users: [doc],
    passwords: { 'user-doc': 'hash-doc' },
    missing: new Set(['supabase_user_id']),
    sessions: { doc: sessionFor(doc, { authUserId: '33333333-3333-4333-8333-333333333333' }) },
  });
  const result = await call(sb, 'doc', { confirm: true });
  assert.equal(result.status, 200);
  assert.deepEqual(state.authDeletes.slice().sort(), [
    '22222222-2222-4222-8222-222222222222',
    '33333333-3333-4333-8333-333333333333',
    shadowId('user:user-doc'),
  ].sort());
}

{
  const owner = people()[2];
  const { sb, state } = world({
    users: [owner],
    passwords: { 'user-owner': 'hash-owner' },
    requests: [{ id: 'cdr-existing', user_id: 'user-owner', status: 'pending', clinic_id: 'clinic-a' }],
    sessions: { owner: sessionFor(owner) },
  });
  const result = await call(sb, 'owner', { confirm: true });
  assert.equal(result.status, 200);
  assert.equal(state.requests.length, 1);
  assert.equal(state.requests[0].id, 'cdr-existing');
  assert.equal(state.passwords['user-owner'], 'scrambled');
}

{
  const owner = people()[2];
  const { sb, state } = world({
    users: [owner],
    passwords: { 'user-owner': 'hash-owner' },
    insertConflict: true,
    sessions: { owner: sessionFor(owner) },
  });
  const result = await call(sb, 'owner', { confirm: true });
  assert.equal(result.status, 200);
  assert.equal(result.payload.deletion_requested, true);
  assert.equal(state.users[0].login_disabled, true);
}

{
  const doc = people()[0];
  const { sb, state } = world({
    users: [doc],
    passwords: { 'user-doc': 'hash-doc' },
    events: null,
    sessions: { doc: sessionFor(doc) },
  });
  const result = await call(sb, 'doc', { confirm: true });
  assert.equal(result.status, 200);
  assert.equal(state.users.length, 0);
  assert.equal(state.events, null);
}

{
  const owner = people()[2];
  const { sb, state } = world({
    users: [owner],
    passwords: { 'user-owner': 'hash-owner' },
    missingRpc: new Set(['crm_account_disable_login']),
    sessions: { owner: sessionFor(owner) },
  });
  const result = await call(sb, 'owner', { confirm: true });
  assert.equal(result.status, 200);
  assert.equal(result.payload.deletion_requested, true);
  assert.equal(state.users[0].login_disabled, true);
  assert.match(state.passwords['user-owner'], /^\$2[aby]\$/);
  noSecrets(result.payload);
  assert.equal(JSON.stringify(state.events).includes('$2'), false);
}

{
  const { sb, state } = world({
    users: [{ id: 'user-empty', clinic_id: '', username: 'e', role: 'doctor' }],
    sessions: { empty: sessionFor({ id: 'user-empty', clinic_id: '', role: 'doctor' }) },
  });
  const result = await call(sb, 'empty', { confirm: true });
  assert.equal(result.status, 403);
  assert.deepEqual(result.payload, { ok: false, error: 'forbidden' });
  assert.equal(state.users.length, 1);
  assert.equal(state.rpcs.length, 0);
}

{
  const { sb, state } = world({
    sessions: {
      plat: { data: { user: { id: '44444444-4444-4444-8444-444444444444', app_metadata: { crm_role: 'superadmin' } } }, error: null },
    },
  });
  const result = await call(sb, 'plat', { confirm: true });
  assert.equal(result.status, 403);
  assert.equal(state.authDeletes.length, 0);
  assert.equal(state.rpcs.length, 0);
}

{
  const doc = people()[0];
  const { sb } = world({
    users: [{ ...doc, login_disabled: true }],
    sessions: { doc: sessionFor(doc) },
  });
  assert.equal(await readSession(sb, { headers: { authorization: 'Bearer doc' } }), null);
  const result = await call(sb, 'doc', { confirm: true });
  assert.equal(result.status, 401);
}

{
  const doc = people()[0];
  const { sb } = world({
    users: [doc],
    missing: new Set(['login_disabled', 'auth_user_id', 'supabase_user_id']),
    sessions: { doc: sessionFor(doc) },
  });
  const session = await readSession(sb, { headers: { Authorization: 'Bearer doc' } });
  assert.equal(session.userId, 'user-doc');
  assert.equal(session.platform, false);
}

{
  const { sb } = world({
    sessions: {
      anon: {
        data: {
          user: {
            id: '55555555-5555-4555-8555-555555555555',
            app_metadata: {},
            user_metadata: { crm_user_id: 'user-victim', crm_role: 'admin' },
          },
        },
        error: null,
      },
    },
  });
  assert.equal(await readSession(sb, { headers: { authorization: 'Bearer anon' } }), null);
}

{
  const doc = people()[0];
  const { sb, state } = world({
    users: [doc, people()[1]],
    passwords: { 'user-doc': 'hash-doc', 'user-victim': 'hash-victim' },
    missingRpc: new Set(['crm_account_delete_login']),
    sessions: { doc: sessionFor(doc) },
  });
  const result = await call(sb, 'doc', { confirm: true });
  assert.equal(result.status, 200);
  assert.equal(state.users.some((user) => user.id === 'user-doc'), false);
  assert.equal(state.users.some((user) => user.id === 'user-victim'), true);
  assert.equal(state.passwords['user-doc'], undefined);
  assert.equal(state.passwords['user-victim'], 'hash-victim');
  assert.equal(state.calls.some((item) => item.table === 'users' && item.action === 'delete'), true);
  assert.equal(state.calls.some((item) => item.table === 'crm_private.user_passwords' && item.action === 'delete'), true);
}

const migration = fs.readFileSync('supabase/migrations/20261124180000_account_deletion.sql', 'utf8');
const rollback = fs.readFileSync('supabase/rollbacks/20261124180000_account_deletion_rollback.sql', 'utf8');
assert.match(migration, /login_disabled/);
assert.match(migration, /clinic_deletion_requests/);
assert.match(migration, /account_deletion_events/);
assert.match(migration, /crm_private\.account_delete_login/);
assert.match(migration, /DELETE FROM public\.users WHERE id = p_user_id/);
assert.match(migration, /DELETE FROM crm_private\.user_passwords WHERE user_id = p_user_id/);
assert.match(migration, /SECURITY INVOKER/);
assert.match(migration, /REVOKE ALL ON FUNCTION/);
assert.match(migration, /ON DELETE SET NULL/);
assert.doesNotMatch(migration, /DELETE\s+FROM\s+(public\.)?(patients|appointments|payments|clinics)\b/i);
assert.match(rollback, /DROP FUNCTION IF EXISTS public\.crm_account_delete_login\(text\)/);
assert.match(rollback, /DROP FUNCTION IF EXISTS crm_private\.account_delete_login\(text\)/);
assert.match(rollback, /DROP COLUMN IF EXISTS login_disabled/);
assert.match(rollback, /DROP TABLE IF EXISTS public\.clinic_deletion_requests/);
assert.doesNotMatch(rollback, /DELETE\s+FROM\s+(public\.)?(patients|appointments|payments)\b/i);

const auth = fs.readFileSync('api/auth.js', 'utf8');
assert.match(auth, /action === 'delete-account'/);
assert.match(auth, /accountLoginBlocked\(user\)/);
assert.match(auth, /'delete-account': 5/);
assert.match(auth, /readSession\(sb, req\)/);

delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.SUPABASE_URL;
delete process.env.VITE_SUPABASE_URL;
const { default: handler } = await import('../api/auth.js');

function mockRes() {
  return {
    headers: {},
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
  };
}
function postReq(ip = '203.0.113.9') {
  return {
    method: 'POST',
    query: { action: 'delete-account' },
    headers: { host: 'app.test' },
    url: '/api/auth?action=delete-account',
    socket: { remoteAddress: ip },
  };
}

{
  const res = mockRes();
  await handler({ ...postReq(), method: 'GET' }, res);
  assert.equal(res.code, 405);
  assert.equal(res.body.error, 'method_not_allowed');
}
for (let i = 0; i < 5; i += 1) {
  const res = mockRes();
  await handler(postReq(), res);
  assert.equal(res.code, 503);
  assert.equal(res.body.error, 'server_not_configured');
}
{
  const res = mockRes();
  await handler(postReq(), res);
  assert.equal(res.code, 429);
  assert.equal(res.body.error, 'too_many_requests');
}

console.log('account deletion: ok');
