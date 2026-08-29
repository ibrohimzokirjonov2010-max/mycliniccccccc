import { useState, useMemo, memo } from 'react';
import { 
  Search, ExternalLink, User, CheckCircle2,
  XCircle, Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { ImplantIcon } from '@/components/ui/Icons';

/**
 * ExcelImplantsView Component
 * High-productivity Excel Spreadsheet View for Patient Dental Implants Registry & Surgery Passport.
 */
function ExcelImplantsView({
  patient: _patient,
  implants = [],
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'Tugallangan' | 'Jarayonda' | 'Rejalashtirilgan'
  const [density, setDensity] = useState('compact');

  const filteredImplants = useMemo(() => {
    let list = [...implants];

    if (statusFilter !== 'all') {
      list = list.filter(imp => {
        const s = imp.lifecycle_status || imp.status || 'Rejalashtirilgan';
        return s.toLowerCase().includes(statusFilter.toLowerCase());
      });
    }

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(imp => 
        (imp.firma && imp.firma.toLowerCase().includes(q)) ||
        (imp.brend && imp.brend.toLowerCase().includes(q)) ||
        (imp.doctor && imp.doctor.toLowerCase().includes(q)) ||
        (imp.lot_number && String(imp.lot_number).includes(q)) ||
        (imp.tooth_number && String(imp.tooth_number).includes(q))
      );
    }

    return list;
  }, [implants, search, statusFilter]);

  const getStatusBadge = (status) => {
    const s = (status || '').toLowerCase();
    if (s.includes('tugallangan') || s.includes('done') || s.includes('complete')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px]">
          <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
          <span>Tugallangan</span>
        </span>
      );
    }
    if (s.includes('fail') || s.includes('rad')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 font-bold text-[10px]">
          <XCircle className="w-3 h-3 text-rose-600 shrink-0" />
          <span>Rad etildi</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-bold text-[10px]">
        <Clock className="w-3 h-3 text-blue-600 shrink-0" />
        <span>Integratsiyada</span>
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
            <span>JAMI IMPLANTLAR: <b className="text-slate-900 font-black">{implants.length} ta</b></span>
            <span className="text-slate-300">|</span>
            <span>INTEGRATSIYADA: <b className="text-blue-700 font-black">{implants.filter(i => (i.lifecycle_status || '').includes('Integratsiyada') || !i.lifecycle_status).length} ta</b></span>
            <span className="text-slate-300">|</span>
            <span>TUGALLANGAN: <b className="text-emerald-700 font-black">{implants.filter(i => (i.lifecycle_status || '').includes('Tugallangan')).length} ta</b></span>
          </div>
        </div>

        {/* Action Controls & Filters */}
        <div className="p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap flex-1">
            {/* Search Input */}
            <div className="relative min-w-[200px] max-w-xs flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Brend, tish #, shifokor qidirish..."
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
                { id: 'Integratsiyada', label: 'Integratsiyada' },
                { id: 'Tugallangan', label: 'Tugallangan' },
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

          {/* Right: Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setDensity(d => d === 'compact' ? 'normal' : 'compact')}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              {density === 'compact' ? '☷ Ixcham' : '☰ Keng'}
            </button>
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
                <th className="py-2.5 px-3 border-r border-slate-200 font-mono text-center w-20">Tish FDI</th>
                <th className="py-2.5 px-3 border-r border-slate-200 min-w-[200px]">Implant Brendi / Tizimi</th>
                <th className="py-2.5 px-3 border-r border-slate-200 font-mono text-center min-w-[120px]">O'lchami (Ø × L)</th>
                <th className="py-2.5 px-3 border-r border-slate-200 font-mono text-center min-w-[120px]">Lot / Partiya #</th>
                <th className="py-2.5 px-3 border-r border-slate-200 font-mono min-w-[120px]">O'rnatilgan sana</th>
                <th className="py-2.5 px-3 border-r border-slate-200 min-w-[140px]">Jarroh</th>
                <th className="py-2.5 px-3 border-r border-slate-200 text-center min-w-[110px]">Holati</th>
                <th className="py-2.5 px-3 text-center min-w-[90px]">Pasport</th>
              </tr>
            </thead>
            <tbody>
              {filteredImplants.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 italic bg-slate-50/50">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <ImplantIcon className="w-8 h-8 text-slate-300" />
                      <span>Bu bemor uchun hali implantlar qayd etilmagan.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredImplants.map((imp, idx) => {
                  const dateStr = imp.installed_date || imp.date ? new Date(imp.installed_date || imp.date).toLocaleDateString('uz-UZ') : '—';

                  return (
                    <tr
                      key={imp.id || idx}
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

                      {/* Tooth FDI # */}
                      <td className={cn(
                        "border-r border-slate-200 font-mono font-black text-center text-purple-700 bg-purple-50/30",
                        density === 'compact' ? 'py-2 px-2' : 'py-3 px-2'
                      )}>
                        {imp.tooth_number ? `#${imp.tooth_number}` : '—'}
                      </td>

                      {/* Brand / System */}
                      <td className={cn(
                        "border-r border-slate-200 font-bold text-slate-900",
                        density === 'compact' ? 'py-2 px-3' : 'py-3 px-3'
                      )}>
                        <div className="flex items-center gap-2">
                          <ImplantIcon className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                          <span>{imp.brend || imp.firma || 'Implantat'}</span>
                        </div>
                      </td>

                      {/* Diameter x Length */}
                      <td className={cn(
                        "border-r border-slate-200 font-mono text-center text-slate-700 font-semibold",
                        density === 'compact' ? 'py-2 px-3' : 'py-3 px-3'
                      )}>
                        {imp.diameter && imp.length ? `Ø ${imp.diameter} × ${imp.length} mm` : (imp.size || '—')}
                      </td>

                      {/* Lot # */}
                      <td className={cn(
                        "border-r border-slate-200 font-mono text-center text-slate-600",
                        density === 'compact' ? 'py-2 px-3' : 'py-3 px-3'
                      )}>
                        {imp.lot_number || imp.lot || '—'}
                      </td>

                      {/* Installed Date */}
                      <td className={cn(
                        "border-r border-slate-200 font-mono text-slate-600",
                        density === 'compact' ? 'py-2 px-3' : 'py-3 px-3'
                      )}>
                        {dateStr}
                      </td>

                      {/* Surgeon Doctor */}
                      <td className={cn(
                        "border-r border-slate-200 font-medium text-slate-800",
                        density === 'compact' ? 'py-2 px-3' : 'py-3 px-3'
                      )}>
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{imp.doctor || 'Jarroh'}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className={cn(
                        "border-r border-slate-200 text-center",
                        density === 'compact' ? 'py-2 px-2' : 'py-3 px-2'
                      )}>
                        {getStatusBadge(imp.lifecycle_status || imp.status)}
                      </td>

                      {/* Action / Passport Link */}
                      <td className={cn(
                        "text-center",
                        density === 'compact' ? 'py-1.5 px-2' : 'py-2 px-2'
                      )}>
                        {imp.passport_id || imp.id ? (
                          <Link
                            to={`/implant-passport/${imp.passport_id || imp.id}`}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded text-[10.5px] font-bold transition-all border border-purple-200"
                            title="Implant Pasportini ko'rish"
                          >
                            <span>Pasport</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        ) : (
                          <span className="text-slate-400 text-[10px]">Mavjud emas</span>
                        )}
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

export default memo(ExcelImplantsView);
