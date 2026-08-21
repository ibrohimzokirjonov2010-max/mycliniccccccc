import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Wallet, Search, Phone, MessageSquare, User, 
  ChevronRight, ArrowLeft, TrendingUp, AlertCircle,
  Copy, Check
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import PullToRefresh from '@/components/ui/PullToRefresh';
import { formatCurrency } from '@/lib/utils';
import toast from 'react-hot-toast';
import { useTranslation } from '@/i18n/LanguageContext';

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
                  transition={{ duration: 0.2, delay: index * 0.03 }}
                  className="bg-white rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-slate-100 active:scale-[0.99] transition-transform"
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
                        onClick={() => navigate(`/patients/${patient.id}`)}
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
                      <div className="text-right shrink-0">
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

                    {/* Action buttons — compact 3-col */}
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        onClick={() => handleCall(patient.phone)}
                        disabled={!patient.phone}
                        className="h-9 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-100 active:bg-emerald-100 transition-colors disabled:opacity-40"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        Qo'ng'iroq
                      </button>
                      <button
                        onClick={() => handleSMS(patient.phone, patient.full_name, patient.total_debt)}
                        disabled={!patient.phone}
                        className="h-9 flex items-center justify-center gap-1.5 rounded-xl bg-blue-50 text-blue-700 text-[11px] font-bold border border-blue-100 active:bg-blue-100 transition-colors disabled:opacity-40"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        Xabar
                      </button>
                      <button
                        onClick={() => navigate(`/patients/${patient.id}`)}
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
    </div>
  );
}
