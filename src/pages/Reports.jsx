import { useState, useEffect, useMemo, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, 
  Cell, AreaChart, Area 
} from 'recharts';
import EmptyState from '../components/ui/EmptyState';
import { 
  BarChart3, TrendingUp, Users, DollarSign, ArrowDownRight, Activity
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from '@/i18n/LanguageContext';
import { formatCurrency } from '@/lib/utils';

export default function Reports() {
  const { t, language } = useTranslation();
  const [payments, setPayments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let loadingTimer = setTimeout(() => {
      setLoading(true);
    }, 150);

    async function load() {
      try {
        const [pays, pats, appts, exps] = await Promise.all([
          base44.entities.Payment.list('-date', 100),      // ⚡ tez yuklash
          base44.entities.Patient.list('-created_date', 100), // ⚡ tez yuklash
          base44.entities.Appointment.list('-date', 100),  // ⚡ tez yuklash
          base44.entities.Expense.list('-date', 100),      // ⚡ tez yuklash
        ]);
        setPayments(pays || []);
        setPatients(pats || []);
        setAppointments(appts || []);
        setExpenses(exps || []);
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


  // Stats calculation
  const stats = useMemo(() => {
    const totalIncome = payments.filter(p => p.type === 'Income').reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalExpense = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const netProfit = totalIncome - totalExpense;
    return { totalIncome, totalExpense, netProfit };
  }, [payments, expenses]);

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

  // Monthly patients
  const patientsData = useMemo(() => {
    const monthlyPatients = {};
    patients.forEach(p => {
      const month = p.created_date?.substring(0, 7);
      if (month) monthlyPatients[month] = (monthlyPatients[month] || 0) + 1;
    });
    return Object.entries(monthlyPatients)
      .sort()
      .slice(-6)
      .map(([month, count]) => ({ 
        month: formatMonthLabel(month), 
        count 
      }));
  }, [patients, formatMonthLabel]);

  // Doctor Performance
  const doctorData = useMemo(() => {
    const doctorRevenue = {};
    payments.filter(p => p.type === 'Income').forEach(p => {
      if (p.doctor_id) {
        const doc = p.doctor_name || 'Shifokor';
        doctorRevenue[doc] = (doctorRevenue[doc] || 0) + (p.amount || 0);
      }
    });
    return Object.entries(doctorRevenue)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => ({ name: name.split(' ')[0], value }));
  }, [payments]);

  // Top Services
  const serviceData = useMemo(() => {
    const servicePopularity = {};
    payments.filter(p => p.type === 'Income').forEach(p => {
      const sName = p.service_name || 'Boshqa';
      servicePopularity[sName] = (servicePopularity[sName] || 0) + 1;
    });
    return Object.entries(servicePopularity)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => ({ name, value }));
  }, [payments]);

  const colors = { Completed: '#10b981', Scheduled: '#3b82f6', Cancelled: '#ef4444', 'No-Show': '#64748b' };
  const chartColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
  
  // Appointment Statuses
  const apptStatusData = useMemo(() => {
    const statusCounts = {};
    appointments.forEach(a => {
      const rawStatus = a.status || '';
      let status = 'Scheduled';
      const lower = rawStatus.toLowerCase();
      if (lower === 'completed') status = 'Completed';
      else if (lower === 'scheduled' || lower === 'planned') status = 'Scheduled';
      else if (lower === 'cancelled') status = 'Cancelled';
      else if (lower === 'no-show' || lower === 'noshow' || lower === 'no_show') status = 'No-Show';
      else if (lower === 'waiting') status = 'Waiting';
      else if (lower === 'inprogress' || lower === 'in_progress') status = 'InProgress';
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
  }, [appointments, t]);

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
        <div className="bg-white/90 backdrop-blur-md border border-slate-100 p-4 rounded-2xl shadow-2xl">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{label}</p>
          {payload.map((p, i) => (
            <div key={i} className="flex items-center gap-3 mb-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color || p.fill }} />
              <p className="text-sm font-black text-slate-900">
                {p.name}: <span className="text-slate-500 font-bold">{p.value.toLocaleString()}</span>
              </p>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-3 pb-4">
      {/* Premium Header */}
      <div className="px-1 sm:px-0">
        <h1 className="text-xl premium-title">
          {t('navigation.reports')}
        </h1>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-0.5 ml-1">
          {t('dashboard.patientStats')}
        </p>
      </div>

      {/* Quick Overview Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 px-1 sm:px-0">
        {[
          { label: t('patients.totalVisits'), value: patients.length, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
          { label: t('payments.income'), value: stats.totalIncome, icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-50", isCurrency: true },
          { label: t('expenses.title'), value: stats.totalExpense, icon: ArrowDownRight, color: "text-rose-600", bg: "bg-rose-50", isCurrency: true },
          { label: t('reports.netProfit', 'Net Profit'), value: stats.netProfit, icon: TrendingUp, color: "text-purple-600", bg: "bg-purple-50", isCurrency: true },
        ].map((s, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white border border-slate-100 rounded-[1.5rem] p-4 shadow-sm relative overflow-hidden group"
          >
            <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{s.label}</p>
            <p className={`text-sm sm:text-lg font-black tracking-tighter truncate ${s.color}`}>
              {s.isCurrency ? formatCurrency(s.value).replace(' so\'m', '') : s.value}
            </p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 px-1 sm:px-0">
        {/* Finance Chart */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[2.5rem] border border-slate-100 p-6 sm:p-8 shadow-sm"
        >
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-tight">{t('navigation.payroll')} ({t('reports.last6months', 'Last 6 months')})</h3>
            <div className="flex gap-2">
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500" /><span className="text-[9px] font-bold text-slate-400 uppercase">{t('payments.income')}</span></div>
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-rose-500" /><span className="text-[9px] font-bold text-slate-400 uppercase">{t('expenses.title')}</span></div>
            </div>
          </div>
          {financeData.length > 0 ? (
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={financeData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="8 8" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc', radius: 12 }} />
                  <Bar dataKey="income" name={t('payments.income')} fill="#10b981" radius={[6, 6, 0, 0]} barSize={20} />
                  <Bar dataKey="expense" name={t('expenses.title')} fill="#f43f5e" radius={[6, 6, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState icon={BarChart3} title={t('common.noData')} />}
        </motion.div>

        {/* Patients Growth */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-[2.5rem] border border-slate-100 p-6 sm:p-8 shadow-sm"
        >
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-tight">{t('dashboard.patientStats')}</h3>
            <Activity className="w-5 h-5 text-blue-500" />
          </div>
          {patientsData.length > 0 ? (
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={patientsData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="8 8" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="count" name={t('patients.title')} stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#colorCount)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState icon={BarChart3} title={t('common.noData')} />}
        </motion.div>

        {/* Doctor Performance & Top Services */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:col-span-2">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[2.5rem] border border-slate-100 p-6 sm:p-8 shadow-sm"
          >
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight mb-8">Shifokorlar unumdorligi (Top 5)</h3>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={doctorData} layout="vertical" margin={{ left: 20, right: 30 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 800, fill: '#64748b' }} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                  <Bar dataKey="value" fill="#3b82f6" radius={[0, 8, 8, 0]} barSize={25} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[2.5rem] border border-slate-100 p-6 sm:p-8 shadow-sm"
          >
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight mb-8">Top Xizmatlar</h3>
            {serviceData.length > 0 ? (
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="h-[250px] w-full sm:w-1/2">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={serviceData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} paddingAngle={4}>
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
                    <div key={d.name} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100/50 hover:bg-slate-100/30 transition-all">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: chartColors[index % chartColors.length] }} />
                        <span className="text-[11px] font-black text-slate-700 uppercase tracking-tight truncate">{d.name}</span>
                      </div>
                      <span className="text-[11px] font-black text-slate-900 ml-2">{d.value} ta</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : <EmptyState icon={BarChart3} title={t('common.noData')} />}
          </motion.div>
        </div>

        {/* Appointment Status */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-[2.5rem] border border-slate-100 p-6 sm:p-8 shadow-sm lg:col-span-2"
        >
          <h3 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-tight mb-8 text-center lg:text-left">{t('dashboard.appointmentStats')}</h3>
          {apptStatusData.length > 0 ? (
            <div className="flex flex-col lg:flex-row items-center gap-10">
              <div className="h-[300px] w-full lg:w-1/2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={apptStatusData} 
                      cx="50%" 
                      cy="50%" 
                      innerRadius={80} 
                      outerRadius={120} 
                      paddingAngle={8}
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
              <div className="grid grid-cols-2 gap-4 w-full lg:w-1/2">
                {apptStatusData.map(d => (
                  <div key={d.name} className="flex flex-col p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{d.name}</span>
                    </div>
                    <span className="text-xl font-black text-slate-900">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : <EmptyState icon={BarChart3} title={t('common.noData')} />}
        </motion.div>
      </div>
    </div>
  );
}
