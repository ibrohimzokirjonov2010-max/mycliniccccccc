// Implant wizard -> alohida davolash rejasi ("Implantlar"). Sof (bazasiz) hisob-kitoblar.
// Reja qatorlari implant tafsilotidagi "Xizmatlar (bog'langan)" jadvali bilan bir xil manbadan olinadi
// (buildLinkedServiceModel), shuning uchun reja summasi va jadval doim mos keladi.
import { buildLinkedServiceModel } from '../components/implants/linkedImplantServices.js';
import { toImplantFdi } from './fdiNotation.js';

export const IMPLANT_PLAN_DEFAULT_NAME = 'Implantlar';

const num = (value) => Number(value) || 0;
const DONE_STATUSES = ['completed', 'bajarildi', 'bajarilgan'];

export function implantPlanMarker(implantId) {
  return `[implant:${implantId}]`;
}

/** Reja qaysi implantlarga bog'langan (xizmat qatorlaridagi implant_id yoki izohdagi belgi). */
export function planImplantIds(plan) {
  const ids = new Set();
  (plan?.services || []).forEach((srv) => {
    if (srv?.implant_id != null && srv.implant_id !== '') ids.add(String(srv.implant_id));
  });
  const notes = String(plan?.notes || '');
  const re = /\[implant:([^\]\s]+)\]/g;
  let match = re.exec(notes);
  while (match) {
    ids.add(match[1]);
    match = re.exec(notes);
  }
  return [...ids];
}

export function isImplantPlan(plan) {
  return planImplantIds(plan).length > 0;
}

export function findPlanForImplant(plans, implantId) {
  if (implantId == null || implantId === '') return null;
  const key = String(implantId);
  return (plans || []).find((plan) => planImplantIds(plan).includes(key)) || null;
}

export function implantPlanName(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim() || IMPLANT_PLAN_DEFAULT_NAME;
}

function isDone(service) {
  return DONE_STATUSES.includes(String(service?.status || '').toLowerCase()) || service?.completed === true;
}

/** Wizard faktura qatorlari -> reja xizmat qatorlari (tish raqami va narx bilan). */
export function implantPlanLines(implant, { skipPrimaryTeeth = [] } = {}) {
  const model = buildLinkedServiceModel(implant);
  const implantId = implant?.id != null ? String(implant.id) : '';
  const skip = new Set((skipPrimaryTeeth || []).map(String));
  const rows = (model.rows || []).filter((row) => !(row.is_primary && skip.has(String(row.tooth_number || ''))));
  return rows.map((row) => {
    const tooth = row.tooth_number ? String(row.tooth_number) : '';
    return {
      service_name: row.service_name,
      tooth_number: tooth,
      tooth,
      price: num(row.price),
      price_source: 'implant',
      status: 'planned',
      category: 'Implant',
      implant_id: implantId,
      implant_row_id: row.id,
      implant_service: row.service_id || '',
      notes: row.notes || '',
    };
  });
}

export function implantPlanTotal(implant) {
  return implantPlanLines(implant).reduce((sum, line) => sum + num(line.price), 0);
}

/** Mavjud rejadagi qatorlarni saqlab (holat, bajarilgan belgisi), shu implantning qatorlarini yangilaydi. */
export function mergeImplantLines(existingServices, newLines, implantId) {
  const key = String(implantId);
  const existing = Array.isArray(existingServices) ? existingServices : [];
  const byRow = new Map();
  existing.forEach((srv) => {
    if (srv && String(srv.implant_id ?? '') === key && srv.implant_row_id) byRow.set(srv.implant_row_id, srv);
  });
  const foreign = existing.filter((srv) => !(srv && String(srv.implant_id ?? '') === key));
  const merged = newLines.map((line) => {
    const prev = byRow.get(line.implant_row_id);
    if (!prev) return line;
    return {
      ...prev,
      ...line,
      status: prev.status || line.status,
      ...(prev.completed ? { completed: true } : {}),
    };
  });
  return [...merged, ...foreign];
}

export function servicesTotal(services) {
  return (services || []).reduce((sum, srv) => {
    if (Array.isArray(srv?.items) && srv.items.length) return sum + servicesTotal(srv.items);
    return sum + num(srv?.price ?? srv?.cost);
  }, 0);
}

/** Chegirma (agar rejada bo'lsa) hisobga olingan reja summasi. */
export function planTotalAfterDiscount(plan, services) {
  const raw = servicesTotal(services);
  const percent = num(plan?.discount_percent);
  const discount = percent > 0 ? Math.floor(raw * percent / 100) : Math.min(num(plan?.discount_amount), raw);
  return { raw, discount, total: Math.max(0, raw - discount) };
}

export function teethLabel(services) {
  const seen = [];
  (services || []).forEach((srv) => {
    String(srv?.tooth_number || '').split(/[,\s]+/).filter(Boolean).forEach((tooth) => {
      if (!seen.includes(tooth)) seen.push(tooth);
    });
  });
  return seen.sort((a, b) => Number(a) - Number(b)).join(', ');
}

export function planStatusFor(services) {
  const list = services || [];
  if (list.length && list.every(isDone)) return 'completed';
  if (list.some(isDone)) return 'in_progress';
  return 'planned';
}

const IMPLANT_LINE_RE = /implant|имплант/i;
const NOT_IMPLANT_RE = /abutment|abatment|abatmen|formik|koronka|karonka|crown|коронк|membran|sinus|suyak|bone/i;

/**
 * Boshqa rejalarda shu tishga allaqachon yozilgan (hali bajarilmagan) "Implant" qatorlari.
 * Ular implant rejasiga ko'chiriladi, aks holda bir narx ikki marta qarz bo'lib qoladi.
 */
export function findAdoptableLines(plans, implant) {
  const primaryTeeth = new Set(
    (buildLinkedServiceModel(implant).rows || [])
      .filter((row) => row.is_primary && row.tooth_number)
      .map((row) => String(row.tooth_number)),
  );
  const taken = new Set();
  const found = [];
  (plans || []).forEach((plan) => {
    if (!plan?.id || isImplantPlan(plan)) return;
    (plan.services || []).forEach((srv, index) => {
      if (!srv || Array.isArray(srv.items) || srv.implant_id || isDone(srv)) return;
      const label = `${srv.service_name || srv.name || ''}`;
      if (!IMPLANT_LINE_RE.test(label) || NOT_IMPLANT_RE.test(label)) return;
      const tooth = String(toImplantFdi(srv.tooth_number ?? srv.tooth_id ?? srv.tooth) || srv.tooth_number || '');
      if (!tooth || !primaryTeeth.has(tooth) || taken.has(tooth)) return;
      taken.add(tooth);
      found.push({ plan, index, tooth });
    });
  });
  return found;
}

// ───────────────────────── Backfill / status / extra-service helpers ─────────────────────────

/** Implant hayot sikli bosqichi: -1 failure, 0 rejada, 1 o'rnatildi, 2 formik/healing, 3 abutment, 4 koronka, 5 tugallangan. */
export function lifecycleRank(raw) {
  const text = String(raw ?? '').toLowerCase();
  if (!text) return 0;
  if (text.includes('fail') || text.includes('muvaffaqiyatsiz')) return -1;
  if (text.includes('tugal') || text.includes('complet') || text.includes('yakun')) return 5;
  if (text.includes('protez') || text.includes('crown') || text.includes('koronka') || text.includes('karonka')) return 4;
  if (text.includes('abutment') || text.includes('abatment')) return 3;
  if (text.includes('formik') || text.includes('fomik') || text.includes('healing')) return 2;
  if (/o.?rnat/.test(text) || text.includes('placed') || text.includes('install')) return 1;
  return 0;
}

const FORMIK_RE = /formik|fomik|healing/i;
const ABUTMENT_RE = /abutment|abatment|abatmen|multi-?unit/i;
const CROWN_LINE_RE = /crown|karonka|koronka|zirkon|zircon|keramika|e-?max|vinir|veneer|toj|коронк/i;

function lineRequiredRank(line) {
  const label = `${line?.service_name || ''} ${line?.implant_service || ''}`;
  if (line?.implant_row_id && String(line.implant_row_id).startsWith('primary-')) return 1;
  if (FORMIK_RE.test(label)) return 2;
  if (ABUTMENT_RE.test(label)) return 3;
  if (CROWN_LINE_RE.test(label)) return 4;
  return 5;
}

/**
 * Implant hayot sikli bosqichiga qarab shu implantning reja qatorlarini "bajarildi" qiladi.
 * Faqat oldinga: bajarilgan qator qaytib "rejada" bo'lmaydi.
 */
export function applyLifecycleToLines(services, implantId, lifecycle) {
  const rank = lifecycleRank(lifecycle);
  const key = String(implantId);
  if (rank < 1) return { services: services || [], changed: false };
  let changed = false;
  const next = (services || []).map((srv) => {
    if (!srv || String(srv.implant_id ?? '') !== key || isDone(srv)) return srv;
    if (rank < lineRequiredRank(srv)) return srv;
    changed = true;
    return { ...srv, status: 'completed', completed: true };
  });
  return { services: next, changed };
}

/** Qatorlar holatidan reja holati. */
export function planStatusFromServices(services) {
  return planStatusFor(services);
}

/**
 * "Qo'shimcha xizmat" yozuvi (karonka, abutment, sinus va h.k.): alohida Implant yozuvi, lekin
 * bemorning mavjud "Implantlar" rejasiga qo'shiladi (yangi reja ochilmaydi).
 */
export function isExtraServiceRecord(implant) {
  const name = String(implant?.service_name || implant?.hizmat_turi || '').trim().toLowerCase();
  if (!name) return false;
  if (/olib|explant|shablon/.test(name)) return true;
  return !name.includes('implant');
}

/** Backfill uchun yaroqlimi: bemor bor, to'ldirilmagan stub emas, failure emas, narxi bor. */
export function isBackfillEligible(implant) {
  if (!implant?.id || !implant?.patient_id) return false;
  if (implant.needs_fill === true || implant.incomplete_data === true) return false;
  if (lifecycleRank(implant.lifecycle_status || implant.status) < 0) return false;
  return implantPlanTotal(implant) > 0;
}

/**
 * Boshqa (implant bo'lmagan) rejalarda shu tish uchun allaqachon BAJARILGAN "Implant" qatori bo'lsa,
 * implant rejasiga asosiy implant qatorini qo'shmaymiz (aks holda bir narx ikki marta hisoblanadi).
 */
export function billedElsewhereTeeth(plans, implant) {
  const primaryTeeth = new Set(
    (buildLinkedServiceModel(implant).rows || [])
      .filter((row) => row.is_primary && row.tooth_number)
      .map((row) => String(row.tooth_number)),
  );
  const result = new Set();
  (plans || []).forEach((plan) => {
    if (!plan?.id || isImplantPlan(plan)) return;
    (plan.services || []).forEach((srv) => {
      if (!srv || Array.isArray(srv.items) || srv.implant_id) return;
      const label = `${srv.service_name || srv.name || ''}`;
      if (!IMPLANT_LINE_RE.test(label) || NOT_IMPLANT_RE.test(label)) return;
      const tooth = String(toImplantFdi(srv.tooth_number ?? srv.tooth_id ?? srv.tooth) || srv.tooth_number || '');
      if (tooth && primaryTeeth.has(tooth)) result.add(tooth);
    });
  });
  return [...result];
}

/** Qo'shimcha xizmat qaysi mavjud implant rejasiga qo'shiladi: shu tishli reja, bo'lmasa eng eskisi. */
export function pickHostPlan(plans, implant) {
  const hosts = (plans || [])
    .filter((plan) => plan?.id && isImplantPlan(plan))
    .sort((a, b) => String(a.created_date || '').localeCompare(String(b.created_date || '')));
  if (hosts.length === 0) return null;
  const teeth = new Set(
    (buildLinkedServiceModel(implant).rows || []).map((row) => String(row.tooth_number || '')).filter(Boolean),
  );
  const byTooth = hosts.find((plan) => String(plan.tooth_number || '').split(/[,\s]+/).some((tooth) => teeth.has(tooth)));
  return byTooth || hosts[0];
}

// Foydalanuvchi qarzga yozishni rad etgan implantlar (belgi o'chirilgan yoki reja qo'lda o'chirilgan):
// avtomatik backfill ularga qayta reja ochmaydi. Brauzer bo'yicha saqlanadi.
const OPTOUT_KEY = 'implant_plan_optout_v1';

function readOptOut() {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = JSON.parse(localStorage.getItem(OPTOUT_KEY) || '[]');
    return Array.isArray(raw) ? raw.map(String) : [];
  } catch {
    return [];
  }
}

export function isPlanOptedOut(implantId) {
  return implantId != null && readOptOut().includes(String(implantId));
}

export function setPlanOptOut(implantId, optedOut) {
  try {
    if (implantId == null || typeof localStorage === 'undefined') return;
    const key = String(implantId);
    const list = readOptOut().filter((id) => id !== key);
    if (optedOut) list.push(key);
    localStorage.setItem(OPTOUT_KEY, JSON.stringify(list.slice(-2000)));
  } catch {
    /* localStorage mavjud emas */
  }
}
