import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { toothGroupBilling, toothGroupCharge } from '../src/lib/toothPlanCharge.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const braces = toothGroupCharge(7000000, 16, toothGroupBilling('breket'));
assert(braces.billing === 'once', 'braces bill once');
assert(braces.total === 7000000, `braces total ${braces.total}`);
assert(braces.linePrices[0] === 7000000 && braces.linePrices.slice(1).every((n) => n === 0), 'only the first braces line carries the fee');
assert(braces.total !== 7000000 * 16, '16 teeth must not become 112 000 000');

const filling = toothGroupCharge(200000, 2, toothGroupBilling('same'));
assert(filling.total === 400000, 'per-tooth treatment still multiplies');

const chart = readFileSync(join(root, 'src/components/patients/ToothChartCard.jsx'), 'utf8');
assert(chart.includes("createPlan(selected, 'Breket tizimi', 'breket', 'once')"), 'braces button bills once');
assert(chart.includes('patient.id === \'patient-y2ii8ynf2\''), 'test patient is not written from the chart');
assert(!chart.includes('const total = price * fdis.length'), 'unchecked multiplication removed');

console.log('tooth group charge ok');
