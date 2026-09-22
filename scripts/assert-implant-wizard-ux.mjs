import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const form = read('src/components/implants/ImplantForm.jsx');
const arch = read('src/components/implants/ImplantWizardArch.jsx');
const entry = read('src/components/implants/ImplantWizardToothEntry.jsx');
const css = read('src/components/implants/implantWizard.css');
const vite = read('vite.config.js');
const sw = read('public/sw-activate-reload.js');
const main = read('src/main.jsx');

assert(form.includes('onToggle={focusTooth}'), 'chart click must focus the tooth, not only toggle');
assert(form.includes("renderSelectedStack('implant-wizard-selected-teeth')"), 'live stack under the patient panel');
assert(form.includes("renderSelectedStack('implant-wizard-selected-stack')"), 'live stack at the bottom of the chart panel');
assert(form.includes('data-stack="down"'), 'selected teeth stack downward');
assert(form.includes('Hali tish tanlanmagan'), 'empty selected-teeth state');
assert(form.includes('data-wizard-ux="linear-stack-v3"'), 'wizard build marker');
assert(!form.includes("tw('implantParams'"), 'step 1 must not render the old Implant parametrlari row');
assert(!form.includes('toggleFdi'), 'old toggle-only handler must stay removed');

const step1Start = form.indexOf('const renderStep1');
const step1End = form.indexOf('const renderStep2', step1Start);
assert(step1Start >= 0 && step1End > step1Start, 'renderStep1 bounds');
const step1 = form.slice(step1Start, step1End);
assert(step1.includes('<ImplantWizardToothEntry'), 'click opens the tooth entry panel on step 1');
assert(step1.includes('activeFdi ?'), 'entry panel is tied to the focused tooth');
assert(step1.indexOf("renderSelectedStack('implant-wizard-selected-teeth')") > step1.indexOf('implant-wizard-new-patient'), 'patient stack sits under + Yangi bemor');
assert(step1.indexOf("renderSelectedStack('implant-wizard-selected-stack')") > step1.indexOf('ImplantWizardArch'), 'chart stack sits below the tooth strip');
assert(step1.includes('implant-wizard-new-patient'), 'new patient action stays');
assert(step1.includes('promptSizes={promptSizes}'), 'tooth panel receives the size prompt');
assert(entry.includes('data-testid="implant-tooth-diameter"'), 'diameter field on the tooth panel');
assert(entry.includes('data-testid="implant-tooth-length"'), 'length field on the tooth panel');
assert(entry.includes("tw('diameterLabel', 'Diametr (Ø)')"), 'Uzbek diameter label');
assert(entry.includes("tw('lengthLabel', 'Uzunlik (L)')"), 'Uzbek length label');
assert(entry.includes('implant-wizard-size-grid'), 'diameter and length share one grid');
assert(!entry.includes('lot_number') && !entry.includes('Ncm') && !entry.includes('torque'), 'tooth panel does not add lot or torque');
assert(form.includes('data-tooth-size="step1-diameter-length"'), 'size marker stays on step 1');
assert(form.includes('formatToothSizeSummary'), 'selected rows can show Ø×L');

const step3Start = form.indexOf('const renderStep3');
const step3End = form.indexOf('const footerSummary', step3Start);
const step3 = form.slice(step3Start, step3End);
for (const banned of ['diameter', 'torque', 'lot_number', 'Ncm', 'Ø']) {
  assert(!step3.includes(banned), `step 3 must not reintroduce ${banned}`);
}
assert(step3.includes('implant-wizard-factura-teaser'), 'step 3 keeps the compact factura teaser');
assert(!step3.includes('<ImplantWizardFactura'), 'full factura stays out of the step 3 scroll body');
assert(form.includes('implant-wizard-factura-overlay'), 'factura remains a centered overlay');

assert(arch.includes('data-layout="linear"'), 'straight strip marker');
assert(arch.includes('UPPER_FDI = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28]'), 'upper FDI order');
assert(arch.includes('LOWER_FDI = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38]'), 'lower FDI order');
assert(!arch.includes('archT'), 'curved arch lift helper must stay removed');
assert(!arch.includes('rotate('), 'tooth slots must not rotate');
assert(arch.includes("transform: 'none'"), 'inline transform none beats a stale curve rule');
assert(css.includes('flex-direction: column'), 'selected list is a vertical stack');
assert(css.includes('.implant-wizard-selected-row'), 'each selected tooth is its own row');
assert(css.includes('.implant-wizard-arch-curve'), 'legacy curve class stays hidden');
assert(css.includes('display: none !important'), 'legacy curve cannot paint');

assert(vite.includes("navigateFallback: 'index.html'"), 'offline app shell stays precached');
assert(vite.includes('assets-cache-v12-implant-size'), 'asset runtime cache bumped');
assert(vite.includes("importScripts: ['sw-activate-reload.js']"), 'activate reload script is imported');
assert(sw.includes('client.navigate'), 'new service worker reloads open clients');
assert(main.includes('listenForAppUpdates'), 'page reloads when a new worker takes control');

console.log('assert-implant-wizard-ux: ok');
