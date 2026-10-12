import { useState, useEffect } from 'react';
import { profileState } from '@/hooks/useBack';
import { useRestorableState } from '@/hooks/useRestorableState';
import { useTranslation } from '@/i18n/LanguageContext';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { 
  AlertTriangle, Calendar, Clock, User, 
  Phone, MessageSquare, ChevronRight, 
  TrendingDown, History, Search, Filter, Smile, Coins, CalendarPlus, CalendarDays, CalendarX2, Plus, UserRound
} from 'lucide-react';
import EmptyState from '../components/ui/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';

const formatCurrency = (val) => `${Number(val || 0).toLocaleString('uz-UZ')} UZS`;

export default function NoShow() {
  const { t } = useTranslation();
  const { user, isDoctor } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useRestorableState('searchQuery', '');
  const navigate = useNavigate();
  const [period, setPeriod] = useRestorableState('period', 'all');

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

  // Phone-only period filter (Hammasi / Bu hafta / Bu oy / Muddat o'tgan)
  const daysAgo = (a) => {
    const d = new Date(String(a.date || '').split('T')[0] + 'T00:00:00');
    if (isNaN(d.getTime())) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return Math.round((today - d) / 86400000);
  };
  const PERIODS = [
    { k: 'all', label: 'Hammasi' },
    { k: 'week', label: 'Bu hafta' },
    { k: 'month', label: 'Bu oy' },
    { k: 'overdue', label: "Muddat o'tgan" },
  ];
  const mobileAppointments = filteredAppointments.filter(a => {
    if (period === 'all') return true;
    const n = daysAgo(a);
    if (period === 'week') return n != null && n >= 0 && n < 7;
    if (period === 'month') return a.date?.startsWith(thisMonth);
    if (period === 'overdue') return n != null && n > 30;
    return true;
  });
  const fmtPhone = (ph) => {
    const d = String(ph || '').replace(/\D/g, '');
    if (d.length === 12 && d.startsWith('998')) return `+998 ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10)}`;
    if (d.length === 9) return `+998 ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7)}`;
    return ph;
  };
  const fmtDate = (v) => {
    const s = String(v || '').split('T')[0];
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    return m ? `${m[3]}.${m[2]}.${m[1]}` : s;
  };
  const initialsOf = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('') || '?';
  const AVATAR_TONES = ['bg-blue-50 text-blue-600', 'bg-emerald-50 text-emerald-600', 'bg-orange-50 text-orange-600', 'bg-violet-50 text-violet-600'];
  const fmtSom = (v) => `${Number(v || 0).toLocaleString('ru-RU').replace(/[\s,\u00a0]/g, ' ')} so'm`;

  return (
    <div className="space-y-4.5 pb-24 sm:pb-10 bg-slate-50/30 min-h-screen -m-4 p-4 sm:m-0 sm:p-0">
      {/* Premium Header */}
      <div className="px-1 sm:px-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl max-sm:text-[21px] font-black tracking-tight text-red-600 max-sm:text-slate-900 flex items-center gap-2.5">
            <AlertTriangle className="w-6 h-6 stroke-[2.5px]" />
            {t('noShow.title')}
          </h1>
          <p className="text-[10px] max-sm:text-[12px] font-bold text-slate-400 mt-0.5 uppercase tracking-wider">
            {t('noShow.subtitle') || "Kelmagan bemorlar va yo'qotilgan daromad tahlili"}
          </p>
        </div>
      </div>

      {/* Dynamic Stats Cards */}
      <div className="sm:hidden bg-white rounded-2xl border border-slate-100 shadow-sm grid grid-cols-[1fr_0.8fr_1.25fr] divide-x divide-slate-100 py-3.5">
        <div className="px-3">
          <span className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2"><History className="w-5 h-5" /></span>
          <p className="text-[11px] font-bold text-slate-400 uppercase leading-tight">{t('noShow.stats.total')}</p>
          <p className="text-[19px] font-black text-slate-900 mt-1 leading-none">{appointments.length}</p>
        </div>
        <div className="px-3">
          <span className="w-9 h-9 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center mb-2"><CalendarDays className="w-5 h-5" /></span>
          <p className="text-[11px] font-bold text-slate-400 uppercase leading-tight">{t('noShow.stats.thisMonth') || 'Shu oyda'}</p>
          <p className="text-[19px] font-black text-slate-900 mt-1 leading-none">{monthlyNoShows.length}</p>
        </div>
        <div className="px-3 min-w-0">
          <span className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mb-2"><TrendingDown className="w-5 h-5" /></span>
          <p className="text-[11px] font-bold text-slate-400 uppercase leading-tight">{t('noShow.stats.lostRevenue') || "Yo'qotilgan"}</p>
          <p className="text-[16px] font-black text-rose-600 mt-1 leading-none truncate">{fmtSom(totalLostRevenue)}</p>
        </div>
      </div>

      <div className="max-sm:hidden grid grid-cols-1 sm:grid-cols-3 gap-4 px-1 sm:px-0">
        {/* Card 1 */}
        <div className="bg-white border border-slate-100 rounded-xl p-3.5 flex items-center gap-3.5 shadow-sm">
          <div className="w-9.5 h-9.5 rounded-lg bg-slate-50 text-slate-650 flex items-center justify-center shrink-0">
            <History className="w-4.5 h-4.5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('noShow.stats.total')}</p>
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
              {formatCurrency(totalLostRevenue)}
            </p>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="px-1 sm:px-0 max-sm:flex max-sm:gap-2">
        <div className="relative group max-sm:flex-1 max-sm:min-w-0">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-red-500 transition-colors pointer-events-none" />
          <Input 
            placeholder={t('noShow.searchPlaceholder') || 'Bemor ismini qidirish...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 max-sm:h-12 max-sm:text-[14px] max-sm:font-medium pl-10 pr-4 rounded-xl border-slate-200 bg-white placeholder:text-slate-400 text-sm font-semibold focus-visible:ring-1 focus-visible:ring-slate-350"
          />
        </div>
        <button
          type="button"
          onClick={() => setPeriod(PERIODS[(PERIODS.findIndex(x => x.k === period) + 1) % PERIODS.length].k)}
          className="sm:hidden h-12 px-4 shrink-0 rounded-xl border border-slate-200 bg-white inline-flex items-center gap-2 text-[14px] font-bold text-slate-700"
        >
          <Filter className="w-4.5 h-4.5" /> Filtr
        </button>
      </div>

      <div className="sm:hidden flex gap-2 overflow-x-auto no-scrollbar px-1">
        {PERIODS.map(f => (
          <button
            key={f.k}
            type="button"
            onClick={() => setPeriod(f.k)}
            className={`shrink-0 min-h-[44px] px-4 rounded-full text-[13px] font-bold border transition-all ${period === f.k ? 'bg-[#0F8F86] text-white border-transparent' : 'bg-slate-100 text-slate-600 border-slate-100'}`}
          >
            {f.label}
          </button>
        ))}
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
              title={t('noShow.emptyTitle')} 
              description={searchQuery ? t('noShow.searchEmpty') : t('noShow.emptyDescription')} 
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
                            -{appt.price ? formatCurrency(appt.price) : '0 UZS'}
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
                                onClick={() => navigate(`/patients/${appt.patient_id}`, { state: profileState() })}
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
            <div className="sm:hidden space-y-3">
              {mobileAppointments.map((appt, index) => {
                const n = daysAgo(appt);
                return (
                  <div key={appt.id} className="bg-white border border-slate-100 rounded-2xl shadow-sm p-3.5 content-visibility-auto">
                    <div className="flex items-start gap-3">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 text-[16px] font-black ${AVATAR_TONES[index % AVATAR_TONES.length]}`}>
                        {initialsOf(appt.patient_name)}
                      </div>
                      <div className="flex-1 min-w-0 pt-0.5">
                        <h3 className="text-[16px] font-black text-slate-900 truncate">{appt.patient_name}</h3>
                        <p className="text-[13px] text-slate-500 mt-0.5 truncate">{appt.phone ? fmtPhone(appt.phone) : (t('noShow.noPhone') || "Telefon yo'q")}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="inline-block px-2 py-0.5 rounded-md bg-rose-50 text-rose-600 text-[12px] font-bold">Kelmagan</span>
                        <p className="mt-1 text-[13px] text-slate-700 flex items-center justify-end gap-1"><Calendar className="w-3.5 h-3.5" />{fmtDate(appt.date)}{appt.time ? `, ${appt.time}` : ''}</p>
                        {n != null && n >= 0 && (
                          <p className="text-[12px] text-rose-500 flex items-center justify-end gap-1"><Clock className="w-3 h-3" />{n === 0 ? 'bugun' : `${n} kun oldin`}</p>
                        )}
                      </div>
                    </div>
                    <div className="mt-2.5 flex items-center gap-3 text-[13px] text-slate-500 min-w-0">
                      <span className="flex items-center gap-1.5 min-w-0 truncate"><UserRound className="w-4 h-4 shrink-0" />{appt.doctor_name || '—'}</span>
                      {appt.service_name && <span className="flex items-center gap-1.5 min-w-0 truncate"><Smile className="w-4 h-4 shrink-0" />{appt.service_name}</span>}
                      <span className="ml-auto flex items-center gap-1 text-rose-600 font-bold shrink-0"><Coins className="w-4 h-4" />{fmtSom(appt.price)}</span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => handleCall(appt.phone)} className="h-12 rounded-xl border border-[#0F8F86]/40 text-[#0F8F86] text-[14px] font-bold inline-flex items-center justify-center gap-2">
                        <Phone className="w-4.5 h-4.5" /> Qo'ng'iroq qilish
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate('/appointments', { state: { openAddModal: true, prefillPatient: appt.patient_id, prefillPatientName: appt.patient_name } })}
                        className="h-12 rounded-xl bg-[#0F8F86] text-white text-[14px] font-bold inline-flex items-center justify-center gap-2"
                      >
                        <CalendarPlus className="w-4.5 h-4.5" /> Qayta yozish
                      </button>
                    </div>
                  </div>
                );
              })}
              <div className="bg-white border border-slate-100 rounded-2xl shadow-sm py-7 flex flex-col items-center text-center">
                <div className="relative w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center">
                  <CalendarX2 className="w-8 h-8 text-[#0F8F86]" />
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center"><Plus className="w-3.5 h-3.5" /></span>
                </div>
                <p className="mt-3 text-[15px] font-black text-slate-900">{mobileAppointments.length ? "Boshqa kelmagan uchrashuvlar yo'q" : "Kelmagan uchrashuvlar yo'q"}</p>
                <p className="mt-1 text-[13px] text-slate-500">Hozircha kelmagan bemorlar ro'yxati bo'sh</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
