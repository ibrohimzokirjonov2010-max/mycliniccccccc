import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, CheckCircle2, 
  TrendingUp, Bell, Target, Phone,
  Table as TableIcon, LayoutGrid, FileSpreadsheet, X,
  ArrowUp, ArrowDown, ArrowUpDown, Trash2, User, MessageCircle,
  Package, Layers, Eye, Receipt, Sparkles, Calendar, Check, Edit2
} from 'lucide-react';
import { 
  Tooth, ImplantIcon, CrownIcon, FormerIcon, AbutmentIcon, 
  BoneGraftIcon, SinusLiftIcon, DentalSurgicalIcon, BrandStockIcon, 
  KiritishTalabIcon, ClinicalControlIcon, ClinicalRevenueIcon 
} from '@/components/ui/Icons';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion, AnimatePresence } from 'framer-motion';
import ImplantForm from '../components/implants/ImplantForm';
import ImplantBrandsModal, { getOrSeedImplantBrands, calculateBrandStockStats } from '@/components/implants/ImplantBrandsModal';
import { useTranslation } from '@/i18n/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Defensive rendering helper
const safeRender = (val, fallback = '—') => {
  if (val == null || val === '') return fallback;
  if (typeof val === 'string' || typeof val === 'number') return val;
  if (typeof val === 'object') {
    return val.label || val.name || val.title || JSON.stringify(val).substring(0, 20);
  }
  return String(val);
};

// Convert internal tooth ID (ul2, ur8, ll1, lr5) → FDI number (22, 18, 31, 45)
const toothIdToFdi = (id) => {
  if (!id) return id;
  const s = String(id);
  const match = s.match(/^(ur|ul|lr|ll)(\d+)$/);
  if (!match) return s;
  const [, quad, num] = match;
  const quadMap = { ur: '1', ul: '2', ll: '3', lr: '4' };
  return quadMap[quad] + num;
};

// Resolve service category
export const resolveService = (implant) => {
  if (implant.service_name && implant.service_name.trim()) return implant.service_name.trim();
  if (implant.hizmat_turi && implant.hizmat_turi.trim()) return implant.hizmat_turi.trim();
  const status = (implant.lifecycle_status || '').toLowerCase();
  if (status.includes('crown') || status.includes('karonka')) return 'Karonka';
  if (status.includes('abutment')) return 'Abutment';
  if (status.includes('healing') || status.includes('formik')) return 'Formik';
  return 'Implant';
};

// Service Visual Config
const SERVICE_CONFIG = {
  'Implant':       { label: 'Implant',       icon: ImplantIcon,        badge: 'bg-teal-50 text-teal-700 border-teal-200' },
  'Formik':        { label: 'Formik',        icon: FormerIcon,         badge: 'bg-amber-50 text-amber-800 border-amber-200' },
  'Karonka':       { label: 'Karonka',       icon: CrownIcon,          badge: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  'Abutment':      { label: 'Abutment',      icon: AbutmentIcon,       badge: 'bg-purple-50 text-purple-700 border-purple-200' },
  'Sinus-lifting': { label: 'Sinus-lifting', icon: SinusLiftIcon,      badge: 'bg-sky-50 text-sky-700 border-sky-200' },
  'Suyak ekish':   { label: 'Suyak ekish',   icon: BoneGraftIcon,      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

// Resolve price in UZS
export const resolvePrice = (implant) => {
  if (implant.price !== undefined && implant.price !== null && implant.price !== '') {
    const num = Number(implant.price);
    if (!isNaN(num)) return num;
  }
  if (implant.narxi !== undefined && implant.narxi !== null && implant.narxi !== '') {
    const num = Number(implant.narxi);
    if (!isNaN(num)) return num;
  }
  const svc = resolveService(implant).toLowerCase();
  if (svc.includes('formik') || svc.includes('healing')) return 100000;
  if (svc.includes('karonka') || svc.includes('crown')) return 1500000;
  if (svc.includes('abutment')) return 300000;
  if (svc.includes('sinus')) return 2000000;
  if (svc.includes('graft') || svc.includes('suyak')) return 1000000;
  return 1500000; // Default standard implant
};

const LIFECYCLE_MAPPING = {
  'Rejalashtirilgan': 'planned',
  "O'rnatildi": 'placed',
  'Healing jarayoni': 'healing',
  "Abutment qo'yildi": 'abutment',
  'Crown tayyor': 'crown',
  'Tugallangan': 'completed',
  'Failure': 'failure',
};

const LIFECYCLE_COLORS = {
  'planned': 'bg-blue-50 text-blue-700 border-blue-200',
  'placed': 'bg-teal-50 text-teal-700 border-teal-200',
  'healing': 'bg-yellow-50 text-yellow-800 border-yellow-200',
  'abutment': 'bg-purple-50 text-purple-700 border-purple-200',
  'crown': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'completed': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'failure': 'bg-rose-50 text-rose-700 border-rose-200',
};

/**
 * Format ISO or standard date to readable Excel DD.MM.YYYY
 */
const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  try {
    const clean = String(dateStr).split('T')[0];
    const parts = clean.split('-');
    if (parts.length === 3) {
      return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }
    return dateStr;
  } catch {
    return dateStr;
  }
};

/**
 * Implants Page - Professional Excel Spreadsheet View
 * Matching Exact Schema: hizmatlar | sana | tish raqami | firma nomi | narxi
 */
export default function Implants() {
  const { t, language } = useTranslation();
  const { user, isDoctor } = useAuth();
  const navigate = useNavigate();

  const [implants, setImplants] = useState([]);
  const [patients, setPatients] = useState([]);
  const [services, setServices] = useState([]);
  const [brands, setBrands] = useState([]);
  const [brandsModalOpen, setBrandsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // all, implant, formik, karonka, other, control, analytics
  const [filterFirma, setFilterFirma] = useState('all');
  const [addOpen, setAddOpen] = useState(false);
  const [editingImplant, setEditingImplant] = useState(null);

  // Density switcher with localStorage
  const [density, setDensity] = useState(() => {
    return localStorage.getItem('myclinic_implants_density') || 'compact';
  });
  const toggleDensity = (val) => {
    setDensity(val);
    localStorage.setItem('myclinic_implants_density', val);
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

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [imps, pats, svcs, brnds] = await Promise.all([
        base44.entities.Implant.list('-placement_date', 400),
        base44.entities.Patient.list('full_name', 100),
        base44.entities.Service.filter({ is_active: true }, 'name', 100),
        getOrSeedImplantBrands(),
      ]);

      let filteredImps = imps || [];
      if (isDoctor && user?.id) {
        const myPatients = (pats || []).filter(p =>
          String(p.main_treatment_provider) === String(user.id) ||
          String(p.main_treatment_provider) === String(user.name) ||
          String(p.created_by_id) === String(user.id)
        );
        const myPatientIds = new Set(myPatients.map(p => String(p.id)));
        filteredImps = filteredImps.filter(i =>
          myPatientIds.has(String(i.patient_id)) ||
          String(i.doctor_id) === String(user.id)
        );
      }
      setImplants(filteredImps);
      setPatients(pats || []);
      setServices(svcs || []);
      setBrands(brnds || []);
    } catch (error) {
      console.error('Error loading implants and brands:', error);
      toast.error("Ma'lumotlarni yuklashda xatolik");
    } finally {
      setLoading(false);
    }
  }, [isDoctor, user?.id, user?.name]);

  useEffect(() => { load(); }, [load]);

  const today = new Date();
  const totalCount = implants.length;
  const failureCount = implants.filter(i => (LIFECYCLE_MAPPING[i.lifecycle_status] || i.lifecycle_status?.toLowerCase()) === 'failure').length;
  const completedCount = implants.filter(i => (LIFECYCLE_MAPPING[i.lifecycle_status] || i.lifecycle_status?.toLowerCase()) === 'completed').length;
  
  // Total Revenue Calculation (Sum of all prices)
  const totalRevenue = useMemo(() => {
    return implants.reduce((acc, curr) => acc + resolvePrice(curr), 0);
  }, [implants]);

  // Breakdown by Service type
  const serviceStats = useMemo(() => {
    let implantCount = 0;
    let implantSum = 0;
    let formikCount = 0;
    let formikSum = 0;
    let karonkaCount = 0;
    let karonkaSum = 0;
    let otherCount = 0;
    let otherSum = 0;

    implants.forEach(i => {
      const svc = resolveService(i).toLowerCase();
      const p = resolvePrice(i);
      if (svc.includes('formik') || svc.includes('healing')) {
        formikCount++;
        formikSum += p;
      } else if (svc.includes('karonka') || svc.includes('crown')) {
        karonkaCount++;
        karonkaSum += p;
      } else if (svc.includes('implant')) {
        implantCount++;
        implantSum += p;
      } else {
        otherCount++;
        otherSum += p;
      }
    });

    return {
      implantCount, implantSum,
      formikCount, formikSum,
      karonkaCount, karonkaSum,
      otherCount, otherSum
    };
  }, [implants]);

  const needsControl = useMemo(() => {
    return implants.filter(i => {
      if (!i.reminder_date) return false;
      const rd = new Date(i.reminder_date);
      const diff = (rd - today) / 86400000;
      return diff <= 14 && diff >= -7;
    });
  }, [implants, today]);

  // Ma'lumotlari to'ldirilmagan implantlar ro'yxati
  const incompleteList = useMemo(() => {
    return implants.filter(i => 
      i.incomplete_data === true || 
      i.needs_fill === true || 
      (!i.firma && !i.brend && !i.firma_custom)
    );
  }, [implants]);

  // Unique brand firms for filter
  const brandFirmOptions = useMemo(() => {
    const set = new Set();
    implants.forEach(i => {
      const f = i.firma;
      if (f && f !== 'Boshqa') set.add(f);
      if (i.firma_custom) set.add(i.firma_custom);
    });
    return Array.from(set);
  }, [implants]);

  // Filtered implants
  const filteredImplants = useMemo(() => {
    return implants.filter(i => {
      const svc = resolveService(i).toLowerCase();

      // Tab filter
      if (activeTab === 'incomplete') {
        const isInc = i.incomplete_data === true || i.needs_fill === true || (!i.firma && !i.brend && !i.firma_custom);
        if (!isInc) return false;
      } else if (activeTab === 'implant') {
        if (!svc.includes('implant')) return false;
      } else if (activeTab === 'formik') {
        if (!svc.includes('formik') && !svc.includes('healing')) return false;
      } else if (activeTab === 'karonka') {
        if (!svc.includes('karonka') && !svc.includes('crown')) return false;
      } else if (activeTab === 'other') {
        if (svc.includes('implant') || svc.includes('formik') || svc.includes('healing') || svc.includes('karonka') || svc.includes('crown')) return false;
      } else if (activeTab === 'control') {
        if (!i.reminder_date) return false;
        const rd = new Date(i.reminder_date);
        const diff = (rd - today) / 86400000;
        if (!(diff <= 14 && diff >= -7)) return false;
      }

      // Brand firma filter
      if (filterFirma !== 'all') {
        const itemFirm = i.firma === 'Boshqa' ? (i.firma_custom || '') : (i.firma || '');
        if (itemFirm !== filterFirma) return false;
      }

      // Search
      const q = search.toLowerCase();
      if (!q) return true;

      const pName = (i.patient_name || '').toLowerCase();
      const pPhone = (i.patient_phone || '').toLowerCase();
      const firma = (i.firma || '').toLowerCase();
      const firmaCustom = (i.firma_custom || '').toLowerCase();
      const brend = (i.brend || '').toLowerCase();
      const svcName = resolveService(i).toLowerCase();
      const teeth = (i.tooth_numbers || (i.tooth_number ? [i.tooth_number] : [])).join(' ');

      return pName.includes(q) || pPhone.includes(q) || firma.includes(q) || firmaCustom.includes(q) || brend.includes(q) || teeth.includes(q) || svcName.includes(q);
    });
  }, [implants, activeTab, filterFirma, search, today]);

  // Sorted implants
  const sortedImplants = useMemo(() => {
    const list = [...filteredImplants];
    list.sort((a, b) => {
      let valA, valB;
      switch (sortField) {
        case 'service':
          valA = resolveService(a).toLowerCase();
          valB = resolveService(b).toLowerCase();
          return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        case 'tooth':
          valA = (a.tooth_number || (a.tooth_numbers && a.tooth_numbers[0]) || '').toString();
          valB = (b.tooth_number || (b.tooth_numbers && b.tooth_numbers[0]) || '').toString();
          return sortOrder === 'asc' ? valA.localeCompare(valB, undefined, { numeric: true }) : valB.localeCompare(valA, undefined, { numeric: true });
        case 'brand':
          valA = (a.firma === 'Boshqa' ? a.firma_custom : a.firma || '').toLowerCase();
          valB = (b.firma === 'Boshqa' ? b.firma_custom : b.firma || '').toLowerCase();
          return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        case 'price':
          valA = resolvePrice(a);
          valB = resolvePrice(b);
          return sortOrder === 'asc' ? valA - valB : valB - valA;
        case 'patient':
          valA = (a.patient_name || '').toLowerCase();
          valB = (b.patient_name || '').toLowerCase();
          return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        case 'status':
          valA = (a.lifecycle_status || '').toLowerCase();
          valB = (b.lifecycle_status || '').toLowerCase();
          return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        case 'date':
        default:
          valA = new Date(a.placement_date || '1970-01-01').getTime();
          valB = new Date(b.placement_date || '1970-01-01').getTime();
          return sortOrder === 'asc' ? valA - valB : valB - valA;
      }
    });
    return list;
  }, [filteredImplants, sortField, sortOrder]);

  const updateImplantStatus = async (id, newVal) => {
    const statusLabel = Object.keys(LIFECYCLE_MAPPING).find(key => LIFECYCLE_MAPPING[key] === newVal) || newVal;
    
    // Optimistic update
    setImplants(prev => prev.map(item => 
      item.id === id ? { ...item, lifecycle_status: statusLabel } : item
    ));

    try {
      await base44.entities.Implant.update(id, { lifecycle_status: statusLabel });
      toast.success("Holat yangilandi!");
      load();
    } catch (e) {
      console.error(e);
      toast.error("Statusni saqlashda xatolik");
      load();
    }
  };

  const handleDeleteImplant = async (id) => {
    if (!window.confirm("Ushbu yozuvni o'chirishni tasdiqlaysizmi?")) return;
    try {
      await base44.entities.Implant.delete(id);
      toast.success("Yozuv muvaffaqiyatli o'chirildi!");
      load();
    } catch (err) {
      console.error(err);
      toast.error("O'chirishda xatolik");
    }
  };

  /**
   * Export to CSV with UTF-8 BOM
   * Exact columns: №, Bemor (F.I.Sh), Telefon, Tish raqamlari, Firma nomi, Hizmat, Narxi, Qo'yilgan sana, Holat
   */
  const exportCSV = useCallback(() => {
    try {
      if (!sortedImplants || sortedImplants.length === 0) {
        toast.warning("Eksport qilish uchun ma'lumot topilmadi");
        return;
      }
      const headers = [
        "№",
        "Bemor (F.I.Sh)",
        "Telefon",
        "Tish raqamlari",
        "Firma nomi",
        "Hizmat",
        "Narxi",
        "Qo'yilgan sana",
        "Holat"
      ];
      const rows = sortedImplants.map((i, idx) => {
        const rawTeeth = (i.tooth_numbers || (i.tooth_number ? [i.tooth_number] : []));
        const teeth = [...new Set(rawTeeth.map(String))].map(n => toothIdToFdi(n)).join(', ');
        const svc = resolveService(i);
        const price = resolvePrice(i);
        const firma = i.firma === 'Boshqa' ? (i.firma_custom || 'Boshqa') : (i.firma || 'Dentium');
        const date = formatDate(i.placement_date);
        const statusText = i.lifecycle_status || 'O\'rnatildi';

        return [
          idx + 1,
          `"${(i.patient_name || '').replace(/"/g, '""')}"`,
          `"${(i.patient_phone || '').replace(/"/g, '""')}"`,
          `"${teeth}"`,
          `"${firma.replace(/"/g, '""')}"`,
          `"${svc.replace(/"/g, '""')}"`,
          price,
          `"${date}"`,
          `"${statusText.replace(/"/g, '""')}"`
        ].join(",");
      });

      const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `Implantlar_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Implantlar jadvali Excel (.csv) formatida yuklab olindi!");
    } catch (err) {
      console.error(err);
      toast.error("Eksportda xatolik yuz berdi");
    }
  }, [sortedImplants]);

  return (
    <div className="space-y-3.5 pb-6">
      {/* ─── Header Bar ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900 tracking-tight">{language === 'ru' ? 'Отделение имплантологии' : language === 'en' ? 'Implantology Department' : "Implantologiya Bo'limi"}</h1>
            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-teal-50 text-teal-700 border border-teal-200 flex items-center gap-1.5">
              <ImplantIcon className="w-3.5 h-3.5 text-teal-600" />
              {language === 'ru' ? `${implants.length} операций` : language === 'en' ? `${implants.length} procedures` : `${implants.length} ta amaliyot`}
            </span>
          </div>
          <p className="text-xs font-semibold text-slate-400 mt-0.5">
            {language === 'ru' ? 'Реестр и мониторинг имплантов, формирователей, коронок и хирургических услуг' : 'Implant, Formik, Karonka va jarrohlik xizmatlari reyestri hamda monitoringi'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          

          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setBrandsModalOpen(true)}
            className="gap-1.5 h-9.5 rounded-xl border-slate-200 text-xs font-bold text-slate-700 bg-white cursor-pointer shadow-xs"
          >
            <BrandStockIcon className="w-4 h-4 text-indigo-600" />
            <span>{language === 'ru' ? 'Бренды и склад' : language === 'en' ? 'Brands & Stock' : 'Brendlar & Zaxira'}</span>
          </Button>

          <Button 
            onClick={() => setAddOpen(true)} 
            className="bg-[#00D084] hover:bg-[#00B875] text-white gap-1.5 border-none rounded-xl h-9.5 px-4 font-black text-xs shadow-md shadow-[#00D084]/20 transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{language === 'ru' ? '+ Добавить имплант' : language === 'en' ? '+ Add Implant' : '+ Yangi implant qo\'shish'}</span>
          </Button>
        </div>
      </div>

      {/* ─── KPI Cards Grid ─────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { 
            label: language === 'ru' ? "ВСЕГО ОПЕРАЦИЙ" : language === 'en' ? "TOTAL PROCEDURES" : "JAMI AMALIYOTLAR", 
            value: `${totalCount} ${language === 'ru' ? '' : 'ta'}`, 
            sub: language === 'ru' ? "Сумма всех услуг" : "Barcha xizmatlar yig'indisi", 
            icon: Tooth, 
            color: "text-indigo-600", 
            bg: "bg-indigo-50 border-indigo-100" 
          },
          { 
            label: language === 'ru' ? "ОБЩАЯ СТОИМОСТЬ" : language === 'en' ? "TOTAL VALUE" : "JAMI QIYMAT (SUMMA)", 
            value: `${totalRevenue.toLocaleString()} ${language === 'ru' ? 'UZS' : "so'm"}`, 
            sub: language === 'ru' ? "Общая выручка клиники" : "Klinika umumiy tushumi", 
            icon: ClinicalRevenueIcon, 
            color: "text-emerald-600", 
            bg: "bg-emerald-50 border-emerald-100",
            highlight: true
          },
          { 
            label: language === 'ru' ? "ИМПЛАНТЫ" : language === 'en' ? "IMPLANTS" : "IMPLANTLAR", 
            value: `${serviceStats.implantCount} ${language === 'ru' ? '' : 'ta'}`, 
            sub: `${serviceStats.implantSum.toLocaleString()} ${language === 'ru' ? 'UZS' : "so'm"}`, 
            icon: ImplantIcon, 
            color: "text-teal-600", 
            bg: "bg-teal-50 border-teal-100" 
          },
          { 
            label: language === 'ru' ? "ФОРМИРОВАТЕЛИ" : language === 'en' ? "HEALING ABUTMENTS" : "FORMIKLAR", 
            value: `${serviceStats.formikCount} ${language === 'ru' ? '' : 'ta'}`, 
            sub: `${serviceStats.formikSum.toLocaleString()} ${language === 'ru' ? 'UZS' : "so'm"}`, 
            icon: FormerIcon, 
            color: "text-amber-600", 
            bg: "bg-amber-50 border-amber-100" 
          },
          { 
            label: language === 'ru' ? "КОРОНКИ" : language === 'en' ? "CROWNS" : "KARONKALAR", 
            value: `${serviceStats.karonkaCount} ${language === 'ru' ? '' : 'ta'}`, 
            sub: `${serviceStats.karonkaSum.toLocaleString()} ${language === 'ru' ? 'UZS' : "so'm"}`, 
            icon: CrownIcon, 
            color: "text-purple-600", 
            bg: "bg-purple-50 border-purple-100" 
          },
        ].map((s, i) => (
          <motion.div 
            key={s.label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.03 }}
            className={`bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-xs flex items-center justify-between relative overflow-hidden ${
              s.highlight ? 'ring-1 ring-emerald-400/50 bg-gradient-to-br from-white to-emerald-50/20' : ''
            }`}
          >
            <div className="min-w-0 flex-1 mr-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-0.5 truncate">
                {s.label}
              </span>
              <div className="text-base sm:text-lg font-black font-mono tracking-tight text-slate-900 truncate">
                {s.value}
              </div>
              <p className="text-[10px] font-bold text-slate-400 mt-0.5 truncate">{s.sub}</p>
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
              placeholder={language === 'ru' ? "Поиск по услуге, пациенту, телефону, бренду или номеру зуба..." : "Xizmat, bemor ismi, telefon, firma yoki tish raqami bo'yicha qidirish..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9.5 pl-9 pr-8 bg-slate-50 hover:bg-white focus:bg-white rounded-xl border border-slate-200 focus:border-[#1499AD] font-semibold text-slate-800 text-xs focus:ring-2 focus:ring-[#1499AD]/10 transition-all outline-none"
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

          {/* Filter Tabs matching Services & Logic */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
            {[
              { id: 'all', label: language === 'ru' ? "Все" : language === 'en' ? "All" : "Barchasi", count: totalCount, icon: TableIcon, activeColor: "text-slate-200", defaultColor: "text-slate-500" },
              { id: 'incomplete', label: language === 'ru' ? "Требует ввода" : language === 'en' ? "Needs Entry" : "Kiritish talab", count: incompleteList.length, alert: incompleteList.length > 0, icon: KiritishTalabIcon, activeColor: "text-amber-300", defaultColor: "text-amber-500" },
              { id: 'implant', label: language === 'ru' ? "Имплант" : "Implant", count: serviceStats.implantCount, icon: ImplantIcon, activeColor: "text-teal-300", defaultColor: "text-teal-600" },
              { id: 'formik', label: language === 'ru' ? "Формирователь" : language === 'en' ? "Former" : "Formik", count: serviceStats.formikCount, icon: FormerIcon, activeColor: "text-amber-300", defaultColor: "text-amber-600" },
              { id: 'karonka', label: language === 'ru' ? "Коронка" : language === 'en' ? "Crown" : "Karonka", count: serviceStats.karonkaCount, icon: CrownIcon, activeColor: "text-indigo-300", defaultColor: "text-indigo-600" },
              { id: 'other', label: language === 'ru' ? "Другие услуги" : language === 'en' ? "Other Services" : "Boshqa xizmatlar", count: serviceStats.otherCount, icon: DentalSurgicalIcon, activeColor: "text-sky-300", defaultColor: "text-sky-600" },
              { id: 'control', label: language === 'ru' ? "Требует контроля" : language === 'en' ? "Needs Control" : "Nazorat talab", count: needsControl.length, alert: needsControl.length > 0, icon: ClinicalControlIcon, activeColor: "text-rose-300", defaultColor: "text-rose-500" },
              { id: 'analytics', label: language === 'ru' ? "Бренды и склад" : language === 'en' ? "Brands & Stock" : "Brendlar & Zaxira", count: brands.length, icon: BrandStockIcon, activeColor: "text-purple-300", defaultColor: "text-purple-600" },
            ].map(tab => {
              const isActive = activeTab === tab.id;
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer select-none",
                    isActive 
                      ? "bg-slate-900 text-white shadow-xs font-black ring-1 ring-slate-800" 
                      : "bg-slate-100/80 text-slate-700 hover:bg-slate-200/80 hover:text-slate-900 border border-slate-200/60"
                  )}
                >
                  <TabIcon className={cn("w-3.5 h-3.5 shrink-0 transition-colors", isActive ? tab.activeColor : tab.defaultColor)} />
                  <span>{tab.label}</span>
                  <span className={cn(
                    "px-1.5 py-0.2 rounded-full text-[9px] font-black",
                    tab.alert ? "bg-amber-400 text-slate-950 font-black shadow-xs animate-pulse" : (isActive ? "bg-white/20 text-white" : "bg-slate-200/90 text-slate-700")
                  )}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Brand Filter & Density Switcher */}
          <div className="flex items-center gap-2">
            {brandFirmOptions.length > 0 && activeTab !== 'analytics' && (
              <Select value={filterFirma} onValueChange={setFilterFirma}>
                <SelectTrigger className="h-9 px-3 rounded-xl border-slate-200 text-xs font-bold text-slate-700 bg-slate-50 w-36">
                  <SelectValue placeholder={language === 'ru' ? "Все фирмы" : "Barcha Firmalar"} />
                </SelectTrigger>
                <SelectContent className="rounded-xl text-xs font-bold">
                  <SelectItem value="all">{language === 'ru' ? "Все фирмы" : "Barcha Firmalar"}</SelectItem>
                  {brandFirmOptions.map(f => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

          </div>

        </div>
      </div>

      {/* ─── Main Content (Excel Data Grid vs Analytics View) ────────── */}
      {activeTab === 'analytics' ? (
        /* Brand Performance & Stock Analytics Grid */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Brand Stock Card */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100">
                  <BrandStockIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Brendlar Ulushi & Zaxira</h3>
                  <p className="text-[11px] font-semibold text-slate-400">
                    Jami {totalCount} ta amaliyot o'rnatilgan
                  </p>
                </div>
              </div>

              <Button
                size="sm"
                onClick={() => setBrandsModalOpen(true)}
                className="h-8 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-black text-[11px] gap-1.5 border border-indigo-200 cursor-pointer"
              >
                <BrandStockIcon className="w-3.5 h-3.5" />
                Zaxira Boshqaruvi
              </Button>
            </div>

            {(() => {
              const brandsWithStats = calculateBrandStockStats(brands, implants);
              const placedBrands = brandsWithStats.filter(b => b.used_count > 0).sort((a, b) => b.used_count - a.used_count);

              if (placedBrands.length === 0) {
                return (
                  <div className="py-12 text-center text-slate-400 font-bold text-xs">
                    Hozircha implantlar o'rnatilmagan
                  </div>
                );
              }

              return (
                <div className="space-y-3">
                  {placedBrands.map(brand => {
                    const sharePct = totalCount > 0 ? Math.round((brand.used_count / totalCount) * 100) : 0;
                    return (
                      <div key={brand.id || brand.name} className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
                        <div className="flex justify-between items-center mb-1.5 text-xs font-black">
                          <span className="text-slate-900">{brand.name} {brand.country && `(${brand.country})`}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-indigo-600 font-mono">{sharePct}% ({brand.used_count} ta)</span>
                            <span className={cn(
                              "px-2 py-0.5 rounded text-[10px]",
                              brand.is_out_of_stock ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-800"
                            )}>
                              {brand.remaining_stock} ta qoldi
                            </span>
                          </div>
                        </div>
                        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${sharePct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* Lifecycle Breakdown Card */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 border border-teal-100">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Lifecycle Taqsimoti</h3>
                <p className="text-[11px] font-semibold text-slate-400">
                  Implantatsiya bosqichlari bo'yicha holat
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              {Object.keys(LIFECYCLE_COLORS).map(statusKey => {
                const cnt = implants.filter(i => {
                  const s = LIFECYCLE_MAPPING[i.lifecycle_status] || i.lifecycle_status?.toLowerCase();
                  return statusKey === (s || '').toLowerCase();
                }).length;
                if (cnt === 0) return null;
                return (
                  <div key={statusKey} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200/70 text-xs">
                    <span className="font-bold text-slate-800 uppercase tracking-wider">{t(`implants.status.${statusKey}`) || statusKey}</span>
                    <span className="font-mono font-black text-slate-900 bg-white px-2.5 py-0.5 rounded-md border border-slate-200 shadow-xs">{cnt} ta</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* ─── Excel Spreadsheet Data Grid Table ──────────────────────── */
        /* Exact Columns: № | 1. Bemor (F.I.Sh) | 2. Tish raqamlari | 3. Firma nomi | 4. Narxi | 5. Qo'yilgan sana | 6. Amallar */
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden relative"
        >
          {loading && (
            <div className="absolute inset-x-0 top-0 h-0.5 bg-slate-100 overflow-hidden z-20">
              <motion.div 
                className="h-full bg-gradient-to-r from-teal-500 to-indigo-600"
                animate={{ x: ['-100%', '100%'] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              />
            </div>
          )}
          
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left select-text">
              {/* ─── Excel Table Header ────────────────── */}
              <thead>
                <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-700 text-[11px] font-black uppercase tracking-wider sticky top-0 z-10 backdrop-blur-xs">
                  
                  {/* № Col */}
                  <th className="w-12 px-2.5 py-3 text-center border-r border-slate-200 select-none font-mono">
                    №
                  </th>

                  {/* 1. BEMOR (F.I.SH) */}
                  <th 
                    onClick={() => handleSort('patient')}
                    className="px-3.5 py-3 border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors select-none min-w-[190px]"
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span>{language === 'ru' ? '1. Пациент (Ф.И.О)' : '1. Bemor (F.I.Sh)'}</span>
                      {sortField === 'patient' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#1499AD]" /> : <ArrowDown className="w-3 h-3 text-[#1499AD]" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-30" />
                      )}
                    </div>
                  </th>

                  {/* 2. TISH RAQAMLARI */}
                  <th 
                    onClick={() => handleSort('tooth')}
                    className="w-28 px-2.5 py-3 text-center border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors select-none whitespace-nowrap"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>{language === 'ru' ? '2. Номера зубов' : '2. Tish raqamlari'}</span>
                      {sortField === 'tooth' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#1499AD]" /> : <ArrowDown className="w-3 h-3 text-[#1499AD]" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-30" />
                      )}
                    </div>
                  </th>

                  {/* 3. FIRMA NOMI */}
                  <th 
                    onClick={() => handleSort('brand')}
                    className="px-3.5 py-3 border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors select-none min-w-[170px]"
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span>{language === 'ru' ? '3. Фирма / Бренд' : '3. Firma nomi'}</span>
                      {sortField === 'brand' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#1499AD]" /> : <ArrowDown className="w-3 h-3 text-[#1499AD]" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-30" />
                      )}
                    </div>
                  </th>

                  {/* 4. NARXI */}
                  <th 
                    onClick={() => handleSort('price')}
                    className="w-36 px-3.5 py-3 text-right border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors select-none whitespace-nowrap bg-emerald-50/40"
                  >
                    <div className="flex items-center justify-end gap-1.5 text-emerald-900">
                      <span>{language === 'ru' ? '4. Цена' : '4. Narxi'}</span>
                      {sortField === 'price' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-emerald-600" /> : <ArrowDown className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-30" />
                      )}
                    </div>
                  </th>

                  {/* 5. QO'YILGAN SANA */}
                  <th 
                    onClick={() => handleSort('date')}
                    className="w-36 px-3 py-3 border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors select-none whitespace-nowrap"
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span>{language === 'ru' ? '5. Дата установки' : '5. Qo\'yilgan sana'}</span>
                      {sortField === 'date' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#1499AD]" /> : <ArrowDown className="w-3 h-3 text-[#1499AD]" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-30" />
                      )}
                    </div>
                  </th>

                  {/* 6. AMALLAR */}
                  <th className="px-3 py-3 text-center text-slate-700 whitespace-nowrap select-none min-w-[210px]">
                    <span>{language === 'ru' ? '6. Действия' : '6. Amallar'}</span>
                  </th>

                </tr>
              </thead>

              {/* ─── Excel Table Body ────────────────── */}
              <tbody className="divide-y divide-slate-200/70 text-xs">
                {sortedImplants.length > 0 ? (
                  sortedImplants.map((i, idx) => {
                    const isCompact = density === 'compact';
                    const rawTeeth = (i.tooth_numbers || (i.tooth_number ? [i.tooth_number] : []));
                    const teethList = [...new Set(rawTeeth.map(String))];
                    const serviceName = resolveService(i);
                    const serviceCfg = SERVICE_CONFIG[serviceName] || { label: serviceName, emoji: '⚡', badge: 'bg-slate-100 text-slate-700 border-slate-200' };
                    const priceVal = resolvePrice(i);
                    const firmaName = i.firma === 'Boshqa' ? (i.firma_custom || 'Boshqa') : (i.firma || 'Dentium');
                    const statusCode = LIFECYCLE_MAPPING[i.lifecycle_status] || i.lifecycle_status?.toLowerCase() || 'placed';
                    const statusClass = LIFECYCLE_COLORS[statusCode] || 'bg-slate-50 text-slate-700 border-slate-200';

                    const isIncomplete = i.incomplete_data === true || i.needs_fill === true || (!i.firma && !i.brend && !i.firma_custom);

                    return (
                      <tr 
                        key={i.id} 
                        className={`group hover:bg-[#1499AD]/10 hover:shadow-xs transition-colors cursor-pointer ${
                          isIncomplete ? 'bg-amber-50/30' : (idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white')
                        }`}
                        onClick={() => navigate(`/implants/${i.id}`)}
                      >
                        {/* № Cell */}
                        <td className={`text-center font-mono font-bold text-slate-400 border-r border-slate-200/70 whitespace-nowrap ${isCompact ? 'py-2 px-2' : 'py-3 px-2.5'}`}>
                          {idx + 1}
                        </td>

                        {/* 1. BEMOR (F.I.SH) Cell */}
                        <td className={`border-r border-slate-200/70 ${isCompact ? 'py-1.5 px-3' : 'py-2.5 px-3.5'}`}>
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-700 font-black text-[10px] flex items-center justify-center border border-teal-100 shrink-0">
                              <User className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0">
                              <span 
                                onClick={(e) => {
                                  if (i.patient_id) {
                                    e.stopPropagation();
                                    navigate(`/patients/${i.patient_id}`);
                                  }
                                }}
                                className="font-black text-slate-900 hover:text-[#1499AD] transition-colors truncate block hover:underline text-xs"
                              >
                                {safeRender(i.patient_name)}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400 block truncate">
                                {safeRender(i.patient_phone, language === 'ru' ? 'Нет телефона' : 'Telefon yo\'q')}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 2. TISH RAQAMLARI Cell */}
                        <td className={`text-center border-r border-slate-200/70 whitespace-nowrap ${isCompact ? 'py-1.5 px-2' : 'py-2.5 px-2.5'}`}>
                          {teethList.length > 0 ? (
                            <div className="flex items-center justify-center gap-1 flex-wrap">
                              {teethList.map(tNum => (
                                <span key={tNum} className="px-2 py-0.5 rounded-md text-xs font-mono font-black bg-slate-900 text-white shadow-xs">
                                  #{toothIdToFdi(tNum)}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-300 font-mono">—</span>
                          )}
                        </td>

                        {/* 3. FIRMA NOMI Cell */}
                        <td className={`border-r border-slate-200/70 ${isCompact ? 'py-1.5 px-3' : 'py-2.5 px-3.5'}`}>
                          <div className="min-w-0">
                            {isIncomplete ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black bg-amber-50 text-amber-900 border border-amber-300 shadow-2xs">
                                <KiritishTalabIcon className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                <span>{language === 'ru' ? 'Требуется ввести данные' : 'Ma\'lumot kiritish kerak'}</span>
                              </span>
                            ) : (
                              <>
                                <span className="font-black text-slate-900 group-hover:text-[#1499AD] transition-colors truncate block text-xs">
                                  {firmaName}
                                </span>
                                {i.brend && i.brend !== firmaName && (
                                  <span className="text-[10px] font-semibold text-slate-500 block truncate mt-0.5">
                                    {i.brend} {i.diameter && i.length && `(Ø${i.diameter}×${i.length}mm)`}
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        </td>

                        {/* 4. NARXI Cell */}
                        <td className={`text-right border-r border-slate-200/70 font-mono font-black text-emerald-700 whitespace-nowrap bg-emerald-50/20 text-xs sm:text-sm ${isCompact ? 'py-1.5 px-3' : 'py-2.5 px-3.5'}`}>
                          {priceVal.toLocaleString()} <span className="text-[10px] font-bold text-emerald-600/80 uppercase">{language === 'ru' ? 'UZS' : "so'm"}</span>
                        </td>

                        {/* 5. QO'YILGAN SANA Cell */}
                        <td className={`border-r border-slate-200/70 font-mono text-slate-800 font-bold whitespace-nowrap ${isCompact ? 'py-1.5 px-3' : 'py-2.5 px-3.5'}`}>
                          {formatDate(i.placement_date)}
                        </td>

                        {/* 6. AMALLAR Cell */}
                        <td className={`text-center whitespace-nowrap ${isCompact ? 'py-1 px-2' : 'py-2 px-2.5'}`} onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            <Select 
                              value={statusCode} 
                              onValueChange={(val) => updateImplantStatus(i.id, val)}
                            >
                              <SelectTrigger className={cn(
                                "h-7 px-2 rounded-lg font-bold text-[10px] uppercase tracking-wider mx-auto border transition-colors focus:ring-0 min-w-[120px] max-w-[130px] shrink-0",
                                statusClass
                              )}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl font-bold text-xs">
                                {Object.keys(LIFECYCLE_COLORS).map(s => (
                                  <SelectItem key={s} value={s} className="text-xs font-bold uppercase tracking-wider">
                                    {t(`implants.status.${s}`) || s}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            {isIncomplete && (
                              <button 
                                onClick={() => setEditingImplant(i)}
                                className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-xs transition-all cursor-pointer active:scale-95 shrink-0"
                                title={language === 'ru' ? 'Заполнить данные' : "Ma'lumotlarni to'ldirish"}
                              >
                                <Edit2 className="w-3 h-3" />
                                <span>{language === 'ru' ? 'Ввести' : 'Kiritish'}</span>
                              </button>
                            )}

                            {i.patient_phone && (
                              <button 
                                onClick={() => { window.location.href = `tel:${i.patient_phone}`; }}
                                className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-all cursor-pointer"
                                title={language === 'ru' ? 'Позвонить' : "Qo'ng'iroq qilish"}
                              >
                                <Phone className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button 
                              onClick={() => navigate(`/implants/${i.id}`)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-all cursor-pointer"
                              title={language === 'ru' ? 'Детали и редактирование' : "Tafsilotlar va tahrirlash"}
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            <button 
                              onClick={() => handleDeleteImplant(i.id)}
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
                          <ImplantIcon className="w-6 h-6" />
                        </div>
                        <p className="text-sm font-bold text-slate-500">
                          {search ? `"${search}" bo'yicha ma'lumot topilmadi` : "Hozircha amaliyotlar mavjud emas"}
                        </p>
                        {(search || activeTab !== 'all' || filterFirma !== 'all') && (
                          <button
                            onClick={() => { setSearch(''); setActiveTab('all'); setFilterFirma('all'); }}
                            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
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

      {/* ─── Add/Edit Implant Modal ───────────────────────────────────────── */}
      <ImplantForm
        open={addOpen || !!editingImplant}
        onClose={() => { setAddOpen(false); setEditingImplant(null); }}
        patients={patients}
        services={services}
        implant={editingImplant}
        onSaved={() => { load(); setActiveTab('all'); setEditingImplant(null); }}
      />

      {/* ─── Brands & Stock Management Modal ─────────────────────────── */}
      <ImplantBrandsModal
        open={brandsModalOpen}
        onClose={() => setBrandsModalOpen(false)}
        implants={implants}
        onBrandsUpdated={load}
      />
    </div>
  );
}
