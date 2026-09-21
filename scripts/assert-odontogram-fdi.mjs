import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ADULT_FDI_ARCS,
  CHILD_FDI_ARCS,
  assertUniqueFdis,
  flattenArcs,
  internalIdToFdi,
  internalIdToFdiNumber,
} from '../src/lib/fdiNotation.js';

const ADULT_EXPECT = {
  upperRight: [18, 17, 16, 15, 14, 13, 12, 11],
  upperLeft: [21, 22, 23, 24, 25, 26, 27, 28],
  lowerLeft: [31, 32, 33, 34, 35, 36, 37, 38],
  lowerRight: [48, 47, 46, 45, 44, 43, 42, 41],
};

const CHILD_EXPECT = {
  upperRight: [55, 54, 53, 52, 51],
  upperLeft: [61, 62, 63, 64, 65],
  lowerLeft: [71, 72, 73, 74, 75],
  lowerRight: [85, 84, 83, 82, 81],
};

function same(a, b, name) {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    throw new Error(`${name} mismatch\n  got:      ${a.join(',')}\n  expected: ${b.join(',')}`);
  }
}

assertUniqueFdis(flattenArcs(ADULT_FDI_ARCS), 32);
assertUniqueFdis(flattenArcs(CHILD_FDI_ARCS), 20);

same(ADULT_FDI_ARCS.upperRight, ADULT_EXPECT.upperRight, 'adult upperRight');
same(ADULT_FDI_ARCS.upperLeft, ADULT_EXPECT.upperLeft, 'adult upperLeft');
same(ADULT_FDI_ARCS.lowerLeft, ADULT_EXPECT.lowerLeft, 'adult lowerLeft');
same(ADULT_FDI_ARCS.lowerRight, ADULT_EXPECT.lowerRight, 'adult lowerRight');

same(CHILD_FDI_ARCS.upperRight, CHILD_EXPECT.upperRight, 'child upperRight');
same(CHILD_FDI_ARCS.upperLeft, CHILD_EXPECT.upperLeft, 'child upperLeft');
same(CHILD_FDI_ARCS.lowerLeft, CHILD_EXPECT.lowerLeft, 'child lowerLeft');
same(CHILD_FDI_ARCS.lowerRight, CHILD_EXPECT.lowerRight, 'child lowerRight');

const idCases = [
  ['ur8', 18], ['ur3', 13], ['ur2', 12], ['ur1', 11],
  ['ul1', 21], ['ul2', 22], ['ul3', 23], ['ul8', 28],
  ['ll1', 31], ['ll8', 38],
  ['lr8', 48], ['lr1', 41],
  ['ur5c', 55], ['ur1c', 51], ['ul1c', 61], ['ul5c', 65],
  ['ll1c', 71], ['ll5c', 75], ['lr5c', 85], ['lr1c', 81],
];
for (const [id, fdi] of idCases) {
  if (internalIdToFdiNumber(id) !== fdi || internalIdToFdi(id) !== String(fdi)) {
    throw new Error(`id ${id} → expected ${fdi}, got ${internalIdToFdi(id)}`);
  }
}

const jsx = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/components/patients/ProfessionalOdontogram.jsx'),
  'utf8'
);
const tIds = [...jsx.matchAll(/\bT\('((?:ur|ul|lr|ll)\d+c?)'/g)].map((m) => m[1]);
const tFdis = tIds.map(internalIdToFdiNumber);
if (tIds.length !== 52) {
  throw new Error(`Expected 32 adult + 20 child T() entries, got ${tIds.length}`);
}
assertUniqueFdis(tFdis.slice(0, 32), 32);
assertUniqueFdis(tFdis.slice(32), 20);
same(tFdis.slice(0, 8), ADULT_EXPECT.upperRight, 'jsx UPPER_RIGHT T()');
same(tFdis.slice(8, 16), ADULT_EXPECT.upperLeft, 'jsx UPPER_LEFT T()');
same(tFdis.slice(16, 24), ADULT_EXPECT.lowerRight, 'jsx LOWER_RIGHT T()');
same(tFdis.slice(24, 32), ADULT_EXPECT.lowerLeft, 'jsx LOWER_LEFT T()');
same(tFdis.slice(32, 37), CHILD_EXPECT.upperRight, 'jsx CHILD_UPPER_RIGHT T()');
same(tFdis.slice(37, 42), CHILD_EXPECT.upperLeft, 'jsx CHILD_UPPER_LEFT T()');
same(tFdis.slice(42, 47), CHILD_EXPECT.lowerRight, 'jsx CHILD_LOWER_RIGHT T()');
same(tFdis.slice(47, 52), CHILD_EXPECT.lowerLeft, 'jsx CHILD_LOWER_LEFT T()');

if (!jsx.includes('{fdiLabel}')) {
  throw new Error('ToothColumn must render {fdiLabel}');
}
if (/>\{fdi\}<\/div>/.test(jsx)) {
  throw new Error('Raw {fdi} label chip is back — use fdiLabel so 13/23 cannot be covered');
}

console.log('FDI notation OK');
console.log('adult UR', ADULT_FDI_ARCS.upperRight.join(' '));
console.log('adult UL', ADULT_FDI_ARCS.upperLeft.join(' '));
console.log('adult LL', ADULT_FDI_ARCS.lowerLeft.join(' '));
console.log('adult LR', ADULT_FDI_ARCS.lowerRight.join(' '));
console.log('child UR', CHILD_FDI_ARCS.upperRight.join(' '));
console.log('child UL', CHILD_FDI_ARCS.upperLeft.join(' '));
console.log('child LL', CHILD_FDI_ARCS.lowerLeft.join(' '));
console.log('child LR', CHILD_FDI_ARCS.lowerRight.join(' '));
console.log('ProfessionalOdontogram T() arcs OK');
