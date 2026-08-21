import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Search, MoreVertical, Phone, MessageCircle, ChevronRight, Target, Zap, 
  CheckCircle2, Clock, XCircle, ArrowRight, UserPlus, Filter, Info, History, ArrowUpRight,
  Settings2, Palette
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
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
import { toast } from 'sonner';
import { supabase } from '@/api/supabaseClient';
import LeadQuickView from '@/components/marketing/LeadQuickView';

export default function MobileLeadsV6() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('new');
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusSelectionLead, setStatusSelectionLead] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [selectedLead, setSelectedLead] = useState(null);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState({ total: 0, new: 0, conversion: 0 });
  
  const clinicId = localStorage.getItem('current_clinic_id') || 'default_clinic';

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    source: 'Website',
    status: 'new',
    clinic_id: clinicId
  });

  const loadLeads = useCallback(async () => {
    try {
      setLoading(true);
      const data = await base44.entities.Lead.list('-created_date', 100);
      setLeads(data);
      
      const total = data.length;
      const newCount = data.filter(l => (l.status?.toLowerCase() || 'new') === 'new').length;
      const converted = data.filter(l => l.status?.toLowerCase() === 'converted').length;
      const convRate = total > 0 ? Math.round((converted / total) * 100) : 0;
      
      setStats({ total, new: newCount, conversion: convRate });
    } catch (error) {
      console.error('Failed to load leads:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLeads();

    // Supabase Real-time Sync
    const channelName = `leads_mobile_${clinicId}_${Math.random().toString(36).substring(7)}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: '*', 
        schema: 'public',
        table: 'leads',
        filter: `clinic_id=eq.${clinicId}`
      }, () => {
        loadLeads();
      });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('Successfully subscribed to leads');
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadLeads, clinicId]);

  // Professional Status Colors Palette
  const COLOR_PALETTE = [
    { name: 'Emerald', bg: 'bg-emerald-500', text: 'text-emerald-500' },
    { name: 'Purple', bg: 'bg-purple-500', text: 'text-purple-500' },
    { name: 'Amber', bg: 'bg-amber-500', text: 'text-amber-500' },
    { name: 'Rose', bg: 'bg-rose-500', text: 'text-rose-500' },
    { name: 'Blue', bg: 'bg-blue-500', text: 'text-blue-500' },
    { name: 'Slate', bg: 'bg-slate-400', text: 'text-slate-400' },
    { name: 'Indigo', bg: 'bg-indigo-500', text: 'text-indigo-500' }
  ];

  const [statusConfig, setStatusConfig] = useState(() => {
    const saved = localStorage.getItem(`leads_config_${clinicId}`);
    return saved ? JSON.parse(saved) : {
      'new': { dot: 'bg-emerald-500', label: 'Yangi', next: 'contacted' },
      'contacted': { dot: 'bg-purple-500', label: 'Bog\'lanildi', next: 'qualified' },
      'qualified': { dot: 'bg-amber-500', label: 'Qiziqqan', next: 'converted' },
      'converted': { dot: 'bg-emerald-500', label: 'Bemor', next: null },
      'lost': { dot: 'bg-slate-400', label: 'Rad etilgan', next: null }
    };
  });

  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const saveStatusSettings = (newConfig) => {
    setStatusConfig(newConfig);
    localStorage.setItem(`leads_config_${clinicId}`, JSON.stringify(newConfig));
    toast.success("Sozlamalar saqlandi!");
    setShowSettingsModal(false);
  };

  const pipeline = ['new', 'contacted', 'qualified', 'converted'];

  const filteredLeads = leads.filter(lead => {
    const status = lead.status?.toLowerCase() || 'new';
    const matchesSearch = (lead.name || lead.full_name)?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         lead.phone?.includes(searchQuery);
    const matchesStatus = filterStatus === 'all' || status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const handleSave = async () => {
    if (!formData.name || !formData.phone) return;
    setSaving(true);
    try {
      if (editingLead) {
        await base44.entities.Lead.update(editingLead.id, formData);
      } else {
        await base44.entities.Lead.create(formData);
      }
      setShowAddModal(false);
      resetForm();
      loadLeads();
      toast.success("Saqlandi");
    } catch (error) {
      toast.error("Xatolik");
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (leadId, newStatus) => {
    try {
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
      await base44.entities.Lead.update(leadId, { status: newStatus });
      toast.success("Holat yangilandi!");
      setShowStatusModal(false);
    } catch (error) {
      toast.error("Statusni yangilashda xatolik");
      loadLeads();
    }
  };

  const resetForm = () => {
    setFormData({ name: '', phone: '', source: 'Website', status: 'new' });
    setEditingLead(null);
  };

  const LeadCard = ({ lead, index }) => {
    const currentStatus = lead.status?.toLowerCase() || 'new';
    const status = statusConfig[currentStatus] || statusConfig['new'];
    
    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        className="mx-4 mb-3 bg-white rounded-[2rem] p-5 shadow-sm border border-slate-100 flex flex-col gap-3 active:scale-[0.98] transition-transform"
        onClick={() => setSelectedLead(lead)}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
             <div>
                <h3 className="font-black text-slate-900 text-base leading-tight truncate max-w-[200px]">
                   {lead.name || lead.full_name || 'Ismsiz'}
                </h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                   <div className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                      {status.label} • {lead.source || 'Tavsiya'}
                   </p>
                </div>
             </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
               <button className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-300">
                  < MoreVertical className="w-4 h-4" />
               </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="rounded-2xl border-none shadow-2xl">
               <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditingLead(lead); setFormData(lead); setShowAddModal(true); }} className="font-bold px-4 py-3 text-sm">Tahrirlash</DropdownMenuItem>
               <DropdownMenuItem onClick={async (e) => { e.stopPropagation(); if(confirm("O'chirishni tasdiqlaysizmi?")) { await base44.entities.Lead.delete(lead.id); loadLeads(); } }} className="text-red-500 font-bold px-4 py-3 text-sm">O'chirish</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center justify-between">
           <span className="text-lg font-black text-slate-900 tracking-tight">{lead.phone}</span>
           <div className="flex gap-1.5">
              <button onClick={(e) => { e.stopPropagation(); window.open(`tel:${lead.phone}`, '_self'); }} className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center active:scale-90 transition-all">
                 <Phone className="w-4 h-4" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); window.open(`https://t.me/+${lead.phone?.replace(/\D/g, '')}`, '_blank'); }} className="w-10 h-10 bg-sky-50 text-sky-600 rounded-xl flex items-center justify-center active:scale-90 transition-all">
                 <MessageCircle className="w-4 h-4" />
              </button>
           </div>
        </div>

        {lead.notes && (
           <p className="text-[11px] text-slate-400 font-bold italic truncate opacity-80 leading-relaxed bg-slate-50 p-2 rounded-xl border-l-2 border-slate-200">
             "{lead.notes}"
           </p>
        )}

        {/* Professional Status Choice Action */}
        <button 
          onClick={(e) => { e.stopPropagation(); setStatusSelectionLead(lead); setShowStatusModal(true); }}
          className="w-full h-14 bg-slate-900 text-white rounded-[1.2rem] flex items-center justify-center gap-3 font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-lg shadow-slate-900/10"
        >
          {currentStatus === 'converted' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <History className="w-4 h-4" />}
          {currentStatus === 'converted' ? 'Bemorga aylandi' : 'Holatni o\'zgartirish'}
          <ArrowRight className="w-3 h-3 ml-1 opacity-50" />
        </button>
      </motion.div>
    );
  };

  return (
    <PullToRefresh onRefresh={loadLeads}>
      <div className="min-h-screen bg-slate-50/20 pb-20">
        {/* Top Header */}
        <div className="bg-white px-6 pt-8 pb-4 sticky top-0 z-20">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tighter">Leadlar</h1>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1 opacity-60">Potensial Bemorlar</p>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setShowSettingsModal(true)}
                className="w-12 h-12 bg-white border border-slate-100 text-slate-400 rounded-2xl flex items-center justify-center shadow-sm active:scale-90 transition-transform"
              >
                <Settings2 className="w-5 h-5" />
              </button>
              <button 
                onClick={() => { resetForm(); setShowAddModal(true); }}
                className="w-14 h-14 bg-slate-900 text-white rounded-[1.5rem] flex items-center justify-center shadow-2xl active:scale-90 transition-transform"
              >
                <Plus className="w-8 h-8" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-8">
             <div className="bg-white border border-slate-100 p-5 rounded-[2rem] shadow-sm">
                <p className="text-2xl font-black text-slate-900 leading-none">{stats.total}</p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Jami</p>
             </div>
             <div className="bg-emerald-500 p-5 rounded-[2rem] shadow-xl shadow-emerald-500/20">
                <p className="text-2xl font-black text-white leading-none">{stats.new}</p>
                <p className="text-[10px] font-black text-white/70 uppercase tracking-widest mt-2">Yangi</p>
             </div>
             <div className="bg-slate-900 p-5 rounded-[2rem] shadow-xl">
                <p className="text-2xl font-black text-white leading-none">{stats.conversion}%</p>
                <p className="text-[10px] font-black text-white/50 uppercase tracking-widest mt-2">Konversiya</p>
             </div>
          </div>

          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Izlash..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-14 pl-12 pr-4 rounded-2xl bg-slate-50 border-none text-sm font-bold focus:ring-4 focus:ring-slate-900/5 transition-all"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto -mx-6 px-6 no-scrollbar pb-2">
            {[...pipeline, 'lost'].map((s) => {
              const isActive = filterStatus === s;
              const config = statusConfig[s];
              return (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`
                    px-6 py-3.5 rounded-full whitespace-nowrap transition-all border-2 shrink-0
                    ${isActive 
                      ? 'bg-slate-900 border-slate-900 text-white shadow-xl px-8 shadow-slate-900/20' 
                      : 'bg-white border-slate-100 text-slate-400'}
                  `}
                >
                  <span className="text-[10px] font-black uppercase tracking-widest">{config.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-8 space-y-4">
          {loading ? (
             <div className="px-4 space-y-4">
                {[1,2,3].map(i => <div key={i} className="h-48 bg-white rounded-[2.5rem] animate-pulse" />)}
             </div>
          ) : filteredLeads.map((lead, index) => (
             <LeadCard key={lead.id} lead={lead} index={index} />
          ))}
        </div>

        <LeadQuickView 
          lead={selectedLead} 
          isOpen={!!selectedLead} 
          onClose={() => setSelectedLead(null)} 
        />

        <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
          <DialogContent className="rounded-[3rem] p-8 border-none">
             <DialogHeader><DialogTitle className="text-xl font-black">Yangi Lead</DialogTitle></DialogHeader>
             <div className="space-y-4 mt-4">
                <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ism" className="h-14 rounded-2xl bg-slate-50 border-none font-bold" />
                <Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="Telefon" className="h-14 rounded-2xl bg-slate-50 border-none font-bold" />
                <Button onClick={handleSave} className="w-full h-14 rounded-2xl bg-slate-900 font-black uppercase tracking-widest shadow-xl transition-all">Saqlash</Button>
             </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showStatusModal} onOpenChange={setShowStatusModal}>
          <DialogContent className="rounded-[3rem] p-8 border-none max-w-[90vw]">
             <DialogHeader>
                <DialogTitle className="text-xl font-black text-slate-900">Holatni o'zgartirish</DialogTitle>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">
                   {statusSelectionLead?.name || statusSelectionLead?.full_name} uchun yangi bosqichni tanlang
                </p>
             </DialogHeader>
             
             <div className="grid grid-cols-1 gap-3 mt-6">
                {Object.entries(statusConfig).map(([key, config]) => {
                  const isCurrent = statusSelectionLead?.status?.toLowerCase() === key;
                  return (
                    <button
                      key={key}
                      onClick={() => updateStatus(statusSelectionLead.id, key)}
                      className={`
                        w-full p-5 rounded-[1.5rem] flex items-center justify-between transition-all border-2
                        ${isCurrent 
                          ? 'bg-slate-900 border-slate-900 text-white shadow-xl shadow-slate-900/20' 
                          : 'bg-slate-50 border-slate-50 hover:border-slate-200'}
                      `}
                    >
                       <div className="flex items-center gap-4">
                          <div className={`w-3 h-3 rounded-full ${config.dot}`} />
                          <span className={`font-black text-xs uppercase tracking-widest ${isCurrent ? 'text-white' : 'text-slate-600'}`}>
                             {config.label}
                          </span>
                       </div>
                       {isCurrent && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                    </button>
                  );
                })}
             </div>
             
             <Button 
                variant="outline" 
                onClick={() => setShowStatusModal(false)}
                className="w-full h-14 mt-4 rounded-2xl border-slate-100 font-black text-slate-400 uppercase tracking-widest"
             >
                Bekor qilish
             </Button>
          </DialogContent>
        </Dialog>

        <Dialog open={showSettingsModal} onOpenChange={setShowSettingsModal}>
          <DialogContent className="rounded-[3rem] p-8 border-none max-w-[95vw] max-h-[85vh] overflow-y-auto no-scrollbar pb-12">
            <DialogHeader>
              <DialogTitle className="text-xl font-black text-slate-900 flex items-center gap-3">
                 <Palette className="w-6 h-6 text-emerald-500" /> Bo'limlar sozlamalari
              </DialogTitle>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">
                 Har bir bosqichning nomi va rangini o'zingizga moslang
              </p>
            </DialogHeader>

            <div className="space-y-6 mt-8">
              {Object.entries(statusConfig).map(([key, config]) => (
                <div key={key} className="space-y-4 p-5 bg-slate-50/50 rounded-[2rem] border border-slate-100 shadow-sm">
                  <div className="space-y-1.5 px-1">
                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{key.toUpperCase()} NOMI</Label>
                    <Input 
                      value={config.label} 
                      onChange={(e) => setStatusConfig({...statusConfig, [key]: {...config, label: e.target.value}})}
                      className="h-12 rounded-[1.2rem] bg-white border-slate-200 font-bold focus:ring-4 focus:ring-slate-900/5 transition-all text-sm"
                    />
                  </div>
                  
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">RANG TANLASH</Label>
                    <div className="flex flex-wrap gap-2.5">
                      {COLOR_PALETTE.map((color) => (
                        <button
                          key={color.bg}
                          onClick={() => setStatusConfig({...statusConfig, [key]: {...config, dot: color.bg}})}
                          className={`
                            w-10 h-10 rounded-xl transition-all flex items-center justify-center
                            ${color.bg} ${config.dot === color.bg ? 'ring-4 ring-slate-900/10 scale-110 shadow-lg' : 'opacity-40 hover:opacity-100'}
                          `}
                        >
                          {config.dot === color.bg && <CheckCircle2 className="w-5 h-5 text-white" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
              
              <Button 
                onClick={() => saveStatusSettings(statusConfig)}
                className="w-full h-16 rounded-2xl bg-slate-900 border-none text-white font-black uppercase text-xs tracking-[0.2em] shadow-2xl active:scale-95 transition-all mt-6"
              >
                O'ZGARISHLARNI SAQLASH
              </Button>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </PullToRefresh>
  );
}
