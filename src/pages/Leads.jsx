import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import EmptyState from '../components/ui/EmptyState';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from '@/i18n/LanguageContext';
import LeadQuickView from '../components/marketing/LeadQuickView';
import LeadNotesModal, { parseLeadNotes } from '../components/marketing/LeadNotesModal';
import { useRef, useState, useEffect, useMemo } from 'react';
import { 
  Search, Phone, Edit2, Trash2, MessageCircle, TrendingUp, Target, 
  Calendar, UserPlus, Filter, Zap, Upload, Bell, Download, 
  FileSpreadsheet, Instagram, Send, Facebook, Globe, Copy, Check,
  ExternalLink, UserCheck, CheckCircle2, MoreHorizontal, LayoutGrid, Table,
  MessageSquare, Plus
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

export default function Leads() {
  const { t, language } = useTranslation();
  const { user, isDoctor } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editLead, setEditLead] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [view, setView] = useState('table'); // Default to Excel Table as requested
  const [statusFilter, setStatusFilter] = useState('all');
  const [form, setForm] = useState({ name: '', phone: '', visit_date: '', source: 'Call', status: 'new', notes: '' });
  const [selectedLead, setSelectedLead] = useState(null);
  const [notesModalLead, setNotesModalLead] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [botUsername, setBotUsername] = useState('shifocrm_bot');
  
  const fileInputRef = useRef(null);
  const clinicId = localStorage.getItem('current_clinic_id') || 'default_clinic';

  const DEFAULT_COLUMNS = [
    { id: 'new', title: 'Yangi', color: 'bg-blue-500', hex: '#3b82f6' },
    { id: 'contacted', title: 'Bog\'lanildi', color: 'bg-purple-500', hex: '#a855f7' },
    { id: 'qualified', title: 'Qiziqqan', color: 'bg-amber-500', hex: '#f59e0b' },
    { id: 'converted', title: 'Bemor', color: 'bg-emerald-500', hex: '#10b981' },
    { id: 'lost', title: 'Rad etilgan', color: 'bg-slate-400', hex: '#94a3b8' }
  ];

  const [kanbanColumns, setKanbanColumns] = useState(() => {
    const saved = localStorage.getItem(`leads_columns_${clinicId}`);
    return saved ? JSON.parse(saved) : DEFAULT_COLUMNS;
  });

  const PREMIUM_COLORS = [
    { name: 'bg-blue-500', hex: '#3b82f6' },
    { name: 'bg-indigo-500', hex: '#6366f1' },
    { name: 'bg-purple-500', hex: '#a855f7' },
    { name: 'bg-fuchsia-500', hex: '#d946ef' },
    { name: 'bg-pink-500', hex: '#ec4899' },
    { name: 'bg-rose-500', hex: '#f43f5e' },
    { name: 'bg-orange-500', hex: '#f97316' },
    { name: 'bg-amber-500', hex: '#f59e0b' },
    { name: 'bg-emerald-500', hex: '#10b981' },
    { name: 'bg-teal-500', hex: '#14b8a6' },
    { name: 'bg-cyan-500', hex: '#06b6d4' },
    { name: 'bg-slate-500', hex: '#64748b' }
  ];

  const [editingColId, setEditingColId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');

  useEffect(() => {
    localStorage.setItem(`leads_columns_${clinicId}`, JSON.stringify(kanbanColumns));
  }, [kanbanColumns, clinicId]);

  const updateColumnColor = (id, colorObj) => {
    setKanbanColumns(prev => prev.map(col => col.id === id ? { ...col, color: colorObj.name, hex: colorObj.hex } : col));
  };

  const updateColumnTitle = (id, newTitle) => {
    setKanbanColumns(prev => prev.map(col => col.id === id ? { ...col, title: newTitle } : col));
    setEditingColId(null);
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  // ─── Queries ──────────────────────────────────────────────────────────
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads', debouncedSearch, isDoctor, user?.id],
    queryFn: async () => {
      let allLeads;
      if (debouncedSearch) {
        allLeads = await base44.entities.Lead.search(debouncedSearch, 200);
      } else {
        allLeads = await base44.entities.Lead.list('-created_date', 200);
      }
      // Doktor bo'lsa faqat o'ziga tayinlangan yoki o'zi qo'shgan lidlarni ko'rsin
      if (isDoctor && user?.id) {
        return (allLeads || []).filter(lead =>
          String(lead.assigned_doctor_id) === String(user.id) ||
          String(lead.created_by_id) === String(user.id) ||
          // Agar assigned_doctor_id yo'q bo'lsa — hamma doktorlarga ko'rsatilsin
          (!lead.assigned_doctor_id && !lead.created_by_id)
        );
      }
      return allLeads || [];
    },
    staleTime: 30000,
  });

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return leads;
    return leads.filter(l => (l.status?.toLowerCase() || 'new') === statusFilter);
  }, [leads, statusFilter]);

  const { data: stats } = useQuery({
    queryKey: ['leads-stats', leads],
    queryFn: () => {
      const total = leads.length;
      const newLeads = leads.filter(l => (l.status?.toLowerCase() || 'new') === 'new').length;
      const contacted = leads.filter(l => l.status?.toLowerCase() === 'contacted').length;
      const qualified = leads.filter(l => l.status?.toLowerCase() === 'qualified' || l.status?.toLowerCase() === 'interested').length;
      const converted = leads.filter(l => l.status?.toLowerCase() === 'converted').length;
      return { total, new: newLeads, contacted, qualified, converted };
    },
    enabled: !!leads,
  });

  // ─── Mutations ────────────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Lead.update(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['leads'] });
      const previousLeads = queryClient.getQueryData(['leads']);
      queryClient.setQueryData(['leads'], old => 
        old?.map(l => String(l.id) === String(id) ? { ...l, ...data } : l)
      );
      return { previousLeads };
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(['leads'], context?.previousLeads);
      toast.error("Xatolik yuz berdi");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    }
  });

  const saveMutation = useMutation({
    mutationFn: (data) => editLead ? base44.entities.Lead.update(editLead.id, data) : base44.entities.Lead.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setModalOpen(false);
      setEditLead(null);
      toast.success(editLead ? "Yangilandi" : "Qo'shildi");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Lead.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setDeleteId(null);
      toast.success("O'chirildi");
    }
  });

  const handleConvertToPatient = async (targetLead) => {
    try {
      const userClinic = targetLead.clinic_id || localStorage.getItem('current_clinic_id') || 'default_clinic';
      await base44.entities.Patient.create({
        full_name: targetLead.name,
        phone: targetLead.phone,
        clinic_id: userClinic,
        status: 'Active',
        notes: `Marketing (Lidlar) bo'limidan o'tkazildi. Izoh: ${targetLead.notes || ''}`
      });
      await base44.entities.Lead.update(targetLead.id, { status: 'converted' });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success("Mijoz bemorlar bazasiga muvaffaqiyatli o'tkazildi!");
    } catch (err) {
      console.error(err);
      toast.error("Bemorga o'tkazishda xatolik: " + err.message);
    }
  };

  useEffect(() => {
    if (editLead) {
      setForm({ 
        name: editLead.name || '', 
        phone: editLead.phone || '', 
        visit_date: editLead.visit_date || '', 
        source: editLead.source || 'Call', 
        status: editLead.status || 'new', 
        notes: editLead.notes || '' 
      });
    } else {
      setForm({ name: '', phone: '', visit_date: '', source: 'Call', status: 'new', notes: '' });
    }
  }, [editLead, modalOpen]);

  const handleSave = () => {
    if (!form.name || !form.phone) return;
    saveMutation.mutate(form);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '—';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  };

  const onDragEnd = async (result) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;
    const newStatus = destination.droppableId;
    const leadId = draggableId;
    updateMutation.mutate({ id: leadId, data: { status: newStatus.toLowerCase() } });
  };

  const handleDelete = () => {
    if (deleteId) deleteMutation.mutate(deleteId);
  };

  // ─── Real Brand Source Icons & Badges ─────────────────────────────────
  const getSourceMeta = (source) => {
    const s = String(source || '').toLowerCase();
    if (s.includes('instagram') || s.includes('insta')) {
      return {
        label: 'Instagram',
        icon: Instagram,
        bg: 'bg-pink-50 text-pink-700 border-pink-200/80',
        iconBg: 'bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white',
      };
    }
    if (s.includes('telegram') || s.includes('tg')) {
      return {
        label: 'Telegram',
        icon: Send,
        bg: 'bg-sky-50 text-sky-700 border-sky-200/80',
        iconBg: 'bg-[#229ED9] text-white',
      };
    }
    if (s.includes('facebook') || s.includes('fb')) {
      return {
        label: 'Facebook',
        icon: Facebook,
        bg: 'bg-blue-50 text-blue-700 border-blue-200/80',
        iconBg: 'bg-[#1877F2] text-white',
      };
    }
    if (s.includes('call') || s.includes('phone') || s.includes('telefon') || s.includes('qo\'ng\'iroq')) {
      return {
        label: 'Telefon',
        icon: Phone,
        bg: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
        iconBg: 'bg-emerald-600 text-white',
      };
    }
    if (s.includes('website') || s.includes('sayt') || s.includes('web') || s.includes('google')) {
      return {
        label: 'Veb-sayt',
        icon: Globe,
        bg: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
        iconBg: 'bg-indigo-600 text-white',
      };
    }
    if (s.includes('import') || s.includes('csv') || s.includes('excel')) {
      return {
        label: 'Excel Import',
        icon: FileSpreadsheet,
        bg: 'bg-teal-50 text-teal-700 border-teal-200/80',
        iconBg: 'bg-[#107C41] text-white',
      };
    }
    return {
      label: source || 'Boshqa',
      icon: Target,
      bg: 'bg-slate-100 text-slate-700 border-slate-200',
      iconBg: 'bg-slate-600 text-white',
    };
  };

  const renderSourceBadge = (source) => {
    const meta = getSourceMeta(source);
    const Icon = meta.icon;
    return (
      <div 
        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${meta.iconBg} shadow-2xs transition-transform hover:scale-110 cursor-help`}
        title={`Manba: ${source || meta.label}`}
      >
        <Icon className="w-3.5 h-3.5 text-white" />
      </div>
    );
  };

  const renderStatusBadge = (status) => {
    const s = String(status || 'new').toLowerCase();
    switch(s) {
      case 'new':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200/80 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            {t('leads.statusNew') || (language === 'ru' ? 'Новый' : 'Yangi')}
          </span>
        );
      case 'contacted':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200/80 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
            {t('leads.statusContacted') || (language === 'ru' ? 'Связались' : 'Bog\'lanildi')}
          </span>
        );
      case 'qualified':
      case 'interested':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200/80 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            {t('leads.statusQualified') || (language === 'ru' ? 'Заинтересован' : 'Qiziqqan')}
          </span>
        );
      case 'converted':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200/80 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {t('leads.statusConverted') || (language === 'ru' ? 'Пациент' : 'Bemor')}
          </span>
        );
      case 'lost':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            {t('leads.statusLost') || (language === 'ru' ? 'Отклонено' : 'Rad etildi')}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-slate-50 text-slate-700 border border-slate-200 whitespace-nowrap">
            {status}
          </span>
        );
    }
  };

  const getInitials = (name) => {
    if (!name) return 'L';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // ─── Export to Excel (CSV with UTF-8 BOM) ─────────────────────────────
  const exportToExcel = () => {
    if (!filtered || filtered.length === 0) {
      toast.error("Eksport qilish uchun lidlar topilmadi");
      return;
    }
    const headers = ["№", "Ism", "Telefon", "Tashrif Sanasi", "Manba", "Status", "Izoh"];
    const rows = filtered.map((l, index) => [
      index + 1,
      `"${(l.name || '').replace(/"/g, '""')}"`,
      `"${(l.phone || '').replace(/"/g, '""')}"`,
      `"${(formatDate(l.visit_date || l.created_date) || '').replace(/"/g, '""')}"`,
      `"${(l.source || '').replace(/"/g, '""')}"`,
      `"${(l.status || '').replace(/"/g, '""')}"`,
      `"${(l.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Lidlar_Baza_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Excel (CSV) fayli muvaffaqiyatli yuklab olindi!");
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const rows = text.split('\n').map(row => row.trim()).filter(row => row);
        if (rows.length < 2) return toast.error("Fayl bo'sh ko'rinadi");
        
        const headers = rows[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
        
        let nameIdx = headers.findIndex(h => h === 'full_name' || h === 'name' || h === 'first_name' || h.includes('ism') || h.includes('имя'));
        let phoneIdx = headers.findIndex(h => h === 'phone_number' || h === 'phone' || h.includes('telefon') || h.includes('raqam') || h.includes('телефон') || h.includes('номер'));
        
        if (nameIdx === -1) nameIdx = 0;
        if (phoneIdx === -1) phoneIdx = 1;

        let successCount = 0;
        for (let i = 1; i < rows.length; i++) {
          let cols = [];
          let currentRow = rows[i];
          let inQuote = false;
          let currentStr = '';
          for(let char of currentRow) {
            if(char === '"') inQuote = !inQuote;
            else if(char === ',' && !inQuote) { cols.push(currentStr); currentStr = ''; }
            else currentStr += char;
          }
          cols.push(currentStr);
          
          const cleanCols = cols.map(c => c.trim().replace(/^"|"$/g, ''));
          
          const leadName = cleanCols[nameIdx];
          const leadPhone = cleanCols[phoneIdx];

          if (!leadPhone || leadPhone.length < 4 || leadName?.includes('202') || !leadName) continue;
          
          const leadData = {
            name: leadName,
            full_name: leadName,
            phone: leadPhone,
            source: 'Import',
            status: 'new',
            clinic_id: clinicId,
            created_date: new Date().toISOString()
          };
          
          if (leadData.phone) {
             await base44.entities.Lead.create(leadData);
             successCount++;
          }
        }
        
        toast.success(`🎉 ${successCount} ta lead muvaffaqiyatli yuklandi!`);
        queryClient.invalidateQueries({ queryKey: ['leads'] });
      } catch (err) {
         console.error('Import error:', err);
         toast.error("Import qilishda xatolik yuz berdi. Fayl formatini tekshiring.");
      } finally {
         setIsImporting(false);
         if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const columns = kanbanColumns;

  return (
    <div className="space-y-3">
      {/* ─── Compact Header Section ──────────────────────────────────────── */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-[#1499AD] flex items-center justify-center text-white shadow-xs shrink-0">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 leading-tight">
              {t('leads.title') || 'Lidlar Boshqaruvi'}
            </h1>
            <p className="text-[11px] font-medium text-slate-500">
              {t('leads.subtitle') || 'Potentsial mijozlar, target arizalari va murojaatlar'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input 
            type="file" 
            accept=".csv" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            className="hidden" 
          />
          <Button 
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="h-9 px-3 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border-slate-200 rounded-lg shadow-2xs"
          >
            <Upload className="w-3.5 h-3.5 mr-1.5 text-slate-500" /> 
            {isImporting ? (language === 'ru' ? 'Загрузка...' : 'Yuklanmoqda...') : (t('leads.csvImport') || 'CSV Import')}
          </Button>

          <Button 
            size="sm"
            className="bg-[#0088cc] hover:bg-[#0077b5] text-white rounded-lg h-9 px-3 text-xs font-bold shadow-2xs border-none"
            asChild
          >
            <a href={`https://t.me/${botUsername}?start=admin_${clinicId}`} target="_blank" rel="noopener noreferrer">
              <Bell className="w-3.5 h-3.5 mr-1.5" /> {t('leads.telegramBot') || 'Telegram Bot'}
            </a>
          </Button>

          <Button 
            size="sm"
            onClick={() => { setEditLead(null); setModalOpen(true); }}
            className="bg-[#1499AD] hover:bg-[#0E7A8A] text-white rounded-lg h-9 px-4 text-xs font-bold shadow-2xs border-none"
          >
            <UserPlus className="w-3.5 h-3.5 mr-1.5" /> {t('leads.newLead') || 'Yangi lead'}
          </Button>
        </div>
      </motion.div>

      {/* ─── Compact Stats Cards ────────────────────────────────────────── */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-3"
      >
        <div 
          onClick={() => setStatusFilter('all')}
          className={`cursor-pointer bg-white border rounded-xl p-3 shadow-2xs hover:shadow-xs transition-all flex items-center justify-between ${statusFilter === 'all' ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200/80'}`}
        >
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('leads.totalLeads') || (language === 'ru' ? 'Всего лидов' : 'Jami Lidlar')}</p>
            <p className="text-2xl font-black text-slate-900 mt-0.5 font-mono">{stats?.total || 0}</p>
          </div>
          <div className="w-9 h-9 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center border border-blue-100 shadow-2xs">
            <Target className="w-4.5 h-4.5" />
          </div>
        </div>

        <div 
          onClick={() => setStatusFilter('new')}
          className={`cursor-pointer bg-white border rounded-xl p-3 shadow-2xs hover:shadow-xs transition-all flex items-center justify-between ${statusFilter === 'new' ? 'border-purple-500 ring-2 ring-purple-100' : 'border-slate-200/80'}`}
        >
          <div>
            <p className="text-[11px] font-bold text-purple-600 uppercase tracking-wider">{t('leads.columns.new') || 'Yangi'}</p>
            <p className="text-2xl font-black text-purple-950 mt-0.5 font-mono">{stats?.new || 0}</p>
          </div>
          <div className="w-9 h-9 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center border border-purple-100 shadow-2xs">
            <Zap className="w-4.5 h-4.5" />
          </div>
        </div>

        <div 
          onClick={() => setStatusFilter('contacted')}
          className={`cursor-pointer bg-white border rounded-xl p-3 shadow-2xs hover:shadow-xs transition-all flex items-center justify-between ${statusFilter === 'contacted' ? 'border-amber-500 ring-2 ring-amber-100' : 'border-slate-200/80'}`}
        >
          <div>
            <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">{t('leads.columns.contacted') || 'Bog\'lanildi'}</p>
            <p className="text-2xl font-black text-amber-950 mt-0.5 font-mono">{stats?.contacted || 0}</p>
          </div>
          <div className="w-9 h-9 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center border border-amber-100 shadow-2xs">
            <Phone className="w-4.5 h-4.5" />
          </div>
        </div>

        <div 
          onClick={() => setStatusFilter('converted')}
          className={`cursor-pointer bg-white border rounded-xl p-3 shadow-2xs hover:shadow-xs transition-all flex items-center justify-between ${statusFilter === 'converted' ? 'border-emerald-500 ring-2 ring-emerald-100' : 'border-slate-200/80'}`}
        >
          <div>
            <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">{t('leads.columns.converted') || 'Bemor (Konvertatsiya)'}</p>
            <p className="text-2xl font-black text-emerald-950 mt-0.5 font-mono">{stats?.converted || 0}</p>
          </div>
          <div className="w-9 h-9 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center border border-emerald-100 shadow-2xs">
            <TrendingUp className="w-4.5 h-4.5" />
          </div>
        </div>
      </motion.div>

      {/* ─── Search, Tabs & View Switcher ─────────────────────────────────── */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs"
      >
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            placeholder={t('leads.searchPlaceholder') || "Ism yoki telefon raqami bo'yicha qidirish..."} 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            className="pl-9 pr-3 h-9 text-xs rounded-lg border-slate-200 focus:border-cyan-500 transition-colors bg-slate-50/50" 
          />
          {search && (
            <button 
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>

        {/* Status Filter Badges */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
          {[
            { id: 'all', label: t('leads.allTab') || (language === 'ru' ? 'Все' : 'Barchasi'), count: stats?.total || 0 },
            { id: 'new', label: t('leads.newTab') || (language === 'ru' ? 'Новые' : 'Yangi'), count: stats?.new || 0 },
            { id: 'contacted', label: t('leads.contactedTab') || (language === 'ru' ? 'Связались' : 'Bog\'lanildi'), count: stats?.contacted || 0 },
            { id: 'converted', label: t('leads.convertedTab') || (language === 'ru' ? 'Пациент' : 'Bemor'), count: stats?.converted || 0 },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                statusFilter === tab.id 
                  ? 'bg-slate-900 text-white shadow-2xs' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[10px] font-mono px-1 rounded ${statusFilter === tab.id ? 'bg-white/20 text-white' : 'bg-white text-slate-700'}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* View Toggle */}
        <div className="flex bg-slate-100 p-0.5 rounded-lg shrink-0">
          <button 
            onClick={() => setView('table')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
              view === 'table' ? 'bg-white shadow-xs text-emerald-700' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>{t('leads.excelTable') || (language === 'ru' ? 'Excel таблица' : 'Excel Jadval')}</span>
          </button>
          <button 
            onClick={() => setView('kanban')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
              view === 'kanban' ? 'bg-white shadow-xs text-purple-600' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5 text-purple-500" />
            <span>{t('leads.kanban') || (language === 'ru' ? 'Канбан' : 'Kanban')}</span>
          </button>
        </div>
      </motion.div>

      {/* ─── Excel Table View ────────────────────────────────────────────── */}
      {view === 'table' && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col"
        >
          {/* Table Control Header */}
          <div className="bg-slate-50/90 border-b border-slate-200 px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-700 flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                {t('leads.leadsDataTable') || (language === 'ru' ? "Таблица данных лидов" : "Lidlar Ma'lumotlar Jadvali")}
              </span>
              <span className="text-slate-300">|</span>
              <span className="text-slate-500 text-[11px]">
                {language === 'ru' ? 'Показано: ' : language === 'en' ? 'Showing: ' : "Ko'rsatilyapti: "}<strong className="text-slate-800 font-mono">{filtered.length}</strong> {language === 'ru' ? 'строк' : language === 'en' ? 'rows' : 'ta qator'}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mr-1">
                {language === 'ru' ? 'РЕЖИМ: EXCEL ТАБЛИЦА' : language === 'en' ? 'GRID: EXCEL MODE' : 'GRID: EXCEL REJIM'}
              </span>
            </div>
          </div>

          {isLoading ? (
            <div className="p-6 space-y-2">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="h-10 bg-slate-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState 
              icon={<Target className="w-12 h-12 text-slate-300" />}
              title="Lidlar topilmadi" 
              description={search ? "Qidiruv so'zini o'zgartiring" : "Yangi lead qo'shing yoki CSV yuklang"}
              action={
                !search && (
                  <Button onClick={() => { setEditLead(null); setModalOpen(true); }} className="mt-3 bg-[#1499AD] text-white">
                    <UserPlus className="w-4 h-4 mr-2" /> Birinchi leadni qo'shish
                  </Button>
                )
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/90 text-slate-600 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider select-none">
                    <th className="py-2.5 px-3 w-12 text-center border-r border-slate-200/80">#</th>
                    <th className="py-2.5 px-3 min-w-[200px] border-r border-slate-200/80">{t('leads.clientPatientName') || (language === 'ru' ? 'Имя клиента / пациента' : 'Mijoz / Bemor Ismi')}</th>
                    <th className="py-2.5 px-3 min-w-[170px] whitespace-nowrap border-r border-slate-200/80">{t('leads.contactPhone') || (language === 'ru' ? 'Контакт (Телефон)' : 'Aloqa (Telefon)')}</th>
                    <th className="py-2.5 px-3 w-16 text-center whitespace-nowrap border-r border-slate-200/80">{t('leads.source') || (language === 'ru' ? 'Источник' : 'Manba')}</th>
                    <th className="py-2.5 px-3 min-w-[130px] whitespace-nowrap border-r border-slate-200/80">{t('leads.visitDateCol') || (language === 'ru' ? 'Дата обращения' : 'Tashrif Sanasi')}</th>
                    <th className="py-2.5 px-3 min-w-[240px] border-r border-slate-200/80">
                      <div className="flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
                        <span>{language === 'ru' ? 'Статус и Изox (Заметки)' : 'Status & Izoh (Qaydlar)'}</span>
                      </div>
                    </th>
                    <th className="py-2.5 px-3 text-center min-w-[140px]">{t('leads.actions') || (language === 'ru' ? 'Действия' : 'Amallar')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {filtered.map((l, index) => {
                    const initials = getInitials(l.name);
                    const notesList = parseLeadNotes(l);
                    const latestNote = notesList[0]?.text || l.notes;

                    return (
                      <tr 
                        key={l.id} 
                        onClick={() => setSelectedLead(l)}
                        className="hover:bg-sky-50/60 transition-colors cursor-pointer group odd:bg-white even:bg-slate-50/40"
                      >
                        {/* # */}
                        <td className="py-2.5 px-3 text-center font-mono text-[11px] font-bold text-slate-400 border-r border-slate-200/60 group-hover:text-slate-700">
                          {index + 1}
                        </td>

                        {/* Name */}
                        <td className="py-2.5 px-3 border-r border-slate-200/60">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0 border border-slate-300/70 shadow-2xs group-hover:scale-105 group-hover:border-purple-300 group-hover:bg-purple-50 group-hover:text-purple-700 transition-all">
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 text-[13px] leading-tight group-hover:text-purple-600 transition-colors truncate">
                                {l.name}
                              </p>
                              {l.interest && (
                                <p className="text-[10px] text-purple-600 font-semibold truncate mt-0.5">
                                  {l.interest}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Phone - STRICTLY NON-WRAPPING */}
                        <td className="py-2.5 px-3 whitespace-nowrap border-r border-slate-200/60">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[13px] font-bold text-slate-800 tracking-tight whitespace-nowrap">
                              {l.phone || '—'}
                            </span>
                            {l.phone && (
                              <button 
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(l.phone);
                                  toast.success(language === 'ru' ? 'Номер скопирован!' : 'Raqam nusxalandi!');
                                }}
                                className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-700 transition-opacity p-1 rounded hover:bg-slate-200/60"
                                title="Nusxalash"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Source with compact icon badge */}
                        <td className="py-2.5 px-3 text-center border-r border-slate-200/60">
                          <div className="flex items-center justify-center">
                            {renderSourceBadge(l.source)}
                          </div>
                        </td>

                        {/* Visit Date */}
                        <td className="py-2.5 px-3 whitespace-nowrap border-r border-slate-200/60">
                          <div className="flex items-center gap-1.5 text-slate-600 font-medium text-[11px]">
                            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{formatDate(l.visit_date || l.created_date)}</span>
                          </div>
                        </td>

                        {/* Status & Izoh (Qaydlar) */}
                        <td 
                          className="py-2.5 px-3 border-r border-slate-200/60"
                          onClick={(e) => {
                            e.stopPropagation();
                            setNotesModalLead(l);
                          }}
                        >
                          <div className="flex flex-col gap-1.5 min-w-[210px] group/izoh cursor-pointer">
                            <div className="flex items-center justify-between gap-1.5">
                              {renderStatusBadge(l.status)}
                              <button 
                                type="button" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setNotesModalLead(l);
                                }}
                                className="opacity-0 group-hover/izoh:opacity-100 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-all shadow-2xs"
                                title="Izoh yozish yoki ko'rish"
                              >
                                <Edit2 className="w-2.5 h-2.5" />
                                <span>Izoh yozish</span>
                              </button>
                            </div>

                            {/* Latest Note / Comment display */}
                            {latestNote ? (
                              <div 
                                className="flex items-start gap-1.5 text-[11px] font-semibold text-slate-700 bg-slate-50 hover:bg-indigo-50/80 hover:border-indigo-200 p-1.5 rounded-lg border border-slate-200/70 transition-all"
                                title={latestNote}
                              >
                                <MessageSquare className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                                <span className="truncate max-w-[210px]">
                                  {latestNote}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[10.5px] font-bold text-slate-400 group-hover/izoh:text-indigo-600 flex items-center gap-1 transition-colors">
                                <Plus className="w-3 h-3 text-slate-300 group-hover/izoh:text-indigo-500" /> Izoh qoldirish
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            {l.phone && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100/70 rounded-lg transition-all cursor-pointer"
                                onClick={() => window.open(`tel:${l.phone}`, '_self')}
                                title={language === 'ru' ? 'Позвонить' : "Qo'ng'iroq qilish"}
                              >
                                <Phone className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            {l.phone && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-sky-600 hover:text-sky-700 hover:bg-sky-100/70 rounded-lg transition-all cursor-pointer"
                                onClick={() => {
                                  const phone = l.phone?.replace(/\D/g, '');
                                  if (phone) window.open(`https://t.me/+${phone}`, '_blank');
                                }}
                                title={language === 'ru' ? 'Написать в Telegram' : 'Telegramda yozish'}
                              >
                                <Send className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-amber-600 hover:text-amber-700 hover:bg-amber-100/70 rounded-lg transition-all cursor-pointer"
                              onClick={() => { setEditLead(l); setModalOpen(true); }}
                              title={language === 'ru' ? 'Редактировать' : 'Tahrirlash'}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-rose-500 hover:text-rose-700 hover:bg-rose-100/70 rounded-lg transition-all cursor-pointer"
                              onClick={() => setDeleteId(l.id)}
                              title={language === 'ru' ? 'Удалить' : "O'chirish"}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Excel Status Bar Footer */}
          <div className="bg-slate-100/90 border-t border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between text-[11px] font-medium text-slate-600">
            <div className="flex items-center gap-4">
              <span>{language === 'ru' ? 'Всего строк: ' : 'Jami qatorlar: '}<strong className="text-slate-900 font-mono">{filtered.length}</strong></span>
              <span className="text-slate-300">|</span>
              <span>{language === 'ru' ? 'Новые: ' : 'Yangi: '}<strong className="text-blue-600 font-mono">{stats?.new || 0}</strong></span>
              <span>{language === 'ru' ? 'Связались: ' : 'Bog\'lanildi: '}<strong className="text-purple-600 font-mono">{stats?.contacted || 0}</strong></span>
              <span>{language === 'ru' ? 'Пациенты: ' : 'Bemor: '}<strong className="text-emerald-600 font-mono">{stats?.converted || 0}</strong></span>
            </div>
            <div className="text-slate-400 text-[10px] hidden sm:block">
              💡 {t('leads.hintClickRow') || (language === 'ru' ? 'Нажмите на строку для подробного просмотра или перевода в пациенты' : 'Qator ustiga bosib batafsil ko\'rish yoki bemorga o\'tkazish mumkin')}
            </div>
          </div>
        </motion.div>
      )}

      {/* ─── Kanban View ─────────────────────────────────────────────────── */}
      {view === 'kanban' && !isLoading && (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-6 custom-scrollbar min-h-[calc(100vh-380px)]">
            {columns.map(col => {
              const colLeads = filtered.filter(l => (l.status?.toLowerCase() || 'new') === col.id);
              
              return (
                <div key={col.id} className="flex-shrink-0 w-80 flex flex-col gap-3">
                  {/* Column Header */}
                  <div className="flex items-center justify-between px-3.5 py-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs sticky top-0 z-10">
                    <div className="flex items-center gap-2 group/header">
                      <Popover>
                        <PopoverTrigger asChild>
                          <button 
                            className={`w-4 h-4 rounded-full ${col.color} shadow-2xs hover:scale-125 transition-transform cursor-pointer border-2 border-white`}
                            title="Rangni o'zgartirish"
                          />
                        </PopoverTrigger>
                        <PopoverContent className="w-48 p-3 rounded-xl shadow-2xl border-slate-100">
                          <div className="grid grid-cols-4 gap-2">
                            {PREMIUM_COLORS.map((colorObj) => (
                              <button
                                key={colorObj.name}
                                onClick={() => updateColumnColor(col.id, colorObj)}
                                className={`w-7 h-7 rounded-full ${colorObj.name} ${col.color === colorObj.name ? 'ring-2 ring-offset-2 ring-slate-900 scale-110' : 'hover:scale-110'} transition-all`}
                              />
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                      {editingColId === col.id ? (
                        <Input 
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onBlur={() => updateColumnTitle(col.id, editingTitle)}
                          onKeyDown={(e) => e.key === 'Enter' && updateColumnTitle(col.id, editingTitle)}
                          autoFocus
                          className="h-7 py-0 px-2 text-xs font-bold w-28 rounded-lg border-purple-200"
                        />
                      ) : (
                        <div 
                           className="flex items-center gap-1.5 cursor-pointer" 
                           onClick={() => { setEditingColId(col.id); setEditingTitle(col.title); }}
                        >
                          <span className="text-xs font-bold text-slate-800 hover:text-purple-600 transition-colors uppercase tracking-tight">
                            {t(`leads.columns.${col.id}`) || col.title}
                          </span>
                          <Edit2 className="w-3 h-3 text-slate-300 opacity-0 group-hover/header:opacity-100 transition-opacity" />
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full font-mono">
                      {colLeads.length}
                    </span>
                  </div>

                  {/* Droppable Area */}
                  <Droppable droppableId={col.id}>
                    {(provided, snapshot) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className={`flex-1 flex flex-col gap-2.5 p-1 transition-colors rounded-2xl min-h-[160px] ${snapshot.isDraggingOver ? 'bg-slate-100/70 ring-2 ring-purple-200 ring-inset' : ''}`}
                      >
                        {colLeads.map((l, index) => {
                          const meta = getSourceMeta(l.source);
                          const SourceIcon = meta.icon;
                          return (
                            <Draggable key={l.id} draggableId={l.id} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  style={{
                                    ...provided.draggableProps.style,
                                    transform: snapshot.isDragging ? provided.draggableProps.style?.transform : 'none'
                                  }}
                                  className={`
                                    bg-white p-3.5 rounded-xl border 
                                    ${snapshot.isDragging ? 'border-purple-500 shadow-xl z-50 ring-4 ring-purple-500/10' : 'border-slate-200/80 shadow-2xs hover:border-purple-300 hover:shadow-xs'} 
                                    transition-all group cursor-grab active:cursor-grabbing
                                  `}
                                  onClick={() => setSelectedLead(l)}
                                >
                                  <div className="flex items-start justify-between gap-2 mb-2.5">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-2xs ${meta.iconBg}`}>
                                        <SourceIcon className="w-3.5 h-3.5" />
                                      </div>
                                      <div className="min-w-0">
                                        <p className="font-bold text-slate-900 leading-tight group-hover:text-purple-600 transition-colors uppercase text-xs truncate">
                                          {l.name}
                                        </p>
                                        <p className="text-[11px] font-mono font-bold text-slate-600 flex items-center gap-1 mt-0.5 whitespace-nowrap">
                                          <Phone className="w-2.5 h-2.5 text-emerald-500 shrink-0" /> {l.phone}
                                        </p>
                                      </div>
                                    </div>
                                    <button 
                                      className="p-1 hover:bg-rose-50 rounded-md text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                                      onClick={(e) => { e.stopPropagation(); setDeleteId(l.id); }}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                  
                                  {l.notes && (
                                    <div 
                                      className="mb-2.5 cursor-pointer group/knote"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setNotesModalLead(l);
                                      }}
                                    >
                                      <p className="text-[11px] text-slate-600 line-clamp-2 bg-slate-50 hover:bg-indigo-50/80 p-2 rounded-lg border border-slate-100 hover:border-indigo-200 transition-all flex items-start gap-1.5">
                                        <MessageSquare className="w-3 h-3 text-indigo-600 shrink-0 mt-0.5" />
                                        <span>{l.notes}</span>
                                      </p>
                                    </div>
                                  )}

                                  <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10px]">
                                    <span className="text-slate-400 font-medium">
                                      {formatDate(l.created_date || l.visit_date)}
                                    </span>
                                    <div className="flex items-center gap-1">
                                      <button 
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setNotesModalLead(l);
                                        }}
                                        className="w-7 h-7 flex items-center justify-center bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors"
                                        title="Izoh va qaydlar"
                                      >
                                        <MessageSquare className="w-3.5 h-3.5" />
                                      </button>
                                      {l.phone && (
                                        <button 
                                          className="w-7 h-7 flex items-center justify-center bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                                          onClick={(e) => { e.stopPropagation(); window.open(`tel:${l.phone}`, '_self'); }}
                                          title="Qo'ng'iroq"
                                        >
                                          <Phone className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          );
                        })}
                        {provided.placeholder}
                        
                        {colLeads.length === 0 && (
                          <div className="border border-dashed border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center text-center">
                            <Target className="w-5 h-5 text-slate-300 mb-1" />
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('common.noData') || "Bo'sh"}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      )}

      {/* ─── Add/Edit Modal ──────────────────────────────────────────────── */}
      <Dialog open={modalOpen} onOpenChange={() => { setModalOpen(false); setEditLead(null); }}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center">
                <Target className="w-4 h-4" />
              </div>
              <span>{editLead ? (t('leads.editLead') || "Lead tahrirlash") : (t('leads.newLeadModalTitle') || "Yangi lead qo'shish")}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3.5 mt-3 text-xs">
            <div>
              <Label className="text-xs font-bold text-slate-700">{t('common.name') || 'Ism va Familiya'} *</Label>
              <Input 
                value={form.name} 
                onChange={e => setForm({ ...form, name: e.target.value })} 
                className="mt-1 h-9 rounded-lg border-slate-200 focus:border-purple-500 text-xs"
                placeholder={t('common.name') || "Masalan: Alisher Vohidov"}
              />
            </div>
            <div>
              <Label className="text-xs font-bold text-slate-700">{t('common.phone') || 'Telefon raqami'} *</Label>
              <Input 
                value={form.phone} 
                onChange={e => setForm({ ...form, phone: e.target.value })} 
                className="mt-1 h-9 rounded-lg border-slate-200 focus:border-purple-500 font-mono text-xs"
                placeholder="+998 90 123 45 67"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold text-slate-700">{t('leads.visitDate') || 'Tashrif sanasi'}</Label>
                <Input 
                  type="date" 
                  value={form.visit_date} 
                  onChange={e => setForm({ ...form, visit_date: e.target.value })} 
                  className="mt-1 h-9 rounded-lg border-slate-200 focus:border-purple-500 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs font-bold text-slate-700">{t('leads.source') || 'Manba'}</Label>
                <Select value={form.source} onValueChange={v => setForm({ ...form, source: v })}>
                  <SelectTrigger className="mt-1 h-9 rounded-lg border-slate-200 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[
                      { value: 'Instagram', label: 'Instagram', icon: Instagram, color: 'text-pink-500' },
                      { value: 'Telegram', label: 'Telegram', icon: Send, color: 'text-sky-500' },
                      { value: 'Facebook', label: 'Facebook', icon: Facebook, color: 'text-blue-500' },
                      { value: 'Call', label: 'Telefon (Call)', icon: Phone, color: 'text-emerald-500' },
                      { value: 'Website', label: 'Veb-sayt', icon: Globe, color: 'text-indigo-500' },
                      { value: 'Import', label: 'Excel Import', icon: FileSpreadsheet, color: 'text-teal-600' },
                      { value: 'Other', label: 'Boshqa', icon: Target, color: 'text-slate-500' }
                    ].map(item => {
                      const Icon = item.icon;
                      return (
                        <SelectItem key={item.value} value={item.value}>
                          <div className="flex items-center gap-2">
                            <Icon className={`w-3.5 h-3.5 ${item.color}`} />
                            <span>{item.label}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs font-bold text-slate-700">Status</Label>
              <Select value={form.status?.toLowerCase()} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger className="mt-1 h-9 rounded-lg border-slate-200 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[
                    { id: 'new', label: 'Yangi' },
                    { id: 'contacted', label: 'Bog\'lanildi' },
                    { id: 'qualified', label: 'Qiziqqan' },
                    { id: 'converted', label: 'Bemor (Konvertatsiya)' },
                    { id: 'lost', label: 'Rad etilgan' }
                  ].map(s => (
                    <SelectItem key={s.id} value={s.id} className="text-xs font-semibold">{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-bold text-slate-700">{t('common.notes') || 'Izohlar'}</Label>
              <Textarea 
                value={form.notes} 
                onChange={e => setForm({ ...form, notes: e.target.value })} 
                rows={2}
                className="mt-1 rounded-lg border-slate-200 focus:border-purple-500 text-xs"
                placeholder={t('leads.notesPlaceholder') || "Qo'shimcha ma'lumotlar..."}
              />
            </div>

            {/* Custom Ad Form Questions */}
            {editLead?.form_data && Object.keys(editLead.form_data).length > 0 && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 mt-2">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-3.5 h-3.5 text-purple-600" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">{t('leads.fbFormResponses') || 'Target Form Javoblari'}</span>
                </div>
                <div className="space-y-2">
                  {Object.entries(editLead.form_data).map(([question, answer], idx) => (
                    <div key={idx} className="space-y-0.5">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{question.replace(/_/g, ' ')}</p>
                      <p className="text-xs font-semibold text-slate-900">{answer}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => { setModalOpen(false); setEditLead(null); }}
                className="rounded-lg text-xs"
              >
                {t('common.cancel') || 'Bekor qilish'}
              </Button>
              <Button 
                size="sm"
                onClick={handleSave} 
                disabled={saveMutation.isPending || !form.name || !form.phone} 
                className="bg-[#1499AD] hover:bg-[#0E7A8A] text-white rounded-lg text-xs font-bold px-4"
              >
                {saveMutation.isPending ? 'Saqlanmoqda...' : 'Saqlash'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation ─────────────────────────────────────────── */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold">{t('leads.deleteConfirmTitle') || (language === 'ru' ? 'Удалить лид' : "Leadni o'chirish")}</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              {t('leads.deleteConfirmDesc') || (language === 'ru' ? 'Вы действительно хотите удалить этот лид? Это действие необратимо.' : 'Haqiqatan ham bu leadni o\'chirmoqchimisiz? Ushbu amalni qaytarib bo\'lmaydi.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg text-xs">{t('common.cancel') || (language === 'ru' ? 'Отмена' : 'Bekor qilish')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold">
              {t('leads.deleteBtn') || (language === 'ru' ? 'Удалить' : "O'chirish")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Quick View Modal ────────────────────────────────────────────── */}
      <LeadQuickView 
        lead={selectedLead} 
        isOpen={!!selectedLead} 
        onClose={() => setSelectedLead(null)} 
      />

      {/* ─── Interactive Notes & Follow-up History Modal ─────────────────── */}
      <LeadNotesModal
        lead={notesModalLead}
        open={!!notesModalLead}
        onClose={() => setNotesModalLead(null)}
        onSaveLead={async (id, data) => {
          await updateMutation.mutateAsync({ id, data });
          setNotesModalLead(prev => prev ? { ...prev, ...data } : null);
        }}
        onConvertToPatient={handleConvertToPatient}
      />
    </div>
  );
}
