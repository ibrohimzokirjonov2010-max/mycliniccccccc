import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, Phone, Plus, Search,
  Edit3, Trash2, CheckCircle2, XCircle, MessageCircle, Target, Star, Globe, Instagram, Send,
  Facebook, MapPin, PhoneCall, MoreHorizontal
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import PullToRefresh from '@/components/ui/PullToRefresh';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/**
 * Modern Mobile Leads V3
 * Clean design with precise icons and better UX
 */
export default function MobileLeadsV3() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [saving, setSaving] = useState(false);
  
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

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = lead.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         lead.phone?.includes(searchQuery);
    const matchesStatus = filterStatus === 'all' || lead.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  // Status configs with exact colors
  const statusConfig = {
    'New': { 
      bg: 'bg-blue-50', 
      border: 'border-blue-200',
      text: 'text-blue-600',
      icon: Star,
      label: 'Yangi'
    },
    'Contacted': { 
      bg: 'bg-amber-50', 
      border: 'border-amber-200',
      text: 'text-amber-600',
      icon: MessageCircle,
      label: 'Aloqa'
    },
    'Qualified': { 
      bg: 'bg-purple-50', 
      border: 'border-purple-200',
      text: 'text-purple-600',
      icon: Target,
      label: 'Sifatli'
    },
    'Converted': { 
      bg: 'bg-emerald-50', 
      border: 'border-emerald-200',
      text: 'text-emerald-600',
      icon: CheckCircle2,
      label: 'Konvert'
    },
    'Lost': { 
      bg: 'bg-rose-50', 
      border: 'border-rose-200',
      text: 'text-rose-600',
      icon: XCircle,
      label: 'Yoqotildi'
    }
  };

  const getStatusStyle = (status) => statusConfig[status] || statusConfig['New'];

  // Source configs with exact brand colors
  const sourceConfig = {
    'Website': { 
      icon: Globe, 
      bg: 'bg-blue-500',
      label: 'Website'
    },
    'Instagram': { 
      icon: Instagram, 
      bg: 'bg-pink-500',
      label: 'Instagram'
    },
    'Telegram': { 
      icon: Send, 
      bg: 'bg-sky-500',
      label: 'Telegram'
    },
    'Facebook': { 
      icon: Facebook, 
      bg: 'bg-blue-600',
      label: 'Facebook'
    },
    'Google': { 
      icon: Globe, 
      bg: 'bg-emerald-500',
      label: 'Google'
    },
    'Referral': { 
      icon: Users, 
      bg: 'bg-violet-500',
      label: 'Tavsiya'
    },
    'Walk-in': { 
      icon: MapPin, 
      bg: 'bg-amber-500',
      label: 'Kirish'
    },
    'Call': { 
      icon: PhoneCall, 
      bg: 'bg-green-500',
      label: 'Qo\'ng\'iroq'
    },
    'Other': { 
      icon: MoreHorizontal, 
      bg: 'bg-slate-500',
      label: 'Boshqa'
    }
  };

  const getSourceStyle = (source) => sourceConfig[source] || sourceConfig['Other'];

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

  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
  };

  // Lead Card - New Design
  const LeadCard = ({ lead, index }) => {
    const status = getStatusStyle(lead.status);
    const source = getSourceStyle(lead.source);
    const StatusIcon = status.icon;
    const SourceIcon = source.icon;
    
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05, duration: 0.25 }}
        className="bg-white rounded-2xl p-4 mb-3 shadow-sm border border-slate-100"
      >
        <div className="flex items-start gap-3">
          {/* Avatar with gradient */}
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
            {getInitials(lead.full_name)}
          </div>
          
          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {/* Phone Row */}
            <div className="flex items-center gap-2 mb-3">
              <Phone className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-medium text-slate-700">{lead.phone}</span>
            </div>
            
            {/* Badges Row */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Status Badge */}
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${status.bg} ${status.text} border ${status.border}`}>
                <StatusIcon className="w-3.5 h-3.5" />
                {status.label}
              </span>
              
              {/* Source Badge */}
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-50 text-slate-600 border border-slate-200">
                <span className={`w-4 h-4 ${source.bg} rounded-full flex items-center justify-center`}>
                  <SourceIcon className="w-2.5 h-2.5 text-white" />
                </span>
                {source.label}
              </span>
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex items-center gap-1">
            <button 
              onClick={() => startEdit(lead)}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Edit3 className="w-4 h-4 text-slate-400" />
            </button>
            <button 
              onClick={() => handleDelete(lead.id)}
              className="p-2 hover:bg-rose-50 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4 text-rose-400" />
            </button>
          </div>
        </div>
      </motion.div>
    );
  };

  // Skeleton
  const SkeletonCard = () => (
    <div className="bg-white rounded-2xl p-4 mb-3 shadow-sm border border-slate-100">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl bg-slate-200 animate-pulse flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="w-32 h-4 bg-slate-200 rounded animate-pulse" />
          <div className="flex gap-2">
            <div className="w-16 h-6 bg-slate-200 rounded-lg animate-pulse" />
            <div className="w-20 h-6 bg-slate-200 rounded-lg animate-pulse" />
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
        {/* Header */}
        <div className="bg-white border-b border-slate-100 sticky top-0 z-10">
          <div className="px-4 pt-4 pb-3">
            {/* Title & Button */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-xl font-bold text-slate-900">Leadlar</h1>
                <p className="text-xs text-slate-500 mt-0.5">Potensial bemorlar</p>
              </div>
              
              <Button 
                onClick={() => {
                  setEditingLead(null);
                  resetForm();
                  setShowAddModal(true);
                }}
                className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl px-4 h-10 text-sm"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Yangi
              </Button>
            </div>

            {/* Compact Stats */}
            <div className="flex gap-2 mb-4">
              <div className="flex-1 bg-slate-50 rounded-xl py-2 px-3 text-center">
                <p className="text-lg font-bold text-slate-900">{totalLeads}</p>
                <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Jami</p>
              </div>
              <div className="flex-1 bg-blue-50 rounded-xl py-2 px-3 text-center">
                <p className="text-lg font-bold text-blue-600">{newLeads}</p>
                <p className="text-[10px] font-medium text-blue-500 uppercase tracking-wide">Yangi</p>
              </div>
              <div className="flex-1 bg-emerald-50 rounded-xl py-2 px-3 text-center">
                <p className="text-lg font-bold text-emerald-600">{convertedLeads}</p>
                <p className="text-[10px] font-medium text-emerald-500 uppercase tracking-wide">Konvert</p>
              </div>
              <div className="flex-1 bg-purple-50 rounded-xl py-2 px-3 text-center">
                <p className="text-lg font-bold text-purple-600">{conversionRate}%</p>
                <p className="text-[10px] font-medium text-purple-500 uppercase tracking-wide">Konversiya</p>
              </div>
            </div>
            
            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Ism, telefon yoki email bo'yicha qidirish..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-9 pr-4 rounded-xl border-0 bg-slate-100 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:bg-white transition-all"
              />
            </div>
            
            {/* Filter Pills */}
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
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
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                    filterStatus === filter.key
                      ? 'bg-slate-900 text-white'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Leads List */}
        <div className="p-3">
          {loading ? (
            <>
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
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-slate-600 font-medium">Leadlar topilmadi</p>
              <p className="text-xs text-slate-400 mt-1">Boshqa so'z bilan qidirib ko'ring</p>
            </div>
          )}
        </div>

        {/* Bottom spacing */}
        <div className="h-6" />

        {/* Add/Edit Modal */}
        <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
          <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">
                {editingLead ? 'Leadni tahrirlash' : 'Yangi lead'}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              {/* Name */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Ism va familiya</Label>
                <Input
                  placeholder="To'liq ism"
                  value={formData.full_name}
                  onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                  className="h-10 rounded-lg border-slate-200 text-sm"
                />
              </div>

              {/* Phone */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Telefon</Label>
                <Input
                  placeholder="+998 90 123 45 67"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className="h-10 rounded-lg border-slate-200 text-sm"
                />
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Email</Label>
                <Input
                  type="email"
                  placeholder="email@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="h-10 rounded-lg border-slate-200 text-sm"
                />
              </div>

              {/* Source & Status */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Manba</Label>
                  <Select 
                    value={formData.source} 
                    onValueChange={(v) => setFormData({...formData, source: v})}
                  >
                    <SelectTrigger className="h-10 rounded-lg border-slate-200 text-sm">
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
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Status</Label>
                  <Select 
                    value={formData.status} 
                    onValueChange={(v) => setFormData({...formData, status: v})}
                  >
                    <SelectTrigger className="h-10 rounded-lg border-slate-200 text-sm">
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
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Tashrif sanasi</Label>
                <Input
                  type="date"
                  value={formData.visit_date}
                  onChange={(e) => setFormData({...formData, visit_date: e.target.value})}
                  className="h-10 rounded-lg border-slate-200 text-sm"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Izoh</Label>
                <Input
                  placeholder="Qo'shimcha ma'lumot..."
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  className="h-10 rounded-lg border-slate-200 text-sm"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingLead(null);
                    resetForm();
                  }}
                  className="flex-1 h-10 rounded-lg border-slate-200 text-sm"
                >
                  Bekor
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 h-10 rounded-lg bg-slate-900 hover:bg-slate-800 text-sm"
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
