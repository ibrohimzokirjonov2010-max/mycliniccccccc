import { useState, useMemo, memo } from 'react';
import { useTranslation } from '@/i18n/LanguageContext';
import { 
  CreditCard, Plus, Search, FileSpreadsheet,
  ArrowUpDown, ExternalLink, User, Building,
  Banknote, CheckCircle2, X, Printer, Trash2,
  Table as TableIcon, Copy, Check, Clock, Receipt
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
  const { t, language } = useTranslation();
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

  // Dynamic calculation of plan paid amount & debt from patient payments
  const enrichedPlans = useMemo(() => {
    if (!plans || plans.length === 0) return [];
    
    // Total income payments made by the patient
    const totalPatientIncomes = realIncomePayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const effectiveTotalPaid = Math.max(totalPatientIncomes, Number(totalPaid) || 0, Number(patient?.total_paid) || 0);

    // Track pool of paid money to allocate across plans
    let remainingPoolToAllocate = effectiveTotalPaid;

    return plans.map((plan, idx) => {
      const planPrice = Number(plan.total_price || 0);
      
      // 1. Direct payments linked to this plan by plan_id, notes, or name
      const directPays = realIncomePayments.filter(p => {
        if (p.plan_id && p.plan_id === plan.id) return true;
        const notes = (p.notes || '').toLowerCase();
        const sName = (p.service_name || p.treatment_name || p.category || '').toLowerCase();
        const pName = (plan.name || '').toLowerCase();
        return (pName && (notes.includes(pName) || sName.includes(pName)));
      });
      const directPaidSum = directPays.reduce((s, p) => s + (Number(p.amount) || 0), 0);

      // 2. Base recorded plan.paid_amount
      const baseRecordedPaid = Number(plan.paid_amount) || 0;

      let calculatedPaid = Math.max(directPaidSum, baseRecordedPaid);

      // If only 1 plan exists for this patient, ALL patient's income payments apply to this single plan!
      if (plans.length === 1) {
        calculatedPaid = Math.max(calculatedPaid, effectiveTotalPaid);
      } else {
        // If multiple plans, allocate from remaining pool
        if (calculatedPaid === 0 && remainingPoolToAllocate > 0) {
          const alloc = Math.min(planPrice > 0 ? planPrice : remainingPoolToAllocate, remainingPoolToAllocate);
          calculatedPaid = alloc;
          remainingPoolToAllocate = Math.max(0, remainingPoolToAllocate - alloc);
        } else {
          remainingPoolToAllocate = Math.max(0, remainingPoolToAllocate - calculatedPaid);
        }
      }

      const effectivePaid = planPrice > 0 ? Math.min(planPrice, calculatedPaid) : calculatedPaid;
      const effectiveDebt = Math.max(0, planPrice - effectivePaid);

      return {
        ...plan,
        paid_amount: effectivePaid,
        effectiveDebt,
        calculatedPrice: planPrice
      };
    });
  }, [plans, realIncomePayments, totalPaid, patient?.total_paid]);

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

  const formatPaymentMethod = (method) => {
    const m = String(method || '').toLowerCase();
    if (m.includes('card') || m.includes('karta') || m.includes('humo') || m.includes('uzcard') || m.includes('terminal')) return 'Plastik karta';
    if (m.includes('bank') || m.includes('hisob') || m.includes('transfer') || m.includes('o\'tkazma')) return 'Bank o\'tkazmasi';
    if (m.includes('installment') || m.includes('nasiya') || m.includes('rassrochka') || m.includes('muddatli')) return 'Muddatli to\'lov';
    if (m.includes('click') || m.includes('payme') || m.includes('uzum')) return 'Onlayn to\'lov';
    return 'Naqd pul';
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

  const handleCopyPhone = (e, phone) => {
    e.stopPropagation();
    if (!phone) return;
    navigator.clipboard?.writeText(phone);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

    const handlePrintReceipt = (p) => {
    const receiptNo = (p.id || '').slice(0, 8).toUpperCase() || '4F255F';
    const patientName = patient?.full_name || p.patient_name || 'Bemor';
    const doctorName = (doctors || []).find(d => d.id === (p.doctor_id || patient?.doctor_id))?.name || 'Klinika shifokori';
    const dtRaw = p.created_date || p.created_at || p.date || new Date().toISOString();
    const dtObj = new Date(dtRaw);
    const dateFormatted = !isNaN(dtObj) ? `${String(dtObj.getDate()).padStart(2,'0')}.${String(dtObj.getMonth()+1).padStart(2,'0')}.${dtObj.getFullYear()}` : new Date().toLocaleDateString('uz-UZ');
    const dateTimeFormatted = !isNaN(dtObj) ? `${dateFormatted} ${String(dtObj.getHours()).padStart(2,'0')}:${String(dtObj.getMinutes()).padStart(2,'0')}` : dateFormatted;

    // Services from plans
    let allServices = [];
    (plans || []).forEach(pl => {
      if (Array.isArray(pl.services) && pl.services.length > 0) {
        pl.services.forEach(s => {
          const rawToothId = pl.tooth_number || s.tooth_id || s.tooth || '—';
          allServices.push({
            name: s.service_name || s.name || pl.name || 'Davolash xizmati',
            category: s.category || pl.department || 'Plomba / Davolash',
            tooth: rawToothId && rawToothId !== 'general' ? rawToothId : '—',
            status: s.status || pl.status || 'completed',
            price: Number(s.price || s.cost || 0)
          });
        });
      } else if (pl.name) {
        allServices.push({
          name: pl.name,
          category: pl.department || 'Davolash rejasi',
          tooth: pl.tooth_number || '—',
          status: pl.status || 'completed',
          price: Number(pl.total_price || 0)
        });
      }
    });

    if (allServices.length === 0) {
      allServices.push({
        name: p.treatment_name || p.service_name || p.category || 'Davolash muolajasi',
        category: 'Davolash',
        tooth: '—',
        status: 'completed',
        price: Number(p.amount || 0)
      });
    }

    const totalExpense = allServices.reduce((sum, s) => sum + (s.price || 0), 0) || Number(p.amount || 0);

    // Payments list
    let validPayments = (payments || []).filter(item => item.type?.toLowerCase() === 'income' || !item.type);
    if (validPayments.length === 0) {
      validPayments = [p];
    }
    const totalPaidSum = validPayments.reduce((sum, item) => sum + (Number(item.amount) || 0), 0) || Number(p.amount || 0);
    const finalDebt = Math.max(0, totalExpense - totalPaidSum);

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html lang="uz">
      <head>
        <meta charset="utf-8">
        <title>Hisob-faktura - ${patientName}</title>
        <style>
          @page {
            size: A4;
            margin: 12mm 15mm;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            color: #0f172a;
            background: #fff;
            margin: 0;
            padding: 24px;
            max-width: 780px;
            margin: 0 auto;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
          }
          .clinic-brand {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .clinic-logo {
            width: 42px;
            height: 42px;
            color: #0284c7;
          }
          .clinic-title {
            font-size: 22px;
            font-weight: 900;
            color: #0284c7;
            margin: 0;
            line-height: 1.1;
          }
          .clinic-sub {
            font-size: 11px;
            color: #64748b;
            margin: 3px 0 0 0;
            font-weight: 500;
          }
          .clinic-contact {
            font-size: 11px;
            color: #475569;
            margin: 2px 0 0 0;
            font-weight: 600;
          }
          .invoice-meta {
            text-align: right;
          }
          .invoice-title {
            font-size: 16px;
            font-weight: 900;
            color: #0f172a;
            letter-spacing: 0.5px;
            margin: 0;
            text-transform: uppercase;
          }
          .meta-row {
            font-size: 11px;
            color: #64748b;
            margin-top: 3px;
          }
          .meta-num {
            font-family: monospace;
            font-weight: 700;
            color: #0f172a;
          }
          .divider {
            height: 2px;
            background: #0ea5e9;
            margin: 14px 0 20px 0;
          }
          .section-title {
            font-size: 11px;
            font-weight: 900;
            color: #0284c7;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            margin: 0 0 10px 0;
          }
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            border-top: 1px solid #f1f5f9;
            border-bottom: 1px solid #f1f5f9;
            padding: 10px 0;
            margin-bottom: 22px;
            gap: 10px 24px;
          }
          .info-item {
            display: flex;
            flex-direction: column;
          }
          .info-label {
            font-size: 10px;
            color: #94a3b8;
            font-weight: 600;
            margin-bottom: 2px;
          }
          .info-val {
            font-size: 13px;
            font-weight: 800;
            color: #0f172a;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 22px;
            font-size: 12px;
          }
          thead tr {
            background: #f8fafc;
            border-top: 1px solid #e2e8f0;
            border-bottom: 1px solid #e2e8f0;
          }
          th {
            padding: 8px 10px;
            text-align: left;
            font-size: 11px;
            font-weight: 700;
            color: #475569;
          }
          td {
            padding: 9px 10px;
            border-bottom: 1px solid #f1f5f9;
            color: #1e293b;
            font-weight: 500;
          }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .font-bold { font-weight: 700; }
          .font-black { font-weight: 900; }
          .total-expense-row td {
            font-weight: 900;
            border-top: 1.5px solid #cbd5e1;
            border-bottom: none;
            padding-top: 11px;
            font-size: 13px;
          }
          .paid-total-row td {
            background: #dcfce7 !important;
            color: #166534 !important;
            font-weight: 900 !important;
            font-size: 13px !important;
            border: none !important;
            padding: 10px 10px !important;
          }
          .signatures {
            display: flex;
            justify-content: space-between;
            margin-top: 40px;
            padding-top: 20px;
          }
          .sig-col {
            width: 42%;
          }
          .sig-line {
            border-bottom: 1px solid #334155;
            margin-bottom: 6px;
          }
          .sig-name {
            font-size: 11px;
            font-weight: 700;
            color: #475569;
          }
          .footer-note {
            text-align: center;
            font-size: 10px;
            color: #94a3b8;
            margin-top: 32px;
            font-weight: 500;
          }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="clinic-brand">
            <svg class="clinic-logo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2C8.7 2 6 4.7 6 8c0 4 3 7 6 10 3-3 6-6 6-10 0-3.3-2.7-6-6-6z" />
            </svg>
            <div>
              <h1 class="clinic-title">DentaCRM</h1>
              <p class="clinic-sub">Professional stomatologiya klinikasi</p>
              <p class="clinic-contact">Tel: +998 71 123 45 67 | Toshkent sh.</p>
            </div>
          </div>
          <div class="invoice-meta">
            <h2 class="invoice-title">HISOB-FAKTURA</h2>
            <div class="meta-row">Sana: ${dateFormatted}</div>
            <div class="meta-row">№ <span class="meta-num">${receiptNo}</span></div>
          </div>
        </div>

        <div class="divider"></div>

        <div class="section-title">BEMOR MA'LUMOTLARI</div>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">To'liq ismi</span>
            <span class="info-val">${patientName}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Uchrashuv sanasi</span>
            <span class="info-val">${dateTimeFormatted}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Doktor</span>
            <span class="info-val">${doctorName}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Davolash turi</span>
            <span class="info-val">${p.treatment_name || p.service_name || p.category || 'Davolash rejasi'}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Holati</span>
            <span class="info-val" style="color: #16a34a;">To'langan</span>
          </div>
        </div>

        <div class="section-title">DAVOLASHLAR RO'YXATI</div>
        <table>
          <thead>
            <tr>
              <th>Davolash nomi</th>
              <th>Kategoriya</th>
              <th class="text-center">Tish #</th>
              <th class="text-center">Holati</th>
              <th class="text-right">Narxi</th>
            </tr>
          </thead>
          <tbody>
            ${allServices.map(s => `
              <tr>
                <td class="font-bold">${s.name}</td>
                <td>${s.category}</td>
                <td class="text-center">${s.tooth}</td>
                <td class="text-center"><span style="color:#0284c7; font-weight:600;">${s.status}</span></td>
                <td class="text-right font-bold">${Number(s.price || 0).toLocaleString()} so'm</td>
              </tr>
            `).join('')}
            <tr class="total-expense-row">
              <td colspan="4">Jami xarajat</td>
              <td class="text-right font-black">${totalExpense.toLocaleString()} so'm</td>
            </tr>
          </tbody>
        </table>

        <div class="section-title">TO'LOVLAR</div>
        <table>
          <thead>
            <tr>
              <th>Sana</th>
              <th>To'lov usuli</th>
              <th class="text-center">Holati</th>
              <th class="text-right">Summa</th>
            </tr>
          </thead>
          <tbody>
            ${validPayments.map(item => {
              const pDateRaw = item.created_date || item.created_at || item.date;
              const pDate = pDateRaw ? new Date(pDateRaw).toLocaleDateString('uz-UZ') : dateFormatted;
              return `
                <tr>
                  <td>${pDate}</td>
                  <td class="font-bold">${formatPaymentMethod(item.payment_method || item.method)}</td>
                  <td class="text-center"><span style="color:#16a34a; font-weight:700;">To'langan</span></td>
                  <td class="text-right font-bold">${Number(item.amount || 0).toLocaleString()} so'm</td>
                </tr>
              `;
            }).join('')}
            <tr class="paid-total-row">
              <td colspan="3">To'langan jami</td>
              <td class="text-right font-black">${totalPaidSum.toLocaleString()} so'm</td>
            </tr>
            ${finalDebt > 0 ? `
              <tr>
                <td colspan="3" style="font-weight:900; color:#e11d48; padding-top:8px;">Qoldiq qarz:</td>
                <td class="text-right font-black" style="color:#e11d48; font-size:13px; padding-top:8px;">${finalDebt.toLocaleString()} so'm</td>
              </tr>
            ` : ''}
          </tbody>
        </table>

        <div class="signatures">
          <div class="sig-col">
            <div class="sig-line"></div>
            <div class="sig-name">Bemor imzosi: ${patientName}</div>
          </div>
          <div class="sig-col">
            <div class="sig-line"></div>
            <div class="sig-name">Doktor imzosi: ${doctorName}</div>
          </div>
        </div>

        <div class="footer-note">
          Hujjat ${dateFormatted} sanasida DentaCRM tizimi tomonidan yaratildi | Ushbu hujjat rasmiy hisoblanadi
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 250);
          }
        </script>
      </body>
      </html>
    `);
    win.document.close();
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

      {/* ══ VIEW 1: PAYMENTS KASSA LEDGER TABLE ══ */}
      {subTab === 'ledger' && (
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full border-collapse text-left font-sans text-sm">
              <thead>
                <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-xs">
                  <th className="py-3 px-3.5 border-r border-slate-200 text-center w-12 bg-slate-200/60 font-mono">№</th>
                  <th 
                    className="py-3 px-3.5 border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors font-mono select-none"
                    onClick={() => toggleSort('date')}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span>{t('common.dateTime') || "Sana & Vaqt"}</span>
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                  </th>
                  <th className="py-3 px-3.5 border-r border-slate-200">{t('patientProfile.paymentTypeCol') || "To'lov Turi"}</th>
                  <th className="py-3 px-3.5 border-r border-slate-200">{t('patientProfile.doctorCol') || "Shifokor"}</th>
                  <th 
                    className="py-3 px-3.5 border-r border-slate-200 text-right cursor-pointer hover:bg-slate-200/60 transition-colors select-none min-w-[130px]"
                    onClick={() => toggleSort('amount')}
                  >
                    <div className="flex items-center justify-end gap-1.5 font-mono">
                      <span>{t('patientProfile.paidAmountCol') || "To'langan Summa"}</span>
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                  </th>
                  <th className="py-3 px-3.5 min-w-[140px]">{t('common.notes') || "Izoh"}</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 italic bg-slate-50/50">
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
                          "border-r border-slate-200 text-center font-mono font-bold text-slate-500 bg-slate-100/40 text-xs",
                          density === 'compact' ? 'py-3.5 px-3' : 'py-4.5 px-3.5'
                        )}>
                          {idx + 1}
                        </td>

                        {/* Date */}
                        <td className={cn("border-r border-slate-200 font-mono font-semibold text-slate-700 whitespace-nowrap text-xs sm:text-sm", density === 'compact' ? 'py-3.5 px-3.5' : 'py-4.5 px-4')}>
                          {dateStr}
                        </td>

                        {/* Payment Method */}
                        <td className={cn("border-r border-slate-200 text-xs sm:text-sm", density === 'compact' ? 'py-3.5 px-3.5' : 'py-4.5 px-4')}>
                          {getMethodBadge(p.payment_method || p.method)}
                        </td>

                        {/* Doctor */}
                        <td className={cn("border-r border-slate-200 font-semibold text-slate-800 text-xs sm:text-sm", density === 'compact' ? 'py-3.5 px-3.5' : 'py-4.5 px-4')}>
                          <div className="flex items-center gap-1.5">
                            <User className="w-4 h-4 text-slate-400 shrink-0" />
                            <span>{p.doctor_name || patient?.doctor_name || (language === 'ru' ? 'Врач' : language === 'en' ? 'Doctor' : 'Shifokor')}</span>
                          </div>
                        </td>

                        {/* Amount */}
                        <td className={cn("border-r border-slate-200 text-right font-mono font-black text-emerald-700 bg-emerald-50/40 text-sm sm:text-base tracking-tight", density === 'compact' ? 'py-3.5 px-3.5' : 'py-4.5 px-4')}>
                          +{Number(p.amount || 0).toLocaleString()} UZS
                        </td>

                        {/* Notes */}
                        <td className={cn("text-slate-600 italic text-xs sm:text-sm", density === 'compact' ? 'py-3.5 px-3.5' : 'py-4.5 px-4')}>
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
            <table className="w-full border-collapse text-left font-sans text-sm">
              <thead>
                <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-xs">
                  <th className="py-3 px-3.5 border-r border-slate-200 text-center w-12 bg-slate-200/60 font-mono">№</th>
                  <th className="py-3 px-3.5 border-r border-slate-200 min-w-[200px]">{language === 'ru' ? 'План / Процедура' : language === 'en' ? 'Plan / Treatment Name' : 'Reja / Muolaja Nomi'}</th>
                  <th className="py-3 px-3.5 border-r border-slate-200 font-mono">{t('common.date') || 'Sana'}</th>
                  <th className="py-3 px-3.5 border-r border-slate-200">{t('patientProfile.doctorCol') || 'Shifokor'}</th>
                  <th className="py-3 px-3.5 border-r border-slate-200 text-right font-mono min-w-[130px]">{language === 'ru' ? 'Стоимость плана' : language === 'en' ? 'Plan Price' : 'Reja Narxi'}</th>
                  <th className="py-3 px-3.5 border-r border-slate-200 text-right font-mono min-w-[130px]">{t('patientProfile.paidLabel') || 'To\'langan'}</th>
                  <th className="py-3 px-3.5 border-r border-slate-200 text-right font-mono min-w-[130px]">{language === 'ru' ? 'Остаток долга' : language === 'en' ? 'Remaining Debt' : 'Qoldiq Qarz'}</th>
                  <th className="py-3 px-3.5 text-center min-w-[100px]">{t('patientProfile.invoiceCol') || 'Faktura'}</th>
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
                        <td className="border-r border-slate-200 text-center font-mono font-bold text-slate-500 bg-slate-100/40 text-xs py-3.5 px-3">
                          {idx + 1}
                        </td>
                        <td className="border-r border-slate-200 font-bold text-slate-900 text-sm py-3.5 px-3.5">
                          {plan.name || `Davolash rejasi #${idx + 1}`}
                        </td>
                        <td className="border-r border-slate-200 font-mono font-semibold text-slate-700 text-xs sm:text-sm py-3.5 px-3.5">
                          {plan.created_date ? new Date(plan.created_date).toLocaleDateString('uz-UZ') : '—'}
                        </td>
                        <td className="border-r border-slate-200 font-semibold text-slate-800 text-xs sm:text-sm py-3.5 px-3.5">
                          <div className="flex items-center gap-1.5">
                            <User className="w-4 h-4 text-slate-400 shrink-0" />
                            <span>{plan.doctor_name || patient?.doctor_name || (language === 'ru' ? 'Врач' : language === 'en' ? 'Doctor' : 'Shifokor')}</span>
                          </div>
                        </td>
                        <td className="border-r border-slate-200 text-right font-mono font-black text-slate-950 text-sm sm:text-base tracking-tight py-3.5 px-3.5">
                          {price.toLocaleString()} UZS
                        </td>
                        <td className="border-r border-slate-200 text-right font-mono font-black text-emerald-700 text-sm sm:text-base tracking-tight py-3.5 px-3.5">
                          {paid.toLocaleString()} UZS
                        </td>
                        <td className={cn(
                          "border-r border-slate-200 text-right font-mono font-black text-sm sm:text-base tracking-tight py-3.5 px-3.5",
                          debt > 0 ? "text-amber-950 bg-amber-50/30" : "text-emerald-700 bg-emerald-50/20"
                        )}>
                          {debt > 0 ? (
                            <span className="inline-flex items-center justify-end gap-1.5 text-amber-950">
                              <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                              <span>{debt.toLocaleString()} <span className="text-xs font-bold text-amber-800">UZS</span></span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-end gap-1 text-emerald-700 font-bold text-xs sm:text-sm">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              <span>{t('patientProfile.paidLabel') || 'To\'langan'}</span>
                            </span>
                          )}
                        </td>
                        <td className="text-center py-3 px-3">
                          <button
                            onClick={() => onOpenPlanInvoice && onOpenPlanInvoice(plan)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
                          >
                            <span>{t('patientProfile.invoiceBtn') || 'Faktura'}</span>
                            <ExternalLink className="w-3.5 h-3.5" />
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
                        {language === 'ru' ? 'Итого: ' : 'Jami: '}{Number(plan.total_price || 0).toLocaleString()} UZS | {inst.months} {language === 'ru' ? 'мес. график' : 'oylik jadval'}
                      </p>
                    </div>
                    <div className="text-right font-mono">
                      <span className="text-[10px] text-slate-400 block font-bold">{language === 'ru' ? 'Ежемесячный платёж' : language === 'en' ? 'Monthly payment' : 'Oylik to\'lov'}</span>
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
                            <span className="font-bold text-slate-700 text-[11px]">{i + 1}-{language === 'ru' ? 'й месяц' : language === 'en' ? 'month' : 'oy'}</span>
                            <span className={cn("text-[9px] font-bold px-1.5 py-0.2 rounded", isPaid ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-600")}>
                              {isPaid ? (language === 'ru' ? 'Оплачено' : 'Yopilgan') : (language === 'ru' ? 'Ожидается' : 'Kutilmoqda')}
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
        const methodLabel = formatPaymentMethod(sp.payment_method || sp.method);
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
              {/* ── Top Header Bar ── */}
              <div className="bg-slate-900 text-white px-5 py-4 flex flex-wrap items-center justify-between gap-3 border-b-2 border-emerald-500">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {methodLabel}
                      </span>
                    </div>
                    <div className="text-2xl font-mono font-black text-white tracking-tight flex items-baseline gap-1.5 mt-1">
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

                {/* ─── 1. Bemor va To'lov Parametrlari (Data Grid Table) ─── */}
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

                      <tr>
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
                    </tbody>
                  </table>
                </div>

                {/* ─── 2. Davolash Rejasi & Moliyaviy Hisob-kitob ─── */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                  <div className="bg-slate-100/90 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-[10.5px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Receipt className="w-3.5 h-3.5 text-indigo-600" />
                      Davolash rejasi & moliyaviy hisob-kitob
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
                      <tr className={debtAtPaymentTime > 0 ? "bg-amber-50/50 hover:bg-amber-50" : "bg-emerald-50/30"}>
                        <td className={`text-center font-bold border-r border-slate-200 py-2 ${debtAtPaymentTime > 0 ? 'text-amber-600' : 'text-emerald-500'}`}>06</td>
                        <td className={`px-3.5 py-2 font-sans font-black border-r border-slate-200 ${debtAtPaymentTime > 0 ? 'text-amber-950' : 'text-emerald-900'}`}>
                          Qoldiq Qarz
                        </td>
                        <td className={`px-3.5 py-2 text-right font-black border-r border-slate-200 text-[13px] ${debtAtPaymentTime > 0 ? 'text-amber-900' : 'text-emerald-600'}`}>
                          {debtAtPaymentTime > 0 ? `${debtAtPaymentTime.toLocaleString()}` : "0 (✓ To'liq)"}
                        </td>
                        <td className={`px-3.5 py-2 font-sans font-bold text-[11px] ${debtAtPaymentTime > 0 ? 'text-amber-800' : 'text-emerald-600'}`}>
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
                                const hMethod = formatPaymentMethod(histPay.payment_method || histPay.method);
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
