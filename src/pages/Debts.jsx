import { useState, useEffect, useMemo, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { sendTelegramMessage } from '@/api/telegramBot';
import { useTranslation } from '@/i18n/LanguageContext';
import { 
  Wallet, Search, User, Phone, 
  MessageSquare, ChevronRight,
  TrendingDown, CreditCard,
  Copy, Check,
  AlertCircle, X,
  Receipt,
  Stethoscope,
  Table as TableIcon, LayoutGrid, FileSpreadsheet,
  ArrowUp, ArrowDown, ArrowUpDown, FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import TreatmentPlanInvoice from '@/components/treatments/TreatmentPlanInvoice';
import { motion } from 'framer-motion';
import { formatPhone, cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';

const formatMoney = (val) => Number(val || 0).toLocaleString('uz-UZ') + " UZS";

/**
 * Debts Page - Professional Excel Spreadsheet View
 */
export default function Debts() {
  const { t, language } = useTranslation();
  const { user, isDoctor } = useAuth();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilterTab, setActiveFilterTab] = useState('all'); // all, large, medium, small, telegram
  const [copiedId, setCopiedId] = useState(null);
  const navigate = useNavigate();

  // Density switcher with localStorage
  const [density, setDensity] = useState(() => {
    return localStorage.getItem('myclinic_debts_density') || 'compact';
  });
  const toggleDensity = (val) => {
    setDensity(val);
    localStorage.setItem('myclinic_debts_density', val);
  };

  // Sorting state
  const [sortField, setSortField] = useState('debt');
  const [sortOrder, setSortOrder] = useState('desc');

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Debt & Treatment Plan detail modal state
  const [selectedDebtPatient, setSelectedDebtPatient] = useState(null);
  const [patientDetailData, setPatientDetailData] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailPlans, setDetailPlans] = useState([]);
  const [detailHistory, setDetailHistory] = useState([]);
  const [showDetailHistory, setShowDetailHistory] = useState(false);
  const [selectedPlanForInvoice, setSelectedPlanForInvoice] = useState(null);
  const [showPlanInvoiceModal, setShowPlanInvoiceModal] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [allPatientsRaw, allPayments] = await Promise.all([
          base44.entities.Patient.list('-created_date', 200),
          base44.entities.Payment.list('-created_date', 500),
        ]);

        const allPatients = isDoctor && user?.id
          ? (allPatientsRaw || []).filter(p =>
              p.main_treatment_provider === user.id ||
              p.main_treatment_provider === user.name ||
              String(p.created_by_id) === String(user.id)
            )
          : (allPatientsRaw || []);

        const debtMap = {};
        for (const pay of allPayments) {
          const pid = pay.patient_id;
          if (!pid) continue;
          if (!debtMap[pid]) debtMap[pid] = { debt: 0, paid: 0, refund: 0, discount: 0, last_date: pay.created_date || pay.created_at || pay.date };
          const type = (pay.type || '').toLowerCase();
          if (type === 'debt') {
              debtMap[pid].debt += (pay.amount || 0);
              const dt = pay.created_date || pay.created_at || pay.date;
              if (dt && new Date(dt) > new Date(debtMap[pid].last_date)) {
                  debtMap[pid].last_date = dt;
              }
          }
          if (type === 'income') debtMap[pid].paid += (pay.amount || 0);
          if (type === 'refund') debtMap[pid].refund += (pay.amount || 0);
          if (type === 'discount') debtMap[pid].discount += Math.abs(pay.amount || 0);
        }

        const enriched = allPatients
          .map(p => {
            const d = debtMap[p.id];
            const realDebt = p.total_debt || 0;
            const realPaid = p.total_paid || 0;
            return { ...p, real_debt: realDebt, real_paid: realPaid, last_update: d?.last_date };
          })
          .filter(p => p.real_debt > 0)
          .sort((a, b) => b.real_debt - a.real_debt);

        setPatients(enriched);
      } catch (err) {
        console.error(err);
        toast.error(t('common.error') || "Xatolik yuz berdi");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [isDoctor, user, t]);

  const totalDebt = useMemo(() => {
    return patients.reduce((s, p) => s + (p.real_debt || 0), 0);
  }, [patients]);

  const totalPaid = useMemo(() => {
    return patients.reduce((s, p) => s + (p.real_paid || 0), 0);
  }, [patients]);

  const largeDebtsCount = useMemo(() => {
    return patients.filter(p => p.real_debt >= 5000000).length;
  }, [patients]);

  const mediumDebtsCount = useMemo(() => {
    return patients.filter(p => p.real_debt >= 1000000 && p.real_debt < 5000000).length;
  }, [patients]);

  const smallDebtsCount = useMemo(() => {
    return patients.filter(p => p.real_debt < 1000000).length;
  }, [patients]);

  const telegramConnectedCount = useMemo(() => {
    return patients.filter(p => !!p.telegram_chat_id).length;
  }, [patients]);

  // Filtered debtors
  const filteredPatients = useMemo(() => {
    return patients.filter(p => {
      // Tab filter
      if (activeFilterTab === 'large' && p.real_debt < 5000000) return false;
      if (activeFilterTab === 'medium' && (p.real_debt < 1000000 || p.real_debt >= 5000000)) return false;
      if (activeFilterTab === 'small' && p.real_debt >= 1000000) return false;
      if (activeFilterTab === 'telegram' && !p.telegram_chat_id) return false;

      // Search filter
      const q = search.toLowerCase();
      if (!q) return true;

      const name = (p.full_name || '').toLowerCase();
      const phone = (p.phone || '').toLowerCase();
      const doc = (p.main_treatment_provider || '').toLowerCase();

      return name.includes(q) || phone.includes(q) || doc.includes(q);
    });
  }, [patients, activeFilterTab, search]);

  // Sorted debtors
  const sortedPatients = useMemo(() => {
    const list = [...filteredPatients];
    list.sort((a, b) => {
      let valA, valB;
      const shareA = (a.real_paid / (a.real_debt + a.real_paid)) * 100 || 0;
      const shareB = (b.real_paid / (b.real_debt + b.real_paid)) * 100 || 0;

      switch (sortField) {
        case 'patient':
          valA = (a.full_name || '').toLowerCase();
          valB = (b.full_name || '').toLowerCase();
          return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        case 'paid':
          valA = Number(a.real_paid || 0);
          valB = Number(b.real_paid || 0);
          return sortOrder === 'asc' ? valA - valB : valB - valA;
        case 'share':
          return sortOrder === 'asc' ? shareA - shareB : shareB - shareA;
        case 'date':
          valA = new Date(a.last_update || 0).getTime();
          valB = new Date(b.last_update || 0).getTime();
          return sortOrder === 'asc' ? valA - valB : valB - valA;
        case 'debt':
        default:
          valA = Number(a.real_debt || 0);
          valB = Number(b.real_debt || 0);
          return sortOrder === 'asc' ? valA - valB : valB - valA;
      }
    });
    return list;
  }, [filteredPatients, sortField, sortOrder]);

  const filteredTotalDebt = useMemo(() => {
    return sortedPatients.reduce((s, p) => s + (p.real_debt || 0), 0);
  }, [sortedPatients]);

  const filteredTotalPaid = useMemo(() => {
    return sortedPatients.reduce((s, p) => s + (p.real_paid || 0), 0);
  }, [sortedPatients]);

  const handleCall = (phone) => {
    if (phone) window.location.href = `tel:${phone}`;
    else toast.error("Telefon raqami kiritilmagan");
  };

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Nusxalandi!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSendReminder = async (patient) => {
    if (!patient.telegram_chat_id) {
      toast.error("Bemor Telegramga ulanmagan. Birinchi bo'lib uni botga ulang.");
      return;
    }

    const tId = toast.loading("Xabarnoma yuborilmoqda...");
    try {
      const clinics = await base44.clinic.getAll();
      const clinic = clinics.find(c => c.id === patient.clinic_id);
      
      const botConfigs = await base44.entities.BotConfig.list();
      const config = botConfigs.find(bc => bc.clinic_id === patient.clinic_id && bc.isActive);

      if (!config?.botToken) {
        throw new Error("Telegram bot sozlanmagan");
      }

      const debt = formatMoney(patient.real_debt);
      const message = 
        `📢 <b>HURMATLI MIJOZ, ASSALOMU ALAYKUM!</b>\n\n` +
        `<b>${clinic?.name || 'Klinikamiz'}</b> dan moliyaviy eslatma.\n\n` +
        `Sizning joriy qarzdorligingiz: <b>${debt}</b>\n\n` +
        `Iltimos, to'lovni amalga oshirishni unutmang. Biz sizga xizmat ko'rsatishdan mamnunmiz! 🦷✨`;

      await sendTelegramMessage(config.botToken, patient.telegram_chat_id, message);
      toast.success("Eslatma muvaffaqiyatli yuborildi!", { id: tId });
    } catch (err) {
      console.error(err);
      toast.error("Xatolik: " + err.message, { id: tId });
    }
  };

  const openPatientDebtDetail = async (patient) => {
    if (!patient) return;
    setSelectedDebtPatient(patient);
    setLoadingDetail(true);
    setPatientDetailData(null);
    setShowDetailHistory(false);
    try {
      const [allPays, allPlans, allDoctors] = await Promise.all([
        base44.entities.Payment.filter({ patient_id: patient.id }, 'date', 5000).catch(() => []),
        base44.entities.TreatmentPlan.filter({ patient_id: patient.id }, '-created_date', 100).catch(() => []),
        base44.entities.User.filter({ role: 'doctor' }, 'name').catch(() => [])
      ]);

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

      let originalPrice = 0;
      let finalPlanTotal = 0;
      let discountAmount = 0;
      let discountPercent = 0;

      if (plansList.length > 0) {
        originalPrice = plansList.reduce((sum, pl) => sum + getPlanOriginalPrice(pl), 0);
        finalPlanTotal = plansList.reduce((sum, pl) => sum + (Number(pl.total_price) || getPlanOriginalPrice(pl)), 0);
        discountAmount = Math.max(0, originalPrice - finalPlanTotal);
        if (discountAmount === 0) {
          discountAmount = plansList.reduce((sum, pl) => sum + (Number(pl.discount_amount) || 0), 0);
          if (discountAmount > 0) originalPrice = finalPlanTotal + discountAmount;
        }
        discountPercent = originalPrice > 0 ? Math.round((discountAmount / originalPrice) * 100) : (plansList[0]?.discount_percent || 0);
      } else {
        const totalDebts = paysList.filter(pay => pay.type?.toLowerCase() === 'debt').reduce((s, pay) => s + (Number(pay.amount) || 0), 0);
        const totalDiscountPayments = paysList.filter(pay => pay.type?.toLowerCase() === 'discount').reduce((s, pay) => s + Math.abs(Number(pay.amount) || 0), 0);
        originalPrice = totalDebts > 0 ? totalDebts + totalDiscountPayments : (Number(patient.real_debt || patient.total_debt) || 0);
        discountAmount = totalDiscountPayments;
        finalPlanTotal = Math.max(0, originalPrice - discountAmount);
        discountPercent = originalPrice > 0 ? Math.round((discountAmount / originalPrice) * 100) : 0;
      }

      const totalIncomes = paysList.filter(pay => pay.type?.toLowerCase() === 'income').reduce((s, pay) => s + (Number(pay.amount) || 0), 0);
      const totalRefunds = paysList.filter(pay => pay.type?.toLowerCase() === 'refund').reduce((s, pay) => s + (Number(pay.amount) || 0), 0);
      const totalPlansPrice = plansList.reduce((sum, pl) => sum + (Number(pl.total_price) || 0), 0);

      let currentDebt = 0;
      if (totalPlansPrice > 0) {
        const net = totalIncomes - totalPlansPrice - totalRefunds;
        currentDebt = net < 0 ? Math.abs(net) : 0;
      } else {
        const totalDebts = paysList.filter(pay => pay.type?.toLowerCase() === 'debt').reduce((s, pay) => s + (Number(pay.amount) || 0), 0);
        const net = totalIncomes + discountAmount - totalDebts - totalRefunds;
        currentDebt = net < 0 ? Math.abs(net) : (patient.real_debt || patient.total_debt || 0);
      }

      const actualHistory = (paysList || []).filter(pay => {
        const notesLower = (pay.notes || '').toLowerCase();
        const pType = (pay.type || '').toLowerCase();
        const isInternalNote = (pType === 'debt' || pType === 'discount') && 
          (pay.plan_id || notesLower.includes('linked to plan') || notesLower.includes('reja:') || notesLower.includes('avtomatik chegirma'));
        return !isInternalNote;
      }).sort((a, b) => {
        const ta = a.created_date || a.created_at || a.date || '';
        const tb = b.created_date || b.created_at || b.date || '';
        return tb.localeCompare(ta);
      });

      const assignedDoctor = (allDoctors || []).find(d => d.id === patient.main_treatment_provider || d.name === patient.main_treatment_provider || d.id === patient.doctor_id);

      const enrichedPlans = plansList.map(plan => {
        const planTotal = Number(plan.total_price) || 0;
        const directPays = paysList.filter(p => {
          const isIncome = (p.type || '').toLowerCase() === 'income';
          if (!isIncome) return false;
          if (p.plan_id && p.plan_id === plan.id) return true;
          const notes = (p.notes || '').toLowerCase();
          const sName = (p.service_name || '').toLowerCase();
          const pName = (plan.name || '').toLowerCase();
          return (pName && (notes.includes(pName) || sName.includes(pName)));
        });
        const directPaidSum = directPays.reduce((s, p) => s + (Number(p.amount) || 0), 0);
        let calculatedPaid = directPaidSum;
        if (plansList.length === 1) {
          calculatedPaid = Math.max(calculatedPaid, totalIncomes);
        } else {
          calculatedPaid = Math.max(calculatedPaid, Number(plan.paid_amount) || 0);
        }
        const effectivePaid = Math.min(planTotal > 0 ? planTotal : calculatedPaid, calculatedPaid);
        return {
          ...plan,
          paid_amount: effectivePaid
        };
      });

      setDetailPlans(enrichedPlans);
      setDetailHistory(actualHistory);
      setPatientDetailData({
        patient,
        doctor: assignedDoctor,
        originalPrice,
        finalPlanTotal,
        totalDiscount: discountAmount,
        discountPercent,
        totalPaid: totalIncomes,
        currentDebt: currentDebt > 0 ? currentDebt : (patient.real_debt || patient.total_debt || 0),
      });
    } catch (err) {
      console.error('Error fetching patient debt details:', err);
      toast.error("Ma'lumotlarni yuklashda xatolik yuz berdi");
    } finally {
      setLoadingDetail(false);
    }
  };

  const handlePayDebt = (patient) => {
    if (!patient) return;
    navigate('/payments', {
      state: {
        openAddModal: true,
        prefillPatient: patient.id,
        prefillPatientName: patient.full_name,
        prefillAmount: patient.real_debt || patient.total_debt || 0,
        prefillDoctor: patient.main_treatment_provider || '',
        prefillCategory: "Qarzdorlik to'lovi"
      }
    });
  };

  /**
   * Export to CSV with UTF-8 BOM
   */
  const exportCSV = useCallback(() => {
    try {
      if (!sortedPatients || sortedPatients.length === 0) {
        toast.warning("Eksport qilish uchun ma'lumot topilmadi");
        return;
      }
      const headers = [
        "№",
        "Bemor (F.I.Sh)",
        "Telefon Raqami",
        "Qarz Miqdori (UZS)",
        "To'langan Summa (UZS)",
        "To'lov Ulushi (%)",
        "Aloqa Holati (Telegram)",
        "Oxirgi Amal Sanasi"
      ];
      const rows = sortedPatients.map((p, idx) => {
        const share = Math.round((p.real_paid / (p.real_debt + p.real_paid)) * 100 || 0);
        const tg = p.telegram_chat_id ? (language === 'ru' ? 'Telegram активен' : 'Telegram faol') : (language === 'ru' ? 'Нет Telegram' : "Telegram yo'q");
        const dateStr = p.last_update ? new Date(p.last_update).toLocaleDateString('uz-UZ') : '—';

        return [
          idx + 1,
          `"${(p.full_name || '').replace(/"/g, '""')}"`,
          `"${(p.phone || '').replace(/"/g, '""')}"`,
          Number(p.real_debt || 0),
          Number(p.real_paid || 0),
          `${share}%`,
          `"${tg}"`,
          `"${dateStr}"`
        ].join(",");
      });

      const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `Qarzdorliklar_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Qarzdorliklar Excel (.csv) formatida yuklab olindi!");
    } catch (err) {
      console.error(err);
      toast.error("Eksportda xatolik yuz berdi");
    }
  }, [sortedPatients]);

  return (
    <div className="space-y-3.5 pb-4">
      {/* ─── Excel Header Bar ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900 tracking-tight">{t('debts.title') || "Qarzdorliklar Paneli"}</h1>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
              {language === 'ru' ? `• КОНТРОЛЬ ДЕБИТОРОВ: ${patients.length} ПАЦИЕНТОВ` : language === 'en' ? `• DEBTOR CONTROL: ${patients.length} PATIENTS` : `• Debitorlar Nazorati ${patients.length} Bemorlar`}
            </span>
          </div>
          <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
            {t('debts.subtitle') || (language === 'ru' ? 'Все пациенты-должники, доли оплаты и контроль финансового баланса' : 'Barcha qarzdor bemorlar, to\'lov ulushlari va moliyaviy balans nazorati')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          

          <Button 
            onClick={() => navigate('/payments')} 
            className="bg-slate-900 hover:bg-slate-800 text-white gap-1.5 border-none rounded-xl h-9.5 px-4 font-black text-xs shadow-md transition-all active:scale-95"
          >
            <CreditCard className="w-4 h-4 text-emerald-400" />
            <span>{language === 'ru' ? 'Раздел платежей' : language === 'en' ? 'Payments Section' : 'To\'lovlar Bo\'limi'}</span>
          </Button>
        </div>
      </div>

      {/* ─── Top Executive KPI Grid ─────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { 
            label: language === 'ru' ? "ОБЩАЯ ЗАДОЛЖЕННОСТЬ" : language === 'en' ? "TOTAL DEBT" : "UMUMIY QARZDORLIK", 
            value: totalDebt, 
            icon: AlertCircle, 
            color: "text-rose-600", 
            bg: "bg-rose-50 border-rose-100", 
            isCurrency: true, 
            countText: language === 'ru' ? "К выплате в клинику" : language === 'en' ? "Due to clinic" : "Klinikaga to'lanishi kerak" 
          },
          { 
            label: language === 'ru' ? "ПАЦИЕНТЫ С ДОЛГОМ" : language === 'en' ? "DEBTOR PATIENTS" : "QARZDOR BEMORLAR", 
            value: patients.length, 
            icon: User, 
            color: "text-blue-600", 
            bg: "bg-blue-50 border-blue-100", 
            isCurrency: false, 
            countText: language === 'ru' ? "Количество активных дебиторов" : language === 'en' ? "Active debtors count" : "Faol debitorlar soni" 
          },
          { 
            label: language === 'ru' ? "КРУПНЫЕ ДОЛЖНИКИ (>5M)" : language === 'en' ? "LARGE DEBTORS (>5M)" : "YIRIK QARZDORLAR (>5M)", 
            value: largeDebtsCount, 
            icon: TrendingDown, 
            color: "text-amber-600", 
            bg: "bg-amber-50 border-amber-100", 
            isCurrency: false, 
            countText: language === 'ru' ? "Долги, требующие внимания" : language === 'en' ? "High priority debts" : "Diqqat talab qarzlar" 
          },
          { 
            label: language === 'ru' ? "ВСЕГО ОПЛАЧЕНО" : language === 'en' ? "TOTAL PAID SHARE" : "JAMI TO'LANGAN ULUSH", 
            value: totalPaid, 
            icon: Wallet, 
            color: "text-emerald-600", 
            bg: "bg-emerald-50 border-emerald-100", 
            isCurrency: true, 
            countText: language === 'ru' ? "Сумма, оплаченная этими пациентами" : language === 'en' ? "Total amount paid by debtors" : "Ushbu bemorlar to'lagan summa" 
          },
        ].map((s, i) => (
          <motion.div 
            key={s.label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.03 }}
            className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-xs flex items-center justify-between relative overflow-hidden"
          >
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">
                {s.label}
              </span>
              <div className="text-lg sm:text-xl font-black font-mono tracking-tight text-slate-900 tabular-nums">
                {s.isCurrency ? (
                  <span>{Number(s.value).toLocaleString()} <span className="text-[10px] font-bold text-slate-400">UZS</span></span>
                ) : (
                  <span>{s.value} <span className="text-xs font-bold text-slate-400">{language === 'ru' ? '' : 'nafar'}</span></span>
                )}
              </div>
              <p className="text-[9.5px] font-medium text-slate-400 mt-0.5">{s.countText}</p>
            </div>

            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-xs shrink-0 ${s.bg}`}>
              <s.icon className={`w-5 h-5 ${s.color}`} />
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
              placeholder={t('debts.searchPlaceholder') || (language === 'ru' ? "Поиск по имени пациента, номеру телефона или врачу..." : "Bemor ismi, telefon raqami yoki shifokor bo'yicha qidiruv...")}
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

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
            {[
              { id: 'all', label: language === 'ru' ? "Все" : language === 'en' ? "All" : "Barchasi", count: patients.length },
              { id: 'large', label: language === 'ru' ? "> 5 млн UZS" : "> 5M UZS", count: largeDebtsCount },
              { id: 'medium', label: language === 'ru' ? "1 - 5 млн UZS" : "1M - 5M UZS", count: mediumDebtsCount },
              { id: 'small', label: language === 'ru' ? "< 1 млн UZS" : "< 1M UZS", count: smallDebtsCount },
              { id: 'telegram', label: language === 'ru' ? "Есть Telegram" : language === 'en' ? "Has Telegram" : "Telegram bor", count: telegramConnectedCount },
            ].map(tab => {
              const isActive = activeFilterTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveFilterTab(tab.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer",
                    isActive 
                      ? "bg-slate-900 text-white shadow-xs font-black" 
                      : "bg-slate-100/70 text-slate-600 hover:bg-slate-200/60 hover:text-slate-900"
                  )}
                >
                  <span>{tab.label}</span>
                  <span className={cn(
                    "px-1.5 py-0.2 rounded-full text-[9px] font-black",
                    isActive ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"
                  )}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

        </div>
      </div>

      {/* ─── Main Excel Spreadsheet Data Grid Table ──────────────────── */}
      {/* Columns: № | BEMOR (F.I.SH) | QARZ MIQDORI | TO'LANGAN SUMMA | TO'LOV ULUSHI (%) | ALOQA HOLATI | AMALLAR */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden relative"
      >
        {loading && (
          <div className="absolute inset-x-0 top-0 h-0.5 bg-slate-100 overflow-hidden z-20">
            <motion.div 
              className="h-full bg-gradient-to-r from-rose-500 to-amber-500"
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
                <th className="w-12 px-2.5 py-2.5 text-center border-r border-slate-200 select-none font-mono">
                  №
                </th>

                {/* BEMOR (F.I.SH) */}
                <th 
                  onClick={() => handleSort('patient')}
                  className="px-3.5 py-2.5 border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors select-none min-w-[200px]"
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span>{t('debts.patientCol') || (language === 'ru' ? 'Пациент (Ф.И.О)' : 'Bemor (F.I.Sh)')}</span>
                    {sortField === 'patient' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#1499AD]" /> : <ArrowDown className="w-3 h-3 text-[#1499AD]" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-30" />
                    )}
                  </div>
                </th>

                {/* QARZ MIQDORI */}
                <th 
                  onClick={() => handleSort('debt')}
                  className="w-48 px-3.5 py-2.5 text-right border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors bg-amber-50/40 select-none whitespace-nowrap"
                  title="Qarz miqdori bo'yicha saralash"
                >
                  <div className="flex items-center justify-end gap-1.5 text-amber-900 font-mono">
                    <span>{t('debts.debtCol') || (language === 'ru' ? 'Сумма долга' : 'Qarz Miqdori')}</span>
                    {sortField === 'debt' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-amber-600" /> : <ArrowDown className="w-3 h-3 text-amber-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>

                {/* TO'LANGAN SUMMA */}
                <th 
                  onClick={() => handleSort('paid')}
                  className="w-44 px-3.5 py-2.5 text-right border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors bg-emerald-50/40 select-none whitespace-nowrap"
                  title="To'langan summa bo'yicha saralash"
                >
                  <div className="flex items-center justify-end gap-1.5 text-emerald-700 font-mono">
                    <span>{t('debts.paidCol') || (language === 'ru' ? 'Оплачено' : 'To\'langan')}</span>
                    {sortField === 'paid' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-emerald-600" /> : <ArrowDown className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>

                {/* TO'LOV ULUSHI */}
                <th 
                  onClick={() => handleSort('share')}
                  className="w-44 px-3.5 py-2.5 border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors select-none whitespace-nowrap"
                >
                  <div className="flex items-center justify-between gap-1.5 text-slate-700 font-mono">
                    <span>{t('debts.shareCol') || (language === 'ru' ? 'Доля оплаты' : 'To\'lov Ulushi')}</span>
                    {sortField === 'share' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-30" />
                    )}
                  </div>
                </th>

                {/* ALOQA HOLATI */}
                <th className="w-36 px-3 py-2.5 text-center border-r border-slate-200 select-none whitespace-nowrap">
                  {t('debts.contactCol') || (language === 'ru' ? 'Статус связи' : 'Aloqa Holati')}
                </th>

                {/* Actions */}
                <th className="w-40 px-2 py-2.5 text-center text-slate-500 whitespace-nowrap select-none">
                  {t('common.actions') || "Amallar"}
                </th>

              </tr>
            </thead>

            {/* ─── Excel Table Body ────────────────── */}
            <tbody className="divide-y divide-slate-200/70 text-xs">
              {sortedPatients.length > 0 ? (
                sortedPatients.map((p, idx) => {
                  const isCompact = density === 'compact';
                  const share = Math.round((p.real_paid / (p.real_debt + p.real_paid)) * 100 || 0);
                  const isLargeDebt = p.real_debt >= 5000000;

                  return (
                    <tr 
                      key={p.id} 
                      className={`group hover:bg-[#1499AD]/10 hover:shadow-xs transition-colors cursor-pointer ${
                        idx % 2 === 1 ? 'bg-slate-50/30' : 'bg-white'
                      }`}
                      onClick={() => openPatientDebtDetail(p)}
                    >
                      {/* № Cell */}
                      <td className={`text-center font-mono font-bold text-slate-400 border-r border-slate-200/70 whitespace-nowrap ${isCompact ? 'py-2 px-2' : 'py-3 px-2.5'}`}>
                        {idx + 1}
                      </td>

                      {/* BEMOR (F.I.SH) Cell */}
                      <td className={`border-r border-slate-200/70 ${isCompact ? 'py-1.5 px-3' : 'py-2.5 px-3.5'}`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={cn(
                            "w-6.5 h-6.5 rounded-lg font-black text-[10px] flex items-center justify-center border shrink-0",
                            isLargeDebt ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-blue-50 text-blue-700 border-blue-100"
                          )}>
                            <User className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <span 
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/patients/${p.id}`);
                              }}
                              className="font-extrabold text-slate-900 hover:text-blue-600 transition-colors truncate block hover:underline"
                            >
                              {p.full_name}
                            </span>
                            <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400">
                              <span>{p.phone ? formatPhone(p.phone) : (language === 'ru' ? 'Нет телефона' : 'Telefon yo\'q')}</span>
                              {p.phone && (
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleCopy(p.phone, p.id); }}
                                  className="text-slate-350 hover:text-slate-900 p-0.5"
                                  title="Raqamni nusxalash"
                                >
                                  {copiedId === p.id ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-2.5 h-2.5" />}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* QARZ MIQDORI Cell */}
                      <td className={`text-right border-r border-slate-200/70 whitespace-nowrap bg-amber-50/20 ${isCompact ? 'py-1.5 px-3' : 'py-2.5 px-3.5'}`}>
                        <span className={cn(
                          "font-mono font-black text-xs tabular-nums",
                          isLargeDebt ? "text-amber-950 font-extrabold" : "text-slate-900"
                        )}>
                          {Number(p.real_debt || 0).toLocaleString()}
                          <span className="text-[9.5px] font-semibold text-amber-700 ml-1">UZS</span>
                        </span>
                      </td>

                      {/* TO'LANGAN SUMMA Cell */}
                      <td className={`text-right border-r border-slate-200/70 whitespace-nowrap bg-emerald-50/20 ${isCompact ? 'py-1.5 px-3' : 'py-2.5 px-3.5'}`}>
                        <span className="font-mono font-bold text-emerald-600 text-xs tabular-nums">
                          {Number(p.real_paid || 0).toLocaleString()}
                          <span className="text-[9.5px] font-semibold text-emerald-500 ml-1">UZS</span>
                        </span>
                      </td>

                      {/* TO'LOV ULUSHI Cell */}
                      <td className={`border-r border-slate-200/70 ${isCompact ? 'py-1.5 px-3' : 'py-2.5 px-3.5'}`}>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10.5px] font-mono">
                            <span className="text-slate-500 font-semibold">{language === 'ru' ? 'Оплачено:' : 'Yopildi:'}</span>
                            <span className="font-bold text-slate-800">{share}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-200/80 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(100, share)}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* ALOQA HOLATI Cell */}
                      <td className={`text-center border-r border-slate-200/70 whitespace-nowrap ${isCompact ? 'py-1.5 px-2' : 'py-2.5 px-2.5'}`}>
                        {p.telegram_chat_id ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 border border-blue-100 text-[10px] font-bold text-blue-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                            Telegram faol
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-semibold text-slate-400">
                            {language === 'ru' ? 'Нет Telegram' : 'Telegram yo\'q'}
                          </span>
                        )}
                      </td>

                      {/* Actions Cell */}
                      <td className={`text-center whitespace-nowrap ${isCompact ? 'py-1 px-1.5' : 'py-2 px-2'}`} onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <button 
                            onClick={() => handlePayDebt(p)}
                            className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-all cursor-pointer"
                            title={language === 'ru' ? 'Принять платёж' : "To'lov qabul qilish"}
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                          </button>

                          {p.phone && (
                            <button 
                              onClick={() => handleCall(p.phone)}
                              className="p-1.5 rounded-lg text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 transition-all cursor-pointer"
                              title={language === 'ru' ? 'Позвонить' : "Qo'ng'iroq qilish"}
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button 
                            onClick={() => handleSendReminder(p)}
                            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-all cursor-pointer"
                            title={language === 'ru' ? 'Отправить напоминание в Telegram' : "Telegram orqali eslatma yuborish"}
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>

                          <button 
                            onClick={() => openPatientDebtDetail(p)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-[#1499AD] hover:bg-[#1499AD]/10 transition-all cursor-pointer"
                            title={language === 'ru' ? 'План лечения и детали долга' : "Davolash rejasi va qarz tafsilotlari"}
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300">
                        <Wallet className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-bold text-slate-500">
                        {search ? `"${search}" bo'yicha qarzdor bemor topilmadi` : "Ayni damda qarzdor bemorlar mavjud emas"}
                      </p>
                      {(search || activeFilterTab !== 'all') && (
                        <button
                          onClick={() => { setSearch(''); setActiveFilterTab('all'); }}
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

      {/* ─── Treatment Plan & Debt Detail Dialog ─────────────────────── */}
      <Dialog open={!!selectedDebtPatient} onOpenChange={(open) => !open && setSelectedDebtPatient(null)}>
        {selectedDebtPatient && (
          <DialogContent className="w-[95vw] max-w-3xl p-0 overflow-hidden rounded-[2rem] border-none shadow-2xl [&>button]:hidden">
            {/* Header */}
            <div className="bg-slate-900 px-6 py-5 text-white relative">
              <button 
                onClick={() => setSelectedDebtPatient(null)} 
                className="absolute right-4 top-4 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 active:scale-95 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              <p className="text-[9px] font-black text-white/60 uppercase tracking-[0.3em] mb-1">
                {language === 'ru' ? 'ПЛАНЫ ЛЕЧЕНИЯ И ДЕТАЛИ ЗАДОЛЖЕННОСТИ' : 'Davolash Rejalari & Qarz Tafsilotlari'}
              </p>
              <h2 className="text-2xl sm:text-3xl font-[900] tracking-tight">
                {selectedDebtPatient.full_name}
              </h2>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase bg-rose-500/20 text-white border border-rose-300/30">
                  {language === 'ru' ? 'Остаток долга: ' : 'Qolgan qarz: '}{formatMoney(patientDetailData?.currentDebt ?? selectedDebtPatient.real_debt)}
                </span>
                {patientDetailData?.totalPaid > 0 && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-white border border-emerald-300/30">
                    {language === 'ru' ? 'Оплачено: ' : 'To\'langan: '}{formatMoney(patientDetailData.totalPaid)}
                  </span>
                )}
                {detailPlans.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-white/80 bg-white/10 px-2.5 py-0.5 rounded-full">
                    <Receipt className="w-3 h-3" /> {detailPlans.length} {language === 'ru' ? 'планов' : 'ta reja'}
                  </span>
                )}
              </div>
            </div>

            {/* Body */}
            <div className="p-5 sm:p-6 bg-white space-y-4 max-h-[80vh] overflow-y-auto no-scrollbar">
              {loadingDetail ? (
                <div className="py-16 text-center space-y-3">
                  <div className="w-8 h-8 border-3 border-[#1499AD] border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{language === 'ru' ? 'Загрузка планов лечения...' : 'Davolash rejalari yuklanmoqda...'}</p>
                </div>
              ) : (
                <>
                  {/* Bemor va Shifokor Karti */}
                  <div className="rounded-[1.5rem] border border-slate-200 overflow-hidden">
                    <div className="px-4 sm:px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                      <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-[0.18em] flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-[#1499AD]" />
                        {language === 'ru' ? 'Информация о пациенте и враче' : 'Bemor va shifokor ma\'lumotlari'}
                      </h3>
                      {selectedDebtPatient.telegram_chat_id ? (
                        <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                          Telegram faol ✓
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                          Telegram yo'q
                        </span>
                      )}
                    </div>
                    <div className="divide-y divide-slate-100">
                      <div className="grid grid-cols-[110px_1fr] gap-3 px-4 sm:px-5 py-3">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('debts.table.patient') || "Bemor"}</span>
                        <div className="min-w-0">
                          <p className="text-[13px] sm:text-[14px] font-[900] text-slate-900 break-words">{selectedDebtPatient.full_name}</p>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                            <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                              <Phone className="w-3 h-3 text-emerald-500" />
                              {selectedDebtPatient.phone ? formatPhone(selectedDebtPatient.phone) : 'Telefon kiritilmagan'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-[110px_1fr] gap-3 px-4 sm:px-5 py-3">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{language === 'ru' ? 'Врач' : 'Shifokor'}</span>
                        <p className="text-[13px] sm:text-[14px] font-[900] text-slate-800 break-words flex items-center gap-1.5">
                          <Stethoscope className="w-3.5 h-3.5 text-blue-500" />
                          {patientDetailData?.doctor?.name || patientDetailData?.doctor?.full_name || selectedDebtPatient.main_treatment_provider || (language === 'ru' ? 'Не назначен' : 'Biriktirilmagan')}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Moliyaviy Xulosa */}
                  {patientDetailData && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 text-center">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">{language === 'ru' ? 'Стоимость планов' : 'Rejalar qiymati'}</span>
                        <span className="text-xs sm:text-sm font-black text-slate-800 font-mono block">
                          {formatMoney(patientDetailData.originalPrice || patientDetailData.finalPlanTotal)}
                        </span>
                      </div>
                      <div className="bg-purple-50 border border-purple-100 rounded-2xl p-3 text-center">
                        <span className="text-[9px] font-black text-purple-500 uppercase tracking-wider block mb-1">{language === 'ru' ? 'Скидка' : 'Chegirma'}</span>
                        <span className="text-xs sm:text-sm font-black text-purple-700 font-mono block">
                          {patientDetailData.totalDiscount > 0 ? `-${formatMoney(patientDetailData.totalDiscount)} (${patientDetailData.discountPercent}%)` : "—"}
                        </span>
                      </div>
                      <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3 text-center">
                        <span className="text-[9px] font-black text-emerald-600 uppercase tracking-wider block mb-1">To'langan</span>
                        <span className="text-xs sm:text-sm font-black text-emerald-700 font-mono block">
                          {formatMoney(patientDetailData.totalPaid)}
                        </span>
                      </div>
                      <div className="bg-rose-50 border border-rose-100 rounded-2xl p-3 text-center">
                        <span className="text-[9px] font-black text-rose-500 uppercase tracking-wider block mb-1">{language === 'ru' ? 'Остаток долга' : 'Qolgan Qarz'}</span>
                        <span className="text-xs sm:text-sm font-black text-rose-700 font-mono block">
                          {formatMoney(patientDetailData.currentDebt)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Davolash Rejalari Ro'yxati */}
                  {detailPlans.length > 0 && (
                    <div className="rounded-[1.5rem] border border-slate-200 overflow-hidden">
                      <div className="px-4 sm:px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                        <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-[0.18em] flex items-center gap-2">
                          <Receipt className="w-3.5 h-3.5 text-[#1499AD]" />
                          {language === 'ru' ? 'Планы лечения' : 'Davolash Rejalari'} ({detailPlans.length})
                        </h3>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {detailPlans.map((plan, idx) => (
                          <div key={plan.id || idx} className="p-4 sm:p-5 hover:bg-slate-50/60 transition-colors">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-black text-slate-900">{language === 'ru' ? (plan.name || '').replace(/Davolash rejasi/gi, 'План лечения') : plan.name}</h4>
                                  <span className={cn(
                                    "text-[9px] font-black uppercase px-2 py-0.5 rounded-full border",
                                    plan.status === 'Yakunlangan' || plan.status === 'Completed'
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                      : plan.status === 'Jarayonda' || plan.status === 'In Progress'
                                      ? "bg-amber-50 text-amber-700 border-amber-200"
                                      : "bg-blue-50 text-blue-700 border-blue-200"
                                  )}>
                                    {plan.status || 'Rejalashtirilgan'}
                                  </span>
                                </div>
                                {plan.tooth_number && (
                                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                                    {language === 'ru' ? 'Зубы: ' : 'Tishlar: '}<span className="font-mono font-bold text-slate-600">#{plan.tooth_number}</span>
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-2 self-start sm:self-auto">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedPlanForInvoice(plan);
                                    setShowPlanInvoiceModal(true);
                                  }}
                                  className="h-8 px-3 rounded-xl border-slate-200 text-xs font-bold gap-1 text-slate-700"
                                >
                                  <FileText className="w-3.5 h-3.5 text-[#1499AD]" />
                                  {language === 'ru' ? 'Квитанция' : 'Kvitansiya'}
                                </Button>
                              </div>
                            </div>

                            {/* Excel Jadvali Ko'rinishidagi Xizmatlar Ro'yxati */}
                            {Array.isArray(plan.services) && plan.services.length > 0 && (
                              <div className="mt-3 rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                                <table className="w-full text-left text-xs border-collapse">
                                  <thead>
                                    <tr className="bg-slate-100/90 border-b border-slate-200 text-[10px] font-black text-slate-600 uppercase tracking-wider select-none">
                                      <th className="w-10 px-2.5 py-2 text-center border-r border-slate-200 font-mono">№</th>
                                      <th className="px-3.5 py-2 border-r border-slate-200">
                                        {language === 'ru' ? 'Услуга / Процедура' : language === 'en' ? 'Service / Procedure' : 'Xizmat / Muolaja'}
                                      </th>
                                      <th className="w-28 px-3 py-2 text-center border-r border-slate-200">
                                        {language === 'ru' ? 'Статус' : language === 'en' ? 'Status' : 'Holat'}
                                      </th>
                                      <th className="w-36 px-3.5 py-2 text-right">
                                        {language === 'ru' ? 'Стоимость' : language === 'en' ? 'Price' : 'Narxi'}
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-200/80 bg-white">
                                    {plan.services.map((srv, sIdx) => {
                                      const isCompleted = !!(srv.completed || srv.status === 'completed' || srv.status === 'Yakunlangan');
                                      return (
                                        <tr 
                                          key={sIdx}
                                          className={`hover:bg-slate-50 transition-colors ${
                                            sIdx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'
                                          }`}
                                        >
                                          <td className="px-2.5 py-2 text-center font-mono font-bold text-slate-400 border-r border-slate-200/80 text-[11px]">
                                            {sIdx + 1}
                                          </td>
                                          <td className="px-3.5 py-2 border-r border-slate-200/80">
                                            <div className="font-bold text-slate-900 text-xs">
                                              {srv.service_name || srv.name || (language === 'ru' ? `Услуга #${sIdx + 1}` : `Xizmat #${sIdx + 1}`)}
                                            </div>
                                            {srv.notes && (
                                              <div className="text-[10px] text-slate-400 font-normal mt-0.5">
                                                {srv.notes}
                                              </div>
                                            )}
                                          </td>
                                          <td className="px-3 py-2 text-center border-r border-slate-200/80">
                                            <span className={cn(
                                              "px-2 py-0.5 rounded-full text-[9.5px] font-black uppercase tracking-wider inline-block",
                                              isCompleted 
                                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                                                : "bg-amber-50 text-amber-700 border border-amber-200"
                                            )}>
                                              {isCompleted 
                                                ? (language === 'ru' ? 'Выполнено' : 'Bajarildi') 
                                                : (language === 'ru' ? 'В плане' : 'Rejada')}
                                            </span>
                                          </td>
                                          <td className="px-3.5 py-2 text-right font-mono font-black text-slate-900 text-xs">
                                            {Number(srv.price || 0).toLocaleString()} <span className="text-[10px] font-sans font-bold text-slate-400">{language === 'ru' ? 'UZS' : "so'm"}</span>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                  <tfoot>
                                    <tr className="bg-slate-100/90 border-t border-slate-200 font-black text-xs">
                                      <td colSpan={3} className="px-3.5 py-2 text-right border-r border-slate-200 text-slate-600 uppercase text-[10px] tracking-wider">
                                        {language === 'ru' ? 'Итого по услугам:' : 'Jami xizmatlar summasi:'}
                                      </td>
                                      <td className="px-3.5 py-2 text-right font-mono text-emerald-700 text-xs">
                                        {plan.services.reduce((acc, curr) => acc + (Number(curr.price) || 0), 0).toLocaleString()} <span className="text-[10px] font-sans font-bold text-slate-500">{language === 'ru' ? 'UZS' : "so'm"}</span>
                                      </td>
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* To'lov Tarixi Switcher */}
                  <div className="border border-slate-200 rounded-[1.5rem] overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowDetailHistory(prev => !prev)}
                      className="w-full px-5 py-3.5 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-left transition-colors cursor-pointer"
                    >
                      <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
                        <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                        {language === 'ru' ? 'История платежей пациента' : 'Bemorning to\'lovlar tarixi'} ({detailHistory.length})
                      </span>
                      <span className="text-xs font-bold text-blue-600">
                        {showDetailHistory ? (language === 'ru' ? "Скрыть ▲" : "Yashirish ▲") : (language === 'ru' ? "Показать ▼" : "Ko'rsatish ▼")}
                      </span>
                    </button>

                    {showDetailHistory && (
                      <div className="p-4 divide-y divide-slate-100 max-h-60 overflow-y-auto">
                        {detailHistory.length > 0 ? (
                          detailHistory.map((h, idx) => (
                            <div key={h.id || idx} className="py-2.5 flex items-center justify-between text-xs font-mono">
                              <div>
                                <span className="font-bold text-slate-800 font-sans block">
                                  {h.type === 'Income' ? 'Kirim to\'lov' : h.type}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {h.date ? new Date(h.date).toLocaleDateString('uz-UZ') : '—'} • {h.payment_method || 'Naqd'}
                                </span>
                              </div>
                              <span className="font-black text-emerald-600 text-sm">
                                +{Number(h.amount || 0).toLocaleString()} UZS
                              </span>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-slate-400 py-4 text-center">To'lovlar tarixi mavjud emas</p>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Bottom Actions Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  const pId = selectedDebtPatient.id;
                  setSelectedDebtPatient(null);
                  navigate(`/patients/${pId}`);
                }}
                className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
              >
                {language === 'ru' ? 'Перейти в профиль пациента →' : "Bemor profiliga o'tish →"}
              </button>

              <div className="flex items-center gap-2">
                <Button
                  onClick={() => {
                    const p = selectedDebtPatient;
                    setSelectedDebtPatient(null);
                    handlePayDebt(p);
                  }}
                  className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs gap-1.5 shadow-md"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>{language === 'ru' ? 'Погасить долг' : 'Qarzni To\'lash'}</span>
                </Button>

                <Button
                  onClick={() => setSelectedDebtPatient(null)}
                  className="h-9 px-4 rounded-xl bg-slate-900 text-white font-bold text-xs cursor-pointer"
                >
                  {language === 'ru' ? 'Закрыть' : 'Yopish'}
                </Button>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* Treatment Plan Invoice Modal */}
      {showPlanInvoiceModal && selectedPlanForInvoice && (
        <TreatmentPlanInvoice 
          open={showPlanInvoiceModal}
          onClose={() => {
            setShowPlanInvoiceModal(false);
            setSelectedPlanForInvoice(null);
          }}
          plan={selectedPlanForInvoice}
        />
      )}
    </div>
  );
}
