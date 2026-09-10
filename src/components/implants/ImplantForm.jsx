import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Upload, FileText, X, Check, Calendar, User, Activity, Info, Shield, Layers, Stethoscope, Image as ImageIcon, Sparkles } from 'lucide-react';
import { ImplantIcon } from '@/components/ui/Icons';
import PatientModal from '../patients/PatientModal';
import PatientSelect from '../patients/PatientSelect';
import ProfessionalOdontogram from '../patients/ProfessionalOdontogram';
import ToothImplantModal from './ToothImplantModal';
import { useTranslation } from '@/i18n/LanguageContext';
import { getOrSeedExtraServices } from './ExtraServicesManagerModal';

// Constants
const FIRMALAR = ['Nobel', 'Osstem', 'Straumann', 'Nucleoss', 'Boshqa'];
const IMPLANT_TYPES = ['Bone level', 'Tissue level'];
const BONE_TYPES = ['D1', 'D2', 'D3', 'D4'];
const LIFECYCLE_STATUSES = [
  "planned",
  "placed",
  "healing",
  "formik",
  "abutment",
  "crown",
  "completed",
  "failure"
];
const REMINDER_OPTIONS = [
  { label: '1 oy', sub: "1 oydan so'ng", value: 1 },
  { label: '2 oy', sub: "2 oydan so'ng", value: 2 },
  { label: '3 oy', sub: "3 oydan so'ng", value: 3 },
];

export const EXTRA_SERVICES = [
  // Tashxis va rejalashtirish
  { id: 'surgical_guide', label: 'Jarrohlik shabloni (Surgical Guide)', defaultPrice: 500000, category: 'Diagnostika' },

  // Ortopediya va Karonkalar
  { id: 'zirkon_crown', label: 'Zirkon Karonka', defaultPrice: 1500000, category: 'Ortopediya' },
  { id: 'metal_crown', label: 'Metallokeramika Karonka', defaultPrice: 800000, category: 'Ortopediya' },
  { id: 'emax_crown', label: 'E-Max Press Karonka', defaultPrice: 1800000, category: 'Ortopediya' },
  { id: 'temp_crown', label: 'Vaqtinchalik toj (Provisional crown)', defaultPrice: 200000, category: 'Ortopediya' },

  // Abatment va komponentlar
  { id: 'abutment', label: 'Abatment', defaultPrice: 300000, category: 'Komponentlar' },
  { id: 'healing_abutment', label: 'Healing abatment (Formirovatel)', defaultPrice: 100000, category: 'Komponentlar' },
  { id: 'cover_screw', label: 'Zaglushka (Cover screw)', defaultPrice: 100000, category: 'Komponentlar' },
  { id: 'multi_unit', label: 'Multi-unit abatment', defaultPrice: 500000, category: 'Komponentlar' },
  
  // Xirurgik operatsiyalar
  { id: 'sinus_open', label: 'Ochiq sinus-lifting', defaultPrice: 2500000, category: 'Sinus' },
  { id: 'sinus_closed', label: 'Yopiq sinus-lifting', defaultPrice: 1500000, category: 'Sinus' },
  { id: 'sst_transplant', label: 'SST ko\'chirish (Soft Tissue Graft)', defaultPrice: 800000, category: 'Transplant' },
  { id: 'piezosurgery', label: 'Piezosurgery (Ultrasonik jarrohlik)', defaultPrice: 400000, category: 'Xirurgiya' },
  
  // Suyak regeneratsiyasi
  { id: 'bone_graft', label: 'Suniy suyak (Bone graft)', defaultPrice: 1200000, category: 'Graft' },
  { id: 'membrane', label: 'Membrana qo\'yish', defaultPrice: 800000, category: 'Graft' },
  { id: 'prf', label: 'PRF/A-PRF (Qon plazmasidan membrana)', defaultPrice: 300000, category: 'Graft' },
  { id: 'nkr', label: 'NKR qo\'yish (Guided bone regeneration)', defaultPrice: 1000000, category: 'Graft' },
  
  // Boshqa xizmatlar
  { id: 'extraction', label: 'Atravmatik tish olish', defaultPrice: 250000, category: 'Xirurgiya' },
  { id: 'gingivoplasty', label: 'Gingivoplastika', defaultPrice: 400000, category: 'Soft Tissue' },
  { id: 'explantation', label: 'Implantni olib tashlash', defaultPrice: 500000, category: 'Xirurgiya' }
];

// FDI tooth numbering visual layout
const TEETH = [
  [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28],
  [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38],
];

/**
 * Add months to a date
 */
function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0];
}

/**
 * Get today's date string
 */
function getToday() {
  return new Date().toISOString().split('T')[0];
}

/**
 * ImplantForm Component
 *
 * Multi-step form for managing dental implant records.
 * Supports creating new implants and editing existing ones.
 *
 * @param {Object} props
 * @param {boolean} props.open - Whether modal is visible
 * @param {Function} props.onClose - Close callback
 * @param {Array} props.patients - List of patients
 * @param {Array} props.services - List of services
 * @param {Object} props.implant - Existing implant data (null for new)
 * @param {Function} props.onSaved - Success callback
 */
export default function ImplantForm({ open, onClose, patients, services, implant, relatedImplants = [], onSaved }) {
  const { t } = useTranslation();
  const today = getToday();

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
    lifecycle_status: "placed",
    reminder_months: 1,
    reminder_date: addMonths(today, 1),
    notes: '',
    extra_services: [], // IDs of selected extra services
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
  const [hoveredTooth, setHoveredTooth] = useState(null);
  
  // Har bir tish uchun alohida implant ma'lumotlari
  const [toothDataMap, setToothDataMap] = useState({});
  const [selectedToothForModal, setSelectedToothForModal] = useState(null);
  const [toothModalOpen, setToothModalOpen] = useState(false);
  const [extraServicePrices, setExtraServicePrices] = useState({});
  const [extraServicesList, setExtraServicesList] = useState(EXTRA_SERVICES);
  // Local storage check for schema optimization
  const [isSchemaOptimized, setIsSchemaOptimized] = useState(true);

  // Parent'dan kelgan yangi bemorlar ro'yxatini yuklash
  useEffect(() => {
    setLocalPatients(patients);
  }, [patients]);

  // Load dynamic extra services catalog
  useEffect(() => {
    if (!open) return;
    getOrSeedExtraServices().then(res => {
      if (Array.isArray(res) && res.length > 0) {
        setExtraServicesList(res.map(s => ({
          id: s.id,
          label: s.name,
          defaultPrice: Number(s.price) || 0,
          category: s.category || 'Boshqa'
        })));
      }
    }).catch(console.error);
  }, [open]);

  // Klinikadagi shifokorlarni yuklash
  useEffect(() => {
    if (!open) return;
    const loadClinicDoctors = async () => {
      try {
        let docList = [];
        const allUsers = await base44.entities.User.list('name', 100);
        if (Array.isArray(allUsers) && allUsers.length > 0) {
          docList = allUsers.filter(u => u.role === 'doctor' || u.role === 'admin' || !u.role);
        }
        const local = JSON.parse(localStorage.getItem('system_users') || '[]');
        if (Array.isArray(local) && local.length > 0) {
          local.forEach(lu => {
            const luName = lu.full_name || lu.name;
            if (luName && !docList.some(d => (d.full_name || d.name) === luName || d.id === lu.id)) {
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

  // Initialize form when modal opens
  useEffect(() => {
    if (!open) return;
    
    // Check if we are in "compatibility mode" (columns missing in Supabase)
    const checkSchema = () => {
      const stripped = JSON.parse(localStorage.getItem('base44_stripped_columns_implants') || '[]');
      const techFields = ['diameter', 'torque', 'isq', 'brend', 'firma'];
      const missingCount = techFields.filter(f => stripped.includes(f)).length;
      setIsSchemaOptimized(missingCount === 0);
    };
    checkSchema();
    
    if (implant) {
      // Deduplicate arrays with absolute safety (cast to strings + Set)
      const rawTeeth = [...(implant.tooth_numbers || []), ...(implant.tooth_number ? [implant.tooth_number] : [])];
      const uniqueTeeth = [...new Set(rawTeeth.map(String))].filter(Boolean);
      const uniqueServices = [...new Set((implant.extra_services || []).map(String))].filter(Boolean);
      
      setForm({ 
        ...implant,
        tooth_numbers: uniqueTeeth,
        extra_services: uniqueServices
      });
      // Existing ma'lumotlarni toothDataMap ga yozib qo'yamiz (Tahrirlash vaqti uchun)
      let initialToothMap = {};
      if (implant.tooth_data_map && typeof implant.tooth_data_map === 'object') {
        initialToothMap = { ...implant.tooth_data_map };
      }
      if (relatedImplants && relatedImplants.length > 0) {
        relatedImplants.forEach(imp => {
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
              notes: imp.notes || ''
            };
          }
        });
      }

      // Har bir tanlangan tish uchun implantning o'zidagi ma'lumotlar bilan to'ldirish
      uniqueTeeth.forEach(tId => {
        const match = tId.match(/^(ur|ul|lr|ll)(\d+)$/);
        const fdi = match ? ({ ur: '1', ul: '2', ll: '3', lr: '4' }[match[1]] + match[2]) : tId;
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
            notes: implant.notes || ''
          };
        }
      });
      setToothDataMap(initialToothMap);
    } else {
      resetForm();
      setToothDataMap({});
    }
    setStep(1);
     
  }, [open, implant?.id]);

  /**
   * Reset form to default values
   */
  const resetForm = () => {
    setForm({
      patient_id: '',
      patient_name: '',
      patient_phone: '',
      tooth_numbers: [],
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
      lifecycle_status: "placed",
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
  };

  /**
   * Generic form field setter
   */
  const setField = useCallback((key, val) => {
    setForm(prev => ({ ...prev, [key]: val }));
  }, []);

  /**
   * Toggle extra service
   */
  const toggleExtraService = (serviceId) => {
    setForm(prev => {
      const current = prev.extra_services || [];
      if (current.includes(serviceId)) {
        return { ...prev, extra_services: current.filter(id => id !== serviceId) };
      } else {
        return { ...prev, extra_services: [...current, serviceId] };
      }
    });
  };

  /**
   * Compress image using Canvas
   * Reduces dimensions and quality to save space
   */
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
          } else {
            if (height > maxHeight) {
              width *= maxHeight / height;
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = error => reject(error);
      };
      reader.onerror = error => reject(error);
    });
  };

  /**
   * Convert file to base64 (Fallback/Original)
   */
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  };

  /**
   * Handle tooth selection toggle
   */
  const pruneToothDataMap = useCallback((nextTeeth) => {
    const keep = new Set((nextTeeth || []).map(String));
    const keepFdi = new Set([...keep].map(sel => {
      const m = String(sel).match(/^(ur|ul|lr|ll)(\d+)$/);
      return m ? ({ ur: '1', ul: '2', ll: '3', lr: '4' }[m[1]] + m[2]) : String(sel);
    }));
    setToothDataMap(prev => {
      const next = {};
      Object.keys(prev || {}).forEach(key => {
        const k = String(key);
        const m = k.match(/^(ur|ul|lr|ll)(\d+)$/);
        const fdi = m ? ({ ur: '1', ul: '2', ll: '3', lr: '4' }[m[1]] + m[2]) : k;
        if (keep.has(k) || keepFdi.has(k) || keepFdi.has(fdi)) {
          next[key] = prev[key];
        }
      });
      return next;
    });
  }, []);

  const toggleTooth = useCallback((num) => {
    setForm(prev => {
      const exists = prev.tooth_numbers.includes(num);
      const nextTeeth = exists
        ? prev.tooth_numbers.filter(n => n !== num)
        : [...prev.tooth_numbers, num];
      if (exists) pruneToothDataMap(nextTeeth);
      return { ...prev, tooth_numbers: nextTeeth };
    });
  }, [pruneToothDataMap]);

  /**
    * Tooth SVG component for visual representation
    */
  const ToothSVG = ({ num, isSelected, isHovered }) => {
    const getColor = (zone) => {
      if (isSelected) return zone === 'root' ? '#3b82f6' : '#60a5fa';
      return zone === 'root' ? '#f1f5f9' : '#ffffff';
    };

    const strokeColor = isSelected ? '#2563eb' : '#cbd5e1';

    const paths = {
      molar: (
        <g>
          <path d="M10,24 L8,36 C8,38 12,39 13,36 L15,24 M15,24 L17,36 C18,39 22,38 22,36 L20,24" 
                fill={getColor('root')} stroke={strokeColor} strokeWidth="1" />
          <path d="M6,6 C4,6 3,8 3,12 C3,18 6,24 10,24 L20,24 C24,24 27,18 27,12 C27,8 26,6 24,6 C22,5 20,5 18,6 C16,5 14,5 12,6 C10,5 8,5 6,6 Z" 
                fill={getColor('crown')} stroke={strokeColor} strokeWidth="1.5" />
        </g>
      ),
      premolar: (
        <g>
          <path d="M12,24 L10,36 C10,38 20,38 20,36 L18,24" 
                fill={getColor('root')} stroke={strokeColor} strokeWidth="1" />
          <path d="M8,6 C6,6 5,8 5,12 C5,18 8,24 12,24 L18,24 C22,24 25,18 25,12 C25,8 24,6 22,6 C20,5 18,5 15,6 C12,5 10,5 8,6 Z" 
                fill={getColor('crown')} stroke={strokeColor} strokeWidth="1.5" />
        </g>
      ),
      canine: (
        <g>
          <path d="M13,24 L11,38 C11,40 19,40 19,38 L17,24" 
                fill={getColor('root')} stroke={strokeColor} strokeWidth="1" />
          <path d="M15,4 C12,4 9,7 9,12 C9,18 12,24 15,24 C18,24 21,18 21,12 C21,7 18,4 15,4 Z" 
                fill={getColor('crown')} stroke={strokeColor} strokeWidth="1.5" />
        </g>
      ),
      incisor: (
        <g>
          <path d="M13,24 L12,38 C12,40 18,40 18,38 L17,24" 
                fill={getColor('root')} stroke={strokeColor} strokeWidth="1" />
          <path d="M10,5 C8,5 7,8 7,12 C7,18 10,24 13,24 L17,24 C20,24 23,18 23,12 C23,8 22,5 20,5 L10,5 Z" 
                fill={getColor('crown')} stroke={strokeColor} strokeWidth="1.5" />
        </g>
      )
    };

    const getToothType = (n) => {
      const lastDigit = n % 10;
      if (lastDigit >= 6) return 'molar';
      if (lastDigit >= 4) return 'premolar';
      if (lastDigit === 3) return 'canine';
      return 'incisor';
    };

    return (
      <svg viewBox="0 0 30 42" className={`w-8 h-10 transition-transform duration-200 ${isHovered ? 'scale-110' : ''}`}>
        {paths[getToothType(num)]}
      </svg>
    );
  };

  /**
   * Handle patient selection
   */
  const handlePatientSelect = useCallback((patientId) => {
    const patient = localPatients.find(p => p.id === patientId);
    setForm(prev => ({
      ...prev,
      patient_id: patientId,
      patient_name: patient?.full_name || '',
      patient_phone: patient?.phone || ''
    }));
  }, [localPatients]);

  /**
   * Handle reminder months change
   */
  const handleReminderMonths = useCallback((months) => {
    if (months === 'custom') {
      setForm(prev => ({ ...prev, reminder_months: 'custom' }));
    } else {
      const reminderDate = addMonths(form.placement_date || today, months);
      setForm(prev => ({
        ...prev,
        reminder_months: months,
        reminder_date: reminderDate
      }));
    }
  }, [form.placement_date, today]);

  /**
   * Handle placed date change
   */
  const handleDateChange = useCallback((value) => {
    const reminderDate = addMonths(value, form.reminder_months);
    setForm(prev => ({
      ...prev,
      placement_date: value,
      reminder_date: reminderDate
    }));
  }, [form.reminder_months]);

  /**
   * Handle X-ray file upload
   */
  const handleXrayUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploading(true);
    try {
      // Use compressImage instead of fileToBase64 to save space
      const promises = files.map(file => compressImage(file));
      const compressedBase64s = await Promise.all(promises);
      setForm(prev => ({
        ...prev,
        xray_urls: [...(prev.xray_urls || []), ...compressedBase64s]
      }));
    } catch (error) {
      console.error('X-ray upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  /**
   * Handle passport file upload
   */
  const handlePassportUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // Use compressImage to avoid QuotaExceededError
      const compressedBase64 = await compressImage(file);
      setField('passport_url', compressedBase64);
    } catch (error) {
      console.error('Passport upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  /**
   * Remove X-ray image
   */
  const removeXray = useCallback((index) => {
    setForm(prev => ({
      ...prev,
      xray_urls: prev.xray_urls.filter((_, i) => i !== index)
    }));
  }, []);

  /**
   * Handle form save
   */
  const handleSave = async () => {
    if (!form.patient_name) {
      alert("Iltimos, avval bemorni tanlang!");
      return;
    }
    if (!form.doctor || !form.doctor.trim()) {
      alert("Iltimos, mas'ul shifokorni tanlang! Shifokor bo'limi to'ldirilmagan.");
      return;
    }
    if (!form.tooth_numbers || form.tooth_numbers.length === 0) {
      alert("Iltimos, implant o'rnatiladigan tish(lar)ni belgilang!");
      return;
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const auditLog = [
        ...(form.audit_log || []),
        {
          date: now,
          user: 'Dr.',
          action: implant ? t('common.edit') : t('common.addNew')
        }
      ];

      const timeline = [
        ...(form.timeline || []),
        {
          date: now,
          status: form.lifecycle_status,
          note: implant ? t('common.edit') : t('implants.status.planned')
        }
      ];

      // Convert all toothIds to FDI numbers
      const fdiNumbers = form.tooth_numbers.map(toothId => {
        const match = toothId.match(/^(ur|ul|lr|ll)(\d+)$/);
        if (match) {
          const [, quadrant, num] = match;
          const quadrantMap = { ur: '1', ul: '2', ll: '3', lr: '4' };
          return quadrantMap[quadrant] + num;
        }
        return toothId;
      });

      // Calculate safe integer reminder_months for PostgreSQL
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

      // Cleaned per-tooth map for selected teeth only (no stale deselected keys)
      const cleanedToothMap = {};
      (form.tooth_numbers || []).forEach(toothId => {
        const tid = String(toothId);
        const match = tid.match(/^(ur|ul|lr|ll)(\d+)$/);
        const fdi = match ? ({ ur: '1', ul: '2', ll: '3', lr: '4' }[match[1]] + match[2]) : tid;
        const entry = toothDataMap[tid] || toothDataMap[fdi];
        if (entry) {
          cleanedToothMap[tid] = entry;
          cleanedToothMap[fdi] = entry;
        }
      });

      // Legacy top-level columns = first-tooth summary (UI prefers tooth_data_map per selection)
      const firstToothId = form.tooth_numbers[0];
      const matchFirst = firstToothId ? String(firstToothId).match(/^(ur|ul|lr|ll)(\d+)$/) : null;
      const firstToothFdi = matchFirst ? ({ ur: '1', ul: '2', ll: '3', lr: '4' }[matchFirst[1]] + matchFirst[2]) : (fdiNumbers[0] || '');
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

      // Price = sum of unique per-tooth prices when map has entries; else form price
      const seenPriceKeys = new Set();
      let mapPriceSum = 0;
      let mapPriceCount = 0;
      (form.tooth_numbers || []).forEach(toothId => {
        const tid = String(toothId);
        const match = tid.match(/^(ur|ul|lr|ll)(\d+)$/);
        const fdi = match ? ({ ur: '1', ul: '2', ll: '3', lr: '4' }[match[1]] + match[2]) : tid;
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

      // 1 ta reja ichida barcha belgilangan tishlarni saqlash (alohida qilmasdan)
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
        reminder_months: safeReminderMonths,
        // Asosiy maydonlar - barcha tishlar bitta rejada birgalikda
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

  /**
   * Handle new patient creation
   */
  const handleNewPatientSaved = async (newPatient) => {
    try {
      if (newPatient && newPatient.id) {
        // Just update local patients array instantly without waiting for a 200-item slow network request
        setLocalPatients(prev => {
          if (prev.find(p => p.id === newPatient.id)) return prev;
          // Prepend newly added patient so they show up in searches
          return [newPatient, ...prev];
        });

        // Directly update form to avoid relying on stale localPatients state
        setForm(prev => ({
          ...prev,
          patient_id: newPatient.id,
          patient_name: newPatient.full_name || '',
          patient_phone: newPatient.phone || ''
        }));
      }
      // REMOVED onSaved() here because it triggered the parent component to massively reload 500+ records!
    } catch (error) {
      console.error('Failed to refresh patients:', error);
    }
  };

  /**
   * Handle tooth data save
   */
  const handleToothDataSave = (toothId, data) => {
    const match = String(toothId).match(/^(ur|ul|lr|ll)(\d+)$/);
    const fdi = match ? ({ ur: '1', ul: '2', ll: '3', lr: '4' }[match[1]] + match[2]) : toothId;
    setToothDataMap(prev => ({
      ...prev,
      [toothId]: data,
      [fdi]: data
    }));
    // Do NOT copy last modal into shared top-level form — that hid teeth 2–3 behind tooth-1 values.
    // Top-level summary (incl. summed price) is computed on final save from tooth_data_map.
  };

  /**
   * Handle tooth click
   */
   const handleToothClick = (rawId) => {
    const toothId = String(rawId);
    // Tishni tanlanganlar ro'yxatiga qo'shish (agar bo'lmasa)
    setForm(prev => {
      const currentTeeth = (prev.tooth_numbers || []).map(String);
      if (!currentTeeth.includes(toothId)) {
        return { ...prev, tooth_numbers: [...currentTeeth, toothId] };
      }
      return prev;
    });
    
    // Modalni ochish
    setSelectedToothForModal(toothId);
    setToothModalOpen(true);
  };

  // Validation
  const isStep1Valid = form.patient_name && form.tooth_numbers.length > 0 && form.doctor;
  const isStep2Valid = true; // Xizmatlar ixtiyoriy bo'lishi mumkin
  const isStep3Valid = !!form.placement_date;
  const canSave = isStep1Valid && isStep3Valid;

  /**
   * Render step indicator
   */
  const renderStepIndicator = () => (
    <div className="mb-4 mt-3">
      <div className="flex items-center justify-between mb-2 px-2">
        {[1, 2, 3].map(s => (
          <div key={s} className="flex flex-col items-center gap-1">
            <button
              onClick={() => step >= s && setStep(s)}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all duration-300 shadow-md ${
                step > s
                  ? 'bg-emerald-500 text-white'
                  : step === s
                  ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white scale-110 shadow-emerald-200'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              {step > s ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : s}
            </button>
            <span className={`text-[9px] font-black uppercase tracking-wider ${
              step >= s ? 'text-emerald-600' : 'text-slate-300'
            }`}>
              {s === 1 ? t('patients.wizard.patient') : s === 2 ? t('patients.wizard.services') : t('navigation.implants')}
            </span>
          </div>
        ))}
      </div>
      <div className="relative h-1 bg-slate-100 rounded-full mx-10 -mt-5 -z-10">
        <div 
          className="absolute h-full bg-gradient-to-r from-emerald-500 to-teal-600 transition-all duration-500 rounded-full"
          style={{ width: `${(step - 1) * 50}%` }}
        />
      </div>
    </div>
  );

  /**
   * Render Step 1: Patient and Tooth
   */
  const renderStep1 = () => (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="bg-muted/30 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-border/50 space-y-3 sm:space-y-4">
        <div className="flex items-center gap-2 text-primary font-bold text-xs sm:text-sm mb-1 sm:mb-2">
          <User className="w-3.5 h-3.5 sm:w-4 h-4" /> {t('implants.form.patientInfo')}
        </div>
        
        <div className="space-y-3 sm:space-y-4">
          <div className="z-50 relative">
            <Label className="text-[10px] sm:text-xs font-bold text-muted-foreground mb-1.5 block">{t('patients.selectExisting')}</Label>
            <PatientSelect
               patients={localPatients}
               value={form.patient_id}
               onChange={handlePatientSelect}
               onAddPatient={() => setNewPatientOpen(true)}
               inputClassName="bg-background border-border/60 h-10 sm:h-11 rounded-lg sm:rounded-xl shadow-sm text-xs sm:text-sm"
               buttonClassName="h-10 w-10 sm:h-11 sm:w-11 rounded-lg sm:rounded-xl bg-primary hover:bg-primary/90 text-white shadow-sm transition-all shrink-0 flex items-center justify-center p-0"
            />
          </div>

          {!form.patient_id && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-[10px] sm:text-xs font-bold text-muted-foreground mb-1 block">{t('patients.fullName')} *</Label>
                <Input
                  className="bg-background border-border/60 h-10 sm:h-11 rounded-lg sm:rounded-xl text-xs sm:text-sm"
                  value={form.patient_name}
                  onChange={e => setField('patient_name', e.target.value)}
                  placeholder={t('patients.fullName')}
                />
              </div>
              <div>
                <Label className="text-[10px] sm:text-xs font-bold text-muted-foreground mb-1 block">{t('common.phone')}</Label>
                <Input
                  className="bg-background border-border/60 h-10 sm:h-11 rounded-lg sm:rounded-xl text-xs sm:text-sm"
                  value={form.patient_phone}
                  onChange={e => setField('patient_phone', e.target.value)}
                  placeholder="+998..."
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Implant Parametrlari (Sana, Firma & Narxi) ─── */}
      <div className="bg-slate-50 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/90 space-y-3 shadow-2xs">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <ImplantIcon className="w-4 h-4 text-teal-600" /> Implant Parametrlari
          </Label>
          <span className="text-[10px] font-black text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
            Implantatsiya
          </span>
        </div>

        {/* Sana, Firma & Narxi Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* Sana */}
          <div>
            <Label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">
              O'rnatilgan sana *
            </Label>
            <Input
              type="date"
              className="bg-white border-slate-200 h-10 rounded-xl font-bold text-xs sm:text-sm text-slate-800 shadow-2xs"
              value={form.placement_date}
              onChange={e => handleDateChange(e.target.value)}
            />
          </div>

          {/* Firma Nomi */}
          <div>
            <Label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">
              Firma / Brend *
            </Label>
            <Select
              value={form.firma}
              onValueChange={v => {
                setForm(prev => ({
                  ...prev,
                  firma: v,
                  firma_custom: v === 'Boshqa' ? prev.firma_custom : '',
                  brend: v === 'Boshqa' ? (prev.firma_custom || prev.brend) : prev.brend
                }));
              }}
            >
              <SelectTrigger className="bg-white border-slate-200 h-10 rounded-xl font-bold text-xs sm:text-sm">
                <SelectValue placeholder="Firmasini tanlang" />
              </SelectTrigger>
              <SelectContent className="rounded-xl font-bold text-xs">
                {['Dentium', 'Osstem', 'Straumann', 'Serkon', 'Megagen', 'Neodent', 'Nobel', 'Bredent', 'Boshqa'].map(f => (
                  <SelectItem key={f} value={f}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {form.firma === 'Boshqa' && (
              <Input
                placeholder="Firma nomini yozing..."
                value={form.firma_custom}
                onChange={e => setField('firma_custom', e.target.value)}
                className="bg-white border-slate-300 h-9 rounded-xl text-xs font-bold mt-1.5"
              />
            )}
          </div>

          {/* Narxi */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-[10px] font-black text-emerald-800 uppercase tracking-wider block">
                Implant Narxi (so'm) *
              </Label>
              <span className="text-[10px] font-mono font-black text-emerald-700">
                {(Number(form.price) || 0).toLocaleString()}
              </span>
            </div>
            <div className="relative">
              <Input
                type="number"
                step="10000"
                className="bg-white border-emerald-300 focus:border-emerald-500 h-10 rounded-xl font-mono font-black text-slate-900 text-xs sm:text-sm pr-12 shadow-2xs"
                value={form.price}
                onChange={e => setField('price', e.target.value)}
                placeholder="1500000"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9.5px] font-black text-slate-400">
                SO'M
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3 sm:space-y-4">
        <Label className="flex justify-between items-center px-1">
          <div className="flex items-center gap-2 text-primary font-bold text-xs sm:text-sm">
            <Activity className="w-3.5 h-3.5 sm:w-4 h-4" /> {t('implants.form.selectTeeth')}
          </div>
          {form.tooth_numbers.length > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 sm:h-7 text-[9px] sm:text-[10px] text-destructive hover:bg-destructive/10"
              onClick={() => { setField('tooth_numbers', []); setToothDataMap({}); }}
            >
              <X className="w-2.5 h-2.5 sm:w-3 h-3 mr-1" /> {t('common.clear')}
            </Button>
          )}
        </Label>
        
        {/* Professional tish diagrammasi - 32 ta tish (Ixcham va toza) */}
        <div className="w-full rounded-2xl border border-slate-100 shadow-2xs overflow-hidden bg-white">
          <ProfessionalOdontogram
            selectedTeeth={form.tooth_numbers}
            onChange={(teeth) => {
              const next = (teeth || []).map(String);
              setForm(prev => ({ ...prev, tooth_numbers: next }));
              pruneToothDataMap(next);
            }}
            multi={true}
            onToothClick={handleToothClick}
            hideChildren={true}
            compact={true}
            hideLegend={true}
            hideStats={true}
            hideHeader={true}
            hideTooltip={true}
          />
        </div>
      </div>

      <div className="bg-muted/30 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-border/50 space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-[10px] sm:text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Stethoscope className="w-3.5 h-3.5 text-primary" /> Mas'ul shifokor *
          </Label>
          {!form.doctor ? (
            <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full animate-pulse border border-rose-200">
              * Shifokorni tanlang
            </span>
          ) : (
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
              <Check className="w-3 h-3 stroke-[3]" /> Tanlandi
            </span>
          )}
        </div>

        <Select 
          value={form.doctor || ''} 
          onValueChange={v => setField('doctor', v)}
        >
          <SelectTrigger className={`w-full bg-white h-11 rounded-xl text-xs sm:text-sm font-bold border transition-all ${
            !form.doctor 
              ? 'border-amber-400 bg-amber-50/30 ring-1 ring-amber-300' 
              : 'border-slate-200 hover:border-emerald-500'
          }`}>
            {(() => {
              const selDoc = doctors.find(d => (d.full_name || d.name || d.username) === form.doctor);
              if (selDoc) {
                const docName = selDoc.full_name || selDoc.name || selDoc.username;
                const specialty = selDoc.specialty || (selDoc.role === 'admin' ? 'Bosh shifokor / Admin' : 'Stomatolog-implantolog');
                const photo = selDoc.avatar_url || selDoc.photo || selDoc.image || selDoc.profile_image;
                const initials = docName.split(' ').map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'DR';
                const gradients = ['from-emerald-500 to-teal-600', 'from-blue-500 to-indigo-600', 'from-violet-500 to-purple-600', 'from-cyan-500 to-blue-600', 'from-amber-500 to-orange-600'];
                const grad = gradients[((docName.charCodeAt(0) || 0) + (docName.charCodeAt(1) || 0)) % gradients.length];

                return (
                  <div className="flex items-center gap-2.5 min-w-0 text-left">
                    {photo ? (
                      <img src={photo} alt={docName} className="w-6 h-6 rounded-full object-cover border border-slate-200 shadow-xs shrink-0" />
                    ) : (
                      <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${grad} text-white flex items-center justify-center text-[9px] font-black shadow-xs shrink-0`}>
                        {initials}
                      </div>
                    )}
                    <span className="text-xs font-black text-slate-800 truncate">{docName}</span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200/60 shrink-0">
                      {specialty}
                    </span>
                  </div>
                );
              }
              return (
                <div className="flex items-center gap-2 text-slate-400 font-medium text-xs truncate">
                  <div className="w-5 h-5 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <Stethoscope className="w-3 h-3" />
                  </div>
                  <SelectValue placeholder="Klinikadagi mas'ul shifokorni tanlang..." />
                </div>
              );
            })()}
          </SelectTrigger>
          <SelectContent className="rounded-2xl shadow-xl border-slate-200 max-h-56 p-1 bg-white">
            {doctors.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-400 font-bold">
                Hozircha klinikada shifokorlar mavjud emas
              </div>
            ) : (
              doctors.map(d => {
                const docName = d.full_name || d.name || d.username;
                const specialty = d.specialty || (d.role === 'admin' ? 'Bosh shifokor / Admin' : 'Stomatolog');
                const photo = d.avatar_url || d.photo || d.image || d.profile_image;
                const initials = docName.split(' ').map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'DR';
                const gradients = ['from-emerald-500 to-teal-600', 'from-blue-500 to-indigo-600', 'from-violet-500 to-purple-600', 'from-cyan-500 to-blue-600', 'from-amber-500 to-orange-600'];
                const grad = gradients[((docName.charCodeAt(0) || 0) + (docName.charCodeAt(1) || 0)) % gradients.length];
                const isSelected = form.doctor === docName;

                return (
                  <SelectItem 
                    key={d.id || docName} 
                    value={docName} 
                    className="cursor-pointer py-1.5 px-2.5 rounded-xl hover:bg-slate-50 focus:bg-emerald-50/60 transition-colors my-0.5"
                  >
                    <div className="flex items-center gap-2.5 w-full">
                      {photo ? (
                        <img 
                          src={photo} 
                          alt={docName} 
                          className="w-7 h-7 rounded-full object-cover border border-slate-200 shadow-xs shrink-0" 
                        />
                      ) : (
                        <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${grad} text-white flex items-center justify-center text-[10px] font-black shadow-xs shrink-0 border border-white/50`}>
                          {initials}
                        </div>
                      )}
                      <div className="flex items-center justify-between flex-1 min-w-0">
                        <div className="flex flex-col text-left min-w-0">
                          <span className={`text-xs font-black truncate leading-tight ${isSelected ? 'text-emerald-700' : 'text-slate-800'}`}>
                            {docName}
                          </span>
                          <span className="text-[9.5px] font-bold text-slate-400 truncate mt-0.5">
                            {specialty}
                          </span>
                        </div>
                        {d.role === 'admin' && (
                          <span className="text-[8.5px] font-black bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded uppercase tracking-wider ml-2 shrink-0">
                            Admin
                          </span>
                        )}
                      </div>
                    </div>
                  </SelectItem>
                );
              })
            )}
          </SelectContent>
        </Select>
      </div>

      {/* ── Tanlangan tishlar kartalari ── */}
      {form.tooth_numbers.length > 0 && (
        <div className="space-y-2 mt-3">
          <div className="flex items-center gap-1.5 text-slate-500 font-black text-[10px] uppercase tracking-widest px-1">
            <Info className="w-3 h-3" /> Tanlangan tishlar — ma'lumot kiritish uchun bosing
          </div>
          <AnimatePresence mode="popLayout">
            {[...new Set((form.tooth_numbers||[]).map(String))].map(toothId => {
              let fdiNumber = toothId, srcImage = '';
              if (toothId.startsWith('ur')) { const n=toothId.replace('ur',''); fdiNumber=`1${n}`; srcImage=`kamron/tepa_ong_${n}`; }
              else if (toothId.startsWith('ul')) { const n=toothId.replace('ul',''); fdiNumber=`2${n}`; srcImage=`kamron/tepa_chap_${n}`; }
              else if (toothId.startsWith('lr')) { const n=toothId.replace('lr',''); fdiNumber=`4${n}`; srcImage=`kamron/pas_ong_${n}`; }
              else if (toothId.startsWith('ll')) { const n=toothId.replace('ll',''); fdiNumber=`3${n}`; srcImage=`kamron/pas_chap_${n}`; }
              const data = toothDataMap[toothId] || toothDataMap[fdiNumber];
              return (
                <motion.div key={toothId} initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={{opacity:0,y:6}} transition={{duration:0.18}}
                  onClick={() => handleToothClick(toothId)}
                  className={`flex items-center gap-3 p-2.5 rounded-xl border-2 cursor-pointer transition-all active:scale-[0.98] ${data ? 'bg-emerald-50 border-emerald-300 hover:border-emerald-500' : 'border-dashed border-amber-300 hover:border-amber-400 hover:bg-amber-50/30'}`}>
                  <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-xs shrink-0">
                    <img src={`/teeth/${srcImage}.png`} alt={`Tish ${fdiNumber}`} className="w-7 h-7 object-contain" style={{filter: data ? 'drop-shadow(0 1px 3px rgba(16,185,129,0.4))' : 'grayscale(0.3) opacity(0.7)'}} onError={e=>{e.target.style.display='none'}} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-black text-slate-900">Tish #{fdiNumber}</span>
                      {data && <Check className="w-3.5 h-3.5 text-emerald-500 stroke-[3] shrink-0" />}
                    </div>
                    {data ? (
                      <p className="text-[10px] font-bold text-emerald-700 truncate">
                        {data.firma==='Boshqa'?(data.firma_custom||'Boshqa'):data.firma}{data.diameter&&data.length?` | Ø${data.diameter}×${data.length}mm`:''}{data.torque?` | ${data.torque}Ncm`:''}
                      </p>
                    ) : (
                      <p className="text-[10px] font-bold text-amber-600">Bosib ma'lumot kiriting ↗</p>
                    )}
                  </div>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${data ? 'bg-emerald-500 text-white shadow-sm' : 'border-2 border-amber-300 text-amber-500'}`}>
                    {data ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <Plus className="w-3.5 h-3.5" />}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      <div className="flex justify-between gap-3 pt-1">
        <Button variant="outline" onClick={onClose} className="h-11 px-6 rounded-2xl border-2 text-xs font-black text-slate-600">Bekor qilish</Button>
        <Button
          onClick={() => {
            if (!form.patient_name) { alert("Iltimos, avval bemorni tanlang!"); return; }
            if (!form.doctor?.trim()) { alert("Iltimos, mas'ul shifokorni tanlang!"); return; }
            if (!form.tooth_numbers?.length) { alert("Iltimos, implant o'rnatiladigan tishni tanlang!"); return; }
            setStep(2);
          }}
          className={`h-11 px-8 rounded-2xl transition-all active:scale-95 text-xs font-black ${isStep1Valid ? 'bg-teal-600 hover:bg-teal-700 text-white shadow-lg shadow-teal-500/20' : 'bg-amber-500 hover:bg-amber-600 text-white shadow-md'}`}
        >
          Keyingisi <Calendar className="w-3.5 h-3.5 ml-2" />
        </Button>
      </div>
    </div>
  );

  /**
   * Render Step 2: Xizmatlar
   */
  const renderStep2 = () => {
    const totalExtraSum = (form.extra_services||[]).reduce((acc,sid) => {
      const preset = (extraServicesList||[]).find(s=>s.id===sid);
      const customPrice = extraServicePrices[sid];
      return acc + (customPrice!==undefined ? Number(customPrice) : (preset?.defaultPrice||0));
    }, 0);

    return (
      <div className="space-y-3 animate-in fade-in slide-in-from-right-4 duration-300">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-700 font-black text-[11px] uppercase tracking-widest">
              <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Layers className="w-3.5 h-3.5" />
              </div>
              Qo'shimcha xizmatlar
            </div>
            {form.extra_services?.length > 0 && (
              <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
                {totalExtraSum.toLocaleString()} so'm
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 max-h-[360px] overflow-y-auto">
            {(extraServicesList||[]).map(service => {
              const isSelected = (form.extra_services||[]).includes(service.id);
              const currentPrice = extraServicePrices[service.id]!==undefined ? extraServicePrices[service.id] : service.defaultPrice;
              return (
                <div key={service.id} className={`p-2.5 rounded-xl border-2 transition-all ${isSelected ? 'bg-indigo-50 border-indigo-400 shadow-xs' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}>
                  <div onClick={() => toggleExtraService(service.id)} className="flex items-center justify-between cursor-pointer select-none">
                    <span className="text-[10.5px] font-black leading-tight pr-1 text-slate-800">{t('implants.services.'+service.id)||service.label}</span>
                    <div className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 ${isSelected ? 'bg-indigo-600 text-white' : 'border-2 border-slate-300'}`}>
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </div>
                  {isSelected && (
                    <div className="mt-2 pt-2 border-t border-indigo-200/60">
                      <div className="relative">
                        <Input type="number" step="10000" value={currentPrice} onChange={e => setExtraServicePrices(prev=>({...prev,[service.id]:Number(e.target.value)||0}))} className="h-7 text-[10px] font-mono font-black text-right pr-10 bg-white border-indigo-300 rounded-lg" />
                        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[8px] font-black text-slate-400">SO'M</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex justify-between gap-3 pt-1">
          <Button variant="outline" onClick={() => setStep(1)} className="h-11 px-6 rounded-2xl border-2 text-xs font-black text-slate-600">← Orqaga</Button>
          <Button onClick={() => setStep(3)} className="h-11 px-8 rounded-2xl bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 transition-all active:scale-95 text-xs font-black text-white">
            Keyingisi <Shield className="w-3.5 h-3.5 ml-2" />
          </Button>
        </div>
      </div>
    );
  };

  /**
   * Render Step 3: Sana, Eslatma & Yakunlash
   */
  const renderStep3 = () => (
    <div className="space-y-3 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-3.5 space-y-2.5">
        <div className="flex items-center gap-2 text-slate-700 font-black text-[11px] uppercase tracking-widest mb-1">
          <div className="w-6 h-6 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center"><Activity className="w-3.5 h-3.5" /></div>
          Sana va holat
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">O'rnatilgan sana *</label>
            <Input type="date" className="bg-slate-50 border-slate-200 h-9 rounded-xl font-bold text-xs" value={form.placement_date} onChange={e => handleDateChange(e.target.value)} />
          </div>
          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Bosqich holati</label>
            <Select value={form.lifecycle_status} onValueChange={v => setField('lifecycle_status', v)}>
              <SelectTrigger className="bg-slate-50 border-slate-200 h-9 rounded-xl font-bold text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {LIFECYCLE_STATUSES.map(s => <SelectItem key={s} value={s}>{t(`implants.status.${s}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-3.5 space-y-2.5">
        <div className="flex items-center gap-2 text-slate-700 font-black text-[11px] uppercase tracking-widest">
          <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center"><Calendar className="w-3.5 h-3.5" /></div>
          Nazorat eslatmasi
        </div>
        <div className="grid grid-cols-4 gap-2">
          {REMINDER_OPTIONS.map(opt => (
            <button key={opt.value} type="button" onClick={() => handleReminderMonths(opt.value)}
              className={`flex flex-col items-center justify-center p-2.5 rounded-xl border-2 transition-all active:scale-95 cursor-pointer ${form.reminder_months===opt.value ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'}`}>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center mb-1 ${form.reminder_months===opt.value ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'}`}><Calendar className="w-3.5 h-3.5" /></div>
              <span className="text-[11px] font-black">{opt.label}</span>
              <span className="text-[8.5px] text-slate-400">{opt.sub}</span>
            </button>
          ))}
          <button type="button" onClick={() => handleReminderMonths('custom')}
            className={`flex flex-col items-center justify-center p-2.5 rounded-xl border-2 transition-all active:scale-95 cursor-pointer ${form.reminder_months==='custom' ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'}`}>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center mb-1 ${form.reminder_months==='custom' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'}`}><Plus className="w-3.5 h-3.5" /></div>
            <span className="text-[11px] font-black">Boshqa</span>
            <span className="text-[8.5px] text-slate-400">Tanlash</span>
          </button>
        </div>
        {form.reminder_months==='custom' && (
          <Input type="date" className="bg-slate-50 border-emerald-200 text-emerald-800 font-bold h-9 rounded-xl text-xs" value={form.reminder_date} onChange={e => setField('reminder_date', e.target.value)} />
        )}
        {form.reminder_date && form.reminder_months!=='custom' && (
          <div className="flex items-center justify-between bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-100">
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
              <span className="text-[10px] font-black text-emerald-700">Rejalashtirilgan:</span>
              <span className="text-[10px] font-black text-slate-900">{form.reminder_date}</span>
            </div>
            <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-lg">{form.reminder_months} oy</span>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-3.5 space-y-2.5">
        <div className="flex items-center gap-2 text-slate-700 font-black text-[11px] uppercase tracking-widest">
          <div className="w-6 h-6 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center"><Upload className="w-3.5 h-3.5" /></div>
          Hujjatlar (ixtiyoriy)
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="flex flex-col items-center gap-1 p-3 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-teal-400 hover:bg-teal-50/20 transition-all group">
              <input type="file" className="hidden" onChange={handlePassportUpload} />
              <FileText className="w-4 h-4 text-slate-400 group-hover:text-teal-600" />
              <span className="text-[10px] font-black text-slate-500 group-hover:text-teal-700">Pasport</span>
            </label>
            {form.passport_url && (
              <div className="relative group w-full aspect-[4/3] rounded-xl overflow-hidden border border-slate-200 mt-1">
                <img src={form.passport_url} alt="Passport" className="w-full h-full object-cover" />
                <button type="button" onClick={() => setField('passport_url','')} className="absolute top-1 right-1 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3" /></button>
              </div>
            )}
          </div>
          <div>
            <label className="flex flex-col items-center gap-1 p-3 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/20 transition-all group">
              <input type="file" className="hidden" multiple onChange={handleXrayUpload} />
              <ImageIcon className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
              <span className="text-[10px] font-black text-slate-500 group-hover:text-indigo-700">Rentgen</span>
            </label>
            {form.xray_urls?.length > 0 && (
              <div className="grid grid-cols-3 gap-1 mt-1">
                {form.xray_urls.map((url,idx) => (
                  <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border border-slate-200">
                    <img src={url} alt={`Xray ${idx}`} className="w-full h-full object-cover" />
                    <button type="button" onClick={() => removeXray(idx)} className="absolute top-0.5 right-0.5 w-4 h-4 bg-rose-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-2.5 h-2.5" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <textarea
          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-600 min-h-[60px] resize-none outline-none focus:border-teal-400 transition-colors"
          value={form.notes}
          onChange={e => setField('notes', e.target.value)}
          placeholder={t('implants.form.notesPlaceholder')}
        />
      </div>

      <div className="flex justify-between gap-3 pt-1">
        <Button variant="outline" onClick={() => setStep(2)} className="h-11 px-6 rounded-2xl border-2 font-black text-xs text-slate-600">← Orqaga</Button>
        <Button
          onClick={handleSave}
          disabled={saving || !isStep3Valid}
          className="h-11 px-10 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 border-0 shadow-lg shadow-emerald-500/25 font-black text-white active:scale-95 transition-all"
        >
          {saving ? t('common.saving') : t('common.saveAndFinish')}
          <Check className="w-4 h-4 ml-2 stroke-[3]" />
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <Dialog open={open && !newPatientOpen} onOpenChange={onClose}>
        <DialogContent className="w-[95vw] max-w-lg max-h-[92vh] p-0 overflow-hidden rounded-[2rem] border-none shadow-2xl flex flex-col" aria-describedby={undefined}>
          <DialogHeader className="shrink-0">
            <div className="bg-gradient-to-br from-teal-500 via-teal-600 to-emerald-700 px-5 py-4 flex items-center justify-between text-white rounded-t-[2rem]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-sm text-xl">🦷</div>
                <div>
                  <DialogTitle className="text-[15px] font-black text-white uppercase leading-none tracking-tight">
                    {implant ? t('common.edit') : t('implants.form.newImplant')}
                  </DialogTitle>
                  <p className="text-[9px] font-bold text-white/70 uppercase tracking-widest mt-0.5">
                    {form.patient_name ? form.patient_name : 'Implantologiya moduli'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {form.tooth_numbers.length > 0 && (
                  <div className="px-2 py-1 rounded-full bg-white/20 border border-white/30 text-[9px] font-black text-white/90 flex items-center gap-1">
                    🦷 {form.tooth_numbers.length} ta tish
                  </div>
                )}
                <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center active:scale-90 transition-all border-none cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-4 pb-5 pt-2 no-scrollbar">
            {renderStepIndicator()}
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
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
        fdiNumber={(() => {
          if (!selectedToothForModal) return '';
          const match = selectedToothForModal.match(/^(ur|ul|lr|ll)(\d+)$/);
          if (match) {
            const [, quadrant, num] = match;
            const quadrantMap = { ur: '1', ul: '2', ll: '3', lr: '4' };
            return quadrantMap[quadrant] + num;
          }
          return selectedToothForModal;
        })()}
        onSave={handleToothDataSave}
        existingData={(() => {
          if (!selectedToothForModal) return null;
          const match = String(selectedToothForModal).match(/^(ur|ul|lr|ll)(\d+)$/);
          const fdi = match ? ({ ur: '1', ul: '2', ll: '3', lr: '4' }[match[1]] + match[2]) : selectedToothForModal;
          return toothDataMap[selectedToothForModal] || toothDataMap[fdi] || null;
        })()}
      />
    </>
  );
}
