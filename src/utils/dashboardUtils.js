import { base44 } from '@/api/base44Client';
import { getTashkentDate, getTashkentNow } from '@/lib/telegramReminderService';

/** Local calendar YYYY-MM-DD from payment/appointment date fields (Asia/Tashkent-safe string slice). */
export function toDateOnly(value) {
  if (!value) return '';
  const raw = String(value);
  if (raw.includes('T')) return raw.split('T')[0];
  if (raw.includes(' ')) return raw.split(' ')[0];
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

/**
 * Professional Dashboard Data Fetcher
 * Centralizes logic for both Desktop and Mobile dashboards.
 * Aligns KPI filters with Appointments/Payments list pages + Asia/Tashkent calendar days.
 */
export async function fetchDashboardStats(user, isDoctor, isAdmin) {
  const today = getTashkentDate();
  const doctorFilter = isDoctor ? { doctor_id: user?.id } : {};

  // Match list-page volumes so today/week KPIs are not truncated by tiny limits.
  const [appts, pats, pays, totalPatientsCount] = await Promise.all([
    base44.entities.Appointment.filter(doctorFilter, '-date', 500),
    base44.entities.Patient.list('-created_date', 200),
    base44.entities.Payment.filter(isDoctor ? { ...doctorFilter, type: 'Income' } : {}, '-date', 500),
    base44.entities.Patient.count(),
  ]);

  const recalls = [];
  const expenses = [];
  const inventory = [];

  const appointments = appts || [];
  const patients = pats || [];
  const payments = (pays || []).filter(isIncomePayment);

  const todayAppts = appointments.filter(a => appointmentDate(a) === today);

  const todayRevenue = payments
    .filter(p => paymentDate(p) === today)
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  // Rolling last 7 calendar days in Asia/Tashkent (including today)
  const weekStartStr = shiftTashkentDate(-6);
  const weekRevenue = payments
    .filter(p => {
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

  const yesterdayAppts = appointments.filter(a => appointmentDate(a) === yesterday);
  const todayApptsTrend = calculateTrend(todayAppts.length, yesterdayAppts.length);

  const yesterdayRevenue = payments
    .filter(p => paymentDate(p) === yesterday)
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const todayRevenueTrend = calculateTrend(todayRevenue, yesterdayRevenue);

  const lastWeekRevenue = payments
    .filter(p => {
      const d = paymentDate(p);
      return d && d >= lastWeekStartStr && d <= lastWeekEndStr;
    })
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const weekRevenueTrend = calculateTrend(weekRevenue, lastWeekRevenue);

  // New patients this week (same created_date/created_at fields as Patients list)
  const newPatientsThisWeek = patients.filter(p => {
    const d = patientCreatedDate(p);
    return d && d >= weekStartStr && d <= today;
  }).length;

  const newPatientsLastWeek = patients.filter(p => {
    const d = patientCreatedDate(p);
    return d && d >= lastWeekStartStr && d <= lastWeekEndStr;
  }).length;

  const newPatientsTrend = calculateTrend(newPatientsThisWeek, newPatientsLastWeek);

  const todayCompleted = todayAppts.filter(a => (a.status || '').toLowerCase() === 'completed').length;
  const todayWaiting = todayAppts.filter(a => {
    const s = (a.status || '').toLowerCase();
    return s === 'waiting' || s === 'scheduled' || s === 'planned';
  }).length;
  const todayNoShow = todayAppts.filter(a => {
    const s = (a.status || '').toLowerCase();
    return s === 'no-show' || s === 'noshow' || s === 'no_show';
  }).length;

  const efficiencyBase = todayCompleted + todayNoShow;
  const realEfficiency = efficiencyBase > 0
    ? Math.round((todayCompleted / efficiencyBase) * 100)
    : null;

  return {
    appointments,
    patients,
    payments,
    recalls,
    expenses,
    inventory,
    totalPatients: totalPatientsCount,
    newPatients: newPatientsThisWeek,
    stats: {
      todayAppts: todayAppts.length,
      todayRevenue,
      weekRevenue,
      newPatients: newPatientsThisWeek,
      totalPatients: totalPatientsCount || 0,
      pendingRecalls: recalls.filter(r => r && r.status?.toLowerCase() === 'pending').length,
      lowStock: inventory.filter(i => i && (Number(i.quantity) || 0) <= (Number(i.min_quantity) || 10)).length,
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
