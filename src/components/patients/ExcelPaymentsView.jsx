import { useState, useMemo, memo } from 'react';
import { useTranslation } from '@/i18n/LanguageContext';
import { 
  CreditCard, Plus, Search, FileSpreadsheet,
  ArrowUpDown, User, Building,
  Banknote, CheckCircle2,
  Clock
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { formatDoctorName, formatTableDate } from '@/lib/displayText';
import { Button } from '@/components/ui/button';
import EmptyState from '../ui/EmptyState';
import { allocatePaymentsToPlans } from '@/lib/planPaymentAllocation';

/**
 * ExcelPaymentsView Component
 * High-productivity Excel Spreadsheet Financial Ledger & Installment Accounting for Patient.
 */
function ExcelPaymentsView({
  patient,
  payments = [],
  plans = [],
  doctors = [],
  totalPaid = 0,
  totalDebt = 0,
  onOpenPayModal,
  onOpenPlanInvoice,
  onPayInstallment,
  // Row click opens the Payments section's detail modal (rendered by PatientProfile).
  onOpenPaymentDetail,
}) {
  const { t, language } = useTranslation();
  const [search, setSearch] = useState('');
  const [subTab, setSubTab] = useState('ledger'); // 'ledger' | 'plans' | 'installments'
  const [sortField, setSortField] = useState('date');
  const [sortAsc, setSortAsc] = useState(false);
  const [density, setDensity] = useState('compact');

  // Filter out internal linked debts/discounts — only actual income/payment receipts in Kassa
  const realIncomePayments = useMemo(() => {
    const list = payments.filter(p => {
      const pType = (p.type || 'Income').toLowerCase();
      const notesLower = (p.notes || '').toLowerCase();
      const isLinkedPlanInternal = (pType === 'debt' || pType === 'discount') && 
        (p.plan_id || notesLower.includes('linked to plan') || notesLower.includes('reja:') || notesLower.includes('avtomatik chegirma') || notesLower.includes('reja yangilandi'));
      return !isLinkedPlanInternal && pType !== 'debt' && pType !== 'discount';
    });

    // Aniq xronologik tartib: Eng yangi to'lovlar tepada
    return list.sort((a, b) => {
      const dateA = new Date(a.created_date || a.created_at || a.date || 0).getTime();
      const dateB = new Date(b.created_date || b.created_at || b.date || 0).getTime();
      return dateB - dateA;
    });
  }, [payments]);

  const filteredPayments = useMemo(() => {
    let list = [...realIncomePayments];

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p => 
        (p.doctor_name && p.doctor_name.toLowerCase().includes(q)) ||
        (p.notes && p.notes.toLowerCase().includes(q)) ||
        (p.payment_method && p.payment_method.toLowerCase().includes(q)) ||
        (p.method && p.method.toLowerCase().includes(q)) ||
        (p.treatment_name && p.treatment_name.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q)) ||
        (p.receipt_number && String(p.receipt_number).includes(q))
      );
    }

    list.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];
      if (sortField === 'date') {
        valA = new Date(a.date || a.created_date || 0).getTime();
        valB = new Date(b.date || b.created_date || 0).getTime();
      } else if (sortField === 'amount') {
        valA = Number(a.amount || 0);
        valB = Number(b.amount || 0);
      }
      return sortAsc ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
    });

    return list;
  }, [realIncomePayments, search, sortField, sortAsc]);

  // Per-plan paid amounts: each payment is counted exactly once (see planPaymentAllocation.js)
  const planAllocation = useMemo(() => {
    if (!plans || plans.length === 0) return { rows: [], unallocated: 0 };
    return allocatePaymentsToPlans(plans, realIncomePayments, {
      totalPaid: Math.max(Number(totalPaid) || 0, 0),
    });
  }, [plans, realIncomePayments, totalPaid]);

  const enrichedPlans = useMemo(() => planAllocation.rows.map(({ plan, paid, remaining }) => ({
    ...plan,
    paid_amount: paid,
    effectiveDebt: remaining,
    calculatedPrice: Number(plan.total_price || 0),
  })), [planAllocation]);

  const installmentPlans = useMemo(() => {
    return (enrichedPlans || []).filter(p => p.installment_plan && p.installment_plan.months > 0);
  }, [enrichedPlans]);

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const getMethodBadge = (method) => {
    const m = (method || '').toLowerCase();
    if (m.includes('card') || m.includes('karta') || m.includes('humo') || m.includes('uzcard') || m.includes('карт') || m.includes('терминал')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-bold text-[10px]">
          <CreditCard className="w-3 h-3 text-blue-600 shrink-0" />
          <span>{language === 'ru' ? 'Банковская карта' : language === 'en' ? 'Card Payment' : 'Plastik karta'}</span>
        </span>
      );
    }
    if (m.includes('bank') || m.includes('hisob') || m.includes('transfer') || m.includes('перевод')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 font-bold text-[10px]">
          <Building className="w-3 h-3 text-purple-600 shrink-0" />
          <span>{language === 'ru' ? 'Банковский перевод' : language === 'en' ? 'Bank Transfer' : 'Bank o\'tkazmasi'}</span>
        </span>
      );
    }
    if (m.includes('installment') || m.includes('rassrochka') || m.includes('muddatli') || m.includes('рассрочк')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 font-bold text-[10px]">
          <Clock className="w-3 h-3 text-amber-600 shrink-0" />
          <span>{language === 'ru' ? 'Рассрочка' : language === 'en' ? 'Installment' : 'Muddatli to\'lov'}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px]">
        <Banknote className="w-3 h-3 text-emerald-600 shrink-0" />
        <span>{language === 'ru' ? 'Наличные' : language === 'en' ? 'Cash' : 'Naqd pul'}</span>
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
            <div className="relative min-w-[200px] max-w-xs flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('patientProfile.searchPayments') || "Kvitansiya #, shifokor qidirish..."}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#1a73e8]"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs">✕</button>
              )}
            </div>

            {/* Sub Tabs */}
            <div className="inline-flex p-0.5 bg-slate-100 rounded-lg border border-slate-200/60 gap-0.5">
              <button
                onClick={() => setSubTab('ledger')}
                className={cn(
                  "px-3 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer",
                  subTab === 'ledger'
                    ? "bg-white text-slate-900 shadow-2xs border border-slate-200/60 font-black"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                {t('patientProfile.kassaLedgerTab') || "Kassa Reyestri"} ({realIncomePayments.length})
              </button>
              <button
                onClick={() => setSubTab('plans')}
                className={cn(
                  "px-3 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer",
                  subTab === 'plans'
                    ? "bg-white text-slate-900 shadow-2xs border border-slate-200/60 font-black"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                {t('patientProfile.invoicesAndDebtTab') || "Hisob-Fakturalar & Qarzlar"} ({enrichedPlans.length})
              </button>
              <button
                onClick={() => setSubTab('installments')}
                className={cn(
                  "px-3 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer",
                  subTab === 'installments'
                    ? "bg-white text-slate-900 shadow-2xs border border-slate-200/60 font-black"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                {t('patientProfile.installmentsTab') || "Muddatli To'lovlar"} ({installmentPlans.length})
              </button>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Quick Add Payment Button */}
            {onOpenPayModal && (
              <button
                onClick={onOpenPayModal}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black shadow-2xs transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ {t('patientProfile.receivePaymentBtn') || "To'lov Qabul Qilish"}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ══ VIEW 1: PAYMENTS KASSA LEDGER ══ */}
      {subTab === 'ledger' && (
        <div className="space-y-2.5">
          {/* MOBILE CARDS */}
          <div className="md:hidden space-y-2.5">
            {filteredPayments.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 py-12 text-center flex flex-col items-center gap-3">
                <CreditCard className="w-10 h-10 text-slate-200" />
                <p className="text-slate-400 text-sm font-semibold">
                  {t('patientProfile.noPaymentsFound') || "To'lovlar topilmadi"}
                </p>
                {onOpenPayModal && (
                  <button onClick={onOpenPayModal} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-black active:scale-95">
                    <Plus className="w-4 h-4" />To'lov qabul qilish
                  </button>
                )}
              </div>
            ) : filteredPayments.map((p, idx) => {
              const dateStr = p.date || p.created_date
                ? new Date(p.date || p.created_date).toLocaleString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                : '—';
              const amount = Number(p.amount || 0);
              const doctorName = p.doctor_name || patient?.doctor_name || 'Shifokor';
              const method = p.payment_method || p.method || 'Cash';
              return (
                <div
                  key={p.id || idx}
                  className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden cursor-pointer active:scale-[0.99] transition-all"
                  onClick={() => onOpenPaymentDetail?.(p)}
                >
                  <div className="p-3.5 flex items-start gap-3">
                    <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                      <CreditCard className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-black text-emerald-700 leading-tight">
                        +{formatCurrency(amount)}
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 mt-0.5">{dateStr}</p>
                    </div>
                    {getMethodBadge(method)}
                  </div>
                  <div className="grid grid-cols-2 gap-px bg-slate-100 border-t border-slate-100">
                    <div className="bg-white px-3 py-2">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Shifokor</p>
                      <p className="text-[11px] font-bold text-slate-700 mt-0.5 truncate">{doctorName}</p>
                    </div>
                    <div className="bg-white px-3 py-2">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Izoh</p>
                      <p className="text-[11px] font-semibold text-slate-600 mt-0.5 truncate">{p.notes || '—'}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* DESKTOP TABLE */}
          <div className="hidden md:block bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full border-collapse text-left font-sans text-sm">
              <thead>
                <tr className="bg-slate-100/95 border-b border-slate-300 text-slate-800 font-extrabold uppercase tracking-wider text-xs">
                  <th className="py-1.5 px-3 border-r border-slate-200 text-center w-12 bg-slate-200/70 font-mono">№</th>
                  <th 
                    className="py-1.5 px-3 border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors font-mono select-none"
                    onClick={() => toggleSort('date')}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span>{t('common.dateTime') || "Sana & Vaqt"}</span>
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-600" />
                    </div>
                  </th>
                  <th className="py-1.5 px-3 border-r border-slate-200">{t('patientProfile.paymentTypeCol') || "To'lov Turi"}</th>
                  <th className="py-1.5 px-3 border-r border-slate-200">{t('patientProfile.doctorCol') || "Shifokor"}</th>
                  <th 
                    className="py-1.5 px-3 border-r border-slate-200 text-right cursor-pointer hover:bg-slate-200/60 transition-colors select-none min-w-[130px]"
                    onClick={() => toggleSort('amount')}
                  >
                    <div className="flex items-center justify-end gap-1.5 font-mono">
                      <span>{t('patientProfile.paidAmountCol') || "To'langan Summa"}</span>
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-600" />
                    </div>
                  </th>
                  <th className="py-1.5 px-3 min-w-[140px]">{t('common.notes') || "Izoh"}</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 bg-slate-50/40">
                      <EmptyState
                        icon={CreditCard}
                        variant="emerald"
                        title={t('patientProfile.noPaymentsFound') || "Hozircha kassaga to'lov qabul qilinmagan"}
                        description={
                          search
                            ? "Qidiruv bo'yicha to'lovlar topilmadi. Qidiruv so'zini tekshiring."
                            : Number(totalDebt || 0) > 0
                            ? `Bemorning to'lov kutilayotgan umumiy qarzdorligi mavjud: ${formatCurrency(Number(totalDebt))}`
                            : "Bemor bo'yicha kassaga hali to'lov kiritilmagan."
                        }
                        actionText={onOpenPayModal ? "+ To'lov qabul qilish" : undefined}
                        onAction={onOpenPayModal}
                        secondaryActionText={search ? "Filtrni tozalash" : undefined}
                        onSecondaryAction={() => setSearch('')}
                      />
                    </td>
                  </tr>
                ) : (
                  filteredPayments.map((p, idx) => {
                    const dateStr = p.date || p.created_date ? new Date(p.date || p.created_date).toLocaleString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

                    return (
                      <tr
                        key={p.id || idx}
                        onClick={() => onOpenPaymentDetail?.(p)}
                        className={cn(
                          "border-b border-slate-200/70 hover:bg-sky-50 transition-colors cursor-pointer select-none",
                          idx % 2 === 1 ? "bg-slate-50/40" : "bg-white"
                        )}
                        title="Batafsil ma'lumot va kvitansiyani ko'rish uchun bosing"
                      >
                        {/* Row Index */}
                        <td className={cn(
                          "border-r border-slate-200 text-center font-mono font-bold text-slate-500 bg-slate-100/40 text-xs",
                          density === 'compact' ? 'py-1.5 px-2.5' : 'py-2.5 px-3'
                        )}>
                          {idx + 1}
                        </td>

                        {/* Date */}
                        <td className={cn("border-r border-slate-200 font-mono font-semibold text-slate-700 whitespace-nowrap text-xs sm:text-sm", density === 'compact' ? 'py-1.5 px-3' : 'py-2.5 px-3.5')}>
                          {dateStr}
                        </td>

                        {/* Payment Method */}
                        <td className={cn("border-r border-slate-200 text-xs sm:text-sm", density === 'compact' ? 'py-1.5 px-3' : 'py-2.5 px-3.5')}>
                          {getMethodBadge(p.payment_method || p.method)}
                        </td>

                        {/* Doctor */}
                        <td className={cn("border-r border-slate-200 font-semibold text-slate-800 text-xs sm:text-sm", density === 'compact' ? 'py-1.5 px-3' : 'py-2.5 px-3.5')}>
                          <div className="flex items-center gap-1.5">
                            <User className="w-4 h-4 text-slate-400 shrink-0" />
                            <span className="whitespace-nowrap">{formatDoctorName(p.doctor_name || patient?.doctor_name) || (language === 'ru' ? 'Врач' : language === 'en' ? 'Doctor' : 'Shifokor')}</span>
                          </div>
                        </td>

                        {/* Amount */}
                        <td className={cn("border-r border-slate-200 text-right font-mono font-black text-emerald-700 bg-emerald-50/40 text-sm sm:text-base tracking-tight", density === 'compact' ? 'py-1.5 px-3' : 'py-2.5 px-3.5')}>
                          +{formatCurrency(Number(p.amount || 0))}
                        </td>

                        {/* Notes */}
                        <td className={cn("text-slate-600 italic text-xs sm:text-sm", density === 'compact' ? 'py-1.5 px-3' : 'py-2.5 px-3.5')}>
                          {p.notes || '—'}
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
      )}

      {/* ══ VIEW 2: PLANS INVOICES & DEBTS ══ */}
      {subTab === 'plans' && (
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed border-collapse text-left font-sans text-[11px]">
              <colgroup>
                <col className="w-8" />
                <col className="w-[24%]" />
                <col className="w-[88px]" />
                <col className="w-[14%]" />
                <col className="w-[13%]" />
                <col className="w-[13%]" />
                <col className="w-[14%]" />
                <col className="w-[72px]" />
              </colgroup>
              <thead>
                <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wide text-[10px]">
                  <th className="py-2 px-1 border-r border-slate-200 text-center bg-slate-200/60 font-mono">№</th>
                  <th className="py-2 px-2 border-r border-slate-200">{language === 'ru' ? 'План / Процедура' : language === 'en' ? 'Plan / Treatment Name' : 'Reja / Muolaja'}</th>
                  <th className="py-2 px-1.5 border-r border-slate-200 font-mono">{t('common.date') || 'Sana'}</th>
                  <th className="py-2 px-1.5 border-r border-slate-200">{t('patientProfile.doctorCol') || 'Shifokor'}</th>
                  <th className="py-2 px-1.5 border-r border-slate-200 text-right font-mono">{language === 'ru' ? 'Стоимость' : language === 'en' ? 'Plan Price' : 'Reja narxi'}</th>
                  <th className="py-2 px-1.5 border-r border-slate-200 text-right font-mono">{t('patientProfile.paidLabel') || "To'langan"}</th>
                  <th className="py-2 px-1.5 border-r border-slate-200 text-right font-mono">{language === 'ru' ? 'Остаток' : language === 'en' ? 'Remaining' : 'Qoldiq'}</th>
                  <th className="py-2 px-1 text-center">{t('patientProfile.invoiceCol') || 'Faktura'}</th>
                </tr>
              </thead>
              <tbody>
                {enrichedPlans.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400 italic bg-slate-50/50">
                      <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      {language === 'ru' ? 'Счета-фактуры планов лечения не найдены.' : language === 'en' ? 'No treatment plan invoices found.' : 'Davolash rejalari hisob-fakturalari topilmadi.'}
                    </td>
                  </tr>
                ) : (
                  enrichedPlans.map((plan, idx) => {
                    const price = Number(plan.total_price || plan.calculatedPrice || 0);
                    const paid = Number(plan.paid_amount || 0);
                    const debt = Number(plan.effectiveDebt !== undefined ? plan.effectiveDebt : Math.max(0, price - paid));

                    return (
                      <tr
                        key={plan.id || idx}
                        className={cn(
                          "border-b border-slate-200/70 hover:bg-sky-50/40 transition-colors",
                          idx % 2 === 1 ? "bg-slate-50/40" : "bg-white"
                        )}
                      >
                        <td className="border-r border-slate-200 text-center font-mono font-bold text-slate-500 bg-slate-100/40 text-xs py-1.5 px-2.5">
                          {idx + 1}
                        </td>
                        <td className="border-r border-slate-200 font-bold text-slate-900 text-[11px] py-2 px-2 whitespace-normal break-words">
                          {plan.name || `Davolash rejasi #${idx + 1}`}
                        </td>
                        <td className="border-r border-slate-200 font-mono font-semibold text-slate-700 text-[11px] py-2 px-1.5 whitespace-nowrap">
                          {formatTableDate(plan.created_date)}
                        </td>
                        <td className="border-r border-slate-200 font-semibold text-slate-800 text-[11px] py-2 px-1.5">
                          <div className="flex items-center gap-1 min-w-0">
                            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{formatDoctorName(plan.doctor_name || patient?.doctor_name) || (language === 'ru' ? 'Врач' : language === 'en' ? 'Doctor' : 'Shifokor')}</span>
                          </div>
                        </td>
                        <td className="border-r border-slate-200 text-right font-mono font-black text-slate-950 text-[11px] tracking-tight py-2 px-1.5 break-words">
                          {price.toLocaleString()}
                        </td>
                        <td className="border-r border-slate-200 text-right font-mono font-black text-emerald-700 text-[11px] tracking-tight py-2 px-1.5 break-words">
                          {paid.toLocaleString()}
                        </td>
                        <td className={cn(
                          "border-r border-slate-200 text-right font-mono font-black text-[11px] tracking-tight py-2 px-1.5 break-words",
                          debt > 0 ? "text-amber-950 bg-amber-50/30" : "text-emerald-700 bg-emerald-50/20"
                        )}>
                          {debt > 0 ? (
                            <span className="inline-flex items-center justify-end gap-1 text-amber-950">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                              <span>{debt.toLocaleString()}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-end gap-1 text-emerald-700 font-bold text-[10px]">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{t('patientProfile.paidLabel') || 'To\'langan'}</span>
                            </span>
                          )}
                        </td>
                        <td className="text-center py-1.5 px-1">
                          <button
                            onClick={() => onOpenPlanInvoice && onOpenPlanInvoice(plan)}
                            className="inline-flex items-center justify-center gap-1 px-1.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[10px] font-bold transition-all shadow-2xs cursor-pointer max-w-full"
                          >
                            <span className="truncate">{t('patientProfile.invoiceBtn') || 'Faktura'}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
                {planAllocation.unallocated > 0 && (
                  <tr className="border-b border-slate-200/70 bg-slate-50/60">
                    <td className="border-r border-slate-200 text-center text-slate-400 text-xs py-1.5 px-2.5">&Sigma;</td>
                    <td colSpan={3} className="border-r border-slate-200 font-bold text-slate-700 text-[11px] py-2 px-2">
                      Umumiy to'lov (rejaga biriktirilmagan)
                    </td>
                    <td className="border-r border-slate-200 text-right font-mono text-slate-400 text-[11px] py-2 px-1.5">&mdash;</td>
                    <td className="border-r border-slate-200 text-right font-mono font-black text-emerald-700 text-[11px] py-2 px-1.5">
                      {planAllocation.unallocated.toLocaleString()}
                    </td>
                    <td className="border-r border-slate-200 text-right font-mono text-slate-400 text-[11px] py-2 px-1.5">&mdash;</td>
                    <td />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══ VIEW 3: INSTALLMENTS SPREADSHEET ══ */}
      {subTab === 'installments' && (
        <div className="space-y-4">
          {installmentPlans.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-12 text-center text-slate-400 italic">
              {language === 'ru' ? 'Активные планы рассрочки отсутствуют.' : language === 'en' ? 'No active installment plans found.' : 'Faol muddatli to\'lovlar (rassrochka) rejasi mavjud emas.'}
            </div>
          ) : (
            installmentPlans.map((plan) => {
              const inst = plan.installment_plan;
              const paidMonths = inst.paid_months || [];

              return (
                <div key={plan.id} className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wide text-slate-800">{plan.name}</h4>
                      <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                        {language === 'ru' ? 'Итого: ' : 'Jami: '}{formatCurrency(Number(plan.total_price || 0))} | {inst.months} {language === 'ru' ? 'мес. график' : 'oylik jadval'}
                      </p>
                    </div>
                    <div className="text-right font-mono">
                      <span className="text-[10px] text-slate-400 block font-bold">{language === 'ru' ? 'Ежемесячный платёж' : language === 'en' ? 'Monthly payment' : 'Oylik to\'lov'}</span>
                      <span className="text-xs font-black text-indigo-700">{formatCurrency(Number(inst.monthly_amount || 0))}</span>
                    </div>
                  </div>

                  {/* Monthly Installment Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    {Array.from({ length: inst.months }).map((_, i) => {
                      const isPaid = paidMonths.includes(i);
                      const monthDate = new Date(inst.start_date || plan.created_date || new Date());
                      monthDate.setMonth(monthDate.getMonth() + i);

                      return (
                        <div
                          key={i}
                          className={cn(
                            "p-2.5 rounded-lg border text-xs flex flex-col justify-between gap-2 transition-all",
                            isPaid
                              ? "bg-emerald-50/60 border-emerald-200"
                              : "bg-slate-50 border-slate-200"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-700 text-[11px]">{i + 1}-{language === 'ru' ? 'й месяц' : language === 'en' ? 'month' : 'oy'}</span>
                            <span className={cn("text-[9px] font-bold px-1.5 py-0.2 rounded", isPaid ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-600")}>
                              {isPaid ? (language === 'ru' ? 'Оплачено' : 'Yopilgan') : (language === 'ru' ? 'Ожидается' : 'Kutilmoqda')}
                            </span>
                          </div>

                          <div>
                            <span className="text-[10px] text-slate-400 block">{monthDate.toLocaleDateString('uz-UZ', { month: 'short', year: 'numeric' })}</span>
                            <span className="font-mono font-bold text-slate-800 text-[11px]">{formatCurrency(Number(inst.monthly_amount || 0))}</span>
                          </div>

                          {!isPaid && onPayInstallment && (
                            <Button
                              size="sm"
                              onClick={() => onPayInstallment(plan, i)}
                              className="w-full h-6 text-[9.5px] font-black uppercase bg-indigo-600 hover:bg-indigo-700 text-white rounded cursor-pointer"
                            >
                              To'lash
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

    </div>
  );
}

export default memo(ExcelPaymentsView);
