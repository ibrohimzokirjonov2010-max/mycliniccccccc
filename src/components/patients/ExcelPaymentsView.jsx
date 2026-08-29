import { useState, useMemo, memo } from 'react';
import { 
  CreditCard, Plus, Search, FileSpreadsheet,
  ArrowUpDown, ExternalLink, User, Building,
  Banknote, CheckCircle2, X, Printer, Trash2,
  Table as TableIcon, Copy, Check, Clock
} from 'lucide-react';
import { cn, formatPhone } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

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
  onDeletePayment,
}) {
  const [search, setSearch] = useState('');
  const [subTab, setSubTab] = useState('ledger'); // 'ledger' | 'plans' | 'installments'
  const [sortField, setSortField] = useState('date');
  const [sortAsc, setSortAsc] = useState(false);
  const [density, setDensity] = useState('compact');
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);

  // Filter out internal linked debts/discounts — only actual income/payment receipts in Kassa
  const realIncomePayments = useMemo(() => {
    return payments.filter(p => {
      const pType = (p.type || 'Income').toLowerCase();
      const notesLower = (p.notes || '').toLowerCase();
      const isLinkedPlanInternal = (pType === 'debt' || pType === 'discount') && 
        (p.plan_id || notesLower.includes('linked to plan') || notesLower.includes('reja:') || notesLower.includes('avtomatik chegirma') || notesLower.includes('reja yangilandi'));
      return !isLinkedPlanInternal && pType !== 'debt' && pType !== 'discount';
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

  const installmentPlans = useMemo(() => {
    return (plans || []).filter(p => p.installment_plan && p.installment_plan.months > 0);
  }, [plans]);

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
    if (m.includes('card') || m.includes('karta') || m.includes('humo') || m.includes('uzcard')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-bold text-[10px]">
          <CreditCard className="w-3 h-3 text-blue-600 shrink-0" />
          <span>Karta / Terminal</span>
        </span>
      );
    }
    if (m.includes('bank') || m.includes('hisob') || m.includes('transfer')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 font-bold text-[10px]">
          <Building className="w-3 h-3 text-purple-600 shrink-0" />
          <span>Bank o'tkazmasi</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px]">
        <Banknote className="w-3 h-3 text-emerald-600 shrink-0" />
        <span>Naqd pul</span>
      </span>
    );
  };

  const handleCopyPhone = (e, phone) => {
    e.stopPropagation();
    if (!phone) return;
    navigator.clipboard?.writeText(phone);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  const handlePrintReceipt = (p) => {
    if (!p) return;
    const dateStr = p.date || p.created_date ? new Date(p.date || p.created_date).toLocaleString('uz-UZ') : new Date().toLocaleString('uz-UZ');
    const doctorName = p.doctor_name || patient?.doctor_name || 'Shifokor';
    const patientName = patient?.full_name || p.patient_name || 'Bemor';
    const receiptNo = p.receipt_number || p.calculatedReceiptNo || `REC-${1000}`;
    const amountStr = Number(p.amount || 0).toLocaleString();
    const methodStr = p.payment_method || p.method || 'Naqd pul';

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>To'lov Kvitansiyasi #${receiptNo}</title>
        <meta charset="utf-8" />
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; margin: 30px; color: #0f172a; max-width: 440px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; }
          .header { text-align: center; border-bottom: 2px dashed #cbd5e1; padding-bottom: 15px; margin-bottom: 15px; }
          .clinic-name { font-size: 20px; font-weight: 900; color: #0f172a; text-transform: uppercase; }
          .receipt-title { font-size: 13px; font-weight: bold; color: #64748b; margin-top: 4px; }
          .info-row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 8px; }
          .info-label { color: #64748b; font-weight: 600; }
          .info-val { font-weight: 800; color: #0f172a; }
          .amount-box { background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 8px; padding: 14px; text-align: center; margin: 16px 0; }
          .amount-title { font-size: 11px; font-weight: 800; text-transform: uppercase; color: #166534; }
          .amount-val { font-size: 24px; font-weight: 900; color: #15803d; margin-top: 4px; }
          .footer { text-align: center; border-top: 2px dashed #cbd5e1; padding-top: 15px; margin-top: 15px; font-size: 11px; color: #94a3b8; }
          @media print { body { border: none; padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="clinic-name">SHIFOCRM CLINIC</div>
          <div class="receipt-title">TO'LOV KVITANSIYASI #${receiptNo}</div>
        </div>
        <div class="info-row">
          <span class="info-label">Sana va vaqt:</span>
          <span class="info-val">${dateStr}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Bemor:</span>
          <span class="info-val">${patientName}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Telefon:</span>
          <span class="info-val">${patient?.phone || '—'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Mas'ul shifokor:</span>
          <span class="info-val">${doctorName}</span>
        </div>
        <div class="info-row">
          <span class="info-label">To'lov usuli:</span>
          <span class="info-val">${methodStr}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Muolaja / Asos:</span>
          <span class="info-val">${p.treatment_name || p.service_name || p.category || 'Davolash muolajasi'}</span>
        </div>

        <div class="amount-box">
          <div class="amount-title">Qabul Qilingan Summa</div>
          <div class="amount-val">${amountStr} UZS</div>
        </div>

        <div class="info-row">
          <span class="info-label">Bemor qoldiq qarzi:</span>
          <span class="info-val">${Number(totalDebt || 0).toLocaleString()} UZS</span>
        </div>

        <div class="footer">
          <div>To'lov qabul qilindi. Tashrifingiz uchun rahmat!</div>
          <div style="margin-top: 4px; font-size: 9px; font-family: monospace;">SHIFOCRM TIZIMI ORQALI CHIQARILDI</div>
        </div>
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `);
    win.document.close();
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
            <span>SUM(TO'LANGAN): <b className="text-emerald-700 font-black font-mono">{Number(totalPaid || 0).toLocaleString()} UZS</b></span>
            <span className="text-slate-300">|</span>
            <span>SUM(QARZDORLIK): <b className={Number(totalDebt || 0) > 0 ? "text-rose-600 font-black font-mono" : "text-emerald-600 font-black font-mono"}>{Number(totalDebt || 0).toLocaleString()} UZS</b></span>
            <span className="text-slate-300">|</span>
            <span>TO'LOV KVITANSIYALARI: <b className="text-slate-900 font-black">{realIncomePayments.length} ta</b></span>
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
                placeholder="Kvitansiya #, shifokor qidirish..."
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
                Kassa Reyestri ({realIncomePayments.length})
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
                Hisob-Fakturalar & Qarzlar ({plans.length})
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
                Muddatli To'lovlar ({installmentPlans.length})
              </button>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setDensity(d => d === 'compact' ? 'normal' : 'compact')}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              {density === 'compact' ? '☷ Ixcham' : '☰ Keng'}
            </button>

            {/* Quick Add Payment Button */}
            {onOpenPayModal && (
              <button
                onClick={onOpenPayModal}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black shadow-2xs transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ To'lov Qabul Qilish</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ══ VIEW 1: PAYMENTS KASSA LEDGER TABLE ══ */}
      {subTab === 'ledger' && (
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full border-collapse text-left font-sans text-xs">
              <thead>
                <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10.5px]">
                  <th className="py-2.5 px-3 border-r border-slate-200 text-center w-12 bg-slate-200/60 font-mono">№</th>
                  <th 
                    className="py-2.5 px-3 border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors font-mono select-none"
                    onClick={() => toggleSort('date')}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span>Sana & Vaqt</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="py-2.5 px-3 border-r border-slate-200 font-mono">Kvitansiya #</th>
                  <th className="py-2.5 px-3 border-r border-slate-200">To'lov Turi</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 min-w-[160px]">Muolaja / Asos</th>
                  <th className="py-2.5 px-3 border-r border-slate-200">Shifokor</th>
                  <th 
                    className="py-2.5 px-3 border-r border-slate-200 text-right cursor-pointer hover:bg-slate-200/60 transition-colors select-none min-w-[120px]"
                    onClick={() => toggleSort('amount')}
                  >
                    <div className="flex items-center justify-end gap-1 font-mono">
                      <span>To'langan Summa</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="py-2.5 px-3 border-r border-slate-200 text-right font-mono min-w-[100px]">Chegirma</th>
                  <th className="py-2.5 px-3 min-w-[140px]">Izoh</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 italic bg-slate-50/50">
                      <CreditCard className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <div>Hozircha kassaga to'lov qabul qilinmagan.</div>
                      {Number(totalDebt || 0) > 0 && (
                        <div className="mt-2 text-xs text-rose-600 font-bold not-italic">
                          Bemorning reja bo'yicha umumiy qarzdorligi: {Number(totalDebt).toLocaleString()} UZS
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredPayments.map((p, idx) => {
                    const dateStr = p.date || p.created_date ? new Date(p.date || p.created_date).toLocaleString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
                    const receiptNo = p.receipt_number || `REC-${1000 + idx}`;

                    return (
                      <tr
                        key={p.id || idx}
                        onClick={() => setSelectedPayment({ ...p, calculatedReceiptNo: receiptNo })}
                        className={cn(
                          "border-b border-slate-200/70 hover:bg-sky-50 transition-colors cursor-pointer select-none",
                          idx % 2 === 1 ? "bg-slate-50/40" : "bg-white"
                        )}
                        title="Batafsil ma'lumot va kvitansiyani ko'rish uchun bosing"
                      >
                        {/* Row Index */}
                        <td className={cn(
                          "border-r border-slate-200 text-center font-mono font-bold text-slate-400 bg-slate-100/40 text-[11px]",
                          density === 'compact' ? 'py-2 px-2' : 'py-3 px-3'
                        )}>
                          {idx + 1}
                        </td>

                        {/* Date */}
                        <td className={cn("border-r border-slate-200 font-mono text-slate-700 whitespace-nowrap", density === 'compact' ? 'py-2 px-3' : 'py-3 px-3')}>
                          {dateStr}
                        </td>

                        {/* Receipt # */}
                        <td className={cn("border-r border-slate-200 font-mono font-bold text-[#1a73e8]", density === 'compact' ? 'py-2 px-3' : 'py-3 px-3')}>
                          {receiptNo}
                        </td>

                        {/* Payment Method */}
                        <td className={cn("border-r border-slate-200", density === 'compact' ? 'py-2 px-3' : 'py-3 px-3')}>
                          {getMethodBadge(p.payment_method || p.method)}
                        </td>

                        {/* Treatment Name */}
                        <td className={cn("border-r border-slate-200 font-bold text-slate-800", density === 'compact' ? 'py-2 px-3' : 'py-3 px-3')}>
                          {p.treatment_name || p.service_name || p.category || 'Davolash muolajasi'}
                        </td>

                        {/* Doctor */}
                        <td className={cn("border-r border-slate-200 font-medium text-slate-700", density === 'compact' ? 'py-2 px-3' : 'py-3 px-3')}>
                          <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{p.doctor_name || patient?.doctor_name || 'Shifokor'}</span>
                          </div>
                        </td>

                        {/* Amount */}
                        <td className={cn("border-r border-slate-200 text-right font-mono font-black text-emerald-700 bg-emerald-50/30", density === 'compact' ? 'py-2 px-3' : 'py-3 px-3')}>
                          +{Number(p.amount || 0).toLocaleString()} UZS
                        </td>

                        {/* Discount */}
                        <td className={cn("border-r border-slate-200 text-right font-mono text-slate-500", density === 'compact' ? 'py-2 px-3' : 'py-3 px-3')}>
                          {Number(p.discount || 0) > 0 ? `-${Number(p.discount).toLocaleString()} UZS` : '—'}
                        </td>

                        {/* Notes */}
                        <td className={cn("text-slate-500 italic text-[11px]", density === 'compact' ? 'py-2 px-3' : 'py-3 px-3')}>
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
      )}

      {/* ══ VIEW 2: PLANS INVOICES & DEBTS TABLE ══ */}
      {subTab === 'plans' && (
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full border-collapse text-left font-sans text-xs">
              <thead>
                <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10.5px]">
                  <th className="py-2.5 px-3 border-r border-slate-200 text-center w-12 bg-slate-200/60 font-mono">№</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 min-w-[200px]">Reja / Muolaja Nomi</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 font-mono">Sana</th>
                  <th className="py-2.5 px-3 border-r border-slate-200">Shifokor</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 text-right font-mono min-w-[120px]">Reja Narxi</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 text-right font-mono min-w-[120px]">To'langan</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 text-right font-mono min-w-[120px]">Qoldiq Qarz</th>
                  <th className="py-2.5 px-3 text-center min-w-[100px]">Faktura</th>
                </tr>
              </thead>
              <tbody>
                {plans.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400 italic bg-slate-50/50">
                      <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      Davolash rejalari hisob-fakturalari topilmadi.
                    </td>
                  </tr>
                ) : (
                  plans.map((plan, idx) => {
                    const price = Number(plan.total_price || 0);
                    const paid = Number(plan.paid_amount || 0);
                    const debt = Math.max(0, price - paid);

                    return (
                      <tr
                        key={plan.id || idx}
                        className={cn(
                          "border-b border-slate-200/70 hover:bg-sky-50/40 transition-colors",
                          idx % 2 === 1 ? "bg-slate-50/40" : "bg-white"
                        )}
                      >
                        <td className="border-r border-slate-200 text-center font-mono font-bold text-slate-400 bg-slate-100/40 text-[11px] py-2.5 px-2">
                          {idx + 1}
                        </td>
                        <td className="border-r border-slate-200 font-bold text-slate-900 py-2.5 px-3">
                          {plan.name || `Davolash rejasi #${idx + 1}`}
                        </td>
                        <td className="border-r border-slate-200 font-mono text-slate-600 py-2.5 px-3">
                          {plan.created_date ? new Date(plan.created_date).toLocaleDateString('uz-UZ') : '—'}
                        </td>
                        <td className="border-r border-slate-200 font-medium text-slate-700 py-2.5 px-3">
                          <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{plan.doctor_name || patient?.doctor_name || 'Shifokor'}</span>
                          </div>
                        </td>
                        <td className="border-r border-slate-200 text-right font-mono font-bold text-slate-900 py-2.5 px-3">
                          {price.toLocaleString()} UZS
                        </td>
                        <td className="border-r border-slate-200 text-right font-mono font-bold text-emerald-700 py-2.5 px-3">
                          {paid.toLocaleString()} UZS
                        </td>
                        <td className={cn(
                          "border-r border-slate-200 text-right font-mono font-black py-2.5 px-3",
                          debt > 0 ? "text-rose-600 bg-rose-50/30" : "text-emerald-600"
                        )}>
                          {debt > 0 ? (
                            <span>{debt.toLocaleString()} UZS</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-emerald-600">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>To'langan</span>
                            </span>
                          )}
                        </td>
                        <td className="text-center py-2 px-3">
                          <button
                            onClick={() => onOpenPlanInvoice && onOpenPlanInvoice(plan)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-[10.5px] font-bold transition-all shadow-2xs cursor-pointer"
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
            </table>
          </div>
        </div>
      )}

      {/* ══ VIEW 3: INSTALLMENTS SPREADSHEET ══ */}
      {subTab === 'installments' && (
        <div className="space-y-4">
          {installmentPlans.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-12 text-center text-slate-400 italic">
              Faol muddatli to'lovlar (rassrochka) rejasi mavjud emas.
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
                        Jami: {Number(plan.total_price || 0).toLocaleString()} UZS | {inst.months} oylik jadval
                      </p>
                    </div>
                    <div className="text-right font-mono">
                      <span className="text-[10px] text-slate-400 block font-bold">Oylik to'lov</span>
                      <span className="text-xs font-black text-indigo-700">{Number(inst.monthly_amount || 0).toLocaleString()} UZS</span>
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
                            <span className="font-bold text-slate-700 text-[11px]">{i + 1}-oy</span>
                            <span className={cn("text-[9px] font-bold px-1.5 py-0.2 rounded", isPaid ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-600")}>
                              {isPaid ? 'Yopilgan' : 'Kutilmoqda'}
                            </span>
                          </div>

                          <div>
                            <span className="text-[10px] text-slate-400 block">{monthDate.toLocaleDateString('uz-UZ', { month: 'short', year: 'numeric' })}</span>
                            <span className="font-mono font-bold text-slate-800 text-[11px]">{Number(inst.monthly_amount || 0).toLocaleString()} UZS</span>
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

      {/* ══ EXACT TO'LOVLAR BO'LIMIDAGI KVITANSIYA & EXCEL SHEET MOLIYAVIY HISOB-KITOB DIALOGI ══ */}
      {selectedPayment && (() => {
        const sp = selectedPayment;
        const paymentAmount = Number(sp.amount) || 0;
        const methodLabel = sp.payment_method || sp.method || 'Naqd';
        const doc = doctors.find(d => d.id === sp.doctor_id) || { name: sp.doctor_name || patient?.doctor_name || 'Shifokor' };
        const dateStr = sp.date || sp.created_date ? new Date(sp.date || sp.created_date).toLocaleString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
        const receiptNo = sp.calculatedReceiptNo || sp.receipt_number || `REC-${1000}`;

        // Plans & Financial calculations
        const rawPlansTotal = plans.reduce((sum, pl) => sum + (Number(pl.total_price) || 0), 0);
        const discAmt = plans.reduce((sum, pl) => sum + (Number(pl.discount_amount) || 0), 0);
        const origPrice = rawPlansTotal > 0 ? (rawPlansTotal + discAmt) : (totalPaid + totalDebt);
        const discPct = origPrice > 0 && discAmt > 0 ? Math.round((discAmt / origPrice) * 100) : 0;
        const finTotal = rawPlansTotal > 0 ? rawPlansTotal : Math.max(0, origPrice - discAmt);
        const displayPaid = Number(totalPaid || 0);
        const debtAtPaymentTime = Number(totalDebt || 0);

        return (
          <Dialog open={!!selectedPayment} onOpenChange={(open) => !open && setSelectedPayment(null)}>
            <DialogContent className="w-[96vw] max-w-3xl p-0 overflow-hidden rounded-2xl border border-slate-300 shadow-2xl [&>button]:hidden bg-white">
              <DialogTitle className="sr-only">To'lov Tafsiloti va Kvitansiya</DialogTitle>
              {/* ── Top Header Bar (Excel CRM Receipt Style) ── */}
              <div className="bg-slate-900 text-white px-5 py-4 flex flex-wrap items-center justify-between gap-3 border-b-2 border-emerald-500">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-widest">
                        № {receiptNo} • EXCEL KVITANSIYA
                      </span>
                      <span className="px-2 py-0.2 rounded-full text-[9px] font-black uppercase bg-white/10 text-white border border-white/20">
                        {methodLabel}
                      </span>
                    </div>
                    <div className="text-2xl font-mono font-black text-white tracking-tight flex items-baseline gap-1.5 mt-0.5">
                      <span className="text-emerald-400">+</span>
                      {paymentAmount.toLocaleString()}
                      <span className="text-xs font-sans font-bold text-slate-400">UZS</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePrintReceipt(sp)}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
                    title="Chekni chop etish"
                  >
                    <Printer className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Chop etish</span>
                  </button>
                  <button
                    onClick={() => setSelectedPayment(null)}
                    className="w-8 h-8 rounded-xl bg-white/10 hover:bg-rose-500/20 hover:text-rose-300 flex items-center justify-center text-slate-400 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* ── Modal Scrollable Body ── */}
              <div className="p-5 space-y-4 max-h-[78vh] overflow-y-auto bg-slate-50/50">

                {/* ─── 1. Bemor va To'lov Parametrlari (Excel Data Grid Table) ─── */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                  <div className="bg-slate-100/90 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-[10.5px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <TableIcon className="w-3.5 h-3.5 text-[#1499AD]" />
                      Bemor va to'lov parametrlari
                    </span>
                    <span className="text-[10px] font-mono font-bold text-slate-500">
                      {dateStr}
                    </span>
                  </div>

                  <table className="w-full border-collapse text-xs">
                    <tbody>
                      <tr className="border-b border-slate-200">
                        <td className="w-1/4 bg-slate-50/80 px-3.5 py-2 font-bold text-slate-500 uppercase text-[10px] border-r border-slate-200">
                          Bemor (F.I.Sh):
                        </td>
                        <td className="w-1/4 px-3.5 py-2 font-extrabold text-slate-900 border-r border-slate-200">
                          <span>{patient?.full_name || sp.patient_name || '—'}</span>
                        </td>
                        <td className="w-1/4 bg-slate-50/80 px-3.5 py-2 font-bold text-slate-500 uppercase text-[10px] border-r border-slate-200">
                          Telefon:
                        </td>
                        <td className="w-1/4 px-3.5 py-2 font-mono font-bold text-slate-900">
                          <div className="flex items-center justify-between gap-1">
                            <span>{patient?.phone ? formatPhone(patient.phone) : '—'}</span>
                            {patient?.phone && (
                              <button
                                onClick={(e) => handleCopyPhone(e, patient.phone)}
                                className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
                                title="Nusxalash"
                              >
                                {copiedPhone ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      <tr className="border-b border-slate-200">
                        <td className="bg-slate-50/80 px-3.5 py-2 font-bold text-slate-500 uppercase text-[10px] border-r border-slate-200">
                          Shifokor:
                        </td>
                        <td className="px-3.5 py-2 font-bold text-slate-800 border-r border-slate-200">
                          {doc?.name || doc?.full_name || 'Biriktirilmagan'}
                        </td>
                        <td className="bg-slate-50/80 px-3.5 py-2 font-bold text-slate-500 uppercase text-[10px] border-r border-slate-200">
                          To'lov Usuli:
                        </td>
                        <td className="px-3.5 py-2 font-bold text-slate-800">
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-bold">
                            {methodLabel}
                          </span>
                        </td>
                      </tr>

                      <tr>
                        <td className="bg-slate-50/80 px-3.5 py-2 font-bold text-slate-500 uppercase text-[10px] border-r border-slate-200">
                          Xizmat / Kategoriya:
                        </td>
                        <td className="px-3.5 py-2 font-bold text-slate-800 border-r border-slate-200" colSpan={3}>
                          <span>{sp.treatment_name || sp.service_name || sp.category || 'Davolash muolajasi'}</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* ─── 2. Davolash Rejasi & Moliyaviy Hisob-kitob (Excel Spreadsheet Balance Sheet) ─── */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                  <div className="bg-slate-100/90 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-[10.5px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                      Davolash rejasi & moliyaviy hisob-kitob (Excel Sheet)
                    </span>
                    <span className="text-[10px] font-bold text-slate-500">
                      UZS (So'm)
                    </span>
                  </div>

                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[9.5px]">
                        <th className="w-10 py-1.5 px-3 text-center border-r border-slate-200">№</th>
                        <th className="py-1.5 px-3.5 text-left border-r border-slate-200">Moliyaviy Ko'rsatkich</th>
                        <th className="py-1.5 px-3.5 text-right border-r border-slate-200">Summa (UZS)</th>
                        <th className="py-1.5 px-3.5 text-left">Holat / Formula</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/80 font-mono">
                      
                      {/* 1. Reja narxi */}
                      <tr className="hover:bg-slate-50/60">
                        <td className="text-center font-bold text-slate-400 border-r border-slate-200 py-2">01</td>
                        <td className="px-3.5 py-2 font-sans font-bold text-slate-800 border-r border-slate-200">Reja (asl narxi)</td>
                        <td className="px-3.5 py-2 text-right font-black text-slate-900 border-r border-slate-200">
                          {origPrice.toLocaleString()}
                        </td>
                        <td className="px-3.5 py-2 font-sans text-slate-500 text-[11px]">Barcha xizmatlar summasi</td>
                      </tr>

                      {/* 2. Chegirma */}
                      <tr className="hover:bg-purple-50/40 bg-purple-50/20">
                        <td className="text-center font-bold text-purple-400 border-r border-slate-200 py-2">02</td>
                        <td className="px-3.5 py-2 font-sans font-bold text-purple-800 border-r border-slate-200">Qo'llanilgan Chegirma</td>
                        <td className="px-3.5 py-2 text-right font-black text-purple-700 border-r border-slate-200">
                          {discAmt > 0 ? `-${discAmt.toLocaleString()}` : '0'} <span className="font-sans text-[10px] font-bold">({discPct}%)</span>
                        </td>
                        <td className="px-3.5 py-2 font-sans text-purple-600 text-[11px]">Bemor uchun chegirma</td>
                      </tr>

                      {/* 3. Chegirmali jami summa */}
                      <tr className="hover:bg-blue-50/40 bg-blue-50/10">
                        <td className="text-center font-bold text-blue-400 border-r border-slate-200 py-2">03</td>
                        <td className="px-3.5 py-2 font-sans font-extrabold text-blue-900 border-r border-slate-200">To'lanishi Kerak (Chegirmali)</td>
                        <td className="px-3.5 py-2 text-right font-black text-blue-700 border-r border-slate-200">
                          {finTotal.toLocaleString()}
                        </td>
                        <td className="px-3.5 py-2 font-sans text-blue-600 text-[11px]">Reja – Chegirma = Jami</td>
                      </tr>

                      {/* 4. Ushbu to'lov */}
                      <tr className="bg-emerald-50/50 hover:bg-emerald-50">
                        <td className="text-center font-bold text-emerald-600 border-r border-slate-200 py-2">04</td>
                        <td className="px-3.5 py-2 font-sans font-black text-emerald-900 border-r border-slate-200 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          Ushbu To'lov (Kvitansiya)
                        </td>
                        <td className="px-3.5 py-2 text-right font-black text-emerald-700 border-r border-slate-200 text-[13px]">
                          +{paymentAmount.toLocaleString()}
                        </td>
                        <td className="px-3.5 py-2 font-sans font-bold text-emerald-700 text-[11px]">
                          ✓ Kirim to'lovi ({methodLabel})
                        </td>
                      </tr>

                      {/* 5. Jami to'langan */}
                      <tr className="hover:bg-slate-50/60">
                        <td className="text-center font-bold text-slate-400 border-r border-slate-200 py-2">05</td>
                        <td className="px-3.5 py-2 font-sans font-bold text-slate-800 border-r border-slate-200">Bemor Jami To'lagan</td>
                        <td className="px-3.5 py-2 text-right font-black text-emerald-600 border-r border-slate-200">
                          {displayPaid.toLocaleString()}
                        </td>
                        <td className="px-3.5 py-2 font-sans text-slate-500 text-[11px]">Barcha to'lovlar yig'indisi</td>
                      </tr>

                      {/* 6. Qoldiq Qarz */}
                      <tr className={debtAtPaymentTime > 0 ? "bg-rose-50/50 hover:bg-rose-50" : "bg-emerald-50/30"}>
                        <td className={`text-center font-bold border-r border-slate-200 py-2 ${debtAtPaymentTime > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>06</td>
                        <td className={`px-3.5 py-2 font-sans font-black border-r border-slate-200 ${debtAtPaymentTime > 0 ? 'text-rose-900' : 'text-emerald-900'}`}>
                          Qoldiq Qarz
                        </td>
                        <td className={`px-3.5 py-2 text-right font-black border-r border-slate-200 text-[13px] ${debtAtPaymentTime > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {debtAtPaymentTime > 0 ? `${debtAtPaymentTime.toLocaleString()}` : "0 (✓ To'liq)"}
                        </td>
                        <td className={`px-3.5 py-2 font-sans font-bold text-[11px] ${debtAtPaymentTime > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {debtAtPaymentTime > 0 ? "To'lanmagan qarzdorlik" : "✓ Qarzi yo'q"}
                        </td>
                      </tr>

                    </tbody>
                  </table>
                </div>

                {/* ─── 3. Oldingi To'lovlar Tarixi (Jadval) ─── */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowHistory(!showHistory)}
                    className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-xs font-bold text-slate-700 transition-colors border-none cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span>Bemorning to'lovlar tarixi</span>
                      {realIncomePayments.length > 0 && (
                        <span className="px-1.5 py-0.2 bg-slate-200 text-slate-700 text-[10px] font-black rounded-full">
                          {realIncomePayments.length}
                        </span>
                      )}
                    </span>
                    <span className="text-[11px] text-[#1499AD] font-black">
                      {showHistory ? '▲ Yashirish' : '▼ Ko\'rish'}
                    </span>
                  </button>

                  {showHistory && (
                    <div className="border-t border-slate-200 p-3 bg-white">
                      {realIncomePayments.length === 0 ? (
                        <div className="py-4 text-center text-xs text-slate-400 italic">Boshqa to'lovlar topilmadi</div>
                      ) : (
                        <div className="overflow-x-auto max-h-48 scrollbar-thin">
                          <table className="w-full border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-100 border-b border-slate-200 text-slate-500 uppercase text-[9px] font-bold">
                                <th className="py-1 px-2 text-center border-r border-slate-200">№</th>
                                <th className="py-1 px-2.5 text-left border-r border-slate-200">Sana & Vaqt</th>
                                <th className="py-1 px-2.5 text-left border-r border-slate-200">Usuli</th>
                                <th className="py-1 px-2.5 text-left border-r border-slate-200">Kategoriya</th>
                                <th className="py-1 px-2.5 text-right">Summa (UZS)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-mono">
                              {realIncomePayments.map((histPay, hIdx) => {
                                const hAmt = Number(histPay.amount) || 0;
                                const hMethod = histPay.payment_method || histPay.method || 'Naqd';
                                const hDate = histPay.created_date || histPay.date;
                                const hDateStr = hDate ? new Date(hDate).toLocaleString('uz-UZ') : '—';
                                const isCurrent = histPay.id === sp.id;

                                return (
                                  <tr key={histPay.id || hIdx} className={`hover:bg-slate-50 ${isCurrent ? 'bg-emerald-50/60 font-bold' : ''}`}>
                                    <td className="py-1.5 px-2 text-center border-r border-slate-200 text-slate-400 font-sans text-[10px]">
                                      {hIdx + 1}
                                    </td>
                                    <td className="py-1.5 px-2.5 border-r border-slate-200 font-sans text-slate-700 text-[11px]">
                                      {hDateStr}
                                    </td>
                                    <td className="py-1.5 px-2.5 border-r border-slate-200 font-sans text-slate-600">
                                      {hMethod}
                                    </td>
                                    <td className="py-1.5 px-2.5 border-r border-slate-200 font-sans text-[10.5px]">
                                      {histPay.treatment_name || histPay.service_name || histPay.category || 'Davolash'}
                                    </td>
                                    <td className="py-1.5 px-2.5 text-right font-black text-emerald-600">
                                      +{hAmt.toLocaleString()}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ─── 4. Izoh ─── */}
                {sp.notes && (
                  <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs">
                    <span className="text-[9.5px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                      Izoh / Qo'shimcha ma'lumot:
                    </span>
                    <p className="font-semibold text-slate-800 whitespace-pre-wrap">
                      {sp.notes}
                    </p>
                  </div>
                )}

              </div>

              {/* ─── Modal Footer ─── */}
              <div className="bg-slate-100/90 px-5 py-3 border-t border-slate-200 flex items-center justify-between gap-3">
                {onDeletePayment ? (
                  <button
                    onClick={() => {
                      const payId = sp.id;
                      setSelectedPayment(null);
                      onDeletePayment(payId);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-rose-600 hover:bg-rose-100/80 text-xs font-bold transition-all border border-rose-200 bg-white cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>O'chirish</span>
                  </button>
                ) : <div />}

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePrintReceipt(sp)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-300 hover:border-[#1499AD] text-slate-700 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-600" />
                    <span>Chop etish</span>
                  </button>
                  <button
                    onClick={() => setSelectedPayment(null)}
                    className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                  >
                    Yopish
                  </button>
                </div>
              </div>

            </DialogContent>
          </Dialog>
        );
      })()}
    </div>
  );
}

export default memo(ExcelPaymentsView);
