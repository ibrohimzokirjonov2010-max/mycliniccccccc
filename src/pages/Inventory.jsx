import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Plus, Search, Package, Edit2, Trash2, AlertOctagon, 
  CircleDollarSign, Layers, FolderPlus,
  ArrowUp, ArrowDown, ArrowUpDown, Table as TableIcon, LayoutGrid, FileSpreadsheet, X,
  AlertTriangle, CheckCircle2, ShoppingBag
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/i18n/LanguageContext';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const DEFAULT_INVENTORY_CATEGORIES = [
  'Restavratsiya',
  'Plomba materiallari',
  'Anesteziya',
  'Endodontiya',
  'Ortopediya',
  'Xirurgiya',
  'Ortodontiya',
  'Asboblar',
  'Bir martalik (Sarf)',
  'Dezinseksiya',
  'Boshqa'
];

/**
 * Inventory Page - Professional Excel Spreadsheet View
 */
export default function Inventory() {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Categories state
  const [categories, setCategories] = useState(() => {
    try {
      const saved = localStorage.getItem('inventory_categories');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_INVENTORY_CATEGORIES;
  });

  const [selectedCategory, setSelectedCategory] = useState('all');
  const [newCatModalOpen, setNewCatModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [inlineNewCat, setInlineNewCat] = useState('');
  const [isAddingInlineCat, setIsAddingInlineCat] = useState(false);

  // Density switcher with localStorage
  const [density, setDensity] = useState(() => {
    return localStorage.getItem('myclinic_inventory_density') || 'compact';
  });
  const toggleDensity = (val) => {
    setDensity(val);
    localStorage.setItem('myclinic_inventory_density', val);
  };

  // Sorting state
  const [sortField, setSortField] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [form, setForm] = useState({ 
    name: '', 
    category: 'Restavratsiya', 
    unit: 'dona', 
    quantity: 0, 
    min_quantity: 5, 
    price_per_unit: 0 
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      let data;
      if (debouncedSearch) {
        data = await base44.entities.Inventory.search(debouncedSearch, 300);
      } else {
        data = await base44.entities.Inventory.list('name', 300);
      }
      setItems(data || []);
    } catch (error) {
      console.error('Inventory load error:', error);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => { 
    load(); 
  }, [load]);

  // All distinct categories combined
  const allCategories = useMemo(() => {
    const fromItems = items.map(i => i.category).filter(Boolean);
    return Array.from(new Set([...categories, ...fromItems]));
  }, [categories, items]);

  const categoryCounts = useMemo(() => {
    const counts = { all: items.length };
    items.forEach(item => {
      const cat = item.category || 'Boshqa';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [items]);

  const handleAddCategory = (catNameInput) => {
    const trimmed = (catNameInput || newCatName).trim();
    if (!trimmed) return;
    if (!categories.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
      const updated = [...categories, trimmed];
      setCategories(updated);
      try {
        localStorage.setItem('inventory_categories', JSON.stringify(updated));
      } catch {}
      toast.success(`"${trimmed}" bo'limi yaratildi!`);
    }
    setNewCatName('');
    setNewCatModalOpen(false);
    setSelectedCategory(trimmed);
    return trimmed;
  };

  useEffect(() => {
    if (editItem) {
      setForm({ 
        name: editItem.name || '', 
        category: editItem.category || (allCategories[0] || 'Restavratsiya'), 
        unit: editItem.unit || 'dona', 
        quantity: editItem.quantity || 0, 
        min_quantity: editItem.min_quantity || 5, 
        price_per_unit: editItem.price_per_unit || 0 
      });
    } else {
      setForm({ 
        name: '', 
        category: selectedCategory !== 'all' ? selectedCategory : (allCategories[0] || 'Restavratsiya'), 
        unit: 'dona', 
        quantity: 0, 
        min_quantity: 5, 
        price_per_unit: 0 
      });
    }
    setIsAddingInlineCat(false);
    setInlineNewCat('');
  }, [editItem, modalOpen, selectedCategory, allCategories]);

  // Filtered Items
  const filtered = useMemo(() => {
    let list = items;
    if (selectedCategory !== 'all') {
      list = list.filter(i => (i.category || 'Boshqa').toLowerCase() === selectedCategory.toLowerCase());
    }
    return list;
  }, [items, selectedCategory]);

  // Sorted Items
  const sortedItems = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      let valA, valB;
      switch (sortField) {
        case 'name':
          valA = (a.name || '').toLowerCase();
          valB = (b.name || '').toLowerCase();
          return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        case 'category':
          valA = (a.category || '').toLowerCase();
          valB = (b.category || '').toLowerCase();
          return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        case 'quantity':
          valA = Number(a.quantity || 0);
          valB = Number(b.quantity || 0);
          return sortOrder === 'asc' ? valA - valB : valB - valA;
        case 'min_quantity':
          valA = Number(a.min_quantity || 0);
          valB = Number(b.min_quantity || 0);
          return sortOrder === 'asc' ? valA - valB : valB - valA;
        case 'price':
          valA = Number(a.price_per_unit || 0);
          valB = Number(b.price_per_unit || 0);
          return sortOrder === 'asc' ? valA - valB : valB - valA;
        case 'total_value':
          valA = Number(a.quantity || 0) * Number(a.price_per_unit || 0);
          valB = Number(b.quantity || 0) * Number(b.price_per_unit || 0);
          return sortOrder === 'asc' ? valA - valB : valB - valA;
        default:
          return 0;
      }
    });
    return list;
  }, [filtered, sortField, sortOrder]);
  
  const lowStock = useMemo(() => {
    return items.filter(i => (Number(i.quantity) || 0) <= (Number(i.min_quantity) || 0));
  }, [items]);
  
  const stats = useMemo(() => {
    return {
      totalItems: items.length,
      lowStockCount: lowStock.length,
      totalQuantity: items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
      totalValue: items.reduce((sum, item) => sum + ((Number(item.quantity) || 0) * (Number(item.price_per_unit) || 0)), 0),
      filteredTotalValue: sortedItems.reduce((sum, item) => sum + ((Number(item.quantity) || 0) * (Number(item.price_per_unit) || 0)), 0),
      totalCategories: allCategories.length
    };
  }, [items, lowStock, sortedItems, allCategories]);

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Mahsulot nomini kiriting");
      return;
    }
    setSaving(true);
    try {
      if (editItem) {
        await base44.entities.Inventory.update(editItem.id, form);
      } else {
        await base44.entities.Inventory.create(form);
      }
      setModalOpen(false);
      setEditItem(null);
      load();
      toast.success(editItem ? "Mahsulot yangilandi!" : "Yangi mahsulot saqlandi!");
    } catch (error) {
      console.error('Save error:', error);
      toast.error("Saqlashda xatolik yuz berdi");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await base44.entities.Inventory.delete(deleteId);
      setDeleteId(null);
      load();
      toast.success("Mahsulot o'chirildi!");
    } catch (error) {
      console.error('Delete error:', error);
      toast.error("O'chirishda xatolik");
    }
  };

  /**
   * Export to CSV with UTF-8 BOM
   */
  const exportCSV = useCallback(() => {
    try {
      if (!sortedItems || sortedItems.length === 0) {
        toast.warning("Eksport qilish uchun ma'lumot topilmadi");
        return;
      }
      const headers = [
        "№",
        "Mahsulot Nomi",
        "Kategoriya",
        "Miqdor",
        "Birlik",
        "Min. Zaxira",
        "Dona Narxi (UZS)",
        "Jami Qiymat (UZS)",
        "Holat"
      ];
      const rows = sortedItems.map((item, idx) => {
        const qty = Number(item.quantity || 0);
        const minQty = Number(item.min_quantity || 0);
        const price = Number(item.price_per_unit || 0);
        const total = qty * price;
        let statusText = 'Yetarli';
        if (qty === 0) statusText = 'Tugagan';
        else if (qty <= minQty) statusText = 'Kam qolgan';

        return [
          idx + 1,
          `"${(item.name || '').replace(/"/g, '""')}"`,
          `"${(item.category || 'Boshqa').replace(/"/g, '""')}"`,
          qty,
          `"${item.unit || 'dona'}"`,
          minQty,
          price,
          total,
          `"${statusText}"`
        ].join(",");
      });

      const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `Ombor_Materiallar_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Ombor hisoboti Excel (.csv) formatida yuklab olindi!");
    } catch (err) {
      console.error(err);
      toast.error("Eksportda xatolik yuz berdi");
    }
  }, [sortedItems]);

  return (
    <div className="space-y-3.5 pb-4">
      {/* ─── Excel Header Bar ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900 tracking-tight">{t('inventory.title') || "Ombor"}</h1>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
              • Sklad va Materiallar {stats.totalItems} Yozuvlar
            </span>
          </div>
          <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
            Klinika stomatologik asbob-uskunalari va sarf materiallari zaxirasi
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={exportCSV} 
            className="gap-1.5 rounded-xl border-slate-200 hover:bg-slate-50 font-black text-xs text-slate-700 h-9.5 px-3.5"
            title="Excel formatida (.csv) yuklab olish"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Eksport (Excel)</span>
          </Button>

          <Button 
            onClick={() => { setEditItem(null); setModalOpen(true); }} 
            className="bg-[#00D084] hover:bg-[#00B875] text-white gap-1.5 border-none rounded-xl h-9.5 px-4 font-black text-xs shadow-md shadow-[#00D084]/20 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>{t('inventory.addNew') || "Yangi material"}</span>
          </Button>
        </div>
      </div>

      {/* ─── Top Inventory Dashboard KPI Grid ───────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "JAMI NOMLAR", value: stats.totalItems, icon: Layers, color: "text-blue-600", bg: "bg-blue-50 border-blue-100", isNumber: true, countText: "Material turlari" },
          { label: "KAMAYGAN ZAXIRA", value: stats.lowStockCount, icon: AlertOctagon, color: "text-rose-600", bg: "bg-rose-50 border-rose-100", isNumber: true, countText: "Zaxirasi oz qolgan", highlight: stats.lowStockCount > 0 },
          { label: "JAMI MIQDOR", value: stats.totalQuantity, icon: Package, color: "text-purple-600", bg: "bg-purple-50 border-purple-100", isNumber: true, countText: "Ombordagi birliklar" },
          { label: "OMBOR QIYMATI", value: stats.totalValue, icon: CircleDollarSign, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100", isNumber: false, countText: "Umumiy xarid qiymati" },
        ].map((s, i) => (
          <motion.div 
            key={s.label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.03 }}
            className={`bg-white border rounded-2xl p-3.5 shadow-xs flex items-center justify-between relative overflow-hidden ${
              s.highlight ? 'border-rose-300 ring-1 ring-rose-200' : 'border-slate-200/90'
            }`}
          >
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">
                {s.label}
              </span>
              <div className="text-lg sm:text-xl font-black font-mono tracking-tight text-slate-900 tabular-nums">
                {s.isNumber ? (
                  <span className={s.highlight ? 'text-rose-600' : ''}>
                    {s.value} <span className="text-xs font-bold text-slate-400">ta</span>
                  </span>
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

      {/* ─── Low Stock Warning Alert Banner ─────────────────────────── */}
      {lowStock.length > 0 && (
        <div className="bg-rose-50/90 border border-rose-200 rounded-2xl p-3 px-4 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 block">
                Zaxira Ogohlantirishi: {lowStock.length} ta mahsulot tugamoqda!
              </span>
              <p className="text-xs font-bold text-slate-700 truncate">
                Kam qolganlar: {lowStock.map(i => `${i.name} (${i.quantity} ${i.unit || 'dona'})`).slice(0, 5).join(', ')}
                {lowStock.length > 5 && ` va yana ${lowStock.length - 5} ta...`}
              </p>
            </div>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setSelectedCategory('all');
              setSortField('quantity');
              setSortOrder('asc');
            }}
            className="h-7.5 px-3 rounded-xl border-rose-300 text-rose-700 bg-white hover:bg-rose-100/60 font-black text-xs shrink-0"
          >
            Ko'rish
          </Button>
        </div>
      )}

      {/* ─── Excel Spreadsheet Controls Bar ────────────────────────── */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          
          {/* Search Box */}
          <div className="relative flex-1 group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#1499AD] transition-colors" />
            <input 
              type="text" 
              placeholder="Mahsulot nomi yoki toifasi bo'yicha qidiring..."
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

          {/* New Category Button */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setNewCatModalOpen(true)}
              className="h-9 px-3 rounded-xl border-slate-200 text-[#1499AD] hover:bg-[#1499AD]/5 font-black text-xs gap-1.5"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>+ Yangi bo'lim</span>
            </Button>

            {/* Density Switcher */}
            <div className="hidden sm:flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/70 shrink-0">
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
                <span>Excel</span>
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
                <span>Keng</span>
              </button>
            </div>
          </div>

        </div>

        {/* Category Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer",
              selectedCategory === 'all'
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-slate-100/70 text-slate-600 hover:bg-slate-200/60 hover:text-slate-900"
            )}
          >
            <span>Barchasi</span>
            <span className={cn("px-1.5 py-0.2 rounded-full text-[9px] font-black", selectedCategory === 'all' ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600")}>
              {categoryCounts.all || 0}
            </span>
          </button>

          {allCategories.map((cat) => {
            const count = categoryCounts[cat] || 0;
            const isSelected = selectedCategory.toLowerCase() === cat.toLowerCase();
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer",
                  isSelected
                    ? "bg-[#1499AD] text-white shadow-xs font-black"
                    : "bg-slate-100/70 text-slate-600 hover:bg-slate-200/60 hover:text-slate-900"
                )}
              >
                <span>{cat}</span>
                <span className={cn("px-1.5 py-0.2 rounded-full text-[9px] font-black", isSelected ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600")}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Main Excel Spreadsheet Data Grid Table ──────────────────── */}
      {/* Columns: № | NOMI | KATEGORIYA | MIQDOR/BIRLIK | MIN. ZAXIRA | XARID NARXI | JAMI QIYMAT | HOLAT | AMALLAR */}
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

                {/* MAHSULOT NOMI */}
                <th 
                  onClick={() => handleSort('name')}
                  className="px-3.5 py-2.5 border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors select-none min-w-[200px]"
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span>Mahsulot Nomi</span>
                    {sortField === 'name' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#1499AD]" /> : <ArrowDown className="w-3 h-3 text-[#1499AD]" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-30" />
                    )}
                  </div>
                </th>

                {/* KATEGORIYA */}
                <th 
                  onClick={() => handleSort('category')}
                  className="px-3.5 py-2.5 border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors select-none whitespace-nowrap min-w-[140px]"
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span>Kategoriya</span>
                    {sortField === 'category' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#1499AD]" /> : <ArrowDown className="w-3 h-3 text-[#1499AD]" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-30" />
                    )}
                  </div>
                </th>

                {/* MIQDOR / BIRLIK */}
                <th 
                  onClick={() => handleSort('quantity')}
                  className="w-32 px-3 py-2.5 text-center border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors select-none whitespace-nowrap bg-blue-50/30"
                  title="Miqdor bo'yicha saralash"
                >
                  <div className="flex items-center justify-center gap-1.5 text-blue-800 font-mono">
                    <span>Miqdor / Birlik</span>
                    {sortField === 'quantity' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>

                {/* MIN. ZAXIRA */}
                <th 
                  onClick={() => handleSort('min_quantity')}
                  className="w-28 px-3 py-2.5 text-center border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors select-none whitespace-nowrap"
                  title="Minimal zaxira bo'yicha saralash"
                >
                  <div className="flex items-center justify-center gap-1.5 text-slate-600 font-mono">
                    <span>Min. Zaxira</span>
                    {sortField === 'min_quantity' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-30" />
                    )}
                  </div>
                </th>

                {/* XARID NARXI (DONA) */}
                <th 
                  onClick={() => handleSort('price')}
                  className="w-36 px-3.5 py-2.5 text-right border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors select-none whitespace-nowrap"
                  title="Xarid narxi bo'yicha saralash"
                >
                  <div className="flex items-center justify-end gap-1.5 text-slate-700 font-mono">
                    <span>Xarid Narxi</span>
                    {sortField === 'price' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-30" />
                    )}
                  </div>
                </th>

                {/* JAMI QIYMAT */}
                <th 
                  onClick={() => handleSort('total_value')}
                  className="w-40 px-3.5 py-2.5 text-right border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors bg-emerald-50/40 select-none whitespace-nowrap"
                  title="Jami qiymat bo'yicha saralash"
                >
                  <div className="flex items-center justify-end gap-1.5 text-emerald-700 font-mono">
                    <span>Jami Qiymat</span>
                    {sortField === 'total_value' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-emerald-600" /> : <ArrowDown className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>

                {/* HOLAT */}
                <th className="w-28 px-3 py-2.5 text-center border-r border-slate-200 select-none whitespace-nowrap">
                  Holat
                </th>

                {/* Actions */}
                <th className="w-28 px-2 py-2.5 text-center text-slate-500 whitespace-nowrap select-none">
                  {t('common.actions') || "Amallar"}
                </th>

              </tr>
            </thead>

            {/* ─── Excel Table Body ────────────────── */}
            <tbody className="divide-y divide-slate-200/70 text-xs">
              {sortedItems.length > 0 ? (
                sortedItems.map((item, idx) => {
                  const isCompact = density === 'compact';
                  const qty = Number(item.quantity || 0);
                  const minQty = Number(item.min_quantity || 0);
                  const price = Number(item.price_per_unit || 0);
                  const totalValue = qty * price;
                  const isOut = qty === 0;
                  const isLow = !isOut && qty <= minQty;

                  return (
                    <tr 
                      key={item.id} 
                      className={`group hover:bg-[#1499AD]/10 hover:shadow-xs transition-colors cursor-pointer ${
                        idx % 2 === 1 ? 'bg-slate-50/30' : 'bg-white'
                      }`}
                      onClick={() => { setEditItem(item); setModalOpen(true); }}
                    >
                      {/* № Cell */}
                      <td className={`text-center font-mono font-bold text-slate-400 border-r border-slate-200/70 whitespace-nowrap ${isCompact ? 'py-2 px-2' : 'py-3 px-2.5'}`}>
                        {idx + 1}
                      </td>

                      {/* MAHSULOT NOMI Cell */}
                      <td className={`border-r border-slate-200/70 ${isCompact ? 'py-1.5 px-3' : 'py-2.5 px-3.5'}`}>
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-[11px] border shrink-0 transition-colors ${
                            isOut 
                              ? 'bg-rose-100 text-rose-700 border-rose-300' 
                              : isLow 
                              ? 'bg-amber-100 text-amber-800 border-amber-300' 
                              : 'bg-slate-100 text-slate-700 border-slate-200 group-hover:bg-[#1499AD] group-hover:text-white'
                          }`}>
                            {item.name?.[0]?.toUpperCase() || 'M'}
                          </div>

                          <div className="min-w-0 flex-1">
                            <span className="font-extrabold text-slate-900 group-hover:text-[#1499AD] transition-colors truncate block">
                              {item.name}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* KATEGORIYA Cell */}
                      <td className={`border-r border-slate-200/70 whitespace-nowrap ${isCompact ? 'py-1.5 px-3' : 'py-2.5 px-3.5'}`}>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10.5px] font-bold text-slate-600 bg-slate-100 border border-slate-200">
                          {item.category || 'Boshqa'}
                        </span>
                      </td>

                      {/* MIQDOR / BIRLIK Cell */}
                      <td className={`text-center border-r border-slate-200/70 whitespace-nowrap bg-blue-50/20 ${isCompact ? 'py-1.5 px-2' : 'py-2.5 px-2.5'}`}>
                        <span className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-md text-[11px] font-mono font-black border ${
                          isOut 
                            ? 'bg-rose-100 text-rose-800 border-rose-300' 
                            : isLow 
                            ? 'bg-amber-100 text-amber-900 border-amber-300' 
                            : 'bg-blue-100/70 text-blue-900 border-blue-200/60'
                        }`}>
                          <span>{qty} {item.unit || 'dona'}</span>
                        </span>
                      </td>

                      {/* MIN. ZAXIRA Cell */}
                      <td className={`text-center border-r border-slate-200/70 whitespace-nowrap text-slate-600 font-mono font-bold ${isCompact ? 'py-1.5 px-2' : 'py-2.5 px-2.5'}`}>
                        <span>{minQty} {item.unit || 'dona'}</span>
                      </td>

                      {/* XARID NARXI Cell */}
                      <td className={`text-right border-r border-slate-200/70 whitespace-nowrap ${isCompact ? 'py-1.5 px-2.5' : 'py-2.5 px-3'}`}>
                        <span className="font-mono font-bold text-slate-800 text-xs tabular-nums">
                          {price.toLocaleString()}
                          <span className="text-[9.5px] font-semibold text-slate-400 ml-1">UZS</span>
                        </span>
                      </td>

                      {/* JAMI QIYMAT Cell */}
                      <td className={`text-right border-r border-slate-200/70 whitespace-nowrap bg-emerald-50/30 ${isCompact ? 'py-1.5 px-2.5' : 'py-2.5 px-3'}`}>
                        <span className="font-mono font-black text-emerald-600 text-xs tabular-nums">
                          {totalValue.toLocaleString()}
                          <span className="text-[9.5px] font-semibold text-emerald-500 ml-1">UZS</span>
                        </span>
                      </td>

                      {/* HOLAT Cell */}
                      <td className={`text-center border-r border-slate-200/70 whitespace-nowrap ${isCompact ? 'py-1.5 px-2' : 'py-2.5 px-2.5'}`}>
                        {isOut ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase text-rose-700 bg-rose-50 border border-rose-200">
                            <AlertOctagon className="w-3 h-3" />
                            <span>Tugagan</span>
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase text-amber-700 bg-amber-50 border border-amber-200">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Kam qolgan</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase text-emerald-700 bg-emerald-50 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Yetarli</span>
                          </span>
                        )}
                      </td>

                      {/* Actions Cell */}
                      <td className={`text-center whitespace-nowrap ${isCompact ? 'py-1 px-1.5' : 'py-2 px-2'}`}>
                        <div className="flex items-center justify-center gap-1.5" onClick={(ev) => ev.stopPropagation()}>
                          <button 
                            onClick={() => { setEditItem(item); setModalOpen(true); }}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-[#1499AD] hover:bg-[#1499AD]/10 transition-all cursor-pointer"
                            title="Tahrirlash"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button 
                            onClick={() => setDeleteId(item.id)}
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
                  <td colSpan={9} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300">
                        <Package className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-bold text-slate-500">
                        {search ? `"${search}" bo'yicha mahsulot topilmadi` : "Omborda mahsulotlar mavjud emas"}
                      </p>
                      {(search || selectedCategory !== 'all') && (
                        <button
                          onClick={() => { setSearch(''); setSelectedCategory('all'); }}
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

        {/* ─── Excel Formula Summary Footer Bar ──────────────────── */}
        <div className="bg-slate-100/90 border-t border-slate-200/90 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 text-slate-600 font-bold">
            <span className="flex items-center gap-1.5">
              <TableIcon className="w-3.5 h-3.5 text-[#1499AD]" />
              <span>Jadvalda:</span>
              <strong className="text-slate-900 font-mono">{sortedItems.length}</strong> ta nom
            </span>
            <span className="text-slate-300">•</span>
            <span>
              Σ Jami Zaxira: <strong className="text-blue-700 font-mono">{stats.totalQuantity} birlik</strong>
            </span>
            {stats.lowStockCount > 0 && (
              <>
                <span className="text-slate-300">•</span>
                <span>
                  Kam qolgan: <strong className="text-rose-600 font-mono">{stats.lowStockCount} ta</strong>
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-black uppercase text-slate-500">Σ Tanlangan Kategoriya Qiymati:</span>
              <span className="font-mono font-bold text-slate-800 text-sm">
                {stats.filteredTotalValue.toLocaleString()} <span className="text-[10px] text-slate-500">UZS</span>
              </span>
            </div>

            <div className="flex items-center gap-1.5 border-l border-slate-300 pl-3">
              <span className="text-[11px] font-black uppercase text-slate-500">Σ Umumiy Ombor Qiymati:</span>
              <span className="font-mono font-black text-emerald-600 text-sm">
                {stats.totalValue.toLocaleString()} <span className="text-[10px] text-slate-500">UZS</span>
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ─── Add / Edit Item Dialog ──────────────────────────────────── */}
      <Dialog open={modalOpen} onOpenChange={() => { setModalOpen(false); setEditItem(null); }}>
        <DialogContent className="max-w-xl p-0 overflow-hidden rounded-3xl border-none shadow-2xl bg-white">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 px-8 py-6 text-white relative">
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-[900] tracking-tighter uppercase mb-0.5">
                  {editItem ? (t('inventory.modal.titleEdit') || 'Mahsulotni tahrirlash') : (t('inventory.modal.titleAddProduct') || 'Yangi mahsulot')}
                </h2>
                <p className="text-[9px] font-black text-white/40 tracking-[0.2em] uppercase">{t('inventory.modal.subtitle') || 'Mahsulot tafsilotlarini kiriting'}</p>
              </div>
              <ShoppingBag className="w-8 h-8 text-blue-500/30" />
            </div>
          </div>

          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">{t('inventory.modal.nameLabelProduct') || 'Mahsulot nomi'} *</Label>
                  <Input 
                    value={form.name} 
                    onChange={e => setForm({ ...form, name: e.target.value })} 
                    className="h-10 rounded-xl bg-slate-50 font-bold text-slate-900 text-xs"
                    placeholder="Masalan: Lidokain 2%..."
                    autoFocus
                  />
                </div>
                
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-700">{t('inventory.modal.categoryLabel') || 'Kategoriya / Bo\'lim'}</Label>
                    <button
                      type="button"
                      onClick={() => setIsAddingInlineCat(!isAddingInlineCat)}
                      className="text-[10px] font-bold text-[#1499AD] hover:underline cursor-pointer flex items-center gap-0.5"
                    >
                      <Plus className="w-3 h-3" />
                      {isAddingInlineCat ? 'Tanlash' : 'Yangi bo\'lim'}
                    </button>
                  </div>
                  
                  {isAddingInlineCat ? (
                    <div className="flex items-center gap-1.5">
                      <Input 
                        value={inlineNewCat} 
                        onChange={e => setInlineNewCat(e.target.value)} 
                        placeholder="Bo'lim nomi..." 
                        className="h-10 rounded-xl bg-slate-50 font-bold text-slate-900 text-xs"
                        autoFocus
                      />
                      <Button
                        type="button"
                        onClick={() => {
                          if (inlineNewCat.trim()) {
                            handleAddCategory(inlineNewCat);
                            setForm({ ...form, category: inlineNewCat.trim() });
                            setInlineNewCat('');
                            setIsAddingInlineCat(false);
                          }
                        }}
                        className="h-10 px-3 rounded-xl bg-[#1499AD] hover:bg-[#0E7A8A] text-white font-bold text-xs shrink-0"
                      >
                        Qo'shish
                      </Button>
                    </div>
                  ) : (
                    <Select 
                      value={form.category} 
                      onValueChange={v => {
                        if (v === '__ADD_NEW__') {
                          setIsAddingInlineCat(true);
                        } else {
                          setForm({ ...form, category: v });
                        }
                      }}
                    >
                      <SelectTrigger className="h-10 rounded-xl bg-slate-50 font-bold text-slate-900 text-xs">
                        <SelectValue placeholder={t('inventory.modal.categoryPlaceholder') || 'Bo\'limni tanlang...'} />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-none shadow-xl max-h-60">
                        {allCategories.map((cat) => (
                          <SelectItem key={cat} value={cat} className="font-bold py-2 text-xs">
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">{t('inventory.modal.unitLabel') || 'O\'lchov Birligi'}</Label>
                  <Input 
                    value={form.unit} 
                    onChange={e => setForm({ ...form, unit: e.target.value })} 
                    className="h-10 rounded-xl bg-slate-50 font-bold text-slate-900 text-xs"
                    placeholder="Dona, quti, flakon, gramm..."
                  />
                </div>
              </div>

              <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex flex-col justify-between">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-blue-700 block text-center">{t('inventory.modal.quantityLabel') || 'Mavjud Miqdor'}</Label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={form.quantity === '' || form.quantity === 0 ? '' : String(form.quantity)}
                    onChange={e => { const r = e.target.value.replace(/\D/g,''); setForm({ ...form, quantity: r === '' ? 0 : Number(r) }); }}
                    className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 font-mono font-black text-xl text-slate-900 text-center shadow-xs outline-none focus:border-blue-500"
                    placeholder="0"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-rose-600 block text-center">Min. Zaxira</Label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={form.min_quantity === '' || form.min_quantity === 0 ? '' : String(form.min_quantity)}
                      onChange={e => { const r = e.target.value.replace(/\D/g,''); setForm({ ...form, min_quantity: r === '' ? 0 : Number(r) }); }}
                      className="w-full h-10 rounded-xl border border-slate-200 bg-white px-2 font-mono font-bold text-rose-600 text-center text-sm shadow-xs outline-none focus:border-rose-500"
                      placeholder="5"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-emerald-700 block text-center">Dona Narxi (so'm)</Label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={form.price_per_unit === '' || form.price_per_unit === 0 ? '' : Number(form.price_per_unit).toLocaleString('uz-UZ')}
                      onChange={e => { const r = e.target.value.replace(/\s/g,'').replace(/,/g,'').replace(/\./g,'').replace(/'/g,''); setForm({ ...form, price_per_unit: r === '' ? 0 : Number(r) }); }}
                      className="w-full h-10 rounded-xl border border-slate-200 bg-white px-2 font-mono font-bold text-emerald-600 text-center text-sm shadow-xs outline-none focus:border-emerald-500"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center">
                  <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block">Jami Hisoblangan Qiymat:</span>
                  <span className="font-mono font-black text-emerald-700 text-sm">
                    {((Number(form.quantity) || 0) * (Number(form.price_per_unit) || 0)).toLocaleString()} UZS
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <button 
              type="button"
              onClick={() => { setModalOpen(false); setEditItem(null); }}
              className="text-xs font-bold text-slate-500 hover:text-slate-900 transition-all border-none bg-transparent cursor-pointer"
            >
              {t('common.cancel') || 'Bekor qilish'}
            </button>
            <Button 
              type="button"
              onClick={handleSave} 
              disabled={saving || !form.name.trim()} 
              className="h-10 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs border-none transition-all active:scale-95 flex items-center gap-2 cursor-pointer shadow-md"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Plus className="w-4 h-4 text-emerald-400" />
                  <span>{t('common.save') || 'Saqlash'}</span>
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── New Category Dialog ────────────────────────────────────── */}
      <Dialog open={newCatModalOpen} onOpenChange={setNewCatModalOpen}>
        <DialogContent className="sm:max-w-md p-6 rounded-3xl bg-white border-none shadow-2xl">
          <DialogHeader className="mb-4">
            <div className="w-10 h-10 rounded-2xl bg-[#1499AD]/10 text-[#1499AD] flex items-center justify-center mb-2">
              <FolderPlus className="w-5 h-5" />
            </div>
            <DialogTitle className="text-lg font-black text-slate-900 uppercase">
              Yangi bo'lim (kategoriya) yaratish
            </DialogTitle>
            <p className="text-xs text-slate-400 font-bold">
              Ombordagi materiallarni guruhlash uchun yangi bo'lim nomini kiriting (masalan: Restavratsiya, Plomba va h.k.)
            </p>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 ml-1">Bo'lim nomi *</Label>
              <Input
                value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
                placeholder="Masalan: Restavratsiya..."
                className="h-10 rounded-xl bg-slate-50 font-bold text-slate-900 text-xs"
                onKeyDown={e => {
                  if (e.key === 'Enter' && newCatName.trim()) {
                    handleAddCategory();
                  }
                }}
                autoFocus
              />
            </div>

            <DialogFooter className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setNewCatModalOpen(false); setNewCatName(''); }}
                className="h-10 rounded-xl px-4 font-bold text-xs"
              >
                Bekor qilish
              </Button>
              <Button
                type="button"
                onClick={() => handleAddCategory()}
                disabled={!newCatName.trim()}
                className="h-10 rounded-xl px-5 bg-[#1499AD] hover:bg-[#0E7A8A] text-white font-bold text-xs"
              >
                Yaratish
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation Dialog ─────────────────────────────── */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl p-0 overflow-hidden border-none shadow-2xl bg-white max-w-xs">
          <div className="bg-rose-500 p-6 flex items-center justify-center text-white">
            <Trash2 className="w-10 h-10" />
          </div>
          <div className="p-6 text-center">
            <AlertDialogTitle className="text-base font-black text-slate-900 uppercase tracking-tight mb-1">
              O'chirishni tasdiqlaysizmi?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs font-bold text-slate-500 leading-relaxed">
              Ushbu mahsulot o'chirilgandan so'ng uni qayta tiklab bo'lmaydi.
            </AlertDialogDescription>
            <div className="flex gap-2 mt-6">
              <AlertDialogCancel className="flex-1 h-10 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs cursor-pointer">
                Bekor qilish
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="flex-1 h-10 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md cursor-pointer border-none">
                O'chirish
              </AlertDialogAction>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
