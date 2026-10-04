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

export function planPrice(plan) {
  return PLAN_PRICES_UZS[normalizePlan(plan)];
}
