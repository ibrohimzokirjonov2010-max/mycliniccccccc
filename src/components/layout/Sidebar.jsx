import { useState, useEffect, useMemo, memo } from 'react';
import { motion } from 'framer-motion';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, CalendarDays, UserPlus, CreditCard,
  Stethoscope, Package, BarChart3, ClipboardList, Bell, AlertTriangle,
  Activity, Wallet, Settings, ChevronLeft, ChevronRight, Zap, TrendingDown,
  LogOut, Heart, Target, Camera
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { base44 } from '@/api/base44Client';
import { useTranslation } from '@/i18n/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import { useFeature } from '@/hooks/useFeature';
import { prefetchModuleData } from '@/utils/prefetcher';

/**
 * Navigation menu items configuration
 * Each item defines a route with its label and icon
 */
const getMenuItems = (t) => [
  { path: '/', label: t('navigation.dashboard'), icon: LayoutDashboard },
  { path: '/patients', label: t('navigation.patients'), icon: Users },
  { path: '/appointments', label: t('navigation.appointments'), icon: CalendarDays },
  { path: '/leads', label: t('navigation.leads'), icon: UserPlus },
  { path: '/payments', label: t('navigation.payments'), icon: CreditCard },
  { path: '/expenses', label: t('navigation.expenses'), icon: TrendingDown },
  { path: '/payroll', label: t('navigation.payroll'), icon: Wallet },
  { path: '/services', label: t('navigation.services'), icon: Stethoscope },
  { path: '/inventory', label: t('navigation.inventory'), icon: Package },
  { path: '/reports', label: t('navigation.reports'), icon: BarChart3 },
  { path: '/treatment-plans', label: t('navigation.treatmentPlans'), icon: ClipboardList },
  { path: '/recall', label: t('navigation.recalls'), icon: Bell },
  { path: '/no-show', label: t('navigation.noShow'), icon: AlertTriangle },
  { path: '/treatment-tracking', label: t('navigation.treatmentTracking'), icon: Activity },
  { path: '/debts', label: t('navigation.debts'), icon: Wallet },
  { path: '/implants', label: t('navigation.implants'), icon: Zap },
  { path: '/marketing', label: t('navigation.marketing'), icon: Target },
  { path: '/cases', label: t('navigation.cases') || 'Mening Keyslarim', icon: Camera },
  { path: '/settings', label: t('navigation.settings'), icon: Settings },
];

/**
 * Sidebar Component
 * 
 * Responsive sidebar navigation for the dental clinic management system.
 * Supports both desktop (collapsible) and mobile (drawer) modes.
 * 
 * @param {Object} props
 * @param {boolean} props.collapsed - Whether sidebar is collapsed (desktop)
 * @param {Function} props.onToggle - Toggle collapse callback
 * @param {boolean} props.mobileOpen - Whether mobile drawer is open
 * @param {Function} props.onMobileClose - Close mobile drawer callback
 */
export default memo(function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, isAdmin, isDoctor, logout } = useAuth();
  const [currentClinic, setCurrentClinic] = useState({ name: 'Klinika', logo: null });
  const hasImplantsAccess = useFeature('implants');
  const hasTechniciansAccess = useFeature('technicians');
  const hasExpensesAccess = useFeature('expenses');
  const hasPayrollAccess = useFeature('payroll');
  const hasServicesAccess = useFeature('services');
  const hasInventoryAccess = useFeature('inventory');
  const hasReportsAccess = useFeature('reports');
  const hasTreatmentPlansAccess = useFeature('treatment_plans');
  const hasNoShowAccess = useFeature('no_show');
  const hasTreatmentTrackingAccess = useFeature('treatment_tracking');
  const hasDebtsAccess = useFeature('debts');
  const hasMarketingAccess = useFeature('marketing');
  const hasCasesAccess = useFeature('cases');
  const hasStaffAccess = useFeature('staff');

  useEffect(() => {
    const fetchClinic = async () => {
      try {
        const clinic = await base44.clinic.getCurrentClinic();
        if (clinic) setCurrentClinic(clinic);
      } catch (err) {
        console.error('Failed to fetch clinic in sidebar:', err);
      }
    };
    fetchClinic();
  }, []);

  const handleLogout = () => {
    logout();
  };
  
  const filteredMenuItems = useMemo(() => {
    let items = getMenuItems(t);
    
    if (!user || user.role === undefined) {
      return items.filter(item => ['/', '/patients', '/appointments'].includes(item.path));
    }

    if (isDoctor) {
      const doctorAllowedPaths = ['/', '/patients', '/appointments', '/leads', '/treatment-plans', '/implants', '/technicians', '/cases', '/settings'];
      return items.filter(item => doctorAllowedPaths.includes(item.path));
    }
    
    // Plan based feature restrictions
    const restrictions = [
      { allowed: hasImplantsAccess, path: '/implants' },
      { allowed: hasTechniciansAccess, path: '/technicians' },
      { allowed: hasExpensesAccess, path: '/expenses' },
      { allowed: hasPayrollAccess, path: '/payroll' },
      { allowed: hasServicesAccess, path: '/services' },
      { allowed: hasInventoryAccess, path: '/inventory' },
      { allowed: hasReportsAccess, path: '/reports' },
      { allowed: hasTreatmentPlansAccess, path: '/treatment-plans' },
      { allowed: hasNoShowAccess, path: '/no-show' },
      { allowed: hasTreatmentTrackingAccess, path: '/treatment-tracking' },
      { allowed: hasDebtsAccess, path: '/debts' },
      { allowed: hasMarketingAccess, path: '/marketing' },
      { allowed: hasCasesAccess, path: '/cases' }
    ];

    for (const res of restrictions) {
      if (!res.allowed) {
        items = items.filter(item => item.path !== res.path);
      }
    }
    
    return items;
  }, [
    t, isDoctor, user, 
    hasImplantsAccess, hasTechniciansAccess, hasExpensesAccess, hasPayrollAccess, 
    hasServicesAccess, hasInventoryAccess, hasReportsAccess, hasTreatmentPlansAccess, 
    hasNoShowAccess, hasTreatmentTrackingAccess, hasDebtsAccess, hasMarketingAccess, 
    hasCasesAccess, hasStaffAccess
  ]);

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full bg-white lg:bg-[#0C1222]/95 lg:backdrop-blur-2xl border-r border-slate-100 lg:border-white/5 shadow-2xl relative z-20 overflow-hidden">
      {/* Premium Logo Section */}
      <div className={cn(
        "flex items-center mb-1 flex-shrink-0 transition-all duration-300",
        collapsed ? "justify-center px-2 py-4" : "gap-3 px-4 py-4"
      )}>
        <motion.div 
          whileHover={{ rotate: 360 }}
          transition={{ duration: 1 }}
          className={cn(
            "bg-sky-500 lg:bg-[#1499AD] rounded-xl flex items-center justify-center shadow-lg text-white flex-shrink-0 transition-all duration-300",
            collapsed ? "w-10 h-10 rounded-xl" : "w-10 h-10 lg:w-12 lg:h-12 lg:rounded-2xl"
          )}
        >
          <Heart className={cn("fill-white/20 transition-all duration-300", collapsed ? "w-5 h-5" : "w-6 h-6 lg:w-7 lg:h-7")} />
        </motion.div>
        {!collapsed && (
          <div className="flex flex-col">
            <span className="text-slate-900 lg:text-white font-[900] text-lg lg:text-xl tracking-tighter leading-none uppercase">SHIFOCRM</span>
            <span className="text-[10px] text-slate-400 lg:text-[#1499AD] font-bold tracking-wider mt-0.5 lg:mt-1 uppercase opacity-80">
              {t('navigation.subtitle') || 'Klinika Boshqaruvi'}
            </span>
          </div>
        )}
      </div>

      {/* Enhanced Navigation Menu */}
      <nav className="flex-1 overflow-y-auto px-3 space-y-0.5 py-2 no-scrollbar">
        {filteredMenuItems.map((item, idx) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => { onMobileClose(); prefetchModuleData(item.path); }}
              onMouseEnter={() => prefetchModuleData(item.path)}
              className={cn(
                'flex items-center rounded-xl text-[10px] font-bold transition-all duration-200 relative group uppercase tracking-wider',
                collapsed ? 'justify-center p-2 mx-1.5' : 'gap-3 px-3 py-1.5',
                active
                  ? 'bg-sky-500 lg:bg-[#1499AD] text-white shadow-md lg:shadow-[#1499AD]/15'
                  : 'text-slate-500 lg:text-slate-400 hover:bg-slate-50 lg:hover:bg-white/5 hover:text-slate-900 lg:hover:text-white'
              )}
            >
              {active && (
                <motion.div 
                  layoutId="sidebarActive"
                  className="absolute inset-0 bg-gradient-to-r from-[#1499AD] to-[#0E7A8A] rounded-xl z-0"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <Icon className={cn('w-5 h-5 flex-shrink-0 transition-all relative z-10', active ? 'text-white' : 'text-slate-400 lg:text-slate-500 group-hover:text-slate-900 lg:group-hover:text-white group-hover:scale-110')} />
              {!collapsed && <span className="truncate relative z-10">{item.label}</span>}
              
              {active && !collapsed && (
                <div className="absolute right-4 w-1.5 h-1.5 rounded-full bg-white z-10 shadow-sm" />
              )}
            </Link>
          );
        })}
      </nav>

       {/* Premium User Profile Card */}
      <div className={cn("border-t border-slate-50 lg:border-white/5 flex-shrink-0 transition-all duration-300", collapsed ? "p-2" : "p-4")}>
        {!collapsed ? (
          <div className="bg-white lg:bg-white/5 backdrop-blur-md rounded-[1.25rem] p-3 border border-slate-100 lg:border-white/5 flex items-center justify-between group transition-all shadow-sm lg:shadow-lg hover:shadow-md">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#1499AD] flex items-center justify-center text-white font-black text-xs shadow-md">
                {user?.name?.[0] || 'U'}
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-slate-900 lg:text-white truncate tracking-tight leading-none uppercase">{user?.full_name || user?.name || 'Foydalanuvchi'}</p>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className="text-[10px] font-bold text-[#1499AD] lg:text-emerald-400 tracking-wider uppercase bg-sky-50 lg:bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-sky-100 lg:border-emerald-500/10">
                    {user?.role === 'doctor' ? 'Shifokor' : 'Admin'}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 transition-all active:scale-95"
              title={t('common.logout')}
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-[#1499AD] flex items-center justify-center text-white font-black text-xs shadow-md" title={user?.full_name || user?.name || 'Foydalanuvchi'}>
              {user?.name?.[0] || 'U'}
            </div>
            <button
              onClick={handleLogout}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-all active:scale-95"
              title={t('common.logout')}
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        )}
        
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center py-3 mt-2 text-slate-500 hover:text-sky-500 lg:hover:text-white transition-colors active:scale-95"
        >
          {collapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <div className="flex items-center gap-2 opacity-40 hover:opacity-100 transition-opacity">
              <ChevronLeft className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase tracking-wider leading-none">{t('common.close')}</span>
            </div>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Overlay */}
      {mobileOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
          onClick={onMobileClose}
        />
      )}

      {/* Mobile Sidebar (Drawer) */}
      <aside 
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-72 bg-white transform transition-transform duration-300 ease-in-out lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {renderSidebarContent()}
      </aside>

      {/* Desktop Sidebar */}
      <aside 
        className={cn(
          'hidden lg:flex flex-col bg-[#0C1222] transition-all duration-300 flex-shrink-0 h-screen sticky top-0',
          collapsed ? 'w-16' : 'w-60'
        )}
      >
        {renderSidebarContent()}
      </aside>
    </>
  );
});
