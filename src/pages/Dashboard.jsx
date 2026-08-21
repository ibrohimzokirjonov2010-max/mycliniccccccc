import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  CalendarDays, Users, Clock, DollarSign, 
  AlertTriangle, Bell, TrendingUp, Activity, 
  Zap, CheckCircle2,
  ChevronRight, Calendar, Heart, Shield
} from 'lucide-react';
import { Tooth } from '@/components/ui/Icons';
import EmptyState from '@/components/ui/EmptyState';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { 
  XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
  AreaChart, Area
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { runSeeder } from '../utils/seedData';
import { fetchDashboardStats } from '../utils/dashboardUtils';
import { formatCurrency } from '@/lib/utils';
import { useTranslation } from '@/i18n/LanguageContext';
import { useAuth } from '@/lib/AuthContext';



/**
 * Professional Desktop Dashboard
 * Premium healthcare CRM overview with advanced analytics
 */
// Format activity date timezone-invariant
const formatActivityDate = (dateStr) => {
  if (!dateStr) return '';
  if (dateStr.includes('T')) {
    const [datePart, timePart] = dateStr.split('T');
    const [y, m, d] = datePart.split('-');
    const timeClean = timePart.slice(0, 5);
    return `${d}.${m}.${y} ${timeClean}`;
  }
  if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const [y, m, d] = parts;
      return `${d}.${m}.${y}`;
    }
  }
  return dateStr;
};

export default function Dashboard() {
  const { t } = useTranslation();
  const { user, isDoctor, isAdmin } = useAuth();
  
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['dashboard-stats', user?.id],
    queryFn: () => fetchDashboardStats(user, isDoctor, isAdmin),
    staleTime: 30000,
  });

  const appointments = data?.appointments || [];
  const patients = data?.patients || [];
  const payments = data?.payments || [];
  const recalls = data?.recalls || [];
  const inventory = data?.inventory || [];
  const stats = data?.stats || { todayAppts: 0, todayRevenue: 0, weekRevenue: 0, newPatients: 0, totalPatients: 0, pendingRecalls: 0, lowStock: 0 };

  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  // Chart Data
  const weeklyRevenueData = useMemo(() => {
    const getWeekdayLabel = (date) => {
      const dayIdx = date.getDay();
      const currentLang = localStorage.getItem('app_language') || 'uz';
      if (currentLang === 'uz') {
        const uzDays = ["Yak", "Du", "Se", "Ch", "Pa", "Ju", "Sha"];
        return uzDays[dayIdx];
      } else if (currentLang === 'ru') {
        const ruDays = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
        return ruDays[dayIdx];
      } else {
        const enDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        return enDays[dayIdx];
      }
    };

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const dateStr = d.toISOString().split('T')[0];
      const dayRevenue = payments
        .filter(p => {
          const pDate = p.date?.includes('T') ? p.date.split('T')[0] : p.date;
          return pDate === dateStr && (p.type || 'Income').toLowerCase() === 'income';
        })
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      return {
        name: getWeekdayLabel(d),
        revenue: dayRevenue
      };
    });
  }, [payments]);

  const appointmentDistribution = useMemo(() => {
    const statuses = ['Completed', 'Scheduled', 'Cancelled', 'No-Show'];
    const colors = ['#10b981', '#3b82f6', '#ef4444', '#f59e0b'];
    return statuses.map((status, i) => ({
      name: status === 'Completed' ? t('appointments.completed') : 
            status === 'Scheduled' ? t('appointments.scheduled') : 
            status === 'Cancelled' ? t('appointments.cancelled') : t('appointments.noShow'),
      value: appointments.filter(a => {
        const lower = a.status?.toLowerCase() || '';
        if (status === 'No-Show') return lower === 'no-show' || lower === 'noshow' || lower === 'no_show';
        if (status === 'Scheduled') return lower === 'scheduled' || lower === 'planned';
        return lower === status.toLowerCase();
      }).length,
      color: colors[i]
    })).filter(d => d.value > 0);
  }, [appointments, t]);

  const recentActivity = useMemo(() => {
    const activity = [
      ...appointments.slice(0, 10).map(a => ({ ...a, activityType: 'appointment' })),
      ...payments.slice(0, 10).map(p => ({ ...p, activityType: 'payment' }))
    ].sort((a, b) => new Date(b.created_date || b.date) - new Date(a.created_date || a.date));
    return activity.slice(0, 8);
  }, [appointments, payments]);

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse pb-4">
        <div className="flex justify-between items-center h-14 bg-white/50 rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-white rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 h-[350px] bg-white rounded-2xl" />
          <div className="h-[350px] bg-white rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-4">
      {/* Premium Dynamic Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-4"
          >
            <div className="w-10 h-10 bg-gradient-to-br from-[#1499AD] to-[#0E7A8A] rounded-xl flex items-center justify-center shadow-lg shadow-[#1499AD]/20 text-white">
              <Heart className="w-5 h-5 fill-white/20" />
            </div>
            <div>
              <h1 className="text-2xl font-[900] text-slate-900 tracking-tighter leading-none">
                {t('dashboard.title')}
              </h1>
              <p className="text-xs font-black text-[#1499AD] uppercase tracking-[0.3em] mt-2 opacity-70">
                {t('navigation.dashboard')} • {today}
              </p>
            </div>
          </motion.div>
        </div>
        
        <div className="flex items-center gap-4">
          <motion.button
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={async () => {
              await runSeeder();
              refetch();
            }}
            className="flex items-center gap-3 px-6 py-3.5 bg-white text-slate-400 border border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:text-[#1499AD] transition-all group shadow-sm"
          >
            <Shield className="w-4 h-4 group-hover:rotate-12 transition-transform" />
            VODIY-DEV MODE
          </motion.button>
          
          <Link to="/appointments">
            <motion.button
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-3 px-8 py-4 bg-slate-900 text-white rounded-2xl text-[11px] font-[900] uppercase tracking-widest shadow-2xl shadow-slate-900/20 transition-all border-none"
            >
              <CalendarDays className="w-4 h-4 text-[#1499AD]" />
              {t('appointments.addNew')}
            </motion.button>
          </Link>
        </div>
      </div>

      {/* Stats Grid - Enhanced */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { title: isDoctor ? t('dashboard.myTodayAppointments') : t('dashboard.todayAppointments'), value: stats.todayAppts, icon: CalendarDays, color: 'from-blue-500 to-indigo-600', trend: stats.todayApptsTrend || '0%' },
          { title: isDoctor ? t('dashboard.myTodayRevenue') : t('dashboard.todayRevenue'), value: formatCurrency(stats.todayRevenue), icon: TrendingUp, color: 'from-emerald-500 to-teal-600', trend: stats.todayRevenueTrend || '0%' },
          { title: isDoctor ? t('dashboard.myWeekRevenue') : t('dashboard.weekRevenue'), value: formatCurrency(stats.weekRevenue), icon: DollarSign, color: 'from-[#1499AD] to-[#0E7A8A]', trend: stats.weekRevenueTrend || '0%' },
          { title: t('dashboard.newPatients'), value: stats.newPatients, icon: Users, color: 'from-slate-700 to-slate-900', trend: stats.newPatientsTrend || '0%' }
        ].map((stat, i) => {
          const isNegative = stat.trend?.startsWith('-');
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="premium-card p-4 border-none flex flex-col justify-between group hover:shadow-2xl transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                  <div className={`p-2.5 rounded-xl bg-gradient-to-br ${stat.color} text-white shadow-lg shadow-black/5 group-hover:scale-110 transition-transform`}>
                      <stat.icon className="w-4 h-4" />
                  </div>
                  <div className={`px-3 py-1 rounded-full text-[10px] font-black ${isNegative ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"}`}>
                      {stat.trend}
                  </div>
              </div>
              <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">{stat.title}</p>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">{stat.value}</h2>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Main Analytics Grid - Glass Style */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue Chart */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-2 glass-panel rounded-2xl p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-[900] text-slate-900 uppercase tracking-tight">{t('dashboard.weekRevenue')}</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1.5">{t('dashboard.revenueChart')}</p>
            </div>
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-2.5">
                    <div className="w-3 h-3 rounded-full bg-[#1499AD] shadow-lg shadow-[#1499AD]/30" />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('payments.income')}</span>
                </div>
            </div>
          </div>
          
          <div className="h-[220px] w-full">
            {weeklyRevenueData.some(d => d.revenue > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeklyRevenueData}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1499AD" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#1499AD" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="6 6" vertical={false} stroke="#E2E8F0" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 900, fill: '#64748B', textAnchor: 'middle' }} 
                    dy={15}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 900, fill: '#64748B' }}
                    tickFormatter={(v) => `${(v/1000000).toFixed(1)}M`}
                    dx={-10}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.1)', padding: '16px' }}
                    itemStyle={{ fontWeight: 900, fontSize: '12px' }}
                    cursor={{ stroke: '#1499AD', strokeWidth: 2, strokeDasharray: '4 4' }}
                    formatter={(v) => [`${Number(v).toLocaleString()} so'm`, t('payments.income')]}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#1499AD" 
                    strokeWidth={4}
                    fillOpacity={1} 
                    fill="url(#colorRev)" 
                    animationDuration={1500}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center">
                <EmptyState icon={TrendingUp} title={t('common.noData')} />
              </div>
            )}
          </div>
        </motion.div>

        {/* Appointment Status - Donut */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glass-panel rounded-2xl p-5"
        >
          <div className="mb-4">
            <h3 className="text-lg font-[900] text-slate-900 uppercase tracking-tight">{t('dashboard.appointmentStats')}</h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1.5">Kunlik holat</p>
          </div>
          
          <div className="h-[220px] relative">
            {appointmentDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={appointmentDistribution} 
                    cx="50%" 
                    cy="50%" 
                    innerRadius={75} 
                    outerRadius={100} 
                    paddingAngle={8}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {appointmentDistribution.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center">
                <EmptyState icon={CalendarDays} title={t('common.noData')} />
              </div>
            )}
            
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-4xl font-[900] text-slate-900">{appointments.length}</span>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('appointments.title')}</span>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {appointmentDistribution.map((item, i) => (
              <div key={i} className="flex items-center gap-2 bg-white/50 p-2.5 rounded-xl border border-white transition-all hover:shadow-md">
                <div className="w-2.5 h-2.5 rounded-full shadow-lg" style={{ backgroundColor: item.color, boxShadow: `0 0 10px ${item.color}44` }} />
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-tight">{item.name}</span>
                  <span className="text-sm font-black text-slate-900">{item.value}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Activity Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6 }}
          className="lg:col-span-2 glass-panel rounded-2xl overflow-hidden"
        >
          <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">{t('dashboard.recentActivity')}</h3>
              <p className="text-[10px] font-black text-[#1499AD] uppercase tracking-[0.2em] mt-1.5 underline-offset-4 decoration-2">Oxirgi harakatlar</p>
            </div>
            <div className="w-8 h-8 rounded-xl bg-white shadow-sm flex items-center justify-center text-[#1499AD]">
                <Activity className="w-4 h-4" />
            </div>
          </div>
          
          <div className="divide-y divide-slate-50">
            {recentActivity.length > 0 ? (
              recentActivity.map((item, index) => {
                const isPayment = item.activityType === 'payment';
                return (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 + 0.6 }}
                    key={index} 
                    className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/50 transition-all cursor-pointer group"
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all group-hover:scale-110 shadow-sm ${
                      isPayment ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                    }`}>
                      {isPayment ? <DollarSign className="w-4 h-4" /> : <Calendar className="w-4 h-4" />}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-base font-black text-slate-900 truncate tracking-tight uppercase">
                          {isPayment 
                            ? (item.patient_name || t('payments.income')) 
                            : (item.patient_name || patients.find(p => String(p.id) === String(item.patient_id))?.full_name || 'Noma\'lum Bemor')}
                        </p>
                        <span className="text-[11px] font-black text-slate-400 whitespace-nowrap uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-lg">
                          {item.time || formatActivityDate(item.date)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5">
                        <p className={`text-xs font-black tracking-wide uppercase ${
                          isPayment ? 'text-emerald-500' : 'text-[#1499AD]'
                        }`}>
                          {isPayment ? formatCurrency(item.amount) : (item.service_name || t('appointments.title'))}
                        </p>
                        <span className="w-0.5 h-0.5 rounded-full bg-slate-300" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">TIZIM</span>
                      </div>
                    </div>
                    
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-900 transition-colors" />
                  </motion.div>
                );
              })
            ) : (
              <div className="py-24 text-center">
                <Activity className="w-16 h-16 text-slate-100 mx-auto mb-6 animate-pulse" />
                <p className="text-xs font-black text-slate-300 uppercase tracking-widest">{t('common.loading')}</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Alerts & Critical Sidebar */}
        <div className="space-y-3">
          {/* Low Stock Alert */}
          {stats.lowStock > 0 && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 }}
              className="bg-gradient-to-br from-rose-600 to-rose-700 rounded-2xl p-5 shadow-2xl shadow-rose-200 relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-20 -mt-20 blur-2xl" />
              <div className="relative z-10">
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white mb-3 shadow-xl">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <h4 className="text-2xl font-black text-white tracking-tight mb-2 uppercase">{t('inventory.title')}</h4>
                <p className="text-[11px] font-black text-rose-100 uppercase tracking-widest mb-6">{stats.lowStock} {t('inventory.lowStock')}</p>
                <Button className="w-full bg-white text-rose-600 hover:bg-rose-50 rounded-xl h-9 font-black uppercase text-[10px] tracking-widest shadow-xl border-none">
                  TEKSHIRISH
                </Button>
              </div>
            </motion.div>
          )}

          {/* Quick Actions */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.8 }}
            className="premium-card p-4 bg-white"
          >
            <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-[#1499AD] mb-3">{t('dashboard.quickActions')}</h4>
            <div className="space-y-2">
              {[
                  { label: t('appointments.completed'), value: appointments.filter(a => a.status === 'Completed').length, icon: CheckCircle2, color: 'emerald' },
                  { label: t('appointments.waiting'), value: appointments.filter(a => a.status === 'Waiting').length, icon: Clock, color: 'blue' },
                  { label: t('navigation.recalls'), value: stats.pendingRecalls, icon: Bell, color: 'amber' }
              ].map((action, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-slate-50/50 rounded-xl border border-slate-50 transition-all hover:bg-slate-50">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-${action.color}-600 bg-white shadow-sm`}>
                      <action.icon className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-black text-slate-600 uppercase tracking-tight">{action.label}</span>
                  </div>
                  <span className="text-lg font-black text-slate-900 leading-none">{action.value}</span>
                </div>
              ))}
            </div>
            
            <div className="mt-4 pt-3 border-t border-slate-50">
              <div className="flex items-center justify-between text-slate-400 mb-4">
                <span className="text-[11px] font-black uppercase tracking-[0.2em]">Efficiency</span>
                <span className="text-base font-black text-[#1499AD]">98%</span>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden p-0.5">
                <motion.div 
                   initial={{ width: 0 }}
                   animate={{ width: '98%' }}
                   transition={{ duration: 1.5, ease: "circOut" }}
                   className="h-full bg-[#1499AD] rounded-full shadow-[0_0_15px_rgba(20,153,173,0.3)]"
                />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
