/**
 * One discount rule for the new-patient wizard (step 2 total, Yakun qarz,
 * invoice Jami, saved plan total_price and patient debt all use this).
 */
export function splitDiscount(total, percent) {
  const gross = Math.max(0, Math.round(Number(total) || 0));
  const pct = Math.max(0, Math.min(100, Number(percent) || 0));
  const amount = Math.round((gross * pct) / 100);
  return { gross, percent: pct, amount, final: Math.max(0, gross - amount) };
}

export default splitDiscount;
