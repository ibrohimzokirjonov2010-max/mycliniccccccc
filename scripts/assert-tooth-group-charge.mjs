import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeOncePricedPlan, onceGroupKind, staleEncodedOnceTotal, toothGroupBilling, toothGroupCharge, withOncePricing } from '../src/lib/toothPlanCharge.js';
import { buildJawPlanLines, expandJawToothNumbers, jawFamily, jawMarkForService, jawPlanTotal } from '../src/lib/jawServices.js';

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
assert(chart.includes('openJawPrompt'), 'braces open a jaw choice');
assert(!chart.includes('TreatmentPlan.create'), 'the tooth chart does not create a plan by itself');
assert(chart.includes('markFindings'), 'quick marks save a finding, not a plan');
assert(chart.includes('appendLinesToActivePlan'), 'add-to-plan appends to the one open plan');
assert(chart.includes('data-jaw-choice') || chart.includes('JawChoice'), 'jaw choice is shown on the chart');
assert(!chart.includes("createPlan(selected, 'Breket tizimi'"), 'braces are not applied to the selected teeth');
assert(chart.includes("Ko‘prik (protez)"), 'a bridge stays a selected-teeth action');
assert(chart.includes('patient.id === \'patient-y2ii8ynf2\''), 'test patient is not written from the chart');
assert(!chart.includes('const total = price * fdis.length'), 'unchecked multiplication removed');

const jawLines = buildJawPlanLines('breket', 'both', [{ name: 'Keramik breket tizimi', price: 7000000 }]);
assert(jawLines.length === 2, 'both jaws are two lines');
assert(jawLines[0].service_name === "Breket — tepa jag'", jawLines[0].service_name);
assert(jawLines[1].service_name === "Breket — pastki jag'", jawLines[1].service_name);
assert(jawPlanTotal(jawLines) === 14000000, 'two jaws are 7M + 7M');
assert(jawPlanTotal(jawLines) !== 7000000 * 32, 'jaw fee is not multiplied by tooth count');
assert(expandJawToothNumbers('upper').includes(18) && expandJawToothNumbers('upper').includes(28), 'upper jaw marks 18–28');
assert(expandJawToothNumbers('lower').includes(31) && expandJawToothNumbers('lower').includes(48), 'lower jaw marks 31–48');
assert(jawFamily("Ko‘prik (protez)") === null, 'a fixed bridge is not a jaw service');
assert(jawFamily('Babochka protez') === 'babochka', 'butterfly denture is a jaw service');
assert(onceGroupKind("Breket — tepa jag'") !== onceGroupKind("Breket — pastki jag'"), 'each jaw is its own fee');

const bothJaws = normalizeOncePricedPlan({
  name: "Breket — tepa jag', Breket — pastki jag'",
  total_price: 14000000,
  services: jawLines,
});
assert(bothJaws.total_price === 14000000, 'two jaw lines stay two fees');
assert(bothJaws.services[1].price === 7000000, 'the lower jaw keeps its fee');

const upperOnly = buildJawPlanLines('breket', 'upper', [{ name: 'Keramik breket tizimi', price: 7000000 }]);
assert(upperOnly.length === 1 && jawPlanTotal(upperOnly) === 7000000, 'upper jaw is one fee');
assert(buildJawPlanLines('babochka', 'upper', []).length === 1, 'babochka still makes one jaw line');
assert(jawPlanTotal(buildJawPlanLines('babochka', 'both', [])) === 0, 'babochka has no catalog price');
assert(jawPlanTotal(buildJawPlanLines('protez', 'upper', [{ name: 'olinadigan protez', price: 1200000 }])) === 1200000, 'full denture reuses olinadigan protez');
const lowerLine = jawMarkForService(
  { service_name: "Breket — pastki jag'", tooth_number: "Pastki jag'" },
  { name: "Breket — tepa jag', Breket — pastki jag'" },
);
assert(lowerLine && lowerLine.scope === 'lower' && lowerLine.family === 'breket', 'a both-jaws plan name does not hide the lower line');

const multiplied = {
  name: 'Breket tizimi',
  total_price: 7000000 * 16,
  services: Array.from({ length: 16 }, (_, index) => ({
    service_name: 'Breket tizimi',
    tooth_number: String(11 + index),
    price: 7000000,
    category: 'breket',
  })),
};
const collapsed = normalizeOncePricedPlan(multiplied);
assert(collapsed.total_price === 7000000, `stored 112M collapses to ${collapsed.total_price}`);
assert(collapsed.services.filter((row) => row.price === 7000000).length === 1, 'one braces line keeps the fee');
assert(collapsed.services.filter((row) => row.price === 0).length === 15, 'other braces lines are zero');

const alreadyPricedOnce = normalizeOncePricedPlan({ ...multiplied, total_price: 7000000 });
assert(alreadyPricedOnce.total_price === 7000000, 'column 7M stays 7M');
assert(alreadyPricedOnce.services.filter((row) => row.price === 7000000).length === 1, 'repeated 7M lines still collapse');

const mixed = normalizeOncePricedPlan({
  name: 'Davolash rejasi',
  total_price: 2915000,
  services: [
    { service_name: 'E-Max Vinir', price: 2200000 },
    { service_name: 'Metallokeramika karonka', price: 800000 },
    { service_name: 'Karies', price: 200000 },
  ],
});
assert(mixed.total_price === 2915000, 'mixed plan total stays');
assert(mixed.services[1].price === 800000, 'crown line is not zeroed');

const plans = withOncePricing([
  collapsed,
  { total_price: 2915000, services: [{ service_name: 'Karies', price: 200000 }] },
  { total_price: 200000, services: [{ service_name: 'Karies', price: 200000 }] },
  { total_price: 200000, services: [{ service_name: 'Karies', price: 200000 }] },
]);
const planTotal = plans.reduce((sum, plan) => sum + Number(plan.total_price), 0);
assert(planTotal - 1500180 === 8814820, `Zohid debt ${planTotal - 1500180}`);

const staleNotes = `[TECH_DATA]${JSON.stringify({ name: 'Breket tizimi', total_price: 112000000, services: multiplied.services })}[END_TECH]`;
assert(staleEncodedOnceTotal(staleNotes, { name: 'Breket tizimi', total_price: 7000000, services: collapsed.services }), 'notes 112M is stale');
assert(!staleEncodedOnceTotal(staleNotes, mixed), 'a mixed plan is not rewritten from braces notes');

const profile = readFileSync(join(root, 'src/pages/PatientProfile.jsx'), 'utf8');
assert(profile.includes('isOncePricingDirty'), 'profile rewrites a multiplied braces plan');
assert(profile.includes("id !== 'patient-y2ii8ynf2'"), 'locked test patient is not rewritten');
const chair = readFileSync(join(root, 'src/components/patients/ChairsidePatientProfile.jsx'), 'utf8');
const chartAt = chair.indexOf('data-tooth-chart="chairside"');
const toolsAt = chair.indexOf('<ChairsideClinicalTools');
const planAt = chair.indexOf('data-chairside-plan="true"');
assert(chartAt !== -1 && chartAt < toolsAt && toolsAt < planAt, 'tooth chart is above RVG and the plan bar');

console.log('tooth group charge ok');
