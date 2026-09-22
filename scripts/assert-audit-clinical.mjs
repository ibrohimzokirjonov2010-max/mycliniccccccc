import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { countImplantTeeth, implantRecordFdis } from '../src/lib/fdiNotation.js';
import { isAppointmentCalendarPath } from '../src/lib/alertRoutes.js';
import {
  resolveAssignedDoctorName,
  resolveDocumentDoctorName,
} from '../src/lib/treatingDoctor.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const multi = { tooth_numbers: ['16', 'ur6', '17', '17'], tooth_number: '16' };
assert(implantRecordFdis(multi).join(',') === '16,17', `fdis ${implantRecordFdis(multi)}`);
assert(countImplantTeeth([multi]) === 2, 'one record covering #16 and #17 counts as 2');
assert(countImplantTeeth([{ tooth_number: '21' }, multi]) === 3, 'mixed rows sum unique teeth');
assert(implantRecordFdis({ tooth_numbers: 'ur7, 17' }).join(',') === '17', 'string list dedupes');

const doctors = [
  { id: 'admin-1', name: 'Demo Admin', role: 'admin' },
  { id: 'doc-k', name: 'Dr kamron', role: 'doctor' },
];
const patient = { main_treatment_provider: 'doc-k' };
const admin = { id: 'admin-1', name: 'Demo Admin', role: 'admin' };
assert(resolveAssignedDoctorName(patient, doctors) === 'Dr kamron', 'assigned doctor');
assert(
  resolveDocumentDoctorName({ patient, doctors, user: admin, explicitName: 'Demo Admin' }) === 'Dr kamron',
  'invoice must not keep the admin fallback'
);
assert(
  resolveDocumentDoctorName({ patient: { main_treatment_provider: '' }, doctors, user: admin, explicitName: 'Dr kamron' }) === 'Dr kamron',
  'explicit clinician name stays'
);

assert(isAppointmentCalendarPath('/appointments') === true, 'appointments quiet');
assert(isAppointmentCalendarPath('/appointments/') === true, 'appointments slash quiet');
assert(isAppointmentCalendarPath('/patients/1') === false, 'profile still alerts');

const flow = read('src/components/patients/NewPatientFlow.jsx');
const receipt = read('src/components/patients/NewPatientReceipt.jsx');
assert(!flow.includes("localStorage.getItem('user_name')"), 'wizard does not use logged-in name');
assert(!flow.includes('Demo Admin'), 'wizard does not fall back to Demo Admin');
assert(!receipt.includes("localStorage.getItem('user_name')"), 'receipt does not use logged-in name');
assert(!receipt.includes('Demo Admin'), 'receipt does not fall back to Demo Admin');
assert(receipt.includes('data-testid="invoice-doctor"'), 'invoice doctor node');
assert(flow.includes('doctorName={createdPlan?.doctor_name'), 'invoice uses plan doctor');
assert(flow.includes('<DialogDescription'), 'new patient dialog has a description');
assert(flow.includes('NewPatientReceiptOverlay'), 'compact receipt overlay stays');

const form = read('src/components/implants/ImplantForm.jsx');
assert(form.includes('resolveAssignedDoctorName'), 'implant form prefers assigned doctor');
assert(form.includes('tooth_numbers: fdiNumbers'), 'save stores deduped FDIs');
assert(form.includes('uniqueFdis(rawTeeth)'), 'edit load dedupes teeth');
assert(form.includes('<DialogDescription'), 'implant wizard has a description');
assert(!form.includes('aria-describedby={undefined}'), 'implant wizard description is wired');

const profile = read('src/components/patients/ExcelImplantsView.jsx');
assert(profile.includes('implantRecordFdis'), 'profile implant tab lists every FDI');
assert(!profile.includes('#{imp.tooth_number}'), 'profile does not show only the first tooth');

const page = read('src/pages/PatientProfile.jsx');
assert(page.includes('countImplantTeeth(implants)'), 'profile badge counts teeth');
assert(page.includes('<DialogDescription'), 'patient profile dialogs describe themselves');

const payments = read('src/pages/Payments.jsx');
assert(payments.includes('data-payment-add={PAYMENT_ADD_MARKER}'), 'payment modal marker stays');
assert(payments.includes('className="payment-add-header-sub"'), 'payment subtitle class stays');
assert(!payments.includes('aria-describedby={undefined}'), 'payment dialogs describe themselves');
assert(payments.includes('<DialogDescription'), 'payment dialogs have descriptions');

const uz = JSON.parse(read('src/i18n/translations/uz.json'));
const ru = JSON.parse(read('src/i18n/translations/ru.json'));
const en = JSON.parse(read('src/i18n/translations/en.json'));
assert(uz.appointments.legendAvailable === "Bo'sh", 'uz legend');
assert(ru.appointments.legendAvailable === 'Свободно', 'ru legend');
assert(en.appointments.legendAvailable === 'Available', 'en legend');

const alerter = read('src/components/notifications/ImplantAlerter.jsx');
assert(alerter.includes('isAppointmentCalendarPath'), 'implant toasts skip the calendar');
assert(alerter.includes("toast.dismiss('implant-incomplete-notification')"), 'leaving a toast behind is dismissed');

const registry = read('src/pages/Implants.jsx');
assert(registry.includes('teethList.map((fdi)'), 'registry chips are unique FDIs');
assert(!registry.includes('i.tooth_numbers.map(String)'), 'registry does not chip raw duplicate ids');

console.log('audit clinical fixes: ok');
