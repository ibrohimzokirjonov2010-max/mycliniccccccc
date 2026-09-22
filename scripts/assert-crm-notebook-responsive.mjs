#!/usr/bin/env node
/**
 * Guard: dense CRM surfaces stay notebook-fluid (not microscopic).
 * Run: node scripts/assert-crm-notebook-responsive.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel) => fs.readFileSync(path.join(here, '..', rel), 'utf8');

function assert(cond, msg) {
  if (!cond) {
    console.error('assert-crm-notebook-responsive FAIL:', msg);
    process.exit(1);
  }
}

const dialog = read('src/components/ui/dialog.jsx');
const implantCss = read('src/components/implants/implantWizard.css');
const implantForm = read('src/components/implants/ImplantForm.jsx');
const implantArch = read('src/components/implants/ImplantWizardArch.jsx');
const implantStep2 = read('src/components/implants/ImplantWizardStep2.jsx');
const paymentCss = read('src/components/payments/paymentAddModal.css');
const payments = read('src/pages/Payments.jsx');
const indexCss = read('src/index.css');
const chairside = read('src/components/patients/ChairsidePatientProfile.jsx');
const excelChart = read('src/components/patients/ExcelDentalChartView.jsx');
const appt = read('src/components/appointments/AppointmentModal.jsx');
const reja = read('src/components/patients/NewPatientFlow.jsx');

// Shared dialog shell
assert(dialog.includes("data-dialog-shell={fluidShell ? 'notebook-fluid-v1'"), 'dialog fluid marker');
assert(dialog.includes('implant-wizard-dialog'), 'implant dialog opts out of forced maxHeight');
assert(dialog.includes('dialog-shell-fluid'), 'dialog-shell-fluid class supported');
assert(dialog.includes('1.25rem'), 'default maxHeight tax reduced for notebooks');

// New patient REJA (prior fix preserved)
assert(reja.includes('data-reja-layout="notebook-fluid-v1"'), 'REJA marker stays');
assert(reja.includes('hidden lg:flex flex-row'), 'REJA two-col at lg');

// Implant wizard
assert(implantCss.includes('min(94dvh, 900px)'), 'implant dialog taller on notebooks');
assert(implantCss.includes('Notebook / short laptop'), 'implant notebook MQ');
assert(implantCss.includes('@media (min-width: 1024px)'), 'service 2-col delayed to lg');
assert(implantForm.includes('lg:flex-row'), 'step1 side rail at lg');
assert(implantForm.includes('min(94dvh, 900px)'), 'implant style maxHeight fluid');
assert(implantArch.includes('w-[36px] h-[44px]'), 'arch tooth faces enlarged');
assert(implantArch.includes('text-xs'), 'arch FDI readable');
assert(!implantStep2.includes('style={{ width: 240, minWidth: 240 }}'), 'step2 no fixed 240 inline');
assert(!implantCss.includes('min-height: 460px'), 'step2 no forced 460 min-height');

// Payments (responsive only — no redesign mockups)
assert(paymentCss.includes('min(94dvh, 900px)'), 'payment add taller');
assert(paymentCss.includes('Notebook short-height'), 'payment short-height MQ');
assert(paymentCss.includes('@container payment-add'), 'payment container query intact');
assert(payments.includes('lg:grid-cols-2 gap-4'), 'payment add stacks until lg');
assert(payments.includes('max-h-[min(160px,22vh)]'), 'plans list fluid scroll');
assert(payments.includes('max-h-[min(78vh,calc(100dvh-9rem))]'), 'detail body fluid height');
assert(payments.includes("PAYMENT_ADD_MARKER = 'payment-add-teal-v5-single-center'"), 'payment marker unchanged');

// Odontogram
assert(indexCss.includes('clamp(72px, 22cqw, 128px)'), 'lateral teeth taller on notebooks');
assert(indexCss.includes('clamp(16px, 4.5cqw, 28px)'), 'occlusal fluid height');
assert(chairside.includes('p-2 sm:p-4 lg:p-5'), 'chairside chart padding');
assert(excelChart.includes('p-2 sm:p-4 lg:p-5'), 'excel chart padding');

// Appointments quick win
assert(appt.includes('dialog-shell-fluid'), 'appointment modal fluid shell');
assert(appt.includes('grid-cols-4 sm:grid-cols-6 md:grid-cols-8'), 'tooth picker responsive grid');
assert(!appt.includes('text-[7.5px]'), 'no sub-8px legend sizes');

console.log('assert-crm-notebook-responsive: ok');
