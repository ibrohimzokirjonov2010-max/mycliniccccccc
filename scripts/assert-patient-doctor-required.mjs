import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPatientDoctorRequiredError, PATIENT_DOCTOR_REQUIRED_UZ } from '../src/lib/patientDoctorValidation.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const flow = read('src/components/patients/NewPatientFlow.jsx');
const modal = read('src/components/patients/PatientModal.jsx');
const uz = JSON.parse(read('src/i18n/translations/uz.json'));

assert(PATIENT_DOCTOR_REQUIRED_UZ === "Shifokorni tanlash majburiy", 'uzbek copy');
assert(getPatientDoctorRequiredError('') === PATIENT_DOCTOR_REQUIRED_UZ, 'empty doctor is blocked');
assert(getPatientDoctorRequiredError('   ') === PATIENT_DOCTOR_REQUIRED_UZ, 'blank doctor is blocked');
assert(getPatientDoctorRequiredError(null) === PATIENT_DOCTOR_REQUIRED_UZ, 'null doctor is blocked');
assert(getPatientDoctorRequiredError('doc-1') === '', 'selected doctor passes');

assert(uz.patients.wizard.doctorRequiredInline === PATIENT_DOCTOR_REQUIRED_UZ, 'uz translation');

for (const [name, source] of [['NewPatientFlow', flow], ['PatientModal', modal]]) {
  assert(source.includes('getPatientDoctorRequiredError'), `${name} validates doctor`);
  assert(source.includes('data-patient-doctor-field'), `${name} keeps the shifokor field`);
  assert(source.includes('data-patient-doctor-error'), `${name} shows an inline error`);
  assert(source.includes('text-red-500 font-bold">*</span>'), `${name} marks doctor required`);
  assert(!source.includes('ixtiyoriy'), `${name} must not label doctor optional`);
}

assert(!flow.includes('!!patientForm.main_treatment_provider'), 'save stays clickable so the inline error can show');
assert(flow.includes('if (missingDoctor)'), 'NewPatientFlow returns before create');
assert(modal.includes('if (missingDoctor)'), 'PatientModal returns before create');
assert(!modal.includes('main_treatment_provider: next[0]'), 'do not auto-assign the first doctor');
assert(!modal.includes("main_treatment_provider: user?.id"), 'do not prefill the logged-in user as doctor');

// Doctor Select must portal above Dialog (z-[100]) — Payments already uses z-[110]
assert(flow.includes('data-patient-doctor-select'), 'NewPatientFlow doctor select marker');
assert(modal.includes('data-patient-doctor-select'), 'PatientModal doctor select marker');
assert(flow.includes('position="popper"') && flow.includes('z-[110]'), 'NewPatientFlow doctor menu uses popper + z-[110]');
assert(modal.includes('position="popper"') && modal.includes('z-[110]'), 'PatientModal doctor menu uses popper + z-[110]');
const selectUi = read('src/components/ui/select.jsx');
assert(selectUi.includes('z-[110]'), 'shared SelectContent stacks above Dialog z-[100]');

console.log('patient doctor required: ok');
