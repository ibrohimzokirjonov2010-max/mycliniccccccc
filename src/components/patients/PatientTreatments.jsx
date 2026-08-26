import { useEffect, useMemo, useState, memo } from 'react';
import StatusBadge from '../ui/StatusBadge';
import EmptyState from '../ui/EmptyState';
import { 
  ClipboardList, Calendar, CheckCircle2, Stethoscope, 
  ChevronRight, ListTodo, ActivitySquare, Percent, Pencil, Save, X, FileText, Printer, Plus
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useTranslation } from '@/i18n/LanguageContext';

const REMOVED_TOOTH_STATUS = 'Olib tashlangan';
const EXTRACTION_SERVICE_REGEX = /(aqil\s*tish|tish).*(olish|sug'?urish)|olib\s*tashlash|ekstraks|extraction|удалени/i;

const isExtractionService = (service) => {
  const text = [
    service?.service_name,
    service?.name,
    service?.type,
    service?.category,
  ].filter(Boolean).join(' ');

  return EXTRACTION_SERVICE_REGEX.test(text);
};

const formatPlanName = (name, t) => {
  if (!name) return t ? t('patientProfile.treatmentPlanSingular') || t('patientTreatments.title') : 'Davolash rejasi';
  // Qavs ichidagi tish raqamini ajratib olamiz: masalan "(#11)" yoki "(#31)"
  const toothMatch = name.match(/\s*\(#\d+\)$/);
  const toothSuffix = toothMatch ? toothMatch[0] : '';
  
  // Tish raqamini olib tashlab, qolgan xizmatlarni vergul bo'yicha ajratamiz
  const baseName = toothMatch ? name.slice(0, toothMatch.index) : name;
  const parts = baseName.split(',').map(p => p.trim()).filter(Boolean);
  
  if (parts.length <= 2) return name; // Agar 2 ta yoki undan kam xizmat bo'lsa, o'zgartirmaymiz
  
  // Dastlabki 2 ta xizmat nomi + qolganlar soni
  const countSuffix = t ? ` +${parts.length - 2} ${t('common.count')}` : ` +${parts.length - 2} ta`;
  const compactBase = parts.slice(0, 2).join(', ') + countSuffix;
  return compactBase + toothSuffix;
};

const getServiceDepartment = (service, t) => {
  const raw = String(
    service?.category ||
    service?.type ||
    service?.department ||
    service?.section ||
    service?.service_category ||
    service?.service_name ||
    service?.name ||
    ''
  ).toLowerCase();

  if (raw.includes('implant')) return t ? t('patientTreatments.departments.implant') : 'Implantatsiya';
  if (raw.includes('bolalar') || raw.includes('child')) return t ? t('patientTreatments.departments.child') : 'Bolalar stomatologiyasi';
  if (raw.includes('gigiyena') || raw.includes('profilaktika') || raw.includes('skaler')) return t ? t('patientTreatments.departments.hygiene') : 'Gigiyena va profilaktika';
  if (raw.includes('vinir') || raw.includes('oqartirish') || raw.includes('bleaching') || raw.includes('estetik')) return t ? t('patientTreatments.departments.esthetics') : 'Estetik stomatologiya';
  if (raw.includes('endo') || raw.includes('kanal')) return t ? t('patientTreatments.departments.endodontics') : 'Endodontiya';
  if (raw.includes('olish') || raw.includes('sug\'urish') || raw.includes('xirurg') || raw.includes('anesteziya')) return t ? t('patientTreatments.departments.surgery') : 'Xirurgiya';
  if (raw.includes('karonka') || raw.includes('protez') || raw.includes('sirkoniy') || raw.includes('ko\'prik')) return t ? t('patientTreatments.departments.orthopedics') : 'Ortopediya';
  if (raw.includes('breket') || raw.includes('reteyner') || raw.includes('plastinka') || raw.includes('ortodont')) return t ? t('patientTreatments.departments.orthodontics') : 'Ortodontiya';
  return t ? t('patientTreatments.departments.general') : 'Davolash bo\'limi';
};

const formatPlanDepartmentName = (plan, t) => {
  if (!plan) return t ? t('patientProfile.treatmentPlanSingular') || t('patientTreatments.title') : 'Davolash rejasi';

  const toothSuffix = plan?.tooth_number ? ` (#${plan.tooth_number})` : '';
  const services = Array.isArray(plan?.services) ? plan.services : [];

  if (!services.length) {
    return `${formatPlanName(plan?.name || plan?.title || (t ? t('patientProfile.treatmentPlanSingular') || t('patientTreatments.title') : 'Davolash rejasi'), t)}`;
  }

  const departments = [...new Set(services.map(s => getServiceDepartment(s, t)).filter(Boolean))];
  if (!departments.length) {
    return `${formatPlanName(plan?.name || plan?.title || (t ? t('patientProfile.treatmentPlanSingular') || t('patientTreatments.title') : 'Davolash rejasi'), t)}`;
  }

  const countSuffix = t ? ` +${departments.length - 2} ${t('common.count')}` : ` +${departments.length - 2} ta`;
  const compactDepartments = departments.length > 2
    ? `${departments.slice(0, 2).join(', ')}${countSuffix}`
    : departments.join(', ');

  return `${compactDepartments}${toothSuffix}`;
};

const toDateSafe = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDate = (value, language, { withTime = false } = {}) => {
  const date = toDateSafe(value);
  if (!date) return language === 'uz' ? "Noma'lum" : language === 'ru' ? "Неизвестно" : "Unknown";

  const locale = language === 'uz' ? 'uz-UZ' : language === 'ru' ? 'ru-RU' : 'en-US';
  const dateStr = date.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });

  if (!withTime) {
    return dateStr;
  }

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${dateStr}, ${hours}:${minutes}`;
};

const formatMoney = (value) => `${Number(value || 0).toLocaleString('ru-RU')} so'm`;

/**
 * PatientTreatments Component
 * 
 * Displays patient treatment plans with status, priority, and pricing information.
 * Shows services breakdown and completion dates.
 * 
 * @param {Object} props
 * @param {Array} props.plans - Array of treatment plan objects
 * @param {boolean} props.showRemainingAsPrimary - Show remaining debt instead of total plan price
 */
function PatientTreatments({
  plans = [],
  discountAmount = 0,
  discountPercent = 0,
  showRemainingAsPrimary = false,
  onAddPlan
}) {
  const { t, language } = useTranslation();
  const [localPlans, setLocalPlans] = useState(plans);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditingServices, setIsEditingServices] = useState(false);
  const [editedServices, setEditedServices] = useState([]);
  const [savingServices, setSavingServices] = useState(false);
  const [invoicePlan, setInvoicePlan] = useState(null);

  useEffect(() => {
    setLocalPlans(plans || []);
  }, [plans]);

  const getRemainingAmount = (plan) => {
    const totalPrice = Number(plan?.total_price) || 0;
    const paidAmount = Number(plan?.paid_amount) || 0;
    return Math.max(0, totalPrice - paidAmount);
  };

  // Sort plans by creation date (newest first)
  const sortedPlans = useMemo(() => {
    return [...(localPlans || [])].sort((a, b) => {
      const dateA = new Date(a.created_at || a.created_date || a.start_date || 0).getTime();
      const dateB = new Date(b.created_at || b.created_date || b.start_date || 0).getTime();
      return dateB - dateA;
    });
  }, [localPlans]);

  // Calculate totals
  const { totalPlans, totalValue, totalRemainingValue, completedPlans, discAmount, discPercent } = useMemo(() => {
    // discount_amount rejada saqlanadi (rawTotal * discount / 100)
    const totalDiscountFromPlans = localPlans.reduce((sum, p) => sum + (Number(p.discount_amount) || 0), 0);
    // discountAmount prop — eski (legacy) Discount paymentlardan keladi, yangi rejalar uchun 0
    const effectiveDiscount = totalDiscountFromPlans > 0 ? totalDiscountFromPlans : (discountAmount || 0);
    
    // totalValue (Jami qiymat) should be original price before discount
    const totalOriginal = localPlans.reduce((sum, p) => sum + (Number(p.total_price) || 0) + (Number(p.discount_amount) || 0), 0);
    const totalRemaining = localPlans.reduce((sum, p) => sum + getRemainingAmount(p), 0);
    const completed = localPlans.filter(p => p.status === 'Completed').length;
    
    // Calculate exact discount percentage based on original price
    const calculatedDiscPercent = totalOriginal > 0 ? Math.round((effectiveDiscount / totalOriginal) * 100) : 0;
    
    return {
      totalPlans: localPlans.length,
      totalValue: totalOriginal,
      totalRemainingValue: totalRemaining,
      completedPlans: completed,
      discAmount: effectiveDiscount,
      discPercent: calculatedDiscPercent
    };
  }, [localPlans, discountAmount]);

  const openPlanDetails = (plan) => {
    setSelectedPlan(plan);
    setIsEditingServices(false);
    setEditedServices(Array.isArray(plan?.services) ? plan.services : []);
    setIsModalOpen(true);
  };

  // Empty state
  if (!localPlans.length) {
    return (
      <EmptyState 
        icon={ClipboardList} 
        title={t('patientTreatments.emptyTitle')} 
        description={t('patientTreatments.emptyDesc')}
      />
    );
  }

  const toggleServiceDone = (serviceKey) => {
    if (!isEditingServices) return;
    const nowIso = new Date().toISOString();
    setEditedServices(prev =>
      (prev || []).map((s, idx) => {
        const key = s?.service_id ?? s?.id ?? idx;
        if (key !== serviceKey) return s;
        const nextCompleted = !Boolean(s?.completed);
        return {
          ...s,
          completed: nextCompleted,
          completion_date: nextCompleted ? (s?.completion_date || nowIso) : null,
        };
      })
    );
  };

  const handleSaveServices = async () => {
    if (!selectedPlan?.id) return;
    try {
      setSavingServices(true);
      const updatedServices = Array.isArray(editedServices) ? editedServices : [];

      const allCompleted = updatedServices.length > 0 && updatedServices.every(s => Boolean(s?.completed));
      const anyCompleted = updatedServices.some(s => Boolean(s?.completed));

      // Statuslar system bo'ylab inglizcha qiymatlar bilan ham ishlaydi
      const nextStatus = allCompleted ? 'Completed' : anyCompleted ? 'In Progress' : 'Planned';

      await base44.entities.TreatmentPlan.update(selectedPlan.id, {
        services: updatedServices,
        status: nextStatus,
      });

      const getToothFdi = (service) => {
        let val = service.tooth || service.tooth_number || service.tooth_id || '';
        val = String(val).trim();
        if (!val) return '';
        const match = val.match(/^(ur|ul|lr|ll)(\d+)(c)?$/i);
        if (match) {
          const [, quad, num, isChild] = match;
          const q = quad.toLowerCase();
          if (isChild) {
            const qMap = { ur: 5, ul: 6, ll: 7, lr: 8 };
            return `${qMap[q]}${num}`;
          } else {
            const qMap = { ur: 1, ul: 2, ll: 3, lr: 4 };
            return `${qMap[q]}${num}`;
          }
        }
        return val;
      };

      if (updatedServices.length > 0 && selectedPlan?.patient_id) {
        const existingRecords = await base44.entities.ToothRecord.filter(
          { patient_id: selectedPlan.patient_id },
          'tooth_number',
          100
        );

        const clinicId = localStorage.getItem('current_clinic_id') || selectedPlan?.clinic_id || 'default_clinic';

        for (const service of updatedServices) {
          const toothNumber = getToothFdi(service);
          if (!toothNumber || toothNumber.toLowerCase() === 'general') continue;

          const existingRecord = (existingRecords || []).find(record => String(record?.tooth_number) === String(toothNumber));
          const svcName = String(service.service_name || service.name || '').toLowerCase();
          
          let derivedCondition = null;
          let derivedTreatment = service.service_name || service.name || 'Davolangan';
          const isExtraction = isExtractionService(service);
          
          if (isExtraction) {
            derivedCondition = REMOVED_TOOTH_STATUS;
            derivedTreatment = REMOVED_TOOTH_STATUS;
          } else if (svcName.includes('implant')) {
            derivedTreatment = 'Implant';
          } else if (svcName.includes('vinir') || svcName.includes('veneer')) {
            derivedTreatment = 'Veneer';
          } else if (svcName.includes('karonka') || svcName.includes('toj') || svcName.includes('crown') || svcName.includes('protez') || svcName.includes('metallokeramika')) {
            derivedTreatment = 'Toj';
          } else if (svcName.includes('plomba') || svcName.includes('restavratsiya')) {
            derivedTreatment = 'Restavratsiya';
          } else if (svcName.includes('endo') || svcName.includes('kanal') || svcName.includes('pulpit')) {
            derivedCondition = 'Pulpit';
            derivedTreatment = 'Kanal';
          } else if (svcName.includes('kariyes') || svcName.includes('caries') || svcName.includes('karies')) {
            derivedCondition = 'Kariyes';
            derivedTreatment = 'Davolangan';
          }

          if (service.completed) {
            const payload = {
              patient_id: selectedPlan.patient_id,
              clinic_id: clinicId,
              tooth_number: toothNumber,
              condition: derivedCondition || (existingRecord ? existingRecord.condition : null),
              treatment: derivedTreatment || (existingRecord ? existingRecord.treatment : null),
              notes: existingRecord?.notes || `Tizim orqali avtomatik kiritildi (${service.service_name || service.name || 'xizmat'})`,
            };

            if (existingRecord?.id) {
              await base44.entities.ToothRecord.update(existingRecord.id, payload);
            } else {
              await base44.entities.ToothRecord.create(payload);
            }
          } else {
            // If the completed checkbox was unchecked, clear the condition & treatment (make it healthy/empty)
            if (existingRecord?.id) {
              await base44.entities.ToothRecord.update(existingRecord.id, {
                condition: null,
                treatment: null,
                notes: (existingRecord.notes || '') + " (Qaytarildi)"
              });
            }
          }
        }
      }

      // UI'ni refreshsiz yangilash (props kelmaguncha ham)
      setLocalPlans(prev =>
        (prev || []).map(p =>
          p.id === selectedPlan.id ? { ...p, services: updatedServices, status: nextStatus } : p
        )
      );
      setSelectedPlan(prev => (prev ? { ...prev, services: updatedServices, status: nextStatus } : prev));

      setIsEditingServices(false);
      toast.success("Xizmatlar holati saqlandi");
    } catch (e) {
      console.error(e);
      toast.error("Saqlashda xatolik yuz berdi");
    } finally {
      setSavingServices(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards - More compact & Side-by-side */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2 w-full">
         <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
               <ClipboardList className="w-6 h-6" />
            </div>
            <div>
               <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">{t('patientTreatments.title')}</h3>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('patientTreatments.totalTreatments', { count: plans.length })}</p>
            </div>
         </div>
         {onAddPlan && (
           <Button 
             onClick={onAddPlan}
             className="w-full sm:w-auto h-12 rounded-2xl bg-[#10B981] hover:bg-[#059669] text-white font-black uppercase text-[11px] tracking-widest gap-2 px-6 shadow-lg shadow-emerald-500/20 transition-all active:scale-95 border-none"
           >
             <Plus className="w-5 h-5" /> {t('patientTreatments.addPlan')}
           </Button>
         )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3 sm:p-5 shadow-sm transition-transform hover:scale-[1.02]">
          <p className="text-[9px] sm:text-[11px] uppercase tracking-wider font-black text-blue-600 mb-0.5 sm:mb-1">{t('patientTreatments.totalPlans')}</p>
          <p className="text-xl sm:text-3xl font-black text-blue-700">{totalPlans}</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3 sm:p-5 shadow-sm transition-transform hover:scale-[1.02]">
          <p className="text-[9px] sm:text-[11px] uppercase tracking-wider font-black text-emerald-600 mb-0.5 sm:mb-1">{t('patientTreatments.completed')}</p>
          <p className="text-xl sm:text-3xl font-black text-emerald-700">{completedPlans}</p>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3 sm:p-5 shadow-sm transition-transform hover:scale-[1.02]">
          <p className="text-[9px] sm:text-[11px] uppercase tracking-wider font-black text-amber-600 mb-0.5 sm:mb-1">
            {showRemainingAsPrimary ? t('patientTreatments.remainingDebt') : t('patientTreatments.totalValue')}
          </p>
          <p className="text-xl sm:text-2xl font-black text-amber-700 leading-tight">
            {(showRemainingAsPrimary ? totalRemainingValue : totalValue).toLocaleString()} <span className="text-[10px] font-bold opacity-50">{t('common.currency')}</span>
          </p>
        </div>
        <div className="bg-rose-50 border border-rose-100 rounded-2xl p-3 sm:p-5 shadow-sm transition-transform hover:scale-[1.02]">
          <p className="text-[9px] sm:text-[11px] uppercase tracking-wider font-black text-rose-600 mb-0.5 sm:mb-1">{t('patientTreatments.discounts')}</p>
          <p className="text-xl sm:text-2xl font-black text-rose-700 leading-tight">
            {discAmount.toLocaleString()} <span className="text-[10px] font-bold opacity-50">{t('common.currency')}</span>
          </p>
          {discPercent > 0 && (
            <p className="text-[9px] font-black text-rose-500 uppercase mt-1">
              {t('patientTreatments.discountPercent', { percent: discPercent })}
            </p>
          )}
        </div>
      </div>

      {/* Treatment Plans List */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="md:hidden p-3 space-y-3 bg-slate-50/30">
          {sortedPlans.map((plan) => {
            const servicesTotal = (plan.services || []).reduce((sum, s) => sum + (Number(s.price) || 0), 0);
            const currentPrice = Number(plan.total_price) || 0;
            const explicitDiscount = Number(plan.discount_amount) || 0;
            const remainingAmount = getRemainingAmount(plan);
            const effectiveDiscountAmt = explicitDiscount > 100 ? explicitDiscount : (servicesTotal > currentPrice ? servicesTotal - currentPrice : 0);
            const effectiveDiscountPct = Number(plan.discount_percent) || (servicesTotal > 0 ? Math.round((effectiveDiscountAmt / servicesTotal) * 100) : 0);

            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => openPlanDetails(plan)}
                className="w-full text-left bg-white rounded-2xl border border-slate-200 p-3 shadow-sm active:scale-[0.99] transition-transform"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0 flex-1">
                    {/* Row 1: Plan title + status */}
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[13px] font-black text-slate-900 leading-5 uppercase break-words">
                        {formatPlanDepartmentName(plan, t)}
                      </p>
                      <StatusBadge status={plan.status} />
                    </div>

                    {/* Row 2: Services names */}
                    {plan.services?.length > 0 ? (
                      <p className="text-[10px] font-semibold text-slate-500 mt-1 leading-snug line-clamp-2">
                        {plan.services.map(s => s.service_name || s.name).filter(Boolean).join(' • ')}
                      </p>
                    ) : (
                      <p className="text-[10px] text-slate-300 italic mt-1">{t('patientTreatments.noServices')}</p>
                    )}

                    {/* Row 3: Discount */}
                    {effectiveDiscountAmt > 0 && (
                      <div className="mt-1.5">
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 border border-rose-100 px-2 py-0.5 text-[9px] font-black text-rose-600">
                          <Percent className="w-2.5 h-2.5" />
                          {t('patientTreatments.discountPercent', { percent: effectiveDiscountPct })} — {effectiveDiscountAmt.toLocaleString()} {t('common.currency')}
                        </span>
                      </div>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 shrink-0 mt-1" />
                </div>

                {/* Row 4: Price and debt - compact 2 col */}
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2">
                    <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">
                      {showRemainingAsPrimary ? t('patientTreatments.remaining') : t('patientTreatments.planTotal')}
                    </p>
                    <p className="text-[15px] font-black text-emerald-700 mt-0.5 whitespace-nowrap">
                      {(showRemainingAsPrimary ? remainingAmount : currentPrice).toLocaleString('ru-RU')}
                    </p>
                  </div>
                  <div className="rounded-xl bg-rose-50 border border-rose-100 px-3 py-2">
                    <p className="text-[9px] font-black text-rose-600 uppercase tracking-widest">{t('patientTreatments.debt')}</p>
                    <p className="text-[15px] font-black text-rose-700 mt-0.5 whitespace-nowrap">
                      {remainingAmount.toLocaleString('ru-RU')}
                    </p>
                  </div>
                </div>

                {/* Row 5: Meta — tooth, date, installment */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {plan.tooth_number && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-100 px-2 py-0.5 text-[9px] font-black text-emerald-700">
                      <Stethoscope className="w-3 h-3" /> {t('patientTreatments.forTooth', { number: plan.tooth_number })}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 border border-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-500">
                    <Calendar className="w-3 h-3 text-blue-400" />
                    {plan.created_date ? formatDate(plan.created_date, language) : '--'}
                  </span>
                  {plan.installment_plan && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-100 px-2 py-0.5 text-[9px] font-black text-blue-700">
                      <Calendar className="w-3 h-3" />
                      {t('patientTreatments.monthsCount', { count: plan.installment_plan.months })}
                    </span>
                  )}
                </div>

                {/* Hisob-faktura tugmasi */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setInvoicePlan(plan); }}
                  className="mt-2 w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 text-[11px] font-black hover:bg-indigo-100 transition-all active:scale-95"
                >
                  <FileText className="w-3.5 h-3.5" />
                  {t('patientTreatments.invoice')}
                </button>
              </button>
            );
          })}
        </div>

        <div className="hidden md:block overflow-x-auto no-scrollbar">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left text-[10px] font-black text-slate-400 uppercase tracking-wider px-6 py-5">
                  {t('patientTreatments.invoiceDetails.plan')}
                </th>
                <th className="text-left text-[10px] font-black text-slate-400 uppercase tracking-wider px-6 py-5">
                  {t('patientTreatments.details.status')}
                </th>
                <th className="text-left text-[10px] font-black text-slate-400 uppercase tracking-wider px-6 py-5 hidden md:table-cell">
                  {t('patientPayments.date')}
                </th>
                <th className="text-right text-[10px] font-black text-slate-400 uppercase tracking-wider px-6 py-5">
                  {t('patientTreatments.details.price')}
                </th>
                <th className="text-right text-[10px] font-black text-slate-400 uppercase tracking-wider px-6 py-5">
                  {/* Action */}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedPlans.map((plan) => (
                <tr 
                  key={plan.id} 
                  className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors cursor-pointer group"
                  onClick={() => openPlanDetails(plan)}
                >
                  <td className="px-4 py-3">
                    {/* Row 1: Plan Title */}
                    <p className="text-xs font-black text-slate-900 group-hover:text-emerald-600 transition-colors uppercase tracking-tight leading-tight mb-1.5">
                      {formatPlanDepartmentName(plan, t)}
                    </p>

                    {/* Row 2: Services list */}
                    {plan.services?.length > 0 ? (
                      <p className="text-[10px] font-semibold text-slate-600 leading-snug mb-1.5 line-clamp-2">
                        {plan.services.map(s => s.service_name || s.name).filter(Boolean).join(' • ')}
                      </p>
                    ) : (
                      <p className="text-[10px] font-bold text-slate-300 italic mb-1.5">{t('patientTreatments.noServices')}</p>
                    )}

                    {/* Row 3: Discount */}
                    {(() => {
                      const dAmt = plan.discount_amount || 0;
                      const dPct = plan.discount_percent || 0;
                      const servicesTotal = (plan.services || []).reduce((sum, s) => sum + (Number(s.price) || 0), 0);
                      const calculatedDiscount = servicesTotal - (Number(plan.total_price) || 0);
                      const finalDiscountAmt = dAmt > 0 ? dAmt : (calculatedDiscount > 100 ? calculatedDiscount : 0);
                      const finalDiscountPct = dPct > 0 ? dPct : (servicesTotal > 0 && calculatedDiscount > 100 ? Math.round((calculatedDiscount / servicesTotal) * 100) : 0);
                      if (finalDiscountAmt > 0) {
                        return (
                          <span className="inline-flex items-center gap-1 text-[9px] font-black text-rose-500 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded uppercase">
                            <Percent className="w-2.5 h-2.5" />
                            {t('patientTreatments.discounts')}: -{finalDiscountAmt.toLocaleString()} ({finalDiscountPct}%)
                          </span>
                        );
                      }
                      return null;
                    })()}

                    {/* Row 4: Meta info — tooth, date, installment compact */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      {plan.tooth_number && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-black text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded">
                          <Stethoscope className="w-2.5 h-2.5" /> #{plan.tooth_number}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold text-slate-400 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded">
                        <Calendar className="w-2.5 h-2.5 text-blue-400" />
                        {plan.created_date ? formatDate(plan.created_date, language) : '--'}
                        {plan.created_date && (
                          <span className="text-slate-300">·</span>
                        )}
                        {plan.created_date ? formatDate(plan.created_date, language, { withTime: true }).split(', ')[1] : ''}
                      </span>
                      {plan.installment_plan && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 border border-blue-100 rounded text-[9px] font-black text-blue-600 uppercase">
                          <Calendar className="w-2.5 h-2.5" />
                          {t('patientTreatments.monthsCount', { count: plan.installment_plan.months })}
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="px-6 py-5 align-top pt-8">
                    <StatusBadge status={plan.status} />
                  </td>

                  <td className="px-6 py-5 hidden xl:table-cell align-top pt-8">
                    <div className="flex flex-col opacity-0">.</div>
                  </td>

                  <td className="px-6 py-5 text-right align-top pt-7">
                    <div className="flex flex-col items-end">
                      {(() => {
                        const servicesTotal = (plan.services || []).reduce((sum, s) => sum + (Number(s.price) || 0), 0);
                        const currentPrice = Number(plan.total_price) || 0;
                        const explicitDiscount = Number(plan.discount_amount) || 0;
                        const remainingAmount = getRemainingAmount(plan);
                        const effectiveDiscountAmt = explicitDiscount > 100 ? explicitDiscount : (servicesTotal > currentPrice ? servicesTotal - currentPrice : 0);
                        const effectiveDiscountPct = Number(plan.discount_percent) || (servicesTotal > 0 ? Math.round((effectiveDiscountAmt / servicesTotal) * 100) : 0);
                        const originalPrice = servicesTotal > currentPrice ? servicesTotal : currentPrice + effectiveDiscountAmt;

                        return (
                          <>
                            {effectiveDiscountAmt > 100 && (
                              <p className="text-[10px] font-bold text-slate-300 line-through mb-0.5">
                                {originalPrice.toLocaleString()}
                              </p>
                            )}
                            
                            <p className="text-base font-black text-slate-900 tracking-tighter">
                              {(showRemainingAsPrimary ? remainingAmount : currentPrice).toLocaleString()} <span className="text-[10px] font-bold opacity-30">{t('common.currency')}</span>
                            </p>

                            {showRemainingAsPrimary && (
                              <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                                {t('patientTreatments.planTotal')}: {currentPrice.toLocaleString()} {t('common.currency')}
                              </p>
                            )}

                            {remainingAmount > 0 && (
                               <div className="flex flex-col items-end gap-1 mt-1">
                                 <p className="text-[10px] font-black text-rose-500 uppercase tracking-tighter bg-rose-50 inline-block px-2 py-0.5 rounded border border-rose-100/50">
                                   {t('patientTreatments.debt')}: {remainingAmount.toLocaleString()}
                                 </p>
                                 {plan.installment_plan && (
                                   <div className="flex items-center gap-1 text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 uppercase tracking-tighter shadow-sm">
                                      <Calendar className="w-2.5 h-2.5" />
                                      {t('patientTreatments.monthlyInstallment', { months: plan.installment_plan.months, amount: Math.round(plan.installment_plan.monthly_amount).toLocaleString() })}
                                   </div>
                                 )}
                               </div>
                             )}

                            {effectiveDiscountAmt > 0 && (
                              <div className="mt-1.5 flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 border border-emerald-100/50 rounded-md shadow-sm">
                                <Percent className="w-2.5 h-2.5 text-emerald-600" />
                                <span className="text-[10px] font-black text-emerald-700 uppercase tracking-tighter">
                                  {t('patientTreatments.discountPercent', { percent: effectiveDiscountPct })} — {effectiveDiscountAmt.toLocaleString()} {t('common.currency')}
                                </span>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </td>
                  
                  <td className="px-4 py-5 text-right">
                    <ChevronRight className="w-5 h-5 text-slate-200 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all ml-auto" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="hidden md:block">
          <div className="flex px-6 py-4 bg-slate-50/50 border-t border-slate-100 items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {t('patientTreatments.safeDbNotice')}
              </span>
            </div>
            <span className="text-[10px] font-black text-slate-300">{t('patientTreatments.version')}</span>
          </div>
        </div>
      </div>

      {/* Plan Details Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-[1.5rem] sm:rounded-[2rem] p-0 gap-0 border border-slate-100 shadow-2xl bg-white">
          {selectedPlan && (
            <div className="flex flex-col">
              {/* Header */}
              <div className="bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 px-5 py-6 sm:p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 sm:p-12 opacity-10 rotate-12">
                   <ActivitySquare className="w-36 h-36 sm:w-64 sm:h-64 text-white" />
                </div>
                
                <DialogHeader className="relative z-10">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="min-w-0 space-y-2.5">
                      {/* Bemor ismi va Xizmatlar nomi */}
                      <div className="flex flex-wrap items-baseline gap-2.5 leading-none">
                        <span className="text-2xl sm:text-3xl font-[1000] text-white tracking-tight uppercase leading-none">
                          {selectedPlan.patient_name || t('patientTreatments.invoiceDetails.patient')}
                        </span>
                        <span className="text-[11px] sm:text-xs font-black text-emerald-100/80 tracking-wide leading-none">
                          ({formatPlanDepartmentName(selectedPlan, t)})
                        </span>
                      </div>
                      
                      {/* Status va Tish raqamlari (teparoq ko'chirildi) */}
                      <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge status={selectedPlan.status} />
                          {selectedPlan.tooth_number && (
                            <span className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-black text-emerald-800 bg-white/90 px-3 py-1.5 rounded-full shadow-sm">
                               <Stethoscope className="w-3 h-3 shrink-0 text-emerald-600" />
                               {t('patientTreatments.forTooth', { number: selectedPlan.tooth_number }).toUpperCase()}
                            </span>
                          )}
                      </div>
                    </div>
                    
                    {/* Hisob-faktura tugmasi (yuqori o'ngda) */}
                    <div className="shrink-0">
                      <Button
                        variant="secondary"
                        onClick={() => { setInvoicePlan(selectedPlan); setIsModalOpen(false); }}
                        className="h-11 rounded-xl bg-white hover:bg-emerald-50 text-emerald-700 border-none font-black text-[10px] uppercase tracking-widest gap-2 shadow-md active:scale-95 transition-all"
                      >
                        <FileText className="w-4 h-4 text-emerald-600" /> {t('patientTreatments.invoiceDetails.title')}
                      </Button>
                    </div>
                  </div>
                </DialogHeader>
              </div>

              {/* Body */}
              <div className="p-4 sm:p-8 -mt-4 sm:-mt-6 relative z-20">
                 {/* Quick Stats Grid */}
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-5 sm:mb-8">
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 sm:p-4 flex items-center gap-3 sm:gap-4 transition-transform hover:scale-[1.02]">
                       <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-[1rem] bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                          <Calendar className="w-5 h-5 sm:w-6 sm:h-6" />
                       </div>
                       <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('patientTreatments.details.createdDate')}</p>
                          <p className="font-black text-slate-900 text-[15px] sm:text-lg mt-0.5 break-words">
                            {formatDate(selectedPlan.created_date || selectedPlan.created_at, language)}
                          </p>
                       </div>
                    </div>
                    <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm p-3 sm:p-4 flex items-center gap-3 sm:gap-4 transition-transform hover:scale-[1.02] ${selectedPlan.status === 'Completed' ? 'opacity-100' : 'opacity-40'}`}>
                       <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-[1rem] flex items-center justify-center shrink-0 ${selectedPlan.status === 'Completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                          <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
                       </div>
                       <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('patientTreatments.details.completedDate')}</p>
                          <p className="font-black text-slate-900 text-[15px] sm:text-lg mt-0.5 break-words">
                            {selectedPlan.updated_date && selectedPlan.status === 'Completed' ? formatDate(selectedPlan.updated_date, language) : t('patientTreatments.details.notCompleted')}
                          </p>
                       </div>
                    </div>
                 </div>

                 {/* Financial Summary Card (moved from header to bottom body) */}
                  {(() => {
                    const servicesTotal = (selectedPlan.services || []).reduce((sum, s) => sum + (Number(s.price) || 0), 0);
                    const dAmt = selectedPlan.discount_amount || 0;
                    const dPct = selectedPlan.discount_percent || 0;
                    const calculatedDiscount = servicesTotal - (Number(selectedPlan.total_price) || 0);
                    const finalDiscountAmt = dAmt > 0 ? dAmt : (calculatedDiscount > 100 ? calculatedDiscount : 0);
                    const finalDiscountPct = dPct > 0 ? dPct : (servicesTotal > 0 && calculatedDiscount > 100 ? Math.round((calculatedDiscount / servicesTotal) * 100) : 0);
                    const finalPrice = Number(selectedPlan.total_price) || 0;
                    const paid = Number(selectedPlan.paid_amount) || 0;
                    const remaining = Math.max(0, finalPrice - paid);

                    return (
                      <div className="mb-5 sm:mb-8 bg-slate-900 rounded-2xl p-4 sm:p-5 text-white shadow-xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-36 h-36 bg-[#10b981] rounded-full blur-[80px] opacity-10 pointer-events-none" />
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">{t('patientTreatments.details.priceDetails')}</p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          <div className="space-y-1">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider">{t('patientTreatments.originalPrice')}</p>
                            <p className="text-[13px] sm:text-base font-black text-white">{servicesTotal.toLocaleString()} {t('common.currency')}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider">{t('patientTreatments.discounts')}</p>
                            <p className="text-[13px] sm:text-base font-black text-rose-400">
                              {finalDiscountAmt > 0 ? `-${finalDiscountAmt.toLocaleString()} ${t('common.currency')} (${finalDiscountPct}%)` : '—'}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider">{t('patientTreatments.details.totalPaid')}</p>
                            <p className="text-[13px] sm:text-base font-black text-emerald-400">{paid.toLocaleString()} {t('common.currency')}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider">{t('patientTreatments.details.remainingAmount')}</p>
                            <p className={`text-[13px] sm:text-base font-black ${remaining > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                              {remaining > 0 ? `${remaining.toLocaleString()} ${t('common.currency')}` : t('patientTreatments.details.fullyPaid')}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                 {/* Installment Plan Schedule UI */}
                 {selectedPlan.installment_plan && (
                   <div className="mb-5 sm:mb-8 overflow-hidden rounded-2xl border border-blue-100 shadow-sm">
                      <div className="bg-blue-600 px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2">
                         <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-white" />
                            <span className="text-[9px] sm:text-[10px] font-black text-white uppercase tracking-widest">{t('patientProfile.installments.title')}</span>
                         </div>
                         <div className="bg-white/20 px-2 py-0.5 rounded text-[8px] sm:text-[9px] font-black text-white uppercase whitespace-nowrap">
                            {t('patientTreatments.monthsCount', { count: selectedPlan.installment_plan.months }).toUpperCase()}
                         </div>
                      </div>
                      <div className="p-0 bg-blue-50/20">
                         <table className="w-full text-left">
                            <thead>
                               <tr className="border-b border-blue-100">
                                  <th className="px-3 sm:px-4 py-2 text-[8px] sm:text-[9px] font-black text-blue-800 uppercase">{t('patientPayments.date')}</th>
                                  <th className="px-3 sm:px-4 py-2 text-[8px] sm:text-[9px] font-black text-blue-800 uppercase text-right">{t('patientPayments.amount')}</th>
                               </tr>
                            </thead>
                            <tbody>
                               {Array.from({ length: selectedPlan.installment_plan.months }).map((_, idx) => {
                                  const d = new Date(selectedPlan.installment_plan.start_date || selectedPlan.created_date);
                                  d.setMonth(d.getMonth() + idx);
                                  return (
                                     <tr key={idx} className="border-b border-blue-50/50 last:border-0 hover:bg-blue-50/40 transition-colors">
                                        <td className="px-3 sm:px-4 py-2 text-[10px] sm:text-[11px] font-medium text-slate-600">
                                           {formatDate(d, language)}
                                        </td>
                                        <td className="px-3 sm:px-4 py-2 text-[10px] sm:text-[11px] font-black text-slate-900 text-right whitespace-nowrap">
                                           {Math.round(selectedPlan.installment_plan.monthly_amount).toLocaleString()} {t('common.currency')}
                                        </td>
                                     </tr>
                                  );
                                })}
                            </tbody>
                         </table>
                         <div className="p-3 bg-blue-50/50 border-t border-blue-100">
                            <p className="text-[9px] sm:text-[10px] text-blue-700 italic font-medium">{t('patientTreatments.invoiceDetails.footnote')}</p>
                         </div>
                      </div>
                   </div>
                 )}

                 {/* Services List - TARTIBLANGAN KATAK */}
                 <div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3.5 pl-1">
                      <h4 className="flex items-center gap-2 text-xs font-black text-slate-900 uppercase tracking-wider">
                         <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center">
                           <ListTodo className="w-3 h-3 text-emerald-600" />
                         </div>
                         {t('patientTreatments.details.servicesTitle', { count: (isEditingServices ? editedServices : selectedPlan.services)?.length || 0 })}
                      </h4>
                      
                      <div className="flex items-center gap-2">
                        {!isEditingServices ? (
                          <Button
                            variant="secondary"
                            onClick={() => { setIsEditingServices(true); setEditedServices(Array.isArray(selectedPlan?.services) ? selectedPlan.services : []); }}
                            className="h-8 px-3 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-100 font-black text-[9px] uppercase tracking-widest gap-1.5 active:scale-95 transition-all"
                          >
                            <Pencil className="w-3 h-3" /> {t('patientTreatments.details.setServices')}
                          </Button>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <Button
                              onClick={handleSaveServices}
                              disabled={savingServices}
                              className="h-8 px-3 rounded-lg bg-slate-900 hover:bg-slate-950 text-white font-black text-[9px] uppercase tracking-widest gap-1.5 active:scale-95 transition-all"
                            >
                              <Save className="w-3 h-3" /> {savingServices ? t('patientTreatments.details.saving') : t('patientTreatments.details.save')}
                            </Button>
                            <Button
                              variant="secondary"
                              disabled={savingServices}
                              onClick={() => { setIsEditingServices(false); setEditedServices(Array.isArray(selectedPlan?.services) ? selectedPlan.services : []); }}
                              className="h-8 px-3 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-500 border border-slate-200 font-black text-[9px] uppercase tracking-widest gap-1.5 active:scale-95 transition-all"
                            >
                              <X className="w-3 h-3" /> {t('patientTreatments.details.cancel')}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                    
                   <div className="rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                       {!(isEditingServices ? editedServices : selectedPlan.services) || (isEditingServices ? editedServices : selectedPlan.services).length === 0 ? (
                          <div className="text-center py-8 bg-slate-50/50">
                             <ListTodo className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                             <p className="text-xs text-slate-500 font-bold">{t('patientTreatments.details.noServicesAttached')}</p>
                          </div>
                       ) : (
                         <table className="w-full">
                           <thead>
                             <tr className="bg-slate-50 border-b border-slate-100">
                               <th className="px-3 sm:px-4 py-2.5 text-left text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest w-8">#</th>
                               <th className="px-3 sm:px-4 py-2.5 text-left text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('patientTreatments.invoiceDetails.plan')}</th>
                               <th className="px-3 sm:px-4 py-2.5 text-right text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('patientTreatments.details.price')}</th>
                               <th className="px-3 sm:px-4 py-2.5 text-center text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('patientTreatments.details.status')}</th>
                             </tr>
                           </thead>
                           <tbody>
                             {(isEditingServices ? editedServices : selectedPlan.services).map((service, index) => {
                               const isCompleted = Boolean(service?.completed) || service?.status === 'completed';
                               const serviceKey = service?.service_id ?? service?.id ?? index;
                               return (
                                 <tr
                                   key={serviceKey}
                                   className={`border-b border-slate-50 last:border-0 transition-colors ${
                                     isCompleted ? 'bg-emerald-50/30' : 'bg-white hover:bg-slate-50/50'
                                   } ${isEditingServices ? 'cursor-pointer' : ''}`}
                                   onClick={() => isEditingServices && toggleServiceDone(serviceKey)}
                                 >
                                   {/* Tartib raqami */}
                                   <td className="px-4 py-3">
                                     <span className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500">
                                       {index + 1}
                                     </span>
                                   </td>
                                   {/* Xizmat nomi */}
                                   <td className="px-4 py-3">
                                     <div className="flex items-center gap-2">
                                       {isEditingServices && (
                                         <Checkbox
                                           checked={isCompleted}
                                           onCheckedChange={() => toggleServiceDone(serviceKey)}
                                           className="w-4 h-4 rounded border-slate-300 data-[state=checked]:bg-emerald-500"
                                         />
                                       )}
                                       <div>
                                         <p className={`text-xs font-black leading-tight ${isCompleted ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                                           {service.service_name}
                                         </p>
                                         {(service.tooth_number || service.tooth_id) && (
                                           <span className="text-[8px] font-black text-emerald-700 bg-emerald-100/60 px-1.5 py-0.5 rounded uppercase mt-0.5 inline-block">
                                             {t('patientTreatments.forTooth', { number: service.tooth_number || service.tooth_id })}
                                           </span>
                                         )}
                                       </div>
                                     </div>
                                   </td>
                                   {/* Narxi */}
                                   <td className="px-4 py-3 text-right">
                                     <span className="text-xs font-black text-slate-900 whitespace-nowrap">
                                       {service.price ? `${service.price.toLocaleString()}` : '—'}
                                       <span className="text-[9px] text-slate-300 ml-0.5">{t('common.currency')}</span>
                                     </span>
                                   </td>
                                   {/* Holat */}
                                   <td className="px-4 py-3 text-center">
                                     <span className={`inline-block text-[8px] font-black px-2 py-1 rounded-full uppercase tracking-wider whitespace-nowrap ${
                                       isCompleted
                                         ? 'bg-emerald-100 text-emerald-700'
                                         : 'bg-amber-50 text-amber-600'
                                     }`}>
                                       {isCompleted ? t('patientTreatments.details.completedSvc') : t('patientTreatments.details.pendingSvc')}
                                     </span>
                                   </td>
                                 </tr>
                               );
                             })}
                           </tbody>
                           {/* Jami */}
                           <tfoot>
                             <tr className="bg-slate-50 border-t border-slate-100">
                               <td colSpan={2} className="px-4 py-2.5 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                 {t('patientTreatments.details.totalServices', { count: (isEditingServices ? editedServices : selectedPlan.services).length })}
                               </td>
                               <td className="px-4 py-2.5 text-right">
                                 <span className="text-sm font-black text-emerald-700">
                                   {(isEditingServices ? editedServices : selectedPlan.services)
                                     .reduce((sum, s) => sum + (Number(s.price) || 0), 0).toLocaleString()}
                                   <span className="text-[9px] text-slate-300 ml-0.5">{t('common.currency')}</span>
                                 </span>
                               </td>
                               <td />
                             </tr>
                           </tfoot>
                         </table>
                       )}
                    </div>
                 </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ======== HISOB-FAKTURA MODAL ======== */}
      {invoicePlan && (
        <Dialog open={!!invoicePlan} onOpenChange={() => setInvoicePlan(null)}>
          <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[95vh] overflow-y-auto rounded-[1.5rem] p-0 gap-0 border-0 shadow-2xl bg-white">
            <div className="flex flex-col">
              {/* Invoice Header Actions */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50 no-print sticky top-0 z-10">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-500" />
                  {t('patientTreatments.invoiceDetails.title')}
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-100 text-blue-700 text-[10px] font-black hover:bg-blue-100 transition-all"
                  >
                    <Printer className="w-3.5 h-3.5" /> {t('patientTreatments.invoiceDetails.print')}
                  </button>
                  <button
                    onClick={() => setInvoicePlan(null)}
                    className="p-1.5 rounded-xl hover:bg-slate-200 text-slate-400 transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Invoice Content */}
              <div id="plan-invoice-print" className="p-6 sm:p-8">
                {/* Clinic Header */}
                <div className="flex items-start justify-between mb-6 pb-5 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                      <svg className="w-6 h-6 text-indigo-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C8.7 2 6 4.7 6 8c0 4 3 7 6 10 3-3 6-6 6-10 0-3.3-2.7-6-6-6z" />
                      </svg>
                    </div>
                    <div>
                      <h1 className="text-lg font-black text-slate-900 tracking-tight">DentaCRM</h1>
                      <p className="text-[10px] text-slate-400 font-medium">{t('patientTreatments.invoiceDetails.clinicSubtitle')}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">{t('patientTreatments.invoiceDetails.title').toUpperCase()}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {formatDate(new Date(), language)}
                    </p>
                    <p className="text-[10px] text-slate-300 font-mono">
                      № {invoicePlan.id?.split('-').pop()?.toUpperCase() || 'XXXXX'}
                    </p>
                  </div>
                </div>

                {/* Patient + Plan Info */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">{t('patientTreatments.invoiceDetails.patient')}</p>
                    <p className="text-sm font-black text-slate-900">{invoicePlan.patient_name || '—'}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">{t('patientTreatments.invoiceDetails.plan')}</p>
                    <p className="text-sm font-black text-slate-900 truncate">{formatPlanDepartmentName(invoicePlan, t)}</p>
                    {invoicePlan.tooth_number && (
                      <p className="text-[10px] text-emerald-600 font-bold mt-0.5">{t('patientTreatments.forTooth', { number: invoicePlan.tooth_number })}</p>
                    )}
                  </div>
                </div>

                {/* Services Table */}
                <div className="mb-6">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">{t('patientTreatments.invoiceDetails.servicesList')}</p>
                  <div className="rounded-xl border border-slate-100 overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          <th className="px-3 py-2 text-left text-[9px] font-black text-slate-400 uppercase">{t('patientTreatments.invoiceDetails.plan')}</th>
                          <th className="px-3 py-2 text-center text-[9px] font-black text-slate-400 uppercase">{t('patientTreatments.details.status')}</th>
                          <th className="px-3 py-2 text-right text-[9px] font-black text-slate-400 uppercase">{t('patientTreatments.details.price')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(invoicePlan.services || []).map((svc, i) => (
                          <tr key={i} className="border-b border-slate-50 last:border-0">
                            <td className="px-3 py-2.5">
                              <p className="text-[11px] font-black text-slate-800">{svc.service_name || svc.name || '—'}</p>
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${svc.completed || svc.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-50 text-amber-600'}`}>
                                {svc.completed || svc.payment_status === 'paid' ? t('patientTreatments.invoiceDetails.completed') : t('patientTreatments.invoiceDetails.pending')}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <span className="text-[11px] font-black text-slate-900">{(svc.price || 0).toLocaleString()} {t('common.currency')}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Totals */}
                <div className="space-y-2 border-t border-slate-100 pt-4">
                  {(() => {
                    const servicesTotal = (invoicePlan.services || []).reduce((s, sv) => s + (Number(sv.price) || 0), 0);
                    const discountAmt = Number(invoicePlan.discount_amount) || Math.max(0, servicesTotal - (Number(invoicePlan.total_price) || 0));
                    const discountPct = Number(invoicePlan.discount_percent) || (servicesTotal > 0 ? Math.round((discountAmt / servicesTotal) * 100) : 0);
                    const finalTotal = Number(invoicePlan.total_price) || servicesTotal - discountAmt;
                    const paid = Number(invoicePlan.paid_amount) || 0;
                    const remaining = Math.max(0, finalTotal - paid);
                    return (
                      <>
                        <div className="flex justify-between text-[11px]">
                          <span className="font-bold text-slate-500">{t('patientTreatments.invoiceDetails.subtotal')}</span>
                          <span className="font-black text-slate-800">{servicesTotal.toLocaleString()} {t('common.currency')}</span>
                        </div>
                        {discountAmt > 0 && (
                          <div className="flex justify-between text-[11px]">
                            <span className="font-bold text-amber-600">{t('patientTreatments.invoiceDetails.discount', { percent: discountPct })}</span>
                            <span className="font-black text-amber-600">-{discountAmt.toLocaleString()} {t('common.currency')}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-[12px] border-t border-slate-100 pt-2 mt-1">
                          <span className="font-black text-slate-700">{t('patientTreatments.invoiceDetails.total')}</span>
                          <span className="font-black text-slate-900">{finalTotal.toLocaleString()} {t('common.currency')}</span>
                        </div>
                        {paid > 0 && (
                          <div className="flex justify-between text-[11px]">
                            <span className="font-bold text-emerald-600">{t('patientTreatments.invoiceDetails.paid')}</span>
                            <span className="font-black text-emerald-700">-{paid.toLocaleString()} {t('common.currency')}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-[13px] bg-rose-50 border border-rose-100 rounded-xl px-3 py-2 mt-2">
                          <span className="font-black text-rose-700 uppercase tracking-wide">{t('patientTreatments.invoiceDetails.remaining')}</span>
                          <span className="font-black text-rose-700">{remaining.toLocaleString()} {t('common.currency')}</span>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* Signature */}
                <div className="grid grid-cols-2 gap-8 mt-10 pt-6 border-t border-slate-100">
                  <div>
                    <div className="border-b border-slate-300 mb-2 h-10" />
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">{t('patientTreatments.invoiceDetails.doctorSig')}</p>
                  </div>
                  <div>
                    <div className="border-b border-slate-300 mb-2 h-10" />
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">{t('patientTreatments.invoiceDetails.patientSig')}</p>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export default memo(PatientTreatments);
