import { useState, useEffect, lazy, Suspense, memo } from 'react';
import { Toaster } from 'sonner';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { LanguageProvider } from '@/i18n/LanguageContext';
import { ClinicProvider } from '@/lib/ClinicContext';
import { motion } from 'framer-motion';

// ─── Static imports (always needed) ────────────────────────────────────────
import AppLayout from './components/layout/AppLayout';
import Login     from './pages/Login';
// NOTE: Dashboard, Patients, Appointments, Leads ham lazy qilindi — tezroq yuklash uchun
import GlobalAlerter from './components/notifications/GlobalAlerter';
import RecallAlerter from './components/notifications/RecallAlerter';
import ImplantAlerter from './components/notifications/ImplantAlerter';
import NativePushManager from './components/notifications/NativePushManager';
import TelegramReminderWorker from './components/notifications/TelegramReminderWorker';
import Paywall   from './components/layout/Paywall';
import PageNotFound from './lib/PageNotFound';
import { useFeature } from './hooks/useFeature';
import { useIsMobile } from './hooks/useIsMobile';
import { ShifoCrmLogoEmblem } from './components/ui/ShifoCrmLogo';

// ─── Lazy page imports (loaded only when user navigates there) ──────────────
// Core pages (lazy for faster initial load)
const Dashboard           = lazy(() => import('./pages/Dashboard'));
const Patients            = lazy(() => import('./pages/Patients'));
const Appointments        = lazy(() => import('./pages/Appointments'));
const Leads               = lazy(() => import('./pages/Leads'));

// Admin pages
const MobileDashboardV2   = lazy(() => import('./pages/MobileDashboardV2'));
const Expenses            = lazy(() => import('./pages/Expenses'));
const MobileExpenses      = lazy(() => import('./pages/MobileExpenses'));
const Payroll             = lazy(() => import('./pages/Payroll'));
const MobilePayroll       = lazy(() => import('./pages/MobilePayroll'));
const MobileStaff         = lazy(() => import('./pages/MobileStaff'));
const Reports             = lazy(() => import('./pages/Reports'));
const MobileReports       = lazy(() => import('./pages/MobileReports'));
const SuperAdmin          = lazy(() => import('./pages/SuperAdmin'));
const Register            = lazy(() => import('./pages/Register'));

// Clinical pages
const MobilePatientsV2    = lazy(() => import('./pages/MobilePatientsV2'));
const PatientProfile      = lazy(() => import('./pages/PatientProfile'));
const MobileAppointmentsV2 = lazy(() => import('./pages/MobileAppointmentsV2'));
const MobileLeadsV6       = lazy(() => import('./pages/MobileLeadsV6'));
const Payments            = lazy(() => import('./pages/Payments'));
const MobilePaymentsV2    = lazy(() => import('./pages/MobilePaymentsV2'));
const Services            = lazy(() => import('./pages/Services'));
const MobileServicesV2    = lazy(() => import('./pages/MobileServicesV2'));
const Inventory           = lazy(() => import('./pages/Inventory'));
const MobileInventoryV2   = lazy(() => import('./pages/MobileInventoryV2'));
const TreatmentPlans      = lazy(() => import('./pages/TreatmentPlans'));
const MobileTreatmentPlansV2 = lazy(() => import('./pages/MobileTreatmentPlansV2'));
const RecallSystem        = lazy(() => import('./pages/RecallSystem'));
const MobileRecall        = lazy(() => import('./pages/MobileRecall'));
const NoShow              = lazy(() => import('./pages/NoShow'));
const TreatmentTracking   = lazy(() => import('./pages/TreatmentTracking'));
const Debts               = lazy(() => import('./pages/Debts'));
const MobileDebts         = lazy(() => import('./pages/MobileDebts'));
const Settings            = lazy(() => import('./pages/Settings'));
const MobileSettings      = lazy(() => import('./pages/MobileSettings'));
const Marketing           = lazy(() => import('./pages/Marketing'));
const MobileMarketing      = lazy(() => import('./pages/MobileMarketing'));
const Implants            = lazy(() => import('./pages/Implants'));
const MobileImplants      = lazy(() => import('./pages/MobileImplants'));
const ImplantDetail       = lazy(() => import('./pages/ImplantDetail'));
const Technicians         = lazy(() => import('./pages/Technicians'));
const Staff               = lazy(() => import('./pages/Staff'));
const MobilePublicPage    = lazy(() => import('./pages/MobilePublicPage'));
const PublicClinicPage    = lazy(() => import('./pages/PublicClinicPage'));

// Yeni Cases Sahifalari
const Cases               = lazy(() => import('./pages/Cases'));
const MobileCases         = lazy(() => import('./pages/MobileCases'));

// SMS + Xabarlar sahifalari
const MobileSmsSettings   = lazy(() => import('./pages/MobileSmsSettings'));
const MobileSentMessages  = lazy(() => import('./pages/MobileSentMessages'));

// ─── Page loader (shown while lazy chunk loads) ──────────────────────────────
const PageLoader = memo(() => {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white/60 backdrop-blur-md z-[100]">
      <motion.div 
        initial={{ width: 0, opacity: 0 }}
        animate={{ width: "100%", opacity: 1 }}
        className="fixed top-0 left-0 h-1 bg-gradient-to-r from-emerald-400 via-[#1499AD] to-blue-500 z-[101]" 
      />
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 border-4 border-slate-100 rounded-full" />
          <div className="absolute inset-0 border-4 border-transparent border-t-[#1499AD] rounded-full animate-spin" />
        </div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] font-inter">Tizim yuklanmoqda...</p>
      </div>
    </div>
  );
});

// ─── Route guards ─────────────────────────────────────────────────────────────
const DashboardSwitcher = memo(() => {
  const { user, isAdmin, isDoctor } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (isAdmin)  return <Navigate to="/admin/dashboard" replace />;
  if (isDoctor) return <Navigate to="/doctor/dashboard" replace />;
  return <Navigate to="/login" replace />;
});

const AdminRoute = memo(({ children }) => {
  const { user, isAdmin, isLoadingAuth } = useAuth();
  if (isLoadingAuth) return null;
  if (!user || !isAdmin) return <Navigate to="/login" replace />;
  return children;
});

const DoctorRoute = memo(({ children }) => {
  const { user, isDoctor, isLoadingAuth } = useAuth();
  if (isLoadingAuth) return null;
  if (!user || !isDoctor) return <Navigate to="/login" replace />;
  return children;
});

const PlanRoute = memo(({ feature, children }) => {
  const hasAccess = useFeature(feature);
  if (!hasAccess) return <Paywall featureName={feature} />;
  return children;
});

// ─── Auth loading screen ──────────────────────────────────────────────────────
const AuthLoadingScreen = memo(() => (
  <div className="fixed inset-0 flex items-center justify-center bg-slate-950/95 backdrop-blur-md z-[99999]">
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <ShifoCrmLogoEmblem className="w-16 h-16 animate-pulse" size={64} hasGlow={true} />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-white font-[950] text-sm tracking-widest uppercase">SHIFO</span>
        <span className="text-[#00D084] font-[950] text-sm tracking-widest uppercase">CRM</span>
      </div>
    </div>
  </div>
));

// ─── Main authenticated app ───────────────────────────────────────────────────
const AuthenticatedApp = memo(() => {
  // 1024px — barcha qurilmalar uchun yagona breakpoint
  // Kichik monitor, planshet, telefon — hammasi mobile versiyani ko'radi
  const isMobile = useIsMobile(1024);
  const { isAuthenticated, isLoadingAuth } = useAuth();

  if (isLoadingAuth) return <AuthLoadingScreen />;

  const M = (desktop, mobile) => isMobile ? mobile : desktop;

  return (
    <>
      <GlobalAlerter />
      <RecallAlerter />
      <ImplantAlerter />
      <NativePushManager />
      {/* 🤖 Telegram Reminder Worker — 2 soat oldin va 07:00 da eslatmalar yuboradi */}
      <TelegramReminderWorker />
      {/* Suspense boundary — all lazy routes fall back to PageLoader */}
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login"   element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/p/:slug"  element={<PublicClinicPage />} />
          <Route path="/super-admin"        element={<SuperAdmin />} />
          <Route path="/super-admin-portal" element={<SuperAdmin />} />

          {isAuthenticated ? (
            <Route element={<AppLayout />}>
              <Route path="/" element={<DashboardSwitcher />} />

              {/* ── Admin ── */}
              <Route path="/admin/dashboard"
                element={<AdminRoute>{M(<Dashboard />, <MobileDashboardV2 />)}</AdminRoute>} />
              <Route path="/expenses"
                element={<AdminRoute>{M(<Expenses />, <MobileExpenses />)}</AdminRoute>} />
              <Route path="/payroll"
                element={<PlanRoute feature="staff"><AdminRoute>{M(<Payroll />, <MobilePayroll />)}</AdminRoute></PlanRoute>} />
              <Route path="/reports"
                element={<AdminRoute>{M(<Reports />, <MobileReports />)}</AdminRoute>} />
              <Route path="/staff"
                element={<AdminRoute>{M(<Staff />, <MobileStaff />)}</AdminRoute>} />

              {/* ── Doctor ── */}
              <Route path="/doctor/dashboard"
                element={<DoctorRoute>{M(<Dashboard />, <MobileDashboardV2 />)}</DoctorRoute>} />

              {/* ── Shared clinical ── */}
              <Route path="/technicians"
                element={<PlanRoute feature="technicians"><Technicians /></PlanRoute>} />
              <Route path="/patients"          element={M(<Patients />, <MobilePatientsV2 />)} />
              <Route path="/patients/:id"      element={<PatientProfile />} />
              <Route path="/appointments"      element={M(<Appointments />, <MobileAppointmentsV2 />)} />
              <Route path="/leads"             element={M(<Leads />, <MobileLeadsV6 />)} />
              <Route path="/payments"          element={M(<Payments />, <MobilePaymentsV2 />)} />
              <Route path="/services"          element={M(<Services />, <MobileServicesV2 />)} />
              <Route path="/inventory"         element={M(<Inventory />, <MobileInventoryV2 />)} />
              <Route path="/treatment-plans"   element={M(<TreatmentPlans />, <MobileTreatmentPlansV2 />)} />
              <Route path="/recall"            element={M(<RecallSystem />, <MobileRecall />)} />
              <Route path="/recalls"           element={M(<RecallSystem />, <MobileRecall />)} />
              <Route path="/no-show"           element={<NoShow />} />
              <Route path="/treatment-tracking" element={<TreatmentTracking />} />
              <Route path="/debts"             element={M(<Debts />, <MobileDebts />)} />
              <Route path="/implants"
                element={<PlanRoute feature="implants">{M(<Implants />, <MobileImplants />)}</PlanRoute>} />
              <Route path="/implants/:id"
                element={<PlanRoute feature="implants"><ImplantDetail /></PlanRoute>} />
              <Route path="/marketing"         element={M(<Marketing />, <MobileMarketing />)} />
              <Route path="/settings"          element={M(<Settings />, <MobileSettings />)} />
              <Route path="/public-page"       element={<MobilePublicPage />} />
              
              {/* YANGI QO'SHILDI: Klinik Keyslar (Portfolio) */}
              <Route path="/cases"             element={M(<Cases />, <MobileCases />)} />

              {/* SMS va Xabarlar */}
              <Route path="/sms-settings"      element={<MobileSmsSettings />} />
              <Route path="/sent-messages"     element={<MobileSentMessages />} />

              <Route path="*" element={<PageNotFound />} />
            </Route>
          ) : (
            <Route path="*" element={<Login />} />
          )}
        </Routes>
      </Suspense>
    </>
  );
});

// ─── Root App ─────────────────────────────────────────────────────────────────
function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <ClinicProvider>
          <QueryClientProvider client={queryClientInstance}>
            <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <AuthenticatedApp />
            </Router>
            <Toaster richColors closeButton position="top-right" duration={3000} expand={false} />
          </QueryClientProvider>
        </ClinicProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
