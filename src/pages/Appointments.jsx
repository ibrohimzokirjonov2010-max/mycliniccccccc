import { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, CalendarDays, Search, ChevronLeft } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/api/supabaseClient';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import StatusBadge from '@/components/ui/StatusBadge';
import AppointmentModal from '@/components/appointments/AppointmentModal';
import CalendarView from '@/components/appointments/CalendarView';
import DoctorDayGrid from '@/components/appointments/DoctorDayGrid';
import AppointmentConfirmationBadge from '@/components/appointments/AppointmentConfirmationBadge';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from '@/i18n/LanguageContext';
import { cn } from '@/lib/utils';
import { QUERY_KEYS } from '@/lib/queryKeys';

// ── Appointment date/time normalizer (shared helper) ─────────────────────────
const normalizeAppt = (a) => {
  let tStr = a.time || '08:00';
  const parts = tStr.split(':');
  if (parts.length >= 2) tStr = `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
  let dStr = a.date || '';
  if (dStr) {
    const clean = String(dStr).split('T')[0].split(' ')[0];
    if (clean.includes('.')) {
      const dp = clean.split('.');
      dStr = dp[0].length === 4 ? `${dp[0]}-${dp[1]}-${dp[2]}` : `${dp[2]}-${dp[1]}-${dp[0]}`;
    } else { dStr = clean; }
  }
  return { ...a, time: tStr, date: dStr };
};

export default function Appointments() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ── UI state ────────────────────────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false);
  const [editAppt, setEditAppt] = useState(null);
  const [prefillDate, setPrefillDate] = useState('');
  const [prefillTime, setPrefillTime] = useState('');
  const [prefillDoctorId, setPrefillDoctorId] = useState(null);
  const [selectedDoctorId, setSelectedDoctorId] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [viewDate, setViewDate] = useState(new Date().toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = useState('grid');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Responsive check
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // ── React Query: Data fetching ──────────────────────────────────────────────
  // 🗄️ appointments — 2 daqiqa kesh. Sahifalar orasida o'tganda qayta yuklanmaydi.
  const { data: rawAppointments = [], isFetching: apptFetching } = useQuery({
    queryKey: QUERY_KEYS.appointments,
    queryFn: () => base44.entities.Appointment.list('-date', 500),
    staleTime: 2 * 60 * 1000,
    select: (appts) => appts.map(normalizeAppt),
  });

  // 🗄️ patients — 5 daqiqa kesh
  const { data: patients = [] } = useQuery({
    queryKey: QUERY_KEYS.patients,
    queryFn: () => base44.entities.Patient.list('full_name', 300),
    staleTime: 5 * 60 * 1000,
  });

  // 🗄️ services — 10 daqiqa kesh (deyarli o'zgarmaydi)
  const { data: rawServices = [] } = useQuery({
    queryKey: QUERY_KEYS.services,
    queryFn: () => base44.entities.Service.filter({ is_active: true }, 'name', 100),
    staleTime: 10 * 60 * 1000,
  });

  // 🗄️ doctors (users) — 10 daqiqa kesh
  const { data: rawUsers = [] } = useQuery({
    queryKey: QUERY_KEYS.doctors,
    queryFn: () => base44.entities.User.list('name', 50),
    staleTime: 10 * 60 * 1000,
  });

  const loading = apptFetching && rawAppointments.length === 0;

  // ── Derived data (same logic as before, now from query cache) ───────────────
  const appointments = rawAppointments;

  // Services with localStorage sort order
  const services = useMemo(() => {
    try {
      const savedOrder = localStorage.getItem('service_item_order');
      if (savedOrder) {
        const allOrderedIds = Object.values(JSON.parse(savedOrder)).flat();
        if (allOrderedIds.length > 0) {
          return [...rawServices].sort((a, b) => {
            const ai = allOrderedIds.indexOf(a.id);
            const bi = allOrderedIds.indexOf(b.id);
            if (ai === -1 && bi === -1) return 0;
            return ai === -1 ? 1 : bi === -1 ? -1 : ai - bi;
          });
        }
      }
    } catch {}
    return rawServices;
  }, [rawServices]);

  // Doctors derived from users
  const doctors = useMemo(() => {
    return (rawUsers || []).filter(u => {
      if (u.role !== 'doctor' && u.role !== 'admin') return false;
      if (!u.name) return false;
      const hasAppointments = appointments.some(a => String(a.doctor_id) === String(u.id));
      if (hasAppointments) return true;
      const lowerName = u.name.toLowerCase();
      return lowerName !== 'shifokor' && lowerName !== 'admin';
    });
  }, [rawUsers, appointments]);

  // ── Real-time: Supabase → invalidate React Query cache ─────────────────────

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel('appointments-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        () => {
          // Debounce 800ms — so'ng React Query keshni yangilaydi
          clearTimeout(window.__apptReloadTimer);
          window.__apptReloadTimer = setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.appointments });
          }, 800);
        }
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [queryClient]);

  const openNewAppt = (date, time, doctorId) => {
    setEditAppt(null);
    setPrefillDate(date || '');
    setPrefillTime(time || '');
    setPrefillDoctorId(doctorId || null);
    setModalOpen(true);
  };

  const openEditAppt = (appointment) => {
    setEditAppt(appointment);
    setPrefillDoctorId(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditAppt(null);
    setPrefillDate('');
    setPrefillTime('');
    setPrefillDoctorId(null);
  };

  // onSaved: modal saqlangandan keyin keshni yangilash
  const handleSaved = () => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.appointments });
    closeModal();
  };

  // Robust date normalization to YYYY-MM-DD
  const normalizeDateStr = (d) => {
    if (!d) return '';
    const clean = String(d).split('T')[0].split(' ')[0];
    if (clean.includes('.')) {
      const parts = clean.split('.');
      if (parts[0].length === 4) return `${parts[0]}-${parts[1]}-${parts[2]}`;
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return clean;
  };

  const filteredAppointments = useMemo(() => {
    let result = appointments;
    
    // In grid view, we show all doctors in columns, so we shouldn't filter the data 
    // by a single doctor unless we're in list or calendar view where only one doctor's data is shown.
    if (activeTab !== 'grid' && selectedDoctorId !== null) {
      const selectedDoc = doctors.find(d => String(d.id) === String(selectedDoctorId));
      result = result.filter(a => {
        const matchId = String(a.doctor_id) === String(selectedDoctorId);
        const matchName = selectedDoc && (
          a.notes?.includes(selectedDoc.name) ||
          (a.doctor_name || '').toLowerCase().includes((selectedDoc.name || '').toLowerCase())
        );
        return matchId || matchName;
      });
    }

    if (debouncedSearch.trim()) {
      const q = debouncedSearch.trim().toLowerCase();
      result = result.filter(a => {
        const patient_id = a.patient_id;
        const patient = patients.find(p => String(p.id) === String(patient_id));
        const patientName = (a.patient_name || patient?.full_name || '').toLowerCase();
        const phone = (a.patient_phone || patient?.phone || '').toLowerCase();
        const service = (a.service_name || '').toLowerCase();
        const doctorName = (a.doctor_name || '').toLowerCase();
        return patientName.includes(q) || phone.includes(q) || service.includes(q) || doctorName.includes(q);
      });
    }

    return result;
  }, [appointments, selectedDoctorId, doctors, debouncedSearch, patients, activeTab]);

  const otherDayMatchesCount = useMemo(() => {
    if (!debouncedSearch.trim()) return 0;
    return filteredAppointments.filter(a => {
        const d = String(a.date || '').split('T')[0];
        return d !== viewDate;
    }).length;
  }, [filteredAppointments, viewDate, debouncedSearch]);

  return (
    <div className="space-y-3 pb-3">
      <div className="flex items-center justify-between px-1">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3"
        >
          <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-100 text-[#1499AD]">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none uppercase">
                {t('appointments.title')}
            </h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                {t('appointments.queueCount', { count: filteredAppointments.length }) || `${filteredAppointments.length} ta navbat mavjud`}
            </p>
          </div>
        </motion.div>
        
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => openNewAppt('', '', null)}
          className="flex items-center gap-2 px-6 py-2.5 bg-[#1499AD] text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-[#1499AD]/20 transition-all border-none"
        >
          <Plus className="w-4 h-4" />
          {t('appointments.addNew')}
        </motion.button>
      </div>

      {/* View Switcher & Date Navigation Unified Header */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden mb-4">
        <div className="flex flex-col lg:flex-row items-center justify-between p-4 gap-4">
          {/* Left: Date Type Navigation */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-2xl border border-slate-100">
               <button 
                onClick={() => { const d = new Date(viewDate); d.setDate(d.getDate()-1); setViewDate(d.toISOString().split('T')[0]); }}
                className="p-2 hover:bg-white hover:shadow-sm rounded-xl text-slate-400 transition-all active:scale-90"
               >
                 <ChevronLeft className="w-4 h-4" />
               </button>
               
               <div className="flex items-center gap-1">
                 <button 
                  onClick={() => setViewDate(new Date(new Date().setDate(new Date().getDate() - 1)).toISOString().split('T')[0])}
                  className={cn("px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tight transition-all", viewDate === new Date(new Date().setDate(new Date().getDate() - 1)).toISOString().split('T')[0] ? "bg-white shadow-sm text-[#1499AD]" : "text-slate-400")}
                 >
                   {t('appointments.yesterday') || 'Kecha'}
                 </button>
                 <button 
                  onClick={() => setViewDate(new Date().toISOString().split('T')[0])}
                  className={cn("px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tight transition-all", viewDate === new Date().toISOString().split('T')[0] ? "bg-white shadow-sm text-[#1499AD]" : "text-slate-400")}
                 >
                   {t('appointments.today') || 'Bugun'}
                 </button>
                 <button 
                  onClick={() => setViewDate(new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0])}
                  className={cn("px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tight transition-all", viewDate === new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0] ? "bg-white shadow-sm text-[#1499AD]" : "text-slate-400")}
                 >
                   {t('appointments.tomorrow') || 'Ertaga'}
                 </button>
               </div>

               <button 
                onClick={() => { const d = new Date(viewDate); d.setDate(d.getDate()+1); setViewDate(d.toISOString().split('T')[0]); }}
                className="p-2 hover:bg-white hover:shadow-sm rounded-xl text-slate-400 transition-all active:scale-90"
               >
                 <ChevronLeft className="w-4 h-4 rotate-180" />
               </button>
            </div>
            
            <div className="relative">
              <input 
                type="date" 
                value={viewDate} 
                onChange={e => setViewDate(e.target.value)} 
                className="h-10 px-4 rounded-2xl border border-slate-100 text-[11px] font-black text-slate-600 outline-none focus:border-[#1499AD] bg-white shadow-sm"
              />
            </div>
          </div>

          {/* Center: Search (Visible on all views) */}
          <div className={cn(
            "h-11 bg-slate-50 border border-slate-100 rounded-[1.25rem] px-5 flex items-center gap-3 transition-all flex-1 max-w-md",
            searchQuery ? "ring-2 ring-[#1499AD]/10 border-[#1499AD]/30" : ""
          )}>
            <Search className="w-4 h-4 text-slate-300" />
            <input 
              placeholder={t('appointments.searchPlaceholder') || "Bemor, xizmat yoki shifokor..."} 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-transparent border-none text-xs font-bold outline-none w-full placeholder:text-slate-300"
            />
          </div>

          {/* Right: View Switcher Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
            <TabsList className="bg-slate-50 p-1 rounded-2xl h-11 border border-slate-100 gap-1">
              <TabsTrigger value="grid" className="rounded-xl h-9 px-6 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-[#1499AD] data-[state=active]:shadow-sm">
                {t('appointments.viewGrid') || 'Setka'}
              </TabsTrigger>
              <TabsTrigger value="calendar" className="rounded-xl h-9 px-6 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-[#1499AD] data-[state=active]:shadow-sm">
                {t('appointments.viewWeekly') || 'Haftalik'}
              </TabsTrigger>
              <TabsTrigger value="list" className="rounded-xl h-9 px-6 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-[#1499AD] data-[state=active]:shadow-sm">
                {t('appointments.viewList') || 'Ro\'yxat'}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Doctor Filter Bar - Hidden in Grid view as requested */}
      <AnimatePresence>
        {activeTab !== 'grid' && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-4 px-1"
          >
            <div className="flex items-center gap-2 flex-nowrap">
              <button
                onClick={() => setSelectedDoctorId(null)}
                className={cn(
                  "px-5 h-10 rounded-2xl border transition-all text-[10px] font-black uppercase tracking-widest whitespace-nowrap",
                  selectedDoctorId === null
                    ? "bg-slate-900 border-slate-900 text-white shadow-lg shadow-slate-900/20"
                    : "bg-white border-slate-200 text-slate-500 hover:border-slate-300 shadow-sm"
                )}
              >
                {t('appointments.allDoctors') || 'Barchasi'}
              </button>

              {doctors.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => setSelectedDoctorId(doc.id)}
                  className={cn(
                    "px-5 h-10 rounded-2xl border transition-all text-[10px] font-black uppercase tracking-widest whitespace-nowrap shrink-0",
                    String(selectedDoctorId) === String(doc.id)
                      ? "bg-[#1499AD] border-[#1499AD] text-white shadow-lg shadow-[#1499AD]/20"
                      : "bg-white border-slate-200 text-slate-500 hover:border-slate-300 shadow-sm"
                  )}
                >
                  {doc.name}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Interior page headers are now handled by the unified dashboard header */}

          <AnimatePresence mode="wait">
            <TabsContent value="grid" key="grid" className="mt-0 outline-none focus-visible:ring-0">
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {debouncedSearch.trim() && otherDayMatchesCount > 0 && (
                  <div className="bg-[#1499AD]/10 px-6 py-2.5 border-b border-[#1499AD]/20 flex items-center justify-between animate-in slide-in-from-top duration-300">
                    <p className="text-[10px] font-black text-[#1499AD] uppercase tracking-widest">
                      Boshqa kunlarda ham {otherDayMatchesCount} ta natija topildi
                    </p>
                    <button 
                      onClick={() => setActiveTab('list')}
                      className="px-4 py-1.5 bg-white rounded-lg text-[9px] font-black text-[#1499AD] uppercase tracking-widest shadow-sm hover:shadow-md transition-all active:scale-95"
                    >
                      Ro'yxatda ko'rish
                    </button>
                  </div>
                )}
                {loading ? <div className="h-[600px] bg-slate-50 animate-pulse" /> : (
                  <DoctorDayGrid 
                    viewDate={viewDate}
                    onViewDateChange={setViewDate}
                    appointments={filteredAppointments.map(a => ({
                      ...a,
                      patient_name: a.patient_name || patients.find(p => String(p.id) === String(a.patient_id))?.full_name || 'Noma\'lum'
                    }))}
                    doctors={doctors}
                    onSlotClick={openNewAppt}
                    onEditClick={openEditAppt}
                    searchQuery={debouncedSearch}
                  />
                )}
              </motion.div>
            </TabsContent>

            <TabsContent value="calendar" key="calendar" className="mt-0 outline-none focus-visible:ring-0">
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {loading ? <div className="h-[600px] bg-slate-50 animate-pulse" /> : (
                  <CalendarView 
                    currentDate={new Date(viewDate)}
                    onDateChange={(d) => setViewDate(d.toISOString().split('T')[0])}
                    appointments={filteredAppointments.map(a => ({
                      ...a,
                      patient_name: a.patient_name || patients.find(p => String(p.id) === String(a.patient_id))?.full_name || 'Noma\'lum'
                    }))} 
                    onSlotClick={openNewAppt} 
                    onEditClick={openEditAppt} 
                  />
                )}
              </motion.div>
            </TabsContent>

            <TabsContent value="list" key="list" className="mt-0 outline-none focus-visible:ring-0">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {(() => {
                  const todayStr = new Date().toISOString().split('T')[0];
                  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
                  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
                  const isToday = viewDate === todayStr;

                  const dayAppts = filteredAppointments.filter(a => {
                    if (debouncedSearch.trim()) return true; // Show all dates when searching
                    const d = String(a.date || '').split('T')[0];
                    return d === viewDate;
                  }).sort((a, b) => {
                    // Sorting: first by date if searching, then by time
                    const dCompare = String(a.date || '').localeCompare(String(b.date || ''));
                    if (dCompare !== 0 && debouncedSearch.trim()) return dCompare;
                    return (a.time || '').localeCompare(b.time || '');
                  });

                  return (
                    <div className="flex flex-col min-h-[600px]">
                      {/* Unified header now handles date switching */}

                      <div className="p-6">
                        {dayAppts.length === 0 ? (
                          <div className="py-20 text-center">
                            <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-slate-100 text-slate-200"><CalendarDays className="w-8 h-8" /></div>
                            <p className="text-slate-400 font-bold text-sm tracking-tight">{isToday ? 'Bugun navbat yo\'q' : 'Ushbu kunda navbat yo\'q'}</p>
                            <Button onClick={() => openNewAppt(viewDate, '', null)} className="mt-4 bg-[#1499AD] text-white rounded-xl uppercase text-[10px] font-black tracking-widest px-8 shadow-lg shadow-[#1499AD]/20">+ Yangi Navbat</Button>
                          </div>
                        ) : (
                          <div className="grid gap-3">
                            {dayAppts.map(a => (
                              <div 
                                key={a.id} 
                                onClick={() => {
                                  if (debouncedSearch.trim()) {
                                    // Navigate to date if searching - Ensure YYYY-MM-DD format
                                    const dStr = normalizeDateStr(a.date);
                                    if (dStr) {
                                      setViewDate(dStr);
                                      setSearchQuery('');
                                      setActiveTab('grid');
                                    }
                                  } else {
                                    openEditAppt(a);
                                  }
                                }} 
                                className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-slate-100 hover:border-[#1499AD]/30 hover:shadow-lg hover:shadow-slate-200/50 transition-all cursor-pointer group"
                              >
                                <div className="w-14 text-center">
                                  <span className="text-sm font-black text-slate-900 block leading-tight">{a.time}</span>
                                  <span className="text-[9px] font-bold text-slate-400 uppercase">{a.duration || 30} m</span>
                                </div>
                                <div className="w-px h-10 bg-slate-100" />
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="text-[13px] font-black text-slate-900 group-hover:text-[#1499AD] transition-colors">{a.patient_name || 'Bemor'}</p>
                                    {debouncedSearch.trim() && (
                                      <span className="px-2 py-0.5 bg-slate-100 rounded-md text-[8px] font-black text-slate-500 uppercase">
                                        {String(a.date || '').split('T')[0]}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                    {a.tooth_number ? `${a.tooth_number}-tish: ` : ''}{a.service_name || t('appointments.defaultService') || 'Maslahat'}
                                    {debouncedSearch.trim() && a.doctor_name && (
                                      <span className="ml-2 text-[#1499AD]">· {a.doctor_name}</span>
                                    )}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <div className="flex flex-col items-end gap-1">
                                    <StatusBadge status={a.status} size="sm" />
                                    <AppointmentConfirmationBadge appointment={a} size="sm" />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </motion.div>
            </TabsContent>
          </AnimatePresence>
        </Tabs>
      </div>

      <AppointmentModal
        open={modalOpen}
        onClose={closeModal}
        appointment={editAppt}
        patients={patients}
        services={services}
        allAppointments={appointments}
        prefillDate={prefillDate || viewDate}
        prefillTime={prefillTime}
        prefillDoctorId={prefillDoctorId || selectedDoctorId}
        onSaved={handleSaved}
      />
    </div>
  );
}
