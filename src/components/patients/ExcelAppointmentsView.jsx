import { useState, useMemo, memo } from 'react';
import { useTranslation } from '@/i18n/LanguageContext';
import { 
  Calendar, Plus, Search,
  ArrowUpDown, User, CheckCircle2,
  XCircle, AlertTriangle, Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import EmptyState from '../ui/EmptyState';

function ExcelAppointmentsView({
  patient,
  appointments = [],
  doctors = [],
  onOpenApptModal,
}) {
  const { t, language } = useTranslation();
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('date');
  const [sortAsc, setSortAsc] = useState(false);

  const filteredAppointments = useMemo(() => {
    let list = [...appointments];

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
  }, [appointments, search, sortField, sortAsc]);

  const getStatusBadge = (status) => {
    const s = (status || '').toLowerCase();
    if (s.includes('complete') || s.includes('tugallandi') || s.includes('завершено')) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[8.5px] uppercase tracking-wide whitespace-nowrap">
          <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />
          {t('patientProfile.statusCompleted') || 'Tugallandi'}
        </span>
      );
    }
    if (s.includes('cancel') || s.includes('bekor') || s.includes('отменено')) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-bold text-[8.5px] uppercase tracking-wide whitespace-nowrap">
          <XCircle className="w-2.5 h-2.5 shrink-0" />
          {t('patientProfile.statusCancelled') || 'Bekor'}
        </span>
      );
    }
    if (s.includes('noshow') || s.includes('kelmadi') || s.includes('не явился')) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-bold text-[8.5px] uppercase tracking-wide whitespace-nowrap">
          <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
          Kelmadi
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-bold text-[8.5px] uppercase tracking-wide whitespace-nowrap">
        <Calendar className="w-2.5 h-2.5 shrink-0" />
        {t('patientProfile.statusConfirmed') || 'Tasdiqlangan'}
      </span>
    );
  };

  return (
    <div className="space-y-3">

      {/* ── TOOLBAR ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('patientProfile.searchAppts') || "Shifokor, muolaja qidirish..."}
            className="w-full pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1499AD]/30 focus:border-[#1499AD] transition-all"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 w-5 h-5 flex items-center justify-center rounded-full hover:bg-slate-100 text-xs transition-all">✕</button>
          )}
        </div>
        {onOpenApptModal && (
          <button
            onClick={onOpenApptModal}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-700 text-white rounded-xl text-sm font-black shadow-sm transition-all active:scale-95 whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            {t('patientProfile.bookApptBtn') || 'Uchrashuv belgilash'}
          </button>
        )}
      </div>

      {/* ── MOBILE CARDS ── */}
      <div className="md:hidden space-y-2.5">
        {filteredAppointments.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 py-14 text-center flex flex-col items-center gap-2">
            <Calendar className="w-10 h-10 text-slate-200" />
            <p className="text-slate-400 text-sm font-semibold">
              {t('patientProfile.noApptsFound') || "Uchrashuvlar topilmadi"}
            </p>
            <p className="text-slate-300 text-xs">Yuqoridagi tugmadan yangi qabul belgilang</p>
          </div>
        ) : (
          filteredAppointments.map((appt, idx) => {
            const d = appt.date || appt.appointment_date || appt.created_date;
            const dateObj = d ? new Date(d) : null;
            const locale = language === 'ru' ? 'ru-RU' : language === 'en' ? 'en-US' : 'uz-UZ';
            const dateFormatted = dateObj ? dateObj.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
            const timeFormatted = appt.time || (dateObj ? dateObj.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : '');
            const docName = appt.doctor_name || (doctors.find(doc => doc.id === appt.doctor_id)?.full_name) || patient?.doctor_name || 'Shifokor';
            const chairText = appt.chair_number ? `Kreslo #${appt.chair_number}` : 'Kreslo #1';
            const serviceName = appt.service_name || appt.reason || 'Davolash muolajasi';

            return (
              <div key={appt.id || idx} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {/* Card top */}
                <div className="p-3.5 flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex flex-col items-center justify-center shrink-0">
                    <Calendar className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-black text-slate-900 line-clamp-2 leading-tight">{serviceName}</p>
                    <p className="text-[11px] font-bold text-slate-500 mt-0.5">{dateFormatted} {timeFormatted && `· ${timeFormatted}`}</p>
                  </div>
                  {getStatusBadge(appt.status)}
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-3 gap-px bg-slate-100 border-t border-slate-100">
                  <div className="bg-white px-3 py-2.5">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Shifokor</p>
                    <p className="text-[11px] font-bold text-slate-700 mt-0.5 leading-none truncate">{docName}</p>
                  </div>
                  <div className="bg-white px-3 py-2.5">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Kreslo</p>
                    <p className="text-[11px] font-bold text-slate-700 mt-0.5 leading-none">{chairText}</p>
                  </div>
                  <div className="bg-white px-3 py-2.5">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Tish #</p>
                    <p className="text-[11px] font-bold text-indigo-700 mt-0.5 leading-none">
                      {appt.tooth_number ? `#${appt.tooth_number}` : '—'}
                    </p>
                  </div>
                </div>

                {/* Notes */}
                {appt.notes && (
                  <div className="px-3.5 py-2 bg-amber-50/40 border-t border-amber-100">
                    <p className="text-[10px] font-semibold text-amber-800 italic leading-relaxed line-clamp-2">💬 {appt.notes}</p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ── DESKTOP TABLE ── */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-black uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-2 border-r border-slate-100 w-8 min-w-[28px] text-center">№</th>
                <th
                  className="py-2.5 px-2 border-r border-slate-100 cursor-pointer hover:bg-slate-100 select-none w-28 min-w-[95px]"
                  onClick={() => { setSortField('date'); setSortAsc(sortField === 'date' ? !sortAsc : false); }}
                >
                  <div className="flex items-center gap-1">
                    <span>{t('patientProfile.dateTimeCol') || 'Sana & Vaqt'}</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400 shrink-0" />
                  </div>
                </th>
                <th className="py-2.5 px-2 border-r border-slate-100 min-w-[85px] max-w-[120px]">{t('patientProfile.doctorCol') || 'Shifokor'}</th>
                <th className="py-2.5 px-1 border-r border-slate-100 text-center w-14 min-w-[46px]">{t('patientProfile.chairCol') || 'Kreslo'}</th>
                <th className="py-2.5 px-1 border-r border-slate-100 text-center w-12 min-w-[40px]">Tish #</th>
                <th className="py-2.5 px-2 border-r border-slate-100 min-w-[110px] max-w-[160px]">{t('patientProfile.plannedTreatmentCol') || 'Muolaja'}</th>
                <th className="py-2.5 px-1 border-r border-slate-100 text-center w-16 min-w-[52px]">{t('common.duration') || 'Davom.'}</th>
                <th className="py-2.5 px-1.5 border-r border-slate-100 text-center w-24 min-w-[80px]">{t('common.status') || 'Holati'}</th>
                <th className="py-2.5 px-2 min-w-[70px] max-w-[120px]">{t('patientProfile.notesCol') || 'Eslatma'}</th>
              </tr>
            </thead>
            <tbody>
              {filteredAppointments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-14 text-center">
                    <Calendar className="w-8 h-8 mx-auto mb-2 text-slate-200" />
                    <p className="text-slate-400 text-sm font-semibold">
                      {t('patientProfile.noApptsFound') || "Uchrashuvlar topilmadi"}
                    </p>
                    {onOpenApptModal && (
                      <button onClick={onOpenApptModal} className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-black active:scale-95 transition-all">
                        <Plus className="w-4 h-4" />Yangi uchrashuv
                      </button>
                    )}
                  </td>
                </tr>
              ) : filteredAppointments.map((appt, idx) => {
                const d = appt.date || appt.appointment_date || appt.created_date;
                const dateObj = d ? new Date(d) : null;
                const locale = language === 'ru' ? 'ru-RU' : language === 'en' ? 'en-US' : 'uz-UZ';
                const dateFormatted = dateObj && !isNaN(dateObj.getTime())
                  ? `${String(dateObj.getDate()).padStart(2, '0')}.${String(dateObj.getMonth() + 1).padStart(2, '0')}.${dateObj.getFullYear()}`
                  : (d ? String(d).slice(0, 10) : '—');
                const timeFormatted = appt.time ? appt.time : (dateObj && !isNaN(dateObj.getTime()) ? `${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}` : '');
                const docName = appt.doctor_name || (doctors.find(doc => doc.id === appt.doctor_id)?.full_name) || patient?.doctor_name || 'Shifokor';
                const chairText = appt.chair_number ? `#${appt.chair_number}` : '#1';

                return (
                  <tr key={appt.id || idx} className={cn("border-b border-slate-100 hover:bg-sky-50/30 transition-colors", idx % 2 === 1 && "bg-slate-50/30")}>
                    <td className="py-2 px-1 text-center font-mono text-[11px] text-slate-400 border-r border-slate-100">{idx + 1}</td>
                    <td className="py-2 px-2 font-mono text-slate-800 whitespace-nowrap text-xs border-r border-slate-100">
                      <div className="flex flex-col leading-tight">
                        <span className="font-bold text-slate-800 text-xs">{dateFormatted}</span>
                        {timeFormatted && <span className="text-[10px] text-slate-500 font-semibold">{timeFormatted}</span>}
                      </div>
                    </td>
                    <td className="py-2 px-2 border-r border-slate-100">
                      <div className="flex items-center gap-1.5 min-w-0 max-w-[120px]" title={docName}>
                        <User className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                        <span className="text-xs font-medium text-slate-700 truncate">{docName}</span>
                      </div>
                    </td>
                    <td className="py-2 px-1 text-center font-mono text-xs text-slate-600 border-r border-slate-100 whitespace-nowrap">
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10.5px] font-bold text-slate-600 border border-slate-200/60">
                        {chairText}
                      </span>
                    </td>
                    <td className="py-2 px-1 text-center border-r border-slate-100">
                      {appt.tooth_number ? (
                        <span className="inline-flex items-center justify-center font-mono font-black text-indigo-600 text-xs bg-indigo-50/70 px-1.5 py-0.5 rounded border border-indigo-100">
                          #{appt.tooth_number}
                        </span>
                      ) : (
                        <span className="text-slate-300 font-mono text-xs">—</span>
                      )}
                    </td>
                    <td className="py-2 px-2 font-bold text-slate-900 border-r border-slate-100">
                      <p className="text-xs leading-snug line-clamp-2" title={appt.service_name || appt.reason || 'Davolash muolajasi'}>
                        {appt.service_name || appt.reason || 'Davolash muolajasi'}
                      </p>
                    </td>
                    <td className="py-2 px-1 text-center font-mono text-xs text-slate-700 border-r border-slate-100 whitespace-nowrap">
                      <span className="font-bold">{appt.duration || 30}</span> <span className="text-[9.5px] text-slate-400">daq</span>
                    </td>
                    <td className="py-2 px-1 text-center border-r border-slate-100 whitespace-nowrap">
                      {getStatusBadge(appt.status)}
                    </td>
                    <td className="py-2 px-2 text-slate-500 italic text-xs">
                      <p className="truncate max-w-[120px]" title={appt.notes || ''}>
                        {appt.notes || '—'}
                      </p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

export default memo(ExcelAppointmentsView);
