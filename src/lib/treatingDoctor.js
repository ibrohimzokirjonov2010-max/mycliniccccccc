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

/**
 * Doctor for new plans / plan items / tooth records / payments.
 * Priority: picked > patient's assigned doctor > patient's existing plans' doctor > logged-in user (only if a doctor).
 * Never falls back to "first doctor in list" or an admin. Returns { id, name } or null (caller must ask to choose).
 */
export function resolveTreatingDoctor({ pickedId, patient, plans = [], doctors = [], user } = {}) {
  const list = Array.isArray(doctors) ? doctors : [];
  const byRef = (ref) => {
    const key = String(ref || '').trim();
    if (!key) return null;
    const lower = key.toLowerCase();
    return list.find((d) => String(d?.id) === key)
      || list.find((d) => clinicianDisplayName(d).toLowerCase() === lower)
      || null;
  };
  const out = (d) => (d ? { ...d, id: d.id, name: clinicianDisplayName(d) } : null);
  const picked = byRef(pickedId);
  if (picked) return out(picked);
  const assigned = byRef(patient?.main_treatment_provider) || byRef(patient?.doctor_id) || byRef(patient?.doctor_name);
  if (assigned) return out(assigned);
  for (const pl of (Array.isArray(plans) ? plans : [])) {
    const d = byRef(pl?.doctor_id) || byRef(pl?.doctor_name);
    if (d) return out(d);
  }
  if (user?.id && isTreatingClinician(user)) return out(byRef(user.id) || user);
  return null;
}
