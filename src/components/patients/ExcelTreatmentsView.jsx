import { useState, useMemo, memo } from 'react';
import { useTranslation } from '@/i18n/LanguageContext';
import { 
  Plus, Search, FileSpreadsheet, 
  ArrowUpDown, ExternalLink, User,
  CheckCircle2, Clock, ClipboardList
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * ExcelTreatmentsView Component
 * High-productivity Excel Spreadsheet View for Patient Treatment Plans & Dental Services.
 */
function ExcelTreatmentsView({
  patient,
  plans = [],
  totalPaid = 0,
  totalDebt = 0,
  onOpenTreatmentModal,
  onOpenPlanInvoice,
}) {
  const { t, language } = useTranslation();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'completed' | 'in_progress' | 'planned'
  const [sortField, setSortField] = useState('date');
  const [sortAsc, setSortAsc] = useState(false);
  const [density, setDensity] = useState('compact');

  // Flatten all services across plans with plan context
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
          paid: planPaid,
          status: plan.status || 'planned',
          date: plan.created_date || plan.date || '',
          planObj: { ...plan, paid_amount: planPaid },
        });
      } else {
        planServices.forEach((srv, sIdx) => {
          const srvPrice = Number(srv.price || srv.cost || 0);
          rows.push({
            id: `srv-${plan.id || pIdx}-${sIdx}`,
            planId: plan.id,
            planName: plan.name || `Davolash rejasi #${pIdx + 1}`,
            serviceName: srv.name || srv.service_name || 'Muolaja',
            toothNumber: srv.tooth_number || plan.tooth_number || '—',
            doctorName: srv.doctor || plan.doctor_name || patient?.doctor_name || 'Shifokor',
            price: srvPrice,
            paid: Number(srv.paid_amount || 0) || (planPaid >= planPrice ? srvPrice : 0),
            status: srv.status || plan.status || 'planned',
            date: srv.date || plan.created_date || '',
            planObj: { ...plan, paid_amount: planPaid },
          });
        });
      }
    });
    return rows;
  }, [plans, patient, totalPaid]);

  // Filtered & Sorted rows
  const filteredRows = useMemo(() => {
    let list = [...allServicesRows];

    if (statusFilter !== 'all') {
      list = list.filter(r => {
        if (statusFilter === 'completed') return r.status === 'completed' || r.status === 'Bajarildi';
        if (statusFilter === 'in_progress') return r.status === 'in_progress' || r.status === 'Jarayonda';
        if (statusFilter === 'planned') return r.status === 'planned' || r.status === 'Rejalashtirilgan' || !r.status;
        return true;
      });
    }

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(r => 
        r.serviceName.toLowerCase().includes(q) ||
        r.planName.toLowerCase().includes(q) ||
        String(r.toothNumber).includes(q) ||
        r.doctorName.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];
      if (sortField === 'price') {
        valA = a.price;
        valB = b.price;
      } else if (sortField === 'date') {
        valA = new Date(a.date || 0).getTime();
        valB = new Date(b.date || 0).getTime();
      }
      return sortAsc ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
    });

    return list;
  }, [allServicesRows, search, statusFilter, sortField, sortAsc]);

  const { totalOriginal, totalDiscount, totalFinal } = useMemo(() => {
    let orig = 0;
    let disc = 0;

    // Sum service prices before discount
    filteredRows.forEach(r => {
      orig += Number(r.price || 0);
    });

    // Calculate discount from unique plans associated with filtered rows
    const uniquePlansMap = new Map();
    filteredRows.forEach(r => {
      if (r.planObj && r.planObj.id) {
        uniquePlansMap.set(r.planObj.id, r.planObj);
      }
    });

    uniquePlansMap.forEach(plan => {
      const planServicesRaw = (plan.services || []).reduce((s, x) => s + Number(x.price || x.cost || 0), 0);
      const raw = planServicesRaw > 0 ? planServicesRaw : Number(plan.total_price || 0);
      
      let pDisc = Number(plan.discount_amount || 0);
      if (!pDisc && Number(plan.discount_percent) > 0) {
        pDisc = Math.floor(raw * (Number(plan.discount_percent) / 100));
      } else if (!pDisc && Number(plan.total_price) > 0 && raw > Number(plan.total_price)) {
        pDisc = raw - Number(plan.total_price);
      }
      disc += pDisc;
    });

    disc = Math.max(0, disc);
    const fin = Math.max(0, orig - disc);

    return {
      totalOriginal: orig,
      totalDiscount: disc,
      totalFinal: fin,
    };
  }, [filteredRows]);

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
    if (s === 'completed' || s === 'bajarildi') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px]">
          <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
          <span>Bajarildi</span>
        </span>
      );
    }
    if (s === 'in_progress' || s === 'jarayonda') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 font-bold text-[10px]">
          <Clock className="w-3 h-3 text-amber-600 shrink-0" />
          <span>Jarayonda</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-bold text-[10px]">
        <ClipboardList className="w-3 h-3 text-blue-600 shrink-0" />
        <span>Rejada</span>
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
                placeholder={t('patientProfile.searchTreatments') || "Muolaja, tish #, shifokor qidirish..."}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#1a73e8]"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs">✕</button>
              )}
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Add Treatment Plan Button */}
            {onOpenTreatmentModal && (
              <button
                onClick={onOpenTreatmentModal}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a73e8] hover:bg-[#1557b0] text-white rounded-lg text-xs font-black shadow-2xs transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ {t('patientProfile.newPlan') || 'Yangi Reja'}</span>
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
                <th className="py-3 px-3.5 border-r border-slate-200 font-mono text-center w-16">{t('patientProfile.toothCol') || "Tish #"}</th>
                <th className="py-3 px-3.5 border-r border-slate-200 min-w-[180px]">{t('patientProfile.treatmentServiceCol') || "Muolaja / Xizmat Nomi"}</th>
                <th className="py-3 px-3.5 border-r border-slate-200 min-w-[140px]">{t('patientProfile.planPackageCol') || "Reja / Paket"}</th>
                <th className="py-3 px-3.5 border-r border-slate-200 min-w-[130px]">{t('patientProfile.doctorCol') || "Shifokor"}</th>
                <th 
                  className="py-3 px-3.5 border-r border-slate-200 text-right cursor-pointer hover:bg-slate-200/60 transition-colors select-none min-w-[120px]"
                  onClick={() => toggleSort('price')}
                >
                  <div className="flex items-center justify-end gap-1.5 font-mono">
                    <span>{t('patientProfile.priceCol') || t('common.price') || "Narxi"}</span>
                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </th>
                <th 
                  className="py-3 px-3.5 border-r border-slate-200 font-mono cursor-pointer hover:bg-slate-200/60 transition-colors select-none min-w-[110px]"
                  onClick={() => toggleSort('date')}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span>{t('patientProfile.dateCol') || t('common.date') || "Sana"}</span>
                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-3.5 text-center min-w-[90px]">{t('patientProfile.invoiceCol') || "Faktura"}</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 italic bg-slate-50/50">
                    <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    {t('patientProfile.noTreatmentsFound') || "Hech qanday davolash muolajalari topilmadi."}
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => {
                  const dateStr = row.date ? new Date(row.date).toLocaleDateString('uz-UZ') : '—';

                  return (
                    <tr
                      key={row.id || idx}
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

                      {/* Tooth # */}
                      <td className={cn(
                        "border-r border-slate-200 font-mono font-black text-center text-indigo-700 bg-indigo-50/40 text-sm",
                        density === 'compact' ? 'py-3.5 px-3' : 'py-4.5 px-3.5'
                      )}>
                        {row.toothNumber && row.toothNumber !== '—' ? `#${row.toothNumber}` : '—'}
                      </td>

                      {/* Service Name */}
                      <td className={cn(
                        "border-r border-slate-200 font-bold text-slate-900 text-sm",
                        density === 'compact' ? 'py-3.5 px-3.5' : 'py-4.5 px-4'
                      )}>
                        {row.serviceName}
                      </td>

                      {/* Plan Context */}
                      <td className={cn(
                        "border-r border-slate-200 text-slate-600 text-xs sm:text-sm font-medium",
                        density === 'compact' ? 'py-3.5 px-3.5' : 'py-4.5 px-4'
                      )}>
                        {row.planName}
                      </td>

                      {/* Doctor */}
                      <td className={cn(
                        "border-r border-slate-200 font-semibold text-slate-800 text-xs sm:text-sm",
                        density === 'compact' ? 'py-3.5 px-3.5' : 'py-4.5 px-4'
                      )}>
                        <div className="flex items-center gap-1.5">
                          <User className="w-4 h-4 text-slate-400 shrink-0" />
                          <span>{row.doctorName}</span>
                        </div>
                      </td>

                      {/* Price */}
                      <td className={cn(
                        "border-r border-slate-200 text-right font-mono font-black text-slate-950 text-sm sm:text-base tracking-tight",
                        density === 'compact' ? 'py-3.5 px-3.5' : 'py-4.5 px-4'
                      )}>
                        {row.price.toLocaleString()} UZS
                      </td>

                      {/* Date */}
                      <td className={cn(
                        "border-r border-slate-200 font-mono font-semibold text-slate-700 text-xs sm:text-sm",
                        density === 'compact' ? 'py-3.5 px-3.5' : 'py-4.5 px-4'
                      )}>
                        {dateStr}
                      </td>

                      {/* Action */}
                      <td className={cn(
                        "text-center",
                        density === 'compact' ? 'py-3 px-3' : 'py-4 px-3.5'
                      )}>
                        <button
                          onClick={() => onOpenPlanInvoice && onOpenPlanInvoice(row.planObj)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
                          title="Faktura ko'rish va chop etish"
                        >
                          <span>{t('patientProfile.invoiceBtn') || "Faktura"}</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {/* Total Row */}
            {filteredRows.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100/95 font-sans border-t-2 border-slate-300">
                  <td colSpan={5} className="py-3.5 px-4 text-right border-r border-slate-200">
                    <span className="font-black uppercase tracking-wider text-slate-900 text-xs sm:text-sm block">
                      {t('patientProfile.totalCalc') || "JAMI HISOB-KITOB:"}
                    </span>
                    <span className="text-xs text-slate-600 font-bold font-mono">
                      {filteredRows.length} {t('patientProfile.proceduresCount') || "ta muolaja"}
                    </span>
                  </td>
                  <td colSpan={3} className="py-3 px-4 bg-slate-50/80">
                    <div className="flex items-center justify-end gap-4 flex-wrap">
                      {/* Chegirmasiz summa */}
                      <div className="flex flex-col items-end">
                        <span className="text-[11px] uppercase font-bold text-slate-500">{t('patientProfile.totalWithoutDiscount') || "Chegirmasiz summa"}</span>
                        <span className={cn("font-mono font-bold text-sm text-slate-800", totalDiscount > 0 && "line-through text-slate-400")}>
                          {totalOriginal.toLocaleString()} UZS
                        </span>
                      </div>

                      {/* Chegirma */}
                      {totalDiscount > 0 ? (
                        <div className="flex flex-col items-end bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200/90">
                          <span className="text-[10px] uppercase font-black text-amber-800">{t('patientProfile.discount') || "Chegirma"}</span>
                          <span className="font-mono font-black text-amber-900 text-sm">
                            -{totalDiscount.toLocaleString()} UZS
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-end">
                          <span className="text-[11px] uppercase font-bold text-slate-500">{t('patientProfile.discount') || "Chegirma"}</span>
                          <span className="font-mono font-medium text-slate-400 text-sm">0 UZS</span>
                        </div>
                      )}

                      {/* Chegirmali yakuniy summa */}
                      <div className="flex flex-col items-end bg-indigo-50 px-3.5 py-1.5 rounded-xl border border-indigo-200">
                        <span className="text-[11px] uppercase font-black text-indigo-700">{t('patientProfile.totalWithDiscount') || "Chegirmali Jami Summa"}</span>
                        <span className="font-mono font-black text-indigo-950 text-base sm:text-lg">
                          {totalFinal.toLocaleString()} UZS
                        </span>
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
