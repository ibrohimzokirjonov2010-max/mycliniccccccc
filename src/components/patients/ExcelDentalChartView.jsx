import { useState, useMemo, memo, useCallback } from 'react';
import { useTranslation } from '@/i18n/LanguageContext';
import { 
  Search, FileSpreadsheet, Edit3, Activity, ShieldCheck, ClipboardList
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ProfessionalOdontogram from './ProfessionalOdontogram';
import { Tooth, ImplantIcon, CrownIcon } from '@/components/ui/Icons';

/**
 * ExcelDentalChartView Component
 * Integrates the visual Professional Odontogram with an interactive Excel 32 FDI Teeth Matrix Spreadsheet.
 */
function ExcelDentalChartView({
  search: externalSearch,
  setSearch: externalSetSearch,
  viewMode: externalViewMode,
  setViewMode: externalSetViewMode,
  odontogramSelectedTeeth,
  stableOnOdontogramChange,
  handleInfoToothClick,
  chartEditMode,
  setChartEditMode,
  toothStatuses,
  patientType,
  setPatientType,
  age,
  chartView,
  showOcclusal,
  psrScores,
  occlusionNotes,
  handleOcclusionNotesChange,
  occlusionClass,
  handleOcclusionClassChange,
  pendingToothEdits,
  dentalFormulaSummaryList = [],
  plans = [],
}) {
  const { t, language } = useTranslation();
  const [internalSearch, setInternalSearch] = useState('');
  const search = externalSearch !== undefined ? externalSearch : internalSearch;
  const setSearch = externalSetSearch || setInternalSearch;

  const [internalViewMode, setInternalViewMode] = useState('both');
  const viewMode = externalViewMode !== undefined ? externalViewMode : internalViewMode;
  const setViewMode = externalSetViewMode || setInternalViewMode;

  // Standard 32 FDI Teeth Formula Matrix
  const toothNamesMap = {
    18: "Uchinchi katta oziq (Aql tishi)",
    17: "Ikkinchi katta oziq tish",
    16: "Birinchi katta oziq tish (Molyar)",
    15: "Ikkinchi kichik oziq tish (Premolyar)",
    14: "Birinchi kichik oziq tish (Premolyar)",
    13: "Yuqori o'ng qoziq tish (Kani)",
    12: "Yuqori o'ng yon kurak tish",
    11: "Yuqori o'ng markaziy kurak tish",
    21: "Yuqori chap markaziy kurak tish",
    22: "Yuqori chap yon kurak tish",
    23: "Yuqori chap qoziq tish (Kani)",
    24: "Birinchi kichik oziq tish (Premolyar)",
    25: "Ikkinchi kichik oziq tish (Premolyar)",
    26: "Birinchi katta oziq tish (Molyar)",
    27: "Ikkinchi katta oziq tish",
    28: "Uchinchi katta oziq (Aql tishi)",
    48: "Pastki o'ng aql tishi",
    47: "Pastki o'ng ikkinchi katta oziq",
    46: "Pastki o'ng birinchi katta oziq",
    45: "Pastki o'ng ikkinchi kichik oziq",
    44: "Pastki o'ng birinchi kichik oziq",
    43: "Pastki o'ng qoziq tish",
    42: "Pastki o'ng yon kurak tish",
    41: "Pastki o'ng markaziy kurak tish",
    31: "Pastki chap markaziy kurak tish",
    32: "Pastki chap yon kurak tish",
    33: "Pastki chap qoziq tish",
    34: "Pastki chap birinchi kichik oziq",
    35: "Pastki chap ikkinchi kichik oziq",
    36: "Pastki chap birinchi katta oziq",
    37: "Pastki chap ikkinchi katta oziq",
    38: "Pastki chap aql tishi",
  };

  const fdiOrder = [
    18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28,
    48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38
  ];

    const teethRows = useMemo(() => {
    const list = [];
    const seenKeys = new Set();

    // 1. First gather services directly from treatment plans
    (plans || []).forEach(p => {
      const planDateRaw = p.date || p.created_date || p.created_at;
      const planDateObj = planDateRaw ? new Date(planDateRaw) : null;
      const planDateStr = planDateObj && !isNaN(planDateObj) 
        ? `${String(planDateObj.getDate()).padStart(2,'0')}.${String(planDateObj.getMonth()+1).padStart(2,'0')}.${planDateObj.getFullYear()}`
        : '—';

      if (Array.isArray(p.services) && p.services.length > 0) {
        p.services.forEach(s => {
          const rawTooth = s.tooth_id || s.tooth || s.tooth_number || p.tooth_number;
          const toothClean = rawTooth && rawTooth !== 'general' && rawTooth !== 'Umumiy' ? String(rawTooth).replace(/^#/, '') : null;
          const rawName = s.service_name || s.name || p.name;
          const cleanName = rawName ? rawName.replace(/^#general/i, '').trim() : 'Muolaja';
          const price = Number(s.price || s.cost || 0);
          const notes = s.notes || p.notes || '—';
          const key = `${toothClean || 'all'}_${cleanName}_${planDateStr}`;

          if (toothClean) {
            seenKeys.add(String(toothClean));
          }

          list.push({
            id: s.id || `svc_${list.length}`,
            fdi: toothClean ? Number(toothClean) || toothClean : '—',
            toothDisplay: toothClean ? `#${toothClean}` : 'Umumiy',
            treatment: cleanName,
            dateStr: planDateStr,
            price: price,
            notes: notes,
            statusKey: s.status || p.status || 'completed'
          });
        });
      } else if (p.name) {
        const rawTooth = p.tooth_number;
        const toothClean = rawTooth && rawTooth !== 'general' && rawTooth !== 'Umumiy' ? String(rawTooth).replace(/^#/, '') : null;
        const price = Number(p.total_price || 0);
        const notes = p.notes || '—';

        if (toothClean) {
          seenKeys.add(String(toothClean));
        }

        list.push({
          id: p.id || `plan_${list.length}`,
          fdi: toothClean ? Number(toothClean) || toothClean : '—',
          toothDisplay: toothClean ? `#${toothClean}` : 'Umumiy',
          treatment: p.name,
          dateStr: planDateStr,
          price: price,
          notes: notes,
          statusKey: p.status || 'completed'
        });
      }
    });

    // 2. Also check toothStatuses / pendingToothEdits for diagnosed or treated teeth not yet in plans
    fdiOrder.forEach(fdi => {
      const fdiStr = String(fdi);
      const stObj = toothStatuses[`ur${fdi}`] || toothStatuses[`ul${fdi}`] || toothStatuses[`ll${fdi}`] || toothStatuses[`lr${fdi}`] || toothStatuses[fdiStr] || {};
      const statusKey = stObj.status || (pendingToothEdits[fdiStr]?.condition) || 'healthy';
      const diagnosis = stObj.diagnosis || pendingToothEdits[fdiStr]?.condition || (statusKey !== 'healthy' ? statusKey : 'Sog\'lom');
      const treatment = stObj.treatment || pendingToothEdits[fdiStr]?.treatment || '';
      const notes = stObj.notes || pendingToothEdits[fdiStr]?.notes || '—';

      const isHealthy = (!statusKey || statusKey === 'healthy') && 
                        (!diagnosis || diagnosis.toLowerCase() === 'sog\'lom' || diagnosis.toLowerCase() === 'healthy') && 
                        (!treatment || treatment === '—') && 
                        (notes === '—' || !notes);

      if (!isHealthy && !seenKeys.has(fdiStr)) {
        let displayTreatment = treatment && treatment !== '—' ? treatment : diagnosis;
        if (!displayTreatment || displayTreatment === 'healthy') {
          displayTreatment = 'Davolash muolajasi';
        }

        list.push({
          id: `tooth_${fdi}`,
          fdi: fdi,
          toothDisplay: `#${fdi}`,
          treatment: displayTreatment,
          dateStr: '—',
          price: 0,
          notes: notes,
          statusKey: statusKey
        });
      }
    });

    return list;
  }, [toothStatuses, pendingToothEdits, plans]);

  const filteredTeeth = useMemo(() => {
    let list = [...teethRows];

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(t => 
        String(t.fdi).includes(q) ||
        String(t.toothDisplay).toLowerCase().includes(q) ||
        t.treatment.toLowerCase().includes(q) ||
        t.notes.toLowerCase().includes(q)
      );
    }

    return list;
  }, [teethRows, search]);

  const getStatusTag = (statusKey) => {
    const s = (statusKey || '').toLowerCase();
    if (s.includes('caries') || s.includes('karies')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 font-bold text-[10.5px]">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
          <span>Karies</span>
        </span>
      );
    }
    if (s.includes('filling') || s.includes('plomba')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-bold text-[10.5px]">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
          <span>Plomba</span>
        </span>
      );
    }
    if (s.includes('crown') || s.includes('toj')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-bold text-[10.5px]">
          <CrownIcon className="w-3 h-3 text-amber-600 shrink-0" />
          <span>Toj (Koronka)</span>
        </span>
      );
    }
    if (s.includes('missing') || s.includes('yo\'q')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-300 font-bold text-[10.5px]">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
          <span>Tish yo'q</span>
        </span>
      );
    }
    if (s.includes('implant')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 font-bold text-[10.5px]">
          <ImplantIcon className="w-3 h-3 text-purple-600 shrink-0" />
          <span>Implantat</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10.5px]">
        <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
        <span>Sog'lom</span>
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* ══ TOOLBAR CONTROLS & FILTERS (Only when not controlled from top) ══ */}
      {externalSearch === undefined && (
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
          {/* Action Controls & Filters */}
          <div className="p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Left: Search Input */}
            <div className="flex items-center gap-2 flex-wrap flex-1">
              <div className="relative min-w-[200px] max-w-sm flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('patientProfile.searchTeethOrTreatment') || t('common.searchTooth') || "Tish #, tashxis qidirish..."}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#1a73e8]"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs">✕</button>
                )}
              </div>
            </div>

            {/* Right: View mode */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="inline-flex p-0.5 bg-slate-100 rounded-lg border border-slate-200/60 gap-0.5">
                <button
                  onClick={() => setViewMode('both')}
                  className={cn("px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5", viewMode === 'both' ? "bg-white text-slate-900 shadow-2xs font-black" : "text-slate-500")}
                >
                  <Tooth className="w-3.5 h-3.5 text-sky-600" />
                  <span>{t('patientProfile.chartAndTable') || "Xarita + Jadval"}</span>
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={cn("px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5", viewMode === 'table' ? "bg-white text-slate-900 shadow-2xs font-black" : "text-slate-500")}
                >
                  <ClipboardList className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{t('patientProfile.onlyTable') || "Faqat Jadval"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ GRAPHICAL ODONTOGRAM CONTAINER ══ */}
      {(viewMode === 'both' || viewMode === 'chart') && (
        <div className="bg-white border border-slate-200/90 rounded-xl shadow-xs overflow-visible">
          {/* Card header */}
          <div className="px-4 py-3 bg-slate-50/80 flex items-center justify-between border-b border-slate-200/80">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white text-xs font-black shrink-0 shadow-2xs">
                32
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-900">{t('patientProfile.interactiveFormula') || "Interaktiv Tish Formulasi"}</span>
                </div>
                <span className="text-[10px] font-mono font-semibold text-slate-400">{t('patientProfile.odontogramSubtitle') || "ODONTOGRAMMA & DIAGNOSTIKA"}</span>
              </div>
            </div>
          </div>

          <div className="p-2 sm:p-4 overflow-x-auto overflow-y-visible no-scrollbar min-w-0 w-full flex justify-center bg-white">
            <ProfessionalOdontogram
              selectedTeeth={odontogramSelectedTeeth}
              onChange={stableOnOdontogramChange}
              onToothClick={handleInfoToothClick}
              multi={!chartEditMode}
              toothStatuses={toothStatuses}
              patientType={patientType}
              onPatientTypeChange={setPatientType}
              patientAge={age}
              chartView={chartView}
              quadrantFilter="all"
              showOcclusal={showOcclusal}
              psrScores={psrScores}
              occlusionNotes={occlusionNotes}
              onOcclusionNotesChange={handleOcclusionNotesChange}
              occlusionClass={occlusionClass}
              onOcclusionClassChange={handleOcclusionClassChange}
              compact={false}
            />
          </div>
        </div>
      )}

      {/* ══ XIZMAT QILINGAN TISHLAR RO'YXATI JADVALI ══ */}
      {(viewMode === 'both' || viewMode === 'table') && (
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50/90 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-indigo-600" />
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                {t('patientProfile.servicedTeethList') || "Xizmat Ko'rsatilgan Tishlar Ro'yxati"} ({filteredTeeth.length})
              </h4>
            </div>
            <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
              {filteredTeeth.length} TA MUOLAJA
            </span>
          </div>

          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full border-collapse text-left font-sans text-xs">
              <thead>
                <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10.5px]">
                  <th className="py-2.5 px-3 border-r border-slate-200 text-center w-12 bg-slate-200/60 font-mono">№</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 font-mono text-center w-28">{t('patientProfile.toothNumberCol') || "1. Tish Raqami"}</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 min-w-[200px]">{t('patientProfile.treatmentCol') || "2. Qilingan Muolaja"}</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 text-center w-36">{t('patientProfile.dateCol') || "3. Qilingan Sanasi"}</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 text-right w-36">{t('patientProfile.priceCol') || "4. Narxi"}</th>
                  <th className="py-2.5 px-3 min-w-[150px]">{t('patientProfile.notesCol') || "5. Izoh"}</th>
                </tr>
              </thead>
              <tbody>
                {filteredTeeth.length > 0 ? (
                  filteredTeeth.map((item, idx) => (
                    <tr
                      key={item.id || idx}
                      className={cn(
                        "border-b border-slate-200/70 hover:bg-sky-50/40 transition-colors",
                        idx % 2 === 0 ? "bg-slate-50/40" : "bg-white"
                      )}
                    >
                      {/* № */}
                      <td className="border-r border-slate-200 text-center font-mono font-bold text-slate-400 bg-slate-100/40 text-[11px] py-2 px-2">
                        {idx + 1}
                      </td>

                      {/* 1. Tish raqami */}
                      <td className="border-r border-slate-200 font-mono font-black text-center text-indigo-700 bg-indigo-50/40 py-2 px-2.5">
                        {item.toothDisplay}
                      </td>

                      {/* 2. Qilingan muolaja */}
                      <td className="border-r border-slate-200 font-bold text-slate-800 py-2 px-3">
                        <span>{item.treatment}</span>
                      </td>

                      {/* 3. Qilingan sanasi */}
                      <td className="border-r border-slate-200 text-center font-mono text-slate-600 font-medium py-2 px-3">
                        {item.dateStr}
                      </td>

                      {/* 4. Narxi */}
                      <td className="border-r border-slate-200 text-right font-mono font-bold text-slate-900 py-2 px-3">
                        {item.price > 0 ? `${item.price.toLocaleString()} UZS` : '—'}
                      </td>

                      {/* 5. Izoh */}
                      <td className="text-slate-500 italic text-[11px] py-2 px-3">
                        {item.notes}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-12 text-center bg-slate-50/30">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
                          <ShieldCheck className="w-5 h-5" />
                        </div>
                        <p className="text-xs font-bold text-slate-700">{t('patientProfile.noTreatmentsEmpty') || "Muolaja qilingan tishlar ro'yxati bo'sh"}</p>
                        <p className="text-[11px] text-slate-400">{t('patientProfile.noTreatmentsEmptyDesc') || "Barcha tishlar sog'lom holatda yoki hali muolaja biriktirilmagan"}</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(ExcelDentalChartView);
