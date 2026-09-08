import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from '@/i18n/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import { useClinic } from '@/lib/ClinicContext';
import {
  ArrowLeft, Phone, Calendar, DollarSign, ClipboardList,
  Plus, MessageSquare, FileDown, AlertTriangle, Clock, Activity,
  CheckCircle2, XCircle, Shield, Image,
  Copy, Check, X, Wallet, CreditCard, Camera, Printer, FileSpreadsheet,
  FileText, User, MapPin, Cake, ExternalLink, Share2, Info, ArrowUpRight, Search
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Tooth, ImplantIcon, XrayIcon } from '@/components/ui/Icons';
import { cn, resolveDoctorId } from '@/lib/utils';
import {
  bootstrapTelegramBotConfig,
  getEnvBotUsername,
  parseBotTechData,
  resolveBotUsernameFromConfig,
} from '@/lib/telegramBotConfig';
import { sendTestReminderForPatient } from '@/lib/telegramReminderService';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList } from '@/components/ui/tabs';
import StatusBadge from '../components/ui/StatusBadge';
import EmptyState from '../components/ui/EmptyState';
import PatientAppointments from '../components/patients/PatientAppointments';
import PatientPayments from '../components/patients/PatientPayments';
import PatientTreatments from '../components/patients/PatientTreatments';
import PatientXraysOdontogram from '../components/patients/PatientXraysOdontogram';
import PatientExcelView from '../components/patients/PatientExcelView';
import ExcelDentalChartView from '../components/patients/ExcelDentalChartView';
import ExcelTreatmentsView from '../components/patients/ExcelTreatmentsView';
import ExcelAppointmentsView from '../components/patients/ExcelAppointmentsView';
import ExcelPaymentsView from '../components/patients/ExcelPaymentsView';
import ExcelNotesView from '../components/patients/ExcelNotesView';
import ExcelImplantsView from '../components/patients/ExcelImplantsView';
import ExcelPhotosView from '../components/patients/ExcelPhotosView';
import ChairsidePatientProfile from '../components/patients/ChairsidePatientProfile';
import { exportPatientToExcel } from '@/lib/patientExcelExport';
import AppointmentModal from '../components/appointments/AppointmentModal';
import PatientModal from '../components/patients/PatientModal';
import TreatmentPlanModal from '../components/treatments/TreatmentPlanModal';
import TreatmentPlanInvoice from '../components/treatments/TreatmentPlanInvoice';
import ImplantForm from '../components/implants/ImplantForm';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { formatPhone, capitalizeName } from '@/lib/utils';
const formatPlanName = (name) => {
  if (!name) return 'Davolash rejasi';
  const toothMatch = name.match(/\s*\(#\d+\)$/);
  const toothSuffix = toothMatch ? toothMatch[0] : '';
  const baseName = toothMatch ? name.slice(0, toothMatch.index) : name;
  const parts = baseName.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length <= 2) return name;
  const compactBase = parts.slice(0, 2).join(', ') + ` +${parts.length - 2} ta`;
  return compactBase + toothSuffix;
};

function daysSince(dateStr) {
  if (!dateStr) return null;
  const diff = Math.floor((new Date() - new Date(dateStr)) / 86400000);
  return diff;
}

function getLocalDateTimeValue() {
  const now = new Date();
  const tzOffset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
}

// Module-level caches to avoid redundant API fetches on patient page transitions
let servicesCache = null;
let doctorsCache = null;

const DIAGNOSTIC_TRANSLATIONS = {
  'missing tooth': { uz: "Tish yo'q", ru: 'Отсутствует зуб', en: 'Missing tooth' },
  'missing': { uz: "Tish yo'q", ru: 'Отсутствует зуб', en: 'Missing tooth' },
  'tish olingan': { uz: 'Tish olingan', ru: 'Удаленный зуб', en: 'Extracted tooth' },
  'tooth root': { uz: 'Tish ildizi', ru: 'Корень зуба', en: 'Tooth root' },
  'tooth discoloration': { uz: "Tish rangining o'zgarishi", ru: 'Изменение цвета зуба', en: 'Tooth discoloration' },
  'tooth decay': { uz: 'Tish yemirolishi', ru: 'Разрушение зуба', en: 'Tooth decay' },
  'cavity': { uz: 'Kariyes kovagi', ru: 'Кариозная полость', en: 'Cavity' },
  'cervical cavity': { uz: "Bo'yin kariyesi", ru: 'Пришеечный кариес', en: 'Cervical cavity' },
  'wedge-shaped defect': { uz: 'Klinimon defekt', ru: 'Клиновидный дефект', en: 'Wedge-shaped defect' },
  'healthy': { uz: "Sog'lom", ru: 'Здоровый', en: 'Healthy' },
  'healthy periodontium': { uz: "Sog'lom parodont", ru: 'Здоровый пародонт', en: 'Healthy periodontium' },
  'periodontitis 1 deg': { uz: 'Periodontit 1-daraja', ru: 'Периодонтит 1 степени', en: 'Periodontitis 1st degree' },
  'periodontitis 2 deg': { uz: 'Periodontit 2-daraja', ru: 'Периодонтит 2 степени', en: 'Periodontitis 2nd degree' },
  'periodontitis 3 deg': { uz: 'Periodontit 3-daraja', ru: 'Периодонтит 3 степени', en: 'Periodontitis 3rd degree' },
  'no inflammation': { uz: "Yallig'lanish yo'q", ru: 'Нет воспаления', en: 'No inflammation' },
  'gingivitis': { uz: 'Gingivit', ru: 'Гингивит', en: 'Gingivitis' },
  'severe gingivitis / periodontitis': { uz: "O'tkir gingivit / Periodontit", ru: 'Острый гингивит / Периодонтит', en: 'Severe gingivitis / Periodontitis' },
  'dental calculus': { uz: 'Tish toshi', ru: 'Зубной камень', en: 'Dental calculus' },
  'secondary cavity': { uz: 'Ikkilamchi kariyes', ru: 'Вторичный кариес', en: 'Secondary cavity' },
  'fissure pigmentation': { uz: 'Fissura pigmentatsiyasi', ru: 'Пигментация фиссур', en: 'Fissure pigmentation' },
  'fissure pigmentation (initial caries)': { uz: 'Fissura pigmentatsiyasi (boshlang\'ich kariyes)', ru: 'Пигментация фиссур (начальный кариес)', en: 'Fissure pigmentation (initial caries)' },
  'canal partially sealed': { uz: 'Kanal qisman to\'ldirilgan', ru: 'Канал частично пломбирован', en: 'Canal partially sealed' },
  'pulpit': { uz: 'Pulpit', ru: 'Пульпит', en: 'Pulpitis' },
  'filling': { uz: 'Plomba', ru: 'Пломба', en: 'Filling' },
  'plomba': { uz: 'Plomba', ru: 'Пломба', en: 'Filling' },
  'crown': { uz: 'Toj (Koronka)', ru: 'Коронка', en: 'Crown' },
  'toj': { uz: 'Toj (Koronka)', ru: 'Коронка', en: 'Crown' },
  'veneer': { uz: 'Vinir', ru: 'Винир', en: 'Veneer' },
  'vinir': { uz: 'Vinir', ru: 'Винир', en: 'Veneer' },
  'implant': { uz: 'Implantat', ru: 'Имплант', en: 'Implant' },
  'implantat': { uz: 'Implantat', ru: 'Имплант', en: 'Implant' },
  'davolangan': { uz: 'Davolangan', ru: 'Вылечен', en: 'Treated' },
  'completed': { uz: 'Tugallangan', ru: 'Завершено', en: 'Completed' },
  'jarayonda': { uz: 'Jarayonda', ru: 'В процессе', en: 'In progress' },
  'in_progress': { uz: 'Jarayonda', ru: 'В процессе', en: 'In progress' },
};

export default function PatientProfile() {
  const { t, language } = useTranslation();
  const { user, isDoctor } = useAuth();
  const { clinicName } = useClinic();
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const [patient, setPatient] = useState(null);

  const handleBack = useCallback(() => {
    if (location.state?.from) {
      navigate(location.state.from);
      return;
    }
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/patients');
    }
  }, [location.state, navigate]);

  // Horizontal scroll shadow indicator states
  const tabScrollRef = useRef(null);
  const [showLeftShadow, setShowLeftShadow] = useState(false);
  const [showRightShadow, setShowRightShadow] = useState(false);

  const handleTabScroll = useCallback(() => {
    if (tabScrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = tabScrollRef.current;
      setShowLeftShadow(scrollLeft > 2);
      setShowRightShadow(scrollLeft < scrollWidth - clientWidth - 2);
    }
  }, []);

  // Main scroll and resize observer triggers
  useEffect(() => {
    const el = tabScrollRef.current;
    if (el) {
      handleTabScroll();
      const observer = new ResizeObserver(() => handleTabScroll());
      observer.observe(el);
      el.addEventListener('scroll', handleTabScroll);
      return () => {
        observer.disconnect();
        el.removeEventListener('scroll', handleTabScroll);
      };
    }
  }, [handleTabScroll]);

  // Parse medical warnings (Lidocaine allergy, diabetes, hypertension)
  const medicalAlerts = useMemo(() => {
    if (!patient) return [];
    const alerts = [];
    
    // Fields to search in (important_info, comment, notes)
    const fieldsToSearch = [
      patient.important_info,
      patient.comment,
      patient.notes
    ].filter(Boolean).map(s => s.toLowerCase());

    const search = (term) => {
      return fieldsToSearch.some(field => field.includes(term));
    };

    // 1. Lidokain / Anestetika allergiyasi
    if (
      search('lidokain') ||
      search('lidocaine') ||
      search('anestetika') ||
      search('anestetik') ||
      search('anesteziya') ||
      search('anesthesia')
    ) {
      alerts.push({
        type: 'lidocaineAllergy',
        labelUz: 'Lidokain / Anestetika allergiyasi',
        labelRu: 'Аллергия на Лидокаин / Анестетики',
        labelEn: 'Lidocaine / Anesthetics Allergy'
      });
    }

    // 2. Qandli diabet
    if (
      search('diabet') ||
      search('diabetes') ||
      search('qandli')
    ) {
      alerts.push({
        type: 'diabetes',
        labelUz: 'Qandli diabet',
        labelRu: 'Сахарный диабет',
        labelEn: 'Diabetes Mellitus'
      });
    }

    // 3. Gipertoniya
    if (
      search('gipertoniya') ||
      search('hypertonia') ||
      search('hypertension') ||
      search('gipertonik') ||
      search('davlen')
    ) {
      alerts.push({
        type: 'hypertension',
        labelUz: 'Gipertoniya',
        labelRu: 'Гипертония',
        labelEn: 'Hypertension'
      });
    }

    return alerts;
  }, [patient]);
  const [appointments, setAppointments] = useState([]);
  const [payments, setPayments] = useState([]);
  const [plans, setPlans] = useState([]);
  const [planStageFilter, setPlanStageFilter] = useState('all');
  const [paymentSubTab, setPaymentSubTab] = useState('registry'); // registry or installments
  const [mediaSubTab, setMediaSubTab] = useState('photos'); // photos or xrays

  const filteredPlans = useMemo(() => {
    if (!plans) return [];
    if (planStageFilter === 'all') return plans;
    return plans.filter(p => {
      const status = String(p.status || '').trim().toLowerCase();
      if (planStageFilter === 'unplanned') {
        return !status || status === 'unplanned' || status === 'rejalashtirilmagan';
      }
      if (planStageFilter === 'planned') {
        return status === 'planned' || status === 'rejalashtirilgan';
      }
      if (planStageFilter === 'inProgress') {
        return status === 'inprogress' || status === 'in_progress' || status === 'jarayonda';
      }
      if (planStageFilter === 'completed') {
        return status === 'completed' || status === 'bajarildi';
      }
      return false;
    });
  }, [plans, planStageFilter]);
  const [services, setServices] = useState([]);
  const [implants, setImplants] = useState([]);
  const [allPatients, setAllPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [xrays, setXrays] = useState([]);
  const [toothRecords, setToothRecords] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [botUsername, setBotUsername] = useState('');
  const [showQr, setShowQr] = useState(false);
  const [sendingTestReminder, setSendingTestReminder] = useState(false);

  const getTelegramBotLink = useCallback((patientId) => {
    if (!patientId) return '';
    const username = String(botUsername || '').replace(/^@/, '').trim();
    if (!username) return '';
    return `https://t.me/${username}?start=${patientId}`;
  }, [botUsername]);


  const handleSendTestReminder = useCallback(async () => {
    if (!patient?.id) {
      toast.error("Bemor topilmadi");
      return;
    }

    try {
      setSendingTestReminder(true);
      
      // 🤖 To'g'ridan-to'g'ri Supabase + Telegram API orqali (backend kerak emas)
      const result = await sendTestReminderForPatient(patient.id);
      
      if (!result.success) {
        toast.error(result.message || "Test eslatma yuborilmadi");
        return;
      }

      toast.success(result.message || "Test eslatma yuborildi ✅");
    } catch (error) {
      console.error('Test reminder send error:', error);
      toast.error("Test eslatma yuborishda xatolik yuz berdi");
    } finally {
      setSendingTestReminder(false);
    }
  }, [patient?.id]);

  // Load bot username from config
  useEffect(() => {
    let cancelled = false;
    bootstrapTelegramBotConfig();
    const envUsername = getEnvBotUsername();
    if (envUsername) setBotUsername(envUsername);

    (async () => {
      try {
        const response = await base44.get('/BotConfig');
        const list = Array.isArray(response?.data) ? response.data : (response?.data ? [response.data] : []);
        const cfg = list.find(x => {
          const tech = parseBotTechData(x?.notes);
          return Boolean(x?.botUsername || x?.bot_username || tech?.botUsername || tech?.botToken);
        }) || list[0] || null;
        const tech = parseBotTechData(cfg?.notes);
        const resolved = await resolveBotUsernameFromConfig(cfg, tech);
        if (!cancelled && resolved) setBotUsername(resolved);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, []);
  
  // History Modal State
  const [selectedTooth, setSelectedTooth] = useState(null);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);

  // FDI Chart Edit Mode
  const [chartEditMode, setChartEditMode] = useState(false);
  const [editSelectedTooth, setEditSelectedTooth] = useState(null);
  const [pendingToothEdits, setPendingToothEdits] = useState({});
  const [chartSaving, setChartSaving] = useState(false);
  const [showLocalActions, setShowLocalActions] = useState(false);

  // Modals
  const [apptModalOpen, setApptModalOpen] = useState(false);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [treatmentModalOpen, setTreatmentModalOpen] = useState(false);
  const [implantModalOpen, setImplantModalOpen] = useState(false);
  const [invoiceModalPlan, setInvoiceModalPlan] = useState(null);
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [patientModalOpen, setPatientModalOpen] = useState(false);
  const [patientType, setPatientType] = useState('adult');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  
  const [payForm, setPayForm] = useState({ 
    type: 'Income', 
    amount: 0, 
    method: 'Cash', 
    category: '', 
    date: new Date().toISOString().slice(0, 16), 
    notes: '', 
    doctor_id: '', 
    planId: '', 
    selectedServiceIds: [] 
  });
  const [payingSaving, setPayingSaving] = useState(false);
  const urlTab = new URLSearchParams(location.search).get('tab');
  const [activeTab, setActiveTab] = useState(urlTab || 'info');
  const [subSection, setSubSection] = useState('dental');
  const [toothSearchQuery, setToothSearchQuery] = useState('');
  const [dentalViewMode, setDentalViewMode] = useState('both');
  const [profileViewMode, setProfileViewMode] = useState('chairside'); // chairside | reyestr
  const [treatmentStatusFilter, setTreatmentStatusFilter] = useState('all'); // 'all', 'completed', 'in_progress', 'planned'
  const [chartView, setChartView] = useState('teeth'); // 'teeth', 'maxilla', 'mandible', 'occlusion'
  const [showOcclusal, setShowOcclusal] = useState(true);
  const [occlusionNotes, setOcclusionNotes] = useState('');
  const [occlusionClass, setOcclusionClass] = useState('Class I');
  
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [xraysLoading, setXraysLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Load Appointments (chairside Bugungi reja + appointments tab)
  useEffect(() => {
    if ((activeTab === 'appointments' || profileViewMode === 'chairside') && id) {
      (async () => {
        try {
          setAppointmentsLoading(true);
          const list = await base44.entities.Appointment.filter({ patient_id: id }, '-date', 50);
          setAppointments(list || []);
        } catch (e) {
          console.error("Failed to load appointments", e);
        } finally {
          setAppointmentsLoading(false);
        }
      })();
    }
  }, [activeTab, profileViewMode, id, refreshTrigger]);

  // Lazy load Payments
  useEffect(() => {
    if (activeTab === 'payments' && id) {
      (async () => {
        try {
          setPaymentsLoading(true);
          const list = await base44.entities.Payment.filter({ patient_id: id }, '-date', 50);
          setPayments(list || []);
        } catch (e) {
          console.error("Failed to load payments", e);
        } finally {
          setPaymentsLoading(false);
        }
      })();
    }
  }, [activeTab, id, refreshTrigger]);

  // Lazy load Xrays
  useEffect(() => {
    if ((activeTab === 'photos' || activeTab === 'xrays') && id) {
      (async () => {
        try {
          setXraysLoading(true);
          const list = await base44.entities.Xray.filter({ patient_id: id }, '-date', 100);
          setXrays(list || []);
        } catch (e) {
          console.error("Failed to load xrays", e);
        } finally {
          setXraysLoading(false);
        }
      })();
    }
  }, [activeTab, id, refreshTrigger]);
  
  // PSR scores: 6 sextants (s1 to s6)
  const [psrScores, setPsrScores] = useState(() => {
    try {
      const stored = localStorage.getItem(`psr_scores_${id}`);
      return stored ? JSON.parse(stored) : { s1: 0, s2: 0, s3: 0, s4: 0, s5: 0, s6: 0 };
    } catch (e) {
      return { s1: 0, s2: 0, s3: 0, s4: 0, s5: 0, s6: 0 };
    }
  });

  // Perio Chart data
  const [perioData, setPerioData] = useState(() => {
    try {
      const stored = localStorage.getItem(`perio_chart_${id}`);
      return stored ? JSON.parse(stored) : {};
    } catch (e) {
      return {};
    }
  });

  // Memoized stable properties for ProfessionalOdontogram
  const odontogramSelectedTeeth = useMemo(() => {
    if (chartEditMode && editSelectedTooth) return [editSelectedTooth.id];
    if (selectedTooth?.id) return [selectedTooth.id];
    return [];
  }, [chartEditMode, editSelectedTooth, selectedTooth]);

  const odontogramEmptySelectedTeeth = useMemo(() => [], []);

  const stableOnOdontogramChange = useCallback(() => {}, []);

  const handleInfoToothClick = useCallback((toothId) => {
    let fdi = '';
    const match = String(toothId).match(/^(ur|ul|lr|ll)(\d+)(c)?$/);
    if (match) {
      const [, quad, num, isChild] = match;
      if (isChild) {
        const qMap = { ur: 5, ul: 6, ll: 7, lr: 8 };
        fdi = `${qMap[quad]}${num}`;
      } else {
        const qMap = { ur: 1, ul: 2, ll: 3, lr: 4 };
        fdi = `${qMap[quad]}${num}`;
      }
    } else {
      fdi = toothId;
    }
    if (chartEditMode) {
      setEditSelectedTooth({ id: toothId, fdi });
    } else {
      setSelectedTooth({ id: toothId, fdi });
      if (profileViewMode === 'reyestr') {
        setHistoryModalOpen(true);
      }
    }
  }, [chartEditMode, profileViewMode]);

  const handleNotesToothClick = useCallback((toothId) => {
    let fdi = '';
    const match = String(toothId).match(/^(ur|ul|lr|ll)(\d+)(c)?$/);
    if (match) {
      const [, quad, num, isChild] = match;
      if (isChild) {
        const qMap = { ur: 5, ul: 6, ll: 7, lr: 8 };
        fdi = `${qMap[quad]}${num}`;
      } else {
        const qMap = { ur: 1, ul: 2, ll: 3, lr: 4 };
        fdi = `${qMap[quad]}${num}`;
      }
    } else {
      fdi = toothId;
    }
    setSelectedTooth({ id: toothId, fdi });
    setHistoryModalOpen(true);
  }, []);

  const handleOcclusionNotesChange = useCallback((notes) => {
    setOcclusionNotes(notes);
    if (patient?.id) {
      localStorage.setItem(`occlusion_notes_${patient.id}`, notes);
    }
  }, [patient?.id]);

  const handleOcclusionClassChange = useCallback((cls) => {
    setOcclusionClass(cls);
    if (patient?.id) {
      localStorage.setItem(`occlusion_class_${patient.id}`, cls);
    }
  }, [patient?.id]);

  useEffect(() => {
    if (!id) return;
    try {
      const psrStored = localStorage.getItem(`psr_scores_${id}`);
      setPsrScores(psrStored ? JSON.parse(psrStored) : { s1: 0, s2: 0, s3: 0, s4: 0, s5: 0, s6: 0 });
      
      const perioStored = localStorage.getItem(`perio_chart_${id}`);
      setPerioData(perioStored ? JSON.parse(perioStored) : {});
      
      const occlusionClassStored = localStorage.getItem(`occlusion_class_${id}`);
      setOcclusionClass(occlusionClassStored || 'Class I');
      
      const occlusionNotesStored = localStorage.getItem(`occlusion_notes_${id}`);
      setOcclusionNotes(occlusionNotesStored || '');
    } catch (e) {
      console.error("Failed to load perio/psr data", e);
    }
  }, [id]);

  // Lazy-load patient list only when appointment modal is opened (not on initial page load)
  useEffect(() => {
    if (!apptModalOpen || allPatients.length > 0) return;
    base44.entities.Patient.list('full_name', 200)
      .then(pats => setAllPatients(pats || []))
      .catch(() => {});
  }, [apptModalOpen]);

  const [detailModal, setDetailModal] = useState({ open: false, type: '', title: '' });
  const [installmentPaymentModal, setInstallmentPaymentModal] = useState({
    open: false,
    planId: '',
    monthIndex: null,
    amount: '',
    method: 'Cash',
    date: getLocalDateTimeValue(),
    notes: '',
    doctor_id: '',
    payment_id: ''
  });
  const [installmentHistoryModal, setInstallmentHistoryModal] = useState({
    open: false,
    planId: '',
    monthIndex: null
  });
  const [installmentSaving, setInstallmentSaving] = useState(false);
  const installmentSavingRef = useRef(false);
  const installmentTxRef = useRef('');

  const payingSavingRef = useRef(false);
  const payTxRef = useRef('');
  const photoInputRef = useRef(null);
  const [patientPhotos, setPatientPhotos] = useState([]); // { url, date, id }
  const [photoUploading, setPhotoUploading] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState(null); // currently viewing photo

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setPhotoUploading(true);
    try {
      for (const file of files) {
        const reader = new FileReader();
        await new Promise((resolve, reject) => {
          reader.onload = async (ev) => {
            try {
              const dataUrl = ev.target.result;
              const fname = (file.name || '').toLowerCase();
              let imgType = 'photo';
              if (fname.includes('xray') || fname.includes('rentgen') || fname.includes('r-')) imgType = 'xray';
              else if (fname.includes('ct') || fname.includes('kt')) imgType = 'ct';
              else if (fname.includes('optg') || fname.includes('pano')) imgType = 'panoramic';

              const newRecord = await base44.entities.Xray.create({
                patient_id: id,
                image_url: dataUrl,
                date: new Date().toISOString().split('T')[0],
                created_date: new Date().toISOString(),
                type: imgType,
                notes: file.name,
                description: file.name,
              });
              if (newRecord) {
                setXrays(prev => [newRecord, ...prev]);
              }
              resolve();
            } catch (err) {
              reject(err);
            }
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }
      toast.success(`${files.length} ta tasvir muvaffaqiyatli yuklandi`);
      await load();
    } catch (err) {
      console.error(err);
      toast.error('Rasm yuklashda xatolik yuz berdi');
    } finally {
      setPhotoUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUploading(true);
    try {
      const reader = new FileReader();
      await new Promise((resolve) => {
        reader.onload = async (ev) => {
          const dataUrl = ev.target.result;
          await base44.entities.Patient.update(id, { photo_url: dataUrl });
          setPatient(prev => prev ? { ...prev, photo_url: dataUrl } : prev);
          toast.success('Profil rasmi yangilandi');
          resolve();
        };
        reader.readAsDataURL(file);
      });
    } catch (err) {
      console.error(err);
      toast.error('Rasm yuklashda xatolik');
    } finally {
      setPhotoUploading(false);
      e.target.value = '';
    }
  };


  // 043/u Medical Card State
  const [card043Data, setCard043Data] = useState(() => {
    try {
      const stored = localStorage.getItem(`card043_data_${id}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          passport: {
            full_name: parsed.passport?.full_name || '',
            birth_year: parsed.passport?.birth_year || '',
            address: parsed.passport?.address || '',
            occupation: parsed.passport?.occupation || '',
          },
          diagnoses: {
            complaints: parsed.diagnoses?.complaints || '',
            past_illnesses: parsed.diagnoses?.past_illnesses || '',
            objective_exam: parsed.diagnoses?.objective_exam || '',
            xray_lab: parsed.diagnoses?.xray_lab || '',
          },
          toothStatus: parsed.toothStatus || {},
          historyLogs: parsed.historyLogs || [],
        };
      }
    } catch (e) {
      console.error(e);
    }
    
    return {
      passport: {
        full_name: '',
        birth_year: '',
        address: '',
        occupation: '',
      },
      diagnoses: {
        complaints: '',
        past_illnesses: '',
        objective_exam: '',
        xray_lab: '',
      },
      toothStatus: {},
      historyLogs: [],
    };
  });

  const [manualLog, setManualLog] = useState({ content: '', doctor: '' });
  const [manualLogModalOpen, setManualLogModalOpen] = useState(false);

  // Update manual log default doctor when doctors are loaded
  useEffect(() => {
    if (doctors && doctors.length > 0) {
      setManualLog(prev => ({ ...prev, doctor: doctors[0].name }));
    }
  }, [doctors]);

  // Pre-fill passport data when patient is loaded
  useEffect(() => {
    if (patient) {
      setCard043Data(prev => {
        const hasName = !!prev.passport.full_name;
        if (!hasName) {
          return {
            ...prev,
            passport: {
              full_name: patient.full_name || '',
              birth_year: patient.birth_date ? new Date(patient.birth_date).getFullYear().toString() : '',
              address: patient.address || '',
              occupation: prev.passport.occupation || '',
            }
          };
        }
        return prev;
      });
    }
  }, [patient]);

  const upperTeethFdi = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
  const lowerTeethFdi = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

  const updatePassportField = (field, value) => {
    setCard043Data(prev => {
      const updated = {
        ...prev,
        passport: {
          ...prev.passport,
          [field]: value
        }
      };
      localStorage.setItem(`card043_data_${id}`, JSON.stringify(updated));
      return updated;
    });
  };

  const updateDiagnosisField = (field, value) => {
    setCard043Data(prev => {
      const updated = {
        ...prev,
        diagnoses: {
          ...prev.diagnoses,
          [field]: value
        }
      };
      localStorage.setItem(`card043_data_${id}`, JSON.stringify(updated));
      return updated;
    });
  };

  const handleToothStatusChange = (fdi, status) => {
    setCard043Data(prev => {
      const updated = {
        ...prev,
        toothStatus: {
          ...prev.toothStatus,
          [fdi]: status
        }
      };
      localStorage.setItem(`card043_data_${id}`, JSON.stringify(updated));
      
      // Auto sync/log entry for this status change
      const today = new Date().toLocaleDateString('uz-UZ');
      const doctorName = doctors[0]?.name || 'Tibbiy shifokor';
      let label = '';
      if (status === 'C') label = `Tashxis: ${fdi}-tish Karies (C)`;
      else if (status === 'P') label = `Tashxis: ${fdi}-tish Pulpit (P)`;
      else if (status === 'A') label = `Missing tooth: ${fdi}-tish yo'q (A)`;
      else if (status === 'R') label = `Tashxis: ${fdi}-tish Ildizi (R)`;
      else if (status === 'F') label = `Holat: ${fdi}-tish Plomba qilingan (F)`;
      else if (status === 'K') label = `Holat: ${fdi}-tish Sun'iy toj/Koronka (K)`;
      else if (status === '') label = `Holat: ${fdi}-tish Sog'lom holatga o'tkazildi (N)`;

      const existingContents = prev.historyLogs.map(l => l.content);
      if (label && !existingContents.includes(label)) {
        updated.historyLogs = [
          {
            id: Math.random().toString(36).substring(2, 9),
            date: today,
            content: label,
            doctor: doctorName,
          },
          ...prev.historyLogs
        ];
        localStorage.setItem(`card043_data_${id}`, JSON.stringify(updated));
      }
      
      return updated;
    });
  };

  const addManualLogItem = () => {
    if (!manualLog.content.trim()) {
      toast.warning("Yozuv matnini kiriting!");
      return;
    }
    const today = new Date().toLocaleDateString('uz-UZ');
    setCard043Data(prev => {
      const updated = {
        ...prev,
        historyLogs: [
          {
            id: Math.random().toString(36).substring(2, 9),
            date: today,
            content: manualLog.content.trim(),
            doctor: manualLog.doctor || doctors[0]?.name || 'Navbatchi shifokor',
          },
          ...prev.historyLogs
        ]
      };
      localStorage.setItem(`card043_data_${id}`, JSON.stringify(updated));
      return updated;
    });
    setManualLog(prev => ({ ...prev, content: '' }));
    setManualLogModalOpen(false);
    toast.success("Kundalikka yozuv qo'shildi!");
  };

  const deleteHistoryLogItem = (logId) => {
    setCard043Data(prev => {
      const updated = {
        ...prev,
        historyLogs: prev.historyLogs.filter(l => l.id !== logId)
      };
      localStorage.setItem(`card043_data_${id}`, JSON.stringify(updated));
      return updated;
    });
    toast.success("Kundalik yozuvi o'chirildi!");
  };

  const saveCard043Data = () => {
    localStorage.setItem(`card043_data_${id}`, JSON.stringify(card043Data));
    toast.success("043/u Tibbiy karta ma'lumotlari muvaffaqiyatli saqlandi!");
  };

  const printCard043 = () => {
    window.print();
  };

  const exportCard043PDF = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(14);
    doc.text("O'ZBEKISTON RESPUBLIKASI SOG'LIQNI SAQLASH VAZIRLIGI", 105, 15, { align: 'center' });
    doc.setFontSize(12);
    doc.text("STOMATOLOGIK BEMORNING TIBBIY KARTASI (Shakl 043/u)", 105, 23, { align: 'center' });
    
    doc.line(20, 28, 190, 28);
    
    // Passport info
    doc.setFontSize(10);
    doc.text(`F.I.SH.: ${card043Data.passport.full_name || '—'}`, 20, 36);
    doc.text(`Tug'ilgan yili: ${card043Data.passport.birth_year || '—'}`, 20, 42);
    doc.text(`Telefon: ${patient?.phone || '—'}`, 20, 48);
    doc.text(`Manzil: ${card043Data.passport.address || '—'}`, 20, 54);
    doc.text(`Kasbi: ${card043Data.passport.occupation || '—'}`, 20, 60);
    
    doc.line(20, 65, 190, 65);
    
    // Diagnoses / Notes
    let y = 72;
    doc.setFontSize(11);
    doc.text("1. Shikoyatlari:", 20, y); y += 6;
    doc.setFontSize(9);
    const complaintsLines = doc.splitTextToSize(card043Data.diagnoses.complaints || 'Kiritilmagan.', 160);
    doc.text(complaintsLines, 22, y); y += complaintsLines.length * 5 + 2;

    doc.setFontSize(11);
    doc.text("2. O'tkazgan kasalliklari (Anamnez):", 20, y); y += 6;
    doc.setFontSize(9);
    const anamnezLines = doc.splitTextToSize(card043Data.diagnoses.past_illnesses || 'Kiritilmagan.', 160);
    doc.text(anamnezLines, 22, y); y += anamnezLines.length * 5 + 2;

    doc.setFontSize(11);
    doc.text("3. Obyektiv tekshiruv ma'lumotlari:", 20, y); y += 6;
    doc.setFontSize(9);
    const objectiveLines = doc.splitTextToSize(card043Data.diagnoses.objective_exam || 'Kiritilmagan.', 160);
    doc.text(objectiveLines, 22, y); y += objectiveLines.length * 5 + 2;

    doc.setFontSize(11);
    doc.text("4. Rentgen va laboratoriya xulosalari:", 20, y); y += 6;
    doc.setFontSize(9);
    const xrayLines = doc.splitTextToSize(card043Data.diagnoses.xray_lab || 'Kiritilmagan.', 160);
    doc.text(xrayLines, 22, y); y += xrayLines.length * 5 + 4;
    
    // Add page if needed or print dental formula
    if (y > 240) {
      doc.addPage();
      y = 20;
    }
    
    doc.setFontSize(11);
    doc.text("5. Boshlang'ich stomatologik formula:", 20, y); y += 8;
    
    doc.setFontSize(9);
    // Draw upper row representation
    let upperStr = "Yuqori: ";
    upperTeethFdi.forEach(fdi => {
      upperStr += `${fdi}:${card043Data.toothStatus[fdi] || 'N'}  `;
    });
    doc.text(upperStr, 20, y); y += 6;
    
    let lowerStr = "Pastki: ";
    lowerTeethFdi.forEach(fdi => {
      lowerStr += `${fdi}:${card043Data.toothStatus[fdi] || 'N'}  `;
    });
    doc.text(lowerStr, 20, y); y += 8;
    
    doc.line(20, y, 190, y); y += 8;
    
    // Treatment History
    doc.setFontSize(11);
    doc.text("6. Davolash kundaligi / Tarix:", 20, y); y += 8;
    
    doc.setFontSize(9);
    card043Data.historyLogs.slice(0, 15).forEach(log => {
      if (y > 260) {
        doc.addPage();
        y = 20;
      }
      doc.text(`${log.date} - ${log.doctor}`, 20, y);
      const contentLines = doc.splitTextToSize(log.content, 160);
      doc.text(contentLines, 22, y + 5);
      y += contentLines.length * 5 + 8;
    });

    doc.save(`Shakl-043u-${patient.full_name}.pdf`);
    toast.success("PDF hujjat muvaffaqiyatli yuklab olindi!");
  };

  const syncSystemDataToLogs = () => {
    const today = new Date().toLocaleDateString('uz-UZ');
    const doctorName = doctors[0]?.name || 'Tibbiy shifokor';
    const newLogs = [];

    // 1. Tooth status logs
    Object.entries(card043Data.toothStatus).forEach(([fdi, status]) => {
      if (status) {
        let label = '';
        if (status === 'C') label = `Tashxis: ${fdi}-tish Karies (C)`;
        else if (status === 'P') label = `Tashxis: ${fdi}-tish Pulpit (P)`;
        else if (status === 'A') label = `Missing tooth: ${fdi}-tish yo'q (A)`;
        else if (status === 'R') label = `Tashxis: ${fdi}-tish Ildizi (R)`;
        else if (status === 'F') label = `Holat: ${fdi}-tish Plomba qilingan (F)`;
        else if (status === 'K') label = `Holat: ${fdi}-tish Sun'iy toj/Koronka (K)`;
        
        if (label) newLogs.push(label);
      }
    });

    // 2. Perio chart measurements
    let totalBopActive = 0;
    let totalPlActive = 0;
    const totalSites = 32 * 6; // 192
    
    [...upperTeethFdi, ...lowerTeethFdi].forEach(fdi => {
      const toothKey = `t${fdi}`;
      const val = perioData[toothKey];
      if (val) {
        if (Array.isArray(val.bop)) {
          val.bop.forEach(b => { if (b) totalBopActive++; });
        }
        if (Array.isArray(val.pl)) {
          val.pl.forEach(p => { if (p) totalPlActive++; });
        }
      }
    });
    
    if (totalBopActive > 0) {
      const bopPercent = ((totalBopActive / totalSites) * 100).toFixed(2);
      newLogs.push(`Parodontal tekshiruv: BOP (Milk qonashi) = ${bopPercent}%`);
    }
    if (totalPlActive > 0) {
      const plPercent = ((totalPlActive / totalSites) * 100).toFixed(2);
      newLogs.push(`Parodontal tekshiruv: PL (Karash to'planishi) = ${plPercent}%`);
    }

    // 3. PSR scores
    const psrLabels = {
      s1: 'Sekstant 1 (Yuqori O\'ng)',
      s2: 'Sekstant 2 (Yuqori Old)',
      s3: 'Sekstant 3 (Yuqori Chap)',
      s4: 'Sekstant 4 (Pastki Chap)',
      s5: 'Sekstant 5 (Pastki Old)',
      s6: 'Sekstant 6 (Pastki O\'ng)',
    };
    Object.entries(psrScores).forEach(([key, score]) => {
      if (score > 0) {
        newLogs.push(`Periodontal skrining: PSR ${psrLabels[key] || key} = ${score}`);
      }
    });

    // 4. Treatment plans (Invoices)
    (plans || []).forEach(plan => {
      newLogs.push(`Davolash rejasi (Hisob-faktura): ${plan.name} — Narxi: ${plan.total_price?.toLocaleString()} so'm — Status: ${plan.status}`);
    });

    if (newLogs.length === 0) {
      toast.info("Sinxronizatsiya qilish uchun grafiklarda yangi o'zgarishlar topilmadi.");
      return;
    }

    // Filter duplicates
    setCard043Data(prev => {
      const existingContents = prev.historyLogs.map(l => l.content);
      const uniqueNewItems = newLogs
        .filter(content => !existingContents.includes(content))
        .map(content => ({
          id: Math.random().toString(36).substring(2, 9),
          date: today,
          content,
          doctor: doctorName,
        }));

      if (uniqueNewItems.length === 0) {
        toast.info("Grafiklardagi ma'lumotlar allaqachon tarixga yozilgan.");
        return prev;
      }

      const updated = {
        ...prev,
        historyLogs: [...uniqueNewItems, ...prev.historyLogs],
      };
      
      localStorage.setItem(`card043_data_${id}`, JSON.stringify(updated));
      toast.success(`${uniqueNewItems.length} ta yangi ma'lumot sinxronizatsiya qilindi!`);
      return updated;
    });
  };

  const FlatToothSvg = ({ fdi, status }) => {
    let crownColor = "#cbd5e1";
    let crownFill = "#ffffff";
    let rootColor = "#cbd5e1";
    let rootFill = "#ffffff";
    let statusBadge = "";
    
    if (status === 'C') {
      crownColor = "#ef4444";
      crownFill = "#fee2e2";
      statusBadge = "C";
    } else if (status === 'P') {
      crownColor = "#f97316";
      crownFill = "#ffedd5";
      statusBadge = "P";
    } else if (status === 'A') {
      crownColor = "#94a3b8";
      crownFill = "#f1f5f9";
      rootColor = "#94a3b8";
      rootFill = "#f1f5f9";
      statusBadge = "A";
    } else if (status === 'R') {
      crownColor = "transparent";
      crownFill = "transparent";
      rootColor = "#ef4444";
      rootFill = "#fee2e2";
      statusBadge = "R";
    } else if (status === 'F') {
      crownColor = "#3b82f6";
      crownFill = "#dbeafe";
      statusBadge = "F";
    } else if (status === 'K') {
      crownColor = "#eab308";
      crownFill = "#fef9c3";
      statusBadge = "K";
    }

    const isLower = fdi >= 31 && fdi <= 48;

    return (
      <svg width="24" height="48" viewBox="0 0 24 48" className="mx-auto select-none">
        {/* Crown */}
        {status !== 'R' && (
          <path
            d="M 4,20 C 4,14 6,10 12,10 C 18,10 20,14 20,20 C 20,24 18,26 12,26 C 6,26 4,24 4,20 Z"
            fill={crownFill}
            stroke={crownColor}
            strokeWidth="1.5"
            strokeDasharray={status === 'A' ? "2,2" : "0"}
          />
        )}
        {/* Root */}
        <path
          d={isLower 
            ? "M 8,26 C 8,34 10,42 12,46 C 14,42 16,34 16,26 Z"
            : "M 8,10 C 8,2 10,0 12,0 C 14,0 16,2 16,10 Z"
          }
          fill={rootFill}
          stroke={rootColor}
          strokeWidth="1.5"
          strokeDasharray={status === 'A' ? "2,2" : "0"}
        />
        {/* Status badge text inside tooth */}
        {statusBadge && (
          <text
            x="12"
            y="23"
            textAnchor="middle"
            fontSize="9"
            fontWeight="bold"
            fill={status === 'A' ? "#64748b" : (status === 'C' || status === 'R' ? "#ef4444" : "#1e293b")}
          >
            {statusBadge}
          </text>
        )}
      </svg>
    );
  };


  const load = async () => {
    try {
      // ── PHASE 1: Critical data — renders the header & plans immediately ──
      const [patientRes, plansRes, paymentsRes] = await Promise.all([
        base44.entities.Patient.filter({ id }),
        base44.entities.TreatmentPlan.filter({ patient_id: id }, '-created_date', 50),
        base44.entities.Payment.filter({ patient_id: id }, '-date', 5000),
      ]);

      // Apply capitalization on patient
      const rawPatient = patientRes[0] || null;
      if (rawPatient) {
        if (rawPatient.full_name) rawPatient.full_name = capitalizeName(rawPatient.full_name);
        if (rawPatient.first_name) rawPatient.first_name = capitalizeName(rawPatient.first_name);
        if (rawPatient.last_name) rawPatient.last_name = capitalizeName(rawPatient.last_name);
        if (rawPatient.address) rawPatient.address = capitalizeName(rawPatient.address);
      }
      setPatient(rawPatient);

      const rawPlans = plansRes || [];
      setPlans(rawPlans.map(tp => {
        if (tp) {
          if (tp.patient_name) tp.patient_name = capitalizeName(tp.patient_name);
          if (tp.name) tp.name = capitalizeName(tp.name);
        }
        return tp;
      }));

      // Auto-sanitize legacy linked plan payments (remove old dummy discount payments & fix undiscounted debt payments in DB)
      const rawPays = paymentsRes || [];
      const sanitizedPays = [];
      for (const p of rawPays) {
        const notesLower = (p.notes || '').toLowerCase();
        const pType = (p.type || '').toLowerCase();
        
        // Agar bu reja bilan bog'liq eski soxta "Discount" to'lovi bo'lsa, DB dan tozalaymiz
        if (pType === 'discount' && (p.plan_id || notesLower.includes('linked to plan') || notesLower.includes('avtomatik chegirma') || notesLower.includes('chegirma 30%'))) {
          base44.entities.Payment.delete(p.id).catch(() => {});
          continue;
        }

        // Agar bu reja bilan bog'liq eski "Debt" to'lovi bo'lsa va uning narxi rejaning haqiqiy chegirmali narxidan farq qilsa, DB ni to'g'rilaymiz
        if (pType === 'debt' && (p.plan_id || notesLower.includes('linked to plan'))) {
          const matchedPlan = rawPlans.find(pl => (p.plan_id && pl.id === p.plan_id) || (p.notes && p.notes.includes(pl.id)));
          if (matchedPlan && matchedPlan.total_price && Number(p.amount) !== Number(matchedPlan.total_price)) {
            p.amount = Number(matchedPlan.total_price);
            base44.entities.Payment.update(p.id, { amount: Number(matchedPlan.total_price) }).catch(() => {});
          }
        }

        sanitizedPays.push(p);
      }
      setPayments(sanitizedPays);

      // ── Unblock UI: hide skeleton now, render with partial data ──
      setLoading(false);

      // ── PHASE 2: Secondary data — load in background, no skeleton ──
      const [svcsRes, implantsRes, toothRes, doctorsRes, xraysRes] = await Promise.all([
        servicesCache ? Promise.resolve(servicesCache) : base44.entities.Service.filter({ is_active: true }, 'name', 500),
        base44.entities.Implant.filter({ patient_id: id }),
        base44.entities.ToothRecord.filter({ patient_id: id }, '-created_date', 100),
        doctorsCache ? Promise.resolve(doctorsCache) : base44.entities.User.filter({ role: 'doctor' }, 'name'),
        base44.entities.Xray.filter({ patient_id: id }, '-created_date', 200),
      ]);

      if (!servicesCache) servicesCache = svcsRes || [];
      if (!doctorsCache) doctorsCache = doctorsRes || [];

      // Deduplicate and sort services
      const seenSvcs = new Map();
      (svcsRes || []).forEach(s => {
        const k = s.name ? s.name.toLowerCase().trim() : '';
        if (k && !seenSvcs.has(k)) seenSvcs.set(k, s);
      });
      const rawSvcs = Array.from(seenSvcs.values());
      try {
        const savedOrder = localStorage.getItem('service_item_order');
        if (savedOrder) {
          const orderMap = JSON.parse(savedOrder);
          const allOrderedIds = Object.values(orderMap).flat();
          if (allOrderedIds.length > 0) {
            setServices([...rawSvcs].sort((a, b) => {
              const ai = allOrderedIds.indexOf(a.id);
              const bi = allOrderedIds.indexOf(b.id);
              if (ai === -1 && bi === -1) return 0;
              if (ai === -1) return 1;
              if (bi === -1) return -1;
              return ai - bi;
            }));
          } else {
            setServices(rawSvcs);
          }
        } else {
          setServices(rawSvcs);
        }
      } catch {
        setServices(rawSvcs);
      }

      setImplants(implantsRes || []);
      setToothRecords(toothRes || []);
      setDoctors(doctorsRes || []);
      setXrays(xraysRes || []);
      setRefreshTrigger(prev => prev + 1);
    } catch (e) {
      console.error("Load failed", e);
      setLoading(false);
    }
  };

  // Tishlarning holatini treatment plans, implants va toothRecords dan olish
  const getToothStatuses = () => {
    const toothStatusMap = {};

    const getInternalId = (fdi) => {
      if (!fdi) return null;
      const n = parseInt(fdi);
      if (isNaN(n)) return String(fdi).toLowerCase().trim();
      if (n >= 11 && n <= 18) return `ur${n - 10}`;
      if (n >= 21 && n <= 28) return `ul${n - 20}`;
      if (n >= 31 && n <= 38) return `ll${n - 30}`;
      if (n >= 41 && n <= 48) return `lr${n - 40}`;
      // Bolalar uchun
      if (n >= 51 && n <= 55) return `ur${n - 50}c`;
      if (n >= 61 && n <= 65) return `ul${n - 60}c`;
      if (n >= 71 && n <= 75) return `ll${n - 70}c`;
      if (n >= 81 && n <= 85) return `lr${n - 80}c`;
      return String(fdi).toLowerCase().trim();
    };

    const mapConditionTreatmentToStatus = (condition, treatment) => {
      const cond = String(condition || '').trim().toLowerCase();
      const treat = String(treatment || '').trim().toLowerCase();
      const combined = `${cond} ${treat}`.trim();

      if (combined.includes('missing tooth') || combined.includes('missing') || combined.includes('all teeth missing')) {
        return 'missing';
      }
      if (combined.includes('extracted') || combined.includes('sug\'urilgan') || combined.includes('olingan')) {
        return 'extracted';
      }
      
      // Restorations (treatments)
      if (combined.includes('implant')) return 'implant';
      if (combined.includes('crown') || combined.includes('toj') || combined.includes('karonka')) return 'crown';
      if (combined.includes('veneer') || combined.includes('vinir')) return 'veneer';
      if (combined.includes('filling') || combined.includes('plomba') || combined.includes('cervical filling') || combined.includes('davolangan')) return 'completed';

      // Lesions (conditions)
      if (combined.includes('decay') || combined.includes('secondary cavity') || combined.includes('cavity') || combined.includes('defect') || combined.includes('discoloration') || combined.includes('kariyes')) {
        return 'caries';
      }
      
      // Periodontitum or Endo (treated or in progress)
      if (combined.includes('periodontitis') || combined.includes('gingivitis') || combined.includes('calculus')) {
        return 'in_progress';
      }
      if (combined.includes('canal') || combined.includes('pulpit') || combined.includes('endo') || combined.includes('apical') || combined.includes('sealed') || combined.includes('ildiz')) {
        return 'in_progress';
      }

      if (combined.includes('healthy') || combined.includes("sog'lom") || combined.includes('healthy periodontium')) {
        return 'healthy';
      }

      return null;
    };

    // 1. Group services from treatment plans by toothId
    const planToothServices = {};
    plans?.forEach(plan => {
      const planServices = plan.services || [];
      const planTooth = String(plan.tooth_number || '').trim();
      const planStatus = String(plan.status || '').trim().toLowerCase();
      
      const servicesToProcess = planServices.length > 0 
        ? planServices 
        : (planTooth ? [{ service_name: plan.name || plan.title, status: plan.status }] : []);

      servicesToProcess.forEach(service => {
        let toothFdiRaw = String(service.tooth_number || service.tooth_id || planTooth || '').trim();
        if (!toothFdiRaw) return;

        const teethTokens = toothFdiRaw.split(',').map(s => s.trim()).filter(Boolean);

        teethTokens.forEach(toothFdi => {
          const toothId = getInternalId(toothFdi);
          if (!toothId) return;

          if (!planToothServices[toothId]) {
            planToothServices[toothId] = [];
          }
          planToothServices[toothId].push({
            service,
            plan,
            planStatus
          });
        });
      });
    });

    // Evaluate plan treatments for each tooth with dental clinical hierarchy
    Object.entries(planToothServices).forEach(([toothId, items]) => {
      const hasImplantSvc = items.some(it => {
        const name = String(it.service.service_name || it.plan.name || '').toLowerCase();
        return name.includes('implant');
      });
      const hasCrownSvc = items.some(it => {
        const name = String(it.service.service_name || it.plan.name || '').toLowerCase();
        return name.includes('karonka') || name.includes('toj') || name.includes('crown') || name.includes('metallokeramika') || name.includes('tsirkon') || name.includes('protez');
      });
      const hasVeneerSvc = items.some(it => {
        const name = String(it.service.service_name || it.plan.name || '').toLowerCase();
        return name.includes('vinir') || name.includes('veneer');
      });
      const hasFillingSvc = items.some(it => {
        const name = String(it.service.service_name || it.plan.name || '').toLowerCase();
        return name.includes('plomba') || name.includes('restavratsiya') || name.includes('filling') || name.includes('kompozit');
      });
      const hasEndoSvc = items.some(it => {
        const name = String(it.service.service_name || it.plan.name || '').toLowerCase();
        return name.includes('endo') || name.includes('kanal') || name.includes('pulpit') || name.includes('depulpats');
      });
      const hasExtractionSvc = items.some(it => {
        const name = String(it.service.service_name || it.plan.name || '').toLowerCase();
        return name.includes('olish') || name.includes('sug\'urish') || name.includes('ekstraks') || name.includes('extraction') || name.includes('olindi');
      });
      const hasCariesSvc = items.some(it => {
        const name = String(it.service.service_name || it.plan.name || '').toLowerCase();
        return name.includes('kariyes') || name.includes('caries') || name.includes('karies');
      });

      const anyCompleted = items.some(it => 
        Boolean(
          it.service.completed || 
          it.service.status === 'completed' || 
          it.service.payment_status === 'paid' || 
          it.planStatus === 'completed' || 
          it.planStatus === 'bajarildi'
        )
      );
      const anyInProgress = items.some(it => 
        Boolean(
          it.service.status === 'in_progress' || 
          it.planStatus === 'in progress' || 
          it.planStatus === 'inprogress' || 
          it.planStatus === 'jarayonda'
        )
      );

      const treatmentsList = [];
      const conditionsList = [];

      if (hasExtractionSvc) treatmentsList.push("Tish olingan");
      if (hasImplantSvc) treatmentsList.push("Implant");
      if (hasCrownSvc) treatmentsList.push("Toj");
      if (hasVeneerSvc) treatmentsList.push("Vinir");
      if (hasFillingSvc) treatmentsList.push("Plomba");
      if (hasEndoSvc) {
        conditionsList.push("Pulpit");
        treatmentsList.push("Kanal");
      }
      if (hasCariesSvc) conditionsList.push("Kariyes");
      if (anyCompleted && treatmentsList.length === 0) treatmentsList.push("Davolangan");

      let derivedStatus = 'planned';
      if (hasImplantSvc) derivedStatus = 'implant';
      else if (hasCrownSvc) derivedStatus = 'crown';
      else if (hasVeneerSvc) derivedStatus = 'veneer';
      else if (hasFillingSvc) derivedStatus = 'completed';
      else if (hasEndoSvc) derivedStatus = anyCompleted ? 'completed' : 'in_progress';
      else if (hasExtractionSvc) derivedStatus = 'extracted';
      else if (hasCariesSvc) derivedStatus = 'caries';
      else if (anyCompleted) derivedStatus = 'completed';
      else if (anyInProgress) derivedStatus = 'in_progress';

      toothStatusMap[toothId] = {
        status: derivedStatus,
        isExtracted: hasExtractionSvc,
        hasImplant: hasImplantSvc,
        condition: conditionsList[0] || null,
        conditions: conditionsList,
        treatment: treatmentsList[0] || 'Davolangan',
        treatments: treatmentsList,
        serviceName: treatmentsList.join(', '),
        color: derivedStatus === 'completed' ? 'bg-emerald-500' : (derivedStatus === 'implant' ? 'bg-indigo-600' : (derivedStatus === 'extracted' ? 'bg-slate-400' : (derivedStatus === 'in_progress' ? 'bg-amber-500' : (derivedStatus === 'caries' ? 'bg-rose-500' : 'bg-blue-500')))),
        icon: derivedStatus === 'completed' ? '✅' : (derivedStatus === 'implant' ? '🔩' : (derivedStatus === 'extracted' ? '❌' : (derivedStatus === 'in_progress' ? '💉' : '📋'))),
        date: items[0]?.service?.completion_date || items[0]?.plan?.updated_at || items[0]?.plan?.created_date
      };
    });

    // 2. Implantlar jadvalidan qo'shish
    implants?.forEach(imp => {
      const tn = imp.tooth_numbers;
      const toothNums = Array.isArray(tn) ? tn : (typeof tn === 'string' ? tn.split(',').map(s=>s.trim()) : (imp.tooth_number ? [imp.tooth_number] : []));
      toothNums.forEach(num => {
        if (!num) return;
        const internalId = getInternalId(num);
        if (!internalId) return;
        toothStatusMap[internalId] = {
          status: 'implant',
          condition: null,
          treatment: 'Implant',
          serviceName: `${imp.firma || ''} Implant`,
          color: 'bg-indigo-600',
          icon: '🔩'
        };
      });
    });

    // 3. Saved Tooth Records
    toothRecords?.forEach(rec => {
      const num = rec.tooth_number;
      if (!num) return;
      const internalId = getInternalId(num);
      if (!internalId) return;

      const mappedStatus = mapConditionTreatmentToStatus(rec.condition, rec.treatment);
      if (mappedStatus) {
        toothStatusMap[internalId] = {
          status: mappedStatus,
          condition: rec.condition,
          treatment: rec.treatment,
          serviceName: rec.treatment || rec.condition || 'Qayd',
          color: 'bg-indigo-500',
          icon: '📝',
          date: rec.updated_date || rec.created_date
        };
      }
    });

    // 4. Pending edits (chart edit mode + chairside quick-add)
    if (chartEditMode || Object.keys(pendingToothEdits || {}).length > 0) {
      Object.entries(pendingToothEdits).forEach(([fdi, editData]) => {
        const internalId = getInternalId(fdi);
        if (!internalId) return;

        const mappedStatus = mapConditionTreatmentToStatus(editData.condition, editData.treatment);
        if (mappedStatus) {
          toothStatusMap[internalId] = {
            status: mappedStatus,
            condition: editData.condition,
            treatment: editData.treatment,
            serviceName: editData.treatment || editData.condition || 'Tahrirlanmoqda',
            color: 'bg-blue-600',
            icon: '✏️',
            date: new Date().toISOString()
          };
        } else if (editData.condition === 'Healthy' || editData.condition === 'healthy' || (editData.condition === null && editData.treatment === null)) {
          toothStatusMap[internalId] = {
            status: 'healthy',
            condition: null,
            treatment: null,
            serviceName: "Sog'lom",
            color: 'bg-green-500',
            icon: '✨'
          };
        }
      });
    }
    
    return toothStatusMap;
  };

  const toothStatuses = useMemo(() => getToothStatuses(), [plans, implants, toothRecords, pendingToothEdits, chartEditMode]);
  
  const treatedTeeth = useMemo(() => Object.keys(toothStatuses), [toothStatuses]);

  const getTeethDetailedServices = () => {
    const toothServicesMap = {};

    const getInternalId = (fdi) => {
      if (!fdi) return null;
      const n = parseInt(fdi);
      if (isNaN(n)) return String(fdi).toLowerCase().trim();
      if (n >= 11 && n <= 18) return `ur${n - 10}`;
      if (n >= 21 && n <= 28) return `ul${n - 20}`;
      if (n >= 31 && n <= 38) return `ll${n - 30}`;
      if (n >= 41 && n <= 48) return `lr${n - 40}`;
      if (n >= 51 && n <= 55) return `ur${n - 50}c`;
      if (n >= 61 && n <= 65) return `ul${n - 60}c`;
      if (n >= 71 && n <= 75) return `ll${n - 70}c`;
      if (n >= 81 && n <= 85) return `lr${n - 80}c`;
      return String(fdi).toLowerCase().trim();
    };

    plans?.forEach(plan => {
      const planServices = plan.services || [];
      const planTooth = String(plan.tooth_number || '').trim();
      const planStatus = plan.status;

      const servicesToProcess = planServices.length > 0 
        ? planServices 
        : (planTooth ? [{ service_name: plan.name || plan.title, status: plan.status, price: plan.total_price }] : []);

      servicesToProcess.forEach(service => {
        let toothFdiRaw = String(service.tooth_number || service.tooth_id || planTooth || '').trim();
        if (!toothFdiRaw) return;

        const teethTokens = toothFdiRaw.split(',').map(s => s.trim()).filter(Boolean);

        teethTokens.forEach(toothFdi => {
          let fdiNumber = '';
          const match = toothFdi.match(/^(ur|ul|lr|ll)(\d+)(c)?$/i);
          if (match) {
            const [, quad, num, isChild] = match;
            const q = quad.toLowerCase();
            if (isChild) {
              const qMap = { ur: 5, ul: 6, ll: 7, lr: 8 };
              fdiNumber = `${qMap[q]}${num}`;
            } else {
              const qMap = { ur: 1, ul: 2, ll: 3, lr: 4 };
              fdiNumber = `${qMap[q]}${num}`;
            }
          } else {
            fdiNumber = toothFdi;
          }

          const toothId = getInternalId(toothFdi);
          if (!toothId) return;

          if (!toothServicesMap[fdiNumber]) {
            toothServicesMap[fdiNumber] = [];
          }

          const planStatusLower = String(planStatus || '').trim().toLowerCase();
          const isCompleted = Boolean(
            service.completed || 
            service.status === 'completed' || 
            service.payment_status === 'paid' || 
            planStatusLower === 'completed' || 
            planStatusLower === 'bajarildi'
          );
          const isInProgress = Boolean(
            service.status === 'in_progress' || 
            planStatusLower === 'in progress' || 
            planStatusLower === 'inprogress' || 
            planStatusLower === 'jarayonda'
          );
          
          toothServicesMap[fdiNumber].push({
            id: service.id || service.service_id || `${plan.id || ''}-${service.service_name || ''}-${Math.random()}`,
            name: service.service_name || plan.name || plan.title,
            price: service.price !== undefined ? service.price : null,
            status: isCompleted ? 'completed' : (isInProgress ? 'in_progress' : 'planned'),
            isCompleted: isCompleted,
            date: service.completion_date || plan.updated_at || plan.created_date,
            planName: plan.name || plan.title,
            toothId
          });
        });
      });
    });

    implants?.forEach(imp => {
      const tn = imp.tooth_numbers;
      const toothNums = Array.isArray(tn) ? tn : (typeof tn === 'string' ? tn.split(',').map(s=>s.trim()) : (imp.tooth_number ? [imp.tooth_number] : []));
      toothNums.forEach(num => {
        if (!num) return;
        
        let fdiNumber = '';
        const match = String(num).match(/^(ur|ul|lr|ll)(\d+)(c)?$/i);
        if (match) {
          const [, quad, numStr, isChild] = match;
          const q = quad.toLowerCase();
          if (isChild) {
            const qMap = { ur: 5, ul: 6, ll: 7, lr: 8 };
            fdiNumber = `${qMap[q]}${numStr}`;
          } else {
            const qMap = { ur: 1, ul: 2, ll: 3, lr: 4 };
            fdiNumber = `${qMap[q]}${numStr}`;
          }
        } else {
          fdiNumber = num;
        }

        const toothId = getInternalId(num);
        if (!toothId) return;

        if (!toothServicesMap[fdiNumber]) {
          toothServicesMap[fdiNumber] = [];
        }

        toothServicesMap[fdiNumber].push({
          id: imp.id,
          name: `${imp.firma || ''} Implant (${imp.brend || ''})`.trim(),
          price: null,
          status: 'completed',
          isCompleted: true,
          date: imp.placement_date,
          planName: 'Implantatsiya',
          toothId
        });
      });
    });

    return toothServicesMap;
  };

  const teethDetailedServices = useMemo(() => getTeethDetailedServices(), [plans, implants]);

  const treatmentStats = useMemo(() => {
    const allServices = Object.values(teethDetailedServices).flat();
    const completed = allServices.filter(s => s.status === 'completed' || s.isCompleted).length;
    const inProgress = allServices.filter(s => s.status === 'in_progress' && !s.isCompleted).length;
    const planned = allServices.filter(s => s.status === 'planned' && !s.isCompleted).length;
    const total = allServices.length;

    return { completed, inProgress, planned, total };
  }, [teethDetailedServices]);

  const filteredTeethDetailedServices = useMemo(() => {
    let source = teethDetailedServices;

    // Filter by treatment status if selected
    if (typeof treatmentStatusFilter !== 'undefined' && treatmentStatusFilter !== 'all') {
      const filtered = {};
      Object.entries(source).forEach(([fdiNumber, services]) => {
        const matching = services.filter(s => {
          if (treatmentStatusFilter === 'completed') return s.status === 'completed' || s.isCompleted;
          if (treatmentStatusFilter === 'in_progress') return s.status === 'in_progress' && !s.isCompleted;
          if (treatmentStatusFilter === 'planned') return s.status === 'planned' && !s.isCompleted;
          return true;
        });
        if (matching.length > 0) {
          filtered[fdiNumber] = matching;
        }
      });
      source = filtered;
    }

    if (!toothSearchQuery?.trim()) return source;
    const q = toothSearchQuery.toLowerCase().trim().replace(/^#/, '');
    const result = {};
    Object.entries(source).forEach(([fdiNumber, services]) => {
      const fdiMatch = String(fdiNumber).toLowerCase().includes(q);
      const matchingServices = services.filter(s => 
        String(s.name || '').toLowerCase().includes(q) ||
        String(s.planName || '').toLowerCase().includes(q) ||
        String(s.status || '').toLowerCase().includes(q)
      );
      if (fdiMatch) {
        result[fdiNumber] = services;
      } else if (matchingServices.length > 0) {
        result[fdiNumber] = matchingServices;
      }
    });
    return result;
  }, [teethDetailedServices, toothSearchQuery]);

  useEffect(() => { load(); }, [id]);

  const handleSelectCondition = (conditionName) => {
    if (!editSelectedTooth) {
      toast.error("Iltimos, avval tishni tanlang!");
      return;
    }
    setPendingToothEdits(prev => ({
      ...prev,
      [editSelectedTooth.fdi]: {
        ...prev[editSelectedTooth.fdi],
        condition: conditionName
      }
    }));
  };

  const handleSelectTreatment = (treatmentName) => {
    if (!editSelectedTooth) {
      toast.error("Iltimos, avval tishni tanlang!");
      return;
    }
    setPendingToothEdits(prev => ({
      ...prev,
      [editSelectedTooth.fdi]: {
        ...prev[editSelectedTooth.fdi],
        treatment: treatmentName
      }
    }));
  };

  const handleSaveChartEdits = async () => {
    if (chartSaving) return;
    setChartSaving(true);
    try {
      const editEntries = Object.entries(pendingToothEdits);
      for (const [toothFdi, editData] of editEntries) {
        const existingRecord = toothRecords.find(r => String(r.tooth_number) === String(toothFdi));
        const clinicId = patient?.clinic_id || 'ava-dent';

        const payload = {
          patient_id: id,
          clinic_id: clinicId,
          tooth_number: toothFdi,
          condition: editData.condition || null,
          treatment: editData.treatment || null,
          notes: editData.notes || 'Tahrirlangan tish holati',
        };

        if (existingRecord) {
          await base44.entities.ToothRecord.update(existingRecord.id, payload);
        } else {
          await base44.entities.ToothRecord.create(payload);
        }
      }
      
      toast.success("Tish xaritasi muvaffaqiyatli saqlandi!");
      setChartEditMode(false);
      setPendingToothEdits({});
      setEditSelectedTooth(null);
      await load();
    } catch (err) {
      console.error("FDI xaritasini saqlashda xatolik:", err);
      toast.error("Saqlashda xatolik yuz berdi");
    } finally {
      setChartSaving(false);
    }
  };

  const getActiveCondition = (fdi) => {
    if (!fdi) return null;
    if (pendingToothEdits[fdi] && pendingToothEdits[fdi].hasOwnProperty('condition')) {
      return pendingToothEdits[fdi].condition;
    }
    const existing = toothRecords.find(r => String(r.tooth_number) === String(fdi));
    return existing?.condition || null;
  };

  const getActiveTreatment = (fdi) => {
    if (!fdi) return null;
    if (pendingToothEdits[fdi] && pendingToothEdits[fdi].hasOwnProperty('treatment')) {
      return pendingToothEdits[fdi].treatment;
    }
    const existing = toothRecords.find(r => String(r.tooth_number) === String(fdi));
    return existing?.treatment || null;
  };

  const financialData = useMemo(() => {
    const paymentsList = payments || [];
    const plansList = plans || [];

    const totalIncomes = paymentsList
      .filter(p => p.type?.toLowerCase() === 'income')
      .reduce((s, p) => s + (Number(p.amount) || 0), 0);

    const totalDebts = paymentsList
      .filter(p => p.type?.toLowerCase() === 'debt')
      .reduce((s, p) => s + (Number(p.amount) || 0), 0);

    const totalRefunds = paymentsList
      .filter(p => p.type?.toLowerCase() === 'refund')
      .reduce((s, p) => s + (Number(p.amount) || 0), 0);

    const totalDiscounts = paymentsList
      .filter(p => p.type?.toLowerCase() === 'discount')
      .reduce((s, p) => s + Math.abs(Number(p.amount) || 0), 0);

    // Chegirma summasini hisoblash (rejalardan yoki to'lovlardan)
    const planDiscountsTotal = plansList.reduce((sum, plan) => {
      const amt = Number(plan.discount_amount) || 0;
      if (amt > 0) return sum + amt;
      const pct = Number(plan.discount_percent) || 0;
      if (pct > 0 && plan.total_price) {
        const original = Math.round(plan.total_price / (1 - pct / 100));
        return sum + (original - plan.total_price);
      }
      return sum;
    }, 0);

    const effectiveTotalDiscount = planDiscountsTotal > 0 ? planDiscountsTotal : totalDiscounts;

    // Qarzdorlik hisoblash:
    // Reja mavjud bo'lsa: qarz = sum(plan.total_price) - totalIncomes
    // Agar alohida qarzlar bo'lsa: qarz = (totalDebts + totalRefunds) - (totalIncomes + totalDiscounts)
    let calculatedDebt = 0;
    let calculatedPrepayment = 0;

    if (plansList.length > 0) {
      const totalPlansPrice = plansList.reduce((sum, plan) => sum + (Number(plan.total_price) || 0), 0);
      const net = totalIncomes - totalPlansPrice - totalRefunds;
      calculatedDebt = net < 0 ? Math.abs(net) : 0;
      calculatedPrepayment = net > 0 ? net : 0;
    } else if (totalDebts > 0) {
      const net = totalIncomes + totalDiscounts - totalDebts - totalRefunds;
      calculatedDebt = net < 0 ? Math.abs(net) : 0;
      calculatedPrepayment = net > 0 ? net : 0;
    } else {
      const net = totalIncomes - totalRefunds;
      calculatedDebt = net < 0 ? Math.abs(net) : 0;
      calculatedPrepayment = net > 0 ? net : 0;
    }

    // Chegirma foizini hisoblash
    const totalOriginalPlansPrice = plansList.reduce((sum, plan) => {
      const pTotal = Number(plan.total_price) || 0;
      const dAmt = Number(plan.discount_amount) || 0;
      if (dAmt > 0) return sum + pTotal + dAmt;
      const pct = Number(plan.discount_percent) || 0;
      if (pct > 0 && pTotal > 0) {
        return sum + Math.round(pTotal / (1 - pct / 100));
      }
      return sum + pTotal;
    }, 0);

    const discountPercent = totalOriginalPlansPrice > 0
      ? Math.round((effectiveTotalDiscount / totalOriginalPlansPrice) * 100)
      : 0;

    return {
      totalPaid: totalIncomes,
      totalDebt: calculatedDebt,
      totalPrepayment: calculatedPrepayment,
      totalDiscount: effectiveTotalDiscount,
      discountPercent
    };
  }, [payments, plans]);

  const { totalPaid, totalDebt, totalPrepayment, totalDiscount, discountPercent } = financialData;

  const openPayModal = () => {
    const assignedDocId = resolveDoctorId(patient, plans, doctors, user, isDoctor);
    setPayForm({ 
      type: 'Income', 
      amount: '', 
      method: 'Cash', 
      category: 'Treatment', 
      date: getLocalDateTimeValue(), 
      notes: '', 
      doctor_id: assignedDocId || doctors[0]?.id || '', 
      planId: '', 
      selectedServiceIds: [] 
    });
    setPayModalOpen(true);
  };

  const openAdvanceModal = () => {
    const assignedDocId = resolveDoctorId(patient, plans, doctors, user, isDoctor);
    setPayForm({ 
      type: 'Income', 
      amount: '', 
      method: 'Cash', 
      category: "Avans to'lovi", 
      date: getLocalDateTimeValue(), 
      notes: "Bemor avans depoziti", 
      doctor_id: assignedDocId || doctors[0]?.id || '', 
      planId: '', 
      selectedServiceIds: [] 
    });
    setPayModalOpen(true);
  };

  // ✅ DB dagi total_debt ni real hisoblangan qiymat bilan sinxronlash
  useEffect(() => {
    if (!patient?.id || !payments) return;
    const dbDebt = Number(patient.total_debt) || 0;
    const dbPaid = Number(patient.total_paid) || 0;
    // Farq bo'lsa yangilaymiz
    if (dbDebt !== totalDebt || dbPaid !== totalPaid) {
      base44.entities.Patient.update(patient.id, {
        total_debt: totalDebt,
        total_paid: totalPaid,
      }).catch(() => {});
    }
  }, [totalDebt, totalPaid, patient?.id]);

  const apptStats = useMemo(() => {
    const completedAppts = (appointments || []).filter(a => a.status === 'Completed').length;
    const scheduledAppts = (appointments || []).filter(a => a.status === 'Scheduled' || a.status === 'Waiting').length;
    const noShows = (appointments || []).filter(a => a.status === 'No-Show').length;
    return { completedAppts, scheduledAppts, noShows };
  }, [appointments]);

  const { completedAppts, scheduledAppts, noShows } = apptStats;
  
  const installmentPlans = useMemo(() => {
    return (plans || []).filter(p => p.installment_plan);
  }, [plans]);

  const getInstallmentMonthTarget = (plan, monthIndex) => {
    const inst = plan?.installment_plan || {};
    const months = Number(inst.months) || 0;
    const installmentTotal = Number(inst.total ?? inst.total_amount ?? plan?.total_price ?? 0);
    const remainingTotal = Math.max(0, installmentTotal - Number(inst.advance_payment || 0));
    const baseMonthly = Number(inst.monthly_amount || 0);

    if (months <= 0) return 0;
    if (monthIndex === months - 1) {
      return Math.max(0, remainingTotal - (baseMonthly * Math.max(0, months - 1)));
    }

    return Math.max(0, baseMonthly);
  };

  const getInstallmentMonthPaid = (plan, monthIndex) => {
    const partialPayments = Array.isArray(plan?.installment_plan?.partial_payments)
      ? plan.installment_plan.partial_payments
      : [];

    return partialPayments
      .filter(payment => Number(payment.month_index) === Number(monthIndex))
      .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
  };

  const getInstallmentMonthRemaining = (plan, monthIndex) => {
    const targetAmount = getInstallmentMonthTarget(plan, monthIndex);
    const paidAmount = getInstallmentMonthPaid(plan, monthIndex);
    return Math.max(0, targetAmount - paidAmount);
  };

  const resetInstallmentPaymentModal = () => {
    installmentSavingRef.current = false;
    installmentTxRef.current = '';
    setInstallmentPaymentModal({
      open: false,
      planId: '',
      monthIndex: null,
      amount: '',
      method: 'Cash',
      date: getLocalDateTimeValue(),
      notes: '',
      doctor_id: '',
      payment_id: ''
    });
  };

  const openInstallmentPaymentModal = (plan, monthIndex) => {
    const remainingAmount = getInstallmentMonthRemaining(plan, monthIndex);
    const txId = `instpay_${plan?.id || 'plan'}_${monthIndex}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    installmentTxRef.current = txId;

    setInstallmentPaymentModal({
      open: true,
      planId: plan.id,
      monthIndex,
      amount: remainingAmount > 0 ? String(remainingAmount) : '',
      method: 'Cash',
      date: getLocalDateTimeValue(),
      notes: '',
      doctor_id: '',
      payment_id: txId
    });
  };

  const resetInstallmentHistoryModal = () => {
    setInstallmentHistoryModal({ open: false, planId: '', monthIndex: null });
  };

  const openInstallmentHistoryModal = (plan, monthIndex) => {
    setInstallmentHistoryModal({ open: true, planId: plan.id, monthIndex });
  };

  const formatDateTimeUz = (dateStr) => {
    if (!dateStr) return '—';
    const dt = new Date(dateStr);
    if (isNaN(dt)) return String(dateStr);
    return dt.toLocaleString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const recalculatePatientFinancials = async (patientId) => {
    // NOTE: limit must be high, otherwise old payments get ignored and total_debt "jumps"
    const allPays = await base44.entities.Payment.filter({ patient_id: patientId }, '-date', 5000);

    const paidSum = allPays
      .filter(p => p.type?.toLowerCase() === 'income')
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    const debtSum = allPays
      .filter(p => p.type?.toLowerCase() === 'debt')
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    const refundSum = allPays
      .filter(p => p.type?.toLowerCase() === 'refund')
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    const discountSum = allPays
      .filter(p => p.type?.toLowerCase() === 'discount')
      .reduce((sum, p) => sum + Math.abs(Number(p.amount) || 0), 0);

    const finalCalculatedDebt = Math.max(0, (debtSum + refundSum) - (paidSum + discountSum));

    await base44.entities.Patient.update(patientId, {
      total_paid: paidSum,
      total_debt: finalCalculatedDebt
    });
  };

  const handleSaveInstallmentPayment = async () => {
    const plan = installmentPlans.find(p => p.id === installmentPaymentModal.planId);
    if (!plan || installmentPaymentModal.monthIndex == null) {
      toast.error("Muddatli to'lov rejasi topilmadi");
      return;
    }

    const amountToPay = Number(installmentPaymentModal.amount);
    const remainingAmount = getInstallmentMonthRemaining(plan, installmentPaymentModal.monthIndex);
    if (!amountToPay || amountToPay <= 0) {
      toast.error("To'lov summasini kiriting");
      return;
    }

    if (amountToPay > remainingAmount) {
      toast.error(`Kiritilgan summa qolgan qarzdan katta. Qolgan summa: ${remainingAmount.toLocaleString()} so'm`);
      return;
    }

    try {
      if (installmentSavingRef.current) return; // professional: anti double-click (same render tick)
      installmentSavingRef.current = true;
      setInstallmentSaving(true);

      const inst = { ...(plan.installment_plan || {}) };
      const partialPayments = Array.isArray(inst.partial_payments) ? [...inst.partial_payments] : [];
      const paidMonths = new Set(Array.isArray(inst.paid_months) ? inst.paid_months : []);
      const paymentDate = installmentPaymentModal.date
        ? new Date(installmentPaymentModal.date).toISOString()
        : new Date().toISOString();
      const monthLabel = `${Number(installmentPaymentModal.monthIndex) + 1}-oy`;
      const planLabel = plan.name || "Muddatli to'lov";

      const paymentId = installmentPaymentModal.payment_id || installmentTxRef.current || `instpay_${plan.id}_${installmentPaymentModal.monthIndex}_${Date.now()}`;
      const createdPayment = await base44.entities.Payment.create({
        id: paymentId,
        patient_id: id,
        patient_name: patient?.full_name || plan.patient_name || 'Bemor',
        type: 'Income',
        amount: amountToPay,
        method: installmentPaymentModal.method || 'Cash',
        category: `Muddatli to'lov: ${planLabel} (${monthLabel})`,
        date: paymentDate,
        doctor_id: installmentPaymentModal.doctor_id || '',
        notes: [
          `Rassrochka ID: ${plan.id}`,
          `Oy: ${monthLabel}`,
          installmentPaymentModal.notes?.trim() || ''
        ].filter(Boolean).join('\n')
      });

      partialPayments.push({
        month_index: Number(installmentPaymentModal.monthIndex),
        amount: amountToPay,
        date: paymentDate,
        method: installmentPaymentModal.method || 'Cash',
        doctor_id: installmentPaymentModal.doctor_id || '',
        note: installmentPaymentModal.notes?.trim() || ''
      });

      const newMonthPaidAmount = getInstallmentMonthPaid(plan, installmentPaymentModal.monthIndex) + amountToPay;
      const targetAmount = getInstallmentMonthTarget(plan, installmentPaymentModal.monthIndex);

      if (newMonthPaidAmount >= targetAmount) {
        paidMonths.add(Number(installmentPaymentModal.monthIndex));
      } else {
        paidMonths.delete(Number(installmentPaymentModal.monthIndex));
      }

      const nextInstallmentPlan = {
        ...inst,
        partial_payments: partialPayments,
        paid_months: Array.from(paidMonths).sort((a, b) => a - b)
      };

      const nextPaidAmount = (Number(plan.paid_amount) || 0) + amountToPay;

      await base44.entities.TreatmentPlan.update(plan.id, {
        installment_plan: {
          ...nextInstallmentPlan
        },
        paid_amount: nextPaidAmount
      });

      // Incrementally update patient financials instead of full recalculation
      const currentPatientData = await base44.entities.Patient.read(id);
      const currentDebt = Number(currentPatientData?.total_debt) || 0;
      const currentPaid = Number(currentPatientData?.total_paid) || 0;
      await base44.entities.Patient.update(id, {
        total_paid: currentPaid + amountToPay,
        total_debt: Math.max(0, currentDebt - amountToPay)
      });

      // UI'ni darhol yangilaymiz (refreshsiz ko‘rinishi uchun)
      setPlans(prev => (prev || []).map(p =>
        p.id === plan.id
          ? { ...p, installment_plan: nextInstallmentPlan, paid_amount: nextPaidAmount }
          : p
      ));
      if (createdPayment?.id) {
        setPayments(prev => {
          const next = [createdPayment, ...(prev || [])];
          // dublikat chiqmasin
          const seen = new Set();
          return next.filter(x => {
            if (!x?.id) return true;
            if (seen.has(x.id)) return false;
            seen.add(x.id);
            return true;
          });
        });
      }
      setPatient(prev => prev ? ({
        ...prev,
        total_paid: (Number(prev.total_paid) || 0) + amountToPay,
        total_debt: Math.max(0, (Number(prev.total_debt) || 0) - amountToPay)
      }) : prev);

      toast.success(
        newMonthPaidAmount >= targetAmount
          ? `${monthLabel} to'lovi to'liq yopildi`
          : `${monthLabel} uchun qisman to'lov saqlandi`
      );
      // Nested dialoglarda ba'zan state update kechikib ko'rinadi — yopishni "qattiq" qilamiz
      setInstallmentPaymentModal(prev => ({ ...prev, open: false }));
      resetInstallmentPaymentModal();
      
      // UX: foydalanuvchi "Muddatli" bo‘limiga avtomatik qaytsin (refreshsiz)
      setActiveTab('installments');
      setDetailModal(prev => prev?.open
        ? { ...prev, open: true, type: 'installments', title: 'MUDDATLI' }
        : prev
      );

      // Fonda sinxronlash (agar serverda boshqa o‘zgarishlar bo‘lsa)
      Promise.resolve().then(() => load());
    } catch (e) {
      console.error("Installment payment error:", e);
      toast.error("Xatolik yuz berdi: " + (e.message || "Tizim hatosi"));
    } finally {
      installmentSavingRef.current = false;
      setInstallmentSaving(false);
    }
  };

  const handlePayInstallment = async (plan, monthIndex) => {
    const remainingAmount = getInstallmentMonthRemaining(plan, monthIndex);
    if (remainingAmount <= 0) {
      toast.info("Ushbu oy to'lovi allaqachon yopilgan");
      return;
    }

    openInstallmentPaymentModal(plan, monthIndex);
  };

  const insights = useMemo(() => {
    if (!patient) return [];
    const insightsList = [];
    const daysSinceVisit = daysSince(patient.last_visit);
    const noShowRisk = noShows >= 2 || (daysSinceVisit !== null && daysSinceVisit > 30);

    if (daysSinceVisit !== null && daysSinceVisit > 10) {
      insightsList.push({ icon: Clock, text: `Bemor ${daysSinceVisit} kundan beri kelmagan`, type: 'warn' });
    }
    if (noShowRisk) {
      insightsList.push({ icon: AlertTriangle, text: 'No-show ehtimoli yuqori', type: 'danger' });
    }
    if (totalDebt > 0) {
      insightsList.push({ icon: DollarSign, text: `Qarzdorlik: ${totalDebt.toLocaleString()} so'm`, type: 'warn' });
    }
    if (completedAppts >= 3 && noShows === 0) {
      insightsList.push({ icon: CheckCircle2, text: 'Doimiy va ishonchli bemor', type: 'success' });
    }
    return insightsList;
  }, [patient, totalDebt, completedAppts, noShows]);

  const timelineItems = useMemo(() => {
    if (!patient) return [];
    const items = [];

    // 1. Qabullar (Appointments)
    (appointments || []).forEach(a => {
      items.push({
        id: `appt-${a.id}`,
        type: 'appointment',
        date: a.date ? new Date(a.date) : new Date(),
        dateStr: a.date || '',
        time: a.time || '',
        title: a.service_name || "Qabul",
        desc: `Shifokor: ${a.doctor_name || '—'}`,
        status: a.status,
        color: a.status === 'Completed' ? 'emerald' : a.status === 'Cancelled' ? 'rose' : 'blue',
        rawData: a
      });
    });

    // 2. Davolash rejalari (Treatment Plans)
    (plans || []).forEach(p => {
      items.push({
        id: `plan-${p.id}`,
        type: 'plan',
        date: p.created_date ? new Date(p.created_date) : new Date(p.updated_at || Date.now()),
        dateStr: p.created_date ? p.created_date.split('T')[0] : '',
        time: p.created_date && p.created_date.includes('T') ? p.created_date.split('T')[1].substring(0, 5) : '',
        title: p.name || p.title || 'Davolash rejasi',
        desc: `Shifokor: ${p.doctor || p.doctor_name || '—'} · Tishlar: ${(p.tooth_numbers || [p.tooth_number]).filter(Boolean).join(', ') || 'Umumiy'}`,
        price: p.total_price,
        status: p.status,
        color: p.status === 'Completed' ? 'emerald' : 'indigo',
        rawData: p
      });
    });

    // 3. To'lovlar (Payments)
    (payments || []).forEach(pay => {
      const notesLower = (pay.notes || '').toLowerCase();
      const pType = (pay.type || '').toLowerCase();

      // Davolash rejasiga biriktirilgan ichki qarz (Debt) yoki avtomatik chegirma (Discount) yozuvlarini
      // to'lovlar lentasida dublikat qilib chiqarmaymiz, chunki rejaning o'zi yuqorida chegirmali yakuniy narxi bilan ko'rsatiladi.
      const isLinkedPlanInternal = (pType === 'debt' || pType === 'discount') && 
        (pay.plan_id || notesLower.includes('linked to plan') || notesLower.includes('reja:') || notesLower.includes('avtomatik chegirma') || notesLower.includes('reja yangilandi'));
      
      if (isLinkedPlanInternal) {
        return;
      }

      const isPlanPayment = !!(pay.plan_id || notesLower.includes('reja to\'lov') || notesLower.includes('muddatli') || notesLower.includes('boshlang\'ich to\'lov'));
      const isExpense = pType === 'expense';
      const isDiscount = pType === 'discount' || Number(pay.amount) < 0;
      const isRefund = pType === 'refund';

      items.push({
        id: `pay-${pay.id}`,
        type: 'payment',
        date: pay.date ? new Date(pay.date) : new Date(),
        dateStr: pay.date ? pay.date.split('T')[0] : '',
        time: pay.date && pay.date.includes('T') ? pay.date.split('T')[1].substring(0, 5) : '',
        title: isDiscount ? "Chegirma berildi" : isRefund ? "To'lov qaytarildi" : isPlanPayment ? "Reja to'lovi" : isExpense ? "Xarajat" : "To'lov qabul qilindi",
        price: pay.amount,
        color: isDiscount ? 'purple' : isRefund ? 'indigo' : isPlanPayment ? 'amber' : isExpense ? 'rose' : 'emerald',
        isPlanPayment,
        isExpense,
        isDiscount,
        isRefund,
        rawData: pay
      });
    });

    // Sort newest first
    return items.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [patient, appointments, plans, payments]);

  // Color map for dental conditions — matches the reference professional chart legend
  const CONDITION_COLORS = {
    'missing tooth': '#ef4444',
    'missing': '#ef4444',
    "yo'q": '#ef4444',
    "sug'urilgan": '#ef4444',
    "tish olingan": '#94a3b8',
    'cavity': '#3b82f6',
    'kariyes': '#3b82f6',
    'caries': '#3b82f6',
    'secondary cavity': '#f97316',
    'ikkilamchi kariyes': '#f97316',
    'fissure pigmentation': '#92400e',
    'fissure pigmentation (initial caries)': '#92400e',
    'tooth decay': '#92400e',
    'canal partially sealed': '#f43f5e',
    'kanal': '#f43f5e',
    'dental calculus': '#d97706',
    'tish toshi': '#d97706',
    'plomba': '#3b82f6',
    'filling': '#3b82f6',
    'crown': '#a855f7',
    'toj': '#a855f7',
    'veneer': '#06b6d4',
    'vinir': '#06b6d4',
    'implant': '#f97316',
    'implantat': '#f97316',
    'davolangan': '#10b981',
    'completed': '#10b981',
    'jarayonda': '#f59e0b',
    'in_progress': '#f59e0b',
    'periodontit': '#d97706',
    'gingivit': '#d97706',
    'pulpit': '#f43f5e',
  };

  const translateDiagnostic = useCallback((name) => {
    if (!name) return '';
    const lower = name.toLowerCase().trim();
    const match = DIAGNOSTIC_TRANSLATIONS[lower];
    if (match) {
      return match[language] || match['uz'] || name;
    }
    for (const [key, trans] of Object.entries(DIAGNOSTIC_TRANSLATIONS)) {
      if (lower.includes(key)) {
        return trans[language] || trans['uz'] || name;
      }
    }
    return name;
  }, [language]);

  const getConditionColor = (name) => {
    const lower = name.toLowerCase();
    for (const [key, color] of Object.entries(CONDITION_COLORS)) {
      if (lower.includes(key)) return color;
    }
    return '#5f6368';
  };

  const dentalFormulaSummaryList = useMemo(() => {
    const groups = {};

    Object.entries(toothStatuses || {}).forEach(([toothId, statusObj]) => {
      let fdi = '';
      const match = String(toothId).match(/^(ur|ul|lr|ll)(\d+)(c)?$/);
      if (match) {
        const [, quad, num, isChild] = match;
        if (isChild) {
          const qMap = { ur: 5, ul: 6, ll: 7, lr: 8 };
          fdi = `${qMap[quad]}${num}`;
        } else {
          const qMap = { ur: 1, ul: 2, ll: 3, lr: 4 };
          fdi = `${qMap[quad]}${num}`;
        }
      } else {
        fdi = toothId;
      }

      // 1. All conditions
      const conds = Array.isArray(statusObj.conditions) && statusObj.conditions.length > 0
        ? statusObj.conditions
        : (statusObj.condition ? [statusObj.condition] : []);
      conds.forEach(cond => {
        if (cond && cond !== 'Healthy' && cond !== 'Healthy periodontium' && cond !== "Sog'lom" && cond !== "Sog'lom parodont") {
          if (!groups[cond]) groups[cond] = [];
          if (!groups[cond].includes(fdi)) groups[cond].push(fdi);
        }
      });

      // 2. All treatments
      const treats = Array.isArray(statusObj.treatments) && statusObj.treatments.length > 0
        ? statusObj.treatments
        : (statusObj.treatment ? [statusObj.treatment] : []);
      treats.forEach(treat => {
        if (treat && treat !== 'Healthy' && treat !== "Sog'lom") {
          if (!groups[treat]) groups[treat] = [];
          if (!groups[treat].includes(fdi)) groups[treat].push(fdi);
        }
      });
    });

    const list = [];
    Object.entries(groups).forEach(([name, teeth]) => {
      teeth.sort((a, b) => parseInt(a) - parseInt(b));
      list.push({ name: translateDiagnostic(name), teeth: teeth.join(', '), color: getConditionColor(name) });
    });

    return list;
  }, [toothStatuses, language, translateDiagnostic]);

  const age = useMemo(() => {
    if (!patient?.birth_date) return null;
    const dateStr = String(patient.birth_date).trim();
    if (/^\d{4}$/.test(dateStr)) {
      return new Date().getFullYear() - parseInt(dateStr, 10);
    }
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      const today = new Date();
      let calculatedAge = today.getFullYear() - parsed.getFullYear();
      const m = today.getMonth() - parsed.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < parsed.getDate())) {
        calculatedAge--;
      }
      return calculatedAge;
    }
    const yearMatch = dateStr.match(/\d{4}/);
    if (yearMatch) {
      return new Date().getFullYear() - parseInt(yearMatch[0], 10);
    }
    return null;
  }, [patient?.birth_date]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f9fa]">
        {/* Header skeleton */}
        <div className="bg-white border-b border-[#e8eaed] px-4 lg:px-8 py-3">
          <div className="max-w-7xl mx-auto flex items-center gap-4">
            <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse" />
            <div className="w-48 h-4 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
        {/* Profile header card skeleton */}
        <div className="max-w-7xl mx-auto px-4 lg:px-8 pt-4">
          <div className="bg-white border border-[#e8eaed] rounded-2xl px-5 py-4 mb-3">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-gray-200 animate-pulse shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="w-48 h-5 bg-gray-200 rounded animate-pulse" />
                <div className="w-32 h-3 bg-gray-200 rounded animate-pulse" />
              </div>
              <div className="hidden lg:flex gap-2">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="w-20 h-8 bg-gray-100 rounded-full animate-pulse" />
                ))}
              </div>
            </div>
          </div>
          {/* Sub-tab skeleton */}
          <div className="flex gap-2 mb-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="w-24 h-8 bg-gray-100 rounded-full animate-pulse" />
            ))}
          </div>
          {/* Content card skeleton */}
          <div className="bg-white border border-[#e8eaed] rounded-2xl p-5 space-y-4">
            <div className="w-40 h-5 bg-gray-200 rounded animate-pulse" />
            <div className="grid grid-cols-3 gap-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
            <div className="w-full h-48 bg-gray-100 rounded-xl animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!patient) {
    return <EmptyState title="Bemor topilmadi" description="Bu bemor mavjud emas" />;
  }

  const handleSavePay = async () => {
    if (payingSavingRef.current) return;
    payingSavingRef.current = true;
    setPayingSaving(true);
    try {
      const { planId, selectedServiceIds, ...cleanForm } = payForm;
      await base44.entities.Payment.create({
        id: payTxRef.current || (payTxRef.current = `pay_${id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
        ...cleanForm,
        date: cleanForm.date === new Date().toISOString().split('T')[0] 
          ? new Date().toISOString() 
          : cleanForm.date,
        patient_id: id,
        patient_name: patient.full_name,
      });

      // Update treatment plan paid_amount & services status if linked
      if (planId && planId !== 'none') {
        const plan = plans.find(p => p.id === planId);
        if (plan) {
          const updatedServices = (plan.services || []).map((s, idx) => {
            const sId = s.id || s.service_id || String(idx);
            if (selectedServiceIds.includes(sId)) {
              return { ...s, payment_status: 'paid' };
            }
            return s;
          });
          
          const newPaid = (plan.paid_amount || 0) + Number(payForm.amount);
          await base44.entities.TreatmentPlan.update(plan.id, { 
            paid_amount: newPaid,
            services: updatedServices 
          });
        }
      }

      // Full recalculation from all payments
      const allPays = await base44.entities.Payment.filter({ patient_id: id }, '-date', 5000);
      const allPatPlans = await base44.entities.TreatmentPlan.filter({ patient_id: id }, '-created_date', 50);
      
      const calcIncomes = allPays.filter(p => p.type?.toLowerCase() === 'income').reduce((s, p) => s + (Number(p.amount) || 0), 0);
      const calcDebts = allPays.filter(p => p.type?.toLowerCase() === 'debt').reduce((s, p) => s + (Number(p.amount) || 0), 0);
      const calcRefunds = allPays.filter(p => p.type?.toLowerCase() === 'refund').reduce((s, p) => s + (Number(p.amount) || 0), 0);
      const calcDiscounts = allPays.filter(p => p.type?.toLowerCase() === 'discount').reduce((s, p) => s + Math.abs(Number(p.amount) || 0), 0);
      const calcPlansPrice = allPatPlans.reduce((sum, pl) => sum + (Number(pl.total_price) || 0), 0);
      
      let newDebt = 0;
      if (calcDebts > 0) {
        const net = calcIncomes + calcDiscounts - calcDebts - calcRefunds;
        newDebt = net < 0 ? Math.abs(net) : 0;
      } else if (calcPlansPrice > 0) {
        const net = calcIncomes + calcDiscounts - calcPlansPrice;
        newDebt = net < 0 ? Math.abs(net) : 0;
      } else {
        const net = calcIncomes - calcRefunds;
        newDebt = net < 0 ? Math.abs(net) : 0;
      }
      const newPaid = calcIncomes;

      await base44.entities.Patient.update(id, {
        total_paid: newPaid,
        total_debt: newDebt
      });

      setPayingSaving(false);
      setPayModalOpen(false);
      payTxRef.current = '';
      setPayForm({ 
        type: 'Income', 
        amount: 0, 
        method: 'Cash', 
        category: '', 
        date: new Date().toISOString().split('T')[0], 
        notes: '', 
        planId: '', 
        selectedServiceIds: [], 
        doctor_id: '' 
      });
      load();
    } catch (error) {
      console.error("Failed to save payment or update patient:", error);
      setPayingSaving(false);
    } finally {
      payingSavingRef.current = false;
    }
  };

  const handleDeletePayment = async (paymentId) => {
    if (!window.confirm("Haqiqatan ham ushbu to'lov yozuvini o'chirmoqchimisiz?")) return;
    try {
      await base44.entities.Payment.delete(paymentId);
      toast.success("To'lov muvaffaqiyatli o'chirildi");
      load();
    } catch (err) {
      console.error("Failed to delete payment:", err);
      toast.error("To'lovni o'chirishda xatolik yuz berdi");
    }
  };

  const handleSaveNote = async () => {
    if (!newNoteContent.trim()) return;
    setNoteSaving(true);
    try {
      await base44.entities.Note.create({
        patient_id: id,
        content: newNoteContent.trim(),
        type: 'General'
      });
      setNewNoteContent('');
      setNoteModalOpen(false);
      load();
    } catch (error) {
      console.error("Failed to save note:", error);
    } finally {
      setNoteSaving(false);
    }
  };

  const generatePDF = async () => {
    const doc = new jsPDF();
    doc.setFontSize(22);
    doc.setTextColor(45, 212, 191);
    doc.text(clinicName, 20, 20);
    doc.setTextColor(31, 41, 55);
    doc.setFontSize(16);
    doc.text('Bemor kartasi', 20, 32);
    doc.setFontSize(11);
    doc.setDrawColor(200);
    doc.line(20, 36, 190, 36);

    doc.text(`Ism: ${patient.full_name}`, 20, 46);
    doc.text(`Telefon: ${patient.phone}`, 20, 54);
    doc.text(`Tug'ilgan sana: ${patient.birth_date || '—'}`, 20, 62);
    doc.text(`Jinsi: ${patient.gender || '—'}`, 20, 70);
    doc.text(`Manzil: ${patient.address || '—'}`, 20, 78);
    doc.text(`Status: ${patient.status || 'New'}`, 20, 86);
    doc.line(20, 90, 190, 90);

    let y = 100;
    doc.setFontSize(13);
    doc.text("Davolash rejalari:", 20, y); y += 8;
    doc.setFontSize(10);
    plans.forEach((p) => {
      doc.text(`• ${p.name} — ${p.status} — ${p.total_price?.toLocaleString()} so'm`, 22, y);
      y += 7;
    });
    if (plans.length === 0) { doc.text("Davolash rejalari yo'q", 22, y); y += 7; }

    y += 5;
    doc.setFontSize(13);
    doc.text("To'lovlar:", 20, y); y += 8;
    doc.setFontSize(10);
    payments.slice(0, 10).forEach((p) => {
      doc.text(`• ${p.date} — ${p.type} — ${p.amount?.toLocaleString()} so'm — ${p.method}`, 22, y);
      y += 7;
    });

    y += 5;
    doc.setFontSize(11);
    doc.text(`Jami to'langan: ${totalPaid.toLocaleString()} so'm`, 20, y); y += 7;
    doc.text(`Qarzdorlik: ${totalDebt.toLocaleString()} so'm`, 20, y);

    doc.save(`bemor-${patient.full_name}.pdf`);
  };


  const handleChairsideQuickStatus = useCallback((fdi, toothId, statusKey) => {
    if (!fdi) return;
    const conditionMap = {
      caries: 'Kariyes',
      filling: 'Plomba',
      crown: 'Toj',
      implant: 'Implant',
      extracted: "Olib tashlangan",
      other: 'Boshqa',
    };
    setPendingToothEdits(prev => ({
      ...prev,
      [String(fdi)]: {
        ...prev[String(fdi)],
        condition: conditionMap[statusKey] || statusKey,
      }
    }));
    if (toothId) {
      setSelectedTooth(prev => prev ? { ...prev, id: toothId, fdi: String(fdi) } : { id: toothId, fdi: String(fdi) });
    }
    toast.success(`Tish #${fdi}: ${conditionMap[statusKey] || statusKey}`);
  }, []);

  const handleChairsideSaveToothNote = useCallback(async (fdi, toothId, note, statusKey) => {
    if (!fdi || !id) return;
    try {
      const conditionMap = {
        caries: 'Kariyes',
        filling: 'Plomba',
        crown: 'Toj',
        implant: 'Implant',
        extracted: "Olib tashlangan",
        other: 'Boshqa',
      };
      const existingRecord = (toothRecords || []).find(r => String(r.tooth_number) === String(fdi));
      const clinicId = patient?.clinic_id || 'ava-dent';
      const payload = {
        patient_id: id,
        clinic_id: clinicId,
        tooth_number: String(fdi),
        condition: conditionMap[statusKey] || pendingToothEdits[String(fdi)]?.condition || null,
        treatment: pendingToothEdits[String(fdi)]?.treatment || null,
        notes: note || pendingToothEdits[String(fdi)]?.notes || 'Chairside eslatma',
      };
      if (existingRecord) {
        await base44.entities.ToothRecord.update(existingRecord.id, payload);
      } else {
        await base44.entities.ToothRecord.create(payload);
      }
      setPendingToothEdits(prev => {
        const next = { ...prev };
        delete next[String(fdi)];
        return next;
      });
      toast.success('Tish holati saqlandi');
      load();
    } catch (e) {
      console.error(e);
      toast.error('Saqlashda xatolik');
    }
  }, [id, toothRecords, patient, pendingToothEdits]);

  const getInitials = (name) => name?.split(' ')?.map(n => n[0])?.join('')?.substring(0, 2)?.toUpperCase() || '?';

  return (
    <div className="min-h-screen bg-[#f4f6f8] pb-20">
      <div className="print:hidden">

      {profileViewMode === 'chairside' && (
        <ChairsidePatientProfile
          patient={patient}
          age={age}
          totalDebt={totalDebt}
          totalPrepayment={totalPrepayment}
          medicalAlerts={medicalAlerts}
          selectedTooth={selectedTooth}
          onSelectTooth={setSelectedTooth}
          onClearTooth={() => setSelectedTooth(null)}
          toothStatuses={toothStatuses}
          plans={plans}
          toothRecords={toothRecords}
          implants={implants}
          doctors={doctors}
          appointments={appointments}
          odontogramSelectedTeeth={odontogramSelectedTeeth}
          onOdontogramChange={stableOnOdontogramChange}
          handleInfoToothClick={handleInfoToothClick}
          patientType={patientType}
          setPatientType={setPatientType}
          chartView={chartView}
          showOcclusal={showOcclusal}
          psrScores={psrScores}
          occlusionNotes={occlusionNotes}
          handleOcclusionNotesChange={handleOcclusionNotesChange}
          occlusionClass={occlusionClass}
          handleOcclusionClassChange={handleOcclusionClassChange}
          onBack={handleBack}
          backLabel={location.state?.fromName
            ? location.state.fromName
            : (language === 'ru' ? 'Назад' : language === 'en' ? 'Back' : 'Orqaga')}
          onPay={openPayModal}
          onAppointment={() => setApptModalOpen(true)}
          onNewPlan={() => setTreatmentModalOpen(true)}
          onEditPatient={() => setPatientModalOpen(true)}
          onAvatarUpload={handleAvatarUpload}
          onQuickStatus={handleChairsideQuickStatus}
          onSaveToothNote={handleChairsideSaveToothNote}
          onOpenFullProfile={() => { setProfileViewMode('reyestr'); setActiveTab('info'); }}
          profileViewMode={profileViewMode}
          setProfileViewMode={setProfileViewMode}
          locationState={location.state}
          language={language}
        />
      )}

      {profileViewMode === 'reyestr' && (
      <>
      {/* ══ TOP NAVIGATION & HEADER ══ */}
      <div className="bg-white border-b border-[#e8eaed] sticky top-0 z-30 shadow-xs">
        {/* Warning Alerts Banner */}
        {medicalAlerts && medicalAlerts.length > 0 && (
          <div className="bg-rose-50 border-b border-rose-100 px-4 py-2 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-rose-600 text-[10.5px] font-[900] uppercase tracking-wider shrink-0 mr-2">
              <AlertTriangle className="w-4 h-4 text-rose-500 animate-pulse shrink-0" />
              <span>{t('patientProfile.medicalAlert')}:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {medicalAlerts.map((alert, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 bg-gradient-to-r from-red-500 to-rose-600 text-white text-[9.5px] font-[900] uppercase tracking-wider px-2.5 py-1 rounded-lg shadow-sm"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping shrink-0" />
                  {t(`patientProfile.${alert.type}`)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ══ TOP ACTION & BREADCRUMB BAR ══ */}
        <div className="px-3 sm:px-6 py-2.5 flex items-center justify-between gap-3 flex-wrap">
          {/* Left: Back button + Patient Name Breadcrumb */}
          <div className="flex items-center gap-2 sm:gap-3 py-0.5 min-w-0">
            <button
              onClick={handleBack}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all active:scale-95 group shrink-0 border border-slate-200/60 cursor-pointer"
              title={language === 'ru' ? "Вернуться назад" : language === 'en' ? "Go back" : "Orqaga qaytish"}
            >
              <ArrowLeft className="w-3.5 h-3.5 text-slate-600 group-hover:-translate-x-0.5 transition-transform" />
              <span className="hidden sm:inline">
                {location.state?.fromName 
                  ? location.state.fromName 
                  : (language === 'ru' ? 'Назад' : language === 'en' ? 'Back' : 'Orqaga')}
              </span>
            </button>

            <div className="w-px h-5 bg-slate-200 shrink-0 hidden sm:block" />

            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-black text-slate-900 truncate">{patient.full_name}</span>
              {patient.gender && (
                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold border border-slate-200/60 hidden sm:inline">
                  {patient.gender === 'Female' ? 'Ayol' : 'Erkak'}
                </span>
              )}
              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200/70 rounded-lg text-[10px] font-black uppercase tracking-wider hidden sm:inline">
                {patient.status === 'New' ? 'Yangi' : (patient.status || 'Faol')}
              </span>
            </div>
          </div>

          {/* Right: Quick Action Buttons (Matching Reference Design) */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="inline-flex p-0.5 bg-slate-100 rounded-xl border border-slate-200/70">
              <button type="button" onClick={() => setProfileViewMode('chairside')} className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide cursor-pointer text-slate-500 hover:text-slate-800">Chairside</button>
              <button type="button" onClick={() => setProfileViewMode('reyestr')} className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide cursor-pointer bg-white text-slate-900 shadow-sm">Reyestr</button>
            </div>

            <button
              onClick={openPayModal}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer whitespace-nowrap"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>To'lov</span>
            </button>
            <button
              onClick={() => setApptModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer whitespace-nowrap"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Uchrashuv</span>
            </button>
            <button
              onClick={() => setTreatmentModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer whitespace-nowrap"
              title="Yangi davolash rejasini ochish"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Yangi reja</span>
            </button>
            <button
              onClick={openAdvanceModal}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer whitespace-nowrap"
              title="Bemorga avans yoki depozit qabul qilish"
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>+ Avans</span>
            </button>
          </div>
        </div>
      </div>

      {/* ══ MAIN 2-COLUMN LAYOUT (EXACT REFERENCE DESIGN) ══ */}
      <div className="max-w-[1680px] mx-auto p-3 sm:p-5 lg:p-6 flex flex-col lg:flex-row gap-4 lg:gap-6 items-start">

        {/* ════ LEFT SIDEBAR: PATIENT CARD (Compact & Bold Style) ════ */}
        <div className="w-full lg:w-[250px] xl:w-[270px] shrink-0 flex flex-col gap-3 sticky top-[68px]">

          <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200/90 shadow-sm flex flex-col gap-3">
            {/* Top header row with title and code badge */}
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-slate-900">Bemor ma'lumotlari</span>
                <span className="px-1.5 py-0.5 bg-slate-100 text-slate-800 rounded text-[10px] font-mono font-black border border-slate-200/60">
                  #{String(id || '').slice(-4).toUpperCase() || '9870'}
                </span>
              </div>
              <button
                onClick={() => setPatientModalOpen(true)}
                className="p-1 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                title="Bemor ma'lumotlarini tahrirlash"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 1. Patient Avatar + Name + Info link */}
            <div className="flex flex-col items-center text-center pt-0.5">
              <div
                className="relative group cursor-pointer"
                onClick={() => { const inp = document.getElementById('avatar-upload-input'); if(inp) inp.click(); }}
                title="Profil rasmini o'zgartirish"
              >
                {patient.photo_url ? (
                  <img
                    src={patient.photo_url}
                    alt={patient.full_name}
                    className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-md ring-2 ring-slate-200/60"
                  />
                ) : (
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-black shadow-md border-2 border-white"
                    style={{ background: 'linear-gradient(135deg, #38bdf8 0%, #3b82f6 50%, #6366f1 100%)' }}
                  >
                    {getInitials(patient.full_name)}
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                  <Camera className="w-3.5 h-3.5" />
                </div>
              </div>
              <input id="avatar-upload-input" type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />

              <h2 className="text-sm sm:text-[15px] font-black text-slate-900 leading-snug mt-2 truncate max-w-full">{patient.full_name}</h2>

              <button
                onClick={() => setPatientModalOpen(true)}
                className="flex items-center justify-center gap-1 text-[10.5px] font-bold text-slate-500 hover:text-slate-800 transition-colors mt-0.5 cursor-pointer"
              >
                <Info className="w-3 h-3 text-slate-400" />
                <span>Ma'lumot</span>
              </button>
            </div>

            {/* 2. BALANS / QARZDORLIK / AVANS Card */}
            {totalDebt > 0 ? (
              <div className="bg-[#fee2e2]/70 border border-rose-300/80 rounded-xl p-2.5 text-center shadow-2xs">
                <div className="flex items-center justify-center gap-1.5">
                  <span className="text-[10px] font-black text-rose-600 uppercase tracking-wider">QARZDORLIK</span>
                  <button
                    onClick={generatePDF}
                    title="Qarzdorlik ma'lumotnomasini chop etish"
                    className="w-5 h-5 rounded bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <Printer className="w-3 h-3" />
                  </button>
                </div>
                <p className="text-lg font-black text-rose-600 font-mono mt-0.5 leading-tight">
                  {totalDebt.toLocaleString()} <span className="text-[11px] font-black">so'm</span>
                </p>
              </div>
            ) : totalPrepayment > 0 ? (
              <div className="bg-emerald-50/90 border border-emerald-300 rounded-xl p-2.5 text-center shadow-2xs">
                <div className="flex items-center justify-center gap-1.5">
                  <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wider">AVANS BALANSI</span>
                  <span className="px-1.5 py-0.2 bg-emerald-600 text-white rounded text-[8.5px] font-black uppercase tracking-wider">
                    Haqdor
                  </span>
                </div>
                <p className="text-lg font-black text-emerald-700 font-mono mt-0.5 leading-tight">
                  +{totalPrepayment.toLocaleString()} <span className="text-[11px] font-black">so'm</span>
                </p>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-center shadow-2xs">
                <div className="flex items-center justify-center gap-1.5">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">BALANS</span>
                </div>
                <p className="text-lg font-black text-slate-700 font-mono mt-0.5 leading-tight">
                  0 <span className="text-[11px] font-black">so'm</span>
                </p>
              </div>
            )}

            {/* 3. Patient Information List (Compact with Bold Text) */}
            <div className="space-y-1.5">
              {/* Tug'ilgan sana */}
              <div className="bg-[#f8fafc] border border-slate-200/90 rounded-xl p-2 flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 text-slate-700 shadow-2xs">
                  <Cake className="w-3.5 h-3.5 text-slate-700" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-black uppercase text-slate-500 leading-none">TUG'ILGAN SANA</p>
                  <p className="text-xs font-black text-slate-900 leading-snug mt-0.5 truncate">
                    {patient.birth_date || '—'} {age !== null ? `(${age} yosh)` : ''}
                  </p>
                </div>
              </div>

              {/* Telefon */}
              <div className="bg-[#f8fafc] border border-slate-200/90 rounded-xl p-2 flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 text-slate-700 shadow-2xs">
                  <Phone className="w-3.5 h-3.5 text-slate-700" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-black uppercase text-slate-500 leading-none">TELEFON</p>
                  <div className="flex items-center justify-between gap-1 mt-0.5">
                    <a
                      href={`tel:+${patient.phone ? patient.phone.replace(/\D/g, '') : ''}`}
                      className="text-xs font-black text-[#0e7490] hover:underline font-mono truncate"
                    >
                      {patient.phone ? formatPhone(patient.phone) : '—'}
                    </a>
                    {patient.phone && (
                      <button
                        onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(patient.phone); toast.success("Telefon raqami nusxalandi"); }}
                        className="p-0.5 text-slate-400 hover:text-slate-800 cursor-pointer"
                        title="Nusxalash"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Hisob */}
              <div className="bg-[#f8fafc] border border-slate-200/90 rounded-xl p-2 flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 text-slate-700 shadow-2xs">
                  <User className="w-3.5 h-3.5 text-slate-700" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-black uppercase text-slate-500 leading-none">HISOB</p>
                  <div className="flex items-center justify-between gap-1 mt-0.5">
                    <p className="text-xs font-black text-slate-900 truncate">
                      {patient.account_number || patient.full_name || patient.id}
                    </p>
                    <ExternalLink className="w-3 h-3 text-slate-500 shrink-0" />
                  </div>
                </div>
              </div>

              {/* Manzili */}
              <div className="bg-[#f8fafc] border border-slate-200/90 rounded-xl p-2 flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 text-slate-700 shadow-2xs">
                  <MapPin className="w-3.5 h-3.5 text-slate-700" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-black uppercase text-slate-500 leading-none">MANZILI</p>
                  <p className="text-xs font-black text-slate-900 leading-snug mt-0.5 truncate">
                    {patient.address || '—'}
                  </p>
                </div>
              </div>
            </div>

            {/* Secondary action — primary To'lov/Uchrashuv live in the top bar */}
            <button
              onClick={() => setTreatmentModalOpen(true)}
              className="w-full py-2 px-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded-xl shadow-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
              title="Yangi davolash rejasini ochish"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Yangi reja</span>
            </button>
          </div>

          {/* Paid amount card */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-2.5 sm:p-3 shadow-2xs flex items-center justify-between">
            <span className="text-[10.5px] font-black text-slate-600">Jami to'langan:</span>
            <span className="text-xs font-black text-emerald-700 font-mono">{totalPaid.toLocaleString()} so'm</span>
          </div>

        </div>

        {/* ════ RIGHT WORKSPACE: TABS & VIEWS ════ */}
        <div className="flex-1 min-w-0 w-full space-y-3.5">

          {/* ── 1. TOP SEARCH & FILTER BAR ── */}
          <div className="bg-white rounded-2xl p-2.5 sm:p-3 border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative min-w-[220px] max-w-md flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={toothSearchQuery}
                onChange={(e) => setToothSearchQuery(e.target.value)}
                placeholder="Tish yoki muolaja qidirish (#16, karies...)"
                className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
              {toothSearchQuery && (
                <button onClick={() => setToothSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer">✕</button>
              )}
            </div>

            {/* Right: View Mode Toggle (Xarita + Jadval / Faqat Jadval) */}
            {activeTab === 'info' && (
              <div className="inline-flex p-0.5 bg-slate-100 rounded-xl border border-slate-200/60 gap-0.5 shrink-0 self-end md:self-auto">
                <button
                  onClick={() => setDentalViewMode('both')}
                  className={cn("px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5", dentalViewMode === 'both' ? "bg-white text-slate-900 shadow-2xs font-black" : "text-slate-500 hover:text-slate-800")}
                >
                  <Tooth className="w-3.5 h-3.5 text-sky-600" />
                  <span>Xarita + Jadval</span>
                </button>
                <button
                  onClick={() => setDentalViewMode('table')}
                  className={cn("px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5", dentalViewMode === 'table' ? "bg-white text-slate-900 shadow-2xs font-black" : "text-slate-500 hover:text-slate-800")}
                >
                  <ClipboardList className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Faqat Jadval</span>
                </button>
              </div>
            )}
          </div>

          {/* ── 2. BO'LIMLAR (TABS) ROW - DIRECTLY UNDER SEARCH BAR ── */}
          <div className="bg-white rounded-2xl p-1.5 sm:p-2 border border-slate-200/90 shadow-xs flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {[
              { id: 'info',         label: "Tish xaritasi",      icon: Tooth,           iconColor: "text-sky-600" },
              { id: 'treatments',   label: "Davolash rejalari",  icon: ClipboardList,   iconColor: "text-indigo-600", count: (plans || []).length },
              { id: 'appointments', label: "Uchrashuvlar",       icon: Calendar,        iconColor: "text-blue-600", count: (appointments || []).length },
              { id: 'payments',     label: "To'lovlar",          icon: CreditCard,      iconColor: "text-emerald-600", count: (payments || []).filter(p => { const t = (p.type || 'Income').toLowerCase(); return t !== 'debt' && t !== 'discount' && !(p.notes || '').toLowerCase().includes('linked to plan'); }).length },
              { id: 'notes',        label: "Eslatmalar",         icon: FileText,        iconColor: "text-amber-600" },
              { id: 'implants',     label: "Implantlar",         icon: ImplantIcon,     iconColor: "text-purple-600", count: (implants || []).length },
              { id: 'photos',       label: "Rentgen & Rasmlar",  icon: XrayIcon,        iconColor: "text-cyan-600", count: (xrays || []).length },
            ].map(tabItem => {
              const IconComponent = tabItem.icon;
              const isActive = activeTab === tabItem.id;
              return (
                <button
                  key={tabItem.id}
                  onClick={() => setActiveTab(tabItem.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs transition-all cursor-pointer shrink-0 font-bold ${
                    isActive
                      ? 'bg-blue-50/80 text-blue-600 border-2 border-blue-500 shadow-xs ring-2 ring-blue-500/20 font-black'
                      : 'bg-white text-slate-700 border border-slate-200/90 hover:bg-slate-50 hover:text-slate-900 shadow-2xs'
                  }`}
                >
                  <IconComponent className={cn("w-3.5 h-3.5 shrink-0", isActive ? "text-blue-600" : "text-slate-400")} />
                  <span className="whitespace-nowrap">{tabItem.label}</span>
                  {tabItem.count !== undefined && tabItem.count > 0 && (
                    <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-black ${
                      isActive ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 border border-slate-200/60'
                    }`}>
                      {tabItem.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── TAB CONTENT & VIEWS ── */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="hidden" />

            <div className="min-w-0 space-y-4">

        {/* ══ 4. TO'LOVLAR & QARZ (EXCEL FINANCIAL LEDGER) ══ */}
        <TabsContent value="payments" className="outline-none space-y-4">
          {activeTab === 'payments' && (
            <ExcelPaymentsView
              patient={patient}
              payments={payments}
              plans={plans}
              doctors={doctors}
              totalPaid={totalPaid}
              totalDebt={totalDebt}
              onOpenPayModal={openPayModal}
              onOpenPlanInvoice={(plan) => setInvoiceModalPlan(plan)}
              onPayInstallment={handlePayInstallment}
              onDeletePayment={handleDeletePayment}
            />
          )}
        </TabsContent>
        {/* ══ 1. TISH XARITASI (EXCEL DENTAL CHART & FORMULA MATRIX) ══ */}
        <TabsContent value="info" className="outline-none space-y-4">
          {activeTab === 'info' && (
            <ExcelDentalChartView
              patient={patient}
              search={toothSearchQuery}
              setSearch={setToothSearchQuery}
              viewMode={dentalViewMode}
              setViewMode={setDentalViewMode}
              odontogramSelectedTeeth={odontogramSelectedTeeth}
              stableOnOdontogramChange={stableOnOdontogramChange}
              handleInfoToothClick={handleInfoToothClick}
              chartEditMode={chartEditMode}
              setChartEditMode={setChartEditMode}
              toothStatuses={toothStatuses}
              patientType={patientType}
              setPatientType={setPatientType}
              age={age}
              chartView={chartView}
              setChartView={setChartView}
              showOcclusal={showOcclusal}
              setShowOcclusal={setShowOcclusal}
              psrScores={psrScores}
              occlusionNotes={occlusionNotes}
              handleOcclusionNotesChange={handleOcclusionNotesChange}
              occlusionClass={occlusionClass}
              handleOcclusionClassChange={handleOcclusionClassChange}
              subSection={subSection}
              setSubSection={setSubSection}
              pendingToothEdits={pendingToothEdits}
              setPendingToothEdits={setPendingToothEdits}
              editSelectedTooth={editSelectedTooth}
              setEditSelectedTooth={setEditSelectedTooth}
              handleSaveChartEdits={handleSaveChartEdits}
              chartSaving={chartSaving}
              dentalFormulaSummaryList={dentalFormulaSummaryList}
              plans={plans}
            />
          )}
        </TabsContent>

        {/* ══ 2. DAVOLASH REJALARI (EXCEL TREATMENT PLANS SPREADSHEET) ══ */}
        <TabsContent value="treatments" className="outline-none space-y-4">
          {activeTab === 'treatments' && (
            <ExcelTreatmentsView
              patient={patient}
              plans={plans}
              doctors={doctors}
              totalPaid={totalPaid}
              totalDebt={totalDebt}
              onOpenTreatmentModal={() => setTreatmentModalOpen(true)}
              onOpenPayModal={openPayModal}
              onOpenPlanInvoice={(plan) => setInvoiceModalPlan(plan)}
              onPayInstallment={handlePayInstallment}
            />
          )}
        </TabsContent>

        {/* ══ 3. UCHRASHUVLAR (EXCEL SCHEDULE REGISTRY) ══ */}
        <TabsContent value="appointments" className="outline-none space-y-4">
          {activeTab === 'appointments' && (
            <ExcelAppointmentsView
              patient={patient}
              appointments={appointments}
              doctors={doctors}
              onOpenApptModal={() => setApptModalOpen(true)}
            />
          )}
        </TabsContent>

        {/* ══ 5. ESLATMALAR (EXCEL CLINICAL & MEDICAL NOTES) ══ */}
        <TabsContent value="notes" className="outline-none space-y-4">
          {activeTab === 'notes' && (
            <ExcelNotesView
              patient={patient}
              patientId={id}
            />
          )}
        </TabsContent>

        {/* ══ 6. IMPLANTLAR (EXCEL IMPLANT PASSPORT & SURGERY REGISTRY) ══ */}
        <TabsContent value="implants" className="outline-none space-y-4">
          {activeTab === 'implants' && (
            <ExcelImplantsView
              patient={patient}
              implants={implants}
            />
          )}
        </TabsContent>

        {/* ══ 7. RENTGEN & RASMLAR (EXCEL MEDIA & DIAGNOSTIC IMAGES CATALOG) ══ */}
        <TabsContent value="photos" className="outline-none space-y-4">
          {activeTab === 'photos' && (
            <ExcelPhotosView
              patient={patient}
              xrays={xrays}
              onPhotoUpload={handlePhotoUpload}
              onReload={load}
            />
          )}
        </TabsContent>

        <TabsContent value="xrays" className="outline-none">
          {activeTab === 'xrays' && <PatientXraysOdontogram patientId={id} />}
        </TabsContent>

            </div>
          </Tabs>
        </div>{/* end right workspace */}
      </div>{/* end main 2-column layout */}



      </>
      )}

      {/* Appointment quick modal */}
      <AppointmentModal
        open={apptModalOpen}
        onClose={() => setApptModalOpen(false)}
        appointment={null}
        patients={allPatients}
        services={services}
        allAppointments={appointments}
        prefillPatientId={id}
        prefillPatientName={patient?.full_name}
        prefillDoctorId={patient?.main_treatment_provider || ''}
        prefillDate=""
        prefillTime=""
        onSaved={load}
      />

      {/* Patient edit modal */}
      <PatientModal
        open={patientModalOpen}
        onClose={() => setPatientModalOpen(false)}
        patient={patient}
        onSaved={load}
      />

      {/* Tooth History Modal */}
      <Dialog open={historyModalOpen} onOpenChange={setHistoryModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-slate-900 flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-200">
                #{selectedTooth?.fdi}
              </div>
              Tish tarixi va holati
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-8 mt-4">
            {/* Treatments Section */}
            <section>
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-500" /> Bajarilgan xizmatlar ro'yxati
              </h4>
              <div className="space-y-4">
                {(() => {
                  const selectedFdi = String(selectedTooth?.fdi || '').trim();
                  
                  // Collect all services across all plans for this specific tooth
                  const servicesForThisTooth = [];
                  
                  plans.forEach(plan => {
                    const planServices = plan.services || [];
                    const planTooth = String(plan.tooth_number || '').trim();
                    
                    // Logic to find services belonging to this tooth
                    planServices.forEach(s => {
                      const serviceTooth = String(s.tooth_number || s.tooth_id || planTooth || '').trim();
                      if (serviceTooth === selectedFdi) {
                        servicesForThisTooth.push({
                          ...s,
                          planName: plan.name || plan.title,
                          planId: plan.id,
                          planStatus: plan.status,
                          planCreated: plan.created_date
                        });
                      }
                    });
                    
                    // Fallback: If plan has no services but belongs to this tooth
                    if (planServices.length === 0 && planTooth === selectedFdi) {
                       servicesForThisTooth.push({
                         service_name: plan.name || plan.title,
                         completed: plan.status === 'Completed',
                         status: plan.status,
                         planName: plan.name,
                         planId: plan.id,
                         planCreated: plan.created_date,
                         completion_date: plan.updated_at
                       });
                    }
                  });
                  
                  if (servicesForThisTooth.length === 0) return (
                    <div className="flex flex-col items-center justify-center py-10 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                      <Activity className="w-8 h-8 text-slate-300 mb-2" />
                      <p className="text-sm text-slate-400 font-bold">Muolajalar topilmadi</p>
                    </div>
                  );
                  
                  return servicesForThisTooth.map((svc, idx) => {
                    const isDone = svc.completed || svc.status === 'completed' || svc.planStatus === 'Completed';
                    const dateToUse = svc.completion_date || svc.planCreated;
                    
                    return (
                      <div key={`${svc.planId || idx}-${idx}`} className={`relative p-4 rounded-3xl border transition-all ${
                        isDone ? 'bg-emerald-50/30 border-emerald-100 shadow-sm shadow-emerald-50' : 'bg-white border-slate-100'
                      }`}>
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                              isDone ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'
                            }`}>
                              {isDone ? <CheckCircle2 className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
                            </div>
                            <div>
                              <p className={`text-sm font-black leading-tight ${isDone ? 'text-emerald-900' : 'text-slate-800'}`}>
                                {svc.service_name}
                              </p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                {svc.planName}
                              </p>
                            </div>
                          </div>
                          <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                            isDone ? 'bg-emerald-100 text-emerald-700' : 
                            svc.status === 'in_progress' ? 'bg-amber-100 text-amber-700' : 
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {isDone ? 'Bajarildi' : svc.status === 'in_progress' ? 'Jarayonda' : 'Reja'}
                          </span>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-slate-100/50">
                          {dateToUse && (
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 bg-white px-2 py-1 rounded-lg border border-slate-50 shadow-sm">
                              <span>🗓 {new Date(dateToUse).toLocaleDateString()}</span>
                              <span className="w-1 h-1 bg-slate-300 rounded-full" />
                              <span className="text-emerald-600">⏰ {new Date(dateToUse).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          )}
                          {svc.price && (
                            <div className="text-[10px] font-black text-slate-400">
                              💰 {svc.price.toLocaleString()} so'm
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </section>

            {/* Implants Section */}
            {implants.some(imp => (imp.tooth_numbers || [imp.tooth_number]).includes(selectedTooth?.fdi)) && (
              <section>
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Shield className="w-4 h-4" /> Implant ma'lumotlari
                </h4>
                {implants.filter(imp => (imp.tooth_numbers || [imp.tooth_number]).includes(selectedTooth?.fdi)).map(imp => (
                  <div key={imp.id} className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-indigo-900">{imp.firma} {imp.brend}</span>
                      <span className="text-[10px] font-black uppercase px-2 py-1 bg-indigo-600 text-white rounded-lg">Implant</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-indigo-700">
                      <div>Diametr: {imp.diameter || '—'}</div>
                      <div>Uzunlik: {imp.length || '—'}</div>
                      <div>Sana: {imp.placement_date || '—'}</div>
                      <div>Status: {imp.lifecycle_status || '—'}</div>
                    </div>
                  </div>
                ))}
              </section>
            )}

            {/* X-Rays Section */}
            <section>
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Image className="w-4 h-4" /> Rentgen suratlari
              </h4>
              <div className="grid grid-cols-2 gap-3">
                {(() => {
                  const toothXrays = xrays.filter(x => x.tooth_number === selectedTooth?.fdi);
                  if (toothXrays.length === 0) return <p className="text-sm text-slate-400 italic col-span-2">Rentgen suratlari topilmadi</p>;
                  return toothXrays.map(x => (
                    <div key={x.id} className="group relative rounded-2xl overflow-hidden border border-slate-100 shadow-sm aspect-square bg-slate-100">
                      <img src={x.image_url} alt="Tooth X-ray" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Button size="sm" variant="secondary" className="rounded-xl h-8 text-[10px] font-black" onClick={() => window.open(x.image_url, '_blank')}>
                          KATTALASHTIRISH
                        </Button>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
                        <p className="text-[9px] text-white font-bold">{x.date || x.created_date?.split('T')[0]}</p>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </section>

            {/* Notes/Records Section */}
            {toothRecords.some(r => r.tooth_number === selectedTooth?.fdi) && (
              <section>
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" /> Qo'shimcha qaydlar
                </h4>
                <div className="space-y-2">
                  {toothRecords.filter(r => r.tooth_number === selectedTooth?.fdi).map(r => (
                    <div key={r.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-600 italic">
                      {r.notes || r.treatment || r.condition}
                      <div className="mt-1 text-[9px] font-bold text-slate-400 not-italic">{r.created_date?.split('T')[0]}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Multi-Purpose Detail Modal */}
      <Dialog open={detailModal.open} onOpenChange={(o) => setDetailModal(prev => ({ ...prev, open: o }))}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden rounded-[3rem] border-none shadow-2xl bg-white max-h-[85vh] flex flex-col">
          <DialogHeader className="p-8 pb-4 bg-slate-50/50 border-b border-slate-100 shrink-0">
            <div className="flex items-center justify-center relative">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg bg-slate-900 text-white`}>
                  {detailModal.type === 'payments' && <DollarSign className="w-6 h-6" />}
                  {detailModal.type === 'debts' && <AlertTriangle className="w-6 h-6" />}
                  {detailModal.type === 'appointments' && <Calendar className="w-6 h-6" />}
                  {detailModal.type === 'implants' && <Shield className="w-6 h-6" />}
                  {detailModal.type === 'plans' && <ClipboardList className="w-6 h-6" />}
                  {detailModal.type === 'installments' && <Calendar className="w-6 h-6" />}
                </div>
                <div className="flex flex-col items-center">
                  <DialogTitle className="text-2xl font-[1000] text-slate-900 uppercase tracking-tight text-center">
                    {detailModal.title}
                  </DialogTitle>
                  {detailModal.type === 'installments' && patient?.full_name && (
                    <p className="mt-1 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">
                      {patient.full_name}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto p-8 no-scrollbar bg-slate-50/30">
            {detailModal.type === 'payments' && <PatientPayments payments={payments} />}
            {detailModal.type === 'debts' && (
              <div className="space-y-5">
                {/* Jami Qarzdorlik */}
                <div className="bg-rose-50 border border-rose-100 p-6 rounded-[2rem] flex items-center justify-between">
                   <div>
                     <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1">Jami qarzdorlik</p>
                     <p className="text-3xl font-[1000] text-rose-600">{totalDebt.toLocaleString()} <span className="text-sm font-bold opacity-60">so'm</span></p>
                   </div>
                   <div className="w-14 h-14 rounded-2xl bg-rose-100 flex items-center justify-center">
                      <AlertTriangle className="w-8 h-8 text-rose-500" />
                   </div>
                </div>

                {/* Moliyaviy tafsilot */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {/* To'langan */}
                  <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
                    <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-1">Jami to'langan</p>
                    <p className="text-lg font-black text-emerald-700">{totalPaid.toLocaleString()} <span className="text-[10px] font-bold text-emerald-400">so'm</span></p>
                  </div>

                  {/* Boshlang'ich to'lov (advance) */}
                  {(() => {
                    const advancePayments = (payments || []).filter(p =>
                      p.type?.toLowerCase() === 'income' &&
                      (p.category?.toLowerCase().includes("boshlang'ich") || p.category?.toLowerCase().includes('advance') || p.category?.toLowerCase().includes('oldindan'))
                    );
                    const advanceTotal = advancePayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
                    if (advanceTotal === 0) return null;
                    return (
                      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
                        <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest mb-1">Boshlang'ich to'lov</p>
                        <p className="text-lg font-black text-blue-700">{advanceTotal.toLocaleString()} <span className="text-[10px] font-bold text-blue-400">so'm</span></p>
                      </div>
                    );
                  })()}

                  {/* Chegirma */}
                  {totalDiscount > 0 && (
                    <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4">
                      <p className="text-[9px] font-black text-purple-500 uppercase tracking-widest mb-1">Chegirma</p>
                      <p className="text-lg font-black text-purple-700">{totalDiscount.toLocaleString()} <span className="text-[10px] font-bold text-purple-400">so'm</span></p>
                      {discountPercent > 0 && (
                        <p className="text-[9px] font-black text-purple-400 uppercase mt-0.5">-{discountPercent}% chegirma</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Reja ro'yxati */}
                <PatientTreatments 
                  plans={(plans || []).filter(p => (Number(p.total_price) || 0) - (Number(p.paid_amount) || 0) > 0)} 
                  discountAmount={totalDiscount}
                  discountPercent={discountPercent}
                  showRemainingAsPrimary
                />
              </div>
            )}
            {detailModal.type === 'appointments' && <PatientAppointments appointments={appointments} />}
            {detailModal.type === 'implants' && (
               <div className="space-y-4">
                  {implants.length === 0 ? <EmptyState icon={ImplantIcon} title="Implantlar yo'q" /> : (
                    implants.map(imp => (
                      <div key={imp.id} className="p-6 bg-white border border-slate-100 rounded-[2.5rem] flex items-center justify-between group hover:shadow-xl hover:-translate-y-1 transition-all">
                        <div className="flex items-center gap-6">
                          <div className="w-16 h-16 bg-slate-900 rounded-[1.5rem] flex items-center justify-center text-white font-black text-2xl shadow-lg group-hover:bg-indigo-600 transition-colors">
                             #{(() => {
                               const tns = imp.tooth_numbers;
                               if (Array.isArray(tns)) return tns.join(', ');
                               if (typeof tns === 'string') return tns;
                               return imp.tooth_number || '?';
                             })()}
                          </div>
                          <div>
                            <h4 className="font-black text-slate-900 text-xl uppercase tracking-tighter leading-none mb-2">{imp.firma || 'Noma\'lum'} {imp.brend || ''}</h4>
                            <div className="flex items-center gap-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                               <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4 text-blue-500" /> {imp.placement_date}</span>
                               <span className="w-1 h-1 bg-slate-200 rounded-full" />
                               <StatusBadge status={imp.lifecycle_status} />
                            </div>
                          </div>
                        </div>
                        <Link to={`/implants/${imp.id}`} onClick={() => setDetailModal({ ...detailModal, open: false })}>
                          <Button size="icon" variant="ghost" className="w-12 h-12 rounded-2xl bg-slate-50 hover:bg-slate-900 hover:text-white transition-all"><ArrowLeft className="w-6 h-6 rotate-180" /></Button>
                        </Link>
                      </div>
                    ))
                  )}
               </div>
            )}
            {detailModal.type === 'plans' && (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <Button onClick={() => setTreatmentModalOpen(true)} className="bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest h-10">
                    <Plus className="w-4 h-4 mr-2" /> Reja qo'shish
                  </Button>
                </div>
                <PatientTreatments plans={plans || []} />
              </div>
            )}
            {detailModal.type === 'installments' && (
              <div className="space-y-6">
                {installmentPlans.length === 0 ? (
                  <EmptyState title="Muddatli to'lovlar yo'q" description="Ushbu bemorda faol rassrochka rejalari topilmadi" />
                ) : (
                  installmentPlans.map(plan => {
                    const inst = plan.installment_plan;
                    const paidMonths = inst.paid_months || [];
                    
                    return (
                      <div key={plan.id} className="bg-white border border-slate-100 rounded-[2.5rem] p-6">
                         <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
                            <div className="flex items-center gap-4">
                               <div className="w-14 h-14 rounded-2xl bg-pink-50 flex items-center justify-center text-pink-500">
                                  <ClipboardList className="w-7 h-7" />
                               </div>
                               <div>
                                  <h4 className="text-sm font-black text-slate-800 tracking-tight uppercase leading-snug">{formatPlanName(plan.name)}</h4>
                                  <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mt-1">Jami: {plan.total_price?.toLocaleString()} so'm | {inst.months} oy</p>
                               </div>
                            </div>
                            <div className="flex items-center gap-6 bg-slate-50 px-6 py-4 rounded-3xl border border-slate-100">
                               <div className="text-center">
                                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Boshlang'ich</p>
                                  <p className="text-sm font-black text-slate-700">{inst.advance_payment?.toLocaleString()} so'm</p>
                               </div>
                               <div className="w-px h-8 bg-slate-200" />
                               <div className="text-center">
                                  <p className="text-[10px] font-black text-pink-400 uppercase tracking-widest mb-1">Oylik summa</p>
                                  <p className="text-sm font-black text-pink-600">{inst.monthly_amount?.toLocaleString()} so'm</p>
                               </div>
                            </div>
                         </div>

                         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {Array.from({ length: inst.months }).map((_, i) => {
                               const targetAmount = getInstallmentMonthTarget(plan, i);
                               const paidAmount = getInstallmentMonthPaid(plan, i);
                               const remainingAmount = getInstallmentMonthRemaining(plan, i);
                               const isPaid = remainingAmount <= 0 || paidMonths.includes(i);
                               const isPartial = paidAmount > 0 && !isPaid;
                               const date = new Date(inst.start_date || plan.created_date);
                               date.setMonth(date.getMonth() + i);
                               
                               return (
                                 <div
                                   key={i}
                                   role="button"
                                   tabIndex={0}
                                   onClick={() => (isPaid || isPartial ? openInstallmentHistoryModal(plan, i) : openInstallmentPaymentModal(plan, i))}
                                   onKeyDown={(e) => {
                                     if (e.key === 'Enter' || e.key === ' ') {
                                       e.preventDefault();
                                       (isPaid || isPartial ? openInstallmentHistoryModal(plan, i) : openInstallmentPaymentModal(plan, i));
                                     }
                                   }}
                                   className={`p-5 rounded-[1.75rem] border-2 transition-all flex flex-col justify-between min-h-[186px] cursor-pointer ${
                                   isPaid ? 'bg-emerald-50 border-emerald-100' : isPartial ? 'bg-amber-50/40 border-amber-200' : 'bg-slate-50/50 border-slate-100 hover:border-pink-100'
                                 }`}>
                                    <div className="flex justify-between items-start">
                                       <div className="flex flex-col">
                                          <span className={`text-[10px] font-black uppercase tracking-widest ${
                                            isPaid ? 'text-emerald-400' : isPartial ? 'text-amber-500' : 'text-slate-300'
                                          }`}>{i + 1}-oy</span>
                                          <span className="text-[11px] font-bold text-slate-500 uppercase">{date.toLocaleDateString('uz-UZ', { month: 'long', year: 'numeric' })}</span>
                                       </div>
                                       <div className={`px-2 py-1 rounded-full text-[9px] font-black uppercase ${
                                         isPaid ? 'bg-emerald-500 text-white' : isPartial ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                                       }`}>
                                         {isPaid ? "To'langan" : isPartial ? 'Qisman' : 'Kutilmoqda'}
                                       </div>
                                    </div>

                                    <div className="space-y-2 mt-4">
                                       <div className="flex items-center justify-between text-[11px] font-bold">
                                         <span className="text-slate-400">Oy summasi</span>
                                         <span className={isPaid ? 'text-emerald-600' : 'text-slate-800'}>{targetAmount.toLocaleString()} so'm</span>
                                       </div>
                                       <div className="flex items-center justify-between text-[11px] font-bold">
                                         <span className="text-slate-400">To'langan</span>
                                         <span className={paidAmount > 0 ? 'text-emerald-600' : 'text-slate-500'}>{paidAmount.toLocaleString()} so'm</span>
                                       </div>
                                       <div className="flex items-center justify-between text-[11px] font-bold">
                                         <span className="text-slate-400">Qolgan</span>
                                         <span className={remainingAmount > 0 ? 'text-rose-500' : 'text-emerald-600'}>{remainingAmount.toLocaleString()} so'm</span>
                                       </div>
                                    </div>

                                    <div className="flex items-end justify-between gap-4 mt-4">
                                       {isPaid ? (
                                         <span className="inline-flex items-center gap-1 text-emerald-600 text-sm font-black">
                                           <CheckCircle2 className="w-4 h-4" /> Yopilgan
                                         </span>
                                       ) : (
                                         <span className="text-[10px] font-black tracking-tight text-slate-500">
                                           {isPartial ? "Qolganini to'lashingiz mumkin" : "Summa kiriting va to'lang"}
                                         </span>
                                       )}
                                       {!isPaid && (
                                         <Button 
                                           onClick={(e) => { e.stopPropagation(); handlePayInstallment(plan, i); }}
                                           size="sm" 
                                           className="h-9 px-4 rounded-xl bg-pink-500 hover:bg-pink-600 text-white font-black uppercase text-[10px] tracking-tight shadow-lg shadow-pink-500/20 border-none"
                                         >
                                           To'lash
                                         </Button>
                                       )}
                                    </div>
                                 </div>
                               );
                            })}
                         </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={installmentPaymentModal.open} onOpenChange={(open) => !open && resetInstallmentPaymentModal()}>
        <DialogContent className="sm:max-w-lg rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-pink-500 px-6 py-5 text-white">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                Muddatli to'lovni kiritish
              </DialogTitle>
            </DialogHeader>
            {(() => {
              const selectedPlan = installmentPlans.find(p => p.id === installmentPaymentModal.planId);
              if (!selectedPlan || installmentPaymentModal.monthIndex == null) return null;

              return (
                <p className="text-[11px] font-black text-pink-100 uppercase tracking-[0.2em] mt-1">
                  {selectedPlan.name} | {Number(installmentPaymentModal.monthIndex) + 1}-oy
                </p>
              );
            })()}
          </div>

          <div className="p-6 space-y-5 bg-white">
            {(() => {
              const selectedPlan = installmentPlans.find(p => p.id === installmentPaymentModal.planId);
              if (!selectedPlan || installmentPaymentModal.monthIndex == null) return null;

              const targetAmount = getInstallmentMonthTarget(selectedPlan, installmentPaymentModal.monthIndex);
              const paidAmount = getInstallmentMonthPaid(selectedPlan, installmentPaymentModal.monthIndex);
              const remainingAmount = getInstallmentMonthRemaining(selectedPlan, installmentPaymentModal.monthIndex);

              return (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Oy summasi</p>
                      <p className="mt-2 text-sm font-black text-slate-900">{targetAmount.toLocaleString()} so'm</p>
                    </div>
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                      <p className="text-[9px] font-black uppercase tracking-widest text-emerald-500">To'langan</p>
                      <p className="mt-2 text-sm font-black text-emerald-700">{paidAmount.toLocaleString()} so'm</p>
                    </div>
                    <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4">
                      <p className="text-[9px] font-black uppercase tracking-widest text-rose-400">Qolgan</p>
                      <p className="mt-2 text-sm font-black text-rose-600">{remainingAmount.toLocaleString()} so'm</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">To'lov summasi</Label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={installmentPaymentModal.amount === '' || installmentPaymentModal.amount === 0 ? '' : Number(installmentPaymentModal.amount).toLocaleString('uz-UZ')}
                        onChange={e => {
                          const raw = e.target.value.replace(/\s/g, '').replace(/,/g, '').replace(/\./g, '').replace(/'/g, '');
                          if (raw === '') setInstallmentPaymentModal(prev => ({ ...prev, amount: '' }));
                          else if (/^\d+$/.test(raw)) setInstallmentPaymentModal(prev => ({ ...prev, amount: Number(raw) }));
                        }}
                        onKeyDown={e => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault(); }}
                        onWheel={e => e.target.blur()}
                        className="w-full h-14 rounded-2xl border border-slate-100 bg-slate-50 font-black text-xl text-slate-900 px-4 outline-none focus:ring-2 focus:ring-pink-200"
                        placeholder="Summani kiriting"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">To'lov usuli</Label>
                      <Select
                        value={installmentPaymentModal.method}
                        onValueChange={value => setInstallmentPaymentModal(prev => ({ ...prev, method: value }))}
                      >
                        <SelectTrigger className="h-14 rounded-2xl border-slate-100 bg-slate-50 font-bold">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-slate-100">
                          <SelectItem value="Cash" className="font-bold">Naqd</SelectItem>
                          <SelectItem value="Card" className="font-bold">Plastik</SelectItem>
                          <SelectItem value="Transfer" className="font-bold">O'tkazma</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Mas'ul Shifokor</Label>
                      <Select
                        value={installmentPaymentModal.doctor_id}
                        onValueChange={value => setInstallmentPaymentModal(prev => ({ ...prev, doctor_id: value }))}
                      >
                        <SelectTrigger className="h-12 rounded-2xl border-slate-100 bg-slate-50 font-bold">
                          <SelectValue placeholder="Shifokorni tanlang" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-slate-100">
                          {doctors.map(d => (
                            <SelectItem key={d.id} value={d.id} className="font-bold">
                              {d.name || d.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">To'lov sanasi</Label>
                      <Input
                        type="datetime-local"
                        value={installmentPaymentModal.date}
                        onChange={e => setInstallmentPaymentModal(prev => ({ ...prev, date: e.target.value }))}
                        className="h-12 rounded-2xl border-slate-100 bg-slate-50 font-bold"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Izoh</Label>
                    <Textarea
                      value={installmentPaymentModal.notes}
                      onChange={e => setInstallmentPaymentModal(prev => ({ ...prev, notes: e.target.value }))}
                      className="rounded-2xl border-slate-100 bg-slate-50 font-medium min-h-[90px]"
                      placeholder="Masalan: 1-oy uchun qisman to'lov"
                    />
                  </div>

                  <DialogFooter className="flex-row gap-3 pt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      className="flex-1 h-12 rounded-2xl font-bold text-slate-400"
                      onClick={resetInstallmentPaymentModal}
                    >
                      Bekor qilish
                    </Button>
                    <Button
                      type="button"
                      className="flex-1 h-12 rounded-2xl bg-pink-500 hover:bg-pink-600 text-white font-black"
                      onClick={handleSaveInstallmentPayment}
                      disabled={installmentSaving}
                    >
                      {installmentSaving ? "Saqlanmoqda..." : "To'lovni saqlash"}
                    </Button>
                  </DialogFooter>
                </>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={installmentHistoryModal.open} onOpenChange={(open) => !open && resetInstallmentHistoryModal()}>
        <DialogContent className="sm:max-w-2xl rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
          {(() => {
            const selectedPlan = installmentPlans.find(p => p.id === installmentHistoryModal.planId);
            const monthIndex = installmentHistoryModal.monthIndex;
            if (!selectedPlan || monthIndex == null) return null;

            const inst = selectedPlan.installment_plan || {};
            const targetAmount = getInstallmentMonthTarget(selectedPlan, monthIndex);
            const paidAmount = getInstallmentMonthPaid(selectedPlan, monthIndex);
            const remainingAmount = getInstallmentMonthRemaining(selectedPlan, monthIndex);
            const paidMonths = Array.isArray(inst.paid_months) ? inst.paid_months : [];
            const isPaid = remainingAmount <= 0 || paidMonths.includes(monthIndex);

            const monthLabel = `${Number(monthIndex) + 1}-oy`;
            const partialPaymentsRaw = Array.isArray(inst.partial_payments) ? inst.partial_payments : [];
            const partialPayments = partialPaymentsRaw
              .filter(p => Number(p.month_index) === Number(monthIndex))
              .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

            const methodLabel = (m) => {
              if (m === 'Card') return 'Plastik';
              if (m === 'Transfer') return "O'tkazma";
              if (m === 'Cash') return 'Naqd';
              return m || '—';
            };

            return (
              <>
                <div className="bg-slate-900 px-6 py-5 text-white">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-black tracking-tight">
                      Muddatli to'lov tafsilotlari
                    </DialogTitle>
                  </DialogHeader>
                  <p className="text-[11px] font-black text-white/60 uppercase tracking-[0.2em] mt-1">
                    {selectedPlan.name} | {monthLabel}
                  </p>
                </div>

                <div className="p-6 space-y-6 bg-white max-h-[75vh] overflow-y-auto no-scrollbar">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Oy summasi</p>
                      <p className="mt-2 text-sm font-black text-slate-900">{targetAmount.toLocaleString()} so'm</p>
                    </div>
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                      <p className="text-[9px] font-black uppercase tracking-widest text-emerald-500">To'langan</p>
                      <p className="mt-2 text-sm font-black text-emerald-700">{paidAmount.toLocaleString()} so'm</p>
                    </div>
                    <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4">
                      <p className="text-[9px] font-black uppercase tracking-widest text-rose-400">Qolgan</p>
                      <p className="mt-2 text-sm font-black text-rose-600">{remainingAmount.toLocaleString()} so'm</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      isPaid ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : paidAmount > 0 ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-slate-50 text-slate-500 border border-slate-100'
                    }`}>
                      {isPaid ? "To'langan" : paidAmount > 0 ? 'Qisman to‘langan' : 'To‘lanmagan'}
                    </div>

                    {remainingAmount > 0 && (
                      <Button
                        type="button"
                        className="h-10 rounded-xl bg-pink-500 hover:bg-pink-600 text-white font-black uppercase text-[10px] tracking-tight border-none"
                        onClick={() => {
                          resetInstallmentHistoryModal();
                          openInstallmentPaymentModal(selectedPlan, monthIndex);
                        }}
                      >
                        Yana to'lash
                      </Button>
                    )}
                  </div>

                  <div className="space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      To'lovlar tarixi
                    </p>

                    {partialPayments.length === 0 ? (
                      <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 text-sm text-slate-500 font-bold">
                        {isPaid
                          ? "Ushbu oy to'langan. (Eski to'lov bo'lishi mumkin, batafsil tarix yo'q)"
                          : "Hali to'lov qilinmagan"}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {partialPayments.map((p, idx) => {
                          const docName = doctors.find(d => d.id === p.doctor_id)?.name || doctors.find(d => d.id === p.doctor_id)?.full_name || '—';
                          return (
                            <div key={idx} className="p-4 rounded-2xl bg-white border border-slate-100">
                              <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                  <p className="text-[11px] font-black text-slate-900">
                                    {Number(p.amount || 0).toLocaleString()} so'm
                                  </p>
                                  <p className="text-[10px] font-bold text-slate-500 mt-1">
                                    {formatDateTimeUz(p.date)}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-[10px] font-black text-slate-700">
                                    {methodLabel(p.method)}
                                  </p>
                                  <p className="text-[9px] font-bold text-slate-400 mt-1">
                                    Shifokor: {docName}
                                  </p>
                                </div>
                              </div>
                              {p.note && (
                                <div className="mt-3 text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-100 rounded-xl p-3">
                                  {p.note}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-5 bg-slate-50/50 border-t border-slate-100">
                  <DialogFooter className="flex-row gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 h-12 rounded-2xl border-slate-200 font-black"
                      onClick={resetInstallmentHistoryModal}
                    >
                      Yopish
                    </Button>
                  </DialogFooter>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={payModalOpen} onOpenChange={setPayModalOpen}>
        <DialogContent className="w-[92%] sm:max-w-md rounded-2xl sm:rounded-3xl p-0 overflow-hidden border-none shadow-2xl max-h-[88vh] flex flex-col">
          {(() => {
            const currentType = payForm.type || 'Income';
            const headerBg = currentType === 'Income' ? 'bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600' :
                             currentType === 'Discount' ? 'bg-gradient-to-r from-purple-500 via-purple-600 to-indigo-600' :
                             currentType === 'Refund' ? 'bg-gradient-to-r from-rose-500 via-rose-600 to-red-600' :
                             'bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600';
            
            const HeaderIcon = currentType === 'Income' ? Wallet :
                               currentType === 'Discount' ? ClipboardList :
                               currentType === 'Refund' ? XCircle :
                               AlertTriangle;

            return (
              <>
                <div className={`${headerBg} px-4 py-3 flex items-center justify-between shrink-0 transition-colors duration-300`}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-white backdrop-blur-sm shadow-xs">
                      <HeaderIcon className="w-4 h-4 stroke-[2.5]" />
                    </div>
                    <div>
                      <DialogTitle asChild>
                        <h3 className="text-sm font-black text-white uppercase tracking-tight leading-tight">To'lov qo'shish</h3>
                      </DialogTitle>
                      <p className="text-[9.5px] font-bold text-white/80 uppercase tracking-widest mt-0.5">{patient.full_name}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setPayModalOpen(false)} 
                    className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-sm transition-all active:scale-95 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-4 space-y-3 bg-white flex-1 overflow-y-auto no-scrollbar">
                  
                  {/* Fintech Summa Input */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-[9.5px] font-black uppercase tracking-widest text-slate-400 ml-1">To'lov summasi</Label>
                      {totalDebt > 0 && (
                        <span className="text-[10px] font-extrabold text-rose-500">
                          Qarz: {totalDebt.toLocaleString()} so'm
                        </span>
                      )}
                    </div>
                    <div className="relative flex items-center justify-center bg-slate-50 rounded-xl border border-slate-200/80 px-4 py-2 shadow-inner focus-within:border-emerald-500 focus-within:bg-white transition-colors">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={payForm.amount === '' || payForm.amount === 0 ? '' : Number(payForm.amount).toLocaleString('uz-UZ')}
                        onChange={e => {
                          const raw = e.target.value.replace(/\s/g, '').replace(/,/g, '').replace(/\./g, '').replace(/'/g, '');
                          if (raw === '') setPayForm({ ...payForm, amount: 0 });
                          else if (/^\d+$/.test(raw)) setPayForm({ ...payForm, amount: Number(raw) });
                        }}
                        onKeyDown={e => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault(); }}
                        onWheel={e => e.target.blur()}
                        placeholder="0"
                        className="w-full text-center bg-transparent text-2xl font-[900] text-slate-900 outline-none placeholder-slate-300"
                      />
                      <span className="absolute right-4 text-[10.5px] font-black text-slate-400 uppercase tracking-wider pointer-events-none">so'm</span>
                    </div>
                    
                    {/* Sum shortcuts */}
                    <div className="flex flex-wrap items-center justify-center gap-1 pt-0.5">
                      {[50000, 100000, 500000, 1000000].map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setPayForm(prev => ({ ...prev, amount: (Number(prev.amount) || 0) + val }))}
                          className="px-2 py-0.5 rounded-lg bg-slate-50 border border-slate-200/80 hover:bg-slate-100 text-[9.5px] font-bold text-slate-600 transition-all active:scale-95 shadow-2xs cursor-pointer"
                        >
                          +{val >= 1000000 ? `${val / 1000000}M` : `${val / 1000}k`}
                        </button>
                      ))}
                      {totalDebt > 0 && (
                        <button
                          type="button"
                          onClick={() => setPayForm({ ...payForm, amount: totalDebt })}
                          className="px-2 py-0.5 rounded-lg bg-rose-50 border border-rose-200/80 hover:bg-rose-100 text-[9.5px] font-black text-rose-700 transition-all active:scale-95 shadow-2xs cursor-pointer"
                        >
                          To'liq qarz ({totalDebt.toLocaleString()})
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setPayForm({ ...payForm, amount: 0 })}
                        className="px-2 py-0.5 rounded-lg bg-slate-100 border border-slate-200 hover:bg-slate-200 text-[9.5px] font-bold text-slate-500 transition-all active:scale-95 shadow-2xs cursor-pointer"
                      >
                        Tozalash
                      </button>
                    </div>
                  </div>

                  {/* To'lov usuli (Cards UI) */}
                  <div className="space-y-1">
                    <Label className="text-[9.5px] font-black uppercase tracking-widest text-slate-400 ml-1">To'lov usuli</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: 'Cash', label: 'Naqd', icon: Wallet },
                        { value: 'Card', label: 'Plastik', icon: CreditCard }
                      ].map(m => {
                        const isActive = payForm.method === m.value;
                        const Icon = m.icon;
                        return (
                          <button
                            key={m.value}
                            type="button"
                            onClick={() => setPayForm({ ...payForm, method: m.value })}
                            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border transition-all text-center relative cursor-pointer ${
                              isActive 
                                ? 'border-slate-900 bg-slate-900 text-white shadow-xs' 
                                : 'border-slate-200/80 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:border-slate-300'
                            }`}
                          >
                            <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                            <span className="text-xs font-black tracking-tight">{m.label}</span>
                            {isActive && (
                              <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 ml-1">
                                <Check className="w-2 h-2 stroke-[4]" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Mas'ul shifokor va Sana */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <Label className="text-[9.5px] font-black uppercase tracking-widest text-slate-400 ml-1">Mas'ul Shifokor</Label>
                      <Select value={payForm.doctor_id ? String(payForm.doctor_id) : ''} onValueChange={v => setPayForm({ ...payForm, doctor_id: v })}>
                        <SelectTrigger className="h-9 rounded-xl border-slate-200 bg-slate-50 text-xs font-bold focus:bg-white"><SelectValue placeholder="Shifokor tanlang" /></SelectTrigger>
                        <SelectContent className="rounded-xl border-slate-100">
                          {doctors.map(d => (
                            <SelectItem key={d.id} value={String(d.id)} className="rounded-lg font-bold text-xs">{d.name || d.full_name}</SelectItem>
                          ))}
                          {payForm.doctor_id && !doctors.some(d => String(d.id) === String(payForm.doctor_id)) && (
                            <SelectItem value={String(payForm.doctor_id)} className="rounded-lg font-bold text-xs">
                              {doctors.find(d => (d.name || d.full_name) === payForm.doctor_id)?.name || payForm.doctor_id}
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[9.5px] font-black uppercase tracking-widest text-slate-400 ml-1">To'lov sanasi</Label>
                      <Input type="datetime-local" value={payForm.date} onChange={e => setPayForm({ ...payForm, date: e.target.value })} className="h-9 rounded-xl border-slate-200 bg-slate-50 text-xs font-bold focus:bg-white" />
                    </div>
                  </div>

                  {/* Davolash rejalari */}
                  {plans && plans.length > 0 && (
                    <div className="space-y-1">
                      <Label className="text-[9.5px] font-black uppercase tracking-widest text-slate-400 ml-1">Davolash rejasi</Label>
                      <div className="flex flex-col gap-1.5 max-h-28 overflow-y-auto pr-0.5">
                        {plans.map(plan => {
                          const paid = Number(plan.paid_amount) || 0;
                          const total = Number(plan.total_price) || 0;
                          const remaining = Math.max(0, total - paid);
                          
                          return (
                            <div key={plan.id} className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/60 p-2 shadow-2xs">
                              <div className="min-w-0 flex-1 mr-2">
                                <p className="text-xs font-black text-slate-800 truncate leading-tight">{plan.name || 'Davolash rejasi'}</p>
                                <p className="text-[9.5px] text-slate-500 font-bold mt-0.5">
                                  Qarz: <span className={remaining > 0 ? 'text-rose-600 font-black' : 'text-emerald-600 font-black'}>{remaining.toLocaleString()} so'm</span>
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setInvoiceModalPlan(plan)}
                                className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 border border-blue-100 text-blue-600 text-[8.5px] font-black uppercase hover:bg-blue-100 active:scale-95 transition-all cursor-pointer"
                              >
                                Faktura
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Izoh */}
                  <div className="space-y-1">
                    <Label className="text-[9.5px] font-black uppercase tracking-widest text-slate-400 ml-1">Izoh (ixtiyoriy)</Label>
                    <Input value={payForm.notes} onChange={e => setPayForm({ ...payForm, notes: e.target.value })} className="h-8 rounded-xl border-slate-200 bg-slate-50 text-xs focus:bg-white" placeholder="Qo'shimcha ma'lumot..." />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-1 shrink-0">
                    <Button onClick={() => setPayModalOpen(false)} variant="ghost" className="flex-1 h-9 rounded-xl font-black uppercase text-[10px] tracking-wider text-slate-400 hover:bg-slate-100 cursor-pointer">Bekor qilish</Button>
                    <Button 
                      onClick={handleSavePay} 
                      disabled={payingSaving || !payForm.amount} 
                      className="flex-1 h-9 rounded-xl bg-slate-950 hover:bg-slate-900 text-white font-black uppercase text-[11px] tracking-wider border-none shadow-md cursor-pointer transition-all active:scale-98"
                    >
                      {payingSaving ? "Saqlanmoqda..." : "To'lovni saqlash"}
                    </Button>
                  </div>

                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Hisob-faktura Modal */}
      {invoiceModalPlan && (
        <TreatmentPlanInvoice
          open={!!invoiceModalPlan}
          onClose={() => setInvoiceModalPlan(null)}
          plan={invoiceModalPlan}
        />
      )}

      {/* Local FAB - Contextual Add Button for BClinic Mobile */}
      <div className="fixed bottom-24 right-5 z-40 lg:hidden">
        {/* local actions popup speed dial */}
        <AnimatePresence>
          {showLocalActions && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowLocalActions(false)}
                className="fixed inset-0 bg-black/40 backdrop-blur-[2px] -z-10"
              />
              
              {/* Actions list */}
              <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 30, scale: 0.9 }}
                className="absolute bottom-[4.5rem] right-0 flex flex-col gap-2.5 items-end min-w-max"
              >
                {[
                  { label: "Uchrashuv belgilash", icon: Calendar, color: 'from-[#ff6d00] to-[#e65100]', onClick: () => { setApptModalOpen(true); setShowLocalActions(false); } },
                  { label: "To'lov qabul qilish", icon: DollarSign, color: 'from-emerald-500 to-teal-600', onClick: () => { openPayModal(); setShowLocalActions(false); } },
                  { label: "Eslatma yozish", icon: MessageSquare, color: 'from-amber-500 to-orange-600', onClick: () => { setNoteModalOpen(true); setShowLocalActions(false); } },
                  { label: "Davolash rejasi", icon: Activity, color: 'from-[#1499AD] to-[#0E7A8A]', onClick: () => { setTreatmentModalOpen(true); setShowLocalActions(false); } },
                ].map((item, idx) => {
                  const IconComp = item.icon;
                  return (
                    <motion.button
                      key={idx}
                      whileTap={{ scale: 0.95 }}
                      onClick={item.onClick}
                      className="flex items-center gap-2.5 bg-white border border-slate-100 pl-3.5 pr-2 py-1.5 rounded-2xl shadow-xl active:scale-95 cursor-pointer"
                    >
                      <span className="text-[10px] font-black text-slate-700 tracking-tight uppercase">{item.label}</span>
                      <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center text-white shadow-md`}>
                        <IconComp className="w-4 h-4 text-white" />
                      </div>
                    </motion.button>
                  );
                })}
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Circular FAB Button */}
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => setShowLocalActions(!showLocalActions)}
          className="bg-gradient-to-br from-[#1499AD] to-[#0E7A8A] rounded-full shadow-xl shadow-[#1499AD]/40 flex items-center justify-center text-white border-[3px] border-white z-50 relative cursor-pointer"
          style={{ width: 52, height: 52 }}
        >
          <motion.div
            animate={{ rotate: showLocalActions ? 45 : 0 }}
            transition={{ duration: 0.2 }}
            className="flex items-center justify-center"
          >
            <Plus className="w-6 h-6 text-white stroke-[2.5]" />
          </motion.div>
        </motion.button>
      </div>

      <TreatmentPlanModal 
        open={treatmentModalOpen} 
        onClose={() => setTreatmentModalOpen(false)} 
        plan={null} 
        patients={[patient]} 
        services={services} 
        onSaved={load}
        initialPatientId={id}
      />

      <ImplantForm 
        open={implantModalOpen} 
        onClose={() => setImplantModalOpen(false)} 
        patients={[patient]} 
        services={services} 
        onSaved={load} 
      />

      <Dialog open={noteModalOpen} onOpenChange={setNoteModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md max-h-[90vh] p-6 rounded-[2.5rem] border-none shadow-2xl flex flex-col overflow-visible">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight">Eslatma qo'shish</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4 overflow-y-auto max-h-[60vh] pb-2 no-scrollbar">
            <Textarea 
              value={newNoteContent}
              onChange={e => setNewNoteContent(e.target.value)}
              placeholder="Bemor uchun eslatmani kiriting..."
              className="min-h-[120px] rounded-2xl border-slate-100 bg-slate-50 font-medium text-xs px-4"
            />
            <div className="flex gap-3 pt-2">
              <Button variant="ghost" className="flex-1 h-12 rounded-2xl font-bold text-slate-400" onClick={() => setNoteModalOpen(false)}>Bekor qilish</Button>
              <Button 
                onClick={handleSaveNote} 
                disabled={noteSaving || !newNoteContent.trim()} 
                className="flex-1 h-12 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black uppercase tracking-widest border-none"
              >
                {noteSaving ? 'Saqlanmoqda...' : 'Saqlash'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={manualLogModalOpen} onOpenChange={setManualLogModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md max-h-[90vh] p-6 rounded-[2.5rem] border-none shadow-2xl flex flex-col overflow-visible">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight">Muolaja / Tarix qo'shish</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4 overflow-y-auto max-h-[60vh] pb-2 no-scrollbar">
            <div className="space-y-2">
               <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Muolaja, holat yoki tashxis tafsilotlari</Label>
               <Textarea 
                 value={manualLog.content}
                 onChange={e => setManualLog(prev => ({ ...prev, content: e.target.value }))}
                 placeholder="Muolajani yozing (masalan, 36-tish kariesi davolandi, plomba qo'yildi)..."
                 className="min-h-[100px] rounded-2xl border-slate-100 bg-slate-50 font-medium text-xs px-4"
               />
            </div>
            
            <div className="space-y-2">
               <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mas'ul Shifokor</Label>
               <select
                 value={manualLog.doctor}
                 onChange={e => setManualLog(prev => ({ ...prev, doctor: e.target.value }))}
                 className="h-12 w-full text-xs rounded-xl border border-slate-200 bg-slate-50 px-3 focus:outline-none cursor-pointer font-bold"
               >
                 {doctors.map(d => (
                   <option key={d.id} value={d.name}>{d.name}</option>
                 ))}
                 {doctors.length === 0 && <option value="Navbatchi shifokor">Navbatchi shifokor</option>}
               </select>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="ghost" className="flex-1 h-12 rounded-2xl font-bold text-slate-400 border-none" onClick={() => setManualLogModalOpen(false)}>Bekor qilish</Button>
              <Button 
                onClick={addManualLogItem} 
                disabled={!manualLog.content.trim()} 
                className="flex-1 h-12 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black uppercase tracking-widest border-none"
              >
                Qo'shish
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      </div>{/* end print:hidden */}

      {/* Printable 043/u Card */}
      <div className="hidden print:block font-serif text-black p-8 bg-white text-[13px] leading-relaxed w-full" id="printable-card-043">
        <div className="text-center space-y-1 mb-6">
          <h2 className="text-sm font-bold tracking-wider uppercase">O'zbekiston Respublikasi Sog'liqni Saqlash Vazirligi</h2>
          <h1 className="text-lg font-bold tracking-wide uppercase">Stomatologik Bemorning Tibbiy Kartasi (Shakl 043/u)</h1>
          <p className="text-xs text-slate-500 italic mt-1">Bemor id: #{id}</p>
        </div>

        {/* Passport details table */}
        <div className="border border-black mb-6">
          <div className="grid grid-cols-2 border-b border-black divide-x divide-black p-2 font-bold bg-slate-50">
            <div>Bemor ma'lumotlari</div>
            <div>Elektron ro'yxatdan o'tish</div>
          </div>
          <div className="grid grid-cols-2 divide-x divide-black">
            <div className="p-2 space-y-1">
              <div><strong>F.I.SH.:</strong> {card043Data.passport.full_name || '—'}</div>
              <div><strong>Tug'ilgan yili:</strong> {card043Data.passport.birth_year || '—'}</div>
              <div><strong>Telefon:</strong> {patient?.phone || '—'}</div>
            </div>
            <div className="p-2 space-y-1">
              <div><strong>Yashash manzili:</strong> {card043Data.passport.address || '—'}</div>
              <div><strong>Kasbi / Ish joyi:</strong> {card043Data.passport.occupation || '—'}</div>
              <div><strong>Sanasi:</strong> {new Date().toLocaleDateString('uz-UZ')}</div>
            </div>
          </div>
        </div>

        {/* Diagnoses details */}
        <div className="space-y-4 mb-6">
          <div className="border border-black p-3">
            <h3 className="font-bold border-b border-black pb-1 mb-2 uppercase text-xs">Shikoyatlari</h3>
            <p className="whitespace-pre-line">{card043Data.diagnoses.complaints || 'Shikoyat kiritilmagan.'}</p>
          </div>
          <div className="border border-black p-3">
            <h3 className="font-bold border-b border-black pb-1 mb-2 uppercase text-xs">O'tkazgan kasalliklari (Anamnez)</h3>
            <p className="whitespace-pre-line">{card043Data.diagnoses.past_illnesses || 'Anamnez kiritilmagan.'}</p>
          </div>
          <div className="border border-black p-3">
            <h3 className="font-bold border-b border-black pb-1 mb-2 uppercase text-xs">Obyektiv tekshiruv ma'lumotlari</h3>
            <p className="whitespace-pre-line">{card043Data.diagnoses.objective_exam || 'Tekshiruv kiritilmagan.'}</p>
          </div>
          <div className="border border-black p-3">
            <h3 className="font-bold border-b border-black pb-1 mb-2 uppercase text-xs">Rentgen va laboratoriya xulosalari</h3>
            <p className="whitespace-pre-line">{card043Data.diagnoses.xray_lab || 'Xulosa kiritilmagan.'}</p>
          </div>
        </div>

        {/* Initial Dental Formula */}
        <div className="border border-black p-4 mb-6">
          <h3 className="font-bold border-b border-black pb-1 mb-3 uppercase text-xs text-center">Boshlang'ich stomatologik formula</h3>
          
          <div className="flex flex-col gap-3 max-w-lg mx-auto">
            {/* Upper Jaw row */}
            <div className="flex justify-between border-b border-dashed border-black pb-2 text-center">
              {upperTeethFdi.map(fdi => (
                <div key={fdi} className="text-[10px]">
                  <div className="font-bold">{fdi}</div>
                  <div className="font-black text-rose-600 h-4">{card043Data.toothStatus[fdi] || 'N'}</div>
                </div>
              ))}
            </div>
            {/* Lower Jaw row */}
            <div className="flex justify-between text-center pt-1">
              {lowerTeethFdi.map(fdi => (
                <div key={fdi} className="text-[10px]">
                  <div className="font-black text-rose-600 h-4">{card043Data.toothStatus[fdi] || 'N'}</div>
                  <div className="font-bold">{fdi}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="text-[10px] text-slate-500 mt-4 text-center">
            Qisqartmalar: C - karies, P - pulpit, A - yo'q, R - ildiz, F - plomba, K - koronka, N - norma
          </div>
        </div>

        {/* Treatment log table */}
        <div className="border border-black">
          <div className="p-2 font-bold uppercase text-xs bg-slate-50 border-b border-black text-center">Davolash kundaligi / Tarix</div>
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-black divide-x divide-black bg-slate-100 font-bold">
                <th className="p-2 w-28">Sana</th>
                <th className="p-2">Anamnez, holat, tashxis va davolash</th>
                <th className="p-2 w-44">Shifokor F.I.O</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black">
              {card043Data.historyLogs.length === 0 ? (
                <tr>
                  <td colSpan="3" className="p-4 text-center text-slate-400">Yozuvlar mavjud emas</td>
                </tr>
              ) : (
                card043Data.historyLogs.map(log => (
                  <tr key={log.id} className="divide-x divide-black">
                    <td className="p-2">{log.date}</td>
                    <td className="p-2 whitespace-pre-line">{log.content}</td>
                    <td className="p-2">{log.doctor}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Doctor Signature */}
        <div className="flex justify-between mt-12 text-xs">
          <div>Shifokor imzosi: _____________________</div>
          <div>Sana: _____________________</div>
        </div>
      </div>

    </div>
  );
}
