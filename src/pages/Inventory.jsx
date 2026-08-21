import { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Package, Edit2, Trash2, AlertTriangle, Boxes, AlertOctagon, CircleDollarSign, ArrowRight, X, Layers, ShoppingBag, BarChart3 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/i18n/LanguageContext';
import { useIsMobile } from '@/hooks/useIsMobile';
import EmptyState from '../components/ui/EmptyState';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency } from '@/lib/utils';

/**
 * Inventory Page - Premium Modernization
 * 
 * Features:
 * - Glassmorphism design system
 * - Real-time stock indicators
 * - Enhanced mobile card experience
 * - Smooth framer-motion transitions
 */
export default function Inventory() {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [form, setForm] = useState({ name: '', category: '', unit: '', quantity: 0, min_quantity: 5, price_per_unit: 0 });
  const [saving, setSaving] = useState(false);
  const isMobile = useIsMobile(1024);

  const load = async () => {
    try {
      setLoading(true);
      let data;
      if (debouncedSearch) {
        data = await base44.entities.Inventory.search(debouncedSearch, 200);
      } else {
        data = await base44.entities.Inventory.list('name', 200);
      }
      setItems(data || []);
    } catch (error) {
      console.error('Inventory load error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [debouncedSearch]);

  useEffect(() => {
    if (editItem) {
      setForm({ 
        name: editItem.name || '', 
        category: editItem.category || '', 
        unit: editItem.unit || '', 
        quantity: editItem.quantity || 0, 
        min_quantity: editItem.min_quantity || 5, 
        price_per_unit: editItem.price_per_unit || 0 
      });
    } else {
      setForm({ name: '', category: '', unit: '', quantity: 0, min_quantity: 5, price_per_unit: 0 });
    }
  }, [editItem, modalOpen]);

  const filtered = items;
  
  const lowStock = items.filter(i => (i.quantity || 0) <= (i.min_quantity || 0));
  
  const stats = useMemo(() => {
    return {
      totalItems: items.length,
      lowStockCount: lowStock.length,
      totalValue: items.reduce((sum, item) => sum + ((item.quantity || 0) * (item.price_per_unit || 0)), 0)
    };
  }, [items, lowStock]);

  const handleSave = async () => {
    if (!form.name) return;
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
    } catch (error) {
      console.error('Save error:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await base44.entities.Inventory.delete(deleteId);
      setDeleteId(null);
      load();
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  return (
    <div className="space-y-3 pb-3">
      {/* Premium Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3"
        >
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md text-white">
            <Package className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-lg font-[900] text-slate-900 tracking-tight leading-none">
                {t('inventory.title')}
            </h1>
            <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest opacity-80">
                    Sklad va materiallar
                </span>
                <span className="w-1 h-1 rounded-full bg-slate-200" />
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    {stats.totalItems} {t('common.records')}
                </span>
            </div>
          </div>
        </motion.div>
        
        <motion.button
          whileHover={{ scale: 1.02, y: -1 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => { setEditItem(null); setModalOpen(true); }}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-md transition-all border-none cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 text-blue-400" />
          {t('inventory.addNew')}
        </motion.button>
      </div>

      {/* Analytics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: t('inventory.stats.total'), value: stats.totalItems, color: 'from-blue-500 to-indigo-600', icon: Layers, isCurrency: false },
          { label: t('inventory.stats.lowStock'), value: stats.lowStockCount, color: 'from-amber-500 to-rose-600', icon: AlertOctagon, isCurrency: false },
          { label: t('inventory.stats.totalValue'), value: stats.totalValue, color: 'from-emerald-500 to-teal-600', icon: CircleDollarSign, isCurrency: true }
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="premium-card p-3 border border-slate-100/50 rounded-2xl relative overflow-hidden group flex items-center justify-between"
          >
            <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-br ${stat.color} opacity-[0.03] rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-125`} />
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center text-white shadow-sm`}>
                <stat.icon className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">{stat.label}</span>
                <div className="text-base font-[900] text-slate-900 tracking-tight mt-0.5">
                    {stat.isCurrency ? formatCurrency(stat.value).replace('so\'m', '') : stat.value}
                    {stat.isCurrency && <span className="text-[9px] ml-1 text-slate-400 font-bold">UZS</span>}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Status Warning Alert Bar */}
      {lowStock.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-panel p-3 px-5 border-l-4 border-rose-500 flex items-center justify-between gap-4 rounded-xl"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-7 h-7 bg-rose-50 rounded-lg flex items-center justify-center text-rose-500 shrink-0">
               <AlertOctagon className="w-4 h-4 animate-pulse" />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest leading-none mb-0.5">Stock Warning</p>
              <p className="text-xs font-bold text-slate-600 truncate">
                {lowStock.length} ta mahsulot zahirasi kam qolgan ({lowStock.map(i => i.name).slice(0, 4).join(', ')}...)
              </p>
            </div>
          </div>
          <button onClick={() => setSearch('')} className="px-4 h-8 bg-white rounded-lg border border-rose-100 text-[9px] font-black text-rose-500 uppercase tracking-widest hover:bg-rose-50 transition-all shrink-0 cursor-pointer">
             Ko'rish
          </button>
        </motion.div>
      )}

      {/* Premium Search & Filter */}
      <div className="glass-panel rounded-2xl p-2 flex flex-col sm:flex-row items-center gap-2">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 transition-colors" />
          <input 
            type="text" 
            placeholder={t('inventory.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-11 pl-11 pr-4 bg-slate-50/50 rounded-xl border-none font-bold text-slate-950 text-xs placeholder:text-slate-300 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
            <button className="h-11 px-5 bg-white border border-slate-100 rounded-xl flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:border-blue-500 transition-all group shrink-0 cursor-pointer">
                <BarChart3 className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-500" />
                Hisobot
            </button>
        </div>
      </div>

      {/* Main Content View */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-xl shadow-slate-200/40 relative">
          {loading && (
            <div className="absolute inset-x-0 top-0 h-0.5 bg-slate-100 overflow-hidden z-20">
              <motion.div 
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-600"
                animate={{ x: ['-100%', '100%'] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              />
            </div>
          )}

          {!isMobile ? (
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="py-3 px-6 text-left text-[9px] font-black text-blue-500 uppercase tracking-wider">{t('inventory.table.name')}</th>
                  <th className="py-3 px-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-wider">{t('inventory.table.category')}</th>
                  <th className="py-3 px-4 text-center text-[9px] font-black text-slate-400 uppercase tracking-wider">{t('inventory.table.quantityUnit')}</th>
                  <th className="py-3 px-4 text-center text-[9px] font-black text-slate-400 uppercase tracking-wider">{t('inventory.table.price')}</th>
                  <th className="py-3 px-6 w-24"></th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {filtered.map((item, idx) => {
                    const isLow = (item.quantity || 0) <= (item.min_quantity || 0);
                    return (
                      <motion.tr 
                        key={item.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.02 }}
                        className="group hover:bg-slate-50/40 transition-all border-b border-slate-100 last:border-none"
                      >
                        <td className="px-6 py-2.5">
                            <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shadow-sm transition-transform group-hover:scale-105 ${isLow ? 'bg-rose-50 text-rose-500' : 'bg-slate-100 text-slate-500'}`}>
                                    {item.name?.[0]?.toUpperCase() || 'M'}
                                </div>
                                <div>
                                    <h4 className="font-bold text-[11px] text-slate-900 uppercase tracking-tight">{item.name}</h4>
                                    {isLow && (
                                        <div className="flex items-center gap-1 mt-0.5">
                                            <div className="w-1 h-1 rounded-full bg-rose-500 animate-pulse" />
                                            <span className="text-[8px] font-black text-rose-400 uppercase tracking-widest">{t('inventory.table.lowStockBadge')}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </td>
                        <td className="px-4 py-2.5">
                            <span className="inline-flex h-6 items-center px-2.5 rounded-lg bg-slate-50 border border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                {item.category || '—'}
                            </span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                            <div className="bg-slate-50 rounded-xl px-2.5 py-1.5 inline-flex items-center justify-center border border-slate-100/50 min-w-[80px]">
                                <span className={`text-xs font-[900] tracking-tight ${isLow ? 'text-rose-500' : 'text-slate-800'}`}>
                                    {item.quantity}
                                </span>
                                <span className="text-[8px] font-black text-slate-400 ml-1.5 uppercase">{item.unit || 'dona'}</span>
                            </div>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                            <p className="text-xs font-[900] text-slate-700 tracking-tight">
                                {formatCurrency(item.price_per_unit || 0).replace('so\'m', '')}
                                <span className="text-[8px] ml-1 text-slate-400 font-bold uppercase">UZS</span>
                            </p>
                        </td>
                        <td className="px-6 py-2.5 text-right">
                           <div className="flex items-center justify-end gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => { setEditItem(item); setModalOpen(true); }} className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-blue-500 hover:border-blue-500 hover:bg-blue-50/30 flex items-center justify-center transition-all cursor-pointer">
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => setDeleteId(item.id)} className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-rose-500 hover:border-rose-500 hover:bg-rose-50/30 flex items-center justify-center transition-all cursor-pointer">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                           </div>
                        </td>
                      </motion.tr>
                    )
                  })}
                </AnimatePresence>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-16">
                        <EmptyState icon={Package} title="Mahsulotlar topilmadi" />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            /* Mobile View Cards */
            <div className="space-y-3 p-4 overflow-y-auto max-h-[1000px] no-scrollbar">
               {filtered.map((item, idx) => {
                 const isLow = (item.quantity || 0) <= (item.min_quantity || 0);
                 return (
                    <motion.div 
                      key={item.id}
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.03 }}
                      className="bg-slate-50/40 rounded-2xl p-4 border border-slate-100 active:scale-[0.99] transition-all"
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shadow-sm ${isLow ? 'bg-rose-500 text-white' : 'bg-white text-slate-900 border border-slate-100'}`}>
                                    {item.name?.[0]?.toUpperCase()}
                                </div>
                                <div>
                                    <h4 className="font-bold text-[11px] text-slate-900 uppercase tracking-tight">{item.name}</h4>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{item.category || '—'}</p>
                                </div>
                            </div>
                            <div className="flex gap-1.5">
                                <button onClick={() => { setEditItem(item); setModalOpen(true); }} className="w-7 h-7 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-blue-500 active:bg-blue-50 cursor-pointer">
                                    <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => setDeleteId(item.id)} className="w-7 h-7 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-rose-500 active:bg-rose-50 cursor-pointer">
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white rounded-xl p-3 border border-slate-100/50">
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('inventory.table.quantityUnit')}</p>
                                <p className={`text-sm font-black ${isLow ? 'text-rose-500' : 'text-slate-900'}`}>
                                    {item.quantity} <span className="text-[9px] text-slate-300 font-bold uppercase ml-1">{item.unit || 'dona'}</span>
                                </p>
                            </div>
                            <div className="bg-white rounded-xl p-3 border border-slate-100/50">
                                <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest mb-1">{t('inventory.table.price')}</p>
                                <p className="text-sm font-black text-emerald-600">
                                    {item.price_per_unit?.toLocaleString()} <span className="text-[9px] text-emerald-300 font-bold uppercase ml-1">UZS</span>
                                </p>
                            </div>
                        </div>
                    </motion.div>
                 )
               })}
            </div>
          )}
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={modalOpen} onOpenChange={() => { setModalOpen(false); setEditItem(null); }}>
          <DialogContent className="max-w-xl p-0 overflow-hidden rounded-3xl border-none shadow-2xl bg-white">
              {/* Premium Header */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 px-8 py-6 text-white relative">
                  <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/10 rounded-full -mr-24 -mt-24 blur-2xl" />
                  <div className="relative z-10 flex items-center justify-between">
                     <div>
                        <h2 className="text-xl font-[900] tracking-tighter uppercase mb-0.5">
                            {editItem ? 'Mahsulotni tahrirlash' : 'Yangi mahsulot'}
                        </h2>
                        <p className="text-[9px] font-black text-white/40 tracking-[0.2em] uppercase">Mahsulot tafsilotlarini kiriting</p>
                     </div>
                     <ShoppingBag className="w-8 h-8 text-blue-500/30" />
                  </div>
              </div>

              <div className="p-8 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                          <div className="space-y-1.5">
                            <Label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em] ml-4">Mahsulot nomi</Label>
                            <Input 
                                value={form.name} 
                                onChange={e => setForm({ ...form, name: e.target.value })} 
                                className="h-11 rounded-xl border-none bg-slate-50 px-5 font-bold text-slate-900 text-xs focus:ring-2 focus:ring-blue-500/10 transition-all placeholder:text-slate-300"
                                placeholder="Masalan: Lidokain 2%..."
                            />
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <Label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em] ml-4">Kategoriya</Label>
                                <Select 
                                  value={form.category} 
                                  onValueChange={v => setForm({ ...form, category: v })}
                                >
                                  <SelectTrigger className="h-11 rounded-xl border-none bg-slate-50 px-5 font-bold text-slate-900 text-xs shadow-none">
                                    <SelectValue placeholder="Tanlang..." />
                                  </SelectTrigger>
                                  <SelectContent className="rounded-xl border-none shadow-xl">
                                    <SelectItem value="Anesteziya" className="font-bold py-2 text-xs">Anesteziya</SelectItem>
                                    <SelectItem value="Plomba materiallari" className="font-bold py-2 text-xs">Plomba materiallari</SelectItem>
                                    <SelectItem value="Asboblar" className="font-bold py-2 text-xs">Asboblar</SelectItem>
                                    <SelectItem value="Bir martalik (Sarf)" className="font-bold py-2 text-xs">Bir martalik (Sarf)</SelectItem>
                                    <SelectItem value="Xirurgiya" className="font-bold py-2 text-xs">Xirurgiya</SelectItem>
                                    <SelectItem value="Ortodontiya" className="font-bold py-2 text-xs">Ortodontiya</SelectItem>
                                    <SelectItem value="Dezinseksiya" className="font-bold py-2 text-xs">Dezinseksiya</SelectItem>
                                    <SelectItem value="Boshqa" className="font-bold py-2 text-xs">Boshqa</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em] ml-4">Birlik</Label>
                                <Input 
                                    value={form.unit} 
                                    onChange={e => setForm({ ...form, unit: e.target.value })} 
                                    className="h-11 rounded-xl border-none bg-slate-50 px-5 font-bold text-slate-900 text-xs"
                                    placeholder="Dona, quti..."
                                />
                              </div>
                          </div>
                      </div>

                      <div className="space-y-4 bg-slate-50/50 p-6 rounded-2xl border border-slate-100/50">
                          <div className="space-y-1.5">
                            <Label className="text-[9px] font-black text-blue-500 uppercase tracking-[0.15em] ml-4 text-center block">Mavjud miqdor</Label>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={form.quantity === '' || form.quantity === 0 ? '' : String(form.quantity)}
                              onChange={e => { const r = e.target.value.replace(/\D/g,''); setForm({ ...form, quantity: r === '' ? 0 : Number(r) }); }}
                              onKeyDown={e => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault(); }}
                              onWheel={e => e.target.blur()}
                              className="w-full h-12 rounded-xl border-none bg-white px-5 font-[900] text-xl text-slate-900 text-center shadow-sm outline-none focus:ring-2 focus:ring-blue-100"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <Label className="text-[9px] font-black text-rose-500 uppercase tracking-[0.15em] text-center block">Min. Zaxira</Label>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={form.min_quantity === '' || form.min_quantity === 0 ? '' : String(form.min_quantity)}
                                  onChange={e => { const r = e.target.value.replace(/\D/g,''); setForm({ ...form, min_quantity: r === '' ? 0 : Number(r) }); }}
                                  onKeyDown={e => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault(); }}
                                  onWheel={e => e.target.blur()}
                                  className="w-full h-11 rounded-xl border-none bg-white px-3 font-bold text-rose-500 text-center shadow-sm outline-none focus:ring-2 focus:ring-rose-100"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-[9px] font-black text-emerald-500 uppercase tracking-[0.15em] text-center block">Narxi (dona)</Label>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={form.price_per_unit === '' || form.price_per_unit === 0 ? '' : Number(form.price_per_unit).toLocaleString('uz-UZ')}
                                  onChange={e => { const r = e.target.value.replace(/\s/g,'').replace(/,/g,'').replace(/\./g,'').replace(/'/g,''); setForm({ ...form, price_per_unit: r === '' ? 0 : Number(r) }); }}
                                  onKeyDown={e => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault(); }}
                                  onWheel={e => e.target.blur()}
                                  className="w-full h-11 rounded-xl border-none bg-white px-3 font-bold text-emerald-600 text-center shadow-sm outline-none focus:ring-2 focus:ring-emerald-100"
                                />
                              </div>
                          </div>
                      </div>
                  </div>
              </div>

              {/* Premium Footer */}
              <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                  <button 
                    onClick={() => { setModalOpen(false); setEditItem(null); }}
                    className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-all border-none bg-transparent cursor-pointer"
                  >
                    Bekor qilish
                  </button>
                  <Button 
                    onClick={handleSave} 
                    disabled={saving || !form.name} 
                    className="h-11 px-6 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black uppercase text-[10px] tracking-widest border-none transition-all active:scale-95 flex items-center gap-2 cursor-pointer shadow-md"
                  >
                    {saving ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <>
                          <Plus className="w-4 h-4 text-blue-400" />
                          Saqlash
                        </>
                    )}
                  </Button>
              </div>
          </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl p-0 overflow-hidden border-none shadow-2xl bg-white max-w-xs">
          <div className="bg-rose-500 p-8 flex items-center justify-center text-white">
             <motion.div
               animate={{ scale: [1, 1.05, 1] }}
               transition={{ duration: 2, repeat: Infinity }}
             >
                <Trash2 className="w-12 h-12" />
             </motion.div>
          </div>
          <div className="p-8 text-center">
            <AlertDialogTitle className="text-lg font-[900] text-slate-900 uppercase tracking-tighter mb-2">Uchirishni tasdiqlaysizmi?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs font-bold text-slate-500 leading-relaxed">
              Ushbu mahsulot o'chirilgandan so'ng uni qayta tiklab bo'lmaydi.
            </AlertDialogDescription>
            <div className="flex gap-3 mt-8">
                <AlertDialogCancel className="flex-1 h-11 rounded-xl border border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-widest m-0 cursor-pointer">Bekor qilish</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="flex-1 h-11 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold uppercase text-[10px] tracking-widest m-0 shadow-lg shadow-rose-500/10 cursor-pointer border-none">O'chirish</AlertDialogAction>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
