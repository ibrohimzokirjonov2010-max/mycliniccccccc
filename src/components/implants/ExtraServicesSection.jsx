import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Plus, Layers, Trash2, Edit2, Check, X, 
  Search, Sparkles, DollarSign, Tag, RefreshCw,
  CheckCircle2, ArrowUpDown, ChevronRight, FileText, UserCheck, Stethoscope,
  Phone, Eye, Calendar, User
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/LanguageContext';
import { getOrSeedExtraServices, DEFAULT_EXTRA_SERVICES } from './ExtraServicesManagerModal';

const CATEGORIES = ['Barchasi', 'Ortopediya', 'Komponent', 'Jarrohlik', 'Regeneratsiya', 'Boshqa'];
const QUICK_PRICES = [100000, 200000, 300000, 500000, 800000, 1000000, 1200000, 1500000, 1800000, 2000000, 2500000, 3000000];
const STORAGE_KEY = 'clinic_extra_services_catalog_v2';

export default function ExtraServicesSection({ 
  onServicesUpdated,
  patientOperations = [],
  patients = [],
  onOpenAddExtraPatientService,
  onEditPatientOperation,
  onDeletePatientOperation,
  onOpenStatusSheet
}) {
  const { language } = useTranslation();
  const [subView, setSubView] = useState('catalog'); // 'catalog' | 'patient_records'
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
    loadServices();
  }, [loadServices]);

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
        // Update existing
        updatedList = services.map(s => s.id === editingService.id ? {
          ...s,
          name: formData.name.trim(),
          price: numPrice,
          category: formData.category || 'Ortopediya',
          description: formData.description?.trim() || '',
          is_active: formData.is_active !== false
        } : s);
        toast.success(`"${formData.name}" xizmati va narxi muvaffaqiyatli yangilandi!`);
      } else {
        // Create new
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
    window.scrollTo({ top: 250, behavior: 'smooth' });
  };

  return (
    <div className="space-y-4">
      {/* ── Top Header and View Switcher ── */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs shrink-0">
            <Sparkles className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                Qo'shimcha Xizmatlar & Prays-list
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                {stats.total} ta xizmat
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-400 mt-0.5">
              Klinikadagi barcha qo'shimcha xizmatlar, karonkalar, jarrohlik amaliyotlarini boshqarish va narxlarini belgilash
            </p>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-2">
          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200/80">
            <button
              onClick={() => setSubView('catalog')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer",
                subView === 'catalog'
                  ? "bg-white text-indigo-700 shadow-xs ring-1 ring-slate-200/80"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                Prays-list ({stats.total})
              </span>
            </button>

            {patientOperations.length > 0 && (
              <button
                onClick={() => setSubView('patient_records')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer",
                  subView === 'patient_records'
                    ? "bg-white text-indigo-700 shadow-xs ring-1 ring-slate-200/80"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <span className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-600" />
                  Bemor Amaliyotlari ({patientOperations.length})
                </span>
              </button>
            )}
          </div>

          {subView === 'catalog' && (
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
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-10 px-4 text-xs font-black gap-1.5 shadow-md shadow-indigo-500/20 active:scale-95 transition-all cursor-pointer"
            >
              {showAddForm && !editingService ? (
                <>
                  <X className="w-4 h-4" />
                  <span>Yopish</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>+ Yangi xizmat</span>
                </>
              )}
            </Button>
          )}

          {subView === 'patient_records' && onOpenAddExtraPatientService && (
            <Button
              onClick={onOpenAddExtraPatientService}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-10 px-4 text-xs font-black gap-1.5 shadow-md shadow-indigo-500/20 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Bemorga xizmat yozish</span>
            </Button>
          )}
        </div>
      </div>

      {subView === 'catalog' ? (
        <>
          {/* ── Quick KPI Stat Cards ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
              <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">Jami Xizmatlar</span>
              <span className="text-xl font-black font-mono text-slate-900 block my-0.5">{stats.total} ta</span>
              <span className="text-[10px] font-bold text-slate-400 block">Katalogdagi barcha xizmatlar</span>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
              <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">Faol Xizmatlar</span>
              <span className="text-xl font-black font-mono text-emerald-700 block my-0.5">{stats.active} ta</span>
              <span className="text-[10px] font-bold text-emerald-600 block">Amaliyotda foydalanishga tayyor</span>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
              <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">O'rtacha Narx</span>
              <span className="text-xl font-black font-mono text-indigo-700 block my-0.5">{stats.avgPrice.toLocaleString()} so'm</span>
              <span className="text-[10px] font-bold text-indigo-600 block">Barcha xizmatlar o'rtachasi</span>
            </div>
          </div>

          {/* ── Collapsible Add / Edit Service Form ── */}
          <AnimatePresence>
            {showAddForm && (
              <motion.form
                initial={{ opacity: 0, height: 0, scale: 0.98 }}
                animate={{ opacity: 1, height: 'auto', scale: 1 }}
                exit={{ opacity: 0, height: 0, scale: 0.98 }}
                onSubmit={handleSaveService}
                className="bg-gradient-to-br from-indigo-50/70 via-white to-purple-50/50 p-5 rounded-2xl border-2 border-indigo-200 shadow-md space-y-4 overflow-hidden"
              >
                <div className="flex items-center justify-between border-b border-indigo-100 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                      {editingService ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    </div>
                    <div>
                      <h3 className="font-black text-slate-900 text-sm uppercase tracking-wide">
                        {editingService ? `"${editingService.name}" xizmatini tahrirlash` : "Yangi qo'shimcha xizmat qo'shish va narxini kiritish"}
                      </h3>
                      <p className="text-[10px] font-bold text-indigo-600 mt-0.5">
                        Xizmat nomini, toifasini va narxini kiriting. Ushbu xizmat implant operatsiyalari davomida avtomatik chiqadi.
                      </p>
                    </div>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => { setShowAddForm(false); setEditingService(null); }}
                    className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* 1. Xizmat Nomi */}
                  <div className="sm:col-span-2 space-y-1">
                    <Label className="text-[10px] font-black text-slate-700 uppercase tracking-wider block">
                      Xizmat Nomi *
                    </Label>
                    <Input
                      placeholder="Masalan: Zirkon Karonka, Sinus-lifting, Bone graft, Vinir..."
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
                <div className="space-y-2 bg-white/90 p-3.5 rounded-xl border border-indigo-100">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-black text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-600" /> Xizmat Narxi (so'm) *
                    </Label>
                    <span className="text-xs font-mono font-black text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
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
                          "px-2.5 py-1 rounded-lg text-[9.5px] font-mono font-bold border transition-all cursor-pointer",
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
                      className="bg-white border-slate-200 h-10 rounded-xl font-semibold text-xs text-slate-700"
                    />
                  </div>

                  <div className="flex items-center gap-2 justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => { setShowAddForm(false); setEditingService(null); }}
                      className="h-10 rounded-xl font-bold text-xs"
                    >
                      Bekor qilish
                    </Button>
                    <Button
                      type="submit"
                      disabled={saving}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white h-10 px-6 rounded-xl font-black text-xs shadow-md shadow-indigo-500/20 cursor-pointer"
                    >
                      {saving ? "Saqlanmoqda..." : editingService ? "O'zgarishlarni saqlash" : "+ Xizmatni saqlash"}
                    </Button>
                  </div>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {/* ── Search & Category Filter Controls ── */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            {/* Search */}
            <div className="relative flex-1 group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
              <input
                type="text"
                placeholder="Xizmat nomi yoki toifasi bo'yicha qidirish..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full h-9.5 pl-9 pr-8 bg-slate-50 hover:bg-white focus:bg-white rounded-xl border border-slate-200 focus:border-indigo-500 font-semibold text-xs outline-none transition-all"
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

            {/* Categories */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer",
                    selectedCategory === cat
                      ? "bg-slate-900 text-white shadow-xs font-black ring-1 ring-slate-800"
                      : "bg-slate-100/80 text-slate-700 hover:bg-slate-200/80 border border-slate-200/60"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* ── Services Table / Catalog Grid ── */}
          <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse select-text">
                <thead>
                  <tr className="bg-slate-100/90 border-b border-slate-200 text-[11px] font-black text-slate-700 uppercase tracking-wider">
                    <th className="w-12 py-3 px-3 text-center border-r border-slate-200 font-mono">№</th>
                    <th className="py-3 px-4 border-r border-slate-200 min-w-[220px]">Xizmat Nomi</th>
                    <th className="w-36 py-3 px-3 text-center border-r border-slate-200">Toifasi</th>
                    <th className="w-48 py-3 px-4 text-right border-r border-slate-200 bg-emerald-50/40 text-emerald-900">
                      Narxi (so'm)
                    </th>
                    <th className="py-3 px-4 border-r border-slate-200 min-w-[220px]">Tavsifi / Izoh</th>
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
                          <td className="text-center font-mono font-bold text-slate-400 py-3 px-3 border-r border-slate-200/70">
                            {idx + 1}
                          </td>

                          {/* Service Name */}
                          <td className="py-3 px-4 border-r border-slate-200/70">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0" />
                              <span className="font-black text-slate-900 text-xs sm:text-sm">
                                {svc.name}
                              </span>
                            </div>
                          </td>

                          {/* Category */}
                          <td className="py-3 px-3 text-center border-r border-slate-200/70">
                            <span className={cn(
                              "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border",
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
                          <td className="py-3 px-4 text-right font-mono font-black text-emerald-700 border-r border-slate-200/70 bg-emerald-50/20 text-xs sm:text-sm">
                            {numPrice.toLocaleString()} <span className="text-[10px] font-bold text-emerald-600/80 uppercase">SO'M</span>
                          </td>

                          {/* Description */}
                          <td className="py-3 px-4 text-slate-500 border-r border-slate-200/70 text-[11px]">
                            {svc.description || '—'}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-3 text-center">
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
                      <td colSpan={6} className="py-16 text-center text-slate-400">
                        <div className="flex flex-col items-center gap-2">
                          <Layers className="w-10 h-10 text-slate-300" />
                          <p className="text-sm font-bold">Xizmatlar topilmadi</p>
                          <Button 
                            size="sm" 
                            onClick={() => {
                              setShowAddForm(true);
                              setEditingService(null);
                              setFormData({ name: '', price: 500000, category: 'Ortopediya', description: '', is_active: true });
                            }}
                            className="bg-indigo-600 text-white rounded-xl text-xs font-black h-9 mt-1 cursor-pointer"
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
        </>
      ) : (
        /* ── Patient Records Table for Extra Services ── */
        <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <User className="w-4 h-4" />
              </div>
              <h3 className="font-black text-slate-900 text-sm">
                Bemorlarga Qo'llangan Qo'shimcha Xizmatlar
              </h3>
            </div>
            <span className="text-xs font-black font-mono bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-xl border border-indigo-200">
              Jami: {patientOperations.length} ta
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse select-text">
              <thead>
                <tr className="bg-slate-100/90 border-b border-slate-200 text-[11px] font-black text-slate-700 uppercase tracking-wider">
                  <th className="w-12 py-3 px-3 text-center border-r border-slate-200 font-mono">№</th>
                  <th className="py-3 px-4 border-r border-slate-200 min-w-[200px]">1. Bemor (F.I.Sh)</th>
                  <th className="w-28 py-3 px-3 text-center border-r border-slate-200">2. Tish raqami</th>
                  <th className="py-3 px-4 border-r border-slate-200 min-w-[180px]">3. Xizmat turi</th>
                  <th className="w-40 py-3 px-4 text-right border-r border-slate-200 bg-emerald-50/40 text-emerald-900">
                    4. Narxi
                  </th>
                  <th className="w-36 py-3 px-3 text-center border-r border-slate-200">5. Sana</th>
                  <th className="w-32 py-3 px-3 text-center">6. Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 text-xs font-semibold">
                {patientOperations.length > 0 ? (
                  patientOperations.map((imp, idx) => {
                    const pat = patients.find(p => String(p.id) === String(imp.patient_id));
                    const patName = pat?.full_name || imp.patient_name || '—';
                    const patPhone = pat?.phone || imp.patient_phone || '';
                    const price = Number(imp.cost || imp.price || imp.total_cost || 0);

                    return (
                      <tr key={imp.id || idx} className="hover:bg-slate-50 transition-colors">
                        <td className="text-center font-mono font-bold text-slate-400 py-3 px-3 border-r border-slate-200/70">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-4 border-r border-slate-200/70">
                          <div className="font-black text-slate-900">{patName}</div>
                          {patPhone && (
                            <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3 text-indigo-500" />
                              {patPhone}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center border-r border-slate-200/70">
                          <span className="font-mono font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            #{imp.tooth_number || (imp.tooth_numbers || []).join(', ') || '—'}
                          </span>
                        </td>
                        <td className="py-3 px-4 border-r border-slate-200/70">
                          <span className="font-bold text-slate-800">
                            {imp.service_name || imp.hizmat_turi || imp.brend || 'Qo\'shimcha xizmat'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-black text-emerald-700 border-r border-slate-200/70 bg-emerald-50/20">
                          {price.toLocaleString()} so'm
                        </td>
                        <td className="py-3 px-3 text-center text-slate-500 font-mono text-[11px] border-r border-slate-200/70">
                          {imp.placement_date || imp.created_date ? new Date(imp.placement_date || imp.created_date).toLocaleDateString('uz-UZ') : '—'}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {onEditPatientOperation && (
                              <button
                                type="button"
                                onClick={() => onEditPatientOperation(imp)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-all cursor-pointer"
                                title="Tahrirlash"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {onDeletePatientOperation && (
                              <button
                                type="button"
                                onClick={() => onDeletePatientOperation(imp)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                                title="O'chirish"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 font-bold text-xs">
                      Hozircha bemorlar uchun qo'shimcha xizmat amaliyotlari mavjud emas
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
