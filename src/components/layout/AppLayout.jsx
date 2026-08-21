import { useState, useCallback, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import NativeMobileLayout from './NativeMobileLayout';
import AdBanner from './AdBanner';
import SubscriptionBanner from './SubscriptionBanner';
import SubscriptionBlockedView from './SubscriptionBlockedView';
import ErrorBoundary from './ErrorBoundary';
import { base44 } from '@/api/base44Client';
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
