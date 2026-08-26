import { useState, useCallback, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import NativeMobileLayout from './NativeMobileLayout';
import AdBanner from './AdBanner';
import SubscriptionBanner from './SubscriptionBanner';
import SubscriptionBlockedView from './SubscriptionBlockedView';
import ErrorBoundary from './ErrorBoundary';
import { base44 } from '@/api/base44Client';
import { Suspense, memo } from 'react';

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

/**
 * AppLayout Component
 * 
 * Premium application layout with seamless transitions and responsive navigation.
 */
export default function AppLayout() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isExpired, setIsExpired] = useState(false);

  // Check Subscription Expiry
  useEffect(() => {
    const checkExpiry = async () => {
      try {
        const clinics = await base44.clinic.getAll();
        const currentClinicId = (localStorage.getItem('current_clinic_id') || '').toLowerCase();
        const currentClinic = clinics.find(c => (c.id || '').toLowerCase() === currentClinicId);
        
        if (currentClinic) {
          // If deactivated by superadmin
          if (currentClinic.status === 'Inactive' || currentClinic.status === 'Blocked') {
            setIsExpired(true);
            return;
          }

          if (currentClinic.expires_at) {
            const expiryDate = new Date(currentClinic.expires_at);
            // End of the day expiry support (set to 23:59:59)
            expiryDate.setHours(23, 59, 59, 999);
            
            if (new Date() > expiryDate) {
              setIsExpired(true);
            }
          }
        }
      } catch (err) {
        console.error('Failed to check expiry in AppLayout:', err);
      }
    };
    checkExpiry();
  }, []);

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

  // Professional native mobile layout with motion
  if (isMobile) {
    return (
      <NativeMobileLayout>
        <Outlet />
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
            <SubscriptionBanner />
            <ErrorBoundary>
              <Suspense fallback={<InlineLoader />}>
                {isExpired ? <SubscriptionBlockedView /> : <Outlet />}
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
