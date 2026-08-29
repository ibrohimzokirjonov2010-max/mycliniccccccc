import { useState, useMemo, memo } from 'react';
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
    if (s.includes('complete') || s.includes('tugallandi')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px]">
          <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
          <span>Tugallandi</span>
        </span>
      );
    }
    if (s.includes('cancel') || s.includes('bekor')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 font-bold text-[10px]">
          <XCircle className="w-3 h-3 text-rose-600 shrink-0" />
          <span>Bekor qilindi</span>
        </span>
      );
    }
    if (s.includes('noshow') || s.includes('kelmadi')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-bold text-[10px]">
          <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
          <span>Kelmadi</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-bold text-[10px]">
        <Calendar className="w-3 h-3 text-blue-600 shrink-0" />
        <span>Tasdiqlangan</span>
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* ══ EXCEL SPREADSHEET TOOLBAR ══ */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Formula Bar */}
        <div className="bg-slate-50/90 px-4 py-2 border-b border-slate-200 flex items-center gap-3 text-xs font-mono">
          <div className="flex items-center gap-1.5 text-slate-400 font-black shrink-0">
            <span className="text-[#1a73e8] italic font-serif text-sm">fx</span>
            <span>=</span>
          </div>
          <div className="flex items-center gap-4 flex-wrap text-slate-700 overflow-x-auto no-scrollbar">
            <span>JAMI QABULLAR: <b className="text-slate-900 font-black">{appointments.length} ta</b></span>
            <span className="text-slate-300">|</span>
            <span>TUGALLANGAN: <b className="text-emerald-700 font-black">{appointments.filter(a => (a.status || '').toLowerCase().includes('complete')).length} ta</b></span>
            <span className="text-slate-300">|</span>
            <span>KUTILMOQDA: <b className="text-blue-700 font-black">{appointments.filter(a => !(a.status || '').toLowerCase().includes('complete') && !(a.status || '').toLowerCase().includes('cancel')).length} ta</b></span>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap flex-1">
            {/* Search Input */}
            <div className="relative min-w-[200px] max-w-xs flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Shifokor, muolaja, xona qidirish..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#1a73e8]"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs">✕</button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="inline-flex p-0.5 bg-slate-100 rounded-lg border border-slate-200/60 gap-0.5">
              {[
                { id: 'all', label: 'Barchasi' },
                { id: 'Confirmed', label: 'Tasdiqlangan' },
                { id: 'Completed', label: 'Tugallangan' },
                { id: 'Cancelled', label: 'Bekor qilingan' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setStatusFilter(f.id)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer",
                    statusFilter === f.id
                      ? "bg-white text-slate-900 shadow-2xs border border-slate-200/60 font-black"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setDensity(d => d === 'compact' ? 'normal' : 'compact')}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              {density === 'compact' ? '☷ Ixcham' : '☰ Keng'}
            </button>

            {onOpenApptModal && (
              <button
                onClick={onOpenApptModal}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a73e8] hover:bg-[#1557b0] text-white rounded-lg text-xs font-black shadow-2xs transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Uchrashuv Belgilash</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ══ EXCEL SPREADSHEET TABLE ══ */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full border-collapse text-left font-sans text-xs">
            <thead>
              <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10.5px]">
                <th className="py-2.5 px-3 border-r border-slate-200 text-center w-12 bg-slate-200/60 font-mono">№</th>
                <th 
                  className="py-2.5 px-3 border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors font-mono select-none"
                  onClick={() => toggleSort('date')}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span>Sana & Vaqt</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-2.5 px-3 border-r border-slate-200 min-w-[150px]">Shifokor</th>
                <th className="py-2.5 px-3 border-r border-slate-200 font-mono text-center">Kreslo / Xona</th>
                <th className="py-2.5 px-3 border-r border-slate-200 font-mono text-center w-16">Tish #</th>
                <th className="py-2.5 px-3 border-r border-slate-200 min-w-[180px]">Rejalashtirilgan Muolaja</th>
                <th className="py-2.5 px-3 border-r border-slate-200 font-mono text-center min-w-[90px]">Davomiyligi</th>
                <th className="py-2.5 px-3 border-r border-slate-200 text-center min-w-[110px]">Holati</th>
                <th className="py-2.5 px-3 min-w-[140px]">Eslatma</th>
              </tr>
            </thead>
            <tbody>
              {filteredAppointments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 italic bg-slate-50/50">
                    <Calendar className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    Uchrashuvlar topilmadi.
                  </td>
                </tr>
              ) : (
                filteredAppointments.map((appt, idx) => {
                  const d = appt.date || appt.appointment_date || appt.created_date;
                  const dateObj = d ? new Date(d) : null;
                  const dateFormatted = dateObj ? dateObj.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
                  const timeFormatted = appt.time ? `${appt.time} - ${appt.end_time || ''}` : (dateObj ? dateObj.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }) : '—');
                  const docName = appt.doctor_name || (doctors.find(doc => doc.id === appt.doctor_id)?.full_name) || patient?.doctor_name || 'Shifokor';

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
                        "border-r border-slate-200 text-center font-mono font-bold text-slate-400 bg-slate-100/40 text-[11px]",
                        density === 'compact' ? 'py-2 px-2' : 'py-3 px-3'
                      )}>
                        {idx + 1}
                      </td>

                      {/* Date & Time */}
                      <td className={cn("border-r border-slate-200 font-mono text-slate-700 whitespace-nowrap", density === 'compact' ? 'py-2 px-3' : 'py-3 px-3')}>
                        <span className="font-bold">{dateFormatted}</span> <span className="text-slate-400 text-[11px]">({timeFormatted})</span>
                      </td>

                      {/* Doctor */}
                      <td className={cn("border-r border-slate-200 font-medium text-slate-800", density === 'compact' ? 'py-2 px-3' : 'py-3 px-3')}>
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{docName}</span>
                        </div>
                      </td>

                      {/* Chair */}
                      <td className={cn("border-r border-slate-200 font-mono text-slate-600 text-center", density === 'compact' ? 'py-2 px-3' : 'py-3 px-3')}>
                        {appt.chair_number ? `Kreslo #${appt.chair_number}` : 'Kreslo #1'}
                      </td>

                      {/* Tooth # */}
                      <td className={cn("border-r border-slate-200 font-mono font-black text-center text-indigo-700 bg-indigo-50/30", density === 'compact' ? 'py-2 px-2' : 'py-3 px-2')}>
                        {appt.tooth_number ? `#${appt.tooth_number}` : '—'}
                      </td>

                      {/* Service / Reason */}
                      <td className={cn("border-r border-slate-200 font-bold text-slate-900", density === 'compact' ? 'py-2 px-3' : 'py-3 px-3')}>
                        {appt.service_name || appt.reason || 'Davolash muolajasi'}
                      </td>

                      {/* Duration */}
                      <td className={cn("border-r border-slate-200 font-mono text-center text-slate-600", density === 'compact' ? 'py-2 px-2' : 'py-3 px-2')}>
                        {appt.duration || 30} daq
                      </td>

                      {/* Status */}
                      <td className={cn("border-r border-slate-200 text-center", density === 'compact' ? 'py-2 px-2' : 'py-3 px-2')}>
                        {getStatusBadge(appt.status)}
                      </td>

                      {/* Notes */}
                      <td className={cn("text-slate-500 italic text-[11px]", density === 'compact' ? 'py-2 px-3' : 'py-3 px-3')}>
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
