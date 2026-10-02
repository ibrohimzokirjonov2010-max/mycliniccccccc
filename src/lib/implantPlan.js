// Implant saqlanganda bemorning davolash rejalari ro'yxatida alohida reja ("Implantlar") yaratiladi
// va uning summasi qarz sifatida hisoblanadi. Mavjud mexanizm ishlatiladi: TreatmentPlan + `Linked to Plan: <id>`
// Debt (ToothChartCard / NewPatientFlow bilan bir xil), bemor balansi syncPatientBalance orqali yangilanadi.
// Bir implant = bir reja (xizmat qatorlaridagi implant_id orqali bog'lanadi), shuning uchun qayta saqlash
// yangi reja/qarz yaratmaydi, balki mavjudini yangilaydi.
import { base44 } from '@/api/base44Client';
import { deleteTreatmentPlan, syncPatientBalance } from '@/lib/treatmentDelete';
import {
  IMPLANT_PLAN_DEFAULT_NAME,
  findAdoptableLines,
  findPlanForImplant,
  implantPlanLines,
  implantPlanMarker,
  implantPlanName,
  mergeImplantLines,
  planTotalAfterDiscount,
  teethLabel,
} from '@/lib/implantPlanModel';

const LOCKED_PATIENT = 'patient-y2ii8ynf2';
const today = () => new Date().toISOString().split('T')[0];

export async function loadPatientPlans(patientId) {
  if (!patientId) return [];
  return (await base44.entities.TreatmentPlan.filter({ patient_id: patientId }, '-created_date', 200).catch(() => [])) || [];
}

async function planDebts(patientId, planId) {
  const payments = await base44.entities.Payment.filter({ patient_id: patientId }, '-date', 5000).catch(() => []);
  return (payments || []).filter((p) => (
    String(p.type || '').toLowerCase() === 'debt'
    && (String(p.notes || '').includes(planId) || p.plan_id === planId)
  ));
}

/** Rejaga bog'langan bitta Debt yozuvi: summa o'zgarsa yangilanadi, 0 bo'lsa o'chadi, yo'q bo'lsa yaratiladi. */
async function upsertPlanDebt({ plan, patient, total, doctor, teeth }) {
  const debts = await planDebts(plan.patient_id, plan.id);
  if (total <= 0) {
    for (const debt of debts) await base44.entities.Payment.delete(debt.id);
    return;
  }
  if (debts.length === 0) {
    await base44.entities.Payment.create({
      patient_id: plan.patient_id,
      patient_name: patient?.full_name || plan.patient_name || '',
      doctor_id: doctor?.id || plan.doctor_id || '',
      type: 'Debt',
      category: `Reja: ${teeth}`,
      amount: total,
      method: '—',
      date: today(),
      notes: `Linked to Plan: ${plan.id}`,
    });
    return;
  }
  const [keep, ...extra] = debts;
  if (Number(keep.amount) !== total) await base44.entities.Payment.update(keep.id, { amount: total });
  for (const dup of extra) await base44.entities.Payment.delete(dup.id);
}

/** Boshqa rejadan implant qatorini olib tashlaydi (qarz ham shunga kamayadi). */
async function detachLine({ plan, index, patient }) {
  const services = (plan.services || []).filter((_, i) => i !== index);
  if (services.length === 0) {
    await deleteTreatmentPlan(plan);
    return;
  }
  const { discount, total } = planTotalAfterDiscount(plan, services);
  const teeth = teethLabel(services);
  await base44.entities.TreatmentPlan.update(plan.id, {
    services,
    total_price: total,
    discount_amount: discount,
    tooth_number: teeth,
    paid_amount: Math.min(Number(plan.paid_amount) || 0, total),
  });
  await upsertPlanDebt({ plan, patient, total, doctor: null, teeth });
}

/**
 * Implantni bemor rejasi bilan moslaydi.
 * - reja yo'q va createPlan=true: yangi alohida reja + Debt yaratadi;
 * - reja bor: qatorlar/summa/Debt yangilanadi (qulflangan bo'lsa ham: bu implantning o'z rejasi), nom ixtiyoriy o'zgaradi.
 * Natija: { action: 'created' | 'updated' | 'none', plan, total, adopted }
 */
export async function syncImplantPlan(implant, { planName, createPlan = true, doctor = null, patient = null } = {}) {
  const patientId = implant?.patient_id;
  if (!implant?.id || !patientId || patientId === LOCKED_PATIENT) return { action: 'none', plan: null, total: 0, adopted: 0 };

  const lines = implantPlanLines(implant);
  const plans = await loadPatientPlans(patientId);
  const existing = findPlanForImplant(plans, implant.id);

  if (!existing) {
    const rawTotal = lines.reduce((sum, line) => sum + (Number(line.price) || 0), 0);
    if (!createPlan || lines.length === 0 || rawTotal <= 0) return { action: 'none', plan: null, total: rawTotal, adopted: 0 };

    // Shu tishga boshqa rejada yozilgan "Implant" qatori bo'lsa - u shu rejaga ko'chadi (ikki marta qarz bo'lmasin).
    const adoptable = findAdoptableLines(plans, implant);
    const byPlan = new Map();
    adoptable.forEach((item) => {
      if (!byPlan.has(item.plan.id)) byPlan.set(item.plan.id, { plan: item.plan, indexes: [] });
      byPlan.get(item.plan.id).indexes.push(item.index);
    });
    for (const { plan: other, indexes } of byPlan.values()) {
      const kept = (other.services || []).filter((_, i) => !indexes.includes(i));
      if (kept.length === 0) {
        await deleteTreatmentPlan(other);
      } else {
        const { discount, total } = planTotalAfterDiscount(other, kept);
        const teeth = teethLabel(kept);
        await base44.entities.TreatmentPlan.update(other.id, {
          services: kept,
          total_price: total,
          discount_amount: discount,
          tooth_number: teeth,
          paid_amount: Math.min(Number(other.paid_amount) || 0, total),
        });
        await upsertPlanDebt({ plan: other, patient, total, doctor: null, teeth });
      }
    }

    const name = implantPlanName(planName);
    const teeth = teethLabel(lines);
    const plan = await base44.entities.TreatmentPlan.create({
      name,
      patient_id: patientId,
      patient_name: patient?.full_name || implant.patient_name || '',
      doctor_id: doctor?.id || implant.doctor_id || '',
      doctor_name: doctor?.name || implant.doctor || '',
      status: 'planned',
      priority: 'medium',
      tooth_number: teeth,
      services: lines,
      total_price: rawTotal,
      discount_percent: 0,
      discount_amount: 0,
      notes: `${implantPlanMarker(implant.id)} Implant rejasi: ${teeth}`,
      installment_plan: null,
    });
    if (!plan?.id) throw new Error('Implant rejasi yaratilmadi');
    await upsertPlanDebt({ plan, patient, total: rawTotal, doctor, teeth });
    await syncPatientBalance(patientId);
    return { action: 'created', plan, total: rawTotal, adopted: adoptable.length };
  }

  const services = mergeImplantLines(existing.services, lines, implant.id);
  const { discount, total } = planTotalAfterDiscount(existing, services);
  const teeth = teethLabel(services);
  const patch = {
    services,
    total_price: total,
    discount_amount: discount,
    tooth_number: teeth,
    paid_amount: Math.min(Number(existing.paid_amount) || 0, total),
  };
  if (planName != null && String(planName).trim()) patch.name = implantPlanName(planName);
  const plan = await base44.entities.TreatmentPlan.update(existing.id, patch);
  const merged = { ...existing, ...patch, ...(plan && typeof plan === 'object' ? plan : {}), id: existing.id };
  await upsertPlanDebt({ plan: merged, patient, total, doctor, teeth });
  await syncPatientBalance(patientId);
  return { action: 'updated', plan: merged, total, adopted: 0 };
}

/** Implant o'chirilganda uning rejasi va qarzi ham olib tashlanadi (boshqa qatorlar saqlanadi). */
export async function removeImplantPlan(implant) {
  const patientId = implant?.patient_id;
  if (!implant?.id || !patientId || patientId === LOCKED_PATIENT) return false;
  const plans = await loadPatientPlans(patientId);
  const plan = findPlanForImplant(plans, implant.id);
  if (!plan) return false;
  const key = String(implant.id);
  const rest = (plan.services || []).filter((srv) => String(srv?.implant_id ?? '') !== key);
  if (rest.length === 0) {
    await deleteTreatmentPlan(plan);
    return true;
  }
  const { discount, total } = planTotalAfterDiscount(plan, rest);
  const teeth = teethLabel(rest);
  await base44.entities.TreatmentPlan.update(plan.id, {
    services: rest,
    total_price: total,
    discount_amount: discount,
    tooth_number: teeth,
    paid_amount: Math.min(Number(plan.paid_amount) || 0, total),
  });
  await upsertPlanDebt({ plan, patient: null, total, doctor: null, teeth });
  await syncPatientBalance(patientId);
  return true;
}

/** Implant rejasi nomini o'zgartirish: reja qulflangan bo'lsa ham ruxsat etiladi (faqat nom). */
export async function renameImplantPlan(plan, name) {
  if (!plan?.id) throw new Error('missing-plan');
  const next = implantPlanName(name);
  await base44.entities.TreatmentPlan.update(plan.id, { name: next });
  return next;
}

export { IMPLANT_PLAN_DEFAULT_NAME };
