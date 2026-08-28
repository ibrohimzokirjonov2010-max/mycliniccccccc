import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Plus, TrendingDown, TrendingUp, DollarSign, Calendar, 
  Filter, PieChart, Building2, Zap, ShoppingCart, Wrench, Trash2, Pencil,
  Sparkles, Package, Coffee, Briefcase, Stethoscope, Car, Gift, Tag, Activity, Utensils, Truck, Shield, Laptop, Check, X,
  ArrowUp, ArrowDown, ArrowUpDown, Table as TableIcon, LayoutGrid, Search, FileSpreadsheet, Receipt,
  Archive, RotateCcw, FolderArchive
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/lib/utils';
import { useTranslation } from '@/i18n/LanguageContext';
import { toast } from 'sonner';

// Uzbek standard month names
const UZ_MONTHS = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'
];

// Available icons dictionary for category selection
const AVAILABLE_ICONS = [
  { name: 'DollarSign', icon: DollarSign, label: 'Pul / Ish haqi' },
  { name: 'ShoppingCart', icon: ShoppingCart, label: 'Materiallar / Xarid' },
  { name: 'Wrench', icon: Wrench, label: 'Laboratoriya / Ta\'mirlash' },
  { name: 'Building2', icon: Building2, label: 'Bino / Arenda' },
  { name: 'Zap', icon: Zap, label: 'Elektr / Kommunal' },
  { name: 'TrendingUp', icon: TrendingUp, label: 'Marketing / Reklama' },
  { name: 'Stethoscope', icon: Stethoscope, label: 'Tibbiyot / Jihozlar' },
  { name: 'Sparkles', icon: Sparkles, label: 'Gigiyena / Tozalik' },
  { name: 'Package', icon: Package, label: 'Ombor / Mahsulot' },
  { name: 'Coffee', icon: Coffee, label: 'Oziq-ovqat / Choyxona' },
  { name: 'Briefcase', icon: Briefcase, label: 'Ofis / Biznes' },
  { name: 'Car', icon: Car, label: 'Transport / Yoqilg\'i' },
  { name: 'Truck', icon: Truck, label: 'Yetkazib berish' },
  { name: 'Utensils', icon: Utensils, label: 'Oshxona' },
  { name: 'Gift', icon: Gift, label: 'Bonus / Sovg\'a' },
  { name: 'Shield', icon: Shield, label: 'Xavfsizlik / Sug\'urta' },
  { name: 'Laptop', icon: Laptop, label: 'IT / Texnika' },
  { name: 'Activity', icon: Activity, label: 'Xizmatlar' },
  { name: 'Tag', icon: Tag, label: 'Kategoriya' },
];

const COLOR_OPTIONS = [
  { value: 'bg-emerald-100 text-emerald-700', label: 'Yashil', border: 'border-emerald-300', ring: 'ring-emerald-500' },
  { value: 'bg-blue-100 text-blue-700', label: 'Ko\'k', border: 'border-blue-300', ring: 'ring-blue-500' },
  { value: 'bg-purple-100 text-purple-700', label: 'Binafsha', border: 'border-purple-300', ring: 'ring-purple-500' },
  { value: 'bg-indigo-100 text-indigo-700', label: 'To\'q ko\'k', border: 'border-indigo-300', ring: 'ring-indigo-500' },
  { value: 'bg-amber-100 text-amber-700', label: 'Sariq', border: 'border-amber-300', ring: 'ring-amber-500' },
  { value: 'bg-rose-100 text-rose-700', label: 'Qizil', border: 'border-rose-300', ring: 'ring-rose-500' },
  { value: 'bg-cyan-100 text-cyan-700', label: 'Moviy', border: 'border-cyan-300', ring: 'ring-cyan-500' },
  { value: 'bg-slate-100 text-slate-700', label: 'Kulrang', border: 'border-slate-300', ring: 'ring-slate-500' },
];

const DEFAULT_CATEGORIES = [
  { id: 'salary', value: 'salary', label: 'Ish haqi', icon: 'DollarSign', color: 'bg-emerald-100 text-emerald-700', isSystem: true, isArchived: false },
  { id: 'materials', value: 'materials', label: 'Materiallar', icon: 'ShoppingCart', color: 'bg-blue-100 text-blue-700', isSystem: true, isArchived: false },
  { id: 'lab', value: 'lab', label: 'Laboratoriya', icon: 'Wrench', color: 'bg-purple-100 text-purple-700', isSystem: true, isArchived: false },
  { id: 'rent', value: 'rent', label: 'Arenda', icon: 'Building2', color: 'bg-indigo-100 text-indigo-700', isSystem: true, isArchived: false },
  { id: 'utilities', value: 'utilities', label: 'Kommunal', icon: 'Zap', color: 'bg-amber-100 text-amber-700', isSystem: true, isArchived: false },
  { id: 'marketing', value: 'marketing', label: 'Reklama/Marketing', icon: 'TrendingUp', color: 'bg-rose-100 text-rose-700', isSystem: true, isArchived: false },
];

const loadSavedCategories = () => {
  try {
    const raw = localStorage.getItem('myclinic_expense_categories');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Filter out 'other' / 'Boshqa' as requested by user
        const cleaned = parsed.filter(c => c.value !== 'other' && c.id !== 'other' && (c.label || '').toLowerCase() !== 'boshqa');
        if (cleaned.length > 0) return cleaned;
      }
    }
  } catch (e) {
    console.error(e);
  }
  return DEFAULT_CATEGORIES;
};

export default function Expenses() {
  const { t } = useTranslation();
  
  // Dynamic categories with localStorage persistence
  const [categories, setCategories] = useState(loadSavedCategories);
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [catForm, setCatForm] = useState({
    label: '',
    icon: 'Tag',
    color: 'bg-blue-100 text-blue-700'
  });

  // Density switcher with localStorage
  const [density, setDensity] = useState(() => {
    return localStorage.getItem('myclinic_expenses_density') || 'compact';
  });
  const toggleDensity = (val) => {
    setDensity(val);
    localStorage.setItem('myclinic_expenses_density', val);
  };

  // Sorting state
  const [sortField, setSortField] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Receipt preview lightbox
  const [previewReceiptUrl, setPreviewReceiptUrl] = useState(null);

  const saveCategoriesToStorage = (newCats) => {
    setCategories(newCats);
    try {
      localStorage.setItem('myclinic_expense_categories', JSON.stringify(newCats));
    } catch (e) {
      console.error(e);
    }
  };

  const openAddCategory = () => {
    setEditingCat(null);
    setCatForm({
      label: '',
      icon: 'Tag',
      color: 'bg-blue-100 text-blue-700'
    });
    setCatModalOpen(true);
  };

  const openEditCategory = (cat) => {
    setEditingCat(cat);
    setCatForm({
      label: cat.label,
      icon: typeof cat.icon === 'string' ? cat.icon : 'Tag',
      color: cat.color || 'bg-blue-100 text-blue-700'
    });
    setCatModalOpen(true);
  };

  const handleSaveCategory = () => {
    if (!catForm.label.trim()) {
      toast.error("Iltimos, bo'lim nomini kiriting");
      return;
    }
    if (editingCat) {
      const updated = categories.map(c => {
        if ((c.value || c.id) === (editingCat.value || editingCat.id)) {
          return {
            ...c,
            label: catForm.label.trim(),
            icon: catForm.icon,
            color: catForm.color
          };
        }
        return c;
      });
      saveCategoriesToStorage(updated);
      toast.success("Bo'lim yangilandi!");
    } else {
      const newId = 'cat_' + Date.now();
      const newCat = {
        id: newId,
        value: newId,
        label: catForm.label.trim(),
        icon: catForm.icon,
        color: catForm.color,
        isCustom: true,
        isArchived: false
      };
      const updated = [...categories, newCat];
      saveCategoriesToStorage(updated);
      toast.success("Yangi bo'lim qo'shildi!");
    }
    setCatModalOpen(false);
  };

  // Archive / Unarchive category
  const handleToggleArchiveCategory = (cat) => {
    const isNowArchived = !cat.isArchived;
    const updated = categories.map(c => {
      if ((c.value || c.id) === (cat.value || cat.id)) {
        return { ...c, isArchived: isNowArchived };
      }
      return c;
    });
    saveCategoriesToStorage(updated);
    if (isNowArchived) {
      toast.success(`"${cat.label}" bo'limi arxivlandi`);
      if (selectedCategory === cat.value) {
        setSelectedCategory('all');
      }
    } else {
      toast.success(`"${cat.label}" bo'limi arxivdan qayta tiklandi`);
    }
    if (catModalOpen) {
      setCatModalOpen(false);
    }
  };

  const handleDeleteCategory = (catToDelete) => {
    if (!confirm(`"${catToDelete.label}" bo'limini butunlay o'chirishni tasdiqlaysizmi?`)) return;
    const updated = categories.filter(c => (c.value || c.id) !== (catToDelete.value || catToDelete.id));
    saveCategoriesToStorage(updated);
    toast.success("Bo'lim o'chirildi!");
    if (selectedCategory === catToDelete.value) {
      setSelectedCategory('all');
    }
    setCatModalOpen(false);
  };

  // All categories with icon components (excluding 'other')
  const allResolvedCategories = useMemo(() => {
    return categories
      .filter(c => c.value !== 'other' && c.id !== 'other' && (c.label || '').toLowerCase() !== 'boshqa')
      .map(c => {
        const found = AVAILABLE_ICONS.find(i => i.name === c.icon);
        return {
          ...c,
          icon: found ? found.icon : Tag,
          isArchived: !!c.isArchived
        };
      });
  }, [categories]);

  // Active (non-archived) categories
  const activeCategories = useMemo(() => {
    return allResolvedCategories.filter(c => !c.isArchived);
  }, [allResolvedCategories]);

  // Archived categories
  const archivedCategories = useMemo(() => {
    return allResolvedCategories.filter(c => !!c.isArchived);
  }, [allResolvedCategories]);

  // Data states
  const [expenses, setExpenses] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filter states
  const [selectedMonth, setSelectedMonth] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  
  // Form states
  const [form, setForm] = useState({
    category: '',
    custom_category: '',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    receipt_url: ''
  });
  const [saving, setSaving] = useState(false);

  // Load data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [exps, pays] = await Promise.all([
        base44.entities.Expense?.list('-date', 500) || Promise.resolve([]),
        base44.entities.Payment.filter({ type: 'Income' }, '-date', 500)
      ]);
      setExpenses(exps);
      setPayments(pays);
    } catch (error) {
      console.error('Failed to load expenses:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Filter by month
  const getMonthData = useCallback((items, monthStr) => {
    const [year, month] = monthStr.split('-').map(Number);
    return items.filter(item => {
      if (!item.date) return false;
      const itemDate = new Date(item.date);
      if (isNaN(itemDate.getTime())) return false;
      return itemDate.getFullYear() === year && itemDate.getMonth() === month - 1;
    });
  }, []);

  // Monthly data
  const monthlyExpenses = useMemo(() => getMonthData(expenses, selectedMonth), [expenses, selectedMonth, getMonthData]);
  const monthlyIncome = useMemo(() => getMonthData(payments, selectedMonth), [payments, selectedMonth, getMonthData]);

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    return monthlyExpenses.filter(e => {
      if (selectedCategory !== 'all' && e.category !== selectedCategory) return false;
      if (searchQuery && !e.description?.toLowerCase().includes(searchQuery.toLowerCase()) && !e.custom_category?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [monthlyExpenses, selectedCategory, searchQuery]);

  // Sorted filtered expenses for Excel Grid
  const sortedDisplayExpenses = useMemo(() => {
    const list = [...filteredExpenses];
    list.sort((a, b) => {
      let valA, valB;
      switch (sortField) {
        case 'description': {
          const catA = allResolvedCategories.find(c => c.value === a.category);
          const nameA = a.custom_category || catA?.label || a.description || '';
          const catB = allResolvedCategories.find(c => c.value === b.category);
          const nameB = b.custom_category || catB?.label || b.description || '';
          valA = (a.description || nameA).toLowerCase();
          valB = (b.description || nameB).toLowerCase();
          return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        case 'category': {
          const catA = allResolvedCategories.find(c => c.value === a.category)?.label || a.category || '';
          const catB = allResolvedCategories.find(c => c.value === b.category)?.label || b.category || '';
          return sortOrder === 'asc' ? catA.localeCompare(catB) : catB.localeCompare(catA);
        }
        case 'amount':
          valA = Number(a.amount || 0);
          valB = Number(b.amount || 0);
          return sortOrder === 'asc' ? valA - valB : valB - valA;
        case 'date':
        default:
          valA = new Date(a.date || 0).getTime();
          valB = new Date(b.date || 0).getTime();
          return sortOrder === 'asc' ? valA - valB : valB - valA;
      }
    });
    return list;
  }, [filteredExpenses, sortField, sortOrder, allResolvedCategories]);

  // Calculate totals
  const totals = useMemo(() => {
    const totalExpense = monthlyExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalIncome = monthlyIncome.reduce((sum, p) => sum + (p.amount || 0), 0);
    const profit = totalIncome - totalExpense;
    
    // Category totals
    const byCategory = {};
    allResolvedCategories.forEach(cat => {
      byCategory[cat.value] = monthlyExpenses
        .filter(e => e.category === cat.value)
        .reduce((sum, e) => sum + (e.amount || 0), 0);
    });
    
    return { totalExpense, totalIncome, profit, byCategory };
  }, [monthlyExpenses, monthlyIncome, allResolvedCategories]);

  // Table summary formula metrics
  const expenseSummary = useMemo(() => {
    const totalCount = sortedDisplayExpenses.length;
    const sumExpense = sortedDisplayExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const avgExpense = totalCount > 0 ? Math.round(sumExpense / totalCount) : 0;
    return { totalCount, sumExpense, avgExpense };
  }, [sortedDisplayExpenses]);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!form.amount || !form.date) return;
    
    const catToUse = form.category || (activeCategories[0]?.value || 'utilities');
    setSaving(true);
    try {
      const payload = {
        ...form,
        category: catToUse,
        custom_category: (form.custom_category || '').trim()
      };
      if (editingExpense) {
        await base44.entities.Expense.update(editingExpense.id, payload);
        toast.success("Xarajat yangilandi!");
      } else {
        await base44.entities.Expense.create(payload);
        toast.success("Yangi xarajat saqlandi!");
      }
      setModalOpen(false);
      setEditingExpense(null);
      setForm({
        category: activeCategories[0]?.value || 'utilities',
        custom_category: '',
        amount: '',
        description: '',
        date: new Date().toISOString().split('T')[0],
        receipt_url: ''
      });
      await loadData();
    } catch (error) {
      console.error('Failed to save expense:', error);
      toast.error("Saqlashda xatolik yuz berdi");
    } finally {
      setSaving(false);
    }
  }, [form, editingExpense, activeCategories, loadData]);

  // Handle delete
  const handleDelete = useCallback(async (id) => {
    if (!confirm(t('common.confirmDelete', "Haqiqatan ham o'chirmoqchimisiz?"))) return;
    try {
      await base44.entities.Expense.delete(id);
      toast.success("Xarajat o'chirildi!");
      await loadData();
    } catch (error) {
      console.error('Failed to delete expense:', error);
      toast.error("O'chirishda xatolik yuz berdi");
    }
  }, [loadData, t]);

  // Open edit modal
  const openEdit = useCallback((expense) => {
    setEditingExpense(expense);
    setForm({
      category: expense.category || activeCategories[0]?.value || 'utilities',
      custom_category: expense.custom_category || '',
      amount: expense.amount,
      description: expense.description || '',
      date: expense.date,
      receipt_url: expense.receipt_url || ''
    });
    setModalOpen(true);
  }, [activeCategories]);

  // Export CSV with UTF-8 BOM
  const exportCSV = useCallback(() => {
    try {
      if (!sortedDisplayExpenses || sortedDisplayExpenses.length === 0) {
        toast.warning("Eksport qilish uchun xarajatlar topilmadi");
        return;
      }

      const headers = [
        "№",
        "Tavsif / Xarajat Nomi",
        "Bo'lim (Kategoriya)",
        "Xarajat Summasi (UZS)",
        "Sana"
      ];

      const rows = sortedDisplayExpenses.map((e, idx) => {
        const cat = allResolvedCategories.find(c => c.value === e.category);
        const catName = cat?.label || e.custom_category || e.category || 'Xarajat';
        const desc = (e.description || catName || '').replace(/"/g, '""');
        const amt = Number(e.amount || 0);
        const dt = e.date || '';
        return [
          idx + 1,
          `"${desc}"`,
          `"${catName}"`,
          amt,
          `"${dt}"`
        ].join(",");
      });

      const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `Xarajatlar_Excel_${selectedMonth}_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Xarajatlar Excel (.csv) formatida yuklab olindi!");
    } catch (err) {
      console.error(err);
      toast.error("Eksportda xatolik yuz berdi");
    }
  }, [sortedDisplayExpenses, selectedMonth, allResolvedCategories]);

  // Standard Month options generator (fixes "2026 M08" bug with explicit Uzbek months)
  const monthOptions = useMemo(() => {
    const options = [];
    const today = new Date();
    for (let i = 0; i < 18; i++) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const year = date.getFullYear();
      const monthIdx = date.getMonth();
      const value = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
      const label = `${UZ_MONTHS[monthIdx]} ${year}`;
      options.push({ value, label });
    }
    return options;
  }, []);

  // Standard date formatter (DD.MM.YYYY)
  const formatStandardDate = (dateVal) => {
    if (!dateVal) return '—';
    const dt = new Date(dateVal);
    if (isNaN(dt.getTime())) return dateVal;
    const d = String(dt.getDate()).padStart(2, '0');
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const y = dt.getFullYear();
    return `${d}.${m}.${y}`;
  };

  return (
    <div className="space-y-3.5">
      
      {/* ─── Excel Header Bar ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900 tracking-tight">{t('expenses.title') || "Harajatlar hisobi"}</h1>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
              • Moliya {expenses.length} Jami
            </span>
          </div>
          <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
            {t('expenses.subtitle') || "Klinika xarajatlari, chiqimlar va foyda/zarar hisob-kitobi"}
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
            onClick={() => {
              setEditingExpense(null);
              setForm({
                category: activeCategories[0]?.value || 'utilities',
                custom_category: '',
                amount: '',
                description: '',
                date: new Date().toISOString().split('T')[0],
                receipt_url: ''
              });
              setModalOpen(true);
            }} 
            className="bg-[#1499AD] hover:bg-[#0E7A8A] text-white gap-1.5 border-none rounded-xl h-9.5 px-4 font-black text-xs shadow-md shadow-[#1499AD]/20"
          >
            <Plus className="w-4 h-4" />
            <span>{t('expenses.add') || "Harajat qo'shish"}</span>
          </Button>
        </div>
      </div>

      {/* ─── Top Profit/Loss KPI Grid ───────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Sof Foyda */}
        <motion.div 
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-2xl border shadow-xs flex items-center justify-between ${
            totals.profit >= 0 ? 'bg-emerald-50/40 border-emerald-200' : 'bg-rose-50/40 border-rose-200'
          }`}
        >
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                {totals.profit >= 0 ? t('expenses.profit') : t('expenses.loss')}
              </span>
              <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                totals.profit >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}>
                {totals.profit >= 0 ? 'Ijobiy' : 'Zarar'}
              </span>
            </div>
            <div className={`text-xl font-black font-mono tracking-tight mt-1 tabular-nums ${
              totals.profit >= 0 ? 'text-emerald-700' : 'text-rose-700'
            }`}>
              {totals.profit < 0 ? '-' : '+'}{formatCurrency(Math.abs(totals.profit))}
            </div>
            <p className="text-[10px] font-medium text-slate-400 mt-0.5">
              {t('expenses.totalIncome')} − {t('expenses.totalExpense')}
            </p>
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-xs shrink-0 ${
            totals.profit >= 0 ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
          }`}>
            {totals.profit >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
          </div>
        </motion.div>
        
        {/* Umumiy Daromad */}
        <motion.div 
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex items-center justify-between"
        >
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              {t('expenses.totalIncome') || "Umumiy Daromad"}
            </span>
            <div className="text-xl font-black font-mono tracking-tight text-emerald-600 mt-1 tabular-nums">
              {formatCurrency(totals.totalIncome)}
            </div>
            <p className="text-[10px] font-medium text-slate-400 mt-0.5">
              {t('payments.income') || "Klinika kirimlari"}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-xs shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
        </motion.div>
        
        {/* Umumiy Harajat */}
        <motion.div 
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex items-center justify-between"
        >
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              {t('expenses.totalExpense') || "Umumiy Xarajat"}
            </span>
            <div className="text-xl font-black font-mono tracking-tight text-rose-600 mt-1 tabular-nums">
              -{formatCurrency(totals.totalExpense)}
            </div>
            <p className="text-[10px] font-medium text-slate-400 mt-0.5">
              {monthlyExpenses.length} ta xarajat ro'yxati
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shadow-xs shrink-0">
            <TrendingDown className="w-5 h-5" />
          </div>
        </motion.div>
      </div>

      {/* ─── Category Breakdown Bar (With Archiving Support) ──────────── */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs font-black text-slate-800 uppercase tracking-wider">
              <PieChart className="w-3.5 h-3.5 text-[#1499AD]" />
              <span>{t('expenses.byCategory') || "Kategoriya bo'yicha"}</span>
            </div>
            <span className="text-[10px] font-bold text-slate-400">
              ({activeCategories.length} ta faol)
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Arxivlangan bo'limlar tugmasi */}
            {archivedCategories.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setArchiveModalOpen(true)}
                className="h-7 px-2.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 text-[9.5px] font-black uppercase tracking-wider gap-1 border border-amber-200/70"
                title="Arxivlangan bo'limlarni ko'rish va qayta tiklash"
              >
                <FolderArchive className="w-3 h-3 text-amber-600" />
                <span>Arxiv ({archivedCategories.length})</span>
              </Button>
            )}

            {/* + Bo'lim qo'shish */}
            <Button
              size="sm"
              variant="ghost"
              onClick={openAddCategory}
              className="h-7 px-2.5 rounded-lg bg-slate-50 hover:bg-[#1499AD]/10 text-[#1499AD] text-[9.5px] font-black uppercase tracking-wider gap-1 border border-slate-200/70"
            >
              <Plus className="w-3 h-3" />
              <span>Bo'lim qo'shish</span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-2">
          {activeCategories.map(cat => {
            const amount = totals.byCategory[cat.value] || 0;
            const percentage = totals.totalExpense > 0 
              ? Math.round((amount / totals.totalExpense) * 100) 
              : 0;
            const IconComp = cat.icon || Tag;
            const isSelected = selectedCategory === cat.value;
            
            return (
              <div 
                key={cat.id || cat.value} 
                onClick={() => setSelectedCategory(selectedCategory === cat.value ? 'all' : cat.value)}
                className={`${cat.color} rounded-xl p-2.5 transition-all duration-200 hover:shadow-sm relative group cursor-pointer flex flex-col justify-between min-h-[76px] border ${
                  isSelected ? 'ring-2 ring-[#1499AD] shadow-sm' : 'border-transparent'
                }`}
              >
                {/* Top row: Icon & Action buttons (Edit & Archive) */}
                <div className="flex items-center justify-between mb-1">
                  <div className="w-6 h-6 rounded-lg bg-white/80 flex items-center justify-center shrink-0 shadow-xs">
                    <IconComp className="w-3.5 h-3.5" />
                  </div>
                  
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* Arxivlash tugmasi */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleArchiveCategory(cat);
                      }}
                      className="w-5 h-5 rounded-md bg-white/90 hover:bg-amber-50 text-slate-600 hover:text-amber-700 shadow-xs flex items-center justify-center transition-all hover:scale-110 active:scale-95 cursor-pointer"
                      title="Bo'limni arxivlash"
                    >
                      <Archive className="w-2.5 h-2.5" />
                    </button>

                    {/* Tahrirlash qalami */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditCategory(cat);
                      }}
                      className="w-5 h-5 rounded-md bg-white/90 hover:bg-white text-slate-700 shadow-xs flex items-center justify-center transition-all hover:scale-110 active:scale-95 cursor-pointer"
                      title="Nomini yoki ikonkasini tahrirlash"
                    >
                      <Pencil className="w-2.5 h-2.5 text-slate-600" />
                    </button>
                  </div>
                </div>
                
                <div>
                  <p className="text-[9.5px] font-black uppercase tracking-wider opacity-85 truncate" title={cat.label}>
                    {cat.label}
                  </p>
                  <p className="text-[12px] font-black font-mono mt-0.5 tracking-tight tabular-nums">
                    {formatCurrency(amount).replace(" so'm", "")}
                  </p>
                  {percentage > 0 && (
                    <div className="mt-1 h-0.5 bg-black/10 rounded-full overflow-hidden">
                      <div className="h-full bg-current opacity-40 rounded-full" style={{ width: `${percentage}%` }} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* + Yangi bo'lim qo'shish kartasi */}
          <button
            type="button"
            onClick={openAddCategory}
            className="rounded-xl p-2 border-2 border-dashed border-slate-200 hover:border-[#1499AD] bg-slate-50/50 hover:bg-[#1499AD]/5 flex flex-col items-center justify-center text-slate-400 hover:text-[#1499AD] transition-all min-h-[76px] group cursor-pointer active:scale-95"
            title="Yangi bo'lim qo'shish"
          >
            <div className="w-6 h-6 rounded-lg bg-white border border-slate-200 group-hover:border-[#1499AD] flex items-center justify-center mb-1 shadow-xs group-hover:scale-110 transition-transform">
              <Plus className="w-3.5 h-3.5 text-slate-500 group-hover:text-[#1499AD]" />
            </div>
            <span className="text-[8.5px] font-black uppercase tracking-wider text-slate-500 group-hover:text-[#1499AD] leading-tight text-center">
              + Bo'lim
            </span>
          </button>
        </div>
      </div>

      {/* ─── Excel Spreadsheet Controls Bar ────────────────────────── */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          
          {/* Search Box */}
          <div className="relative flex-1 group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#1499AD] transition-colors" />
            <input 
              type="text" 
              placeholder="Xarajat tavsifi yoki bo'lim bo'yicha qidiruv..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-9 pr-8 bg-slate-50 hover:bg-white focus:bg-white rounded-xl border border-slate-200 focus:border-[#1499AD] font-semibold text-slate-800 text-xs focus:ring-2 focus:ring-[#1499AD]/10 transition-all outline-none"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Month Selector (Standard Uzbek format, e.g. "Avgust 2026") */}
          <div className="w-full sm:w-auto">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-full sm:w-48 h-9 rounded-xl font-bold text-xs bg-slate-50 border-slate-200">
                <Calendar className="w-3.5 h-3.5 mr-2 text-[#1499AD]" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl font-bold text-xs">
                {monthOptions.map(m => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Category Filter Select */}
          <div className="w-full sm:w-auto">
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full sm:w-44 h-9 rounded-xl font-bold text-xs bg-slate-50 border-slate-200">
                <Filter className="w-3.5 h-3.5 mr-2 text-slate-400" />
                <SelectValue placeholder={t('expenses.category') || "Bo'lim"} />
              </SelectTrigger>
              <SelectContent className="rounded-xl font-bold text-xs">
                <SelectItem value="all">{t('common.all') || "Barchasi"}</SelectItem>
                {activeCategories.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Density Switcher */}
          <div className="hidden sm:flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/70 self-end lg:self-auto shrink-0">
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

      {/* ─── Main Excel Spreadsheet Data Grid Table ──────────────────── */}
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
                <th 
                  onClick={() => handleSort('date')}
                  className="w-12 px-2.5 py-2.5 text-center border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors select-none"
                  title="Tartib raqami"
                >
                  <div className="flex items-center justify-center gap-1 font-mono">
                    <span>№</span>
                    {sortField === 'date' && (
                      sortOrder === 'asc' ? <ArrowUp className="w-2.5 h-2.5 text-[#1499AD]" /> : <ArrowDown className="w-2.5 h-2.5 text-[#1499AD]" />
                    )}
                  </div>
                </th>

                {/* Description / Expense Name */}
                <th 
                  onClick={() => handleSort('description')}
                  className="px-3.5 py-2.5 border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors select-none"
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span>{t('expenses.description') || "Tavsif / Xarajat nomi"}</span>
                    {sortField === 'description' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#1499AD]" /> : <ArrowDown className="w-3 h-3 text-[#1499AD]" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-30" />
                    )}
                  </div>
                </th>

                {/* Category */}
                <th 
                  onClick={() => handleSort('category')}
                  className="w-48 px-3 py-2.5 border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors select-none whitespace-nowrap"
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span>{t('expenses.category') || "Bo'lim (Kategoriya)"}</span>
                    {sortField === 'category' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#1499AD]" /> : <ArrowDown className="w-3 h-3 text-[#1499AD]" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-30" />
                    )}
                  </div>
                </th>

                {/* Amount */}
                <th 
                  onClick={() => handleSort('amount')}
                  className="w-44 px-3.5 py-2.5 text-right border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors bg-rose-50/40 select-none whitespace-nowrap"
                >
                  <div className="flex items-center justify-end gap-1.5 text-rose-700">
                    <span>{t('expenses.amount') || "Xarajat Summasi"}</span>
                    {sortField === 'amount' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>

                {/* Date (Standard format) */}
                <th 
                  onClick={() => handleSort('date')}
                  className="w-36 px-2.5 py-2.5 text-center border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors select-none whitespace-nowrap"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>{t('expenses.date') || "Sana"}</span>
                    {sortField === 'date' && (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#1499AD]" /> : <ArrowDown className="w-3 h-3 text-[#1499AD]" />
                    )}
                  </div>
                </th>

                {/* Actions */}
                <th className="w-20 px-2 py-2.5 text-center text-slate-500 whitespace-nowrap select-none">
                  {t('common.actions') || "Amallar"}
                </th>

              </tr>
            </thead>

            {/* ─── Excel Table Body ────────────────── */}
            <tbody className="divide-y divide-slate-200/70 text-xs">
              {sortedDisplayExpenses.length > 0 ? (
                sortedDisplayExpenses.map((e, idx) => {
                  const category = allResolvedCategories.find(c => c.value === e.category);
                  const displayCategory = category?.label || e.custom_category || e.category || 'Xarajat';
                  const IconComponent = category?.icon || Tag;
                  const isCompact = density === 'compact';

                  return (
                    <tr 
                      key={e.id} 
                      className={`group hover:bg-[#1499AD]/10 hover:shadow-xs transition-colors cursor-pointer ${
                        idx % 2 === 1 ? 'bg-slate-50/30' : 'bg-white'
                      }`}
                      onClick={() => openEdit(e)}
                    >
                      {/* № Cell */}
                      <td className={`text-center font-mono font-bold text-slate-400 border-r border-slate-200/70 whitespace-nowrap ${isCompact ? 'py-2 px-2' : 'py-3 px-2.5'}`}>
                        {idx + 1}
                      </td>

                      {/* Description / Expense Name Cell */}
                      <td className={`border-r border-slate-200/70 ${isCompact ? 'py-1.5 px-3' : 'py-2.5 px-3.5'}`}>
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-xs border border-slate-200/60 ${category?.color || 'bg-slate-100 text-slate-700'}`}>
                            <IconComponent className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="font-extrabold text-slate-900 group-hover:text-[#1499AD] transition-colors truncate block">
                              {e.description || displayCategory}
                            </span>
                            {e.custom_category && e.description && (
                              <span className="text-[10px] font-bold text-slate-400">
                                {e.custom_category}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Category Badge Cell */}
                      <td className={`border-r border-slate-200/70 whitespace-nowrap ${isCompact ? 'py-1.5 px-2.5' : 'py-2.5 px-3'}`}>
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10.5px] font-extrabold border border-slate-200/60 ${category?.color || 'bg-slate-100 text-slate-700'}`}>
                          <span>{displayCategory}</span>
                        </span>
                      </td>

                      {/* Amount Cell */}
                      <td className={`text-right border-r border-slate-200/70 whitespace-nowrap ${isCompact ? 'py-1.5 px-2.5' : 'py-2.5 px-3'}`}>
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="font-mono font-black text-rose-600 text-xs tabular-nums">
                            -{Number(e.amount || 0).toLocaleString()}
                            <span className="text-[9.5px] font-semibold text-rose-400 ml-1">UZS</span>
                          </span>
                          {e.receipt_url && (
                            <button
                              type="button"
                              onClick={(ev) => {
                                ev.stopPropagation();
                                setPreviewReceiptUrl(e.receipt_url);
                              }}
                              className="px-1.5 py-0.2 rounded text-[8.5px] font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 flex items-center gap-0.5 transition-all"
                              title="Chek rasmini ko'rish"
                            >
                              <Receipt className="w-2.5 h-2.5" /> Chek
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Date Cell (Standard format: DD.MM.YYYY) */}
                      <td className={`text-center font-mono text-[11px] text-slate-700 font-bold border-r border-slate-200/70 whitespace-nowrap ${isCompact ? 'py-1.5 px-2' : 'py-2.5 px-2.5'}`}>
                        <span>{formatStandardDate(e.date)}</span>
                      </td>

                      {/* Actions Cell */}
                      <td className={`text-center whitespace-nowrap ${isCompact ? 'py-1 px-1.5' : 'py-2 px-2'}`}>
                        <div className="flex items-center justify-center gap-1" onClick={(ev) => ev.stopPropagation()}>
                          <button 
                            onClick={() => openEdit(e)}
                            className="p-1 rounded-lg text-slate-400 hover:text-[#1499AD] hover:bg-[#1499AD]/10 transition-all"
                            title="Xarajatni tahrirlash"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => handleDelete(e.id)}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all"
                            title="Xarajatni o'chirish"
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
                  <td colSpan={6} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300">
                        <TrendingDown className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-bold text-slate-500">
                        {searchQuery ? `"${searchQuery}" bo'yicha xarajat topilmadi` : "Ushbu oy uchun xarajatlar kiritilmagan"}
                      </p>
                      {(searchQuery || selectedCategory !== 'all') && (
                        <button
                          onClick={() => { setSearchQuery(''); setSelectedCategory('all'); }}
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
              <strong className="text-slate-900 font-mono">{expenseSummary.totalCount}</strong> ta xarajat
            </span>
            <span className="text-slate-300">•</span>
            <span>
              x̄ O'rtacha xarajat: <strong className="text-slate-800 font-mono">{expenseSummary.avgExpense.toLocaleString()} UZS</strong>
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-black uppercase text-slate-500">Σ Jami Xarajat:</span>
              <span className="font-mono font-black text-rose-600 text-sm">
                -{expenseSummary.sumExpense.toLocaleString()} <span className="text-[10px] text-slate-500">UZS</span>
              </span>
            </div>

            <div className="flex items-center gap-1.5 border-l border-slate-300 pl-3">
              <span className="text-[11px] font-black uppercase text-slate-500">Σ Sof Foyda:</span>
              <span className={`font-mono font-black text-sm ${totals.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {totals.profit < 0 ? '-' : '+'}{Math.abs(totals.profit).toLocaleString()} <span className="text-[10px] text-slate-500">UZS</span>
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ─── Receipt Lightbox Preview Modal ─────────────────────────── */}
      <AnimatePresence>
        {previewReceiptUrl && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs"
            onClick={() => setPreviewReceiptUrl(null)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-[#1499AD]" />
                  <span className="font-extrabold text-sm text-slate-800">Xarajat Cheki / Hujjat</span>
                </div>
                <button
                  onClick={() => setPreviewReceiptUrl(null)}
                  className="p-1 rounded-lg hover:bg-slate-200 text-slate-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 flex-1 overflow-auto flex items-center justify-center bg-slate-950/5">
                <img 
                  src={previewReceiptUrl} 
                  alt="Chek rasmi" 
                  className="max-h-[70vh] w-auto object-contain rounded-lg shadow-sm"
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── Archived Categories Modal ───────────────────────────────── */}
      <Dialog open={archiveModalOpen} onOpenChange={setArchiveModalOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-slate-900 flex items-center gap-2">
              <FolderArchive className="w-4 h-4 text-amber-600" />
              <span>Arxivlangan Bo'limlar ({archivedCategories.length})</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-2.5 py-3 max-h-80 overflow-y-auto">
            {archivedCategories.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">Hozirda arxivlangan bo'limlar yo'q</p>
            ) : (
              archivedCategories.map(cat => {
                const IconComp = cat.icon || Tag;
                const totalSpent = totals.byCategory[cat.value] || 0;
                return (
                  <div 
                    key={cat.id || cat.value}
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white transition-all gap-2"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${cat.color}`}>
                        <IconComp className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-extrabold text-xs text-slate-900 truncate">{cat.label}</p>
                        <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                          Jami sarflangan: <strong className="text-slate-700">{formatCurrency(totalSpent)}</strong>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {/* Qayta tiklash */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggleArchiveCategory(cat)}
                        className="h-8 px-2.5 rounded-lg text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200 gap-1"
                        title="Arxivdan qayta tiklash"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Qayta tiklash</span>
                      </Button>

                      {/* Butunlay o'chirish */}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteCategory(cat)}
                        className="h-8 w-8 p-0 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        title="Butunlay o'chirish"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter className="pt-2 border-t border-slate-100">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setArchiveModalOpen(false)}
              className="rounded-xl font-bold text-xs"
            >
              Yopish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Add/Edit Category Modal ─────────────────────────────────── */}
      <Dialog open={catModalOpen} onOpenChange={setCatModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-slate-900 flex items-center gap-2">
              <Pencil className="w-4 h-4 text-[#1499AD]" />
              {editingCat ? "Bo'lim nomini tahrirlash" : "Yangi bo'lim qo'shish"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Category Name Input */}
            <div>
              <Label className="text-xs font-bold text-slate-700">
                Bo'lim (Kategoriya) nomi <span className="text-red-500">*</span>
              </Label>
              <Input 
                value={catForm.label}
                onChange={e => setCatForm({ ...catForm, label: e.target.value })}
                placeholder="Masalan: Kantselyariya, Transport, Choyxona..."
                className="mt-1.5 h-11 rounded-xl bg-slate-50 border-slate-200 font-bold"
                autoFocus
              />
            </div>

            {/* Icon Picker */}
            <div>
              <Label className="text-xs font-bold text-slate-700 block mb-2">
                Ikonkani tanlang
              </Label>
              <div className="grid grid-cols-5 gap-2 max-h-40 overflow-y-auto p-1.5 bg-slate-50 rounded-xl border border-slate-100">
                {AVAILABLE_ICONS.map(item => {
                  const Icon = item.icon;
                  const isSelected = catForm.icon === item.name;
                  return (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => setCatForm({ ...catForm, icon: item.name })}
                      title={item.label}
                      className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all cursor-pointer ${
                        isSelected 
                          ? 'bg-[#1499AD] text-white shadow-md scale-105' 
                          : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-100'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Color Theme Picker */}
            <div>
              <Label className="text-xs font-bold text-slate-700 block mb-2">
                Rang mavzusi
              </Label>
              <div className="grid grid-cols-4 gap-2">
                {COLOR_OPTIONS.map(color => {
                  const isSelected = catForm.color === color.value;
                  return (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setCatForm({ ...catForm, color: color.value })}
                      className={`${color.value} px-2.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-between border ${
                        isSelected ? 'ring-2 ring-[#1499AD] shadow-sm' : 'border-transparent opacity-80 hover:opacity-100'
                      }`}
                    >
                      <span>{color.label}</span>
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-1.5">
              {editingCat && (
                <>
                  {/* Arxivlash / Qayta tiklash */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleArchiveCategory(editingCat)}
                    className="rounded-xl font-bold uppercase text-[10px] tracking-wider text-amber-700 border-amber-200 hover:bg-amber-50"
                  >
                    <Archive className="w-3.5 h-3.5 mr-1" />
                    {editingCat.isArchived ? "Qayta tiklash" : "Arxivlash"}
                  </Button>

                  {/* Butunlay o'chirish */}
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteCategory(editingCat)}
                    className="rounded-xl font-bold uppercase text-[10px] tracking-wider"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    O'chirish
                  </Button>
                </>
              )}
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => setCatModalOpen(false)} 
                className="rounded-xl text-xs font-bold"
              >
                {t('common.cancel')}
              </Button>
              <Button 
                type="button" 
                onClick={handleSaveCategory}
                className="bg-[#1499AD] hover:bg-[#0E7A8A] text-white rounded-xl px-5 font-black uppercase text-xs tracking-wider border-none"
              >
                {t('common.save')}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Add/Edit Expense Modal ─────────────────────────────────── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-slate-900">
              {editingExpense ? t('expenses.edit') : t('expenses.add')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs font-bold text-slate-700">{t('expenses.category')} *</Label>
              <Select 
                value={form.category} 
                onValueChange={v => setForm({ ...form, category: v })}
              >
                <SelectTrigger className="mt-1.5 h-11 rounded-xl font-bold text-xs">
                  <SelectValue placeholder="Bo'limni tanlang" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {activeCategories.map(c => {
                    const CatIcon = c.icon || Tag;
                    return (
                      <SelectItem key={c.value} value={c.value} className="rounded-lg font-bold text-xs">
                        <div className="flex items-center gap-2">
                          <CatIcon className="w-3.5 h-3.5 text-slate-500" />
                          <span>{c.label}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-bold text-slate-700">{t('expenses.amount')} *</Label>
              <input
                type="text"
                inputMode="numeric"
                value={form.amount === '' || form.amount === 0 ? '' : Number(form.amount).toLocaleString('uz-UZ')}
                onChange={e => {
                  const raw = e.target.value.replace(/\s/g, '').replace(/,/g, '').replace(/\./g, '').replace(/'/g, '');
                  if (raw === '') setForm({ ...form, amount: 0 });
                  else if (/^\d+$/.test(raw)) setForm({ ...form, amount: Number(raw) });
                }}
                onKeyDown={e => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault(); }}
                onWheel={e => e.target.blur()}
                placeholder="0"
                className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-mono font-bold outline-none focus:ring-2 focus:ring-ring mt-1.5"
              />
            </div>
            <div>
              <Label className="text-xs font-bold text-slate-700">{t('expenses.date')} *</Label>
              <Input 
                type="date"
                value={form.date}
                onChange={e => setForm({ ...form, date: e.target.value })}
                className="mt-1.5 h-11 rounded-xl font-bold font-mono"
              />
            </div>
            <div>
              <Label className="text-xs font-bold text-slate-700">{t('expenses.description')}</Label>
              <Input 
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Masalan: Tish pastasi va cho'tkalar sotib olindi"
                className="mt-1.5 h-11 rounded-xl font-semibold"
              />
            </div>
            <div>
              <Label className="text-xs font-bold text-slate-700">Hujjat/Chek (Havola yoki URL)</Label>
              <Input 
                value={form.receipt_url}
                onChange={e => setForm({ ...form, receipt_url: e.target.value })}
                placeholder="https://cloud.com/receipt.jpg"
                className="mt-1.5 h-11 rounded-xl"
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="ghost" onClick={() => setModalOpen(false)} className="rounded-xl">
                {t('common.cancel')}
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={saving || !form.amount || !form.date}
                className="bg-[#1499AD] hover:bg-[#0E7A8A] text-white rounded-xl px-8 font-black uppercase text-xs tracking-widest border-none"
              >
                {saving ? t('common.save') + '...' : t('common.save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
