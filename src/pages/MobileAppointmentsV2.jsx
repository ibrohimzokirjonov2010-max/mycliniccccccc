import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, User, Phone, ChevronLeft, ChevronRight,
  Plus, CheckCircle2, XCircle, Clock4, Pencil, UserSquare, MessageCircle, Search
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import PullToRefresh from '@/components/ui/PullToRefresh';
import { formatCurrency } from '@/lib/utils';
import AppointmentModal from '@/components/appointments/AppointmentModal';
import AppointmentTreatmentModal from '@/components/appointments/AppointmentTreatmentModal';
import AppointmentConfirmationBadge from '@/components/appointments/AppointmentConfirmationBadge';
import { toast } from 'sonner';
import { useTranslation } from '@/i18n/LanguageContext';
import { useAuth } from '@/lib/AuthContext';

/**
 * Premium SaaS Mobile Appointments
 * Modern healthcare CRM design with timeline view
 */
export default function MobileAppointmentsV2() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { user, isDoctor } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [services, setServices] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(false);
  const loadingTimerRef = useRef(null);
  const hasLoadedInitial = useRef(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTreatmentModal, setShowTreatmentModal] = useState(false);
  const [treatmentAppointment, setTreatmentAppointment] = useState(null);
  const [editingAppointment, setEditingAppointment] = useState(null);
  
  // iPhone-style Calendar State
  const [showMonthView, setShowMonthView] = useState(false);
  const [viewDate, setViewDate] = useState(new Date(selectedDate));
  const [selectedDoctorId, setSelectedDoctorId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form state for prefilling
  const toLocalDateStr = (d) => {
    const date = d || new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const [formData, setFormData] = useState({
    date: toLocalDateStr(),
    time: '09:00'
  });

  const openAddAppointmentModal = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      date: toLocalDateStr(selectedDate)
    }));
    setShowAddModal(true);
  }, [selectedDate]);

  // Check for navigation state to open modal
  useEffect(() => {
    if (location.state?.openAddModal) {
      openAddAppointmentModal();
      window.history.replaceState({}, document.title);
    }
  }, [location.state, openAddAppointmentModal]);

  const loadData = useCallback(async () => {
    try {
      if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
      if (!hasLoadedInitial.current) {
        loadingTimerRef.current = setTimeout(() => {
          setLoading(true);
        }, 150);
      }
      const [apps, rawPats, servs, users] = await Promise.all([
        base44.entities.Appointment.list('-date', 50),   // ⚡ tez yuklash
        base44.entities.Patient.list(isDoctor ? '-created_date' : 'full_name', isDoctor ? 500 : 50),   // ⚡ tez yuklash
        base44.entities.Service.list('name', 100),
        base44.entities.User.list('name', 50)
      ]);
      const pats = isDoctor && user?.id
        ? (rawPats || []).filter(p =>
            String(p.main_treatment_provider) === String(user.id) ||
            String(p.main_treatment_provider) === String(user.name) ||
            String(p.created_by_id) === String(user.id)
          )
        : (rawPats || []);
      const normalizedApps = apps.map(a => {
        let tStr = a.time || '08:00';
        const parts = tStr.split(':');
        if (parts.length >= 2) {
          const h = parts[0].padStart(2, '0');
          const m = parts[1].padStart(2, '0');
          tStr = `${h}:${m}`;
        }
        
        let dStr = a.date || '';
        if (dStr) {
          const clean = String(dStr).split('T')[0].split(' ')[0];
          if (clean.includes('.')) {
            const dParts = clean.split('.');
            if (dParts[0].length === 4) dStr = `${dParts[0]}-${dParts[1]}-${dParts[2]}`;
            else dStr = `${dParts[2]}-${dParts[1]}-${dParts[0]}`;
          } else {
             dStr = clean;
          }
        }
        
        return { ...a, time: tStr, date: dStr };
      });
      setAppointments(normalizedApps);
      setPatients(pats);
      setServices(servs);
      const filteredDocs = isDoctor && user?.id
        ? users.filter(u => String(u.id) === String(user.id) || u.name === user.name)
        : users.filter(u => u.role === 'doctor' || u.role === 'admin');
      setDoctors(filteredDocs);
      
      // Keep mobile view pinned to a real doctor selection
      setSelectedDoctorId((prevSelectedDoctorId) => {
        if (isDoctor && user?.id) return user.id;
        if (filteredDocs.length === 0) return null;
        const hasSelectedDoctor = filteredDocs.some((doc) => String(doc.id) === String(prevSelectedDoctorId));
        return hasSelectedDoctor ? prevSelectedDoctorId : filteredDocs[0].id;
      });
      hasLoadedInitial.current = true;
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
      setLoading(false);
    }
  }, [isDoctor, user]);

  const handleSearchResultClick = useCallback((app) => {
    if (!app.date) return;
    
    const normalizeToDate = (d) => {
      if (!d) return new Date();
      // Split by T or Space to get ONLY the date part
      const clean = String(d).split(/[T ]/)[0];
      if (clean.includes('.')) {
        const parts = clean.split('.');
        if (parts[0].length === 4) return new Date(parts[0], parts[1]-1, parts[2]);
        return new Date(parts[2], parts[1]-1, parts[0]);
      }
      const [y, m, day] = clean.split('-').map(Number);
      if (isNaN(y) || isNaN(m) || isNaN(day)) return new Date();
      return new Date(y, m-1, day);
    };

    const targetDate = normalizeToDate(app.date);
    setSelectedDate(targetDate);
    setViewDate(new Date(targetDate));
    setSearchQuery('');
    setShowMonthView(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getMondayFirstDayIndex = (date) => {
    const dayIndex = date.getDay();
    return dayIndex === 0 ? 6 : dayIndex - 1;
  };

  const getWeekDays = () => {
    const days = [];
    const startOfWeek = new Date(selectedDate);
    startOfWeek.setDate(selectedDate.getDate() - getMondayFirstDayIndex(selectedDate));
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const getMonthDays = () => {
    const days = [];
    const firstDayOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
    const lastDayOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0);
    const prevMonthLastDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 0);
    const firstDayDayOfWeek = getMondayFirstDayIndex(firstDayOfMonth);
    for (let i = firstDayDayOfWeek - 1; i >= 0; i--) {
      const day = new Date(prevMonthLastDay);
      day.setDate(prevMonthLastDay.getDate() - i);
      days.push({ date: day, isCurrentMonth: false });
    }
    for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
      const day = new Date(viewDate.getFullYear(), viewDate.getMonth(), i);
      days.push({ date: day, isCurrentMonth: true });
    }
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      const day = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, i);
      days.push({ date: day, isCurrentMonth: false });
    }
    return days;
  };

  const changeMonth = (offset) => {
    const next = new Date(viewDate);
    next.setMonth(next.getMonth() + offset);
    setViewDate(next);
  };

  const getFormatDate = (d) => {
    if (!d) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const filteredAppointments = useMemo(() => {
    let result = appointments;
    
    // Normalize date function
    const normalize = (d) => {
        if (!d) return '';
        const clean = String(d).split('T')[0];
        if (clean.includes('.')) {
            const parts = clean.split('.');
            if (parts[0].length === 4) return `${parts[0]}-${parts[1]}-${parts[2]}`;
            return `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        return clean;
    };

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return result.filter(a => {
        const pName = (a.patient_name || '').toLowerCase();
        const sName = (a.service_name || '').toLowerCase();
        const phone = (a.patient_phone || '').toLowerCase();
        return pName.includes(q) || sName.includes(q) || phone.includes(q);
      }).sort((a, b) => {
        const da = normalize(a.date);
        const db = normalize(b.date);
        if (da !== db) return db.localeCompare(da); // Newest first when searching
        return (a.time || '00:00').localeCompare(b.time || '00:00');
      });
    }

    return result.filter(app => {
      if (!app.date) return false;
      const sameDate = normalize(app.date) === getFormatDate(selectedDate);
      if (!sameDate) return false;
      if (selectedDoctorId && app.doctor_id !== selectedDoctorId) return false;
      return true;
    }).sort((a, b) => (a.time || '00:00').localeCompare(b.time || '00:00'));
  }, [appointments, selectedDate, selectedDoctorId, searchQuery]);

  // Fixed working hours: 09:00 – 23:00, hourly only
  const WORKING_HOURS = useMemo(() => {
    const slots = [];
    for (let h = 9; h <= 23; h++) {
      slots.push(`${String(h).padStart(2, '0')}:00`);
    }
    return slots;
  }, []);

  const apptsBySlot = useMemo(() => {
    const map = {};
    filteredAppointments.forEach(a => {
      const [ah, am] = (a.time || '00:00').split(':').map(Number);
      const aStartMin = ah * 60 + am;
      const duration = parseInt(a.duration) || 30;
      const aEndMin = aStartMin + duration;

      // Calculate which slots this appt covers
      WORKING_HOURS.forEach(slot => {
        const [sh, sm] = slot.split(':').map(Number);
        const sMin = sh * 60 + sm;
        
        const isStarting = aStartMin >= sMin && aStartMin < sMin + 30;
        const isContinuing = aStartMin < sMin && aEndMin > sMin;
        
        if (isStarting || isContinuing) {
          if (!map[slot]) map[slot] = [];
          map[slot].push({ ...a, isContinuing: isContinuing });
        }
      });
    });
    return map;
  }, [filteredAppointments, WORKING_HOURS]);

  const statusConfig = {
    'Scheduled': { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', icon: Clock4, label: t('appointments.waiting') },
    'Waiting': { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', icon: Clock, label: t('appointments.waiting') },
    'In Progress': { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', icon: User, label: t('appointments.inProgress') },
    'Completed': { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', icon: CheckCircle2, label: t('appointments.completed') },
    'Cancelled': { bg: 'bg-slate-100', border: 'border-slate-200', text: 'text-slate-600', icon: XCircle, label: t('appointments.cancelled') },
    'No-Show': { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', icon: XCircle, label: t('appointments.noShow') }
  };

  const getStatusStyle = (status) => statusConfig[status] || statusConfig['Scheduled'];
  const formatTime = (time) => { if (!time) return '--:--'; const [h, m] = time.split(':'); return `${h}:${m}`; };

  
  const weekDaysShort = t('common.days', { returnObjects: true }) || ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];
  const monthNames = t('common.months', { returnObjects: true }) || ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];

  const isToday = (date) => date.toDateString() === new Date().toDateString();
  const isSelected = (date) => date.toDateString() === selectedDate.toDateString();

  const openEditModal = (app) => {
    setEditingAppointment(app);
    setFormData({ date: app.date, time: app.time });
    setShowEditModal(true);
  };

  const handleStartAppointment = async (app) => {
    try {
      await base44.entities.Appointment.update(app.id, { status: 'In Progress', start_time: new Date().toISOString() });
      toast.success(t('common.success'));
      navigate(`/patients/${app.patient_id}`);
    } catch (e) { toast.error(t('common.error')); }
  };

  const handleCompleteAppointment = async (id) => {
    // If we have the full app object, we can show the treatment modal
    const app = appointments.find(a => a.id === id);
    if (app) {
      setTreatmentAppointment(app);
      setShowTreatmentModal(true);
    } else {
      // Fallback to simple completion if object not found (unlikely)
      try {
        await base44.entities.Appointment.update(id, { status: 'Completed', end_time: new Date().toISOString() });
        toast.success(t('common.success'));
        loadData();
      } catch (e) { toast.error(t('common.error')); }
    }
  };

  const AppointmentCard = ({ app, index, isContinuing, displayTime, onCardClick, isSearchMode }) => {
    const style = getStatusStyle(app.status);
    const StatusIcon = style.icon;
    
    // Find doctor name for 'All Doctors' view
    const docName = doctors.find(d => String(d.id) === String(app.doctor_id))?.name;
    
    // Premium colors for buttons
    const btnBase = "flex items-center justify-center transition-all active:scale-90 shadow-sm border border-slate-100";
    
    return (
      <motion.div 
        initial={{ opacity: 0, x: -20 }} 
        animate={{ opacity: 1, x: 0 }} 
        transition={{ delay: isSearchMode ? 0 : Math.min(index, 6) * 0.02 }} 
        className="flex gap-2 mb-2 content-visibility-auto"
      >
        <div className="flex flex-col items-center w-12 flex-shrink-0">
          <span className={`text-slate-900 ${isContinuing ? 'text-[9px] font-semibold opacity-40' : 'text-sm font-black'}`}>
            {isContinuing ? displayTime : formatTime(app.time)}
          </span>
          <div className={`w-0.5 flex-1 ${isContinuing ? 'bg-slate-100' : 'bg-slate-200'} mt-1.5 min-h-[40px]`} />
        </div>
        
        <div 
          onClick={() => onCardClick && onCardClick(app)}
          className={`flex-1 ${style.bg} rounded-2xl p-3 border ${style.border} shadow-sm relative overflow-hidden group ${onCardClick ? 'cursor-pointer active:scale-[0.98] transition-transform' : ''}`}
        >
          {isContinuing && (
            <div className="absolute top-0 right-0 px-2 py-0.5 bg-slate-100 text-[7px] font-black uppercase text-slate-400 rounded-bl-lg tracking-widest">
              Davomi
            </div>
          )}
          
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <div className="flex items-center gap-1.5 mb-0.5">
                <h3 className="font-extrabold text-slate-900 text-[13.5px] leading-tight">
                  {app.patient_name}
                </h3>
                {isContinuing && <span className="text-[9px] text-slate-400 font-medium">(Davomi)</span>}
              </div>
              
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                  {app.service_name || 'Xizmat turi ko\'rsatilmagan'}
                </p>
                <div className="flex items-center gap-0.5 text-[8px] font-black text-slate-400 bg-white/40 px-1 py-0.25 rounded border border-slate-100/50">
                  <Clock4 className="w-2 h-2" />
                  {app.duration || 30} MIN
                </div>
              </div>

              {(isSearchMode || (!selectedDoctorId && docName)) && (
                <div className="flex items-center gap-1 mt-1">
                  <div className="w-3.5 h-3.5 rounded-full bg-slate-900/5 flex items-center justify-center">
                    <UserSquare className="w-2 h-2 text-slate-400" />
                  </div>
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest truncate max-w-[110px]">
                    {docName || 'Shifokor'}
                  </span>
                </div>
              )}

              <div className="mt-1.5">
                <AppointmentConfirmationBadge appointment={app} size="sm" />
              </div>
            </div>
            
            <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-white/80 border ${style.border}`}>
              <StatusIcon className={`w-2.5 h-2.5 ${style.text}`} />
              <span className={`text-[8px] font-black uppercase tracking-tight ${style.text}`}>{style.label}</span>
            </div>
          </div>

          <div className="pt-2 mt-1.5 border-t border-slate-100/40 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (app.patient_phone) window.open(`tel:${app.patient_phone}`, '_self');
                  else toast.error("Raqam yo'q");
                }}
                className={`${btnBase} w-8 h-8 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-xl`}
              >
                <Phone className="w-3.5 h-3.5 fill-emerald-100" />
              </button>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const phone = app.patient_phone?.replace(/\D/g, '');
                  if (phone) window.open(`https://t.me/+${phone}`, '_blank');
                  else toast.error("Raqam kiritilmagan");
                }}
                className={`${btnBase} w-8 h-8 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl`}
              >
                <MessageCircle className="w-3.5 h-3.5 fill-blue-100" />
              </button>
              
              <button 
                onClick={(e) => { e.stopPropagation(); openEditModal(app); }} 
                className={`${btnBase} w-8 h-8 bg-slate-50 text-slate-500 hover:bg-slate-100 rounded-xl`}
              >
                <Pencil className="w-3 h-3" />
              </button>
            </div>

            <div className="flex-1 flex justify-end">
              {app.status === 'Scheduled' || app.status === 'Waiting' ? (
                 <button 
                  onClick={(e) => { e.stopPropagation(); handleStartAppointment(app); }} 
                  className="h-8 px-3.5 bg-slate-900 text-white rounded-xl text-[8px] font-black uppercase tracking-[0.1em] shadow-lg shadow-slate-200 active:scale-95 transition-all"
                 >
                   {t('common.start')}
                 </button>
              ) : app.status === 'In Progress' ? (
                 <button 
                  onClick={(e) => { e.stopPropagation(); handleCompleteAppointment(app.id); }} 
                  className="h-8 px-3.5 bg-emerald-500 text-white rounded-xl text-[8px] font-black uppercase tracking-[0.1em] shadow-lg shadow-emerald-100 active:scale-95 transition-all"
                 >
                   {t('common.finish')}
                 </button>
              ) : (
                 <div className="text-right">
                   <span className="text-xs font-black text-slate-900">{app.price ? formatCurrency(app.price) : '0'}</span>
                 </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  const stats = {
    total: filteredAppointments.length,
    waiting: filteredAppointments.filter(a => a.status === 'Waiting').length,
    completed: filteredAppointments.filter(a => a.status === 'Completed').length,
    revenue: filteredAppointments.filter(a => a.status === 'Completed').reduce((sum, a) => sum + (a.price || 0), 0)
  };

  return (
    <PullToRefresh onRefresh={loadData}>
      <div className="min-h-screen bg-slate-50 pb-20">
        <div className="bg-white border-b border-slate-100 sticky top-0 z-10">
          <div className="px-5 pt-4 pb-2">
            <div className="flex items-center justify-between mb-3">
              <button onClick={() => setShowMonthView(!showMonthView)} className="flex flex-col items-start text-left active:opacity-60 transition-opacity">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-slate-900">{t('appointments.calendar')}</h1>
                  <motion.div animate={{ rotate: showMonthView ? 180 : 0 }} transition={{ duration: 0.3 }}><ChevronRight className="w-4 h-4 text-slate-400 rotate-90" /></motion.div>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5 font-bold uppercase tracking-widest">{selectedDate.getDate()} {monthNames[selectedDate.getMonth()]}</p>
              </button>
              <Button onClick={openAddAppointmentModal} className="bg-slate-900 hover:bg-slate-800 text-white rounded-[1rem] px-4 h-10 text-xs shadow-lg shadow-slate-200">
                <Plus className="w-4 h-4 mr-1" />{t('appointments.addNew')}
              </Button>
            </div>
            <AnimatePresence mode="wait">
              {searchQuery.trim() ? (
                <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
                  <div className="bg-[#1499AD]/10 px-4 py-3 rounded-2xl border border-[#1499AD]/20 flex items-center justify-between">
                    <span className="text-xs font-black text-[#1499AD] uppercase tracking-widest whitespace-nowrap">Qidiruv natijalari: {filteredAppointments.length} ta</span>
                    <button onClick={() => setSearchQuery('')} className="p-1 px-3 bg-white rounded-lg text-[10px] font-black text-slate-400 uppercase tracking-widest border border-slate-100 shadow-sm">Tozalash</button>
                  </div>
                </motion.div>
              ) : !showMonthView ? (
                <motion.div key="week-view" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex items-center justify-between mb-5">
                  <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate()-7); setSelectedDate(d); }} className="p-2"><ChevronLeft className="w-5 h-5" /></button>
                  <div className="flex-1 flex justify-center gap-1">
                    {getWeekDays().map((day, idx) => (
                      <button key={idx} onClick={() => setSelectedDate(day)} className={`flex flex-col items-center justify-center w-11 h-16 rounded-2xl transition-all ${isSelected(day) ? 'bg-slate-900 text-white shadow-lg shadow-slate-200' : isToday(day) ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-slate-50 text-slate-500'}`}>
                        <span className="text-[10px] font-bold uppercase mb-1">{weekDaysShort[idx]}</span>
                        <span className="text-lg font-black">{day.getDate()}</span>
                      </button>
                    ))}
                  </div>
                  <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate()+7); setSelectedDate(d); }} className="p-2"><ChevronRight className="w-5 h-5" /></button>
                </motion.div>
              ) : (
                <motion.div key="month-view" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="mb-6 bg-slate-50/50 rounded-3xl p-4 border border-slate-100">
                  <div className="flex items-center justify-between mb-6 px-1">
                    <span className="text-xl font-black text-slate-900">{monthNames[viewDate.getMonth()]} <span className="text-slate-400 font-medium">{viewDate.getFullYear()}</span></span>
                    <div className="flex bg-white rounded-xl p-1 shadow-sm border border-slate-100">
                      <button onClick={() => changeMonth(-1)} className="p-1.5"><ChevronLeft className="w-4 h-4" /></button>
                      <button onClick={() => setViewDate(new Date())} className="px-3 text-[10px] font-black uppercase text-blue-600">{t('common.today')}</button>
                      <button onClick={() => changeMonth(1)} className="p-1.5"><ChevronRight className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <div className="grid grid-cols-7 mb-4">
                    {weekDaysShort.map(d => <div key={d} className="text-center text-[9px] font-black text-slate-400 uppercase">{d}</div>)}
                  </div>
                  <div className="grid grid-cols-7 gap-y-2">
                    {getMonthDays().map((item, idx) => {
                      const isSel = isSelected(item.date);
                      const itemDateStr = getFormatDate(item.date);
                      const normalize = (d) => {
                          if (!d) return '';
                          const clean = String(d).split('T')[0];
                          if (clean.includes('.')) {
                              const parts = clean.split('.');
                              if (parts[0].length === 4) return `${parts[0]}-${parts[1]}-${parts[2]}`;
                              return `${parts[2]}-${parts[1]}-${parts[0]}`;
                          }
                          return clean;
                      };
                      const hasAppts = appointments.some(a => a.date && normalize(a.date) === itemDateStr);
                      return (
                        <button key={idx} onClick={() => setSelectedDate(item.date)} className="relative flex flex-col items-center justify-center h-10 w-full transition-all">
                          {isSel && <div className="absolute inset-0.5 rounded-full bg-slate-900" />}
                          <span className={`relative text-sm font-bold z-20 ${!item.isCurrentMonth ? 'text-slate-200' : isSel ? 'text-white' : isToday(item.date) ? 'text-blue-600' : 'text-slate-800'}`}>{item.date.getDate()}</span>
                          {hasAppts && <div className={`relative z-20 mt-0.5 w-1 h-1 rounded-full ${isSel ? 'bg-white/80' : 'bg-slate-300'}`} />}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Doctors Selection Strip */}
            <div className="mt-4 pb-2 -mx-5 px-5">
              <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar overscroll-x-contain pb-2 px-1 snap-x snap-mandatory" style={{ WebkitOverflowScrolling: 'touch' }}>
                {doctors.map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => setSelectedDoctorId(doc.id)}
                    className={`flex items-center gap-2 px-5 min-h-[44px] py-2.5 rounded-2xl whitespace-nowrap transition-all border shrink-0 snap-start ${
                      selectedDoctorId === doc.id
                        ? 'bg-slate-900 border-slate-900 text-white shadow-lg shadow-slate-200 z-10'
                        : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50 shadow-sm'
                    }`}
                  >
                    <span className="text-sm font-bold">{doc.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Search System - Modern Floating Input */}
            <div className="mt-3 relative">
              <div className={`flex items-center gap-3 bg-slate-50/50 rounded-xl px-4 h-11 border transition-all ${searchQuery ? 'border-[#1499AD] ring-4 ring-[#1499AD]/5' : 'border-slate-100 shadow-sm'}`}>
                <Search className={`w-4 h-4 ${searchQuery ? 'text-[#1499AD]' : 'text-slate-300'}`} />
                <input 
                  type="text" 
                  placeholder="Bemor yoki xizmat turi..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent border-none text-[13px] font-bold text-slate-800 placeholder:text-slate-300 outline-none"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 active:scale-90 transition-all font-black text-xs">×</button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="p-4">
          {loading ? [1,2,3].map(i => <div key={i} className="h-20 bg-slate-100 rounded-2xl animate-pulse mb-4" />) : (
            <div className="space-y-1">
              {searchQuery.trim() ? (
                // SEARCH RESULTS LIST
                <div className="space-y-3">
                  {filteredAppointments.length === 0 ? (
                    <div className="py-20 text-center">
                      <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto mb-4 text-slate-300">
                        <Search className="w-8 h-8" />
                      </div>
                      <p className="text-slate-400 font-bold">"{searchQuery}" bo'yicha uchrashuv topilmadi</p>
                    </div>
                  ) : (
                    filteredAppointments.map((app, idx) => (
                      <div key={app.id} className="relative">
                        {/* Date badge for search results */}
                        <div className="absolute -top-2 left-4 z-10 bg-[#1499AD] text-white text-[8px] font-black px-2 py-0.5 rounded-full shadow-sm uppercase tracking-widest">
                          {app.date?.split('T')[0].split('-').reverse().join('.')}
                        </div>
                        <AppointmentCard 
                          app={app} 
                          index={idx} 
                          isContinuing={false} 
                          isSearchMode={true}
                          onCardClick={handleSearchResultClick}
                        />
                      </div>
                    ))
                  )}
                </div>              ) : (
                // FULL TIMELINE 09:00 – 23:00 (always visible)
                <div className="space-y-0">
                  {WORKING_HOURS.map((hour) => {
                    const slotAppts = apptsBySlot[hour] || [];
                    const isEmpty = slotAppts.length === 0;

                    return (
                      <div key={hour}>
                        {isEmpty ? (
                          // Empty slot row — clickable to add new appointment
                          <button
                            onClick={() => {
                              setFormData(prev => ({ ...prev, date: toLocalDateStr(selectedDate), time: hour }));
                              setShowAddModal(true);
                            }}
                            className="w-full flex items-center gap-3 group transition-colors py-2 hover:bg-emerald-50/50"
                          >
                            {/* Time label */}
                            <span className="w-14 text-right shrink-0 text-xs font-bold text-slate-400 tabular-nums">
                              {hour}
                            </span>

                            {/* Divider line */}
                            <div className="flex-1 border-t border-slate-200 group-hover:border-emerald-300 transition-colors" />

                            {/* Plus hint on hover */}
                            <span className="text-[10px] font-black text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity pr-1 whitespace-nowrap">
                              + Qo'shish
                            </span>
                          </button>
                        ) : (
                          // Slot has appointments — render cards
                          <div className="pt-1 pb-2">
                            {slotAppts.map((app, idx) => {
                              const [ah, am] = (app.time || '00:00').split(':').map(Number);
                              const aStartMin = ah * 60 + am;
                              const [sh, sm] = hour.split(':').map(Number);
                              const sMin = sh * 60 + sm;
                              const isCont = aStartMin < sMin;
                              return (
                                <AppointmentCard
                                  key={`${app.id}-${hour}`}
                                  app={app}
                                  index={idx}
                                  isContinuing={isCont}
                                  displayTime={hour}
                                />
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
        <AppointmentModal
          open={showAddModal || showEditModal}
          onClose={() => { setShowAddModal(false); setShowEditModal(false); setEditingAppointment(null); }}
          appointment={editingAppointment}
          patients={patients}
          services={services}
          allAppointments={appointments}
          prefillDate={formData.date}
          prefillTime={formData.time}
          prefillDoctorId={selectedDoctorId}
          onSaved={loadData}
        />

        <AppointmentTreatmentModal
          open={showTreatmentModal}
          onClose={() => { setShowTreatmentModal(false); setTreatmentAppointment(null); }}
          appointment={treatmentAppointment}
          onCompleted={loadData}
        />
      </div>
    </PullToRefresh>
  );
}
