import { Camera, FileText, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ImplantIcon } from '@/components/ui/Icons';
import {
  normalizeLifecycleStatus,
  SHORT_STATUS_LABEL,
  LIFECYCLE_COLORS,
} from './ClinicalStepper';

const EM = '\u2014'; // —
const DIA = '\u00D8'; // Ø
const MUL = '\u00D7'; // ×

const safeRender = (val, fallback = EM) => {
  if (val == null || val === '') return fallback;
  if (typeof val === 'string' || typeof val === 'number') return val;
  if (typeof val === 'object') return val.label || val.name || val.title || EM;
  return String(val);
};

/** Format implant size with proper UTF-8 diameter/multiply symbols */
export function formatImplantSize(diameter, length, { withUnits = false, compact = false } = {}) {
  const d = diameter != null && diameter !== '' ? String(diameter) : null;
  const l = length != null && length !== '' ? String(length) : null;
  if (!d && !l) return null;
  if (withUnits) {
    return `${DIA} ${d || EM} mm ${MUL} L ${l || EM} mm`;
  }
  if (compact) {
    return `${DIA}${d || EM}${MUL}${l || EM}`;
  }
  return `${DIA}${d || EM}${MUL}${l || EM}`;
}

export function toothIdToFdi(id) {
  if (!id) return id;
  const s = String(id);
  const match = s.match(/^(ur|ul|lr|ll)(\d+)$/);
  if (!match) return s;
  const [, quad, num] = match;
  const quadMap = { ur: '1', ul: '2', ll: '3', lr: '4' };
  return quadMap[quad] + num;
}

export function getToothFdiList(implant) {
  const raw = implant?.tooth_numbers || (implant?.tooth_number ? [implant.tooth_number] : []);
  return [...new Set(raw.map(String))].map(toothIdToFdi);
}

const UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const LOWER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

/** Compact FDI arch highlighting active implant teeth */
export function MiniFdiChart({ activeFdis = [], className }) {
  const set = new Set(activeFdis.map(String));
  const primary = activeFdis.length ? String(activeFdis[0]) : null;
  const Tooth = ({ n }) => {
    const on = set.has(String(n));
    return (
      <div
        title={`#${n}`}
        className={cn(
          'w-4 h-5 sm:w-[18px] sm:h-6 rounded-sm text-[8px] font-black flex items-center justify-center border transition-colors',
          on
            ? 'bg-teal-600 text-white border-teal-700 shadow-sm'
            : 'bg-slate-100 text-slate-400 border-slate-200'
        )}
      >
        {String(n).slice(-1)}
      </div>
    );
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex justify-center gap-0.5 flex-wrap">{UPPER.map((n) => <Tooth key={n} n={n} />)}</div>
      <div className="h-px bg-slate-200 mx-4" />
      <div className="flex justify-center gap-0.5 flex-wrap">{LOWER.map((n) => <Tooth key={n} n={n} />)}</div>
      <div className="flex items-center justify-center gap-3 pt-1 text-[10px] font-bold text-slate-500">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-teal-600" />
          Implant joylashgan{primary ? ` (#${primary})` : ''}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-slate-300" />
          Tabiiy tish / Yo&apos;q
        </span>
      </div>
    </div>
  );
}

/** Left-rail implant switcher cards (multi-implant mockup) */
export function ImplantSwitcher({
  implants = [],
  selectedId,
  onSelect,
  language = 'uz',
  toothIdToFdiFn = toothIdToFdi,
}) {
  const counts = { total: implants.length, healing: 0, crown: 0 };
  implants.forEach((imp) => {
    const s = normalizeLifecycleStatus(imp.lifecycle_status || imp.status);
    if (s === 'Healing jarayoni') counts.healing += 1;
    if (s === 'Crown tayyor' || s === 'Tugallangan') counts.crown += 1;
  });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-1.5">
        {[
          { label: language === 'ru' ? 'имплант' : 'implant', val: counts.total },
          { label: 'integratsiya', val: counts.healing },
          { label: 'protez', val: counts.crown },
        ].map((c) => (
          <div key={c.label} className="rounded-xl bg-slate-50 border border-slate-200 px-2 py-1.5 text-center">
            <div className="text-sm font-black text-slate-900 font-mono">{c.val}</div>
            <div className="text-[9px] font-bold uppercase text-slate-400 truncate">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="space-y-2 max-h-[520px] overflow-y-auto pr-0.5">
        {implants.map((imp) => {
          const fdi = getToothFdiList(imp)[0] || EM;
          const display = normalizeLifecycleStatus(imp.lifecycle_status || imp.status);
          const short = SHORT_STATUS_LABEL[display] || display;
          const selected = imp.id === selectedId;
          const brand = (imp.firma === 'Boshqa' ? imp.firma_custom : imp.firma) || imp.brend || EM;
          const size = formatImplantSize(imp.diameter, imp.length, { compact: true }) || '';

          return (
            <button
              key={imp.id}
              type="button"
              onClick={() => onSelect?.(imp.id)}
              className={cn(
                'w-full text-left rounded-2xl border p-3 transition-all cursor-pointer',
                selected
                  ? 'border-teal-500 bg-teal-50/40 ring-2 ring-teal-500/20 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={cn(
                    'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-mono font-black text-xs',
                    selected ? 'bg-teal-600 text-white' : 'bg-slate-900 text-white'
                  )}>
                    #{fdi}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-black text-slate-900 truncate">{brand}</div>
                    <div className="text-[10px] font-mono font-bold text-slate-500">{size || EM}</div>
                  </div>
                </div>
                <span className={cn(
                  'px-2 py-0.5 rounded-lg text-[9px] font-black uppercase border shrink-0',
                  LIFECYCLE_COLORS[display] || 'bg-slate-100 text-slate-600 border-slate-200'
                )}>
                  {short}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Large clinical passport specs card */
export function PassportSpecsCard({ implant, language = 'uz' }) {
  const diameter = implant?.diameter;
  const length = implant?.length;
  const sizeText =
    formatImplantSize(diameter, length, { withUnits: true })
    || (language === 'ru' ? 'Размер не указан' : "O'lcham kiritilmagan");

  const torqueVal = implant?.torque != null && implant?.torque !== ''
    ? `${implant.torque} Ncm`
    : EM;
  const isqVal = implant?.isq != null && implant?.isq !== ''
    ? String(implant.isq)
    : EM;

  const fields = [
    { label: 'LOT / Seria', value: implant?.lot_number || EM, mono: true, accent: !!implant?.lot_number },
    { label: 'Torque', value: torqueVal },
    { label: 'ISQ (Istabilnost)', value: isqVal },
    { label: language === 'ru' ? 'Кость' : 'Suyak turi', value: safeRender(implant?.bone_type) },
    { label: language === 'ru' ? 'Дата' : 'Joylash sanasi', value: safeRender(implant?.placement_date) },
    { label: language === 'ru' ? 'Хирург' : 'Jarroh', value: safeRender(implant?.doctor) },
  ];

  const protocol = implant?.loading_protocol || implant?.protocol || null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 h-full">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
          <ImplantIcon className="w-4 h-4" />
        </div>
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
          {language === 'ru' ? 'Клинический паспорт' : 'Klinik pasport'}
        </h3>
      </div>

      <div className="text-2xl sm:text-3xl font-black tracking-tight text-teal-700 mb-4 font-mono leading-none">
        {sizeText}
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        {fields.map((f) => (
          <div key={f.label}>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{f.label}</div>
            <div className={cn(
              'text-sm font-black mt-0.5 truncate',
              f.accent ? 'text-teal-700 font-mono' : 'text-slate-900',
              f.mono && 'font-mono'
            )}>
              {f.value}
            </div>
          </div>
        ))}
      </div>

      {protocol && (
        <div className="mt-4">
          <span className="inline-flex px-2.5 py-1 rounded-lg text-[10px] font-black uppercase bg-teal-50 text-teal-700 border border-teal-200">
            {String(protocol)}
          </span>
        </div>
      )}
    </div>
  );
}

const MEDIA_LABELS = [
  { key: 'preop', uz: 'Pre-op', ru: 'До операции' },
  { key: 'postop', uz: 'Post-op', ru: 'После операции' },
  { key: 'healing', uz: 'Healing', ru: 'Заживление' },
  { key: 'final', uz: 'Final', ru: 'Финал' },
];

/** Stage-tagged media rail — labels existing xray_urls / passport_url slots */
export function StageMediaRail({ implant, language = 'uz', onZoom, onOpenPassport }) {
  const xrays = Array.isArray(implant?.xray_urls) ? implant.xray_urls : [];
  const slots = MEDIA_LABELS.map((lab, idx) => {
    let url = xrays[idx] || null;
    if (idx === 3 && implant?.passport_url) url = implant.passport_url;
    return { ...lab, url };
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
          <Camera className="w-4 h-4" />
        </div>
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
          {language === 'ru' ? 'Этапные снимки' : 'Bosqich rasm va yozuvlar'}
        </h3>
      </div>

      <div className="grid grid-cols-2 gap-2 flex-1">
        {slots.map((slot) => (
          <button
            key={slot.key}
            type="button"
            disabled={!slot.url}
            onClick={() => slot.url && onZoom?.(slot.url)}
            className={cn(
              'relative aspect-[4/3] rounded-xl border overflow-hidden text-left',
              slot.url
                ? 'border-slate-200 cursor-pointer group'
                : 'border-dashed border-slate-200 bg-slate-50 cursor-default'
            )}
          >
            {slot.url ? (
              <img src={slot.url} alt={slot.uz} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 gap-1">
                <Camera className="w-5 h-5" />
                <span className="text-[9px] font-bold">Bo&apos;sh</span>
              </div>
            )}
            <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase bg-black/60 text-white">
              {language === 'ru' ? slot.ru : slot.uz}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
          <FileText className="w-3.5 h-3.5" />
          <span>{language === 'ru' ? 'Паспорт стикер (PDF)' : 'Pasport stikeri (PDF)'}</span>
        </div>
        <button
          type="button"
          onClick={onOpenPassport}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black bg-slate-900 text-white hover:bg-slate-800 cursor-pointer"
        >
          <Download className="w-3 h-3" />
          {language === 'ru' ? 'Скачать' : "Ko'rish / Yuklab olish"}
        </button>
      </div>
    </div>
  );
}

/** Vertical clinical stages timeline */
export function ClinicalTimeline({ implant, language = 'uz' }) {
  const timeline = Array.isArray(implant?.timeline) ? [...implant.timeline] : [];
  const items = timeline.length > 0
    ? timeline
    : (implant?.placement_date
      ? [{
          date: implant.placement_date,
          status: "O'rnatildi",
          note: [
            implant.torque ? `Torque: ${implant.torque} Ncm` : null,
            implant.isq ? `ISQ: ${implant.isq}` : null,
            implant.doctor ? `Jarroh: ${implant.doctor}` : null,
          ].filter(Boolean).join(' | ') || (language === 'ru' ? 'Имплант установлен' : 'Implant joylandi'),
        }]
      : []);

  const display = normalizeLifecycleStatus(implant?.lifecycle_status || implant?.status);
  const done = display === 'Tugallangan';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
          {language === 'ru' ? 'История клинических этапов' : 'Klinik bosqichlar tarixi'}
        </h3>
        {done && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
            Yakunlandi
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-xs font-bold text-slate-400 py-6 text-center">
          {language === 'ru' ? 'История пока пуста' : "Hozircha tarix yo'q"}
        </p>
      ) : (
        <div className="relative pl-4 space-y-3 before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-0.5 before:bg-teal-200">
          {items.map((item, idx) => {
            const dateStr = item.date
              ? (String(item.date).includes('T')
                ? new Date(item.date).toLocaleDateString('ru-RU')
                : item.date)
              : EM;
            return (
              <div key={idx} className="relative flex gap-3">
                <div className="absolute -left-4 mt-1.5 w-3 h-3 rounded-full bg-teal-600 ring-4 ring-white shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-mono font-bold text-slate-400">{dateStr}</div>
                  <div className="text-xs font-black text-slate-900">{item.status || EM}</div>
                  {item.note && <p className="text-[11px] font-semibold text-slate-500 mt-0.5 leading-snug">{item.note}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Demoted secondary services list */
export function LinkedServicesCard({
  services = [],
  total = 0,
  language = 'uz',
  onAdd,
  onDelete,
  onEditPrimary,
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 sm:p-5 h-full opacity-95">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
          {language === 'ru' ? 'Услуги (связанные)' : "Xizmatlar (bog'langan)"}
        </h3>
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="text-[10px] font-black text-teal-700 hover:underline cursor-pointer"
          >
            + Qo&apos;shish
          </button>
        )}
      </div>

      <div className="space-y-1.5 max-h-56 overflow-y-auto">
        {services.map((svc, idx) => (
          <div
            key={svc.id || idx}
            className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg hover:bg-slate-50 text-xs"
          >
            <div className="min-w-0">
              <div className="font-bold text-slate-700 truncate">{svc.service_name}</div>
              <div className="text-[10px] text-slate-400 font-mono">#{svc.tooth_number} · {svc.date || EM}</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="font-mono font-bold text-slate-500 text-[11px]">
                {(Number(svc.price) || 0).toLocaleString()}
              </span>
              {svc.is_primary ? (
                onEditPrimary && (
                  <button type="button" onClick={onEditPrimary} className="text-[10px] text-slate-400 hover:text-teal-600 cursor-pointer">✎</button>
                )
              ) : (
                onDelete && (
                  <button type="button" onClick={() => onDelete(svc.id)} className="text-[10px] text-slate-400 hover:text-rose-600 cursor-pointer">✕</button>
                )
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase text-slate-400">Jami</span>
        <span className="text-sm font-black font-mono text-teal-700">
          {Number(total || 0).toLocaleString()} {language === 'ru' ? 'UZS' : "so'm"}
        </span>
      </div>
    </div>
  );
}