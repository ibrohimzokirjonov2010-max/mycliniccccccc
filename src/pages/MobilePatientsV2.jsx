import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Plus,
  User, Calendar, Clock, Phone, ChevronRight
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import PullToRefresh from '@/components/ui/PullToRefresh';
import { formatCurrency, capitalizeName } from '@/lib/utils';
import NewPatientFlow from '@/components/patients/NewPatientFlow';
import { useTranslation } from '@/i18n/LanguageContext';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';

/**
 * Premium SaaS Mobile Patients List
 * Modern healthcare CRM design with strong hierarchy
 */
export default function MobilePatientsV2() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { user, isDoctor } = useAuth();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const loadingTimerRef = useRef(null);
  const hasLoadedInitial = useRef(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showFlow, setShowFlow] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    if (location.state?.openAddModal) {
      setShowFlow(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const loadPatients = useCallback(async () => {
    try {
      if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
      if (!hasLoadedInitial.current) {
        loadingTimerRef.current = setTimeout(() => {
          setLoading(true);
        }, 150);
      }
      let data = [];
      if (isDoctor && user?.id) {
        data = await base44.entities.Patient.filter({ main_treatment_provider: user.id }, '-created_date', 100);
        if (data.length === 0 && user.name) {
          data = await base44.entities.Patient.filter({ main_treatment_provider: user.name }, '-created_date', 100);
        }
      } else {
        data = await base44.entities.Patient.list('-created_date', 100);
      }
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
    const matchesSearch = p.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         p.phone?.includes(searchQuery);
    const matchesStatus = filterStatus === 'all' || p.status === filterStatus;
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

  const totalDebt = patients.reduce((sum, p) => sum + (p.total_debt || 0), 0);
  const activeCount = patients.filter(p => p.status === 'Active').length;
  const newCount = patients.filter(p => p.status === 'New').length;

  return (
    <PullToRefresh onRefresh={loadPatients}>
      <div className="min-h-screen bg-slate-50">
        <div className="bg-white border-b border-slate-100 sticky top-0 z-10">
          <div className="px-5 pt-5 pb-4">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{t('patients.title')}</h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  <span className="font-semibold text-slate-700">{totalCount || patients.length}</span> {t('patients.patientList')}
                </p>
              </div>
              
              <Button 
                onClick={() => setShowFlow(true)}
                className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl px-5 h-11 shadow-lg shadow-slate-200"
              >
                <Plus className="w-5 h-5 mr-1.5" />
                {t('common.add')}
              </Button>
            </div>
            
            <div className="flex gap-3 mb-5">
              <div className="flex-1 bg-emerald-50 rounded-xl p-3">
                <p className="text-2xl font-bold text-emerald-700">{activeCount}</p>
                <p className="text-xs font-medium text-emerald-600/70">{t('patients.active')}</p>
              </div>
              <div className="flex-1 bg-blue-50 rounded-xl p-3">
                <p className="text-2xl font-bold text-blue-700">{newCount}</p>
                <p className="text-xs font-medium text-blue-600/70">{t('patients.new')}</p>
              </div>
              {totalDebt > 0 && (
                <div className="flex-1 bg-rose-50 rounded-xl p-3">
                  <p className="text-2xl font-bold text-rose-700">{formatCurrency(totalDebt)}</p>
                  <p className="text-xs font-medium text-rose-600/70">{t('payments.debt')}</p>
                </div>
              )}
            </div>

            <div className="relative mb-3">
              <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={t('patients.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 h-12 bg-slate-50 border-0 rounded-2xl font-medium text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-slate-900 outline-none text-sm transition-all"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
              {[
                { id: 'all', label: t('common.all') },
                { id: 'Active', label: t('patients.active') },
                { id: 'New', label: t('patients.new') },
                { id: 'Inactive', label: t('patients.inactive') }
              ].map(filter => (
                <button
                  key={filter.id}
                  onClick={() => setFilterStatus(filter.id)}
                  className={`shrink-0 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    filterStatus === filter.id
                      ? 'bg-slate-900 text-white shadow-md shadow-slate-200'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4">
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
                const status = getStatusStyle(patient.status);
                const hasDebt = patient.total_debt > 0;
                return (
                  <motion.div
                    key={patient.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: searchQuery ? 0 : Math.min(index, 6) * 0.02 }}
                    onClick={() => navigate(`/patients/${patient.id}`)}
                    className="bg-white rounded-xl p-2.5 mb-2 shadow-sm border border-slate-50 flex items-center gap-3 relative active:scale-[0.98] transition-transform content-visibility-auto"
                  >
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 overflow-hidden shrink-0 border border-slate-200/50">
                      {(patient.photo_url || patient.photo) ? (
                        <img src={patient.photo_url || patient.photo} alt={capitalizeName(patient.full_name)} className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-5 h-5 text-slate-400" />
                      )}
                    </div>

                    {/* Info Area */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-[14px] text-slate-800 truncate leading-tight group-active:text-[#1499AD]">
                          {capitalizeName(patient.full_name)}
                        </h3>
                        {hasDebt && (
                          <div className="px-1 py-0.5 rounded bg-rose-50 text-[8px] font-bold text-rose-500 border border-rose-100/50">
                            Qarz
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`w-1 h-1 rounded-full ${status.dot}`} />
                        <p className="text-[10px] font-medium text-slate-500 truncate">{patient.phone || "Noma'lum"}</p>
                        <span className={`text-[9px] font-bold uppercase tracking-tight ${status.text} opacity-80`}>
                          {status.label}
                        </span>
                      </div>
                      {/* Registration Date & Time */}
                      <div className="flex items-center gap-1 mt-1">
                         <div className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-50 rounded border border-slate-100">
                            <Calendar className="w-2.5 h-2.5 text-slate-400" />
                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">
                              {new Date(patient.created_at || patient.created_date).toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </span>
                         </div>
                         <div className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-50 rounded border border-slate-100">
                            <Clock className="w-2.5 h-2.5 text-slate-400" />
                            <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">
                              {new Date(patient.created_at || patient.created_date).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                         </div>
                      </div>
                    </div>

                    {/* Right: Quick Action Icons */}
                    <div className="flex items-center gap-1.5 shrink-0">
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
                        className="w-9 h-9 bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded-full flex items-center justify-center active:scale-90 transition-all border border-emerald-100/50 shadow-sm"
                      >
                        <Phone className="w-4 h-4" />
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
                        className="w-9 h-9 bg-sky-50 text-sky-500 hover:bg-sky-500 hover:text-white rounded-full flex items-center justify-center active:scale-90 transition-all border border-sky-100/50 shadow-sm"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="translate-x-[-1px] translate-y-[0px]">
                          <line x1="22" y1="2" x2="11" y2="13"></line>
                          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                        </svg>
                      </button>

                      <div className="w-6 h-6 rounded-md bg-slate-50 flex items-center justify-center text-slate-300 ml-0.5">
                         <ChevronRight className="w-3.5 h-3.5" />
                      </div>
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
