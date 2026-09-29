/** One running balance for desktop and mobile payments. */

function paymentSortKey(payment) {
  return String(payment?.created_at || payment?.created_date || (payment?.date ? `${payment.date}T00:00:00Z` : ''));
}

export function isLinkedPlanInternal(payment, type) {
  if (type !== 'debt' && type !== 'discount') return false;
  const notes = String(payment?.notes || '').toLowerCase();
  return Boolean(
    payment?.plan_id
    || notes.includes('linked to plan')
    || notes.includes('reja:')
    || notes.includes('avtomatik chegirma')
    || notes.includes('reja yangilandi')
  );
}

/**
 * Merge payment lists by id. Later groups win, so the rows just saved on screen
 * override a stale balance-cache snapshot that has not been refetched yet.
 */
export function unionPayments(...groups) {
  const byId = new Map();
  for (const group of groups) {
    for (const row of group || []) {
      if (!row) continue;
      const key = row.id || `${row.patient_id}|${row.created_date || row.date}|${row.amount}|${row.type}`;
      const prev = byId.get(key);
      byId.set(key, prev ? { ...prev, ...row } : row);
    }
  }
  return [...byId.values()];
}

/** Rows that belong on the payments list (not plan bookkeeping). */
export function isListedPayment(payment) {
  const type = String(payment?.type || 'Income').toLowerCase();
  if (isLinkedPlanInternal(payment, type)) return false;
  return type === 'income' || type === 'expense' || type === 'refund';
}

/**
 * Start from the patient's treatment-plan total, then walk payments in time order.
 * Plan-linked debt and discount rows are bookkeeping and do not change the balance again.
 */
export function computePatientBalances(payments, treatmentPlans = []) {
  const byPatient = {};
  for (const payment of payments || []) {
    if (!payment?.patient_id) continue;
    if (!byPatient[payment.patient_id]) byPatient[payment.patient_id] = [];
    byPatient[payment.patient_id].push(payment);
  }

  const plansByPatient = {};
  for (const plan of treatmentPlans || []) {
    if (!plan?.patient_id) continue;
    plansByPatient[plan.patient_id] = (plansByPatient[plan.patient_id] || 0) + (Number(plan.total_price) || 0);
  }

  const balances = {};
  const totals = {};

  for (const [patientId, rows] of Object.entries(byPatient)) {
    const sorted = [...rows].sort((a, b) => paymentSortKey(a).localeCompare(paymentSortKey(b)));
    const totalPlansPrice = plansByPatient[patientId] || 0;
    let runningDebt = totalPlansPrice > 0 ? totalPlansPrice : 0;
    let runningPaid = 0;
    let runningDiscount = 0;

    for (const payment of sorted) {
      const type = String(payment.type || 'Income').toLowerCase();
      const amount = Math.abs(Number(payment.amount) || 0);
      const linked = isLinkedPlanInternal(payment, type);

      if (type === 'income') {
        runningPaid += amount;
        runningDebt = Math.max(0, runningDebt - amount);
      } else if (type === 'debt') {
        if (totalPlansPrice === 0 || !linked) runningDebt += amount;
      } else if (type === 'discount') {
        if (totalPlansPrice === 0 || !linked) {
          runningDiscount += amount;
          runningDebt = Math.max(0, runningDebt - amount);
        }
      } else if (type === 'refund') {
        runningDebt += amount;
        runningPaid = Math.max(0, runningPaid - amount);
      }

      balances[payment.id] = {
        debtAtTime: Math.max(0, runningDebt),
        totalToPayAtTime: Math.max(0, runningDebt) + runningPaid,
      };
    }

    totals[patientId] = {
      currentDebt: Math.max(0, runningDebt),
      totalPaid: runningPaid,
      totalDiscount: runningDiscount,
    };
  }

  return { balances, totals };
}
