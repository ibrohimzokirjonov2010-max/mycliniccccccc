import { useState, useMemo, memo } from 'react';
import { 
  Search, FileSpreadsheet, Edit3, Activity, ShieldCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ProfessionalOdontogram from './ProfessionalOdontogram';
import { Tooth, ImplantIcon, CrownIcon } from '@/components/ui/Icons';

/**
 * ExcelDentalChartView Component
 * Integrates the visual Professional Odontogram with an interactive Excel 32 FDI Teeth Matrix Spreadsheet.
 */
function ExcelDentalChartView({
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
  const [search, setSearch] = useState('');
  const [quadrantFilter, setQuadrantFilter] = useState('all'); // 'all' | 'Q1' | 'Q2' | 'Q3' | 'Q4'
  const [viewMode, setViewMode] = useState('both'); // 'both' | 'chart' | 'table'

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
    return fdiOrder.map((fdi, idx) => {
      const fdiStr = String(fdi);
      const stObj = toothStatuses[`ur${fdi}`] || toothStatuses[`ul${fdi}`] || toothStatuses[`ll${fdi}`] || toothStatuses[`lr${fdi}`] || toothStatuses[fdiStr] || {};
      const statusKey = stObj.status || (pendingToothEdits[fdiStr]?.condition) || 'healthy';
      const diagnosis = stObj.diagnosis || pendingToothEdits[fdiStr]?.condition || (statusKey !== 'healthy' ? statusKey : 'Sog\'lom');
      const treatment = stObj.treatment || pendingToothEdits[fdiStr]?.treatment || '—';

      // Associated services from treatment plans
      const matchedServices = [];
      plans.forEach(p => {
        (p.services || []).forEach(s => {
          if (String(s.tooth_number) === fdiStr || String(p.tooth_number) === fdiStr) {
            matchedServices.push(s.name || p.name);
          }
        });
      });

      let quadrant = 'Q1 (Yuqori O\'ng)';
      if (fdi >= 21 && fdi <= 28) quadrant = 'Q2 (Yuqori Chap)';
      if (fdi >= 31 && fdi <= 38) quadrant = 'Q3 (Pastki Chap)';
      if (fdi >= 41 && fdi <= 48) quadrant = 'Q4 (Pastki O\'ng)';

      return {
        idx: idx + 1,
        fdi,
        fdiStr,
        name: toothNamesMap[fdi] || `Tish #${fdi}`,
        quadrant,
        statusKey,
        diagnosis,
        treatment: matchedServices.length > 0 ? matchedServices.join(', ') : treatment,
        notes: stObj.notes || pendingToothEdits[fdiStr]?.notes || '—'
      };
    });
  }, [toothStatuses, pendingToothEdits, plans]);

  const filteredTeeth = useMemo(() => {
    let list = [...teethRows];

    if (quadrantFilter !== 'all') {
      list = list.filter(t => t.quadrant.startsWith(quadrantFilter));
    }

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(t => 
        String(t.fdi).includes(q) ||
        t.name.toLowerCase().includes(q) ||
        t.diagnosis.toLowerCase().includes(q) ||
        t.treatment.toLowerCase().includes(q)
      );
    }

    return list;
  }, [teethRows, search, quadrantFilter]);

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
      {/* ══ EXCEL SPREADSHEET TOOLBAR ══ */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Formula Bar */}
        <div className="bg-slate-50/90 px-4 py-2 border-b border-slate-200 flex items-center gap-3 text-xs font-mono">
          <div className="flex items-center gap-1.5 text-slate-400 font-black shrink-0">
            <span className="text-[#1a73e8] italic font-serif text-sm">fx</span>
            <span>=</span>
          </div>
          <div className="flex items-center gap-4 flex-wrap text-slate-700 overflow-x-auto no-scrollbar">
            <span>SOG'LOM: <b className="text-emerald-700 font-black">{filteredTeeth.filter(t => t.statusKey === 'healthy').length} ta</b></span>
            <span className="text-slate-300">|</span>
            <span>PATOLOGIYA: <b className="text-rose-600 font-black">{filteredTeeth.filter(t => t.statusKey !== 'healthy').length} ta</b></span>
            <span className="text-slate-300">|</span>
            <span>FORMULA: <b className="text-slate-900 font-black">{quadrantFilter === 'all' ? '32 FDI tish' : `${quadrantFilter} (${filteredTeeth.length} tish)`}</b></span>
          </div>
        </div>

        {/* Action Controls & Filters */}
        <div className="p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Left: Quadrant Filter */}
          <div className="flex items-center gap-2 flex-wrap flex-1">
            <div className="relative min-w-[180px] max-w-xs flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tish #, tashxis qidirish..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#1a73e8]"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs">✕</button>
              )}
            </div>

            <div className="inline-flex p-0.5 bg-slate-100 rounded-lg border border-slate-200/60 gap-0.5">
              {[
                { id: 'all', label: 'Barchasi (32)' },
                { id: 'Q1', label: 'Q1 (O\'ng Yuqori)' },
                { id: 'Q2', label: 'Q2 (Chap Yuqori)' },
                { id: 'Q3', label: 'Q3 (Chap Pastki)' },
                { id: 'Q4', label: 'Q4 (O\'ng Pastki)' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setQuadrantFilter(f.id)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer",
                    quadrantFilter === f.id
                      ? "bg-white text-slate-900 shadow-2xs border border-slate-200/60 font-black"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  {f.label}
                </button>
              ))}
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
                <span>Xarita + Jadval</span>
              </button>
              <button
                onClick={() => setViewMode('chart')}
                className={cn("px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5", viewMode === 'chart' ? "bg-white text-slate-900 shadow-2xs font-black" : "text-slate-500")}
              >
                <Activity className="w-3.5 h-3.5 text-indigo-600" />
                <span>Tish Grafiki</span>
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={cn("px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5", viewMode === 'table' ? "bg-white text-slate-900 shadow-2xs font-black" : "text-slate-500")}
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Excel Jadval</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ══ GRAPHICAL ODONTOGRAM CONTAINER ══ */}
      {(viewMode === 'both' || viewMode === 'chart') && (
        <div className="bg-white border border-slate-200/90 rounded-xl shadow-xs overflow-hidden">
          {/* Card header */}
          <div className="px-4 py-3 bg-slate-50/80 flex items-center justify-between border-b border-slate-200/80">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white text-xs font-black shrink-0 shadow-2xs">
                32
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-900">Interaktiv Tish Formulasi</span>
                </div>
                <span className="text-[10px] font-mono font-semibold text-slate-400">ODONTOGRAMMA & DIAGNOSTIKA</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setChartEditMode(v => !v)}
                className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-black uppercase tracking-wider transition-all shadow-2xs cursor-pointer flex items-center gap-1.5"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{chartEditMode ? "Tahrirni yakunlash" : "Tahrirlash"}</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-0">
            <div className="flex-1 p-2 sm:p-4 overflow-x-auto no-scrollbar min-w-0 w-full flex justify-center bg-white">
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
                quadrantFilter={quadrantFilter}
                showOcclusal={showOcclusal}
                psrScores={psrScores}
                occlusionNotes={occlusionNotes}
                onOcclusionNotesChange={handleOcclusionNotesChange}
                occlusionClass={occlusionClass}
                onOcclusionClassChange={handleOcclusionClassChange}
              />
            </div>

            {/* Right diagnostic panel */}
            <div className="shrink-0 border-t lg:border-t-0 lg:border-l border-slate-200/80 p-3.5 bg-slate-50/40 lg:w-72">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 mb-2.5 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-indigo-600" />
                <span>Aniqlangan Tashxislar</span>
              </h4>
              <div className="space-y-1.5 max-h-[350px] overflow-y-auto no-scrollbar">
                {dentalFormulaSummaryList.map((item, idx) => (
                  <div key={idx} className="p-2 rounded-lg border border-slate-200/80 bg-white hover:bg-slate-50 flex items-center justify-between text-xs transition-colors shadow-2xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-xs shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="font-bold text-slate-800 truncate" style={{ color: item.color }}>{item.name}</span>
                    </div>
                    <span className="font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded text-[11px] shrink-0 border border-slate-200/60">{item.teeth}</span>
                  </div>
                ))}
                {dentalFormulaSummaryList.length === 0 && (
                  <div className="text-xs text-slate-400 italic p-3 text-center bg-white rounded-lg border border-slate-100">Barcha tishlar sog'lom holatda</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ EXCEL 32 FDI TEETH MATRIX TABLE ══ */}
      {(viewMode === 'both' || viewMode === 'table') && (
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50/90 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">32 FDI Tish Formulalari Jurnali (Excel jadvali)</h4>
            </div>
            <span className="text-[10px] font-mono font-bold text-slate-400">EXCEL MATRIX</span>
          </div>

          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full border-collapse text-left font-sans text-xs">
              <thead>
                <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10.5px]">
                  <th className="py-2.5 px-3 border-r border-slate-200 text-center w-12 bg-slate-200/60 font-mono">№</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 font-mono text-center w-20">FDI #</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 min-w-[200px]">Tish Anatomik Nomi</th>
                  <th className="py-2.5 px-3 border-r border-slate-200">Jag' / Kvadrant</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 text-center">Holati</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 min-w-[150px]">Rejalashtirilgan Muolaja</th>
                  <th className="py-2.5 px-3">Eslatma</th>
                </tr>
              </thead>
              <tbody>
                {filteredTeeth.map((tooth) => (
                  <tr
                    key={tooth.fdi}
                    className={cn(
                      "border-b border-slate-200/70 hover:bg-sky-50/40 transition-colors",
                      tooth.idx % 2 === 0 ? "bg-slate-50/40" : "bg-white"
                    )}
                  >
                    {/* Row Index */}
                    <td className="border-r border-slate-200 text-center font-mono font-bold text-slate-400 bg-slate-100/40 text-[11px] py-2 px-2">
                      {tooth.idx}
                    </td>

                    {/* FDI Number */}
                    <td className="border-r border-slate-200 font-mono font-black text-center text-indigo-700 bg-indigo-50/30 py-2 px-2">
                      #{tooth.fdi}
                    </td>

                    {/* Tooth Name */}
                    <td className="border-r border-slate-200 font-bold text-slate-800 py-2 px-3">
                      {tooth.name}
                    </td>

                    {/* Quadrant */}
                    <td className="border-r border-slate-200 text-slate-600 py-2 px-3 font-medium">
                      {tooth.quadrant}
                    </td>

                    {/* Status Badge */}
                    <td className="border-r border-slate-200 text-center py-2 px-3">
                      {getStatusTag(tooth.statusKey)}
                    </td>

                    {/* Planned Treatment */}
                    <td className="border-r border-slate-200 text-slate-800 font-semibold py-2 px-3">
                      {tooth.treatment}
                    </td>

                    {/* Notes */}
                    <td className="text-slate-500 italic text-[11px] py-2 px-3">
                      {tooth.notes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(ExcelDentalChartView);
