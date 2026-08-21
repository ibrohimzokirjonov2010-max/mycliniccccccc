import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, Phone, Plus, Search, 
  MoreVertical, Globe, Instagram, Send,
  MapPin, PhoneCall, Filter, MessageCircle,
  Calendar, CheckCircle2, XCircle, ArrowRight,
  MoreHorizontal
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/api/supabaseClient';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import PullToRefresh from '@/components/ui/PullToRefresh';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTranslation } from '@/i18n/LanguageContext';
import { format } from 'date-fns';
import { uz, enUS } from 'date-fns/locale';

/**
 * Ultra-Professional Lead Management V4 - Enhanced
 * Premium Design with High-End UX
 */
export default function MobileLeadsV4() {
  const { t, language } = useTranslation();
  const dateLocale = language === 'uz' ? uz : enUS;

  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    source: 'Website',
    status: 'new',
    notes: '',
    visit_date: ''
  });

  const loadLeads = useCallback(async () => {
    try {
      setLoading(true);
      const data = await base44.entities.Lead.list('-created_date', 200);
      setLeads(data || []);
    } catch (error) {
      console.error('Failed to load leads:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const clinicId = localStorage.getItem('current_clinic_id') || 'default_clinic';

  useEffect(() => {
    loadLeads();

    // Supabase Real-time: faqat shu klinikaning lidlarini ko'rsatish
    // 100+ klinikada xavfsizlik: boshqa klinikaning lidlari ko'rinmaydi
    const channel = supabase
      .channel(`leads_mobile_${clinicId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'leads',
        filter: `clinic_id=eq.${clinicId}`  // 🔒 Klinika izolyatsiyasi
      }, (payload) => {
        const newLead = payload.new;
        // Srazi ro'yxatning boshiga qo'shish
        setLeads((current) => [newLead, ...current]);
        
        // Chiroyli bildirishnoma chiqarish
        toast.success("🎉 Yangi Lead kelib tushdi!", {
          description: `${newLead.name || 'Yangi mijoz'} — Manba: ${newLead.source || 'Facebook/Instagram'}`,
          action: {
            label: "Ko'rish",
            onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' })
          },
          duration: 8000,
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadLeads, clinicId]);

  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      const name = (lead.name || lead.full_name || '').toLowerCase();
      const phone = (lead.phone || '').toLowerCase();
      const query = searchQuery.toLowerCase();
      const matchesSearch = name.includes(query) || phone.includes(query);
      
      const statusLower = (lead.status || '').toLowerCase();
      const matchesStatus = filterStatus === 'all' || statusLower === filterStatus.toLowerCase();
      
      return matchesSearch && matchesStatus;
    });
  }, [leads, searchQuery, filterStatus]);

  const statusConfig = {
    'new': { 
      bg: 'bg-blue-50/50', 
      text: 'text-blue-600', 
      dot: 'bg-blue-500', 
      icon: Plus,
      label: t('leads.status.new') 
    },
    'contacted': { 
      bg: 'bg-amber-50/50', 
      text: 'text-amber-600', 
      dot: 'bg-amber-500', 
      icon: MessageCircle,
      label: t('leads.status.contacted') 
    },
    'qualified': { 
      bg: 'bg-purple-50/50', 
      text: 'text-purple-600', 
      dot: 'bg-purple-500', 
      icon: Users,
      label: t('leads.status.qualified') 
    },
    'converted': { 
      bg: 'bg-emerald-50/50', 
      text: 'text-emerald-600', 
      dot: 'bg-emerald-500', 
      icon: CheckCircle2,
      label: t('leads.status.converted') 
    },
    'lost': { 
      bg: 'bg-rose-50/50', 
      text: 'text-rose-600', 
      dot: 'bg-rose-500', 
      icon: XCircle,
      label: t('leads.status.lost') 
    },
  };

  const getStatusStyle = (status) => statusConfig[(status || '').toLowerCase()] || statusConfig['new'];

  const sourceConfig = {
    'Website': { icon: Globe, color: 'text-slate-400', bg: 'bg-slate-50' },
    'Instagram': { icon: Instagram, color: 'text-pink-500', bg: 'bg-pink-50' },
    'Telegram': { icon: Send, color: 'text-sky-500', bg: 'bg-sky-50' },
    'Facebook': { icon: Globe, color: 'text-blue-600', bg: 'bg-blue-50' },
    'Google': { icon: Globe, color: 'text-emerald-500', bg: 'bg-emerald-50' },
    'Referral': { icon: Users, color: 'text-purple-500', bg: 'bg-purple-50' },
    'Walk-in': { icon: MapPin, color: 'text-orange-500', bg: 'bg-orange-50' },
    'Call': { icon: PhoneCall, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    'Other': { icon: MoreHorizontal, color: 'text-slate-400', bg: 'bg-slate-50' }
  };

  const getSourceIcon = (source) => sourceConfig[source]?.icon || Globe;
  const getSourceStyle = (source) => sourceConfig[source] || sourceConfig['Other'];

  const handleSave = async () => {
    if (!formData.name || !formData.phone) return;

    setSaving(true);
    try {
      const leadData = {
        name: formData.name,
        full_name: formData.name,
        phone: formData.phone,
        email: formData.email,
        source: formData.source,
        status: formData.status,
        notes: formData.notes,
        visit_date: formData.visit_date,
        created_date: editingLead ? editingLead.created_date : new Date().toISOString()
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
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm(t('common.confirmDelete'))) return;
    try {
      await base44.entities.Lead.delete(id);
      loadLeads();
    } catch (error) {
      console.error('Failed to delete lead:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      email: '',
      source: 'Website',
      status: 'new',
      notes: '',
      visit_date: ''
    });
  };

  const startEdit = (lead) => {
    setEditingLead(lead);
    setFormData({
      name: lead.name || lead.full_name || '',
      phone: lead.phone,
      email: lead.email || '',
      source: lead.source || 'Website',
      status: lead.status || 'new',
      notes: lead.notes || '',
      visit_date: lead.visit_date || ''
    });
    setShowAddModal(true);
  };

  const stats = useMemo(() => {
    const total = leads.length;
    const isNew = leads.filter(l => (l.status || '').toLowerCase() === 'new').length;
    const isConverted = leads.filter(l => (l.status || '').toLowerCase() === 'converted').length;
    const rate = total > 0 ? Math.round((isConverted / total) * 100) : 0;
    return { total, isNew, rate };
  }, [leads]);

  return (
    <PullToRefresh onRefresh={loadLeads}>
      <div className="min-h-screen bg-[#F8FAFC] pb-24">
        {/* Premium Sticky Header */}
        <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-sm">
          <div className="px-5 pt-6 pb-4">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tighter">{t('leads.title')}</h1>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{t('leads.subtitle')}</p>
              </div>
              <button 
                onClick={() => {
                  setEditingLead(null);
                  resetForm();
                  setShowAddModal(true);
                }}
                className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-xl shadow-slate-200 active:scale-95 transition-all"
              >
                <Plus className="w-6 h-6" />
              </button>
            </div>

            {/* Bento Stats Grid */}
            <div className="grid grid-cols-12 gap-3 mb-6">
              <div className="col-span-4 bg-white rounded-3xl p-4 border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
                <p className="text-2xl font-black text-slate-900 tracking-tighter">{stats.total}</p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{t('leads.stats.total')}</p>
              </div>
              <div className="col-span-4 bg-emerald-500 rounded-3xl p-4 shadow-lg shadow-emerald-100">
                <p className="text-2xl font-black text-white tracking-tighter">{stats.isNew}</p>
                <p className="text-[10px] font-black text-emerald-100/80 uppercase tracking-widest mt-1">{t('leads.stats.new')}</p>
              </div>
              <div className="col-span-4 bg-slate-900 rounded-3xl p-4 shadow-lg shadow-slate-200">
                <p className="text-2xl font-black text-white tracking-tighter">{stats.rate}%</p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{t('leads.stats.conversion')}</p>
              </div>
            </div>

            {/* Premium Search */}
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
              <input
                type="text"
                placeholder={t('leads.search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-12 pl-12 pr-4 rounded-2xl bg-slate-100/80 border-transparent focus:bg-white focus:ring-2 focus:ring-slate-900/5 transition-all text-sm font-bold placeholder:text-slate-400"
              />
            </div>

            {/* Sliding Filters */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar pt-4 -mx-1 px-1">
              {[
                { key: 'all', label: t('leads.status.all') },
                { key: 'new', label: t('leads.status.new') },
                { key: 'contacted', label: t('leads.status.contacted') },
                { key: 'qualified', label: t('leads.status.qualified') },
                { key: 'converted', label: t('leads.status.converted') },
                { key: 'lost', label: t('leads.status.lost') }
              ].map((filter) => (
                <button
                  key={filter.key}
                  onClick={() => setFilterStatus(filter.key)}
                  className={`shrink-0 px-5 py-2.5 rounded-full text-[11px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${
                    filterStatus === filter.key
                      ? 'bg-slate-900 text-white shadow-lg'
                      : 'bg-white text-slate-500 border border-slate-100'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Lead Grid */}
        <div className="px-5 py-6 space-y-4">
          <AnimatePresence mode="popLayout">
            {loading ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="h-40 bg-white rounded-[2rem] border border-slate-100 animate-pulse" />
              ))
            ) : filteredLeads.map((lead, index) => {
              const status = getStatusStyle(lead.status);
              const sourceStyle = getSourceStyle(lead.source);
              const SIcon = sourceStyle.icon;
              const StatusIcon = status.icon;

              return (
                <motion.div
                  key={lead.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-[0_4px_25px_rgba(0,0,0,0.02)] relative overflow-hidden group"
                >
                  {/* Decorative Gradient Blob */}
                  <div className={`absolute top-0 right-0 w-24 h-24 blur-3xl opacity-[0.03] transition-opacity group-hover:opacity-[0.06] ${status.bg}`} />
                  
                  <div className="flex items-start justify-between mb-5">
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center relative ${sourceStyle.bg}`}>
                        <SIcon className={`w-7 h-7 ${sourceStyle.color}`} />
                        <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-lg border-2 border-white flex items-center justify-center ${status.bg}`}>
                          <StatusIcon className={`w-3.5 h-3.5 ${status.text}`} />
                        </div>
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-slate-900 tracking-tight leading-tight">
                          {lead.name || lead.full_name || 'Anonymous'}
                        </h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                          {lead.source} • {(() => {
                            try {
                              return lead.created_date ? format(new Date(lead.created_date), 'dd MMM', { locale: dateLocale }) : '---';
                            } catch (e) {
                              return '---';
                            }
                          })()}
                        </p>
                      </div>
                    </div>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 active:bg-slate-100 transition-colors">
                          <MoreVertical className="w-5 h-5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 rounded-2xl p-2 border-slate-100 shadow-xl">
                        <DropdownMenuItem onClick={() => startEdit(lead)} className="rounded-xl px-4 py-3 font-bold text-sm">
                          {t('common.edit')}
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleDelete(lead.id)}
                          className="rounded-xl px-4 py-3 font-bold text-sm text-rose-500 focus:text-rose-500 focus:bg-rose-50"
                        >
                          {t('common.delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Contact Info Footer */}
                  <div className="flex items-center justify-between mt-auto">
                    <div className="flex flex-col">
                      <p className="text-xl font-black text-slate-900 tracking-tighter">{lead.phone}</p>
                      {lead.notes && (
                        <p className="text-[11px] font-medium text-slate-400 italic line-clamp-1 mt-0.5">
                           "{lead.notes}"
                        </p>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                       <button
                         onClick={() => window.open(`tel:${lead.phone}`, '_self')}
                         className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center active:scale-90 transition-all"
                       >
                         <Phone className="w-5 h-5" />
                       </button>
                       <button
                         onClick={() => {
                           const phone = lead.phone?.replace(/\D/g, '');
                           if (phone) window.open(`https://t.me/+${phone}`, '_blank');
                         }}
                         className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center active:scale-90 transition-all"
                       >
                         <Send className="w-5 h-5" />
                       </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {!loading && filteredLeads.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-24 h-24 bg-slate-100 rounded-[2.5rem] flex items-center justify-center mb-6">
                <Users className="w-10 h-10 text-slate-300" />
              </div>
              <p className="text-lg font-black text-slate-800">{t('leads.noLeads')}</p>
              <p className="text-sm font-medium text-slate-400 max-w-[200px] mt-2 italic">
                {t('leads.subtitle')}
              </p>
            </div>
          )}
        </div>

        {/* Premium Modal */}
        <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
          <DialogContent className="sm:max-w-md w-[calc(100%-32px)] rounded-[2.5rem] p-8 border-none shadow-2xl">
            <DialogHeader className="mb-6">
              <DialogTitle className="text-2xl font-black tracking-tighter">
                {editingLead ? t('common.edit') : t('leads.addNew')}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-5">
              <div className="space-y-2">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('leads.form.name')}</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value, full_name: e.target.value})}
                  className="h-12 rounded-2xl bg-slate-50 border-transparent focus:bg-white text-base font-bold"
                  placeholder="John Doe"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('leads.form.phone')}</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className="h-12 rounded-2xl bg-slate-50 border-transparent focus:bg-white text-base font-bold"
                  placeholder="+998 90 ..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('leads.form.source')}</Label>
                  <Select 
                    value={formData.source} 
                    onValueChange={(v) => setFormData({...formData, source: v})}
                  >
                    <SelectTrigger className="h-12 rounded-2xl bg-slate-50 border-transparent text-sm font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-slate-100 shadow-xl">
                      <SelectItem value="Website">Website</SelectItem>
                      <SelectItem value="Instagram">Instagram</SelectItem>
                      <SelectItem value="Telegram">Telegram</SelectItem>
                      <SelectItem value="Facebook">Facebook</SelectItem>
                      <SelectItem value="Google">Google</SelectItem>
                      <SelectItem value="Referral">Referral</SelectItem>
                      <SelectItem value="Walk-in">Walk-in</SelectItem>
                      <SelectItem value="Call">Call</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('leads.form.status')}</Label>
                  <Select 
                    value={formData.status} 
                    onValueChange={(v) => setFormData({...formData, status: v})}
                  >
                    <SelectTrigger className="h-12 rounded-2xl bg-slate-50 border-transparent text-sm font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-slate-100 shadow-xl">
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="contacted">Contacted</SelectItem>
                      <SelectItem value="qualified">Qualified</SelectItem>
                      <SelectItem value="converted">Converted</SelectItem>
                      <SelectItem value="lost">Lost</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('leads.form.notes')}</Label>
                <Input
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  className="h-12 rounded-2xl bg-slate-50 border-transparent focus:bg-white text-sm font-bold"
                  placeholder="..."
                />
              </div>

              <div className="flex gap-3 pt-6">
                <Button
                  variant="outline"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 h-12 rounded-2xl border-slate-100 text-slate-500 font-black text-base active:scale-95 transition-all"
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 h-12 rounded-2xl bg-slate-900 text-white font-black text-base shadow-xl shadow-slate-200 active:scale-95 transition-all"
                >
                  {saving ? '...' : t('common.save')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </PullToRefresh>
  );
}

