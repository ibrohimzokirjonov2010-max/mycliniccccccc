import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, Phone, Calendar, Plus, Search, Edit3, Trash2, CheckCircle2, XCircle, MessageCircle, Target,
  UserPlus, Star
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import PullToRefresh from '@/components/ui/PullToRefresh';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/**
 * Premium SaaS Mobile Leads
 * Modern lead management with conversion tracking
 */
export default function MobileLeadsV2() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    email: '',
    source: 'Website',
    status: 'New',
    notes: '',
    visit_date: ''
  });

  const loadLeads = useCallback(async () => {
    try {
      setLoading(true);
      const data = await base44.entities.Lead.list('-created_date', 100);
      setLeads(data);
    } catch (error) {
      console.error('Failed to load leads:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  // Filter leads
  const filteredLeads = leads.filter(lead => {
    const matchesSearch = lead.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         lead.phone?.includes(searchQuery) ||
                         lead.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || lead.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  // Status configurations
  const statusConfig = {
    'New': { 
      bg: 'bg-blue-50', 
      border: 'border-blue-200',
      text: 'text-blue-700',
      icon: Star,
      label: 'Yangi'
    },
    'Contacted': { 
      bg: 'bg-amber-50', 
      border: 'border-amber-200',
      text: 'text-amber-700',
      icon: MessageCircle,
      label: 'Aloqa'
    },
    'Qualified': { 
      bg: 'bg-purple-50', 
      border: 'border-purple-200',
      text: 'text-purple-700',
      icon: Target,
      label: 'Sifatli'
    },
    'Converted': { 
      bg: 'bg-emerald-50', 
      border: 'border-emerald-200',
      text: 'text-emerald-700',
      icon: CheckCircle2,
      label: 'Konvert'
    },
    'Lost': { 
      bg: 'bg-rose-50', 
      border: 'border-rose-200',
      text: 'text-rose-700',
      icon: XCircle,
      label: 'Yoqotildi'
    }
  };

  const getStatusStyle = (status) => statusConfig[status] || statusConfig['New'];

  // Source configurations
  const sourceConfig = {
    'Website': { icon: Target, color: 'from-blue-500 to-indigo-600' },
    'Instagram': { icon: MessageCircle, color: 'from-pink-500 to-rose-600' },
    'Telegram': { icon: MessageCircle, color: 'from-sky-500 to-blue-600' },
    'Facebook': { icon: MessageCircle, color: 'from-blue-600 to-indigo-700' },
    'Google': { icon: Target, color: 'from-emerald-500 to-teal-600' },
    'Referral': { icon: Users, color: 'from-violet-500 to-purple-600' },
    'Walk-in': { icon: UserPlus, color: 'from-amber-500 to-orange-600' },
    'Call': { icon: Phone, color: 'from-green-500 to-emerald-600' },
    'Other': { icon: Target, color: 'from-slate-500 to-gray-600' }
  };

  const getSourceStyle = (source) => sourceConfig[source] || sourceConfig['Other'];

  // Handle save
  const handleSave = async () => {
    if (!formData.full_name || !formData.phone) {
      alert('Ism va telefon raqamni kiriting');
      return;
    }

    setSaving(true);
    try {
      const leadData = {
        full_name: formData.full_name,
        phone: formData.phone,
        email: formData.email,
        source: formData.source,
        status: formData.status,
        notes: formData.notes,
        visit_date: formData.visit_date
      };

      if (editingLead) {
        await base44.entities.Lead.update(editingLead.id, leadData);
      } else {
        await base44.entities.Lead.create(leadData);
      }

      setShowAddModal(false);
      setEditingLead(null);
      resetForm();
      loadLeads();
    } catch (error) {
      console.error('Failed to save lead:', error);
      alert('Xatolik yuz berdi');
    } finally {
      setSaving(false);
    }
  };

  // Handle delete
  const handleDelete = async (id) => {
    if (!confirm('Leadni o\'chirishni xohlaysizmi?')) return;
    
    try {
      await base44.entities.Lead.delete(id);
      loadLeads();
    } catch (error) {
      console.error('Failed to delete lead:', error);
      alert('O\'chirishda xatolik');
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      full_name: '',
      phone: '',
      email: '',
      source: 'Website',
      status: 'New',
      notes: '',
      visit_date: ''
    });
  };

  // Edit lead
  const startEdit = (lead) => {
    setEditingLead(lead);
    setFormData({
      full_name: lead.full_name,
      phone: lead.phone,
      email: lead.email || '',
      source: lead.source || 'Website',
      status: lead.status || 'New',
      notes: lead.notes || '',
      visit_date: lead.visit_date || ''
    });
    setShowAddModal(true);
  };

  // Get initials
  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
  };

  // Avatar gradient
  const getAvatarGradient = (name) => {
    const gradients = [
      'from-violet-500 to-purple-600',
      'from-blue-500 to-indigo-600',
      'from-emerald-500 to-teal-600',
      'from-orange-500 to-red-500',
      'from-pink-500 to-rose-500',
      'from-cyan-500 to-blue-600'
    ];
    const index = name?.charCodeAt(0) % gradients.length || 0;
    return gradients[index];
  };

  // Lead Card
  const LeadCard = ({ lead, index }) => {
    const status = getStatusStyle(lead.status);
    const source = getSourceStyle(lead.source);
    const StatusIcon = status.icon;
    const SourceIcon = source.icon;
    
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05, duration: 0.3 }}
        className="bg-white rounded-2xl p-5 mb-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
      >
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${getAvatarGradient(lead.full_name)} flex items-center justify-center text-white font-semibold text-lg flex-shrink-0 shadow-lg`}>
            {getInitials(lead.full_name)}
          </div>
          
          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">{lead.full_name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-sm text-slate-500">{lead.phone}</span>
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex gap-1">
                <button 
                  onClick={() => startEdit(lead)}
                  className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <Edit3 className="w-4 h-4 text-slate-400" />
                </button>
                <button 
                  onClick={() => handleDelete(lead.id)}
                  className="p-2 hover:bg-rose-50 rounded-xl transition-colors"
                >
                  <Trash2 className="w-4 h-4 text-rose-400" />
                </button>
              </div>
            </div>
            
            {/* Source & Status */}
            <div className="flex items-center gap-3 mt-4">
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${status.bg} ${status.text}`}>
                <StatusIcon className="w-3.5 h-3.5" />
                <span className="text-xs font-semibold">{status.label}</span>
              </div>
              
              <div className="flex items-center gap-1.5 text-slate-500">
                <div className={`w-6 h-6 rounded-lg bg-gradient-to-br ${source.color} flex items-center justify-center`}>
                  <SourceIcon className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-xs font-medium">{lead.source}</span>
              </div>
            </div>
            
            {/* Visit Date */}
            {lead.visit_date && (
              <div className="flex items-center gap-2 mt-3 text-xs text-slate-400">
                <Calendar className="w-3.5 h-3.5" />
                <span>Tashrif: {lead.visit_date}</span>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  // Skeleton
  const SkeletonCard = () => (
    <div className="bg-white rounded-2xl p-5 mb-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-2xl bg-slate-200 animate-pulse flex-shrink-0" />
        <div className="flex-1 space-y-3">
          <div className="flex justify-between">
            <div className="w-40 h-5 bg-slate-200 rounded animate-pulse" />
            <div className="w-16 h-5 bg-slate-200 rounded animate-pulse" />
          </div>
          <div className="w-28 h-4 bg-slate-200 rounded animate-pulse" />
          <div className="flex gap-2">
            <div className="w-16 h-6 bg-slate-200 rounded-full animate-pulse" />
            <div className="w-20 h-6 bg-slate-200 rounded-full animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );

  // Stats
  const totalLeads = leads.length;
  const newLeads = leads.filter(l => l.status === 'New').length;
  const convertedLeads = leads.filter(l => l.status === 'Converted').length;
  const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;

  return (
    <PullToRefresh onRefresh={loadLeads}>
      <div className="min-h-screen bg-slate-50">
        {/* Premium Header */}
        <div className="bg-white border-b border-slate-100 sticky top-0 z-10">
          <div className="px-5 pt-5 pb-4">
            {/* Title Row */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Leadlar</h1>
                <p className="text-sm text-slate-500 mt-0.5">Potensial bemorlar</p>
              </div>
              
              {/* Primary CTA */}
              <Button 
                onClick={() => {
                  setEditingLead(null);
                  resetForm();
                  setShowAddModal(true);
                }}
                className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl px-5 h-11 shadow-lg shadow-slate-200"
              >
                <Plus className="w-5 h-5 mr-1.5" />
                Yangi
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-2 mb-5">
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-slate-900">{totalLeads}</p>
                <p className="text-[10px] font-medium text-slate-500 uppercase">Jami</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-blue-700">{newLeads}</p>
                <p className="text-[10px] font-medium text-blue-600 uppercase">Yangi</p>
              </div>
              <div className="bg-emerald-50 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-emerald-700">{convertedLeads}</p>
                <p className="text-[10px] font-medium text-emerald-600 uppercase">Konvert</p>
              </div>
              <div className="bg-purple-50 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-purple-700">{conversionRate}%</p>
                <p className="text-[10px] font-medium text-purple-600 uppercase">Konversiya</p>
              </div>
            </div>
            
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Ism, telefon yoki email bo'yicha qidirish..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-12 pl-12 pr-4 rounded-xl border-0 bg-slate-100 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:bg-white transition-all"
              />
            </div>
            
            {/* Filter Pills */}
            <div className="flex gap-2 mt-4 overflow-x-auto scrollbar-hide pb-1">
              {[
                { key: 'all', label: 'Barchasi' },
                { key: 'New', label: 'Yangi' },
                { key: 'Contacted', label: 'Aloqa' },
                { key: 'Qualified', label: 'Sifatli' },
                { key: 'Converted', label: 'Konvert' },
                { key: 'Lost', label: 'Yoqotildi' }
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

        {/* Leads List */}
        <div className="p-4">
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : filteredLeads.length > 0 ? (
            <AnimatePresence mode="popLayout">
              {filteredLeads.map((lead, index) => (
                <LeadCard key={lead.id} lead={lead} index={index} />
              ))}
            </AnimatePresence>
          ) : (
            <div className="text-center py-16">
              <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <Users className="w-10 h-10 text-slate-300" />
              </div>
              <p className="text-slate-600 font-semibold text-lg">Leadlar topilmadi</p>
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
                {editingLead ? 'Leadni tahrirlash' : 'Yangi lead'}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-5 py-4">
              {/* Name */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-700">Ism va familiya</Label>
                <Input
                  placeholder="To'liq ism"
                  value={formData.full_name}
                  onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                  className="h-12 rounded-xl border-slate-200"
                />
              </div>

              {/* Phone & Email */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-slate-700">Telefon</Label>
                  <Input
                    placeholder="+998 90 123 45 67"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="h-12 rounded-xl border-slate-200"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-slate-700">Email</Label>
                  <Input
                    type="email"
                    placeholder="email@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="h-12 rounded-xl border-slate-200"
                  />
                </div>
              </div>

              {/* Source & Status */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-slate-700">Manba</Label>
                  <Select 
                    value={formData.source} 
                    onValueChange={(v) => setFormData({...formData, source: v})}
                  >
                    <SelectTrigger className="h-12 rounded-xl border-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Website">Sayt</SelectItem>
                      <SelectItem value="Instagram">Instagram</SelectItem>
                      <SelectItem value="Telegram">Telegram</SelectItem>
                      <SelectItem value="Facebook">Facebook</SelectItem>
                      <SelectItem value="Google">Google</SelectItem>
                      <SelectItem value="Referral">Tavsiya</SelectItem>
                      <SelectItem value="Walk-in">Kirish</SelectItem>
                      <SelectItem value="Call">Qo'ng'iroq</SelectItem>
                      <SelectItem value="Other">Boshqa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-slate-700">Status</Label>
                  <Select 
                    value={formData.status} 
                    onValueChange={(v) => setFormData({...formData, status: v})}
                  >
                    <SelectTrigger className="h-12 rounded-xl border-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="New">Yangi</SelectItem>
                      <SelectItem value="Contacted">Aloqa</SelectItem>
                      <SelectItem value="Qualified">Sifatli</SelectItem>
                      <SelectItem value="Converted">Konvert</SelectItem>
                      <SelectItem value="Lost">Yoqotildi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Visit Date */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-700">Tashrif sanasi</Label>
                <Input
                  type="date"
                  value={formData.visit_date}
                  onChange={(e) => setFormData({...formData, visit_date: e.target.value})}
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
                    setEditingLead(null);
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
                  {saving ? 'Saqlanmoqda...' : (editingLead ? 'Yangilash' : 'Saqlash')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </PullToRefresh>
  );
}
