// Shifokor bo'yicha filtrlash uchun umumiy yordamchilar (Xodimlar → Qabullar / Bemorlar havolalari).

const norm = (v) => String(v ?? '').trim().toLowerCase();

/** Qabul (appointment) shu shifokorga tegishlimi: id yoki ism bo'yicha (matchStaff bilan bir xil qoida). */
export function appointmentMatchesDoctor(appt, doctorId, doctorName) {
  if (doctorId == null || doctorId === '') return true;
  if (appt?.doctor_id != null && appt.doctor_id !== '' && String(appt.doctor_id) === String(doctorId)) return true;
  const name = norm(doctorName);
  if (name.length < 2) return false;
  const apptName = norm(appt?.doctor_name);
  if (apptName && (apptName === name || apptName.includes(name) || name.includes(apptName))) return true;
  return false;
}

/** Bemor Xodimlar sahifasidan kelgan doctorFilter ({ id, name, patientIds }) ga mos keladimi. */
export function patientMatchesDoctorFilter(patient, filter) {
  if (!filter) return true;
  const ids = new Set((filter.patientIds || []).map(String));
  const docName = norm(filter.name);
  const provider = norm(patient?.main_treatment_provider);
  return (
    ids.has(String(patient?.id)) ||
    String(patient?.main_treatment_provider) === String(filter.id) ||
    (!!docName && provider === docName)
  );
}
