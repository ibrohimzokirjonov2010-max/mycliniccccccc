import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRestorableState } from '@/hooks/useRestorableState';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { 
  Plus, Search, Check, X, ArrowLeft, User, Sparkles, Shield, Trash2, ClipboardList, Info,
  Activity, Scissors, Layers, TrendingUp, Syringe, Baby, CheckCircle2, Lock, SlidersHorizontal, FileText, ChevronRight, FilePlus2, ArrowRight
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { isPlanLocked, PLAN_LOCKED_BADGE, PLAN_LOCKED_TOOLTIP } from '@/lib/planLock';
import { Button } from '@/components/ui/button';
import PullToRefresh from '@/components/ui/PullToRefresh';
import ProfessionalOdontogram from '@/components/patients/ProfessionalOdontogram';
import { formatCurrency, formatPhone } from '@/lib/utils';
import { deleteTreatmentPlan, planAllocatedPaid } from '@/lib/treatmentDelete';
import { formatClinicDate } from '@/lib/clinicTime';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import TreatmentPlanInvoice from '@/components/treatments/TreatmentPlanInvoice';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/i18n/LanguageContext';
import { useClinic } from '@/lib/ClinicContext';
import PatientSelect from '@/components/patients/PatientSelect';
import { useAuth } from '@/lib/AuthContext';
import { resolveTreatingDoctor } from '@/lib/treatingDoctor';
import JawChoice from '@/components/patients/JawChoice';
import {
  buildJawPlanLines,
  isJawStorageKey,
  jawFamily,
  jawFamilyTitle,
  jawFromFdi,
  jawLabel,
  jawPlanTotal,
  jawScopeFromLabel,
  jawStorageKey,
} from '@/lib/jawServices';

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
  'TERAPIYA (ENDO + PLOMBA)': { icon: Activity, color: 'text-blue-500', bg: 'bg-blue-50', border: 'border-l-blue-500' },
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
  const { clinicName } = useClinic();
  const { user, isDoctor } = useAuth();
  const [plans, setPlans] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useRestorableState('searchQuery', '');
  const [statusFilter, setStatusFilter] = useRestorableState('statusFilter', 'all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [saving, setSaving] = useState(false);
  const [completedServices, setCompletedServices] = useState([]);
  const [step, setStep] = useState(1);
  const [selectedTeeth, setSelectedTeeth] = useState([]);
  const [toothServices, setToothServices] = useState({});
  const [jawPrompt, setJawPrompt] = useState(null);
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
      base44.entities.User.filter({ role: 'doctor' }, 'name').then((d) => setDoctors(d || [])).catch(() => setDoctors([]));
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
      const targetDoc = resolveTreatingDoctor({ pickedId: formData.doctor_id, patient: p, plans: plans.filter((pl) => pl.patient_id === p?.id), doctors, user });
      const targetDoctorId = targetDoc?.id || '';
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
          doctor_name: targetDoc?.name || '',
          total_price: Number(formData.total_price) || 0,
          services: Object.entries(toothServices).map(([tId, svcs]) => ({
              tooth_id: isJawStorageKey(tId) ? (svcs[0]?.tooth_number || jawLabel(tId === '__jaw_lower' ? 'lower' : 'upper')) : tId,
              tooth_number: isJawStorageKey(tId) ? (svcs[0]?.tooth_number || jawLabel(tId === '__jaw_lower' ? 'lower' : 'upper')) : idToFdi(tId),
              items: svcs.map(s => {
                  const svc = services.find(x => x.id === s.service_id);
                  return {
                    ...s,
                    service_name: s.service_name || svc?.name,
                    price: s.price ?? svc?.price,
                    tooth_number: s.tooth_number || (isJawStorageKey(tId) ? jawLabel(tId === '__jaw_lower' ? 'lower' : 'upper') : idToFdi(tId)),
                  };
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
    const plan = plans.find((item) => item.id === planId) || (selectedPlan?.id === planId ? selectedPlan : null);
    if (!plan) {
      toast.error("Reja topilmadi");
      return;
    }
    if (plan.patient_id === 'patient-y2ii8ynf2') {
      toast.error("Bu test bemor ma'lumoti o'zgartirilmaydi");
      return;
    }
    let paidAmount = 0;
    try {
      const info = await planAllocatedPaid(plan);
      paidAmount = info.paidAmount || 0;
    } catch { /* warning still optional */ }
    const warning = paidAmount > 0
      ? `Bu rejaga ${formatCurrency(paidAmount)} to‘lov biriktirilgan. O‘chirish reja summasini va qarzni yangilaydi. Qabul qilingan to‘lov yozuvi o‘chmaydi.`
      : "Ushbu davolash rejasini o'chirishni tasdiqlaysizmi? To'lanmagan qarz ham o'chiriladi va bemor qarzi qayta hisoblanadi.";
    if (!window.confirm(warning)) return;
    try {
      await deleteTreatmentPlan(plan);
      toast.success(t ? t('treatmentPlans.deleteSuccess') || "Davolash rejasi o'chirildi" : "Davolash rejasi o'chirildi");
      setShowDetailModal(false);
      loadData();
    } catch (e) {
      toast.error(e?.message === 'locked'
        ? "Bu test bemor ma'lumoti o'zgartirilmaydi"
        : (t ? t('treatmentPlans.deleteError') || "O'chirishda xatolik yuz berdi" : "O'chirishda xatolik yuz berdi"));
    }
  };

  const serviceTotal = (map) => Object.values(map).flat().reduce((sum, it) => {
    const catalog = services.find(s => s.id === it.service_id);
    return sum + (Number(it.price ?? catalog?.price) || 0);
  }, 0);

  const toggleServiceForTooth = (tId, svcId) => {
    const catalog = services.find(s => s.id === svcId);
    const family = jawFamily(catalog?.name);
    if (family && !isJawStorageKey(tId)) {
      const namedScope = jawScopeFromLabel(catalog?.name);
      setJawPrompt({
        family,
        serviceId: svcId,
        title: jawFamilyTitle(family),
        preset: namedScope || jawFromFdi(idToFdi(tId || focusedTooth || selectedTeeth[0])),
      });
      return;
    }
    const nt = { ...toothServices }; const cur = nt[tId] || [];
    if (!cur.some(i => i.service_id === svcId)) nt[tId] = [...cur, { service_id: svcId, status: 'planned' }];
    else { nt[tId] = cur.filter(i => i.service_id !== svcId); if (nt[tId].length === 0) delete nt[tId]; }
    setToothServices(nt);
    setFormData(prev => ({ ...prev, total_price: serviceTotal(nt).toString() }));
  };

  const confirmJawChoice = (choice) => {
    if (!jawPrompt?.family) return;
    const lines = buildJawPlanLines(jawPrompt.family, choice, services);
    const nt = { ...toothServices };
    ['upper', 'lower'].forEach((jaw) => {
      const key = jawStorageKey(jaw);
      if (!nt[key]) return;
      nt[key] = nt[key].filter(item => jawFamily(item.service_name) !== jawPrompt.family);
      if (nt[key].length === 0) delete nt[key];
    });
    lines.forEach((line) => {
      const key = jawStorageKey(line.jaw);
      nt[key] = [...(nt[key] || []), {
        service_id: line.service_id,
        service_name: line.service_name,
        price: line.price,
        tooth_number: line.tooth_number,
        status: 'planned',
      }];
    });
    setToothServices(nt);
    const jawTotal = jawPlanTotal(lines);
    setFormData(prev => ({
      ...prev,
      name: prev.name || lines.map(line => line.service_name).join(', '),
      total_price: serviceTotal(nt).toString() || String(jawTotal),
    }));
    setJawPrompt(null);
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

  const openNewPlan = () => {
    setFormData({ patient_id: '', name: '', status: 'Planned', total_price: '' });
    setToothServices({});
    setSelectedTeeth([]);
    setFocusedTooth(null);
    setShowAddModal(true);
    setStep(1);
  };

  return (
    <PullToRefresh onRefresh={loadData}>
      <div className="min-h-screen bg-[#F4F6F9] pb-32">
        
        {/* Page Header (design extra-06) */}
        <div className="px-4 pt-4 pb-3">
           <div className="flex items-center justify-between mb-3 gap-2">
              <div className="min-w-0">
                <h1 className="text-[24px] font-extrabold text-slate-900 leading-tight">Davolash Rejalari</h1>
                <p className="text-[13px] font-semibold text-slate-400 uppercase tracking-widest">{t('navigation.systemName')}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button type="button" aria-label="Filtr" onClick={() => setStatusFilter(statusFilter === 'all' ? 'In Progress' : 'all')} className="w-12 h-12 rounded-2xl bg-white border border-slate-200 text-[#1499AD] flex items-center justify-center"><SlidersHorizontal className="w-5 h-5" /></button>
                <button type="button" aria-label="Yangi reja" onClick={openNewPlan} className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-md"><Plus className="w-6 h-6" /></button>
              </div>
           </div>

           <div className="grid grid-cols-3 gap-2 mb-3">
              {[
                { icon: FileText, cls: 'bg-blue-50/70 border-blue-100', ic: 'bg-blue-100 text-blue-600', v: plans.length, l: 'Jami rejalar' },
                { icon: Activity, cls: 'bg-emerald-50/70 border-emerald-100', ic: 'bg-emerald-100 text-emerald-600', v: plans.filter(p => p.status === 'In Progress').length, l: 'Jarayonda' },
                { icon: CheckCircle2, cls: 'bg-violet-50/70 border-violet-100', ic: 'bg-violet-100 text-violet-600', v: formatCompactCurrency(plans.reduce((sum, p) => sum + (p.total_price || 0), 0)), l: 'Jami smeta' },
              ].map((k) => (
                <div key={k.l} className={`rounded-2xl border ${k.cls} p-2 flex items-center gap-1.5 min-w-0`}>
                  <span className={`w-8 h-8 rounded-full ${k.ic} flex items-center justify-center shrink-0`}><k.icon className="w-4 h-4" /></span>
                  <span className="min-w-0">
                    <span className="block text-[15px] font-extrabold text-slate-900 leading-tight whitespace-nowrap">{k.v}</span>
                    <span className="block text-[11px] font-bold text-slate-500 uppercase leading-tight">{k.l}</span>
                  </span>
                </div>
              ))}
           </div>

           <div className="flex gap-2">
             <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Qidiruv (bemor, tashxis, tish raqami...)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-12 pl-11 pr-3 rounded-2xl border border-slate-200 bg-white text-[15px] font-medium text-slate-800 outline-none placeholder:text-slate-400 focus:border-[#1499AD]/40"
                />
             </div>
             <button type="button" aria-label="Tozalash" onClick={() => { setSearchQuery(''); setStatusFilter('all'); }} className="w-12 h-12 rounded-2xl bg-white border border-slate-200 text-slate-500 flex items-center justify-center shrink-0"><SlidersHorizontal className="w-5 h-5" /></button>
           </div>
        </div>

        {/* Status Filters */}
        <div className="flex gap-2 overflow-x-auto px-4 pb-3 no-scrollbar items-center">
           {[
              { id: 'all', label: 'Barchasi', count: plans.length },
              { id: 'Planned', label: 'Rejalangan', count: plans.filter(p => p.status === 'Planned').length },
              { id: 'In Progress', label: 'Jarayonda', count: plans.filter(p => p.status === 'In Progress').length },
              { id: 'Completed', label: 'Yakunlangan', count: plans.filter(p => p.status === 'Completed').length }
           ].map(f => (
              <button
                 key={f.id}
                 onClick={() => setStatusFilter(f.id)}
                 className={`shrink-0 flex items-center gap-1.5 h-11 px-3.5 rounded-2xl text-[14px] font-bold transition-all border ${
                    statusFilter === f.id ? 'bg-slate-900 border-slate-900 text-white shadow-md' : 'bg-white border-slate-200 text-slate-600'
                 }`}
              >
                 <span>{f.label}</span>
                 <span className={`px-1.5 py-0.5 rounded-full text-[12px] font-bold ${statusFilter === f.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{f.count}</span>
              </button>
           ))}
        </div>

        {/* Treatment Plans List */}
        <div className="px-3 space-y-2.5">
           {loading ? [1,2,3,4].map(i => <div key={i} className="h-24 bg-white rounded-2xl animate-pulse" />) : filteredPlans.length > 0 ? (
              filteredPlans.map((plan) => {
                 const svcs = (plan.services || []).flatMap(s => s.items || [s]);
                 const progress = Math.round((svcs.filter(s => s.status === 'completed').length / (svcs.length || 1)) * 100);
                 const initials = getInitials(plan.patient_name);
                 const teethSet = new Set();
                 (plan.services || []).forEach(s => {
                    const tId = s.tooth_id || s.tooth || s.tooth_number || 'general';
                    if (tId && tId !== 'general') teethSet.add(idToFdi(tId));
                 });
                 const teethList = Array.from(teethSet);
                 const statusColors = {
                    'Planned': { bar: 'bg-amber-400', pill: 'bg-amber-50 text-amber-600', dot: 'bg-amber-500', av: 'bg-amber-50 text-amber-700', label: 'Rejalangan' },
                    'In Progress': { bar: 'bg-[#1499AD]', pill: 'bg-sky-50 text-[#1172a3]', dot: 'bg-[#1499AD]', av: 'bg-sky-50 text-[#1172a3]', label: 'Jarayonda' },
                    'Completed': { bar: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500', av: 'bg-emerald-50 text-emerald-700', label: 'Yakunlangan' }
                 };
                 const st = statusColors[plan.status] || statusColors['Planned'];
                 const pat = patients.find((p) => String(p.id) === String(plan.patient_id));
                 return (
                    <motion.div
                      key={plan.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => { setSelectedPlan(plan); setShowDetailModal(true); }}
                      className="bg-white rounded-2xl pl-4 pr-3 py-3 border border-slate-100 shadow-sm relative overflow-hidden active:scale-[0.99] transition-all cursor-pointer"
                    >
                       <div className={`absolute top-0 left-0 w-1.5 h-full ${st.bar}`} />
                       <div className="flex gap-3 items-start">
                          <div className={`w-12 h-12 rounded-full ${st.av} flex items-center justify-center shrink-0 text-[16px] font-bold`}>{initials}</div>
                          <div className="flex-1 min-w-0">
                             <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-[16px] font-extrabold text-slate-900 truncate">{plan.patient_name || 'Bemor'}</p>
                                  {pat?.phone && <p className="text-[13px] text-slate-500 truncate">{formatPhone(pat.phone)}</p>}
                                </div>
                                <div className="text-right shrink-0">
                                  <span className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-[12px] font-bold uppercase ${st.pill}`}><span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />{st.label}</span>
                                  {plan.created_date && <p className="text-[13px] text-slate-500 mt-0.5">{formatDate(plan.created_date)}</p>}
                                </div>
                             </div>
                             <p className="mt-1 text-[13px] font-bold text-slate-800 uppercase truncate flex items-center gap-1">
                                {isPlanLocked(plan) && (
                                  <span data-testid="plan-locked-icon" title={PLAN_LOCKED_TOOLTIP} aria-label={PLAN_LOCKED_BADGE} className="inline-flex text-amber-600 shrink-0"><Lock className="w-3.5 h-3.5" /></span>
                                )}
                                <span className="truncate">{plan.name || (t ? t('patientProfile.treatmentPlanSingular') : 'Davolash rejasi')}</span>
                             </p>
                             <p className="text-[13px] text-slate-500 truncate">{svcs.length} ta xizmat · {teethList.length > 0 ? `Tishlar: #${teethList.join(', #')}` : 'Umumiy'} · <b className="text-slate-700">{formatCurrency(plan.total_price || 0)}</b></p>
                             <div className="flex items-center gap-2 mt-1.5">
                                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                   <div className={`h-full rounded-full ${progress === 100 ? 'bg-emerald-500' : 'bg-[#1499AD]'}`} style={{ width: `${progress}%` }} />
                                </div>
                                <span className="text-[13px] font-bold text-slate-700 w-10 text-right">{progress}%</span>
                             </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-slate-400 shrink-0 self-center" />
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
          onClick={openNewPlan}
          className="fixed bottom-24 right-5 w-14 h-14 bg-[#1499AD] text-white rounded-full flex items-center justify-center shadow-lg shadow-[#1499AD]/30 z-40 active:scale-90 active:bg-[#118091] transition-all duration-200"
        >
          <Plus className="w-7 h-7" />
        </button>

        {/* Dialog for Adding New Treatment Plan */}
        <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
           <DialogContent className="max-w-md w-full h-[95vh] p-0 border-none rounded-t-2xl bg-white outline-none overflow-hidden flex flex-col">
              {/* Add Modal Header (design extra-07) */}
              <div className="shrink-0 bg-white">
                 <div className="flex items-center gap-3 px-4 py-4 bg-gradient-to-r from-[#0F8F86] to-[#14A39A] text-white">
                    {step > 1 ? (
                       <button aria-label="Orqaga" onClick={() => setStep(step - 1)} className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center shrink-0 active:scale-95"><ArrowLeft className="w-5 h-5" /></button>
                    ) : (
                       <span className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center shrink-0"><FilePlus2 className="w-6 h-6" /></span>
                    )}
                    <div className="flex-1 min-w-0">
                       <h2 className="text-[19px] font-extrabold leading-tight">Yangi davolash rejasi</h2>
                       <p className="text-[13px] text-white/80">Yangi reja qo'shish</p>
                    </div>
                    <button aria-label="Yopish" onClick={() => setShowAddModal(false)} className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center shrink-0 active:scale-95"><X className="w-5 h-5" /></button>
                 </div>
                 <div className="relative px-8 pt-4 pb-3 border-b border-slate-100">
                    <div className="flex items-start justify-between relative z-10">
                       {[1, 2, 3].map(s => {
                          const isActive = step >= s;
                          return (
                              <div key={s} className="flex flex-col items-center gap-1.5 w-20">
                                 <button
                                    onClick={() => step >= s && setStep(s)}
                                    className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${isActive ? 'bg-[#0F8F86] border-[#0F8F86] text-white shadow-md shadow-teal-700/20' : 'bg-white border-slate-200 text-slate-400'}`}
                                 >
                                    {s === 1 ? <User className="w-5 h-5" /> : s === 2 ? <Sparkles className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
                                 </button>
                                 <span className={`text-[14px] font-semibold ${isActive ? 'text-[#0F8F86]' : 'text-slate-400'}`}>
                                    {s === 1 ? 'Bemor' : s === 2 ? 'Xizmatlar' : 'Yakunlash'}
                                 </span>
                              </div>
                          );
                       })}
                    </div>
                    <div className="absolute h-0.5 bg-slate-200 rounded-full left-[4.5rem] right-[4.5rem] top-[2.45rem]">
                       <div className="h-full bg-[#0F8F86] transition-all duration-300 rounded-full" style={{ width: `${(step - 1) * 50}%` }} />
                    </div>
                 </div>
              </div>

              {/* Step Contents */}
              <div className="flex-1 overflow-y-auto px-4 py-4 bg-[#F6F8FA] no-scrollbar">
                 {step === 1 && (
                    <div className="space-y-3">
                       <div className="p-4 bg-white rounded-2xl border border-slate-200 relative z-20">
                          <Label className="text-[16px] font-bold text-slate-900 mb-3 flex items-center gap-2">
                             <span className="w-10 h-10 rounded-xl bg-teal-50 text-[#0F8F86] inline-flex items-center justify-center shrink-0"><User className="w-5 h-5" /></span> Bemor tanlash <span className="text-rose-500">*</span>
                          </Label>
                          <PatientSelect patients={patients} value={formData.patient_id} onChange={id => setFormData({...formData, patient_id: id})} placeholder="Ism yoki telefon orqali qidiring..." inputClassName="h-12 rounded-xl text-[15px] border-slate-200 bg-white focus:border-[#0F8F86] transition-all" />
                       </div>
                       <div className="p-4 bg-white rounded-2xl border border-slate-200 relative z-10">
                          <Label className="text-[16px] font-bold text-slate-900 mb-3 flex items-center gap-2">
                             <span className="w-10 h-10 rounded-xl bg-teal-50 text-[#0F8F86] inline-flex items-center justify-center shrink-0"><FileText className="w-5 h-5" /></span> Reja nomi <span className="text-rose-500">*</span>
                          </Label>
                          <Input
                             placeholder="Masalan: Kompleks plomba davolash, Implant rejasi..."
                             value={formData.name}
                             onChange={e => setFormData({...formData, name: e.target.value})}
                             className="h-12 rounded-xl font-medium bg-white border-slate-200 focus:border-[#0F8F86] px-4 text-[15px] placeholder:text-slate-400"
                          />
                       </div>
                       <div className="bg-sky-50/60 p-4 rounded-2xl border border-sky-100 flex items-start gap-3">
                          <Info className="w-5 h-5 text-[#1172a3] mt-0.5 shrink-0" />
                          <div>
                             <h5 className="text-[15px] font-bold text-sky-900 mb-1">Yordamchi yo'riqnoma</h5>
                             <p className="text-[14px] text-slate-600 leading-relaxed">
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
                                {jawPrompt && (
                                  <JawChoice
                                    title={jawPrompt.title}
                                    preset={jawPrompt.preset} family={jawPrompt.family} services={services}
                                    onChoose={confirmJawChoice}
                                    onClose={() => setJawPrompt(null)}
                                  />
                                )}
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
                                   const family = jawFamily(svc.name);
                                   const scope = jawScopeFromLabel(svc.name);
                                   const has = family
                                     ? ['upper', 'lower'].some((jaw) => (
                                       (!scope || scope === jaw)
                                       && (toothServices[jawStorageKey(jaw)] || []).some((item) => jawFamily(item.service_name) === family)
                                     ))
                                     : toothServices[focusedTooth || selectedTeeth[0]]?.some(i => i.service_id === svc.id);
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
                                   <h4 className="text-xs font-black tracking-widest uppercase leading-none">{clinicName}</h4>
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
                                      <span className="text-[9px] font-bold text-slate-600 leading-none block mt-1">{formatClinicDate(new Date())}</span>
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
                       className="flex-1 h-12 px-5 rounded-2xl border border-slate-200 text-slate-700 font-bold text-[15px] active:scale-95 transition-all"
                    >
                       Bekor qilish
                    </Button>
                 ) : (
                    <button 
                       onClick={() => setStep(step - 1)} 
                       aria-label="Orqaga"
                       className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-500 border border-slate-200 active:scale-95 transition-all shrink-0"
                    >
                       <ArrowLeft className="w-5 h-5" />
                    </button>
                 )}
                 <Button 
                    onClick={() => { if(step === 2) setStep(3); else if(step === 3) handleSaveInternal(); else setStep(step+1); }} 
                    className="flex-1 h-12 rounded-2xl bg-[#0F8F86] hover:bg-[#0c7d75] text-white font-bold text-[15px] shadow-md active:scale-95 transition-all gap-2"
                 >
                    {saving ? '...' : (step === 3 ? 'Yakunlash' : <>Davom etish <ArrowRight className="w-5 h-5" /></>)}
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
                           <p className="text-[9px] font-bold text-white/70 uppercase tracking-widest mt-0.5">{t('navigation.systemName')}</p>
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
