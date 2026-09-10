import React, { useState } from 'react';
import {
  Camera, FileText, Download, CheckCircle2,
  Calendar, UserRound, Layers, Target, Hash,
  Tag, Clock, AlertCircle, Plus, Check, Lightbulb, Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ImplantIcon } from '@/components/ui/Icons';
import {
  normalizeLifecycleStatus,
  SHORT_STATUS_LABEL,
  LIFECYCLE_COLORS,
} from './ClinicalStepper';
import DentalArchFdi from './DentalArchFdi';

export { DentalArchFdi };

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
  const d = diameter != null && diameter !== '' ? String(diameter).trim() : null;
  const l = length != null && length !== '' ? String(length).trim() : null;
  if (!d && !l) return '—';
  if (d && l) {
    if (withUnits) return `${d} mm ${MUL} ${l} mm`;
    return `${d}${MUL}${l}`;
  }
  if (d) return withUnits ? `Ø ${d} mm` : `Ø ${d}`;
  return withUnits ? `L ${l} mm` : `L ${l}`;
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

/** Backward compatible MiniFdiChart */
export function MiniFdiChart({ activeFdis = [], onSelectTooth, className }) {
  return <DentalArchFdi activeFdis={activeFdis} onSelectTooth={onSelectTooth} className={className} />;
}

/** Left-rail implant switcher cards matching the reference screenshot */
export function ImplantSwitcher({
  implants = [],
  selectedId,
  onSelect,
  language = 'uz',
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-3">
        {implants.map((imp, idx) => {
          // Prefer explicit per-chip tooth key so multi-tooth cases never all show the same FDI
          const preferredKey = imp.syntheticToothKey || imp.tooth_id || (Array.isArray(imp.tooth_numbers) && imp.tooth_numbers.length === 1 ? imp.tooth_numbers[0] : null);
          const rawFdis = preferredKey
            ? [toothIdToFdi(preferredKey)]
            : getToothFdiList(imp);
          const fdi = rawFdis[0] || toothIdToFdi(imp.tooth_number) || toothIdToFdi(imp.tooth_id) || '—';
          const display = normalizeLifecycleStatus(imp.lifecycle_status || imp.status);
          const short = SHORT_STATUS_LABEL[display] || display || (language === 'ru' ? 'Установлен' : 'Joylandi');
          const selected = imp.id === selectedId;
          const brand = (imp.firma === 'Boshqa' ? imp.firma_custom : imp.firma) || imp.brend || '—';
          
          let size = '—';
          if (imp.diameter && imp.length) {
            size = `${imp.diameter} × ${imp.length}`;
          } else if (imp.diameter) {
            size = `Ø ${imp.diameter} mm`;
          } else if (imp.length) {
            size = `L ${imp.length} mm`;
          }

          return (
            <div
              key={imp.id || idx}
              onClick={() => onSelect?.(imp.id)}
              className={cn(
                'rounded-2xl p-4 transition-all cursor-pointer select-none bg-white',
                selected
                  ? 'border-2 border-[#1499AD] ring-4 ring-[#1499AD]/10 shadow-sm'
                  : 'border border-slate-200 hover:border-slate-300 hover:bg-slate-50/40 shadow-xs'
              )}
            >
              <div className="flex items-center gap-3">
                {/* Tooth number box */}
                <div className={cn(
                  'px-2.5 py-1.5 rounded-xl flex items-center justify-center font-mono font-black text-sm border',
                  selected
                    ? 'bg-teal-50/80 text-teal-800 border-teal-200'
                    : 'bg-slate-50 text-slate-700 border-slate-200'
                )}>
                  #{fdi}
                </div>

                {/* Brand and size */}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-black text-slate-900 truncate">{brand}</div>
                  {imp.brend && String(imp.brend).trim() && String(imp.brend).trim() !== String(brand).trim() && (
                    <div className="text-[10px] font-bold text-indigo-600 truncate">{imp.brend}</div>
                  )}
                  <div className="text-xs font-mono font-bold text-slate-500">{size}</div>
                </div>
              </div>

              {/* Status Action Pill/Button matching screenshot */}
              <div className="mt-3">
                {selected ? (
                  <div className="w-full py-2 px-3 rounded-xl bg-[#1499AD] text-white font-black text-xs text-center shadow-xs">
                    {short}
                  </div>
                ) : (
                  <div className="w-full py-2 px-3 rounded-xl bg-slate-200 text-slate-700 font-bold text-xs text-center">
                    {short}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function formatProtocol(protocol, language = 'uz') {
  if (!protocol) return language === 'ru' ? 'Отсроченная' : 'Kechiktirilgan';
  const s = String(protocol).toLowerCase();
  if (s.includes('delay')) return language === 'ru' ? 'Отсроченная' : 'Kechiktirilgan';
  if (s.includes('immed')) return language === 'ru' ? 'Немедленная' : 'Darhol';
  if (s.includes('early')) return language === 'ru' ? 'Ранняя' : 'Erta';
  return protocol;
}

/** Large clinical passport specs card matching reference screenshot */
export function PassportSpecsCard({ implant, language = 'uz' }) {
  const diameter = implant?.diameter != null && String(implant.diameter).trim() !== '' ? String(implant.diameter).trim() : null;
  const length = implant?.length != null && String(implant.length).trim() !== '' ? String(implant.length).trim() : null;
  const sizeText = formatImplantSize(diameter, length, { withUnits: true });

  const torqueVal = (implant?.torque != null && String(implant.torque).trim() !== '')
    ? `${implant.torque} Ncm`
    : '—';
  const isqVal = (implant?.isq != null && String(implant.isq).trim() !== '')
    ? String(implant.isq).trim()
    : '—';
  const lotVal = (implant?.lot_number && String(implant.lot_number).trim())
    ? String(implant.lot_number).trim()
    : '—';
  const boneVal = (implant?.bone_type && String(implant.bone_type).trim())
    ? String(implant.bone_type).trim()
    : '—';
  const dateVal = (implant?.placement_date && String(implant.placement_date).trim())
    ? String(implant.placement_date).split('T')[0]
    : '—';
  const doctorVal = (implant?.doctor && String(implant.doctor).trim())
    ? String(implant.doctor).trim()
    : '—';
  const protocolVal = (implant?.loading_protocol || implant?.protocol)
    ? formatProtocol(implant.loading_protocol || implant.protocol, language)
    : (language === 'ru' ? 'Отсроченная' : 'Kechiktirilgan');

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 sm:p-6 h-full flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-xl bg-teal-50 text-[#1499AD] flex items-center justify-center">
            <ImplantIcon className="w-4 h-4" />
          </div>
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
            {language === 'ru' ? 'Клинический паспорт' : 'Klinik pasport'}
          </h3>
        </div>

        {/* Large Size Display */}
        <div className="text-3xl sm:text-4xl font-black tracking-tight text-[#0d7685] mb-2 font-mono leading-none">
          {sizeText}
        </div>

        {/* Brand / Model for selected tooth */}
        {(() => {
          const brand = (implant?.firma === 'Boshqa'
            ? (implant?.firma_custom || 'Boshqa')
            : implant?.firma) || '';
          const model = (implant?.brend && String(implant.brend).trim() && String(implant.brend).trim() !== String(brand).trim())
            ? String(implant.brend).trim()
            : '';
          if (!brand && !model) return null;
          return (
            <div className="mb-5 flex flex-wrap items-center gap-2">
              {brand && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-black bg-indigo-50 text-indigo-800 border border-indigo-200">
                  <Tag className="w-3 h-3" />
                  {brand}
                </span>
              )}
              {model && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold bg-slate-50 text-slate-700 border border-slate-200">
                  {language === 'ru' ? 'Модель' : 'Model'}: {model}
                </span>
              )}
            </div>
          );
        })()}

        {/* 2-Column Specs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
          {/* LOT / Seria */}
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-full bg-teal-50 text-[#1499AD] flex items-center justify-center shrink-0 mt-0.5">
              <Lightbulb className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {language === 'ru' ? 'Серия / LOT' : 'Partiya / Seriya'}
              </div>
              <div className="text-sm font-black font-mono text-[#0d9488] truncate">{lotVal}</div>
            </div>
          </div>

          {/* Torque */}
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-full bg-teal-50 text-[#1499AD] flex items-center justify-center shrink-0 mt-0.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {language === 'ru' ? 'Торк (усилие)' : 'Torque (Burish kuchi)'}
              </div>
              <div className="text-sm font-black text-slate-900 truncate">{torqueVal}</div>
            </div>
          </div>

          {/* ISQ (Istabilnost) */}
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-full bg-teal-50 text-[#1499AD] flex items-center justify-center shrink-0 mt-0.5">
              <Target className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {language === 'ru' ? 'ISQ (Стабильность)' : 'ISQ (Barqarorlik)'}
              </div>
              <div className="text-sm font-black text-slate-900 truncate">{isqVal}</div>
            </div>
          </div>

          {/* Suyak turi */}
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-full bg-teal-50 text-[#1499AD] flex items-center justify-center shrink-0 mt-0.5">
              <Layers className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {language === 'ru' ? 'Тип кости' : 'Suyak turi (D1-D4)'}
              </div>
              <div className="text-sm font-black text-slate-900 truncate">{boneVal}</div>
            </div>
          </div>

          {/* Jarroh */}
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-full bg-teal-50 text-[#1499AD] flex items-center justify-center shrink-0 mt-0.5">
              <UserRound className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {language === 'ru' ? 'Хирург' : 'Jarroh shifokor'}
              </div>
              <div className="text-sm font-black text-slate-900 truncate">{doctorVal}</div>
            </div>
          </div>

          {/* Joylash sanasi */}
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-full bg-teal-50 text-[#1499AD] flex items-center justify-center shrink-0 mt-0.5">
              <Calendar className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {language === 'ru' ? 'Дата установки' : "O'rnatilgan sana"}
              </div>
              <div className="text-sm font-black text-slate-900 truncate">{dateVal}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Loading Protocol Badge */}
      <div className="mt-5 pt-3 border-t border-slate-100 flex items-center gap-2.5">
        <div className="w-6 h-6 rounded-full bg-teal-50 text-[#1499AD] flex items-center justify-center">
          <Activity className="w-3.5 h-3.5" />
        </div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {language === 'ru' ? 'Протокол нагрузки:' : 'Yuklama protokoli:'}
        </div>
        <span className="px-2.5 py-0.5 rounded-lg text-xs font-black bg-teal-50 text-teal-700 border border-teal-200">
          {protocolVal}
        </span>
      </div>
    </div>
  );
}

/** Parse assorted date strings into a Date (or null) */
function parseTimelineDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  // DD.MM.YYYY
  const dmy = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dmy) {
    const d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatTimelineDate(raw) {
  const d = parseTimelineDate(raw);
  if (!d) return raw ? String(raw) : '—';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}.${d.getFullYear()}`;
}

/**
 * Build clinical stage history from REAL implant.timeline (and optional per-tooth timeline).
 * Does NOT invent hardcoded future stages — those made the bottom history look frozen.
 */
export function buildClinicalHistoryItems(implant, language = 'uz') {
  const rawTimeline = Array.isArray(implant?.timeline) ? implant.timeline : [];

  const entries = rawTimeline
    .filter((it) => it && (it.status || it.title || it.note || it.detail))
    .map((it, idx) => {
      const parsed = parseTimelineDate(it.date);
      return {
        id: it.id || `tl-${idx}-${it.status || it.title || 'x'}`,
        date: formatTimelineDate(it.date),
        sortKey: parsed ? parsed.getTime() : idx,
        title: it.status || it.title || (language === 'ru' ? 'Клиническая запись' : 'Klinik qayd'),
        detail: it.note || it.detail || '',
        toothFdi: it.tooth_fdi || it.tooth_number || null,
      };
    });

  // Seed a single placement entry only when history is empty (never invent future stages)
  if (entries.length === 0 && implant?.placement_date) {
    const parts = [];
    if (implant.torque) parts.push(`Torque: ${implant.torque}${String(implant.torque).includes('Ncm') ? '' : ' Ncm'}`);
    if (implant.isq) parts.push(`ISQ: ${implant.isq}`);
    if (implant.doctor) parts.push(language === 'ru' ? `Хирург: ${implant.doctor}` : `Jarroh: ${implant.doctor}`);
    const parsed = parseTimelineDate(implant.placement_date);
    entries.push({
      id: 'seed-placement',
      date: formatTimelineDate(implant.placement_date),
      sortKey: parsed ? parsed.getTime() : 0,
      title: language === 'ru' ? 'Имплант установлен' : "Implant joylandi",
      detail: parts.length > 0
        ? parts.join(' | ')
        : (language === 'ru' ? 'Имплант успешно установлен' : 'Implant muvaffaqiyatli joylandi'),
      toothFdi: null,
    });
  }

  // Chronological: oldest → newest (stable medical timeline)
  entries.sort((a, b) => {
    if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
    return String(a.id).localeCompare(String(b.id));
  });

  return entries;
}

/** Vertical Clinical Stages Timeline — driven by real timeline field */
export function ClinicalTimeline({ implant, language = 'uz', onAddMilestone }) {
  const historyItems = buildClinicalHistoryItems(implant, language);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 sm:p-6 w-full">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-teal-50 text-[#1499AD] flex items-center justify-center">
            <Clock className="w-4 h-4" />
          </div>
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
            {language === 'ru' ? 'История клинических этапов' : 'Klinik bosqichlar tarixi'}
          </h3>
        </div>

        {onAddMilestone && (
          <button
            type="button"
            onClick={onAddMilestone}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-teal-50 text-teal-800 hover:bg-teal-100/80 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-[#1499AD]" />
            <span>{language === 'ru' ? 'Добавить этап' : "Bosqich qo'shish"}</span>
          </button>
        )}
      </div>

      {historyItems.length === 0 ? (
        <div className="text-xs font-medium text-slate-400 py-4 text-center">
          {language === 'ru' ? 'История этапов пока пуста' : "Klinik bosqichlar tarixi hozircha bo'sh"}
        </div>
      ) : (
        <div className="relative pl-6 space-y-5 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-[#1499AD]">
          {historyItems.map((item) => (
            <div key={item.id} className="relative flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-6">
              <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-[#1499AD] ring-4 ring-white shrink-0" />
              <div className="text-xs font-mono font-bold text-slate-700 w-28 shrink-0">
                {item.date}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-black text-slate-900 leading-snug">
                  {item.title}
                  {item.toothFdi ? (
                    <span className="ml-2 text-[10px] font-mono font-bold text-teal-700 bg-teal-50 border border-teal-100 px-1.5 py-0.5 rounded-md">
                      #{item.toothFdi}
                    </span>
                  ) : null}
                </div>
                {item.detail && (
                  <div className="text-xs font-medium text-slate-500 mt-0.5 leading-snug">
                    {item.detail}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const MEDIA_LABELS = [
  { key: 'preop', uz: 'Operatsiyadan oldin', ru: 'До операции' },
  { key: 'postop', uz: 'Operatsiyadan keyin', ru: 'После операции' },
  { key: 'healing', uz: 'Bitish jarayoni', ru: 'Заживление' },
  { key: 'final', uz: 'Yakuniy natija', ru: 'Финал' },
];

/** Stage-tagged media rail */
export function StageMediaRail({ implant, language = 'uz', onZoom, onOpenPassport }) {
  const xrays = Array.isArray(implant?.xray_urls) ? implant.xray_urls : [];
  const slots = MEDIA_LABELS.map((lab, idx) => {
    let url = xrays[idx] || null;
    if (idx === 3 && implant?.passport_url) url = implant.passport_url;
    return { ...lab, url };
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
          <Camera className="w-4 h-4" />
        </div>
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
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
                <span className="text-[9px] font-bold text-slate-400">Rasm yuklanmagan</span>
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

/** Secondary services list — clean clinical table */
export function LinkedServicesCard({
  services = [],
  total = 0,
  language = 'uz',
  onAdd,
  onDelete,
  onEditPrimary,
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-teal-50 text-[#1499AD] flex items-center justify-center">
            <Hash className="w-4 h-4" />
          </div>
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
            {language === 'ru' ? 'Услуги (связанные)' : "Xizmatlar (bog'langan)"}
          </h3>
        </div>
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-[#1499AD] text-white hover:bg-[#118294] transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            {language === 'ru' ? 'Добавить' : "Qo'shish"}
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-3 py-2 font-black uppercase tracking-wider">#</th>
              <th className="px-3 py-2 font-black uppercase tracking-wider">{language === 'ru' ? 'Услуга' : 'Xizmat'}</th>
              <th className="px-3 py-2 font-black uppercase tracking-wider">{language === 'ru' ? 'Зуб' : 'Tish'}</th>
              <th className="px-3 py-2 font-black uppercase tracking-wider">{language === 'ru' ? 'Дата' : 'Sana'}</th>
              <th className="px-3 py-2 font-black uppercase tracking-wider text-right">{language === 'ru' ? 'Цена' : 'Narx'}</th>
              <th className="px-3 py-2 w-10" />
            </tr>
          </thead>
          <tbody>
            {services.map((svc, idx) => (
              <tr key={svc.id || idx} className="border-t border-slate-100 hover:bg-slate-50/60">
                <td className="px-3 py-2.5 font-mono font-bold text-slate-400">{idx + 1}</td>
                <td className="px-3 py-2.5">
                  <div className="font-black text-slate-900">{svc.service_name || EM}</div>
                  {svc.notes ? <div className="text-[10px] font-medium text-slate-400 mt-0.5 truncate max-w-[240px]">{svc.notes}</div> : null}
                  {svc.is_primary && onEditPrimary ? (
                    <button type="button" onClick={onEditPrimary} className="text-[10px] font-bold text-[#1499AD] hover:underline mt-0.5 cursor-pointer">
                      {language === 'ru' ? 'Редактировать основную' : 'Asosiyni tahrirlash'}
                    </button>
                  ) : null}
                </td>
                <td className="px-3 py-2.5 font-mono font-bold text-slate-700">#{svc.tooth_number || EM}</td>
                <td className="px-3 py-2.5 font-mono text-slate-600">{svc.date || EM}</td>
                <td className="px-3 py-2.5 text-right font-mono font-black text-emerald-700">
                  {(Number(svc.price) || 0).toLocaleString()}
                </td>
                <td className="px-3 py-2.5 text-right">
                  {!svc.is_primary && onDelete ? (
                    <button
                      type="button"
                      onClick={() => onDelete(svc.id)}
                      className="text-slate-300 hover:text-rose-600 cursor-pointer"
                      title={language === 'ru' ? 'Удалить' : "O'chirish"}
                    >
                      ×
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-slate-900 text-white px-4 py-3">
        <span className="text-[11px] font-black uppercase tracking-wider text-slate-300">
          {language === 'ru' ? 'Итого' : 'Jami'}
        </span>
        <span className="text-base font-black font-mono">
          {(Number(total) || 0).toLocaleString()} {language === 'ru' ? 'UZS' : "so'm"}
        </span>
      </div>
    </div>
  );
}

