import { useState, useEffect, useMemo } from 'react';
import { 
  Target, TrendingUp, BarChart3, Users, Facebook, Instagram, 
  Plus, Search, Zap, DollarSign, RefreshCw, MessageSquare, 
  ChevronRight, ExternalLink, Activity, X, Check, AlertCircle,
  Shield, Globe, Key, Settings, Loader2, Link as LinkIcon,
  CheckCircle2, Copy, FileText, Smartphone, Workflow, Terminal,
  Server, ZapOff, CheckCircle, PieChart as PieChartIcon, MapPin,
  TrendingDown, ArrowUpRight, Phone, Globe2, MessageCircle
} from 'lucide-react';
import LeadQuickView from '@/components/marketing/LeadQuickView';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useTranslation } from '@/i18n/LanguageContext';
import { supabase } from '@/api/supabaseClient';

export default function MobileMarketing() {
  const { t } = useTranslation();

  // Data States
  const [leads, setLeads] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeSegment, setActiveSegment] = useState('leads'); // leads as default to solve user issue
  const [selectedLead, setSelectedLead] = useState(null);

  // Credentials for Make.com
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  const clinicId = localStorage.getItem('current_clinic_id') || 'default_clinic';

  useEffect(() => {
    loadLeads();

    // Supabase Real-time Sync with unique channel name to avoid collisions
    const channelId = `marketing_mobile_${clinicId}_${Date.now()}`;
    const channel = supabase
      .channel(channelId)
      .on('postgres_changes', {
        event: '*', 
        schema: 'public',
        table: 'leads',
        filter: `clinic_id=eq.${clinicId}`
      }, () => {
        loadLeads();
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Marketing Realtime: Subscribed');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clinicId]);

  const loadLeads = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('clinic_id', clinicId) // 🔒 Security & Sync Filter
        .order('created_date', { ascending: false })
        .limit(40);
      
      if (data) {
        setLeads(data);
        generateChartData(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const generateChartData = (leadsData) => {
    const daysOfWeek = ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];
    const data = [];
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayName = daysOfWeek[d.getDay()];
      
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dayStr = `${year}-${month}-${day}`;
      
      const count = (leadsData || []).filter(l => {
        const lDate = l.created_date || l.created_at;
        return lDate && lDate.startsWith(dayStr);
      }).length;
      
      data.push({
        name: dayName,
        leads: count
      });
    }
    
    setChartData(data);
  };

  const handleSync = async () => {
    setSyncing(true);
    await loadLeads();
    setTimeout(() => setSyncing(false), 800);
  };

  // ─── Dynamic Demographic / Age Segment Calculator ───
  const audienceData = useMemo(() => {
    let ageBuckets = { '18-24 yosh': 0, '25-34 yosh': 0, '35-50 yosh': 0, '50+ yosh': 0 };
    
    leads.forEach(l => {
      // form_data ni parse qilish
      let fd = l.form_data;
      if (typeof fd === 'string') {
        try { fd = JSON.parse(fd); } catch (e) { fd = {}; }
      }
      if (!fd) return;
      
      Object.entries(fd).forEach(([key, val]) => {
         const k = key.toLowerCase();
         const vStr = String(val);
         if (k.includes('yosh')) {
           const ageMatch = vStr.match(/\d+/);
           if (ageMatch) {
             const age = parseInt(ageMatch[0]);
             if (age < 25) ageBuckets['18-24 yosh']++;
             else if (age <= 34) ageBuckets['25-34 yosh']++;
             else if (age <= 50) ageBuckets['35-50 yosh']++;
             else ageBuckets['50+ yosh']++;
           }
         }
      });
    });

    const totalAge = Object.values(ageBuckets).reduce((a, b) => a + b, 0);
    if (totalAge === 0) {
      return [
        { name: '35-50 yosh', value: 45, color: '#1499AD' },
        { name: '25-34 yosh', value: 30, color: '#6366F1' },
        { name: '50+ yosh', value: 25, color: '#F59E0B' },
      ];
    }

    const colors = { '18-24 yosh': '#38BDF8', '25-34 yosh': '#6366F1', '35-50 yosh': '#1499AD', '50+ yosh': '#F59E0B' };
    return Object.entries(ageBuckets)
      .filter(([_, count]) => count > 0)
      .map(([name, count]) => ({
         name,
         value: Math.round((count / totalAge) * 100),
         color: colors[name] || '#94A3B8'
      }));
  }, [leads]);

  // ─── Dynamic Stats Calculator ───
  const calculatedStats = useMemo(() => {
    const total = leads.length;
    const converted = leads.filter(l => l.status?.toLowerCase() === 'converted' || l.status?.toLowerCase() === 'bemorga aylandi').length;
    const totalSpend = total * 32000; // Taxminiy CPL 32,000 so'm
    const avgCpl = total > 0 ? Math.round(totalSpend / total) : 0;
    
    return {
      total,
      converted,
      avgCpl: avgCpl > 0 ? `${(avgCpl / 1000).toFixed(1)}K` : '0',
      conversionRate: total > 0 ? ((converted / total) * 100).toFixed(1) : '0.0'
    };
  }, [leads]);

  return (
    <div className="flex flex-col gap-4 px-3 pb-24 pt-3 bg-[#F8FAFC] min-h-screen">
      {/* Executive Mobile Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase">Marketing</h1>
          <div className="flex items-center gap-1.5 mt-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Real-time Targeting</p>
          </div>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={handleSync}
                disabled={syncing}
                className="w-10 h-10 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-center text-slate-900 active:scale-90 transition-all disabled:opacity-50"
            >
                <RefreshCw className={syncing ? "w-4 h-4 animate-spin" : "w-4 h-4"} />
            </button>
        </div>
      </div>

      {/* Segment Switcher */}
      <div className="flex bg-slate-200/50 p-0.5 rounded-xl">
         {[
            { id: 'leads', label: 'Lidlar' },
            { id: 'overview', label: 'Dashboard' },
            { id: 'insights', label: 'Insights' },
            { id: 'settings', label: 'Sozlamalar' }
         ].map((seg) => (
            <button 
               key={seg.id}
               onClick={() => setActiveSegment(seg.id)}
               className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${activeSegment === seg.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
            >
               {seg.label}
            </button>
         ))}
      </div>

      <AnimatePresence mode="wait">
         {activeSegment === 'leads' && (
            <motion.div 
               key="leads"
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: -10 }}
               className="space-y-4"
            >
               <div className="flex items-center justify-between px-2 mb-2">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Marketing Lidlar Inbox</h3>
                  <div className="flex items-center gap-2">
                     <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                     <span className="text-[9px] font-black text-slate-500 uppercase">{leads.filter(l => {
                         const s = (l.source || '').toLowerCase();
                         return s.includes('instagram') || s.includes('facebook') || s.includes('ads') || s.includes('telegram') || s.includes('import') || s.includes('csv') || l.ad_name || (l.form_data && Object.keys(l.form_data).length > 0);
                     }).length} ta</span>
                  </div>
               </div>

               {loading ? (
                  <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-200" /></div>
               ) : leads.filter(l => {
                  const src = (l.source || '').toLowerCase();
                  return src.includes('ads') || 
                         src.includes('facebook') || 
                         src.includes('instagram') ||
                          src.includes('telegram') ||
                          src.includes('website') ||
                          src.includes('sayt') ||
                          src.includes('import') ||
                          src.includes('csv') ||
                          l.ad_name || (l.form_data && Object.keys(l.form_data).length > 0);
               }).length === 0 ? (
                  <div className="py-24 flex flex-col items-center justify-center bg-white border-2 border-dashed border-slate-100 rounded-2xl">
                     <ZapOff className="w-10 h-10 text-slate-200 mb-3" />
                     <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest text-center px-8 leading-relaxed">Marketing arizalari hali mavjud emas</p>
                  </div>
               ) : (
                  leads.filter(l => {
                     const src = (l.source || '').toLowerCase();
                     return src.includes('ads') || 
                            src.includes('facebook') || 
                            src.includes('instagram') ||
                             src.includes('telegram') ||
                             src.includes('website') ||
                             src.includes('sayt') ||
                             src.includes('import') ||
                             src.includes('csv') ||
                             l.ad_name || (l.form_data && Object.keys(l.form_data).length > 0);
                  }).map((l, i) => (
                     <motion.div 
                        key={l.id} 
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        onClick={() => setSelectedLead(l)}
                        className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-3 active:scale-[0.98] transition-all relative overflow-hidden"
                     >
                        {l.status?.toLowerCase() === 'new' && (
                           <div className="absolute top-0 right-0 w-6 h-6 bg-emerald-500/10 rounded-bl-xl flex items-center justify-center">
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                           </div>
                        )}
                        
                        <div className="flex items-center gap-3">
                           <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm ${ (l.source?.toLowerCase().includes('instagram') || l.source?.toLowerCase().includes('insta')) ? 'bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600' : 'bg-[#1877F2]' }`}>
                              { (l.source?.toLowerCase().includes('instagram') || l.source?.toLowerCase().includes('insta')) ? <Instagram className="w-4 h-4" /> : <Facebook className="w-4 h-4" /> }
                           </div>
                           <div className="min-w-0 flex-1">
                              <h4 className="font-black text-slate-900 text-xs uppercase truncate pr-4">{l.name || l.full_name}</h4>
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{l.phone || "Noma'lum"}</p>
                           </div>
                           <ChevronRight className="w-4 h-4 text-slate-200" />
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                           <div className="flex items-center gap-2">
                              <span className="text-[8px] font-black text-indigo-600 uppercase tracking-widest px-2 py-1 bg-indigo-50 rounded-lg">{l.source || 'Ads'}</span>
                              <span className="text-[8px] font-bold text-slate-300 uppercase">
                                 {l.created_date || l.created_at ? new Date(l.created_date || l.created_at).toLocaleDateString() : 'Yaqinda'}
                              </span>
                           </div>
                           <div className="flex gap-2">
                              <button onClick={(e) => { e.stopPropagation(); window.open(`tel:${l.phone}`, '_self'); }} className="p-2 bg-slate-900 text-white rounded-lg active:scale-90 transition-all font-bold">
                                 <Phone className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); window.open(`https://t.me/+${l.phone?.replace(/\D/g, '')}`, '_blank'); }} className="p-2 bg-white border border-slate-200 text-sky-500 rounded-lg active:scale-90 transition-all font-bold">
                                 <MessageCircle className="w-3.5 h-3.5" />
                              </button>
                           </div>
                        </div>
                     </motion.div>
                  ))
               )}
            </motion.div>
         )}

         {activeSegment === 'overview' && (
            <motion.div 
               key="overview"
               initial={{ opacity: 0, x: -10 }}
               animate={{ opacity: 1, x: 0 }}
               exit={{ opacity: 0, x: 10 }}
               className="space-y-6"
            >
               {/* High-Impact Stat Card */}
               <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-4 text-white shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-5 rotate-12 scale-150">
                     <Target className="w-16 h-16" />
                  </div>
                  
                  <div className="relative z-10">
                     <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/10 rounded-full border border-white/10 backdrop-blur-md">
                           <Zap className="w-3 h-3 text-amber-400" />
                           <span className="text-[8px] font-black uppercase tracking-widest">Active Ads</span>
                        </div>
                        <div className="flex -space-x-1">
                           <div className="w-6 h-6 rounded-full bg-[#1877F2] border border-slate-800 flex items-center justify-center shadow-lg"><Facebook className="w-3 h-3" /></div>
                           <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 border border-slate-800 flex items-center justify-center shadow-lg"><Instagram className="w-3 h-3" /></div>
                        </div>
                     </div>

                     <div className="grid grid-cols-2 gap-3">
                        <div>
                           <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Jami Lidlar</p>
                           <div className="flex items-center gap-1.5">
                              <h2 className="text-3xl font-black">{leads.length}</h2>
                              <div className="flex items-center text-emerald-400">
                                 <ArrowUpRight className="w-2.5 h-2.5" />
                                 <span className="text-[9px] font-bold">12%</span>
                              </div>
                           </div>
                        </div>
                        <div>
                           <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-0.5">CPL (O'rtacha)</p>
                           <div className="flex items-baseline gap-0.5">
                              <h2 className="text-xl font-black">{calculatedStats.avgCpl}</h2>
                              <span className="text-[9px] font-bold text-slate-400 uppercase">so'm</span>
                           </div>
                        </div>
                     </div>
                  </div>
               </div>

               {/* Mini Chart */}
               <Card className="p-4 rounded-2xl border-none shadow-xl shadow-slate-200/50 bg-white">
                  <div className="flex items-center justify-between mb-3">
                     <h3 className="text-[9px] font-black text-slate-900 uppercase tracking-widest">Haftalik Dinamika</h3>
                     <Activity className="w-3.5 h-3.5 text-[#1499AD]" />
                  </div>
                  <div className="h-28 w-full">
                     <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                           <defs>
                              <linearGradient id="mLeads" x1="0" y1="0" x2="0" y2="1">
                                 <stop offset="5%" stopColor="#1499AD" stopOpacity={0.2}/>
                                 <stop offset="95%" stopColor="#1499AD" stopOpacity={0}/>
                              </linearGradient>
                           </defs>
                           <Area type="monotone" dataKey="leads" stroke="#1499AD" strokeWidth={3} fill="url(#mLeads)" />
                        </AreaChart>
                     </ResponsiveContainer>
                  </div>
               </Card>

               {/* Recent Leads */}
               <div className="space-y-3">
                  <div className="flex items-center justify-between px-2">
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">So'nggi arizalar</span>
                     <button className="text-[10px] font-black text-indigo-600 uppercase">Barchasi</button>
                  </div>
                  
                  {loading ? (
                     <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-200" /></div>
                  ) : leads.map((l, i) => (
                     <motion.div 
                        key={i} 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between active:scale-[0.98] transition-all"
                     >
                        <div className="flex items-center gap-4">
                           <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-500 shrink-0">
                              <Users className="w-4 h-4" />
                           </div>
                           <div className="truncate pr-2">
                              <p className="font-black text-slate-900 text-xs uppercase truncate max-w-[150px]">{l.name}</p>
                              <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{l.phone || "Noma'lum"}</p>
                           </div>
                        </div>
                        <div className="text-right shrink-0">
                           <span className="text-[8px] font-black text-emerald-500 uppercase px-2 py-0.5 bg-emerald-50 rounded-md">Yangi</span>
                        </div>
                     </motion.div>
                  ))}
               </div>
            </motion.div>
         )}

         {activeSegment === 'insights' && (
            <motion.div 
               key="insights"
               initial={{ opacity: 0, x: -10 }}
               animate={{ opacity: 1, x: 0 }}
               exit={{ opacity: 0, x: 10 }}
               className="space-y-4"
            >
               <Card className="p-4 rounded-2xl border-none shadow-xl shadow-slate-200/50 bg-white">
                  <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-4">Auditoriya Yoshida</h3>
                  <div className="h-40 w-full flex items-center justify-center">
                     <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                           <Pie
                              data={audienceData}
                              innerRadius={35}
                              outerRadius={60}
                              paddingAngle={6}
                              dataKey="value"
                           >
                              {audienceData.map((entry, index) => (
                                 <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                           </Pie>
                        </PieChart>
                     </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                     {audienceData.map((a, i) => (
                        <div key={i} className="p-2.5 bg-slate-50 rounded-xl flex items-center justify-between">
                           <span className="text-[9px] font-black uppercase text-slate-500">{a.name}</span>
                           <span className="text-xs font-black text-slate-900">{a.value}%</span>
                        </div>
                     ))}
                  </div>
               </Card>

               <Card className="p-4 bg-slate-900 rounded-2xl text-white shadow-2xl">
                  <div className="flex gap-3">
                     <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center shrink-0">
                        <Zap className="w-4.5 h-4.5 text-amber-400" />
                     </div>
                     <p className="text-[10px] font-bold text-white/70 leading-relaxed">
                        <span className="text-white font-black block text-xs uppercase mb-0.5">AI Maslahat</span>
                        Implantat xizmati uchun 35+ yosh auditoriyasiga urg'u bering. Konversiya bu segmentda 2x yuqori.
                     </p>
                  </div>
               </Card>
            </motion.div>
         )}

         {activeSegment === 'settings' && (
            <motion.div 
               key="settings"
               initial={{ opacity: 0, x: -10 }}
               animate={{ opacity: 1, x: 0 }}
               exit={{ opacity: 0, x: 10 }}
               className="space-y-4"
            >
               <div className="bg-white border-none p-4 rounded-2xl shadow-xl shadow-slate-200/50 space-y-3">
                  <div className="flex items-center gap-3 mb-2">
                     <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 shrink-0">
                        <Server className="w-5 h-5" />
                     </div>
                     <div>
                        <h4 className="font-black text-slate-900 text-sm uppercase tracking-tight">API Sozlamalari</h4>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Integratsiya uchun</p>
                     </div>
                  </div>

                  {[
                     { label: 'Webhook URL', value: `${supabaseUrl}/rest/v1/leads`, id: 'url' },
                     { label: 'API Key', value: supabaseAnonKey, id: 'key', mask: true },
                     { label: 'Klinika ID', value: clinicId, id: 'clinic' }
                  ].map((item) => (
                     <div key={item.id} className="space-y-1">
                        <div className="flex justify-between items-center px-1">
                           <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest">{item.label}</span>
                           <button onClick={() => navigator.clipboard.writeText(item.value)} className="p-1 px-1.5 bg-indigo-50 text-indigo-600 rounded-md text-[8px] font-black uppercase">Nusxa</button>
                        </div>
                        <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl">
                           <code className="text-[10px] font-mono text-slate-500 block truncate leading-none">
                              {item.mask ? `${item.value.substring(0, 20)}...` : item.value}
                           </code>
                        </div>
                     </div>
                  ))}
               </div>

               <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                  <div>
                     <p className="text-xs font-black text-emerald-900 uppercase">Tizim Faol</p>
                     <p className="text-[10px] font-medium text-emerald-700/80 leading-relaxed mt-0.5">Hozirda Facebook va Instagramdan arizalar avtomatik qabul qilinmoqda.</p>
                  </div>
               </div>
            </motion.div>
         )}
       </AnimatePresence>

       <LeadQuickView 
         lead={selectedLead} 
         isOpen={!!selectedLead} 
         onClose={() => setSelectedLead(null)} 
       />
    </div>
  );
}
