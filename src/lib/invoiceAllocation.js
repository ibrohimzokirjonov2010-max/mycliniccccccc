function planRemaining(plan) {
  return Math.max(0, (Number(plan?.total_price) || 0) - (Number(plan?.paid_amount) || 0));
}

function planTime(plan) {
  return String(plan?.created_date || plan?.created_at || plan?.date || plan?.start_date || '');
}

/**
 * Apply a payment across open invoices, oldest first.
 * When a chosen invoice can absorb the whole amount, only that invoice moves.
 */
export function allocateInvoicePayment(plans, amount, chosenPlanId = '') {
  const payment = Math.max(0, Number(amount) || 0);
  const open = (plans || [])
    .map((plan) => ({ plan, remaining: planRemaining(plan) }))
    .filter((row) => row.remaining > 0 && !['cancelled', 'canceled'].includes(String(row.plan?.status || '').toLowerCase()))
    .sort((a, b) => planTime(a.plan).localeCompare(planTime(b.plan)));

  if (!payment || open.length === 0) return [];

  const chosen = chosenPlanId
    ? open.find((row) => String(row.plan.id) === String(chosenPlanId))
    : null;

  if (chosen && payment <= chosen.remaining) {
    return [{
      id: chosen.plan.id,
      apply: payment,
      paid_amount: (Number(chosen.plan.paid_amount) || 0) + payment,
    }];
  }

  let left = payment;
  const slices = [];
  const order = chosen
    ? [chosen, ...open.filter((row) => row !== chosen)]
    : open;
  for (const row of order) {
    if (left <= 0) break;
    const apply = Math.min(left, row.remaining);
    slices.push({
      id: row.plan.id,
      apply,
      paid_amount: (Number(row.plan.paid_amount) || 0) + apply,
    });
    left -= apply;
  }
  return slices;
}
