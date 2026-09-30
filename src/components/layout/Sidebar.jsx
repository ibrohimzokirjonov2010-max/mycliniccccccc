import { useState, useEffect, useMemo, useRef, memo } from 'react';
import { motion } from 'framer-motion';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, CalendarDays, CalendarClock, UserPlus, CreditCard,
  Stethoscope, Package, BarChart3, ClipboardList, Bell, AlertTriangle,
  Activity, Wallet, Settings, ChevronLeft, ChevronRight, Zap, TrendingDown,
  LogOut, Heart, Target, Camera, Lock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { base44 } from '@/api/base44Client';
import { useTranslation } from '@/i18n/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import { useClinicPlan } from '@/hooks/useFeature';
import { isPathLocked } from '@/lib/clinicPlan';
import { prefetchModuleData } from '@/utils/prefetcher';
import { ImplantIcon } from '@/components/ui/Icons';
import ShifoCrmLogo from '@/components/ui/ShifoCrmLogo';

/**
 * Navigation menu items configuration
 * Each item defines a route with its label and icon
 */
const getMenuItems = (t) => [
  // 1–6 Clinical primary (stomatologist-first)
  { path: '/chairside', label: t('navigation.chairsideToday') || "Bugungi navbat", icon: CalendarClock, section: 'clinical' },
  { path: '/patients', label: t('navigation.patients'), icon: Users, section: 'clinical' },
  { path: '/appointments', label: t('navigation.appointments'), icon: CalendarDays, section: 'clinical' },
  { path: '/treatment-plans', label: t('navigation.treatmentPlans'), icon: ClipboardList, section: 'clinical' },
  { path: '/implants', label: t('navigation.implants'), icon: ImplantIcon, section: 'clinical' },
  { path: '/payments', label: t('navigation.payments') || "To'lovlar", icon: CreditCard, section: 'clinical' },
  { path: '/debts', label: t('navigation.debts') || "Qarzlar", icon: Wallet, section: 'clinical' },
  // Admin / secondary (below divider)
  { path: '/', label: t('navigation.dashboard'), icon: LayoutDashboard, section: 'admin' },
  { path: '/leads', label: t('navigation.leads'), icon: UserPlus, section: 'admin' },
  { path: '/staff', label: t('navigation.staff') || 'Xodimlar', icon: Users, section: 'admin' },
  { path: '/expenses', label: t('navigation.expenses'), icon: TrendingDown, section: 'admin' },
  { path: '/payroll', label: t('navigation.payroll'), icon: Wallet, section: 'admin' },
  { path: '/services', label: t('navigation.services'), icon: Stethoscope, section: 'admin' },
  { path: '/inventory', label: t('navigation.inventory'), icon: Package, section: 'admin' },
  { path: '/reports', label: t('navigation.reports'), icon: BarChart3, section: 'admin' },
  { path: '/recall', label: t('navigation.recalls'), icon: Bell, section: 'admin' },
  { path: '/no-show', label: t('navigation.noShow'), icon: AlertTriangle, section: 'admin' },
  { path: '/treatment-tracking', label: t('navigation.treatmentTracking'), icon: Activity, section: 'admin' },
  { path: '/marketing', label: t('navigation.marketing'), icon: Target, section: 'admin' },
  { path: '/cases', label: t('navigation.cases') || 'Mening Keyslarim', icon: Camera, section: 'admin' },
  { path: '/settings', label: t('navigation.settings'), icon: Settings, section: 'admin' },
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
  const navRef = useRef(null);
  const [navCanScroll, setNavCanScroll] = useState(false);
  const updateNavScroll = () => {
    const el = navRef.current;
    if (!el) return;
    setNavCanScroll(el.scrollHeight - el.scrollTop - el.clientHeight > 12);
  };
  const plan = useClinicPlan();

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
      return items.filter(item => ['/chairside', '/', '/patients', '/appointments'].includes(item.path));
    }

    if (isDoctor) {
      const doctorAllowedPaths = [
        '/chairside',
        '/patients',
        '/appointments',
        '/treatment-plans',
        '/implants',
        '/payments',
        '/debts',
        '/',
        '/leads',
        '/recall',
        '/no-show',
        '/treatment-tracking',
        '/cases',
        '/settings',
      ];
      items = items.filter(item => doctorAllowedPaths.includes(item.path));
    }

    return items.map((item) => ({ ...item, locked: isPathLocked(plan, item.path) }));
  }, [t, isDoctor, user, plan]);

  useEffect(() => {
    updateNavScroll();
    const el = navRef.current;
    if (!el) return undefined;
    const observer = new ResizeObserver(updateNavScroll);
    observer.observe(el);
    return () => observer.disconnect();
  }, [collapsed, filteredMenuItems.length]);

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
      <nav ref={navRef} onScroll={updateNavScroll} className="flex-1 overflow-y-auto px-2.5 py-2">
        {!collapsed ? (
          <div className="border border-slate-200 lg:border-slate-700/80 rounded-xl overflow-hidden bg-slate-50 lg:bg-[#091122]/90 shadow-sm divide-y divide-slate-200 lg:divide-slate-700/70">
            {filteredMenuItems.map((item, index) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              const prev = filteredMenuItems[index - 1];
              const showAdminDivider =
                item.section === 'admin' && (!prev || prev.section !== 'admin');

              return (
                <div key={item.path}>
                  {showAdminDivider && (
                    <div className="px-3.5 py-2 bg-slate-100/80 lg:bg-slate-900/60">
                      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400 lg:text-slate-500">
                        Boshqaruv / Admin
                      </p>
                    </div>
                  )}
                  <Link
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

                    {item.locked ? (
                      <Lock className={cn('w-3.5 h-3.5 shrink-0', active ? 'text-white' : 'text-slate-400')} aria-label="Yopiq" />
                    ) : active ? (
                      <div className="w-2 h-2 rounded-full bg-white shrink-0 shadow-xs ml-1 ring-2 ring-cyan-200" />
                    ) : null}
                  </Link>
                </div>
              );
            })}
          </div>
        ) : (
          /* Collapsed Mode - Grid Cells */
          <div className="space-y-1.5">
            {filteredMenuItems.map((item, index) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              const prev = filteredMenuItems[index - 1];
              const showAdminDivider =
                item.section === 'admin' && (!prev || prev.section !== 'admin');

              return (
                <div key={item.path} className="space-y-1.5">
                  {showAdminDivider && (
                    <div className="mx-auto my-1 h-px w-6 bg-slate-300 lg:bg-slate-600" aria-hidden />
                  )}
                  <Link
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
                    {item.locked ? <Lock className="absolute right-1 top-1 w-2.5 h-2.5 text-slate-400" aria-label="Yopiq" /> : null}
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </nav>
      {navCanScroll && !collapsed && (
        <div className="pointer-events-none absolute bottom-16 left-0 right-0 h-10 bg-gradient-to-t from-white lg:from-[#0C1222] to-transparent flex items-end justify-center pb-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Pastga</span>
        </div>
      )}

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
