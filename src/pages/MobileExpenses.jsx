import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TrendingDown, TrendingUp, DollarSign, Plus, Search, 
  Calendar, MoreHorizontal, ShoppingCart, Car, Wrench, 
  Zap, Building2, ChevronRight, Activity, ArrowLeft,
  Filter, FileText, Wallet, ArrowUpRight, ArrowDownRight,
  ChevronLeft
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import PullToRefresh from '@/components/ui/PullToRefresh';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import toast from 'react-hot-toast';
import { useTranslation } from '@/i18n/LanguageContext';

const EXPENSE_CATEGORIES = [
  { value: 'rent', label: 'Arenda', icon: Building2, color: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-100' },
  { value: 'utilities', label: 'Kommunal', icon: Zap, color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-100' },
  { value: 'materials', label: 'Materiallar', icon: ShoppingCart, color: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-100' },
  { value: 'transport', label: 'Transport', icon: Car, color: 'text-purple-500', bg: 'bg-purple-50', border: 'border-purple-100' },
  { value: 'equipment', label: 'Uskunalar', icon: Wrench, color: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-100' },
  { value: 'salary', label: 'Ish haqi', icon: DollarSign, color: 'text-rose-500', bg: 'bg-rose-50', border: 'border-rose-100' },
  { value: 'other', label: 'Boshqa', icon: MoreHorizontal, color: 'text-slate-500', bg: 'bg-slate-50', border: 'border-slate-100' },
];

export default function MobileExpenses() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [expenses, setExpenses] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    category: 'other',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    receipt_url: ''
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [exps, pays] = await Promise.all([
        base44.entities.Expense?.list('-date', 100) || Promise.resolve([]),  // ⚡
        base44.entities.Payment.filter({ type: 'income' }, '-date', 100)     // ⚡
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

  const handleSave = async () => {
    if (!form.amount || !form.date) return;
    setSaving(true);
    try {
      if (editingExpense) {
        await base44.entities.Expense.update(editingExpense.id, form);
        toast.success("Xarajat tahrirlandi!");
      } else {
        await base44.entities.Expense.create(form);
        toast.success("Xarajat muvaffaqiyatli qo'shildi!");
      }
      setModalOpen(false);
      setEditingExpense(null);
      await loadData();
    } catch (error) {
      toast.error('Xatolik yuz berdi');
    } finally {
      setSaving(false);
    }
  };

  const changeMonth = (offset) => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const date = new Date(y, m - 1 + offset, 1);
    setSelectedMonth(date.toISOString().slice(0, 7));
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
      <div className="min-h-screen bg-slate-50/30 pb-28">
        {/* Modern Header */}
        <div className="bg-white px-4 pt-4 pb-4 rounded-b-3xl shadow-lg shadow-slate-200/30 relative z-20">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/')} className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 active:scale-90 transition-transform">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-[1000] text-slate-900 tracking-tighter leading-none mb-1">Xarajatlar</h1>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest opacity-60">Moliyaviy Nazorat</p>
              </div>
            </div>
            <button 
              onClick={() => { setEditingExpense(null); setModalOpen(true); }}
              className="w-11 h-11 bg-slate-900 text-white rounded-xl flex items-center justify-center shadow-lg shadow-slate-900/20 active:scale-90 transition-transform"
            >
              <Plus className="w-6 h-6" />
            </button>
          </div>
 
          {/* Month Selector */}
          <div className="flex items-center justify-between bg-slate-50 rounded-xl p-1.5 mb-4 border border-slate-100/50">
             <button onClick={() => changeMonth(-1)} className="p-1.5 text-slate-400 active:text-slate-900"><ChevronLeft className="w-5 h-5" /></button>
             <span className="text-xs font-black text-slate-900 uppercase tracking-tighter">{monthName}</span>
             <button onClick={() => changeMonth(1)} className="p-1.5 text-slate-400 active:text-slate-900"><ChevronRight className="w-5 h-5" /></button>
          </div>

          {/* Main Stats Card */}
          <div className="bg-slate-950 rounded-2xl p-4.5 shadow-xl shadow-slate-900/20 text-white relative overflow-hidden group">
             <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-12 -mt-12 blur-xl group-hover:scale-110 transition-transform duration-700" />
             <div className="flex items-start justify-between mb-4">
                <div>
                   <p className="text-[9px] font-black text-white/50 uppercase tracking-[0.2em] mb-1">Umumiy Balans</p>
                   <h2 className="text-2xl font-[1000] tracking-tighter">
                      {formatCurrency(profit).replace("so'm", "").trim()}
                      <span className="text-xs font-bold text-white/40 ml-0.5">UZS</span>
                   </h2>
                </div>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${profit >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                   {profit >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                </div>
             </div>
 
             <div className="grid grid-cols-2 gap-4 relative z-10">
                <div className="space-y-0.5">
                   <div className="flex items-center gap-1 opacity-60">
                      <ArrowUpRight className="w-3 h-3 text-emerald-400" />
                      <p className="text-[8px] font-black uppercase tracking-widest">Kirim</p>
                   </div>
                   <p className="text-base font-black tracking-tight">{formatCurrency(totalIncome).replace("so'm", "")}</p>
                </div>
                <div className="space-y-0.5">
                   <div className="flex items-center gap-1 opacity-60">
                      <ArrowDownRight className="w-3 h-3 text-rose-400" />
                      <p className="text-[8px] font-black uppercase tracking-widest">Chiqim</p>
                   </div>
                   <p className="text-base font-black tracking-tight text-rose-200">{formatCurrency(totalExpense).replace("so'm", "")}</p>
                </div>
             </div>
 
             {/* Progress Bar */}
             <div className="mt-4">
                <div className="flex justify-between items-center mb-1.5">
                   <p className="text-[8px] font-black text-white/40 uppercase tracking-widest">Sarflash darajasi</p>
                   <p className="text-[8px] font-black text-white/40">{Math.round(balancePercent)}%</p>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                   <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${balancePercent}%` }}
                      className={`h-full rounded-full ${balancePercent > 80 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                   />
                </div>
             </div>
          </div>
        </div>

        {/* Search and Filters Strip */}
        <div className="px-4 -mt-5 relative z-30">
           <div className="bg-white rounded-2xl p-2 shadow-xl shadow-slate-200/50 flex gap-2 border border-slate-100/50">
              <div className="relative flex-1">
                 <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                 <input 
                   type="text" 
                   value={search}
                   onChange={e => setSearch(e.target.value)}
                   placeholder="Xarajatlarni izlash..."
                   className="w-full h-10 pl-10 pr-4 bg-slate-50 border-none rounded-xl text-xs font-black text-slate-900 placeholder:text-slate-400 placeholder:font-bold focus:ring-0 outline-none"
                 />
              </div>
              <button className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 active:bg-slate-100 transition-colors">
                 <Filter className="w-4.5 h-4.5" />
              </button>
           </div>
        </div>

        {/* Expenses Timeline */}
        <div className="px-4 mt-6">
           <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
                 <Activity className="w-4 h-4 text-slate-400" /> Barcha harakatlar
              </h3>
              <span className="px-2 py-0.5 bg-slate-100 rounded-full text-[9px] font-black text-slate-500 uppercase tracking-widest">
                 {filteredExpenses.length} ta
              </span>
           </div>
 
           <div className="space-y-3">
              {loading ? (
                [1,2,3,4].map(i => <div key={i} className="h-24 bg-white rounded-2xl animate-pulse shadow-sm" />)
              ) : filteredExpenses.length === 0 ? (
                <div className="py-16 text-center">
                   <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <FileText className="w-8 h-8 text-slate-300" />
                   </div>
                   <p className="text-lg font-black text-slate-900 tracking-tight">Xarajatlar mavjud emas</p>
                   <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">Ushbu oyda hali xarajatlar kiritilmagan</p>
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                   {filteredExpenses.map((expense, index) => {
                      const cat = EXPENSE_CATEGORIES.find(c => c.value === expense.category) || EXPENSE_CATEGORIES[6];
                      return (
                         <motion.div
                           key={expense.id}
                           layout
                           initial={{ opacity: 0, y: 15 }}
                           animate={{ opacity: 1, y: 0 }}
                           exit={{ opacity: 0, scale: 0.95 }}
                           transition={{ delay: index * 0.04 }}
                           className="bg-white rounded-2xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.02)] border border-slate-100 flex items-center gap-4 active:scale-[0.98] transition-all group"
                           onClick={() => { setEditingExpense(expense); setForm(expense); setModalOpen(true); }}
                         >
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-md ${cat.bg} ${cat.color} ${cat.border} border`}>
                               <cat.icon className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                               <div className="flex items-center justify-between mb-0.5">
                                  <h4 className="text-xs font-black text-slate-900 truncate tracking-tight group-active:text-slate-600">
                                     {expense.description || cat.label}
                                  </h4>
                                  <p className="text-sm font-[1000] text-rose-500 tracking-tighter">
                                     -{Math.round(expense.amount/1000)}K
                                  </p>
                               </div>
                               <div className="flex items-center gap-2">
                                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                     {formatDate(expense.date)}
                                  </p>
                                  <div className="w-1 h-1 rounded-full bg-slate-200" />
                                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{cat.label}</p>
                               </div>
                            </div>
                         </motion.div>
                       );
                    })}
                 </AnimatePresence>
              )}
           </div>
        </div>

        {/* Quick Categories Bar */}
        <div className="px-4 mt-8 mb-8">
            <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 ml-2">Kategoriyalar tahlili</h3>
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-3 px-1">
               {EXPENSE_CATEGORIES.map(cat => (
                 <div key={cat.value} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm min-w-[110px] flex flex-col items-center gap-2">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${cat.bg} ${cat.color} border ${cat.border}`}>
                       <cat.icon className="w-5 h-5" />
                    </div>
                    <span className="text-[9px] font-black uppercase text-slate-900 tracking-tighter">{cat.label}</span>
                 </div>
               ))}
            </div>
        </div>

        {/* Add Modal */}
         <Dialog open={modalOpen} onOpenChange={setModalOpen}>
            <DialogContent className="rounded-2xl p-5 border-none max-w-[94%] w-full max-h-[85vh] overflow-y-auto">
               <DialogHeader className="pr-10 text-left">
                  <DialogTitle className="text-lg font-black tracking-tight uppercase">
                     {editingExpense ? 'Tahrirlash' : 'Yangi Xarajat'}
                  </DialogTitle>
               </DialogHeader>
               <div className="space-y-3.5 mt-2">
                  <div className="space-y-1">
                     <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Kategoriya</Label>
                    <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                       <SelectTrigger className="h-11 rounded-xl bg-slate-50 border-none font-black text-slate-800 outline-none">
                          <SelectValue />
                       </SelectTrigger>
                       <SelectContent className="rounded-xl border-none shadow-2xl">
                          {EXPENSE_CATEGORIES.map(c => (
                             <SelectItem key={c.value} value={c.value} className="font-bold py-2.5">{c.label}</SelectItem>
                          ))}
                       </SelectContent>
                    </Select>
                 </div>
                 
                 <div className="space-y-1">
                     <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Summa (UZS)</Label>
                    <div className="relative">
                       <Input 
                         type="number"
                         value={form.amount}
                         onChange={e => setForm({ ...form, amount: Number(e.target.value) })}
                         className="h-11 rounded-xl bg-slate-50 border-none font-black text-slate-800 text-base"
                         placeholder="Masalan: 500,000"
                       />
                       <span className="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300">UZS</span>
                    </div>
                 </div>

                  <div className="space-y-1">
                     <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Sana</Label>
                    <Input 
                      type="date"
                      value={form.date}
                      onChange={e => setForm({ ...form, date: e.target.value })}
                      className="h-11 rounded-xl bg-slate-50 border-none font-black text-slate-800"
                    />
                 </div>

                  <div className="space-y-1">
                     <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Tavsif</Label>
                    <Input 
                      value={form.description}
                      onChange={e => setForm({ ...form, description: e.target.value })}
                      placeholder="Nima uchun xarajat qilindi?"
                      className="h-11 rounded-xl bg-slate-50 border-none font-black text-slate-800 placeholder:text-slate-300 text-xs"
                    />
                 </div>

                 <div className="flex gap-2 pt-3">
                    <Button variant="ghost" onClick={() => setModalOpen(false)} className="h-11 flex-1 rounded-xl font-black text-slate-400 uppercase tracking-widest text-[10px]">Bekor</Button>
                    <Button 
                      onClick={handleSave} 
                      disabled={saving}
                      className="h-11 flex-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-slate-900/10"
                    >
                       {saving ? 'SAQLANMOQDA...' : 'SAQLASH'}
                    </Button>
                 </div>
              </div>
           </DialogContent>
        </Dialog>
      </div>
    </PullToRefresh>
  );
}
