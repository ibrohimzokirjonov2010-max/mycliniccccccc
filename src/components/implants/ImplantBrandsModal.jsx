import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Plus, Layers, Package, Trash2, Edit2, Check, X, 
  TrendingUp, AlertCircle, ShieldCheck, RefreshCw, Box
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

export const DEFAULT_IMPLANT_BRANDS = [
  { name: 'Osstem', country: 'Janubiy Koreya', initial_stock: 50, added_stock: 0, model: 'TSIII, SA/CA' },
  { name: 'Dentium', country: 'Janubiy Koreya', initial_stock: 30, added_stock: 0, model: 'SuperLine, SimpleLine' },
  { name: 'Straumann', country: 'Shveysariya', initial_stock: 20, added_stock: 0, model: 'BLX, BLT, SLA' },
  { name: 'Megagen', country: 'Janubiy Koreya', initial_stock: 25, added_stock: 0, model: 'AnyRidge, AnyOne' },
  { name: 'Nobel Biocare', country: 'Shveysariya', initial_stock: 20, added_stock: 0, model: 'Active, Parallel CC' },
  { name: 'Neobiotech', country: 'Janubiy Koreya', initial_stock: 25, added_stock: 0, model: 'IS-II active' }
];

/**
 * Fetch or auto-seed implant brands
 */
export async function getOrSeedImplantBrands() {
  try {
    let brands = await base44.entities.ImplantBrand.list('name', 100);
    if (!brands || brands.length === 0) {
      // Auto seed default brands if completely empty
      const created = [];
      for (const d of DEFAULT_IMPLANT_BRANDS) {
        try {
          const res = await base44.entities.ImplantBrand.create({
            ...d,
            created_date: new Date().toISOString(),
            is_active: true
          });
          created.push(res);
        } catch (e) {
          created.push({ id: `temp_${d.name}`, ...d });
        }
      }
      return created;
    }
    return brands;
  } catch (err) {
    console.error('Error fetching implant brands:', err);
    return DEFAULT_IMPLANT_BRANDS.map((d, i) => ({ id: `default_${i}`, ...d }));
  }
}

/**
 * Calculate stock metrics for all brands based on placed implants
 */
export function calculateBrandStockStats(brands = [], implants = []) {
  const brandStatsMap = {};

  // Count placed implants per brand (matching firma, brend, firma_custom)
  (implants || []).forEach(imp => {
    const rawFirma = (imp.firma === 'Boshqa' ? (imp.firma_custom || 'Boshqa') : (imp.firma || imp.brend || '')).trim().toLowerCase();
    if (!rawFirma) return;

    // Find matching brand in list or fallback
    const matched = brands.find(b => {
      const bName = (b.name || '').trim().toLowerCase();
      return bName === rawFirma || rawFirma.includes(bName) || bName.includes(rawFirma);
    });

    const key = matched ? matched.name : (imp.firma || 'Boshqa');
    brandStatsMap[key] = (brandStatsMap[key] || 0) + 1;
  });

  return brands.map(b => {
    const usedCount = brandStatsMap[b.name] || 0;
    const initial = Number(b.initial_stock) || 0;
    const added = Number(b.added_stock) || 0;
    const totalStock = initial + added;
    const remainingStock = Math.max(0, totalStock - usedCount);
    const usedPercent = totalStock > 0 ? Math.min(100, Math.round((usedCount / totalStock) * 100)) : 0;
    const totalImplantsCount = (implants || []).length;
    const sharePercent = totalImplantsCount > 0 ? Math.round((usedCount / totalImplantsCount) * 100) : 0;

    return {
      ...b,
      initial_stock: initial,
      added_stock: added,
      total_stock: totalStock,
      used_count: usedCount,
      remaining_stock: remainingStock,
      used_percent: usedPercent,
      share_percent: sharePercent,
      is_low_stock: remainingStock > 0 && remainingStock <= 5,
      is_out_of_stock: remainingStock === 0
    };
  });
}

export default function ImplantBrandsModal({ 
  open, 
  onClose, 
  implants = [], 
  onBrandsUpdated 
}) {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // New Brand Form
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingBrand, setEditingBrand] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    initial_stock: 100,
    country: 'Janubiy Koreya',
    model: '',
    notes: ''
  });

  // Quick Add Stock Dialog State
  const [stockModal, setStockModal] = useState({
    open: false,
    brand: null,
    amount: 20
  });

  const loadBrands = async () => {
    setLoading(true);
    try {
      const data = await getOrSeedImplantBrands();
      setBrands(data);
    } catch (e) {
      console.error(e);
      toast.error("Brendlarni yuklashda xatolik");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadBrands();
    }
  }, [open]);

  const brandsWithStats = useMemo(() => {
    return calculateBrandStockStats(brands, implants);
  }, [brands, implants]);

  const handleSaveBrand = async (e) => {
    e?.preventDefault();
    if (!formData.name?.trim()) {
      toast.error("Iltimos, brend nomini kiriting!");
      return;
    }

    const initStock = Math.max(0, parseInt(formData.initial_stock, 10) || 0);

    setSaving(true);
    try {
      if (editingBrand) {
        // Update existing
        await base44.entities.ImplantBrand.update(editingBrand.id, {
          name: formData.name.trim(),
          initial_stock: initStock,
          country: formData.country?.trim() || '',
          model: formData.model?.trim() || '',
          notes: formData.notes?.trim() || ''
        });
        toast.success("Brend muvaffaqiyatli yangilandi!");
      } else {
        // Create new brand
        await base44.entities.ImplantBrand.create({
          name: formData.name.trim(),
          initial_stock: initStock,
          added_stock: 0,
          country: formData.country?.trim() || '',
          model: formData.model?.trim() || '',
          notes: formData.notes?.trim() || '',
          created_date: new Date().toISOString(),
          is_active: true
        });
        toast.success(`Yangi brend qo'shildi: ${formData.name} (${initStock} ta zaxira)`);
      }

      setShowAddForm(false);
      setEditingBrand(null);
      setFormData({ name: '', initial_stock: 100, country: 'Janubiy Koreya', model: '', notes: '' });
      await loadBrands();
      if (onBrandsUpdated) onBrandsUpdated();
    } catch (err) {
      console.error(err);
      toast.error("Saqlashda xatolik yuz berdi");
    } finally {
      setSaving(false);
    }
  };

  const handleAddStock = async () => {
    if (!stockModal.brand) return;
    const addAmt = parseInt(stockModal.amount, 10);
    if (!addAmt || addAmt <= 0) {
      toast.error("Iltimos, musbat son kiriting");
      return;
    }

    setSaving(true);
    try {
      const currentAdded = Number(stockModal.brand.added_stock) || 0;
      const newAdded = currentAdded + addAmt;

      await base44.entities.ImplantBrand.update(stockModal.brand.id, {
        added_stock: newAdded
      });

      toast.success(`${stockModal.brand.name} brendiga +${addAmt} ta zaxira qo'shildi!`);
      setStockModal({ open: false, brand: null, amount: 20 });
      await loadBrands();
      if (onBrandsUpdated) onBrandsUpdated();
    } catch (err) {
      console.error(err);
      toast.error("Zaxira qo'shishda xatolik");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBrand = async (brand) => {
    if (!window.confirm(`Haqiqatan ham "${brand.name}" brendini o'chirmoqchimisiz?`)) return;

    try {
      await base44.entities.ImplantBrand.delete(brand.id);
      toast.success("Brend o'chirildi");
      await loadBrands();
      if (onBrandsUpdated) onBrandsUpdated();
    } catch (e) {
      console.error(e);
      toast.error("O'chirishda xatolik");
    }
  };

  const startEdit = (b) => {
    setEditingBrand(b);
    setFormData({
      name: b.name || '',
      initial_stock: b.initial_stock || 0,
      country: b.country || '',
      model: b.model || '',
      notes: b.notes || ''
    });
    setShowAddForm(true);
  };

  const totalStockAll = brandsWithStats.reduce((s, b) => s + b.total_stock, 0);
  const totalRemainingAll = brandsWithStats.reduce((s, b) => s + b.remaining_stock, 0);
  const totalUsedAll = brandsWithStats.reduce((s, b) => s + b.used_count, 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-3xl p-0 overflow-hidden rounded-[2rem] border-none shadow-2xl [&>button]:hidden bg-[#F8FAFC]">
        {/* Header */}
        <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 px-6 py-5 text-white relative">
          <button 
            onClick={onClose} 
            className="absolute right-4 top-4 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 active:scale-95 transition-all cursor-pointer text-white"
          >
            <X className="w-4 h-4" />
          </button>
          
          <div className="flex items-center gap-2 mb-1 text-[10px] font-black tracking-widest text-indigo-300 uppercase">
            <Package className="w-3.5 h-3.5" />
            Implantlar Ombori & Brendlar Boshqaruvi
          </div>
          
          <h2 className="text-2xl font-[900] tracking-tight">
            Implant Brendlari va Zaxirasi
          </h2>
          <p className="text-xs text-indigo-200/80 font-medium mt-0.5">
            Brendlar qo'shish, mavjud zaxirani kiritish va o'rnatilgan implantlar bo'yicha avtomatik ayirish
          </p>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-white/10">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2">
              <span className="text-[9px] font-black text-white/60 uppercase tracking-widest block">Jami Zaxira</span>
              <span className="text-base font-black text-white">{totalStockAll} <span className="text-[10px] font-bold text-white/70">ta</span></span>
            </div>
            <div className="bg-emerald-500/20 border border-emerald-400/30 rounded-xl px-3 py-2">
              <span className="text-[9px] font-black text-emerald-300 uppercase tracking-widest block">Qolgan Qoldiq</span>
              <span className="text-base font-black text-emerald-300">{totalRemainingAll} <span className="text-[10px] font-bold text-emerald-200">ta</span></span>
            </div>
            <div className="bg-indigo-500/20 border border-indigo-400/30 rounded-xl px-3 py-2">
              <span className="text-[9px] font-black text-indigo-300 uppercase tracking-widest block">O'rnatilgan</span>
              <span className="text-base font-black text-indigo-200">{totalUsedAll} <span className="text-[10px] font-bold text-indigo-300">ta</span></span>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto no-scrollbar">
          {/* Top Actions: Add Brand Button & Form */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                Mavjud Brendlar ({brandsWithStats.length})
              </h3>
              <p className="text-[10px] text-slate-400 font-medium">
                Implant formasida faqat ushbu ro'yxatdagi brendlar chiqadi
              </p>
            </div>

            <Button
              onClick={() => {
                if (showAddForm && !editingBrand) {
                  setShowAddForm(false);
                } else {
                  setEditingBrand(null);
                  setFormData({ name: '', initial_stock: 100, country: 'Janubiy Koreya', model: '', notes: '' });
                  setShowAddForm(true);
                }
              }}
              className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs gap-1.5 shadow-md shadow-indigo-600/20 border-none cursor-pointer active:scale-95 transition-all"
            >
              {showAddForm && !editingBrand ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              {showAddForm && !editingBrand ? 'Bekor qilish' : '+ Yangi brend qo\'shish'}
            </Button>
          </div>

          {/* Add / Edit Brand Form Accordion */}
          <AnimatePresence>
            {showAddForm && (
              <motion.form
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                onSubmit={handleSaveBrand}
                className="bg-white rounded-2xl p-4 border border-indigo-100 shadow-sm space-y-3 overflow-hidden"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-black text-indigo-700 uppercase tracking-wide flex items-center gap-1.5">
                    <Box className="w-4 h-4 text-indigo-600" />
                    {editingBrand ? `Brendni tahrirlash: ${editingBrand.name}` : "Yangi Implant Brendi Qo'shish"}
                  </span>
                  <button 
                    type="button" 
                    onClick={() => { setShowAddForm(false); setEditingBrand(null); }}
                    className="text-slate-400 hover:text-slate-600 text-xs font-bold"
                  >
                    Yopish
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">
                      Brend Nomi *
                    </label>
                    <Input
                      autoFocus
                      required
                      value={formData.name}
                      onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Masalan: Osstem, Straumann, Dentium, Megagen..."
                      className="h-10 rounded-xl bg-slate-50 border-slate-200 font-bold text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">
                      Mavjud Zaxira Soni (Initial Stock) *
                    </label>
                    <div className="relative">
                      <Input
                        type="number"
                        min="0"
                        required
                        value={formData.initial_stock}
                        onChange={e => setFormData(prev => ({ ...prev, initial_stock: e.target.value }))}
                        placeholder="100"
                        className="h-10 rounded-xl bg-slate-50 border-slate-200 font-black text-sm text-indigo-700 pr-10"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">ta</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">
                      Ishlab chiqaruvchi mamlakat (ixtiyoriy)
                    </label>
                    <Input
                      value={formData.country}
                      onChange={e => setFormData(prev => ({ ...prev, country: e.target.value }))}
                      placeholder="Janubiy Koreya, Shveysariya, Germaniya..."
                      className="h-10 rounded-xl bg-slate-50 border-slate-200 text-xs font-medium"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">
                      Model / Seriya (ixtiyoriy)
                    </label>
                    <Input
                      value={formData.model}
                      onChange={e => setFormData(prev => ({ ...prev, model: e.target.value }))}
                      placeholder="Masalan: TSIII, SuperLine, SLA..."
                      className="h-10 rounded-xl bg-slate-50 border-slate-200 text-xs font-medium"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => { setShowAddForm(false); setEditingBrand(null); }}
                    className="h-9 px-4 rounded-xl text-xs font-bold"
                  >
                    Bekor qilish
                  </Button>
                  <Button
                    type="submit"
                    disabled={saving}
                    className="h-9 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs gap-1.5 shadow-sm border-none cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    {saving ? "Saqlanmoqda..." : (editingBrand ? "O'zgarishlarni saqlash" : "Brendni saqlash")}
                  </Button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Brands List */}
          {loading ? (
            <div className="py-12 text-center space-y-2">
              <div className="w-7 h-7 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Brendlar yuklanmoqda...</p>
            </div>
          ) : brandsWithStats.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center border border-slate-200">
              <Package className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="text-xs font-bold text-slate-600">Brendlar mavjud emas</p>
              <p className="text-[11px] text-slate-400 mt-1">Yangi brend qo'shish tugmasi orqali klinika brendlarini kiriting.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {brandsWithStats.map((brand, idx) => {
                return (
                  <div
                    key={brand.id || idx}
                    className="bg-white rounded-2xl border border-slate-200/80 p-4 hover:border-indigo-200 transition-all shadow-xs space-y-3"
                  >
                    {/* Brand Main Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Left: Info */}
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center font-black text-indigo-700 text-sm shrink-0">
                          {brand.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-[900] text-slate-900">{brand.name}</h4>
                            {brand.country && (
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-bold text-[9.5px]">
                                {brand.country}
                              </span>
                            )}
                            {brand.model && (
                              <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">
                                ({brand.model})
                              </span>
                            )}
                          </div>
                          <p className="text-[10.5px] text-slate-400 font-medium mt-0.5">
                            Boshlang'ich: <strong className="text-slate-700">{brand.initial_stock}</strong> ta
                            {brand.added_stock > 0 && <span> · Qo'shilgan: <strong className="text-indigo-600">+{brand.added_stock}</strong> ta</span>}
                            <span> · Ishlatildi: <strong className="text-slate-900">{brand.used_count}</strong> ta</span>
                          </p>
                        </div>
                      </div>

                      {/* Right: Stock Badges & Quick Action */}
                      <div className="flex items-center gap-2 justify-between sm:justify-end">
                        {/* Remaining Stock Badge */}
                        <div className="text-right">
                          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider ${
                            brand.is_out_of_stock 
                              ? 'bg-rose-100 text-rose-700 border border-rose-200' 
                              : brand.is_low_stock 
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}>
                            {brand.remaining_stock} ta qoldi
                          </span>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setStockModal({ open: true, brand, amount: 20 })}
                            className="px-2.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-black text-[10.5px] uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer border border-indigo-200/60"
                            title="Omborga qo'shimcha zaxira qo'shish"
                          >
                            <Plus className="w-3 h-3" />
                            Zaxira
                          </button>
                          <button
                            type="button"
                            onClick={() => startEdit(brand)}
                            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                            title="Tahrirlash"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteBrand(brand)}
                            className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="O'chirish"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar of Stock Consumption */}
                    <div className="space-y-1 pt-1">
                      <div className="flex items-center justify-between text-[9.5px] font-bold text-slate-400">
                        <span>Ishlatilgan: {brand.used_percent}%</span>
                        <span>Jami partiya: {brand.total_stock} ta</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-100">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            brand.is_out_of_stock 
                              ? 'bg-rose-500' 
                              : brand.is_low_stock 
                                ? 'bg-amber-500' 
                                : 'bg-gradient-to-r from-indigo-500 to-emerald-500'
                          }`}
                          style={{ width: `${Math.min(100, brand.used_percent)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-100/80 border-t border-slate-200 flex items-center justify-between">
          <p className="text-[11px] font-bold text-slate-500">
            ℹ️ Implant o'rnatilganda ushbu brendning zaxirasidan avtomatik ayirib boriladi.
          </p>
          <Button
            onClick={onClose}
            className="h-9 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wider cursor-pointer"
          >
            Yopish
          </Button>
        </div>
      </DialogContent>

      {/* Quick Add Stock Modal */}
      {stockModal.open && stockModal.brand && (
        <Dialog open={stockModal.open} onOpenChange={(open) => !open && setStockModal({ open: false, brand: null, amount: 20 })}>
          <DialogContent className="w-[90vw] max-w-sm p-5 rounded-[2rem] bg-white border-none shadow-2xl space-y-4">
            <DialogHeader>
              <DialogTitle className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Box className="w-5 h-5 text-indigo-600" />
                Zaxira Qo'shish
              </DialogTitle>
              <p className="text-xs text-slate-400 font-medium">
                <strong>{stockModal.brand.name}</strong> brendi uchun yangi kelgan implantlar sonini kiriting.
              </p>
            </DialogHeader>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                Qo'shiladigan Miqdor (dona)
              </label>
              <div className="relative">
                <Input
                  autoFocus
                  type="number"
                  min="1"
                  value={stockModal.amount}
                  onChange={e => setStockModal(prev => ({ ...prev, amount: e.target.value }))}
                  className="h-12 rounded-2xl font-black text-xl text-indigo-700 bg-indigo-50/50 border-indigo-200 pr-12 text-center"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">ta</span>
              </div>

              {/* Quick Preset Buttons */}
              <div className="grid grid-cols-4 gap-1.5 pt-1">
                {[10, 20, 50, 100].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setStockModal(prev => ({ ...prev, amount: val }))}
                    className={`py-1.5 rounded-xl text-xs font-black transition-colors cursor-pointer ${
                      Number(stockModal.amount) === val 
                        ? 'bg-indigo-600 text-white' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    +{val}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="outline"
                onClick={() => setStockModal({ open: false, brand: null, amount: 20 })}
                className="h-10 px-4 rounded-xl text-xs font-bold cursor-pointer"
              >
                Bekor qilish
              </Button>
              <Button
                onClick={handleAddStock}
                disabled={saving}
                className="h-10 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md border-none cursor-pointer"
              >
                {saving ? "Qo'shilmoqda..." : "Zaxiraga qo'shish"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
}
