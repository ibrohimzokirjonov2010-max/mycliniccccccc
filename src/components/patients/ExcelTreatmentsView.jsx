import { useState, useMemo, memo } from 'react';
import { useTranslation } from '@/i18n/LanguageContext';
import { 
  Plus, Search, FileSpreadsheet, 
  ArrowUpDown, ExternalLink, User,
  CheckCircle2, Clock, ClipboardList, FileText, ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * ExcelTreatmentsView – Responsive Treatment Plans View
 * Mobile: Professional card layout | Desktop: Table layout
 */
function ExcelTreatmentsView({
  patient,
  plans = [],
  totalPaid = 0,
  totalDebt = 0,
  onOpenTreatmentModal,
  onOpenPlanInvoice,
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('date');
  const [sortAsc, setSortAsc] = useState(false);

  // Flatten all services across all plans
  const allServicesRows = useMemo(() => {
    const rows = [];
    const effectiveTotalPaid = Math.max(Number(totalPaid || 0), Number(patient?.total_paid || 0));

    (plans || []).forEach((plan, pIdx) => {
      const planPrice = Number(plan.total_price || 0);
      const planPaid = plans.length === 1
        ? Math.min(planPrice, Math.max(Number(plan.paid_amount || 0), effectiveTotalPaid))
        : Number(plan.paid_amount || 0);

      const planServices = plan.services || [];
      if (planServices.length === 0) {
        rows.push({
          id: `plan-${plan.id || pIdx}`,
          planId: plan.id,
          planName: plan.name || `Davolash rejasi #${pIdx + 1}`,
          serviceName: plan.name || 'Davolash muolajasi',
          toothNumber: plan.tooth_number || '—',
          doctorName: plan.doctor_name || patient?.doctor_name || 'Shifokor',
          price: planPrice,
          status: plan.status || 'planned',
          date: plan.created_date || plan.date || '',
          planObj: { ...plan, paid_amount: planPaid },
        });
      } else {
        planServices.forEach((srv, sIdx) => {
          rows.push({
            id: `srv-${plan.id || pIdx}-${sIdx}`,
            planId: plan.id,
            planName: plan.name || `Davolash rejasi #${pIdx + 1}`,
            serviceName: srv.name || srv.service_name || 'Muolaja',
            toothNumber: srv.tooth_number || plan.tooth_number || '—',
            doctorName: srv.doctor || plan.doctor_name || patient?.doctor_name || 'Shifokor',
            price: Number(srv.price || srv.cost || 0),
            status: srv.status || plan.status || 'planned',
            date: srv.date || plan.created_date || '',
            planObj: { ...plan, paid_amount: planPaid },
          });
        });
      }
    });
    return rows;
  }, [plans, patient, totalPaid]);

  // Filter & sort
  const filteredRows = useMemo(() => {
    let list = [...allServicesRows];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(r =>
        r.serviceName.toLowerCase().includes(q) ||
        r.planName.toLowerCase().includes(q) ||
        String(r.toothNumber).includes(q) ||
        r.doctorName.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      const valA = sortField === 'date'
        ? new Date(a.date || 0).getTime()
        : sortField === 'price' ? a.price : (a[sortField] || '');
      const valB = sortField === 'date'
        ? new Date(b.date || 0).getTime()
        : sortField === 'price' ? b.price : (b[sortField] || '');
      return sortAsc ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
    });

    return list;
  }, [allServicesRows, search, sortField, sortAsc]);

  // Totals
  const { totalOriginal, totalDiscount, totalFinal } = useMemo(() => {
    const orig = filteredRows.reduce((acc, r) => acc + Number(r.price || 0), 0);
    const uniquePlansMap = new Map();
    filteredRows.forEach(r => r.planObj?.id && uniquePlansMap.set(r.planObj.id, r.planObj));
    let disc = 0;
    uniquePlansMap.forEach(plan => {
      let pDisc = Number(plan.discount_amount || 0);
      if (!pDisc && Number(plan.discount_percent) > 0) {
        const planServicesRaw = (plan.services || []).reduce((s, x) => s + Number(x.price || x.cost || 0), 0);
        const raw = planServicesRaw > 0 ? planServicesRaw : Number(plan.total_price || 0);
        pDisc = Math.floor(raw * (Number(plan.discount_percent) / 100));
      } else if (!pDisc && Number(plan.total_price) > 0) {
        const planServicesRaw = (plan.services || []).reduce((s, x) => s + Number(x.price || x.cost || 0), 0);
        if (planServicesRaw > Number(plan.total_price)) pDisc = planServicesRaw - Number(plan.total_price);
      }
      disc += pDisc;
    });
    disc = Math.max(0, disc);
    return { totalOriginal: orig, totalDiscount: disc, totalFinal: Math.max(0, orig - disc) };
  }, [filteredRows]);

  const getStatusBadge = (status) => {
    const s = (status || '').toLowerCase();
    if (s === 'completed' || s === 'bajarildi') return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[9px] uppercase tracking-wide">
        <CheckCircle2 className="w-3 h-3" />Bajarildi
      </span>
    );
    if (s === 'in_progress' || s === 'jarayonda') return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-bold text-[9px] uppercase tracking-wide">
        <Clock className="w-3 h-3" />Jarayonda
      </span>
    );
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-bold text-[9px] uppercase tracking-wide">
        <ClipboardList className="w-3 h-3" />Rejada
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
            placeholder={t('patientProfile.searchTreatments') || "Muolaja, tish #, shifokor qidirish..."}
            className="w-full pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1499AD]/30 focus:border-[#1499AD] transition-all"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 w-5 h-5 flex items-center justify-center rounded-full hover:bg-slate-100 transition-all text-xs">✕</button>
          )}
        </div>
        {onOpenTreatmentModal && (
          <button
            onClick={onOpenTreatmentModal}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1499AD] hover:bg-[#117a8c] text-white rounded-xl text-sm font-black shadow-sm shadow-[#1499AD]/20 transition-all active:scale-95 whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            + {t('patientProfile.newPlan') || 'Yangi Reja'}
          </button>
        )}
      </div>

      {/* ── MOBILE CARDS (visible only on small screens) ── */}
      <div className="md:hidden space-y-2.5">
        {filteredRows.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 py-14 text-center flex flex-col items-center gap-3">
            <FileSpreadsheet className="w-10 h-10 text-slate-200" />
            <p className="text-slate-400 text-sm font-semibold">
              {t('patientProfile.noTreatmentsFound') || "Davolash muolajalari topilmadi"}
            </p>
          </div>
        ) : (
          <>
            {filteredRows.map((row, idx) => {
              const dateStr = row.date ? new Date(row.date).toLocaleDateString('uz-UZ') : '—';
              const toothDisplay = row.toothNumber && row.toothNumber !== '—';

              return (
                <div
                  key={row.id || idx}
                  className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
                >
                  {/* Card Top */}
                  <div className="flex items-start gap-3 p-3.5 pb-2.5">
                    {/* Tooth avatar */}
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                      {toothDisplay ? (
                        <span className="text-[11px] font-black text-indigo-700 leading-none">#{row.toothNumber}</span>
                      ) : (
                        <span className="text-base">🦷</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-black text-slate-900 leading-tight line-clamp-2">
                        {row.serviceName}
                      </p>
                      <p className="text-[10px] font-semibold text-slate-400 mt-0.5 truncate">
                        {row.planName}
                      </p>
                    </div>
                    {getStatusBadge(row.status)}
                  </div>

                  {/* Card stats row */}
                  <div className="grid grid-cols-3 gap-px bg-slate-100 border-t border-slate-100">
                    <div className="bg-white px-3 py-2.5">
                      <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Narxi</p>
                      <p className="text-sm font-black text-slate-900 mt-0.5 leading-none">
                        {row.price.toLocaleString()}
                        <span className="text-[8px] font-bold text-slate-400 ml-0.5">so'm</span>
                      </p>
                    </div>
                    <div className="bg-white px-3 py-2.5">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Sana</p>
                      <p className="text-[11px] font-bold text-slate-700 mt-0.5 leading-none">{dateStr}</p>
                    </div>
                    <div className="bg-white px-3 py-2.5">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Shifokor</p>
                      <p className="text-[10px] font-bold text-slate-700 mt-0.5 leading-none truncate">{row.doctorName}</p>
                    </div>
                  </div>

                  {/* Card footer */}
                  {onOpenPlanInvoice && (
                    <div className="px-3.5 py-2.5 bg-slate-50 border-t border-slate-100">
                      <button
                        onClick={() => onOpenPlanInvoice(row.planObj)}
                        className="w-full flex items-center justify-center gap-2 py-2 bg-slate-900 hover:bg-slate-700 text-white rounded-xl text-[11px] font-black transition-all active:scale-95"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        {t('patientProfile.invoiceBtn') || "Faktura ko'rish"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Mobile Total Summary */}
            <div className="bg-gradient-to-r from-[#1499AD] to-[#0d7a8a] rounded-2xl p-4 shadow-lg shadow-[#1499AD]/20">
              <p className="text-[9px] font-black text-white/60 uppercase tracking-widest mb-2.5">
                Jami: {filteredRows.length} ta muolaja
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center bg-white/10 rounded-xl py-2 px-1">
                  <p className="text-[8px] font-bold text-white/70 uppercase tracking-wider">Asosiy</p>
                  <p className="text-sm font-black text-white mt-0.5 leading-none">{totalOriginal.toLocaleString()}</p>
                  <p className="text-[7px] text-white/50 mt-0.5">so'm</p>
                </div>
                <div className="text-center bg-white/10 rounded-xl py-2 px-1">
                  <p className="text-[8px] font-bold text-white/70 uppercase tracking-wider">Chegirma</p>
                  <p className="text-sm font-black text-white mt-0.5 leading-none">-{totalDiscount.toLocaleString()}</p>
                  <p className="text-[7px] text-white/50 mt-0.5">so'm</p>
                </div>
                <div className="text-center bg-white/20 rounded-xl py-2 px-1 border border-white/20">
                  <p className="text-[8px] font-black text-white/90 uppercase tracking-wider">Jami</p>
                  <p className="text-sm font-black text-white mt-0.5 leading-none">{totalFinal.toLocaleString()}</p>
                  <p className="text-[7px] text-white/70 mt-0.5">so'm</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── DESKTOP TABLE (hidden on mobile) ── */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-black uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4 border-r border-slate-100 w-10 text-center">№</th>
                <th className="py-3 px-4 border-r border-slate-100 w-16 text-center">{t('patientProfile.toothCol') || "Tish"}</th>
                <th className="py-3 px-4 border-r border-slate-100 min-w-[180px]">{t('patientProfile.treatmentServiceCol') || "Muolaja / Xizmat"}</th>
                <th className="py-3 px-4 border-r border-slate-100 min-w-[140px]">{t('patientProfile.planPackageCol') || "Reja / Paket"}</th>
                <th className="py-3 px-4 border-r border-slate-100 min-w-[120px]">{t('patientProfile.doctorCol') || "Shifokor"}</th>
                <th
                  className="py-3 px-4 border-r border-slate-100 text-right cursor-pointer hover:bg-slate-100 transition-colors min-w-[110px] select-none"
                  onClick={() => { setSortField('price'); setSortAsc(sortField === 'price' ? !sortAsc : false); }}
                >
                  <div className="flex items-center justify-end gap-1">
                    {t('common.price') || "Narxi"}
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  className="py-3 px-4 border-r border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors min-w-[100px] select-none"
                  onClick={() => { setSortField('date'); setSortAsc(sortField === 'date' ? !sortAsc : false); }}
                >
                  <div className="flex items-center gap-1">
                    {t('common.date') || "Sana"}
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-4 text-center min-w-[90px]">{t('patientProfile.invoiceCol') || "Faktura"}</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-14 text-center">
                    <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 text-slate-200" />
                    <p className="text-slate-400 text-sm font-semibold">
                      {t('patientProfile.noTreatmentsFound') || "Davolash muolajalari topilmadi."}
                    </p>
                  </td>
                </tr>
              ) : filteredRows.map((row, idx) => {
                const dateStr = row.date ? new Date(row.date).toLocaleDateString('uz-UZ') : '—';
                return (
                  <tr
                    key={row.id || idx}
                    className={cn("border-b border-slate-100 hover:bg-sky-50/30 transition-colors", idx % 2 === 1 && "bg-slate-50/30")}
                  >
                    <td className="py-2 px-4 text-center font-mono text-[11px] text-slate-400 border-r border-slate-100">{idx + 1}</td>
                    <td className="py-2 px-4 text-center font-mono font-black text-indigo-600 text-sm border-r border-slate-100">
                      {row.toothNumber && row.toothNumber !== '—' ? `#${row.toothNumber}` : '—'}
                    </td>
                    <td className="py-2 px-4 font-bold text-slate-900 border-r border-slate-100">{row.serviceName}</td>
                    <td className="py-2 px-4 text-slate-500 text-xs border-r border-slate-100">{row.planName}</td>
                    <td className="py-2 px-4 border-r border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                        <span className="text-sm text-slate-700 font-medium">{row.doctorName}</span>
                      </div>
                    </td>
                    <td className="py-2 px-4 text-right font-mono font-black text-slate-900 border-r border-slate-100">
                      {row.price.toLocaleString()} <span className="text-[10px] font-bold text-slate-400">UZS</span>
                    </td>
                    <td className="py-2 px-4 text-sm text-slate-500 font-mono border-r border-slate-100">{dateStr}</td>
                    <td className="py-2 px-4 text-center">
                      <button
                        onClick={() => onOpenPlanInvoice && onOpenPlanInvoice(row.planObj)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-700 text-white rounded-lg text-[11px] font-bold transition-all cursor-pointer active:scale-95"
                      >
                        {t('patientProfile.invoiceBtn') || "Faktura"}
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {filteredRows.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-200">
                  <td colSpan={5} className="py-3 px-4 text-right border-r border-slate-200">
                    <span className="font-black uppercase tracking-wider text-slate-700 text-[11px]">
                      {t('patientProfile.totalCalc') || "JAMI HISOB-KITOB:"}
                    </span>
                    <br />
                    <span className="text-[10px] text-slate-400 font-bold">
                      {filteredRows.length} {t('patientProfile.proceduresCount') || "ta muolaja"}
                    </span>
                  </td>
                  <td colSpan={3} className="py-3 px-4">
                    <div className="flex items-center justify-end gap-4 flex-wrap">
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] uppercase font-bold text-slate-400">{t('patientProfile.totalWithoutDiscount') || "Asosiy"}</span>
                        <span className={cn("font-mono font-bold text-sm text-slate-700", totalDiscount > 0 && "line-through text-slate-300")}>
                          {totalOriginal.toLocaleString()} UZS
                        </span>
                      </div>
                      {totalDiscount > 0 && (
                        <div className="flex flex-col items-end bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200">
                          <span className="text-[9px] uppercase font-black text-amber-700">Chegirma</span>
                          <span className="font-mono font-black text-amber-800 text-sm">-{totalDiscount.toLocaleString()} UZS</span>
                        </div>
                      )}
                      <div className="flex flex-col items-end bg-[#1499AD]/10 px-4 py-2 rounded-xl border border-[#1499AD]/20">
                        <span className="text-[9px] uppercase font-black text-[#1499AD]">{t('patientProfile.totalWithDiscount') || "Jami Summa"}</span>
                        <span className="font-mono font-black text-[#0d7a8a] text-lg">{totalFinal.toLocaleString()} UZS</span>
                      </div>
                    </div>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

export default memo(ExcelTreatmentsView);
