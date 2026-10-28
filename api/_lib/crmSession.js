import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

/**
 * Supabase Auth sessiyasini server tomonda yaratadi (asimmetrik ES256 imzo kalitlari bilan ishlaydi:
 * tokenni Supabase o'zi imzolaydi, JWT secret kerak emas).
 * Har bir CRM foydalanuvchisi uchun "soya" auth.users yozuvi: id = CRM user id'dan deterministik UUID,
 * app_metadata = { clinic_id, crm_role, crm_user_id }. app_metadata'ni foydalanuvchi o'zgartira olmaydi.
 * RLS: public.crm_clinic_id() -> auth.jwt()->'app_metadata'->>'clinic_id'.
 */
const EMAIL_DOMAIN = 'auth.myclinic.app';

export function shadowId(key) {
  const h = crypto.createHash('sha256').update(`myclinic-crm:${key}`).digest('hex');
  // UUID v4 ko'rinishidagi deterministik id
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${((parseInt(h[16], 16) & 3) | 8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

function url() {
  return process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
}

/** @returns {Promise<{access_token, refresh_token, expires_at, expires_in, token_type}|null>} */
export async function mintSession(sb, { key, clinicId, role, userId }) {
  const id = shadowId(key);
  const email = `u-${id.replace(/-/g, '').slice(0, 24)}@${EMAIL_DOMAIN}`;
  const app_metadata = { clinic_id: clinicId || null, crm_role: role, crm_user_id: userId || null, provider: 'email', providers: ['email'] };

  const upd = await sb.auth.admin.updateUserById(id, { app_metadata, email, email_confirm: true });
  if (upd.error) {
    const crt = await sb.auth.admin.createUser({ id, email, email_confirm: true, app_metadata, user_metadata: {} });
    if (crt.error) throw new Error(`auth_user: ${crt.error.message}`);
  }
  const link = await sb.auth.admin.generateLink({ type: 'magiclink', email });
  const tokenHash = link.data?.properties?.hashed_token;
  if (link.error || !tokenHash) throw new Error(`auth_link: ${link.error?.message || 'no_token'}`);

  const key2 = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const tmp = createClient(url(), key2, { auth: { persistSession: false, autoRefreshToken: false } });
  const v = await tmp.auth.verifyOtp({ type: 'magiclink', token_hash: tokenHash });
  const s = v.data?.session;
  if (v.error || !s) throw new Error(`auth_verify: ${v.error?.message || 'no_session'}`);
  return { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at, expires_in: s.expires_in, token_type: s.token_type };
}
