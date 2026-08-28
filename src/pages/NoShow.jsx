import { useState, useEffect } from 'react';
import { useTranslation } from '@/i18n/LanguageContext';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { 
  AlertTriangle, Calendar, Clock, User, 
  Phone, MessageSquare, ChevronRight, 
  TrendingDown, History, Search
} from 'lucide-react';
import EmptyState from '../components/ui/EmptyState';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';

const formatCurrency = (val) => new Intl.NumberFormat('uz-UZ', { style: 'currency', currency: 'UZS', maximumFractionDigits: 0 }).format(val);

export default function NoShow() {
  const { t } = useTranslation();
  const { user, isDoctor } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const load = async () => {
    try {
      setLoading(true);
      const [data, pts] = await Promise.all([
         base44.entities.Appointment.filter({ status: 'No-Show' }, '-date', 200), // ⚡
         base44.entities.Patient.list('full_name', 200)  // ⚡
      ]);
      
      const ptsMap = new Map((pts || []).map(p => [p.id, p]));
      let appointmentsWithPhones = (data || []).map(appt => ({
        ...appt,
        phone: ptsMap.get(appt.patient_id)?.phone
      }));

      // Doktor bo'lsa faqat o'ziga tayinlangan uchrashuvlarni ko'rsin
      if (isDoctor && user?.id) {
        appointmentsWithPhones = appointmentsWithPhones.filter(appt =>
          String(appt.doctor_id) === String(user.id) ||
          String(appt.doctor_name || '').toLowerCase() === String(user.name || '').toLowerCase()
        );
      }

      setAppointments(appointmentsWithPhones);
    } catch (err) {
      console.error("NoShow load error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [isDoctor, user?.id]);

  const handleCall = (phone) => {
    if (phone) {
      window.location.href = `tel:${phone}`;
    } else {
      alert(t('noShow.phoneNotFound') || "Telefon raqami topilmadi");
    }
  };

  const handleSMS = (phone, name) => {
    if (phone) {
      const message = (t('noShow.smsMessage') || "Assalomu alaykum {name}, bugungi uchrashuvga kela olmaganingiz sababli siz bilan bog'lana olmadik. Qayta vaqt belgilash uchun javob yozishingizni so'raymiz.").replace('{name}', name);
      window.location.href = `sms:${phone}?body=${encodeURIComponent(message)}`;
    } else {
      alert(t('noShow.phoneNotFound') || "Telefon raqami topilmadi");
    }
  };

  const thisMonth = new Date().toISOString().substring(0, 7);
  const monthlyNoShows = appointments.filter(a => a.date?.startsWith(thisMonth));
  const totalLostRevenue = appointments.reduce((s, a) => s + (a.price || 0), 0);

  const filteredAppointments = appointments.filter(a => 
    a.patient_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4.5 pb-24 sm:pb-10 bg-slate-50/30 min-h-screen -m-4 p-4 sm:m-0 sm:p-0">
      {/* Premium Header */}
      <div className="px-1 sm:px-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight text-red-600 flex items-center gap-2.5">
            <AlertTriangle className="w-6 h-6 stroke-[2.5px]" />
            {t('noShow.title') || 'No-Show Nazorat'}
          </h1>
          <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-wider">
            {t('noShow.subtitle') || "Kelmagan bemorlar va yo'qotilgan daromad tahlili"}
          </p>
        </div>
      </div>

      {/* Dynamic Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 px-1 sm:px-0">
        {/* Card 1 */}
        <div className="bg-white border border-slate-100 rounded-xl p-3.5 flex items-center gap-3.5 shadow-sm">
          <div className="w-9.5 h-9.5 rounded-lg bg-slate-50 text-slate-650 flex items-center justify-center shrink-0">
            <History className="w-4.5 h-4.5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('noShow.stats.total') || 'Jami No-Show'}</p>
            <p className="text-xl font-black text-slate-900 mt-0.5">{appointments.length}</p>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white border border-slate-100 rounded-xl p-3.5 flex items-center gap-3.5 shadow-sm">
          <div className="w-9.5 h-9.5 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
            <Calendar className="w-4.5 h-4.5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('noShow.stats.thisMonth') || 'Shu oyda'}</p>
            <p className="text-xl font-black text-slate-900 mt-0.5">{monthlyNoShows.length}</p>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white border border-slate-100 rounded-xl p-3.5 flex items-center gap-3.5 shadow-sm">
          <div className="w-9.5 h-9.5 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <TrendingDown className="w-4.5 h-4.5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('noShow.stats.lostRevenue') || 'Yo\'qotilgan'}</p>
            <p className="text-xl font-black text-rose-600 mt-0.5">
              {formatCurrency(totalLostRevenue).replace(" so'm", "")}
              <span className="text-[10px] ml-0.5 opacity-60">UZS</span>
            </p>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="px-1 sm:px-0">
        <div className="relative group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-red-500 transition-colors pointer-events-none" />
          <Input 
            placeholder={t('noShow.searchPlaceholder') || 'Bemor ismini qidirish...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 pl-10 pr-4 rounded-xl border-slate-200 bg-white placeholder:text-slate-400 text-sm font-semibold focus-visible:ring-1 focus-visible:ring-slate-350"
          />
        </div>
      </div>

      {/* Bemorlar Ro'yxati */}
      <div className="px-1 sm:px-0">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-white rounded-xl border border-slate-100 animate-pulse" />
            ))}
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center shadow-sm">
            <EmptyState 
              icon={AlertTriangle} 
              title={t('noShow.emptyTitle') || "No-Show yo'q"} 
              description={searchQuery ? (t('noShow.searchEmpty') || "Qidiruv bo'yicha hech kim topilmadi") : (t('noShow.emptyDescription') || "Hozircha no-show bemorlar ro'yxati bo'sh")} 
            />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Desktop Table View */}
            <div className="hidden sm:block bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto no-scrollbar">
                <table className="w-full text-left border-collapse table-fixed min-w-[850px]">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-[30%] min-w-[200px]">{t('noShow.table.patient') || 'Bemor'}</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-[20%] min-w-[150px]">{t('noShow.table.time') || 'Tashrif vaqti'}</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-[20%] min-w-[150px]">{t('noShow.table.service') || 'Xizmat'}</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-[15%] min-w-[110px]">{t('noShow.table.lost') || 'Yo\'qotilgan'}</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right w-[15%] min-w-[130px]">{t('noShow.table.actions') || 'Amallar'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredAppointments.map((appt) => (
                      <tr key={appt.id} className="hover:bg-slate-50/40 transition-colors group">
                        <td className="px-4 py-2.5 w-[30%] min-w-[200px]">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8.5 h-8.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-red-50 group-hover:text-red-500 transition-colors shrink-0">
                              <User className="w-4.5 h-4.5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-slate-800 text-[13px] truncate" title={appt.patient_name}>{appt.patient_name}</p>
                              <p className="text-[10.5px] font-medium text-slate-500 mt-0.5 truncate">{appt.phone || t('noShow.noPhone') || "Telefon yo'q"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 w-[20%] min-w-[150px]">
                          <div className="flex items-center gap-1.5 text-[11.5px] font-bold text-slate-700">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>{appt.date?.split('T')[0] || appt.date}</span>
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                            <Clock className="w-3 h-3" />
                            <span>{appt.time}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 w-[20%] min-w-[150px]">
                          {appt.service_name ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-50 border border-slate-100 text-[10px] font-bold text-slate-650">
                              <span className="w-1 h-1 rounded-full bg-blue-500" />
                              {appt.service_name}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 w-[15%] min-w-[110px]">
                          <p className="font-bold text-rose-600 text-[13px] tracking-tight whitespace-nowrap">
                            -{appt.price ? formatCurrency(appt.price).replace(" so'm", "") : '0'}
                            <span className="text-[9px] ml-0.5 text-rose-500 uppercase font-medium">uzs</span>
                          </p>
                        </td>
                        <td className="px-4 py-2.5 text-right w-[15%] min-w-[130px]">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7.5 w-7.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 transition-colors shrink-0"
                              onClick={() => handleCall(appt.phone)}
                              title={t('recall.makeCall') || "Qo'ng'iroq qilish"}
                            >
                              <Phone className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7.5 w-7.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 transition-colors shrink-0"
                              onClick={() => handleSMS(appt.phone, appt.patient_name)}
                              title={t('recall.sendSms') || "SMS yuborish"}
                            >
                              <MessageSquare className="w-3 h-3" />
                            </Button>
                            {appt.patient_id && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7.5 w-7.5 rounded-lg bg-slate-50 text-slate-450 hover:bg-slate-900 hover:text-white transition-all shrink-0 animate-none p-0"
                                onClick={() => navigate(`/patients/${appt.patient_id}`)}
                                title={t('noShow.patientProfile') || "Bemor profili"}
                              >
                                <ChevronRight className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile View - Sleek Cards */}
            <div className="sm:hidden space-y-3.5">
              <AnimatePresence mode="popLayout">
                {filteredAppointments.map((appt, index) => (
                  <motion.div 
                    key={appt.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: Math.min(index, 6) * 0.02 }}
                    className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 group content-visibility-auto"
                  >
                    <div className="p-3.5">
                      <div className="flex items-start justify-between mb-3 gap-2">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 shrink-0">
                            <User className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-slate-800 tracking-tight truncate max-w-[150px]">
                              {appt.patient_name}
                            </h3>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">{appt.phone || t('noShow.noPhone') || "Telefon yo'q"}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{t('noShow.table.lost') || 'Yo\'qotilgan'}</p>
                          <p className="text-sm font-bold text-rose-600 tracking-tight">
                            -{appt.price ? formatCurrency(appt.price).replace(" so'm", "") : '0'} <span className="text-[8px] opacity-60">UZS</span>
                          </p>
                        </div>
                      </div>

                      {appt.service_name && (
                        <div className="mb-3 px-2.5 py-1 bg-slate-50 rounded-lg inline-block border border-slate-100/50">
                          <p className="text-[9.5px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                            <span className="w-1 h-1 rounded-full bg-blue-500" />
                            {appt.service_name}
                          </p>
                        </div>
                      )}

                      <div className="flex justify-between items-center pt-2.5 border-t border-slate-50 text-[11px] text-slate-400">
                        <div className="flex items-center gap-1.5 font-semibold text-slate-500">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{appt.date?.split('T')[0] || appt.date}</span>
                          <span className="text-slate-300">•</span>
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{appt.time}</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleCall(appt.phone)}
                            className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 p-0 hover:bg-blue-100"
                          >
                            <Phone className="w-3 h-3" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleSMS(appt.phone, appt.patient_name)}
                            className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 p-0 hover:bg-emerald-100"
                          >
                            <MessageSquare className="w-3 h-3" />
                          </Button>
                          {appt.patient_id && (
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => navigate(`/patients/${appt.patient_id}`)}
                              className="h-8 w-8 rounded-lg bg-slate-50 text-slate-450 p-0 hover:bg-slate-100"
                            >
                              <ChevronRight className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
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
