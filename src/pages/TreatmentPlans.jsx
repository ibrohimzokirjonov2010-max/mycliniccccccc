import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/lib/queryKeys';
import { 
  Plus, Search, ClipboardList, FileDown, 
  Edit2, Clock, 
  TrendingUp, Trash2, Table as TableIcon, LayoutGrid, FileSpreadsheet, X,
  ArrowUp, ArrowDown, ArrowUpDown, CheckCircle2, FileText, User,
  Check, Layers, ExternalLink, Printer
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import TreatmentPlanModal from '../components/treatments/TreatmentPlanModal';
import TreatmentPlanInvoice from '../components/treatments/TreatmentPlanInvoice';
import jsPDF from 'jspdf';
import { motion } from 'framer-motion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { useTranslation } from '@/i18n/LanguageContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';

/**
 * TreatmentPlans Page - Professional Excel Spreadsheet View with Interactive Detail Modal
 */
export default function TreatmentPlans() {
  const navigate = useNavigate();
  const { t, language } = useTranslation();
  const { user, isDoctor } = useAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [activeStatusFilter, setActiveStatusFilter] = useState('all'); // 'all' | 'planned' | 'in_progress' | 'completed'

  // Density switcher with localStorage
  const [density, setDensity] = useState(() => {
    return localStorage.getItem('myclinic_treatment_plans_density') || 'compact';
  });
  const toggleDensity = (val) => {
    setDensity(val);
    localStorage.setItem('myclinic_treatment_plans_density', val);
  };

  // Sorting state
  const [sortField, setSortField] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [editPlan, setEditPlan] = useState(null);
  const [selectedPlanForInvoice, setSelectedPlanForInvoice] = useState(null);
  const [deletePlanId, setDeletePlanId] = useState(null);
  const [statusConfirm, setStatusConfirm] = useState(null);

  // Detail Modal Plan ID (dynamic reference)
  const [selectedDetailPlanId, setSelectedDetailPlanId] = useState(null);

  // ── React Query: Treatment plans ──────────────────────────────────────────
  const { data: rawPlans = [], isFetching: plansFetching } = useQuery({
    queryKey: ['treatmentPlans', isDoctor, user?.id],
    queryFn: async () => {
      if (isDoctor && user?.id) {
        const docPlans = await base44.entities.TreatmentPlan.filter({ doctor_id: user.id }, '-created_date', 100).catch(() => []);
        return docPlans || [];
      }
      return await base44.entities.TreatmentPlan.list('-created_date', 100);
    },
    staleTime: 3 * 60 * 1000,
  });

  const plans = rawPlans;
  const loading = plansFetching && rawPlans.length === 0;

  // ── React Query: Patients ─────────────────────────────────────────────────
  const { data: patients = [] } = useQuery({
    queryKey: QUERY_KEYS.patients,
    queryFn: () => base44.entities.Patient.list('full_name', 200),
    staleTime: 5 * 60 * 1000,
  });

  // ── React Query: Services ─────────────────────────────────────────────────
  const { data: rawServices = [] } = useQuery({
    queryKey: QUERY_KEYS.services,
    queryFn: () => base44.entities.Service.list('name', 500),
    staleTime: 10 * 60 * 1000,
  });

  // De-duplicate services
  const services = useMemo(() => {
    const seen = new Map();
    (rawServices || []).forEach(s => {
      const key = s.name?.toLowerCase().trim();
      if (key && !seen.has(key)) seen.set(key, s);
    });
    return Array.from(seen.values());
  }, [rawServices]);

  const invalidatePlans = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['treatmentPlans'] });
  }, [queryClient]);

  const handleDelete = async () => {
    if (!deletePlanId) return;
    try {
      const linkedContext = `Linked to Plan: ${deletePlanId}`;
      const existingPayments = await base44.entities.Payment.filter({
        notes: linkedContext
      });
      
      await Promise.all(existingPayments.map(pay => base44.entities.Payment.delete(pay.id)));
      await base44.entities.TreatmentPlan.delete(deletePlanId);
      
      toast.success(t('common.success') || "Davolash rejasi o'chirildi!");
      setDeletePlanId(null);
      if (selectedDetailPlanId === deletePlanId) {
        setSelectedDetailPlanId(null);
      }
      invalidatePlans();
    } catch (err) {
      console.error(err);
      toast.error(t('common.error') || "Xatolik yuz berdi");
    }
  };

  const updatePlanStatus = async (id, newStatus) => {
    try {
      const prev = plans.find(p => p.id === id)?.status;
      if (prev === newStatus) return;

      queryClient.setQueryData(['treatmentPlans', isDoctor, user?.id], (old) => {
        return (old || []).map(p => p.id === id ? { ...p, status: newStatus } : p);
      });

      await base44.entities.TreatmentPlan.update(id, { status: newStatus });
      toast.success("Reja holati muvaffaqiyatli yangilandi!");
      invalidatePlans();
    } catch (err) {
      console.error(err);
      toast.error("Holatni o'zgartirishda xatolik");
      invalidatePlans();
    }
  };

  // Normalize status for filtering & display
  const normalizeStatus = (status) => {
    const s = String(status || '').toLowerCase();
    if (s.includes('complete') || s.includes('yakun') || s.includes('bajar')) return 'completed';
    if (s.includes('progress') || s.includes('jarayon')) return 'in_progress';
    if (s.includes('plan') || s.includes('reja')) return 'planned';
    return 'planned';
  };

  const getStatusBadgeInfo = (st) => {
    switch (st) {
      case 'completed':
        return {
          label: language === 'ru' ? 'Завершено' : language === 'en' ? 'Completed' : 'Yakunlangan',
          className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          dotColor: 'bg-emerald-500',
        };
      case 'in_progress':
        return {
          label: language === 'ru' ? 'В процессе' : language === 'en' ? 'In Progress' : 'Jarayonda',
          className: 'bg-amber-50 text-amber-700 border-amber-200',
          dotColor: 'bg-amber-500',
        };
      case 'planned':
      default:
        return {
          label: language === 'ru' ? 'Запланировано' : language === 'en' ? 'Planned' : 'Rejalashtirilgan',
          className: 'bg-blue-50 text-blue-700 border-blue-200',
          dotColor: 'bg-blue-500',
        };
    }
  };

  const handleRequestStatusChange = (plan, targetStatus) => {
    const currentStatus = normalizeStatus(plan.status);
    if (currentStatus === targetStatus) return;

    setStatusConfirm({
      id: plan.id,
      planName: plan.name || 'Davolash rejasi',
      patientName: plan.patient_name || 'Bemor',
      fromStatus: currentStatus,
      toStatus: targetStatus,
    });
  };

  const handleConfirmStatusChange = async () => {
    if (!statusConfirm) return;
    const { id, toStatus } = statusConfirm;
    setStatusConfirm(null);
    await updatePlanStatus(id, toStatus);
  };

  // Status counts
  const statusCounts = useMemo(() => {
    const counts = { all: plans.length, planned: 0, in_progress: 0, completed: 0 };
    plans.forEach(p => {
      const st = normalizeStatus(p.status);
      if (counts[st] !== undefined) counts[st] += 1;
    });
    return counts;
  }, [plans]);

  // Filtered Treatment Plans
  const filteredPlans = useMemo(() => {
    return plans.filter(p => {
      if (isDoctor && String(p.doctor_id) !== String(user?.id) && (p.doctor_name || '').toLowerCase() !== (user?.name || '').toLowerCase()) {
        return false;
      }
      
      const st = normalizeStatus(p.status);
      if (activeStatusFilter !== 'all' && st !== activeStatusFilter) {
        return false;
      }

      const q = search.toLowerCase();
      if (!q) return true;

      const planName = (p.name || '').toLowerCase();
      const patientName = (p.patient_name || '').toLowerCase();
      const teeth = (p.tooth_number || '').toLowerCase();
      const docName = (p.doctor_name || '').toLowerCase();

      return planName.includes(q) || patientName.includes(q) || teeth.includes(q) || docName.includes(q);
    });
  }, [plans, isDoctor, user, activeStatusFilter, search]);

  // Sorted Treatment Plans
  const sortedPlans = useMemo(() => {
    const list = [...filteredPlans];
    list.sort((a, b) => {
      let valA, valB;
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
        case 'services':
          valA = (a.services || []).length;
          valB = (b.services || []).length;
          return sortOrder === 'asc' ? valA - valB : valB - valA;
        case 'status':
          valA = normalizeStatus(a.status);
          valB = normalizeStatus(b.status);
          return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        case 'date':
        default:
          valA = new Date(a.created_date || a.created_at || 0).getTime();
          valB = new Date(b.created_date || b.created_at || 0).getTime();
          return sortOrder === 'asc' ? valA - valB : valB - valA;
      }
    });
    return list;
  }, [filteredPlans, sortField, sortOrder]);

  // Dynamic reference to selected plan in Detail Modal
  const activeDetailPlan = useMemo(() => {
    if (!selectedDetailPlanId) return null;
    return plans.find(p => String(p.id) === String(selectedDetailPlanId)) || null;
  }, [selectedDetailPlanId, plans]);

  // Toggle individual service completion inside activeDetailPlan
  const handleToggleService = async (serviceIndex) => {
    if (!activeDetailPlan) return;
    const currentServices = Array.isArray(activeDetailPlan.services) ? [...activeDetailPlan.services] : [];
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

    // Optimistic cache update
    queryClient.setQueryData(['treatmentPlans', isDoctor, user?.id], (old) => {
      return (old || []).map(p => String(p.id) === String(activeDetailPlan.id) ? {
        ...p,
        services: currentServices,
        status: newPlanStatus
      } : p);
    });

    try {
      await base44.entities.TreatmentPlan.update(activeDetailPlan.id, {
        services: currentServices,
        status: newPlanStatus
      });
      invalidatePlans();

      if (allCompleted) {
        toast.success(language === 'ru' 
          ? "Все услуги выполнены! Статус плана автоматически переведён в «Завершено»." 
          : "Barcha xizmatlar bajarildi! Reja holati avtomatik «Yakunlangan»ga o'tdi.");
      } else if (newCompleted) {
        toast.success(language === 'ru' ? "Услуга выполнена!" : "Xizmat bajarildi deb belgilandi!");
      } else {
        toast.info(language === 'ru' ? "Отметка выполнения услуги снята" : "Xizmat bajarilish belgisi bekor qilindi");
      }
    } catch (err) {
      console.error(err);
      toast.error(language === 'ru' ? "Ошибка обновления услуги" : "Xizmat holatini yangilashda xatolik");
      invalidatePlans();
    }
  };

  // Stats calculation
  const totalValue = useMemo(() => {
    return plans.reduce((s, p) => s + (Number(p.total_price) || 0), 0);
  }, [plans]);

  const filteredTotalValue = useMemo(() => {
    return sortedPlans.reduce((s, p) => s + (Number(p.total_price) || 0), 0);
  }, [sortedPlans]);

  // PDF Export
  const generatePDF = (plan) => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text("DAVOLASH REJASI", 105, 20, { align: 'center' });
    doc.setFontSize(11);
    doc.text(`Bemor: ${plan.patient_name || '—'}`, 20, 40);
    doc.text(`Reja nomi: ${plan.name || '—'}`, 20, 48);
    doc.text(`Holati: ${normalizeStatus(plan.status) === 'completed' ? 'Yakunlangan' : normalizeStatus(plan.status) === 'in_progress' ? 'Jarayonda' : 'Rejalashtirilgan'}`, 20, 56);
    doc.text(`Tishlar: ${plan.tooth_number || '—'}`, 20, 64);
    doc.text(`Sana: ${new Date().toLocaleDateString('uz-UZ')}`, 20, 72);

    let y = 88;
    doc.setFontSize(13);
    doc.text("BELGILANGAN XIZMATLAR:", 20, y);
    y += 8;
    doc.setFontSize(10);
    (plan.services || []).forEach((s, i) => {
      const isDone = s.completed ? '[BAJARILDI] ' : '';
      doc.text(`${i + 1}. ${isDone}${s.service_name || s.name || 'Xizmat'}`, 25, y);
      doc.text(`${Number(s.price || 0).toLocaleString()} UZS`, 150, y);
      y += 7;
    });

    y += 8;
    doc.line(20, y, 190, y);
    y += 10;
    doc.setFontSize(13);
    doc.text(`JAMI SUMMA: ${Number(plan.total_price || 0).toLocaleString()} UZS`, 20, y);

    doc.save(`Reja-${(plan.name || 'plan').replace(/\s+/g, '_')}.pdf`);
    toast.success("PDF yuklab olindi!");
  };

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
        "Xizmatlar Soni",
        "Jami Qiymati (UZS)",
        "Holat",
        "Yaratilgan Sana"
      ];
      const rows = sortedPlans.map((p, idx) => {
        const st = normalizeStatus(p.status);
        const statusText = st === 'completed' ? 'Yakunlangan' : st === 'in_progress' ? 'Jarayonda' : 'Rejalashtirilgan';
        const dateStr = p.created_date ? new Date(p.created_date).toLocaleDateString('uz-UZ') : '—';

        return [
          idx + 1,
          `"${(p.patient_name || '').replace(/"/g, '""')}"`,
          `"${(p.name || '').replace(/"/g, '""')}"`,
          `"${(p.doctor_name || '').replace(/"/g, '""')}"`,
          `"${(p.tooth_number || '').replace(/"/g, '""')}"`,
          (p.services || []).length,
          Number(p.total_price || 0),
          `"${statusText}"`,
          `"${dateStr}"`
        ].join(",");
      });

      const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `Davolash_Rejalari_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Davolash rejalari Excel (.csv) formatida yuklab olindi!");
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
            <h1 className="text-xl font-black text-slate-900 tracking-tight">{t('treatmentPlan.title') || "Davolash rejalari"}</h1>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
              {language === 'ru' ? `• ПЛАНЫ ЛЕЧЕНИЯ: ${plans.length} ПЛАНОВ` : language === 'en' ? `• TREATMENT PLANS: ${plans.length} PLANS` : `• DAVOLASH REJALARI: ${plans.length} TA REJA`}
            </span>
          </div>
          <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
            {t('treatmentPlan.subtitle') || (language === 'ru' ? 'Сформированные планы лечения пациентов, этапы процедур и расчеты' : 'Bemorlar uchun shakllantirilgan davolash rejalari, muolaja bosqichlari va hisob-kitoblari')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          

          <Button 
            onClick={() => { setEditPlan(null); setModalOpen(true); }} 
            className="bg-[#00D084] hover:bg-[#00B875] text-white gap-1.5 border-none rounded-xl h-9.5 px-4 font-black text-xs shadow-md shadow-[#00D084]/20 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>{t('treatmentPlan.createNew') || "Yangi reja yaratish"}</span>
          </Button>
        </div>
      </div>

      {/* ─── Top Executive KPI Grid ─────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { 
            label: language === 'ru' ? "В ПРОЦЕССЕ" : language === 'en' ? "IN PROGRESS" : "JARAYONDA", 
            value: statusCounts.in_progress, 
            icon: Clock, 
            color: "text-amber-600", 
            bg: "bg-amber-50 border-amber-100", 
            isNumber: true, 
            countText: language === 'ru' ? "Планы на исполнении" : language === 'en' ? "Plans in progress" : "Bajarilayotgan rejalar" 
          },
          { 
            label: language === 'ru' ? "ЗАПЛАНИРОВАНО" : language === 'en' ? "PLANNED" : "REJALASHTIRILGAN", 
            value: statusCounts.planned, 
            icon: ClipboardList, 
            color: "text-blue-600", 
            bg: "bg-blue-50 border-blue-100", 
            isNumber: true, 
            countText: language === 'ru' ? "Очередные планы" : language === 'en' ? "Upcoming plans" : "Navbatdagi rejalar" 
          },
          { 
            label: language === 'ru' ? "ЗАВЕРШЕНО" : language === 'en' ? "COMPLETED" : "YAKUNLANGAN", 
            value: statusCounts.completed, 
            icon: CheckCircle2, 
            color: "text-emerald-600", 
            bg: "bg-emerald-50 border-emerald-100", 
            isNumber: true, 
            countText: language === 'ru' ? "Успешно завершенные" : language === 'en' ? "Successfully completed" : "Muvaffaqiyatli yakunlangan" 
          },
          { 
            label: language === 'ru' ? "ОБЩАЯ СТОИМОСТЬ ПЛАНОВ" : language === 'en' ? "TOTAL PLANS VALUE" : "JAMI REJALAR QIYMATI", 
            value: totalValue, 
            icon: TrendingUp, 
            color: "text-purple-600", 
            bg: "bg-purple-50 border-purple-100", 
            isNumber: false, 
            countText: language === 'ru' ? "Ожидаемые поступления в клинику" : language === 'en' ? "Expected clinic revenue" : "Klinikaga kutilayotgan tushum" 
          },
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
                {s.isNumber ? (
                  <span>{s.value} <span className="text-xs font-bold text-slate-400">{language === 'ru' ? '' : 'ta'}</span></span>
                ) : (
                  <span>{Number(s.value).toLocaleString()} <span className="text-[10px] font-bold text-slate-400">UZS</span></span>
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
              placeholder={t('treatmentPlan.searchPlaceholder') || (language === 'ru' ? "Поиск по имени пациента, названию плана или номеру зуба..." : "Bemor ismi, reja nomi yoki tish raqami bo'yicha qidiruv...")}
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

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
            {[
              { id: 'all', label: language === 'ru' ? "Все" : language === 'en' ? "All" : "Barchasi", count: statusCounts.all },
              { id: 'in_progress', label: language === 'ru' ? "В процессе" : language === 'en' ? "In Progress" : "Jarayonda", count: statusCounts.in_progress },
              { id: 'planned', label: language === 'ru' ? "Запланировано" : language === 'en' ? "Planned" : "Rejalashtirilgan", count: statusCounts.planned },
              { id: 'completed', label: language === 'ru' ? "Завершено" : language === 'en' ? "Completed" : "Yakunlangan", count: statusCounts.completed },
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

        </div>
      </div>

      {/* ─── Main Excel Spreadsheet Data Grid Table ──────────────────── */}
      {/* Columns: № | BEMOR (F.I.SH) | REJA NOMI | TISHLAR | XIZMATLAR | JAMI QIYMATI | STATUS | AMALLAR */}
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
                    <span>{t('treatmentPlan.patientCol') || (language === 'ru' ? 'Пациент (Ф.И.О)' : 'Bemor (F.I.Sh)')}</span>
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
                    <span>{t('treatmentPlan.planNameCol') || (language === 'ru' ? 'Название плана / Описание' : 'Reja Nomi / Tavsif')}</span>
                    {sortField === 'name' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#1499AD]" /> : <ArrowDown className="w-3 h-3 text-[#1499AD]" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-30" />
                    )}
                  </div>
                </th>

                {/* TISHLAR */}
                <th className="w-32 px-3 py-2.5 text-center border-r border-slate-200 select-none whitespace-nowrap">
                  {t('treatmentPlan.teethCol') || (language === 'ru' ? 'Зубы' : 'Tishlar')}
                </th>

                {/* XIZMATLAR */}
                <th 
                  onClick={() => handleSort('services')}
                  className="w-28 px-3 py-2.5 text-center border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors select-none whitespace-nowrap bg-blue-50/30"
                  title="Xizmatlar soni bo'yicha saralash"
                >
                  <div className="flex items-center justify-center gap-1.5 text-blue-800 font-mono">
                    <span>{t('treatmentPlan.servicesCol') || (language === 'ru' ? 'Услуги' : 'Xizmatlar')}</span>
                    {sortField === 'services' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>

                {/* JAMI QIYMAT */}
                <th 
                  onClick={() => handleSort('price')}
                  className="w-44 px-3.5 py-2.5 text-right border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors bg-emerald-50/40 select-none whitespace-nowrap"
                  title="Jami qiymat bo'yicha saralash"
                >
                  <div className="flex items-center justify-end gap-1.5 text-emerald-700 font-mono">
                    <span>{t('treatmentPlan.totalPriceCol') || (language === 'ru' ? 'Общая стоимость' : 'Jami Qiymat')}</span>
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
                    <span>{t('treatmentPlan.statusCol') || (language === 'ru' ? 'Статус' : 'Holat')}</span>
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
                            {language === 'ru' ? (p.name || '').replace(/Davolash rejasi/gi, 'План лечения') : (language === 'en' ? (p.name || '').replace(/Davolash rejasi/gi, 'Treatment plan') : p.name)}
                          </span>
                          {p.doctor_name && (
                            <span className="text-[10px] font-medium text-slate-400 block truncate">
                              {language === 'ru' ? 'Врач: ' : 'Shifokor: '}{p.doctor_name}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* TISHLAR Cell */}
                      <td className={`text-center border-r border-slate-200/70 whitespace-nowrap ${isCompact ? 'py-1.5 px-2' : 'py-2.5 px-2.5'}`}>
                        {teethList.length > 0 ? (
                          <div className="flex items-center justify-center gap-1 flex-wrap max-w-[140px] mx-auto">
                            {teethList.map((tooth, tIdx) => (
                              <span key={tIdx} className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                #{tooth}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold text-slate-400 bg-slate-100/70 border border-slate-200/60">
                            {language === 'ru' ? 'Общий' : language === 'en' ? 'General' : 'Umumiy'}
                          </span>
                        )}
                      </td>

                      {/* XIZMATLAR SONI Cell */}
                      <td className={`text-center border-r border-slate-200/70 whitespace-nowrap bg-blue-50/20 ${isCompact ? 'py-1.5 px-2' : 'py-2.5 px-2.5'}`}>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-bold text-blue-900 bg-blue-100/70 border border-blue-200/60">
                          {(p.services || []).length} {language === 'ru' ? 'услуг' : 'ta xizmat'}
                        </span>
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
                          onValueChange={(val) => handleRequestStatusChange(p, val)}
                        >
                          <SelectTrigger className={cn(
                            "h-7 px-2 rounded-lg font-bold text-[10px] uppercase tracking-wider mx-auto border transition-colors focus:ring-0 cursor-pointer",
                            st === 'completed'
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : st === 'in_progress'
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-blue-50 text-blue-700 border-blue-200"
                          )}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl font-bold text-xs">
                            <SelectItem value="planned">{language === 'ru' ? 'Запланировано' : 'Rejalashtirilgan'}</SelectItem>
                            <SelectItem value="in_progress">{language === 'ru' ? 'В процессе' : 'Jarayonda'}</SelectItem>
                            <SelectItem value="completed">{language === 'ru' ? 'Завершено' : 'Yakunlangan'}</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>

                      {/* Actions Cell */}
                      <td className={`text-center whitespace-nowrap ${isCompact ? 'py-1 px-1.5' : 'py-2 px-2'}`}>
                        <div className="flex items-center justify-center gap-1" onClick={(ev) => ev.stopPropagation()}>
                          <button 
                            onClick={() => { setEditPlan(p); setModalOpen(true); }}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-[#1499AD] hover:bg-[#1499AD]/10 transition-all cursor-pointer"
                            title={language === 'ru' ? 'Редактировать план' : 'Rejani tahrirlash'}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button 
                            onClick={() => { setSelectedPlanForInvoice(p); setInvoiceOpen(true); }}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition-all cursor-pointer"
                            title="Kvitansiya / Hisob-faktura"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>

                          <button 
                            onClick={() => generatePDF(p)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-all cursor-pointer"
                            title="PDF yuklab olish"
                          >
                            <FileDown className="w-3.5 h-3.5" />
                          </button>

                          <button 
                            onClick={() => setDeletePlanId(p.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                            title="O'chirish"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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
                        <ClipboardList className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-bold text-slate-500">
                        {search ? `"${search}" bo'yicha davolash rejasi topilmadi` : "Davolash rejalari mavjud emas"}
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
      </motion.div>

      {/* ─── Interactive Treatment Plan Detail & Execution Modal ─────── */}
      <Dialog open={!!activeDetailPlan} onOpenChange={(open) => { if (!open) setSelectedDetailPlanId(null); }}>
        <DialogContent className="sm:max-w-2xl rounded-2xl p-5 max-h-[90vh] overflow-y-auto">
          {activeDetailPlan && (
            <div className="space-y-4">
              <DialogHeader>
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#1499AD] text-white flex items-center justify-center font-black text-sm shadow-xs">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div>
                      <DialogTitle className="text-base font-black text-slate-900 leading-tight">
                        {language === 'ru' ? (activeDetailPlan.name || '').replace(/Davolash rejasi/gi, 'План лечения') : (language === 'en' ? (activeDetailPlan.name || '').replace(/Davolash rejasi/gi, 'Treatment plan') : activeDetailPlan.name)}
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

                  <div className="flex items-center gap-1.5">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => generatePDF(activeDetailPlan)}
                      className="h-8 px-2.5 rounded-xl border-slate-200 text-xs font-bold gap-1 text-slate-700"
                    >
                      <Printer className="w-3.5 h-3.5 text-slate-600" />
                      <span>{language === 'ru' ? 'Печать' : 'Chop etish'}</span>
                    </Button>

                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => {
                        setSelectedPlanForInvoice(activeDetailPlan);
                        setInvoiceOpen(true);
                      }}
                      className="h-8 px-2.5 rounded-xl border-slate-200 text-xs font-bold gap-1 text-slate-700"
                    >
                      <FileText className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{language === 'ru' ? 'Квитанция' : 'Kvitansiya'}</span>
                    </Button>
                  </div>
                </div>
              </DialogHeader>

              {/* Status & Progress Bar Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                        {language === 'ru' ? 'СТАТУС ПЛАНА:' : 'Reja Holati:'}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[9.5px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" />
                        {language === 'ru' ? 'Авто-синхронизация' : 'Avto-sinxron'}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <Select 
                        value={normalizeStatus(activeDetailPlan.status)} 
                        onValueChange={(val) => handleRequestStatusChange(activeDetailPlan, val)}
                      >
                        <SelectTrigger className="h-8 px-3 rounded-xl font-bold text-xs bg-white border-slate-300 shadow-xs cursor-pointer">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl font-bold text-xs">
                          <SelectItem value="planned">{language === 'ru' ? 'Запланировано' : 'Rejalashtirilgan'}</SelectItem>
                          <SelectItem value="in_progress">{language === 'ru' ? 'В процессе' : 'Jarayonda'}</SelectItem>
                          <SelectItem value="completed">{language === 'ru' ? 'Завершено' : 'Yakunlangan'}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="text-left sm:text-right">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                      {language === 'ru' ? 'ОБЩАЯ СТОИМОСТЬ:' : 'Jami Qiymati:'}
                    </span>
                    <span className="text-base font-black font-mono text-emerald-700">
                      {Number(activeDetailPlan.total_price || 0).toLocaleString()} UZS
                    </span>
                  </div>
                </div>

                {/* Progress bar of completed services */}
                {Array.isArray(activeDetailPlan.services) && activeDetailPlan.services.length > 0 && (
                  <div>
                    {(() => {
                      const totalSrv = activeDetailPlan.services.length;
                      const doneSrv = activeDetailPlan.services.filter(s => s.completed).length;
                      const pct = Math.round((doneSrv / totalSrv) * 100);
                      return (
                        <div className="space-y-1.5 pt-1">
                          <div className="flex items-center justify-between text-[11px] font-bold">
                            <span className="text-slate-600 flex items-center gap-1.5">
                              <span>{language === 'ru' ? 'Выполнение:' : 'Bajarilish:'}</span>
                              <strong className="text-slate-900 font-mono">{doneSrv} / {totalSrv} {language === 'ru' ? 'услуг' : 'ta xizmat'}</strong>
                            </span>
                            <span className={cn(
                              "font-mono font-black px-2 py-0.5 rounded-lg text-xs",
                              pct === 100 ? "bg-emerald-100 text-emerald-800" : (pct > 0 ? "bg-amber-100 text-amber-800" : "bg-slate-200 text-slate-700")
                            )}>
                              {pct}%
                            </span>
                          </div>
                          <div className="w-full h-2.5 bg-slate-200/80 rounded-full overflow-hidden p-0.5">
                            <div 
                              className={cn(
                                "h-full rounded-full transition-all duration-500",
                                pct === 100 ? "bg-emerald-500" : (pct > 0 ? "bg-amber-500" : "bg-slate-300")
                              )} 
                              style={{ width: `${pct}%` }} 
                            />
                          </div>

                          {/* Dynamic Auto-Status explanation note */}
                          <div className="pt-0.5">
                            {pct === 100 ? (
                              <p className="text-[10px] font-bold text-emerald-700 bg-emerald-50/80 px-2.5 py-1 rounded-lg border border-emerald-200 flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                                <span>{language === 'ru' ? 'Все услуги выполнены — план автоматически получил статус «Завершено»' : 'Barcha xizmatlar bajarildi — reja avtomatik «Yakunlangan» holatiga o\'tkazildi'}</span>
                              </p>
                            ) : pct > 0 ? (
                              <p className="text-[10px] font-bold text-amber-700 bg-amber-50/80 px-2.5 py-1 rounded-lg border border-amber-200 flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                                <span>{language === 'ru' ? 'План в процессе — при отметке всех услуг статус автоматически станет «Завершено»' : 'Reja jarayonda — barcha xizmatlar belgilanganda avtomatik «Yakunlangan»ga o\'tadi'}</span>
                              </p>
                            ) : (
                              <p className="text-[10px] font-semibold text-slate-400 px-1 flex items-center gap-1">
                                <span>ℹ️ {language === 'ru' ? 'Отмечайте выполненные услуги ниже — статус плана синхронизируется автоматически' : 'Quyidagi xizmatlarni bajarganingiz sari reja holati avtomatik sinxronlashadi'}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Services Checklist / Execution Excel Grid */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <div className="bg-slate-100/90 px-3.5 py-2 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase text-slate-700">
                    {language === 'ru' ? 'УСЛУГИ И ПРОЦЕДУРЫ В ПЛАНЕ' : 'Rejadagi Xizmatlar & Muolajalar'} ({Array.isArray(activeDetailPlan.services) ? activeDetailPlan.services.length : 0})
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">
                    {language === 'ru' ? 'Отметьте выполненные услуги' : 'Bajarilgan xizmatlarni belgilang (Checkmark)'}
                  </span>
                </div>

                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead className="sticky top-0 bg-slate-50 z-10">
                      <tr className="border-b border-slate-200 text-slate-500 text-[10px] font-bold uppercase">
                        <th className="w-10 px-2.5 py-2 text-center border-r border-slate-200">№</th>
                        <th className="w-10 px-2 py-2 text-center border-r border-slate-200">{language === 'ru' ? 'Статус' : 'Holat'}</th>
                        <th className="px-3 py-2 border-r border-slate-200">{language === 'ru' ? 'Название услуги' : 'Xizmat Nomi'}</th>
                        <th className="w-20 px-2 py-2 text-center border-r border-slate-200">{language === 'ru' ? 'Зуб' : 'Tish'}</th>
                        <th className="px-3 py-2 text-right">{language === 'ru' ? 'Цена (UZS)' : 'Narxi (UZS)'}</th>
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
                                      {language === 'ru' ? 'Выполнено' : 'Bajarildi'}
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-200">
                {activeDetailPlan.patient_id && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDetailPlanId(null);
                      navigate(`/patients/${activeDetailPlan.patient_id}`);
                    }}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                  >
                    <span>{language === 'ru' ? 'Перейти в профиль пациента' : "Bemor profiliga o'tish"}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                )}

                <div className="flex items-center gap-2 self-end">
                  <Button
                    variant="outline"
                    onClick={() => setSelectedDetailPlanId(null)}
                    className="h-9 px-4 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold cursor-pointer"
                  >
                    {language === 'ru' ? 'Закрыть' : 'Yopish'}
                  </Button>

                  <Button
                    onClick={() => {
                      const pToEdit = activeDetailPlan;
                      setSelectedDetailPlanId(null);
                      setEditPlan(pToEdit);
                      setModalOpen(true);
                    }}
                    className="h-9 px-4 rounded-xl bg-[#1499AD] hover:bg-[#0E7A8A] text-white text-xs font-black gap-1.5 shadow-md shadow-[#1499AD]/20 cursor-pointer border-none"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-white" />
                    <span>{language === 'ru' ? 'Редактировать план' : 'Rejani tahrirlash'}</span>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Creation & Full Reconfiguration Modal */}
      <TreatmentPlanModal 
        open={modalOpen} 
        onClose={() => { setModalOpen(false); setEditPlan(null); }} 
        plan={editPlan} 
        patients={patients} 
        services={services} 
        onSaved={invalidatePlans} 
      />
      
      {/* Invoice Modal */}
      <TreatmentPlanInvoice 
        open={invoiceOpen} 
        onClose={() => { setInvoiceOpen(false); setSelectedPlanForInvoice(null); }} 
        plan={selectedPlanForInvoice} 
      />

      {/* Status Change Confirmation Dialog */}
      <AlertDialog open={!!statusConfirm} onOpenChange={() => setStatusConfirm(null)}>
        <AlertDialogContent className="rounded-3xl border-none shadow-2xl bg-white max-w-md p-6">
          <AlertDialogHeader className="text-center">
            <div className="w-14 h-14 bg-[#1499AD]/10 rounded-2xl flex items-center justify-center text-[#1499AD] mb-3 mx-auto">
              <Clock className="w-7 h-7" />
            </div>
            <AlertDialogTitle className="text-lg font-black text-slate-900 tracking-tight text-center">
              {language === 'ru' ? 'Изменить статус плана лечения?' : 'Davolash rejasi holatini o\'zgartirish'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500 text-center font-medium pt-1 text-xs leading-relaxed">
              {statusConfirm && (
                <>
                  <span className="font-bold text-slate-900 block mb-3">
                    {statusConfirm.patientName} — {statusConfirm.planName}
                  </span>
                  <div className="flex items-center justify-center gap-2 py-2 px-3 bg-slate-50 rounded-2xl border border-slate-200/80 my-2">
                    <span className={cn("px-2.5 py-1 rounded-xl text-xs font-bold border inline-flex items-center gap-1.5", getStatusBadgeInfo(statusConfirm.fromStatus).className)}>
                      <span className={cn("w-1.5 h-1.5 rounded-full", getStatusBadgeInfo(statusConfirm.fromStatus).dotColor)} />
                      {getStatusBadgeInfo(statusConfirm.fromStatus).label}
                    </span>
                    <span className="text-slate-400 font-bold">→</span>
                    <span className={cn("px-2.5 py-1 rounded-xl text-xs font-bold border inline-flex items-center gap-1.5 shadow-xs", getStatusBadgeInfo(statusConfirm.toStatus).className)}>
                      <span className={cn("w-1.5 h-1.5 rounded-full", getStatusBadgeInfo(statusConfirm.toStatus).dotColor)} />
                      {getStatusBadgeInfo(statusConfirm.toStatus).label}
                    </span>
                  </div>
                  <span className="text-slate-400 text-[11px] block mt-2">
                    {language === 'ru' 
                      ? 'Вы уверены, что хотите перевести данный план лечения в новый статус?' 
                      : 'Haqiqatan ham ushbu davolash rejasini yangi holatga o\'tkazishni tasdiqlaysizmi?'}
                  </span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-5 flex gap-2.5">
            <AlertDialogCancel className="h-10 rounded-xl border-slate-200 font-bold text-xs flex-1 m-0 cursor-pointer">
              {language === 'ru' ? 'Отмена' : 'Bekor qilish'}
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmStatusChange} 
              className="h-10 rounded-xl bg-[#1499AD] hover:bg-[#0E7A8A] text-white font-bold text-xs flex-1 m-0 shadow-md border-none cursor-pointer"
            >
              {language === 'ru' ? 'Подтвердить' : 'Tasdiqlash'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletePlanId} onOpenChange={() => setDeletePlanId(null)}>
        <AlertDialogContent className="rounded-2xl border-none shadow-3xl bg-white max-w-md p-6">
          <AlertDialogHeader>
            <div className="w-14 h-14 bg-rose-50 rounded-xl flex items-center justify-center text-rose-500 mb-3 mx-auto">
              <Trash2 className="w-7 h-7" />
            </div>
            <AlertDialogTitle className="text-xl font-bold text-slate-900 text-center tracking-tight">
              O'chirishni tasdiqlaysizmi?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500 text-center font-medium pt-1.5 text-sm">
              Ushbu davolash rejasi va unga bog'liq barcha qarzlar butunlay o'chiriladi. Bu amalni ortga qaytarib bo'lmaydi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 flex gap-3">
            <AlertDialogCancel className="h-10 rounded-xl border-slate-200 font-bold text-xs flex-1 m-0 cursor-pointer">
              Bekor qilish
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="h-10 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex-1 m-0 shadow-md border-none cursor-pointer">
              O'chirish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
