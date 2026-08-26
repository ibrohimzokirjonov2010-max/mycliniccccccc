import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, Activity, AlertTriangle, CheckCircle2,
  ChevronRight, TrendingUp, Bell, Target, Phone, Calendar,
  Layers, MessageCircle, Zap, X, Filter, SlidersHorizontal,
  Award, Clock, ArrowUpRight, RefreshCw
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import PullToRefresh from '@/components/ui/PullToRefresh';
import ImplantForm, { EXTRA_SERVICES } from '@/components/implants/ImplantForm';
import { useFeature } from '@/hooks/useFeature';
import Paywall from '@/components/layout/Paywall';
import { useTranslation } from '@/i18n/LanguageContext';
import { toast } from 'sonner';

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
  planned:   { label: 'Rejalashtirilgan', emoji: '📋', bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-500',    border: 'border-blue-100' },
  placed:    { label: "O'rnatildi",        emoji: '🔩', bg: 'bg-teal-50',    text: 'text-teal-700',    dot: 'bg-teal-500',    border: 'border-teal-100' },
  healing:   { label: 'Healing',           emoji: '🩹', bg: 'bg-yellow-50',  text: 'text-yellow-700',  dot: 'bg-yellow-500',  border: 'border-yellow-100' },
  abutment:  { label: 'Abutment',          emoji: '🔧', bg: 'bg-purple-50',  text: 'text-purple-700',  dot: 'bg-purple-500',  border: 'border-purple-100' },
  crown:     { label: 'Crown tayyor',      emoji: '👑', bg: 'bg-indigo-50',  text: 'text-indigo-700',  dot: 'bg-indigo-500',  border: 'border-indigo-100' },
  completed: { label: 'Tugallangan',       emoji: '✅', bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', border: 'border-emerald-100' },
  failure:   { label: 'Failure',           emoji: '❌', bg: 'bg-rose-50',    text: 'text-rose-700',    dot: 'bg-rose-500',    border: 'border-rose-100' },
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
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <span>{cfg.emoji}</span>
      {cfg.label}
    </span>
  );
};

// ─── Implant Card ─────────────────────────────────────────────────────────────
const ImplantCard = ({ implant, onStatusChange, onNavigate, today }) => {
  const cfg = getLifecycleCfg(implant.lifecycle_status);
  const teeth = [...new Set((implant.tooth_numbers || (implant.tooth_number ? [implant.tooth_number] : [])).map(String))];
  const daysLeft = formatReminderDays(implant.reminder_date);
  const isOverdue = daysLeft !== null && daysLeft < 0;
  const isUrgent = daysLeft !== null && daysLeft >= 0 && daysLeft <= 7;
  const isSoon = daysLeft !== null && daysLeft > 7 && daysLeft <= 14;

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
        <div className="flex items-start justify-between gap-3 mb-3">
          {/* Avatar + Info */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* Tooth Badge */}
            <div className="relative flex-shrink-0">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-6 h-6 text-indigo-500" fill="currentColor">
                  <path d="M12 2C9.5 2 7.5 3.5 6.5 5.5C5.5 4 4 3 3 3C1.9 3 1 4.1 1 5.3C1 7.3 2 8.9 3 10.7C3.8 12.1 4 13.5 4 15C4 17.8 5.5 20.5 7 22H9.5L10 18C10.2 16.3 11 15 12 15C13 15 13.8 16.3 14 18L14.5 22H17C18.5 20.5 20 17.8 20 15C20 13.5 20.2 12.1 21 10.7C22 8.9 23 7.3 23 5.3C23 4.1 22.1 3 21 3C20 3 18.5 4 17.5 5.5C16.5 3.5 14.5 2 12 2Z" />
                </svg>
              </div>
              {teeth.length > 0 && (
                <div className="absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] px-1 bg-slate-900 text-white rounded-lg text-[9px] font-black border-2 border-white flex items-center justify-center">
                  #{toothIdToFdi(teeth[0])}{teeth.length > 1 ? `+${teeth.length - 1}` : ''}
                </div>
              )}
            </div>

            {/* Name & Info */}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-slate-900 tracking-tight truncate">
                {safeRender(implant.patient_name)}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {implant.firma === 'Boshqa' ? (implant.firma_custom || 'Boshqa') : safeRender(implant.firma)}
                </span>
                {implant.diameter && implant.length && (
                  <>
                    <span className="w-1 h-1 bg-slate-200 rounded-full flex-shrink-0" />
                    <span className="text-[10px] font-bold text-slate-400">
                      Ø{implant.diameter}×{implant.length}mm
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Status Pill */}
          <StatusPill status={implant.lifecycle_status} />
        </div>

        {/* Details Row */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-100/60">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">O'rnatilgan</p>
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-400" />
              <p className="text-[11px] font-bold text-slate-700">{safeRender(implant.placement_date)}</p>
            </div>
          </div>

          {implant.reminder_date ? (
            <div className={`rounded-xl p-2.5 border ${
              isOverdue ? 'bg-rose-50 border-rose-100' :
              isUrgent  ? 'bg-amber-50 border-amber-100' :
              isSoon    ? 'bg-blue-50 border-blue-100' :
                          'bg-slate-50/80 border-slate-100/60'
            }`}>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Nazorat</p>
              <div className="flex items-center gap-1">
                <Bell className={`w-3 h-3 ${isOverdue ? 'text-rose-500 animate-pulse' : isUrgent ? 'text-amber-500' : 'text-slate-400'}`} />
                <p className={`text-[11px] font-bold ${isOverdue ? 'text-rose-600' : isUrgent ? 'text-amber-600' : 'text-slate-700'}`}>
                  {isOverdue
                    ? `${Math.abs(daysLeft)} kun o'tib ketdi`
                    : daysLeft === 0 ? 'Bugun!'
                    : `${daysLeft} kun qoldi`
                  }
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-100/60">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Brend</p>
              <p className="text-[11px] font-bold text-slate-700">{safeRender(implant.brend) || '—'}</p>
            </div>
          )}
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
  const hasImplantsAccess = useFeature('implants');

  const [implants, setImplants] = useState([]);
  const [patients, setPatients] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const hasLoadedInitial = useRef(false);
  const loadingTimerRef = useRef(null);

  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'stats'
  const [filterStatus, setFilterStatus] = useState(null);
  const [filterFirma, setFilterFirma] = useState(null);
  const [showFilter, setShowFilter] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
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
      const [imps, pats, svcs] = await Promise.all([
        base44.entities.Implant.list('-placement_date', 100),
        base44.entities.Patient.list('full_name', 100),
        base44.entities.Service.filter({ is_active: true }, 'name', 100),
      ]);
      setImplants(imps);
      setPatients(pats);
      setServices(svcs);
      hasLoadedInitial.current = true;
    } catch (err) {
      console.error('Failed to load implants:', err);
      toast.error('Implantlarni yuklashda xatolik');
    } finally {
      if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
      setLoading(false);
    }
  }, []);

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
                  <Zap className="w-4 h-4 text-white" />
                </div>
                Implantlar
              </h1>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                {stats.total} ta implant · {stats.successRate}% muvaffaqiyat
              </p>
            </div>
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={() => setAddOpen(true)}
              className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200/60 text-white"
            >
              <Plus className="w-5 h-5" />
            </motion.button>
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
              <StatCard value={stats.total}        label="Jami implant"   icon={Zap}          color="text-indigo-600" bg="bg-indigo-50"  delay={0.05} />
              <StatCard value={stats.recent}       label="30 kunda"       icon={TrendingUp}   color="text-blue-600"   bg="bg-blue-50"   delay={0.10} />
              <StatCard value={`${stats.successRate}%`} label="Muvaffaqiyat" icon={CheckCircle2} color="text-emerald-600" bg="bg-emerald-50" delay={0.15} badge={stats.failures > 0 ? ` (${stats.failures} failure)` : ''} />
              <StatCard value={stats.needsControl.length} label="Nazorat kerak" icon={Bell} color="text-amber-600"  bg="bg-amber-50"  delay={0.20} />
            </div>

            {/* Brand Performance */}
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
              className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm"
            >
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-xl bg-indigo-50 flex items-center justify-center">
                  <Target className="w-3.5 h-3.5 text-indigo-600" />
                </div>
                <h3 className="text-xs font-[900] text-slate-900 uppercase tracking-tight">Brendlar tahlili</h3>
              </div>
              {stats.topBrands.length === 0 ? (
                <p className="text-center text-[11px] font-bold text-slate-400 py-6">Ma'lumot yo'q</p>
              ) : (
                <div className="space-y-3">
                  {stats.topBrands.map(([brand, count], idx) => {
                    const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                    const col = BRAND_COLORS[idx % BRAND_COLORS.length];
                    return (
                      <div key={brand}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                            <span className="text-xs font-[900] text-slate-800 uppercase tracking-wide">{brand}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[10px] font-bold ${col.text} ${col.bg} px-1.5 py-0.5 rounded-md`}>{pct}%</span>
                            <span className="text-xs font-[900] text-slate-900">{count}</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.8, delay: idx * 0.1, ease: 'easeOut' }}
                            className={`h-full bg-gradient-to-r ${col.bar} rounded-full`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
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
    </div>
  );
}
