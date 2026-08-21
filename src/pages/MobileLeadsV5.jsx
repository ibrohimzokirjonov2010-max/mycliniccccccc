import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Search, MoreVertical, Phone, MessageCircle, 
  Zap, Target, CheckCircle2, XCircle, ArrowRight 
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

/**
 * Ultra-Minimal Lead Management V5
 * Stripped down to essentials only
 */
export default function MobileLeadsV5() {
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
    source: 'Website',
    status: 'new'
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
    const matchesSearch = (lead.name || lead.full_name)?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         lead.phone?.includes(searchQuery);
    const matchesStatus = filterStatus === 'all' || lead.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const statusConfig = {
    'new': { dot: 'bg-blue-500', label: 'Yangi', icon: <Zap className="w-3 h-3" />, color: 'blue', next: 'contacted' },
    'contacted': { dot: 'bg-purple-500', label: 'Aloqada', icon: <Phone className="w-3 h-3" />, color: 'purple', next: 'qualified' },
    'qualified': { dot: 'bg-amber-500', label: 'Qiziqqan', icon: <Target className="w-3 h-3" />, color: 'amber', next: 'converted' },
    'converted': { dot: 'bg-emerald-500', label: 'Bemor', icon: <CheckCircle2 className="w-3 h-3" />, color: 'emerald', next: null },
    'lost': { dot: 'bg-slate-500', label: 'Yo\'qotildi', icon: <XCircle className="w-3 h-3" />, color: 'slate', next: null }
  };

  const pipeline = ['new', 'contacted', 'qualified', 'converted'];

  const getStatusStyle = (status) => statusConfig[status] || statusConfig['New'];

  const handleSave = async () => {
    if (!formData.full_name || !formData.phone) return;

    setSaving(true);
    try {
      const leadData = {
        name: formData.name,
        phone: formData.phone,
        source: formData.source,
        status: formData.status
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
    if (!confirm('O\'chirish?')) return;
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
      source: 'Website',
      status: 'new'
    });
  };

  const startEdit = (lead) => {
    setEditingLead(lead);
    setFormData({
      name: lead.name || lead.full_name || '',
      phone: lead.phone,
      source: lead.source || 'Website',
      status: lead.status?.toLowerCase() || 'new'
    });
    setShowAddModal(true);
  };

  const totalLeads = leads.length;
  const newLeads = leads.filter(l => l.status === 'New').length;

  const advanceLead = async (lead) => {
    const currentStatus = lead.status?.toLowerCase() || 'new';
    const nextStatus = statusConfig[currentStatus]?.next;
    
    if (!nextStatus) return;

    try {
      // Optimistic UI
      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: nextStatus } : l));
      
      await base44.entities.Lead.update(lead.id, { status: nextStatus });
      toast.success("Bosqich yangilandi", {
        description: `${lead.name || 'Mijoz'} ${statusConfig[nextStatus].label} bosqichiga o'tdi.`
      });
    } catch (error) {
      toast.error("Xatolik yuz berdi");
      loadLeads();
    }
  };

  const LeadCard = ({ lead, index }) => {
    const currentStatus = lead.status?.toLowerCase() || 'new';
    const status = statusConfig[currentStatus] || statusConfig['new'];
    const nextStatusObj = statusConfig[status.next];
    
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        className="mx-4 mb-4 bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden relative"
      >
        {/* Top Progress Line */}
        <div className="absolute top-0 left-0 right-0 h-1 flex">
          {pipeline.map((p, i) => {
            const pIdx = pipeline.indexOf(currentStatus);
            const isActive = i <= pIdx;
            return (
              <div 
                key={p} 
                className={`flex-1 transition-all duration-500 ${isActive ? statusConfig[p].dot : 'bg-slate-100'}`}
              />
            );
          })}
        </div>

        <div className="p-4 pt-5">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-2xl ${status.dot} bg-opacity-10 flex items-center justify-center text-xl shadow-inner`}>
                {lead.source === 'Instagram' ? '📸' : lead.source === 'Telegram' ? '💬' : '📞'}
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-slate-900 truncate uppercase text-sm leading-tight">
                  {lead.name || lead.full_name || 'Noma\'lum'}
                </h3>
                <div className="flex items-center gap-1.5 mt-1">
                  <Phone className="w-3 h-3 text-slate-400" />
                  <span className="text-xs font-bold text-slate-500 tabular-nums">{lead.phone}</span>
                </div>
              </div>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-2 -mr-2 text-slate-300 hover:text-slate-600 active:bg-slate-50 rounded-full transition-colors">
                  <MoreVertical className="w-5 h-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-2xl p-2 w-48 shadow-xl border-slate-100">
                <DropdownMenuItem onClick={() => startEdit(lead)} className="rounded-xl p-3 text-sm font-semibold flex items-center gap-2">
                  <Plus className="w-4 h-4 text-blue-500 rotate-45" /> Tahrirlash
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDelete(lead.id)} className="rounded-xl p-3 text-sm font-semibold text-red-600 flex items-center gap-2">
                  <XCircle className="w-4 h-4" /> O'chirish
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Quick Actions Bar */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button 
              onClick={() => window.open(`tel:${lead.phone}`, '_self')}
              className="flex items-center justify-center gap-2 h-12 bg-emerald-500 text-white rounded-2xl font-bold text-xs active:scale-95 transition-transform shadow-lg shadow-emerald-500/20"
            >
              <Phone className="w-4 h-4" /> Qo'ng'iroq
            </button>
            <button 
              onClick={() => {
                const phone = lead.phone?.replace(/\D/g, '');
                if (phone) window.open(`https://t.me/+${phone}`, '_blank');
              }}
              className="flex items-center justify-center gap-2 h-12 bg-sky-500 text-white rounded-2xl font-bold text-xs active:scale-95 transition-transform shadow-lg shadow-sky-500/20"
            >
              <MessageCircle className="w-4 h-4" /> Telegram
            </button>
          </div>

          {/* Pipeline Advance */}
          {nextStatusObj && (
            <div className="pt-4 border-t border-slate-50">
              <button 
                onClick={(e) => { e.stopPropagation(); advanceLead(lead); }}
                className="w-full h-14 bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl flex items-center justify-between px-5 active:scale-[0.98] transition-all group"
              >
                <div className="flex flex-col items-start translate-y-[-1px]">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Keyingi bosqich</span>
                  <span className="text-sm font-bold text-white flex items-center gap-2">
                    {nextStatusObj.icon} {nextStatusObj.label}
                  </span>
                </div>
                <div className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center group-hover:translate-x-1 transition-transform">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </button>
            </div>
          )}
          
          {!nextStatusObj && (
            <div className="pt-4 border-t border-slate-50 flex items-center justify-center">
              <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-full text-xs font-bold">
                <CheckCircle2 className="w-4 h-4" /> Pipeline yakunlangan
              </div>
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <PullToRefresh onRefresh={loadLeads}>
      <div className="min-h-screen bg-slate-50/50">
        {/* Sticky Professional Header */}
        <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-xl border-b border-slate-100 safe-area-top shadow-sm">
          <div className="px-5 pt-6 pb-4">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Leadlar</h1>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Pipeline Flow</p>
              </div>
              <button 
                onClick={() => { setEditingLead(null); resetForm(); setShowAddModal(true); }}
                className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-lg active:scale-90 transition-transform"
              >
                <Plus className="w-6 h-6" />
              </button>
            </div>

            {/* Pipeline Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2 no-scrollbar">
              {['all', ...pipeline, 'lost'].map((s) => {
                const isActive = filterStatus === s;
                const config = statusConfig[s] || { label: 'Barcha', next: null };
                const count = leads.filter(l => s === 'all' ? true : (l.status?.toLowerCase() || 'new') === s).length;
                
                return (
                  <button
                    key={s}
                    onClick={() => setFilterStatus(s)}
                    className={`
                      flex items-center gap-2 px-4 py-3 rounded-2xl whitespace-nowrap transition-all border-2 shrink-0
                      ${isActive 
                        ? 'bg-slate-900 border-slate-900 text-white shadow-lg' 
                        : 'bg-white border-slate-100 text-slate-500 shadow-sm'}
                    `}
                  >
                    <span className="text-xs font-bold uppercase tracking-wider">{config.label}</span>
                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-lg ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Search Bar */}
            <div className="relative mt-4">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Ism yoki raqam..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-12 pl-11 pr-4 rounded-2xl bg-slate-100 border-none text-sm font-bold focus:ring-2 focus:ring-slate-900/5 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Lead List Area */}
        <div className="py-6">
          {loading ? (
            <div className="p-4 space-y-2">
              {[1,2,3].map(i => (
                <div key={i} className="h-16 bg-slate-50 rounded animate-pulse" />
              ))}
            </div>
          ) : filteredLeads.length > 0 ? (
            <AnimatePresence>
              {filteredLeads.map((lead, index) => (
                <LeadCard key={lead.id} lead={lead} index={index} />
              ))}
            </AnimatePresence>
          ) : (
            <div className="text-center py-12 text-slate-400 text-sm">
              Leadlar topilmadi
            </div>
          )}
        </div>

        {/* Minimal Modal */}
        <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-base font-medium">
                {editingLead ? 'Tahrirlash' : 'Yangi lead'}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-3 py-3">
              <div>
                <Label className="text-xs text-slate-600">Ism</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="h-9 mt-1"
                />
              </div>

              <div>
                <Label className="text-xs text-slate-600">Telefon</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className="h-9 mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-slate-600">Manba</Label>
                  <Select 
                    value={formData.source} 
                    onValueChange={(v) => setFormData({...formData, source: v})}
                  >
                    <SelectTrigger className="h-9 mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Website">Sayt</SelectItem>
                      <SelectItem value="Instagram">Instagram</SelectItem>
                      <SelectItem value="Telegram">Telegram</SelectItem>
                      <SelectItem value="Call">Qo'ng'iroq</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-slate-600">Status</Label>
                  <Select 
                    value={formData.status} 
                    onValueChange={(v) => setFormData({...formData, status: v})}
                  >
                    <SelectTrigger className="h-9 mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-slate-100 shadow-2xl">
                      {['new', 'contacted', 'qualified', 'converted', 'lost'].map(s => (
                        <SelectItem key={s} value={s} className="uppercase text-[10px] font-black tracking-widest p-3">
                          {statusConfig[s]?.label || s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Ad Custom Questions for Mobile */}
              {editingLead?.form_data && Object.keys(editingLead.form_data).length > 0 && (
                 <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3 underline decoration-indigo-500/30">Ad Form Answers</p>
                    <div className="space-y-3">
                       {Object.entries(editingLead.form_data).map(([q, a], idx) => (
                          <div key={idx}>
                             <p className="text-[10px] font-bold text-slate-500 uppercase">{q.replace(/_/g, ' ')}</p>
                             <p className="text-xs font-black text-slate-900 mt-0.5">{a}</p>
                          </div>
                       ))}
                    </div>
                 </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 h-9 text-xs"
                >
                  Bekor
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 h-9 text-xs bg-slate-900"
                >
                  {saving ? '...' : 'Saqlash'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </PullToRefresh>
  );
}
