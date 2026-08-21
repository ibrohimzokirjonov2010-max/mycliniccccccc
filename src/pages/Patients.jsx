import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, Search, Phone, Edit2, Trash2, MessageCircle, Users, UserPlus, Filter, Calendar, TrendingUp, MoreVertical, Mail, MapPin, Clock, ChevronRight, X, User } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useTranslation } from '@/i18n/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import StatusBadge from '../components/ui/StatusBadge';
import EmptyState from '../components/ui/EmptyState';
import PatientModal from '../components/patients/PatientModal';
import NewPatientFlow from '../components/patients/NewPatientFlow';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { cn, formatPhone } from '@/lib/utils';
import { useIsMobile } from '@/hooks/useIsMobile';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from 'sonner';

export default function Patients() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const isMobile = useIsMobile(1024);
  
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const [modalOpen, setModalOpen] = useState(false);
  const [flowOpen, setFlowOpen] = useState(false);
  const [editPatient, setEditPatient] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [prefillLead, setPrefillLead] = useState(null);
  
  const [allPatients, setAllPatients] = useState([]);
  const loaderRef = useRef(null);

  // ─── Search Debouncing ──────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // ─── Queries (TanStack Query) ──────────────────────────────────────────
  const { data: patientsData, isLoading, isFetching } = useQuery({
    queryKey: ['patients', debouncedSearch, page],
    queryFn: async () => {
      const offset = page * PAGE_SIZE;
      if (debouncedSearch) {
        return await base44.entities.Patient.search(debouncedSearch, PAGE_SIZE, offset);
      }
      return await base44.entities.Patient.list('-created_date', PAGE_SIZE, offset);
    },
    placeholderData: (previousData) => previousData,
    staleTime: 30000,
  });

  const { data: stats } = useQuery({
    queryKey: ['patients-stats'],
    queryFn: async () => {
      try {
        // Tez va yengil: count so'rovlari (to'liq yozuvlarni yuklamaydi)
        const [total, recentSample] = await Promise.all([
          base44.entities.Patient.count(),
          base44.entities.Patient.list('-created_date', 30),
        ]);

        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        const newCount = recentSample.filter(
          p => new Date(p.created_at || p.created_date) > monthAgo
        ).length;

        // active va debt — bu so'rovlar og'ir (notes decode kerak), 0 ko'rsatamiz
        // To'liq ma'lumot patient kartasida ko'rinadi
        return { total: total || 0, new: newCount, active: 0, debt: 0 };
      } catch (err) {
        console.error('Failed to fetch patient stats:', err);
        return { total: 0, new: 0, active: 0, debt: 0 };
      }
    },
    staleTime: 2 * 60 * 1000, // 2 daqiqa kesh
  });

  const patients = allPatients;
  const hasMore = patientsData && patientsData.length === PAGE_SIZE;



  // ─── Mutations ──────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Patient.delete(id),
    onSuccess: () => {
      setPage(0);
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      queryClient.invalidateQueries({ queryKey: ['patients-stats'] });
      toast.success(t('common.deleted'));
      setDeleteId(null);
    }
  });

  useEffect(() => {
    if (location.state?.openAddModal) {
      setPrefillLead(location.state?.leadData || null);
      setFlowOpen(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    const handlePatientsRefresh = () => {
      setPage(0);
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      queryClient.invalidateQueries({ queryKey: ['patients-stats'] });
    };
    window.addEventListener('crm-data-updated', handlePatientsRefresh);
    return () => window.removeEventListener('crm-data-updated', handlePatientsRefresh);
  }, [queryClient]);

  // Accumulate patient list pages
  useEffect(() => {
    if (page === 0) {
      setAllPatients(patientsData || []);
    } else if (patientsData) {
      setAllPatients(prev => {
        const existingIds = new Set(prev.map(p => p.id));
        const newItems = patientsData.filter(p => !existingIds.has(p.id));
        return [...prev, ...newItems];
      });
    }
  }, [patientsData, page]);

  // Prevent double-increment while a fetch is in progress
  const fetchingRef = useRef(false);

  useEffect(() => {
    if (!isFetching) {
      fetchingRef.current = false;
    }
  }, [isFetching]);

  // Intersection Observer — stable, never disconnects on loading state change
  useEffect(() => {
    const sentinel = loaderRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !fetchingRef.current) {
        fetchingRef.current = true;
        setPage(prev => prev + 1);
      }
    }, {
      rootMargin: '400px',
      threshold: 0,
    });

    observer.observe(sentinel);
    return () => observer.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore]);

  const handleDelete = () => {
    if (deleteId) deleteMutation.mutate(deleteId);
  };

  return (
    <div className="space-y-3 pb-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-4">
          <div className="w-9 h-9 bg-slate-900 rounded-xl flex items-center justify-center text-[#1499AD] shadow-md">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">{t('patients.title')}</h1>
            <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{stats?.total || 0} {t('patients.patientList')}</span>
                <span className="w-1 h-1 rounded-full bg-slate-200" />
                <span className="text-[10px] font-bold text-[#1499AD] uppercase tracking-wider">Bemorlar bazasi</span>
            </div>
          </div>
        </motion.div>
        <motion.button
          whileHover={{ scale: 1.05, y: -2 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setFlowOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-[900] uppercase tracking-widest shadow-lg transition-all border-none"
        >
          <Plus className="w-5 h-5 text-[#1499AD]" />
          {t('patients.addNew')}
        </motion.button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: t('patients.totalVisits'), value: stats?.total || 0, color: 'text-blue-600', bg: 'bg-blue-50/50', icon: Users },
          { label: 'Yangi bemorlar', value: stats?.new || 0, color: 'text-emerald-600', bg: 'bg-emerald-50/50', icon: UserPlus },
          { label: 'Faol davolanish', value: stats?.active || 0, color: 'text-[#1499AD]', bg: 'bg-[#1499AD]/5', icon: Clock },
          { label: 'Umumiy qarz', value: stats?.debt?.toLocaleString() || 0, color: 'text-rose-600', bg: 'bg-rose-50/50', icon: TrendingUp, isCurrency: true }
        ].map((stat, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm hover:shadow-md transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg ${stat.bg} ${stat.color} flex items-center justify-center shadow-sm transition-transform group-hover:scale-110`}>
                <stat.icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-1">{stat.label}</p>
                <div className="text-base font-bold text-slate-900 tracking-tight">
                    {stat.value} {stat.isCurrency && <span className="text-[10px] text-slate-400 ml-0.5">UZS</span>}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#1499AD]" />
          <input 
            type="text" placeholder={t('patients.searchPlaceholder')} value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-11 pr-6 bg-white rounded-xl border border-slate-200 font-bold text-slate-800 text-sm focus:ring-[#1499AD]/10 focus:border-[#1499AD] transition-all outline-none"
          />
        </div>
        <button className="h-10 px-5 bg-white border border-slate-200 rounded-xl flex items-center gap-2 text-[11px] font-bold text-slate-600 uppercase tracking-wider hover:border-[#1499AD] transition-all">
            <Filter className="w-4 h-4" /> Filterlash
        </button>
      </div>

      <div className="px-1">
        <AnimatePresence mode="popLayout" initial={false}>
           {isLoading ? (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1,2,3,4,5,6,7,8].map(i => <div key={i} className="h-32 bg-white rounded-xl animate-pulse border border-slate-100" />)}
             </div>
           ) : patients.length === 0 ? (
             <div className="w-full py-24 bg-white rounded-[3rem] text-center shadow-xl border border-slate-50">
                <EmptyState icon={Users} title="Bemorlar topilmadi" />
             </div>
           ) : (
             <div className="space-y-6">
               {!isMobile ? (
                 <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                          <tr className="bg-slate-50/50 border-b">
                             <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Bemor Ismi</th>
                             <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Telefon</th>
                             <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Manzil</th>
                             <th className="px-4 py-3 text-[10px] font-black text-rose-500 uppercase tracking-widest">Qarz</th>
                             <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">To'langan</th>
                             <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Oxirgi tashrif</th>
                             <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Amallar</th>
                          </tr>
                        </thead>
                        <tbody>
                          {patients.map((p, idx) => (
                            <motion.tr key={p.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(idx * 0.005, 0.3) }}
                              onClick={() => navigate(`/patients/${p.id}`)}
                              className="border-b border-slate-50 last:border-0 hover:bg-[#1499AD]/5 transition-colors cursor-pointer group"
                            >
                              <td className="px-4 py-2.5">
                                 <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-[#1499AD] group-hover:text-white transition-all overflow-hidden shrink-0 border border-slate-200/60 shadow-sm">
                                       {(p.photo_url || p.photo) ? (
                                         <img src={p.photo_url || p.photo} alt={p.full_name} className="w-full h-full object-cover" />
                                       ) : (
                                         <User className="w-5 h-5" />
                                       )}
                                    </div>
                                    <div>
                                    <p className="text-sm font-black text-slate-900 group-hover:text-[#1499AD] uppercase tracking-tight">{p.full_name}</p>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                       <StatusBadge status={p.status || 'New'} size="xs" />
                                       {(p.total_debt || 0) > 0 && <span className="text-[9px] font-bold text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100/50">Qarzdor</span>}
                                    </div>
                                    </div>
                                 </div>
                              </td>
                              <td className="px-4 py-2.5">
                                 <span className="text-[12px] font-bold text-slate-600">{p.phone || '—'}</span>
                              </td>
                              <td className="px-4 py-2.5">
                                 <span className="text-[11px] font-medium text-slate-500 truncate max-w-[150px]">{p.address || p.region || '—'}</span>
                              </td>
                              <td className="px-4 py-2.5 text-[12px] font-black text-rose-600">
                                 {p.total_debt?.toLocaleString() || 0} <span className="text-[9px] opacity-60">so'm</span>
                              </td>
                              <td className="px-4 py-2.5 text-[12px] font-black text-emerald-600">
                                 {p.total_paid?.toLocaleString() || 0} <span className="text-[9px] opacity-60">so'm</span>
                              </td>
                              <td className="px-4 py-2.5 text-[11px] text-slate-500">
                                {p.last_visit ? new Date(p.last_visit).toLocaleDateString() : "—"}
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                 <div className="flex items-center justify-end gap-2">
                                    <button onClick={(e) => { e.stopPropagation(); setEditPatient(p); setModalOpen(true); }} className="w-7 h-7 rounded-lg bg-slate-50 text-slate-400 hover:text-amber-500 transition-all"><Edit2 className="w-3.5 h-3.5" /></button>
                                    <button onClick={(e) => { e.stopPropagation(); setDeleteId(p.id); }} className="w-7 h-7 rounded-lg bg-slate-50 text-slate-400 hover:text-rose-500 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                                 </div>
                              </td>
                           </motion.tr>
                         ))}
                       </tbody>
                     </table>
                    </div>
                 </motion.div>
               ) : (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   {patients.map((p, idx) => (
                      <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(idx * 0.005, 0.3) }}
                        onClick={() => navigate(`/patients/${p.id}`)}
                        className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm hover:border-[#1499AD]/30 transition-all cursor-pointer group"
                      >
                         <div className="flex items-center justify-between mb-3">
                             <div className="flex items-center gap-3 min-w-0 flex-1">
                                 <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 overflow-hidden shrink-0 border border-slate-200/60 shadow-sm">
                                     {(p.photo_url || p.photo) ? (
                                       <img src={p.photo_url || p.photo} alt={p.full_name} className="w-full h-full object-cover" />
                                     ) : (
                                       <User className="w-5 h-5" />
                                     )}
                                 </div>
                                 <div className="flex-1 min-w-0">
                                     <h3 className="text-[14px] font-bold text-slate-900 truncate group-hover:text-[#1499AD]">{p.full_name}</h3>
                                     <div className="flex items-center gap-2 mt-1">
                                         <StatusBadge status={p.status || 'New'} size="xs" />
                                         {(p.total_debt || 0) > 0 && <span className="text-[9px] font-bold text-rose-500">Qarz bor</span>}
                                     </div>
                                 </div>
                             </div>
                             <ChevronRight className="w-4 h-4 text-slate-300 ml-2" />
                         </div>
                         <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                             <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg">{formatPhone(p.phone)}</div>
                             <div className="text-right flex flex-col items-end">
                                <div className="text-rose-500">{p.total_debt?.toLocaleString()} so'm Qarz</div>
                                <div className="text-[8px] text-slate-400 font-medium">Reg: {new Date(p.created_at || p.created_date).toLocaleDateString()}</div>
                             </div>
                         </div>
                      </motion.div>
                   ))}
                 </div>
               )}

                {/* Infinite scroll sentinel — always in DOM so observer works */}
                <div ref={loaderRef} className="flex justify-center mt-8 mb-20 py-4 min-h-[1px]">
                  {hasMore && (
                    <div className="flex items-center gap-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white py-2.5 px-5 rounded-xl border border-slate-100 shadow-sm animate-pulse">
                      <motion.div 
                        animate={{ rotate: 360 }} 
                        transition={{ repeat: Infinity, duration: 1, ease: "linear" }} 
                        className="w-4 h-4 border-2 border-slate-200 border-t-[#1499AD] rounded-full" 
                      />
                      Bemorlar yuklanmoqda...
                    </div>
                  )}
                </div>
              </div>
            )}
        </AnimatePresence>
      </div>

      <PatientModal open={modalOpen} onClose={() => setModalOpen(false)} patient={editPatient} onSaved={() => { setPage(0); queryClient.invalidateQueries({ queryKey: ['patients'] }); }} />
      <NewPatientFlow open={flowOpen} onClose={() => setFlowOpen(false)} onSaved={() => {
         setPage(0);
         queryClient.invalidateQueries({ queryKey: ['patients'] });
         queryClient.invalidateQueries({ queryKey: ['patients-stats'] });
      }} prefillData={prefillLead} />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="rounded-[3rem] p-0 overflow-hidden border-none bg-white max-w-sm">
          <div className="bg-rose-500 p-10 flex items-center justify-center text-white"><Trash2 className="w-16 h-16" /></div>
          <div className="p-10 text-center">
            <AlertDialogTitle className="text-2xl font-black text-slate-900 uppercase mb-4">O'chirilsinmi?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm font-bold text-slate-500">Barcha ma'lumotlar butunlay o'chib ketadi.</AlertDialogDescription>
            <div className="flex gap-4 mt-10">
                <AlertDialogCancel className="flex-1 h-16 rounded-2xl border-2 border-slate-100 font-black uppercase text-[11px]">Yo'q</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="flex-1 h-16 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-black uppercase text-[11px]">Ha, o'chirilsin</AlertDialogAction>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
