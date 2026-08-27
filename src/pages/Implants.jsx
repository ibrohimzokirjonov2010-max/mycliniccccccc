import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus, Search, Activity, AlertTriangle, CheckCircle2, 
  ChevronRight, TrendingUp, Zap, Bell, Target, Phone, Calendar, ArrowRight, Layers, MessageCircle
} from 'lucide-react';
import { Tooth } from '@/components/ui/Icons';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion, AnimatePresence } from 'framer-motion';
import ImplantForm, { EXTRA_SERVICES } from '../components/implants/ImplantForm';
import ImplantBrandsModal, { getOrSeedImplantBrands, calculateBrandStockStats } from '@/components/implants/ImplantBrandsModal';
import { useFeature } from '@/hooks/useFeature';
import { Package, Settings2 } from 'lucide-react';
import Paywall from '@/components/layout/Paywall';
import { useTranslation } from '@/i18n/LanguageContext';

// Defensive rendering helper to prevent "Objects are not valid as React child" crashes
const safeRender = (val, fallback = '—') => {
  if (val == null || val === '') return fallback;
  if (typeof val === 'string' || typeof val === 'number') return val;
  if (typeof val === 'object') {
    // If it's an object with a label/name/title, try to show that
    return val.label || val.name || val.title || JSON.stringify(val).substring(0, 20);
  }
  return String(val);
};

// Convert internal tooth ID (ul2, ur8, ll1, lr5) → FDI number (22, 18, 31, 45)
const toothIdToFdi = (id) => {
  if (!id) return id;
  const s = String(id);
  const match = s.match(/^(ur|ul|lr|ll)(\d+)$/);
  if (!match) return s; // already FDI or unknown format
  const [, quad, num] = match;
  const quadMap = { ur: '1', ul: '2', ll: '3', lr: '4' };
  return quadMap[quad] + num;
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
  'planned': 'bg-blue-50 text-blue-600 border-blue-100',
  'placed': 'bg-teal-50 text-teal-600 border-teal-100',
  'healing': 'bg-yellow-50 text-yellow-600 border-yellow-100',
  'abutment': 'bg-purple-50 text-purple-600 border-purple-100',
  'crown': 'bg-indigo-50 text-indigo-600 border-indigo-100',
  'completed': 'bg-emerald-50 text-emerald-600 border-emerald-100',
  'failure': 'bg-rose-50 text-rose-600 border-rose-100',
};

function StatBox({ label, value, icon: Icon, color, lightColor, sub, delay = 0 }) {  
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay }}
      className="bg-white border border-slate-100/80 rounded-[1.5rem] p-4 sm:p-6 shadow-sm shadow-slate-200/40 relative group overflow-hidden"
    >
      <div className={`absolute -right-2 -top-2 w-16 h-16 ${lightColor} opacity-40 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500`} />
      <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl ${lightColor} flex items-center justify-center mb-3 transition-transform group-hover:rotate-6`}>
        <Icon className={`w-4.5 h-4.5 sm:w-5.5 sm:h-5.5 ${color}`} />
      </div>
      <div className="space-y-0.5">
        <p className="text-[10px] sm:text-xs font-[900] text-slate-400 uppercase tracking-widest">{label}</p>
        <p className="text-base sm:text-xl font-[900] text-slate-900 tracking-tighter">{value}</p>
        {sub && <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-wider">{sub}</p>}
      </div>
    </motion.div>
  );
}

export default function Implants() {
  const { t } = useTranslation();
  const [implants, setImplants] = useState([]);
  const [patients, setPatients] = useState([]);
  const [services, setServices] = useState([]);
  const [brands, setBrands] = useState([]);
  const [brandsModalOpen, setBrandsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFirma, setFilterFirma] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [tab, setTab] = useState('dashboard');
  const hasImplantsAccess = useFeature('implants');

  const load = async () => {
    try {
      setLoading(true);
      const [imps, pats, svcs, brnds] = await Promise.all([
        base44.entities.Implant.list('-placement_date', 100),
        base44.entities.Patient.list('full_name', 100),
        base44.entities.Service.filter({ is_active: true }, 'name', 100),
        getOrSeedImplantBrands(),
      ]);
      setImplants(imps || []);
      setPatients(pats || []);
      setServices(svcs || []);
      setBrands(brnds || []);
    } catch (error) {
      console.error('Error loading implants and brands:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 86400000).toISOString().split('T')[0];
  const recentCount = implants.filter(i => i.placement_date >= thirtyDaysAgo).length;
  const totalCount = implants.length;
  const failureCount = implants.filter(i => (LIFECYCLE_MAPPING[i.lifecycle_status] || i.lifecycle_status?.toLowerCase()) === 'failure').length;
  const successCount = implants.filter(i => (LIFECYCLE_MAPPING[i.lifecycle_status] || i.lifecycle_status?.toLowerCase()) === 'completed').length;
  const successRate = totalCount > 0 ? Math.round(((totalCount - failureCount) / totalCount) * 100) : 0;
  
  const needsControl = implants.filter(i => {
    if (!i.reminder_date) return false;
    const rd = new Date(i.reminder_date);
    const diff = (rd - today) / 86400000;
    return diff <= 14 && diff >= -7;
  });

  const brandStats = {};
  implants.forEach(i => {
    const b = i.firma === 'Boshqa' ? (i.firma_custom || 'Boshqa') : i.firma;
    if (b) brandStats[b] = (brandStats[b] || 0) + 1;
  });
  const topBrands = Object.entries(brandStats).sort((a, b) => b[1] - a[1]).slice(0, 4);

  const filtered = implants.filter(i => {
    const toothNumbers = i.tooth_numbers || (i.tooth_number ? [i.tooth_number] : []);
    const matchSearch = i.patient_name?.toLowerCase().includes(search.toLowerCase()) ||
      toothNumbers.some(n => String(n).includes(search));
    const matchStatus = !filterStatus || i.lifecycle_status?.toLowerCase() === filterStatus?.toLowerCase();
    const matchFirma = !filterFirma || i.firma === filterFirma;
    return matchSearch && matchStatus && matchFirma;
  });

  if (!hasImplantsAccess) {
    return <Paywall featureName="Implantlar" />;
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24 lg:pb-8">
      {/* Premium Header */}
      <div className="sticky top-0 z-30 bg-[#F8FAFC]/80 backdrop-blur-md px-4 py-4 sm:px-6 mb-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-[900] text-slate-900 tracking-tight flex items-center gap-2">
              <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center">
                <Tooth className="w-5 h-5 text-indigo-600" />
              </div>
              {t('navigation.implants')}
            </h1>
            <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{t('implants.subtitle')}</p>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setAddOpen(true)}
            className="bg-slate-900 text-white p-3 sm:px-5 sm:py-2.5 rounded-2xl flex items-center gap-2 shadow-lg shadow-slate-200 transition-all hover:bg-slate-800"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline font-bold text-sm uppercase tracking-wider">{t('implants.addNew')}</span>
          </motion.button>
        </div>
      </div>

      <div className="px-4 sm:px-6 space-y-6">
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <div className="flex items-center justify-between mb-6">
            <TabsList className="bg-slate-100/50 p-1 rounded-2xl border border-slate-200/50">
              <TabsTrigger 
                value="dashboard" 
                className="rounded-xl px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-slate-900 text-slate-500 font-bold text-xs uppercase tracking-wider"
              >
                {t('dashboard.statistics')}
              </TabsTrigger>
              <TabsTrigger 
                value="list"
                className="rounded-xl px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-slate-900 text-slate-500 font-bold text-xs uppercase tracking-wider flex items-center gap-2"
              >
                {t('patients.patientList')}
                {needsControl.length > 0 && (
                  <span className="w-4 h-4 bg-rose-500 text-white rounded-full text-[9px] flex items-center justify-center animate-pulse">
                    {needsControl.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          <AnimatePresence mode="wait">
            {/* DASHBOARD CONTENT */}
            <TabsContent value="dashboard" className="mt-0 space-y-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatBox 
                  label={t('implants.stats.total')} 
                  value={totalCount} 
                  icon={Activity} 
                  color="text-indigo-600" 
                  lightColor="bg-indigo-50"
                  delay={0.1}
                />
                <StatBox 
                  label={t('implants.stats.recent')} 
                  value={recentCount} 
                  icon={TrendingUp} 
                  color="text-blue-600" 
                  lightColor="bg-blue-50"
                  delay={0.2}
                />
                <StatBox 
                  label={t('implants.stats.success')} 
                  value={`${successRate}%`} 
                  icon={CheckCircle2} 
                  color="text-emerald-600" 
                  lightColor="bg-emerald-50"
                  sub={`${failureCount} ta failure`}
                  delay={0.3}
                />
                <StatBox 
                  label={t('implants.stats.control')} 
                  value={needsControl.length} 
                  icon={Bell} 
                  color="text-amber-600" 
                  lightColor="bg-amber-50"
                  delay={0.4}
                />
              </div>

              {/* Control Alerts Section */}
              {needsControl.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gradient-to-br from-amber-50 to-orange-50/30 border border-amber-100 rounded-[2rem] p-6 relative overflow-hidden group"
                >
                  <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform duration-700">
                    <Bell className="w-24 h-24 text-amber-600" />
                  </div>
                  <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-white shadow-lg shadow-amber-200">
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-[900] text-slate-900 uppercase tracking-tight">{t('implants.alerts.title')}</h3>
                        <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mt-0.5">{needsControl.length} {t('implants.alerts.subtitle').replace('{count}', needsControl.length)}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {needsControl.slice(0, 4).map(i => (
                        <div key={i.id} className="relative">
                          <Link 
                            to={`/implants/${i.id}`} 
                            className="absolute inset-0 z-10"
                            onClick={(e) => {
                              // If any button inside was clicked, don't navigate
                              if (e.target.closest('button')) {
                                e.preventDefault();
                              }
                            }}
                          />
                          <div className="bg-white/80 backdrop-blur-sm border border-amber-100/50 rounded-2xl p-4 flex items-center justify-between hover:bg-white transition-all hover:shadow-md group/item overflow-hidden">
                            <div className="flex items-center gap-3">
                              <div className="min-w-10 h-10 px-2 rounded-full bg-amber-50 flex items-center justify-center font-bold text-amber-700 text-[10px] border border-amber-100 flex-wrap gap-0.5">
                                {(i.tooth_numbers || [i.tooth_number]).map(n => <span key={n}>#{n}</span>)}
                              </div>
                              <div>
                                <p className="text-sm font-bold text-slate-900 tracking-tight">{i.patient_name}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                                  {i.firma} · {(() => {
                                    const daysLeft = Math.ceil((new Date(i.reminder_date) - today) / 86400000);
                                    if (daysLeft < 0) return <span className="text-rose-500">{t('implants.alerts.overdue', { days: Math.abs(daysLeft) })}</span>;
                                    if (daysLeft === 0) return <span className="text-amber-600 font-black">{t('implants.alerts.today')}</span>;
                                    return <span className="text-blue-500">{t('implants.alerts.remaining', { days: daysLeft })}</span>;
                                  })()}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 relative z-20">
                              <motion.button
                                whileTap={{ scale: 0.9 }}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (i.patient_phone) window.location.href = `tel:${i.patient_phone}`;
                                }}
                                className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center hover:bg-emerald-100 transition-colors shadow-sm shadow-emerald-100/20"
                                title="Qo'ng'iroq"
                              >
                                <Phone className="w-3.5 h-3.5" />
                              </motion.button>
                              <motion.button
                                whileTap={{ scale: 0.9 }}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (i.patient_phone) window.location.href = `sms:${i.patient_phone}`;
                                }}
                                className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100 transition-colors shadow-sm shadow-blue-100/20"
                                title="SMS yuborish"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                              </motion.button>
                              <ChevronRight className="w-4 h-4 text-amber-400 group-hover/item:translate-x-1 transition-transform ml-1" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Main Analysis Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Brand Performance & Stock */}
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm shadow-slate-200/40 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                        <Target className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-[900] text-slate-900 uppercase tracking-tight">Brendlar Ulushi & Zaxira</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                          {totalCount} ta implant o'rnatilgan
                        </p>
                      </div>
                    </div>
                    
                    <Button
                      size="sm"
                      onClick={() => setBrandsModalOpen(true)}
                      className="h-8 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-black text-[10px] uppercase tracking-wider gap-1 border border-indigo-200/60 cursor-pointer"
                    >
                      <Package className="w-3 h-3" />
                      Brendlar & Zaxira
                    </Button>
                  </div>
                  
                  {(() => {
                    const brandsWithStats = calculateBrandStockStats(brands, implants);
                    const placedBrands = brandsWithStats.filter(b => b.used_count > 0).sort((a, b) => b.used_count - a.used_count);
                    const BRAND_COLORS = [
                      { bar: 'from-indigo-500 to-blue-500', bg: 'bg-indigo-50', text: 'text-indigo-600', dot: 'bg-indigo-500' },
                      { bar: 'from-violet-500 to-purple-500', bg: 'bg-violet-50', text: 'text-violet-600', dot: 'bg-violet-500' },
                      { bar: 'from-teal-500 to-emerald-500', bg: 'bg-teal-50', text: 'text-teal-600', dot: 'bg-teal-500' },
                      { bar: 'from-amber-500 to-orange-500', bg: 'bg-amber-50', text: 'text-amber-600', dot: 'bg-amber-500' },
                    ];

                    if (placedBrands.length === 0) {
                      return (
                        <div className="py-8 text-center space-y-2 border border-dashed border-slate-200 rounded-2xl p-4">
                          <Package className="w-8 h-8 text-slate-300 mx-auto" />
                          <p className="text-xs font-bold text-slate-500">Hozircha implant o'rnatilmagan</p>
                          <p className="text-[10.5px] text-slate-400 max-w-xs mx-auto">
                            Bemorlarga implant o'rnatilgach, brendlar bo'yicha real ulush va zaxira sarfi shu yerda avtomatik ko'rsatiladi.
                          </p>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-3.5">
                        {placedBrands.map((brand, idx) => {
                          const col = BRAND_COLORS[idx % BRAND_COLORS.length];
                          const sharePct = totalCount > 0 ? Math.round((brand.used_count / totalCount) * 100) : 0;

                          return (
                            <div key={brand.id || brand.name} className="group p-2.5 rounded-xl hover:bg-slate-50/70 transition-colors">
                              <div className="flex justify-between items-center mb-1.5">
                                <div className="flex items-center gap-2">
                                  <span className={`w-2 h-2 rounded-full ${col.dot} flex-shrink-0`} />
                                  <span className="text-xs font-[900] text-slate-800 uppercase tracking-wide">
                                    {brand.name}
                                  </span>
                                  {brand.country && (
                                    <span className="text-[9px] font-bold text-slate-400">
                                      ({brand.country})
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`text-[10px] font-black ${col.text} ${col.bg} px-2 py-0.5 rounded-md`}>
                                    {sharePct}%
                                  </span>
                                  <span className="text-xs font-black text-slate-900">
                                    {brand.used_count} ta
                                  </span>
                                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ml-1 ${
                                    brand.is_out_of_stock 
                                      ? 'bg-rose-100 text-rose-700' 
                                      : brand.is_low_stock 
                                        ? 'bg-amber-100 text-amber-800' 
                                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                                  }`}>
                                    {brand.remaining_stock} ta qoldi
                                  </span>
                                </div>
                              </div>
                              <div className="h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-100">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${sharePct}%` }}
                                  transition={{ duration: 0.9, delay: idx * 0.1, ease: 'easeOut' }}
                                  className={`h-full bg-gradient-to-r ${col.bar} rounded-full shadow-sm`}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      {(() => {
                        const brandsWithStats = calculateBrandStockStats(brands, implants);
                        const placedBrands = brandsWithStats.filter(b => b.used_count > 0).sort((a, b) => b.used_count - a.used_count);
                        return placedBrands[0] ? `Eng ko'p ishlatiladigan: ${placedBrands[0].name}` : `Jami ${brands.length} ta brend omborda`;
                      })()}
                    </span>
                    <button
                      type="button"
                      onClick={() => setBrandsModalOpen(true)}
                      className="text-xs font-black text-indigo-600 hover:text-indigo-800 tracking-tight flex items-center gap-1 cursor-pointer"
                    >
                      Barcha brendlar & Zaxira boshqaruvi ({brands.length}) →
                    </button>
                  </div>
                </motion.div>

                {/* Lifecycle Status */}
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm shadow-slate-200/40"
                >
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                        <Activity className="w-5 h-5" />
                      </div>
                      <h3 className="text-sm font-[900] text-slate-900 uppercase tracking-tight">{t('implants.analysis.lifecycle')}</h3>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {Object.keys(LIFECYCLE_COLORS).map(statusKey => {
                      const cnt = implants.filter(i => {
                        const s = LIFECYCLE_MAPPING[i.lifecycle_status] || i.lifecycle_status?.toLowerCase();
                        return statusKey === (s || '').toLowerCase();
                      }).length;
                      if (cnt === 0) return null;
                      
                      return (
                        <div key={statusKey} className="flex items-center justify-between p-3 rounded-2xl border border-slate-50 hover:bg-slate-50 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${LIFECYCLE_COLORS[statusKey].split(' ')[1]}`} />
                            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">{t(`implants.status.${statusKey}`)}</span>
                          </div>
                          <span className="text-xs font-[900] text-slate-900 bg-white px-3 py-1 rounded-lg border border-slate-100 shadow-sm">{cnt}</span>
                        </div>
                      );
                    })}
                    {totalCount === 0 && <div className="py-10 text-center text-slate-400 font-bold text-xs uppercase tracking-widest">{t('common.noData')}</div>}
                  </div>
                </motion.div>
              </div>

              {/* Recent Activity List */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white border border-slate-100 rounded-[2rem] overflow-hidden shadow-sm shadow-slate-200/40"
              >
                <div className="px-6 py-5 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center">
                      <Zap className="w-4 h-4 text-slate-900" />
                    </div>
                    <h3 className="text-xs font-[900] text-slate-900 uppercase tracking-widest">{t('implants.analysis.recentActivity')}</h3>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setTab('list')} className="text-[10px] font-[900] uppercase tracking-widest text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50">
                    {t('implants.analysis.viewAll')} <ArrowRight className="ml-1 w-3 h-3" />
                  </Button>
                </div>
                
                {loading ? (
                  <div className="p-6 space-y-4">
                    {[1, 2, 3].map(i => <div key={i} className="h-16 bg-slate-50 rounded-2xl animate-pulse" />)}
                  </div>
                ) : implants.length === 0 ? (
                  <div className="py-20 text-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Activity className="w-8 h-8 text-slate-200" />
                    </div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('common.noData')}</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {implants.slice(0, 5).map(i => (
                      <Link key={i.id} to={`/implants/${i.id}`} className="group block">
                        <div className="px-6 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-all">
                          <div className="flex items-center gap-4">
                            <div className="relative w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100 group-hover:bg-white group-hover:shadow-md transition-all">
                              <Tooth className="w-6 h-6 text-indigo-400 group-hover:text-indigo-600 transition-colors" />
                              <div className="absolute -bottom-1 -right-1 min-w-6 h-6 px-1 rounded-lg bg-slate-900 text-white flex items-center justify-center text-[8px] font-black border-2 border-white flex-wrap gap-0.5">
                                {[...new Set((i.tooth_numbers || (i.tooth_number ? [i.tooth_number] : [])).map(String))].map(n => <span key={`tooth-${n}`}>#{toothIdToFdi(n)}</span>)}
                              </div>
                            </div>
                              <div>
                                <p className="text-sm font-bold text-slate-900 tracking-tight group-hover:text-indigo-600 transition-colors">
                                  {safeRender(i.patient_name)}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{safeRender(i.firma)}</span>
                                  <span className="w-1 h-1 bg-slate-200 rounded-full" />
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{safeRender(i.placement_date)}</span>
                                </div>
                              </div>
                            </div>
                            <div className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest border ${LIFECYCLE_COLORS[LIFECYCLE_MAPPING[i.lifecycle_status] || i.lifecycle_status?.toLowerCase()] || ''}`}>
                              {t(`implants.status.${LIFECYCLE_MAPPING[i.lifecycle_status] || i.lifecycle_status?.toLowerCase() || 'placed'}`)}
                            </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </motion.div>
            </TabsContent>

            {/* LIST CONTENT */}
            <TabsContent value="list" className="mt-0 space-y-6">
              {/* Premium Filters */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
                  <Input 
                    placeholder={t('implants.filters.search')} 
                    value={search} 
                    onChange={e => setSearch(e.target.value)} 
                    className="pl-12 h-12 bg-white border-slate-100 rounded-2xl focus:ring-slate-900 focus:border-slate-900 font-medium text-sm transition-all"
                  />
                </div>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="h-12 bg-white border-slate-100 rounded-2xl font-bold text-xs uppercase tracking-wider text-slate-600">
                    <SelectValue placeholder={t('implants.filters.allStatus')} />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-slate-100">
                    <SelectItem value={null} className="text-xs font-bold uppercase tracking-wider">{t('implants.filters.allStatus')}</SelectItem>
                    {Object.keys(LIFECYCLE_COLORS).map(s => (
                      <SelectItem key={s} value={s} className="text-xs font-bold uppercase tracking-wider">{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterFirma} onValueChange={setFilterFirma}>
                  <SelectTrigger className="h-12 bg-white border-slate-100 rounded-2xl font-bold text-xs uppercase tracking-wider text-slate-600">
                    <SelectValue placeholder={t('implants.filters.allBrands')} />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-slate-100">
                    <SelectItem value={null} className="text-xs font-bold uppercase tracking-wider">{t('implants.filters.allBrands')}</SelectItem>
                    {['Nobel', 'Osstem', 'Straumann', 'Nucleoss', 'Boshqa'].map(f => (
                      <SelectItem key={f} value={f} className="text-xs font-bold uppercase tracking-wider">{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Mobile-First List Card Design */}
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-white rounded-[2rem] animate-pulse border border-slate-100" />)}
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-24 text-center bg-white rounded-[3rem] border border-slate-100 border-dashed">
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Activity className="w-10 h-10 text-slate-200" />
                  </div>
                  <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">Implantlar topilmadi</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">Qidiruv parametrlarini o'zgartirib ko'ring</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filtered.map(i => (
                    <motion.div
                      layout
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      key={i.id}
                      className="group relative bg-white border border-slate-100 rounded-[2rem] p-5 hover:shadow-xl hover:shadow-slate-200/40 transition-all duration-300"
                    >
                      <Link to={`/implants/${i.id}`} className="absolute inset-0 z-10" />
                      
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center relative group-hover:scale-110 transition-transform">
                            <Tooth className="w-7 h-7 text-indigo-400" />
                            <div className="absolute -top-2 -right-2 min-w-7 h-7 px-1 rounded-xl bg-slate-900 text-white flex items-center justify-center text-[8px] font-black border-2 border-white shadow-sm flex-wrap gap-0.5">
                              {[...new Set((i.tooth_numbers || (i.tooth_number ? [i.tooth_number] : [])).map(String))].map(n => <span key={`tooth-badge-${n}`}>#{toothIdToFdi(n)}</span>)}
                            </div>
                          </div>
                          <div>
                            <h4 className="text-base font-black text-slate-900 tracking-tight leading-tight group-hover:text-indigo-600 transition-colors">
                              {safeRender(i.patient_name)}
                            </h4>
                            <div className="flex items-center gap-2 mt-1">
                              <Phone className="w-3 h-3 text-slate-400" />
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{safeRender(i.patient_phone, 'Noma\'lum')}</span>
                            </div>
                          </div>
                        </div>
                        <div className="relative z-20" onClick={(e) => e.stopPropagation()}>
                          <Select 
                            value={LIFECYCLE_MAPPING[i.lifecycle_status] || i.lifecycle_status?.toLowerCase() || 'placed'} 
                            onValueChange={async (newVal) => {
                              const statusLabel = Object.keys(LIFECYCLE_MAPPING).find(key => LIFECYCLE_MAPPING[key] === newVal) || newVal;
                              
                              // Optimistic Update
                              const oldImplants = [...implants];
                              setImplants(prev => prev.map(item => 
                                item.id === i.id ? { ...item, lifecycle_status: statusLabel } : item
                              ));

                              try {
                                const { error } = await base44.entities.Implant.update(i.id, { lifecycle_status: statusLabel });
                                if (error) throw error;
                                // Success - no reload needed
                              } catch (e) {
                                // Rollback
                                setImplants(oldImplants);
                                console.error("Implant status update error:", e);
                                alert("Xatolik: Status saqlanmadi.");
                              }
                            }}
                          >
                            <SelectTrigger className={`h-8 px-3 rounded-xl text-[9px] font-black uppercase tracking-[0.1em] border min-w-[120px] transition-all ${LIFECYCLE_COLORS[LIFECYCLE_MAPPING[i.lifecycle_status] || i.lifecycle_status?.toLowerCase()] || ''}`}>
                              <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl border-slate-100">
                              {Object.keys(LIFECYCLE_COLORS).map(s => (
                                <SelectItem key={s} value={s} className="text-[10px] font-black uppercase tracking-widest py-2">
                                  {t(`implants.status.${s}`)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="bg-slate-50/50 rounded-2xl p-3 border border-slate-100/50">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Brend & Model</p>
                          <p className={`text-[11px] font-bold text-slate-800 uppercase tracking-tight truncate`}>
                            {i.firma === 'Boshqa' ? i.firma_custom || t('common.other') : i.firma} · {i.brend || '—'}
                          </p>
                        </div>
                        <div className="bg-slate-50/50 rounded-2xl p-3 border border-slate-100/50">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">O'lchamlar</p>
                          <p className="text-[11px] font-bold text-slate-800 uppercase tracking-tight">
                            {i.diameter && i.length ? `Ø${safeRender(i.diameter)} × ${safeRender(i.length)}mm` : (safeRender(i.diameter) !== '—' ? `Ø${safeRender(i.diameter)}` : '—')}
                          </p>
                        </div>
                      </div>

                      {i.extra_services && i.extra_services.length > 0 && (
                        <div className="mb-4 bg-indigo-50/50 rounded-2xl p-3 border border-indigo-100/50">
                           <p className="text-[8px] font-black text-indigo-500 uppercase tracking-widest mb-2 flex items-center gap-1">
                             <Layers className="w-3 h-3" /> {t('implants.table.extraServices')}
                           </p>
                           <div className="flex flex-wrap gap-1.5">
                             {i.extra_services.slice(0, 3).map(serviceId => (
                               <span key={serviceId} className="px-2 py-1 bg-white text-indigo-600 rounded-lg text-[9px] font-bold border border-indigo-100 shadow-sm whitespace-nowrap">
                                 {EXTRA_SERVICES.find(s => s.id === serviceId)?.label || serviceId}
                               </span>
                             ))}
                             {i.extra_services.length > 3 && (
                               <span className="px-2 py-1 bg-indigo-100/60 text-indigo-700 rounded-lg text-[9px] font-bold border border-indigo-200/50">
                                 +{i.extra_services.length - 3} ta
                               </span>
                             )}
                           </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{i.placement_date}</span>
                          </div>
                        </div>
                        
                        {i.reminder_date && (() => {
                          const daysLeft = Math.ceil((new Date(i.reminder_date) - today) / 86400000);
                          const isOverdue = daysLeft < 0;
                          const isUrgent = daysLeft <= 7 && daysLeft >= 0;
                          
                          return (
                            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl ${
                              isOverdue ? 'bg-rose-100 text-rose-700 border border-rose-200' : 
                              isUrgent ? 'bg-amber-50 text-amber-600' : 
                              daysLeft <= 14 ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-500'
                            }`}>
                              <Bell className={`w-3 h-3 ${isOverdue ? 'animate-pulse' : ''}`} />
                              <span className="text-[9px] font-black uppercase tracking-widest">
                                {isOverdue ? t('implants.alerts.overdue', { days: Math.abs(daysLeft) }) : 
                                 daysLeft === 0 ? t('implants.alerts.today') : 
                                 t('implants.alerts.remaining', { days: daysLeft })}
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </TabsContent>
          </AnimatePresence>
        </Tabs>
      </div>

      {/* Add Modal */}
      <ImplantForm
        open={addOpen}
        onClose={() => setAddOpen(false)}
        patients={patients}
        services={services}
        onSaved={() => { load(); setTab('list'); }}
      />

      {/* Brands & Stock Management Modal */}
      <ImplantBrandsModal
        open={brandsModalOpen}
        onClose={() => setBrandsModalOpen(false)}
        implants={implants}
        onBrandsUpdated={load}
      />
    </div>
  );
}
