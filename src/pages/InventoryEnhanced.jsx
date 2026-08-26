/**
 * @fileoverview Enhanced Inventory Page - Advanced inventory management with alerts
 * @module pages/InventoryEnhanced
 * 
 * @description
 * Professional inventory management system with low stock alerts, automatic
 * reorder suggestions, supplier management, stock movements tracking, and
 * comprehensive reporting. Features barcode support, multi-location tracking,
 * and expiration date monitoring for dental materials.
 * 
 * @author Senior Developer
 * @version 2.0.0
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { formatDate, formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import {
  Package,
  AlertTriangle,
  Plus,
  Minus,
  History,
  Truck,
  BarChart3,
  Search,
  Filter,
  RefreshCw,
  Calendar,
  DollarSign,
  Archive,
  AlertCircle,
  CheckCircle,
  Download,
  Box,
  ArrowUpDown,
  Bell
} from 'lucide-react';

/**
 * @typedef {Object} InventoryItem
 * @property {string} id - Item ID
 * @property {string} name - Item name
 * @property {string} category - Item category
 * @property {string} [description] - Item description
 * @property {string} [barcode] - Barcode/SKU
 * @property {number} quantity - Current quantity
 * @property {number} minQuantity - Minimum stock level
 * @property {number} maxQuantity - Maximum stock level
 * @property {string} unit - Unit of measurement
 * @property {number} unitPrice - Price per unit
 * @property {string} [supplierId] - Supplier ID
 * @property {string} [location] - Storage location
 * @property {string} [expiryDate] - Expiration date
 * @property {string} [batchNumber] - Batch/lot number
 * @property {number} reorderPoint - Quantity to trigger reorder
 * @property {number} reorderQuantity - Suggested reorder amount
 * @property {string} status - Item status (active, discontinued)
 * @property {string} createdAt - Creation timestamp
 * @property {string} [updatedAt] - Last update timestamp
 */

/**
 * @typedef {Object} StockMovement
 * @property {string} id - Movement ID
 * @property {string} itemId - Related item ID
 * @property {string} itemName - Item name
 * @property {string} type - Movement type (in, out, adjustment)
 * @property {number} quantity - Quantity changed
 * @property {number} previousQuantity - Quantity before change
 * @property {number} newQuantity - Quantity after change
 * @property {string} reason - Reason for movement
 * @property {string} [reference] - Reference number
 * @property {string} [patientId] - Related patient (if applicable)
 * @property {string} [treatmentId] - Related treatment (if applicable)
 * @property {string} performedBy - User who performed the action
 * @property {string} createdAt - Movement timestamp
 */

/**
 * @typedef {Object} Supplier
 * @property {string} id - Supplier ID
 * @property {string} name - Supplier name
 * @property {string} [contactPerson] - Contact person name
 * @property {string} [phone] - Phone number
 * @property {string} [email] - Email address
 * @property {string} [address] - Physical address
 * @property {string} [website] - Website URL
 * @property {string} [notes] - Additional notes
 * @property {boolean} isActive - Supplier status
 */

/**
 * @typedef {Object} LowStockAlert
 * @property {string} id - Alert ID
 * @property {string} itemId - Related item ID
 * @property {string} itemName - Item name
 * @property {number} currentQuantity - Current stock level
 * @property {number} minQuantity - Minimum threshold
 * @property {number} reorderQuantity - Suggested reorder amount
 * @property {string} priority - Alert priority (high, medium, low)
 * @property {boolean} isAcknowledged - Whether alert has been acknowledged
 * @property {string} createdAt - Alert creation timestamp
 * @property {string} [acknowledgedAt] - Acknowledgment timestamp
 * @property {string} [acknowledgedBy] - User who acknowledged
 */

/** @type {string[]} */
const CATEGORIES = [
  'Tibbiy materiallar',
  'Instrumentlar',
  'Sarflanuvchi buyumlar',
  'Dorilar',
  'Protezlar',
  'Ortodontik materiallar',
  'Gigiena vositalari',
  'Boshqa'
];

/** @type {string[]} */
const UNITS = [
  'dona',
  'paket',
  'quti',
  'kg',
  'gramm',
  'litr',
  'ml',
  'metr',
  'sm',
  'blister',
  'ampula'
];

/**
 * Enhanced Inventory Page Component
 * @returns {JSX.Element}
 */
export default function InventoryEnhanced() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // State
  const [activeTab, setActiveTab] = useState('items');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedItem, setSelectedItem] = useState(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isMovementDialogOpen, setIsMovementDialogOpen] = useState(false);
  const [isSupplierDialogOpen, setIsSupplierDialogOpen] = useState(false);
  const [movementType, setMovementType] = useState('in');
  const [movementQuantity, setMovementQuantity] = useState('');
  const [movementReason, setMovementReason] = useState('');

  // Form state for new item
  const [newItem, setNewItem] = useState({
    name: '',
    category: '',
    description: '',
    barcode: '',
    quantity: 0,
    minQuantity: 10,
    maxQuantity: 100,
    unit: 'dona',
    unitPrice: 0,
    supplierId: '',
    location: '',
    expiryDate: '',
    batchNumber: '',
    reorderPoint: 15,
    reorderQuantity: 50
  });

  // Fetch inventory items
  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['inventoryItems'],
    queryFn: async () => {
      const response = await base44.get('/Inventory');
      return response.data || [];
    }
  });

  // Fetch stock movements
  const { data: movements = [], isLoading: movementsLoading } = useQuery({
    queryKey: ['stockMovements'],
    queryFn: async () => {
      const response = await base44.get('/StockMovement', {
        params: { sort: '-createdAt', limit: 100 }
      });
      return response.data || [];
    }
  });

  // Fetch suppliers
  const { data: suppliers = [], isLoading: suppliersLoading } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const response = await base44.get('/Supplier');
      return response.data || [];
    }
  });

  // Fetch low stock alerts
  const { data: alerts = [], isLoading: alertsLoading } = useQuery({
    queryKey: ['lowStockAlerts'],
    queryFn: async () => {
      const response = await base44.get('/LowStockAlert', {
        params: { isAcknowledged: false }
      });
      return response.data || [];
    }
  });

  // Create item mutation
  const createItem = useMutation({
    mutationFn: async (data) => {
      const response = await base44.post('/Inventory', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventoryItems'] });
      toast.success('Mahsulot qoshildi', { description: 'Yangi mahsulot muvaffaqiyatli qoshildi' });
      setIsAddDialogOpen(false);
      setNewItem({
        name: '', category: '', description: '', barcode: '', quantity: 0,
        minQuantity: 10, maxQuantity: 100, unit: 'dona', unitPrice: 0,
        supplierId: '', location: '', expiryDate: '', batchNumber: '',
        reorderPoint: 15, reorderQuantity: 50
      });
    },
    onError: (error) => {
      toast.error('Xatolik', { description: error.message });
    }
  });

  // Record stock movement mutation
  const recordMovement = useMutation({
    mutationFn: async (data) => {
      const response = await base44.post('/StockMovement', data);
      // Update item quantity
      await base44.patch(`/Inventory/${data.itemId}`, {
        quantity: data.newQuantity
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stockMovements'] });
      queryClient.invalidateQueries({ queryKey: ['inventoryItems'] });
      toast.success('Harakat qayd etildi', { description: 'Ombor harakati muvaffaqiyatli saqlandi' });
      setIsMovementDialogOpen(false);
      setMovementQuantity('');
      setMovementReason('');
    }
  });

  // Acknowledge alert mutation
  const acknowledgeAlert = useMutation({
    mutationFn: async (alertId) => {
      const response = await base44.patch(`/LowStockAlert/${alertId}`, {
        isAcknowledged: true,
        acknowledgedAt: new Date().toISOString(),
        acknowledgedBy: user?.id
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lowStockAlerts'] });
      toast.success('Bildirishnoma oqib olindi');
    }
  });

  /**
   * Handle new item form change
   * @param {string} field - Field name
   * @param {any} value - Field value
   */
  const handleNewItemChange = useCallback((field, value) => {
    setNewItem(prev => ({ ...prev, [field]: value }));
  }, []);

  /**
   * Handle create new item
   */
  const handleCreateItem = useCallback(() => {
    if (!newItem.name || !newItem.category) {
      toast.error('Xatolik', { description: 'Nomi va kategoriyani kiriting' });
      return;
    }
    createItem.mutate({ ...newItem, status: 'active' });
  }, [newItem, createItem]);

  /**
   * Handle stock movement recording
   */
  const handleRecordMovement = useCallback(() => {
    if (!selectedItem || !movementQuantity || !movementReason) return;

    const qty = parseInt(movementQuantity);
    const previousQty = selectedItem.quantity;
    let newQty = previousQty;

    if (movementType === 'in') {
      newQty = previousQty + qty;
    } else if (movementType === 'out') {
      newQty = previousQty - qty;
    } else if (movementType === 'adjustment') {
      newQty = qty;
    }

    recordMovement.mutate({
      itemId: selectedItem.id,
      itemName: selectedItem.name,
      type: movementType,
      quantity: qty,
      previousQuantity: previousQty,
      newQuantity: newQty,
      reason: movementReason,
      performedBy: user?.id,
      createdAt: new Date().toISOString()
    });
  }, [selectedItem, movementType, movementQuantity, movementReason, recordMovement, user]);

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.barcode?.includes(searchQuery);
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [items, searchQuery, categoryFilter, statusFilter]);

  // Stats calculation
  const stats = useMemo(() => {
    const totalValue = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const lowStockCount = items.filter(item => item.quantity <= item.minQuantity).length;
    const expiringSoon = items.filter(item => {
      if (!item.expiryDate) return false;
      const expiry = new Date(item.expiryDate);
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      return expiry <= thirtyDaysFromNow;
    }).length;

    return {
      totalItems: items.length,
      totalValue,
      lowStockCount,
      expiringSoon,
      categories: [...new Set(items.map(i => i.category))].length
    };
  }, [items]);

  // Get stock level color
  const getStockLevelColor = useCallback((quantity, minQty, maxQty) => {
    if (quantity <= minQty) return 'text-red-500';
    if (quantity <= minQty * 1.5) return 'text-yellow-500';
    return 'text-green-500';
  }, []);

  // Get stock progress value
  const getStockProgress = useCallback((quantity, maxQty) => {
    return Math.min((quantity / maxQty) * 100, 100);
  }, []);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Omborxona</h1>
          <p className="text-muted-foreground mt-1">
            Zaxiralarni boshqarish va nazorat
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => {}}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Yangi mahsulot
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Jami mahsulotlar</p>
                <p className="text-2xl font-bold">{stats.totalItems}</p>
              </div>
              <Package className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ombor qiymati</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.totalValue)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Kam zaxira</p>
                <p className="text-2xl font-bold text-red-500">{stats.lowStockCount}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Muddati yaqin</p>
                <p className="text-2xl font-bold text-orange-500">{stats.expiringSoon}</p>
              </div>
              <Calendar className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Kategoriyalar</p>
                <p className="text-2xl font-bold">{stats.categories}</p>
              </div>
              <Archive className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts Banner */}
      {alerts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="w-5 h-5 text-red-500" />
            <h3 className="font-medium text-red-900">Kam zaxira bildirishnomalari</h3>
            <Badge variant="destructive">{alerts.length}</Badge>
          </div>
          <div className="space-y-2">
            {alerts.slice(0, 3).map(alert => (
              <div key={alert.id} className="flex items-center justify-between bg-white p-3 rounded border">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  <span className="font-medium">{alert.itemName}</span>
                  <span className="text-sm text-gray-500">
                    Qoldiq: {alert.currentQuantity} (min: {alert.minQuantity})
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const item = items.find(i => i.id === alert.itemId);
                      setSelectedItem(item);
                      setIsMovementDialogOpen(true);
                    }}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Qoshish
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => acknowledgeAlert.mutate(alert.id)}
                  >
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Oqib olindi
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="items">
            <Package className="w-4 h-4 mr-2" />
            Mahsulotlar
          </TabsTrigger>
          <TabsTrigger value="movements">
            <History className="w-4 h-4 mr-2" />
            Harakatlar
          </TabsTrigger>
          <TabsTrigger value="suppliers">
            <Truck className="w-4 h-4 mr-2" />
            Yetkazib beruvchilar
          </TabsTrigger>
          <TabsTrigger value="reports">
            <BarChart3 className="w-4 h-4 mr-2" />
            Hisobotlar
          </TabsTrigger>
        </TabsList>

        {/* Items Tab */}
        <TabsContent value="items" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Mahsulot nomi yoki barcode..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-48">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Barcha kategoriyalar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Barcha kategoriyalar</SelectItem>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Items Grid */}
          <div className="grid gap-4">
            {filteredItems.map(item => (
              <Card key={item.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Box className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-medium">{item.name}</h3>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Badge variant="secondary">{item.category}</Badge>
                          {item.barcode && (
                            <span className="font-mono">{item.barcode}</span>
                          )}
                          {item.location && (
                            <span>📍 {item.location}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="w-32">
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className={getStockLevelColor(item.quantity, item.minQuantity, item.maxQuantity)}>
                            {item.quantity} {item.unit}
                          </span>
                        </div>
                        <Progress
                          value={getStockProgress(item.quantity, item.maxQuantity)}
                          className="h-2"
                        />
                        <p className="text-xs text-gray-400 mt-1">
                          Min: {item.minQuantity} | Max: {item.maxQuantity}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatCurrency(item.unitPrice)}</p>
                        <p className="text-sm text-gray-500">
                          Jami: {formatCurrency(item.quantity * item.unitPrice)}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedItem(item);
                            setMovementType('in');
                            setIsMovementDialogOpen(true);
                          }}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedItem(item);
                            setMovementType('out');
                            setIsMovementDialogOpen(true);
                          }}
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredItems.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <Package className="w-12 h-12 mx-auto mb-4" />
                <p>Mahsulotlar topilmadi</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Movements Tab */}
        <TabsContent value="movements" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ombor harakatlari</CardTitle>
              <CardDescription>So'nggi 100 ta harakat</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {movements.map(movement => (
                  <div
                    key={movement.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        movement.type === 'in' ? 'bg-green-100' :
                        movement.type === 'out' ? 'bg-red-100' : 'bg-yellow-100'
                      }`}>
                        {movement.type === 'in' ? <Plus className="w-5 h-5 text-green-600" /> :
                         movement.type === 'out' ? <Minus className="w-5 h-5 text-red-600" /> :
                         <ArrowUpDown className="w-5 h-5 text-yellow-600" />}
                      </div>
                      <div>
                        <p className="font-medium">{movement.itemName}</p>
                        <p className="text-sm text-gray-500">{movement.reason}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-medium ${
                        movement.type === 'in' ? 'text-green-600' :
                        movement.type === 'out' ? 'text-red-600' : 'text-yellow-600'
                      }`}>
                        {movement.type === 'in' ? '+' : movement.type === 'out' ? '-' : ''}
                        {movement.quantity}
                      </p>
                      <p className="text-xs text-gray-400">
                        {movement.previousQuantity} → {movement.newQuantity}
                      </p>
                      <p className="text-xs text-gray-400">{formatDate(movement.createdAt)}</p>
                    </div>
                  </div>
                ))}
                {movements.length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    <History className="w-12 h-12 mx-auto mb-4" />
                    <p>Hali harakatlar yo'q</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Suppliers Tab */}
        <TabsContent value="suppliers" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setIsSupplierDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Yangi yetkazib beruvchi
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {suppliers.map(supplier => (
              <Card key={supplier.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium">{supplier.name}</h3>
                      <p className="text-sm text-gray-500">{supplier.contactPerson}</p>
                    </div>
                    <Badge variant={supplier.isActive ? 'default' : 'secondary'}>
                      {supplier.isActive ? 'Faol' : 'Nofaol'}
                    </Badge>
                  </div>
                  <Separator className="my-3" />
                  <div className="space-y-1 text-sm">
                    {supplier.phone && <p>📞 {supplier.phone}</p>}
                    {supplier.email && <p>✉️ {supplier.email}</p>}
                    {supplier.address && <p>📍 {supplier.address}</p>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Kategoriya bo'yicha taqsimot</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {CATEGORIES.map(cat => {
                    const catItems = items.filter(i => i.category === cat);
                    const catValue = catItems.reduce((sum, i) => sum + (i.quantity * i.unitPrice), 0);
                    if (catItems.length === 0) return null;
                    return (
                      <div key={cat} className="flex items-center justify-between">
                        <span>{cat}</span>
                        <div className="text-right">
                          <p className="font-medium">{catItems.length} ta</p>
                          <p className="text-sm text-gray-500">{formatCurrency(catValue)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top sarflanuvchi buyumlar</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {movements
                    .filter(m => m.type === 'out')
                    .reduce((acc, m) => {
                      acc[m.itemName] = (acc[m.itemName] || 0) + m.quantity;
                      return acc;
                    }, {})
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([name, qty]) => (
                      <div key={name} className="flex items-center justify-between">
                        <span>{name}</span>
                        <Badge>{qty} ta</Badge>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Item Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Yangi mahsulot</DialogTitle>
            <DialogDescription>Omborga yangi mahsulot qoshish</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Nomi *</Label>
              <Input
                value={newItem.name}
                onChange={(e) => handleNewItemChange('name', e.target.value)}
                placeholder="Mahsulot nomi"
              />
            </div>
            <div>
              <Label>Kategoriya *</Label>
              <Select
                value={newItem.category}
                onValueChange={(value) => handleNewItemChange('category', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tanlang" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Barcode/SKU</Label>
              <Input
                value={newItem.barcode}
                onChange={(e) => handleNewItemChange('barcode', e.target.value)}
                placeholder="123456789"
              />
            </div>
            <div>
              <Label>Boshlangich miqdor</Label>
              <Input
                type="number"
                value={newItem.quantity}
                onChange={(e) => handleNewItemChange('quantity', parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label>Birlik</Label>
              <Select
                value={newItem.unit}
                onValueChange={(value) => handleNewItemChange('unit', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map(u => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Narxi (birlik uchun)</Label>
              <Input
                type="number"
                value={newItem.unitPrice}
                onChange={(e) => handleNewItemChange('unitPrice', parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label>Minimum miqdor</Label>
              <Input
                type="number"
                value={newItem.minQuantity}
                onChange={(e) => handleNewItemChange('minQuantity', parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label>Maximum miqdor</Label>
              <Input
                type="number"
                value={newItem.maxQuantity}
                onChange={(e) => handleNewItemChange('maxQuantity', parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label>Qayta buyurtma nuqtasi</Label>
              <Input
                type="number"
                value={newItem.reorderPoint}
                onChange={(e) => handleNewItemChange('reorderPoint', parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label>Qayta buyurtma miqdori</Label>
              <Input
                type="number"
                value={newItem.reorderQuantity}
                onChange={(e) => handleNewItemChange('reorderQuantity', parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label>Joylashuv</Label>
              <Input
                value={newItem.location}
                onChange={(e) => handleNewItemChange('location', e.target.value)}
                placeholder="Shkaf A, polka 3"
              />
            </div>
            <div>
              <Label>Muddati</Label>
              <Input
                type="date"
                value={newItem.expiryDate}
                onChange={(e) => handleNewItemChange('expiryDate', e.target.value)}
              />
            </div>
            <div className="col-span-2">
              <Label>Tavsif</Label>
              <Input
                value={newItem.description}
                onChange={(e) => handleNewItemChange('description', e.target.value)}
                placeholder="Qoshimcha ma'lumot"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={handleCreateItem} disabled={createItem.isPending} className="flex-1">
              {createItem.isPending ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Qoshish
            </Button>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Bekor qilish</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Movement Dialog */}
      <Dialog open={isMovementDialogOpen} onOpenChange={setIsMovementDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ombor harakati</DialogTitle>
            <DialogDescription>{selectedItem?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Harakat turi</Label>
              <Select value={movementType} onValueChange={setMovementType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">Kirim (Qoshish)</SelectItem>
                  <SelectItem value="out">Chiqim (Ayirish)</SelectItem>
                  <SelectItem value="adjustment">Tuzatish</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Miqdor</Label>
              <Input
                type="number"
                value={movementQuantity}
                onChange={(e) => setMovementQuantity(e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <Label>Sabab</Label>
              <Input
                value={movementReason}
                onChange={(e) => setMovementReason(e.target.value)}
                placeholder="Masalan: Yangi yetkazib berish"
              />
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <p className="text-sm text-gray-600">Joriy qoldiq: <strong>{selectedItem?.quantity} {selectedItem?.unit}</strong></p>
              {movementQuantity && (
                <p className="text-sm text-gray-600">
                  Yangi qoldiq: <strong>
                    {movementType === 'in' ? selectedItem?.quantity + parseInt(movementQuantity) :
                     movementType === 'out' ? selectedItem?.quantity - parseInt(movementQuantity) :
                     parseInt(movementQuantity)} {selectedItem?.unit}
                  </strong>
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={handleRecordMovement} disabled={!movementQuantity || !movementReason || recordMovement.isPending} className="flex-1">
              {recordMovement.isPending ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Saqlash
            </Button>
            <Button variant="outline" onClick={() => setIsMovementDialogOpen(false)}>Bekor qilish</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
