import { useState, useEffect } from 'react';
import { useTranslation } from '@/i18n/LanguageContext';
import { base44 } from '@/api/base44Client';
import { 
  Activity, CheckCircle2, Clock, 
  Target, TrendingUp, Users, 
  ChevronRight, Calendar
} from 'lucide-react';
import EmptyState from '../components/ui/EmptyState';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function TreatmentTracking() {
  const { t } = useTranslation();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = async () => {
    try {
      const data = await base44.entities.TreatmentPlan.list('-created_date', 200);
      setPlans(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const updatePlanStatus = async (id, newStatus) => {
    try {
      const prev = plans.find(p => p.id === id)?.status;
      if (prev === newStatus) return;
      // Optimistic update
      setPlans(plans.map(p => p.id === id ? { ...p, status: newStatus } : p));
      await base44.entities.TreatmentPlan.update(id, { status: newStatus });
      // Reload from server just to be perfectly synced
      load();
    } catch (err) {
      console.error(err);
      load(); // Revert on error
    }
  };

  const total = plans.length;
  const completed = plans.filter(p => p.status === 'Yakunlangan' || p.status === 'Completed').length;
  const inProgress = plans.filter(p => p.status === 'Jarayonda' || p.status === 'In Progress').length;
  const planned = plans.filter(p => p.status === 'Rejalashtirilgan' || p.status === 'Planned').length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="space-y-4 pb-24 sm:pb-10 bg-slate-50/30 min-h-screen -m-4 p-4 sm:m-0 sm:p-0">
      {/* Premium Header */}
      <div className="px-1 sm:px-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">{t('treatmentTracking.title') || 'Davolash Kuzatuvi'}</h1>
            <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-wider">
              {t('treatmentTracking.subtitle') || 'Jarayonlar monitoringi va tahlili'}
            </p>
          </div>
        </div>
      </div>

      {/* Modern Dashboard Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 px-1 sm:px-0">
        {[
          { label: t('treatmentTracking.total') || "Jami", value: total, icon: Target, color: "text-slate-600", bg: "bg-slate-50", border: "border-slate-100" },
          { label: t('treatmentTracking.completed') || "Bajarildi", value: completed, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
          { label: t('treatmentTracking.inProgress') || "Jarayonda", value: inProgress, icon: Clock, color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-100" },
          { label: t('treatmentTracking.planned') || "Reja", value: planned, icon: Calendar, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100" },
        ].map((s, i) => (
          <motion.div 
            key={s.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: Math.min(i, 4) * 0.02 }}
            className="bg-white border border-slate-100 rounded-xl p-3.5 flex items-center gap-3 shadow-sm relative group overflow-hidden content-visibility-auto"
          >
            <div className={`w-9.5 h-9.5 rounded-lg ${s.bg} flex items-center justify-center shrink-0`}>
              <s.icon className={`w-4.5 h-4.5 ${s.color}`} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{s.label}</p>
              <p className={`text-lg font-black tracking-tight mt-0.5 ${s.color}`}>{s.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Enhanced Progress Panel */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl border border-slate-100 p-3.5 sm:p-4 shadow-sm relative overflow-hidden group mx-1 sm:mx-0"
      >
        <div className="absolute top-0 right-0 w-20 h-20 bg-blue-50/50 rounded-bl-full -z-10" />
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7.5 h-7.5 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow shadow-blue-500/20">
              <TrendingUp className="w-4 h-4" />
            </div>
            <h3 className="text-[11.5px] font-bold text-slate-850 uppercase tracking-wider">{t('treatmentTracking.efficiency') || 'Umumiy samaradorlik'}</h3>
          </div>
          <span className="text-lg font-black text-blue-600 tracking-tight">{progress}%</span>
        </div>
        <div className="relative h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full"
          />
        </div>
        <div className="mt-2.5 flex items-center justify-between text-[9px] font-bold text-slate-400 uppercase tracking-wider px-1">
          <span>{t('treatmentTracking.start') || 'Boshlanish'}</span>
          <span>{t('treatmentTracking.towardsGoal') || 'Maqsad sari'}</span>
          <span>{t('treatmentTracking.completion') || 'Yakun'}</span>
        </div>
      </motion.div>

      {/* Treatment List */}
      <div className="space-y-3 px-1 sm:px-0">
        <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">{t('treatmentTracking.activeTasks') || 'Jarayondagi ishlar'}</h3>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-16 bg-white border border-slate-100 rounded-xl animate-pulse" />)}
          </div>
        ) : plans.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center shadow-sm">
            <EmptyState icon={Activity} title={t('treatmentTracking.empty') || "Rejalar mavjud emas"} description={t('treatmentTracking.emptyDesc') || "Hozircha kuzatuv ostida hech qanday reja yo'q"} />
          </div>
        ) : (
          <div className="space-y-3.5">
            {/* Desktop Table View */}
            <div className="hidden sm:block bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto no-scrollbar">
                <table className="w-full text-left border-collapse table-fixed min-w-[850px]">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-[28%] min-w-[200px]">{t('treatmentTracking.table.planName') || 'Reja nomi / Bemor'}</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-[24%] min-w-[170px]">{t('treatmentTracking.table.execution') || 'Reja ijrosi'}</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-[14%] min-w-[100px]">{t('treatmentTracking.table.price') || 'Qiymati'}</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-[18%] min-w-[130px]">{t('treatmentTracking.table.status') || 'Status'}</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right w-[16%] min-w-[130px]">{t('treatmentTracking.table.actions') || 'Amallar'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {plans.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/40 transition-colors group">
                        <td className="px-4 py-2.5 w-[28%] min-w-[200px]">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`w-8.5 h-8.5 rounded-lg flex items-center justify-center border shrink-0 ${p.status === 'Yakunlangan' || p.status === 'Completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-450 border-slate-100 group-hover:bg-blue-50 group-hover:text-blue-500'}`}>
                              <Target className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-slate-800 text-[13px] truncate" title={p.name}>{p.name}</p>
                              <p className="text-[10.5px] font-semibold text-blue-605 mt-0.5 truncate flex items-center gap-1 leading-none">
                                <Users className="w-3 h-3 text-blue-500 shrink-0" /> {p.patient_name}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 w-[24%] min-w-[170px]">
                          <div className="flex justify-between items-center text-[10px] font-semibold text-slate-500 mb-1">
                            <span>{t('treatmentTracking.table.progressStatus') || 'Ijro holati'}</span>
                            <span className="text-blue-600 font-bold">
                              {(p.services || []).filter(s => s.completed).length} / {(p.services || []).length}
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-100">
                            <div 
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${(p.services || []).length > 0 ? ((p.services || []).filter(s => s.completed).length / (p.services || []).length) * 100 : 0}%` }}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-2.5 w-[14%] min-w-[100px]">
                          <p className="font-bold text-slate-800 text-[13px] tracking-tight whitespace-nowrap">
                            {p.total_price ? `${(p.total_price/1000).toLocaleString()}K` : '0'}
                            <span className="text-[9px] ml-0.5 opacity-50 uppercase font-medium">uzs</span>
                          </p>
                        </td>
                        <td className="px-4 py-2.5 w-[18%] min-w-[130px]">
                          <Select 
                            value={p.status === 'Completed' ? 'Yakunlangan' : p.status === 'In Progress' ? 'Jarayonda' : p.status === 'Planned' ? 'Rejalashtirilgan' : p.status} 
                            onValueChange={(val) => updatePlanStatus(p.id, val)}
                          >
                            <SelectTrigger 
                              className={`h-7 px-2.5 py-0 rounded-lg text-[9.5px] font-bold uppercase tracking-wider border outline-none w-[130px] transition-colors focus:ring-0 ${
                                p.status === 'Yakunlangan' || p.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                p.status === 'Jarayonda' || p.status === 'In Progress' ? 'bg-orange-55 text-orange-700 border-orange-100/70' :
                                'bg-blue-55 text-blue-700 border-blue-100/70'
                              }`}
                            >
                              <span className="w-full text-center"><SelectValue /></span>
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-slate-100">
                              <SelectItem value="Rejalashtirilgan" className="text-[9.5px] font-bold uppercase tracking-wider text-blue-700">{t('status.Planned') || t('status.planned') || 'Rejalashtirilgan'}</SelectItem>
                              <SelectItem value="Jarayonda" className="text-[9.5px] font-bold uppercase tracking-wider text-orange-700">{t('status.InProgress') || t('status.in_progress') || 'Jarayonda'}</SelectItem>
                              <SelectItem value="Yakunlangan" className="text-[9.5px] font-bold uppercase tracking-wider text-emerald-700">{t('status.Completed') || t('status.completed') || 'Yakunlangan'}</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-4 py-2.5 text-right w-[16%] min-w-[130px]">
                          <button 
                            onClick={() => navigate(`/patients/${p.patient_id}`)}
                            className="inline-flex h-7 px-2.5 rounded-lg bg-slate-50 hover:bg-slate-900 border border-slate-100 hover:text-white items-center justify-center gap-1.5 transition-all text-[9.5px] font-bold uppercase tracking-wider shrink-0 cursor-pointer"
                          >
                            <span>{t('treatmentTracking.table.goToProfile') || "Profilga o'tish"}</span>
                            <ChevronRight className="w-3 h-3 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile View - Sleek Cards */}
            <div className="sm:hidden space-y-3">
              <AnimatePresence mode="popLayout">
                {plans.map((p, index) => (
                  <motion.div 
                    key={p.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: Math.min(index, 6) * 0.02 }}
                    className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 group content-visibility-auto"
                  >
                    <div className="p-3.5">
                      <div className="flex items-start justify-between mb-3 gap-2">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center border shrink-0 ${p.status === 'Yakunlangan' || p.status === 'Completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                            <Target className="w-4.5 h-4.5" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-sm font-bold text-slate-800 tracking-tight truncate max-w-[150px] leading-none">{p.name}</h3>
                            <p className="text-[10.5px] font-semibold text-blue-600 flex items-center gap-1 mt-1 leading-none">
                              <Users className="w-3 h-3 text-blue-500" /> {p.patient_name}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-0.5 leading-none">{t('treatmentTracking.table.price') || 'Qiymati'}</p>
                          <p className="text-sm font-bold text-slate-800 tracking-tight leading-none mt-0.5">
                            {p.total_price ? `${(p.total_price/1000).toLocaleString()}K` : '0'}
                            <span className="text-[8px] ml-0.5 opacity-60">UZS</span>
                          </p>
                        </div>
                      </div>

                      {/* Granular Progress Indicator */}
                      <div className="mb-3.5 space-y-1">
                        <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          <span>{t('treatmentTracking.table.progressStatus') || 'Ijro holati'}</span>
                          <span className="text-blue-600 font-bold">
                            {(p.services || []).filter(s => s.completed).length} / {(p.services || []).length}
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-100">
                          <div 
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${(p.services || []).length > 0 ? ((p.services || []).filter(s => s.completed).length / (p.services || []).length) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
  
                      <div className="flex justify-between items-center pt-2.5 border-t border-slate-50">
                        <Select 
                          value={p.status === 'Completed' ? 'Yakunlangan' : p.status === 'In Progress' ? 'Jarayonda' : p.status === 'Planned' ? 'Rejalashtirilgan' : p.status} 
                          onValueChange={(val) => updatePlanStatus(p.id, val)}
                        >
                          <SelectTrigger 
                            className={`h-7 px-2.5 py-0 rounded-lg text-[9px] font-bold uppercase tracking-wider border outline-none w-[120px] ${
                              p.status === 'Yakunlangan' || p.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-150' :
                              p.status === 'Jarayonda' || p.status === 'In Progress' ? 'bg-orange-55 text-orange-700 border-orange-150' :
                              'bg-blue-55 text-blue-700 border-blue-150'
                            }`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-slate-100">
                            <SelectItem value="Rejalashtirilgan" className="text-[10px] font-bold">{t('status.Planned') || t('status.planned') || 'Rejalashtirilgan'}</SelectItem>
                            <SelectItem value="Jarayonda" className="text-[10px] font-bold">{t('status.InProgress') || t('status.in_progress') || 'Jarayonda'}</SelectItem>
                            <SelectItem value="Yakunlangan" className="text-[10px] font-bold">{t('status.Completed') || t('status.completed') || 'Yakunlangan'}</SelectItem>
                          </SelectContent>
                        </Select>

                        <button 
                          onClick={() => navigate(`/patients/${p.patient_id}`)}
                          className="h-7 px-3 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-100 flex items-center justify-center gap-1 text-[9.5px] font-bold uppercase tracking-wider text-slate-600 transition-all border-none cursor-pointer"
                        >
                          <span>{t('treatmentTracking.table.profile') || 'Profil'}</span>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
