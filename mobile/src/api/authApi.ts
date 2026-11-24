import { config } from '@/api/config';
import { ApiError } from '@/api/errors';

type AuthResult = { status: number; data: Record<string, unknown> | null };

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Single door to /api/auth. Screens must not call fetch themselves.
 * The production API rejects browser calls whose Origin host differs from the API host.
 * Native iOS/Android requests do not send Origin, which is the supported client.
 */
export async function authRequest(
  action: string,
  options: { method?: 'GET' | 'POST'; body?: unknown; token?: string } = {},
): Promise<AuthResult> {
  const url = `${config.apiBaseUrl}/api/auth?action=${encodeURIComponent(action)}`;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method || 'POST',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError('network', 0);
  }
  const parsed: unknown = await response.json().catch(() => null);
  return { status: response.status, data: isRecord(parsed) ? parsed : null };
}

export function errorCode(status: number, data: Record<string, unknown> | null): string {
  const code = typeof data?.error === 'string' ? data.error : '';
  if (status === 401) return 'invalid_credentials';
  if (status === 402 || code === 'subscription_expired') return 'subscription_expired';
  if (status === 403 && code === 'clinic_inactive') return 'clinic_inactive';
  if (status === 404 && code === 'clinic_not_found') return 'clinic_not_found';
  if (status === 0) return 'network';
  if (code) return code;
  return 'generic';
}
