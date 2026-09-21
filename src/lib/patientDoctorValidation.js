/** Shown under the shifokor field when a new patient is saved with no doctor. */
export const PATIENT_DOCTOR_REQUIRED_UZ = "Shifokorni tanlash majburiy";

/**
 * @param {unknown} doctorId
 * @param {(key: string) => string} [translate]
 * @returns {string} Empty when a doctor is selected; otherwise the inline error.
 */
export function getPatientDoctorRequiredError(doctorId, translate) {
  if (String(doctorId ?? '').trim()) return '';
  if (typeof translate === 'function') {
    const message = translate('patients.wizard.doctorRequiredInline');
    if (message && message !== 'patients.wizard.doctorRequiredInline') return message;
  }
  return PATIENT_DOCTOR_REQUIRED_UZ;
}
