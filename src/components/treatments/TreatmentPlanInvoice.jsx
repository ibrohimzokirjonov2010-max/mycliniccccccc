import { useMemo } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, Download, CheckCircle2, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/utils';
import { useTranslation } from '@/i18n/LanguageContext';

export default function TreatmentPlanInvoice({ open, onClose, plan }) {
  const { t } = useTranslation();

  // Flatten the plan services list
  const flatServices = useMemo(() => {
    if (!plan) return [];
    return (plan.services || []).flatMap((item, idx) => {
      const items = item.items || [item];
      return items.map(s => {
        const rawToothId = item.tooth_id || item.tooth || s.tooth_id || s.tooth || 'general';
        const isGeneral = !rawToothId || rawToothId === 'general' || rawToothId === 'Umumiy';
        // Xizmat nomidan '#general' prefiksini olib tashlash
        const rawName = s.service_name || '';
        const cleanName = rawName.replace(/^#general/i, '').trim();
        return {
          ...s,
          service_name: cleanName || rawName,
          tooth_id: isGeneral ? null : rawToothId,
          parent_idx: idx
        };
      });
    });
  }, [plan?.services]);

  const getDocumentTitle = () => {
    const isPaid = (plan.paid_amount || 0) > 0;
    const titles = {
      uz: isPaid ? "To'lov Kvitansiyasi (Chek)" : "Davolash Rejasi Smetasi",
      ru: isPaid ? "Платежная квитанция (Чек)" : "Смета плана лечения",
      en: isPaid ? "Payment Receipt" : "Treatment Plan Estimate"
    };
    const currentLang = localStorage.getItem('app_language') || 'uz';
    return titles[currentLang] || titles['uz'];
  };

  if (!plan) return null;

  // plan.total_price = ALLAQACHON chegirmali summa (e.g., 4,179,000)
  // plan.discount_amount = chegirma miqdori (e.g., 1,791,000)
  // Asl (chegirmasiz) summa = total_price + discount_amount
  const savedDiscountAmount = Number(plan.discount_amount) || 0;
  const discountPercent = Number(plan.discount_percent) || 0;
  const subtotal = (plan.total_price || 0) + savedDiscountAmount; // Asl narx (chegirmasiz)
  const activeDiscountAmount = savedDiscountAmount;               // Chegirma miqdori
  const finalTotal = plan.total_price || 0;                       // Chegirmali yakuniy summa
  const paid = Number(plan.paid_amount) || 0;
  const remaining = Math.max(0, finalTotal - paid);

  const handlePrint = () => { window.print(); };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[94vw] sm:max-w-xl max-h-[95vh] p-0 border-none rounded-[2rem] bg-slate-50 overflow-hidden outline-none shadow-4xl flex flex-col no-scrollbar">
        <div className="flex flex-col h-full overflow-hidden">
          
          {/* Header UI (sticky, no-print) */}
          <div className="bg-white px-5 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] pb-3 shrink-0 z-20 border-b border-slate-100 flex items-center justify-between no-print">
             <div className="flex items-center gap-2.5">
               <button onClick={onClose} className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-500 active:scale-90 transition-all border-none">
                 <ArrowLeft className="w-4 h-4" />
               </button>
               <h1 className="text-sm font-black text-slate-900 tracking-tight uppercase">{getDocumentTitle()}</h1>
             </div>
             <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest">DentaCRM</div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar pb-24">
             
             {/* The Premium Receipt Container */}
             <div id="standalone-invoice-receipt" className="bg-white rounded-[2rem] border border-slate-100 shadow-xl overflow-hidden relative">
                
                {/* Print Styles */}
                {open && (
                  <style dangerouslySetInnerHTML={{__html:`
                    @media print {
                      .no-print { display: none !important; }
                      #root { display: none !important; }
                      body { visibility: hidden !important; background: white !important; margin: 0 !important; padding: 0 !important; }
                      [data-radix-portal], [data-radix-portal] * { visibility: hidden !important; }
                      
                      #standalone-invoice-receipt { 
                        visibility: visible !important; 
                        display: block !important;
                        position: absolute !important; 
                        left: 0 !important; 
                        top: 0 !important; 
                        width: 100% !important; 
                        height: auto !important;
                        margin: 0 !important;
                        padding: 15mm !important;
                        box-shadow: none !important;
                        border: none !important;
                        overflow: visible !important;
                        border-radius: 0 !important;
                      }
                      
                      #standalone-invoice-receipt * { 
                        visibility: visible !important; 
                        overflow: visible !important;
                        display: inherit !important;
                      }

                      div[role="dialog"], 
                      div.flex-1, 
                      div.overflow-y-auto,
                      [data-radix-portal],
                      [data-radix-portal] > div {
                        visibility: visible !important;
                        display: block !important;
                        position: static !important;
                        width: 100% !important;
                        height: auto !important;
                        overflow: visible !important;
                        background: transparent !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        border: none !important;
                        box-shadow: none !important;
                      }
                      
                      div[role="dialog"] {
                        max-width: none !important;
                        max-height: none !important;
                        transform: none !important;
                      }
                    }
                  `}} />
                )}
                
                {/* ── PREMIUM HEADER ── */}
                <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-5 py-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                        {/* Clinic branding */}
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shadow-lg">
                                <span className="text-white font-black text-lg leading-none">D</span>
                            </div>
                            <div>
                                <h2 className="text-base font-black text-white tracking-tight uppercase leading-none">DentaCRM</h2>
                                <p className="text-[8px] font-medium text-white/50 mt-0.5">Professional Dental System</p>
                                <p className="text-[8px] font-bold text-white/30 uppercase mt-0.5">+998 71 123 45 67</p>
                            </div>
                        </div>
                        {/* Invoice metadata */}
                        <div className="bg-white/10 border border-white/15 rounded-xl px-3 py-2 text-right min-w-[130px]">
                            <p className="text-[7px] font-black text-white/40 uppercase tracking-widest mb-0.5">Hujjat turi</p>
                            <p className="text-[10px] font-black text-white uppercase leading-none">{getDocumentTitle()}</p>
                            <div className="h-px bg-white/10 my-1.5" />
                            <p className="text-[8px] text-white/40 font-medium leading-none">
                                {format(new Date(), 'yyyy-MM-dd')}
                            </p>
                            <p className="text-[8px] font-black text-white/70 mt-1 leading-none">
                                No. {plan.id ? plan.id.split('-').pop()?.toUpperCase() : 'NEW'}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="p-5 space-y-4">
                    {/* ── PATIENT INFO ── */}
                    <div className="grid grid-cols-3 gap-3 bg-slate-50 rounded-xl border border-slate-100 px-4 py-2.5">
                        <div>
                            <p className="text-[7px] font-black text-slate-400 uppercase tracking-wider mb-0.5">To'liq ismi</p>
                            <p className="text-[11px] font-black text-slate-900 uppercase truncate leading-tight">{plan.patient_name}</p>
                        </div>
                        <div>
                            <p className="text-[7px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Qabul vaqti</p>
                            <p className="text-[10px] font-black text-slate-800 leading-tight">
                                {format(new Date(), 'yyyy-MM-dd HH:mm')}
                            </p>
                        </div>
                        <div>
                            <p className="text-[7px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Muolaja turi</p>
                            <p className="text-[10px] font-black text-slate-800 leading-tight">Davolash rejasi</p>
                        </div>
                    </div>

                    {/* ── SERVICES TABLE ── */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5 px-1">
                            <h4 className="text-[8px] font-black text-blue-500 uppercase tracking-widest">Davolashlar ro'yxati</h4>
                            <span className="text-[8px] text-slate-400 font-bold">{flatServices.length} ta xizmat</span>
                        </div>
                        
                        {/* Table header */}
                        <div className="grid grid-cols-[auto_1fr_auto] gap-3 px-3 py-1.5 bg-slate-900 rounded-t-xl">
                            <span className="text-[7px] font-black text-white/40 uppercase tracking-widest">Tish</span>
                            <span className="text-[7px] font-black text-white/40 uppercase tracking-widest">Xizmat nomi</span>
                            <span className="text-[7px] font-black text-white/40 uppercase tracking-widest text-right">Narxi</span>
                        </div>
                        
                        {/* Table rows */}
                        <div className="border border-t-0 border-slate-100 rounded-b-xl overflow-hidden divide-y divide-slate-50">
                            {flatServices.map((s, i) => (
                                <div key={i} className="grid grid-cols-[auto_1fr_auto] gap-3 items-center px-3 py-2 bg-white hover:bg-slate-50/50 transition-colors">
                                    <div className="w-6 h-6 rounded-md bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                                        <span className="text-[8px] font-black text-blue-600">
                                            {s.tooth_id ? `#${s.tooth_id}` : '—'}
                                        </span>
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-800 uppercase tracking-tight truncate mr-2">{s.service_name}</span>
                                    <span className="text-[10px] font-black text-slate-900 text-right whitespace-nowrap">
                                        {formatCurrency(s.price || 0)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ── INSTALLMENT SCHEDULE ── */}
                    {plan.installment_plan && (
                        <div className="border border-blue-100 rounded-xl overflow-hidden">
                           <div className="bg-blue-50 px-3 py-2 flex items-center gap-2">
                              <span className="text-[8px] font-black text-blue-800 uppercase tracking-wider">MUDDATLI TO'LOV GRAFIGI</span>
                           </div>
                           <table className="w-full text-left">
                              <thead>
                                 <tr className="bg-blue-50/20 border-b border-blue-100">
                                    <th className="px-3 py-1.5 text-[8px] font-bold text-blue-600 uppercase">Sana</th>
                                    <th className="px-3 py-1.5 text-[8px] font-bold text-blue-600 uppercase text-right">Summa</th>
                                 </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                 {Array.from({ length: plan.installment_plan.months }).map((_, idx) => {
                                    const d = new Date(plan.installment_plan.start_date || plan.created_date);
                                    d.setMonth(d.getMonth() + idx);
                                    return (
                                       <tr key={idx} className="bg-white">
                                          <td className="px-3 py-1.5 text-[9px] text-slate-500 font-medium">
                                             {d.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'long', year: 'numeric' })}
                                          </td>
                                          <td className="px-3 py-1.5 text-[9px] font-black text-slate-900 text-right">
                                             {Math.round(plan.installment_plan.monthly_amount).toLocaleString()} <span className="text-[8px] opacity-40">so'm</span>
                                          </td>
                                       </tr>
                                    );
                                 })}
                              </tbody>
                           </table>
                        </div>
                    )}

                    {/* ── TOTALS BLOCK ── */}
                    <div className="bg-slate-900 rounded-2xl p-5 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-36 h-36 bg-blue-500 rounded-full blur-[60px] opacity-10 -mr-12 -mt-12 pointer-events-none" />
                        <div className="relative z-10 space-y-3">
                            {/* Subtotal */}
                            <div className="flex justify-between items-center pb-2 border-b border-white/10">
                                <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Jami summa</p>
                                <p className="text-xs font-black text-white">{formatCurrency(subtotal)}</p>
                            </div>
                            
                            {/* Discount */}
                            {activeDiscountAmount > 0 && (
                                <div className="flex justify-between items-center pb-2 border-b border-white/10">
                                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest font-black text-rose-300">
                                        Chegirma {discountPercent > 0 ? `(${discountPercent}%)` : (plan.discount_percent ? `(${plan.discount_percent}%)` : '')}
                                    </p>
                                    <p className="text-xs font-black text-rose-400">− {formatCurrency(activeDiscountAmount)}</p>
                                </div>
                            )}

                            {/* Paid Amount */}
                            {paid > 0 && (
                                <div className="flex justify-between items-center pb-2 border-b border-white/10">
                                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest font-black text-emerald-300">To'langan summa</p>
                                    <p className="text-xs font-black text-emerald-400">{formatCurrency(paid)}</p>
                                </div>
                            )}

                            {/* Final total / Remaining Balance */}
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 pt-2">
                                <div className="space-y-1">
                                    <p className="text-[9px] font-black text-blue-400 uppercase tracking-[0.2em] block">
                                        {paid > 0 ? "Qolgan qarz" : "To'lov uchun jami"}
                                    </p>
                                    <h3 className="text-2xl font-[950] text-white tracking-tighter tabular-nums leading-tight">
                                        {formatCurrency(paid > 0 ? remaining : finalTotal)}
                                    </h3>
                                </div>
                                <div className="px-3 py-1.5 bg-emerald-500/15 border border-emerald-500/25 rounded-lg flex items-center gap-1.5 self-start sm:self-auto">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">
                                        {remaining === 0 && paid > 0 ? "TO'LANDI" : "TASDIQLANDI"}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── TELEGRAM BLOCK ── */}
                    <div className="bg-blue-50 border border-blue-100/60 rounded-xl p-3 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-white rounded-xl border border-blue-100 flex items-center justify-center shadow-sm shrink-0">
                                <MessageCircle className="w-4 h-4 text-blue-500" />
                            </div>
                            <div>
                                <h5 className="text-[9px] font-black text-blue-900 uppercase tracking-wide">Telegram Eslatmalar</h5>
                                <p className="text-[8px] font-medium text-blue-400 mt-0.5">QR-kod orqali botga ulanish mumkin</p>
                            </div>
                        </div>
                        <div className="w-11 h-11 bg-white p-1 rounded-lg border border-blue-100 shrink-0">
                            <div className="w-full h-full bg-slate-100 rounded-sm" />
                        </div>
                    </div>

                    {/* ── SIGNATURES ── */}
                    <div className="grid grid-cols-2 gap-10 pt-5 mt-2 border-t border-dashed border-slate-200">
                        <div className="text-center">
                            <div className="h-8 mb-1.5" />
                            <div className="h-px bg-slate-300 border-0" />
                            <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mt-1">Shifokor imzosi</p>
                        </div>
                        <div className="text-center">
                            <div className="h-8 mb-1.5" />
                            <div className="h-px bg-slate-300 border-0" />
                            <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mt-1">Bemor imzosi</p>
                        </div>
                    </div>
                </div>
             </div>
          </div>

          {/* Bottom Actions Footer (no-print) */}
          <div className="bg-white p-5 shrink-0 border-t border-slate-100 flex flex-col gap-3 no-print">
             <div className="grid grid-cols-2 gap-3">
                <Button onClick={handlePrint} className="h-12 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10 border-none transition-all active:scale-[0.98]">
                  <Download className="w-4 h-4" /> Saqlash
                </Button>
                <Button onClick={handlePrint} className="h-12 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-blue-500/10 border-none transition-all active:scale-[0.98]">
                   <Printer className="w-4 h-4" /> Chop etish
                </Button>
             </div>
             <Button onClick={onClose} className="w-full h-13 bg-slate-900 hover:bg-slate-950 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-slate-900/10 active:scale-[0.98] transition-all border-none">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Yakunlash
             </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ArrowLeft(props) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </svg>
  );
}
