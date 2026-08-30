import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  Plus, Search, MoreVertical, Phone, MessageCircle, ChevronRight, 
  CheckCircle2,
  Settings2, Palette, Copy, UserPlus, X
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import PullToRefresh from '@/components/ui/PullToRefresh';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { supabase } from '@/api/supabaseClient';
import LeadQuickView from '@/components/marketing/LeadQuickView';

// Relative time formatting helper (Uzbek language)
const formatRelativeTime = (dateStr) => {
  if (!dateStr) return '';
  const now = new Date();
  const created = new Date(dateStr);
  const diffMs = now - created;
  if (isNaN(diffMs) || diffMs < 0) return '';
  
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMins < 1) return 'Hozirgina';
  if (diffMins < 60) return `${diffMins} daqiqa oldin`;
  if (diffHours < 24) return `${diffHours} soat oldin`;
  if (diffDays === 1) return 'Kecha';
  const day = String(created.getDate()).padStart(2, '0');
  const month = String(created.getMonth() + 1).padStart(2, '0');
  const year = created.getFullYear();
  return `${day}.${month}.${year}`;
};

// Color badge mapper based on dot color
const getStatusBadgeStyle = (dotColor) => {
  switch (dotColor) {
    case 'bg-emerald-500':
      return { bg: 'bg-emerald-50/90 border-emerald-100/50 text-emerald-700', dot: 'bg-emerald-500' };
    case 'bg-purple-500':
      return { bg: 'bg-purple-50/90 border-purple-100/50 text-purple-700', dot: 'bg-purple-500' };
    case 'bg-amber-500':
      return { bg: 'bg-amber-50/90 border-amber-100/50 text-amber-700', dot: 'bg-amber-500' };
    case 'bg-rose-500':
      return { bg: 'bg-rose-50/90 border-rose-100/50 text-rose-700', dot: 'bg-rose-500' };
    case 'bg-blue-500':
      return { bg: 'bg-blue-50/90 border-blue-100/50 text-blue-700', dot: 'bg-blue-500' };
    case 'bg-indigo-500':
      return { bg: 'bg-indigo-50/90 border-indigo-100/50 text-indigo-700', dot: 'bg-indigo-500' };
    case 'bg-slate-400':
    default:
      return { bg: 'bg-slate-50 border-slate-200/50 text-slate-600', dot: 'bg-slate-400' };
  }
};

// Lead Source metadata mapper
const getSourceBadgeInfo = (source) => {
  const src = (source || '').toLowerCase();
  if (src.includes('instagram') || src.includes('insta')) {
    return {
      label: 'Instagram',
      icon: '📸',
      bg: 'bg-rose-50 text-rose-600 border border-rose-100/30',
      avatarGrad: 'from-pink-500 via-rose-500 to-amber-500'
    };
  }
  if (src.includes('facebook') || src.includes('fb')) {
    return {
      label: 'Facebook',
      icon: '📘',
      bg: 'bg-blue-50 text-blue-600 border border-blue-100/30',
      avatarGrad: 'from-blue-600 to-indigo-700'
    };
  }
  if (src.includes('telegram') || src.includes('tg')) {
    return {
      label: 'Telegram',
      icon: '✈️',
      bg: 'bg-sky-50 text-sky-600 border border-sky-100/30',
      avatarGrad: 'from-sky-400 to-blue-500'
    };
  }
  if (src.includes('website') || src.includes('sayt') || src.includes('web') || src.includes('google')) {
    return {
      label: 'Sayt',
      icon: '🌐',
      bg: 'bg-emerald-50 text-emerald-600 border border-emerald-100/30',
      avatarGrad: 'from-emerald-400 to-teal-500'
    };
  }
  if (src.includes('call') || src.includes('qo\'ng\'iroq') || src.includes('telefon') || src.includes('tel')) {
    return {
      label: 'Qo\'ng\'iroq',
      icon: '📞',
      bg: 'bg-violet-50 text-violet-600 border border-violet-100/30',
      avatarGrad: 'from-violet-500 to-purple-600'
    };
  }
  if (src.includes('import')) {
    return {
      label: 'Import',
      icon: '📥',
      bg: 'bg-amber-50 text-amber-600 border border-amber-100/30',
      avatarGrad: 'from-amber-500 to-orange-600'
    };
  }
  return {
    label: source || 'Tavsiya',
    icon: '👤',
    bg: 'bg-slate-50 border border-slate-100 text-slate-600',
    avatarGrad: 'from-slate-500 to-slate-700'
  };
};

export default function MobileLeadsV6() {
  const { user, isDoctor } = useAuth();
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
    source: 'Call',
    status: 'new',
    notes: '',
    clinic_id: clinicId
  });

  const loadLeads = useCallback(async () => {
    try {
      setLoading(true);
      const allData = await base44.entities.Lead.list('-created_date', 200);
      
      // Doktor bo'lsa faqat o'ziga tayinlangan yoki o'zi qo'shgan lidlarni ko'rsin
      let data = allData;
      if (isDoctor && user?.id) {
        data = (allData || []).filter(lead =>
          String(lead.assigned_doctor_id) === String(user.id) ||
          String(lead.created_by_id) === String(user.id) ||
          (!lead.assigned_doctor_id && !lead.created_by_id)
        );
      }
      
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
  }, [isDoctor, user?.id]);

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
    const nameMatch = (lead.name || lead.full_name || '').toLowerCase();
    const phoneMatch = (lead.phone || '');
    const matchesSearch = nameMatch.includes(searchQuery.toLowerCase()) || phoneMatch.includes(searchQuery);
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
      toast.success("Muvaffaqiyatli saqlandi");
    } catch (error) {
      toast.error("Saqlashda xatolik yuz berdi");
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
      loadLeads();
    } catch (error) {
      toast.error("Statusni yangilashda xatolik");
      loadLeads();
    }
  };

  const resetForm = () => {
    setFormData({ name: '', phone: '', source: 'Call', status: 'new', notes: '', clinic_id: clinicId });
    setEditingLead(null);
  };

  const handleEditInit = (lead) => {
    setEditingLead(lead);
    setFormData({
      name: lead.name || lead.full_name || '',
      phone: lead.phone || '',
      source: lead.source || 'Call',
      status: lead.status || 'new',
      notes: lead.notes || '',
      clinic_id: lead.clinic_id || clinicId
    });
    setShowAddModal(true);
  };

  const copyPhoneNumber = (e, phone) => {
    e.stopPropagation();
    if (!phone) return;
    navigator.clipboard.writeText(phone);
    toast.success("Telefon raqami nusxalandi!");
  };

  const LeadCard = ({ lead, index }) => {
    const currentStatus = lead.status?.toLowerCase() || 'new';
    const status = statusConfig[currentStatus] || statusConfig['new'];
    const badgeStyle = getStatusBadgeStyle(status.dot);
    const timeAgo = formatRelativeTime(lead.created_date || lead.created_at);
    const sourceInfo = getSourceBadgeInfo(lead.source);
    const firstLetter = (lead.name || lead.full_name || 'I').charAt(0).toUpperCase();
    
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min(index, 6) * 0.02 }}
        className="mx-4 mb-3 bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col gap-3 active:scale-[0.99] hover:border-slate-200 transition-all duration-200 content-visibility-auto"
        onClick={() => setSelectedLead(lead)}
      >
        {/* Top Row: Avatar + Name + Source Badge + Dropdown Action */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {/* Source themed Avatar */}
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${sourceInfo.avatarGrad} text-white flex items-center justify-center font-extrabold text-sm shadow-sm shrink-0`}>
              {firstLetter}
            </div>
            <div className="min-w-0">
              <h3 className="font-extrabold text-slate-800 text-sm leading-snug truncate max-w-[130px]">
                {lead.name || lead.full_name || 'Ismsiz'}
              </h3>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                {/* Source badge */}
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold ${sourceInfo.bg}`}>
                  <span>{sourceInfo.icon}</span>
                  <span>{sourceInfo.label}</span>
                </span>
                {timeAgo && (
                  <span className="text-[9px] font-medium text-slate-400">
                    • {timeAgo}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          {/* Status Clickable Badge + Dropdown actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={(e) => { 
                e.stopPropagation(); 
                setStatusSelectionLead(lead); 
                setShowStatusModal(true); 
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-[9px] font-extrabold uppercase tracking-wider transition-all duration-200 active:scale-95 ${badgeStyle.bg}`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${badgeStyle.dot}`} />
              <span>{status.label}</span>
              <ChevronRight className="w-3 h-3 opacity-60 ml-0.5" />
            </button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                 <button className="w-8 h-8 hover:bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 active:scale-90 transition-transform">
                    <MoreVertical className="w-4 h-4" />
                 </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl border border-slate-100 shadow-xl bg-white p-1">
                 <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEditInit(lead); }} className="font-bold px-4 py-2.5 text-xs rounded-lg cursor-pointer">
                    Tahrirlash
                 </DropdownMenuItem>
                 <DropdownMenuItem onClick={async (e) => { e.stopPropagation(); if(confirm("O'chirishni tasdiqlaysizmi?")) { await base44.entities.Lead.delete(lead.id); loadLeads(); toast.success("O'chirildi"); } }} className="text-red-500 font-bold px-4 py-2.5 text-xs rounded-lg cursor-pointer">
                    O'chirish
                 </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Middle Row: Phone Number + Call & Telegram Buttons */}
        <div className="flex items-center justify-between border-t border-slate-50 pt-2.5">
          <div 
            onClick={(e) => copyPhoneNumber(e, lead.phone)}
            className="flex items-center gap-1.5 hover:text-slate-900 text-slate-700 transition-colors cursor-pointer active:opacity-75"
          >
            <span className="text-sm font-black tracking-tight select-all">{lead.phone}</span>
            <Copy className="w-3.5 h-3.5 text-slate-300" />
          </div>
          
          <div className="flex gap-1.5">
            <button 
              onClick={(e) => { 
                e.stopPropagation(); 
                window.open(`tel:${lead.phone}`, '_self'); 
              }} 
              className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center active:scale-90 transition-all border border-emerald-100/30"
            >
               <Phone className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={(e) => { 
                e.stopPropagation(); 
                const phoneClean = lead.phone?.replace(/\D/g, '');
                window.open(`https://t.me/+${phoneClean}`, '_blank'); 
              }} 
              className="w-8 h-8 bg-sky-50 text-sky-600 rounded-lg flex items-center justify-center active:scale-90 transition-all border border-sky-100/30"
            >
               <MessageCircle className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Bottom Notes Row (if notes exist) */}
        {lead.notes && (
           <div className="bg-slate-50/60 px-3 py-2 rounded-xl border border-slate-100/50 text-[10px] text-slate-500 font-medium leading-relaxed italic flex items-start gap-1">
             <span className="text-slate-300 select-none">“</span>
             <span className="flex-1 line-clamp-2">{lead.notes}</span>
             <span className="text-slate-300 select-none">”</span>
           </div>
        )}
      </motion.div>
    );
  };

  return (
    <PullToRefresh onRefresh={loadLeads}>
      <div className="min-h-screen bg-slate-50/20 pb-24">
        {/* Top Header */}
        <div className="bg-white px-5 pt-6 pb-4 sticky top-0 z-20 border-b border-slate-100/60 shadow-sm shadow-slate-100/5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Leadlar</h1>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mt-0.5 opacity-70">Potensial Bemorlar</p>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowSettingsModal(true)}
                className="w-10 h-10 bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-xl flex items-center justify-center border border-slate-100 shadow-sm active:scale-95 transition-all"
              >
                <Settings2 className="w-4.5 h-4.5" />
              </button>
              <button 
                onClick={() => { resetForm(); setShowAddModal(true); }}
                className="w-12 h-12 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl flex items-center justify-center shadow-lg active:scale-95 transition-all"
              >
                <Plus className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Redesigned Stats Header */}
          <div className="grid grid-cols-3 gap-2.5 mb-5">
             <div className="bg-gradient-to-br from-white to-slate-50/50 border border-slate-100 p-3.5 rounded-2xl shadow-sm flex flex-col justify-between h-20">
                <div className="flex justify-between items-start">
                   <span className="text-xl font-black text-slate-900 leading-none">{stats.total}</span>
                   <span className="text-sm select-none">🎯</span>
                </div>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider leading-none">Jami</p>
             </div>
             <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-3.5 rounded-2xl shadow-md shadow-emerald-500/10 flex flex-col justify-between h-20 text-white border border-emerald-600/30">
                <div className="flex justify-between items-start">
                   <span className="text-xl font-black leading-none">{stats.new}</span>
                   <span className="text-sm select-none">🔥</span>
                </div>
                <p className="text-[8px] font-black text-white/80 uppercase tracking-wider leading-none font-bold">Yangi</p>
             </div>
             <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-3.5 rounded-2xl shadow-md shadow-slate-950/10 flex flex-col justify-between h-20 text-white border border-slate-800">
                <div className="flex justify-between items-start">
                   <span className="text-xl font-black leading-none">{stats.conversion}%</span>
                   <span className="text-sm select-none">📈</span>
                </div>
                <p className="text-[8px] font-black text-white/60 uppercase tracking-wider leading-none">Konversiya</p>
             </div>
          </div>

          {/* Compact Search Bar */}
          <div className="relative mb-5">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Izlash..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-11 pl-10 pr-4 rounded-xl bg-slate-50 border border-slate-100 text-xs font-bold focus:bg-white focus:border-slate-300 focus:ring-4 focus:ring-slate-900/5 transition-all placeholder:text-slate-400"
            />
          </div>

          {/* Redesigned Filter Tabs */}
          <div className="flex gap-2 overflow-x-auto -mx-5 px-5 no-scrollbar pb-1">
            <button
              onClick={() => setFilterStatus('all')}
              className={`
                px-4 py-2.5 rounded-xl whitespace-nowrap transition-all border shrink-0 flex items-center gap-1.5
                ${filterStatus === 'all'
                  ? 'bg-slate-900 border-slate-900 text-white shadow-md' 
                  : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200'}
              `}
            >
              <span className="text-[9px] font-black uppercase tracking-wider">Hamma</span>
            </button>
            {[...pipeline, 'lost'].map((s) => {
              const isActive = filterStatus === s;
              const config = statusConfig[s] || { label: s, dot: 'bg-slate-400' };
              return (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`
                    px-4 py-2.5 rounded-xl whitespace-nowrap transition-all border shrink-0 flex items-center gap-1.5
                    ${isActive 
                      ? 'bg-slate-900 border-slate-900 text-white shadow-md' 
                      : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200'}
                  `}
                >
                  <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white' : config.dot}`} />
                  <span className="text-[9px] font-black uppercase tracking-wider">{config.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Lead List Cards */}
        <div className="mt-4 space-y-1">
          {loading ? (
             <div className="px-4 space-y-3 mt-3">
                {[1,2,3].map(i => <div key={i} className="h-32 bg-white rounded-2xl animate-pulse border border-slate-100" />)}
             </div>
          ) : filteredLeads.length === 0 ? (
             <div className="py-16 text-center">
                <span className="text-3xl select-none">📭</span>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-3">Lidlar topilmadi</p>
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
          <DialogContent className="max-w-md w-full p-0 border-none rounded-[2rem] bg-white outline-none overflow-hidden flex flex-col shadow-2xl">
             {/* ── Yashil Header ── */}
             <div className="bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 px-5 py-4 flex items-center justify-between shrink-0 text-white">
                <div className="flex items-center gap-3">
                   <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-sm">
                      <UserPlus className="w-5 h-5 text-white" />
                   </div>
                   <div>
                      <h2 className="text-[15px] font-black text-white uppercase leading-none tracking-tight">
                         {editingLead ? 'Leadni tahrirlash' : 'Yangi Lead'}
                      </h2>
                      <p className="text-[9px] font-bold text-white/70 uppercase tracking-widest mt-0.5">Dental System</p>
                   </div>
                </div>
                <button 
                   onClick={() => { setShowAddModal(false); resetForm(); }} 
                   className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center active:scale-90 transition-all border-none cursor-pointer"
                >
                   <X className="w-4 h-4" />
                </button>
             </div>

             {/* ── Body ── */}
             <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4 bg-white">
                <div className="space-y-1.5">
                   <Label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Mijoz Ismi</Label>
                   <Input 
                      value={formData.name} 
                      onChange={e => setFormData({...formData, name: e.target.value})} 
                      placeholder="Ism va Familiya" 
                      className="h-11 rounded-xl bg-slate-50 border-slate-100 font-bold text-xs" 
                   />
                </div>
                
                <div className="space-y-1.5">
                   <Label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Telefon Raqami</Label>
                   <Input 
                      value={formData.phone} 
                      onChange={e => setFormData({...formData, phone: e.target.value})} 
                      placeholder="+998901234567" 
                      className="h-11 rounded-xl bg-slate-50 border-slate-100 font-bold text-xs" 
                   />
                </div>

                <div className="space-y-1.5">
                   <Label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Manba (Platforma)</Label>
                   <select 
                      value={formData.source} 
                      onChange={e => setFormData({...formData, source: e.target.value})} 
                      className="w-full h-11 rounded-xl bg-slate-50 border border-slate-100 px-3 font-bold text-xs text-slate-700 focus:bg-white focus:border-slate-300 outline-none"
                   >
                      <option value="Call">📞 Telefon qo'ng'irog'i</option>
                      <option value="Instagram">📸 Instagram Ads / Direct</option>
                      <option value="Telegram">✈️ Telegram Bot / Guruh</option>
                      <option value="Facebook">📘 Facebook Ads / Page</option>
                      <option value="Website">🌐 Vebsayt arizasi</option>
                      <option value="Tavsiya">👤 Tavsiya</option>
                   </select>
                </div>

                <div className="space-y-1.5">
                   <Label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Qo'shimcha ma'lumot (Eslatma)</Label>
                   <textarea 
                      value={formData.notes || ''} 
                      onChange={e => setFormData({...formData, notes: e.target.value})} 
                      placeholder="Masalan: Implantat bo'yicha maslahat so'radi..." 
                      className="w-full h-20 rounded-xl bg-slate-50 border border-slate-100 p-3 font-bold text-xs text-slate-700 focus:bg-white focus:border-slate-300 outline-none resize-none"
                   />
                </div>
             </div>

             {/* ── Footer ── */}
             <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex gap-3 shrink-0">
                <Button 
                   variant="outline" 
                   onClick={() => { setShowAddModal(false); resetForm(); }}
                   className="flex-1 h-11 rounded-xl border-slate-200 font-bold text-xs uppercase tracking-wider text-slate-500 bg-white"
                >
                   Bekor qilish
                </Button>
                <Button 
                   onClick={handleSave} 
                   disabled={saving || !formData.name || !formData.phone}
                   className="flex-1 h-11 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black uppercase tracking-wider text-xs shadow-md shadow-emerald-500/10 border-none transition-all disabled:bg-slate-100 disabled:text-slate-400 disabled:opacity-50"
                >
                   {saving ? 'Saqlanmoqda...' : 'Saqlash'}
                </Button>
             </div>
          </DialogContent>
        </Dialog>

        {/* Status Selection Dialog */}
        <Dialog open={showStatusModal} onOpenChange={setShowStatusModal}>
          <DialogContent className="rounded-3xl p-6 border-none max-w-[90vw]">
             <DialogHeader>
                <DialogTitle className="text-lg font-black text-slate-900">Holatni o'zgartirish</DialogTitle>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">
                   {statusSelectionLead?.name || statusSelectionLead?.full_name} uchun yangi bosqichni tanlang
                </p>
             </DialogHeader>
             
             <div className="grid grid-cols-1 gap-2.5 mt-4">
                {Object.entries(statusConfig).map(([key, config]) => {
                  const isCurrent = statusSelectionLead?.status?.toLowerCase() === key;
                  return (
                    <button
                      key={key}
                      onClick={() => updateStatus(statusSelectionLead.id, key)}
                      className={`
                        w-full p-4 rounded-2xl flex items-center justify-between transition-all border
                        ${isCurrent 
                          ? 'bg-slate-900 border-slate-900 text-white shadow-lg' 
                          : 'bg-slate-50 border-slate-100 hover:border-slate-200'}
                      `}
                    >
                       <div className="flex items-center gap-3">
                          <div className={`w-2.5 h-2.5 rounded-full ${config.dot}`} />
                          <span className={`font-black text-[10px] uppercase tracking-wider ${isCurrent ? 'text-white' : 'text-slate-600'}`}>
                             {config.label}
                          </span>
                       </div>
                       {isCurrent && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                    </button>
                  );
                })}
             </div>
             
             <Button 
                variant="outline" 
                onClick={() => setShowStatusModal(false)}
                className="w-full h-12 mt-3 rounded-xl border-slate-100 font-bold text-xs text-slate-400 uppercase tracking-wider"
             >
                Bekor qilish
             </Button>
          </DialogContent>
        </Dialog>

        {/* Settings Dialog */}
        <Dialog open={showSettingsModal} onOpenChange={setShowSettingsModal}>
          <DialogContent className="rounded-3xl p-6 border-none max-w-[95vw] max-h-[85vh] overflow-y-auto no-scrollbar pb-8">
            <DialogHeader>
              <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
                 <Palette className="w-5 h-5 text-emerald-500" /> Bo'limlar sozlamalari
              </DialogTitle>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">
                 Har bir bosqichning nomi va rangini o'zingizga moslang
              </p>
            </DialogHeader>

            <div className="space-y-5 mt-6">
              {Object.entries(statusConfig).map(([key, config]) => (
                <div key={key} className="space-y-3 p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                  <div className="space-y-1 px-1">
                    <Label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{key.toUpperCase()} NOMI</Label>
                    <Input 
                      value={config.label} 
                      onChange={(e) => setStatusConfig({...statusConfig, [key]: {...config, label: e.target.value}})}
                      className="h-10 rounded-xl bg-white border-slate-200 font-bold focus:ring-4 focus:ring-slate-900/5 transition-all text-xs"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-[9px] font-black text-slate-400 uppercase tracking-wider px-1">RANG TANLASH</Label>
                    <div className="flex flex-wrap gap-2">
                      {COLOR_PALETTE.map((color) => (
                        <button
                          key={color.bg}
                          onClick={() => setStatusConfig({...statusConfig, [key]: {...config, dot: color.bg}})}
                          className={`
                            w-8 h-8 rounded-lg transition-all flex items-center justify-center
                            ${color.bg} ${config.dot === color.bg ? 'ring-4 ring-slate-900/10 scale-105 shadow-sm' : 'opacity-40 hover:opacity-100'}
                          `}
                        >
                          {config.dot === color.bg && <CheckCircle2 className="w-4.5 h-4.5 text-white" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
              
              <Button 
                onClick={() => saveStatusSettings(statusConfig)}
                className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 border-none text-white font-black uppercase text-[10px] tracking-wider shadow-lg active:scale-95 transition-all mt-4"
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
