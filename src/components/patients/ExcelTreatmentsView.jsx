import { useState, useMemo, memo, Fragment } from 'react';
import { useTranslation } from '@/i18n/LanguageContext';
import {
  Plus, Search, FileSpreadsheet,
  ArrowUpDown, ExternalLink, User,
  CheckCircle2, Clock, ClipboardList, FileText, ChevronRight,
  Calculator, Trash2, Lock, Pencil
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import TreatmentDeleteDialog from './TreatmentDeleteDialog';
import { displayServiceName, formatDoctorName } from '@/lib/displayText';
import { PLAN_LOCKED_BADGE, PLAN_LOCKED_TOOLTIP } from '@/lib/planLock';
import {
  isPlanLocked,
  isDoneStatus,
  numberPlans,
  planPaid,
  planProgress,
  planStatusKey,
  planTitle,
  planToothList,
  planTotal,
} from '@/lib/planGroups';
import { isImplantPlan } from '@/lib/implantPlanModel';

const formatDate = (value) => {
  const dt = value ? new Date(value) : null;
  if (!dt || isNaN(dt.getTime())) return value || '—';
  return `${String(dt.getDate()).padStart(2, '0')}.${String(dt.getMonth() + 1).padStart(2, '0')}.${dt.getFullYear()}`;
};

function StatusBadge({ status }) {
  const s = String(status || '').toLowerCase();
  if (s === 'completed' || s === 'bajarildi' || s === 'bajarilgan') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[9px] uppercase tracking-wide whitespace-nowrap">
      <CheckCircle2 className="w-3 h-3" />Bajarildi
    </span>
  );
  if (s === 'in_progress' || s === 'jarayonda') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-bold text-[9px] uppercase tracking-wide whitespace-nowrap">
      <Clock className="w-3 h-3" />Jarayonda
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-bold text-[9px] uppercase tracking-wide whitespace-nowrap">
      <ClipboardList className="w-3 h-3" />Rejada
    </span>
  );
}

function LockIcon({ className = '' }) {
  return (
    <span
      data-testid="plan-locked-icon"
      title={PLAN_LOCKED_TOOLTIP}
      aria-label={PLAN_LOCKED_BADGE}
      className={cn('inline-flex items-center shrink-0 text-amber-600', className)}
    >
      <Lock className="w-3.5 h-3.5" />
    </span>
  );
}

/**
 * ExcelTreatmentsView – "Davolash rejalari": har bir reja = bitta qator.
 * Qatorni bosganda faqat shu rejaning xizmatlari ochiladi (accordion).
 * Mobile: kartalar | Desktop: jadval
 */
function ExcelTreatmentsView({
  patient,
  plans = [],
  totalPaid = 0,
  onOpenTreatmentModal,
  onOpenPlanInvoice,
  onDeleteTreatment,
  onRenamePlan,
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('date');
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [renaming, setRenaming] = useState(null); // { id, value }

  const planGroups = useMemo(() => {
    const effectiveTotalPaid = Math.max(Number(totalPaid || 0), Number(patient?.total_paid || 0));
    const numberOf = numberPlans(plans);
    return (plans || []).map((plan, pIdx) => {
      const number = numberOf(plan, pIdx);
      const total = planTotal(plan);
      const paid = planPaid(plan, plans, effectiveTotalPaid);
      const planObj = { ...plan, paid_amount: paid };
      const locked = isPlanLocked(plan);
      const rawServices = plan.services || [];
      const serviceRows = rawServices.length === 0
        ? [{
            id: `plan-${plan.id || pIdx}`,
            planId: plan.id,
            serviceIndex: 0,
            serviceName: plan.name || 'Davolash muolajasi',
            toothNumber: plan.tooth_number || '—',
            doctorName: formatDoctorName(plan.doctor_name || patient?.doctor_name) || 'Shifokor',
            price: Number(plan.total_price || 0),
            status: plan.status || 'planned',
            date: plan.created_date || plan.date || '',
            planLocked: locked,
            planServiceCount: 0,
            planObj,
          }]
        : rawServices.map((srv, sIdx) => ({
            id: `srv-${plan.id || pIdx}-${sIdx}`,
            planId: plan.id,
            serviceIndex: sIdx,
            serviceName: displayServiceName(srv.name || srv.service_name || 'Muolaja'),
            toothNumber: srv.tooth_number || plan.tooth_number || '—',
            doctorName: formatDoctorName(srv.doctor || plan.doctor_name || patient?.doctor_name) || 'Shifokor',
            price: Number(srv.price || srv.cost || 0),
            status: srv.status || (srv.completed ? 'completed' : plan.status) || 'planned',
            date: srv.date || plan.created_date || '',
            planLocked: locked,
            planServiceCount: rawServices.length,
            planObj,
          }));
      const progress = planProgress(plan);
      return {
        id: plan.id ?? `idx-${pIdx}`,
        plan,
        planObj,
        number,
        title: planTitle(number, plan),
        rawName: plan.name || '',
        teeth: planToothList(plan),
        date: plan.created_date || plan.date || '',
        total,
        paid,
        debt: Math.max(0, total - paid),
        status: planStatusKey(plan),
        locked,
        serviceRows,
        serviceCount: rawServices.length || serviceRows.length,
        progress,
      };
    });
  }, [plans, patient, totalPaid]);

  const query = search.trim().toLowerCase();

  // Filter: reja nomi/tish/shifokor/xizmat bo'yicha. Reja nomi mos kelsa - barcha xizmatlari, aks holda faqat mos xizmatlar.
  const visibleGroups = useMemo(() => {
    let list = planGroups.map((group) => ({ ...group, visibleRows: group.serviceRows }));
    if (query) {
      list = list.map((group) => {
        const planHit = group.title.toLowerCase().includes(query)
          || group.rawName.toLowerCase().includes(query)
          || group.teeth.some((tooth) => tooth.includes(query));
        const rows = planHit
          ? group.serviceRows
          : group.serviceRows.filter((row) =>
              row.serviceName.toLowerCase().includes(query)
              || String(row.toothNumber).toLowerCase().includes(query)
              || row.doctorName.toLowerCase().includes(query));
        return { ...group, visibleRows: rows, matched: rows.length > 0 };
      }).filter((group) => group.matched);
    }
    list.sort((a, b) => {
      const valA = sortField === 'date' ? new Date(a.date || 0).getTime() : sortField === 'price' ? a.total : a.number;
      const valB = sortField === 'date' ? new Date(b.date || 0).getTime() : sortField === 'price' ? b.total : b.number;
      if (valA === valB) return b.number - a.number;
      return sortAsc ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
    });
    return list;
  }, [planGroups, query, sortField, sortAsc]);

  const totals = useMemo(() => visibleGroups.reduce((acc, group) => {
    acc.total += group.total;
    acc.paid += group.paid;
    acc.debt += group.debt;
    acc.services += group.visibleRows.length;
    return acc;
  }, { total: 0, paid: 0, debt: 0, services: 0 }), [visibleGroups]);

  const allRows = useMemo(() => planGroups.flatMap((group) => group.serviceRows), [planGroups]);
  const doneCount = allRows.filter((row) => isDoneStatus(row.status)).length;
  const progressLabel = `${doneCount}/${allRows.length || 0}`;

  const isOpen = (group) => (query ? true : expandedId === group.id);
  const toggle = (group) => setExpandedId((prev) => (prev === group.id ? null : group.id));

  const sortBy = (field) => { setSortField(field); setSortAsc(sortField === field ? !sortAsc : false); };

  const renderServices = (group, variant) => (
    <div className="space-y-1.5" data-testid="plan-services-panel">
      {onRenamePlan && isImplantPlan(group.plan) && (
        <div className="flex items-center gap-2 flex-wrap pb-1" data-testid="plan-rename">
          {renaming?.id === group.id ? (
            <>
              <input
                autoFocus
                data-testid="plan-rename-input"
                value={renaming.value}
                maxLength={80}
                onChange={(e) => setRenaming({ id: group.id, value: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); onRenamePlan(group.plan, renaming.value); setRenaming(null); }
                  if (e.key === 'Escape') setRenaming(null);
                }}
                className="h-8 min-w-[10rem] flex-1 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-bold outline-none focus:border-[#1499AD]"
              />
              <button
                type="button"
                data-testid="plan-rename-save"
                onClick={() => { onRenamePlan(group.plan, renaming.value); setRenaming(null); }}
                className="h-8 px-3 rounded-lg bg-[#1499AD] text-white text-[11px] font-black cursor-pointer"
              >
                Saqlash
              </button>
              <button
                type="button"
                onClick={() => setRenaming(null)}
                className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-slate-600 text-[11px] font-bold cursor-pointer"
              >
                Bekor qilish
              </button>
            </>
          ) : (
            <button
              type="button"
              data-testid="plan-rename-open"
              onClick={() => setRenaming({ id: group.id, value: group.plan.name || '' })}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 text-[11px] font-bold cursor-pointer hover:bg-slate-50"
            >
              <Pencil className="w-3 h-3" />
              Reja nomini o‘zgartirish
            </button>
          )}
        </div>
      )}
      {group.visibleRows.map((row) => {
        const toothDisplay = row.toothNumber && row.toothNumber !== '—';
        return (
          <div
            key={row.id}
            data-testid="plan-service-row"
            className={cn(
              'bg-white rounded-xl border border-slate-200/80 px-3 py-2 flex gap-2',
              variant === 'card' ? 'flex-col' : 'items-center flex-wrap'
            )}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1 basis-[12rem]">
              <span className="inline-flex items-center justify-center font-mono font-black text-indigo-600 text-[11px] bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 min-w-[2.25rem] shrink-0">
                {toothDisplay ? `#${row.toothNumber}` : '—'}
              </span>
              <p className="font-bold text-slate-900 text-xs leading-snug line-clamp-2 min-w-0" title={row.serviceName}>{row.serviceName}</p>
            </div>
            <div className="flex items-center gap-1.5 min-w-0 text-[11px] text-slate-600 font-medium basis-[8rem]" title={row.doctorName}>
              <User className="w-3.5 h-3.5 text-slate-300 shrink-0" />
              <span className="truncate">{row.doctorName}</span>
            </div>
            <span className="font-mono font-black text-slate-900 text-xs whitespace-nowrap">{formatCurrency(row.price)}</span>
            <StatusBadge status={row.status} />
            <div className="flex items-center gap-1 ml-auto">
              <button
                type="button"
                onClick={() => onOpenPlanInvoice && onOpenPlanInvoice(row.planObj)}
                className="inline-flex items-center justify-center gap-1 px-2.5 py-1 bg-slate-900 hover:bg-slate-700 text-white rounded-lg text-[10.5px] font-bold transition-all cursor-pointer active:scale-95"
                title={t('patientProfile.invoiceBtn') || 'Faktura'}
              >
                <FileText className="w-3 h-3" />
                <span>{t('patientProfile.invoiceBtn') || 'Faktura'}</span>
                <ExternalLink className="w-2.5 h-2.5 opacity-70" />
              </button>
              {onDeleteTreatment && !(row.planLocked && row.planServiceCount > 1) && (
                <button
                  type="button"
                  data-testid="treatment-delete"
                  onClick={() => setPendingDelete(row)}
                  className="inline-flex items-center justify-center gap-1 px-2 py-1 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-[10.5px] font-bold cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  O‘chirish
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  const emptyState = (
    <div className="py-14 text-center flex flex-col items-center gap-3">
      <FileSpreadsheet className="w-10 h-10 text-slate-200" />
      <p className="text-slate-400 text-sm font-semibold">
        {t('patientProfile.noTreatmentsFound') || 'Davolash muolajalari topilmadi'}
      </p>
    </div>
  );

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
            placeholder={t('patientProfile.searchTreatments') || 'Muolaja, tish #, shifokor qidirish...'}
            className="w-full pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1499AD]/30 focus:border-[#1499AD] transition-all"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 w-5 h-5 flex items-center justify-center rounded-full hover:bg-slate-100 transition-all text-xs">✕</button>
          )}
        </div>
        <span data-testid="treatment-progress" className="inline-flex items-center justify-center rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 shrink-0">
          Jarayon {progressLabel}
        </span>
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

      {/* ── MOBILE CARDS (bitta reja = bitta karta) ── */}
      <div className="md:hidden space-y-2.5">
        {visibleGroups.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100">{emptyState}</div>
        ) : (
          <>
            {visibleGroups.map((group) => {
              const open = isOpen(group);
              return (
                <div key={group.id} data-testid="plan-row" className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => toggle(group)}
                    className="w-full text-left p-3.5 flex flex-col gap-2 active:bg-slate-50"
                  >
                    <div className="flex items-start gap-2">
                      <ChevronRight className={cn('w-4 h-4 text-slate-400 shrink-0 mt-0.5 transition-transform', open && 'rotate-90')} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-black text-slate-900 leading-tight flex items-center gap-1.5">
                          <span className="truncate">{group.title}</span>
                          {group.locked && <LockIcon />}
                        </p>
                        <p className="text-[10px] font-semibold text-slate-400 mt-0.5">
                          {formatDate(group.date)} · {group.serviceCount} ta xizmat
                        </p>
                      </div>
                      <StatusBadge status={group.status} />
                    </div>
                    <div className="grid grid-cols-3 gap-px bg-slate-100 rounded-xl overflow-hidden border border-slate-100">
                      <div className="bg-white px-2.5 py-2">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Jami</p>
                        <p className="text-[12px] font-black text-slate-900 mt-0.5 leading-none">{formatCurrency(group.total)}</p>
                      </div>
                      <div className="bg-white px-2.5 py-2">
                        <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">To‘langan</p>
                        <p className="text-[12px] font-black text-emerald-700 mt-0.5 leading-none">{formatCurrency(group.paid)}</p>
                      </div>
                      <div className="bg-white px-2.5 py-2">
                        <p className={cn('text-[8px] font-black uppercase tracking-widest', group.debt > 0 ? 'text-rose-500' : 'text-slate-400')}>Qarz</p>
                        <p className={cn('text-[12px] font-black mt-0.5 leading-none', group.debt > 0 ? 'text-rose-600' : 'text-slate-500')}>{formatCurrency(group.debt)}</p>
                      </div>
                    </div>
                  </button>
                  {open && (
                    <div className="px-3 pb-3 pt-2 bg-slate-50/70 border-t border-slate-100">
                      {renderServices(group, 'card')}
                    </div>
                  )}
                </div>
              );
            })}

            <div className="bg-gradient-to-r from-[#1499AD] to-[#0d7a8a] rounded-2xl p-4 shadow-lg shadow-[#1499AD]/20">
              <p className="text-[9px] font-black text-white/60 uppercase tracking-widest mb-2.5">
                Jami: {visibleGroups.length} ta reja · {totals.services} ta muolaja
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center bg-white/10 rounded-xl py-2 px-1">
                  <p className="text-[8px] font-bold text-white/70 uppercase tracking-wider">Jami</p>
                  <p className="text-sm font-black text-white mt-0.5 leading-none">{formatCurrency(totals.total)}</p>
                </div>
                <div className="text-center bg-white/10 rounded-xl py-2 px-1">
                  <p className="text-[8px] font-bold text-white/70 uppercase tracking-wider">To‘langan</p>
                  <p className="text-sm font-black text-white mt-0.5 leading-none">{formatCurrency(totals.paid)}</p>
                </div>
                <div className="text-center bg-white/20 rounded-xl py-2 px-1 border border-white/20">
                  <p className="text-[8px] font-black text-white/90 uppercase tracking-wider">Qarz</p>
                  <p className="text-sm font-black text-white mt-0.5 leading-none">{formatCurrency(totals.debt)}</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── DESKTOP TABLE (bitta reja = bitta qator, bosilsa xizmatlari ochiladi) ── */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-black uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-2 border-r border-slate-100 w-8 min-w-[32px] text-center">№</th>
                <th className="py-2.5 px-2.5 border-r border-slate-100 min-w-[170px]">{t('patientProfile.planPackageCol') || 'Reja'}</th>
                <th
                  className="py-2.5 px-2 border-r border-slate-100 text-center cursor-pointer hover:bg-slate-100 transition-colors w-24 min-w-[85px] select-none"
                  onClick={() => sortBy('date')}
                >
                  <div className="flex items-center justify-center gap-1">
                    {t('common.date') || 'Sana'}
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-2.5 px-2 border-r border-slate-100 text-center w-20 min-w-[70px]">Xizmatlar</th>
                <th
                  className="py-2.5 px-2.5 border-r border-slate-100 text-right cursor-pointer hover:bg-slate-100 transition-colors w-28 min-w-[95px] select-none"
                  onClick={() => sortBy('price')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Jami
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-2.5 px-2.5 border-r border-slate-100 text-right min-w-[110px]">To‘langan / Qarz</th>
                <th className="py-2.5 px-2 text-center w-28 min-w-[100px]">Holat</th>
              </tr>
            </thead>
            <tbody>
              {visibleGroups.length === 0 ? (
                <tr>
                  <td colSpan={7}>{emptyState}</td>
                </tr>
              ) : visibleGroups.map((group, idx) => {
                const open = isOpen(group);
                return (
                  <Fragment key={group.id}>
                    <tr
                      data-testid="plan-row"
                      aria-expanded={open}
                      tabIndex={0}
                      onClick={() => toggle(group)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(group); } }}
                      className={cn(
                        'border-b border-slate-100 cursor-pointer hover:bg-sky-50/50 transition-colors focus:outline-none focus-visible:bg-sky-50',
                        open ? 'bg-sky-50/60' : idx % 2 === 1 && 'bg-slate-50/30'
                      )}
                    >
                      <td className="py-2.5 px-2 text-center font-mono text-[11px] text-slate-400 border-r border-slate-100">
                        <span className="inline-flex items-center gap-0.5">
                          <ChevronRight className={cn('w-3.5 h-3.5 text-slate-400 transition-transform', open && 'rotate-90')} />
                        </span>
                      </td>
                      <td className="py-2.5 px-2.5 border-r border-slate-100">
                        <p className="font-black text-slate-900 text-[13px] leading-snug flex items-center gap-1.5">
                          <span className="truncate" title={group.title}>{group.title}</span>
                          {group.locked && <LockIcon />}
                        </p>
                        {group.rawName && group.rawName !== group.title && (
                          <p className="text-[10.5px] text-slate-400 font-medium truncate max-w-[320px]" title={group.rawName}>{group.rawName}</p>
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-center text-xs text-slate-600 font-mono border-r border-slate-100 whitespace-nowrap">
                        {formatDate(group.date)}
                      </td>
                      <td className="py-2.5 px-2 text-center border-r border-slate-100">
                        <span className="inline-flex items-center justify-center min-w-[1.75rem] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-black">
                          {group.serviceCount}
                        </span>
                      </td>
                      <td className="py-2.5 px-2.5 text-right border-r border-slate-100 whitespace-nowrap">
                        <span className="font-mono font-black text-slate-900 text-xs">{formatCurrency(group.total)}</span>
                      </td>
                      <td className="py-2.5 px-2.5 text-right border-r border-slate-100 whitespace-nowrap">
                        <p className="font-mono font-bold text-emerald-700 text-[11px] leading-tight">{formatCurrency(group.paid)}</p>
                        <p className={cn('font-mono font-bold text-[11px] leading-tight', group.debt > 0 ? 'text-rose-600' : 'text-slate-400')}>
                          {group.debt > 0 ? `Qarz: ${formatCurrency(group.debt)}` : 'Qarz yo‘q'}
                        </p>
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <StatusBadge status={group.status} />
                      </td>
                    </tr>
                    {open && (
                      <tr data-testid="plan-expanded">
                        <td colSpan={7} className="p-0 border-b border-slate-200 bg-slate-50/70">
                          <div className="px-4 py-3">
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">
                              {group.title} · xizmatlar ({group.visibleRows.length})
                            </p>
                            {renderServices(group, 'row')}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── JAMI HISOB-KITOB ── */}
        {visibleGroups.length > 0 && (
          <div className="bg-gradient-to-r from-slate-50 via-slate-50 to-slate-100/80 border-t-2 border-slate-200 px-3.5 py-2.5 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#1499AD]/10 border border-[#1499AD]/20 flex items-center justify-center text-[#1499AD] shrink-0 shadow-2xs">
                <Calculator className="w-3.5 h-3.5" />
              </div>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="font-black uppercase tracking-wider text-slate-800 text-xs">
                  {t('patientProfile.totalCalc') || 'JAMI HISOB-KITOB:'}
                </span>
                <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200/80 shadow-2xs">
                  {visibleGroups.length} ta reja · {totals.services} {t('patientProfile.proceduresCount') || 'ta muolaja'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap justify-end">
              <div className="flex flex-col items-end bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200/90">
                <span className="text-[8px] uppercase font-black text-emerald-700 leading-none">To‘langan</span>
                <span className="font-mono font-black text-emerald-800 text-xs mt-0.5 leading-tight">{formatCurrency(totals.paid)}</span>
              </div>
              {totals.debt > 0 && (
                <div className="flex flex-col items-end bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200/90">
                  <span className="text-[8px] uppercase font-black text-rose-700 leading-none">Qarz</span>
                  <span className="font-mono font-black text-rose-800 text-xs mt-0.5 leading-tight">{formatCurrency(totals.debt)}</span>
                </div>
              )}
              <div className="flex items-center gap-2 bg-[#1499AD]/10 px-3.5 py-1.5 rounded-xl border border-[#1499AD]/25 shadow-2xs">
                <div className="flex flex-col items-end">
                  <span className="text-[8.5px] uppercase font-black text-[#1499AD] leading-none">
                    {t('patientProfile.totalWithDiscount') || 'Jami Summa'}
                  </span>
                  <span className="font-mono font-black text-[#0d7a8a] text-sm sm:text-[15px] mt-0.5 leading-tight">
                    {formatCurrency(totals.total)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <TreatmentDeleteDialog
        row={pendingDelete ? {
          serviceName: pendingDelete.serviceName,
          toothNumber: pendingDelete.toothNumber,
          price: pendingDelete.price,
          paidAmount: pendingDelete.planObj?.paid_amount,
        } : null}
        busy={deleting}
        onCancel={() => { if (!deleting) setPendingDelete(null); }}
        onConfirm={async () => {
          if (!pendingDelete || !onDeleteTreatment) return;
          setDeleting(true);
          try {
            await onDeleteTreatment(pendingDelete);
            setPendingDelete(null);
          } finally {
            setDeleting(false);
          }
        }}
      />
    </div>
  );
}

export default memo(ExcelTreatmentsView);
