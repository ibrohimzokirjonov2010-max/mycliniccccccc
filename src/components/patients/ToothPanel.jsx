import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Plus, Upload, ZoomIn, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useTranslation } from '@/i18n/LanguageContext';

/**
 * Tish holatlari
 */
const STATUSES = ["Sog'lom", "Kariyes", "Cavity", "Secondary cavity", "Fissure pigmentation", "Davolangan", "Jarayonda", "Olib tashlangan", "Plomba", "Pulpit", "Periodontit", "Canal partially sealed", "Dental calculus"];

/**
 * Tashxislar
 */
const DIAGNOSES = ["Sog'lom", "Kariyes", "Cavity", "Secondary cavity", "Fissure pigmentation", "Pulpit", "Periodontit", "Dental calculus", "Olib tashlangan"];

/**
 * Davolash turlari
 */
const TREATMENT_TYPES = ["Endo (kanal)", "Canal partially sealed", "Restavratsiya", "Oqartirish", "Olib tashlash", "Implant", "Protez", "Plomba qo'yish", "Dental calculus tozalash"];

/**
 * Holat ranglari
 */
const STATUS_COLORS = {
  "Sog'lom": "bg-blue-50 text-blue-700 border-blue-200",
  "Kariyes": "bg-red-50 text-red-700 border-red-200",
  "Cavity": "bg-gray-100 text-gray-900 border-gray-300",
  "Secondary cavity": "bg-orange-50 text-orange-700 border-orange-200",
  "Fissure pigmentation": "bg-amber-50 text-amber-800 border-amber-200",
  "Davolangan": "bg-blue-100 text-blue-800 border-blue-300",
  "Jarayonda": "bg-yellow-50 text-yellow-700 border-yellow-200",
  "Olib tashlangan": "bg-gray-100 text-gray-500 border-gray-200",
  "Plomba": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Pulpit": "bg-pink-50 text-pink-700 border-pink-200",
  "Periodontit": "bg-violet-50 text-violet-700 border-violet-200",
  "Canal partially sealed": "bg-rose-50 text-rose-700 border-rose-200",
  "Dental calculus": "bg-amber-50 text-amber-700 border-amber-200",
};

/**
 * ToothPanel komponenti
 * 
 * Alohida tish yozuvlarini boshqarish paneli - davolash, rentgen va holat kuzatuvi.
 * Ichki yon panel sifatida ko'rsatilishi mumkin.
 * 
 * @param {Object} props
 * @param {string} props.patientId - Bemor ID
 * @param {number} props.toothNumber - FDI tish raqami
 * @param {Object} props.record - Mavjud tish yozuvi (yangi uchun null)
 * @param {Array} props.plans - Bemorning davolash rejasi
 * @param {Function} props.onClose - Yopish callback
 * @param {boolean} props.inline - Ichki ko'rinishda ko'rsatish
 */
export default function ToothPanel({ patientId, toothNumber, record, plans, onClose, inline = false }) {
  const { t } = useTranslation();

  const translateStatus = useCallback((status) => {
    const map = {
      "Sog'lom": t('odontogram.statuses.healthy'),
      "Davolangan": t('odontogram.statuses.completed'),
      "Jarayonda": t('odontogram.statuses.in_progress'),
      "Rejalashtirilgan": t('odontogram.statuses.planned'),
      "Kariyes": t('odontogram.statuses.caries'),
      "Cavity": t('odontogram.statuses.cavity'),
      "Secondary cavity": t('odontogram.statuses.secondary_cavity'),
      "Fissure pigmentation": t('odontogram.statuses.fissure_pigmentation'),
      "Canal partially sealed": t('odontogram.statuses.canal_partial'),
      "Dental calculus": t('odontogram.statuses.calculus'),
      "Olib tashlangan": t('odontogram.statuses.extracted'),
      "Plomba": t('odontogram.statuses.crown') || "Plomba",
      "Pulpit": t('odontogram.statuses.pulpit') || "Pulpit",
      "Periodontit": t('odontogram.statuses.periodontit') || "Periodontit",
    };
    return map[status] || status;
  }, [t]);

  const translateDiagnosis = useCallback((diagnosis) => {
    const map = {
      "Sog'lom": t('odontogram.diagnoses.healthy'),
      "Kariyes": t('odontogram.diagnoses.caries'),
      "Cavity": t('odontogram.diagnoses.cavity'),
      "Secondary cavity": t('odontogram.diagnoses.secondary_cavity'),
      "Fissure pigmentation": t('odontogram.diagnoses.fissure_pigmentation'),
      "Pulpit": t('odontogram.diagnoses.pulpit') || "Pulpit",
      "Periodontit": t('odontogram.diagnoses.periodontitis'),
      "Dental calculus": t('odontogram.diagnoses.calculus'),
      "Olib tashlangan": t('odontogram.diagnoses.extracted'),
    };
    return map[diagnosis] || diagnosis;
  }, [t]);

  const translateTreatmentType = useCallback((treatment) => {
    const map = {
      "Endo (kanal)": t('odontogram.treatments.endo'),
      "Canal partially sealed": t('odontogram.treatments.canal_partial'),
      "Restavratsiya": t('odontogram.treatments.restoration'),
      "Oqartirish": t('odontogram.treatments.whitening'),
      "Olib tashlash": t('odontogram.treatments.extraction'),
      "Implant": t('odontogram.treatments.implant'),
      "Protez": t('odontogram.treatments.prosthesis'),
      "Plomba qo'yish": t('odontogram.treatments.filling'),
      "Dental calculus tozalash": t('odontogram.treatments.scaling'),
    };
    return map[treatment] || treatment;
  }, [t]);

  const [form, setForm] = useState({
    status: "Sog'lom",
    diagnosis: "Sog'lom",
    notes: '',
    doctor: '',
    treatments: [],
    xray_urls: [],
    treatment_plan_id: '',
  });
  const [saving, setSaving] = useState(false);
  const [newTreatment, setNewTreatment] = useState({
    type: '',
    date: new Date().toISOString().split('T')[0],
    doctor: '',
    notes: ''
  });
  const [addingTreatment, setAddingTreatment] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [zoomImg, setZoomImg] = useState(null);
  const isRemovedTooth = form.status === "Olib tashlangan";
  useEffect(() => {
    if (record) {
      setForm({
        status: record.status || "Sog'lom",
        diagnosis: record.diagnosis || "Sog'lom",
        notes: record.notes || '',
        doctor: record.doctor || '',
        treatments: record.treatments || [],
        xray_urls: record.xray_urls || [],
        treatment_plan_id: record.treatment_plan_id || '',
      });
    } else {
      setForm({
        status: "Sog'lom",
        diagnosis: "Sog'lom",
        notes: '',
        doctor: '',
        treatments: [],
        xray_urls: [],
        treatment_plan_id: ''
      });
    }
  }, [record, toothNumber]);

  /**
   * Formani saqlash
   */
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const data = { ...form, patient_id: patientId, tooth_number: toothNumber };
      if (record?.id) {
        await base44.entities.ToothRecord.update(record.id, data);
      } else {
        await base44.entities.ToothRecord.create(data);
      }
      onClose();
    } catch (error) {
      console.error('Tish yozuvini saqlashda xatolik:', error);
    } finally {
      setSaving(false);
    }
  }, [form, patientId, toothNumber, record, onClose]);

  /**
   * Yangi davolash qo'shish
   */
  const addTreatment = useCallback(() => {
    if (isRemovedTooth) {
      toast.error(t('odontogram.errors.removedToothError') || "Olib tashlangan tish uchun yangi xizmat yozib bo'lmaydi");
      return;
    }
    if (!newTreatment.type) return;
    setForm(prev => ({
      ...prev,
      treatments: [...prev.treatments, { ...newTreatment }]
    }));
    setNewTreatment({
      type: '',
      date: new Date().toISOString().split('T')[0],
      doctor: '',
      notes: ''
    });
    setAddingTreatment(false);
  }, [isRemovedTooth, newTreatment]);

  /**
   * Davolashni indeks bo'yicha o'chirish
   */
  const removeTreatment = useCallback((idx) => {
    setForm(prev => ({
      ...prev,
      treatments: prev.treatments.filter((_, i) => i !== idx)
    }));
  }, []);

  /**
   * Rentgen yuklash
   */
  const handleXrayUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const file_url = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      setForm(prev => ({ ...prev, xray_urls: [...prev.xray_urls, file_url] }));
    } catch (error) {
      console.error('Rentgen yuklashda xatolik:', error);
    } finally {
      setUploading(false);
    }
  }, []);

  /**
   * Rentgenni indeks bo'yicha o'chirish
   */
  const removeXray = useCallback((idx) => {
    setForm(prev => ({


      ...prev,
      xray_urls: prev.xray_urls.filter((_, i) => i !== idx)
    }));
  }, []);

  // Bog'langan davolash rejasini topish
  const linkedPlan = plans?.find(p => p.tooth_number === String(toothNumber));

  /**
   * Panel mazmunini render qilish
   */
  const renderContent = () => (
    <div className="space-y-4">
      {/* Tish sarlavhasi */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          {toothNumber}
        </div>
        <div className="flex-1">
          <p className="font-semibold">{t('odontogram.tooth') || 'Tish'} #{toothNumber}</p>
          <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[form.status]}`}>
            {translateStatus(form.status)}
          </span>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Holat va Tashxis */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">{t('odontogram.labelStatus') || 'Holat'}</Label>
          <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
            <SelectTrigger className="h-9 text-xs mt-1">
              <SelectValue placeholder={t('odontogram.labelStatus') || 'Holat'} />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map(s => <SelectItem key={s} value={s}>{translateStatus(s)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">{t('odontogram.labelDiagnosis') || 'Tashxis'}</Label>
          <Select value={form.diagnosis} onValueChange={v => setForm({ ...form, diagnosis: v })}>
            <SelectTrigger className="h-9 text-xs mt-1">
              <SelectValue placeholder={t('odontogram.labelDiagnosis') || 'Tashxis'} />
            </SelectTrigger>
            <SelectContent>
              {DIAGNOSES.map(d => <SelectItem key={d} value={d}>{translateDiagnosis(d)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Bog'langan reja */}
      {linkedPlan && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
          <p className="text-xs font-medium text-primary">
            🦷 {t('odontogram.linkedPlanPrefix') || 'Davolash rejasi:'} {linkedPlan.name}
          </p>
        </div>
      )}

      {/* Davolashlar */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-xs">{t('odontogram.labelTreatments') || 'Davolashlar'}</Label>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs px-2"
            disabled={isRemovedTooth}
            onClick={() => setAddingTreatment(true)}
          >
            <Plus className="w-3 h-3 mr-1" /> {t('common.add') || 'Qo\'shish'}
          </Button>
        </div>

        {isRemovedTooth && (
          <p className="text-xs text-rose-500 font-medium mb-2">
            {t('odontogram.errors.removedTooth') || 'Bu tish olib tashlangan. Unga yangi xizmat yozib bo\'lmaydi.'}
          </p>
        )}

        {form.treatments.length === 0 && !addingTreatment && (
          <p className="text-xs text-muted-foreground italic">{t('odontogram.errors.noTreatments') || 'Hali davolash yozilmagan'}</p>
        )}

        <div className="space-y-2">
          {form.treatments.map((treatmentItem, i) => (
            <div
              key={i}
              className="bg-muted/50 rounded-xl p-2.5 text-xs border border-border flex justify-between items-start gap-2"
            >
              <div className="flex-1">
                <span className="font-semibold text-primary">{translateTreatmentType(treatmentItem.type)}</span>
                <span className="text-muted-foreground ml-2">{treatmentItem.date}</span>
                {treatmentItem.doctor && <span className="text-muted-foreground"> · {treatmentItem.doctor}</span>}
                {treatmentItem.notes && <p className="mt-0.5 italic text-muted-foreground">{treatmentItem.notes}</p>}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 flex-shrink-0"
                onClick={() => removeTreatment(i)}
              >
                <Trash2 className="w-3 h-3 text-destructive" />
              </Button>
            </div>
          ))}
        </div>

        {/* Davolash qo'shish formasi */}
        {addingTreatment && (
          <div className="border border-primary/30 rounded-xl p-3 mt-2 space-y-2 bg-primary/5">
            <Select
              value={newTreatment.type}
              onValueChange={v => setNewTreatment({ ...newTreatment, type: v })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder={t('odontogram.placeholders.treatmentType') || 'Davolash turi'} />
              </SelectTrigger>
              <SelectContent>
                {TREATMENT_TYPES.map(treatType => (
                  <SelectItem key={treatType} value={treatType}>
                    {translateTreatmentType(treatType)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="date"
                className="h-7 text-xs"
                value={newTreatment.date}
                onChange={e => setNewTreatment({ ...newTreatment, date: e.target.value })}
              />
              <Input
                className="h-7 text-xs"
                placeholder={t('odontogram.placeholders.doctor') || 'Shifokor'}
                value={newTreatment.doctor}
                onChange={e => setNewTreatment({ ...newTreatment, doctor: e.target.value })}
              />
            </div>
            <Input
              className="h-7 text-xs"
              placeholder={t('odontogram.placeholders.notes') || 'Izoh'}
              value={newTreatment.notes}
              onChange={e => setNewTreatment({ ...newTreatment, notes: e.target.value })}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                className="h-7 text-xs flex-1 bg-primary hover:bg-primary/90"
                onClick={addTreatment}
              >
                {t('common.save') || 'Saqlash'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => setAddingTreatment(false)}
              >
                {t('common.cancel') || 'Bekor'}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Shifokor va Izoh */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">{t('odontogram.labelDoctor') || 'Shifokor'}</Label>
          <Input
            className="h-8 text-xs mt-1"
            value={form.doctor}
            onChange={e => setForm({ ...form, doctor: e.target.value })}
            placeholder={t('odontogram.placeholders.doctorName') || 'Ism'}
          />
        </div>
        <div>
          <Label className="text-xs">{t('odontogram.labelNotes') || 'Izoh'}</Label>
          <Input
            className="h-8 text-xs mt-1"
            value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })}
            placeholder={t('odontogram.placeholders.additionalNotes') || 'Qo\'shimcha...'}
          />
        </div>
      </div>

      {/* Rentgen */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <Label className="text-xs">{t('odontogram.labelXray') || 'Rentgen'}</Label>
          <label className="cursor-pointer">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleXrayUpload}
              disabled={uploading}
            />
            <span className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
              {uploading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Upload className="w-3 h-3" />
              )}
              {uploading ? (t('odontogram.states.uploading') || 'Yuklanmoqda...') : (t('odontogram.actions.upload') || 'Yuklash')}
            </span>
          </label>
        </div>

        {form.xray_urls?.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {form.xray_urls.map((url, i) => (
              <div
                key={i}
                className="relative group rounded-lg overflow-hidden border border-border w-14 h-14"
              >
                <img
                  src={url}
                  alt={`X-ray ${i + 1}`}
                  className="w-full h-full object-cover cursor-pointer"
                  onClick={() => setZoomImg(url)}
                />
                <div
                  className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                  onClick={() => setZoomImg(url)}
                >
                  <ZoomIn className="w-3 h-3 text-white" />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-0.5 right-0.5 h-4 w-4 bg-red-500/80 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeXray(i);
                  }}
                >
                  <X className="w-2 h-2" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Saqlash tugmasi */}
      <Button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-primary hover:bg-primary/90"
      >
        {saving ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            {t('odontogram.states.saving') || 'Saqlanmoqda...'}
          </>
        ) : (
          t('odontogram.actions.saveRecord') || '💾 Saqlash'
        )}
      </Button>
    </div>
  );

  // Ichki versiya (mobil qurilmalarda xarita ichida)
  if (inline) {
    return (
      <div className="bg-card border border-border rounded-2xl shadow-sm p-4">
        {renderContent()}
        <Dialog open={!!zoomImg} onOpenChange={() => setZoomImg(null)}>
          <DialogContent className="max-w-lg p-2">
            <DialogHeader>
              <DialogTitle>{t('odontogram.titles.xray') || 'Rentgen rasmi'}</DialogTitle>
            </DialogHeader>
            <img src={zoomImg} alt={t('odontogram.alts.xrayZoom') || 'Rentgen kattalashtirish'} className="w-full rounded-lg" />
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Yon panel versiyasi
  return (
    <>
      <div className="w-80 bg-card border border-border rounded-2xl shadow-lg flex flex-col max-h-[75vh] overflow-y-auto p-4">
        {renderContent()}
      </div>
      <Dialog open={!!zoomImg} onOpenChange={() => setZoomImg(null)}>
        <DialogContent className="max-w-lg p-2">
          <DialogHeader>
            <DialogTitle>{t('odontogram.titles.xray') || 'Rentgen rasmi'}</DialogTitle>
          </DialogHeader>
          <img src={zoomImg} alt={t('odontogram.alts.xrayZoom') || 'Rentgen kattalashtirish'} className="w-full rounded-lg" />
        </DialogContent>
      </Dialog>
    </>
  );
}
