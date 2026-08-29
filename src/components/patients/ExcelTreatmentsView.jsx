import { useState, useMemo, memo } from 'react';
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
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'completed' | 'in_progress' | 'planned'
  const [sortField, setSortField] = useState('date');
  const [sortAsc, setSortAsc] = useState(false);
  const [density, setDensity] = useState('compact');

  // Flatten all services across plans with plan context
  const allServicesRows = useMemo(() => {
    const rows = [];
    (plans || []).forEach((plan, pIdx) => {
      const planServices = plan.services || [];
      if (planServices.length === 0) {
        rows.push({
          id: `plan-${plan.id || pIdx}`,
          planId: plan.id,
          planName: plan.name || `Davolash rejasi #${pIdx + 1}`,
          serviceName: plan.name || 'Davolash muolajasi',
          toothNumber: plan.tooth_number || '—',
          doctorName: plan.doctor_name || patient?.doctor_name || 'Shifokor',
          price: Number(plan.total_price || 0),
          paid: Number(plan.paid_amount || 0),
          status: plan.status || 'planned',
          date: plan.created_date || plan.date || '',
          planObj: plan,
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
            paid: Number(srv.paid_amount || 0),
            status: srv.status || plan.status || 'planned',
            date: srv.date || plan.created_date || '',
            planObj: plan,
          });
        });
      }
    });
    return rows;
  }, [plans, patient]);

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

  const totalPriceAmount = useMemo(() => {
    return filteredRows.reduce((sum, r) => sum + r.price, 0);
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
      {/* ══ EXCEL SPREADSHEET TOOLBAR ══ */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Formula Bar */}
        <div className="bg-slate-50/90 px-4 py-2 border-b border-slate-200 flex items-center gap-3 text-xs font-mono">
          <div className="flex items-center gap-1.5 text-slate-400 font-black shrink-0">
            <span className="text-[#1a73e8] italic font-serif text-sm">fx</span>
            <span>=</span>
          </div>
          <div className="flex items-center gap-4 flex-wrap text-slate-700 overflow-x-auto no-scrollbar">
            <span>SUM(NARX): <b className="text-slate-900 font-black font-mono">{totalPriceAmount.toLocaleString()} UZS</b></span>
            <span className="text-slate-300">|</span>
            <span>SUM(TO'LANGAN): <b className="text-emerald-700 font-black font-mono">{Number(totalPaid || 0).toLocaleString()} UZS</b></span>
            <span className="text-slate-300">|</span>
            <span>SUM(QARZ): <b className={Number(totalDebt || 0) > 0 ? "text-rose-600 font-black font-mono" : "text-emerald-600 font-black font-mono"}>{Number(totalDebt || 0).toLocaleString()} UZS</b></span>
            <span className="text-slate-300">|</span>
            <span>JAMI QATORLAR: <b className="text-slate-900 font-black">{filteredRows.length} ta</b></span>
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
                placeholder="Muolaja, tish #, shifokor qidirish..."
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
                { id: 'completed', label: 'Bajarilgan' },
                { id: 'in_progress', label: 'Jarayonda' },
                { id: 'planned', label: 'Rejalashtirilgan' },
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
            {/* Density Toggle */}
            <button
              onClick={() => setDensity(d => d === 'compact' ? 'normal' : 'compact')}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              {density === 'compact' ? '☷ Ixcham' : '☰ Keng'}
            </button>

            {/* Add Treatment Plan Button */}
            {onOpenTreatmentModal && (
              <button
                onClick={onOpenTreatmentModal}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a73e8] hover:bg-[#1557b0] text-white rounded-lg text-xs font-black shadow-2xs transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Yangi Reja</span>
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
                <th className="py-2.5 px-3 border-r border-slate-200 font-mono text-center w-16">Tish #</th>
                <th className="py-2.5 px-3 border-r border-slate-200 min-w-[180px]">Muolaja / Xizmat Nomi</th>
                <th className="py-2.5 px-3 border-r border-slate-200 min-w-[140px]">Reja / Paket</th>
                <th className="py-2.5 px-3 border-r border-slate-200 min-w-[130px]">Shifokor</th>
                <th 
                  className="py-2.5 px-3 border-r border-slate-200 text-right cursor-pointer hover:bg-slate-200/60 transition-colors select-none min-w-[110px]"
                  onClick={() => toggleSort('price')}
                >
                  <div className="flex items-center justify-end gap-1 font-mono">
                    <span>Narxi</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-2.5 px-3 border-r border-slate-200 text-center min-w-[110px]">Holati</th>
                <th 
                  className="py-2.5 px-3 border-r border-slate-200 font-mono cursor-pointer hover:bg-slate-200/60 transition-colors select-none min-w-[100px]"
                  onClick={() => toggleSort('date')}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span>Sana</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-2.5 px-3 text-center min-w-[90px]">Faktura</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 italic bg-slate-50/50">
                    <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    Hech qanday davolash muolajalari topilmadi.
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
                        "border-r border-slate-200 text-center font-mono font-bold text-slate-400 bg-slate-100/40 text-[11px]",
                        density === 'compact' ? 'py-2 px-2' : 'py-3 px-3'
                      )}>
                        {idx + 1}
                      </td>

                      {/* Tooth # */}
                      <td className={cn(
                        "border-r border-slate-200 font-mono font-black text-center text-indigo-700 bg-indigo-50/30",
                        density === 'compact' ? 'py-2 px-2' : 'py-3 px-2'
                      )}>
                        {row.toothNumber && row.toothNumber !== '—' ? `#${row.toothNumber}` : '—'}
                      </td>

                      {/* Service Name */}
                      <td className={cn(
                        "border-r border-slate-200 font-bold text-slate-800",
                        density === 'compact' ? 'py-2 px-3' : 'py-3 px-3'
                      )}>
                        {row.serviceName}
                      </td>

                      {/* Plan Context */}
                      <td className={cn(
                        "border-r border-slate-200 text-slate-600 text-[11px]",
                        density === 'compact' ? 'py-2 px-3' : 'py-3 px-3'
                      )}>
                        {row.planName}
                      </td>

                      {/* Doctor */}
                      <td className={cn(
                        "border-r border-slate-200 font-medium text-slate-700",
                        density === 'compact' ? 'py-2 px-3' : 'py-3 px-3'
                      )}>
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{row.doctorName}</span>
                        </div>
                      </td>

                      {/* Price */}
                      <td className={cn(
                        "border-r border-slate-200 text-right font-mono font-bold text-slate-900",
                        density === 'compact' ? 'py-2 px-3' : 'py-3 px-3'
                      )}>
                        {row.price.toLocaleString()} UZS
                      </td>

                      {/* Status */}
                      <td className={cn(
                        "border-r border-slate-200 text-center",
                        density === 'compact' ? 'py-2 px-2' : 'py-3 px-2'
                      )}>
                        {getStatusBadge(row.status)}
                      </td>

                      {/* Date */}
                      <td className={cn(
                        "border-r border-slate-200 font-mono text-slate-600",
                        density === 'compact' ? 'py-2 px-3' : 'py-3 px-3'
                      )}>
                        {dateStr}
                      </td>

                      {/* Action */}
                      <td className={cn(
                        "text-center",
                        density === 'compact' ? 'py-1.5 px-2' : 'py-2 px-2'
                      )}>
                        <button
                          onClick={() => onOpenPlanInvoice && onOpenPlanInvoice(row.planObj)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-[10.5px] font-bold transition-all shadow-2xs cursor-pointer"
                          title="Faktura ko'rish va chop etish"
                        >
                          <span>Faktura</span>
                          <ExternalLink className="w-3 h-3" />
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
                <tr className="bg-slate-100/95 font-mono font-black text-slate-900 border-t-2 border-slate-300 text-xs">
                  <td colSpan={5} className="py-2.5 px-4 text-right uppercase tracking-wider font-sans text-[11px] border-r border-slate-200">
                    JAMI HISOB-KITOB:
                  </td>
                  <td className="py-2.5 px-3 text-right text-indigo-900 border-r border-slate-200">
                    {totalPriceAmount.toLocaleString()} UZS
                  </td>
                  <td colSpan={3} className="py-2.5 px-3 text-slate-500 font-normal italic text-[11px]">
                    {filteredRows.length} ta operatsiya
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
