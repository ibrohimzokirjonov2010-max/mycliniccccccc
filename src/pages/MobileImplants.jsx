import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, Activity, AlertTriangle, CheckCircle2,
  ChevronRight, TrendingUp, Bell, Target, Phone, Calendar,
  Layers, MessageCircle, Zap, X, Filter, SlidersHorizontal,
  Award, Clock, ArrowUpRight, RefreshCw, FileEdit, Sparkles
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import PullToRefresh from '@/components/ui/PullToRefresh';
import ImplantForm, { EXTRA_SERVICES } from '@/components/implants/ImplantForm';
import ExtraServiceModal from '@/components/implants/ExtraServiceModal';
import ExtraServicesManagerModal from '@/components/implants/ExtraServicesManagerModal';
import ImplantBrandsModal, { getOrSeedImplantBrands, calculateBrandStockStats } from '@/components/implants/ImplantBrandsModal';
import { useFeature } from '@/hooks/useFeature';
import { Package } from 'lucide-react';
import Paywall from '@/components/layout/Paywall';
import { useTranslation } from '@/i18n/LanguageContext';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { 
  ImplantIcon, CrownIcon, FormerIcon, AbutmentIcon, 
  BoneGraftIcon, SinusLiftIcon, DentalSurgicalIcon, 
  BrandStockIcon, KiritishTalabIcon, ClinicalControlIcon 
} from '@/components/ui/Icons';

// ─── Constants ────────────────────────────────────────────────────────────────
const LIFECYCLE_MAPPING = {
  'Rejalashtirilgan': 'planned',
  "O'rnatildi": 'placed',
  'Healing jarayoni': 'healing',
  "Abutment qo'yildi": 'abutment',
  'Crown tayyor': 'crown',
  'Tugallangan': 'completed',
  'Failure': 'failure',
};

const LIFECYCLE_CONFIG = {
  planned:   { label: 'Rejalashtirilgan', bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-500',    border: 'border-blue-200' },
  placed:    { label: "O'rnatildi",        bg: 'bg-teal-50',    text: 'text-teal-700',    dot: 'bg-teal-500',    border: 'border-teal-200' },
  healing:   { label: 'Healing',           bg: 'bg-amber-50',   text: 'text-amber-800',   dot: 'bg-amber-500',   border: 'border-amber-200' },
  abutment:  { label: 'Abutment',          bg: 'bg-purple-50',  text: 'text-purple-700',  dot: 'bg-purple-500',  border: 'border-purple-200' },
  crown:     { label: 'Crown tayyor',      bg: 'bg-indigo-50',  text: 'text-indigo-700',  dot: 'bg-indigo-500',  border: 'border-indigo-200' },
  completed: { label: 'Tugallangan',       bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', border: 'border-emerald-200' },
  failure:   { label: 'Failure',           bg: 'bg-rose-50',    text: 'text-rose-700',    dot: 'bg-rose-500',    border: 'border-rose-200' },
};

const BRAND_COLORS = [
  { bar: 'from-indigo-500 to-blue-500',   bg: 'bg-indigo-50',  text: 'text-indigo-600',  dot: 'bg-indigo-500' },
  { bar: 'from-violet-500 to-purple-500', bg: 'bg-violet-50',  text: 'text-violet-600',  dot: 'bg-violet-500' },
  { bar: 'from-teal-500 to-emerald-500',  bg: 'bg-teal-50',    text: 'text-teal-600',    dot: 'bg-teal-500' },
  { bar: 'from-amber-500 to-orange-500',  bg: 'bg-amber-50',   text: 'text-amber-600',   dot: 'bg-amber-500' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getLifecycleKey = (status) =>
  LIFECYCLE_MAPPING[status] || status?.toLowerCase() || 'placed';

const getLifecycleCfg = (status) =>
  LIFECYCLE_CONFIG[getLifecycleKey(status)] || LIFECYCLE_CONFIG.placed;

const toothIdToFdi = (id) => {
  if (!id) return id;
  const s = String(id);
  const match = s.match(/^(ur|ul|lr|ll)(\d+)$/);
  if (!match) return s;
  const [, quad, num] = match;
  return { ur: '1', ul: '2', ll: '3', lr: '4' }[quad] + num;
};

const safeRender = (val, fallback = '—') => {
  if (val == null || val === '') return fallback;
  if (typeof val === 'string' || typeof val === 'number') return val;
  if (typeof val === 'object') return val.label || val.name || fallback;
  return String(val);
};

const formatReminderDays = (reminder_date) => {
  if (!reminder_date) return null;
  const today = new Date();
  const rd = new Date(reminder_date);
  const days = Math.ceil((rd - today) / 86400000);
  return days;
};

// ─── Skeleton Loader ──────────────────────────────────────────────────────────
const SkeletonCard = () => (
  <div className="bg-white rounded-[1.75rem] p-4 border border-slate-100 animate-pulse">
    <div className="flex items-center gap-3 mb-4">
      <div className="w-12 h-12 bg-slate-100 rounded-2xl" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-slate-200 rounded-lg w-3/4" />
        <div className="h-3 bg-slate-100 rounded-lg w-1/2" />
      </div>
      <div className="w-20 h-7 bg-slate-100 rounded-xl" />
    </div>
    <div className="grid grid-cols-2 gap-2">
      <div className="h-10 bg-slate-50 rounded-xl" />
      <div className="h-10 bg-slate-50 rounded-xl" />
    </div>
  </div>
);

// ─── Status Badge ─────────────────────────────────────────────────────────────
const StatusPill = ({ status }) => {
  const cfg = getLifecycleCfg(status);
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
};

// ─── Resolve Service & Price ──────────────────────────────────────────────
const resolveService = (implant) => {
  if (implant.service_name && implant.service_name.trim()) return implant.service_name.trim();
  if (implant.hizmat_turi && implant.hizmat_turi.trim()) return implant.hizmat_turi.trim();
  const status = (implant.lifecycle_status || '').toLowerCase();
  if (status.includes('crown') || status.includes('karonka')) return 'Karonka';
  if (status.includes('abutment')) return 'Abutment';
  if (status.includes('healing') || status.includes('formik')) return 'Formik';
  return 'Implant';
};

const resolvePrice = (implant) => {
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
  return 1500000;
};

const getServiceIcon = (serviceName) => {
  const s = (serviceName || '').toLowerCase();
  if (s.includes('karonka') || s.includes('crown') || s.includes('toj')) return CrownIcon;
  if (s.includes('formik') || s.includes('healing')) return FormerIcon;
  if (s.includes('abutment') || s.includes('abatment')) return AbutmentIcon;
  if (s.includes('sinus')) return SinusLiftIcon;
  if (s.includes('suyak') || s.includes('graft') || s.includes('membrana')) return BoneGraftIcon;
  if (s.includes('implant')) return ImplantIcon;
  return DentalSurgicalIcon;
};

// ─── Implant Card ─────────────────────────────────────────────────────────────
const ImplantCard = ({ implant, onStatusChange, onNavigate, today }) => {
  const cfg = getLifecycleCfg(implant.lifecycle_status);
  const teeth = [...new Set((implant.tooth_numbers || (implant.tooth_number ? [implant.tooth_number] : [])).map(String))];
  const daysLeft = formatReminderDays(implant.reminder_date);
  const isOverdue = daysLeft !== null && daysLeft < 0;
  const isUrgent = daysLeft !== null && daysLeft >= 0 && daysLeft <= 7;
  const isSoon = daysLeft !== null && daysLeft > 7 && daysLeft <= 14;

  const serviceName = resolveService(implant);
  const SvcIcon = getServiceIcon(serviceName);
  const priceVal = resolvePrice(implant);
  const firmaName = implant.firma === 'Boshqa' ? (implant.firma_custom || 'Boshqa') : (implant.firma || 'Dentium');

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="bg-white rounded-[1.75rem] border border-slate-100 shadow-sm shadow-slate-100/60 overflow-hidden active:scale-[0.99] transition-transform"
      onClick={() => onNavigate(implant.id)}
    >
      {/* Card Top */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          {/* Avatar + Info */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* Tooth Badge */}
            <div className="relative flex-shrink-0">
              <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700">
                <SvcIcon className="w-6 h-6" />
              </div>
              {teeth.length > 0 && (
                <div className="absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] px-1 bg-slate-900 text-white rounded-lg text-[9px] font-black border-2 border-white flex items-center justify-center">
                  #{toothIdToFdi(teeth[0])}{teeth.length > 1 ? `+${teeth.length - 1}` : ''}
                </div>
              )}
            </div>

            {/* Name & Service & Firm */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-slate-900 text-white uppercase tracking-wider">
                  {serviceName}
                </span>
                {(implant.incomplete_data === true || implant.needs_fill === true || (!implant.firma && !implant.brend && !implant.firma_custom)) ? (
                  <span className="inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-300 animate-pulse">
                    <KiritishTalabIcon className="w-2.5 h-2.5 text-amber-600" />
                    Kiritish kerak
                  </span>
                ) : (
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider truncate">
                    {firmaName}
                  </span>
                )}
              </div>
              <p className="text-sm font-black text-slate-900 tracking-tight truncate mt-1">
                {safeRender(implant.patient_name)}
              </p>
            </div>
          </div>

          {/* Price Tag Badge */}
          <div className="flex flex-col items-end shrink-0">
            <span className="font-mono font-black text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
              {priceVal.toLocaleString()} so'm
            </span>
          </div>
        </div>

        {/* Details Row: Sana, Tish, Firma, Holat */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-100/60">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Amaliyot Sanasi</p>
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-400" />
              <p className="text-[11px] font-bold text-slate-700 font-mono">{safeRender(implant.placement_date)}</p>
            </div>
          </div>

          <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-100/60 flex items-center justify-between">
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Holat</p>
              <StatusPill status={implant.lifecycle_status} />
            </div>
          </div>
        </div>

        {/* Extra Services */}
        {implant.extra_services?.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {implant.extra_services.slice(0, 2).map(sid => (
              <span key={sid} className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-bold border border-indigo-100">
                {EXTRA_SERVICES.find(s => s.id === sid)?.label?.split(' ')[0] || sid}
              </span>
            ))}
            {implant.extra_services.length > 2 && (
              <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-lg text-[9px] font-bold">
                +{implant.extra_services.length - 2}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Card Footer — Quick Actions */}
      <div className="px-4 py-2.5 bg-slate-50/60 border-t border-slate-100/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {implant.patient_phone && (
            <button
              onClick={(e) => { e.stopPropagation(); window.location.href = `tel:${implant.patient_phone}`; }}
              className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 active:scale-90 transition-transform"
            >
              <Phone className="w-3.5 h-3.5" />
            </button>
          )}
          {implant.patient_phone && (
            <button
              onClick={(e) => { e.stopPropagation(); window.open(`https://t.me/${implant.patient_phone.replace(/\D/g, '')}`, '_blank'); }}
              className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100 active:scale-90 transition-transform"
            >
              <MessageCircle className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1 text-slate-400">
          <span className="text-[10px] font-bold uppercase tracking-wider">Batafsil</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </div>
      </div>
    </motion.div>
  );
};

// ─── Stat Card ─────────────────────────────────────────────────────────────────
const StatCard = ({ value, label, icon: Icon, color, bg, delay = 0, badge }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-sm relative overflow-hidden"
  >
    <div className={`absolute -right-2 -top-2 w-14 h-14 ${bg} opacity-30 rounded-full blur-xl`} />
    <div className={`w-8 h-8 rounded-xl ${bg} flex items-center justify-center mb-2`}>
      <Icon className={`w-4 h-4 ${color}`} />
    </div>
    <p className="text-lg font-[900] text-slate-900 leading-none tracking-tighter">
      {value}
      {badge && <span className="text-[10px] font-bold text-slate-400 ml-0.5">{badge}</span>}
    </p>
    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{label}</p>
  </motion.div>
);

// ─── Filter Sheet ─────────────────────────────────────────────────────────────
const FilterSheet = ({ open, onClose, filterStatus, setFilterStatus, filterFirma, setFilterFirma, onReset }) => (
  <AnimatePresence>
    {open && (
      <>
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40"
          onClick={onClose}
        />
        <motion.div
          initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[2.5rem] z-50 pb-safe"
        >
          <div className="flex flex-col p-5 pb-8">
            {/* Handle */}
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-5" />

            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-[900] text-slate-900 uppercase tracking-tight">Filtr</h3>
              <button
                onClick={onReset}
                className="text-[11px] font-bold text-rose-500 uppercase tracking-wider"
              >
                Tozalash
              </button>
            </div>

            {/* Status Filter */}
            <div className="mb-5">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5">Holat</p>
              <div className="flex flex-wrap gap-2">
                {[null, ...Object.keys(LIFECYCLE_CONFIG)].map(s => {
                  const cfg = s ? LIFECYCLE_CONFIG[s] : null;
                  const isActive = filterStatus === s;
                  return (
                    <button
                      key={s || 'all'}
                      onClick={() => setFilterStatus(s)}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${
                        isActive
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-slate-50 text-slate-600 border-slate-100'
                      }`}
                    >
                      {s ? `${cfg.emoji} ${cfg.label}` : 'Barchasi'}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Brand Filter */}
            <div className="mb-5">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5">Brend</p>
              <div className="flex flex-wrap gap-2">
                {[null, 'Nobel', 'Osstem', 'Straumann', 'Nucleoss', 'Boshqa'].map(f => {
                  const isActive = filterFirma === f;
                  return (
                    <button
                      key={f || 'all'}
                      onClick={() => setFilterFirma(f)}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${
                        isActive
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-slate-50 text-slate-600 border-slate-100'
                      }`}
                    >
                      {f || 'Barchasi'}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full py-3.5 bg-slate-900 text-white rounded-2xl font-black text-sm uppercase tracking-wider"
            >
              Qo'llash
            </button>
          </div>
        </motion.div>
      </>
    )}
  </AnimatePresence>
);

// ─── Status Update Sheet ──────────────────────────────────────────────────────
const StatusUpdateSheet = ({ open, implant, onClose, onUpdate, updating }) => (
  <AnimatePresence>
    {open && implant && (
      <>
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40"
          onClick={onClose}
        />
        <motion.div
          initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[2.5rem] z-50 pb-safe"
        >
          <div className="flex flex-col p-5 pb-8">
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-5" />
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-[900] text-slate-900">Holatni o'zgartirish</h3>
              <button onClick={onClose} className="p-2 rounded-xl bg-slate-100">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <p className="text-[11px] font-bold text-slate-400 mb-4">
              {safeRender(implant.patient_name)} — #{(implant.tooth_numbers || [implant.tooth_number]).map(toothIdToFdi).join(', #')}
            </p>

            <div className="space-y-2">
              {Object.entries(LIFECYCLE_CONFIG).map(([key, cfg]) => {
                const currentKey = getLifecycleKey(implant.lifecycle_status);
                const isActive = currentKey === key;
                return (
                  <button
                    key={key}
                    onClick={() => onUpdate(implant, key)}
                    disabled={updating || isActive}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all ${
                      isActive
                        ? `${cfg.bg} ${cfg.border} ${cfg.text}`
                        : 'bg-slate-50 border-slate-100 text-slate-700 active:scale-[0.98]'
                    }`}
                  >
                    <span className="text-lg">{cfg.emoji}</span>
                    <span className="text-sm font-bold flex-1 text-left">{cfg.label}</span>
                    {isActive && (
                      <span className="w-5 h-5 rounded-full bg-white flex items-center justify-center shadow-sm">
                        <CheckCircle2 className={`w-3.5 h-3.5 ${cfg.text}`} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </motion.div>
      </>
    )}
  </AnimatePresence>
);

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MobileImplants() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, isDoctor } = useAuth();
  const hasImplantsAccess = useFeature('implants');

  const [implants, setImplants] = useState([]);
  const [patients, setPatients] = useState([]);
  const [services, setServices] = useState([]);
  const [brands, setBrands] = useState([]);
  const [brandsModalOpen, setBrandsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const hasLoadedInitial = useRef(false);
  const loadingTimerRef = useRef(null);

  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'stats'
  const [filterStatus, setFilterStatus] = useState(null);
  const [filterFirma, setFilterFirma] = useState(null);
  const [showFilter, setShowFilter] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [extraServiceModalOpen, setExtraServiceModalOpen] = useState(false);
  const [editingExtraService, setEditingExtraService] = useState(null);
  const [extraServicesManagerOpen, setExtraServicesManagerOpen] = useState(false);
  const [statusSheet, setStatusSheet] = useState({ open: false, implant: null });
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const today = useMemo(() => new Date(), []);

  // ── Load Data ──
  const load = useCallback(async () => {
    try {
      if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
      if (!hasLoadedInitial.current) {
        loadingTimerRef.current = setTimeout(() => setLoading(true), 150);
      }
      const [imps, pats, svcs, brnds] = await Promise.all([
        base44.entities.Implant.list('-placement_date', 300),
        base44.entities.Patient.list('full_name', 100),
        base44.entities.Service.filter({ is_active: true }, 'name', 100),
        getOrSeedImplantBrands(),
      ]);
      // Doktor bo'lsa faqat o'z bemorlarining implantlarini ko'rsin
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
      hasLoadedInitial.current = true;
    } catch (err) {
      console.error('Failed to load implants:', err);
      toast.error('Implantlarni yuklashda xatolik');
    } finally {
      if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
      setLoading(false);
    }
  }, [isDoctor, user?.id]);

  useEffect(() => { load(); }, [load]);

  // ── FAB custom event ──
  useEffect(() => {
    const handler = () => setAddOpen(true);
    window.addEventListener('open-implants-add', handler);
    return () => window.removeEventListener('open-implants-add', handler);
  }, []);

  // ── Stats ──
  const stats = useMemo(() => {
    const total = implants.length;
    const thirtyAgo = new Date(today.getTime() - 30 * 86400000).toISOString().split('T')[0];
    const recent = implants.filter(i => i.placement_date >= thirtyAgo).length;
    const failures = implants.filter(i => getLifecycleKey(i.lifecycle_status) === 'failure').length;
    const completed = implants.filter(i => getLifecycleKey(i.lifecycle_status) === 'completed').length;
    const successRate = total > 0 ? Math.round(((total - failures) / total) * 100) : 0;
    const needsControl = implants.filter(i => {
      if (!i.reminder_date) return false;
      const diff = (new Date(i.reminder_date) - today) / 86400000;
      return diff <= 14 && diff >= -7;
    });

    const brandMap = {};
    implants.forEach(i => {
      const b = i.firma === 'Boshqa' ? (i.firma_custom || 'Boshqa') : i.firma;
      if (b) brandMap[b] = (brandMap[b] || 0) + 1;
    });
    const topBrands = Object.entries(brandMap).sort((a, b) => b[1] - a[1]).slice(0, 4);

    const statusDist = {};
    implants.forEach(i => {
      const k = getLifecycleKey(i.lifecycle_status);
      statusDist[k] = (statusDist[k] || 0) + 1;
    });

    return { total, recent, failures, completed, successRate, needsControl, topBrands, statusDist };
  }, [implants, today]);

  // ── Filtered ──
  const filtered = useMemo(() => {
    return implants.filter(i => {
      const teeth = i.tooth_numbers || (i.tooth_number ? [i.tooth_number] : []);
      const matchSearch = !search ||
        i.patient_name?.toLowerCase().includes(search.toLowerCase()) ||
        teeth.some(n => String(n).includes(search));
      const matchStatus = !filterStatus ||
        getLifecycleKey(i.lifecycle_status) === filterStatus;
      const matchFirma = !filterFirma || i.firma === filterFirma;
      return matchSearch && matchStatus && matchFirma;
    });
  }, [implants, search, filterStatus, filterFirma]);

  const activeFilters = (filterStatus ? 1 : 0) + (filterFirma ? 1 : 0);

  // ── Status Update ──
  const handleStatusUpdate = async (implant, newStatusKey) => {
    const statusLabel = Object.keys(LIFECYCLE_MAPPING).find(k => LIFECYCLE_MAPPING[k] === newStatusKey) || newStatusKey;
    setUpdatingStatus(true);
    const oldImplants = [...implants];
    setImplants(prev => prev.map(item =>
      item.id === implant.id ? { ...item, lifecycle_status: statusLabel } : item
    ));
    try {
      await base44.entities.Implant.update(implant.id, { lifecycle_status: statusLabel });
      toast.success('Holat yangilandi!');
      setStatusSheet({ open: false, implant: null });
    } catch (e) {
      setImplants(oldImplants);
      toast.error('Xatolik yuz berdi');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // ── Paywall ──
  if (!hasImplantsAccess) return <Paywall featureName="Implantlar" />;

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <PullToRefresh onRefresh={load}>
        {/* ── Header ── */}
        <div className="px-4 pt-2 pb-3">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl font-[900] text-slate-900 tracking-tighter flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                  <ImplantIcon className="w-4.5 h-4.5 text-white" />
                </div>
                Implantlar & Xizmatlar
              </h1>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                {stats.total} ta amaliyot · {stats.successRate}% muvaffaqiyat
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={() => setExtraServicesManagerOpen(true)}
                className="h-10 px-3 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-2xl flex items-center gap-1.5 font-black text-xs shadow-xs"
                title="Qo'shimcha xizmatlar prays-listi"
              >
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>Prays-list</span>
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={() => setAddOpen(true)}
                className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200/60 text-white"
                title="Yangi implant qo'shish"
              >
                <Plus className="w-5 h-5" />
              </motion.button>
            </div>
          </div>

          {/* ── Tabs ── */}
          <div className="flex gap-2 mb-3">
            {[
              { key: 'list', label: 'Ro\'yxat' },
              { key: 'stats', label: 'Statistika' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${
                  activeTab === tab.key
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-white text-slate-500 border border-slate-100'
                }`}
              >
                {tab.label}
                {tab.key === 'list' && stats.needsControl.length > 0 && (
                  <span className="ml-1 text-amber-500">({stats.needsControl.length})</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── LIST TAB ── */}
        {activeTab === 'list' && (
          <div className="px-4 pb-4 space-y-3">
            {/* Search + Filter Row */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Bemor yoki tish raqami..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    <X className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                )}
              </div>
              <button
                onClick={() => setShowFilter(true)}
                className={`relative w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 transition-all ${
                  activeFilters > 0
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200'
                    : 'bg-white border-slate-200 text-slate-600'
                }`}
              >
                <SlidersHorizontal className="w-4 h-4" />
                {activeFilters > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-rose-500 text-white rounded-full text-[9px] font-black flex items-center justify-center border-2 border-white">
                    {activeFilters}
                  </span>
                )}
              </button>
            </div>

            {/* Urgent Alerts Strip */}
            <AnimatePresence>
              {stats.needsControl.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100 rounded-2xl p-3"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 bg-amber-500 rounded-lg flex items-center justify-center">
                      <AlertTriangle className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="text-[11px] font-black text-amber-700 uppercase tracking-wider">
                      {stats.needsControl.length} ta nazorat kerak
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {stats.needsControl.slice(0, 3).map(i => {
                      const days = formatReminderDays(i.reminder_date);
                      return (
                        <button
                          key={i.id}
                          onClick={() => navigate(`/implants/${i.id}`)}
                          className="w-full flex items-center justify-between bg-white/80 rounded-xl px-3 py-2 border border-amber-100/50 active:scale-[0.98] transition-transform"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-lg">
                              #{(i.tooth_numbers || [i.tooth_number]).map(toothIdToFdi).join(',')}
                            </span>
                            <span className="text-[11px] font-bold text-slate-700 truncate max-w-[120px]">{i.patient_name}</span>
                          </div>
                          <span className={`text-[10px] font-black ${days < 0 ? 'text-rose-600' : 'text-amber-600'}`}>
                            {days < 0 ? `${Math.abs(days)}k o'tdi` : days === 0 ? 'BUGUN' : `${days} kun`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Results info */}
            {(search || filterStatus || filterFirma) && (
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                {filtered.length} ta natija
                {search && ` · "${search}"`}
              </p>
            )}

            {/* Cards */}
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
              </div>
            ) : filtered.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-16 flex flex-col items-center gap-3"
              >
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                  <Activity className="w-8 h-8 text-slate-300" />
                </div>
                <p className="text-sm font-black text-slate-500 uppercase tracking-tight">
                  {search ? 'Natija topilmadi' : 'Implantlar yo\'q'}
                </p>
                {!search && (
                  <button
                    onClick={() => setAddOpen(true)}
                    className="mt-1 flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider"
                  >
                    <Plus className="w-3.5 h-3.5" /> Yangi qo'shish
                  </button>
                )}
              </motion.div>
            ) : (
              <AnimatePresence mode="popLayout">
                <div className="space-y-3">
                  {filtered.map(implant => (
                    <div key={implant.id} className="relative">
                      <ImplantCard
                        implant={implant}
                        today={today}
                        onNavigate={(id) => navigate(`/implants/${id}`)}
                        onStatusChange={(imp) => setStatusSheet({ open: true, implant: imp })}
                      />
                      {/* Long press / swipe hint — status change button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); setStatusSheet({ open: true, implant }); }}
                        className="absolute top-3 right-3 w-7 h-7 bg-slate-100 rounded-xl flex items-center justify-center z-10 active:scale-90 transition-transform"
                        style={{ display: 'none' }}
                      />
                    </div>
                  ))}
                </div>
              </AnimatePresence>
            )}
          </div>
        )}

        {/* ── STATS TAB ── */}
        {activeTab === 'stats' && (
          <div className="px-4 pb-4 space-y-4">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard value={stats.total}        label="Jami implant"   icon={ImplantIcon}          color="text-indigo-600" bg="bg-indigo-50"  delay={0.05} />
              <StatCard value={stats.recent}       label="30 kunda"       icon={TrendingUp}   color="text-blue-600"   bg="bg-blue-50"   delay={0.10} />
              <StatCard value={`${stats.successRate}%`} label="Muvaffaqiyat" icon={CheckCircle2} color="text-emerald-600" bg="bg-emerald-50" delay={0.15} badge={stats.failures > 0 ? ` (${stats.failures} failure)` : ''} />
              <StatCard value={stats.needsControl.length} label="Nazorat kerak" icon={Bell} color="text-amber-600"  bg="bg-amber-50"  delay={0.20} />
            </div>

            {/* Brand Performance & Stock */}
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
              className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-indigo-50 flex items-center justify-center">
                    <Target className="w-3.5 h-3.5 text-indigo-600" />
                  </div>
                  <h3 className="text-xs font-[900] text-slate-900 uppercase tracking-tight">Brendlar & Zaxira</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setBrandsModalOpen(true)}
                  className="px-2.5 py-1 rounded-xl bg-indigo-50 text-indigo-700 font-black text-[10px] uppercase tracking-wider flex items-center gap-1 border border-indigo-200/50"
                >
                  <Package className="w-3 h-3" />
                  Boshqarish
                </button>
              </div>

              {(() => {
                const brandsWithStats = calculateBrandStockStats(brands, implants);
                const placedBrands = brandsWithStats.filter(b => b.used_count > 0).sort((a, b) => b.used_count - a.used_count);

                if (placedBrands.length === 0) {
                  return (
                    <div className="py-6 text-center space-y-1">
                      <p className="text-xs font-bold text-slate-500">Hozircha implant o'rnatilmagan</p>
                      <p className="text-[10px] text-slate-400">Implant o'rnatilgach, ulushi shu yerda ko'rsatiladi.</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-3">
                    {placedBrands.map((brand, idx) => {
                      const col = BRAND_COLORS[idx % BRAND_COLORS.length];
                      const sharePct = stats.total > 0 ? Math.round((brand.used_count / stats.total) * 100) : 0;

                      return (
                        <div key={brand.id || brand.name} className="p-1.5 rounded-xl">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className={`w-2 h-2 rounded-full ${col.dot} shrink-0`} />
                              <span className="text-xs font-[900] text-slate-800 uppercase tracking-wide truncate">{brand.name}</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className={`text-[10px] font-black ${col.text} ${col.bg} px-1.5 py-0.5 rounded-md`}>
                                {sharePct}%
                              </span>
                              <span className="text-xs font-black text-slate-900">{brand.used_count} ta</span>
                              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${
                                brand.is_out_of_stock 
                                  ? 'bg-rose-100 text-rose-700' 
                                  : brand.is_low_stock 
                                    ? 'bg-amber-100 text-amber-800' 
                                    : 'bg-emerald-50 text-emerald-700'
                              }`}>
                                {brand.remaining_stock} ta qoldi
                              </span>
                            </div>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${sharePct}%` }}
                              transition={{ duration: 0.8, delay: idx * 0.1, ease: 'easeOut' }}
                              className={`h-full bg-gradient-to-r ${col.bar} rounded-full`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              <button
                type="button"
                onClick={() => setBrandsModalOpen(true)}
                className="w-full pt-2 border-t border-slate-100 text-center text-xs font-black text-indigo-600 tracking-tight"
              >
                Barcha brendlarni ko'rish va zaxira kiritish ({brands.length}) →
              </button>
            </motion.div>

            {/* Lifecycle Distribution */}
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.30 }}
              className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm"
            >
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <Activity className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <h3 className="text-xs font-[900] text-slate-900 uppercase tracking-tight">Jarayon holatlari</h3>
              </div>
              <div className="space-y-2">
                {Object.entries(LIFECYCLE_CONFIG).map(([key, cfg]) => {
                  const cnt = stats.statusDist[key] || 0;
                  if (cnt === 0) return null;
                  return (
                    <div key={key} className={`flex items-center justify-between px-3 py-2.5 rounded-xl ${cfg.bg} border ${cfg.border}`}>
                      <div className="flex items-center gap-2">
                        <span>{cfg.emoji}</span>
                        <span className={`text-[11px] font-bold ${cfg.text} uppercase tracking-wide`}>{cfg.label}</span>
                      </div>
                      <span className={`text-sm font-[900] ${cfg.text}`}>{cnt}</span>
                    </div>
                  );
                })}
                {stats.total === 0 && (
                  <p className="text-center text-[11px] font-bold text-slate-400 py-6">Ma'lumot yo'q</p>
                )}
              </div>
            </motion.div>

            {/* Quick Nav to List */}
            {stats.total > 0 && (
              <button
                onClick={() => setActiveTab('list')}
                className="w-full flex items-center justify-between bg-slate-900 text-white rounded-2xl px-5 py-3.5"
              >
                <span className="text-sm font-black uppercase tracking-wider">Ro'yxatni ko'rish</span>
                <ArrowUpRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </PullToRefresh>

      {/* ── Filter Sheet ── */}
      <FilterSheet
        open={showFilter}
        onClose={() => setShowFilter(false)}
        filterStatus={filterStatus}
        setFilterStatus={setFilterStatus}
        filterFirma={filterFirma}
        setFilterFirma={setFilterFirma}
        onReset={() => { setFilterStatus(null); setFilterFirma(null); }}
      />

      {/* ── Status Update Sheet ── */}
      <StatusUpdateSheet
        open={statusSheet.open}
        implant={statusSheet.implant}
        onClose={() => setStatusSheet({ open: false, implant: null })}
        onUpdate={handleStatusUpdate}
        updating={updatingStatus}
      />

      {/* ── Add Implant Modal ── */}
      <ImplantForm
        open={addOpen}
        onClose={() => setAddOpen(false)}
        patients={patients}
        services={services}
        onSaved={() => { load(); setAddOpen(false); toast.success('Implant qo\'shildi!'); }}
      />

      {/* ── Add/Edit Extra Service Modal (Patient operation) ── */}
      <ExtraServiceModal
        open={extraServiceModalOpen || !!editingExtraService}
        onClose={() => { setExtraServiceModalOpen(false); setEditingExtraService(null); }}
        patients={patients}
        serviceItem={editingExtraService}
        onSaved={() => { load(); setExtraServiceModalOpen(false); setEditingExtraService(null); }}
      />

      {/* ── Extra Services & Price List Management Modal ── */}
      <ExtraServicesManagerModal
        open={extraServicesManagerOpen}
        onClose={() => setExtraServicesManagerOpen(false)}
        onServicesUpdated={load}
      />

      {/* ── Brands & Stock Management Modal ── */}
      <ImplantBrandsModal
        open={brandsModalOpen}
        onClose={() => setBrandsModalOpen(false)}
        implants={implants}
        onBrandsUpdated={load}
      />
    </div>
  );
}
