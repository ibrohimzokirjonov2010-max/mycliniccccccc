/** Display name for a staff user or doctor record. */
export function clinicianDisplayName(person) {
  return String(person?.full_name || person?.name || person?.username || '').trim();
}

/** Chairside clinician. Admins are not a substitute for an assigned doctor. */
export function isTreatingClinician(person) {
  const role = String(person?.role || '').toLowerCase();
  return role === 'doctor' || role === 'shifokor' || role === 'dentist';
}

/**
 * Patient's assigned treating doctor, matched by id or name.
 * Returns '' when the patient has no real doctor set.
 */
export function resolveAssignedDoctorName(patient, doctors = []) {
  if (!patient) return '';
  const key = String(patient.main_treatment_provider || patient.doctor_id || '').trim();
  const named = String(patient.doctor_name || patient.doctor || '').trim();
  const list = Array.isArray(doctors) ? doctors : [];
  if (key) {
    const match = list.find((d) =>
      String(d?.id) === key
      || clinicianDisplayName(d).toLowerCase() === key.toLowerCase()
    );
    if (match) return clinicianDisplayName(match);
    const looksLikeId = /^user-/i.test(key) || /^[0-9a-f-]{16,}$/i.test(key);
    if (!looksLikeId) return key;
  }
  return named;
}

/**
 * Doctor name for invoices, plans, and implant records.
 * The patient's assigned clinician wins over the logged-in admin.
 */
export function resolveDocumentDoctorName({ patient, doctors, user, explicitName } = {}) {
  const assigned = resolveAssignedDoctorName(patient, doctors);
  if (assigned) return assigned;
  const explicit = String(explicitName || '').trim();
  const userName = clinicianDisplayName(user);
  const explicitIsAdminStamp = Boolean(userName)
    && !isTreatingClinician(user)
    && explicit === userName;
  if (explicit && !explicitIsAdminStamp) return explicit;
  if (user && isTreatingClinician(user) && userName) return userName;
  return explicitIsAdminStamp ? '' : explicit;
}
