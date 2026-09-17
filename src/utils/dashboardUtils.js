import { base44 } from '@/api/base44Client';
import { getTashkentDate, getTashkentNow } from '@/lib/telegramReminderService';

/** Local calendar YYYY-MM-DD — same rules as ChairsideToday queue. */
export function toDateOnly(value) {
  if (!value) return '';
  const raw = String(value);
  if (raw.includes('T')) return raw.split('T')[0];
  if (raw.includes(' ')) return raw.split(' ')[0];
  if (raw.includes('.')) {
    const parts = raw.split('.');
    if (parts.length === 3) {
      return parts[0].length === 4
        ? `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`
        : `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  return raw.slice(0, 10);
}

function isIncomePayment(p) {
  return String(p?.type || 'Income').toLowerCase() === 'income';
}

function paymentDate(p) {
  return toDateOnly(p?.date || p?.created_date || p?.created_at);
}

function appointmentDate(a) {
  return toDateOnly(a?.date);
}

function patientCreatedDate(p) {
  return toDateOnly(p?.created_date || p?.created_at);
}

function shiftTashkentDate(days) {
  const t = getTashkentNow();
  t.setDate(t.getDate() + days);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

/** Match chairside doctor filter: doctor_id OR doctor_name. */
function matchesDoctor(row, doctor) {
  if (!doctor) return true;
  const byId =
    row?.doctor_id != null &&
    String(row.doctor_id) === String(doctor.id);
  const doctorName = (doctor.name || doctor.full_name || '').trim().toLowerCase();
  const byName =
    doctorName &&
    (row?.doctor_name || '').trim().toLowerCase() === doctorName;
  return byId || byName;
}

/**
 * Professional Dashboard Data Fetcher
 * Aligns today KPIs with ChairsideToday queue (Tashkent day + doctor match).
 */
export async function fetchDashboardStats(user, isDoctor, isAdmin) {
  const today = getTashkentDate();

  // Same volume strategy as chairside: list then client-filter (API doctor_id-only
  // filter undercounts when appointments only store doctor_name).
  const [apptsRaw, pats, paysRaw, totalPatientsCount] = await Promise.all([
    base44.entities.Appointment.list('-date', 800),
    base44.entities.Patient.list('-created_date', 200),
    base44.entities.Payment.list('-date', 1000),
    base44.entities.Patient.count(),
  ]);

  const recalls = [];
  const expenses = [];
  const inventory = [];

  let appointments = apptsRaw || [];
  let payments = (paysRaw || []).filter(isIncomePayment);

  if (isDoctor && user) {
    appointments = appointments.filter((a) => matchesDoctor(a, user));
    payments = payments.filter((p) => matchesDoctor(p, user));
  }

  const patients = pats || [];

  const todayAppts = appointments.filter((a) => appointmentDate(a) === today);

  const todayRevenue = payments
    .filter((p) => paymentDate(p) === today)
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  // Rolling last 7 calendar days in Asia/Tashkent (including today)
  const weekStartStr = shiftTashkentDate(-6);
  const weekRevenue = payments
    .filter((p) => {
      const d = paymentDate(p);
      return d && d >= weekStartStr && d <= today;
    })
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const calculateTrend = (current, previous) => {
    if (current === 0 && previous === 0) return '0%';
    if (!previous || previous === 0) return '—';
    if (current === 0) return '—';
    const diff = ((current - previous) / previous) * 100;
    const sign = diff >= 0 ? '+' : '';
    return `${sign}${diff.toFixed(0)}%`;
  };

  const yesterday = shiftTashkentDate(-1);
  const lastWeekStartStr = shiftTashkentDate(-13);
  const lastWeekEndStr = shiftTashkentDate(-7);

  const yesterdayAppts = appointments.filter((a) => appointmentDate(a) === yesterday);
  const todayApptsTrend = calculateTrend(todayAppts.length, yesterdayAppts.length);

  const yesterdayRevenue = payments
    .filter((p) => paymentDate(p) === yesterday)
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const todayRevenueTrend = calculateTrend(todayRevenue, yesterdayRevenue);

  const lastWeekRevenue = payments
    .filter((p) => {
      const d = paymentDate(p);
      return d && d >= lastWeekStartStr && d <= lastWeekEndStr;
    })
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const weekRevenueTrend = calculateTrend(weekRevenue, lastWeekRevenue);

  // New patients this week (same created_date/created_at fields as Patients list)
  const newPatientsThisWeek = patients.filter((p) => {
    const d = patientCreatedDate(p);
    return d && d >= weekStartStr && d <= today;
  }).length;

  const newPatientsLastWeek = patients.filter((p) => {
    const d = patientCreatedDate(p);
    return d && d >= lastWeekStartStr && d <= lastWeekEndStr;
  }).length;

  const newPatientsTrend = calculateTrend(newPatientsThisWeek, newPatientsLastWeek);

  const todayCompleted = todayAppts.filter(
    (a) => (a.status || '').toLowerCase() === 'completed'
  ).length;
  const todayWaiting = todayAppts.filter((a) => {
    const s = (a.status || '').toLowerCase();
    return s === 'waiting' || s === 'scheduled' || s === 'planned';
  }).length;
  const todayNoShow = todayAppts.filter((a) => {
    const s = (a.status || '').toLowerCase();
    return s === 'no-show' || s === 'noshow' || s === 'no_show';
  }).length;

  const efficiencyBase = todayCompleted + todayNoShow;
  const realEfficiency =
    efficiencyBase > 0 ? Math.round((todayCompleted / efficiencyBase) * 100) : null;

  return {
    appointments,
    patients,
    payments,
    recalls,
    expenses,
    inventory,
    totalPatients: totalPatientsCount,
    newPatients: newPatientsThisWeek,
    clinicDayLabel: today,
    stats: {
      todayAppts: todayAppts.length,
      todayRevenue,
      weekRevenue,
      newPatients: newPatientsThisWeek,
      totalPatients: totalPatientsCount || 0,
      pendingRecalls: recalls.filter(
        (r) => r && r.status?.toLowerCase() === 'pending'
      ).length,
      lowStock: inventory.filter(
        (i) => i && (Number(i.quantity) || 0) <= (Number(i.min_quantity) || 10)
      ).length,
      todayApptsTrend,
      todayRevenueTrend,
      weekRevenueTrend,
      newPatientsTrend,
      todayCompleted,
      todayWaiting,
      todayNoShow,
      realEfficiency,
    },
    todayApptsList: todayAppts,
  };
}
