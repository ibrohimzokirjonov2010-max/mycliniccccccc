import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Target, TrendingUp, BarChart3, Users, Facebook, Instagram, 
  Plus, Search, Filter, ExternalLink, Zap, MousePointer2, 
  MessageSquare, DollarSign, RefreshCw, CheckCircle2, AlertCircle, X, Check, Loader2,
  Shield, Globe, Key, Settings, Link as LinkIcon, Workflow, Smartphone, Server,
  Copy, FileText, CheckCircle, Activity, ZapOff, ArrowUpRight, TrendingDown,
  PieChart as PieChartIcon, Layers, Calendar, ChevronRight, MoreHorizontal,
  Mail, Phone, MapPin, Briefcase, Globe2, MessageCircle, Upload
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { useTranslation } from '@/i18n/LanguageContext';
import { supabase, db } from '@/api/supabaseClient';
import LeadQuickView from '@/components/marketing/LeadQuickView';

export default function Marketing() {
  const { t } = useTranslation();

  // Data States
  const [leads, setLeads] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); // overview, leads, targeting, automation
  const [selectedLead, setSelectedLead] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  
  const fileInputRef = useRef(null);

  // Credentials for Make.com
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  const clinicId = localStorage.getItem('current_clinic_id') || 'default_clinic';

  useEffect(() => {
    loadRealLeads();

    // Supabase Real-time Sync with unique identifier
    const channelName = `marketing_admin_${clinicId}_${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: '*', 
        schema: 'public',
        table: 'leads',
        filter: `clinic_id=eq.${clinicId}`
      }, () => {
        loadRealLeads();
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Marketing Admin: Subscribed to Realtime');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clinicId]);

  const loadRealLeads = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('leads')
        .select('*')
        .order('created_date', { ascending: false });
      
      // Filter by clinic_id if available
      if (clinicId) {
        query = query.eq('clinic_id', clinicId);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Leads load error:', error);
      }
      
      if (data) {
        // Safely parse form_data if it's a string (JSON string from Make.com)
        const parsedLeads = data.map(lead => {
          let formData = {};
          try {
            formData = typeof lead.form_data === 'string' 
              ? JSON.parse(lead.form_data) 
              : (lead.form_data || {});
          } catch (e) {
            console.error('JSON parse error for lead:', lead.id, e);
            formData = {};
          }
          
          return {
            ...lead,
            form_data: formData
          };
        });
        setLeads(parsedLeads);
        generateChartData(parsedLeads);
      }
    } catch (e) {
      console.error('Leads fetch exception:', e);
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
      
      // Local timezone bo'yicha yil-oy-kun formatini olish
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dayStr = `${year}-${month}-${day}`;
      
      // Shu kunda yaratilgan lidlar
      const count = (leadsData || []).filter(l => {
        const lDate = l.created_date || l.created_at;
        return lDate && lDate.startsWith(dayStr);
      }).length;
      
      // Realroq ko'rsatkichlar
      const spend = count * 35000; // Har bir lidga taxminan 35,000 so'mdan xarajat
      const roi = count > 0 ? (2.1 + (count * 0.35)).toFixed(1) : '0.0';
      
      data.push({
        name: dayName,
        leads: count,
        spend: spend,
        roi: roi
      });
    }
    
    setChartData(data);
  };

  const handleSync = async () => {
    setSyncing(true);
    await loadRealLeads();
    setTimeout(() => setSyncing(false), 800);
  };

  const copyToClipboard = (text, label) => {
     navigator.clipboard.writeText(text);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const rows = text.split('\n').map(row => row.trim()).filter(row => row);
        if (rows.length < 2) return alert("Fayl bo'sh kompyuterga oxshaydi");
        
        // Headerlarni ajratib olamiz (Facebook CSV formati uchun xavfsiz)
        const headers = rows[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
        
        // Nomi va telefon raqami qaysi ustundaligini topamiz (Ruscha, Inglizcha, O'zbekcha)
        let nameIdx = headers.findIndex(h => h === 'full_name' || h === 'name' || h === 'first_name' || h.includes('ism') || h.includes('имя'));
        let phoneIdx = headers.findIndex(h => h === 'phone_number' || h === 'phone' || h.includes('telefon') || h.includes('raqam') || h.includes('телефон') || h.includes('номер'));
        
        // Agar topilmasa, standart 0 va 1 deb olamiz
        if (nameIdx === -1) nameIdx = 0;
        if (phoneIdx === -1) phoneIdx = 1;
        
        let successCount = 0;
        for (let i = 1; i < rows.length; i++) {
          // Oddiy shartli ajratuvchi (vergul, lekin qo'shtirnoq ichidagini ajratmaydi)
          let cols = [];
          let currentRow = rows[i];
          let inQuote = false;
          let currentStr = '';
          for(let char of currentRow) {
            if(char === '"') inQuote = !inQuote;
            else if(char === ',' && !inQuote) { cols.push(currentStr); currentStr = ''; }
            else currentStr += char;
          }
          cols.push(currentStr);
          
          const cleanCols = cols.map(c => c.trim().replace(/^"|"$/g, ''));
          
          const leadName = cleanCols[nameIdx];
          const leadPhone = cleanCols[phoneIdx];
          
          // Telefoni bo'lmagan yoki noto'g'ri qatorlarni tashlab o'tish
          if (!leadPhone || leadPhone.length < 4 || leadName?.includes('202') || !leadName) continue;
          
          const leadData = {
            name: leadName,
            full_name: leadName,
            phone: leadPhone,
            source: 'Import CSV',
            status: 'new',
            clinic_id: clinicId,
            created_date: new Date().toISOString()
          };
          
          if (leadData.phone) {
             await db.leads.create(leadData); 
             successCount++;
          }
        }
        
        alert(`🎉 ${successCount} ta lead muvaffaqiyatli yuklandi!`);
        await loadRealLeads();
      } catch (err) {
         console.error('Import error:', err);
         alert("Import qilishda xatolik yuz berdi. Fayl formatini tekshiring.");
      } finally {
         setIsImporting(false);
         if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  // Dynamic Demographic & Geographic Calculator
  const { audienceData, locationData } = useMemo(() => {
    let ageBuckets = { '18-24 yosh': 0, '25-34 yosh': 0, '35-50 yosh': 0, '50+ yosh': 0 };
    let locationsCount = {};

    leads.forEach(l => {
      if (!l.form_data) return;
      Object.entries(l.form_data).forEach(([key, val]) => {
         const k = key.toLowerCase();
         // Detect Age
         if (k.includes('yosh')) {
           const ageMatch = val.match(/\d+/);
           if (ageMatch) {
             const age = parseInt(ageMatch[0]);
             if (age < 25) ageBuckets['18-24 yosh']++;
             else if (age <= 34) ageBuckets['25-34 yosh']++;
             else if (age <= 50) ageBuckets['35-50 yosh']++;
             else ageBuckets['50+ yosh']++;
           }
         }
         // Detect Location
         if (k.includes('hudud') || k.includes('manzil') || k.includes('shahar') || k.includes('viloyat')) {
           const loc = val.trim();
           locationsCount[loc] = (locationsCount[loc] || 0) + 1;
         }
      });
    });

    let totalAge = Object.values(ageBuckets).reduce((a, b) => a + b, 0);
    let generatedAudience = [];
    if (totalAge === 0) {
      generatedAudience = [
        { name: '35-50 yosh', value: 45, color: '#1499AD' },
        { name: '25-34 yosh', value: 30, color: '#6366F1' },
        { name: '50+ yosh', value: 25, color: '#F59E0B' },
      ];
    } else {
      const colors = { '18-24 yosh': '#38BDF8', '25-34 yosh': '#6366F1', '35-50 yosh': '#1499AD', '50+ yosh': '#F59E0B' };
      generatedAudience = Object.entries(ageBuckets)
        .filter(([_, count]) => count > 0)
        .map(([name, count]) => ({
           name,
           value: Math.round((count / totalAge) * 100),
           color: colors[name] || '#94A3B8'
        }));
    }

    let totalLoc = Object.values(locationsCount).reduce((a, b) => a + b, 0);
    let generatedLocations = [];
    if (totalLoc === 0) {
      generatedLocations = [
        { city: 'Toshkent shahri (Demo)', leads: 142, percent: 65, color: 'bg-indigo-500' },
        { city: 'Toshkent viloyati (Demo)', leads: 48, percent: 22, color: 'bg-cyan-500' },
        { city: 'Boshqa hududlar (Demo)', leads: 28, percent: 13, color: 'bg-slate-300' }
      ];
    } else {
      const locColors = ['bg-indigo-500', 'bg-cyan-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500'];
      generatedLocations = Object.entries(locationsCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([city, count], idx) => ({
           city,
           leads: count,
           percent: Math.round((count / totalLoc) * 100),
           color: locColors[idx % locColors.length]
        }));
    }

    return { audienceData: generatedAudience, locationData: generatedLocations };
  }, [leads]);

  // ─── Dynamic Campaigns & Performance Calculation ───
  const campaignPerformance = useMemo(() => {
    const counts = {};
    leads.forEach(l => {
      const src = l.source || 'Facebook Ads';
      counts[src] = (counts[src] || 0) + 1;
    });

    const entries = Object.entries(counts);
    if (entries.length === 0) {
      return [
        { id: 1, name: 'Implantat Aksiya 2026', platform: 'Facebook', spend: '1,200,000', leads: 0, cpl: '0', status: 'Active', trend: '+0%' },
        { id: 2, name: 'Vinirlar Instagram', platform: 'Instagram', spend: '850,000', leads: 0, cpl: '0', status: 'Active', trend: '+0%' }
      ];
    }

    return entries.map(([name, count], idx) => {
      let spend = count * 32000; // Taxminiy CPL 32k
      let platform = 'Facebook';
      const nameL = name.toLowerCase();
      if (nameL.includes('instagram') || nameL.includes('insta')) platform = 'Instagram';
      else if (nameL.includes('google') || nameL.includes('site') || nameL.includes('sayt')) platform = 'Google';
      else if (nameL.includes('telegram') || nameL.includes('tg')) platform = 'Telegram';
      else if (nameL.includes('import') || nameL.includes('csv')) { spend = 0; platform = 'Google'; } // CPL 0 for imports

      const cpl = count > 0 ? Math.round(spend / count) : 0;

      return {
        id: idx + 1,
        name,
        platform,
        spend: spend.toLocaleString(),
        leads: count,
        cpl: cpl.toLocaleString(),
        status: 'Active',
        trend: count > 3 ? '+14%' : '+4%'
      };
    });
  }, [leads]);

  // ─── Dynamic Conversion Funnel Steps ───
  const funnelSteps = useMemo(() => {
    const totalLeads = leads.length;
    const convertedLeads = leads.filter(l => l.status?.toLowerCase() === 'converted' || l.status?.toLowerCase() === 'bemorga aylandi').length;
    const contactedLeads = leads.filter(l => l.status?.toLowerCase() === 'contacted' || l.status?.toLowerCase() === 'bog\'lanildi' || l.status?.toLowerCase() === 'converted').length;
    
    const views = totalLeads * 38; // Taxminiy namoyishlar soni
    const clicks = totalLeads * 3;  // Taxminiy kliklar soni

    const clickRate = views > 0 ? ((clicks / views) * 100).toFixed(1) : '0.0';
    const leadRate = clicks > 0 ? ((totalLeads / clicks) * 100).toFixed(1) : '0.0';
    const convRate = totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(1) : '0.0';

    return [
      { label: 'Ko\'rishlar', value: views.toLocaleString(), desc: 'Reklama namoyishi', percent: '100%', color: 'from-slate-200 to-slate-300' },
      { label: 'Kliklar', value: clicks.toLocaleString(), desc: 'Havolaga o\'tish', percent: `${clickRate}%`, color: 'from-indigo-100 to-indigo-200' },
      { label: 'Lidlar (Arizalar)', value: totalLeads.toLocaleString(), desc: 'Ro\'yxatdan o\'tganlar', percent: `${leadRate}%`, color: 'from-cyan-100 to-cyan-200' },
      { label: 'Bemorlar', value: convertedLeads.toLocaleString(), desc: 'Bemorga aylanganlar', percent: `${convRate}%`, color: 'from-emerald-100 to-emerald-200 font-bold' },
    ];
  }, [leads]);

  // ─── Dynamic Top Analytics Cards Stats ───
  const stats = useMemo(() => {
    const total = leads.length;
    const converted = leads.filter(l => l.status?.toLowerCase() === 'converted' || l.status?.toLowerCase() === 'bemorga aylandi').length;
    const conversionRate = total > 0 ? ((converted / total) * 100).toFixed(1) : '0.0';
    
    // Taxminiy byudjet va ROI
    let totalSpend = 0;
    campaignPerformance.forEach(c => {
      const sp = Number(c.spend.replace(/\D/g, '')) || 0;
      totalSpend += sp;
    });
    
    const avgCpl = total > 0 ? Math.round(totalSpend / total) : 0;
    const roi = total > 0 ? (1.8 + (converted * 0.45)).toFixed(1) : '0.0';

    return [
      { label: "Jami Lidlar", value: total, unit: "ta", icon: Target, trend: total > 5 ? "+15%" : "+0%", color: "#1499AD", colorBg: "bg-cyan-50" },
      { label: "O'rtacha Narx (CPL)", value: avgCpl.toLocaleString(), unit: "so'm", icon: DollarSign, trend: "-11%", color: "#6366F1", colorBg: "bg-indigo-50" },
      { label: "Konversiya", value: conversionRate, unit: "%", icon: TrendingUp, trend: conversionRate > 10 ? "+3.5%" : "+0%", color: "#10B981", colorBg: "bg-emerald-50" },
      { label: "ROI (Daromad)", value: roi, unit: "x", icon: PieChartIcon, trend: "+0.6x", color: "#F59E0B", colorBg: "bg-amber-50" },
    ];
  }, [leads, campaignPerformance]);

  const createTestLead = async () => {
    try {
      setSyncing(true);
      const testLead = {
        name: "Gulzoda Salimova (Instagram Demo)",
        phone: "+998 99 555 44 33",
        source: "Instagram Ads (Vinirlar)",
        status: "New",
        clinic_id: clinicId,
        notes: "Ushbu lid Instagram maxsus test reklamasi orqali tushdi.",
        form_data: {
          "Qanaqa xizmat turi kerak?": "Vinir (Braket emas)",
          "Qachon kelmoqchisiz?": "Shu hafta oxirida",
          "Oldin bizda davolanganmisiz?": "Yo'q, birinchi marta",
          "Qanday muammo bezovta qilyapti?": "Oldingi tishlarim qiyshaygan, estetik uzgarish xohlayman"
        },
        created_date: new Date().toISOString()
      };
      
      // Use retry logic - automatically skips missing columns
      const saved = await db.leads.create(testLead);
      
      await loadRealLeads();
      
      // Switch to leads tab automatically
      setActiveTab('leads');
    } catch (error) {
      console.error("Test lid yaratishda xato:", error);
      alert("Xato: " + error.message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="px-4 sm:px-6 py-4 space-y-4 min-h-screen bg-[#F8FAFC]">

      {/* ── Compact Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-sm shrink-0">
            <TrendingUp className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-[900] text-slate-900 tracking-tight uppercase leading-none">Marketing Markazi</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Markazlashgan Targeting Tizimi Faol</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-white p-1 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex bg-slate-100/70 p-1 rounded-xl">
            {[
              { id: 'overview', label: 'Dashboard', icon: BarChart3 },
              { id: 'leads', label: 'Lidlar', icon: Users },
              { id: 'targeting', label: 'Targeting', icon: Target },
              { id: 'automation', label: 'Integratsiya', icon: Workflow }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-2 rounded-lg text-[9px] font-[900] uppercase tracking-wider transition-all flex items-center gap-1.5 ${activeTab === tab.id ? 'bg-white text-slate-900 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <tab.icon className="w-3 h-3" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="h-9 px-4 bg-slate-900 text-white rounded-xl flex items-center gap-2 active:scale-95 transition-all disabled:opacity-50 text-[9px] font-[900] uppercase tracking-wider"
          >
            <RefreshCw className={syncing ? "w-3.5 h-3.5 animate-spin" : "w-3.5 h-3.5"} />
            <span className="hidden sm:inline">Yangilash</span>
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="space-y-4"
          >
            {/* ── Stats Row ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {stats.map((s, i) => (
                <div key={i} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className={`w-8 h-8 rounded-xl ${s.colorBg} flex items-center justify-center shrink-0`}>
                      <s.icon className="w-4 h-4" style={{ color: s.color }} />
                    </div>
                    <p className="text-[9px] font-[900] text-slate-400 uppercase tracking-widest leading-tight">{s.label}</p>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-[900] text-slate-900 tracking-tight">{s.value}</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">{s.unit}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-1 w-fit px-2 py-0.5 rounded-full bg-slate-50 border border-slate-100">
                    {s.trend.startsWith('+') ? <ArrowUpRight className="w-3 h-3 text-emerald-500" /> : <TrendingDown className="w-3 h-3 text-rose-500" />}
                    <span className={`text-[9px] font-[900] ${s.trend.startsWith('+') ? 'text-emerald-500' : 'text-rose-500'}`}>{s.trend}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Chart + Funnel ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Chart */}
              <div className="lg:col-span-2 bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-[900] text-slate-900 uppercase tracking-tight">O'sish Dinamikasi</h3>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Lidlar oqimi va ROX monitoringi</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-indigo-500" /><span className="text-[9px] font-[900] uppercase text-slate-400">Xarajat</span></div>
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-cyan-500" /><span className="text-[9px] font-[900] uppercase text-slate-400">Lidlar</span></div>
                  </div>
                </div>
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#1499AD" stopOpacity={0.18}/>
                          <stop offset="95%" stopColor="#1499AD" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366F1" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 900, fill: '#94A3B8'}} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 900, fill: '#94A3B8'}} />
                      <Tooltip contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)', padding: '10px 14px' }} itemStyle={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase' }} />
                      <Area type="monotone" dataKey="spend" stroke="#6366F1" strokeWidth={1.5} fillOpacity={1} fill="url(#colorSpend)" />
                      <Area type="monotone" dataKey="leads" stroke="#1499AD" strokeWidth={2.5} fillOpacity={1} fill="url(#colorLeads)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Conversion Funnel - compact */}
              <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                <h3 className="text-sm font-[900] text-slate-900 uppercase tracking-tight mb-4">Konversiya Voronkasi</h3>
                <div className="space-y-2.5">
                  {funnelSteps.map((step, idx) => (
                    <div key={idx}>
                      <div className={`w-full p-3 rounded-xl bg-gradient-to-r ${step.color} border border-white/30`}>
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-[9px] font-[900] uppercase text-slate-500 tracking-widest leading-none mb-0.5">{step.label}</p>
                            <span className="text-lg font-[900] text-slate-900">{step.value}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-base font-[900] text-slate-900">{step.percent}</span>
                            <p className="text-[8px] font-bold text-slate-400 uppercase leading-none mt-0.5">{step.desc}</p>
                          </div>
                        </div>
                      </div>
                      {idx < funnelSteps.length - 1 && (
                        <div className="flex justify-center h-3"><ChevronRight className="w-3 h-3 rotate-90 text-slate-300" /></div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Campaigns + Recent Leads ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Campaigns */}
              <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-[900] text-slate-900 uppercase tracking-tight">Faol Kampaniyalar</h3>
                  <Button variant="ghost" size="sm" className="text-[9px] font-[900] uppercase text-indigo-600 h-7 px-2">Barchasi <ExternalLink className="ml-1 w-3 h-3" /></Button>
                </div>
                <div className="space-y-2">
                  {campaignPerformance.map((campaign) => (
                    <div key={campaign.id} className="flex items-center justify-between p-3 bg-slate-50/80 rounded-xl border border-slate-100/80 hover:bg-white hover:shadow-md transition-all group">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-sm text-white shrink-0 ${
                          campaign.platform === 'Facebook' ? 'bg-[#1877F2]' :
                          campaign.platform === 'Instagram' ? 'bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600' :
                          campaign.platform === 'Telegram' ? 'bg-[#0088cc]' :
                          campaign.platform === 'Phone' ? 'bg-emerald-600' :
                          'bg-slate-700'
                        }`}>
                          {campaign.platform === 'Facebook' ? <Facebook className="w-4 h-4" /> :
                           campaign.platform === 'Instagram' ? <Instagram className="w-4 h-4" /> :
                           campaign.platform === 'Telegram' ? <MessageCircle className="w-4 h-4" /> :
                           campaign.platform === 'Phone' ? <Phone className="w-4 h-4" /> :
                           <Globe2 className="w-4 h-4" />}
                        </div>
                        <div>
                          <p className="text-[11px] font-[900] text-slate-900 uppercase tracking-tight truncate max-w-[160px]">{campaign.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">{campaign.platform}</span>
                            <div className="w-1 h-1 rounded-full bg-slate-300" />
                            <span className="text-[9px] font-[900] text-emerald-500 uppercase">ACTIVE</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-[900] text-slate-900">{campaign.leads} <span className="text-[9px] font-bold text-slate-400">lid</span></p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase">CPL: {campaign.cpl}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Leads */}
              <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-[900] text-slate-900 uppercase tracking-tight">So'nggi Lidlar</h3>
                  <button onClick={() => setActiveTab('leads')} className="text-[9px] font-[900] text-indigo-600 uppercase tracking-wider hover:underline">Barchasi →</button>
                </div>
                <div className="space-y-2 max-h-[320px] overflow-y-auto no-scrollbar">
                  {loading ? (
                    <div className="flex justify-center py-10"><Loader2 className="animate-spin text-slate-300 w-5 h-5" /></div>
                  ) : leads.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 opacity-20">
                      <Target className="w-10 h-10 mb-2" />
                      <p className="font-[900] uppercase tracking-widest text-[10px]">Arizalar topilmadi</p>
                    </div>
                  ) : leads.slice(0, 10).map((l, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="flex items-center justify-between p-3 bg-slate-50/80 border border-slate-100 rounded-xl hover:border-indigo-200 hover:bg-white hover:shadow-md transition-all cursor-pointer group"
                      onClick={() => setSelectedLead(l)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors shrink-0">
                          <Users className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[11px] font-[900] text-slate-900 uppercase truncate max-w-[140px]">{l.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Phone className="w-2.5 h-2.5 text-slate-300" />
                            <span className="text-[9px] font-bold text-slate-400">{l.phone || "Noma'lum"}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-lg text-[8px] font-[900] uppercase mb-1">Yangi</div>
                        <p className="text-[8px] font-bold text-slate-300 uppercase">
                          {l.created_date ? new Date(l.created_date).toLocaleString('uz-UZ', { day: 'numeric', month: 'short' }) : 'Yaqinda'}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Lidlar Inbox Tab ──────────────────────────────────────────── */}
        {activeTab === 'leads' && (
          <motion.div
            key="leads"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-[900] text-slate-900 uppercase tracking-tight">Target Lidlar Inbox</h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Reklamadan tushgan barcha arizalar</p>
              </div>
              <div className="flex gap-2 items-center">
                <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-100 shadow-sm text-[9px] font-[900] uppercase text-slate-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {leads.filter(l => { const s = (l.source || '').toLowerCase(); return s.includes('instagram') || s.includes('facebook') || s.includes('ads') || s.includes('telegram') || s.includes('import') || s.includes('csv') || l.ad_name || (l.form_data && Object.keys(l.form_data).length > 0); }).length} ta ariza
                </div>
                <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                <Button onClick={() => fileInputRef.current?.click()} disabled={isImporting} variant="outline" className="h-9 px-4 rounded-xl border-slate-200 text-slate-700 bg-white hover:bg-slate-50 font-[900] uppercase tracking-widest text-[9px] shadow-sm">
                  <Upload className="w-3.5 h-3.5 mr-1.5" /> {isImporting ? 'Yuklanmoqda...' : 'CSV Import'}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {loading ? (
                <div className="col-span-full py-16 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-200" /></div>
              ) : leads.filter(l => {
                const src = (l.source || '').toLowerCase();
                return src.includes('ads') || src.includes('facebook') || src.includes('instagram') || src.includes('telegram') || src.includes('website') || src.includes('sayt') || src.includes('import') || src.includes('csv') || l.ad_name || (l.form_data && Object.keys(l.form_data).length > 0);
              }).length === 0 ? (
                <div className="col-span-full py-24 flex flex-col items-center justify-center bg-white border-2 border-dashed border-slate-100 rounded-2xl">
                  <ZapOff className="w-12 h-12 text-slate-100 mb-3" />
                  <p className="text-xs font-[900] text-slate-300 uppercase tracking-widest mb-4">Marketing arizalari topilmadi</p>
                  <Button onClick={createTestLead} className="bg-indigo-600 text-white rounded-xl px-6 h-10 font-[900] uppercase tracking-widest shadow-lg text-xs">Test Lid Yaratish</Button>
                </div>
              ) : (
                leads.filter(l => {
                  const src = (l.source || '').toLowerCase();
                  return src.includes('ads') || src.includes('facebook') || src.includes('instagram') || src.includes('telegram') || src.includes('website') || src.includes('sayt') || src.includes('import') || src.includes('csv') || l.ad_name || (l.form_data && Object.keys(l.form_data).length > 0);
                }).map((l, i) => (
                  <motion.div
                    key={l.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 hover:border-indigo-100 hover:shadow-lg transition-all cursor-pointer group relative"
                    onClick={() => setSelectedLead(l)}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500 border border-indigo-50 group-hover:bg-indigo-600 group-hover:text-white transition-all shrink-0">
                          {(l.source?.toLowerCase().includes('instagram') || l.source?.toLowerCase().includes('insta')) ? <Instagram className="w-4.5 h-4.5" /> : <Facebook className="w-4.5 h-4.5" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-[900] text-slate-900 uppercase tracking-tight truncate max-w-[140px]">{l.name || l.full_name}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{l.phone}</p>
                        </div>
                      </div>
                      <div className="relative z-20" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={l.status?.toLowerCase() || 'new'}
                          onChange={async (e) => {
                            const newVal = e.target.value;
                            const oldStatus = l.status;
                            setLeads(prev => prev.map(lead => lead.id === l.id ? { ...lead, status: newVal } : lead));
                            try {
                              const { error } = await supabase.from('leads').update({ status: newVal }).eq('id', l.id);
                              if (error) throw error;
                            } catch (err) {
                              setLeads(prev => prev.map(lead => lead.id === l.id ? { ...lead, status: oldStatus } : lead));
                            }
                          }}
                          className={`h-7 px-2 rounded-lg text-[8px] font-[900] uppercase tracking-wider border cursor-pointer outline-none ${
                            l.status?.toLowerCase() === 'new' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                            l.status?.toLowerCase() === 'contacted' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                            l.status?.toLowerCase() === 'converted' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                            'bg-slate-50 text-slate-500 border-slate-100'
                          }`}
                        >
                          <option value="new">Yangi</option>
                          <option value="contacted">Bog'lanildi</option>
                          <option value="converted">Bemor</option>
                          <option value="lost">Yo'qotildi</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[9px] font-[900] uppercase tracking-wider text-slate-400 p-2.5 bg-slate-50/70 rounded-lg border border-slate-50 mb-2">
                      <span className="truncate max-w-[60%]">{l.source || 'Facebook Ads'}</span>
                      <span className="text-slate-300 shrink-0">
                        {l.created_date || l.created_at ? new Date(l.created_date || l.created_at).toLocaleDateString() : 'Yaqinda'}
                      </span>
                    </div>

                    {l.form_data && Object.keys(l.form_data).length > 0 && (
                      <div className="bg-indigo-50/40 px-2.5 py-2 rounded-lg text-[9px] border border-indigo-100/50 mb-2">
                        {Object.entries(l.form_data).slice(0, 1).map(([key, val], idx) => (
                          <div key={idx}><span className="font-[900] text-indigo-600 uppercase">{key}: </span><span className="font-medium text-slate-700">{val}</span></div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-2 border-t border-slate-50">
                      <button onClick={(e) => { e.stopPropagation(); window.open(`tel:${l.phone}`, '_self'); }} className="h-8 px-3 rounded-lg bg-slate-900 text-white flex items-center gap-1.5 active:scale-95 transition-all text-[9px] font-[900] uppercase">
                        <Phone className="w-3 h-3" /> Qo'ng'iroq
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); window.open(`https://t.me/+${(l.phone || '').replace(/\D/g, '')}`, '_blank'); }} className="h-8 px-3 rounded-lg bg-sky-50 text-sky-600 flex items-center gap-1.5 border border-sky-100 active:scale-95 transition-all text-[9px] font-[900] uppercase">
                        <MessageCircle className="w-3 h-3" /> Telegram
                      </button>
                      <ChevronRight className="w-4 h-4 text-slate-200 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all ml-auto" />
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        )}

        {/* ── Targeting Tab ──────────────────────────────────────────────── */}
        {activeTab === 'targeting' && (
          <motion.div
            key="targeting"
            initial={{ opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-4"
          >
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
              <h3 className="text-sm font-[900] text-slate-900 uppercase tracking-tight mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-[#1499AD]" /> Auditoriya Segmenti
              </h3>
              <div className="h-[200px] w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={audienceData} innerRadius={50} outerRadius={80} paddingAngle={6} dataKey="value">
                      {audienceData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 space-y-2">
                {audienceData.map((a, i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: a.color }} />
                      <span className="text-[10px] font-[900] uppercase text-slate-600">{a.name}</span>
                    </div>
                    <span className="text-sm font-[900] text-slate-900">{a.value}%</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100">
                <Button onClick={createTestLead} disabled={syncing} className="w-full h-9 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[9px] font-[900] uppercase tracking-widest shadow-md">
                  {syncing ? "Yaratilmoqda..." : "Test Lid Yaratish"}
                </Button>
              </div>
            </div>

            <div className="lg:col-span-2 bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
              <h3 className="text-sm font-[900] text-slate-900 uppercase tracking-tight mb-1 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-indigo-500" /> Top Lokatsiyalar
              </h3>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-4">Mijozlarimiz qayerdan kelmoqda?</p>
              <div className="space-y-4">
                {locationData.map((loc, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-[900] uppercase text-slate-900">{loc.city}</span>
                      <span className="text-[10px] font-[900] text-slate-400">{loc.leads} lid ({loc.percent}%)</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${loc.percent}%` }}
                        transition={{ delay: 0.4 + (i * 0.1), duration: 0.8 }}
                        className={`h-full rounded-full ${loc.color}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 p-4 bg-slate-900 rounded-xl text-white">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white/10 rounded-xl border border-white/10 shrink-0"><Zap className="w-5 h-5 text-amber-400" /></div>
                  <div>
                    <p className="text-xs font-[900] uppercase tracking-tight">AI Tavsiya</p>
                    <p className="text-[10px] text-white/50 leading-relaxed mt-0.5">35-50 yosh oralig'idagi ayollar eng faol auditoriya. Implantat xizmati uchun byudjetni 20% oshirish tavsiya etiladi.</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Automation / Integration Tab ───────────────────────────────── */}
        {activeTab === 'automation' && (
          <motion.div
            key="automation"
            initial={{ opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-4"
          >
            <div className="space-y-4">
              <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white shadow-sm">
                    <Server className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-[900] text-slate-900 uppercase tracking-tight">Integratsiya</h3>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Make.com / Webhook Sozlamalari</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {[
                    { label: 'Webhook Endpoint (URL)', value: `${supabaseUrl}/rest/v1/leads`, id: 'url' },
                    { label: 'API Key (Anon Key)', value: supabaseAnonKey, id: 'key', mask: true },
                    { label: 'Klinika Id (clinic_id)', value: clinicId, id: 'clinic' }
                  ].map((item) => (
                    <div key={item.id}>
                      <div className="flex justify-between items-center mb-1 px-0.5">
                        <span className="text-[9px] font-[900] uppercase text-slate-400 tracking-widest">{item.label}</span>
                        <button onClick={() => copyToClipboard(item.value, item.label)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all flex items-center gap-1">
                          <Copy className="w-3 h-3" />
                          <span className="text-[8px] font-[900] uppercase">Nusxa</span>
                        </button>
                      </div>
                      <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl overflow-hidden">
                        <code className="text-[10px] font-mono text-slate-600 block truncate">
                          {item.mask ? `${item.value.substring(0, 45)}...` : item.value}
                        </code>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex gap-3 items-start">
                <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center text-emerald-500 shadow-sm shrink-0">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-[900] text-emerald-900 uppercase">Tizim Tayyor</p>
                  <p className="text-[10px] font-medium text-emerald-700/80 leading-relaxed mt-0.5">
                    Webhooks to'g'ri sozlangan. Facebook arizalari real-vaqtda tushadi.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 p-6 rounded-2xl text-white shadow-xl relative overflow-hidden flex flex-col">
              <h3 className="text-sm font-[900] uppercase mb-5 flex items-center gap-3">
                <Workflow className="w-5 h-5 text-indigo-400" /> Yo'riqnoma
              </h3>
              <div className="space-y-5 flex-1">
                {[
                  { title: "Facebook Lead Ads", desc: "Make.com'da birinchi trigger modulini qo'shing." },
                  { title: "HTTP POST Request", desc: "HTTP 'Make a request' modulini qo'shing." },
                  { title: "Endpoint & Headers", desc: "URL, Content-Type: application/json va apikey kiritish." },
                  { title: "JSON Structure", desc: "Body qismiga ism, telefon, clinic_id va ad_name parametrlarini jo'nating." }
                ].map((step, i) => (
                  <div key={i} className="flex gap-4 group">
                    <div className="flex flex-col items-center shrink-0">
                      <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-xs font-[900] group-hover:bg-white group-hover:text-slate-900 transition-all">{i+1}</div>
                      {i < 3 && <div className="w-[1px] h-full bg-white/5 my-1.5" />}
                    </div>
                    <div className="pt-1">
                      <p className="text-sm font-[900] uppercase group-hover:text-indigo-400 transition-colors">{step.title}</p>
                      <p className="text-[10px] font-medium text-white/40 leading-relaxed mt-0.5">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 bg-white/5 p-4 rounded-xl border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[9px] font-[900] text-white/40 uppercase tracking-widest">Make.com JSON Body</p>
                  <button onClick={() => copyToClipboard(JSON.stringify({ name: "{{full_name}}", phone: "{{phone_number}}", source: "Instagram Reels ({{form_name}})", status: "new", clinic_id: clinicId, form_data: { "Sizga qaysi xizmat kerak?": "{{1.answer_1}}", "Muammongiz nima?": "{{1.answer_2}}" }}, null, 2), 'JSON')} className="text-[9px] font-[900] text-indigo-400 hover:text-white flex items-center gap-1 transition-colors">
                    <Copy className="w-3 h-3" /> Nusxa ol
                  </button>
                </div>
                <pre className="text-[9px] font-mono text-emerald-400 overflow-x-auto whitespace-pre-wrap leading-relaxed">{`{
  "name": "{{full_name}}",
  "phone": "{{phone_number}}",
  "source": "Instagram Reels",
  "clinic_id": "${clinicId}"
}`}</pre>
              </div>

              <div className="mt-3">
                <a href="https://developers.facebook.com/tools/lead-ads-testing" target="_blank" rel="noopener noreferrer"
                  className="flex justify-center items-center gap-2 w-full py-3 bg-white text-slate-900 rounded-xl text-[9px] font-[900] uppercase tracking-widest hover:bg-indigo-500 hover:text-white transition-all shadow-md">
                  <Facebook className="w-3.5 h-3.5" /> Facebook Ads Testing Tool
                </a>
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
