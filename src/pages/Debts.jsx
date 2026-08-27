import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { sendTelegramMessage } from '@/api/telegramBot';
import { useTranslation } from '@/i18n/LanguageContext';
import { 
  Wallet, Search, User, Phone, 
  MessageSquare, ChevronRight,
  TrendingDown, CreditCard,
  ArrowUpRight, Copy, Check,
  AlertCircle, Filter, X, Clock,
  Calendar, FileText, Receipt,
  Stethoscope, Eye, Sparkles
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import TreatmentPlanInvoice from '@/components/treatments/TreatmentPlanInvoice';
import EmptyState from '../components/ui/EmptyState';
import { motion, AnimatePresence } from 'framer-motion';
import { formatPhone } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { format } from 'date-fns';

const formatCurrency = (val) => new Intl.NumberFormat('uz-UZ', { style: 'currency', currency: 'UZS', maximumFractionDigits: 0 }).format(val);

export default function Debts() {
  const { t } = useTranslation();
  const { user, isDoctor } = useAuth();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const navigate = useNavigate();

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
        // Fetch everything in parallel for maximum efficiency
        const [allPatientsRaw, allPayments] = await Promise.all([
          base44.entities.Patient.list('-created_date', 200),
          base44.entities.Payment.list('-created_date', 500),
        ]);

        const allPatients = isDoctor && user?.id
          ? (allPatientsRaw || []).filter(p => p.main_treatment_provider === user.id || p.main_treatment_provider === user.name)
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
          // Refund = pul qaytarildi => bu bemor qarzini oshiradi (formula debt+refund-paid-discount)
          if (type === 'refund') debtMap[pid].refund += (pay.amount || 0);
          // Discount = qarzni kamaytiradi
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
        toast.error(t('common.error'));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [isDoctor, user]);

  const totalDebt = patients.reduce((s, p) => s + (p.real_debt || 0), 0);
  const filtered = patients.filter(p => 
    p.full_name?.toLowerCase().includes(search.toLowerCase()) || 
    p.phone?.includes(search)
  );

  const handleCall = (phone) => {
    if (phone) window.location.href = `tel:${phone}`;
    else toast.error(t('common.phone'));
  };

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success(t('common.success'));
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSendReminder = async (patient) => {
    if (!patient.telegram_chat_id) {
      toast.error("Bemor Telegramga ulanmagan. Birinchi bo'lib uni botga ulang.");
      return;
    }

    const tId = toast.loading("Xabarnoma yuborilmoqda...");
    try {
      // 1. Get Clinic info and Bot config
      const clinics = await base44.clinic.getAll();
      const clinic = clinics.find(c => c.id === patient.clinic_id);
      
      const botConfigs = await base44.entities.BotConfig.list();
      const config = botConfigs.find(bc => bc.clinic_id === patient.clinic_id && bc.isActive);

      if (!config?.botToken) {
        throw new Error("Telegram bot sozlanmagan");
      }

      const debt = formatCurrency(patient.real_debt);
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

      // Helper for original price of a single plan (without discount)
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

      setDetailPlans(plansList);
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

  return (
    <div className="p-4 sm:p-6 bg-[#F8FAFC] min-h-screen">
      {/* Premium Dashboard Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 text-[10px] font-bold text-rose-500 uppercase tracking-wider">
            <span className="w-6 h-[2px] bg-rose-500"></span>
            {t('debts.monitoring')}
          </div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">{t('debts.title')}</h1>
          <p className="text-[11px] text-slate-400 font-medium">{t('debts.subtitle')}</p>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={() => window.print()}
            className="h-9 px-4 rounded-xl border-slate-200 bg-white shadow-sm font-bold text-xs text-slate-650 gap-1.5 hover:bg-slate-50"
          >
            {t('common.view')}
          </Button>
          <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-md">
            <CreditCard className="w-4.5 h-4.5" />
          </div>
        </div>
      </div>

      {/* Stats Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="lg:col-span-2 relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 text-white shadow-md"
        >
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">{t('debts.totalDebt')}</p>
              <h2 className="text-3xl font-black tracking-tight">
                {formatCurrency(totalDebt)}
              </h2>
              <div className="flex items-center gap-2 pt-1">
                <div className="px-2.5 py-0.5 bg-rose-500/10 border border-rose-500/20 rounded-full text-[10px] font-bold text-rose-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {t('debts.activeAlert')}
                </div>
              </div>
            </div>
            <div className="flex flex-col justify-end items-end space-y-3">
              <div className="text-right">
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-0.5">{t('debts.debtors')}</p>
                <p className="text-xl font-black text-white">{patients.length} <span className="text-xs font-bold text-slate-500">{t('debts.patientsCount')}</span></p>
              </div>
              <Button className="rounded-xl bg-white text-slate-900 font-bold hover:bg-white/90 gap-1 h-9 px-4 shadow text-xs border-none cursor-pointer">
                {t('debts.viewMonitoring')} <ArrowUpRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-full blur-2xl -mr-16 -mt-16"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl -ml-16 -mb-16"></div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm flex flex-col justify-center"
        >
          <div className="w-10 h-10 bg-slate-900/5 rounded-xl flex items-center justify-center mb-3">
            <TrendingDown className="w-5 h-5 text-rose-500" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 mb-1">{t('debts.actionRequiredTitle')}</h3>
          <p className="text-slate-400 text-xs font-medium leading-relaxed">
            {t('debts.actionRequiredDesc').replace('{count}', patients.filter(p => p.real_debt > 5000000).length).replace('{amount}', '5.000.000')}
          </p>
        </motion.div>
      </div>

      {/* Modern Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-slate-900 transition-colors pointer-events-none" />
          <Input 
            placeholder={t('debts.searchHint')} 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            className="h-10 pl-10 pr-4 rounded-xl border-slate-200 bg-white placeholder:text-slate-400 text-sm font-semibold focus-visible:ring-1 focus-visible:ring-slate-350"
          />
        </div>
        <Button variant="outline" className="h-10 px-5 rounded-xl bg-white border-slate-250 gap-2 font-bold text-xs text-slate-600 shadow-sm shrink-0">
          <Filter className="w-4 h-4 text-slate-400" /> {t('debts.filter')}
        </Button>
      </div>

      {/* Data Grid */}
      <div className="space-y-4">
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-white border border-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center shadow-sm">
            <EmptyState icon={Wallet} title="Hech narsa topilmadi" description={search ? "Qidiruv bo'yicha ma'lumot yo'q" : "Ayni damda qarzdor bemorlar mavjud emas"} />
          </div>
        ) : (
          <div className="space-y-3.5">
            {/* Desktop Table View */}
            <div className="hidden sm:block bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto no-scrollbar">
                <table className="w-full text-left border-collapse table-fixed min-w-[850px]">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-[28%] min-w-[200px]">{t('debts.table.patient') || 'Bemor'}</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-[16%] min-w-[120px]">{t('debts.table.debtAmount') || 'Qarz miqdori'}</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-[24%] min-w-[170px]">{t('debts.table.paymentShare') || 'To\'lov ulushi'}</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-[16%] min-w-[120px]">{t('debts.table.communicationStatus') || 'Aloqa holati'}</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right w-[16%] min-w-[130px]">{t('debts.table.actions') || 'Amallar'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.map((p) => (
                      <tr 
                        key={p.id} 
                        onClick={() => openPatientDebtDetail(p)}
                        className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                        title="Davolash rejasi va qarz tafsilotlarini ko'rish uchun bosing"
                      >
                        <td className="px-4 py-2.5 w-[28%] min-w-[200px]">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="relative shrink-0">
                              <div className="w-8.5 h-8.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 group-hover:scale-105 transition-transform duration-300">
                                <User className="w-4 h-4" />
                              </div>
                              {p.real_debt > 5000000 && (
                                <div className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 border-2 border-white rounded-full flex items-center justify-center">
                                  <AlertCircle className="w-2.5 h-2.5 text-white" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-slate-850 text-[13px] truncate group-hover:text-[#1499AD] transition-colors">
                                {p.full_name}
                              </p>
                              <p className="text-[10.5px] font-medium text-slate-555 mt-0.5 truncate flex items-center gap-1.5 leading-none">
                                <span>{p.phone ? formatPhone(p.phone) : (t('debts.noPhone') || 'Telefon kiritilmagan')}</span>
                                {p.phone && (
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleCopy(p.phone, p.id); }}
                                    className="text-slate-350 hover:text-slate-900 transition-colors shrink-0"
                                  >
                                    {copiedId === p.id ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-2.5 h-2.5" />}
                                  </button>
                                )}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 w-[16%] min-w-[120px]">
                          <div className="inline-flex items-center gap-1.5 px-2 py-1 -ml-2 rounded-lg group-hover:bg-slate-100 transition-all">
                            <span className={`font-black text-[13px] tracking-tight ${p.real_debt > 5000000 ? 'text-rose-650' : 'text-amber-650'} group-hover:text-[#1499AD]`}>
                              {formatCurrency(p.real_debt || 0).replace(" so'm", "")}
                              <span className="text-[9px] ml-0.5 opacity-60 uppercase font-medium">uzs</span>
                            </span>
                            <Eye className="w-3.5 h-3.5 text-[#1499AD] opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </td>
                        <td className="px-4 py-2.5 w-[24%] min-w-[170px]">
                          <div className="flex justify-between items-center text-[10px] font-semibold text-slate-500 mb-1">
                            <span className="text-emerald-600">{t('debts.table.paidLabel') || 'Yopilgan:'} {formatCurrency(p.real_paid || 0).replace(" so'm", "")}</span>
                            <span className="text-slate-400 font-bold">{Math.round((p.real_paid / (p.real_debt + p.real_paid)) * 100 || 0)}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-100">
                            <div 
                              className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${Math.min(100, (p.real_paid / (p.real_debt + p.real_paid)) * 100)}%` }}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-2.5 w-[16%] min-w-[120px]">
                          {p.telegram_chat_id ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 border border-blue-100 text-[9.5px] font-bold text-blue-600">
                              <span className="w-1 h-1 rounded-full bg-blue-500 animate-pulse" />
                              {t('debts.telegramActive') || 'Telegram faol'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-50 border border-slate-105 text-[9.5px] font-bold text-slate-400">
                              {t('debts.telegramNone') || 'Telegram yo\'q'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right w-[16%] min-w-[130px]">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7.5 w-7.5 rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all shrink-0 p-0 shadow-sm cursor-pointer"
                              onClick={(e) => { e.stopPropagation(); handlePayDebt(p); }}
                              title={t('debts.payTooltip') || "To'lov qabul qilish / To'lash"}
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                            </Button>
                            {p.phone && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7.5 w-7.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 transition-colors shrink-0 p-0 cursor-pointer"
                                onClick={(e) => { e.stopPropagation(); handleCall(p.phone); }}
                                title={t('recall.makeCall') || "Qo'ng'iroq qilish"}
                              >
                                <Phone className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7.5 w-7.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 transition-colors shrink-0 p-0 cursor-pointer"
                              onClick={(e) => { e.stopPropagation(); handleSendReminder(p); }}
                              title={t('debts.sendReminderTooltip') || "SMS / Telegram eslatma yuborish"}
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7.5 w-7.5 rounded-lg bg-slate-50 text-slate-450 hover:bg-[#1499AD] hover:text-white transition-all shrink-0 p-0 cursor-pointer"
                              onClick={(e) => { e.stopPropagation(); openPatientDebtDetail(p); }}
                              title="Reja va qarz ma'lumotlari"
                            >
                              <ChevronRight className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile View - Sleek Cards */}
            <div className="sm:hidden grid grid-cols-1 gap-3.5">
              <AnimatePresence mode="popLayout">
                {filtered.map((p, index) => (
                  <motion.div 
                    key={p.id}
                    layout
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index, 6) * 0.02 }}
                    className="bg-white border border-slate-100 rounded-xl p-3.5 shadow-sm relative overflow-hidden group content-visibility-auto"
                  >
                    <div 
                      className="flex items-start justify-between mb-3 gap-2 cursor-pointer"
                      onClick={() => openPatientDebtDetail(p)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative shrink-0">
                          <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
                            <User className="w-5 h-5" />
                          </div>
                          {p.real_debt > 5000000 && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 border border-white rounded-full flex items-center justify-center">
                              <AlertCircle className="w-2.5 h-2.5 text-white" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-slate-800 tracking-tight truncate max-w-[150px]">{p.full_name}</h3>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">{p.phone ? formatPhone(p.phone) : (t('debts.noPhone') || 'Telefon kiritilmagan')}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-0.5 leading-none">{t('debts.table.toPay') || 'To\'lanishi kerak'}</p>
                        <p className={`text-sm font-black tracking-tight ${p.real_debt > 5000000 ? 'text-rose-650' : 'text-amber-650'}`}>
                          {formatCurrency(p.real_debt || 0).replace(" so'm", "")} <span className="text-[8px] opacity-60">UZS</span>
                        </p>
                      </div>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-3 mb-3.5 border border-slate-100">
                      <div className="flex flex-col gap-1.5">
                        <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${Math.min(100, (p.real_paid / (p.real_debt + p.real_paid)) * 100)}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[9px] font-bold">
                          <span className="text-emerald-600">{t('debts.table.paidLabel') || 'Yopilgan:'} {formatCurrency(p.real_paid || 0).replace(" so'm", "")}</span>
                          <span className="text-slate-400">{Math.round((p.real_paid / (p.real_debt + p.real_paid)) * 100 || 0)}%</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5">
                      <Button 
                        variant="outline"
                        onClick={() => handlePayDebt(p)}
                        className="h-9 rounded-lg bg-emerald-600 text-white font-black text-[10px] gap-1 hover:bg-emerald-700 p-0 border-none shadow-sm cursor-pointer active:scale-95 transition-all"
                      >
                        <CreditCard className="w-3.5 h-3.5" /> {t('debts.pay') || "To'lov"}
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => handleCall(p.phone)}
                        className="h-9 rounded-lg border-slate-100 bg-white text-slate-700 font-bold text-[10px] gap-1 hover:bg-slate-50 p-0 border cursor-pointer"
                      >
                        <Phone className="w-3.5 h-3.5 text-emerald-500" /> {t('debts.table.contact') || 'Aloqa'}
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => handleSendReminder(p)}
                        className="h-9 rounded-lg bg-white border-slate-100 text-slate-700 font-bold text-[10px] gap-1 hover:bg-slate-50 p-0 border cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-blue-500" /> {t('debts.table.remind') || 'Eslatish'}
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => openPatientDebtDetail(p)}
                        className="h-9 rounded-lg bg-white border-slate-100 text-slate-700 font-bold text-[10px] gap-1 hover:bg-slate-50 p-0 border cursor-pointer"
                      >
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" /> Reja
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>

      {/* ─── Treatment Plan & Debt Detail Dialog (Exactly like Payments Modal) ─── */}
      <Dialog open={!!selectedDebtPatient} onOpenChange={(open) => !open && setSelectedDebtPatient(null)}>
        {selectedDebtPatient && (
          <DialogContent className="w-[95vw] max-w-3xl p-0 overflow-hidden rounded-[2rem] border-none shadow-2xl [&>button]:hidden">
            {/* Header */}
            <div className="premium-bg-gradient px-6 py-5 text-white relative">
              <button 
                onClick={() => setSelectedDebtPatient(null)} 
                className="absolute right-4 top-4 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 active:scale-95 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              <p className="text-[9px] font-black text-white/60 uppercase tracking-[0.3em] mb-1">
                Davolash Rejalari & Qarz Tafsilotlari
              </p>
              <h2 className="text-2xl sm:text-3xl font-[900] tracking-tight">
                {selectedDebtPatient.full_name}
              </h2>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase bg-rose-500/20 text-white border border-rose-300/30">
                  Qolgan qarz: {formatCurrency(patientDetailData?.currentDebt ?? selectedDebtPatient.real_debt).replace(" so'm", "")} UZS
                </span>
                {patientDetailData?.totalPaid > 0 && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-white border border-emerald-300/30">
                    To'langan: {formatCurrency(patientDetailData.totalPaid).replace(" so'm", "")} UZS
                  </span>
                )}
                {detailPlans.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-white/80 bg-white/10 px-2.5 py-0.5 rounded-full">
                    <Receipt className="w-3 h-3" /> {detailPlans.length} ta reja
                  </span>
                )}
              </div>
            </div>

            {/* Body */}
            <div className="p-5 sm:p-6 bg-white space-y-4 max-h-[80vh] overflow-y-auto no-scrollbar">
              {loadingDetail ? (
                <div className="py-16 text-center space-y-3">
                  <div className="w-8 h-8 border-3 border-[#1499AD] border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Davolash rejalari yuklanmoqda...</p>
                </div>
              ) : (
                <>
                  {/* Bemor va Shifokor Karti */}
                  <div className="rounded-[1.5rem] border border-slate-200 overflow-hidden">
                    <div className="px-4 sm:px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                      <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-[0.18em] flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-[#1499AD]" />
                        Bemor va shifokor ma'lumotlari
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
                              {selectedDebtPatient.phone ? formatPhone(selectedDebtPatient.phone) : (t('debts.noPhone') || 'Telefon kiritilmagan')}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-[110px_1fr] gap-3 px-4 sm:px-5 py-3">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Shifokor</span>
                        <p className="text-[13px] sm:text-[14px] font-[900] text-slate-800 break-words flex items-center gap-1.5">
                          <Stethoscope className="w-3.5 h-3.5 text-blue-500" />
                          {patientDetailData?.doctor?.name || patientDetailData?.doctor?.full_name || selectedDebtPatient.main_treatment_provider || 'Biriktirilmagan'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 4 CARDS: Reja asl narxi, Qo'llanilgan chegirma, Chegirmali jami summa, Qolgan qarz */}
                  {(() => {
                    const origPrice = patientDetailData?.originalPrice ?? (Number(selectedDebtPatient.real_debt) + Number(patientDetailData?.totalPaid || 0));
                    const discAmt = patientDetailData?.totalDiscount ?? 0;
                    const discPct = patientDetailData?.discountPercent ?? (origPrice > 0 && discAmt > 0 ? Math.round((discAmt / origPrice) * 100) : 0);
                    const finTotal = patientDetailData?.finalPlanTotal ?? Math.max(0, origPrice - discAmt);
                    const curDebt = patientDetailData?.currentDebt ?? selectedDebtPatient.real_debt;

                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                        {/* 1. Reja chegirmasiz narxi */}
                        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 shadow-xs">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Reja (asl narxi)</p>
                          <p className="text-[13px] sm:text-[14px] font-[900] text-slate-800 tracking-tight">
                            {origPrice.toLocaleString()} <span className="text-[10px] font-bold text-slate-500">so'm</span>
                          </p>
                        </div>

                        {/* 2. Qo'llanilgan chegirma foizi va summasi */}
                        <div className="p-3.5 rounded-2xl bg-purple-50/60 border border-purple-100 shadow-xs">
                          <p className="text-[9px] font-black text-purple-500 uppercase tracking-widest mb-1.5">Qo'llanilgan chegirma</p>
                          <p className="text-[13px] sm:text-[14px] font-[900] text-purple-700 tracking-tight">
                            {discPct}% <span className="text-[10px] font-bold text-purple-600/80">({discAmt.toLocaleString()} so'm)</span>
                          </p>
                        </div>

                        {/* 3. Jamida chegirmani ayirilgani summasi */}
                        <div className="p-3.5 rounded-2xl bg-blue-50/60 border border-blue-100 shadow-xs">
                          <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest mb-1.5">Chegirmali jami summa</p>
                          <p className="text-[13px] sm:text-[14px] font-[900] text-blue-700 tracking-tight">
                            {finTotal.toLocaleString()} <span className="text-[10px] font-bold text-blue-600/80">so'm</span>
                          </p>
                        </div>

                        {/* 4. Qolgan qarzi */}
                        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-100 shadow-xs">
                          <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest mb-1.5">Qolgan qarz</p>
                          <p className={`text-[13px] sm:text-[14px] font-[900] tracking-tight ${curDebt > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {curDebt > 0 ? `${curDebt.toLocaleString()} so'm` : "To'liq yopilgan"}
                          </p>
                        </div>
                      </div>
                    );
                  })()}

                  {/* ─── Davolash rejalari bo'limi (Rejaga tegishli ma'lumotlar) ─── */}
                  <div className="rounded-[1.5rem] border border-slate-200 overflow-hidden bg-white">
                    <div className="px-4 sm:px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                      <h3 className="text-[11px] font-black text-[#1499AD] uppercase tracking-[0.18em] flex items-center gap-2">
                        <Receipt className="w-3.5 h-3.5" />
                        Davolash rejalari va xizmatlari ({detailPlans.length})
                      </h3>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                        Rejaga tegishli ma'lumotlar
                      </span>
                    </div>

                    {detailPlans.length === 0 ? (
                      <div className="p-6 text-center text-slate-400">
                        <Receipt className="w-8 h-8 mx-auto text-slate-300 mb-2 opacity-50" />
                        <p className="text-xs font-bold text-slate-500">Davolash rejasi kiritilmagan</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Ushbu qarzdorlik to'g'ridan-to'g'ri to'lovlar orqali shakllangan.</p>
                      </div>
                    ) : (
                      <div className="p-4 space-y-3">
                        {detailPlans.map((plan, pIdx) => {
                          const planTotal = Number(plan.total_price) || 0;
                          const planPaid = Number(plan.paid_amount) || 0;
                          const planRemaining = Math.max(0, planTotal - planPaid);
                          const planServices = plan.services || [];

                          return (
                            <div key={plan.id || pIdx} className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 space-y-3">
                              {/* Plan Header */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h4 className="text-sm font-[900] text-slate-900">{plan.name || `Davolash rejasi #${pIdx + 1}`}</h4>
                                    {plan.tooth_number && (
                                      <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 text-[10px] font-black">
                                        Tish #{plan.tooth_number}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                                    {plan.created_date ? format(new Date(plan.created_date), 'dd.MM.yyyy') : 'Sana ko\'rsatilmagan'}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase ${planRemaining > 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                    {planRemaining > 0 ? `Qarz: ${planRemaining.toLocaleString()} UZS` : 'Yopilgan ✓'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedPlanForInvoice(plan);
                                      setShowPlanInvoiceModal(true);
                                    }}
                                    className="px-2.5 py-1 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer"
                                  >
                                    <FileText className="w-3 h-3" />
                                    Faktura
                                  </button>
                                </div>
                              </div>

                              {/* Services Table inside Plan */}
                              {planServices.length > 0 && (
                                <div className="space-y-1.5">
                                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                    Xizmatlar ro'yxati:
                                  </p>
                                  <div className="divide-y divide-slate-100 rounded-xl bg-white border border-slate-200 overflow-hidden text-xs">
                                    {planServices.map((svc, sIdx) => {
                                      const svcPrice = Number(svc.price) || 0;
                                      const svcName = svc.service_name || svc.name || '—';
                                      const toothId = svc.tooth_id || svc.tooth || plan.tooth_number;

                                      return (
                                        <div key={sIdx} className="flex items-center justify-between px-3 py-2 hover:bg-slate-50/70 transition-colors">
                                          <div className="flex items-center gap-2 min-w-0">
                                            {toothId && toothId !== 'general' && (
                                              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-[9px] shrink-0">
                                                #{toothId}
                                              </span>
                                            )}
                                            <span className="font-bold text-slate-800 truncate">{svcName}</span>
                                          </div>
                                          <span className="font-black text-slate-900 shrink-0 ml-2">
                                            {svcPrice.toLocaleString()} UZS
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* Plan Financial mini bar */}
                              <div className="flex items-center justify-between text-[11px] font-bold bg-white rounded-xl p-2.5 border border-slate-200">
                                <span className="text-slate-500">Jami: <span className="font-black text-slate-900">{planTotal.toLocaleString()} UZS</span></span>
                                <span className="text-emerald-600">To'langan: <span className="font-black">{planPaid.toLocaleString()} UZS</span></span>
                                <span className={planRemaining > 0 ? 'text-rose-600 font-black' : 'text-emerald-600 font-black'}>
                                  Qoldiq: {planRemaining.toLocaleString()} UZS
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* ─── To'lovlar tarixi ─── */}
                  <div className="rounded-[1.5rem] border border-slate-200 overflow-hidden bg-white">
                    <div 
                      onClick={() => setShowDetailHistory(!showDetailHistory)}
                      className="px-4 sm:px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between cursor-pointer hover:bg-slate-100/70 transition-colors select-none"
                    >
                      <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-[0.18em] flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-emerald-600" />
                        To'lovlar tarixi ({detailHistory.length})
                      </h3>
                      <span className="text-[10px] font-bold text-slate-500">
                        {showDetailHistory ? '▲ Yopish' : '▼ Ko\'rish'}
                      </span>
                    </div>

                    {showDetailHistory && (
                      <div className="p-4 space-y-2 max-h-[220px] overflow-y-auto no-scrollbar">
                        {detailHistory.length === 0 ? (
                          <p className="text-xs font-bold text-slate-400 py-3 text-center">To'lovlar topilmadi</p>
                        ) : (
                          detailHistory.map((hPay, hIdx) => {
                            const hAmt = Number(hPay.amount) || 0;
                            const hDate = hPay.created_date || hPay.created_at || hPay.date;
                            const isExpense = (hPay.type || '').toLowerCase() === 'expense';
                            return (
                              <div key={hPay.id || hIdx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                                <div>
                                  <p className="font-[800] text-slate-800">{hPay.method || 'Naqd'}</p>
                                  <p className="text-[9px] font-bold text-slate-400 mt-0.5">
                                    {hDate ? format(new Date(hDate), 'dd.MM.yyyy, HH:mm') : '—'}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className={`font-black ${isExpense ? 'text-rose-600' : 'text-emerald-600'}`}>
                                    {isExpense ? '-' : '+'}{hAmt.toLocaleString()} so'm
                                  </p>
                                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                    {hPay.type || 'Income'}
                                  </p>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>

                  {/* Footer Actions */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                    <button
                      onClick={() => navigate(`/patients/${selectedDebtPatient.id}`)}
                      className="text-[11px] font-bold text-slate-500 hover:text-slate-900 transition-colors uppercase tracking-wider"
                    >
                      Bemorning to'liq profiliga o'tish →
                    </button>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <Button
                        variant="outline"
                        onClick={() => setSelectedDebtPatient(null)}
                        className="flex-1 sm:flex-none h-11 px-5 rounded-xl font-bold uppercase text-[10px] tracking-wider border-slate-200 text-slate-600 hover:bg-slate-50"
                      >
                        Yopish
                      </Button>
                      <Button
                        onClick={() => {
                          const pat = selectedDebtPatient;
                          setSelectedDebtPatient(null);
                          handlePayDebt(pat);
                        }}
                        className="flex-1 sm:flex-none h-11 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-[900] uppercase text-[11px] tracking-wider shadow-lg shadow-emerald-600/20 border-none transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <CreditCard className="w-4 h-4" />
                        To'lov qabul qilish
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* Standalone TreatmentPlanInvoice modal */}
      {selectedPlanForInvoice && (
        <TreatmentPlanInvoice 
          open={showPlanInvoiceModal} 
          onClose={() => { setShowPlanInvoiceModal(false); setSelectedPlanForInvoice(null); }} 
          plan={selectedPlanForInvoice} 
        />
      )}
    </div>
  );
}
