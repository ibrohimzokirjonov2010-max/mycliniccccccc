import {
  buildFacturaDocument,
  extraIdsFromFactura,
  encodeFacturaNotes,
  stripFacturaFromNotes,
  parseFacturaSnapshot,
  snapshotToEdits,
  resolveClinicTitle,
  formatSom,
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
assert(empty.stage2.some((l) => l.id === 'zircon_std' && l.qty === 0), 'empty zircon tiers');

console.log('assert-implant-factura: ok');
