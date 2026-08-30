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
import { ImplantIcon } from '@/components/ui/Icons';
import ShifoCrmLogo from '@/components/ui/ShifoCrmLogo';

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
  { path: '/implants', label: t('navigation.implants'), icon: ImplantIcon },
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
      // Doktor uchun barcha 12 bo'lim ochiq — faqat o'z ma'lumotlari ko'rinadi (sahifalar ichida filtrlangan)
      const doctorAllowedPaths = [
        '/',                    // 1. Boshqaruv paneli
        '/patients',            // 2. Bemorlar
        '/appointments',        // 3. Uchrashuvlar
        '/leads',               // 4. Lidlar
        '/payments',            // 5. To'lovlar
        '/treatment-plans',     // 6. Davolash rejalari
        '/recall',              // 7. Eslashmalar
        '/no-show',             // 8. Kelgan emas
        '/treatment-tracking',  // 9. Davolash kuzatuvi
        '/debts',               // 10. Qarzlar
        '/implants',            // 11. Implantlar
        '/cases',               // 12. Mening keyslarim
        '/settings',
      ];
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
      {/* Premium High-Definition Logo Section */}
      <div className={cn(
        "flex items-center mb-1 flex-shrink-0 transition-all duration-300",
        collapsed ? "justify-center px-2 py-4" : "px-4 py-4"
      )}>
        <Link to="/" className="outline-none group">
          <ShifoCrmLogo 
            collapsed={collapsed} 
            size={collapsed ? "sm" : "md"} 
            className="transition-transform duration-200 group-hover:scale-[1.02]"
          />
        </Link>
      </div>

      {/* Enhanced Navigation Menu - Excel Spreadsheet Grid Style */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-2 no-scrollbar">
        {!collapsed ? (
          <div className="border border-slate-200 lg:border-slate-700/80 rounded-xl overflow-hidden bg-slate-50 lg:bg-[#091122]/90 shadow-sm divide-y divide-slate-200 lg:divide-slate-700/70">
            {filteredMenuItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => { onMobileClose(); prefetchModuleData(item.path); }}
                  onMouseEnter={() => prefetchModuleData(item.path)}
                  className={cn(
                    'flex items-center justify-between px-3.5 py-2.5 text-[11.5px] font-bold transition-all duration-150 relative group uppercase tracking-wider select-none',
                    active
                      ? 'bg-gradient-to-r from-[#1499AD] to-[#0ea5e9] text-white shadow-md z-10 font-black'
                      : 'text-slate-800 lg:text-slate-100 hover:bg-sky-100/70 lg:hover:bg-cyan-950/40 hover:text-slate-950 lg:hover:text-white'
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className={cn(
                      'w-4 h-4 flex-shrink-0 transition-transform duration-200',
                      active ? 'text-white scale-110' : 'text-slate-600 lg:text-slate-200 group-hover:text-[#1499AD] lg:group-hover:text-cyan-300 group-hover:scale-110'
                    )} />
                    <span className="truncate">{item.label}</span>
                  </div>

                  {active && (
                    <div className="w-2 h-2 rounded-full bg-white shrink-0 shadow-xs ml-1 ring-2 ring-cyan-200" />
                  )}
                </Link>
              );
            })}
          </div>
        ) : (
          /* Collapsed Mode - Grid Cells */
          <div className="space-y-1.5">
            {filteredMenuItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  title={item.label}
                  onClick={() => { onMobileClose(); prefetchModuleData(item.path); }}
                  onMouseEnter={() => prefetchModuleData(item.path)}
                  className={cn(
                    'flex items-center justify-center p-2.5 rounded-lg border transition-all duration-150 relative group',
                    active
                      ? 'bg-gradient-to-r from-[#1499AD] to-[#0ea5e9] text-white border-cyan-300 shadow-md ring-1 ring-cyan-400/40'
                      : 'bg-slate-100 lg:bg-slate-800/90 border-slate-300 lg:border-slate-700 text-slate-700 lg:text-slate-200 hover:border-[#1499AD] hover:bg-[#1499AD]/20 hover:text-white'
                  )}
                >
                  <Icon className={cn(
                    'w-4 h-4 transition-transform',
                    active ? 'text-white scale-110' : 'group-hover:scale-110'
                  )} />
                </Link>
              );
            })}
          </div>
        )}
      </nav>

       {/* Premium User Profile Card */}
      <div className={cn("border-t border-slate-200 lg:border-slate-800/80 flex-shrink-0 transition-all duration-300", collapsed ? "p-2" : "p-3")}>
        {!collapsed ? (
          <div className="bg-slate-100 lg:bg-slate-800/80 backdrop-blur-md rounded-2xl p-3 border border-slate-200 lg:border-slate-700/80 flex items-center justify-between group transition-all shadow-sm">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#1499AD] flex items-center justify-center text-white font-black text-xs shadow-md overflow-hidden shrink-0">
                {(user?.avatar_url || user?.photo || user?.avatar || user?.image) ? (
                  <img src={user.avatar_url || user.photo || user.avatar || user.image} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  user?.name?.[0]?.toUpperCase() || 'U'
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-black text-slate-900 lg:text-white truncate tracking-tight leading-none uppercase">{user?.full_name || user?.name || 'Foydalanuvchi'}</p>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className="text-[10.5px] font-black text-[#1499AD] lg:text-emerald-300 tracking-wider uppercase bg-sky-100 lg:bg-emerald-500/20 px-2 py-0.5 rounded-md border border-sky-200 lg:border-emerald-500/30">
                    {user?.role === 'doctor' ? 'Shifokor' : 'Admin'}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-600 lg:text-slate-300 hover:text-rose-500 hover:bg-rose-500/20 transition-all active:scale-95 cursor-pointer"
              title={t('common.logout')}
            >
              <LogOut className="w-4.5 h-4.5" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-[#1499AD] flex items-center justify-center text-white font-black text-xs shadow-md overflow-hidden shrink-0" title={user?.full_name || user?.name || 'Foydalanuvchi'}>
              {(user?.avatar_url || user?.photo || user?.avatar || user?.image) ? (
                <img src={user.avatar_url || user.photo || user.avatar || user.image} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                user?.name?.[0]?.toUpperCase() || 'U'
              )}
            </div>
            <button
              onClick={handleLogout}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-500/20 transition-all active:scale-95 cursor-pointer"
              title={t('common.logout')}
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        )}
        
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center py-2.5 mt-1.5 text-slate-600 lg:text-slate-300 hover:text-[#1499AD] lg:hover:text-white transition-colors active:scale-95 cursor-pointer"
        >
          {collapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <div className="flex items-center gap-2 opacity-80 hover:opacity-100 transition-opacity">
              <ChevronLeft className="w-4 h-4" />
              <span className="text-[11px] font-bold uppercase tracking-wider leading-none">{t('common.close')}</span>
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
