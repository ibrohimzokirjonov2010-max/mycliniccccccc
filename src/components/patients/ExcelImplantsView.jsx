import { useState, useMemo, memo } from 'react';
import { useTranslation } from '@/i18n/LanguageContext';
import { 
  Search, ExternalLink, User, CheckCircle2,
  XCircle, Clock, Plus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { ImplantIcon } from '@/components/ui/Icons';
import EmptyState from '../ui/EmptyState';

function ExcelImplantsView({
  patient: _patient,
  implants = [],
}) {
  const { t, language } = useTranslation();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

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
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[8.5px] uppercase tracking-wide whitespace-nowrap">
          <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />
          {language === 'ru' ? 'Завершено' : language === 'en' ? 'Completed' : 'Tugallangan'}
        </span>
      );
    }
    if (s.includes('fail') || s.includes('rad')) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-bold text-[8.5px] uppercase tracking-wide whitespace-nowrap">
          <XCircle className="w-2.5 h-2.5 shrink-0" />
          {language === 'ru' ? 'Отклонено' : language === 'en' ? 'Failed' : 'Rad etildi'}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 font-bold text-[8.5px] uppercase tracking-wide whitespace-nowrap">
        <Clock className="w-2.5 h-2.5 shrink-0" />
        {language === 'ru' ? 'В интеграции' : language === 'en' ? 'In Integration' : 'Integratsiyada'}
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
            placeholder={language === 'ru' ? "Поиск бренда, зуба, хирурга..." : language === 'en' ? "Search brand, tooth, surgeon..." : "Brend, tish #, shifokor qidirish..."}
            className="w-full pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1499AD]/30 focus:border-[#1499AD] transition-all"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 w-5 h-5 flex items-center justify-center rounded-full hover:bg-slate-100 text-xs transition-all">✕</button>
          )}
        </div>
      </div>

      {/* ── MOBILE CARDS ── */}
      <div className="md:hidden space-y-2.5">
        {filteredImplants.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 py-14 text-center flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center">
              <ImplantIcon className="w-7 h-7 text-purple-300" />
            </div>
            <p className="text-slate-400 text-sm font-semibold">
              {t('patientProfile.noImplantsFound') || "Implantlar qayd etilmagan"}
            </p>
          </div>
        ) : (
          filteredImplants.map((imp, idx) => {
            const locale = language === 'ru' ? 'ru-RU' : language === 'en' ? 'en-US' : 'uz-UZ';
            const dateStr = imp.installed_date || imp.date
              ? new Date(imp.installed_date || imp.date).toLocaleDateString(locale) : '—';
            const sizeStr = imp.diameter && imp.length ? `Ø${imp.diameter}×${imp.length}mm` : (imp.size || '—');
            const brandName = imp.brend || imp.firma || (language === 'ru' ? 'Имплант' : 'Implantat');

            return (
              <div key={imp.id || idx} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {/* Card top */}
                <div className="p-3.5 flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center shrink-0">
                    {imp.tooth_number ? (
                      <span className="text-[11px] font-black text-purple-700">#{imp.tooth_number}</span>
                    ) : (
                      <ImplantIcon className="w-5 h-5 text-purple-500" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-black text-slate-900 leading-tight">{brandName}</p>
                    <p className="text-[10px] font-bold text-slate-400 mt-0.5">{imp.firma && imp.brend ? imp.firma : 'Implant tizimi'}</p>
                  </div>
                  {getStatusBadge(imp.lifecycle_status || imp.status)}
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-3 gap-px bg-slate-100 border-t border-slate-100">
                  <div className="bg-white px-3 py-2.5">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">O'lchami</p>
                    <p className="text-[11px] font-bold text-slate-700 mt-0.5 font-mono leading-none">{sizeStr}</p>
                  </div>
                  <div className="bg-white px-3 py-2.5">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Lot #</p>
                    <p className="text-[11px] font-bold text-slate-700 mt-0.5 font-mono leading-none">{imp.lot_number || imp.lot || '—'}</p>
                  </div>
                  <div className="bg-white px-3 py-2.5">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Sana</p>
                    <p className="text-[11px] font-bold text-slate-700 mt-0.5 leading-none">{dateStr}</p>
                  </div>
                </div>

                {/* Surgeon + Passport */}
                <div className="px-3.5 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="text-[11px] font-bold text-slate-600 truncate">{imp.doctor || 'Jarroh'}</span>
                  </div>
                  {(imp.passport_id || imp.id) ? (
                    <Link
                      to={`/implant-passport/${imp.passport_id || imp.id}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-[10px] font-black transition-all active:scale-95"
                    >
                      <span>Pasport</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  ) : (
                    <span className="text-[10px] text-slate-400 font-semibold">Mavjud emas</span>
                  )}
                </div>
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
                <th className="py-2.5 px-1.5 border-r border-slate-100 w-14 min-w-[46px] text-center">Tish FDI</th>
                <th className="py-2.5 px-2 border-r border-slate-100 min-w-[105px] max-w-[145px]">{t('patientProfile.brandSystemCol') || "Brend / Tizim"}</th>
                <th className="py-2.5 px-1.5 border-r border-slate-100 text-center w-24 min-w-[78px]">{t('patientProfile.sizeCol') || "O'lchami"}</th>
                <th className="py-2.5 px-1.5 border-r border-slate-100 text-center w-20 min-w-[68px]">Lot #</th>
                <th className="py-2.5 px-1.5 border-r border-slate-100 text-center w-20 min-w-[72px]">{t('patientProfile.installedDateCol') || "Sana"}</th>
                <th className="py-2.5 px-2 border-r border-slate-100 min-w-[85px] max-w-[120px]">{t('patientProfile.surgeonCol') || "Jarroh"}</th>
                <th className="py-2.5 px-1.5 border-r border-slate-100 text-center w-24 min-w-[80px]">{t('common.status') || "Holati"}</th>
                <th className="py-2.5 px-1.5 text-center w-20 min-w-[68px]">{t('patientProfile.passportCol') || "Pasport"}</th>
              </tr>
            </thead>
            <tbody>
              {filteredImplants.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-14 text-center">
                    <ImplantIcon className="w-8 h-8 mx-auto mb-2 text-slate-200" />
                    <p className="text-slate-400 text-sm font-semibold">
                      {t('patientProfile.noImplantsFound') || "Implantlar qayd etilmagan."}
                    </p>
                  </td>
                </tr>
              ) : filteredImplants.map((imp, idx) => {
                const locale = language === 'ru' ? 'ru-RU' : language === 'en' ? 'en-US' : 'uz-UZ';
                const dateStr = imp.installed_date || imp.date ? new Date(imp.installed_date || imp.date).toLocaleDateString(locale) : '—';
                const brandName = imp.brend || imp.firma || 'Implantat';

                return (
                  <tr key={imp.id || idx} className={cn("border-b border-slate-100 hover:bg-purple-50/20 transition-colors", idx % 2 === 1 && "bg-slate-50/30")}>
                    <td className="py-2 px-1 text-center font-mono text-[11px] text-slate-400 border-r border-slate-100">{idx + 1}</td>
                    <td className="py-2 px-1.5 text-center border-r border-slate-100">
                      {imp.tooth_number ? (
                        <span className="inline-flex items-center justify-center font-mono font-black text-purple-600 text-xs bg-purple-50/70 px-1.5 py-0.5 rounded border border-purple-100">
                          #{imp.tooth_number}
                        </span>
                      ) : (
                        <span className="text-slate-300 font-mono text-xs">—</span>
                      )}
                    </td>
                    <td className="py-2 px-2 border-r border-slate-100">
                      <div className="flex items-center gap-1.5 min-w-0 max-w-[145px]" title={brandName}>
                        <ImplantIcon className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                        <span className="font-bold text-slate-900 text-xs truncate">{brandName}</span>
                      </div>
                    </td>
                    <td className="py-2 px-1 text-center font-mono font-bold text-slate-700 text-xs border-r border-slate-100 whitespace-nowrap">
                      {imp.diameter && imp.length ? `Ø${imp.diameter}×${imp.length}` : (imp.size || '—')}
                    </td>
                    <td className="py-2 px-1 text-center font-mono text-slate-600 text-xs border-r border-slate-100 whitespace-nowrap">
                      {imp.lot_number || imp.lot || '—'}
                    </td>
                    <td className="py-2 px-1 text-center font-mono text-slate-600 text-xs border-r border-slate-100 whitespace-nowrap">
                      {dateStr}
                    </td>
                    <td className="py-2 px-2 border-r border-slate-100">
                      <div className="flex items-center gap-1 min-w-0 max-w-[120px]" title={imp.doctor || 'Jarroh'}>
                        <User className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="text-xs text-slate-700 font-medium truncate">{imp.doctor || 'Jarroh'}</span>
                      </div>
                    </td>
                    <td className="py-2 px-1 text-center border-r border-slate-100 whitespace-nowrap">
                      {getStatusBadge(imp.lifecycle_status || imp.status)}
                    </td>
                    <td className="py-2 px-1 text-center whitespace-nowrap">
                      {(imp.passport_id || imp.id) ? (
                        <Link
                          to={`/implant-passport/${imp.passport_id || imp.id}`}
                          className="inline-flex items-center justify-center gap-1 px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-[10.5px] font-bold transition-all border border-purple-200 shadow-2xs"
                        >
                          <span>{language === 'ru' ? 'Паспорт' : language === 'en' ? 'Passport' : 'Pasport'}</span>
                          <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                        </Link>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
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

export default memo(ExcelImplantsView);
