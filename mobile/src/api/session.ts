import { isExpired } from '@/lib/dates';
import { authRequest, errorCode, serverMessage } from '@/api/authApi';
import { ApiError } from '@/api/errors';
import { assertConfigured } from '@/api/config';
import { secureGet, secureRemove, secureSet, setEphemeralSession } from '@/api/sessionStore';
import { currentAccessToken, getSupabase } from '@/api/supabase';
import type { AuthSnapshot, CrmClinic, CrmUser } from '@/api/types';

const PROFILE_KEY = 'myclinic.profile';
const DELETE_KEY = 'myclinic.deletion-request';

export type LoginInput = {
  clinicId: string;
  username: string;
  password: string;
  remember: boolean;
};

function text(value: unknown, max = 200): string {
  return String(value ?? '').trim().slice(0, max);
}

function tokenOf(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asUser(value: unknown): CrmUser {
  const row = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const user: CrmUser = {
    id: text(row.id, 80),
    username: text(row.username, 80),
    name: text(row.name || row.full_name, 120),
    full_name: text(row.full_name || row.name, 120),
    role: text(row.role || 'staff', 40).toLowerCase(),
    clinic_id: text(row.clinic_id, 80),
    phone: text(row.phone, 40) || null,
    specialty: text(row.specialty, 80) || null,
  };
  if (!user.id || !user.clinic_id) throw new ApiError('generic', 500);
  return user;
}

function asClinic(value: unknown, fallbackId: string): CrmClinic {
  const row = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    id: text(row.id, 80) || fallbackId,
    name: text(row.name, 160) || fallbackId,
    status: text(row.status, 40) || null,
    plan: text(row.plan, 40) || null,
    expires_at: text(row.expires_at, 40) || null,
  };
}

export async function readSnapshot(): Promise<AuthSnapshot | null> {
  const raw = await secureGet(PROFILE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AuthSnapshot;
    if (!parsed?.user?.id || !parsed?.clinic?.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeSnapshot(snapshot: AuthSnapshot): Promise<void> {
  await secureSet(PROFILE_KEY, JSON.stringify(snapshot));
}

export async function logout(): Promise<void> {
  try {
    await getSupabase().auth.signOut({ scope: 'local' });
  } catch {
    /* session may already be gone */
  }
  await secureRemove('myclinic-crm-auth');
  await secureRemove(PROFILE_KEY);
  setEphemeralSession(false);
}

export async function restoreSession(): Promise<AuthSnapshot | null> {
  try {
    assertConfigured();
    const [{ data }, snapshot] = await Promise.all([getSupabase().auth.getSession(), readSnapshot()]);
    if (!data.session || !snapshot) {
      if (data.session) await logout();
      return null;
    }
    if (isExpired(snapshot.clinic.expires_at)) {
      await logout();
      throw new ApiError('subscription_expired', 402);
    }
    return snapshot;
  } catch (error) {
    if (error instanceof ApiError && error.code === 'subscription_expired') throw error;
    return null;
  }
}

export async function login(input: LoginInput): Promise<AuthSnapshot> {
  assertConfigured();
  const clinicId = input.clinicId.trim();
  const username = input.username.trim();
  const password = input.password;
  if (!clinicId || !username || !password) throw new ApiError('missing_fields', 400);

  const result = await authRequest('login', { body: { clinic_id: clinicId, username, password } });
  if (result.status !== 200 || result.data?.ok !== true) {
    throw new ApiError(errorCode(result.status, result.data), result.status);
  }
  const session = result.data.session;
  const sessionRow = session && typeof session === 'object' ? (session as Record<string, unknown>) : {};
  const access = tokenOf(sessionRow.access_token);
  const refresh = tokenOf(sessionRow.refresh_token);
  if (!access || !refresh) throw new ApiError('session', 500);

  if (input.remember) {
    setEphemeralSession(false);
  } else {
    await secureRemove('myclinic-crm-auth');
    await secureRemove(PROFILE_KEY);
    setEphemeralSession(true);
  }

  const applied = await getSupabase().auth.setSession({ access_token: access, refresh_token: refresh });
  if (applied.error) throw new ApiError('session', 500);

  const user = asUser(result.data.user);
  const clinic = asClinic(result.data.clinic, user.clinic_id);
  if (clinic.status && clinic.status !== 'Active') throw new ApiError('clinic_inactive', 403);
  if (isExpired(clinic.expires_at)) throw new ApiError('subscription_expired', 402);
  const snapshot = { user, clinic };
  await writeSnapshot(snapshot);
  return snapshot;
}

export async function changePassword(userId: string, password: string): Promise<void> {
  const token = await currentAccessToken();
  if (!token) throw new ApiError('unauthorized', 401);
  const result = await authRequest('change-password', { body: { user_id: userId, password }, token });
  if (result.status !== 200 || result.data?.ok !== true) {
    throw new ApiError(errorCode(result.status, result.data), result.status);
  }
}

export type DeletionOutcome = 'deleted' | 'requested' | 'fallback' | 'blocked';

export type DeletionResult = {
  outcome: DeletionOutcome;
  code: string;
  message?: string;
};

/**
 * POST /api/auth?action=delete-account
 * Authorization: Bearer <login session.access_token>
 * Body: {"confirm": true}  — JSON boolean, no password.
 * 404, or 400 bad_request before that action is deployed, keeps the support request flow.
 */
export async function requestAccountDeletion(): Promise<DeletionResult> {
  const token = await currentAccessToken();
  if (!token) throw new ApiError('unauthorized', 401);
  const result = await authRequest('delete-account', { body: { confirm: true }, token });
  const data = result.data;
  const message = serverMessage(data);
  const error = typeof data?.error === 'string' ? data.error : '';

  if (result.status === 200 && data?.ok === true && data.deleted === true) {
    return { outcome: 'deleted', code: 'deleted' };
  }
  if (result.status === 200 && data?.ok === true && data.deletion_requested === true) {
    return { outcome: 'requested', code: 'deletion_requested', message };
  }
  if (result.status === 404 || (result.status === 400 && (error === 'bad_request' || error === 'unknown_action'))) {
    const requestedAt = new Date().toISOString();
    await secureSet(DELETE_KEY, JSON.stringify({ requestedAt, code: 'pending', deleted: false }));
    return { outcome: 'fallback', code: 'pending' };
  }
  if (result.status === 409 && (error === 'last_admin' || error === 'account_referenced')) {
    return { outcome: 'blocked', code: error, message };
  }

  throw new ApiError(error || errorCode(result.status, data), result.status, message);
}

export async function readDeletionRequest(): Promise<{ requestedAt: string; code: string } | null> {
  const raw = await secureGet(DELETE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { requestedAt?: string; code?: string };
    if (!parsed.requestedAt) return null;
    return { requestedAt: parsed.requestedAt, code: parsed.code || 'requested' };
  } catch {
    return null;
  }
}
