import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { 
  Plus, Search, Check, X, ArrowLeft, User, Sparkles, Shield, Trash2, ClipboardList, Info,
  Activity, Scissors, Layers, TrendingUp, Syringe, Baby, CheckCircle2
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import PullToRefresh from '@/components/ui/PullToRefresh';
import ProfessionalOdontogram from '@/components/patients/ProfessionalOdontogram';
import { formatCurrency } from '@/lib/utils';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import TreatmentPlanInvoice from '@/components/treatments/TreatmentPlanInvoice';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/i18n/LanguageContext';
import PatientSelect from '@/components/patients/PatientSelect';
import { useAuth } from '@/lib/AuthContext';

// Internal tish ID ('ur6') ni FDI raqamga ('16') aylantirish
const idToFdi = (idStr) => {
  if (!idStr || String(idStr).toLowerCase() === 'general') return '';
  const match = String(idStr).match(/^(ur|ul|lr|ll)(\d+)(c)?$/);
  if (!match) return String(idStr);
  const [, quad, num, isChild] = match;
  if (isChild) {
    const qMap = { ur: 5, ul: 6, ll: 7, lr: 8 };
    return `${qMap[quad]}${num}`;
  } else {
    const qMap = { ur: 1, ul: 2, ll: 3, lr: 4 };
    return `${qMap[quad]}${num}`;
  }
};

const CATEGORY_MAP = {
  'TERAPIYA( ENDO +PLOMBA)': { icon: Activity, color: 'text-blue-500', bg: 'bg-blue-50', border: 'border-l-blue-500' },
  'XIRURGIYA': { icon: Scissors, color: 'text-rose-500', bg: 'bg-rose-50', border: 'border-l-rose-500' },
  'ORTOPEDIYA': { icon: Layers, color: 'text-violet-500', bg: 'bg-violet-50', border: 'border-l-violet-500' },
  'ORTODONTIYA': { icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-l-emerald-500' },
  'GIGIENA VA PROFILAKTIKA': { icon: Sparkles, color: 'text-cyan-500', bg: 'bg-cyan-50', border: 'border-l-cyan-500' },
  'ESTETIK STOMATOLOGIYA': { icon: Sparkles, color: 'text-pink-500', bg: 'bg-pink-50', border: 'border-l-pink-500' },
  'BOLALAR STOMATOLOGIYASI': { icon: Baby, color: 'text-orange-500', bg: 'bg-orange-50', border: 'border-l-orange-500' },
  'IMPLANTATSIYA': { icon: Syringe, color: 'text-indigo-500', bg: 'bg-indigo-50', border: 'border-l-indigo-500' },
  'ENDODONTIYA': { icon: Activity, color: 'text-teal-500', bg: 'bg-teal-50', border: 'border-l-teal-500' }
};

const getCategoryStyle = (cat) => {
  return CATEGORY_MAP[cat] || { icon: ClipboardList, color: 'text-slate-500', bg: 'bg-slate-50', border: 'border-l-slate-400' };
};

const getInitials = (name) => {
  if (!name) return 'B';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  } catch(e) {
    return '';
  }
};

const formatCompactCurrency = (value) => {
  if (value >= 1_000_000) {
    return (value / 1_000_000).toFixed(1).replace(/\.0$/, '') + ' mln';
  }
  if (value >= 1_000) {
    return (value / 1_000).toFixed(0) + 'k';
  }
  return String(value);
};

export default function MobileTreatmentPlansV2() {
  const { t } = useTranslation();
  const [plans, setPlans] = useState([]);
  const [patients, setPatients] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [saving, setSaving] = useState(false);
  const [completedServices, setCompletedServices] = useState([]);
  const [step, setStep] = useState(1);
  const [selectedTeeth, setSelectedTeeth] = useState([]);
  const [toothServices, setToothServices] = useState({});
  const [focusedTooth, setFocusedTooth] = useState(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [formData, setFormData] = useState({ patient_id: '', name: '', status: 'Planned', total_price: '' });

  const groupedServices = useMemo(() => {
    if (!selectedPlan?.services) return [];
    
    // Check if it is already grouped (mobile V2 format)
    const isGrouped = selectedPlan.services.some(s => s.items || s.tooth_id);
    if (isGrouped) {
      return selectedPlan.services.map((s, idx) => ({
        tooth_id: s.tooth_id || s.tooth || 'general',
        items: (s.items || [s]).map((item, sI) => ({
          ...item,
          originalIndex: s.items ? `${idx}-${sI}` : `${idx}`
        }))
      }));
    }
    
    // Flat format (desktop format) -> Group by tooth
    const groups = {};
    selectedPlan.services.forEach((s, idx) => {
      const tId = s.tooth || s.tooth_number || s.tooth_id || 'general';
      if (!groups[tId]) {
        groups[tId] = [];
      }
      groups[tId].push({ ...s, originalIndex: `${idx}` });
    });
    
    return Object.entries(groups).map(([tId, items]) => ({
      tooth_id: tId,
      items
    }));
  }, [selectedPlan]);

  // Sync completedServices state with database plan status
  useEffect(() => {
    if (selectedPlan && showDetailModal) {
      const completed = [];
      (selectedPlan.services || []).forEach(toothGroup => {
        (toothGroup.items || []).forEach(item => {
          if (item.status === 'Completed') {
            completed.push(`${toothGroup.tooth_id}_${item.service_id}`);
          }
        });
      });
      setCompletedServices(completed);
    } else {
      setCompletedServices([]);
    }
  }, [selectedPlan, showDetailModal]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const planFilter = isDoctor && user?.id ? { doctor_id: user.id } : {};
      const [pl, pa, se] = await Promise.all([
        isDoctor && user?.id ? base44.entities.TreatmentPlan.filter(planFilter, '-created_date', 100) : base44.entities.TreatmentPlan.list('-created_date', 100),
        base44.entities.Patient.list('-created_date', 50),
        base44.entities.Service.list('name', 500)
      ]);
      setPlans(pl || []); setPatients(pa || []); setServices(se || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [isDoctor, user]);

  useEffect(() => { loadData(); }, [loadData]);

  const dynamicCategories = useMemo(() => {
    const categories = new Set(['all']);
    services.forEach(s => { if (s.category) categories.add(s.category); });
    return Array.from(categories);
  }, [services]);

  const handleSaveInternal = async () => {
    if (!formData.patient_id) { toast.error("Iltimos, bemorni tanlang"); return; }
    setSaving(true);
    try {
      const p = patients.find(x => x.id === formData.patient_id);
      const targetDoctorId = isDoctor ? user.id : (p?.main_treatment_provider || formData.doctor_id || '');
      const allSvcNames = Object.values(toothServices).flat().map(it => services.find(x => x.id === it.service_id)?.name).filter(Boolean);
      const MAX_SHOW = 2;
      const compactName = allSvcNames.length > MAX_SHOW
        ? allSvcNames.slice(0, MAX_SHOW).join(', ') + ` +${allSvcNames.length - MAX_SHOW} ${t('common.count') || 'ta'}`
        : allSvcNames.join(', ');

      const data = { 
          ...formData, 
          name: formData.name || compactName || (t ? t('patientProfile.treatmentPlanSingular') : 'Davolash rejasi'),
          patient_name: p?.full_name || '', 
          doctor_id: targetDoctorId,
          doctor_name: isDoctor ? (user.name || '') : '',
          total_price: Number(formData.total_price) || 0,
          services: Object.entries(toothServices).map(([tId, svcs]) => ({
              tooth_id: tId,
              items: svcs.map(s => {
                  const svc = services.find(x => x.id === s.service_id);
                  return { ...s, service_name: svc?.name, price: svc?.price };
              })
          }))
      };
      const res = await base44.entities.TreatmentPlan.create(data);
      await loadData(); 
      setSelectedPlan(res); 
      setShowAddModal(false); 
      // Reset creation state
      setFormData({ patient_id: '', name: '', status: 'Planned', total_price: '' });
      setToothServices({});
      setSelectedTeeth([]);
      setFocusedTooth(null);
      setTimeout(() => setShowInvoice(true), 400); 
    } catch (e) { console.error(e); } finally { setSaving(false); }
  };

  const handleDeletePlan = async (planId) => {
    if (!window.confirm(t ? t('treatmentPlans.confirmDelete') || "Ushbu davolash rejasini o'chirishni tasdiqlaysizmi? Bu amalni ortga qaytarib bo'lmaydi!" : "Ushbu davolash rejasini o'chirishni tasdiqlaysizmi? Bu amalni ortga qaytarib bo'lmaydi!")) return;
    try {
      await base44.entities.TreatmentPlan.delete(planId);
      toast.success(t ? t('treatmentPlans.deleteSuccess') || "Davolash rejasi o'chirildi" : "Davolash rejasi o'chirildi");
      setShowDetailModal(false);
      loadData();
    } catch (e) {
      toast.error(t ? t('treatmentPlans.deleteError') || "O'chirishda xatolik yuz berdi" : "O'chirishda xatolik yuz berdi");
    }
  };

  const toggleServiceForTooth = (tId, svcId) => {
    const nt = { ...toothServices }; const cur = nt[tId] || [];
    if (!cur.some(i => i.service_id === svcId)) nt[tId] = [...cur, { service_id: svcId, status: 'planned' }];
    else { nt[tId] = cur.filter(i => i.service_id !== svcId); if (nt[tId].length === 0) delete nt[tId]; }
    setToothServices(nt);
    const total = Object.values(nt).flat().reduce((sum, it) => sum + (services.find(s => s.id === it.service_id)?.price || 0), 0);
    setFormData(prev => ({ ...prev, total_price: total.toString() }));
  };

  const filteredPlans = useMemo(() => {
    return plans.filter(p => {
      const matchesSearch = ((p.name || '') + (p.patient_name || '')).toLowerCase().includes(searchQuery.toLowerCase());
      if (statusFilter === 'all') return matchesSearch;
      return matchesSearch && p.status === statusFilter;
    });
  }, [plans, searchQuery, statusFilter]);

  const planCode = useMemo(() => {
    return 'PLAN-' + Math.random().toString(36).substr(2, 6).toUpperCase();
  }, [formData.patient_id, formData.total_price]);

  return (
    <PullToRefresh onRefresh={loadData}>
      <div className="min-h-screen bg-[#F4F6F9] pb-32">
        
        {/* Page Header */}
        <div className="px-4 pt-5 pb-3">
           <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none mb-1">Davolash Rejalari</h1>
                <p className="text-[9px] font-bold text-[#1499AD] uppercase tracking-wider opacity-85">Dental System</p>
              </div>
           </div>
           
           <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Qidiruv..." 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                className="w-full h-11 pl-10 pr-4 rounded-2xl border border-slate-100 bg-white text-xs font-semibold text-slate-800 shadow-sm outline-none placeholder:text-slate-400 focus:border-[#1499AD]/30 transition-all" 
              />
           </div>
        </div>

        {/* KPI Stats Block */}
        <div className="grid grid-cols-3 gap-2 px-4 mb-4">
           <div className="bg-white rounded-2xl p-3 border border-slate-100 shadow-sm flex flex-col justify-between h-[72px] relative overflow-hidden">
              <div className="absolute -right-2 -bottom-2 w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center opacity-70">
                 <ClipboardList className="w-5 h-5 text-slate-300" />
              </div>
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider leading-none">Jami rejalar</span>
              <div>
                 <span className="text-sm font-black text-slate-800 leading-none">{plans.length}</span>
                 <span className="text-[8px] font-bold text-slate-455 ml-1">ta</span>
              </div>
           </div>
           <div className="bg-white rounded-2xl p-3 border border-slate-100 shadow-sm flex flex-col justify-between h-[72px] relative overflow-hidden">
              <div className="absolute -right-2 -bottom-2 w-10 h-10 bg-sky-50 rounded-full flex items-center justify-center opacity-70">
                 <Activity className="w-5 h-5 text-[#1499AD]/25" />
              </div>
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider leading-none">Jarayonda</span>
              <div>
                 <span className="text-sm font-black text-[#1499AD] leading-none">
                    {plans.filter(p => p.status === 'In Progress').length}
                 </span>
                 <span className="text-[8px] font-bold text-[#1499AD]/65 ml-1">ta</span>
              </div>
           </div>
           <div className="bg-white rounded-2xl p-3 border border-slate-100 shadow-sm flex flex-col justify-between h-[72px] relative overflow-hidden">
              <div className="absolute -right-2 -bottom-2 w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center opacity-70">
                 <CheckCircle2 className="w-5 h-5 text-emerald-500/20" />
              </div>
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider leading-none">Jami smeta</span>
              <div>
                 <span className="text-xs font-black text-emerald-600 leading-none truncate block">
                    {formatCompactCurrency(plans.reduce((sum, p) => sum + (p.total_price || 0), 0))}
                 </span>
              </div>
           </div>
        </div>

        {/* Status Filters Carousel */}
        <div className="flex gap-2 overflow-x-auto px-4 pb-4 no-scrollbar items-center">
           {[
              { id: 'all', label: 'Barchasi', count: plans.length },
              { id: 'Planned', label: 'Rejalangan', count: plans.filter(p => p.status === 'Planned').length },
              { id: 'In Progress', label: 'Jarayonda', count: plans.filter(p => p.status === 'In Progress').length },
              { id: 'Completed', label: 'Yakunlangan', count: plans.filter(p => p.status === 'Completed').length }
           ].map(f => (
              <button
                 key={f.id}
                 onClick={() => setStatusFilter(f.id)}
                 className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                    statusFilter === f.id
                    ? 'bg-slate-900 border-slate-900 text-white shadow-md'
                    : 'bg-white border-slate-100 text-slate-500 shadow-sm hover:border-slate-200'
                 }`}
              >
                 <span>{f.label}</span>
                 <span className={`px-1.5 py-0.5 rounded-md text-[8px] font-black ${
                    statusFilter === f.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-450'
                 }`}>{f.count}</span>
              </button>
           ))}
        </div>

        {/* Treatment Plans List */}
        <div className="px-4 space-y-3">
           {loading ? [1,2,3,4].map(i => <div key={i} className="h-24 bg-white rounded-2xl animate-pulse border border-slate-55" />) : filteredPlans.length > 0 ? (
              filteredPlans.map((plan) => {
                 const svcs = (plan.services || []).flatMap(s => s.items || [s]);
                 const progress = Math.round((svcs.filter(s => s.status === 'completed').length / (svcs.length || 1)) * 100);
                 const initials = getInitials(plan.patient_name);
                 
                 // Extract unique tooth numbers
                 const teethSet = new Set();
                 (plan.services || []).forEach(s => {
                    const tId = s.tooth_id || s.tooth || s.tooth_number || 'general';
                    if (tId && tId !== 'general') {
                       teethSet.add(idToFdi(tId));
                    }
                 });
                 const teethList = Array.from(teethSet);
                 
                 const statusColors = {
                    'Planned': { bg: 'bg-amber-500', text: 'text-amber-600', badgeBg: 'bg-amber-50', label: 'Rejalangan' },
                    'In Progress': { bg: 'bg-[#1499AD]', text: 'text-[#1499AD]', badgeBg: 'bg-sky-50', label: 'Jarayonda' },
                    'Completed': { bg: 'bg-emerald-500', text: 'text-emerald-600', badgeBg: 'bg-emerald-50', label: 'Yakunlangan' }
                 };
                 const currentStatus = statusColors[plan.status] || statusColors['Planned'];
                 
                 return (
                    <motion.div 
                      key={plan.id} 
                      initial={{ opacity: 0, y: 10 }} 
                      animate={{ opacity: 1, y: 0 }} 
                      onClick={() => { setSelectedPlan(plan); setShowDetailModal(true); }} 
                      className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm relative overflow-hidden active:scale-[0.98] transition-all hover:shadow-md cursor-pointer"
                    >
                       <div className={`absolute top-0 left-0 w-1.5 h-full ${currentStatus.bg}`} />
                       
                       <div className="flex gap-3">
                          {/* Initials Circle */}
                          <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                             <span className="text-xs font-black text-slate-500 tracking-tight">{initials}</span>
                          </div>
                          
                          {/* Plan Details */}
                          <div className="flex-1 min-w-0">
                             <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${currentStatus.badgeBg} ${currentStatus.text}`}>
                                   {currentStatus.label}
                                </span>
                                {plan.created_date && (
                                   <span className="text-[9px] font-semibold text-slate-400">
                                      {formatDate(plan.created_date)}
                                   </span>
                                )}
                             </div>
                             
                             <h3 className="text-xs font-bold text-slate-800 uppercase tracking-tight leading-tight mb-1 truncate">
                                {plan.name || (t ? t('patientProfile.treatmentPlanSingular') : 'Davolash rejasi')}
                             </h3>
                             
                             <p className="text-[10px] font-bold text-slate-500 mb-2.5 leading-none">
                                {plan.patient_name || 'Bemor ismi'}
                             </p>
                             
                             {/* Tooth numbers and services */}
                             <div className="flex items-center gap-2 mb-3">
                                <div className="flex items-center gap-1 text-[9px] font-bold text-[#1499AD] bg-blue-50/60 border border-blue-100/50 px-2 py-0.5 rounded-lg">
                                   <span>{t('common.teeth') || 'Tishlar'}:</span>
                                   <span className="font-black">
                                      {teethList.length > 0 ? `#${teethList.join(', #')}` : (t ? t('common.general') : 'Umumiy')}
                                   </span>
                                </div>
                                <div className="text-[9px] font-semibold text-slate-400">
                                   {svcs.length} ta xizmat
                                </div>
                             </div>

                             {/* Pricing & Progress Meter */}
                             <div className="flex items-center justify-between gap-4 border-t border-slate-50 pt-2.5">
                                <div className="text-sm font-black text-slate-800 leading-none">
                                   {formatCurrency(plan.total_price || 0)}
                                </div>
                                
                                <div className="flex items-center gap-2 shrink-0">
                                   <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                      <div 
                                         className={`h-full rounded-full transition-all duration-500 ${progress === 100 ? 'bg-emerald-500' : 'bg-[#1499AD]'}`}
                                         style={{ width: `${progress}%` }}
                                      />
                                   </div>
                                   <span className="text-[9px] font-black text-slate-600">{progress}%</span>
                                </div>
                             </div>
                          </div>
                       </div>
                    </motion.div>
                 );
              })
           ) : (
              <div className="text-center py-12 bg-white rounded-2xl border border-slate-100 p-6">
                 <ClipboardList className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                 <p className="text-[11px] font-bold text-slate-455 uppercase tracking-widest leading-none">Ma'lumot topilmadi</p>
                 <p className="text-[10px] text-slate-400 mt-1.5 italic">Ushbu bo'limda hali davolash rejalari yaratilmagan.</p>
              </div>
           )}
        </div>

        {/* Floating Action Button (FAB) */}
        <button
          onClick={() => {
            setFormData({ patient_id: '', name: '', status: 'Planned', total_price: '' });
            setToothServices({});
            setSelectedTeeth([]);
            setFocusedTooth(null);
            setShowAddModal(true);
            setStep(1);
          }}
          className="fixed bottom-24 right-5 w-14 h-14 bg-[#1499AD] text-white rounded-full flex items-center justify-center shadow-lg shadow-[#1499AD]/30 z-40 active:scale-90 active:bg-[#118091] transition-all duration-200"
        >
          <Plus className="w-7 h-7" />
        </button>

        {/* Dialog for Adding New Treatment Plan */}
        <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
           <DialogContent className="max-w-md w-full h-[95vh] p-0 border-none rounded-t-2xl bg-white outline-none overflow-hidden flex flex-col">
              {/* Add Modal Header */}
              <div className="px-5 pt-6 pb-3 shrink-0 border-b border-slate-50 bg-white">
                 <div className="flex items-center justify-between mb-4">
                    {step > 1 ? (
                       <button onClick={() => setStep(step - 1)} className="w-8.5 h-8.5 bg-slate-50 hover:bg-slate-100 rounded-lg flex items-center justify-center text-slate-500 active:scale-90 transition-all"><ArrowLeft className="w-4 h-4" /></button>
                    ) : (
                       <div className="w-8.5 h-8.5" />
                    )}
                    <h2 className="text-base font-bold text-slate-900 uppercase tracking-tight">Yangi Davolash Rejasi</h2>
                    <button onClick={() => setShowAddModal(false)} className="w-8.5 h-8.5 bg-slate-50 hover:bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 active:scale-90 transition-all"><X className="w-4 h-4" /></button>
                 </div>
                 
                 {/* Progress Steps Indicators */}
                 <div className="relative px-6 pb-1">
                    <div className="flex items-center justify-between relative z-10">
                       {[1, 2, 3].map(s => {
                          const isActive = step >= s;
                          return (
                              <div key={s} className="flex flex-col items-center gap-1">
                                 <button
                                    onClick={() => step >= s && setStep(s)}
                                    className={`w-9 h-9 rounded-full flex items-center justify-center border transition-all duration-300 ${
                                       isActive 
                                       ? 'bg-[#1499AD] border-[#1499AD] text-white shadow-md shadow-[#1499AD]/20 scale-105' 
                                       : 'bg-white border-slate-100 text-slate-300 shadow-sm'
                                    }`}
                                 >
                                    {s === 1 ? <User className="w-4 h-4" /> : s === 2 ? <Sparkles className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                                 </button>
                                 <span className={`text-[8px] font-black uppercase tracking-wider ${
                                    isActive ? 'text-[#1499AD]' : 'text-slate-400'
                                 }`}>
                                    {s === 1 ? 'Bemor' : s === 2 ? 'Xizmatlar' : 'Yakunlash'}
                                 </span>
                              </div>
                          );
                       })}
                    </div>
                    <div className="absolute h-0.5 bg-slate-100 rounded-full left-14 right-14 top-4 -z-10">
                       <div 
                          className="h-full bg-[#1499AD] transition-all duration-300 rounded-full"
                          style={{ width: `${(step - 1) * 50}%` }}
                       />
                    </div>
                 </div>
              </div>

              {/* Step Contents */}
              <div className="flex-1 overflow-y-auto px-4 py-5 bg-[#F9FAFB] no-scrollbar">
                 {step === 1 && (
                    <div className="space-y-4">
                       <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm space-y-5">
                          <div className="relative z-20">
                             <Label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em] ml-1 mb-2 block flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5 text-slate-400" /> Bemor tanlash
                             </Label>
                             <PatientSelect patients={patients} value={formData.patient_id} onChange={id => setFormData({...formData, patient_id: id})} inputClassName="h-12 rounded-xl text-sm border-slate-100 bg-slate-50 focus:border-[#1499AD] transition-all" />
                          </div>
                          
                          <div className="relative z-10">
                             <Label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em] ml-1 mb-2 block flex items-center gap-1.5">
                                <ClipboardList className="w-3.5 h-3.5 text-slate-400" /> Reja nomi
                             </Label>
                             <Input 
                                placeholder="Masalan: Kompleks plomba davolash..." 
                                value={formData.name} 
                                onChange={e => setFormData({...formData, name: e.target.value})} 
                                className="h-12 rounded-xl font-bold bg-slate-55 border-slate-100 focus:border-[#1499AD] px-4 text-sm transition-all focus:ring-4 focus:ring-[#1499AD]/5" 
                             />
                          </div>
                       </div>
                       
                       <div className="bg-sky-50/40 p-4 rounded-xl border border-sky-100/50 flex items-start gap-3">
                          <Info className="w-4 h-4 text-[#1499AD] mt-0.5 shrink-0" />
                          <div>
                             <h5 className="text-[10px] font-black text-sky-900 uppercase tracking-wider mb-0.5">Yordamchi yo'riqnoma</h5>
                             <p className="text-[10px] font-semibold text-sky-800 leading-normal">
                                Bemor va davolash rejasining nomini kiriting. Davom etish tugmasini bosib, keyingi bosqichda tish formulasi orqali tishlarni belgilashingiz va tegishli tish xizmatlarini biriktirishingiz mumkin.
                             </p>
                          </div>
                       </div>
                    </div>
                 )}
                 
                 {step === 2 && (
                    <div className="space-y-4 pb-20">
                       {/* Odontogram Card */}
                       <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                          <ProfessionalOdontogram selectedTeeth={selectedTeeth} focusedTooth={focusedTooth} multi={true} onChange={setSelectedTeeth} onToothClick={setFocusedTooth} compact={true} />
                       </div>
                       
                       {(focusedTooth || selectedTeeth[0]) && (
                          <div className="space-y-4">
                             {/* Categories List */}
                             <div className="bg-white/90 backdrop-blur-md rounded-2xl p-3 border border-slate-100 shadow-sm">
                                <div className="flex gap-2 overflow-x-auto no-scrollbar scroll-smooth">
                                   {dynamicCategories.map(cat => {
                                      const catStyle = getCategoryStyle(cat);
                                      const CatIcon = catStyle.icon;
                                      const isAct = activeCategory === cat;
                                      return (
                                         <button 
                                            key={cat} 
                                            onClick={() => setActiveCategory(cat)} 
                                            className={`flex-none flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all border ${
                                               isAct 
                                               ? 'bg-slate-900 border-slate-900 text-white shadow-sm' 
                                               : `bg-slate-50 border-slate-100 ${catStyle.color} hover:border-slate-200`
                                            }`}
                                         >
                                            {CatIcon && <CatIcon className="w-3.5 h-3.5" />}
                                            <span>{cat === 'all' ? 'Barchasi' : cat}</span>
                                         </button>
                                      );
                                   })}
                                </div>
                             </div>

                             {/* Tooth Selected Services */}
                             <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                                <div className="flex items-center gap-1.5 mb-3">
                                   <span className="w-8 h-8 bg-[#1499AD] text-white rounded-xl flex items-center justify-center font-bold text-xs shadow-md shadow-[#1499AD]/10">
                                      #{idToFdi(focusedTooth || selectedTeeth[0]) || 'General'}
                                   </span>
                                   <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest ml-1">Tishga biriktirilgan xizmatlar</h4>
                                </div>
                                
                                <div className="space-y-2">
                                   {toothServices[focusedTooth || selectedTeeth[0]]?.length > 0 ? (
                                      toothServices[focusedTooth || selectedTeeth[0]]?.map(ts => {
                                         const s = services.find(x => x.id === ts.service_id);
                                         return (
                                            <div key={ts.service_id} className="flex justify-between items-center bg-slate-50/50 p-2.5 pl-3.5 rounded-xl border border-slate-100/50">
                                               <div className="min-w-0 pr-2">
                                                  <p className="text-xs font-bold uppercase text-slate-800 mb-0.5 truncate">{s?.name}</p>
                                                  <p className="text-[11px] font-black text-emerald-600">{formatCurrency(s?.price || 0)}</p>
                                               </div>
                                               <button onClick={() => toggleServiceForTooth(focusedTooth || selectedTeeth[0], ts.service_id)} className="w-8 h-8 bg-red-50 text-red-500 rounded-lg flex items-center justify-center shrink-0 hover:bg-red-100 active:scale-90 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                                            </div>
                                         );
                                      })
                                   ) : (
                                      <p className="text-center text-[10px] text-slate-400 italic py-2 leading-none">Xizmatlar biriktirilmagan. Quyidagi ro'yxatdan xizmat qo'shing.</p>
                                   )}
                                </div>
                             </div>

                             {/* Available Services List */}
                             <div className="space-y-2 max-h-[35vh] overflow-y-auto no-scrollbar pb-6">
                                {services.filter(s => {
                                   const categoryMatch = activeCategory === 'all' || s.category === activeCategory;
                                   if (!categoryMatch) return false;
                                   const svcTeeth = s.tooth_numbers || [];
                                   if (svcTeeth.length === 0) return true;
                                   const currentTooth = focusedTooth || selectedTeeth[0];
                                   if (!currentTooth) return true;
                                   const currentFdi = idToFdi(currentTooth) || String(currentTooth);
                                   return svcTeeth.some(t => String(t) === String(currentFdi));
                                }).map(svc => {
                                   const has = toothServices[focusedTooth || selectedTeeth[0]]?.some(i => i.service_id === svc.id);
                                   const catStyle = getCategoryStyle(svc.category);
                                   return (
                                      <button 
                                         key={svc.id} 
                                         onClick={() => toggleServiceForTooth(focusedTooth || selectedTeeth[0], svc.id)} 
                                         className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                                            has 
                                            ? 'bg-emerald-50/40 border-emerald-500 shadow-sm' 
                                            : 'bg-white border-slate-100 shadow-sm hover:border-slate-200'
                                         }`}
                                      >
                                         <div className="flex items-center gap-3 min-w-0 flex-1">
                                            <div className={`w-8.5 h-8.5 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                                               has ? 'bg-emerald-500 text-white' : 'bg-slate-50 text-slate-400 border border-slate-100'
                                            }`}>
                                               {has ? <Check className="w-4 h-4 stroke-[4]" /> : <Plus className="w-4 h-4" />}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                               <p className={`text-xs font-bold uppercase tracking-tight mb-0.5 truncate ${has ? 'text-emerald-700' : 'text-slate-800'}`}>
                                                  {svc.name}
                                               </p>
                                               <div className="flex items-center gap-2">
                                                  <span className="text-[10px] font-semibold text-slate-400">
                                                     {formatCurrency(svc.price)}
                                                  </span>
                                                  {svc.category && (
                                                     <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded ${catStyle.bg} ${catStyle.color}`}>
                                                        {svc.category}
                                                     </span>
                                                  )}
                                               </div>
                                            </div>
                                         </div>
                                      </button>
                                   );
                                })}
                             </div>
                          </div>
                       )}
                    </div>
                 )}
                 
                 {step === 3 && (() => {
                    const p = patients.find(x => x.id === formData.patient_id);
                    const flatSvcs = Object.entries(toothServices).flatMap(([tId, svcs]) => 
                       svcs.map(s => {
                          const svc = services.find(x => x.id === s.service_id);
                          return { ...s, tooth_id: tId, service_name: svc?.name, price: svc?.price };
                       })
                    );

                    return (
                       <div className="space-y-4">
                          {/* Mini Premium Receipt */}
                          <div className="bg-white rounded-2xl border border-slate-100 shadow-md overflow-hidden text-left relative">
                             {/* Decorative cutouts at side */}
                             <div className="absolute top-24 -left-2.5 w-5 h-5 bg-[#F9FAFB] rounded-full border border-slate-100 z-10" />
                             <div className="absolute top-24 -right-2.5 w-5 h-5 bg-[#F9FAFB] rounded-full border border-slate-100 z-10" />

                             {/* Header */}
                             <div className="bg-slate-900 text-white p-5 flex justify-between items-center">
                                <div>
                                   <h4 className="text-xs font-black tracking-widest uppercase leading-none">DentaCRM</h4>
                                   <span className="text-[8px] text-white/50 font-bold block mt-1 uppercase tracking-wider">Davolash Rejasi Smetasi</span>
                                </div>
                                <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-lg uppercase tracking-wider">TAYYOR</span>
                             </div>

                             <div className="p-5 space-y-4">
                                {/* Patient Info */}
                                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100/50 flex justify-between items-center">
                                   <div>
                                      <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest block">Bemor</span>
                                      <span className="text-[10px] font-black text-slate-800 uppercase leading-none block mt-1">{p?.full_name || 'Bemor tanlanmagan'}</span>
                                   </div>
                                   <div className="text-right">
                                      <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest block">Sana</span>
                                      <span className="text-[9px] font-bold text-slate-600 leading-none block mt-1">{new Date().toLocaleDateString()}</span>
                                   </div>
                                </div>

                                {/* Services Table */}
                                <div>
                                   <div className="grid grid-cols-[auto_1fr_auto] gap-2 px-3 py-1.5 bg-slate-100/80 rounded-t-xl">
                                      <span className="text-[8px] font-black text-slate-455 uppercase tracking-wider">Tish</span>
                                      <span className="text-[8px] font-black text-slate-455 uppercase tracking-wider">Xizmat nomi</span>
                                      <span className="text-[8px] font-black text-slate-455 uppercase tracking-wider text-right">Narxi</span>
                                   </div>
                                   <div className="border border-t-0 border-slate-100 rounded-b-xl divide-y divide-slate-100/60 max-h-[22vh] overflow-y-auto no-scrollbar">
                                      {flatSvcs.length > 0 ? flatSvcs.map((s, idx) => {
                                         const fdi = idToFdi(s.tooth_id);
                                         return (
                                            <div key={idx} className="grid grid-cols-[auto_1fr_auto] gap-2 items-center px-3 py-2.5 bg-white hover:bg-slate-50/50 transition-colors">
                                               <span className="text-[9px] font-black text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-lg leading-none">
                                                  {fdi ? `#${fdi}` : 'Umumiy'}
                                               </span>
                                               <span className="text-[10px] font-bold text-slate-800 uppercase truncate mr-2">{s.service_name}</span>
                                               <span className="text-[10px] font-black text-slate-900 text-right whitespace-nowrap">{formatCurrency(s.price || 0)}</span>
                                            </div>
                                         );
                                      }) : (
                                         <div className="p-4 text-center text-[10px] text-slate-400 italic">Xizmatlar tanlanmagan</div>
                                      )}
                                   </div>
                                </div>

                                <div className="border-t border-dashed border-slate-200 my-2" />

                                {/* Totals */}
                                <div className="bg-slate-900 rounded-2xl p-4 flex justify-between items-center text-white shadow-md relative overflow-hidden">
                                   <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500 rounded-full blur-[40px] opacity-15 pointer-events-none" />
                                   <div>
                                      <span className="text-[8px] font-bold text-white/50 uppercase tracking-widest">To'lov uchun jami</span>
                                      <h3 className="text-base font-black tracking-tight mt-1">{formatCurrency(Number(formData.total_price))}</h3>
                                   </div>
                                   <div className="bg-emerald-500/25 border border-emerald-500/35 rounded-lg px-2.5 py-1 text-[8px] font-black text-emerald-400 uppercase tracking-widest leading-none">
                                      TASDIQLANDI
                                   </div>
                                </div>

                                {/* Barcode cutouts */}
                                <div className="flex flex-col items-center justify-center pt-2 mt-2">
                                   <div className="h-6 flex items-center justify-center gap-0.5 opacity-30 select-none">
                                      {[1, 2, 4, 1, 3, 2, 1, 5, 2, 1, 3, 1, 4, 2].map((w, idx) => (
                                         <div key={idx} className="h-full bg-slate-900" style={{ width: `${w}px` }} />
                                      ))}
                                   </div>
                                   <span className="text-[7px] text-slate-455 font-black tracking-widest mt-1">{planCode}</span>
                                </div>
                             </div>
                          </div>
                       </div>
                    );
                 })()}
              </div>
              
              {/* Wizard Footer Controls */}
              <div className="px-5 py-4 border-t border-slate-100 bg-white flex gap-3 shrink-0 shadow-lg">
                 {step === 1 ? (
                    <Button 
                       variant="outline" 
                       onClick={() => setShowAddModal(false)} 
                       className="h-11 px-5 rounded-xl border border-slate-200 text-slate-500 font-bold uppercase text-xs tracking-wider active:scale-95 transition-all"
                    >
                       Bekor qilish
                    </Button>
                 ) : (
                    <button 
                       onClick={() => setStep(step - 1)} 
                       className="w-11 h-11 bg-slate-50 rounded-xl flex items-center justify-center text-slate-500 border border-slate-150 active:scale-95 transition-all shrink-0"
                    >
                       <ArrowLeft className="w-5 h-5" />
                    </button>
                 )}
                 <Button 
                    onClick={() => { if(step === 2) setStep(3); else if(step === 3) handleSaveInternal(); else setStep(step+1); }} 
                    className="flex-1 h-11 rounded-xl bg-slate-900 text-white font-bold uppercase text-xs tracking-wider shadow-md active:scale-95 transition-all"
                 >
                    {saving ? '...' : (step === 3 ? 'YAKUNLASH' : 'DAVOM ETISH')}
                 </Button>
              </div>
           </DialogContent>
        </Dialog>

        {/* Invoice Generator component */}
        <TreatmentPlanInvoice open={showInvoice} onClose={() => setShowInvoice(false)} plan={selectedPlan} />
        {/* Dialog for Viewing Plan Details */}
        <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
         <DialogContent className="max-w-md w-full max-h-[92vh] p-0 border-none rounded-[2rem] bg-white outline-none overflow-hidden flex flex-col shadow-2xl">
              {/* ── Yashil Header ── */}
               <div className="bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 px-5 pt-5 pb-4 rounded-t-[2rem] shrink-0 text-white">
                  {/* Title row */}
                  <div className="flex items-start justify-between mb-4">
                     <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-sm">
                           <ClipboardList className="w-5 h-5 text-white" />
                        </div>
                        <div>
                           <h2 className="text-[15px] font-black text-white uppercase leading-none tracking-tight">Reja Tafsiloti</h2>
                           <p className="text-[9px] font-bold text-white/70 uppercase tracking-widest mt-0.5">Dental System</p>
                        </div>
                     </div>
                     <button onClick={() => setShowDetailModal(false)} className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center active:scale-90 transition-all">
                        <X className="w-4 h-4" />
                     </button>
                  </div>

                  {/* Bemor info + progress ring */}
                  <div className="flex items-center justify-between">
                     <div className="min-w-0 flex-1 pr-3">
                        <span className="text-[9px] font-black text-white/60 uppercase tracking-widest block leading-none">Bemor</span>
                        <h4 className="text-[14px] font-black text-white uppercase truncate leading-tight">{selectedPlan?.patient_name}</h4>
                        <span className="text-[9px] font-black text-white/60 uppercase tracking-widest block leading-none mt-1.5">Reja nomi</span>
                        <h3 className="text-[11px] font-bold text-white/90 uppercase tracking-tight leading-tight truncate">{selectedPlan?.name}</h3>
                     </div>
                     {/* Circular Progress Ring */}
                     <div className="relative w-14 h-14 flex items-center justify-center shrink-0">
                        <svg className="w-full h-full transform -rotate-90">
                           <circle cx="28" cy="28" r="23" stroke="rgba(255,255,255,0.2)" strokeWidth="4.5" fill="transparent" />
                           <circle cx="28" cy="28" r="23" stroke="white" strokeWidth="4.5" fill="transparent"
                              strokeDasharray={144.5}
                              strokeDashoffset={144.5 - (144.5 * (completedServices.length / (groupedServices.flatMap(g => g.items).length || 1)))}
                              strokeLinecap="round"
                              className="transition-all duration-300"
                           />
                        </svg>
                        <span className="absolute text-[11px] font-black text-white">
                           {Math.round((completedServices.length / (groupedServices.flatMap(g => g.items).length || 1)) * 100)}%
                        </span>
                     </div>
                  </div>

                  {/* Jami smeta qiymati */}
                  <div className="flex justify-between items-center mt-3 p-2.5 bg-white/15 backdrop-blur-sm text-white rounded-xl border border-white/20">
                     <div className="flex flex-col">
                        <span className="text-[9px] font-bold uppercase opacity-70">Jami smeta qiymati</span>
                        <span className="text-[14px] font-black tracking-tight">{formatCurrency(selectedPlan?.total_price || 0)}</span>
                     </div>
                     <div className="bg-white/20 px-2.5 py-1 rounded-lg text-[9px] font-black tracking-wide uppercase">
                        {completedServices.length} / {groupedServices.flatMap(g => g.items).length} bajarildi
                     </div>
                  </div>
               </div>
                 
               {/* Xizmatlar ro'yxati — oq fon */}
               <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 no-scrollbar bg-slate-50">
                   {/* Grouped Services List */}
                   <div className="space-y-2">
                     {groupedServices.map((item, idx) => {
                        const displayTooth = idToFdi(item.tooth_id);
                        const titleText = displayTooth ? `#${displayTooth}-tish xizmatlari` : "Umumiy xizmatlar";
                        return (
                           <div key={idx} className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                              <div className="px-3 py-2 bg-slate-50/50 border-b font-bold text-[9px] text-[#1499AD] uppercase tracking-wider flex items-center gap-1.5">
                                 <span className="w-1.5 h-1.5 rounded-full bg-[#1499AD]" />
                                 <span>{titleText}</span>
                              </div>
                              {item.items.map((svc) => {
                                  const k = svc.originalIndex;
                                  const isCh = completedServices.includes(k);
                                  const originalService = services.find(x => x.id === svc.service_id || x.name === (svc.service_name || svc.name));
                                  const catStyle = originalService?.category ? getCategoryStyle(originalService.category) : null;
                                  return (
                                    <div key={k} className={`w-full flex items-center justify-between py-2 px-3 border-b last:border-0 transition-colors ${isCh ? 'bg-emerald-50/10' : 'bg-white'}`}>
                                       <div className="flex items-center gap-2.5 text-left min-w-0 flex-1">
                                          <button 
                                            onClick={() => { setCompletedServices(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k]); }} 
                                            className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 transition-all duration-300 ${isCh ? 'bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-500/10' : 'bg-slate-50/50 border-slate-200 text-transparent active:scale-90'}`}
                                          >
                                            <Check className="w-3.5 h-3.5 stroke-[4]" />
                                          </button>
                                          <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                               <p className={`text-[11px] font-bold uppercase leading-tight truncate ${isCh ? 'line-through text-slate-400' : 'text-slate-800'}`}>{svc.service_name || svc.name || 'Xizmat'}</p>
                                               {originalService?.category && catStyle && (
                                                  <span className={`text-[7px] font-black uppercase px-1 py-0.5 rounded leading-none shrink-0 ${catStyle.bg} ${catStyle.color}`}>
                                                     {originalService.category.split('(')[0].trim()}
                                                  </span>
                                               )}
                                            </div>
                                            <p className={`text-[10px] font-black ${isCh ? 'text-emerald-500/60' : 'text-emerald-600'}`}>{formatCurrency(svc.price || 0)}</p>
                                          </div>
                                       </div>
                                    </div>
                                  );
                               })}
                           </div>
                        );
                     })}
                  </div>
               </div>
               {/* Detail Modal Action Controls */}
               <div className="px-4 py-3 bg-white border-t border-slate-100 flex gap-2 shrink-0 shadow-lg">
                  <button 
                     onClick={() => handleDeletePlan(selectedPlan.id)} 
                     className="w-10 h-10 bg-rose-50 border border-rose-100 text-rose-500 rounded-xl flex items-center justify-center shrink-0 active:scale-95 active:bg-rose-100 transition-all"
                     title="Rejani o'chirish"
                  >
                     <Trash2 className="w-4 h-4" />
                  </button>
                  <Button onClick={() => { setShowDetailModal(false); setTimeout(() => setShowInvoice(true), 300); }} className="flex-1 h-10 bg-slate-50 text-slate-800 border border-slate-200 rounded-xl font-bold text-[9px] uppercase tracking-wider active:scale-95 transition-all">Faktura</Button>
                  <Button onClick={async () => {
                      try {
                         const svcs = JSON.parse(JSON.stringify(selectedPlan.services || [])); let done = true;
                         svcs.forEach((item, i) => { if (item.items) item.items.forEach((s, sI) => { if (completedServices.includes(`${i}-${sI}`)) s.status = 'completed'; else { s.status = 'planned'; done = false; } }); else { if (completedServices.includes(`${i}`)) item.status = 'completed'; else { item.status = 'planned'; done = false; } } });
                         await base44.entities.TreatmentPlan.update(selectedPlan.id, { services: svcs, status: done ? 'Completed' : 'In Progress' });
                         toast.success("Muvaffaqiyatli saqlandi!"); setShowDetailModal(false); loadData();
                      } catch (e) { toast.error("Xato yuz berdi"); }
                   }} className="flex-[2] h-10 bg-[#1499AD] text-white rounded-xl font-bold text-[9px] uppercase tracking-wider shadow-md active:scale-95 transition-all border-none">Yangilash</Button>
               </div>
           </DialogContent>
        </Dialog>

      </div>
    </PullToRefresh>
  );
}
