import { base44 } from '@/api/base44Client';
import { syncPatientBalance } from '@/lib/treatmentDelete';
import { clinicianDisplayName } from '@/lib/treatingDoctor';

const PLAN_ID_RE = /\[\[plan_id:([^\]]+)\]\]/;

export function isCancelledPlanStatus(status) {
  return ['cancelled', 'canceled', 'otkaz', 'отказ', 'bekor'].includes(
    String(status || '').trim().toLowerCase(),
  );
}

/** Read linked treatment-plan id from appointment.plan_id or notes marker. */
export function getAppointmentPlanId(appointment) {
  if (!appointment) return '';
  if (appointment.plan_id) return String(appointment.plan_id);
  const m = String(appointment.notes || '').match(PLAN_ID_RE);
  return m?.[1] ? String(m[1]) : '';
}

export function withPlanIdInNotes(notes, planId) {
  const cleaned = String(notes || '').replace(PLAN_ID_RE, '').trim();
  if (!planId) return cleaned;
  return [cleaned, `[[plan_id:${planId}]]`].filter(Boolean).join('\n');
}

/**
 * Create a treatment plan (+ Debt) from selected appointment services.
 * Same shape as QuickPatientModal / NewPatientFlow plan step.
 */
export async function createPlanFromAppointmentServices({
  patientId,
  patientName,
  doctorId,
  doctorName,
  doctor,
  services = [],
  toothNumber = '',
  dateIso,
}) {
  const rows = (services || [])
    .map((s, i) => ({
      service_id: s.service_id || s.id || `svc_appt_${i}_${Date.now()}`,
      service_name: s.service_name || s.name || '',
      price: Number(s.price) || 0,
      quantity: Number(s.quantity) || 1,
      tooth_number: s.tooth_number || toothNumber || '',
      status: 'Pending',
    }))
    .filter((r) => r.service_name);

  if (!patientId || rows.length === 0) return null;

  const teethUsed = [...new Set(rows.map((r) => r.tooth_number).filter(Boolean))];
  const names = rows.map((r) => r.service_name).filter(Boolean);
  const serviceNames = names.length > 2
    ? `${names.slice(0, 2).join(', ')} + ${names.length - 2} ta`
    : names.join(', ');
  const displayCategory = teethUsed.length
    ? `${serviceNames} (#${teethUsed.join(', ')})`
    : serviceNames || 'Uchrashuv rejasi';
  const planTotal = rows.reduce((sum, r) => sum + (Number(r.price) || 0) * (Number(r.quantity) || 1), 0);
  const today = dateIso || new Date().toISOString();
  const docLabel = doctorName || clinicianDisplayName(doctor) || '';

  const plan = await base44.entities.TreatmentPlan.create({
    name: displayCategory,
    patient_id: patientId,
    patient_name: patientName || '',
    doctor_id: doctorId || '',
    doctor_name: docLabel,
    status: 'Planned',
    priority: 'Medium',
    total_price: planTotal,
    discount_amount: 0,
    discount_percent: 0,
    paid_amount: 0,
    notes: 'Uchrashuv orqali yaratilgan',
    start_date: today,
    tooth_number: teethUsed.join(', '),
    services: rows,
    installment_plan: null,
  });
  if (!plan?.id || plan?.error) throw new Error(plan?.error || 'Reja yaratilmadi');

  // Qarz faqat Keldi (Waiting → In Progress) da yoziladi.
  // Aks holda Planned reja ham qarzdorlikka tushib, Kelmadi dan keyin chalkashib qolardi.
  try {
    await syncPatientBalance(patientId);
  } catch (err) {
    console.warn('syncPatientBalance after appointment plan failed:', err);
  }

  return plan;
}

/**
 * Keldi -> plan In Progress (active)
 * Kelmadi -> plan Cancelled (otkaz), debt excluded via cancelled status
 * Qabulda -> appointment only (no plan change)
 */
async function paymentsLinkedToPlanId(patientId, planId) {
  if (!patientId || !planId) return [];
  const payments = await base44.entities.Payment.filter({ patient_id: patientId }, '-date', 5000);
  return (payments || []).filter((p) => {
    const notes = String(p.notes || '');
    return (
      String(p.plan_id || '') === String(planId)
      || notes.includes(`Linked to Plan: ${planId}`)
      || notes.includes(String(planId))
    );
  });
}

async function ensureDebtForPlan(appointment, planId) {
  const patientId = appointment?.patient_id;
  if (!patientId || !planId) return;
  const linked = await paymentsLinkedToPlanId(patientId, planId);
  const hasDebt = linked.some((p) => String(p.type || '').toLowerCase() === 'debt');
  if (hasDebt) return;

  let plan = null;
  try {
    plan = await base44.entities.TreatmentPlan.filter({ id: planId }, '-created_date', 1).then((rows) => rows?.[0] || null);
  } catch {
    plan = null;
  }
  if (!plan) {
    const all = await base44.entities.TreatmentPlan.filter({ patient_id: patientId }, '-created_date', 50);
    plan = (all || []).find((p) => String(p.id) === String(planId)) || null;
  }
  const amount = Number(plan?.total_price) || 0;
  if (amount <= 0) return;

  await base44.entities.Payment.create({
    patient_id: patientId,
    patient_name: appointment.patient_name || plan?.patient_name || '',
    doctor_id: appointment.doctor_id || plan?.doctor_id || '',
    type: 'Debt',
    category: plan?.name || plan?.title || 'Uchrashuv rejasi',
    amount,
    method: '—',
    date: new Date().toISOString().slice(0, 10),
    notes: `Linked to Plan: ${planId}`,
  });
}

async function removeDebtForPlan(patientId, planId) {
  const linked = await paymentsLinkedToPlanId(patientId, planId);
  for (const p of linked) {
    if (String(p.type || '').toLowerCase() !== 'debt') continue;
    try {
      await base44.entities.Payment.delete(p.id);
    } catch (err) {
      console.warn('Debt delete failed for cancelled appointment plan:', p.id, err);
    }
  }
}

export async function syncLinkedPlanForAppointmentStatus(appointment, appointmentStatus) {
  const planId = getAppointmentPlanId(appointment);
  if (!planId) return null;

  let nextPlanStatus = null;
  if (appointmentStatus === 'Waiting') nextPlanStatus = 'In Progress';
  else if (appointmentStatus === 'No-Show') nextPlanStatus = 'Cancelled';
  else return null;

  try {
    await base44.entities.TreatmentPlan.update(planId, { status: nextPlanStatus });
  } catch (err) {
    console.error('Linked plan status update failed:', err);
    throw err;
  }

  if (appointment?.patient_id) {
    try {
      if (nextPlanStatus === 'Cancelled') {
        await removeDebtForPlan(appointment.patient_id, planId);
      } else if (nextPlanStatus === 'In Progress') {
        await ensureDebtForPlan(appointment, planId);
      }
      await syncPatientBalance(appointment.patient_id);
    } catch (err) {
      console.warn('syncPatientBalance after plan status failed:', err);
    }
  }
  return nextPlanStatus;
}
