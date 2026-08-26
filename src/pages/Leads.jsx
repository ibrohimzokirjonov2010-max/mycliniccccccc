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
import StatusBadge from '../components/ui/StatusBadge';
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
import { useRef, useState, useEffect } from 'react';
import { Search, Phone, Edit2, Trash2, MessageCircle, TrendingUp, Target, Calendar, UserPlus, Filter, Zap, Upload, Bell } from 'lucide-react';

export default function Leads() {
  const { t, currentLanguage } = useTranslation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editLead, setEditLead] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [view, setView] = useState('kanban');
  const [form, setForm] = useState({ name: '', phone: '', visit_date: '', source: 'Call', status: 'new', notes: '' });
  const [selectedLead, setSelectedLead] = useState(null);
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
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  // ─── Queries ──────────────────────────────────────────────────────────
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads', debouncedSearch],
    queryFn: async () => {
      if (debouncedSearch) return await base44.entities.Lead.search(debouncedSearch, 100);
      return await base44.entities.Lead.list('-created_date', 100);
    },
    staleTime: 30000,
  });

  const filtered = leads;

  const { data: stats } = useQuery({
    queryKey: ['leads-stats', leads],
    queryFn: () => {
      const total = leads.length;
      const newLeads = leads.filter(l => l.status?.toLowerCase() === 'new').length;
      const contacted = leads.filter(l => l.status?.toLowerCase() === 'contacted').length;
      const converted = leads.filter(l => l.status?.toLowerCase() === 'converted').length;
      return { total, new: newLeads, contacted, converted };
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
      queryClient.setQueryData(['leads'], context.previousLeads);
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

  useEffect(() => {
    if (editLead) {
      setForm({ 
        name: editLead.name || '', 
        phone: editLead.phone || '', 
        visit_date: editLead.visit_date || '', 
        source: editLead.source || 'Call', 
        status: editLead.status || 'New', 
        notes: editLead.notes || '' 
      });
    } else {
      setForm({ name: '', phone: '', visit_date: '', source: 'Call', status: 'New', notes: '' });
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
    const localeStr = currentLanguage === 'uz' ? 'uz-UZ' : currentLanguage === 'ru' ? 'ru-RU' : 'en-US';
    return date.toLocaleDateString(localeStr, { day: 'numeric', month: 'long', year: 'numeric' });
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

  const getSourceIcon = (source) => {
    switch(source) {
      case 'Telegram': return '💬';
      case 'Instagram': return '📷';
      case 'Website': return '🌐';
      case 'Call': return '📞';
      default: return '📋';
    }
  };

  const getStatusColor = (status) => {
    const s = status?.toLowerCase();
    switch(s) {
      case 'new': return 'from-blue-500 to-cyan-500';
      case 'contacted': return 'from-purple-500 to-pink-500';
      case 'interested': return 'from-amber-500 to-orange-500';
      case 'converted': return 'from-emerald-500 to-green-500';
      case 'lost': return 'from-slate-400 to-gray-500';
      default: return 'from-blue-500 to-indigo-500';
    }
  };

  const updateLeadStatus = async (leadId, newStatus) => {
    try {
      await base44.entities.Lead.update(leadId, { status: newStatus.toLowerCase() });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    } catch (error) {
      console.error('Update status error:', error);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        // Oddiy CSV parser (ismlar, telefonlar)
        const rows = text.split('\n').map(row => row.trim()).filter(row => row);
        if (rows.length < 2) return toast.error("Fayl bo'sh kompyuterga oxshaydi");
        
        const headers = rows[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
        
        // Ism va telefon uchun ruscha, inglizcha va o'zbekcha so'zlarni qidirish
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
         if (fileInputRef.current) fileInputRef.current.value = ''; // Qayta tozalash
      }
    };
    reader.readAsText(file);
  };

  const columns = kanbanColumns;

  return (
    <div className="space-y-3">
      {/* Header Section */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col lg:flex-row lg:items-center justify-between gap-3"
      >
        <div>
          <h1 className="text-xl premium-title">
            {t('leads.title') || 'Lidlar'}
          </h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-0.5 ml-1">{t('leads.subtitle') || 'Potentsial bemorlar va ularni boshqarish'}</p>
        </div>
        <div className="flex items-center gap-3">
          <input 
            type="file" 
            accept=".csv" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            className="hidden" 
          />
          <Button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="bg-white border-2 border-purple-200 text-purple-600 hover:bg-purple-50 shadow-sm rounded-2xl h-14 px-6 font-black uppercase tracking-widest text-[10px]"
          >
            <Upload className="w-4 h-4 mr-2" /> 
            {isImporting ? t('common.saving') || 'Yuklanmoqda...' : t('leads.csvImport') || 'CSV Import'}
          </Button>

          <Button 
            className="bg-[#0088cc] hover:bg-[#0077b5] text-white shadow-lg shadow-blue-500/20 rounded-2xl h-14 px-6 font-black uppercase tracking-widest text-[10px] border-none"
            asChild
          >
            <a href={`https://t.me/${botUsername}?start=admin_${clinicId}`} target="_blank" rel="noopener noreferrer">
              <Bell className="w-4 h-4 mr-2" /> {t('leads.telegramNotification') || 'Telegram bildirishnoma'}
            </a>
          </Button>

          <Button 
            onClick={() => { setEditLead(null); setModalOpen(true); }}
            className="bg-[#1499AD] hover:bg-[#0E7A8A] text-white shadow-lg shadow-[#1499AD]/20 rounded-2xl h-14 px-8 font-black uppercase tracking-widest text-xs border-none"
          >
            <UserPlus className="w-4 h-4 mr-2" /> {t('leads.newLead') || 'Yangi lead'}
          </Button>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold text-blue-900 mt-1">{stats?.total || 0}</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg">
              <Target className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-purple-600 uppercase tracking-wider">
                {t('leads.columns.new') || kanbanColumns.find(c => c.id === 'new')?.title || 'Yangi'}
              </p>
              <p className="text-3xl font-bold text-purple-900 mt-1">{stats?.new || 0}</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg">
              <Zap className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">
                {t('leads.columns.contacted') || kanbanColumns.find(c => c.id === 'contacted')?.title || 'Bog\'lanildi'}
              </p>
              <p className="text-3xl font-bold text-amber-900 mt-1">{stats?.contacted || 0}</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center shadow-lg">
              <Phone className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
                {t('leads.columns.converted') || kanbanColumns.find(c => c.id === 'converted')?.title || 'Konvertatsiya'}
              </p>
              <p className="text-3xl font-bold text-emerald-900 mt-1">{stats?.converted || 0}</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-green-500 rounded-xl flex items-center justify-center shadow-lg">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
      </motion.div>

      {/* View Toggle */}
      <div className="flex items-center justify-between pb-2">
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button 
            onClick={() => setView('kanban')}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${view === 'kanban' ? 'bg-white shadow-md text-purple-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            📋 {t('leads.viewKanban') || 'Kanban'}
          </button>
          <button 
            onClick={() => setView('table')}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${view === 'table' ? 'bg-white shadow-md text-purple-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            📑 {t('leads.viewTable') || 'Jadval'}
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex flex-col sm:flex-row gap-3"
      >
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input 
            placeholder={t('leads.searchPlaceholder') || "Ism yoki telefon raqami bo'yicha qidirish..."} 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            className="pl-12 h-12 rounded-xl border-2 focus:border-purple-500 transition-colors" 
          />
        </div>
        <Button variant="outline" className="h-12 rounded-xl border-2">
          <Filter className="w-4 h-4 mr-2" /> {t('common.filter') || 'Filtr'}
        </Button>
      </motion.div>

      {/* Content Section */}
      {view === 'kanban' && !isLoading && (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-6 overflow-x-auto pb-8 custom-scrollbar min-h-[calc(100vh-400px)]">
            {columns.map(col => {
              const colLeads = filtered.filter(l => (l.status?.toLowerCase() || 'new') === col.id);
              
              return (
                <div key={col.id} className="flex-shrink-0 w-80 flex flex-col gap-4">
                  {/* Column Header */}
                  <div className="flex items-center justify-between px-4 py-3 bg-white/50 backdrop-blur-sm rounded-2xl border-2 border-slate-100 shadow-sm sticky top-0 z-10">
                    <div className="flex items-center gap-2 group/header">
                      <Popover>
                        <PopoverTrigger asChild>
                          <button 
                            className={`w-5 h-5 rounded-full ${col.color} shadow-sm hover:scale-125 transition-transform cursor-pointer border-2 border-white`}
                            title="Rangni o'zgartirish"
                          />
                        </PopoverTrigger>
                        <PopoverContent className="w-48 p-3 rounded-2xl shadow-2xl border-slate-100">
                          <div className="grid grid-cols-4 gap-2">
                            {PREMIUM_COLORS.map((colorObj) => (
                              <button
                                key={colorObj.name}
                                onClick={() => updateColumnColor(col.id, colorObj)}
                                className={`w-8 h-8 rounded-full ${colorObj.name} ${col.color === colorObj.name ? 'ring-2 ring-offset-2 ring-slate-900 scale-110' : 'hover:scale-110'} transition-all`}
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
                          className="h-7 py-0 px-2 text-sm font-bold w-32 rounded-lg border-purple-200"
                        />
                      ) : (
                        <div 
                           className="flex items-center gap-1.5 cursor-pointer" 
                           onClick={() => { setEditingColId(col.id); setEditingTitle(col.title); }}
                        >
                          <span className="text-sm font-bold text-slate-700 hover:text-purple-600 transition-colors uppercase tracking-tight">{t(`leads.columns.${col.id}`) || col.title}</span>
                          <Edit2 className="w-3 h-3 text-slate-300 opacity-0 group-hover/header:opacity-100 transition-opacity" />
                        </div>
                      )}
                    </div>
                    <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
                      {colLeads.length}
                    </span>
                  </div>

                  {/* Droppable Area */}
                  <Droppable droppableId={col.id}>
                    {(provided, snapshot) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className={`flex-1 flex flex-col gap-3 p-1 transition-colors rounded-3xl min-h-[200px] ${snapshot.isDraggingOver ? 'bg-slate-50/50 ring-2 ring-purple-100 ring-inset' : ''}`}
                      >
                        {colLeads.map((l, index) => (
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
                                  bg-white p-5 rounded-2xl border-2 
                                  ${snapshot.isDragging ? 'border-purple-500 shadow-2xl z-50 ring-4 ring-purple-500/10' : 'border-slate-100 shadow-sm hover:border-purple-200 hover:shadow-md'} 
                                  transition-all group cursor-grab active:cursor-grabbing
                                `}
                                onClick={() => setSelectedLead(l)}
                              >
                                <div className="flex items-start justify-between mb-4">
                                  <div className="flex items-center gap-2">
                                    <span className="text-2xl bg-slate-50 w-10 h-10 flex items-center justify-center rounded-xl border border-slate-100 group-hover:scale-110 transition-transform">
                                      {getSourceIcon(l.source)}
                                    </span>
                                    <div>
                                      <p className="font-bold text-slate-900 leading-tight group-hover:text-purple-600 transition-colors uppercase text-sm">{l.name}</p>
                                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mt-0.5">
                                        <Phone className="w-3 h-3 text-emerald-500" /> {l.phone}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                      className="p-2 hover:bg-red-50 rounded-xl text-slate-300 hover:text-red-500 transition-colors"
                                      onClick={(e) => { e.stopPropagation(); setDeleteId(l.id); }}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                                
                                {l.notes && (
                                  <div className="relative mb-4">
                                    <p className="text-[12px] text-slate-500 line-clamp-2 italic bg-slate-50 p-3 rounded-xl border border-slate-100/50">
                                      "{l.notes}"
                                    </p>
                                  </div>
                                )}

                                <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                                  <div className="flex flex-col">
                                    <span className="text-[8px] font-black text-slate-300 uppercase tracking-[0.2em] mb-0.5">{t('leads.created') || 'Yaratildi'}</span>
                                    <span className="text-[10px] font-bold text-slate-500">
                                      {formatDate(l.created_date || l.visit_date)}
                                    </span>
                                  </div>
                                  <div className="flex gap-2">
                                    <button 
                                      className="w-9 h-9 flex items-center justify-center bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-500/20 hover:scale-110 transition-transform"
                                      onClick={(e) => { e.stopPropagation(); window.open(`tel:${l.phone}`, '_self'); }}
                                    >
                                      <Phone className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                        
                        {colLeads.length === 0 && (
                          <div className="border-2 border-dashed border-slate-100 rounded-3xl p-8 flex flex-col items-center justify-center text-center">
                            <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mb-2">
                              <Target className="w-6 h-6 text-slate-200" />
                            </div>
                              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{t('common.noData') || "Ma'lumot yo'q"}</p>
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

      {(view === 'table' || isLoading) && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl border-2 border-slate-200 shadow-lg overflow-hidden"
        >
        {isLoading ? (
          <div className="p-8 space-y-4">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState 
            icon={<Target className="w-16 h-16" />}
            title="Lead topilmadi" 
            description={search ? "Qidiruv so'zini o'zgartiring" : "Yangi lead qo'shing"}
            action={
              !search && (
                <Button onClick={() => { setEditLead(null); setModalOpen(true); }} className="mt-4">
                  <UserPlus className="w-4 h-4 mr-2" /> Birinchi leadni qo'shish
                </Button>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-slate-200 bg-gradient-to-r from-slate-50 to-purple-50">
                  <th className="text-left text-xs font-bold text-slate-600 uppercase tracking-wider px-6 py-4">Ism</th>
                  <th className="text-left text-xs font-bold text-slate-600 uppercase tracking-wider px-6 py-4 hidden md:table-cell">Aloqa</th>
                  <th className="text-left text-xs font-bold text-slate-600 uppercase tracking-wider px-6 py-4 hidden lg:table-cell">Tashrif sanasi</th>
                  <th className="text-left text-xs font-bold text-slate-600 uppercase tracking-wider px-6 py-4">Manba</th>
                  <th className="text-left text-xs font-bold text-slate-600 uppercase tracking-wider px-6 py-4">Status</th>
                  <th className="text-right text-xs font-bold text-slate-600 uppercase tracking-wider px-6 py-4">Amallar</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {filtered.map((l, index) => (
                    <motion.tr 
                      key={l.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ delay: Math.min(index, 6) * 0.02 }}
                      className="border-b border-slate-100 last:border-0 hover:bg-gradient-to-r hover:from-purple-50/50 hover:to-pink-50/50 cursor-pointer transition-all group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 bg-gradient-to-br ${getStatusColor(l.status)} rounded-full flex items-center justify-center text-xl flex-shrink-0 shadow-md group-hover:scale-110 transition-transform`}>
                            {getSourceIcon(l.source)}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{l.name}</p>
                            {l.notes && (
                              <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{l.notes}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 hidden md:table-cell">
                        <div className="space-y-1">
                          {l.phone && (
                            <p className="text-sm text-slate-700 font-medium flex items-center gap-2">
                              <Phone className="w-3.5 h-3.5 text-purple-500" /> {l.phone}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 hidden lg:table-cell">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          {formatDate(l.visit_date)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={l.source} type="source" />
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={l.status} />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-9 w-9 text-green-600 hover:text-green-700 hover:bg-green-100 rounded-lg transition-all" 
                            onClick={() => window.open(`tel:${l.phone}`, '_self')}
                            title="Qo'ng'iroq qilish"
                          >
                            <Phone className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-9 w-9 text-blue-500 hover:text-blue-600 hover:bg-blue-100 rounded-lg transition-all" 
                            onClick={() => {
                              const phone = l.phone?.replace(/\D/g, '');
                              if (phone) {
                                window.open(`https://t.me/+${phone}`, '_blank');
                              }
                            }}
                            title="Telegramda yozish"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-9 w-9 text-amber-600 hover:text-amber-700 hover:bg-amber-100 rounded-lg transition-all" 
                            onClick={() => { setEditLead(l); setModalOpen(true); }}
                            title="Tahrirlash"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-9 w-9 text-red-600 hover:text-red-700 hover:bg-red-100 rounded-lg transition-all" 
                            onClick={() => setDeleteId(l.id)}
                            title="O'chirish"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    )}

      {/* Add/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={() => { setModalOpen(false); setEditLead(null); }}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              {editLead ? t('leads.editLead') || "Lead tahrirlash" : t('leads.newLeadModalTitle') || "Yangi lead qo'shish"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label className="text-sm font-semibold">{t('common.name') || 'Ism'} *</Label>
              <Input 
                value={form.name} 
                onChange={e => setForm({ ...form, name: e.target.value })} 
                className="mt-1.5 h-11 rounded-xl border-2 focus:border-purple-500"
                placeholder={t('common.name') || "Bemor ismi"}
              />
            </div>
            <div>
              <Label className="text-sm font-semibold">{t('common.phone') || 'Telefon'} *</Label>
              <Input 
                value={form.phone} 
                onChange={e => setForm({ ...form, phone: e.target.value })} 
                className="mt-1.5 h-11 rounded-xl border-2 focus:border-purple-500"
                placeholder="+998 XX XXX XX XX"
              />
            </div>
            <div>
              <Label className="text-sm font-semibold">{t('leads.visitDate') || 'Tashrif sanasi'}</Label>
              <Input 
                type="date" 
                value={form.visit_date} 
                onChange={e => setForm({ ...form, visit_date: e.target.value })} 
                className="mt-1.5 h-11 rounded-xl border-2 focus:border-purple-500"
              />
            </div>
            <div>
              <Label className="text-sm font-semibold">{t('leads.source') || 'Manba'}</Label>
              <Select value={form.source} onValueChange={v => setForm({ ...form, source: v })}>
                <SelectTrigger className="mt-1.5 h-11 rounded-xl border-2"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Telegram', 'Instagram', 'Website', 'Call', 'Other'].map(s => (
                    <SelectItem key={s} value={s}>{getSourceIcon(s)} {s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-semibold">Status</Label>
              <Select value={form.status?.toLowerCase()} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger className="mt-1.5 h-11 rounded-xl border-2"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['new', 'contacted', 'qualified', 'converted', 'lost'].map(s => (
                    <SelectItem key={s} value={s} className="uppercase text-xs font-bold tracking-widest">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-semibold">{t('common.notes') || 'Izohlar'}</Label>
              <Textarea 
                value={form.notes} 
                onChange={e => setForm({ ...form, notes: e.target.value })} 
                rows={3}
                className="mt-1.5 rounded-xl border-2 focus:border-purple-500"
                placeholder={t('leads.notesPlaceholder') || "Qo'shimcha ma'lumotlar..."}
              />
            </div>

            {/* Custom Ad Form Questions */}
            {editLead?.form_data && Object.keys(editLead.form_data).length > 0 && (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 mt-2">
                <div className="flex items-center gap-2 mb-3">
                  <Target className="w-4 h-4 text-purple-500" />
                  <span className="text-xs font-black uppercase tracking-widest text-slate-700">{t('leads.fbFormResponses') || 'Facebook Form Javoblari'}</span>
                </div>
                <div className="space-y-3">
                  {Object.entries(editLead.form_data).map(([question, answer], idx) => (
                    <div key={idx} className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{question.replace(/_/g, ' ')}</p>
                      <p className="text-sm font-semibold text-slate-900">{answer}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-4">
              <Button 
                variant="outline" 
                onClick={() => { setModalOpen(false); setEditLead(null); }}
                className="rounded-xl"
              >
                {t('common.cancel') || 'Bekor qilish'}
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={saveMutation.isPending || !form.name || !form.phone} 
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-xl"
              >
                {saveMutation.isPending ? t('common.saving') || 'Saqlanmoqda...' : t('common.save') || 'Saqlash'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">Leadni o'chirish</AlertDialogTitle>
            <AlertDialogDescription>Haqiqatan ham bu leadni o'chirmoqchimisiz? Bu amalni qaytarib bo'lmaydi.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Bekor qilish</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 rounded-xl">O'chirish</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <LeadQuickView 
        lead={selectedLead} 
        isOpen={!!selectedLead} 
        onClose={() => setSelectedLead(null)} 
      />
    </div>
  );
}
