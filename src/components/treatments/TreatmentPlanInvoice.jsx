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
        const pays = await base44.entities.Payment.filter({ patient_id: patientId }, '-date', 100).catch(() => []);
        if (isMounted && Array.isArray(pays)) {
          // Filter payments that match this treatment plan ID or have a note/category referencing this plan
          const matched = pays.filter(p => 
            p.type?.toLowerCase() !== 'debt' && 
            p.type?.toLowerCase() !== 'discount' && 
            (
              (p.treatment_plan_id && p.treatment_plan_id === plan.id) ||
              (plan.id && p.notes && p.notes.includes(plan.id)) ||
              (plan.id && p.category && p.category.includes(plan.id))
            )
          );
          setFetchedPayments(matched);
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
  const rawTotal = (() => {
    const sumServices = flatServices.reduce((sum, s) => sum + (Number(s.price) || 0), 0);
    if (sumServices > 0) return sumServices;
    if (plan.raw_total && Number(plan.raw_total) > 0) return Number(plan.raw_total);
    if (plan.discount_amount && Number(plan.discount_amount) > 0 && plan.total_price) {
      return Number(plan.total_price) + Number(plan.discount_amount);
    }
    return Number(plan.total_price || 0);
  })();

  const discountPercent = Number(plan.discount_percent) || (
    plan.discount_amount && rawTotal > 0
      ? Math.round((Number(plan.discount_amount) / rawTotal) * 100)
      : (rawTotal > Number(plan.total_price || 0) && rawTotal > 0 && plan.total_price
          ? Math.round(((rawTotal - Number(plan.total_price)) / rawTotal) * 100)
          : 0)
  );

  const discountAmount = Number(plan.discount_amount) || (
    rawTotal && discountPercent > 0
      ? Math.floor((rawTotal * discountPercent) / 100)
      : (rawTotal > Number(plan.total_price || 0) && plan.total_price ? rawTotal - Number(plan.total_price) : 0)
  );

  const discountedTotal = Number(plan.total_price) > 0
    ? Number(plan.total_price)
    : Math.max(0, rawTotal - discountAmount);

  const totalExpense = discountedTotal;
  
  // Explicitly calculate totalPaidSum
  const totalPaidSum = (() => {
    // 1. If explicit payments array on plan
    if (plan.payments && Array.isArray(plan.payments) && plan.payments.length > 0) {
      return plan.payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    }
    // 2. If fetched payments matched this plan
    if (fetchedPayments && fetchedPayments.length > 0) {
      return fetchedPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    }
    // 3. If plan.paid_amount is defined and numeric
    if (plan.paid_amount !== undefined && plan.paid_amount !== null && !isNaN(Number(plan.paid_amount))) {
      return Number(plan.paid_amount);
    }
    // 4. Default to 0
    return 0;
  })();

  const finalDebt = Math.max(0, discountedTotal - totalPaidSum);

  // Payment items mapping for table
  const paymentRows = (() => {
    if (plan.payments && Array.isArray(plan.payments) && plan.payments.length > 0) {
      return plan.payments.map(p => {
        const pDateRaw = p.created_date || p.created_at || p.date || planDateRaw;
        return {
          date: new Date(pDateRaw).toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' }),
          method: p.method === 'card' ? (language === 'ru' ? 'Карта' : 'Karta') : p.method === 'cash' ? (language === 'ru' ? 'Наличные' : 'Naqd') : (p.method || (language === 'ru' ? 'Карта' : 'Karta')),
          status: language === 'ru' ? 'Оплачено' : language === 'en' ? 'Paid' : "To'langan",
          amount: Number(p.amount || 0)
        };
      });
    }

    if (fetchedPayments && fetchedPayments.length > 0) {
      return fetchedPayments.slice(0, 10).map(p => {
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

    if (totalPaidSum > 0) {
      return [
        {
          date: dateFormatted,
          method: language === 'ru' ? 'Карта / Наличные' : 'Karta / Naqd',
          status: language === 'ru' ? 'Оплачено' : language === 'en' ? 'Paid' : "To'langan",
          amount: totalPaidSum
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
            table, tr, td, th {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
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
                  {/* 1. Davolash rejasining chegirmasiz narxi */}
                  <tr className="border-t-[1.5px] border-slate-300 bg-slate-50/70">
                    <td colSpan="4" className="py-2.5 px-3 text-xs font-bold text-slate-700">
                      {language === 'ru' ? 'Стоимость плана лечения без скидки' : language === 'en' ? 'Treatment plan price without discount' : 'Davolash rejasining chegirmasiz narxi'}
                    </td>
                    <td className="py-2.5 px-3 text-right text-xs font-bold text-slate-900 font-mono">
                      {rawTotal.toLocaleString()} so'm
                    </td>
                  </tr>

                  {/* 2. Chegirmali narxi */}
                  <tr className="border-t border-slate-200 bg-slate-50/90 font-black">
                    <td colSpan="4" className="py-2.5 px-3 text-xs font-black text-slate-900">
                      <div className="flex items-center gap-2">
                        <span>{language === 'ru' ? 'Стоимость со скидкой' : language === 'en' ? 'Discounted price' : 'Chegirmali narxi'}</span>
                        {discountPercent > 0 && (
                          <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-100/80 border border-emerald-300 px-1.5 py-0.5 rounded">
                            -{discountPercent}% ({discountAmount.toLocaleString()} so'm)
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right text-xs font-black text-slate-900 font-mono">
                      {discountedTotal.toLocaleString()} so'm
                    </td>
                  </tr>

                  {/* 3. Jami to'langan */}
                  <tr className="border-t border-slate-200 bg-[#dcfce7] text-[#166534] font-black">
                    <td colSpan="4" className="py-2.5 px-3 text-xs font-black text-[#166534]">
                      {language === 'ru' ? 'Всего оплачено' : language === 'en' ? 'Total Paid' : "Jami to'langan"}
                    </td>
                    <td className="py-2.5 px-3 text-right text-xs font-black text-[#166534] font-mono">
                      {totalPaidSum.toLocaleString()} so'm
                    </td>
                  </tr>

                  {/* 4. Qoldiq qarzdorlik */}
                  <tr className={`border-t border-slate-200 font-black ${finalDebt > 0 ? "bg-[#ffe4e6] text-[#9f1239]" : "bg-emerald-50/60 text-emerald-800"}`}>
                    <td colSpan="4" className={`py-2.5 px-3 text-xs font-black ${finalDebt > 0 ? 'text-[#9f1239]' : 'text-emerald-800'}`}>
                      {language === 'ru' ? 'Остаток задолженности' : language === 'en' ? 'Remaining debt' : (finalDebt > 0 ? "Qoldiq qarzdorlik" : "Qarz yo'q (To'liq to'langan)")}
                    </td>
                    <td className={`py-2.5 px-3 text-right text-xs font-black font-mono ${finalDebt > 0 ? 'text-[#9f1239]' : 'text-emerald-800'}`}>
                      {finalDebt.toLocaleString()} so'm
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
                      {language === 'ru' ? 'Всего оплачено' : language === 'en' ? 'Total Paid' : "To'langan jami"}
                    </td>
                    <td className="py-2.5 px-3 text-right font-black text-sm text-[#166534]">
                      {totalPaidSum.toLocaleString()} so'm
                    </td>
                  </tr>
                  <tr className={finalDebt > 0 ? "bg-[#ffe4e6] text-[#9f1239]" : "bg-[#f8fafc] text-slate-700"}>
                    <td colSpan="3" className={`py-2.5 px-3 font-black text-sm ${finalDebt > 0 ? 'text-[#9f1239]' : 'text-slate-700'}`}>
                      {language === 'ru' ? 'Общая задолженность' : language === 'en' ? 'Total Debt' : "Jami qarzdorlik"}
                    </td>
                    <td className={`py-2.5 px-3 text-right font-black text-sm ${finalDebt > 0 ? 'text-[#9f1239]' : 'text-slate-700'}`}>
                      {finalDebt.toLocaleString()} so'm
                    </td>
                  </tr>
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
