import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { missingColumnFromError } from '../../src/api/missingColumn.js';
import { readSession } from './crmActor.js';
import { shadowId } from './crmSession.js';

/**
 * POST /api/auth?action=delete-account
 * Deletes the calling CRM login only. Clinic medical and financial rows stay.
 * The last admin/owner keeps the clinic: login is disabled and a support request is stored.
 * Body password is ignored so it is never stored or logged. confirm:true is required.
 */

export const LAST_ADMIN_BLOCKED_MESSAGE =
  "Siz ushbu klinikaning oxirgi administratori yoki egasisiz. Hisobingiz o'chirilmadi, chunki klinika egasiz qolmasligi kerak. Administratorni boshqa xodimga o'tkazish yoki klinikani yopish uchun qo'llab-quvvatlashga yozing: https://t.me/dentist_shaxin. Bemorlar, qabullar va to'lovlar o'chirilmaydi.";

export const DELETION_REQUESTED_MESSAGE =
  "Hisobingizni o'chirish so'rovi qabul qilindi. Kirish yopildi. Klinika ma'lumotlari — bemorlar, qabullar va to'lovlar — saqlanadi. Qo'llab-quvvatlash so'rovni ko'rib chiqadi: https://t.me/dentist_shaxin.";

export const ACCOUNT_REFERENCED_MESSAGE =
  "Hisobingiz hozircha o'chirilmadi: klinikadagi yozuvlar shu xodimga bog'langan. Bemorlar, qabullar va to'lovlar o'zgartirilmadi. Qo'llab-quvvatlashga yozing: https://t.me/dentist_shaxin.";

const ADMIN_ROLES = new Set(['admin', 'owner']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isAdminRole(role) {
  return ADMIN_ROLES.has(String(role || '').toLowerCase());
}

function isMissingRelation(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || '');
  return code === '42P01'
    || code === 'PGRST205'
    || /relation ["']?[\w.]+["']? does not exist/i.test(message)
    || /could not find the table/i.test(message);
}

function isMissingFunction(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || '');
  return code === '42883' || code === 'PGRST202' || /function .* does not exist|could not find the function/i.test(message);
}

export function authIdsForAccount(row, tokenAuthUserId) {
  const ids = [];
  const add = (value) => {
    const id = String(value || '').trim();
    if (!UUID_RE.test(id) || ids.includes(id)) return;
    ids.push(id);
  };
  add(shadowId(`user:${row.id}`));
  add(row.auth_user_id);
  add(row.supabase_user_id);
  add(tokenAuthUserId);
  return ids;
}

function usernameOf(row) {
  const username = String(row?.username || '').trim().slice(0, 80);
  return username || null;
}

async function selectRows(sb, table, columns, filters, { single = false, limit = 2000 } = {}) {
  let cols = [...columns];
  for (let attempt = 0; attempt < 8; attempt += 1) {
    let query = sb.from(table).select(cols.join(','));
    for (const [key, value] of filters) query = query.eq(key, value);
    const result = single ? await query.maybeSingle() : await query.limit(limit);
    if (!result.error) return result;
    const missing = missingColumnFromError(result.error);
    if (!missing || !cols.includes(missing)) return result;
    cols = cols.filter((column) => column !== missing);
  }
  return { data: null, error: { code: 'db_error' } };
}

async function recordEvent(sb, event) {
  try {
    await sb.from('account_deletion_events').insert(event);
  } catch {
    // Audit must not block the deletion the user already confirmed.
  }
}

async function revokeAccess(sb, token, authIds) {
  try {
    if (token && sb.auth?.admin?.signOut) await sb.auth.admin.signOut(token, 'global');
  } catch {
    // deleteUser still removes the auth user and its refresh tokens.
  }
  if (!sb.auth?.admin?.deleteUser) return;
  for (const id of authIds) {
    try {
      await sb.auth.admin.deleteUser(id);
    } catch {
      // Already gone, or this shadow user was never created.
    }
  }
}

function foreignKeyBlock(error) {
  return String(error?.code || '') === '23503' || /foreign key/i.test(String(error?.message || ''));
}

/** Removes the CRM row and its password hash. A foreign-key failure removes neither. */
async function removeLoginRow(sb, userId) {
  if (typeof sb.rpc === 'function') {
    const rpc = await sb.rpc('crm_account_delete_login', { p_user_id: userId });
    if (!rpc?.error) return null;
    if (!isMissingFunction(rpc.error)) {
      if (foreignKeyBlock(rpc.error)) {
        return [409, { ok: false, error: 'account_referenced', message: ACCOUNT_REFERENCED_MESSAGE }];
      }
      if (String(rpc.error.code) === 'P0002') return [401, { ok: false, error: 'unauthorized' }];
      return [500, { ok: false, error: 'db_error' }];
    }
  }
  const removed = await sb.from('users').delete().eq('id', userId);
  if (removed.error) {
    if (foreignKeyBlock(removed.error)) {
      return [409, { ok: false, error: 'account_referenced', message: ACCOUNT_REFERENCED_MESSAGE }];
    }
    return [500, { ok: false, error: 'db_error' }];
  }
  try {
    if (typeof sb.schema === 'function') {
      await sb.schema('crm_private').from('user_passwords').delete().eq('user_id', userId);
    }
  } catch {
    // Used only when the atomic RPC is not installed yet. Login already cannot find this user.
  }
  return null;
}

async function disableLoginFallback(sb, userId) {
  const hash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
  if (typeof sb.schema === 'function') {
    for (const column of ['password_hash', 'password']) {
      const result = await sb.schema('crm_private').from('user_passwords').update({ [column]: hash }).eq('user_id', userId);
      if (!result.error) break;
      if (missingColumnFromError(result.error) === column) continue;
      if (isMissingRelation(result.error)) break;
      return result.error;
    }
  }
  let payload = { password: hash, login_disabled: true };
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const result = await sb.from('users').update(payload).eq('id', userId);
    if (!result.error) return null;
    const missing = missingColumnFromError(result.error);
    if (!missing || missing === 'password' || !Object.prototype.hasOwnProperty.call(payload, missing)) return result.error;
    payload = { ...payload };
    delete payload[missing];
  }
  return { code: 'db_error' };
}

async function disableLogin(sb, userId) {
  if (typeof sb.rpc === 'function') {
    const rpc = await sb.rpc('crm_account_disable_login', { p_user_id: userId });
    if (!rpc?.error) return null;
    if (!isMissingFunction(rpc.error)) return rpc.error;
  }
  return disableLoginFallback(sb, userId);
}

async function requestClinicDeletion(sb, session, row) {
  const existing = await sb.from('clinic_deletion_requests').select('id,status').eq('user_id', row.id).limit(20);
  if (existing.error) {
    if (isMissingRelation(existing.error)) {
      return [409, { ok: false, error: 'last_admin', message: LAST_ADMIN_BLOCKED_MESSAGE }];
    }
    return [500, { ok: false, error: 'db_error' }];
  }
  const pending = (existing.data || []).some((item) => item.status === 'pending');
  if (!pending) {
    const inserted = await sb.from('clinic_deletion_requests').insert({
      id: `cdr-${crypto.randomBytes(8).toString('hex')}`,
      clinic_id: row.clinic_id,
      user_id: row.id,
      username: usernameOf(row),
      role: String(row.role || '').toLowerCase(),
      status: 'pending',
      requested_at: new Date().toISOString(),
    });
    if (inserted.error && String(inserted.error.code) !== '23505') {
      if (isMissingRelation(inserted.error)) {
        return [409, { ok: false, error: 'last_admin', message: LAST_ADMIN_BLOCKED_MESSAGE }];
      }
      return [500, { ok: false, error: 'db_error' }];
    }
  }
  const disabled = await disableLogin(sb, row.id);
  if (disabled) return [500, { ok: false, error: 'db_error' }];
  await revokeAccess(sb, session.token, authIdsForAccount(row, session.authUserId));
  await recordEvent(sb, {
    id: `ade-${crypto.randomBytes(8).toString('hex')}`,
    clinic_id: row.clinic_id,
    user_id: row.id,
    username: usernameOf(row),
    role: String(row.role || '').toLowerCase(),
    action: 'deletion_requested',
    created_at: new Date().toISOString(),
  });
  return [200, { ok: true, deletion_requested: true, message: DELETION_REQUESTED_MESSAGE }];
}

async function deleteLogin(sb, session, row) {
  const blocked = await removeLoginRow(sb, row.id);
  if (blocked) return blocked;
  await revokeAccess(sb, session.token, authIdsForAccount(row, session.authUserId));
  await recordEvent(sb, {
    id: `ade-${crypto.randomBytes(8).toString('hex')}`,
    clinic_id: row.clinic_id,
    user_id: row.id,
    username: usernameOf(row),
    role: String(row.role || '').toLowerCase(),
    action: 'deleted',
    created_at: new Date().toISOString(),
  });
  return [200, { ok: true, deleted: true }];
}

export async function deleteAccount(sb, req, body) {
  const session = await readSession(sb, req);
  if (!session) return [401, { ok: false, error: 'unauthorized' }];
  if (session.platform) return [403, { ok: false, error: 'forbidden' }];
  if (body?.confirm !== true) return [400, { ok: false, error: 'confirm_required' }];

  const loaded = await selectRows(
    sb,
    'users',
    ['id', 'clinic_id', 'username', 'role', 'login_disabled', 'auth_user_id', 'supabase_user_id'],
    [['id', session.userId]],
    { single: true },
  );
  if (loaded.error) return [500, { ok: false, error: 'db_error' }];
  const row = loaded.data;
  if (!row?.id) return [401, { ok: false, error: 'unauthorized' }];
  if (!String(row.clinic_id || '')) return [403, { ok: false, error: 'forbidden' }];

  if (isAdminRole(row.role)) {
    const staff = await selectRows(sb, 'users', ['id', 'role', 'login_disabled'], [['clinic_id', row.clinic_id]]);
    if (staff.error) return [500, { ok: false, error: 'db_error' }];
    const anotherAdmin = (staff.data || []).some((user) => (
      user.id !== row.id && isAdminRole(user.role) && user.login_disabled !== true
    ));
    if (!anotherAdmin) return requestClinicDeletion(sb, session, row);
  }
  return deleteLogin(sb, session, row);
}
