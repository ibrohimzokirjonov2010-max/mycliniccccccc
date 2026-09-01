import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  X, Check, Plus, Stethoscope, User, Calendar, 
  Sparkles, Layers, Search, DollarSign, Tag, FileText, ChevronRight
} from 'lucide-react';
import { 
  CrownIcon, FormerIcon, AbutmentIcon, BoneGraftIcon, 
  SinusLiftIcon, DentalSurgicalIcon, Tooth
} from '@/components/ui/Icons';
import { base44 } from '@/api/base44Client';
import PatientSelect from '../patients/PatientSelect';
import PatientModal from '../patients/PatientModal';
import { useTranslation } from '@/i18n/LanguageContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Preset Extra Services with Categories and Default Prices
export const PRESET_EXTRA_SERVICES = [
  // 1. Ortopediya & Karonkalar
  { id: 'zirkon_crown', name: 'Zirkon Karonka', defaultPrice: 1500000, category: 'Ortopediya', icon: CrownIcon, color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-200' },
  { id: 'metal_crown', name: 'Metallokeramika Karonka', defaultPrice: 800000, category: 'Ortopediya', icon: CrownIcon, color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-200' },
  { id: 'emax_crown', name: 'E-Max Press Karonka', defaultPrice: 1800000, category: 'Ortopediya', icon: CrownIcon, color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-200' },
  { id: 'temp_crown', name: 'Vaqtinchalik toj (Provisional)', defaultPrice: 200000, category: 'Ortopediya', icon: CrownIcon, color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-200' },
  { id: 'veneer', name: 'Vinir (E-Max)', defaultPrice: 1600000, category: 'Ortopediya', icon: CrownIcon, color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-200' },
  
  // 2. Abatment & Komponentlar
  { id: 'standard_abutment', name: 'Standart Abutment', defaultPrice: 300000, category: 'Komponent', icon: AbutmentIcon, color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200' },
  { id: 'zirkon_abutment', name: 'Individual Zirkon Abutment', defaultPrice: 600000, category: 'Komponent', icon: AbutmentIcon, color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200' },
  { id: 'multi_unit', name: 'Multi-unit Abatment', defaultPrice: 500000, category: 'Komponent', icon: AbutmentIcon, color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200' },
  { id: 'healing_abutment', name: 'Formik (Healing Abutment)', defaultPrice: 100000, category: 'Komponent', icon: FormerIcon, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
  { id: 'cover_screw', name: 'Zaglushka (Cover screw)', defaultPrice: 100000, category: 'Komponent', icon: AbutmentIcon, color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200' },

  // 3. Sinus & Jarrohlik
  { id: 'open_sinus', name: 'Ochiq sinus-lifting', defaultPrice: 2500000, category: 'Jarrohlik', icon: SinusLiftIcon, color: 'text-sky-600', bg: 'bg-sky-50 border-sky-200' },
  { id: 'closed_sinus', name: 'Yopiq sinus-lifting', defaultPrice: 1500000, category: 'Jarrohlik', icon: SinusLiftIcon, color: 'text-sky-600', bg: 'bg-sky-50 border-sky-200' },
  { id: 'surgical_guide', name: 'Jarrohlik shabloni (Surgical Guide)', defaultPrice: 500000, category: 'Jarrohlik', icon: DentalSurgicalIcon, color: 'text-sky-600', bg: 'bg-sky-50 border-sky-200' },
  { id: 'piezo', name: 'Piezosurgery (Ultrasonik jarrohlik)', defaultPrice: 400000, category: 'Jarrohlik', icon: DentalSurgicalIcon, color: 'text-sky-600', bg: 'bg-sky-50 border-sky-200' },
  { id: 'extraction', name: 'Atravmatik tish olish', defaultPrice: 250000, category: 'Jarrohlik', icon: DentalSurgicalIcon, color: 'text-sky-600', bg: 'bg-sky-50 border-sky-200' },
  { id: 'explantation', name: 'Implantni olib tashlash', defaultPrice: 500000, category: 'Jarrohlik', icon: DentalSurgicalIcon, color: 'text-sky-600', bg: 'bg-sky-50 border-sky-200' },

  // 4. Suyak & Regeneratsiya
  { id: 'bone_graft', name: 'Sun\'iy suyak ekish (Bone graft)', defaultPrice: 1200000, category: 'Regeneratsiya', icon: BoneGraftIcon, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
  { id: 'membrane', name: 'Membrana qo\'yish', defaultPrice: 800000, category: 'Regeneratsiya', icon: BoneGraftIcon, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
  { id: 'prf', name: 'PRF / A-PRF (Plazmolifting)', defaultPrice: 300000, category: 'Regeneratsiya', icon: BoneGraftIcon, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
  { id: 'nkr', name: 'NKR qo\'yish (GBR)', defaultPrice: 1000000, category: 'Regeneratsiya', icon: BoneGraftIcon, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
  { id: 'sst', name: 'SST ko\'chirish (Soft Tissue Graft)', defaultPrice: 800000, category: 'Regeneratsiya', icon: BoneGraftIcon, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
  { id: 'gingivoplasty', name: 'Gingivoplastika', defaultPrice: 400000, category: 'Regeneratsiya', icon: BoneGraftIcon, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
];

const CATEGORIES = ['Barchasi', 'Ortopediya', 'Komponent', 'Jarrohlik', 'Regeneratsiya', 'Boshqa'];

// FDI tooth numbering layout
const FDI_TEETH = [
  '18','17','16','15','14','13','12','11', '21','22','23','24','25','26','27','28',
  '48','47','46','45','44','43','42','41', '31','32','33','34','35','36','37','38'
];

export default function ExtraServiceModal({
  open,
  onClose,
  patients = [],
  serviceItem = null, // If editing an existing service/implant record
  onSaved
}) {
  const { language } = useTranslation();
  const today = new Date().toISOString().split('T')[0];

  const [selectedCategory, setSelectedCategory] = useState('Barchasi');
  const [searchPreset, setSearchPreset] = useState('');
  const [newPatientOpen, setNewPatientOpen] = useState(false);
  const [localPatients, setLocalPatients] = useState(patients);
  const [doctors, setDoctors] = useState([]);
  const [saving, setSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    patient_id: '',
    patient_name: '',
    patient_phone: '',
    service_name: 'Zirkon Karonka',
    custom_service_name: '',
    price: 1500000,
    tooth_numbers: [],
    placement_date: today,
    doctor: '',
    lifecycle_status: 'completed',
    firma: 'Dentium',
    notes: '',
  });

  useEffect(() => {
    setLocalPatients(patients);
  }, [patients]);

  // Load clinic doctors
  useEffect(() => {
    if (!open) return;
    const loadDoctors = async () => {
      try {
        let docList = [];
        const allUsers = await base44.entities.User.list('name', 100).catch(() => []);
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
        console.error('Error loading doctors:', err);
      }
    };
    loadDoctors();
  }, [open]);

  // Populate data when editing or opening
  useEffect(() => {
    if (!open) return;

    if (serviceItem) {
      const rawTeeth = serviceItem.tooth_numbers || (serviceItem.tooth_number ? [serviceItem.tooth_number] : []);
      const fdiTeeth = [...new Set(rawTeeth.map(String))].map(t => {
        // Convert internal quad format if needed
        const m = String(t).match(/^(ur|ul|lr|ll)(\d+)$/);
        if (m) {
          const qMap = { ur: '1', ul: '2', ll: '3', lr: '4' };
          return qMap[m[1]] + m[2];
        }
        return String(t);
      });

      const svcName = serviceItem.service_name || serviceItem.hizmat_turi || 'Qo\'shimcha xizmat';
      const isPreset = PRESET_EXTRA_SERVICES.some(p => p.name.toLowerCase() === svcName.toLowerCase());

      setFormData({
        id: serviceItem.id,
        patient_id: serviceItem.patient_id || '',
        patient_name: serviceItem.patient_name || '',
        patient_phone: serviceItem.patient_phone || '',
        service_name: isPreset ? svcName : 'Boshqa',
        custom_service_name: isPreset ? '' : svcName,
        price: Number(serviceItem.price || serviceItem.narxi) || 0,
        tooth_numbers: fdiTeeth,
        placement_date: serviceItem.placement_date ? String(serviceItem.placement_date).split('T')[0] : today,
        doctor: serviceItem.doctor || '',
        lifecycle_status: serviceItem.lifecycle_status || 'completed',
        firma: serviceItem.firma || 'Dentium',
        notes: serviceItem.notes || '',
      });
    } else {
      // Default new service
      setFormData({
        patient_id: '',
        patient_name: '',
        patient_phone: '',
        service_name: 'Zirkon Karonka',
        custom_service_name: '',
        price: 1500000,
        tooth_numbers: [],
        placement_date: today,
        doctor: '',
        lifecycle_status: 'completed',
        firma: 'Dentium',
        notes: '',
      });
    }
  }, [open, serviceItem, today]);

  const handlePatientSelect = useCallback((patientId) => {
    const patient = localPatients.find(p => p.id === patientId);
    setFormData(prev => ({
      ...prev,
      patient_id: patientId,
      patient_name: patient?.full_name || '',
      patient_phone: patient?.phone || ''
    }));
  }, [localPatients]);

  const handleSelectPreset = (preset) => {
    setFormData(prev => ({
      ...prev,
      service_name: preset.name,
      custom_service_name: '',
      price: preset.defaultPrice
    }));
  };

  const toggleTooth = (toothNum) => {
    setFormData(prev => {
      const exists = prev.tooth_numbers.includes(toothNum);
      if (exists) {
        return { ...prev, tooth_numbers: prev.tooth_numbers.filter(t => t !== toothNum) };
      } else {
        return { ...prev, tooth_numbers: [...prev.tooth_numbers, toothNum] };
      }
    });
  };

  const filteredPresets = useMemo(() => {
    return PRESET_EXTRA_SERVICES.filter(p => {
      if (selectedCategory !== 'Barchasi' && p.category !== selectedCategory) return false;
      if (searchPreset && !p.name.toLowerCase().includes(searchPreset.toLowerCase())) return false;
      return true;
    });
  }, [selectedCategory, searchPreset]);

  const finalServiceName = formData.service_name === 'Boshqa'
    ? (formData.custom_service_name.trim() || 'Qo\'shimcha xizmat')
    : formData.service_name;

  const handleSave = async () => {
    if (!formData.patient_name) {
      toast.warning("Iltimos, avval bemorni tanlang!");
      return;
    }
    if (!formData.doctor) {
      toast.warning("Iltimos, mas'ul shifokorni tanlang!");
      return;
    }
    if (!finalServiceName) {
      toast.warning("Xizmat nomini kiriting!");
      return;
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const numPrice = Number(formData.price) || 0;
      const teethArr = formData.tooth_numbers.length > 0 ? formData.tooth_numbers : ['11'];

      const payload = {
        patient_id: formData.patient_id,
        patient_name: formData.patient_name,
        patient_phone: formData.patient_phone,
        service_name: finalServiceName,
        hizmat_turi: finalServiceName,
        price: numPrice,
        narxi: numPrice,
        tooth_numbers: teethArr,
        tooth_number: teethArr[0] || '11',
        placement_date: formData.placement_date || today,
        doctor: formData.doctor,
        lifecycle_status: formData.lifecycle_status || 'completed',
        firma: formData.firma || 'Dentium',
        notes: formData.notes || '',
        incomplete_data: false,
        needs_fill: false,
        timeline: [
          {
            date: now,
            status: "completed",
            note: `${finalServiceName} (${numPrice.toLocaleString()} so'm) xizmati kiritildi`,
            user: formData.doctor || 'Dr.'
          }
        ]
      };

      if (serviceItem?.id) {
        await base44.entities.Implant.update(serviceItem.id, payload);
        toast.success("Qo'shimcha xizmat muvaffaqiyatli tahrirlandi!");
      } else {
        await base44.entities.Implant.create(payload);
        toast.success("Yangi qo'shimcha xizmat muvaffaqiyatli saqlandi!");
      }

      onSaved?.();
      onClose();
    } catch (err) {
      console.error('Failed to save extra service:', err);
      toast.error("Xizmatni saqlashda xatolik: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open && !newPatientOpen} onOpenChange={onClose}>
        <DialogContent 
          className="w-[95vw] max-w-2xl max-h-[92vh] p-0 overflow-hidden rounded-[2rem] border-none shadow-2xl flex flex-col bg-white" 
          aria-describedby={undefined}
        >
          {/* Header */}
          <DialogHeader className="shrink-0">
            <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-800 px-6 py-4 flex items-center justify-between text-white rounded-t-[2rem]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-xs">
                  <Sparkles className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <DialogTitle className="text-base font-black text-white uppercase tracking-tight">
                    {serviceItem ? "Qo'shimcha xizmatni tahrirlash" : "Yangi qo'shimcha xizmat qo'shish"}
                  </DialogTitle>
                  <p className="text-[10px] font-bold text-indigo-200 mt-0.5">
                    Karonka, Abatment, Sinus-lifting, Suyak ekish va boshqa xizmatlar reyestri
                  </p>
                </div>
              </div>
              
              <button 
                onClick={onClose} 
                className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center active:scale-90 transition-all border-none cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </DialogHeader>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs no-scrollbar">

            {/* 1. Bemor Tanlash */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-4 h-4 text-indigo-600" /> 1. Bemor ma'lumotlari *
                </Label>
                {formData.patient_name && (
                  <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                    <Check className="w-3 h-3 stroke-[3]" /> {formData.patient_name}
                  </span>
                )}
              </div>

              <PatientSelect
                patients={localPatients}
                value={formData.patient_id}
                onChange={handlePatientSelect}
                onAddPatient={() => setNewPatientOpen(true)}
                inputClassName="bg-white border-slate-200 h-10 rounded-xl font-bold text-xs"
                buttonClassName="h-10 w-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
              />
            </div>

            {/* 2. Xizmatni tanlash va Narxni belgilash */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-indigo-600" /> 2. Qo'shimcha Xizmat Turi & Narxi *
                </Label>
                <span className="text-[11px] font-black font-mono text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                  {(Number(formData.price) || 0).toLocaleString()} SO'M
                </span>
              </div>

              {/* Category Filter Chips & Add Custom Button */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none flex-1">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-[11px] font-black whitespace-nowrap transition-all cursor-pointer",
                        selectedCategory === cat
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "bg-white text-slate-600 hover:bg-slate-200/60 border border-slate-200/70"
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory('Boshqa');
                    setFormData(prev => ({
                      ...prev,
                      service_name: 'Boshqa',
                      custom_service_name: '',
                      price: 0
                    }));
                  }}
                  className="px-2.5 py-1 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 font-black text-[10px] border border-purple-200 flex items-center gap-1 transition-all cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Yangi xizmat yozish</span>
                </button>
              </div>

              {/* Preset Services Grid */}
              {selectedCategory !== 'Boshqa' && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                  {filteredPresets.map(preset => {
                    const isSelected = formData.service_name === preset.name;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleSelectPreset(preset)}
                        className={cn(
                          "p-2.5 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between group",
                          isSelected
                            ? "bg-indigo-50/90 border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs"
                            : "bg-white border-slate-200/80 hover:border-indigo-300 hover:bg-indigo-50/20"
                        )}
                      >
                        <div className="flex items-start justify-between gap-1 mb-1">
                          <span className={cn("text-[11px] font-black leading-tight truncate", isSelected ? "text-indigo-900" : "text-slate-800")}>
                            {preset.name}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-mono font-bold text-slate-400">
                            {preset.defaultPrice.toLocaleString()} so'm
                          </span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600 stroke-[3]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Custom Service Name (If Boshqa or Custom Selected) */}
              {(selectedCategory === 'Boshqa' || formData.service_name === 'Boshqa') && (
                <div className="space-y-1.5 pt-1 bg-purple-50/50 p-3 rounded-xl border border-purple-200">
                  <Label className="text-[11px] font-black text-purple-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                    O'zingiz istagan xizmat nomini kiriting:
                  </Label>
                  <Input
                    placeholder="Masalan: 3 ta tishga ko'prik, Individual shina, Lazer bilan ishlov..."
                    value={formData.custom_service_name}
                    onChange={e => {
                      setFormData(prev => ({
                        ...prev,
                        service_name: 'Boshqa',
                        custom_service_name: e.target.value
                      }));
                    }}
                    className="bg-white border-purple-300 focus:border-purple-500 font-bold h-10 rounded-xl text-xs"
                    autoFocus
                  />
                </div>
              )}

              {/* Price & Name Editor Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <Label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block mb-1">
                    Xizmat Nomi:
                  </Label>
                  <Input
                    value={finalServiceName}
                    onChange={e => setFormData(prev => ({ ...prev, service_name: e.target.value, custom_service_name: e.target.value }))}
                    placeholder="Xizmat nomini yozing..."
                    className="bg-white border-slate-200 h-10 rounded-xl font-black text-slate-900 text-xs"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-[10px] font-black text-emerald-800 uppercase tracking-wider block">
                      Xizmat Narxi (so'm) *
                    </Label>
                    <span className="text-[10px] font-mono font-black text-emerald-700">
                      {(Number(formData.price) || 0).toLocaleString()} UZS
                    </span>
                  </div>
                  <div className="relative">
                    <Input
                      type="number"
                      step="10000"
                      value={formData.price}
                      onChange={e => setFormData(prev => ({ ...prev, price: e.target.value }))}
                      className="bg-white border-emerald-300 focus:border-emerald-500 h-10 rounded-xl font-mono font-black text-slate-900 pr-12 shadow-xs"
                      placeholder="1500000"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-emerald-600">
                      SO'M
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Price Adjust Presets */}
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                <span className="text-[9.5px] font-bold text-slate-400 mr-1">Tezkor narxlar:</span>
                {[100000, 300000, 500000, 800000, 1200000, 1500000, 2000000, 2500000].map(amt => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, price: amt }))}
                    className={cn(
                      "px-2 py-0.5 rounded-lg text-[9.5px] font-mono font-bold border transition-colors cursor-pointer",
                      Number(formData.price) === amt 
                        ? "bg-emerald-600 text-white border-emerald-600" 
                        : "bg-white text-slate-600 border-slate-200 hover:border-emerald-400"
                    )}
                  >
                    {amt >= 1000000 ? `${amt / 1000000} mln` : `${amt / 1000}k`}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Tish Raqamlari (FDI) */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Tooth className="w-4 h-4 text-indigo-600" /> 3. Tish Raqami (FDI)
                </Label>
                {formData.tooth_numbers.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    {formData.tooth_numbers.map(tn => (
                      <span key={tn} className="px-2 py-0.5 bg-slate-900 text-white rounded-md text-[10px] font-mono font-black shadow-xs">
                        #{tn}
                      </span>
                    ))}
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, tooth_numbers: [] }))}
                      className="text-[10px] text-rose-500 font-bold ml-1 hover:underline cursor-pointer"
                    >
                      Tozalash
                    </button>
                  </div>
                )}
              </div>

              {/* Tooth Selector Grid */}
              <div className="bg-white p-2 rounded-xl border border-slate-200/70">
                <div className="grid grid-cols-8 sm:grid-cols-16 gap-1 text-center">
                  {FDI_TEETH.map(tNum => {
                    const isSelected = formData.tooth_numbers.includes(tNum);
                    return (
                      <button
                        key={tNum}
                        type="button"
                        onClick={() => toggleTooth(tNum)}
                        className={cn(
                          "py-1.5 rounded-lg font-mono font-black text-[10px] transition-all cursor-pointer select-none",
                          isSelected
                            ? "bg-indigo-600 text-white shadow-xs scale-105"
                            : "bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200/50"
                        )}
                      >
                        {tNum}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 4. Sana, Shifokor va Izoh */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Sana */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-1.5">
                <Label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">
                  Bajarilgan sana *
                </Label>
                <Input
                  type="date"
                  value={formData.placement_date}
                  onChange={e => setFormData(prev => ({ ...prev, placement_date: e.target.value }))}
                  className="bg-white border-slate-200 h-10 rounded-xl font-bold text-xs"
                />
              </div>

              {/* Shifokor */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-1.5">
                <Label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">
                  Mas'ul Shifokor *
                </Label>
                <Select
                  value={formData.doctor}
                  onValueChange={v => setFormData(prev => ({ ...prev, doctor: v }))}
                >
                  <SelectTrigger className="bg-white border-slate-200 h-10 rounded-xl font-bold text-xs">
                    <SelectValue placeholder="Shifokorni tanlang..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl font-bold text-xs">
                    {doctors.map(d => {
                      const docName = d.full_name || d.name || d.username;
                      return (
                        <SelectItem key={d.id || docName} value={docName}>
                          {docName}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Izoh */}
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-1.5">
              <Label className="text-[10px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-slate-400" /> Qo'shimcha ma'lumotlar / Izoh:
              </Label>
              <Input
                placeholder="Xizmat haqida qo'shimcha ma'lumotlar, material turi yoki laboratoriya izohi..."
                value={formData.notes}
                onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                className="bg-white border-slate-200 h-10 rounded-xl text-xs font-bold"
              />
            </div>

          </div>

          {/* Footer Buttons */}
          <div className="p-4 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between gap-3 shrink-0">
            <Button
              variant="outline"
              onClick={onClose}
              className="h-10 px-5 rounded-xl border-slate-300 font-bold text-slate-600 cursor-pointer"
            >
              Bekor qilish
            </Button>

            <Button
              onClick={handleSave}
              disabled={saving || !formData.patient_name || !formData.doctor}
              className="h-10 px-7 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs gap-2 shadow-md shadow-indigo-600/20 active:scale-95 cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>{saving ? "Saqlanmoqda..." : (serviceItem ? "O'zgarishlarni saqlash" : "Xizmatni saqlash")}</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Patient Quick Creator Modal */}
      <PatientModal
        open={newPatientOpen}
        onClose={() => setNewPatientOpen(false)}
        patient={null}
        onSaved={(newPatient) => {
          if (newPatient && newPatient.id) {
            setLocalPatients(prev => [newPatient, ...prev]);
            setFormData(prev => ({
              ...prev,
              patient_id: newPatient.id,
              patient_name: newPatient.full_name || '',
              patient_phone: newPatient.phone || ''
            }));
          }
        }}
      />
    </>
  );
}
