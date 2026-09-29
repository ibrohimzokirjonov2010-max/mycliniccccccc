import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computePatientBalances, unionPayments } from '../src/lib/paymentDebt.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const plans = [{ patient_id: 'z', total_price: 2915000 }];
const linkedDebt = {
  id: 'debt',
  patient_id: 'z',
  type: 'Debt',
  amount: 2915000,
  created_date: '2026-09-29T12:28:10Z',
  notes: 'Linked to Plan: treatmentplan-upqsvy7lf',
};
const incomes = [
  { id: 'p180', patient_id: 'z', type: 'Income', amount: 180, created_date: '2026-09-29T12:39:26Z' },
  { id: 'p300', patient_id: 'z', type: 'Income', amount: 300000, created_date: '2026-09-29T12:39:39Z' },
  { id: 'p1200', patient_id: 'z', type: 'Income', amount: 1200000, created_date: '2026-09-29T12:40:17Z' },
];

const stale = computePatientBalances([linkedDebt], plans);
assert(stale.totals.z.currentDebt === 2915000, 'stale cache without incomes stays on the plan total');

const live = computePatientBalances(unionPayments([linkedDebt], incomes), plans);
assert(live.totals.z.currentDebt === 1414820, `current debt ${live.totals.z.currentDebt}`);
assert(live.totals.z.totalPaid === 1500180, `paid ${live.totals.z.totalPaid}`);
assert(live.balances.p1200.debtAtTime === 1414820, 'latest remainder');
assert(live.balances.p300.debtAtTime === 2614820, '300k remainder');
assert(live.balances.p180.debtAtTime === 2914820, '180 remainder keeps the 180 payment');

const overridden = unionPayments(
  [{ id: 'p180', patient_id: 'z', type: 'Income', amount: 1 }],
  [{ id: 'p180', patient_id: 'z', type: 'Income', amount: 180 }],
);
assert(overridden.find((row) => row.id === 'p180').amount === 180, 'later list wins');

const paymentsJs = readFileSync(join(root, 'src/pages/Payments.jsx'), 'utf8');
assert(paymentsJs.includes('unionPayments(balancePayments, payments)'), 'desktop balance source must union');
assert(!paymentsJs.includes('balancePayments.length ? balancePayments : payments'), 'stale preference removed');
assert(paymentsJs.includes("invalidateQueries({ queryKey: ['payment-balance-source'] })"), 'balance cache invalidated');
assert(paymentsJs.includes("savedPatientId !== 'patient-y2ii8ynf2'"), 'test patient still skipped on save');

const mobileJs = readFileSync(join(root, 'src/pages/MobilePaymentsV2.jsx'), 'utf8');
assert(mobileJs.includes('unionPayments(allPays, payments)'), 'mobile balance source must union');

const profileJs = readFileSync(join(root, 'src/pages/PatientProfile.jsx'), 'utf8');
assert(profileJs.includes('debt-sync-after-payments-loaded'), 'profile sync waits for payments');
assert(profileJs.includes("patient.id === 'patient-y2ii8ynf2'"), 'test patient still skipped on profile sync');

console.log('payment debt union ok');
