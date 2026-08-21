import { useState, useEffect, useRef } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Plus, Search, DollarSign, TrendingUp, Wallet, Filter, Calendar, Receipt, X, Trash2, Download, Clock, PlusCircle, Phone, CreditCard, Banknote, FileText, ChevronRight, Printer } from 'lucide-react';
import TreatmentPlanInvoice from '@/components/treatments/TreatmentPlanInvoice';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import EmptyState from '../components/ui/EmptyState';
import PatientModal from '../components/patients/PatientModal';
import PatientSelect from '../components/patients/PatientSelect';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/AuthContext';
import { useTranslation } from '@/i18n/LanguageContext';
import { toast } from 'react-hot-toast';
import { cn, formatPhone } from '@/lib/utils';
import { format } from 'date-fns';
import jsPDF from 'jspdf';

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

const getPaymentMethodLabel = (method) => {
  if (method === 'Card') return 'Plastik karta';
  if (method === 'Transfer') return 'Bank o‘tkazma';
  if (method === 'Cash') return 'Naqd pul';
  return method || '—';
};

const getPaymentTypeLabel = (type) => {
  if (type === 'Expense') return 'Chiqim';
  if (type === 'Refund') return 'Qaytarish';
  if (type === 'Discount') return 'Chegirma';
  if (type === 'Debt') return 'Qarz';
  return 'Kirim';
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
  const { t } = useTranslation();
  const location = useLocation();
  const { user, isDoctor } = useAuth();

  const [payments, setPayments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [doctors, setDoctors] = useState([]);
  const loadingTimerRef = useRef(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [newPatientOpen, setNewPatientOpen] = useState(false);
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
    date: getInitialTime().split('T')[0]
  });
  const [saving, setSaving] = useState(false);
  const [editPayment, setEditPayment] = useState(null);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [patientServices, setPatientServices] = useState([]);
  const [selectedServiceId, setSelectedServiceId] = useState(''); // tanlangan xizmat id si
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceData, setInvoiceData] = useState(null);
  const invoiceRef = useRef(null);
  const [selectedPaymentDebt, setSelectedPaymentDebt] = useState(null); // dialog uchun real qarz
  const [selectedPaymentPatientData, setSelectedPaymentPatientData] = useState(null); // dialog uchun bemorning real-time hisobi
  const [patientCurrentTotals, setPatientCurrentTotals] = useState({}); // barcha bemorlarning real-time qarzlari va to'lovlari
  const [stats, setStats] = useState({ totalRevenue: 0, monthRevenue: 0, todayRevenue: 0, totalCount: 0 });
  const [isMobile, setIsMobile] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  // Modal ichidagi bemor uchun real-time hisoblangan qarz
  const [realPatientDebt, setRealPatientDebt] = useState(null);
  const [loadingDebt, setLoadingDebt] = useState(false);
  const [patientBalances, setPatientBalances] = useState({});
  const [patientPlans, setPatientPlans] = useState([]);
  const [selectedPlanForInvoice, setSelectedPlanForInvoice] = useState(null);
  const [showPlanInvoiceModal, setShowPlanInvoiceModal] = useState(false);

  // Patient payments history for Detail dialog
  const [patientPaymentsHistory, setPatientPaymentsHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const loadPatientPaymentsHistory = async (patientId) => {
    if (!patientId) return;
    setLoadingHistory(true);
    try {
      const history = await base44.entities.Payment.filter({ patient_id: patientId }, '-date', 1000);
      // Filter out Expenses or only show Income/Refund? The user wants to see "all paid sums" (barcha to'lagan summalari).
      // We will show all, but typically they care about payments. Let's list all payments.
      setPatientPaymentsHistory(history || []);
    } catch (err) {
      console.error('Failed to load patient payments history:', err);
    } finally {
      setLoadingHistory(false);
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

  // Responsive check
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const PAGE_SIZE = 50;

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Load stats separately from all payments (not limited by PAGE_SIZE)
  const loadStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Fetch recent payments for stats (500 records — enough for accurate monthly stats)
      const allPays = await base44.entities.Payment.list('-date', 500, 0);
      const incomePays = (allPays || []).filter(p => !p.type || p.type?.toLowerCase() === 'income');

      const totalRevenue = incomePays.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const monthRevenue = incomePays
        .filter(p => (p.date || '').slice(0, 7) === today.slice(0, 7))
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const todayRevenue = incomePays
        .filter(p => (p.date || '').slice(0, 10) === today)
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

      setStats({ totalRevenue, monthRevenue, todayRevenue, totalCount: (allPays || []).length });
    } catch (err) {
      console.error('Stats load error:', err);
    }
  };

  const load = async (isNewSearch = false) => {
    try {
      if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
      
      if (isNewSearch) {
        if (payments.length === 0) {
          loadingTimerRef.current = setTimeout(() => {
            setLoading(true);
          }, 150);
        }
      } else {
        setLoadingMore(true);
      }

      // Always use current page state for pagination
      const currentPage = isNewSearch ? 0 : page;
      const offset = currentPage * PAGE_SIZE;

      const [pays, pats, docs] = await Promise.all([
        debouncedSearch 
          ? base44.entities.Payment.search(debouncedSearch, PAGE_SIZE, offset)
          : base44.entities.Payment.list('-created_date', PAGE_SIZE, offset),
        isNewSearch ? base44.entities.Patient.list('full_name', 200) : Promise.resolve(patients),
        isNewSearch ? base44.entities.User.filter({ role: 'doctor' }, 'name') : Promise.resolve(doctors),
      ]);

      const rawPays = pays || [];

      // Sort newest first (by created_date, fallback to created_at/date)
      const validPays = [...rawPays].sort((a, b) => {
        const ta = a.created_date || a.created_at || a.date || '';
        const tb = b.created_date || b.created_at || b.date || '';
        return tb.localeCompare(ta);
      });
      
      // Dynamic fetch of missing patients to ensure phone and debt display properly
      let currentPatients = isNewSearch ? (pats || []) : patients;
      const existingPatientIds = new Set(currentPatients.map(p => p.id));
      const missingPatientIds = [...new Set(validPays.map(p => p.patient_id).filter(id => id && !existingPatientIds.has(id)))];
      
      if (missingPatientIds.length > 0) {
        try {
          const fetchedMissing = await Promise.all(
            missingPatientIds.map(id => base44.entities.Patient.read(id).catch(() => null))
          );
          const validMissing = fetchedMissing.filter(Boolean);
          currentPatients = [...currentPatients, ...validMissing];
        } catch (err) {
          console.error("Error fetching missing patients:", err);
        }
      }

      if (isNewSearch) {
        // Deduplicate by ID on fresh load
        const seen = new Set();
        const uniquePays = validPays.filter(p => {
          if (!p.id || seen.has(p.id)) return false;
          seen.add(p.id);
          return true;
        });
        setPayments(uniquePays);
        setPage(0);
        setPatients(currentPatients);
        setDoctors(docs || []);
        setHasMore(rawPays.length === PAGE_SIZE);
      } else {
        // Append new page but deduplicate against existing
        setPayments(prev => {
          const seen = new Set(prev.map(p => p.id));
          const newItems = validPays.filter(p => p.id && !seen.has(p.id));
          return [...prev, ...newItems];
        });
        setPatients(currentPatients);
        setHasMore(rawPays.length === PAGE_SIZE);
      }

    } catch (error) {
      console.error('Error loading payments:', error);
    } finally {
      if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (user) {
      load(true);
      loadStats();
    }
  }, [user, debouncedSearch]);

  useEffect(() => {
    if (page > 0) load(false);
  }, [page]);

  // Deduplicate by ID and sort newest first (created_date desc, then created_at desc, then date desc)
  const filteredPayments = (() => {
    const seen = new Set();
    return [...payments]
      .filter(p => {
        if (!p.id || seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      })
      .sort((a, b) => {
        const ta = a.created_date || a.created_at || a.date || '';
        const tb = b.created_date || b.created_at || b.date || '';
        return tb.localeCompare(ta);
      });
  })();

  const displayPayments = filteredPayments.filter(p => {
    const t = String(p.type || 'Income').toLowerCase();
    return t === 'income' || t === 'expense' || t === 'refund';
  });

  // Calculate patient balances from already-loaded payments (no extra API calls)
  useEffect(() => {
    if (!payments.length) {
      setPatientBalances({});
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
        const ta = a.created_date || a.created_at || a.date || '';
        const tb = b.created_date || b.created_at || b.date || '';
        return ta.localeCompare(tb);
      });

      let runningDebt = 0;
      let runningPaid = 0;
      let runningDiscount = 0;

      for (const payment of sorted) {
        const type = String(payment.type || 'Income').toLowerCase();
        const rawAmount = Number(payment.amount) || 0;
        const amount = Math.abs(rawAmount);

        if (type === 'income') {
          runningPaid += amount;
          runningDebt -= amount;
        } else if (type === 'debt') {
          runningDebt += amount;
        } else if (type === 'discount') {
          runningDiscount += amount;
          runningDebt -= amount;
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
  }, [payments]);


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
      doctor_id: isDoctor ? user.id : (form.doctor_id || ''),
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
          // Tanlangan xizmatni "to'langan" deb belgilash
          if (savedServiceObj && savedType.toLowerCase() === 'income') {
            try {
              const plans = await base44.entities.TreatmentPlan.filter({ patient_id: savedPatientId }, '-created_date', 50);
              const targetPlan = plans?.find(pl => pl.id === savedServiceObj.plan_id);
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
          await Promise.all([load(true), loadStats()]);
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
      await Promise.all([load(true), loadStats()]);
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
      load();
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
    setForm(prev => ({ ...prev, patient_id: newPatient.id, patient_name: newPatient.full_name }));
    setNewPatientOpen(false);
  };

  // To'lov tafsiloti dialogini ochish — real qarzni DB dan hisoblaydi
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

      // Vaqt bo'yicha tartiblash
      const sorted = [...paysList].sort((a, b) => {
        const ta = a.created_date || a.created_at || (a.date ? a.date + 'T00:00:00' : '');
        const tb = b.created_date || b.created_at || (b.date ? b.date + 'T00:00:00' : '');
        return ta.localeCompare(tb);
      });

      // 1. Running balance — shu to'lov paytidagi qoldiq qarz
      let runDebt = 0;
      for (const pay of sorted) {
        const type = (pay.type || 'income').toLowerCase();
        const amt = Math.abs(Number(pay.amount) || 0);
        if (type === 'income') runDebt -= amt;
        else if (type === 'debt') runDebt += amt;
        else if (type === 'discount') runDebt -= amt;
        else if (type === 'refund') runDebt += amt;
        if (pay.id === p.id) break; // shu to'lovdan keyin to'xtaymiz
      }
      setSelectedPaymentDebt(Math.max(0, runDebt));

      // 2. Bemorning barcha to'lov va rejalaridan real-time hisob-kitob (PatientProfile bilan 100% bir xil formula)
      const totalIncomes = paysList.filter(pay => pay.type?.toLowerCase() === 'income').reduce((s, pay) => s + (Number(pay.amount) || 0), 0);
      const totalDiscounts = paysList.filter(pay => pay.type?.toLowerCase() === 'discount').reduce((s, pay) => s + Math.abs(Number(pay.amount) || 0), 0);
      const totalRefunds = paysList.filter(pay => pay.type?.toLowerCase() === 'refund').reduce((s, pay) => s + (Number(pay.amount) || 0), 0);
      const totalDebts = paysList.filter(pay => pay.type?.toLowerCase() === 'debt').reduce((s, pay) => s + (Number(pay.amount) || 0), 0);
      const totalPlansPrice = plansList.reduce((sum, pl) => sum + (Number(pl.total_price) || 0), 0);

      let currentDebt = 0;
      if (totalDebts > 0) {
        const net = totalIncomes + totalDiscounts - totalDebts - totalRefunds;
        currentDebt = net < 0 ? Math.abs(net) : 0;
      } else if (totalPlansPrice > 0) {
        const net = totalIncomes + totalDiscounts - totalPlansPrice;
        currentDebt = net < 0 ? Math.abs(net) : 0;
      } else {
        const net = totalIncomes - totalRefunds;
        currentDebt = net < 0 ? Math.abs(net) : 0;
      }

      setSelectedPaymentPatientData({
        totalPaid: totalIncomes,
        currentDebt: currentDebt,
        totalDiscount: totalDiscounts,
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
              <h1 className="text-xl font-[900] text-slate-900 tracking-tight leading-none mb-0.5">
                {t('payments.title')}
              </h1>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 px-2 py-0.5 bg-[#1499AD]/10 rounded-full">
                    <TrendingUp className="w-3 h-3 text-[#1499AD]" />
                    <span className="text-[9px] font-black text-[#1499AD] uppercase tracking-[0.1em]">
                        {t('common.finance')}
                    </span>
                </div>
                <span className="w-1 h-1 rounded-full bg-slate-200" />
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  {stats.totalCount} {t('common.total')}
                </span>
              </div>
            </div>
          </motion.div>
        </div>
        
        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.05, y: -1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-[900] uppercase tracking-widest shadow-lg shadow-slate-900/20 transition-all border-none"
          >
            <Plus className="w-4 h-4 text-[#1499AD]" />
            {t('payments.addNew')}
          </motion.button>
        </div>
      </div>

      {/* Analytics Mini Dashboard */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: t('payments.totalIncome'), value: formatCurrency(stats.totalRevenue), color: 'from-[#1499AD] to-[#0E7A8A]', icon: TrendingUp, detail: 'Umumiy tushum' },
          { label: t('payments.thisMonth'), value: formatCurrency(stats.monthRevenue), color: 'from-emerald-500 to-teal-600', icon: Calendar, detail: 'Joriy oy' },
          { label: t('payments.todayIncome'), value: formatCurrency(stats.todayRevenue), color: 'from-blue-600 to-indigo-700', icon: Clock, detail: 'Bugun' }
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1, type: 'spring', stiffness: 100 }}
            className="premium-card p-4 border-none relative overflow-hidden group"
          >
            <div className={`absolute -right-4 -bottom-4 w-20 h-20 bg-gradient-to-br ${stat.color} opacity-[0.05] rounded-full blur-xl transition-all group-hover:opacity-10`} />
            <div className="relative z-10 flex items-center justify-between">
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center text-white shadow-md`}>
                    <stat.icon className="w-4 h-4" />
                </div>
                <div className="text-right">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.1em] block">{stat.label}</span>
                    <div className="text-[8px] font-bold text-slate-300 uppercase">{stat.detail}</div>
                </div>
            </div>
            <div className="text-lg font-[1000] text-slate-900 tracking-tighter flex items-baseline gap-1 mt-2">
                {stat.value.split(' ')[0]}
                <span className="text-[10px] text-slate-400 font-black tracking-normal uppercase">{stat.value.split(' ')[1]}</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Search & Filter Bar */}
      <div className="glass-panel rounded-2xl p-2 flex flex-col md:flex-row items-center gap-2">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300 transition-colors" />
          <input 
            type="text" 
            placeholder={t('common.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-4 bg-slate-50/50 rounded-xl border-none font-bold text-slate-900 text-[12px] placeholder:text-slate-300 focus:ring-2 focus:ring-[#1499AD]/10 transition-all outline-none"
          />
        </div>
        <div className="flex items-center gap-1.5 w-full md:w-auto">
            <button className="h-9 px-4 bg-white border border-slate-100 rounded-xl flex items-center gap-1.5 text-[9px] font-black text-slate-500 uppercase tracking-widest hover:border-[#1499AD] transition-all">
                <Filter className="w-3 h-3" />
                Filtr
            </button>
            <button className="h-9 px-4 bg-white border border-slate-100 rounded-xl flex items-center gap-1.5 text-[9px] font-black text-slate-500 uppercase tracking-widest hover:border-[#1499AD] transition-all" onClick={() => toast.success('Eksport qilinmoqda...')}>
                <Download className="w-3 h-3" />
                Eksport
            </button>
        </div>
      </div>

      {/* Main Data View - Premium Table */}
      {!isMobile ? (
        <>
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-lg shadow-slate-200/40 relative"
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
          
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100">
                <th className="py-3 px-4 text-left text-[9px] font-black text-[#1499AD] uppercase tracking-[0.15em]">{t('patients.fullName')}</th>
                <th className="py-3 px-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-[0.15em]">{t('payments.service')}</th>
                <th className="py-3 px-4 text-left text-[9px] font-black text-emerald-500 uppercase tracking-[0.15em]">To'lov summasi</th>
                <th className="py-3 px-4 text-left text-[9px] font-black text-rose-400 uppercase tracking-[0.15em]">Qarz</th>
                <th className="py-3 px-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-[0.15em]">{t('payments.doctor')}</th>
                <th className="py-3 px-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-[0.15em]">{t('appointments.date')}</th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {displayPayments.length > 0 ? (
                displayPayments.map((p, idx) => {
                  const pat = patients.find(pt => pt.id === p.patient_id);
                  const isInstallment = !!(p.notes && p.notes.toLowerCase().includes('reja')) || !!p.plan_id;
                  const methodIcon = p.method === 'Card' ? <CreditCard className="w-3 h-3" /> : p.method === 'Transfer' ? <Banknote className="w-3 h-3" /> : null;
                  const debtVal = (patientBalances[p.id]?.debtAtTime !== undefined)
                    ? patientBalances[p.id].debtAtTime
                    : (p.debt_amount !== undefined && p.debt_amount !== null ? Number(p.debt_amount) : (Number(pat?.total_debt) || 0));
                  return (
                  <motion.tr 
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.02 }}
                    key={p.id} 
                    className="group border-b border-slate-50 last:border-0 cursor-pointer hover:bg-[#1499AD]/[0.02] transition-colors"
                    onClick={() => openPaymentDetail(p)}
                  >
                    <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-slate-500 font-black text-xs border border-white shadow-sm overflow-hidden relative group-hover:shadow-md transition-all shrink-0">
                                {p.patient_name?.[0] || 'T'}
                                <div className="absolute inset-0 bg-[#1499AD] opacity-0 group-hover:opacity-10 transition-opacity" />
                            </div>
                            <div>
                                <span className="font-[900] text-slate-900 uppercase tracking-tight block text-[11px] leading-none">{p.patient_name}</span>
                                <div className="flex flex-col gap-0.5 mt-0.5">
                                  {pat?.phone ? (
                                    <span className="text-[9px] font-bold text-slate-400 flex items-center gap-0.5">
                                      <Phone className="w-2.5 h-2.5" />{formatPhone(pat.phone)}
                                    </span>
                                  ) : (
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Telefon kiritilmagan</span>
                                  )}
                                  {pat?.total_debt != null && (
                                    <span className={`text-[9px] font-bold ${debtVal > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                      Qarz: {debtVal > 0 ? `${debtVal.toLocaleString()} UZS` : '✓ Qarz yo\'q'}
                                    </span>
                                  )}
                                </div>
                            </div>
                        </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[11px] font-black text-slate-700 uppercase tracking-tight leading-tight">
                            {formatCategory(p.service_name || p.category || '')}
                        </span>
                        {isInstallment && (
                          <span className="inline-flex items-center gap-1 text-[8px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full w-fit">
                            <Calendar className="w-2.5 h-2.5" />Muddatli to'lov summasi
                          </span>
                        )}
                      </div>
                    </td>
                    {/* To'lov summasi */}
                    <td className="px-4 py-2.5">
                      <span className="text-[11px] font-black text-emerald-600">
                        {Number(p.amount || 0).toLocaleString()} <span className="text-[8px] text-emerald-300 font-bold">UZS</span>
                      </span>
                    </td>
                    {/* Qarz — bemorning o'sha paytdagi qarzi */}
                    <td className="px-4 py-2.5">
                      <div className="flex flex-col gap-0.5">
                        <span className={`text-[11px] font-black ${debtVal > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                          {debtVal > 0
                            ? <>{debtVal.toLocaleString()} <span className="text-[8px] text-rose-300 font-bold">UZS</span></>
                            : '✓ To\'liq'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                       {p.doctor_id ? (
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.6)]" />
                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-tight">
                                {doctors.find(d => d.id === p.doctor_id)?.name || 'Shifokor'}
                            </span>
                          </div>
                       ) : (
                          <button 
                            onClick={(e) => { e.stopPropagation(); setEditPayment(p); }}
                            className="flex items-center gap-1.5 group/btn"
                          >
                             <PlusCircle className="w-3.5 h-3.5 text-slate-300 group-hover/btn:text-[#1499AD] transition-colors" />
                             <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest group-hover/btn:text-[#1499AD] transition-all">
                                 Biriktirish
                             </span>
                          </button>
                       )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-col">
                        {(() => {
                          const dtRaw = p.created_date || p.created_at || p.date;
                          const dt = dtRaw ? new Date(dtRaw) : null;
                          const hasValid = dt && !isNaN(dt);
                          return (
                            <>
                              <span className="text-[10px] font-black text-slate-700 uppercase tracking-tight">
                                {hasValid ? format(dt, 'dd MMM') : (p.date ? format(new Date(p.date), 'dd MMM') : '—')}
                              </span>
                              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                                {hasValid ? format(dt, 'yyyy') : (p.date ? format(new Date(p.date), 'yyyy') : '—')}
                              </span>
                              {hasValid && (
                                <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest mt-0.5">
                                  {format(dt, 'HH:mm')}
                                </span>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDelete(p.id, p.patient_id); }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </motion.tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-20 text-center text-slate-300 uppercase font-black text-xs tracking-widest">
                    To'lovlar topilmadi
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </motion.div>
        {hasMore && (
          <div className="flex justify-center mt-6 pb-6">
            <Button 
              onClick={() => setPage(p => p + 1)}
              disabled={loadingMore}
              className="h-10 px-8 rounded-xl bg-white border-2 border-slate-100 text-slate-500 font-bold uppercase text-[9px] tracking-widest hover:border-[#1499AD] transition-all"
            >
              {loadingMore ? 'Yuklanmoqda...' : 'Yana yuklash'}
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
              transition={{ delay: idx * 0.03 }}
              key={p.id} 
              className="premium-card p-4 border-none shadow-md shadow-slate-200/40 relative overflow-hidden active:scale-[0.99] transition-all cursor-pointer hover:bg-slate-50/50"
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
            <p className="text-[10px] font-black text-white/50 tracking-[0.3em] uppercase">Mablag' qabul qilish</p>
          </div>

          <div className="p-5 bg-white max-h-[80vh] overflow-y-auto no-scrollbar">
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
                       onChange={(id, pat) => setForm({ ...form, patient_id: id, patient_name: pat?.full_name || '' })} 
                       inputClassName="h-11 rounded-xl border-none bg-slate-50 px-5 font-black text-slate-900 text-sm"
                     />
                   </div>

                   {/* Davolash rejalari va hisob-faktura ko'rish */}
                   {patientPlans && patientPlans.length > 0 && (
                      <div className="space-y-2 pt-3 border-t border-slate-50 relative z-20">
                        <Label className="text-[9px] font-black text-[#1499AD] uppercase tracking-widest ml-1 flex items-center gap-1.5">
                          <Receipt className="w-3 h-3" /> Davolash rejalari
                        </Label>
                        <div className="flex flex-col gap-2">
                          {patientPlans.map(plan => {
                            const paid = Number(plan.paid_amount) || 0;
                            const total = Number(plan.total_price) || 0;
                            const remaining = Math.max(0, total - paid);
                            return (
                              <div key={plan.id} className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
                                <div className="flex-1 min-w-0 mr-2">
                                  <p className="text-[11px] font-black text-slate-800 truncate">{plan.name || 'Davolash rejasi'}</p>
                                  <p className="text-[10px] text-slate-500 font-medium">
                                    Qarz: <span className={remaining > 0 ? 'text-rose-600 font-black' : 'text-emerald-600 font-black'}>{remaining.toLocaleString()} so'm</span>
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => { setSelectedPlanForInvoice(plan); setShowPlanInvoiceModal(true); }}
                                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-100 text-blue-600 text-[10px] font-black uppercase tracking-wide hover:bg-blue-100 active:scale-95 transition-all"
                                >
                                  <FileText className="w-3 h-3" />
                                  Faktura
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2 pt-3 border-t border-slate-50 relative z-10">
                       <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-4">To'lov turi va usuli</Label>
                       <div className="grid grid-cols-2 gap-3">
                         <Select 
                           value={form.type} 
                           onValueChange={val => setForm({ ...form, type: val })}
                         >
                           <SelectTrigger className="h-11 rounded-xl border-none bg-slate-50 px-4 font-black text-slate-900 text-sm focus:ring-0">
                             <SelectValue placeholder="Turi" />
                           </SelectTrigger>
                           <SelectContent className="rounded-xl border-none shadow-2xl">
                              <SelectItem value="Income" className="font-bold py-2 text-emerald-600">Kirim (+)</SelectItem>
                              <SelectItem value="Expense" className="font-bold py-2 text-rose-600">Chiqim (-)</SelectItem>
                           </SelectContent>
                         </Select>

                         <Select 
                           value={form.method || 'Cash'} 
                           onValueChange={val => setForm({ ...form, method: val })}
                         >
                           <SelectTrigger className="h-11 rounded-xl border-none bg-slate-50 px-4 font-black text-slate-900 text-sm focus:ring-0">
                             <SelectValue placeholder="Usuli" />
                           </SelectTrigger>
                           <SelectContent className="rounded-xl border-none shadow-2xl">
                              <SelectItem value="Cash" className="font-bold py-2">Naqd pul</SelectItem>
                              <SelectItem value="Card" className="font-bold py-2">Plastik karta</SelectItem>
                              <SelectItem value="Transfer" className="font-bold py-2">Bank/O'tkazma</SelectItem>
                           </SelectContent>
                         </Select>
                       </div>
                    </div>

                    <div className="space-y-3 pt-3 border-t border-slate-50">
                      <div className="space-y-1.5">
                         <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-4">{t('payments.doctor')}</Label>
                         <Select 
                           value={form.doctor_id} 
                           onValueChange={val => setForm({ ...form, doctor_id: val })}
                           disabled={isDoctor}
                         >
                           <SelectTrigger className="h-11 rounded-xl border-none bg-slate-50 px-4 font-black text-slate-900 text-sm focus:ring-0">
                             <SelectValue placeholder={t('payments.doctor')} />
                           </SelectTrigger>
                           <SelectContent className="rounded-xl border-none shadow-2xl p-1">
                             {doctors.map(d => (
                               <SelectItem key={d.id} value={d.id} className="rounded-xl py-2 font-black text-xs uppercase tracking-widest">
                                 {d.name || d.full_name}
                               </SelectItem>
                             ))}
                           </SelectContent>
                         </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-4">{t('common.date')}</Label>
                        <input 
                          type="datetime-local" 
                          value={form.created_at} 
                          onChange={e => setForm({ ...form, created_at: e.target.value })}
                          className="w-full h-11 rounded-xl border-none bg-slate-50 px-4 font-black text-slate-900 text-sm focus:ring-0 outline-none"
                        />
                      </div>
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
                            <div className="flex items-center justify-between px-4">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Bemor qarzi:</span>
                              {loadingDebt ? (
                                <span className="text-[9px] font-black text-slate-300 uppercase">Hisoblanmoqda...</span>
                              ) : (
                                <span className={`text-xs font-black ${debt > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                  {debt > 0 ? `${debt.toLocaleString()} UZS` : '✓ Qarz yo\'q'}
                                </span>
                              )}
                            </div>
                            {/* Ogohlantirish — qarz yo'q bemorga Income to'lov */}
                            {noDebtWarning && (
                              <div className="mx-4 flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                                <span className="text-amber-500 text-sm mt-0.5">⚠️</span>
                                <div>
                                  <p className="text-[10px] font-black text-amber-700 uppercase tracking-wider">Diqqat!</p>
                                  <p className="text-[10px] font-bold text-amber-600">Bu bemorning qarzi yo'q. Kirim to'lov qilish mumkin emas.</p>
                                  <p className="text-[9px] text-amber-500 mt-0.5">Chiqim, chegirma yoki boshqa tur tanlang.</p>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                   </div>

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
                </div>
             </div>
          </div>

          {/* Premium Footer */}
          <div className="px-6 py-4 bg-slate-100/30 border-t border-slate-50 flex items-center justify-between">
            <div className="flex flex-col">
               <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Jami Summa</span>
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
                  load(true);
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

      {/* Payment Detail Dialog */}
      <Dialog open={!!selectedPayment} onOpenChange={(open) => !open && setSelectedPayment(null)}>
        {selectedPayment && (() => {
          const sp = selectedPayment;
          const pat = patients.find(pt => pt.id === sp.patient_id);
          const doc = doctors.find(d => d.id === sp.doctor_id);
          const isInstallment = !!(sp.notes && sp.notes.toLowerCase().includes('reja')) || !!sp.plan_id;
          const methodLabel = getPaymentMethodLabel(sp.method);
          const typeColor = sp.type === 'Expense' ? 'text-rose-600 bg-rose-50 border-rose-100' : sp.type === 'Refund' ? 'text-amber-600 bg-amber-50 border-amber-100' : 'text-emerald-600 bg-emerald-50 border-emerald-100';
          const typeLabel = getPaymentTypeLabel(sp.type);
          const procedures = extractPaymentProcedures(sp);
          const paymentAmount = Number(sp.amount) || 0;
          const debtAtPaymentTime = selectedPaymentDebt != null
            ? Number(selectedPaymentDebt)
            : Number(patientBalances[sp.id]?.debtAtTime ?? pat?.total_debt) || 0;
          const dtRaw = sp.created_date || sp.created_at || sp.date;
          const dt = dtRaw ? new Date(dtRaw) : null;
          const hasValidDate = dt && !isNaN(dt);
          return (
            <DialogContent className="w-[95vw] max-w-3xl p-0 overflow-hidden rounded-[2rem] border-none shadow-2xl [&>button]:hidden">
              {/* Header */}
              <div className="premium-bg-gradient px-6 py-5 text-white relative">
                <button onClick={() => setSelectedPayment(null)} className="absolute right-4 top-4 w-7 h-7 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
                  <X className="w-4 h-4" />
                </button>
                <p className="text-[9px] font-black text-white/50 uppercase tracking-[0.3em] mb-1">To'lov tafsilotlari</p>
                <h2 className="text-2xl sm:text-3xl font-[900] tracking-tight">{paymentAmount < 0 ? '' : '+'}{paymentAmount.toLocaleString()} <span className="text-sm font-bold text-white/60">UZS</span></h2>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${typeColor}`}>{typeLabel}</span>
                  {isInstallment && <span className="inline-flex items-center gap-1 text-[9px] font-black text-blue-100 bg-white/10 px-2 py-0.5 rounded-full"><Calendar className="w-2.5 h-2.5" />Muddatli to'lov</span>}
                </div>
              </div>

              {/* Body */}
              <div className="p-5 sm:p-6 bg-white space-y-4 max-h-[80vh] overflow-y-auto">
                <div className="rounded-[1.5rem] border border-slate-200 overflow-hidden">
                  <div className="px-4 sm:px-5 py-3 bg-slate-50 border-b border-slate-200">
                    <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-[0.18em]">Bemor va shifokor ma'lumotlari</h3>
                  </div>
                  <div className="divide-y divide-slate-100">
                    <div className="grid grid-cols-[110px_1fr] gap-3 px-4 sm:px-5 py-3">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bemor</span>
                      <div className="min-w-0">
                        <p className="text-[13px] sm:text-[14px] font-[900] text-slate-900 break-words">{sp.patient_name || '—'}</p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                          <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {pat?.phone ? formatPhone(pat.phone) : 'Telefon kiritilmagan'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-[110px_1fr] gap-3 px-4 sm:px-5 py-3">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Shifokor</span>
                      <p className="text-[13px] sm:text-[14px] font-[900] text-slate-800 break-words">{doc?.name || doc?.full_name || 'Biriktirilmagan'}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">To'lov turi</p>
                    <p className="text-[12px] font-[900] text-slate-800">{typeLabel}</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">To'lov usuli</p>
                    <p className="text-[12px] font-[900] text-slate-800">{methodLabel}</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Sana</p>
                    <p className="text-[12px] font-[900] text-slate-800">
                      {hasValidDate ? format(dt, 'dd MMMM yyyy') : (sp.date ? format(new Date(sp.date), 'dd MMMM yyyy') : '—')}
                    </p>
                    {hasValidDate && (
                      <p className="text-[10px] font-bold text-slate-500 mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(dt, 'HH:mm')}
                      </p>
                    )}
                  </div>
                  <div className="p-3 rounded-2xl bg-rose-50 border border-rose-100">
                    <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest mb-1">Qolgan qarz</p>
                    <p className={`text-[13px] font-[900] ${debtAtPaymentTime > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {debtAtPaymentTime > 0 ? `${debtAtPaymentTime.toLocaleString()} so'm` : "To'liq yopilgan"}
                    </p>
                  </div>
                </div>

                {pat && (() => {
                  const patTotals = patientCurrentTotals[sp.patient_id];
                  const displayPaid = selectedPaymentPatientData?.totalPaid ?? patTotals?.totalPaid ?? (Number(pat?.total_paid) || 0);
                  const displayDebt = selectedPaymentPatientData?.currentDebt ?? patTotals?.currentDebt ?? (Number(pat?.total_debt) || 0);

                  return (
                    <div className="rounded-[1.5rem] border border-slate-200 overflow-hidden">
                      <div className="px-4 sm:px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                        <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-[0.18em]">Bemorning umumiy moliyaviy holati</h3>
                        {selectedPaymentPatientData?.totalDiscount > 0 && (
                          <span className="text-[10px] font-black text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100">
                            Chegirma: {selectedPaymentPatientData.totalDiscount.toLocaleString()} UZS
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 px-4 sm:px-5 py-4">
                        <div 
                          onClick={() => setShowHistory(!showHistory)}
                          className="p-3 rounded-2xl bg-emerald-50 border border-emerald-100 cursor-pointer hover:bg-emerald-100/50 active:scale-95 transition-all select-none"
                          title="Barcha to'langan summalarni ko'rish"
                        >
                          <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-1 flex items-center justify-between">
                            <span>Jami to'langan</span>
                            <span className="text-[8px] opacity-75">{showHistory ? '▲ yopish' : '▼ ko\'rish'}</span>
                          </p>
                          <p className="text-[14px] font-[900] text-emerald-700">{displayPaid.toLocaleString()} so'm</p>
                        </div>
                        <div className="p-3 rounded-2xl bg-amber-50 border border-amber-100">
                          <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-1">Hozirgi qarz</p>
                          <p className={`text-[14px] font-[900] ${displayDebt > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                            {displayDebt > 0 ? `${displayDebt.toLocaleString()} so'm` : "Qarz yo'q"}
                          </p>
                        </div>
                        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Telefon</p>
                          <p className="text-[13px] font-[900] text-slate-700 break-words">{pat?.phone ? formatPhone(pat.phone) : 'Kiritilmagan'}</p>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {showHistory && pat && (
                  <div className="rounded-[1.5rem] border border-slate-200 overflow-hidden bg-slate-50 p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        To'lovlar tarixi
                      </h4>
                      {loadingHistory && <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Yuklanmoqda...</span>}
                    </div>
                    {patientPaymentsHistory.length === 0 ? (
                      <p className="text-xs text-slate-400 font-bold italic py-2">To'lovlar topilmadi</p>
                    ) : (
                      <div className="max-h-[180px] overflow-y-auto space-y-2 pr-1 no-scrollbar">
                        {patientPaymentsHistory.map((p, idx) => {
                          const pAmt = Number(p.amount) || 0;
                          const pType = p.type || 'Income';
                          const pMethod = getPaymentMethodLabel(p.method);
                          const pDate = p.created_date || p.created_at || p.date;
                          const pDateFormatted = pDate ? new Date(pDate).toLocaleDateString('uz-UZ') : '—';
                          const pTimeFormatted = pDate ? new Date(pDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                          const isExpense = pType === 'Expense';

                          return (
                            <div key={p.id || idx} className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-100 shadow-sm text-xs">
                              <div>
                                <p className="font-[800] text-slate-800">
                                  {pMethod}
                                </p>
                                <p className="text-[9px] text-slate-400 font-bold mt-0.5">
                                  Sana: {pDateFormatted} {pTimeFormatted}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className={`font-black ${isExpense ? 'text-rose-600' : 'text-emerald-600'}`}>
                                  {isExpense ? '-' : '+'}{pAmt.toLocaleString()} so'm
                                </p>
                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                                  {getPaymentTypeLabel(pType)}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Izoh */}
                {sp.notes && (
                  <div className="p-4 bg-blue-50 rounded-[1.5rem] border border-blue-100">
                    <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-1 flex items-center gap-1"><FileText className="w-3 h-3" />Izoh / Reja</p>
                    <p className="text-[12px] font-bold text-blue-800 whitespace-pre-wrap break-words">{sp.notes}</p>
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-1">
                  <button
                    onClick={() => { handleDelete(sp.id, sp.patient_id); setSelectedPayment(null); }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-rose-500 hover:bg-rose-50 text-[10px] font-black uppercase tracking-widest transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />O'chirish
                  </button>
                  <button
                    onClick={() => setSelectedPayment(null)}
                    className="px-5 py-2 rounded-xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest"
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
                    <h3 className="text-base font-[900] text-slate-900">DentaCRM Klinikasi</h3>
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
    </div>
  );
}
