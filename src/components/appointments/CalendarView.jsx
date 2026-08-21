import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/LanguageContext';
import { cn } from '@/lib/utils';
import { AppointmentQuickView } from './DoctorDayGrid';

const timeSlots = Array.from({ length: 16 }, (_, i) => {
  const h = 8 + i; // 08:00 - 23:00
  return `${String(h).padStart(2, '0')}:00`;
});

const statusStyles = {
  Scheduled: { bg: 'bg-blue-50', border: 'border-blue-200', pill: 'bg-[#1499AD]', text: 'text-[#1499AD]' },
  Waiting: { bg: 'bg-amber-50', border: 'border-amber-200', pill: 'bg-amber-500', text: 'text-amber-700' },
  'In Progress': { bg: 'bg-emerald-50', border: 'border-emerald-200', pill: 'bg-emerald-500', text: 'text-emerald-700' },
  Pending: { bg: 'bg-orange-50', border: 'border-orange-200', pill: 'bg-orange-500', text: 'text-orange-700' },
  Completed: { bg: 'bg-slate-50', border: 'border-slate-200', pill: 'bg-slate-400', text: 'text-slate-600' },
  Cancelled: { bg: 'bg-rose-50', border: 'border-rose-200', pill: 'bg-rose-500', text: 'text-rose-700' },
  'No-Show': { bg: 'bg-slate-50', border: 'border-slate-200', pill: 'bg-slate-300', text: 'text-slate-500' }
};

/**
 * Premium Calendar View
 */
export default function CalendarView({ appointments = [], onSlotClick, onEditClick, currentDate: propDate, onDateChange }) {
  const { t } = useTranslation();
  
  // Use prop if available, otherwise fallback to today
  const currentDate = propDate || new Date();
  
  const gridRef = useRef(null);

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

  const handleAppointmentClick = (e, appointment) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setQuickView({ appointment, rect });
  };

  // Month and Day names with safety fallbacks
  const months = useMemo(() => {
    const m = t('common.months', { returnObjects: true });
    return Array.isArray(m) ? m : ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'];
  }, [t]);

  const daysShort = useMemo(() => {
    const d = t('common.days', { returnObjects: true });
    return Array.isArray(d) ? d : ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sha', 'Ya'];
  }, [t]);

  useEffect(() => { if (gridRef.current) gridRef.current.scrollTop = 100; }, []);

  const weekDays = useMemo(() => {
    const s = new Date(currentDate);
    const day = s.getDay();
    // Adjust to start from Monday
    s.setDate(s.getDate() - day + (day === 0 ? -6 : 1));
    s.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(s);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [currentDate]);

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const apptsByDate = useMemo(() => {
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
    const map = {};
    (appointments || []).forEach(a => {
      const dStr = normalize(a.date);
      if (!map[dStr]) map[dStr] = [];
      map[dStr].push(a);
    });
    return map;
  }, [appointments]);

  const getSlotAppointments = useCallback((date, time) => {
    // Robust local date formatting (YYYY-MM-DD) to avoid timezone shifts
    const dStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const dayAppts = apptsByDate[dStr] || [];
    const [h, m] = time.split(':').map(Number);
    const slotStart = h * 60 + m;

    return dayAppts.filter(a => {
      if (a.status === 'Cancelled') return false;
      const [ah, am] = (a.time || '00:00').split(':').map(Number);
      const aStart = ah * 60 + am;
      const aDuration = parseInt(a.duration) || 60;
      const aEnd = aStart + aDuration;
      // Show appointment in all slots it occupies
      return (aStart >= slotStart && aStart < slotStart + 60) || (aStart < slotStart && aEnd > slotStart);
    });
  }, [apptsByDate]);

  return (
    <div className="bg-white flex flex-col overflow-hidden" style={{height: 'calc(100vh - 200px)', minHeight: '500px'}}>
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Week Day Titles */}
        <div className="grid grid-cols-[52px_repeat(7,1fr)] bg-white border-b border-slate-300">
          <div className="flex items-center justify-center border-r border-slate-300">
            <Clock className="w-3 h-3 text-[#1499AD] opacity-40" />
          </div>
          {weekDays.map((day, idx) => {
            const dStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
            const isToday = dStr === todayStr;
            return (
              <div key={idx} className={cn("py-1.5 text-center border-r border-slate-300 last:border-0", isToday && "bg-blue-50/30")}>
                <span className={cn("text-[9px] font-black uppercase tracking-[0.1em]", isToday ? "text-[#1499AD]" : "text-slate-400")}>
                  {daysShort[idx]}
                </span>
                <p className={cn("text-[15px] font-black leading-tight tracking-tighter mt-0.5", isToday ? "text-[#1499AD]" : "text-slate-900")}>
                  {day.getDate()}
                </p>
                {isToday && <div className="w-1.5 h-1.5 rounded-full bg-[#1499AD] mx-auto mt-0.5" />}
              </div>
            );
          })}
        </div>

        {/* Time Grid Scrollable Area */}
        <div ref={gridRef} className="flex-1 overflow-y-auto no-scrollbar bg-slate-50/10">
          <div className="grid grid-cols-[52px_repeat(7,1fr)]">
            {timeSlots.map(time => (
              <div key={time} className="contents group">
                <div className="py-2.5 px-2 text-[9px] font-black text-slate-500 border-r border-b border-slate-300 bg-white text-right tracking-tight whitespace-nowrap leading-none transition-colors group-hover:bg-slate-50">
                  {time}
                </div>
                {weekDays.map((day, dIdx) => {
                  const dStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
                  const appts = getSlotAppointments(day, time);
                  const isToday = dStr === todayStr;
                  const isEmpty = appts.length === 0;

                  return (
                    <div
                      key={dIdx}
                      onClick={() => isEmpty && onSlotClick && onSlotClick(dStr, time)}
                      className={cn(
                        "min-h-[52px] border-r border-b border-slate-300 transition-all relative",
                        isEmpty && "hover:bg-slate-100/50 cursor-pointer",
                        isToday && "bg-blue-50/20"
                      )}
                    >
                      {appts.map(a => {
                        const isStart = a.time === time;
                        const style = statusStyles[a.status] || statusStyles.Scheduled;
                        return (
                          <div
                            key={a.id}
                            onClick={(e) => handleAppointmentClick(e, a)}
                            className={cn(
                              "absolute inset-x-0.5 inset-y-0.5 rounded-lg border flex flex-col shadow-sm transition-all active:scale-[0.98] cursor-pointer overflow-hidden z-20",
                              isStart ? `bg-white ${style.border}` : "bg-slate-50/80 border-slate-100 opacity-30 shadow-none pointer-events-none"
                            )}
                          >
                            {isStart && (
                              <>
                                <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-l-lg", style.pill)} />
                                <div className="pl-2.5 pr-1.5 pt-1 pb-1 flex flex-col gap-0.5">
                                  <div className="flex items-center justify-between">
                                    <h4 className="text-[11px] font-[800] text-slate-900 leading-tight truncate flex-1 mr-1">{a.patient_name}</h4>
                                    <div className={cn("shrink-0 w-1.5 h-1.5 rounded-full", style.pill)} />
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Clock className="w-2 h-2 text-slate-300" />
                                    <span className={cn("text-[9px] font-bold", style.text)}>{a.time}</span>
                                    {a.service_name && (
                                      <span className="text-[8px] text-slate-400 truncate ml-0.5">· {a.tooth_number ? `${a.tooth_number}-tish: ` : ''}{a.service_name}</span>
                                    )}
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend & Footer */}
      <div className="px-4 py-2 border-t border-slate-100 flex items-center justify-between bg-white">
        <div className="flex items-center gap-3 flex-wrap">
          {Object.entries(statusStyles).map(([status, style]) => (
            <div key={status} className="flex items-center gap-1">
              <div className={cn("w-1.5 h-1.5 rounded-full", style.pill)} />
              <span className="text-[8px] font-bold text-slate-400 tracking-wide">
                {t(`status.${status}`) !== `status.${status}` ? t(`status.${status}`) : status}
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1 text-slate-300">
          <AlertCircle className="w-2.5 h-2.5" />
          <span className="text-[8px] font-medium italic">Vaqt ustiga bosib navbat qo'shing</span>
        </div>
      </div>

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
    </div>
  );
}
