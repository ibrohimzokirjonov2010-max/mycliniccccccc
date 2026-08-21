import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bell, Phone, MessageCircle, Calendar, CheckCircle2,
  Plus, Search, ArrowLeft, TrendingUp, Clock,
  ChevronRight, X, User, BellRing, Sparkles, Activity,
  Stethoscope, ShieldCheck, Heart, ArrowUpRight
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PullToRefresh from '@/components/ui/PullToRefresh';
import { format } from 'date-fns';
import { uz } from 'date-fns/locale';
import PatientSelect from '@/components/patients/PatientSelect';
import toast from 'react-hot-toast';
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
  const [recalls, setRecalls] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRecall, setNewRecall] = useState({
    patient_id: '',
    type: 'checkup',
    recall_date: '',
    notes: ''
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [recallsData, patientsData] = await Promise.all([
        base44.entities.Recall?.list('-recall_date', 100) || Promise.resolve([]),
        base44.entities.Patient.list('full_name', 50)   // ⚡ tez
      ]);
      setRecalls(recallsData || []);
      setPatients(patientsData || []);
    } catch (err) {
      console.error('Recall load error:', err);
      toast.error("Ma'lumotlarni yuklashda xatolik");
    } finally {
      setLoading(false);
    }
  }, []);

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

  const filteredRecalls = recalls.filter(r => 
    r.patient_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.type_label?.toLowerCase().includes(search.toLowerCase())
  );

  const pendingCount = recalls.filter(r => r.status === 'pending').length;
  const todayCount = recalls.filter(r => {
    const today = new Date().toISOString().split('T')[0];
    if (!r || !r.recall_date) return false;
    const cleanDate = r.recall_date.includes('T') ? r.recall_date.split('T')[0] : r.recall_date.split(' ')[0];
    return cleanDate === today;
  }).length;

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24">
      {/* Premium Header */}
      <div className="bg-white px-5 pt-8 pb-4.5 rounded-b-2xl shadow-md shadow-slate-100 relative z-20">
         <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
               <button onClick={() => navigate(-1)} className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-500 active:scale-90 transition-all border-none">
                  <ArrowLeft className="w-5 h-5" />
               </button>
               <div>
                  <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none mb-1">Recall</h1>
                  <div className="flex items-center gap-1">
                     <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                     <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none">Eslatmalar Tizimi</span>
                  </div>
               </div>
            </div>
            <button 
              onClick={() => setShowAddForm(!showAddForm)}
              className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all active:scale-95 border-none shadow ${
                showAddForm ? 'bg-rose-500 text-white rotate-45' : 'bg-slate-900 text-white'
              }`}
            >
               <Plus className="w-6 h-6" />
            </button>
         </div>

         {!showAddForm ? (
            <div className="space-y-4">
               <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-900 rounded-xl p-4 shadow-sm relative overflow-hidden group">
                     <div className="absolute top-0 right-0 w-16 h-16 bg-white/5 rounded-full -mr-8 -mt-8 blur-xl" />
                     <p className="text-2xl font-black text-white tracking-tight mb-0.5">{pendingCount}</p>
                     <p className="text-[9px] font-bold text-white/50 uppercase tracking-wider">Kutilmoqda</p>
                  </div>
                  <div className="bg-emerald-500 rounded-xl p-4 shadow-sm relative overflow-hidden group text-white">
                     <div className="absolute top-0 right-0 w-16 h-16 bg-white/20 rounded-full -mr-8 -mt-8 blur-xl" />
                     <p className="text-2xl font-black text-white tracking-tight mb-0.5">{todayCount}</p>
                     <p className="text-[9px] font-bold text-white/60 uppercase tracking-wider">Bugun</p>
                  </div>
               </div>

               <div className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
                  <input 
                    type="text"
                    placeholder="Bemor yoki turini izlash..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full h-11 pl-11 pr-4 rounded-xl bg-slate-50 border-none text-sm font-semibold text-slate-850 placeholder:text-slate-400 transition-all outline-none"
                  />
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
                     <div className="space-y-1.5">
                        <Label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider ml-1">Bemorni tanlang</Label>
                        <PatientSelect 
                          patients={patients}
                          value={newRecall.patient_id}
                          onChange={(id) => setNewRecall({...newRecall, patient_id: id})}
                          inputClassName="h-10 rounded-xl bg-slate-50 border-none font-semibold text-slate-800 text-sm"
                        />
                     </div>

                     <div className="space-y-2">
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

                     <div className="space-y-4">
                        <div>
                           <Label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider ml-1">Tashrif sanasi</Label>
                           <div className="grid grid-cols-4 gap-1.5 mt-2 mb-3">
                              {[1, 2, 3, 6].map(m => (
                                <button
                                  key={m}
                                  onClick={() => {
                                    const d = new Date();
                                    d.setMonth(d.getMonth() + m);
                                    setNewRecall({...newRecall, recall_date: d.toISOString().split('T')[0]});
                                  }}
                                  className="h-8.5 rounded-lg bg-slate-50 text-slate-500 text-[10px] font-bold uppercase tracking-wider hover:bg-slate-100 active:scale-95 transition-all"
                                >
                                  {m} Oy
                                </button>
                              ))}
                           </div>
                           <Input 
                             type="date"
                             value={newRecall.recall_date}
                             onChange={e => setNewRecall({...newRecall, recall_date: e.target.value})}
                             className="h-10 rounded-xl bg-slate-50 border-none font-semibold text-slate-800 text-sm"
                           />
                        </div>

                        <div>
                           <Label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider ml-1">Izoh</Label>
                           <Input 
                             placeholder="Qo'shimcha..."
                             value={newRecall.notes}
                             onChange={e => setNewRecall({...newRecall, notes: e.target.value})}
                             className="h-10 rounded-xl bg-slate-50 border-none font-semibold text-slate-800 text-sm"
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
                         const status = STATUS_CONFIG[recall.status] || STATUS_CONFIG['pending'];
                         
                         return (
                            <motion.div
                              key={recall.id}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.05 }}
                              className="bg-white rounded-xl p-3.5 shadow-sm border border-slate-100 relative overflow-hidden group"
                            >
                               <div className="flex items-start justify-between mb-4">
                                  <div className="flex items-center gap-3">
                                     <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${typeConfig.lightColor}`}>
                                        {typeConfig.icon}
                                     </div>
                                     <div>
                                        <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                                           {recall.patient_name}
                                           <ChevronRight className="w-3 h-3 text-slate-300" />
                                        </h3>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{typeConfig.label}</p>
                                     </div>
                                  </div>
                                  <div className={`px-2.5 py-0.5 rounded-lg text-[8px] font-bold uppercase tracking-wider border ${status.color}`}>
                                     {status.label}
                                  </div>
                               </div>

                               <div className="flex items-center justify-between mb-4 bg-slate-50 rounded-xl p-3">
                                  <div className="flex items-center gap-2">
                                     <Clock className="w-3.5 h-3.5 text-slate-400" />
                                     <span className="text-[12px] font-semibold text-slate-800">
                                        {format(new Date(recall.recall_date), 'dd MMMM, yyyy', { locale: uz })}
                                     </span>
                                  </div>
                                  {recall.notes && (
                                     <span className="text-[9.5px] font-medium text-slate-400 italic truncate max-w-[120px]">"{recall.notes}"</span>
                                  )}
                                </div>

                               <div className="grid grid-cols-2 gap-2">
                                  <button 
                                    onClick={() => handleSendNotification(recall, 'call')}
                                    className="h-10 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center gap-1.5 font-bold text-[9.5px] uppercase tracking-wider transition-all active:scale-[0.98] border-none cursor-pointer"
                                  >
                                     <Phone className="w-3.5 h-3.5" /> QO'NG'IROQ
                                  </button>
                                  <button 
                                    onClick={() => handleComplete(recall.id)}
                                    className="h-10 bg-slate-900 text-white rounded-lg flex items-center justify-center gap-1.5 font-bold text-[9.5px] uppercase tracking-wider transition-all active:scale-[0.98] border-none cursor-pointer"
                                  >
                                     <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> BAJARILDI
                                  </button>
                                </div>

                               {/* Link Icon for Details */}
                               <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-300" />
                                </div>
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
