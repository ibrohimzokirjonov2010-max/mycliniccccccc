import type { CrmUser } from '../api/types';

type Row = {
  doctor_id?: string | null;
  doctor_name?: string | null;
  main_treatment_provider?: string | null;
  created_by_id?: string | null;
};

/** Same visibility rule as the web app: doctors see their own patients and visits. */
export function visibleToDoctor<T extends Row>(rows: T[], user: CrmUser | null, kind: 'patient' | 'visit'): T[] {
  if (!user || user.role !== 'doctor') return rows;
  const id = String(user.id);
  const name = (user.full_name || user.name || '').trim().toLowerCase();
  return rows.filter((row) => {
    if (kind === 'patient') {
      const provider = String(row.main_treatment_provider || '');
      return provider === id || (!!name && provider.trim().toLowerCase() === name) || String(row.created_by_id || '') === id;
    }
    const byId = row.doctor_id != null && String(row.doctor_id) === id;
    const byName = !!name && String(row.doctor_name || '').trim().toLowerCase() === name;
    return byId || byName;
  });
}
