import { bodyOf, guard, send } from '../_lib/http.js';
import { signRegistrationToken } from '../_lib/regToken.js';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';

/**
 * POST /api/register/token { clinic_id }
 * Ro'yxatdan o'tishning karta qadamiga o'tishdan oldin chaqiriladi: klinika ID hali band bo'lmasa,
 * shu ID ga bog'langan bir martalik, qisqa muddatli token qaytaradi. /api/card/attach uni talab qiladi.
 */
export default async function handler(req, res) {
  if (!(await guard(req, res, { limit: 10 }))) return;
  const clinicId = String(bodyOf(req).clinic_id || '').trim().toLowerCase();
  if (!/^[a-z0-9._-]{2,60}$/.test(clinicId)) return send(res, 400, { ok: false, error: 'invalid_clinic' });

  const sb = supabaseAdmin();
  if (sb) {
    try {
      const { data, error } = await sb.from('clinics').select('id').eq('id', clinicId).maybeSingle();
      if (error) return send(res, 500, { ok: false, error: 'db_error' });
      if (data) return send(res, 409, { ok: false, error: 'clinic_exists' });
    } catch {
      return send(res, 500, { ok: false, error: 'server_error' });
    }
  }
  return send(res, 200, { ok: true, mode: sb ? 'live' : 'mock', registration_token: signRegistrationToken(clinicId) });
}
