// Implant saqlanganda bemorning davolash rejalari ro'yxatida alohida reja ("Implantlar") yaratiladi
// va uning summasi qarz sifatida hisoblanadi. Mavjud mexanizm ishlatiladi: TreatmentPlan + `Linked to Plan: <id>`
// Debt (ToothChartCard / NewPatientFlow bilan bir xil), bemor balansi syncPatientBalance orqali yangilanadi.
// Bir implant = bir reja (xizmat qatorlaridagi implant_id orqali bog'lanadi), shuning uchun qayta saqlash
// yangi reja/qarz yaratmaydi, balki mavjudini yangilaydi.
import { base44 } from '@/api/base44Client';
import { deleteTreatmentPlan, syncPatientBalance } from '@/lib/treatmentDelete';
import {
  IMPLANT_PLAN_DEFAULT_NAME,
  applyLifecycleToLines,
  billedElsewhereTeeth,
  findAdoptableLines,
  findPlanForImplant,
  implantPlanLines,
  implantPlanMarker,
  implantPlanName,
  implantPlanTotal,
  isBackfillEligible,
  isExtraServiceRecord,
  isPlanOptedOut,
  mergeImplantLines,
  pickHostPlan,
  planImplantIds,
  planStatusFromServices,
  planTotalAfterDiscount,
  teethLabel,
} from '@/lib/implantPlanModel';

const LOCKED_PATIENT = 'patient-y2ii8ynf2';
const today = () => new Date().toISOString().split('T')[0];

// Bir bemor bo'yicha sinxronlash ketma-ket bajariladi (ro'yxat, tafsilot va profil bir vaqtda ochilganda
// bir implant uchun ikki reja/qarz yaratilib ketmasligi uchun).
const patientQueues = new Map();
function withPatientLock(patientId, task) {
  const key = String(patientId || '');
  const prev = patientQueues.get(key) || Promise.resolve();
  const run = prev.catch(() => {}).then(task);
  const tail = run.catch(() => {});
  patientQueues.set(key, tail);
  tail.then(() => { if (patientQueues.get(key) === tail) patientQueues.delete(key); });
  return run;
}

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
export function syncImplantPlan(implant, options = {}) {
  const patientId = implant?.patient_id;
  if (!implant?.id || !patientId || patientId === LOCKED_PATIENT) {
    return Promise.resolve({ action: 'none', plan: null, total: 0, adopted: 0 });
  }
  return withPatientLock(patientId, () => syncImplantPlanLocked(implant, options));
}

const lifecycleOf = (implant) => implant?.lifecycle_status || implant?.status || '';

async function syncImplantPlanLocked(implant, { planName, createPlan = true, onlyIfMissing = false, doctor = null, patient = null } = {}) {
  const patientId = implant.patient_id;
  const plans = await loadPatientPlans(patientId);
  let existing = findPlanForImplant(plans, implant.id);
  if (existing && onlyIfMissing) return { action: 'exists', plan: existing, total: Number(existing.total_price) || 0, adopted: 0 };

  // Boshqa rejada allaqachon bajarilgan shu tish implanti bo'lsa, asosiy implant qatori qayta qo'shilmaydi.
  const lines = implantPlanLines(implant, { skipPrimaryTeeth: billedElsewhereTeeth(plans, implant) });

  // Qo'shimcha xizmat (karonka, abutment...) - bemorning mavjud "Implantlar" rejasiga qo'shiladi.
  if (!existing && createPlan && isExtraServiceRecord(implant)) existing = pickHostPlan(plans, implant);

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
    const lifecycle = applyLifecycleToLines(lines, implant.id, lifecycleOf(implant));
    const plan = await base44.entities.TreatmentPlan.create({
      name,
      patient_id: patientId,
      patient_name: patient?.full_name || implant.patient_name || '',
      doctor_id: doctor?.id || implant.doctor_id || '',
      doctor_name: doctor?.name || implant.doctor || '',
      status: planStatusFromServices(lifecycle.services),
      priority: 'medium',
      tooth_number: teeth,
      services: lifecycle.services,
      total_price: rawTotal,
      discount_percent: 0,
      discount_amount: 0,
      notes: `${implantPlanMarker(implant.id)} Implant rejasi: ${teeth}`,
      installment_plan: null,
    });
    if (!plan?.id) throw new Error('Implant rejasi yaratilmadi');
    await upsertPlanDebt({ plan, patient, total: rawTotal, doctor, teeth });

    // Parallel (boshqa tab/qurilma) chaqiruv bir implant uchun ikkinchi reja ochgan bo'lsa - eng eskisi qoladi.
    const after = await loadPatientPlans(patientId);
    const twins = after
      .filter((candidate) => planImplantIds(candidate).includes(String(implant.id)))
      .sort((a, b) => String(a.created_date || '').localeCompare(String(b.created_date || '')) || String(a.id).localeCompare(String(b.id)));
    let finalPlan = plan;
    if (twins.length > 1) {
      finalPlan = twins[0];
      for (const twin of twins.slice(1)) await deleteTreatmentPlan(twin).catch(() => {});
    }
    await syncPatientBalance(patientId);
    return { action: 'created', plan: finalPlan, total: rawTotal, adopted: adoptable.length };
  }

  const lifecycle = applyLifecycleToLines(
    mergeImplantLines(existing.services, lines, implant.id),
    implant.id,
    lifecycleOf(implant),
  );
  const services = lifecycle.services;
  const { discount, total } = planTotalAfterDiscount(existing, services);
  const teeth = teethLabel(services);
  const patch = {
    services,
    total_price: total,
    discount_amount: discount,
    tooth_number: teeth,
    paid_amount: Math.min(Number(existing.paid_amount) || 0, total),
  };
  if (lifecycle.changed) patch.status = planStatusFromServices(services);
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

/**
 * Avtomatik sinxronlash (ro'yxat/tafsilot/profil/qo'shimcha xizmat/status): implant yaroqli bo'lsa va foydalanuvchi
 * qarzga yozishni rad etmagan bo'lsa, reja yo'q bo'lganda yaratadi; bor bo'lsa yangilaydi.
 */
export function autoSyncImplantPlan(implant, options = {}) {
  const createPlan = isBackfillEligible(implant) && !isPlanOptedOut(implant?.id);
  return syncImplantPlan(implant, { ...options, createPlan });
}

let backfillRun = null;
const backfillDone = new Set();

/**
 * Mavjud implantlar uchun (PR #50 dan oldin yaratilgan) "Implantlar" rejasi va bog'langan qarzni bir marta,
 * takrorlamasdan yaratadi. Allaqachon rejaga bog'langan implantlarga tegmaydi.
 * Natija: { created, total, errors }
 */
export async function backfillImplantPlans(implants, { patients = [] } = {}) {
  if (backfillRun) await backfillRun.catch(() => {});
  const task = (async () => {
    const result = { created: 0, total: 0, errors: 0, patientIds: [] };
    const candidates = (implants || []).filter((item) => (
      item?.id && !backfillDone.has(String(item.id)) && isBackfillEligible(item) && !isPlanOptedOut(item.id)
      && item.patient_id !== LOCKED_PATIENT
    ));
    if (candidates.length === 0) return result;

    // Bir so'rov bilan barcha rejalar: allaqachon bog'langan implantlar chetlab o'tiladi.
    const allPlans = (await base44.entities.TreatmentPlan.list('-created_date', 3000).catch(() => null)) || [];
    const linked = new Set();
    allPlans.forEach((plan) => planImplantIds(plan).forEach((id) => linked.add(id)));
    const missing = candidates.filter((item) => !linked.has(String(item.id)));
    candidates.filter((item) => linked.has(String(item.id))).forEach((item) => backfillDone.add(String(item.id)));

    // Avval asosiy implantlar (reja yaratadi), keyin qo'shimcha xizmatlar (shu rejaga qo'shiladi).
    missing.sort((a, b) => Number(isExtraServiceRecord(a)) - Number(isExtraServiceRecord(b)));
    const patientsById = new Map((patients || []).map((p) => [String(p.id), p]));
    const touched = new Set();
    for (const item of missing) {
      try {
        const res = await syncImplantPlan(item, {
          createPlan: true,
          onlyIfMissing: true,
          patient: patientsById.get(String(item.patient_id)) || { full_name: item.patient_name || '' },
        });
        backfillDone.add(String(item.id));
        if (res.action === 'created' || (res.action === 'updated' && res.total > 0)) {
          result.created += 1;
          result.total += implantPlanTotal(item);
          touched.add(String(item.patient_id));
        }
      } catch (err) {
        result.errors += 1;
        console.error('Implant plan backfill failed:', item.id, err);
      }
    }
    result.patientIds = [...touched];
    return result;
  })();
  backfillRun = task;
  try {
    return await task;
  } finally {
    if (backfillRun === task) backfillRun = null;
  }
}

export { IMPLANT_PLAN_DEFAULT_NAME };
