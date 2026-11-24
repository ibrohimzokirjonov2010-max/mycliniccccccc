import { missingColumnFromError } from '../../src/api/missingColumn.js';

/** True when this CRM login has been disabled and must not receive a new session. */
export function accountLoginBlocked(user) {
  return user?.login_disabled === true;
}

function bearer(req) {
  const headers = req?.headers || {};
  const raw = headers.authorization || headers.Authorization || '';
  const match = /^Bearer\s+(\S+)/i.exec(String(raw));
  return match ? match[1] : '';
}

async function loadActorRow(sb, userId) {
  const first = await sb.from('users').select('id,clinic_id,role,notes,login_disabled').eq('id', userId).maybeSingle();
  if (!first.error) return first.data;
  const missing = missingColumnFromError(first.error);
  const message = String(first.error?.message || '');
  if (missing === 'login_disabled' || message.includes('login_disabled')) {
    const second = await sb.from('users').select('id,clinic_id,role,notes').eq('id', userId).maybeSingle();
    if (!second.error) return second.data;
  }
  return null;
}

/**
 * Same bearer check as the other /api/auth actions.
 * crm_user_id is read from app_metadata only (not user-editable user_metadata).
 * Returns null when the token is missing, rejected, or the CRM user is gone / login_disabled.
 */
export async function readSession(sb, req) {
  const token = bearer(req);
  if (!token || !sb?.auth?.getUser) return null;
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data?.user) return null;
  const meta = data.user.app_metadata || {};
  const jwtRole = String(meta.crm_role || '').toLowerCase();
  const userId = String(meta.crm_user_id || '');
  const authUserId = String(data.user.id || '');
  if (jwtRole === 'superadmin') {
    return {
      token,
      authUserId,
      userId: userId || 'superadmin',
      clinicId: meta.clinic_id ? String(meta.clinic_id) : '',
      role: 'superadmin',
      admin: true,
      platform: true,
      notes: '',
    };
  }
  if (!userId) return null;
  const row = await loadActorRow(sb, userId);
  if (!row || accountLoginBlocked(row)) return null;
  const role = String(row.role || '').toLowerCase();
  return {
    token,
    authUserId,
    userId: String(row.id),
    clinicId: String(row.clinic_id || ''),
    role,
    admin: role === 'admin' || role === 'owner',
    platform: false,
    notes: row.notes || '',
  };
}
