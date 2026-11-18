import fs from 'node:fs';
import {
  monthlyPrice,
  isPaidSubscription,
  subscriptionHeadline,
  serverRowsToLedger,
  ledgerFromLastPayments,
  normalizeClinicBilling,
} from '../src/utils/superAdminBilling.js';
import { patientBalance, debtByPatient } from '../src/lib/patientBalance.js';
import { doctorEarnings } from '../src/lib/payrollEarnings.js';

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error('FAIL', msg);
  }
}

const now = new Date(2026, 10, 18, 12, 0, 0);
const clinics = [
  { id: 'ava-dent', name: 'Ava Dent', plan: 'pro', monthly_fee: 500000, status: 'Active', subscription_status: 'active', expires_at: '2027-06-01', last_payment_date: '2026-11-01' },
  { id: 'default_clinic', name: 'Ibrohim Dent', plan: 'premium', monthly_fee: 0, status: 'Active', subscription_status: 'active', expires_at: '2030-01-01', last_payment_date: '2026-10-01' },
  { id: 'trial-clinic', name: 'Sinov', plan: 'basic', monthly_fee: 0, status: 'Active', subscription_status: 'trialing', trial_ends_at: '2026-12-02', expires_at: '2026-12-02' },
  { id: 'old-clinic', name: 'Eski', plan: 'pro', monthly_fee: 189000, status: 'Active', expires_at: '2026-01-01', last_payment_date: '2025-12-01' },
];

assert(monthlyPrice(clinics[0]) === 500000, 'custom price wins');
assert(monthlyPrice(clinics[1]) === 349000, 'premium catalog when fee is empty');
assert(isPaidSubscription(clinics[1], now), 'ibrohim is a paid subscription');
assert(!isPaidSubscription(clinics[2], now), 'trial is not MRR');
assert(!isPaidSubscription(clinics[3], now), 'expired is not MRR');
const headline = subscriptionHeadline(clinics, now);
assert(headline.paid === 2 && headline.total === 4, `paid count ${headline.paid}/${headline.total}`);
assert(headline.mrr === 849000, `mrr ${headline.mrr}`);

const activeForm = normalizeClinicBilling({
  id: 'star_med',
  name: 'Star',
  plan: 'pro',
  monthly_fee: 189000,
  subscription_status: 'active',
  status: 'Active',
  expires_at: '2026-12-18',
  owner_email: 'owner@star.uz',
  owner_phone: '+998 90 000 00 01',
  signup_source: 'manual',
}, now);
assert(activeForm.subscription_status === 'active', 'chosen Faol stays active');
assert(activeForm.expires_at === '2026-12-18', `chosen expiry kept ${activeForm.expires_at}`);
assert(activeForm.owner_email === 'owner@star.uz' && activeForm.owner_phone === '+998 90 000 00 01', 'owner contacts stay on the form');

const ledger = serverRowsToLedger(
  [{ id: 7, clinic_id: 'ava-dent', amount: 500000, status: 'paid', provider: 'payme', provider_txn_id: 'tx1', paid_at: '2026-11-01T00:00:00Z', created_at: '2026-11-01T00:00:00Z' }],
  [{ id: 'c1', clinic_id: 'default_clinic', amount: 349000, status: 'success', attempt_date: '2026-10-01', transaction_parameter: 'ch1', created_at: '2026-10-01T00:00:00Z' }],
  clinics,
);
assert(ledger.length === 2 && ledger.every((row) => row.amount > 0), `ledger rows ${ledger.length}`);
const dated = ledgerFromLastPayments(
  [{ id: 'solo', name: 'Solo', plan: 'basic', monthly_fee: 0, last_payment_date: '2026-09-01' }],
  [],
);
assert(dated.length === 1 && dated[0].amount === 99000 && dated[0].status === 'paid', 'last payment date fills an empty ledger');

const partial = patientBalance('p1', [
  { id: 'd1', patient_id: 'p1', type: 'Debt', amount: 30000 },
  { id: 'i1', patient_id: 'p1', type: 'Income', amount: 20000 },
], []);
assert(partial.debt === 10000, `partial debt ${partial.debt}`);

const planPay = patientBalance('p1', [
  { id: 'd1', patient_id: 'p1', type: 'Debt', amount: 30000, plan_id: 'plan1' },
  { id: 'i1', patient_id: 'p1', type: 'Income', amount: 20000 },
], [
  { id: 'plan1', patient_id: 'p1', status: 'In Progress', total_price: 30000 },
]);
assert(planPay.debt === 10000 && planPay.charges === 30000, `plan+linked debt ${planPay.debt}/${planPay.charges}`);

const pending = patientBalance('p1', [], [
  { id: 'plan2', patient_id: 'p1', status: 'Planned', total_price: 30000, notes: 'Uchrashuv orqali yaratilgan' },
]);
assert(pending.debt === 0, 'pending appointment plan is not debt yet');

const map = debtByPatient(
  [{ id: 'p1', total_debt: 0 }],
  [{ id: 'i1', patient_id: 'p1', type: 'Income', amount: 20000 }, { id: 'd1', patient_id: 'p1', type: 'Debt', amount: 30000 }],
  [],
);
assert(map.p1 === 10000, `qarzlar map ${map.p1}`);

const earned = doctorEarnings({
  doctor: { id: 'doc1', name: 'Dr Ali', commission_rate: 30 },
  payments: [],
  appointments: [{ id: 'a1', doctor_id: 'doc1', patient_id: 'p1', patient_name: 'Bemor', status: 'Completed', price: 100000, date: '2026-11-18' }],
  start: '2026-11-01',
  end: '2026-11-30',
});
assert(earned.income === 100000 && earned.commission === 30000 && earned.patients === 1, `payroll ${earned.income}/${earned.commission}/${earned.patients}`);

const patientsPage = fs.readFileSync(new URL('../src/pages/Patients.jsx', import.meta.url), 'utf8');
const debtsPage = fs.readFileSync(new URL('../src/pages/MobileDebts.jsx', import.meta.url), 'utf8');
assert(patientsPage.includes('formatPhone(phone)') && !patientsPage.includes("digits.startsWith('998')"), 'patients phone uses the shared formatter');
assert(!debtsPage.includes("digits.slice(8, 10)}-"), 'mobile debts no longer uses a dashed phone');
assert(fs.readFileSync(new URL('../api/admin.js', import.meta.url), 'utf8').includes('set-admin-password'), 'admin password endpoint exists');
assert(fs.readFileSync(new URL('../supabase/migrations/20261118150000_users_clinic_username_unique.sql', import.meta.url), 'utf8').includes('uq_users_clinic_username'), 'username migration file');

if (failed) {
  console.error(`${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('qa fix assertions passed');
