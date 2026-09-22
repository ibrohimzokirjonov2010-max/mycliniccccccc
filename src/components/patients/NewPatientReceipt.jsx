import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Printer, Download, X } from 'lucide-react';
import './newPatientReceipt.css';

const FALLBACK_MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];

let receiptPrintTimer = 0;
let receiptPrintCleanup = null;

export function formatReceiptDate(date, t) {
  const months = t?.('common.months');
  const list = Array.isArray(months) && months.length >= 12 ? months : FALLBACK_MONTHS;
  return `${date.getDate()}-${list[date.getMonth()]}, ${date.getFullYear()}`;
}

export function monthName(date, t) {
  const months = t?.('common.months');
  const list = Array.isArray(months) && months.length >= 12 ? months : FALLBACK_MONTHS;
  return list[date.getMonth()];
}

/** Print only the portaled patient receipt. Does not run when the overlay opens. */
export function printNewPatientReceipt() {
  if (typeof window === 'undefined' || typeof window.print !== 'function') return false;
  const root = document.documentElement;
  if (receiptPrintCleanup) receiptPrintCleanup();
  const cleanup = () => {
    root.classList.remove('printing-new-patient-receipt');
    window.removeEventListener('afterprint', cleanup);
    if (receiptPrintTimer) {
      window.clearTimeout(receiptPrintTimer);
      receiptPrintTimer = 0;
    }
    receiptPrintCleanup = null;
  };
  receiptPrintCleanup = cleanup;
  root.classList.add('printing-new-patient-receipt');
  window.addEventListener('afterprint', cleanup);
  receiptPrintTimer = window.setTimeout(cleanup, 8000);
  window.print();
  return true;
}

export function NewPatientReceiptTeaser({
  patientName,
  dateLabel,
  receiptNo,
  rows = [],
  dueTotal = 0,
  currency,
  invoiceLabel,
  openLabel,
  totalLabel,
  onOpen,
}) {
  const preview = rows.slice(0, 3);
  const extra = rows.length - preview.length;

  return (
    <button
      type="button"
      data-testid="new-patient-receipt-teaser"
      onClick={onOpen}
      className="w-full text-left bg-white border border-slate-200 rounded-xl p-3 shadow-sm hover:border-emerald-300 hover:bg-emerald-50/30 transition-colors cursor-pointer"
    >
      <div className="flex flex-col gap-2 min-[400px]:flex-row min-[400px]:items-start min-[400px]:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold tracking-[0.14em] uppercase text-emerald-600">{invoiceLabel}</p>
          <p className="text-sm font-bold text-slate-900 truncate">{patientName || '—'}</p>
          <p className="text-[11px] text-slate-500 truncate">{dateLabel} · № {receiptNo}</p>
        </div>
        <div className="flex items-center justify-between gap-3 min-[400px]:flex-col min-[400px]:items-end shrink-0">
          <div className="text-left min-[400px]:text-right">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 leading-tight max-w-[11rem]">{totalLabel}</p>
            <p className="text-base font-black text-slate-900 tabular-nums leading-tight">
              {Number(dueTotal || 0).toLocaleString()}
              <span className="text-[11px] font-bold text-slate-500 ml-1">{currency}</span>
            </p>
          </div>
          <span className="inline-flex items-center h-7 px-2.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold whitespace-nowrap">
            {openLabel}
          </span>
        </div>
      </div>
      {preview.length > 0 && (
        <ul className="mt-2.5 pt-2 border-t border-slate-100 space-y-1">
          {preview.map((row) => (
            <li key={row.key} className="flex items-baseline justify-between gap-3 text-[12px]">
              <span className="min-w-0 truncate text-slate-700 font-medium">
                {row.name}
                {row.tooth ? <span className="text-slate-400 font-normal"> · {row.tooth}</span> : null}
              </span>
              <span className="shrink-0 font-bold tabular-nums text-slate-900">{Number(row.price || 0).toLocaleString()}</span>
            </li>
          ))}
          {extra > 0 && (
            <li className="text-[11px] font-semibold text-slate-400">+{extra}</li>
          )}
        </ul>
      )}
    </button>
  );
}

function ReceiptPaper({
  t,
  clinicInfo,
  patientName,
  dateLabel,
  timeLabel,
  receiptNo,
  rows,
  treatmentName,
  servicesTotal,
  discountAmount,
  discountPercent,
  advanceTotal,
  dueTotal,
  isInstallment,
  installmentMonths,
  installmentStartDate,
  installmentDay,
}) {
  const currency = t('common.currency');

  return (
    <div id="new-patient-receipt" className="bg-white">
      <div className="px-3 py-3 sm:px-4 flex flex-col sm:flex-row sm:items-start justify-between gap-2 border-b border-slate-100">
        <div className="flex items-start gap-2.5 min-w-0">
          {clinicInfo?.logo ? (
            <img src={clinicInfo.logo} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C8.7 2 6 4.7 6 8c0 4 3 7 6 10 3-3 6-6 6-10 0-3.3-2.7-6-6-6z" />
              </svg>
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight leading-tight">
              {clinicInfo?.name || 'DentaCRM'}
            </h1>
            <p className="text-[11px] text-slate-500 font-medium truncate">{clinicInfo?.description || t('clinic.description')}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Tel: {clinicInfo?.phone || '+998 71 123 45 67'} | {clinicInfo?.address || t('clinic.address')}
            </p>
          </div>
        </div>
        <div className="text-left sm:text-right shrink-0">
          <h3 className="text-[11px] sm:text-xs font-bold text-slate-800 uppercase tracking-widest">{t('patients.wizard.invoice')}</h3>
          <p className="text-[11px] text-slate-500 font-medium">{t('common.date')}: {dateLabel}</p>
          <p className="text-[11px] text-slate-400 font-medium">№ {receiptNo}</p>
        </div>
      </div>

      <div className="px-3 py-3 sm:px-4 border-b border-slate-100">
        <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-1.5">{t('implants.form.patientInfo')}</p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          <div className="min-w-0">
            <p className="text-[10px] text-slate-400 font-semibold uppercase">{t('patients.fullName')}</p>
            <p className="text-[13px] font-bold text-slate-800 truncate">{patientName}</p>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-slate-400 font-semibold uppercase">
              {t('patients.appointmentDate') && t('patients.appointmentDate') !== 'patients.appointmentDate' ? t('patients.appointmentDate') : t('appointments.date')}
            </p>
            <p className="text-[13px] font-bold text-slate-800">{dateLabel} {timeLabel}</p>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-slate-400 font-semibold uppercase">{t('implants.doctor')}</p>
            <p className="text-[13px] font-bold text-slate-800 truncate">{localStorage.getItem('user_name') || 'Demo Admin'}</p>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-slate-400 font-semibold uppercase">
              {t('patients.treatmentType') && t('patients.treatmentType') !== 'patients.treatmentType' ? t('patients.treatmentType') : t('patients.wizard.treatmentPlan')}
            </p>
            <p className="text-[13px] font-bold text-slate-800 truncate">{treatmentName}</p>
          </div>
        </div>
      </div>

      <div className="px-3 py-3 sm:px-4 bg-slate-50/70">
        <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-2">{t('patients.wizard.treatmentList')}</p>
        <div className="hidden sm:grid grid-cols-12 gap-2 mb-1 pb-1 border-b border-slate-200">
          <div className="col-span-8 text-[10px] font-bold text-slate-400 uppercase">{t('patients.wizard.treatmentName')}</div>
          <div className="col-span-4 text-[10px] font-bold text-slate-400 uppercase text-right">{t('common.total')}</div>
        </div>
        <div className="space-y-1.5 sm:space-y-0">
          {rows.map((row) => (
            <div key={row.key} className="bg-white sm:bg-transparent rounded-lg sm:rounded-none px-2.5 py-2 border border-slate-100 sm:border-0 sm:border-b sm:border-dashed sm:border-slate-200 sm:px-0 sm:py-1.5 grid grid-cols-1 sm:grid-cols-12 gap-1 sm:gap-2 items-center">
              <div className="sm:col-span-8 min-w-0">
                <p className="text-[13px] font-semibold text-slate-800 leading-snug">{row.name}</p>
                {row.tooth && (
                  <span className="inline-block mt-0.5 px-1.5 py-px bg-blue-50 text-blue-600 rounded text-[9px] font-bold uppercase">{row.tooth}</span>
                )}
              </div>
              <div className="sm:col-span-4 text-left sm:text-right">
                <p className="text-[13px] font-black text-slate-900 tabular-nums">
                  {Number(row.price || 0).toLocaleString()} <span className="text-[10px] text-slate-500 font-medium">{currency}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex flex-col items-stretch sm:items-end gap-1 pt-1">
          <div className="flex items-center justify-between w-full sm:w-64">
            <span className="text-[12px] text-slate-500 font-medium">{t('patients.wizard.services')}:</span>
            <span className="text-[13px] font-bold text-slate-800 tabular-nums">{Number(servicesTotal || 0).toLocaleString()} {currency}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex items-center justify-between w-full sm:w-64">
              <span className="text-[12px] text-rose-500 font-bold">
                {discountPercent > 0 ? `${t('patients.wizard.discount')} (${discountPercent}%):` : `${t('patients.wizard.discount')}:`}
              </span>
              <span className="text-[13px] font-black text-rose-500 tabular-nums">- {Number(discountAmount).toLocaleString()} {currency}</span>
            </div>
          )}
          {advanceTotal > 0 && (
            <div className="flex items-center justify-between w-full sm:w-64 border-b border-dashed border-slate-200 pb-1.5">
              <span className="text-[12px] text-emerald-600 font-bold">{t('patients.wizard.downPayment')}:</span>
              <span className="text-[13px] font-black text-emerald-600 tabular-nums">- {Number(advanceTotal).toLocaleString()} {currency}</span>
            </div>
          )}
        </div>
      </div>

      <div className="px-3 py-3 sm:px-4 border-t border-slate-100">
        <div className="receipt-total-bar bg-slate-900 rounded-xl px-3 py-3 sm:px-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('patients.wizard.totalDebt')}</p>
            <p className="text-[11px] text-yellow-400 font-semibold">{t('patients.wizard.paymentPending')}</p>
          </div>
          <div className="text-right">
            {discountAmount > 0 && (
              <p className="text-[11px] text-slate-400 line-through font-medium tabular-nums">{Number(servicesTotal || 0).toLocaleString()}</p>
            )}
            <p className="text-xl font-black text-white tabular-nums leading-none">
              {Number(dueTotal || 0).toLocaleString()}
              <span className="text-xs font-medium text-slate-400 ml-1">{currency}</span>
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="flex flex-col items-center">
            <div className="w-full border-b border-slate-300 mb-1 h-5" />
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">{t('patients.wizard.doctorSignature')}</p>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-full border-b border-slate-300 mb-1 h-5" />
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">{t('patients.wizard.patientSignature')}</p>
          </div>
        </div>
      </div>

      {isInstallment && (
        <div className="page-break px-3 py-3 sm:px-4 bg-white border-t border-slate-100">
          <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-100">
            <div className="min-w-0">
              <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">{t('patients.wizard.paymentSchedule')}</h4>
              <p className="text-[10px] text-slate-500 font-bold uppercase truncate">{patientName}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[9px] font-black text-slate-400 uppercase">№ {receiptNo}</p>
              <p className="text-[10px] font-bold text-slate-800">{dateLabel}</p>
            </div>
          </div>
          <div className="border border-blue-100 rounded-xl overflow-hidden">
            <div className="bg-blue-600 px-3 py-2">
              <span className="text-[10px] font-black text-white uppercase tracking-widest">{t('patients.wizard.installmentSchedule')}</span>
            </div>
            <div className="bg-blue-50/50 px-3 py-2.5 border-b border-blue-100 grid grid-cols-3 gap-2">
              <div>
                <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest">{t('common.total')}</p>
                <p className="text-[12px] font-black text-slate-800 tabular-nums">{Math.max(0, servicesTotal - discountAmount).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest">{t('patients.wizard.downPayment')}</p>
                <p className="text-[12px] font-black text-emerald-600 tabular-nums">{Number(advanceTotal || 0).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest">{t('patients.wizard.remainingDebt')}</p>
                <p className="text-[12px] font-black text-rose-600 tabular-nums">{Number(dueTotal || 0).toLocaleString()}</p>
              </div>
            </div>
            <table className="w-full text-left">
              <thead>
                <tr className="bg-blue-50/50 border-b border-blue-100">
                  <th className="px-3 py-1.5 text-[10px] font-bold text-blue-600 uppercase">{t('patients.wizard.stage')}</th>
                  <th className="px-3 py-1.5 text-[10px] font-bold text-blue-600 uppercase">{t('patients.wizard.date')}</th>
                  <th className="px-3 py-1.5 text-[10px] font-bold text-blue-600 uppercase text-right">{t('patients.wizard.amount')}</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const totalToPay = Math.max(0, servicesTotal - advanceTotal - discountAmount);
                  const standardMonthly = Math.floor(totalToPay / installmentMonths);
                  const remainder = totalToPay - (standardMonthly * installmentMonths);
                  return Array.from({ length: installmentMonths }).map((_, i) => {
                    const d = new Date(installmentStartDate);
                    d.setMonth(d.getMonth() + i);
                    const lastDayOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
                    d.setDate(Math.min(installmentDay || 15, lastDayOfMonth));
                    const monthly = (i === installmentMonths - 1) ? standardMonthly + remainder : standardMonthly;
                    return (
                      <tr key={i} className="border-b border-slate-50 last:border-0">
                        <td className="px-3 py-2 text-[11px] font-black text-slate-700">{t('patients.wizard.monthlyPayment', { month: i + 1 })}</td>
                        <td className="px-3 py-2 text-[11px] text-slate-500 font-medium">{d.getDate()}-{monthName(d, t)}, {d.getFullYear()}</td>
                        <td className="px-3 py-2 text-[11px] font-black text-slate-900 text-right tabular-nums">{monthly.toLocaleString()} {currency}</td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
            <div className="bg-slate-50 px-3 py-2 border-t border-slate-100">
              <p className="text-[10px] text-slate-400 font-bold">{t('patients.wizard.paymentWarning')}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="flex flex-col items-center">
              <div className="w-full border-b border-slate-300 mb-1 h-6" />
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">{t('patients.wizard.doctorSignature')}</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-full border-b border-slate-300 mb-1 h-6" />
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">{t('patients.wizard.patientSignature')}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function NewPatientReceiptOverlay({
  open,
  onClose,
  onDownload,
  t,
  ...paperProps
}) {
  useEffect(() => {
    if (!open) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="new-patient-receipt-overlay"
      data-testid="new-patient-receipt-overlay"
      data-new-patient-receipt="overlay-v1"
      role="dialog"
      aria-modal="true"
      aria-label={t('patients.wizard.invoice')}
      style={{ pointerEvents: 'auto', zIndex: 400 }}
      onClick={onClose}
    >
      <div
        className="new-patient-receipt-sheet"
        style={{ pointerEvents: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="new-patient-receipt-toolbar no-print" style={{ pointerEvents: 'auto', zIndex: 30 }}>
          <button type="button" data-testid="new-patient-receipt-close" style={{ pointerEvents: 'auto' }} onClick={onClose}>
            <X className="w-3.5 h-3.5" />
            {t('common.close')}
          </button>
          <button type="button" className="is-save" data-testid="new-patient-receipt-download" style={{ pointerEvents: 'auto' }} onClick={onDownload}>
            <Download className="w-3.5 h-3.5" />
            {t('common.save')}
          </button>
          <button type="button" className="is-print" data-testid="new-patient-receipt-print" style={{ pointerEvents: 'auto' }} onClick={() => printNewPatientReceipt()}>
            <Printer className="w-3.5 h-3.5" />
            {t('common.print')}
          </button>
        </div>
        <ReceiptPaper t={t} {...paperProps} />
      </div>
    </div>,
    document.body
  );
}
