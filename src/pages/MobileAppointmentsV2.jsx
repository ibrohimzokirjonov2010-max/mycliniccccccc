import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { profileState } from '@/hooks/useBack';
import { useNavigate, useLocation } from 'react-router-dom';
import { useRestorableState, useRestorableDate } from '@/hooks/useRestorableState';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, User, Phone, ChevronLeft, ChevronRight,
  Plus, CheckCircle2, XCircle, Clock4, Pencil, UserSquare, MessageCircle, Search, MoreVertical, Send, Play, ChevronDown, SlidersHorizontal
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
import { appointmentMatchesDoctor } from '@/utils/doctorMatch';
import { isCancelledStatus } from '@/utils/clinicMetrics';

/**
 * Premium SaaS Mobile Appointments
 * Modern healthcare CRM design with timeline view
 */
const UZ_DAYS_SHORT = ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan'];
const UZ_DAYS_LONG = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];

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
  // Orqaga qaytganda tanlangan sana/shifokor/qidiruv tiklanadi
  const [selectedDate, setSelectedDate] = useRestorableDate('selectedDate', () => new Date());
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTreatmentModal, setShowTreatmentModal] = useState(false);
  const [treatmentAppointment, setTreatmentAppointment] = useState(null);
  const [editingAppointment, setEditingAppointment] = useState(null);
  
  // iPhone-style Calendar State
  const [showMonthView, setShowMonthView] = useState(false);
  const [viewDate, setViewDate] = useRestorableDate('viewDate', () => new Date(selectedDate));
  const [selectedDoctorId, setSelectedDoctorId] = useRestorableState('selectedDoctorId', null);
  const [searchQuery, setSearchQuery] = useRestorableState('searchQuery', '');
  // Xodimlar sahifasidan: shifokorning barcha qabullari ro'yxati (kun bo'yicha emas)
  const [listAll, setListAll] = useRestorableState('listAll', false);
  const [hideCancelled, setHideCancelled] = useRestorableState('hideCancelled', false);
  
  // Form state for prefilling
  const toLocalDateStr = (d) => {
    const date = d || new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const [formData, setFormData] = useState({
    date: toLocalDateStr(),
    time: '09:00'
  });
  const [prefillPat, setPrefillPat] = useState(null);
  const [menuFor, setMenuFor] = useState(null);

  const openAddAppointmentModal = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      date: toLocalDateStr(selectedDate)
    }));
    setShowAddModal(true);
  }, [selectedDate]);

  // Check for navigation state to open modal or filter a doctor
  // Qaytganda (Orqaga) kelgan filtr qayta qo'llanmasligi uchun — qo'llangan yozuv key'i saqlanadi
  const [handledNavStored, setHandledNavStored] = useRestorableState('handledNav', null);
  const handledNavKey = useRef(handledNavStored);
  useEffect(() => {
    const incomingId = location.state?.doctorId;
    if (incomingId != null && incomingId !== '' && handledNavKey.current !== location.key) {
      const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(location.state?.date || '').split('T')[0]);
      if (dateMatch) {
        // Aniq kun: shu kun + shifokor
        const next = new Date(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3]));
        setSelectedDate(next);
        setViewDate(next);
        setListAll(false);
        setHideCancelled(false);
        setSearchQuery('');
        handledNavKey.current = location.key; setHandledNavStored(location.key);
      } else if (location.state?.listPeriod === 'all') {
        // Shifokorning barcha qabullari
        setListAll(true);
        setHideCancelled(!!location.state?.excludeCancelled);
        setSearchQuery('');
        handledNavKey.current = location.key; setHandledNavStored(location.key);
      } else if (appointments.length) {
        const name = String(location.state?.doctorName || '').trim().toLowerCase();
        const dates = appointments
          .filter((a) => {
            if (String(a.doctor_id) === String(incomingId)) return true;
            const doctorName = String(a.doctor_name || '').trim().toLowerCase();
            return name.length > 1 && doctorName && (doctorName.includes(name) || name.includes(doctorName));
          })
          .map((a) => String(a.date || '').split('T')[0].split(' ')[0])
          .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
          .sort();
        if (dates.length) {
          const [y, m, d] = dates[dates.length - 1].split('-').map(Number);
          const next = new Date(y, m - 1, d);
          setSelectedDate(next);
          setViewDate(next);
        }
        handledNavKey.current = location.key; setHandledNavStored(location.key);
      }
      setSelectedDoctorId(incomingId);
    }
    if (location.state?.openAddModal) {
      if (location.state?.prefillPatient) setPrefillPat({ id: location.state.prefillPatient, name: location.state.prefillPatientName || '' });
      openAddAppointmentModal();
      window.history.replaceState({ ...(window.history.state || {}), usr: null }, document.title);
    }
  }, [location.state, location.key, openAddAppointmentModal, appointments]);

  const loadData = useCallback(async () => {
    try {
      if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
      if (!hasLoadedInitial.current) {
        loadingTimerRef.current = setTimeout(() => {
          setLoading(true);
        }, 150);
      }
      const [apps, rawPats, servs, users] = await Promise.all([
        base44.entities.Appointment.list('-date', 500),
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
    setListAll(false);
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

    if (listAll) {
      const selectedDoc = doctors.find((d) => String(d.id) === String(selectedDoctorId));
      const docName = selectedDoc?.name || selectedDoc?.full_name || '';
      return result
        .filter((a) => (selectedDoctorId ? appointmentMatchesDoctor(a, selectedDoctorId, docName) : true))
        .filter((a) => !(hideCancelled && isCancelledStatus(a.status)))
        .sort((a, b) => {
          const da = normalize(a.date);
          const db = normalize(b.date);
          if (da !== db) return db.localeCompare(da);
          return (a.time || '00:00').localeCompare(b.time || '00:00');
        });
    }

    return result.filter(app => {
      if (!app.date) return false;
      const sameDate = normalize(app.date) === getFormatDate(selectedDate);
      if (!sameDate) return false;
      if (selectedDoctorId) {
        const idMatch = String(app.doctor_id) === String(selectedDoctorId);
        const selectedDoc = doctors.find((d) => String(d.id) === String(selectedDoctorId));
        const selectedName = String(selectedDoc?.name || selectedDoc?.full_name || '').trim().toLowerCase();
        const doctorName = String(app.doctor_name || '').trim().toLowerCase();
        const nameMatch = selectedName.length > 1 && doctorName && (doctorName.includes(selectedName) || selectedName.includes(doctorName));
        if (!idMatch && !nameMatch) return false;
      }
      return true;
    }).sort((a, b) => (a.time || '00:00').localeCompare(b.time || '00:00'));
  }, [appointments, selectedDate, selectedDoctorId, searchQuery, doctors, listAll, hideCancelled]);

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
      navigate(`/patients/${app.patient_id}`, { state: profileState() });
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
    const docName = doctors.find(d => String(d.id) === String(app.doctor_id))?.name || app.doctor_name;
    const isOpen = menuFor === `${app.id}-${displayTime || ''}`;
    const dotCls = app.status === 'Completed' ? 'bg-emerald-500' : app.status === 'Cancelled' || app.status === 'No-Show' ? 'bg-slate-300' : 'bg-blue-600';
    const cardBg = app.status === 'Completed' ? 'bg-white border-slate-200' : app.status === 'Cancelled' || app.status === 'No-Show' ? 'bg-slate-50 border-slate-200' : 'bg-[#EEF4FF] border-[#D6E3FB]';
    const tg = () => { const p = app.patient_phone?.replace(/\D/g, ''); if (p) window.open(`https://t.me/+${p}`, '_blank'); else toast.error("Raqam kiritilmagan"); };
    const call = () => { if (app.patient_phone) window.open(`tel:${app.patient_phone}`, '_self'); else toast.error("Raqam yo'q"); };
    return (
      <motion.div
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: isSearchMode ? 0 : Math.min(index, 6) * 0.02 }}
        className="flex gap-2 mb-2 content-visibility-auto"
      >
        <div className="flex items-start w-[58px] flex-shrink-0 pt-3 gap-1.5 justify-end">
          <span className={`tabular-nums ${isContinuing ? 'text-[13px] font-semibold text-slate-400' : 'text-[15px] font-extrabold text-slate-900'}`}>
            {isContinuing ? displayTime : formatTime(app.time)}
          </span>
          <span className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${dotCls}`} />
        </div>
        <div
          onClick={() => onCardClick && onCardClick(app)}
          className={`flex-1 min-w-0 rounded-2xl px-3 py-2.5 border ${cardBg} relative ${onCardClick ? 'cursor-pointer active:scale-[0.99] transition-transform' : ''}`}
        >
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-extrabold text-slate-900 text-[15px] leading-tight truncate">{app.patient_name}{isContinuing ? <span className="text-[13px] font-medium text-slate-400"> (davomi)</span> : null}</h3>
              <p className="text-[13px] text-slate-600 truncate mt-0.5">{app.service_name || "Xizmat ko'rsatilmagan"}</p>
              <div className="flex items-center gap-3 mt-1 text-[13px] text-slate-500">
                <span className="flex items-center gap-1 shrink-0"><Clock4 className="w-3.5 h-3.5" />{app.duration || 30} min</span>
                {docName && <span className="flex items-center gap-1 min-w-0 truncate"><User className="w-3.5 h-3.5 shrink-0" />{docName}</span>}
              </div>
              <div className="mt-1"><AppointmentConfirmationBadge appointment={app} size="sm" /></div>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <span className={`flex items-center gap-1 px-2 py-1 rounded-full bg-white border ${style.border}`}>
                <StatusIcon className={`w-3.5 h-3.5 ${style.text}`} />
                <span className={`text-[12px] font-bold uppercase ${style.text}`}>{style.label}</span>
              </span>
              <button type="button" aria-label="Amallar" onClick={(e) => { e.stopPropagation(); setMenuFor(isOpen ? null : `${app.id}-${displayTime || ''}`); }} className="w-9 h-11 -mr-1.5 flex items-center justify-center text-slate-500">
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>
          </div>
          {isOpen && (
            <div onClick={(e) => e.stopPropagation()} className="mt-2 pt-2 border-t border-slate-200/70 grid grid-cols-2 gap-1.5">
              <button onClick={call} className="h-11 rounded-xl bg-emerald-50 text-emerald-700 text-[13px] font-bold flex items-center justify-center gap-1"><Phone className="w-4 h-4" />Qo'ng'iroq</button>
              <button onClick={tg} className="h-11 rounded-xl bg-sky-50 text-sky-700 text-[13px] font-bold flex items-center justify-center gap-1"><Send className="w-4 h-4" />Telegram</button>
              <button onClick={() => { setMenuFor(null); openEditModal(app); }} className="h-11 rounded-xl bg-white border border-slate-200 text-slate-700 text-[13px] font-bold flex items-center justify-center gap-1"><Pencil className="w-4 h-4" />Tahrir</button>
              {app.status === 'Scheduled' || app.status === 'Waiting' ? (
                <button onClick={() => handleStartAppointment(app)} className="h-11 rounded-xl bg-slate-900 text-white text-[13px] font-bold flex items-center justify-center gap-1"><Play className="w-4 h-4" />{t('common.start')}</button>
              ) : app.status === 'In Progress' ? (
                <button onClick={() => handleCompleteAppointment(app.id)} className="h-11 rounded-xl bg-emerald-500 text-white text-[13px] font-bold flex items-center justify-center">{t('common.finish')}</button>
              ) : (
                <span className="h-11 rounded-xl bg-slate-50 text-slate-800 text-[13px] font-bold flex items-center justify-center">{app.price ? formatCurrency(app.price) : '0'}</span>
              )}
            </div>
          )}
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
      <div className="min-h-screen bg-[#F4F7F9] pb-20">
        <div className="bg-[#F4F7F9]">
          <div className="px-4 pt-3 pb-3">
            <div className="flex items-center justify-between mb-3 gap-3">
              <button onClick={() => setShowMonthView(!showMonthView)} className="flex flex-col items-start text-left active:opacity-60 transition-opacity min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-[26px] font-extrabold text-slate-900 leading-tight">{t('appointments.calendar')}</h1>
                  <motion.div animate={{ rotate: showMonthView ? 180 : 0 }} transition={{ duration: 0.3 }}><ChevronDown className="w-5 h-5 text-slate-500" /></motion.div>
                </div>
                <p className="text-[13px] text-slate-500 font-bold uppercase tracking-wide truncate">{selectedDate.getDate()} {monthNames[selectedDate.getMonth()]} {selectedDate.getFullYear()}, {UZ_DAYS_LONG[selectedDate.getDay()]}</p>
              </button>
              <Button onClick={openAddAppointmentModal} className="bg-slate-900 hover:bg-slate-800 text-white rounded-2xl px-4 h-12 text-[15px] font-bold shadow-lg shadow-slate-300 shrink-0">
                <Plus className="w-5 h-5 mr-1.5" />{t('appointments.addNew')}
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
              ) : listAll ? (
                <motion.div key="list-all" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
                  <div className="bg-[#1499AD]/10 px-4 py-3 rounded-2xl border border-[#1499AD]/20 flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-[#1499AD] uppercase tracking-widest">Barcha qabullar: {filteredAppointments.length} ta</span>
                    <button onClick={() => setListAll(false)} className="shrink-0 p-1 px-3 bg-white rounded-lg text-[10px] font-black text-slate-500 uppercase tracking-widest border border-slate-100 shadow-sm">Kunlik ko'rinish</button>
                  </div>
                </motion.div>
              ) : !showMonthView ? (
                <motion.div key="week-view" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-1.5 mb-3">
                  <button aria-label="Oldingi hafta" onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate()-7); setSelectedDate(d); }} className="w-9 h-[60px] rounded-xl bg-white border border-slate-200 flex items-center justify-center text-blue-600 shrink-0"><ChevronLeft className="w-5 h-5" /></button>
                  <div className="flex-1 grid grid-cols-7 gap-1">
                    {getWeekDays().map((day, idx) => (
                      <button key={idx} onClick={() => setSelectedDate(day)} className={`relative flex flex-col items-center justify-center h-[60px] rounded-xl transition-all ${isSelected(day) ? 'bg-[#13A08F] text-white shadow-md shadow-teal-600/25' : 'bg-white border border-slate-200 text-slate-800'}`}>
                        <span className="text-[16px] font-bold leading-tight">{String(day.getDate()).padStart(2, '0')}</span>
                        <span className={`text-[12px] font-medium ${isSelected(day) ? 'text-white/90' : 'text-slate-500'}`}>{UZ_DAYS_SHORT[day.getDay()]}</span>
                        {isToday(day) && <span className={`absolute bottom-1 w-1 h-1 rounded-full ${isSelected(day) ? 'bg-white' : 'bg-[#13A08F]'}`} />}
                      </button>
                    ))}
                  </div>
                  <button aria-label="Keyingi hafta" onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate()+7); setSelectedDate(d); }} className="w-9 h-[60px] rounded-xl bg-white border border-slate-200 flex items-center justify-center text-blue-600 shrink-0"><ChevronRight className="w-5 h-5" /></button>
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

            <div className="mt-1 flex items-center gap-2">
              <div
                className="flex-1 min-w-0 flex flex-nowrap items-center gap-2 overflow-x-auto no-scrollbar overscroll-x-contain py-0.5"
                data-testid="mobile-cal-doctor-chips"
                style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y' }}
              >
                {[{ id: null, name: 'Barcha' }, ...doctors].map((doc) => {
                  const on = doc.id == null ? !selectedDoctorId : String(selectedDoctorId) === String(doc.id);
                  return (
                    <button key={doc.id ?? 'all'} type="button" onClick={() => setSelectedDoctorId(doc.id)}
                      className={`px-4 h-11 rounded-xl whitespace-nowrap transition-all border shrink-0 text-[14px] font-bold ${on ? 'bg-slate-900 border-slate-900 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-600'}`}>
                      <span className="truncate max-w-[11rem] inline-block align-middle">{doc.name}</span>
                    </button>
                  );
                })}
              </div>
              <button type="button" aria-label="Oylik ko'rinish" onClick={() => setShowMonthView(!showMonthView)} className={`w-11 h-11 shrink-0 rounded-xl border flex items-center justify-center ${showMonthView ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 text-slate-600'}`}>
                <SlidersHorizontal className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-3 relative">
              <div className={`flex items-center gap-3 bg-white rounded-2xl px-4 h-12 border transition-all ${searchQuery ? 'border-[#13A08F] ring-4 ring-[#13A08F]/10' : 'border-slate-200'}`}>
                <Search className={`w-5 h-5 ${searchQuery ? 'text-[#13A08F]' : 'text-slate-400'}`} />
                <input
                  type="text"
                  placeholder="Bemor yoki xizmat bo'yicha qidirish..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent border-none text-[15px] font-medium text-slate-800 placeholder:text-slate-400 outline-none"
                />
                {searchQuery && (
                  <button aria-label="Tozalash" onClick={() => setSearchQuery('')} className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center text-slate-500"><XCircle className="w-4 h-4" /></button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="px-3 pt-1 pb-4">
          {loading ? [1,2,3].map(i => <div key={i} className="h-20 bg-slate-100 rounded-2xl animate-pulse mb-4" />) : (
            <div className="space-y-1">
              {searchQuery.trim() || listAll ? (
                // SEARCH RESULTS / DOCTOR "ALL VISITS" LIST
                <div className="space-y-3">
                  {filteredAppointments.length === 0 ? (
                    <div className="py-20 text-center">
                      <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto mb-4 text-slate-300">
                        <Search className="w-8 h-8" />
                      </div>
                      <p className="text-slate-400 font-bold">{searchQuery.trim() ? `"${searchQuery}" bo'yicha uchrashuv topilmadi` : "Bu shifokorda qabul topilmadi"}</p>
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
                          // Empty slot row
                          <div className="flex gap-2 mb-2">
                            <div className="flex items-start w-[58px] flex-shrink-0 pt-4 gap-1.5 justify-end">
                              <span className="text-[15px] font-extrabold text-slate-900 tabular-nums">{hour}</span>
                              <span className="mt-1.5 w-2.5 h-2.5 rounded-full bg-slate-300 shrink-0" />
                            </div>
                            <button
                              onClick={() => {
                                setFormData(prev => ({ ...prev, date: toLocalDateStr(selectedDate), time: hour }));
                                setShowAddModal(true);
                              }}
                              className="flex-1 min-w-0 flex items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white/60 px-3 h-[60px] text-left active:bg-emerald-50"
                            >
                              <span className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><Plus className="w-5 h-5" /></span>
                              <span className="flex-1 min-w-0"><span className="block text-[14px] font-bold text-slate-800">Bo'sh vaqt</span><span className="block text-[13px] text-slate-500">Uchrashuv qo'shish</span></span>
                              <ChevronRight className="w-5 h-5 text-slate-400" />
                            </button>
                          </div>
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
          onClose={() => { setShowAddModal(false); setShowEditModal(false); setEditingAppointment(null); setPrefillPat(null); }}
          appointment={editingAppointment}
          patients={patients}
          services={services}
          allAppointments={appointments}
          prefillDate={formData.date}
          prefillTime={formData.time}
          prefillDoctorId={selectedDoctorId}
          prefillPatientId={prefillPat?.id}
          prefillPatientName={prefillPat?.name}
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
