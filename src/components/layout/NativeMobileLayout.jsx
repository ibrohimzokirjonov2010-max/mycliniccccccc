import { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Home, Users, Calendar, Wallet, Menu,
  ChevronLeft, ChevronRight, Bell, Plus, X, LogOut,
  Stethoscope, Package, BarChart3, ClipboardList,
  AlertTriangle, Activity, Settings, Zap, UserPlus,
  TrendingDown, Wrench, Target, Camera
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import AdBanner from './AdBanner';
import SubscriptionBanner from './SubscriptionBanner';
import SubscriptionBlockedView from './SubscriptionBlockedView';
import NotificationPanel from '../notifications/NotificationPanel';
import { notificationStore } from '@/lib/notificationStore';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { useTranslation } from '@/i18n/LanguageContext';
import ErrorBoundary from './ErrorBoundary';
import { Suspense, memo } from 'react';

// Specialized loader for within-page transitions
const InlineLoader = memo(() => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-2 border-emerald-100 border-t-emerald-500 rounded-full animate-spin" />
      <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Yuklanmoqda...</span>
    </div>
  </div>
));

const MENU_ITEMS_GEN = (t) => [
  // Core Modules
  { path: '/', label: t('navigation.dashboard'), icon: Home, color: 'text-teal-600', bg: 'bg-teal-50' },
  { path: '/patients', label: t('navigation.patients'), icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
  { path: '/appointments', label: t('navigation.appointments'), icon: Calendar, color: 'text-amber-600', bg: 'bg-amber-50' },
  { path: '/leads', label: t('navigation.leads'), icon: UserPlus, color: 'text-rose-600', bg: 'bg-rose-50' },
  
  // Clinical Modules
  { path: '/treatment-plans', label: t('navigation.treatmentPlans'), icon: ClipboardList, color: 'text-sky-600', bg: 'bg-sky-50' },
  { path: '/cases', label: t('navigation.cases') || "Mening Keyslarim", icon: Camera, color: 'text-emerald-500', bg: 'bg-emerald-50' },
  { path: '/implants', label: t('navigation.implants'), icon: Zap, color: 'text-yellow-600', bg: 'bg-yellow-50' },
  { path: '/treatment-tracking', label: t('navigation.treatmentTracking'), icon: Activity, color: 'text-green-600', bg: 'bg-green-50' },
  
  // Financial Modules
  { path: '/payments', label: t('navigation.payments'), icon: Wallet, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { path: '/debts', label: t('navigation.debts'), icon: Wallet, color: 'text-rose-700', bg: 'bg-rose-50' },
  { path: '/expenses', label: t('navigation.expenses'), icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50' },
  { path: '/payroll', label: t('navigation.payroll'), icon: Wallet, color: 'text-purple-600', bg: 'bg-purple-50' },
  
  // Logistics & Staff
  { path: '/staff', label: t('navigation.staff'), icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  { path: '/services', label: t('navigation.services'), icon: Stethoscope, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  { path: '/inventory', label: t('navigation.inventory'), icon: Package, color: 'text-orange-600', bg: 'bg-orange-50' },
  { path: '/technicians', label: t('navigation.technicians'), icon: Wrench, color: 'text-indigo-700', bg: 'bg-indigo-50' },
  
  // CRM & Reports
  { path: '/recall', label: t('navigation.recalls'), icon: Bell, color: 'text-pink-600', bg: 'bg-pink-50' },
  { path: '/marketing', label: t('navigation.marketing'), icon: Target, color: 'text-rose-600', bg: 'bg-rose-50' },
  { path: '/reports', label: t('navigation.reports'), icon: BarChart3, color: 'text-cyan-600', bg: 'bg-cyan-50' },
  { path: '/no-show', label: t('navigation.noShow'), icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
  
  // System
  { path: '/settings', label: t('settings.title'), icon: Settings, color: 'text-slate-600', bg: 'bg-slate-50' },
];



/**
 * Native Mobile Layout - Professional iOS/Android style
 */
export default function NativeMobileLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin, isDoctor, logout } = useAuth();
  const { t } = useTranslation();
  const [currentClinic, setCurrentClinic] = useState({ name: 'Klinika', logo: null });
  const [showMenu, setShowMenu] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const contentRef = useRef(null);
  const handleLogout = () => {
    logout();
    setShowMenu(false);
    navigate('/login');
  };

  const updateUnread = () => {
    setUnreadCount(notificationStore.getUnreadCount());
  };

  useEffect(() => {
    updateUnread();
    window.addEventListener('notifications-updated', updateUnread);
    return () => window.removeEventListener('notifications-updated', updateUnread);
  }, []);

  useEffect(() => {
    const fetchClinic = async () => {
      try {
        const clinics = await base44.clinic.getAll();
        const currentClinicId = (localStorage.getItem('current_clinic_id') || '').toLowerCase();
        const clinic = clinics.find(c => (c.id || '').toLowerCase() === currentClinicId);

        if (clinic) {
          setCurrentClinic(clinic);
          
          if (clinic.status === 'Inactive' || clinic.status === 'Blocked') {
            setIsExpired(true);
            return;
          }

          if (clinic.expires_at) {
            const expiryDate = new Date(clinic.expires_at);
            expiryDate.setHours(23, 59, 59, 999);
            
            if (new Date() > expiryDate) {
              setIsExpired(true);
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch clinic in mobile layout:', err);
      }
    };
    fetchClinic();
  }, []);

  // Track scroll for header blur effect
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const filteredMenuItems = useMemo(() => {
    let items = MENU_ITEMS_GEN(t);
    
    // Role based filtering
    if (isDoctor) {
      const doctorAllowedPaths = ['/', '/patients', '/appointments', '/leads', '/treatment-plans', '/implants', '/technicians', '/cases', '/settings'];
      items = items.filter(item => doctorAllowedPaths.includes(item.path));
    }
    
    // SuperAdmin hiding logic - only show 'System Admin' to user with username 'admin'
    if (user?.username !== 'admin') {
      items = items.filter(item => item.path !== '/super-admin');
    }
    
    return items;
  }, [isDoctor, user, t]);

  const tabs = useMemo(() => [
    { path: '/', icon: Home, label: t('navigation.dashboard'), color: '#1499AD' },
    { path: '/patients', icon: Users, label: t('navigation.patients'), color: '#1499AD' },
    { path: '/appointments', icon: Calendar, label: t('appointments.calendar'), color: '#1499AD' },
    { path: '/payments', icon: Wallet, label: t('navigation.payments'), color: '#1499AD' },
  ], [t]);

  const quickActions = useMemo(() => [
    { path: '/patients', icon: Users, label: t('patients.addNew'), color: '#3b82f6', state: { openAddModal: true } },
    { path: '/appointments', icon: Calendar, label: t('appointments.addNew'), color: '#f59e0b', state: { openAddModal: true } },
    { path: '/payments', icon: Wallet, label: t('payments.income'), color: '#10b981', state: { openAddModal: true } },
    { path: '/payroll', icon: UserPlus, label: t('payroll.addDoctor'), color: '#00D084', state: { openAddDoctor: true } },
  ], [t]);

  // Page transition variants
  const pageVariants = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24 md:pb-0 overflow-x-hidden">
      {/* iOS-style Premium Header */}
      <header 
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          isScrolled 
            ? 'bg-white/80 backdrop-blur-2xl shadow-xl shadow-slate-200/20 border-b border-white/40' 
            : 'bg-transparent'
        }`}
      >
        <div className="flex items-center justify-between h-16 px-6">
          <div className="flex items-center gap-4">
            {location.pathname !== '/' ? (
              <motion.button 
                whileTap={{ scale: 0.9 }}
                onClick={() => navigate(-1)}
                className="p-2.5 -ml-2 rounded-2xl bg-white/50 backdrop-blur-md shadow-sm border border-white/60 text-slate-700"
              >
                <ChevronLeft className="w-5 h-5" />
              </motion.button>
            ) : (
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-xl shadow-[#1499AD]/10 overflow-hidden p-0 ring-1 ring-slate-100">
                    {currentClinic?.logo ? (
                        <img 
                            src={currentClinic.logo} 
                            alt="Logo" 
                            className="w-full h-full object-cover scale-110"
                        />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-[#1499AD] to-[#0E7A8A] rounded-2xl flex items-center justify-center">
                            <Stethoscope className="w-5 h-5 text-white" />
                        </div>
                    )}
                </div>
            )}
            <div className="flex flex-col">
              <span className="font-[900] text-lg text-slate-900 tracking-tighter leading-tight">{currentClinic?.name || 'Klinika'}</span>
              <span className="text-[9px] font-black text-[#1499AD] uppercase tracking-widest opacity-60">Dental System</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <LanguageSwitcher variant="minimal" />
            <motion.button 
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowNotifications(true)}
              className="p-3 rounded-2xl bg-white/50 backdrop-blur-md shadow-sm border border-white/60 relative text-slate-600"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 w-4 h-4 bg-red-500 border-2 border-white rounded-full flex items-center justify-center text-[8px] font-black text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </motion.button>
            <motion.button 
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowMenu(true)}
              className="p-3 rounded-2xl bg-slate-900 shadow-xl shadow-slate-900/20 text-white"
            >
              <Menu className="w-5 h-5" />
            </motion.button>
          </div>
        </div>
      </header>

      {/* Global Notifications Panel */}
      <NotificationPanel 
        isOpen={showNotifications} 
        onClose={() => setShowNotifications(false)} 
      />

      {/* Main Content with Page Transitions */}
      <main ref={contentRef} className="pt-16">
        <div className="px-5 mt-4">
          <SubscriptionBanner />
        </div>
        <AnimatePresence mode="popLayout">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
          >
            <ErrorBoundary>
              <Suspense fallback={<InlineLoader />}>
                {isExpired ? <SubscriptionBlockedView /> : children}
              </Suspense>
            </ErrorBoundary>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* iOS-style Modern Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-3xl border-t border-slate-100 z-50 safe-area-pb">
        <div className="flex items-center justify-around h-20 px-4">
          {tabs.map((tab, index) => {
            const isActive = location.pathname === tab.path;
            const Icon = tab.icon;
            
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className="relative flex flex-col items-center justify-center flex-1 h-full active:scale-90 transition-transform duration-200"
              >
                {/* Active indicator bar */}
                {isActive && (
                  <motion.div
                    layoutId="activeTabMobile"
                    className="absolute top-0 w-8 h-1 rounded-full bg-[#1499AD] shadow-lg shadow-[#1499AD]/40"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
                
                {/* Icon with glow */}
                <motion.div
                  animate={{ 
                    scale: isActive ? 1.2 : 1,
                    y: isActive ? -4 : 0
                  }}
                  className="relative"
                >
                  {isActive && (
                    <div className="absolute inset-0 blur-lg bg-[#1499AD]/30 rounded-full" />
                  )}
                  <Icon 
                    className="w-6 h-6 transition-colors duration-300 relative z-10"
                    style={{ color: isActive ? '#1499AD' : '#94A3B8' }}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                </motion.div>
                
                {/* Label */}
                <span 
                  className={`text-[10px] font-black mt-1.5 transition-all duration-300 tracking-tighter uppercase ${
                    isActive ? 'text-slate-900 opacity-100' : 'text-slate-400 opacity-60'
                  }`}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Floating Action Button (FAB) */}
      {location.pathname !== '/cases' && (
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => setShowQuickActions(!showQuickActions)}
          className="fixed right-5 bottom-24 z-40 w-13 h-13 bg-gradient-to-br from-[#1499AD] to-[#0E7A8A] rounded-full shadow-xl shadow-[#1499AD]/40 flex items-center justify-center text-white border-[3px] border-white"
          style={{ width: 52, height: 52 }}
        >
          <motion.div
            animate={{ rotate: showQuickActions ? 45 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <Plus className="w-6 h-6 text-white" />
          </motion.div>
        </motion.button>
      )}

      {/* Quick Actions Menu */}
      <AnimatePresence>
        {showQuickActions && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowQuickActions(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40"
            />
            
            {/* Actions */}
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 10 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className="fixed right-4 bottom-[96px] z-50 flex flex-col items-end gap-2"
            >
              {quickActions.map((action, index) => (
                <motion.button
                  key={action.path}
                  initial={{ opacity: 0, x: 16, scale: 0.9 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 16, scale: 0.9 }}
                  transition={{ delay: index * 0.04, type: 'spring', stiffness: 400, damping: 25 }}
                  whileTap={{ scale: 0.94 }}
                  onClick={() => {
                    navigate(action.path, { state: action.state });
                    setShowQuickActions(false);
                  }}
                  className="flex items-center gap-2.5 bg-white/95 backdrop-blur-md rounded-2xl pl-3.5 pr-2 py-2 shadow-lg shadow-black/10 border border-white/60 active:scale-95 transition-transform"
                >
                  <span className="text-[12px] font-bold text-slate-700 leading-none">{action.label}</span>
                  <div 
                    className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                    style={{ backgroundColor: action.color }}
                  >
                    <action.icon className="w-4 h-4 text-white" />
                  </div>
                </motion.button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Full Screen Menu */}
      <AnimatePresence>
        {showMenu && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50"
          >
            {/* Backdrop */}
            <div 
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowMenu(false)}
            />
            
            {/* Menu Content */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="absolute right-0 top-0 bottom-0 w-[85%] bg-white shadow-2xl flex flex-col rounded-l-[2rem] overflow-hidden"
            >
              <div className="p-5 border-b flex items-center justify-between bg-slate-50/50">
                <div />
                <button 
                  onClick={() => setShowMenu(false)}
                  className="p-2.5 rounded-2xl bg-white border border-slate-100 text-slate-400 shadow-sm active:scale-90 transition-transform"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <nav className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar bg-white">
                {filteredMenuItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  
                  return (
                    <button
                      key={item.path}
                      onClick={() => {
                        navigate(item.path);
                        setShowMenu(false);
                      }}
                      className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all active:scale-[0.98] border ${
                        isActive 
                          ? 'bg-[#1499AD] border-[#1499AD] shadow-lg shadow-[#1499AD]/20' 
                          : 'bg-white border-slate-50 hover:bg-slate-50'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform ${
                        isActive ? 'bg-white/10 rotate-3' : item.bg
                      }`}>
                        <Icon className={`w-5 h-5 ${isActive ? 'text-white' : item.color}`} />
                      </div>
                      <div className="flex-1 text-left">
                        <span className={`text-sm font-black tracking-tight block ${
                          isActive ? 'text-white' : 'text-slate-700'
                        }`}>
                          {item.label}
                        </span>
                      </div>
                      {!isActive && (
                        <div className="w-6 h-6 rounded-full bg-slate-50 flex items-center justify-center">
                          <ChevronLeft className="w-3.5 h-3.5 text-slate-300 rotate-180" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </nav>

              {/* Bottom Footer */}
              <div className="p-6 border-t bg-slate-50/50">
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-white border border-slate-100 shadow-sm mb-3">
                  <div className="w-10 h-10 rounded-full bg-[#1499AD] flex items-center justify-center text-white font-black text-sm">
                    {user?.name?.[0] || 'U'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-slate-900 truncate tracking-tight">{user?.full_name || user?.name || 'User'}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{user?.role === 'doctor' ? 'Yakka doktor' : 'Administrator'}</p>
                  </div>
                </div>
                
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center justify-between p-5 bg-rose-50 text-rose-600 rounded-[2rem] active:scale-[0.98] transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center">
                      <LogOut className="w-5 h-5" />
                    </div>
                    <span className="font-bold">{t('common.logout')}</span>
                  </div>
                  <ChevronRight className="w-5 h-5 opacity-40 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Advertisement Banner */}
      <AdBanner />
    </div>
  );
}
