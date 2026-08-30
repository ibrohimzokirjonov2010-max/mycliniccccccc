import { useState, useMemo, memo } from 'react';
import { useTranslation } from '@/i18n/LanguageContext';
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
  const { t, language } = useTranslation();
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
    if (s.includes('tugallangan') || s.includes('done') || s.includes('complete') || s.includes('завершено')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px]">
          <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
          <span>{language === 'ru' ? 'Завершено' : language === 'en' ? 'Completed' : 'Tugallangan'}</span>
        </span>
      );
    }
    if (s.includes('fail') || s.includes('rad') || s.includes('отклонено')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 font-bold text-[10px]">
          <XCircle className="w-3 h-3 text-rose-600 shrink-0" />
          <span>{language === 'ru' ? 'Отклонено' : language === 'en' ? 'Failed' : 'Rad etildi'}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-bold text-[10px]">
        <Clock className="w-3 h-3 text-blue-600 shrink-0" />
        <span>{language === 'ru' ? 'В процессе остеоинтеграции' : language === 'en' ? 'In Integration' : 'Integratsiyada'}</span>
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* ══ TOOLBAR CONTROLS & FILTERS ══ */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Action Controls & Filters */}
        <div className="p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap flex-1">
            {/* Search Input */}
            <div className="relative min-w-[200px] max-w-sm flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={language === 'ru' ? "Поиск фирмы, бренда, врача, лота..." : language === 'en' ? "Search brand, tooth #, doctor..." : "Brend, tish #, shifokor qidirish..."}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#1a73e8]"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs">✕</button>
              )}
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 shrink-0">
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
                <th className="py-3 px-3.5 border-r border-slate-200 font-mono text-center w-20">Tish FDI</th>
                <th className="py-3 px-3.5 border-r border-slate-200 min-w-[160px]">{t('patientProfile.brandSystemCol') || "Implant Brendi / Tizimi"}</th>
                <th className="py-3 px-3.5 border-r border-slate-200 text-center min-w-[130px] font-mono">{t('patientProfile.sizeCol') || "O'lchami (Ø × L)"}</th>
                <th className="py-3 px-3.5 border-r border-slate-200 text-center min-w-[120px] font-mono">{t('patientProfile.lotCol') || "Lot / Partiya #"}</th>
                <th className="py-3 px-3.5 border-r border-slate-200 min-w-[130px] font-mono">{t('patientProfile.installedDateCol') || "O'rnatilgan Sana"}</th>
                <th className="py-3 px-3.5 border-r border-slate-200 min-w-[140px]">{language === 'ru' ? "Хирург" : language === 'en' ? "Surgeon" : "Jarroh"}</th>
                <th className="py-3 px-3.5 border-r border-slate-200 text-center min-w-[110px]">{t('common.status') || "Holati"}</th>
                <th className="py-3 px-3.5 text-center min-w-[90px]">{language === 'ru' ? "Паспорт" : language === 'en' ? "Passport" : "Pasport"}</th>
              </tr>
            </thead>
            <tbody>
              {filteredImplants.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 italic bg-slate-50/50">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <ImplantIcon className="w-8 h-8 text-slate-300" />
                      <span>{language === 'ru' ? "Импланты для данного пациента не внесены." : language === 'en' ? "No implants recorded for this patient." : "Bu bemor uchun hali implantlar qayd etilmagan."}</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredImplants.map((imp, idx) => {
                  const locale = language === 'ru' ? 'ru-RU' : language === 'en' ? 'en-US' : 'uz-UZ';
                  const dateStr = imp.installed_date || imp.date ? new Date(imp.installed_date || imp.date).toLocaleDateString(locale) : '—';

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
                        "border-r border-slate-200 text-center font-mono font-bold text-slate-500 bg-slate-100/40 text-xs",
                        density === 'compact' ? 'py-3.5 px-3' : 'py-4.5 px-3.5'
                      )}>
                        {idx + 1}
                      </td>

                      {/* Tooth FDI # */}
                      <td className={cn(
                        "border-r border-slate-200 font-mono font-black text-center text-purple-700 bg-purple-50/40 text-sm",
                        density === 'compact' ? 'py-3.5 px-3' : 'py-4.5 px-3.5'
                      )}>
                        {imp.tooth_number ? `#${imp.tooth_number}` : '—'}
                      </td>

                      {/* Brand / System */}
                      <td className={cn(
                        "border-r border-slate-200 font-bold text-slate-900 text-sm",
                        density === 'compact' ? 'py-3.5 px-3.5' : 'py-4.5 px-4'
                      )}>
                        <div className="flex items-center gap-2">
                          <ImplantIcon className="w-4 h-4 text-purple-600 shrink-0" />
                          <span>{imp.brend || imp.firma || (language === 'ru' ? 'Имплант' : 'Implantat')}</span>
                        </div>
                      </td>

                      {/* Diameter x Length */}
                      <td className={cn(
                        "border-r border-slate-200 font-mono text-center text-slate-800 font-bold text-xs sm:text-sm",
                        density === 'compact' ? 'py-3.5 px-3.5' : 'py-4.5 px-4'
                      )}>
                        {imp.diameter && imp.length ? `Ø ${imp.diameter} × ${imp.length} mm` : (imp.size || '—')}
                      </td>

                      {/* Lot # */}
                      <td className={cn(
                        "border-r border-slate-200 font-mono text-center text-slate-700 font-semibold text-xs sm:text-sm",
                        density === 'compact' ? 'py-3.5 px-3.5' : 'py-4.5 px-4'
                      )}>
                        {imp.lot_number || imp.lot || '—'}
                      </td>

                      {/* Installed Date */}
                      <td className={cn(
                        "border-r border-slate-200 font-mono font-semibold text-slate-700 text-xs sm:text-sm",
                        density === 'compact' ? 'py-3.5 px-3.5' : 'py-4.5 px-4'
                      )}>
                        {dateStr}
                      </td>

                      {/* Surgeon Doctor */}
                      <td className={cn(
                        "border-r border-slate-200 font-semibold text-slate-800 text-xs sm:text-sm",
                        density === 'compact' ? 'py-3.5 px-3.5' : 'py-4.5 px-4'
                      )}>
                        <div className="flex items-center gap-1.5">
                          <User className="w-4 h-4 text-slate-400 shrink-0" />
                          <span>{imp.doctor || (language === 'ru' ? 'Хирург' : language === 'en' ? 'Surgeon' : 'Jarroh')}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className={cn(
                        "border-r border-slate-200 text-center",
                        density === 'compact' ? 'py-3 px-3' : 'py-4 px-3.5'
                      )}>
                        {getStatusBadge(imp.lifecycle_status || imp.status)}
                      </td>

                      {/* Action / Passport Link */}
                      <td className={cn(
                        "text-center",
                        density === 'compact' ? 'py-3 px-3' : 'py-4 px-3.5'
                      )}>
                        {imp.passport_id || imp.id ? (
                          <Link
                            to={`/implant-passport/${imp.passport_id || imp.id}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-xs font-bold transition-all border border-purple-200 shadow-2xs"
                            title={language === 'ru' ? "Открыть паспорт импланта" : "Implant Pasportini ko'rish"}
                          >
                            <span>{language === 'ru' ? 'Паспорт' : language === 'en' ? 'Passport' : 'Pasport'}</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>
                        ) : (
                          <span className="text-slate-400 text-xs">{language === 'ru' ? 'Отсутствует' : 'Mavjud emas'}</span>
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
