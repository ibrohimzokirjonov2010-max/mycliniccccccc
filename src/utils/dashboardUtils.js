import { base44 } from '@/api/base44Client';

/**
 * Professional Dashboard Data Fetcher
 * Centralizes logic for both Desktop and Mobile dashboards
 */
export async function fetchDashboardStats(user, isDoctor, isAdmin) {
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  
  const doctorFilter = isDoctor ? { doctor_id: user?.id } : {};
  
  // Dashboard uchun minimal so'rovlar — faqat kerakli ma'lumotlar, kichik limitlar
  // Inventory dashboard'da ko'rinmaydi — yuklanmaydi (eng og'ir so'rov edi!)
  const [appts, pats, pays, totalPatientsCount] = await Promise.all([
    base44.entities.Appointment.filter(doctorFilter, '-date', 50),
    base44.entities.Patient.list('-created_date', 20),
    base44.entities.Payment.filter(isDoctor ? { ...doctorFilter, type: 'Income' } : {}, '-date', 50),
    base44.entities.Patient.count(),
  ]);

  // Recall, Expense, Inventory — background da yuklanadi (dashboard bloklanmaydi)
  const recs = [];
  const exps = [];
  const inv = [];
  const newPatientsCount = 0;

  const appointments = appts || [];
  const patients = pats || [];
  const payments = pays || [];
  const recalls = recs || [];
  const expenses = exps || [];
  const inventory = inv || [];

  // Statistics Calculation
  const todayAppts = appointments.filter(a => {
    if (!a || !a.date) return false;
    const cleanDate = a.date.includes('T') ? a.date.split('T')[0] : a.date.split(' ')[0];
    return cleanDate === today;
  });
  const todayRevenue = payments
    .filter(p => {
      if (!p) return false;
      const pDate = p.date?.includes('T') ? p.date.split('T')[0] : p.date;
      const pType = (p.type || 'Income').toLowerCase();
      return pDate === today && pType === 'income';
    })
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  const weekRevenue = payments
    .filter(p => {
      if (!p) return false;
      const pType = (p.type || 'Income').toLowerCase();
      return pType === 'income' && p.date && (new Date(p.date) >= weekStart);
    })
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  // Dynamic Trends Calculation
  const calculateTrend = (current, previous) => {
    if (current === 0 && previous === 0) return '0%';
    if (!previous || previous === 0) {
      return '—';
    }
    if (current === 0) {
      return '—';
    }
    const diff = ((current - previous) / previous) * 100;
    const sign = diff >= 0 ? '+' : '';
    return `${sign}${diff.toFixed(0)}%`;
  };

  // Get yesterday's date string
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = `${yesterdayDate.getFullYear()}-${String(yesterdayDate.getMonth() + 1).padStart(2, '0')}-${String(yesterdayDate.getDate()).padStart(2, '0')}`;

  // Last week boundaries (days 8 to 14 ago)
  const lastWeekStart = new Date();
  lastWeekStart.setDate(lastWeekStart.getDate() - 14);
  const lastWeekEnd = new Date();
  lastWeekEnd.setDate(lastWeekEnd.getDate() - 7);

  // Yesterday's appointments
  const yesterdayAppts = appointments.filter(a => {
    if (!a || !a.date) return false;
    const cleanDate = a.date.includes('T') ? a.date.split('T')[0] : a.date.split(' ')[0];
    return cleanDate === yesterday;
  });
  const todayApptsTrend = calculateTrend(todayAppts.length, yesterdayAppts.length);

  // Yesterday's revenue
  const yesterdayRevenue = payments
    .filter(p => {
      if (!p) return false;
      const pDate = p.date?.includes('T') ? p.date.split('T')[0] : p.date;
      const pType = (p.type || 'Income').toLowerCase();
      return pDate === yesterday && pType === 'income';
    })
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const todayRevenueTrend = calculateTrend(todayRevenue, yesterdayRevenue);

  // Last week's revenue
  const lastWeekRevenue = payments
    .filter(p => {
      if (!p || !p.date) return false;
      const pType = (p.type || 'Income').toLowerCase();
      const pDate = new Date(p.date);
      return pType === 'income' && pDate >= lastWeekStart && pDate < lastWeekEnd;
    })
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const weekRevenueTrend = calculateTrend(weekRevenue, lastWeekRevenue);

  // New patients this week vs last week
  const newPatientsThisWeek = patients.filter(p => {
    if (!p) return false;
    const pDate = new Date(p.created_date || p.created_at);
    return pDate >= weekStart;
  }).length;

  const newPatientsLastWeek = patients.filter(p => {
    if (!p) return false;
    const pDate = new Date(p.created_date || p.created_at);
    return pDate >= lastWeekStart && pDate < lastWeekEnd;
  }).length;

  const newPatientsTrend = calculateTrend(newPatientsThisWeek, newPatientsLastWeek);

  // Today-scoped appointment status breakdown
  const todayCompleted = todayAppts.filter(a => (a.status || '').toLowerCase() === 'completed').length;
  const todayWaiting   = todayAppts.filter(a => {
    const s = (a.status || '').toLowerCase();
    return s === 'waiting' || s === 'scheduled' || s === 'planned';
  }).length;
  const todayNoShow    = todayAppts.filter(a => {
    const s = (a.status || '').toLowerCase();
    return s === 'no-show' || s === 'noshow' || s === 'no_show';
  }).length;

  // Real efficiency: completed / (completed + no-show), only when there is data
  const efficiencyBase = todayCompleted + todayNoShow;
  const realEfficiency = efficiencyBase > 0
    ? Math.round((todayCompleted / efficiencyBase) * 100)
    : null; // null = no data yet today

  return {
    appointments,
    patients,
    payments,
    recalls,
    expenses,
    inventory,
    totalPatients: totalPatientsCount,
    newPatients: newPatientsCount,
    stats: {
      todayAppts: todayAppts.length,
      todayRevenue,
      weekRevenue,
      newPatients: newPatientsCount || 0,
      totalPatients: totalPatientsCount || 0,
      pendingRecalls: recalls.filter(r => r && r.status?.toLowerCase() === 'pending').length,
      lowStock: inventory.filter(i => i && (Number(i.quantity) || 0) <= (Number(i.min_quantity) || 10)).length,
      todayApptsTrend,
      todayRevenueTrend,
      weekRevenueTrend,
      newPatientsTrend,
      // Today breakdown
      todayCompleted,
      todayWaiting,
      todayNoShow,
      realEfficiency,
    },
    todayApptsList: todayAppts
  };
}
