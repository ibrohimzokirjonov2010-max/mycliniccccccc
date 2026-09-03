import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/lib/queryKeys';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Plus, Search, TrendingUp, Wallet, Calendar, Receipt, X, Trash2, 
  Download, Clock, PlusCircle, Phone, FileText, Printer, 
  Camera, Eye, Loader2, FileSpreadsheet, Table as TableIcon, LayoutGrid,
  ArrowUp, ArrowDown, ArrowUpDown, Copy, Check
} from 'lucide-react';
import TreatmentPlanInvoice from '@/components/treatments/TreatmentPlanInvoice';
import { base44 } from '@/api/base44Client';
import { compressImage, validateImage } from '@/utils/imageUpload';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import EmptyState from '../components/ui/EmptyState';
import PatientModal from '../components/patients/PatientModal';
import PatientSelect from '../components/patients/PatientSelect';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/AuthContext';
import { useTranslation } from '@/i18n/LanguageContext';
import { useClinic } from '@/lib/ClinicContext';
import { getServiceStatusLabel, getTreatmentTypeLabel, getServiceCategoryLabel, resolveDoctorId } from '@/lib/utils';
import { toast } from 'sonner';
import { formatPhone } from '@/lib/utils';
import { format } from 'date-fns';

const formatPhoneSingleLine = (phone) => {
  if (!phone) return '—';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('998')) {
    return `+998 ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 10)} ${digits.slice(10, 12)}`;
  }
  if (digits.length === 9) {
    return `+998 ${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 7)} ${digits.slice(7, 9)}`;
  }
  return phone;
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

const getPaymentMethodLabel = (method, t) => {
  const m = String(method || '').toLowerCase();
  if (m.includes('card') || m.includes('karta') || m.includes('humo') || m.includes('uzcard') || m.includes('terminal')) return 'Plastik karta';
  if (m.includes('bank') || m.includes('hisob') || m.includes('transfer') || m.includes('o\'tkazma')) return 'Bank o\'tkazmasi';
  if (m.includes('installment') || m.includes('nasiya') || m.includes('rassrochka') || m.includes('muddatli')) return 'Muddatli to\'lov';
  if (m.includes('click') || m.includes('payme') || m.includes('uzum')) return 'Onlayn to\'lov';
  return 'Naqd pul';
};

const getPaymentTypeLabel = (type, t) => {
  if (!t) {
    if (type === 'Expense') return 'Chiqim';
    if (type === 'Refund') return 'Qaytarish';
    if (type === 'Discount') return 'Chegirma';
    if (type === 'Debt') return 'Qarz';
    return 'Kirim';
  }
  if (type === 'Expense') return t('payments.types.Expense') || 'Chiqim';
  if (type === 'Refund') return t('payments.types.Refund') || 'Qaytarish';
  if (type === 'Discount') return t('payments.types.Discount') || 'Chegirma';
  if (type === 'Debt') return t('payments.types.Debt') || 'Qarz';
  return t('payments.types.Income') || 'Kirim';
};

const extractPaymentProcedures = (payment) => {
  const raw = payment?.service_name || payment?.category || '';
  if (!raw) return ['Xizmat kiritilmagan'];

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

/**
 * Payments Page
 * 
 * Premium UI for managing clinic income and transactions.
 * Features:
 * - Real-time statistics
 * - Desktop Table with glassmorphism
 * - Mobile Card Feed with native feel
 * - Advanced Multi-step Modal for adding payments logic
 */
export default function Payments() {
  const { t, language } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isDoctor } = useAuth();
  const { clinicName } = useClinic();
  const queryClient = useQueryClient();

  // ── States ───────────────────────────────────────────────────────────
  const [payments, setPayments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingTimerRef = useRef(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [newPatientOpen, setNewPatientOpen] = useState(false);

  // Excel filter, sort & density states
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'today' | 'thisMonth' | 'hasDebt' | 'cash' | 'card'
  const [sortField, setSortField] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' | 'desc'
  const [density, setDensity] = useState(() => localStorage.getItem('payments_table_density') || 'compact');
  const [copiedPhoneId, setCopiedPhoneId] = useState(null);

  const toggleDensity = (newDensity) => {
    setDensity(newDensity);
    localStorage.setItem('payments_table_density', newDensity);
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const handleCopyPhone = (e, phone, id) => {
    e.stopPropagation();
    if (!phone) return;
    navigator.clipboard.writeText(phone);
    setCopiedPhoneId(id);
    toast.success(t('patients.copied') || "Raqam nusxalandi");
    setTimeout(() => setCopiedPhoneId(null), 2000);
  };
  const getInitialTime = () => {
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
  };

  const [form, setForm] = useState({
    patient_id: '', 
    patient_name: '', 
    service_name: '',
    amount: 0, 
    notes: '',
    type: 'Income',
    method: 'Cash',
    doctor_id: '',
    created_at: getInitialTime(),
    date: getInitialTime().split('T')[0],
    receipt_url: ''
  });
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [previewReceiptUrl, setPreviewReceiptUrl] = useState(null);
  const receiptFileInputRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [editPayment, setEditPayment] = useState(null);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [patientServices, setPatientServices] = useState([]);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceData, setInvoiceData] = useState(null);
  const invoiceRef = useRef(null);
  const [selectedPaymentDebt, setSelectedPaymentDebt] = useState(null);
  const [selectedPaymentPatientData, setSelectedPaymentPatientData] = useState(null);
  const [patientCurrentTotals, setPatientCurrentTotals] = useState({});
  const [isMobile, setIsMobile] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [realPatientDebt, setRealPatientDebt] = useState(null);
  const [loadingDebt, setLoadingDebt] = useState(false);
  const [patientBalances, setPatientBalances] = useState({});
  const [patientPlans, setPatientPlans] = useState([]);
  const [selectedPlanForInvoice, setSelectedPlanForInvoice] = useState(null);
  const [showPlanInvoiceModal, setShowPlanInvoiceModal] = useState(false);
  const [patientPaymentsHistory, setPatientPaymentsHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // ── React Query: Patients + Doctors + Treatment Plans (initial load) ─────
  const { data: initialPatients = [] } = useQuery({
    queryKey: QUERY_KEYS.patients,
    queryFn: () => base44.entities.Patient.list('full_name', 200),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
  const { data: initialDoctors = [] } = useQuery({
    queryKey: QUERY_KEYS.doctors,
    queryFn: async () => {
      try {
        const users = await base44.entities.User.list('name', 100);
        const docs = (users || []).filter(u => u.role?.toLowerCase() === 'doctor' || u.role?.toLowerCase() === 'admin');
        return docs.length > 0 ? docs : await base44.entities.User.filter({ role: 'doctor' }, 'name');
      } catch {
        return base44.entities.User.filter({ role: 'doctor' }, 'name').catch(() => []);
      }
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
  });
  const { data: allTreatmentPlans = [] } = useQuery({
    queryKey: ['allTreatmentPlansForPayments'],
    queryFn: () => base44.entities.TreatmentPlan.list('-created_date', 300),
    enabled: !!user,
    staleTime: 3 * 60 * 1000,
  });

  // Seed patients/doctors from query cache on first load
  useEffect(() => {
    if (initialPatients.length > 0 && patients.length === 0) setPatients(initialPatients);
  }, [initialPatients, patients.length]);
  useEffect(() => {
    if (initialDoctors.length > 0 && doctors.length === 0) setDoctors(initialDoctors);
  }, [initialDoctors, doctors.length]);

  // ── Debounce search ──────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // ── Open and prefill modal from location.state (e.g. from Debts or Appointments) ──
  useEffect(() => {
    if (location.state?.openAddModal) {
      const pId = location.state.prefillPatient || '';
      const pName = location.state.prefillPatientName || '';
      const pAmount = location.state.prefillAmount !== undefined && location.state.prefillAmount !== null && location.state.prefillAmount !== '' ? location.state.prefillAmount : '';
      const pDoc = location.state.prefillDoctor || '';
      const pNotes = location.state.prefillNotes || '';
      const pCat = location.state.prefillCategory || '';

      const now = new Date();
      const tzOffset = now.getTimezoneOffset() * 60000;
      const localISOTime = new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
      const localDate = new Date(now.getTime() - tzOffset).toISOString().split('T')[0];

      const pat = patients.find(p => p.id === pId);
      const plansForPat = (allTreatmentPlans || []).filter(p => p.patient_id === pId);
      const resolvedDocId = resolveDoctorId(pat || { main_treatment_provider: pDoc }, plansForPat, doctors, user, isDoctor) || pDoc;

      setForm({
        patient_id: pId,
        patient_name: pName,
        service_name: pCat,
        amount: pAmount,
        notes: pNotes,
        type: 'Income',
        method: 'Cash',
        doctor_id: isDoctor ? user?.id : resolvedDocId,
        created_at: localISOTime,
        date: localDate,
        receipt_url: ''
      });

      setModalOpen(true);

      // Clean up history state so page refresh doesn't reopen modal endlessly
      window.history.replaceState({}, document.title);
    }
  }, [location.state, isDoctor, user, patients, allTreatmentPlans, doctors]);

  // Responsive check
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // ── React Query: Payments list (paginated + searchable) ─────────────────
  const {
    data: paymentsPageData,
    isFetching: paymentsFetching,
  } = useQuery({
    queryKey: ['payments', debouncedSearch, page, isDoctor, user?.id],
    queryFn: async () => {
      const offset = page * PAGE_SIZE;
      if (isDoctor && user?.id) {
        const pays = await base44.entities.Payment.filter({ doctor_id: user.id }, '-date', PAGE_SIZE, offset).catch(() => []);
        if (debouncedSearch) {
          const q = debouncedSearch.toLowerCase();
          return (pays || []).filter(p => p.patient_name?.toLowerCase().includes(q) || p.service_name?.toLowerCase().includes(q));
        }
        return pays || [];
      }
      const pays = debouncedSearch
        ? await base44.entities.Payment.search(debouncedSearch, PAGE_SIZE, offset)
        : await base44.entities.Payment.list('-date', PAGE_SIZE, offset);
      return pays || [];
    },
    enabled: !!user,
    staleTime: 3 * 60 * 1000,
    placeholderData: (prev) => prev, // Eski ma'lumot search paytida ko'rinib turadi
  });

  const loading = paymentsFetching && payments.length === 0;

  // Merge paginated data + fetch missing patients
  useEffect(() => {
    if (!paymentsPageData) return;
    const rawPays = paymentsPageData;
    const validPays = [...rawPays].sort((a, b) => {
      const ta = a.created_date || a.created_at || a.date || '';
      const tb = b.created_date || b.created_at || b.date || '';
      return tb.localeCompare(ta);
    });

    const applyPage = async () => {
      // Fetch missing patients
      let currentPatients = patients;
      const existingIds = new Set(currentPatients.map(p => p.id));
      const missingIds = [...new Set(validPays.map(p => p.patient_id).filter(id => id && !existingIds.has(id)))];
      if (missingIds.length > 0) {
        try {
          const fetched = await Promise.all(missingIds.map(id => base44.entities.Patient.read(id).catch(() => null)));
          currentPatients = [...currentPatients, ...fetched.filter(Boolean)];
        } catch {}
      }

      if (page === 0) {
        const seen = new Set();
        setPayments(validPays.filter(p => { if (!p.id || seen.has(p.id)) return false; seen.add(p.id); return true; }));
        setPatients(currentPatients);
      } else {
        setPayments(prev => {
          const seen = new Set(prev.map(p => p.id));
          return [...prev, ...validPays.filter(p => p.id && !seen.has(p.id))];
        });
        setPatients(currentPatients);
      }
      setHasMore(rawPays.length === PAGE_SIZE);
      setLoadingMore(false);
    };
    applyPage();
   
  }, [paymentsPageData, page]);

  // ── React Query: Stats (10 daqiqa kesh — sahifa ochilganda 1 marta yuklanadi) ─
  const { data: statsData } = useQuery({
    queryKey: ['paymentStats', isDoctor, user?.id],
    queryFn: async () => {
      if (isDoctor && user?.id) {
        const docPays = await base44.entities.Payment.filter({ doctor_id: user.id }, '-date', 500, 0).catch(() => []);
        return docPays || [];
      }
      const allPays = await base44.entities.Payment.list('-date', 500, 0);
      return allPays || [];
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000, // 10 daqiqa — statsni har search da qayta yuklamaslik
  });

  const stats = useMemo(() => {
    if (!statsData) return { totalRevenue: 0, monthRevenue: 0, todayRevenue: 0, totalCount: 0 };
    const today = new Date().toISOString().split('T')[0];
    const filteredStats = (statsData || []).filter(p => {
      if (isDoctor && user?.id && String(p.doctor_id) !== String(user.id)) return false;
      return true;
    });
    const incomePays = filteredStats.filter(p => !p.type || p.type?.toLowerCase() === 'income');
    return {
      totalRevenue: incomePays.reduce((s, p) => s + (Number(p.amount) || 0), 0),
      monthRevenue: incomePays.filter(p => (p.date || '').slice(0, 7) === today.slice(0, 7)).reduce((s, p) => s + (Number(p.amount) || 0), 0),
      todayRevenue: incomePays.filter(p => (p.date || '').slice(0, 10) === today).reduce((s, p) => s + (Number(p.amount) || 0), 0),
      totalCount: filteredStats.length,
    };
  }, [statsData, isDoctor, user?.id]);

  // Pagination: load next page
  useEffect(() => {
    if (page > 0) setLoadingMore(true);
  }, [page]);

  // Patient payments history
  const loadPatientPaymentsHistory = async (patientId) => {
    if (!patientId) return;
    setLoadingHistory(true);
    try {
      const history = await base44.entities.Payment.filter({ patient_id: patientId }, '-date', 1000);
      // Faqat haqiqiy to'lov operatsiyalarini ko'rsatamiz (ichki reja qarzlari dublikat bo'lib chiqmasligi uchun)
      const actualHistory = (history || []).filter(pay => {
        const notesLower = (pay.notes || '').toLowerCase();
        const pType = (pay.type || '').toLowerCase();
        const isLinkedPlanInternal = (pType === 'debt' || pType === 'discount') && 
          (pay.plan_id || notesLower.includes('linked to plan') || notesLower.includes('reja:') || notesLower.includes('avtomatik chegirma') || notesLower.includes('reja yangilandi'));
        if (isLinkedPlanInternal) return false;
        return true;
      });

      // Aniq xronologik tartib: Eng oxirgi (yangi) to'lovlar eng tepada
      actualHistory.sort((a, b) => {
        const dateA = new Date(a.created_date || a.created_at || a.date || 0).getTime();
        const dateB = new Date(b.created_date || b.created_at || b.date || 0).getTime();
        return dateB - dateA;
      });

      setPatientPaymentsHistory(actualHistory);
    } catch (err) {
      console.error('Failed to load patient payments history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handlePatientSelect = async (patientId) => {
    if (!patientId) {
      setForm(prev => ({ ...prev, patient_id: '', patient_name: '', doctor_id: isDoctor ? user?.id : '' }));
      setPatientServices([]);
      setSelectedServiceId('');
      setPatientPlans([]);
      setRealPatientDebt(null);
      return;
    }
    const patient = patients.find(p => p.id === patientId);
    const assignedDocId = isDoctor ? user?.id : (patient?.main_treatment_provider || form.doctor_id || '');
    setForm(prev => ({
      ...prev,
      patient_id: patientId,
      patient_name: patient?.full_name || '',
      doctor_id: assignedDocId,
    }));

    // Bemorning oxirgi to'lovidagi haqiqiy qoldiq qarzini hisoblash
    setLoadingDebt(true);
    try {
      const [pays, plans] = await Promise.all([
        base44.entities.Payment.filter({ patient_id: patientId }, '-date', 1000),
        base44.entities.TreatmentPlan.filter({ patient_id: patientId }, '-created_date', 50).catch(() => [])
      ]);
      setPatientPlans(plans || []);
      const totalPlansPrice = (plans || []).reduce((sum, pl) => sum + (Number(pl.total_price) || 0), 0);

      const totalIncomes = (pays || []).filter(p => p.type?.toLowerCase() === 'income').reduce((s, p) => s + (Number(p.amount) || 0), 0);
      const totalDebts = (pays || []).filter(p => p.type?.toLowerCase() === 'debt').reduce((s, p) => s + (Number(p.amount) || 0), 0);
      const totalRefunds = (pays || []).filter(p => p.type?.toLowerCase() === 'refund').reduce((s, p) => s + (Number(p.amount) || 0), 0);
      const totalDiscounts = (pays || []).filter(p => p.type?.toLowerCase() === 'discount').reduce((s, p) => s + Math.abs(Number(p.amount) || 0), 0);

      let calcDebt = 0;
      if (totalPlansPrice > 0) {
        calcDebt = Math.max(0, (totalPlansPrice + totalRefunds) - (totalIncomes + totalDiscounts));
      } else if (totalDebts > 0) {
        calcDebt = Math.max(0, (totalDebts + totalRefunds) - (totalIncomes + totalDiscounts));
      } else {
        calcDebt = Math.max(0, (patient?.total_debt || 0));
      }
      setRealPatientDebt(calcDebt);
    } catch {
      setRealPatientDebt(patient?.total_debt ?? 0);
    } finally {
      setLoadingDebt(false);
    }
  };

  useEffect(() => {
    if (selectedPayment?.patient_id) {
      loadPatientPaymentsHistory(selectedPayment.patient_id);
      setShowHistory(false);
    } else {
      setPatientPaymentsHistory([]);
      setShowHistory(false);
    }
  }, [selectedPayment]);

  useEffect(() => {
    if (editPayment) {
      setSelectedDoctorId(editPayment.doctor_id || '');
    } else {
      setSelectedDoctorId('');
    }
  }, [editPayment]);

  // onSaved: to'lov saqlangandan keyin keshni yangilash
  const invalidatePayments = () => {
    queryClient.invalidateQueries({ queryKey: ['payments'] });
    queryClient.invalidateQueries({ queryKey: ['paymentStats'] });
    queryClient.invalidateQueries({ queryKey: ['payment-stats'] });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.paymentStats });
  };

  const filteredPayments = (() => {
    const seen = new Set();
    return [...payments]
      .filter(p => {
        if (!p.id || seen.has(p.id)) return false;
        seen.add(p.id);
        const notesLower = (p.notes || '').toLowerCase();
        const pType = (p.type || '').toLowerCase();
        const isLinkedPlanInternal = (pType === 'debt' || pType === 'discount') && 
          (p.plan_id || notesLower.includes('linked to plan') || notesLower.includes('reja:') || notesLower.includes('avtomatik chegirma') || notesLower.includes('reja yangilandi'));
        return !isLinkedPlanInternal;
      })
      .sort((a, b) => {
        const ta = a.created_date || a.created_at || a.date || '';
        const tb = b.created_date || b.created_at || b.date || '';
        return tb.localeCompare(ta);
      });
  })();

  const displayPayments = filteredPayments.filter(p => {
    if (isDoctor && String(p.doctor_id) !== String(user?.id)) return false;
    const t = String(p.type || 'Income').toLowerCase();
    const notesLower = (p.notes || '').toLowerCase();
    const isLinkedPlanInternal = (t === 'debt' || t === 'discount') && 
      (p.plan_id || notesLower.includes('linked to plan') || notesLower.includes('reja:') || notesLower.includes('avtomatik chegirma') || notesLower.includes('reja yangilandi'));
    if (isLinkedPlanInternal) return false;
    return t === 'income' || t === 'expense' || t === 'refund';
  });

  // ── Excel Filtered & Sorted Payments ─────────────────────────────────────
  const sortedDisplayPayments = useMemo(() => {
    let list = [...displayPayments];

    const today = new Date().toISOString().split('T')[0];
    const thisMonth = today.slice(0, 7);

    if (activeFilter === 'today') {
      list = list.filter(p => (p.date || p.created_date || p.created_at || '').slice(0, 10) === today);
    } else if (activeFilter === 'thisMonth') {
      list = list.filter(p => (p.date || p.created_date || p.created_at || '').slice(0, 7) === thisMonth);
    } else if (activeFilter === 'hasDebt') {
      list = list.filter(p => {
        const pat = patients.find(pt => pt.id === p.patient_id);
        const debtVal = (patientBalances[p.id]?.debtAtTime !== undefined)
          ? patientBalances[p.id].debtAtTime
          : (p.debt_amount !== undefined && p.debt_amount !== null ? Number(p.debt_amount) : (Number(pat?.total_debt) || 0));
        return debtVal > 0;
      });
    } else if (activeFilter === 'cash') {
      list = list.filter(p => (p.method || 'Cash').toLowerCase() === 'cash');
    } else if (activeFilter === 'card') {
      list = list.filter(p => (p.method || '').toLowerCase() === 'card');
    }

    list.sort((a, b) => {
      let valA, valB;
      switch (sortField) {
        case 'patient_name':
          valA = (a.patient_name || '').toLowerCase();
          valB = (b.patient_name || '').toLowerCase();
          return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        case 'amount':
          valA = Number(a.amount) || 0;
          valB = Number(b.amount) || 0;
          return sortOrder === 'asc' ? valA - valB : valB - valA;
        case 'debt': {
          const patA = patients.find(pt => pt.id === a.patient_id);
          const patB = patients.find(pt => pt.id === b.patient_id);
          valA = (patientBalances[a.id]?.debtAtTime !== undefined) ? patientBalances[a.id].debtAtTime : (Number(patA?.total_debt) || 0);
          valB = (patientBalances[b.id]?.debtAtTime !== undefined) ? patientBalances[b.id].debtAtTime : (Number(patB?.total_debt) || 0);
          return sortOrder === 'asc' ? valA - valB : valB - valA;
        }
        case 'service':
          valA = (a.service_name || a.category || '').toLowerCase();
          valB = (b.service_name || b.category || '').toLowerCase();
          return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        case 'doctor':
          valA = (doctors.find(d => d.id === a.doctor_id)?.name || '').toLowerCase();
          valB = (doctors.find(d => d.id === b.doctor_id)?.name || '').toLowerCase();
          return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        case 'date':
        default:
          valA = new Date(a.created_date || a.created_at || a.date || 0).getTime();
          valB = new Date(b.created_date || b.created_at || b.date || 0).getTime();
          return sortOrder === 'asc' ? valA - valB : valB - valA;
      }
    });

    return list;
  }, [displayPayments, activeFilter, sortField, sortOrder, patients, patientBalances, doctors]);

  const paymentsTableSummary = useMemo(() => {
    const totalCount = sortedDisplayPayments.length;
    const sumAmount = sortedDisplayPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const sumDebt = sortedDisplayPayments.reduce((s, p) => {
      const pat = patients.find(pt => pt.id === p.patient_id);
      const d = (patientBalances[p.id]?.debtAtTime !== undefined)
        ? patientBalances[p.id].debtAtTime
        : (p.debt_amount !== undefined && p.debt_amount !== null ? Number(p.debt_amount) : (Number(pat?.total_debt) || 0));
      return s + d;
    }, 0);
    const avgAmount = totalCount > 0 ? Math.round(sumAmount / totalCount) : 0;
    return { totalCount, sumAmount, sumDebt, avgAmount };
  }, [sortedDisplayPayments, patients, patientBalances]);

  const handleExportExcel = () => {
    try {
      if (!sortedDisplayPayments || sortedDisplayPayments.length === 0) {
        toast.warning("Eksport qilish uchun to'lovlar topilmadi");
        return;
      }

      const headers = [
        "№",
        "Bemor (F.I.Sh)",
        "Telefon",
        "Xizmat / Kategoriya",
        "To'lov Summasi (UZS)",
        "Qoldiq Qarz (UZS)",
        "To'lov Usuli",
        "Shifokor",
        "Sana va Vaqt"
      ];

      const csvRows = [];
      csvRows.push(headers.join(","));

      sortedDisplayPayments.forEach((p, idx) => {
        const pat = patients.find(pt => pt.id === p.patient_id);
        const debtVal = (patientBalances[p.id]?.debtAtTime !== undefined)
          ? patientBalances[p.id].debtAtTime
          : (p.debt_amount !== undefined && p.debt_amount !== null ? Number(p.debt_amount) : (Number(pat?.total_debt) || 0));
        const docName = doctors.find(d => d.id === p.doctor_id)?.name || 'Biriktirilmagan';
        const dtRaw = p.created_date || p.created_at || p.date;
        const dtStr = dtRaw ? new Date(dtRaw).toLocaleString('uz-UZ') : '';

        const row = [
          idx + 1,
          `"${(p.patient_name || '').replace(/"/g, '""')}"`,
          `"${formatPhoneSingleLine(pat?.phone)}"`,
          `"${(formatCategory(p.service_name || p.category || '')).replace(/"/g, '""')}"`,
          Number(p.amount) || 0,
          debtVal,
          `"${getPaymentMethodLabel(p.method, t)}"`,
          `"${docName.replace(/"/g, '""')}"`,
          `"${dtStr}"`
        ];
        csvRows.push(row.join(","));
      });

      const csvContent = "\uFEFF" + csvRows.join("\r\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const dateStr = new Date().toISOString().split("T")[0];
      link.setAttribute("href", url);
      link.setAttribute("download", `Tolovlar_Royxati_${dateStr}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Excel fayli muvaffaqiyatli yuklandi (${sortedDisplayPayments.length} ta to'lov)`);
    } catch (err) {
      console.error("Excel export error:", err);
      toast.error("Excel eksportda xatolik yuz berdi");
    }
  };

  // Calculate patient balances from already-loaded payments and plans (accounting for discounts)
  useEffect(() => {
    if (!payments.length) {
      setPatientBalances({});
      setPatientCurrentTotals({});
      return;
    }

    // Group payments by patient ID
    const byPatient = {};
    for (const p of payments) {
      if (!p.patient_id) continue;
      if (!byPatient[p.patient_id]) byPatient[p.patient_id] = [];
      byPatient[p.patient_id].push(p);
    }

    const balancesMap = {};
    const totalsMap = {};

    for (const [patientId, patPays] of Object.entries(byPatient)) {
      const sorted = [...patPays].sort((a, b) => {
        const ta = a.created_date || a.created_at || (a.date ? a.date + 'T00:00:00' : '') || '';
        const tb = b.created_date || b.created_at || (b.date ? b.date + 'T00:00:00' : '') || '';
        return ta.localeCompare(tb);
      });

      const plansForPatient = (allTreatmentPlans || []).filter(pl => pl.patient_id === patientId);
      const totalPlansPrice = plansForPatient.reduce((sum, pl) => sum + (Number(pl.total_price) || 0), 0);

      let runningDebt = totalPlansPrice > 0 ? totalPlansPrice : 0;
      let runningPaid = 0;
      let runningDiscount = 0;

      for (const payment of sorted) {
        const type = String(payment.type || 'Income').toLowerCase();
        const rawAmount = Number(payment.amount) || 0;
        const amount = Math.abs(rawAmount);
        const notesLower = (payment.notes || '').toLowerCase();
        const isLinkedPlanInternal = (type === 'debt' || type === 'discount') && 
          (payment.plan_id || notesLower.includes('linked to plan') || notesLower.includes('reja:') || notesLower.includes('avtomatik chegirma') || notesLower.includes('reja yangilandi'));

        if (type === 'income') {
          runningPaid += amount;
          runningDebt = Math.max(0, runningDebt - amount);
        } else if (type === 'debt') {
          if (totalPlansPrice === 0 || !isLinkedPlanInternal) {
            runningDebt += amount;
          }
        } else if (type === 'discount') {
          if (totalPlansPrice === 0 || !isLinkedPlanInternal) {
            runningDiscount += amount;
            runningDebt = Math.max(0, runningDebt - amount);
          }
        } else if (type === 'refund') {
          runningDebt += amount;
          runningPaid = Math.max(0, runningPaid - amount);
        }

        balancesMap[payment.id] = {
          debtAtTime: Math.max(0, runningDebt),
          totalToPayAtTime: Math.max(0, runningDebt) + runningPaid,
        };
      }

      totalsMap[patientId] = {
        currentDebt: Math.max(0, runningDebt),
        totalPaid: runningPaid,
        totalDiscount: runningDiscount
      };
    }

    setPatientBalances(balancesMap);
    setPatientCurrentTotals(totalsMap);
  }, [payments, allTreatmentPlans]);


  const resetModal = () => {
    // Avval modalOpen=false qo'yamiz - boshqa state lar keyinroq tozalanadi
    setModalOpen(false);
    setSaving(false);
    setRealPatientDebt(null);
    setLoadingDebt(false);

    // Forma va boshqa state larni async tozalash (UI block qilmasin)
    setTimeout(() => {
      const now = new Date();
      const tzOffset = now.getTimezoneOffset() * 60000;
      const localISOTime = new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
      const localDate = new Date(now.getTime() - tzOffset).toISOString().split('T')[0];

      setForm({ 
        patient_id: '', 
        patient_name: '', 
        service_name: '', 
        amount: '', 
        created_at: localISOTime,
        date: localDate,
        type: 'Income',
        method: 'Cash',
        notes: '',
        receipt_url: '',
        doctor_id: isDoctor ? user?.id : ''
      });
      setPatientServices([]);
      setSelectedServiceId('');
      setPatientPlans([]);
    }, 100);
  };

  const handleSave = async () => {
    if (!form.patient_id || !form.amount || Number(form.amount) === 0) {
      toast.error('Iltimos, barcha maydonlarni to\'ldiring');
      return;
    }

    // Qarz yo'q bemorga Income to'lov bloklash — faqat yuklash tugagandan keyin tekshiramiz
    const isIncomeType = (form.type || 'Income').toLowerCase() === 'income';
    const currentAmount = Number(form.amount) || 0;
    if (isIncomeType && !loadingDebt && realPatientDebt !== null) {
      if (realPatientDebt === 0) {
        toast.error('Bu bemorning qarzi yo\'q. Kirim to\'lov qilib bo\'lmaydi!');
        return;
      }
      if (currentAmount > realPatientDebt) {
        toast.error('Kiritilgan summa bemor qarzidan ko\'p! Maksimal: ' + realPatientDebt.toLocaleString() + ' UZS');
        return;
      }
    }
    setSaving(true);

    // Snapshot form values before modal closes
    const savedPatientId = form.patient_id;
    const savedType = form.type || 'Income';
    const savedAmount = Number(form.amount) || 0;
    const savedServiceId = selectedServiceId;
    const savedServiceObj = patientServices.find(s => s.id === selectedServiceId) || null;

    let finalDate;
    try {
      finalDate = form.created_at
        ? form.created_at.split('T')[0]
        : (form.date || new Date().toISOString().split('T')[0]);
    } catch (e) {
      finalDate = new Date().toISOString().split('T')[0];
    }

    const validCategories = ['Treatment', 'Consultation', 'Implant', 'Crown', 'Bridge', 'Whitening', 'Orthodontics', 'Surgery', 'X-Ray', 'Lab Fee', 'Material', 'Equipment', 'Salary', 'Rent', 'Utilities', 'Marketing', 'Other'];
    const finalCategory = validCategories.includes(form.category) ? form.category : 'Treatment';

    const selectedPatObj = patients.find(p => p.id === savedPatientId);
    const finalDoctorId = isDoctor 
      ? user.id 
      : (form.doctor_id || selectedPatObj?.main_treatment_provider || '');

    const nowISO = new Date().toISOString();
    const payload = {
      patient_id: savedPatientId,
      patient_name: form.patient_name,
      type: savedType,
      category: finalCategory,
      amount: savedAmount,
      method: form.method || 'Cash',
      date: finalDate,
      created_at: nowISO,
      service_name: form.service_name || '',
      notes: form.notes || '',
      receipt_url: form.receipt_url || null,
      doctor_id: finalDoctorId,
    };

    try {
      const savedPayment = await base44.entities.Payment.create(payload);

      // Optimistik update: ro'yxat TEPASIGA qo'y
      const newPayment = {
        ...payload,
        id: savedPayment?.id || `temp_${Date.now()}`,
        created_date: savedPayment?.created_date || nowISO,
      };
      setPayments(prev => {
        const without = prev.filter(p => p.id !== newPayment.id);
        return [newPayment, ...without];
      });

      // ✅ TO'LOV SAQLANDI — MODAL DARHOL YOPILADI
      toast.success('To\'lov muvaffaqiyatli saqlandi');
      resetModal(); // ichida setSaving(false) ham bor
      // ── FONDA (background) qarz va reja yangilanadi ──
      Promise.resolve().then(async () => {
        try {
          // Tanlangan xizmatni yoki rejani "to'langan" deb belgilash va paid_amount ni sinxronlashtirish
          if (savedType.toLowerCase() === 'income') {
            try {
              const plans = await base44.entities.TreatmentPlan.filter({ patient_id: savedPatientId }, '-created_date', 50);
              if (plans && plans.length > 0) {
                if (savedServiceObj) {
                  const targetPlan = plans.find(pl => pl.id === savedServiceObj.plan_id);
                  if (targetPlan) {
                    const updatedServices = (targetPlan.services || []).map(svc => {
                      const svcName = svc.service_name || svc.name || '';
                      const svcTooth = targetPlan.tooth_number || '';
                      if (svcName === savedServiceObj.service_name && svcTooth === savedServiceObj.tooth_number) {
                        return { ...svc, payment_status: 'paid' };
                      }
                      return svc;
                    });
                    const newPaid = Math.min(
                      (Number(targetPlan.paid_amount) || 0) + savedAmount,
                      Number(targetPlan.total_price) || 0
                    );
                    await base44.entities.TreatmentPlan.update(targetPlan.id, {
                      paid_amount: newPaid,
                      services: updatedServices,
                    });
                  }
                } else if (plans.length === 1) {
                  // Yagona reja bo'lsa, umumiy to'lov ham unga qo'shiladi
                  const targetPlan = plans[0];
                  const newPaid = Math.min(
                    (Number(targetPlan.paid_amount) || 0) + savedAmount,
                    Number(targetPlan.total_price) || 0
                  );
                  await base44.entities.TreatmentPlan.update(targetPlan.id, {
                    paid_amount: newPaid,
                  });
                }
              }
            } catch (planErr) {
              console.error('Plan update error:', planErr);
            }
          }

          // Bemor qarzi yangilash — barcha to'lovlardan qayta hisoblanadi (aniq natija)
          if (savedPatientId) {
            // Barcha to'lovlarni olib, qarzni qayta hisoblaymiz — PatientProfile bilan bir xil formula
            const allPays = await base44.entities.Payment.filter({ patient_id: savedPatientId }, 'date', 5000);

            const totalIncomes = (allPays || [])
              .filter(p => p.type?.toLowerCase() === 'income')
              .reduce((s, p) => s + (Number(p.amount) || 0), 0);
            const totalDebts = (allPays || [])
              .filter(p => p.type?.toLowerCase() === 'debt')
              .reduce((s, p) => s + (Number(p.amount) || 0), 0);
            const totalRefunds = (allPays || [])
              .filter(p => p.type?.toLowerCase() === 'refund')
              .reduce((s, p) => s + (Number(p.amount) || 0), 0);
            const totalDiscounts = (allPays || [])
              .filter(p => p.type?.toLowerCase() === 'discount')
              .reduce((s, p) => s + Math.abs(Number(p.amount) || 0), 0);

            const finalDebt = Math.max(0, (totalDebts + totalRefunds) - (totalIncomes + totalDiscounts));
            const finalPaid = totalIncomes;

            await base44.entities.Patient.update(savedPatientId, {
              total_paid: finalPaid,
              total_debt: finalDebt,
            });

            setPatients(prev => prev.map(pt =>
              pt.id === savedPatientId
                ? { ...pt, total_paid: finalPaid, total_debt: finalDebt }
                : pt
            ));
          }

          // Stats va ro'yxatni yangilash
          invalidatePayments();
        } catch (bgErr) {
          console.error('Background update error:', bgErr);
        }
      });

    } catch (error) {
      console.error('Payment Save error:', error);
      toast.error(error.message || 'Saqlashda xatolik yuz berdi. Iltimos qaytadan urunib ko\'ring.');
      setSaving(false);
    }
  };

  const handleDelete = async (id, patientId) => {
    if (!window.confirm('Haqiqatan ham ushbu to\'lovni o\'chirmoqchimisiz?')) return;
    try {
      await base44.entities.Payment.delete(id);
      
      // ✅ MUHIM: Faqat shu bemor uchun qarz yangilanadi, boshqalar TEGMASDAN qoladi
      if (patientId) {
        // O'chirilgan to'lovni patients listdan topamiz (u hali state da bor)
        const deletedPayment = payments.find(p => p.id === id);
        const deletedType = (deletedPayment?.type || 'income').toLowerCase();
        const deletedAmount = Number(deletedPayment?.amount) || 0;

        // Bemorning hozirgi holatini o'qib olamiz (Senior approach: fetch from DB directly)
        const currentPatient = await base44.entities.Patient.read(patientId);
        const currentDebt = Number(currentPatient?.total_debt) || 0;
        const currentPaid = Number(currentPatient?.total_paid) || 0;

        let newDebt = currentDebt;
        let newPaid = currentPaid;

        if (deletedType === 'income') {
          // Income o'chirildi: to'lagan summani kamayt, qarzni qaytaramiz
          newPaid = Math.max(0, currentPaid - deletedAmount);
          newDebt = currentDebt + deletedAmount;
        } else if (deletedType === 'debt') {
          // Debt o'chirildi: qarzni kamaytir
          newDebt = Math.max(0, currentDebt - deletedAmount);
        } else if (deletedType === 'discount') {
          // Discount o'chirildi: qarzni qaytaramiz
          newDebt = currentDebt + deletedAmount;
        } else if (deletedType === 'refund') {
          // Refund o'chirildi: qarzni kamaytir, to'lagan summani qaytaramiz
          newDebt = Math.max(0, currentDebt - deletedAmount);
          newPaid = currentPaid + deletedAmount;
        }

        await base44.entities.Patient.update(patientId, {
          total_paid: newPaid,
          total_debt: newDebt
        });

        // ✅ Mahalliy patients state ni FAQAT shu bemor uchun yangilaymiz
        setPatients(prev => prev.map(pt =>
          pt.id === patientId
            ? { ...pt, total_paid: newPaid, total_debt: newDebt }
            : pt  // Boshqa bemorlar O'ZGARMASDAN qoladi!
        ));
      }


      toast.success('O\'chirildi va qarz qayta hisoblandi');
      invalidatePayments();
    } catch (error) {
      toast.error('O\'chirishda xatolik');
    }
  };

  const handleAssignDoctor = async (id, docId) => {
    console.log('handleAssignDoctor triggered:', id, docId);
    try {
      if (!id) {
        toast.error('To\'lov ID si topilmadi');
        return;
      }
      if (!docId) {
        toast.error('Shifokor ID si topilmadi');
        return;
      }
      await base44.entities.Payment.update(id, { doctor_id: docId });
      toast.success('Shifokor biriktirildi');
      setEditPayment(null);
      invalidatePayments();
    } catch (error) {
      console.error('handleAssignDoctor error:', error);
      toast.error('Xatolik yuz berdi: ' + (error?.message || error || 'Unknown error'));
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('uz-UZ').format(val || 0) + ' UZS';
  };

  const handleNewPatientSaved = (newPatient) => {
    setPatients(prev => [newPatient, ...prev]);
    const assignedDocId = resolveDoctorId(newPatient, [], doctors, user, isDoctor);
    setForm(prev => ({ 
      ...prev, 
      patient_id: newPatient.id, 
      patient_name: newPatient.full_name,
      doctor_id: assignedDocId || prev.doctor_id || ''
    }));
    setNewPatientOpen(false);
  };

  // To'lov tafsiloti dialogini ochish — real qarz va reja moliyasini DB dan hisoblaydi
  const openPaymentDetail = async (p) => {
    setSelectedPayment(p);
    setSelectedPaymentDebt(null); // yuklanmoqda
    setSelectedPaymentPatientData(null);
    try {
      const [allPays, allPlans] = await Promise.all([
        base44.entities.Payment.filter({ patient_id: p.patient_id }, 'date', 5000),
        base44.entities.TreatmentPlan.filter({ patient_id: p.patient_id }, '-created_date', 100).catch(() => [])
      ]);

      const paysList = allPays || [];
      const plansList = allPlans || [];

      // Helper function for original price of a single plan (without discount)
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

      // Matched linked plan or all plans
      const linkedPlan = plansList.find(pl => (p.plan_id && pl.id === p.plan_id) || (p.notes && p.notes.includes(pl.id)));
      const targetPlans = linkedPlan ? [linkedPlan] : plansList;

      // 1. Reja chegirmasiz asl narxi, chegirma va chegirmali jami summa
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
        originalPrice = totalDebts > 0 ? totalDebts + totalDiscountPayments : (Number(p.amount) || 0);
        discountAmount = totalDiscountPayments;
        finalPlanTotal = Math.max(0, originalPrice - discountAmount);
        discountPercent = originalPrice > 0 ? Math.round((discountAmount / originalPrice) * 100) : 0;
      }

      // 2. Running balance — shu to'lov paytidagi qoldiq qarz
      const sorted = [...paysList].sort((a, b) => {
        const ta = a.created_date || a.created_at || (a.date ? a.date + 'T00:00:00' : '');
        const tb = b.created_date || b.created_at || (b.date ? b.date + 'T00:00:00' : '');
        return ta.localeCompare(tb);
      });

      const totalPlansPrice = plansList.reduce((sum, pl) => sum + (Number(pl.total_price) || 0), 0);
      const totalDebts = paysList.filter(pay => pay.type?.toLowerCase() === 'debt').reduce((s, pay) => s + (Number(pay.amount) || 0), 0);
      const initialObligation = totalPlansPrice > 0 ? totalPlansPrice : totalDebts;

      let cumIncomes = 0;
      let cumDiscounts = 0;
      let cumRefunds = 0;
      let cumDebts = 0;

      for (const pay of sorted) {
        const type = (pay.type || 'income').toLowerCase();
        const amt = Math.abs(Number(pay.amount) || 0);
        if (type === 'income') cumIncomes += amt;
        else if (type === 'refund') cumRefunds += amt;
        else if (type === 'discount' && totalPlansPrice === 0) cumDiscounts += amt;
        else if (type === 'debt' && totalPlansPrice === 0) cumDebts += amt;
        if (pay.id === p.id) break; // shu to'lovgacha
      }

      const debtAtThisTime = Math.max(0, (initialObligation + cumRefunds + cumDebts) - (cumIncomes + cumDiscounts));
      setSelectedPaymentDebt(debtAtThisTime);

      // 3. Bemorning barcha to'lov va rejalaridan umumiy real-time hisob-kitob
      const totalIncomes = paysList.filter(pay => pay.type?.toLowerCase() === 'income').reduce((s, pay) => s + (Number(pay.amount) || 0), 0);
      const totalDiscounts = paysList.filter(pay => pay.type?.toLowerCase() === 'discount').reduce((s, pay) => s + Math.abs(Number(pay.amount) || 0), 0);
      const totalRefunds = paysList.filter(pay => pay.type?.toLowerCase() === 'refund').reduce((s, pay) => s + (Number(pay.amount) || 0), 0);

      let currentDebt = 0;
      if (totalPlansPrice > 0) {
        const net = totalIncomes - totalPlansPrice - totalRefunds;
        currentDebt = net < 0 ? Math.abs(net) : 0;
      } else if (totalDebts > 0) {
        const net = totalIncomes + totalDiscounts - totalDebts - totalRefunds;
        currentDebt = net < 0 ? Math.abs(net) : 0;
      } else {
        const net = totalIncomes - totalRefunds;
        currentDebt = net < 0 ? Math.abs(net) : 0;
      }

      setSelectedPaymentPatientData({
        totalPaid: totalIncomes,
        currentDebt: currentDebt,
        totalDiscount: discountAmount > 0 ? discountAmount : totalDiscounts,
        discountPercent: discountPercent,
        originalPrice: originalPrice,
        finalPlanTotal: finalPlanTotal,
        totalDebts: totalDebts > 0 ? totalDebts : totalPlansPrice,
      });

      // DB bilan sinxronlash
      if (p.patient_id) {
        base44.entities.Patient.update(p.patient_id, {
          total_paid: totalIncomes,
          total_debt: currentDebt,
        }).catch(() => {});

        setPatients(prev => prev.map(pt => pt.id === p.patient_id ? { ...pt, total_paid: totalIncomes, total_debt: currentDebt } : pt));
      }
    } catch (err) {
      console.error('Error opening payment detail:', err);
      // fallback — bemorning hozirgi qarzi
      const pat = patients.find(pt => pt.id === p.patient_id);
      setSelectedPaymentDebt(Number(pat?.total_debt) || 0);
    }
  };

  // Hisob fakturasini ko'rish — bemorning to'liq hisobini yuklaydi
  const handleShowInvoice = async () => {
    const pat = patients.find(p => p.id === form.patient_id);
    if (!pat) return;
    try {
      const [allPays, plans] = await Promise.all([
        base44.entities.Payment.filter({ patient_id: form.patient_id }, '-date', 200),
        base44.entities.TreatmentPlan.filter({ patient_id: form.patient_id }, '-created_date', 50),
      ]);
      const income = (allPays || []).filter(p => p.type?.toLowerCase() === 'income').reduce((s, p) => s + (Number(p.amount) || 0), 0);
      const debt = (allPays || []).filter(p => p.type?.toLowerCase() === 'debt').reduce((s, p) => s + (Number(p.amount) || 0), 0);
      const discount = (allPays || []).filter(p => p.type?.toLowerCase() === 'discount').reduce((s, p) => s + Math.abs(Number(p.amount) || 0), 0);
      const refund = (allPays || []).filter(p => p.type?.toLowerCase() === 'refund').reduce((s, p) => s + (Number(p.amount) || 0), 0);
      const totalDebt = Math.max(0, (debt + refund) - (income + discount));
      setInvoiceData({
        patient: pat,
        payments: (allPays || []).filter(p => ['income', 'debt'].includes(p.type?.toLowerCase())).slice(0, 20),
        plans: plans || [],
        totalPaid: income,
        totalDebt,
        totalDiscount: discount,
        date: new Date().toLocaleDateString('uz-UZ'),
      });
      setInvoiceOpen(true);
    } catch (e) {
      toast.error('Faktura yuklanmadi');
    }
  };

  const handlePrintInvoice = () => {
    const el = invoiceRef.current;
    if (!el) return;
    const win = window.open('', '_blank');
    win.document.write(`
      <html><head><title>Hisob Faktura</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; color: #1e293b; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th { background: #0f172a; color: white; padding: 8px 10px; font-size: 10px; text-transform: uppercase; text-align: left; }
        td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; font-size: 11px; }
        .total-row td { font-weight: 900; font-size: 13px; border-top: 2px solid #1499AD; }
        .debt-row td { color: #ef4444; font-weight: 900; }
        h1 { margin: 0 0 4px; font-size: 22px; } h3 { margin: 0; color: #64748b; font-size: 13px; }
        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #1499AD; padding-bottom: 12px; margin-bottom: 16px; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 9px; font-weight: 900; text-transform: uppercase; }
        .income { background: #dcfce7; color: #16a34a; } .debt { background: #fee2e2; color: #dc2626; }
        @media print { @page { margin: 15mm; } }
      </style></head><body>
      ${el.innerHTML}
      </body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  const handlePrintSingleReceipt = async (payment, pat, doc, patientData, debtAtTime) => {
    let plansList = patientPlans || [];
    let histList = patientPaymentsHistory || [];

    if (payment?.patient_id && (plansList.length === 0 || histList.length === 0)) {
      try {
        const [fetchedPays, fetchedPlans] = await Promise.all([
          base44.entities.Payment.filter({ patient_id: payment.patient_id }, '-date', 100).catch(() => []),
          base44.entities.TreatmentPlan.filter({ patient_id: payment.patient_id }, '-created_date', 50).catch(() => [])
        ]);
        if (histList.length === 0) histList = fetchedPays || [];
        if (plansList.length === 0) plansList = fetchedPlans || [];
      } catch (err) {
        console.error("Print data fetch error:", err);
      }
    }

    const patientName = pat?.full_name || payment.patient_name || 'Bemor';
    const doctorName = doc?.name || doc?.full_name || 'Klinika shifokori';
    const dtRaw = payment.created_date || payment.created_at || payment.date || new Date().toISOString();
    const dtObj = new Date(dtRaw);
    const dateFormatted = !isNaN(dtObj) ? `${String(dtObj.getDate()).padStart(2,'0')}.${String(dtObj.getMonth()+1).padStart(2,'0')}.${dtObj.getFullYear()}` : new Date().toLocaleDateString('uz-UZ');
    const dateTimeFormatted = !isNaN(dtObj) ? `${dateFormatted} ${String(dtObj.getHours()).padStart(2,'0')}:${String(dtObj.getMinutes()).padStart(2,'0')}` : dateFormatted;
    const invoiceNo = (payment.id || '').split('-').pop()?.toUpperCase() || '4F255F';

    // Flatten services from plans
    let allServices = [];
    plansList.forEach(pl => {
      if (Array.isArray(pl.services) && pl.services.length > 0) {
        pl.services.forEach(s => {
          const rawToothId = pl.tooth_number || s.tooth_id || s.tooth || '—';
          allServices.push({
            name: s.service_name || s.name || pl.name || 'Davolash xizmati',
            category: getServiceCategoryLabel(s.category || pl.department || 'Plomba / Davolash', language),
            tooth: rawToothId && rawToothId !== 'general' ? rawToothId : '—',
            status: getServiceStatusLabel(s.status || pl.status || 'completed', language),
            price: Number(s.price || s.cost || 0)
          });
        });
      } else if (pl.name) {
        allServices.push({
          name: pl.name,
          category: getServiceCategoryLabel(pl.department || 'Davolash rejasi', language),
          tooth: pl.tooth_number || '—',
          status: getServiceStatusLabel(pl.status || 'completed', language),
          price: Number(pl.total_price || 0)
        });
      }
    });

    if (allServices.length === 0) {
      allServices.push({
        name: payment.service_name || payment.category || 'Davolash muolajasi',
        category: getServiceCategoryLabel(payment.category || 'Davolash', language),
        tooth: '—',
        status: getServiceStatusLabel('completed', language),
        price: Number(payment.amount || 0)
      });
    }

    const rawTotal = allServices.reduce((sum, s) => sum + (Number(s.price) || 0), 0) || Number(payment.amount || 0);

    // Calculate total discount across plans or payment
    let totalDiscountAmount = 0;
    plansList.forEach(pl => {
      let pDisc = Number(pl.discount_amount || 0);
      if (!pDisc && Number(pl.discount_percent) > 0) {
        const planServicesRaw = (pl.services || []).reduce((s, x) => s + Number(x.price || x.cost || 0), 0);
        const raw = planServicesRaw > 0 ? planServicesRaw : Number(pl.total_price || 0);
        pDisc = Math.floor(raw * (Number(pl.discount_percent) / 100));
      } else if (!pDisc && Number(pl.total_price) > 0) {
        const planServicesRaw = (pl.services || []).reduce((s, x) => s + Number(x.price || x.cost || 0), 0);
        if (planServicesRaw > Number(pl.total_price)) {
          pDisc = planServicesRaw - Number(pl.total_price);
        }
      }
      totalDiscountAmount += Math.max(0, pDisc);
    });

    if (totalDiscountAmount === 0 && payment?.discount_amount) {
      totalDiscountAmount = Number(payment.discount_amount || 0);
    }

    const discountPayments = (histList || []).filter(item => item.type?.toLowerCase() === 'discount');
    if (totalDiscountAmount === 0 && discountPayments.length > 0) {
      totalDiscountAmount = discountPayments.reduce((s, d) => s + Math.abs(Number(d.amount) || 0), 0);
    }

    const discountedTotal = Math.max(0, rawTotal - totalDiscountAmount);

    // Payments list
    let validPayments = (histList || []).filter(p => p.type?.toLowerCase() === 'income' || !p.type);
    if (validPayments.length === 0) {
      validPayments = [payment];
    }
    const totalPaidSum = validPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) || Number(payment.amount || 0);
    const finalDebt = Math.max(0, discountedTotal - totalPaidSum);

    const win = window.open('', '_blank');
    if (!win) {
      toast.error('Brauzerda oyna ochilmadi. Iltimos, qalqib chiquvchi oynalarga ruxsat bering.');
      return;
    }

    win.document.write(`
      <!DOCTYPE html>
      <html lang="uz">
      <head>
        <meta charset="utf-8">
        <title>Hisob-faktura - ${patientName}</title>
        <style>
          @page {
            size: A4;
            margin: 12mm 15mm;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            color: #0f172a;
            background: #fff;
            margin: 0;
            padding: 24px;
            max-width: 780px;
            margin: 0 auto;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
          }
          .clinic-brand {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .clinic-logo {
            width: 42px;
            height: 42px;
            color: #0284c7;
          }
          .clinic-title {
            font-size: 22px;
            font-weight: 900;
            color: #0284c7;
            margin: 0;
            line-height: 1.1;
          }
          .clinic-sub {
            font-size: 11px;
            color: #64748b;
            margin: 3px 0 0 0;
            font-weight: 500;
          }
          .clinic-contact {
            font-size: 11px;
            color: #475569;
            margin: 2px 0 0 0;
            font-weight: 600;
          }
          .invoice-meta {
            text-align: right;
          }
          .invoice-title {
            font-size: 16px;
            font-weight: 900;
            color: #0f172a;
            letter-spacing: 0.5px;
            margin: 0;
            text-transform: uppercase;
          }
          .meta-row {
            font-size: 11px;
            color: #64748b;
            margin-top: 3px;
          }
          .meta-num {
            font-family: monospace;
            font-weight: 700;
            color: #0f172a;
          }
          .divider {
            height: 2px;
            background: #0ea5e9;
            margin: 14px 0 20px 0;
          }
          .section-title {
            font-size: 11px;
            font-weight: 900;
            color: #0284c7;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            margin: 0 0 10px 0;
          }
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            border-top: 1px solid #f1f5f9;
            border-bottom: 1px solid #f1f5f9;
            padding: 10px 0;
            margin-bottom: 22px;
            gap: 10px 24px;
          }
          .info-item {
            display: flex;
            flex-direction: column;
          }
          .info-label {
            font-size: 10px;
            color: #94a3b8;
            font-weight: 600;
            margin-bottom: 2px;
          }
          .info-val {
            font-size: 13px;
            font-weight: 800;
            color: #0f172a;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 22px;
            font-size: 12px;
          }
          thead tr {
            background: #f8fafc;
            border-top: 1px solid #e2e8f0;
            border-bottom: 1px solid #e2e8f0;
          }
          th {
            padding: 8px 10px;
            text-align: left;
            font-size: 11px;
            font-weight: 700;
            color: #475569;
          }
          td {
            padding: 9px 10px;
            border-bottom: 1px solid #f1f5f9;
            color: #1e293b;
            font-weight: 500;
          }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .font-bold { font-weight: 700; }
          .font-black { font-weight: 900; }
          .total-expense-row td {
            font-weight: 900;
            border-top: 1.5px solid #cbd5e1;
            border-bottom: none;
            padding-top: 11px;
            font-size: 13px;
          }
          .raw-total-row td {
            font-weight: 700;
            border-top: 1.5px solid #cbd5e1;
            border-bottom: 1px solid #e2e8f0;
            background: #f8fafc;
            font-size: 12px;
            color: #334155;
            padding: 8px 10px;
          }
          .discounted-total-row td {
            font-weight: 900;
            border-top: 1px solid #e2e8f0;
            border-bottom: 1px solid #e2e8f0;
            background: #f1f5f9;
            font-size: 12.5px;
            color: #0f172a;
            padding: 8px 10px;
          }
          .paid-summary-row td {
            background: #dcfce7 !important;
            color: #166534 !important;
            font-weight: 900 !important;
            font-size: 12.5px !important;
            border: none !important;
            padding: 8px 10px !important;
          }
          .debt-summary-row td {
            background: #ffe4e6 !important;
            color: #9f1239 !important;
            font-weight: 900 !important;
            font-size: 12.5px !important;
            border: none !important;
            padding: 8px 10px !important;
          }
          .discount-badge {
            display: inline-block;
            font-size: 10px;
            font-weight: 800;
            color: #047857;
            background: #d1fae5;
            border: 1px solid #a7f3d0;
            padding: 1px 5px;
            border-radius: 4px;
            margin-left: 6px;
          }
          .paid-total-row td {
            background: #dcfce7 !important;
            color: #166534 !important;
            font-weight: 900 !important;
            font-size: 13px !important;
            border: none !important;
            padding: 10px 10px !important;
          }
          .debt-total-row td {
            background: #ffe4e6 !important;
            color: #9f1239 !important;
            font-weight: 900 !important;
            font-size: 13px !important;
            border: none !important;
            padding: 10px 10px !important;
          }
          .signatures {
            display: flex;
            justify-content: space-between;
            margin-top: 40px;
            padding-top: 20px;
          }
          .sig-col {
            width: 42%;
          }
          .sig-line {
            border-bottom: 1px solid #334155;
            margin-bottom: 6px;
          }
          .sig-name {
            font-size: 11px;
            font-weight: 700;
            color: #475569;
          }
          .footer-note {
            text-align: center;
            font-size: 10px;
            color: #94a3b8;
            margin-top: 32px;
            font-weight: 500;
          }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="clinic-brand">
            <svg class="clinic-logo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2C8.7 2 6 4.7 6 8c0 4 3 7 6 10 3-3 6-6 6-10 0-3.3-2.7-6-6-6z" />
            </svg>
            <div>
              <h1 class="clinic-title">${clinicName}</h1>
              <p class="clinic-sub">Professional stomatologiya klinikasi</p>
              <p class="clinic-contact">Tel: +998 71 123 45 67 | Toshkent sh.</p>
            </div>
          </div>
          <div class="invoice-meta">
            <h2 class="invoice-title">HISOB-FAKTURA</h2>
            <div class="meta-row">Sana: ${dateFormatted}</div>
            <div class="meta-row">№ <span class="meta-num">${invoiceNo}</span></div>
          </div>
        </div>

        <div class="divider"></div>

        <div class="section-title">BEMOR MA'LUMOTLARI</div>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">To'liq ismi</span>
            <span class="info-val">${patientName}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Uchrashuv sanasi</span>
            <span class="info-val">${dateTimeFormatted}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Doktor</span>
            <span class="info-val">${doctorName}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Davolash turi</span>
            <span class="info-val">${getTreatmentTypeLabel(payment.service_name || payment.category || 'Davolash rejasi', language)}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Holati</span>
            <span class="info-val" style="color: #16a34a;">To'langan</span>
          </div>
        </div>

        <div class="section-title">DAVOLASHLAR RO'YXATI</div>
        <table>
          <thead>
            <tr>
              <th>Davolash nomi</th>
              <th>Kategoriya</th>
              <th class="text-center">Tish #</th>
              <th class="text-center">Holati</th>
              <th class="text-right">Narxi</th>
            </tr>
          </thead>
          <tbody>
            ${allServices.map(s => `
              <tr>
                <td class="font-bold">${s.name}</td>
                <td>${s.category}</td>
                <td class="text-center">${s.tooth}</td>
                <td class="text-center"><span style="color:#0284c7; font-weight:600;">${s.status}</span></td>
                <td class="text-right font-bold">${Number(s.price || 0).toLocaleString()} so'm</td>
              </tr>
            `).join('')}
            <tr class="raw-total-row">
              <td colspan="4">Davolash rejasining chegirmasiz narxi</td>
              <td class="text-right font-bold">${rawTotal.toLocaleString()} so'm</td>
            </tr>
            <tr class="discounted-total-row">
              <td colspan="4">
                Chegirmali narxi
                ${totalDiscountAmount > 0 ? `<span class="discount-badge">-${totalDiscountAmount.toLocaleString()} so'm</span>` : ''}
              </td>
              <td class="text-right font-black">${discountedTotal.toLocaleString()} so'm</td>
            </tr>
            <tr class="paid-summary-row">
              <td colspan="4">Jami to'langan</td>
              <td class="text-right font-black">${totalPaidSum.toLocaleString()} so'm</td>
            </tr>
            <tr class="${finalDebt > 0 ? 'debt-summary-row' : ''}">
              <td colspan="4" style="font-weight:900; ${finalDebt > 0 ? '' : 'color:#166534; background:#f0fdf4;'}">
                ${finalDebt > 0 ? 'Qoldiq qarzdorlik' : "Qarz yo'q (To'liq to'langan)"}
              </td>
              <td class="text-right font-black" style="${finalDebt > 0 ? '' : 'color:#166534; background:#f0fdf4;'}">
                ${finalDebt.toLocaleString()} so'm
              </td>
            </tr>
          </tbody>
        </table>

        <div class="section-title">TO'LOVLAR</div>
        <table>
          <thead>
            <tr>
              <th>Sana</th>
              <th>To'lov usuli</th>
              <th class="text-center">Holati</th>
              <th class="text-right">Summa</th>
            </tr>
          </thead>
          <tbody>
            ${validPayments.map(p => {
              const pDateRaw = p.created_date || p.created_at || p.date;
              const pDate = pDateRaw ? new Date(pDateRaw).toLocaleDateString('uz-UZ') : dateFormatted;
              return `
                <tr>
                  <td>${pDate}</td>
                  <td class="font-bold">${getPaymentMethodLabel(p.method, t)}</td>
                  <td class="text-center"><span style="color:#16a34a; font-weight:700;">To'langan</span></td>
                  <td class="text-right font-bold">${Number(p.amount || 0).toLocaleString()} so'm</td>
                </tr>
              `;
            }).join('')}
            <tr class="paid-total-row">
              <td colspan="3">To'langan jami</td>
              <td class="text-right font-black">${totalPaidSum.toLocaleString()} so'm</td>
            </tr>
            <tr class="${finalDebt > 0 ? 'debt-total-row' : ''}">
              <td colspan="3" style="font-weight:900; font-size:13px; padding:10px 10px; ${finalDebt > 0 ? '' : 'color:#334155;'}">Jami qarzdorlik</td>
              <td class="text-right font-black" style="font-size:13px; padding:10px 10px; ${finalDebt > 0 ? '' : 'color:#334155;'}">${finalDebt.toLocaleString()} so'm</td>
            </tr>
          </tbody>
        </table>

        <div class="signatures">
          <div class="sig-col">
            <div class="sig-line"></div>
            <div class="sig-name">Bemor imzosi: ${patientName}</div>
          </div>
          <div class="sig-col">
            <div class="sig-line"></div>
            <div class="sig-name">Doktor imzosi: ${doctorName}</div>
          </div>
        </div>

        <div class="footer-note">
          Hujjat ${dateFormatted} sanasida ${clinicName} tizimi tomonidan yaratildi | Ushbu hujjat rasmiy hisoblanadi
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 250);
          }
        </script>
      </body>
      </html>
    `);
    win.document.close();
  };

  // Bemor tanlanganida uning xizmatlarini avtomatik yuklash
  useEffect(() => {
    if (form.patient_id) {
      // Xizmatlarni yuklash (to'lanmagan rejalardan)
      const fetchServices = async () => {
        try {
          const plans = await base44.entities.TreatmentPlan.filter({ patient_id: form.patient_id }, '-created_date', 50);
          setPatientPlans((plans || []).filter(p => (p.paid_amount || 0) < p.total_price));
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

          // Shifokorni avtomatik biriktirish (agar tanlanmagan bo'lsa yoki noto'g'ri bo'lsa)
          const currentPat = patients.find(p => p.id === form.patient_id);
          const autoDocId = resolveDoctorId(currentPat, plans, doctors, user, isDoctor);
          if (autoDocId) {
            setForm(prev => {
              const currentIsValid = prev.doctor_id && doctors.some(d => String(d.id) === String(prev.doctor_id));
              if (!prev.doctor_id || !currentIsValid) {
                return { ...prev, doctor_id: autoDocId };
              }
              return prev;
            });
          }
        } catch (e) {
          console.error('Error fetching patient services:', e);
          setPatientServices([]);
        }
      };
      fetchServices();

      // Bemor uchun REAL qarzni DB dan qayta hisoblash (PatientProfile bilan bir xil formula)
      const fetchRealDebt = async () => {
        setLoadingDebt(true);
        setRealPatientDebt(null);
        try {
          const [allPays, allPlans] = await Promise.all([
            base44.entities.Payment.filter({ patient_id: form.patient_id }, 'date', 5000),
            base44.entities.TreatmentPlan.filter({ patient_id: form.patient_id }, '-created_date', 100)
          ]);
          const totalIncomes = (allPays || []).filter(p => p.type?.toLowerCase() === 'income').reduce((s, p) => s + (Number(p.amount) || 0), 0);
          const totalDiscounts = (allPays || []).filter(p => p.type?.toLowerCase() === 'discount').reduce((s, p) => s + Math.abs(Number(p.amount) || 0), 0);
          const totalRefunds = (allPays || []).filter(p => p.type?.toLowerCase() === 'refund').reduce((s, p) => s + (Number(p.amount) || 0), 0);
          const totalPlansPrice = (allPlans || []).reduce((sum, plan) => sum + (Number(plan.total_price) || 0), 0);

          // Agar rejalar bo'lsa: qarz = rejaJami (chegirmasi chegirilgan) - to'langan
          // Agar reja yo'q bo'lsa: qarz = 0 (faqat debt-type to'lovlarga qaraladi)
          let realDebt = 0;
          if (totalPlansPrice > 0) {
            const netBalance = totalIncomes - totalPlansPrice;
            realDebt = netBalance < 0 ? Math.abs(netBalance) : 0;
          } else {
            const totalDebts = (allPays || []).filter(p => p.type?.toLowerCase() === 'debt').reduce((s, p) => s + (Number(p.amount) || 0), 0);
            realDebt = Math.max(0, (totalDebts + totalRefunds) - (totalIncomes + totalDiscounts));
          }

          setRealPatientDebt(realDebt);

          const pat = patients.find(p => p.id === form.patient_id);
          if (pat && Number(pat.total_debt) !== realDebt) {
            base44.entities.Patient.update(form.patient_id, { total_debt: realDebt, total_paid: totalIncomes }).catch(() => {});
            setPatients(prev => prev.map(pt => pt.id === form.patient_id ? { ...pt, total_debt: realDebt, total_paid: totalIncomes } : pt));
          }
        } catch (e) {
          const pat = patients.find(p => p.id === form.patient_id);
          setRealPatientDebt(Number(pat?.total_debt) || 0);
        } finally {
          setLoadingDebt(false);
        }
      };
      fetchRealDebt();
    } else {
      setPatientServices([]);
      setSelectedServiceId('');
      setRealPatientDebt(null);
    }
  }, [form.patient_id]);

  return (
    <div className="space-y-3 pb-4 h-full">
      {/* Premium Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            <div className="w-10 h-10 bg-gradient-to-br from-[#1499AD] to-[#0E7A8A] rounded-xl flex items-center justify-center shadow-lg shadow-[#1499AD]/20 text-white">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black text-slate-900 tracking-tight">{t('payments.title')}</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-black text-[#1499AD] uppercase tracking-[0.1em]">
                        {t('common.finance')}
                    </span>
                </div>
                <span className="w-1 h-1 rounded-full bg-slate-200" />
                <span className="text-[10px] font-bold text-slate-500">
                  {stats.totalCount} {t('common.total')}
                </span>
              </div>
            </div>
          </motion.div>
        </div>
        
        <div className="flex items-center gap-2">

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[11px] font-black uppercase tracking-wider shadow-md transition-all border-none"
          >
            <Plus className="w-4 h-4 text-[#1499AD]" />
            {t('payments.addNew')}
          </motion.button>
        </div>
      </div>

      {/* Analytics Mini Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {[
          { label: t('payments.totalIncome'), value: formatCurrency(stats.totalRevenue), color: 'from-[#1499AD] to-[#0E7A8A]', icon: TrendingUp, detail: t('payments.totalRevenueDetail') || 'Umumiy tushum' },
          { label: t('payments.thisMonth'), value: formatCurrency(stats.monthRevenue), color: 'from-emerald-500 to-teal-600', icon: Calendar, detail: t('payments.thisMonthDetail') || 'Joriy oy' },
          { label: t('payments.todayIncome'), value: formatCurrency(stats.todayRevenue), color: 'from-blue-600 to-indigo-700', icon: Clock, detail: t('payments.todayDetail') || 'Bugun' }
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white rounded-xl p-3 border border-slate-200/80 shadow-xs flex items-center gap-3 relative overflow-hidden group"
          >
            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center text-white shadow-sm shrink-0`}>
              <stat.icon className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">{stat.label}</span>
                <span className="text-[8px] font-bold text-slate-300 uppercase">{stat.detail}</span>
              </div>
              <div className="text-base font-extrabold text-slate-900 tracking-tight truncate mt-0.5">
                {stat.value}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ─── Excel Spreadsheet Controls Bar ────────────────────────── */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          
          {/* Search Box */}
          <div className="relative flex-1 group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#1499AD] transition-colors" />
            <input 
              type="text" 
              placeholder="Bemor ismi, telefon, xizmat yoki shifokor bo'yicha qidiruv..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-8 bg-slate-50 hover:bg-white focus:bg-white rounded-xl border border-slate-200 focus:border-[#1499AD] font-semibold text-slate-800 text-xs focus:ring-2 focus:ring-[#1499AD]/10 transition-all outline-none"
            />
            {search && (
              <button 
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Filter Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
            {(() => {
              const today = new Date().toISOString().split('T')[0];
              const thisMonth = today.slice(0, 7);
              return [
                { id: 'all', label: "Barchasi", count: displayPayments.length },
                { id: 'today', label: "Bugun", count: displayPayments.filter(p => (p.date || p.created_date || p.created_at || '').slice(0, 10) === today).length },
                { id: 'thisMonth', label: "Shu oy", count: displayPayments.filter(p => (p.date || p.created_date || p.created_at || '').slice(0, 7) === thisMonth).length },
                { id: 'hasDebt', label: "Qarzdorlar to'lovi", badgeColor: 'bg-rose-500 text-white' },
                { id: 'cash', label: "Naqd pul" },
                { id: 'card', label: "Karta" }
              ];
            })().map((tab) => {
              const isActive = activeFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveFilter(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                    isActive 
                      ? 'bg-slate-900 text-white shadow-xs' 
                      : 'bg-slate-100/70 text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-black ${
                      isActive 
                        ? (tab.badgeColor || 'bg-white/20 text-white') 
                        : (tab.badgeColor || 'bg-slate-200 text-slate-600')
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

        </div>
      </div>

      {/* Main Data View - Excel Spreadsheet Table */}
      {!isMobile ? (
        <>
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden relative"
        >
          {loading && (
            <div className="absolute inset-x-0 top-0 h-0.5 bg-slate-100 overflow-hidden z-20">
              <motion.div 
                className="h-full bg-gradient-to-r from-[#1499AD] to-[#0E7A8A]"
                animate={{ x: ['-100%', '100%'] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              />
            </div>
          )}
          
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left select-text">
              {/* ─── Excel Table Header ────────────────── */}
              <thead>
                <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-600 text-[10.5px] font-black uppercase tracking-wider sticky top-0 z-10 backdrop-blur-xs">
                  
                  {/* № Col */}
                  <th 
                    onClick={() => handleSort('date')}
                    className="w-12 px-2.5 py-2.5 text-center border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors select-none"
                    title="Tartib raqami"
                  >
                    <div className="flex items-center justify-center gap-1 font-mono">
                      <span>№</span>
                      {sortField === 'date' && (
                        sortOrder === 'asc' ? <ArrowUp className="w-2.5 h-2.5 text-[#1499AD]" /> : <ArrowDown className="w-2.5 h-2.5 text-[#1499AD]" />
                      )}
                    </div>
                  </th>

                  {/* Patient Name */}
                  <th 
                    onClick={() => handleSort('patient_name')}
                    className="px-3.5 py-2.5 border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors select-none"
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span>{t('patients.fullName') || "Bemor (F.I.Sh)"}</span>
                      {sortField === 'patient_name' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#1499AD]" /> : <ArrowDown className="w-3 h-3 text-[#1499AD]" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-30" />
                      )}
                    </div>
                  </th>

                  {/* Phone (Single line guaranteed) */}
                  <th className="w-44 px-3 py-2.5 border-r border-slate-200 select-none whitespace-nowrap">
                    <span>{t('common.phone') || "Telefon"}</span>
                  </th>

                  {/* Payment Amount */}
                  <th 
                    onClick={() => handleSort('amount')}
                    className="w-36 px-3 py-2.5 text-right border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors bg-emerald-50/40 select-none whitespace-nowrap"
                  >
                    <div className="flex items-center justify-end gap-1.5 text-emerald-700">
                      <span>{t('payments.amount') || "To'lov Summasi"}</span>
                      {sortField === 'amount' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-40" />
                      )}
                    </div>
                  </th>

                  {/* Remaining Debt */}
                  <th 
                    onClick={() => handleSort('debt')}
                    className="w-32 px-3 py-2.5 text-right border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors bg-rose-50/40 select-none whitespace-nowrap"
                  >
                    <div className="flex items-center justify-end gap-1.5 text-rose-600">
                      <span>{t('common.debt') || "Qarz"}</span>
                      {sortField === 'debt' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-40" />
                      )}
                    </div>
                  </th>

                  {/* Doctor */}
                  <th 
                    onClick={() => handleSort('doctor')}
                    className="w-36 px-3 py-2.5 border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors select-none whitespace-nowrap"
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span>{t('payments.doctor') || "Shifokor"}</span>
                      {sortField === 'doctor' && (
                        sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#1499AD]" /> : <ArrowDown className="w-3 h-3 text-[#1499AD]" />
                      )}
                    </div>
                  </th>

                  {/* Date & Time */}
                  <th 
                    onClick={() => handleSort('date')}
                    className="w-32 px-2.5 py-2.5 text-center border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors select-none whitespace-nowrap"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>{t('appointments.date') || "Sana / Vaqt"}</span>
                      {sortField === 'date' && (
                        sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#1499AD]" /> : <ArrowDown className="w-3 h-3 text-[#1499AD]" />
                      )}
                    </div>
                  </th>

                  {/* Actions */}
                  <th className="w-16 px-2 py-2.5 text-center text-slate-500 whitespace-nowrap select-none">
                    {t('common.actions') || "Amallar"}
                  </th>

                </tr>
              </thead>

              {/* ─── Excel Table Body ────────────────── */}
              <tbody className="divide-y divide-slate-200/70 text-xs">
                {sortedDisplayPayments.length > 0 ? (
                  sortedDisplayPayments.map((p, idx) => {
                    const pat = patients.find(pt => pt.id === p.patient_id);
                    const isInstallment = !!(p.notes && p.notes.toLowerCase().includes('reja')) || !!p.plan_id;
                    const debtVal = (patientBalances[p.id]?.debtAtTime !== undefined)
                      ? patientBalances[p.id].debtAtTime
                      : (p.debt_amount !== undefined && p.debt_amount !== null ? Number(p.debt_amount) : (Number(pat?.total_debt) || 0));
                    const isCompact = density === 'compact';
                    const dtRaw = p.created_date || p.created_at || p.date;
                    const dt = dtRaw ? new Date(dtRaw) : null;
                    const hasValidDate = dt && !isNaN(dt);

                    return (
                      <tr 
                        key={p.id} 
                        className={`group hover:bg-[#1499AD]/10 hover:shadow-xs transition-colors cursor-pointer ${
                          idx % 2 === 1 ? 'bg-slate-50/30' : 'bg-white'
                        }`}
                        onClick={() => openPaymentDetail(p)}
                      >
                        {/* № Cell */}
                        <td className={`text-center font-mono font-bold text-slate-400 border-r border-slate-200/70 whitespace-nowrap ${isCompact ? 'py-2 px-2' : 'py-3 px-2.5'}`}>
                          {idx + 1}
                        </td>

                        {/* Patient Name Cell */}
                        <td className={`border-r border-slate-200/70 ${isCompact ? 'py-1.5 px-3' : 'py-2.5 px-3.5'}`}>
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 font-black text-[11px] shrink-0 border border-slate-200 overflow-hidden group-hover:bg-[#1499AD] group-hover:text-white transition-colors">
                              {p.patient_name?.[0] || 'B'}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span 
                                  onClick={(e) => {
                                    if (p.patient_id) {
                                      e.stopPropagation();
                                      navigate(`/patients/${p.patient_id}`);
                                    }
                                  }}
                                  className="font-extrabold text-slate-900 group-hover:text-[#1499AD] transition-colors truncate block hover:underline"
                                >
                                  {p.patient_name || 'Noma\'lum bemor'}
                                </span>
                                {isInstallment && (
                                  <span className="px-1.5 py-0.2 rounded text-[8.5px] font-black text-blue-600 bg-blue-50 border border-blue-100 shrink-0">
                                    Muddatli
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Phone Cell (Single line guaranteed) */}
                        <td className={`border-r border-slate-200/70 whitespace-nowrap ${isCompact ? 'py-1.5 px-2.5' : 'py-2.5 px-3'}`}>
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="font-bold text-slate-800 font-mono text-[12px] tabular-nums whitespace-nowrap select-all tracking-tight">
                              {formatPhoneSingleLine(pat?.phone)}
                            </span>
                            {pat?.phone && (
                              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                <button
                                  onClick={(e) => handleCopyPhone(e, pat.phone, p.id)}
                                  className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-200/70 rounded transition-all"
                                  title="Raqamni nusxalash"
                                >
                                  {copiedPhoneId === p.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                                </button>
                                <a
                                  href={`tel:${pat.phone}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-all"
                                  title="Qo'ng'iroq qilish"
                                >
                                  <Phone className="w-3 h-3" />
                                </a>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Payment Amount Cell */}
                        <td className={`text-right border-r border-slate-200/70 whitespace-nowrap ${isCompact ? 'py-1.5 px-2.5' : 'py-2.5 px-3'}`}>
                          <div className="flex items-center justify-end gap-1.5">
                            <span className="font-mono font-black text-emerald-600 text-xs tabular-nums">
                              {Number(p.amount || 0).toLocaleString()}
                              <span className="text-[9.5px] font-semibold text-emerald-400 ml-1">UZS</span>
                            </span>
                            {(p.receipt_url || p.receipt_image || p.check_image) && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreviewReceiptUrl(p.receipt_url || p.receipt_image || p.check_image);
                                }}
                                className="px-1.5 py-0.2 rounded text-[8.5px] font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 flex items-center gap-0.5 transition-all"
                                title="Chek rasmini ko'rish"
                              >
                                <Receipt className="w-2.5 h-2.5" /> Chek
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Remaining Debt Cell */}
                        <td className={`text-right border-r border-slate-200/70 whitespace-nowrap ${isCompact ? 'py-1.5 px-2.5' : 'py-2.5 px-3'}`}>
                          <span className={`font-mono font-bold text-xs tabular-nums ${debtVal > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                            {debtVal > 0 ? (
                              <>
                                {debtVal.toLocaleString()}
                                <span className="text-[9.5px] font-normal text-slate-400 ml-1">UZS</span>
                              </>
                            ) : (
                              <span className="text-emerald-600 font-semibold text-[11px]">✓ To'liq</span>
                            )}
                          </span>
                        </td>

                        {/* Doctor Cell */}
                        <td className={`border-r border-slate-200/70 whitespace-nowrap ${isCompact ? 'py-1.5 px-2.5' : 'py-2.5 px-3'}`}>
                          {p.doctor_id ? (
                            <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded-full bg-blue-500 shadow-xs" />
                              <span className="text-slate-700 font-bold text-xs whitespace-nowrap truncate max-w-[130px]">
                                {doctors.find(d => d.id === p.doctor_id)?.name || 'Shifokor'}
                              </span>
                            </div>
                          ) : (
                            <button 
                              onClick={(e) => { e.stopPropagation(); setEditPayment(p); }}
                              className="flex items-center gap-1 text-slate-400 hover:text-[#1499AD] text-[11px] font-bold transition-colors"
                              title="Shifokor biriktirish"
                            >
                              <PlusCircle className="w-3.5 h-3.5" />
                              <span>Biriktirish</span>
                            </button>
                          )}
                        </td>

                        {/* Date & Time Cell (Single line) */}
                        <td className={`text-center font-mono text-[11px] text-slate-600 font-medium border-r border-slate-200/70 whitespace-nowrap ${isCompact ? 'py-1.5 px-2' : 'py-2.5 px-2.5'}`}>
                          {hasValidDate ? (
                            <span>{format(dt, 'dd.MM.yyyy HH:mm')}</span>
                          ) : (
                            <span>{p.date || '—'}</span>
                          )}
                        </td>

                        {/* Actions Cell */}
                        <td className={`text-center whitespace-nowrap ${isCompact ? 'py-1 px-1.5' : 'py-2 px-2'}`}>
                          <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <button 
                              onClick={() => openPaymentDetail(p)}
                              className="p-1 rounded-lg text-slate-400 hover:text-[#1499AD] hover:bg-[#1499AD]/10 transition-all"
                              title="To'lov tafsiloti"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => handleDelete(p.id, p.patient_id)}
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all"
                              title="To'lovni o'chirish"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>

                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300">
                          <Receipt className="w-6 h-6" />
                        </div>
                        <p className="text-sm font-bold text-slate-500">
                          {debouncedSearch ? `"${debouncedSearch}" bo'yicha to'lov topilmadi` : "To'lovlar ro'yxati bo'sh"}
                        </p>
                        {(search || activeFilter !== 'all') && (
                          <button
                            onClick={() => { setSearch(''); setActiveFilter('all'); }}
                            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
                          >
                            Filtrlarni tozalash
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>

        {hasMore && (
          <div className="flex justify-center mt-4 pb-4">
            <Button 
              onClick={() => setPage(p => p + 1)}
              disabled={loadingMore}
              className="h-9 px-6 rounded-xl bg-white border border-slate-200 text-slate-600 font-bold text-xs hover:border-[#1499AD] transition-all"
            >
              {loadingMore ? 'Yuklanmoqda...' : 'Ko\'proq yuklash'}
            </Button>
          </div>
        )}
      </>
      ) : (
        /* Mobile View */
        <div className="space-y-3 pb-24">
          {displayPayments.map((p, idx) => {
            const pat = patients.find(pt => pt.id === p.patient_id);
            const isInstallment = !!(p.notes && p.notes.toLowerCase().includes('reja')) || !!p.plan_id;
            const debtVal = (patientBalances[p.id]?.debtAtTime !== undefined)
              ? patientBalances[p.id].debtAtTime
              : (p.debt_amount !== undefined && p.debt_amount !== null ? Number(p.debt_amount) : (Number(pat?.total_debt) || 0));
            return (
            <motion.div 
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(idx, 6) * 0.02 }}
              key={p.id} 
              className="premium-card p-4 border-none shadow-md shadow-slate-200/40 relative overflow-hidden active:scale-[0.99] transition-all cursor-pointer hover:bg-slate-50/50 content-visibility-auto"
              onClick={() => openPaymentDetail(p)}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl premium-bg-gradient flex items-center justify-center text-white font-black text-sm shadow-md">
                    {p.patient_name?.[0] || 'T'}
                  </div>
                  <div>
                    <h3 className="font-[900] text-slate-900 uppercase tracking-tight text-[12px] leading-none">{p.patient_name}</h3>
                    <div className="flex flex-col gap-0.5 mt-1">
                      {pat?.phone && (
                        <span className="text-[9px] font-bold text-slate-500 flex items-center gap-0.5">
                          <Phone className="w-2.5 h-2.5" /> {formatPhone(pat.phone)}
                        </span>
                      )}
                    {(() => {
                      const dtRaw = p.created_date || p.created_at || p.date;
                      const dt = dtRaw ? new Date(dtRaw) : null;
                      const hasValid = dt && !isNaN(dt);
                      return (
                        <>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                            {hasValid ? format(dt, 'dd.MM.yyyy') : (p.date ? format(new Date(p.date), 'dd.MM.yyyy') : '—')}
                          </p>
                          {hasValid && (
                            <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mt-0.5">
                              {format(dt, 'HH:mm')}
                            </p>
                          )}
                        </>
                      );
                    })()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {(() => {
                    const totalToPay = Number(p.amount || 0);
                    return (
                      <div className="px-2.5 py-1 rounded-lg bg-[#1499AD]/5 border border-[#1499AD]/10">
                        <span className="text-[13px] font-[900] text-[#1499AD]">
                          {totalToPay.toLocaleString()}
                        </span>
                        <span className="text-[8px] font-black ml-0.5 text-[#1499AD]/60 uppercase">UZS</span>
                      </div>
                    );
                  })()}
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDelete(p.id, p.patient_id); }}
                    className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center text-slate-300 active:text-rose-500 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-2 bg-slate-50/80 rounded-xl p-3 border border-white/60">
                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-wide mb-0.5">Xizmat</p>
                  <p className="text-[10px] font-black text-slate-700 uppercase truncate">{p.service_name || '—'}</p>
                  {isInstallment && (
                    <span className="inline-flex items-center gap-0.5 text-[8px] font-black text-blue-600 bg-blue-50 px-1 py-0.5 rounded mt-0.5">
                      Muddatli to'lov
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-[8px] font-black text-emerald-400 uppercase tracking-wide mb-0.5">Toʻlagan</p>
                  <p className="text-[10px] font-black text-emerald-600">
                    {Number(p.amount || 0).toLocaleString()} <span className="text-[8px] font-bold text-emerald-400">UZS</span>
                  </p>
                </div>
                <div>
                  <p className="text-[8px] font-black text-rose-400 uppercase tracking-wide mb-0.5">Qarz</p>
                  <p className={`text-[10px] font-black ${debtVal > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                    {debtVal > 0 ? debtVal.toLocaleString() : '✓ To\'liq'}
                  </p>
                </div>
              </div>
            </motion.div>
          )})}
          {filteredPayments.length === 0 && <EmptyState icon={Wallet} title={t('payments.noPayments')} />}
          
          {hasMore && (
            <div className="flex justify-center mt-4 pb-6">
              <Button 
                onClick={() => setPage(p => p + 1)}
                disabled={loadingMore}
                className="h-9 px-8 rounded-xl bg-white border-2 border-slate-100 text-slate-500 font-bold uppercase text-[9px] tracking-widest hover:border-[#1499AD] transition-all"
              >
                {loadingMore ? 'Yuklanmoqda...' : 'Yana yuklash'}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Enhanced Multi-step Payment Modal */}
      <Dialog open={modalOpen} onOpenChange={(open) => !open && resetModal()}>
        <DialogContent className="max-w-xl p-0 overflow-hidden rounded-[2rem] border-none shadow-3xl">
          <div className="premium-bg-gradient px-8 py-5 text-white relative">
            <h2 className="text-xl font-[900] tracking-tighter uppercase mb-0.5">{t('payments.addNew')}</h2>
            <p className="text-[10px] font-black text-white/50 tracking-[0.3em] uppercase">{t('payments.receiveAmount') || "Mablag' qabul qilish"}</p>
          </div>

          <div className="p-5 bg-white max-h-[65vh] overflow-y-auto no-scrollbar">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                   <div className="space-y-1.5 relative z-50">
                     <div className="flex items-center justify-between ml-4">
                        <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('patients.title')}</Label>
                        <button 
                          onClick={() => setNewPatientOpen(true)}
                          className="text-[9px] font-black text-[#1499AD] uppercase tracking-widest hover:underline"
                        >
                          + {t('patients.addNew')}
                        </button>
                     </div>
                     <PatientSelect 
                       patients={patients}
                       value={form.patient_id} 
                       initialName={form.patient_name}
                       onChange={(id, pat) => {
                          if (!id) {
                            setForm(prev => ({ 
                              ...prev, 
                              patient_id: '', 
                              patient_name: '', 
                              doctor_id: isDoctor ? user?.id : '' 
                            }));
                            setPatientServices([]);
                            setSelectedServiceId('');
                            setPatientPlans([]);
                            setRealPatientDebt(null);
                            return;
                          }
                          const selectedPat = pat || patients.find(p => p.id === id);
                          const plansForPat = (allTreatmentPlans || []).filter(p => p.patient_id === id);
                          const assignedDocId = resolveDoctorId(selectedPat, plansForPat, doctors, user, isDoctor);
                          setForm(prev => ({ 
                            ...prev, 
                            patient_id: id, 
                            patient_name: selectedPat?.full_name || '',
                            doctor_id: assignedDocId || prev.doctor_id || ''
                          }));
                       }} 
                       inputClassName="h-11 rounded-xl border-none bg-slate-50 px-5 font-black text-slate-900 text-sm"
                     />
                   </div>

                   {/* Davolash rejalari va hisob-faktura ko'rish */}
                   {patientPlans && patientPlans.length > 0 && (
                      <div className="space-y-1.5 pt-2.5 border-t border-slate-100/85 relative z-20">
                        <div className="flex items-center justify-between ml-1">
                          <Label className="text-[9px] font-black text-[#1499AD] uppercase tracking-widest flex items-center gap-1.5">
                            <Receipt className="w-3 h-3" /> {t('patientProfile.tabs.treatments') || 'Davolash rejalari'}
                          </Label>
                          {patientPlans.length > 2 && (
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                              ({patientPlans.length} ta)
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col gap-1.5 max-h-[110px] overflow-y-auto pr-1">
                          {patientPlans.map(plan => {
                            const paid = Number(plan.paid_amount) || 0;
                            const total = Number(plan.total_price) || 0;
                            const remaining = Math.max(0, total - paid);
                            return (
                              <div 
                                key={plan.id} 
                                onClick={() => {
                                  const planDocId = resolveDoctorId(null, [plan], doctors, user, isDoctor);
                                  setForm(prev => ({
                                    ...prev,
                                    amount: remaining > 0 ? remaining : prev.amount,
                                    service_name: `Reja: ${plan.name}`,
                                    doctor_id: planDocId || prev.doctor_id || ''
                                  }));
                                  toast.info(`${plan.name} tanlandi (${remaining.toLocaleString()} UZS)`);
                                }}
                                className="flex items-center justify-between bg-slate-50/70 hover:bg-emerald-50/60 hover:border-emerald-200 cursor-pointer rounded-lg px-2.5 py-1.5 border border-slate-100 transition-all duration-200 group"
                                title="Ushbu reja summasini to'lovga kiritish"
                              >
                                <div className="flex-1 min-w-0 mr-2">
                                  <p className="text-[11px] font-black text-slate-800 group-hover:text-emerald-700 truncate leading-snug">{plan.name || (t ? t('patientProfile.treatmentPlanSingular') : 'Davolash rejasi')}</p>
                                  <p className="text-[10px] text-slate-500 font-medium leading-none mt-0.5">
                                    Muolaja narhi to'liq:&nbsp;
                                    <span className="text-slate-700 font-black">{total.toLocaleString()} {t('common.currency') || "so'm"}</span>
                                  </p>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className="text-[8px] font-black uppercase text-emerald-600 bg-emerald-100/60 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                    Tanlash
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setSelectedPlanForInvoice(plan); setShowPlanInvoiceModal(true); }}
                                    className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-md bg-blue-50 border border-blue-100 text-blue-600 text-[9px] font-black uppercase tracking-wide hover:bg-blue-100 active:scale-95 transition-all"
                                  >
                                    <FileText className="w-2.5 h-2.5" />
                                    {t('common.invoice') || 'Faktura'}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="space-y-1.5 pt-2.5 border-t border-slate-100/85 relative z-10">
                       <div className="grid grid-cols-2 gap-3">
                         <div className="space-y-1.5">
                           <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-4">{t('payments.doctor') || "Shifokor"}</Label>
                           <Select 
                             value={form.doctor_id ? String(form.doctor_id) : ''} 
                             onValueChange={val => setForm(prev => ({ ...prev, doctor_id: val }))}
                             disabled={isDoctor}
                           >
                             <SelectTrigger className="h-11 rounded-xl border-none bg-slate-50 px-4 font-black text-slate-900 text-sm focus:ring-0">
                               <SelectValue placeholder={t('payments.doctor') || "Shifokor"} />
                             </SelectTrigger>
                             <SelectContent className="rounded-xl border-none shadow-2xl p-1">
                               {doctors.map(d => (
                                 <SelectItem key={d.id} value={String(d.id)} className="rounded-xl py-2 font-black text-xs uppercase tracking-widest">
                                   {d.name || d.full_name}
                                 </SelectItem>
                               ))}
                               {form.doctor_id && !doctors.some(d => String(d.id) === String(form.doctor_id)) && (
                                 <SelectItem value={String(form.doctor_id)} className="rounded-xl py-2 font-black text-xs uppercase tracking-widest">
                                   {doctors.find(d => (d.name || d.full_name) === form.doctor_id)?.name || form.doctor_id}
                                 </SelectItem>
                               )}
                             </SelectContent>
                           </Select>
                         </div>

                         <div className="space-y-1.5">
                           <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-4">{t('payments.method') || "To'lov usuli"}</Label>
                           <Select 
                             value={form.method || 'Cash'} 
                             onValueChange={val => setForm({ ...form, method: val })}
                           >
                             <SelectTrigger className="h-11 rounded-xl border-none bg-slate-50 px-4 font-black text-slate-900 text-sm focus:ring-0">
                               <SelectValue placeholder={t('payments.method') || "Usuli"} />
                             </SelectTrigger>
                             <SelectContent className="rounded-xl border-none shadow-2xl">
                               <SelectItem value="Cash" className="font-bold py-2">{t('payments.methods.Cash') || "Naqd pul"}</SelectItem>
                               <SelectItem value="Card" className="font-bold py-2">{t('payments.methods.Card') || "Plastik karta"}</SelectItem>
                               <SelectItem value="Click" className="font-bold py-2">Click</SelectItem>
                               <SelectItem value="Payme" className="font-bold py-2">Payme</SelectItem>
                               <SelectItem value="Transfer" className="font-bold py-2">{t('payments.methods.Transfer') || "Bank/O'tkazma"}</SelectItem>
                             </SelectContent>
                           </Select>
                         </div>
                       </div>
                    </div>

                    <div className="space-y-1.5 pt-2.5 border-t border-slate-100/85">
                      <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-4">{t('common.date') || "Sana"}</Label>
                      <input 
                        type="datetime-local" 
                        value={form.created_at} 
                        onChange={e => setForm({ ...form, created_at: e.target.value })}
                        className="w-full h-11 rounded-xl border-none bg-slate-50 px-4 font-black text-slate-900 text-sm focus:ring-0 outline-none"
                      />
                    </div>
                </div>

                <div className="space-y-3">
                   <div className="space-y-1.5">
                     <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-4">{t('payments.amount')}</Label>
                     <div className="relative">
                       <input 
                         type="text"
                         inputMode="numeric"
                         value={form.amount === '' || form.amount === 0 ? '' : Number(form.amount).toLocaleString('uz-UZ')}
                         onChange={e => {
                           // Faqat raqamlarni qabul qilamiz, ajratgichlarni olib tashlaymiz
                           const raw = e.target.value.replace(/\s/g, '').replace(/,/g, '').replace(/\./g, '').replace(/'/g, '');
                           if (raw === '' || raw === '0') {
                             setForm({ ...form, amount: '' });
                           } else if (/^\d+$/.test(raw)) {
                             setForm({ ...form, amount: Number(raw) });
                           }
                         }}
                         onKeyDown={e => {
                           // Yuqori/pastga strelka va scroll orqali qiymat o'zgarishini bloklash
                           if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                             e.preventDefault();
                           }
                         }}
                         onWheel={e => e.target.blur()} // Scroll bilan o'zgarishni bloklash
                         className="w-full h-14 rounded-xl border-none bg-slate-50 px-5 pr-16 font-[900] text-2xl text-emerald-600 placeholder:text-slate-300 focus:ring-0 outline-none text-center tracking-wider"
                         placeholder="Summa"
                       />
                       <span className="absolute right-5 top-1/2 -translate-y-1/2 font-black text-slate-300 text-sm uppercase">UZS</span>
                     </div>
                     {form.patient_id && (() => {
                        const debt = realPatientDebt !== null ? realPatientDebt : (Number(patients.find(p => p.id === form.patient_id)?.total_debt) || 0);
                        const isIncomeType = (form.type || 'Income').toLowerCase() === 'income';
                        const noDebtWarning = !loadingDebt && debt === 0 && isIncomeType;
                        return (
                          <div className="mt-1 space-y-1.5">
                            <div className="flex items-center justify-between px-2">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Bemor qarzi:</span>
                              {loadingDebt ? (
                                <span className="text-[9px] font-black text-slate-300 uppercase">Hisoblanmoqda...</span>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs font-black ${debt > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                    {debt > 0 ? `${debt.toLocaleString()} UZS` : '✓ Qarz yo\'q'}
                                  </span>
                                  {debt > 0 && Number(form.amount) !== debt && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setForm(prev => ({ ...prev, amount: debt }));
                                        toast.success(
                                          language === 'ru' 
                                            ? `Сумма долга (${debt.toLocaleString()} UZS) введена` 
                                            : language === 'en' 
                                            ? `Debt amount (${debt.toLocaleString()} UZS) entered` 
                                            : `Qarz summasi (${debt.toLocaleString()} UZS) kiritildi`
                                        );
                                      }}
                                      className="text-[9px] font-black text-emerald-700 bg-emerald-100 hover:bg-emerald-200 px-2.5 py-1 rounded-md border border-emerald-300 transition-colors uppercase tracking-wider cursor-pointer active:scale-95 shadow-xs"
                                    >
                                      {language === 'ru' ? 'Ввести сумму долга' : language === 'en' ? 'Fill debt amount' : 'Qarz summasini kiritish'}
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                            {/* Ogohlantirish — qarz yo'q bemorga Income to'lov */}
                            {noDebtWarning && (
                              <div className="mx-2 flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl">
                                <span className="text-amber-500 text-sm mt-0.5">⚠️</span>
                                <div>
                                  <p className="text-[10px] font-black text-amber-700 uppercase tracking-wider">Diqqat!</p>
                                  <p className="text-[10px] font-bold text-amber-600">Bu bemorning qarzi yo'q. Kirim to'lov qilish mumkin emas.</p>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                   </div>

                    {/* Agar Karta, Click yoki Payme tanlansa — Chek yuklash joyi chiqadi */}
                    {['Card', 'Click', 'Payme', 'Transfer'].includes(form.method) ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-4 flex items-center gap-1.5">
                            <Receipt className="w-3 h-3 text-emerald-600" />
                            Chek / Kvitansiya rasmi (ixtiyoriy)
                          </Label>
                          {form.receipt_url && (
                            <button
                              type="button"
                              onClick={() => setForm({ ...form, receipt_url: '' })}
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
                              setForm(prev => ({ ...prev, receipt_url: compressed }));
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

                        {form.receipt_url ? (
                          <div className="relative rounded-2xl border border-emerald-200 bg-emerald-50/50 p-2.5 flex items-center gap-3">
                            <div 
                              onClick={() => setPreviewReceiptUrl(form.receipt_url)}
                              className="w-14 h-14 rounded-xl overflow-hidden bg-slate-200 cursor-pointer shrink-0 border border-emerald-300 relative group"
                            >
                              <img src={form.receipt_url} alt="Chek" className="w-full h-full object-cover" />
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
                              Fayldan tanlash yoki rasm yuklash (ixtiyoriy)
                            </span>
                          </button>
                        )}

                        {/* Qo'shimcha ixtiyoriy izoh */}
                        <div className="pt-1">
                          <input
                            placeholder="Qo'shimcha izoh (ixtiyoriy)..."
                            value={form.notes}
                            onChange={(e) => setForm({...form, notes: e.target.value})}
                            className="w-full h-10 rounded-xl border-none bg-slate-50 px-4 font-bold text-slate-900 text-xs focus:ring-0 outline-none"
                          />
                        </div>
                      </div>
                    ) : (
                      /* Notes (Naqd uchun) */
                      <div className="space-y-1.5">
                        <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-4">{t('payments.notes')}</Label>
                        <Textarea 
                          value={form.notes} 
                          onChange={e => setForm({ ...form, notes: e.target.value })} 
                          rows={2}
                          className="rounded-2xl border-none bg-slate-50 p-4 font-bold text-slate-900 text-sm placeholder:text-slate-300 resize-none min-h-[72px]"
                          placeholder="Izoh qoldiring..."
                        />
                      </div>
                    )}
                </div>
             </div>
          </div>

          {/* Premium Footer */}
          <div className="px-6 py-4 bg-slate-100/30 border-t border-slate-50 flex items-center justify-between">
            <div className="flex flex-col">
               <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('common.totalSum') || 'Jami Summa'}</span>
               <span className="text-lg font-[900] text-slate-900">{form.amount ? Number(form.amount).toLocaleString() : '—'} <span className="text-xs text-slate-300 font-black">UZS</span></span>
            </div>
            
            <div className="flex items-center gap-4">
              <button 
                onClick={resetModal}
                className="text-[11px] font-black text-slate-400 uppercase tracking-widest hover:text-rose-500 transition-all"
              >
                {t('common.cancel')}
              </button>
              <Button 
                onClick={handleSave} 
                disabled={saving || !form.amount || Number(form.amount) === 0 || !form.patient_id || (
                  // Qarz yo'q bemorga Income to'lov bloklash — faqat hisoblash tugaganda
                  !loadingDebt &&
                  realPatientDebt !== null &&
                  form.patient_id &&
                  (form.type || 'Income').toLowerCase() === 'income' &&
                  (realPatientDebt === 0 || Number(form.amount) > realPatientDebt)
                )} 
                className="h-11 px-8 rounded-xl premium-bg-gradient hover:opacity-90 text-white font-[900] uppercase text-[11px] tracking-widest shadow-xl shadow-[#1499AD]/30 border-none transition-all active:scale-95 flex items-center gap-3 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? (
                   <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Wallet className="w-4 h-4" />
                    {t('common.save')}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {selectedPlanForInvoice && (
        <TreatmentPlanInvoice 
          open={showPlanInvoiceModal} 
          onClose={() => { setShowPlanInvoiceModal(false); setSelectedPlanForInvoice(null); }} 
          plan={selectedPlanForInvoice} 
        />
      )}

      <PatientModal
        open={newPatientOpen}
        onClose={() => setNewPatientOpen(false)}
        patient={null}
        onSaved={handleNewPatientSaved}
      />

      <Dialog open={!!editPayment} onOpenChange={() => setEditPayment(null)}>
        <DialogContent className="sm:max-w-md rounded-[2rem] border-none shadow-2xl p-0 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-br from-[#1499AD] to-[#0e7a8a] px-8 pt-8 pb-6">
            <h2 className="text-white font-[900] text-lg uppercase tracking-widest mb-1">Shifokor Biriktirish</h2>
            <p className="text-white/70 text-xs font-medium">
              {editPayment?.patient_name} — {editPayment?.amount?.toLocaleString()} UZS
            </p>
          </div>

          {/* Doctor list */}
          <div className="px-6 py-5 space-y-2 max-h-72 overflow-y-auto">
            {doctors.length === 0 ? (
              <p className="text-center text-slate-400 text-sm py-4">Shifokorlar topilmadi</p>
            ) : (
              doctors.map(d => {
                const isSelected = selectedDoctorId === d.id;
                return (
                  <button
                    key={d.id}
                    onClick={() => setSelectedDoctorId(d.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all text-left ${
                      isSelected
                        ? 'border-[#1499AD] bg-[#1499AD]/10 shadow-md'
                        : 'border-slate-100 bg-slate-50 hover:border-[#1499AD]/40 hover:bg-[#1499AD]/5'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                      isSelected ? 'bg-[#1499AD] text-white' : 'bg-slate-200 text-slate-500'
                    }`}>
                      {(d.name || d.full_name || '?')[0].toUpperCase()}
                    </div>
                    <span className={`font-[800] text-sm uppercase tracking-tight ${
                      isSelected ? 'text-[#1499AD]' : 'text-slate-700'
                    }`}>
                      {d.name || d.full_name}
                    </span>
                    {isSelected && (
                      <div className="ml-auto w-5 h-5 rounded-full bg-[#1499AD] flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer buttons */}
          <div className="flex gap-3 px-6 pb-6">
            <button
              onClick={() => setEditPayment(null)}
              className="flex-1 h-12 rounded-2xl border-2 border-slate-200 font-bold uppercase text-[10px] tracking-widest text-slate-500 hover:bg-slate-50 transition-all"
            >
              Bekor qilish
            </button>
            <button
              onClick={async () => {
                if (!selectedDoctorId) {
                  toast.error('Shifokorni tanlang');
                  return;
                }
                if (!editPayment?.id) {
                  toast.error("To'lov topilmadi");
                  return;
                }
                try {
                  await base44.entities.Payment.update(editPayment.id, { doctor_id: selectedDoctorId });
                  toast.success('Shifokor biriktirildi ✓');
                  setEditPayment(null);
                  invalidatePayments();
                } catch (err) {
                  console.error(err);
                  toast.error('Xatolik: ' + (err?.message || 'Unknown'));
                }
              }}
              disabled={!selectedDoctorId}
              className="flex-1 h-12 rounded-2xl font-bold uppercase text-[10px] tracking-widest text-white transition-all
                bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20
                disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
            >
              Biriktirish ✓
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Excel-styled Payment Detail Dialog (Kvitansiya & Hisob-kitob Grid) ─── */}
      <Dialog open={!!selectedPayment} onOpenChange={(open) => !open && setSelectedPayment(null)}>
        {selectedPayment && (() => {
          const sp = selectedPayment;
          const pat = patients.find(pt => pt.id === sp.patient_id);
          const doc = doctors.find(d => d.id === sp.doctor_id);
          const isInstallment = !!(sp.notes && sp.notes.toLowerCase().includes('reja')) || !!sp.plan_id;
          const methodLabel = getPaymentMethodLabel(sp.method, t);
          const paymentAmount = Number(sp.amount) || 0;
          const debtAtPaymentTime = selectedPaymentDebt != null
            ? Number(selectedPaymentDebt)
            : Number(patientBalances[sp.id]?.debtAtTime ?? pat?.total_debt) || 0;
          const dtRaw = sp.created_date || sp.created_at || sp.date;
          const dt = dtRaw ? new Date(dtRaw) : null;
          const hasValidDate = dt && !isNaN(dt);

          const origPrice = selectedPaymentPatientData?.originalPrice ?? (Number(pat?.total_debt) + Number(pat?.total_paid) || paymentAmount);
          const discAmt = selectedPaymentPatientData?.totalDiscount ?? 0;
          const discPct = selectedPaymentPatientData?.discountPercent ?? (origPrice > 0 && discAmt > 0 ? Math.round((discAmt / origPrice) * 100) : 0);
          const finTotal = selectedPaymentPatientData?.finalPlanTotal ?? Math.max(0, origPrice - discAmt);
          const patTotals = patientCurrentTotals[sp.patient_id];
          const displayPaid = selectedPaymentPatientData?.totalPaid ?? patTotals?.totalPaid ?? (Number(pat?.total_paid) || 0);

          return (
            <DialogContent className="w-[96vw] max-w-4xl lg:max-w-5xl p-0 overflow-hidden rounded-2xl border border-slate-300 shadow-2xl [&>button]:hidden bg-white">
              
              {/* ── Top Header Bar ── */}
              <div className="bg-slate-900 text-white px-5 py-4 flex flex-wrap items-center justify-between gap-3 border-b-2 border-emerald-500">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {methodLabel}
                      </span>
                    </div>
                    <div className="text-2xl font-mono font-black text-white tracking-tight flex items-baseline gap-1.5 mt-1">
                      <span className="text-emerald-400">{paymentAmount < 0 ? '-' : '+'}</span>
                      {Math.abs(paymentAmount).toLocaleString()}
                      <span className="text-xs font-sans font-bold text-slate-400">UZS</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePrintSingleReceipt(sp, pat, doc, selectedPaymentPatientData, debtAtPaymentTime)}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
                    title="Chekni chop etish"
                  >
                    <Printer className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Chop etish</span>
                  </button>
                  <button
                    onClick={() => setSelectedPayment(null)}
                    className="w-8 h-8 rounded-xl bg-white/10 hover:bg-rose-500/20 hover:text-rose-300 flex items-center justify-center text-slate-400 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* ── Modal Scrollable Body ── */}
              <div className="p-4 sm:p-5 space-y-3.5 max-h-[78vh] overflow-y-auto bg-slate-50/50">

                {/* ─── 1. Bemor va To'lov Parametrlari (Excel Data Grid Table) ─── */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                  <div className="bg-slate-100/90 px-3.5 py-1.5 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <TableIcon className="w-3.5 h-3.5 text-[#1499AD]" />
                      Bemor va to'lov parametrlari
                    </span>
                    {hasValidDate && (
                      <span className="text-[9.5px] font-mono font-bold text-slate-500">
                        {format(dt, 'dd.MM.yyyy HH:mm')}
                      </span>
                    )}
                  </div>

                  <table className="w-full border-collapse text-xs">
                    <tbody>
                      <tr className="border-b border-slate-200">
                        <td className="w-1/4 bg-slate-50/80 px-3 py-1.5 font-bold text-slate-500 uppercase text-[9.5px] border-r border-slate-200">
                          Bemor (F.I.Sh):
                        </td>
                        <td className="w-1/4 px-3 py-1.5 font-extrabold text-slate-900 border-r border-slate-200 text-[11px]">
                          <span 
                            onClick={() => {
                              if (sp.patient_id) {
                                setSelectedPayment(null);
                                navigate(`/patients/${sp.patient_id}`);
                              }
                            }}
                            className="hover:text-[#1499AD] hover:underline cursor-pointer"
                          >
                            {sp.patient_name || '—'}
                          </span>
                        </td>
                        <td className="w-1/4 bg-slate-50/80 px-3 py-1.5 font-bold text-slate-500 uppercase text-[9.5px] border-r border-slate-200">
                          Telefon:
                        </td>
                        <td className="w-1/4 px-3 py-1.5 font-mono font-bold text-slate-900 text-[11px]">
                          <div className="flex items-center justify-between gap-1">
                            <span>{formatPhoneSingleLine(pat?.phone)}</span>
                            {pat?.phone && (
                              <button
                                onClick={(e) => handleCopyPhone(e, pat.phone, sp.id)}
                                className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
                                title="Nusxalash"
                              >
                                {copiedPhoneId === sp.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      <tr>
                        <td className="bg-slate-50/80 px-3 py-1.5 font-bold text-slate-500 uppercase text-[9.5px] border-r border-slate-200">
                          Shifokor:
                        </td>
                        <td className="px-3 py-1.5 font-bold text-slate-800 border-r border-slate-200 text-[11px]">
                          {doc?.name || doc?.full_name || 'Biriktirilmagan'}
                        </td>
                        <td className="bg-slate-50/80 px-3 py-1.5 font-bold text-slate-500 uppercase text-[9.5px] border-r border-slate-200">
                          To'lov Usuli:
                        </td>
                        <td className="px-3 py-1.5 font-bold text-slate-800">
                          <span className="inline-flex items-center px-2 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                            {methodLabel}
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* ─── 2. Davolash Rejasi & Bemorning To'lovlar Tarixi (Yonma-yon 2 ustunli ixcham blok) ─── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 items-stretch">

                  {/* Chap ustun: Davolash Rejasi & Moliyaviy Hisob-kitob */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col h-full">
                    <div className="bg-slate-100/90 px-3.5 py-1.5 border-b border-slate-200 flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                        Davolash rejasi & hisob-kitob
                      </span>
                      <span className="text-[9.5px] font-bold text-slate-500">
                        UZS (So'm)
                      </span>
                    </div>

                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[9px]">
                          <th className="w-8 py-1.5 px-2 text-center border-r border-slate-200">№</th>
                          <th className="py-1.5 px-2.5 text-left border-r border-slate-200">Ko'rsatkich</th>
                          <th className="py-1.5 px-2.5 text-right">Summa (UZS)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/80 font-mono text-[11px]">
                        
                        {/* 1. Reja narxi */}
                        <tr className="hover:bg-slate-50/60">
                          <td className="text-center font-bold text-slate-400 border-r border-slate-200 py-1.5">01</td>
                          <td className="px-2.5 py-1.5 font-sans font-bold text-slate-800 border-r border-slate-200">Reja (asl narxi)</td>
                          <td className="px-2.5 py-1.5 text-right font-black text-slate-900">
                            {origPrice.toLocaleString()}
                          </td>
                        </tr>

                        {/* 2. Chegirma */}
                        <tr className="hover:bg-purple-50/40 bg-purple-50/20">
                          <td className="text-center font-bold text-purple-400 border-r border-slate-200 py-1.5">02</td>
                          <td className="px-2.5 py-1.5 font-sans font-bold text-purple-800 border-r border-slate-200">Qo'llanilgan Chegirma</td>
                          <td className="px-2.5 py-1.5 text-right font-black text-purple-700">
                            {discAmt > 0 ? `-${discAmt.toLocaleString()}` : '0'} <span className="font-sans text-[9px] font-bold">({discPct}%)</span>
                          </td>
                        </tr>

                        {/* 3. Chegirmali jami summa */}
                        <tr className="hover:bg-blue-50/40 bg-blue-50/10">
                          <td className="text-center font-bold text-blue-400 border-r border-slate-200 py-1.5">03</td>
                          <td className="px-2.5 py-1.5 font-sans font-extrabold text-blue-900 border-r border-slate-200">To'lanishi Kerak</td>
                          <td className="px-2.5 py-1.5 text-right font-black text-blue-700">
                            {finTotal.toLocaleString()}
                          </td>
                        </tr>

                        {/* 4. Ushbu to'lov */}
                        <tr className="bg-emerald-50/50 hover:bg-emerald-50">
                          <td className="text-center font-bold text-emerald-600 border-r border-slate-200 py-1.5">04</td>
                          <td className="px-2.5 py-1.5 font-sans font-black text-emerald-900 border-r border-slate-200 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Ushbu To'lov
                          </td>
                          <td className="px-2.5 py-1.5 text-right font-black text-emerald-700 text-xs">
                            +{paymentAmount.toLocaleString()}
                          </td>
                        </tr>

                        {/* 5. Jami to'langan */}
                        <tr className="hover:bg-slate-50/60">
                          <td className="text-center font-bold text-slate-400 border-r border-slate-200 py-1.5">05</td>
                          <td className="px-2.5 py-1.5 font-sans font-bold text-slate-800 border-r border-slate-200">Bemor Jami To'lagan</td>
                          <td className="px-2.5 py-1.5 text-right font-black text-emerald-600">
                            {displayPaid.toLocaleString()}
                          </td>
                        </tr>

                        {/* 6. Qoldiq Qarz */}
                        <tr className={debtAtPaymentTime > 0 ? "bg-rose-50/50 hover:bg-rose-50" : "bg-emerald-50/30"}>
                          <td className={`text-center font-bold border-r border-slate-200 py-1.5 ${debtAtPaymentTime > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>06</td>
                          <td className={`px-2.5 py-1.5 font-sans font-black border-r border-slate-200 ${debtAtPaymentTime > 0 ? 'text-rose-900' : 'text-emerald-900'}`}>
                            Qoldiq Qarz
                          </td>
                          <td className={`px-2.5 py-1.5 text-right font-black text-xs ${debtAtPaymentTime > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {debtAtPaymentTime > 0 ? `${debtAtPaymentTime.toLocaleString()}` : "0 (✓ To'liq)"}
                          </td>
                        </tr>

                      </tbody>
                    </table>
                  </div>

                  {/* O'ng ustun: Bemorning To'lovlar Tarixi */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col h-full">
                    <div className="bg-slate-100/90 px-3.5 py-1.5 border-b border-slate-200 flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-600" />
                        Bemorning to'lovlar tarixi
                        {patientPaymentsHistory.length > 0 && (
                          <span className="px-1.5 py-0.2 bg-slate-200 text-slate-700 text-[9px] font-black rounded-full">
                            {patientPaymentsHistory.length}
                          </span>
                        )}
                      </span>
                      <span className="text-[9.5px] font-bold text-slate-400">
                        Eng oxirgi to'lovlar
                      </span>
                    </div>

                    <div className="overflow-x-auto max-h-[225px] overflow-y-auto scrollbar-thin flex-1">
                      {loadingHistory ? (
                        <div className="py-12 text-center text-xs text-slate-400">Yuklanmoqda...</div>
                      ) : patientPaymentsHistory.length === 0 ? (
                        <div className="py-12 text-center text-xs text-slate-400 italic">Boshqa to'lovlar topilmadi</div>
                      ) : (
                        <table className="w-full border-collapse text-xs">
                          <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[9px] font-bold z-10">
                            <tr>
                              <th className="py-1.5 px-2 text-center border-r border-slate-200 w-8">№</th>
                              <th className="py-1.5 px-2.5 text-left border-r border-slate-200">Sana & Vaqt</th>
                              <th className="py-1.5 px-2 text-left border-r border-slate-200">Usuli</th>
                              <th className="py-1.5 px-2 text-right">Summa</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                            {patientPaymentsHistory.map((histPay, hIdx) => {
                              const hAmt = Number(histPay.amount) || 0;
                              const hType = histPay.type || 'Income';
                              const hMethod = getPaymentMethodLabel(histPay.method, t);
                              const hDate = histPay.created_date || histPay.created_at || histPay.date;
                              const hDateStr = hDate ? new Date(hDate).toLocaleString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
                              const isExp = hType === 'Expense';
                              const isCurrent = histPay.id === sp.id;

                              return (
                                <tr key={histPay.id || hIdx} className={`hover:bg-slate-50 ${isCurrent ? 'bg-emerald-50/70 font-bold' : ''}`}>
                                  <td className="py-1.5 px-2 text-center border-r border-slate-200 text-slate-400 font-sans text-[10px]">
                                    {hIdx + 1}
                                  </td>
                                  <td className="py-1.5 px-2.5 border-r border-slate-200 font-sans text-slate-700 text-[10.5px]">
                                    {hDateStr}
                                  </td>
                                  <td className="py-1.5 px-2 border-r border-slate-200 font-sans text-[10px] text-slate-600 truncate max-w-[90px]">
                                    {hMethod}
                                  </td>
                                  <td className={`py-1.5 px-2 text-right font-black ${isExp ? 'text-rose-600' : 'text-emerald-600'}`}>
                                    {isExp ? '-' : '+'}{hAmt.toLocaleString()}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>

                </div>

                {/* ─── 4. Chek Rasmi (agar biriktirilgan bo'lsa) ─── */}
                {(sp.receipt_url || sp.receipt_image || sp.check_image) && (
                  <div className="bg-white p-3.5 rounded-xl border border-blue-200 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-blue-700 uppercase tracking-widest flex items-center gap-1.5">
                        <Receipt className="w-3.5 h-3.5 text-blue-600" />
                        Biriktirilgan To'lov Cheki / Kvitansiya
                      </span>
                      <button
                        type="button"
                        onClick={() => setPreviewReceiptUrl(sp.receipt_url || sp.receipt_image || sp.check_image)}
                        className="text-xs font-bold text-blue-700 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" /> Kattalashtirish
                      </button>
                    </div>
                    <div 
                      onClick={() => setPreviewReceiptUrl(sp.receipt_url || sp.receipt_image || sp.check_image)}
                      className="w-full h-44 rounded-xl overflow-hidden bg-slate-900/5 border border-blue-200 cursor-pointer relative group flex items-center justify-center"
                    >
                      <img src={sp.receipt_url || sp.receipt_image || sp.check_image} alt="To'lov cheki" className="w-full h-full object-contain" />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <span className="bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-md">
                          <Eye className="w-3.5 h-3.5" /> Chekni to'liq ko'rish
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* ─── 5. Izoh / Reja ─── */}
                {sp.notes && (
                  <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs">
                    <span className="text-[9.5px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                      Izoh / Qo'shimcha ma'lumot:
                    </span>
                    <p className="font-semibold text-slate-800 whitespace-pre-wrap">
                      {sp.notes.startsWith('Linked to Plan: ')
                        ? 'Davolash rejasiga biriktirilgan: ' + sp.notes.replace('Linked to Plan: ', '')
                        : sp.notes}
                    </p>
                  </div>
                )}

              </div>

              {/* ─── Modal Footer ─── */}
              <div className="bg-slate-100/90 px-5 py-3 border-t border-slate-200 flex items-center justify-between gap-3">
                <button
                  onClick={() => { handleDelete(sp.id, sp.patient_id); setSelectedPayment(null); }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-rose-600 hover:bg-rose-100/80 text-xs font-bold transition-all border border-rose-200 bg-white"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>O'chirish</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePrintSingleReceipt(sp, pat, doc, selectedPaymentPatientData, debtAtPaymentTime)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-300 hover:border-[#1499AD] text-slate-700 rounded-xl text-xs font-bold transition-all shadow-xs"
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-600" />
                    <span>Chop etish</span>
                  </button>
                  <button
                    onClick={() => setSelectedPayment(null)}
                    className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                  >
                    Yopish
                  </button>
                </div>
              </div>

            </DialogContent>
          );
        })()}
      </Dialog>

      {/* ─── Hisob Faktura Dialog ─── */}
      <Dialog open={invoiceOpen} onOpenChange={setInvoiceOpen}>
        <DialogContent className="max-w-lg p-0 overflow-hidden rounded-[2rem] border-none shadow-2xl">
          <div className="premium-bg-gradient px-6 py-4 text-white flex items-center justify-between">
            <div>
              <p className="text-[9px] font-black text-white/50 uppercase tracking-[0.3em]">Hisob Faktura</p>
              <h2 className="text-lg font-[900] tracking-tight">{invoiceData?.patient?.full_name}</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrintInvoice}
                className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-white text-[10px] font-black uppercase tracking-widest transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                Chop etish
              </button>
              <button onClick={() => setInvoiceOpen(false)} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>

          <div className="p-5 max-h-[75vh] overflow-y-auto no-scrollbar bg-white">
            {invoiceData && (
              <div ref={invoiceRef}>
                {/* Klinika ma'lumotlari */}
                <div className="flex items-start justify-between mb-4 pb-4 border-b border-slate-100">
                  <div>
                    <h3 className="text-base font-[900] text-slate-900">{clinicName}</h3>
                    <p className="text-[10px] text-slate-400 font-bold">Sana: {invoiceData.date}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Bemor</p>
                    <p className="text-sm font-[900] text-slate-900">{invoiceData.patient.full_name}</p>
                    <p className="text-[10px] text-slate-500 font-bold">{invoiceData.patient.phone ? formatPhone(invoiceData.patient.phone) : '—'}</p>
                  </div>
                </div>

                {/* Xizmatlar ro'yxati — Davolash rejalaridan */}
                {invoiceData.plans.length > 0 && (
                  <div className="mb-4">
                    <p className="text-[9px] font-black text-[#1499AD] uppercase tracking-widest mb-2">Davolash rejalari</p>
                    <table style={{width:'100%', borderCollapse:'collapse'}}>
                      <thead>
                        <tr className="bg-slate-900">
                          <th className="px-3 py-2 text-left text-[9px] font-black text-white uppercase">Xizmat</th>
                          <th className="px-3 py-2 text-right text-[9px] font-black text-white uppercase">Umumiy</th>
                          <th className="px-3 py-2 text-right text-[9px] font-black text-white uppercase">To'langan</th>
                          <th className="px-3 py-2 text-right text-[9px] font-black text-rose-300 uppercase">Qarz</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoiceData.plans.map((plan, i) => {
                          const remaining = Math.max(0, (plan.total_price || 0) - (plan.paid_amount || 0));
                          return (
                            <tr key={plan.id} className={i % 2 === 0 ? 'bg-slate-50/50' : 'bg-white'}>
                              <td className="px-3 py-2 text-[11px] font-bold text-slate-800">{plan.name}</td>
                              <td className="px-3 py-2 text-right text-[11px] font-black text-slate-900">{(plan.total_price || 0).toLocaleString()}</td>
                              <td className="px-3 py-2 text-right text-[11px] font-black text-emerald-600">{(plan.paid_amount || 0).toLocaleString()}</td>
                              <td className="px-3 py-2 text-right text-[11px] font-black text-rose-500">{remaining > 0 ? remaining.toLocaleString() : '✓'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Moliyaviy xulosa */}
                <div className="bg-slate-900 rounded-xl p-4 flex flex-col gap-2 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Jami to'langan</span>
                    <span className="text-sm font-[900] text-emerald-400">{invoiceData.totalPaid.toLocaleString()} UZS</span>
                  </div>
                  {invoiceData.totalDiscount > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Chegirma</span>
                      <span className="text-sm font-[900] text-amber-400">- {invoiceData.totalDiscount.toLocaleString()} UZS</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center border-t border-white/10 pt-2">
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">Qolgan qarz</span>
                    <span className={`text-base font-[900] ${invoiceData.totalDebt > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {invoiceData.totalDebt > 0 ? `${invoiceData.totalDebt.toLocaleString()} UZS` : "✓ To'liq"}
                    </span>
                  </div>
                </div>

                {/* So'nggi to'lovlar */}
                {invoiceData.payments.filter(p => p.type?.toLowerCase() === 'income').length > 0 && (
                  <div className="mt-4">
                    <p className="text-[9px] font-black text-[#1499AD] uppercase tracking-widest mb-2">To'lovlar tarixi</p>
                    <div className="space-y-1">
                      {invoiceData.payments.filter(p => p.type?.toLowerCase() === 'income').map(p => (
                        <div key={p.id} className="flex items-center justify-between py-1.5 border-b border-slate-50">
                          <div>
                            <span className="text-[11px] font-bold text-slate-700">{p.service_name || p.category || '—'}</span>
                            <span className="text-[9px] text-slate-400 ml-2">{p.method || 'Naqd'}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[11px] font-black text-emerald-600">{(p.amount || 0).toLocaleString()} UZS</span>
                            <p className="text-[9px] text-slate-400">{p.date?.slice(0,10) || '—'}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      {/* Fullscreen Receipt Lightbox */}
      <Dialog open={!!previewReceiptUrl} onOpenChange={(open) => !open && setPreviewReceiptUrl(null)}>
        <DialogContent className="max-w-3xl w-[95vw] max-h-[92vh] p-0 overflow-hidden rounded-3xl border-none shadow-2xl bg-slate-950 flex flex-col [&>button]:hidden">
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
                className="max-h-[75vh] max-w-full object-contain rounded-xl shadow-2xl" 
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
  );
}
