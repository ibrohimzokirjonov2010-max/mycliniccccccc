import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, FileText, Image as ImageIcon,
  Loader2, Trash2, Upload, X, ZoomIn
} from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { compressImage, validateImage } from '@/utils/imageUpload';
import {
  buildNotesWithClinical,
  consentTemplateText,
  consentTemplateTitle,
  parseClinicalChart,
  parseConsent,
  toDisplayDate,
  toIsoDate,
} from '@/utils/clinicalChart';
import { cn } from '@/lib/utils';
import { resolveDoctorLabel } from '@/lib/displayText';
import ConsentForm from './ConsentForm';

const TEAL = '#14b8a6';

export function ChairsideClinicalTabBar({ activeTab, onChange, language = 'uz', className }) {
  const tabs = [
    { id: 'tashxis', label: language === 'ru' ? 'Диагноз' : 'Tashxis', icon: Activity },
    { id: 'rvg', label: 'RVG', icon: ImageIcon },
    { id: 'rozilik', label: language === 'ru' ? 'Согласие' : 'Rozilik', icon: FileText },
  ];
  return (
    <div className={cn('chairside-tool-tabs flex w-full min-w-0 max-w-full flex-wrap gap-1', className)} data-clinical-tabs="true">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange?.(tab.id)}
            className={cn(
              'inline-flex min-h-9 min-w-0 flex-1 basis-[7.5rem] items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-black uppercase tracking-wide transition-all cursor-pointer',
              isActive
                ? 'bg-teal-600 text-white shadow-sm'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100',
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Chairside clinical tools: RVG/x-ray gallery+lightbox and informed consent.
 * Stored clinical-chart entries stay in patient.notes and are passed through on consent save.
 * Persists clinical/consent into patient.notes via [CLINICAL_CHART_V1] / [CONSENT_V1] markers.
 * X-rays use existing Xray entity (+ optional tooth filter from odontogram selection).
 */
export default function ChairsideClinicalTools({
  patient,
  selectedTooth = null,
  onPatientUpdated,
  language = 'uz',
  compact = false,
  /** When true, Tashxis/RVG/Rozilik switch the panels below. The bar itself stays in the patient header. */
  tabbed = true,
  hideTabBar = false,
  activeTab: controlledTab = null,
  onTabChange,
  doctorName = '',
  doctors = [],
}) {
  const patientId = patient?.id;
  const [internalTab, setInternalTab] = useState('tashxis');
  const activeTab = controlledTab || internalTab;
  const setActiveTab = (tab) => {
    if (onTabChange) onTabChange(tab);
    else setInternalTab(tab);
  };
  const [clinical, setClinical] = useState(() => parseClinicalChart(patient?.notes));
  const [consent, setConsent] = useState(() => parseConsent(patient?.notes));
  const [savingConsent, setSavingConsent] = useState(false);

  const [xrays, setXrays] = useState([]);
  const [xrayLoading, setXrayLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    setClinical(parseClinicalChart(patient?.notes));
    setConsent(parseConsent(patient?.notes));
  }, [patient?.id, patient?.notes]);

  const loadXrays = useCallback(async () => {
    if (!patientId) return;
    try {
      setXrayLoading(true);
      const data = await base44.entities.Xray.filter({ patient_id: patientId }, '-created_date', 80);
      setXrays(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[ChairsideClinicalTools] xray load', err);
    } finally {
      setXrayLoading(false);
    }
  }, [patientId]);

  useEffect(() => { loadXrays(); }, [loadXrays]);

  const filteredXrays = useMemo(() => {
    if (!selectedTooth) return xrays;
    const tooth = String(selectedTooth);
    return xrays.filter((x) => {
      const t = x.tooth_number != null ? String(x.tooth_number) : '';
      return !t || t === tooth || t === 'all';
    });
  }, [xrays, selectedTooth]);

  const persistNotes = useCallback(async (nextClinical, nextConsent) => {
    if (!patientId) return null;
    const notes = buildNotesWithClinical(patient?.notes, nextClinical, nextConsent);
    const updated = await base44.entities.Patient.update(patientId, { notes });
    onPatientUpdated?.(updated || { ...patient, notes });
    return notes;
  }, [patientId, patient, onPatientUpdated]);

  const handleSaveConsent = async () => {
    const dateDisplay = consent.date_display || toDisplayDate(consent.date);
    const iso = toIsoDate(dateDisplay);
    if (!iso) {
      toast.error(language === 'ru' ? 'Дата в формате дд.мм.гггг' : 'Sana kk.oo.yyyy ko\'rinishida bo\'lsin');
      return;
    }
    if (!consent.patient_signature || !consent.doctor_signature) {
      toast.error(language === 'ru' ? 'Нужны подписи пациента и врача' : 'Bemor va shifokor imzosi kerak');
      return;
    }
    const templateId = consent.template_id || 'general';
    setSavingConsent(true);
    try {
      const nextConsent = {
        ...consent,
        given: true,
        date: iso,
        date_display: dateDisplay,
        template_id: templateId,
        template_title: consent.template_title || consentTemplateTitle(templateId, language),
        text: consent.text || consentTemplateText(templateId, language),
        updated_at: new Date().toISOString(),
      };
      await persistNotes(clinical, nextConsent);
      setConsent(nextConsent);
      toast.success(language === 'ru' ? 'Согласие сохранено' : 'Rozilik bemor kartasiga saqlandi');
    } catch (err) {
      console.error(err);
      toast.error(language === 'ru' ? 'Не удалось сохранить согласие' : 'Rozilikni saqlashda xatolik');
    } finally {
      setSavingConsent(false);
    }
  };

  const handleUploadXray = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !patientId) return;
    const check = validateImage(file, { maxSizeMB: 8 });
    if (!check.valid) {
      toast.error(check.error);
      return;
    }
    setUploading(true);
    try {
      const image_url = await compressImage(file, { maxWidth: 1600, maxHeight: 1600, quality: 0.75 });
      await base44.entities.Xray.create({
        patient_id: patientId,
        image_url,
        description: selectedTooth ? `Rentgen #${selectedTooth}` : 'Rentgen',
        xray_type: 'xray',
        tooth_number: selectedTooth ? String(selectedTooth) : null,
        date: new Date().toISOString().slice(0, 10),
      });
      await loadXrays();
      toast.success(language === 'ru' ? 'Рентген загружен' : 'Rentgen yuklandi');
    } catch (err) {
      console.error(err);
      toast.error(language === 'ru' ? 'Загрузка не удалась' : 'Yuklashda xatolik');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteXray = async (id) => {
    try {
      await base44.entities.Xray.delete(id);
      setXrays((prev) => prev.filter((x) => x.id !== id));
      if (lightbox?.id === id) setLightbox(null);
    } catch (err) {
      console.error(err);
      toast.error(language === 'ru' ? 'Удаление не удалось' : "O'chirishda xatolik");
    }
  };

  const label = {
    xray: language === 'ru' ? 'Рентген / RVG' : 'Rentgen / RVG',
    consent: language === 'ru' ? 'Информированное согласие' : 'Informed consent / Rozilik',
  };

  const showAll = !tabbed;
  const showRvg = showAll || activeTab === 'rvg';
  const showRozilik = showAll || activeTab === 'rozilik';
  const tashxisOnly = tabbed && activeTab === 'tashxis';

  if (tashxisOnly && hideTabBar) {
    return <div id="chairside-clinical-tools" className="hidden" />;
  }

  return (
    <div id="chairside-clinical-tools" className={cn('scroll-mt-24', !tashxisOnly && 'space-y-2.5')}>
      {tabbed && !hideTabBar && (
        <ChairsideClinicalTabBar
          activeTab={activeTab}
          onChange={setActiveTab}
          language={language}
          className="relative top-auto z-0 rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-[0_1px_3px_rgba(15,23,42,0.06)]"
        />
      )}

    {!tashxisOnly && (
    <div className={cn('grid gap-3.5', compact || tabbed ? 'grid-cols-1' : 'grid-cols-1 xl:grid-cols-2')}>
      {/* B) X-ray / RVG gallery */}
      <section
        id="chairside-clinical-rvg"
        className={cn(
          'bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.06)] p-4 space-y-3 scroll-mt-36',
          !showRvg && 'hidden'
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center shrink-0">
              <ImageIcon className="w-4 h-4" style={{ color: TEAL }} />
            </div>
            <div className="min-w-0">
              <h3 className="text-[11px] font-black uppercase tracking-[0.08em] text-slate-900 truncate">{label.xray}</h3>
              <p className="text-[10px] font-semibold text-slate-500">
                {selectedTooth ? `Filter: #${selectedTooth}` : 'Bemor / tanlangan tish'}
              </p>
            </div>
          </div>
          <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider text-white cursor-pointer hover:opacity-95"
            style={{ backgroundColor: TEAL }}>
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            Yuklash
            <input data-testid="rvg-file-input" type="file" accept="image/*" className="hidden" onChange={handleUploadXray} disabled={uploading} />
          </label>
        </div>

        {xrayLoading ? (
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map((i) => <div key={i} className="aspect-square rounded-xl bg-slate-100 animate-pulse" />)}
          </div>
        ) : filteredXrays.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center px-4" data-testid="xray-empty">
            <ImageIcon className="w-8 h-8 text-slate-200 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-600">Hali rentgen yoki RVG yo‘q</p>
            <p className="mt-1 text-[11px] font-medium text-slate-400">Rasm qo‘shish uchun yuqoridagi Yuklash tugmasidan foydalaning.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 max-h-56 overflow-y-auto">
            {filteredXrays.map((x) => (
              <div key={x.id} className="relative group aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-900">
                <img src={x.image_url} alt="" className="w-full h-full object-cover cursor-pointer" onClick={() => setLightbox(x)} />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                  <button type="button" onClick={() => setLightbox(x)} className="p-1.5 rounded-lg bg-white/90 text-slate-800 cursor-pointer">
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={() => handleDeleteXray(x.id)} className="p-1.5 rounded-lg bg-rose-500/90 text-white cursor-pointer">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                {x.tooth_number && (
                  <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-[9px] font-black">#{x.tooth_number}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* C) Consent */}
      <section
        id="chairside-clinical-rozilik"
        className={cn(
          'bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.06)] p-4 space-y-3 scroll-mt-36',
          !showRozilik && 'hidden'
        )}
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center">
            <FileText className="w-4 h-4" style={{ color: TEAL }} />
          </div>
          <h3 className="text-[11px] font-black uppercase tracking-[0.08em] text-slate-900">{label.consent}</h3>
        </div>

        <ConsentForm
          patient={patient}
          consent={consent}
          onChange={setConsent}
          onSave={handleSaveConsent}
          saving={savingConsent}
          language={language}
          doctorName={doctorName || resolveDoctorLabel(patient?.doctor_name || patient?.main_treatment_provider, doctors)}
        />
      </section>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[80] bg-black/85 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 cursor-pointer"
            onClick={() => setLightbox(null)}
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={lightbox.image_url}
            alt={lightbox.description || 'RVG'}
            className="max-w-full max-h-[90vh] rounded-xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          {(lightbox.description || lightbox.tooth_number) && (
            <p className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-black/60 text-white text-xs font-bold">
              {lightbox.tooth_number ? `#${lightbox.tooth_number} · ` : ''}{lightbox.description || 'Rentgen'}
            </p>
          )}
        </div>
      )}
    </div>
    )}
    </div>
  );
}
