import { useState, useEffect, useCallback } from 'react';
import { useRestorableState } from '@/hooks/useRestorableState';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bell, Phone, CheckCircle2,
  Plus, Search, ArrowLeft, Clock,
  ChevronRight, Sparkles, Activity,
  Stethoscope, Heart, ArrowUpRight, CalendarDays, CalendarCheck, SlidersHorizontal, MoreVertical, X
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PullToRefresh from '@/components/ui/PullToRefresh';
import { formatClinicDate, tashkentToday } from '@/lib/clinicTime';
import { ClinicDateField } from '@/components/ui/ClinicDateField';
import PatientSelect from '@/components/patients/PatientSelect';
import { toast } from 'sonner';
import { useTranslation } from '@/i18n/LanguageContext';

const RECALL_TYPES = [
  { value: 'checkup', label: 'Tekshiruv', icon: <Stethoscope className="w-5 h-5" />, color: 'bg-blue-500', lightColor: 'bg-blue-50 text-blue-600' },
  { value: 'cleaning', label: 'Tozalash', icon: <Sparkles className="w-5 h-5" />, color: 'bg-emerald-500', lightColor: 'bg-emerald-50 text-emerald-600' },
  { value: 'treatment', label: 'Davolash', icon: <Activity className="w-5 h-5" />, color: 'bg-amber-500', lightColor: 'bg-amber-50 text-amber-600' },
  { value: 'followup', label: 'Kuzatuv', icon: <Heart className="w-5 h-5" />, color: 'bg-rose-500', lightColor: 'bg-rose-50 text-rose-600' },
];

const STATUS_CONFIG = {
  'pending': { color: 'bg-amber-50 text-amber-700 border-amber-100', label: 'Kutilmoqda' },
  'sent': { color: 'bg-blue-50 text-blue-700 border-blue-100', label: 'Yuborildi' },
  'completed': { color: 'bg-emerald-50 text-emerald-700 border-emerald-100', label: 'Bajarildi' },
  'failed': { color: 'bg-rose-50 text-rose-700 border-rose-100', label: 'Xato' },
};

export default function MobileRecall() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, isDoctor } = useAuth();
  const [recalls, setRecalls] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [search, setSearch] = useRestorableState('search', '');
  const [statusFilter, setStatusFilter] = useRestorableState('statusFilter', 'all');
  const getTodayStr = () => tashkentToday();
  const calcDate = (months, baseDate = getTodayStr()) => {
    const d = new Date(baseDate || new Date());
    if (isNaN(d.getTime())) return getTodayStr();
    d.setMonth(d.getMonth() + months);
    return d.toISOString().split('T')[0];
  };

  const [newRecall, setNewRecall] = useState(() => {
    const today = getTodayStr();
    return {
      patient_id: '',
      type: 'checkup',
      start_date: today,
      recall_date: calcDate(3, today),
      notes: ''
    };
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [recallsData, patientsData] = await Promise.all([
        base44.entities.Recall?.list('-recall_date', 200) || Promise.resolve([]),
        base44.entities.Patient.list('full_name', 100)   // ⚡ tez
      ]);
      
      // Doktor bo'lsa faqat o'ziga tayinlangan eslashmalarni ko'rsin
      let filteredRecalls = recallsData || [];
      if (isDoctor && user?.id) {
        filteredRecalls = filteredRecalls.filter(r =>
          String(r.doctor_id) === String(user.id) ||
          String(r.created_by_id) === String(user.id) ||
          String(r.doctor_name || '').toLowerCase() === String(user.name || '').toLowerCase()
        );
      }
      
      setRecalls(filteredRecalls);
      setPatients(patientsData || []);
    } catch (err) {
      console.error('Recall load error:', err);
      toast.error("Ma'lumotlarni yuklashda xatolik");
    } finally {
      setLoading(false);
    }
  }, [isDoctor, user?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAddRecall = async () => {
    if (!newRecall.patient_id || !newRecall.recall_date) {
      toast.error('Bemor va sanani tanlang');
      return;
    }
    
    try {
      const recallEntity = base44.entities.Recall;
      if (!recallEntity) {
        throw new Error("Recall tizimi API bilan ulanmagan");
      }

      const patient = patients.find(p => p.id === newRecall.patient_id);
      const recallType = RECALL_TYPES.find(t => t.value === newRecall.type);
      
      const payload = {
        patient_id: newRecall.patient_id,
        patient_name: patient?.full_name || 'Noma`lum bemor',
        patient_phone: patient?.phone || '',
        type: newRecall.type,
        type_label: recallType?.label || '',
        recall_date: newRecall.recall_date,
        notes: newRecall.notes,
        status: 'pending',
        created_date: new Date().toISOString()
      };
      
      const result = await recallEntity.create(payload);
      
      if (result) {
        toast.success("Eslatma muvaffaqiyatli saqlandi");
        setShowAddForm(false);
        setNewRecall({ patient_id: '', type: 'checkup', recall_date: '', notes: '' });
        await loadData();
      }
    } catch (err) {
      toast.error(`Xatolik: ${err.message || 'Saqlab bo\'lmadi'}`);
    }
  };

  const handleSendNotification = async (recall, method) => {
    try {
      const cleanPhone = recall.patient_phone?.replace(/\D/g, '');
      if (method === 'sms' && cleanPhone) {
        window.location.href = `sms:${cleanPhone}`;
      } else if (method === 'call' && cleanPhone) {
        window.location.href = `tel:${cleanPhone}`;
      }
      await base44.entities.Recall?.update(recall.id, { status: 'sent' });
      loadData();
    } catch (err) {
      console.error('Send notification error:', err);
    }
  };

  const handleComplete = async (id) => {
    try {
      await base44.entities.Recall?.update(id, { 
        status: 'completed',
        completed_date: new Date().toISOString()
      });
      toast.success("Bajarildi");
      loadData();
    } catch (err) {
      console.error('Complete error:', err);
    }
  };

  const recallStatus = (r) => String(r.status || 'pending').toLowerCase();
  const filteredRecalls = recalls.filter(r => 
    (r.patient_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.type_label?.toLowerCase().includes(search.toLowerCase())) &&
    (statusFilter === 'all' || recallStatus(r) === statusFilter)
  );
  const sentCount = recalls.filter(r => recallStatus(r) === 'sent').length;

  const pendingCount = recalls.filter(r => String(r.status || 'pending').toLowerCase() === 'pending').length;
  const todayCount = recalls.filter(r => {
    const today = tashkentToday();
    if (!r || !r.recall_date) return false;
    const cleanDate = r.recall_date.includes('T') ? r.recall_date.split('T')[0] : r.recall_date.split(' ')[0];
    return cleanDate === today;
  }).length;

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24">
      {/* Premium Header */}
      <div className="bg-white px-4 pt-5 pb-4 rounded-b-3xl shadow-md shadow-slate-100 relative z-20">
         <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3 min-w-0">
               <span className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <Bell className="w-6 h-6" />
               </span>
               <div className="min-w-0">
                  <h1 className="text-[22px] font-black text-slate-900 tracking-tight leading-none mb-1.5">Eslatmalar</h1>
                  <div className="flex items-center gap-1.5">
                     <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                     <span className="text-[13px] font-semibold text-slate-500 leading-none truncate">Bemorlar bilan qayta aloqa</span>
                  </div>
               </div>
            </div>
            <button 
              onClick={() => setShowAddForm(!showAddForm)}
              className={`h-12 px-4 rounded-2xl flex items-center justify-center gap-1.5 transition-all active:scale-95 border-none shadow-md text-[14px] font-black uppercase tracking-wide shrink-0 ${
                showAddForm ? 'bg-rose-500 text-white shadow-rose-500/20' : 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-emerald-500/25'
              }`}
            >
               {showAddForm ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
               {showAddForm ? 'Yopish' : 'Yangi'}
            </button>
         </div>

         {!showAddForm ? (
            <div className="space-y-4">
               <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-900 rounded-2xl p-4 shadow-sm relative overflow-hidden min-h-[104px]">
                     <CalendarDays className="absolute -right-3 top-4 w-20 h-20 text-white/[0.07]" strokeWidth={1.5} />
                     <span className="w-10 h-10 rounded-xl bg-white/10 text-white flex items-center justify-center mb-2"><CalendarDays className="w-5 h-5" /></span>
                     <p className="text-[24px] font-black text-white tracking-tight leading-none mb-1">{pendingCount}</p>
                     <p className="text-[13px] font-bold text-white/60 uppercase tracking-wide">Kutilmoqda</p>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 shadow-sm relative overflow-hidden min-h-[104px]">
                     <CalendarDays className="absolute -right-3 top-4 w-20 h-20 text-emerald-500/10" strokeWidth={1.5} />
                     <span className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-2"><CalendarCheck className="w-5 h-5" /></span>
                     <p className="text-[24px] font-black text-emerald-800 tracking-tight leading-none mb-1">{todayCount}</p>
                     <p className="text-[13px] font-bold text-emerald-700 uppercase tracking-wide">Bugun</p>
                  </div>
               </div>

               <div className="flex gap-2">
               <div className="relative group flex-1 min-w-0">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
                  <input 
                    type="text"
                    placeholder="Bemor yoki turini izlash..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full h-12 pl-11 pr-4 rounded-xl bg-white border border-slate-200 text-[14px] font-medium text-slate-850 placeholder:text-slate-400 transition-all outline-none"
                  />
               </div>
               <button
                 type="button"
                 aria-label="Filtr"
                 onClick={() => setStatusFilter(statusFilter === 'all' ? 'pending' : statusFilter === 'pending' ? 'sent' : 'all')}
                 className="w-12 h-12 shrink-0 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-600"
               >
                 <SlidersHorizontal className="w-5 h-5" />
               </button>
               </div>
               <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
                 {[
                   { k: 'all', label: 'Barchasi', count: null },
                   { k: 'pending', label: 'Kutilmoqda', count: pendingCount },
                   { k: 'sent', label: 'Yuborildi', count: sentCount },
                 ].map(f => (
                   <button
                     key={f.k}
                     type="button"
                     onClick={() => setStatusFilter(f.k)}
                     className={`shrink-0 min-h-[44px] px-4 rounded-full inline-flex items-center gap-2 text-[13px] font-black uppercase tracking-wide border transition-all ${
                       statusFilter === f.k ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white border-transparent shadow-md shadow-emerald-500/20' : 'bg-white text-slate-500 border-slate-200'
                     }`}
                   >
                     {f.label}
                     {f.count != null && <span className={`px-1.5 rounded-full text-[12px] ${statusFilter === f.k ? 'bg-white/20' : 'bg-slate-100'}`}>{f.count}</span>}
                   </button>
                 ))}
               </div>
            </div>
         ) : (
            <div className="flex items-center gap-2">
               <div className="w-1 h-6 bg-slate-900 rounded-full" />
               <h2 className="text-lg font-black text-slate-800 tracking-tight">Eslatma yaratish</h2>
            </div>
         )}
      </div>

      <PullToRefresh onRefresh={loadData}>
        <div className="px-4 py-4">
           <AnimatePresence mode="wait">
              {showAddForm ? (
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="space-y-3"
                >
                  <div className="bg-white rounded-xl p-5 shadow border border-slate-100 space-y-4">
                     <div className="space-y-1.5 relative z-20">
                        <Label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider ml-1">Bemorni tanlang</Label>
                        <PatientSelect 
                          patients={patients}
                          value={newRecall.patient_id}
                          onChange={(id) => setNewRecall({...newRecall, patient_id: id})}
                          inputClassName="h-10 rounded-xl bg-slate-50 border-none font-semibold text-slate-800 text-sm"
                        />
                     </div>

                     <div className="space-y-2 relative z-10">
                        <Label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider ml-1">Eslatma turi</Label>
                        <div className="grid grid-cols-2 gap-2">
                           {RECALL_TYPES.map(type => (
                              <button
                                key={type.value}
                                onClick={() => setNewRecall({...newRecall, type: type.value})}
                                className={`flex items-center gap-2.5 p-2 px-3.5 rounded-xl border transition-all active:scale-[0.98] ${
                                  newRecall.type === type.value 
                                    ? 'bg-slate-900 border-slate-900 text-white shadow' 
                                    : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
                                }`}
                              >
                                 <div className={`w-7.5 h-7.5 rounded-lg flex items-center justify-center shrink-0 ${
                                    newRecall.type === type.value ? 'bg-white/10' : type.lightColor.split(' ')[0]
                                 }`}>
                                    {type.icon}
                                 </div>
                                 <span className="text-[10px] font-bold uppercase tracking-wider">{type.label}</span>
                              </button>
                           ))}
                        </div>
                     </div>

                     <div className="space-y-3">
                        {/* Boshlang'ich sana */}
                        <div>
                           <Label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider ml-1">Boshlang'ich sana</Label>
                           <ClinicDateField
                             value={newRecall.start_date || getTodayStr()}
                             onChange={e => {
                               const newStart = e.target.value;
                               setNewRecall({
                                 ...newRecall, 
                                 start_date: newStart,
                                 recall_date: calcDate(3, newStart)
                               });
                             }}
                             className="h-10 rounded-xl bg-slate-50 border-none font-semibold text-slate-800 text-sm mt-1"
                           />
                           <span className="text-[9px] text-slate-400 font-semibold ml-1">Avtomatik bugungi sana</span>
                        </div>

                        {/* Avtomatik davr tezkor tanlash */}
                        <div>
                           <Label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider ml-1">Avtomatik davr</Label>
                           <div className="grid grid-cols-4 gap-1.5 mt-1 mb-2">
                              {[1, 3, 6, 12].map(m => (
                                <button
                                  key={m}
                                  type="button"
                                  onClick={() => {
                                    setNewRecall({
                                      ...newRecall, 
                                      recall_date: calcDate(m, newRecall.start_date || getTodayStr())
                                    });
                                  }}
                                  className="h-8 rounded-lg bg-slate-100 text-slate-700 text-[10px] font-bold uppercase tracking-wider hover:bg-[#1499AD]/10 hover:text-[#1499AD] active:scale-95 transition-all border-none cursor-pointer"
                                >
                                  {m === 12 ? '1 Yil' : `${m} Oy`}
                                </button>
                              ))}
                           </div>
                        </div>

                        {/* Eslatma (Recall) sanasi */}
                        <div>
                           <div className="flex items-center justify-between ml-1">
                              <Label className="text-[9px] font-bold text-slate-700 uppercase tracking-wider">Eslatma (Recall) sanasi</Label>
                              <span className="text-[9px] font-bold text-[#1499AD]">Kalendardan o'zgartirish mumkin</span>
                           </div>
                           <ClinicDateField
                             value={newRecall.recall_date}
                             onChange={e => setNewRecall({...newRecall, recall_date: e.target.value})}
                             className="h-10 rounded-xl bg-white border border-[#1499AD]/40 focus:border-[#1499AD] font-bold text-[#1499AD] text-sm mt-1"
                           />
                        </div>

                        <div>
                           <Label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider ml-1">Izoh</Label>
                           <Input 
                             placeholder="Qo'shimcha..."
                             value={newRecall.notes}
                             onChange={e => setNewRecall({...newRecall, notes: e.target.value})}
                             className="h-10 rounded-xl bg-slate-50 border-none font-semibold text-slate-800 text-sm mt-1"
                           />
                        </div>
                     </div>

                     <Button 
                        className="w-full h-11 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs uppercase tracking-wider shadow active:scale-[0.97] transition-all border-none"
                        onClick={handleAddRecall}
                     >
                        YARATISH
                     </Button>
                  </div>
                </motion.div>
              ) : (
                <div className="space-y-3.5">
                   {loading ? (
                      [1,2,3,4].map(i => <div key={i} className="h-32 bg-white rounded-xl animate-pulse shadow-sm border border-slate-100" />)
                   ) : filteredRecalls.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                         <div className="w-16 h-16 bg-slate-100 rounded-xl rotate-45 flex items-center justify-center mb-8 overflow-hidden relative group">
                            <Bell className="w-7 h-7 text-slate-350 -rotate-45" />
                         </div>
                         <h3 className="text-base font-bold text-slate-900 mb-1.5">Eslatmalar yo'q</h3>
                         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider max-w-[200px]">Hozircha hech qanday eslatma rejalashtirilmagan</p>
                      </div>
                   ) : (
                      filteredRecalls.map((recall, index) => {
                         const typeConfig = RECALL_TYPES.find(t => t.value === recall.type) || RECALL_TYPES[0];
                         const status = STATUS_CONFIG[String(recall.status || 'pending').toLowerCase()] || STATUS_CONFIG.pending;
                         
                         return (
                            <motion.div
                              key={recall.id}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: Math.min(index, 6) * 0.02 }}
                              className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 relative overflow-hidden group content-visibility-auto"
                            >
                               <div className="flex items-start justify-between mb-3 gap-2">
                                  <div className="flex items-center gap-3 min-w-0">
                                     <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${typeConfig.lightColor}`}>
                                        {typeConfig.icon}
                                     </div>
                                     <div className="min-w-0">
                                        <h3 className="text-[16px] font-black text-slate-900 tracking-tight flex items-center gap-1.5 truncate">
                                           {recall.patient_name}
                                           <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                                        </h3>
                                        <p className="text-[13px] font-bold text-slate-400 uppercase tracking-wide mt-0.5">{typeConfig.label}</p>
                                     </div>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                  <div className={`px-3 py-1 rounded-full text-[12px] font-black uppercase tracking-wide border ${status.color}`}>
                                     {status.label}
                                  </div>
                                  <button
                                    type="button"
                                    aria-label="Bemor profili"
                                    onClick={() => recall.patient_id && navigate(`/patients/${recall.patient_id}`)}
                                    className="w-8 h-11 -mr-2 flex items-center justify-center text-slate-500"
                                  >
                                    <MoreVertical className="w-5 h-5" />
                                  </button>
                                  </div>
                               </div>

                               <div className="flex items-center gap-3 mb-3 bg-slate-50 rounded-xl p-3 min-h-[48px]">
                                  <div className="flex items-center gap-2.5 shrink-0">
                                     <Clock className="w-4.5 h-4.5 text-slate-400" />
                                     <span className="text-[14px] font-bold text-slate-800">
                                        {formatClinicDate(recall.recall_date)}
                                     </span>
                                  </div>
                                  {recall.notes && (
                                     <span className="text-[13px] font-medium text-slate-500 truncate border-l border-slate-200 pl-3 min-w-0">{recall.notes}</span>
                                  )}
                                </div>

                               <div className="grid grid-cols-2 gap-2">
                                  <button 
                                    onClick={() => handleSendNotification(recall, 'call')}
                                    className="h-12 bg-emerald-50 text-emerald-700 rounded-xl flex items-center justify-center gap-2 font-black text-[13px] uppercase tracking-wider transition-all active:scale-[0.98] border-none cursor-pointer"
                                  >
                                     <Phone className="w-4.5 h-4.5" /> QO'NG'IROQ
                                  </button>
                                  <button 
                                    onClick={() => handleComplete(recall.id)}
                                    className="h-12 bg-slate-900 text-white rounded-xl flex items-center justify-center gap-2 font-black text-[13px] uppercase tracking-wider transition-all active:scale-[0.98] border-none cursor-pointer"
                                  >
                                     <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400" /> BAJARILDI
                                  </button>
                                </div>

                               {/* Link Icon for Details */}

                            </motion.div>
                         );
                      })
                   )}
                </div>
              )}
           </AnimatePresence>
        </div>
      </PullToRefresh>
    </div>
  );
}
