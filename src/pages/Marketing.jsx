import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  Target, TrendingUp, BarChart3, Users, Facebook, Instagram, Zap, DollarSign, RefreshCw, Workflow, Server,
  Copy, CheckCircle, Search,
  PieChart as PieChartIcon, Phone, MapPin, MessageCircle, Upload,
  Table as TableIcon, LayoutGrid, FileSpreadsheet, X,
  ArrowUp, ArrowDown, ArrowUpDown, Trash2, Eye
} from 'lucide-react';
import { motion } from 'framer-motion';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTranslation } from '@/i18n/LanguageContext';
import { supabase, db } from '@/api/supabaseClient';
import LeadQuickView from '@/components/marketing/LeadQuickView';
import LeadSourceIcon from '@/components/ui/LeadSourceIcon';
import { cn, formatPhone } from '@/lib/utils';
import { toast } from 'sonner';

/**
 * Marketing Page - Professional Excel Spreadsheet View
 */
export default function Marketing() {
  const { t, language } = useTranslation();

  // Data States
  const [leads, setLeads] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState('leads'); // leads, campaigns, analytics, targeting, automation
  const [selectedLead, setSelectedLead] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Density switcher with localStorage
  const [density, setDensity] = useState(() => {
    return localStorage.getItem('myclinic_marketing_density') || 'compact';
  });
  const toggleDensity = (val) => {
    setDensity(val);
    localStorage.setItem('myclinic_marketing_density', val);
  };

  // Sorting state
  const [sortField, setSortField] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };
  
  const fileInputRef = useRef(null);

  // Credentials for Make.com
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  const clinicId = localStorage.getItem('current_clinic_id') || 'default_clinic';

  const loadRealLeads = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('leads')
        .select('*')
        .order('created_date', { ascending: false });
      
      if (clinicId) {
        query = query.eq('clinic_id', clinicId);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Leads load error:', error);
      }
      
      if (data) {
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
  }, [clinicId]);

  useEffect(() => {
    loadRealLeads();

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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clinicId, loadRealLeads]);

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
      
      const spend = count * 35000;
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
    toast.success("Ma'lumotlar muvaffaqiyatli yangilandi!");
    setTimeout(() => setSyncing(false), 600);
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} nusxalandi!`);
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
        if (rows.length < 2) {
          toast.warning("Fayl bo'sh");
          return;
        }
        
        const headers = rows[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
        
        let nameIdx = headers.findIndex(h => h === 'full_name' || h === 'name' || h === 'first_name' || h.includes('ism') || h.includes('имя'));
        let phoneIdx = headers.findIndex(h => h === 'phone_number' || h === 'phone' || h.includes('telefon') || h.includes('raqam') || h.includes('телефон') || h.includes('номер'));
        
        if (nameIdx === -1) nameIdx = 0;
        if (phoneIdx === -1) phoneIdx = 1;
        
        let successCount = 0;
        for (let i = 1; i < rows.length; i++) {
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
        
        toast.success(`🎉 ${successCount} ta lid muvaffaqiyatli yuklandi!`);
        await loadRealLeads();
      } catch (err) {
         console.error('Import error:', err);
         toast.error("Import qilishda xatolik yuz berdi");
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
         if (k.includes('yosh')) {
           const ageMatch = String(val).match(/\d+/);
           if (ageMatch) {
             const age = parseInt(ageMatch[0]);
             if (age < 25) ageBuckets['18-24 yosh']++;
             else if (age <= 34) ageBuckets['25-34 yosh']++;
             else if (age <= 50) ageBuckets['35-50 yosh']++;
             else ageBuckets['50+ yosh']++;
           }
         }
         if (k.includes('hudud') || k.includes('manzil') || k.includes('shahar') || k.includes('viloyat')) {
           const loc = String(val).trim();
           locationsCount[loc] = (locationsCount[loc] || 0) + 1;
         }
      });
    });

    let totalAge = Object.values(ageBuckets).reduce((a, b) => a + b, 0);
    let generatedAudience = [];
    if (totalAge === 0) {
      generatedAudience = [
        { name: t('marketing.targeting.ageGroups.group3') || '35-50 yosh', value: 45, color: '#1499AD' },
        { name: t('marketing.targeting.ageGroups.group2') || '25-34 yosh', value: 30, color: '#6366F1' },
        { name: t('marketing.targeting.ageGroups.group4') || '50+ yosh', value: 25, color: '#F59E0B' },
      ];
    } else {
      const colors = { '18-24 yosh': '#38BDF8', '25-34 yosh': '#6366F1', '35-50 yosh': '#1499AD', '50+ yosh': '#F59E0B' };
      generatedAudience = Object.entries(ageBuckets)
        .filter(([_, count]) => count > 0)
        .map(([name, count]) => {
           let displayName = name;
           if (name === '18-24 yosh') displayName = t('marketing.targeting.ageGroups.group1') || name;
           else if (name === '25-34 yosh') displayName = t('marketing.targeting.ageGroups.group2') || name;
           else if (name === '35-50 yosh') displayName = t('marketing.targeting.ageGroups.group3') || name;
           else if (name === '50+ yosh') displayName = t('marketing.targeting.ageGroups.group4') || name;

           return {
             name: displayName,
             value: Math.round((count / totalAge) * 100),
             color: colors[name] || '#94A3B8'
           };
        });
    }

    let totalLoc = Object.values(locationsCount).reduce((a, b) => a + b, 0);
    let generatedLocations = [];
    if (totalLoc === 0) {
      generatedLocations = [
        { city: t('marketing.targeting.locations.tashkentCity') || 'Toshkent shahri', leads: 142, percent: 65, color: 'bg-indigo-500' },
        { city: t('marketing.targeting.locations.tashkentRegion') || 'Toshkent viloyati', leads: 48, percent: 22, color: 'bg-cyan-500' },
        { city: t('marketing.targeting.locations.otherRegions') || 'Boshqa hududlar', leads: 28, percent: 13, color: 'bg-slate-300' }
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
  }, [leads, language, t]);

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
        { id: 1, name: 'Implantat Aksiya 2026', platform: 'Facebook', spend: 1200000, leads: 0, cpl: 0, status: 'Active', trend: '+0%' },
        { id: 2, name: 'Vinirlar Instagram', platform: 'Instagram', spend: 850000, leads: 0, cpl: 0, status: 'Active', trend: '+0%' }
      ];
    }

    return entries.map(([name, count], idx) => {
      let platform = 'Facebook';
      const nameL = name.toLowerCase();
      if (nameL.includes('instagram') || nameL.includes('insta')) platform = 'Instagram';
      else if (nameL.includes('google') || nameL.includes('site') || nameL.includes('sayt')) platform = 'Google';
      else if (nameL.includes('telegram') || nameL.includes('tg')) platform = 'Telegram';
      else if (nameL.includes('import') || nameL.includes('csv')) platform = 'CSV Import';

      let baseCpl = 32000;
      if (platform === 'Instagram') baseCpl = 28000;
      else if (platform === 'Google') baseCpl = 45000;
      else if (platform === 'Telegram') baseCpl = 18000;
      else if (platform === 'Facebook') baseCpl = 25000;

      const variation = ((idx * 7) % 15) - 7;
      const cplVal = Math.round(baseCpl * (1 + variation / 100));
      
      let spend = count * cplVal;
      if (nameL.includes('import') || nameL.includes('csv')) {
        spend = 0;
      }

      const cpl = count > 0 ? Math.round(spend / count) : 0;

      return {
        id: idx + 1,
        name,
        platform,
        spend,
        leads: count,
        cpl,
        status: 'Active',
        trend: count > 3 ? '+14%' : '+4%'
      };
    });
  }, [leads]);

  // ─── Dynamic Conversion Funnel Steps ───
  const funnelSteps = useMemo(() => {
    const totalLeads = leads.length;
    const convertedLeads = leads.filter(l => l.status?.toLowerCase() === 'converted' || l.status?.toLowerCase() === 'bemorga aylandi' || l.status?.toLowerCase() === 'bemor').length;
    
    const views = totalLeads * 38;
    const clicks = totalLeads * 3;

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
    const converted = leads.filter(l => l.status?.toLowerCase() === 'converted' || l.status?.toLowerCase() === 'bemorga aylandi' || l.status?.toLowerCase() === 'bemor').length;
    const conversionRate = total > 0 ? ((converted / total) * 100).toFixed(1) : '0.0';
    
    let totalSpend = 0;
    campaignPerformance.forEach(c => {
      totalSpend += (Number(c.spend) || 0);
    });
    
    const avgCpl = total > 0 ? Math.round(totalSpend / total) : 0;
    const roi = total > 0 ? (1.8 + (converted * 0.45)).toFixed(1) : '0.0';

    return {
      totalLeads: total,
      convertedLeads: converted,
      conversionRate,
      totalSpend,
      avgCpl,
      roi
    };
  }, [leads, campaignPerformance]);

  const createTestLead = async () => {
    try {
      setSyncing(true);
      const testLead = {
        name: "Gulzoda Salimova (Instagram Demo)",
        phone: "+998 99 555 44 33",
        source: "Instagram Ads (Vinirlar)",
        status: "new",
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
      
      await db.leads.create(testLead);
      toast.success("Test lid muvaffaqiyatli yaratildi!");
      await loadRealLeads();
      setActiveTab('leads');
    } catch (error) {
      console.error("Test lid yaratishda xato:", error);
      toast.error("Xatolik: " + error.message);
    } finally {
      setSyncing(false);
    }
  };

  const updateLeadStatus = async (leadId, newStatus) => {
    const oldLeads = [...leads];
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
    try {
      const { error } = await supabase.from('leads').update({ status: newStatus }).eq('id', leadId);
      if (error) throw error;
      toast.success("Lid holati yangilandi!");
    } catch (err) {
      setLeads(oldLeads);
      console.error(err);
      toast.error("Statusni saqlashda xatolik");
    }
  };

  const handleDeleteLead = async (leadId) => {
    if (!window.confirm("Ushbu lidni o'chirishni tasdiqlaysizmi?")) return;
    try {
      const { error } = await supabase.from('leads').delete().eq('id', leadId);
      if (error) throw error;
      toast.success("Lid o'chirildi!");
      loadRealLeads();
    } catch (err) {
      console.error(err);
      toast.error("O'chirishda xatolik");
    }
  };

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      // Status filter
      if (statusFilter !== 'all') {
        const s = (l.status || 'new').toLowerCase();
        if (statusFilter === 'new' && s !== 'new' && s !== 'yangi') return false;
        if (statusFilter === 'contacted' && s !== 'contacted' && s !== 'bog\'lanildi') return false;
        if (statusFilter === 'converted' && s !== 'converted' && s !== 'bemorga aylandi' && s !== 'bemor') return false;
        if (statusFilter === 'lost' && s !== 'lost' && s !== 'yo\'qotildi') return false;
      }

      // Search
      const q = search.toLowerCase();
      if (!q) return true;

      const name = (l.name || l.full_name || '').toLowerCase();
      const phone = (l.phone || '').toLowerCase();
      const src = (l.source || '').toLowerCase();
      const notes = (l.notes || '').toLowerCase();

      return name.includes(q) || phone.includes(q) || src.includes(q) || notes.includes(q);
    });
  }, [leads, statusFilter, search]);

  // Sorted Leads
  const sortedLeads = useMemo(() => {
    const list = [...filteredLeads];
    list.sort((a, b) => {
      let valA, valB;
      switch (sortField) {
        case 'name':
          valA = (a.name || a.full_name || '').toLowerCase();
          valB = (b.name || b.full_name || '').toLowerCase();
          return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        case 'source':
          valA = (a.source || '').toLowerCase();
          valB = (b.source || '').toLowerCase();
          return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        case 'status':
          valA = (a.status || '').toLowerCase();
          valB = (b.status || '').toLowerCase();
          return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        case 'date':
        default:
          valA = new Date(a.created_date || a.created_at || '1970-01-01').getTime();
          valB = new Date(b.created_date || b.created_at || '1970-01-01').getTime();
          return sortOrder === 'asc' ? valA - valB : valB - valA;
      }
    });
    return list;
  }, [filteredLeads, sortField, sortOrder]);

  /**
   * Export to CSV with UTF-8 BOM
   */
  const exportCSV = useCallback(() => {
    try {
      if (!sortedLeads || sortedLeads.length === 0) {
        toast.warning("Eksport qilish uchun ma'lumot topilmadi");
        return;
      }
      const headers = [
        "№",
        "Lid (F.I.Sh)",
        "Telefon Raqami",
        "Manba (Kampaniya)",
        "Tushgan Sana",
        "Holat",
        "Izoh / Anketa"
      ];
      const rows = sortedLeads.map((l, idx) => {
        const answers = l.form_data ? Object.entries(l.form_data).map(([k, v]) => `${k}: ${v}`).join('; ') : '';
        return [
          idx + 1,
          `"${(l.name || l.full_name || '').replace(/"/g, '""')}"`,
          `"${(l.phone || '').replace(/"/g, '""')}"`,
          `"${(l.source || 'Facebook Ads').replace(/"/g, '""')}"`,
          `"${l.created_date || l.created_at || ''}"`,
          `"${l.status || 'new'}"`,
          `"${answers.replace(/"/g, '""')}"`
        ].join(",");
      });

      const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `Marketing_Lidlar_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Marketing ma'lumotlari Excel (.csv) formatida yuklab olindi!");
    } catch (err) {
      console.error(err);
      toast.error("Eksportda xatolik yuz berdi");
    }
  }, [sortedLeads]);

  return (
    <div className="space-y-3.5 pb-4">
      {/* ─── Excel Header Bar ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900 tracking-tight">{language === 'ru' ? 'Маркетинговый Центр' : language === 'en' ? 'Marketing Center' : (t('marketing.title') || "Marketing & Reklama Markazi")}</h1>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
              {language === 'ru' ? `• ТАРГЕТИНГ И ЛИДЫ: ${leads.length} ЗАЯВКИ` : language === 'en' ? `• TARGETING & LEADS: ${leads.length} REQUESTS` : `• Targeting & Lidlar ${leads.length} Arizalar`}
            </span>
          </div>
          <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
            {language === 'ru' ? 'Поток лидов, анализ рекламных кампаний, CPL/ROI и мониторинг конверсии' : 'Lidlar oqimi, reklama kampaniyalari tahlili, CPL/ROI va konversiya monitoringi'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
          <Button 
            onClick={() => fileInputRef.current?.click()} 
            disabled={isImporting} 
            variant="outline" 
            className="h-9.5 px-3.5 rounded-xl border-slate-200 text-slate-700 bg-white hover:bg-slate-50 font-bold text-xs shadow-xs"
          >
            <Upload className="w-3.5 h-3.5 mr-1.5 text-indigo-600" /> 
            {isImporting ? (language === 'ru' ? 'Загрузка...' : 'Yuklanmoqda...') : (language === 'ru' ? 'Импорт CSV' : 'CSV Import')}
          </Button>

          <Button 
            onClick={createTestLead}
            disabled={syncing}
            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 border-none rounded-xl h-9.5 px-3.5 font-bold text-xs shadow-sm active:scale-95"
          >
            <Zap className="w-3.5 h-3.5 text-amber-300" />
            <span>{language === 'ru' ? '+ Тестовый лид' : language === 'en' ? '+ Test Lead' : '+ Test Lid'}</span>
          </Button>

          <Button
            onClick={handleSync}
            disabled={syncing}
            className="h-9.5 px-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl flex items-center gap-1.5 active:scale-95 transition-all disabled:opacity-50 text-xs font-bold"
          >
            <RefreshCw className={syncing ? "w-3.5 h-3.5 animate-spin" : "w-3.5 h-3.5"} />
            <span>{syncing ? (language === 'ru' ? 'Обновление...' : 'Yangilanmoqda...') : (language === 'ru' ? 'Обновить' : 'Yangilash')}</span>
          </Button>
        </div>
      </div>

      {/* ─── Top Executive KPI Grid ─────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { 
            label: language === 'ru' ? "ВСЕГО ЛИДОВ" : language === 'en' ? "TOTAL LEADS" : "JAMI LIDLAR", 
            value: stats.totalLeads, 
            icon: Target, 
            color: "text-indigo-600", 
            bg: "bg-indigo-50 border-indigo-100", 
            countText: language === 'ru' ? "Все поступившие заявки" : "Barcha tushgan arizalar" 
          },
          { 
            label: language === 'ru' ? "СРЕДНИЙ CPL" : language === 'en' ? "AVERAGE CPL" : "O'RTACHA CPL", 
            value: stats.avgCpl, 
            icon: DollarSign, 
            color: "text-blue-600", 
            bg: "bg-blue-50 border-blue-100", 
            isCurrency: true, 
            countText: language === 'ru' ? "Стоимость одного лида" : "Har bir lid tannarxi" 
          },
          { 
            label: language === 'ru' ? "КОНВЕРСИЯ" : language === 'en' ? "CONVERSION" : "KONVERSIYA", 
            value: stats.conversionRate, 
            icon: TrendingUp, 
            color: "text-emerald-600", 
            bg: "bg-emerald-50 border-emerald-100", 
            isPercent: true, 
            countText: language === 'ru' ? `${stats.convertedLeads} конвертировано в пациентов` : `${stats.convertedLeads} ta bemorga aylandi` 
          },
          { 
            label: language === 'ru' ? "ROI (ОКУПАЕМОСТЬ)" : language === 'en' ? "ROI (RETURN)" : "ROI (DAROMAD)", 
            value: `${stats.roi}x`, 
            icon: PieChartIcon, 
            color: "text-amber-600", 
            bg: "bg-amber-50 border-amber-100", 
            countText: language === 'ru' ? "Эффективность инвестиций" : "Investitsiya samaradorligi" 
          },
          { 
            label: language === 'ru' ? "ОБЩИЙ РАСХОД" : language === 'en' ? "TOTAL EXPENSE" : "JAMI XARAJAT", 
            value: stats.totalSpend, 
            icon: BarChart3, 
            color: "text-purple-600", 
            bg: "bg-purple-50 border-purple-100", 
            isCurrency: true, 
            countText: language === 'ru' ? "Рекламный бюджет" : "Reklama byudjeti" 
          },
        ].map((s, i) => (
          <motion.div 
            key={s.label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.03 }}
            className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-xs flex items-center justify-between relative overflow-hidden"
          >
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">
                {s.label}
              </span>
              <div className="text-lg sm:text-xl font-black font-mono tracking-tight text-slate-900 tabular-nums">
                {s.isCurrency ? (
                  <span>{Number(s.value).toLocaleString()} <span className="text-[10px] font-bold text-slate-400">UZS</span></span>
                ) : s.isPercent ? (
                  <span>{s.value}%</span>
                ) : (
                  <span>{s.value}</span>
                )}
              </div>
              <p className="text-[9.5px] font-medium text-slate-400 mt-0.5">{s.countText}</p>
            </div>

            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-xs shrink-0 ${s.bg}`}>
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
          </motion.div>
        ))}
      </div>

      {/* ─── Excel Spreadsheet Controls Bar ────────────────────────── */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          
          {/* Search Box */}
          <div className="relative flex-1 group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#1499AD] transition-colors" />
            <input 
              type="text" 
              placeholder={language === 'ru' ? "Поиск по имени лида, номеру телефона, источнику или анкете..." : "Lid ismi, telefon raqami, manba yoki izoh bo'yicha qidiruv..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-8 bg-slate-50 hover:bg-white focus:bg-white rounded-xl border border-slate-200 focus:border-[#1499AD] font-semibold text-slate-800 text-xs focus:ring-2 focus:ring-[#1499AD]/10 transition-all outline-none"
            />
            {search && (
              <button 
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Navigation Filter Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
            {[
              { id: 'leads', label: language === 'ru' ? "Все Лиды" : language === 'en' ? "All Leads" : "Barcha Lidlar", count: leads.length, icon: Users },
              { id: 'campaigns', label: language === 'ru' ? "Кампании" : language === 'en' ? "Campaigns" : "Kampaniyalar", count: campaignPerformance.length, icon: BarChart3 },
              { id: 'analytics', label: language === 'ru' ? "Динамика и воронка" : language === 'en' ? "Dynamics & Funnel" : "Dinamika & Voronka", icon: TrendingUp },
              { id: 'targeting', label: language === 'ru' ? "Таргетинг и аудитория" : language === 'en' ? "Targeting & Audience" : "Targeting & Auditoriya", icon: Target },
              { id: 'automation', label: "Make / Webhook", icon: Workflow },
            ].map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer",
                    isActive 
                      ? "bg-slate-900 text-white shadow-xs font-black" 
                      : "bg-slate-100/70 text-slate-600 hover:bg-slate-200/60 hover:text-slate-900"
                  )}
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span className={cn(
                      "px-1.5 py-0.2 rounded-full text-[9px] font-black",
                      isActive ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"
                    )}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Status Filter & Density Switcher */}
          <div className="flex items-center gap-2">
            {activeTab === 'leads' && (
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 px-3 rounded-xl border-slate-200 text-xs font-bold text-slate-700 bg-slate-50 w-32">
                  <SelectValue placeholder={language === 'ru' ? "Все статусы" : "Barcha Holatlar"} />
                </SelectTrigger>
                <SelectContent className="rounded-xl text-xs font-bold">
                  <SelectItem value="all">{language === 'ru' ? "Все статусы" : "Barcha Holatlar"}</SelectItem>
                  <SelectItem value="new">{language === 'ru' ? "Новый" : "Yangi"}</SelectItem>
                  <SelectItem value="contacted">{language === 'ru' ? "Связались" : "Bog'lanildi"}</SelectItem>
                  <SelectItem value="converted">{language === 'ru' ? "Пациент" : "Bemor"}</SelectItem>
                  <SelectItem value="lost">{language === 'ru' ? "Утрачен" : "Yo'qotildi"}</SelectItem>
                </SelectContent>
              </Select>
            )}

          </div>

        </div>
      </div>

      {/* ─── TAB 1: BARCHA LIDLAR (EXCEL SPREADSHEET TABLE) ───────────── */}
      {activeTab === 'leads' && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden relative"
        >
          {loading && (
            <div className="absolute inset-x-0 top-0 h-0.5 bg-slate-100 overflow-hidden z-20">
              <motion.div 
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-600"
                animate={{ x: ['-100%', '100%'] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              />
            </div>
          )}
          
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left select-text">
              <thead>
                <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-600 text-[10.5px] font-black uppercase tracking-wider sticky top-0 z-10 backdrop-blur-xs">
                  
                  {/* № */}
                  <th className="w-12 px-2.5 py-2.5 text-center border-r border-slate-200 select-none font-mono">
                    №
                  </th>

                  {/* LID (F.I.SH) */}
                  <th 
                    onClick={() => handleSort('name')}
                    className="px-3.5 py-2.5 border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors select-none min-w-[200px]"
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span>{language === 'ru' ? 'Лид (Ф.И.О)' : 'Lid (F.I.Sh)'}</span>
                      {sortField === 'name' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#1499AD]" /> : <ArrowDown className="w-3 h-3 text-[#1499AD]" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-30" />
                      )}
                    </div>
                  </th>

                  {/* MANBA / KAMPANIYA */}
                  <th 
                    onClick={() => handleSort('source')}
                    className="w-48 px-3.5 py-2.5 border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors select-none whitespace-nowrap"
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span>{language === 'ru' ? 'Источник (Кампания)' : 'Manba (Kampaniya)'}</span>
                      {sortField === 'source' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#1499AD]" /> : <ArrowDown className="w-3 h-3 text-[#1499AD]" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-30" />
                      )}
                    </div>
                  </th>

                  {/* ANKETA / SAVOLLAR */}
                  <th className="px-3.5 py-2.5 border-r border-slate-200 select-none min-w-[220px]">
                    {language === 'ru' ? 'Анкета / Вопросы' : 'Anketa / Savollar'}
                  </th>

                  {/* TUSHGAN SANA */}
                  <th 
                    onClick={() => handleSort('date')}
                    className="w-36 px-3 py-2.5 border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors select-none whitespace-nowrap"
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span>{language === 'ru' ? 'Дата поступления' : 'Tushgan Sana'}</span>
                      {sortField === 'date' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#1499AD]" /> : <ArrowDown className="w-3 h-3 text-[#1499AD]" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-30" />
                      )}
                    </div>
                  </th>

                  {/* HOLAT */}
                  <th 
                    onClick={() => handleSort('status')}
                    className="w-36 px-3 py-2.5 text-center border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors select-none whitespace-nowrap"
                  >
                    <div className="flex items-center justify-center gap-1.5 text-slate-700">
                      <span>{language === 'ru' ? 'Статус' : 'Holat'}</span>
                      {sortField === 'status' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-30" />
                      )}
                    </div>
                  </th>

                  {/* AMALLAR */}
                  <th className="w-36 px-2 py-2.5 text-center text-slate-500 whitespace-nowrap select-none">
                    {language === 'ru' ? 'Действия' : 'Amallar'}
                  </th>

                </tr>
              </thead>

              {/* ─── Excel Table Body ────────────────── */}
              <tbody className="divide-y divide-slate-200/70 text-xs">
                {sortedLeads.length > 0 ? (
                  sortedLeads.map((l, idx) => {
                    const isCompact = density === 'compact';
                    const srcLower = (l.source || '').toLowerCase();
                    const isInstagram = srcLower.includes('instagram') || srcLower.includes('insta');
                    const isFacebook = srcLower.includes('facebook') || srcLower.includes('fb');
                    const isTelegram = srcLower.includes('telegram') || srcLower.includes('tg');

                    const statusVal = (l.status || 'new').toLowerCase();
                    const statusClass = 
                      statusVal === 'new' || statusVal === 'yangi' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      statusVal === 'contacted' || statusVal === 'bog\'lanildi' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      statusVal === 'converted' || statusVal === 'bemor' || statusVal === 'bemorga aylandi' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                      'bg-slate-100 text-slate-600 border-slate-200';

                    const formAnswers = l.form_data && Object.keys(l.form_data).length > 0 ? Object.entries(l.form_data) : [];

                    return (
                      <tr 
                        key={l.id || idx}
                        className={`group hover:bg-[#1499AD]/10 hover:shadow-xs transition-colors cursor-pointer ${
                          idx % 2 === 1 ? 'bg-slate-50/30' : 'bg-white'
                        }`}
                        onClick={() => setSelectedLead(l)}
                      >
                        {/* № */}
                        <td className={`text-center font-mono font-bold text-slate-400 border-r border-slate-200/70 whitespace-nowrap ${isCompact ? 'py-2 px-2' : 'py-3 px-2.5'}`}>
                          {idx + 1}
                        </td>

                        {/* LID (F.I.SH) */}
                        <td className={`border-r border-slate-200/70 ${isCompact ? 'py-1.5 px-3' : 'py-2.5 px-3.5'}`}>
                          <div className="flex items-center gap-2.5 min-w-0">
                            <LeadSourceIcon 
                              source={l.source} 
                              className={cn(
                                "shrink-0 transition-transform duration-200 group-hover:scale-105",
                                isCompact ? "w-7 h-7 rounded-lg" : "w-8 h-8 rounded-xl"
                              )} 
                            />
                            <div className="min-w-0">
                              <span className="font-extrabold text-slate-900 group-hover:text-blue-600 transition-colors truncate block">
                                {l.name || l.full_name || (language === 'ru' ? 'Неизвестный лид' : 'Noma\'lum Lid')}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400 block truncate">
                                {l.phone ? formatPhone(l.phone) : (language === 'ru' ? 'Нет телефона' : 'Telefon yo\'q')}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* MANBA / KAMPANIYA */}
                        <td className={`border-r border-slate-200/70 ${isCompact ? 'py-1.5 px-3' : 'py-2.5 px-3.5'}`}>
                          <span className="font-bold text-slate-800 text-xs block truncate">
                            {l.source || 'Facebook Ads'}
                          </span>
                          {l.ad_name && (
                            <span className="text-[9.5px] font-semibold text-indigo-600 block truncate">
                              {l.ad_name}
                            </span>
                          )}
                        </td>

                        {/* ANKETA / SAVOLLAR */}
                        <td className={`border-r border-slate-200/70 ${isCompact ? 'py-1.5 px-3' : 'py-2.5 px-3.5'}`}>
                          {formAnswers.length > 0 ? (
                            <div className="space-y-0.5 text-[11px] max-w-sm">
                              {formAnswers.slice(0, 2).map(([q, a], qIdx) => (
                                <div key={qIdx} className="truncate text-slate-600">
                                  <span className="font-bold text-slate-800">{q}: </span>
                                  <span>{String(a)}</span>
                                </div>
                              ))}
                              {formAnswers.length > 2 && (
                                <span className="text-[9px] font-bold text-indigo-600">+{formAnswers.length - 2} {language === 'ru' ? 'дополнительных ответа' : "ta qo'shimcha javob"}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-300 font-mono">—</span>
                          )}
                        </td>

                        {/* TUSHGAN SANA */}
                        <td className={`border-r border-slate-200/70 font-mono text-slate-700 font-semibold text-[11px] whitespace-nowrap ${isCompact ? 'py-1.5 px-3' : 'py-2.5 px-3.5'}`}>
                          {l.created_date || l.created_at ? new Date(l.created_date || l.created_at).toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>

                        {/* HOLAT */}
                        <td className={`text-center border-r border-slate-200/70 whitespace-nowrap ${isCompact ? 'py-1 px-2' : 'py-2 px-2.5'}`} onClick={(e) => e.stopPropagation()}>
                          <select
                            value={statusVal}
                            onChange={(e) => updateLeadStatus(l.id, e.target.value)}
                            className={cn(
                              "h-7 px-2 rounded-lg font-bold text-[10px] uppercase tracking-wider mx-auto border transition-colors outline-none cursor-pointer",
                              statusClass
                            )}
                          >
                            <option value="new">{language === 'ru' ? "Новый" : "Yangi"}</option>
                            <option value="contacted">{language === 'ru' ? "Связались" : "Bog'lanildi"}</option>
                            <option value="converted">{language === 'ru' ? "Пациент" : "Bemor"}</option>
                            <option value="lost">{language === 'ru' ? "Утрачен" : "Yo'qotildi"}</option>
                          </select>
                        </td>

                        {/* AMALLAR */}
                        <td className={`text-center whitespace-nowrap ${isCompact ? 'py-1 px-1.5' : 'py-2 px-2'}`} onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            {l.phone && (
                              <button 
                                onClick={() => { window.open(`tel:${l.phone}`, '_self'); }}
                                className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-all cursor-pointer"
                                title={language === 'ru' ? 'Позвонить' : "Qo'ng'iroq qilish"}
                              >
                                <Phone className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {l.phone && (
                              <button 
                                onClick={() => { window.open(`https://t.me/+${(l.phone || '').replace(/\D/g, '')}`, '_blank'); }}
                                className="p-1.5 rounded-lg text-sky-600 hover:bg-sky-50 transition-all cursor-pointer"
                                title={language === 'ru' ? 'Написать в Telegram' : "Telegram orqali yozish"}
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button 
                              onClick={() => setSelectedLead(l)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-all cursor-pointer"
                              title={language === 'ru' ? 'Детали и просмотр' : "Tezkor ko'rish"}
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            <button 
                              onClick={() => handleDeleteLead(l.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                              title={language === 'ru' ? 'Удалить' : "O'chirish"}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>

                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300">
                          <Target className="w-6 h-6" />
                        </div>
                        <p className="text-sm font-bold text-slate-500">
                          {search ? `"${search}" bo'yicha lid topilmadi` : "Ayni damda lidlar mavjud emas"}
                        </p>
                        {(search || statusFilter !== 'all') && (
                          <button
                            onClick={() => { setSearch(''); setStatusFilter('all'); }}
                            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
                          >
                            Filtrlarni tozalash
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* ─── TAB 2: KAMPANIYALAR TAHLILI (EXCEL SPREADSHEET TABLE) ────── */}
      {activeTab === 'campaigns' && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left select-text">
              <thead>
                <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-600 text-[10.5px] font-black uppercase tracking-wider">
                  <th className="w-12 px-2.5 py-2.5 text-center border-r border-slate-200 select-none font-mono">№</th>
                  <th className="px-3.5 py-2.5 border-r border-slate-200 min-w-[220px]">{language === 'ru' ? 'Название кампании' : 'Kampaniya Nomi'}</th>
                  <th className="w-36 px-3 py-2.5 border-r border-slate-200 text-center">{language === 'ru' ? 'Платформа' : 'Platforma'}</th>
                  <th className="w-44 px-3.5 py-2.5 border-r border-slate-200 text-right font-mono">{language === 'ru' ? 'Общий расход' : 'Jami Xarajat'}</th>
                  <th className="w-32 px-3 py-2.5 border-r border-slate-200 text-center font-mono">{language === 'ru' ? 'Количество лидов' : 'Lidlar Soni'}</th>
                  <th className="w-40 px-3.5 py-2.5 border-r border-slate-200 text-right font-mono">{language === 'ru' ? 'Средний CPL' : 'O\'rtacha CPL'}</th>
                  <th className="w-28 px-3 py-2.5 border-r border-slate-200 text-center">{language === 'ru' ? 'Статус' : 'Holat'}</th>
                  <th className="w-32 px-3 py-2.5 text-center">{language === 'ru' ? 'Эффективность' : 'Samaradorlik'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 text-xs">
                {campaignPerformance.map((c, idx) => (
                  <tr key={c.id || idx} className="hover:bg-slate-50 transition-colors">
                    <td className="text-center font-mono font-bold text-slate-400 border-r border-slate-200/70 py-2.5 px-2">
                      {idx + 1}
                    </td>
                    <td className="border-r border-slate-200/70 py-2.5 px-3.5 font-extrabold text-slate-900">
                      {c.name}
                    </td>
                    <td className="text-center border-r border-slate-200/70 py-2.5 px-3">
                      <span className={cn(
                        "px-2 py-0.5 rounded-md text-[10px] font-black uppercase",
                        c.platform === 'Facebook' ? "bg-blue-50 text-blue-700 border border-blue-200" :
                        c.platform === 'Instagram' ? "bg-pink-50 text-pink-700 border border-pink-200" :
                        c.platform === 'Telegram' ? "bg-sky-50 text-sky-700 border border-sky-200" :
                        "bg-slate-100 text-slate-700 border border-slate-200"
                      )}>
                        {c.platform}
                      </span>
                    </td>
                    <td className="text-right border-r border-slate-200/70 py-2.5 px-3.5 font-mono font-bold text-slate-900">
                      {Number(c.spend).toLocaleString()} <span className="text-[10px] text-slate-400">UZS</span>
                    </td>
                    <td className="text-center border-r border-slate-200/70 py-2.5 px-3 font-mono font-black text-indigo-600">
                      {c.leads} ta
                    </td>
                    <td className="text-right border-r border-slate-200/70 py-2.5 px-3.5 font-mono font-bold text-blue-600">
                      {Number(c.cpl).toLocaleString()} <span className="text-[10px] text-slate-400">UZS</span>
                    </td>
                    <td className="text-center border-r border-slate-200/70 py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {language === 'ru' ? 'Активна' : 'Faol'}
                      </span>
                    </td>
                    <td className="text-center py-2.5 px-3 font-black text-emerald-600 text-xs">
                      {c.trend}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-slate-100/90 border-t border-slate-200/90 px-4 py-2.5 flex items-center justify-between text-xs">
            <span className="font-bold text-slate-600">{language === 'ru' ? 'Всего активных кампаний: ' : 'Jami faol kampaniyalar: '}<strong className="text-slate-900 font-mono">{campaignPerformance.length}</strong> {language === 'ru' ? '' : 'ta'}</span>
            <span className="font-mono font-black text-indigo-700">{language === 'ru' ? 'Σ ОБЩИЙ БЮДЖЕТ:' : 'Σ Umumiy Byudjet:'} {stats.totalSpend.toLocaleString()} UZS</span>
          </div>
        </motion.div>
      )}

      {/* ─── TAB 3: DINAMIKA & VORONKA ───────────────────────────────── */}
      {activeTab === 'analytics' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Chart */}
          <div className="lg:col-span-2 bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">{language === 'ru' ? 'Динамика Роста' : 'O\'sish Dinamikasi'}</h3>
                <p className="text-[10px] font-semibold text-slate-400 mt-0.5">{language === 'ru' ? 'Поток лидов и мониторинг расходов' : 'Lidlar oqimi va xarajat monitoringi'}</p>
              </div>
              <div className="flex gap-3">
                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-indigo-500" /><span className="text-[10px] font-bold text-slate-600">{language === 'ru' ? 'Расход' : 'Xarajat'}</span></div>
                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#1499AD]" /><span className="text-[10px] font-bold text-slate-600">{language === 'ru' ? 'Лиды' : 'Lidlar'}</span></div>
              </div>
            </div>
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1499AD" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#1499AD" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366F1" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#64748B'}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#64748B'}} />
                  <Tooltip contentStyle={{ borderRadius: '1rem', border: '1px solid #e2e8f0', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)', padding: '10px 14px' }} />
                  <Area type="monotone" dataKey="spend" stroke="#6366F1" strokeWidth={2} fillOpacity={1} fill="url(#colorSpend)" />
                  <Area type="monotone" dataKey="leads" stroke="#1499AD" strokeWidth={3} fillOpacity={1} fill="url(#colorLeads)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Conversion Funnel */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight mb-4">{language === 'ru' ? 'Воронка Конверсии' : 'Konversiya Voronkasi'}</h3>
            <div className="space-y-2.5">
              {funnelSteps.map((step, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider mb-0.5">{step.label}</p>
                      <span className="text-base font-black font-mono text-slate-900">{step.value}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-black font-mono text-indigo-600">{step.percent}</span>
                      <p className="text-[9px] font-bold text-slate-400 mt-0.5">{step.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* ─── TAB 4: AUDITORIYA & TARGETING ──────────────────────────── */}
      {activeTab === 'targeting' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight mb-4 flex items-center gap-2">
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
                <div key={i} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200/60">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: a.color }} />
                    <span className="text-[10px] font-black uppercase text-slate-700">{a.name}</span>
                  </div>
                  <span className="text-sm font-black text-slate-900 font-mono">{a.value}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2 bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight mb-1 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-indigo-500" /> Top Lokatsiyalar
            </h3>
            <p className="text-[10px] font-semibold text-slate-400 mb-4">Arizalar qaysi hududlardan tushmoqda?</p>
            <div className="space-y-3.5">
              {locationData.map((loc, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between items-center text-xs font-black">
                    <span className="text-slate-900">{loc.city}</span>
                    <span className="text-slate-500 font-mono">{loc.leads} lid ({loc.percent}%)</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${loc.color}`} style={{ width: `${loc.percent}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 p-4 bg-slate-900 rounded-2xl text-white">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/10 rounded-xl shrink-0"><Zap className="w-5 h-5 text-amber-400" /></div>
                <div>
                  <p className="text-xs font-black uppercase">AI Marketing Tavsiyasi</p>
                  <p className="text-[11px] text-white/60 leading-relaxed mt-0.5">35-50 yosh oralig'idagi mijozlar eng faol. Implantat va Vinir xizmatlari uchun byudjetni oshirish tavsiya etiladi.</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ─── TAB 5: INTEGRATSIYA (MAKE / WEBHOOK) ─────────────────────── */}
      {activeTab === 'automation' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-4">
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-sm">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Integratsiya Sozlamalari</h3>
                  <p className="text-[10px] font-semibold text-slate-400">Make.com / Webhook Parametrlari</p>
                </div>
              </div>
              <div className="space-y-3">
                {[
                  { label: 'Webhook Endpoint (URL)', value: `${supabaseUrl}/rest/v1/leads`, id: 'url' },
                  { label: 'API Key (Anon Key)', value: supabaseAnonKey, id: 'key', mask: true },
                  { label: 'Klinika ID (clinic_id)', value: clinicId, id: 'clinic' }
                ].map((item) => (
                  <div key={item.id}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-black uppercase text-slate-500">{item.label}</span>
                      <button onClick={() => copyToClipboard(item.value, item.label)} className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1">
                        <Copy className="w-3 h-3" /> Nusxa
                      </button>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl overflow-hidden font-mono text-xs text-slate-700">
                      {item.mask ? `${item.value.substring(0, 45)}...` : item.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex gap-3 items-center">
              <CheckCircle className="w-6 h-6 text-emerald-600 shrink-0" />
              <div>
                <p className="text-xs font-black text-emerald-900 uppercase">Tizim Faol & Tayyor</p>
                <p className="text-[10.5px] text-emerald-700">Facebook & Instagram Lead Ads arizalari avtomatik real-vaqtda qabul qilinadi.</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 p-6 rounded-2xl text-white shadow-xl">
            <h3 className="text-sm font-black uppercase mb-4 flex items-center gap-2">
              <Workflow className="w-4 h-4 text-indigo-400" /> Make.com Ulanish Namunasi
            </h3>
            <pre className="text-xs font-mono text-emerald-400 bg-white/5 p-4 rounded-xl border border-white/10 overflow-x-auto leading-relaxed">{`{
  "name": "{{full_name}}",
  "phone": "{{phone_number}}",
  "source": "Instagram Reels",
  "clinic_id": "${clinicId}"
}`}</pre>
            <div className="mt-4">
              <a 
                href="https://developers.facebook.com/tools/lead-ads-testing" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex justify-center items-center gap-2 w-full py-3 bg-white text-slate-900 rounded-xl text-xs font-black uppercase hover:bg-slate-100 transition-all"
              >
                <Facebook className="w-4 h-4 text-[#1877F2]" /> Facebook Ads Testing Tool
              </a>
            </div>
          </div>
        </motion.div>
      )}

      {/* Lead Quick View Modal */}
      <LeadQuickView
        lead={selectedLead}
        isOpen={!!selectedLead}
        onClose={() => setSelectedLead(null)}
      />
    </div>
  );
}
