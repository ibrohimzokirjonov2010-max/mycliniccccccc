import { base44 } from '@/api/base44Client';

const LOCKED_PATIENT = 'patient-y2ii8ynf2';

function servicePrice(service) {
  return Number(service?.price || service?.cost || 0) || 0;
}

function isDone(service) {
  const status = String(service?.status || '').toLowerCase();
  return status === 'completed' || status === 'bajarildi' || service?.completed === true;
}

async function syncPatientBalance(patientId) {
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
    .filter((p) => String(p.type || '').toLowerCase() === 'discount')
    .reduce((total, p) => total + Math.abs(Number(p.amount) || 0), 0);
  const plansPrice = (plans || []).reduce((total, plan) => total + (Number(plan.total_price) || 0), 0);
  let debt = 0;
  if (debts > 0) {
    const net = incomes + discounts - debts - refunds;
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
