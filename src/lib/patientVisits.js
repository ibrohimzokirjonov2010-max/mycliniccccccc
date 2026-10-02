import { dateKeyOf, isCompletedVisitStatus } from '@/lib/clinicTime';

function consider(index, patientId, dateValue, completed) {
  if (!patientId) return;
  const id = String(patientId);
  if (completed) index.completed.add(id);
  const key = dateKeyOf(dateValue);
  if (key && (!index.last[id] || key > index.last[id])) index.last[id] = key;
}

/** Completed appointments and treatments decide who is still "new". */
export function buildVisitIndex(appointments = [], treatments = []) {
  const index = { completed: new Set(), last: {} };
  for (const visit of appointments || []) {
    consider(index, visit.patient_id, visit.date || visit.created_date || visit.created_at, isCompletedVisitStatus(visit.status));
  }
  for (const plan of treatments || []) {
    const done = isCompletedVisitStatus(plan.status) || Number(plan.paid_amount) > 0;
    consider(index, plan.patient_id, plan.start_date || plan.date || plan.created_date || plan.created_at, done);
  }
  return index;
}

export function isNewPatient(patient, index) {
  if (!patient?.id || !index) return true;
  return !index.completed.has(String(patient.id));
}

/** Same rule on the phone and the desktop patients list. */
export function isActiveTreatmentPatient(patient) {
  const status = String(patient?.status || '').trim().toLowerCase();
  return status === 'active' || status === 'faol';
}

export function lastVisitKey(patient, index) {
  if (!patient) return '';
  return index?.last?.[String(patient.id)] || dateKeyOf(patient.last_visit) || '';
}
