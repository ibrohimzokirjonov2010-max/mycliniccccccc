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
        tooth: String(svc.tooth_number || svc.tooth || plan.tooth_number || ''),
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
  const lines = [];
  for (const svc of selected || []) {
    if (left <= 0) break;
    const apply = Math.min(left, svc.remaining);
    if (apply <= 0) continue;
    left -= apply;
    lines.push(makePaidServiceLine({
      planId: svc.planId,
      planName: svc.plan?.name,
      tooth: svc.tooth,
      serviceName: svc.name,
      amount: apply,
    }));
    let group = groups.find((g) => String(g.planId) === String(svc.planId));
    if (!group) {
      group = { planId: svc.planId, apply: 0, covered: [] };
      groups.push(group);
    }
    group.apply += apply;
    if (apply >= svc.remaining) group.covered.push({ index: svc.index, name: svc.name });
  }
  return { groups, leftover: left, lines };
}

// ── "Qaysi xizmat(lar) uchun to'langan" - saved with the payment (hidden TECH_DATA notes block) ──

export function makePaidServiceLine({ planId, planName, tooth, serviceName, amount }) {
  return {
    plan_id: planId ?? '',
    plan_name: String(planName || '').slice(0, 120),
    tooth: String(tooth || '').slice(0, 40),
    service_name: String(serviceName || '').slice(0, 120),
    amount: Math.round(num(amount)),
  };
}

/** Lines for a payment made against a whole plan (its unpaid services oldest-first, then the plan itself). */
export function buildPlanPaidLines(row, amount) {
  if (!row) return [];
  const target = Math.min(Math.max(0, num(amount)), row.remaining);
  if (target <= 0) return [];
  const selected = row.services.map((svc) => ({ ...svc, planId: row.plan.id, plan: row.plan }));
  const { lines } = allocateSelectedServices(selected, target);
  const covered = lines.reduce((sum, l) => sum + l.amount, 0);
  if (target - covered > 0) {
    lines.push(makePaidServiceLine({
      planId: row.plan.id,
      planName: row.plan.name,
      tooth: row.plan.tooth_number,
      serviceName: '',
      amount: target - covered,
    }));
  }
  return lines;
}

/** Safe read of the stored value (array, JSON string or garbage) -> clean lines. */
export function normalizePaidServices(raw) {
  let value = raw;
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { return []; }
  }
  if (!Array.isArray(value)) return [];
  return value
    .filter((l) => l && typeof l === 'object' && num(l.amount) > 0)
    .map((l) => ({
      plan_id: l.plan_id ?? '',
      plan_name: String(l.plan_name || ''),
      tooth: String(l.tooth || ''),
      service_name: String(l.service_name || ''),
      amount: num(l.amount),
    }));
}

/** After the cashier edits the payment amount: never show more than the payment itself. */
export function rescalePaidServices(lines, newAmount) {
  let left = Math.max(0, num(newAmount));
  const out = [];
  for (const line of normalizePaidServices(lines)) {
    if (left <= 0) break;
    const amount = Math.min(line.amount, left);
    left -= amount;
    out.push({ ...line, amount });
  }
  return out;
}

/** Defensive: never show a raw [TECH_DATA]...[END_TECH] block as the cashier's note. */
export function stripHiddenTags(notes) {
  if (typeof notes !== 'string') return notes;
  return notes
    .replace(/\[TECH_DATA\][\s\S]*?\[END_TECH\]\n?/g, '')
    .replace(/\[PAID_SERVICES\][\s\S]*?\[END_PAID_SERVICES\]\n?/g, '')
    .trim();
}
