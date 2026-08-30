import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TrendingDown, TrendingUp, DollarSign, Plus, Search, 
  MoreHorizontal, ShoppingCart, Car, Wrench, 
  Zap, Building2, ChevronRight, Activity,
  Filter, FileText, ArrowUpRight, ArrowDownRight,
  ChevronLeft, X, Trash2, Pencil, Sparkles, Package, Coffee, Briefcase, Stethoscope, Gift, Tag, Utensils, Truck, Heart, Shield, Laptop, Check
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import PullToRefresh from '@/components/ui/PullToRefresh';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useTranslation } from '@/i18n/LanguageContext';

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
  { value: 'bg-emerald-100 text-emerald-700', label: 'Yashil', bg: 'bg-emerald-50', color: 'text-emerald-600', border: 'border-emerald-100' },
  { value: 'bg-blue-100 text-blue-700', label: 'Ko\'k', bg: 'bg-blue-50', color: 'text-blue-600', border: 'border-blue-100' },
  { value: 'bg-purple-100 text-purple-700', label: 'Binafsha', bg: 'bg-purple-50', color: 'text-purple-600', border: 'border-purple-100' },
  { value: 'bg-indigo-100 text-indigo-700', label: 'To\'q ko\'k', bg: 'bg-indigo-50', color: 'text-indigo-600', border: 'border-indigo-100' },
  { value: 'bg-amber-100 text-amber-700', label: 'Sariq', bg: 'bg-amber-50', color: 'text-amber-600', border: 'border-amber-100' },
  { value: 'bg-rose-100 text-rose-700', label: 'Qizil', bg: 'bg-rose-50', color: 'text-rose-600', border: 'border-rose-100' },
  { value: 'bg-cyan-100 text-cyan-700', label: 'Moviy', bg: 'bg-cyan-50', color: 'text-cyan-600', border: 'border-cyan-100' },
  { value: 'bg-slate-100 text-slate-700', label: 'Kulrang', bg: 'bg-slate-50', color: 'text-slate-600', border: 'border-slate-100' },
];

const DEFAULT_CATEGORIES = [
  { id: 'salary', value: 'salary', label: 'Ish haqi', icon: 'Banknote', color: 'bg-emerald-100 text-emerald-700', isSystem: true },
  { id: 'materials', value: 'materials', label: 'Materiallar', icon: 'ShoppingCart', color: 'bg-blue-100 text-blue-700', isSystem: true },
  { id: 'lab', value: 'lab', label: 'Laboratoriya', icon: 'Wrench', color: 'bg-purple-100 text-purple-700', isSystem: true },
  { id: 'rent', value: 'rent', label: 'Arenda', icon: 'Building2', color: 'bg-indigo-100 text-indigo-700', isSystem: true },
  { id: 'utilities', value: 'utilities', label: 'Kommunal', icon: 'Zap', color: 'bg-amber-100 text-amber-700', isSystem: true },
  { id: 'marketing', label: 'Reklama/Marketing', value: 'marketing', icon: 'TrendingUp', color: 'bg-rose-100 text-rose-700', isSystem: true },
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

const formatCompactCurrency = (value) => {
  if (value >= 1_000_000) {
    return (value / 1_000_000).toFixed(1).replace(/\.0$/, '') + ' mln';
  }
  if (value >= 1_000) {
    return (value / 1_000).toFixed(0) + 'k';
  }
  return String(value);
};

export default function MobileExpenses() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [expenses, setExpenses] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);

  // Category state with localStorage persistence
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

  const EXPENSE_CATEGORIES = useMemo(() => {
    const nonOther = categories.filter(c => c.value !== 'other' && c.id !== 'other');
    const otherCat = categories.find(c => c.value === 'other' || c.id === 'other') || DEFAULT_CATEGORIES.find(c => c.value === 'other');
    const sorted = otherCat ? [...nonOther, otherCat] : nonOther;

    return sorted.map(c => {
      const found = AVAILABLE_ICONS.find(i => i.name === c.icon);
      const colorFound = COLOR_OPTIONS.find(co => co.value === c.color);
      return {
        ...c,
        icon: found ? found.icon : MoreHorizontal,
        bg: colorFound?.bg || 'bg-slate-50',
        color: colorFound?.color || 'text-slate-600',
        border: colorFound?.border || 'border-slate-100'
      };
    });
  }, [categories]);

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    category: 'other',
    custom_category: '',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    receipt_url: ''
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [exps, pays] = await Promise.all([
        base44.entities.Expense?.list('-date', 100) || Promise.resolve([]),
        base44.entities.Payment.filter({ type: 'income' }, '-date', 100)
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

  useEffect(() => {
    const handleOpenAdd = () => {
      setEditingExpense(null);
      setForm({
        category: 'other',
        amount: '',
        description: '',
        date: new Date().toISOString().split('T')[0],
        receipt_url: ''
      });
      setModalOpen(true);
    };
    window.addEventListener('open-expenses-add', handleOpenAdd);
    return () => window.removeEventListener('open-expenses-add', handleOpenAdd);
  }, []);

  const monthlyExpenses = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    return expenses.filter(item => {
      const d = new Date(item.date);
      return d.getFullYear() === year && d.getMonth() === month - 1;
    });
  }, [expenses, selectedMonth]);

  const monthlyIncome = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    return payments.filter(item => {
      const d = new Date(item.date);
      return d.getFullYear() === year && d.getMonth() === month - 1;
    });
  }, [payments, selectedMonth]);

  const totalExpense = monthlyExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalIncome = monthlyIncome.reduce((sum, p) => sum + (p.amount || 0), 0);
  const profit = totalIncome - totalExpense;
  const balancePercent = totalIncome > 0 ? Math.min(100, (totalExpense / totalIncome) * 100) : 0;

  const categoryTotals = useMemo(() => {
    const totals = {};
    EXPENSE_CATEGORIES.forEach(c => totals[c.value] = 0);
    monthlyExpenses.forEach(e => {
      const cat = e.category || 'other';
      if (totals[cat] !== undefined) {
        totals[cat] += e.amount || 0;
      } else {
        totals['other'] += (e.amount || 0);
      }
    });
    return totals;
  }, [monthlyExpenses]);

  const handleSave = async () => {
    if (!form.amount || !form.date) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        custom_category: form.category === 'other' ? (form.custom_category || '').trim() : ''
      };
      if (editingExpense) {
        await base44.entities.Expense.update(editingExpense.id, payload);
        toast.success("Xarajat tahrirlandi!");
      } else {
        await base44.entities.Expense.create(payload);
        toast.success("Xarajat muvaffaqiyatli qo'shildi!");
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
      toast.error('Xatolik yuz berdi');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Ushbu xarajatni o'chirishni tasdiqlaysizmi? Bu amalni ortga qaytarib bo'lmaydi!")) return;
    try {
      await base44.entities.Expense.delete(id);
      toast.success("Xarajat o'chirildi!");
      setModalOpen(false);
      setEditingExpense(null);
      await loadData();
    } catch (error) {
      toast.error("O'chirishda xatolik yuz berdi");
    }
  };

  const changeMonth = (offset) => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const date = new Date(y, m - 1 + offset, 1);
    setSelectedMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  };

  const filteredExpenses = useMemo(() => {
    let result = monthlyExpenses;
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(e => 
        (e.description?.toLowerCase() || '').includes(s) ||
        (e.category?.toLowerCase() || '').includes(s)
      );
    }
    return result;
  }, [monthlyExpenses, search]);

  const monthName = new Date(selectedMonth + '-01').toLocaleDateString('uz-UZ', { month: 'long', year: 'numeric' });

  return (
    <PullToRefresh onRefresh={loadData}>
      <div className="min-h-screen bg-[#F8FAFC] pb-32 w-full overflow-x-hidden">
        
        {/* Modern Header */}
        <div className="bg-white px-4 pt-4 pb-4 rounded-b-[2rem] shadow-sm border-b border-slate-100 relative z-20 w-full overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none mb-1">Xarajatlar</h1>
              <p className="text-[9px] font-black text-emerald-600 uppercase tracking-wider">Moliyaviy Nazorat</p>
            </div>
          </div>
  
          {/* Month Selector */}
          <div className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-2xl p-1 mb-3">
             <button onClick={() => changeMonth(-1)} className="w-8 h-8 flex items-center justify-center text-slate-400 active:text-slate-900 active:bg-slate-200/50 rounded-xl transition-all"><ChevronLeft className="w-4 h-4" /></button>
             <span className="text-[11px] font-black text-slate-800 uppercase tracking-wider">{monthName}</span>
             <button onClick={() => changeMonth(1)} className="w-8 h-8 flex items-center justify-center text-slate-400 active:text-slate-900 active:bg-slate-200/50 rounded-xl transition-all"><ChevronRight className="w-4 h-4" /></button>
          </div>

          {/* Main Stats Card with Green/Teal Premium Style */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 rounded-[1.75rem] p-4 shadow-xl shadow-emerald-950/20 text-white relative overflow-hidden group w-full">
             <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full -mr-6 -mt-6 blur-xl group-hover:scale-110 transition-transform duration-700 pointer-events-none" />
             
             <div className="flex items-start justify-between mb-3 min-w-0">
                <div className="min-w-0 flex-1">
                   <p className="text-[8px] font-bold text-emerald-400 uppercase tracking-[0.25em] mb-1 truncate">Umumiy Balans</p>
                   <h2 className="text-xl font-black tracking-tight leading-none flex items-baseline truncate">
                      {formatCurrency(profit).replace("so'm", "").trim()}
                      <span className="text-[10px] font-black text-emerald-400 ml-1.5 uppercase shrink-0">UZS</span>
                   </h2>
                </div>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ml-2 ${profit >= 0 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}`}>
                   {profit >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                </div>
             </div>
  
             {/* Income and Expense widgets */}
             <div className="grid grid-cols-2 gap-2.5 relative z-10 border-t border-white/10 pt-3 w-full">
                <div className="bg-white/5 border border-white/10 rounded-xl p-2 flex items-center gap-2 min-w-0">
                   <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400 shrink-0">
                      <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
                   </div>
                   <div className="min-w-0 flex-1">
                      <p className="text-[7px] font-bold text-white/50 uppercase tracking-widest leading-none mb-0.5">Kirim</p>
                      <p className="text-[11px] font-black text-white truncate leading-none">{formatCurrency(totalIncome).replace("so'm", "")}</p>
                   </div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-2 flex items-center gap-2 min-w-0">
                   <div className="w-8 h-8 rounded-lg bg-rose-500/15 flex items-center justify-center text-rose-400 shrink-0">
                      <ArrowDownRight className="w-3.5 h-3.5 stroke-[2.5]" />
                   </div>
                   <div className="min-w-0 flex-1">
                      <p className="text-[7px] font-bold text-white/50 uppercase tracking-widest leading-none mb-0.5">Chiqim</p>
                      <p className="text-[11px] font-black text-rose-300 truncate leading-none">{formatCurrency(totalExpense).replace("so'm", "")}</p>
                   </div>
                </div>
             </div>
  
             {/* Spend meter progress */}
             <div className="mt-3">
                <div className="flex justify-between items-center mb-1">
                   <p className="text-[7.5px] font-bold text-white/40 uppercase tracking-widest leading-none">Sarflash darajasi</p>
                   <p className="text-[7.5px] font-bold text-white/40 leading-none">{Math.round(balancePercent)}%</p>
                </div>
                <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                   <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${balancePercent}%` }}
                      className={`h-full rounded-full ${balancePercent > 80 ? 'bg-gradient-to-r from-rose-500 to-red-500' : 'bg-gradient-to-r from-emerald-400 to-teal-500'}`}
                   />
                </div>
             </div>
          </div>
        </div>

        {/* Search Strip */}
        <div className="px-4 -mt-4 relative z-30 w-full">
           <div className="bg-white rounded-2xl p-1.5 shadow-md border border-slate-100 flex gap-2 w-full">
              <div className="relative flex-1 min-w-0">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                 <input 
                   type="text" 
                   value={search}
                   onChange={e => setSearch(e.target.value)}
                   placeholder="Xarajatlarni izlash..."
                   className="w-full h-9 pl-9 pr-3 bg-slate-50 border-none rounded-xl text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:ring-0 outline-none"
                 />
              </div>
              <button className="w-9 h-9 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center text-slate-400 active:bg-slate-100 transition-colors border-none cursor-pointer shrink-0">
                 <Filter className="w-4 h-4" />
              </button>
           </div>
        </div>

        {/* Categories Analysis horizontal analytics scroll bar */}
        <div className="px-4 mt-5 w-full overflow-hidden">
            <div className="flex items-center justify-between mb-2.5 px-1">
              <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Kategoriyalar tahlili</h3>
              <button 
                type="button"
                onClick={openAddCategory}
                className="text-[9px] font-black text-[#1499AD] uppercase tracking-wider flex items-center gap-1 hover:underline active:scale-95 transition-all"
              >
                <Plus className="w-3 h-3" /> Bo'lim qo'shish
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 px-0.5 scroll-smooth w-full">
               {EXPENSE_CATEGORIES.map(cat => {
                  const totalSpent = categoryTotals[cat.value] || 0;
                  const IconComp = cat.icon || MoreHorizontal;
                  return (
                    <div 
                      key={cat.id || cat.value} 
                      className="bg-white rounded-2xl p-2.5 border border-slate-100 shadow-sm min-w-[100px] flex flex-col items-center gap-1 text-center active:scale-95 transition-all shrink-0 relative group"
                    >
                       <div className="w-full flex items-center justify-between">
                         <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${cat.bg} ${cat.color} border ${cat.border}`}>
                            <IconComp className="w-3.5 h-3.5" />
                         </div>
                         <button
                           type="button"
                           onClick={(e) => {
                             e.stopPropagation();
                             openEditCategory(cat);
                           }}
                           className="w-6 h-6 rounded-md bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 active:scale-90 transition-all cursor-pointer"
                           title="Tahrirlash"
                         >
                           <Pencil className="w-3 h-3" />
                         </button>
                       </div>
                       <div className="min-w-0 w-full mt-1">
                          <span className="text-[8px] font-black uppercase text-slate-700 tracking-tighter block truncate leading-none" title={cat.label}>{cat.label}</span>
                          <span className={`text-[9px] font-black block mt-1 leading-none ${totalSpent > 0 ? 'text-rose-500 font-extrabold' : 'text-slate-400 font-bold'}`}>
                             {totalSpent > 0 ? formatCompactCurrency(totalSpent) : '0 UZS'}
                          </span>
                       </div>
                    </div>
                  );
               })}

               {/* + Yangi bo'lim qo'shish tugmasi */}
               <button
                 type="button"
                 onClick={openAddCategory}
                 className="bg-slate-50 border-2 border-dashed border-slate-200 hover:border-[#1499AD] rounded-2xl p-2.5 min-w-[90px] flex flex-col items-center justify-center gap-1 text-center shrink-0 active:scale-95 transition-all cursor-pointer group"
               >
                 <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400 group-hover:text-[#1499AD] group-hover:border-[#1499AD]">
                   <Plus className="w-3.5 h-3.5" />
                 </div>
                 <span className="text-[8px] font-black uppercase text-slate-500 group-hover:text-[#1499AD] tracking-tight">+ Bo'lim</span>
               </button>
            </div>
        </div>

        {/* Expenses List Timeline */}
        <div className="px-4 mt-3 w-full">
           <div className="flex items-center justify-between mb-2.5 px-1">
              <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                 <Activity className="w-3.5 h-3.5 text-slate-400" /> Barcha harakatlar
              </h3>
              <span className="px-2 py-0.5 bg-slate-200/60 rounded-full text-[8px] font-black text-slate-500 uppercase tracking-widest">
                 {filteredExpenses.length} ta
              </span>
           </div>
  
           <div className="space-y-2 w-full">
              {loading ? (
                [1,2,3].map(i => <div key={i} className="h-16 bg-white rounded-2xl animate-pulse shadow-sm border border-slate-50" />)
              ) : filteredExpenses.length === 0 ? (
                <div className="py-10 text-center bg-white rounded-[1.5rem] border border-slate-100 p-5 shadow-sm">
                   <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center mx-auto mb-2 border border-slate-100">
                      <FileText className="w-5 h-5 text-slate-350" />
                   </div>
                   <p className="text-xs font-bold text-slate-850 tracking-tight">Xarajatlar mavjud emas</p>
                   <p className="text-[8px] font-bold text-slate-400 mt-1.5 uppercase tracking-widest leading-none">Ushbu oyda xarajatlar kiritilmagan</p>
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                   {filteredExpenses.map((expense, index) => {
                      const cat = EXPENSE_CATEGORIES.find(c => c.value === expense.category) || EXPENSE_CATEGORIES[6];
                      const displayLabel = (expense.category === 'other' && expense.custom_category)
                        ? expense.custom_category
                        : (cat.label || expense.custom_category || expense.category);
                      
                      const dateObj = expense.date ? new Date(expense.date) : null;
                      const monthsUz = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'];
                      const formattedDateText = (dateObj && !isNaN(dateObj.getTime()))
                        ? `${dateObj.getDate()}-${monthsUz[dateObj.getMonth()]}, ${dateObj.getFullYear()}`
                        : (expense.date || '—');

                      return (
                         <motion.div
                           key={expense.id}
                           layout
                           initial={{ opacity: 0, y: 10 }}
                           animate={{ opacity: 1, y: 0 }}
                           exit={{ opacity: 0, scale: 0.95 }}
                           transition={{ delay: Math.min(index, 6) * 0.02 }}
                           className="bg-white rounded-xl p-2.5 shadow-sm border border-slate-100 flex items-center gap-2.5 active:scale-[0.98] transition-all group content-visibility-auto cursor-pointer hover:shadow-md w-full"
                           onClick={() => { setEditingExpense(expense); setForm(expense); setModalOpen(true); }}
                         >
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${cat.bg} ${cat.color} ${cat.border} border`}>
                               <cat.icon className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                               <div className="flex items-center justify-between mb-0.5">
                                  <h4 className="text-xs font-bold text-slate-800 truncate tracking-tight">
                                     {expense.description || displayLabel}
                                  </h4>
                                  <p className="text-xs font-black text-rose-500 tracking-tight whitespace-nowrap">
                                     -{formatCurrency(expense.amount || 0)}
                                  </p>
                               </div>
                               <div className="flex items-center gap-1.5 leading-none">
                                  <p className="text-[9px] font-bold text-slate-400">
                                     {formattedDateText}
                                  </p>
                                  <div className="w-0.5 h-0.5 rounded-full bg-slate-200" />
                                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{displayLabel}</p>
                                </div>
                            </div>
                         </motion.div>
                      );
                   })}
                </AnimatePresence>
              )}
           </div>
        </div>



        {/* Add / Edit Dialog Modal */}
         <Dialog open={modalOpen} onOpenChange={setModalOpen}>
            <DialogContent 
              className="w-[92vw] max-w-sm max-h-[85vh] p-0 border-none rounded-[2rem] bg-white outline-none overflow-hidden flex flex-col shadow-2xl !left-[50%] !top-[50%] !translate-x-[-50%] !translate-y-[-50%]"
              aria-describedby={undefined}
            >
               {/* Modal Header */}
               <div className="bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 px-5 py-4 flex items-center justify-between shrink-0 text-white rounded-t-[2rem]">
                 <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white backdrop-blur-sm shadow-sm">
                      <TrendingDown className="w-4.5 h-4.5 stroke-[2.5]" />
                    </div>
                    <div>
                      <DialogTitle className="text-[14px] font-black text-white uppercase tracking-tight leading-none">
                         {editingExpense ? 'Tahrirlash' : 'Yangi Xarajat'}
                      </DialogTitle>
                      <p className="text-[8px] font-bold text-white/70 uppercase tracking-widest mt-0.5">Xarajat ma'lumotlari</p>
                    </div>
                 </div>
                 <button 
                    onClick={() => setModalOpen(false)}
                    className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center backdrop-blur-sm transition-all active:scale-90 border-none cursor-pointer"
                 >
                    <X className="w-4 h-4" />
                 </button>
               </div>

               {/* Modal Input Fields Body */}
               <div className="flex-1 overflow-y-auto p-4 space-y-3.5 no-scrollbar">
                  <div>
                     <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">Kategoriya</Label>
                     <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                        <SelectTrigger className="h-10 rounded-xl bg-slate-50 border-none font-bold text-slate-800 text-xs focus:ring-2 focus:ring-emerald-500/10">
                           <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-none shadow-2xl">
                           {EXPENSE_CATEGORIES.map(c => {
                              const Icon = c.icon;
                              return (
                                 <SelectItem key={c.value} value={c.value} className="font-bold py-2 focus:bg-slate-50 text-xs">
                                    <div className="flex items-center gap-2">
                                       {Icon && <Icon className="w-3.5 h-3.5 text-slate-400" />}
                                       <span>{c.label}</span>
                                    </div>
                                 </SelectItem>
                              );
                           })}
                        </SelectContent>
                     </Select>
                  </div>

                  {form.category === 'other' && (
                    <div className="animate-in fade-in-50 duration-200">
                      <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">Kategoriya nomi</Label>
                      <Input 
                        value={form.custom_category || ''}
                        onChange={e => setForm({ ...form, custom_category: e.target.value })}
                        placeholder="Masalan: Ofis jihozlari, Kantselyariya..."
                        className="h-10 rounded-xl bg-slate-50 border-none font-bold text-slate-800 text-xs focus:ring-2 focus:ring-emerald-500/10"
                        autoFocus
                      />
                    </div>
                  )}
                  
                  <div>
                     <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">Summa (UZS)</Label>
                     <div className="relative">
                        <Input 
                          type="number"
                          value={form.amount}
                          onChange={e => setForm({ ...form, amount: Number(e.target.value) })}
                          className="h-10 rounded-xl bg-slate-50 border-none font-black text-slate-800 text-sm focus:ring-2 focus:ring-emerald-500/10"
                          placeholder="Masalan: 500,000"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-400">UZS</span>
                     </div>
                  </div>
  
                  <div>
                     <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">Sana</Label>
                     <Input 
                       type="date"
                       value={form.date}
                       onChange={e => setForm({ ...form, date: e.target.value })}
                       className="h-10 rounded-xl bg-slate-50 border-none font-bold text-slate-800 text-xs focus:ring-2 focus:ring-emerald-500/10"
                     />
                  </div>
  
                  <div>
                     <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">Tavsif</Label>
                     <textarea 
                       value={form.description}
                       onChange={e => setForm({ ...form, description: e.target.value })}
                       placeholder="Nima uchun xarajat qilindi?"
                       className="w-full bg-slate-50 border-none rounded-xl p-3 text-xs font-bold text-slate-800 placeholder:text-slate-350 min-h-[70px] resize-none outline-none focus:ring-2 focus:ring-emerald-500/10"
                     />
                  </div>
               </div>

               {/* Modal Actions Footer */}
               <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center gap-2 shrink-0 rounded-b-[2rem]">
                  {editingExpense && (
                     <button 
                        onClick={() => handleDelete(editingExpense.id)}
                        className="w-10 h-10 bg-rose-50 border border-rose-100 text-rose-500 rounded-xl flex items-center justify-center shrink-0 active:scale-95 active:bg-rose-100 transition-all cursor-pointer"
                        title="O'chirish"
                     >
                        <Trash2 className="w-4 h-4" />
                     </button>
                  )}
                  <Button variant="ghost" onClick={() => setModalOpen(false)} className="h-10 flex-1 rounded-xl font-bold uppercase text-[10px] tracking-wider text-slate-400 hover:bg-slate-100 px-4 border-none">
                     Bekor
                  </Button>
                  <Button 
                    onClick={handleSave} 
                    disabled={saving}
                    className="h-10 flex-[2] rounded-xl font-black uppercase text-xs tracking-wider border-none shadow-md bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white active:scale-95 transition-all"
                  >
                     {saving ? '...' : 'Saqlash'}
                  </Button>
               </div>
            </DialogContent>
         </Dialog>

         {/* Add / Edit Category Dialog Modal */}
         <Dialog open={catModalOpen} onOpenChange={setCatModalOpen}>
            <DialogContent 
              className="w-[92vw] max-w-sm max-h-[85vh] p-0 border-none rounded-[2rem] bg-white outline-none overflow-hidden flex flex-col shadow-2xl !left-[50%] !top-[50%] !translate-x-[-50%] !translate-y-[-50%]"
              aria-describedby={undefined}
            >
               <div className="bg-gradient-to-br from-[#1499AD] to-[#0E7A8A] px-5 py-4 flex items-center justify-between shrink-0 text-white rounded-t-[2rem]">
                 <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white backdrop-blur-sm shadow-sm">
                      <Pencil className="w-4.5 h-4.5 stroke-[2.5]" />
                    </div>
                    <div>
                      <DialogTitle className="text-[14px] font-black text-white uppercase tracking-tight leading-none">
                         {editingCat ? "Bo'limni tahrirlash" : "Yangi bo'lim"}
                      </DialogTitle>
                      <p className="text-[8px] font-bold text-white/70 uppercase tracking-widest mt-0.5">Xarajat bo'limi</p>
                    </div>
                 </div>
                 <button 
                    onClick={() => setCatModalOpen(false)}
                    className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center backdrop-blur-sm transition-all active:scale-90 border-none cursor-pointer"
                 >
                    <X className="w-4 h-4" />
                 </button>
               </div>

               <div className="flex-1 overflow-y-auto p-4 space-y-3.5 no-scrollbar">
                  <div>
                    <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">
                      Bo'lim nomi <span className="text-red-500">*</span>
                    </Label>
                    <Input 
                      value={catForm.label}
                      onChange={e => setCatForm({ ...catForm, label: e.target.value })}
                      placeholder="Masalan: Kantselyariya, Transport..."
                      className="h-10 rounded-xl bg-slate-50 border-none font-bold text-slate-800 text-xs focus:ring-2 focus:ring-[#1499AD]/20"
                      autoFocus
                    />
                  </div>

                  <div>
                    <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">
                      Ikonkani tanlang
                    </Label>
                    <div className="grid grid-cols-5 gap-2 max-h-36 overflow-y-auto p-1.5 bg-slate-50 rounded-xl">
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
                                : 'bg-white text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">
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
                            className={`${color.value} px-2 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center justify-between border ${
                              isSelected ? 'ring-2 ring-[#1499AD] shadow-sm' : 'border-transparent opacity-80'
                            }`}
                          >
                            <span className="truncate">{color.label}</span>
                            {isSelected && <Check className="w-3 h-3 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
               </div>

               <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center gap-2 shrink-0 rounded-b-[2rem]">
                  {editingCat && !editingCat.isSystem && (
                     <button 
                        type="button"
                        onClick={() => handleDeleteCategory(editingCat)}
                        className="w-10 h-10 bg-rose-50 border border-rose-100 text-rose-500 rounded-xl flex items-center justify-center shrink-0 active:scale-95 active:bg-rose-100 transition-all cursor-pointer"
                        title="O'chirish"
                     >
                        <Trash2 className="w-4 h-4" />
                     </button>
                  )}
                  <Button variant="ghost" onClick={() => setCatModalOpen(false)} className="h-10 flex-1 rounded-xl font-bold uppercase text-[10px] tracking-wider text-slate-400 hover:bg-slate-100 px-4 border-none">
                     Bekor
                  </Button>
                  <Button 
                    type="button"
                    onClick={handleSaveCategory}
                    className="h-10 flex-[2] rounded-xl font-black uppercase text-xs tracking-wider border-none shadow-md bg-[#1499AD] hover:bg-[#0E7A8A] text-white active:scale-95 transition-all"
                  >
                     Saqlash
                  </Button>
               </div>
            </DialogContent>
         </Dialog>
      </div>
    </PullToRefresh>
  );
}
