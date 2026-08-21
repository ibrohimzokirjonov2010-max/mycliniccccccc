import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Plus, TrendingDown, TrendingUp, DollarSign, Calendar, 
  Download, Filter, PieChart, Building2, Zap, ShoppingCart, 
  Car, Wrench, MoreHorizontal, Trash2, Edit2
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import EmptyState from '@/components/ui/EmptyState';
import { useTranslation } from '@/i18n/LanguageContext';

export default function Expenses() {
  const { t } = useTranslation();
  
  // Expense Categories with localized labels
  const EXPENSE_CATEGORIES = useMemo(() => [
    { value: 'salary', label: t('expenses.categories.salary'), icon: DollarSign, color: 'bg-emerald-100 text-emerald-700' },
    { value: 'materials', label: t('expenses.categories.materials'), icon: ShoppingCart, color: 'bg-blue-100 text-blue-700' },
    { value: 'lab', label: 'Laboratoriya', icon: Wrench, color: 'bg-purple-100 text-purple-700' },
    { value: 'rent', label: t('expenses.categories.rent'), icon: Building2, color: 'bg-indigo-100 text-indigo-700' },
    { value: 'utilities', label: t('expenses.categories.utilities'), icon: Zap, color: 'bg-amber-100 text-amber-700' },
    { value: 'marketing', label: 'Reklama/Marketing', icon: TrendingUp, color: 'bg-rose-100 text-rose-700' },
    { value: 'other', label: t('expenses.categories.other'), icon: MoreHorizontal, color: 'bg-slate-100 text-slate-700' },
  ], [t]);

  // Data states
  const [expenses, setExpenses] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filter states
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  
  // Form states
  const [form, setForm] = useState({
    category: 'other',
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
      if (searchQuery && !e.description?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [monthlyExpenses, selectedCategory, searchQuery]);

  // Calculate totals
  const totals = useMemo(() => {
    const totalExpense = monthlyExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalIncome = monthlyIncome.reduce((sum, p) => sum + (p.amount || 0), 0);
    const profit = totalIncome - totalExpense;
    
    // By category
    const byCategory = monthlyExpenses.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + (e.amount || 0);
      return acc;
    }, {});
    
    return { totalExpense, totalIncome, profit, byCategory };
  }, [monthlyExpenses, monthlyIncome]);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!form.amount || !form.date) return;
    
    setSaving(true);
    try {
      if (editingExpense) {
        await base44.entities.Expense.update(editingExpense.id, form);
      } else {
        await base44.entities.Expense.create(form);
      }
      setModalOpen(false);
      setEditingExpense(null);
      setForm({
        category: 'other',
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
      category: expense.category,
      amount: expense.amount,
      description: expense.description,
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
      const value = date.toISOString().slice(0, 7);
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="w-5 h-5" />
            {t('expenses.byCategory')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {EXPENSE_CATEGORIES.map(cat => {
              const amount = totals.byCategory[cat.value] || 0;
              const percentage = totals.totalExpense > 0 
                ? Math.round((amount / totals.totalExpense) * 100) 
                : 0;
              
              return (
                <div key={cat.value} className={`${cat.color} rounded-2xl p-4 transition-transform hover:scale-95 cursor-default`}>
                  <cat.icon className="w-5 h-5 mb-3" />
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 truncate">{cat.label}</p>
                  <p className="text-sm font-black mt-0.5">{formatCurrency(amount).replace(' so\'m', '')}</p>
                  {percentage > 0 && (
                    <div className="mt-2 h-1 bg-black/5 rounded-full overflow-hidden">
                      <div className="h-full bg-current opacity-30" style={{ width: `${percentage}%` }} />
                    </div>
                  )}
                </div>
              );
            })}
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
          <SelectTrigger className="w-40">
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
      <Card>
        <CardHeader>
          <CardTitle>{t('expenses.list')}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          ) : filteredExpenses.length === 0 ? (
            <EmptyState 
              icon={TrendingDown}
              title={t('common.noData')}
              description={t('common.noData')}
            />
          ) : (
            <div className="space-y-3">
              {filteredExpenses.map(expense => {
                const category = EXPENSE_CATEGORIES.find(c => c.value === expense.category);
                return (
                  <div 
                    key={expense.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-slate-100 rounded-[1.5rem] hover:bg-slate-50 transition-colors gap-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${category?.color || 'bg-gray-100'}`}>
                        {category ? <category.icon className="w-6 h-6" /> : <MoreHorizontal className="w-6 h-6" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-slate-900 truncate">{expense.description || category?.label}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{formatDate(expense.date)}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-3 sm:pt-0">
                      <div className="flex flex-col items-end">
                        <p className="text-lg font-black text-rose-600">-{formatCurrency(expense.amount)}</p>
                        <Badge variant="secondary" className="text-[9px] font-bold uppercase tracking-widest mt-0.5">{category?.label}</Badge>
                      </div>
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-9 w-9 rounded-xl bg-slate-50 text-slate-400 hover:text-blue-600"
                          onClick={() => openEdit(expense)}
                          title={t('common.edit')}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-9 w-9 rounded-xl bg-slate-50 text-slate-400 hover:text-rose-600"
                          onClick={() => handleDelete(expense.id)}
                          title={t('common.delete')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Modal */}
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
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
