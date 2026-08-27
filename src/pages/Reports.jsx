import { useState, useEffect, useMemo, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, 
  Cell
} from 'recharts';
import EmptyState from '../components/ui/EmptyState';
import { 
  BarChart3, TrendingUp, Users, DollarSign, ArrowDownRight, Activity,
  Trophy, Medal, Award, Crown, Calendar, Sparkles, CheckCircle2,
  Clock, XCircle, ChevronRight, UserCheck, Stethoscope
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from '@/i18n/LanguageContext';
import { formatCurrency, cn } from '@/lib/utils';

export default function Reports() {
  const { t, language } = useTranslation();
  const [payments, setPayments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(false);

  // Filters & Tabs
  const [period, setPeriod] = useState('all'); // 'all' | 'this_month' | 'last_month' | 'year'
  const [doctorSortBy, setDoctorSortBy] = useState('revenue'); // 'revenue' | 'appointments' | 'avg_check'
  const [breakdownTab, setBreakdownTab] = useState('appointments'); // 'appointments' | 'services'

  useEffect(() => {
    let loadingTimer = setTimeout(() => {
      setLoading(true);
    }, 150);

    async function load() {
      try {
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
        clearTimeout(loadingTimer);
        setLoading(false);
      }
    }
    load();
    return () => clearTimeout(loadingTimer);
  }, []);

  const chartLocale = useMemo(() => {
    if (language === 'uz') return 'uz-UZ';
    if (language === 'ru') return 'ru-RU';
    return 'en-US';
  }, [language]);

  const formatMonthLabel = useCallback((monthStr) => {
    const date = new Date(monthStr + "-15");
    if (language === 'uz') {
      const months = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"];
      return months[date.getMonth()];
    }
    return date.toLocaleDateString(chartLocale, { month: 'short' });
  }, [language, chartLocale]);

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

  // Stats calculation
  const stats = useMemo(() => {
    const totalIncome = filteredPayments.filter(p => p.type === 'Income').reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalExpense = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const netProfit = totalIncome - totalExpense;
    const completedAppts = filteredAppointments.filter(a => (a.status || '').toLowerCase() === 'completed').length;
    const avgCheck = completedAppts > 0 ? Math.round(totalIncome / completedAppts) : (filteredPayments.length > 0 ? Math.round(totalIncome / filteredPayments.length) : 0);
    return { totalIncome, totalExpense, netProfit, completedAppts, avgCheck };
  }, [filteredPayments, filteredExpenses, filteredAppointments]);

  // Monthly Finance
  const financeData = useMemo(() => {
    const monthlyFinance = {};
    payments.filter(p => p.type === 'Income').forEach(p => {
      const month = p.date?.substring(0, 7);
      if (month) {
        if (!monthlyFinance[month]) monthlyFinance[month] = { income: 0, expense: 0, net: 0 };
        monthlyFinance[month].income += (p.amount || 0);
      }
    });
    expenses.forEach(e => {
      const month = e.date?.substring(0, 7);
      if (month) {
        if (!monthlyFinance[month]) monthlyFinance[month] = { income: 0, expense: 0, net: 0 };
        monthlyFinance[month].expense += (e.amount || 0);
      }
    });
    return Object.entries(monthlyFinance)
      .sort()
      .slice(-6)
      .map(([month, data]) => ({ 
        month: formatMonthLabel(month), 
        ...data 
      }));
  }, [payments, expenses, formatMonthLabel]);

  // 🩺 COMPREHENSIVE DOCTOR PRODUCTIVITY & LEADERBOARD
  const doctorLeaderboard = useMemo(() => {
    // Collect all doctors from user list and active transactions
    const docMap = {};

    // 1. Initialize from official doctors list
    doctors.forEach(doc => {
      const name = doc.name || doc.full_name || 'Shifokor';
      docMap[String(doc.id)] = {
        id: doc.id,
        name,
        specialty: doc.specialty || 'Stomatolog',
        avatar: doc.avatar_url || doc.photo || doc.avatar || doc.image || '',
        revenue: 0,
        appointmentCount: 0,
        completedCount: 0,
        cancelledCount: 0,
        patientIds: new Set(),
      };
    });

    // 2. Tally revenue from Payments
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
          avatar: '',
          revenue: 0,
          appointmentCount: 0,
          completedCount: 0,
          cancelledCount: 0,
          patientIds: new Set(),
        };
      }
      docMap[key].revenue += (p.amount || 0);
      if (p.patient_id) docMap[key].patientIds.add(p.patient_id);
    });

    // 3. Tally appointments
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

    // 4. Calculate averages and sort
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

    // Filter out zero activity if there are active ones
    const activeList = list.filter(d => d.revenue > 0 || d.appointmentCount > 0);
    const finalDocs = activeList.length > 0 ? activeList : list.slice(0, 5);

    // Total clinic revenue for calculating percentage
    const totalRev = finalDocs.reduce((sum, d) => sum + d.revenue, 0) || 1;
    const maxRev = Math.max(...finalDocs.map(d => d.revenue), 1);
    const maxAppts = Math.max(...finalDocs.map(d => d.appointmentCount), 1);

    // Sort according to user selection
    finalDocs.sort((a, b) => {
      if (doctorSortBy === 'revenue') return b.revenue - a.revenue;
      if (doctorSortBy === 'appointments') return b.appointmentCount - a.appointmentCount;
      if (doctorSortBy === 'avg_check') return b.avgCheck - a.avgCheck;
      return b.revenue - a.revenue;
    });

    return finalDocs.map((doc, idx) => ({
      ...doc,
      rank: idx + 1,
      revenueShare: Math.round((doc.revenue / totalRev) * 100),
      relativeProgress: doctorSortBy === 'revenue' 
        ? Math.round((doc.revenue / maxRev) * 100) 
        : Math.round((doc.appointmentCount / maxAppts) * 100)
    }));
  }, [doctors, filteredPayments, filteredAppointments, doctorSortBy]);

  // Chart data for Doctor Bar Chart
  const doctorChartData = useMemo(() => {
    return doctorLeaderboard.slice(0, 6).map(d => ({
      name: d.name.replace(/^(dr\.|doc\.|doktor)\s*/i, '').split(' ')[0],
      fullName: d.name,
      revenue: d.revenue,
      appointments: d.appointmentCount,
      completed: d.completedCount,
      avgCheck: d.avgCheck,
    }));
  }, [doctorLeaderboard]);

  // 📊 Doctor Appointments Distribution (Pie Chart)
  const doctorAppointmentsPieData = useMemo(() => {
    const pieColors = ['#1499AD', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b'];
    return doctorLeaderboard
      .filter(d => d.appointmentCount > 0)
      .slice(0, 6)
      .map((d, i) => ({
        name: d.name,
        value: d.appointmentCount,
        revenue: d.revenue,
        color: pieColors[i % pieColors.length]
      }));
  }, [doctorLeaderboard]);

  // Top Services
  const serviceData = useMemo(() => {
    const servicePopularity = {};
    filteredPayments.filter(p => p.type === 'Income').forEach(p => {
      const sName = p.service_name || 'Boshqa';
      servicePopularity[sName] = (servicePopularity[sName] || 0) + 1;
    });
    return Object.entries(servicePopularity)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => ({ name: name === 'Boshqa' ? (t('reports.others') || 'Boshqa') : name, value }));
  }, [filteredPayments, t]);

  const colors = { Completed: '#10b981', Scheduled: '#3b82f6', Cancelled: '#ef4444', 'No-Show': '#64748b', InProgress: '#8b5cf6', Waiting: '#f59e0b' };
  const chartColors = ['#1499AD', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
  
  // Appointment Statuses
  const apptStatusData = useMemo(() => {
    const statusCounts = {};
    filteredAppointments.forEach(a => {
      const rawStatus = a.status || '';
      let status = 'Scheduled';
      const lower = rawStatus.toLowerCase();
      if (lower === 'completed') status = 'Completed';
      else if (lower === 'scheduled' || lower === 'planned') status = 'Scheduled';
      else if (lower === 'cancelled') status = 'Cancelled';
      else if (lower === 'no-show' || lower === 'noshow' || lower === 'no_show') status = 'No-Show';
      else if (lower === 'waiting') status = 'Waiting';
      else if (lower === 'inprogress' || lower === 'in_progress' || lower === 'in progress' || lower === 'status.in progress' || lower === 'status.in_progress') status = 'InProgress';
      else {
        status = rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1).toLowerCase();
      }
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    return Object.entries(statusCounts).map(([name, value]) => ({ 
      name: t(`status.${name}`) || name, 
      value, 
      color: colors[name] || '#94a3b8' 
    }));
  }, [filteredAppointments, t]);

  if (loading) return (
    <div className="space-y-6 p-4">
      <div className="h-10 w-48 bg-slate-100 rounded-lg animate-pulse" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <div key={i} className="h-32 bg-slate-50 rounded-[2rem] animate-pulse" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1,2].map(i => <div key={i} className="h-80 bg-slate-50 rounded-[2.5rem] animate-pulse" />)}
      </div>
    </div>
  );

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/95 backdrop-blur-md border border-slate-100 p-3.5 rounded-2xl shadow-xl z-50">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{label}</p>
          {payload.map((p, i) => (
            <div key={i} className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color || p.fill }} />
              <p className="text-xs font-black text-slate-900">
                {p.name}: <span className="text-[#1499AD] font-black">{typeof p.value === 'number' ? (p.value >= 10000 ? formatCurrency(p.value) : `${p.value.toLocaleString()} ta`) : p.value}</span>
              </p>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4 pb-6">
      {/* Top Header & Period Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1 sm:px-0">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none uppercase">
            {t('navigation.reports') || 'Hisobotlar va Tahlil'}
          </h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">
            Klinika faoliyati, shifokorlar reytingi va qabullar tahlili
          </p>
        </div>

        {/* Period Filter Tabs */}
        <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-2xl border border-slate-200/60 shadow-xs self-start sm:self-auto">
          {[
            { key: 'all', label: 'Barchasi' },
            { key: 'this_month', label: 'Bu oy' },
            { key: 'last_month', label: 'O\'tgan oy' },
            { key: 'year', label: 'Yillik' },
          ].map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={cn(
                "px-3.5 h-8 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer",
                period === p.key
                  ? "bg-white text-[#1499AD] shadow-sm font-black"
                  : "text-slate-500 hover:text-slate-900"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Overview Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 px-1 sm:px-0">
        {[
          { label: t('patients.totalVisits') || 'Jami qabullar', value: `${filteredAppointments.length} ta`, sub: `${stats.completedAppts} ta yakunlangan`, icon: Calendar, color: "text-[#1499AD]", bg: "bg-[#1499AD]/10" },
          { label: t('payments.income') || 'Jami Tushum', value: formatCurrency(stats.totalIncome).replace(' so\'m', ''), sub: "so'm kirim", icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-50", isCurrency: true },
          { label: t('expenses.title') || 'Chiqimlar', value: formatCurrency(stats.totalExpense).replace(' so\'m', ''), sub: "so'm xarajat", icon: ArrowDownRight, color: "text-rose-600", bg: "bg-rose-50", isCurrency: true },
          { label: t('reports.netProfit', 'Net Profit') || 'Sof Foyda', value: formatCurrency(stats.netProfit).replace(' so\'m', ''), sub: `O'rtacha chek: ${formatCurrency(stats.avgCheck)}`, icon: TrendingUp, color: "text-purple-600", bg: "bg-purple-50", isCurrency: true },
        ].map((s, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white border border-slate-100 rounded-[1.5rem] p-4 shadow-sm relative overflow-hidden group hover:shadow-md hover:border-[#1499AD]/20 transition-all"
          >
            <div className="flex items-center justify-between mb-2">
              <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest truncate max-w-[100px]">{s.sub}</span>
            </div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{s.label}</p>
            <p className={`text-base sm:text-lg font-black tracking-tight truncate ${s.color} mt-0.5`}>
              {s.value}
            </p>
          </motion.div>
        ))}
      </div>

      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {/* 🏆 SHIFOKORLAR REYTINGI VA UNUMDORLIGI (PROFESSIONAL LEADERBOARD)       */}
      {/* ═════════════════════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[2.5rem] border border-slate-100 p-6 sm:p-8 shadow-sm"
      >
        {/* Header with Title & Sort Switchers */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shadow-xs">
                <Crown className="w-4 h-4" />
              </div>
              <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">
                Shifokorlar Unumdorligi va Reytingi
              </h2>
            </div>
            <p className="text-[11px] font-bold text-slate-400 mt-1 ml-10">
              Shifokorlarning keltirgan daromadi, qabul soni va o'rtacha chek ko'rsatkichlari
            </p>
          </div>

          {/* Sort Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-2xl border border-slate-200/60 self-start md:self-auto">
            <button
              onClick={() => setDoctorSortBy('revenue')}
              className={cn(
                "px-3.5 h-8 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer",
                doctorSortBy === 'revenue'
                  ? "bg-[#1499AD] text-white shadow-sm font-black"
                  : "text-slate-500 hover:text-slate-900 bg-white"
              )}
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Daromad bo'yicha</span>
            </button>
            <button
              onClick={() => setDoctorSortBy('appointments')}
              className={cn(
                "px-3.5 h-8 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer",
                doctorSortBy === 'appointments'
                  ? "bg-[#1499AD] text-white shadow-sm font-black"
                  : "text-slate-500 hover:text-slate-900 bg-white"
              )}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Uchrashuvlar bo'yicha</span>
            </button>
            <button
              onClick={() => setDoctorSortBy('avg_check')}
              className={cn(
                "px-3.5 h-8 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer",
                doctorSortBy === 'avg_check'
                  ? "bg-[#1499AD] text-white shadow-sm font-black"
                  : "text-slate-500 hover:text-slate-900 bg-white"
              )}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>O'rtacha chek</span>
            </button>
          </div>
        </div>

        {/* Doctor Grid Cards / Leaderboard */}
        {doctorLeaderboard.length > 0 ? (
          <div className="space-y-6">
            {/* Top 3 Podium Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {doctorLeaderboard.slice(0, 3).map((doc, idx) => {
                const rankStyles = [
                  { badge: 'bg-amber-400 text-white', border: 'border-amber-200/80 bg-gradient-to-b from-amber-50/50 to-white', icon: Trophy, medal: '🥇 1-O\'rin', shadow: 'shadow-amber-500/10' },
                  { badge: 'bg-slate-400 text-white', border: 'border-slate-200 bg-gradient-to-b from-slate-50/50 to-white', icon: Medal, medal: '🥈 2-O\'rin', shadow: 'shadow-slate-500/10' },
                  { badge: 'bg-amber-700 text-white', border: 'border-amber-900/20 bg-gradient-to-b from-amber-50/30 to-white', icon: Award, medal: '🥉 3-O\'rin', shadow: 'shadow-amber-800/10' }
                ][idx] || { badge: 'bg-slate-200 text-slate-700', border: 'border-slate-100 bg-white', icon: Award, medal: `#${idx + 1}` };

                const IconComponent = rankStyles.icon;

                return (
                  <div 
                    key={doc.id || doc.name} 
                    className={cn(
                      "p-5 rounded-3xl border relative overflow-hidden transition-all shadow-sm hover:shadow-md",
                      rankStyles.border
                    )}
                  >
                    {/* Rank Badge */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-1.5">
                        <span className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider", rankStyles.badge)}>
                          {rankStyles.medal}
                        </span>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          {doc.revenueShare}% ulush
                        </span>
                      </div>
                      <IconComponent className="w-5 h-5 text-amber-500 opacity-80" />
                    </div>

                    {/* Doctor Info */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200/80 shadow-xs overflow-hidden shrink-0 flex items-center justify-center">
                        {doc.avatar ? (
                          <img src={doc.avatar} alt={doc.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-[#1499AD]/10 text-[#1499AD] font-black text-base flex items-center justify-center">
                            {doc.name.replace(/^(dr\.|doc\.|doktor)\s*/i, '').charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-black text-slate-900 text-sm tracking-tight truncate">
                          {doc.name}
                        </h4>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">
                          {doc.specialty}
                        </span>
                      </div>
                    </div>

                    {/* Key Metrics */}
                    <div className="space-y-2 bg-white/80 backdrop-blur-xs p-3 rounded-2xl border border-slate-100">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Tushum:</span>
                        <span className="font-black text-emerald-600">{formatCurrency(doc.revenue)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Uchrashuvlar:</span>
                        <span className="font-black text-slate-900">{doc.appointmentCount} ta <span className="text-[10px] text-emerald-500 font-bold">({doc.completedCount} bajarilgan)</span></span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">O'rtacha chek:</span>
                        <span className="font-black text-[#1499AD]">{formatCurrency(doc.avgCheck)}</span>
                      </div>
                    </div>

                    {/* Relative Progress Bar */}
                    <div className="mt-3.5">
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-[#1499AD] to-blue-500 rounded-full transition-all duration-700" 
                          style={{ width: `${Math.max(doc.relativeProgress, 8)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Comparison Chart & Detailed Table */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
              {/* Doctor Comparison Bar Chart */}
              <div className="bg-slate-50/70 p-5 sm:p-6 rounded-3xl border border-slate-100">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">
                    {doctorSortBy === 'revenue' ? "Daromadlar taqqoslash (so'm)" : (doctorSortBy === 'appointments' ? "Uchrashuvlar soni taqqoslash" : "O'rtacha chek taqqoslash")}
                  </h4>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Top 6 Shifokor</span>
                </div>
                <div className="h-[240px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={doctorChartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="6 6" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800, fill: '#64748b' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: '#ffffff', radius: 10 }} />
                      {doctorSortBy === 'revenue' && (
                        <Bar dataKey="revenue" name="Tushum" fill="#1499AD" radius={[8, 8, 0, 0]} barSize={28} />
                      )}
                      {doctorSortBy === 'appointments' && (
                        <Bar dataKey="appointments" name="Qabullar soni" fill="#3b82f6" radius={[8, 8, 0, 0]} barSize={28} />
                      )}
                      {doctorSortBy === 'avg_check' && (
                        <Bar dataKey="avgCheck" name="O'rtacha chek" fill="#10b981" radius={[8, 8, 0, 0]} barSize={28} />
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Full Doctors Ranking List */}
              <div className="bg-slate-50/70 p-5 sm:p-6 rounded-3xl border border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">
                    Shifokorlar to'liq ro'yxati
                  </h4>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{doctorLeaderboard.length} nafar</span>
                </div>

                <div className="space-y-2.5 max-h-[250px] overflow-y-auto no-scrollbar pr-1">
                  {doctorLeaderboard.map((doc) => (
                    <div 
                      key={doc.id || doc.name} 
                      className="p-3 bg-white rounded-2xl border border-slate-100 hover:border-[#1499AD]/30 flex items-center justify-between gap-3 transition-all"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={cn(
                          "w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0",
                          doc.rank === 1 ? "bg-amber-100 text-amber-700" : (doc.rank === 2 ? "bg-slate-200 text-slate-700" : (doc.rank === 3 ? "bg-amber-900/10 text-amber-900" : "bg-slate-100 text-slate-500"))
                        )}>
                          #{doc.rank}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-black text-slate-900 truncate leading-tight">{doc.name}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate">{doc.specialty}</p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-xs font-black text-emerald-600 leading-tight">{formatCurrency(doc.revenue)}</p>
                        <p className="text-[9px] font-bold text-slate-400">{doc.appointmentCount} ta qabul ({doc.completionRate}%)</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <EmptyState icon={Stethoscope} title="Shifokorlar faoliyati bo'yicha ma'lumot topilmadi" />
        )}
      </motion.div>

      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {/* 📊 UCHRASHUVLAR VA XIZMATLAR TAHLILI (2 TA USTUN)                        */}
      {/* ═════════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 px-1 sm:px-0">
        {/* Finance Chart (6 Oylik Kirim va Chiqim) */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[2.5rem] border border-slate-100 p-6 sm:p-8 shadow-sm"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-tight">{t('reports.incomeAndExpenses') || 'Kirim va Chiqimlar'}</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Oxirgi 6 oylik dinamika</p>
            </div>
            <div className="flex gap-2">
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500" /><span className="text-[9px] font-bold text-slate-400 uppercase">{t('payments.income')}</span></div>
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-rose-500" /><span className="text-[9px] font-bold text-slate-400 uppercase">{t('expenses.title')}</span></div>
            </div>
          </div>
          {financeData.length > 0 ? (
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={financeData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="8 8" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc', radius: 12 }} />
                  <Bar dataKey="income" name={t('payments.income')} fill="#10b981" radius={[6, 6, 0, 0]} barSize={18} />
                  <Bar dataKey="expense" name={t('expenses.title')} fill="#f43f5e" radius={[6, 6, 0, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState icon={BarChart3} title={t('common.noData')} />}
        </motion.div>

        {/* Dynamic Breakdown: Uchrashuvlar bo'yicha / Xizmatlar bo'yicha */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-[2.5rem] border border-slate-100 p-6 sm:p-8 shadow-sm"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-tight">
                {breakdownTab === 'appointments' ? 'Uchrashuvlar Taqsimoti' : 'Top Xizmatlar'}
              </h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                {breakdownTab === 'appointments' ? 'Shifokorlar bo\'yicha qabullar ulushi' : 'Eng ko\'p ko\'rsatilgan xizmatlar'}
              </p>
            </div>

            {/* Switch between Appointments & Services */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setBreakdownTab('appointments')}
                className={cn(
                  "px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer",
                  breakdownTab === 'appointments' ? "bg-white text-[#1499AD] shadow-xs" : "text-slate-500"
                )}
              >
                Qabullar
              </button>
              <button
                onClick={() => setBreakdownTab('services')}
                className={cn(
                  "px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer",
                  breakdownTab === 'services' ? "bg-white text-[#1499AD] shadow-xs" : "text-slate-500"
                )}
              >
                Xizmatlar
              </button>
            </div>
          </div>

          {breakdownTab === 'appointments' ? (
            doctorAppointmentsPieData.length > 0 ? (
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="h-[220px] w-full sm:w-1/2">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                        data={doctorAppointmentsPieData} 
                        dataKey="value" 
                        nameKey="name" 
                        cx="50%" 
                        cy="50%" 
                        innerRadius={55}
                        outerRadius={80} 
                        paddingAngle={5}
                      >
                        {doctorAppointmentsPieData.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col gap-2 w-full sm:w-1/2 justify-center">
                  {doctorAppointmentsPieData.map((d) => (
                    <div key={d.name} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100/60">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                        <span className="text-[11px] font-black text-slate-700 uppercase tracking-tight truncate">{d.name}</span>
                      </div>
                      <span className="text-[11px] font-black text-slate-900 ml-2 shrink-0">{d.value} ta</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : <EmptyState icon={Calendar} title="Uchrashuvlar topilmadi" />
          ) : (
            serviceData.length > 0 ? (
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="h-[220px] w-full sm:w-1/2">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={serviceData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={4}>
                        {serviceData.map((entry, index) => (
                          <Cell key={index} fill={chartColors[index % chartColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col gap-2 w-full sm:w-1/2 justify-center">
                  {serviceData.map((d, index) => (
                    <div key={d.name} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100/60">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: chartColors[index % chartColors.length] }} />
                        <span className="text-[11px] font-black text-slate-700 uppercase tracking-tight truncate">{d.name}</span>
                      </div>
                      <span className="text-[11px] font-black text-slate-900 ml-2 shrink-0">{d.value} {t('reports.pieces') || 'ta'}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : <EmptyState icon={BarChart3} title={t('common.noData')} />
          )}
        </motion.div>
      </div>

      {/* Appointment Status Breakdown */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-[2.5rem] border border-slate-100 p-6 sm:p-8 shadow-sm"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-tight">
              {t('dashboard.appointmentStats') || 'Uchrashuvlar Holatlari Statistikasi'}
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
              Qabullar ijrosi, yakunlangan va bekor qilingan holatlar tahlili
            </p>
          </div>
          <span className="text-xs font-black text-[#1499AD] bg-[#1499AD]/10 px-3 py-1 rounded-full">
            Jami: {filteredAppointments.length} ta
          </span>
        </div>

        {apptStatusData.length > 0 ? (
          <div className="flex flex-col lg:flex-row items-center gap-8">
            <div className="h-[250px] w-full lg:w-1/2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={apptStatusData} 
                    cx="50%" 
                    cy="50%" 
                    innerRadius={70} 
                    outerRadius={105} 
                    paddingAngle={6}
                    dataKey="value" 
                  >
                    {apptStatusData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full lg:w-1/2">
              {apptStatusData.map(d => (
                <div key={d.name} className="flex flex-col p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">{d.name}</span>
                  </div>
                  <span className="text-lg font-black text-slate-900">{d.value} <span className="text-[10px] font-bold text-slate-400">ta</span></span>
                </div>
              ))}
            </div>
          </div>
        ) : <EmptyState icon={BarChart3} title={t('common.noData')} />}
      </motion.div>
    </div>
  );
}
