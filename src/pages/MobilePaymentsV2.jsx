import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRestorableState } from '@/hooks/useRestorableState';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowUpRight, ArrowDownRight, Wallet, TrendingUp, TrendingDown,
  Plus, Search, FileText, Stethoscope, X, User, Clock, Calendar,
  Check, CreditCard, AlertTriangle, Receipt, Camera, ImagePlus, Eye, Trash2, Download, Loader2, CalendarDays, ChevronRight
} from 'lucide-react';
import TreatmentPlanInvoice from '@/components/treatments/TreatmentPlanInvoice';
import { base44 } from '@/api/base44Client';
import { compressImage, validateImage } from '@/utils/imageUpload';
import { Button } from '@/components/ui/button';
import { cn, formatCurrency, resolveDoctorId, getTreatmentTypeLabel } from '@/lib/utils';
import { paymentStamp, formatClinicDateTime, tashkentToday } from '@/lib/clinicTime';
import { computePatientBalances, unionPayments, isLinkedPlanInternal } from '@/lib/paymentDebt';
import { Input } from '@/components/ui/input';
import { ClinicDateTimeField } from '@/components/ui/ClinicDateField';
import { allocateInvoicePayment } from '@/lib/invoiceAllocation';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';
import PatientSelect from '@/components/patients/PatientSelect';
import { useTranslation } from '@/i18n/LanguageContext';
import PullToRefresh from '@/components/ui/PullToRefresh';
import MobilePayView from '@/components/payments/MobilePayView';
import '@/components/payments/paymentAddModal.css';

const PAYMENT_ADD_MARKER = 'payment-add-teal-v5-single-center';
const PAYMENT_QUICK_AMOUNTS = [50000, 100000, 500000, 1000000];
const paymentAddDialogStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 0,
  padding: 0,
  paddingBottom: 0,
  overflow: 'hidden',
  minHeight: 0,
};

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
  
  const prefixMatch = category.match(/^(Muddatli to'lov:\s*|Boshlang'ich to'lov:\s*|Reja yangilandi:\s*|Reja:\s*)/i);
  const prefix = prefixMatch ? prefixMatch[0] : '';
  const remaining = prefixMatch ? category.slice(prefixMatch[0].length) : category;
  
  const toothMatch = remaining.match(/\s*\(#\d+\)$/);
  const toothSuffix = toothMatch ? toothMatch[0] : '';
  
  const baseName = toothMatch ? remaining.slice(0, toothMatch.index) : remaining;
  
  const parts = baseName.split(',').map(p => {
    const trimmed = p.trim();
    const cleanWord = trimmed.toLowerCase();
    return CATEGORY_TRANSLATIONS[cleanWord] || getTreatmentTypeLabel(trimmed, 'uz');
  }).filter(Boolean);
  
  let translatedBase = '';
  if (parts.length <= 2) {
    translatedBase = parts.join(', ');
  } else {
    translatedBase = parts.slice(0, 2).join(', ') + ` +${parts.length - 2} ta`;
  }
  
  return prefix ? `${prefix.trim()}: ${translatedBase}${toothSuffix}` : translatedBase + toothSuffix;
};

const extractPaymentProcedures = (payment) => {
  const raw = payment?.service_name || payment?.category || '';
  if (!raw) return [];

  const cleaned = raw
    .replace(/^(Muddatli to'lov:\s*|Boshlang'ich to'lov:\s*|Reja yangilandi:\s*|Reja:\s*)/i, '')
    .replace(/\s*\(#\d+\)$/i, '')
    .replace(/\r?\n+/g, ', ')
    .replace(/\s+—\s+/g, ', ');

  const items = cleaned
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return items.length ? items : [cleaned.trim()];
};

const getPaymentMethodLabel = (method) => {
  if (method === 'Card') return 'Karta';
  if (method === 'Transfer') return 'O‘tkazma';
  if (method === 'Cash') return 'Naqd';
  return method || '—';
};

const sanitizeAmountInput = (value) => String(value || '').replace(/[^\d]/g, '');

const formatAmountInput = (value) => {
  const digits = sanitizeAmountInput(value);
  if (!digits) return '';
  return Number(digits).toLocaleString('ru-RU');
};

const parseAmountInput = (value) => Number(sanitizeAmountInput(value)) || 0;

const getLocalDatetimeString = () => {
  const tzoffset = (new Date()).getTimezoneOffset() * 60000;
  return (new Date(Date.now() - tzoffset)).toISOString().slice(0, 16);
};

/**
 * Premium SaaS Mobile Payments
 * Modern financial dashboard with transaction management
 */
export default function MobilePaymentsV2() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isDoctor } = useAuth();
  const [payments, setPayments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(false);
  const loadingTimerRef = useRef(null);
  const hasLoadedInitial = useRef(false);
  const [searchQuery, setSearchQuery] = useRestorableState('searchQuery', '');
  const [filterType, setFilterType] = useRestorableState('filterType', 'all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [formError, setFormError] = useState('');
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [saving, setSaving] = useState(false);
  const [patientBalances, setPatientBalances] = useState({});
  const [patientCurrentTotals, setPatientCurrentTotals] = useState({});
  const [stats, setStats] = useState({ totalRevenue: 0, monthRevenue: 0, todayRevenue: 0 });

  const loadStats = useCallback(async () => {
    try {
      const today = tashkentToday();
      const allPays = isDoctor && user?.id
        ? await base44.entities.Payment.filter({ doctor_id: user.id }, '-date', 500, 0).catch(() => [])
        : await base44.entities.Payment.list('-date', 500, 0);
      const filteredStats = (allPays || []).filter(p => {
        if (isDoctor && user?.id && String(p.doctor_id) !== String(user.id)) return false;
        return true;
      });
      const incomePays = filteredStats.filter(p => !p.type || p.type?.toLowerCase() === 'income');

      const totalRevenue = incomePays.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const monthRevenue = incomePays
        .filter(p => (p.date || '').slice(0, 7) === today.slice(0, 7))
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const todayRevenue = incomePays
        .filter(p => (p.date || '').slice(0, 10) === today)
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

      setStats({ totalRevenue, monthRevenue, todayRevenue });
    } catch (err) {
      console.error('Stats load error:', err);
    }
  }, [isDoctor, user]);

  useEffect(() => {
    if (!payments.length) return;
    let active = true;
    (async () => {
      try {
        const [allPays, allPlans] = await Promise.all([
          base44.entities.Payment.list('-created_date', 1000).catch(() => payments),
          base44.entities.TreatmentPlan.list('-created_date', 500).catch(() => []),
        ]);
        const { balances, totals } = computePatientBalances(unionPayments(allPays, payments), allPlans || []);
        if (active) {
          setPatientBalances(balances);
          setPatientCurrentTotals(totals);
        }
      } catch (err) {
        console.error("Error calculating patient running balances:", err);
      }
    })();
    return () => { active = false; };
  }, [payments]);

  const [selectedPaymentPatientData, setSelectedPaymentPatientData] = useState(null);

  useEffect(() => {
    if (!selectedPayment?.patient_id) {
      setSelectedPaymentPatientData(null);
      return;
    }
    let isMounted = true;
    (async () => {
      try {
        const [allPays, allPlans] = await Promise.all([
          base44.entities.Payment.filter({ patient_id: selectedPayment.patient_id }, 'date', 5000),
          base44.entities.TreatmentPlan.filter({ patient_id: selectedPayment.patient_id }, '-created_date', 100).catch(() => [])
        ]);
        if (!isMounted) return;
        const paysList = allPays || [];
        const plansList = allPlans || [];

        const getPlanOriginalPrice = (plan) => {
          if (!plan) return 0;
          const sSum = (plan.services || []).reduce((acc, item) => {
            if (item.price) return acc + (Number(item.price) || 0);
            if (item.items && Array.isArray(item.items)) {
              return acc + item.items.reduce((iAcc, i) => iAcc + (Number(i.price) || 0), 0);
            }
            return acc;
          }, 0);
          const dAmt = Number(plan.discount_amount) || 0;
          const pTot = Number(plan.total_price) || 0;
          const pct = Number(plan.discount_percent) || 0;
          if (sSum > 0 && sSum >= pTot) return sSum;
          if (dAmt > 0) return pTot + dAmt;
          if (pct > 0 && pTot > 0 && pct < 100) return Math.round(pTot / (1 - pct / 100));
          return pTot || sSum;
        };

        const linkedPlan = plansList.find(pl => (selectedPayment.plan_id && pl.id === selectedPayment.plan_id) || (selectedPayment.notes && selectedPayment.notes.includes(pl.id)));
        const targetPlans = linkedPlan ? [linkedPlan] : plansList;

        let originalPrice = 0;
        let finalPlanTotal = 0;
        let discountAmount = 0;
        let discountPercent = 0;

        if (targetPlans.length > 0) {
          originalPrice = targetPlans.reduce((sum, pl) => sum + getPlanOriginalPrice(pl), 0);
          finalPlanTotal = targetPlans.reduce((sum, pl) => sum + (Number(pl.total_price) || getPlanOriginalPrice(pl)), 0);
          discountAmount = Math.max(0, originalPrice - finalPlanTotal);
          if (discountAmount === 0) {
            discountAmount = targetPlans.reduce((sum, pl) => sum + (Number(pl.discount_amount) || 0), 0);
            if (discountAmount > 0) originalPrice = finalPlanTotal + discountAmount;
          }
          discountPercent = originalPrice > 0 ? Math.round((discountAmount / originalPrice) * 100) : (targetPlans[0]?.discount_percent || 0);
        } else {
          const totalDebts = paysList.filter(pay => pay.type?.toLowerCase() === 'debt').reduce((s, pay) => s + (Number(pay.amount) || 0), 0);
          const totalDiscountPayments = paysList.filter(pay => pay.type?.toLowerCase() === 'discount').reduce((s, pay) => s + Math.abs(Number(pay.amount) || 0), 0);
          originalPrice = totalDebts > 0 ? totalDebts + totalDiscountPayments : (Number(selectedPayment.amount) || 0);
          discountAmount = totalDiscountPayments;
          finalPlanTotal = Math.max(0, originalPrice - discountAmount);
          discountPercent = originalPrice > 0 ? Math.round((discountAmount / originalPrice) * 100) : 0;
        }

        setSelectedPaymentPatientData({
          originalPrice,
          finalPlanTotal,
          totalDiscount: discountAmount,
          discountPercent,
        });
      } catch (err) {
        console.error('Error loading mobile payment patient data:', err);
      }
    })();
    return () => { isMounted = false; };
  }, [selectedPayment]);

  const [patientPlans, setPatientPlans] = useState([]);
  const [patientAllPlans, setPatientAllPlans] = useState([]);
  const [patientPayments, setPatientPayments] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [selectedPlanServiceIds, setSelectedPlanServiceIds] = useState([]);
  const [payMode, setPayMode] = useState('services');
  const [paySelKeys, setPaySelKeys] = useState([]);
  const [patientServices, setPatientServices] = useState([]);
  const [selectedPlanForInvoice, setSelectedPlanForInvoice] = useState(null);
  const [showPlanInvoiceModal, setShowPlanInvoiceModal] = useState(false);
  
  // Automatically open modal if requested in navigation state
  // Open the pay sheet when navigated here with openAddModal (e.g. from Bosh sahifa).
  // The page can mount more than once right after navigation, so a request stays
  // valid for a few seconds (per location.key, in sessionStorage); later reloads of
  // the same history entry do not reopen it. We no longer navigate() to clear the
  // state, which remounted the page and closed the sheet.
  const openRequestKey = location.state?.openAddModal ? `payments-open-consumed:${location.key}` : null;
  useEffect(() => {
    if (!openRequestKey) return;
    try {
      const seen = Number(sessionStorage.getItem(openRequestKey) || 0);
      if (seen && Date.now() - seen > 4000) return;
      if (!seen) sessionStorage.setItem(openRequestKey, String(Date.now()));
    } catch { /* ignore */ }
    setShowAddModal(true);
  }, [openRequestKey]);
  const closeAddModal = () => {
    if (openRequestKey) { try { sessionStorage.setItem(openRequestKey, '1'); } catch { /* ignore */ } }
    setShowAddModal(false);
  };

  // Handle modal opening, reset, and prefill
  useEffect(() => {
    if (showAddModal) {
      toast.dismiss('implant-incomplete-notification');
      setFormError('');
      const prefillPatient = location.state?.prefillPatient || '';
      const prefillAmount = location.state?.prefillAmount || '';
      const prefillCategory = location.state?.prefillCategory || 'Treatment';
      const prefillDoctor = location.state?.prefillDoctor || '';
      const prefillNotes = location.state?.prefillNotes || '';

      setFormData({
        patient_id: prefillPatient,
        doctor_id: prefillDoctor,
        type: 'Income',
        amount: prefillAmount,
        method: 'Cash',
        category: prefillCategory,
        date: getLocalDatetimeString(),
        notes: prefillNotes,
        receipt_url: ''
      });
      setPayMode('services');
      setPaySelKeys([]);
      setSelectedPlanId('');
      setSelectedPlanServiceIds([]);
      setPatientPlans([]);
      setPatientAllPlans([]);
      setPatientServices([]);
      setPatientPayments([]);

    }
  }, [showAddModal]);

  // Form state
  const [formData, setFormData] = useState({
    patient_id: '',
    doctor_id: '',
    type: 'Income',
    amount: '',
    method: 'Cash',
    category: 'Treatment',
    date: getLocalDatetimeString(),
    notes: '',
    receipt_url: ''
  });
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [previewReceiptUrl, setPreviewReceiptUrl] = useState(null);
  const receiptFileInputRef = useRef(null);

  const loadData = useCallback(async () => {
    try {
      if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
      if (!hasLoadedInitial.current) {
        loadingTimerRef.current = setTimeout(() => {
          setLoading(true);
        }, 150);
      }
      const filter = isDoctor ? { doctor_id: user.id } : {};
      const [pays, pats, allUsers] = await Promise.all([
        base44.entities.Payment.filter(filter, '-date', 100),
        base44.entities.Patient.list('-created_date', 50),
        base44.entities.User.list('name', 100).catch(() => base44.entities.User.filter({ role: 'doctor' }, 'name', 50)),
        loadStats()
      ]);
      const docs = (allUsers || []).filter(u => u.role?.toLowerCase() === 'doctor' || u.role?.toLowerCase() === 'admin');
      setPayments(pays);
      setPatients(pats);
      setDoctors(docs.length > 0 ? docs : (allUsers || []));
      hasLoadedInitial.current = true;
    } catch (error) {
      console.error('Failed to load payments:', error);
    } finally {
      if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
      setLoading(false);
    }
  }, [isDoctor, user, loadStats]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter payments
  const filteredPayments = payments.filter(p => {
    const t = String(p.type || 'Income').toLowerCase();
    // Desktop only allows income, expense, and refund in displayPayments
    if (!(t === 'income' || t === 'expense' || t === 'refund')) return false;

    const matchesSearch = (p.patient_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (p.category || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || p.type === filterType;
    return matchesSearch && matchesType;
  });

  const selectedPatient = useMemo(
    () => patients.find((patient) => patient.id === formData.patient_id) || null,
    [patients, formData.patient_id]
  );

  const selectedPatientDebt = useMemo(() => {
    if (!formData.patient_id) return 0;
    
    const paymentsList = patientPayments;
    const plansList = patientAllPlans;

    const totalIncomes = paymentsList
      .filter(p => p.type?.toLowerCase() === 'income')
      .reduce((s, p) => s + (Number(p.amount) || 0), 0);

    const totalDebts = paymentsList
      .filter(p => p.type?.toLowerCase() === 'debt')
      .reduce((s, p) => s + (Number(p.amount) || 0), 0);

    const totalRefunds = paymentsList
      .filter(p => p.type?.toLowerCase() === 'refund')
      .reduce((s, p) => s + (Number(p.amount) || 0), 0);

    const totalDiscounts = paymentsList
      .filter(p => p.type?.toLowerCase() === 'discount')
      .reduce((s, p) => s + Math.abs(Number(p.amount) || 0), 0);

    let calculatedDebt = 0;
    if (totalDebts > 0) {
      const net = totalIncomes + totalDiscounts - totalDebts - totalRefunds;
      calculatedDebt = net < 0 ? Math.abs(net) : 0;
    } else if (plansList.length > 0) {
      const totalPlansPrice = plansList.reduce((sum, plan) => sum + (Number(plan.total_price) || 0), 0);
      const net = totalIncomes + totalDiscounts - totalPlansPrice;
      calculatedDebt = net < 0 ? Math.abs(net) : 0;
    } else {
      const net = totalIncomes - totalRefunds;
      calculatedDebt = net < 0 ? Math.abs(net) : 0;
    }
    
    return calculatedDebt;
  }, [formData.patient_id, patientPayments, patientAllPlans]);

  const isIncomeBlockedForPatient = formData.type === 'Income' && !!formData.patient_id && selectedPatientDebt <= 0;

  // Type configurations
  const typeConfig = {
    'Income': { 
      bg: 'bg-emerald-50', 
      border: 'border-emerald-200',
      text: 'text-emerald-700',
      icon: ArrowUpRight,
      label: t('payments.types.Income'),
      color: '#10b981'
    },
    'Expense': { 
      bg: 'bg-slate-100', 
      border: 'border-slate-200',
      text: 'text-slate-700',
      icon: ArrowDownRight,
      label: t('payments.types.Expense'),
      color: '#64748b'
    },
    'Debt': { 
      bg: 'bg-rose-50', 
      border: 'border-rose-200',
      text: 'text-rose-700',
      icon: ArrowDownRight,
      label: t('payments.types.Debt'),
      color: '#f43f5e'
    },
    'Refund': { 
      bg: 'bg-amber-50', 
      border: 'border-amber-200',
      text: 'text-amber-700',
      icon: ArrowDownRight,
      label: t('payments.types.Refund'),
      color: '#f59e0b'
    },
    'Discount': { 
      bg: 'bg-purple-50', 
      border: 'border-purple-200',
      text: 'text-purple-700',
      icon: TrendingDown,
      label: t('status.Discount'),
      color: '#a855f7'
    }
  };

  const getTypeStyle = (type) => typeConfig[type] || typeConfig['Income'];

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '';
    const text = formatClinicDateTime(dateStr);
    return text === '—' ? '' : text.replace(' ', ' • ');
  };

  // Fetch patient plans, payments and services when patient changes
  useEffect(() => {
    if (formData.patient_id && (formData.type === 'Income' || formData.type === 'Debt')) {
      const fetchPlansAndServices = async () => {
        try {
          const [plans, patientPays] = await Promise.all([
            base44.entities.TreatmentPlan.filter({ patient_id: formData.patient_id }, '-created_date', 50),
            base44.entities.Payment.filter({ patient_id: formData.patient_id }, '-date', 500)
          ]);
          
          setPatientAllPlans(plans || []);
          setPatientPlans((plans || []).filter(p => (p.paid_amount || 0) < p.total_price));
          setPatientPayments(patientPays || []);
          
          const unpaidServices = [];
          (plans || []).forEach(plan => {
            (plan.services || []).forEach(svc => {
              if (svc.payment_status !== 'paid') {
                unpaidServices.push({
                  id: `${plan.id}_${svc.service_id || svc.service_name}`,
                  service_name: svc.service_name || svc.name || '—',
                  price: svc.price || 0,
                  plan_id: plan.id,
                  plan_name: plan.name,
                  tooth_number: plan.tooth_number || '',
                });
              }
            });
          });
          setPatientServices(unpaidServices);

          const incomes = (patientPays || []).filter(p => p.type?.toLowerCase() === 'income').reduce((s, p) => s + (Number(p.amount) || 0), 0);
          const debts = (patientPays || []).filter(p => p.type?.toLowerCase() === 'debt').reduce((s, p) => s + (Number(p.amount) || 0), 0);
          const refunds = (patientPays || []).filter(p => p.type?.toLowerCase() === 'refund').reduce((s, p) => s + (Number(p.amount) || 0), 0);
          const discounts = (patientPays || []).filter(p => p.type?.toLowerCase() === 'discount').reduce((s, p) => s + Math.abs(Number(p.amount) || 0), 0);
          const plansPrice = (plans || []).reduce((sum, plan) => sum + (Number(plan.total_price) || 0), 0);
          let openedDebt = 0;
          if (debts > 0) {
            const net = incomes + discounts - debts - refunds;
            openedDebt = net < 0 ? Math.abs(net) : 0;
          } else if ((plans || []).length > 0) {
            const net = incomes + discounts - plansPrice;
            openedDebt = net < 0 ? Math.abs(net) : 0;
          } else {
            const net = incomes - refunds;
            openedDebt = net < 0 ? Math.abs(net) : 0;
          }
          if (false && openedDebt > 0) { // audit: never prefill the whole debt
            setFormData(prev => {
              if (String(prev.patient_id) !== String(formData.patient_id)) return prev;
              if (selectedPlanId) return prev;
              if (prev.amount !== '' && prev.amount != null && Number(prev.amount) !== 0) return prev;
              return { ...prev, amount: String(Math.round(openedDebt)) };
            });
          }

          // Shifokorni avtomatik biriktirish (agar tanlanmagan bo'lsa yoki noto'g'ri bo'lsa)
          const currentPat = patients.find(p => p.id === formData.patient_id);
          const autoDocId = resolveDoctorId(currentPat, plans, doctors, user, isDoctor);
          if (autoDocId) {
            setFormData(prev => {
              const currentIsValid = prev.doctor_id && doctors.some(d => String(d.id) === String(prev.doctor_id));
              if (!prev.doctor_id || !currentIsValid) {
                return { ...prev, doctor_id: autoDocId };
              }
              return prev;
            });
          }
        } catch (error) {
          console.error('Error fetching patient plans & services:', error);
          setPatientServices([]);
        }
      };
      fetchPlansAndServices();
    } else {
      setPatientPlans([]);
      setPatientAllPlans([]);
      setPatientServices([]);
      setPatientPayments([]);
      setSelectedPlanId('');
    }
  }, [formData.patient_id, formData.type, doctors, isDoctor, patients, user]);

  const handlePlanSelect = (planId) => {
    setSelectedPlanId(planId);
    const plan = patientPlans.find(p => p.id === planId);
    if (plan) {
      const serviceIds = (plan.services || [])
        .map((s, i) => s.payment_status !== 'paid' ? i : -1)
        .filter(i => i !== -1);
      setSelectedPlanServiceIds(serviceIds);
      
      const total = (plan.services || []).reduce((sum, s) => sum + (s.price || 0), 0);
      const remainingAmount = Math.max(0, total - (plan.paid_amount || 0));
      
      // Build category from plan name + tooth
      const planCategory = plan.tooth_number
        ? `${plan.name} (#${plan.tooth_number})`
        : plan.name;
      const planDocId = resolveDoctorId(null, [plan], doctors, user, isDoctor);
      setFormData(prev => ({
        ...prev,
        amount: String(Math.round(remainingAmount)),
        category: planCategory,
        notes: t('payments.planSelect') + `: ${plan.name}`,
        doctor_id: planDocId || prev.doctor_id || ''
      }));
    } else {
      setSelectedPlanServiceIds([]);
      setFormData(prev => ({
        ...prev,
        amount: selectedPatientDebt > 0 ? String(selectedPatientDebt) : '',
        category: 'Treatment',
        notes: '',
      }));
    }
  };

  const togglePlanService = (idx) => {
    const plan = patientPlans.find(p => p.id === selectedPlanId);
    if (!plan) return;

    let newIds;
    if (selectedPlanServiceIds.includes(idx)) {
      newIds = selectedPlanServiceIds.filter(id => id !== idx);
    } else {
      newIds = [...selectedPlanServiceIds, idx];
    }
    setSelectedPlanServiceIds(newIds);
    
    // Recalculate amount
    const total = newIds.reduce((sum, i) => sum + (plan.services[i].price || 0), 0);
    const selectedNames = newIds.map(i => plan.services[i].service_name).join(', ');
    
    // Category = selected service names + tooth
    const serviceCategory = plan.tooth_number
      ? `${selectedNames} (#${plan.tooth_number})`
      : selectedNames || plan.name;
    setFormData(prev => ({
      ...prev,
      amount: String(Math.round(total)),
      category: serviceCategory,
      notes: `${t('payments.planSelect')} (${plan.name}): ${selectedNames}`
    }));
  };

  const doctorsById = useMemo(() => Object.fromEntries((doctors || []).map(d => [d.id, d])), [doctors]);

  // Services mode: amount = sum of selected open services. Explicit service marking
  // (payment_status) only within one plan, as before; across plans the payment is
  // distributed by allocateInvoicePayment.
  const applyServiceSelection = (keys, rows) => {
    setPaySelKeys(keys);
    setFormError('');
    const picked = rows.filter(r => keys.includes(r.key));
    const total = picked.reduce((s, r) => s + r.amount, 0);
    const planIds = [...new Set(picked.map(r => r.planId))];
    const onePlan = planIds.length === 1 ? patientAllPlans.find(p => p.id === planIds[0]) : null;
    setSelectedPlanId(onePlan ? onePlan.id : '');
    setSelectedPlanServiceIds(onePlan ? picked.map(r => r.idx) : []);
    const names = picked.map(r => r.name).join(', ');
    setFormData(prev => ({
      ...prev,
      amount: total > 0 ? String(Math.round(total)) : '',
      category: picked.length ? (onePlan?.tooth_number ? `${names} (#${onePlan.tooth_number})` : names) : 'Treatment',
      notes: picked.length ? `${t('payments.planSelect')}${onePlan ? ` (${onePlan.name})` : ''}: ${names}` : '',
      doctor_id: onePlan ? (resolveDoctorId(null, [onePlan], doctors, user, isDoctor) || prev.doctor_id || '') : prev.doctor_id,
    }));
  };

  // Handle add payment
  const handleAddPayment = async () => {
    const parsedAmount = parseAmountInput(formData.amount);

    if (!parsedAmount || parsedAmount <= 0) {
      setFormError(t('payments.formErrorAmount'));
      return;
    }

    setSaving(true);
    try {
      const patient = patients.find(p => p.id === formData.patient_id);
      
      let newDebt = 0;
      let newPaid = 0;
      let currentDebt = 0;

      if (formData.patient_id) {
        // Fetch all plans and payments to calculate actual remaining debt
        const [plans, patientPays] = await Promise.all([
          base44.entities.TreatmentPlan.filter({ patient_id: formData.patient_id }, '-created_date', 50),
          base44.entities.Payment.filter({ patient_id: formData.patient_id }, '-date', 500)
        ]);

        const totalIncomes = (patientPays || [])
          .filter(p => p.type?.toLowerCase() === 'income')
          .reduce((s, p) => s + (Number(p.amount) || 0), 0);

        const totalDebts = (patientPays || [])
          .filter(p => p.type?.toLowerCase() === 'debt')
          .reduce((s, p) => s + (Number(p.amount) || 0), 0);

        const totalRefunds = (patientPays || [])
          .filter(p => p.type?.toLowerCase() === 'refund')
          .reduce((s, p) => s + (Number(p.amount) || 0), 0);

        // Plan-linked discount rows (wizard "Avtomatik chegirma") are already inside that plan's Debt row.
        const totalDiscounts = (patientPays || [])
          .filter(p => p.type?.toLowerCase() === 'discount' && !isLinkedPlanInternal(p, 'discount'))
          .reduce((s, p) => s + Math.abs(Number(p.amount) || 0), 0);

        if (totalDebts > 0) {
          const net = totalIncomes + totalDiscounts - totalDebts - totalRefunds;
          currentDebt = net < 0 ? Math.abs(net) : 0;
        } else if ((plans || []).length > 0) {
          const totalPlansPrice = (plans || []).reduce((sum, plan) => sum + (Number(plan.total_price) || 0), 0);
          const net = totalIncomes + totalDiscounts - totalPlansPrice;
          currentDebt = net < 0 ? Math.abs(net) : 0;
        } else {
          const net = totalIncomes - totalRefunds;
          currentDebt = net < 0 ? Math.abs(net) : 0;
        }

        if (formData.type === 'Income') {
          if (currentDebt <= 0) {
            setFormError(t('payments.formErrorNoDebt'));
            return;
          }

          if (parsedAmount > currentDebt) {
            setFormError(t('payments.formErrorOverDebt', { amount: currentDebt.toLocaleString() }));
            return;
          }
        }

        // Calculate new paid/debt values for patient update
        const patientFilterRes = await base44.entities.Patient.filter({ id: formData.patient_id });
        const ptRecord = patientFilterRes?.[0] || null;
        const dbPaid = ptRecord ? (Number(ptRecord.total_paid) || 0) : 0;
        
        const payType = (formData.type || 'Income').toLowerCase();
        if (payType === 'income') {
          newPaid = dbPaid + parsedAmount;
          newDebt = Math.max(0, currentDebt - parsedAmount);
        } else if (payType === 'debt') {
          newDebt = currentDebt + parsedAmount;
          newPaid = dbPaid;
        } else if (payType === 'discount') {
          newDebt = Math.max(0, currentDebt - parsedAmount);
          newPaid = dbPaid;
        } else if (payType === 'refund') {
          newDebt = currentDebt + parsedAmount;
          newPaid = Math.max(0, dbPaid - parsedAmount);
        }
      }

      const selectedDocId = isDoctor ? user.id : (formData.doctor_id || patient?.main_treatment_provider || null);
      const selectedDoc = doctors.find(d => d.id === selectedDocId);
      
      await base44.entities.Payment.create({
        patient_id: formData.patient_id || null,
        patient_name: patient?.full_name || '',
        doctor_id: selectedDocId || null,
        commission_rate: selectedDoc ? (selectedDoc.commission_rate || selectedDoc.commission || 30) : null,
        type: formData.type,
        amount: parsedAmount,
        method: formData.method,
        category: formData.category,
        date: formData.date,
        notes: formData.notes,
        receipt_url: formData.receipt_url || null,
        debt_amount: formData.patient_id ? newDebt : null
      });

      if ((formData.type || 'Income').toLowerCase() === 'income' && formData.patient_id && formData.patient_id !== 'patient-y2ii8ynf2') {
        try {
          const plans = patientAllPlans.length
            ? patientAllPlans
            : await base44.entities.TreatmentPlan.filter({ patient_id: formData.patient_id }, 'created_date', 50);
          const slices = allocateInvoicePayment(plans, parsedAmount, selectedPlanId || '');
          for (const slice of slices) {
            const plan = (plans || []).find(p => p.id === slice.id);
            const patch = { paid_amount: slice.paid_amount };
            if (plan && plan.id === selectedPlanId && selectedPlanServiceIds.length) {
              const newServices = JSON.parse(JSON.stringify(plan.services || []));
              selectedPlanServiceIds.forEach(idx => {
                if (newServices[idx]) newServices[idx].payment_status = 'paid';
              });
              patch.services = newServices;
            }
            await base44.entities.TreatmentPlan.update(slice.id, patch);
          }
        } catch (planErr) {
          console.error("Failed to automatically distribute payment to plans:", planErr);
        }
      }

      // Update patient stats in DB
      if (formData.patient_id && formData.patient_id !== 'patient-y2ii8ynf2') {
        await base44.entities.Patient.update(formData.patient_id, {
          total_paid: newPaid,
          total_debt: newDebt
        });

        // Update local patients state
        setPatients(prev => prev.map(pt =>
          pt.id === formData.patient_id
            ? { ...pt, total_paid: newPaid, total_debt: newDebt }
            : pt
        ));
      }

      closeAddModal();
      setFormData({
        patient_id: '',
        doctor_id: '',
        type: 'Income',
        amount: '',
        method: 'Cash',
        category: 'Treatment',
        date: getLocalDatetimeString(),
        notes: ''
      });
      setSelectedPlanId('');
      setSelectedPlanServiceIds([]);
      setPatientPlans([]);
      setPatientServices([]);
      toast.success(t('common.success'));
      loadData();
    } catch (error) {
      console.error('Failed to add payment:', error);
      setFormError(t('common.errorSave') || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  // Payment Card (compact)
  const PaymentCard = ({ payment, index }) => {
    const style = getTypeStyle(payment.type);
    const TypeIcon = style.icon;

    // Date + time formatted as "25.05 14:30"
    const dateTime = (() => {
      const stamp = paymentStamp(payment);
      if (!stamp.date || stamp.date === '—') return '';
      return stamp.time ? `${stamp.date} ${stamp.time}` : stamp.date;
    })();

    // Resolve the best display label for this payment's service/category
    const category = (() => {
      const c = payment.category || '';
      // Strip patient name prefix if present (old format: "Name — Service")
      const cleaned = c.includes(' — ') ? c.split(' — ').slice(1).join(' — ') : c;
      // If category is a generic placeholder, try extracting from notes
      const generic = ['treatment', 'income', 'expense', 'debt', 'discount', 'refund', ''];
      if (generic.includes(cleaned.toLowerCase())) {
        // notes often look like "Rejadan to'lov: Plan Name" — extract the plan/service part
        const notes = payment.notes || '';
        const colonIdx = notes.indexOf(':');
        if (colonIdx !== -1) {
          const afterColon = notes.slice(colonIdx + 1).trim();
          if (afterColon) return formatCategory(afterColon);
        }
        return notes || '';
      }
      return formatCategory(cleaned);
    })();

    return (
      <motion.div
        onClick={() => setSelectedPayment(payment)}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: searchQuery ? 0 : Math.min(index, 6) * 0.02, duration: 0.18 }}
        className="bg-white rounded-2xl px-3 py-2.5 mb-2 border border-slate-200/70 shadow-[0_1px_4px_rgba(0,0,0,0.04)] active:scale-[0.98] transition-transform content-visibility-auto"
      >
        <div className="flex items-center gap-2.5">
          {/* Colored icon */}
          <div className={`w-11 h-11 rounded-full ${style.bg} ${style.text} flex items-center justify-center flex-shrink-0 text-[14px] font-bold`}>
            {String(payment.patient_name || '').trim() ? String(payment.patient_name).split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() : <TypeIcon className="w-4 h-4" />}
          </div>

          {/* Left info block */}
          <div className="flex-1 min-w-0 space-y-0.5">

            {/* Row 1: patient name + type badge + Chek badge */}
            <div className="flex items-start gap-1.5">
              <span className="flex-1 text-[15px] font-bold text-slate-900 leading-snug line-clamp-1 break-words min-w-0">
                {payment.patient_name || '—'}
              </span>
              {(payment.receipt_url || payment.receipt_image || payment.check_image) && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewReceiptUrl(payment.receipt_url || payment.receipt_image || payment.check_image);
                  }}
                  className="shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-black tracking-wide bg-blue-100 text-blue-700 hover:bg-blue-200 flex items-center gap-0.5 shadow-xs active:scale-90 transition-transform"
                >
                  <Receipt className="w-2.5 h-2.5" /> Chek
                </button>
              )}
            </div>

            <span className={`inline-block px-2 py-0.5 rounded-md text-[12px] font-semibold ${style.bg} ${style.text}`}>{style.label}</span>

            {/* Row 2: service / category */}
            {category ? (
              <div className="flex items-center gap-1">
                <span className="text-[13px] font-medium text-slate-500 leading-tight line-clamp-1">
                  {category}
                </span>
              </div>
            ) : null}

            {/* Row 3: date + time */}
            {dateTime ? (
              <div className="flex items-center gap-1">
                <span className="text-[13px] text-slate-400 leading-none font-medium inline-flex items-center gap-1">
                  <CalendarDays className="w-3.5 h-3.5" />{dateTime}
                </span>
              </div>
            ) : null}
          </div>
          <div className="text-right shrink-0 ml-1">
            {(() => {
              const pat = patients.find(pt => pt.id === payment.patient_id);
              const bal = patientBalances[payment.id];
              const qarz = bal ? bal.debtAtTime : (payment.debt_amount !== undefined && payment.debt_amount !== null ? Number(payment.debt_amount) : Number(pat?.total_debt || 0));
              return (
                <>
                  <p className={`text-[16px] font-extrabold leading-none whitespace-nowrap ${Number(payment.amount || 0) < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {formatCurrency(payment.amount || 0)}
                  </p>
                </>
              );
            })()}
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
        </div>
      </motion.div>
    );
  };

  // Skeleton
  const SkeletonCard = () => (
    <div className="bg-white rounded-2xl p-5 mb-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-slate-200 animate-pulse flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="w-32 h-5 bg-slate-200 rounded animate-pulse" />
          <div className="w-20 h-4 bg-slate-200 rounded animate-pulse" />
        </div>
        <div className="w-24 h-6 bg-slate-200 rounded animate-pulse" />
      </div>
    </div>
  );

  return (
    <PullToRefresh onRefresh={loadData}>
      <div className="min-h-screen bg-slate-50 pt-2">
        {/* Premium Header — not sticky under fixed app chrome (avoids summary sliding under logo row) */}
        <div className="bg-white border-b border-slate-100 relative z-10">
          <div className="px-5 pt-3 pb-4">
            {/* Title Row */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{t('payments.title')}</h1>
                <p className="text-sm text-slate-500 mt-0.5">{t('payments.subtitle')}</p>
              </div>

              <Button 
                onClick={() => setShowAddModal(true)}
                className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl px-4 h-11 shadow-lg shadow-slate-200 flex items-center gap-1.5 active:scale-95 transition-all text-xs font-bold"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>To'lov qo'shish</span>
              </Button>
            </div>

            {/* Financial Overview Cards */}
            <div className="space-y-2.5 mb-5">
              {/* Total Income */}
              <div className="bg-gradient-to-br from-[#1499AD] to-[#0E7A8A] rounded-2xl p-4 text-white shadow-lg shadow-cyan-200/50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-cyan-100/80 text-[10px] font-black uppercase tracking-wider">{t('payments.totalIncome')}</p>
                    <p className="text-2xl font-[900] mt-1 tracking-tight">
                      {formatCurrency(stats.totalRevenue || 0)}
                    </p>
                  </div>
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-4 text-white shadow-md shadow-emerald-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-emerald-100 text-[10px] font-black uppercase tracking-wider">{t('payments.thisMonth')}</span>
                    <Calendar className="w-4 h-4 text-emerald-200" />
                  </div>
                  <p className="text-lg font-[900] tracking-tight">
                    {formatCurrency(stats.monthRevenue || 0)}
                  </p>
                </div>

                <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-4 text-white shadow-md shadow-blue-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-blue-100 text-[10px] font-black uppercase tracking-wider">{t('payments.todayIncome')}</span>
                    <Clock className="w-4 h-4 text-blue-200" />
                  </div>
                  <p className="text-lg font-[900] tracking-tight">
                    {formatCurrency(stats.todayRevenue || 0)}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder={t('payments.searchHint')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-12 pl-12 pr-4 rounded-xl border-0 bg-slate-100 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:bg-white transition-all"
              />
            </div>
            
            {/* Filter Pills */}
            <div className="flex gap-2 mt-4 overflow-x-auto scrollbar-hide pb-1">
              {[
                { key: 'all', label: t('services.sidebar.all') },
                { key: 'Income', label: t('payments.income') },
              ].map((filter) => (
                <button
                  key={filter.key}
                  onClick={() => setFilterType(filter.key)}
                  className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
                    filterType === filter.key
                      ? 'bg-slate-900 text-white shadow-md'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Payments List */}
        <div className="p-4" style={{ paddingBottom: 'calc(96px + env(safe-area-inset-bottom, 0px))' }}>
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : filteredPayments.length > 0 ? (
            <AnimatePresence mode="popLayout">
              {filteredPayments.map((payment, index) => (
                <PaymentCard key={payment.id} payment={payment} index={index} />
              ))}
            </AnimatePresence>
          ) : (
            <div className="text-center py-16">
              <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <Wallet className="w-10 h-10 text-slate-300" />
              </div>
              <p className="text-slate-600 font-semibold text-lg">{t('payments.noPayments')}</p>
              <p className="text-sm text-slate-400 mt-1">{t('common.noData')}</p>
            </div>
          )}
        </div>

        {/* Bottom spacing */}
        <div className="h-8" />

        {/* Add Payment — mobile "To'lov qilish" screen */}
        <MobilePayView
          open={showAddModal}
          onClose={closeAddModal}
          patient={selectedPatient}
          patientPicker={(
            <div className="space-y-2 relative z-50">
              <Label className="text-[12px] font-semibold text-slate-500">{t('payments.patient')}</Label>
              <PatientSelect
                patients={patients}
                value={formData.patient_id}
                initialName={location.state?.prefillPatientName || ''}
                onChange={(id, pat) => {
                  if (!id) {
                    setFormData(prev => ({ ...prev, patient_id: '', doctor_id: isDoctor ? user?.id : '' }));
                    setSelectedPlanId(''); setSelectedPlanServiceIds([]); setPaySelKeys([]);
                    return;
                  }
                  const p = pat || patients.find(x => x.id === id);
                  if (p && !patients.some(x => x.id === p.id)) setPatients(prev => [p, ...prev]);
                  const assignedDocId = resolveDoctorId(p, patientPlans, doctors, user, isDoctor);
                  setFormData(prev => ({ ...prev, patient_id: id, doctor_id: assignedDocId || prev.doctor_id || '' }));
                  setSelectedPlanId(''); setSelectedPlanServiceIds([]); setPaySelKeys([]);
                }}
                inputClassName="h-12 rounded-2xl border-slate-200 bg-slate-50 font-semibold text-sm"
              />
            </div>
          )}
          plansCount={patientAllPlans.length}
          onOpenProfile={() => { setShowAddModal(false); navigate(`/patients/${formData.patient_id}`); }}
          onOpenPlans={() => { setShowAddModal(false); navigate(`/patients/${formData.patient_id}?tab=plan`); }}
          onOpenCard={() => { setShowAddModal(false); navigate(`/patients/${formData.patient_id}`); }}
          onOpenHistory={() => { setShowAddModal(false); navigate(`/patients/${formData.patient_id}?tab=tarix`); }}
          mode={payMode}
          onModeChange={(m) => {
            setPayMode(m); setPaySelKeys([]); setSelectedPlanServiceIds([]); setSelectedPlanId('');
            setFormError('');
            setFormData(prev => ({ ...prev, amount: '', category: 'Treatment', notes: '' }));
          }}
          plans={patientAllPlans}
          doctorsById={doctorsById}
          selectedKeys={paySelKeys}
          onToggleService={(row, rows) => applyServiceSelection(
            paySelKeys.includes(row.key) ? paySelKeys.filter(k => k !== row.key) : [...paySelKeys, row.key], rows)}
          onToggleAll={(rows) => applyServiceSelection(paySelKeys.length === rows.length ? [] : rows.map(r => r.key), rows)}
          selectedPlanId={selectedPlanId}
          onSelectPlan={(planId) => {
            setSelectedPlanId(planId);
            setSelectedPlanServiceIds([]);
            const plan = patientAllPlans.find(p => p.id === planId);
            setFormData(prev => ({
              ...prev,
              category: plan ? (plan.tooth_number ? `${plan.name} (#${plan.tooth_number})` : plan.name) : 'Treatment',
              notes: plan ? t('payments.planSelect') + `: ${plan.name}` : '',
              doctor_id: plan ? (resolveDoctorId(null, [plan], doctors, user, isDoctor) || prev.doctor_id || '') : prev.doctor_id,
            }));
          }}
          onOpenPlanDetail={() => {
            const plan = patientAllPlans.find(p => p.id === selectedPlanId) || patientPlans[0] || patientAllPlans[0];
            if (plan) { setSelectedPlanForInvoice(plan); setShowPlanInvoiceModal(true); }
          }}
          amount={formData.amount}
          onAmountChange={(v) => { setFormError(''); setFormData(prev => ({ ...prev, amount: v })); }}
          debt={selectedPatientDebt}
          method={formData.method}
          onMethodChange={(m) => setFormData(prev => ({ ...prev, method: m }))}
          receiptUrl={formData.receipt_url}
          receiptUploading={uploadingReceipt}
          onReceiptClear={() => setFormData(prev => ({ ...prev, receipt_url: '' }))}
          onReceiptPick={async (file) => {
            const validation = validateImage(file, { maxSizeMB: 10 });
            if (!validation.valid) { toast.error(validation.error); return; }
            try {
              setUploadingReceipt(true);
              const compressed = await compressImage(file, { maxWidth: 1200, maxHeight: 1600, quality: 0.8 });
              setFormData(prev => ({ ...prev, receipt_url: compressed }));
              toast.success("Chek rasmi yuklandi!");
            } catch (err) {
              console.error('Receipt upload error:', err);
              toast.error('Chek yuklashda xatolik yuz berdi');
            } finally { setUploadingReceipt(false); }
          }}
          error={formError || (isIncomeBlockedForPatient ? "Bemorda faol qarz yo'q. To'lov qabul qilib bo'lmaydi." : '')}
          onDismissError={formError ? () => setFormError('') : undefined}
          extra={(
            <details className="mt-3 rounded-[20px] bg-white border border-slate-200 shadow-sm group" data-testid="mobile-pay-extra">
              <summary className="list-none cursor-pointer px-4 h-12 flex items-center justify-between text-[14px] font-semibold text-slate-700">
                Qo'shimcha: shifokor, sana, izoh
                <span className="text-slate-400 group-open:rotate-180 transition-transform">⌄</span>
              </summary>
              <div className="px-4 pb-4 space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-[12px] font-semibold text-slate-500">{t('payments.doctor')}</Label>
                  <Select
                    disabled={isDoctor}
                    value={isDoctor ? String(user?.id) : (formData.doctor_id ? String(formData.doctor_id) : '')}
                    onValueChange={(v) => setFormData(prev => ({ ...prev, doctor_id: v }))}
                  >
                    <SelectTrigger className="h-12 rounded-2xl border-slate-200 bg-slate-50 font-semibold"><SelectValue placeholder={t('payments.doctor')} /></SelectTrigger>
                    <SelectContent className="rounded-2xl border-slate-100 z-[200]">
                      {isDoctor ? (
                        <SelectItem value={String(user?.id)}>{user?.name}</SelectItem>
                      ) : (
                        <>
                          {doctors.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.name || d.full_name}</SelectItem>)}
                          {formData.doctor_id && !doctors.some(d => String(d.id) === String(formData.doctor_id)) && (
                            <SelectItem value={String(formData.doctor_id)}>{formData.doctor_id}</SelectItem>
                          )}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[12px] font-semibold text-slate-500">{t('payments.date')}</Label>
                  <ClinicDateTimeField value={formData.date} onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))} className="h-12 rounded-2xl border-slate-200 bg-slate-50 font-semibold" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[12px] font-semibold text-slate-500">{t('payments.notes')}</Label>
                  <Input placeholder={t('payments.notes') + '...'} value={formData.notes} onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))} className="h-12 rounded-2xl border-slate-200 bg-slate-50 text-sm" />
                </div>
              </div>
            </details>
          )}
          saving={saving}
          onSubmit={handleAddPayment}
          disabled={
            isIncomeBlockedForPatient ||
            parseAmountInput(formData.amount) <= 0 ||
            !formData.patient_id ||
            parseAmountInput(formData.amount) > selectedPatientDebt
          }
        />

        {/* Standalone TreatmentPlanInvoice Modal */}
        {selectedPlanForInvoice && (
          <TreatmentPlanInvoice 
            open={showPlanInvoiceModal} 
onClose={() => { setShowPlanInvoiceModal(false); setSelectedPlanForInvoice(null); }} 
            plan={selectedPlanForInvoice} 
          />
        )}

        <Dialog open={!!selectedPayment} onOpenChange={(open) => !open && setSelectedPayment(null)}>
          <DialogContent className="sm:max-w-md w-[95%] rounded-3xl p-0 overflow-hidden border-none shadow-2xl [&>button]:hidden">
            <DialogHeader className="sr-only">
              <DialogTitle>To'lov tafsilotlari</DialogTitle>
              <DialogDescription>Tanlangan to'lov summasi, bemor va holati</DialogDescription>
            </DialogHeader>
            {selectedPayment && (() => {
              const sp = selectedPayment;
              const pat = patients.find(pt => pt.id === sp.patient_id);
              const doc = doctors.find(d => d.id === sp.doctor_id);
              const procedures = extractPaymentProcedures(sp);
              const bal = patientBalances[sp.id];
              const qarzAtTime = bal ? bal.debtAtTime : pat?.total_debt;
              const typeStyle = getTypeStyle(sp.type);
              const TypeIcon = typeStyle.icon;
              const rawAmt = Number(sp.amount || 0);

              const paidStamp = paymentStamp(sp);
              const paidWhen = paidStamp.time ? `${paidStamp.date}, ${paidStamp.time}` : paidStamp.date;

              const gradientMap = {
                Income:   'from-emerald-500 to-teal-600',
                Debt:     'from-rose-500 to-pink-600',
                Expense:  'from-slate-600 to-slate-800',
                Discount: 'from-purple-500 to-violet-600',
                Refund:   'from-amber-500 to-orange-600',
              };
              const grad = gradientMap[sp.type] || gradientMap.Income;

              return (
                <div>
                  {/* GRADIENT HEADER */}
                  <div className={`bg-gradient-to-br ${grad} px-5 pt-5 pb-7 relative`}>
                    <button
                      onClick={() => setSelectedPayment(null)}
                      className="absolute right-4 top-4 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 active:scale-95 transition-all"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                    <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center mb-3">
                      <TypeIcon className="w-6 h-6 text-white" />
                    </div>
                    <p className="text-[10px] font-black text-white/60 uppercase tracking-[0.25em] mb-0.5">To'lov summasi</p>
                    <h2 className="text-3xl font-[900] text-white tracking-tight">
                      {rawAmt.toLocaleString('ru-RU')} <span className="text-lg font-bold text-white/70">so'm</span>
                    </h2>
                    <div className="flex flex-wrap items-center gap-2 mt-2.5">
                      <span className="bg-white/20 text-white text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full">
                        {typeStyle.label}
                      </span>
                      <span className="bg-white/20 text-white text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full">
                        {getPaymentMethodLabel(sp.method)}
                      </span>
                    </div>
                  </div>

                  {/* BODY */}
                  <div className="bg-white px-4 py-4 space-y-3 max-h-[55vh] overflow-y-auto">

                    {/* Bemor + Shifokor */}
                    <div className="rounded-2xl border border-slate-100 overflow-hidden">
                      <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Bemor va shifokor</p>
                      </div>
                      <div className="divide-y divide-slate-50">
                        <div className="flex items-center justify-between px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                              <User className="w-3.5 h-3.5 text-blue-600" />
                            </div>
                            <span className="text-[11px] text-slate-500 font-semibold">Bemor</span>
                          </div>
                          <div className="text-right">
                            <p className="text-[13px] font-black text-slate-900">{sp.patient_name || pat?.full_name || '—'}</p>
                            {pat?.phone && <p className="text-[10px] text-slate-400 font-medium mt-0.5">📞 {pat.phone}</p>}
                          </div>
                        </div>
                        {doc && (
                          <div className="flex items-center justify-between px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
                                <Stethoscope className="w-3.5 h-3.5 text-purple-600" />
                              </div>
                              <span className="text-[11px] text-slate-500 font-semibold">Shifokor</span>
                            </div>
                            <p className="text-[13px] font-black text-slate-900">{doc.name || doc.full_name || '—'}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 4 Financial Cards: Reja (asl narxi), Qo'llanilgan chegirma, Chegirmali jami summa, Qolgan qarz */}
                    {(() => {
                      const origPrice = selectedPaymentPatientData?.originalPrice ?? (Number(pat?.total_debt) + Number(pat?.total_paid) || rawAmt);
                      const discAmt = selectedPaymentPatientData?.totalDiscount ?? 0;
                      const discPct = selectedPaymentPatientData?.discountPercent ?? (origPrice > 0 && discAmt > 0 ? Math.round((discAmt / origPrice) * 100) : 0);
                      const finTotal = selectedPaymentPatientData?.finalPlanTotal ?? Math.max(0, origPrice - discAmt);
                      const qarzVal = qarzAtTime != null ? Number(qarzAtTime) : (Number(pat?.total_debt) || 0);

                      return (
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Reja (asl narxi)</p>
                            <p className="text-[12px] font-[900] text-slate-800">{origPrice.toLocaleString('ru-RU')} so'm</p>
                          </div>
                          <div className="rounded-2xl bg-purple-50/60 border border-purple-100 p-3">
                            <p className="text-[8px] font-black text-purple-500 uppercase tracking-widest mb-1">Qo'llanilgan chegirma</p>
                            <p className="text-[12px] font-[900] text-purple-700">{discPct}% ({discAmt.toLocaleString('ru-RU')} UZS)</p>
                          </div>
                          <div className="rounded-2xl bg-blue-50/60 border border-blue-100 p-3">
                            <p className="text-[8px] font-black text-blue-500 uppercase tracking-widest mb-1">Chegirmali jami summa</p>
                            <p className="text-[12px] font-[900] text-blue-700">{finTotal.toLocaleString('ru-RU')} so'm</p>
                          </div>
                          <div className={`rounded-2xl border p-3 ${qarzVal > 0 ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50 border-emerald-100'}`}>
                            <p className={`text-[8px] font-black uppercase tracking-widest mb-1 ${qarzVal > 0 ? 'text-rose-400' : 'text-emerald-500'}`}>Qolgan qarz</p>
                            <p className={`text-[12px] font-[900] ${qarzVal > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                              {qarzVal > 0 ? `${qarzVal.toLocaleString('ru-RU')} so'm` : "✓ To'liq yopilgan"}
                            </p>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Xizmat */}

                    {/* Jami to'langan + To'langan sana va vaqt */}
                    {(() => {
                      const patTotals = pat ? patientCurrentTotals[sp.patient_id] : null;
                      const displayPaid = patTotals?.totalPaid ?? (Number(pat?.total_paid) || 0);

                      return (
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-3">
                            <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest mb-1">Jami to'langan</p>
                            <p className="text-[12px] font-[900] text-emerald-700">{displayPaid.toLocaleString('ru-RU')} so'm</p>
                          </div>
                          <div className="rounded-2xl border p-3 bg-amber-50 border-amber-100">
                            <p className="text-[8px] font-black uppercase tracking-widest mb-1 text-amber-500">To'langan sana va vaqt</p>
                            <p className="text-[12px] font-[900] text-amber-700">{paidWhen}</p>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Chek rasmi */}
                    {(sp.receipt_url || sp.receipt_image || sp.check_image) && (
                      <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-3.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest flex items-center gap-1.5">
                            <Receipt className="w-3.5 h-3.5 text-blue-600" /> To'lov cheki / Kvitansiya
                          </p>
                          <button
                            type="button"
                            onClick={() => setPreviewReceiptUrl(sp.receipt_url || sp.receipt_image || sp.check_image)}
                            className="text-[10px] font-bold text-blue-700 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3 h-3" /> Kattalashtirish
                          </button>
                        </div>
                        <div 
                          onClick={() => setPreviewReceiptUrl(sp.receipt_url || sp.receipt_image || sp.check_image)}
                          className="w-full h-44 rounded-xl overflow-hidden bg-slate-900/5 border border-blue-200 cursor-pointer relative group flex items-center justify-center"
                        >
                          <img src={sp.receipt_url || sp.receipt_image || sp.check_image} alt="To'lov cheki" className="w-full h-full object-contain" />
                          <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <span className="bg-slate-900/90 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                              <Eye className="w-3.5 h-3.5" /> Chekni to'liq ko'rish
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Izoh */}
                    {sp.notes && (
                      <div className="rounded-2xl bg-blue-50 border border-blue-100 p-3">
                        <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                          <FileText className="w-3 h-3" /> Izoh / Reja
                        </p>
                        <p className="text-[12px] font-bold text-blue-800 whitespace-pre-wrap break-words leading-5">{sp.notes}</p>
                      </div>
                    )}
                  </div>

                  {/* FOOTER */}
                  <div className="bg-white border-t border-slate-100 px-4 py-3">
                    <button
                      onClick={() => setSelectedPayment(null)}
                      className="w-full h-11 rounded-2xl bg-slate-900 text-white text-[13px] font-black uppercase tracking-widest active:scale-95 transition-all"
                    >
                      Yopish
                    </button>
                  </div>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>

        {/* Fullscreen Receipt Lightbox */}
        <Dialog open={!!previewReceiptUrl} onOpenChange={(open) => !open && setPreviewReceiptUrl(null)}>
          <DialogContent className="max-w-2xl w-[95vw] max-h-[92vh] p-0 overflow-hidden rounded-3xl border-none shadow-2xl bg-slate-950 flex flex-col [&>button]:hidden">
            <DialogTitle className="sr-only">To'lov cheki</DialogTitle>
            <DialogDescription className="sr-only">Chek rasmini ko'rish</DialogDescription>
            <div className="p-3.5 px-5 bg-slate-900 text-white flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-400" /> To'lov cheki / Kvitansiya
              </span>
              <button
                type="button"
                onClick={() => setPreviewReceiptUrl(null)}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black/40 min-h-[300px]">
              {previewReceiptUrl && (
                <img 
                  src={previewReceiptUrl} 
                  alt="Chek" 
                  className="max-h-[72vh] max-w-full object-contain rounded-xl shadow-2xl" 
                />
              )}
            </div>
            <div className="p-3.5 px-5 bg-slate-900 flex justify-end gap-2">
              <a
                href={previewReceiptUrl}
                download="tolov_cheki.jpg"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> Yuklab olish
              </a>
              <button
                type="button"
                onClick={() => setPreviewReceiptUrl(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-colors"
              >
                Yopish
              </button>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </PullToRefresh>
  );
}
