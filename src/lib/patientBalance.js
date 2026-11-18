/**
 * One remaining-debt figure for Qarzlar, Bemorlar, and the payment dialog.
 * Charges = billable treatment plans + debt rows that are not already the same plan.
 * Payments = income (a blank type is an older income row) and unlinked discounts.
 * Refunds are added back. Pending appointment plans stay out until the visit starts.
 */

const CANCELLED = new Set(['cancelled', 'canceled', 'otkaz', 'отказ', 'bekor']);
const STARTED = new Set(['in progress', 'completed', 'done', 'bajarildi', 'in treatment']);

export function isCancelledPlanStatus(status) {
  return CANCELLED.has(String(status || '').trim().toLowerCase());
}

/** Appointment plans bill only after the patient arrives (Keldi / In Progress). */
export function isPendingAppointmentPlan(plan) {
  const notes = String(plan?.notes || '');
  if (!notes.includes('Uchrashuv orqali yaratilgan')) return false;
  const status = String(plan?.status || '').trim().toLowerCase();
  return !STARTED.has(status);
}

export function planIdFromPayment(payment) {
  if (payment?.plan_id != null && payment.plan_id !== '') return String(payment.plan_id);
  const notes = String(payment?.notes || '');
  const linked = notes.match(/Linked to Plan:\s*([^\s|]+)/i);
  if (linked?.[1]) return String(linked[1]);
  const marker = notes.match(/\[\[plan_id:([^\]]+)\]\]/);
  return marker?.[1] ? String(marker[1]) : '';
}

function absAmount(row) {
  return Math.abs(Number(row?.amount) || 0);
}

function isIncome(row) {
  const type = String(row?.type || '').trim().toLowerCase();
  return type === 'income' || type === '';
}

function isLinkedDiscount(row) {
  const notes = String(row?.notes || '').toLowerCase();
  return Boolean(
    row?.plan_id
    || notes.includes('linked to plan')
    || notes.includes('reja:')
    || notes.includes('avtomatik chegirma')
    || notes.includes('reja yangilandi'),
  );
}

/**
 * @returns {{ charges: number, income: number, discounts: number, refunds: number, debt: number }}
 */
export function patientBalance(patientId, payments = [], plans = []) {
  const id = patientId == null ? '' : String(patientId);
  const payRows = (payments || []).filter((row) => row && (!id || String(row.patient_id) === id));
  const planRows = (plans || []).filter((row) => row && (!id || String(row.patient_id) === id));

  const cancelled = new Set(
    planRows.filter((plan) => isCancelledPlanStatus(plan.status)).map((plan) => String(plan.id)),
  );
  const countedPlans = new Set();
  let planCharges = 0;
  for (const plan of planRows) {
    const planId = String(plan.id || '');
    if (!planId || cancelled.has(planId) || isPendingAppointmentPlan(plan)) continue;
    planCharges += Number(plan.total_price) || 0;
    countedPlans.add(planId);
  }

  let debtCharges = 0;
  let income = 0;
  let discounts = 0;
  let refunds = 0;

  for (const row of payRows) {
    const type = String(row.type || '').trim().toLowerCase();
    const amount = absAmount(row);
    if (isIncome(row)) {
      income += amount;
      continue;
    }
    if (type === 'refund') {
      refunds += amount;
      continue;
    }
    if (type === 'discount') {
      if (!isLinkedDiscount(row)) discounts += amount;
      continue;
    }
    if (type !== 'debt') continue;
    const linked = planIdFromPayment(row);
    if (linked && cancelled.has(linked)) continue;
    if (linked && countedPlans.has(linked)) continue;
    const notes = String(row.notes || '');
    let mentionsCancelled = false;
    for (const cancelledId of cancelled) {
      if (cancelledId && (notes.includes(cancelledId) || String(row.category || '').includes(cancelledId))) {
        mentionsCancelled = true;
        break;
      }
    }
    if (mentionsCancelled) continue;
    debtCharges += amount;
  }

  const charges = planCharges + debtCharges;
  return {
    charges,
    income,
    discounts,
    refunds,
    debt: Math.max(0, charges + refunds - income - discounts),
  };
}

/** Map of patient id → remaining debt. Itemized charges win; a stored balance is kept only when nothing was loaded. */
export function debtByPatient(patients = [], payments = [], plans = []) {
  const ids = new Set();
  for (const row of patients || []) if (row?.id) ids.add(String(row.id));
  for (const row of payments || []) if (row?.patient_id) ids.add(String(row.patient_id));
  for (const row of plans || []) if (row?.patient_id) ids.add(String(row.patient_id));

  const stored = new Map((patients || []).filter((row) => row?.id).map((row) => [String(row.id), Number(row.total_debt) || 0]));
  const map = {};
  for (const id of ids) {
    const balance = patientBalance(id, payments, plans);
    const remembered = stored.get(id) || 0;
    map[id] = balance.charges <= 0 && balance.income <= 0 && balance.refunds <= 0
      ? Math.max(0, remembered)
      : balance.debt;
  }
  return map;
}
