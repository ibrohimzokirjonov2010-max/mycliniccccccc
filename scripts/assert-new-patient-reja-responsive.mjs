#!/usr/bin/env node
/**
 * Guard: New Patient wizard REJA (step 2) stays usable on notebook widths.
 * Run: node scripts/assert-new-patient-reja-responsive.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel) => fs.readFileSync(path.join(here, '..', rel), 'utf8');

function assert(cond, msg) {
  if (!cond) {
    console.error('assert-new-patient-reja-responsive FAIL:', msg);
    process.exit(1);
  }
}

const flow = read('src/components/patients/NewPatientFlow.jsx');

assert(flow.includes('data-reja-layout="notebook-fluid-v1"'), 'REJA layout marker present');
assert(flow.includes('data-new-patient-shell={step === 2 ? "reja-notebook-fluid-v1"'), 'step-2 shell marker');
assert(flow.includes('hidden lg:flex flex-row'), 'two-column layout starts at lg, not md');
assert(flow.includes('flex lg:hidden flex-col'), 'stacked layout below lg');
assert(flow.includes('max-w-6xl h-[min(92dvh,900px)]'), 'step-2 dialog uses taller/wider shell');
assert(flow.includes('xl:w-9 xl:h-9'), 'tooth buttons grow on xl notebooks');
assert(flow.includes('lg:w-8 lg:h-8'), 'tooth buttons at least 32px on lg');
assert(flow.includes('min-h-[40px]'), 'service rows have usable min height');
assert(flow.includes('overscroll-contain'), 'REJA panels scroll within sections');
assert(flow.includes("t('patients.wizard.skipPlan')"), 'Rejasiz davom etish preserved');
assert(flow.includes('handleSavePlan'), 'Saqlash handler preserved');
assert(flow.includes('handleApplyDiscount'), 'discount controls preserved');
assert(!flow.includes('hidden md:flex flex-row flex-1 min-h-0 bg-white overflow-hidden'), 'must not reintroduce md two-column REJA');
assert(!flow.includes('"w-7 h-7 rounded-lg flex items-center justify-center font-black'), 'must not use fixed tiny-only tooth chips');

console.log('assert-new-patient-reja-responsive: ok');
