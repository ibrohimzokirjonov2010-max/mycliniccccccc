import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Plus, Search, Stethoscope, Edit2, Trash2, Clock, 
  Activity, Scissors, Layers, Baby, Syringe, 
  Sparkles, Filter, TrendingUp, DollarSign, ListFilter,
  BarChart3, Settings2, CheckCircle2, ChevronRight, Pencil, Check, GripVertical
} from 'lucide-react';
import { cn, cn as classNames } from '@/lib/utils';
import { base44, DEFAULT_SERVICES_DATA } from '@/api/base44Client';
import { useTranslation } from '@/i18n/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Reorder } from 'framer-motion';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const DEFAULT_CATEGORIES = [
  'TERAPIYA (ENDO + PLOMBA)',
  'RESTAVRATSIYA',
  'ORTOPEDIYA',
  'XIRURGIYA',
  'ORTODONTIYA',
  'GIGIENA VA PROFILAKTIKA',
  'ESTETIK STOMATOLOGIYA',
  'BOLALAR STOMATOLOGIYASI',
  'IMPLANTATSIYA',
  'ENDODONTIYA'
];

const CATEGORY_MAP = {
  'TERAPIYA (ENDO + PLOMBA)': { icon: Activity, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
  'TERAPIYA( ENDO +PLOMBA)': { icon: Activity, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
  'RESTAVRATSIYA': { icon: Sparkles, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
  'XIRURGIYA': { icon: Scissors, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100' },
  'ORTOPEDIYA': { icon: Layers, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100' },
  'ORTODONTIYA': { icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
  'GIGIENA VA PROFILAKTIKA': { icon: Sparkles, color: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-100' },
  'ESTETIK STOMATOLOGIYA': { icon: Sparkles, color: 'text-pink-600', bg: 'bg-pink-50', border: 'border-pink-100' },
  'BOLALAR STOMATOLOGIYASI': { icon: Baby, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100' },
  'IMPLANTATSIYA': { icon: Syringe, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100' },
  'ENDODONTIYA': { icon: Activity, color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-100' }
};

const getCategoryStyle = (cat) => CATEGORY_MAP[cat] || CATEGORY_MAP['TERAPIYA (ENDO + PLOMBA)'] || { icon: Activity, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100' };

const autoCategorize = (name) => {
  const n = name?.toLowerCase() || '';
  if (n.includes('implant')) return 'IMPLANTATSIYA';
  if (n.includes('bolalar') || n.includes('child')) return 'BOLALAR STOMATOLOGIYASI';
  if (n.includes('gigiyena') || n.includes('profilaktika') || n.includes('toshlarni') || n.includes('skaler')) return 'GIGIENA VA PROFILAKTIKA';
  if (n.includes('vinir') || n.includes('oqartirish') || n.includes('bleaching') || n.includes('estetik')) return 'ESTETIK STOMATOLOGIYA';
  if (n.includes('endo') || n.includes('kanal')) return 'ENDODONTIYA';
  if (n.includes('olish') || n.includes('sug\'urish') || n.includes('xirurg') || n.includes('anesteziya')) return 'XIRURGIYA';
  if (n.includes('karonka') || n.includes('protez') || n.includes('sirkoniy') || n.includes('ko\'prik')) return 'ORTOPEDIYA';
  if (n.includes('breket') || n.includes('reteyner') || n.includes('plastinka') || n.includes('ortodont')) return 'ORTODONTIYA';
  return 'TERAPIYA (ENDO + PLOMBA)';
};

// ─── Tish tugmasi ─────────────────────────────────────────────────────────────
function ToothButton({ num, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`Tish ${num}`}
      className={classNames(
        "w-6.5 h-7.5 sm:w-7 sm:h-8 rounded-md text-[10px] font-bold transition-all border flex flex-col items-center justify-center cursor-pointer select-none active:scale-95",
        selected
          ? "bg-[#1499AD] border-[#1499AD] text-white shadow-xs scale-105 z-10"
          : "bg-white border-slate-200 text-slate-700 hover:border-[#1499AD]/60 hover:text-[#1499AD] hover:bg-[#1499AD]/5"
      )}
    >
      <span className="leading-none">{num}</span>
    </button>
  );
}

// ─── Xizmat kartochkasi kontent ───────────────────────────────────────────────
function ServiceCardContent({ service: s, isOverlay = false, onEdit, onDelete, onView }) {
  const { t } = useTranslation();
  return (
    <div
      className={classNames(
        "group relative bg-white rounded-2xl border p-4 shadow-sm overflow-hidden select-none w-full h-full",
        isOverlay
          ? "border-[#1499AD]/60 shadow-2xl rotate-1 scale-[1.04] cursor-grabbing ring-2 ring-[#1499AD]/30"
          : "border-slate-100"
      )}
      onClick={() => !isOverlay && onView?.()}
    >
      {/* Drag belgisi — overlay da ko'rinmaydi */}
      {!isOverlay && (
        <div className="absolute top-2.5 left-1/2 -translate-x-1/2 flex gap-[3px] opacity-0 group-hover:opacity-30 transition-opacity pointer-events-none">
          {[0,1,2,3,4,5].map(i => <div key={i} className="w-1 h-1 rounded-full bg-slate-500" />)}
        </div>
      )}

      {/* Edit / Delete tugmalari — SortableServiceCard da boshqariladi */}

      <div className="space-y-5 relative z-10 mt-2">
        <div>
          <h3 className={classNames("text-lg font-bold leading-tight line-clamp-2",
            isOverlay ? "text-[#1499AD]" : "text-slate-900 group-hover:text-[#1499AD] transition-colors"
          )}>{s.name}</h3>
          <p className="text-slate-400 text-[10px] font-medium mt-1 uppercase tracking-tight">{s.category}</p>
        </div>
        <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('services.price') || 'NARXI'}</p>
            <p className="text-xl font-bold text-slate-900 tracking-tight">
              {(Number(s.price) || 0).toLocaleString()}
              <span className="text-[10px] font-bold text-slate-300 ml-1">UZS</span>
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">
              <Clock className="w-3 h-3" />{s.duration} min
            </div>
            <Badge className={s.is_active !== false
              ? 'bg-emerald-50 text-emerald-600 border-none text-[9px] px-2 py-0'
              : 'bg-slate-100 text-slate-400 border-none text-[9px] px-2 py-0'}>
              {s.is_active !== false ? (t('services.active') || 'FAOL') : (t('services.inactive') || 'NOFAOL')}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sortable wrapper ─────────────────────────────────────────────────────────
function SortableServiceCard({ service, onView, onEdit, onDelete, isDragging, isReorderMode }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isSorting,
  } = useSortable({ id: service.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition,
    opacity: isDragging ? 0.85 : 1,
    touchAction: 'none',
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={classNames(
        "group relative rounded-[32px]",
        isReorderMode
          ? "ring-2 ring-emerald-400/60 ring-offset-2 cursor-grab active:cursor-grabbing shadow-lg shadow-emerald-100"
          : "hover:shadow-xl hover:-translate-y-1 cursor-pointer transition-all duration-350 ease-out",
        isDragging && "shadow-2xl scale-[1.03] ring-2 ring-[#1499AD]/40 border-[#1499AD]/60 cursor-grabbing pointer-events-none"
      )}
    >
      {/* Drag overlay — faqat reorder rejimida */}
      {isReorderMode && (
        <div
          {...attributes}
          {...listeners}
          className="absolute inset-0 rounded-[32px] z-10 cursor-grab active:cursor-grabbing"
        />
      )}

      {/* Reorder rejim ko'rsatkichi */}
      {isReorderMode && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 flex gap-[3px] pointer-events-none">
          {[0,1,2,3,4,5].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-emerald-400" />)}
        </div>
      )}

      {/* Kartochka kontent */}
      <div onClick={() => !isReorderMode && !isSorting && onView?.()}>
        <ServiceCardContent service={service} isOverlay={false} />
      </div>

      {/* Edit/Delete — reorder rejimida ko'rinmaydi */}
      {!isReorderMode && (
        <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:bg-slate-100"
            onPointerDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onEdit?.(); }}>
            <Edit2 className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-400 hover:bg-rose-50"
            onPointerDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onDelete?.(); }}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

export default function Services() {
  const { t, language } = useTranslation();
  const [services, setServices] = useState([]);
  const [dbCategories, setDbCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  const [modalOpen, setModalOpen] = useState(false);
  const [editService, setEditService] = useState(null);
  const [viewService, setViewService] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  
  const [catEditOpen, setCatEditOpen] = useState(false);
  const [catToDelete, setCatToDelete] = useState(null);
  const [renamingCat, setRenamingCat] = useState({ old: '', new: '' });
  
  const [saving, setSaving] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [categoryOrder, setCategoryOrder] = useState([]);
  const [newCatModalOpen, setNewCatModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [isReordering, setIsReordering] = useState(false);
  // Har bir kategoriya uchun alohida reorder rejimi
  const [reorderingCat, setReorderingCat] = useState(null); // null = hech biri, catName = shu kategoriya reorder rejimida


  const [form, setForm] = useState({ 
    name: '', category: 'TERAPIYA (ENDO + PLOMBA)', price: '', duration: '30', is_active: true, requires_tooth: false, description: '', tooth_numbers: []
  });

  // Xizmatlar tartibi har bir kategoriya uchun localStorage da saqlanadi
  const [serviceOrders, setServiceOrders] = useState({});

  // serviceOrders ni localStorage dan yuklash
  useEffect(() => {
    try {
      const saved = localStorage.getItem('service_item_order');
      if (saved) setServiceOrders(JSON.parse(saved));
    } catch (e) { /* ignore */ }
  }, []);

  const handleServiceReorder = (catName, newItems) => {
    setServiceOrders(prev => {
      const updated = { ...prev, [catName]: newItems.map(s => s.id) };
      localStorage.setItem('service_item_order', JSON.stringify(updated));
      return updated;
    });
  };

  // Active drag item (overlay uchun)
  const [activeDragItem, setActiveDragItem] = useState(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = useCallback((event, items) => {
    const { active } = event;
    // grouped dan emas, to'g'ridan-to'g'ri items dan olamiz
    const item = items.find(s => s.id === active.id);
    setActiveDragItem(item || null);
  }, []);

  const handleDragEnd = useCallback((event, catName, items) => {
    const { active, over } = event;
    setActiveDragItem(null);
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex(s => s.id === active.id);
    const newIndex = items.findIndex(s => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const newItems = arrayMove(items, oldIndex, newIndex);
    handleServiceReorder(catName, newItems);
  }, [handleServiceReorder]);


  const loadData = async () => {
    try {
      setLoading(true);
      const [svcData, catData] = await Promise.all([
        base44.entities.Service.list('name', 300),
        base44.entities.ServiceCategory.list('name', 100)
      ]);
      // De-duplicate services by name only (case-insensitive, trimmed)
      const seen = new Map();
      (svcData || []).forEach(s => {
        const key = s.name?.toLowerCase().trim();
        if (!key) return;
        if (!seen.has(key)) {
          seen.set(key, s);
        } else {
          const existing = seen.get(key);
          if (!existing.category && s.category) {
            seen.set(key, s);
          }
        }
      });
      setServices(Array.from(seen.values()));
      setDbCategories(catData || []);
    } catch (error) {
      console.error('Failed to load services data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    const savedOrder = localStorage.getItem('service_category_order');
    let order = [];
    if (savedOrder) {
      try {
        order = JSON.parse(savedOrder);
      } catch (e) {
        order = [...DEFAULT_CATEGORIES];
      }
    } else {
      order = [...DEFAULT_CATEGORIES];
    }
    const merged = new Set(order);
    DEFAULT_CATEGORIES.forEach(cat => merged.add(cat));
    (dbCategories || []).forEach(c => c.name && merged.add(c.name));
    (services || []).forEach(s => {
      const cat = s.category || autoCategorize(s.name);
      if (cat) merged.add(cat);
    });
    setCategoryOrder(Array.from(merged));
  }, [dbCategories, services]);

  const handleReorder = (newOrder) => {
    setCategoryOrder(newOrder);
    localStorage.setItem('service_category_order', JSON.stringify(newOrder));
  };

  useEffect(() => {
    if (editService) {
      setForm({ 
        name: editService.name || '', category: editService.category || 'TERAPIYA (ENDO + PLOMBA)', 
        price: editService.price || '', duration: editService.duration || '30', 
        is_active: editService.is_active !== false, requires_tooth: editService.requires_tooth || false,
        description: editService.description || '',
        tooth_numbers: editService.tooth_numbers || []
      });
    } else if (!modalOpen) {
      setForm({ name: '', category: categoryOrder[0] || 'TERAPIYA (ENDO + PLOMBA)', price: '', duration: '30', is_active: true, requires_tooth: false, description: '', tooth_numbers: [] });
    }
  }, [editService, modalOpen, categoryOrder]);

  const filtered = useMemo(() => {
    return services.filter(s => {
      const matchesSearch = s.name?.toLowerCase().includes(search.toLowerCase()) || 
                           s.category?.toLowerCase().includes(search.toLowerCase());
      if (selectedCategory === 'all') return matchesSearch;
      const displayCategory = s.category || autoCategorize(s.name);
      return matchesSearch && displayCategory === selectedCategory;
    });
  }, [services, search, selectedCategory]);

  const grouped = useMemo(() => {
    const groups = {};
    filtered.forEach(s => {
      const cat = s.category || autoCategorize(s.name);
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(s);
    });
    // Har bir kategoriyadagi xizmatlarni serviceOrders tartibiga qarab sort qilamiz
    const entries = Object.entries(groups).map(([catName, items]) => {
      const order = serviceOrders[catName];
      if (order && order.length) {
        const sorted = [...items].sort((a, b) => {
          const ai = order.indexOf(a.id);
          const bi = order.indexOf(b.id);
          if (ai === -1 && bi === -1) return 0;
          if (ai === -1) return 1;
          if (bi === -1) return -1;
          return ai - bi;
        });
        return [catName, sorted];
      }
      return [catName, items];
    });
    // Kategoriyalarni categoryOrder tartibida saralash
    return entries.sort(([a], [b]) => {
      const ai = categoryOrder.indexOf(a);
      const bi = categoryOrder.indexOf(b);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [filtered, serviceOrders, categoryOrder]);


  const stats = useMemo(() => {
    return {
      total: services.length,
      active: services.filter(s => s.is_active !== false).length,
      avgPrice: services.length > 0 ? services.reduce((sum, s) => sum + (Number(s.price) || 0), 0) / services.length : 0,
      categories: categoryOrder.length
    };
  }, [services, categoryOrder]);

  const handleSaveService = async () => {
    if (!form.name || !form.price) return;
    setSaving(true);
    try {
      if (editService) {
        await base44.entities.Service.update(editService.id, form);
      } else {
        await base44.entities.Service.create(form);
      }
      setModalOpen(false);
      setEditService(null);
      loadData();
    } catch (e) { console.error(e); } finally { setSaving(false); }
  };

  const handleDeleteService = async () => {
    if (!deleteId) return;
    try {
      await base44.entities.Service.delete(deleteId);
      setDeleteId(null);
      loadData();
    } catch (e) {
      console.error('O\'chirishda xatolik:', e);
      setDeleteId(null);
    }
  };


  const loadTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const filteredTemplates = DEFAULT_SERVICES_DATA.filter(svc => ALLOWED_CATEGORIES.includes(svc.category));
      // Create all missing services in parallel (not sequential)
      const missingServices = filteredTemplates.filter(svc =>
        !services.find(s => s.name?.toLowerCase() === svc.name?.toLowerCase())
      );
      if (missingServices.length > 0) {
        await Promise.all(missingServices.map(svc => base44.entities.Service.create(svc)));
      }
    } catch (e) { console.error(e); } finally { setLoadingTemplates(false); loadData(); }
  };

  return (
    <div className="space-y-3 pb-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div className="space-y-0.5 min-w-0 flex-1">
          <Badge variant="outline" className="bg-[#1499AD]/10 text-[#1499AD] border-[#1499AD]/20 mb-1 font-black px-2.5 py-0.5 uppercase tracking-widest text-[9px]">CRM XIZMATLARI</Badge>
          <h1 className="text-xl premium-title">{t('services.title')}</h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1 whitespace-normal break-words">{t('services.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={loadTemplates} disabled={loadingTemplates} className="h-9 px-4 rounded-xl border-slate-200 font-bold active:scale-95 transition-all text-[10px] uppercase tracking-widest text-slate-500">{loadingTemplates ? '...' : t('services.loadTemplates')}</Button>
          <Button onClick={() => { setEditService(null); setModalOpen(true); }} className="h-9 px-5 rounded-xl bg-[#1499AD] hover:bg-[#0E7A8A] text-white font-black shadow-sm gap-2 active:scale-95 transition-all text-[10px] uppercase tracking-widest border-none"><Plus className="w-4 h-4" /> {t('services.newService')}</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: t('services.stats.total'), value: stats.total, icon: ListFilter, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: t('services.stats.active'), value: stats.active, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: t('services.stats.avgPrice'), value: `${(Math.round(stats.avgPrice / 1000) * 1000).toLocaleString()} UZS`, icon: DollarSign, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: (!t('services.categories') || t('services.categories').toUpperCase().startsWith('SERVICES.')) ? 'Bo\'limlar' : t('services.categories'), value: categoryOrder.length, icon: BarChart3, color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3 group hover:shadow-md transition-all">
            <div className={`w-9 h-9 rounded-xl ${stat.bg} ${stat.color} flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0`}><stat.icon className="w-4 h-4" /></div>
            <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-0.5">{stat.label}</p><p className="text-lg font-black text-slate-900">{stat.value}</p></div>
          </div>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="w-full lg:w-72 xl:w-80 flex-shrink-0 space-y-3">
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm sticky top-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2"><Filter className="w-4 h-4 text-slate-900" /><h3 className="font-black text-slate-900 uppercase tracking-widest text-[10px]">{t('services.sidebar.categories')}</h3></div>
              <div className="flex items-center gap-1">
                <button onClick={() => setNewCatModalOpen(true)} className="p-1.5 rounded-lg bg-slate-50 text-slate-400 hover:bg-slate-100 transition-all"><Plus className="w-3.5 h-3.5" /></button>
                <button onClick={() => setIsReordering(!isReordering)} className={classNames("p-1.5 rounded-lg transition-all", isReordering ? "bg-emerald-500 text-white shadow-lg" : "bg-slate-50 text-slate-400 hover:bg-slate-100")}>{isReordering ? <Check className="w-3.5 h-3.5" /> : <Settings2 className="w-3.5 h-3.5" />}</button>
              </div>
            </div>
            <div className="relative mb-3"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" /><Input placeholder={t('services.sidebar.search')} value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-slate-900/10 font-bold text-slate-700 text-[12px]" /></div>
            <div className="space-y-1 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
              <button 
                onClick={() => setSelectedCategory('all')} 
                title={t('services.sidebar.all') || "Barchasi"}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all font-black text-xs ${
                  selectedCategory === 'all' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="flex items-center gap-2">
                  <ListFilter className="w-3.5 h-3.5" /> 
                  {t('services.sidebar.all')}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                    selectedCategory === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {services.length}
                  </span>
                  <ChevronRight className={`w-3.5 h-3.5 opacity-30 ${selectedCategory === 'all' ? 'rotate-90' : ''}`} />
                </div>
              </button>
              <Reorder.Group axis="y" values={categoryOrder} onReorder={handleReorder} className="space-y-1.5">
                {categoryOrder.map((cat) => (
                  <Reorder.Item key={cat} value={cat} dragListener={isReordering}>
                    <div className="relative group">
                      <button
                        onClick={() => !isReordering && setSelectedCategory(cat)}
                        title={cat}
                        className={classNames(
                          "w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all font-bold text-xs text-left border-2 gap-2",
                          selectedCategory === cat ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'text-slate-700 border-transparent hover:bg-slate-50',
                          isReordering && "border-emerald-500 bg-emerald-50 text-emerald-700 animate-pulse cursor-move ring-4 ring-emerald-500/10"
                        )}
                      >
                        <span className="leading-snug break-words flex-1">{cat}</span>
                        {!isReordering && (
                          <div className="flex items-center gap-1 shrink-0">
                            <span className={classNames(
                              "text-[10px] font-bold px-1.5 py-0.2 rounded-full",
                              selectedCategory === cat ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                            )}>
                              {services.filter(s => (s.category || autoCategorize(s.name)) === cat).length}
                            </span>
                            <ChevronRight className={classNames("w-3.5 h-3.5", selectedCategory === cat ? "opacity-70" : "opacity-30")} />
                          </div>
                        )}
                      </button>
                      {isReordering && (
                        <div className="absolute top-1/2 -translate-y-1/2 right-2 flex gap-1 z-20">
                          <button 
                            onClick={(e) => { e.stopPropagation(); setRenamingCat({ old: cat, new: cat }); setCatEditOpen(true); }}
                            className="p-1.5 bg-white shadow-md rounded-lg text-blue-500 hover:bg-blue-50 transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setCatToDelete(cat); }}
                            className="p-1.5 bg-white shadow-md rounded-lg text-rose-500 hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </Reorder.Item>
                ))}
              </Reorder.Group>
            </div>
          </div>
        </div>

        <div className="flex-1">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">{[1, 2, 3, 4, 5, 6].map(i => (<div key={i} className="h-64 bg-white rounded-[40px] animate-pulse border border-slate-100" />))}</div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-[40px] border border-slate-100 p-24 flex flex-col items-center justify-center text-center shadow-sm">
              <div className="w-24 h-24 bg-slate-50 rounded-[32px] flex items-center justify-center mb-8"><Stethoscope className="w-10 h-10 text-slate-200" /></div>
              <h3 className="text-3xl font-black text-slate-900">{t('common.noData')}</h3>
              <p className="text-slate-500 max-w-xs mx-auto mt-3 font-medium">{t('services.subtitle')}</p>
              <Button onClick={() => setModalOpen(true)} className="mt-10 rounded-2xl bg-slate-900 px-10 h-14 font-black">{t('services.newService')}</Button>
            </div>
          ) : (
          <div className="space-y-6">
              {grouped.map(([catName, items]) => {
                const style = getCategoryStyle(catName); const Icon = style.icon;
                return (
                  <div key={catName} className="space-y-6">
                    <div className="flex items-center justify-between px-4">
                      <div className="flex items-center gap-4">
                        <h2 className="text-xl font-bold text-slate-900 uppercase tracking-widest">{catName}</h2>
                        <Badge variant="secondary" className="bg-slate-100 text-slate-500 rounded-xl px-2 py-0.5 text-[11px] font-bold">{items.length}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Tartib o'zgartirish tugmasi — kategoriyalardagi kabi */}
                        <button
                          onClick={() => setReorderingCat(prev => prev === catName ? null : catName)}
                          className={classNames(
                            "w-9 h-9 rounded-xl flex items-center justify-center transition-all font-black text-xs",
                            reorderingCat === catName
                              ? "bg-emerald-500 text-white shadow-lg shadow-emerald-200 scale-110"
                              : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                          )}
                          title={reorderingCat === catName ? "Tartibni saqlash" : "Tartibni o'zgartirish"}
                        >
                          {reorderingCat === catName ? <Check className="w-4 h-4" /> : <Settings2 className="w-4 h-4" />}
                        </button>
                        <Button variant="ghost" size="icon" className="w-9 h-9 rounded-xl bg-slate-50 shadow-sm hover:bg-white hover:shadow-md transition-all"
                          onClick={() => { setEditService(null); setForm(f => ({ ...f, category: catName })); setModalOpen(true); }}>
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    {/* Reorder rejim yozuvi */}
                    {reorderingCat === catName && (
                      <div className="px-4 py-2 bg-emerald-50 rounded-xl border border-emerald-100 text-emerald-700 text-xs font-bold flex items-center gap-2">
                        <GripVertical className="w-4 h-4" />
                        Nuqtani ushlab joyini o'zgartiring. Tugatgach ✅ tugmasini bosing.
                      </div>
                    )}
                    {/* ✅ DnD Kit — drag & drop grid */}
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragStart={(e) => handleDragStart(e, items)}
                      onDragEnd={(e) => handleDragEnd(e, catName, items)}
                    >
                      <SortableContext items={items.map(s => s.id)} strategy={rectSortingStrategy}>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                          {items.map(s => (
                            <SortableServiceCard
                              key={s.id}
                              service={s}
                              onView={() => setViewService(s)}
                              onEdit={() => { setEditService(s); setModalOpen(true); }}
                              onDelete={() => setDeleteId(s.id)}
                              isDragging={activeDragItem?.id === s.id}
                              isReorderMode={reorderingCat === catName}
                            />
                          ))}
                        </div>
                      </SortableContext>
                      {/* Drag overlay has been removed to support direct, offset-free in-place dragging */}
                    </DndContext>
                  </div>
                );
              })}
            </div>

          )}
        </div>
      </div>

      {/* Detail Modal */}
      <Dialog open={!!viewService} onOpenChange={() => setViewService(null)}>
        <DialogContent className="sm:max-w-md p-10 rounded-[48px] border-none shadow-2xl bg-white">
          {viewService && (
            <div className="space-y-8">
              <div className="flex items-center gap-6">
                <div>
                  <Badge className="mb-2 font-black uppercase tracking-widest px-3 bg-[#1499AD]/10 text-[#1499AD] border-none">{(viewService.category)}</Badge>
                  <h2 className="text-3xl font-black text-slate-900 leading-tight">{viewService.name}</h2>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-5"><div className="bg-slate-50 p-8 rounded-[36px] text-center border border-slate-100"><p className="text-3xl font-black text-slate-900">{(Number(viewService.price) || 0).toLocaleString()}</p><p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-2">{t('services.modals.price')}</p></div><div className="bg-slate-50 p-8 rounded-[36px] text-center border border-slate-100"><p className="text-3xl font-black text-slate-900">{viewService.duration}</p><p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-2">{t('services.modals.duration')}</p></div></div>
              <div className="flex gap-4">
                <Button variant="ghost" className="flex-1 h-16 rounded-2xl font-black text-slate-400" onClick={() => setViewService(null)}>
                  {t('common.close') || 'YOPISH'}
                </Button>
                <Button className="flex-1 h-16 rounded-[24px] bg-slate-900 font-black shadow-2xl active:scale-95 transition-all text-lg" onClick={() => { setEditService(viewService); setViewService(null); setModalOpen(true); }}>
                  {t('common.edit') || 'TAHRIRLASH'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={() => { setModalOpen(false); setEditService(null); }}>
        <DialogContent className="sm:max-w-xl max-h-[88vh] overflow-y-auto p-5 sm:p-6 rounded-[28px] border-none shadow-2xl bg-white flex flex-col no-scrollbar">
          <DialogHeader className="mb-3 text-center">
            <DialogTitle className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {editService ? (t('services.modals.editTitle') || 'Xizmatni tahrirlash') : (t('services.modals.addTitle') || 'Yangi xizmat qo\'shish')}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-3.5">
            {/* Row 1: Nomi & Kategoriya */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">{t('services.modals.name')} *</Label>
                <Input 
                  value={form.name} 
                  onChange={e => setForm({ ...form, name: e.target.value })} 
                  placeholder="Masalan: Tish tozalash (Air Flow)"
                  className="h-10 rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-900 px-3 text-sm focus:bg-white focus:ring-1 focus:ring-[#1499AD]" 
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">{t('services.modals.category')}</Label>
                <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                  <SelectTrigger className="h-10 rounded-xl border border-slate-200 bg-slate-50 font-bold px-3 text-sm focus:bg-white focus:ring-1 focus:ring-[#1499AD]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-200 shadow-xl max-h-56">
                    {categoryOrder.map(cat => (
                      <SelectItem key={cat} value={cat} className="font-bold cursor-pointer py-2 text-xs">{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Quick Template Suggestions for New Service */}
            {!editService && (
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-[#1499AD]" />
                  {language === 'ru' ? 'Шаблоны:' : 'Tezkor shablonlar:'}
                </span>
                {[
                  { name: "Tish tozalash (Air Flow)", cat: "GIGIENA VA PROFILAKTIKA", price: "150000", duration: "30" },
                  { name: "Fotopolimer plomba", cat: "TERAPIYA (ENDO + PLOMBA)", price: "250000", duration: "40" },
                  { name: "Tish sug'urish (Oddiy)", cat: "XIRURGIYA", price: "180000", duration: "30" },
                  { name: "Metallokeramika toji", cat: "ORTOPEDIYA", price: "600000", duration: "45" },
                  { name: "Rentgen (RVG)", cat: "TERAPIYA (ENDO + PLOMBA)", price: "30000", duration: "10" }
                ].map(preset => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => {
                      setForm(prev => ({
                        ...prev,
                        name: preset.name,
                        category: categoryOrder.includes(preset.cat) ? preset.cat : prev.category,
                        price: preset.price,
                        duration: preset.duration
                      }));
                    }}
                    className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 hover:bg-[#1499AD]/10 text-slate-600 hover:text-[#1499AD] border border-slate-200/70 hover:border-[#1499AD]/30 transition-all cursor-pointer"
                  >
                    + {preset.name}
                  </button>
                ))}
              </div>
            )}

            {/* Row 2: Asosiy narx & Davomiyligi */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">{t('services.modals.basePrice') || 'ASOSIY NARX'} (UZS) *</Label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={form.price === '' || form.price === 0 ? '' : Number(form.price).toLocaleString('uz-UZ')}
                    onChange={e => {
                      const raw = e.target.value.replace(/\s/g, '').replace(/,/g, '').replace(/\./g, '').replace(/'/g, '');
                      if (raw === '') setForm({ ...form, price: '' });
                      else if (/^\d+$/.test(raw)) setForm({ ...form, price: raw });
                    }}
                    onKeyDown={e => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault(); }}
                    onWheel={e => e.target.blur()}
                    placeholder="150 000"
                    className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50 font-black text-base tracking-tight px-3 outline-none focus:bg-white focus:ring-2 focus:ring-[#1499AD]/30"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">UZS</span>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">{t('services.modals.durationMinutes') || 'DAVOMIYLIGI (MIN)'}</Label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={form.duration || ''}
                    onChange={e => {
                      const raw = e.target.value.replace(/\D/g, '');
                      setForm({ ...form, duration: raw });
                    }}
                    onKeyDown={e => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault(); }}
                    onWheel={e => e.target.blur()}
                    placeholder="30"
                    className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50 font-black text-base tracking-tight px-3 outline-none focus:bg-white focus:ring-2 focus:ring-[#1499AD]/30"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">min</span>
                </div>
              </div>
            </div>

            {/* Row 3: Tavsif */}
            <div className="space-y-1">
              <Label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">{t('services.modals.projectDescription') || 'LOYIHA TAVSIFI'}</Label>
              <Input 
                value={form.description} 
                onChange={e => setForm({ ...form, description: e.target.value })} 
                placeholder={t('services.modals.descriptionPlaceholder') || "Qisqacha ma'lumot..."} 
                className="h-10 rounded-xl border border-slate-200 bg-slate-50 font-bold px-3 text-sm focus:bg-white focus:ring-1 focus:ring-[#1499AD]" 
              />
            </div>

            {/* Switches Card */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-100">
              <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-100">
                <div>
                  <Label className="font-bold text-[11px] uppercase tracking-wider text-slate-800 block cursor-pointer">
                    {t('services.modals.activeState') || 'AKTIV HOLAT'}
                  </Label>
                  <p className="text-[9px] text-slate-400 font-medium leading-none mt-0.5">Xizmat ro'yxatda faol bo'ladi</p>
                </div>
                <Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} />
              </div>

              <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-100">
                <div>
                  <Label className="font-bold text-[11px] uppercase tracking-wider text-slate-800 block cursor-pointer">
                    {t('services.modals.toothSelection') || 'TISH TANLASH'}
                  </Label>
                  <p className="text-[9px] text-slate-400 font-medium leading-none mt-0.5">Muayyan tishlarga bog'lash</p>
                </div>
                <Switch 
                  checked={form.requires_tooth} 
                  onCheckedChange={v => setForm({ ...form, requires_tooth: v, tooth_numbers: v ? (form.tooth_numbers || []) : [] })} 
                />
              </div>
            </div>

            {/* ✅ Tish diagrammasi — faqat "TISH TANLASH" yoqilganda */}
            {form.requires_tooth && (
              <div className="bg-slate-50/80 rounded-xl p-3 border border-[#1499AD]/20 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <Label className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <span>🦷 {t('services.modals.selectTeeth') || 'Tegishli tishlarni belgilang'}</span>
                  </Label>
                  {(form.tooth_numbers || []).length > 0 ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-black text-[#1499AD] bg-[#1499AD]/10 px-2 py-0.5 rounded-full border border-[#1499AD]/20">
                        {(!t('common.selected') || t('common.selected').startsWith('common.')) ? 'Tanlangan' : t('common.selected')}: {(form.tooth_numbers || []).map(Number).sort((a,b)=>a-b).join(', ')} ({(form.tooth_numbers || []).length} ta)
                      </span>
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, tooth_numbers: [] })}
                        className="text-[10px] font-black text-rose-500 hover:text-rose-700 px-1.5 py-0.5 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                      >
                        {(!t('common.clear') || t('common.clear').startsWith('common.')) ? 'Tozalash' : t('common.clear')}
                      </button>
                    </div>
                  ) : (
                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                      Hech qaysi tish tanlanmagan
                    </span>
                  )}
                </div>

                {/* FDI tish sxemasi */}
                <div className="p-2.5 bg-white rounded-xl border border-slate-200/80 space-y-1.5 shadow-xs overflow-x-auto">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Yuqori o'ng (18-11)</span>
                    <span className="text-[9px] font-black text-[#1499AD] uppercase tracking-wider">▲ Yuqori jag' (Tepa)</span>
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Yuqori chap (21-28)</span>
                  </div>
                  {/* Yuqori o'ng (18-11) va Yuqori chap (21-28) */}
                  <div className="flex justify-center items-center gap-0.5 min-w-max">
                    {[18,17,16,15,14,13,12,11].map(n => (
                      <ToothButton 
                        key={n} 
                        num={n} 
                        selected={(form.tooth_numbers||[]).map(Number).includes(Number(n))}
                        onClick={() => {
                          const cur = (form.tooth_numbers || []).map(Number);
                          const num = Number(n);
                          setForm({ ...form, tooth_numbers: cur.includes(num) ? cur.filter(x=>x!==num) : [...cur, num] });
                        }} 
                      />
                    ))}
                    <div className="w-0.5 h-6 bg-slate-300 mx-1 rounded-full" />
                    {[21,22,23,24,25,26,27,28].map(n => (
                      <ToothButton 
                        key={n} 
                        num={n} 
                        selected={(form.tooth_numbers||[]).map(Number).includes(Number(n))}
                        onClick={() => {
                          const cur = (form.tooth_numbers || []).map(Number);
                          const num = Number(n);
                          setForm({ ...form, tooth_numbers: cur.includes(num) ? cur.filter(x=>x!==num) : [...cur, num] });
                        }} 
                      />
                    ))}
                  </div>

                  {/* Ajratuvchi chiziq */}
                  <div className="flex items-center justify-center my-1">
                    <div className="w-full h-px bg-slate-100" />
                  </div>

                  <div className="flex items-center justify-between px-1">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Pastki o'ng (48-41)</span>
                    <span className="text-[9px] font-black text-[#1499AD] uppercase tracking-wider">▼ Pastki jag' (Past)</span>
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Pastki chap (31-38)</span>
                  </div>
                  {/* Pastki o'ng (48-41) va Pastki chap (31-38) */}
                  <div className="flex justify-center items-center gap-0.5 min-w-max">
                    {[48,47,46,45,44,43,42,41].map(n => (
                      <ToothButton 
                        key={n} 
                        num={n} 
                        selected={(form.tooth_numbers||[]).map(Number).includes(Number(n))}
                        onClick={() => {
                          const cur = (form.tooth_numbers || []).map(Number);
                          const num = Number(n);
                          setForm({ ...form, tooth_numbers: cur.includes(num) ? cur.filter(x=>x!==num) : [...cur, num] });
                        }} 
                      />
                    ))}
                    <div className="w-0.5 h-6 bg-slate-300 mx-1 rounded-full" />
                    {[31,32,33,34,35,36,37,38].map(n => (
                      <ToothButton 
                        key={n} 
                        num={n} 
                        selected={(form.tooth_numbers||[]).map(Number).includes(Number(n))}
                        onClick={() => {
                          const cur = (form.tooth_numbers || []).map(Number);
                          const num = Number(n);
                          setForm({ ...form, tooth_numbers: cur.includes(num) ? cur.filter(x=>x!==num) : [...cur, num] });
                        }} 
                      />
                    ))}
                  </div>
                </div>

                {/* Tez tanlash tugmalari */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-slate-200/60">
                  <span className="text-[9px] font-black text-slate-400 uppercase self-center mr-0.5">Tez tanlash:</span>
                  {[
                    { label: 'Barchasi (32)', nums: [11,12,13,14,15,16,17,18,21,22,23,24,25,26,27,28,31,32,33,34,35,36,37,38,41,42,43,44,45,46,47,48] },
                    { label: 'Yuqori (16)', nums: [11,12,13,14,15,16,17,18,21,22,23,24,25,26,27,28] },
                    { label: 'Pastki (16)', nums: [31,32,33,34,35,36,37,38,41,42,43,44,45,46,47,48] },
                    { label: 'Yuqori o\'ng (11-18)', nums: [11,12,13,14,15,16,17,18] },
                    { label: 'Yuqori chap (21-28)', nums: [21,22,23,24,25,26,27,28] },
                    { label: 'Pastki chap (31-38)', nums: [31,32,33,34,35,36,37,38] },
                    { label: 'Pastki o\'ng (41-48)', nums: [41,42,43,44,45,46,47,48] },
                    { label: 'O\'ng tomon', nums: [11,12,13,14,15,16,17,18,41,42,43,44,45,46,47,48] },
                    { label: 'Chap tomon', nums: [21,22,23,24,25,26,27,28,31,32,33,34,35,36,37,38] },
                  ].map(({ label, nums }) => {
                    const curTeeth = (form.tooth_numbers || []).map(Number);
                    const isActive = nums.length > 0 && nums.every(n => curTeeth.includes(n));
                    return (
                      <button 
                        type="button"
                        key={label} 
                        onClick={() => {
                          if (isActive) {
                            setForm({ ...form, tooth_numbers: curTeeth.filter(n => !nums.includes(n)) });
                          } else {
                            const combined = Array.from(new Set([...curTeeth, ...nums]));
                            setForm({ ...form, tooth_numbers: combined });
                          }
                        }}
                        className={cn(
                          "text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all shadow-xs cursor-pointer active:scale-95 border",
                          isActive 
                            ? "bg-[#1499AD] text-white border-[#1499AD] shadow-sm font-black" 
                            : "bg-white text-slate-700 border-slate-200 hover:border-[#1499AD] hover:text-[#1499AD] hover:bg-[#1499AD]/5"
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Footer Action Buttons */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2.5">
              {(!form.name || !form.price) ? (
                <div className="text-[11px] font-bold text-amber-600 flex items-center gap-1.5 bg-amber-50 px-2.5 py-1 rounded-lg">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                  <span>{!form.name ? (language === 'ru' ? 'Введите название услуги' : "Xizmat nomini kiriting") : (language === 'ru' ? 'Введите цену услуги' : "Xizmat narxini kiriting")}</span>
                </div>
              ) : (
                <div className="text-[11px] font-bold text-emerald-600 flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-lg">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{language === 'ru' ? 'Готово к сохранению' : "Saqlashga tayyor"}</span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Button 
                  type="button"
                  variant="outline" 
                  onClick={() => { setModalOpen(false); setEditService(null); }} 
                  className="h-10 rounded-xl px-4 font-bold text-xs text-slate-600 border-slate-200 hover:bg-slate-50 cursor-pointer"
                >
                  {t('common.cancel') || 'Bekor qilish'}
                </Button>
                <Button 
                  type="button"
                  onClick={handleSaveService} 
                  disabled={saving || !form.name || !form.price}
                  className={cn(
                    "h-10 rounded-xl font-bold text-xs px-6 shadow-sm transition-all active:scale-95 cursor-pointer flex items-center gap-1.5",
                    (!form.name || !form.price)
                      ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                      : "bg-[#1499AD] hover:bg-[#0E7A8A] text-white shadow-[#1499AD]/20"
                  )}
                >
                  {saving ? (
                    t('settings.publicPage.saving') || 'Saqlanmoqda...'
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>{t('common.save') || 'Saqlash'}</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Category Edit Modal */}
      <Dialog open={catEditOpen} onOpenChange={setCatEditOpen}>
        <DialogContent className="sm:max-w-md p-10 rounded-[40px] bg-white border-none shadow-3xl">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-2xl font-black text-slate-900 uppercase">
              {t('services.categoryModals.editTitle') || 'Bo\'lim nomini tahrirlash'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div className="space-y-2">
              <Label className="text-xs font-black text-slate-400 uppercase ml-1">
                {t('services.categoryModals.enterNewName') || 'Yangi nomni kiriting'}
              </Label>
              <Input value={renamingCat.new} onChange={e => setRenamingCat({ ...renamingCat, new: e.target.value })} className="h-14 rounded-2xl bg-slate-50 border-none font-bold text-lg px-6" />
            </div>
            <Button onClick={async () => { 
              if (!renamingCat.new || !renamingCat.new.trim()) return; 
              const newName = renamingCat.new.trim();
              const oldName = renamingCat.old;
              const newOrder = categoryOrder.map(c => c === oldName ? newName : c); 
              handleReorder(newOrder); 
              const svcsToUpdate = services.filter(s => s.category === oldName);
              svcsToUpdate.forEach(s => {
                base44.entities.Service.update(s.id, { category: newName }).catch(console.error);
              });
              setCatEditOpen(false); 
              loadData();
            }} className="w-full h-15 rounded-2xl bg-slate-900 text-white font-black">
              {t('services.categoryModals.saveChanges') || 'O\'ZGARTIRISHNI SAQLASH'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Category Delete Confirm */}
      <Dialog open={!!catToDelete} onOpenChange={() => setCatToDelete(null)}>
        <DialogContent className="sm:max-w-md p-10 rounded-[40px] bg-white border-none shadow-3xl text-center">
          <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-[32px] flex items-center justify-center mx-auto mb-6"><Trash2 className="w-10 h-10" /></div>
          <h3 className="text-2xl font-black text-slate-900 uppercase">
            {t('services.categoryModals.confirmDelete') || 'O\'chirishni tasdiqlang'}
          </h3>
          <p className="text-slate-500 font-bold mt-2">
            {t('services.categoryModals.deleteWarning', { name: catToDelete }) || `"${catToDelete}" bo'limi va undagi barcha sozlamalar o'chiriladi. Davom etasizmi?`}
          </p>
          <div className="flex gap-4 mt-8">
            <Button variant="ghost" onClick={() => setCatToDelete(null)} className="flex-1 h-14 rounded-2xl font-black text-slate-400">
              {t('common.cancel') || 'BEKOR QILISH'}
            </Button>
            <Button onClick={async () => { 
              const newOrder = categoryOrder.filter(c => c !== catToDelete); 
              handleReorder(newOrder); 
              const catObj = dbCategories.find(c => c.name === catToDelete);
              if (catObj?.id) {
                base44.entities.ServiceCategory.delete(catObj.id).catch(console.error);
              }
              setCatToDelete(null); 
              loadData();
            }} className="flex-1 h-14 rounded-2xl bg-rose-500 text-white font-black">
              {t('services.categoryModals.yesDelete') || 'HA, O\'CHIRILSIN'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Category Modal */}
      <Dialog open={newCatModalOpen} onOpenChange={setNewCatModalOpen}>
        <DialogContent className="sm:max-w-md p-10 rounded-[40px] bg-white border-none shadow-3xl">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-2xl font-black text-slate-900 uppercase">
              {t('services.categoryModals.addTitle') || "Yangi bo'lim qo'shish"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div className="space-y-2">
              <Label className="text-xs font-black text-slate-400 uppercase ml-1">
                {t('services.categoryModals.categoryName') || 'Bo\'lim nomi'}
              </Label>
              <Input value={newCatName} onChange={e => setNewCatName(e.target.value)} className="h-14 rounded-2xl bg-slate-50 border-none font-bold text-lg px-6" placeholder={t('services.categoryModals.placeholder') || 'Masalan: GNATOLOGIYA'} />
            </div>
            <Button onClick={async () => { 
              if (!newCatName || !newCatName.trim()) return; 
              const trimmed = newCatName.trim();
              const newOrder = [trimmed, ...categoryOrder.filter(c => c !== trimmed)]; 
              handleReorder(newOrder); 
              try {
                await base44.entities.ServiceCategory.create({ name: trimmed });
              } catch (e) {
                console.error('Failed to create ServiceCategory in DB:', e);
              }
              setForm({ ...form, category: trimmed }); 
              setNewCatName(''); 
              setNewCatModalOpen(false); 
              loadData();
            }} className="w-full h-15 rounded-2xl bg-slate-900 text-white font-black uppercase tracking-widest shadow-2xl">
              {t('services.categoryModals.addCategory') || 'BO\'LIMNI QO\'SHISH'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent className="sm:max-w-md rounded-[40px] border-none shadow-3xl bg-white p-10 text-center">
          <AlertDialogHeader className="items-center">
            <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-[32px] flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-10 h-10" />
            </div>
            <AlertDialogTitle className="text-2xl font-black text-slate-900 uppercase tracking-tight">
              {t('services.alerts.deleteTitle') || 'Xizmatni o\'chirish'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500 font-bold mt-2 text-base">
              {t('services.alerts.deleteConfirm') || 'Bu xizmatni rostan o\'chirmoqchimisiz?'}<br />
              <span className="text-rose-400 font-black">{t('services.alerts.deleteWarning') || 'Bu amalni qaytarib bo\'lmaydi!'}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex gap-4 mt-8 sm:flex-row">
            <AlertDialogCancel
              onClick={() => setDeleteId(null)}
              className="flex-1 h-14 rounded-2xl border-slate-200 font-black text-slate-500 bg-slate-50 hover:bg-slate-100"
            >
              {t('common.cancel') || 'BEKOR QILISH'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                try {
                  await handleDeleteService();
                } catch (err) {
                  console.error(err);
                } finally {
                  setDeleteId(null);
                }
              }}
              className="flex-1 h-14 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-black shadow-lg shadow-rose-200"
            >
              {t('services.categoryModals.yesDelete') || 'HA, O\'CHIRILSIN'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
