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
export function implantPlanLines(implant) {
  const model = buildLinkedServiceModel(implant);
  const implantId = implant?.id != null ? String(implant.id) : '';
  return (model.rows || []).map((row) => {
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
