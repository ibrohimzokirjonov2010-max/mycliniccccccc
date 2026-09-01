import { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Plus, Layers, Trash2, Edit2, Check, X, 
  Search, Sparkles, DollarSign, Tag, RefreshCw,
  CheckCircle2, ArrowUpDown, ChevronRight, FileText
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { 
  CrownIcon, FormerIcon, AbutmentIcon, BoneGraftIcon, 
  SinusLiftIcon, DentalSurgicalIcon 
} from '@/components/ui/Icons';
import { useTranslation } from '@/i18n/LanguageContext';

export const DEFAULT_EXTRA_SERVICES = [
  // 1. Ortopediya & Karonkalar
  { id: 'zirkon_crown', name: 'Zirkon Karonka', price: 1500000, category: 'Ortopediya', description: 'Yuqori aniqlikdagi zirkon keramika toji', is_active: true },
  { id: 'metal_crown', name: 'Metallokeramika Karonka', price: 800000, category: 'Ortopediya', description: 'Klassik metallokeramika qoplamasi', is_active: true },
  { id: 'emax_crown', name: 'E-Max Press Karonka', price: 1800000, category: 'Ortopediya', description: 'Estetik litoborosilikat keramika toji', is_active: true },
  { id: 'temp_crown', name: 'Vaqtinchalik toj (Provisional)', price: 200000, category: 'Ortopediya', description: 'Implantatsiya davridagi vaqtinchalik toj', is_active: true },
  { id: 'veneer', name: 'Vinir (E-Max Press)', price: 1600000, category: 'Ortopediya', description: 'Estetik oldi tishlar viniri', is_active: true },

  // 2. Abatment & Komponentlar
  { id: 'standard_abutment', name: 'Standart Abutment', price: 300000, category: 'Komponent', description: 'Titanium standart implant abutmenti', is_active: true },
  { id: 'zirkon_abutment', name: 'Individual Zirkon Abutment', price: 600000, category: 'Komponent', description: 'Shaxsiy CAD/CAM zirkon abutment', is_active: true },
  { id: 'multi_unit', name: 'Multi-unit Abatment', price: 500000, category: 'Komponent', description: 'All-on-4 / All-on-6 uchun multi-unit', is_active: true },
  { id: 'healing_abutment', name: 'Formik (Healing Abutment)', price: 100000, category: 'Komponent', description: 'Milya shakllantiruvchi qopqoq', is_active: true },
  { id: 'cover_screw', name: 'Zaglushka (Cover screw)', price: 100000, category: 'Komponent', description: 'Implant ichki himoya vinti', is_active: true },

  // 3. Sinus & Jarrohlik
  { id: 'open_sinus', name: 'Ochiq sinus-lifting', price: 2500000, category: 'Jarrohlik', description: 'Yon oynali ochiq gaymor bo\'shlig\'ini ko\'tarish', is_active: true },
  { id: 'closed_sinus', name: 'Yopiq sinus-lifting', price: 1500000, category: 'Jarrohlik', description: 'Vertikal yopiq sinus ko\'tarish', is_active: true },
  { id: 'surgical_guide', name: 'Jarrohlik shabloni (Surgical Guide)', price: 500000, category: 'Jarrohlik', description: '3D navigatsion implant shabloni', is_active: true },
  { id: 'piezo', name: 'Piezosurgery (Ultrasonik jarrohlik)', price: 400000, category: 'Jarrohlik', description: 'Ultratovushli nozik suyak jarrohligi', is_active: true },
  { id: 'extraction', name: 'Atravmatik tish olish', price: 250000, category: 'Jarrohlik', description: 'Implant uchun suyakni saqlagan holda tish olish', is_active: true },
  { id: 'explantation', name: 'Implantni olib tashlash', price: 500000, category: 'Jarrohlik', description: 'Muvaffaqiyatsiz implantni olib tashlash', is_active: true },

  // 4. Suyak & Regeneratsiya
  { id: 'bone_graft', name: 'Sun\'iy suyak ekish (Bone graft)', price: 1200000, category: 'Regeneratsiya', description: 'Osteoplastik material (0.5g - 1g)', is_active: true },
  { id: 'membrane', name: 'Membrana qo\'yish (Kollagen)', price: 800000, category: 'Regeneratsiya', description: 'Resorblanuvchi himoya membranasi', is_active: true },
  { id: 'prf', name: 'PRF / A-PRF (Plazmolifting)', price: 300000, category: 'Regeneratsiya', description: 'Bemor qonidan olingan o\'sish omillari membranasi', is_active: true },
  { id: 'nkr', name: 'NKR qo\'yish (GBR)', price: 1000000, category: 'Regeneratsiya', description: 'Yo\'naltirilgan suyak regeneratsiyasi', is_active: true },
  { id: 'sst', name: 'SST ko\'chirish (Soft Tissue Graft)', price: 800000, category: 'Regeneratsiya', description: 'Yumshoq to\'qima autotransplantatsiyasi', is_active: true },
  { id: 'gingivoplasty', name: 'Gingivoplastika', price: 400000, category: 'Regeneratsiya', description: 'Milya konturini to\'g\'rilash va plastikasi', is_active: true }
];

const CATEGORIES = ['Barchasi', 'Ortopediya', 'Komponent', 'Jarrohlik', 'Regeneratsiya', 'Boshqa'];

const QUICK_PRICES = [100000, 200000, 300000, 500000, 800000, 1000000, 1200000, 1500000, 1800000, 2000000, 2500000, 3000000];

const STORAGE_KEY = 'clinic_extra_services_catalog_v2';

/**
 * Fetch or auto-seed extra services catalog
 */
export async function getOrSeedExtraServices() {
  try {
    const local = localStorage.getItem(STORAGE_KEY);
    if (local) {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
    // Default seed
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_EXTRA_SERVICES));
    return DEFAULT_EXTRA_SERVICES;
  } catch (e) {
    console.error('Error fetching extra services:', e);
    return DEFAULT_EXTRA_SERVICES;
  }
}

export default function ExtraServicesManagerModal({
  open,
  onClose,
  onServicesUpdated
}) {
  const { language } = useTranslation();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Barchasi');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [saving, setSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    price: 500000,
    category: 'Ortopediya',
    description: '',
    is_active: true
  });

  const loadServices = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getOrSeedExtraServices();
      setServices(list);
    } catch (e) {
      console.error(e);
      toast.error("Xizmatlar ro'yxatini yuklashda xatolik");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadServices();
      setShowAddForm(false);
      setEditingService(null);
    }
  }, [open, loadServices]);

  const filteredServices = useMemo(() => {
    return services.filter(s => {
      if (selectedCategory !== 'Barchasi' && s.category !== selectedCategory) return false;
      if (search) {
        const q = search.toLowerCase();
        const nameMatch = (s.name || '').toLowerCase().includes(q);
        const descMatch = (s.description || '').toLowerCase().includes(q);
        const catMatch = (s.category || '').toLowerCase().includes(q);
        if (!nameMatch && !descMatch && !catMatch) return false;
      }
      return true;
    });
  }, [services, selectedCategory, search]);

  const stats = useMemo(() => {
    const total = services.length;
    const active = services.filter(s => s.is_active !== false).length;
    const avgPrice = total > 0 ? Math.round(services.reduce((acc, curr) => acc + (Number(curr.price) || 0), 0) / total) : 0;
    return { total, active, avgPrice };
  }, [services]);

  const handleSaveService = async (e) => {
    e?.preventDefault();
    if (!formData.name?.trim()) {
      toast.warning("Iltimos, xizmat nomini kiriting!");
      return;
    }
    const numPrice = Number(formData.price);
    if (isNaN(numPrice) || numPrice < 0) {
      toast.warning("Iltimos, to'g'ri narx kiriting!");
      return;
    }

    setSaving(true);
    try {
      let updatedList = [];
      if (editingService) {
        // Update existing service
        updatedList = services.map(s => s.id === editingService.id ? {
          ...s,
          name: formData.name.trim(),
          price: numPrice,
          category: formData.category || 'Ortopediya',
          description: formData.description?.trim() || '',
          is_active: formData.is_active !== false
        } : s);
        toast.success(`"${formData.name}" xizmati narxi va ma'lumotlari yangilandi!`);
      } else {
        // Add new service
        const newSvc = {
          id: 'extra_' + Date.now(),
          name: formData.name.trim(),
          price: numPrice,
          category: formData.category || 'Ortopediya',
          description: formData.description?.trim() || '',
          is_active: true
        };
        updatedList = [newSvc, ...services];
        toast.success(`Yangi xizmat qo'shildi: ${newSvc.name} (${numPrice.toLocaleString()} so'm)`);
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
      setServices(updatedList);
      setShowAddForm(false);
      setEditingService(null);
      setFormData({ name: '', price: 500000, category: 'Ortopediya', description: '', is_active: true });
      onServicesUpdated?.(updatedList);
    } catch (err) {
      console.error(err);
      toast.error("Xizmatni saqlashda xatolik yuz berdi");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteService = (service) => {
    if (!window.confirm(`Haqiqatan ham "${service.name}" xizmatini o'chirmoqchimisiz?`)) return;
    try {
      const updatedList = services.filter(s => s.id !== service.id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
      setServices(updatedList);
      toast.success(`"${service.name}" xizmati o'chirildi`);
      onServicesUpdated?.(updatedList);
    } catch (e) {
      console.error(e);
      toast.error("O'chirishda xatolik");
    }
  };

  const startEdit = (svc) => {
    setEditingService(svc);
    setFormData({
      name: svc.name || '',
      price: Number(svc.price) || 0,
      category: svc.category || 'Ortopediya',
      description: svc.description || '',
      is_active: svc.is_active !== false
    });
    setShowAddForm(true);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent 
        className="w-[95vw] max-w-4xl max-h-[92vh] p-0 overflow-hidden rounded-[2rem] border-none shadow-2xl flex flex-col bg-white" 
        aria-describedby={undefined}
      >
        {/* Header */}
        <DialogHeader className="shrink-0">
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-6 py-4 flex items-center justify-between text-white rounded-t-[2rem]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600/30 border border-indigo-400/30 backdrop-blur-sm flex items-center justify-center shadow-xs">
                <Sparkles className="w-5 h-5 text-amber-300" />
              </div>
              <div>
                <DialogTitle className="text-base font-black text-white uppercase tracking-tight flex items-center gap-2">
                  <span>Qo'shimcha Xizmatlar & Prays-list</span>
                  <span className="text-[10px] font-black bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 px-2 py-0.5 rounded-full">
                    {stats.total} ta xizmat
                  </span>
                </DialogTitle>
                <p className="text-[10px] font-bold text-slate-300 mt-0.5">
                  Klinikadagi barcha qo'shimcha xizmatlar, karonkalar, abutmentlar va narxlarni boshqarish
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                onClick={() => {
                  if (showAddForm && !editingService) {
                    setShowAddForm(false);
                  } else {
                    setEditingService(null);
                    setFormData({ name: '', price: 500000, category: 'Ortopediya', description: '', is_active: true });
                    setShowAddForm(true);
                  }
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-9 px-3.5 text-xs font-black gap-1.5 shadow-md shadow-indigo-500/20 active:scale-95 transition-all cursor-pointer"
              >
                {showAddForm && !editingService ? (
                  <>
                    <X className="w-4 h-4" />
                    <span>Yopish</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>+ Yangi xizmat qo'shish</span>
                  </>
                )}
              </Button>

              <button 
                onClick={onClose} 
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center active:scale-90 transition-all border-none cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </DialogHeader>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs no-scrollbar">

          {/* Quick KPI Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3">
              <span className="text-[9.5px] font-black uppercase text-slate-400 block tracking-wider">Jami Xizmatlar</span>
              <span className="text-base font-black font-mono text-slate-900 block my-0.5">{stats.total} ta</span>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3">
              <span className="text-[9.5px] font-black uppercase text-slate-400 block tracking-wider">Faol Xizmatlar</span>
              <span className="text-base font-black font-mono text-emerald-700 block my-0.5">{stats.active} ta</span>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3">
              <span className="text-[9.5px] font-black uppercase text-slate-400 block tracking-wider">O'rtacha Narx</span>
              <span className="text-base font-black font-mono text-indigo-700 block my-0.5">{stats.avgPrice.toLocaleString()} so'm</span>
            </div>
          </div>

          {/* ─── ADD / EDIT SERVICE FORM (Collapsible) ─── */}
          <AnimatePresence>
            {showAddForm && (
              <motion.form
                initial={{ opacity: 0, height: 0, scale: 0.98 }}
                animate={{ opacity: 1, height: 'auto', scale: 1 }}
                exit={{ opacity: 0, height: 0, scale: 0.98 }}
                onSubmit={handleSaveService}
                className="bg-gradient-to-br from-indigo-50/70 via-white to-purple-50/50 p-4 sm:p-5 rounded-2xl border-2 border-indigo-200 shadow-sm space-y-3.5 overflow-hidden"
              >
                <div className="flex items-center justify-between border-b border-indigo-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                      {editingService ? <Edit2 className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                    </div>
                    <h3 className="font-black text-slate-900 text-xs sm:text-sm uppercase tracking-wide">
                      {editingService ? `"${editingService.name}" xizmatini tahrirlash` : "Yangi qo'shimcha xizmat qo'shish va narx kiritish"}
                    </h3>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => { setShowAddForm(false); setEditingService(null); }}
                    className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* 1. Xizmat Nomi */}
                  <div className="sm:col-span-2 space-y-1">
                    <Label className="text-[10px] font-black text-slate-700 uppercase tracking-wider block">
                      Xizmat Nomi *
                    </Label>
                    <Input
                      placeholder="Masalan: Zirkon Karonka, Sinus-lifting, Bone graft..."
                      value={formData.name}
                      onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="bg-white border-slate-200 focus:border-indigo-500 h-10 rounded-xl font-bold text-xs shadow-2xs"
                      autoFocus
                    />
                  </div>

                  {/* 2. Kategoriya */}
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black text-slate-700 uppercase tracking-wider block">
                      Toifasi (Kategoriya)
                    </Label>
                    <Select 
                      value={formData.category} 
                      onValueChange={val => setFormData(prev => ({ ...prev, category: val }))}
                    >
                      <SelectTrigger className="h-10 bg-white border-slate-200 rounded-xl font-bold text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl font-bold text-xs">
                        <SelectItem value="Ortopediya">Ortopediya</SelectItem>
                        <SelectItem value="Komponent">Komponent</SelectItem>
                        <SelectItem value="Jarrohlik">Jarrohlik</SelectItem>
                        <SelectItem value="Regeneratsiya">Regeneratsiya</SelectItem>
                        <SelectItem value="Boshqa">Boshqa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* 3. Narx kiritish */}
                <div className="space-y-2 bg-white/80 p-3 rounded-xl border border-indigo-100">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-black text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-600" /> Xizmat Narxi (so'm) *
                    </Label>
                    <span className="text-xs font-mono font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                      {(Number(formData.price) || 0).toLocaleString()} UZS
                    </span>
                  </div>

                  <div className="relative">
                    <Input
                      type="number"
                      step="10000"
                      value={formData.price}
                      onChange={e => setFormData(prev => ({ ...prev, price: e.target.value }))}
                      placeholder="1500000"
                      className="bg-white border-emerald-300 focus:border-emerald-500 h-10 rounded-xl font-mono font-black text-slate-900 text-sm pr-14 shadow-2xs"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-emerald-700">
                      SO'M
                    </span>
                  </div>

                  {/* Quick Price Buttons */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <span className="text-[9.5px] font-bold text-slate-400 mr-1">Tezkor narxlar:</span>
                    {QUICK_PRICES.map(amt => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, price: amt }))}
                        className={cn(
                          "px-2 py-0.5 rounded-lg text-[9.5px] font-mono font-bold border transition-all cursor-pointer",
                          Number(formData.price) === amt 
                            ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs scale-105" 
                            : "bg-white text-slate-600 border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/50"
                        )}
                      >
                        {amt >= 1000000 ? `${amt / 1000000} mln` : `${amt / 1000}k`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4. Tavsif & Saqlash */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
                  <div className="flex-1">
                    <Input
                      placeholder="Qisqacha tavsif yoki izoh (ixtiyoriy)..."
                      value={formData.description}
                      onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      className="bg-white border-slate-200 h-9.5 rounded-xl font-semibold text-xs text-slate-700"
                    />
                  </div>

                  <div className="flex items-center gap-2 justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => { setShowAddForm(false); setEditingService(null); }}
                      className="h-9.5 rounded-xl font-bold text-xs"
                    >
                      Bekor qilish
                    </Button>
                    <Button
                      type="submit"
                      disabled={saving}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white h-9.5 px-5 rounded-xl font-black text-xs shadow-md shadow-indigo-500/20 cursor-pointer"
                    >
                      {saving ? "Saqlanmoqda..." : editingService ? "O'zgarishlarni saqlash" : "+ Xizmatni saqlash"}
                    </Button>
                  </div>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Search & Category Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-slate-50 p-2.5 rounded-2xl border border-slate-200/80">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Xizmat nomi yoki toifasi bo'yicha qidirish..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full h-9 pl-9 pr-8 bg-white rounded-xl border border-slate-200 focus:border-indigo-500 font-semibold text-xs outline-none"
              />
              {search && (
                <button 
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Categories */}
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-[11px] font-black whitespace-nowrap transition-all cursor-pointer",
                    selectedCategory === cat
                      ? "bg-slate-900 text-white shadow-xs"
                      : "bg-white text-slate-600 hover:bg-slate-200/60 border border-slate-200/80"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* ─── SERVICES LIST / DATA GRID ─── */}
          <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-[11px] font-black text-slate-600 uppercase tracking-wider">
                    <th className="w-12 py-3 px-3 text-center border-r border-slate-200">№</th>
                    <th className="py-3 px-3.5 border-r border-slate-200 min-w-[200px]">Xizmat Nomi</th>
                    <th className="w-32 py-3 px-3 text-center border-r border-slate-200">Toifasi</th>
                    <th className="w-44 py-3 px-3.5 text-right border-r border-slate-200 bg-emerald-50/40 text-emerald-900">
                      Narxi (so'm)
                    </th>
                    <th className="py-3 px-3 border-r border-slate-200 min-w-[180px]">Tavsifi</th>
                    <th className="w-28 py-3 px-3 text-center">Amallar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 text-xs font-semibold">
                  {filteredServices.length > 0 ? (
                    filteredServices.map((svc, idx) => {
                      const numPrice = Number(svc.price) || 0;
                      return (
                        <tr 
                          key={svc.id} 
                          className={`hover:bg-indigo-50/30 transition-colors ${idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'}`}
                        >
                          <td className="text-center font-mono font-bold text-slate-400 py-2.5 px-3 border-r border-slate-200/70">
                            {idx + 1}
                          </td>

                          {/* Service Name */}
                          <td className="py-2.5 px-3.5 border-r border-slate-200/70">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                              <span className="font-black text-slate-900 text-xs">
                                {svc.name}
                              </span>
                            </div>
                          </td>

                          {/* Category */}
                          <td className="py-2.5 px-3 text-center border-r border-slate-200/70">
                            <span className={cn(
                              "px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider border",
                              svc.category === 'Ortopediya' ? "bg-indigo-50 text-indigo-700 border-indigo-200" :
                              svc.category === 'Komponent' ? "bg-purple-50 text-purple-700 border-purple-200" :
                              svc.category === 'Jarrohlik' ? "bg-sky-50 text-sky-700 border-sky-200" :
                              svc.category === 'Regeneratsiya' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                              "bg-slate-100 text-slate-700 border-slate-200"
                            )}>
                              {svc.category || 'Ortopediya'}
                            </span>
                          </td>

                          {/* Price */}
                          <td className="py-2.5 px-3.5 text-right font-mono font-black text-emerald-700 border-r border-slate-200/70 bg-emerald-50/20 text-xs sm:text-sm">
                            {numPrice.toLocaleString()} <span className="text-[10px] font-bold text-emerald-600/80 uppercase">SO'M</span>
                          </td>

                          {/* Description */}
                          <td className="py-2.5 px-3 text-slate-500 border-r border-slate-200/70 text-[11px] truncate max-w-[220px]">
                            {svc.description || '—'}
                          </td>

                          {/* Actions */}
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => startEdit(svc)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-all cursor-pointer"
                                title="Tahrirlash va narxini o'zgartirish"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteService(svc)}
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
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center gap-2">
                          <Layers className="w-8 h-8 text-slate-300" />
                          <p className="text-xs font-bold">Xizmatlar topilmadi</p>
                          <Button 
                            size="sm" 
                            onClick={() => {
                              setShowAddForm(true);
                              setEditingService(null);
                              setFormData({ name: '', price: 500000, category: 'Ortopediya', description: '', is_active: true });
                            }}
                            className="bg-indigo-600 text-white rounded-xl text-xs font-black h-8 mt-1 cursor-pointer"
                          >
                            + Yangi xizmat qo'shish
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
