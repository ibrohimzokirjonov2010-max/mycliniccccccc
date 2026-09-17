import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, CheckCircle2, FileText, Image as ImageIcon,
  Loader2, Plus, Save, Trash2, Upload, X, ZoomIn
} from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { compressImage, validateImage } from '@/utils/imageUpload';
import {
  buildNotesWithClinical,
  createClinicalEntry,
  parseClinicalChart,
  parseConsent,
} from '@/utils/clinicalChart';
import { cn } from '@/lib/utils';

const TEAL = '#14b8a6';

/**
 * Chairside clinical tools: structured diagnosis, RVG/x-ray gallery+lightbox, informed consent.
 * Persists clinical/consent into patient.notes via [CLINICAL_CHART_V1] / [CONSENT_V1] markers.
 * X-rays use existing Xray entity (+ optional tooth filter from odontogram selection).
 */
export default function ChairsideClinicalTools({
  patient,
  selectedTooth = null,
  onPatientUpdated,
  language = 'uz',
  compact = false,
  /** When true (default), sticky Tashxis/RVG/Rozilik tabs keep clinical tools above-fold during visit. */
  tabbed = true,
  activeTab: controlledTab = null,
  onTabChange,
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
  const [form, setForm] = useState({
    diagnosis: '',
    code: '',
    procedure: '',
    materials: '',
    complications: '',
  });
  const [savingClinical, setSavingClinical] = useState(false);
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

  const handleSaveEntry = async () => {
    if (!form.diagnosis.trim() && !form.procedure.trim()) {
      toast.error(language === 'ru' ? 'Диагноз или процедура обязательны' : 'Tashxis yoki muolaja majburiy');
      return;
    }
    setSavingClinical(true);
    try {
      const entry = createClinicalEntry({
        ...form,
        tooth: selectedTooth ? String(selectedTooth) : null,
      });
      const next = { entries: [entry, ...(clinical.entries || [])] };
      await persistNotes(next, consent);
      setClinical(next);
      setForm({ diagnosis: '', code: '', procedure: '', materials: '', complications: '' });
      toast.success(language === 'ru' ? 'Клиническая запись сохранена' : 'Klinik yozuv saqlandi');
    } catch (err) {
      console.error(err);
      toast.error(language === 'ru' ? 'Не удалось сохранить' : 'Saqlashda xatolik');
    } finally {
      setSavingClinical(false);
    }
  };

  const handleDeleteEntry = async (id) => {
    setSavingClinical(true);
    try {
      const next = { entries: (clinical.entries || []).filter((e) => e.id !== id) };
      await persistNotes(next, consent);
      setClinical(next);
      toast.success(language === 'ru' ? 'Удалено' : "O'chirildi");
    } catch (err) {
      console.error(err);
      toast.error(language === 'ru' ? 'Ошибка удаления' : "O'chirishda xatolik");
    } finally {
      setSavingClinical(false);
    }
  };

  const handleSaveConsent = async () => {
    setSavingConsent(true);
    try {
      const nextConsent = {
        ...consent,
        updated_at: new Date().toISOString(),
        date: consent.given ? (consent.date || new Date().toISOString().slice(0, 10)) : consent.date,
      };
      await persistNotes(clinical, nextConsent);
      setConsent(nextConsent);
      toast.success(language === 'ru' ? 'Согласие сохранено' : 'Rozilik saqlandi');
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
        description: selectedTooth ? `Tish #${selectedTooth}` : 'RVG / Rentgen',
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
    clinical: language === 'ru' ? 'Клиническая запись' : language === 'en' ? 'Clinical note' : 'Klinik yozuv / tashxis',
    diagnosis: language === 'ru' ? 'Диагноз' : 'Tashxis',
    code: language === 'ru' ? 'Код (опц.)' : 'Kod (ixtiyoriy)',
    procedure: language === 'ru' ? 'Процедура' : 'Muolaja',
    materials: language === 'ru' ? 'Материалы' : 'Materiallar',
    complications: language === 'ru' ? 'Осложнения' : 'Asoratlar',
    save: language === 'ru' ? 'Сохранить' : 'Saqlash',
    xray: language === 'ru' ? 'Рентген / RVG' : 'Rentgen / RVG',
    consent: language === 'ru' ? 'Информированное согласие' : 'Informed consent / Rozilik',
    consentNote: language === 'ru' ? 'Примечание' : 'Izoh',
    given: language === 'ru' ? 'Пациент дал согласие' : 'Bemor rozilik berdi',
  };

  const tabs = [
    { id: 'tashxis', label: language === 'ru' ? 'Диагноз' : 'Tashxis', icon: Activity },
    { id: 'rvg', label: 'RVG', icon: ImageIcon },
    { id: 'rozilik', label: language === 'ru' ? 'Согласие' : 'Rozilik', icon: FileText },
  ];

  const showAll = !tabbed;
  const showTashxis = showAll || activeTab === 'tashxis';
  const showRvg = showAll || activeTab === 'rvg';
  const showRozilik = showAll || activeTab === 'rozilik';

  return (
    <div id="chairside-clinical-tools" className="space-y-2.5 scroll-mt-24">
      {tabbed && (
        <div className="sticky top-[64px] z-[35] bg-white/95 backdrop-blur-sm border border-slate-200/80 rounded-2xl shadow-[0_1px_3px_rgba(15,23,42,0.06)] p-1.5 flex flex-wrap gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  document.getElementById('chairside-clinical-tools')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className={cn(
                  'flex-1 min-w-[96px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wide transition-all cursor-pointer',
                  isActive
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-transparent'
                )}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

    <div className={cn('grid gap-3.5', compact || tabbed ? 'grid-cols-1' : 'grid-cols-1 xl:grid-cols-3')}>
      {/* A) Structured clinical note */}
      <section
        id="chairside-clinical-tashxis"
        className={cn(
          'bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.06)] p-4 space-y-3 scroll-mt-36',
          !showTashxis && 'hidden'
        )}
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center">
            <Activity className="w-4 h-4" style={{ color: TEAL }} />
          </div>
          <div>
            <h3 className="text-[11px] font-black uppercase tracking-[0.08em] text-slate-900">{label.clinical}</h3>
            {selectedTooth && (
              <p className="text-[10px] font-bold text-teal-700">Tish #{selectedTooth}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <label className="space-y-1 sm:col-span-2">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">{label.diagnosis}</span>
            <textarea
              rows={2}
              value={form.diagnosis}
              onChange={(e) => setForm((f) => ({ ...f, diagnosis: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 resize-none"
              placeholder="Masalan: chronik pulpitis #26"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">{label.code}</span>
            <input
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
              placeholder="K04.0"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">{label.procedure}</span>
            <input
              value={form.procedure}
              onChange={(e) => setForm((f) => ({ ...f, procedure: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
              placeholder="Endo / plomba / ekstraksiya"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">{label.materials}</span>
            <input
              value={form.materials}
              onChange={(e) => setForm((f) => ({ ...f, materials: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
              placeholder="AH Plus, gutta..."
            />
          </label>
          <label className="space-y-1">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">{label.complications}</span>
            <input
              value={form.complications}
              onChange={(e) => setForm((f) => ({ ...f, complications: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
              placeholder="Yo'q / qon ketishi..."
            />
          </label>
        </div>

        <button
          type="button"
          onClick={handleSaveEntry}
          disabled={savingClinical}
          className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-xs font-black uppercase tracking-wider transition-all hover:opacity-95 disabled:opacity-60"
          style={{ backgroundColor: TEAL }}
        >
          {savingClinical ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {label.save}
        </button>

        <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
          {(clinical.entries || []).slice(0, 8).map((entry) => (
            <div key={entry.id} className="rounded-xl border border-slate-100 bg-slate-50/80 p-2.5 relative group">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-black text-slate-900 truncate">
                    {entry.diagnosis || entry.procedure || '—'}
                    {entry.code ? <span className="ml-1 font-mono text-teal-700 font-bold">[{entry.code}]</span> : null}
                  </p>
                  <p className="text-[10px] text-slate-500 font-semibold mt-0.5 truncate">
                    {entry.procedure || '—'}
                    {entry.tooth ? ` · #${entry.tooth}` : ''}
                    {entry.materials ? ` · ${entry.materials}` : ''}
                  </p>
                  {entry.complications ? (
                    <p className="text-[10px] text-amber-700 font-bold mt-0.5">⚠ {entry.complications}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteEntry(entry.id)}
                  className="p-1 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                  title="O'chirish"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
          {(clinical.entries || []).length === 0 && (
            <p className="text-[11px] text-slate-400 font-semibold text-center py-3">Hali klinik yozuv yo'q</p>
          )}
        </div>
      </section>

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
            <input type="file" accept="image/*" className="hidden" onChange={handleUploadXray} disabled={uploading} />
          </label>
        </div>

        {xrayLoading ? (
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map((i) => <div key={i} className="aspect-square rounded-xl bg-slate-100 animate-pulse" />)}
          </div>
        ) : filteredXrays.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center">
            <ImageIcon className="w-8 h-8 text-slate-200 mx-auto mb-2" />
            <p className="text-[11px] font-semibold text-slate-400">Rentgen yo'q — yuklang</p>
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

        <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
          <input
            type="checkbox"
            checked={!!consent.given}
            onChange={(e) => setConsent((c) => ({
              ...c,
              given: e.target.checked,
              date: e.target.checked ? (c.date || new Date().toISOString().slice(0, 10)) : c.date,
            }))}
            className="mt-0.5 w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
          />
          <span className="text-xs font-bold text-slate-800 leading-snug">{label.given}</span>
        </label>

        <label className="space-y-1 block">
          <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Sana</span>
          <input
            type="date"
            value={consent.date || ''}
            onChange={(e) => setConsent((c) => ({ ...c, date: e.target.value || null }))}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
          />
        </label>

        <label className="space-y-1 block">
          <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">{label.consentNote}</span>
          <textarea
            rows={3}
            value={consent.note || ''}
            onChange={(e) => setConsent((c) => ({ ...c, note: e.target.value }))}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 resize-none"
            placeholder="Davolash, anesteziya, risklar tushuntirildi..."
          />
        </label>

        <button
          type="button"
          onClick={handleSaveConsent}
          disabled={savingConsent}
          className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-black uppercase tracking-wider hover:bg-slate-800 disabled:opacity-60"
        >
          {savingConsent ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : consent.given ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" /> : <Plus className="w-3.5 h-3.5" />}
          {label.save}
        </button>

        {consent.given && (
          <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            Rozilik belgilangan{consent.date ? ` · ${consent.date}` : ''}
          </div>
        )}
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
    </div>
  );
}
