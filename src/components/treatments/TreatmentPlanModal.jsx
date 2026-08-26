import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { useTranslation } from '@/i18n/LanguageContext';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  ClipboardList, Check, ArrowLeft, ArrowRight, 
  X, UserCircle2, CheckCircle2, Printer, 
  Search, Download, MessageCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ProfessionalOdontogram from '../patients/ProfessionalOdontogram';
import PatientSelect from '../patients/PatientSelect';
import { cn } from '@/lib/utils';

const idToFdi = (idStr) => {
  if (!idStr) return '';
  const match = String(idStr).match(/^(ur|ul|lr|ll)(\d+)(c)?$/);
  if (!match) return idStr;
  const [, quad, num, isChild] = match;
  const qMap = isChild ? { ur: 5, ul: 6, ll: 7, lr: 8 } : { ur: 1, ul: 2, ll: 3, lr: 4 };
  return `${qMap[quad]}${num}`;
};

const fdiToInternal = (fdi) => {
  const match = String(fdi || '').trim().match(/^([1-8])(\d)$/);
  if (!match) return String(fdi || '');
  const [, quad, num] = match;
  const qMap = { '1': 'ur', '2': 'ul', '3': 'll', '4': 'lr', '5': 'ur', '6': 'ul', '7': 'll', '8': 'lr' };
  const suffix = Number(quad) >= 5 ? 'c' : '';
  return `${qMap[quad]}${num}${suffix}`;
};

const REMOVED_TOOTH_STATUS = 'Olib tashlangan';

const CATEGORY_MAP = {
  'TERAPIYA( ENDO +PLOMBA)': { color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
  'XIRURGIYA': { color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100' },
  'ORTOPEDIYA': { color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100' },
  'ORTODONTIYA': { color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' }
};

const ALLOWED_CATEGORIES = [
  'TERAPIYA( ENDO +PLOMBA)',
  'ORTOPEDIYA',
  'XIRURGIYA',
  'ORTODONTIYA',
  'GIGIENA VA PROFILAKTIKA',
  'ESTETIK STOMATOLOGIYA',
  'BOLALAR STOMATOLOGIYASI',
  'IMPLANTATSIYA',
  'ENDODONTIYA'
];

const autoCategorize = (name) => {
  const n = name?.toLowerCase() || '';
  if (n.includes('implant')) return 'IMPLANTATSIYA';
  if (n.includes('bolalar') || n.includes('child')) return 'BOLALAR STOMATOLOGIYASI';
  if (n.includes('gigiyena') || n.includes('profilaktika') || n.includes('toshlarni') || n.includes('skaler')) return 'GIGIENA VA PROFILAKTIKA';
  if (n.includes('vinir') || n.includes('oqartirish') || n.includes('bleaching') || n.includes('estetik')) return 'ESTETIK STOMATOLOGIYA';
  if (n.includes('endo') || n.includes('kanal')) return 'ENDODONTIYA';
  if (n.includes('olish') || n.includes('sug\'urish') || n.includes('xirurg') || n.includes('anesteziya')) return 'XIRURGIYA';
  if (n.includes('karonka') || n.includes('protez') || n.includes('sirkoniy') || n.includes('ko\'prik')) return 'ORTOPEDIYA';
  if (n.includes('breket') || n.includes('reteyner') || n.includes('plastinka') || n.includes('ortodont')) return 'ORTODONTIYA';
  return 'TERAPIYA( ENDO +PLOMBA)';
};

const getCategoryName = (cat) => {
  if (!cat) return '';
  const c = cat.toUpperCase();
  if (c === 'TERAPIYA( ENDO +PLOMBA)') return 'Terapiya';
  if (c === 'ORTOPEDIYA') return 'Ortopediya';
  if (c === 'ESTETIK STOMATOLOGIYA') return 'Estetika';
  if (c === 'XIRURGIYA') return 'Xirurgiya';
  if (c === 'ORTODONTIYA') return 'Ortodontiya';
  if (c === 'GIGIENA VA PROFILAKTIKA') return 'Gigiyena';
  if (c === 'BOLALAR STOMATOLOGIYASI') return 'Pediatriya';
  if (c === 'IMPLANTATSIYA') return 'Implantatsiya';
  if (c === 'ENDODONTIYA') return 'Endodontiya';
  return cat;
};

const CategoryAccordion = ({ title, services, activeTooth, toothData, toggleService }) => {
  const [open, setOpen] = useState(true);
  const { t } = useTranslation();

  const friendlyTitle = (() => {
    if (title === 'TERAPIYA( ENDO +PLOMBA)') return 'Terapiya';
    if (title === 'ENDODONTIYA') return 'Endodontiya';
    if (title === 'XIRURGIYA') return 'Xirurgiya';
    if (title === 'ORTOPEDIYA') return 'Ortopediya';
    if (title === 'ORTODONTIYA') return 'Ortodontiya';
    if (title === 'GIGIENA VA PROFILAKTIKA') return 'Gigiyena';
    if (title === 'ESTETIK STOMATOLOGIYA') return 'Estetika';
    if (title === 'BOLALAR STOMATOLOGIYASI') return 'Pediatriya';
    if (title === 'IMPLANTATSIYA') return 'Implantatsiya';
    return title;
  })();

  return (
    <div className="border border-slate-100 rounded-lg overflow-hidden bg-white shadow-sm transition-all duration-200">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-3 py-1.5 flex items-center justify-between bg-slate-50/80 hover:bg-slate-100/50 transition-colors border-none"
      >
        <span className="text-[11px] font-black uppercase text-slate-600 tracking-wider">{friendlyTitle}</span>
        <svg 
          className={cn("w-3 h-3 text-slate-400 transition-transform duration-200", open && "rotate-180")} 
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      
      {open && (
        <div className="p-1 space-y-1 divide-y divide-slate-50">
          {services.map(svc => {
            const hasIt = activeTooth !== null && (toothData[activeTooth]?.services || []).some(s => s.service_id === svc.id);
            return (
              <button
                key={svc.id}
                type="button"
                onClick={() => toggleService(activeTooth, svc)}
                className={cn(
                  "w-full px-2.5 py-1.5 flex items-center justify-between text-left rounded-md transition-all border-none",
                  hasIt 
                    ? "bg-emerald-50 text-emerald-800 font-extrabold shadow-inner" 
                    : "hover:bg-slate-50 text-slate-600"
                )}
              >
                <span className="text-[11px] font-bold uppercase truncate mr-2 flex-1">{svc.name}</span>
                <span className="text-[11px] font-black text-emerald-600 shrink-0">{(svc.price || 0).toLocaleString()} {t('common.currency') || "so'm"}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const formatDepartmentPlanName = (services = [], selectedTeeth = []) => {
  const categories = [...new Set(
    (services || [])
      .map((service) => service?.category || autoCategorize(service?.service_name || service?.name))
      .filter(Boolean)
  )];

  const toothLabel = Array.isArray(selectedTeeth) && selectedTeeth.length
    ? ` (#${selectedTeeth.map(idToFdi).join(', ')})`
    : '';

  if (!categories.length) return `Davolash rejasi${toothLabel}`;

  const normalized = categories.map((category) => {
    if (category === 'TERAPIYA( ENDO +PLOMBA)') return 'Terapiya';
    if (category === 'ORTOPEDIYA') return 'Ortopediya';
    if (category === 'XIRURGIYA') return 'Xirurgiya';
    if (category === 'ORTODONTIYA') return 'Ortodontiya';
    if (category === 'GIGIENA VA PROFILAKTIKA') return 'Gigiyena';
    if (category === 'ESTETIK STOMATOLOGIYA') return 'Estetik stomatologiya';
    if (category === 'BOLALAR STOMATOLOGIYASI') return 'Bolalar stomatologiyasi';
    if (category === 'IMPLANTATSIYA') return 'Implantatsiya';
    if (category === 'ENDODONTIYA') return 'Endodontiya';
    return category;
  });

  const compactName = normalized.length > 2
    ? `${normalized.slice(0, 2).join(', ')} +${normalized.length - 2} ta`
    : normalized.join(', ');

  return `${compactName}${toothLabel}`;
};

export default function TreatmentPlanModal({ open, onClose, plan, patients, services, onSaved, initialPatientId }) {
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [patientId, setPatientId] = useState('');
  const [patientName, setPatientName] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [doctors, setDoctors] = useState([]);
  const [selectedTeeth, setSelectedTeeth] = useState([]);
  const [toothData, setToothData] = useState({});
  const [activeTooth, setActiveTooth] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [serviceSearch, setServiceSearch] = useState('');
  const [discount, setDiscount] = useState(0); 
  const [saving, setSaving] = useState(false);
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [availableCategories, setAvailableCategories] = useState([...ALLOWED_CATEGORIES]);
  const [showCustomDiscount, setShowCustomDiscount] = useState(false);
  const [customDiscountAmount, setCustomDiscountAmount] = useState('');
  const [savedPlanData, setSavedPlanData] = useState(null);
  const [isInstallment, setIsInstallment] = useState(false);
  const [installmentMonths, setInstallmentMonths] = useState(6);
  const [installmentAdvance, setInstallmentAdvance] = useState('');
  const [installmentStartDate, setInstallmentStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [installmentServiceKeys, setInstallmentServiceKeys] = useState([]);
  const [removedToothFdis, setRemovedToothFdis] = useState([]);
  const [mobileSubTab, setMobileSubTab] = useState('plan'); // 'plan' or 'services'
  const mobileTeethScrollRef = useRef(null);

  useEffect(() => {
    if (step === 2 && mobileTeethScrollRef.current) {
      setTimeout(() => {
        if (mobileTeethScrollRef.current) {
          const container = mobileTeethScrollRef.current;
          const scrollWidth = container.scrollWidth;
          const clientWidth = container.clientWidth;
          container.scrollLeft = (scrollWidth - clientWidth) / 2;
        }
      }, 100);
    }
  }, [step]);

  useEffect(() => {
    const savedOrder = localStorage.getItem('service_category_order');
    let order = [];
    if (savedOrder) {
      try {
        order = JSON.parse(savedOrder);
      } catch (e) {
        order = [...ALLOWED_CATEGORIES];
      }
    } else {
      order = [...ALLOWED_CATEGORIES];
    }
    const cats = new Set(order);
    (services || []).forEach(s => {
      const cat = s.category || autoCategorize(s.name);
      if (cat && cat !== 'Barchasi' && cat !== 'Asosiy') cats.add(cat);
    });
    ALLOWED_CATEGORIES.forEach(c => cats.add(c));
    const catList = Array.from(cats);
    setAvailableCategories(catList);
  }, [services]);

  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const docs = await base44.entities.User.filter({ role: 'doctor' }, 'name');
        setDoctors(docs || []);
      } catch (err) {
        console.error('Failed to load doctors in TreatmentPlanModal:', err);
      }
    };
    if (open) {
      fetchDoctors();
    }
  }, [open]);

  useEffect(() => {
    if (plan && open) {
      setPatientId(plan.patient_id || '');
      setPatientName(plan.patient_name || '');
      setDoctorId(plan.doctor_id || '');
      
      const disc = Number(plan.discount_percent) || 0;
      setDiscount(disc);
      if (disc > 0 && ![10, 20, 30].includes(disc)) {
        setShowCustomDiscount(true);
        setCustomDiscountAmount(String(disc));
      } else {
        setShowCustomDiscount(false);
        setCustomDiscountAmount('');
      }

      const teeth = plan.tooth_number ? plan.tooth_number.split(',').map(s => s.trim()) : [];
      const internalTeeth = teeth.map(fdiToInternal).filter(Boolean);
      setSelectedTeeth(internalTeeth);
      const td = {};
      const planServices = plan.services || [];
      
      if (internalTeeth.length > 0) {
        internalTeeth.forEach((tInternal) => {
          const originalFdi = idToFdi(tInternal);
          // Match by either internal ID or raw FDI number to support all database formats
          const matchingServices = planServices.filter(s => 
            String(s.tooth) === String(tInternal) || 
            String(s.tooth) === String(originalFdi) ||
            String(s.tooth_number) === String(tInternal) ||
            String(s.tooth_number) === String(originalFdi)
          );
          td[tInternal] = { services: matchingServices };
        });
      } else {
        td[''] = { services: planServices.filter(s => !s.tooth || s.tooth === 'general') };
      }
      setToothData(td);

      if (plan.installment_plan) {
        setIsInstallment(true);
        setInstallmentMonths(plan.installment_plan.months || 6);
        setInstallmentAdvance((Number(plan.installment_plan.advance_payment) || 0) > 0 ? Number(plan.installment_plan.advance_payment) : '');
        setInstallmentStartDate(plan.installment_plan.start_date || new Date().toISOString().split('T')[0]);
        setInstallmentServiceKeys(plan.installment_plan.service_keys || []);
      } else {
        setIsInstallment(false);
      }
      setStep(1);
    } else if (open) { // Modal ochilganda doim reset qilish
      if (initialPatientId) {
        setPatientId(initialPatientId);
        const p = patients?.find(pat => pat.id === initialPatientId);
        if (p) {
          setPatientName(p.full_name);
          setDoctorId(p.main_treatment_provider || '');
        }
        setStep(1);
      } else {
        setStep(1); 
        setPatientId(''); 
        setPatientName('');
        setDoctorId('');
      }
      setSelectedTeeth([]); 
      setSelectedCategory(availableCategories[0] || "");
      setToothData({}); 
      setActiveTooth(null); 
      setDiscount(0);
      setSavedPlanData(null);
      setIsInstallment(false);
      setInstallmentMonths(6);
      setInstallmentAdvance(''); // Boshlang'ich qiymat bo'sh bo'lishi uchun
      setInstallmentStartDate(new Date().toISOString().split('T')[0]);
      setInstallmentServiceKeys([]);
    }
  }, [plan, open, initialPatientId, patients]); 

  useEffect(() => {
    let cancelled = false;

    const loadRemovedTeeth = async () => {
      if (!open || !patientId) {
        setRemovedToothFdis([]);
        return;
      }

      try {
        const records = await base44.entities.ToothRecord.filter({ patient_id: patientId }, 'tooth_number', 200);
        if (cancelled) return;

        const removedFdis = (records || [])
          .filter(record => String(record?.status || '').trim() === REMOVED_TOOTH_STATUS)
          .map(record => String(record?.tooth_number || '').trim())
          .filter(Boolean);

        setRemovedToothFdis(removedFdis);
      } catch (error) {
        if (!cancelled) {
          console.error('Removed teeth load error:', error);
          setRemovedToothFdis([]);
        }
      }
    };

    loadRemovedTeeth();
    return () => { cancelled = true; };
  }, [open, patientId]);

  const isRemovedTooth = useCallback((toothId) => {
    const fdi = String(idToFdi(toothId) || '').trim();
    return Boolean(fdi) && removedToothFdis.includes(fdi);
  }, [removedToothFdis]);

  const applySelectableTeeth = useCallback((teeth, nextActiveTooth = undefined) => {
    const requested = Array.isArray(teeth) ? teeth : [];
    const allowed = requested.filter(tId => !isRemovedTooth(tId));
    const blocked = requested.filter(tId => isRemovedTooth(tId));

    if (blocked.length > 0) {
      toast.error(`Bu tishlar olib tashlangan: ${blocked.map(idToFdi).join(', ')}. Ular uchun xizmat yozib bo'lmaydi.`);
    }

    setSelectedTeeth(allowed);
    setActiveTooth(() => {
      if (nextActiveTooth !== undefined) return nextActiveTooth;
      if (allowed.length === 0) return null;
      return allowed[allowed.length - 1] || null;
    });
  }, [isRemovedTooth]);

  const allSelectedServices = useMemo(() => {
    return Object.entries(toothData).flatMap(([tId, td]) => 
      td.services.map((s, i) => ({ 
        ...s, 
        toothId: tId, 
        key: `${tId}-${s.service_id}-${i}` 
      }))
    );
  }, [toothData]);

  const odontogramStatuses = useMemo(() => {
    const statuses = {};
    
    (removedToothFdis || []).forEach(fdi => {
      const internalId = fdiToInternal(fdi);
      if (internalId) {
        statuses[internalId] = { status: 'extracted', label: "Sug'urilgan" };
      }
    });

    Object.entries(toothData || {}).forEach(([tId, data]) => {
      const servicesList = data?.services || [];
      if (!servicesList.length) return;

      let hasExtracted = false;
      let hasCanal = false;
      let hasFilling = false;
      let hasCaries = false;
      let hasCrown = false;

      servicesList.forEach(svc => {
        const name = String(svc.service_name || svc.name || '').toLowerCase();
        if (name.includes('olish') || name.includes('sug\'urish') || name.includes('ekstraks') || name.includes('extraction')) {
          hasExtracted = true;
        } else if (name.includes('endo') || name.includes('kanal') || name.includes('pulpit')) {
          hasCanal = true;
        } else if (name.includes('plomba') || name.includes('restavratsiya') || name.includes('vinir')) {
          hasFilling = true;
        } else if (name.includes('karonka') || name.includes('toj') || name.includes('crown') || name.includes('protez')) {
          hasCrown = true;
        } else if (name.includes('kariyes') || name.includes('caries') || name.includes('karies')) {
          hasCaries = true;
        }
      });

      let statusKey = 'planned';
      if (hasExtracted) statusKey = 'extracted';
      else if (hasCrown) statusKey = 'crown';
      else if (hasCanal) statusKey = 'completed';
      else if (hasFilling) statusKey = 'completed';
      else if (hasCaries) statusKey = 'caries';

      statuses[tId] = {
        status: statusKey,
        condition: hasCaries ? 'Kariyes' : (hasCanal ? 'Pulpit' : null),
        treatment: hasExtracted ? "Sug'urilgan" : (hasCanal ? 'Kanal' : (hasFilling ? 'Restavratsiya' : (hasCrown ? 'Toj' : 'Davolash'))),
        serviceName: servicesList.map(s => s.service_name || s.name).join(', '),
      };
    });

    return statuses;
  }, [toothData, removedToothFdis]);


  const installmentTotal = useMemo(() => {
    if (!isInstallment) return 0;
    const effectiveKeys = installmentServiceKeys.length === 0
      ? allSelectedServices.map(s => s.key)
      : installmentServiceKeys;

    return allSelectedServices
      .filter(s => effectiveKeys.includes(s.key))
      .reduce((sum, s) => sum + (Number(s.price) || 0), 0);
  }, [allSelectedServices, installmentServiceKeys, isInstallment]);

  const discountedInstallmentTotal = useMemo(() => {
    return Math.floor(installmentTotal * (1 - discount / 100));
  }, [installmentTotal, discount]);

  const filteredServices = useMemo(() => {
    if (!services) return [];
    const q = serviceSearch.trim().toLowerCase();
    return services.filter(s => {
      const cat = s.category || autoCategorize(s.name);
      const matchesCat = !selectedCategory || cat.toLowerCase() === selectedCategory.toLowerCase();
      const matchesSearch = !q || (s.name || '').toLowerCase().includes(q);
      return matchesCat && matchesSearch;
    });
  }, [services, selectedCategory, serviceSearch]);

  const toggleService = (toothNum, svc) => {
    const targets = isBulkMode ? selectedTeeth : [toothNum].filter(Boolean);
    if (targets.length === 0) return;
    const blockedTargets = targets.filter(isRemovedTooth);
    if (blockedTargets.length > 0) {
      toast.error(`Olib tashlangan tish uchun xizmat yozib bo'lmaydi: ${blockedTargets.map(idToFdi).join(', ')}`);
      return;
    }

    setToothData(prev => {
      const next = { ...prev };
      targets.forEach(tId => {
        const td = next[tId] || { services: [] };
        const exists = td.services.find(s => s.service_id === svc.id);
        const newSvcs = exists 
            ? td.services.filter(s => s.service_id !== svc.id) 
            : [...td.services, { 
                service_id: svc.id, 
                service_name: svc.name, 
                category: svc.category || autoCategorize(svc.name),
                price: svc.price, 
                completed: false 
              }];
        next[tId] = { ...td, services: newSvcs };
      });
      return next;
    });
  };

  const removeService = (toothNum, svcId) => {
    setToothData(prev => {
        const td = prev[toothNum];
        if (!td) return prev;
        return { ...prev, [toothNum]: { ...td, services: td.services.filter(s => s.service_id !== svcId) } };
    });
  };

  const toothTotal = (t) => (toothData[t]?.services || []).reduce((s, sv) => s + (sv.price || 0), 0);
  // rawTotal вЂ” barcha tanlangan tishlar VA umumiy xizmatlar yig'indisi
  const rawTotal = Object.keys(toothData).reduce((s, t) => s + toothTotal(t), 0);
  const finalTotal = rawTotal - (rawTotal * (discount / 100));
  const customDiscountPercentValue = Math.max(0, Math.min(100, Number(customDiscountAmount) || 0));
  const customDiscountPreviewAmount = Math.floor((rawTotal * customDiscountPercentValue) / 100);
  const customDiscountPreviewTotal = Math.max(0, Math.floor(rawTotal - customDiscountPreviewAmount));

  const generateInvoicePDF = async () => {
    try {
      toast.info("Rasm tayyorlanmoqda, kuting...", { id: "invoice-download" });
      
      // html2canvas loading logic
      if (!window.html2canvas) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }
      
      const element = document.getElementById('treatment-plan-receipt');
      if (!element) return;

      const canvas = await window.html2canvas(element, {
        scale: 2, 
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });
      
      const link = document.createElement('a');
      link.download = `Invoice_${patientName?.replace(/\s+/g, '_') || 'Patient'}.png`;
      link.href = canvas.toDataURL('image/png', 1.0);
      link.click();
      
      toast.success("Muvaffaqiyatli yuklandi!", { id: "invoice-download" });
    } catch (e) {
      console.error(e);
      toast.error("Yuklashda xatolik yuz berdi", { id: "invoice-download" });
    }
  };  const handleSave = async () => {
    if (!patientId) {
      toast.error('Bemorni tanlang');
      return;
    }
    if (!doctorId) {
      toast.error('Shifokorni tanlang');
      return;
    }
    setSaving(true);
    try {
      const allSvcs = Object.entries(toothData).flatMap(([tId, td]) => 
        td.services.map(s => ({ ...s, tooth: tId === '' ? 'general' : tId }))
      );
      const effectiveInstallmentServiceKeys = isInstallment && installmentServiceKeys.length === 0
        ? allSelectedServices.map(s => s.key)
        : installmentServiceKeys;
      
      const selectedDoc = doctors.find(d => d.id === doctorId);
      const payload = {
        patient_id: patientId,
        patient_name: patientName,
        doctor_id: doctorId,
        doctor_name: selectedDoc?.name || selectedDoc?.full_name || '',
        status: 'planned',
        priority: 'medium',
        tooth_number: selectedTeeth.map(idToFdi).join(', '),
        services: allSvcs,
        total_price: Math.floor(rawTotal * (1 - discount / 100)),
        discount_percent: discount,
        discount_amount: Math.floor(rawTotal * discount / 100),
        notes: `Davolash rejasi: ${selectedTeeth.map(idToFdi).join(', ')} tishlar`,
        installment_plan: isInstallment ? {
          months: installmentMonths,
          advance_payment: installmentAdvance,
          start_date: installmentStartDate,
          monthly_amount: Math.max(0, Math.floor((discountedInstallmentTotal - installmentAdvance) / installmentMonths)),
          total_amount: discountedInstallmentTotal,
          service_keys: effectiveInstallmentServiceKeys,
          paid_months: []
        } : null
      };

      const compactName = formatDepartmentPlanName(allSvcs, selectedTeeth);
      const proposedName = (compactName || 'Davolash rejasi').trim();

      // Duplicate plan check: if creating a new plan, ensure no active plan with the same name exists
      if (!plan) {
        const existingPlans = await base44.entities.TreatmentPlan.filter({ patient_id: patientId });
        const isDuplicate = existingPlans.some(p => 
          p.name?.trim().toLowerCase() === proposedName.toLowerCase() && 
          p.status !== 'completed' && 
          p.status !== 'cancelled'
        );
        if (isDuplicate) {
          toast.error("Ushbu bemorda bunday nomli faol davolash rejasi allaqachon mavjud!");
          setSaving(false);
          return;
        }
      }

      let currentPlan;
      if (plan) {
        currentPlan = await base44.entities.TreatmentPlan.update(plan.id, {
          ...payload,
          name: proposedName
        });
      } else {
        currentPlan = await base44.entities.TreatmentPlan.create({ 
          ...payload, 
          name: proposedName
        });
      }
      
      // --- PROFESSIONAL LINKED DEBT LOGIC ---
      const planId = currentPlan.id;
      const linkedContext = `Linked to Plan: ${planId}`;
      
      // Search for existing debt linked to this plan
      const existingPayments = await base44.entities.Payment.filter({
        patient_id: patientId,
        notes: linkedContext
      });

      const debtPayment = existingPayments.find(p => p.type === 'Debt');
      const discountPayment = existingPayments.find(p => p.type === 'Discount');

      // 1. Manage Debt — chegirma bilan hisoblab saqlaymiz (finalTotal = chegirmali narx)
      const finalTotal = Math.floor(rawTotal * (1 - discount / 100));
      if (finalTotal > 0) {
        if (debtPayment) {
          // Update existing debt with discounted price
          await base44.entities.Payment.update(debtPayment.id, {
            amount: finalTotal,
            doctor_id: doctorId,
            category: `Reja yangilandi: ${selectedTeeth.map(idToFdi).join(', ')}${discount > 0 ? ` (-${discount}% chegirma)` : ''}`,
            date: new Date().toISOString().split('T')[0]
          });
        } else {
          // Create new linked debt with discounted price
          await base44.entities.Payment.create({
            patient_id: patientId,
            patient_name: patientName,
            doctor_id: doctorId,
            type: 'Debt',
            category: `Reja: ${selectedTeeth.map(idToFdi).join(', ')}${discount > 0 ? ` (-${discount}% chegirma)` : ''}`,
            amount: finalTotal,
            method: '—',
            date: new Date().toISOString().split('T')[0],
            notes: linkedContext
          });
        }
      } else if (debtPayment) {
        // If total is now 0, remove the debt
        await base44.entities.Payment.delete(debtPayment.id);
      }

      // 1.1 Manage Advance Payment for Installment
      const advancePayment = existingPayments.find(p => p.category?.includes("Boshlang'ich to'lov"));
      
      if (isInstallment && installmentAdvance > 0) {
        if (!advancePayment) {
          await base44.entities.Payment.create({
            patient_id: patientId,
            patient_name: patientName,
            doctor_id: doctorId,
            type: 'Income',
            category: `Boshlang'ich to'lov: ${currentPlan.name}`,
            amount: installmentAdvance,
            method: 'Cash',
            date: new Date().toISOString().split('T')[0],
            notes: linkedContext
          });
          
          currentPlan.paid_amount = (Number(currentPlan.paid_amount) || 0) + installmentAdvance;
          await base44.entities.TreatmentPlan.update(currentPlan.id, {
            paid_amount: currentPlan.paid_amount
          });
        } else if (advancePayment.amount !== installmentAdvance) {
          await base44.entities.Payment.update(advancePayment.id, {
            amount: installmentAdvance
          });
          
          const delta = installmentAdvance - advancePayment.amount;
          currentPlan.paid_amount = (Number(currentPlan.paid_amount) || 0) + delta;
          await base44.entities.TreatmentPlan.update(currentPlan.id, {
            paid_amount: currentPlan.paid_amount
          });
        }
      } else if (advancePayment) {
        await base44.entities.Payment.delete(advancePayment.id);
        const delta = advancePayment.amount;
        currentPlan.paid_amount = Math.max(0, (Number(currentPlan.paid_amount) || 0) - delta);
        await base44.entities.TreatmentPlan.update(currentPlan.id, {
          paid_amount: currentPlan.paid_amount
        });
      }

      // 2. Manage Discount
      // Endi Debt payment chegirmali narxni o'z ichiga oladi (finalTotal = chegirmali summa)
      // Shuning uchun alohida Discount payment yaratmaymiz вЂ” ikki marta chegirma bo'lmasligi uchun
      // Lekin eski Discount payment mavjud bo'lsa o'chiramiz (legacy cleanup)
      if (discountPayment) {
        await base44.entities.Payment.delete(discountPayment.id);
      }

      // 3. Barcha to'lovlardan qayta hisoblash вЂ” eng aniq natija
      // Debt payment = chegirmali narx, shuning uchun Discount ni qo'shimcha ayirmaymiz
      const allPays = await base44.entities.Payment.filter({ patient_id: patientId }, 'date', 5000);

      const totalDebts    = (allPays || []).filter(p => p.type?.toLowerCase() === 'debt').reduce((s, p) => s + (Number(p.amount) || 0), 0);
      const totalIncomes  = (allPays || []).filter(p => p.type?.toLowerCase() === 'income').reduce((s, p) => s + (Number(p.amount) || 0), 0);
      const totalRefunds  = (allPays || []).filter(p => p.type?.toLowerCase() === 'refund').reduce((s, p) => s + (Number(p.amount) || 0), 0);
      // Discount ni faqat legacy (eski) qarzlarni balanslashtirish uchun ayiramiz
      // Yangi rejalar uchun Debt payment allaqachon chegirmali, shuning uchun qo'shimcha Discount payment yo'q
      const totalDiscounts = (allPays || []).filter(p => p.type?.toLowerCase() === 'discount').reduce((s, p) => s + Math.abs(Number(p.amount) || 0), 0);

      const finalDebt = Math.max(0, (totalDebts + totalRefunds) - (totalIncomes + totalDiscounts));
      const finalPaid = totalIncomes;

      await base44.entities.Patient.update(patientId, {
        total_paid: finalPaid,
        total_debt: finalDebt,
      });

      setSavedPlanData(currentPlan);

      toast.success('Ma\'lumotlar saqlandi');
      if (onSaved) onSaved();
      if (step < 3) setStep(3);
    } catch (e) {
      console.error(e);
      toast.error('Xatolik yuz berdi');
    } finally { 
      setSaving(false); 
    }
  };

  // Step 3 da chegirma o'zgarganda DB ni yangilash
  const applyDiscountOnly = async (newDiscount) => {
    const planToUpdate = savedPlanData || plan;
    if (!planToUpdate?.id) return;
    setSaving(true);
    try {
      const newFinalTotal = Math.floor(rawTotal * (1 - newDiscount / 100));
      
      // Rejani yangilash
      await base44.entities.TreatmentPlan.update(planToUpdate.id, {
        total_price: newFinalTotal,
        discount_percent: newDiscount,
        discount_amount: Math.floor(rawTotal * newDiscount / 100),
      });

      // Debt payment ni yangilash
      const linkedContext = `Linked to Plan: ${planToUpdate.id}`;
      const existingPayments = await base44.entities.Payment.filter({
        patient_id: patientId,
        notes: linkedContext
      });
      const debtPayment = existingPayments.find(p => p.type === 'Debt');
      const discountPayment = existingPayments.find(p => p.type === 'Discount');

      if (newFinalTotal > 0 && debtPayment) {
        await base44.entities.Payment.update(debtPayment.id, {
          amount: newFinalTotal,
          category: `Reja yangilandi${newDiscount > 0 ? ` (-${newDiscount}% chegirma)` : ''}`,
          date: new Date().toISOString().split('T')[0]
        });
      }
      // Legacy discount payment ni o'chirish
      if (discountPayment) {
        await base44.entities.Payment.delete(discountPayment.id);
      }

      // Bemorning umumiy qarzini qayta hisoblash
      const allPays = await base44.entities.Payment.filter({ patient_id: patientId }, 'date', 5000);
      const totalDebts   = (allPays || []).filter(p => p.type?.toLowerCase() === 'debt').reduce((s, p) => s + (Number(p.amount) || 0), 0);
      const totalIncomes = (allPays || []).filter(p => p.type?.toLowerCase() === 'income').reduce((s, p) => s + (Number(p.amount) || 0), 0);
      const totalRefunds = (allPays || []).filter(p => p.type?.toLowerCase() === 'refund').reduce((s, p) => s + (Number(p.amount) || 0), 0);
      const totalDiscounts = (allPays || []).filter(p => p.type?.toLowerCase() === 'discount').reduce((s, p) => s + Math.abs(Number(p.amount) || 0), 0);
      const finalDebt = Math.max(0, (totalDebts + totalRefunds) - (totalIncomes + totalDiscounts));
      await base44.entities.Patient.update(patientId, { total_debt: finalDebt, total_paid: totalIncomes });

      setDiscount(newDiscount);
      setSavedPlanData(prev => prev ? { ...prev, total_price: newFinalTotal, discount_percent: newDiscount } : prev);
      toast.success(`Chegirma ${newDiscount > 0 ? `${newDiscount}%` : "olib tashlandi"} вЂ” narh yangilandi`);
      if (onSaved) onSaved();
    } catch (e) {
      console.error(e);
      toast.error('Chegirma saqlashda xatolik');
    } finally {
      setSaving(false);
    }
  };



  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="!p-0 w-[95vw] sm:w-[94vw] md:w-[90vw] max-w-4xl h-[90vh] max-h-[90vh] flex flex-col overflow-hidden rounded-[2.5rem] border-0 shadow-2xl bg-white gap-0 !left-[50%] !top-[50%] !translate-x-[-50%] !translate-y-[-50%]" aria-describedby={undefined}>
        
        {/* Gradient Header */}
        <div className="bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 px-6 py-4 flex items-center justify-between shrink-0 rounded-t-[2.5rem] text-white no-print">
          <div className="flex items-center gap-3">
            {step > 1 ? (
              <button 
                onClick={() => {
                  if (step > 1) setStep(step - 1);
                }}
                className="w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 text-white flex items-center justify-center backdrop-blur-sm transition-all active:scale-95 border-none cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
              </button>
            ) : (
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white backdrop-blur-sm shadow-sm">
                <ClipboardList className="w-5 h-5 stroke-[2.5]" />
              </div>
            )}
            <div>
              <DialogTitle className="text-base font-black text-white uppercase tracking-tight">
                {plan ? t('treatmentPlan.editPlan') : t('treatmentPlan.createNew')}
              </DialogTitle>
              <p className="text-[9px] font-bold text-white/80 uppercase tracking-widest mt-0.5">{t('treatmentPlan.subtitle') || 'Bemorga davolash rejasi tayinlash'}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-sm transition-all active:scale-95 border-none cursor-pointer"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Stepper (Matching Onboarding style) */}
        <div className="bg-white border-b border-slate-100 px-4 py-3.5 shrink-0 z-10 shadow-sm no-print">
          <div className="flex items-center justify-center gap-0">
            {[
              { id: 1, label: t('odontogram.steps.patient') || 'BEMOR', icon: UserCircle2 },
              { id: 2, label: t('odontogram.steps.plan') || 'REJA', icon: ClipboardList },
              { id: 3, label: t('odontogram.steps.finish') || 'YAKUN', icon: CheckCircle2 }
            ].map((s, i, arr) => {
              const Icon = s.icon;
              const done = step > s.id;
              const active = step === s.id;
              return (
                <div key={s.id} className="flex items-center">
                  <div className="flex flex-col items-center gap-1 min-w-[60px]">
                    <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300
                      ${done ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-100' :
                        active ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-105' :
                        'bg-slate-100 border-slate-200 text-slate-400'}`}>
                      {done && !active ? <Check className="w-4 h-4 stroke-[3px]" /> : <Icon className="w-3.5 h-3.5 sm:w-5 sm:h-5" />}
                    </div>
                    <span className={`text-[9px] sm:text-[11px] font-bold uppercase tracking-wider ${active || done ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {s.label}
                    </span>
                  </div>
                  {i < arr.length - 1 && (
                    <div className={`h-[2px] w-12 sm:w-20 mx-[-4px] mb-5 rounded transition-colors duration-300 ${step > s.id ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Main Content */}
        <div className={`flex-1 min-h-0 bg-slate-50/20 ${step === 2 ? 'overflow-hidden' : 'overflow-y-auto no-scrollbar p-4 sm:p-6'}`}>
            <AnimatePresence mode="wait">
                {step === 1 && (
                    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }} className="max-w-md mx-auto space-y-4 pt-4 pb-8">
                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-center">
                            <p className="text-slate-700 font-bold uppercase tracking-wider text-[11px]">{t('odontogram.step1Title') || '1-bosqich: Bemor va shifokorni tanlang'}</p>
                        </div>
                        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                            <div className="space-y-2.5 relative z-20">
                                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">{t('odontogram.patientSearch') || 'Bemor qidirish *'}</Label>
                                <PatientSelect 
                                    patients={patients} value={patientId}
                                    onChange={(id, pat) => { 
                                      setPatientId(id); 
                                      setPatientName(pat?.full_name || ''); 
                                      if (pat?.main_treatment_provider) {
                                        setDoctorId(pat.main_treatment_provider);
                                      }
                                    }}
                                    inputClassName="h-11 rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-4 font-semibold text-slate-800 text-sm focus:bg-white transition-colors"
                                />
                            </div>
                            <div className="space-y-2.5 relative z-10">
                                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">{t('payments.doctor') || 'Shifokor *'}</Label>
                                <Select value={doctorId} onValueChange={setDoctorId}>
                                    <SelectTrigger className="h-11 rounded-xl border border-slate-200 bg-slate-50 font-semibold text-slate-800 text-sm focus:bg-white transition-colors">
                                        <SelectValue placeholder={t('payments.doctorPlaceholder') || 'Shifokorni tanlang'} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {doctors.map(doc => (
                                            <SelectItem key={doc.id} value={doc.id}>
                                                {doc.name || doc.full_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </motion.div>
                )}

                {step === 2 && (() => {
                    const UPPER_RIGHT = ['18', '17', '16', '15', '14', '13', '12', '11'];
                    const UPPER_LEFT  = ['21', '22', '23', '24', '25', '26', '27', '28'];
                    const LOWER_RIGHT = ['48', '47', '46', '45', '44', '43', '42', '41'];
                    const LOWER_LEFT  = ['31', '32', '33', '34', '35', '36', '37', '38'];

                    const upperRight = UPPER_RIGHT;
                    const upperLeft  = UPPER_LEFT;
                    const lowerRight = LOWER_RIGHT;
                    const lowerLeft  = LOWER_LEFT;

                    const ToothBtn = ({ fdi }) => {
                      const internalId = fdiToInternal(String(fdi));
                      const isSelected = selectedTeeth.includes(internalId);
                      const isActive   = activeTooth === internalId;
                      const isDisabled = removedToothFdis.map(fdiToInternal).filter(Boolean).includes(internalId);
                      return (
                        <button
                          type="button"
                          disabled={isDisabled}
                          onClick={() => {
                            if (isDisabled) { toast.error(`Tish #${fdi} olib tashlangan.`); return; }
                            const isActive = activeTooth === internalId;
                            let next;
                            if (isActive) {
                              next = selectedTeeth.filter(t => t !== internalId);
                            } else {
                              next = selectedTeeth.includes(internalId)
                                ? selectedTeeth
                                : [...selectedTeeth, internalId];
                            }
                            applySelectableTeeth(next, next.includes(internalId) ? internalId : null);
                          }}
                          className={cn(
                            "w-6 sm:w-7 md:w-[25px] lg:w-7 h-7 sm:h-8 rounded-lg flex items-center justify-center text-[10px] sm:text-[11px] font-black transition-all cursor-pointer leading-none shrink-0 p-0 border",
                            isDisabled  ? "bg-slate-100 text-slate-350 border-slate-200 cursor-not-allowed" :
                            isActive    ? "bg-[#1499AD] text-white border-[#1499AD] ring-2 ring-[#1499AD]/30 shadow-md shadow-[#1499AD]/10 scale-105" :
                            isSelected  ? "bg-emerald-500 text-white border-emerald-500 shadow-sm" :
                                          "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                          )}
                        >
                          <span className="text-[10px] sm:text-[11px] font-black">{fdi}</span>
                        </button>
                      );
                    };

                    return (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                      className="h-full bg-white overflow-hidden"
                    >
                      <div className="hidden md:flex flex-row h-full w-full overflow-hidden">
                        <div className="flex-[0_0_62%] flex flex-col border-r border-slate-100 overflow-hidden bg-white min-h-0">
                          <div className="pl-6 pr-4 py-2 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
                            <span className="text-[12px] font-bold text-slate-700">{t('odontogram.labelTreatments') || 'Davolash rejasi'}</span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-medium text-slate-500">{t('treatmentPlan.patient') || 'Bemor'}: {patientName}</span>
                            </div>
                          </div>
                          <div className="shrink-0 bg-[#fafafa] border-b border-slate-100 py-2.5 px-3 overflow-x-auto no-scrollbar touch-pan-x">
                            <div className="w-full mx-auto">
                              <ProfessionalOdontogram
                                selectedTeeth={selectedTeeth}
                                onChange={() => {}}
                                onToothClick={(toothId) => {
                                  const isDisabled = removedToothFdis.map(fdiToInternal).filter(Boolean).includes(toothId);
                                  if (isDisabled) {
                                    toast.error(`Tish #${idToFdi(toothId)} olib tashlangan.`);
                                    return;
                                  }
                                  const isActive = activeTooth === toothId;
                                  let next;
                                  if (isActive) {
                                    next = selectedTeeth.filter(t => t !== toothId);
                                  } else {
                                    next = selectedTeeth.includes(toothId)
                                      ? selectedTeeth
                                      : [...selectedTeeth, toothId];
                                  }
                                  applySelectableTeeth(next, next.includes(toothId) ? toothId : null);
                                }}
                                multi={true}
                                toothStatuses={odontogramStatuses}
                                disabledTeeth={removedToothFdis.map(fdiToInternal).filter(Boolean)}
                                hideHeader={true}
                                hideLegend={true}
                                hideStats={true}
                              />
                            </div>
                            <div className="flex items-center justify-center gap-1 mt-2 flex-wrap">
                              {upperRight.map(n => <ToothBtn key={n} fdi={n} />)}
                              <span className="text-slate-300 mx-0.5">|</span>
                              {upperLeft.map(n => <ToothBtn key={n} fdi={n} />)}
                              <span className="text-slate-300 mx-1">/</span>
                              {lowerRight.map(n => <ToothBtn key={n} fdi={n} />)}
                              <span className="text-slate-300 mx-0.5">|</span>
                              {lowerLeft.map(n => <ToothBtn key={n} fdi={n} />)}
                            </div>
                          </div>
                          <div className="pl-6 pr-4 py-1.5 bg-slate-50 border-b border-slate-100 grid grid-cols-[minmax(0,1fr)_32px_64px_40px_64px_18px] gap-1 shrink-0">
                            <span className="text-[9px] font-black text-slate-400 uppercase">{t('odontogram.tableHeaders.service') || 'Xizmat'}</span>
                            <span className="text-[9px] font-black text-slate-400 uppercase text-center">{t('odontogram.tableHeaders.tooth') || 'T#'}</span>
                            <span className="text-[9px] font-black text-slate-400 uppercase text-right">{t('odontogram.tableHeaders.price') || 'Narx'}</span>
                            <span className="text-[9px] font-black text-slate-400 uppercase text-center">%</span>
                            <span className="text-[9px] font-black text-slate-400 uppercase text-right">{t('odontogram.tableHeaders.total') || 'Jami'}</span>
                            <span />
                          </div>
                          <div className="flex-1 overflow-y-auto min-h-0">
                            {allSelectedServices.length === 0 ? (
                              <div className="flex flex-col items-center justify-center h-full gap-1.5 text-slate-300 py-10">
                                <ClipboardList className="w-7 h-7" />
                                <p className="text-[11px] font-bold">{t('odontogram.errors.noServiceSelected') || 'Xizmat tanlanmagan'}</p>
                              </div>
                            ) : (
                              allSelectedServices.map((s, idx) => {
                                const discPrice = Math.floor((s.price || 0) * (1 - discount / 100));
                                return (
                                  <div
                                    key={idx}
                                    onClick={() => setActiveTooth(s.toothId)}
                                    className={cn(
                                      "pl-6 pr-4 py-1.5 grid grid-cols-[minmax(0,1fr)_32px_64px_40px_64px_18px] gap-1 items-center border-b border-slate-50 cursor-pointer transition-colors",
                                      activeTooth === s.toothId ? "bg-blue-50" : "hover:bg-slate-50"
                                    )}
                                  >
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <span className="text-[10px] font-medium text-slate-700 truncate">{s.service_name}</span>
                                    </div>
                                    <span className="text-[10px] text-slate-500 text-center font-bold">{idToFdi(s.toothId)}</span>
                                    <span className="text-[10px] text-slate-600 text-right">{(s.price||0).toLocaleString()}</span>
                                    <span className="text-[10px] text-slate-400 text-center">{discount > 0 ? `${discount}%` : '—'}</span>
                                    <span className="text-[10px] font-bold text-slate-900 text-right">{discPrice.toLocaleString()}</span>
                                    <button type="button"
                                      onClick={e => { e.stopPropagation(); toggleService(s.toothId, { id: s.service_id, name: s.service_name, price: s.price }); }}
                                      className="w-4 h-4 rounded-full hover:bg-red-50 flex items-center justify-center text-slate-300 hover:text-red-400 transition-colors border-none bg-transparent cursor-pointer p-0">
                                      <X className="w-2.5 h-2.5" />
                                    </button>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                        <div className="flex-1 flex flex-col overflow-hidden bg-white min-h-0">
                            <div className="pl-3 pr-6 py-2 border-b border-slate-100 shrink-0">
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-[11px] font-bold text-slate-600">Narxlar ro'yxati</span>
                                </div>
                                <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-2.5 h-7 border border-slate-100">
                                    <Search className="w-3 h-3 text-slate-300 shrink-0" />
                                    <input type="text" value={serviceSearch} onChange={e => setServiceSearch(e.target.value)}
                                        placeholder="Xizmat qidirish..."
                                        className="flex-1 bg-transparent border-none text-[11px] text-slate-700 placeholder:text-slate-300 outline-none font-medium" />
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto pl-2 pr-4 pt-1.5 pb-6 space-y-1 min-h-0">
                                {(() => {
                                    const allSvcs = serviceSearch.trim()
                                        ? (services||[]).filter(s => (s.name||'').toLowerCase().includes(serviceSearch.trim().toLowerCase()))
                                        : (services||[]);
                                    const grouped = {};
                                    allSvcs.forEach(svc => {
                                        const cat = svc.category || autoCategorize(svc.name);
                                        if (!grouped[cat]) grouped[cat] = [];
                                        grouped[cat].push(svc);
                                    });

                                    const savedOrder = localStorage.getItem('service_category_order');
                                    let order = [];
                                    if (savedOrder) {
                                      try { order = JSON.parse(savedOrder); } catch (e) {}
                                    }
                                    const entries = Object.entries(grouped);
                                    entries.sort(([a], [b]) => {
                                      const ai = order.indexOf(a);
                                      const bi = order.indexOf(b);
                                      if (ai !== -1 && bi !== -1) return ai - bi;
                                      if (ai !== -1) return -1;
                                      if (bi !== -1) return 1;
                                      return a.localeCompare(b);
                                    });

                                    return entries.map(([cat, svcs]) => (
                                        <CategoryAccordion key={cat} title={cat} services={svcs}
                                            activeTooth={activeTooth} toothData={toothData} toggleService={toggleService} />
                                    ));
                                })()}
                            </div>
                        </div>
                      </div>

                      {/* === MOBILE VIEW === */}
                      <div className="flex md:hidden flex-col h-full w-full overflow-hidden bg-white">
                        {/* Header */}
                        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <button
                              type="button"
                              onClick={() => setStep(1)}
                              className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-center text-slate-500 active:bg-slate-100 transition-all cursor-pointer p-0 shrink-0"
                            >
                              <ArrowLeft className="w-4 h-4" />
                            </button>
                            <div className="min-w-0">
                              <h3 className="text-xs font-black uppercase text-slate-800 tracking-tight truncate">
                                {patientName || "Bemor ismi"}
                              </h3>
                              <p className="text-[9px] font-bold text-[#1499AD] uppercase tracking-wider mt-0.5 leading-none">
                                Davolash Rejasi
                              </p>
                            </div>
                          </div>
                          
                          <button
                            type="button"
                            onClick={onClose}
                            className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-center text-slate-400 active:bg-slate-100 transition-all cursor-pointer p-0 shrink-0"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Top: 2-row anatomical tooth selector */}
                        <div 
                          ref={mobileTeethScrollRef}
                          className="overflow-x-auto py-2 px-1 no-scrollbar scrollbar-none shrink-0 select-none"
                        >
                          <div className="min-w-[560px] flex flex-col gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200">

                            {/* YUQORI JAG' */}
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex gap-1.5">
                                {UPPER_RIGHT.map(num => <ToothBtn key={num} fdi={num} />)}
                              </div>
                              <div className="w-[2px] h-10 bg-sky-500 rounded-full" />
                              <div className="flex gap-1.5">
                                {UPPER_LEFT.map(num => <ToothBtn key={num} fdi={num} />)}
                              </div>
                            </div>

                            {/* PASTKI JAG' */}
                            <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-200">
                              <div className="flex gap-1.5">
                                {LOWER_RIGHT.map(num => <ToothBtn key={num} fdi={num} />)}
                              </div>
                              <div className="w-[2px] h-10 bg-sky-500 rounded-full" />
                              <div className="flex gap-1.5">
                                {LOWER_LEFT.map(num => <ToothBtn key={num} fdi={num} />)}
                              </div>
                            </div>

                          </div>
                        </div>

                        {/* Active Tooth Info Status Bar */}
                        <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex justify-between items-center shrink-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs">🦷</span>
                            <span className="text-[11px] font-black uppercase tracking-tight text-slate-700">
                              {activeTooth ? `#${idToFdi(activeTooth)}-tish tanlandi` : 'Tish tanlanmagan'}
                            </span>
                          </div>
                          {activeTooth && (
                            <span className="text-[9px] bg-blue-50 text-blue-600 font-black px-2 py-0.5 rounded-full border border-blue-100">
                              {(toothData[activeTooth]?.services || []).length} ta xizmat
                            </span>
                          )}
                        </div>

                        {/* Collapsible active treatments summary list */}
                        {allSelectedServices.length > 0 && (
                          <div className="px-4 py-2 bg-slate-50/80 border-b border-slate-100 shrink-0">
                            <details className="group">
                              <summary className="list-none flex items-center justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest cursor-pointer select-none">
                                <span className="flex items-center gap-1.5">
                                  📋 Tanlangan xizmatlar ({allSelectedServices.length})
                                </span>
                                <svg 
                                  className="w-3 h-3 text-slate-400 transition-transform group-open:rotate-180" 
                                  viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                                >
                                  <polyline points="6 9 12 15 18 9" />
                                </svg>
                              </summary>
                              <div className="mt-2 space-y-1 max-h-[140px] overflow-y-auto pr-1 no-scrollbar pb-1">
                                {allSelectedServices.map((s, idx) => (
                                  <div key={idx} className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-100 shadow-sm text-left gap-2">
                                    <div className="min-w-0 flex-1">
                                      <span className="text-[9px] font-black text-blue-500 uppercase mr-1.5">Tish #{idToFdi(s.toothId)}</span>
                                      <span className="text-[10px] font-bold text-slate-700 uppercase tracking-tight truncate block sm:inline">{s.service_name}</span>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <span className="text-[10px] font-black text-emerald-600">{(s.price || 0).toLocaleString()} so'm</span>
                                      <button 
                                        type="button"
                                        onClick={() => toggleService(s.toothId, { id: s.service_id, name: s.service_name, price: s.price })}
                                        className="w-6 h-6 rounded-lg bg-red-50 text-red-500 flex items-center justify-center border-none cursor-pointer active:bg-red-100 transition-all shrink-0 p-0"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </details>
                          </div>
                        )}

                        {/* Search Input */}
                        <div className="px-4 py-2 bg-white border-b border-slate-100 shrink-0">
                          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/70 rounded-xl px-3 h-9">
                            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <input 
                              type="text" 
                              value={serviceSearch} 
                              onChange={e => setServiceSearch(e.target.value)}
                              placeholder="Xizmatlarni qidirish..."
                              className="flex-1 bg-transparent border-none text-[11px] text-slate-800 placeholder:text-slate-400 outline-none font-semibold" 
                            />
                            {serviceSearch && (
                              <button 
                                type="button" 
                                onClick={() => setServiceSearch('')} 
                                className="text-slate-400 hover:text-slate-600 border-none bg-transparent cursor-pointer p-0 shrink-0"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Categories scroll chips */}
                        <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-2 px-4 bg-white border-b border-slate-100 shrink-0 touch-pan-x">
                          <button
                            type="button"
                            onClick={() => setSelectedCategory("")}
                            className={cn(
                              "px-3.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all border shrink-0 cursor-pointer",
                              selectedCategory === "" 
                                ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                                : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                            )}
                          >
                            Barchasi
                          </button>
                          {availableCategories.map(cat => {
                            const displayName = getCategoryName(cat);
                            const isSelected = selectedCategory.toLowerCase() === cat.toLowerCase();
                            return (
                              <button
                                key={cat}
                                type="button"
                                onClick={() => setSelectedCategory(cat)}
                                className={cn(
                                  "px-3.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all border shrink-0 cursor-pointer",
                                  isSelected 
                                    ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                                    : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                                )}
                              >
                                {displayName}
                              </button>
                            );
                          })}
                        </div>

                        {/* Middle: Service cards list */}
                        <div className="flex-1 overflow-y-auto px-4 py-3 bg-[#f8fafc] space-y-2.5 min-h-0">
                          {(() => {
                            const filtered = services.filter(s => {
                              const cat = (s.category || autoCategorize(s.name)).toLowerCase().trim();
                              const q = serviceSearch.trim().toLowerCase();
                              const qMatch = !q || (s.name || '').toLowerCase().includes(q);
                              if (!qMatch) return false;
                              
                              if (!selectedCategory || selectedCategory === "" || selectedCategory === "all" || selectedCategory === "barchasi") {
                                return true;
                              }
                              
                              const sel = selectedCategory.toLowerCase().trim();
                              const selName = getCategoryName(selectedCategory).toLowerCase().trim();
                              return cat === sel || cat === selName || (cat.includes(sel) && sel.length > 3) || (sel.includes(cat) && cat.length > 3);
                            });
                            
                            if (filtered.length === 0) {
                              return (
                                <div className="text-center py-10 text-slate-400 text-xs italic uppercase tracking-wider">
                                  Xizmatlar topilmadi
                                </div>
                              );
                            }
                            
                            return filtered.map(svc => {
                              const isAdded = activeTooth !== null && (toothData[activeTooth]?.services || []).some(s => s.service_id === svc.id);
                              return (
                                <div
                                  key={svc.id}
                                  onClick={
                                    activeTooth 
                                      ? () => toggleService(activeTooth, svc)
                                      : () => toast.error("Avval tish xaritasidan tishni tanlang!")
                                  }
                                  className={cn(
                                    "p-3 px-3.5 bg-white rounded-2xl border transition-all duration-200 flex items-center justify-between gap-3 shadow-sm cursor-pointer select-none active:scale-[0.99]",
                                    isAdded 
                                      ? "border-emerald-500 bg-emerald-50/15 shadow-emerald-500/5" 
                                      : "border-slate-100 hover:border-slate-350 hover:bg-slate-50/30"
                                  )}
                                >
                                  <div className="min-w-0 flex-1">
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">
                                      {getCategoryName(svc.category || autoCategorize(svc.name))}
                                    </span>
                                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight leading-snug">
                                      {svc.name}
                                    </h4>
                                  </div>
                                  
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-xs font-extrabold text-slate-900 whitespace-nowrap">
                                      {(svc.price || 0).toLocaleString()} so'm
                                    </span>
                                    {isAdded && (
                                      <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 animate-in zoom-in-50 duration-150">
                                        <Check className="w-3 h-3 stroke-[3px]" />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </div>

                        {/* Bottom Sticky Bar */}
                        <div className="p-4 border-t border-slate-150 bg-white flex flex-col gap-3 shrink-0 shadow-lg sticky bottom-0 z-50">
                          <div className="flex justify-between items-end px-1">
                            <div className="flex flex-col text-left">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">
                                Rejada: {allSelectedServices.length} ta muolaja
                              </span>
                              <div className="flex items-center gap-1 mt-1">
                                <span className="text-lg font-black text-slate-900 tabular-nums">
                                  {Math.floor(rawTotal * (1 - discount/100)).toLocaleString()}
                                </span>
                                <span className="text-[10px] text-slate-400 font-bold">so'm</span>
                                {discount > 0 && (
                                  <span className="text-[10px] text-slate-400 line-through ml-1 font-medium tabular-nums">
                                    {rawTotal.toLocaleString()}
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            {discount > 0 && (
                              <div className="flex items-center gap-1">
                                <span className="text-[9px] font-bold text-slate-400 uppercase">Chegirma: </span>
                                <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                                  {discount}%
                                </span>
                              </div>
                            )}
                          </div>
                          
                          <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving || allSelectedServices.length === 0}
                            className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white font-black uppercase text-xs tracking-wider rounded-xl shadow-md border-none flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-[0.98] transition-all"
                          >
                            {saving ? (
                              <>
                                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                                Saqlanmoqda...
                              </>
                            ) : (
                              <>
                                Saqlash va Yakunlash <Check className="w-4.5 h-4.5 stroke-[3px]" />
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })()}


                {step === 3 && (
                    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="max-w-3xl mx-auto space-y-6 pb-20 px-4 sm:px-0">

                        {/* PROFESSIONAL INVOICE */}
                        <div id="treatment-plan-receipt" className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-xl relative">
                            {/* Print Styles */}
                            {open && (
                              <style dangerouslySetInnerHTML={{__html:`
                               @media print {
                                .no-print { display: none !important; }
                                #root { display: none !important; }
                                body { visibility: hidden !important; background: white !important; margin: 0 !important; padding: 0 !important; }
                                [data-radix-portal], [data-radix-portal] * { visibility: hidden !important; }
                                
                                #treatment-plan-receipt { 
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
                                
                                #treatment-plan-receipt * { 
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

                            {/* -- INVOICE HEADER -- */}
                            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-6 py-5">
                                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                                    {/* Clinic branding */}
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shadow-lg">
                                            <span className="text-white font-black text-xl leading-none tracking-tight">D</span>
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-black text-white tracking-tight uppercase leading-none">DentaCRM</h2>
                                            <p className="text-[9px] font-medium text-white/50 mt-0.5">Professional Dental System</p>
                                            <p className="text-[8px] font-bold text-white/30 uppercase tracking-widest mt-0.5">+998 71 123 45 67</p>
                                        </div>
                                    </div>
                                    {/* Invoice meta */}
                                    <div className="bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-right min-w-[160px]">
                                        <p className="text-[8px] font-black text-white/40 uppercase tracking-[0.2em] mb-1">Hujjat turi</p>
                                        <p className="text-[11px] font-black text-white uppercase tracking-tight">Hisob-Faktura</p>
                                        <div className="h-px bg-white/10 my-2" />
                                        <p className="text-[8px] text-white/40 font-medium">
                                            {new Date().toLocaleDateString('uz-UZ', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                                        </p>
                                        <p className="text-[9px] font-black text-white/70 mt-0.5">
                                            No. {savedPlanData?.id ? savedPlanData.id.split('-').pop()?.toUpperCase() : (plan?.id ? plan.id.split('-').pop()?.toUpperCase() : 'NEW')}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="p-5 space-y-5">
                                {/* -- PATIENT INFO -- */}
                                <div className="grid grid-cols-3 gap-4 bg-slate-50 rounded-xl border border-slate-100 px-4 py-3">
                                    <div>
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1">To'liq ismi</p>
                                        <p className="text-[12px] font-black text-slate-900 uppercase leading-tight">{patientName}</p>
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1">Qabul vaqti</p>
                                        <p className="text-[11px] font-black text-slate-800">
                                            {new Date().toLocaleDateString('uz-UZ')} {new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1">Muolaja turi</p>
                                        <p className="text-[11px] font-black text-slate-800">Davolash rejasi</p>
                                    </div>
                                </div>

                                {/* -- SERVICES TABLE -- */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="text-[9px] font-black text-blue-500 uppercase tracking-[0.2em]">Davolashlar ro'yxati</h4>
                                        <span className="text-[8px] text-slate-400 font-medium">{selectedTeeth.reduce((acc, tId) => acc + (toothData[tId]?.services?.length || 0), 0)} ta xizmat</span>
                                    </div>
                                    {/* Table header */}
                                    <div className="grid grid-cols-[auto_1fr_auto] gap-3 px-3 py-2 bg-slate-900 rounded-t-xl">
                                        <span className="text-[8px] font-black text-white/40 uppercase tracking-widest">Tish</span>
                                        <span className="text-[8px] font-black text-white/40 uppercase tracking-widest">Xizmat nomi</span>
                                        <span className="text-[8px] font-black text-white/40 uppercase tracking-widest text-right">Narxi</span>
                                    </div>
                                    {/* Table rows */}
                                    <div className="border border-t-0 border-slate-100 rounded-b-xl overflow-hidden divide-y divide-slate-50">
                                        {selectedTeeth.map(tId => {
                                            const svcs = toothData[tId]?.services || [];
                                            return svcs.map((s, idx) => (
                                                <div key={`${tId}-${idx}`} className="grid grid-cols-[auto_1fr_auto] gap-3 items-center px-3 py-2.5 bg-white hover:bg-slate-50/50 transition-colors">
                                                    <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center">
                                                        <span className="text-[9px] font-black text-blue-600">#{idToFdi(tId)}</span>
                                                    </div>
                                                    <span className="text-[11px] font-bold text-slate-800 uppercase tracking-tight truncate">{s.service_name}</span>
                                                    <span className="text-[11px] font-black text-slate-900 text-right whitespace-nowrap">{(s.price || 0).toLocaleString()} <span className="text-[9px] font-medium text-slate-400">so'm</span></span>
                                                </div>
                                            ));
                                        })}
                                    </div>
                                </div>

                                {/* -- BO'LIB TO'LASH -- */}
                                {isInstallment && (
                                    <div>
                                        <h4 className="text-[9px] font-black text-blue-500 uppercase tracking-[0.2em] mb-2">Bo'lib to'lash rejasi</h4>
                                        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 grid grid-cols-2 sm:grid-cols-4 gap-4">
                                            <div>
                                                <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-1">Muddat</p>
                                                <p className="text-[12px] font-black text-blue-900">{installmentMonths} <span className="text-[9px] font-medium">oy</span></p>
                                            </div>
                                            <div>
                                                <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-1">Boshlang'ich</p>
                                                <p className="text-[12px] font-black text-emerald-700">{installmentAdvance.toLocaleString()} <span className="text-[9px] font-medium">so'm</span></p>
                                            </div>
                                            <div>
                                                <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-1">Oylik to'lov</p>
                                                <p className="text-[12px] font-black text-blue-800">
                                                    {Math.max(0, Math.floor((rawTotal * (1 - discount/100) - installmentAdvance) / installmentMonths)).toLocaleString()} <span className="text-[9px] font-medium">so'm</span>
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-1">Boshlanish</p>
                                                <p className="text-[12px] font-black text-blue-900">{installmentStartDate}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* -- TOTALS BLOCK -- */}
                                <div className="bg-slate-900 rounded-2xl p-5 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500 rounded-full blur-[70px] opacity-10 -mr-16 -mt-16 pointer-events-none" />
                                    <div className="relative z-10 space-y-2.5">
                                        {/* Subtotal */}
                                        {(discount > 0 || (isInstallment && installmentAdvance > 0)) && (
                                            <div className="flex justify-between items-center pb-2 border-b border-white/10">
                                                <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Jami summa</p>
                                                <p className="text-[12px] font-black text-white">{rawTotal.toLocaleString()} <span className="text-[9px] font-normal text-white/40">so'm</span></p>
                                            </div>
                                        )}
                                        {/* Discount */}
                                        {discount > 0 && (
                                            <div className="flex justify-between items-center pb-2 border-b border-white/10">
                                                <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Chegirma ({discount}%)</p>
                                                <p className="text-[12px] font-black text-rose-400">- {Math.floor(rawTotal * discount / 100).toLocaleString()} <span className="text-[9px] font-normal text-rose-400/60">so'm</span></p>
                                            </div>
                                        )}
                                        {/* Advance */}
                                        {isInstallment && installmentAdvance > 0 && (
                                            <div className="flex justify-between items-center pb-2 border-b border-white/10">
                                                <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Boshlang'ich to'lov</p>
                                                <p className="text-[12px] font-black text-emerald-400">- {installmentAdvance.toLocaleString()} <span className="text-[9px] font-normal text-emerald-400/60">so'm</span></p>
                                            </div>
                                        )}
                                        {/* Final total */}
                                        <div className="flex justify-between items-end pt-1">
                                            <div>
                                                <p className="text-[8px] font-black text-blue-400 uppercase tracking-[0.2em] mb-1.5">To'lov uchun qolgan jami</p>
                                                <h3 className="text-2xl font-[950] text-white tracking-tighter tabular-nums leading-none">
                                                    {Math.max(0, Math.floor(finalTotal) - (isInstallment ? installmentAdvance : 0)).toLocaleString()}
                                                    <span className="text-xs font-normal text-white/40 ml-1.5">so'm</span>
                                                </h3>
                                            </div>
                                            <div className="flex flex-col items-end gap-1.5">
                                                <div className="px-3 py-1.5 bg-emerald-500/15 border border-emerald-500/25 rounded-lg flex items-center gap-1.5">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                                    <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">TASDIQLANDI</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* в”Ђв”Ђ TELEGRAM REMINDER в”Ђв”Ђ */}
                                <div className="bg-blue-50 border border-blue-100/60 rounded-xl p-3.5 flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 bg-white rounded-xl border border-blue-100 flex items-center justify-center shadow-sm shrink-0">
                                            <MessageCircle className="w-4 h-4 text-blue-500" />
                                        </div>
                                        <div>
                                            <h5 className="text-[10px] font-black text-blue-900 uppercase tracking-wide">Telegram Eslatmalar</h5>
                                            <p className="text-[8px] font-medium text-blue-400 mt-0.5">QR-kod orqali botga ulanish mumkin</p>
                                        </div>
                                    </div>
                                    <div className="w-11 h-11 bg-white p-1 rounded-lg border border-blue-100 shrink-0">
                                        <div className="w-full h-full bg-slate-100 rounded-sm" />
                                    </div>
                                </div>

                                {/* в”Ђв”Ђ SIGNATURES в”Ђв”Ђ */}
                                <div className="grid grid-cols-2 gap-12 pt-6 mt-2 border-t border-dashed border-slate-200">
                                    <div className="text-center">
                                        <div className="h-10 mb-2" />
                                        <div className="h-px bg-slate-300 border-0" />
                                        <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mt-1.5">Shifokor imzosi</p>
                                    </div>
                                    <div className="text-center">
                                        <div className="h-10 mb-2" />
                                        <div className="h-px bg-slate-300 border-0" />
                                        <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mt-1.5">Bemor imzosi</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        {/* Bottom Actions Section - after invoice */}
                        <div className="grid grid-cols-2 gap-3 mt-5 max-w-xl mx-auto no-print">
                             <Button 
                                onClick={async () => {
                                    await handleSave();
                                    await generateInvoicePDF();
                                }} 
                                className="h-10 bg-emerald-500 hover:bg-emerald-600 text-white font-bold uppercase text-[10px] tracking-wider rounded-xl shadow-md border-none gap-1.5"
                             >
                                <Download className="w-4 h-4" /> {t('odontogram.actions.saveDownload') || 'SAQLASH & YUKLASH'}
                             </Button>
                             <Button onClick={() => window.print()} className="h-10 bg-blue-500 hover:bg-blue-600 text-white font-bold uppercase text-[10px] tracking-wider rounded-xl shadow-md border-none gap-1.5">
                                <Printer className="w-4 h-4" /> {t('odontogram.actions.print') || 'PRINT'}
                             </Button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>

        <div className={cn(
          "p-3 sm:p-4.5 border-t border-slate-100 bg-white flex items-center justify-between shrink-0 mb-safe pointer-events-auto sticky bottom-0 z-50 shadow-sm no-print",
          step === 2 && "hidden md:flex"
        )}>
             <div className="hidden sm:block">
                 {step > 1 && (
                     <Button variant="outline" onClick={() => setStep(step - 1)} className="h-9.5 w-9.5 rounded-lg text-slate-400 p-0 hover:bg-slate-50 border-slate-200">
                         <ArrowLeft className="w-4 h-4" />
                     </Button>
                 )}
             </div>
             <div className="flex items-center gap-3 w-full sm:w-auto">
                {step > 1 && step < 3 && (
                     <Button variant="outline" onClick={() => setStep(step - 1)} className="sm:hidden h-10 w-10 rounded-xl text-slate-450 border-slate-200 p-0">
                         <ArrowLeft className="w-4.5 h-4.5" />
                     </Button>
                )}
                
                {step < 3 ? (
                     <Button 
                         onClick={step === 1 ? () => setStep(2) : handleSave}
                         disabled={(step === 1 && (!patientId || !doctorId)) || saving}
                         className={`h-11 flex-1 sm:px-12 rounded-xl font-bold uppercase text-[11px] tracking-wider transition-all flex items-center justify-center gap-2 border-none shadow-md ${
                              step === 1 
                              ? 'bg-slate-900 text-white shadow-slate-900/10' 
                              : 'bg-[#10b981] text-white shadow-emerald-500/10'
                         }`}
                     >
                         {saving ? (
                             <span className="flex items-center gap-2">
                                 <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full" />
                                 {t('odontogram.states.saving') || 'Saqlanmoqda...'}
                             </span>
                         ) : (
                             step === 1 ? (
                                 <>{t('odontogram.actions.next') || 'Davom etish'} <ArrowRight className="w-3.5 h-3.5" /></>
                             ) : (
                                 <>{t('odontogram.actions.saveFinish') || 'Saqlash & Yakunlash'} <Check className="w-3.5 h-3.5 stroke-[3px]" /></>
                             )
                         )}
                     </Button>
                ) : (
                     <Button onClick={onClose} className="h-11 w-full sm:px-12 rounded-xl bg-slate-900 text-white font-bold uppercase text-[11.5px] tracking-wider shadow-md shadow-slate-900/10 hover:bg-slate-800">{t('odontogram.actions.close') || 'Yopish'}</Button>
                )}
             </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
