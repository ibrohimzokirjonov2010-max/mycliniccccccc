import { useState, useEffect, useCallback, useRef } from 'react';
import { profileState } from '@/hooks/useBack';
import { useNavigate, useLocation } from 'react-router-dom';
import { useRestorableState } from '@/hooks/useRestorableState';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Plus, X,
  User, Calendar, Phone, ChevronRight, Users, SlidersHorizontal, Send, Wallet, AlarmClock, BadgeCheck
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import PullToRefresh from '@/components/ui/PullToRefresh';
import { formatCurrency, capitalizeName, formatDate, formatPhone } from '@/lib/utils';
import { patientMatchesDoctorFilter } from '@/utils/doctorMatch';
import { buildVisitIndex, isActiveTreatmentPatient, isNewPatient, lastVisitKey } from '@/lib/patientVisits';
import NewPatientFlow from '@/components/patients/NewPatientFlow';
import { useTranslation } from '@/i18n/LanguageContext';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';

/**
 * Premium SaaS Mobile Patients List
 * Modern healthcare CRM design with strong hierarchy
 */
function compactSom(n) {
  const v = Number(n) || 0;
  const fmt = (x) => (Math.floor(x * 10) / 10).toFixed(1).replace(/\.0$/, '').replace('.', ',');
  if (v >= 1e9) return `${fmt(v / 1e9)} mlrd so'm`;
  if (v >= 1e6) return `${fmt(v / 1e6)} mln so'm`;
  if (v >= 1e3) return `${fmt(v / 1e3)} ming so'm`;
  return `${Math.round(v)} so'm`;
}

export default function MobilePatientsV2() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { user, isDoctor } = useAuth();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const loadingTimerRef = useRef(null);
  const hasLoadedInitial = useRef(false);
  const [searchQuery, setSearchQuery] = useRestorableState('searchQuery', '');
  const [filterStatus, setFilterStatus] = useRestorableState('filterStatus', 'all');
  const [showFlow, setShowFlow] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [visitIndex, setVisitIndex] = useState({ completed: new Set(), last: {} });

  // Xodimlar sahifasidan kelgan "shifokor bo'yicha" filtr
  const [doctorFilter, setDoctorFilter] = useRestorableState('doctorFilter', () => location.state?.doctorFilter || null);
  useEffect(() => {
    const incoming = location.state?.doctorFilter;
    if (incoming) {
      setDoctorFilter(incoming);
      window.history.replaceState({ ...(window.history.state || {}), usr: null }, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    if (location.state?.openAddModal) {
      setShowFlow(true);
      window.history.replaceState({ ...(window.history.state || {}), usr: null }, document.title);
    }
  }, [location.state]);

  const loadPatients = useCallback(async () => {
    // Auth race: do not paint empty list before user is ready
    if (!user) {
      setLoading(true);
      return;
    }
    try {
      if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
      if (!hasLoadedInitial.current) {
        setLoading(true);
      }
      let data = [];
      if (isDoctor && user?.id) {
        // Ikki shart: 1) biriktirilgan (main_treatment_provider)  2) qo'shgan (created_by_id)
        const allPats = await base44.entities.Patient.list('-created_date', 500).catch(() => []);
        data = (allPats || []).filter(p =>
          String(p.main_treatment_provider) === String(user.id) ||
          String(p.main_treatment_provider) === String(user.name) ||
          String(p.created_by_id) === String(user.id)
        );
      } else {
        data = await base44.entities.Patient.list('-created_date', 500);
      }
      const [appts, plans] = await Promise.all([
        base44.entities.Appointment.list('-date', 1000).catch(() => []),
        base44.entities.TreatmentPlan.list('-created_date', 500).catch(() => []),
      ]);
      setVisitIndex(buildVisitIndex(appts, plans));
      setPatients(data || []);
      setTotalCount((data || []).length);
      hasLoadedInitial.current = true;
    } catch (error) {
      console.error('Failed to load patients:', error);
      toast.error('Bemorlarni yuklashda xatolik');
    } finally {
      if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
      setLoading(false);
    }
  }, [isDoctor, user]);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  useEffect(() => {
    window.addEventListener('crm-data-updated', loadPatients);
    return () => window.removeEventListener('crm-data-updated', loadPatients);
  }, [loadPatients]);

  const filteredPatients = patients.filter(p => {
    if (doctorFilter && !patientMatchesDoctorFilter(p, doctorFilter)) return false;
    const matchesSearch = p.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         p.phone?.includes(searchQuery);
    const fresh = isNewPatient(p, visitIndex);
    const matchesStatus = filterStatus === 'all' || (filterStatus === 'Debt' && (p.total_debt || 0) > 0)
      || (filterStatus === 'New' ? fresh : filterStatus === 'Active' ? isActiveTreatmentPatient(p) : p.status === filterStatus);
    return matchesSearch && matchesStatus;
  });

  const statusConfig = {
    'Active': { 
      bg: 'bg-emerald-50', 
      text: 'text-emerald-700',
      dot: 'bg-emerald-500',
      label: t('patients.active')
    },
    'New': { 
      bg: 'bg-blue-50', 
      text: 'text-blue-700',
      dot: 'bg-blue-500',
      label: t('patients.new')
    },
    'Inactive': { 
      bg: 'bg-slate-100', 
      text: 'text-slate-600',
      dot: 'bg-slate-400',
      label: t('patients.inactive')
    },
    'Waiting': { 
      bg: 'bg-amber-50', 
      text: 'text-amber-700',
      dot: 'bg-amber-500',
      label: t('common.pending')
    }
  };

  const getStatusStyle = (status) => statusConfig[status] || statusConfig['New'];



  const SkeletonCard = () => (
    <div className="bg-white rounded-[2.5rem] p-6 mb-4 border border-slate-50 shadow-sm">
      <div className="flex items-start gap-4 mb-5">
        <div className="w-16 h-16 rounded-[1.5rem] bg-slate-100 animate-pulse shrink-0" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="w-3/4 h-5 bg-slate-100 rounded animate-pulse" />
          <div className="w-1/2 h-4 bg-slate-100 rounded animate-pulse" />
        </div>
      </div>
      <div className="flex gap-3 mb-5">
        <div className="flex-1 h-14 bg-slate-50 rounded-2xl animate-pulse" />
        <div className="flex-1 h-14 bg-slate-50 rounded-2xl animate-pulse" />
      </div>
      <div className="flex justify-between items-center">
        <div className="w-24 h-4 bg-slate-50 rounded animate-pulse" />
        <div className="w-20 h-8 bg-slate-50 rounded-2xl animate-pulse" />
      </div>
    </div>
  );

  const scopedPatients = doctorFilter ? patients.filter((p) => patientMatchesDoctorFilter(p, doctorFilter)) : patients;
  const totalDebt = scopedPatients.reduce((sum, p) => sum + (p.total_debt || 0), 0);
  const newCount = scopedPatients.filter(p => isNewPatient(p, visitIndex)).length;
  const activeCount = scopedPatients.filter(isActiveTreatmentPatient).length;

  return (
    <PullToRefresh onRefresh={loadPatients}>
      <div className="min-h-screen bg-[#F4F7F9]">
        <div className="bg-[#F4F7F9] sticky top-0 z-10">
          <div className="px-4 pt-3 pb-3">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#1FB59A] to-[#13917C] text-white flex items-center justify-center shadow-md shadow-emerald-600/20 shrink-0">
                  <Users className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-[24px] font-extrabold text-slate-900 leading-tight">{t('patients.title')}</h1>
                  <p className="text-[14px] text-slate-500 leading-tight">
                    <span className="font-bold text-slate-800">{doctorFilter ? scopedPatients.length : (totalCount || patients.length)}</span> Bemorlar ro'yxati
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowFlow(true)}
                className="shrink-0 h-12 px-4 rounded-2xl bg-gradient-to-r from-[#1FB59A] to-[#13917C] text-white text-[15px] font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-600/25 active:scale-[0.98]"
              >
                <Plus className="w-5 h-5" />
                Bemor qo'shish
              </button>
            </div>

            {doctorFilter && (
              <div className="mb-3 flex items-center justify-between gap-2 bg-[#1499AD]/10 border border-[#1499AD]/20 rounded-2xl px-4 py-2.5">
                <span className="text-[13px] font-black text-[#1499AD] truncate">Shifokor: {doctorFilter.name}</span>
                <button
                  type="button"
                  onClick={() => setDoctorFilter(null)}
                  className="shrink-0 inline-flex items-center gap-1 h-9 px-3 bg-white rounded-lg text-[13px] font-bold text-slate-500 border border-slate-100 shadow-sm"
                >
                  <X className="w-3.5 h-3.5" /> Tozalash
                </button>
              </div>
            )}

            <div className="flex gap-2 mb-3">
              <div className="relative flex-1">
                <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Bemor ismi, telefon yoki ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 h-12 bg-white border border-slate-200 rounded-2xl font-medium text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 outline-none text-[15px]"
                />
              </div>
              <button
                type="button"
                aria-label="Faqat qarzdorlar"
                onClick={() => setFilterStatus(filterStatus === 'Debt' ? 'all' : 'Debt')}
                className={`w-12 h-12 shrink-0 rounded-2xl border flex items-center justify-center ${filterStatus === 'Debt' ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-white border-slate-200 text-slate-600'}`}
              >
                <SlidersHorizontal className="w-5 h-5" />
              </button>
            </div>

            <div className="flex gap-2 overflow-x-auto no-scrollbar py-0.5">
              {[
                { id: 'all', label: t('common.all') },
                { id: 'Active', label: t('patients.active') },
                { id: 'New', label: t('patients.new') },
                { id: 'Inactive', label: t('patients.inactive') },
                ...(filterStatus === 'Debt' ? [{ id: 'Debt', label: `Qarzdorlar · ${compactSom(totalDebt)}` }] : []),
              ].map(filter => (
                <button
                  key={filter.id}
                  onClick={() => setFilterStatus(filter.id)}
                  className={`shrink-0 h-11 px-5 rounded-2xl text-[14px] font-bold whitespace-nowrap transition-all ${
                    filterStatus === filter.id
                      ? 'bg-slate-900 text-white shadow-md shadow-slate-300'
                      : 'bg-white text-slate-600 border border-slate-200'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="px-4 pt-3 pb-4">
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : filteredPatients.length > 0 ? (
            <AnimatePresence mode="popLayout">
              {filteredPatients.map((patient, index) => {
                const fresh = isNewPatient(patient, visitIndex);
                const status = getStatusStyle(fresh ? 'New' : (patient.status === 'New' || !patient.status ? 'Active' : patient.status));
                const lastVisit = lastVisitKey(patient, visitIndex);
                const hasDebt = patient.total_debt > 0;
                return (
                  <motion.div
                    key={patient.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: searchQuery ? 0 : Math.min(index, 6) * 0.02 }}
                    onClick={() => navigate(`/patients/${patient.id}`, { state: profileState() })}
                    className="bg-white rounded-[20px] p-3.5 mb-3 shadow-[0_2px_10px_rgba(15,23,42,0.05)] border border-slate-100 active:scale-[0.99] transition-transform content-visibility-auto"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 text-[16px] font-bold overflow-hidden shrink-0">
                        {(patient.photo_url || patient.photo) ? (
                          <img src={patient.photo_url || patient.photo} alt={capitalizeName(patient.full_name)} className="w-full h-full object-cover" />
                        ) : (
                          (patient.full_name || '?').trim().split(/\s+/).map((x) => x[0]).join('').slice(0, 2).toUpperCase()
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-extrabold text-[16px] text-slate-900 truncate leading-snug">{capitalizeName(patient.full_name)}</h3>
                        <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                          <Phone className="w-3 h-3 text-slate-500 shrink-0" />
                          <span className="text-[13px] font-semibold text-slate-600 whitespace-nowrap">{patient.phone ? formatPhone(patient.phone) : "Raqam yo'q"}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-[13px] text-slate-500 whitespace-nowrap">{lastVisit ? formatDate(lastVisit) : "Tashrif yo'q"}</span>
                          {hasDebt ? (
                            <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-rose-50 text-[13px] font-bold text-rose-500">Qarz</span>
                          ) : (
                            <span className={`shrink-0 px-1.5 py-0.5 rounded-md text-[13px] font-bold uppercase ${status.bg} ${status.text}`}>{status.label}</span>
                          )}
                        </div>
                      </div>
                      <div className={`shrink-0 rounded-xl px-2 py-1.5 flex items-center gap-1 ${hasDebt ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-700'}`}>
                        {hasDebt ? <AlarmClock className="w-4 h-4 shrink-0" /> : <BadgeCheck className="w-4 h-4 shrink-0" />}
                        <div className="leading-tight">
                          <p className="text-[12px] font-semibold">{hasDebt ? 'Qarz' : 'Qarzsiz'}</p>
                          <p className="text-[13px] font-extrabold whitespace-nowrap">{hasDebt ? formatCurrency(patient.total_debt) : "0 so'm"}</p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 -ml-1.5 -mr-1" />
                    </div>
                    <div className="grid grid-cols-[1.15fr_1.1fr_1.1fr_0.85fr] gap-1.5 mt-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (patient.phone) {
                            const cleaned = patient.phone.replace(/\D/g, '');
                            window.open(`tel:+${cleaned.startsWith('998') ? cleaned : '998' + cleaned}`, '_self');
                          } else {
                            toast.error("Raqam yo'q");
                          }
                        }}
                        className="h-11 rounded-xl bg-[#17A588] text-white text-[13px] font-bold flex items-center justify-center gap-1.5 active:scale-95"
                      >
                        <Phone className="w-4 h-4" /> Qo'ng'iroq
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const phone = patient.phone?.replace(/\D/g, '');
                          if (phone) {
                            window.open(`https://t.me/+${phone.startsWith('998') ? phone : '998' + phone}`, '_blank');
                          } else {
                            toast.error("Raqam kiritilmagan");
                          }
                        }}
                        className="h-11 rounded-xl bg-sky-50 text-sky-700 border border-sky-100 text-[13px] font-bold flex items-center justify-center gap-1.5 active:scale-95"
                      >
                        <Send className="w-4 h-4" /> Telegram
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate('/appointments', { state: { openAddModal: true, prefillPatient: patient.id, prefillPatientName: patient.full_name } }); }}
                        className="h-11 rounded-xl bg-white border border-slate-200 text-slate-700 text-[13px] font-bold flex items-center justify-center gap-1.5 active:scale-95"
                      >
                        <Calendar className="w-4 h-4" /> Uchrashuv
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate('/payments', { state: { openAddModal: true, prefillPatient: patient.id, prefillPatientName: patient.full_name, prefillAmount: hasDebt ? patient.total_debt : undefined, prefillDoctor: patient.main_treatment_provider || '' } }); }}
                        className="h-11 rounded-xl bg-white border border-slate-200 text-slate-700 text-[13px] font-bold flex items-center justify-center gap-1 active:scale-95"
                      >
                        <Wallet className="w-4 h-4" /> To'lov
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          ) : (
            <div className="text-center py-16 bg-white rounded-[2rem] border border-slate-100 shadow-sm">
              <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center mx-auto mb-5">
                <User className="w-10 h-10 text-slate-300" />
              </div>
              <p className="text-slate-600 font-semibold text-lg">{t('common.noData')}</p>
              <p className="text-sm text-slate-400 mt-1">{t('patients.searchPlaceholder')}</p>
            </div>
          )}
        </div>

        <div className="h-8" />

        <NewPatientFlow 
          open={showFlow} 
          onClose={() => setShowFlow(false)}
          onSaved={() => {
            loadPatients();
          }}
        />
      </div>
    </PullToRefresh>
  );
}
