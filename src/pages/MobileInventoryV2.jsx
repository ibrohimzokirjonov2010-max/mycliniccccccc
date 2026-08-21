import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Package, AlertTriangle, Plus, Search, Edit3, Trash2, Archive, TrendingDown, Boxes,
  ShoppingCart, ArrowUpRight
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import PullToRefresh from '@/components/ui/PullToRefresh';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/**
 * Premium SaaS Mobile Inventory
 * Modern inventory management with low stock alerts
 */
export default function MobileInventoryV2() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    category: 'Materials',
    quantity: '',
    min_quantity: '10',
    unit: 'pcs',
    price: '',
    supplier: '',
    location: '',
    notes: ''
  });

  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      const data = await base44.entities.Inventory.list('name', 100);
      setItems(data);
    } catch (error) {
      console.error('Failed to load inventory:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // Filter items
  const filteredItems = items.filter(item => {
    const matchesSearch = item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.category?.toLowerCase().includes(searchQuery.toLowerCase());
    const isLowStock = item.quantity <= (item.min_quantity || 10);
    
    if (filterStatus === 'all') return matchesSearch;
    if (filterStatus === 'low') return matchesSearch && isLowStock;
    if (filterStatus === 'ok') return matchesSearch && !isLowStock;
    return matchesSearch;
  });

  // Get low stock items
  const lowStockItems = items.filter(item => item.quantity <= (item.min_quantity || 10));

  // Category configurations
  const categoryConfig = {
    'Materials': { icon: Package, color: 'from-blue-500 to-indigo-600', bg: 'bg-blue-50', text: 'text-blue-700' },
    'Instruments': { icon: ShoppingCart, color: 'from-violet-500 to-purple-600', bg: 'bg-violet-50', text: 'text-violet-700' },
    'Medications': { icon: Archive, color: 'from-emerald-500 to-teal-600', bg: 'bg-emerald-50', text: 'text-emerald-700' },
    'Equipment': { icon: Boxes, color: 'from-amber-500 to-orange-600', bg: 'bg-amber-50', text: 'text-amber-700' },
    'Consumables': { icon: TrendingDown, color: 'from-rose-500 to-pink-600', bg: 'bg-rose-50', text: 'text-rose-700' }
  };

  const getCategoryStyle = (cat) => categoryConfig[cat] || categoryConfig['Materials'];

  // Handle save
  const handleSave = async () => {
    if (!formData.name) {
      alert('Material nomini kiriting');
      return;
    }

    setSaving(true);
    try {
      const itemData = {
        name: formData.name,
        category: formData.category,
        quantity: Number(formData.quantity) || 0,
        min_quantity: Number(formData.min_quantity) || 10,
        unit: formData.unit,
        price: Number(formData.price) || 0,
        supplier: formData.supplier,
        location: formData.location,
        notes: formData.notes
      };

      if (editingItem) {
        await base44.entities.Inventory.update(editingItem.id, itemData);
      } else {
        await base44.entities.Inventory.create(itemData);
      }

      setShowAddModal(false);
      setEditingItem(null);
      resetForm();
      loadItems();
    } catch (error) {
      console.error('Failed to save item:', error);
      alert('Xatolik yuz berdi');
    } finally {
      setSaving(false);
    }
  };

  // Handle delete
  const handleDelete = async (id) => {
    if (!confirm('Materialni o\'chirishni xohlaysizmi?')) return;
    
    try {
      await base44.entities.Inventory.delete(id);
      loadItems();
    } catch (error) {
      console.error('Failed to delete item:', error);
      alert('O\'chirishda xatolik');
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      category: 'Materials',
      quantity: '',
      min_quantity: '10',
      unit: 'pcs',
      price: '',
      supplier: '',
      location: '',
      notes: ''
    });
  };

  // Edit item
  const startEdit = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      category: item.category || 'Materials',
      quantity: item.quantity?.toString() || '0',
      min_quantity: item.min_quantity?.toString() || '10',
      unit: item.unit || 'pcs',
      price: item.price?.toString() || '',
      supplier: item.supplier || '',
      location: item.location || '',
      notes: item.notes || ''
    });
    setShowAddModal(true);
  };

  // Inventory Card - iOS Style
  const InventoryCard = ({ item, index }) => {
    const isLowStock = item.quantity <= (item.min_quantity || 10);
    const style = getCategoryStyle(item.category);
    const CategoryIcon = style.icon;
    
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: index * 0.05 }}
        onClick={() => startEdit(item)}
        className="px-5 py-4 flex items-center gap-4 active:bg-slate-50 transition-colors border-b border-slate-100 last:border-0 relative"
      >
        {/* Left: Icon Avatar */}
        <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${style.color} flex items-center justify-center text-white shrink-0 shadow-sm`}>
          <CategoryIcon className="w-5 h-5" />
        </div>

        {/* Middle: Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-[17px] text-slate-900 truncate leading-tight">
              {item.name}
            </h3>
            {isLowStock && (
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
            )}
          </div>
          <p className="text-[13px] text-slate-500 font-medium mt-0.5">{item.category}</p>
        </div>

        {/* Right: Stock & Info Icon */}
        <div className="flex items-center gap-3">
          <div className="text-right">
             <p className={`text-[15px] font-bold ${isLowStock ? 'text-rose-500' : 'text-slate-900'}`}>
               {item.quantity} {item.unit}
             </p>
             <p className="text-[11px] font-bold text-slate-400 mt-0.5">{item.price ? `${item.price.toLocaleString()} so'm` : 'Narxsiz'}</p>
          </div>
          <div className="w-8 h-8 rounded-full border border-blue-500 flex items-center justify-center text-blue-500 shrink-0">
            <span className="font-serif italic text-sm font-bold">i</span>
          </div>
        </div>
      </motion.div>
    );
  };

  // Skeleton - iOS Style
  const SkeletonCard = () => (
    <div className="px-5 py-4 flex items-center gap-4 border-b border-slate-50 last:border-0">
      <div className="w-12 h-12 rounded-full bg-slate-100 animate-pulse shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="w-1/2 h-5 bg-slate-100 rounded animate-pulse" />
        <div className="w-1/3 h-4 bg-slate-100 rounded animate-pulse" />
      </div>
      <div className="w-8 h-8 rounded-full bg-slate-100 animate-pulse shrink-0" />
    </div>
  );

  // Stats
  const totalItems = items.length;
  const totalValue = items.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 0)), 0);

  return (
    <PullToRefresh onRefresh={loadItems}>
      <div className="min-h-screen bg-slate-50">
        {/* Premium Header */}
        <div className="bg-white border-b border-slate-100 sticky top-0 z-10">
          <div className="px-5 pt-5 pb-4">
            {/* Title Row */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Ombor</h1>
                <p className="text-sm text-slate-500 mt-0.5">Materiallar boshqaruvi</p>
              </div>
              
              {/* Primary CTA */}
              <Button 
                onClick={() => {
                  setEditingItem(null);
                  resetForm();
                  setShowAddModal(true);
                }}
                className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl px-5 h-11 shadow-lg shadow-slate-200"
              >
                <Plus className="w-5 h-5 mr-1.5" />
                Yangi
              </Button>
            </div>

            {/* Enhanced Stats */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm text-center">
                <p className="text-2xl font-bold text-slate-900">{totalItems}</p>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Jami</p>
              </div>
              <div className={`rounded-2xl p-4 text-center border ${lowStockItems.length > 0 ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50 border-emerald-100'}`}>
                <p className={`text-2xl font-bold ${lowStockItems.length > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                  {lowStockItems.length}
                </p>
                <p className={`text-xs font-medium uppercase tracking-wide ${lowStockItems.length > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  Kam qolgan
                </p>
              </div>
              <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100 text-center">
                <p className="text-lg font-bold text-blue-700">{totalValue.toLocaleString()}</p>
                <p className="text-xs font-medium text-blue-600 uppercase tracking-wide">Qiymati</p>
              </div>
            </div>

            {/* Enhanced Low Stock Alert */}
            {lowStockItems.length > 0 && (
              <div className="bg-gradient-to-r from-rose-50 to-red-50 border border-rose-200 rounded-2xl p-4 mb-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-5 h-5 text-rose-600" />
                  </div>
                  <div>
                    <p className="font-bold text-rose-800">Kam qolgan materiallar ({lowStockItems.length})</p>
                    <p className="text-sm text-rose-600 mt-1">
                      {lowStockItems.slice(0, 3).map(i => i.name).join(', ')}
                      {lowStockItems.length > 3 && ` va ${lowStockItems.length - 3} ta boshqa`}
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Material nomi bo'yicha qidirish..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-12 pl-12 pr-4 rounded-xl border-0 bg-slate-100 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:bg-white transition-all"
              />
            </div>
            
            {/* Filter Pills */}
            <div className="flex gap-2 mt-4 overflow-x-auto scrollbar-hide pb-1">
              {[
                { key: 'all', label: 'Barchasi' },
                { key: 'low', label: 'Kam qolgan' },
                { key: 'ok', label: 'Yetarli' }
              ].map((filter) => (
                <button
                  key={filter.key}
                  onClick={() => setFilterStatus(filter.key)}
                  className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
                    filterStatus === filter.key
                      ? 'bg-slate-900 text-white shadow-md'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Items List */}
        <div className="bg-white mx-4 rounded-[2rem] overflow-hidden border border-slate-100 shadow-sm min-h-[200px]">
          {loading ? (
             <>
               <SkeletonCard />
               <SkeletonCard />
               <SkeletonCard />
               <SkeletonCard />
             </>
          ) : filteredItems.length > 0 ? (
            <AnimatePresence mode="popLayout">
              {filteredItems.map((item, index) => (
                <InventoryCard key={item.id} item={item} index={index} />
              ))}
            </AnimatePresence>
          ) : (
            <div className="text-center py-16 bg-slate-50/50">
              <div className="w-20 h-20 bg-white rounded-[2rem] flex items-center justify-center mx-auto mb-5 shadow-sm">
                <Package className="w-10 h-10 text-slate-300" />
              </div>
              <p className="text-slate-600 font-semibold text-lg">Materiallar topilmadi</p>
              <p className="text-sm text-slate-400 mt-1">Boshqa so'z bilan qidirib ko'ring</p>
            </div>
          )}
        </div>

        {/* Bottom spacing */}
        <div className="h-8" />

        {/* Add/Edit Modal */}
        <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
          <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">
                {editingItem ? 'Materialni tahrirlash' : 'Yangi material'}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-5 py-4">
              {/* Name */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-700">Nomi</Label>
                <Input
                  placeholder="Material nomi"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="h-12 rounded-xl border-slate-200"
                />
              </div>

              {/* Category */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-700">Kategoriya</Label>
                <Select 
                  value={formData.category} 
                  onValueChange={(v) => setFormData({...formData, category: v})}
                >
                  <SelectTrigger className="h-12 rounded-xl border-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Materials">Materiallar</SelectItem>
                    <SelectItem value="Instruments">Asbob-uskunalar</SelectItem>
                    <SelectItem value="Medications">Dori-darmonlar</SelectItem>
                    <SelectItem value="Equipment">Uskunalar</SelectItem>
                    <SelectItem value="Consumables">Sarflanuvchi</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Quantity & Unit */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-slate-700">Miqdori</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={formData.quantity}
                    onChange={(e) => setFormData({...formData, quantity: e.target.value})}
                    className="h-12 rounded-xl border-slate-200"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-slate-700">Birligi</Label>
                  <Select 
                    value={formData.unit} 
                    onValueChange={(v) => setFormData({...formData, unit: v})}
                  >
                    <SelectTrigger className="h-12 rounded-xl border-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pcs">dona</SelectItem>
                      <SelectItem value="pack">qop</SelectItem>
                      <SelectItem value="box">quti</SelectItem>
                      <SelectItem value="ml">ml</SelectItem>
                      <SelectItem value="g">g</SelectItem>
                      <SelectItem value="kg">kg</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Min Quantity & Price */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-slate-700">Min. miqdor</Label>
                  <Input
                    type="number"
                    placeholder="10"
                    value={formData.min_quantity}
                    onChange={(e) => setFormData({...formData, min_quantity: e.target.value})}
                    className="h-12 rounded-xl border-slate-200"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-slate-700">Narxi</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      placeholder="0"
                      value={formData.price}
                      onChange={(e) => setFormData({...formData, price: e.target.value})}
                      className="h-12 rounded-xl border-slate-200 pr-12"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">so'm</span>
                  </div>
                </div>
              </div>

              {/* Supplier & Location */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-700">Yetkazib beruvchi</Label>
                <Input
                  placeholder="Kompaniya nomi"
                  value={formData.supplier}
                  onChange={(e) => setFormData({...formData, supplier: e.target.value})}
                  className="h-12 rounded-xl border-slate-200"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-700">Joylashuv</Label>
                <Input
                  placeholder="Ombordagi joyi"
                  value={formData.location}
                  onChange={(e) => setFormData({...formData, location: e.target.value})}
                  className="h-12 rounded-xl border-slate-200"
                />
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-700">Izoh</Label>
                <Input
                  placeholder="Qo'shimcha ma'lumot..."
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  className="h-12 rounded-xl border-slate-200"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingItem(null);
                    resetForm();
                  }}
                  className="flex-1 h-12 rounded-xl border-slate-200"
                >
                  Bekor
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 h-12 rounded-xl bg-slate-900 hover:bg-slate-800"
                >
                  {saving ? 'Saqlanmoqda...' : (editingItem ? 'Yangilash' : 'Saqlash')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </PullToRefresh>
  );
}
