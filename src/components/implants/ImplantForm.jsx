import { useState, useEffect, useCallback, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Plus, FileText, X, Check, ArrowLeft, ArrowRight,
  Search, Image as ImageIcon,
} from 'lucide-react';
import { Tooth } from '@/components/ui/Icons';
import PatientModal from '../patients/PatientModal';
import PatientSelect from '../patients/PatientSelect';
import ToothImplantModal from './ToothImplantModal';
import ImplantWizardArch from './ImplantWizardArch';
import ImplantWizardStep2 from './ImplantWizardStep2';
import { useTranslation } from '@/i18n/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import { getOrSeedExtraServices, DEFAULT_EXTRA_SERVICES } from './ExtraServicesManagerModal';
import { getServiceLabel, mergeExtraServicesCatalog, IMPLANT_WIZARD_STEP2_MARKER, normalizeServiceId } from './implantWizardLabels';
import { cn } from '@/lib/utils';
import './implantWizard.css';

const BRANDS = ['Dentium', 'Osstem', 'Straumann', 'Serkon', 'Megagen', 'Neodent', 'Nobel', 'Bredent', 'Nucleoss', 'Boshqa'];

const LIFECYCLE_STATUSES = [
  'planned',
  'placed',
  'healing',
  'formik',
  'abutment',
  'crown',
  'completed',
  'failure',
];

const REMINDER_OPTIONS = [
  { labelKey: 'month1', value: 1 },
  { labelKey: 'month2', value: 2 },
  { labelKey: 'month3', value: 3 },
];

export const EXTRA_SERVICES = [
  { id: 'surgical_guide', label: 'Jarrohlik shabloni', defaultPrice: 500000, category: 'Diagnostika' },
  { id: 'zirkon_crown', label: 'Zirkon karonka', defaultPrice: 550000, category: 'Ortopediya' },
  { id: 'metal_crown', label: 'Metallokeramika karonka', defaultPrice: 500000, category: 'Ortopediya' },
  { id: 'emax_crown', label: 'E-Max karonka', defaultPrice: 650000, category: 'Ortopediya' },
  { id: 'temp_crown', label: 'Vaqtinchalik toj', defaultPrice: 150000, category: 'Ortopediya' },
  { id: 'abutment', label: 'Standart abutment', defaultPrice: 200000, category: 'Komponentlar' },
  { id: 'standard_abutment', label: 'Standart abutment', defaultPrice: 200000, category: 'Komponent' },
  { id: 'zirkon_abutment', label: 'Individual zirkon abutment', defaultPrice: 350000, category: 'Komponent' },
  { id: 'healing_abutment', label: 'Formik', defaultPrice: 120000, category: 'Komponentlar' },
  { id: 'cover_screw', label: 'Zaglushka', defaultPrice: 100000, category: 'Komponentlar' },
  { id: 'multi_unit', label: 'Multi-unit abutment', defaultPrice: 450000, category: 'Komponentlar' },
  { id: 'sinus_open', label: 'Ochiq sinus-lifting', defaultPrice: 800000, category: 'Sinus' },
  { id: 'sinus_closed', label: 'Yopiq sinus-lifting', defaultPrice: 600000, category: 'Sinus' },
  { id: 'open_sinus', label: 'Ochiq sinus-lifting', defaultPrice: 800000, category: 'Jarrohlik' },
  { id: 'closed_sinus', label: 'Yopiq sinus-lifting', defaultPrice: 600000, category: 'Jarrohlik' },
  { id: 'sst_transplant', label: 'SST ko\'chirish', defaultPrice: 800000, category: 'Transplant' },
  { id: 'piezosurgery', label: 'Piezosurgery', defaultPrice: 400000, category: 'Xirurgiya' },
  { id: 'bone_graft', label: 'Bone graft', defaultPrice: 300000, category: 'Graft' },
  { id: 'membrane', label: 'Membrana qo\'yish', defaultPrice: 800000, category: 'Graft' },
  { id: 'prf', label: 'PRF', defaultPrice: 150000, category: 'Graft' },
  { id: 'nkr', label: 'NKR qo\'yish', defaultPrice: 1000000, category: 'Graft' },
  { id: 'extraction', label: 'Atravmatik tish olish', defaultPrice: 250000, category: 'Xirurgiya' },
  { id: 'gingivoplasty', label: 'Gingivoplastika', defaultPrice: 400000, category: 'Soft Tissue' },
  { id: 'explantation', label: 'Implantni olib tashlash', defaultPrice: 500000, category: 'Xirurgiya' },
];

function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0];
}

function getToday() {
  return new Date().toISOString().split('T')[0];
}

export function toFdi(toothId) {
  const raw = String(toothId || '');
  const match = raw.match(/^(ur|ul|lr|ll)(\d+)$/);
  if (match) {
    return ({ ur: '1', ul: '2', ll: '3', lr: '4' }[match[1]]) + match[2];
  }
  return raw.replace(/^#/, '');
}

export function uniqueFdis(toothNumbers = []) {
  return [...new Set((toothNumbers || []).map(toFdi).filter(Boolean))];
}

export function formatSom(n) {
  const v = Math.round(Number(n) || 0);
  return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function toDMY(iso) {
  if (!iso) return '';
  const s = String(iso).slice(0, 10);
  const [y, m, d] = s.split('-');
  if (!y || !m || !d) return String(iso);
  return `${d}.${m}.${y}`;
}

function matchesServiceTab(service, tab) {
  if (tab === 'all') return true;
  const id = String(service.id || '').toLowerCase();
  const cat = String(service.category || '').toLowerCase();
  const name = String(service.label || service.name || '').toLowerCase();
  const blob = `${id} ${cat} ${name}`;
  if (tab === 'crowns') return /orto|crown|karonka|toj|veneer|vinir/.test(blob);
  if (tab === 'abutment') return /komponent|abutment|abatment|formik|healing|cover_screw|zaglushka/.test(blob);
  if (tab === 'sinus') return /sinus/.test(blob);
  if (tab === 'bone') return /graft|regen|prf|suyak|bone|membrane|nkr|sst/.test(blob);
  return true;
}

function DateField({ value, onChange, className }) {
  return (
    <div className={cn('relative', className)}>
      <div className="h-10 px-3 rounded-[10px] border border-[#e5e7eb] bg-white flex items-center text-sm text-[#111827] font-medium">
        {toDMY(value) || 'DD.MM.YYYY'}
      </div>
      <input
        type="date"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 cursor-pointer"
      />
    </div>
  );
}

function MoneyField({ value, onChange, className }) {
  return (
    <div className={cn('relative', className)}>
      <input
        inputMode="numeric"
        value={formatSom(value)}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '');
          onChange(digits === '' ? 0 : Number(digits));
        }}
        className="h-10 w-full rounded-[10px] border border-[#e5e7eb] bg-white px-3 pr-12 text-sm text-[#111827] font-medium outline-none focus:border-[#0d9488] focus:ring-1 focus:ring-[#0d9488]/20"
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#6b7280]">so&apos;m</span>
    </div>
  );
}

const fieldInput =
  'h-10 rounded-[10px] border border-[#e5e7eb] bg-white text-sm text-[#111827] font-medium shadow-none focus-visible:ring-[#0d9488]/20 focus-visible:border-[#0d9488]';
const cardClass = 'bg-white rounded-xl border border-[#e5e7eb] p-4';
const wizardDialogStyle = {
  maxWidth: 920,
  width: 'min(920px, 95vw)',
  maxHeight: 'min(92vh, 820px)',
  padding: 0,
  gap: 0,
  borderRadius: 16,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  background: '#f3f4f6',
};

export default function ImplantForm({ open, onClose, patients, services: _services, implant, relatedImplants = [], onSaved }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const today = getToday();
  const tw = (key, fallback) => t(`implants.wizard.${key}`, fallback);

  const [form, setForm] = useState({
    patient_id: '',
    patient_name: '',
    patient_phone: '',
    tooth_numbers: [],
    service_name: 'Implant',
    service_custom: '',
    price: 1500000,
    implant_type: 'Bone level',
    firma: 'Osstem',
    firma_custom: '',
    brend: '',
    diameter: '',
    length: '',
    lot_number: '',
    torque: '',
    isq: '',
    bone_type: 'D2',
    placement_date: today,
    doctor: '',
    lifecycle_status: 'placed',
    reminder_months: 1,
    reminder_date: addMonths(today, 1),
    notes: '',
    extra_services: [],
    xray_urls: [],
    passport_url: '',
    timeline: [],
    complications: [],
    audit_log: [],
  });

  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(1);
  const [newPatientOpen, setNewPatientOpen] = useState(false);
  const [localPatients, setLocalPatients] = useState(patients);
  const [doctors, setDoctors] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [toothDataMap, setToothDataMap] = useState({});
  const [selectedToothForModal, setSelectedToothForModal] = useState(null);
  const [toothModalOpen, setToothModalOpen] = useState(false);
  const [extraServicePrices, setExtraServicePrices] = useState({});
  const [extraServicesList, setExtraServicesList] = useState(EXTRA_SERVICES);
  const [, setIsSchemaOptimized] = useState(true);
  const [extraSearch, setExtraSearch] = useState('');
  const [extraTab, setExtraTab] = useState('all');
  const [editingPriceId, setEditingPriceId] = useState(null);

  useEffect(() => {
    setLocalPatients(patients);
  }, [patients]);

  useEffect(() => {
    if (!open) return;
    getOrSeedExtraServices().then((res) => {
      setExtraServicesList(mergeExtraServicesCatalog(res, [...EXTRA_SERVICES, ...DEFAULT_EXTRA_SERVICES]));
    }).catch(() => {
      setExtraServicesList(mergeExtraServicesCatalog([], [...EXTRA_SERVICES, ...DEFAULT_EXTRA_SERVICES]));
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const loadClinicDoctors = async () => {
      try {
        let docList = [];
        const allUsers = await base44.entities.User.list('name', 100);
        if (Array.isArray(allUsers) && allUsers.length > 0) {
          docList = allUsers.filter((u) => u.role === 'doctor' || u.role === 'admin' || !u.role);
        }
        const local = JSON.parse(localStorage.getItem('system_users') || '[]');
        if (Array.isArray(local) && local.length > 0) {
          local.forEach((lu) => {
            const luName = lu.full_name || lu.name;
            if (luName && !docList.some((d) => (d.full_name || d.name) === luName || d.id === lu.id)) {
              docList.push(lu);
            }
          });
        }
        setDoctors(docList);
      } catch (err) {
        console.error('Failed to load clinic doctors:', err);
        const local = JSON.parse(localStorage.getItem('system_users') || '[]');
        setDoctors(local);
      }
    };
    loadClinicDoctors();
  }, [open]);

  const resetForm = useCallback(() => {
    setForm({
      patient_id: '',
      patient_name: '',
      patient_phone: '',
      tooth_numbers: [],
      service_name: 'Implant',
      service_custom: '',
      price: 1500000,
      implant_type: 'Bone level',
      firma: 'Osstem',
      firma_custom: '',
      brend: '',
      diameter: '',
      length: '',
      lot_number: '',
      torque: '',
      isq: '',
      bone_type: 'D2',
      placement_date: today,
      doctor: '',
      lifecycle_status: 'placed',
      reminder_months: 1,
      reminder_date: addMonths(today, 1),
      notes: '',
      extra_services: [],
      xray_urls: [],
      passport_url: '',
      timeline: [],
      complications: [],
      audit_log: [],
    });
  }, [today]);

  useEffect(() => {
    if (!open) return;

    const checkSchema = () => {
      const stripped = JSON.parse(localStorage.getItem('base44_stripped_columns_implants') || '[]');
      const techFields = ['diameter', 'torque', 'isq', 'brend', 'firma'];
      const missingCount = techFields.filter((f) => stripped.includes(f)).length;
      setIsSchemaOptimized(missingCount === 0);
    };
    checkSchema();

    if (implant) {
      const rawTeeth = [...(implant.tooth_numbers || []), ...(implant.tooth_number ? [implant.tooth_number] : [])];
      const uniqueTeeth = [...new Set(rawTeeth.map(String))].filter(Boolean);
      const uniqueServices = [...new Set((implant.extra_services || []).map(normalizeServiceId))].filter(Boolean);

      setForm({
        ...implant,
        tooth_numbers: uniqueTeeth,
        extra_services: uniqueServices,
      });
      if (implant.extra_service_prices && typeof implant.extra_service_prices === 'object') {
        setExtraServicePrices(implant.extra_service_prices);
      }

      let initialToothMap = {};
      if (implant.tooth_data_map && typeof implant.tooth_data_map === 'object') {
        initialToothMap = { ...implant.tooth_data_map };
      }
      if (relatedImplants && relatedImplants.length > 0) {
        relatedImplants.forEach((imp) => {
          const tId = imp.tooth_id || imp.tooth_number;
          if (tId) {
            initialToothMap[tId] = {
              ...(initialToothMap[tId] || {}),
              service_name: imp.service_name || imp.hizmat_turi || 'Implant',
              price: imp.price || imp.narxi || 1500000,
              firma: (imp.firma === 'Boshqa' ? imp.firma_custom : imp.firma) || imp.firma || 'Osstem',
              firma_custom: imp.firma_custom || '',
              brend: imp.brend || '',
              diameter: imp.diameter || '',
              length: imp.length || '',
              lot_number: imp.lot_number || '',
              torque: imp.torque !== undefined ? imp.torque : '',
              isq: imp.isq !== undefined ? imp.isq : '',
              bone_type: imp.bone_type || 'D2',
              implant_type: imp.implant_type || 'Bone level',
              notes: imp.notes || '',
            };
          }
        });
      }

      uniqueTeeth.forEach((tId) => {
        const fdi = toFdi(tId);
        const existing = initialToothMap[tId] || initialToothMap[fdi];
        if (!existing) {
          initialToothMap[tId] = {
            service_name: implant.service_name || 'Implant',
            price: implant.price || 1500000,
            firma: (implant.firma === 'Boshqa' ? implant.firma_custom : implant.firma) || implant.firma || 'Osstem',
            firma_custom: implant.firma_custom || '',
            brend: implant.brend || '',
            diameter: implant.diameter || '',
            length: implant.length || '',
            lot_number: implant.lot_number || '',
            torque: implant.torque !== undefined ? implant.torque : '',
            isq: implant.isq !== undefined ? implant.isq : '',
            bone_type: implant.bone_type || 'D2',
            implant_type: implant.implant_type || 'Bone level',
            notes: implant.notes || '',
          };
        }
      });
      setToothDataMap(initialToothMap);
    } else {
      resetForm();
      setToothDataMap({});
      setExtraServicePrices({});
      setExtraSearch('');
      setExtraTab('all');
    }
    setStep(1);
  }, [open, implant?.id, resetForm]);

  useEffect(() => {
    if (!open || form.doctor) return;
    const currentUserName = user?.full_name || user?.name;
    const match = doctors.find((d) => (d.full_name || d.name) === currentUserName) || doctors[0];
    const name = match
      ? (match.full_name || match.name || match.username || '')
      : (currentUserName || '');
    if (name) {
      setForm((prev) => prev.doctor ? prev : { ...prev, doctor: name });
    }
  }, [open, doctors, form.doctor, user]);

  const setField = useCallback((key, val) => {
    setForm((prev) => ({ ...prev, [key]: val }));
  }, []);

  const toggleExtraService = (serviceId) => {
    setForm((prev) => {
      const current = prev.extra_services || [];
      if (current.includes(serviceId)) {
        return { ...prev, extra_services: current.filter((id) => id !== serviceId) };
      }
      return { ...prev, extra_services: [...current, serviceId] };
    });
  };

  const compressImage = (file, maxWidth = 1200, maxHeight = 1200, quality = 0.7) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > maxWidth) {
              height *= maxWidth / width;
              width = maxWidth;
            }
          } else if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = (error) => reject(error);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const pruneToothDataMap = useCallback((nextTeeth) => {
    const keep = new Set((nextTeeth || []).map(String));
    const keepFdi = new Set([...keep].map(toFdi));
    setToothDataMap((prev) => {
      const next = {};
      Object.keys(prev || {}).forEach((key) => {
        const fdi = toFdi(key);
        if (keep.has(String(key)) || keepFdi.has(String(key)) || keepFdi.has(fdi)) {
          next[key] = prev[key];
        }
      });
      return next;
    });
  }, []);

  const toggleFdi = useCallback((fdi) => {
    const id = String(fdi);
    setForm((prev) => {
      const current = (prev.tooth_numbers || []).map(String);
      const exists = current.some((n) => toFdi(n) === id);
      const nextTeeth = exists
        ? current.filter((n) => toFdi(n) !== id)
        : [...current, id];
      if (exists) pruneToothDataMap(nextTeeth);
      return { ...prev, tooth_numbers: nextTeeth };
    });
  }, [pruneToothDataMap]);

  const handlePatientSelect = useCallback((patientId) => {
    if (!patientId) {
      setForm((prev) => ({ ...prev, patient_id: '', patient_name: '', patient_phone: '' }));
      return;
    }
    const patient = localPatients.find((p) => p.id === patientId);
    setForm((prev) => ({
      ...prev,
      patient_id: patientId,
      patient_name: patient?.full_name || prev.patient_name || '',
      patient_phone: patient?.phone || '',
    }));
  }, [localPatients]);

  const handleReminderMonths = useCallback((months) => {
    if (months === 'custom') {
      setForm((prev) => ({ ...prev, reminder_months: 'custom' }));
    } else {
      const reminderDate = addMonths(form.placement_date || today, months);
      setForm((prev) => ({
        ...prev,
        reminder_months: months,
        reminder_date: reminderDate,
      }));
    }
  }, [form.placement_date, today]);

  const handleDateChange = useCallback((value) => {
    const months = typeof form.reminder_months === 'number' ? form.reminder_months : 1;
    const reminderDate = addMonths(value, months);
    setForm((prev) => ({
      ...prev,
      placement_date: value,
      reminder_date: prev.reminder_months === 'custom' ? prev.reminder_date : reminderDate,
    }));
  }, [form.reminder_months]);

  const handleXrayUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);
    try {
      const promises = files.map((file) => compressImage(file));
      const compressedBase64s = await Promise.all(promises);
      setForm((prev) => ({
        ...prev,
        xray_urls: [...(prev.xray_urls || []), ...compressedBase64s],
      }));
    } catch (error) {
      console.error('X-ray upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  const handlePassportUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const compressedBase64 = await compressImage(file);
      setField('passport_url', compressedBase64);
    } catch (error) {
      console.error('Passport upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  const removeXray = useCallback((index) => {
    setForm((prev) => ({
      ...prev,
      xray_urls: prev.xray_urls.filter((_, i) => i !== index),
    }));
  }, []);

  const handleSave = async () => {
    if (!form.patient_name) {
      alert(tw('needPatient', 'Iltimos, avval bemorni tanlang!'));
      setStep(1);
      return;
    }
    if (!form.doctor || !form.doctor.trim()) {
      alert(tw('needDoctor', "Iltimos, mas'ul shifokorni tanlang! Shifokor bo'limi to'ldirilmagan."));
      return;
    }
    if (!form.tooth_numbers || form.tooth_numbers.length === 0) {
      alert(tw('needTeeth', "Iltimos, implant o'rnatiladigan tish(lar)ni belgilang!"));
      setStep(1);
      return;
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const auditLog = [
        ...(form.audit_log || []),
        { date: now, user: 'Dr.', action: implant ? t('common.edit') : t('common.addNew') },
      ];
      const timeline = [
        ...(form.timeline || []),
        { date: now, status: form.lifecycle_status, note: implant ? t('common.edit') : t('implants.status.planned') },
      ];

      const fdiNumbers = form.tooth_numbers.map(toFdi);

      let safeReminderMonths = 1;
      if (typeof form.reminder_months === 'number') {
        safeReminderMonths = form.reminder_months;
      } else if (typeof form.reminder_months === 'string' && !isNaN(parseInt(form.reminder_months, 10)) && form.reminder_months !== 'custom') {
        safeReminderMonths = parseInt(form.reminder_months, 10);
      } else if (form.reminder_date && form.placement_date) {
        const pDate = new Date(form.placement_date);
        const rDate = new Date(form.reminder_date);
        const diffMonths = (rDate.getFullYear() - pDate.getFullYear()) * 12 + (rDate.getMonth() - pDate.getMonth());
        safeReminderMonths = Math.max(1, diffMonths || 1);
      }

      const mergedService = form.service_name || 'Implant';
      const mergedPrice = Number(form.price) || 0;

      const cleanedToothMap = {};
      (form.tooth_numbers || []).forEach((toothId) => {
        const tid = String(toothId);
        const fdi = toFdi(tid);
        const entry = toothDataMap[tid] || toothDataMap[fdi];
        if (entry) {
          cleanedToothMap[tid] = entry;
          cleanedToothMap[fdi] = entry;
        }
      });

      const firstToothId = form.tooth_numbers[0];
      const firstToothFdi = toFdi(firstToothId);
      const firstToothData = cleanedToothMap[firstToothId] || cleanedToothMap[firstToothFdi] || {};

      const finalDiameter = (firstToothData.diameter !== undefined && firstToothData.diameter !== '') ? firstToothData.diameter : (form.diameter || '');
      const finalLength = (firstToothData.length !== undefined && firstToothData.length !== '') ? firstToothData.length : (form.length || '');
      const finalLot = (firstToothData.lot_number !== undefined && firstToothData.lot_number !== '') ? firstToothData.lot_number : (form.lot_number || '');
      const finalTorque = (firstToothData.torque !== undefined && firstToothData.torque !== '') ? firstToothData.torque : (form.torque !== undefined ? form.torque : '');
      const finalIsq = (firstToothData.isq !== undefined && firstToothData.isq !== '') ? firstToothData.isq : (form.isq !== undefined ? form.isq : '');
      const finalBone = firstToothData.bone_type || form.bone_type || 'D2';
      const finalFirma = firstToothData.firma || form.firma || 'Osstem';
      const finalFirmaCustom = firstToothData.firma_custom || form.firma_custom || '';
      const finalBrend = firstToothData.brend || form.brend || finalFirma;
      const finalImplantType = firstToothData.implant_type || form.implant_type || 'Bone level';

      const seenPriceKeys = new Set();
      let mapPriceSum = 0;
      let mapPriceCount = 0;
      (form.tooth_numbers || []).forEach((toothId) => {
        const tid = String(toothId);
        const fdi = toFdi(tid);
        const priceKey = fdi || tid;
        if (seenPriceKeys.has(priceKey)) return;
        seenPriceKeys.add(priceKey);
        const entry = cleanedToothMap[tid] || cleanedToothMap[fdi];
        if (entry && entry.price != null && entry.price !== '') {
          mapPriceSum += Number(entry.price) || 0;
          mapPriceCount += 1;
        }
      });
      const finalPrice = mapPriceCount > 0 ? mapPriceSum : mergedPrice;

      const data = {
        ...form,
        firma: finalFirma,
        firma_custom: finalFirmaCustom,
        brend: finalBrend,
        diameter: finalDiameter,
        length: finalLength,
        lot_number: finalLot,
        torque: finalTorque,
        isq: finalIsq,
        bone_type: finalBone,
        implant_type: finalImplantType,
        service_name: mergedService,
        hizmat_turi: mergedService,
        price: finalPrice,
        narxi: finalPrice,
        extra_service_prices: extraServicePrices,
        reminder_months: safeReminderMonths,
        tooth_number: fdiNumbers[0] || '',
        tooth_id: form.tooth_numbers[0] || '',
        tooth_numbers: form.tooth_numbers,
        incomplete_data: false,
        needs_fill: false,
        audit_log: auditLog,
        timeline,
        tooth_data_map: cleanedToothMap,
      };

      if (implant && implant.id) {
        await base44.entities.Implant.update(implant.id, data);
      } else {
        await base44.entities.Implant.create(data);
      }

      onSaved();
      onClose();
    } catch (error) {
      console.error('Save failed:', error);
      alert(t('common.saveError') + ': ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleNewPatientSaved = async (newPatient) => {
    try {
      if (newPatient && newPatient.id) {
        setLocalPatients((prev) => {
          if (prev.find((p) => p.id === newPatient.id)) return prev;
          return [newPatient, ...prev];
        });
        setForm((prev) => ({
          ...prev,
          patient_id: newPatient.id,
          patient_name: newPatient.full_name || '',
          patient_phone: newPatient.phone || '',
        }));
      }
    } catch (error) {
      console.error('Failed to refresh patients:', error);
    }
  };

  const handleToothDataSave = (toothId, data) => {
    const fdi = toFdi(toothId);
    setToothDataMap((prev) => ({
      ...prev,
      [toothId]: data,
      [fdi]: data,
    }));
  };

  const openToothModal = (rawId) => {
    const toothId = String(rawId);
    setForm((prev) => {
      const currentTeeth = (prev.tooth_numbers || []).map(String);
      const fdi = toFdi(toothId);
      if (!currentTeeth.includes(toothId) && !currentTeeth.some((n) => toFdi(n) === fdi)) {
        return { ...prev, tooth_numbers: [...currentTeeth, fdi] };
      }
      return prev;
    });
    setSelectedToothForModal(toothId);
    setToothModalOpen(true);
  };

  const selectedFdis = useMemo(() => uniqueFdis(form.tooth_numbers), [form.tooth_numbers]);
  const brandLabel = form.firma === 'Boshqa' ? (form.firma_custom || tw('other', 'Boshqa')) : (form.firma || 'Osstem');
  const extraTotal = useMemo(() => (form.extra_services || []).reduce((acc, sid) => {
    const preset = (extraServicesList || []).find((s) => s.id === sid);
    const customPrice = extraServicePrices[sid];
    return acc + (customPrice !== undefined ? Number(customPrice) : (preset?.defaultPrice || 0));
  }, 0), [form.extra_services, extraServicesList, extraServicePrices]);
  const implantTotal = (Number(form.price) || 0) * (selectedFdis.length || 0);
  const grandTotal = implantTotal + extraTotal;

  const filteredExtras = useMemo(() => {
    const q = extraSearch.trim().toLowerCase();
    return (extraServicesList || []).filter((s) => {
      if (!matchesServiceTab(s, extraTab)) return false;
      if (!q) return true;
      const label = getServiceLabel(s, t).toLowerCase();
      return label.includes(q) || String(s.id).toLowerCase().includes(q);
    });
  }, [extraServicesList, extraTab, extraSearch, t]);

  const seedToothParams = useCallback(() => {
    setToothDataMap((prev) => {
      const next = { ...prev };
      selectedFdis.forEach((fdi) => {
        if (!next[fdi]) {
          next[fdi] = {
            service_name: form.service_name || 'Implant',
            price: form.price || 1500000,
            firma: form.firma || 'Osstem',
            firma_custom: form.firma_custom || '',
            brend: form.brend || '',
            diameter: form.diameter || '',
            length: form.length || '',
            lot_number: form.lot_number || '',
            torque: form.torque !== undefined ? form.torque : '',
            isq: form.isq !== undefined ? form.isq : '',
            bone_type: form.bone_type || 'D2',
            implant_type: form.implant_type || 'Bone level',
            notes: '',
          };
        }
      });
      return next;
    });
  }, [selectedFdis, form]);

  const setToothParam = (fdi, key, val) => {
    setToothDataMap((prev) => ({
      ...prev,
      [fdi]: {
        service_name: 'Implant',
        price: form.price || 1500000,
        firma: form.firma || 'Osstem',
        ...(prev[fdi] || {}),
        [key]: val,
      },
    }));
  };

  const goNextFrom1 = () => {
    if (!form.patient_name) {
      alert(tw('needPatient', 'Iltimos, avval bemorni tanlang!'));
      return;
    }
    if (!selectedFdis.length) {
      alert(tw('needTeeth', "Iltimos, implant o'rnatiladigan tishni tanlang!"));
      return;
    }
    setStep(2);
  };

  const goNextFrom2 = () => {
    seedToothParams();
    setStep(3);
  };

  const isStep3Valid = !!form.placement_date;

  const renderStepper = () => {
    const steps = [
      { n: 1, label: tw('stepPatient', 'Bemor') },
      { n: 2, label: tw('stepServices', 'Xizmatlar') },
      { n: 3, label: tw('stepImplants', 'Implantlar') },
    ];
    return (
      <div className="bg-white px-5 sm:px-6 py-3 border-b border-[#e5e7eb] shrink-0">
        <div className="flex items-center">
          {steps.map((s, i) => {
            const done = step > s.n;
            const active = step === s.n;
            return (
              <div key={s.n} className="flex items-center flex-1 last:flex-none">
                <button
                  type="button"
                  onClick={() => (step >= s.n || done) && setStep(s.n)}
                  className="flex items-center gap-2 bg-transparent border-0 p-0 cursor-pointer"
                >
                  <span className={cn(
                    'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                    done || active ? 'bg-[#0d9488] text-white' : 'bg-white text-[#9ca3af] border border-[#e5e7eb]'
                  )}>
                    {done ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : s.n}
                  </span>
                  <span className={cn(
                    'text-sm font-semibold whitespace-nowrap',
                    done || active ? 'text-[#0d9488]' : 'text-[#9ca3af]'
                  )}>
                    {s.n} {s.label}
                  </span>
                </button>
                {i < steps.length - 1 && (
                  <div className={cn('h-px flex-1 mx-3', step > s.n ? 'bg-[#0d9488]' : 'bg-[#e5e7eb]')} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderStep1 = () => (
    <div className="flex flex-col md:flex-row gap-4 min-h-0">
      <aside className="w-full md:w-[240px] shrink-0 bg-white rounded-xl border border-[#e5e7eb] p-4 flex flex-col gap-3 relative z-20">
        <div>
          <h3 className="text-[15px] font-bold text-[#111827]">{tw('stepPatient', 'Bemor')}</h3>
          <div className="mt-1 h-[3px] w-10 rounded-full bg-[#0d9488]" />
        </div>
        <PatientSelect
          patients={localPatients}
          value={form.patient_id}
          initialName={form.patient_name}
          onChange={handlePatientSelect}
          placeholder={tw('searchPatient', 'Bemor qidirish...')}
          inputClassName="bg-white border-[#e5e7eb] h-10 rounded-[10px] text-sm"
        />
        {form.patient_name && (
          <div className="flex items-center justify-between gap-2 px-3 h-11 rounded-[10px] border border-[#0d9488] bg-white">
            <span className="text-sm font-semibold text-[#111827] truncate">{form.patient_name}</span>
            <span className="w-5 h-5 rounded-full bg-[#0d9488] text-white flex items-center justify-center shrink-0">
              <Check className="w-3 h-3" strokeWidth={3} />
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={() => setNewPatientOpen(true)}
          className="h-11 rounded-[10px] border border-[#e5e7eb] bg-white text-[#0d9488] text-sm font-semibold hover:bg-[#f0fdfa] flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> {tw('newPatient', 'Yangi bemor')}
        </button>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col gap-4">
        <section className={cardClass}>
          <h3 className="text-[15px] font-bold text-[#111827] mb-3">{tw('implantParams', 'Implant parametrlari')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <DateField value={form.placement_date} onChange={handleDateChange} />
            <div>
              <Select
                value={form.firma}
                onValueChange={(v) => {
                  setForm((prev) => ({
                    ...prev,
                    firma: v,
                    firma_custom: v === 'Boshqa' ? prev.firma_custom : '',
                    brend: v === 'Boshqa' ? (prev.firma_custom || prev.brend) : prev.brend,
                  }));
                }}
              >
                <SelectTrigger className={fieldInput}>
                  <SelectValue placeholder={tw('brand', 'Brend')} />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {BRANDS.map((f) => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.firma === 'Boshqa' && (
                <Input
                  placeholder={tw('brandName', 'Firma nomini yozing...')}
                  value={form.firma_custom}
                  onChange={(e) => setField('firma_custom', e.target.value)}
                  className={cn(fieldInput, 'mt-1.5')}
                />
              )}
            </div>
            <MoneyField value={form.price} onChange={(v) => setField('price', v)} />
          </div>
        </section>

        <section className={cn(cardClass, 'flex-1')}>
          <h3 className="text-[15px] font-bold text-[#111827] mb-1">{tw('selectTeeth', 'Tishlarni belgilang')}</h3>
          <ImplantWizardArch selectedFdis={selectedFdis} onToggle={toggleFdi} />
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => { setField('tooth_numbers', []); setToothDataMap({}); }}
              className="h-8 px-3 rounded-[10px] border border-[#e5e7eb] bg-white text-sm text-[#6b7280] hover:bg-gray-50 cursor-pointer"
            >
              {tw('clear', 'Tozalash')}
            </button>
            <p className="text-sm font-semibold text-[#111827]">
              {tw('selectedCountPrefix', 'Tanlangan:')}{' '}
              <span className="text-[#0d9488]">{selectedFdis.length} {tw('teethUnit', 'ta tish')}</span>
            </p>
          </div>
        </section>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <ImplantWizardStep2
      selectedFdis={selectedFdis}
      brandLabel={brandLabel}
      extraServicesList={filteredExtras}
      extraSearch={extraSearch}
      setExtraSearch={setExtraSearch}
      extraTab={extraTab}
      setExtraTab={setExtraTab}
      selectedServiceIds={form.extra_services || []}
      extraServicePrices={extraServicePrices}
      editingPriceId={editingPriceId}
      setEditingPriceId={setEditingPriceId}
      onToggleService={toggleExtraService}
      onSetPrice={(id, price) => setExtraServicePrices((prev) => ({ ...prev, [id]: price }))}
      onBackToStep1={() => setStep(1)}
      tw={tw}
      t={t}
    />
  );

  const renderStep3 = () => (
    <div className="flex flex-col gap-4">
      <section className={cardClass}>
        <h3 className="text-[15px] font-bold text-[#111827] mb-3">{tw('dateStatus', 'Sana va holat')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <DateField value={form.placement_date} onChange={handleDateChange} />
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none z-10" />
            <Select value={form.lifecycle_status} onValueChange={(v) => setField('lifecycle_status', v)}>
              <SelectTrigger className={cn(fieldInput, 'pl-9')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {LIFECYCLE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{t(`implants.status.${s}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <section className={cardClass}>
        <h3 className="text-[15px] font-bold text-[#111827] mb-3">{tw('perToothParams', 'Har bir tish uchun parametr')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {selectedFdis.map((fdi) => {
            const data = toothDataMap[fdi] || toothDataMap[form.tooth_numbers.find((n) => toFdi(n) === fdi)] || {};
            return (
              <div key={fdi} className="rounded-xl border border-[#e5e7eb] p-2.5">
                <button
                  type="button"
                  onClick={() => openToothModal(fdi)}
                  className="text-sm font-bold text-[#0d9488] mb-2 bg-transparent border-0 p-0 cursor-pointer hover:underline"
                >
                  #{fdi}
                </button>
                <div className="grid grid-cols-4 gap-1">
                  {[
                    { key: 'diameter', ph: 'Ø' },
                    { key: 'length', ph: 'L' },
                    { key: 'torque', ph: 'Ncm' },
                    { key: 'lot_number', ph: 'Lot' },
                  ].map((fld) => (
                    <input
                      key={fld.key}
                      value={data[fld.key] ?? ''}
                      onChange={(e) => setToothParam(fdi, fld.key, e.target.value)}
                      placeholder={fld.ph}
                      className="h-8 rounded-md border border-[#e5e7eb] bg-white px-1 text-center text-[11px] font-medium outline-none focus:border-[#0d9488]"
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className={cardClass}>
        <h3 className="text-[15px] font-bold text-[#111827] mb-3">{tw('followUp', 'Nazorat eslatmasi')}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {REMINDER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleReminderMonths(opt.value)}
              className={cn(
                'h-10 rounded-[10px] border text-sm font-medium cursor-pointer',
                form.reminder_months === opt.value
                  ? 'bg-white border-[#0d9488] text-[#0d9488]'
                  : 'bg-white border-[#e5e7eb] text-[#6b7280] hover:border-[#cbd5e1]'
              )}
            >
              {tw(opt.labelKey, `${opt.value} oy`)}
            </button>
          ))}
          <button
            type="button"
            onClick={() => handleReminderMonths('custom')}
            className={cn(
              'h-10 rounded-[10px] border text-sm font-medium cursor-pointer',
              form.reminder_months === 'custom'
                ? 'bg-white border-[#0d9488] text-[#0d9488]'
                : 'bg-white border-[#e5e7eb] text-[#6b7280] hover:border-[#cbd5e1]'
            )}
          >
            {tw('custom', 'Boshqa')}
          </button>
        </div>
        <div className="mt-2">
          {form.reminder_months === 'custom' ? (
            <DateField value={form.reminder_date} onChange={(v) => setField('reminder_date', v)} />
          ) : (
            <div className="h-10 rounded-[10px] border border-[#e5e7eb] bg-white flex items-center justify-center text-sm text-[#6b7280]">
              {toDMY(form.reminder_date)}
            </div>
          )}
        </div>
      </section>

      <section className={cardClass}>
        <h3 className="text-[15px] font-bold text-[#111827] mb-3">{tw('docs', 'Hujjatlar')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-2.5">
          <label className="flex items-center justify-center h-11 rounded-[10px] border border-dashed border-[#d1d5db] text-sm text-[#6b7280] cursor-pointer hover:border-[#0d9488] hover:text-[#0d9488] hover:bg-[#f0fdfa] transition-colors">
            <input type="file" className="hidden" onChange={handlePassportUpload} />
            <FileText className="w-4 h-4 mr-1.5" />
            {tw('passport', 'Pasport')}
            {uploading ? '…' : ''}
          </label>
          <label className="flex items-center justify-center h-11 rounded-[10px] border border-dashed border-[#d1d5db] text-sm text-[#6b7280] cursor-pointer hover:border-[#0d9488] hover:text-[#0d9488] hover:bg-[#f0fdfa] transition-colors">
            <input type="file" className="hidden" multiple onChange={handleXrayUpload} />
            <ImageIcon className="w-4 h-4 mr-1.5" />
            {tw('xray', 'Rentgen')}
          </label>
        </div>
        {form.passport_url && (
          <div className="relative w-24 h-16 rounded-lg overflow-hidden border border-[#e5e7eb] mb-2">
            <img src={form.passport_url} alt="" className="w-full h-full object-cover" />
            <button type="button" onClick={() => setField('passport_url', '')} className="absolute top-0.5 right-0.5 w-4 h-4 bg-rose-500 text-white rounded-full flex items-center justify-center">
              <X className="w-2.5 h-2.5" />
            </button>
          </div>
        )}
        {form.xray_urls?.length > 0 && (
          <div className="flex gap-1.5 mb-2 flex-wrap">
            {form.xray_urls.map((url, idx) => (
              <div key={idx} className="relative w-14 h-14 rounded-lg overflow-hidden border border-[#e5e7eb]">
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button type="button" onClick={() => removeXray(idx)} className="absolute top-0.5 right-0.5 w-4 h-4 bg-rose-500 text-white rounded-full flex items-center justify-center">
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <input
          value={form.notes || ''}
          onChange={(e) => setField('notes', e.target.value)}
          placeholder={tw('notes', 'Izoh')}
          className="w-full h-10 rounded-[10px] border border-[#e5e7eb] bg-white px-3 text-sm outline-none focus:border-[#0d9488]"
        />
      </section>
    </div>
  );

  const footerSummary = () => {
    if (step === 1) {
      return (
        <p className="text-sm font-semibold text-[#0d9488]">
          {selectedFdis.length} {tw('toothShort', 'tish')} · {brandLabel}
        </p>
      );
    }
    if (step === 2) {
      return (
        <div className="flex items-center gap-6 text-sm">
          <span className="text-[#6b7280]">
            {tw('selectedServicesPrefix', 'Tanlangan:')}{' '}
            <span className="font-semibold text-[#111827]">{form.extra_services?.length || 0} {tw('serviceUnit', 'xizmat')}</span>
          </span>
          <span className="text-[#6b7280]">
            {tw('total', 'Jami:')}{' '}
            <span className="font-bold text-[#0d9488] text-base">{formatSom(extraTotal)} so&apos;m</span>
          </span>
        </div>
      );
    }
    return (
      <p className="text-sm text-[#6b7280]">
        {tw('total', 'Jami:')}{' '}
        <span className="font-bold text-[#0d9488] text-base">{formatSom(grandTotal)} so&apos;m</span>
      </p>
    );
  };

  const badgeText = selectedFdis.length
    ? tw('teethSelectedBadge', '{n} ta tish tanlandi').replace('{n}', selectedFdis.length)
    : tw('teethBadge', '{n} ta tish').replace('{n}', selectedFdis.length);

  return (
    <>
      <Dialog open={open && !newPatientOpen} onOpenChange={onClose}>
        <DialogContent
          className="implant-wizard-dialog !flex !flex-col !p-0 !gap-0 w-[95vw] !max-w-[920px] max-h-[92vh] overflow-hidden !rounded-2xl sm:!rounded-2xl border border-[#e5e7eb] bg-[#f3f4f6] shadow-2xl"
          style={wizardDialogStyle}
          data-implant-wizard={IMPLANT_WIZARD_STEP2_MARKER}
          aria-describedby={undefined}
        >
          <DialogHeader className="shrink-0 space-y-0">
            <div className="h-14 px-5 flex items-center justify-between text-white" style={{ background: '#0d9488' }}>
              <DialogTitle className="text-[15px] font-bold tracking-wide text-white uppercase">
                {implant ? t('common.edit') : tw('title', 'Yangi implant')}
              </DialogTitle>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold uppercase tracking-wide hidden sm:inline">
                  {form.patient_name || tw('noPatient', 'Bemor tanlanmagan')}
                </span>
                <span className="h-8 px-3 rounded-full bg-white/15 border border-white/25 text-xs font-semibold flex items-center gap-1.5">
                  <Tooth className="w-3.5 h-3.5" />
                  {badgeText}
                </span>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center border-0 cursor-pointer"
                  aria-label={t('common.close', 'Yopish')}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </DialogHeader>

          {renderStepper()}

          <div className="flex-1 overflow-y-auto px-4 py-4 no-scrollbar bg-[#f3f4f6]">
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
          </div>

          <div className="implant-wizard-footer">
            {step === 2 ? (
              <div className="flex items-center gap-6 text-sm min-w-0 flex-1">
                <span className="text-[#6b7280]">
                  {tw('selectedServicesPrefix', 'Tanlangan:')}{' '}
                  <span className="font-semibold text-[#111827]">{form.extra_services?.length || 0} {tw('serviceUnit', 'xizmat')}</span>
                </span>
                <span className="text-[#6b7280]">
                  {tw('total', 'Jami:')}{' '}
                  <span className="font-bold text-base" style={{ color: '#0d9488' }}>{formatSom(extraTotal)} so&apos;m</span>
                </span>
              </div>
            ) : (
              <div className="flex-1 min-w-0">{footerSummary()}</div>
            )}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => (step === 1 ? onClose() : setStep(step - 1))}
                className="implant-wizard-ghost"
              >
                <ArrowLeft className="w-4 h-4" /> {tw('back', 'Orqaga')}
              </button>
              {step < 3 ? (
                <button
                  type="button"
                  onClick={step === 1 ? goNextFrom1 : goNextFrom2}
                  className="implant-wizard-cta"
                  style={{ backgroundColor: '#0d9488', color: '#fff' }}
                >
                  {tw('next', 'Keyingisi')} <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || !isStep3Valid}
                  className="implant-wizard-cta"
                  style={{ backgroundColor: '#0d9488', color: '#fff' }}
                >
                  {saving ? t('common.saving') : tw('saveFinish', 'Saqlash va yakunlash')}
                  <Check className="w-4 h-4" strokeWidth={3} />
                </button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <PatientModal
        open={newPatientOpen}
        onClose={() => setNewPatientOpen(false)}
        patient={null}
        onSaved={handleNewPatientSaved}
      />

      <ToothImplantModal
        open={toothModalOpen}
        onClose={() => setToothModalOpen(false)}
        toothId={selectedToothForModal}
        fdiNumber={selectedToothForModal ? toFdi(selectedToothForModal) : ''}
        onSave={handleToothDataSave}
        existingData={(() => {
          if (!selectedToothForModal) return null;
          const fdi = toFdi(selectedToothForModal);
          return toothDataMap[selectedToothForModal] || toothDataMap[fdi] || null;
        })()}
      />
    </>
  );
}
