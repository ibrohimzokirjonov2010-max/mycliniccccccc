import { useState, useCallback, useEffect } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { isPageBlocked, firstAllowedPath } from '@/lib/pageAccess';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import NativeMobileLayout from './NativeMobileLayout';
import AdBanner from './AdBanner';
import SubscriptionBlockedView from './SubscriptionBlockedView';
import TariffReminder from './TariffReminder';
import ErrorBoundary from './ErrorBoundary';
import { clinicAccessClosed, invalidateClinicExpiry, loadClinicAccess } from '@/lib/clinicExpiry';
import { Suspense, memo } from 'react';
import { prefetchRouteChunk } from '@/utils/routeChunkPrefetch';

// Specialized skeleton loader for premium page-to-page transitions
const InlineLoader = memo(() => (
  <div className="space-y-6 animate-pulse w-full pt-4">
    {/* Page Header placeholder */}
    <div className="flex items-center justify-between pb-2">
      <div className="space-y-2">
        <div className="h-6 w-48 bg-slate-200 rounded-lg"></div>
        <div className="h-3 w-32 bg-slate-100 rounded-md"></div>
      </div>
      <div className="h-10 w-28 bg-slate-200 rounded-xl"></div>
    </div>

    {/* Metrics Cards Grid placeholder */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="p-5 bg-white border border-slate-100 rounded-2xl space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 bg-slate-100 rounded-xl"></div>
            <div className="w-12 h-5 bg-slate-100 rounded-full"></div>
          </div>
          <div className="space-y-2">
            <div className="h-3 w-20 bg-slate-100 rounded"></div>
            <div className="h-6 w-32 bg-slate-200 rounded-md"></div>
          </div>
        </div>
      ))}
    </div>

    {/* Large Table or Chart placeholder */}
    <div className="bg-white border border-slate-100 rounded-[2rem] p-6 space-y-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="h-5 w-40 bg-slate-200 rounded-md"></div>
        <div className="h-8 w-24 bg-slate-100 rounded-lg"></div>
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-slate-100 rounded-full"></div>
              <div className="space-y-1.5">
                <div className="h-3.5 w-36 bg-slate-200 rounded"></div>
                <div className="h-2.5 w-24 bg-slate-100 rounded"></div>
              </div>
            </div>
            <div className="space-y-2 text-right">
              <div className="h-3.5 w-24 bg-slate-200 rounded ml-auto"></div>
              <div className="h-2.5 w-16 bg-slate-100 rounded ml-auto"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
));

// Direct URL guard for pages the admin switched off for this user (Xodimlar → Kirish huquqlari)
function GuardedOutlet() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  if (user && isPageBlocked(user, pathname)) return <Navigate to={firstAllowedPath(user)} replace />;
  return <Outlet />;
}

/**
 * AppLayout Component
 * 
 * Premium application layout with seamless transitions and responsive navigation.
 */
export default function AppLayout() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1024);
  const [gate, setGate] = useState('loading');
  const [clinic, setClinic] = useState(null);
  const [seenPath, setSeenPath] = useState(location.pathname);
  const [hold, setHold] = useState(true);

  if (seenPath !== location.pathname) {
    setSeenPath(location.pathname);
    setHold(true);
  }

  // After the shell is up, quietly warm the heaviest lazy routes (Bemorlar first-click chunk crash).
  useEffect(() => {
    const warm = () => {
      ['/patients', '/appointments', '/payments'].forEach((path, i) => {
        setTimeout(() => { prefetchRouteChunk(path); }, i * 800);
      });
    };
    const idle = typeof window !== 'undefined' && window.requestIdleCallback;
    const handle = idle ? window.requestIdleCallback(warm, { timeout: 4000 }) : setTimeout(warm, 2500);
    return () => {
      if (idle && window.cancelIdleCallback) window.cancelIdleCallback(handle);
      else clearTimeout(handle);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const checkExpiry = async () => {
      const id = localStorage.getItem('current_clinic_id') || localStorage.getItem('clinic_id') || '';
      if (!id) {
        if (!cancelled) {
          setGate('ok');
          setHold(false);
        }
        return;
      }
      invalidateClinicExpiry(id);
      try {
        const { clinic: row, error } = await loadClinicAccess(id);
        if (cancelled) return;
        if (error) {
          setGate((current) => (current === 'loading' ? 'ok' : current));
          setHold(false);
          return;
        }
        if (row) setClinic(row);
        setGate(row && clinicAccessClosed(row) ? 'expired' : 'ok');
        setHold(false);
      } catch (err) {
        console.error('Failed to check expiry in AppLayout:', err);
        if (!cancelled) {
          setGate((current) => (current === 'loading' ? 'ok' : current));
          setHold(false);
        }
      }
    };
    checkExpiry();
    const onExpired = (event) => {
      if (event?.detail?.clinic) setClinic(event.detail.clinic);
      setGate('expired');
      setHold(false);
    };
    window.addEventListener('shifo:tariff-expired', onExpired);
    window.addEventListener('focus', checkExpiry);
    return () => {
      cancelled = true;
      window.removeEventListener('shifo:tariff-expired', onExpired);
      window.removeEventListener('focus', checkExpiry);
    };
  }, [location.pathname]);

  useEffect(() => {
    if (gate !== 'expired') return undefined;
    const id = localStorage.getItem('current_clinic_id') || localStorage.getItem('clinic_id') || '';
    const timer = window.setInterval(async () => {
      if (!id) return;
      invalidateClinicExpiry(id);
      const { clinic: row, error } = await loadClinicAccess(id);
      if (error || !row) return;
      setClinic(row);
      if (!clinicAccessClosed(row)) setGate('ok');
    }, 12000);
    return () => window.clearInterval(timer);
  }, [gate]);

  // Detect mobile screen with performance optimization
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile, { passive: true });
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleToggle = useCallback(() => {
    setCollapsed(prev => !prev);
  }, []);

  const handleMobileClose = useCallback(() => {
    setMobileOpen(false);
  }, []);

  const handleMobileOpen = useCallback(() => {
    setMobileOpen(true);
  }, []);

  if (gate === 'loading') {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#F8FAFC]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-800" />
      </div>
    );
  }

  if (gate === 'expired') {
    return <SubscriptionBlockedView clinic={clinic} />;
  }

  // Professional native mobile layout with motion
  if (isMobile) {
    return (
      <NativeMobileLayout>
        <TariffReminder clinic={clinic} />
        {hold ? null : <GuardedOutlet />}
      </NativeMobileLayout>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8FAFC]">
      {/* Sidebar Navigation */}
      <Sidebar
        collapsed={collapsed}
        onToggle={handleToggle}
        mobileOpen={mobileOpen}
        onMobileClose={handleMobileClose}
      />
      
      {/* Main Content Area */}
      <div className="flex flex-col flex-1 min-w-0 relative">
        {/* Top Navigation Bar */}
        <Topbar 
          onMenuClick={handleMobileOpen}
          sidebarCollapsed={collapsed}
        />
        
        {/* Page Content with Framer Motion Transitions */}
        <main className="flex-1 overflow-y-auto px-5 py-3 pb-6 relative no-scrollbar">
          <div className="max-w-[1600px] mx-auto w-full">
            <TariffReminder clinic={clinic} />
            <ErrorBoundary>
              <Suspense fallback={<InlineLoader />}>
                {hold ? null : <GuardedOutlet />}
              </Suspense>
            </ErrorBoundary>
          </div>
        </main>
        
        {/* Advertisement Banner */}
        <AdBanner />
      </div>
    </div>
  );
}
