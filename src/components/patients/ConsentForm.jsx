import { useMemo, useRef, useState } from 'react';
import { CheckCircle2, FileText, Loader2, Printer } from 'lucide-react';
import { toast } from 'sonner';
import {
  CONSENT_TEMPLATES,
  consentTemplateText,
  consentTemplateTitle,
  maskDisplayDate,
  toIsoDate,
} from '@/utils/clinicalChart';
import { formatDoctorName } from '@/lib/displayText';
import SignaturePad from './SignaturePad';

function todayDisplay() {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${now.getFullYear()}`;
}

export default function ConsentForm({
  patient,
  consent,
  onChange,
  onSave,
  saving = false,
  language = 'uz',
  doctorName = '',
}) {
  const printRef = useRef(null);
  const [printing, setPrinting] = useState(false);
  const templateId = consent?.template_id || 'general';
  const dateDisplay = consent?.date_display || '';
  const body = consent?.text || consentTemplateText(templateId, language);
  const title = consent?.template_title || consentTemplateTitle(templateId, language);
  const patientName = patient?.full_name || '';
  const doctor = formatDoctorName(doctorName || patient?.doctor_name || '');
  const iso = useMemo(() => toIsoDate(dateDisplay), [dateDisplay]);

  const setTemplate = (id) => {
    onChange?.({
      ...consent,
      template_id: id,
      template_title: consentTemplateTitle(id, language),
      text: consentTemplateText(id, language),
    });
  };

  const printPdf = async () => {
    const node = printRef.current;
    if (!node) return;
    setPrinting(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);
      const canvas = await html2canvas(node, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
      const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const image = canvas.toDataURL('image/png');
      const imageHeight = (canvas.height * pageWidth) / canvas.width;
      let remaining = imageHeight;
      let offset = 0;
      pdf.addImage(image, 'PNG', 0, offset, pageWidth, imageHeight);
      remaining -= pageHeight;
      while (remaining > 0) {
        offset -= pageHeight;
        pdf.addPage();
        pdf.addImage(image, 'PNG', 0, offset, pageWidth, imageHeight);
        remaining -= pageHeight;
      }
      const safeName = (patientName || 'bemor').replace(/[^\w\u0400-\u04FF -]+/g, '').trim() || 'bemor';
      pdf.save(`rozilik-${safeName}.pdf`);
    } catch (err) {
      console.error(err);
      toast.error(language === 'ru' ? 'PDF не создан' : 'PDF yaratilmadi');
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="space-y-3" data-testid="consent-form">
      <div className="flex flex-wrap gap-1.5">
        {CONSENT_TEMPLATES.map((row) => {
          const active = row.id === templateId;
          return (
            <button
              key={row.id}
              type="button"
              onClick={() => setTemplate(row.id)}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                active ? 'border-teal-600 bg-teal-600 text-white' : 'border-slate-200 bg-white text-slate-600'
              }`}
            >
              {row.title[language] || row.title.uz}
            </button>
          );
        })}
      </div>

      <div ref={printRef} className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex items-start gap-2">
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">Ongli rozilik</p>
            <h4 className="text-sm font-black text-slate-900">{title}</h4>
          </div>
        </div>
        <p className="text-xs font-medium leading-relaxed text-slate-700">{body}</p>
        <div className="grid gap-1 text-[11px] text-slate-600 sm:grid-cols-2">
          <p><span className="font-black text-slate-800">Bemor:</span> {patientName || '—'}</p>
          <p><span className="font-black text-slate-800">Shifokor:</span> {doctor || '—'}</p>
          <p><span className="font-black text-slate-800">Sana:</span> {dateDisplay || '—'}</p>
          <p><span className="font-black text-slate-800">Tug'ilgan:</span> {patient?.birth_date || '—'}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-[10px] font-black uppercase tracking-wide text-slate-500">Bemor imzosi</p>
            {consent?.patient_signature ? (
              <img src={consent.patient_signature} alt="Bemor imzosi" className="h-20 w-full rounded-lg border border-slate-200 bg-white object-contain" />
            ) : (
              <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-slate-200 text-[11px] text-slate-400">Imzo kiritilmagan</div>
            )}
          </div>
          <div>
            <p className="mb-1 text-[10px] font-black uppercase tracking-wide text-slate-500">Shifokor imzosi</p>
            {consent?.doctor_signature ? (
              <img src={consent.doctor_signature} alt="Shifokor imzosi" className="h-20 w-full rounded-lg border border-slate-200 bg-white object-contain" />
            ) : (
              <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-slate-200 text-[11px] text-slate-400">Imzo kiritilmagan</div>
            )}
          </div>
        </div>
      </div>

      <label className="block space-y-1">
        <span className="text-[10px] font-black uppercase tracking-wide text-slate-500">Sana (kk.oo.yyyy)</span>
        <input
          inputMode="numeric"
          placeholder="kk.oo.yyyy"
          value={dateDisplay}
          onChange={(event) => {
            const date_display = maskDisplayDate(event.target.value);
            onChange?.({
              ...consent,
              date_display,
              date: toIsoDate(date_display),
            });
          }}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold focus:border-teal-500 focus:outline-none"
        />
        {dateDisplay && !iso && (
          <span className="text-[10px] font-bold text-rose-600">Sana kk.oo.yyyy ko'rinishida bo'lsin</span>
        )}
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <SignaturePad
          label="Bemor imzosi"
          value={consent?.patient_signature || ''}
          onChange={(patient_signature) => onChange?.({ ...consent, patient_signature })}
        />
        <SignaturePad
          label="Shifokor imzosi"
          value={consent?.doctor_signature || ''}
          onChange={(doctor_signature) => onChange?.({ ...consent, doctor_signature })}
        />
      </div>

      <label className="block space-y-1">
        <span className="text-[10px] font-black uppercase tracking-wide text-slate-500">Qo'shimcha izoh</span>
        <textarea
          rows={2}
          value={consent?.note || ''}
          onChange={(event) => onChange?.({ ...consent, note: event.target.value })}
          className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
          placeholder="Qo'shimcha shart yoki izoh"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2.5 text-xs font-black text-white disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          Bemor kartasiga saqlash
        </button>
        <button
          type="button"
          onClick={printPdf}
          disabled={printing}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-black text-slate-800 disabled:opacity-60"
        >
          {printing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
          PDF
        </button>
      </div>

      {consent?.given && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-[11px] font-bold text-emerald-800">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          Saqlangan rozilik{dateDisplay ? ` · ${dateDisplay}` : ''}{title ? ` · ${title}` : ''}
        </div>
      )}

      {!dateDisplay && (
        <button
          type="button"
          className="text-[11px] font-bold text-teal-700"
          onClick={() => onChange?.({ ...consent, date_display: todayDisplay(), date: toIsoDate(todayDisplay()) })}
        >
          Bugungi sanani qo'yish
        </button>
      )}
    </div>
  );
}
