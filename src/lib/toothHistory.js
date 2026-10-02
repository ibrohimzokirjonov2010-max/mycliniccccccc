import { internalIdToFdi } from '@/lib/fdiNotation';
import { formatClinicDate } from '@/lib/clinicTime';

const DONE_STATUSES = new Set([
  'completed', 'bajarildi', 'bajarilgan', 'paid', 'done', 'yakunlangan', 'yakunlandi',
]);

function isDone(value) {
  return DONE_STATUSES.has(String(value || '').toLowerCase().trim());
}

function serviceIsDone(svc, plan) {
  if (svc?.completed === true) return true;
  if (isDone(svc?.status) || isDone(svc?.payment_status)) return true;
  if (svc?.status || svc?.payment_status) return false;
  return isDone(plan?.status);
}

/** "11", "#11", "ur1", "11, 21" → ['11', '21'] (only real FDI numbers). */
export function toothTokens(raw) {
  const out = [];
  String(raw ?? '')
    .split(/[,;\s]+/)
    .map((token) => token.replace(/^#/, '').trim())
    .filter(Boolean)
    .forEach((token) => {
      let fdi = '';
      if (/^[1-8][1-8]$/.test(token)) fdi = token;
      else {
        const converted = internalIdToFdi(token);
        if (converted && /^[1-8][1-8]$/.test(String(converted))) fdi = String(converted);
      }
      if (fdi && !out.includes(fdi)) out.push(fdi);
    });
  return out;
}

function flattenServices(plan) {
  const raw = Array.isArray(plan?.services) ? plan.services : [];
  const rows = [];
  raw.forEach((item) => {
    if (!item) return;
    if (Array.isArray(item.items)) {
      item.items.forEach((svc) => rows.push({
        ...svc,
        service_name: svc.service_name || svc.name || item.service_name,
        tooth_number: svc.tooth_number || svc.tooth_id || svc.tooth || item.tooth_number || item.tooth_id || item.tooth,
        status: svc.status || item.status,
        payment_status: svc.payment_status || item.payment_status,
      }));
      return;
    }
    rows.push({
      ...item,
      service_name: item.service_name || item.name,
      tooth_number: item.tooth_number || item.tooth_id || item.tooth,
    });
  });
  return rows;
}

/**
 * Per-tooth history of a patient from saved treatment plans.
 * Returns { [fdi]: [{ name, done, date, dateLabel, planName }] } (newest first).
 */
export function buildToothHistory(plans, { excludePlanId } = {}) {
  const map = {};
  (plans || []).forEach((plan) => {
    if (!plan || (excludePlanId && String(plan.id) === String(excludePlanId))) return;
    const st = String(plan.status || '').toLowerCase();
    if (st === 'cancelled' || st === 'canceled') return;
    flattenServices(plan).forEach((svc) => {
      const name = String(svc.service_name || '').trim();
      if (!name) return;
      const teeth = toothTokens(svc.tooth_number || plan.tooth_number);
      if (!teeth.length) return;
      const done = serviceIsDone(svc, plan);
      const date = svc.completed_at || svc.completed_date || svc.date || plan.created_date || plan.created_at || plan.date || '';
      teeth.forEach((fdi) => {
        (map[fdi] = map[fdi] || []).push({
          name,
          done,
          date,
          dateLabel: date ? formatClinicDate(date) : '',
          planName: plan.name || '',
        });
      });
    });
  });
  Object.values(map).forEach((rows) => rows.sort((a, b) => String(b.date).localeCompare(String(a.date))));
  return map;
}
