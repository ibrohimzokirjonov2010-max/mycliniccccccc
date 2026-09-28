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
import { implantRecordFdis } from '@/lib/fdiNotation';
import { implantStatusClass, implantStatusLabel, normalizeImplantStatus } from '@/lib/implantStatus';
import { formatDoctorName, formatTableDate } from '@/lib/displayText';

function implantBrandLine(imp) {
  const firma = imp?.firma === 'Boshqa' ? (imp?.firma_custom || '') : (imp?.firma || '');
  const system = String(imp?.brend || imp?.model || imp?.system || '').trim();
  const parts = [firma, system].map((part) => String(part || '').trim()).filter(Boolean);
  const unique = [...new Set(parts)];
  return unique.join(' · ') || '—';
}

function implantSizeLine(imp) {
  if (imp?.diameter && imp?.length) return `Ø${imp.diameter}×${imp.length}`;
  return imp?.size || '—';
}

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
      list = list.filter((imp) => normalizeImplantStatus(imp.lifecycle_status || imp.status) === statusFilter);
    }

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(imp =>
        (imp.firma && imp.firma.toLowerCase().includes(q)) ||
        (imp.brend && imp.brend.toLowerCase().includes(q)) ||
        (imp.doctor && imp.doctor.toLowerCase().includes(q)) ||
        (imp.lot_number && String(imp.lot_number).includes(q)) ||
        implantRecordFdis(imp).some((fdi) => String(fdi).toLowerCase().includes(q))
      );
    }

    return list;
  }, [implants, search, statusFilter]);

  const getStatusBadge = (status) => {
    const code = normalizeImplantStatus(status);
    const label = implantStatusLabel(status, language);
    const Icon = code === 'completed' ? CheckCircle2 : code === 'failure' ? XCircle : Clock;
    return (
      <span
        data-testid="profile-implant-status"
        data-implant-status={code}
        className={cn(
          'inline-flex items-center justify-center gap-1 px-1 py-0.5 rounded-full border font-bold text-[10px] leading-tight text-center max-w-full whitespace-normal',
          implantStatusClass(status),
        )}
      >
        <Icon className="w-2.5 h-2.5 shrink-0" />
        {label}
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
            const dateStr = formatTableDate(imp.installed_date || imp.date || imp.placement_date);
            const sizeStr = implantSizeLine(imp);
            const brandName = implantBrandLine(imp);
            const fdis = implantRecordFdis(imp);

            return (
              <div key={imp.id || idx} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {/* Card top */}
                <div className="p-3.5 flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center shrink-0">
                    {fdis.length === 1 ? (
                      <span className="text-[11px] font-black text-purple-700">#{fdis[0]}</span>
                    ) : (
                      <ImplantIcon className="w-5 h-5 text-purple-500" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-black text-slate-900 leading-tight">{brandName}</p>
                    <p className="text-[10px] font-bold text-purple-700 mt-0.5">
                      {fdis.length ? fdis.map((fdi) => `#${fdi}`).join(' · ') : (imp.firma && imp.brend ? imp.firma : 'Implant tizimi')}
                    </p>
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
                    <span className="text-[11px] font-bold text-slate-600 truncate">{formatDoctorName(imp.doctor) || 'Jarroh'}</span>
                  </div>
                  {(imp.passport_id || imp.id) ? (
                    <Link
                      to={`/implants/${imp.id || imp.passport_id}`}
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
            <table className="w-full table-fixed border-collapse text-left text-sm">
            <colgroup>
              <col className="w-8" />
              <col className="w-12" />
              <col />
              <col className="w-16" />
              <col className="w-12" />
              <col className="w-[4.75rem]" />
              <col className="w-[4.5rem]" />
              <col className="w-[6.5rem]" />
              <col className="w-[4.25rem]" />
            </colgroup>
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-black uppercase tracking-wide text-[10px]">
                <th className="py-2.5 px-1 border-r border-slate-100 text-center">№</th>
                <th className="py-2.5 px-1 border-r border-slate-100 text-center">Tish</th>
                <th className="py-2.5 px-1.5 border-r border-slate-100">{t('patientProfile.brandSystemCol') || "Brend / Tizim"}</th>
                <th className="py-2.5 px-1 border-r border-slate-100 text-center">Ø×L</th>
                <th className="py-2.5 px-1 border-r border-slate-100 text-center">Lot</th>
                <th className="py-2.5 px-1 border-r border-slate-100 text-center">Sana</th>
                <th className="py-2.5 px-1 border-r border-slate-100">{t('patientProfile.surgeonCol') || "Jarroh"}</th>
                <th className="py-2.5 px-1 border-r border-slate-100 text-center">{t('common.status') || "Holati"}</th>
                <th className="py-2.5 px-1 text-center bg-slate-50">{t('patientProfile.passportCol') || "Pasport"}</th>
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
                const dateStr = formatTableDate(imp.installed_date || imp.date || imp.placement_date) || '—';
                const brandName = implantBrandLine(imp);
                const fdis = implantRecordFdis(imp);

                return (
                  <tr key={imp.id || idx} className={cn("border-b border-slate-100 hover:bg-purple-50/20 transition-colors", idx % 2 === 1 && "bg-slate-50/30")}>
                    <td className="py-2 px-1 text-center font-mono text-[11px] text-slate-400 border-r border-slate-100">{idx + 1}</td>
                    <td className="py-2 px-1.5 text-center border-r border-slate-100">
                      {fdis.length ? (
                        <div className="flex flex-wrap items-center justify-center gap-1" data-testid="profile-implant-fdis">
                          {fdis.map((fdi) => (
                            <span key={fdi} className="inline-flex items-center justify-center font-mono font-black text-purple-600 text-xs bg-purple-50/70 px-1.5 py-0.5 rounded border border-purple-100">
                              #{fdi}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-300 font-mono text-xs">—</span>
                      )}
                    </td>
                    <td className="py-2 px-1.5 border-r border-slate-100">
                      <div className="flex items-center gap-1.5 min-w-0" title={brandName}>
                        <ImplantIcon className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                        <span className="font-bold text-slate-900 text-xs truncate">{brandName}</span>
                      </div>
                    </td>
                    <td className="py-2 px-1 text-center font-mono font-bold text-slate-700 text-xs border-r border-slate-100 whitespace-nowrap">
                      {implantSizeLine(imp)}
                    </td>
                    <td className="py-2 px-1 text-center font-mono text-slate-600 text-xs border-r border-slate-100 whitespace-nowrap">
                      {imp.lot_number || imp.lot || '—'}
                    </td>
                    <td className="py-2 px-1 text-center font-mono text-slate-600 text-xs border-r border-slate-100 whitespace-nowrap">
                      {dateStr}
                    </td>
                    <td className="py-2 px-1.5 border-r border-slate-100">
                      <div className="flex items-center gap-1 min-w-0" title={formatDoctorName(imp.doctor) || 'Jarroh'}>
                        <User className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="text-xs text-slate-700 font-medium truncate">{formatDoctorName(imp.doctor) || 'Jarroh'}</span>
                      </div>
                    </td>
                    <td className="py-2 px-1 text-center border-r border-slate-100 whitespace-nowrap">
                      {getStatusBadge(imp.lifecycle_status || imp.status)}
                    </td>
                    <td className="py-2 px-1 text-center whitespace-nowrap bg-white">
                      {(imp.passport_id || imp.id) ? (
                        <Link
                          to={`/implants/${imp.id || imp.passport_id}`}
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
