import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, Calendar, DollarSign, TrendingUp,
  ChevronRight, Clock, Phone
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import PullToRefresh from '@/components/ui/PullToRefresh';
import { formatCurrency } from '@/lib/utils';

/**
 * Professional Mobile Dashboard
 * Native app style with cards and smooth animations
 */
export default function MobileDashboard() {
  const [stats, setStats] = useState({
    patients: 0,
    appointments: 0,
    revenue: 0,
    todayAppointments: []
  });
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [patients, appointments, payments] = await Promise.all([
        base44.entities.Patient.list('-created_date', 100),
        base44.entities.Appointment.list('-date', 50),
        base44.entities.Payment.filter({ type: 'Income' }, '-date', 100)
      ]);

      const today = new Date().toISOString().split('T')[0];
      const todayApps = appointments.filter(a => {
        if (!a || !a.date) return false;
        const cleanDate = a.date.includes('T') ? a.date.split('T')[0] : a.date.split(' ')[0];
        return cleanDate === today;
      });
      const todayRevenue = payments
        .filter(p => {
          if (!p || !p.date) return false;
          const cleanDate = p.date.includes('T') ? p.date.split('T')[0] : p.date.split(' ')[0];
          return cleanDate === today;
        })
        .reduce((sum, p) => sum + (p.amount || 0), 0);

      setStats({
        patients: patients.length,
        appointments: appointments.length,
        revenue: todayRevenue,
        todayAppointments: todayApps.slice(0, 5)
      });
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Stat card component
  const StatCard = ({ icon: Icon, label, value, color, delay }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500 mb-1">{label}</p>
          <p className="text-xl font-bold text-gray-800">{value}</p>
        </div>
        <div 
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${color}20` }}
        >
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
      </div>
    </motion.div>
  );

  // Appointment card
  const AppointmentCard = ({ appointment, index }) => (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.3 + index * 0.1 }}
      className="bg-white rounded-xl p-4 mb-3 shadow-sm border border-gray-100 flex items-center gap-3"
    >
      <div className="w-12 h-12 bg-gradient-to-br from-teal-400 to-teal-600 rounded-full flex items-center justify-center text-white font-bold">
        {appointment.patient_name?.charAt(0) || '?'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-800 truncate">{appointment.patient_name}</p>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Clock className="w-3 h-3" />
          <span>{appointment.time}</span>
          <span className="w-1 h-1 bg-gray-300 rounded-full" />
          <span>{appointment.service_name}</span>
        </div>
      </div>
      <ChevronRight className="w-5 h-5 text-gray-400" />
    </motion.div>
  );

  // Skeleton loader
  const SkeletonCard = () => (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="w-16 h-3 bg-gray-200 rounded" />
          <div className="w-20 h-6 bg-gray-200 rounded" />
        </div>
        <div className="w-10 h-10 bg-gray-200 rounded-xl" />
      </div>
    </div>
  );

  return (
    <PullToRefresh onRefresh={loadData}>
      <div className="min-h-screen bg-gray-50 p-4 space-y-4">
        {/* Welcome */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h1 className="text-2xl font-bold text-gray-800">Salom! 👋</h1>
          <p className="text-gray-500 text-sm">Bugun klinikada nimalar bo'lyapti?</p>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : (
            <>
              <StatCard
                icon={Users}
                label="Bemorlar"
                value={stats.patients}
                color="#3b82f6"
                delay={0}
              />
              <StatCard
                icon={Calendar}
                label="Kalendar"
                value={stats.appointments}
                color="#f59e0b"
                delay={0.1}
              />
              <StatCard
                icon={DollarSign}
                label="Bugun"
                value={formatCurrency(stats.revenue)}
                color="#10b981"
                delay={0.2}
              />
              <StatCard
                icon={TrendingUp}
                label="O'sish"
                value="+12%"
                color="#8b5cf6"
                delay={0.3}
              />
            </>
          )}
        </div>

        {/* Today's Appointments */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-800">Bugun navbatlar</h2>
            <button className="text-teal-600 text-sm font-medium flex items-center gap-1">
              Barchasi
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white rounded-xl p-4 shadow-sm animate-pulse flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-200 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="w-32 h-4 bg-gray-200 rounded" />
                    <div className="w-24 h-3 bg-gray-200 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : stats.todayAppointments.length > 0 ? (
            <div>
              {stats.todayAppointments.map((app, index) => (
                <AppointmentCard key={app.id} appointment={app} index={index} />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl p-8 text-center">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Bugun navbatlar yo'q</p>
            </div>
          )}
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-6"
        >
          <h2 className="font-bold text-gray-800 mb-4">Tezkor amallar</h2>
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: Users, label: 'Bemor', color: '#3b82f6', path: '/patients/new' },
              { icon: Calendar, label: 'Navbat', color: '#f59e0b', path: '/appointments/new' },
              { icon: Phone, label: 'Qo\'ng\'iroq', color: '#10b981', path: '/leads/new' },
            ].map((action, index) => (
              <motion.button
                key={action.label}
                whileTap={{ scale: 0.95 }}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.7 + index * 0.1 }}
                className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col items-center gap-2"
              >
                <div 
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${action.color}20` }}
                >
                  <action.icon className="w-6 h-6" style={{ color: action.color }} />
                </div>
                <span className="text-xs font-medium text-gray-700">{action.label}</span>
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Bottom spacing for tab bar */}
        <div className="h-8" />
      </div>
    </PullToRefresh>
  );
}
