/**
 * Staff drawer "Bu hafta" -> one day for one doctor:
 *  - the doctor's (non-cancelled) appointments that day
 *  - income payments that day (patient, amount, WHICH service it was paid for)
 * UI/logic only. Days are Asia/Tashkent calendar days (no toISOString shifting).
 */
import {
  matchStaff, dateKey, isIncomePayment, isCancelledStatus, isCompletedStatus, isInProgressStatus, timeToMinutes,
} from '@/utils/clinicMetrics';
import { dateKeyOf, paymentStamp } from '@/lib/clinicTime';
import { normalizePaidServices } from '@/lib/paymentPlanServices';

export function dayKeyOf(value) {
  return dateKeyOf(value) || dateKey(value);
}

const norm = (v) => String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');

function samePatient(a, b) {
  if (a?.patient_id != null && a.patient_id !== '' && b?.patient_id != null && b.patient_id !== '') {
    return String(a.patient_id) === String(b.patient_id);
  }
  const na = norm(a?.patient_name);
  return !!na && na === norm(b?.patient_name);
}

const patientKey = (r) => (r?.patient_id != null && r.patient_id !== '' ? `id:${r.patient_id}` : `n:${norm(r?.patient_name)}`);

/** Same clean-up the Payments page uses for the free-text service_name. */
function cleanServiceText(raw) {
  return String(raw || '')
    .replace(/^(Muddatli to'lov:\s*|Boshlang'ich to'lov:\s*|Reja yangilandi:\s*|Reja:\s*)/i, '')
    .replace(/\s*\(#\d+\)$/i, '')
    .replace(/\r?\n+/g, ', ')
    .replace(/\s+—\s+/g, ', ')
    .trim();
}

function uniq(list) {
  const seen = new Set();
  return list.filter((x) => {
    const k = norm(x);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * Which service(s) a payment was made for.
 * 1) paid_services lines saved with the payment  2) the payment's own service_name text
 * 3) the linked treatment plan (plan_id)          4) the patient's visit that day
 * 3 and 4 are approximate -> approx: true. Nothing found -> text ''.
 */
export function paymentServiceLabel(payment, { plans = [], dayAppts = [] } = {}) {
  const lines = normalizePaidServices(payment?.paid_services);
  const fromLines = uniq(lines.map((l) => {
    const name = l.service_name || l.plan_name;
    if (!name) return '';
    return l.tooth ? `${name} (${l.tooth})` : name;
  }));
  if (fromLines.length) return { text: fromLines.join(', '), approx: false };

  const own = cleanServiceText(payment?.service_name);
  if (own) return { text: own, approx: false };

  if (payment?.plan_id != null && payment.plan_id !== '') {
    const plan = (plans || []).find((pl) => String(pl.id) === String(payment.plan_id));
    const planName = String(plan?.name || '').trim();
    if (planName) return { text: planName, approx: true };
  }

  const visit = uniq(dayAppts.filter((a) => samePatient(a, payment)).map((a) => a.service_name));
  if (visit.length) return { text: visit.join(', '), approx: true };

  return { text: '', approx: false };
}

export function appointmentStatusKind(status) {
  if (isCompletedStatus(status)) return 'done';
  if (isInProgressStatus(status)) return 'live';
  return 'plan';
}

const STATUS_TEXT = {
  done: ['Bajarildi', 'Готово', 'Done'],
  live: ['Qabulda', 'На приёме', 'In chair'],
  waiting: ['Kutilmoqda', 'Ожидание', 'Waiting'],
  plan: ['Reja', 'План', 'Planned'],
  confirmed: ['Tasdiqlangan', 'Подтверждено', 'Confirmed'],
};

export function appointmentStatusText(status, language) {
  const idx = language === 'ru' ? 1 : language === 'en' ? 2 : 0;
  const kind = appointmentStatusKind(status);
  if (kind !== 'plan') return STATUS_TEXT[kind][idx];
  const s = norm(status).replace(/[\s_-]+/g, '');
  if (!s || s === 'scheduled' || s === 'pending' || s === 'rejalashtirilgan' || s === 'reja') return STATUS_TEXT.plan[idx];
  if (s === 'waiting' || s === 'kutilmoqda') return STATUS_TEXT.waiting[idx];
  if (s === 'confirmed' || s === 'tasdiqlangan') return STATUS_TEXT.confirmed[idx];
  return String(status);
}

const hhmm = (t) => (t ? String(t).slice(0, 5) : '');

/**
 * Everything the drawer shows for one doctor on one day (YYYY-MM-DD).
 * staff = the users list (same list the cards are matched against).
 */
export function buildStaffDay({ staffId, staff, payments, appointments, plans, dayKey }) {
  const empty = { appointments: [], payments: [], patients: 0, income: 0 };
  if (!dayKey || staffId == null) return empty;
  const mine = (record) => {
    const s = matchStaff(record, staff);
    return !!s && String(s.id) === String(staffId);
  };

  const appts = (appointments || [])
    .filter((a) => mine(a) && !isCancelledStatus(a.status) && dayKeyOf(a.date) === dayKey)
    .sort((a, b) => (timeToMinutes(a.time) ?? 1e9) - (timeToMinutes(b.time) ?? 1e9));

  // This doctor's payments that day. A payment with no doctor at all still counts when
  // that patient was seen by this doctor that day.
  const dayPays = (payments || []).filter((p) => {
    if (!isIncomePayment(p)) return false;
    if (dayKeyOf(p.date || p.created_date || p.created_at) !== dayKey) return false;
    if (matchStaff(p, staff)) return mine(p);
    return appts.some((a) => samePatient(a, p));
  });

  const payRows = dayPays
    .map((p) => {
      const stamp = paymentStamp(p);
      const svc = paymentServiceLabel(p, { plans, dayAppts: appts });
      return {
        id: p.id,
        patient: p.patient_name || '',
        amount: Number(p.amount) || 0,
        time: stamp.time || '',
        service: svc.text,
        approx: svc.approx,
      };
    })
    .sort((a, b) => (timeToMinutes(a.time) ?? 1e9) - (timeToMinutes(b.time) ?? 1e9));

  return {
    appointments: appts.map((a) => ({
      id: a.id,
      time: hhmm(a.time),
      patient: a.patient_name || '',
      service: [a.service_name, a.tooth_number ? `${a.tooth_number}-tish` : ''].filter(Boolean).join(' · '),
      status: a.status,
      kind: appointmentStatusKind(a.status),
    })),
    payments: payRows,
    patients: new Set([...appts, ...dayPays].map(patientKey)).size,
    income: payRows.reduce((s, r) => s + r.amount, 0),
  };
}
