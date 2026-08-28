import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Plus, Search, Edit2, Trash2, Users, UserPlus,
  TrendingUp, Clock, FileSpreadsheet, 
  Download, ArrowUpDown, ArrowUp, ArrowDown, Copy, Check, 
  Phone, Eye, X, Table as TableIcon, LayoutGrid
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useTranslation } from '@/i18n/LanguageContext';
import EmptyState from '../components/ui/EmptyState';
import PatientModal from '../components/patients/PatientModal';
import NewPatientFlow from '../components/patients/NewPatientFlow';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';

// Clean single-line phone number formatter (e.g. +998 90 123 45 67)
const formatPhoneSingleLine = (phone) => {
  if (!phone) return '—';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('998')) {
    return `+998 ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 10)} ${digits.slice(10, 12)}`;
  }
  if (digits.length === 9) {
    return `+998 ${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 7)} ${digits.slice(7, 9)}`;
  }
  return phone;
};

export default function Patients() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { user, isDoctor } = useAuth();
  
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  // Filter and Sorting state (Excel-like)
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'debtors' | 'nodebt' | 'new' | 'active'
  const [sortField, setSortField] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' | 'desc'
  const [density, setDensity] = useState(() => localStorage.getItem('patients_table_density') || 'compact'); // 'compact' | 'comfortable'
  const [copiedId, setCopiedId] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [flowOpen, setFlowOpen] = useState(false);
  const [editPatient, setEditPatient] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [prefillLead, setPrefillLead] = useState(null);
  
  const [allPatients, setAllPatients] = useState([]);
  const loaderRef = useRef(null);

  // Save density preference
  const toggleDensity = (newDensity) => {
    setDensity(newDensity);
    localStorage.setItem('patients_table_density', newDensity);
  };

  // ─── Search Debouncing ──────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  // ─── Queries (TanStack Query) ──────────────────────────────────────────
  const { data: patientsData, isLoading, isFetching } = useQuery({
    queryKey: ['patients', debouncedSearch, page, isDoctor, user?.id],
    queryFn: async () => {
      const offset = page * PAGE_SIZE;
      if (isDoctor && user?.id) {
        // Shifokor bo'yicha filtr
        const allPats = await base44.entities.Patient.list('-created_date', 500).catch(() => []);
        let list = (allPats || []).filter(p =>
          String(p.main_treatment_provider) === String(user.id) ||
          String(p.main_treatment_provider) === String(user.name) ||
          String(p.created_by_id) === String(user.id)
        );
        if (debouncedSearch) {
          const q = debouncedSearch.toLowerCase();
          return list.filter(p => p.full_name?.toLowerCase().includes(q) || p.phone?.includes(q));
        }
        return list.slice(offset, offset + PAGE_SIZE);
      }
      if (debouncedSearch) {
        return await base44.entities.Patient.search(debouncedSearch, PAGE_SIZE, offset);
      }
      return await base44.entities.Patient.list('-created_date', PAGE_SIZE, offset);
    },
    placeholderData: (previousData) => previousData,
    staleTime: 30000,
  });

  const { data: stats } = useQuery({
    queryKey: ['patients-stats', isDoctor, user?.id],
    queryFn: async () => {
      try {
        if (isDoctor && user?.id) {
          const allPats = await base44.entities.Patient.list('-created_date', 500).catch(() => []);
          const docPats = (allPats || []).filter(p =>
            String(p.main_treatment_provider) === String(user.id) ||
            String(p.main_treatment_provider) === String(user.name) ||
            String(p.created_by_id) === String(user.id)
          );

          const monthAgo = new Date();
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          const newCount = docPats.filter(
            p => p.status === 'New' || (!p.status && new Date(p.created_at || p.created_date) > monthAgo) || new Date(p.created_at || p.created_date) > monthAgo
          ).length;

          const activeCount = docPats.filter(
            p => p.status === 'Active' || p.status === 'Faol' || (p.status && p.status !== 'Inactive')
          ).length;

          const debtorCount = docPats.filter(p => (Number(p.total_debt) || 0) > 0).length;
          const totalDebt = docPats.reduce((sum, p) => sum + (Number(p.total_debt) || 0), 0);
          const totalPaid = docPats.reduce((sum, p) => sum + (Number(p.total_paid) || 0), 0);

          return {
            total: docPats.length,
            new: newCount,
            active: activeCount,
            debtors: debtorCount,
            debt: totalDebt,
            paid: totalPaid
          };
        }

        const allPats = await base44.entities.Patient.list('-created_date', 500).catch(() => []);
        const total = allPats.length || (await base44.entities.Patient.count().catch(() => 0));
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        const newCount = allPats.filter(
          p => p.status === 'New' || (!p.status && new Date(p.created_at || p.created_date) > monthAgo) || new Date(p.created_at || p.created_date) > monthAgo
        ).length;
        const activeCount = allPats.filter(
          p => p.status === 'Active' || p.status === 'Faol'
        ).length;
        const debtorCount = allPats.filter(p => (Number(p.total_debt) || 0) > 0).length;
        const totalDebt = allPats.reduce((sum, p) => sum + (Number(p.total_debt) || 0), 0);
        const totalPaid = allPats.reduce((sum, p) => sum + (Number(p.total_paid) || 0), 0);

        return {
          total: total || 0,
          new: newCount,
          active: activeCount,
          debtors: debtorCount,
          debt: totalDebt,
          paid: totalPaid
        };
      } catch (err) {
        console.error('Failed to fetch patient stats:', err);
        return { total: 0, new: 0, active: 0, debtors: 0, debt: 0, paid: 0 };
      }
    },
    staleTime: 60 * 1000,
  });

  const hasMore = patientsData && patientsData.length === PAGE_SIZE;

  // ─── Mutations ──────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Patient.delete(id),
    onSuccess: () => {
      setPage(0);
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      queryClient.invalidateQueries({ queryKey: ['patients-stats'] });
      toast.success(t('common.deleted') || "Bemor o'chirildi");
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

  // Intersection Observer
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
  }, [hasMore]);

  // ─── Filter & Sorting Logic (Excel Grid) ─────────────────────────────────
  const filteredPatients = useMemo(() => {
    let list = [...allPatients];

    // Status filter
    if (activeFilter === 'debtors') {
      list = list.filter(p => (Number(p.total_debt) || 0) > 0);
    } else if (activeFilter === 'nodebt') {
      list = list.filter(p => (Number(p.total_debt) || 0) <= 0);
    } else if (activeFilter === 'new') {
      list = list.filter(p => p.status === 'New' || p.status === 'Yangi');
    } else if (activeFilter === 'active') {
      list = list.filter(p => p.status === 'Active' || p.status === 'Faol');
    }

    // Client-side sorting
    list.sort((a, b) => {
      let valA, valB;
      switch (sortField) {
        case 'full_name':
          valA = (a.full_name || '').toLowerCase();
          valB = (b.full_name || '').toLowerCase();
          return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        case 'phone':
          valA = (a.phone || '').replace(/\D/g, '');
          valB = (b.phone || '').replace(/\D/g, '');
          return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        case 'total_debt':
          valA = Number(a.total_debt) || 0;
          valB = Number(b.total_debt) || 0;
          return sortOrder === 'asc' ? valA - valB : valB - valA;
        case 'total_paid':
          valA = Number(a.total_paid) || 0;
          valB = Number(b.total_paid) || 0;
          return sortOrder === 'asc' ? valA - valB : valB - valA;
        case 'address':
          valA = (a.address || a.region || '').toLowerCase();
          valB = (b.address || b.region || '').toLowerCase();
          return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        case 'last_visit':
          valA = a.last_visit ? new Date(a.last_visit).getTime() : 0;
          valB = b.last_visit ? new Date(b.last_visit).getTime() : 0;
          return sortOrder === 'asc' ? valA - valB : valB - valA;
        case 'created_at':
        default:
          valA = new Date(a.created_at || a.created_date || 0).getTime();
          valB = new Date(b.created_at || b.created_date || 0).getTime();
          return sortOrder === 'asc' ? valA - valB : valB - valA;
      }
    });

    return list;
  }, [allPatients, activeFilter, sortField, sortOrder]);

  // Excel Summary Stats
  const tableSummary = useMemo(() => {
    const totalCount = filteredPatients.length;
    const sumDebt = filteredPatients.reduce((sum, p) => sum + (Number(p.total_debt) || 0), 0);
    const sumPaid = filteredPatients.reduce((sum, p) => sum + (Number(p.total_paid) || 0), 0);
    const debtorCount = filteredPatients.filter(p => (Number(p.total_debt) || 0) > 0).length;
    const avgPaid = totalCount > 0 ? Math.round(sumPaid / totalCount) : 0;
    return { totalCount, sumDebt, sumPaid, debtorCount, avgPaid };
  }, [filteredPatients]);

  // Handle Sort Header Click
  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Copy Phone Helper
  const handleCopyPhone = (e, phone, id) => {
    e.stopPropagation();
    if (!phone) return;
    navigator.clipboard.writeText(phone);
    setCopiedId(id);
    toast.success(t('patients.copied') || "Raqam nusxalandi");
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Export to Excel / CSV (.csv with UTF-8 BOM)
  const handleExportExcel = () => {
    try {
      if (!filteredPatients || filteredPatients.length === 0) {
        toast.warning(t('common.noData') || "Eksport qilish uchun ma'lumot topilmadi");
        return;
      }

      const headers = [
        "№",
        "F.I.Sh (To'liq ism)",
        "Telefon",
        "Qarzdorlik holati",
        "Manzil",
        "Jami Qarz (UZS)",
        "Jami To'langan (UZS)",
        "Oxirgi Tashrif",
        "Ro'yxatdan O'tgan Sana"
      ];

      const csvRows = [];
      csvRows.push(headers.join(","));

      filteredPatients.forEach((p, idx) => {
        const row = [
          idx + 1,
          `"${(p.full_name || '').replace(/"/g, '""')}"`,
          `"${formatPhoneSingleLine(p.phone)}"`,
          (Number(p.total_debt) || 0) > 0 ? '"Qarzdor"' : '"To\'langan"',
          `"${(p.address || p.region || '').replace(/"/g, '""')}"`,
          Number(p.total_debt) || 0,
          Number(p.total_paid) || 0,
          p.last_visit ? `"${new Date(p.last_visit).toLocaleDateString('uz-UZ')}"` : '""',
          p.created_at || p.created_date ? `"${new Date(p.created_at || p.created_date).toLocaleDateString('uz-UZ')}"` : '""'
        ];
        csvRows.push(row.join(","));
      });

      // Add UTF-8 BOM so Excel opens Cyrillic & special chars correctly
      const csvContent = "\uFEFF" + csvRows.join("\r\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const dateStr = new Date().toISOString().split("T")[0];
      link.setAttribute("href", url);
      link.setAttribute("download", `Bemorlar_Royxati_${dateStr}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(t('patients.exportExcel') ? `${t('patients.exportExcel')} (${filteredPatients.length} ta)` : "Excel fayl muvaffaqiyatli yuklandi");
    } catch (err) {
      console.error("Excel export error:", err);
      toast.error("Excel eksport qilishda xatolik yuz berdi");
    }
  };

  const handleDelete = () => {
    if (deleteId) deleteMutation.mutate(deleteId);
  };

  return (
    <div className="space-y-3 pb-8">
      {/* ─── Top Header & Primary Action ───────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <motion.div initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3.5">
          <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center shadow-md ring-2 ring-slate-900/10">
            <Users className="w-5 h-5 text-[#1499AD]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 tracking-tight">{t('patients.title') || "Bemorlar"}</h1>
              <span className="px-2 py-0.5 bg-[#1499AD]/10 text-[#1499AD] text-[10px] font-black rounded-full uppercase tracking-wider">
                Excel CRM Grid
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[11px] font-bold text-slate-500">
                {stats?.total || allPatients.length} {t('patients.patientList') || "bemorlar bazasi"}
              </span>
              <span className="w-1 h-1 rounded-full bg-slate-300" />
              <span className="text-[11px] font-bold text-rose-600">
                {stats?.debtors || 0} {t('patients.debtorsOnly') || "qarzdor"}
              </span>
            </div>
          </div>
        </motion.div>

        <div className="flex items-center gap-2">
          {/* Export to Excel Button */}
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-[11px] font-bold tracking-wide transition-all shadow-sm active:scale-95"
            title="Excel formatida (.csv) yuklab olish"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span className="hidden sm:inline">{t('patients.exportExcel') || "Excelga yuklash"}</span>
            <Download className="w-3.5 h-3.5 opacity-70" />
          </button>

          {/* Add Patient Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setFlowOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[11px] font-black uppercase tracking-wider shadow-md transition-all border-none"
          >
            <Plus className="w-4 h-4 text-[#1499AD]" />
            {t('patients.addNew') || "Yangi bemor"}
          </motion.button>
        </div>
      </div>

      {/* ─── Compact KPI Summary Cards ─────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {[
          { label: t('patients.totalVisits') || 'Jami Bemorlar', value: stats?.total || allPatients.length, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100', icon: Users },
          { label: t('patients.newPatients') || 'Yangi Bemorlar', value: stats?.new || 0, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100', icon: UserPlus },
          { label: t('patients.activeTreatment') || 'Faol Bemorlar', value: stats?.active || 0, color: 'text-[#1499AD]', bg: 'bg-cyan-50 border-cyan-100', icon: Clock },
          { label: t('patients.totalDebt') || 'Jami Qarz', value: (stats?.debt || 0).toLocaleString(), color: 'text-rose-600', bg: 'bg-rose-50 border-rose-100', icon: TrendingUp, isCurrency: true }
        ].map((stat, i) => (
          <motion.div 
            key={i} 
            initial={{ opacity: 0, y: 8 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: i * 0.04 }}
            className={`bg-white rounded-xl p-3 border ${stat.bg} shadow-xs flex items-center gap-3`}
          >
            <div className={`w-8 h-8 rounded-lg ${stat.bg} ${stat.color} flex items-center justify-center shrink-0`}>
              <stat.icon className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">{stat.label}</p>
              <div className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight truncate">
                {stat.value} {stat.isCurrency && <span className="text-[10px] text-slate-400 font-semibold ml-0.5">UZS</span>}
              </div>
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
              placeholder={t('patients.searchPlaceholder') || "Bemor ismi yoki telefon raqami bo'yicha tezkor qidiruv..."} 
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

          {/* Quick Filter Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
            {[
              { id: 'all', label: t('patients.allPatients') || "Barchasi", count: allPatients.length },
              { id: 'debtors', label: t('patients.debtorsOnly') || "Qarzdorlar", count: stats?.debtors || 0, badgeColor: 'bg-rose-500 text-white' },
              { id: 'nodebt', label: t('patients.noDebt') || "Qarzsiz" },
              { id: 'new', label: t('patients.newPatients') || "Yangi", count: stats?.new || 0 },
              { id: 'active', label: t('patients.activeTreatment') || "Faol", count: stats?.active || 0 }
            ].map((tab) => {
              const isActive = activeFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveFilter(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    isActive 
                      ? 'bg-slate-900 text-white shadow-xs font-black' 
                      : 'bg-slate-100/70 text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-black ${
                      isActive 
                        ? (tab.badgeColor || 'bg-white/20 text-white') 
                        : (tab.badgeColor || 'bg-slate-200 text-slate-600')
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Density Switcher */}
          <div className="hidden sm:flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/70 self-end lg:self-auto">
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
              <span>{t('patients.compact') || "Excel"}</span>
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
              <span>{t('patients.comfortable') || "Keng"}</span>
            </button>
          </div>

        </div>
      </div>

      {/* ─── Excel Spreadsheet Grid Table ──────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false}>
          {isLoading && allPatients.length === 0 ? (
            <div className="p-6 space-y-2">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="h-10 bg-slate-100/70 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : filteredPatients.length === 0 ? (
            <div className="py-20 text-center">
              <EmptyState 
                icon={Users} 
                title={t('patients.notFound') || "Bemorlar topilmadi"} 
                description="Qidiruv so'zini o'zgartiring yoki filtrlarni tozalang"
              />
              {(search || activeFilter !== 'all') && (
                <button
                  onClick={() => { setSearch(''); setActiveFilter('all'); }}
                  className="mt-3 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
                >
                  Filtrlarni tozalash
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left select-text min-w-[920px]">
                {/* ─── Excel Table Header ────────────────── */}
                <thead>
                  <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-600 text-[10.5px] font-black uppercase tracking-wider sticky top-0 z-10 backdrop-blur-xs">
                    
                    {/* № Col */}
                    <th 
                      onClick={() => handleSort('created_at')}
                      className="w-12 px-3 py-2.5 text-center border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors select-none"
                      title="Tartib raqami"
                    >
                      <div className="flex items-center justify-center gap-1 font-mono">
                        <span>№</span>
                        {sortField === 'created_at' && (
                          sortOrder === 'asc' ? <ArrowUp className="w-2.5 h-2.5 text-[#1499AD]" /> : <ArrowDown className="w-2.5 h-2.5 text-[#1499AD]" />
                        )}
                      </div>
                    </th>

                    {/* Patient Full Name */}
                    <th 
                      onClick={() => handleSort('full_name')}
                      className="min-w-[200px] px-3.5 py-2.5 border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors select-none"
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <span>{t('patients.fullName') || "Bemor (F.I.Sh)"}</span>
                        {sortField === 'full_name' ? (
                          sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#1499AD]" /> : <ArrowDown className="w-3 h-3 text-[#1499AD]" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-30" />
                        )}
                      </div>
                    </th>

                    {/* Phone (Single line guaranteed) */}
                    <th 
                      onClick={() => handleSort('phone')}
                      className="w-52 min-w-[200px] px-3.5 py-2.5 border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors select-none whitespace-nowrap"
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <span>{t('common.phone') || "Telefon"}</span>
                        {sortField === 'phone' ? (
                          sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#1499AD]" /> : <ArrowDown className="w-3 h-3 text-[#1499AD]" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-30" />
                        )}
                      </div>
                    </th>

                    {/* Address / Region (Single line guaranteed) */}
                    <th 
                      onClick={() => handleSort('address')}
                      className="min-w-[180px] px-3.5 py-2.5 border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors select-none whitespace-nowrap"
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <span>{t('common.address') || "Manzil"}</span>
                        {sortField === 'address' && (
                          sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#1499AD]" /> : <ArrowDown className="w-3 h-3 text-[#1499AD]" />
                        )}
                      </div>
                    </th>

                    {/* Total Debt */}
                    <th 
                      onClick={() => handleSort('total_debt')}
                      className="w-36 min-w-[130px] px-3.5 py-2.5 text-right border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors bg-rose-50/40 select-none whitespace-nowrap"
                    >
                      <div className="flex items-center justify-end gap-1.5 text-rose-600">
                        <span>{t('patients.totalDebt') || "Jami Qarz"}</span>
                        {sortField === 'total_debt' ? (
                          sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-40" />
                        )}
                      </div>
                    </th>

                    {/* Total Paid */}
                    <th 
                      onClick={() => handleSort('total_paid')}
                      className="w-36 min-w-[130px] px-3.5 py-2.5 text-right border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors bg-emerald-50/40 select-none whitespace-nowrap"
                    >
                      <div className="flex items-center justify-end gap-1.5 text-emerald-700">
                        <span>{t('patients.totalPaid') || "Jami To'lov"}</span>
                        {sortField === 'total_paid' ? (
                          sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-40" />
                        )}
                      </div>
                    </th>

                    {/* Last Visit */}
                    <th 
                      onClick={() => handleSort('last_visit')}
                      className="w-32 min-w-[110px] px-3 py-2.5 text-center border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors select-none whitespace-nowrap"
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <span>{t('patients.lastVisit') || "Oxirgi Tashrif"}</span>
                        {sortField === 'last_visit' && (
                          sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#1499AD]" /> : <ArrowDown className="w-3 h-3 text-[#1499AD]" />
                        )}
                      </div>
                    </th>

                    {/* Actions */}
                    <th className="w-24 px-3 py-2.5 text-center text-slate-500 whitespace-nowrap select-none">
                      {t('common.actions') || "Amallar"}
                    </th>

                  </tr>
                </thead>

                {/* ─── Excel Table Body ────────────────── */}
                <tbody className="divide-y divide-slate-200/70 text-xs">
                  {filteredPatients.map((p, idx) => {
                    const debtAmount = Number(p.total_debt) || 0;
                    const paidAmount = Number(p.total_paid) || 0;
                    const isDebtor = debtAmount > 0;
                    const isCompact = density === 'compact';

                    return (
                      <tr
                        key={p.id}
                        onClick={() => navigate(`/patients/${p.id}`)}
                        className={`group hover:bg-[#1499AD]/10 hover:shadow-xs transition-colors cursor-pointer ${
                          idx % 2 === 1 ? 'bg-slate-50/30' : 'bg-white'
                        }`}
                      >
                        {/* № Cell */}
                        <td className={`text-center font-mono font-bold text-slate-400 border-r border-slate-200/70 whitespace-nowrap ${isCompact ? 'py-2 px-2' : 'py-3.5 px-3'}`}>
                          {idx + 1}
                        </td>

                        {/* Patient Name Cell */}
                        <td className={`border-r border-slate-200/70 ${isCompact ? 'py-1.5 px-3' : 'py-3 px-3.5'}`}>
                          <div className="flex items-center gap-2.5 min-w-0">
                            {/* Avatar */}
                            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 font-black text-[11px] shrink-0 border border-slate-200 overflow-hidden group-hover:bg-[#1499AD] group-hover:text-white transition-colors">
                              {(p.photo_url || p.photo) ? (
                                <img src={p.photo_url || p.photo} alt={p.full_name} className="w-full h-full object-cover" />
                              ) : (
                                <span>{(p.full_name || 'B').substring(0, 2).toUpperCase()}</span>
                              )}
                            </div>

                            {/* Name & Debtor badge */}
                            <div className="min-w-0 flex-1">
                              <span className="font-extrabold text-slate-900 group-hover:text-[#1499AD] transition-colors truncate block">
                                {p.full_name || 'Noma\'lum bemor'}
                              </span>
                              {isDebtor && (
                                <span className="inline-block mt-0.5 text-[9px] font-black text-rose-600 bg-rose-50 px-1 py-0.2 rounded border border-rose-100">
                                  {t('patients.debtor') || "Qarzdor"}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Phone Cell (Always 1 Single Line) */}
                        <td className={`border-r border-slate-200/70 whitespace-nowrap ${isCompact ? 'py-1.5 px-3' : 'py-3 px-3.5'}`}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-800 font-mono text-[12px] tabular-nums whitespace-nowrap select-all tracking-tight">
                              {formatPhoneSingleLine(p.phone)}
                            </span>
                            {p.phone && (
                              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                <button
                                  onClick={(e) => handleCopyPhone(e, p.phone, p.id)}
                                  className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-200/70 rounded transition-all"
                                  title="Raqamni nusxalash"
                                >
                                  {copiedId === p.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                                </button>
                                <a
                                  href={`tel:${p.phone}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-all"
                                  title="Qo'ng'iroq qilish"
                                >
                                  <Phone className="w-3 h-3" />
                                </a>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Address Cell (Always 1 Single Line) */}
                        <td className={`border-r border-slate-200/70 whitespace-nowrap ${isCompact ? 'py-1.5 px-3' : 'py-3 px-3.5'}`}>
                          <span 
                            className="text-slate-700 font-semibold text-xs whitespace-nowrap block truncate max-w-[280px]" 
                            title={p.address || p.region || ''}
                          >
                            {p.address || p.region || '—'}
                          </span>
                        </td>

                        {/* Total Debt Cell */}
                        <td className={`text-right border-r border-slate-200/70 whitespace-nowrap ${isCompact ? 'py-1.5 px-3' : 'py-3 px-3.5'}`}>
                          <span className={`font-mono font-bold tabular-nums ${isDebtor ? 'text-rose-600' : 'text-slate-400'}`}>
                            {debtAmount.toLocaleString()}
                            <span className="text-[9.5px] font-normal text-slate-400 ml-1">so'm</span>
                          </span>
                        </td>

                        {/* Total Paid Cell */}
                        <td className={`text-right border-r border-slate-200/70 whitespace-nowrap ${isCompact ? 'py-1.5 px-3' : 'py-3 px-3.5'}`}>
                          <span className={`font-mono font-bold tabular-nums ${paidAmount > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                            {paidAmount.toLocaleString()}
                            <span className="text-[9.5px] font-normal text-slate-400 ml-1">so'm</span>
                          </span>
                        </td>

                        {/* Last Visit Cell */}
                        <td className={`text-center text-slate-500 font-medium border-r border-slate-200/70 whitespace-nowrap ${isCompact ? 'py-1.5 px-2' : 'py-3 px-2'}`}>
                          {p.last_visit ? (
                            <span className="font-mono text-[11px]">{new Date(p.last_visit).toLocaleDateString('uz-UZ')}</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>

                        {/* Actions Cell */}
                        <td className={`text-center whitespace-nowrap ${isCompact ? 'py-1 px-2' : 'py-2 px-2'}`}>
                          <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <button 
                              onClick={() => navigate(`/patients/${p.id}`)}
                              className="p-1 rounded-lg text-slate-400 hover:text-[#1499AD] hover:bg-[#1499AD]/10 transition-all"
                              title={t('patients.viewProfile') || "Profilni ochish"}
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => { setEditPatient(p); setModalOpen(true); }}
                              className="p-1 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-amber-50 transition-all"
                              title={t('patients.editPatient') || "Tahrirlash"}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => setDeleteId(p.id)}
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all"
                              title={t('patients.deletePatient') || "O'chirish"}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </AnimatePresence>

        {/* ─── Excel Spreadsheet Bottom Summary Bar ───────────────────── */}
        {filteredPatients.length > 0 && (
          <div className="bg-slate-100/90 border-t border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 font-bold">
            <div className="flex items-center gap-3">
              <span>
                {t('patients.showingCount') || "Jadvalda"}: <strong className="text-slate-900">{tableSummary.totalCount}</strong> ta bemor
              </span>
              <span className="text-slate-300">|</span>
              <span>
                Qarzdorlar: <strong className="text-rose-600">{tableSummary.debtorCount}</strong> ta ({tableSummary.totalCount > 0 ? Math.round((tableSummary.debtorCount / tableSummary.totalCount) * 100) : 0}%)
              </span>
            </div>

            <div className="flex items-center gap-4 font-mono tabular-nums">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 uppercase text-[10px] font-sans font-bold">Σ Jami Qarz:</span>
                <span className="text-rose-600 font-black">{tableSummary.sumDebt.toLocaleString()} UZS</span>
              </div>
              <span className="text-slate-300">|</span>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 uppercase text-[10px] font-sans font-bold">Σ Jami To'lov:</span>
                <span className="text-emerald-700 font-black">{tableSummary.sumPaid.toLocaleString()} UZS</span>
              </div>
              <span className="text-slate-300 hidden md:inline">|</span>
              <div className="hidden md:flex items-center gap-1.5">
                <span className="text-slate-500 uppercase text-[10px] font-sans font-bold">x̄ O'rtacha:</span>
                <span className="text-slate-800 font-bold">{tableSummary.avgPaid.toLocaleString()} UZS</span>
              </div>
            </div>
          </div>
        )}

        {/* Sentinel for Infinite Scrolling */}
        <div ref={loaderRef} className="py-2 flex justify-center min-h-[1px]">
          {hasMore && (
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 py-2">
              <motion.div 
                animate={{ rotate: 360 }} 
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }} 
                className="w-4 h-4 border-2 border-slate-200 border-t-[#1499AD] rounded-full" 
              />
              <span>{t('patients.loading') || "Ko'proq bemorlar yuklanmoqda..."}</span>
            </div>
          )}
        </div>
      </div>

      {/* ─── Modals & Dialogs ──────────────────────────────────────── */}
      <PatientModal 
        open={modalOpen} 
        onClose={() => setModalOpen(false)} 
        patient={editPatient} 
        onSaved={() => { 
          setPage(0); 
          queryClient.invalidateQueries({ queryKey: ['patients'] }); 
          queryClient.invalidateQueries({ queryKey: ['patients-stats'] });
        }} 
      />

      <NewPatientFlow 
        open={flowOpen} 
        onClose={() => setFlowOpen(false)} 
        onSaved={() => {
          setPage(0);
          queryClient.invalidateQueries({ queryKey: ['patients'] });
          queryClient.invalidateQueries({ queryKey: ['patients-stats'] });
        }} 
        prefillData={prefillLead} 
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="rounded-3xl p-0 overflow-hidden border-none bg-white max-w-sm">
          <div className="bg-rose-500 p-8 flex items-center justify-center text-white">
            <Trash2 className="w-12 h-12" />
          </div>
          <div className="p-6 text-center">
            <AlertDialogTitle className="text-xl font-black text-slate-900 uppercase mb-2">
              {t('patients.deleteConfirmTitle') || "Bemorni o'chirish"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs font-medium text-slate-500">
              {t('patients.deleteConfirmDesc') || "Haqiqatan ham bu bemorni va unga tegishli barcha ma'lumotlarni o'chirmoqchimisiz?"}
            </AlertDialogDescription>
            <div className="flex gap-3 mt-6">
              <AlertDialogCancel className="flex-1 h-11 rounded-xl border border-slate-200 font-bold uppercase text-[11px]">
                {t('common.no') || "Yo'q"}
              </AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDelete} 
                className="flex-1 h-11 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold uppercase text-[11px]"
              >
                {t('patients.confirmDeleteAction') || "O'chirish"}
              </AlertDialogAction>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
