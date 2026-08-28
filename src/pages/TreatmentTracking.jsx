import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from '@/i18n/LanguageContext';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { 
  CheckCircle2, Clock, 
  Target, TrendingUp, Search,
  Table as TableIcon, LayoutGrid, FileSpreadsheet, X,
  ArrowUp, ArrowDown, ArrowUpDown, User, Layers, Check, ExternalLink
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

/**
 * TreatmentTracking Page - Professional Excel Spreadsheet View
 */
export default function TreatmentTracking() {
  const { t } = useTranslation();
  const { user, isDoctor } = useAuth();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeStatusFilter, setActiveStatusFilter] = useState('all'); // all, in_progress, planned, completed
  const navigate = useNavigate();

  // Density switcher with localStorage
  const [density, setDensity] = useState(() => {
    return localStorage.getItem('myclinic_tracking_density') || 'compact';
  });
  const toggleDensity = (val) => {
    setDensity(val);
    localStorage.setItem('myclinic_tracking_density', val);
  };

  // Sorting state
  const [sortField, setSortField] = useState('progress');
  const [sortOrder, setSortOrder] = useState('desc');

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Detail Modal state
  const [selectedDetailPlanId, setSelectedDetailPlanId] = useState(null);

  const load = useCallback(async () => {
    try {
      let data;
      if (isDoctor && user?.id) {
        data = await base44.entities.TreatmentPlan.filter({ doctor_id: user.id }, '-created_date', 200).catch(async () => {
          const allPlans = await base44.entities.TreatmentPlan.list('-created_date', 200);
          return (allPlans || []).filter(p =>
            String(p.doctor_id) === String(user.id) ||
            String(p.doctor_name || '').toLowerCase() === String(user.name || '').toLowerCase()
          );
        });
      } else {
        data = await base44.entities.TreatmentPlan.list('-created_date', 200);
      }
      setPlans(data || []);
    } catch (err) {
      console.error(err);
      toast.error("Ma'lumotlarni yuklashda xatolik");
    } finally {
      setLoading(false);
    }
  }, [isDoctor, user?.id, user?.name]);

  useEffect(() => { load(); }, [load]);

  const normalizeStatus = (status) => {
    const s = String(status || '').toLowerCase();
    if (s.includes('complete') || s.includes('yakun') || s.includes('bajar')) return 'completed';
    if (s.includes('progress') || s.includes('jarayon')) return 'in_progress';
    if (s.includes('plan') || s.includes('reja')) return 'planned';
    return 'planned';
  };

  const updatePlanStatus = async (id, newStatus) => {
    try {
      const prev = plans.find(p => p.id === id)?.status;
      if (prev === newStatus) return;

      // Optimistic update
      setPlans(prevPlans => prevPlans.map(p => p.id === id ? { ...p, status: newStatus } : p));
      await base44.entities.TreatmentPlan.update(id, { status: newStatus });
      toast.success("Reja holati yangilandi!");
      load();
    } catch (err) {
      console.error(err);
      toast.error("Holatni o'zgartirishda xatolik");
      load();
    }
  };

  // Toggle single service completed in active plan
  const handleToggleService = async (serviceIndex) => {
    const currentPlan = plans.find(p => String(p.id) === String(selectedDetailPlanId));
    if (!currentPlan) return;

    const currentServices = Array.isArray(currentPlan.services) ? [...currentPlan.services] : [];
    if (!currentServices[serviceIndex]) return;

    const current = currentServices[serviceIndex];
    const newCompleted = !current.completed;
    currentServices[serviceIndex] = {
      ...current,
      completed: newCompleted,
      completed_at: newCompleted ? new Date().toISOString() : null
    };

    const allCompleted = currentServices.length > 0 && currentServices.every(s => s.completed);
    const someCompleted = currentServices.some(s => s.completed);
    const newPlanStatus = allCompleted ? 'Yakunlangan' : (someCompleted ? 'Jarayonda' : 'Rejalashtirilgan');

    // Optimistic state update
    setPlans(prev => prev.map(p => String(p.id) === String(currentPlan.id) ? {
      ...p,
      services: currentServices,
      status: newPlanStatus
    } : p));

    try {
      await base44.entities.TreatmentPlan.update(currentPlan.id, {
        services: currentServices,
        status: newPlanStatus
      });
      toast.success(newCompleted ? "Xizmat bajarildi deb belgilandi!" : "Xizmat holati bekor qilindi");
      load();
    } catch (err) {
      console.error(err);
      toast.error("Xizmat holatini yangilashda xatolik");
      load();
    }
  };

  const total = plans.length;
  const completed = plans.filter(p => normalizeStatus(p.status) === 'completed').length;
  const inProgress = plans.filter(p => normalizeStatus(p.status) === 'in_progress').length;
  const planned = plans.filter(p => normalizeStatus(p.status) === 'planned').length;
  const overallEfficiency = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Filtered plans
  const filteredPlans = useMemo(() => {
    return plans.filter(p => {
      const st = normalizeStatus(p.status);
      if (activeStatusFilter !== 'all' && st !== activeStatusFilter) {
        return false;
      }

      const q = search.toLowerCase();
      if (!q) return true;

      const planName = (p.name || '').toLowerCase();
      const patientName = (p.patient_name || '').toLowerCase();
      const docName = (p.doctor_name || '').toLowerCase();
      const teeth = (p.tooth_number || '').toLowerCase();

      return planName.includes(q) || patientName.includes(q) || docName.includes(q) || teeth.includes(q);
    });
  }, [plans, activeStatusFilter, search]);

  // Sorted plans
  const sortedPlans = useMemo(() => {
    const list = [...filteredPlans];
    list.sort((a, b) => {
      let valA, valB;
      const srvA = a.services || [];
      const srvB = b.services || [];
      const doneA = srvA.filter(s => s.completed).length;
      const doneB = srvB.filter(s => s.completed).length;
      const pctA = srvA.length > 0 ? (doneA / srvA.length) * 100 : 0;
      const pctB = srvB.length > 0 ? (doneB / srvB.length) * 100 : 0;

      switch (sortField) {
        case 'patient':
          valA = (a.patient_name || '').toLowerCase();
          valB = (b.patient_name || '').toLowerCase();
          return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        case 'name':
          valA = (a.name || '').toLowerCase();
          valB = (b.name || '').toLowerCase();
          return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        case 'price':
          valA = Number(a.total_price || 0);
          valB = Number(b.total_price || 0);
          return sortOrder === 'asc' ? valA - valB : valB - valA;
        case 'status':
          valA = normalizeStatus(a.status);
          valB = normalizeStatus(b.status);
          return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        case 'progress':
        default:
          return sortOrder === 'asc' ? pctA - pctB : pctB - pctA;
      }
    });
    return list;
  }, [filteredPlans, sortField, sortOrder]);

  const activeDetailPlan = useMemo(() => {
    if (!selectedDetailPlanId) return null;
    return plans.find(p => String(p.id) === String(selectedDetailPlanId)) || null;
  }, [selectedDetailPlanId, plans]);

  // Totals calculations
  const totalValue = useMemo(() => {
    return plans.reduce((s, p) => s + (Number(p.total_price) || 0), 0);
  }, [plans]);

  const filteredTotalValue = useMemo(() => {
    return sortedPlans.reduce((s, p) => s + (Number(p.total_price) || 0), 0);
  }, [sortedPlans]);

  const totalServicesCount = useMemo(() => {
    return plans.reduce((sum, p) => sum + (p.services || []).length, 0);
  }, [plans]);

  const totalCompletedServicesCount = useMemo(() => {
    return plans.reduce((sum, p) => sum + (p.services || []).filter(s => s.completed).length, 0);
  }, [plans]);

  /**
   * Export to CSV with UTF-8 BOM
   */
  const exportCSV = useCallback(() => {
    try {
      if (!sortedPlans || sortedPlans.length === 0) {
        toast.warning("Eksport qilish uchun ma'lumot topilmadi");
        return;
      }
      const headers = [
        "№",
        "Bemor (F.I.Sh)",
        "Reja Nomi",
        "Shifokor",
        "Tishlar",
        "Jami Xizmatlar",
        "Bajarilgan Xizmatlar",
        "Ijro Foizi (%)",
        "Jami Qiymati (UZS)",
        "Holat"
      ];
      const rows = sortedPlans.map((p, idx) => {
        const st = normalizeStatus(p.status);
        const statusText = st === 'completed' ? 'Yakunlangan' : st === 'in_progress' ? 'Jarayonda' : 'Rejalashtirilgan';
        const srv = p.services || [];
        const done = srv.filter(s => s.completed).length;
        const pct = srv.length > 0 ? Math.round((done / srv.length) * 100) : 0;

        return [
          idx + 1,
          `"${(p.patient_name || '').replace(/"/g, '""')}"`,
          `"${(p.name || '').replace(/"/g, '""')}"`,
          `"${(p.doctor_name || '').replace(/"/g, '""')}"`,
          `"${(p.tooth_number || '').replace(/"/g, '""')}"`,
          srv.length,
          done,
          `${pct}%`,
          Number(p.total_price || 0),
          `"${statusText}"`
        ].join(",");
      });

      const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `Davolash_Kuzatuvi_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Davolash kuzatuvi Excel (.csv) formatida yuklab olindi!");
    } catch (err) {
      console.error(err);
      toast.error("Eksportda xatolik yuz berdi");
    }
  }, [sortedPlans]);

  return (
    <div className="space-y-3.5 pb-4">
      {/* ─── Excel Header Bar ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900 tracking-tight">{t('treatmentTracking.title') || "Davolash Kuzatuvi"}</h1>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
              • Ijro Monitoringi & Jarayonlar {plans.length} Rejalar
            </span>
          </div>
          <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
            Muolajalar ijrosi monitoringi, xizmatlar bajarilishi va klinik samaradorlik tahlili
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={exportCSV} 
            className="gap-1.5 rounded-xl border-slate-200 hover:bg-slate-50 font-black text-xs text-slate-700 h-9.5 px-3.5"
            title="Excel formatida (.csv) yuklab olish"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Eksport (Excel)</span>
          </Button>
        </div>
      </div>

      {/* ─── Top Executive KPI Grid ─────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: "JAMI REJALAR", value: total, icon: Target, color: "text-slate-700", bg: "bg-slate-50 border-slate-200", countText: "Barcha kuzatilayotgan rejalar", isNumber: true },
          { label: "JARAYONDA", value: inProgress, icon: Clock, color: "text-amber-600", bg: "bg-amber-50 border-amber-100", countText: "Ayni paytda qilinayotgan", isNumber: true },
          { label: "REJALASHTIRILGAN", value: planned, icon: Layers, color: "text-blue-600", bg: "bg-blue-50 border-blue-100", countText: "Kutilayotgan navbatlar", isNumber: true },
          { label: "YAKUNLANGAN", value: completed, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100", countText: "To'liq bajarilgan rejalar", isNumber: true },
          { label: "SAMARADORLIK", value: overallEfficiency, icon: TrendingUp, color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-100", countText: "Klinik muvaffaqiyat ko'rsatkichi", isNumber: false, isPercent: true },
        ].map((s, i) => (
          <motion.div 
            key={s.label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.03 }}
            className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-xs flex items-center justify-between relative overflow-hidden"
          >
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">
                {s.label}
              </span>
              <div className="text-lg sm:text-xl font-black font-mono tracking-tight text-slate-900 tabular-nums">
                {s.isPercent ? (
                  <span>{s.value}%</span>
                ) : (
                  <span>{s.value} <span className="text-xs font-bold text-slate-400">ta</span></span>
                )}
              </div>
              <p className="text-[9.5px] font-medium text-slate-400 mt-0.5">{s.countText}</p>
            </div>

            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-xs shrink-0 ${s.bg}`}>
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
          </motion.div>
        ))}
      </div>

      {/* ─── Excel Spreadsheet Controls Bar ────────────────────────── */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          
          {/* Search Box */}
          <div className="relative flex-1 group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#1499AD] transition-colors" />
            <input 
              type="text" 
              placeholder="Bemor ismi, reja nomi yoki shifokor bo'yicha qidiruv..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-8 bg-slate-50 hover:bg-white focus:bg-white rounded-xl border border-slate-200 focus:border-[#1499AD] font-semibold text-slate-800 text-xs focus:ring-2 focus:ring-[#1499AD]/10 transition-all outline-none"
            />
            {search && (
              <button 
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
            {[
              { id: 'all', label: "Barchasi", count: total },
              { id: 'in_progress', label: "Jarayonda", count: inProgress },
              { id: 'planned', label: "Rejalashtirilgan", count: planned },
              { id: 'completed', label: "Yakunlangan", count: completed },
            ].map(tab => {
              const isActive = activeStatusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveStatusFilter(tab.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer",
                    isActive 
                      ? "bg-slate-900 text-white shadow-xs font-black" 
                      : "bg-slate-100/70 text-slate-600 hover:bg-slate-200/60 hover:text-slate-900"
                  )}
                >
                  <span>{tab.label}</span>
                  <span className={cn(
                    "px-1.5 py-0.2 rounded-full text-[9px] font-black",
                    isActive ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"
                  )}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Density Switcher */}
          <div className="hidden sm:flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/70 shrink-0">
            <button
              onClick={() => toggleDensity('compact')}
              title="Ixcham Excel Jadvali"
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10.5px] font-black transition-all ${
                density === 'compact' 
                  ? 'bg-white text-slate-900 shadow-xs' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5 text-[#1499AD]" />
              <span>Excel</span>
            </button>
            <button
              onClick={() => toggleDensity('comfortable')}
              title="Keng Jadval Ko'rinishi"
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10.5px] font-black transition-all ${
                density === 'comfortable' 
                  ? 'bg-white text-slate-900 shadow-xs' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5 text-slate-500" />
              <span>Keng</span>
            </button>
          </div>

        </div>
      </div>

      {/* ─── Main Excel Spreadsheet Data Grid Table ──────────────────── */}
      {/* Columns: № | BEMOR (F.I.SH) | REJA NOMI | TISHLAR | IJRO HOLATI / PROGRESS | QIYMATI | STATUS | AMALLAR */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden relative"
      >
        {loading && (
          <div className="absolute inset-x-0 top-0 h-0.5 bg-slate-100 overflow-hidden z-20">
            <motion.div 
              className="h-full bg-gradient-to-r from-[#1499AD] to-[#0E7A8A]"
              animate={{ x: ['-100%', '100%'] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            />
          </div>
        )}
        
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left select-text">
            {/* ─── Excel Table Header ────────────────── */}
            <thead>
              <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-600 text-[10.5px] font-black uppercase tracking-wider sticky top-0 z-10 backdrop-blur-xs">
                
                {/* № Col */}
                <th className="w-12 px-2.5 py-2.5 text-center border-r border-slate-200 select-none font-mono">
                  №
                </th>

                {/* BEMOR (F.I.SH) */}
                <th 
                  onClick={() => handleSort('patient')}
                  className="px-3.5 py-2.5 border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors select-none min-w-[200px]"
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span>Bemor (F.I.Sh)</span>
                    {sortField === 'patient' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#1499AD]" /> : <ArrowDown className="w-3 h-3 text-[#1499AD]" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-30" />
                    )}
                  </div>
                </th>

                {/* REJA NOMI */}
                <th 
                  onClick={() => handleSort('name')}
                  className="px-3.5 py-2.5 border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors select-none min-w-[200px]"
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span>Reja Nomi / Shifokor</span>
                    {sortField === 'name' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#1499AD]" /> : <ArrowDown className="w-3 h-3 text-[#1499AD]" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-30" />
                    )}
                  </div>
                </th>

                {/* TISHLAR */}
                <th className="w-28 px-2.5 py-2.5 text-center border-r border-slate-200 select-none whitespace-nowrap">
                  Tishlar
                </th>

                {/* IJRO HOLATI / PROGRESS */}
                <th 
                  onClick={() => handleSort('progress')}
                  className="w-56 px-3.5 py-2.5 border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors select-none whitespace-nowrap bg-blue-50/30"
                  title="Ijro foizi bo'yicha saralash"
                >
                  <div className="flex items-center justify-between gap-1.5 text-blue-900 font-mono">
                    <span>Ijro Holati (Progress)</span>
                    {sortField === 'progress' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>

                {/* JAMI QIYMAT */}
                <th 
                  onClick={() => handleSort('price')}
                  className="w-40 px-3.5 py-2.5 text-right border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors bg-emerald-50/40 select-none whitespace-nowrap"
                  title="Jami qiymat bo'yicha saralash"
                >
                  <div className="flex items-center justify-end gap-1.5 text-emerald-700 font-mono">
                    <span>Qiymati</span>
                    {sortField === 'price' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-emerald-600" /> : <ArrowDown className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>

                {/* STATUS */}
                <th 
                  onClick={() => handleSort('status')}
                  className="w-40 px-3 py-2.5 text-center border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors select-none whitespace-nowrap"
                >
                  <div className="flex items-center justify-center gap-1.5 text-slate-700">
                    <span>Holat</span>
                    {sortField === 'status' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-30" />
                    )}
                  </div>
                </th>

                {/* Actions */}
                <th className="w-36 px-2 py-2.5 text-center text-slate-500 whitespace-nowrap select-none">
                  {t('common.actions') || "Amallar"}
                </th>

              </tr>
            </thead>

            {/* ─── Excel Table Body ────────────────── */}
            <tbody className="divide-y divide-slate-200/70 text-xs">
              {sortedPlans.length > 0 ? (
                sortedPlans.map((p, idx) => {
                  const isCompact = density === 'compact';
                  const st = normalizeStatus(p.status);
                  const teethList = (p.tooth_number || '').split(',').map(t => t.trim()).filter(Boolean);
                  
                  const srv = p.services || [];
                  const doneSrv = srv.filter(s => s.completed).length;
                  const totalSrv = srv.length;
                  const pct = totalSrv > 0 ? Math.round((doneSrv / totalSrv) * 100) : 0;

                  return (
                    <tr 
                      key={p.id} 
                      className={`group hover:bg-[#1499AD]/10 hover:shadow-xs transition-colors cursor-pointer ${
                        idx % 2 === 1 ? 'bg-slate-50/30' : 'bg-white'
                      }`}
                      onClick={() => setSelectedDetailPlanId(p.id)}
                    >
                      {/* № Cell */}
                      <td className={`text-center font-mono font-bold text-slate-400 border-r border-slate-200/70 whitespace-nowrap ${isCompact ? 'py-2 px-2' : 'py-3 px-2.5'}`}>
                        {idx + 1}
                      </td>

                      {/* BEMOR (F.I.SH) Cell */}
                      <td className={`border-r border-slate-200/70 ${isCompact ? 'py-1.5 px-3' : 'py-2.5 px-3.5'}`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6.5 h-6.5 rounded-lg bg-blue-50 text-blue-700 font-black text-[10px] flex items-center justify-center border border-blue-100 shrink-0">
                            <User className="w-3.5 h-3.5 text-blue-600" />
                          </div>
                          <div className="min-w-0">
                            <span 
                              onClick={(e) => {
                                if (p.patient_id) {
                                  e.stopPropagation();
                                  navigate(`/patients/${p.patient_id}`);
                                }
                              }}
                              className="font-extrabold text-slate-900 hover:text-blue-600 transition-colors truncate block hover:underline"
                            >
                              {p.patient_name || 'Noma\'lum bemor'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* REJA NOMI Cell */}
                      <td className={`border-r border-slate-200/70 ${isCompact ? 'py-1.5 px-3' : 'py-2.5 px-3.5'}`}>
                        <div className="min-w-0">
                          <span className="font-bold text-slate-800 group-hover:text-[#1499AD] transition-colors truncate block">
                            {p.name}
                          </span>
                          {p.doctor_name && (
                            <span className="text-[10px] font-medium text-slate-400 block truncate">
                              Shifokor: {p.doctor_name}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* TISHLAR Cell */}
                      <td className={`text-center border-r border-slate-200/70 whitespace-nowrap ${isCompact ? 'py-1.5 px-2' : 'py-2.5 px-2.5'}`}>
                        {teethList.length > 0 ? (
                          <div className="flex items-center justify-center gap-1 flex-wrap max-w-[120px] mx-auto">
                            {teethList.map((tooth, tIdx) => (
                              <span key={tIdx} className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                #{tooth}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-300 font-mono">—</span>
                        )}
                      </td>

                      {/* IJRO HOLATI / PROGRESS Cell */}
                      <td className={`border-r border-slate-200/70 bg-blue-50/20 ${isCompact ? 'py-1.5 px-3' : 'py-2.5 px-3.5'}`}>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10.5px] font-mono">
                            <span className="font-bold text-slate-700">
                              {doneSrv} / {totalSrv} xizmat
                            </span>
                            <span className="font-black text-blue-700">
                              {pct}%
                            </span>
                          </div>
                          <div className="h-2 w-full bg-slate-200/80 rounded-full overflow-hidden">
                            <div 
                              className={cn(
                                "h-full rounded-full transition-all duration-500",
                                pct === 100 ? "bg-emerald-500" : pct > 0 ? "bg-blue-600" : "bg-slate-300"
                              )}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* JAMI QIYMAT Cell */}
                      <td className={`text-right border-r border-slate-200/70 whitespace-nowrap bg-emerald-50/30 ${isCompact ? 'py-1.5 px-2.5' : 'py-2.5 px-3'}`}>
                        <span className="font-mono font-black text-emerald-600 text-xs tabular-nums">
                          {Number(p.total_price || 0).toLocaleString()}
                          <span className="text-[9.5px] font-semibold text-emerald-500 ml-1">UZS</span>
                        </span>
                      </td>

                      {/* STATUS Cell */}
                      <td className={`text-center border-r border-slate-200/70 whitespace-nowrap ${isCompact ? 'py-1 px-2' : 'py-2 px-2.5'}`} onClick={(e) => e.stopPropagation()}>
                        <Select 
                          value={st} 
                          onValueChange={(val) => updatePlanStatus(p.id, val)}
                        >
                          <SelectTrigger className={cn(
                            "h-7 px-2 rounded-lg font-bold text-[10px] uppercase tracking-wider mx-auto border transition-colors focus:ring-0",
                            st === 'completed'
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : st === 'in_progress'
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-blue-50 text-blue-700 border-blue-200"
                          )}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl font-bold text-xs">
                            <SelectItem value="planned">Rejalashtirilgan</SelectItem>
                            <SelectItem value="in_progress">Jarayonda</SelectItem>
                            <SelectItem value="completed">Yakunlangan</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>

                      {/* Actions Cell */}
                      <td className={`text-center whitespace-nowrap ${isCompact ? 'py-1 px-1.5' : 'py-2 px-2'}`} onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedDetailPlanId(p.id)}
                            className="h-7 px-2.5 rounded-lg border-slate-200 text-slate-700 hover:text-[#1499AD] hover:bg-[#1499AD]/10 text-[10.5px] font-bold gap-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                            <span>Ijro Nazorati</span>
                          </Button>

                          {p.patient_id && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => navigate(`/patients/${p.patient_id}`)}
                              className="w-7 h-7 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                              title="Bemor Profiliga o'tish"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>

                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300">
                        <Target className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-bold text-slate-500">
                        {search ? `"${search}" bo'yicha davolash rejasi topilmadi` : "Kuzatuv ostida davolash rejalari mavjud emas"}
                      </p>
                      {(search || activeStatusFilter !== 'all') && (
                        <button
                          onClick={() => { setSearch(''); setActiveStatusFilter('all'); }}
                          className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
                        >
                          Filtrlarni tozalash
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ─── Excel Formula Summary Footer Bar ──────────────────── */}
        <div className="bg-slate-100/90 border-t border-slate-200/90 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 text-slate-600 font-bold">
            <span className="flex items-center gap-1.5">
              <TableIcon className="w-3.5 h-3.5 text-[#1499AD]" />
              <span>Jadvalda:</span>
              <strong className="text-slate-900 font-mono">{sortedPlans.length}</strong> ta reja
            </span>
            <span className="text-slate-300">•</span>
            <span>
              Bajarilgan xizmatlar: <strong className="text-emerald-700 font-mono">{totalCompletedServicesCount} / {totalServicesCount} ta</strong>
            </span>
            <span className="text-slate-300">•</span>
            <span>
              Umumiy Samaradorlik: <strong className="text-indigo-700 font-mono">{overallEfficiency}%</strong>
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-black uppercase text-slate-500">Σ Tanlangan Rejalar Qiymati:</span>
              <span className="font-mono font-bold text-slate-800 text-sm">
                {filteredTotalValue.toLocaleString()} <span className="text-[10px] text-slate-500">UZS</span>
              </span>
            </div>

            <div className="flex items-center gap-1.5 border-l border-slate-300 pl-3">
              <span className="text-[11px] font-black uppercase text-slate-500">Σ Umumiy Qiymat:</span>
              <span className="font-mono font-black text-emerald-600 text-sm">
                {totalValue.toLocaleString()} <span className="text-[10px] text-slate-500">UZS</span>
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ─── Interactive Treatment Execution Checklist Modal ────────── */}
      <Dialog open={!!activeDetailPlan} onOpenChange={(open) => { if (!open) setSelectedDetailPlanId(null); }}>
        <DialogContent className="sm:max-w-2xl rounded-2xl p-5 max-h-[90vh] overflow-y-auto">
          {activeDetailPlan && (
            <div className="space-y-4">
              <DialogHeader>
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-black text-sm shadow-xs">
                      <Target className="w-5 h-5" />
                    </div>
                    <div>
                      <DialogTitle className="text-base font-black text-slate-900 leading-tight">
                        {activeDetailPlan.name}
                      </DialogTitle>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-blue-600" />
                          {activeDetailPlan.patient_name || 'Bemor'}
                        </span>
                        {activeDetailPlan.doctor_name && (
                          <>
                            <span className="text-slate-300">•</span>
                            <span className="text-[11px] font-bold text-slate-400">
                              Dr. {activeDetailPlan.doctor_name}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] font-black uppercase text-slate-400 block">Jami Qiymati:</span>
                    <span className="text-sm font-black font-mono text-emerald-700">
                      {Number(activeDetailPlan.total_price || 0).toLocaleString()} UZS
                    </span>
                  </div>
                </div>
              </DialogHeader>

              {/* Status & Progress Bar */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-700">Reja holati:</span>
                    <Select 
                      value={normalizeStatus(activeDetailPlan.status)} 
                      onValueChange={(val) => updatePlanStatus(activeDetailPlan.id, val)}
                    >
                      <SelectTrigger className="h-7.5 px-3 rounded-lg font-bold text-xs bg-white border-slate-300">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl font-bold text-xs">
                        <SelectItem value="planned">Rejalashtirilgan</SelectItem>
                        <SelectItem value="in_progress">Jarayonda</SelectItem>
                        <SelectItem value="completed">Yakunlangan</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {activeDetailPlan.tooth_number && (
                    <div className="text-xs font-bold text-slate-600">
                      Tishlar: <span className="font-mono text-blue-600">#{activeDetailPlan.tooth_number}</span>
                    </div>
                  )}
                </div>

                {/* Progress bar of completed services */}
                {Array.isArray(activeDetailPlan.services) && activeDetailPlan.services.length > 0 && (
                  <div>
                    {(() => {
                      const totalSrv = activeDetailPlan.services.length;
                      const doneSrv = activeDetailPlan.services.filter(s => s.completed).length;
                      const pct = Math.round((doneSrv / totalSrv) * 100);
                      return (
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] font-bold">
                            <span className="text-slate-600">
                              Ijro: <strong className="text-slate-900">{doneSrv} / {totalSrv} ta xizmat bajarildi</strong>
                            </span>
                            <span className="text-emerald-700 font-mono font-black">{pct}%</span>
                          </div>
                          <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                              style={{ width: `${pct}%` }} 
                            />
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Services Checklist Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <div className="bg-slate-100/90 px-3.5 py-2 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase text-slate-700">
                    Rejadagi Muolajalar Ijrosi ({Array.isArray(activeDetailPlan.services) ? activeDetailPlan.services.length : 0})
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">
                    Bajarilgan xizmatlarni belgilang (Checkmark)
                  </span>
                </div>

                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead className="sticky top-0 bg-slate-50 z-10">
                      <tr className="border-b border-slate-200 text-slate-500 text-[10px] font-bold uppercase">
                        <th className="w-10 px-2.5 py-2 text-center border-r border-slate-200">№</th>
                        <th className="w-10 px-2 py-2 text-center border-r border-slate-200">Holat</th>
                        <th className="px-3 py-2 border-r border-slate-200">Xizmat Nomi</th>
                        <th className="w-20 px-2 py-2 text-center border-r border-slate-200">Tish</th>
                        <th className="px-3 py-2 text-right">Narxi (UZS)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/70 font-mono">
                      {Array.isArray(activeDetailPlan.services) && activeDetailPlan.services.length > 0 ? (
                        activeDetailPlan.services.map((srv, sIdx) => {
                          const isDone = !!srv.completed;
                          return (
                            <tr 
                              key={sIdx} 
                              onClick={() => handleToggleService(sIdx)}
                              className={`cursor-pointer transition-colors ${
                                isDone ? 'bg-emerald-50/50 hover:bg-emerald-100/60' : 'hover:bg-slate-50'
                              }`}
                            >
                              <td className="px-2.5 py-2 text-center text-slate-400 border-r border-slate-200/70">{sIdx + 1}</td>
                              
                              {/* Interactive Checkbox */}
                              <td className="px-2 py-2 text-center border-r border-slate-200/70" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() => handleToggleService(sIdx)}
                                  className={`w-5 h-5 rounded-md flex items-center justify-center transition-all cursor-pointer ${
                                    isDone 
                                      ? 'bg-emerald-600 text-white shadow-xs' 
                                      : 'border-2 border-slate-300 hover:border-emerald-500 bg-white'
                                  }`}
                                  title={isDone ? "Bajarildi (Bekor qilish)" : "Bajarildi deb belgilash"}
                                >
                                  {isDone && <Check className="w-3.5 h-3.5 stroke-[3px]" />}
                                </button>
                              </td>

                              {/* Service Name */}
                              <td className="px-3 py-2 font-sans font-bold text-slate-900 border-r border-slate-200/70">
                                <div className="flex items-center gap-2">
                                  <span className={isDone ? 'line-through text-slate-400 font-normal' : ''}>
                                    {srv.service_name || srv.name || 'Muolaja xizmati'}
                                  </span>
                                  {isDone && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-emerald-100 text-emerald-800 shrink-0">
                                      Bajarildi
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Tooth Number */}
                              <td className="px-2 py-2 text-center border-r border-slate-200/70 text-slate-700">
                                {srv.tooth_number ? (
                                  <span className="px-1.5 py-0.2 rounded bg-slate-100 font-bold text-[10px]">
                                    #{srv.tooth_number}
                                  </span>
                                ) : (
                                  activeDetailPlan.tooth_number ? (
                                    <span className="px-1.5 py-0.2 rounded bg-slate-100 font-bold text-[10px]">
                                      #{activeDetailPlan.tooth_number}
                                    </span>
                                  ) : '—'
                                )}
                              </td>

                              {/* Price */}
                              <td className="px-3 py-2 text-right font-bold text-slate-800">
                                {Number(srv.price || 0).toLocaleString()} UZS
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-slate-400 font-sans">
                            Rejaga xizmatlar kiritilmagan
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bottom Actions Footer */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                {activeDetailPlan.patient_id ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDetailPlanId(null);
                      navigate(`/patients/${activeDetailPlan.patient_id}`);
                    }}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                  >
                    <span>Bemor profiliga o'tish</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                ) : <div />}

                <Button
                  onClick={() => setSelectedDetailPlanId(null)}
                  className="h-9 px-5 rounded-xl bg-slate-900 text-white text-xs font-black"
                >
                  Yopish
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
