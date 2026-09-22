import fs from 'node:fs';
import {
  PLAN_CATALOG,
  LEGACY_FEES,
  LANDING_TARIFFS,
  catalogAmount,
  isCustomMonthly,
  resolveLifecycle,
  extendExpiry,
  buildPaymentEntry,
  mergeLedgers,
  normalizeClinicBilling,
  stripAdminFields,
} from '../src/utils/superAdminBilling.js';

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error('FAIL', msg);
  }
}

const now = new Date(2026, 8, 22, 12, 0, 0);

const trial = resolveLifecycle({
  status: 'Active',
  subscription_status: 'trialing',
  trial_ends_at: '2026-10-06',
  expires_at: '2026-10-06',
}, now);
assert(trial.key === 'trialing' && trial.badge === 'trial', `trial key ${trial.key}`);

const expiringTrial = resolveLifecycle({
  status: 'Active',
  subscription_status: 'trialing',
  trial_ends_at: '2026-09-28',
  expires_at: '2026-09-28',
}, now);
assert(expiringTrial.key === 'expiring' && expiringTrial.trial, `expiring trial ${expiringTrial.key}`);

const active = resolveLifecycle({
  status: 'Active',
  subscription_status: 'active',
  expires_at: '2026-12-31',
  last_payment_date: '2026-09-01',
}, now);
assert(active.key === 'active', `active ${active.key}`);

const forcedActive = resolveLifecycle({
  status: 'Active',
  subscription_status: 'active',
  expires_at: '2026-12-31',
  last_payment_date: '2025-10-01',
}, now);
assert(forcedActive.key === 'active', `explicit active overrides stale ${forcedActive.key}`);

const pastDue = resolveLifecycle({
  status: 'Active',
  expires_at: '2026-12-31',
  last_payment_date: '2025-10-01',
}, now);
assert(pastDue.key === 'past_due', `past due ${pastDue.key}`);

const expired = resolveLifecycle({
  status: 'Active',
  expires_at: '2026-01-01',
  last_payment_date: '2025-12-01',
}, now);
assert(expired.key === 'expired', `expired ${expired.key}`);

const legacy = resolveLifecycle({ status: 'Active', plan: 'pro' }, now);
assert(legacy.key === 'active', `legacy unlimited ${legacy.key}`);

assert(catalogAmount('basic') === 99000, 'basic price');
assert(catalogAmount('pro') === 189000, 'pro price');
assert(PLAN_CATALOG.basic.landing.includes('Start'), 'start map');
assert(PLAN_CATALOG.pro.landing.join(',').includes('Klinika'), 'klinika map');
assert(isCustomMonthly({ plan: 'pro', monthly_fee: 250000 }) === true, 'custom fee');
assert(isCustomMonthly({ plan: 'basic', monthly_fee: 99000 }) === false, 'catalog basic');
assert(isCustomMonthly({ plan: 'pro', monthly_fee: 1990000 }) === false, 'landing pro is known');
assert(isCustomMonthly({ plan: 'pro', monthly_fee: 3490000 }) === false, 'landing klinika is known');
assert(isCustomMonthly({ plan: 'basic', monthly_fee: 990000 }) === false, 'landing start is known');

const tariffFile = JSON.parse(fs.readFileSync(new URL('../landing/config/shifo-tariffs.json', import.meta.url), 'utf8'));
assert(tariffFile.legacyPortalMonthlyFee.basic === LEGACY_FEES.basic, 'legacy basic matches landing config');
assert(tariffFile.legacyPortalMonthlyFee.pro === LEGACY_FEES.pro, 'legacy pro matches landing config');
tariffFile.tariffs.forEach((plan) => {
  const known = LANDING_TARIFFS.find((row) => row.id === plan.id);
  assert(known && known.priceUzs === plan.priceUzs && known.crmPlan === plan.crmPlan, `tariff drift ${plan.id}`);
});

assert(extendExpiry('2026-12-31', 30, now) === '2027-01-30', `extend future ${extendExpiry('2026-12-31', 30, now)}`);
assert(extendExpiry('2020-01-01', 30, now) === '2026-10-22', `extend past ${extendExpiry('2020-01-01', 30, now)}`);

const entry = buildPaymentEntry({
  clinic: { id: 'ava-dent', name: 'Ava', payme_merchant_id: 'm1' },
  amount: 189000,
  method: 'payme',
  periodDays: 30,
  now,
});
assert(entry.method === 'payme' && entry.webhook_status === 'received' && entry.period_days === 30, 'payme entry');
assert(entry.date === '2026-09-22' && entry.paidAt === '2026-09-22' && entry.amountUzs === 189000, `entry shape ${entry.date}`);

const bare = buildPaymentEntry({
  clinic: { id: 'x', name: 'X' },
  amount: 1000,
  method: 'click',
  periodDays: 30,
  now,
});
assert(bare.webhook_status === 'not_configured', `click webhook ${bare.webhook_status}`);

const manual = buildPaymentEntry({
  clinic: { id: 'x', name: 'X' },
  amount: 0,
  method: 'manual',
  periodDays: 30,
  now,
});
assert(manual.webhook_status === 'not_required', 'manual webhook');

const merged = mergeLedgers(
  [{ id: 'a', name: 'A', payment_ledger: [{ id: 'p1', date: '2026-09-01', amount: 1 }] }],
  [
    { id: 'p1', date: '2026-09-01', amount: 9, clinic_id: 'a' },
    { id: 'p2', created_at: '2026-09-02T00:00:00.000Z', amount: 2, clinic_id: 'a', clinic_name: 'A' },
  ],
);
assert(merged.length === 2 && merged[0].id === 'p2', `merge ${merged.map((row) => row.id).join(',')}`);

const landingRow = mergeLedgers([{
  id: 'c0123abcd',
  name: 'Smile',
  payment_ledger: [{
    id: 'pay-ORDER',
    amountUzs: 1990000,
    method: 'payme',
    paidAt: '2026-09-22',
    subscriptionStatus: 'active',
    orderId: 'ORDER',
    note: 'Pro to\'lovi',
  }, {
    id: 'trial-lead',
    amountUzs: 0,
    method: 'trial',
    paidAt: '2026-09-01',
    subscriptionStatus: 'trialing',
    orderId: null,
    note: 'Bepul sinov',
  }],
}], []);
const paidLanding = landingRow.find((row) => row.id === 'pay-ORDER');
const trialLanding = landingRow.find((row) => row.id === 'trial-lead');
assert(paidLanding.amount === 1990000 && paidLanding.date === '2026-09-22' && paidLanding.status === 'paid' && paidLanding.webhook_status === 'received', 'landing payme row');
assert(trialLanding.status === 'trial' && trialLanding.method === 'trial' && trialLanding.webhook_status === 'not_required', 'landing trial row');

const trialForm = normalizeClinicBilling({
  id: 'star',
  name: 'Star',
  password: 'secret',
  plan: 'basic',
  monthly_fee: '150000',
  subscription_status: 'trialing',
  status: 'Active',
  admin_password: 'should-not-stick',
}, now);
assert(trialForm.trial_ends_at === '2026-10-06', `trial end ${trialForm.trial_ends_at}`);
assert(trialForm.expires_at === '2026-10-06', `trial expiry ${trialForm.expires_at}`);
assert(trialForm.monthly_fee === 150000, 'custom fee kept');
assert(trialForm.plan === 'basic', 'plan kept');
const stripped = stripAdminFields(trialForm);
assert(!('admin_password' in stripped), 'admin password stripped');
assert(stripped.password === 'secret', 'clinic password kept for login handoff');

const expiredForm = normalizeClinicBilling({
  subscription_status: 'expired',
  expires_at: '2026-12-31',
  plan: 'pro',
  monthly_fee: 189000,
}, now);
assert(expiredForm.expires_at === '2026-09-21', `forced expiry ${expiredForm.expires_at}`);

if (failed) {
  console.error(`${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('superadmin billing assertions passed');
