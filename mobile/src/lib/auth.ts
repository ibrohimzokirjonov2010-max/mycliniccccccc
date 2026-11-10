import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { verifyPassword } from '@/lib/password';
import type { Session, SessionClinic, SessionUser } from '@/lib/types';

type LoginResult = { success: true; session: Session } | { success: false; error: string };

type UserRow = {
  id?: string;
  username?: string | null;
  password?: string | null;
  name?: string | null;
  full_name?: string | null;
  role?: string | null;
  clinic_id?: string | null;
  notes?: string | null;
};

type ClinicRow = {
  id?: string;
  name?: string | null;
  status?: string | null;
  expires_at?: string | null;
  plan?: string | null;
};

function normalizeId(id: string | null | undefined): string {
  return (id || '').toLowerCase().trim().replace(/-/g, '_');
}

function decodeTechNotes(record: UserRow): UserRow {
  const notes = record.notes || '';
  if (!notes.startsWith('[TECH_DATA]')) return record;
  const endIdx = notes.indexOf('[END_TECH]');
  if (endIdx === -1) return record;
  try {
    const techData = JSON.parse(notes.substring('[TECH_DATA]'.length, endIdx)) as Record<string, unknown>;
    const userNotes = notes.substring(endIdx + '[END_TECH]'.length).replace(/^\n/, '');
    const merged: UserRow = { ...record, notes: userNotes };
    for (const [key, value] of Object.entries(techData)) {
      const current = merged[key as keyof UserRow];
      if (current == null || current === '') {
        (merged as Record<string, unknown>)[key] = value;
      }
    }
    return merged;
  } catch {
    return record;
  }
}

/**
 * Web login (`base44.auth.login`) uses the custom `users` table, not Supabase Auth:
 * clinic id + username + password, then an active, unexpired clinic.
 */
export async function loginWithClinic(clinicId: string, username: string, password: string): Promise<LoginResult> {
  const wantedClinic = clinicId.trim();
  const wantedUsername = username.toLowerCase().trim();

  if (!wantedClinic || !wantedUsername || !password) {
    return { success: false, error: "Iltimos, barcha maydonlarni to'ldiring" };
  }

  if (!isSupabaseConfigured) {
    return {
      success: false,
      error: "Supabase sozlamalari topilmadi. mobile/.env faylini to'ldiring.",
    };
  }

  let users: UserRow[] = [];
  const filtered = await supabase.from('users').select('*').ilike('username', wantedUsername);
  if (!filtered.error && filtered.data) {
    users = filtered.data as UserRow[];
  } else {
    const fallback = await supabase.from('users').select('*');
    if (fallback.error || !fallback.data) {
      return { success: false, error: "Server bilan aloqa uzildi" };
    }
    users = fallback.data as UserRow[];
  }

  users = users.map(decodeTechNotes);

  let matched: UserRow | null = null;
  for (const row of users) {
    if (!row?.clinic_id || !row.username) continue;
    const clinicMatch = normalizeId(row.clinic_id) === normalizeId(wantedClinic);
    const usernameMatch = row.username.toLowerCase().trim() === wantedUsername;
    if (!clinicMatch || !usernameMatch) continue;
    if (await verifyPassword(password, row.password)) {
      matched = row;
      break;
    }
  }

  if (!matched?.id) {
    return { success: false, error: "Klinika ID, login yoki parol noto'g'ri" };
  }

  const clinicsResult = await supabase.from('clinics').select('id,name,status,expires_at,plan');
  if (clinicsResult.error || !clinicsResult.data) {
    return { success: false, error: "Server bilan aloqa uzildi" };
  }

  const clinic = (clinicsResult.data as ClinicRow[]).find(
    (item) => item.id && item.id.toLowerCase() === String(matched.clinic_id).toLowerCase(),
  );

  if (!clinic?.id) {
    return { success: false, error: 'Klinika topilmadi' };
  }

  if (clinic.status !== 'Active') {
    return { success: false, error: "Klinika faol emas. Admin bilan bog'laning!" };
  }

  if (clinic.expires_at) {
    const expiryDate = new Date(clinic.expires_at);
    if (!Number.isNaN(expiryDate.getTime())) {
      expiryDate.setHours(23, 59, 59, 999);
      if (new Date() > expiryDate) {
        return {
          success: false,
          error: "Klinika uchun to'lov muddati tugagan. Iltimos, to'lovni amalga oshiring!",
        };
      }
    }
  }

  const usernameValue = matched.username?.trim() || wantedUsername;
  const user: SessionUser = {
    id: String(matched.id),
    username: usernameValue,
    name: matched.name || matched.full_name || usernameValue,
    role: matched.role || 'doctor',
    clinic_id: String(matched.clinic_id),
  };

  const sessionClinic: SessionClinic = {
    id: String(clinic.id),
    name: clinic.name || clinic.id,
    status: clinic.status || 'Active',
    plan: (clinic.plan || 'pro').toLowerCase(),
  };

  return { success: true, session: { user, clinic: sessionClinic } };
}
