import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from '@/api/config';
import { ApiError } from '@/api/errors';
import { authStorage } from '@/api/sessionStore';

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!config.supabaseAnonKey) throw new ApiError('missing_config', 0);
  if (!client) {
    client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        storage: authStorage,
        storageKey: 'myclinic-crm-auth',
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}

export async function currentAccessToken(): Promise<string> {
  const { data } = await getSupabase().auth.getSession();
  return data.session?.access_token || '';
}
