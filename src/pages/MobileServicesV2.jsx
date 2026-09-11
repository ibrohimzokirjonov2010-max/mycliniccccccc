import { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Search, Stethoscope, Trash2, Clock, 
  Activity, Scissors, Layers, Baby, 
  ShieldCheck, Syringe, Sparkles, TrendingUp,
  Pencil, Settings2, Check, ArrowLeft, X
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useTranslation } from '@/i18n/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { cn } from '@/lib/utils';

const ALLOWED_CATEGORIES = [
  'TERAPIYA (ENDO + PLOMBA)',
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

export const normalizeCategory = (cat) => {
  if (!cat) return 'TERAPIYA (ENDO + PLOMBA)';
  const cleaned = String(cat).trim();
  const upper = cleaned.toUpperCase().replace(/\s+/g, ' ');
  
  if (
    upper.includes('TERAPIYA') || 
    upper.includes('THERAPY') || 
    (upper.includes('ENDO') && upper.includes('PLOMBA')) ||
    upper.includes('PLOMBA') ||
    upper.includes('KARIES')
  ) {
    return 'TERAPIYA (ENDO + PLOMBA)';
  }
  if (upper.includes('RESTAVRATSIYA') || upper.includes('RESTORATION')) {
    return 'RESTAVRATSIYA';
  }
  if (upper.includes('ORTOPEDIYA') || upper.includes('PROTHETIC') || upper.includes('PROTEZ') || upper.includes('KARONKA') || upper.includes('KORONKA')) {
    return 'ORTOPEDIYA';
  }
  if (upper.includes('XIRURGIYA') || upper.includes('SURGERY') || upper.includes('JARROHLIK') || upper.includes('TISH OLISH')) {
    return 'XIRURGIYA';
  }
  if (upper.includes('ORTODONTIYA') || upper.includes('ORTHODONTIC') || upper.includes('BREKET')) {
    return 'ORTODONTIYA';
  }
  if (upper.includes('GIGIENA') || upper.includes('GIGIYENA') || upper.includes('PROFILAKTIKA') || upper.includes('HYGIENE') || upper.includes('AIRFLOW') || upper.includes('TOZALASH')) {
    return 'GIGIENA VA PROFILAKTIKA';
  }
  if (upper.includes('ESTETIK') || upper.includes('ESTHETIC') || upper.includes('VINIYR') || upper.includes('VINIR') || upper.includes('OQARTIRISH')) {
    return 'ESTETIK STOMATOLOGIYA';
  }
  if (upper.includes('BOLALAR') || upper.includes('CHILD') || upper.includes('PEDIA')) {
    return 'BOLALAR STOMATOLOGIYASI';
  }
  if (upper.includes('IMPLANT')) {
    return 'IMPLANTATSIYA';
  }
  if (upper === 'ENDODONTIYA' || upper === 'ENDODONTICS') {
    return 'ENDODONTIYA';
  }
  
  return cleaned;
};

const autoCategorize = (name, currentCat = '') => {
  if (currentCat) return normalizeCategory(currentCat);
  const n = (name || '').toLowerCase();
  if (n.includes('implant')) return 'IMPLANTATSIYA';
  if (n.includes('bolalar') || n.includes('child') || n.includes('pediatr')) return 'BOLALAR STOMATOLOGIYASI';
  if (n.includes('gigiyena') || n.includes('gigiena') || n.includes('profilaktika') || n.includes('toshlarni') || n.includes('skaler') || n.includes('airflow') || n.includes('tozalash')) return 'GIGIENA VA PROFILAKTIKA';
  if (n.includes('vinir') || n.includes('viniyr') || n.includes('oqartirish') || n.includes('bleaching') || n.includes('estetik')) return 'ESTETIK STOMATOLOGIYA';
  if (n.includes('restavratsiya')) return 'RESTAVRATSIYA';
  if (n.includes('olish') || n.includes('sug\'urish') || n.includes('xirurg') || n.includes('anesteziya') || n.includes('jarrohlik')) return 'XIRURGIYA';
  if (n.includes('karonka') || n.includes('koronka') || n.includes('protez') || n.includes('sirkoniy') || n.includes('ko\'prik') || n.includes('e-max')) return 'ORTOPEDIYA';
  if (n.includes('breket') || n.includes('reteyner') || n.includes('plastinka') || n.includes('ortodont')) return 'ORTODONTIYA';
  if (n.includes('endo') || n.includes('kanal') || n.includes('pulpotomiya')) return 'TERAPIYA (ENDO + PLOMBA)';
  if (n.includes('plomba') || n.includes('karies') || n.includes('terapiya') || n.includes('shtif') || n.includes('rvg') || n.includes('rentgen')) return 'TERAPIYA (ENDO + PLOMBA)';
  return 'TERAPIYA (ENDO + PLOMBA)';
};

export const getServiceCategory = (s) => {
  if (!s) return 'TERAPIYA (ENDO + PLOMBA)';
  if (s.category) return normalizeCategory(s.category);
  return autoCategorize(s.name);
};

const getCategoryStyle = (cat) => {
  const norm = normalizeCategory(cat);
  return CATEGORY_MAP[norm] || CATEGORY_MAP[cat] || CATEGORY_MAP['TERAPIYA (ENDO + PLOMBA)'] || { icon: Activity, color: 'text-blue-500', bg: 'bg-blue-50', border: 'border-l-blue-500' };
};

export default function MobileServicesV2() {
  const { t } = useTranslation();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editService, setEditService] = useState(null);
  const [saving, setSaving] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [categoryOrder, setCategoryOrder] = useState([]);
  
  const [catEditOpen, setCatEditOpen] = useState(false);
  const [catToDelete, setCatToDelete] = useState(null);
  const [renamingCat, setRenamingCat] = useState({ old: '', new: '' });

  const [form, setForm] = useState({ 
    name: '', category: 'TERAPIYA (ENDO + PLOMBA)', price: '', duration: '30', is_active: true, requires_tooth: false, tooth_numbers: []
  });

  const loadServices = async () => {
    setLoading(true);
    const data = await base44.entities.Service.list('name', 300);
    setServices(data || []);
    setLoading(false);
  };

  useEffect(() => { loadServices(); }, []);

  useEffect(() => {
    const cats = new Set();
    ALLOWED_CATEGORIES.forEach(c => cats.add(c));
    services.forEach(s => {
      const cat = s.category || autoCategorize(s.name);
      cats.add(cat);
    });
    const allCats = Array.from(cats);

    const savedOrder = localStorage.getItem('mobile_service_category_order');
    if (savedOrder) {
      try {
        const parsed = JSON.parse(savedOrder);
        const merged = [...parsed];
        allCats.forEach(cat => {
          if (!merged.includes(cat)) merged.push(cat);
        });
        setCategoryOrder(merged.filter(cat => allCats.includes(cat)));
      } catch (e) {
        setCategoryOrder(allCats);
      }
    } else {
      setCategoryOrder(allCats);
    }
  }, [services]);

  const handleReorder = (newOrder) => {
    setCategoryOrder(newOrder);
    localStorage.setItem('mobile_service_category_order', JSON.stringify(newOrder));
  };

  useEffect(() => {
    if (editService) {
      setForm({ 
        name: editService.name, category: editService.category, 
        price: editService.price, duration: editService.duration, 
        is_active: editService.is_active !== false,
        requires_tooth: editService.requires_tooth || false,
        tooth_numbers: editService.tooth_numbers || []
      });
    } else {
      setForm({ name: '', category: 'TERAPIYA (ENDO + PLOMBA)', price: '', duration: '30', is_active: true, requires_tooth: false, tooth_numbers: [] });
    }
  }, [editService, modalOpen]);

  const filtered = services.filter(s => {
    const sCat = getServiceCategory(s);
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
                         sCat.toLowerCase().includes(search.toLowerCase());
    if (selectedCategory === 'all') return matchesSearch;
    return matchesSearch && normalizeCategory(sCat) === normalizeCategory(selectedCategory);
  });

  const grouped = useMemo(() => {
    const groups = {};
    filtered.forEach(s => {
      const cat = getServiceCategory(s);
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(s);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const handleSave = async () => {
    if (!form.name || !form.price) return;
    setSaving(true);
    if (editService) {
      await base44.entities.Service.update(editService.id, form);
    } else {
      await base44.entities.Service.create(form);
    }
    setSaving(false);
    setModalOpen(false);
    setEditService(null);
    loadServices();
  };

  const handleDelete = async (id) => {
    if (confirm(t('services.alerts.deleteDesc'))) {
      await base44.entities.Service.delete(id);
      loadServices();
    }
  };

  return (
    <div className="pb-24 pt-4 px-4 bg-[#F8FAFC] min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none mb-1">{t('services.title')}</h1>
          <p className="text-emerald-600 font-bold text-[9px] uppercase tracking-wider">{t('services.subtitle')}</p>
        </div>
        <button 
          onClick={() => { setEditService(null); setModalOpen(true); }}
          className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl flex items-center justify-center shadow-md shadow-emerald-500/20 active:scale-90 transition-all cursor-pointer"
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
        </button>
      </div>

      {/* Categories Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2.5 px-1">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('services.sidebar.categories')}</span>
          <button 
            onClick={() => setIsReordering(!isReordering)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider transition-all border",
              isReordering 
                ? "bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-100" 
                : "bg-emerald-50/70 border-emerald-100/50 text-emerald-650 hover:bg-emerald-100/40"
            )}
          >
            {isReordering ? <><Check className="w-3 h-3 stroke-[2.5]" /> SAQLASH</> : <><Settings2 className="w-3 h-3" /> JOYINI O'ZGARTIRISH</>}
          </button>
        </div>

        <div className="flex gap-2.5 overflow-x-auto overscroll-x-contain pb-3 -mx-4 px-4 no-scrollbar items-center snap-x snap-mandatory" style={{ WebkitOverflowScrolling: 'touch' }}>
          <button
            onClick={() => setSelectedCategory('all')}
            className={cn(
              "shrink-0 snap-start flex items-center gap-1.5 whitespace-nowrap px-3.5 py-2.5 min-h-[44px] rounded-xl font-black text-[11px] uppercase tracking-wider transition-all border",
              selectedCategory === 'all' 
                ? "bg-gradient-to-r from-emerald-500 to-teal-650 text-white border-none shadow-md shadow-emerald-500/15" 
                : "bg-white text-slate-500 border-slate-100 hover:border-slate-200 shadow-sm",
              isReordering && "opacity-50 grayscale pointer-events-none"
            )}
          >
            <Stethoscope className="w-3.5 h-3.5" />
            <span>{t('services.sidebar.all')}</span>
          </button>

          <Reorder.Group 
            axis="x" 
            values={categoryOrder} 
            onReorder={handleReorder}
            className="flex gap-2.5 items-center shrink-0"
          >
            {categoryOrder.map((cat) => {
              const catStyle = getCategoryStyle(cat);
              const Icon = catStyle.icon || Stethoscope;
              const isSelected = selectedCategory === cat;
              return (
                <Reorder.Item key={cat} value={cat} dragListener={isReordering} className="shrink-0">
                  <div className="relative">
                    <button
                      onClick={() => !isReordering && setSelectedCategory(cat)}
                      className={cn(
                        "shrink-0 snap-start flex items-center gap-1.5 whitespace-nowrap px-3.5 py-2.5 min-h-[44px] rounded-xl font-black text-[11px] uppercase tracking-wider transition-all border",
                        isSelected 
                          ? "bg-gradient-to-r from-emerald-500 to-teal-650 text-white border-none shadow-md shadow-emerald-500/15" 
                          : "bg-white text-slate-500 border-slate-100 hover:border-slate-200 shadow-sm",
                        isReordering 
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700 animate-pulse cursor-move ring-2 ring-emerald-500/10 touch-none"
                          : "touch-pan-x"
                      )}
                    >
                      <Icon className={cn("w-3.5 h-3.5", isSelected ? "text-white" : catStyle.color)} />
                      <span>{cat}</span>
                    </button>
                    {isReordering && (
                      <div className="absolute -top-2.5 -right-1.5 flex gap-1 z-10">
                        <button 
                           onClick={(e) => { e.stopPropagation(); setRenamingCat({ old: cat, new: cat }); setCatEditOpen(true); }}
                           className="w-6.5 h-6.5 bg-white shadow-lg border border-slate-100 rounded-full flex items-center justify-center text-blue-500 active:scale-90"
                        >
                           <Pencil className="w-3 h-3" />
                        </button>
                        <button 
                           onClick={(e) => { e.stopPropagation(); setCatToDelete(cat); }}
                           className="w-6.5 h-6.5 bg-white shadow-lg border border-slate-100 rounded-full flex items-center justify-center text-rose-500 active:scale-90"
                        >
                           <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </Reorder.Item>
              );
            })}
          </Reorder.Group>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative mb-4">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input 
          placeholder={t('services.sidebar.search')}
          value={search} 
          onChange={e => setSearch(e.target.value)} 
          className="pl-10 pr-9 h-10 rounded-xl bg-white border border-slate-200 shadow-sm font-bold text-slate-700 text-xs focus-visible:ring-emerald-400 focus-visible:border-emerald-400 transition-all placeholder:text-slate-350"
        />
        {search && (
          <button 
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-650 transition-colors border-none"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Services List Grouped */}
      <div className="space-y-4">
        {grouped.map(([catName, items]) => {
          const style = getCategoryStyle(catName);
          const Icon = style.icon || Stethoscope;
          return (
            <div key={catName} className="space-y-1.5">
              <div className="flex items-center justify-between px-1.5">
                <div className="flex items-center gap-1.5">
                  <div className={cn("w-5.5 h-5.5 rounded-lg flex items-center justify-center", style.bg)}>
                    <Icon className={cn("w-3.5 h-3.5", style.color)} />
                  </div>
                  <span className="text-[9px] font-black text-slate-500 tracking-wider uppercase">{catName}</span>
                </div>
                <Badge variant="secondary" className="bg-slate-100 text-slate-450 border-none rounded-lg px-2 h-4 text-[8px] font-black">{items.length}</Badge>
              </div>
              <div className={cn("bg-white rounded-2xl border border-slate-150 shadow-sm overflow-hidden divide-y divide-slate-100 border-l-[3.5px]", style.border)}>
                <AnimatePresence>
                  {items.map(s => (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }} 
                      animate={{ opacity: 1, y: 0 }} 
                      key={s.id}
                      className="p-3 px-3.5 flex items-center justify-between hover:bg-slate-50/40 active:bg-slate-50/70 transition-colors group"
                    >
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-slate-800 text-[13px] leading-snug truncate">{s.name}</h4>
                          {!s.is_active && (
                            <span className="text-[8px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-widest">Faol emas</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-extrabold text-emerald-600 text-xs">{Number(s.price).toLocaleString()} so'm</span>
                          <span className="w-0.5 h-0.5 rounded-full bg-slate-350" />
                          <span className="flex items-center gap-1 text-[9px] font-medium text-slate-400">
                            <Clock className="w-3 h-3 text-slate-400" /> {s.duration} min
                          </span>
                          {s.requires_tooth && (
                            <>
                              <span className="w-0.5 h-0.5 rounded-full bg-slate-350" />
                              <span className="text-[8px] bg-emerald-50 text-emerald-600 border border-emerald-100/50 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Tish raqami</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button 
                          onClick={() => { setEditService(s); setModalOpen(true); }} 
                          className="p-1.5 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg active:scale-90 transition-all duration-200 cursor-pointer"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(s.id)} 
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg active:scale-90 transition-all duration-200 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Dialog Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="w-[92vw] max-w-sm max-h-[85vh] p-0 border-none rounded-[2rem] bg-white outline-none overflow-hidden flex flex-col shadow-2xl !left-[50%] !top-[50%] !translate-x-[-50%] !translate-y-[-50%]" aria-describedby={undefined}>
          {/* Green Gradient Header */}
          <DialogHeader className="shrink-0">
            <div className="bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 px-5 py-4 flex items-center justify-between text-white rounded-t-[2rem]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-sm text-lg">
                  🩺
                </div>
                <div>
                  <DialogTitle className="text-[14px] font-black text-white uppercase leading-none tracking-tight">
                    {editService ? t('services.modals.editTitle') : t('services.modals.addTitle')}
                  </DialogTitle>
                  <p className="text-[8px] font-bold text-white/70 uppercase tracking-widest mt-0.5">Xizmatlar katalogi</p>
                </div>
              </div>
              <button 
                onClick={() => setModalOpen(false)} 
                className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center active:scale-90 transition-all border-none cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </DialogHeader>

          {/* Form Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
            {/* Input: Service Name */}
            <div>
              <label className="ml-1 text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">
                {t('services.modals.name')}
              </label>
              <Input 
                value={form.name} 
                onChange={e => setForm({ ...form, name: e.target.value })} 
                placeholder="Xizmat nomini kiriting..."
                className="h-10 rounded-xl bg-slate-50 border-none focus-visible:ring-emerald-500/10 font-bold text-slate-800 text-xs px-4"
              />
            </div>

            {/* Inputs: Price & Duration */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="ml-1 text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">
                  {t('services.modals.price')}
                </label>
                <div className="relative">
                  <Input 
                    type="number" 
                    value={form.price} 
                    onChange={e => setForm({ ...form, price: e.target.value })} 
                    placeholder="0"
                    className="h-10 rounded-xl bg-slate-50 border-none focus-visible:ring-emerald-500/10 font-black text-slate-800 pl-4 pr-12 text-xs"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-400 uppercase">so'm</span>
                </div>
              </div>

              <div>
                <label className="ml-1 text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">
                  {t('services.modals.duration')}
                </label>
                <div className="relative">
                  <Input 
                    type="number" 
                    value={form.duration} 
                    onChange={e => setForm({ ...form, duration: e.target.value })} 
                    placeholder="30"
                    className="h-10 rounded-xl bg-slate-50 border-none focus-visible:ring-emerald-500/10 font-black text-slate-800 pl-4 pr-10 text-xs"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-400 uppercase">min</span>
                </div>
              </div>
            </div>

            {/* Toggles Group Card */}
            <div className="border border-slate-100 bg-slate-50/50 rounded-2xl overflow-hidden divide-y divide-slate-100">
              <div className="flex items-center justify-between p-3.5 bg-white hover:bg-slate-50/30 transition-colors">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-500 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-bold text-[11px] text-slate-800 leading-none">{t('services.modals.active')}</p>
                    <p className="text-[8px] font-bold text-slate-400 mt-1 uppercase tracking-wider">Xizmat faolligi</p>
                  </div>
                </div>
                <Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} />
              </div>
              
              <div className="flex items-center justify-between p-3.5 bg-white hover:bg-slate-50/30 transition-colors">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-bold text-[11px] text-slate-800 leading-none">{t('services.modals.tooth')}</p>
                    <p className="text-[8px] font-bold text-slate-400 mt-1 uppercase tracking-wider font-mono">Tish raqamini kiritish</p>
                  </div>
                </div>
                <Switch 
                  checked={form.requires_tooth} 
                  onCheckedChange={v => setForm({ ...form, requires_tooth: v, tooth_numbers: v ? (form.tooth_numbers || []) : [] })} 
                />
              </div>

              {form.requires_tooth && (
                <div className="p-3 bg-slate-50 border-t border-slate-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black text-slate-700 uppercase tracking-wider">Tishlarni belgilang</p>
                    {(form.tooth_numbers || []).length > 0 && (
                      <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                        {(form.tooth_numbers || []).length} ta tanlandi
                      </span>
                    )}
                  </div>

                  <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 space-y-1.5 overflow-x-auto">
                    <div className="flex justify-center items-center gap-1 min-w-max">
                      {[18,17,16,15,14,13,12,11].map(n => {
                        const sel = (form.tooth_numbers || []).map(Number).includes(Number(n));
                        return (
                          <button
                            key={n}
                            type="button"
                            onClick={() => {
                              const cur = (form.tooth_numbers || []).map(Number);
                              const num = Number(n);
                              setForm({ ...form, tooth_numbers: cur.includes(num) ? cur.filter(x => x !== num) : [...cur, num] });
                            }}
                            className={`compact-hit w-9 h-11 min-h-[44px] rounded-lg text-[10px] font-black border transition-all flex items-center justify-center ${
                              sel ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs' : 'bg-slate-50 border-slate-200 text-slate-600'
                            }`}
                          >
                            {n}
                          </button>
                        );
                      })}
                      <div className="w-px h-6 bg-slate-300 mx-1" />
                      {[21,22,23,24,25,26,27,28].map(n => {
                        const sel = (form.tooth_numbers || []).map(Number).includes(Number(n));
                        return (
                          <button
                            key={n}
                            type="button"
                            onClick={() => {
                              const cur = (form.tooth_numbers || []).map(Number);
                              const num = Number(n);
                              setForm({ ...form, tooth_numbers: cur.includes(num) ? cur.filter(x => x !== num) : [...cur, num] });
                            }}
                            className={`compact-hit w-9 h-11 min-h-[44px] rounded-lg text-[10px] font-black border transition-all flex items-center justify-center ${
                              sel ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs' : 'bg-slate-50 border-slate-200 text-slate-600'
                            }`}
                          >
                            {n}
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex justify-center items-center gap-1 min-w-max pt-1 border-t border-slate-100">
                      {[48,47,46,45,44,43,42,41].map(n => {
                        const sel = (form.tooth_numbers || []).map(Number).includes(Number(n));
                        return (
                          <button
                            key={n}
                            type="button"
                            onClick={() => {
                              const cur = (form.tooth_numbers || []).map(Number);
                              const num = Number(n);
                              setForm({ ...form, tooth_numbers: cur.includes(num) ? cur.filter(x => x !== num) : [...cur, num] });
                            }}
                            className={`compact-hit w-9 h-11 min-h-[44px] rounded-lg text-[10px] font-black border transition-all flex items-center justify-center ${
                              sel ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs' : 'bg-slate-50 border-slate-200 text-slate-600'
                            }`}
                          >
                            {n}
                          </button>
                        );
                      })}
                      <div className="w-px h-6 bg-slate-300 mx-1" />
                      {[31,32,33,34,35,36,37,38].map(n => {
                        const sel = (form.tooth_numbers || []).map(Number).includes(Number(n));
                        return (
                          <button
                            key={n}
                            type="button"
                            onClick={() => {
                              const cur = (form.tooth_numbers || []).map(Number);
                              const num = Number(n);
                              setForm({ ...form, tooth_numbers: cur.includes(num) ? cur.filter(x => x !== num) : [...cur, num] });
                            }}
                            className={`compact-hit w-9 h-11 min-h-[44px] rounded-lg text-[10px] font-black border transition-all flex items-center justify-center ${
                              sel ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs' : 'bg-slate-50 border-slate-200 text-slate-600'
                            }`}
                          >
                            {n}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[
                      { label: 'Barchasi (32)', nums: [11,12,13,14,15,16,17,18,21,22,23,24,25,26,27,28,31,32,33,34,35,36,37,38,41,42,43,44,45,46,47,48] },
                      { label: 'Yuqori', nums: [11,12,13,14,15,16,17,18,21,22,23,24,25,26,27,28] },
                      { label: 'Pastki', nums: [31,32,33,34,35,36,37,38,41,42,43,44,45,46,47,48] },
                      { label: 'Yuqori o\'ng', nums: [11,12,13,14,15,16,17,18] },
                      { label: 'Yuqori chap', nums: [21,22,23,24,25,26,27,28] },
                      { label: 'Pastki chap', nums: [31,32,33,34,35,36,37,38] },
                      { label: 'Pastki o\'ng', nums: [41,42,43,44,45,46,47,48] },
                    ].map(({ label, nums }) => {
                      const curTeeth = (form.tooth_numbers || []).map(Number);
                      const isActive = nums.length > 0 && nums.every(n => curTeeth.includes(n));
                      return (
                        <button
                          key={label}
                          type="button"
                          onClick={() => {
                            if (isActive) {
                              setForm({ ...form, tooth_numbers: curTeeth.filter(n => !nums.includes(n)) });
                            } else {
                              const combined = Array.from(new Set([...curTeeth, ...nums]));
                              setForm({ ...form, tooth_numbers: combined });
                            }
                          }}
                          className={cn(
                            "text-[9px] font-bold px-2 py-1 rounded-lg border transition-all",
                            isActive 
                              ? "bg-[#1499AD] text-white border-[#1499AD] font-black"
                              : "bg-white text-slate-600 border-slate-200"
                          )}
                        >
                          {label}
                        </button>
                      );
                    })}
                    {(form.tooth_numbers || []).length > 0 && (
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, tooth_numbers: [] })}
                        className="text-[9px] font-bold text-rose-500 bg-rose-50 px-2 py-1 rounded-lg ml-auto"
                      >
                        Tozalash
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Modal Actions Footer */}
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex gap-2 shrink-0 rounded-b-[2rem]">
            <Button variant="ghost" onClick={() => setModalOpen(false)} className="h-10 flex-1 rounded-xl font-bold uppercase text-[10px] tracking-wider text-slate-400 hover:bg-slate-100 px-4 border-none">
              Bekor
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={saving}
              className="h-10 flex-1 rounded-xl font-black uppercase text-xs tracking-wider border-none shadow-md bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white active:scale-95 transition-all flex items-center justify-center gap-1.5"
            >
              {saving ? '...' : <><Check className="w-4 h-4 stroke-[3]" /> Saqlash</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Category Name Dialog */}
      <Dialog open={catEditOpen} onOpenChange={setCatEditOpen}>
        <DialogContent className="w-[92vw] max-w-xs p-0 border-none rounded-[2rem] bg-white outline-none overflow-hidden flex flex-col shadow-2xl !left-[50%] !top-[50%] !translate-x-[-50%] !translate-y-[-50%]" aria-describedby={undefined}>
          <DialogHeader className="shrink-0">
            <div className="bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 px-5 py-3.5 flex items-center justify-between text-white rounded-t-[2rem]">
              <DialogTitle className="text-xs font-black text-white uppercase tracking-wider leading-none">Nomni tahrirlash</DialogTitle>
              <button onClick={() => setCatEditOpen(false)} className="w-7 h-7 rounded-full bg-white/15 text-white flex items-center justify-center border-none cursor-pointer"><X className="w-3.5 h-3.5" /></button>
            </div>
          </DialogHeader>
          <div className="p-4 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block ml-1">Bo'limning yangi nomi</Label>
              <Input 
                value={renamingCat.new} 
                onChange={e => setRenamingCat({ ...renamingCat, new: e.target.value })} 
                className="h-10 rounded-xl bg-slate-50 border-none font-bold text-sm px-4"
              />
            </div>
            <Button 
              onClick={() => {
                if (!renamingCat.new) return;
                const newOrder = categoryOrder.map(c => c === renamingCat.old ? renamingCat.new : c);
                handleReorder(newOrder);
                setCatEditOpen(false);
              }}
              className="w-full h-10 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-650 text-white font-black text-xs uppercase tracking-wider border-none shadow-md active:scale-95 transition-all"
            >
              Saqlash
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Category Dialog */}
      <Dialog open={!!catToDelete} onOpenChange={() => setCatToDelete(null)}>
        <DialogContent className="w-[92vw] max-w-xs p-6 border-none rounded-[2rem] bg-white outline-none overflow-hidden text-center shadow-2xl !left-[50%] !top-[50%] !translate-x-[-50%] !translate-y-[-50%]" aria-describedby={undefined}>
          <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-[1.5rem] flex items-center justify-center mx-auto mb-4 border border-rose-100"><Trash2 className="w-8 h-8" /></div>
          <h3 className="text-base font-black text-slate-900 mb-1 uppercase tracking-tight leading-none">Bo'limni o'chirish?</h3>
          <p className="text-slate-400 font-bold text-[10px] mb-6 italic leading-relaxed">"{catToDelete}" bo'limini butunlay o'chirib tashlamoqchimisiz?</p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setCatToDelete(null)} className="flex-1 h-10 rounded-xl font-black text-xs text-slate-400">YO'Q</Button>
            <Button 
              onClick={() => {
                const newOrder = categoryOrder.filter(c => c !== catToDelete);
                handleReorder(newOrder);
                setCatToDelete(null);
              }}
              className="flex-1 h-10 rounded-xl bg-rose-500 text-white font-black text-xs uppercase tracking-wider shadow-md active:scale-95 transition-all border-none"
            >
              HA, O'CHIRILSIN
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
