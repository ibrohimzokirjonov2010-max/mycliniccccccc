import { useState, useMemo, memo } from 'react';
import { useTranslation } from '@/i18n/LanguageContext';
import { 
  Calendar, Plus, Search,
  ArrowUpDown, User, CheckCircle2,
  XCircle, AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * ExcelAppointmentsView Component
 * High-productivity Excel Spreadsheet View for Patient Appointments Registry.
 */
function ExcelAppointmentsView({
  patient,
  appointments = [],
  doctors = [],
  onOpenApptModal,
}) {
  const { t, language } = useTranslation();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'Confirmed' | 'Completed' | 'Cancelled' | 'Pending'
  const [sortField, setSortField] = useState('date');
  const [sortAsc, setSortAsc] = useState(false);
  const [density, setDensity] = useState('compact');

  const filteredAppointments = useMemo(() => {
    let list = [...appointments];

    if (statusFilter !== 'all') {
      list = list.filter(a => {
        const s = a.status || 'Confirmed';
        return s.toLowerCase().includes(statusFilter.toLowerCase());
      });
    }

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(a => 
        (a.doctor_name && a.doctor_name.toLowerCase().includes(q)) ||
        (a.service_name && a.service_name.toLowerCase().includes(q)) ||
        (a.notes && a.notes.toLowerCase().includes(q)) ||
        (a.chair_number && String(a.chair_number).includes(q)) ||
        (a.tooth_number && String(a.tooth_number).includes(q))
      );
    }

    list.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];
      if (sortField === 'date') {
        valA = new Date(a.date || a.appointment_date || a.created_date || 0).getTime();
        valB = new Date(b.date || b.appointment_date || b.created_date || 0).getTime();
      }
      return sortAsc ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
    });

    return list;
  }, [appointments, search, statusFilter, sortField, sortAsc]);

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const getStatusBadge = (status) => {
    const s = (status || '').toLowerCase();
    if (s.includes('complete') || s.includes('tugallandi') || s.includes('завершено')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px]">
          <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
          <span>{t('patientProfile.statusCompleted') || 'Tugallandi'}</span>
        </span>
      );
    }
    if (s.includes('cancel') || s.includes('bekor') || s.includes('отменено')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 font-bold text-[10px]">
          <XCircle className="w-3 h-3 text-rose-600 shrink-0" />
          <span>{t('patientProfile.statusCancelled') || 'Bekor qilindi'}</span>
        </span>
      );
    }
    if (s.includes('noshow') || s.includes('kelmadi') || s.includes('не явился')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-bold text-[10px]">
          <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
          <span>{t('patientProfile.statusNoShow') || 'Kelmadi'}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-bold text-[10px]">
        <Calendar className="w-3 h-3 text-blue-600 shrink-0" />
        <span>{t('patientProfile.statusConfirmed') || 'Tasdiqlangan'}</span>
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* ══ TOOLBAR CONTROLS & FILTERS ══ */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Filter Bar */}
        <div className="p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap flex-1">
            {/* Search Input */}
            <div className="relative min-w-[200px] max-w-sm flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('patientProfile.searchAppts') || "Shifokor, muolaja, xona qidirish..."}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#1a73e8]"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs">✕</button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onOpenApptModal && (
              <button
                onClick={onOpenApptModal}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a73e8] hover:bg-[#1557b0] text-white rounded-lg text-xs font-black shadow-2xs transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ {t('patientProfile.bookApptBtn') || 'Uchrashuv belgilash'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ══ EXCEL SPREADSHEET TABLE ══ */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full border-collapse text-left font-sans text-sm">
            <thead>
              <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-xs">
                <th className="py-3 px-3.5 border-r border-slate-200 text-center w-12 bg-slate-200/60 font-mono">№</th>
                <th 
                  className="py-3 px-3.5 border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors font-mono select-none"
                  onClick={() => toggleSort('date')}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span>{t('patientProfile.dateTimeCol') || 'Sana & Vaqt'}</span>
                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-3.5 border-r border-slate-200 min-w-[150px]">{t('patientProfile.doctorCol') || 'Shifokor'}</th>
                <th className="py-3 px-3.5 border-r border-slate-200 font-mono text-center">{t('patientProfile.chairCol') || 'Kreslo / Xona'}</th>
                <th className="py-3 px-3.5 border-r border-slate-200 font-mono text-center w-16">{t('patientProfile.toothCol') || 'Tish #'}</th>
                <th className="py-3 px-3.5 border-r border-slate-200 min-w-[180px]">{t('patientProfile.plannedTreatmentCol') || 'Rejalashtirilgan Muolaja'}</th>
                <th className="py-3 px-3.5 border-r border-slate-200 font-mono text-center min-w-[90px]">{t('patientProfile.durationCol') || 'Davomiyligi'}</th>
                <th className="py-3 px-3.5 border-r border-slate-200 text-center min-w-[110px]">{t('patientProfile.statusCol') || 'Holati'}</th>
                <th className="py-3 px-3.5 min-w-[140px]">{t('patientProfile.notesCol') || 'Eslatma'}</th>
              </tr>
            </thead>
            <tbody>
              {filteredAppointments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 italic bg-slate-50/50">
                    <Calendar className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    {t('patientProfile.noApptsFound') || 'Uchrashuvlar topilmadi.'}
                  </td>
                </tr>
              ) : (
                filteredAppointments.map((appt, idx) => {
                  const d = appt.date || appt.appointment_date || appt.created_date;
                  const dateObj = d ? new Date(d) : null;
                  const locale = language === 'ru' ? 'ru-RU' : language === 'en' ? 'en-US' : 'uz-UZ';
                  const dateFormatted = dateObj ? dateObj.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
                  const timeFormatted = appt.time ? `${appt.time} - ${appt.end_time || ''}` : (dateObj ? dateObj.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : '—');
                  const docName = appt.doctor_name || (doctors.find(doc => doc.id === appt.doctor_id)?.full_name) || patient?.doctor_name || (t('patientProfile.doctorCol') || 'Shifokor');
                  const chairText = appt.chair_number ? (language === 'ru' ? `Кресло #${appt.chair_number}` : language === 'en' ? `Chair #${appt.chair_number}` : `Kreslo #${appt.chair_number}`) : (language === 'ru' ? 'Кресло #1' : language === 'en' ? 'Chair #1' : 'Kreslo #1');

                  return (
                    <tr
                      key={appt.id || idx}
                      className={cn(
                        "border-b border-slate-200/70 hover:bg-sky-50/40 transition-colors",
                        idx % 2 === 1 ? "bg-slate-50/40" : "bg-white"
                      )}
                    >
                      {/* Row Index */}
                      <td className={cn(
                        "border-r border-slate-200 text-center font-mono font-bold text-slate-500 bg-slate-100/40 text-xs",
                        density === 'compact' ? 'py-3.5 px-3' : 'py-4.5 px-3.5'
                      )}>
                        {idx + 1}
                      </td>

                      {/* Date & Time */}
                      <td className={cn("border-r border-slate-200 font-mono text-slate-700 whitespace-nowrap text-xs sm:text-sm", density === 'compact' ? 'py-3.5 px-3.5' : 'py-4.5 px-4')}>
                        <span className="font-bold text-slate-900">{dateFormatted}</span> <span className="text-slate-500 font-medium text-xs">({timeFormatted})</span>
                      </td>

                      {/* Doctor */}
                      <td className={cn("border-r border-slate-200 font-semibold text-slate-800 text-xs sm:text-sm", density === 'compact' ? 'py-3.5 px-3.5' : 'py-4.5 px-4')}>
                        <div className="flex items-center gap-1.5">
                          <User className="w-4 h-4 text-slate-400 shrink-0" />
                          <span>{docName}</span>
                        </div>
                      </td>

                      {/* Chair */}
                      <td className={cn("border-r border-slate-200 font-mono text-slate-700 font-medium text-center text-xs sm:text-sm", density === 'compact' ? 'py-3.5 px-3.5' : 'py-4.5 px-4')}>
                        {chairText}
                      </td>

                      {/* Tooth # */}
                      <td className={cn("border-r border-slate-200 font-mono font-black text-center text-indigo-700 bg-indigo-50/40 text-sm", density === 'compact' ? 'py-3.5 px-3' : 'py-4.5 px-3.5')}>
                        {appt.tooth_number ? `#${appt.tooth_number}` : '—'}
                      </td>

                      {/* Service / Reason */}
                      <td className={cn("border-r border-slate-200 font-bold text-slate-900 text-sm", density === 'compact' ? 'py-3.5 px-3.5' : 'py-4.5 px-4')}>
                        {appt.service_name || appt.reason || (t('patientProfile.plannedTreatmentCol') || 'Davolash muolajasi')}
                      </td>

                      {/* Duration */}
                      <td className={cn("border-r border-slate-200 font-mono text-center text-slate-700 font-bold text-xs sm:text-sm", density === 'compact' ? 'py-3.5 px-3.5' : 'py-4.5 px-4')}>
                        {appt.duration || 30} {t('common.minuteAbbr') || 'daq'}
                      </td>

                      {/* Status */}
                      <td className={cn("border-r border-slate-200 text-center", density === 'compact' ? 'py-3 px-3' : 'py-4 px-3.5')}>
                        {getStatusBadge(appt.status)}
                      </td>

                      {/* Notes */}
                      <td className={cn("text-slate-600 italic text-xs sm:text-sm", density === 'compact' ? 'py-3.5 px-3.5' : 'py-4.5 px-4')}>
                        {appt.notes || '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default memo(ExcelAppointmentsView);
