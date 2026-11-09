import { base44 } from '@/api/base44Client';
import { isPlanLocked } from '@/lib/planLock';
import { isLinkedPlanInternal } from '@/lib/paymentDebt';
import { planImplantIds, setPlanOptOut } from '@/lib/implantPlanModel';

const LOCKED_PATIENT = 'patient-y2ii8ynf2';

function servicePrice(service) {
  return Number(service?.price || service?.cost || 0) || 0;
}

function isDone(service) {
  const status = String(service?.status || '').toLowerCase();
  return status === 'completed' || status === 'bajarildi' || service?.completed === true;
}

export function paymentsLinkedToPlan(payments, planId) {
  return (payments || []).filter((payment) => {
    const notes = String(payment?.notes || '');
    return notes.includes(planId) || payment?.plan_id === planId;
  });
}

export async function paymentsForPlan(patientId, planId) {
  if (!patientId || !planId) return [];
  const payments = await base44.entities.Payment.filter({ patient_id: patientId }, '-date', 5000);
  return paymentsLinkedToPlan(payments, planId);
}

export async function planAllocatedPaid(plan) {
  const linked = await paymentsForPlan(plan?.patient_id, plan?.id);
  const paidAmount = linked
    .filter((payment) => String(payment.type || '').toLowerCase() === 'income')
    .reduce((total, payment) => total + Math.abs(Number(payment.amount) || 0), 0);
  return { linked, paidAmount };
}

/**
 * Delete a whole treatment plan.
 * Unpaid debt and legacy discount rows linked to the plan are removed.
 * Income that is already allocated stays. The caller warns before that.
 */
export async function deleteTreatmentPlan(plan) {
  if (!plan?.id) throw new Error('missing-plan');
  const patientId = plan.patient_id;
  if (!patientId || patientId === LOCKED_PATIENT) throw new Error('locked');

  const linked = await paymentsForPlan(patientId, plan.id);
  for (const payment of linked) {
    const type = String(payment.type || '').toLowerCase();
    if (type === 'debt' || type === 'discount') {
      await base44.entities.Payment.delete(payment.id);
    }
  }
  await base44.entities.TreatmentPlan.delete(plan.id);
  // Implant rejasi qo'lda o'chirilsa, avtomatik backfill uni qayta ochmaydi.
  planImplantIds(plan).forEach((implantId) => setPlanOptOut(implantId, true));
  const balance = await syncPatientBalance(patientId);
  const paidAmount = linked
    .filter((payment) => String(payment.type || '').toLowerCase() === 'income')
    .reduce((total, payment) => total + Math.abs(Number(payment.amount) || 0), 0);
  return { balance, paidAmount };
}

export async function syncPatientBalance(patientId) {
  if (!patientId || patientId === LOCKED_PATIENT) return null;
  const [payments, plans] = await Promise.all([
    base44.entities.Payment.filter({ patient_id: patientId }, '-date', 5000),
    base44.entities.TreatmentPlan.filter({ patient_id: patientId }, '-created_date', 50),
  ]);
  const sum = (type) => (payments || [])
    .filter((p) => String(p.type || '').toLowerCase() === type)
    .reduce((total, p) => total + (Number(p.amount) || 0), 0);
  const incomes = sum('income');
  const debts = sum('debt');
  const refunds = sum('refund');
  const discounts = (payments || [])
    // Plan-linked discount rows (wizard "Avtomatik chegirma") are already inside that plan's Debt row.
    .filter((p) => String(p.type || '').toLowerCase() === 'discount' && !isLinkedPlanInternal(p, 'discount'))
    .reduce((total, p) => total + Math.abs(Number(p.amount) || 0), 0);
  const isCancelledPlan = (plan) => ['cancelled', 'canceled', 'otkaz'].includes(String(plan?.status || '').trim().toLowerCase());
  // Uchrashuvdan yaratilgan Planned reja — qarz faqat Keldi (In Progress) dan keyin.
  const isAppointmentPendingPlan = (plan) => {
    if (isCancelledPlan(plan)) return false;
    const st = String(plan?.status || '').trim().toLowerCase();
    if (st === 'in progress' || st === 'completed' || st === 'done' || st === 'bajarildi') return false;
    return String(plan?.notes || '').includes('Uchrashuv orqali yaratilgan');
  };
  const cancelledPlanIds = new Set((plans || []).filter(isCancelledPlan).map((p) => String(p.id)));
  const plansPrice = (plans || [])
    .filter((plan) => !isCancelledPlan(plan) && !isAppointmentPendingPlan(plan))
    .reduce((total, plan) => total + (Number(plan.total_price) || 0), 0);
  // Debt rows linked to cancelled (otkaz) plans must not keep the patient in debt.
  const activeDebts = (payments || [])
    .filter((p) => {
      if (String(p.type || '').toLowerCase() !== 'debt') return false;
      if (cancelledPlanIds.size === 0) return true;
      const notes = String(p.notes || '');
      const linked = p.plan_id != null && p.plan_id !== ''
        ? String(p.plan_id)
        : (notes.match(/Linked to Plan:\s*([^\s|]+)/i)?.[1] || notes.match(/\[\[plan_id:([^\]]+)\]\]/)?.[1] || '');
      if (linked && cancelledPlanIds.has(String(linked))) return false;
      // Fallback: notes may wrap / decode oddly — any cancelled plan id mentioned is enough.
      for (const id of cancelledPlanIds) {
        if (id && (notes.includes(id) || String(p.plan_id || '') === id || String(p.category || '').includes(id))) return false;
      }
      return true;
    })
    .reduce((total, p) => total + (Number(p.amount) || 0), 0);
  let debt = 0;
  if (activeDebts > 0) {
    const net = incomes + discounts - activeDebts - refunds;
    debt = net < 0 ? Math.abs(net) : 0;
  } else if (plansPrice > 0) {
    const net = incomes + discounts - plansPrice;
    debt = net < 0 ? Math.abs(net) : 0;
  } else {
    const net = incomes - refunds;
    debt = net < 0 ? Math.abs(net) : 0;
  }
  await base44.entities.Patient.update(patientId, {
    total_paid: incomes,
    total_debt: debt,
  });
  const done = (plans || []).reduce((count, plan) => count + (plan.services || []).filter(isDone).length, 0);
  const all = (plans || []).reduce((count, plan) => count + (plan.services || []).length, 0);
  return { debt, paid: incomes, done, total: all, plansPrice };
}

/**
 * Remove one treatment row from a plan.
 * Unpaid billed amount is removed from the linked debt.
 * Allocated payments stay; the caller must warn before this runs.
 */
export async function deleteTreatmentRow({ patientId, plan, serviceIndex }) {
  if (!patientId || patientId === LOCKED_PATIENT) {
    throw new Error('locked');
  }
  if (!plan?.id) throw new Error('missing-plan');

  const services = Array.isArray(plan.services) ? [...plan.services] : [];
  // Saqlangan (qulflangan) rejadan alohida xizmatni olib tashlab bo'lmaydi; faqat yagona xizmatli rejani butunlay o'chirish mumkin.
  if (isPlanLocked(plan) && services.length > 1) throw new Error('plan-locked');
  const nextServices = services.length
    ? services.filter((_, index) => index !== Number(serviceIndex))
    : [];
  const raw = nextServices.reduce((sum, service) => sum + servicePrice(service), 0);
  const discountPercent = Number(plan.discount_percent) || 0;
  const discountAmt = discountPercent > 0
    ? Math.floor(raw * discountPercent / 100)
    : Math.min(Number(plan.discount_amount) || 0, raw);
  const total = Math.max(0, raw - discountAmt);
  const paid = Math.min(Number(plan.paid_amount) || 0, total);

  if (nextServices.length === 0) {
    await base44.entities.TreatmentPlan.delete(plan.id);
    planImplantIds(plan).forEach((implantId) => setPlanOptOut(implantId, true));
  } else {
    const teeth = [...new Set(nextServices.map((service) => service.tooth_number).filter(Boolean))];
    const done = nextServices.filter(isDone).length;
    const status = done === nextServices.length
      ? 'Completed'
      : (done > 0 ? 'In Progress' : (plan.status || 'Planned'));
    await base44.entities.TreatmentPlan.update(plan.id, {
      services: nextServices,
      total_price: total,
      discount_amount: discountAmt,
      tooth_number: teeth.join(', '),
      status,
      paid_amount: paid,
    });
  }

  const payments = await base44.entities.Payment.filter({ patient_id: patientId }, '-date', 500);
  const linkedDebt = (payments || []).filter((payment) => {
    const type = String(payment.type || '').toLowerCase();
    const notes = String(payment.notes || '');
    return type === 'debt' && (notes.includes(plan.id) || payment.plan_id === plan.id);
  });
  for (const debt of linkedDebt) {
    if (nextServices.length === 0 || total <= 0) {
      await base44.entities.Payment.delete(debt.id);
    } else {
      await base44.entities.Payment.update(debt.id, { amount: total });
    }
  }

  const balance = await syncPatientBalance(patientId);
  return {
    total,
    remaining: nextServices.length,
    done: nextServices.filter(isDone).length,
    balance,
  };
}
