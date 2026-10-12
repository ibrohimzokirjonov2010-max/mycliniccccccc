import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { BackClose } from '@/hooks/useBackClose';
import { useProfileBack } from '@/hooks/useBack';
import { useUrlState } from '@/hooks/useRestorableState';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useTranslation } from '@/i18n/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import { useClinic } from '@/lib/ClinicContext';
import { useFeature } from '@/hooks/useFeature';
import {
  ArrowLeft, Phone, Calendar, ChevronLeft, MoreHorizontal, Pencil, ShieldAlert, AlertCircle, Wallet, CalendarDays, FilePlus2, Eye, Play, CreditCard, ClipboardList, Plus, Lock, Search,
  AlertTriangle, FileText,
  CheckCircle2, Clock, XCircle, ChevronRight,
  Stethoscope, Receipt, X, Check, Camera, Activity, SlidersHorizontal, ArrowUpDown, Bell, User, Image as ImageIcon, ChevronDown
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { allocateInvoicePayment } from '@/lib/invoiceAllocation';
import { toast } from 'sonner';
import { cn, formatCurrency, formatMoneyAmount, resolveDoctorId } from '@/lib/utils';
import { patientGenderLabel } from '@/lib/patientGender';
import { formatBirthDate, formatDoctorName } from '@/lib/displayText';
import ChairsideClinicalTools from '../components/patients/ChairsideClinicalTools';
import { countImplantTeeth, implantRecordFdis } from '@/lib/fdiNotation';
import { formatPhone, capitalizeName } from '@/lib/utils';
import { deleteTreatmentRow } from '@/lib/treatmentDelete';
import TreatmentDeleteDialog from '@/components/patients/TreatmentDeleteDialog';
import AppointmentModal from '../components/appointments/AppointmentModal';
import PatientModal from '../components/patients/PatientModal';
import TreatmentPlanModal from '../components/treatments/TreatmentPlanModal';
import TreatmentPlanInvoice from '../components/treatments/TreatmentPlanInvoice';
import { isPlanLocked, PLAN_LOCKED_BADGE, PLAN_LOCKED_TOOLTIP } from '@/lib/planLock';
import { numberPlans, planTitle, planTotal, planPaid, planStatusKey, isDoneStatus } from '@/lib/planGroups';
import ImplantForm from '../components/implants/ImplantForm';
import {
  fdiToInternalId,
} from '../components/patients/MobileCompactOdontogram';
import ToothChartCard from '../components/patients/ToothChartCard';
import TodayPlanBar from '../components/patients/TodayPlanBar';
import { buildPlanStepperGroups } from '../components/patients/planStepperModel';
import { setPlanStepInProgress } from '@/lib/planStepAdvance';
import { getToothIllustrationSrc } from '@/utils/toothIllustration';
import { isOncePricingDirty, withOncePricing } from '@/lib/toothPlanCharge';
import { matchIllustrationKind } from '@/utils/toothIllustration';

const TEAL = '#14b8a6';
const TEAL_DARK = '#0d9488';
const NAVY = '#0f172a';

const getInitials = (name) =>
  name?.split(' ')?.map(n => n[0])?.join('')?.substring(0, 2)?.toUpperCase() || '?';

const fmt = (n) => formatMoneyAmount(n);

const getLocalDT = () => {
  const now = new Date();
  return new Date(now - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

const UZ_SHORT_MONTHS = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyun', 'Iyul', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];
const RU_SHORT_MONTHS = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
const EN_SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const parseSafeDate = (raw) => {
  if (!raw) return null;
  if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const [y, m, d] = raw.slice(0, 10).split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    if (!isNaN(dt.getTime())) return dt;
  }
  const dt = new Date(raw);
  return isNaN(dt.getTime()) ? null : dt;
};

const formatStandardDate = (raw) => {
  const dt = parseSafeDate(raw);
  if (!dt) return '—';
  const day = String(dt.getDate()).padStart(2, '0');
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const year = dt.getFullYear();
  return `${day}.${month}.${year}`;
};

const formatShortDate = (raw) => {
  return formatStandardDate(raw);
};

const formatAppointmentTime = (appt) => {
  if (!appt) return '';
  if (appt.time) {
    const clean = String(appt.time).trim();
    if (clean.includes(':')) return clean.slice(0, 5);
  }
  if (appt.start_time) {
    const clean = String(appt.start_time).trim();
    if (clean.includes(':')) return clean.slice(0, 5);
    const dt = new Date(appt.start_time);
    if (!isNaN(dt.getTime())) {
      return `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
    }
  }
  if (appt.date && typeof appt.date === 'string' && appt.date.includes('T')) {
    const dt = new Date(appt.date);
    if (!isNaN(dt.getTime()) && (dt.getHours() !== 0 || dt.getMinutes() !== 0)) {
      return `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
    }
  }
  return '';
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
  if (/endo|kanal|pulpit|endodont/.test(s)) return 'in_progress';
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

function MiniCalendarMark({ date, language = 'uz' }) {
  const dt = parseSafeDate(date);
  const day = dt ? dt.getDate() : '—';
  let month = '';
  if (dt) {
    const idx = dt.getMonth();
    if (language === 'ru') month = RU_SHORT_MONTHS[idx];
    else if (language === 'en') month = EN_SHORT_MONTHS[idx];
    else month = UZ_SHORT_MONTHS[idx];
  }
  return (
    <div className="w-11 h-11 rounded-2xl bg-[#FFF8E7] border border-amber-100 flex flex-col items-center justify-center overflow-hidden shadow-sm">
      <span className="text-[8px] font-black uppercase tracking-wider text-amber-600 leading-none">{month || '—'}</span>
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
  const canImplants = useFeature('implants');

  const [patient, setPatient]                   = useState(null);
  const [plans, setPlans]                       = useState([]);
  const [payments, setPayments]                 = useState([]);
  const [appointments, setAppointments]         = useState([]);
  const [doctors, setDoctors]                   = useState([]);
  const [services, setServices]                 = useState([]);
  const [loading, setLoading]                   = useState(true);
  // Tab URL'da (?tab=) saqlanadi — Orqaga/yangilashda tiklanadi
  const [rawTab, setActiveTab]                  = useUrlState('tab', 'main');
  const activeTab = ['tarix', 'plan', 'payments', 'implant'].includes(rawTab) ? rawTab : 'main';
  const isMain = activeTab === 'main';
  const [mainSub, setMainSub] = useState('chart');
  const [clinicalTab, setClinicalTab] = useState('tashxis');
  const [paySortAsc, setPaySortAsc] = useState(false);
  const [payMethodFilter, setPayMethodFilter] = useState('all');
  const [payFilterOpen, setPayFilterOpen] = useState(false);
  const [payMenuId, setPayMenuId] = useState(null);
  const [implantSubTab, setImplantSubTab] = useState({});
  const [planOpenOnly, setPlanOpenOnly] = useState(false);
  const [historyKind, setHistoryKind] = useState('all');
  const [apptModalOpen, setApptModalOpen]       = useState(false);
  const [selectedAppt, setSelectedAppt]         = useState(null);
  const [patientModalOpen, setPatientModalOpen] = useState(false);
  const [treatModalOpen, setTreatModalOpen]     = useState(false);
  const [payModalOpen, setPayModalOpen]         = useState(false);
  const [implantModalOpen, setImplantModalOpen] = useState(false);
  const [selectedImplant, setSelectedImplant]   = useState(null);
  const [photoUploading, setPhotoUploading]     = useState(false);
  const [noteText, setNoteText]                 = useState('');
  const [notesSaving, setNotesSaving]           = useState(false);
  const [allPatients, setAllPatients]           = useState([]);
  const [refreshTick, setRefreshTick]           = useState(0);
  const [expandedPlan, setExpandedPlan]         = useState(null);
  const [planSearch, setPlanSearch]             = useState('');
  const [invoicePlan, setInvoicePlan]           = useState(null);
  const [pendingDelete, setPendingDelete]       = useState(null);
  const [deletingTreatment, setDeletingTreatment] = useState(false);
  const payingSavingRef                         = useRef(false);
  const payTxRef                                = useRef('');
  const tabPanelRef                             = useRef(null);
  const [payForm, setPayForm]                   = useState({
    type: 'Income', amount: '', method: 'Cash',
    category: 'Treatment', date: getLocalDT(), notes: '', doctor_id: '',
  });
  const [payingSaving, setPayingSaving] = useState(false);
  const [payPlanId, setPayPlanId] = useState('');
  const [selectedTooth, setSelectedTooth]       = useState(null);
  const [toothRecords, setToothRecords]         = useState([]);
  const [toothHistoryOpen, setToothHistoryOpen] = useState(false);
  const [implants, setImplants]                 = useState([]);

  const dateLocale = language === 'ru' ? 'ru-RU' : language === 'en' ? 'en-GB' : 'uz-UZ';

  /* ── load ── */
  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [patRes, plansRes, paysRes, apptRes, usersRes, toothRes, implantRes, servicesRes, allPatRes] = await Promise.all([
        base44.entities.Patient.filter({ id }),
        base44.entities.TreatmentPlan.filter({ patient_id: id }, '-created_date', 50),
        base44.entities.Payment.filter({ patient_id: id }, '-date', 200),
        base44.entities.Appointment.filter({ patient_id: id }, '-date', 30),
        base44.entities.User.list('name', 100).catch(() => []),
        base44.entities.ToothRecord.filter({ patient_id: id }, '-created_date', 100).catch(() => []),
        (canImplants
          ? base44.entities.Implant.filter({ patient_id: id }, '-placement_date', 50)
          : Promise.resolve([])
        ).catch(() => []),
        base44.entities.Service.list('name', 200).catch(() => []),
        base44.entities.Patient.list('full_name', 200).catch(() => []),
      ]);
      const raw = patRes[0] || null;
      if (raw && raw.full_name) raw.full_name = capitalizeName(raw.full_name);
      setPatient(raw);
      const loadedPlans = plansRes || [];
      setPlans(loadedPlans);
      if (id && id !== 'patient-y2ii8ynf2') {
        loadedPlans.forEach((plan) => {
          if (!plan?.id || !isOncePricingDirty(plan)) return;
          base44.entities.TreatmentPlan.update(plan.id, {
            services: plan.services,
            total_price: plan.total_price,
          }).catch((err) => console.error('[once-pricing]', err));
        });
      }
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
      setServices(servicesRes || []);
      if (Array.isArray(allPatRes) && allPatRes.length > 0) {
        setAllPatients(allPatRes);
      }
    } catch (err) {
      console.error('MobilePatientProfile load:', err);
      toast.error('Bemorni yuklashda xatolik');
    } finally {
      setLoading(false);
    }
  }, [id, canImplants]);

  useEffect(() => { load(); }, [load, refreshTick]);

  /* ── financials ── */
  const financials = useMemo(() => {
    const incomes    = payments.filter(p => (p.type || '').toLowerCase() === 'income').reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const refunds    = payments.filter(p => (p.type || '').toLowerCase() === 'refund').reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const pricedPlans = withOncePricing(plans);
    const plansTotal = pricedPlans.reduce((s, p) => s + (Number(p.total_price) || 0), 0);
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

  const planStepper = useMemo(
    () => buildPlanStepperGroups({ appointments, plans, implants, language }),
    [appointments, plans, implants, language],
  );
  const planRemainingTotal = useMemo(() => withOncePricing(plans).reduce((sum, plan) => {
    const status = String(plan.status || '').toLowerCase();
    if (status === 'cancelled' || status === 'canceled') return sum;
    return sum + Math.max(0, (Number(plan.total_price) || 0) - (Number(plan.paid_amount) || 0));
  }, 0), [plans]);

  /* ── plans: bitta reja = bitta karta (Reja N (#tishlar)) ── */
  const planCards = useMemo(() => {
    const numberOf = numberPlans(plans);
    const q = planSearch.trim().toLowerCase();
    return (plans || []).map((plan, idx) => {
      const number = numberOf(plan, idx);
      const title = planTitle(number, plan);
      const services = plan.services || [];
      const rows = !q || title.toLowerCase().includes(q) || String(plan.name || '').toLowerCase().includes(q)
        ? services
        : services.filter((svc) => `${svc.service_name || svc.name || ''} ${svc.tooth_number || ''} ${svc.doctor || ''}`.toLowerCase().includes(q));
      const hit = !q || rows.length > 0 || title.toLowerCase().includes(q) || String(plan.name || '').toLowerCase().includes(q);
      const total = planTotal(plan);
      const paid = planPaid(plan, plans, Math.max(financials.incomes || 0, Number(patient?.total_paid || 0)));
      return { plan, number, title, rows, hit, total, paid, debt: Math.max(0, total - paid), status: planStatusKey(plan), locked: isPlanLocked(plan) };
    }).filter((card) => card.hit).sort((a, b) => b.number - a.number);
  }, [plans, planSearch, financials.incomes, patient]);

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
        const next = { status, fdi: token, illustrationKind: extra.illustrationKind, ...extra };
        const prev = map[id];
        const rank = { extracted: 6, implant: 5, crown: 4, completed: 3, caries: 2, in_progress: 1, planned: 0 };
        if (!prev || (rank[status] || 0) >= (rank[prev.status] || 0)) {
          map[id] = next;
          map[String(token)] = next;
        }
      });
    };

    (toothRecords || []).forEach((r) => {
      const blob = `${r.condition || ''} ${r.treatment || ''} ${r.status || ''} ${r.notes || ''}`;
      const st = inferStatus(blob) || (r.status && STATUS_LABEL_KEY[r.status] ? r.status : null);
      if (st) assign(r.tooth_number, st, { diagnosis: r.condition || r.treatment, illustrationKind: matchIllustrationKind(blob) || undefined });
    });

    (plans || []).forEach((plan) => {
      const planServices = plan.services || [];
      const planTooth = String(plan.tooth_number || '').trim();
      const items = planServices.length
        ? planServices
        : (planTooth ? [{ service_name: plan.name, status: plan.status, tooth_number: planTooth, category: plan.category }] : []);
      items.forEach((svc) => {
        const fdi = svc.tooth_number || svc.tooth_id || planTooth;
        const blob = `${svc.service_name || ''} ${svc.name || ''} ${plan.name || ''} ${svc.status || ''} ${plan.status || ''} ${svc.category || ''} ${plan.category || ''}`;
        const st = inferStatus(blob);
        if (st && fdi) assign(fdi, st, { diagnosis: svc.service_name || plan.name, illustrationKind: matchIllustrationKind(blob, svc.category || plan.category) || undefined });
      });
    });

    (implants || []).forEach((imp) => {
      implantRecordFdis(imp).forEach((num) => {
        const token = String(num).replace(/^#/, '').trim();
        if (!token) return;
        const id = fdiToInternalId(token);
        if (!id) return;
        const next = {
          status: 'implant',
          hasImplant: true,
          illustrationKind: 'implant',
          fdi: token,
          diagnosis: 'Implant',
        };
        map[id] = next;
        map[token] = next;
      });
    });

    return map;
  }, [plans, toothRecords, implants]);

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
    { id: 'tarix',    label: t('patientProfile.tabs.historyShort', 'Tarix') },
    { id: 'plan',     label: t('patientProfile.tabs.planShort', 'Reja') },
    { id: 'payments', label: t('patientProfile.tabs.payShort', "To'lov") },
    ...(canImplants ? [{ id: 'implant', label: t('patientProfile.tabs.implantShort', 'Implant') }] : []),
  ]), [t, canImplants]);

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
  const openPayModal = useCallback((prefillCategory = 'Treatment', prefillNotes = '', prefillAmount = '') => {
    const docId = resolveDoctorId(patient, plans, doctors, user, isDoctor);
    setPayPlanId('');
    setPayForm({
      type: 'Income',
      amount: prefillAmount ? String(prefillAmount) : (financials.debt > 0 ? String(Math.round(financials.debt)) : ''),
      method: 'Cash',
      category: prefillCategory,
      date: getLocalDT(),
      notes: prefillNotes,
      doctor_id: docId || doctors[0]?.id || ''
    });
    setPayModalOpen(true);
  }, [patient, plans, doctors, user, isDoctor, financials.debt]);

  /* ── save payment ── */
  const handleSavePay = async () => {
    if (payingSavingRef.current || !payForm.amount) { toast.error('Summani kiriting'); return; }
    if (id === 'patient-y2ii8ynf2') { toast.error("Bu test bemor ma'lumoti o'zgartirilmaydi"); return; }
    payingSavingRef.current = true;
    setPayingSaving(true);
    try {
      const amount = Number(String(payForm.amount).replace(/\D/g, ''));
      const txId = payTxRef.current || (payTxRef.current = `pay_${id}_${Date.now()}`);
      await base44.entities.Payment.create({
        id: txId, patient_id: id, patient_name: patient?.full_name,
        type: payForm.type, amount,
        method: payForm.method, category: payForm.category,
        date: payForm.date || new Date().toISOString(), notes: payForm.notes, doctor_id: payForm.doctor_id,
      });
      if ((payForm.type || 'Income').toLowerCase() === 'income') {
        const slices = allocateInvoicePayment(plans, amount, payPlanId);
        for (const slice of slices) {
          await base44.entities.TreatmentPlan.update(slice.id, { paid_amount: slice.paid_amount });
        }
      }
      payTxRef.current = '';
      toast.success("To'lov saqlandi");
      setPayModalOpen(false);
      setPayPlanId('');
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
  const handleBack = useProfileBack('/patients');

  const clinicLabel = clinicName && clinicName !== 'ShifoCRM'
    ? clinicName
    : t('patientProfile.mobile.clinicFallback', 'stomatolog kabineti');

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

  /* profile-redesign-1012 helpers (plain values; computed after loading guards) */
  const isSvcDone = (svc) => svc?.status === 'completed' || isDoneStatus(svc?.status);
  const dateBlock = (raw) => {
    const d = parseSafeDate(raw);
    if (!d) return null;
    const months = language === 'ru' ? RU_SHORT_MONTHS : language === 'en' ? EN_SHORT_MONTHS : UZ_SHORT_MONTHS;
    return { day: String(d.getDate()).padStart(2, '0'), month: months[d.getMonth()], year: d.getFullYear() };
  };
  const DateBlock = ({ raw }) => {
    const b = dateBlock(raw);
    return (
      <div className="w-12 shrink-0 rounded-xl bg-slate-50 border border-slate-100 py-1.5 text-center leading-tight">
        {b ? (<><p className="text-[16px] font-black text-slate-900">{b.day}</p><p className="text-[10px] font-semibold text-slate-500">{b.month}</p><p className="text-[10px] font-semibold text-slate-400">{b.year}</p></>) : <p className="text-[11px] text-slate-400 py-2">—</p>}
      </div>
    );
  };
  const historyItems = [
    ...appointments.map((a) => ({
      key: `a-${a.id}`, kind: 'appt', raw: a, date: a.date || a.appointment_date,
      title: a.service_name || a.type || t('patientProfile.mobile.apptAction', 'Uchrashuv'),
      doctor: a.doctor_name || a.doctor, note: a.notes && a.notes !== a.service_name ? a.notes : '',
      tooth: a.tooth_number, time: formatAppointmentTime(a), price: Number(a.price) || 0, status: a.status,
    })),
    ...(plans || []).flatMap((pl) => (pl.services || []).filter(isSvcDone).map((svc, i) => ({
      key: `d-${pl.id}-${i}`, kind: 'done', date: svc.completed_date || svc.completed_at || svc.date || pl.updated_date || pl.created_date,
      title: svc.service_name || svc.name || 'Muolaja', doctor: svc.doctor || pl.doctor_name, note: svc.notes || '',
      tooth: svc.tooth_number, price: Number(svc.price) || 0, status: 'Completed',
    }))),
  ].sort((x, y) => (parseSafeDate(y.date)?.getTime() || 0) - (parseSafeDate(x.date)?.getTime() || 0));
  const startPlanStep = async (plan, idx) => {
    try {
      await setPlanStepInProgress(plan, idx);
      toast.success('Davolash bosqichi boshlandi');
      await load();
    } catch (error) {
      console.error('Start plan step error:', error);
      toast.error('Bosqichni yangilashda xatolik yuz berdi');
    }
  };
  const payTotal = (Number(financials.incomes) || 0) + (Number(financials.debt) || 0);
  const payPct = payTotal > 0 ? Math.min(100, Math.round(((Number(financials.incomes) || 0) / payTotal) * 100)) : 0;
  const compactMln = (n) => {
    const v = Number(n) || 0;
    if (v >= 1e6) return `${(Math.round(v / 1e5) / 10).toString()}M`;
    if (v >= 1e3) return `${Math.round(v / 1e3)}K`;
    return String(Math.round(v));
  };
  const IMPLANT_STATUS = {
    planned: { label: 'Rejalashtirilgan', cls: 'bg-blue-50 text-blue-700' },
    placed: { label: "O'rnatilgan", cls: 'bg-emerald-50 text-emerald-700' },
    healing: { label: 'Bitish davri', cls: 'bg-amber-50 text-amber-700' },
    osseointegration: { label: 'Bitish davri', cls: 'bg-amber-50 text-amber-700' },
    loaded: { label: 'Koronka qo‘yilgan', cls: 'bg-emerald-50 text-emerald-700' },
    completed: { label: 'Yakunlangan', cls: 'bg-emerald-50 text-emerald-700' },
    failed: { label: 'Muvaffaqiyatsiz', cls: 'bg-rose-50 text-rose-700' },
  };

  const advanceStep = async (step) => {
            const plan = (plans || []).find((p) => String(p.id) === String(step?.planId));
            try {
              await setPlanStepInProgress(plan, step?.serviceIndex);
            } catch (error) {
              console.error('Advance plan step error:', error);
              toast.error("Bosqichni yangilashda xatolik yuz berdi");
              return false;
            }
            toast.success(`Keyingi bosqich boshlandi: ${step?.title || 'Bosqich'}`);
            try {
              await load();
            } catch (reloadError) {
              console.error('Plan reload after advance failed:', reloadError);
            }
            return true;
  };

  const planTabJsx = (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="min-w-0"><h2 className="text-[18px] font-extrabold text-[#0f1f4b]">{t('patientProfile.mobile.plansTitle', 'Davolash rejalari')} ({plans.length})</h2><p className="text-[12px] font-medium text-slate-500">Bemor uchun tuzilgan barcha davolash rejalari</p></div>
                  <button onClick={() => setTreatModalOpen(true)} className="flex items-center gap-1.5 px-3.5 h-11 text-white rounded-xl text-[13px] font-semibold active:scale-95 transition-transform bg-[#0f9a72] shrink-0">
                    <Plus className="w-4 h-4" />{t('patientProfile.mobile.newPlanAction', 'Yangi reja')}
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
                ) : (
                  <div className="flex gap-2">
                    <div className="relative flex-1 min-w-0">
                      <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                      <input
                        type="text"
                        value={planSearch}
                        onChange={(e) => setPlanSearch(e.target.value)}
                        placeholder="Reja, xizmat, tish # qidirish..."
                        className="w-full pl-11 pr-3 h-12 bg-white border border-slate-200 rounded-2xl text-[14px] font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                      />
                    </div>
                    <button type="button" onClick={() => setPlanOpenOnly((v) => !v)} aria-pressed={planOpenOnly} title="Faqat tugallanmagan rejalar"
                      className={cn('w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0', planOpenOnly ? 'bg-teal-50 border-teal-200 text-teal-700' : 'bg-white border-slate-200 text-slate-600')}>
                      <SlidersHorizontal className="w-5 h-5" />
                    </button>
                  </div>
                )}
                {plans.length > 0 && planCards.length === 0 && (
                  <p className="text-center text-xs font-semibold text-slate-400 py-8">Davolash muolajalari topilmadi</p>
                )}
                {plans.length > 0 && planCards.filter(({ plan }) => !planOpenOnly || !['completed', 'bajarildi'].includes(String(plan.status || '').toLowerCase())).map(({ plan, title, rows, total, paid, debt, status, locked }) => {
                  const isExpanded = planSearch.trim() ? true : expandedPlan === plan.id;
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
                    <div key={plan.id} className="bg-white rounded-[20px] border border-slate-100 shadow-[0_2px_10px_rgba(15,23,42,0.05)] overflow-hidden">
                      <button className="w-full px-3.5 pt-3.5 pb-2 text-left flex items-start gap-3 active:bg-slate-50 transition-colors" onClick={() => setExpandedPlan(isExpanded ? null : plan.id)}>
                        <div className="w-12 h-12 rounded-2xl bg-cyan-50 border border-cyan-100 flex items-center justify-center shrink-0">
                          <Stethoscope className="w-6 h-6 text-[#14b8a6]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-[15px] font-bold text-slate-900 leading-snug flex items-center gap-1.5 min-w-0">
                              <span className="truncate">{title}</span>
                              {locked && (
                                <span data-testid="plan-locked-icon" title={PLAN_LOCKED_TOOLTIP} aria-label={PLAN_LOCKED_BADGE} className="inline-flex items-center shrink-0 text-amber-600">
                                  <Lock className="w-4 h-4" />
                                </span>
                              )}
                            </p>
                            <ChevronRight className={cn('w-4 h-4 text-slate-400 shrink-0 transition-transform mt-0.5', isExpanded && 'rotate-90')} />
                          </div>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className={`text-[11.5px] font-semibold px-2 py-0.5 rounded-md ${statusInfo.cls}`}>{statusInfo.label}</span>
                            <span className="text-[11.5px] font-medium text-slate-500">
                              {plan.created_date ? String(plan.created_date).slice(0, 10) : '—'} · {services.length} ta xizmat
                            </span>
                          </div>
                        </div>
                      </button>
                      <div className="px-3.5 pb-2">
                          <div className="grid grid-cols-3 gap-2">
                            <div className="rounded-xl border border-slate-200/80 px-2.5 py-2">
                              <p className="text-[10.5px] font-bold text-slate-700 uppercase">Jami</p>
                              <p className="text-[13px] font-extrabold text-slate-900 leading-tight mt-0.5 whitespace-nowrap tracking-tight">{formatCurrency(total)}</p>
                            </div>
                            <div className="rounded-xl border border-slate-200/80 px-2.5 py-2">
                              <p className="text-[10.5px] font-bold text-emerald-600 uppercase">To‘langan</p>
                              <p className="text-[13px] font-extrabold text-emerald-600 leading-tight mt-0.5 whitespace-nowrap tracking-tight">{formatCurrency(paid)}</p>
                            </div>
                            <div className="rounded-xl border border-slate-200/80 px-2.5 py-2">
                              <p className={`text-[10.5px] font-bold uppercase ${debt > 0 ? 'text-rose-600' : 'text-slate-500'}`}>Qarz</p>
                              <p className={`text-[13px] font-extrabold leading-tight mt-0.5 whitespace-nowrap tracking-tight ${debt > 0 ? 'text-rose-600' : 'text-slate-500'}`}>{formatCurrency(debt)}</p>
                            </div>
                          </div>
                          <div className="mt-3">
                            <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium mb-1">
                              <span>{completedSvcs}/{services.length} xizmat</span>
                              <span>{progress}%</span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #2dd4bf, #14b8a6)' }} />
                            </div>
                          </div>
                      </div>

                      {services.length > 0 && (
                        <div className="px-3.5 pb-2" data-testid="plan-main-services">
                          <p className="text-[11.5px] font-semibold text-slate-600 mb-1.5">Rejadagi asosiy xizmatlar:</p>
                          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                            {services.slice(0, 3).map((svc, i) => {
                              const fdi = String(svc.tooth_number || '').match(/\d{2}/)?.[0];
                              const img = fdi ? getToothIllustrationSrc(fdi, 'healthy') : null;
                              return (
                                <span key={svc.id || i} className={cn('shrink-0 inline-flex items-center gap-1.5 h-12 pl-1.5 pr-2.5 rounded-xl border', isSvcDone(svc) ? 'border-emerald-100 bg-emerald-50' : 'border-slate-200/80 bg-white')}>
                                  {img ? <img src={img} alt="" className="w-6 h-10 object-contain" /> : null}
                                  <span className="flex flex-col leading-tight">
                                    <b className="text-[12px] text-slate-900">{svc.tooth_number || '—'}</b>
                                    <span className="text-[11px] text-slate-500 max-w-[4.5rem] truncate">{svc.service_name || svc.name}</span>
                                  </span>
                                </span>
                              );
                            })}
                            {services.length > 3 && (
                              <>
                                <button type="button" onClick={() => setExpandedPlan(plan.id)} aria-label="Barcha xizmatlar" className="shrink-0 w-10 h-12 rounded-xl border border-slate-200/80 bg-white text-slate-500 inline-flex items-center justify-center"><MoreHorizontal className="w-4 h-4" /></button>
                                <button type="button" onClick={() => setExpandedPlan(plan.id)} className="shrink-0 inline-flex items-center h-12 px-3 rounded-xl bg-blue-50 text-blue-600 text-[11.5px] font-semibold">+{services.length - 3} ta xizmat</button>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                      {(() => {
                        const nextIdx = services.findIndex((svc) => !isSvcDone(svc) && svc.status !== 'in_progress');
                        const inProgress = services.some((svc) => svc.status === 'in_progress');
                        return (
                          <div className="px-3.5 pb-3.5 pt-1.5 grid grid-cols-2 gap-2">
                            <button type="button" onClick={() => setExpandedPlan(isExpanded ? null : plan.id)} className="h-12 rounded-xl bg-slate-100 text-slate-600 text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 active:scale-[0.98]">
                              <Eye className="w-4 h-4" />{isExpanded ? 'Yopish' : 'Batafsil ko‘rish'}
                            </button>
                            {nextIdx >= 0 ? (
                              <button type="button" data-testid="plan-start-step" onClick={() => startPlanStep(plan, nextIdx)} className="h-12 rounded-xl bg-[#0f8f63] text-white text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 active:scale-[0.98]">
                                <Play className="w-4 h-4 fill-white" />{inProgress ? 'Keyingi bosqich' : 'Davolashni boshlash'}
                              </button>
                            ) : (
                              <button type="button" onClick={() => openPayModal()} className="h-11 rounded-xl bg-emerald-600 text-white text-[12px] font-black inline-flex items-center justify-center gap-1.5 active:scale-[0.98]">
                                <CreditCard className="w-4 h-4" />{t('patientProfile.mobile.payAction', "To'lov")}
                              </button>
                            )}
                          </div>
                        );
                      })()}

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden border-t border-slate-100">
                            <div className="px-4 py-3 space-y-1.5 bg-slate-50/60">
                              {services.length > 0 && services.map((svc, idx) => (!rows.includes(svc) ? null : (
                                <div key={svc.id || idx} className="flex flex-wrap items-center gap-2 py-1.5">
                                  <div className={cn('w-5 h-5 rounded-full flex items-center justify-center shrink-0', (svc.status === 'completed' || svc.payment_status === 'paid') ? 'bg-emerald-500' : 'bg-slate-200')}>
                                    {(svc.status === 'completed' || svc.payment_status === 'paid') ? <Check className="w-3 h-3 text-white" /> : <div className="w-2 h-2 rounded-full bg-slate-400" />}
                                  </div>
                                  <div className="flex-1 min-w-[8rem]">
                                    <p className="text-xs font-bold text-slate-800 truncate">{svc.service_name || svc.name}</p>
                                    <p className="text-[10px] text-slate-400 truncate">
                                      {svc.tooth_number ? `#${svc.tooth_number}` : '—'}
                                      {(svc.doctor || plan.doctor_name) ? ` · ${formatDoctorName(svc.doctor || plan.doctor_name)}` : ''}
                                      {' · '}{(svc.status === 'completed' || svc.payment_status === 'paid' || isDoneStatus(svc.status)) ? 'Bajarildi' : (svc.status === 'in_progress' ? 'Jarayonda' : 'Rejada')}
                                    </p>
                                  </div>
                                  {svc.price > 0 && <span className="text-xs font-black text-slate-700 font-mono shrink-0">{formatCurrency(svc.price)}</span>}
                                  <button
                                    type="button"
                                    onClick={() => setInvoicePlan({ ...plan, paid_amount: paid })}
                                    className="shrink-0 rounded-lg bg-slate-900 px-2 py-1 text-[10px] font-black text-white"
                                  >
                                    Faktura
                                  </button>
                                  <button
                                    type="button"
                                    data-testid="treatment-delete"
                                    onClick={() => setPendingDelete({
                                      planId: plan.id,
                                      serviceIndex: idx,
                                      serviceName: svc.service_name || svc.name,
                                      toothNumber: svc.tooth_number,
                                      price: svc.price,
                                      paidAmount: Math.max(Number(plan.paid_amount) || 0, plans.length === 1 ? Number(financials.incomes) || 0 : 0),
                                    })}
                                    className="shrink-0 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-black text-rose-700"
                                  >
                                    O‘chirish
                                  </button>
                                </div>
                              )))}
                              {plan.discount_amount > 0 && (
                                <div className="flex items-center justify-between py-1.5 border-t border-slate-200 mt-1">
                                  <span className="text-[10px] font-bold text-purple-600">Chegirma</span>
                                  <span className="text-xs font-black text-purple-600">-{formatCurrency(plan.discount_amount)}</span>
                                </div>
                              )}
                              <div className="flex items-center justify-between py-1.5 border-t border-slate-200">
                                <span className="text-[10px] font-black text-slate-700 uppercase">Jami</span>
                                <span className="text-sm font-black text-slate-900 font-mono">{formatCurrency(plan.total_price)}</span>
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
  );
  const notesJsx = (
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
  );

  /* ── RENDER ── */
  return (
    <div
      className="bg-[#F3F6F8] flex flex-col w-full min-w-0 max-w-none"
      style={{ minHeight: 'calc(100dvh - 54px - env(safe-area-inset-bottom, 0px))' }}
    >

      {isMain ? (
      <>
      {/* COMPACT STICKY PROFILE BAR (profile-redesign-1012) */}
      <div
        data-patient-header="true"
        className="sticky top-0 z-30 bg-[#F3F6F8]/95 backdrop-blur-md border-b border-slate-200/60"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="flex items-center gap-2 px-3 h-[52px]">
          <button
            type="button"
            onClick={handleBack}
            aria-label={t('patientProfile.backToList', 'Orqaga')}
            className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 active:scale-95"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <p className="flex-1 min-w-0 truncate text-[15px] font-black text-[#1e3a8a]" data-testid="profile-bar-name">{patient.full_name}</p>
          {phoneHref ? (
            <a href={phoneHref} aria-label={t('patientProfile.call', "Qo'ng'iroq qilish")} className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-blue-600/30 active:scale-95">
              <Phone className="w-4 h-4" />
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => setPatientModalOpen(true)}
            aria-label={t('common.edit', 'Tahrirlash')}
            className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 active:scale-95"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* IDENTITY */}
      <div className="px-4 pt-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => document.getElementById('mob-avatar-input')?.click()}
            className="w-14 h-14 rounded-2xl bg-blue-100/70 text-[#1e40af] flex items-center justify-center text-base font-black shrink-0 overflow-hidden"
            title={t('patientProfile.uploadPhoto', 'Rasm yuklash')}
          >
            {patient.photo_url
              ? <img src={patient.photo_url} alt="" className="w-full h-full object-cover" />
              : (photoUploading ? <Camera className="w-5 h-5" /> : getInitials(patient.full_name))}
          </button>
          <input id="mob-avatar-input" data-testid="profile-photo-input" type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          <button type="button" onClick={() => setPatientModalOpen(true)} className="min-w-0 flex-1 text-left">
            <h1 className="text-[19px] font-black leading-tight text-[#1e3a8a] break-words">{patient.full_name}</h1>
            <p className="mt-0.5 text-[12px] font-semibold text-slate-500 break-words">
              {[
                patientGenderLabel(patient.gender, language),
                age != null ? `${age} yosh` : null,
                clinicLabel,
              ].filter(Boolean).join(' · ')}
            </p>
          </button>
        </div>

        <div className="mt-3 -mx-4 px-4 flex items-center gap-1.5 flex-nowrap overflow-x-auto no-scrollbar text-[12px] whitespace-nowrap" data-testid="patient-card-header-meta">
          {patient.phone ? (
            <a href={phoneHref} className="shrink-0 inline-flex items-center gap-1.5 h-8 px-2.5 rounded-xl bg-white border border-slate-100 font-bold text-blue-700 tabular-nums">
              <Phone className="w-3.5 h-3.5 text-blue-500" />{formatPhone(patient.phone)}
            </a>
          ) : (
            <span className="shrink-0 inline-flex items-center gap-1.5 h-8 px-2.5 rounded-xl bg-white border border-slate-100 font-bold text-slate-400"><Phone className="w-3.5 h-3.5" />Telefon yo'q</span>
          )}
          <span className="shrink-0 inline-flex items-center gap-1.5 h-8 px-2.5 rounded-xl bg-white border border-slate-100 font-semibold text-slate-600">
            <Calendar className="w-3.5 h-3.5 text-blue-500" />
            {formatBirthDate(patient.birth_date) || 'Tug‘ilgan sana yo‘q'}
          </span>
          {patientGenderLabel(patient.gender, language) && (
            <span className="shrink-0 inline-flex items-center h-7 px-2.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-black">{patientGenderLabel(patient.gender, language)}</span>
          )}
          {age != null && (
            <span className="shrink-0 inline-flex items-center h-7 px-2.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-black">{age} yosh</span>
          )}
        </div>

        <div className="mt-2 flex items-center gap-2">
          <div className={cn('flex-1 min-w-0 flex items-center gap-2 h-10 px-3 rounded-xl border text-[12px] font-semibold',
            medicalAlerts.length || patient.important_info ? 'bg-rose-50 border-rose-100 text-rose-700' : 'bg-white border-slate-100 text-slate-600')}
            data-testid="profile-allergy-row"
          >
            <ShieldAlert className={cn('w-4 h-4 shrink-0', medicalAlerts.length || patient.important_info ? 'text-rose-500' : 'text-blue-500')} />
            <span className="truncate">
              {medicalAlerts.length
                ? `Allergiya: ${medicalAlerts.join(', ')}`
                : (patient.important_info ? `Allergiya: ${patient.important_info}` : 'Allergiya yo‘q')}
            </span>
          </div>
          <button type="button" onClick={() => setPatientModalOpen(true)} aria-label="Allergiyani tahrirlash" className="w-10 h-10 rounded-xl bg-white border border-slate-100 text-blue-600 flex items-center justify-center shrink-0 active:scale-95">
            <Pencil className="w-4 h-4" />
          </button>
        </div>

        {financials.debt > 0 && (
          <button
            type="button"
            data-testid="profile-debt-banner"
            onClick={() => {
              setActiveTab('payments');
              requestAnimationFrame(() => tabPanelRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
            }}
            className="mt-3 w-full flex items-center gap-3 rounded-2xl bg-rose-50 border border-rose-100 px-3.5 py-3 text-left active:scale-[0.99]"
          >
            <span className="w-8 h-8 rounded-full bg-rose-600 text-white flex items-center justify-center shrink-0"><AlertCircle className="w-5 h-5" /></span>
            <span className="flex-1 min-w-0">
              <span className="block text-[12px] font-bold text-rose-600">{t('patientProfile.mobile.debt', 'Qarzdorlik')}</span>
              <span className="block text-[20px] font-black text-rose-700 tabular-nums leading-tight">{formatCurrency(financials.debt)}</span>
            </span>
            <span className="w-8 h-8 rounded-xl bg-white/70 text-rose-600 flex items-center justify-center shrink-0"><ChevronRight className="w-4 h-4" /></span>
          </button>
        )}
      </div>

      {/* PILL TABS */}
      <div className={cn('shrink-0 px-3', isMain ? 'pt-3 pb-0' : 'sticky top-0 z-30 pt-3 pb-2 bg-[#F3F6F8]')}>
        <div className="bg-white rounded-[22px] p-1.5 shadow-[0_6px_20px_rgba(15,23,42,0.06)] border border-slate-100 flex min-w-0 overflow-hidden" data-testid="profile-pill-tabs">
          {tabs.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  requestAnimationFrame(() => { const m = document.querySelector('main'); if (m) m.scrollTop = 0; });
                }}
                className={cn(
                  'flex-1 min-w-0 px-1 h-10 text-[13px] leading-tight font-semibold rounded-2xl transition-colors truncate',
                  isActive ? 'bg-[#cdf5ec] text-[#0f766e]' : 'text-slate-500'
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
      {/* ACTION CARDS */}
      <div className="px-4 mt-3 grid grid-cols-3 gap-2 relative z-10">
        <button type="button" onClick={() => openPayModal()} data-testid="profile-action-pay"
          className="rounded-2xl bg-emerald-50 border border-emerald-100 py-3 px-2 flex flex-col items-center gap-1.5 active:scale-[0.97] transition-transform">
          <Wallet className="w-6 h-6 text-emerald-600" />
          <span className="text-[12px] font-black text-emerald-800">{t('patientProfile.mobile.payAction', "To'lov")}</span>
        </button>
        <button type="button" onClick={() => { setSelectedAppt(null); setApptModalOpen(true); }} data-testid="profile-action-appt"
          className="rounded-2xl bg-blue-50 border border-blue-100 py-3 px-2 flex flex-col items-center gap-1.5 active:scale-[0.97] transition-transform">
          <CalendarDays className="w-6 h-6 text-blue-600" />
          <span className="text-[12px] font-black text-blue-800">{t('patientProfile.mobile.apptAction', 'Uchrashuv')}</span>
        </button>
        <button type="button" onClick={() => setTreatModalOpen(true)} data-testid="profile-action-plan"
          className="rounded-2xl bg-orange-50 border border-orange-100 py-3 px-2 flex flex-col items-center gap-1.5 active:scale-[0.97] transition-transform">
          <FilePlus2 className="w-6 h-6 text-orange-500" />
          <span className="text-[12px] font-black text-orange-700">{t('patientProfile.mobile.newPlanAction', 'Yangi reja')}</span>
        </button>
      </div>
      {nextAppointment && (
        <p className="px-4 mt-1.5 text-[11px] font-semibold text-slate-500">
          Keyingi uchrashuv: <b className="text-blue-700">{formatStandardDate(nextAppointment.date || nextAppointment.appointment_date)}{formatAppointmentTime(nextAppointment) ? ` · ${formatAppointmentTime(nextAppointment)}` : ''}</b>
        </p>
      )}

      {/* MAIN SUB-TABS (profile-exact-1012) */}
      <div className="px-3 mt-3">
        <div className="bg-white rounded-[18px] border border-slate-100 shadow-[0_2px_10px_rgba(15,23,42,0.05)] grid grid-cols-4 h-12 px-1" data-testid="profile-main-subtabs">
          {[
            ['chart', 'Tish kartasi'],
            ['reja', 'Davolash rejasi'],
            ['docs', 'Hujjatlar'],
            ['notes', 'Eslatmalar'],
          ].map(([id, label]) => (
            <button key={id} type="button" onClick={() => setMainSub(id)} aria-pressed={mainSub === id}
              className={cn('relative text-[12.5px] font-bold whitespace-nowrap', mainSub === id ? 'text-[#1d6ff2]' : 'text-slate-400')}>
              {label}
              {mainSub === id && <span className="absolute left-3 right-3 bottom-0 h-[3px] rounded-full bg-[#1d6ff2]" />}
            </button>
          ))}
        </div>
      </div>

      <div className="px-3 pt-3 pb-3 space-y-3">
        {mainSub === 'chart' && (
          <>
            <ToothChartCard
              patient={patient}
              plans={plans}
              payments={payments}
              appointments={appointments}
              doctors={doctors}
              services={services}
              implants={implants}
              toothRecords={toothRecords}
              onReload={load}
              onBookAppointment={() => { setSelectedAppt(null); setApptModalOpen(true); }}
              onOpenPlan={() => setTreatModalOpen(true)}
              sheetOffset={84}
              fullArch
            />
            <TodayPlanBar
              design
              part="stepper"
              groups={planStepper.groups}
              title={`Davolash rejasi: ${plans.length} ta`}
              totalDebt={financials.debt}
              planRemaining={planRemainingTotal}
              plans={plans}
              implants={implants}
              onPay={() => openPayModal()}
              onAdvanceStep={advanceStep}
              onNextClinical={(step, opts) => {
                if (opts?.advanced) return;
                document.getElementById('chairside-clinical-tools')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              onOpenPlan={() => setActiveTab('plan')}
            />
            <ChairsideClinicalTools
              patient={patient}
              doctors={doctors}
              onPatientUpdated={(updated) => {
                if (updated) setPatient((prev) => ({ ...(prev || {}), ...updated }));
              }}
              language={language}
              compact
              tabbed
              design
              activeTab={clinicalTab}
              onTabChange={setClinicalTab}
            />
            <TodayPlanBar
              design
              part="pay"
              groups={planStepper.groups}
              title={planStepper.title}
              totalDebt={financials.debt}
              planRemaining={planRemainingTotal}
              plans={plans}
              implants={implants}
              onPay={() => openPayModal()}
            />
          </>
        )}
        {mainSub === 'reja' && planTabJsx}
        {mainSub === 'docs' && (
          <ChairsideClinicalTools
            patient={patient}
            doctors={doctors}
            onPatientUpdated={(updated) => {
              if (updated) setPatient((prev) => ({ ...(prev || {}), ...updated }));
            }}
            language={language}
            compact
            tabbed
            design
            activeTab={clinicalTab === 'rozilik' ? 'rozilik' : 'rvg'}
            onTabChange={setClinicalTab}
          />
        )}
        {mainSub === 'notes' && notesJsx}
      </div>
      </>
      ) : (
      <>
      {/* TAB LAYOUT HEADER (profile-exact-1012) */}
      <div data-patient-header="true" className="bg-[#F3F6F8]" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="flex items-center gap-2 px-4 pt-2">
          <button type="button" onClick={() => setActiveTab('main')} aria-label={t('patientProfile.backToList', 'Orqaga')}
            className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 active:scale-95">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="flex-1" />
          {phoneHref && activeTab !== 'tarix' && activeTab !== 'implant' ? (
            <a href={phoneHref} aria-label={t('patientProfile.call', "Qo'ng'iroq qilish")} className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-blue-600/30 active:scale-95">
              <Phone className="w-4 h-4" />
            </a>
          ) : null}
          <button type="button" onClick={() => setPatientModalOpen(true)} aria-label={t('common.edit', 'Tahrirlash')}
            className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 active:scale-95">
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>
        <div className="flex items-center gap-3 px-4 pl-7 -mt-1">
          <span className="w-12 h-12 rounded-full bg-blue-100/70 text-[#1e40af] flex items-center justify-center text-[15px] font-bold shrink-0 overflow-hidden">
            {patient.photo_url ? <img src={patient.photo_url} alt="" className="w-full h-full object-cover" /> : getInitials(patient.full_name)}
          </span>
          <div className="min-w-0">
            <p className="text-[17px] font-extrabold text-[#1e3a8a] truncate" data-testid="profile-bar-name">{patient.full_name}</p>
            <p className="text-[12px] font-medium text-slate-500 truncate">
              {[patientGenderLabel(patient.gender, language), age != null ? `${age} yosh` : null, clinicLabel].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
        {activeTab === 'payments' && (
          <div className="mt-2.5 px-4 flex items-center gap-1.5 overflow-x-auto no-scrollbar text-[12px] whitespace-nowrap">
            {patient.phone && (
              <a href={phoneHref} className="shrink-0 inline-flex items-center gap-1.5 h-7 px-2 rounded-lg bg-blue-50/70 font-semibold text-blue-700 tabular-nums">
                <Phone className="w-3.5 h-3.5" />{formatPhone(patient.phone)}
              </a>
            )}
            {formatBirthDate(patient.birth_date) && (
              <span className="shrink-0 inline-flex items-center gap-1.5 h-7 px-2 rounded-lg bg-white/70 font-medium text-slate-500">
                <Calendar className="w-3.5 h-3.5 text-blue-500" />{formatBirthDate(patient.birth_date)}
              </span>
            )}
            <span className="flex-1" />
            {patientGenderLabel(patient.gender, language) && <span className="shrink-0 h-6 px-2 rounded-md bg-emerald-50 text-emerald-700 text-[11px] font-semibold inline-flex items-center">{patientGenderLabel(patient.gender, language)}</span>}
            {age != null && <span className="shrink-0 h-6 px-2 rounded-md bg-slate-100 text-slate-600 text-[11px] font-semibold inline-flex items-center">{age} yosh</span>}
          </div>
        )}
      </div>
      {/* PILL TABS */}
      <div className={cn('shrink-0 px-3', isMain ? 'pb-3 pt-1' : 'sticky top-0 z-30 pt-3 pb-2 bg-[#F3F6F8]')}>
        <div className="bg-white rounded-[22px] p-1.5 shadow-[0_6px_20px_rgba(15,23,42,0.06)] border border-slate-100 flex min-w-0 overflow-hidden" data-testid="profile-pill-tabs">
          {tabs.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  requestAnimationFrame(() => { const m = document.querySelector('main'); if (m) m.scrollTop = 0; });
                }}
                className={cn(
                  'flex-1 min-w-0 px-1 h-10 text-[13px] leading-tight font-semibold rounded-2xl transition-colors truncate',
                  isActive ? 'bg-[#cdf5ec] text-[#0f766e]' : 'text-slate-500'
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
      </>
      )}

      {/* CONTENT */}
      {!isMain && (
      <div ref={tabPanelRef} id="mobile-profile-tabpanel" className="flex-1 px-3 pt-3 pb-24" style={{ scrollMarginTop: 96 }}>
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.16 }}>

            {activeTab === 'tarix' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0"><h2 className="text-[18px] font-extrabold text-[#0f1f4b]">Davolanish tarixi</h2><p className="text-[12px] font-medium text-slate-500">Bemorning barcha tashriflari va bajarilgan muolajalar</p></div>
                  <button type="button" data-testid="history-filter" onClick={() => setHistoryKind((k) => (k === 'all' ? 'done' : k === 'done' ? 'appt' : 'all'))}
                    title={historyKind === 'all' ? 'Barchasi' : historyKind === 'done' ? 'Faqat bajarilgan' : 'Faqat uchrashuvlar'}
                    className={cn('w-11 h-11 rounded-xl border flex items-center justify-center shrink-0', historyKind !== 'all' ? 'bg-teal-50 border-teal-200 text-teal-700' : 'bg-white border-slate-200 text-slate-600')}>
                    <SlidersHorizontal className="w-5 h-5" />
                  </button>
                </div>
                {historyKind !== 'all' && <p className="text-[11.5px] font-semibold text-teal-700">{historyKind === 'done' ? 'Faqat bajarilgan muolajalar' : 'Faqat uchrashuvlar'}</p>}

                {historyItems.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center shadow-xs">
                    <Calendar className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                    <p className="text-slate-500 font-bold text-sm">{t('patientProfile.mobile.emptyAppts', "Uchrashuvlar yo'q")}</p>
                    <button onClick={() => { setSelectedAppt(null); setApptModalOpen(true); }} className="mt-3 px-5 py-2.5 text-white rounded-xl text-xs font-bold active:scale-95 transition-transform" style={{ background: TEAL }}>
                      + {t('patientProfile.mobile.addAppt', "Uchrashuv qo'shish")}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5" data-testid="profile-history-timeline">
                    {historyItems.filter((it) => historyKind === 'all' || it.kind === historyKind).map((item) => {
                      const done = item.status === 'Completed';
                      const dot = done ? 'bg-emerald-500' : (item.status === 'Cancelled' || item.status === 'No-Show') ? 'bg-rose-500' : item.status === 'In Progress' ? 'bg-amber-400' : 'bg-blue-500';
                      const imgs = [item.raw?.images, item.raw?.photos, item.raw?.xray_urls, item.raw?.image_urls].flat().filter(Boolean).map((u) => (typeof u === 'string' ? u : u?.url)).filter((u) => typeof u === 'string' && u);
                      return (
                        <div
                          key={item.key}
                          onClick={item.kind === 'appt' ? () => { setSelectedAppt(item.raw); setApptModalOpen(true); } : undefined}
                          className={cn('bg-white rounded-2xl border border-slate-100 shadow-[0_2px_10px_rgba(15,23,42,0.05)] p-3 flex gap-3', item.kind === 'appt' && 'cursor-pointer active:scale-[0.99] transition-transform')}
                        >
                          <DateBlock raw={item.date} />
                          <div className="flex flex-col items-center pt-1.5">
                            <span className={cn('w-2 h-2 rounded-full', dot)} />
                            <span className="flex-1 w-px bg-slate-200 mt-1" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-1.5">
                              <p className="flex-1 min-w-0 text-[14px] font-bold text-slate-900 break-words">
                                {item.title}
                                {item.tooth ? <span className="ml-1.5 align-middle text-[11px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-md">#{item.tooth}</span> : null}
                              </p>
                              <span className="w-8 h-8 rounded-lg border border-slate-200 text-blue-600 flex items-center justify-center shrink-0"><ClipboardList className="w-4 h-4" /></span>
                            </div>
                            <p className="text-[12px] font-medium text-slate-500 -mt-1">
                              {[item.doctor ? formatDoctorName(item.doctor) : null, item.time || null].filter(Boolean).join(' · ') || '—'}
                            </p>
                            {item.note ? <p className="text-[12px] text-slate-700 mt-1 line-clamp-2">{item.note}</p> : null}
                            {imgs.length > 0 && (
                              <div className="mt-2 flex gap-1.5" data-testid="history-thumbs">
                                {imgs.slice(0, 3).map((u, i) => <img key={i} src={u} alt="" className="w-[60px] h-[52px] rounded-lg object-cover bg-slate-100" />)}
                                {imgs.length > 3 && <span className="w-[60px] h-[52px] rounded-lg bg-slate-50 text-slate-500 text-[13px] font-semibold flex items-center justify-center">+{imgs.length - 3}</span>}
                              </div>
                            )}
                            <div className="mt-2 flex items-center justify-between gap-2">
                              {item.kind === 'appt' ? <ApptBadge status={item.status} /> : <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700">Bajarilgan</span>}
                              <span className="text-[14px] font-bold text-slate-900 tabular-nums">{formatCurrency(item.price || 0)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

              </div>
            )}

            {activeTab === 'plan' && planTabJsx}

            {activeTab === 'payments' && (() => {
              const METHOD = (m) => {
                const v = String(m || '').toLowerCase();
                if (v === 'cash' || v === 'naqd') return { label: 'Naqd', cls: 'bg-emerald-50 text-emerald-700', key: 'cash' };
                if (v.includes('click')) return { label: 'Click', cls: 'bg-blue-50 text-blue-700', key: 'click' };
                if (v.includes('payme')) return { label: 'Payme', cls: 'bg-violet-50 text-violet-700', key: 'payme' };
                if (v === 'card' || v.includes('karta') || v.includes('uzcard') || v.includes('humo')) return { label: 'Karta', cls: 'bg-sky-50 text-sky-700', key: 'card' };
                if (v === 'transfer' || v.includes("o'tkazma")) return { label: "O'tkazma", cls: 'bg-slate-100 text-slate-600', key: 'transfer' };
                return null;
              };
              const methodKeys = [...new Set(payments.map((p) => METHOD(p.method || p.payment_method)?.key).filter(Boolean))];
              const rows = payments
                .filter((p) => payMethodFilter === 'all' || METHOD(p.method || p.payment_method)?.key === payMethodFilter)
                .slice()
                .sort((a, b) => {
                  const d = (parseSafeDate(a.date)?.getTime() || 0) - (parseSafeDate(b.date)?.getTime() || 0);
                  return paySortAsc ? d : -d;
                });
              let nextPay = null;
              for (const c of planCards) {
                const svcs = c.plan.services || [];
                const idx = svcs.findIndex((svc) => !isSvcDone(svc) && svc.payment_status !== 'paid' && Number(svc.price) > 0);
                if (idx >= 0) {
                  const svc = svcs[idx];
                  nextPay = { reja: (c.title || '').split(' (')[0], name: `${svc.service_name || svc.name || 'Xizmat'}${svc.tooth_number ? ` (#${svc.tooth_number})` : ''}`, amount: Number(svc.price) || 0 };
                  break;
                }
              }
              const docName = (pay) => {
                const raw = pay.doctor_name || doctors.find((d) => String(d.id) === String(pay.doctor_id))?.full_name || '';
                return raw ? formatDoctorName(raw) : '';
              };
              return (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0"><h2 className="text-[18px] font-extrabold text-[#0f1f4b]">To'lovlar &amp; Qarz</h2><p className="text-[12px] font-medium text-slate-500">Bemorning barcha to'lovlari va qarz holati</p></div>
                  <button onClick={() => openPayModal()} className="flex items-center gap-1.5 px-3.5 h-11 text-white rounded-xl text-[13px] font-semibold active:scale-95 transition-transform bg-[#0f9a72] shrink-0">
                    <Plus className="w-4 h-4" />To'lov qo'shish
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-emerald-50/80 border border-emerald-100 rounded-2xl p-3 flex items-center gap-2.5">
                    <span className="w-10 h-10 rounded-xl bg-emerald-100/80 flex items-center justify-center shrink-0"><Wallet className="w-5 h-5 text-emerald-600" /></span>
                    <div className="min-w-0">
                      <p className="text-[10.5px] font-bold text-emerald-700 uppercase">{t('patientProfile.financialCard.totalPaid', "Jami to'langan")}</p>
                      <p className="text-[14px] font-extrabold text-emerald-700 leading-tight whitespace-nowrap tracking-tight">{formatCurrency(financials.incomes)}</p>
                    </div>
                  </div>
                  <div className={cn('rounded-2xl p-3 border flex items-center gap-2.5', financials.debt > 0 ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200')}>
                    <span className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', financials.debt > 0 ? 'bg-rose-100' : 'bg-slate-100')}><AlertTriangle className={cn('w-5 h-5', financials.debt > 0 ? 'text-rose-600' : 'text-slate-400')} /></span>
                    <div className="min-w-0">
                      <p className={cn('text-[10.5px] font-bold uppercase', financials.debt > 0 ? 'text-rose-600' : 'text-slate-500')}>{financials.debt > 0 ? 'Qarzdorlik' : 'Balans'}</p>
                      <p className={cn('text-[14px] font-extrabold leading-tight whitespace-nowrap tracking-tight', financials.debt > 0 ? 'text-rose-600' : 'text-slate-400')}>{formatCurrency(financials.debt)}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_10px_rgba(15,23,42,0.05)] p-3.5 flex items-center gap-3" data-testid="profile-pay-summary">
                  <div className="flex-1 min-w-0 flex items-center gap-2.5">
                    <span className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0"><Calendar className="w-5 h-5 text-slate-500" /></span>
                    <div className="min-w-0">
                      <p className="text-[10.5px] font-bold text-slate-500 uppercase">Umumiy summa</p>
                      <p className="text-[15px] font-extrabold text-slate-900 tabular-nums truncate">{formatCurrency(payTotal)}</p>
                      <p className="text-[11px] font-medium text-slate-500">Bemor bo'yicha jami hisob</p>
                    </div>
                  </div>
                  <div className="w-px self-stretch bg-slate-100" />
                  <div className="flex items-center gap-2 shrink-0">
                    <svg viewBox="0 0 36 36" className="w-12 h-12 -rotate-90">
                      <circle cx="18" cy="18" r="15" fill="none" stroke="#e2e8f0" strokeWidth="3.5" />
                      <circle cx="18" cy="18" r="15" fill="none" stroke="#0f9a72" strokeWidth="3.5" strokeLinecap="round" strokeDasharray={`${(payPct / 100) * 94.25} 94.25`} />
                      <text x="18" y="18" transform="rotate(90 18 18)" textAnchor="middle" dominantBaseline="central" className="fill-slate-900" style={{ fontSize: 9, fontWeight: 800 }}>{payPct}%</text>
                    </svg>
                    <div className="w-[76px]">
                      <p className="text-[10px] font-bold text-slate-500 uppercase">To'lov foizi</p>
                      <p className="text-[12px] font-bold text-slate-900">{compactMln(financials.incomes)} / {compactMln(payTotal)}</p>
                      <div className="mt-1 h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-[#0f9a72] rounded-full" style={{ width: `${payPct}%` }} /></div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <h3 className="flex-1 text-[15px] font-bold text-slate-900">To'lovlar tarixi ({rows.length})</h3>
                  <button type="button" onClick={() => setPaySortAsc((v) => !v)} data-testid="pay-sort"
                    className="h-9 px-3 rounded-xl bg-white border border-slate-200 text-[12px] font-medium text-slate-700 inline-flex items-center gap-1.5">
                    <ArrowUpDown className="w-3.5 h-3.5" />Sanasi bo'yicha{paySortAsc ? ' ↑' : ''}
                  </button>
                  <button type="button" onClick={() => setPayFilterOpen((v) => !v)} data-testid="pay-filter" aria-pressed={payFilterOpen || payMethodFilter !== 'all'}
                    className={cn('w-9 h-9 rounded-xl border inline-flex items-center justify-center', payMethodFilter !== 'all' ? 'bg-teal-50 border-teal-200 text-teal-700' : 'bg-white border-slate-200 text-slate-600')}>
                    <SlidersHorizontal className="w-4 h-4" />
                  </button>
                </div>
                {payFilterOpen && (
                  <div className="flex gap-1.5 flex-wrap" data-testid="pay-filter-chips">
                    {['all', ...methodKeys].map((k) => (
                      <button key={k} type="button" onClick={() => setPayMethodFilter(k)}
                        className={cn('h-8 px-3 rounded-lg text-[12px] font-semibold border', payMethodFilter === k ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-slate-600 border-slate-200')}>
                        {k === 'all' ? 'Barchasi' : ({ cash: 'Naqd', click: 'Click', payme: 'Payme', card: 'Karta', transfer: "O'tkazma" })[k]}
                      </button>
                    ))}
                  </div>
                )}
                {payments.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center shadow-xs">
                    <Receipt className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-500 font-bold text-sm">{t('patientProfile.mobile.emptyPayments', "To'lovlar yo'q")}</p>
                  </div>
                ) : rows.map(pay => {
                  const tp = (pay.type || '').toLowerCase();
                  const amtColor = tp === 'income' ? 'text-[#0f9a72]' : tp === 'refund' ? 'text-indigo-600' : 'text-rose-600';
                  const amtSign = tp === 'income' ? '' : '-';
                  const typeLabel = tp === 'income' ? t('patientProfile.teeth.statusPaymentReceived', "To'lov qabul qilindi") : tp === 'refund' ? t('patientProfile.teeth.statusDiscountRefund', "To'lov qaytarildi") : tp === 'expense' ? t('patientProfile.teeth.statusExpense', 'Xarajat') : t('patientProfile.mobile.debt', 'Qarz');
                  const title = pay.service_name || pay.description || typeLabel;
                  const sub = [pay.category === 'Treatment' ? t('patientProfile.treatmentPlanSingular', 'Davolash') : pay.category, title !== typeLabel ? typeLabel : null].filter(Boolean).join(' · ');
                  const m = METHOD(pay.method || pay.payment_method);
                  const dn = docName(pay);
                  const linkedPlan = planCards.find((c) => String(pay.notes || '').includes(String(c.plan.id)));
                  return (
                    <div key={pay.id} className="relative bg-white rounded-2xl border border-slate-100 shadow-[0_2px_10px_rgba(15,23,42,0.05)] p-3 flex items-start gap-3" data-testid="profile-pay-row">
                      <DateBlock raw={pay.date} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2">
                          <p className="flex-1 min-w-0 text-[14px] font-bold text-slate-900 truncate">{title}</p>
                          <p className={`text-[14px] font-bold shrink-0 tabular-nums ${amtColor}`}>{amtSign}{formatCurrency(pay.amount)}</p>
                        </div>
                        {sub && <p className="text-[11.5px] text-slate-500 font-medium truncate">{sub}</p>}
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          {m && <span className={cn('text-[11.5px] font-semibold px-2 h-6 inline-flex items-center rounded-md', m.cls)}>{m.label}</span>}
                          {dn && <span className="text-[11.5px] font-medium text-slate-600 px-2 h-6 inline-flex items-center gap-1 rounded-md bg-slate-100"><User className="w-3 h-3" />{dn}</span>}
                        </div>
                      </div>
                      <button type="button" onClick={() => setPayMenuId(payMenuId === pay.id ? null : pay.id)} aria-label="Amallar"
                        className="w-8 h-8 rounded-lg border border-slate-200 text-slate-500 flex items-center justify-center shrink-0 self-start">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                      {payMenuId === pay.id && (
                        <div className="absolute right-3 top-12 z-20 w-48 rounded-xl bg-white border border-slate-200 shadow-lg py-1 text-[13px]" data-testid="pay-row-menu">
                          <button type="button" disabled={!planCards.length} className="w-full text-left px-3 py-2 hover:bg-slate-50 disabled:opacity-40" onClick={() => { setPayMenuId(null); const c = linkedPlan || planCards[0]; if (c) setInvoicePlan({ ...c.plan, paid_amount: c.paid }); }}>Hisobot (PDF)</button>
                          <button type="button" className="w-full text-left px-3 py-2 hover:bg-slate-50" onClick={() => { setPayMenuId(null); openPayModal(); }}>Yangi to'lov</button>
                          {linkedPlan && <button type="button" className="w-full text-left px-3 py-2 hover:bg-slate-50" onClick={() => { setPayMenuId(null); setActiveTab('plan'); }}>Rejani ko'rish</button>}
                        </div>
                      )}
                    </div>
                  );
                })}
                {nextPay && (
                  <button type="button" onClick={() => openPayModal('Treatment', '', nextPay.amount)} data-testid="profile-next-pay"
                    className="w-full flex items-center gap-3 rounded-2xl bg-amber-50 border border-amber-200/70 px-3 py-3 text-left">
                    <span className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0"><Calendar className="w-5 h-5 text-amber-600" /></span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[13px] font-bold text-amber-700">Keyingi to'lov</span>
                      <span className="block text-[11.5px] text-slate-500 truncate">{nextPay.reja} · {nextPay.name}</span>
                    </span>
                    <span className="text-[13px] font-bold text-amber-700 tabular-nums shrink-0">{formatCurrency(nextPay.amount)}</span>
                    <ChevronRight className="w-4 h-4 text-amber-600 shrink-0" />
                  </button>
                )}
                <div className="grid grid-cols-[1.45fr_1fr] gap-2 pt-1">
                  <button type="button" onClick={() => openPayModal()} className="h-12 rounded-2xl bg-[#0f8f63] text-white text-[14px] font-semibold inline-flex items-center justify-center gap-1.5 active:scale-[0.98]">
                    <Plus className="w-4 h-4" />To'lov qo'shish
                  </button>
                  <button
                    type="button"
                    disabled={!planCards.length}
                    onClick={() => { const c = planCards[0]; if (c) setInvoicePlan({ ...c.plan, paid_amount: c.paid }); }}
                    className="h-12 rounded-2xl bg-white border border-slate-200 text-slate-700 text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-40 active:scale-[0.98]"
                  >
                    <FileText className="w-4 h-4" />Hisobot (PDF)
                  </button>
                </div>
              </div>
              );
            })()}

            {activeTab === 'implant' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="min-w-0"><h2 className="text-[18px] font-extrabold text-[#0f1f4b]">{t('patientProfile.tabs.implants', 'Implantlar')} ({countImplantTeeth(implants)})</h2><p className="text-[12px] font-medium text-slate-500">O'rnatilgan implantlar va kuzatuv ma'lumotlari</p></div>
                  <button
                    type="button"
                    onClick={() => { setSelectedImplant(null); setImplantModalOpen(true); }}
                    className="flex items-center gap-1.5 px-3.5 h-11 text-white rounded-xl text-[13px] font-semibold active:scale-95 transition-transform bg-[#0f9a72] shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{t('patientProfile.mobile.addImplant', "Implant qo'shish")}</span>
                  </button>
                </div>
                {implants.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center shadow-xs">
                    <Activity className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-500 font-bold text-sm">{t('patientProfile.mobile.emptyImplants', "Implantlar yo'q")}</p>
                    <button
                      type="button"
                      onClick={() => { setSelectedImplant(null); setImplantModalOpen(true); }}
                      className="mt-4 px-5 py-2.5 text-white rounded-xl text-xs font-bold active:scale-95 transition-transform"
                      style={{ background: TEAL }}
                    >
                      + {t('patientProfile.mobile.addImplant', "Implant qo'shish")}
                    </button>
                  </div>
                ) : implants.flatMap((imp) => {
                  const teeth = implantRecordFdis(imp);
                  const list = teeth.length ? teeth : [null];
                  return list.map((fdi) => {
                    const td = (fdi && imp.tooth_data_map && (imp.tooth_data_map[fdi] || imp.tooth_data_map[String(fdi)])) || {};
                    const brand = (td.firma === 'Boshqa' ? td.firma_custom : td.firma) || td.brend || (imp.firma === 'Boshqa' ? imp.firma_custom : imp.firma) || imp.brend || '—';
                    const dia = td.diameter ?? imp.diameter; const len = td.length ?? imp.length;
                    const size = dia && len ? `Ø${dia} × ${len} mm` : dia ? `Ø${dia} mm` : len ? `L ${len} mm` : '—';
                    const st = IMPLANT_STATUS[String(imp.lifecycle_status || imp.status || '').toLowerCase()] || { label: imp.lifecycle_status || imp.status || '—', cls: 'bg-slate-100 text-slate-600' };
                    const imgs = [...(Array.isArray(imp.xray_urls) ? imp.xray_urls : []), ...(Array.isArray(imp.images) ? imp.images : [])].map((u) => (typeof u === 'string' ? u : u?.url)).filter(Boolean);
                    const rows = [
                      ['Tizim / Brend', brand],
                      ["O'lcham", size],
                      ['Turi', td.implant_type || imp.implant_type || '—'],
                      ['Joylashuv (FDI)', fdi || '—'],
                      ["O'rnatilgan sana", imp.placement_date ? formatStandardDate(imp.placement_date) : '—'],
                      ['Shifokor', imp.doctor ? formatDoctorName(imp.doctor) : '—'],
                    ];
                    const docs = [...(Array.isArray(imp.documents) ? imp.documents : []), ...(Array.isArray(imp.document_urls) ? imp.document_urls : [])].map((u) => (typeof u === 'string' ? { url: u, name: u.split('/').pop() } : { url: u?.url, name: u?.name || u?.title || 'Hujjat' })).filter((d) => d.url);
                    const noteText = String(imp.notes || '').replace(/\[[A-Z_]+\][\s\S]*?\[END[A-Z_]*\]/g, '').trim();
                    const noteList = noteText ? noteText.split(/\n{2,}/).filter(Boolean) : [];
                    const subKey = `${imp.id}-${fdi || 'x'}`;
                    const sub = implantSubTab[subKey] || 'xray';
                    const illo = fdi ? getToothIllustrationSrc(fdi, 'implant') : null;
                    const reminder = imp.reminder_date ? parseSafeDate(imp.reminder_date) : null;
                    const placed = imp.placement_date ? parseSafeDate(imp.placement_date) : null;
                    const months = reminder && placed ? Math.round((reminder - placed) / (30.44 * 864e5)) : null;
                    return (
                      <div key={subKey} className="bg-white rounded-[20px] border border-slate-100 shadow-[0_2px_10px_rgba(15,23,42,0.05)] p-3.5" data-testid="profile-implant-card">
                        <div className="flex items-start gap-3">
                          <span className="w-12 h-12 rounded-2xl bg-cyan-50 border border-cyan-100 flex items-center justify-center shrink-0"><Activity className="w-6 h-6 text-[#14b8a6]" /></span>
                          <button type="button" onClick={() => { setSelectedImplant(imp); setImplantModalOpen(true); }} className="flex-1 min-w-0 text-left">
                            <span className="flex items-center gap-2 flex-wrap">
                              <span className="text-[16px] font-bold text-slate-900">Implant {fdi ? `#${fdi}` : ''}</span>
                              <span className={cn('text-[11.5px] font-semibold px-2 py-0.5 rounded-md', st.cls)}>{st.label}</span>
                            </span>
                            <span className="block text-[13px] font-medium text-slate-600 truncate">{brand}</span>
                            <span className="block text-[11.5px] font-medium text-slate-500">
                              {imp.placement_date ? `O'rnatilgan sana: ${formatStandardDate(imp.placement_date)}` : ''}{imp.doctor ? ` · ${formatDoctorName(imp.doctor)}` : ''}
                            </span>
                          </button>
                          <button type="button" onClick={() => navigate(`/implants/${imp.id}`)} aria-label="Implant pasporti" title="Implant pasporti"
                            className="w-10 h-10 rounded-xl border border-slate-200 text-slate-600 flex items-center justify-center shrink-0">
                            <MoreHorizontal className="w-5 h-5" />
                          </button>
                        </div>
                        <div className="mt-3 flex gap-3">
                          <div className="w-[40%] shrink-0 rounded-2xl bg-slate-50 flex items-center justify-center py-2" data-testid="implant-illustration">
                            {illo ? <img src={illo} alt="" className="h-[124px] object-contain" /> : (
                              <svg viewBox="0 0 60 120" className="h-[120px]" aria-hidden>
                                <path d="M8 30c0-18 10-26 22-26s22 8 22 26c0 10-6 14-22 14S8 40 8 30z" fill="#f8fafc" stroke="#cbd5e1" />
                                <rect x="22" y="44" width="16" height="8" fill="#94a3b8" />
                                {[0, 1, 2, 3, 4, 5, 6].map((k) => <rect key={k} x={20 + k * 0.6} y={54 + k * 9} width={20 - k * 1.2} height="6" rx="2" fill="#64748b" />)}
                              </svg>
                            )}
                          </div>
                          <div className="flex-1 min-w-0 divide-y divide-slate-100">
                            {rows.map(([k, v]) => (
                              <div key={k} className="flex items-center justify-between gap-2 py-[3px] text-[11.5px]">
                                <span className="text-slate-500 font-medium shrink-0">{k}</span>
                                <span className="text-slate-900 font-semibold text-right truncate">{v}</span>
                              </div>
                            ))}
                            <div className="flex items-center justify-between gap-2 py-[3px] text-[11.5px]">
                              <span className="text-slate-500 font-medium">Holat</span>
                              <span className={cn('font-bold', st.cls.split(' ').find((c) => c.startsWith('text-')))}>{st.label}</span>
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-1.5" data-testid="implant-subtabs">
                          {[['xray', 'Rentgenlar', imgs.length, ImageIcon], ['docs', 'Hujjatlar', docs.length, FileText], ['notes', 'Eslatmalar', noteList.length, ClipboardList]].map(([k, label, n, Icon]) => (
                            <button key={k} type="button" onClick={() => setImplantSubTab((prev) => ({ ...prev, [subKey]: k }))}
                              className={cn('h-9 rounded-xl border text-[11.5px] font-semibold inline-flex items-center justify-center gap-1', sub === k ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-600')}>
                              <Icon className="w-3.5 h-3.5" />{label} ({n})
                            </button>
                          ))}
                        </div>
                        {sub === 'xray' && (
                          <div className="mt-2.5 flex gap-2 overflow-x-auto no-scrollbar">
                            {imgs.slice(0, 6).map((u, i) => (
                              <a key={i} href={u} target="_blank" rel="noreferrer" className="shrink-0 w-[84px] h-[64px] rounded-xl overflow-hidden bg-slate-100 border border-slate-100">
                                <img src={u} alt="" className="w-full h-full object-cover" />
                              </a>
                            ))}
                            <button type="button" onClick={() => { setSelectedImplant(imp); setImplantModalOpen(true); }} className="shrink-0 w-[84px] h-[64px] rounded-xl border-2 border-dashed border-slate-200 text-blue-600 flex flex-col items-center justify-center">
                              <Plus className="w-5 h-5" /><span className="text-[10px] font-medium text-slate-500">Rasm qo'shish</span>
                            </button>
                          </div>
                        )}
                        {sub === 'docs' && (
                          <div className="mt-2.5 space-y-1.5">
                            {docs.length === 0 ? <p className="text-[12px] text-slate-400 py-2 text-center">Hujjatlar yo'q</p> : docs.map((d, i) => (
                              <a key={i} href={d.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 h-9 px-3 rounded-lg bg-slate-50 text-[12px] font-medium text-slate-700 truncate"><FileText className="w-4 h-4 text-slate-500 shrink-0" /><span className="truncate">{d.name}</span></a>
                            ))}
                          </div>
                        )}
                        {sub === 'notes' && (
                          <div className="mt-2.5 space-y-1.5">
                            {noteList.length === 0 ? <p className="text-[12px] text-slate-400 py-2 text-center">Eslatmalar yo'q</p> : noteList.map((n, i) => (
                              <p key={i} className="rounded-lg bg-slate-50 px-3 py-2 text-[12px] text-slate-700 whitespace-pre-wrap">{n}</p>
                            ))}
                          </div>
                        )}
                        {reminder && (
                          <button type="button" onClick={() => { setSelectedImplant(imp); setImplantModalOpen(true); }} data-testid="implant-next-control"
                            className="mt-3 w-full flex items-center gap-3 rounded-2xl bg-emerald-50 border border-emerald-200/70 px-3 py-2.5 text-left">
                            <span className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0"><Bell className="w-4 h-4 text-emerald-700" /></span>
                            <span className="flex-1 min-w-0">
                              <span className="block text-[11.5px] font-medium text-slate-600">Keyingi nazorat</span>
                              <span className="block text-[14px] font-bold text-slate-900">{formatStandardDate(imp.reminder_date)}{months ? ` (${months} oy)` : ''}</span>
                            </span>
                            <span className="text-[12px] font-semibold text-slate-700 shrink-0">Eslatma o'rnatilgan</span>
                            <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                          </button>
                        )}
                      </div>
                    );
                  });
                })}
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>
      )}

      <BackClose open={!!(toothHistoryOpen && selectedTooth)} onClose={() => setToothHistoryOpen(false)} />
      {/* TOOTH HISTORY SHEET — portaled so Framer page transform cannot trap fixed under bottom nav */}
      {typeof document !== 'undefined' && createPortal(
      <AnimatePresence>
        {toothHistoryOpen && selectedTooth && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 z-[100] backdrop-blur-sm" onClick={() => setToothHistoryOpen(false)} />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-[100] bg-white rounded-t-3xl shadow-2xl px-5 pt-4 max-h-[70vh] overflow-y-auto"
              style={{ paddingBottom: 'calc(54px + env(safe-area-inset-bottom, 0px) + 1rem)' }}
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
      </AnimatePresence>,
      document.body)}

      {/* PAYMENT MODAL — portaled above sticky bottom nav */}
      <BackClose open={!!payModalOpen} onClose={() => setPayModalOpen(false)} />
      {typeof document !== 'undefined' && createPortal(
      <AnimatePresence>
        {payModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
              onClick={() => setPayModalOpen(false)}
            >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.18 }}
              data-payment-accept="centered"
              onClick={(e) => e.stopPropagation()}
              className="pointer-events-auto flex w-full max-w-md flex-col overflow-hidden rounded-[2.5rem] bg-white shadow-2xl"
              style={{ maxHeight: 'min(86dvh, calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 8rem))' }}
            >
              <div className="flex shrink-0 items-center justify-between px-5 pb-2 pt-4">
                <h3 className="text-base font-black text-slate-900">{t('patientProfile.personalCard.acceptPayment', "To'lov qabul qilish")}</h3>
                <button onClick={() => setPayModalOpen(false)} className="p-2 rounded-xl bg-slate-100 active:scale-95 transition-transform">
                  <X className="w-4 h-4 text-slate-600" />
                </button>
              </div>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 pb-3">
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
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">
                      {t('patientProfile.installments.paymentAmount', 'Summa')} ({t('dashboard.currency', "so'm")})
                    </label>
                    {financials.debt > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setPayPlanId('');
                          setPayForm(p => ({ ...p, amount: String(Math.round(financials.debt)), notes: '' }));
                        }}
                        className="text-[10px] font-black text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-lg"
                      >
                        Umumiy qarz {fmt(financials.debt)}
                      </button>
                    )}
                  </div>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={payForm.amount}
                    onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))}
                    placeholder="0"
                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xl font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#14b8a6]/30 focus:border-[#14b8a6] transition-all"
                  />
                </div>

                {plans.some(plan => Math.max(0, (Number(plan.total_price) || 0) - (Number(plan.paid_amount) || 0)) > 0) && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Hisob-faktura</p>
                    {plans.map(plan => {
                      const remaining = Math.max(0, (Number(plan.total_price) || 0) - (Number(plan.paid_amount) || 0));
                      if (remaining <= 0) return null;
                      const selected = String(payPlanId) === String(plan.id);
                      return (
                        <button
                          key={plan.id}
                          type="button"
                          onClick={() => {
                            setPayPlanId(plan.id);
                            setPayForm(p => ({
                              ...p,
                              amount: String(Math.round(remaining)),
                              notes: `Reja to'lov: ${plan.name || ''}`,
                            }));
                          }}
                          className={cn(
                            'w-full text-left rounded-xl border px-3 py-2',
                            selected ? 'border-[#14b8a6] bg-teal-50' : 'border-slate-200 bg-slate-50'
                          )}
                        >
                          <p className="text-xs font-black text-slate-800 leading-snug break-words">{plan.name || 'Davolash rejasi'}</p>
                          <p className="text-[10px] font-bold text-rose-600 mt-0.5">Qoldiq: {formatCurrency(remaining)}</p>
                        </button>
                      );
                    })}
                  </div>
                )}

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

                {doctors.length > 0 && (
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                      {t('appointments.doctor', 'Shifokor')}
                    </label>
                    <select
                      value={payForm.doctor_id}
                      onChange={e => setPayForm(p => ({ ...p, doctor_id: e.target.value }))}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#14b8a6]/30 focus:border-[#14b8a6] transition-all"
                    >
                      <option value="">{t('common.select', 'Tanlang...')}</option>
                      {doctors.map(d => (
                        <option key={d.id} value={d.id}>{d.name || d.full_name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">{t('patientProfile.installments.notes', 'Izoh')} ({t('common.optional', 'ixtiyoriy')})</label>
                  <input type="text" value={payForm.notes} onChange={e => setPayForm(p => ({ ...p, notes: e.target.value }))}
                    placeholder={t('patientProfile.installments.notesPlaceholder', 'Izoh...')}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#14b8a6]/30 focus:border-[#14b8a6] transition-all" />
                </div>

              </div>
              <div className="payment-accept-footer shrink-0 border-t border-slate-100 bg-white px-5 pt-3" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }}>
                <button onClick={handleSavePay} disabled={payingSaving || !payForm.amount}
                  className="w-full py-4 disabled:opacity-50 text-white rounded-2xl text-sm font-black flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg"
                  style={{ background: TEAL }}>
                  {payingSaving ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <><CreditCard className="w-4 h-4" />{t('patientProfile.installments.savePayment', "To'lovni saqlash")}</>}
                </button>
              </div>
            </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>,
      document.body)}

      {/* MODALS */}
      {apptModalOpen && (
        <AppointmentModal
          open={apptModalOpen}
          onClose={() => { setApptModalOpen(false); setSelectedAppt(null); }}
          appointment={selectedAppt}
          patients={patient ? [patient] : allPatients}
          services={services}
          prefillPatientId={patient?.id}
          prefillPatientName={patient?.full_name}
          onSaved={() => {
            setApptModalOpen(false);
            setSelectedAppt(null);
            setRefreshTick(tick => tick + 1);
          }}
        />
      )}
      {patientModalOpen && patient && (
        <PatientModal
          open={patientModalOpen}
          onClose={() => setPatientModalOpen(false)}
          patient={patient}
          onSaved={() => {
            setPatientModalOpen(false);
            setRefreshTick(tick => tick + 1);
          }}
        />
      )}
      {invoicePlan && (
        <TreatmentPlanInvoice
          open={!!invoicePlan}
          onClose={() => setInvoicePlan(null)}
          plan={invoicePlan}
        />
      )}
      {treatModalOpen && (
        <TreatmentPlanModal
          open={treatModalOpen}
          onClose={() => setTreatModalOpen(false)}
          plan={null}
          patients={patient ? [patient] : allPatients}
          services={services}
          initialPatientId={id}
          onSaved={() => {
            setTreatModalOpen(false);
            setRefreshTick(tick => tick + 1);
          }}
        />
      )}
      <TreatmentDeleteDialog
        row={pendingDelete}
        busy={deletingTreatment}
        onCancel={() => { if (!deletingTreatment) setPendingDelete(null); }}
        onConfirm={async () => {
          if (!pendingDelete || id === 'patient-y2ii8ynf2') return;
          const plan = plans.find((item) => item.id === pendingDelete.planId);
          if (!plan) return;
          setDeletingTreatment(true);
          try {
            await deleteTreatmentRow({ patientId: id, plan, serviceIndex: pendingDelete.serviceIndex });
            toast.success('Muolaja o‘chirildi');
            setPendingDelete(null);
            setRefreshTick((tick) => tick + 1);
          } catch (err) {
            console.error(err);
            toast.error('O‘chirishda xatolik');
          } finally {
            setDeletingTreatment(false);
          }
        }}
      />
      {implantModalOpen && (
        <ImplantForm
          open={implantModalOpen}
          onClose={() => { setImplantModalOpen(false); setSelectedImplant(null); }}
          implant={selectedImplant}
          patients={patient ? [patient] : allPatients}
          services={services}
          onSaved={() => {
            setImplantModalOpen(false);
            setSelectedImplant(null);
            setRefreshTick(tick => tick + 1);
          }}
        />
      )}
    </div>
  );
}
