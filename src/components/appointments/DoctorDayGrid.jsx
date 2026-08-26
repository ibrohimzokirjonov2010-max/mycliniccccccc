import { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Clock, Wallet, CheckCircle2, FlaskConical, X, Phone, Calendar, Stethoscope, CreditCard, FileText, History, Receipt, Edit3, UserCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/LanguageContext';
import AppointmentConfirmationBadge from './AppointmentConfirmationBadge';


/**
 * Test eslatma yuboruvchi hook.
 */
function useTestReminder() {
  const [loadingId, setLoadingId] = useState(null);

  const sendTest = useCallback(async (appointment, e) => {
    e.stopPropagation();
    const id = String((appointment)._id || (appointment).id || '');
    if (!id || loadingId) return;

    setLoadingId(id);
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
      const token = localStorage.getItem('auth_token') || localStorage.getItem('token') || '';
      const res = await fetch(`${backendUrl}/notifications/test-send-now`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ appointmentId: id, type: 'confirmation' }),
      });
      const data = await res.json().catch(() => ({}));

      if (data.success) {
        const evt = new CustomEvent('test-reminder-sent', { detail: { ok: true, name: data.patient_name || appointment.patient_name } });
        window.dispatchEvent(evt);
      } else {
        const evt = new CustomEvent('test-reminder-sent', { detail: { ok: false, msg: data.message || 'Xato' } });
        window.dispatchEvent(evt);
      }
    } catch (err) {
      const evt = new CustomEvent('test-reminder-sent', { detail: { ok: false, msg: 'Server bilan bog\'lanishda xato' } });
      window.dispatchEvent(evt);
    } finally {
      setLoadingId(null);
    }
  }, [loadingId]);

  return { sendTest, loadingId };
}

// Static base slots to build from (08:00 – 23:00)
const BASE_TIME_SLOTS = Array.from({ length: 31 }, (_, i) => {
  const h = Math.floor(8 + i / 2);
  const m = i % 2 === 0 ? '00' : '30';
  return `${String(h).padStart(2, '0')}:${m}`;
});

const statusColors = {
  Scheduled: 'bg-[#E3F2FD] border-[#BBDEFB] text-[#1976D2]',
  Waiting: 'bg-[#FFF3E0] border-[#FFE0B2] text-[#E65100]',
  'In Progress': 'bg-[#E1F5FE] border-[#B3E5FC] text-[#01579B]',
  Completed: 'bg-[#E8F5E9] border-[#C8E6C9] text-[#2E7D32]',
  Cancelled: 'bg-rose-50 border-rose-100 text-rose-600',
  'No-Show': 'bg-slate-50 border-slate-200 text-slate-400'
};

const statusUz = {
  Scheduled: 'Rejalashtirilgan',
  Waiting: 'Kutmoqda',
  'In Progress': 'Jarayonda',
  Completed: 'Tugallangan',
  Cancelled: 'Bekor qilingan',
  'No-Show': 'Kelmadi',
  Planned: 'Rejalashtirilgan',
};

const statusBadgeColors = {
  Scheduled: 'bg-blue-100 text-blue-700',
  Waiting: 'bg-amber-100 text-amber-700',
  'In Progress': 'bg-cyan-100 text-cyan-700',
  Completed: 'bg-emerald-100 text-emerald-700',
  Cancelled: 'bg-rose-100 text-rose-700',
  'No-Show': 'bg-slate-100 text-slate-500',
  Planned: 'bg-teal-100 text-teal-700',
};

/* ═══════════════════════════════════════════════════
   QUICK VIEW POPUP — cliniccards.com uslubi
   ═══════════════════════════════════════════════════ */
export function AppointmentQuickView({ appointment, onClose, onEdit, rect }) {
  const { t } = useTranslation();
  const popupRef = useRef(null);
  const navigate = useNavigate();
  const [placement, setPlacement] = useState('bottom');
  const [top, setTop] = useState(0);
  const [left, setLeft] = useState(0);
  const [arrowLeft, setArrowLeft] = useState(24);

  const goToProfile = () => {
    if (appointment?.patient_id) {
      onClose();
      navigate(`/patients/${appointment.patient_id}`);
    }
  };

  const goToPayments = () => {
    if (appointment?.patient_id) {
      onClose();
      navigate(`/patients/${appointment.patient_id}?tab=payments`);
    } else {
      onClose();
      navigate(`/payments`);
    }
  };

  const goToAppointments = () => {
    if (appointment?.patient_id) {
      onClose();
      navigate(`/patients/${appointment.patient_id}?tab=appointments`);
    } else {
      onClose();
      navigate(`/appointments`);
    }
  };

  const goToTreatmentPlans = () => {
    if (appointment?.patient_id) {
      onClose();
      navigate(`/patients/${appointment.patient_id}?tab=treatments`);
    } else {
      onClose();
      navigate(`/treatment-plans`);
    }
  };

  const goToHistory = () => {
    if (appointment?.patient_id) {
      onClose();
      navigate(`/patients/${appointment.patient_id}?tab=info`);
    }
  };

  useEffect(() => {
    if (!rect) return;
    const popupHeight = 360;
    const popupWidth = 320;
    const spaceBelow = window.innerHeight - rect.bottom;
    const preferTop = spaceBelow < popupHeight && rect.top > popupHeight;

    let calculatedTop = 0;
    if (preferTop) {
      setPlacement('top');
      calculatedTop = rect.top - popupHeight - 8;
    } else {
      setPlacement('bottom');
      calculatedTop = rect.bottom + 8;
    }
    calculatedTop = Math.max(10, Math.min(calculatedTop, window.innerHeight - popupHeight - 10));

    // Align popup horizontally relative to the center of the clicked slot
    const cardCenter = rect.left + rect.width / 2;
    let calculatedLeft = cardCenter - popupWidth / 2;

    // Clamp left/right bounds so popup stays on screen
    calculatedLeft = Math.min(calculatedLeft, window.innerWidth - popupWidth - 20);
    calculatedLeft = Math.max(20, calculatedLeft);

    // Align arrow to point directly to the horizontal center of the card
    let calculatedArrowLeft = cardCenter - calculatedLeft;
    // Restrict within popup boundaries (avoid rounded corners)
    calculatedArrowLeft = Math.max(20, Math.min(calculatedArrowLeft, popupWidth - 20));

    setTop(calculatedTop);
    setLeft(calculatedLeft);
    setArrowLeft(calculatedArrowLeft);
  }, [rect]);

  useEffect(() => {
    const handleClick = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) {
        onClose();
      }
    };
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    setTimeout(() => document.addEventListener('mousedown', handleClick), 50);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  if (!appointment) return null;

  const a = appointment;
  const initials = (a.patient_name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  
  // Vaqt oxirini hisoblash
  const endTime = (() => {
    const [h, m] = (a.time || '00:00').split(':').map(Number);
    const dur = Number(a.duration) || 30;
    const endMin = h * 60 + m + dur;
    return `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
  })();

  // Yosh hisoblash
  const age = (() => {
    if (!a.patient_birth_date && !a.birth_date) return null;
    const bDate = new Date(a.patient_birth_date || a.birth_date);
    if (isNaN(bDate)) return null;
    const today = new Date();
    let age = today.getFullYear() - bDate.getFullYear();
    const m = today.getMonth() - bDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < bDate.getDate())) age--;
    return age;
  })();

  // Sana formatlash
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString('uz-UZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  const style = {
    position: 'fixed',
    zIndex: 9999,
    top: `${top}px`,
    left: `${left}px`,
  };

  const statusKey = a.status || 'Scheduled';

  return createPortal(
    <div style={style} ref={popupRef}>
      {/* Triangle arrow */}
      {placement === 'bottom' ? (
        <div 
          className="absolute -top-2 w-4 h-4 bg-white border-l border-t border-slate-200 rotate-45 shadow-sm z-10" 
          style={{ left: `${arrowLeft - 8}px` }}
        />
      ) : (
        <div 
          className="absolute -bottom-2 w-4 h-4 bg-white border-r border-b border-slate-200 rotate-45 shadow-sm z-10" 
          style={{ left: `${arrowLeft - 8}px` }}
        />
      )}
      
      <div className="w-[320px] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-start gap-3 p-4 border-b border-slate-100">
          {/* Avatar — bosganda profil sahifasiga o'tadi */}
          <button
            onClick={goToProfile}
            title="Bemor profiliga o'tish"
            className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#1499AD] to-[#0d7a8a] flex items-center justify-center text-white font-black text-lg shadow-md shrink-0 border-none cursor-pointer hover:opacity-90 hover:scale-105 transition-all active:scale-95"
          >
            {initials}
          </button>

          <div className="flex-1 min-w-0">
            {/* Navbat raqami + ism — bosganda profil sahifasiga o'tadi */}
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">1</span>
              <button
                onClick={goToProfile}
                className="font-black text-slate-900 text-[15px] leading-tight truncate hover:text-[#1499AD] transition-colors border-none bg-transparent cursor-pointer p-0 text-left"
              >
                {a.patient_name || t('appointments.patient') || 'Bemor'}
              </button>
            </div>
            {/* Telefon */}
            {a.patient_phone && (
              <div className="flex items-center gap-1 mb-1">
                <Phone className="w-3 h-3 text-slate-400" />
                <a href={`tel:${a.patient_phone}`} className="text-[12px] text-slate-500 font-semibold hover:text-[#1499AD] transition-colors no-underline">{a.patient_phone}</a>
              </div>
            )}
            {/* Status badge */}
            <span className={cn('text-[10px] font-black px-2 py-0.5 rounded-full', statusBadgeColors[statusKey] || 'bg-teal-100 text-teal-700')}>
              {t(`appointments.statusLabels.${statusKey.replace(/\s+/g, '')}`) || statusUz[statusKey] || statusKey}
            </span>
          </div>

          {/* Close button */}
          <button onClick={onClose} className="w-7 h-7 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors border-none bg-transparent cursor-pointer shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Info rows */}
        <div className="px-4 py-3 space-y-2 border-b border-slate-100">
          {/* Sana va vaqt */}
          <div className="flex items-center gap-2.5">
            <Calendar className="w-3.5 h-3.5 text-[#1499AD] shrink-0" />
            <span className="text-[12px] font-semibold text-slate-700">
              {formatDate(a.date)}
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <Clock className="w-3.5 h-3.5 text-[#1499AD] shrink-0" />
            <span className="text-[13px] font-black text-slate-900">
              {a.time} — {endTime}
            </span>
            {a.is_paid && (
              <span className="ml-auto text-[11px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                {t('common.paid') || "To'langan"}
              </span>
            )}
          </div>
          {/* Doktor */}
          {a.doctor_name && (
            <div className="flex items-center gap-2.5">
              <Stethoscope className="w-3.5 h-3.5 text-[#1499AD] shrink-0" />
              <span className="text-[12px] font-semibold text-slate-700">{a.doctor_name}</span>
            </div>
          )}
          {/* Xizmat */}
          {a.service_name && (
            <div className="flex items-center gap-2.5">
              <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="text-[12px] text-slate-600 font-medium truncate">
                {a.tooth_number ? `${a.tooth_number}-tish: ` : ''}{a.service_name}
              </span>
            </div>
          )}
          {/* Yosh */}
          {age !== null && (
            <div className="flex items-center gap-2.5">
              <UserCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="text-[12px] text-slate-500 font-medium">{t('patientProfile.age', { age }) || `${age} yosh`}</span>
            </div>
          )}
          {/* Izoh */}
          {a.notes && (
            <div className="flex items-start gap-2.5 bg-amber-50 rounded-lg px-2.5 py-1.5">
              <span className="text-[11px] text-amber-700 font-medium leading-relaxed">{a.notes}</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="px-4 py-3 flex gap-2">
          {/* Tahrirlash — edit modal ochadi */}
          <button
            onClick={() => { onClose(); onEdit && onEdit(a); }}
            className="flex-1 h-9 bg-slate-900 hover:bg-slate-700 text-white text-[11px] font-black rounded-xl flex items-center justify-center gap-1.5 border-none cursor-pointer transition-all active:scale-95"
          >
            <Edit3 className="w-3.5 h-3.5" />
            {t('appointments.actionEdit') || 'Tahrirlash'}
          </button>
          {/* To'lov sahifasiga o'tadi */}
          <button
            onClick={goToPayments}
            className="flex-1 h-9 bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-black rounded-xl flex items-center justify-center gap-1.5 border-none cursor-pointer transition-all active:scale-95"
          >
            <CreditCard className="w-3.5 h-3.5" />
            {t('appointments.actionPayment') || "To'lov"}
          </button>
        </div>

        {/* Bottom tabs — har biri o'z sahifasiga o'tadi */}
        <div className="px-4 pb-3 flex gap-1">
          {/* Navbatlar */}
          <button
            onClick={goToAppointments}
            className="flex-1 flex flex-col items-center gap-0.5 py-1.5 text-slate-500 hover:text-[#1499AD] hover:bg-slate-50 rounded-lg transition-colors border-none bg-transparent cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span className="text-[9px] font-bold">{t('appointments.actionQueue') || "Navbatlar"}</span>
          </button>
          {/* Rejalar */}
          <button
            onClick={goToTreatmentPlans}
            className="flex-1 flex flex-col items-center gap-0.5 py-1.5 text-slate-500 hover:text-[#1499AD] hover:bg-slate-50 rounded-lg transition-colors border-none bg-transparent cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="text-[9px] font-bold">{t('appointments.actionPlans') || "Rejalar"}</span>
          </button>
          {/* Tarix — bemor profiliga o'tadi */}
          <button
            onClick={goToHistory}
            className="flex-1 flex flex-col items-center gap-0.5 py-1.5 text-slate-500 hover:text-[#1499AD] hover:bg-slate-50 rounded-lg transition-colors border-none bg-transparent cursor-pointer"
          >
            <History className="w-3.5 h-3.5" />
            <span className="text-[9px] font-bold">{t('appointments.actionHistory') || "Tarix"}</span>
          </button>
          {/* Hisobot — payments sahifasiga o'tadi */}
          <button
            onClick={goToPayments}
            className="flex-1 flex flex-col items-center gap-0.5 py-1.5 text-slate-500 hover:text-[#1499AD] hover:bg-slate-50 rounded-lg transition-colors border-none bg-transparent cursor-pointer"
          >
            <Receipt className="w-3.5 h-3.5" />
            <span className="text-[9px] font-bold">{t('appointments.actionReport') || "Hisobot"}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function DoctorDayGrid({ 
  appointments = [], 
  doctors = [], 
  onSlotClick, 
  onEditClick,
  viewDate,
  onViewDateChange,
  searchQuery = ''
}) {
  const { t } = useTranslation();
  const gridRef = useRef(null);
  const { sendTest, loadingId } = useTestReminder();

  // Quick View popup state
  const [quickView, setQuickView] = useState(null); // { appointment, rect }

  useEffect(() => {
    if (!quickView) return;

    const handleScroll = () => {
      setQuickView(null);
    };

    const mainEl = document.querySelector('main');
    if (mainEl) {
      mainEl.addEventListener('scroll', handleScroll, { passive: true });
    }

    const gridEl = gridRef.current;
    if (gridEl) {
      gridEl.addEventListener('scroll', handleScroll, { passive: true });
    }
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      if (mainEl) {
        mainEl.removeEventListener('scroll', handleScroll);
      }
      if (gridEl) {
        gridEl.removeEventListener('scroll', handleScroll);
      }
      window.removeEventListener('scroll', handleScroll);
    };
  }, [quickView]);

  // Toast-like notification for test results
  const [testToast, setTestToast] = useState(null);
  useMemo(() => {
    const handler = (e) => {
      const { ok, name, msg } = e.detail;
      setTestToast({ ok, text: ok ? `✅ Test xabari "${name}" ga yuborildi!` : `❌ ${msg}` });
      setTimeout(() => setTestToast(null), 4000);
    };
    window.addEventListener('test-reminder-sent', handler);
    return () => window.removeEventListener('test-reminder-sent', handler);
  }, []);
  
  const selectedDate = viewDate || new Date().toISOString().split('T')[0];

  const gridData = useMemo(() => {
    const data = {};
    doctors.forEach(doc => {
      data[doc.id] = {};
      const docAppts = appointments.filter(a => 
        String(a.doctor_id) === String(doc.id) && 
        String(a.date).split('T')[0] === selectedDate
      );
      docAppts.forEach(a => {
        const timeKey = (a.time || '08:00').slice(0, 5);
        data[doc.id][timeKey] = a;
      });
    });
    return data;
  }, [appointments, doctors, selectedDate]);

  const displayTimeSlots = useMemo(() => {
    return BASE_TIME_SLOTS.filter(time => {
      if (time.endsWith(':00')) return true;
      return doctors.some(doc => !!gridData[doc.id]?.[time]);
    });
  }, [doctors, gridData]);

  const changeDate = (offset) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + offset);
    onViewDateChange?.(d.toISOString().split('T')[0]);
  };

  const handleAppointmentClick = (e, appointment) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setQuickView({ appointment, rect });
  };

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden min-h-[600px] relative">
      {/* Test reminder toast */}
      {testToast && (
        <div className={cn(
          "fixed top-4 right-4 z-[9999] px-4 py-3 rounded-2xl shadow-xl text-sm font-bold transition-all",
          testToast.ok ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
        )}>
          {testToast.text}
        </div>
      )}

      {/* Quick View Popup */}
      {quickView && (
        <AppointmentQuickView
          appointment={quickView.appointment}
          rect={quickView.rect}
          onClose={() => setQuickView(null)}
          onEdit={(appt) => {
            setQuickView(null);
            onEditClick?.(appt);
          }}
        />
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <div 
          className="grid border-b border-slate-300 bg-white sticky top-0 z-30"
          style={{ gridTemplateColumns: `52px repeat(${doctors.length}, minmax(200px, 1fr))` }}
        >
          <div className="flex items-center justify-center border-r border-slate-300 bg-slate-50 text-slate-400">
            <Clock className="w-4 h-4 stroke-[2.5]" />
          </div>
          {doctors.map((doc) => (
            <div key={doc.id} className="p-3 border-r border-slate-300 last:border-0 flex flex-col items-center group relative bg-white overflow-hidden">
              <div className="w-full text-center overflow-x-auto no-scrollbar">
                <h4 className="text-[12px] font-black text-slate-800 tracking-tight leading-none mb-1 uppercase whitespace-nowrap text-center px-1 inline-block">
                  {doc.name}
                </h4>
              </div>
              <p className="text-[8px] font-bold text-[#1499AD] uppercase tracking-widest opacity-60 truncate w-full text-center">
                {doc.specialty || t('staff.roles.doctor')}
              </p>
            </div>
          ))}
        </div>

        <div ref={gridRef} className="flex-1 overflow-y-auto no-scrollbar scroll-smooth bg-white">
          <div 
            className="grid min-w-max"
            style={{ gridTemplateColumns: `52px repeat(${doctors.length}, minmax(200px, 1fr))` }}
          >
            {displayTimeSlots.map((time) => (
              <div key={time} className="contents">
                <div className="h-20 flex items-center justify-center border-r-2 border-b-2 border-slate-200/60 bg-slate-50/80 backdrop-blur-sm text-[10px] font-bold text-slate-500 sticky left-0 z-20 shadow-[1px_0_3px_rgba(0,0,0,0.02)]">
                  {time}
                </div>
                {doctors.map((doc) => {
                  const appointment = gridData[doc.id]?.[time];
                  return (
                    <div
                      key={doc.id}
                      onClick={() => !appointment && onSlotClick?.(selectedDate, time, doc.id)}
                      className={cn(
                        "h-20 border-r-2 border-b-2 border-slate-200/60 p-1 relative transition-colors bg-white",
                        !appointment && "hover:bg-[#1499AD]/5 cursor-pointer"
                      )}
                    >
                      {appointment && (() => {
                        const isMatch = searchQuery && (
                          (appointment.patient_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (appointment.service_name || '').toLowerCase().includes(searchQuery.toLowerCase())
                        );
                        
                        return (
                          <div
                            onClick={(e) => handleAppointmentClick(e, appointment)}
                            className={cn(
                              "h-full w-full rounded-xl border-l-[4px] p-1.5 flex flex-col justify-between shadow-sm transition-all hover:brightness-95 active:scale-[0.98] cursor-pointer group/card relative overflow-hidden",
                              statusColors[appointment.status] || statusColors.Scheduled,
                              isMatch && "ring-2 ring-[#1499AD] ring-offset-1 animate-pulse scale-[1.02] z-10 shadow-lg shadow-[#1499AD]/20"
                            )}
                          >
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-black truncate leading-none uppercase tracking-tight text-slate-900">
                                {appointment.patient_name}
                              </span>
                              <div className="flex items-center gap-0.5 opacity-40 group-hover/card:opacity-100 transition-opacity">
                                {appointment.is_paid ? <Wallet className="w-2.5 h-2.5 text-emerald-600" /> : <Clock className="w-2.5 h-2.5" />}
                              </div>
                            </div>
                            <span className="text-[9px] font-bold opacity-60">
                              {appointment.time} — {(() => {
                                  const [h, m] = appointment.time.split(':').map(Number);
                                  const dur = appointment.duration || 30;
                                  const endMin = h * 60 + m + Number(dur);
                                  return `${String(Math.floor(endMin/60)).padStart(2,'0')}:${String(endMin%60).padStart(2,'0')}`;
                              })()}
                            </span>
                          </div>
                          
                          <div className="flex items-center justify-between mt-1">
                             <div className="flex items-center gap-1 min-w-0 max-w-[78%]">
                               <div className="px-2 py-0.5 bg-white/60 rounded-lg text-[8px] font-black uppercase tracking-tighter truncate max-w-[85%] border border-black/5">
                                   {appointment.tooth_number ? `${appointment.tooth_number}-tish: ` : ''}{appointment.service_name || t('appointments.defaultService') || 'Maslahat'}
                               </div>
                               <AppointmentConfirmationBadge appointment={appointment} size="sm" className="!text-[8px] !px-1.5 !py-0.5" />
                             </div>
                             <div className="flex items-center gap-0.5 shrink-0">
                               {/* Test eslatma tugmasi */}
                               <button
                                 title="Test Telegram eslatma yuborish"
                                 onClick={(e) => sendTest(appointment, e)}
                                 disabled={loadingId === String(appointment._id || appointment.id || '')}
                                 className={cn(
                                   "w-5 h-5 rounded-md flex items-center justify-center transition-all",
                                   "opacity-0 group-hover/card:opacity-100",
                                   "bg-violet-100 hover:bg-violet-500 hover:text-white text-violet-500",
                                   "border border-violet-200 hover:border-violet-500",
                                   loadingId === String(appointment._id || appointment.id || '') && "animate-pulse opacity-100"
                                 )}
                               >
                                 <FlaskConical className="w-2.5 h-2.5" />
                               </button>
                               <CheckCircle2 className="w-3 h-3 opacity-10" />
                             </div>
                          </div>
                        </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
