import { useState, useEffect, useMemo, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useTranslation } from '@/i18n/LanguageContext';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/useIsMobile';
import { dateKey, fmtMoney, isIncomePayment, roleLabel } from '@/utils/clinicMetrics';
import { displayDoctorName, getTreatmentTypeLabel } from '@/lib/utils';
import ReportsDashboard from '@/pages/reports/ReportsDashboard';

// Standard Uzbek Months
const UZ_MONTHS = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'
];

/**
 * Reports Page - Professional Excel Spreadsheet View
 */
export default function Reports() {
  const { language } = useTranslation();
  const [payments, setPayments] = useState([]);
  const [, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & Tabs
  const [period, setPeriod] = useState('all'); // 'all' | 'this_month' | 'last_month' | 'year' | 'custom'
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [activeReportTab, setActiveReportTab] = useState('overview');
  const phone = useIsMobile(641);
  const inMobileShell = useIsMobile(1024);
  const [searchQuery, setSearchQuery] = useState('');

  // Sorting state for Doctors Table
  const [docSortField, setDocSortField] = useState('revenue');
  const [docSortOrder, setDocSortOrder] = useState('desc');

  const handleDocSort = (field) => {
    if (docSortField === field) {
      setDocSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setDocSortField(field);
      setDocSortOrder('desc');
    }
  };

  // Sorting state for Finance Table
  const [finSortField] = useState('month');
  const [finSortOrder] = useState('desc');

  // Sorting state for Services Table
  const [srvSortField] = useState('revenue');
  const [srvSortOrder] = useState('desc');

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [pays, pats, appts, exps, users] = await Promise.all([
          base44.entities.Payment.list('-date', 500),
          base44.entities.Patient.list('-created_date', 300),
          base44.entities.Appointment.list('-date', 500),
          base44.entities.Expense.list('-date', 300),
          base44.entities.User.list('name', 100),
        ]);
        setPayments(pays || []);
        setPatients(pats || []);
        setAppointments(appts || []);
        setExpenses(exps || []);
        setDoctors((users || []).filter(u => u.role === 'doctor' || u.role === 'admin' || u.specialty || u.name));
      } catch (err) {
        console.error("Report load error:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const chartLocale = useMemo(() => {
    if (language === 'uz') return 'uz-UZ';
    if (language === 'ru') return 'ru-RU';
    return 'en-US';
  }, [language]);

  const formatMonthLabel = useCallback((monthStr) => {
    if (!monthStr) return '';
    const [year, month] = monthStr.split('-').map(Number);
    if (!year || !month) return monthStr;
    if (language === 'uz') {
      return `${UZ_MONTHS[month - 1]} ${year}`;
    }
    const date = new Date(year, month - 1, 15);
    return date.toLocaleDateString(chartLocale, { month: 'short', year: 'numeric' });
  }, [language, chartLocale]);

  const formatChartYAxis = useCallback((val) => {
    if (!val || val === 0) return '0';
    const num = Number(val);
    if (isNaN(num)) return '0';
    if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1).replace(/\.0$/, '')} ${language === 'ru' ? 'млрд' : language === 'en' ? 'B' : 'mlrd'}`;
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1).replace(/\.0$/, '')} ${language === 'ru' ? 'млн' : language === 'en' ? 'M' : 'mln'}`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(0)} ${language === 'ru' ? 'тыс' : language === 'en' ? 'k' : 'ming'}`;
    return num.toLocaleString();
  }, [language]);

  // Date range filter helpers
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthStr = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;
  const currentYearStr = String(now.getFullYear());

  const filterByPeriod = useCallback((itemDate) => {
    if (!itemDate) return false;
    if (period === 'all') return true;
    const d = dateKey(itemDate);
    if (period === 'this_month') return d.startsWith(currentMonthStr);
    if (period === 'last_month') return d.startsWith(lastMonthStr);
    if (period === 'year') return d.startsWith(currentYearStr);
    if (period === 'custom') {
      if (!customFrom && !customTo) return true;
      if (customFrom && d < customFrom) return false;
      if (customTo && d > customTo) return false;
      return true;
    }
    return true;
  }, [period, currentMonthStr, lastMonthStr, currentYearStr, customFrom, customTo]);

  const filteredPayments = useMemo(() => payments.filter(p => filterByPeriod(p.date)), [payments, filterByPeriod]);
  const filteredAppointments = useMemo(() => appointments.filter(a => filterByPeriod(a.date)), [appointments, filterByPeriod]);
  const filteredExpenses = useMemo(() => expenses.filter(e => filterByPeriod(e.date)), [expenses, filterByPeriod]);

  // Overall Financial Stats
  const stats = useMemo(() => {
    const totalIncome = filteredPayments.filter(isIncomePayment).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const totalExpense = filteredExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const netProfit = totalIncome - totalExpense;
    const completedAppts = filteredAppointments.filter(a => (a.status || '').toLowerCase() === 'completed').length;
    const avgCheck = completedAppts > 0 ? Math.round(totalIncome / completedAppts) : (filteredPayments.length > 0 ? Math.round(totalIncome / filteredPayments.length) : 0);
    return { totalIncome, totalExpense, netProfit, completedAppts, avgCheck };
  }, [filteredPayments, filteredExpenses, filteredAppointments]);

  // ═════════════════════════════════════════════════════════════════════════
  // 1. DOCTORS LEADERBOARD DATA & EXCEL SORTING
  // ═════════════════════════════════════════════════════════════════════════
  const doctorLeaderboard = useMemo(() => {
    const docMap = {};

    const doctorsByPatient = {};
    filteredAppointments.forEach((a) => {
      if (!a.patient_id || !a.doctor_id) return;
      if (!doctorsByPatient[a.patient_id]) doctorsByPatient[a.patient_id] = new Set();
      doctorsByPatient[a.patient_id].add(String(a.doctor_id));
    });

    doctors.forEach(doc => {
      const name = displayDoctorName(doc.name || doc.full_name) || 'Shifokor';
      docMap[String(doc.id)] = {
        id: doc.id,
        name,
        specialty: doc.specialty || '',
        role: doc.role || '',
        roleLabel: roleLabel(doc.role || 'doctor', language),
        avatar: doc.avatar_url || doc.photo_url || doc.photo || doc.avatar || doc.image || '',
        revenue: 0,
        appointmentCount: 0,
        completedCount: 0,
        cancelledCount: 0,
        patientIds: new Set(),
      };
    });

    filteredPayments.filter(isIncomePayment).forEach(p => {
      let matchedDocId = p.doctor_id ? String(p.doctor_id) : null;
      if (!matchedDocId && p.doctor_name) {
        const found = doctors.find(d => (d.name && p.doctor_name.includes(d.name)) || (d.full_name && p.doctor_name.includes(d.full_name)));
        if (found) matchedDocId = String(found.id);
      }
      if (!matchedDocId && p.patient_id && doctorsByPatient[p.patient_id]?.size === 1) {
        matchedDocId = [...doctorsByPatient[p.patient_id]][0];
      }
      
      const key = matchedDocId || 'unassigned';
      if (!docMap[key]) {
        docMap[key] = {
          id: matchedDocId || key,
          name: 'Biriktirilmagan',
          specialty: '',
          role: '',
          roleLabel: '',
          avatar: '',
          revenue: 0,
          appointmentCount: 0,
          completedCount: 0,
          cancelledCount: 0,
          patientIds: new Set(),
        };
      }
      docMap[key].revenue += (Number(p.amount) || 0);
      if (p.patient_id) docMap[key].patientIds.add(p.patient_id);
    });

    filteredAppointments.forEach(a => {
      let matchedDocId = a.doctor_id ? String(a.doctor_id) : null;
      if (!matchedDocId && a.doctor_name) {
        const found = doctors.find(d => (d.name && a.doctor_name.includes(d.name)) || (d.full_name && a.doctor_name.includes(d.full_name)));
        if (found) matchedDocId = String(found.id);
      }
      
      const key = matchedDocId || 'unassigned';
      if (!docMap[key]) {
        docMap[key] = {
          id: matchedDocId || key,
          name: 'Biriktirilmagan',
          specialty: '',
          role: '',
          roleLabel: '',
          avatar: '',
          revenue: 0,
          appointmentCount: 0,
          completedCount: 0,
          cancelledCount: 0,
          patientIds: new Set(),
        };
      }
      docMap[key].appointmentCount += 1;
      const statusLower = (a.status || '').toLowerCase();
      if (statusLower === 'completed') {
        docMap[key].completedCount += 1;
      } else if (statusLower === 'cancelled' || statusLower.includes('no_show') || statusLower.includes('no-show')) {
        docMap[key].cancelledCount += 1;
      }
      if (a.patient_id) docMap[key].patientIds.add(a.patient_id);
    });

    const list = Object.values(docMap).map(doc => {
      const avgCheck = doc.completedCount > 0 
        ? Math.round(doc.revenue / doc.completedCount) 
        : (doc.appointmentCount > 0 ? Math.round(doc.revenue / doc.appointmentCount) : 0);
      const completionRate = doc.appointmentCount > 0 
        ? Math.round((doc.completedCount / doc.appointmentCount) * 100) 
        : 0;
      return {
        ...doc,
        uniquePatients: doc.patientIds.size,
        avgCheck,
        completionRate,
      };
    });

    const totalRev = list.reduce((sum, d) => sum + d.revenue, 0) || 1;

    let result = list.map(doc => ({
      ...doc,
      name: /^shifokor$/i.test(String(doc.name || '').trim()) && doc.revenue > 0 && doc.appointmentCount === 0
        ? 'Biriktirilmagan'
        : doc.name,
      revenueShare: Math.round((doc.revenue / totalRev) * 100)
    })).filter((doc) => !(doc.revenue === 0 && doc.appointmentCount === 0 && /^shifokor$/i.test(String(doc.name || '').trim())));

    if (searchQuery) {
      result = result.filter(d => 
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        d.specialty.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    result.sort((a, b) => {
      let valA, valB;
      switch (docSortField) {
        case 'name':
          valA = a.name.toLowerCase();
          valB = b.name.toLowerCase();
          return docSortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        case 'appointments':
          valA = a.appointmentCount;
          valB = b.appointmentCount;
          break;
        case 'patients':
          valA = a.uniquePatients;
          valB = b.uniquePatients;
          break;
        case 'completed':
          valA = a.completedCount;
          valB = b.completedCount;
          break;
        case 'avg_check':
          valA = a.avgCheck;
          valB = b.avgCheck;
          break;
        case 'share':
          valA = a.revenueShare;
          valB = b.revenueShare;
          break;
        case 'revenue':
        default:
          valA = a.revenue;
          valB = b.revenue;
          break;
      }
      if (valA !== valB) {
        return docSortOrder === 'asc' ? valA - valB : valB - valA;
      }
      // Secondary tie-breaker: sort by revenue then completed appointments
      if (b.revenue !== a.revenue) return b.revenue - a.revenue;
      return b.completedCount - a.completedCount;
    });

    return result.map((doc, idx) => ({ ...doc, rank: idx + 1 }));
  }, [doctors, filteredPayments, filteredAppointments, searchQuery, docSortField, docSortOrder, language]);

  // ═════════════════════════════════════════════════════════════════════════
  // 2. MONTHLY FINANCIAL REPORT DATA & EXCEL SORTING
  // ═════════════════════════════════════════════════════════════════════════
  const monthlyFinanceReport = useMemo(() => {
    const map = {};

    payments.filter(isIncomePayment).forEach(p => {
      const month = p.date?.substring(0, 7);
      if (month) {
        if (!map[month]) map[month] = { rawMonth: month, income: 0, expense: 0, appointments: 0 };
        map[month].income += (Number(p.amount) || 0);
      }
    });

    expenses.forEach(e => {
      const month = e.date?.substring(0, 7);
      if (month) {
        if (!map[month]) map[month] = { rawMonth: month, income: 0, expense: 0, appointments: 0 };
        map[month].expense += (Number(e.amount) || 0);
      }
    });

    appointments.forEach(a => {
      const month = a.date?.substring(0, 7);
      if (month) {
        if (!map[month]) map[month] = { rawMonth: month, income: 0, expense: 0, appointments: 0 };
        map[month].appointments += 1;
      }
    });

    let list = Object.values(map).map(item => {
      const net = item.income - item.expense;
      const margin = item.income > 0 ? Math.round((net / item.income) * 100) : 0;
      return {
        ...item,
        monthLabel: formatMonthLabel(item.rawMonth),
        net,
        margin
      };
    });

    list.sort((a, b) => {
      let valA, valB;
      switch (finSortField) {
        case 'income':
          valA = a.income;
          valB = b.income;
          return finSortOrder === 'asc' ? valA - valB : valB - valA;
        case 'expense':
          valA = a.expense;
          valB = b.expense;
          return finSortOrder === 'asc' ? valA - valB : valB - valA;
        case 'net':
          valA = a.net;
          valB = b.net;
          return finSortOrder === 'asc' ? valA - valB : valB - valA;
        case 'appointments':
          valA = a.appointments;
          valB = b.appointments;
          return finSortOrder === 'asc' ? valA - valB : valB - valA;
        case 'margin':
          valA = a.margin;
          valB = b.margin;
          return finSortOrder === 'asc' ? valA - valB : valB - valA;
        case 'month':
        default:
          valA = a.rawMonth;
          valB = b.rawMonth;
          return finSortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
    });

    return list;
  }, [payments, expenses, appointments, formatMonthLabel, finSortField, finSortOrder]);

  const visibleMonths = useMemo(() => {
    return monthlyFinanceReport.filter((m) => period === 'all' || filterByPeriod(`${m.rawMonth}-15`));
  }, [monthlyFinanceReport, period, filterByPeriod]);

  const financeChartData = useMemo(() => {
    const sorted = [...visibleMonths].sort((a, b) => a.rawMonth.localeCompare(b.rawMonth));
    const windowed = sorted.length > 8 ? sorted.slice(-8) : sorted;
    return windowed.map((d) => ({
      month: d.monthLabel.split(' ')[0],
      income: d.income,
      expense: d.expense,
      net: d.net,
    }));
  }, [visibleMonths]);

  // ═════════════════════════════════════════════════════════════════════════
  // 3. TOP SERVICES REPORT DATA & EXCEL SORTING
  // ═════════════════════════════════════════════════════════════════════════
  const servicesReport = useMemo(() => {
    const map = {};

    filteredPayments.filter(isIncomePayment).forEach(p => {
      const name = getTreatmentTypeLabel(p.service_name || p.category || 'Boshqa xizmatlar', language);
      if (!map[name]) {
        map[name] = { name, count: 0, revenue: 0 };
      }
      map[name].count += 1;
      map[name].revenue += (Number(p.amount) || 0);
    });

    const totalIncome = Object.values(map).reduce((sum, s) => sum + s.revenue, 0) || 1;

    let list = Object.values(map).map(s => ({
      ...s,
      avgPrice: Math.round(s.revenue / (s.count || 1)),
      share: Math.round((s.revenue / totalIncome) * 100)
    }));

    if (searchQuery) {
      list = list.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }

    list.sort((a, b) => {
      let valA, valB;
      switch (srvSortField) {
        case 'name':
          valA = a.name.toLowerCase();
          valB = b.name.toLowerCase();
          return srvSortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        case 'count':
          valA = a.count;
          valB = b.count;
          return srvSortOrder === 'asc' ? valA - valB : valB - valA;
        case 'avgPrice':
          valA = a.avgPrice;
          valB = b.avgPrice;
          return srvSortOrder === 'asc' ? valA - valB : valB - valA;
        case 'share':
          valA = a.share;
          valB = b.share;
          return srvSortOrder === 'asc' ? valA - valB : valB - valA;
        case 'revenue':
        default:
          valA = a.revenue;
          valB = b.revenue;
          return srvSortOrder === 'asc' ? valA - valB : valB - valA;
      }
    });

    return list;
  }, [filteredPayments, searchQuery, srvSortField, srvSortOrder, language]);

  // ═════════════════════════════════════════════════════════════════════════
  // 4. APPOINTMENTS BREAKDOWN DATA
  // ═════════════════════════════════════════════════════════════════════════
  const appointmentsStatusReport = useMemo(() => {
    const statusCounts = {};
    filteredAppointments.forEach(a => {
      const rawStatus = a.status || '';
      const lower = rawStatus.toLowerCase();
      let status = language === 'ru' ? 'Запланировано' : language === 'en' ? 'Scheduled' : 'Rejalashtirilgan';
      if (lower === 'completed' || lower === 'done' || lower === 'bajarilgan') status = language === 'ru' ? 'Выполнено' : language === 'en' ? 'Completed' : 'Bajarilgan';
      else if (lower === 'cancelled' || lower === 'canceled') status = language === 'ru' ? 'Отменено' : language === 'en' ? 'Cancelled' : 'Bekor qilingan';
      else if (lower.includes('no_show') || lower.includes('no-show') || lower.includes('noshow') || lower.includes('kelmagan')) status = language === 'ru' ? 'Неявка' : language === 'en' ? 'No-show' : 'Kelmagan';
      else if (lower.includes('progress')) status = language === 'ru' ? 'На приёме' : language === 'en' ? 'In progress' : 'Qabulda';
      else if (lower.includes('wait')) status = language === 'ru' ? 'Ожидание' : language === 'en' ? 'Waiting' : 'Kutilmoqda';
      else if (lower === 'scheduled' || lower === 'planned' || lower === '') status = language === 'ru' ? 'Запланировано' : language === 'en' ? 'Scheduled' : 'Rejalashtirilgan';
      else status = rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1);
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    const total = filteredAppointments.length || 1;
    const colors = {
      'Bajarilgan': '#059669',
      'Выполнено': '#059669',
      'Completed': '#059669',
      'Rejalashtirilgan': '#3B82F6',
      'Запланировано': '#3B82F6',
      'Scheduled': '#3B82F6',
      'Bekor qilingan': '#F43F5E',
      'Отменено': '#F43F5E',
      'Cancelled': '#F43F5E',
      'Kelmagan': '#94A3B8',
      'Неявка': '#94A3B8',
      'No-show': '#94A3B8',
      'Kutilmoqda': '#F59E0B',
      'Ожидание': '#F59E0B',
      'Waiting': '#F59E0B',
      'Qabulda': '#1499AD',
      'На приёме': '#1499AD',
      'In progress': '#1499AD',
    };

    return Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count,
      share: Math.round((count / total) * 100),
      color: colors[status] || '#94a3b8'
    }));
  }, [filteredAppointments, language]);

  /**
   * Export Active Report Table to CSV with UTF-8 BOM
   */
  const exportCSV = useCallback(() => {
    try {
      let headers = [];
      let rows = [];
      let filename = `Hisobot_${activeReportTab}_${new Date().toISOString().slice(0, 10)}.csv`;

      if (activeReportTab === 'doctors' || activeReportTab === 'overview') {
        headers = ["№", "Shifokor (F.I.Sh)", "Mutaxassislik", "Qabullar Soni", "Bajarilgan", "Noyob Bemorlar", "Umumiy Tushum (UZS)", "O'rtacha Chek (UZS)", "Ulush (%)"];
        rows = doctorLeaderboard.map((d, idx) => [
          idx + 1,
          `"${d.name.replace(/"/g, '""')}"`,
          `"${d.specialty.replace(/"/g, '""')}"`,
          d.appointmentCount,
          d.completedCount,
          d.uniquePatients,
          d.revenue,
          d.avgCheck,
          `${d.revenueShare}%`
        ].join(","));
      } else if (activeReportTab === 'finance') {
        headers = ["№", "Oy / Davr", "Qabullar Soni", "Kirim / Tushum (UZS)", "Chiqim / Xarajat (UZS)", "Sof Foyda (UZS)", "Rentabellik (%)"];
        rows = visibleMonths.map((f, idx) => [
          idx + 1,
          `"${f.monthLabel}"`,
          f.appointments,
          f.income,
          f.expense,
          f.net,
          `${f.margin}%`
        ].join(","));
      } else if (activeReportTab === 'services') {
        headers = ["№", "Xizmat Nomi", "Bajarilganlar Soni", "Umumiy Tushum (UZS)", "O'rtacha Narx (UZS)", "Ulush (%)"];
        rows = servicesReport.map((s, idx) => [
          idx + 1,
          `"${s.name.replace(/"/g, '""')}"`,
          s.count,
          s.revenue,
          s.avgPrice,
          `${s.share}%`
        ].join(","));
      } else {
        headers = ["№", "Qabul Holati", "Uchrashuvlar Soni", "Ulush (%)"];
        rows = appointmentsStatusReport.map((a, idx) => [
          idx + 1,
          `"${a.status}"`,
          a.count,
          `${a.share}%`
        ].join(","));
      }

      const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Hisobot Excel (.csv) formatida yuklab olindi!");
    } catch (err) {
      console.error(err);
      toast.error("Eksportda xatolik yuz berdi");
    }
  }, [activeReportTab, doctorLeaderboard, visibleMonths, servicesReport, appointmentsStatusReport]);

  const trends = useMemo(() => {
    const iso = (dt) => {
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const d = String(dt.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };
    const inRange = (value, from, to) => {
      const d = dateKey(value);
      if (!d) return false;
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    };
    const pack = (from, to) => {
      const income = payments.filter((p) => isIncomePayment(p) && inRange(p.date, from, to)).reduce((s, p) => s + (Number(p.amount) || 0), 0);
      const expense = expenses.filter((e) => inRange(e.date, from, to)).reduce((s, e) => s + (Number(e.amount) || 0), 0);
      const appts = appointments.filter((a) => inRange(a.date, from, to));
      return { income, expense, profit: income - expense, appointments: appts.length };
    };
    const change = (current, previous, mode) => {
      if (current === 0 && previous === 0) return null;
      if (mode === 'count') {
        const diff = current - previous;
        if (diff === 0) return { dir: 'flat', text: '0' };
        return { dir: diff > 0 ? 'up' : 'down', text: `${diff > 0 ? '+' : ''}${diff} ta` };
      }
      if (previous === 0) return { dir: current > 0 ? 'up' : 'down', text: current > 0 ? 'yangi' : '0' };
      const pct = Math.round(((current - previous) / Math.abs(previous)) * 100);
      if (pct === 0) return { dir: 'flat', text: '0%' };
      return { dir: pct > 0 ? 'up' : 'down', text: `${pct > 0 ? '+' : ''}${pct}%` };
    };

    let current;
    let previous;
    let note;
    if (period === 'this_month') {
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      current = { income: stats.totalIncome, expense: stats.totalExpense, profit: stats.netProfit, appointments: filteredAppointments.length };
      previous = pack(`${lastMonthStr}-01`, iso(prevEnd));
      note = language === 'ru' ? 'К прошлому месяцу' : language === 'en' ? 'Vs last month' : "O'tgan oyga nisbatan";
      void end;
    } else if (period === 'last_month') {
      const prevStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      const prevEnd = new Date(now.getFullYear(), now.getMonth() - 1, 0);
      current = { income: stats.totalIncome, expense: stats.totalExpense, profit: stats.netProfit, appointments: filteredAppointments.length };
      previous = pack(iso(prevStart), iso(prevEnd));
      note = language === 'ru' ? 'К предыдущему месяцу' : language === 'en' ? 'Vs the month before' : 'Oldingi oyga nisbatan';
    } else if (period === 'year') {
      const y = now.getFullYear() - 1;
      current = { income: stats.totalIncome, expense: stats.totalExpense, profit: stats.netProfit, appointments: filteredAppointments.length };
      previous = pack(`${y}-01-01`, `${y}-12-31`);
      note = language === 'ru' ? 'К прошлому году' : language === 'en' ? 'Vs last year' : "O'tgan yilga nisbatan";
    } else if (period === 'custom' && customFrom && customTo) {
      const from = new Date(`${customFrom}T00:00:00`);
      const to = new Date(`${customTo}T00:00:00`);
      const len = Math.max(1, Math.round((to - from) / 86400000) + 1);
      const prevTo = new Date(from);
      prevTo.setDate(prevTo.getDate() - 1);
      const prevFrom = new Date(prevTo);
      prevFrom.setDate(prevFrom.getDate() - (len - 1));
      current = { income: stats.totalIncome, expense: stats.totalExpense, profit: stats.netProfit, appointments: filteredAppointments.length };
      previous = pack(iso(prevFrom), iso(prevTo));
      note = language === 'ru' ? 'К предыдущему периоду' : language === 'en' ? 'Vs previous range' : 'Oldingi davrga nisbatan';
    } else if (period === 'all') {
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      current = pack(`${currentMonthStr}-01`, iso(monthEnd));
      previous = pack(`${lastMonthStr}-01`, iso(prevEnd));
      note = language === 'ru' ? 'Этот месяц к прошлому' : language === 'en' ? 'This month vs last month' : "Bu oy, o'tgan oyga nisbatan";
    } else {
      return null;
    }

    return {
      note,
      appointments: change(current.appointments, previous.appointments, 'count'),
      income: change(current.income, previous.income, 'money'),
      expense: change(current.expense, previous.expense, 'money'),
      profit: change(current.profit, previous.profit, 'money'),
    };
  }, [period, payments, expenses, appointments, stats, filteredAppointments.length, lastMonthStr, currentMonthStr, now, language, customFrom, customTo]);

  const insights = useMemo(() => {
    const items = [];
    const totalAp = filteredAppointments.length;
    const done = stats.completedAppts;
    const rate = totalAp ? Math.round((done / totalAp) * 100) : null;
    if (rate != null && totalAp >= 5 && rate < 40) {
      items.push({
        tone: 'warn',
        title: language === 'ru' ? `Низкая завершённость: ${rate}%` : `Bajarilish darajasi past: ${rate}%`,
        body: language === 'ru'
          ? `${done} из ${totalAp} приёмов завершены. Стоит обновлять статус после визита.`
          : `${done} ta qabul yakunlangan, ${totalAp} tadan. Qabuldan keyin holatni yangilash tavsiya etiladi.`,
      });
    }
    const idle = doctorLeaderboard.filter((d) => d.role === 'doctor' && d.appointmentCount === 0);
    if (idle.length) {
      const names = idle.slice(0, 2).map((d) => d.name).join(', ');
      items.push({
        tone: 'alert',
        title: language === 'ru' ? `Нет приёмов: ${idle.length}` : `Qabul yo'q: ${idle.length} ta shifokor`,
        body: language === 'ru' ? `${names} — нет записей за выбранный период.` : `${names} bo'yicha tanlangan davrda qabul yozuvi yo'q.`,
      });
    }
    const weak = [...doctorLeaderboard].filter((d) => d.appointmentCount >= 5 && d.completionRate < 25).sort((a, b) => a.completionRate - b.completionRate)[0];
    if (weak) {
      const completed = Number(weak.completedCount ?? weak.completed);
      const completedCount = Number.isFinite(completed) ? completed : 0;
      items.push({
        tone: 'info',
        title: `${weak.name}: ${weak.appointmentCount} ${language === 'ru' ? 'приёмов' : 'qabul'}, ${weak.completionRate}%`,
        body: language === 'ru'
          ? `Завершено ${completedCount}. Средний чек ${fmtMoney(weak.avgCheck)} UZS.`
          : `Bajarilgani ${completedCount} ta. O'rtacha chek ${fmtMoney(weak.avgCheck)} UZS.`,
      });
    }
    const noShow = appointmentsStatusReport.find((s) => /kelmagan|неявк|no-show/i.test(s.status));
    if (noShow && noShow.count > 0) {
      items.push({
        tone: 'warn',
        title: language === 'ru' ? `Неявки: ${noShow.count}` : `Kelmaganlar: ${noShow.count} ta`,
        body: language === 'ru' ? `Это ${noShow.share}% приёмов выбранного периода.` : `Tanlangan davrdagi qabullarning ${noShow.share}% i.`,
      });
    }
    if (stats.totalIncome > 0 && stats.totalExpense / stats.totalIncome >= 0.3) {
      const ratio = Math.round((stats.totalExpense / stats.totalIncome) * 100);
      items.push({
        tone: 'alert',
        title: language === 'ru' ? `Расходы — ${ratio}% дохода` : `Xarajatlar daromadning ${ratio}% ini tashkil qiladi`,
        body: `${language === 'ru' ? 'Расход' : 'Chiqim'} ${fmtMoney(stats.totalExpense)} UZS · ${language === 'ru' ? 'доход' : 'daromad'} ${fmtMoney(stats.totalIncome)} UZS.`,
      });
    }
    const unmatched = doctorLeaderboard.find((d) => String(d.id) === 'unknown' && d.revenue > 0);
    if (unmatched) {
      items.push({
        tone: 'info',
        title: language === 'ru' ? 'Есть выручка без врача' : 'Shifokorga bog\'lanmagan tushum bor',
        body: `${fmtMoney(unmatched.revenue)} UZS ${language === 'ru' ? 'не привязаны к сотруднику.' : 'xodimga biriktirilmagan.'}`,
      });
    }
    if (!items.length) {
      items.push({
        tone: 'ok',
        title: language === 'ru' ? 'Отклонений не найдено' : 'E\'tibor talab qiladigan og\'ish topilmadi',
        body: language === 'ru'
          ? 'За выбранный период автоматических предупреждений нет.'
          : 'Tanlangan davr bo\'yicha avtomatik ogohlantirish yo\'q.',
      });
    }
    return items.slice(0, 4);
  }, [filteredAppointments.length, stats, doctorLeaderboard, appointmentsStatusReport, language]);

  return (
    <ReportsDashboard
      language={language}
      loading={loading}
      phone={phone}
      inMobileShell={inMobileShell}
      period={period}
      setPeriod={setPeriod}
      customFrom={customFrom}
      customTo={customTo}
      setCustomFrom={setCustomFrom}
      setCustomTo={setCustomTo}
      activeTab={activeReportTab}
      setActiveTab={setActiveReportTab}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      stats={stats}
      trends={trends}
      appointmentCount={filteredAppointments.length}
      financeChartData={financeChartData}
      appointmentsStatusReport={appointmentsStatusReport}
      doctorLeaderboard={doctorLeaderboard}
      servicesReport={servicesReport}
      monthlyFinanceReport={visibleMonths}
      docSortField={docSortField}
      onDocSort={handleDocSort}
      formatChartYAxis={formatChartYAxis}
      onExport={exportCSV}
      onPrint={() => window.print()}
      insights={insights}
    />
  );
}
