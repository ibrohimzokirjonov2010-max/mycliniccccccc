/**
 * Payment modal helpers: which treatment plans / services still have a balance,
 * and how a payment is split across the services the cashier ticked.
 * UI/logic only - no DB schema involved (plan.paid_amount + service.payment_status as before).
 */

const isCancelledPlan = (plan) => ['cancelled', 'canceled'].includes(String(plan?.status || '').toLowerCase());
const num = (v) => Number(v) || 0;

export const serviceKey = (planId, index) => `${planId}:${index}`;

/**
 * Plans that still have a balance (fully paid / cancelled plans are dropped) with their
 * unpaid services. Plan-level paid_amount is spread over the services oldest-first, so a
 * partly paid service shows only its remaining part.
 * Row: { plan, total, paid, remaining, services: [{ key, index, name, price, paid, remaining }] }
 */
export function getPlanPayRows(plans) {
  const rows = [];
  for (const plan of plans || []) {
    if (!plan || isCancelledPlan(plan)) continue;
    const total = num(plan.total_price);
    const paid = Math.min(total, Math.max(0, num(plan.paid_amount)));
    const remaining = Math.max(0, total - paid);
    if (remaining <= 0) continue;

    const all = Array.isArray(plan.services) ? plan.services : [];
    const flaggedPaid = all.reduce(
      (sum, svc) => (svc?.payment_status === 'paid' ? sum + num(svc.price) : sum),
      0,
    );
    let pool = Math.max(0, paid - flaggedPaid);
    let budget = remaining;
    const services = [];
    all.forEach((svc, index) => {
      if (!svc || svc.payment_status === 'paid') return;
      const price = num(svc.price);
      if (price <= 0) return;
      const svcPaid = Math.min(price, pool);
      pool -= svcPaid;
      const left = Math.min(price - svcPaid, budget);
      if (left <= 0) return;
      budget -= left;
      services.push({
        key: serviceKey(plan.id, index),
        index,
        name: svc.service_name || svc.name || '—',
        price,
        paid: Math.max(0, price - left),
        remaining: left,
      });
    });

    rows.push({ plan, total, paid, remaining, services });
  }
  return rows;
}

/** Ticked services (keeps plan order) with their plan attached. */
export function pickSelectedServices(rows, keys) {
  const wanted = new Set(keys || []);
  const out = [];
  for (const row of rows || []) {
    for (const svc of row.services) {
      if (wanted.has(svc.key)) out.push({ ...svc, planId: row.plan.id, plan: row.plan });
    }
  }
  return out;
}

/**
 * Split `amount` over the ticked services in order.
 * groups: per plan -> money applied + services that got fully covered (to flag as paid).
 * leftover: money above the ticked balance (goes to the generic oldest-plan allocation).
 */
export function allocateSelectedServices(selected, amount) {
  let left = Math.max(0, num(amount));
  const groups = [];
  for (const svc of selected || []) {
    if (left <= 0) break;
    const apply = Math.min(left, svc.remaining);
    if (apply <= 0) continue;
    left -= apply;
    let group = groups.find((g) => String(g.planId) === String(svc.planId));
    if (!group) {
      group = { planId: svc.planId, apply: 0, covered: [] };
      groups.push(group);
    }
    group.apply += apply;
    if (apply >= svc.remaining) group.covered.push({ index: svc.index, name: svc.name });
  }
  return { groups, leftover: left };
}
