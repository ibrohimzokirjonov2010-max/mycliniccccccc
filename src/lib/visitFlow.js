import { base44 } from '@/api/base44Client';
import { allocateInvoicePayment } from '@/lib/invoiceAllocation';
import { syncPatientBalance } from '@/lib/treatmentDelete';
import { isDoneStatus } from '@/lib/planGroups';

const LOCKED_PATIENT = 'patient-y2ii8ynf2';
const todayIso = () => new Date().toISOString().split('T')[0];

export const isServiceDone = (svc) => svc?.completed === true || isDoneStatus(svc?.status);
export const svcPrice = (svc) => Number(svc?.price || svc?.cost || 0) || 0;

/** Pending rows of the patient's open plans (supports nested `items`). */
export function pendingPlanRows(plans = []) {
  const rows = [];
  (plans || []).forEach((plan) => {
    const st = String(plan?.status || '').toLowerCase();
    if (['completed', 'cancelled', 'canceled'].includes(st)) return;
    (plan.services || []).forEach((svc, parent) => {
      if (Array.isArray(svc.items)) {
        svc.items.forEach((inner, item) => {
          if (!isServiceDone(inner)) rows.push({ plan, path: { parent, item }, svc: inner });
        });
      } else if (!isServiceDone(svc)) {
        rows.push({ plan, path: { parent, item: null }, svc });
      }
    });
  });
  return rows.map((r) => ({ ...r, key: `${r.plan.id}:${r.path.parent}:${r.path.item ?? ''}` }));
}

/** Discount share of one plan row (percent, or fixed amount pro-rata). */
export function rowDiscount(plan, price) {
  const pct = Number(plan?.discount_percent) || 0;
  if (pct > 0) return Math.floor(price * pct / 100);
  const amt = Number(plan?.discount_amount) || 0;
  if (!amt) return 0;
  const raw = (plan?.services || []).reduce((s, x) => s + (Array.isArray(x.items) ? x.items.reduce((a, b) => a + svcPrice(b), 0) : svcPrice(x)), 0);
  return raw > 0 ? Math.round(amt * price / raw) : 0;
}

/** Same rule as ToothChartCard.markDone: mark rows completed, close plan when all done. */
export async function markPlanRowsDone(rows) {
  const byPlan = new Map();
  rows.forEach((r) => {
    if (!byPlan.has(r.plan.id)) byPlan.set(r.plan.id, { plan: r.plan, paths: [] });
    byPlan.get(r.plan.id).paths.push(r.path);
  });
  for (const { plan, paths } of byPlan.values()) {
    const markRow = (svc) => ({ ...svc, status: 'completed', completed: true });
    const services = (plan.services || []).map((svc, index) => {
      if (Array.isArray(svc.items)) {
        return { ...svc, items: svc.items.map((inner, i) => (paths.some((p) => p.parent === index && p.item === i) ? markRow(inner) : inner)) };
      }
      return paths.some((p) => p.parent === index && p.item == null) ? markRow(svc) : svc;
    });
    const flat = services.flatMap((s) => (Array.isArray(s.items) ? s.items : [s]));
    const allDone = flat.every((row) => isServiceDone(row) || isDoneStatus(row.payment_status));
    await base44.entities.TreatmentPlan.update(plan.id, {
      services,
      status: allDone || services.length === 0 ? 'completed' : plan.status,
    });
  }
}

/** Same as ToothChartCard.appendLinesToActivePlan(completed): new completed plan + Debt record. */
export async function createDonePlan({ patient, doctor, lines }) {
  if (!patient?.id || patient.id === LOCKED_PATIENT || !lines.length) return null;
  const rows = lines.map((row) => ({ ...row, tooth: row.tooth_number, status: 'completed', completed: true }));
  const teeth = [...new Set(rows.map((r) => String(r.tooth_number || '').trim()).filter(Boolean))];
  const names = [...new Set(rows.map((r) => String(r.service_name || '').trim()).filter(Boolean))];
  const shown = names.slice(0, 2).join(', ') + (names.length > 2 ? ` +${names.length - 2} ta` : '');
  const total = rows.reduce((s, r) => s + svcPrice(r), 0);
  const plan = await base44.entities.TreatmentPlan.create({
    name: [shown || 'Davolash rejasi', teeth.length ? `· ${teeth.join(', ')}` : ''].filter(Boolean).join(' '),
    patient_id: patient.id,
    patient_name: patient.full_name || '',
    doctor_id: doctor?.id || '',
    doctor_name: doctor?.name || '',
    status: 'completed',
    priority: 'medium',
    tooth_number: teeth.join(', '),
    services: rows,
    total_price: total,
    discount_percent: 0,
    discount_amount: 0,
    notes: `Davolash rejasi: ${teeth.join(', ')}`,
    installment_plan: null,
  });
  if (total > 0 && plan?.id) {
    await base44.entities.Payment.create({
      patient_id: patient.id,
      patient_name: patient.full_name || '',
      doctor_id: doctor?.id || '',
      type: 'Debt',
      category: `Reja: ${teeth.join(', ')}`,
      amount: total,
      method: '—',
      date: todayIso(),
      notes: `Linked to Plan: ${plan.id}`,
    });
    await syncPatientBalance(patient.id);
  }
  return plan;
}

/** Current debt, same formula as MobilePaymentsV2.handleAddPayment. */
export async function currentPatientDebt(patientId) {
  const [plans, pays] = await Promise.all([
    base44.entities.TreatmentPlan.filter({ patient_id: patientId }, '-created_date', 50),
    base44.entities.Payment.filter({ patient_id: patientId }, '-date', 500),
  ]);
  const sum = (t) => (pays || []).filter((p) => p.type?.toLowerCase() === t).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const inc = sum('income'); const debts = sum('debt'); const ref = sum('refund');
  const disc = (pays || []).filter((p) => p.type?.toLowerCase() === 'discount').reduce((s, p) => s + Math.abs(Number(p.amount) || 0), 0);
  let net;
  if (debts > 0) net = inc + disc - debts - ref;
  else if ((plans || []).length) net = inc + disc - (plans || []).reduce((s, p) => s + (Number(p.total_price) || 0), 0);
  else net = inc - ref;
  return { debt: net < 0 ? Math.abs(net) : 0, plans: plans || [] };
}

/** Income save, mirroring MobilePaymentsV2.handleAddPayment (allocation + patient totals). */
export async function saveVisitIncome({ patient, doctor, amount, method, category, notes, planId }) {
  if (!patient?.id || patient.id === LOCKED_PATIENT) throw new Error('locked');
  const { debt, plans } = await currentPatientDebt(patient.id);
  if (debt <= 0) throw new Error('no-debt');
  const value = Math.min(Number(amount) || 0, debt);
  if (value <= 0) throw new Error('amount');
  const [pt] = await base44.entities.Patient.filter({ id: patient.id });
  const newPaid = (Number(pt?.total_paid) || 0) + value;
  const newDebt = Math.max(0, debt - value);
  await base44.entities.Payment.create({
    patient_id: patient.id,
    patient_name: patient.full_name || '',
    doctor_id: doctor?.id || null,
    commission_rate: doctor ? (doctor.commission_rate || doctor.commission || 30) : null,
    type: 'Income',
    amount: value,
    method,
    category: category || 'Treatment',
    date: todayIso(),
    notes: notes || '',
    receipt_url: null,
    debt_amount: newDebt,
  });
  try {
    const slices = allocateInvoicePayment(plans, value, planId || '');
    for (const slice of slices) await base44.entities.TreatmentPlan.update(slice.id, { paid_amount: slice.paid_amount });
  } catch (err) { console.error('allocation failed', err); }
  await base44.entities.Patient.update(patient.id, { total_paid: newPaid, total_debt: newDebt });
  return { paid: value, debtAfter: newDebt };
}
