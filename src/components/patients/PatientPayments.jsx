import { useMemo, memo } from 'react';
import StatusBadge from '../ui/StatusBadge';
import EmptyState from '../ui/EmptyState';
import { CreditCard, TrendingUp, TrendingDown, Wallet, Printer } from 'lucide-react';

/**
 * PatientPayments Component
 * 
 * Displays patient payment history with income/expense summary cards.
 * Shows a table of all transactions with status badges.
 * 
 * @param {Object} props
 * @param {Array} props.payments - Array of payment objects
 * @param {string} props.payments[].id - Payment ID
 * @param {string} props.payments[].date - Payment date
 * @param {string} props.payments[].type - Payment type (Income, Expense, Refund, Debt)
 * @param {number} props.payments[].amount - Payment amount
 * @param {string} props.payments[].method - Payment method
 */
function PatientPayments({ payments = [] }) {
  const handlePrintPaymentReceipt = (payment) => {
    const win = window.open('', '_blank');
    const isIncome = payment.type === 'Income';
    
    // Dynamic titles based on language
    const currentLang = localStorage.getItem('app_language') || 'uz';
    const titles = {
      uz: isIncome ? "TO'LOV KVITANSIYASI (CHEK)" : "QAYTARISH / CHIQIM HUJJATI",
      ru: isIncome ? "ПЛАТЕЖНАЯ КВИТАНЦИЯ (ЧЕК)" : "ДОКУМЕНТ О ВОЗВРАТЕ / РАСХОДЕ",
      en: isIncome ? "PAYMENT RECEIPT (RECEIPT)" : "REFUND / EXPENSE DOCUMENT"
    };
    const title = titles[currentLang] || titles['uz'];
    
    const labels = {
      uz: { patient: "Bemor", date: "Sana", desc: "Muolaja / Izoh", method: "To'lov usuli", amount: "Summa", cashier: "Kassir / Mas'ul shaxs", patientSig: "Bemor imzosi" },
      ru: { patient: "Пациент", date: "Дата", desc: "Процедура / Примечание", method: "Способ оплаты", amount: "Сумма", cashier: "Кассир / Ответственное лицо", patientSig: "Подпись пациента" },
      en: { patient: "Patient", date: "Date", desc: "Treatment / Note", method: "Payment Method", amount: "Amount", cashier: "Cashier / Authorized Person", patientSig: "Patient Signature" }
    };
    const langLabels = labels[currentLang] || labels['uz'];

    const formatMethod = (m) => {
      const methods = {
        Cash: { uz: 'Naqd pul', ru: 'Наличные', en: 'Cash' },
        Card: { uz: 'Plastik karta', ru: 'Пластиковая карта', en: 'Card' },
        Transfer: { uz: 'Bank o\'tkazma', ru: 'Банковский перевод', en: 'Bank Transfer' }
      };
      return methods[m]?.[currentLang] || m || '—';
    };

    win.document.write(`
      <html><head><title>Chek</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; color: #1e293b; line-height: 1.6; }
        .header { border-bottom: 2px solid #10b981; padding-bottom: 15px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: center; }
        .logo { font-size: 24px; font-weight: 900; color: #0f172a; }
        .title { font-size: 14px; font-weight: 900; color: #10b981; text-transform: uppercase; text-align: right; }
        .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 12px; margin-bottom: 30px; }
        .label { font-size: 9px; font-weight: 950; text-transform: uppercase; color: #64748b; margin-bottom: 2px; letter-spacing: 0.05em; }
        .value { font-size: 12px; font-weight: 700; color: #0f172a; }
        .amount-box { color: white; padding: 20px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; background: #0f172a; }
        .amount-label { font-size: 11px; font-weight: 900; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.05em; }
        .amount-val { font-size: 20px; font-weight: 950; color: #10b981; }
        .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 50px; margin-top: 50px; }
        .sig-line { border-top: 1px solid #cbd5e1; margin-top: 40px; text-align: center; font-size: 9px; font-weight: 900; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.05em; }
      </style></head><body>
      <div class="header">
        <div class="logo">DentaCRM</div>
        <div class="title">${title}</div>
      </div>
      <div class="details-grid">
        <div>
          <div class="label">${langLabels.patient}</div>
          <div class="value">${payment.patient_name || '—'}</div>
        </div>
        <div>
          <div class="label">${langLabels.date}</div>
          <div class="value">${new Date(payment.date).toLocaleDateString(currentLang === 'uz' ? 'uz-UZ' : currentLang === 'ru' ? 'ru-RU' : 'en-US', { day: '2-digit', month: 'long', year: 'numeric' })} ${payment.date?.includes('T') ? new Date(payment.date).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }) : ''}</div>
        </div>
        <div>
          <div class="label">${langLabels.desc}</div>
          <div class="value">${payment.categoryClean || payment.category || '—'}</div>
        </div>
        <div>
          <div class="label">${langLabels.method}</div>
          <div class="value">${formatMethod(payment.method)}</div>
        </div>
      </div>
      <div class="amount-box">
        <span class="amount-label">${langLabels.amount}</span>
        <span class="amount-val">${payment.amount?.toLocaleString()} so'm</span>
      </div>
      <div class="signatures">
        <div>
          <div class="sig-line">${langLabels.cashier}</div>
        </div>
        <div>
          <div class="sig-line">${langLabels.patientSig}</div>
        </div>
      </div>
      </body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  // Calculate financial summaries
  const { income, expense, refund, debt, discount, netBalance } = useMemo(() => {
    const income = payments
      .filter(p => p.type?.toLowerCase() === 'income')
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    
    const expense = payments
      .filter(p => p.type?.toLowerCase() === 'expense')
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    
    const refund = payments
      .filter(p => p.type?.toLowerCase() === 'refund')
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    
    const debt = payments
      .filter(p => p.type?.toLowerCase() === 'debt')
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    
    const discount = payments
      .filter(p => p.type?.toLowerCase() === 'discount')
      .reduce((sum, p) => sum + Math.abs(Number(p.amount) || 0), 0); // Always treat as absolute reduction
    
    // Formula: Actual income - (Expense + Refund)
    const netBalance = income - expense - refund;
    
    return { income, expense, refund, debt, discount, netBalance };
  }, [payments]);

  // Sort payments by date (newest first)
  const sortedPayments = useMemo(() => {
    return [...payments].sort((a, b) => {
      const dateA = new Date(a.date || 0).getTime();
      const dateB = new Date(b.date || 0).getTime();
      return dateB - dateA;
    });
  }, [payments]);

  // Empty state
  if (payments.length === 0) {
    return (
      <EmptyState 
        icon={CreditCard} 
        title="To'lovlar yo'q" 
        description="Bu bemor uchun hali to'lovlar mavjud emas"
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Income */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <p className="text-sm text-emerald-600">Kirim</p>
          </div>
          <p className="text-xl font-bold text-emerald-700">
            {income.toLocaleString()} <span className="text-sm font-normal">so'm</span>
          </p>
        </div>

        {/* Expense */}
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-4 h-4 text-red-600" />
            <p className="text-sm text-red-600">Chiqim</p>
          </div>
          <p className="text-xl font-bold text-red-700">
            {expense.toLocaleString()} <span className="text-sm font-normal">so'm</span>
          </p>
        </div>

        {/* Debt */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <CreditCard className="w-4 h-4 text-amber-600" />
            <p className="text-sm text-amber-600">Qarz</p>
          </div>
          <p className="text-xl font-bold text-amber-700">
            {Math.max(0, (debt + refund) - (income + discount)).toLocaleString()} <span className="text-sm font-normal">so'm</span>
          </p>
        </div>

        {/* Net Balance */}
        <div className={`border rounded-2xl p-4 ${
          netBalance >= 0 
            ? 'bg-blue-50 border-blue-200' 
            : 'bg-purple-50 border-purple-200'
        }`}>
          <div className="flex items-center gap-2 mb-1">
            <Wallet className={`w-4 h-4 ${
              netBalance >= 0 ? 'text-blue-600' : 'text-purple-600'
            }`} />
            <p className={`text-sm ${
              netBalance >= 0 ? 'text-blue-600' : 'text-purple-600'
            }`}>
              Balans
            </p>
          </div>
          <p className={`text-xl font-bold ${
            netBalance >= 0 ? 'text-blue-700' : 'text-purple-700'
          }`}>
            {netBalance.toLocaleString()} <span className="text-sm font-normal">so'm</span>
          </p>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left text-xs font-medium text-muted-foreground uppercase px-5 py-3">
                  Sana
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase px-5 py-3">
                  Tur
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase px-5 py-3">
                  Summa
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase px-5 py-3 hidden sm:table-cell">
                  Usul
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase px-5 py-3 hidden md:table-cell">
                  Kategoriya
                </th>
                <th className="text-right text-xs font-medium text-muted-foreground uppercase px-5 py-3">
                  Chek
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedPayments.map((payment) => {
                const dt = new Date(payment.date);
                const formattedDate = !isNaN(dt) ? dt.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' }) : (payment.date || '—');
                const formattedTime = !isNaN(dt) && payment.date?.includes('T') ? dt.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }) : '';
                
                const CATEGORY_TRANSLATIONS = {
                  'treatment': 'Davolash',
                  'consultation': 'Konsultatsiya',
                  'implant': 'Implantatsiya',
                  'crown': 'Karonka',
                  'bridge': 'Ko\'prik',
                  'whitening': 'Oqartirish',
                  'orthodontics': 'Ortodontiya',
                  'surgery': 'Xirurgiya',
                  'x-ray': 'Rentgen',
                  'lab fee': 'Laboratoriya',
                  'material': 'Materiallar',
                  'materials': 'Materiallar',
                  'equipment': 'Jihozlar / Uskunalar',
                  'salary': 'Oylik',
                  'rent': 'Ijara',
                  'utilities': 'Kommunal',
                  'marketing': 'Marketing',
                  'esthetics': 'Estetika',
                  'hygiene': 'Gigiyena',
                  'other': 'Boshqa'
                };

                const formatCategory = (category) => {
                  if (!category) return '—';
                  
                  const prefixMatch = category.match(/^(Boshlang'ich to'lov:\s*|Reja yangilandi:\s*|Reja:\s*)/i);
                  const prefix = prefixMatch ? prefixMatch[0] : '';
                  const remaining = prefixMatch ? category.slice(prefixMatch[0].length) : category;
                  
                  const toothMatch = remaining.match(/\s*\(#\d+\)$/);
                  const toothSuffix = toothMatch ? toothMatch[0] : '';
                  
                  const baseName = toothMatch ? remaining.slice(0, toothMatch.index) : remaining;
                  
                  const parts = baseName.split(',').map(p => {
                    const trimmed = p.trim();
                    const cleanWord = trimmed.toLowerCase();
                    return CATEGORY_TRANSLATIONS[cleanWord] || trimmed;
                  }).filter(Boolean);
                  
                  let translatedBase = '';
                  if (parts.length <= 2) {
                    translatedBase = parts.join(', ');
                  } else {
                    translatedBase = parts.slice(0, 2).join(', ') + ` +${parts.length - 2} ta`;
                  }
                  
                  return prefix ? `${prefix.trim()}: ${translatedBase}${toothSuffix}` : translatedBase + toothSuffix;
                };

                // Clean category from patient name if present (e.g., "Name — Service" -> "Service")
                const categoryClean = payment.category?.includes(' — ') 
                  ? formatCategory(payment.category.split(' — ')[1]) 
                  : formatCategory(payment.category);

                return (
                  <tr 
                    key={payment.id} 
                    className="border-b border-border last:border-0 hover:bg-accent/30 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <p className="text-[13px] font-bold text-slate-700">{formattedDate}</p>
                      {formattedTime && <p className="text-[9px] font-black text-slate-400 mt-0.5 uppercase tracking-tighter">{formattedTime}</p>}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={payment.type} />
                      {categoryClean && (
                        <div className="text-[11px] font-bold text-slate-500 mt-1.5 md:hidden">
                          {categoryClean}
                        </div>
                      )}
                    </td>
                    <td className={`px-5 py-3 text-sm font-black ${
                      payment.type === 'Income' ? 'text-emerald-600' :
                      payment.type === 'Discount' ? 'text-purple-600' :
                      payment.type === 'Expense' || payment.type === 'Refund' ? 'text-red-600' :
                      'text-amber-600'
                    }`}>
                      {payment.amount?.toLocaleString()} so'm
                    </td>
                    <td className="px-5 py-3 text-sm hidden sm:table-cell">
                      {payment.method || '—'}
                    </td>
                    <td className="px-5 py-3 text-sm hidden md:table-cell">
                      <div className="font-bold text-slate-700">{categoryClean || '—'}</div>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {payment.type === 'Income' || payment.type === 'Refund' ? (
                        <button
                          type="button"
                          onClick={() => handlePrintPaymentReceipt({ ...payment, categoryClean })}
                          className="p-1.5 hover:bg-slate-100 hover:text-slate-900 text-slate-400 rounded-xl transition-all border-none bg-transparent cursor-pointer inline-flex items-center justify-center active:scale-90"
                          title="Kvitansiya chop etish"
                        >
                          <Printer className="w-4 h-4 text-emerald-600" />
                        </button>
                      ) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {/* Summary footer */}
        <div className="px-5 py-2 bg-muted/30 border-t border-border text-xs text-muted-foreground">
          Jami: {payments.length} ta tranzaksiya
        </div>
      </div>
    </div>
  );
}

export default memo(PatientPayments);
