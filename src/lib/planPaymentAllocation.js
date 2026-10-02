/**
 * Split a patient's income payments across their treatment plans so every payment is
 * counted exactly once.
 *
 *  1. A payment that carries a `plan_id` of an existing plan goes to that plan
 *     (up to the plan price - any excess is treated as unlinked money).
 *  2. Every other payment is unlinked money. It fills the oldest plan that still has a balance.
 *  3. Whatever is still left after all plans are full stays in `unallocated` (overpayment / prepayment).
 *
 * Invariant: sum(plan.paid) + unallocated === total paid by the patient.
 */

const isCancelledPlan = (plan) => ['cancelled', 'canceled'].includes(String(plan?.status || '').toLowerCase());

const planTime = (plan) => String(plan?.created_date || plan?.created_at || plan?.date || plan?.start_date || '');

/** Plans sorted by creation date (oldest first, stable). */
export function sortPlansByCreated(plans) {
  return (plans || [])
    .map((plan, index) => ({ plan, index }))
    .sort((a, b) => {
      const cmp = planTime(a.plan).localeCompare(planTime(b.plan));
      return cmp !== 0 ? cmp : a.index - b.index;
    })
    .map((row) => row.plan);
}

const incomeAmount = (payment) => {
  const type = String(payment?.type || 'Income').toLowerCase();
  const amount = Math.abs(Number(payment?.amount) || 0);
  if (type === 'income') return amount;
  if (type === 'refund') return -amount;
  return 0;
};

export function allocatePaymentsToPlans(plans, payments, { totalPaid = 0 } = {}) {
  const ordered = sortPlansByCreated(plans);
  const paidByPlan = new Map(ordered.map((plan) => [String(plan.id), 0]));
  const priceOf = (plan) => Number(plan?.total_price) || 0;

  let pool = 0;
  let sumPayments = 0;
  for (const payment of payments || []) {
    const amount = incomeAmount(payment);
    if (!amount) continue;
    sumPayments += amount;
    const key = payment?.plan_id != null ? String(payment.plan_id) : '';
    if (amount > 0 && key && paidByPlan.has(key)) {
      const plan = ordered.find((p) => String(p.id) === key);
      const room = Math.max(0, priceOf(plan) - paidByPlan.get(key));
      const applied = priceOf(plan) > 0 ? Math.min(amount, room) : amount;
      paidByPlan.set(key, paidByPlan.get(key) + applied);
      pool += amount - applied;
    } else {
      pool += amount;
    }
  }

  // Header total (patient.total_paid) can be higher than the visible rows - keep both in sync.
  const headerPaid = Number(totalPaid) || 0;
  if (headerPaid > sumPayments) pool += headerPaid - sumPayments;
  pool = Math.max(0, pool);

  for (const plan of ordered) {
    if (pool <= 0) break;
    if (isCancelledPlan(plan)) continue;
    const key = String(plan.id);
    const room = Math.max(0, priceOf(plan) - paidByPlan.get(key));
    if (room <= 0) continue;
    const applied = Math.min(room, pool);
    paidByPlan.set(key, paidByPlan.get(key) + applied);
    pool -= applied;
  }

  // Nothing recorded at all: fall back to the amount stored on the plan itself.
  const nothingRecorded = sumPayments === 0 && headerPaid === 0;
  const rows = ordered.map((plan) => {
    const price = priceOf(plan);
    const fromPlan = nothingRecorded ? Math.max(0, Number(plan.paid_amount) || 0) : 0;
    const paid = price > 0 ? Math.min(price, paidByPlan.get(String(plan.id)) + fromPlan) : paidByPlan.get(String(plan.id)) + fromPlan;
    return { plan, paid, remaining: Math.max(0, price - paid) };
  });

  return { rows, unallocated: Math.max(0, pool) };
}
