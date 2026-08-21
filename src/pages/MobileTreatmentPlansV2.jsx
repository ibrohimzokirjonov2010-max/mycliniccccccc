import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Search, Check, X, ArrowRight, ArrowLeft, User, Sparkles, Shield, Trash2, Bell, Menu, ClipboardList, Info
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
import { Badge } from '@/components/ui/badge';

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

export default function MobileTreatmentPlansV2() {
  const { t } = useTranslation();
  const [plans, setPlans] = useState([]);
  const [patients, setPatients] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
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

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [pl, pa, se] = await Promise.all([
        base44.entities.TreatmentPlan.list('-created_date', 100),
        base44.entities.Patient.list('-created_date', 50),
        base44.entities.Service.list('name', 500)
      ]);
      setPlans(pl || []); setPatients(pa || []); setServices(se || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const dynamicCategories = useMemo(() => {
    const categories = new Set(['all']);
    services.forEach(s => { if (s.category) categories.add(s.category); });
    return Array.from(categories);
  }, [services]);

  const handleSaveInternal = async () => {
    if (!formData.patient_id || !formData.name) { toast.error("To'ldiring"); return; }
    setSaving(true);
    try {
      const p = patients.find(x => x.id === formData.patient_id);
      const allSvcNames = Object.values(toothServices).flat().map(it => services.find(x => x.id === it.service_id)?.name).filter(Boolean);
      const MAX_SHOW = 2;
      const compactName = allSvcNames.length > MAX_SHOW
        ? allSvcNames.slice(0, MAX_SHOW).join(', ') + ` +${allSvcNames.length - MAX_SHOW} ta`
        : allSvcNames.join(', ');

      const data = { 
          ...formData, 
          name: formData.name || compactName || 'Davolash rejasi',
          patient_name: p?.full_name || '', 
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
      await loadData(); setSelectedPlan(res); setShowAddModal(false); 
      setTimeout(() => setShowInvoice(true), 400); 
    } catch (e) { console.error(e); } finally { setSaving(false); }
  };

  const toggleServiceForTooth = (tId, svcId) => {
    const nt = { ...toothServices }; const cur = nt[tId] || [];
    if (!cur.some(i => i.service_id === svcId)) nt[tId] = [...cur, { service_id: svcId, status: 'planned' }];
    else { nt[tId] = cur.filter(i => i.service_id !== svcId); if (nt[tId].length === 0) delete nt[tId]; }
    setToothServices(nt);
    const total = Object.values(nt).flat().reduce((sum, it) => sum + (services.find(s => s.id === it.service_id)?.price || 0), 0);
    setFormData(prev => ({ ...prev, total_price: total.toString() }));
  };

  return (
    <PullToRefresh onRefresh={loadData}>
      <div className="min-h-screen bg-[#F4F6F9] pb-32">
        
        {/* Page Specific Header */}
        <div className="px-4 pt-5 pb-3">
           <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-lg font-bold text-slate-900 tracking-tight leading-none mb-1">Davolash Rejalari</h1>
                <p className="text-[9px] font-bold text-[#1499AD] uppercase tracking-wider opacity-85">Dental System</p>
              </div>
              <button 
                onClick={() => { setShowAddModal(true); setStep(1); }} 
                className="w-9.5 h-9.5 bg-slate-900 text-white rounded-xl flex items-center justify-center shadow-md active:scale-95 transition-all"
              >
                <Plus className="w-5.5 h-5.5" />
              </button>
           </div>
           <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Qidiruv..." 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                className="w-full h-10 pl-9 pr-4 rounded-xl border border-slate-200/50 bg-white text-xs font-semibold text-slate-800 shadow-sm outline-none placeholder:text-slate-400" 
              />
           </div>
        </div>

        {/* Treatment Plans List */}
        <div className="px-4 space-y-2.5">
           {loading ? [1,2,3,4].map(i => <div key={i} className="h-20 bg-white rounded-xl animate-pulse" />) : plans.length > 0 ? (
             plans.filter(p => ((p.name || '') + (p.patient_name || '')).toLowerCase().includes(searchQuery.toLowerCase())).map((plan) => {
                const svcs = (plan.services || []).flatMap(s => s.items || [s]);
                const progress = Math.round((svcs.filter(s => s.status === 'completed').length / (svcs.length || 1)) * 100);
                return (
                   <motion.div 
                     key={plan.id} 
                     initial={{ opacity: 0, y: 10 }} 
                     animate={{ opacity: 1, y: 0 }} 
                     onClick={() => { setSelectedPlan(plan); setShowDetailModal(true); }} 
                     className="bg-white rounded-xl p-3.5 pl-5 border border-slate-100 shadow-sm relative overflow-hidden active:scale-[0.98] transition-all"
                   >
                      <div className={`absolute top-0 left-0 w-1 h-full ${progress === 100 ? 'bg-emerald-500' : 'bg-[#1499AD]'}`} />
                      <div className="flex justify-between items-start">
                         <div className="flex-1 pr-2 min-w-0">
                            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-tight leading-tight mb-0.5 truncate">{plan.name || plan.title}</h3>
                            <p className="text-[10px] font-medium text-slate-500 italic mb-3 truncate">{plan.patient_name || 'Bemor ismi'}</p>
                            <p className="text-sm font-bold text-slate-800 leading-none">{formatCurrency(plan.total_price || 0)}</p>
                         </div>
                         <div className="relative w-10 h-10 flex items-center justify-center shrink-0">
                            <svg className="w-full h-full transform -rotate-90">
                              <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="3" fill="transparent" className="text-slate-50" />
                              <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="3" fill="transparent" strokeDasharray={100.5} strokeDashoffset={100.5 - (100.5 * progress) / 100} strokeLinecap="round" className={`${progress === 100 ? 'text-emerald-500' : 'text-[#1499AD]'} transition-all`} />
                            </svg>
                            <span className="absolute text-[9px] font-bold text-slate-800">{progress}%</span>
                         </div>
                      </div>
                      <ArrowRight className="absolute bottom-3.5 right-3.5 w-3.5 h-3.5 text-slate-200" />
                   </motion.div>
                );
             })
           ) : <p className="text-center py-8 text-slate-400 text-xs italic uppercase tracking-wider">Ma'lumot yo'q</p>}
        </div>

        {/* Wizard Modal */}
        <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
           <DialogContent className="max-w-md w-full h-[95vh] p-0 border-none rounded-t-2xl bg-white outline-none overflow-hidden flex flex-col">
              <div className="px-5 pt-6 pb-2 shrink-0 border-b border-slate-50">
                 <div className="flex items-center justify-between mb-4">
                    <button onClick={() => { if(step > 1) setStep(step-1); else setShowAddModal(false); }} className="w-8.5 h-8.5 bg-slate-55 rounded-lg flex items-center justify-center text-slate-400"><ArrowLeft className="w-4.5 h-4.5" /></button>
                    <h2 className="text-base font-bold text-slate-900 uppercase tracking-tight">Yangi Reja</h2>
                    <button onClick={() => setShowAddModal(false)} className="w-8.5 h-8.5 bg-slate-55 rounded-lg flex items-center justify-center text-slate-350"><X className="w-4.5 h-4.5" /></button>
                 </div>
                 <div className="flex items-center justify-between px-4 pb-2">
                    {[1,2,3].map(s => (
                       <div key={s} className="flex-1 flex flex-col items-center">
                          <div className={`w-8.5 h-8.5 rounded-lg flex items-center justify-center border border-white transition-all ${step >= s ? 'bg-[#1499AD] text-white shadow-md' : 'bg-white text-slate-200 shadow-sm border-slate-100'}`}>{s === 1 ? <User className="w-3.5 h-3.5" /> : s === 2 ? <Sparkles className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}</div>
                       </div>
                    ))}
                 </div>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-5 bg-[#F9FAFB] no-scrollbar">
                 {step === 1 && (
                    <div className="p-5 bg-white rounded-xl border border-slate-100 shadow-sm space-y-4">
                       <div><Label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider ml-1 mb-1.5 block">Bemor</Label><PatientSelect patients={patients} value={formData.patient_id} onChange={id => setFormData({...formData, patient_id: id})} inputClassName="h-11 rounded-xl text-sm" /></div>
                       <div><Label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider ml-1 mb-1.5 block">Reja nomi</Label><Input placeholder="Nomini kiriting..." value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="h-11 rounded-xl font-semibold bg-slate-50 border border-slate-100 px-4 text-sm" /></div>
                    </div>
                 )}
                 {step === 2 && (
                    <div className="space-y-4 pb-20">
                       <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm"><ProfessionalOdontogram selectedTeeth={selectedTeeth} focusedTooth={focusedTooth} multi={true} onChange={setSelectedTeeth} onToothClick={setFocusedTooth} compact={true} /></div>
                       {(focusedTooth || selectedTeeth[0]) && (
                          <div className="space-y-4">
                             {/* Fixed Category Navigation */}
                             <div className="bg-white/80 backdrop-blur-md rounded-xl p-3 border border-[#1499AD]/15 shadow-sm">
                                <div className="flex gap-2 overflow-x-auto no-scrollbar scroll-smooth">
                                   {dynamicCategories.map(cat => (
                                      <button 
                                         key={cat} 
                                         onClick={() => setActiveCategory(cat)} 
                                         className={`flex-none px-4 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all border ${
                                            activeCategory === cat 
                                            ? 'bg-slate-900 border-slate-900 text-white shadow-sm' 
                                            : 'bg-white border-slate-100 text-slate-450'
                                         }`}
                                      >
                                         {cat === 'all' ? 'Barchasi' : cat}
                                      </button>
                                   ))}
                                </div>
                             </div>

                             <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
                                <div className="flex items-center gap-1.5 mb-3"><span className="w-7 h-7 bg-[#1499AD] text-white rounded-md flex items-center justify-center font-bold text-xs">#{focusedTooth || selectedTeeth[0]}</span><h4 className="text-[10px] font-bold text-slate-800 uppercase tracking-wider">Tish xizmatlari</h4></div>
                                <div className="space-y-1.5">
                                   {toothServices[focusedTooth || selectedTeeth[0]]?.map(ts => {
                                      const s = services.find(x => x.id === ts.service_id);
                                      return (
                                        <div key={ts.service_id} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100/50">
                                           <div className="min-w-0 pr-2"><p className="text-xs font-bold uppercase text-slate-800 mb-0.5 truncate">{s?.name}</p><p className="text-[11px] font-bold text-emerald-600">{formatCurrency(s?.price || 0)}</p></div>
                                           <button onClick={() => toggleServiceForTooth(focusedTooth || selectedTeeth[0], ts.service_id)} className="w-8 h-8 bg-red-50 text-red-500 rounded-lg flex items-center justify-center shrink-0 hover:bg-red-100 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                                        </div>
                                      );
                                   })}
                                </div>
                             </div>

                             <div className="space-y-1.5 max-h-[35vh] overflow-y-auto no-scrollbar pb-6">
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
                                   return (
                                     <button key={svc.id} onClick={() => toggleServiceForTooth(focusedTooth || selectedTeeth[0], svc.id)} className={`w-full flex items-center justify-between p-3.5 rounded-xl border transition-all ${has ? 'bg-emerald-50/50 border-emerald-500 shadow-sm' : 'bg-white border-slate-100 shadow-sm'}`}><div className="flex items-center gap-3 text-left min-w-0 flex-1"><div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all ${has ? 'bg-emerald-500 text-white' : 'bg-slate-55 text-slate-350 border border-slate-100'}`}>{has ? <Check className="w-4 h-4 stroke-[4]" /> : <Plus className="w-4 h-4" />}</div><div className="min-w-0"><p className={`text-xs font-bold uppercase tracking-tight mb-0.5 truncate ${has ? 'text-emerald-700' : 'text-slate-800'}`}>{svc.name}</p><p className="text-[11px] text-slate-400 font-semibold">{formatCurrency(svc.price)}</p></div></div></button>
                                   );
                                })}
                             </div>
                          </div>
                       )}
                    </div>
                 )}
                 {step === 3 && (
                    <div className="text-center py-6 space-y-6">
                       <div className="w-16 h-16 bg-emerald-500 text-white rounded-full mx-auto flex items-center justify-center shadow-lg"><Check className="w-8 h-8 stroke-[4]" /></div>
                       <h3 className="text-xl font-bold text-slate-900 uppercase tracking-tight">Tayyor</h3>
                       <div className="bg-white rounded-xl p-5 space-y-4 text-left shadow-md border border-slate-100">
                          <div className="space-y-2.5">
                             {Object.entries(toothServices).map(([tId, svcs]) => (
                                <div key={tId} className="flex justify-between items-center text-[10px] font-bold text-slate-450 uppercase"><span>#{tId} tish xizmatlari</span><span className="text-slate-700">{formatCurrency(svcs.reduce((s,i) => s + (services.find(x => x.id === i.service_id)?.price || 0), 0))}</span></div>
                             ))}
                          </div>
                          <div className="flex justify-between items-center bg-slate-900 text-white p-4.5 rounded-xl shadow-md"><span className="text-[9px] font-bold uppercase opacity-70">Jami</span><span className="text-lg font-bold">{formatCurrency(Number(formData.total_price))}</span></div>
                       </div>
                    </div>
                 )}
              </div>
              <div className="px-5 py-4 border-t border-slate-100 bg-white flex gap-3 shrink-0">
                 <button onClick={() => { if(step > 1) setStep(step-1); else setShowAddModal(false); }} className="w-11 h-11 bg-slate-50 rounded-xl flex items-center justify-center text-slate-350 border border-slate-150"><ArrowLeft className="w-5 h-5" /></button>
                 <Button onClick={() => { if(step === 2) setStep(3); else if(step === 3) handleSaveInternal(); else setStep(step+1); }} className="flex-1 h-11 rounded-xl bg-slate-950 text-white font-bold uppercase text-xs tracking-wider shadow-md">{saving ? '...' : (step === 3 ? 'YAKUNLASH' : 'DAVOM ETISH')}</Button>
              </div>
           </DialogContent>
        </Dialog>

        <TreatmentPlanInvoice open={showInvoice} onClose={() => setShowInvoice(false)} plan={selectedPlan} />
        
        {/* Detail Dialog */}
        <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
           <DialogContent className="max-w-md w-full h-[95vh] p-0 border-none rounded-t-2xl bg-slate-50 outline-none overflow-hidden flex flex-col">
              <div className="px-5 py-4 bg-white border-b border-slate-100 flex justify-between items-center shrink-0">
                 <div className="flex items-center gap-3">
                   <div className="w-9.5 h-9.5 bg-slate-900 text-white rounded-xl flex items-center justify-center shadow-md"><ClipboardList className="w-5 h-5" /></div>
                   <div>
                     <h2 className="text-sm font-bold text-slate-900 uppercase">Reja Tafsiloti</h2>
                     <p className="text-[8px] font-bold text-[#1499AD] uppercase tracking-wider leading-none mt-0.5">Dental System</p>
                   </div>
                 </div>
                 <button onClick={() => setShowDetailModal(false)} className="w-8.5 h-8.5 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400"><X className="w-4.5 h-4.5" /></button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4 no-scrollbar pb-24">
                 <div className="bg-white rounded-xl p-4.5 shadow-sm border border-slate-100">
                   <h3 className="text-xs font-bold text-slate-900 uppercase mb-3 leading-tight truncate">{selectedPlan?.name}</h3>
                   <div className="flex justify-between items-center p-4 bg-slate-900 text-white rounded-xl shadow-md">
                     <span className="text-[9px] font-bold uppercase opacity-75">Umumiy Qiymat</span>
                     <span className="text-lg font-bold tracking-tight">{formatCurrency(selectedPlan?.total_price || 0)}</span>
                   </div>
                 </div>
                 <div className="space-y-3">
                    {selectedPlan?.services?.map((item, idx) => (
                       <div key={idx} className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
                          <div className="px-4 py-2 bg-slate-50/50 border-b font-bold text-[9px] text-[#1499AD] uppercase tracking-wider">#{item.tooth_id} tish xizmatlari</div>
                          {(item.items || [item]).map((svc, sI) => {
                             const k = item.items ? `${idx}-${sI}` : `${idx}`; const isCh = completedServices.includes(k);
                             return (
                               <div key={k} className={`w-full flex items-center justify-between p-3.5 border-b last:border-0 ${isCh ? 'bg-emerald-50/15' : 'bg-white'}`}>
                                  <div className="flex items-center gap-3 text-left min-w-0 flex-1">
                                     <button 
                                       onClick={() => { setCompletedServices(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k]); }} 
                                       className={`w-8.5 h-8.5 rounded-lg border flex items-center justify-center shrink-0 transition-all ${isCh ? 'bg-emerald-500 border-emerald-500 text-white shadow-md rotate-[360deg]' : 'bg-white border-slate-100 text-transparent'}`}
                                     >
                                       <Check className="w-5 h-5 stroke-[4]" />
                                     </button>
                                     <div className="min-w-0 flex-1">
                                       <p className={`text-xs font-bold uppercase mb-0.5 leading-tight truncate ${isCh ? 'line-through text-slate-300' : 'text-slate-800'}`}>{svc.service_name || item.service_name}</p>
                                       <p className={`text-[11px] font-semibold ${isCh ? 'text-emerald-350' : 'text-emerald-600'}`}>{formatCurrency(svc.price || item.price)}</p>
                                     </div>
                                  </div>
                               </div>
                             );
                          })}
                       </div>
                    ))}
                 </div>
              </div>
              <div className="px-5 py-4 bg-white border-t border-slate-100 flex gap-3 shrink-0 shadow-lg">
                 <Button onClick={() => { setShowDetailModal(false); setTimeout(() => setShowInvoice(true), 300); }} className="flex-1 h-11 bg-slate-55 text-slate-900 border border-slate-200 rounded-xl font-bold text-[9px] uppercase tracking-wider active:scale-95 transition-all">Faktura</Button>
                 <Button onClick={async () => {
                    try {
                       const svcs = JSON.parse(JSON.stringify(selectedPlan.services || [])); let done = true;
                       svcs.forEach((item, i) => { if (item.items) item.items.forEach((s, sI) => { if (completedServices.includes(`${i}-${sI}`)) s.status = 'completed'; else { s.status = 'planned'; done = false; } }); else { if (completedServices.includes(`${i}`)) item.status = 'completed'; else { item.status = 'planned'; done = false; } } });
                       await base44.entities.TreatmentPlan.update(selectedPlan.id, { services: svcs, status: done ? 'Completed' : 'In Progress' });
                       toast.success("SAQLANDI"); setShowDetailModal(false); loadData();
                    } catch (e) { toast.error("XATO"); }
                 }} className="flex-[2] h-11 bg-emerald-500 text-white rounded-xl font-bold text-[9px] uppercase tracking-wider shadow-md active:scale-95 transition-all">Yangilash</Button>
              </div>
           </DialogContent>
        </Dialog>

      </div>
    </PullToRefresh>
  );
}
