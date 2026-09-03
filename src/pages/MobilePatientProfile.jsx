import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from '@/i18n/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import {
  ArrowLeft, Phone, Calendar, CreditCard, ClipboardList, Plus, Camera,
  Copy, Wallet, AlertTriangle, MapPin, Cake, User, FileText,
  CheckCircle2, Clock, XCircle, ChevronRight, Pencil, Activity,
  Stethoscope, Receipt, TrendingUp, Shield, X, Check
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { cn, resolveDoctorId } from '@/lib/utils';
import { formatPhone, capitalizeName } from '@/lib/utils';
import AppointmentModal from '../components/appointments/AppointmentModal';
import PatientModal from '../components/patients/PatientModal';
import TreatmentPlanModal from '../components/treatments/TreatmentPlanModal';

const getInitials = (name) =>
  name?.split(' ')?.map(n => n[0])?.join('')?.substring(0, 2)?.toUpperCase() || '?';

const fmt = (n) => Number(n || 0).toLocaleString('ru-RU');

const getLocalDT = () => {
  const now = new Date();
  return new Date(now - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

const TABS = [
  { id: 'overview',      label: 'Profil',        icon: User },
  { id: 'treatments',    label: 'Rejalari',       icon: ClipboardList },
  { id: 'appointments',  label: 'Uchrashuvlar',   icon: Calendar },
  { id: 'payments',      label: "To'lovlar",      icon: CreditCard },
  { id: 'notes',         label: 'Eslatmalar',     icon: FileText },
];

const ApptBadge = ({ status }) => {
  const map = {
    Completed:  { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Tugallangan' },
    Scheduled:  { bg: 'bg-blue-100',    text: 'text-blue-700',    label: 'Rejalashtirilgan' },
    Waiting:    { bg: 'bg-amber-100',   text: 'text-amber-700',   label: 'Kutilmoqda' },
    'No-Show':  { bg: 'bg-rose-100',    text: 'text-rose-700',    label: 'Kelmagan' },
    Cancelled:  { bg: 'bg-slate-100',   text: 'text-slate-600',   label: 'Bekor qilindi' },
  };
  const s = map[status] || map['Scheduled'];
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
};

export default function MobilePatientProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isDoctor } = useAuth();
  const { t, language } = useTranslation();

  const [patient, setPatient]                   = useState(null);
  const [plans, setPlans]                       = useState([]);
  const [payments, setPayments]                 = useState([]);
  const [appointments, setAppointments]         = useState([]);
  const [doctors, setDoctors]                   = useState([]);
  const [loading, setLoading]                   = useState(true);
  const [activeTab, setActiveTab]               = useState('overview');
  const [apptModalOpen, setApptModalOpen]       = useState(false);
  const [patientModalOpen, setPatientModalOpen] = useState(false);
  const [treatModalOpen, setTreatModalOpen]     = useState(false);
  const [payModalOpen, setPayModalOpen]         = useState(false);
  const [photoUploading, setPhotoUploading]     = useState(false);
  const [noteText, setNoteText]                 = useState('');
  const [notesSaving, setNotesSaving]           = useState(false);
  const [allPatients, setAllPatients]           = useState([]);
  const [refreshTick, setRefreshTick]           = useState(0);
  const [expandedPlan, setExpandedPlan]         = useState(null);
  const payingSavingRef                         = useRef(false);
  const payTxRef                                = useRef('');
  const [payForm, setPayForm]                   = useState({
    type: 'Income', amount: '', method: 'Cash',
    category: 'Treatment', date: getLocalDT(), notes: '', doctor_id: '',
  });
  const [payingSaving, setPayingSaving] = useState(false);

  /* ── load ── */
  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [patRes, plansRes, paysRes, apptRes, usersRes] = await Promise.all([
        base44.entities.Patient.filter({ id }),
        base44.entities.TreatmentPlan.filter({ patient_id: id }, '-created_date', 50),
        base44.entities.Payment.filter({ patient_id: id }, '-date', 200),
        base44.entities.Appointment.filter({ patient_id: id }, '-date', 30),
        base44.entities.User.list('name', 100).catch(() => []),
      ]);
      const raw = patRes[0] || null;
      if (raw && raw.full_name) raw.full_name = capitalizeName(raw.full_name);
      setPatient(raw);
      setPlans(plansRes || []);
      setPayments((paysRes || []).filter(p => {
        const tp = (p.type || '').toLowerCase();
        const n = (p.notes || '').toLowerCase();
        if ((tp === 'debt' || tp === 'discount') && (p.plan_id || n.includes('linked to plan') || n.includes('avtomatik chegirma'))) return false;
        return ['income', 'expense', 'refund', 'discount'].includes(tp);
      }));
      setAppointments(apptRes || []);
      const docs = (usersRes || []).filter(u => ['doctor', 'admin'].includes((u.role || '').toLowerCase()));
      setDoctors(docs.length > 0 ? docs : (usersRes || []));
    } catch (err) {
      console.error('MobilePatientProfile load:', err);
      toast.error('Bemorni yuklashda xatolik');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load, refreshTick]);

  useEffect(() => {
    if (!apptModalOpen || allPatients.length > 0) return;
    base44.entities.Patient.list('full_name', 200).then(p => setAllPatients(p || [])).catch(() => {});
  }, [apptModalOpen]);

  /* ── financials ── */
  const financials = useMemo(() => {
    const incomes    = payments.filter(p => (p.type || '').toLowerCase() === 'income').reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const refunds    = payments.filter(p => (p.type || '').toLowerCase() === 'refund').reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const plansTotal = plans.reduce((s, p) => s + (Number(p.total_price) || 0), 0);
    const rawDebt    = payments.filter(p => (p.type || '').toLowerCase() === 'debt').reduce((s, p) => s + (Number(p.amount) || 0), 0);
    let debt = 0, prepay = 0;
    if (plansTotal > 0) {
      const net = incomes - plansTotal - refunds;
      debt = net < 0 ? Math.abs(net) : 0;
      prepay = net > 0 ? net : 0;
    } else if (rawDebt > 0) {
      const net = incomes - rawDebt - refunds;
      debt = net < 0 ? Math.abs(net) : 0;
      prepay = net > 0 ? net : 0;
    } else {
      const net = incomes - refunds;
      debt = net < 0 ? Math.abs(net) : 0;
      prepay = net > 0 ? net : 0;
    }
    return { incomes, debt, prepay, plansTotal };
  }, [payments, plans]);

  /* ── medical alerts ── */
  const medicalAlerts = useMemo(() => {
    if (!patient) return [];
    const fields = [patient.important_info, patient.comment, patient.notes].filter(Boolean).map(s => s.toLowerCase());
    const has = (term) => fields.some(f => f.includes(term));
    const alerts = [];
    if (has('lidokain') || has('lidocaine') || has('anestetik') || has('anesteziya')) alerts.push('Lidokain allergiyasi');
    if (has('diabet') || has('diabetes') || has('qandli')) alerts.push('Qandli diabet');
    if (has('gipertoniya') || has('hypertension') || has('davlen')) alerts.push('Gipertoniya');
    return alerts;
  }, [patient]);

  /* ── age ── */
  const age = useMemo(() => {
    if (!patient?.birth_date) return null;
    const parsed = new Date(patient.birth_date);
    if (isNaN(parsed)) {
      const y = patient.birth_date.match(/\d{4}/);
      return y ? new Date().getFullYear() - parseInt(y[0]) : null;
    }
    const today = new Date();
    let a = today.getFullYear() - parsed.getFullYear();
    const m = today.getMonth() - parsed.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < parsed.getDate())) a--;
    return a;
  }, [patient?.birth_date]);

  /* ── avatar ── */
  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUploading(true);
    try {
      const reader = new FileReader();
      await new Promise(res => {
        reader.onload = async (ev) => {
          await base44.entities.Patient.update(id, { photo_url: ev.target.result });
          setPatient(prev => prev ? { ...prev, photo_url: ev.target.result } : prev);
          toast.success('Profil rasmi yangilandi');
          res();
        };
        reader.readAsDataURL(file);
      });
    } catch { toast.error('Rasm yuklashda xatolik'); }
    finally { setPhotoUploading(false); e.target.value = ''; }
  };

  /* ── open pay modal ── */
  const openPayModal = useCallback((prefillCategory = 'Treatment', prefillNotes = '') => {
    const docId = resolveDoctorId(patient, plans, doctors, user, isDoctor);
    setPayForm({ type: 'Income', amount: '', method: 'Cash', category: prefillCategory, date: getLocalDT(), notes: prefillNotes, doctor_id: docId || doctors[0]?.id || '' });
    setPayModalOpen(true);
  }, [patient, plans, doctors, user, isDoctor]);

  /* ── save payment ── */
  const handleSavePay = async () => {
    if (payingSavingRef.current || !payForm.amount) { toast.error('Summani kiriting'); return; }
    payingSavingRef.current = true;
    setPayingSaving(true);
    try {
      const txId = payTxRef.current || (payTxRef.current = `pay_${id}_${Date.now()}`);
      await base44.entities.Payment.create({
        id: txId, patient_id: id, patient_name: patient?.full_name,
        type: payForm.type, amount: Number(String(payForm.amount).replace(/\D/g, '')),
        method: payForm.method, category: payForm.category,
        date: payForm.date || new Date().toISOString(), notes: payForm.notes, doctor_id: payForm.doctor_id,
      });
      payTxRef.current = '';
      toast.success("To'lov saqlandi");
      setPayModalOpen(false);
      setRefreshTick(t => t + 1);
    } catch (err) { console.error(err); toast.error('Saqlashda xatolik'); }
    finally { payingSavingRef.current = false; setPayingSaving(false); }
  };

  /* ── save note ── */
  const handleSaveNote = async () => {
    if (!noteText.trim()) return;
    setNotesSaving(true);
    try {
      const existing = patient?.notes || '';
      const stamp = new Date().toLocaleDateString('uz-UZ');
      const updated = existing ? `${existing}\n\n[${stamp}] ${noteText.trim()}` : `[${stamp}] ${noteText.trim()}`;
      await base44.entities.Patient.update(id, { notes: updated });
      setPatient(prev => prev ? { ...prev, notes: updated } : prev);
      setNoteText('');
      toast.success('Eslatma saqlandi');
    } catch { toast.error('Saqlashda xatolik'); }
    finally { setNotesSaving(false); }
  };

  /* ── back ── */
  const handleBack = useCallback(() => {
    if (location.state?.from) { navigate(location.state.from); return; }
    window.history.length > 1 ? navigate(-1) : navigate('/patients');
  }, [location.state, navigate]);

  /* ── LOADING ── */
  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 bg-slate-200 rounded-full animate-pulse" />
        <div className="w-36 h-4 bg-slate-200 rounded animate-pulse" />
      </div>
      <div className="flex flex-col items-center pt-10 gap-4 px-4">
        <div className="w-20 h-20 rounded-full bg-slate-200 animate-pulse" />
        <div className="w-40 h-5 bg-slate-200 rounded animate-pulse" />
        <div className="w-full h-28 bg-slate-100 rounded-2xl animate-pulse mt-4" />
        <div className="w-full h-40 bg-slate-100 rounded-2xl animate-pulse" />
      </div>
    </div>
  );

  if (!patient) return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4 px-6">
      <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center">
        <XCircle className="w-8 h-8 text-rose-500" />
      </div>
      <p className="text-slate-700 font-bold text-lg">Bemor topilmadi</p>
      <button onClick={handleBack} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm">
        Orqaga qaytish
      </button>
    </div>
  );

  /* ── RENDER ── */
  return (
    <div className="min-h-screen bg-[#F0F2F5] flex flex-col">

      {/* STICKY HEADER */}
      <div className="sticky top-0 z-30 bg-white border-b border-slate-100 shadow-sm">
        {/* Medical Alerts Banner */}
        {medicalAlerts.length > 0 && (
          <div className="bg-rose-50 border-b border-rose-100 px-4 py-2 flex flex-wrap gap-2 items-center">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500 animate-pulse shrink-0" />
            {medicalAlerts.map((a, i) => (
              <span key={i} className="text-[10px] font-black text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full uppercase tracking-wide">
                {a}
              </span>
            ))}
          </div>
        )}

        {/* Nav Row */}
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={handleBack} className="flex items-center gap-1.5 text-slate-600 active:scale-95 transition-transform">
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-bold text-slate-800">Orqaga</span>
          </button>
          <h1 className="text-sm font-black text-slate-900 truncate max-w-[160px]">{patient.full_name}</h1>
          <button onClick={() => setPatientModalOpen(true)} className="p-2 rounded-xl bg-slate-100 active:scale-95 transition-transform">
            <Pencil className="w-4 h-4 text-slate-600" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex overflow-x-auto no-scrollbar px-3 pb-0 gap-0.5">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-bold whitespace-nowrap shrink-0 border-b-2 transition-all',
                  isActive ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ACTION BAR */}
      <div className="bg-white border-b border-slate-100 px-4 py-2 flex gap-2 overflow-x-auto no-scrollbar">
        <button onClick={() => openPayModal()} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shrink-0 active:scale-95 transition-transform shadow-sm">
          <CreditCard className="w-3.5 h-3.5" />To'lov
        </button>
        <button onClick={() => setApptModalOpen(true)} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shrink-0 active:scale-95 transition-transform shadow-sm">
          <Calendar className="w-3.5 h-3.5" />Uchrashuv
        </button>
        <button onClick={() => setTreatModalOpen(true)} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shrink-0 active:scale-95 transition-transform shadow-sm">
          <Plus className="w-3.5 h-3.5" />Protsedura
        </button>
        <button onClick={() => openPayModal("Avans to'lovi", 'Bemor avans depoziti')} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold shrink-0 active:scale-95 transition-transform shadow-sm">
          <Wallet className="w-3.5 h-3.5" />+ Avans
        </button>
      </div>

      {/* CONTENT AREA */}
      <div className="flex-1 overflow-y-auto pb-24">
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>

            {/* ═══ OVERVIEW ═══ */}
            {activeTab === 'overview' && (
              <div className="px-3 pt-4 space-y-3">

                {/* Avatar + Name */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col items-center gap-3">
                  <div className="relative">
                    <div className="cursor-pointer" onClick={() => document.getElementById('mob-avatar-input').click()}>
                      {patient.photo_url ? (
                        <img src={patient.photo_url} alt={patient.full_name} className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-lg ring-2 ring-blue-200" />
                      ) : (
                        <div className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-black shadow-lg border-4 border-white"
                          style={{ background: 'linear-gradient(135deg, #38bdf8 0%, #3b82f6 50%, #6366f1 100%)' }}>
                          {getInitials(patient.full_name)}
                        </div>
                      )}
                      <div className="absolute bottom-0 right-0 w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center border-2 border-white shadow">
                        <Camera className="w-3.5 h-3.5 text-white" />
                      </div>
                    </div>
                    <input id="mob-avatar-input" type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                  </div>
                  <div className="text-center">
                    <h2 className="text-xl font-black text-slate-900">{patient.full_name}</h2>
                    <div className="flex items-center justify-center gap-2 mt-1.5 flex-wrap">
                      {patient.gender && (
                        <span className="text-[10px] font-bold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full">
                          {patient.gender === 'Female' ? 'Ayol' : 'Erkak'}
                        </span>
                      )}
                      {age !== null && (
                        <span className="text-[10px] font-bold px-2.5 py-1 bg-blue-50 text-blue-600 rounded-full">
                          {age} yosh
                        </span>
                      )}
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${patient.status === 'New' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                        {patient.status === 'New' ? 'Yangi bemor' : (patient.status || 'Faol')}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-mono mt-1">#{String(id || '').slice(-6).toUpperCase()}</p>
                  </div>
                </div>

                {/* Financial Summary */}
                <div className={cn('rounded-2xl shadow-sm border p-4', financials.debt > 0 ? 'bg-rose-50 border-rose-200' : financials.prepay > 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200')}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-black text-slate-700 uppercase tracking-wide">Moliyaviy holat</span>
                    <TrendingUp className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "To'langan", value: financials.incomes, color: 'text-emerald-700', bg: 'bg-white border-slate-100' },
                      { label: 'Qarz', value: financials.debt, color: financials.debt > 0 ? 'text-rose-600' : 'text-slate-400', bg: financials.debt > 0 ? 'bg-rose-100 border-rose-200' : 'bg-white border-slate-100' },
                      { label: 'Avans', value: financials.prepay, color: financials.prepay > 0 ? 'text-emerald-700' : 'text-slate-400', bg: financials.prepay > 0 ? 'bg-emerald-100 border-emerald-200' : 'bg-white border-slate-100' },
                    ].map(card => (
                      <div key={card.label} className={`rounded-xl p-2.5 text-center shadow-xs border ${card.bg}`}>
                        <p className="text-[9px] font-bold text-slate-500 uppercase">{card.label}</p>
                        <p className={`text-sm font-black font-mono mt-0.5 ${card.color}`}>{fmt(card.value)}</p>
                        <p className="text-[9px] text-slate-400 font-bold">so'm</p>
                      </div>
                    ))}
                  </div>
                  {financials.debt > 0 && (
                    <button onClick={() => openPayModal()} className="mt-3 w-full py-2.5 bg-rose-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition-all">
                      <CreditCard className="w-3.5 h-3.5" />Qarzni to'lash — {fmt(financials.debt)} so'm
                    </button>
                  )}
                </div>

                {/* Details card */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 space-y-0">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-black text-slate-700 uppercase tracking-wide">Shaxsiy ma'lumotlar</span>
                    <button onClick={() => setPatientModalOpen(true)} className="p-1.5 rounded-lg bg-slate-100 active:scale-95 transition-transform">
                      <Pencil className="w-3.5 h-3.5 text-slate-500" />
                    </button>
                  </div>

                  {/* Phone row */}
                  <div className="flex items-center gap-3 py-3 border-b border-slate-50">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                      <Phone className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[9.5px] font-bold text-slate-400 uppercase">Telefon</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <a href={`tel:${(patient.phone || '').replace(/\D/g, '')}`} className="text-sm font-black text-blue-600 font-mono truncate">
                          {patient.phone ? formatPhone(patient.phone) : '—'}
                        </a>
                        {patient.phone && (
                          <button onClick={() => { navigator.clipboard.writeText(patient.phone); toast.success('Nusxalandi'); }} className="p-1 text-slate-400 active:scale-95 transition-transform">
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    {patient.phone && (
                      <a href={`tel:${(patient.phone).replace(/\D/g, '')}`} className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center shadow-sm active:scale-95 transition-transform">
                        <Phone className="w-4 h-4 text-white" />
                      </a>
                    )}
                  </div>

                  {/* Birthday row */}
                  <div className="flex items-center gap-3 py-3 border-b border-slate-50">
                    <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
                      <Cake className="w-4 h-4 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[9.5px] font-bold text-slate-400 uppercase">Tug'ilgan sana</p>
                      <p className="text-sm font-black text-slate-800 mt-0.5">
                        {patient.birth_date || '—'}{age !== null ? <span className="text-xs font-bold text-slate-500 ml-1">({age} yosh)</span> : ''}
                      </p>
                    </div>
                  </div>

                  {/* Address row */}
                  <div className="flex items-center gap-3 py-3 border-b border-slate-50">
                    <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0">
                      <MapPin className="w-4 h-4 text-rose-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[9.5px] font-bold text-slate-400 uppercase">Manzil</p>
                      <p className="text-sm font-black text-slate-800 mt-0.5 truncate">{patient.address || '—'}</p>
                    </div>
                  </div>

                  {/* Important info row */}
                  {patient.important_info && (
                    <div className="flex items-start gap-3 py-3">
                      <div className="w-9 h-9 rounded-xl bg-rose-100 border border-rose-200 flex items-center justify-center shrink-0">
                        <Shield className="w-4 h-4 text-rose-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[9.5px] font-bold text-rose-500 uppercase">Muhim ma'lumot</p>
                        <p className="text-xs font-bold text-slate-700 mt-0.5 leading-relaxed">{patient.important_info}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Quick stats */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Rejalari',      value: plans.length,        color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-100' },
                    { label: 'Uchrashuvlar',  value: appointments.length,  color: 'text-blue-600',   bg: 'bg-blue-50 border-blue-100' },
                    { label: "To'lovlar",     value: payments.length,      color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
                  ].map(s => (
                    <div key={s.label} className={`${s.bg} border rounded-2xl p-3 text-center shadow-xs`}>
                      <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                      <p className="text-[10px] font-bold text-slate-500 mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ═══ TREATMENTS ═══ */}
            {activeTab === 'treatments' && (
              <div className="px-3 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-black text-slate-800">Davolash rejalari ({plans.length})</h2>
                  <button onClick={() => setTreatModalOpen(true)} className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold active:scale-95 transition-transform">
                    <Plus className="w-3.5 h-3.5" />Yangi reja
                  </button>
                </div>

                {plans.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center shadow-xs">
                    <ClipboardList className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-500 font-bold text-sm">Davolash rejalari yo'q</p>
                    <button onClick={() => setTreatModalOpen(true)} className="mt-4 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold active:scale-95 transition-transform">
                      + Reja qo'shish
                    </button>
                  </div>
                ) : plans.map(plan => {
                  const isExpanded = expandedPlan === plan.id;
                  const services = plan.services || [];
                  const completedSvcs = services.filter(s => s.status === 'completed' || s.payment_status === 'paid').length;
                  const progress = services.length > 0 ? Math.round((completedSvcs / services.length) * 100) : 0;

                  const planStatus = (plan.status || '').toLowerCase();
                  const statusInfo =
                    planStatus === 'completed' || planStatus === 'bajarildi'
                      ? { label: 'Tugallangan', cls: 'bg-emerald-100 text-emerald-700' }
                    : planStatus === 'in_progress' || planStatus === 'jarayonda'
                      ? { label: 'Jarayonda', cls: 'bg-amber-100 text-amber-700' }
                    : planStatus === 'planned' || planStatus === 'rejalashtirilgan'
                      ? { label: 'Rejalashtirilgan', cls: 'bg-blue-100 text-blue-700' }
                    : { label: 'Yangi', cls: 'bg-slate-100 text-slate-600' };

                  return (
                    <div key={plan.id} className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
                      <button className="w-full p-4 text-left flex items-start gap-3 active:bg-slate-50 transition-colors" onClick={() => setExpandedPlan(isExpanded ? null : plan.id)}>
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                          <Stethoscope className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-black text-slate-900 leading-snug">{plan.name || 'Davolash rejasi'}</p>
                            <ChevronRight className={cn('w-4 h-4 text-slate-400 shrink-0 transition-transform mt-0.5', isExpanded && 'rotate-90')} />
                          </div>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusInfo.cls}`}>{statusInfo.label}</span>
                            {plan.total_price > 0 && (
                              <span className="text-[10px] font-black text-slate-700 font-mono">{fmt(plan.total_price)} so'm</span>
                            )}
                          </div>
                          {services.length > 0 && (
                            <div className="mt-2.5">
                              <div className="flex items-center justify-between text-[9px] text-slate-400 font-bold mb-1">
                                <span>{completedSvcs}/{services.length} xizmat</span>
                                <span>{progress}%</span>
                              </div>
                              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all" style={{ width: `${progress}%` }} />
                              </div>
                            </div>
                          )}
                        </div>
                      </button>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden border-t border-slate-100">
                            <div className="px-4 py-3 space-y-1.5 bg-slate-50/60">
                              {services.length > 0 && services.map((svc, idx) => (
                                <div key={svc.id || idx} className="flex items-center gap-2.5 py-1.5">
                                  <div className={cn('w-5 h-5 rounded-full flex items-center justify-center shrink-0', (svc.status === 'completed' || svc.payment_status === 'paid') ? 'bg-emerald-500' : 'bg-slate-200')}>
                                    {(svc.status === 'completed' || svc.payment_status === 'paid') ? <Check className="w-3 h-3 text-white" /> : <div className="w-2 h-2 rounded-full bg-slate-400" />}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-slate-800 truncate">{svc.service_name || svc.name}</p>
                                    {svc.tooth_number && <p className="text-[10px] text-slate-400">#{svc.tooth_number}</p>}
                                  </div>
                                  {svc.price > 0 && <span className="text-xs font-black text-slate-700 font-mono shrink-0">{fmt(svc.price)}</span>}
                                </div>
                              ))}
                              {plan.discount_amount > 0 && (
                                <div className="flex items-center justify-between py-1.5 border-t border-slate-200 mt-1">
                                  <span className="text-[10px] font-bold text-purple-600">Chegirma</span>
                                  <span className="text-xs font-black text-purple-600">-{fmt(plan.discount_amount)} so'm</span>
                                </div>
                              )}
                              <div className="flex items-center justify-between py-1.5 border-t border-slate-200">
                                <span className="text-[10px] font-black text-slate-700 uppercase">Jami</span>
                                <span className="text-sm font-black text-slate-900 font-mono">{fmt(plan.total_price)} so'm</span>
                              </div>
                              <button onClick={() => openPayModal()} className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-transform mt-1">
                                <CreditCard className="w-3.5 h-3.5" />To'lov qilish
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ═══ APPOINTMENTS ═══ */}
            {activeTab === 'appointments' && (
              <div className="px-3 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-black text-slate-800">Uchrashuvlar ({appointments.length})</h2>
                  <button onClick={() => setApptModalOpen(true)} className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold active:scale-95 transition-transform">
                    <Plus className="w-3.5 h-3.5" />Yangi
                  </button>
                </div>

                {appointments.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center shadow-xs">
                    <Calendar className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-500 font-bold text-sm">Uchrashuvlar yo'q</p>
                    <button onClick={() => setApptModalOpen(true)} className="mt-4 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold active:scale-95 transition-transform">
                      + Uchrashuv qo'shish
                    </button>
                  </div>
                ) : appointments.map(appt => (
                  <div key={appt.id} className="bg-white rounded-2xl border border-slate-100 shadow-xs p-4 flex items-start gap-3">
                    <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                      appt.status === 'Completed' ? 'bg-emerald-50 border border-emerald-200' :
                      appt.status === 'No-Show' ? 'bg-rose-50 border border-rose-200' :
                      'bg-blue-50 border border-blue-200')}>
                      {appt.status === 'Completed' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> :
                       appt.status === 'No-Show' ? <XCircle className="w-5 h-5 text-rose-500" /> :
                       <Clock className="w-5 h-5 text-blue-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-black text-slate-900">{appt.title || appt.reason || 'Uchrashuv'}</p>
                          {appt.doctor && <p className="text-[10px] text-slate-500 font-bold mt-0.5">Dr. {appt.doctor}</p>}
                        </div>
                        <ApptBadge status={appt.status} />
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {appt.date && (
                          <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(appt.date).toLocaleDateString('uz-UZ', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        )}
                        {appt.time && (
                          <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />{appt.time}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ═══ PAYMENTS ═══ */}
            {activeTab === 'payments' && (
              <div className="px-3 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-black text-slate-800">To'lovlar ({payments.length})</h2>
                  <button onClick={() => openPayModal()} className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold active:scale-95 transition-transform">
                    <Plus className="w-3.5 h-3.5" />To'lov
                  </button>
                </div>

                {/* Summary */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3.5 text-center">
                    <p className="text-[10px] font-bold text-emerald-600 uppercase">Jami to'langan</p>
                    <p className="text-lg font-black text-emerald-700 font-mono mt-0.5">{fmt(financials.incomes)}</p>
                    <p className="text-[9px] text-emerald-500 font-bold">so'm</p>
                  </div>
                  <div className={cn('rounded-xl p-3.5 text-center border', financials.debt > 0 ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200')}>
                    <p className={`text-[10px] font-bold uppercase ${financials.debt > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                      {financials.debt > 0 ? 'Qarz' : 'Balans'}
                    </p>
                    <p className={`text-lg font-black font-mono mt-0.5 ${financials.debt > 0 ? 'text-rose-600' : 'text-slate-400'}`}>{fmt(financials.debt)}</p>
                    <p className={`text-[9px] font-bold ${financials.debt > 0 ? 'text-rose-400' : 'text-slate-400'}`}>so'm</p>
                  </div>
                </div>

                {payments.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center shadow-xs">
                    <Receipt className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-500 font-bold text-sm">To'lovlar yo'q</p>
                    <button onClick={() => openPayModal()} className="mt-4 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold active:scale-95 transition-transform">
                      + To'lov qo'shish
                    </button>
                  </div>
                ) : payments.map(pay => {
                  const tp = (pay.type || '').toLowerCase();
                  const icon = tp === 'income' ? '💳' : tp === 'refund' ? '↩️' : tp === 'expense' ? '📤' : '📋';
                  const amtColor = tp === 'income' ? 'text-emerald-700' : tp === 'refund' ? 'text-indigo-600' : 'text-rose-600';
                  const amtSign = tp === 'income' ? '+' : '-';
                  const label = tp === 'income' ? "To'lov qabul qilindi" : tp === 'refund' ? "To'lov qaytarildi" : tp === 'expense' ? 'Xarajat' : "Qarz kiritildi";
                  const bgColor = tp === 'income' ? 'bg-emerald-50 border-emerald-200' : tp === 'refund' ? 'bg-indigo-50 border-indigo-200' : tp === 'expense' ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200';

                  return (
                    <div key={pay.id} className="bg-white rounded-2xl border border-slate-100 shadow-xs p-4 flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border text-base ${bgColor}`}>{icon}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-slate-900">{label}</p>
                        {pay.category && <p className="text-[10px] text-slate-400 font-bold">{pay.category}</p>}
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {pay.date && <span className="text-[10px] font-bold text-slate-400">{new Date(pay.date).toLocaleDateString('uz-UZ', { day: '2-digit', month: 'short', year: 'numeric' })}</span>}
                          {pay.method && <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">{pay.method === 'Cash' ? 'Naqd' : pay.method === 'Card' ? 'Karta' : "O'tkazma"}</span>}
                        </div>
                      </div>
                      <p className={`text-sm font-black font-mono shrink-0 ${amtColor}`}>{amtSign}{fmt(pay.amount)}</p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ═══ NOTES ═══ */}
            {activeTab === 'notes' && (
              <div className="px-3 pt-4 space-y-3">
                <h2 className="text-sm font-black text-slate-800">Klinik eslatmalar</h2>

                <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-4 space-y-3">
                  <p className="text-xs font-bold text-slate-500">Yangi eslatma qo'shish</p>
                  <textarea
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    placeholder="Eslatma yozing..."
                    rows={3}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800 font-medium resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all placeholder:text-slate-400"
                  />
                  <button
                    onClick={handleSaveNote}
                    disabled={!noteText.trim() || notesSaving}
                    className="w-full py-3 bg-blue-600 disabled:opacity-50 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-all"
                  >
                    {notesSaving ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <><FileText className="w-4 h-4" />Saqlash</>}
                  </button>
                </div>

                {patient.notes ? (
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-4 space-y-2">
                    <p className="text-xs font-bold text-slate-500 uppercase mb-3">Mavjud eslatmalar</p>
                    {patient.notes.split('\n\n').filter(Boolean).reverse().map((block, i) => (
                      <div key={i} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                        <p className="text-xs text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">{block}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center shadow-xs">
                    <FileText className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-500 font-bold text-sm">Eslatmalar yo'q</p>
                  </div>
                )}
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>

      {/* PAYMENT MODAL */}
      <AnimatePresence>
        {payModalOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={() => setPayModalOpen(false)} />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl px-5 pt-4"
              style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
            >
              <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4" />
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-black text-slate-900">To'lov qabul qilish</h3>
                <button onClick={() => setPayModalOpen(false)} className="p-2 rounded-xl bg-slate-100 active:scale-95 transition-transform">
                  <X className="w-4 h-4 text-slate-600" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex gap-2">
                  {[
                    { v: 'Income', l: "To'lov" },
                    { v: 'Expense', l: 'Xarajat' },
                    { v: 'Refund', l: 'Qaytarma' },
                  ].map(({ v, l }) => (
                    <button key={v} onClick={() => setPayForm(p => ({ ...p, type: v }))}
                      className={cn('flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all active:scale-95',
                        payForm.type === v ? 'bg-blue-600 border-blue-600 text-white' : 'bg-slate-50 border-slate-200 text-slate-600')}>
                      {l}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Summa (so'm)</label>
                  <input type="number" inputMode="numeric" value={payForm.amount} onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))}
                    placeholder="0"
                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xl font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all" />
                </div>

                <div className="flex gap-2">
                  {[
                    { v: 'Cash', l: 'Naqd' },
                    { v: 'Card', l: 'Karta' },
                    { v: 'Transfer', l: "O'tkazma" },
                  ].map(({ v, l }) => (
                    <button key={v} onClick={() => setPayForm(p => ({ ...p, method: v }))}
                      className={cn('flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all active:scale-95',
                        payForm.method === v ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-600')}>
                      {l}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Izoh (ixtiyoriy)</label>
                  <input type="text" value={payForm.notes} onChange={e => setPayForm(p => ({ ...p, notes: e.target.value }))}
                    placeholder="Izoh..."
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all" />
                </div>

                <button onClick={handleSavePay} disabled={payingSaving || !payForm.amount}
                  className="w-full py-4 bg-blue-600 disabled:opacity-50 text-white rounded-2xl text-sm font-black flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-blue-500/25">
                  {payingSaving ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <><CreditCard className="w-4 h-4" />To'lovni saqlash</>}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* OTHER MODALS */}
      {apptModalOpen && (
        <AppointmentModal isOpen={apptModalOpen} onClose={() => setApptModalOpen(false)}
          onSave={() => { setApptModalOpen(false); setRefreshTick(t => t + 1); }}
          prefillPatient={patient} patients={allPatients} doctors={doctors} />
      )}
      {patientModalOpen && patient && (
        <PatientModal isOpen={patientModalOpen} onClose={() => setPatientModalOpen(false)}
          onSave={() => { setPatientModalOpen(false); setRefreshTick(t => t + 1); }}
          patient={patient} />
      )}
      {treatModalOpen && (
        <TreatmentPlanModal isOpen={treatModalOpen} onClose={() => setTreatModalOpen(false)}
          onSave={() => { setTreatModalOpen(false); setRefreshTick(t => t + 1); }}
          patientId={id} patientName={patient?.full_name} doctors={doctors} />
      )}
    </div>
  );
}
