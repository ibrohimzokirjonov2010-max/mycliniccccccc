import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const flow = read('src/components/patients/NewPatientFlow.jsx');
const receipt = read('src/components/patients/NewPatientReceipt.jsx');
const css = read('src/components/patients/newPatientReceipt.css');

assert(flow.includes('data-new-patient-receipt="compact-v1"'), 'step 4 keeps a compact receipt slot');
assert(flow.includes('data-testid="new-patient-receipt-teaser"') || receipt.includes('data-testid="new-patient-receipt-teaser"'), 'compact teaser is present');
assert(flow.includes('NewPatientReceiptTeaser'), 'patient flow renders the teaser');
assert(flow.includes('NewPatientReceiptOverlay'), 'full paper is the overlay');
assert(!flow.includes('id="new-patient-receipt"'), 'full paper is not mounted in the wizard step body');
assert(!flow.includes('window.print()'), 'step 4 does not print the wizard body');
assert(!flow.includes('scrollIntoView'), 'opening the receipt must not scroll the wizard');

assert(receipt.includes('createPortal'), 'full invoice is a body portal');
assert(receipt.includes('id="new-patient-receipt"'), 'printable receipt id stays');
assert(receipt.includes('data-testid="new-patient-receipt-overlay"'), 'overlay test id');
assert(receipt.includes('pointerEvents: \'auto\''), 'overlay opts back into pointer events');
assert(receipt.includes('zIndex: 400'), 'overlay stacks above the patient dialog');
assert(receipt.includes('printNewPatientReceipt'), 'print is an explicit action');
assert(!receipt.includes('useEffect(() => {\n    printNewPatientReceipt'), 'opening the overlay does not auto-print');
assert(!receipt.includes('scrollIntoView'), 'overlay does not scroll the page');

assert(css.includes('body > *:not(.new-patient-receipt-overlay)'), 'print hides other body children');
assert(css.includes('position: static !important'), 'print overlay stays in flow at the top');
const printCss = css.slice(css.indexOf('@media print'));
assert(printCss.includes('@media print'), 'print rules exist');
assert(!printCss.includes('inset:'), 'print must not use the inset shorthand');
assert(printCss.includes('top: auto !important'), 'print clears top without the inset shorthand');
assert(css.includes('.receipt-total-bar'), 'printed total stays readable');
assert(css.includes('max-height: min(86dvh, 760px)'), 'overlay paper is height-capped');

assert(flow.includes('getPatientDoctorRequiredError'), 'doctor required check stays');
assert(flow.includes('patientGenderForDb'), 'gender save stays');
assert(flow.includes('data-patient-doctor-field'), 'doctor field stays');

const implantCss = read('src/components/implants/implantWizard.css');
assert(implantCss.includes('implant-wizard-factura-overlay'), 'implant factura overlay is untouched by this check');
assert(!css.includes('implant-wizard-factura'), 'patient receipt css does not retarget the implant overlay');

console.log('new patient receipt compact: ok');
