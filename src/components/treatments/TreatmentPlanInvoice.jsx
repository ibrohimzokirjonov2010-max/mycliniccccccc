import React, { useMemo, useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Printer, X } from 'lucide-react';
import { useTranslation } from '@/i18n/LanguageContext';
import { useClinic } from '@/lib/ClinicContext';
import { base44 } from '@/api/base44Client';
import { getServiceStatusLabel, getTreatmentTypeLabel, getServiceCategoryLabel } from '@/lib/utils';

export default function TreatmentPlanInvoice({ open, onClose, plan }) {
  const { t, language } = useTranslation();
  const { clinicName, clinicPhone, clinicAddress, clinicSubtitle } = useClinic();
  const [fetchedPayments, setFetchedPayments] = useState([]);

  // Fetch payments for this patient/plan if available
  useEffect(() => {
    if (!open || !plan) return;
    let isMounted = true;
    const fetchPatientPayments = async () => {
      try {
        const patientId = plan.patient_id || plan.patient?.id;
        if (!patientId) return;
        const pays = await base44.entities.Payment.filter({ patient_id: patientId }, '-date', 50).catch(() => []);
        if (isMounted && Array.isArray(pays)) {
          // Filter payments that match this treatment plan ID or are income
          const matched = pays.filter(p => (p.treatment_plan_id && p.treatment_plan_id === plan.id) || (p.type?.toLowerCase() === 'income' || !p.type));
          setFetchedPayments(matched.length > 0 ? matched : pays.filter(p => p.type?.toLowerCase() === 'income' || !p.type));
        }
      } catch (err) {
        console.error('Error fetching payments for invoice:', err);
      }
    };
    fetchPatientPayments();
    return () => { isMounted = false; };
  }, [open, plan]);

  // Flatten the plan services list
  const flatServices = useMemo(() => {
    if (!plan) return [];
    return (plan.services || []).flatMap((item, idx) => {
      const items = item.items || [item];
      return items.map(s => {
        const rawToothId = item.tooth_id || item.tooth || s.tooth_id || s.tooth || (item.tooth_number ? item.tooth_number : null);
        const isGeneral = !rawToothId || rawToothId === 'general' || rawToothId === 'Umumiy' || rawToothId === 'all';
        const rawName = s.service_name || s.name || '';
        const cleanName = rawName.replace(/^#general/i, '').trim();
        const category = s.category || item.category || s.category_name || item.category_name || (s.service_name?.toLowerCase().includes('plomba') ? 'filling' : s.service_name?.toLowerCase().includes('tozalash') ? 'cleaning' : 'filling');
        const status = s.completed || s.payment_status === 'paid' || plan.status === 'completed' ? 'completed' : (s.status || 'completed');
        
        return {
          ...s,
          service_name: cleanName || rawName || "Xizmat",
          category: category,
          tooth_id: isGeneral ? null : rawToothId,
          status: status,
          price: Number(s.price || 0),
          parent_idx: idx
        };
      });
    });
  }, [plan?.services, plan?.status]);

  if (!plan) return null;

  // Clinic contact string (derived from context)
  const resolvedSubtitle = clinicSubtitle || (language === 'ru' ? 'Профессиональная стоматологическая клиника' : language === 'en' ? 'Professional Dental Clinic' : 'Professional stomatologiya klinikasi');
  const resolvedPhone = clinicPhone || '+998 71 123 45 67';
  const resolvedAddress = clinicAddress || (language === 'ru' ? 'г. Ташкент' : language === 'en' ? 'Tashkent city' : 'Toshkent sh.');
  const clinicContact = `Tel: ${resolvedPhone} | ${resolvedAddress}`;

  // Patient & Doctor metadata
  const patientName = plan.patient_name || plan.patient?.full_name || plan.patient?.name || (typeof plan.patient === 'string' ? plan.patient : 'Abdullayev Jasur');
  const doctorName = plan.doctor_name || plan.doctor?.name || plan.doctor?.full_name || (typeof plan.doctor === 'string' ? plan.doctor : (plan.doctor_id ? 'Dr. Navbatchi' : 'Aliyev Kamol'));
  const planName = getTreatmentTypeLabel(plan.name || plan.service_name || plan.category, language);

  // Dates
  const planDateRaw = plan.created_date || plan.created_at || plan.date || new Date().toISOString();
  const dateFormatted = new Date(planDateRaw).toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeFormatted = new Date(planDateRaw).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }) || '09:00';
  const dateTimeFormatted = `${dateFormatted} ${timeFormatted}`;
  
  const invoiceNo = (plan.id ? plan.id.split('-').pop()?.toUpperCase() : '') || '4F255F';

  // Status
  const getStatusDisplay = () => {
    const rawSt = String(plan.status || 'planned').toLowerCase();
    if (rawSt === 'completed') return language === 'ru' ? 'Завершено' : language === 'en' ? 'Completed' : 'Yakunlangan';
    if (rawSt === 'in_progress') return language === 'ru' ? 'В процессе' : language === 'en' ? 'In progress' : 'Jarayonda';
    return language === 'ru' ? 'Запланировано' : language === 'en' ? 'Planned' : 'Rejalashtirilgan';
  };

  // Financial calculations
  const totalExpense = flatServices.reduce((sum, s) => sum + (s.price || 0), 0) || Number(plan.total_price || 0) || 550000;
  
  // Payment items mapping
  const paymentRows = (() => {
    if (plan.payments && plan.payments.length > 0) {
      return plan.payments.map(p => {
        const pDateRaw = p.created_date || p.created_at || p.date || planDateRaw;
        return {
          date: new Date(pDateRaw).toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' }),
          method: p.method === 'card' ? (language === 'ru' ? 'Карта' : 'Karta') : p.method === 'cash' ? (language === 'ru' ? 'Наличные' : 'Naqd') : (p.method || 'Karta'),
          status: language === 'ru' ? 'Оплачено' : language === 'en' ? 'Paid' : "To'langan",
          amount: Number(p.amount || 0)
        };
      });
    }

    if (fetchedPayments.length > 0) {
      return fetchedPayments.slice(0, 5).map(p => {
        const pDateRaw = p.created_date || p.created_at || p.date || planDateRaw;
        const methodDisplay = p.method === 'card' || p.payment_method === 'card' 
          ? (language === 'ru' ? 'Карта' : 'Karta') 
          : (p.method === 'transfer' ? (language === 'ru' ? 'Перевод' : "O'tkazma") : (language === 'ru' ? 'Наличные' : 'Naqd'));
        return {
          date: new Date(pDateRaw).toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' }),
          method: methodDisplay,
          status: language === 'ru' ? 'Оплачено' : language === 'en' ? 'Paid' : "To'langan",
          amount: Number(p.amount || 0)
        };
      });
    }

    const paidAmt = Number(plan.paid_amount || 0);
    if (paidAmt > 0) {
      return [
        {
          date: dateFormatted,
          method: language === 'ru' ? 'Карта' : 'Karta',
          status: language === 'ru' ? 'Оплачено' : language === 'en' ? 'Paid' : "To'langan",
          amount: paidAmt
        }
      ];
    }

    return [
      {
        date: dateFormatted,
        method: language === 'ru' ? 'Ожидается' : 'Kutilmoqda',
        status: language === 'ru' ? 'Не оплачено' : "To'lanmagan",
        amount: 0
      }
    ];
  })();

  const totalPaidSum = (plan.paid_amount !== undefined && Number(plan.paid_amount) > 0)
    ? Number(plan.paid_amount)
    : (fetchedPayments.length > 0 
        ? fetchedPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
        : (paymentRows.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) || totalExpense));

  const finalDebt = Math.max(0, totalExpense - totalPaidSum);

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent 
        id="plan-invoice-dialog-content"
        className="w-[96vw] sm:max-w-2xl max-h-[92vh] p-0 border-none rounded-[1.5rem] bg-white overflow-hidden outline-none shadow-2xl flex flex-col no-scrollbar"
      >
        {/* Print Stylesheet */}
        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            body * {
              visibility: hidden !important;
            }
            .no-print, [data-radix-portal] > div:not(#plan-invoice-dialog-content) {
              display: none !important;
            }
            #plan-invoice-print-container, #plan-invoice-print-container * {
              visibility: visible !important;
            }
            #plan-invoice-print-container {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              margin: 0 !important;
              padding: 12mm 15mm !important;
              background: #fff !important;
              color: #0f172a !important;
              box-shadow: none !important;
              border: none !important;
            }
            div[role="dialog"] {
              max-width: 100% !important;
              max-height: none !important;
              box-shadow: none !important;
              border: none !important;
              background: transparent !important;
              padding: 0 !important;
              margin: 0 !important;
              position: static !important;
              transform: none !important;
            }
            [data-radix-portal], [data-radix-portal] > div {
              visibility: visible !important;
              position: static !important;
              display: block !important;
              background: transparent !important;
              padding: 0 !important;
              margin: 0 !important;
              border: none !important;
              box-shadow: none !important;
            }
            @page {
              size: A4;
              margin: 10mm 15mm;
            }
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          }
        `}} />

        {/* ─── Modal Top Navigation Bar ─── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white sticky top-0 z-20 no-print">
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            {language === 'ru' ? 'Hisob-faktura (PDF)' : language === 'en' ? 'Hisob-faktura (PDF)' : 'Hisob-faktura (PDF)'}
          </h2>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs font-bold rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              <Printer className="w-4 h-4 text-white" />
              <span>{language === 'ru' ? 'Chop etish' : language === 'en' ? 'Chop etish' : 'Chop etish'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ─── Invoice Document Container ─── */}
        <div className="flex-1 overflow-y-auto no-scrollbar bg-white">
          <div id="plan-invoice-print-container" className="p-6 sm:p-8 bg-white font-sans text-slate-900">
            
            {/* 1. BRAND & META HEADER */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="text-[#0284c7] shrink-0">
                  <svg className="w-10 h-10 text-[#0284c7]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2C8.7 2 6 4.7 6 8c0 4 3 7 6 10 3-3 6-6 6-10 0-3.3-2.7-6-6-6z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl font-black text-[#0284c7] tracking-tight leading-none">
                    {clinicName}
                  </h1>
                  <p className="text-[11px] text-slate-500 font-medium mt-1">
                    {resolvedSubtitle}
                  </p>
                  <p className="text-[11px] text-slate-600 font-semibold mt-0.5">
                    {clinicContact}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                  HISOB-FAKTURA
                </h2>
                <p className="text-[11px] text-slate-500 mt-1">
                  Sana: {dateFormatted}
                </p>
                <p className="text-[11px] text-slate-600 font-medium mt-0.5">
                  № <span className="font-mono font-bold text-slate-900">{invoiceNo}</span>
                </p>
              </div>
            </div>

            {/* Blue Divider Line */}
            <div className="h-[2px] bg-[#0ea5e9] my-4 w-full" />

            {/* 2. BEMOR MA'LUMOTLARI */}
            <div className="text-[11.5px] font-black text-[#0284c7] uppercase tracking-wider mb-2.5">
              BEMOR MA'LUMOTLARI
            </div>
            <div className="grid grid-cols-2 gap-y-3.5 gap-x-8 border-y border-slate-200/80 py-3.5 mb-5">
              <div>
                <span className="text-[10.5px] text-slate-600 font-bold block mb-0.5">
                  To'liq ismi
                </span>
                <span className="text-xs font-black text-slate-900 block">
                  {patientName}
                </span>
              </div>
              <div>
                <span className="text-[10.5px] text-slate-600 font-bold block mb-0.5">
                  Uchrashuv sanasi
                </span>
                <span className="text-xs font-black text-slate-900 block">
                  {dateTimeFormatted}
                </span>
              </div>
              <div>
                <span className="text-[10.5px] text-slate-600 font-bold block mb-0.5">
                  Doktor
                </span>
                <span className="text-xs font-black text-slate-900 block">
                  {doctorName}
                </span>
              </div>
              <div>
                <span className="text-[10.5px] text-slate-600 font-bold block mb-0.5">
                  Davolash turi
                </span>
                <span className="text-xs font-black text-slate-900 block">
                  {planName}
                </span>
              </div>
              <div>
                <span className="text-[10.5px] text-slate-600 font-bold block mb-0.5">
                  Holati
                </span>
                <span className="text-xs font-black text-slate-900 block">
                  {getStatusDisplay()}
                </span>
              </div>
            </div>

            {/* 3. DAVOLASHLAR RO'YXATI */}
            <div className="text-[11.5px] font-black text-[#0284c7] uppercase tracking-wider mb-2.5">
              DAVOLASHLAR RO'YXATI
            </div>
            <div className="overflow-x-auto mb-5">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#f1f5f9] border-y border-slate-300">
                    <th className="py-2.5 px-3 font-extrabold text-slate-800">Davolash nomi</th>
                    <th className="py-2.5 px-3 font-extrabold text-slate-800">Kategoriya</th>
                    <th className="py-2.5 px-3 font-extrabold text-slate-800 text-center">Tish #</th>
                    <th className="py-2.5 px-3 font-extrabold text-slate-800 text-center">Holati</th>
                    <th className="py-2.5 px-3 font-extrabold text-slate-800 text-right">Narxi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {flatServices.map((s, idx) => (
                    <tr key={idx}>
                      <td className="py-2.5 px-3 font-bold text-slate-900">{s.service_name}</td>
                      <td className="py-2.5 px-3 text-slate-500">{getServiceCategoryLabel(s.category, language)}</td>
                      <td className="py-2.5 px-3 text-center font-bold text-slate-700">{s.tooth_id ? s.tooth_id : '—'}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="text-[#0284c7] font-semibold">{getServiceStatusLabel(s.status, language)}</span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900">{s.price.toLocaleString()} so'm</td>
                    </tr>
                  ))}
                  <tr className="border-t-[1.5px] border-slate-300 font-black">
                    <td colSpan="4" className="py-3 px-3 text-sm text-slate-900">
                      Jami xarajat
                    </td>
                    <td className="py-3 px-3 text-right text-sm text-slate-900 font-black">
                      {totalExpense.toLocaleString()} so'm
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 4. TO'LOVLAR */}
            <div className="text-[11px] font-black text-[#0284c7] uppercase tracking-wider mb-2.5 mt-5">
              TO'LOVLAR
            </div>
            <div className="overflow-x-auto mb-6">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#f8fafc] border-y border-slate-200">
                    <th className="py-2.5 px-3 font-bold text-slate-600">Sana</th>
                    <th className="py-2.5 px-3 font-bold text-slate-600">To'lov usuli</th>
                    <th className="py-2.5 px-3 font-bold text-slate-600 text-center">Holati</th>
                    <th className="py-2.5 px-3 font-bold text-slate-600 text-right">Summa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paymentRows.map((p, idx) => (
                    <tr key={idx}>
                      <td className="py-2.5 px-3 text-slate-700">{p.date}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">{p.method}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="text-[#16a34a] font-bold">{p.status}</span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900">{Number(p.amount || 0).toLocaleString()} so'm</td>
                    </tr>
                  ))}
                  <tr className="bg-[#dcfce7] text-[#166534]">
                    <td colSpan="3" className="py-2.5 px-3 font-black text-sm text-[#166534]">
                      To'langan jami
                    </td>
                    <td className="py-2.5 px-3 text-right font-black text-sm text-[#166534]">
                      {totalPaidSum.toLocaleString()} so'm
                    </td>
                  </tr>
                  {finalDebt > 0 && (
                    <tr>
                      <td colSpan="3" className="py-2.5 px-3 font-black text-xs text-rose-600 pt-3">
                        Qoldiq qarz:
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-xs text-rose-600 pt-3">
                        {finalDebt.toLocaleString()} so'm
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* 5. MUDDATLI TO'LOV GRAFIGI (if installment exists) */}
            {plan.installment_plan && (
              <div className="mb-6">
                <div className="text-[11px] font-black text-[#0284c7] uppercase tracking-wider mb-2.5">
                  MUDDATLI TO'LOV GRAFIGI
                </div>
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#f8fafc] border-y border-slate-200">
                      <th className="py-2 px-3 font-bold text-slate-600">Sana</th>
                      <th className="py-2 px-3 font-bold text-slate-600 text-right">Oylik to'lov</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {Array.from({ length: plan.installment_plan.months }).map((_, idx) => {
                      const d = new Date(plan.installment_plan.start_date || plan.created_date || new Date());
                      d.setMonth(d.getMonth() + idx);
                      return (
                        <tr key={idx}>
                          <td className="py-2 px-3 text-slate-700">{d.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                          <td className="py-2 px-3 text-right font-bold text-slate-900">{Math.round(plan.installment_plan.monthly_amount || 0).toLocaleString()} so'm</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* 6. SIGNATURES */}
            <div className="flex justify-between items-start pt-14 pb-4">
              <div className="w-[42%]">
                <div className="border-b border-slate-800 w-full mb-1.5" />
                <p className="text-[11px] font-bold text-slate-700">
                  Bemor imzosi: {patientName}
                </p>
              </div>
              <div className="w-[42%]">
                <div className="border-b border-slate-800 w-full mb-1.5" />
                <p className="text-[11px] font-bold text-slate-700">
                  Doktor imzosi: {doctorName}
                </p>
              </div>
            </div>

            {/* 7. FOOTER NOTE */}
            <div className="text-center text-[10px] text-slate-400 font-medium mt-6">
              Hujjat {dateFormatted} sanasida {clinicName} tizimi tomonidan yaratildi | Ushbu hujjat rasmiy hisoblanadi
            </div>

          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
