import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, Calendar, TrendingUp, ArrowRight,
  UserPlus, CalendarPlus, Phone, Clock, ChevronRight, DollarSign, Activity, Heart
} from 'lucide-react';
import { cn } from '@/lib/utils';
import PullToRefresh from '@/components/ui/PullToRefresh';
import { formatCurrency } from '@/lib/utils';
import { useAuth } from '@/lib/AuthContext';
import { useTranslation } from '@/i18n/LanguageContext';
import { fetchDashboardStats } from '../utils/dashboardUtils';

/**
 * Premium SaaS Mobile Dashboard
 * Modern healthcare CRM overview with actionable insights
 */
export default function MobileDashboardV2() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    patients: 0,
    appointments: 0,
    todayRevenue: 0,
    growth: 12
  });
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(false);
  const loadingTimerRef = useRef(null);
  const hasLoadedInitial = useRef(false);
  const { user, isDoctor } = useAuth();
  const { t } = useTranslation();

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
      if (!hasLoadedInitial.current) {
        loadingTimerRef.current = setTimeout(() => {
          setLoading(true);
        }, 150);
      }
      const data = await fetchDashboardStats(user, isDoctor, false);
      
      setStats({
        patients: data.totalPatients,
        appointments: data.appointments.filter(a => a.status === 'Scheduled' || a.status === 'Waiting').length,
        todayRevenue: data.stats.todayRevenue,
        growth: 12
      });
      
      setTodayAppointments(data.todayApptsList);
      
      const activity = [
        ...data.appointments.slice(0, 3).map(a => ({ ...a, type: 'appointment' })),
        ...data.payments.slice(0, 3).map(p => ({ ...p, type: 'payment' }))
      ].sort((a, b) => new Date(b.created_date || b.date) - new Date(a.created_date || a.date))
       .slice(0, 5);
       
      setRecentActivity(activity);
      hasLoadedInitial.current = true;
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
      setLoading(false);
    }
  }, [user, isDoctor]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Get initials
  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
  };

  // Avatar gradient
  const getAvatarGradient = (name) => {
    const gradients = [
      'from-violet-500 to-purple-600',
      'from-blue-500 to-indigo-600',
      'from-emerald-500 to-teal-600',
      'from-orange-500 to-red-500',
      'from-pink-500 to-rose-500',
      'from-cyan-500 to-blue-600'
    ];
    const index = name?.charCodeAt(0) % gradients.length || 0;
    return gradients[index];
  };

  // Format time
  const formatTime = (time) => {
    if (!time) return '--:--';
    const [hours, minutes] = time.split(':');
    return `${hours}:${minutes}`;
  };

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

  // Stat Card Component
  const StatCard = ({ title, value, subtitle, icon: Icon, color, onClick }) => (
    <motion.div
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`${color} rounded-2xl p-3.5 cursor-pointer relative overflow-hidden group`}
    >
      <div className="flex items-start justify-between relative z-10">
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest opacity-70 leading-none">{title}</p>
          <p className="text-xl font-black mt-1.5 tracking-tight">{value}</p>
          {subtitle && <p className="text-[8px] font-bold opacity-60 mt-0.5 uppercase tracking-tight">{subtitle}</p>}
        </div>
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shadow-sm shrink-0", color.includes('bg-white') ? "bg-slate-50 text-[#1499AD]" : "bg-white/20 text-white")}>
          <Icon className="w-4.5 h-4.5" />
        </div>
      </div>
      {/* Decorative BG element */}
      <div className="absolute -right-4 -bottom-4 w-12 h-12 bg-current opacity-[0.03] rounded-full group-hover:scale-150 transition-transform duration-700" />
    </motion.div>
  );

  // Appointment Card
  const AppointmentCard = ({ app, index }) => (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index, 6) * 0.02 }}
      onClick={() => navigate('/appointments')}
      className="flex items-center gap-3 bg-white rounded-xl p-3 mb-2 shadow-[0_2px_8px_rgba(0,0,0,0.04)] active:scale-[0.98] transition-transform content-visibility-auto"
    >
      {/* Avatar */}
      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${getAvatarGradient(app.patient_name)} flex items-center justify-center text-white text-sm font-semibold flex-shrink-0`}>
        {getInitials(app.patient_name)}
      </div>
      
      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-bold text-slate-900 text-xs truncate leading-tight">{app.patient_name}</h3>
        <div className="flex items-center gap-1.5 mt-0.5">
          <Clock className="w-3 h-3 text-slate-400" />
          <span className="text-[11px] text-slate-500 font-semibold">{formatTime(app.time)}</span>
          <span className="text-slate-300">•</span>
          <span className="text-[11px] text-slate-500 truncate">{app.service_name}</span>
        </div>
      </div>
      
      {/* Arrow */}
      <ChevronRight className="w-4 h-4 text-slate-300" />
    </motion.div>
  );

  // Quick Action Button
  const QuickAction = ({ icon: Icon, label, color, onClick }) => (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 p-3.5 bg-white rounded-xl shadow-sm border border-slate-50 active:scale-[0.98] transition-transform"
    >
      <div className={`w-10 h-10 ${color} rounded-lg flex items-center justify-center`}>
        <Icon className={cn("w-5 h-5", color.includes('bg-[#1499AD]') && !color.includes('/10') ? "text-white" : "text-[#1499AD]")} />
      </div>
      <span className="text-[9px] font-black uppercase tracking-tight text-slate-700 leading-none">{label}</span>
    </motion.button>
  );

  // Skeleton
  const SkeletonCard = () => (
    <div className="bg-white rounded-2xl p-4 mb-3 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-slate-200" />
        <div className="flex-1 space-y-2">
          <div className="w-32 h-5 bg-slate-200 rounded" />
          <div className="w-24 h-4 bg-slate-200 rounded" />
        </div>
      </div>
    </div>
  );

  return (
    <PullToRefresh onRefresh={loadData}>
      <div className="min-h-screen bg-slate-50 pb-28">
        {/* Premium Header */}
        <div className="bg-white border-b border-slate-50 shadow-sm">
          <div className="px-5 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-[#1499AD] rounded-2xl flex items-center justify-center shadow-lg shadow-[#1499AD]/20 text-white">
                  <Heart className="w-7 h-7 fill-current" />
                </div>
                <div>
                  <h1 className="text-xl font-black text-slate-900 tracking-tight">{t('common.welcomeBack')} 👋</h1>
                  <p className="text-[10px] font-bold text-[#1499AD] uppercase tracking-[0.2em] mt-0.5">{t('dashboard.overview')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="px-4 py-3">
          <div className="grid grid-cols-2 gap-2.5">
            <StatCard
              title={t('navigation.patients')}
              value={stats.patients}
              subtitle={t('patients.patientList')}
              icon={Users}
              color="bg-white border border-slate-100 !text-slate-900 shadow-sm"
              onClick={() => navigate('/patients')}
            />
            <StatCard
              title={t('appointments.calendar')}
              value={stats.appointments}
              subtitle={t('appointments.waiting')}
              icon={Calendar}
              color="bg-[#1499AD] text-white shadow-lg shadow-[#1499AD]/20"
              onClick={() => navigate('/appointments')}
            />
            <StatCard
              title={t('common.today')}
              value={formatCurrency(stats.todayRevenue)}
              subtitle={t('payments.income')}
              icon={DollarSign}
              color="bg-white border border-slate-100 !text-slate-900 shadow-sm"
              onClick={() => navigate('/payments')}
            />
            <StatCard
              title={t('dashboard.revenueChart')}
              value={`+${stats.growth}%`}
              subtitle={t('dashboard.thisMonth')}
              icon={TrendingUp}
              color="bg-[#1499AD] text-white shadow-lg shadow-[#1499AD]/20"
              onClick={() => navigate('/reports')}
            />
          </div>
        </div>

        {/* Today's Appointments */}
        <div className="px-4 mb-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-[900] text-slate-900 tracking-tight">{t('dashboard.todayAppointments')}</h2>
            <button 
              onClick={() => navigate('/appointments')}
              className="text-[10px] font-black text-[#1499AD] uppercase tracking-widest flex items-center gap-1 bg-[#1499AD]/5 px-2.5 py-1.5 rounded-full"
            >
              {t('common.all')}
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : todayAppointments.length > 0 ? (
            <AnimatePresence>
              {todayAppointments.map((app, index) => (
                <AppointmentCard key={app.id} app={app} index={index} />
              ))}
            </AnimatePresence>
          ) : (
            <div className="text-center py-6 bg-white rounded-xl">
              <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-500">{t('common.noData')}</p>
            </div>
          )}
        </div>
 
        {/* Quick Actions */}
        <div className="px-4 mb-5">
          <h2 className="text-base font-[900] text-slate-900 tracking-tight mb-3">{t('dashboard.quickActions')}</h2>
          <div className="grid grid-cols-3 gap-2.5">
            <QuickAction
              icon={UserPlus}
              label={t('patients.addNew')}
              color="bg-[#1499AD]/10 !text-[#1499AD]"
              onClick={() => navigate('/patients', { state: { openAddModal: true } })}
            />
            <QuickAction
              icon={CalendarPlus}
              label={t('appointments.addNew')}
              color="bg-[#1499AD]"
              onClick={() => navigate('/appointments', { state: { openAddModal: true } })}
            />
            <QuickAction
              icon={Phone}
              label={t('navigation.recalls')}
              color="bg-[#1499AD]/10 !text-[#1499AD]"
              onClick={() => navigate('/recall')}
            />
          </div>
        </div>
 
        {/* Recent Activity */}
        <div className="px-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-[900] text-slate-900 tracking-tight">{t('dashboard.recentActivity')}</h2>
            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
              <Activity className="w-3.5 h-3.5 text-slate-400" />
            </div>
          </div>
          
          <div className="bg-white rounded-2xl p-1 shadow-sm border border-slate-100/50 overflow-hidden">
            {recentActivity.length > 0 ? (
              <div className="divide-y divide-slate-50">
                {recentActivity.map((item, index) => {
                  const isPayment = item.type === 'payment';
                  return (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(index, 6) * 0.02 }}
                      key={index} 
                      className="flex items-center gap-3 p-3 active:bg-slate-50 transition-colors content-visibility-auto"
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        isPayment ? 'bg-emerald-50' : 'bg-blue-50'
                      }`}>
                        {isPayment ? (
                          <DollarSign className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Calendar className="w-4 h-4 text-blue-600" />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-black text-slate-900 truncate tracking-tight">
                            {isPayment ? (item.patient_name || "To'lov") : item.patient_name}
                          </p>
                          <span className="text-[9px] font-bold text-slate-400 whitespace-nowrap uppercase tracking-widest">
                            {item.time || formatActivityDate(item.date)}
                          </span>
                        </div>
                        <p className={`text-[10px] font-bold mt-0.5 tracking-wide ${
                          isPayment ? 'text-emerald-600' : 'text-slate-500'
                        }`}>
                          {isPayment ? formatCurrency(item.amount) : (item.service_name || 'Navbat')}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center">
                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Activity className="w-6 h-6 text-slate-200" />
                </div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('common.noData')}</p>
              </div>
            )}
          </div>
        </div>

        {/* Bottom spacing — Tab Bar uchun joy */}
        <div className="h-24" />
      </div>
    </PullToRefresh>
  );
}
