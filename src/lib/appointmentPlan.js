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

  if (planTotal > 0) {
    await base44.entities.Payment.create({
      patient_id: patientId,
      patient_name: patientName || '',
      doctor_id: doctorId || '',
      type: 'Debt',
      category: displayCategory,
      amount: planTotal,
      method: '—',
      date: String(today).slice(0, 10),
      plan_id: plan.id,
      notes: `Linked to Plan: ${plan.id}`,
    });
  }

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
      await syncPatientBalance(appointment.patient_id);
    } catch (err) {
      console.warn('syncPatientBalance after plan status failed:', err);
    }
  }
  return nextPlanStatus;
}
