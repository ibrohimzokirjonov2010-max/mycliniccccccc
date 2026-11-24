import { ApiError } from '@/api/errors';

/**
 * Isolated backend configuration.
 * Auth and data calls go through src/api/* so web/API changes (login payload, session shape)
 * can be adapted here without rewriting screens.
 * The service-role key must never be placed in this app. Only the publishable anon key is read.
 */

const productionApi = 'https://app-shahobidin-4.vercel.app';

function env(name: string): string {
  const value = process.env[name];
  return typeof value === 'string' ? value.trim() : '';
}

export const config = {
  apiBaseUrl: (env('EXPO_PUBLIC_API_BASE_URL') || productionApi).replace(/\/$/, ''),
  supabaseUrl: env('EXPO_PUBLIC_SUPABASE_URL') || 'https://zvyggjldzkxwufpnaatr.supabase.co',
  supabaseAnonKey: env('EXPO_PUBLIC_SUPABASE_ANON_KEY'),
  privacyPolicyUrl: env('EXPO_PUBLIC_PRIVACY_POLICY_URL') || `${productionApi}/maxfiylik`,
  supportUrl: env('EXPO_PUBLIC_SUPPORT_URL') || 'https://t.me/dentist_shaxin',
};

export function assertConfigured(): void {
  if (!config.supabaseAnonKey) throw new ApiError('missing_config', 0);
}
