import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildFacturaDocument,
  formatImplantSize,
  summarizeToothLines,
  extraIdsFromFactura,
  encodeFacturaNotes,
  stripFacturaFromNotes,
  parseFacturaSnapshot,
  snapshotToEdits,
  resolveClinicTitle,
  formatSom,
  printImplantFactura,
  isDesktopViewport,
  IMPLANT_WIZARD_FACTURA_MARKER,
} from '../src/components/implants/implantFactura.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const extras = [
  { id: 'bone_graft', label: 'Bone graft', defaultPrice: 300000 },
  { id: 'temp_crown', label: 'Vaqtinchalik toj', defaultPrice: 150000 },
  { id: 'zirkon_crown', label: 'Zirkon karonka', defaultPrice: 550000 },
  { id: 'metal_crown', label: 'Metallokeramika karonka', defaultPrice: 500000 },
  { id: 'extraction', label: 'Atravmatik tish olish', defaultPrice: 250000 },
];

const doc = buildFacturaDocument({
  date: '2026-02-27',
  patientName: 'Malika Murodova',
  clinicName: 'ShifoCRM',
  selectedFdis: ['16', '26', '36', '46', '14'],
  brandLabel: 'AnyRidge',
  implantUnitPrice: 3900000,
  extraServicesList: extras,
  selectedServiceIds: ['bone_graft', 'temp_crown', 'zirkon_crown'],
  extraServicePrices: { bone_graft: 300000, temp_crown: 265000, zirkon_crown: 225000 },
});

assert(doc.clinic === 'Implant Center', `clinic title: ${doc.clinic}`);
assert(doc.patient_name === 'Malika Murodova', 'patient');
assert(doc.teeth.length === 5, `teeth ${doc.teeth.length}`);
assert(doc.stage1[0].id === 'implant', 'implant first');
assert(doc.stage1[0].label === 'AnyRidge', 'brand label');
assert(doc.stage1[0].qty === 5, `implant qty ${doc.stage1[0].qty}`);
assert(doc.stage1[0].total === 3900000 * 5, `implant total ${doc.stage1[0].total}`);

const bone = doc.stage1.find((l) => l.id === 'bone_graft');
assert(bone && bone.qty === 1 && bone.total === 300000, 'bone graft stage 1');

const temp = doc.stage1.find((l) => l.id === 'temp_crown');
assert(temp && temp.qty === 5 && temp.total === 265000 * 5, `temp crown ${temp?.qty} ${temp?.total}`);

const zircon = doc.stage2.find((l) => l.id === 'zirkon_crown');
assert(zircon && zircon.qty === 5 && zircon.total === 225000 * 5, 'zircon stage 2');
assert(!doc.stage2.some((l) => l.id === 'zircon_std'), 'no empty zircon tiers when selected');

assert(doc.stage1Total === 3900000 * 5 + 300000 + 265000 * 5, `stage1 ${doc.stage1Total}`);
assert(doc.stage2Total === 225000 * 5, `stage2 ${doc.stage2Total}`);

const edited = buildFacturaDocument({
  ...{
    date: '2026-02-27',
    patientName: 'Malika Murodova',
    clinicName: 'Implant Center',
    selectedFdis: ['16', '26'],
    brandLabel: 'Osstem',
    implantUnitPrice: 1500000,
    extraServicesList: extras,
    selectedServiceIds: [],
    extraServicePrices: {},
    edits: { implant: { qty: 4, unitPrice: 1500000 }, zircon_est: { qty: 4, unitPrice: 1500000 } },
  },
});
assert(edited.stage1[0].qty === 4, 'edited implant qty');
assert(edited.stage2.find((l) => l.id === 'zircon_est')?.qty === 4, 'edited zircon tier');
assert(edited.stage2.some((l) => l.id === 'metal_crown' && l.qty === 0), 'metal placeholder');

const mapped = extraIdsFromFactura(edited);
assert(mapped.extraIds.includes('zirkon_crown'), `mapped extras ${mapped.extraIds}`);
assert(mapped.extraPrices.zirkon_crown === 1500000, 'mapped zircon price');

const notes = encodeFacturaNotes('Shifokor izohi', doc);
assert(notes.includes('Shifokor izohi'), 'keep user notes');
assert(notes.includes('[FAKTURA_JSON]'), 'json marker');
assert(stripFacturaFromNotes(notes) === 'Shifokor izohi', `stripped: ${stripFacturaFromNotes(notes)}`);
const parsed = parseFacturaSnapshot({ notes });
assert(parsed && parsed.patient_name === 'Malika Murodova', 'parse notes');
assert(snapshotToEdits(parsed).implant.qty === 5, 'edits from snapshot');
assert(resolveClinicTitle('My Clinic') === 'Implant Center', 'generic clinic');
assert(formatSom(1500000) === '1 500 000', `format ${formatSom(1500000)}`);

const empty = buildFacturaDocument({
  date: '2026-09-21',
  patientName: '',
  clinicName: 'DentaNova',
  selectedFdis: [],
  brandLabel: 'Osstem',
  implantUnitPrice: 1500000,
  extraServicesList: extras,
  selectedServiceIds: [],
});
assert(empty.clinic === 'DentaNova', 'custom clinic kept');
assert(empty.stage1[0].qty === 0, 'zero teeth implant qty');

const sized = buildFacturaDocument({
  date: '2026-09-22',
  patientName: 'Ali Valiyev',
  clinicName: 'DentaNova',
  selectedFdis: ['16', '26'],
  brandLabel: 'Osstem',
  implantUnitPrice: 1500000,
  extraServicesList: extras,
  selectedServiceIds: [],
  toothLines: [
    { fdi: '16', brand: 'Osstem', diameter: '4.5', length: '10' },
    { fdi: '26', brand: 'Straumann', diameter: '4.0', length: '8' },
  ],
});
assert(sized.stage1[0].label === 'Osstem', `mixed sizes keep brand label: ${sized.stage1[0].label}`);
assert(sized.toothLines[0].size === 'Ø4.5×L10', `size 16 ${sized.toothLines[0].size}`);
assert(sized.toothLines[1].size === 'Ø4.0×L8', `size 26 ${sized.toothLines[1].size}`);
assert(sized.toothLines[1].brand === 'Straumann', 'per-tooth brand');
const sameSize = buildFacturaDocument({
  date: '2026-09-22',
  patientName: 'Ali Valiyev',
  clinicName: 'DentaNova',
  selectedFdis: ['16'],
  brandLabel: 'Osstem',
  implantUnitPrice: 1500000,
  toothLines: [{ fdi: '16', brand: 'Osstem', diameter: '4.5', length: '10' }],
});
assert(sameSize.stage1[0].label === 'Osstem · Ø4.5×L10', `uniform size label ${sameSize.stage1[0].label}`);
assert(formatImplantSize('4.5', '') === 'Ø4.5', 'diameter only');
assert(summarizeToothLines([{ fdi: '#36', diameter: '5', length: '11.5' }])[0].size === 'Ø5×L11.5', 'summarize');
const sizedNotes = encodeFacturaNotes('', sameSize);
assert(sizedNotes.includes('Ø4.5×L10'), 'factura text includes size');
assert(sizedNotes.includes('Osstem'), 'factura text includes brand');
assert(empty.stage2.some((l) => l.id === 'zircon_std' && l.qty === 0), 'empty zircon tiers');
assert(typeof printImplantFactura === 'function', 'print helper');
assert(typeof isDesktopViewport === 'function', 'desktop helper');
assert(printImplantFactura() === false, 'print no-ops without window.print');
assert(
  IMPLANT_WIZARD_FACTURA_MARKER === 'implant-step3-factura-overlay-v2-0d9488',
  `marker ${IMPLANT_WIZARD_FACTURA_MARKER}`
);

const here = path.dirname(fileURLToPath(import.meta.url));
const formSrc = fs.readFileSync(path.join(here, '../src/components/implants/ImplantForm.jsx'), 'utf8');
const openStart = formSrc.indexOf('const openFactura');
const openEnd = formSrc.indexOf('useEffect', openStart);
assert(openStart >= 0 && openEnd > openStart, 'openFactura bounds');
const openSrc = formSrc.slice(openStart, openEnd);
assert(!openSrc.includes('scrollIntoView'), 'openFactura must not scrollIntoView the wizard factura');
assert(formSrc.includes('setFacturaPreviewOpen(true)'), 'Faktura olish opens overlay state');
assert(formSrc.includes('data-implant-factura-overlay'), 'overlay marker');
assert(formSrc.includes('createPortal'), 'factura overlay is portaled');
assert((formSrc.split('<ImplantWizardFactura').length - 1) === 1, 'full factura mounts once (overlay only)');
assert(formSrc.includes('implant-wizard-factura-teaser'), 'compact teaser stays at top of step 3');
assert(formSrc.includes('data-implant-factura-slot'), 'slot remains in step 3 content');
const step3Start = formSrc.indexOf('const renderStep3');
const step3End = formSrc.indexOf('const footerSummary', step3Start);
assert(step3Start >= 0 && step3End > step3Start, 'renderStep3 bounds');
const step3Src = formSrc.slice(step3Start, step3End);
assert(!step3Src.includes('<ImplantWizardFactura'), 'do not dump full factura in renderStep3');
assert(step3Src.includes('implant-wizard-factura-teaser'), 'teaser is first-class in step 3');
const effectStart = formSrc.indexOf('if (!facturaPreviewOpen) return undefined;');
const effectEnd = formSrc.indexOf('}, [facturaPreviewOpen]');
assert(effectStart >= 0 && effectEnd > effectStart, 'factura open effect');
assert(!formSrc.slice(effectStart, effectEnd).includes('printImplantFactura'), 'opening factura must not auto-print');
assert(formSrc.includes('saveFailed'), 'save failure surfaces an Uzbek message');
const toothSrc = fs.readFileSync(path.join(here, '../src/components/implants/ImplantWizardToothEntry.jsx'), 'utf8');
assert(toothSrc.includes('data-testid="implant-tooth-diameter"'), 'per-tooth diameter stays on the tooth panel');
assert(toothSrc.includes('data-testid="implant-tooth-length"'), 'per-tooth length stays on the tooth panel');
assert(!step3Src.includes('implant-tooth-diameter'), 'diameter input is not on step 3');

const facturaSrc = fs.readFileSync(path.join(here, '../src/components/implants/ImplantWizardFactura.jsx'), 'utf8');
assert(facturaSrc.includes('data-factura-layout="implant-center-paper"'), 'paper factura layout marker');
assert(facturaSrc.includes('IMPLANT CENTER'), 'paper masthead');
assert(facturaSrc.includes('Tish qatori formulasi'), 'tooth formula title');
assert(facturaSrc.includes('Suyak material'), 'bone material row');
assert(facturaSrc.includes('0.1 gr'), 'bone 0.1 gr unit');
assert(facturaSrc.includes('Vaqtinchalik koronka PMMA'), 'PMMA row');
assert(facturaSrc.includes('Operatsion harajatlar'), 'operation row');
assert(facturaSrc.includes('Sirkoniy koronka'), 'zircon row');
assert(facturaSrc.includes('Metallokeramika'), 'metal ceramic row');
assert(facturaSrc.includes('Eslatma!'), 'eslatma footer');
assert(facturaSrc.includes('data-factura-tooth'), 'arch marks selected teeth');
assert(facturaSrc.includes("2–3 oydan so'ng"), 'stage 2 timing');

const cssSrc = fs.readFileSync(path.join(here, '../src/components/implants/implantWizard.css'), 'utf8');
assert(cssSrc.includes('z-index: 400'), 'overlay stacks above wizard dialog z-100');
assert(cssSrc.includes('.implant-wizard-factura-teaser'), 'teaser styles');
assert(cssSrc.includes('margin-top: auto'), 'overlay sheet centers without clipping the top');
assert(cssSrc.includes('html.printing-implant-factura-overlay .implant-wizard-factura-overlay'), 'print targets the overlay');
const printBlock = cssSrc.slice(cssSrc.indexOf('html.printing-implant-factura-overlay .implant-wizard-factura-overlay {'));
assert(printBlock.includes('top: 0'), 'print overlay starts at the top of the page');

console.log('assert-implant-factura: ok');
