import { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Search, Stethoscope, Edit2, Trash2, Clock, 
  ChevronRight, Activity, Scissors, Layers, Baby, 
  ShieldCheck, Syringe, Sparkles, Filter, TrendingUp,
  MoreVertical, Pencil, Settings2, Check, ArrowLeft, X
} from 'lucide-react';
import { base44, DEFAULT_SERVICES_DATA } from '@/api/base44Client';
import { useTranslation } from '@/i18n/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { cn } from '@/lib/utils';

const ALLOWED_CATEGORIES = [
  'TERAPIYA( ENDO +PLOMBA)',
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
  'TERAPIYA( ENDO +PLOMBA)': { icon: Activity, color: 'text-blue-500', bg: 'bg-blue-50' },
  'XIRURGIYA': { icon: Scissors, color: 'text-rose-500', bg: 'bg-rose-50' },
  'ORTOPEDIYA': { icon: Layers, color: 'text-violet-500', bg: 'bg-violet-50' },
  'ORTODONTIYA': { icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-50' },
  'GIGIENA VA PROFILAKTIKA': { icon: Sparkles, color: 'text-cyan-500', bg: 'bg-cyan-50' },
  'ESTETIK STOMATOLOGIYA': { icon: Sparkles, color: 'text-pink-500', bg: 'bg-pink-50' },
  'BOLALAR STOMATOLOGIYASI': { icon: Baby, color: 'text-orange-500', bg: 'bg-orange-50' },
  'IMPLANTATSIYA': { icon: Syringe, color: 'text-indigo-500', bg: 'bg-indigo-50' },
  'ENDODONTIYA': { icon: Activity, color: 'text-teal-500', bg: 'bg-teal-50' }
};

const getCategoryStyle = (cat) => CATEGORY_MAP[cat] || CATEGORY_MAP['TERAPIYA( ENDO +PLOMBA)'];

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
  return 'TERAPIYA( ENDO +PLOMBA)';
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
    name: '', category: 'TERAPIYA( ENDO +PLOMBA)', price: '', duration: '30', is_active: true, requires_tooth: false 
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
        requires_tooth: editService.requires_tooth || false
      });
    } else {
      setForm({ name: '', category: 'TERAPIYA( ENDO +PLOMBA)', price: '', duration: '30', is_active: true, requires_tooth: false });
    }
  }, [editService, modalOpen]);

  const filtered = services.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase());
    if (selectedCategory === 'all') return matchesSearch;
    const displayCategory = s.category || autoCategorize(s.name);
    return matchesSearch && displayCategory === selectedCategory;
  });

  const grouped = useMemo(() => {
    const groups = {};
    filtered.forEach(s => {
      const cat = s.category || autoCategorize(s.name);
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
    <div className="pb-24 pt-4 px-4 bg-[#f8fafc] min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">{t('services.title')}</h1>
          <p className="text-slate-500 font-medium text-sm">{t('services.subtitle')}</p>
        </div>
        <button 
          onClick={() => { setEditService(null); setModalOpen(true); }}
          className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-slate-200 active:scale-90 transition-transform"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between mb-4 px-1">
          <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">{t('services.sidebar.categories')}</span>
          <button 
            onClick={() => setIsReordering(!isReordering)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
              isReordering ? "bg-emerald-500 text-white shadow-lg shadow-emerald-200" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            )}
          >
            {isReordering ? <><Check className="w-3 h-3" /> SAQLASH</> : <><Settings2 className="w-3 h-3" /> JOYINI O'ZGARTIRISH</>}
          </button>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 no-scrollbar items-center">
          <button
            onClick={() => setSelectedCategory('all')}
            className={cn(
              "shrink-0 whitespace-nowrap px-6 py-3.5 rounded-[22px] font-black text-[13px] transition-all duration-300 border-2",
              selectedCategory === 'all' 
                ? "bg-slate-900 text-white border-slate-900 shadow-xl shadow-slate-200 scale-105" 
                : "bg-white text-slate-500 border-slate-50 hover:border-slate-200 shadow-sm",
              isReordering && "opacity-50 grayscale pointer-events-none"
            )}
          >
            {t('services.sidebar.all')}
          </button>

          <Reorder.Group 
            axis="x" 
            values={categoryOrder} 
            onReorder={handleReorder}
            className="flex gap-3 items-center shrink-0"
          >
            {categoryOrder.map((cat) => (
              <Reorder.Item key={cat} value={cat} dragListener={isReordering} className="shrink-0">
                <div className="relative">
                  <button
                    onClick={() => !isReordering && setSelectedCategory(cat)}
                    className={cn(
                      "shrink-0 whitespace-nowrap px-6 py-3.5 rounded-[22px] font-black text-[13px] transition-all duration-300 border-2",
                      selectedCategory === cat 
                        ? "bg-slate-900 text-white border-slate-900 shadow-xl shadow-slate-200 scale-105" 
                        : "bg-white text-slate-500 border-slate-50 hover:border-slate-200 shadow-sm",
                      isReordering 
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700 animate-pulse cursor-move ring-4 ring-emerald-500/10 touch-none"
                        : "touch-pan-x"
                    )}
                  >
                    {cat}
                  </button>
                  {isReordering && (
                    <div className="absolute -top-3 -right-2 flex gap-1">
                      <button 
                         onClick={(e) => { e.stopPropagation(); setRenamingCat({ old: cat, new: cat }); setCatEditOpen(true); }}
                         className="w-7 h-7 bg-white shadow-lg border border-slate-100 rounded-full flex items-center justify-center text-blue-500 active:scale-90"
                      >
                         <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button 
                         onClick={(e) => { e.stopPropagation(); setCatToDelete(cat); }}
                         className="w-7 h-7 bg-white shadow-lg border border-slate-100 rounded-full flex items-center justify-center text-rose-500 active:scale-90"
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

      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <Input 
          placeholder={t('services.sidebar.search')}
          value={search} 
          onChange={e => setSearch(e.target.value)} 
          className="pl-12 h-14 rounded-2xl bg-white border-none shadow-sm font-bold text-slate-600 focus:ring-2 focus:ring-slate-900/10"
        />
      </div>

      <div className="space-y-10">
        {grouped.map(([catName, items]) => {
          const style = getCategoryStyle(catName);
          const Icon = style.icon;
          return (
            <div key={catName} className="space-y-4">
              <div className="flex items-center gap-2 px-1">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{catName}</span>
                <Badge variant="secondary" className="bg-slate-100 text-slate-400 border-none rounded-lg px-2 h-5 text-[10px] font-black">{items.length}</Badge>
              </div>
              <div className="space-y-3">
                <AnimatePresence>
                  {items.map(s => (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={s.id}
                      className="bg-white p-5 rounded-[28px] border border-slate-50 shadow-sm flex items-center justify-between active:scale-98 transition-transform"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-14 h-14 rounded-[20px] ${style.bg} ${style.color} flex items-center justify-center shadow-inner`}>
                          <Icon className="w-7 h-7" />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 leading-tight mb-1">{s.name}</h3>
                          <div className="flex items-center gap-3">
                            <span className="font-black text-emerald-600 text-sm">{Number(s.price).toLocaleString()} so'm</span>
                            <span className="flex items-center gap-1 text-[11px] font-bold text-slate-400"><Clock className="w-3 h-3" /> {s.duration} min</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setEditService(s); setModalOpen(true); }} className="p-3 text-slate-300 hover:text-slate-900"><Pencil className="w-5 h-5" /></button>
                        <button onClick={() => handleDelete(s.id)} className="p-3 text-rose-200 hover:text-rose-500"><Trash2 className="w-5 h-5" /></button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md p-6 rounded-[32px] border-none shadow-2xl bg-white overflow-hidden">
          {/* Header Row */}
          <div className="flex items-center justify-between mb-6 pb-2 border-b border-slate-100">
            <button 
              onClick={() => setModalOpen(false)} 
              className="w-10 h-10 rounded-full bg-slate-50 active:bg-slate-100 flex items-center justify-center text-slate-600 active:scale-90 transition-all border border-slate-100"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <DialogTitle className="text-base font-black text-slate-900 uppercase tracking-tight">
              {editService ? t('services.modals.editTitle') : t('services.modals.addTitle')}
            </DialogTitle>
            <button 
              onClick={() => setModalOpen(false)} 
              className="w-10 h-10 rounded-full bg-slate-50 active:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 active:scale-90 transition-all border border-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-5">
            {/* Input: Service Name */}
            <div className="space-y-2">
              <label className="ml-1 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] flex items-center gap-1.5">
                <Stethoscope className="w-3.5 h-3.5 text-slate-400" />
                {t('services.modals.name')}
              </label>
              <Input 
                value={form.name} 
                onChange={e => setForm({ ...form, name: e.target.value })} 
                placeholder="Xizmat nomini kiriting..."
                className="h-13 rounded-2xl bg-slate-50 border border-slate-100 focus:border-[#1499AD] focus:ring-4 focus:ring-[#1499AD]/5 font-bold text-slate-800 px-5 text-sm transition-all"
              />
            </div>

            {/* Inputs: Price & Duration */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="ml-1 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-slate-400" />
                  {t('services.modals.price')}
                </label>
                <div className="relative">
                  <Input 
                    type="number" 
                    value={form.price} 
                    onChange={e => setForm({ ...form, price: e.target.value })} 
                    placeholder="0"
                    className="h-13 rounded-2xl bg-slate-50 border border-slate-100 focus:border-[#1499AD] focus:ring-4 focus:ring-[#1499AD]/5 font-black text-slate-800 pl-5 pr-12 text-sm transition-all"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 uppercase">so'm</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="ml-1 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  {t('services.modals.duration')}
                </label>
                <div className="relative">
                  <Input 
                    type="number" 
                    value={form.duration} 
                    onChange={e => setForm({ ...form, duration: e.target.value })} 
                    placeholder="30"
                    className="h-13 rounded-2xl bg-slate-50 border border-slate-100 focus:border-[#1499AD] focus:ring-4 focus:ring-[#1499AD]/5 font-black text-slate-800 pl-5 pr-12 text-sm transition-all"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 uppercase">min</span>
                </div>
              </div>
            </div>

            {/* Toggles Group Card */}
            <div className="border border-slate-100 bg-slate-50/50 rounded-2xl overflow-hidden divide-y divide-slate-100">
              <div className="flex items-center justify-between p-4 bg-white hover:bg-slate-50/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-500 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-bold text-xs text-slate-800">{t('services.modals.active')}</p>
                    <p className="text-[10px] font-medium text-slate-450">Xizmatdan foydalanish faolligi</p>
                  </div>
                </div>
                <Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} />
              </div>
              
              <div className="flex items-center justify-between p-4 bg-white hover:bg-slate-50/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#1499AD]/10 text-[#1499AD] flex items-center justify-center">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-bold text-xs text-slate-800">{t('services.modals.tooth')}</p>
                    <p className="text-[10px] font-medium text-slate-450">Tish raqamini tanlash majburiyati</p>
                  </div>
                </div>
                <Switch checked={form.requires_tooth} onCheckedChange={v => setForm({ ...form, requires_tooth: v })} />
              </div>
            </div>

            {/* Action Save Button */}
            <Button 
              onClick={handleSave} 
              disabled={saving} 
              className="w-full h-14 rounded-2xl bg-[#1499AD] hover:bg-[#1499AD]/90 text-white font-black text-sm mt-4 shadow-xl shadow-[#1499AD]/10 active:scale-95 transition-all flex items-center justify-center gap-2 border-none"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{t('common.save')}...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>{t('common.save')}</span>
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={catEditOpen} onOpenChange={setCatEditOpen}>
        <DialogContent className="sm:max-w-md p-8 rounded-[40px] border-none shadow-2xl">
          <DialogHeader className="mb-6"><DialogTitle className="text-2xl font-black text-slate-900 text-center uppercase tracking-tighter">BO'LIM NOMINI TAHRIRLASH</DialogTitle></DialogHeader>
          <div className="space-y-6">
            <div className="space-y-2">
              <Label className="ml-2 text-xs font-black text-slate-400 uppercase tracking-widest">Yangi nomni kiriting</Label>
              <Input 
                value={renamingCat.new} 
                onChange={e => setRenamingCat({ ...renamingCat, new: e.target.value })} 
                className="h-14 rounded-2xl bg-slate-50 border-none font-bold text-lg px-6"
              />
            </div>
            <Button 
              onClick={() => {
                if (!renamingCat.new) return;
                const newOrder = categoryOrder.map(c => c === renamingCat.old ? renamingCat.new : c);
                handleReorder(newOrder);
                setCatEditOpen(false);
              }}
              className="w-full h-16 rounded-[24px] bg-slate-900 text-white font-black text-lg shadow-xl shadow-slate-200 active:scale-95 transition-all"
            >
              SAQLASH
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!catToDelete} onOpenChange={() => setCatToDelete(null)}>
        <DialogContent className="sm:max-w-md p-10 rounded-[40px] border-none shadow-2xl text-center">
          <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-[32px] flex items-center justify-center mx-auto mb-6"><Trash2 className="w-10 h-10" /></div>
          <h3 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tight">O'CHIRILSINMI?</h3>
          <p className="text-slate-500 font-bold mb-8 italic">"{catToDelete}" bo'limini butunlay o'chirib tashlamoqchimisiz?</p>
          <div className="flex gap-4">
            <Button variant="ghost" onClick={() => setCatToDelete(null)} className="flex-1 h-14 rounded-2xl font-black text-slate-400">YO'Q</Button>
            <Button 
              onClick={() => {
                const newOrder = categoryOrder.filter(c => c !== catToDelete);
                handleReorder(newOrder);
                setCatToDelete(null);
              }}
              className="flex-1 h-14 rounded-2xl bg-rose-500 text-white font-black shadow-lg shadow-rose-100 active:scale-95 transition-all"
            >
              HA, O'CHIRILSIN
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
