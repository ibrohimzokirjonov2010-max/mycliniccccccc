import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useTranslation } from '@/i18n/LanguageContext';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { applyPhoneMask, capitalizeName, validateAddress, capitalizeAsYouType } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, X } from 'lucide-react';

/**
 * Patient status options
 */
const PATIENT_STATUSES = ['new', 'active', 'in treatment', 'waiting', 'inactive'];

/**
 * Patient source options
 */
const PATIENT_SOURCES = [
  { value: 'Telegram', labelKey: 'Telegram' },
  { value: 'Instagram', labelKey: 'Instagram' },
  { value: 'Google', labelKey: 'Google' },
  { value: 'Website', labelKey: 'Website' },
  { value: 'Tavsiya', labelKey: 'Recommendation' },
  { value: 'Call', labelKey: 'Call' },
  { value: 'Boshqa', labelKey: 'Other' }
];

/**
 * PatientModal Component
 * 
 * Modal dialog for creating or editing patient records.
 */
export default function PatientModal({ open, onClose, patient, onSaved }) {
  const { t } = useTranslation();
  const [doctors, setDoctors] = useState([]);
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    birth_date: '',
    gender: 'Male',
    address: '',
    status: 'new',
    source: '',
    important_info: '',
    main_treatment_provider: ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Fetch doctors list
   */
  useEffect(() => {
    if (open) {
      base44.entities.User.list('name', 50)
        .then(users => {
          const docList = (users || []).filter(u => u.role?.toLowerCase() === 'doctor' || u.role?.toLowerCase() === 'admin');
          setDoctors(docList);
        })
        .catch(err => console.error('Failed to load doctors in PatientModal:', err));
    }
  }, [open]);

  /**
   * Reset form when dialog opens or patient changes
   */
  useEffect(() => {
    if (open) {
      if (patient) {
        setForm({
          full_name: patient.full_name || '',
          phone: patient.phone || '',
          birth_date: patient.birth_date || '',
          gender: patient.gender?.toLowerCase() || 'male',
          address: patient.address || '',
          status: patient.status?.toLowerCase() || 'new',
          source: patient.source || '',
          important_info: patient.important_info || '',
          main_treatment_provider: patient.main_treatment_provider || ''
        });
      } else {
        setForm({
          full_name: '',
          phone: '',
          birth_date: '',
          gender: 'Male',
          address: '',
          status: 'new',
          source: '',
          important_info: '',
          main_treatment_provider: ''
        });
      }
      setError(null);
    }
  }, [patient, open]);

  /**
   * Handle form field changes with masking
   */
  const handleChange = useCallback((field, value) => {
    let finalValue = value;
    
    // Add professional phone masking if field is phone
    if (field === 'phone') {
      finalValue = applyPhoneMask(value);
    }
    if (field === 'full_name') {
      finalValue = capitalizeAsYouType(value);
    }

    setForm(prev => ({ ...prev, [field]: finalValue }));
    setError(null);
  }, []);

  /**
   * Validate form before saving
   */
  const validateForm = useCallback(() => {
    if (!form.full_name.trim()) {
      setError(t('patients.errorNameRequired'));
      return false;
    }
    if (!form.phone.trim()) {
      setError(t('patients.errorPhoneRequired'));
      return false;
    }
    if (!form.main_treatment_provider) {
      setError(t('patients.wizard.errorDoctorRequired') || "Shifokorni tanlash majburiy!");
      return false;
    }
    if (form.address && !validateAddress(form.address)) {
      setError(t('patients.addressError'));
      return false;
    }
    return true;
  }, [form, t]);

  /**
   * Handle save operation with data normalization
   */
  const handleSave = useCallback(async () => {
    if (!validateForm()) return;

    setSaving(true);
    setError(null);

    try {
      // Normalize data for DB (Senior approach: clean inputs before API calls)
      const cleanForm = {
        ...form,
        full_name: capitalizeName(form.full_name.trim()),
        phone: form.phone.replace(/\D/g, ''), // Save only digits
        gender: form.gender.toLowerCase(),    // Match DB constraints (male/female)
        status: form.status,                   // Keep display case, base44Client will handle normalization
        important_info: form.important_info,
        main_treatment_provider: form.main_treatment_provider
      };

      let savedPatient;
      if (patient) {
        savedPatient = await base44.entities.Patient.update(patient.id, cleanForm);
      } else {
        savedPatient = await base44.entities.Patient.create(cleanForm);
      }
      if (onSaved) onSaved(savedPatient);
      onClose();
    } catch (err) {
      console.error('Failed to save patient:', err);
      // Detailed professional error handling
      const errorMessage = typeof err === 'object' && err.message ? err.message : t('patients.errorSave');
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  }, [form, patient, onSaved, onClose, validateForm, t]);

  /**
   * Handle dialog close
   */
  const handleClose = useCallback(() => {
    if (!saving) {
      onClose();
    }
  }, [saving, onClose]);

  const isEditMode = !!patient;
  const isValid = form.full_name.trim() && form.phone.trim();

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] sm:max-w-md max-h-[90vh] p-0 rounded-[2.5rem] border-0 shadow-2xl bg-white/95 backdrop-blur-xl flex flex-col overflow-visible">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between shrink-0 rounded-t-[2.5rem]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white backdrop-blur-sm shadow-sm">
              <User className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <DialogTitle className="text-base font-black text-white uppercase tracking-tight">
                {isEditMode ? t('patients.editPatient') : t('patients.addNew')}
              </DialogTitle>
              <p className="text-[9px] font-bold text-white/80 uppercase tracking-widest mt-0.5">{t('patients.patientInfo')}</p>
            </div>
          </div>
          <button 
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-sm transition-all active:scale-95 border-none cursor-pointer"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 no-scrollbar">

        {/* Error message */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm px-4 py-2 rounded-lg">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {/* Full Name */}
          <div>
            <Label htmlFor="full_name">{t('common.name')} *</Label>
            <Input
              id="full_name"
              value={form.full_name}
              onChange={e => handleChange('full_name', e.target.value)}
              onBlur={() => {
                const capitalized = capitalizeName(form.full_name);
                handleChange('full_name', capitalized);
              }}
              placeholder={t('patients.fullNamePlaceholder')}
              disabled={saving}
              autoFocus
            />
          </div>

          {/* Phone */}
          <div>
            <Label htmlFor="phone">{t('common.phone')} *</Label>
            <Input
              id="phone"
              value={form.phone}
              onChange={e => handleChange('phone', e.target.value)}
              placeholder={t('patients.phonePlaceholder')}
              disabled={saving}
            />
          </div>

          {/* Birth Date & Gender */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="birth_date">{t('patients.birthDate')}</Label>
              <Input
                id="birth_date"
                type="date"
                value={form.birth_date}
                onChange={e => handleChange('birth_date', e.target.value)}
                disabled={saving}
              />
            </div>
            <div>
              <Label>{t('patients.gender')}</Label>
              <Select
                value={form.gender}
                onValueChange={v => handleChange('gender', v)}
                disabled={saving}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">{t('patients.male')}</SelectItem>
                  <SelectItem value="female">{t('patients.female')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Status */}
          <div>
            <Label>{t('patients.status')}</Label>
            <Select
              value={form.status}
              onValueChange={v => handleChange('status', v)}
              disabled={saving}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PATIENT_STATUSES.map(s => (
                  <SelectItem key={s} value={s}>{t(`status.${s}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Address */}
          <div>
            <Label htmlFor="address">{t('patients.address')}</Label>
            <Input
              id="address"
              value={form.address}
              onChange={e => handleChange('address', e.target.value)}
              placeholder={t('common.address')}
              disabled={saving}
            />
          </div>

          {/* Important Info (Medical warnings) */}
          <div>
            <Label htmlFor="important_info" className="flex items-center gap-1">
              <span>{t('patients.importantInfo')}</span>
            </Label>
            <Input
              id="important_info"
              value={form.important_info}
              onChange={e => handleChange('important_info', e.target.value)}
              placeholder={t('patients.importantInfoPlaceholder')}
              disabled={saving}
              className="text-rose-600 placeholder-rose-300 font-semibold"
            />
          </div>

          {/* Doctor (Mandatory) */}
          <div>
            <Label className="flex items-center gap-1">
              <span>{t('common.doctor')}</span>
              <span className="text-red-500 font-bold">*</span>
            </Label>
            <Select
              value={form.main_treatment_provider}
              onValueChange={v => handleChange('main_treatment_provider', v)}
              disabled={saving}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('common.select') || "Shifokorni tanlang"} />
              </SelectTrigger>
              <SelectContent>
                {doctors.map(d => (
                  <SelectItem key={d.id} value={d.id || d.name}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Source */}
          <div>
            <Label>{t('patients.sourceLabel')}</Label>
            <Select
              value={form.source}
              onValueChange={v => handleChange('source', v)}
              disabled={saving}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('patients.sourcePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {PATIENT_SOURCES.map(s => (
                  <SelectItem key={s.value} value={s.value}>{t(`patients.sources.${s.labelKey}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

        </div>
      </div>

      {/* Actions Footer */}
      <div className="px-6 py-4 bg-slate-55 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0 rounded-b-[2.5rem]">
          <Button
            variant="ghost"
            onClick={handleClose}
            disabled={saving}
            className="h-10 rounded-xl font-black uppercase text-[10px] tracking-wider text-slate-400 hover:bg-slate-100/50 px-4 border-none"
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !isValid}
            className="h-10 px-6 rounded-xl font-black uppercase text-xs tracking-wider border-none relative overflow-hidden shadow-md bg-slate-950 hover:bg-slate-900 text-white"
          >
            {saving ? t('treatmentPlan.saving') : (isEditMode ? t('common.update') : t('common.save'))}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
