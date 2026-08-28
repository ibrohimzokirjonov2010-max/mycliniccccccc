import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowUpRight, ArrowDownRight, Wallet, TrendingUp, TrendingDown,
  Plus, Search, FileText, Stethoscope, X, User, Clock, Calendar,
  Check, CreditCard, AlertTriangle, Receipt, Camera, ImagePlus, Eye, Trash2, Download, Loader2
} from 'lucide-react';
import TreatmentPlanInvoice from '@/components/treatments/TreatmentPlanInvoice';
import { base44 } from '@/api/base44Client';
import { compressImage, validateImage } from '@/utils/imageUpload';
import { Button } from '@/components/ui/button';
import PullToRefresh from '@/components/ui/PullToRefresh';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';
import PatientSelect from '@/components/patients/PatientSelect';
import { useTranslation } from '@/i18n/LanguageContext';

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
  const { t, language } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isDoctor } = useAuth();
  const [payments, setPayments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(false);
  const loadingTimerRef = useRef(null);
  const hasLoadedInitial = useRef(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [saving, setSaving] = useState(false);
  const [patientBalances, setPatientBalances] = useState({});
  const [patientCurrentTotals, setPatientCurrentTotals] = useState({});
  const [stats, setStats] = useState({ totalRevenue: 0, monthRevenue: 0, todayRevenue: 0 });

  const loadStats = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
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

  // Calculate running balances for all displayed patients' payments
  useEffect(() => {
    if (!payments.length) return;
    const uniquePatientIds = [...new Set(payments.map(p => p.patient_id).filter(Boolean))];
    let active = true;

    const fetchAllPatientPayments = async () => {
      try {
        const byPatient = {};
        for (const p of payments) {
          if (!p.patient_id) continue;
          if (!byPatient[p.patient_id]) byPatient[p.patient_id] = [];
          byPatient[p.patient_id].push(p);
        }

        const balancesMap = {};
        const totalsMap = {};

        await Promise.all(Object.entries(byPatient).map(async ([patientId, patPays]) => {
          const sorted = [...patPays].sort((a, b) => {
            const ta = a.created_date || a.created_at || a.date || '';
            const tb = b.created_date || b.created_at || b.date || '';
            return ta.localeCompare(tb);
          });

          let runningDebt = 0;
          let runningPaid = 0;
          let runningDiscount = 0;

          for (const p of sorted) {
            const type = (p.type || 'Income').toLowerCase();
            const amt = Math.abs(Number(p.amount) || 0);

            if (type === 'income') {
              runningPaid += amt;
              runningDebt -= amt;
            } else if (type === 'debt') {
              runningDebt += amt;
            } else if (type === 'discount') {
              runningDiscount += amt;
              runningDebt -= amt;
            } else if (type === 'refund') {
              runningDebt += amt;
              runningPaid = Math.max(0, runningPaid - amt);
            }

            balancesMap[p.id] = {
              debtAtTime: Math.max(0, runningDebt),
              totalToPayAtTime: Math.max(0, runningDebt) + runningPaid
            };
          }

          totalsMap[patientId] = {
            currentDebt: Math.max(0, runningDebt),
            totalPaid: runningPaid,
            totalDiscount: runningDiscount
          };
        }));

        if (active) {
          setPatientBalances(balancesMap);
          setPatientCurrentTotals(totalsMap);
        }
      } catch (err) {
        console.error("Error calculating patient running balances:", err);
      }
    };

    fetchAllPatientPayments();
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
  const [patientServices, setPatientServices] = useState([]);
  const [selectedPlanForInvoice, setSelectedPlanForInvoice] = useState(null);
  const [showPlanInvoiceModal, setShowPlanInvoiceModal] = useState(false);
  
  // Automatically open modal if requested in navigation state
  useEffect(() => {
    if (location.state?.openAddModal) {
      setShowAddModal(true);
    }
  }, [location.state]);

  // Handle modal opening, reset, and prefill
  useEffect(() => {
    if (showAddModal) {
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
      setSelectedPlanId('');
      setSelectedPlanServiceIds([]);
      setPatientPlans([]);
      setPatientAllPlans([]);
      setPatientServices([]);
      setPatientPayments([]);

      // Clear state to avoid reopening on refresh
      if (location.state?.openAddModal) {
        navigate(location.pathname, { replace: true, state: null });
      }
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
      const [pays, pats, docs] = await Promise.all([
        base44.entities.Payment.filter(filter, '-date', 100),
        base44.entities.Patient.list('-created_date', 50),
        base44.entities.User.filter({ role: 'doctor' }, 'name', 50),
        loadStats()
      ]);
      setPayments(pays);
      setPatients(pats);
      setDoctors(docs || []);
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
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;

      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const datePart = `${day}.${month}.${year}`;
      const timePart = `${hours}:${minutes}`;
      return `${datePart} • ${timePart}`;
    } catch {
      return dateStr;
    }
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
  }, [formData.patient_id, formData.type]);

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
      setFormData(prev => ({
        ...prev,
        amount: String(Math.round(remainingAmount)),
        category: planCategory,
        notes: t('payments.planSelect') + `: ${plan.name}`
      }));
    } else {
      setSelectedPlanServiceIds([]);
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

  // Handle add payment
  const handleAddPayment = async () => {
    const parsedAmount = parseAmountInput(formData.amount);

    if (!parsedAmount || parsedAmount <= 0) {
      alert(t('common.error'));
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

        const totalDiscounts = (patientPays || [])
          .filter(p => p.type?.toLowerCase() === 'discount')
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
            toast.error("Bu bemorda qarz yo'q");
            return;
          }

          if (parsedAmount > currentDebt) {
            toast.error("Kiritilgan summa bemor qarzidan ko'p! Maksimal: " + currentDebt.toLocaleString() + " so'm");
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

      // Update treatment plan paid_amount
      if (selectedPlanId) {
        const plan = patientPlans.find(p => p.id === selectedPlanId);
        if (plan) {
          const newServices = JSON.parse(JSON.stringify(plan.services || []));
          selectedPlanServiceIds.forEach(idx => {
            if (newServices[idx]) {
                newServices[idx].payment_status = 'paid';
            }
          });
          const newPaid = (plan.paid_amount || 0) + parsedAmount;
          await base44.entities.TreatmentPlan.update(plan.id, { paid_amount: newPaid, services: newServices });
        }
      } else if (formData.type === 'Income' && formData.patient_id) {
        // Automatically distribute general payment to active treatment plans (oldest first)
        try {
          const plans = await base44.entities.TreatmentPlan.filter({ patient_id: formData.patient_id }, 'created_date', 50);
          const activePlans = (plans || []).filter(p => (p.paid_amount || 0) < p.total_price);
          let remainingPayment = parsedAmount;
          
          for (const plan of activePlans) {
            if (remainingPayment <= 0) break;
            const planRemaining = plan.total_price - (plan.paid_amount || 0);
            const applyAmount = Math.min(remainingPayment, planRemaining);
            
            const newPaid = (plan.paid_amount || 0) + applyAmount;
            const newServices = JSON.parse(JSON.stringify(plan.services || []));
            let tempRemaining = applyAmount;
            
            for (let i = 0; i < newServices.length; i++) {
              if (tempRemaining <= 0) break;
              const s = newServices[i];
              if (s.payment_status !== 'paid') {
                const svcPrice = s.price || 0;
                if (tempRemaining >= svcPrice) {
                  newServices[i].payment_status = 'paid';
                  tempRemaining -= svcPrice;
                }
              }
            }
            
            await base44.entities.TreatmentPlan.update(plan.id, { 
              paid_amount: newPaid, 
              services: newServices 
            });
            remainingPayment -= applyAmount;
          }
        } catch (planErr) {
          console.error("Failed to automatically distribute payment to plans:", planErr);
        }
      }

      // Update patient stats in DB
      if (formData.patient_id) {
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

      setShowAddModal(false);
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
      toast.error(t('common.error'));
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
      const d = payment.date || payment.created_date;
      if (!d) return '';
      try {
        const dt = new Date(d);
        if (isNaN(dt)) return d.split('T')[0];
        const day   = String(dt.getDate()).padStart(2, '0');
        const mon   = String(dt.getMonth() + 1).padStart(2, '0');
        const hh    = String(dt.getHours()).padStart(2, '0');
        const mm    = String(dt.getMinutes()).padStart(2, '0');
        return `${day}.${mon}  ${hh}:${mm}`;
      } catch { return d.split('T')[0]; }
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
        className="bg-white rounded-xl px-3.5 py-2.5 mb-1.5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] active:scale-[0.98] transition-transform content-visibility-auto"
      >
        <div className="flex items-center gap-2.5">
          {/* Colored icon */}
          <div className={`w-9 h-9 rounded-xl ${style.bg} flex items-center justify-center flex-shrink-0`}>
            <TypeIcon className={`w-4 h-4 ${style.text}`} />
          </div>

          {/* Left info block */}
          <div className="flex-1 min-w-0 space-y-0.5">

            {/* Row 1: patient name + type badge + Chek badge */}
            <div className="flex items-center gap-1.5 leading-none">
              <span className="text-[13px] font-bold text-slate-900 truncate max-w-[150px]">
                {payment.patient_name || '—'}
              </span>
              <span className={`shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-black tracking-wide ${style.bg} ${style.text}`}>
                {style.label}
              </span>
              {(payment.receipt_url || payment.receipt_image || payment.check_image) && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewReceiptUrl(payment.receipt_url || payment.receipt_image || payment.check_image);
                  }}
                  className="shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-black tracking-wide bg-blue-100 text-blue-700 hover:bg-blue-200 flex items-center gap-0.5 shadow-xs active:scale-90 transition-transform"
                >
                  <Receipt className="w-2.5 h-2.5" /> Chek
                </button>
              )}
            </div>

            {/* Row 2: service / category */}
            {category ? (
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-medium text-slate-500 leading-tight line-clamp-1">
                  {category}
                </span>
              </div>
            ) : null}

            {/* Row 3: date + time */}
            {dateTime ? (
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-400 leading-none font-medium">
                  📅 {dateTime}
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
                  <p className="text-[14px] font-black leading-none text-emerald-600">
                    {Number(payment.amount || 0).toLocaleString()} UZS
                  </p>
                  {pat != null && (
                    <p className={cn("text-[8px] font-black mt-1 uppercase tracking-tight", 
                      qarz > 0 ? 'text-rose-500' : 'text-emerald-500'
                    )}>
                      {qarz > 0 ? `Qarz: ${qarz.toLocaleString()} UZS` : '✓ To\'liq'}
                    </p>
                  )}
                </>
              );
            })()}
          </div>
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
      <div className="min-h-screen bg-slate-50">
        {/* Premium Header */}
        <div className="bg-white border-b border-slate-100 sticky top-0 z-10">
          <div className="px-5 pt-5 pb-4">
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
                <span>{t('common.add') || "Qo'shish"}</span>
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
                      {Number(stats.totalRevenue || 0).toLocaleString()} <span className="text-sm font-bold text-cyan-200/80">UZS</span>
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
                    {Number(stats.monthRevenue || 0).toLocaleString()} <span className="text-[10px] font-bold text-emerald-200">UZS</span>
                  </p>
                </div>

                <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-4 text-white shadow-md shadow-blue-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-blue-100 text-[10px] font-black uppercase tracking-wider">{t('payments.todayIncome')}</span>
                    <Clock className="w-4 h-4 text-blue-200" />
                  </div>
                  <p className="text-lg font-[900] tracking-tight">
                    {Number(stats.todayRevenue || 0).toLocaleString()} <span className="text-[10px] font-bold text-blue-200">UZS</span>
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
                { key: 'Expense', label: t('payments.expense') }
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
        <div className="p-4">
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

        {/* Add Payment Modal */}
        <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
          <DialogContent className="w-[95%] sm:max-w-xl rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl max-h-[90vh] flex flex-col">
            {(() => {
              const currentType = formData.type || 'Income';
              const headerBg = currentType === 'Income' ? 'bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600' :
                               currentType === 'Expense' ? 'bg-gradient-to-r from-rose-500 via-rose-600 to-red-600' :
                               'bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600';
              
              const HeaderIcon = currentType === 'Income' ? Wallet :
                                 currentType === 'Expense' ? TrendingDown :
                                 AlertTriangle;

              const patient = patients.find(p => p.id === formData.patient_id);

              return (
                <>
                  <div className={`${headerBg} px-6 py-5 flex items-center justify-between shrink-0 transition-colors duration-300`}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white backdrop-blur-sm shadow-sm">
                        <HeaderIcon className="w-5 h-5 stroke-[2.5]" />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-white uppercase tracking-tight">{t('payments.addNew')}</h3>
                        <p className="text-[10px] font-bold text-white/80 uppercase tracking-widest mt-0.5">
                          {patient ? patient.full_name : t('payments.type')}
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setShowAddModal(false)} 
                      className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-sm transition-all active:scale-95"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="p-6 space-y-5 bg-white flex-1 overflow-y-auto no-scrollbar pb-8">
                    
                    {(formData.type === 'Income' || formData.type === 'Debt') && (
                      <div className="space-y-4 relative z-50">
                        <div className="space-y-2 relative z-50">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">{t('payments.patient')}</Label>
                          <PatientSelect 
                            patients={patients}
                            value={formData.patient_id}
                            initialName={location.state?.prefillPatientName || ''}
                            onChange={(id, pat) => {
                              const p = pat || patients.find(x => x.id === id);
                              const assignedDocId = isDoctor ? user?.id : (p?.main_treatment_provider || formData.doctor_id || '');
                              setFormData(prev => ({
                                ...prev, 
                                patient_id: id, 
                                doctor_id: assignedDocId
                              }));
                              setSelectedPlanId('');
                            }}
                            inputClassName="h-12 rounded-2xl border-slate-100 bg-slate-50 font-bold text-xs"
                          />
                        </div>

                        {formData.patient_id && (
                          <div className={cn(
                            "rounded-2xl border px-4 py-3 flex items-center justify-between shadow-sm transition-colors relative z-40",
                            selectedPatientDebt > 0 ? "border-amber-100 bg-amber-50/50" : "border-emerald-100 bg-emerald-50/50"
                          )}>
                            <div className="flex items-center gap-2">
                              <div className={cn(
                                "w-2 h-2 rounded-full",
                                selectedPatientDebt > 0 ? "bg-amber-500 animate-pulse" : "bg-emerald-500"
                              )} />
                              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Bemor qarzi
                              </span>
                            </div>
                            <span className={cn(
                              "text-sm font-black tracking-tight",
                              selectedPatientDebt > 0 ? "text-amber-700" : "text-emerald-700"
                            )}>
                              {selectedPatientDebt > 0 ? `${selectedPatientDebt.toLocaleString('ru-RU')} so'm` : "Qarz yo'q"}
                            </span>
                          </div>
                        )}
                        
                        {isIncomeBlockedForPatient && (
                          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-100 text-[10px] font-black text-emerald-800 uppercase tracking-wide text-center relative z-40">
                            Bemorda faol qarz yo'q. To'lov qabul qilib bo'lmaydi.
                          </div>
                        )}

                        {/* Davolash rejalari */}
                        {patientPlans.length > 0 && (
                          <div className="space-y-2 relative z-30">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-[#1499AD] ml-1 flex items-center gap-1.5">
                              <FileText className="w-3.5 h-3.5" /> {t('patientProfile.treatmentPlanSingular') || 'Davolash rejasi'}
                            </Label>
                            <div className="flex flex-col gap-2.5">
                              {patientPlans.map(plan => {
                                const paid = Number(plan.paid_amount) || 0;
                                const total = Number(plan.total_price) || 0;
                                const remaining = Math.max(0, total - paid);
                                const isSelected = selectedPlanId === plan.id;
                                
                                return (
                                  <div 
                                    key={plan.id} 
                                    onClick={() => handlePlanSelect(isSelected ? '' : plan.id)}
                                    className={cn(
                                      "flex items-center justify-between rounded-2xl border p-3.5 shadow-sm cursor-pointer transition-all active:scale-[0.98]",
                                      isSelected 
                                        ? "border-blue-500 bg-blue-50/30 ring-1 ring-blue-500/20" 
                                        : "border-slate-100 bg-white hover:border-slate-200"
                                    )}
                                  >
                                    <div className="min-w-0 flex-1 mr-2">
                                      <div className="flex items-center gap-1.5">
                                        {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 stroke-[3]" />}
                                        <p className="text-[12px] font-black text-slate-800 truncate">{plan.name || (t ? t('patientProfile.treatmentPlanSingular') : 'Davolash rejasi')}</p>
                                      </div>
                                      <p className="text-[10px] text-slate-500 font-bold mt-0.5">
                                        Muolaja narhi to'liq:&nbsp;
                                        <span className="text-slate-700 font-extrabold">{total.toLocaleString()} {t('common.currency') || "so'm"}</span>
                                      </p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); setSelectedPlanForInvoice(plan); setShowPlanInvoiceModal(true); }}
                                      className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 text-[9px] font-black uppercase hover:bg-blue-100 active:scale-95 transition-all"
                                    >
                                      Faktura
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Responsible Doctor */}
                        <div className="space-y-2 relative z-20">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">{t('payments.doctor')}</Label>
                          <Select 
                            disabled={isDoctor}
                            value={isDoctor ? user?.id : formData.doctor_id} 
                            onValueChange={(v) => setFormData({...formData, doctor_id: v})}
                          >
                            <SelectTrigger className="h-12 rounded-2xl border-slate-100 bg-slate-50 font-bold">
                              <SelectValue placeholder={t('payments.doctor')} />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl border-slate-100">
                              {isDoctor ? (
                                <SelectItem value={user?.id} className="rounded-xl font-bold">{user?.name}</SelectItem>
                              ) : (
                                doctors.map(d => (
                                  <SelectItem key={d.id} value={d.id} className="rounded-xl font-bold">{d.name || d.full_name}</SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}

                    {/* Fintech Summa Input */}
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">{t('payments.amount')}</Label>
                      <div className="relative flex items-center justify-center bg-slate-50 rounded-3xl border border-slate-100 px-6 py-4 shadow-inner">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={formData.amount === '' || Number(formData.amount) === 0 ? '' : Number(formData.amount).toLocaleString('uz-UZ')}
                          onChange={e => {
                            const raw = e.target.value.replace(/\s/g, '').replace(/,/g, '').replace(/\./g, '').replace(/'/g, '');
                            if (raw === '') setFormData({ ...formData, amount: '' });
                            else if (/^\d+$/.test(raw)) setFormData({ ...formData, amount: raw });
                          }}
                          onKeyDown={e => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault(); }}
                          onWheel={e => e.target.blur()}
                          placeholder="0"
                          className="w-full text-center bg-transparent text-3xl font-[1000] text-slate-900 outline-none placeholder-slate-300"
                        />
                        <span className="absolute right-6 text-xs font-black text-slate-400 uppercase tracking-widest pointer-events-none">{t('common.currency') || 'so\'m'}</span>
                      </div>
                      
                      {/* Sum shortcuts */}
                      <div className="flex flex-wrap gap-1.5 mt-2 justify-center">
                        {[50000, 100000, 500000, 1000000].map(val => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, amount: String((Number(prev.amount) || 0) + val) }))}
                            className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-100 text-[10px] font-black text-slate-600 transition-all active:scale-95 shadow-sm"
                          >
                            +{val.toLocaleString()}
                          </button>
                        ))}
                        {selectedPatientDebt > 0 && (
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, amount: String(selectedPatientDebt) })}
                            className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-100 hover:bg-amber-100 text-[10px] font-black text-amber-700 transition-all active:scale-95 shadow-sm"
                          >
                            Jami qarz ({selectedPatientDebt.toLocaleString()})
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, amount: '' })}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 hover:bg-slate-200 text-[10px] font-black text-slate-500 transition-all active:scale-95 shadow-sm"
                        >
                          Tozalash
                        </button>
                      </div>
                    </div>

                    {/* Category Select (Dynamic based on type) */}
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">{t('payments.category')}</Label>
                      <Select 
                        value={formData.category} 
                        onValueChange={(v) => setFormData({...formData, category: v})}
                        disabled={!!selectedPlanId && (formData.type === 'Income' || formData.type === 'Debt')}
                      >
                        <SelectTrigger className={cn(
                          "h-12 rounded-2xl border-slate-100 bg-slate-50 font-bold",
                          selectedPlanId && (formData.type === 'Income' || formData.type === 'Debt') && "bg-slate-100 border-transparent opacity-70"
                        )}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-slate-100">
                          {formData.type === 'Income' || formData.type === 'Debt' ? (
                            <>
                              <SelectItem value="Treatment" className="rounded-xl font-bold">{t('appointments.service')}</SelectItem>
                              <SelectItem value="Consultation" className="rounded-xl font-bold">{t('navigation.recalls') || 'Konsultatsiya'}</SelectItem>
                              <SelectItem value="Other" className="rounded-xl font-bold">{t('expenses.categories.other')}</SelectItem>
                            </>
                          ) : (
                            <>
                              <SelectItem value="Rent" className="rounded-xl font-bold">{t('expenses.categories.rent')}</SelectItem>
                              <SelectItem value="Salary" className="rounded-xl font-bold">{t('expenses.categories.salary')}</SelectItem>
                              <SelectItem value="Materials" className="rounded-xl font-bold">{t('expenses.categories.materials')}</SelectItem>
                              <SelectItem value="Equipment" className="rounded-xl font-bold">{t('expenses.categories.equipment')}</SelectItem>
                              <SelectItem value="Utilities" className="rounded-xl font-bold">{t('expenses.categories.utilities')}</SelectItem>
                              <SelectItem value="Transport" className="rounded-xl font-bold">{t('expenses.categories.transport')}</SelectItem>
                              <SelectItem value="Other" className="rounded-xl font-bold">{t('expenses.categories.other')}</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* To'lov usuli (Cards UI) */}
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">{t('payments.method')}</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { value: 'Cash', label: t('payments.methods.Cash') || 'Naqd', icon: Wallet },
                          { value: 'Card', label: t('payments.methods.Card') || 'Plastik', icon: CreditCard },
                          { value: 'Click', label: 'Click', icon: ArrowUpRight },
                          { value: 'Payme', label: 'Payme', icon: ArrowDownRight }
                        ].map(m => {
                          const isActive = formData.method === m.value;
                          const Icon = m.icon;
                          return (
                            <button
                              key={m.value}
                              type="button"
                              onClick={() => setFormData({ ...formData, method: m.value })}
                              className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all duration-200 text-center relative ${
                                isActive 
                                  ? 'border-slate-900 bg-slate-900 text-white shadow-md' 
                                  : 'border-slate-100 bg-slate-50 text-slate-500 hover:bg-slate-100/70 hover:border-slate-200'
                              }`}
                            >
                              <Icon className={`w-5 h-5 mb-1.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                              <span className="text-[11px] font-bold tracking-tight">{m.label}</span>
                              {isActive && (
                                <div className="absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                                  <Check className="w-2 h-2 stroke-[4]" />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Date picker */}
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">{t('payments.date')}</Label>
                      <Input
                        type="datetime-local"
                        value={formData.date}
                        onChange={(e) => setFormData({...formData, date: e.target.value})}
                        className="h-12 rounded-2xl border-slate-100 bg-slate-50 font-bold"
                      />
                    </div>

                    {/* Agar Karta, Click yoki Payme tanlansa — Chek yuklash joyi chiqadi */}
                    {['Card', 'Click', 'Payme'].includes(formData.method) ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 flex items-center gap-1.5">
                            <Receipt className="w-3.5 h-3.5 text-emerald-600" />
                            Chek / Kvitansiya rasmi (ixtiyoriy)
                          </Label>
                          {formData.receipt_url && (
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, receipt_url: '' })}
                              className="text-[10px] font-bold text-rose-500 hover:underline flex items-center gap-0.5 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" /> O'chirish
                            </button>
                          )}
                        </div>

                        <input
                          type="file"
                          ref={receiptFileInputRef}
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const validation = validateImage(file, { maxSizeMB: 10 });
                            if (!validation.valid) {
                              toast.error(validation.error);
                              return;
                            }
                            try {
                              setUploadingReceipt(true);
                              const compressed = await compressImage(file, { maxWidth: 1200, maxHeight: 1600, quality: 0.8 });
                              setFormData(prev => ({ ...prev, receipt_url: compressed }));
                              toast.success("Chek rasmi yuklandi!");
                            } catch (err) {
                              console.error('Receipt upload error:', err);
                              toast.error('Chek yuklashda xatolik yuz berdi');
                            } finally {
                              setUploadingReceipt(false);
                              if (receiptFileInputRef.current) receiptFileInputRef.current.value = '';
                            }
                          }}
                        />

                        {formData.receipt_url ? (
                          <div className="relative rounded-2xl border border-emerald-200 bg-emerald-50/50 p-2.5 flex items-center gap-3">
                            <div 
                              onClick={() => setPreviewReceiptUrl(formData.receipt_url)}
                              className="w-14 h-14 rounded-xl overflow-hidden bg-slate-200 cursor-pointer shrink-0 border border-emerald-300 relative group"
                            >
                              <img src={formData.receipt_url} alt="Chek" className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <Eye className="w-4 h-4 text-white" />
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-emerald-900 truncate">Chek rasmi biriktirildi ✓</p>
                              <p className="text-[10px] text-emerald-600 font-medium mt-0.5">Ustiga bosib ko'rishingiz mumkin</p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => receiptFileInputRef.current?.click()}
                              className="h-8 rounded-xl text-[10px] font-bold border-emerald-200 text-emerald-700 bg-white"
                            >
                              Almashtirish
                            </Button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => receiptFileInputRef.current?.click()}
                            disabled={uploadingReceipt}
                            className="w-full py-4 px-4 rounded-2xl border-2 border-dashed border-slate-200 hover:border-emerald-500 bg-slate-50 hover:bg-emerald-50/30 transition-all flex flex-col items-center justify-center gap-1.5 text-slate-500 group cursor-pointer"
                          >
                            <div className="w-9 h-9 rounded-xl bg-white shadow-sm flex items-center justify-center text-slate-400 group-hover:text-emerald-600 transition-colors">
                              {uploadingReceipt ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                            </div>
                            <span className="text-xs font-bold text-slate-700 group-hover:text-emerald-700">
                              {uploadingReceipt ? "Yuklanmoqda..." : "Chek yoki skrinshot yuklash"}
                            </span>
                            <span className="text-[10px] font-medium text-slate-400">
                              Galereyadan tanlash yoki rasmga olish (ixtiyoriy)
                            </span>
                          </button>
                        )}

                        {/* Qo'shimcha ixtiyoriy izoh */}
                        <div className="pt-1">
                          <Input
                            placeholder="Qo'shimcha izoh (ixtiyoriy)..."
                            value={formData.notes}
                            onChange={(e) => setFormData({...formData, notes: e.target.value})}
                            className="h-11 rounded-2xl border-slate-100 bg-slate-50 font-medium text-xs px-3.5"
                          />
                        </div>
                      </div>
                    ) : (
                      /* Notes (Naqd uchun) */
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">{t('payments.notes')}</Label>
                        <Input
                          placeholder={t('payments.notes') + "..."}
                          value={formData.notes}
                          onChange={(e) => setFormData({...formData, notes: e.target.value})}
                          className="h-12 rounded-2xl border-slate-100 bg-slate-50 font-medium text-xs px-4"
                        />
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-3 pt-3">
                      <Button
                        variant="ghost"
                        onClick={() => setShowAddModal(false)}
                        className="flex-1 h-12 rounded-2xl font-black uppercase text-[10px] tracking-wider text-slate-400 hover:bg-slate-50"
                      >
                        {t('common.cancel')}
                      </Button>
                      <Button
                        onClick={handleAddPayment}
                        disabled={saving || isIncomeBlockedForPatient || (formData.type === 'Income' && parseAmountInput(formData.amount) > selectedPatientDebt)}
                        className="flex-1 h-12 rounded-2xl bg-slate-950 hover:bg-slate-900 text-white font-black uppercase text-xs tracking-wider border-none relative overflow-hidden group shadow-lg"
                      >
                        <span className="relative z-10 transition-transform group-hover:scale-105 block">
                          {saving 
                            ? t('common.loading') 
                            : formData.type === 'Income' 
                              ? (language === 'uz' ? "To'lash" : language === 'ru' ? "Оплатить" : "Pay") 
                              : t('common.save')}
                        </span>
                        <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                      </Button>
                    </div>

                  </div>
                </>
              );
            })()}
          </DialogContent>
        </Dialog>

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

              const dtRaw = sp.created_date || sp.created_at || sp.date;
              const dt = dtRaw ? new Date(dtRaw) : null;
              const hasDate = dt && !isNaN(dt);
              const dateStr = hasDate ? dt.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
              const timeStr = hasDate ? dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

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
                      {rawAmt.toLocaleString()} <span className="text-lg font-bold text-white/70">UZS</span>
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
                            <p className="text-[12px] font-[900] text-slate-800">{origPrice.toLocaleString()} UZS</p>
                          </div>
                          <div className="rounded-2xl bg-purple-50/60 border border-purple-100 p-3">
                            <p className="text-[8px] font-black text-purple-500 uppercase tracking-widest mb-1">Qo'llanilgan chegirma</p>
                            <p className="text-[12px] font-[900] text-purple-700">{discPct}% ({discAmt.toLocaleString()} UZS)</p>
                          </div>
                          <div className="rounded-2xl bg-blue-50/60 border border-blue-100 p-3">
                            <p className="text-[8px] font-black text-blue-500 uppercase tracking-widest mb-1">Chegirmali jami summa</p>
                            <p className="text-[12px] font-[900] text-blue-700">{finTotal.toLocaleString()} UZS</p>
                          </div>
                          <div className={`rounded-2xl border p-3 ${qarzVal > 0 ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50 border-emerald-100'}`}>
                            <p className={`text-[8px] font-black uppercase tracking-widest mb-1 ${qarzVal > 0 ? 'text-rose-400' : 'text-emerald-500'}`}>Qolgan qarz</p>
                            <p className={`text-[12px] font-[900] ${qarzVal > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                              {qarzVal > 0 ? `${qarzVal.toLocaleString()} UZS` : "✓ To'liq yopilgan"}
                            </p>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Xizmat */}

                    {/* Jami to'langan + Hozirgi qarz */}
                    {pat && (() => {
                      const patTotals = patientCurrentTotals[sp.patient_id];
                      const displayPaid = patTotals?.totalPaid ?? (Number(pat.total_paid) || 0);
                      const displayDebt = patTotals?.currentDebt ?? (Number(pat.total_debt) || 0);

                      return (
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-3">
                            <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest mb-1">Jami to'langan</p>
                            <p className="text-[12px] font-[900] text-emerald-700">{displayPaid.toLocaleString()} UZS</p>
                          </div>
                          <div className={`rounded-2xl border p-3 ${displayDebt > 0 ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50 border-emerald-100'}`}>
                            <p className={`text-[8px] font-black uppercase tracking-widest mb-1 ${displayDebt > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>Hozirgi qarz</p>
                            <p className={`text-[12px] font-[900] ${displayDebt > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                              {displayDebt > 0 ? `${displayDebt.toLocaleString()} UZS` : "Qarz yo'q"}
                            </p>
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
