// Brand-per-row implant factura: test record from the live audit (TEST Audit, 08.10.2026).
import {
  buildFacturaDocument,
  facturaFromImplantRecord,
  implantBrandSummary,
  implantBrandNames,
  isImplantLine,
  snapshotToEdits,
  extraIdsFromFactura,
} from '../src/components/implants/implantFactura.js';
import { buildLinkedServiceModel, implantCasePrice, persistedServicesList } from '../src/components/implants/linkedImplantServices.js';
import { implantPlanTotal } from '../src/lib/implantPlanModel.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

export const TEST_TOOTH_MAP = {
  16: { firma: 'Osstem', brend: 'Osstem', price: 3900000, diameter: '4.5', length: '10' },
  26: { firma: 'Straumann', brend: 'Straumann', price: 9500000, diameter: '4.1', length: '10' },
  36: { firma: 'Nobel', brend: 'Nobel', price: 8000000, diameter: '4.3', length: '11.5', extraction: 'paid' },
  46: { firma: 'Megagen', brend: 'Megagen', price: 4900000, diameter: '4.5', length: '10' },
};
const teeth = ['16', '26', '36', '46'];
const extras = [
  { id: 'bone_graft', label: 'Bone graft', defaultPrice: 1600000 },
  { id: 'open_sinus', label: 'Ochiq sinus-lifting', defaultPrice: 3000000 },
  { id: 'multi_unit', label: 'Multi-unit abutment', defaultPrice: 1000000 },
  { id: 'temp_crown', label: 'Vaqtinchalik toj', defaultPrice: 650000 },
  { id: 'zirkon_crown', label: 'Zirkon koronka', defaultPrice: 2800000 },
  { id: 'extraction', label: 'Atravmatik tish olish', defaultPrice: 250000 },
];
const toothLines = teeth.map((fdi) => ({ fdi, brand: TEST_TOOTH_MAP[fdi].firma, diameter: TEST_TOOTH_MAP[fdi].diameter, length: TEST_TOOTH_MAP[fdi].length }));
const toothPrices = Object.fromEntries(teeth.map((fdi) => [fdi, TEST_TOOTH_MAP[fdi].price]));

const doc = buildFacturaDocument({
  date: '2026-10-08',
  patientName: 'TEST Audit',
  clinicName: 'Ibrohim Dent',
  selectedFdis: teeth,
  brandLabel: 'Osstem',
  implantUnitPrice: 3900000,
  toothPrices,
  toothLines,
  extraServicesList: extras,
  selectedServiceIds: extras.map((e) => e.id),
  extraServicePrices: Object.fromEntries(extras.map((e) => [e.id, e.defaultPrice])),
  extractionFdis: ['36'],
  edits: { multi_unit: { qty: 1 }, temp_crown: { qty: 1 }, zirkon_crown: { qty: 4 } },
});

const implants = doc.stage1.filter(isImplantLine);
assert(implants.length === 4, `4 brand rows, got ${implants.length}`);
assert(implants.map((l) => l.label).join(',') === 'Osstem,Straumann,Nobel,Megagen', implants.map((l) => l.label).join(','));
assert(implants.map((l) => l.unitPrice).join(',') === '3900000,9500000,8000000,4900000', 'per-brand prices');
assert(implants.every((l) => l.qty === 1), 'one tooth per brand');
assert(doc.implant_total === 26300000, `implant total ${doc.implant_total}`);
assert(doc.stage1.find((l) => l.id === 'multi_unit').total === 1000000, 'multi-unit qty 1');
assert(doc.stage1.find((l) => l.id === 'temp_crown').total === 650000, 'PMMA qty 1');
assert(doc.stage1.find((l) => l.id === 'extraction').total === 250000, 'extraction 1 × 250 000');
assert(doc.stage2.find((l) => l.id === 'zirkon_crown').total === 11200000, 'zircon 4 × 2 800 000');
assert(doc.stage1Total === 32800000, `stage1 ${doc.stage1Total}`);
assert(doc.stage2Total === 11200000, `stage2 ${doc.stage2Total}`);
assert(doc.grandTotal === 44000000, `grand ${doc.grandTotal}`);
assert(!Object.keys(snapshotToEdits(doc)).some((id) => isImplantLine(id)), 'implant rows are not saved as edits');
assert(!extraIdsFromFactura(doc).extraIds.some((id) => isImplantLine(id)), 'implant rows are not extra services');

// What ImplantForm.handleSave stores (factura + per-tooth map), then every reader.
const record = {
  id: 'impl-test',
  patient_id: 'p1',
  patient_name: 'TEST Audit',
  placement_date: '2026-10-08',
  firma: 'Osstem',
  brend: 'Osstem',
  price: 26300000,
  tooth_numbers: teeth,
  tooth_data_map: TEST_TOOTH_MAP,
  extra_services: extras.map((e) => e.id),
  extra_service_prices: Object.fromEntries(extras.map((e) => [e.id, e.defaultPrice])),
  factura: doc,
};
record.services_list = persistedServicesList(buildLinkedServiceModel(record));
assert(implantCasePrice(record) === 44000000, `list/detail price ${implantCasePrice(record)}`);
assert(implantPlanTotal(record) === 44000000, `plan total ${implantPlanTotal(record)}`);
const printed = facturaFromImplantRecord(record);
assert(printed.grandTotal === 44000000, `printed ${printed.grandTotal}`);
assert(printed.stage1.filter(isImplantLine).length === 4, 'printed brand rows');

// Only factura in notes (live DB has no `factura` column): same totals.
const { factura: _f, ...noColumn } = record;
const fromNotes = { ...noColumn, notes: `[FAKTURA_JSON]${JSON.stringify(doc)}[/FAKTURA_JSON]` };
assert(implantCasePrice(fromNotes) === 44000000, 'notes-only price');
assert(facturaFromImplantRecord(fromNotes).grandTotal === 44000000, 'notes-only print');

// Legacy record saved before this fix: one "implant" row 3 900 000 × 4, multi-unit/PMMA × 4, extraction 150 000.
const legacy = {
  ...record,
  factura: {
    v: 1,
    teeth,
    brand: 'Osstem',
    implant_unit_price: 3900000,
    implant_qty: 4,
    stage1: [
      { id: 'implant', label: 'Osstem', unitPrice: 3900000, qty: 4, total: 15600000, source: 'implant' },
      { id: 'bone_graft', unitPrice: 1600000, qty: 1, total: 1600000, source: 'extra' },
      { id: 'multi_unit', unitPrice: 1000000, qty: 4, total: 4000000, source: 'extra' },
      { id: 'temp_crown', unitPrice: 650000, qty: 4, total: 2600000, source: 'extra' },
      { id: 'extraction', unitPrice: 150000, qty: 1, total: 150000, source: 'extra' },
      { id: 'open_sinus', unitPrice: 3000000, qty: 1, total: 3000000, source: 'extra' },
    ],
    stage2: [{ id: 'zirkon_crown', unitPrice: 2800000, qty: 4, total: 11200000, source: 'extra' }],
    stage1Total: 26950000,
    stage2Total: 11200000,
  },
};
delete legacy.services_list;
const legacyPrint = facturaFromImplantRecord(legacy);
assert(legacyPrint.stage1.filter(isImplantLine).map((l) => l.unitPrice).join(',') === '3900000,9500000,8000000,4900000', 'legacy implant row split by brand');
assert(legacyPrint.grandTotal === implantCasePrice(legacy), `legacy print ${legacyPrint.grandTotal} = list ${implantCasePrice(legacy)}`);
assert(legacyPrint.grandTotal === 48850000, `legacy consistent total ${legacyPrint.grandTotal}`);

const brands = implantBrandSummary(record);
assert(brands.map((b) => b.brand).join(',') === 'Osstem,Straumann,Nobel,Megagen', `firma column ${brands.map((b) => b.brand)}`);

assert(implantBrandNames(record).join(' · ') === 'Osstem · Straumann · Nobel · Megagen', 'list firma names');
assert(implantBrandNames({ firma: 'Boshqa', firma_custom: 'Alpha Bio' }).join() === 'Alpha Bio', 'legacy firma_custom fallback');

console.log('assert-implant-factura-brands: ok', { stage1: doc.stage1Total, stage2: doc.stage2Total, grand: doc.grandTotal });
