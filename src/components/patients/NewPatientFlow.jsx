import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { QRCodeSVG } from 'qrcode.react';
import {
  bootstrapTelegramBotConfig,
  getEnvBotUsername,
  parseBotTechData,
  resolveBotUsernameFromConfig,
} from '@/lib/telegramBotConfig';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, User, ClipboardList, ArrowLeft, Printer, Download, X, Check, Plus, MessageCircle, Copy, Share2, Percent, Calendar, QrCode, Phone, Mail, AlertTriangle, Search } from 'lucide-react';
import { useTranslation } from '@/i18n/LanguageContext';
import { applyPhoneMask, cn, capitalizeName, validateAddress, capitalizeAsYouType } from '@/lib/utils';

/**
 * Wizard steps configuration
 */
const STEPS = [
  { id: 1, label: 'patients.wizard.patient', icon: User },
  { id: 2, label: 'patients.wizard.plan', icon: ClipboardList },
  { id: 3, label: 'patients.wizard.done', icon: CheckCircle2 },
];

/**
 * Helper to translate tooth shortcodes to human readable text
 */
const formatToothName = (toothStr, t) => {
  if (!toothStr) return '—';
  if (toothStr === 'Umumiy' || String(toothStr).toLowerCase() === 'general') return t('common.general');
  
  const match = String(toothStr).match(/^(ur|ul|lr|ll)(\d+)(c)?$/);
  if (!match) return toothStr; 
  
  const [, quad, num] = match;
  const positions = {
    ur: t('patients.teeth.ur'),
    ul: t('patients.teeth.ul'),
    lr: t('patients.teeth.lr'),
    ll: t('patients.teeth.ll')
  };
  
  return `${positions[quad]} ${num}-${t('patients.teeth.tooth')}`;
};

/**
 * Convert shortcode to standard FDI numbering
 */
const idToFdi = (idStr) => {
  if (!idStr || String(idStr).toLowerCase() === 'general') return '';
  const match = String(idStr).match(/^(ur|ul|lr|ll)(\d+)(c)?$/);
  if (!match) return String(idStr);
  const [, quad, num, isChild] = match;
  if (isChild) {
    const qMap = { ur: 5, ul: 6, ll: 7, lr: 8 };
    return `${qMap[quad]}${num}`;
  } else {
    const qMap = { ur: 1, ul: 2, ll: 3, lr: 4 };
    return `${qMap[quad]}${num}`;
  }
};

/**
 * NewPatientFlow Component
 * 
 * Multi-step wizard for adding new patients with optional treatment plan creation.
 * Creates separate treatment plans per tooth with automatic debt tracking.
 * 
 * @param {Object} props
 * @param {boolean} props.open - Dialog open state
 * @param {Function} props.onClose - Close callback
 * @param {Function} props.onSaved - Success callback
 */
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

const fdiToInternal = (fdi) => {
  const match = String(fdi || '').trim().match(/^([1-8])(\d)$/);
  if (!match) return String(fdi || '');
  const [, quad, num] = match;
  const qMap = { '1': 'ur', '2': 'ul', '3': 'll', '4': 'lr', '5': 'ur', '6': 'ul', '7': 'll', '8': 'lr' };
  const suffix = Number(quad) >= 5 ? 'c' : '';
  return `${qMap[quad]}${num}${suffix}`;
};

const CategoryAccordion = ({ title, services, activeTooth, toothData, toggleService, isBulkMode, selectedTeeth }) => {
  const [open, setOpen] = useState(true);

  const friendlyTitle = (() => {
    if (title === 'TERAPIYA( ENDO +PLOMBA)') return 'Therapy';
    if (title === 'ENDODONTIYA') return 'Endodontia';
    if (title === 'XIRURGIYA') return 'Surgery';
    if (title === 'ORTOPEDIYA') return 'Orthopedics';
    if (title === 'ORTODONTIYA') return 'Orthodontics';
    if (title === 'GIGIENA VA PROFILAKTIKA') return 'Hygiene';
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
            const targets = isBulkMode ? selectedTeeth : [activeTooth].filter(Boolean);
            const hasIt = targets.length > 0 && targets.every(tId => 
              (toothData[tId]?.services || []).some(s => s.service_id === svc.id)
            );

            return (
              <button
                key={svc.id}
                type="button"
                onClick={() => toggleService(svc)}
                className={cn(
                  "w-full px-2.5 py-1.5 flex items-center justify-between text-left rounded-md transition-all border-none",
                  hasIt 
                    ? "bg-emerald-50 text-emerald-800 font-extrabold shadow-inner" 
                    : "hover:bg-slate-50 text-slate-600"
                )}
              >
                <span className="text-[11px] font-bold uppercase truncate mr-2 flex-1">{svc.name}</span>
                <span className="text-[11px] font-black text-emerald-600 shrink-0">{(svc.price || 0).toLocaleString()} so'm</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const EditableSelect = ({ value, onChange, placeholder, options, type = "text", maxLength, onValidate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = (e) => {
    const val = e.target.value;
    if (onValidate) {
      onValidate(val);
    } else {
      onChange(val);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <input
          type={type}
          value={value}
          onChange={handleInputChange}
          placeholder={placeholder}
          maxLength={maxLength}
          className="h-10 rounded-lg text-sm border border-slate-200 focus:border-slate-400 focus:ring-0 w-full pr-8 pl-3 outline-none transition-colors"
        />
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="absolute right-0 h-full px-2.5 text-slate-400 hover:text-slate-600 border-none bg-transparent flex items-center justify-center cursor-pointer"
        >
          <svg className={cn("w-4 h-4 transition-transform duration-200", isOpen && "rotate-180")} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-[220px] overflow-y-auto py-1 no-print">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              className={cn(
                "w-full px-3 py-2 text-left text-sm hover:bg-slate-50 transition-colors border-none",
                String(value) === String(opt.value) ? "bg-emerald-50 text-emerald-700 font-bold" : "text-slate-600"
              )}
            >
              {opt.label}
            </button>
          ))}
          {options.length === 0 && (
            <div className="px-3 py-2 text-xs text-slate-400 italic">Tanlovlar yo'q</div>
          )}
        </div>
      )}
    </div>
  );
};

export default function NewPatientFlow({ open, onClose, onSaved, prefillData }) {
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [savingError, setSavingError] = useState(null);
  const [services, setServices] = useState([]);
  const [createdPatient, setCreatedPatient] = useState(null);
  const [createdPlan, setCreatedPlan] = useState(null);
  const [botUsername, setBotUsername] = useState(''); // Telegram bot username (without @)
  const [showQr, setShowQr] = useState(false);
  const [clinicInfo, setClinicInfo] = useState(null);
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
    if (!open) return;
    const fetchClinic = async () => {
      try {
        const data = await base44.clinic.getCurrentClinic();
        if (data) setClinicInfo(data);
      } catch (err) {
        console.error('Failed to fetch clinic in NewPatientFlow:', err);
      }
    };
    fetchClinic();
  }, [open]);

  const dayOptions = useMemo(() => 
    Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) })),
  []);

  const monthOptions = useMemo(() => [
    { value: '1', label: '1 - Yanvar' },
    { value: '2', label: '2 - Fevral' },
    { value: '3', label: '3 - Mart' },
    { value: '4', label: '4 - Aprel' },
    { value: '5', label: '5 - May' },
    { value: '6', label: '6 - Iyun' },
    { value: '7', label: '7 - Iyul' },
    { value: '8', label: '8 - Avgust' },
    { value: '9', label: '9 - Sentyabr' },
    { value: '10', label: '10 - Oktyabr' },
    { value: '11', label: '11 - Noyabr' },
    { value: '12', label: '12 - Dekabr' }
  ], []);

  const yearOptions = useMemo(() => 
    Array.from({ length: 100 }, (_, i) => {
      const y = String(new Date().getFullYear() - i);
      return { value: y, label: y };
    }),
  []);

  const handleDayValidate = useCallback((val) => {
    const num = val.replace(/\D/g, '');
    if (num === '' || Number(num) <= 31) {
      setPatientForm(prev => ({ ...prev, birth_day: num }));
    }
  }, []);

  const handleMonthValidate = useCallback((val) => {
    const num = val.replace(/\D/g, '');
    if (num === '' || Number(num) <= 12) {
      setPatientForm(prev => ({ ...prev, birth_month: num }));
    }
  }, []);

  const handleYearValidate = useCallback((val) => {
    const num = val.replace(/\D/g, '');
    if (num === '' || (num.length <= 4 && Number(num) <= new Date().getFullYear())) {
      setPatientForm(prev => ({ ...prev, birth_year: num }));
    }
  }, []);

  const getTelegramDeepLink = useCallback((patientId) => {
    if (!patientId) return '';
    const username = String(botUsername || '').replace(/^@/, '').trim();
    if (!username) return '';
    return `https://t.me/${username}?start=${patientId}`;
  }, [botUsername]);

  // Load BotConfig to get current Telegram bot username (so link is NOT hardcoded)
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    bootstrapTelegramBotConfig();

    const envUsername = getEnvBotUsername();
    if (envUsername) {
      setBotUsername(envUsername);
    }

    (async () => {
      try {
        const response = await base44.get('/BotConfig');
        const list = Array.isArray(response?.data) ? response.data : (response?.data ? [response.data] : []);
        const currentClinicId = (localStorage.getItem('current_clinic_id') || localStorage.getItem('clinic_id') || '').toLowerCase();
        const normalizeClinicId = (v) => String(v || '').toLowerCase().trim().replace(/[-_]/g, '');

        // Prefer config for current clinic (if exists), otherwise fallback to any.
        const clinicFiltered = currentClinicId
          ? list.filter((x) => normalizeClinicId(x?.clinic_id) === normalizeClinicId(currentClinicId))
          : list;

        const pickFrom = clinicFiltered.length ? clinicFiltered : list;

        // Find first config that has bot username either as a field or inside [TECH_DATA]
        const cfg = pickFrom.find((x) => {
          const direct = x?.botUsername || x?.bot_username;
          if (direct) return true;
          const tech = parseBotTechData(x?.notes);
          return Boolean(tech?.botUsername || tech?.bot_username || tech?.botToken || tech?.bot_token);
        }) || pickFrom[0] || null;

        const tech = parseBotTechData(cfg?.notes);
        const resolvedUsername = await resolveBotUsernameFromConfig(cfg, tech);
        if (!cancelled && resolvedUsername) {
          setBotUsername(resolvedUsername);
          return;
        }

        // Legacy fallback: old systems stored BotConfig inside Note.notes as [TECH_DATA]
        try {
          const noteRes = await base44.get('/Note');
          const notes = Array.isArray(noteRes?.data) ? noteRes.data : [];
          const candidates = notes
            .map((n) => ({ n, tech: parseBotTechData(n?.notes) }))
            .filter(({ tech }) => Boolean(tech?.botUsername || tech?.bot_username || tech?.botToken || tech?.bot_token));

          const newest = candidates.sort((a, b) => {
            const dA = a?.n?.created_date || a?.n?.created_at || '';
            const dB = b?.n?.created_date || b?.n?.created_at || '';
            return String(dB).localeCompare(String(dA));
          })[0];

          const legacyUsername = await resolveBotUsernameFromConfig(null, newest?.tech);
          if (!cancelled && legacyUsername) {
            setBotUsername(legacyUsername);
          }
        } catch {
          // ignore
        }
      } catch (e) {
        if (!cancelled && envUsername) {
          setBotUsername(envUsername);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  // Step 1: Patient form
  const [patientForm, setPatientForm] = useState({
    photo_url: '',
    first_name: '',
    last_name: '',
    status: 'New',
    phone: '',
    phone_secondary: '',
    email: '',
    address: '',
    gender: 'Unspecified',
    birth_day: '',
    birth_month: '',
    birth_year: '',
    important_info: '',
    comment: '',
    payer: '',
    discount_percent: '',
    contact: '',
    main_treatment_provider: '',
    card_number: '',
    registration_date: new Date().toLocaleDateString('uz-UZ') // e.g. "17.07.2026"
  });

  const [doctors, setDoctors] = useState([]);

  // Focused tooth state for Step 2
  const [activeTooth, setActiveTooth] = useState(null);
  const [activeCategory, setActiveCategory] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [serviceSearch, setServiceSearch] = useState('');
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [patientType, setPatientType] = useState('adult');

  // Step 2: Treatment plan form
  const [planForm, setPlanForm] = useState({
    name: '', 
    priority: 'Medium', 
    tooth_numbers: [],
    services: [], 
    total_price: 0, 
    notes: ''
  });

  const [discountPercent, setDiscountPercent] = useState(0);
  const [appliedDiscountAmount, setAppliedDiscountAmount] = useState(0);
  const [discountPaymentId, setDiscountPaymentId] = useState(null);
  const [showCustomDiscount, setShowCustomDiscount] = useState(false);
  const [customDiscountAmount, setCustomDiscountAmount] = useState('');

  // Installment Plan State
  const [isInstallment, setIsInstallment] = useState(false);
  const [installmentMonths, setInstallmentMonths] = useState(3);
  const [installmentAdvance, setInstallmentAdvance] = useState('');
  const [installmentStartDate, setInstallmentStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [installmentDay, setInstallmentDay] = useState(new Date().getDate());
  const [installmentServiceKeys, setInstallmentServiceKeys] = useState([]); // Array of strings like "toothId:serviceId"

  // Per-tooth data: { [toothNum]: { services: [], expanded: true } }
  const [toothData, setToothData] = useState({});
  const [mobileSubTab, setMobileSubTab] = useState('plan'); // 'plan' or 'services'


  const normalizedFirstName = capitalizeName((patientForm.first_name || '').trim());
  const normalizedLastName = capitalizeName((patientForm.last_name || '').trim());
  const normalizedPatientName = `${normalizedLastName} ${normalizedFirstName}`.trim();
  const normalizedPatientPhone = (patientForm.phone || '').replace(/\D/g, '');
  const canProceedPatientStep = normalizedFirstName.length > 0 && normalizedLastName.length > 0 && normalizedPatientPhone.length >= 9;

  const createdPlanAdvanceTotal = useMemo(() => {
    if (createdPlan?.allPlansObjects?.length) {
      return createdPlan.allPlansObjects.reduce((sum, plan) => {
        return sum + (Number(plan?.installment_plan?.advance_payment) || 0);
      }, 0);
    }

    return Number(createdPlan?.installment_plan?.advance_payment) || Number(installmentAdvance) || 0;
  }, [createdPlan, installmentAdvance]);

  useEffect(() => {
    if (open) {
      setStep(1);
      setSavingError(null);
      setCreatedPatient(null);
      setCreatedPlan(null);
      // Pre-fill from lead data if provided
      setPatientForm({
        photo_url: '',
        first_name: prefillData?.first_name || prefillData?.full_name?.split(' ').slice(1).join(' ') || '',
        last_name: prefillData?.last_name || prefillData?.full_name?.split(' ')[0] || '',
        status: 'New',
        phone: prefillData?.phone || '',
        phone_secondary: '',
        email: prefillData?.email || '',
        address: prefillData?.address || '',
        gender: 'Unspecified',
        birth_day: '',
        birth_month: '',
        birth_year: '',
        important_info: '',
        comment: prefillData?.notes || '',
        payer: '',
        discount_percent: '',
        contact: prefillData?.source || '',
        main_treatment_provider: '',
        card_number: '',
        registration_date: new Date().toLocaleDateString('uz-UZ') // format: DD.MM.YYYY
      });
      setPlanForm({ 
        name: '', 
        priority: 'Medium', 
        tooth_numbers: [], 
        services: [], 
        total_price: 0, 
        notes: '' 
      });
      setToothData({});
      setActiveTooth(null);
      setActiveCategory('');
      setIsBulkMode(false);
      setPatientType('adult');
      setDiscountPercent(0);
      setDiscountPaymentId(null);
      setShowCustomDiscount(false);
      setCustomDiscountAmount('');
      
      // Load doctors
      base44.entities.User.list('name', 100)
        .then(users => {
          const docList = (users || []).filter(u => 
            u.role?.toLowerCase() === 'doctor' || 
            u.role?.toLowerCase() === 'admin'
          );
          setDoctors(docList);
        })
        .catch(err => console.error("Failed to load doctors:", err));

      base44.entities.Service.filter({ is_active: true }, 'name', 100).then(data => {
        const seen = new Map();
        (data || []).forEach(s => {
          const key = s.name?.toLowerCase().trim();
          if (!key) return;
          if (!seen.has(key)) {
            seen.set(key, s);
          }
        });
        const loadedServices = Array.from(seen.values());
        setServices(loadedServices);
        if (loadedServices.length > 0 && !activeCategory) {
          const firstCat = loadedServices.find(s => s.category && s.category !== 'Asosiy' && s.category !== 'Barchasi')?.category;
          setActiveCategory(firstCat || loadedServices[0].category || 'Terapiya');
        }
      });
      setIsInstallment(false);
      setInstallmentMonths(3);
      setInstallmentAdvance('');
      setInstallmentStartDate(new Date().toISOString().split('T')[0]);
      setInstallmentDay(new Date().getDate());
      setInstallmentServiceKeys([]);
    }
  }, [open, prefillData]);

  /**
   * Auto-fill plan name when patient name changes
   */
  useEffect(() => {
    if (normalizedPatientName && step === 1) {
      setPlanForm(prev => ({ 
        ...prev, 
        name: `${normalizedPatientName} — Davolash rejasi` 
      }));
    }
  }, [normalizedPatientName, step]);

  /**
   * Handle tooth selection
   */
  const handleTeethChange = useCallback((teeth) => {
    setPlanForm(prev => ({ ...prev, tooth_numbers: teeth }));
    setToothData(prev => {
      const next = {};
      teeth.forEach(t => { 
        next[t] = prev[t] || { services: [], expanded: true }; 
      });
      return next;
    });
  }, []);

  /**
   * Toggle service for one or many teeth
   */
  const toggleToothService = useCallback((service) => {
    const targets = isBulkMode ? planForm.tooth_numbers : [activeTooth].filter(Boolean);
    if (targets.length === 0 && !isBulkMode) return;
    
    setToothData(prev => {
      const next = { ...prev };
      targets.forEach(tId => {
        const td = next[tId] || { services: [], expanded: true };
        const exists = td.services.find(s => s.service_id === service.id);
        
        if (exists) {
          next[tId] = {
            ...td,
            services: td.services.filter(s => s.service_id !== service.id)
          };
        } else {
          next[tId] = {
            ...td,
            services: [...td.services, { 
              service_id: service.id, 
              service_name: service.name, 
              price: service.price 
            }]
          };
        }
      });
      return next;
    });
  }, [isBulkMode, planForm.tooth_numbers, activeTooth]);

  /**
   * Toggle tooth section expansion
   */
  const toggleExpand = useCallback((tooth) => {
    setToothData(prev => ({ 
      ...prev, 
      [tooth]: { ...prev[tooth], expanded: !prev[tooth]?.expanded } 
    }));
  }, []);

  /**
   * Calculate tooth total
   */
  const toothTotal = useCallback((t) => {
    return (toothData[t]?.services || []).reduce((s, sv) => s + (sv.price || 0), 0);
  }, [toothData]);

  /**
   * Calculate grand total
   */
  const grandTotal = useMemo(() => {
    const teethSum = planForm.tooth_numbers.reduce((s, t) => s + toothTotal(t), 0);
    return teethSum + toothTotal('general');
  }, [planForm.tooth_numbers, toothTotal]);

  const receiptBaseTotal = Number(createdPlan?.total_price || grandTotal || 0);
  const customDiscountPercentValue = Math.max(0, Math.min(100, Number(customDiscountAmount) || 0));
  const customDiscountPreviewAmount = Math.round((receiptBaseTotal * customDiscountPercentValue) / 100);
  const customDiscountPreviewTotal = Math.max(0, receiptBaseTotal - customDiscountPreviewAmount);

  /**
   * Memoize all currently selected services across all teeth
   */
  const allSelectedServices = useMemo(() => {
    const list = [];
    Object.keys(toothData).forEach(toothId => {
      (toothData[toothId]?.services || []).forEach(s => {
        list.push({ 
          ...s, 
          toothId, 
          key: `${toothId}:${s.service_id}` 
        });
      });
    });
    return list;
  }, [toothData]);

  /**
   * Calculate total for services included in installment
   */
  const installmentTotal = useMemo(() => {
    const effectiveKeys = isInstallment && installmentServiceKeys.length === 0
      ? allSelectedServices.map(s => s.key)
      : installmentServiceKeys;

    return allSelectedServices
      .filter(s => effectiveKeys.includes(s.key))
      .reduce((sum, s) => sum + (s.price || 0), 0);
  }, [allSelectedServices, installmentServiceKeys, isInstallment]);

  /**
   * Toggle all services for installment
   */
  const handleToggleInstallment = useCallback((checked) => {
    setIsInstallment(checked);
    if (checked) {
      // Auto-select all current services when turning ON
      setInstallmentServiceKeys(allSelectedServices.map(s => s.key));
    } else {
      setInstallmentServiceKeys([]);
    }
  }, [allSelectedServices]);

  const handlePhotoChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPatientForm(prev => ({ ...prev, photo_url: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const handleSavePatient = useCallback(async () => {
    if (!canProceedPatientStep) {
      if (!normalizedLastName) {
        toast.error('Familiya kiritilishi shart');
        return;
      }
      if (!normalizedFirstName) {
        toast.error('Ism kiritilishi shart');
        return;
      }
      toast.error('Telefon raqami kiritilishi shart');
      return;
    }
    if (patientForm.address && !validateAddress(patientForm.address)) {
      toast.error("Iltimos, manzilni to'g'ri kiriting (masalan: Toshkent sh., Chilonzor tumani)");
      return;
    }
    setSaving(true);
    setSavingError(null);
    try {
      const birthDate = (patientForm.birth_year && patientForm.birth_month && patientForm.birth_day)
        ? `${patientForm.birth_year}-${String(patientForm.birth_month).padStart(2, '0')}-${String(patientForm.birth_day).padStart(2, '0')}`
        : '';

      const notesText = [
        patientForm.important_info ? `⚠️ MUHIM OGOHLANTIRISH: ${patientForm.important_info}` : '',
        patientForm.comment ? `Izoh: ${patientForm.comment}` : ''
      ].filter(Boolean).join('\n');

      const payload = {
        photo_url: patientForm.photo_url || '',
        first_name: normalizedFirstName,
        last_name: normalizedLastName,
        full_name: normalizedPatientName,
        status: patientForm.status || 'New',
        phone: normalizedPatientPhone,
        phone_secondary: (patientForm.phone_secondary || '').replace(/\D/g, ''),
        email: patientForm.email || '',
        address: patientForm.address || '',
        gender: patientForm.gender || 'Unspecified',
        birth_date: birthDate,
        important_info: patientForm.important_info || '',
        comment: patientForm.comment || '',
        payer: patientForm.payer || '',
        discount_percent: Number(patientForm.discount_percent) || 0,
        contact: patientForm.contact || '',
        main_treatment_provider: patientForm.main_treatment_provider || '',
        card_number: patientForm.card_number || '',
        registration_date: patientForm.registration_date || '',
        notes: notesText
      };

      const patient = await base44.entities.Patient.create(payload);
      if (patient?.error) {
        setSavingError(patient.error);
        toast.error("Xatolik: " + patient.error);
        return;
      }
      
      // Lead yaratish - agar "Qayerdan topdi" (contact) tanlangan bo'lsa
      if (patientForm.contact) {
        try {
          await base44.entities.Lead.create({
            name: normalizedPatientName,
            phone: patientForm.phone,
            source: patientForm.contact,
            status: 'converted',
            notes: `Bemor ro'yxatdan o'tdi. Manba: ${patientForm.contact}`,
          });
        } catch (leadError) {
          console.error('Lead yaratishda xatolik:', leadError);
        }
      }
      
      setCreatedPatient(patient);
      onSaved?.(patient);
      toast.success("Bemor saqlandi. Endi davolash rejasini qo'shishingiz mumkin.");
      setStep(2);
    } catch (error) {
      console.error('Failed to create patient:', error);
      setSavingError(error.message || "Xatolik yuz berdi");
      toast.error(error.message || "Xatolik yuz berdi");
    } finally {
      setSaving(false);
    }
  }, [patientForm, canProceedPatientStep, normalizedFirstName, normalizedLastName, normalizedPatientName, normalizedPatientPhone, onSaved]);

  /**
   * Save treatment plan (Step 2)
   * Davolash rejasini yaratadi, to'lovni (qarz) qo'shadi va bemor statistikani yangilaydi
   */
  const handleSavePlan = useCallback(async () => {
    setSaving(true);
    setSavingError(null);
    let teethList = [...planForm.tooth_numbers];
    if (toothData['general']?.services?.length > 0) {
      teethList.push('general');
    }
    if (teethList.length === 0) {
      teethList.push(null); // empty plan fallback
    }

    let lastPlan = null;
    let allCreatedPlans = [];
    let totalDebt = 0;
    const today = new Date().toISOString();

    try {
      const effectiveInstallmentServiceKeys = isInstallment && installmentServiceKeys.length === 0
        ? allSelectedServices.map(s => s.key)
        : installmentServiceKeys;

      // Consolidate all services across all teeth into a single array
      const consolidatedServices = [];
      const teethNumbersUsed = [];

      teethList.forEach(tooth => {
        const svcs = tooth ? (toothData[tooth]?.services || []) : [];
        const fdiNum = tooth ? idToFdi(tooth) : '';
        svcs.forEach((s, sIdx) => {
          consolidatedServices.push({
            ...s,
            service_id: s.service_id || `svc_${tooth}_${sIdx}_${Date.now()}`,
            tooth_number: tooth === 'general' ? '' : String(fdiNum || tooth)
          });
        });
        if (tooth && tooth !== 'general') {
          teethNumbersUsed.push(fdiNum || tooth);
        }
      });

      const price = consolidatedServices.reduce((s, sv) => s + (sv.price || 0), 0);
      const teethSuffix = teethNumbersUsed.length > 0 ? ` (#${teethNumbersUsed.join(', ')})` : '';

      // Consolidate name
      const allSvcNames = consolidatedServices.map(s => s.service_name || s.name).filter(Boolean);
      const MAX_SHOW = 2;
      const serviceNames = allSvcNames.length > MAX_SHOW
        ? allSvcNames.slice(0, MAX_SHOW).join(', ') + ` +& ${allSvcNames.length - MAX_SHOW} ta`
        : allSvcNames.join(', ');

      const displayCategory = planForm.name || (serviceNames ? `${serviceNames}${teethSuffix}` : "Davolash rejasi");

      // 1. Create a single treatment plan containing all services
      const planDiscountAmt = Math.round((price * discountPercent) / 100);
      const planFinalPrice = Math.max(0, price - planDiscountAmt);

      const plan = await base44.entities.TreatmentPlan.create({
        name: displayCategory,
        patient_id: createdPatient.id,
        patient_name: createdPatient.full_name,
        status: 'Planned',
        priority: planForm.priority || 'Medium',
        total_price: planFinalPrice,
        discount_amount: planDiscountAmt,
        discount_percent: discountPercent,
        paid_amount: isInstallment ? (installmentAdvance || 0) : 0,
        notes: planForm.notes,
        start_date: today,
        tooth_number: teethNumbersUsed.join(', '),
        services: consolidatedServices,
        installment_plan: isInstallment ? {
          total: installmentTotal,
          months: installmentMonths,
          advance_payment: installmentAdvance,
          start_date: installmentStartDate,
          payment_day: installmentDay,
          monthly_amount: Math.round((installmentTotal - installmentAdvance) / installmentMonths),
          service_ids: consolidatedServices.map(s => s.service_id)
        } : null
      });

      if (!plan || plan.error) {
        throw new Error(plan?.error || 'Reja yaratishda xatolik yuz berdi');
      }

      plan.services = consolidatedServices;
      lastPlan = plan;
      allCreatedPlans.push(plan);
      const linkedContext = `Linked to Plan: ${plan.id}`;

      // 2. Create single Payment (Debt) for the combined plan
      if (price > 0) {
        await base44.entities.Payment.create({
          patient_id: createdPatient.id,
          patient_name: createdPatient.full_name,
          type: 'Debt',
          category: displayCategory,
          amount: price,
          method: '—',
          date: today,
          notes: linkedContext,
        });
        totalDebt += price;
      }

      // 3. Create single Payment (Income) for advance payment if set
      if (isInstallment && installmentAdvance > 0) {
        await base44.entities.Payment.create({
          patient_id: createdPatient.id,
          patient_name: createdPatient.full_name,
          type: 'Income',
          category: `Boshlang'ich to'lov: ${displayCategory}`,
          amount: installmentAdvance,
          method: 'Cash',
          date: today,
          notes: linkedContext,
        });
      }
      
      // 3. Bemor statistikasini yangilash
      if (totalDebt > 0 || installmentAdvance > 0) {
        const allPays = await base44.entities.Payment.filter(
          { patient_id: createdPatient.id }, 
          '-date', 
          500
        );
        const paid = allPays.filter(p => p.type?.toLowerCase() === 'income').reduce((s, p) => s + (p.amount || 0), 0);
        const debt = allPays.filter(p => p.type?.toLowerCase() === 'debt').reduce((s, p) => s + (p.amount || 0), 0);
        const refund = allPays.filter(p => p.type?.toLowerCase() === 'refund').reduce((s, p) => s + (p.amount || 0), 0);
        const discount = allPays.filter(p => p.type?.toLowerCase() === 'discount').reduce((s, p) => s + (p.amount || 0), 0);
        
        await base44.entities.Patient.update(createdPatient.id, {
          total_paid: paid, 
          total_debt: Math.max(0, debt + discount - paid - refund),
        });
        
        toast.success(`Davolash rejasi yaratildi. Jami qarz: ${totalDebt.toLocaleString()} so'm`);
      } else {
        toast.success('Davolash rejasi yaratildi');
      }
      
      // Prepare complete plan data with all services
      const allServices = [];
      const allPlans = [];
      
      teethList.forEach(tooth => {
        const toothSvcs = tooth ? (toothData[tooth]?.services || []) : [];
        const planName = tooth && tooth !== 'general'
          ? `${createdPatient.full_name} — Tish #${tooth}`
          : planForm.name || `${createdPatient.full_name} — Davolash rejasi`;
        
        allPlans.push({
          name: planName,
          tooth: tooth === 'general' ? 'Umumiy' : tooth,
          services: toothSvcs
        });
        
        toothSvcs.forEach(s => {
          allServices.push({
            service_name: s.service_name,
            price: s.price,
            tooth: tooth === 'general' ? 'Umumiy' : tooth
          });
        });
      });
      
      setCreatedPlan({ 
        ...lastPlan, 
        total_price: totalDebt, 
        _count: teethList.length,
        services: allServices,
        allPlans: allPlans,
        allPlansObjects: allCreatedPlans, // Store real DB objects
        allToothData: { ...toothData }
      });
      setStep(4);
      onSaved?.();
    } catch (error) {
      console.error('[NewPatientFlow] Reja saqlashda xatolik:', error);
      setSavingError(error.message || String(error));
      toast.error('Reja saqlashda xatolik: ' + error.message);
    } finally {
      setSaving(false);
    }
  }, [
    planForm, toothData, createdPatient, onSaved,
    isInstallment, installmentMonths, installmentAdvance, 
    installmentStartDate, installmentDay, installmentServiceKeys, installmentTotal, allSelectedServices
  ]);

  /**
   * Download receipt as image (Mobile Friendly)
   */
  const handleDownloadImage = useCallback(async () => {
    try {
      toast.info("Rasm tayyorlanmoqda, kuting...", { id: "img-download" });
      if (!window.html2canvas) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }
      
      const element = document.getElementById('new-patient-receipt');
      const oldWidth = element.style.width;
      const oldTransform = element.style.transform;
      
      // Use viewport width so it looks good on mobile
      const viewW = Math.min(window.innerWidth, 420);
      element.style.width = viewW + 'px';
      element.style.transform = 'none';

      const canvas = await window.html2canvas(element, {
        scale: 2, 
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: viewW,
        windowWidth: viewW,
      });
      
      // Revert styles
      element.style.width = oldWidth;
      element.style.transform = oldTransform;
      
      const link = document.createElement('a');
      link.download = `Chek_${createdPatient?.full_name?.replace(/\\s+/g, '_') || 'Bemor'}.png`;
      link.href = canvas.toDataURL('image/png', 1.0);
      link.click();
      toast.success("Muvaffaqiyatli saqlandi!", { id: "img-download" });
    } catch (e) {
      console.error(e);
      toast.error("Rasmga saqlashda xatolik yuz berdi", { id: "img-download" });
    }
  }, [createdPatient]);

  /**
   * Skip plan creation
   */
  const handleSkipPlan = useCallback(() => {
    setStep(4);
    onSaved();
  }, [onSaved]);

  /**
   * Close dialog with confirmation if dirty
   */
  const handleClose = useCallback(() => {
    if (step === 1 && (patientForm.full_name || patientForm.phone)) {
      if (!confirm("Ma'lumotlar saqlanmadi. Haqiqatdan ham yopmoqchimisiz?")) {
        return;
      }
    }
    setStep(1);
    onClose();
  }, [onClose, step, patientForm.full_name, patientForm.phone]);

  const handleApplyDiscount = useCallback(async (val, mode = 'pct') => {
    try {
      if (!createdPatient) return;
      
      const originalTotal = createdPlan?.total_price || grandTotal || 0;
      let discountAmount = 0;
      let label = "";
      
      if (mode === 'pct') {
        setDiscountPercent(val);
        discountAmount = (originalTotal * val) / 100;
        label = val === 0 ? "Yo'q" : `Chegirma ${val}%`;
      } else {
        // Use a unique number to identify custom amount in UI
        setDiscountPercent(-1); 
        discountAmount = val;
        label = `Chegirma (${val.toLocaleString()} so'm)`;
      }
      setAppliedDiscountAmount(discountAmount);
      
      if (discountPaymentId) {
        if (val === 0 && mode === 'pct') {
          await base44.entities.Payment.delete(discountPaymentId);
          setDiscountPaymentId(null);
        } else {
          await base44.entities.Payment.update(discountPaymentId, {
            amount: -discountAmount,
            category: label,
            notes: `Avtomatik chegirma: ${label}`
          });
        }
      } else if (discountAmount > 0) {
        const pay = await base44.entities.Payment.create({
          patient_id: createdPatient.id,
          patient_name: createdPatient.full_name,
          type: 'Discount',
          category: label,
          amount: -discountAmount,
          method: '—',
          date: new Date().toISOString(),
          notes: `Avtomatik chegirma: ${label}`
        });
        if (pay && pay.id) {
          setDiscountPaymentId(pay.id);
        }
      }
      
      // TreatmentPlan yozuvlarini ham net summa bilan yangilaymiz
      const plansToUpdate = createdPlan?.allPlansObjects?.length
        ? createdPlan.allPlansObjects
        : (createdPlan?.id ? [createdPlan] : []);
      if (plansToUpdate.length > 0) {
        const planOriginals = plansToUpdate.map((plan) => {
          const currentTotal = Number(plan.total_price) || 0;
          const existingDiscount = Number(plan.discount_amount) || 0;
          return {
            ...plan,
            original_price: currentTotal + existingDiscount
          };
        });

        for (const plan of plansToUpdate) {
            const sourcePlan = planOriginals.find((p) => p.id === plan.id) || plan;
            const planOriginalPrice = Number(sourcePlan.original_price) || 0;
            if (planOriginalPrice <= 0) continue;
            
            // Distribute discount proportionally
            let planDiscountAmt = 0;
            if (mode === 'pct') {
                planDiscountAmt = (planOriginalPrice * val) / 100;
            } else {
                // If it's a fixed amount, distribute it based on weight
                const totalOriginal = planOriginals.reduce((s, p) => s + (Number(p.original_price) || 0), 0);
                planDiscountAmt = totalOriginal > 0 ? (planOriginalPrice / totalOriginal) * val : 0;
            }
            
            const roundedDiscountAmt = Math.max(0, Math.round(planDiscountAmt));
            const planDiscountPct = mode === 'pct' ? val : (planOriginalPrice > 0 ? Math.round((roundedDiscountAmt / planOriginalPrice) * 100) : 0);
            const discountedPlanTotal = Math.max(0, Math.round(planOriginalPrice - roundedDiscountAmt));

            await base44.entities.TreatmentPlan.update(plan.id, {
                total_price: discountedPlanTotal,
                discount_amount: roundedDiscountAmt,
                discount_percent: planDiscountPct
            });
        }

        setCreatedPlan(prev => {
          if (!prev) return prev;

          const updatedPlanObjects = (prev.allPlansObjects || []).map((plan) => {
            const existingDiscount = Number(plan.discount_amount) || 0;
            const originalPrice = (Number(plan.total_price) || 0) + existingDiscount;

            let distributedDiscount = 0;
            if (mode === 'pct') {
              distributedDiscount = (originalPrice * val) / 100;
            } else {
              const totalOriginal = (prev.allPlansObjects || []).reduce((sum, p) => {
                const pExistingDiscount = Number(p.discount_amount) || 0;
                return sum + ((Number(p.total_price) || 0) + pExistingDiscount);
              }, 0);
              distributedDiscount = totalOriginal > 0 ? (originalPrice / totalOriginal) * val : 0;
            }

            const roundedDiscount = Math.max(0, Math.round(distributedDiscount));

            return {
              ...plan,
              total_price: Math.max(0, Math.round(originalPrice - roundedDiscount)),
              discount_amount: roundedDiscount,
              discount_percent: mode === 'pct' ? val : (originalPrice > 0 ? Math.round((roundedDiscount / originalPrice) * 100) : 0)
            };
          });

          return {
            ...prev,
            allPlansObjects: updatedPlanObjects
          };
        });
      }
      
      const allPays = await base44.entities.Payment.filter(
        { patient_id: createdPatient.id }, 
        '-date', 
        500
      );
      const paid = allPays.filter(p => p.type?.toLowerCase() === 'income').reduce((s, p) => s + (p.amount || 0), 0);
      const debt = allPays.filter(p => p.type?.toLowerCase() === 'debt').reduce((s, p) => s + (p.amount || 0), 0);
      const refund = allPays.filter(p => p.type?.toLowerCase() === 'refund').reduce((s, p) => s + (p.amount || 0), 0);
      const discount = allPays.filter(p => p.type?.toLowerCase() === 'discount').reduce((s, p) => s + (p.amount || 0), 0);
      
      await base44.entities.Patient.update(createdPatient.id, {
        total_paid: paid, 
        total_debt: Math.max(0, debt + discount - paid - refund),
      });
      
      if (onSaved) onSaved();
      
      toast.success(val === 0 && mode === 'pct' ? "Chegirma olib tashlandi" : `${label} qo'llanildi!`);
    } catch (error) {
      console.error('Chegirma tizimida xatolik:', error);
      toast.error("Chegirma qo'shishda xatolik yuz berdi");
    }
  }, [createdPatient, createdPlan, grandTotal, discountPaymentId, onSaved]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="!p-0 w-full sm:w-[94vw] md:w-[90vw] max-w-4xl h-[100dvh] sm:h-[90dvh] md:h-[94dvh] md:max-h-[94dvh] flex flex-col overflow-hidden rounded-none sm:rounded-2xl border-0 shadow-2xl gap-0 !top-0 sm:!top-[5dvh] !translate-y-0">

        <div 
          className="flex-shrink-0 px-4 pb-2 sm:px-5 sm:pb-3 lg:p-6 border-b bg-white relative z-10 shadow-sm no-print"
          style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))' }}
        >
          <DialogHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => {
                  if (step > 1 && step < 4) setStep(step - 1);
                  else if (step === 4) setStep(2);
                  else handleClose();
                }}
                className="p-2 -ml-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-600"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <DialogTitle className="text-xl font-bold text-slate-800">{t('patients.addNew')}</DialogTitle>
            </div>
            <button 
              onClick={handleClose}
              className="p-2 -mr-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
          </DialogHeader>

          {/* Stepper (Matching Screenshot) */}
          <div className="flex items-center justify-center gap-0 mt-6 mb-2 no-print">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const done = step > s.id || (step === 4 && s.id === 3);
              const active = step === s.id || (step === 4 && s.id === 3);
              return (
                <div key={s.id} className="flex items-center">
                  <div className="flex flex-col items-center gap-1.5 min-w-[60px]">
                    <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300
                      ${done ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-100' :
                        active ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-100' :
                        'bg-slate-100 border-slate-200 text-slate-400'}`}>
                      {done && !active ? <Check className="w-4 h-4 stroke-[3px]" /> : <Icon className="w-3.5 h-3.5 sm:w-5 sm:h-5" />}
                    </div>
                    <span className={`text-[9px] sm:text-[11px] font-bold uppercase tracking-wider ${active || done ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {t(s.label)}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`h-[2px] w-12 sm:w-20 mx-[-4px] mb-5 rounded transition-colors duration-300 ${step > s.id ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-hidden bg-white sm:bg-slate-50/50 flex flex-col">

          {/* STEP 1: Patient */}
          {step === 1 && (
            <div className="flex flex-col h-full bg-white">

              <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-3xl mx-auto w-full">

                {/* Top Section: Photo + Name fields side by side */}
                <div className="flex gap-4 mb-4">
                  {/* Photo - compact */}
                  <div className="flex-shrink-0">
                    <div className="relative w-20 h-20 sm:w-24 sm:h-24 bg-slate-100 rounded-2xl border border-slate-200 overflow-hidden group shadow-inner flex items-center justify-center">
                      {patientForm.photo_url ? (
                        <img src={patientForm.photo_url} alt="Bemor rasmi" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                          <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                        </div>
                      )}
                      <label className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/20 transition-all cursor-pointer group-hover:opacity-100 opacity-0">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                        <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                      </label>
                      {patientForm.photo_url && (
                        <button type="button" onClick={() => setPatientForm(prev => ({ ...prev, photo_url: '' }))}
                          className="absolute top-1 right-1 w-5 h-5 bg-white/90 text-rose-500 rounded-full flex items-center justify-center border border-slate-100">
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <p className="text-[9px] font-bold text-slate-400 text-center mt-1 uppercase tracking-wider">Rasm</p>
                  </div>

                  {/* Name fields right of photo */}
                  <div className="flex-1 grid grid-cols-1 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Familiya <span className="text-red-500">*</span></label>
                      <Input value={patientForm.last_name} onChange={e => setPatientForm({ ...patientForm, last_name: capitalizeAsYouType(e.target.value) })}
                        onBlur={e => setPatientForm(prev => ({ ...prev, last_name: capitalizeName(e.target.value) }))}
                        placeholder="Familiya" className="h-9 rounded-lg text-sm border-slate-200 focus:border-slate-400 focus:ring-0 w-full" autoFocus />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Ism <span className="text-red-500">*</span></label>
                      <Input value={patientForm.first_name} onChange={e => setPatientForm({ ...patientForm, first_name: capitalizeAsYouType(e.target.value) })}
                        onBlur={e => setPatientForm(prev => ({ ...prev, first_name: capitalizeName(e.target.value) }))}
                        placeholder="Ism" className="h-9 rounded-lg text-sm border-slate-200 focus:border-slate-400 focus:ring-0 w-full" />
                    </div>
                  </div>
                </div>

                {/* Main 2-column compact grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                  {/* Phone */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Telefon <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Phone className="w-4 h-4" /></span>
                      <Input type="tel" inputMode="tel" value={patientForm.phone}
                        onChange={e => setPatientForm({ ...patientForm, phone: applyPhoneMask(e.target.value) })}
                        placeholder="+998 (__) ___-__-__" maxLength={19}
                        className="h-9 rounded-lg text-sm border-slate-200 focus:border-slate-400 focus:ring-0 pl-10 w-full" />
                    </div>
                  </div>

                  {/* Phone 2 */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Telefon 2</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Phone className="w-4 h-4" /></span>
                      <Input type="tel" inputMode="tel" value={patientForm.phone_secondary}
                        onChange={e => setPatientForm({ ...patientForm, phone_secondary: applyPhoneMask(e.target.value) })}
                        placeholder="+998 (__) ___-__-__" maxLength={19}
                        className="h-9 rounded-lg text-sm border-slate-200 focus:border-slate-400 focus:ring-0 pl-10 w-full" />
                    </div>
                  </div>

                  {/* Status */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Bemor holati</label>
                    <Select value={patientForm.status} onValueChange={v => setPatientForm({ ...patientForm, status: v })}>
                      <SelectTrigger className="h-9 rounded-lg border-slate-200 text-sm w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="New">Yangi</SelectItem>
                        <SelectItem value="Active">Faol</SelectItem>
                        <SelectItem value="In Treatment">Davolanishda</SelectItem>
                        <SelectItem value="Waiting">Kutmoqda</SelectItem>
                        <SelectItem value="Inactive">Nofaol</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Gender */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Jinsi</label>
                    <div className="flex items-center gap-4 h-9">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input type="radio" name="gender" value="Male" checked={patientForm.gender === 'Male'}
                          onChange={() => setPatientForm({ ...patientForm, gender: 'Male' })}
                          className="w-4 h-4 text-emerald-600 border-slate-300 focus:ring-0" />
                        <span className="text-sm font-medium text-slate-700">Erkak</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input type="radio" name="gender" value="Female" checked={patientForm.gender === 'Female'}
                          onChange={() => setPatientForm({ ...patientForm, gender: 'Female' })}
                          className="w-4 h-4 text-emerald-600 border-slate-300 focus:ring-0" />
                        <span className="text-sm font-medium text-slate-700">Ayol</span>
                      </label>
                    </div>
                  </div>

                  {/* Date of birth */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Tug'ilgan sana</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      <EditableSelect value={patientForm.birth_day} onChange={v => setPatientForm(prev => ({ ...prev, birth_day: v }))}
                        onValidate={handleDayValidate} placeholder="Kun" options={dayOptions} type="text" maxLength={2} />
                      <EditableSelect value={patientForm.birth_month} onChange={v => setPatientForm(prev => ({ ...prev, birth_month: v }))}
                        onValidate={handleMonthValidate} placeholder="Oy" options={monthOptions} type="text" maxLength={2} />
                      <EditableSelect value={patientForm.birth_year} onChange={v => setPatientForm(prev => ({ ...prev, birth_year: v }))}
                        onValidate={handleYearValidate} placeholder="Yil" options={yearOptions} type="text" maxLength={4} />
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Email</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Mail className="w-4 h-4" /></span>
                      <Input type="email" value={patientForm.email} onChange={e => setPatientForm({ ...patientForm, email: e.target.value })}
                        placeholder="example@mail.com" className="h-9 rounded-lg text-sm border-slate-200 focus:border-slate-400 focus:ring-0 pl-10 w-full" />
                    </div>
                  </div>

                  {/* Address - full width */}
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Manzil</label>
                    <Input value={patientForm.address} onChange={e => setPatientForm({ ...patientForm, address: e.target.value })}
                      placeholder="Toshkent shahri, Chilonzor tumani..."
                      className="h-9 rounded-lg text-sm border-slate-200 focus:border-slate-400 focus:ring-0 w-full" />
                  </div>

                  {/* Contact/Source */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Manba</label>
                    <Select value={patientForm.contact} onValueChange={v => setPatientForm({ ...patientForm, contact: v })}>
                      <SelectTrigger className="h-9 rounded-lg border-slate-200 text-sm w-full"><SelectValue placeholder="Tanlang" /></SelectTrigger>
                      <SelectContent>
                        {['Telegram', 'Instagram', 'Google', 'Veb-sayt', 'Tavsiya', "Qo'ng'iroq", 'Boshqa'].map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Main treatment provider */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Asosiy shifokor</label>
                    <Select value={patientForm.main_treatment_provider} onValueChange={v => setPatientForm({ ...patientForm, main_treatment_provider: v })}>
                      <SelectTrigger className="h-9 rounded-lg border-slate-200 text-sm w-full"><SelectValue placeholder="Tanlang" /></SelectTrigger>
                      <SelectContent className="max-h-[200px]">
                        {doctors.map(d => (
                          <SelectItem key={d.id} value={d.id || d.name}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Card number */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Karta raqami</label>
                    <Input value={patientForm.card_number} onChange={e => setPatientForm({ ...patientForm, card_number: e.target.value })}
                      placeholder="043/u tibbiy karta"
                      className="h-9 rounded-lg text-sm border-slate-200 focus:border-slate-400 focus:ring-0 w-full" />
                  </div>

                  {/* Registration date */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Ro'yxat sanasi <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Calendar className="w-4 h-4" /></span>
                      <Input value={patientForm.registration_date} onChange={e => setPatientForm({ ...patientForm, registration_date: e.target.value })}
                        placeholder="17.07.2026" className="h-9 rounded-lg text-sm border-slate-200 focus:border-slate-400 focus:ring-0 pl-10 w-full font-medium" />
                    </div>
                  </div>

                  {/* Important info - full width */}
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                      Muhim ma'lumot
                      <span className="text-[9px] bg-slate-100 text-slate-500 rounded-full w-4 h-4 flex items-center justify-center cursor-help font-bold" title="Allergiyalar, kasalliklar, xavf omillari">i</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-rose-500"><AlertTriangle className="w-4 h-4" /></span>
                      <Input value={patientForm.important_info} onChange={e => setPatientForm({ ...patientForm, important_info: e.target.value })}
                        placeholder="Allergiyalar, kasalliklar, xavf omillari..."
                        className="h-9 rounded-lg text-sm border-slate-200 focus:border-slate-400 focus:ring-0 pl-10 text-rose-600 placeholder-rose-300 font-medium w-full" />
                    </div>
                  </div>

                  {/* Payer - full width */}
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">To'lovchi</label>
                    <Input value={patientForm.payer} onChange={e => setPatientForm({ ...patientForm, payer: e.target.value })}
                      placeholder="To'lovchi tashkilot yoki kafil shaxs..."
                      className="h-9 rounded-lg text-sm border-slate-200 focus:border-slate-400 focus:ring-0 w-full" />
                  </div>

                  {/* Comment - full width */}
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Izoh</label>
                    <textarea value={patientForm.comment} onChange={e => setPatientForm({ ...patientForm, comment: e.target.value })}
                      placeholder="Tafsilotlar..."
                      className="w-full min-h-[60px] p-2.5 rounded-lg text-sm border border-slate-200 focus:border-slate-400 outline-none transition-all resize-y" />
                  </div>

                </div>
              </div>


              
              {/* Cancel / Save actions (Matching color of screenshot) */}
              <div className="flex-shrink-0 flex flex-col gap-3 p-4 border-t bg-slate-50 z-30 pb-safe-offset-4 shadow-[0_-4px_10px_rgba(0,0,0,0.03)] w-full">
                {savingError && (
                  <div className="bg-rose-50 border border-rose-100 rounded-2xl p-3 text-xs font-bold text-rose-600 w-full flex items-start gap-2 shadow-inner">
                    <span className="shrink-0 text-base">⚠️</span>
                    <div className="flex-1 text-left break-all">
                      Bemor saqlashda xatolik: {savingError}
                    </div>
                  </div>
                )}
                <div className="flex justify-center gap-3 w-full">
                  <Button 
                    variant="outline" 
                    onClick={handleClose} 
                    className="h-10 px-8 rounded-lg font-bold border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 transition-all text-sm min-w-[120px]"
                  >
                    Bekor qilish
                  </Button>
                  <Button
                    onClick={handleSavePatient}
                    disabled={saving || !canProceedPatientStep}
                    className="bg-[#2ea44f] hover:bg-[#2c974b] text-white gap-2 h-10 px-8 rounded-lg font-bold shadow-md transition-all text-sm border-none flex items-center justify-center min-w-[120px]"
                  >
                    {saving ? (
                      'Saqlanmoqda...'
                    ) : (
                      <>
                        <Check className="w-4.5 h-4.5 stroke-[3px]" />
                        Saqlash
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

        {/* STEP 2: Treatment Plan */}
        {step === 2 && (() => {
            const UPPER_RIGHT = ['18', '17', '16', '15', '14', '13', '12', '11'];
            const UPPER_LEFT  = ['21', '22', '23', '24', '25', '26', '27', '28'];
            const LOWER_RIGHT = ['48', '47', '46', '45', '44', '43', '42', '41'];
            const LOWER_LEFT  = ['31', '32', '33', '34', '35', '36', '37', '38'];

            const upperRight = UPPER_RIGHT;
            const upperLeft  = UPPER_LEFT;
            const lowerRight = LOWER_RIGHT;
            const lowerLeft  = LOWER_LEFT;

            const getCategoryName = (cat) => {
              if (!cat) return "";
              const upper = cat.toUpperCase();
              if (upper.includes("TERAPIYA") || upper.includes("ENDO")) return "Terapiya";
              if (upper.includes("ORTOPEDIYA") || upper.includes("PROTEZ")) return "Ortopediya";
              if (upper.includes("ESTETIK") || upper.includes("OQARTIRISH")) return "Estetika";
              if (upper.includes("XIRURG") || upper.includes("OLISH")) return "Xirurgiya";
              if (upper.includes("ORTODONT") || upper.includes("BREKET")) return "Ortodontiya";
              if (upper.includes("IMPLANT")) return "Implantatsiya";
              return cat;
            };
            const availableCategories = ["terapiya", "ortopediya", "estetika", "xirurgiya", "ortodontiya", "implantatsiya"];

            const ToothBtn = ({ fdi }) => {
              const internalId = fdiToInternal(String(fdi));
              const isSelected = planForm.tooth_numbers.includes(internalId);
              const isActive   = activeTooth === internalId;
              return (
                <button
                  type="button"
                  onClick={() => {
                    const isActive = activeTooth === internalId;
                    let next;
                    if (isActive) {
                      next = planForm.tooth_numbers.filter(t => t !== internalId);
                    } else {
                      next = planForm.tooth_numbers.includes(internalId)
                        ? planForm.tooth_numbers
                        : [...planForm.tooth_numbers, internalId];
                    }
                    handleTeethChange(next);
                    setActiveTooth(next.includes(internalId) ? internalId : null);
                  }}
                  className={cn(
                    "w-8 h-9 rounded-lg flex items-center justify-center text-xs font-black transition-all cursor-pointer leading-none shrink-0 p-0 border",
                    isActive    ? "bg-[#1499AD] text-white border-[#1499AD] ring-2 ring-[#1499AD]/30 shadow-md shadow-[#1499AD]/10 scale-105" :
                    isSelected  ? "bg-emerald-500 text-white border-emerald-500 shadow-sm" :
                                  "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                  )}
                >
                  <span className="text-[11px] font-black">{fdi}</span>
                </button>
              );
            };

            return (
              <div className="flex flex-col h-full bg-white overflow-hidden">
                
                {/* === DESKTOP VIEW === */}
                <div className="hidden md:flex flex-row flex-1 min-h-0 bg-white overflow-hidden">
                  
                  {/* ═══ LEFT PANEL ═══ */}
                  <div className="flex-[0_0_62%] flex flex-col border-r border-slate-100 overflow-hidden bg-white min-h-0">
                    <div className="pl-6 pr-4 py-2 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
                      <span className="text-[12px] font-bold text-slate-700">Davolash rejasi</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-medium text-slate-500">Bemor: {createdPatient?.full_name}</span>
                      </div>
                    </div>

                    {/* ── Compact FDI tooth chart (Horizontal swipe on mobile) ── */}
                    <div className="shrink-0 bg-[#fef9f7] border-b border-slate-100 py-2 overflow-x-auto no-scrollbar touch-pan-x">
                      <div className="min-w-[560px] px-6">
                        {/* Upper jaw */}
                        <div className="flex items-center justify-center gap-0.5 sm:gap-1.5 mb-1">
                          {upperRight.map(n => <ToothBtn key={n} fdi={n} />)}
                          <div className="w-px h-5 bg-slate-300 mx-1" />
                          {upperLeft.map(n => <ToothBtn key={n} fdi={n} />)}
                        </div>
                        {/* Midline */}
                        <div className="flex justify-center my-0.5">
                          <div className="w-64 border-t border-dashed border-slate-300" />
                        </div>
                        {/* Lower jaw */}
                        <div className="flex items-center justify-center gap-0.5 sm:gap-1.5 mt-1">
                          {lowerRight.map(n => <ToothBtn key={n} fdi={n} />)}
                          <div className="w-px h-5 bg-slate-300 mx-1" />
                          {lowerLeft.map(n => <ToothBtn key={n} fdi={n} />)}
                        </div>
                      </div>
                      {/* Legend */}
                      <div className="flex items-center justify-center gap-3 mt-2 shrink-0">
                        <span className="flex items-center gap-1 text-[9px] text-slate-400"><span className="w-2.5 h-2.5 rounded-full bg-[#f87171] inline-block" />Tanlangan</span>
                        <span className="flex items-center gap-1 text-[9px] text-slate-400"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />Faol</span>
                        <span className="flex items-center gap-1 text-[9px] text-slate-400"><span className="w-2.5 h-2.5 rounded-full bg-slate-200 inline-block" />Tanlash</span>
                      </div>
                    </div>

                    {/* Services table header */}
                    <div className="pl-6 pr-4 py-1.5 bg-slate-50 border-b border-slate-100 grid grid-cols-[minmax(0,1fr)_32px_64px_40px_64px_18px] gap-1 shrink-0">
                      <span className="text-[9px] font-black text-slate-400 uppercase">Xizmat</span>
                      <span className="text-[9px] font-black text-slate-400 uppercase text-center">T#</span>
                      <span className="text-[9px] font-black text-slate-400 uppercase text-right">Narx</span>
                      <span className="text-[9px] font-black text-slate-400 uppercase text-center">%</span>
                      <span className="text-[9px] font-black text-slate-400 uppercase text-right">Jami</span>
                      <span />
                    </div>

                    {/* Services list */}
                    <div className="flex-1 overflow-y-auto min-h-0">
                      {allSelectedServices.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full gap-1.5 text-slate-300 py-10">
                          <ClipboardList className="w-7 h-7" />
                          <p className="text-[11px] font-bold">Xizmat tanlanmagan</p>
                        </div>
                      ) : (
                        allSelectedServices.map((s, idx) => {
                          const discPrice = Math.floor((s.price || 0) * (1 - discountPercent / 100));
                          const dotColors = ['#4285f4','#ea4335','#34a853','#fbbc04','#9c27b0','#00bcd4','#ff5722'];
                          const dotColor  = dotColors[idx % dotColors.length];
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
                                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
                                <span className="text-[10px] font-medium text-slate-700 truncate">{s.service_name}</span>
                              </div>
                              <span className="text-[10px] text-slate-500 text-center font-bold">{idToFdi(s.toothId)}</span>
                              <span className="text-[10px] text-slate-600 text-right">{(s.price||0).toLocaleString()}</span>
                              <span className="text-[10px] text-slate-400 text-center">{discountPercent > 0 ? `${discountPercent}%` : '—'}</span>
                              <span className="text-[10px] font-bold text-slate-900 text-right">{discPrice.toLocaleString()}</span>
                              <button type="button"
                                onClick={e => { e.stopPropagation(); toggleToothService({ id: s.service_id, name: s.service_name, price: s.price }); }}
                                className="w-4 h-4 rounded-full hover:bg-red-50 flex items-center justify-center text-slate-300 hover:text-red-400 transition-colors border-none bg-transparent cursor-pointer p-0">
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Bottom: discount + save */}
                    <div className="pl-6 pr-4 pt-2 pb-3 border-t border-slate-100 bg-white shrink-0">
                      <div className="flex items-center gap-1 flex-wrap mb-1.5">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Chegirma:</span>
                        {[0,10,20,30].map(val => (
                          <button key={val} onClick={() => { handleApplyDiscount(val); setShowCustomDiscount(false); setCustomDiscountAmount(''); }}
                            className={cn("px-2 py-0.5 rounded text-[9px] font-black transition-all border-none cursor-pointer",
                              discountPercent === val && !showCustomDiscount ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                            )}>
                            {val === 0 ? "Yo'q" : `${val}%`}
                          </button>
                        ))}
                        <button onClick={() => setShowCustomDiscount(!showCustomDiscount)}
                          className={cn("px-2 py-0.5 rounded text-[9px] font-black transition-all border-none cursor-pointer",
                            showCustomDiscount ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200")}>
                          Boshqa
                        </button>
                        {showCustomDiscount && (
                          <div className="flex gap-1">
                            <input type="text" inputMode="numeric" value={customDiscountAmount}
                              onChange={e => setCustomDiscountAmount(e.target.value.replace(/\D/g,''))}
                              placeholder="%" className="w-12 h-6 rounded border border-slate-200 text-center text-[10px] font-bold outline-none" />
                            <button onClick={() => { const v=parseInt(customDiscountAmount); if(v>=0&&v<=100){handleApplyDiscount(v);setShowCustomDiscount(false);}}}
                              className="h-6 px-2 rounded bg-slate-900 text-white text-[9px] font-black border-none cursor-pointer">OK</button>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-0.5 text-left">
                          <div>
                            <span className="font-black text-slate-900 text-[14px]">{Math.floor(grandTotal * (1 - discountPercent/100)).toLocaleString()}</span>
                            <span className="ml-1 text-[10px] text-slate-400">so'm</span>
                            {discountPercent > 0 && <span className="ml-2 text-[9px] text-slate-400 line-through">{grandTotal.toLocaleString()}</span>}
                          </div>
                          {discountPercent > 0 && (
                            <span className="text-[10px] font-bold text-rose-500">
                              Chegirma summasi: -{Math.floor(grandTotal * (discountPercent/100)).toLocaleString()} so'm ({discountPercent}%)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ═══ RIGHT PANEL: Price list ═══ */}
                  <div className="flex-1 flex flex-col overflow-hidden bg-white min-h-0">
                    <div className="pl-3 pr-6 py-2 border-b border-slate-100 shrink-0 bg-white">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-bold text-slate-600">Narxlar ro'yxati</span>
                        {activeTooth ? (
                          <span className="text-[11px] text-blue-500 font-bold">Tish #{idToFdi(activeTooth)} uchun</span>
                        ) : (
                          <span className="text-[11px] text-amber-500 font-bold">Avval tish tanlang</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-2.5 h-7 border border-slate-100">
                        <Search className="w-3 h-3 text-slate-300 shrink-0" />
                        <input type="text" value={serviceSearch} onChange={e => setServiceSearch(e.target.value)}
                          placeholder="Xizmat qidirish..."
                          className="flex-1 bg-transparent border-none text-[11px] text-slate-700 placeholder:text-slate-300 outline-none font-medium" />
                        {serviceSearch && (
                          <button onClick={() => setServiceSearch('')} className="text-slate-300 hover:text-slate-500 border-none bg-transparent cursor-pointer"><X className="w-2.5 h-2.5" /></button>
                        )}
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto pl-2 pr-4 pt-1.5 pb-6 space-y-1 min-h-0 bg-white">
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
                        return Object.entries(grouped).map(([cat, svcs]) => (
                          <CategoryAccordion key={cat} title={cat} services={svcs}
                            activeTooth={activeTooth} toothData={toothData} toggleService={toggleToothService}
                            isBulkMode={isBulkMode} selectedTeeth={planForm.tooth_numbers} />
                        ));
                      })()}
                    </div>
                  </div>
                </div>

                {/* === MOBILE VIEW === */}
                <div className="flex md:hidden flex-col h-full w-full overflow-hidden bg-white">
                  {/* Top: 2-row anatomical tooth selector */}
                  <div ref={mobileTeethScrollRef} className="overflow-x-auto py-2 px-1 no-scrollbar scrollbar-none shrink-0 select-none">
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
                                  onClick={() => toggleToothService({ id: s.service_id, name: s.service_name, price: s.price })}
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
                        const cat = (s.category || autoCategorize(s.name)).toLowerCase();
                        const q = serviceSearch.trim().toLowerCase();
                        const qMatch = !q || (s.name || '').toLowerCase().includes(q);
                        if (!qMatch) return false;
                        
                        if (selectedCategory === "terapiya") {
                          return cat.includes('terapiya') || cat.includes('endodontiya');
                        }
                        if (selectedCategory === "ortopediya") {
                          return cat.includes('ortopediya');
                        }
                        if (selectedCategory === "estetika") {
                          return cat.includes('estetik') || cat.includes('esthetics');
                        }
                        if (selectedCategory === "xirurgiya") {
                          return cat.includes('xirurgiya');
                        }
                        if (selectedCategory === "ortodontiya") {
                          return cat.includes('ortodontiya');
                        }
                        if (selectedCategory === "implantatsiya") {
                          return cat.includes('implantat') || cat.includes('implantatsiya');
                        }
                        return true;
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
                                ? () => toggleToothService(svc)
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
                  <div 
                    className="p-4 border-t border-slate-150 bg-white flex flex-col gap-3 shrink-0 shadow-lg sticky bottom-0 z-50"
                    style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
                  >
                    {/* Chegirma tanlash (Mobile) */}
                    <div className="flex items-center gap-1.5 flex-wrap px-1 pb-2 border-b border-slate-100">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider mr-1">Chegirma:</span>
                      {[0,10,20,30].map(val => (
                        <button key={val} type="button" onClick={() => { handleApplyDiscount(val); setShowCustomDiscount(false); setCustomDiscountAmount(''); }}
                          className={cn("px-2 py-0.5 rounded text-[9px] font-black transition-all border-none cursor-pointer",
                            discountPercent === val && !showCustomDiscount ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                          )}>
                          {val === 0 ? "Yo'q" : `${val}%`}
                        </button>
                      ))}
                      <button type="button" onClick={() => setShowCustomDiscount(!showCustomDiscount)}
                        className={cn("px-2 py-0.5 rounded text-[9px] font-black transition-all border-none cursor-pointer",
                          showCustomDiscount ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200")}>
                        Boshqa
                      </button>
                      {showCustomDiscount && (
                        <div className="flex gap-1 ml-1">
                          <input type="text" inputMode="numeric" value={customDiscountAmount}
                            onChange={e => setCustomDiscountAmount(e.target.value.replace(/\D/g,''))}
                            placeholder="%" className="w-12 h-6 rounded border border-slate-200 text-center text-[10px] font-bold outline-none" />
                          <button type="button" onClick={() => { const v=parseInt(customDiscountAmount); if(v>=0&&v<=100){handleApplyDiscount(v);setShowCustomDiscount(false);}}}
                            className="h-6 px-2 rounded bg-slate-900 text-white text-[9px] font-black border-none cursor-pointer">OK</button>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between items-end px-1">
                      <div className="flex flex-col text-left">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">
                          Rejada: {allSelectedServices.length} ta muolaja
                        </span>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-lg font-black text-slate-900 leading-none tabular-nums">
                            {Math.floor(grandTotal * (1 - discountPercent/100)).toLocaleString()}
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold">so'm</span>
                          {discountPercent > 0 && (
                            <span className="text-[10px] text-slate-400 line-through ml-1.5 font-medium tabular-nums">
                              {grandTotal.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {discountPercent > 0 && (
                        <div className="flex items-center gap-1">
                          <span className="text-[9px] font-bold text-slate-400 uppercase">Chegirma: </span>
                          <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                            {discountPercent}%
                          </span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button variant="outline" onClick={() => setStep(1)} className="h-12 rounded-xl font-bold px-4 shrink-0">
                        <ArrowLeft className="w-4 h-4" />
                      </Button>
                      <button
                        type="button"
                        onClick={handleSavePlan}
                        disabled={saving || allSelectedServices.length === 0}
                        className="flex-grow h-12 bg-emerald-500 hover:bg-emerald-600 text-white font-black uppercase text-xs tracking-wider rounded-xl shadow-md border-none flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-[0.98] transition-all"
                      >
                        {saving ? "Saqlanmoqda..." : "Saqlash va Yakunlash"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Bottom Navigation buttons (Desktop) */}
                <div className="hidden md:flex flex-shrink-0 flex-col gap-3 p-4 sm:p-5 border-t bg-white z-30 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] pb-safe-offset-4 w-full">
                  {savingError && (
                    <div className="bg-rose-50 border border-rose-100 rounded-2xl p-3 text-xs font-bold text-rose-600 w-full flex items-start gap-2 shadow-inner">
                      <span className="shrink-0 text-base">⚠️</span>
                      <div className="flex-1 text-left break-all">
                        Reja saqlashda xatolik: {savingError}
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between w-full gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={handleSkipPlan} 
                      className="hidden sm:flex text-muted-foreground h-11 px-3 sm:px-4 rounded-xl font-medium"
                    >
                      Rejasiz davom etish
                    </Button>
                    <div className="flex gap-2 w-full sm:w-auto justify-end">
                      <Button variant="outline" onClick={() => setStep(1)} className="h-12 sm:h-11 px-4 sm:px-6 rounded-xl font-bold">
                        <ArrowLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        onClick={handleSavePlan}
                        disabled={saving}
                        className="flex-1 sm:flex-none bg-primary hover:bg-primary/90 gap-1.5 h-12 sm:h-11 px-4 sm:px-8 rounded-xl font-bold shadow-sm"
                      >
                        {saving ? 'Saqlanmoqda...' : (
                          <>
                            <span>Saqlash{planForm.tooth_numbers.length > 1 ? ` (${planForm.tooth_numbers.length})` : ''}</span>
                            <Check className="w-4 h-4" />
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        {step === 3 && (
          <div className="flex flex-col h-full items-center justify-center text-center p-6 sm:p-10">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6 shadow-inner">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Muvaffaqiyatli yakunlandi!</h3>
              <p className="text-sm text-muted-foreground mt-1">
                <span className="font-semibold text-foreground">{createdPatient?.full_name}</span> qo'shildi
                {createdPatient && (
                  <> va <span className="font-semibold text-primary">
                    {createdPlan && (createdPlan._count > 1 ? `${createdPlan._count} ta alohida reja` : createdPlan.name)}
                  </span> tuzildi</>
                )}
                {createdPlan?.total_price > 0 && (
                  <>
                    <br />
                    <span className="text-amber-600 font-medium">
                      {createdPlan.total_price.toLocaleString()} so'm
                    </span> qarz sifatida to'lovlarga qo'shildi
                  </>
                )}
              </p>
            </div>

            {/* Telegram Bot Connection (New Section) */}
            <div className="mt-8 bg-blue-50 border border-blue-100 rounded-2xl p-4 w-full max-w-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p className="text-[13px] font-bold text-blue-900">Eslatmalar tizimi</p>
                  <p className="text-[10px] text-blue-700">Bemorni botimizga ulab qo'ying</p>
                </div>
              </div>
              
              <div className="bg-white p-3 rounded-xl border border-blue-100 mb-3 flex items-center justify-between gap-2 overflow-hidden">
                <span className="text-[11px] font-mono text-blue-600 truncate flex-1 text-left">
                   {getTelegramDeepLink(createdPatient?.id) || "Bot havolasi topilmadi (Telegram Bot sozlamasida token/username tekshiring)"}
                </span>
                <button 
                  type="button"
                  onClick={() => {
                    const link = getTelegramDeepLink(createdPatient?.id);
                    if (!link) return;
                    navigator.clipboard.writeText(link);
                    toast.success("Havola nusxalandi!");
                  }}
                  className="p-1.5 hover:bg-slate-50 text-blue-500 rounded-md transition-colors"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              
              <Button 
                type="button"
                onClick={() => {
                  const link = getTelegramDeepLink(createdPatient?.id);
                  if (!link) return;
                  window.open(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent("Assalomu alaykum! Klinikadan avtomatik eslatmalar olish uchun botimizga qo'shiling:")}`, '_blank');
                }}
                className="w-full bg-blue-600 hover:bg-blue-700 h-10 rounded-xl text-xs font-bold gap-2"
              >
                <Share2 className="w-4 h-4" />
                Telegramga yuborish
              </Button>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 mt-8 w-full sm:w-auto px-4 sm:px-0">
              <Button 
                variant="outline" 
                onClick={() => setStep(4)} 
                className="border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-800 px-8 font-bold h-12 rounded-xl transition-all w-full sm:w-auto"
              >
                <Printer className="w-5 h-5 mr-2" /> Chek ko'rish
              </Button>
              <Button onClick={handleClose} className="bg-primary hover:bg-primary/90 px-10 h-12 rounded-xl font-bold shadow-md w-full sm:w-auto text-base">
                Yopish
              </Button>
            </div>
          </div>
        )}

        {/* STEP 4: Receipt / Hisob-faktura */}
        {step === 4 && (
          <div className="flex-1 overflow-y-auto w-full p-4 sm:p-5 bg-slate-50/50">
            <div className="max-w-2xl mx-auto space-y-4">
              
              {/* Success Banner */}
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-center gap-4 mb-2"
              >
                <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-emerald-100">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-emerald-900 uppercase tracking-tight">Muvaffaqiyatli saqlandi!</h4>
                  <p className="text-[11px] text-emerald-700 font-medium">Bemor va davolash rejasi tizimga muvaffaqiyatli qo'shildi.</p>
                </div>
              </motion.div>

              {/* Header */}
              <div className="flex items-center gap-2 mb-4">
                 <button 
                  onClick={() => setStep(3)}
                  className="p-2 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h2 className="text-xl font-black text-slate-800 tracking-tight">{t('patients.wizard.invoice')}</h2>
              </div>


              {/* Invoice Canvas Area */}
              <div 
                id="new-patient-receipt"
                className="bg-white rounded-2xl md:rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] overflow-hidden w-full relative"
              >
                {/* Print Styles */}
                {open && step === 4 && (
                  <style dangerouslySetInnerHTML={{__html:`
                  @page { size: auto; margin: 0mm !important; }
                  @media screen {
                    .print-only { display: none !important; }
                  }
                  @media print {
                    .no-print { display: none !important; }
                    .print-only { display: block !important; }
                    #root { display: none !important; }
                    body { visibility: hidden !important; background: white !important; margin: 0 !important; padding: 0 !important; }
                    [data-radix-portal], [data-radix-portal] * { visibility: hidden !important; }

                    #new-patient-receipt { 
                      visibility: visible !important; 
                      display: block !important;
                      position: absolute !important; 
                      left: 0 !important; 
                      top: 0 !important; 
                      width: 100% !important; 
                      margin: 0 !important;
                      padding: 5mm 10mm !important;
                      box-shadow: none !important;
                      border: none !important;
                      overflow: visible !important;
                      border-radius: 0 !important;
                      background: white !important;
                    }
                    #new-patient-receipt * { 
                      visibility: visible !important; 
                      overflow: visible !important;
                    }

                    .page-break {
                      page-break-before: always !important;
                      margin-top: 5mm !important;
                      display: block !important;
                    }

                    /* Explicitly show parents of the receipt but nothing else */
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

                {/* Header Section */}
                <div className="p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 bg-gradient-to-br from-white to-slate-50/50">
                  <div className="flex items-start gap-4">
                    {clinicInfo?.logo ? (
                      <img 
                        src={clinicInfo.logo} 
                        alt="Clinic Logo" 
                        className="w-[42px] h-[42px] rounded-xl object-cover shadow-inner flex-shrink-0"
                      />
                    ) : (
                      <div className="w-[42px] h-[42px] rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 shadow-inner">
                        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C8.7 2 6 4.7 6 8c0 4 3 7 6 10 3-3 6-6 6-10 0-3.3-2.7-6-6-6z" />
                        </svg>
                      </div>
                    )}
                    <div>
                      <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight leading-none mb-1">
                        {clinicInfo?.name || 'DentaCRM'}
                      </h1>
                      <p className="text-[11px] sm:text-xs text-slate-500 font-medium">
                        {clinicInfo?.description || t('clinic.description')}
                      </p>
                      <p className="text-[10px] sm:text-[11px] text-slate-400 mt-1">
                        Tel: {clinicInfo?.phone || '+998 71 123 45 67'} | {clinicInfo?.address || t('clinic.address')}
                      </p>
                    </div>
                  </div>
                  
                  <div className="text-left sm:text-right flex flex-col gap-1 items-start sm:items-end bg-slate-50 sm:bg-transparent p-3 sm:p-0 rounded-xl">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-widest text-right w-full sm:w-auto">{t('patients.wizard.invoice').toUpperCase()}</h3>
                    <p className="text-[11px] text-slate-500 font-medium">{t('common.date')}: {new Date().getDate()}-{(['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'])[new Date().getMonth()]}, {new Date().getFullYear()}</p>
                    <p className="text-[11px] text-slate-400 font-medium">№ {createdPlan?.id ? createdPlan.id.split('-').pop()?.toUpperCase() : String(Date.now()).slice(-6)}</p>
                  </div>
                </div>

                {/* Patient Info Section */}
                <div className="p-5 sm:p-6 lg:px-8 border-b border-slate-100">
                  <p className="text-[10px] sm:text-xs font-bold text-blue-500 uppercase tracking-wider mb-2">{t('implants.form.patientInfo').toUpperCase()}</p>
                  <div className="grid grid-cols-2 gap-y-4 gap-x-2 sm:gap-6">
                    <div>
                      <p className="text-[10px] sm:text-[11px] text-slate-400 font-semibold uppercase mb-0.5">{t('patients.fullName')}</p>
                      <p className="text-[13px] sm:text-sm font-bold text-slate-800">{createdPatient?.full_name}</p>
                    </div>
                    <div>
                      <p className="text-[10px] sm:text-[11px] text-slate-400 font-semibold uppercase mb-0.5">
                        {t('patients.appointmentDate') && t('patients.appointmentDate') !== 'patients.appointmentDate' ? t('patients.appointmentDate') : 'Qabul vaqti'}
                      </p>
                      <p className="text-[13px] sm:text-sm font-bold text-slate-800">
                        {new Date().getDate()}-{(['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'])[new Date().getMonth()]}, {new Date().getFullYear()} {new Date().toLocaleTimeString("uz-UZ", {hour:'2-digit',minute:'2-digit'})}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] sm:text-[11px] text-slate-400 font-semibold uppercase mb-0.5">{t('implants.doctor')}</p>
                      <p className="text-[13px] sm:text-sm font-bold text-slate-800">{localStorage.getItem('user_name') || 'Demo Admin'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] sm:text-[11px] text-slate-400 font-semibold uppercase mb-0.5">{t('patients.treatmentType') && t('patients.treatmentType') !== 'patients.treatmentType' ? t('patients.treatmentType') : 'Muolaja turi'}</p>
                      <p className="text-[13px] sm:text-sm font-bold text-slate-800">
                         {createdPlan?.services?.[0]?.service_name || createdPlan?.name || 'Davolash'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Treatment List */}
                <div className="p-4 sm:p-5 lg:px-8 bg-slate-50/50">
                  <p className="text-[10px] sm:text-xs font-bold text-blue-500 uppercase tracking-wider mb-4">DAVOLASHLAR RO'YXATI</p>
                  
                  <div className="hidden sm:grid grid-cols-12 gap-2 mb-2 pb-2 border-b border-slate-200">
                    <div className="col-span-8 text-[11px] font-bold text-slate-400 uppercase">Davolash nomi</div>
                    <div className="col-span-4 text-[11px] font-bold text-slate-400 uppercase text-right">Summa</div>
                  </div>

                  <div className="space-y-3 sm:space-y-0">
                    {(() => {
                      let rows = [];
                      (createdPlan?.services || []).forEach((s, i) => {
                        rows.push({ 
                          key: i, 
                          name: s.service_name, 
                          tooth: s.tooth_number ? `Tish #${s.tooth_number}` : 'Umumiy', 
                          price: s.price 
                        });
                      });
                      if (rows.length === 0) {
                        rows.push({ key: 0, name: createdPlan?.name || 'Davolash rejasi', tooth: '—', price: createdPlan?.total_price || 0 });
                      }
                      
                      return rows.map((row, idx) => (
                        <div key={row.key} className={`bg-white sm:bg-transparent rounded-lg sm:rounded-none p-3 border border-slate-100 sm:border-0 sm:border-b sm:border-dashed sm:border-slate-200 sm:p-0 sm:py-2 grid grid-cols-1 sm:grid-cols-12 gap-1 sm:gap-2 items-center`}>
                          <div className="col-span-8">
                            <p className="text-[13px] sm:text-sm font-black text-slate-800 uppercase tracking-tight">{row.name}</p>
                            {row.tooth && row.tooth !== '—' && (
                              <span className="inline-block mt-1 px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[9px] font-bold uppercase">{row.tooth}</span>
                            )}
                          </div>
                          <div className="col-span-4 text-left sm:text-right mt-2 sm:mt-0 pt-2 sm:pt-0 border-t border-slate-100 sm:border-0">
                            <p className="text-[14px] font-black text-slate-900">
                              {(row.price || 0).toLocaleString()} <span className="text-[10px] text-slate-500 font-medium ml-0.5">{t('common.currency')}</span>
                            </p>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>

                  {/* Summary Totals */}
                  <div className="mt-2 sm:mt-4 flex flex-col items-end gap-1.5 pt-2">
                    <div className="flex items-center justify-between w-full sm:w-64 mb-1">
                      <span className="text-[12px] sm:text-sm text-slate-500 font-medium">Jami xizmatlar:</span>
                      <span className="text-[13px] sm:text-sm font-bold text-slate-800">{(createdPlan?.total_price || grandTotal || 0).toLocaleString()} so'm</span>
                    </div>
                    {appliedDiscountAmount > 0 && (
                      <div className="flex items-center justify-between w-full sm:w-64 mb-1">
                        <span className="text-[12px] sm:text-sm text-rose-500 font-bold">
                          {discountPercent > 0 ? `Chegirma (${discountPercent}%):` : 'Chegirma:'}
                        </span>
                        <span className="text-[13px] sm:text-sm font-black text-rose-500">
                          - {appliedDiscountAmount.toLocaleString()} so'm
                        </span>
                      </div>
                    )}
                    {createdPlanAdvanceTotal > 0 && (
                      <div className="flex items-center justify-between w-full sm:w-64 mb-1 border-b border-dashed border-slate-200 pb-2">
                        <span className="text-[12px] sm:text-sm text-emerald-600 font-bold">
                          Boshlang'ich to'lov:
                        </span>
                        <span className="text-[13px] sm:text-sm font-black text-emerald-600">
                          - {createdPlanAdvanceTotal.toLocaleString()} so'm
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Final Total */}
                <div className="p-4 sm:p-6 lg:px-8 border-t border-slate-100 bg-white">
                  <div className="bg-slate-900 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg relative overflow-hidden">
                    {appliedDiscountAmount > 0 && (
                      <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500 rounded-full blur-[40px] opacity-20 -mr-10 -mt-10 pointer-events-none"></div>
                    )}
                    <div className="z-10">
                      <p className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-widest">JAMI TO'LOV (QARZ)</p>
                      <p className="text-[12px] text-yellow-400 font-semibold mt-0.5">To'lov kutilmoqda</p>
                    </div>
                    <div className="text-left sm:text-right z-10 w-full sm:w-auto flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start -mt-1 sm:mt-0">
                      {appliedDiscountAmount > 0 && (
                        <p className="text-[12px] text-slate-400 line-through font-medium sm:mb-1 opacity-80">
                          {(createdPlan?.total_price || grandTotal || 0).toLocaleString()}
                        </p>
                      )}
                      <p className="text-2xl sm:text-3xl font-black text-white">
                        {((createdPlan?.total_price || grandTotal || 0) - appliedDiscountAmount - createdPlanAdvanceTotal).toLocaleString()} 
                        <span className="text-sm font-medium text-slate-400 ml-1">so'm</span>
                      </p>
                    </div>
                  </div>

                  {/* Signatures for Page 1 */}
                  <div className="grid grid-cols-2 gap-8 mt-6">
                    <div className="flex flex-col items-center">
                      <div className="w-full border-b border-slate-300 mb-1 h-[25px]" />
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">Shifokor imzosi</p>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className="w-full border-b border-slate-300 mb-1 h-[25px]" />
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">Bemor imzosi</p>
                    </div>
                  </div>
                </div>

                {/* Installment Schedule Section (Page 2) */}
                {isInstallment && (
                  <div className="page-break p-4 sm:p-6 lg:px-8 bg-white border-t border-slate-100 sm:border-t-0">
                    {/* Page 2 Header */}
                    <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                         <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white">
                           <Calendar className="w-5 h-5" />
                         </div>
                         <div>
                           <h4 className="text-[12px] font-black text-slate-800 uppercase tracking-widest">To'lovlar grafigi</h4>
                           <p className="text-[10px] text-slate-500 font-bold uppercase">{createdPatient?.full_name}</p>
                         </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] font-black text-slate-400 uppercase">№ {createdPlan?.id ? createdPlan.id.split('-').pop()?.toUpperCase() : String(Date.now()).slice(-6)}</p>
                        <p className="text-[10px] font-bold text-slate-800">{new Date().getDate()}-{(['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'])[new Date().getMonth()]}, {new Date().getFullYear()}</p>
                      </div>
                    </div>

                    <div className="border border-blue-100 rounded-2xl overflow-hidden shadow-sm">
                      <div className="bg-blue-600 px-4 py-2.5 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-white" />
                        <span className="text-[10px] font-black text-white uppercase tracking-widest">MUDDATLI TO'LOV GRAFIGI</span>
                      </div>
                      
                      {/* Summary for Installment */}
                      <div className="bg-blue-50/50 p-4 border-b border-blue-100 grid grid-cols-3 gap-4">
                        <div>
                          <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">Umumiy summa</p>
                          <p className="text-[13px] font-black text-slate-800">
                            {((createdPlan?.total_price || grandTotal || 0) - appliedDiscountAmount).toLocaleString()} <span className="text-[10px] opacity-50">so'm</span>
                          </p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">Boshlang'ich to'lov</p>
                          <p className="text-[13px] font-black text-emerald-600">
                            {createdPlanAdvanceTotal.toLocaleString()} <span className="text-[10px] opacity-50">so'm</span>
                          </p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">Qolgan qarz</p>
                          <p className="text-[13px] font-black text-rose-600">
                            {((createdPlan?.total_price || grandTotal || 0) - createdPlanAdvanceTotal - appliedDiscountAmount).toLocaleString()} <span className="text-[10px] opacity-50">so'm</span>
                          </p>
                        </div>
                      </div>

                      <div className="p-0">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="bg-blue-50/50 border-b border-blue-100">
                              <th className="px-4 py-2 text-[10px] font-bold text-blue-600 uppercase">Bosqich</th>
                              <th className="px-4 py-2 text-[10px] font-bold text-blue-600 uppercase">Sana</th>
                              <th className="px-4 py-2 text-[10px] font-bold text-blue-600 uppercase text-right">Summa</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              const totalToPay = (createdPlan?.total_price || grandTotal || 0) - createdPlanAdvanceTotal - appliedDiscountAmount;
                              const standardMonthly = Math.floor(totalToPay / installmentMonths);
                              const remainder = totalToPay - (standardMonthly * installmentMonths);

                              return Array.from({ length: installmentMonths }).map((_, i) => {
                                const d = new Date(installmentStartDate);
                                d.setMonth(d.getMonth() + i);
                                const lastDayOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
                                d.setDate(Math.min(installmentDay || 15, lastDayOfMonth));
                                
                                const monthly = (i === installmentMonths - 1) ? standardMonthly + remainder : standardMonthly;
                                
                                return (
                                  <tr key={i} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                                    <td className="px-4 py-3 text-[11px] font-black text-slate-700">{i + 1}-oy to'lovi</td>
                                    <td className="px-4 py-3 text-[11px] text-slate-500 font-medium">
                                      {d.getDate()}-{(['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'])[d.getMonth()]}, {d.getFullYear()}
                                    </td>
                                    <td className="px-4 py-3 text-[11px] font-black text-slate-900 text-right">
                                      {monthly.toLocaleString()} <span className="text-[9px] opacity-30">so'm</span>
                                    </td>
                                  </tr>
                                );
                              });
                            })()}
                          </tbody>
                        </table>
                      </div>
                      <div className="bg-slate-50 px-4 py-3 border-t border-slate-100 italic">
                        <p className="text-[10px] text-slate-400 font-black tracking-tight">* To'lovlarni o'z vaqtida amalga oshirishingizni so'raymiz.</p>
                      </div>
                    </div>

                    {/* Signatures for Page 2 */}
                    <div className="grid grid-cols-2 gap-8 mt-16 p-2">
                      <div className="flex flex-col items-center">
                        <div className="w-full border-b border-slate-300 mb-2 h-[45px]" />
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Shifokor imzosi</p>
                      </div>
                      <div className="flex flex-col items-center">
                        <div className="w-full border-b border-slate-300 mb-2 h-[45px]" />
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Bemor imzosi</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Telegram Bot Connection (Professional UI) - No Print */}
                <div className="p-5 border-t border-slate-100 bg-blue-50/50 no-print">
                  <div className="max-w-md mx-auto">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-blue-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
                        <MessageCircle className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-black text-blue-900 uppercase tracking-tight">Eslatmalar tizimi</p>
                        <p className="text-[11px] text-blue-700 font-medium">Bemorga Telegram bot linkini yuboring</p>
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-3">
                      <div className="bg-white p-3.5 rounded-2xl border border-blue-100 flex items-center justify-between gap-3 shadow-sm">
                        <span className="text-[11px] font-mono text-blue-600 truncate flex-1 font-bold">
                           {getTelegramDeepLink(createdPatient?.id) || "Bot havolasi topilmadi (Telegram Bot sozlamasida token/username tekshiring)"}
                        </span>
                        <Button 
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const link = getTelegramDeepLink(createdPatient?.id);
                            if (!link) return;
                            navigator.clipboard.writeText(link);
                            toast.success("Havola nusxalandi!");
                          }}
                          className="h-8 w-8 p-0 hover:bg-blue-50 text-blue-500 rounded-xl"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                      
                      <Button 
                        type="button"
                        onClick={() => {
                          const link = getTelegramDeepLink(createdPatient?.id);
                          if (!link) return;
                          window.open(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent("Assalomu alaykum! Klinikadan avtomatik eslatmalar olish uchun botimizga qo'shiling:")}`, '_blank');
                        }}
                        className="w-full bg-blue-600 hover:bg-blue-700 h-12 rounded-2xl text-[11px] font-black uppercase tracking-widest gap-2 shadow-lg shadow-blue-200 transition-all active:scale-[0.98]"
                      >
                        <Share2 className="w-4 h-4" />
                        Telegramga yuborish
                      </Button>

                      {/* QR Kod */}
                      <button
                        type="button"
                        onClick={() => setShowQr(v => !v)}
                        className="w-full flex items-center justify-center gap-2 h-10 rounded-2xl border border-blue-200 text-blue-600 text-[11px] font-black uppercase tracking-widest hover:bg-blue-50 transition-all"
                      >
                        <QrCode className="w-4 h-4" />
                        {showQr ? 'QR kodni yashirish' : 'QR kod ko\'rsatish'}
                      </button>

                      {showQr && getTelegramDeepLink(createdPatient?.id) && (
                        <div className="flex flex-col items-center gap-2 pt-2">
                          <div className="bg-white p-3 rounded-2xl border border-blue-100 shadow-sm">
                            <QRCodeSVG
                              id="flow-qr-svg"
                              value={getTelegramDeepLink(createdPatient?.id)}
                              size={160}
                              level="M"
                              includeMargin={false}
                            />
                          </div>
                          <p className="text-[10px] font-bold text-blue-600 text-center">
                            Skaner qiling → Bot avtomatik ulanganda
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Actions Section */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-3 mt-6 no-print">
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                  <button
                    onClick={handleDownloadImage}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[#10b981] hover:bg-[#059669] text-white py-3 px-6 rounded-xl font-[900] shadow-lg shadow-emerald-100 transition-all active:scale-95 text-xs uppercase tracking-wider"
                  >
                    <Download className="w-4 h-4" /> {t('common.save')}
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white py-3 px-6 rounded-xl font-[900] shadow-lg shadow-blue-100 transition-all active:scale-95 text-xs uppercase tracking-wider"
                  >
                    <Printer className="w-4 h-4" /> {t('common.print')}
                  </button>
                  <button
                    onClick={handleClose}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white py-3 px-8 rounded-xl font-[900] shadow-lg transition-all active:scale-95 text-xs uppercase tracking-wider"
                  >
                    <Check className="w-4 h-4 text-emerald-400" /> {t('common.finish')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
