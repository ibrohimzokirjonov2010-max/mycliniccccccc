import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Upload, FileText, X, Check, Calendar, User, Activity, Info, Shield, Layers, Hash, Thermometer, Stethoscope, Image as ImageIcon } from 'lucide-react';
import PatientModal from '../patients/PatientModal';
import PatientSelect from '../patients/PatientSelect';
import ProfessionalOdontogram from '../patients/ProfessionalOdontogram';
import ToothImplantModal from './ToothImplantModal';
import { useTranslation } from '@/i18n/LanguageContext';

// Constants
const FIRMALAR = ['Nobel', 'Osstem', 'Straumann', 'Nucleoss', 'Boshqa'];
const IMPLANT_TYPES = ['Bone level', 'Tissue level'];
const BONE_TYPES = ['D1', 'D2', 'D3', 'D4'];
const LIFECYCLE_STATUSES = [
  "planned",
  "placed",
  "healing",
  "abutment",
  "crown",
  "completed",
  "failure"
];
const REMINDER_OPTIONS = [
  { label: '1 oy', value: 1 },
  { label: '2 oy', value: 2 },
  { label: '3 oy', value: 3 }
];

export const EXTRA_SERVICES = [
  // Tashxis va rejalashtirish
  { id: 'surgical_guide', label: 'Jarrohlik shabloni (Surgical Guide)', category: 'Diagnostika' },

  // Abatment va komponentlar
  { id: 'abutment', label: 'Abatment', category: 'Komponentlar' },
  { id: 'healing_abutment', label: 'Healing abatment (Formirovatel)', category: 'Komponentlar' },
  { id: 'cover_screw', label: 'Zaglushka (Cover screw)', category: 'Komponentlar' },
  { id: 'multi_unit', label: 'Multi-unit abatment', category: 'Komponentlar' },
  
  // Xirurgik operatsiyalar
  { id: 'sinus_open', label: 'Ochiq sinus-lifting', category: 'Sinus' },
  { id: 'sinus_closed', label: 'Yopiq sinus-lifting', category: 'Sinus' },
  { id: 'sst_transplant', label: 'SST ko\'chirish (Soft Tissue Graft)', category: 'Transplant' },
  { id: 'piezosurgery', label: 'Piezosurgery (Ultrasonik jarrohlik)', category: 'Xirurgiya' },
  
  // Suyak regeneratsiyasi
  { id: 'bone_graft', label: 'Suniy suyak (Bone graft)', category: 'Graft' },
  { id: 'membrane', label: 'Membrana qo\'yish', category: 'Graft' },
  { id: 'prf', label: 'PRF/A-PRF (Qon plazmasidan membrana)', category: 'Graft' },
  { id: 'nkr', label: 'NKR qo\'yish (Guided bone regeneration)', category: 'Graft' },
  
  // Boshqa xizmatlar
  { id: 'extraction', label: 'Atravmatik tish olish', category: 'Xirurgiya' },
  { id: 'gingivoplasty', label: 'Gingivoplastika', category: 'Soft Tissue' },
  { id: 'temp_crown', label: 'Vaqtinchalik toj (Provisional crown)', category: 'Ortopediya' },
  { id: 'explantation', label: 'Implantni olib tashlash', category: 'Xirurgiya' }
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
    lifecycle_status: "planned",
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
  const [uploading, setUploading] = useState(false);
  const [hoveredTooth, setHoveredTooth] = useState(null);
  
  // Har bir tish uchun alohida implant ma'lumotlari
  const [toothDataMap, setToothDataMap] = useState({});
  const [selectedToothForModal, setSelectedToothForModal] = useState(null);
  const [toothModalOpen, setToothModalOpen] = useState(false);
  // Local storage check for schema optimization
  const [isSchemaOptimized, setIsSchemaOptimized] = useState(true);

  // Parent'dan kelgan yangi bemorlar ro'yxatini yuklash
  useEffect(() => {
    setLocalPatients(patients);
  }, [patients]);

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
      if (relatedImplants && relatedImplants.length > 0) {
        const mapping = {};
        relatedImplants.forEach(imp => {
          mapping[imp.tooth_id] = imp;
        });
        setToothDataMap(mapping);
      }
    } else {
      resetForm();
      setToothDataMap({});
    }
    setStep(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const toggleTooth = useCallback((num) => {
    setForm(prev => {
      const exists = prev.tooth_numbers.includes(num);
      if (exists) {
        return { ...prev, tooth_numbers: prev.tooth_numbers.filter(n => n !== num) };
      } else {
        return { ...prev, tooth_numbers: [...prev.tooth_numbers, num] };
      }
    });
  }, []);

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
    if (!form.patient_name || form.tooth_numbers.length === 0) {
      alert(t('implants.form.validationAlert'));
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

      // Har bir tish uchun alohida implant yozuvi yaratish
      const savePromises = form.tooth_numbers.map(async (toothId) => {
        const toothData = toothDataMap[toothId] || {};
        
        // FDI raqamini olish
        let fdiNumber = '';
        const match = toothId.match(/^(ur|ul|lr|ll)(\d+)$/);
        if (match) {
          const [, quadrant, num] = match;
          const quadrantMap = { ur: '1', ul: '2', ll: '3', lr: '4' };
          fdiNumber = quadrantMap[quadrant] + num;
        }

        // Tish uchun barcha texnik ma'lumotlarni to'g'ri birlashtirish
        // toothData mavjud bo'lsa undan, aks holda formdan olinadi
        const mergedFirma = toothData.firma || form.firma || '';
        const mergedFirmaCustom = toothData.firma_custom || form.firma_custom || '';
        const mergedBrend = toothData.brend || form.brend || '';
        const mergedDiameter = toothData.diameter != null && toothData.diameter !== '' ? toothData.diameter : (form.diameter || '');
        const mergedLength = toothData.length != null && toothData.length !== '' ? toothData.length : (form.length || '');
        const mergedLotNumber = toothData.lot_number != null && toothData.lot_number !== '' ? toothData.lot_number : (form.lot_number || '');
        const mergedTorque = toothData.torque != null && toothData.torque !== '' ? toothData.torque : (form.torque || '');
        const mergedIsq = toothData.isq != null && toothData.isq !== '' ? toothData.isq : (form.isq || '');
        const mergedBoneType = toothData.bone_type || form.bone_type || 'D2';
        const mergedImplantType = toothData.implant_type || form.implant_type || 'Bone level';
        const mergedNotes = toothData.notes || form.notes || '';

        // tooth_data - JSONB sifatida barcha tish-spesifik ma'lumotlarni saqlash
        // Bu Supabase ustun muammolarini hal qiladi va hech qachon yo'qolmaydi
        const toothDataJson = {
          firma: mergedFirma,
          firma_custom: mergedFirmaCustom,
          brend: mergedBrend,
          diameter: mergedDiameter,
          length: mergedLength,
          lot_number: mergedLotNumber,
          torque: mergedTorque,
          isq: mergedIsq,
          bone_type: mergedBoneType,
          implant_type: mergedImplantType,
          notes: mergedNotes,
        };

        const data = {
          ...form,
          // Asosiy maydonlar
          tooth_number: fdiNumber,
          tooth_id: toothId,
          // Alohida ustunlarga ham yozish (agar baza qo'llab-quvvatlasa)
          firma: mergedFirma,
          firma_custom: mergedFirmaCustom,
          brend: mergedBrend,
          diameter: mergedDiameter,
          length: mergedLength,
          lot_number: mergedLotNumber,
          torque: mergedTorque,
          isq: mergedIsq,
          bone_type: mergedBoneType,
          implant_type: mergedImplantType,
          notes: mergedNotes,
          // JSONB backup - har doim ishlaydi
          tooth_data: toothDataJson,
          audit_log: auditLog,
          timeline
        };

        const existingImp = relatedImplants.find(r => r.tooth_id === toothId);

        if (existingImp) {
          await base44.entities.Implant.update(existingImp.id, data);
        } else if (implant && form.tooth_numbers.length === 1) {
          await base44.entities.Implant.update(implant.id, data);
        } else {
          await base44.entities.Implant.create(data);
        }
      });

      await Promise.all(savePromises);

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
    setToothDataMap(prev => ({
      ...prev,
      [toothId]: data
    }));
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
    <div className="mb-6 sm:mb-8">
      <div className="flex items-center justify-between mb-2 px-2 sm:px-4">
        {[1, 2, 3].map(s => (
          <div key={s} className="flex flex-col items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => step >= s && setStep(s)}
              className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs sm:text-sm font-black transition-all duration-500 shadow-md ${
                step >= s 
                  ? 'bg-primary text-white scale-110' 
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {s}
            </button>
            <span className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider ${
              step >= s ? 'text-primary' : 'text-muted-foreground'
            }`}>
              {s === 1 ? t('patients.wizard.patient') : s === 2 ? t('patients.wizard.services') : t('navigation.implants')}
            </span>
          </div>
        ))}
      </div>
      <div className="relative h-1 bg-muted rounded-full mx-8 sm:mx-10 -mt-6 sm:-mt-8 -z-10">
        <div 
          className="absolute h-full bg-primary transition-all duration-500 rounded-full"
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
              onClick={() => setField('tooth_numbers', [])}
            >
              <X className="w-2.5 h-2.5 sm:w-3 h-3 mr-1" /> {t('common.clear')}
            </Button>
          )}
        </Label>
        
        {/* Tanlangan tishlar ro'yxati */}
        {form.tooth_numbers.length > 0 && (
          <div className="flex flex-wrap gap-2 p-3 rounded-xl border border-slate-200" style={{ background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)' }}>
            {form.tooth_numbers.map(toothId => {
              let fdiNumber = '';
              let srcImage = '';
              let isLeft = false;
              
              if (toothId.startsWith('ur')) {
                const num = toothId.replace('ur', '');
                fdiNumber = `1${num}`;
                srcImage = `kamron/tepa_ong_${num}`;
                isLeft = false;
              } else if (toothId.startsWith('ul')) {
                const num = toothId.replace('ul', '');
                fdiNumber = `2${num}`;
                srcImage = `kamron/tepa_chap_${num}`;
                isLeft = false;
              } else if (toothId.startsWith('lr')) {
                const num = toothId.replace('lr', '');
                fdiNumber = `4${num}`;
                srcImage = `kamron/pas_ong_${num}`;
                isLeft = false;
              } else if (toothId.startsWith('ll')) {
                const num = toothId.replace('ll', '');
                fdiNumber = `3${num}`;
                srcImage = `kamron/pas_chap_${num}`;
                isLeft = false;
              }
              
              return (
                <div key={toothId} className="flex items-center gap-1.5 px-2 py-1.5 bg-amber-50 rounded-lg border border-amber-300 shadow-sm">
                  <img 
                    src={`/teeth/${srcImage}.png`}
                    alt={`Tish ${fdiNumber}`}
                    className="w-7 h-8 object-contain"
                    style={{
                      filter: 'contrast(1.0) brightness(1.02) drop-shadow(0 2px 4px rgba(0,0,0,0.05)) saturate(0.95)'
                    }}
                  />
                  <span className="text-xs font-bold text-amber-800">{fdiNumber}</span>
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({
                      ...prev,
                      tooth_numbers: prev.tooth_numbers.filter(t => t !== toothId)
                    }))}
                    className="ml-1 w-5 h-5 rounded-full bg-red-100 hover:bg-red-200 flex items-center justify-center transition-colors"
                  >
                    <span className="text-red-600 text-sm font-bold">×</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
        
        {/* Professional tish diagrammasi - 32 ta tish */}
        <div className="w-full rounded-2xl border border-slate-100 shadow-sm overflow-hidden bg-white">
          <ProfessionalOdontogram
            selectedTeeth={form.tooth_numbers}
            onChange={(teeth) => setForm(prev => ({ ...prev, tooth_numbers: teeth }))}
            multi={true}
            onToothClick={handleToothClick}
            hideChildren={true}
            compact={true}
            hideLegend={false}
            hideStats={false}
            hideHeader={false}
          />
        </div>
      </div>

      <div className="bg-muted/30 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-border/50">
        <Label className="text-[10px] sm:text-xs font-bold text-muted-foreground mb-1 block">Shifokor</Label>
        <div className="relative">
          <Stethoscope className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9 sm:pl-10 bg-background border-border/60 h-10 sm:h-11 rounded-lg sm:rounded-xl text-xs sm:text-sm"
            value={form.doctor}
            onChange={e => setField('doctor', e.target.value)}
            placeholder="Mas'ul shifokor"
          />
        </div>
      </div>

      {/* Tanlangan tishlar uchun implant ma'lumotlari kartalari (Step 1 ga qaytarildi) */}
      {form.tooth_numbers.length > 0 && (
        <div className="mt-4 sm:mt-6 space-y-3 border-t pt-4 sm:pt-6 border-dashed border-border/60">
          <Label className="text-xs sm:text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2 mb-2 sm:mb-4">
            <Info className="w-4 h-4 text-primary" /> Tanlangan tishlar ma'lumotlari
          </Label>
          <div className="grid grid-cols-1 gap-3">
            <AnimatePresence mode="popLayout">
              {[...new Set((form.tooth_numbers || []).map(String))].map((toothId, idx) => {
                const data = toothDataMap[toothId];
                
                // FDI raqamini aniqlash
                let fdiNumber = '';
                let srcImage = '';
                let isLeft = false;
                
                if (toothId.startsWith('ur')) {
                  const num = toothId.replace('ur', '');
                  fdiNumber = `1${num}`;
                  srcImage = `kamron/tepa_ong_${num}`;
                  isLeft = false;
                } else if (toothId.startsWith('ul')) {
                  const num = toothId.replace('ul', '');
                  fdiNumber = `2${num}`;
                  srcImage = `kamron/tepa_chap_${num}`;
                  isLeft = false;
                } else if (toothId.startsWith('lr')) {
                  const num = toothId.replace('lr', '');
                  fdiNumber = `4${num}`;
                  srcImage = `kamron/pas_ong_${num}`;
                  isLeft = false;
                } else if (toothId.startsWith('ll')) {
                  const num = toothId.replace('ll', '');
                  fdiNumber = `3${num}`;
                  srcImage = `kamron/pas_chap_${num}`;
                  isLeft = false;
                }

                return (
                  <motion.div 
                    key={toothId}
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    transition={{ duration: 0.2 }}
                    onClick={() => handleToothClick(toothId)}
                    className={`group relative p-4 sm:p-5 rounded-[1.5rem] border-2 transition-all cursor-pointer active:scale-[0.98] flex items-center justify-between ${
                      data 
                        ? 'bg-emerald-50/40 border-emerald-200 hover:border-emerald-400 shadow-sm' 
                        : 'border-dashed border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30'
                    }`}
                    style={{ background: data ? 'linear-gradient(135deg, #f0fdf4, #f8fafc)' : undefined }}
                  >
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl border border-slate-200 flex items-center justify-center shadow-sm shrink-0" style={{ background: 'linear-gradient(135deg, #ffffff, #f8fafc)' }}>
                        <img 
                          src={`/teeth/${srcImage}.png`}
                          alt={`Tish ${fdiNumber}`}
                          className="w-9 h-9 sm:w-11 sm:h-11 object-contain"
                          style={{
                            filter: data
                              ? 'contrast(1.1) brightness(1.0) drop-shadow(0 4px 6px rgba(59,130,246,0.3)) saturate(1.1)'
                              : 'contrast(0.9) brightness(0.9) grayscale(0.2) opacity(0.7)'
                          }}
                        />
                      </div>
                      <div className="space-y-0.5 min-w-0">
                        <h4 className="text-lg sm:text-xl font-black text-amber-900 flex items-center gap-2">
                          🦷 Tish #{fdiNumber}
                          {data && <Check className="w-5 h-5 text-emerald-500 stroke-[4]" />}
                        </h4>
                        {data ? (
                          <p className="text-amber-700 font-bold uppercase tracking-widest text-[10px] sm:text-xs truncate">
                            {data.firma} | {data.diameter && data.length ? `${data.diameter}x${data.length}` : '?'} | {data.torque ? `${data.torque}NCM` : '?NCM'}
                          </p>
                        ) : (
                          <p className="text-amber-500/70 font-bold text-[10px] sm:text-xs">
                            Ma'lumotlar kiritilmagan — bosing
                          </p>
                        )}
                      </div>
                    </div>
                    
                    {data ? (
                      <div className="w-10 h-10 sm:w-11 sm:h-11 bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-emerald-200/60 shrink-0">
                        <Check className="w-6 h-6 stroke-[3]" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 sm:w-11 sm:h-11 border-2 border-amber-200 rounded-full flex items-center justify-center text-amber-300 group-hover:bg-amber-500 group-hover:text-white group-hover:border-amber-500 transition-all shrink-0">
                        <Plus className="w-5 h-5" />
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      )}

      <div className="flex justify-end pt-2 sm:pt-4">
        <Button
          onClick={() => setStep(2)}
          disabled={!isStep1Valid}
          className="h-10 sm:h-12 px-6 sm:px-8 rounded-xl sm:rounded-2xl bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all active:scale-95 text-xs sm:text-sm"
        >
          Keyingisi <Calendar className="w-3.5 h-3.5 sm:w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );

  /**
   * Render Step 2: Xizmatlar
   */
  const renderStep2 = () => (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="bg-muted/30 p-4 sm:p-5 rounded-2xl border border-border/50 shadow-sm space-y-4">
        <Label className="text-xs sm:text-sm font-black text-slate-700 flex items-center gap-2">
          <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
            <Layers className="w-4 h-4" />
          </div>
          Implant uchun qo'shimcha xizmatlar
        </Label>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {EXTRA_SERVICES.map(service => (
            <button
              key={service.id}
              type="button"
              onClick={() => toggleExtraService(service.id)}
              className={`flex items-center justify-between p-3 sm:p-4 rounded-xl text-[11px] sm:text-xs font-black border-2 transition-all active:scale-95 ${
                form.extra_services.includes(service.id)
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-md shadow-emerald-100'
                  : 'bg-white border-slate-100 text-slate-500 hover:border-slate-300'
              }`}
            >
              <span className="text-left leading-tight">{service.label}</span>
              {form.extra_services.includes(service.id) ? (
                <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center text-white">
                  <Check className="w-3 h-3 stroke-[3]" />
                </div>
              ) : (
                <div className="w-5 h-5 border-2 border-slate-200 rounded-lg" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-between pt-2 sm:pt-4 gap-3">
        <Button variant="outline" onClick={() => setStep(1)} className="h-10 sm:h-12 px-6 rounded-xl sm:rounded-2xl border-2 text-xs sm:text-sm font-black text-slate-600">
          ← Orqaga
        </Button>
        <Button
          onClick={() => setStep(3)}
          className="h-10 sm:h-12 px-8 rounded-xl sm:rounded-2xl bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all active:scale-95 text-xs sm:text-sm font-black text-white"
        >
          Keyingisi <Shield className="w-3.5 h-3.5 sm:w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );

  /**
   * Render Step 3: Implant Texnik ma'lumotlari & Yakunlash
   */
  const renderStep3 = () => (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="bg-muted/30 p-4 sm:p-5 rounded-2xl border border-border/50 shadow-sm space-y-4">
        <Label className="text-[10px] sm:text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-primary" /> {t('implants.form.reminders')}
        </Label>
        
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          {REMINDER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleReminderMonths(opt.value)}
              className={`flex flex-col items-center justify-center p-2 sm:p-4 rounded-xl border-2 transition-all active:scale-95 ${
                form.reminder_months === opt.value
                  ? 'bg-primary/5 border-primary text-primary shadow-md shadow-primary/5'
                  : 'bg-white border-slate-100 text-slate-500 hover:border-slate-300'
              }`}
            >
              <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center mb-1.5 transition-colors ${
                form.reminder_months === opt.value ? 'bg-primary text-white' : 'bg-slate-100 text-slate-400'
              }`}>
                <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <span className="text-[10px] sm:text-xs font-black">{t(`common.months.${opt.value}`) || opt.label}</span>
              <span className="text-[8px] sm:text-[9px] font-bold opacity-60 mt-0.5">{t('recall.type')}</span>
            </button>
          ))}
          <button
              type="button"
              onClick={() => handleReminderMonths('custom')}
              className={`flex flex-col items-center justify-center p-2 sm:p-4 rounded-xl border-2 transition-all active:scale-95 ${
                form.reminder_months === 'custom'
                  ? 'bg-primary/5 border-primary text-primary shadow-md shadow-primary/5'
                  : 'bg-white border-slate-100 text-slate-500 hover:border-slate-300'
              }`}
            >
              <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center mb-1.5 transition-colors ${
                form.reminder_months === 'custom' ? 'bg-primary text-white' : 'bg-slate-100 text-slate-400'
              }`}>
                <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <span className="text-[10px] sm:text-xs font-black leading-tight">{t('common.other')}</span>
              <span className="text-[8px] sm:text-[9px] font-bold opacity-60 mt-0.5">{t('implants.form.selectDate')}</span>
          </button>
        </div>

        {form.reminder_months === 'custom' && (
          <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100 space-y-2 mt-3 animate-in fade-in slide-in-from-top-2">
            <Label className="text-[10px] sm:text-[11px] font-black text-emerald-700 uppercase">{t('implants.form.customReminderDate')}</Label>
            <Input 
              type="date" 
              className="bg-white border-emerald-200 text-emerald-800 shadow-sm focus-visible:ring-emerald-500 font-bold"
              value={form.reminder_date}
              onChange={e => setField('reminder_date', e.target.value)}
            />
          </div>
        )}

        {form.reminder_date && form.reminder_months !== 'custom' && (
          <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600">
                <Check className="w-4 h-4 stroke-[3]" />
              </div>
              <div>
                <div className="text-[9px] font-bold text-emerald-600 uppercase">{t('recall.scheduledDate')}</div>
                <div className="text-xs font-black text-slate-700">{form.reminder_date}</div>
              </div>
            </div>
            <div className="text-[10px] font-bold text-emerald-600">
              {form.reminder_months} {t('recall.months')}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div className="bg-muted/30 p-4 rounded-2xl border border-border/50 space-y-2">
          <Label className="text-[10px] sm:text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-primary" /> {t('implants.form.placementDate')} *
          </Label>
          <Input
            type="date"
            className="bg-white border-slate-200 h-11 sm:h-12 rounded-xl text-sm font-bold shadow-sm"
            value={form.placement_date}
            onChange={e => handleDateChange(e.target.value)}
          />
        </div>
        <div className="bg-muted/30 p-4 rounded-2xl border border-border/50 space-y-2">
          <Label className="text-[10px] sm:text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-primary" /> {t('implants.table.status')}
          </Label>
          <Select value={form.lifecycle_status} onValueChange={v => setField('lifecycle_status', v)}>
            <SelectTrigger className="bg-white border-slate-200 h-11 shadow-sm text-sm font-bold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LIFECYCLE_STATUSES.map(s => (
                <SelectItem key={s} value={s}>{t(`implants.status.${s}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-muted/30 p-4 rounded-2xl border border-border/50 space-y-4">
        <Label className="text-[10px] sm:text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
          <Upload className="w-3.5 h-3.5 text-primary" /> {t('implants.form.docsReminders')}
        </Label>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="flex flex-col items-center gap-1 p-3 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-primary hover:bg-primary/5 transition-all group font-bold text-[10px]">
              <input type="file" className="hidden" onChange={handlePassportUpload} />
              <FileText className="w-4 h-4 text-slate-400 group-hover:text-primary mb-1" />
              {t('implants.form.uploadPassport')}
            </label>
            
            {form.passport_url && (
              <div className="relative group w-full aspect-[4/3] rounded-xl overflow-hidden border border-border shadow-sm">
                <img src={form.passport_url} alt="Passport" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setField('passport_url', '')}
                  className="absolute top-1 right-1 w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
          
          <div className="space-y-2">
            <label className="flex flex-col items-center gap-1 p-3 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-primary hover:bg-primary/5 transition-all group font-bold text-[10px]">
              <input type="file" className="hidden" multiple onChange={handleXrayUpload} />
              <ImageIcon className="w-4 h-4 text-slate-400 group-hover:text-primary mb-1" />
              {t('implants.form.uploadXrays')}
            </label>

            {form.xray_urls && form.xray_urls.length > 0 && (
              <div className="grid grid-cols-3 gap-1.5 mt-2">
                {form.xray_urls.map((url, idx) => (
                  <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border border-border">
                    <img src={url} alt={`Xray ${idx}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeXray(idx)}
                      className="absolute top-0.5 right-0.5 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <textarea
          className="w-full bg-white border-slate-200 rounded-xl p-4 text-sm font-bold text-slate-600 min-h-[80px] resize-none focus:ring-2 focus:ring-primary/20 shadow-sm outline-none transition-all"
          value={form.notes}
          onChange={e => setField('notes', e.target.value)}
          placeholder={t('implants.form.notesPlaceholder')}
        />
      </div>

      <div className="flex justify-between pt-4 gap-3">
        <Button variant="outline" onClick={() => setStep(2)} className="h-12 px-6 rounded-2xl border-2 font-black text-sm text-slate-600">
          ← {t('common.back')}
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving || !isStep3Valid}
          className="h-12 px-10 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 border-0 shadow-lg shadow-emerald-500/20 font-black text-white active:scale-95 transition-all"
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
        <DialogContent className="sm:max-w-4xl w-[98vw] max-h-[95vh] p-0 overflow-hidden rounded-[1.5rem] sm:rounded-[2.5rem] border-none shadow-2xl flex flex-col">
          {/* Sticky Header - Simplified to avoid Radix key conflicts */}
          <DialogHeader className="p-4 sm:p-6 pb-2 bg-background/80 backdrop-blur-md sticky top-0 z-50 border-b border-border/10 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 sm:p-2 bg-primary/10 rounded-lg sm:rounded-xl text-primary shrink-0">🦷</span>
              <DialogTitle className="text-lg sm:text-2xl font-black tracking-tight truncate">
                {implant ? t('common.edit') : t('implants.form.newImplant')}
              </DialogTitle>
            </div>
            
            <div key="schema-status-indicator" className={`mr-10 px-3 py-1.5 rounded-full border flex items-center gap-1.5 transition-all ${
              isSchemaOptimized 
                ? 'bg-emerald-50 border-emerald-100 text-emerald-600' 
                : 'bg-blue-50 border-blue-100 text-blue-600'
            }`}>
              {isSchemaOptimized ? (
                <div key="optimized-badge" className="flex items-center gap-1.5 uppercase text-[10px] font-black tracking-tighter">
                  <Shield className="w-3.5 h-3.5 fill-emerald-500/10" /> Baza: Optimized
                </div>
              ) : (
                <div key="smart-badge" className="flex items-center gap-1.5 uppercase text-[10px] font-black tracking-tighter">
                  <Activity className="w-3.5 h-3.5 animate-pulse" /> Baza: Smart Persistence
                </div>
              )}
            </div>
          </DialogHeader>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-6 sm:pb-8 pt-2 scrollbar-hide">
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

      {/* Har bir tish uchun implant ma'lumotlari modali */}
      <ToothImplantModal
        open={toothModalOpen}
        onClose={() => setToothModalOpen(false)}
        toothId={selectedToothForModal}
        fdiNumber={(() => {
          if (!selectedToothForModal) return '';
          // Convert tooth ID to FDI number
          const match = selectedToothForModal.match(/^(ur|ul|lr|ll)(\d+)$/);
          if (match) {
            const [, quadrant, num] = match;
            const quadrantMap = { ur: '1', ul: '2', ll: '3', lr: '4' };
            return quadrantMap[quadrant] + num;
          }
          return selectedToothForModal;
        })()}
        onSave={handleToothDataSave}
        existingData={selectedToothForModal ? toothDataMap[selectedToothForModal] : null}
      />
    </>
  );
}
