import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/lib/queryKeys';
import { 
  Plus, Search, ClipboardList, FileDown, 
  ChevronRight, Edit2, Activity, Clock, 
  Target, TrendingUp, Users, Trash2
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import EmptyState from '../components/ui/EmptyState';
import TreatmentPlanModal from '../components/treatments/TreatmentPlanModal';
import TreatmentPlanInvoice from '../components/treatments/TreatmentPlanInvoice';
import jsPDF from 'jspdf';
import { motion, AnimatePresence } from 'framer-motion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { useTranslation } from '@/i18n/LanguageContext';
import { toast } from 'sonner';

export default function TreatmentPlans() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [editPlan, setEditPlan] = useState(null);
  const [selectedPlanForInvoice, setSelectedPlanForInvoice] = useState(null);
  const [deletePlanId, setDeletePlanId] = useState(null);

  // ── React Query: Treatment plans ──────────────────────────────────────────
  const { data: rawPlans = [], isFetching: plansFetching } = useQuery({
    queryKey: QUERY_KEYS.treatmentPlans,
    queryFn: () => base44.entities.TreatmentPlan.list('-created_date', 50),
    staleTime: 3 * 60 * 1000,
  });

  // ── React Query: Patients (initial load) ──────────────────────────────────
  const { data: patients = [] } = useQuery({
    queryKey: QUERY_KEYS.patients,
    queryFn: () => base44.entities.Patient.list('full_name', 200),
    staleTime: 5 * 60 * 1000,
  });

  // ── React Query: Services (initial load) ──────────────────────────────────
  const { data: rawServices = [] } = useQuery({
    queryKey: QUERY_KEYS.services,
    queryFn: () => base44.entities.Service.list('name', 500),
    staleTime: 10 * 60 * 1000,
  });

  const plans = rawPlans;
  const loading = plansFetching && rawPlans.length === 0;

  // De-duplicate by name only (case-insensitive)
  const services = useMemo(() => {
    const seen = new Map();
    (rawServices || []).forEach(s => {
      const key = s.name?.toLowerCase().trim();
      if (key && !seen.has(key)) seen.set(key, s);
    });
    return Array.from(seen.values());
  }, [rawServices]);

  const invalidatePlans = () => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.treatmentPlans });
  };

  const handleDelete = async () => {
    if (!deletePlanId) return;
    try {
      // 1. Delete linked payments in parallel (not sequential)
      const linkedContext = `Linked to Plan: ${deletePlanId}`;
      const existingPayments = await base44.entities.Payment.filter({
        notes: linkedContext
      });
      
      await Promise.all(existingPayments.map(pay => base44.entities.Payment.delete(pay.id)));

      // 2. Delete the plan
      await base44.entities.TreatmentPlan.delete(deletePlanId);
      
      toast.success(t('common.success'));
      setDeletePlanId(null);
      invalidatePlans();
    } catch (err) {
      console.error(err);
      toast.error(t('common.error'));
    }
  };

  const updatePlanStatus = async (id, newStatus) => {
    try {
      const prev = plans.find(p => p.id === id)?.status;
      if (prev === newStatus) return;

      // Optimistic update
      queryClient.setQueryData(QUERY_KEYS.treatmentPlans, (old) => {
        return (old || []).map(p => p.id === id ? { ...p, status: newStatus } : p);
      });

      await base44.entities.TreatmentPlan.update(id, { status: newStatus });
      invalidatePlans();
    } catch (err) {
      console.error(err);
      invalidatePlans();
    }
  };

  const filtered = plans.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.patient_name?.toLowerCase().includes(search.toLowerCase())
  );

  // Stats — support both English and Uzbek status values
  const inProgressCount = plans.filter(p => p.status === 'Jarayonda' || p.status === 'In Progress' || p.status === 'InProgress').length;
  const scheduledCount = plans.filter(p => p.status === 'Rejalashtirilgan' || p.status === 'Planned' || p.status === 'Scheduled').length;
  const totalValue = plans.reduce((s, p) => s + (p.total_price || 0), 0);

  // Normalize status for display
  const normalizeStatus = (status) => {
    const s = String(status || '').toLowerCase();
    if (s.includes('plan') || s.includes('reja')) return 'planned';
    if (s.includes('progress') || s.includes('jarayon')) return 'in_progress';
    if (s.includes('complete') || s.includes('yakun') || s.includes('bajar')) return 'completed';
    return s || 'planned';
  };

  const generatePDF = (plan) => {
    const doc = new jsPDF();
    doc.setFontSize(22);
    doc.text(t('treatmentPlan.title').toUpperCase(), 105, 20, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`${t('treatmentPlan.patient')}: ${plan.patient_name}`, 20, 40);
    doc.text(`${t('common.name')}: ${plan.name}`, 20, 50);
    doc.text(`${t('common.status')}: ${t('status.' + normalizeStatus(plan.status))}`, 20, 60);
    doc.text(`${t('common.date')}: ${new Date().toLocaleDateString()}`, 20, 70);

    let y = 90;
    doc.setFontSize(14);
    doc.text(t('treatmentPlan.services').toUpperCase(), 20, y);
    y += 10;
    doc.setFontSize(11);
    (plan.services || []).forEach((s, i) => {
      doc.text(`${i + 1}. ${s.service_name}`, 25, y);
      doc.text(`${s.price?.toLocaleString()} UZS`, 150, y);
      y += 8;
    });

    y += 10;
    doc.line(20, y, 190, y);
    y += 10;
    doc.setFontSize(14);
    doc.text(`${t('common.total').toUpperCase()}: ${plan.total_price?.toLocaleString()} UZS`, 20, y);

    doc.save(`plan-${plan.name}.pdf`);
  };

  return (
    <div className="space-y-3 pb-4">
      {/* Header section with Stats */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-1">
          <div className="space-y-0.5">
            <h1 className="text-lg font-bold text-slate-800 tracking-tight">{t('treatmentPlan.title')}</h1>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.25em]">{t('treatmentPlan.subtitle')}</p>
          </div>
          
          <Button 
            onClick={() => { setEditPlan(null); setModalOpen(true); }} 
            className="h-9 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold flex items-center gap-1.5 shadow-md transition-all active:scale-95 border-none text-[10px] uppercase tracking-wider"
          >
            <Plus className="w-4.5 h-4.5 stroke-[2.5px]" />
            <span className="uppercase text-[10px] tracking-wider">{t('treatmentPlan.createNew')}</span>
          </Button>
        </div>

        {/* Premium Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 px-1">
          {[
            { label: t('treatmentPlan.stats.inProgress'), value: inProgressCount, icon: Activity, color: "text-amber-600", bg: "bg-amber-500/10", border: "border-amber-100" },
            { label: t('treatmentPlan.stats.planned'), value: scheduledCount, icon: Clock, color: "text-blue-600", bg: "bg-blue-500/10", border: "border-blue-100" },
            { label: t('treatmentPlan.stats.totalValue'), value: totalValue, icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-500/10", border: "border-emerald-100", isCurrency: true },
          ].map((s, i) => (
            <motion.div 
              key={s.label}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 4) * 0.02 }}
              className={`bg-white border ${s.border} rounded-xl p-4.5 shadow-sm relative group hover:shadow-md transition-all duration-350 content-visibility-auto`}
            >
              <div className="flex items-center gap-3.5">
                <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center shrink-0`}>
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                </div>
                <div className="min-w-0 flex-1">
                   <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate">{s.label}</p>
                   <p className={`text-lg font-black tracking-tight ${s.color} mt-0.5 leading-none`}>
                    {s.isCurrency ? `${(s.value/1000000).toFixed(1)}M` : s.value}
                    {s.isCurrency && <span className="text-[9px] ml-0.5 opacity-60 font-bold uppercase">uzs</span>}
                  </p>
                </div>
              </div>
              <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden mt-3.5">
                <motion.div 
                   initial={{ width: 0 }}
                   animate={{ width: s.isCurrency ? "100%" : `${(s.value / (inProgressCount + scheduledCount || 1)) * 100}%` }}
                   className={`h-full ${s.bg.replace('/10', '')} opacity-40`}
                />
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Toolbar & Search */}
      <div className="flex flex-col md:flex-row items-center gap-4 px-1">
        <div className="relative flex-1 w-full group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 group-focus-within:text-slate-700 transition-colors" />
          <Input 
            placeholder={t('treatmentPlan.searchPlaceholder')} 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            className="h-11 pl-10 pr-4 rounded-xl border border-slate-200 bg-white shadow-sm focus:ring-2 focus:ring-slate-900/5 text-sm font-semibold placeholder:font-normal placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Main List Area */}
      <div className="px-1">
        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-24 bg-white border border-slate-100 rounded-xl animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center shadow-sm">
            <EmptyState icon={ClipboardList} title={t('treatmentPlan.noPlansFound')} description={t('treatmentPlan.noPlansDescription')} />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Desktop Table View */}
            <div className="hidden lg:block bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto no-scrollbar">
                <table className="w-full text-left border-collapse table-fixed min-w-[900px]">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className="px-5 py-3.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-[32%] min-w-[240px]">{t('treatmentPlan.table.planDetails') || 'Reja ma\'lumotlari'}</th>
                      <th className="px-5 py-3.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-[15%] min-w-[140px]">{t('treatmentPlan.table.status') || 'Status'}</th>
                      <th className="px-5 py-3.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-[18%] min-w-[140px]">{t('treatmentPlan.table.teeth') || 'Tishlar'}</th>
                      <th className="px-5 py-3.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-[15%] min-w-[120px]">{t('treatmentPlan.table.value') || 'Qiymati'}</th>
                      <th className="px-5 py-3.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right w-[20%] min-w-[160px]">{t('treatmentPlan.table.actions') || 'Amallar'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.map((p) => {
                      const statusVal = normalizeStatus(p.status);
                      const statusClasses = statusVal === 'completed'
                        ? 'bg-emerald-50/70 text-emerald-700 border-emerald-100 hover:bg-emerald-50'
                        : statusVal === 'in_progress'
                          ? 'bg-amber-50/70 text-amber-700 border-amber-100 hover:bg-amber-50'
                          : 'bg-blue-50/70 text-blue-700 border-blue-100 hover:bg-blue-50';

                      return (
                        <tr key={p.id} className="hover:bg-slate-50/40 transition-colors group">
                          <td className="px-5 py-3 w-[32%] min-w-[240px]">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={`w-8.5 h-8.5 rounded-lg flex items-center justify-center shadow-sm transition-all shrink-0 ${
                                (p.status === 'Yakunlangan' || p.status === 'Completed') ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-900 group-hover:text-white'
                              }`}>
                                <Target className="w-4 h-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-bold text-slate-800 text-[13px] tracking-tight hover:text-slate-900 transition-colors truncate max-w-[180px] sm:max-w-[240px]" title={p.name}>{p.name}</p>
                                <p className="text-[10.5px] font-medium text-slate-500 mt-0.5 truncate max-w-[180px] sm:max-w-[240px]" title={p.patient_name}>{p.patient_name}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3 w-[15%] min-w-[140px]">
                            <Select 
                              value={statusVal} 
                              onValueChange={(val) => updatePlanStatus(p.id, val)}
                            >
                              <SelectTrigger className={`h-7 px-2.5 rounded-md border font-bold text-[9.5px] uppercase tracking-wider w-[125px] transition-colors focus:ring-0 ${statusClasses}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl border-slate-150">
                                <SelectItem value="planned" className="font-bold text-[9.5px] uppercase tracking-wider">{t('status.planned')}</SelectItem>
                                <SelectItem value="in_progress" className="font-bold text-[9.5px] uppercase tracking-wider">{t('status.in_progress')}</SelectItem>
                                <SelectItem value="completed" className="font-bold text-[9.5px] uppercase tracking-wider">{t('status.completed')}</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-5 py-3 w-[18%] min-w-[140px]">
                             <div className="flex flex-wrap gap-1 max-h-[48px] overflow-y-auto no-scrollbar">
                                {(p.tooth_number || "—").split(',').map((t, idx) => (
                                  <span key={idx} className="px-1.5 py-0.5 bg-slate-50 text-slate-650 border border-slate-100 rounded-md text-[9px] font-bold tracking-tight whitespace-nowrap">
                                    #{t.trim()}
                                  </span>
                                ))}
                             </div>
                          </td>
                          <td className="px-5 py-3 w-[15%] min-w-[120px]">
                            <p className="font-bold text-slate-800 text-[13.5px] tracking-tight whitespace-nowrap">
                              {p.total_price?.toLocaleString()}
                               <span className="text-[9px] ml-0.5 text-slate-400 uppercase font-medium">uzs</span>
                            </p>
                          </td>
                          <td className="px-5 py-3 text-right w-[20%] min-w-[160px]">
                            <div className="flex items-center justify-end gap-1">
                               <Button 
                                 size="icon" 
                                 variant="ghost" 
                                 onClick={() => { setEditPlan(p); setModalOpen(true); }}
                                 className="w-7.5 h-7.5 rounded-lg bg-slate-55 border border-slate-100 hover:bg-slate-900 hover:text-white transition-all shadow-sm active:scale-95"
                               >
                                 <Edit2 className="w-3 h-3" />
                               </Button>
                               <Button 
                                 size="icon" 
                                 variant="ghost" 
                                 onClick={() => { setSelectedPlanForInvoice(p); setInvoiceOpen(true); }}
                                 className="w-7.5 h-7.5 rounded-lg bg-slate-55 border border-slate-100 hover:bg-slate-900 hover:text-white transition-all shadow-sm active:scale-95"
                               >
                                 <FileDown className="w-3 h-3" />
                               </Button>
                               <Button 
                                 size="icon" 
                                 variant="ghost" 
                                 onClick={() => setDeletePlanId(p.id)}
                                 className="w-7.5 h-7.5 rounded-lg bg-slate-55 border border-slate-100 hover:bg-rose-500 hover:text-white transition-all shadow-sm active:scale-95"
                               >
                                 <Trash2 className="w-3.5 h-3.5" />
                               </Button>
                               <Button 
                                 size="icon" 
                                 variant="ghost" 
                                 onClick={() => navigate(`/patients/${p.patient_id}`)}
                                 className="w-7.5 h-7.5 rounded-lg bg-slate-55 border border-slate-100 hover:bg-blue-600 hover:text-white transition-all shadow-sm active:scale-95"
                               >
                                 <ChevronRight className="w-3.5 h-3.5" />
                               </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile/Tablet Card View */}
            <div className="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <AnimatePresence mode="popLayout">
                {filtered.map((p, index) => (
                  <motion.div 
                    key={p.id}
                    layout
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: Math.min(index, 6) * 0.02 }}
                    onClick={() => { setEditPlan(p); setModalOpen(true); }}
                    className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 group active:scale-[0.98] cursor-pointer content-visibility-auto"
                  >
                    <div className="p-4.5">
                      <div className="flex items-start justify-between mb-3.5">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm shrink-0 transition-all ${
                            (p.status === 'Yakunlangan' || p.status === 'Completed') ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-900 group-hover:text-white'
                          }`}>
                            <Activity className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-sm font-bold text-slate-800 tracking-tight truncate">{p.name}</h3>
                            <p className="text-[10.5px] font-medium text-slate-500 flex items-center gap-1 mt-0.5 truncate">
                              <Users className="w-3 h-3 text-slate-400" /> {p.patient_name}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="h-1.5 w-10 bg-slate-100 rounded-full overflow-hidden mb-1">
                             <div className={`h-full bg-blue-500`} style={{ width: p.status === 'Completed' ? '100%' : '30%' }} />
                          </div>
                          <p className="text-[8px] font-bold text-slate-450 uppercase tracking-wider text-right">Progress</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 mb-3.5 overflow-x-auto no-scrollbar">
                         <div className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider border ${
                            (p.status === 'Yakunlangan' || p.status === 'Completed') ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                            (p.status === 'Jarayonda' || p.status === 'In Progress' || p.status === 'InProgress') ? 'bg-amber-50 text-amber-700 border-amber-100' :
                            'bg-blue-50 text-blue-700 border-blue-100'
                          }`}>
                            {t('status.' + normalizeStatus(p.status))}
                         </div>
                         {(p.services || []).length > 0 && (
                            <div className="px-2 py-1 bg-slate-50 rounded-lg text-[9px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                               {(p.services || []).length} xizmat
                            </div>
                         )}
                      </div>

                      <div className="flex items-center justify-between py-3.5 border-t border-slate-100">
                        <div>
                           <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Jami qiymat</p>
                           <p className="text-lg font-bold text-slate-800 tracking-tight">
                            {p.total_price?.toLocaleString()}
                            <span className="text-[9px] ml-0.5 text-slate-400 uppercase font-medium">uzs</span>
                          </p>
                        </div>
                         <div className="flex gap-1.5">
                           <Button 
                             size="icon" 
                             variant="ghost" 
                             onClick={(e) => { e.stopPropagation(); setDeletePlanId(p.id); }}
                             className="w-8.5 h-8.5 rounded-xl bg-rose-50 text-rose-500 shadow-sm active:scale-90 hover:bg-rose-100"
                           >
                             <Trash2 className="w-4 h-4" />
                           </Button>
                           <Button size="icon" variant="ghost" className="w-8.5 h-8.5 rounded-xl bg-slate-900 text-white shadow-md active:scale-90 hover:bg-slate-800"><ChevronRight className="w-4 h-4" /></Button>
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

      <TreatmentPlanModal open={modalOpen} onClose={() => { setModalOpen(false); setEditPlan(null); }} plan={editPlan} patients={patients} services={services} onSaved={invalidatePlans} />
      <TreatmentPlanInvoice open={invoiceOpen} onClose={() => { setInvoiceOpen(false); setSelectedPlanForInvoice(null); }} plan={selectedPlanForInvoice} />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletePlanId} onOpenChange={() => setDeletePlanId(null)}>
        <AlertDialogContent className="rounded-2xl border-none shadow-3xl bg-white max-w-md p-6">
          <AlertDialogHeader>
            <div className="w-14 h-14 bg-rose-50 rounded-xl flex items-center justify-center text-rose-500 mb-3 mx-auto">
              <Trash2 className="w-7 h-7" />
            </div>
            <AlertDialogTitle className="text-xl font-bold text-slate-900 text-center uppercase tracking-tight">O'chirishni tasdiqlaysizmi?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500 text-center font-medium pt-1.5 text-sm">
              Ushbu davolash rejasi va unga bog'liq barcha qarzlar butunlay o'chiriladi. Bu amalni ortga qaytarib bo'lmaydi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 flex gap-3">
            <AlertDialogCancel className="h-11 rounded-xl border-slate-100 font-bold uppercase text-[10px] tracking-wider flex-1 m-0">Bekor qilish</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="h-11 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold uppercase text-[10px] tracking-wider flex-1 m-0 shadow-md shadow-rose-500/20">O'chirish</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
