import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Plus, TrendingDown, TrendingUp, DollarSign, Calendar, 
  Download, Filter, PieChart, Building2, Zap, ShoppingCart, Wrench, MoreHorizontal, Trash2, Edit2, Pencil,
  Sparkles, Package, Coffee, Briefcase, Stethoscope, Car, Gift, FileText, Tag, Activity, Utensils, Truck, Heart, Shield, Laptop, Check, X
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import EmptyState from '@/components/ui/EmptyState';
import { useTranslation } from '@/i18n/LanguageContext';
import { toast } from 'sonner';

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
  { name: 'Tag', icon: Tag, label: 'Boshqa xarajat' },
  { name: 'MoreHorizontal', icon: MoreHorizontal, label: 'Boshqa' },
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
  { id: 'salary', value: 'salary', label: 'Ish haqi', icon: 'DollarSign', color: 'bg-emerald-100 text-emerald-700', isSystem: true },
  { id: 'materials', value: 'materials', label: 'Materiallar', icon: 'ShoppingCart', color: 'bg-blue-100 text-blue-700', isSystem: true },
  { id: 'lab', value: 'lab', label: 'Laboratoriya', icon: 'Wrench', color: 'bg-purple-100 text-purple-700', isSystem: true },
  { id: 'rent', value: 'rent', label: 'Arenda', icon: 'Building2', color: 'bg-indigo-100 text-indigo-700', isSystem: true },
  { id: 'utilities', value: 'utilities', label: 'Kommunal', icon: 'Zap', color: 'bg-amber-100 text-amber-700', isSystem: true },
  { id: 'marketing', value: 'marketing', label: 'Reklama/Marketing', icon: 'TrendingUp', color: 'bg-rose-100 text-rose-700', isSystem: true },
  { id: 'other', value: 'other', label: 'Boshqa', icon: 'MoreHorizontal', color: 'bg-slate-100 text-slate-700', isSystem: true },
];

const loadSavedCategories = () => {
  try {
    const raw = localStorage.getItem('myclinic_expense_categories');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
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
  const [editingCat, setEditingCat] = useState(null);
  const [catForm, setCatForm] = useState({
    label: '',
    icon: 'Tag',
    color: 'bg-blue-100 text-blue-700'
  });

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
      icon: cat.icon || 'MoreHorizontal',
      color: cat.color || 'bg-slate-100 text-slate-700'
    });
    setCatModalOpen(true);
  };

  const handleSaveCategory = () => {
    if (!catForm.label.trim()) {
      toast.error("Iltimos, kategoriya nomini kiriting");
      return;
    }
    if (editingCat) {
      const updated = categories.map(c => {
        if ((c.value && c.value === editingCat.value) || (c.id && c.id === editingCat.id)) {
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
      toast.success("Kategoriya yangilandi!");
    } else {
      const newId = 'cat_' + Date.now();
      const newCat = {
        id: newId,
        value: newId,
        label: catForm.label.trim(),
        icon: catForm.icon,
        color: catForm.color,
        isCustom: true
      };
      // Insert new category before 'other' so 'other' remains at the end
      const nonOther = categories.filter(c => c.value !== 'other' && c.id !== 'other');
      const otherCat = categories.find(c => c.value === 'other' || c.id === 'other') || DEFAULT_CATEGORIES.find(c => c.value === 'other');
      const updated = otherCat ? [...nonOther, newCat, otherCat] : [...nonOther, newCat];
      saveCategoriesToStorage(updated);
      toast.success("Yangi kategoriya qo'shildi!");
    }
    setCatModalOpen(false);
  };

  const handleDeleteCategory = (catToDelete) => {
    if (!confirm(`"${catToDelete.label}" kategoriyasini o'chirishni tasdiqlaysizmi?`)) return;
    const updated = categories.filter(c => (c.value || c.id) !== (catToDelete.value || catToDelete.id));
    saveCategoriesToStorage(updated);
    toast.success("Kategoriya o'chirildi!");
    setCatModalOpen(false);
  };

  // Resolved Expense Categories with React component icons (ensuring 'other' is ALWAYS last)
  const EXPENSE_CATEGORIES = useMemo(() => {
    const nonOther = categories.filter(c => c.value !== 'other' && c.id !== 'other');
    const otherCat = categories.find(c => c.value === 'other' || c.id === 'other') || DEFAULT_CATEGORIES.find(c => c.value === 'other');
    const sorted = otherCat ? [...nonOther, otherCat] : nonOther;

    return sorted.map(c => {
      const found = AVAILABLE_ICONS.find(i => i.name === c.icon);
      return {
        ...c,
        icon: found ? found.icon : MoreHorizontal,
      };
    });
  }, [categories]);

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
    category: 'other',
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
      console.log('Expenses loaded:', exps.length, 'Payments loaded:', pays.length);
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

  // Calculate totals
  const totals = useMemo(() => {
    const totalExpense = monthlyExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalIncome = monthlyIncome.reduce((sum, p) => sum + (p.amount || 0), 0);
    const profit = totalIncome - totalExpense;
    
    // Category totals
    const byCategory = {};
    EXPENSE_CATEGORIES.forEach(cat => {
      byCategory[cat.value] = monthlyExpenses
        .filter(e => e.category === cat.value)
        .reduce((sum, e) => sum + (e.amount || 0), 0);
    });
    
    return { totalExpense, totalIncome, profit, byCategory };
  }, [monthlyExpenses, monthlyIncome, EXPENSE_CATEGORIES]);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!form.amount || !form.date) return;
    
    setSaving(true);
    try {
      const payload = {
        ...form,
        custom_category: form.category === 'other' ? (form.custom_category || '').trim() : ''
      };
      if (editingExpense) {
        await base44.entities.Expense.update(editingExpense.id, payload);
      } else {
        await base44.entities.Expense.create(payload);
      }
      setModalOpen(false);
      setEditingExpense(null);
      setForm({
        category: 'other',
        custom_category: '',
        amount: '',
        description: '',
        date: new Date().toISOString().split('T')[0],
        receipt_url: ''
      });
      await loadData();
    } catch (error) {
      console.error('Failed to save expense:', error);
    } finally {
      setSaving(false);
    }
  }, [form, editingExpense, loadData]);

  // Handle delete
  const handleDelete = useCallback(async (id) => {
    if (!confirm(t('common.confirmDelete', "Haqiqatan ham o'chirmoqchimisiz?"))) return;
    try {
      await base44.entities.Expense.delete(id);
      await loadData();
    } catch (error) {
      console.error('Failed to delete expense:', error);
    }
  }, [loadData, t]);

  // Open edit modal
  const openEdit = useCallback((expense) => {
    setEditingExpense(expense);
    setForm({
      category: expense.category || 'other',
      custom_category: expense.custom_category || '',
      amount: expense.amount,
      description: expense.description || '',
      date: expense.date,
      receipt_url: expense.receipt_url || ''
    });
    setModalOpen(true);
  }, []);

  // Export CSV
  const exportCSV = useCallback(() => {
    const headers = [t('expenses.date'), t('expenses.category'), t('expenses.description'), t('expenses.amount')];
    const rows = filteredExpenses.map(e => [
      e.date,
      EXPENSE_CATEGORIES.find(c => c.value === e.category)?.label || e.category,
      e.description,
      e.amount
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expenses-${selectedMonth}.csv`;
    a.click();
  }, [filteredExpenses, selectedMonth, EXPENSE_CATEGORIES, t]);

  // Month options generator
  const monthOptions = useMemo(() => {
    const options = [];
    const today = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
      options.push({ value, label });
    }
    return options;
  }, []);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl premium-title">{t('expenses.title')}</h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-0.5 ml-1">
            {t('expenses.subtitle')}
          </p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            onClick={exportCSV} 
            className="gap-2 rounded-2xl border-slate-200 font-bold text-xs uppercase tracking-widest text-slate-500"
          >
            <Download className="w-4 h-4" />
            {t('common.export', 'Export')}
          </Button>
          <Button 
            onClick={() => setModalOpen(true)} 
            className="bg-[#1499AD] hover:bg-[#0E7A8A] text-white gap-2 border-none rounded-2xl h-11 px-6 font-black text-xs uppercase tracking-widest shadow-lg shadow-[#1499AD]/20"
          >
            <Plus className="w-4 h-4" />
            {t('expenses.add')}
          </Button>
        </div>
      </div>

      {/* Profit/Loss Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        <Card className={`border shadow-sm rounded-2xl ${totals.profit >= 0 ? 'border-green-100' : 'border-red-100'}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-500">
              {totals.profit >= 0 ? t('expenses.profit') : t('expenses.loss')}
            </CardTitle>
            {totals.profit >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-xl md:text-2xl font-black ${totals.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(Math.abs(totals.profit))}
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              {t('expenses.totalIncome')} - {t('expenses.totalExpense')}
            </p>
          </CardContent>
        </Card>
        
        <Card className="border-slate-100 shadow-sm rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-500">{t('expenses.totalIncome')}</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-black text-emerald-600">
              {formatCurrency(totals.totalIncome)}
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              {t('payments.income')}
            </p>
          </CardContent>
        </Card>
        
        <Card className="border-slate-100 shadow-sm rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-500">{t('expenses.totalExpense')}</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-black text-red-600">
              {formatCurrency(totals.totalExpense)}
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              {t('expenses.list')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown */}
      <Card className="border-slate-100 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between py-2.5 px-4 pb-2">
          <CardTitle className="flex items-center gap-2 text-xs font-black text-slate-800 uppercase tracking-wider">
            <PieChart className="w-3.5 h-3.5 text-[#1499AD]" />
            {t('expenses.byCategory') || "Kategoriya bo'yicha"}
          </CardTitle>
          <Button
            size="sm"
            variant="ghost"
            onClick={openAddCategory}
            className="h-7 px-2.5 rounded-lg bg-slate-50 hover:bg-[#1499AD]/10 text-[#1499AD] text-[9px] font-black uppercase tracking-wider gap-1"
          >
            <Plus className="w-3 h-3" />
            Bo'lim qo'shish
          </Button>
        </CardHeader>
        <CardContent className="px-4 pb-3 pt-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-9 gap-2">
            {EXPENSE_CATEGORIES.map(cat => {
              const amount = totals.byCategory[cat.value] || 0;
              const percentage = totals.totalExpense > 0 
                ? Math.round((amount / totals.totalExpense) * 100) 
                : 0;
              const IconComp = cat.icon || MoreHorizontal;
              const isSelected = selectedCategory === cat.value;
              
              return (
                <div 
                  key={cat.id || cat.value} 
                  onClick={() => setSelectedCategory(selectedCategory === cat.value ? 'all' : cat.value)}
                  className={`${cat.color} rounded-xl p-2.5 transition-all duration-200 hover:shadow-sm relative group cursor-pointer flex flex-col justify-between min-h-[82px] border ${isSelected ? 'ring-2 ring-[#1499AD] shadow-sm' : 'border-transparent'}`}
                >
                  {/* Top row: Icon & Hover Edit Pencil */}
                  <div className="flex items-center justify-between mb-1">
                    <div className="w-6 h-6 rounded-lg bg-white/70 flex items-center justify-center shrink-0 shadow-xs">
                      <IconComp className="w-3.5 h-3.5" />
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditCategory(cat);
                      }}
                      className="w-5.5 h-5.5 rounded-md bg-white/80 hover:bg-white text-slate-700 shadow-xs flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-95 cursor-pointer"
                      title="Nomini yoki ikonkasini tahrirlash"
                    >
                      <Pencil className="w-3 h-3 text-slate-600" />
                    </button>
                  </div>
                  
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-wider opacity-85 truncate" title={cat.label}>
                      {cat.label}
                    </p>
                    <p className="text-xs font-black mt-0.5 tracking-tight">
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
              className="rounded-xl p-2.5 border-2 border-dashed border-slate-200 hover:border-[#1499AD] bg-slate-50/50 hover:bg-[#1499AD]/5 flex flex-col items-center justify-center text-slate-400 hover:text-[#1499AD] transition-all min-h-[82px] group cursor-pointer active:scale-95"
              title="Yangi bo'lim (kategoriya) qo'shish"
            >
              <div className="w-6 h-6 rounded-lg bg-white border border-slate-200 group-hover:border-[#1499AD] flex items-center justify-center mb-1 shadow-xs group-hover:scale-110 transition-transform">
                <Plus className="w-3.5 h-3.5 text-slate-500 group-hover:text-[#1499AD]" />
              </div>
              <span className="text-[8px] font-black uppercase tracking-wider text-slate-500 group-hover:text-[#1499AD] leading-tight text-center">
                + Bo'lim
              </span>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input 
            placeholder={t('common.searchPlaceholder', "Qidirish...")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-48">
            <Calendar className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map(m => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-44">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder={t('expenses.category')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('common.all')}</SelectItem>
            {EXPENSE_CATEGORIES.map(c => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Expenses Table */}
      <Card className="border-slate-100 shadow-sm rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="flex items-center gap-3">
            <CardTitle>{t('expenses.list')}</CardTitle>
            {selectedCategory !== 'all' && (
              <Badge 
                variant="secondary" 
                className="bg-[#1499AD]/10 text-[#1499AD] border border-[#1499AD]/20 gap-1.5 px-3 py-1 font-bold text-xs rounded-xl cursor-pointer hover:bg-[#1499AD]/20"
                onClick={() => setSelectedCategory('all')}
              >
                <span>Bo'lim: {EXPENSE_CATEGORIES.find(c => c.value === selectedCategory)?.label || selectedCategory}</span>
                <X className="w-3 h-3 text-[#1499AD]" />
              </Badge>
            )}
          </div>
          {selectedCategory !== 'all' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedCategory('all')}
              className="text-xs font-bold text-slate-500 hover:text-slate-900"
            >
              Barchasini ko'rsatish
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="py-12 text-center flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-3 text-slate-400">
                <TrendingDown className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-800">
                {selectedCategory !== 'all' 
                  ? `"${EXPENSE_CATEGORIES.find(c => c.value === selectedCategory)?.label || selectedCategory}" bo'limida xarajatlar yo'q`
                  : t('common.noData')}
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                {selectedCategory !== 'all'
                  ? "Boshqa bo'limlardagi (masalan Kommunal) xarajatlarni ko'rish uchun barcha xarajatlar filtrini tanlang."
                  : "Ushbu oy uchun hali hech qanday xarajat kiritilmagan."}
              </p>
              {selectedCategory !== 'all' && (
                <Button
                  onClick={() => setSelectedCategory('all')}
                  className="mt-4 bg-[#1499AD] hover:bg-[#0E7A8A] text-white rounded-xl px-5 font-bold text-xs border-none"
                >
                  Barcha xarajatlarni ko'rsatish
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              {filteredExpenses.map(expense => {
                const category = EXPENSE_CATEGORIES.find(c => c.value === expense.category);
                const displayCategory = (expense.category === 'other' && expense.custom_category)
                  ? expense.custom_category
                  : (category?.label || expense.custom_category || expense.category);
                const IconComponent = category?.icon || MoreHorizontal;
                
                // Format date as Uzbek readable text: e.g. "22-Avgust, 2026"
                const dateObj = expense.date ? new Date(expense.date) : null;
                const monthsUz = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'];
                const formattedDateText = (dateObj && !isNaN(dateObj.getTime()))
                  ? `${dateObj.getDate()}-${monthsUz[dateObj.getMonth()]}, ${dateObj.getFullYear()}`
                  : (expense.date || '—');

                return (
                  <div 
                    key={expense.id} 
                    onClick={() => openEdit(expense)}
                    className="flex items-center justify-between px-3.5 py-2 border border-slate-100/90 rounded-xl hover:bg-slate-50/80 hover:border-slate-200 transition-all gap-3 cursor-pointer bg-white group active:scale-[0.99]"
                    title="Xarajatni ko'rish / tahrirlash uchun bosing"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-xs ${category?.color || 'bg-gray-100'}`}>
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-xs sm:text-sm text-slate-800 truncate">{expense.description || displayCategory}</p>
                          <Badge variant="secondary" className="text-[9px] font-bold uppercase tracking-wider py-0 px-1.5 h-4 bg-slate-100 text-slate-600 border-none">
                            {displayCategory}
                          </Badge>
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 mt-0.5 tracking-wide">
                          {formattedDateText}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <p className="text-xs sm:text-sm font-black text-rose-600 whitespace-nowrap">
                        -{formatCurrency(expense.amount)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Category Modal */}
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
            {editingCat && !editingCat.isSystem && (
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
            )}
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

      {/* Add/Edit Expense Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingExpense ? t('expenses.edit') : t('expenses.add')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('expenses.category')} *</Label>
              <Select 
                value={form.category} 
                onValueChange={v => setForm({ ...form, category: v })}
              >
                <SelectTrigger className="mt-1.5 h-11 rounded-xl font-bold text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {EXPENSE_CATEGORIES.map(c => {
                    const CatIcon = c.icon || MoreHorizontal;
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
            {form.category === 'other' && (
              <div className="space-y-1.5 animate-in fade-in-50 duration-200">
                <Label className="text-xs font-bold text-slate-700">Kategoriya nomini yozing</Label>
                <Input 
                  value={form.custom_category || ''}
                  onChange={e => setForm({ ...form, custom_category: e.target.value })}
                  placeholder="Masalan: Ofis jihozlari, Kantselyariya, Ta'mirlash..."
                  className="h-11 rounded-xl bg-slate-50 border-slate-200 font-bold"
                  autoFocus
                />
              </div>
            )}
            <div>
              <Label>{t('expenses.amount')} *</Label>
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
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring mt-1"
              />
            </div>
            <div>
              <Label>{t('expenses.date')} *</Label>
              <Input 
                type="date"
                value={form.date}
                onChange={e => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div>
              <Label>{t('expenses.description')}</Label>
              <Input 
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Masalan: Tish pastasi va cho'tkalar sotib olindi"
                className="mt-1.5 h-11 rounded-xl"
              />
            </div>
            <div>
              <Label>Hujjat/Chek (Havola)</Label>
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
