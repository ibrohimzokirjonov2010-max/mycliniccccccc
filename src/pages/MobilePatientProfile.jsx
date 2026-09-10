import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from '@/i18n/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import { useClinic } from '@/lib/ClinicContext';
import {
  ArrowLeft, Phone, Calendar, CreditCard, ClipboardList, Plus,
  Copy, AlertTriangle, FileText,
  CheckCircle2, Clock, XCircle, ChevronRight,
  Stethoscope, Receipt, X, Check, Camera, Activity
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { cn, resolveDoctorId } from '@/lib/utils';
import { formatPhone, capitalizeName } from '@/lib/utils';
import AppointmentModal from '../components/appointments/AppointmentModal';
import PatientModal from '../components/patients/PatientModal';
import TreatmentPlanModal from '../components/treatments/TreatmentPlanModal';
import MobileCompactOdontogram, {
  fdiToInternalId,
} from '../components/patients/MobileCompactOdontogram';

const TEAL = '#14b8a6';
const TEAL_DARK = '#0d9488';
const NAVY = '#0f172a';

const getInitials = (name) =>
  name?.split(' ')?.map(n => n[0])?.join('')?.substring(0, 2)?.toUpperCase() || '?';

const fmt = (n) => Number(n || 0).toLocaleString('ru-RU');

const getLocalDT = () => {
  const now = new Date();
  return new Date(now - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

const formatShortDate = (raw, locale = 'uz-UZ') => {
  if (!raw) return '—';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const STATUS_LABEL_KEY = {
  caries: 'caries',
  cavity: 'caries',
  completed: 'completed',
  filling: 'filling',
  crown: 'crown',
  implant: 'implant',
  extracted: 'extracted',
  missing: 'extracted',
  planned: 'planned',
  in_progress: 'inProgress',
  healthy: 'healthy',
};

const inferStatus = (text) => {
  const s = String(text || '').toLowerCase();
  if (/implant/.test(s)) return 'implant';
  if (/crown|toj|karonka|koronka/.test(s)) return 'crown';
  if (/extract|sug['']ur|olingan|missing|yo['']q/.test(s)) return 'extracted';
  if (/plomba|filling|kompozit|davolangan/.test(s)) return 'completed';
  if (/karies|caries|kariyes|cavity/.test(s)) return 'caries';
  if (/jarayonda|progress/.test(s)) return 'in_progress';
  if (/reja|planned/.test(s)) return 'planned';
  return null;
};

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

function MiniCalendarMark({ date, locale }) {
  const d = date ? new Date(date) : new Date();
  const valid = !isNaN(d.getTime());
  const day = valid ? d.getDate() : '—';
  const month = valid
    ? d.toLocaleDateString(locale, { month: 'short' }).replace('.', '')
    : '';
  return (
    <div className="w-11 h-11 rounded-2xl bg-[#FFF8E7] border border-amber-100 flex flex-col items-center justify-center overflow-hidden shadow-sm">
      <span className="text-[8px] font-black uppercase tracking-wider text-amber-600 leading-none">{month}</span>
      <span className="text-[17px] font-black text-slate-800 leading-none mt-0.5 tabular-nums">{day}</span>
    </div>
  );
}

export default function MobilePatientProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isDoctor } = useAuth();
  const { t, language } = useTranslation();
  const { clinicName } = useClinic();

  const [patient, setPatient]                   = useState(null);
  const [plans, setPlans]                       = useState([]);
  const [payments, setPayments]                 = useState([]);
  const [appointments, setAppointments]         = useState([]);
  const [doctors, setDoctors]                   = useState([]);
  const [loading, setLoading]                   = useState(true);
  const [activeTab, setActiveTab]               = useState('tarix');
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
  const [selectedTooth, setSelectedTooth]       = useState(null);
  const [toothRecords, setToothRecords]         = useState([]);
  const [toothHistoryOpen, setToothHistoryOpen] = useState(false);
  const [implants, setImplants]                 = useState([]);

  const dateLocale = language === 'ru' ? 'ru-RU' : language === 'en' ? 'en-GB' : 'uz-UZ';

  /* ── load ── */
  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [patRes, plansRes, paysRes, apptRes, usersRes, toothRes, implantRes] = await Promise.all([
        base44.entities.Patient.filter({ id }),
        base44.entities.TreatmentPlan.filter({ patient_id: id }, '-created_date', 50),
        base44.entities.Payment.filter({ patient_id: id }, '-date', 200),
        base44.entities.Appointment.filter({ patient_id: id }, '-date', 30),
        base44.entities.User.list('name', 100).catch(() => []),
        base44.entities.ToothRecord.filter({ patient_id: id }, '-created_date', 100).catch(() => []),
        base44.entities.Implant.filter({ patient_id: id }, '-placement_date', 50).catch(() => []),
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
      setToothRecords(toothRes || []);
      setImplants(implantRes || []);
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
    if (has('lidokain') || has('lidocaine') || has('anestetik') || has('anesteziya')) alerts.push(t('patientProfile.lidocaineAllergy', 'Lidokain allergiyasi'));
    if (has('diabet') || has('diabetes') || has('qandli')) alerts.push(t('patientProfile.diabetes', 'Qandli diabet'));
    if (has('gipertoniya') || has('hypertension') || has('davlen')) alerts.push(t('patientProfile.hypertension', 'Gipertoniya'));
    return alerts;
  }, [patient, t]);

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

  const toothStatuses = useMemo(() => {
    const map = {};
    const assign = (fdiRaw, status, extra = {}) => {
      const fdi = String(fdiRaw || '').replace(/^#/, '').trim();
      if (!fdi || fdi === 'general') return;
      fdi.split(',').map(s => s.trim()).filter(Boolean).forEach((token) => {
        const id = fdiToInternalId(token);
        if (!id) return;
        const next = { status, fdi: token, ...extra };
        const prev = map[id];
        const rank = { extracted: 6, implant: 5, crown: 4, completed: 3, caries: 2, in_progress: 1, planned: 0 };
        if (!prev || (rank[status] || 0) >= (rank[prev.status] || 0)) {
          map[id] = next;
          map[String(token)] = next;
        }
      });
    };

    (toothRecords || []).forEach((r) => {
      const st = inferStatus(`${r.condition || ''} ${r.treatment || ''} ${r.status || ''} ${r.notes || ''}`) || (r.status && STATUS_LABEL_KEY[r.status] ? r.status : null);
      if (st) assign(r.tooth_number, st, { diagnosis: r.condition || r.treatment });
    });

    (plans || []).forEach((plan) => {
      const planServices = plan.services || [];
      const planTooth = String(plan.tooth_number || '').trim();
      const items = planServices.length
        ? planServices
        : (planTooth ? [{ service_name: plan.name, status: plan.status, tooth_number: planTooth }] : []);
      items.forEach((svc) => {
        const fdi = svc.tooth_number || svc.tooth_id || planTooth;
        const st = inferStatus(`${svc.service_name || ''} ${svc.name || ''} ${plan.name || ''} ${svc.status || ''} ${plan.status || ''}`);
        if (st && fdi) assign(fdi, st, { diagnosis: svc.service_name || plan.name });
      });
    });

    return map;
  }, [plans, toothRecords]);

  const nextAppointment = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcoming = (appointments || [])
      .filter((a) => {
        const st = (a.status || '').toLowerCase();
        if (st === 'cancelled' || st === 'canceled' || st === 'no-show') return false;
        const d = new Date(a.date || a.appointment_date || a.start_time);
        return !isNaN(d.getTime()) && d >= today;
      })
      .sort((a, b) => new Date(a.date || a.appointment_date) - new Date(b.date || b.appointment_date));
    return upcoming[0] || appointments[0] || null;
  }, [appointments]);

  const selectedHistory = useMemo(() => {
    const fdi = String(selectedTooth?.fdi || '').trim();
    if (!fdi) return [];
    const items = [];

    (plans || []).forEach((plan) => {
      const planServices = plan.services || [];
      const planTooth = String(plan.tooth_number || '').trim();
      const planDateRaw = plan.updated_at || plan.created_date || plan.created_at || plan.date;
      const dateStr = formatShortDate(planDateRaw, dateLocale);
      const doctorName = (doctors || []).find((d) => String(d.id) === String(plan.doctor_id || plan.created_by))?.full_name
        || plan.doctor_name
        || '';

      planServices.forEach((s) => {
        const serviceTooth = String(s.tooth_number || s.tooth_id || planTooth || '').trim().replace(/^#/, '');
        if (serviceTooth !== fdi) return;
        items.push({
          id: `${plan.id}-${s.id || s.service_name}-${dateStr}`,
          date: dateStr,
          title: s.service_name || s.name || plan.name || t('patientProfile.treatmentPlanSingular', 'Davolash rejasi'),
          meta: doctorName || t('patientProfile.mobile.planTag', 'Reja'),
          highlight: /karies|caries/i.test(`${s.service_name || ''} ${plan.name || ''}`),
        });
      });

      if (planServices.length === 0 && planTooth === fdi) {
        items.push({
          id: `plan-${plan.id}`,
          date: dateStr,
          title: plan.name || plan.title || t('patientProfile.treatmentPlanSingular', 'Davolash rejasi'),
          meta: doctorName || t('patientProfile.mobile.planTag', 'Reja'),
          highlight: /karies|caries/i.test(plan.name || ''),
        });
      }
    });

    (toothRecords || [])
      .filter((r) => String(r.tooth_number) === fdi)
      .forEach((r) => {
        items.push({
          id: `rec-${r.id}`,
          date: formatShortDate(r.created_date || r.updated_at, dateLocale),
          title: [r.condition, r.treatment].filter(Boolean).join(' · ') || r.notes || t('patientProfile.mobile.newEntry', 'Yozuv'),
          meta: r.doctor || '',
          highlight: /karies|caries/i.test(`${r.condition} ${r.treatment}`),
        });
      });

    return items.slice(0, 12);
  }, [plans, toothRecords, doctors, selectedTooth, dateLocale, t]);

  useEffect(() => {
    if (selectedTooth) return;
    const notable = Object.entries(toothStatuses).find(([key, val]) => (
      /^\d+$/.test(key) && val?.status && val.status !== 'healthy'
    ));
    if (notable) {
      setSelectedTooth({ id: fdiToInternalId(notable[0]), fdi: String(notable[0]) });
    }
  }, [toothStatuses, selectedTooth]);

  const tabs = useMemo(() => ([
    { id: 'tarix',    label: t('patientProfile.mobile.history', 'Tarix') },
    { id: 'plan',     label: t('patientProfile.tabs.planShort', 'Reja') },
    { id: 'payments', label: t('patientProfile.tabs.payments', "To'lovlar") },
    { id: 'implant',  label: t('patientProfile.tabs.implants', 'Implant') },
  ]), [t]);

  const selectedStatus = useMemo(() => {
    if (!selectedTooth) return null;
    return toothStatuses[selectedTooth.id] || toothStatuses[String(selectedTooth.fdi)] || null;
  }, [toothStatuses, selectedTooth]);

  const handleToothSelect = useCallback((fdi) => {
    setSelectedTooth({ id: fdiToInternalId(fdi), fdi: String(fdi) });
  }, []);

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
      setRefreshTick(tick => tick + 1);
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

  const clinicLabel = clinicName && clinicName !== 'ShifoCRM'
    ? clinicName
    : t('patientProfile.mobile.clinicFallback', 'stomatolog kabineti');

  const statusLabel = (() => {
    const key = STATUS_LABEL_KEY[selectedStatus?.status] || 'healthy';
    const mapped = t(`patientProfile.mobile.${key}`, selectedStatus?.diagnosis || t('patientProfile.mobile.healthy', "Sog'lom"));
    return selectedStatus?.diagnosis && selectedStatus.status === 'caries'
      ? `${mapped}`
      : mapped;
  })();

  /* ── LOADING ── */
  if (loading) return (
    <div className="min-h-screen bg-[#F3F6F8] flex flex-col">
      <div className="px-4 pb-8" style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 12px))', background: 'linear-gradient(165deg, #0f766e 0%, #14b8a6 55%, #0d9488 100%)' }}>
        <div className="flex items-center justify-between py-2">
          <div className="w-9 h-9 bg-white/20 rounded-full animate-pulse" />
          <div className="w-36 h-4 bg-white/20 rounded animate-pulse" />
          <div className="w-9 h-9 bg-white/20 rounded-full animate-pulse" />
        </div>
        <div className="h-10 bg-white/15 rounded-2xl mt-4 animate-pulse" />
      </div>
      <div className="px-3 -mt-4 grid grid-cols-3 gap-2">
        {[1, 2, 3].map(i => <div key={i} className="h-20 bg-white rounded-2xl animate-pulse shadow-sm" />)}
      </div>
    </div>
  );

  if (!patient) return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4 px-6">
      <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center">
        <XCircle className="w-8 h-8 text-rose-500" />
      </div>
      <p className="text-slate-700 font-bold text-lg">{t('patientProfile.mobile.patientNotFound', 'Bemor topilmadi')}</p>
      <button onClick={handleBack} className="px-5 py-2.5 text-white rounded-xl font-bold text-sm" style={{ background: TEAL }}>
        {t('patientProfile.mobile.goBack', 'Orqaga qaytish')}
      </button>
    </div>
  );

  const phoneHref = patient.phone ? `tel:${String(patient.phone).replace(/\D/g, '')}` : null;
  const previewHistory = selectedHistory.slice(0, 2);

  /* ── RENDER ── */
  return (
    <div
      className="bg-[#F3F6F8] flex flex-col max-w-[430px] mx-auto w-full"
      style={{ minHeight: 'calc(100dvh - 54px - env(safe-area-inset-bottom, 0px))' }}
    >

      {medicalAlerts.length > 0 && (
        <div className="bg-rose-50 border-b border-rose-100 px-4 py-2 flex flex-wrap gap-2 items-center" style={{ paddingTop: 'max(8px, env(safe-area-inset-top, 8px))' }}>
          <AlertTriangle className="w-3.5 h-3.5 text-rose-500 animate-pulse shrink-0" />
          {medicalAlerts.map((a, i) => (
            <span key={i} className="text-[10px] font-black text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full uppercase tracking-wide">
              {a}
            </span>
          ))}
        </div>
      )}

      {/* TEAL GRADIENT HEADER */}
      <div
        className="sticky top-0 z-30 relative text-white"
        style={{
          background: 'linear-gradient(165deg, #0f766e 0%, #14b8a6 55%, #0d9488 100%)',
          paddingTop: medicalAlerts.length > 0 ? 8 : 'max(12px, env(safe-area-inset-top, 12px))',
        }}
      >
        <div className="flex items-center px-3 pt-1 pb-3 gap-2">
          <button
            type="button"
            onClick={handleBack}
            aria-label={t('patientProfile.backToList', 'Orqaga')}
            className="w-10 h-10 rounded-full bg-white/18 border border-white/25 flex items-center justify-center shrink-0 active:scale-95 transition-transform"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>

          <div className="flex-1 min-w-0 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setPatientModalOpen(true)}
              className="min-w-0 text-center px-0.5"
            >
              <h1 className="text-[20px] font-black leading-tight truncate drop-shadow-sm max-w-[200px]">{patient.full_name}</h1>
              <p className="text-[11px] font-semibold text-white/80 mt-0.5 truncate max-w-[220px]">
                {age != null
                  ? t('patientProfile.mobile.ageClinic', { age, clinic: clinicLabel })
                  : clinicLabel}
              </p>
            </button>
            <button
              type="button"
              onClick={() => document.getElementById('mob-avatar-input')?.click()}
              className="w-9 h-9 rounded-full bg-white/20 border border-white/35 flex items-center justify-center text-[11px] font-black shrink-0 overflow-hidden"
              title={t('patientProfile.uploadPhoto', 'Rasm yuklash')}
            >
              {patient.photo_url
                ? <img src={patient.photo_url} alt="" className="w-full h-full object-cover" />
                : (photoUploading ? <Camera className="w-4 h-4" /> : getInitials(patient.full_name))}
            </button>
            <input id="mob-avatar-input" type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </div>

          {phoneHref ? (
            <a
              href={phoneHref}
              className="w-10 h-10 rounded-full bg-white/18 border border-white/25 flex items-center justify-center shrink-0 active:scale-95 transition-transform"
              aria-label={t('patientProfile.call', "Qo'ng'iroq qilish")}
            >
              <Phone className="w-5 h-5 text-white" />
            </a>
          ) : (
            <span className="w-10 h-10 rounded-full bg-white/10 border border-white/15 flex items-center justify-center shrink-0 opacity-50">
              <Phone className="w-4 h-4 text-white" />
            </span>
          )}
        </div>

        {financials.debt > 0 && (
          <div className="mx-3 mb-5 flex items-center justify-between gap-3 rounded-2xl px-3.5 py-2.5 bg-black/22 border border-white/10 backdrop-blur-[6px]">
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle className="w-3.5 h-3.5 text-white shrink-0" />
              <span className="text-[12px] font-bold text-white/90">{t('patientProfile.mobile.debt', 'Qarzdorlik')}</span>
            </div>
            <span className="text-[13px] font-black tabular-nums whitespace-nowrap">
              {fmt(financials.debt)} {t('dashboard.currency', "so'm")}
            </span>
          </div>
        )}
        {financials.debt <= 0 && <div className="h-4" />}
      </div>

      {/* IDENTITY STRIP */}
      <div className="px-3 pt-3">
        <div className="bg-white rounded-[18px] border border-slate-100 shadow-[0_8px_24px_rgba(15,23,42,0.05)] px-3.5 py-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => document.getElementById('mob-avatar-input')?.click()}
            className="w-12 h-12 rounded-2xl overflow-hidden bg-gradient-to-br from-teal-400 to-teal-600 text-white flex items-center justify-center text-sm font-black shrink-0 shadow-sm"
          >
            {patient.photo_url
              ? <img src={patient.photo_url} alt="" className="w-full h-full object-cover" />
              : getInitials(patient.full_name)}
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-black text-[#0f172a] truncate">{patient.full_name}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {patient.phone ? (
                <a href={phoneHref} className="text-[11px] font-bold text-[#0d9488] font-mono truncate">{formatPhone(patient.phone)}</a>
              ) : (
                <span className="text-[11px] font-bold text-slate-400">Telefon yo'q</span>
              )}
              {age != null && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{age} yosh</span>
              )}
            </div>
          </div>
          <button type="button" onClick={() => setPatientModalOpen(true)} className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center active:scale-95">
            <FileText className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </div>

      {financials.debt > 0 && (
        <div className="px-3 pt-2">
          <button
            type="button"
            onClick={() => openPayModal()}
            className="w-full rounded-[18px] bg-rose-50 border border-rose-200 px-4 py-3.5 flex items-center justify-between gap-3 active:scale-[0.99] transition-transform shadow-sm"
          >
            <div className="min-w-0 text-left">
              <p className="text-[10px] font-black uppercase tracking-wide text-rose-500">{t('patientProfile.mobile.debt', 'Qarzdorlik')}</p>
              <p className="text-[18px] font-black tabular-nums text-rose-600 mt-0.5">{fmt(financials.debt)} <span className="text-[12px] font-bold">{t('dashboard.currency', "so'm")}</span></p>
            </div>
            <span className="shrink-0 px-3 py-2 rounded-xl bg-rose-600 text-white text-[11px] font-black">{t('patientProfile.mobile.payAction', "To'lov")}</span>
          </button>
        </div>
      )}

      {/* ACTION CARDS */}
      <div className="px-3 -mt-6 grid grid-cols-3 gap-2 relative z-10">
        <button
          type="button"
          onClick={() => openPayModal()}
          className="bg-white rounded-[18px] shadow-[0_8px_24px_rgba(15,23,42,0.06)] border border-white py-3 px-2 flex flex-col items-center gap-1.5 active:scale-[0.97] transition-transform"
        >
          <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-amber-500" />
          </div>
          <span className="text-[11px] font-black text-slate-800">{t('patientProfile.mobile.payAction', "To'lov")}</span>
        </button>
        <button
          type="button"
          onClick={() => setApptModalOpen(true)}
          className="bg-white rounded-[18px] shadow-[0_8px_24px_rgba(15,23,42,0.06)] border border-white py-3 px-2 flex flex-col items-center gap-1.5 active:scale-[0.97] transition-transform"
        >
          <MiniCalendarMark date={nextAppointment?.date || nextAppointment?.appointment_date} locale={dateLocale} />
          <span className="text-[11px] font-black text-slate-800">{t('patientProfile.mobile.apptAction', 'Uchrashuv')}</span>
        </button>
        <button
          type="button"
          onClick={() => setTreatModalOpen(true)}
          className="bg-white rounded-[18px] shadow-[0_8px_24px_rgba(15,23,42,0.06)] border border-white py-3 px-2 flex flex-col items-center gap-1.5 active:scale-[0.97] transition-transform"
        >
          <div className="w-11 h-11 rounded-2xl bg-cyan-50 border border-cyan-100 flex items-center justify-center">
            <ClipboardList className="w-5 h-5 text-[#14b8a6]" />
          </div>
          <span className="text-[11px] font-black text-slate-800">{t('patientProfile.mobile.newPlanAction', 'Yangi reja')}</span>
        </button>
      </div>

      {/* CLINICAL STRIP */}
      <div className="px-3 pt-3 space-y-3">
                <div className="bg-white rounded-[20px] shadow-[0_8px_24px_rgba(15,23,42,0.05)] border border-slate-100/80 px-3 pt-3 pb-3.5">
                  <div className="flex items-center justify-between mb-2.5 px-0.5">
                    <h2 className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                      {t('patientProfile.mobile.odontogram', 'Odontogramma')}
                    </h2>
                    <span className="text-[10px] font-black uppercase tracking-wide text-[#14b8a6]">
                      {t('patientProfile.mobile.fdiAdults', 'FDI · Kattalar')}
                    </span>
                  </div>
                  <MobileCompactOdontogram
                    selectedFdi={selectedTooth?.fdi}
                    toothStatuses={toothStatuses}
                    onSelect={handleToothSelect}
                  />
                </div>

                {selectedTooth ? (
                  <div className="bg-white rounded-[20px] shadow-[0_8px_24px_rgba(15,23,42,0.05)] border border-slate-100/80 p-3.5">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-11 h-11 rounded-xl bg-[#14b8a6] text-white flex items-center justify-center text-[13px] font-black shrink-0 shadow-sm">
                        #{selectedTooth.fdi}
                      </div>
                      <div className="flex-1 min-w-0 pt-0.5">
                        <p className="text-[13px] font-black text-slate-900 leading-tight">
                          {t('patientProfile.mobile.selectedTooth', 'Tanlangan tish')}
                        </p>
                        <span className="inline-flex mt-1.5 text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                          {statusLabel}
                        </span>
                      </div>
                    </div>

                    {previewHistory.length > 0 ? (
                      <div className="space-y-2.5 mb-3.5 pl-1">
                        {previewHistory.map((item) => (
                          <div key={item.id} className="flex items-start gap-2.5">
                            <span className={cn('mt-1.5 w-1.5 h-1.5 rounded-full shrink-0', item.highlight ? 'bg-rose-500' : 'bg-[#14b8a6]')} />
                            <div className="min-w-0">
                              <p className="text-[10px] font-bold text-slate-400">
                                {item.date}{item.meta ? ` · ${item.meta}` : ''}
                              </p>
                              <p className={cn('text-[12px] font-bold leading-snug', item.highlight ? 'text-rose-600' : 'text-slate-800')}>
                                {item.title}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[12px] font-semibold text-slate-400 mb-3.5">
                        {t('patientProfile.mobile.noHistory', 'Tarix yo\'q')}
                      </p>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setToothHistoryOpen(true)}
                        className="h-11 rounded-2xl border-2 border-[#14b8a6]/40 text-[#14b8a6] text-[12px] font-black active:scale-[0.98] transition-transform"
                      >
                        {t('patientProfile.mobile.history', 'Tarix')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setTreatModalOpen(true)}
                        className="h-11 rounded-2xl text-white text-[12px] font-black flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform shadow-[0_6px_16px_rgba(20,153,173,0.28)]"
                        style={{ background: TEAL }}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {t('patientProfile.mobile.newEntry', 'Yangi yozuv')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-[20px] border border-dashed border-slate-200 px-4 py-8 text-center">
                    <p className="text-sm font-black text-slate-600">{t('patientProfile.mobile.selectTooth', 'Tishni tanlang')}</p>
                    <p className="text-[11px] text-slate-400 mt-1">{t('patientProfile.mobile.selectToothHint', 'Tarix va yangi yozuv uchun tishni bosing')}</p>
                  </div>
                )}
              
      </div>

      {/* PILL TABS */}
      <div className="shrink-0 px-3 pb-3 pt-1 mt-auto">
        <div className="bg-white rounded-full p-1 shadow-[0_8px_24px_rgba(15,23,42,0.08)] border border-slate-100 flex">
          {tabs.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex-1 py-2.5 text-[12px] font-black rounded-full transition-colors',
                  isActive ? 'bg-[#ccfbf1] text-[#0d9488]' : 'text-slate-400'
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* CONTENT */}
      <div className="flex-1 px-3 pt-3 pb-2">
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.16 }}>

            {activeTab === 'tarix' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-black text-slate-800">{t('patientProfile.mobile.apptsTitle', 'Uchrashuvlar')} ({appointments.length})</h2>
                  <button onClick={() => setApptModalOpen(true)} className="flex items-center gap-1 px-3 py-2 text-white rounded-xl text-xs font-bold active:scale-95 transition-transform" style={{ background: TEAL }}>
                    <Plus className="w-3.5 h-3.5" />{t('patientProfile.mobile.apptAction', 'Uchrashuv')}
                  </button>
                </div>

                {appointments.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center shadow-xs">
                    <Calendar className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                    <p className="text-slate-500 font-bold text-sm">{t('patientProfile.mobile.emptyAppts', "Uchrashuvlar yo'q")}</p>
                    <button onClick={() => setApptModalOpen(true)} className="mt-3 px-5 py-2.5 text-white rounded-xl text-xs font-bold active:scale-95 transition-transform" style={{ background: TEAL }}>
                      + {t('patientProfile.mobile.addAppt', "Uchrashuv qo'shish")}
                    </button>
                  </div>
                ) : appointments.map(appt => (
                  <div key={appt.id} className="bg-white rounded-2xl border border-slate-100 shadow-xs p-4 flex items-start gap-3">
                    <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                      appt.status === 'Completed' ? 'bg-emerald-50 border border-emerald-200' :
                      appt.status === 'No-Show' ? 'bg-rose-50 border border-rose-200' :
                      appt.status === 'Cancelled' ? 'bg-slate-50 border border-slate-200' :
                      'bg-cyan-50 border border-cyan-100')}>
                      {appt.status === 'Completed' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> :
                       appt.status === 'No-Show' || appt.status === 'Cancelled' ? <XCircle className="w-5 h-5 text-rose-500" /> :
                       <Clock className="w-5 h-5 text-[#14b8a6]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-black text-slate-900">{formatShortDate(appt.date || appt.appointment_date, dateLocale)}</p>
                        <ApptBadge status={appt.status} />
                      </div>
                      <p className="text-[11px] font-bold text-slate-500 mt-1 truncate">{appt.service_name || appt.notes || appt.type || 'Uchrashuv'}</p>
                    </div>
                  </div>
                ))}

                <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-4 space-y-3">
                  <p className="text-xs font-bold text-slate-500">{t('patientProfile.tabs.notes', 'Eslatmalar')}</p>
                  <textarea
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    placeholder={t('patientProfile.patientInfoCard.note', 'Eslatma yozing...')}
                    rows={3}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800 font-medium resize-none focus:outline-none focus:ring-2 focus:ring-[#14b8a6]/30 focus:border-[#14b8a6] transition-all placeholder:text-slate-400"
                  />
                  <button
                    onClick={handleSaveNote}
                    disabled={!noteText.trim() || notesSaving}
                    className="w-full py-3 disabled:opacity-50 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-all"
                    style={{ background: TEAL }}
                  >
                    {notesSaving ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <><FileText className="w-4 h-4" />{t('common.save', 'Saqlash')}</>}
                  </button>
                  {patient.notes ? (
                    <div className="space-y-2 pt-1">
                      {patient.notes.split('\n\n').filter(Boolean).reverse().slice(0, 5).map((block, i) => (
                        <div key={i} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                          <p className="text-xs text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">{block}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            {activeTab === 'plan' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-black text-slate-800">{t('patientProfile.mobile.plansTitle', 'Davolash rejalari')} ({plans.length})</h2>
                  <button onClick={() => setTreatModalOpen(true)} className="flex items-center gap-1 px-3 py-2 text-white rounded-xl text-xs font-bold active:scale-95 transition-transform" style={{ background: TEAL }}>
                    <Plus className="w-3.5 h-3.5" />{t('patientProfile.mobile.newPlanAction', 'Yangi reja')}
                  </button>
                </div>

                {plans.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center shadow-xs">
                    <ClipboardList className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-500 font-bold text-sm">{t('patientProfile.mobile.emptyPlans', "Davolash rejalari yo'q")}</p>
                    <button onClick={() => setTreatModalOpen(true)} className="mt-4 px-5 py-2.5 text-white rounded-xl text-xs font-bold active:scale-95 transition-transform" style={{ background: TEAL }}>
                      + {t('patientProfile.mobile.addPlan', "Reja qo'shish")}
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
                      ? { label: 'Rejalashtirilgan', cls: 'bg-cyan-100 text-cyan-700' }
                    : { label: 'Yangi', cls: 'bg-slate-100 text-slate-600' };

                  return (
                    <div key={plan.id} className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
                      <button className="w-full p-4 text-left flex items-start gap-3 active:bg-slate-50 transition-colors" onClick={() => setExpandedPlan(isExpanded ? null : plan.id)}>
                        <div className="w-10 h-10 rounded-xl bg-cyan-50 border border-cyan-100 flex items-center justify-center shrink-0">
                          <Stethoscope className="w-5 h-5 text-[#14b8a6]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-black text-slate-900 leading-snug">{plan.name || t('patientProfile.treatmentPlanSingular', 'Davolash rejasi')}</p>
                            <ChevronRight className={cn('w-4 h-4 text-slate-400 shrink-0 transition-transform mt-0.5', isExpanded && 'rotate-90')} />
                          </div>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusInfo.cls}`}>{statusInfo.label}</span>
                            {plan.total_price > 0 && (
                              <span className="text-[10px] font-black text-slate-700 font-mono">{fmt(plan.total_price)} {t('dashboard.currency', "so'm")}</span>
                            )}
                          </div>
                          {services.length > 0 && (
                            <div className="mt-2.5">
                              <div className="flex items-center justify-between text-[9px] text-slate-400 font-bold mb-1">
                                <span>{completedSvcs}/{services.length}</span>
                                <span>{progress}%</span>
                              </div>
                              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #2dd4bf, #14b8a6)' }} />
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
                                  <span className="text-xs font-black text-purple-600">-{fmt(plan.discount_amount)} {t('dashboard.currency', "so'm")}</span>
                                </div>
                              )}
                              <div className="flex items-center justify-between py-1.5 border-t border-slate-200">
                                <span className="text-[10px] font-black text-slate-700 uppercase">Jami</span>
                                <span className="text-sm font-black text-slate-900 font-mono">{fmt(plan.total_price)} {t('dashboard.currency', "so'm")}</span>
                              </div>
                              <button onClick={() => openPayModal()} className="w-full py-2.5 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-transform mt-1" style={{ background: TEAL }}>
                                <CreditCard className="w-3.5 h-3.5" />{t('patientProfile.mobile.payAction', "To'lov")}
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

            {activeTab === 'payments' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-black text-slate-800">{t('patientProfile.tabs.payments', "To'lovlar")} ({payments.length})</h2>
                  <button onClick={() => openPayModal()} className="flex items-center gap-1 px-3 py-2 text-white rounded-xl text-xs font-bold active:scale-95 transition-transform" style={{ background: TEAL }}>
                    <Plus className="w-3.5 h-3.5" />{t('patientProfile.mobile.payAction', "To'lov")}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3.5 text-center">
                    <p className="text-[10px] font-bold text-emerald-600 uppercase">{t('patientProfile.financialCard.totalPaid', "Jami to'langan")}</p>
                    <p className="text-lg font-black text-emerald-700 font-mono mt-0.5">{fmt(financials.incomes)}</p>
                    <p className="text-[9px] text-emerald-500 font-bold">{t('dashboard.currency', "so'm")}</p>
                  </div>
                  <div className={cn('rounded-xl p-3.5 text-center border', financials.debt > 0 ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200')}>
                    <p className={`text-[10px] font-bold uppercase ${financials.debt > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                      {financials.debt > 0 ? t('patientProfile.mobile.debt', 'Qarz') : 'Balans'}
                    </p>
                    <p className={`text-lg font-black font-mono mt-0.5 ${financials.debt > 0 ? 'text-rose-600' : 'text-slate-400'}`}>{fmt(financials.debt)}</p>
                    <p className={`text-[9px] font-bold ${financials.debt > 0 ? 'text-rose-400' : 'text-slate-400'}`}>{t('dashboard.currency', "so'm")}</p>
                  </div>
                </div>

                {payments.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center shadow-xs">
                    <Receipt className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-500 font-bold text-sm">{t('patientProfile.mobile.emptyPayments', "To'lovlar yo'q")}</p>
                    <button onClick={() => openPayModal()} className="mt-4 px-5 py-2.5 text-white rounded-xl text-xs font-bold active:scale-95 transition-transform" style={{ background: TEAL }}>
                      + {t('patientProfile.mobile.payAction', "To'lov")}
                    </button>
                  </div>
                ) : payments.map(pay => {
                  const tp = (pay.type || '').toLowerCase();
                  const icon = tp === 'income' ? '💳' : tp === 'refund' ? '↩️' : tp === 'expense' ? '📤' : '📋';
                  const amtColor = tp === 'income' ? 'text-emerald-700' : tp === 'refund' ? 'text-indigo-600' : 'text-rose-600';
                  const amtSign = tp === 'income' ? '+' : '-';
                  const label = tp === 'income' ? t('patientProfile.teeth.statusPaymentReceived', "To'lov qabul qilindi") : tp === 'refund' ? t('patientProfile.teeth.statusDiscountRefund', "To'lov qaytarildi") : tp === 'expense' ? t('patientProfile.teeth.statusExpense', 'Xarajat') : t('patientProfile.mobile.debt', 'Qarz');
                  const bgColor = tp === 'income' ? 'bg-emerald-50 border-emerald-200' : tp === 'refund' ? 'bg-indigo-50 border-indigo-200' : tp === 'expense' ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200';

                  return (
                    <div key={pay.id} className="bg-white rounded-2xl border border-slate-100 shadow-xs p-4 flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border text-base ${bgColor}`}>{icon}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-slate-900">{label}</p>
                        {pay.category && <p className="text-[10px] text-slate-400 font-bold">{pay.category === 'Treatment' ? t('patientProfile.treatmentPlanSingular', 'Davolash') : pay.category}</p>}
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {pay.date && <span className="text-[10px] font-bold text-slate-400">{new Date(pay.date).toLocaleDateString(dateLocale, { day: '2-digit', month: 'short', year: 'numeric' })}</span>}
                          {pay.method && <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">{pay.method === 'Cash' ? 'Naqd' : pay.method === 'Card' ? 'Karta' : "O'tkazma"}</span>}
                        </div>
                      </div>
                      <p className={`text-sm font-black font-mono shrink-0 ${amtColor}`}>{amtSign}{fmt(pay.amount)}</p>
                    </div>
                  );
                })}
              </div>
            )}

            {activeTab === 'implant' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-black text-slate-800">{t('patientProfile.tabs.implants', 'Implantlar')} ({implants.length})</h2>
                  <button type="button" onClick={() => navigate('/implants')} className="flex items-center gap-1 px-3 py-2 text-white rounded-xl text-xs font-bold active:scale-95 transition-transform" style={{ background: TEAL }}>
                    <Plus className="w-3.5 h-3.5" />Implant
                  </button>
                </div>
                {implants.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center shadow-xs">
                    <Activity className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-500 font-bold text-sm">{t('patientProfile.mobile.emptyImplants', "Implantlar yo'q")}</p>
                    <button type="button" onClick={() => navigate('/implants')} className="mt-4 px-5 py-2.5 text-white rounded-xl text-xs font-bold active:scale-95 transition-transform" style={{ background: TEAL }}>
                      {t('patientProfile.mobile.openImplants', "Implantlarga o'tish")}
                    </button>
                  </div>
                ) : implants.map((imp) => {
                  const teeth = [...new Set((imp.tooth_numbers || (imp.tooth_number ? [imp.tooth_number] : [])).map(String))];
                  return (
                    <button
                      key={imp.id}
                      type="button"
                      onClick={() => navigate('/implants/' + imp.id)}
                      className="w-full bg-white rounded-2xl border border-slate-100 shadow-xs p-4 flex items-start gap-3 text-left active:scale-[0.99] transition-transform"
                    >
                      <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center shrink-0">
                        <Activity className="w-5 h-5 text-[#14b8a6]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-slate-900 truncate">{imp.firma || imp.brend || imp.service_name || 'Implant'}</p>
                        <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                          {teeth.length ? teeth.map((tn) => '#' + tn).join(' ? ') : '?'}
                          {imp.placement_date ? ' ? ' + formatShortDate(imp.placement_date, dateLocale) : ''}
                        </p>
                        {imp.lifecycle_status ? (
                          <span className="inline-flex mt-1.5 text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{imp.lifecycle_status}</span>
                        ) : null}
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 mt-1 shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>

      {/* TOOTH HISTORY SHEET */}
      <AnimatePresence>
        {toothHistoryOpen && selectedTooth && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={() => setToothHistoryOpen(false)} />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl px-5 pt-4 max-h-[70vh] overflow-y-auto"
              style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
            >
              <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4" />
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-black text-slate-900">
                  {t('patientProfile.mobile.toothHistoryTitle', 'Tish tarixi')} #{selectedTooth.fdi}
                </h3>
                <button onClick={() => setToothHistoryOpen(false)} className="p-2 rounded-xl bg-slate-100 active:scale-95 transition-transform">
                  <X className="w-4 h-4 text-slate-600" />
                </button>
              </div>
              {selectedHistory.length === 0 ? (
                <p className="text-sm font-semibold text-slate-400 text-center py-8">{t('patientProfile.mobile.noHistory', 'Tarix yo\'q')}</p>
              ) : (
                <div className="relative pl-3 space-y-3 before:absolute before:left-[7px] before:top-1 before:bottom-1 before:w-px before:bg-slate-200 pb-2">
                  {selectedHistory.map((item) => (
                    <div key={item.id} className="relative pl-4">
                      <span className={cn('absolute left-0 top-1.5 w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm', item.highlight ? 'bg-rose-500' : 'bg-[#14b8a6]')} />
                      <p className="text-[10px] font-bold text-slate-400">{item.date}{item.meta ? ` · ${item.meta}` : ''}</p>
                      <p className={cn('text-sm font-bold', item.highlight ? 'text-rose-600' : 'text-slate-800')}>{item.title}</p>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

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
                <h3 className="text-base font-black text-slate-900">{t('patientProfile.personalCard.acceptPayment', "To'lov qabul qilish")}</h3>
                <button onClick={() => setPayModalOpen(false)} className="p-2 rounded-xl bg-slate-100 active:scale-95 transition-transform">
                  <X className="w-4 h-4 text-slate-600" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex gap-2">
                  {[
                    { v: 'Income', l: t('patientProfile.mobile.payAction', "To'lov") },
                    { v: 'Expense', l: t('patientProfile.teeth.statusExpense', 'Xarajat') },
                    { v: 'Refund', l: t('patientProfile.teeth.statusDiscountRefund', 'Qaytarma') },
                  ].map(({ v, l }) => (
                    <button key={v} onClick={() => setPayForm(p => ({ ...p, type: v }))}
                      className={cn('flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all active:scale-95',
                        payForm.type === v ? 'text-white border-transparent' : 'bg-slate-50 border-slate-200 text-slate-600')}
                      style={payForm.type === v ? { background: TEAL } : undefined}>
                      {l}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">{t('patientProfile.installments.paymentAmount', 'Summa')} ({t('dashboard.currency', "so'm")})</label>
                  <input type="number" inputMode="numeric" value={payForm.amount} onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))}
                    placeholder="0"
                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xl font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#14b8a6]/30 focus:border-[#14b8a6] transition-all" />
                </div>

                <div className="flex gap-2">
                  {[
                    { v: 'Cash', l: 'Naqd' },
                    { v: 'Card', l: 'Karta' },
                    { v: 'Transfer', l: "O'tkazma" },
                  ].map(({ v, l }) => (
                    <button key={v} onClick={() => setPayForm(p => ({ ...p, method: v }))}
                      className={cn('flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all active:scale-95',
                        payForm.method === v ? 'bg-cyan-50 border-[#14b8a6] text-[#0d9488]' : 'bg-slate-50 border-slate-200 text-slate-600')}>
                      {l}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">{t('patientProfile.installments.notes', 'Izoh')} ({t('common.optional', 'ixtiyoriy')})</label>
                  <input type="text" value={payForm.notes} onChange={e => setPayForm(p => ({ ...p, notes: e.target.value }))}
                    placeholder={t('patientProfile.installments.notesPlaceholder', 'Izoh...')}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#14b8a6]/30 focus:border-[#14b8a6] transition-all" />
                </div>

                <button onClick={handleSavePay} disabled={payingSaving || !payForm.amount}
                  className="w-full py-4 disabled:opacity-50 text-white rounded-2xl text-sm font-black flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg"
                  style={{ background: TEAL }}>
                  {payingSaving ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <><CreditCard className="w-4 h-4" />{t('patientProfile.installments.savePayment', "To'lovni saqlash")}</>}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* OTHER MODALS — existing wiring unchanged */}
      {apptModalOpen && (
        <AppointmentModal isOpen={apptModalOpen} onClose={() => setApptModalOpen(false)}
          onSave={() => { setApptModalOpen(false); setRefreshTick(tick => tick + 1); }}
          prefillPatient={patient} patients={allPatients} doctors={doctors} />
      )}
      {patientModalOpen && patient && (
        <PatientModal isOpen={patientModalOpen} onClose={() => setPatientModalOpen(false)}
          onSave={() => { setPatientModalOpen(false); setRefreshTick(tick => tick + 1); }}
          patient={patient} />
      )}
      {treatModalOpen && (
        <TreatmentPlanModal isOpen={treatModalOpen} onClose={() => setTreatModalOpen(false)}
          onSave={() => { setTreatModalOpen(false); setRefreshTick(tick => tick + 1); }}
          patientId={id} patientName={patient?.full_name} doctors={doctors} />
      )}
    </div>
  );
}
