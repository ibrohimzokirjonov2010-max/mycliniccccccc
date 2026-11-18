/**
 * Server tomonidagi tarif narxlari (so'm/oy).
 * src/utils/superAdminBilling.js (LANDING_TARIFFS / LEGACY_FEES) bilan bir xil bo'lishi shart:
 * scripts/assert-card-binding.mjs buni tekshiradi.
 */
export const PLAN_PRICES_UZS = { basic: 99000, pro: 189000, premium: 349000 };

export function normalizePlan(plan) {
  const p = String(plan || '').toLowerCase();
  if (p === 'premium' || p === 'klinika') return 'premium';
  if (p === 'basic' || p === 'start') return 'basic';
  return 'pro';
}

/** Self-serve signup. Empty or unknown values stay on basic, not pro. */
export function signupPlan(plan) {
  const p = String(plan || '').toLowerCase();
  if (p === 'premium' || p === 'klinika') return 'premium';
  if (p === 'pro') return 'pro';
  return 'basic';
}

export function planPrice(plan) {
  return PLAN_PRICES_UZS[normalizePlan(plan)];
}

/** Plan used for access checks. Empty or unknown values stay basic. */
export function accessPlan(clinic) {
  let tariff = '';
  const logo = String(clinic?.logo || '');
  if (logo.startsWith('[EXT]')) {
    const end = logo.indexOf('[/EXT]');
    if (end > 5) {
      try {
        tariff = String(JSON.parse(logo.slice(5, end))?.tariff || '').trim().toLowerCase();
      } catch {
        tariff = '';
      }
    }
  }
  const raw = tariff || String(clinic?.plan || '').trim().toLowerCase();
  if (raw === 'premium' || raw === 'klinika') return 'premium';
  if (raw === 'pro') return 'pro';
  return 'basic';
}

const PRO_FEATURES = new Set([
  'leads', 'expenses', 'payroll', 'inventory', 'reports', 'no_show',
  'treatment_tracking', 'technicians', 'staff', 'implants', 'marketing',
  'cases', 'doctor_accounts',
]);

export function planAllows(plan, feature) {
  if (!PRO_FEATURES.has(feature)) return true;
  return plan === 'pro' || plan === 'premium';
}
