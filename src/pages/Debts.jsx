import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { sendTelegramMessage } from '@/api/telegramBot';
import { useTranslation } from '@/i18n/LanguageContext';
import { 
  Wallet, Search, User, Phone, 
  MessageSquare, ChevronRight,
  TrendingDown, CreditCard,
  ArrowUpRight, Copy, Check,
  AlertCircle, Filter
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import EmptyState from '../components/ui/EmptyState';
import { motion, AnimatePresence } from 'framer-motion';
import { formatPhone } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const formatCurrency = (val) => new Intl.NumberFormat('uz-UZ', { style: 'currency', currency: 'UZS', maximumFractionDigits: 0 }).format(val);

export default function Debts() {
  const { t } = useTranslation();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        // Fetch everything in parallel for maximum efficiency
        const [allPatients, allPayments] = await Promise.all([
          base44.entities.Patient.list('-created_date', 200), // full_name DB ustuni emas
          base44.entities.Payment.list('-created_date', 500), // date DB ustuni emas
        ]);


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
  }, []);

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
                      <tr key={p.id} className="hover:bg-slate-50/40 transition-colors group">
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
                              <p 
                                className="font-bold text-slate-850 text-[13px] truncate hover:text-rose-600 transition-colors cursor-pointer" 
                                title={p.full_name}
                                onClick={() => navigate(`/patients/${p.id}`)}
                              >
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
                          <span className={`font-bold text-[13px] tracking-tight ${p.real_debt > 5000000 ? 'text-rose-650' : 'text-amber-650'}`}>
                            {formatCurrency(p.real_debt || 0).replace(" so'm", "")}
                            <span className="text-[9px] ml-0.5 opacity-60 uppercase font-medium">uzs</span>
                          </span>
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
                            {p.phone && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7.5 w-7.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 transition-colors shrink-0"
                                onClick={() => handleCall(p.phone)}
                                title={t('recall.makeCall') || "Qo'ng'iroq qilish"}
                              >
                                <Phone className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7.5 w-7.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 transition-colors shrink-0 p-0"
                              onClick={() => handleSendReminder(p)}
                              title={t('debts.sendReminderTooltip') || "SMS / Telegram eslatma yuborish"}
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7.5 w-7.5 rounded-lg bg-slate-50 text-slate-450 hover:bg-slate-900 hover:text-white transition-all shrink-0 p-0 cursor-pointer"
                              onClick={() => navigate(`/patients/${p.id}`)}
                              title={t('debts.patientProfileTooltip') || "Bemor profili"}
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
                    <div className="flex items-start justify-between mb-3 gap-2">
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

                    <div className="grid grid-cols-3 gap-2">
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
                        onClick={() => navigate(`/patients/${p.id}`)}
                        className="h-9 rounded-lg bg-white border-slate-100 text-slate-700 font-bold text-[10px] gap-1 hover:bg-slate-50 p-0 border cursor-pointer"
                      >
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" /> {t('debts.table.profile') || 'Profil'}
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
