import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Wallet, Search, Phone, MessageSquare, User, 
  ChevronRight, ArrowLeft, TrendingUp, AlertCircle,
  Copy, Check, CreditCard, X, Clock, Calendar,
  FileText, Receipt, Stethoscope, Eye
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import TreatmentPlanInvoice from '@/components/treatments/TreatmentPlanInvoice';
import PullToRefresh from '@/components/ui/PullToRefresh';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { useTranslation } from '@/i18n/LanguageContext';
import { format } from 'date-fns';

// Telefon raqamini chiroyli formatlash
const formatPhone = (phone) => {
  if (!phone) return '--- --- -- --';
  const digits = String(phone).replace(/\D/g, '');
  // 998XXXXXXXXX → +998 XX XXX-XX-XX
  if (digits.length === 12 && digits.startsWith('998')) {
    return `+998 ${digits.slice(3, 5)} ${digits.slice(5, 8)}-${digits.slice(8, 10)}-${digits.slice(10, 12)}`;
  }
  // 9XXXXXXXXX (9 digits)
  if (digits.length === 9) {
    return `+998 ${digits.slice(0, 2)} ${digits.slice(2, 5)}-${digits.slice(5, 7)}-${digits.slice(7, 9)}`;
  }
  return phone;
};

export default function MobileDebts() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  // Detail Modal states
  const [selectedDebtPatient, setSelectedDebtPatient] = useState(null);
  const [patientDetailData, setPatientDetailData] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailPlans, setDetailPlans] = useState([]);
  const [detailHistory, setDetailHistory] = useState([]);
  const [showDetailHistory, setShowDetailHistory] = useState(false);
  const [selectedPlanForInvoice, setSelectedPlanForInvoice] = useState(null);
  const [showPlanInvoiceModal, setShowPlanInvoiceModal] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await base44.entities.Patient.list('full_name', 50); // ⚡ tez
      setPatients(data.filter(p => (p.total_debt || 0) > 0));
    } catch (err) {
      console.error(err);
      toast.error("Ma'lumotlarni yuklashda xatolik");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const totalDebt = patients.reduce((s, p) => s + (p.total_debt || 0), 0);
  const filtered = patients.filter(p =>
    p.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.phone?.includes(search)
  ).sort((a, b) => (b.total_debt || 0) - (a.total_debt || 0));

  const handleCall = (phone) => {
    if (phone) {
      const cleanPhone = phone.replace(/\D/g, '');
      const finalPhone = cleanPhone.length === 9 ? `998${cleanPhone}` : cleanPhone;
      window.location.href = `tel:+${finalPhone}`;
    } else {
      toast.error("Telefon raqami topilmadi");
    }
  };

  const handleSMS = (phone, name, debt) => {
    if (phone) {
      const cleanPhone = phone.replace(/\D/g, '');
      const finalPhone = cleanPhone.length === 9 ? `998${cleanPhone}` : cleanPhone;
      const message = `Assalomu alaykum, hurmatli ${name}! Sizning klinikamizdan ${formatCurrency(debt)} miqdorida qarzdorligingiz mavjud. Iltimos, to'lovni amalga oshirishingizni so'raymiz.`;
      window.open(`https://t.me/share/url?url=https://shifocrm.uz&text=${encodeURIComponent(message)}`, '_blank');
    } else {
      toast.error("Telefon raqami topilmadi");
    }
  };

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Nusxalandi");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const openPatientDebtDetail = async (patient) => {
    setSelectedDebtPatient(patient);
    setLoadingDetail(true);
    setPatientDetailData(null);
    setShowDetailHistory(false);
    try {
      const [allPays, allPlans, allDoctors] = await Promise.all([
        base44.entities.Payment.filter({ patient_id: patient.id }, 'date', 5000),
        base44.entities.TreatmentPlan.filter({ patient_id: patient.id }, '-created_date', 100).catch(() => []),
        base44.entities.User.filter({ role: 'doctor' }, 'name').catch(() => [])
      ]);

      const paysList = allPays || [];
      const plansList = allPlans || [];

      // Helper for original price of a single plan
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
        originalPrice = totalDebts > 0 ? totalDebts + totalDiscountPayments : (Number(patient.total_debt) || 0);
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
        currentDebt = net < 0 ? Math.abs(net) : (patient.total_debt || 0);
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
        currentDebt: currentDebt > 0 ? currentDebt : (patient.total_debt || 0),
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
        prefillAmount: patient.total_debt || 0,
        prefillDoctor: patient.main_treatment_provider || '',
        prefillCategory: "Qarzdorlik to'lovi"
      }
    });
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-xl border-b border-slate-100 transition-all duration-300">
        <div className="px-4 py-3">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => navigate(-1)}
              className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center active:scale-90 transition-transform shrink-0"
            >
              <ArrowLeft className="w-4 h-4 text-slate-600" />
            </button>
            <div>
              <h1 className="text-lg font-black text-slate-900 tracking-tight leading-none">
                {t('navigation.debts')}
              </h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                {patients.length} bemor
              </p>
            </div>
          </div>

          {/* Total Debt Card — compact */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl px-4 py-3 shadow-xl shadow-slate-200 mb-3"
          >
            <div className="relative z-10 flex justify-between items-center">
              <div>
                <p className="text-slate-400 text-[9px] font-black uppercase tracking-[0.2em] mb-0.5">Umumiy qarzdorlik</p>
                <h2 className="text-2xl font-black text-white tracking-tighter">
                  {formatCurrency(totalDebt)}
                </h2>
              </div>
              <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
            <div className="absolute top-[-30%] right-[-5%] w-32 h-32 bg-emerald-500/20 rounded-full blur-3xl" />
          </motion.div>

          {/* Search */}
          <div className="relative group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
            <Input
              placeholder="Bemor ismi yoki telefon..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-10 pl-10 pr-4 rounded-xl border-0 bg-slate-100/80 focus:bg-white focus:ring-2 focus:ring-slate-900/5 transition-all text-sm font-bold placeholder:text-slate-400"
            />
          </div>
        </div>
      </div>

      <PullToRefresh onRefresh={loadData}>
        <div className="px-4 py-3 space-y-2.5">
          {loading ? (
            [...Array(5)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100 flex items-center gap-3 animate-pulse">
                <div className="w-11 h-11 rounded-xl bg-slate-100 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-28 bg-slate-100 rounded" />
                  <div className="h-3 w-20 bg-slate-100 rounded" />
                </div>
                <div className="h-5 w-24 bg-slate-100 rounded-full" />
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
                <Wallet className="w-9 h-9 text-slate-300" />
              </div>
              <h3 className="text-lg font-black text-slate-900 mb-1">
                {search ? "Topilmadi" : "Qarzdorlar yo'q"}
              </h3>
              <p className="text-sm font-medium text-slate-400 text-center max-w-[200px]">
                {search ? "Qidiruv bo'yicha natija yo'q" : "Hamma bemorlar to'lovlarini amalga oshirgan"}
              </p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {filtered.map((patient, index) => (
                <motion.div
                  key={patient.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2, delay: Math.min(index, 6) * 0.02 }}
                  className="bg-white rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-slate-100 active:scale-[0.99] transition-transform content-visibility-auto"
                >
                  <div className="px-3.5 pt-3.5 pb-2.5">
                    {/* Top row: avatar + info + debt */}
                    <div className="flex items-center gap-3 mb-2.5">
                      {/* Avatar */}
                      <div className="relative shrink-0">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                          <User className="w-5 h-5 text-slate-400" />
                        </div>
                        {(patient.total_debt || 0) > 5000000 && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 border-2 border-white rounded-full flex items-center justify-center">
                            <AlertCircle className="w-2.5 h-2.5 text-white" />
                          </div>
                        )}
                      </div>

                      {/* Name + phone */}
                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => openPatientDebtDetail(patient)}
                      >
                        <h3 className="text-[13px] font-black text-slate-900 tracking-tight truncate leading-tight">
                          {patient.full_name}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <p className="text-[11px] font-semibold text-slate-400 leading-none">
                            {formatPhone(patient.phone)}
                          </p>
                          {patient.phone && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleCopy(patient.phone, patient.id); }}
                              className="text-slate-300 hover:text-slate-700 transition-colors"
                            >
                              {copiedId === patient.id
                                ? <Check className="w-2.5 h-2.5 text-emerald-500" />
                                : <Copy className="w-2.5 h-2.5" />
                              }
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Debt amount */}
                      <div 
                        className="text-right shrink-0 cursor-pointer active:scale-95 transition-transform"
                        onClick={() => handlePayDebt(patient)}
                        title="To'lov oynasini ochish"
                      >
                        <p className={`text-[14px] font-black tracking-tight leading-none ${
                          (patient.total_debt || 0) > 1000000 ? 'text-rose-600' : 'text-amber-600'
                        }`}>
                          {formatCurrency(patient.total_debt || 0)}
                        </p>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                          Qarz
                        </p>
                      </div>
                    </div>

                    {/* Action buttons — compact 4-col */}
                    <div className="grid grid-cols-4 gap-1.5">
                      <button
                        onClick={() => handlePayDebt(patient)}
                        className="h-9 flex items-center justify-center gap-1 rounded-xl bg-emerald-600 text-white text-[11px] font-black shadow-sm active:scale-95 transition-transform"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        To'lov
                      </button>
                      <button
                        onClick={() => handleCall(patient.phone)}
                        disabled={!patient.phone}
                        className="h-9 flex items-center justify-center gap-1 rounded-xl bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-100 active:bg-emerald-100 transition-colors disabled:opacity-40"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        Qo'ng'iroq
                      </button>
                      <button
                        onClick={() => handleSMS(patient.phone, patient.full_name, patient.total_debt)}
                        disabled={!patient.phone}
                        className="h-9 flex items-center justify-center gap-1 rounded-xl bg-blue-50 text-blue-700 text-[11px] font-bold border border-blue-100 active:bg-blue-100 transition-colors disabled:opacity-40"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        Xabar
                      </button>
                      <button
                        onClick={() => openPatientDebtDetail(patient)}
                        className="h-9 flex items-center justify-center rounded-xl bg-slate-900 text-white active:scale-95 transition-transform"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </PullToRefresh>

      {/* ─── Mobile Treatment Plan & Debt Detail Dialog ─── */}
      <Dialog open={!!selectedDebtPatient} onOpenChange={(open) => !open && setSelectedDebtPatient(null)}>
        {selectedDebtPatient && (
          <DialogContent className="w-[95vw] max-w-lg p-0 overflow-hidden rounded-[2rem] border-none shadow-2xl [&>button]:hidden">
            {/* Header */}
            <div className="bg-slate-900 px-5 py-4 text-white relative">
              <button 
                onClick={() => setSelectedDebtPatient(null)} 
                className="absolute right-4 top-4 w-7 h-7 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 active:scale-95 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              <p className="text-[8px] font-black text-white/60 uppercase tracking-[0.3em] mb-0.5">
                Davolash Rejalari & Qarz
              </p>
              <h2 className="text-xl font-[900] tracking-tight">
                {selectedDebtPatient.full_name}
              </h2>
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-rose-500/20 text-white border border-rose-300/30">
                  Qolgan qarz: {formatCurrency(patientDetailData?.currentDebt ?? selectedDebtPatient.total_debt)}
                </span>
                {patientDetailData?.totalPaid > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-500/20 text-white border border-emerald-300/30">
                    To'langan: {formatCurrency(patientDetailData.totalPaid)}
                  </span>
                )}
              </div>
            </div>

            {/* Body */}
            <div className="p-4 bg-white space-y-3 max-h-[75vh] overflow-y-auto no-scrollbar">
              {loadingDetail ? (
                <div className="py-12 text-center space-y-2">
                  <div className="w-7 h-7 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-[11px] font-bold text-slate-400 uppercase">Yuklanmoqda...</p>
                </div>
              ) : (
                <>
                  {/* 4 CARDS */}
                  {(() => {
                    const origPrice = patientDetailData?.originalPrice ?? (Number(selectedDebtPatient.total_debt) + Number(patientDetailData?.totalPaid || 0));
                    const discAmt = patientDetailData?.totalDiscount ?? 0;
                    const discPct = patientDetailData?.discountPercent ?? (origPrice > 0 && discAmt > 0 ? Math.round((discAmt / origPrice) * 100) : 0);
                    const finTotal = patientDetailData?.finalPlanTotal ?? Math.max(0, origPrice - discAmt);
                    const curDebt = patientDetailData?.currentDebt ?? selectedDebtPatient.total_debt;

                    return (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Asl narxi</p>
                          <p className="text-xs font-[900] text-slate-800">
                            {origPrice.toLocaleString()} <span className="text-[8px] font-bold text-slate-400">so'm</span>
                          </p>
                        </div>
                        <div className="p-2.5 rounded-xl bg-purple-50/60 border border-purple-100">
                          <p className="text-[8px] font-black text-purple-500 uppercase tracking-widest mb-0.5">Chegirma</p>
                          <p className="text-xs font-[900] text-purple-700">
                            {discPct}% ({discAmt.toLocaleString()})
                          </p>
                        </div>
                        <div className="p-2.5 rounded-xl bg-blue-50/60 border border-blue-100">
                          <p className="text-[8px] font-black text-blue-500 uppercase tracking-widest mb-0.5">Chegirmali jami</p>
                          <p className="text-xs font-[900] text-blue-700">
                            {finTotal.toLocaleString()} <span className="text-[8px] font-bold text-blue-500">so'm</span>
                          </p>
                        </div>
                        <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-100">
                          <p className="text-[8px] font-black text-rose-400 uppercase tracking-widest mb-0.5">Qolgan qarz</p>
                          <p className={`text-xs font-[900] ${curDebt > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {curDebt > 0 ? `${curDebt.toLocaleString()} so'm` : "To'liq"}
                          </p>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Davolash rejalari bo'limi */}
                  <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
                    <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                      <h3 className="text-[10px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Receipt className="w-3 h-3 text-slate-400" />
                        Davolash rejalari ({detailPlans.length})
                      </h3>
                    </div>

                    {detailPlans.length === 0 ? (
                      <div className="p-4 text-center text-slate-400">
                        <p className="text-xs font-bold text-slate-500">Davolash rejasi yo'q</p>
                      </div>
                    ) : (
                      <div className="p-3 space-y-2.5">
                        {detailPlans.map((plan, pIdx) => {
                          const planTotal = Number(plan.total_price) || 0;
                          const planPaid = Number(plan.paid_amount) || 0;
                          const planRemaining = Math.max(0, planTotal - planPaid);
                          const planServices = plan.services || [];

                          return (
                            <div key={plan.id || pIdx} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-2">
                              <div className="flex items-center justify-between gap-1 border-b border-slate-200 pb-1.5">
                                <div>
                                  <h4 className="text-xs font-[900] text-slate-900">{plan.name || `Reja #${pIdx + 1}`}</h4>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black ${planRemaining > 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                    {planRemaining > 0 ? `${planRemaining.toLocaleString()} UZS` : 'Yopilgan'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedPlanForInvoice(plan);
                                      setShowPlanInvoiceModal(true);
                                    }}
                                    className="px-2 py-0.5 rounded-lg bg-blue-50 text-blue-600 text-[9px] font-black border border-blue-200"
                                  >
                                    Faktura
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* To'lovlar tarixi */}
                  <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
                    <div 
                      onClick={() => setShowDetailHistory(!showDetailHistory)}
                      className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between cursor-pointer"
                    >
                      <h3 className="text-[10px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-emerald-600" />
                        To'lovlar tarixi ({detailHistory.length})
                      </h3>
                      <span className="text-[9px] font-bold text-slate-400">
                        {showDetailHistory ? '▲ Yopish' : '▼ Ko\'rish'}
                      </span>
                    </div>

                    {showDetailHistory && (
                      <div className="p-3 space-y-1.5 max-h-[160px] overflow-y-auto no-scrollbar">
                        {detailHistory.length === 0 ? (
                          <p className="text-[11px] font-bold text-slate-400 py-2 text-center">To'lovlar topilmadi</p>
                        ) : (
                          detailHistory.map((hPay, hIdx) => {
                            const hAmt = Number(hPay.amount) || 0;
                            const isExpense = (hPay.type || '').toLowerCase() === 'expense';
                            return (
                              <div key={hPay.id || hIdx} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 text-[11px]">
                                <span className="font-bold text-slate-800">{hPay.method || 'Naqd'}</span>
                                <span className={`font-black ${isExpense ? 'text-rose-600' : 'text-emerald-600'}`}>
                                  {isExpense ? '-' : '+'}{hAmt.toLocaleString()} so'm
                                </span>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      variant="outline"
                      onClick={() => setSelectedDebtPatient(null)}
                      className="flex-1 h-10 rounded-xl font-bold uppercase text-[10px] border-slate-200 text-slate-600"
                    >
                      Yopish
                    </Button>
                    <Button
                      onClick={() => {
                        const pat = selectedDebtPatient;
                        setSelectedDebtPatient(null);
                        handlePayDebt(pat);
                      }}
                      className="flex-1 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] flex items-center justify-center gap-1.5"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      To'lov qilish
                    </Button>
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
