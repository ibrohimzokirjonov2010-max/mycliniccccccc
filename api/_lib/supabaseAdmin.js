import { createClient } from '@supabase/supabase-js';

/** Service-role klient: FAQAT server tomonda. SUPABASE_SERVICE_ROLE_KEY hech qachon VITE_ prefiksi bilan berilmaydi. */
export function supabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
