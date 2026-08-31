import { useState, useEffect, useMemo, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { 
  TrendingUp, DollarSign, ArrowDownRight,
  Calendar, Table as TableIcon, LayoutGrid, FileSpreadsheet,
  ArrowUp, ArrowDown, ArrowUpDown, Award,
  Receipt, Layers, Search, X
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/LanguageContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Standard Uzbek Months
const UZ_MONTHS = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'
];

/**
 * Reports Page - Professional Excel Spreadsheet View
 */
export default function Reports() {
  const { t, language } = useTranslation();
  const [payments, setPayments] = useState([]);
  const [, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & Tabs
  const [period, setPeriod] = useState('all'); // 'all' | 'this_month' | 'last_month' | 'year'
  const [activeReportTab, setActiveReportTab] = useState('doctors'); // 'doctors' | 'finance' | 'services' | 'appointments'
  const [searchQuery, setSearchQuery] = useState('');

  // Density switcher with localStorage
  const [density, setDensity] = useState(() => {
    return localStorage.getItem('myclinic_reports_density') || 'compact';
  });
  const toggleDensity = (val) => {
    setDensity(val);
    localStorage.setItem('myclinic_reports_density', val);
  };

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
  const [finSortField, setFinSortField] = useState('month');
  const [finSortOrder, setFinSortOrder] = useState('desc');

  const handleFinSort = (field) => {
    if (finSortField === field) {
      setFinSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setFinSortField(field);
      setFinSortOrder('desc');
    }
  };

  // Sorting state for Services Table
  const [srvSortField, setSrvSortField] = useState('revenue');
  const [srvSortOrder, setSrvSortOrder] = useState('desc');

  const handleSrvSort = (field) => {
    if (srvSortField === field) {
      setSrvSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSrvSortField(field);
      setSrvSortOrder('desc');
    }
  };

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
    if (!itemDate || period === 'all') return true;
    const d = String(itemDate).split('T')[0];
    if (period === 'this_month') return d.startsWith(currentMonthStr);
    if (period === 'last_month') return d.startsWith(lastMonthStr);
    if (period === 'year') return d.startsWith(currentYearStr);
    return true;
  }, [period, currentMonthStr, lastMonthStr, currentYearStr]);

  const filteredPayments = useMemo(() => payments.filter(p => filterByPeriod(p.date)), [payments, filterByPeriod]);
  const filteredAppointments = useMemo(() => appointments.filter(a => filterByPeriod(a.date)), [appointments, filterByPeriod]);
  const filteredExpenses = useMemo(() => expenses.filter(e => filterByPeriod(e.date)), [expenses, filterByPeriod]);

  // Overall Financial Stats
  const stats = useMemo(() => {
    const totalIncome = filteredPayments.filter(p => p.type === 'Income').reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
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

    doctors.forEach(doc => {
      const name = doc.name || doc.full_name || 'Shifokor';
      docMap[String(doc.id)] = {
        id: doc.id,
        name,
        specialty: doc.specialty || 'Stomatolog',
        revenue: 0,
        appointmentCount: 0,
        completedCount: 0,
        cancelledCount: 0,
        patientIds: new Set(),
      };
    });

    filteredPayments.filter(p => p.type === 'Income').forEach(p => {
      let matchedDocId = p.doctor_id ? String(p.doctor_id) : null;
      if (!matchedDocId && p.doctor_name) {
        const found = doctors.find(d => (d.name && p.doctor_name.includes(d.name)) || (d.full_name && p.doctor_name.includes(d.full_name)));
        if (found) matchedDocId = String(found.id);
      }
      
      const key = matchedDocId || (p.doctor_name ? `name_${p.doctor_name}` : 'unknown');
      if (!docMap[key]) {
        docMap[key] = {
          id: matchedDocId || key,
          name: p.doctor_name || 'Shifokor',
          specialty: 'Stomatolog',
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
      
      const key = matchedDocId || (a.doctor_name ? `name_${a.doctor_name}` : 'unknown');
      if (!docMap[key]) {
        docMap[key] = {
          id: matchedDocId || key,
          name: a.doctor_name || 'Shifokor',
          specialty: 'Stomatolog',
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
      revenueShare: Math.round((doc.revenue / totalRev) * 100)
    }));

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
  }, [doctors, filteredPayments, filteredAppointments, searchQuery, docSortField, docSortOrder]);

  // ═════════════════════════════════════════════════════════════════════════
  // 2. MONTHLY FINANCIAL REPORT DATA & EXCEL SORTING
  // ═════════════════════════════════════════════════════════════════════════
  const monthlyFinanceReport = useMemo(() => {
    const map = {};

    payments.filter(p => p.type === 'Income').forEach(p => {
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

  // Chart data for 6-month finances
  const financeChartData = useMemo(() => {
    return [...monthlyFinanceReport]
      .sort((a, b) => a.rawMonth.localeCompare(b.rawMonth))
      .slice(-6)
      .map(d => ({
        month: d.monthLabel.split(' ')[0],
        income: d.income,
        expense: d.expense,
        net: d.net
      }));
  }, [monthlyFinanceReport]);

  // ═════════════════════════════════════════════════════════════════════════
  // 3. TOP SERVICES REPORT DATA & EXCEL SORTING
  // ═════════════════════════════════════════════════════════════════════════
  const servicesReport = useMemo(() => {
    const map = {};

    filteredPayments.filter(p => p.type === 'Income').forEach(p => {
      const name = p.service_name || p.category || 'Boshqa xizmatlar';
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
  }, [filteredPayments, searchQuery, srvSortField, srvSortOrder]);

  // ═════════════════════════════════════════════════════════════════════════
  // 4. APPOINTMENTS BREAKDOWN DATA
  // ═════════════════════════════════════════════════════════════════════════
  const appointmentsStatusReport = useMemo(() => {
    const statusCounts = {};
    filteredAppointments.forEach(a => {
      const rawStatus = a.status || '';
      let status = language === 'ru' ? 'Запланировано' : 'Rejalashtirilgan';
      const lower = rawStatus.toLowerCase();
      if (lower === 'completed') status = language === 'ru' ? 'Выполнено' : 'Bajarilgan';
      else if (lower === 'scheduled' || lower === 'planned') status = language === 'ru' ? 'Запланировано' : 'Rejalashtirilgan';
      else if (lower === 'cancelled') status = language === 'ru' ? 'Отменено' : 'Bekor qilingan';
      else if (lower.includes('no_show') || lower.includes('no-show') || lower.includes('noshow')) status = language === 'ru' ? 'Неявка' : 'Kelmagan';
      else if (lower.includes('progress') || lower.includes('waiting')) status = language === 'ru' ? 'В ожидании' : 'Kutilmoqda';
      else {
        status = rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1);
      }
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    const total = filteredAppointments.length || 1;
    const colors = {
      'Bajarilgan': '#10b981',
      'Rejalashtirilgan': '#3b82f6',
      'Bekor qilingan': '#ef4444',
      'Kelmagan': '#64748b',
      'Kutilmoqda': '#f59e0b'
    };

    return Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count,
      share: Math.round((count / total) * 100),
      color: colors[status] || '#94a3b8'
    }));
  }, [filteredAppointments]);

  /**
   * Export Active Report Table to CSV with UTF-8 BOM
   */
  const exportCSV = useCallback(() => {
    try {
      let headers = [];
      let rows = [];
      let filename = `Hisobot_${activeReportTab}_${new Date().toISOString().slice(0, 10)}.csv`;

      if (activeReportTab === 'doctors') {
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
        rows = monthlyFinanceReport.map((f, idx) => [
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
  }, [activeReportTab, doctorLeaderboard, monthlyFinanceReport, servicesReport, appointmentsStatusReport]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/95 backdrop-blur-md border border-slate-200 p-3 rounded-xl shadow-lg z-50 text-xs">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">{label}</p>
          {payload.map((p, i) => (
            <div key={i} className="flex items-center gap-2 mb-0.5">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color || p.fill }} />
              <p className="font-bold text-slate-800">
                {p.name}: <span className="font-mono font-black text-slate-900">{Number(p.value).toLocaleString()} UZS</span>
              </p>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-3.5 pb-4">
      
      {/* ─── Excel Header Bar ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900 tracking-tight">{t('navigation.reports') || "Hisobotlar"}</h1>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-[#1499AD]/10 text-[#1499AD] border border-[#1499AD]/20">
              {language === 'ru' ? '• АНАЛИТИКА И УПРАВЛЕНИЕ' : language === 'en' ? '• ANALYTICS & MANAGEMENT' : '• Analitika va Boshqaruv'}
            </span>
          </div>
          <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
            {t('reports.subtitle') || (language === 'ru' ? 'Общий финансовый отчет клиники, рейтинг врачей и анализ услуг' : 'Klinika umumiy moliyaviy hisoboti, shifokorlar reytingi va xizmatlar tahlili')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Period Filter Tabs */}
          <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/70">
            {[
              { key: 'all', label: language === 'ru' ? 'Все' : language === 'en' ? 'All' : 'Barchasi' },
              { key: 'this_month', label: language === 'ru' ? 'Этот месяц' : language === 'en' ? 'This month' : 'Bu oy' },
              { key: 'last_month', label: language === 'ru' ? 'Прошлый месяц' : language === 'en' ? 'Last month' : "O'tgan oy" },
              { key: 'year', label: language === 'ru' ? 'За год' : language === 'en' ? 'This year' : 'Yillik' },
            ].map(p => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={cn(
                  "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                  period === p.key
                    ? "bg-white text-slate-900 shadow-xs font-black"
                    : "text-slate-500 hover:text-slate-900"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          
        </div>
      </div>

      {/* ─── Top Executive Financial KPI Grid ───────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: t('reports.totalVisits') || (language === 'ru' ? "ВСЕГО ПРИЁМОВ" : "JAMI QABULLAR"), value: language === 'ru' ? `${filteredAppointments.length}` : `${filteredAppointments.length} ta`, icon: Calendar, color: "text-blue-600", bg: "bg-blue-50 border-blue-100", countText: language === 'ru' ? `${stats.completedAppts} завершено` : `${stats.completedAppts} ta yakunlangan` },
          { label: t('reports.totalRevenue') || (language === 'ru' ? "ОБЩИЙ ДОХОД" : "UMUMIY DAROMAD"), value: `${stats.totalIncome.toLocaleString()} UZS`, icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100", countText: t('reports.clinicTotalIncome') || (language === 'ru' ? "Всего поступлений в клинику" : "Klinikaga jami tushum") },
          { label: t('reports.totalExpenses') || (language === 'ru' ? "РАСХОДЫ КЛИНИКИ" : "CHIQIMLAR / XARAJAT"), value: `${stats.totalExpense.toLocaleString()} UZS`, icon: ArrowDownRight, color: "text-rose-600", bg: "bg-rose-50 border-rose-100", countText: t('reports.clinicTotalExpenses') || (language === 'ru' ? "Общие расходы клиники" : "Jami klinik xarajatlar") },
          { label: t('reports.netProfit') || (language === 'ru' ? "ЧИСТАЯ ПРИБЫЛЬ" : "SOF FOYDA"), value: `${stats.netProfit.toLocaleString()} UZS`, icon: TrendingUp, color: "text-purple-600", bg: "bg-purple-50 border-purple-100", countText: language === 'ru' ? `Средний чек: ${stats.avgCheck.toLocaleString()} UZS` : `O'rtacha chek: ${stats.avgCheck.toLocaleString()} UZS` },
        ].map((s, i) => (
          <motion.div 
            key={s.label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.03 }}
            className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-xs flex items-center justify-between relative overflow-hidden"
          >
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">
                {s.label}
              </span>
              <div className="text-lg sm:text-xl font-black font-mono tracking-tight text-slate-900 tabular-nums">
                {s.value}
              </div>
              <p className="text-[9.5px] font-medium text-slate-400 mt-0.5">{s.countText}</p>
            </div>

            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-xs shrink-0 ${s.bg}`}>
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
          </motion.div>
        ))}
      </div>

      {/* ─── Excel Spreadsheet Controls & Report Navigation Bar ─────── */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          
          {/* Report Type Selector Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
            {[
              { id: 'doctors', label: t('reports.doctorRating') || (language === 'ru' ? "Рейтинг врачей" : "Shifokorlar Reytingi"), icon: Award, count: doctorLeaderboard.length },
              { id: 'finance', label: t('reports.monthlyFinance') || (language === 'ru' ? "Доходы и расходы" : "Oylik Kirim & Chiqim"), icon: DollarSign, count: monthlyFinanceReport.length },
              { id: 'services', label: t('reports.topServices') || (language === 'ru' ? "Топ услуг" : "Top Xizmatlar"), icon: Layers, count: servicesReport.length },
              { id: 'appointments', label: t('reports.visitsBreakdown') || (language === 'ru' ? "Распределение приёмов" : "Qabullar Taqsimoti"), icon: Receipt, count: appointmentsStatusReport.length },
            ].map(tab => {
              const isActive = activeReportTab === tab.id;
              const IconComp = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveReportTab(tab.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer",
                    isActive 
                      ? "bg-slate-900 text-white shadow-sm font-black" 
                      : "bg-slate-100/70 text-slate-600 hover:bg-slate-200/60 hover:text-slate-900"
                  )}
                >
                  <IconComp className={cn("w-3.5 h-3.5", isActive ? "text-emerald-400" : "text-slate-400")} />
                  <span>{tab.label}</span>
                  <span className={cn(
                    "px-1.5 py-0.2 rounded-full text-[9px] font-black",
                    isActive ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"
                  )}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            {/* Search Box */}
            {(activeReportTab === 'doctors' || activeReportTab === 'services') && (
              <div className="relative w-full sm:w-64 group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-[#1499AD]" />
                <input 
                  type="text" 
                  placeholder={activeReportTab === 'doctors' ? (language === 'ru' ? "Поиск по имени врача..." : "Shifokor nomi...") : (language === 'ru' ? "Поиск по названию услуги..." : "Xizmat nomi...")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-8.5 pl-8 pr-7 bg-slate-50 hover:bg-white focus:bg-white rounded-xl border border-slate-200 focus:border-[#1499AD] font-semibold text-slate-800 text-xs focus:ring-2 focus:ring-[#1499AD]/10 outline-none"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}

          </div>

        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════════ */}
      {/* ─── TAB 1: SHIFOKORLAR UNUMDORLIGI & REYTINGI EXCEL JADVALI ───── */}
      {/* ═════════════════════════════════════════════════════════════════ */}
      {activeReportTab === 'doctors' && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden relative"
        >
          {loading && (
            <div className="absolute inset-x-0 top-0 h-0.5 bg-slate-100 overflow-hidden z-20">
              <motion.div 
                className="h-full bg-gradient-to-r from-[#1499AD] to-[#0E7A8A]"
                animate={{ x: ['-100%', '100%'] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              />
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left select-text">
              <thead>
                <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-600 text-[10.5px] font-black uppercase tracking-wider sticky top-0 z-10 backdrop-blur-xs">
                  <th className="w-12 px-2.5 py-2.5 text-center border-r border-slate-200 select-none font-mono">
                    №
                  </th>
                  <th 
                    onClick={() => handleDocSort('name')}
                    className="px-3.5 py-2.5 border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors select-none min-w-[200px]"
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span>{t('reports.doctorCol') || (language === 'ru' ? 'Врач (Ф.И.О)' : 'Shifokor (F.I.Sh)')}</span>
                      {docSortField === 'name' ? (
                        docSortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#1499AD]" /> : <ArrowDown className="w-3 h-3 text-[#1499AD]" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-30" />
                      )}
                    </div>
                  </th>
                  <th className="px-3.5 py-2.5 border-r border-slate-200 whitespace-nowrap min-w-[140px]">
                    {t('reports.specialtyCol') || (language === 'ru' ? 'Специальность' : 'Mutaxassislik')}
                  </th>
                  <th 
                    onClick={() => handleDocSort('appointments')}
                    className="w-32 px-3 py-2.5 text-center border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors select-none whitespace-nowrap bg-blue-50/30"
                  >
                    <div className="flex items-center justify-center gap-1.5 text-blue-800 font-mono">
                      <span>{t('reports.visitsCol') || (language === 'ru' ? 'Приёмы' : 'Qabullar')}</span>
                      {docSortField === 'appointments' ? (
                        docSortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-40" />
                      )}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleDocSort('completed')}
                    className="w-32 px-3 py-2.5 text-center border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors select-none whitespace-nowrap"
                  >
                    <div className="flex items-center justify-center gap-1.5 text-emerald-800 font-mono">
                      <span>{t('reports.completedCol') || (language === 'ru' ? 'Выполнено' : 'Bajarilgan')}</span>
                      {docSortField === 'completed' ? (
                        docSortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-30" />
                      )}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleDocSort('patients')}
                    className="w-32 px-3 py-2.5 text-center border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors select-none whitespace-nowrap"
                  >
                    <div className="flex items-center justify-center gap-1.5 text-slate-700 font-mono">
                      <span>{t('reports.patientsCol') || (language === 'ru' ? 'Кол-во пациентов' : 'Bemorlar soni')}</span>
                      {docSortField === 'patients' ? (
                        docSortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-30" />
                      )}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleDocSort('revenue')}
                    className="w-44 px-3.5 py-2.5 text-right border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors bg-emerald-50/40 select-none whitespace-nowrap"
                  >
                    <div className="flex items-center justify-end gap-1.5 text-emerald-700 font-mono">
                      <span>{t('reports.revenueCol') || (language === 'ru' ? 'Общая выручка' : 'Umumiy Tushum')}</span>
                      {docSortField === 'revenue' ? (
                        docSortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-emerald-600" /> : <ArrowDown className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-40" />
                      )}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleDocSort('avg_check')}
                    className="w-36 px-3.5 py-2.5 text-right border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors select-none whitespace-nowrap"
                  >
                    <div className="flex items-center justify-end gap-1.5 text-slate-700 font-mono">
                      <span>{t('reports.avgCheckCol') || (language === 'ru' ? 'Средний чек' : "O'rtacha Chek")}</span>
                      {docSortField === 'avg_check' ? (
                        docSortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#1499AD]" /> : <ArrowDown className="w-3 h-3 text-[#1499AD]" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-30" />
                      )}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleDocSort('share')}
                    className="w-28 px-3 py-2.5 text-center select-none whitespace-nowrap"
                  >
                    {t('reports.clinicShareCol') || (language === 'ru' ? 'Доля клиники' : 'Klinika Ulushi')}
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200/70 text-xs">
                {doctorLeaderboard.length > 0 ? (
                  doctorLeaderboard.map((doc, idx) => {
                    const isCompact = density === 'compact';
                    const isInactive = doc.revenue === 0 && doc.appointmentCount === 0;
                    return (
                      <tr 
                        key={doc.id || idx}
                        className={`group hover:bg-[#1499AD]/10 transition-colors ${
                          isInactive ? 'opacity-70 bg-slate-50/20' : (idx % 2 === 1 ? 'bg-slate-50/30' : 'bg-white')
                        }`}
                      >
                        <td className={`text-center font-mono font-bold text-slate-400 border-r border-slate-200/70 whitespace-nowrap ${isCompact ? 'py-2 px-2' : 'py-3 px-2.5'}`}>
                          {doc.revenue > 0 && idx === 0 ? '🥇 1' : doc.revenue > 0 && idx === 1 ? '🥈 2' : doc.revenue > 0 && idx === 2 ? '🥉 3' : idx + 1}
                        </td>
                        <td className={`border-r border-slate-200/70 ${isCompact ? 'py-1.5 px-3' : 'py-2.5 px-3.5'}`}>
                          <span className={`font-extrabold group-hover:text-[#1499AD] transition-colors truncate block ${isInactive ? 'text-slate-600' : 'text-slate-900'}`}>
                            {doc.name}
                          </span>
                        </td>
                        <td className={`border-r border-slate-200/70 whitespace-nowrap ${isCompact ? 'py-1.5 px-3' : 'py-2.5 px-3.5'}`}>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10.5px] font-bold text-slate-600 bg-slate-100 border border-slate-200">
                            {(!doc.specialty || doc.specialty === 'Stomatolog') 
                              ? (language === 'ru' ? 'Стоматолог' : language === 'en' ? 'Dentist' : 'Stomatolog') 
                              : doc.specialty}
                          </span>
                        </td>
                        <td className={`text-center border-r border-slate-200/70 whitespace-nowrap bg-blue-50/20 ${isCompact ? 'py-1.5 px-2' : 'py-2.5 px-2.5'}`}>
                          {doc.appointmentCount > 0 ? (
                            <span className="font-mono font-bold text-blue-900">{doc.appointmentCount} {language === 'ru' ? 'пр.' : 'ta'}</span>
                          ) : (
                            <span className="font-mono font-semibold text-slate-300">0 {language === 'ru' ? 'пр.' : 'ta'}</span>
                          )}
                        </td>
                        <td className={`text-center border-r border-slate-200/70 whitespace-nowrap ${isCompact ? 'py-1.5 px-2' : 'py-2.5 px-2.5'}`}>
                          {doc.completedCount > 0 ? (
                            <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                              {doc.completedCount} ({doc.completionRate}%)
                            </span>
                          ) : (
                            <span className="font-mono font-semibold text-slate-400 bg-slate-100/60 px-2 py-0.5 rounded border border-slate-200/60">
                              0 (0%)
                            </span>
                          )}
                        </td>
                        <td className={`text-center border-r border-slate-200/70 whitespace-nowrap ${isCompact ? 'py-1.5 px-2' : 'py-2.5 px-2.5'}`}>
                          {doc.uniquePatients > 0 ? (
                            <span className="font-mono font-bold text-slate-700">{doc.uniquePatients} {language === 'ru' ? 'пац.' : 'ta'}</span>
                          ) : (
                            <span className="font-mono font-semibold text-slate-300">0 {language === 'ru' ? 'пац.' : 'ta'}</span>
                          )}
                        </td>
                        <td className={`text-right border-r border-slate-200/70 whitespace-nowrap bg-emerald-50/30 ${isCompact ? 'py-1.5 px-2.5' : 'py-2.5 px-3'}`}>
                          {doc.revenue > 0 ? (
                            <span className="font-mono font-black text-emerald-600 text-xs tabular-nums">
                              {doc.revenue.toLocaleString()} <span className="text-[9.5px] text-emerald-500">UZS</span>
                            </span>
                          ) : (
                            <span className="font-mono font-semibold text-slate-300 text-xs tabular-nums">
                              0 <span className="text-[9.5px] text-slate-300">UZS</span>
                            </span>
                          )}
                        </td>
                        <td className={`text-right border-r border-slate-200/70 whitespace-nowrap ${isCompact ? 'py-1.5 px-2.5' : 'py-2.5 px-3'}`}>
                          {doc.avgCheck > 0 ? (
                            <span className="font-mono font-bold text-slate-800 text-xs tabular-nums">
                              {doc.avgCheck.toLocaleString()} <span className="text-[9.5px] text-slate-400">UZS</span>
                            </span>
                          ) : (
                            <span className="font-mono font-semibold text-slate-300 text-xs tabular-nums">
                              0 <span className="text-[9.5px] text-slate-300">UZS</span>
                            </span>
                          )}
                        </td>
                        <td className={`text-center whitespace-nowrap ${isCompact ? 'py-1.5 px-2' : 'py-2.5 px-2.5'}`}>
                          {doc.revenueShare > 0 ? (
                            <span className="font-mono font-black text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                              {doc.revenueShare}%
                            </span>
                          ) : (
                            <span className="font-mono font-semibold text-slate-300 bg-slate-50 px-2 py-0.5 rounded">
                              0%
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={9} className="py-16 text-center text-slate-400 font-bold">
                      Ma'lumot topilmadi
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* ═════════════════════════════════════════════════════════════════ */}
      {/* ─── TAB 2: OYLIK MOLIYAVIY HISOBOT (KIRIM & CHIQIM) ─────────── */}
      {/* ═════════════════════════════════════════════════════════════════ */}
      {activeReportTab === 'finance' && (
        <div className="space-y-3.5">
          {/* Monthly Finance Chart */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase">{language === 'ru' ? 'Динамика доходов и расходов' : 'Oylik Kirim va Chiqim Dinamikasi'}</h3>
                <p className="text-[10px] text-slate-400 font-bold">{language === 'ru' ? 'График финансовых показателей за последние 6 месяцев' : "So'nggi 6 oylik moliyaviy ko'rsatkichlar diagrammasi"}</p>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-bold">
                <span className="flex items-center gap-1.5 text-emerald-700"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> {language === 'ru' ? 'Доход (Поступления)' : 'Tushum (Kirim)'}</span>
                <span className="flex items-center gap-1.5 text-rose-700"><div className="w-2.5 h-2.5 rounded-full bg-rose-500" /> {language === 'ru' ? 'Расход' : 'Chiqim (Xarajat)'}</span>
              </div>
            </div>
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={financeChartData} margin={{ top: 15, right: 15, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" vertical={false} />
                  <XAxis 
                    dataKey="month" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} 
                    dy={4}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 9.5, fontWeight: 700, fill: '#94a3b8' }} 
                    tickFormatter={formatChartYAxis}
                    width={65}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '16px', 
                      border: '1px solid #e2e8f0', 
                      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', 
                      padding: '10px 14px',
                      backgroundColor: '#ffffff'
                    }}
                    itemStyle={{ fontWeight: 800, fontSize: '11px' }}
                    labelStyle={{ fontWeight: 900, fontSize: '11px', marginBottom: '4px', color: '#1e293b' }}
                    cursor={{ fill: 'rgba(20, 153, 173, 0.05)' }}
                    formatter={(v, name) => [
                      `${Number(v).toLocaleString()} UZS`, 
                      name === 'Tushum' || name === 'income' ? (language === 'ru' ? 'Доход (Поступления)' : 'Tushum (Kirim)') : (language === 'ru' ? 'Расход' : 'Chiqim (Xarajat)')
                    ]}
                  />
                  <Bar dataKey="income" name="income" fill="#10b981" radius={[6, 6, 0, 0]} barSize={22} />
                  <Bar dataKey="expense" name="expense" fill="#f43f5e" radius={[6, 6, 0, 0]} barSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Monthly Finance Excel Grid Table */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden relative"
          >
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left select-text">
                <thead>
                  <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-600 text-[10.5px] font-black uppercase tracking-wider sticky top-0 z-10 backdrop-blur-xs">
                    <th className="w-12 px-2.5 py-2.5 text-center border-r border-slate-200 font-mono">№</th>
                    <th 
                      onClick={() => handleFinSort('month')}
                      className="px-3.5 py-2.5 border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <span>{language === 'ru' ? 'Месяц / Период' : 'Oy / Davr'}</span>
                        {finSortField === 'month' ? (
                          finSortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#1499AD]" /> : <ArrowDown className="w-3 h-3 text-[#1499AD]" />
                        ) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleFinSort('appointments')}
                      className="w-32 px-3 py-2.5 text-center border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors bg-blue-50/30"
                    >
                      Qabullar
                    </th>
                    <th 
                      onClick={() => handleFinSort('income')}
                      className="w-44 px-3.5 py-2.5 text-right border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors bg-emerald-50/40"
                    >
                      Kirim (Tushum)
                    </th>
                    <th 
                      onClick={() => handleFinSort('expense')}
                      className="w-44 px-3.5 py-2.5 text-right border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors bg-rose-50/40"
                    >
                      Chiqim (Xarajat)
                    </th>
                    <th 
                      onClick={() => handleFinSort('net')}
                      className="w-44 px-3.5 py-2.5 text-right border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors bg-purple-50/40"
                    >
                      Sof Foyda
                    </th>
                    <th 
                      onClick={() => handleFinSort('margin')}
                      className="w-32 px-3 py-2.5 text-center"
                    >
                      Rentabellik
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200/70 text-xs">
                  {monthlyFinanceReport.length > 0 ? (
                    monthlyFinanceReport.map((f, idx) => {
                      const isCompact = density === 'compact';
                      return (
                        <tr 
                          key={f.rawMonth}
                          className={`hover:bg-[#1499AD]/10 transition-colors ${
                            idx % 2 === 1 ? 'bg-slate-50/30' : 'bg-white'
                          }`}
                        >
                          <td className={`text-center font-mono font-bold text-slate-400 border-r border-slate-200/70 ${isCompact ? 'py-2 px-2' : 'py-3 px-2.5'}`}>
                            {idx + 1}
                          </td>
                          <td className={`border-r border-slate-200/70 font-extrabold text-slate-900 ${isCompact ? 'py-1.5 px-3' : 'py-2.5 px-3.5'}`}>
                            {f.monthLabel}
                          </td>
                          <td className={`text-center border-r border-slate-200/70 font-mono font-bold text-blue-900 bg-blue-50/20 ${isCompact ? 'py-1.5 px-2' : 'py-2.5 px-2.5'}`}>
                            {f.appointments} ta
                          </td>
                          <td className={`text-right border-r border-slate-200/70 font-mono font-bold text-emerald-700 bg-emerald-50/20 ${isCompact ? 'py-1.5 px-2.5' : 'py-2.5 px-3'}`}>
                            {f.income.toLocaleString()} UZS
                          </td>
                          <td className={`text-right border-r border-slate-200/70 font-mono font-bold text-rose-700 bg-rose-50/20 ${isCompact ? 'py-1.5 px-2.5' : 'py-2.5 px-3'}`}>
                            {f.expense.toLocaleString()} UZS
                          </td>
                          <td className={`text-right border-r border-slate-200/70 font-mono font-black text-purple-700 bg-purple-50/20 ${isCompact ? 'py-1.5 px-2.5' : 'py-2.5 px-3'}`}>
                            {f.net.toLocaleString()} UZS
                          </td>
                          <td className={`text-center font-mono font-black ${isCompact ? 'py-1.5 px-2' : 'py-2.5 px-2.5'}`}>
                            <span className={cn(
                              "px-2 py-0.5 rounded text-[11px]",
                              f.margin >= 50 ? "bg-emerald-100 text-emerald-800" : (f.margin >= 20 ? "bg-blue-100 text-blue-800" : "bg-rose-100 text-rose-800")
                            )}>
                              {f.margin}%
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-16 text-center text-slate-400 font-bold">
                        Moliyaviy ma'lumot topilmadi
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer Bar */}
            <div className="bg-slate-100/90 border-t border-slate-200/90 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3 text-slate-600 font-bold">
                <span>{language === 'ru' ? 'Всего месяцев: ' : 'Jami Oylar: '}<strong className="text-slate-900 font-mono">{monthlyFinanceReport.length}</strong></span>
                <span>•</span>
                <span>{language === 'ru' ? 'Σ Общий доход: ' : 'Σ Jami Kirim: '}<strong className="text-emerald-700 font-mono">{monthlyFinanceReport.reduce((s, f) => s + f.income, 0).toLocaleString()} UZS</strong></span>
              </div>
              <div className="flex items-center gap-3 font-mono">
                <span className="text-rose-700 font-bold">{language === 'ru' ? 'Σ Расход: ' : 'Σ Chiqim: '}{monthlyFinanceReport.reduce((s, f) => s + f.expense, 0).toLocaleString()} UZS</span>
                <span>•</span>
                <span className="text-purple-700 font-black text-sm">{language === 'ru' ? 'Σ Чистая прибыль: ' : 'Σ Sof Foyda: '}{monthlyFinanceReport.reduce((s, f) => s + f.net, 0).toLocaleString()} UZS</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════ */}
      {/* ─── TAB 3: TOP XIZMATLAR HISOBOTI EXCEL JADVALI ───────────────── */}
      {/* ═════════════════════════════════════════════════════════════════ */}
      {activeReportTab === 'services' && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden relative"
        >
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left select-text">
              <thead>
                <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-600 text-[10.5px] font-black uppercase tracking-wider sticky top-0 z-10 backdrop-blur-xs">
                  <th className="w-12 px-2.5 py-2.5 text-center border-r border-slate-200 font-mono">№</th>
                  <th 
                    onClick={() => handleSrvSort('name')}
                    className="px-3.5 py-2.5 border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span>{language === 'ru' ? 'Услуга / Категория' : 'Xizmat Nomi / Kategoriya'}</span>
                      {srvSortField === 'name' ? (
                        srvSortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#1499AD]" /> : <ArrowDown className="w-3 h-3 text-[#1499AD]" />
                      ) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSrvSort('count')}
                    className="w-36 px-3 py-2.5 text-center border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors bg-blue-50/30"
                  >
                    Bajarilgan Soni
                  </th>
                  <th 
                    onClick={() => handleSrvSort('revenue')}
                    className="w-48 px-3.5 py-2.5 text-right border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors bg-emerald-50/40"
                  >
                    Umumiy Tushum
                  </th>
                  <th 
                    onClick={() => handleSrvSort('avgPrice')}
                    className="w-40 px-3.5 py-2.5 text-right border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors"
                  >
                    O'rtacha Narx
                  </th>
                  <th 
                    onClick={() => handleSrvSort('share')}
                    className="w-32 px-3 py-2.5 text-center"
                  >
                    Tushumdagi Ulushi
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200/70 text-xs">
                {servicesReport.length > 0 ? (
                  servicesReport.map((srv, idx) => {
                    const isCompact = density === 'compact';
                    return (
                      <tr 
                        key={srv.name}
                        className={`hover:bg-[#1499AD]/10 transition-colors ${
                          idx % 2 === 1 ? 'bg-slate-50/30' : 'bg-white'
                        }`}
                      >
                        <td className={`text-center font-mono font-bold text-slate-400 border-r border-slate-200/70 ${isCompact ? 'py-2 px-2' : 'py-3 px-2.5'}`}>
                          {idx + 1}
                        </td>
                        <td className={`border-r border-slate-200/70 font-extrabold text-slate-900 ${isCompact ? 'py-1.5 px-3' : 'py-2.5 px-3.5'}`}>
                          {srv.name}
                        </td>
                        <td className={`text-center border-r border-slate-200/70 font-mono font-bold text-blue-900 bg-blue-50/20 ${isCompact ? 'py-1.5 px-2' : 'py-2.5 px-2.5'}`}>
                          {srv.count} ta
                        </td>
                        <td className={`text-right border-r border-slate-200/70 font-mono font-black text-emerald-600 bg-emerald-50/20 ${isCompact ? 'py-1.5 px-2.5' : 'py-2.5 px-3'}`}>
                          {srv.revenue.toLocaleString()} <span className="text-[9.5px] text-emerald-500">UZS</span>
                        </td>
                        <td className={`text-right border-r border-slate-200/70 font-mono font-bold text-slate-700 ${isCompact ? 'py-1.5 px-2.5' : 'py-2.5 px-3'}`}>
                          {srv.avgPrice.toLocaleString()} <span className="text-[9.5px] text-slate-400">UZS</span>
                        </td>
                        <td className={`text-center font-mono font-black ${isCompact ? 'py-1.5 px-2' : 'py-2.5 px-2.5'}`}>
                          <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] text-slate-800">
                            {srv.share}%
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-slate-400 font-bold">
                      Xizmatlar bo'yicha ma'lumot topilmadi
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* ═════════════════════════════════════════════════════════════════ */}
      {/* ─── TAB 4: QABULLAR HOLATI EXCEL JADVALI ─────────────────────── */}
      {/* ═════════════════════════════════════════════════════════════════ */}
      {activeReportTab === 'appointments' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
          {/* Pie Chart Card */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-black text-slate-900 uppercase">{language === 'ru' ? 'Распределение приёмов (Диаграмма)' : 'Qabullar Taqsimoti (Diagramma)'}</h3>
              <p className="text-[10px] text-slate-400 font-bold mt-0.5">{language === 'ru' ? 'Процентное соотношение приёмов по статусам' : "Uchrashuvlarning holatlar bo'yicha foiz ulushi"}</p>
            </div>
            <div className="h-[200px] w-full my-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={appointmentsStatusReport} 
                    dataKey="count" 
                    nameKey="status" 
                    cx="50%" 
                    cy="50%" 
                    innerRadius={50} 
                    outerRadius={75} 
                    paddingAngle={4}
                  >
                    {appointmentsStatusReport.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-2 text-[10px] font-bold">
              {appointmentsStatusReport.map((a) => (
                <div key={a.status} className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: a.color }} />
                  <span>{a.status}: {a.count} ta</span>
                </div>
              ))}
            </div>
          </div>

          {/* Status Table */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col justify-between"
          >
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left select-text">
                <thead>
                  <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-600 text-[10.5px] font-black uppercase tracking-wider">
                    <th className="w-12 px-2.5 py-2.5 text-center border-r border-slate-200 font-mono">№</th>
                    <th className="px-3.5 py-2.5 border-r border-slate-200">{language === 'ru' ? 'Статус приёма' : 'Qabul Holati'}</th>
                    <th className="w-36 px-3 py-2.5 text-center border-r border-slate-200 bg-blue-50/30">{language === 'ru' ? 'Количество приёмов' : 'Uchrashuvlar Soni'}</th>
                    <th className="w-36 px-3 py-2.5 text-center">{language === 'ru' ? 'Доля (%)' : 'Ulush (%)'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 text-xs">
                  {appointmentsStatusReport.map((item, idx) => (
                    <tr key={item.status} className="hover:bg-[#1499AD]/10 transition-colors">
                      <td className="text-center font-mono font-bold text-slate-400 border-r border-slate-200/70 py-2.5 px-2">
                        {idx + 1}
                      </td>
                      <td className="border-r border-slate-200/70 font-extrabold text-slate-900 py-2.5 px-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                          <span>{item.status}</span>
                        </div>
                      </td>
                      <td className="text-center border-r border-slate-200/70 font-mono font-bold text-blue-900 bg-blue-50/20 py-2.5 px-3">
                        {item.count} ta qabul
                      </td>
                      <td className="text-center font-mono font-black py-2.5 px-3">
                        <span className="bg-slate-100 px-2.5 py-1 rounded text-xs">
                          {item.share}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
}
