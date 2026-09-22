/**
 * Sanity-check Dizyner tooth asset files + ENDO mapping.
 * Run: node scripts/verify-tooth-illustrations.mjs
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  matchIllustrationKind,
  pickIllustrationKindFromServices,
  getToothIllustrationSrc,
  normalizeFdi,
  resolveToothIllustrationKind,
  TOOTH_ASSET_VERSION,
} from '../src/utils/toothIllustration.js';

const kinds = ['endo', 'caries', 'implant', 'plomba', 'shtift', 'breket', 'metal-keramika', 'sirkon', 'protez-syomniy', 'protez-implant', 'protez-babochka', 'missing', 'healthy'];
const fdis = [1, 2, 3, 4].flatMap((q) => Array.from({ length: 8 }, (_, i) => `${q}${i + 1}`));

let failed = 0;
const fail = (msg) => {
  failed += 1;
  console.error('FAIL', msg);
};

for (const kind of kinds) {
  for (const fdi of fdis) {
    const path = resolve('public', 'teeth', kind, `${fdi}.png`);
    if (!existsSync(path)) fail(`missing ${kind}/${fdi}.png`);
  }
}

const cases = [
  ['Kanal davolash (1 kanal)', 'ENDODONTIYA', 'endo'],
  ['Kanal davolash (3 kanal)', 'TERAPIYA (ENDO + PLOMBA)', 'endo'],
  ['Pulpotomiya', 'ENDODONTIYA', 'endo'],
  ['Root canal treatment', null, 'endo'],
  ['Fotopolimer plomba (estetik)', 'TERAPIYA (ENDO + PLOMBA)', 'plomba'],
  ['Karies davolash (oddiy)', null, 'caries'],
  ['Implantat o\'rnatish', 'IMPLANTATSIYA', 'implant'],
  ['Shtif qo’yish', null, 'shtift'],
  ['Breketlar (keramika)', 'ORTODONTIYA', 'breket'],
  ['Metallokeramika karonka', 'ORTOPEDIYA', 'metal-keramika'],
  ['Zirkon toj', null, 'sirkon'],
  ['Tish olish', 'XIRURGIYA', 'missing'],
  ['Missing tooth', null, 'missing'],
  ["Yo'q", null, 'missing'],
  ['Edentulous ridge', null, 'missing'],
  ['olinadigan protez', 'ORTOPEDIYA', 'protez-syomniy'],
  ['Siyomniy protez', null, 'protez-syomniy'],
  ['Removable denture', null, 'protez-syomniy'],
  ['Babochka protez', null, 'protez-babochka'],
  ['Butterfly partial', null, 'protez-babochka'],
  ['Implant protez', 'IMPLANTATSIYA', 'protez-implant'],
  ['Implant karonka', null, 'protez-implant'],
];

for (const [name, cat, expected] of cases) {
  const got = matchIllustrationKind(name, cat);
  if (got !== expected) fail(`match(${name}, ${cat}) => ${got}, expected ${expected}`);
}

const live = pickIllustrationKindFromServices([
  { service_name: 'Karies davolash', category: 'TERAPIYA (ENDO + PLOMBA)' },
  { service_name: 'Kanal davolash (1 kanal)', category: 'ENDODONTIYA' },
], { preferLast: true });
if (live !== 'endo') fail(`live ENDO select => ${live}`);

if (normalizeFdi('ur6') !== '16') fail('ur6 should be 16');
if (normalizeFdi(36) !== '36') fail('36');
if (normalizeFdi(51) !== '11') fail('51 → 11');

const src = getToothIllustrationSrc(16, 'endo');
if (src !== `/teeth/endo/16.png?v=${TOOTH_ASSET_VERSION}`) fail(`src ${src}`);

const kind = resolveToothIllustrationKind({
  status: 'in_progress',
  illustrationKind: 'endo',
  serviceName: 'Kanal davolash',
});
if (kind !== 'endo') fail(`resolve ${kind}`);

if (getToothIllustrationSrc(16, 'missing') !== `/teeth/missing/16.png?v=${TOOTH_ASSET_VERSION}`) fail('missing src');
if (resolveToothIllustrationKind({ status: 'extracted' }) !== 'missing') fail('extracted → missing');
if (resolveToothIllustrationKind({ status: 'missing' }) !== 'missing') fail('status missing → missing');
if (resolveToothIllustrationKind({ status: 'extracted', isExtracted: true, hasImplant: true, serviceName: 'Implant' }) !== 'implant') {
  fail('extracted+implant should stay implant');
}
if (matchIllustrationKind('Kanal davolash (1 kanal)', 'ENDODONTIYA') !== 'endo') fail('endo unchanged');
if (matchIllustrationKind("Implantat o'rnatish", 'IMPLANTATSIYA') !== 'implant') fail('fixture implant unchanged');
if (resolveToothIllustrationKind({ status: 'extracted' }) !== 'missing') fail('missing unchanged');
if (getToothIllustrationSrc(21, 'protez-babochka') !== `/teeth/protez-babochka/21.png?v=${TOOTH_ASSET_VERSION}`) fail('babochka src');

if (failed) {
  console.error(`${failed} failure(s)`);
  process.exit(1);
}
console.log(`OK ${kinds.length} sets × ${fdis.length} FDI, mapping cases passed`);
