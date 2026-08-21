import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useTranslation } from '@/i18n/LanguageContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { applyPhoneMask, capitalizeName, validateAddress, capitalizeAsYouType } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/**
 * Patient status options
 */
const PATIENT_STATUSES = ['new', 'active', 'in treatment', 'waiting', 'inactive'];

/**
 * Patient source options
 */
const PATIENT_SOURCES = ['Telegram', 'Instagram', 'Google', 'Website', 'Tavsiya', 'Call', 'Boshqa'];

/**
 * PatientModal Component
 * 
 * Modal dialog for creating or editing patient records.
 */
export default function PatientModal({ open, onClose, patient, onSaved }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    birth_date: '',
    gender: 'Male',
    address: '',
    status: 'new',
    source: '',
    important_info: ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

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
          important_info: patient.important_info || ''
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
          important_info: ''
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
    if (form.address && !validateAddress(form.address)) {
      setError("Iltimos, manzilni to'g'ri kiriting (masalan: Toshkent sh., Chilonzor tumani)");
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
        important_info: form.important_info
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? t('patients.editPatient') : t('patients.addNew')}
          </DialogTitle>
        </DialogHeader>

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
              <span>{t('patientProfile.importantInfo') || "Muhim ma'lumot (Allergiya, kasalliklar, xavf)"}</span>
            </Label>
            <Input
              id="important_info"
              value={form.important_info}
              onChange={e => handleChange('important_info', e.target.value)}
              placeholder="Masalan: Lidokain allergiyasi, qandli diabet, gipertoniya"
              disabled={saving}
              className="text-rose-600 placeholder-rose-300 font-semibold"
            />
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
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={saving}
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !isValid}
              className="bg-primary hover:bg-primary/90 min-w-[100px]"
            >
              {saving ? t('treatmentPlan.saving') : (isEditMode ? t('common.update') : t('common.save'))}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
