import { useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft, ChevronRight, CalendarDays, Folder, Clock, Check, Lock, Banknote,
  CreditCard, FileText, Upload, Loader2, Layers, Trash2, Stethoscope, Sparkles, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/*
 * Mobile "To'lov qilish" screen (phone only). Pure presentation: every value and
 * action comes from the host page, which keeps its own save / debt / plan logic.
 */

export const fmtSum = (n) => Math.round(Number(n) || 0).toLocaleString('ru-RU').replace(/,/g, ' ');

const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '?';

/**
 * Build the unpaid-service list from real plans.
 * A service is "paid" if it is explicitly marked payment_status === 'paid', or if the
 * plan's paid_amount (applied to services in their saved order) fully covers it.
 * The amount shown is what is still open for that service.
 */
export function deriveServices(plans = [], doctorsById = {}) {
  const rows = [];
  let totalCount = 0;
  let paidCount = 0;
  (plans || []).forEach((plan) => {
    const services = Array.isArray(plan.services) ? plan.services : [];
    const gross = services.reduce((s, x) => s + (Number(x.price) || 0), 0);
    const planTotal = Number(plan.total_price) || 0;
    // discount ratio: plan total is stored after discount
    const ratio = gross > 0 && planTotal > 0 && planTotal < gross ? planTotal / gross : 1;
    let paidLeft = Number(plan.paid_amount) || 0;
    const docName = plan.doctor_name || doctorsById[plan.doctor_id]?.name || doctorsById[plan.doctor_id]?.full_name || '';
    services.forEach((svc, idx) => {
      totalCount += 1;
      const due = Math.round((Number(svc.price) || 0) * ratio);
      if (svc.payment_status === 'paid') { paidCount += 1; return; }
      const covered = Math.min(paidLeft, due);
      paidLeft -= covered;
      const open = due - covered;
      if (open <= 0) { paidCount += 1; return; }
      rows.push({
        key: `${plan.id}::${idx}`,
        planId: plan.id,
        planName: plan.name || '',
        idx,
        name: (svc.service_name || svc.name || '—').replace(/^#general/i, '').trim(),
        tooth: svc.tooth_number || '',
        category: svc.category || '',
        doctor: docName,
        amount: open,
      });
    });
  });
  return { rows, totalCount, paidCount };
}

const SvcIcon = ({ name = '', category = '' }) => {
  const s = `${name} ${category}`.toLowerCase();
  const Icon = /implant/.test(s) ? Layers : /breket|ortodont/.test(s) ? Sparkles : /xirurg|olish|udal/.test(s) ? Stethoscope : null;
  return (
    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0 text-slate-500">
      {Icon ? <Icon className="w-5 h-5" strokeWidth={1.6} /> : (
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 3c-2.2 0-4 1.8-4 4.4 0 2 .9 3.2 1.4 4.6.6 1.7.7 3.4 1 5.2.3 2 1 3.8 2.2 3.8 1.5 0 1.4-3 2.2-5 .4-1 1-1.4 2.2-1.4s1.8.4 2.2 1.4c.8 2 .7 5 2.2 5 1.2 0 1.9-1.8 2.2-3.8.3-1.8.4-3.5 1-5.2.5-1.4 1.4-2.6 1.4-4.6C21 4.8 19.2 3 17 3c-1.9 0-2.9 1-5 1S8.9 3 7 3z" />
        </svg>
      )}
    </div>
  );
};

const Radio = ({ on }) => (
  <span className={cn('w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center shrink-0', on ? 'border-[#1d6fe0]' : 'border-slate-300 bg-white')}>
    {on && <span className="w-2.5 h-2.5 rounded-full bg-[#1d6fe0]" />}
  </span>
);

const ClickMark = () => (
  <span className="inline-flex items-center gap-1 font-black text-[19px] text-[#0b1f44] tracking-tight">
    <span className="w-5 h-5 rotate-45 rounded-[5px] bg-[#1d8ef0] inline-flex items-center justify-center"><span className="w-2 h-2 rounded-full bg-white" /></span>
    Click
  </span>
);
const PaymeMark = () => (
  <span className="inline-flex items-center font-black text-[19px] text-[#0b1f44] tracking-tight">Pay<span className="ml-0.5 px-1 rounded-md bg-[#3ac4d1] text-white text-[15px] leading-5">me</span></span>
);

export const PAY_METHODS = [
  { value: 'Click', label: 'Click', mark: ClickMark },
  { value: 'Payme', label: 'Payme', mark: PaymeMark },
  { value: 'Card', label: 'Karta', sub: 'Visa / Mastercard' },
  { value: 'Cash', label: 'Naqd pul' },
  { value: 'Transfer', label: "Bank o'tkazmasi" },
];

export default function MobilePayView({
  open, onClose,
  title = "To'lov qilish", subtitle = "Bemorning xizmatlari uchun to'lov",
  patient, patientPicker, onOpenProfile, onOpenPlans, onOpenCard, onOpenHistory, plansCount = 0,
  mode, onModeChange,
  plans = [], doctorsById = {},
  selectedKeys = [], onToggleService, onToggleAll,
  selectedPlanId = '', onSelectPlan, onOpenPlanDetail,
  amount, onAmountChange, debt = 0,
  method, onMethodChange,
  receiptUrl, receiptUploading, onReceiptPick, onReceiptClear, showReceipt = true,
  extra, error, onDismissError,
  saving, disabled, onSubmit, submitLabel,
}) {
  const fileRef = useRef(null);
  const { rows, totalCount, paidCount } = useMemo(() => deriveServices(plans, doctorsById), [plans, doctorsById]);
  const amt = Number(String(amount ?? '').replace(/\D/g, '')) || 0;
  const selectedRows = rows.filter((r) => selectedKeys.includes(r.key));
  const allOn = rows.length > 0 && selectedRows.length === rows.length;
  const remainingCount = Math.max(0, totalCount - paidCount - selectedRows.length);
  const doneCount = paidCount + selectedRows.length;
  const openPlans = (plans || []).filter((p) => Math.max(0, (Number(p.total_price) || 0) - (Number(p.paid_amount) || 0)) > 0);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[120] bg-[#f4f7f9] flex flex-col" data-testid="mobile-pay-view" role="dialog" aria-modal="true" aria-label={title}>
      {/* top bar */}
      <div className="shrink-0 px-4 pt-[max(10px,env(safe-area-inset-top))] pb-1 flex items-center justify-between">
        <button type="button" onClick={onClose} data-testid="mobile-pay-back"
          className="h-11 px-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm inline-flex items-center gap-2 text-[15px] font-semibold text-slate-800 active:scale-95">
          <ArrowLeft className="w-[18px] h-[18px]" /> Orqaga
        </button>
        <button type="button" onClick={onClose} aria-label="Yopish" className="w-11 h-11 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-600 active:scale-95">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 no-scrollbar" data-testid="mobile-pay-scroll">
        <h1 className="mt-2 text-[26px] leading-8 font-extrabold text-[#0b1f44] tracking-tight">{title}</h1>
        <p className="text-[13.5px] text-slate-500 mt-0.5">{subtitle}</p>

        {error ? (
          <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[12.5px] font-semibold text-rose-700 flex items-start gap-2" role="alert">
            <span className="flex-1">{error}</span>
            {onDismissError && <button type="button" onClick={onDismissError} className="text-rose-400">×</button>}
          </div>
        ) : null}

        {/* patient card */}
        <div className="mt-3 rounded-[20px] bg-white border border-slate-200/80 shadow-sm p-3.5">
          {patient ? (
            <>
              <button type="button" onClick={onOpenProfile} className="w-full flex items-center gap-3 text-left" data-testid="mobile-pay-patient">
                <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-[17px] font-bold text-slate-600 shrink-0">{initials(patient.full_name)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[17px] font-bold text-[#0b1f44] truncate">{patient.full_name}</p>
                  <p className="text-[14px] text-slate-500 truncate">{patient.phone || '—'}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-500 shrink-0" />
              </button>
              <div className="mt-3 grid grid-cols-[auto_auto_auto] justify-start gap-2 pl-[68px] max-[400px]:pl-0">
                <button type="button" onClick={onOpenPlans} className="h-9 px-3 rounded-xl bg-emerald-50 text-emerald-700 text-[13px] font-semibold inline-flex items-center gap-1.5">
                  <CalendarDays className="w-4 h-4" /> Rejalar <span className="ml-0.5 min-w-[20px] h-5 px-1 rounded-full bg-emerald-100 text-[11.5px] font-bold inline-flex items-center justify-center">{plansCount}</span>
                </button>
                <button type="button" onClick={onOpenCard} className="h-9 px-3 rounded-xl bg-slate-100 text-slate-700 text-[13px] font-semibold inline-flex items-center gap-1.5">
                  <Folder className="w-4 h-4" /> Klinik karta
                </button>
                <button type="button" onClick={onOpenHistory} className="h-9 px-3 rounded-xl bg-slate-100 text-slate-700 text-[13px] font-semibold inline-flex items-center gap-1.5">
                  <Clock className="w-4 h-4" /> Tarix
                </button>
              </div>
            </>
          ) : patientPicker}
        </div>
        {!patient && <div className="h-[300px]" aria-hidden="true" />}

        {patient && (
          <>
            {/* segmented */}
            <div className="mt-3 grid grid-cols-2 rounded-2xl bg-slate-200/70 p-0.5" data-testid="mobile-pay-mode">
              {[['services', "Xizmatlar bo'yicha"], ['plan', "Reja bo'yicha to'lov"]].map(([k, l]) => (
                <button key={k} type="button" onClick={() => onModeChange(k)}
                  className={cn('h-10 rounded-[14px] text-[13.5px] font-semibold transition-colors', mode === k ? 'bg-[#0b1f44] text-white shadow' : 'text-slate-600')}>
                  {l}
                </button>
              ))}
            </div>

            {mode === 'services' ? (
              <>
                <div className="mt-4 flex items-center justify-between px-1">
                  <h2 className="text-[16.5px] font-bold text-[#0b1f44]">To'lov qilinadigan xizmatlar</h2>
                  {rows.length > 0 && (
                    <button type="button" onClick={() => onToggleAll(rows)} className="inline-flex items-center gap-1.5 text-[13px] text-slate-700" data-testid="mobile-pay-select-all">
                      <span className={cn('w-[18px] h-[18px] rounded-[5px] border-2 flex items-center justify-center', allOn ? 'bg-[#14a39a] border-[#14a39a]' : 'border-slate-400 bg-white')}>{allOn && <Check className="w-3 h-3 text-white" strokeWidth={3.5} />}</span>
                      Barchasini tanlash
                    </button>
                  )}
                </div>
                <div className="mt-2 space-y-2" data-testid="mobile-pay-services">
                  {rows.length === 0 && (
                    <div className="rounded-2xl bg-white border border-slate-200 p-4 text-center text-[13px] text-slate-500">
                      To'lanmagan xizmatlar yo'q. Summani "Reja bo'yicha to'lov" bo'limida kiriting.
                    </div>
                  )}
                  {rows.map((r) => {
                    const on = selectedKeys.includes(r.key);
                    return (
                      <button key={r.key} type="button" onClick={() => onToggleService(r, rows)} data-svc-key={r.key}
                        className={cn('w-full rounded-2xl bg-white border px-3 py-3 flex items-center gap-3 text-left shadow-sm', on ? 'border-[#9fdcd6]' : 'border-slate-200')}>
                        <span className={cn('w-[22px] h-[22px] rounded-md border-2 flex items-center justify-center shrink-0', on ? 'bg-[#14a39a] border-[#14a39a]' : 'border-slate-300 bg-white')}>{on && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3.5} />}</span>
                        <SvcIcon name={r.name} category={r.category} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[14.5px] font-semibold text-[#0b1f44] truncate">{r.name}{r.tooth && /^\d+$/.test(String(r.tooth)) ? <span className="text-slate-400 font-medium"> · #{r.tooth}</span> : null}</p>
                          <p className="text-[12px] text-slate-500 truncate">{r.doctor ? `Stomatolog: ${r.doctor}` : r.planName}</p>
                        </div>
                        <span className={cn('text-[14.5px] font-bold whitespace-nowrap', on ? 'text-[#14a39a]' : 'text-[#0b1f44]')}>{fmtSum(r.amount)} so'm</span>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="mt-3 rounded-[20px] bg-white border border-slate-200 shadow-sm p-3.5" data-testid="mobile-pay-plan-mode">
                <label className="text-[12px] font-semibold text-slate-500">To'lov summasi</label>
                <div className="mt-1.5 h-14 rounded-2xl border border-slate-200 bg-slate-50 px-4 flex items-center gap-2 focus-within:border-[#14a39a] focus-within:ring-2 focus-within:ring-[#14a39a]/20">
                  <input type="text" inputMode="numeric" data-testid="mobile-pay-amount"
                    value={amt ? fmtSum(amt) : ''}
                    onChange={(e) => onAmountChange(e.target.value.replace(/\D/g, ''))}
                    placeholder="0" className="flex-1 min-w-0 bg-transparent text-[24px] font-extrabold text-[#0b1f44] outline-none placeholder-slate-300" />
                  <span className="text-[13px] font-semibold text-slate-400">so'm</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {debt > 0 && (
                    <button type="button" onClick={() => onAmountChange(String(Math.round(debt)))} data-testid="mobile-pay-full-debt"
                      className="h-8 px-3 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[12.5px] font-semibold">
                      Butun qarz · {fmtSum(debt)}
                    </button>
                  )}
                  {amt > 0 && (
                    <button type="button" onClick={() => onAmountChange('')} className="h-8 px-3 rounded-full bg-slate-100 text-slate-600 text-[12.5px] font-semibold inline-flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" /> Tozalash</button>
                  )}
                </div>
                {openPlans.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-[12px] font-semibold text-slate-500">Reja (ixtiyoriy)</p>
                    {openPlans.map((p) => {
                      const rem = Math.max(0, (Number(p.total_price) || 0) - (Number(p.paid_amount) || 0));
                      const on = String(selectedPlanId) === String(p.id);
                      return (
                        <button key={p.id} type="button" onClick={() => onSelectPlan(on ? '' : p.id)} data-plan-id={p.id}
                          className={cn('w-full rounded-2xl border px-3 py-2.5 flex items-center gap-3 text-left', on ? 'border-[#14a39a] bg-teal-50/50' : 'border-slate-200 bg-white')}>
                          <Radio on={on} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[13.5px] font-semibold text-[#0b1f44] truncate">{p.name || 'Davolash rejasi'}</p>
                            <p className="text-[11.5px] text-slate-500">Qoldiq: {fmtSum(rem)} so'm</p>
                          </div>
                          {on && (
                            <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); onAmountChange(String(Math.round(rem))); }}
                              className="h-7 px-2.5 rounded-full bg-teal-100 text-teal-800 text-[11.5px] font-semibold inline-flex items-center">Reja qoldig'i</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* plan progress */}
            {totalCount > 0 && (
              <div className="mt-3 rounded-[20px] bg-emerald-50/70 border border-emerald-100 p-3.5 flex items-center gap-3" data-testid="mobile-pay-progress">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center shrink-0"><CalendarDays className="w-6 h-6 text-emerald-700" /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[15px] font-bold text-[#0b1f44]">Davolash rejasi ({doneCount}/{totalCount})</p>
                    <button type="button" onClick={onOpenPlanDetail} className="text-[13px] font-semibold text-emerald-700 inline-flex items-center whitespace-nowrap">Reja tafsiloti <ChevronRight className="w-4 h-4" /></button>
                  </div>
                  <p className="text-[11.5px] text-slate-500 mt-0.5">{selectedRows.length} ta xizmat tanlangan · Qolgan: {remainingCount} ta</p>
                  <div className="mt-2 flex gap-1">
                    {Array.from({ length: Math.min(totalCount, 12) }).map((_, i) => {
                      const seg = totalCount <= 12 ? i : Math.floor((i * totalCount) / 12);
                      return <span key={i} className={cn('h-1.5 flex-1 rounded-full', seg < doneCount ? 'bg-emerald-500' : 'bg-slate-200')} />;
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* total */}
            <div className="mt-3 rounded-[20px] bg-white border border-slate-200 shadow-sm p-3.5 flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center shrink-0"><Banknote className="w-6 h-6 text-emerald-700" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-bold text-[#0b1f44]">Jami to'lov</p>
                <p className="text-[12px] text-slate-500">{mode === 'services' ? `${selectedRows.length} ta xizmat uchun` : (debt > 0 ? `Umumiy qarz: ${fmtSum(debt)} so'm` : "Qarz yo'q")}</p>
              </div>
              <p className="text-[22px] font-extrabold text-[#14a39a] whitespace-nowrap" data-testid="mobile-pay-total">{fmtSum(amt)} so'm</p>
            </div>

            {/* methods */}
            <h2 className="mt-4 px-1 text-[16.5px] font-bold text-[#0b1f44]">To'lov usulini tanlang</h2>
            <div className="mt-2 grid grid-cols-3 gap-2" data-testid="mobile-pay-methods">
              {PAY_METHODS.slice(0, 3).map((m) => {
                const on = method === m.value; const Mark = m.mark;
                return (
                  <button key={m.value} type="button" onClick={() => onMethodChange(m.value)} data-method={m.value}
                    className={cn('relative h-[74px] rounded-2xl border bg-white flex flex-col items-center justify-center gap-1 shadow-sm', on ? 'border-[#1d6fe0] bg-[#eef5ff] ring-1 ring-[#1d6fe0]' : 'border-slate-200')}>
                    <span className="absolute left-2 top-2"><Radio on={on} /></span>
                    {Mark ? <Mark /> : (
                      <span className="inline-flex items-center gap-1.5">
                        <CreditCard className="w-6 h-6 text-slate-600" />
                        <span className="text-[9px] font-black italic text-[#1a1f71]">VISA</span>
                        <span className="relative w-5 h-3"><span className="absolute left-0 w-3 h-3 rounded-full bg-[#eb001b]" /><span className="absolute left-2 w-3 h-3 rounded-full bg-[#f79e1b]/90" /></span>
                      </span>
                    )}
                    <span className="text-[12.5px] text-slate-700 font-medium leading-none">{m.label}</span>
                    {m.sub && <span className="text-[10px] text-slate-500 leading-none">{m.sub}</span>}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {PAY_METHODS.slice(3).map((m) => {
                const on = method === m.value;
                const Icon = m.value === 'Cash' ? Banknote : FileText;
                return (
                  <button key={m.value} type="button" onClick={() => onMethodChange(m.value)} data-method={m.value}
                    className={cn('h-14 rounded-2xl border bg-white flex items-center gap-2.5 px-3 shadow-sm', on ? 'border-[#1d6fe0] bg-[#eef5ff] ring-1 ring-[#1d6fe0]' : 'border-slate-200')}>
                    <Radio on={on} />
                    <Icon className="w-6 h-6 text-slate-600" strokeWidth={1.6} />
                    <span className="text-[14px] font-medium text-slate-800">{m.label}</span>
                  </button>
                );
              })}
            </div>

            {/* receipt */}
            {showReceipt && onReceiptPick && (
              <div className="mt-3 rounded-[20px] bg-emerald-50/70 border border-emerald-100 p-3.5 flex items-center gap-3" data-testid="mobile-pay-receipt">
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onReceiptPick(f); e.target.value = ''; }} />
                {receiptUrl ? (
                  <img src={receiptUrl} alt="Chek" className="w-12 h-12 rounded-xl object-cover border border-emerald-200 shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center shrink-0"><FileText className="w-6 h-6 text-emerald-700" /></div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-bold text-[#0b1f44]">{receiptUrl ? 'Chek biriktirildi ✓' : "To'lov cheki yuklash"}</p>
                  <p className="text-[11px] text-slate-500 leading-snug">Click yoki Payme to'lovidan keyin chek rasmini yuklang (ixtiyoriy)</p>
                </div>
                {receiptUrl && onReceiptClear ? (
                  <button type="button" onClick={onReceiptClear} className="h-10 px-3 rounded-xl border border-rose-200 bg-white text-rose-600 text-[12px] font-semibold shrink-0">O'chirish</button>
                ) : (
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={receiptUploading}
                    className="h-11 px-3 rounded-xl border border-dashed border-emerald-500 bg-white text-emerald-800 text-[12px] font-semibold inline-flex items-center gap-1.5 shrink-0">
                    {receiptUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Chek yuklash
                  </button>
                )}
              </div>
            )}

            {extra}
          </>
        )}
      </div>

      {/* bottom button */}
      <div className="shrink-0 px-4 pt-2 bg-[#f4f7f9]" style={{ paddingBottom: 'max(14px, env(safe-area-inset-bottom))' }}>
        <button type="button" onClick={onSubmit} disabled={disabled || saving} data-testid="mobile-pay-submit"
          className="w-full h-14 rounded-2xl text-white text-[16px] font-bold inline-flex items-center justify-center gap-2.5 shadow-lg disabled:opacity-50 active:scale-[0.99]"
          style={{ background: 'linear-gradient(180deg,#17a99f 0%,#0f8f86 100%)' }}>
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Lock className="w-[18px] h-[18px]" />}
          {submitLabel || `${fmtSum(amt)} so'm to'lash`}
        </button>
      </div>
    </div>,
    document.body,
  );
}
