import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from '@/i18n/LanguageContext';
import {
  ArrowLeft, Phone, Calendar, DollarSign, ClipboardList,
  Plus, MessageSquare, FileDown, AlertTriangle, Clock, Activity,
  MapPin, User, CheckCircle2, XCircle, Shield, Image,
  Copy, Share2, QrCode, ExternalLink, Check, X, Wallet, CreditCard, Camera, Upload, ZoomIn, ChevronLeft, ChevronRight, Trash2, Search, Loader2, Printer
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Tooth } from '@/components/ui/Icons';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import {
  bootstrapTelegramBotConfig,
  getEnvBotUsername,
  parseBotTechData,
  resolveBotUsernameFromConfig,
} from '@/lib/telegramBotConfig';
import { sendTestReminderForPatient } from '@/lib/telegramReminderService';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import StatusBadge from '../components/ui/StatusBadge';
import EmptyState from '../components/ui/EmptyState';
import PatientAppointments from '../components/patients/PatientAppointments';
import PatientPayments from '../components/patients/PatientPayments';
import PatientTreatments from '../components/patients/PatientTreatments';
import PatientNotes from '../components/patients/PatientNotes';
import PatientXraysOdontogram from '../components/patients/PatientXraysOdontogram';
import ProfessionalOdontogram from '../components/patients/ProfessionalOdontogram';
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
import { formatPhone, cn, capitalizeName } from '@/lib/utils';
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
  'crown': { uz: 'Toj (Koronka)', ru: 'Коронка', en: 'Crown' },
  'veneer': { uz: 'Vinir', ru: 'Винир', en: 'Veneer' },
  'implant': { uz: 'Implantat', ru: 'Иmplant', en: 'Implant' },
  'davolangan': { uz: 'Davolangan', ru: 'Вылечен', en: 'Treated' },
  'completed': { uz: 'Tugallangan', ru: 'Завершено', en: 'Completed' },
  'jarayonda': { uz: 'Jarayonda', ru: 'В процессе', en: 'In progress' },
  'in_progress': { uz: 'Jarayonda', ru: 'В процессе', en: 'In progress' },
};

export default function PatientProfile() {
  const { t, language } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const [patient, setPatient] = useState(null);

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
  const location = useLocation();
  const urlTab = new URLSearchParams(location.search).get('tab');
  const [activeTab, setActiveTab] = useState(urlTab || 'info');
  const [subSection, setSubSection] = useState('dental');
  const [chartView, setChartView] = useState('teeth'); // 'teeth', 'maxilla', 'mandible', 'occlusion'
  const [showOcclusal, setShowOcclusal] = useState(true);
  const [occlusionNotes, setOcclusionNotes] = useState('');
  const [occlusionClass, setOcclusionClass] = useState('Class I');
  
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [xraysLoading, setXraysLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Lazy load Appointments
  useEffect(() => {
    if (activeTab === 'appointments' && id) {
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
  }, [activeTab, id, refreshTrigger]);

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
    if (activeTab === 'xrays' && id) {
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
    return chartEditMode && editSelectedTooth ? [editSelectedTooth.id] : [];
  }, [chartEditMode, editSelectedTooth]);

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
      setHistoryModalOpen(true);
    }
  }, [chartEditMode]);

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
        await new Promise((resolve) => {
          reader.onload = async (ev) => {
            const dataUrl = ev.target.result;
            // Save as Xray record with special category
            await base44.entities.Xray.create({
              patient_id: id,
              image_url: dataUrl,
              date: new Date().toISOString().split('T')[0],
              type: 'photo',
              notes: file.name,
            });
            resolve();
          };
          reader.readAsDataURL(file);
        });
      }
      toast.success(`${files.length} ta rasm yuklandi`);
      load();
    } catch (err) {
      console.error(err);
      toast.error('Rasm yuklashda xatolik');
    } finally {
      setPhotoUploading(false);
      e.target.value = '';
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
      setPayments(paymentsRes || []);

      // ── Unblock UI: hide skeleton now, render with partial data ──
      setLoading(false);

      // ── PHASE 2: Secondary data — load in background, no skeleton ──
      const [svcsRes, implantsRes, toothRes, doctorsRes] = await Promise.all([
        servicesCache ? Promise.resolve(servicesCache) : base44.entities.Service.filter({ is_active: true }, 'name', 100),
        base44.entities.Implant.filter({ patient_id: id }),
        base44.entities.ToothRecord.filter({ patient_id: id }, '-created_date', 100),
        doctorsCache ? Promise.resolve(doctorsCache) : base44.entities.User.filter({ role: 'doctor' }, 'name'),
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
      if (combined.includes('extracted') || combined.includes('sug\'urilgan')) {
        return 'extracted';
      }
      
      // Restorations (treatments)
      if (combined.includes('implant')) return 'implant';
      if (combined.includes('crown') || combined.includes('toj')) return 'crown';
      if (combined.includes('veneer')) return 'veneer';
      if (combined.includes('filling') || combined.includes('plomba') || combined.includes('cervical filling') || combined.includes('davolangan')) return 'completed';

      // Lesions (conditions)
      if (combined.includes('decay') || combined.includes('secondary cavity') || combined.includes('cavity') || combined.includes('defect') || combined.includes('discoloration') || combined.includes('kariyes')) {
        return 'caries';
      }
      
      // Periodontitum or Endo (treated or in progress)
      if (combined.includes('periodontitis') || combined.includes('gingivitis') || combined.includes('calculus')) {
        return 'in_progress';
      }
      if (combined.includes('canal') || combined.includes('pulpit') || combined.includes('endo') || combined.includes('apical') || combined.includes('sealed')) {
        return 'in_progress';
      }

      if (combined.includes('healthy') || combined.includes("sog'lom") || combined.includes('healthy periodontium')) {
        return 'healthy';
      }

      return null;
    };

    // 1. Treatment plans
    plans?.forEach(plan => {
      const planServices = plan.services || [];
      const planTooth = String(plan.tooth_number || '').trim();
      const planStatus = plan.status;
      
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
          
          const isCompleted = service.completed || service.status === 'completed' || planStatus === 'Completed';
          const isInProgress = service.status === 'in_progress' || planStatus === 'In Progress';
          const svcName = String(service.service_name || plan.name || '').toLowerCase();

          let derivedCondition = null;
          let derivedTreatment = service.service_name || plan.name;
          let derivedStatus = isCompleted ? 'completed' : (isInProgress ? 'in_progress' : 'planned');

          if (svcName.includes('olish') || svcName.includes('sug\'urish') || svcName.includes('ekstraks') || svcName.includes('extraction') || svcName.includes('olindi')) {
            derivedStatus = 'extracted';
            derivedTreatment = "Tish olingan";
          } else if (svcName.includes('endo') || svcName.includes('kanal') || svcName.includes('pulpit')) {
            derivedCondition = 'Pulpit';
            derivedTreatment = 'Kanal';
          } else if (svcName.includes('plomba') || svcName.includes('restavratsiya') || svcName.includes('vinir')) {
            derivedTreatment = 'Restavratsiya';
          } else if (svcName.includes('karonka') || svcName.includes('toj') || svcName.includes('crown') || svcName.includes('protez') || svcName.includes('metallokeramika')) {
            derivedStatus = 'crown';
            derivedTreatment = 'Toj';
          } else if (svcName.includes('kariyes') || svcName.includes('caries') || svcName.includes('karies')) {
            derivedStatus = 'caries';
            derivedCondition = 'Kariyes';
          }

          toothStatusMap[toothId] = {
            status: derivedStatus,
            condition: derivedCondition,
            treatment: derivedTreatment,
            serviceName: service.service_name || plan.name,
            color: derivedStatus === 'completed' ? 'bg-emerald-500' : (derivedStatus === 'in_progress' ? 'bg-amber-500' : (derivedStatus === 'caries' ? 'bg-rose-500' : 'bg-blue-500')),
            icon: derivedStatus === 'completed' ? '✅' : (derivedStatus === 'in_progress' ? '💉' : '📋'),
            date: service.completion_date || plan.updated_at || plan.created_date
          };
        });
      });
    });

    // 2. Implantlar holatini qo'shish
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

    // 3. Saved Tooth Records (Supabase)
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

    // 4. Pending edits (during Edit Mode)
    if (chartEditMode) {
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
  
  // Tanlangan tishlar - faqat davolangan yoki rejalashtirilgan tishlar
  const treatedTeeth = useMemo(() => Object.keys(toothStatuses), [toothStatuses]);

  // Barcha tishlar uchun to'liq va aniq xizmatlar ro'yxatini shakllantirish
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
        : (planTooth ? [{ service_name: plan.name || plan.title, status: plan.status }] : []);

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

          const isCompleted = service.completed || service.status === 'completed' || planStatus === 'Completed';
          const isInProgress = service.status === 'in_progress' || planStatus === 'In Progress';
          
          toothServicesMap[fdiNumber].push({
            id: service.id || service.service_id || Math.random().toString(),
            name: service.service_name || plan.name || plan.title,
            price: service.price,
            status: isCompleted ? 'completed' : (isInProgress ? 'in_progress' : 'planned'),
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
          name: `${imp.firma || ''} Implant (${imp.brend || ''})`,
          price: null,
          status: 'implant',
          date: imp.placement_date,
          planName: 'Implantatsiya',
          toothId
        });
      });
    });

    return toothServicesMap;
  };

  const teethDetailedServices = useMemo(() => getTeethDetailedServices(), [plans, implants]);

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

    // Agar Debt paymentlari mavjud bo'lsa (payment-based hisob):
    //   qarz = Debt - Income - Discount
    // Agar Debt paymentlari yo'q bo'lsa (plan-based hisob):
    //   qarz = totalPlansPrice - Income
    let calculatedDebt = 0;
    let calculatedPrepayment = 0;

    if (totalDebts > 0) {
      // Debt payment mavjud — payment-based hisob (eng aniq)
      // Debt = chegirmali narx, shuning uchun Discount ni ham ayiramiz
      const net = totalIncomes + totalDiscounts - totalDebts - totalRefunds;
      calculatedDebt = net < 0 ? Math.abs(net) : 0;
      calculatedPrepayment = net > 0 ? net : 0;
    } else if (plansList.length > 0) {
      // Debt payment yo'q — plan.total_price (chegirmali) asosida hisob
      const totalPlansPrice = plansList.reduce((sum, plan) => sum + (Number(plan.total_price) || 0), 0);
      const net = totalIncomes + totalDiscounts - totalPlansPrice;
      calculatedDebt = net < 0 ? Math.abs(net) : 0;
      calculatedPrepayment = net > 0 ? net : 0;
    } else {
      const net = totalIncomes - totalRefunds;
      calculatedDebt = net < 0 ? Math.abs(net) : 0;
      calculatedPrepayment = net > 0 ? net : 0;
    }

    // Chegirma foizini hisoblash
    const totalOriginalPlansPrice = plansList.reduce((sum, plan) =>
      sum + (Number(plan.total_price) || 0) + (Number(plan.discount_amount) || 0), 0);
    const discountPercent = totalOriginalPlansPrice > 0
      ? Math.round((totalDiscounts / totalOriginalPlansPrice) * 100)
      : 0;

    return {
      totalPaid: totalIncomes,
      totalDebt: calculatedDebt,
      totalPrepayment: calculatedPrepayment,
      totalDiscount: totalDiscounts,
      discountPercent
    };
  }, [payments, plans]);

  const { totalPaid, totalDebt, totalPrepayment, totalDiscount, discountPercent } = financialData;

  const openPayModal = () => {
    if (totalDebt <= 0) {
      toast.error("Bemorning qarzi yo'q. To'lov qabul qilib bo'lmaydi.");
      return;
    }
    setPayForm({ 
      type: 'Income', 
      amount: totalDebt, 
      method: 'Cash', 
      category: 'Treatment', 
      date: getLocalDateTimeValue(), 
      notes: '', 
      doctor_id: doctors[0]?.id || '', 
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
      const isPlanPayment = !!(pay.plan_id || notesLower.includes('linked to plan') || notesLower.includes('reja to\'lov') || notesLower.includes('muddatli') || notesLower.includes('boshlang\'ich to\'lov'));
      const isExpense = pay.type === 'Expense';
      items.push({
        id: `pay-${pay.id}`,
        type: 'payment',
        date: pay.date ? new Date(pay.date) : new Date(),
        dateStr: pay.date ? pay.date.split('T')[0] : '',
        time: pay.date && pay.date.includes('T') ? pay.date.split('T')[1].substring(0, 5) : '',
        title: isPlanPayment ? "Reja narxi (to'lov kutilmoqda)" : isExpense ? "Xarajat" : "To'lov qabul qilindi",
        price: pay.amount,
        color: isPlanPayment ? 'amber' : isExpense ? 'rose' : 'emerald',
        isPlanPayment,
        isExpense,
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
    'implant': '#f97316',
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

      const cond = statusObj.condition;
      const treat = statusObj.treatment;

      if (cond && cond !== 'Healthy' && cond !== 'Healthy periodontium') {
        if (!groups[cond]) groups[cond] = [];
        if (!groups[cond].includes(fdi)) groups[cond].push(fdi);
      }
      if (treat) {
        if (!groups[treat]) groups[treat] = [];
        if (!groups[treat].includes(fdi)) groups[treat].push(fdi);
      }
    });

    const list = [];
    Object.entries(groups).forEach(([name, teeth]) => {
      teeth.sort((a, b) => parseInt(a) - parseInt(b));
      list.push({ name: translateDiagnostic(name), teeth: teeth.join(', '), color: getConditionColor(name) });
    });

    if (list.length === 0) {
      return [
        { name: translateDiagnostic('Missing tooth'), teeth: '18, 28, 38, 48', color: '#ef4444' },
        { name: translateDiagnostic('Cavity'), teeth: '16, 27, 47, 46', color: '#3b82f6' },
        { name: translateDiagnostic('Secondary cavity'), teeth: '11, 26, 36, 46', color: '#f97316' },
        { name: translateDiagnostic('Fissure pigmentation (initial caries)'), teeth: '37, 47', color: '#92400e' },
        { name: translateDiagnostic('Canal partially sealed'), teeth: '11', color: '#f43f5e' },
        { name: translateDiagnostic('Dental calculus'), teeth: '31, 32, 42, 41', color: '#d97706' },
      ];
    }
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
    if (payingSavingRef.current) return; // professional: anti double-click (same render tick)
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

      // Full recalculation from all payments (not incremental — prevents drift)
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
    doc.text('My Clinic', 20, 20);
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

  const getInitials = (name) => name?.split(' ')?.map(n => n[0])?.join('')?.substring(0, 2)?.toUpperCase() || '?';

  return (
    <div className="min-h-screen bg-[#f0f2f5] pb-20">
      <div className="print:hidden">

      {/* ══ BCLINIC HEADER ══ */}
      <div className="bg-white border-b border-[#e8eaed] sticky-profile-header shadow-sm">
        {/* Warning Alerts Banner */}
        {medicalAlerts && medicalAlerts.length > 0 && (
          <div className="bg-rose-50/90 backdrop-blur-sm border-b border-rose-100/60 px-4 py-2 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-rose-600 text-[10.5px] font-[900] uppercase tracking-wider shrink-0 mr-2">
              <AlertTriangle className="w-4.5 h-4.5 text-rose-500 animate-pulse shrink-0" />
              <span>{t('patientProfile.medicalAlert')}:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {medicalAlerts.map((alert, idx) => (
                <span 
                  key={idx} 
                  className="inline-flex items-center gap-1.5 bg-gradient-to-r from-red-500 to-rose-600 text-white text-[9.5px] font-[900] uppercase tracking-wider px-2.5 py-1 rounded-lg shadow-sm border-none"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping shrink-0" />
                  {t(`patientProfile.${alert.type}`)}
                </span>
              ))}
            </div>
          </div>
        )}
        
        {/* Patient Identity Row */}
        <div className="px-4 pt-3 pb-0 flex flex-col lg:flex-row lg:items-end justify-between gap-0">
          {/* Left: Avatar + Patient Info (BClinic style) */}
          <div className="flex items-end gap-4">
            {/* Back Button — always goes to patients list */}
            <button
              onClick={() => navigate('/patients')}
              className="mb-2 w-9 h-9 shrink-0 rounded-xl bg-[#ff6d00]/10 hover:bg-[#ff6d00]/20 border border-[#ff6d00]/20 flex items-center justify-center transition-all active:scale-95 group"
              title="Bemorlar ro'yxatiga qaytish"
            >
              <ArrowLeft className="w-4 h-4 text-[#ff6d00] group-hover:scale-110 transition-transform" />
            </button>
            {/* Allergiya badge top-left */}
            <div className="relative">
              {medicalAlerts && medicalAlerts.length > 0 && (
                <div className="absolute -top-2 -left-1 z-10 flex items-center gap-1 bg-gradient-to-r from-red-500 to-rose-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-md animate-bounce border-none">
                  <span className="font-[1000]">{medicalAlerts.length}</span>
                  <span>{t('patientProfile.warning') || 'Xavf!'}</span>
                </div>
              )}
              <div
                className="relative group cursor-pointer shrink-0"
                onClick={() => { const inp = document.getElementById('avatar-upload-input'); if(inp) inp.click(); }}
              >
                {patient.photo_url ? (
                  <img
                    src={patient.photo_url}
                    alt={patient.full_name}
                    className="w-14 h-14 rounded-md object-cover border-2 border-[#e8eaed]"
                  />
                ) : (
                  <div
                    className="w-14 h-14 rounded-md flex items-center justify-center text-white text-xl font-black border-2 border-[#e8eaed]"
                    style={{ background: 'linear-gradient(135deg,#1a73e8 0%,#0d5db8 100%)' }}
                  >
                    {getInitials(patient.full_name)}
                  </div>
                )}
                <div className="absolute inset-0 rounded-md bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="w-4 h-4 text-white" />
                </div>
                {photoUploading && (
                  <div className="absolute inset-0 rounded-md bg-black/50 flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  </div>
                )}
              </div>
              <input id="avatar-upload-input" type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            </div>

            {/* Name + age + phone */}
            <div className="pb-2">
              <div className="flex items-baseline gap-2">
                <h1 className="text-[15px] font-bold text-[#202124] leading-tight">
                  {patient.full_name}
                </h1>
                {age !== null && (
                  <span className="text-[13px] text-[#5f6368] font-normal">{age} yosh</span>
                )}
              </div>
              <div className="text-[12px] text-[#5f6368] mt-0.5 flex items-center gap-2.5 flex-wrap">
                <span className="font-bold text-[#5f6368] text-xs">{formatPhone(patient.phone)}</span>
                {patient.phone && (
                  <div className="flex items-center gap-2 ml-1">
                    <a
                      href={`tel:+${patient.phone.replace(/\D/g, '').startsWith('998') ? patient.phone.replace(/\D/g, '') : '998' + patient.phone.replace(/\D/g, '')}`}
                      className="w-8 h-8 flex items-center justify-center bg-[#1499AD]/5 hover:bg-[#1499AD] text-[#1499AD] hover:text-white rounded-full transition-all border border-[#1499AD]/15 shadow-sm active:scale-95"
                      title="Qo'ng'iroq qilish"
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </a>
                    <a
                      href={`https://t.me/+${patient.phone.replace(/\D/g, '').startsWith('998') ? patient.phone.replace(/\D/g, '') : '998' + patient.phone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-8 h-8 flex items-center justify-center bg-sky-50 hover:bg-sky-500 text-sky-500 hover:text-white rounded-full transition-all border border-sky-100 shadow-sm active:scale-95"
                      title="Telegram orqali yozish"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="translate-x-[-1px] translate-y-[0px]">
                        <line x1="22" y1="2" x2="11" y2="13"></line>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                      </svg>
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right side: Tabs + action icons */}
          <div className="flex flex-col items-start lg:items-end gap-0 w-full lg:w-auto lg:flex-1 min-w-0">
            {/* Top-right action icons */}
            <div className="flex items-center gap-3 mb-2 text-[#5f6368] self-end lg:self-auto">
              <button onClick={() => setApptModalOpen(true)} className="w-8 h-8 flex items-center justify-center hover:bg-[#f1f3f4] rounded-full transition-colors" title="Qo'shish">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
              </button>
              <button onClick={generatePDF} className="w-8 h-8 flex items-center justify-center hover:bg-[#f1f3f4] rounded-full transition-colors" title="Rasm yuklash">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              </button>
            </div>

            {/* Main Tab Navigation (BClinic style) */}
            <div className="overflow-x-auto no-scrollbar w-full">
              <div className="flex items-end min-w-max border-b border-[#e8eaed] w-full">
                {[
                  { id: 'notes',        label: t('patientProfile.tabs.notes') },
                  { id: 'appointments', label: t('patientProfile.tabs.appointments') },
                  { id: 'treatments',   label: t('patientProfile.tabs.treatments') },
                  { id: 'info',         label: t('patientProfile.tabs.info') },
                  { id: 'payments',     label: t('patientProfile.tabs.payments') },
                ].map(tabItem => (
                  <button
                    key={tabItem.id}
                    onClick={() => setActiveTab(tabItem.id)}
                    className={`px-4 py-2.5 text-[13px] whitespace-nowrap transition-all border-b-2 ${
                      activeTab === tabItem.id
                        ? 'border-[#1a73e8] text-[#1a73e8] font-semibold'
                        : 'border-transparent text-[#5f6368] hover:text-[#202124] font-normal'
                    }`}
                  >
                    {tabItem.label}
                  </button>
                ))}
                {/* Extra tabs */}
                {[
                  { id: 'installments', label: t('patientProfile.tabs.installments') },
                  { id: 'implants',     label: t('patientProfile.tabs.implants') },
                  { id: 'photos',       label: t('patientProfile.tabs.photos') },
                  { id: 'xrays',        label: t('patientProfile.tabs.xrays') },
                  { id: 'teeth',        label: t('patientProfile.tabs.teeth') },
                ].map(tabItem => (
                  <button
                    key={tabItem.id}
                    onClick={() => setActiveTab(tabItem.id)}
                    className={`px-4 py-2.5 text-[13px] whitespace-nowrap transition-all border-b-2 ${
                      activeTab === tabItem.id
                        ? 'border-[#1a73e8] text-[#1a73e8] font-semibold'
                        : 'border-transparent text-[#9aa0a6] hover:text-[#5f6368] font-normal text-[12px]'
                    }`}
                  >
                    {tabItem.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ══ BCLINIC SUB-NAVBAR ══ */}
        {activeTab === 'info' && (
          <div className="bg-white border-t border-[#e8eaed] px-4 py-2 flex items-center gap-4 overflow-x-auto no-scrollbar">
            {/* Search */}
            <div className="relative flex-shrink-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9aa0a6]" />
              <input
                type="text"
                placeholder="Qidiruv"
                className="pl-8 pr-3 h-7 bg-[#f1f3f4] border-none rounded text-[12px] text-[#5f6368] focus:outline-none focus:ring-1 focus:ring-[#1a73e8] w-32"
              />
            </div>

            <div className="flex items-center gap-1 text-[12px] text-[#5f6368] whitespace-nowrap">
              <button 
                onClick={() => { setActiveTab('info'); setSubSection('dental'); }} 
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded transition-colors",
                  activeTab === 'info' && subSection === 'dental' ? "bg-[#e8f0fe] text-[#1a73e8] font-bold" : "hover:bg-[#f1f3f4]"
                )}
              >
                Tish jadvali
              </button>
              <button 
                onClick={() => { setActiveTab('info'); setSubSection('psr'); }} 
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded transition-colors",
                  activeTab === 'info' && subSection === 'psr' ? "bg-[#e8f0fe] text-[#1a73e8] font-bold" : "hover:bg-[#f1f3f4]"
                )}
              >
                PSR <span className="text-[10px] opacity-75">Periodontal skrining</span>
              </button>
              <button 
                onClick={() => { setActiveTab('info'); setSubSection('perio'); }} 
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded transition-colors",
                  activeTab === 'info' && subSection === 'perio' ? "bg-[#e8f0fe] text-[#1a73e8] font-bold" : "hover:bg-[#f1f3f4]"
                )}
              >
                Perio diagrammasi
              </button>
            </div>
          </div>
        )}

      </div>

      {/* ══ BCLINIC PAGE BODY ══ */}
      <div className="w-full px-4 pt-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="hidden" />

          {/* MAIN TAB CONTENT */}
          <div className="min-w-0 space-y-0">
        {/* MUDDATLI TO'LOVLAR (Installments) */}
        <TabsContent value="installments" className="outline-none space-y-6">
          {activeTab === 'installments' && (
          <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-50 flex items-center justify-between">
              <h3 className="font-black text-slate-900 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-pink-50 flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-pink-600" />
                </div>
                Muddatli to'lovlar rejasi
              </h3>
            </div>
            
            <div className="p-6 space-y-8">
              {installmentPlans.length === 0 ? (
                <EmptyState title="Muddatli to'lovlar yo'q" description="Ushbu bemorda faol rassrochka rejalari topilmadi" />
              ) : (
                installmentPlans.map(plan => {
                  const inst = plan.installment_plan;
                  const paidMonths = inst.paid_months || [];
                  
                  return (
                    <div key={plan.id} className="bg-slate-50/50 border border-slate-100 rounded-[2.5rem] p-6 lg:p-8">
                       <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
                          <div className="flex items-center gap-4">
                             <div className="w-14 h-14 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-pink-500 shadow-sm">
                                <ClipboardList className="w-7 h-7" />
                             </div>
                             <div>
                                <h4 className="text-sm font-black text-slate-800 tracking-tight uppercase leading-snug">{formatPlanName(plan.name)}</h4>
                                <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mt-1">Jami: {plan.total_price?.toLocaleString()} so'm | {inst.months} oy</p>
                             </div>
                          </div>
                          <div className="flex items-center gap-6 bg-white px-6 py-4 rounded-3xl shadow-sm border border-slate-50">
                             <div className="text-center">
                                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Boshlang'ich</p>
                                <p className="text-sm font-black text-slate-700">{inst.advance_payment?.toLocaleString()} so'm</p>
                             </div>
                             <div className="w-px h-8 bg-slate-100" />
                             <div className="text-center">
                                <p className="text-[10px] font-black text-pink-400 uppercase tracking-widest mb-1">Oylik summa</p>
                                <p className="text-sm font-black text-pink-600">{inst.monthly_amount?.toLocaleString()} so'm</p>
                             </div>
                          </div>
                       </div>

                       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
                                 isPaid ? 'bg-emerald-50 border-emerald-100' : isPartial ? 'bg-amber-50/40 border-amber-200' : 'bg-white border-slate-100 hover:border-pink-100'
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
                                       <div className="flex flex-col items-end">
                                         <Button 
                                           onClick={(e) => { e.stopPropagation(); handlePayInstallment(plan, i); }}
                                           size="sm" 
                                           className="h-9 px-4 rounded-xl bg-pink-500 hover:bg-pink-600 text-white font-black uppercase text-[10px] tracking-tight shadow-lg shadow-pink-500/20 border-none"
                                         >
                                           To'lash
                                         </Button>
                                         {(() => {
                                           const partialPaymentsRaw = Array.isArray(inst?.partial_payments) ? inst.partial_payments : [];
                                           const monthPayments = partialPaymentsRaw
                                             .filter(p => Number(p.month_index) === Number(i))
                                             .sort((a, b) => new Date(a?.date || 0).getTime() - new Date(b?.date || 0).getTime());
                                           const lastPay = monthPayments.length > 0 ? monthPayments[monthPayments.length - 1] : null;
                                           const docName = lastPay?.doctor_id
                                             ? (doctors.find(d => d.id === lastPay.doctor_id)?.name || doctors.find(d => d.id === lastPay.doctor_id)?.full_name || '')
                                             : '';
                                           if (!docName) return null;
                                           return (
                                             <span className="mt-1 text-[8px] font-black text-slate-400 uppercase tracking-widest text-right">
                                               {docName} muddatli to'lov
                                             </span>
                                           );
                                         })()}
                                       </div>
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
          </div>
          )}
        </TabsContent>

        {/* REYESTR (Payments / To'lovlar tarixi) */}
        <TabsContent value="payments" className="outline-none space-y-6">
          {activeTab === 'payments' && (
          <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm p-6">
            <div className="border-b border-slate-50 flex items-center justify-between pb-4 mb-6">
              <h3 className="font-black text-slate-900 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <CreditCard className="w-4 h-4 text-emerald-600" />
                </div>
                Bemor to'lovlar reyestri
              </h3>
            </div>
            <PatientPayments payments={payments} />
          </div>
          )}
        </TabsContent>

        {/* DAVOLASH — BClinic uslubi */}
        <TabsContent value="info" className="outline-none space-y-3">
          {activeTab === 'info' && (
            <>
          {subSection === 'psr' ? (
            /* 1. PSR (Periodontal Screening & Recording) Screen */
            <div className="bg-white border border-[#e8eaed] rounded-lg shadow-sm overflow-hidden p-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
                <div>
                  <h3 className="text-base font-bold text-slate-800">PSR (Periodontal Screening & Recording)</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Og'iz bo'shlig'ini 6 sekstant bo'yicha periodontal skrining tekshiruvi</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSubSection('dental')}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all"
                  >
                    Orqaga (Tish jadvali)
                  </button>
                  <button
                    onClick={() => {
                      localStorage.setItem(`psr_scores_${patient.id}`, JSON.stringify(psrScores));
                      toast.success("PSR indekslari muvaffaqiyatli saqlandi!");
                    }}
                    className="px-4 py-2 bg-[#1a73e8] hover:bg-[#1557b0] text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/10 border-none"
                  >
                    Saqlash
                  </button>
                </div>
              </div>

              {/* PSR 6-Sextant Layout */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {[
                  { key: 's1', label: 'Sekstant 1 (Yuqori O\'ng)', teeth: '18-14' },
                  { key: 's2', label: 'Sekstant 2 (Yuqori Old)', teeth: '13-23' },
                  { key: 's3', label: 'Sekstant 3 (Yuqori Chap)', teeth: '24-28' },
                  { key: 's6', label: 'Sekstant 6 (Pastki O\'ng)', teeth: '48-44' },
                  { key: 's5', label: 'Sekstant 5 (Pastki Old)', teeth: '43-33' },
                  { key: 's4', label: 'Sekstant 4 (Pastki Chap)', teeth: '34-38' },
                ].map((s) => {
                  const score = psrScores[s.key] || 0;
                  return (
                    <div 
                      key={s.key} 
                      className={cn(
                        "p-4 rounded-2xl border transition-all flex flex-col justify-between min-h-[140px]",
                        score >= 3 
                          ? "bg-rose-50/50 border-rose-200 shadow-sm" 
                          : "bg-slate-50 border-slate-100"
                      )}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{s.label}</span>
                          <span className="text-[10px] bg-slate-200/60 text-slate-500 px-1.5 py-0.5 rounded font-black">{s.teeth}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">PSR Baholash indeksi (0-4)</p>
                      </div>

                      <div className="flex items-center gap-1.5 mt-4">
                        {[0, 1, 2, 3, 4].map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => {
                              const next = { ...psrScores, [s.key]: num };
                              setPsrScores(next);
                            }}
                            className={cn(
                              "w-8 h-8 rounded-lg text-xs font-bold transition-all border flex items-center justify-center",
                              score === num
                                ? (num >= 3 ? "bg-rose-600 border-rose-600 text-white shadow-md shadow-rose-500/20" : "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-500/20")
                                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                            )}
                          >
                            {num}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* PSR Index Description Panel */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-xs text-slate-600 space-y-2">
                <p className="font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-2">PSR Indekslari Tavsifi:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5">
                  <div className="flex gap-2"><span className="font-bold text-indigo-600">0:</span> G'ilof butun, tosh yo'q, qonash yo'q.</div>
                  <div className="flex gap-2"><span className="font-bold text-indigo-600">1:</span> Zondlashdan so'ng milkda qonash aniqlanadi.</div>
                  <div className="flex gap-2"><span className="font-bold text-indigo-600">2:</span> Milk osti/usti toshlari yoki plomba nuqsoni bor.</div>
                  <div className="flex gap-2"><span className="font-bold text-rose-600">3:</span> Rangli zona zondlanganda qisman milk cho'ntagiga kiradi (3.5 - 5.5 mm).</div>
                  <div className="flex gap-2"><span className="font-bold text-rose-600">4:</span> Rangli zona to'liq cho'ntakka kirib yo'qoladi (5.5 mm dan chuqur).</div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-200/60 text-[10px] text-slate-400 italic">
                  * 3 yoki 4 baho kiritilgan sekstantlar uchun tish formulasi jadvalida tish ildizi vizual tarzda qizil ogohlantiruvchi rang bilan bo'yaladi.
                </div>
              </div>
            </div>
          ) : subSection === 'perio' ? (
            /* 2. Perio Chart Screen */
            <div className="bg-white border border-[#e8eaed] rounded-lg shadow-sm overflow-hidden p-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
                <div>
                  <h3 className="text-base font-bold text-slate-800">Parodontal xarita (Perio Chart)</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Har bir tish atrofidagi milk cho'ntaklari chuqurligi (mm), qonash (BOP), karash, retsessiya va harakatchanlik o'lchovlari</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSubSection('dental')}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all"
                  >
                    Orqaga (Tish jadvali)
                  </button>
                  <button
                    onClick={() => {
                      localStorage.setItem(`perio_chart_${patient.id}`, JSON.stringify(perioData));
                      toast.success("Perio diagrammasi muvaffaqiyatli saqlandi!");
                    }}
                    className="px-4 py-2 bg-[#1a73e8] hover:bg-[#1557b0] text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/10 border-none"
                  >
                    Saqlash
                  </button>
                </div>
              </div>

              {/* Table Wrapper */}
              <div className="overflow-x-auto border border-slate-100 rounded-2xl shadow-inner bg-white">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="p-3">Tish</th>
                      <th className="p-3">Cho'ntak (Vestibulyar: D, M, M)</th>
                      <th className="p-3">Cho'ntak (Oral: D, M, M)</th>
                      <th className="p-3 text-center">BOP (Qonash)</th>
                      <th className="p-3 text-center">Tosh / Karash</th>
                      <th className="p-3">Retsessiya (Vest / Oral)</th>
                      <th className="p-3 text-center">Harakatchanlik (0-3)</th>
                      <th className="p-3 text-center">Furkatsiya</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {[
                      18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28,
                      48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38
                    ].map((fdi) => {
                      const toothKey = `t${fdi}`;
                      const toothVal = perioData[toothKey] || {
                        pd_b: ['', '', ''],
                        pd_l: ['', '', ''],
                        bop: [false, false, false, false, false, false],
                        pl: [false, false, false, false, false, false],
                        rec_b: '',
                        rec_l: '',
                        mobility: '0',
                        furcation: '0'
                      };

                      const updateTooth = (field, newVal) => {
                        const updated = {
                          ...perioData,
                          [toothKey]: {
                            ...toothVal,
                            [field]: newVal
                          }
                        };
                        setPerioData(updated);
                      };

                      return (
                        <tr key={fdi} className="hover:bg-slate-50/50 transition-colors">
                          {/* FDI Number */}
                          <td className="p-3 font-bold text-slate-800 bg-slate-50/30">
                            #{fdi}
                          </td>

                          {/* Pocket Depth Buccal (D, M, M) */}
                          <td className="p-3">
                            <div className="flex gap-1.5 w-24">
                              {[0, 1, 2].map((idx) => (
                                <input
                                  key={idx}
                                  type="text"
                                  value={toothVal.pd_b?.[idx] || ''}
                                  onChange={(e) => {
                                    const val = e.target.value.replace(/\D/g, '').substring(0, 1);
                                    const nextArr = [...(toothVal.pd_b || ['', '', ''])];
                                    nextArr[idx] = val;
                                    updateTooth('pd_b', nextArr);
                                  }}
                                  className="w-7 h-7 text-center border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                                  placeholder="-"
                                />
                              ))}
                            </div>
                          </td>

                          {/* Pocket Depth Lingual (D, M, M) */}
                          <td className="p-3">
                            <div className="flex gap-1.5 w-24">
                              {[0, 1, 2].map((idx) => (
                                <input
                                  key={idx}
                                  type="text"
                                  value={toothVal.pd_l?.[idx] || ''}
                                  onChange={(e) => {
                                    const val = e.target.value.replace(/\D/g, '').substring(0, 1);
                                    const nextArr = [...(toothVal.pd_l || ['', '', ''])];
                                    nextArr[idx] = val;
                                    updateTooth('pd_l', nextArr);
                                  }}
                                  className="w-7 h-7 text-center border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                                  placeholder="-"
                                />
                              ))}
                            </div>
                          </td>

                          {/* Bleeding on Probing (BOP) - 6 dots */}
                          <td className="p-3 text-center">
                            <div className="flex gap-1 justify-center">
                              {[0, 1, 2, 3, 4, 5].map((idx) => {
                                const active = toothVal.bop?.[idx];
                                return (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => {
                                      const nextArr = [...(toothVal.bop || [false, false, false, false, false, false])];
                                      nextArr[idx] = !active;
                                      updateTooth('bop', nextArr);
                                    }}
                                    className={cn(
                                      "w-3 h-3 rounded-full border transition-all",
                                      active ? "bg-rose-500 border-rose-500 shadow-sm shadow-rose-500/25 scale-110" : "bg-white border-slate-200 hover:bg-rose-50"
                                    )}
                                    title={idx < 3 ? `Vestibulyar ${['Distal', 'O\'rta', 'Mezial'][idx]}` : `Oral ${['Distal', 'O\'rta', 'Mezial'][idx - 3]}`}
                                  />
                                );
                              })}
                            </div>
                          </td>

                          {/* Plaque (PL) - 6 dots */}
                          <td className="p-3 text-center">
                            <div className="flex gap-1 justify-center">
                              {[0, 1, 2, 3, 4, 5].map((idx) => {
                                const active = toothVal.pl?.[idx];
                                return (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => {
                                      const nextArr = [...(toothVal.pl || [false, false, false, false, false, false])];
                                      nextArr[idx] = !active;
                                      updateTooth('pl', nextArr);
                                    }}
                                    className={cn(
                                      "w-3 h-3 rounded-full border transition-all",
                                      active ? "bg-yellow-500 border-yellow-500 shadow-sm shadow-yellow-500/25 scale-110" : "bg-white border-slate-200 hover:bg-yellow-50"
                                    )}
                                    title={idx < 3 ? `Vestibulyar ${['Distal', 'O\'rta', 'Mezial'][idx]}` : `Oral ${['Distal', 'O\'rta', 'Mezial'][idx - 3]}`}
                                  />
                                );
                              })}
                            </div>
                          </td>

                          {/* Recession (Buccal / Lingual) */}
                          <td className="p-3">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={toothVal.rec_b || ''}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/\D/g, '').substring(0, 1);
                                  updateTooth('rec_b', val);
                                }}
                                className="w-7 h-7 text-center border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                                placeholder="V"
                                title="Vestibulyar"
                              />
                              <span className="text-slate-300">/</span>
                              <input
                                type="text"
                                value={toothVal.rec_l || ''}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/\D/g, '').substring(0, 1);
                                  updateTooth('rec_l', val);
                                }}
                                className="w-7 h-7 text-center border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                                placeholder="O"
                                title="Oral"
                              />
                            </div>
                          </td>

                          {/* Mobility (0-3) */}
                          <td className="p-3 text-center">
                            <div className="flex gap-0.5 justify-center">
                              {['0', '1', '2', '3'].map((m) => (
                                <button
                                  key={m}
                                  type="button"
                                  onClick={() => updateTooth('mobility', m)}
                                  className={cn(
                                    "px-1.5 py-0.5 rounded text-[10px] font-bold border transition-all",
                                    toothVal.mobility === m
                                      ? "bg-amber-500 border-amber-500 text-white shadow-sm font-black"
                                      : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                                  )}
                                >
                                  {m}
                                </button>
                              ))}
                            </div>
                          </td>

                          {/* Furcation (0-III) */}
                          <td className="p-3 text-center">
                            <div className="flex gap-0.5 justify-center">
                              {['0', 'I', 'II', 'III'].map((f) => (
                                <button
                                  key={f}
                                  type="button"
                                  onClick={() => updateTooth('furcation', f)}
                                  className={cn(
                                    "px-1.5 py-0.5 rounded text-[10px] font-bold border transition-all",
                                    toothVal.furcation === f
                                      ? "bg-purple-600 border-purple-600 text-white shadow-sm font-black"
                                      : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                                  )}
                                >
                                  {f}
                                </button>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* 3. Dental Chart (Tishlar xaritasi) Screen */
            <div className="bg-white border border-[#e8eaed] rounded-lg shadow-sm overflow-hidden lg:col-span-3">
              {/* Card header with avatar */}
              <div className="px-4 py-3 flex items-start justify-between border-b border-[#f1f3f4]">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#1a73e8] to-[#0d5db8] flex items-center justify-center text-white text-sm font-bold shrink-0">
                    {getInitials(patient.full_name)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-[#202124]">Tish formulasi</span>
                    </div>
                    <span className="text-[11px] text-[#9aa0a6]">{new Date().toLocaleDateString('uz-UZ')} {new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-[#9aa0a6]">
                  {chartEditMode ? (
                    <>
                      <button 
                        type="button" 
                        onClick={handleSaveChartEdits}
                        disabled={chartSaving}
                        className="w-7 h-7 rounded-full hover:bg-emerald-50 text-emerald-600 flex items-center justify-center transition-colors" 
                        title="Saqlash"
                      >
                        {chartSaving ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                        )}
                      </button>
                      <button 
                        type="button" 
                        onClick={() => {
                          setChartEditMode(false);
                          setPendingToothEdits({});
                          setEditSelectedTooth(null);
                        }}
                        className="w-7 h-7 rounded-full hover:bg-rose-50 text-rose-500 flex items-center justify-center transition-colors" 
                        title="Bekor qilish"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button 
                        type="button"
                        onClick={() => {
                          setChartEditMode(true);
                          setEditSelectedTooth({ id: 'ur1', fdi: '11' });
                        }}
                        className="w-7 h-7 rounded-full hover:bg-[#f1f3f4] flex items-center justify-center transition-colors" 
                        title="Tahrirlash"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button className="w-7 h-7 rounded-full hover:bg-[#f1f3f4] flex items-center justify-center transition-colors" title="Nusxa">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                      </button>
                      <button className="w-7 h-7 rounded-full hover:bg-[#f1f3f4] flex items-center justify-center transition-colors" title="Chop etish">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                      </button>
                      <button className="w-7 h-7 rounded-full hover:bg-red-50 text-[#9aa0a6] hover:text-red-500 flex items-center justify-center transition-colors" title="O'chirish">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Tooth Chart + Legend Side by Side inside the wide full-width card */}
              <div className="flex flex-col lg:flex-row gap-0">
                {/* Dental Chart */}
                <div className="flex-1 p-4 overflow-x-auto no-scrollbar min-w-0">
                  <div className="min-w-[760px]">
                    <ProfessionalOdontogram 
                      selectedTeeth={odontogramSelectedTeeth} 
                      onChange={stableOnOdontogramChange} 
                      onToothClick={handleInfoToothClick}
                      multi={!chartEditMode}
                      toothStatuses={toothStatuses}
                      patientType={patientType}
                      onPatientTypeChange={setPatientType}
                      chartView={chartView}
                      showOcclusal={showOcclusal}
                      psrScores={psrScores}
                      occlusionNotes={occlusionNotes}
                      onOcclusionNotesChange={handleOcclusionNotesChange}
                      occlusionClass={occlusionClass}
                      onOcclusionClassChange={handleOcclusionClassChange}
                    />
                  </div>
                </div>

                {/* Right legend panel — BClinic uslubi / Edit panel */}
                <div className={cn(
                  "shrink-0 border-t lg:border-t-0 lg:border-l border-[#e8eaed] p-4 bg-white transition-all duration-300",
                  chartEditMode ? "lg:w-[480px] bg-slate-50/50" : "lg:w-64"
                )}>
                  {chartEditMode ? (
                    <div className="space-y-4 text-slate-700">
                      {/* Edit Panel Header */}
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
                            {editSelectedTooth ? `#${editSelectedTooth.fdi}` : '—'}
                          </div>
                          <div>
                            <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight leading-none">Tishni tahrirlash</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                              {editSelectedTooth ? `${patientType === 'adult' ? 'Kattalar' : 'Bolalar'} tishi` : 'Tishni tanlang'}
                            </p>
                          </div>
                        </div>
                        {editSelectedTooth && (
                          <button
                            type="button"
                            onClick={() => {
                              const next = { ...pendingToothEdits };
                              next[editSelectedTooth.fdi] = { condition: null, treatment: null, notes: '' };
                              setPendingToothEdits(next);
                              toast.info(`#${editSelectedTooth.fdi} tish tozalandi`);
                            }}
                            className="text-[9px] font-black text-rose-500 hover:text-rose-700 uppercase tracking-widest bg-rose-50 px-2 py-1 rounded-lg border border-rose-100 transition-colors"
                          >
                            Tozalash
                          </button>
                        )}
                      </div>

                      {/* Options Grid */}
                      {!editSelectedTooth ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white p-4">
                          <svg className="w-8 h-8 text-slate-300 mb-2 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>
                          <p className="text-xs font-bold text-slate-500">Tahrirlash uchun tish formulalaridan tishni tanlang</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-4">
                          {/* Column 1: Tooth Type, Lesions, Periodontium */}
                          <div className="space-y-4">
                            {/* TOOTH TYPE */}
                            <div>
                              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Tish turi</h4>
                              <div className="space-y-1.5">
                                <div className="grid grid-cols-2 gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setPatientType('adult')}
                                    className={cn(
                                      "px-2 py-1.5 rounded-lg text-[10px] font-bold border transition-all text-center",
                                      patientType === 'adult' ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                                    )}
                                  >
                                    Doimiy
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setPatientType('child')}
                                    className={cn(
                                      "px-2 py-1.5 rounded-lg text-[10px] font-bold border transition-all text-center",
                                      patientType === 'child' ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                                    )}
                                  >
                                    Sut tishi
                                  </button>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const allFdi = ['18','17','16','15','14','13','12','11','21','22','23','24','25','26','27','28','38','37','36','35','34','33','32','31','41','42','43','44','45','46','47','48'];
                                    const nextEdits = { ...pendingToothEdits };
                                    allFdi.forEach(f => {
                                      nextEdits[f] = { ...nextEdits[f], condition: 'Missing tooth', treatment: null };
                                    });
                                    setPendingToothEdits(nextEdits);
                                    toast.warning("Barcha tishlar 'Yo'q' (Missing) deb belgilandi");
                                  }}
                                  className="w-full px-2 py-1.5 bg-white text-slate-600 border border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 rounded-lg text-[10px] font-bold transition-all text-left flex items-center justify-between"
                                >
                                  <span>Barcha tishlar yo'q</span>
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSelectCondition('Missing tooth')}
                                  className={cn(
                                    "w-full px-2 py-1.5 rounded-lg text-[10px] font-bold border transition-all text-left flex items-center justify-between",
                                    getActiveCondition(editSelectedTooth.fdi) === 'Missing tooth'
                                      ? "bg-slate-800 text-white border-slate-800"
                                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                                  )}
                                >
                                  <span>Tish yo'q</span>
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSelectCondition('Tooth root')}
                                  className={cn(
                                    "w-full px-2 py-1.5 rounded-lg text-[10px] font-bold border transition-all text-left flex items-center justify-between",
                                    getActiveCondition(editSelectedTooth.fdi) === 'Tooth root'
                                      ? "bg-slate-800 text-white border-slate-800"
                                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                                  )}
                                >
                                  <span>Tish ildizi</span>
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                </button>
                              </div>
                            </div>

                            {/* LESIONS */}
                            <div>
                              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Zararlanishlar</h4>
                              <div className="space-y-1.5">
                                {[
                                  { label: "Tish rangining o'zgarishi", val: 'Tooth discoloration' },
                                  { label: "Tish yemirolishi", val: 'Tooth decay' },
                                  { label: 'Kariyes kovagi', val: 'Cavity' },
                                  { label: "Bo'yin kariyesi", val: 'Cervical cavity' },
                                  { label: 'Klinimon defekt', val: 'Wedge-shaped defect' },
                                ].map(opt => (
                                  <button
                                    key={opt.val}
                                    type="button"
                                    onClick={() => handleSelectCondition(opt.val)}
                                    className={cn(
                                      "w-full px-2 py-1.5 rounded-lg text-[10px] font-bold border transition-all text-left flex items-center justify-between",
                                      getActiveCondition(editSelectedTooth.fdi) === opt.val
                                        ? "bg-rose-600 text-white border-rose-600 shadow-sm"
                                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                                    )}
                                  >
                                    <span>{opt.label}</span>
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* PERIODONTIUM */}
                            <div>
                              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Parodont</h4>
                              <div className="space-y-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleSelectCondition('Healthy');
                                    handleSelectTreatment(null);
                                  }}
                                  className={cn(
                                    "w-full px-2 py-1.5 rounded-lg text-[10px] font-bold border transition-all text-left flex items-center justify-between",
                                    getActiveCondition(editSelectedTooth.fdi) === 'Healthy'
                                      ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                                  )}
                                >
                                  <span>Sog'lom parodont</span>
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                </button>
                                
                                <div className="border border-slate-200 rounded-xl p-2 bg-white space-y-1">
                                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Periodontit</p>
                                  <div className="grid grid-cols-3 gap-1">
                                    {[
                                      { label: '1-daraja', deg: '1 deg' },
                                      { label: '2-daraja', deg: '2 deg' },
                                      { label: '3-daraja', deg: '3 deg' },
                                    ].map(item => {
                                      const val = `Periodontitis ${item.deg}`;
                                      const isActive = getActiveCondition(editSelectedTooth.fdi) === val;
                                      return (
                                        <button
                                          key={item.deg}
                                          type="button"
                                          onClick={() => handleSelectCondition(val)}
                                          className={cn(
                                            "py-1 rounded text-[9px] font-black border transition-all text-center",
                                            isActive ? "bg-amber-500 border-amber-500 text-white" : "bg-slate-50 text-slate-500 border-slate-100 hover:bg-slate-100"
                                          )}
                                        >
                                          {item.label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>

                                {[
                                  { label: "Yallig'lanish yo'q", val: 'No inflammation' },
                                  { label: 'Gingivit', val: 'Gingivitis' },
                                  { label: "O'tkir gingivit / Periodontit", val: 'Severe gingivitis / Periodontitis' },
                                ].map(opt => (
                                  <button
                                    key={opt.val}
                                    type="button"
                                    onClick={() => handleSelectCondition(opt.val)}
                                    className={cn(
                                      "w-full px-2 py-1.5 rounded-lg text-[10px] font-bold border transition-all text-left flex items-center justify-between",
                                      getActiveCondition(editSelectedTooth.fdi) === opt.val
                                        ? "bg-amber-600 text-white border-amber-600 shadow-sm"
                                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                                    )}
                                  >
                                    <span>{opt.label}</span>
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                  </button>
                                ))}

                                <div className="border border-slate-200 rounded-xl p-2 bg-white space-y-1">
                                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Tish toshlari</p>
                                  <div className="grid grid-cols-2 gap-1">
                                    {[
                                      { label: '1-daraja', deg: '1 deg' },
                                      { label: '2-daraja', deg: '2 deg' },
                                    ].map(item => {
                                      const val = `Dental calculus ${item.deg}`;
                                      const isActive = getActiveCondition(editSelectedTooth.fdi) === val;
                                      return (
                                        <button
                                          key={item.deg}
                                          type="button"
                                          onClick={() => handleSelectCondition(val)}
                                          className={cn(
                                            "py-1 rounded text-[9px] font-black border transition-all text-center",
                                            isActive ? "bg-amber-500 border-amber-500 text-white" : "bg-slate-50 text-slate-500 border-slate-100 hover:bg-slate-100"
                                          )}
                                        >
                                          {item.label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Column 2: Endo, Restorations */}
                          <div className="space-y-4">
                            {/* ENDO */}
                            <div>
                              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Endodontiya</h4>
                              <div className="space-y-1.5">
                                {[
                                  { label: 'Pulpit', val: 'Pulpitis' },
                                  { label: 'Muhrlanmagan kanal', val: 'Unsealed canal' },
                                  { label: 'Ildiz uchigacha muhrlangan kanal', val: 'Canal sealed to the apex' },
                                  { label: 'Kanal qisman muhrlangan', val: 'Canal partially sealed' },
                                ].map(opt => (
                                  <button
                                    key={opt.val}
                                    type="button"
                                    onClick={() => handleSelectTreatment(opt.val)}
                                    className={cn(
                                      "w-full px-2 py-1.5 rounded-lg text-[10px] font-bold border transition-all text-left flex items-center justify-between",
                                      getActiveTreatment(editSelectedTooth.fdi) === opt.val
                                        ? "bg-orange-600 text-white border-orange-600 shadow-sm"
                                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                                    )}
                                  >
                                    <span>{opt.label}</span>
                                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                                  </button>
                                ))}

                                <div className="border border-slate-200 rounded-xl p-2 bg-white space-y-1">
                                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Apikal periodontit</p>
                                  <div className="grid grid-cols-3 gap-1">
                                    {['3mm', '3-5mm', '5mm'].map(size => {
                                      const val = `Apical periodontitis ${size}`;
                                      const isActive = getActiveTreatment(editSelectedTooth.fdi) === val;
                                      return (
                                        <button
                                          key={size}
                                          type="button"
                                          onClick={() => handleSelectTreatment(val)}
                                          className={cn(
                                            "py-1 rounded text-[8px] font-black border transition-all text-center",
                                            isActive ? "bg-orange-500 border-orange-500 text-white" : "bg-slate-50 text-slate-500 border-slate-100 hover:bg-slate-100"
                                          )}
                                        >
                                          {size}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* RESTORATIONS */}
                            <div>
                              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Restavratsiyalar</h4>
                              <div className="space-y-1.5">
                                {[
                                  { label: 'Plomba', val: 'Filling', dots: true },
                                  { label: "Bo'yin plombasi", val: 'Cervical filling', dots: true },
                                  { label: 'Vinir', val: 'Veneer', dots: true, cross: true },
                                  { label: 'Vaqtinchalik toj', val: 'Temporary crown' },
                                  { label: 'Keramik toj', val: 'Ceramic crown', dots: true },
                                  { label: 'Metall-keramika toj', val: 'Porcelain fused to metal crown', dots: true },
                                  { label: 'Metall toj', val: 'Metal crown', dots: true },
                                  { label: 'Sirkoniy toj', val: 'Zirconia crown', dots: true },
                                ].map(opt => {
                                  const isActive = getActiveTreatment(editSelectedTooth.fdi) === opt.val;
                                  return (
                                    <div
                                      key={opt.val}
                                      className={cn(
                                        "w-full px-2 py-1 rounded-lg border transition-all flex items-center justify-between bg-white",
                                        isActive ? "border-indigo-500 bg-indigo-50/20" : "border-slate-200"
                                      )}
                                    >
                                      <button
                                        type="button"
                                        onClick={() => handleSelectTreatment(opt.val)}
                                        className={cn(
                                          "flex-1 text-[10px] font-bold text-left py-0.5",
                                          isActive ? "text-indigo-900" : "text-slate-600 hover:text-slate-800"
                                        )}
                                      >
                                        {opt.label}
                                      </button>
                                      {opt.dots && (
                                        <div className="flex items-center gap-1 shrink-0 ml-2">
                                          {opt.cross && (
                                            <button
                                              type="button"
                                              onClick={() => handleSelectTreatment(null)}
                                              className="w-3.5 h-3.5 rounded-full border border-slate-300 flex items-center justify-center text-[8px] font-bold text-slate-400 hover:bg-slate-100"
                                              title="Tozalash"
                                            >
                                              ✕
                                            </button>
                                          )}
                                          <div onClick={() => handleSelectTreatment(opt.val)} className="w-2.5 h-2.5 rounded-full bg-sky-400 cursor-pointer hover:scale-110" />
                                          <div onClick={() => handleSelectTreatment(opt.val)} className="w-2.5 h-2.5 rounded-full bg-amber-300 cursor-pointer hover:scale-110" />
                                          <div onClick={() => handleSelectTreatment(opt.val)} className="w-2.5 h-2.5 rounded-full bg-rose-400 cursor-pointer hover:scale-110" />
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}

                                {[
                                  { label: 'Shtift (Pin)', val: 'Pin' },
                                  { label: 'Kultsa (Post & core)', val: 'Post and core' },
                                  { label: 'Abatment', val: 'Abutment' },
                                  { label: 'Milq shakllantiruvchi', val: 'Gingiva former' },
                                  { label: 'Implant', val: 'Implant' },
                                ].map(opt => (
                                  <button
                                    key={opt.val}
                                    type="button"
                                    onClick={() => handleSelectTreatment(opt.val)}
                                    className={cn(
                                      "w-full px-2 py-1.5 rounded-lg text-[10px] font-bold border transition-all text-left flex items-center justify-between",
                                      getActiveTreatment(editSelectedTooth.fdi) === opt.val
                                        ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                                    )}
                                  >
                                    <span>{opt.label}</span>
                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Cancel / Save actions in panel */}
                      <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3 mt-4">
                        <button
                          type="button"
                          onClick={() => {
                            setChartEditMode(false);
                            setPendingToothEdits({});
                            setEditSelectedTooth(null);
                          }}
                          className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 transition-all active:scale-95 cursor-pointer"
                        >
                          Bekor qilish
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveChartEdits}
                          disabled={chartSaving}
                          className="px-4 py-2 bg-[#10b981] hover:bg-[#0d9488] text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 active:scale-95 cursor-pointer"
                        >
                          {chartSaving && <Loader2 className="w-3 h-3 animate-spin" />}
                          Saqlash
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Tab switcher — matching reference dental chart */}
                      <div className="flex flex-wrap gap-0.5 mb-4 border-b border-[#e8eaed] pb-0">
                        {[
                          { label: 'Maxilla', view: 'maxilla', sub: 'dental', color: '#1a73e8', underline: '#1a73e8' },
                          { label: 'Mandible', view: 'mandible', sub: 'dental', color: '#34a853', underline: '#34a853' },
                          { label: 'Occlusion', view: 'occlusion', sub: 'dental', color: '#9c27b0', underline: '#9c27b0' },
                          { label: 'Periodontium', view: 'teeth', sub: 'perio', color: '#f59e0b', underline: '#f59e0b' },
                          { label: 'Teeth', view: 'teeth', sub: 'dental', color: '#0891b2', underline: '#0891b2' },
                        ].map((tab) => {
                          const isActive = tab.sub === 'perio' 
                            ? subSection === 'perio'
                            : subSection === 'dental' && chartView === tab.view;
                          return (
                            <button
                              key={tab.label}
                              type="button"
                              onClick={() => {
                                setSubSection(tab.sub);
                                if (tab.sub === 'dental') {
                                  setChartView(tab.view);
                                }
                              }}
                              className="relative text-[11px] px-3 py-1.5 font-medium transition-colors"
                              style={{
                                color: isActive ? tab.color : '#5f6368',
                                fontWeight: isActive ? 700 : 500,
                              }}
                            >
                              {tab.label}
                              {/* Colored underline bar */}
                              {isActive && (
                                <span 
                                  className="absolute bottom-0 left-0 right-0 h-[2.5px] rounded-full" 
                                  style={{ backgroundColor: tab.underline }} 
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Mandible occlusal view toggle button */}
                      {chartView === 'mandible' && subSection === 'dental' && (
                        <div className="mb-4 flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                          <span className="text-[10px] font-bold text-slate-500 uppercase">Chaynash yuzasi</span>
                          <button
                            type="button"
                            onClick={() => setShowOcclusal(!showOcclusal)}
                            className={cn(
                              "px-2 py-0.5 rounded text-[10px] font-bold transition-all border",
                              showOcclusal
                                ? "bg-indigo-50 border-indigo-200 text-indigo-600"
                                : "bg-slate-100 border-slate-200 text-slate-400"
                            )}
                          >
                            {showOcclusal ? "Ko'rsatilgan" : "Yashirilgan"}
                          </button>
                        </div>
                      )}

                      {/* Tooth status list — professional legend matching reference */}
                      <div className="space-y-1.5">
                        {dentalFormulaSummaryList.map((item, idx) => (
                          <div key={idx} className="flex items-start gap-1.5 text-[12px] leading-snug">
                            <span className="inline-block w-2 h-2 rounded-sm mt-[5px] flex-shrink-0" style={{ backgroundColor: item.color }} />
                            <div>
                              <span className="font-semibold" style={{ color: item.color }}>{item.name}</span>
                              <span className="text-[#5f6368]"> - </span>
                              <span className="font-medium text-[#5f6368]">{item.teeth}</span>
                            </div>
                          </div>
                        ))}
                        {dentalFormulaSummaryList.length === 0 && (
                          <div className="text-[12px] text-[#9aa0a6] italic">Tish holatlari topilmadi</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {/* LEFT & CENTER COLUMN — 2/3 width */}
            <div className="lg:col-span-2 space-y-3">

              {/* BClinic Feed Cards — Timeline */}
              {timelineItems.length === 0 ? (
                <div className="bg-white border border-[#e8eaed] rounded-lg p-8 text-center">
                  <Activity className="w-10 h-10 mx-auto mb-3 text-[#9aa0a6]" />
                  <p className="text-sm font-semibold text-[#5f6368]">Hozircha tibbiy yozuvlar yo'q</p>
                </div>
              ) : (
                timelineItems.slice(0, 8).map((item, idx) => {
                  const highlightColors = [
                    { label: 'Maqsad:', color: '#8ab4f8' },
                    { label: 'Tavsiya etilgan tekshiruv:', color: '#81c995' },
                    { label: 'Davolash tavsiya etiladi:', color: '#fdd663' },
                    { label: 'Maslahat:', color: '#f28b82' },
                  ];

                  return (
                    <div key={item.id} className="bg-white border border-[#e8eaed] rounded-lg shadow-sm overflow-hidden">
                      {/* Card Header */}
                      <div className="px-3 py-2 sm:px-3.5 sm:py-2.5 flex items-start justify-between">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="w-8 h-8 sm:w-8.5 sm:h-8.5 rounded-full bg-gradient-to-br from-[#34a853] to-[#137333] flex items-center justify-center text-white text-xs sm:text-sm font-bold shrink-0">
                            {getInitials(patient.full_name)}
                          </div>
                          <div>
                            <div className="text-[12.5px] font-semibold text-[#202124]">{patient.full_name}</div>
                            <div className="text-[10px] text-[#9aa0a6]">{item.dateStr} {item.time}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 text-[#9aa0a6]">
                          <button className="w-6.5 h-6.5 rounded-full hover:bg-[#f1f3f4] flex items-center justify-center">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
                          </button>
                          <button className="w-6.5 h-6.5 rounded-full hover:bg-red-50 hover:text-red-500 flex items-center justify-center">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                          </button>
                        </div>
                      </div>

                      {/* Card Body — professional styled */}
                      <div className="px-3 pb-3 sm:px-3.5">
                        {/* ── APPOINTMENT ── */}
                        {item.type === 'appointment' && (() => {
                          const raw = item.rawData;
                          const docName = raw.doctor_name || (doctors && doctors.find(d => d.id === raw.doctor_id)?.name) || null;
                          return (
                            <div className="space-y-2">
                              {/* Service name */}
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10.5px] font-bold border border-blue-100">
                                  🦷 {raw.service_name || item.title}
                                </span>
                              </div>
                              {/* Info chips */}
                              <div className="flex flex-wrap gap-1.5">
                                {docName ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-semibold border border-indigo-100">
                                    👨‍⚕️ {docName}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-50 text-slate-400 text-[10px] font-semibold border border-slate-100">
                                    👨‍⚕️ Shifokor belgilanmagan
                                  </span>
                                )}
                                {item.status && (
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                    item.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                    item.status === 'Cancelled' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                                    'bg-amber-50 text-amber-700 border-amber-100'
                                  }`}>
                                    {item.status === 'Completed' ? '✅ Bajarildi' : item.status === 'Cancelled' ? '❌ Bekor' : '🕐 ' + item.status}
                                  </span>
                                )}
                                {raw.time && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-50 text-slate-500 text-[10px] font-semibold border border-slate-100">
                                    🕐 {raw.time}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })()}

                        {/* ── TREATMENT PLAN ── */}
                        {item.type === 'plan' && (() => {
                          const raw = item.rawData;
                          const docName = raw.doctor_name || raw.doctor || (doctors && doctors.find(d => d.id === raw.doctor_id)?.name) || null;
                          const teeth = (raw.tooth_numbers || [raw.tooth_number]).filter(Boolean);
                          const hasDiscount = raw.discount_amount > 0 || raw.discount_percent > 0;
                          const originalPrice = raw.original_price || raw.total_price;
                          const discountedPrice = raw.total_price;
                          return (
                            <div className="space-y-2">
                              {/* Plan name */}
                              <div className="text-[12px] font-semibold text-slate-700">{item.title}</div>
                              {/* Info chips */}
                              <div className="flex flex-wrap gap-1.5">
                                {docName ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold border border-indigo-100">
                                    👨‍⚕️ {docName}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-50 text-slate-400 text-[10px] font-semibold border border-slate-100">
                                    👨‍⚕️ Shifokor belgilanmagan
                                  </span>
                                )}
                                {teeth.length > 0 && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 text-[10px] font-bold border border-teal-100">
                                    🦷 Tishlar: {teeth.join(', ')}
                                  </span>
                                )}
                                {item.status && (
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                    item.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                    item.status === 'In Progress' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                    'bg-amber-50 text-amber-700 border-amber-100'
                                  }`}>
                                    {item.status === 'Completed' ? '✅ Bajarildi' :
                                     item.status === 'In Progress' ? '🔄 Jarayonda' :
                                     '📋 ' + item.status}
                                  </span>
                                )}
                              </div>
                              {/* Price block */}
                              {discountedPrice > 0 && (
                                <div className="flex items-center gap-3 mt-1 p-2 bg-emerald-50 rounded-lg border border-emerald-100">
                                  <div>
                                    <div className="text-[10px] text-emerald-600 font-semibold uppercase tracking-wide">Narx</div>
                                    <div className="text-[13px] font-black text-emerald-700">{discountedPrice.toLocaleString()} so'm</div>
                                  </div>
                                  {hasDiscount && originalPrice && originalPrice !== discountedPrice && (
                                    <div className="ml-2">
                                      <div className="text-[10px] text-orange-500 font-semibold uppercase tracking-wide">Chegirma</div>
                                      <div className="text-[11px] font-bold text-orange-500">
                                        {raw.discount_percent ? `-${raw.discount_percent}%` : ''}
                                        {raw.discount_amount ? ` -${raw.discount_amount.toLocaleString()} so'm` : ''}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* ── PAYMENT ── */}
                        {item.type === 'payment' && (() => {
                          const raw = item.rawData;
                          const amount = raw.amount || 0;
                          const isDiscount = amount < 0;
                          const isPlan = item.isPlanPayment;
                          const isExp = item.isExpense;
                          const docName = raw.doctor_name || (doctors && doctors.find(d => d.id === raw.doctor_id)?.name) || null;
                          const methodLabel =
                            raw.method === 'Cash' ? 'Naqd' :
                            raw.method === 'Card' ? 'Karta' :
                            raw.method === 'Transfer' ? "O'tkazma" :
                            raw.method || '—';

                          // Determine visual style
                          // Auto-applied discounts (negative plan-linked) → also show as pending
                          const isAutoDiscount = isDiscount && (item.isPlanPayment || (raw.notes || '').toLowerCase().includes('chegirma'));
                          const style = (isPlan && !isDiscount)
                            ? { bg: 'bg-amber-50', border: 'border-amber-200', iconBg: 'bg-amber-100', icon: '🕐', labelColor: 'text-amber-600', amtColor: 'text-amber-700', label: "Reja narxi — to'lov kutilmoqda", showBadge: true }
                            : isAutoDiscount
                              ? { bg: 'bg-amber-50', border: 'border-amber-200', iconBg: 'bg-amber-100', icon: '🏷️', labelColor: 'text-amber-600', amtColor: 'text-amber-700', label: 'Chegirma qo\'llangan — to\'lov kutilmoqda', showBadge: true }
                              : isDiscount
                                ? { bg: 'bg-orange-50', border: 'border-orange-100', iconBg: 'bg-orange-100', icon: '🏷️', labelColor: 'text-orange-500', amtColor: 'text-orange-600', label: 'Chegirma / Qaytarildi', showBadge: false }
                                : isExp
                                  ? { bg: 'bg-rose-50', border: 'border-rose-100', iconBg: 'bg-rose-100', icon: '💸', labelColor: 'text-rose-500', amtColor: 'text-rose-600', label: 'Xarajat', showBadge: false }
                                  : { bg: 'bg-emerald-50', border: 'border-emerald-100', iconBg: 'bg-emerald-100', icon: '💰', labelColor: 'text-emerald-600', amtColor: 'text-emerald-700', label: "To'lov qabul qilindi", showBadge: false };

                          return (
                            <div className="space-y-2">
                              {/* Amount block */}
                              <div className={`flex items-center gap-3 p-2.5 rounded-xl border ${style.bg} ${style.border}`}>
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xl shrink-0 ${style.iconBg}`}>
                                  {style.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className={`text-[10px] font-bold uppercase tracking-wide ${style.labelColor}`}>
                                    {style.label}
                                  </div>
                                  <div className={`text-[15px] font-black ${style.amtColor}`}>
                                    {isDiscount ? '−' : isPlan ? '' : '+'}{Math.abs(amount).toLocaleString()} so'm
                                  </div>
                                </div>
                                {style.showBadge && (
                                  <span className="shrink-0 text-[9px] font-black uppercase tracking-widest bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full">
                                    To'lanmagan
                                  </span>
                                )}
                              </div>
                              {/* Info chips */}
                              <div className="flex flex-wrap gap-1.5">
                                {!isPlan && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold border border-slate-200">
                                    💳 {methodLabel}
                                  </span>
                                )}
                                {docName ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold border border-indigo-100">
                                    👨‍⚕️ {docName}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-50 text-slate-400 text-[10px] font-semibold border border-slate-100">
                                    👨‍⚕️ Shifokor belgilanmagan
                                  </span>
                                )}
                                {raw.category && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 text-[10px] font-semibold border border-purple-100">
                                    📁 {raw.category}
                                  </span>
                                )}
                              </div>
                              {raw.notes && (
                                <div className="text-[11px] text-slate-500 italic bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                                  {raw.notes}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* RIGHT COLUMN — 1/3 width */}
            <div className="lg:col-span-1 space-y-3">

              {/* Shaxsiy Ma'lumotlar — BClinic card */}
              <div className="bg-white border border-[#e8eaed] rounded-lg shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-[#f1f3f4]">
                  <h3 className="text-[13px] font-semibold text-[#202124]">Bemor ma'lumotlari</h3>
                </div>
                <div className="px-4 py-3 space-y-3">
                  {[
                    ['Ism', patient.full_name],
                    ['Telefon', formatPhone(patient.phone)],
                    ['Tug\'ilgan sana', patient.birth_date || '—'],
                    ['Yoshi', age !== null ? `${age} yosh` : '—'],
                    ['Jinsi', patient.gender || '—'],
                    ['Manzil', patient.address || '—'],
                    ['Ro\'yxat', patient.created_date ? new Date(patient.created_date).toLocaleDateString('uz-UZ') : '—'],
                  ].map(([label, val]) => (
                    <div key={label} className="flex items-start justify-between gap-2">
                      <span className="text-[12px] text-[#9aa0a6] shrink-0">{label}</span>
                      <span className="text-[12px] text-[#202124] font-medium text-right">{val}</span>
                    </div>
                  ))}
                  {patient.notes && (
                    <div className="pt-2 border-t border-[#f1f3f4]">
                      <p className="text-[11px] text-[#9aa0a6] mb-1">Eslatma</p>
                      <p className="text-[12px] text-[#5f6368] italic leading-relaxed">{patient.notes}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Moliyaviy holat — BClinic card */}
              <div className="bg-white border border-[#e8eaed] rounded-lg shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-[#f1f3f4]">
                  <h3 className="text-[13px] font-semibold text-[#202124]">Moliyaviy holat</h3>
                </div>
                <div className="px-4 py-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[12px] text-[#9aa0a6]">Jami to'langan</span>
                    <span className="text-[13px] font-semibold text-[#137333]">{totalPaid.toLocaleString()} so'm</span>
                  </div>
                  {totalDebt > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-[12px] text-[#9aa0a6]">Qarzdorlik</span>
                      <span className="text-[13px] font-semibold text-[#c5221f]">{totalDebt.toLocaleString()} so'm</span>
                    </div>
                  )}
                  {totalDiscount > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-[12px] text-[#9aa0a6]">Chegirma</span>
                      <span className="text-[13px] font-semibold text-[#7627bb]">{totalDiscount.toLocaleString()} so'm</span>
                    </div>
                  )}
                  {totalDebt > 0 && (
                    <button
                      onClick={openPayModal}
                      className="w-full mt-2 py-2 bg-[#1a73e8] hover:bg-[#1557b0] text-white text-[12px] font-semibold rounded transition-colors"
                    >
                      To'lov qabul qilish
                    </button>
                  )}
                </div>
              </div>

              {/* Statistika — BClinic card */}
              <div className="bg-white border border-[#e8eaed] rounded-lg shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-[#f1f3f4]">
                  <h3 className="text-[13px] font-semibold text-[#202124]">Qabullar statistikasi</h3>
                </div>
                <div className="px-4 py-3 grid grid-cols-3 gap-2">
                  <div className="text-center">
                    <div className="text-[20px] font-bold text-[#137333]">{completedAppts}</div>
                    <div className="text-[11px] text-[#9aa0a6]">Bajarildi</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[20px] font-bold text-[#1967d2]">{scheduledAppts}</div>
                    <div className="text-[11px] text-[#9aa0a6]">Rejalashtirildi</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[20px] font-bold text-[#c5221f]">{noShows}</div>
                    <div className="text-[11px] text-[#9aa0a6]">Kelmadi</div>
                  </div>
                </div>
              </div>

              {/* Telegram Bot Card */}
              <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
                {(() => {
                  const botLink = getTelegramBotLink(patient.id);
                  const isLinked = !!patient.telegram_chat_id;
                  return (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isLinked ? 'bg-emerald-500' : 'bg-blue-500'} text-white`}>
                          <MessageSquare className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="font-black text-slate-900 text-xs uppercase tracking-wider">Telegram Bot</h4>
                          <p className="text-[9px] font-medium text-slate-400">
                            {isLinked ? '✅ Bot ulangan — eslatmalar faol' : '⚠️ Bot ulanmagan — link yuboring'}
                          </p>
                        </div>
                      </div>

                      {botLink ? (
                        <div className="space-y-3 pt-2">
                          <div className="flex items-center gap-1.5 bg-slate-50 rounded-xl border border-slate-100 px-3 py-2">
                            <span className="text-[10px] font-mono text-[#1499AD] truncate flex-1">{botLink}</span>
                            <button
                              onClick={() => { navigator.clipboard.writeText(botLink); toast.success('Nusxalandi!'); }}
                              className="w-7 h-7 rounded-lg hover:bg-slate-200 text-slate-600 flex items-center justify-center shrink-0"
                              title="Nusxalash"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <a
                              href={`https://t.me/share/url?url=${encodeURIComponent(botLink)}&text=${encodeURIComponent('Klinikadan eslatmalar olish uchun botga ulaning:')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="w-7 h-7 rounded-lg hover:bg-sky-50 text-sky-500 flex items-center justify-center shrink-0"
                              title="Telegramga yuborish"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                            </a>
                          </div>

                          {isLinked && (
                            <button
                              onClick={handleSendTestReminder}
                              disabled={sendingTestReminder}
                              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white px-4 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              {sendingTestReminder ? "Yuborilmoqda..." : "Test eslatma yuborish"}
                            </button>
                          )}

                          <button
                            onClick={() => setShowQr(v => !v)}
                            className="flex items-center gap-2 text-[10px] font-black text-blue-600 hover:text-blue-800 uppercase tracking-widest transition-colors pt-1"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                            {showQr ? "QR kodni yashirish" : "QR kodni ko'rsatish"}
                          </button>

                          {showQr && (
                            <div className="flex flex-col items-center gap-2 pt-2 border-t border-slate-50">
                              <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm inline-block">
                                <QRCodeSVG
                                  id="patient-qr-svg"
                                  value={botLink}
                                  size={130}
                                  level="M"
                                  includeMargin={false}
                                />
                              </div>
                              <button
                                onClick={() => {
                                  const svg = document.querySelector('#patient-qr-svg');
                                  if (!svg) return;
                                  const svgData = new XMLSerializer().serializeToString(svg);
                                  const canvas = document.createElement('canvas');
                                  canvas.width = 300; canvas.height = 300;
                                  const ctx = canvas.getContext('2d');
                                  const img = new Image();
                                  img.onload = () => {
                                    ctx.fillStyle = 'white';
                                    ctx.fillRect(0, 0, 300, 300);
                                    ctx.drawImage(img, 0, 0, 300, 300);
                                    const a = document.createElement('a');
                                    a.download = `QR_${patient.full_name?.replace(/\s+/g, '_')}.png`;
                                    a.href = canvas.toDataURL('image/png');
                                    a.click();
                                  };
                                  img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
                                }}
                                className="text-[9px] font-black text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors"
                              >
                                <FileDown className="w-3.5 h-3.5" /> QR yuklab olish
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-400 font-medium">
                          Bot konfiguratsiyasi topilmadi.
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>

            </div>
          </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="appointments" className="outline-none">
          {activeTab === 'appointments' && (
            <>
          {/* ClinicCard Uchrashuvlar tab */}
          <div className="bg-white border-0 min-h-screen">
            {/* Appointment rows grouped by month */}
            {(() => {
              const grouped = {};
              (appointments || []).forEach(appt => {
                const d = appt.date || appt.appointment_date || appt.created_date || '';
                const dateObj = d ? new Date(d) : new Date();
                const monthKey = dateObj.toLocaleDateString('uz-UZ', { year: 'numeric', month: 'long' });
                if (!grouped[monthKey]) grouped[monthKey] = [];
                grouped[monthKey].push(appt);
              });

              const statusMap = {
                'Completed': { label: 'Tugallandi', bg: '#34a853', text: '#fff' },
                'completed': { label: 'Tugallandi', bg: '#34a853', text: '#fff' },
                'Confirmed': { label: 'Tasdiqlangan', bg: '#4285f4', text: '#fff' },
                'confirmed': { label: 'Tasdiqlangan', bg: '#4285f4', text: '#fff' },
                'Scheduled': { label: 'Tasdiqlangan', bg: '#4285f4', text: '#fff' },
                'scheduled': { label: 'Tasdiqlangan', bg: '#4285f4', text: '#fff' },
                'Cancelled': { label: 'Bekor qilindi', bg: '#ea4335', text: '#fff' },
                'cancelled': { label: 'Bekor qilindi', bg: '#ea4335', text: '#fff' },
                'No Show': { label: 'Kelmadi', bg: '#ff6d00', text: '#fff' },
              };

              if (Object.keys(grouped).length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center py-24 gap-4">
                    <div className="w-16 h-16 rounded-full bg-[#f1f3f4] flex items-center justify-center">
                      <Calendar className="w-8 h-8 text-[#9aa0a6]" />
                    </div>
                    <p className="text-[14px] font-medium text-[#5f6368]">Hozircha uchrashuvlar yo'q</p>
                    <button
                      onClick={() => setApptModalOpen(true)}
                      className="px-5 py-2 bg-[#4285f4] text-white text-[13px] font-medium rounded hover:bg-[#3367d6] transition-colors"
                    >
                      Uchrashuv belgilash
                    </button>
                  </div>
                );
              }

              return (
                <>
                  {Object.entries(grouped).map(([monthLabel, appts]) => (
                    <div key={monthLabel}>
                      {/* Month group header */}
                      <div className="px-4 py-2 bg-[#f8f9fa] border-b border-[#e8eaed]">
                        <span className="text-[12px] font-semibold text-[#5f6368]">{monthLabel}</span>
                      </div>

                      {/* Appointment rows */}
                      {appts.map((appt, idx) => {
                        const d = appt.date || appt.appointment_date || '';
                        const dateObj = d ? new Date(d) : new Date();
                        const dayName = dateObj.toLocaleDateString('uz-UZ', { weekday: 'long' });
                        const dateStr = dateObj.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
                        const startTime = appt.time || appt.start_time || '09:00';
                        const endTime = appt.end_time || '';
                        const doctorName = appt.doctor || appt.doctor_name || 'Shifokor';
                        const statusInfo = statusMap[appt.status] || { label: appt.status || 'Tasdiqlangan', bg: '#4285f4', text: '#fff' };
                        const service = appt.service || appt.service_name || appt.title || appt.notes || 'Qabul';
                        const dotColor = appt.status === 'Completed' || appt.status === 'completed' ? '#34a853' : '#4285f4';

                        return (
                          <div
                            key={appt.id || idx}
                            className="flex items-center px-4 py-3 border-b border-[#f1f3f4] hover:bg-[#f8f9fa] transition-colors cursor-pointer group"
                          >
                            {/* Color dot */}
                            <div className="shrink-0 mr-3">
                              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: dotColor }} />
                            </div>

                            {/* Date & time */}
                            <div className="w-48 shrink-0">
                              <div className="text-[12px] font-medium text-[#202124]">
                                {dateStr} {startTime}{endTime ? ` — ${endTime}` : ''}
                              </div>
                              <div className="text-[11px] text-[#9aa0a6] capitalize">{dayName}</div>
                            </div>

                            {/* Service name */}
                            <div className="flex-1 min-w-0">
                              <span className="text-[13px] text-[#202124] truncate block">{service}</span>
                            </div>

                            {/* Icons (eye, heart) */}
                            <div className="flex items-center gap-2 mx-3 text-[#9aa0a6]">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="#ea4335" stroke="#ea4335" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                            </div>

                            {/* Doctor avatars */}
                            <div className="flex items-center gap-1 mx-3">
                              <div className="w-7 h-7 rounded-full bg-[#1a73e8] flex items-center justify-center text-white text-[10px] font-bold">
                                {doctorName.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase()}
                              </div>
                              <span className="text-[12px] text-[#5f6368] hidden lg:block">{doctorName}</span>
                            </div>

                            {/* Status badge */}
                            <div className="shrink-0 mx-2">
                              <span
                                className="px-3 py-1 rounded text-[11px] font-medium"
                                style={{ backgroundColor: statusInfo.bg, color: statusInfo.text }}
                              >
                                {statusInfo.label}
                              </span>
                            </div>

                            {/* Action icons */}
                            <div className="flex items-center gap-1 ml-2 text-[#9aa0a6] opacity-0 group-hover:opacity-100 transition-opacity">
                              <button className="w-6 h-6 rounded-full hover:bg-[#e8eaed] flex items-center justify-center">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
                              </button>
                              <button className="w-6 h-6 rounded-full hover:bg-red-50 hover:text-red-500 flex items-center justify-center">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}

                  {/* Bottom action buttons — ClinicCard style */}
                  <div className="flex gap-0 mt-0">
                    <button
                      onClick={() => setApptModalOpen(true)}
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#4285f4] hover:bg-[#3367d6] text-white text-[13px] font-medium transition-colors"
                    >
                      <Calendar className="w-4 h-4" />
                      Uchrashuni belgilang
                    </button>
                    <button
                      onClick={() => setPatientModalOpen(true)}
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#34a853] hover:bg-[#2d9247] text-white text-[13px] font-medium transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Ism qo'shish
                    </button>
                  </div>
                  <div className="">
                    <button 
                      onClick={() => setNoteModalOpen(true)}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-[#fbbc04] hover:bg-[#f5a623] text-white text-[13px] font-medium transition-colors"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                      Eslatma sozlash
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
            </>
          )}
        </TabsContent>
        <TabsContent value="treatments" className="outline-none">
          {activeTab === 'treatments' && (
            <>
          {/* ClinicCard Davolash rejalari tab — 2-column layout */}
          <div className="flex flex-col lg:flex-row min-h-screen bg-[#f0f2f5]">

            {/* LEFT: Treatment plan cards */}
            <div className="lg:w-80 xl:w-96 bg-white border-r border-[#e8eaed] flex flex-col">
              {/* Plan title */}
              <div className="px-4 py-3 border-b border-[#e8eaed] flex items-center justify-between">
                <span className="text-[13px] font-semibold text-[#202124]">Treatment plan</span>
                <button
                  onClick={() => setTreatmentModalOpen(true)}
                  className="w-6 h-6 rounded-full hover:bg-[#f1f3f4] text-[#5f6368] flex items-center justify-center"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
              </div>

              {/* Plan cards */}
              <div className="flex-1 overflow-y-auto pb-6">
                {(plans || []).length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <div className="w-12 h-12 rounded-full bg-[#f1f3f4] flex items-center justify-center">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9aa0a6" strokeWidth="2"><rect x="9" y="2" width="6" height="4" rx="1"/><path d="M19 4h-3M5 4H2a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h20a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3"/></svg>
                    </div>
                    <p className="text-[12px] text-[#9aa0a6]">Davolash rejalari yo'q</p>
                    <button onClick={() => setTreatmentModalOpen(true)} className="px-4 py-1.5 bg-[#4285f4] text-white text-[12px] rounded hover:bg-[#3367d6] transition-colors">
                      Reja qo'shish
                    </button>
                  </div>
                ) : (
                  plans.map((plan, planIdx) => {
                    const planColors = [
                      { header: '#e8f0fe', dot: '#4285f4', light: '#f0f4ff' },
                      { header: '#f8e6fb', dot: '#9c27b0', light: '#fce8fb' },
                      { header: '#e3f7e8', dot: '#34a853', light: '#eafbee' },
                      { header: '#fff3e0', dot: '#fb8c00', light: '#fff8f0' },
                    ];
                    const clr = planColors[planIdx % planColors.length];
                    const planServices = plan.services || [];
                    const planTotal = planServices.reduce((s, sv) => s + (Number(sv.price) || 0), 0) || Number(plan.total_price) || 0;
                    const planPaid = Number(plan.paid_amount) || 0;

                    return (
                      <div key={plan.id} className="border-b border-[#e8eaed]">
                        {/* Plan header */}
                        <div className="px-4 py-2.5 flex items-center justify-between cursor-pointer" style={{ backgroundColor: clr.header }}>
                          <div className="flex items-center gap-2">
                            {/* Mini tooth silhouette avatar */}
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ backgroundColor: clr.dot }}>
                              {(plan.name || plan.title || 'R')[0]?.toUpperCase()}
                            </div>
                            <span className="text-[13px] font-semibold text-[#202124]">{plan.name || plan.title || `Reja ${planIdx + 1}`}</span>
                          </div>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5f6368" strokeWidth="2"><polyline points="18 15 12 9 6 15"/></svg>
                        </div>

                        {/* Mini dental chart placeholder */}
                        <div className="px-4 py-2" style={{ backgroundColor: clr.light }}>
                          <div className="flex items-center justify-center h-10 opacity-40">
                            <svg viewBox="0 0 320 40" className="w-full h-8">
                              {[...Array(14)].map((_, i) => (
                                <rect key={i} x={i * 22 + 4} y={6} width={14} height={28} rx={4} fill={clr.dot} opacity="0.5" />
                              ))}
                            </svg>
                          </div>
                        </div>

                        {/* Services list */}
                        <div className="px-4 pb-3" style={{ backgroundColor: clr.light }}>
                          {planServices.length > 0 ? (
                            planServices.map((svc, svcIdx) => (
                              <div key={svcIdx} className="flex items-center justify-between py-1.5 border-b border-white/60 last:border-0">
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full border-2" style={{ borderColor: clr.dot }} />
                                  <span className="text-[12px] text-[#5f6368]">{svc.service_name || svc.name || svc.tooth_number}</span>
                                </div>
                                <span className="text-[12px] font-medium text-[#202124]">{Number(svc.price || 0).toLocaleString()}.00</span>
                              </div>
                            ))
                          ) : (
                            <div className="py-1">
                              <span className="text-[11px] text-[#9aa0a6]">Xizmatlar mavjud emas</span>
                            </div>
                          )}

                          {/* Plan total & print actions */}
                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/60 gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setInvoiceModalPlan(plan);
                              }}
                              className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all active:scale-95 shadow-sm"
                            >
                              <Printer className="w-3.5 h-3.5 text-blue-500" />
                              {(plan.paid_amount || 0) > 0 ? "Chek / Smeta" : "Smeta chop etish"}
                            </button>
                            <span className="text-[12px] font-bold" style={{ color: clr.dot }}>✓ {planTotal.toLocaleString()}.00 UZS</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Totals footer */}
              {(plans || []).length > 0 && (
                <div className="border-t border-[#e8eaed] px-4 py-3 bg-white space-y-1">
                  <div className="flex justify-between text-[12px]">
                    <span className="flex items-center gap-1.5 text-[#34a853]"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>Bajarildi</span>
                    <span className="font-semibold text-[#202124]">{totalPaid.toLocaleString()}.00</span>
                  </div>
                  {totalDebt > 0 && (
                    <div className="flex justify-between text-[12px]">
                      <span className="flex items-center gap-1.5 text-[#4285f4]"><svg width="10" height="10" viewBox="0 0 24 24" fill="#4285f4"><circle cx="12" cy="12" r="10"/></svg>Bajarmagan</span>
                      <span className="font-semibold text-[#202124]">{totalDebt.toLocaleString()}.00</span>
                    </div>
                  )}

                  {/* Toggles */}
                  <div className="pt-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-[#5f6368]">Narxni ko'rsatish</span>
                      <div className="w-8 h-4 rounded-full bg-[#34a853] flex items-center justify-end px-0.5 cursor-pointer">
                        <div className="w-3 h-3 rounded-full bg-white" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-[#5f6368]">Rejalashtirilgan tashriflarni ko'rsatish</span>
                      <div className="w-8 h-4 rounded-full bg-[#34a853] flex items-center justify-end px-0.5 cursor-pointer">
                        <div className="w-3 h-3 rounded-full bg-white" />
                      </div>
                    </div>
                  </div>

                  <div className="pt-1">
                    <p className="text-[10px] text-[#9aa0a6]">
                      Reja yaratildi — {plans[0]?.created_date ? new Date(plans[0].created_date).toLocaleDateString('uz-UZ', { year: 'numeric', month: 'long', day: 'numeric' }) : ''}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT: Stage/filter panel */}
            <div className="flex-1 bg-[#f0f2f5] p-4">
              {/* Filter tabs */}
              <div className="flex flex-wrap items-center gap-2 mb-4">
                {[
                  { value: 'all',        label: t('patientProfile.planFilters.all') },
                  { value: 'unplanned',  label: t('patientProfile.planFilters.unplanned') },
                  { value: 'planned',    label: t('patientProfile.planFilters.planned') },
                  { value: 'inProgress', label: t('patientProfile.planFilters.inProgress') },
                  { value: 'completed',  label: t('patientProfile.planFilters.completed') }
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setPlanStageFilter(opt.value)}
                    className={`px-3 py-1.5 text-[12px] rounded font-medium transition-colors ${
                      planStageFilter === opt.value 
                        ? 'bg-white text-[#202124] shadow-sm border border-[#e8eaed] font-semibold' 
                        : 'text-[#5f6368] hover:bg-white/60'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
                <button className="px-3 py-1.5 text-[12px] rounded font-medium bg-white text-[#202124] shadow-sm border border-[#e8eaed] flex items-center gap-1.5">
                  {t('patientProfile.allPlans')} ({plans?.length || 0})
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="#fbbc04"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                </button>
              </div>

              {/* Plans content area */}
              {(filteredPlans || []).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-sm">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9aa0a6" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  </div>
                  <p className="text-[13px] text-[#5f6368] font-medium">{t('treatmentPlan.noPlansFound') || 'Rejalashtirilmagan bosqichlar'}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredPlans.map((plan, i) => (
                    <div key={plan.id} className="bg-white rounded border border-[#e8eaed] p-3 flex items-center justify-between hover:shadow-sm transition-shadow cursor-pointer" onClick={() => setInvoiceModalPlan(plan)}>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-[#4285f4]" />
                        <span className="text-[13px] text-[#202124] font-semibold">{plan.name || plan.title || `Reja ${i+1}`}</span>
                      </div>
                      <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                        <span className="text-[11px] text-[#9aa0a6] font-bold">
                          {plan.status === 'completed' || plan.status === 'Bajarildi' ? t('treatmentPlan.completed')
                            : plan.status === 'planned' || plan.status === 'Rejalashtirilgan' ? t('treatmentPlan.planned')
                            : plan.status === 'inProgress' || plan.status === 'in_progress' || plan.status === 'Jarayonda' ? t('treatmentPlan.inProgress')
                            : t('patientProfile.planFilters.unplanned')}
                        </span>
                        <button
                          type="button"
                          onClick={() => setInvoiceModalPlan(plan)}
                          className="p-1 hover:bg-slate-100 text-slate-500 rounded transition-colors border-none bg-transparent cursor-pointer flex items-center justify-center"
                          title="Smeta / Chek chop etish"
                        >
                          <Printer className="w-3.5 h-3.5 text-blue-500" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add new plan button bottom */}
              <button
                onClick={() => setTreatmentModalOpen(true)}
                className="mt-4 flex items-center gap-2 px-4 py-2 bg-white border border-[#e8eaed] rounded text-[13px] text-[#5f6368] hover:bg-[#f8f9fa] transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Yangi reja
              </button>
            </div>
          </div>
            </>
          )}
        </TabsContent>
        <TabsContent value="notes" className="outline-none space-y-4">
          {activeTab === 'notes' && (
            <>
          {/* Tooth Chart + Toolbar Header */}
          <div className="bg-white border border-[#e8eaed] rounded-lg shadow-sm overflow-hidden p-4 sm:p-6 no-print">
            
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 mb-6 gap-3">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-800">Tishlar holati va Davolash tarixi</h3>
                <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">Bemorning interaktiv tish xaritasi va o'tkazilgan muolajalar kundaligi</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setManualLogModalOpen(true)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-widest border-none transition-all shadow-md shadow-slate-900/10 flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Muolaja qo'shish
                </button>
                <button
                  type="button"
                  onClick={printCard043}
                  className="px-4 py-2 bg-[#1a73e8] hover:bg-[#1557b0] text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/10 border-none flex items-center gap-1.5 cursor-pointer"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                  Chop etish
                </button>
                <button
                  type="button"
                  onClick={exportCard043PDF}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow-md border-none flex items-center gap-1.5 cursor-pointer"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  PDF
                </button>
              </div>
            </div>

            {/* Tooth graphic section - rendering the uploaded interactive ProfessionalOdontogram */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Interaktiv tish xaritasi (Odontogramma)</h4>
                <span className="text-[10px] text-slate-400 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded font-medium">Rangli flat ko'rinish</span>
              </div>
              
              <div className="border border-slate-100 rounded-2xl overflow-x-auto bg-slate-50/50 p-4 no-scrollbar">
                <div className="min-w-[760px] mx-auto">
                  <ProfessionalOdontogram 
                    selectedTeeth={odontogramEmptySelectedTeeth} 
                    onChange={stableOnOdontogramChange} 
                    onToothClick={handleNotesToothClick}
                    multi={true}
                    toothStatuses={toothStatuses}
                    patientType={patientType}
                    onPatientTypeChange={setPatientType}
                    chartView={chartView}
                    showOcclusal={showOcclusal}
                    psrScores={psrScores}
                    occlusionNotes={occlusionNotes}
                    onOcclusionNotesChange={handleOcclusionNotesChange}
                    occlusionClass={occlusionClass}
                    onOcclusionClassChange={handleOcclusionClassChange}
                  />
                </div>
              </div>
            </div>

            {/* Part 4: Treatment history and Auto sync */}
            <div className="mb-6 border-t border-slate-100 pt-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Davolash kundaligi / Tarix</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">Avtomatik yozuvlar va shifokor davolash yozuvlari loglari</p>
                </div>
                <button
                  type="button"
                  onClick={syncSystemDataToLogs}
                  className="px-4 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl text-xs font-black transition-all border border-indigo-200/50 flex items-center gap-1 cursor-pointer"
                >
                  <Activity className="w-3.5 h-3.5" />
                  Grafiklardan sinxronlash
                </button>
              </div>

              {/* Logs Table */}
              <div className="border border-slate-100 rounded-2xl overflow-x-auto bg-white shadow-sm">
                <table className="w-full text-left border-collapse text-xs min-w-[600px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="p-3 w-32">Sana</th>
                      <th className="p-3">Anamnez, holat, tashxis va davolash</th>
                      <th className="p-3 w-48">Shifokor F.I.O</th>
                      <th className="p-3 w-20 text-center">Amallar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {card043Data.historyLogs.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="p-8 text-center text-slate-400 font-medium">Hozircha yozuvlar yo'q</td>
                      </tr>
                    ) : (
                      card043Data.historyLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/50">
                          <td className="p-3 font-semibold text-slate-500">{log.date}</td>
                          <td className="p-3 text-slate-700 leading-normal font-medium">{log.content}</td>
                          <td className="p-3 font-semibold text-slate-600">{log.doctor}</td>
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => deleteHistoryLogItem(log.id)}
                              className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 w-7 h-7 rounded-lg inline-flex items-center justify-center transition-colors border-none bg-transparent cursor-pointer"
                              title="O'chirish"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          {/* Invoices List / Treatment Plans */}
          <div className="bg-white border border-[#e8eaed] rounded-lg shadow-sm p-4 sm:p-6 no-print">
            <div className="border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-sm font-bold text-slate-800">Bemor hisob-fakturalari (Davolash rejalari)</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Barcha davolash bosqichlari, hisob-fakturalar va to'lov holatlari</p>
            </div>
            {(plans || []).length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs font-semibold">Hisob-fakturalar (Davolash rejalari) mavjud emas</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {plans.map((plan) => {
                  const planServices = plan.services || [];
                  const planTotal = planServices.reduce((s, sv) => s + (Number(sv.price) || 0), 0) || Number(plan.total_price) || 0;
                  const planPaid = Number(plan.paid_amount) || 0;
                  const planRemaining = planTotal - planPaid;
                  
                  return (
                    <div key={plan.id} className="border border-slate-100 rounded-2xl p-4 bg-slate-50/30 hover:shadow-sm transition-all flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-black text-slate-800 uppercase tracking-tight">{plan.name || 'Davolash rejasi'}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                            planRemaining <= 0 ? 'bg-emerald-100 text-emerald-700' : planPaid > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {planRemaining <= 0 ? "To'langan" : planPaid > 0 ? 'Qisman' : 'Kutilmoqda'}
                          </span>
                        </div>
                        <div className="space-y-1 text-[11px] font-bold text-slate-500 my-3">
                          <div className="flex justify-between"><span>Jami summa:</span> <span className="text-slate-900">{planTotal.toLocaleString()} so'm</span></div>
                          <div className="flex justify-between"><span>To'langan:</span> <span className="text-emerald-600">{planPaid.toLocaleString()} so'm</span></div>
                          <div className="flex justify-between"><span>Qolgan:</span> <span className="text-rose-500">{planRemaining.toLocaleString()} so'm</span></div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setInvoiceModalPlan(plan)}
                        className="w-full mt-2 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-widest border-none cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        Faktura ko'rish
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Original Bemor anketalari (notes list) */}
          <div className="bg-white border border-[#e8eaed] rounded-lg shadow-sm p-4 no-print">
            <PatientNotes patientId={id} />
          </div>
            </>
          )}
        </TabsContent>
        {/* RASIMLAR GALEREYASI — BClinic uslubi */}
        <TabsContent value="photos" className="outline-none">
          {activeTab === 'photos' && (
            <>
          <div className="bg-white border border-[#e8eaed] rounded-lg shadow-sm overflow-hidden">
            {/* Header — BClinic uslubi */}
            <div className="px-4 py-3 border-b border-[#f1f3f4] flex items-center justify-between">
              <div>
                <h3 className="text-[13px] font-semibold text-[#202124]">Bemor rasmlari</h3>
                <p className="text-[11px] text-[#9aa0a6]">{xrays.filter(x => x.type === 'photo').length} ta rasm</p>
              </div>
              <label className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a73e8] hover:bg-[#1557b0] text-white text-[12px] font-medium rounded cursor-pointer transition-colors">
                <Upload className="w-3.5 h-3.5" />
                Rasm yuklash
                <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
              </label>
            </div>

            {/* Gallery Grid — BClinic 4-col numbered */}
            {xrays.filter(x => x.type === 'photo').length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4 text-center px-8">
                <Camera className="w-10 h-10 text-[#9aa0a6]" />
                <div>
                  <p className="text-[14px] font-semibold text-[#5f6368]">Rasmlar yo'q</p>
                  <p className="text-[12px] text-[#9aa0a6] mt-1">Bemor uchun bajarligan ishlar rasimlarini yuklang</p>
                </div>
                <label className="flex items-center gap-2 px-4 py-2 bg-[#1a73e8] text-white text-[12px] font-medium rounded cursor-pointer transition-colors hover:bg-[#1557b0]">
                  <Upload className="w-4 h-4" />
                  Birinchi rasmni yuklash
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
                </label>
              </div>
            ) : (
              <div className="p-3">
                {/* BClinic style: numbered grid 4-up then 4-up second row */}
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5">
                  {xrays.filter(x => x.type === 'photo').map((photo, idx) => (
                    <div
                      key={photo.id || idx}
                      className="group relative aspect-square rounded overflow-hidden border border-[#e8eaed] cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => setLightboxPhoto(photo)}
                    >
                      <img
                        src={photo.image_url}
                        alt={photo.notes || `Rasm ${idx + 1}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      {/* Number badge top-left — BClinic style */}
                      <div className="absolute top-1 left-1 min-w-[18px] h-[18px] bg-black/50 rounded-sm flex items-center justify-center px-1">
                        <span className="text-[9px] font-bold text-white">{idx + 1}</span>
                      </div>
                      {/* Delete btn */}
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!confirm('Bu rasmni o\'chirasizmi?')) return;
                          try {
                            await base44.entities.Xray.delete(photo.id);
                            toast.success('Rasm o\'chirildi');
                            load();
                          } catch { toast.error('Xatolik'); }
                        }}
                        className="absolute top-1 right-1 w-5 h-5 rounded-sm bg-red-500/80 hidden group-hover:flex items-center justify-center text-white"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Lightbox */}
          {lightboxPhoto && (
            <div
              className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4"
              onClick={() => setLightboxPhoto(null)}
            >
              <div className="relative max-w-4xl max-h-[90vh] w-full" onClick={e => e.stopPropagation()}>
                <img
                  src={lightboxPhoto.image_url}
                  alt={lightboxPhoto.notes || 'Rasm'}
                  className="w-full h-full object-contain rounded-2xl"
                  style={{ maxHeight: '85vh' }}
                />
                {/* Navigation arrows */}
                {(() => {
                  const photos = xrays.filter(x => x.type === 'photo');
                  const currentIdx = photos.findIndex(p => p.id === lightboxPhoto.id);
                  return (
                    <>
                      {currentIdx > 0 && (
                        <button
                          onClick={() => setLightboxPhoto(photos[currentIdx - 1])}
                          className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/40 transition-all"
                        >
                          <ChevronLeft className="w-6 h-6" />
                        </button>
                      )}
                      {currentIdx < photos.length - 1 && (
                        <button
                          onClick={() => setLightboxPhoto(photos[currentIdx + 1])}
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/40 transition-all"
                        >
                          <ChevronRight className="w-6 h-6" />
                        </button>
                      )}
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-black/50 rounded-xl text-white text-[11px] font-bold">
                        {currentIdx + 1} / {photos.length}
                        {lightboxPhoto.notes && <span className="ml-2 text-white/60">{lightboxPhoto.notes}</span>}
                      </div>
                    </>
                  );
                })()}
                <button
                  onClick={() => setLightboxPhoto(null)}
                  className="absolute top-2 right-2 w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/40 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
            </>
          )}
        </TabsContent>

        <TabsContent value="xrays" className="outline-none">
          {activeTab === 'xrays' && <PatientXraysOdontogram patientId={id} />}
        </TabsContent>

        {/* IMPLANTLAR */}
        <TabsContent value="implants" className="outline-none">
          {activeTab === 'implants' && (
          <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
            <h3 className="font-black text-slate-900 mb-6 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
                <Shield className="w-4 h-4 text-indigo-600" />
              </div>
              Bemor implantlari
            </h3>
            
            {implants.length === 0 ? (
              <EmptyState 
                icon={Shield} 
                title="Implantlar yo'q" 
                description="Bu bemor uchun hali implantlar qayd etilmagan"
              />
            ) : (
              <div className="space-y-4">
                {implants.map(imp => (
                  <Link 
                    key={imp.id} 
                    to={`/implants/${imp.id}`}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:bg-slate-100 transition-colors gap-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                        #{(imp.tooth_numbers || [imp.tooth_number]).join(',')}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900">{imp.firma || 'Noma\'lum'} {imp.brend || ''}</h4>
                        <div className="flex items-center gap-3 text-xs text-slate-500 font-medium mt-1">
                          <span className="flex items-center gap-1">🗓 {imp.placement_date}</span>
                          <span className="flex items-center gap-1">👨‍⚕️ {imp.doctor || '—'}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 self-end sm:self-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                        imp.lifecycle_status === 'Tugallangan' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' :
                        imp.lifecycle_status === 'Failure' ? 'bg-rose-50 border-rose-100 text-rose-600' :
                        'bg-blue-50 border-blue-100 text-blue-600'
                      }`}>
                        {imp.lifecycle_status || imp.status || 'Rejalashtirilgan'}
                      </span>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full">
                        <ArrowLeft className="w-4 h-4 rotate-180" />
                      </Button>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
          )}
        </TabsContent>

        {/* TISHLAR — DENTAL CHART */}
        <TabsContent value="teeth" className="space-y-6 outline-none">
          {activeTab === 'teeth' && (
          <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-600" />
              Davolash tarixi
            </h3>
            
            {/* Statistika */}
            {treatedTeeth.length > 0 && (
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-200">
                  <div className="text-2xl font-bold text-emerald-700">
                    {Object.values(toothStatuses).filter(s => s.status === 'completed').length}
                  </div>
                  <div className="text-xs text-emerald-600 font-medium">Bajarildi ✅</div>
                </div>
                <div className="bg-amber-50 rounded-xl p-3 border border-amber-200">
                  <div className="text-2xl font-bold text-amber-700">
                    {Object.values(toothStatuses).filter(s => s.status === 'in_progress').length}
                  </div>
                  <div className="text-xs text-amber-600 font-medium">Jarayonda 💉</div>
                </div>
                <div className="bg-blue-50 rounded-xl p-3 border border-blue-200">
                  <div className="text-2xl font-bold text-blue-700">
                    {Object.values(toothStatuses).filter(s => s.status === 'planned').length}
                  </div>
                  <div className="text-xs text-blue-600 font-medium">Rejalashtirilgan 📋</div>
                </div>
              </div>
            )}
            
            {/* Tish diagrammasi */}
            <div className="overflow-x-auto no-scrollbar min-w-0 mt-6">
              <div className="min-w-[760px]">
                <ProfessionalOdontogram 
                  selectedTeeth={odontogramEmptySelectedTeeth} 
                  onChange={stableOnOdontogramChange} 
                  onToothClick={handleNotesToothClick}
                  multi={true}
                  toothStatuses={toothStatuses}
                  patientType={patientType}
                  onPatientTypeChange={setPatientType}
                />
            </div>
          </div>
            
            {/* Muolajalar tarixi va rejalari (Tishlar kesimida) */}
            {Object.keys(teethDetailedServices).length > 0 ? (
              <div className="mt-8 space-y-6">
                <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-500" /> Tishlar bo'yicha muolajalar va rejalashtirilgan ishlar
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {Object.entries(teethDetailedServices).map(([fdiNumber, services]) => {
                    const hasCompleted = services.some(s => s.status === 'completed');
                    const hasInProgress = services.some(s => s.status === 'in_progress');
                    const hasImplant = services.some(s => s.status === 'implant');
                    
                    const statusColorClass = hasCompleted ? 'border-l-[3px] border-l-emerald-500' :
                                             hasInProgress ? 'border-l-[3px] border-l-amber-500' :
                                             hasImplant ? 'border-l-[3px] border-l-indigo-500' :
                                             'border-l-[3px] border-l-blue-500';

                    return (
                      <div 
                        key={fdiNumber} 
                        onClick={() => {
                          setSelectedTooth({ id: services[0]?.toothId, fdi: fdiNumber });
                          setHistoryModalOpen(true);
                        }}
                        className={`bg-white hover:bg-slate-50/80 rounded-xl p-3 border border-slate-100 shadow-sm transition-all duration-200 cursor-pointer hover:border-slate-200 flex flex-col justify-between ${statusColorClass}`}
                      >
                        <div>
                          {/* Card Header */}
                          <div className="flex justify-between items-center mb-2 pb-1.5 border-b border-slate-100">
                            <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                              <span className="w-5 h-5 rounded bg-slate-900 text-white text-[10px] flex items-center justify-center font-bold">
                                #{fdiNumber}
                              </span>
                              Tish
                            </span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                              {services.length} ta amal
                            </span>
                          </div>

                          {/* Services List inside this Tooth */}
                          <div className="divide-y divide-slate-100">
                            {services.map((svc) => (
                              <div key={svc.id} className="py-2 first:pt-0 last:pb-0 flex flex-col gap-1">
                                <div className="flex justify-between items-start gap-1.5">
                                  <span className="text-[11px] font-bold text-slate-700 leading-snug truncate flex-1" title={svc.name}>
                                    {svc.name}
                                  </span>
                                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider shrink-0 ${
                                    svc.status === 'completed' ? 'bg-emerald-50 text-emerald-600' :
                                    svc.status === 'in_progress' ? 'bg-amber-50 text-amber-600' :
                                    svc.status === 'implant' ? 'bg-indigo-50 text-indigo-600' :
                                    'bg-blue-50 text-blue-600'
                                  }`}>
                                    {svc.status === 'completed' ? "Bajarildi" :
                                     svc.status === 'in_progress' ? "Jarayonda" :
                                     svc.status === 'implant' ? "Implant" :
                                     "Reja"}
                                  </span>
                                </div>

                                <div className="flex items-center justify-between text-[9px] text-slate-400">
                                  <span>
                                    {svc.date ? new Date(svc.date).toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit' }) : '—'}
                                  </span>
                                  {svc.price !== null && svc.price !== undefined && (
                                    <span className="font-black text-emerald-600">
                                      {svc.price.toLocaleString()} so'm
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-16 text-slate-500">
                <Activity className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p className="text-sm font-bold">Hali davolash yoki tashxis tarixi yo'q</p>
                <p className="text-xs text-slate-400 mt-1">Bemorda davolash rejasi tuzilganidan keyin ma'lumotlar bu yerda ko'rinadi</p>
              </div>
            )}
          </div>
          )}
        </TabsContent>
        </div>{/* end min-w-0 */}
      </Tabs>
      </div>{/* end max-w-7xl */}

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
                  {implants.length === 0 ? <EmptyState icon={Shield} title="Implantlar yo'q" /> : (
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
        <DialogContent className="w-[95%] sm:max-w-xl rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl max-h-[90vh] flex flex-col">
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
                <div className={`${headerBg} px-6 py-5 flex items-center justify-between shrink-0 transition-colors duration-300`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white backdrop-blur-sm shadow-sm">
                      <HeaderIcon className="w-5 h-5 stroke-[2.5]" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-white uppercase tracking-tight">To'lov qo'shish</h3>
                      <p className="text-[10px] font-bold text-white/80 uppercase tracking-widest mt-0.5">{patient.full_name}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setPayModalOpen(false)} 
                    className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-sm transition-all active:scale-95"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 space-y-5 bg-white flex-1 overflow-y-auto no-scrollbar pb-8">
                  
                  {/* Fintech Summa Input */}
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">To'lov summasi</Label>
                    <div className="relative flex items-center justify-center bg-slate-50 rounded-3xl border border-slate-100 px-6 py-4 shadow-inner">
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
                        className="w-full text-center bg-transparent text-3xl font-[1000] text-slate-900 outline-none placeholder-slate-300"
                      />
                      <span className="absolute right-6 text-xs font-black text-slate-400 uppercase tracking-widest pointer-events-none">so'm</span>
                    </div>
                    
                    {/* Sum shortcuts */}
                    <div className="flex flex-wrap gap-1.5 mt-2 justify-center">
                      {[50000, 100000, 500000, 1000000].map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setPayForm(prev => ({ ...prev, amount: (Number(prev.amount) || 0) + val }))}
                          className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-100 text-[10px] font-black text-slate-600 transition-all active:scale-95 shadow-sm"
                        >
                          +{val.toLocaleString()}
                        </button>
                      ))}
                      {totalDebt > 0 && (
                        <button
                          type="button"
                          onClick={() => setPayForm({ ...payForm, amount: totalDebt })}
                          className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-100 hover:bg-amber-100 text-[10px] font-black text-amber-700 transition-all active:scale-95 shadow-sm"
                        >
                          Jami qarz ({totalDebt.toLocaleString()})
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setPayForm({ ...payForm, amount: 0 })}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 hover:bg-slate-200 text-[10px] font-black text-slate-500 transition-all active:scale-95 shadow-sm"
                      >
                        Tozalash
                      </button>
                    </div>
                  </div>

                  {/* To'lov usuli (Cards UI) */}
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">To'lov usuli</Label>
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
                            className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all duration-200 text-center relative ${
                              isActive 
                                ? 'border-slate-900 bg-slate-900 text-white shadow-md' 
                                : 'border-slate-100 bg-slate-50 text-slate-500 hover:bg-slate-100/70 hover:border-slate-200'
                            }`}
                          >
                            <Icon className={`w-5 h-5 mb-1.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                            <span className="text-[11px] font-bold tracking-tight">{m.label}</span>
                            {isActive && (
                              <div className="absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                                <Check className="w-2 h-2 stroke-[4]" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Mas'ul shifokor va Sana */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Mas'ul Shifokor</Label>
                      <Select value={payForm.doctor_id} onValueChange={v => setPayForm({ ...payForm, doctor_id: v })}>
                        <SelectTrigger className="h-12 rounded-2xl border-slate-100 bg-slate-50 font-bold"><SelectValue placeholder="Shifokorni tanlang" /></SelectTrigger>
                        <SelectContent className="rounded-2xl border-slate-100">
                          {doctors.map(d => (
                            <SelectItem key={d.id} value={d.id} className="rounded-xl font-bold">{d.name || d.full_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">To'lov sanasi</Label>
                      <Input type="datetime-local" value={payForm.date} onChange={e => setPayForm({ ...payForm, date: e.target.value })} className="h-12 rounded-2xl border-slate-100 bg-slate-50 font-bold" />
                    </div>
                  </div>

                  {/* Davolash rejalari */}
                  {plans && plans.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Davolash rejasi</Label>
                      <div className="flex flex-col gap-2.5">
                        {plans.map(plan => {
                          const paid = Number(plan.paid_amount) || 0;
                          const total = Number(plan.total_price) || 0;
                          const remaining = Math.max(0, total - paid);
                          
                          return (
                            <div key={plan.id} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm">
                              <div className="min-w-0 flex-1 mr-2">
                                <p className="text-[12px] font-black text-slate-800 truncate">{plan.name || 'Davolash rejasi'}</p>
                                <p className="text-[10px] text-slate-500 font-bold mt-0.5">
                                  Qarz: <span className={remaining > 0 ? 'text-rose-600 font-extrabold' : 'text-emerald-600 font-extrabold'}>{remaining.toLocaleString()} so'm</span>
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setInvoiceModalPlan(plan)}
                                className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 text-[9px] font-black uppercase hover:bg-blue-100 active:scale-95 transition-all"
                              >
                                Faktura
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Kategoriya / Maqsad */}
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Kategoriya / Maqsad</Label>
                    <Input value={payForm.category} onChange={e => setPayForm({ ...payForm, category: e.target.value })} className="h-12 rounded-2xl border-slate-100 bg-slate-50 font-bold text-xs" placeholder="Masalan: Konsultatsiya" />
                  </div>

                  {/* Izoh */}
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Izoh (ixtiyoriy)</Label>
                    <Textarea value={payForm.notes} onChange={e => setPayForm({ ...payForm, notes: e.target.value })} className="rounded-2xl border-slate-100 bg-slate-50 font-medium resize-none min-h-[72px] py-2 px-3 text-xs" placeholder="Qo'shimcha ma'lumot..." />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-3">
                    <Button onClick={() => setPayModalOpen(false)} variant="ghost" className="flex-1 h-12 rounded-2xl font-black uppercase text-[10px] tracking-wider text-slate-400 hover:bg-slate-50">Bekor qilish</Button>
                    <Button 
                      onClick={handleSavePay} 
                      disabled={payingSaving || !payForm.amount} 
                      className={`flex-1 h-12 rounded-2xl bg-slate-950 hover:bg-slate-900 text-white font-black uppercase text-xs tracking-wider border-none relative overflow-hidden group shadow-lg`}
                    >
                      <span className="relative z-10 transition-transform group-hover:scale-105 block">
                        {payingSaving ? "Saqlanmoqda..." : "To'lovni saqlash"}
                      </span>
                      <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
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

      {/* FAB - Contextual Add Button */}
      <div className="fixed bottom-24 right-6 left-6 flex justify-center z-40 lg:hidden">
        {(() => {
          let label = "";
          let icon = null;
          let onClick = null;
          
          switch(activeTab) {
            case 'info':
            case 'appointments':
              label = "Uchrashuv";
              icon = <Calendar className="w-5 h-5" />;
              onClick = () => setApptModalOpen(true);
              break;
            case 'treatments':
              label = "Davolash";
              icon = <Activity className="w-5 h-5" />;
              onClick = () => setTreatmentModalOpen(true);
              break;
            case 'payments':
              label = "To'lov";
              icon = <DollarSign className="w-5 h-5" />;
              onClick = openPayModal;
              break;
            case 'implants':
              label = "Implant";
              icon = <Tooth className="w-5 h-5" />;
              onClick = () => setImplantModalOpen(true);
              break;
            case 'notes':
              label = "Zametka";
              icon = <MessageSquare className="w-5 h-5" />;
              onClick = () => setNoteModalOpen(true);
              break;
            default:
              return null;
          }
          
          return (
            <Button 
              onClick={onClick}
              className="h-14 px-10 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-black flex items-center justify-center shadow-2xl shadow-slate-900/40 border-none animate-in fade-in slide-in-from-bottom-4 duration-500"
            >
              <span className="uppercase text-[11px] tracking-widest flex items-center">
                {label} qoshish
              </span>
            </Button>
          );
        })()}
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
        <DialogContent className="sm:max-w-md rounded-[2.5rem] p-8">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight">Eslatma qo'shish</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <Textarea 
              value={newNoteContent}
              onChange={e => setNewNoteContent(e.target.value)}
              placeholder="Bemor uchun eslatmani kiriting..."
              className="min-h-[120px] rounded-2xl border-slate-100 bg-slate-50 font-medium"
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
        <DialogContent className="sm:max-w-md rounded-[2.5rem] p-8 border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight">Muolaja / Tarix qo'shish</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Muolaja, holat yoki tashxis tafsilotlari</Label>
              <Textarea 
                value={manualLog.content}
                onChange={e => setManualLog(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Muolajani yozing (masalan, 36-tish kariesi davolandi, plomba qo'yildi)..."
                className="min-h-[100px] rounded-2xl border-slate-100 bg-slate-50 font-medium"
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

      </div> {/* end print:hidden */}

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
