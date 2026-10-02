// Bemor profilidagi "Davolash rejalari": har bir reja bitta qator sifatida ko'rsatiladi.
// Bu yerda faqat ko'rinish uchun hisob-kitoblar (bazaga yozilmaydi).
import { isPlanLocked } from '@/lib/planLock';

const toTime = (value) => {
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
};

// Rejalar yaratilish sanasi bo'yicha (eng eskisi = "Reja 1") raqamlanadi.
export function numberPlans(plans = []) {
  const ordered = [...(plans || [])]
    .map((plan, index) => ({ plan, index }))
    .sort((a, b) => (toTime(a.plan.created_date || a.plan.date) - toTime(b.plan.created_date || b.plan.date)) || (a.index - b.index));
  const map = new Map();
  ordered.forEach(({ plan, index }, i) => map.set(plan.id ?? `idx-${index}`, i + 1));
  return (plan, index = 0) => map.get(plan.id ?? `idx-${index}`) || index + 1;
}

export function planToothList(plan) {
  const seen = new Set();
  const add = (value) => {
    String(value ?? '')
      .split(/[,\s]+/)
      .map((part) => part.replace(/^#/, '').trim())
      .filter((part) => part && part !== '—' && part !== '-')
      .forEach((part) => seen.add(part));
  };
  (plan?.services || []).forEach((srv) => add(srv.tooth_number ?? srv.tooth_id));
  if (seen.size === 0) add(plan?.tooth_number);
  return [...seen].sort((a, b) => Number(a) - Number(b));
}

export function formatPlanTeeth(teeth = [], limit = 6) {
  if (!teeth.length) return '';
  const shown = teeth.slice(0, limit).join(', ');
  return teeth.length > limit ? `${shown} +${teeth.length - limit}` : shown;
}

// "Reja 2 (#11, 21)"
export function planTitle(number, plan) {
  const teeth = formatPlanTeeth(planToothList(plan));
  return teeth ? `Reja ${number} (#${teeth})` : `Reja ${number}`;
}

export function planTotal(plan) {
  const total = Number(plan?.total_price || 0);
  if (total > 0) return total;
  return (plan?.services || []).reduce((sum, srv) => sum + Number(srv.price || srv.cost || 0), 0);
}

export function planPaid(plan, allPlans = [], effectiveTotalPaid = 0) {
  const price = planTotal(plan);
  if ((allPlans || []).length === 1) {
    return Math.min(price, Math.max(Number(plan?.paid_amount || 0), Number(effectiveTotalPaid || 0)));
  }
  return Number(plan?.paid_amount || 0);
}

const DONE = ['completed', 'bajarildi', 'bajarilgan'];
const PROGRESS = ['in_progress', 'jarayonda'];

export function isDoneStatus(status) {
  return DONE.includes(String(status || '').toLowerCase());
}

// 'completed' | 'in_progress' | 'planned'
export function planStatusKey(plan) {
  const own = String(plan?.status || '').toLowerCase();
  const services = plan?.services || [];
  if (services.length > 0) {
    const done = services.filter((srv) => isDoneStatus(srv.status) || srv.completed === true).length;
    if (done === services.length) return 'completed';
    if (done > 0 || services.some((srv) => PROGRESS.includes(String(srv.status || '').toLowerCase()))) return 'in_progress';
  }
  if (DONE.includes(own)) return 'completed';
  if (PROGRESS.includes(own)) return 'in_progress';
  return 'planned';
}

export function planProgress(plan) {
  const services = plan?.services || [];
  const done = services.filter((srv) => isDoneStatus(srv.status) || srv.completed === true).length;
  return { done, total: services.length };
}

export { isPlanLocked };
