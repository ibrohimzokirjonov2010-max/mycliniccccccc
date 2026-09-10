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
  if (!d && !l) return EM;
  if (d && l) {
    if (withUnits) return `${DIA} ${d} mm ${MUL} L ${l} mm`;
    return `${DIA}${d}${MUL}${l}`;
  }
  if (d) return withUnits ? `${DIA} ${d} mm` : `${DIA}${d}`;
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
                  ? 'border-2 border-[#14b8a6] ring-4 ring-[#14b8a6]/10 shadow-sm'
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
                  <div className="w-full py-2 px-3 rounded-xl bg-[#14b8a6] text-white font-black text-xs text-center shadow-xs">
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
  // Mockup badge uses English Delayed / Immediate / Early
  if (!protocol) return 'Delayed';
  const s = String(protocol).toLowerCase();
  if (s.includes('delay') || s.includes('kechik') || s.includes('отсроч')) return 'Delayed';
  if (s.includes('immed') || s.includes('darhol') || s.includes('немедл')) return 'Immediate';
  if (s.includes('early') || s.includes('erta') || s.includes('ранн')) return 'Early';
  return protocol;
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

/** Large clinical passport specs card matching reference screenshot */
export function PassportSpecsCard({ implant, language = 'uz' }) {
  const diameter = implant?.diameter != null && String(implant.diameter).trim() !== '' ? String(implant.diameter).trim() : null;
  const length = implant?.length != null && String(implant.length).trim() !== '' ? String(implant.length).trim() : null;
  const sizeText = formatImplantSize(diameter, length, { withUnits: true });

  const torqueVal = (implant?.torque != null && String(implant.torque).trim() !== '')
    ? `${implant.torque}${String(implant.torque).toLowerCase().includes('ncm') ? '' : ' Ncm'}`
    : EM;
  const isqVal = (implant?.isq != null && String(implant.isq).trim() !== '')
    ? String(implant.isq).trim()
    : EM;
  const lotVal = (implant?.lot_number && String(implant.lot_number).trim())
    ? String(implant.lot_number).trim()
    : EM;
  const boneVal = (implant?.bone_type && String(implant.bone_type).trim())
    ? String(implant.bone_type).trim()
    : EM;
  const dateVal = (implant?.placement_date && String(implant.placement_date).trim())
    ? formatTimelineDate(implant.placement_date)
    : EM;
  const doctorVal = (implant?.doctor && String(implant.doctor).trim())
    ? String(implant.doctor).trim()
    : EM;
  const protocolVal = formatProtocol(implant?.loading_protocol || implant?.protocol, language);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 sm:p-6 h-full flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-xl bg-teal-50 text-[#14b8a6] flex items-center justify-center">
            <ImplantIcon className="w-4 h-4" />
          </div>
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
            {language === 'ru' ? 'Клинический паспорт' : 'Klinik Pasport'}
          </h3>
        </div>

        {/* Large Size Display — mockup HUGE Ø × L */}
        <div className="text-[1.85rem] sm:text-[2.15rem] font-black tracking-tight text-[#14b8a6] mb-5 font-mono leading-none">
          {sizeText}
        </div>

        {/* 2-Column Specs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
          {/* LOT / Seria */}
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-full bg-teal-50 text-[#14b8a6] flex items-center justify-center shrink-0 mt-0.5">
              <Lightbulb className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {language === 'ru' ? 'LOT / Серия' : 'LOT / Seria'}
              </div>
              <div className="text-sm font-black font-mono text-[#14b8a6] truncate">{lotVal}</div>
            </div>
          </div>

          {/* Torque */}
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-full bg-teal-50 text-[#14b8a6] flex items-center justify-center shrink-0 mt-0.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {language === 'ru' ? 'Torque' : 'Torque'}
              </div>
              <div className="text-sm font-black text-slate-900 truncate">{torqueVal}</div>
            </div>
          </div>

          {/* ISQ (Istabilnost) */}
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-full bg-teal-50 text-[#14b8a6] flex items-center justify-center shrink-0 mt-0.5">
              <Target className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {language === 'ru' ? 'ISQ' : 'ISQ'}
              </div>
              <div className="text-sm font-black text-slate-900 truncate">{isqVal}</div>
            </div>
          </div>

          {/* Suyak turi */}
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-full bg-teal-50 text-[#14b8a6] flex items-center justify-center shrink-0 mt-0.5">
              <Layers className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {language === 'ru' ? 'Тип кости' : 'Suyak turi'}
              </div>
              <div className="text-sm font-black text-slate-900 truncate">{boneVal}</div>
            </div>
          </div>

          {/* Jarroh */}
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-full bg-teal-50 text-[#14b8a6] flex items-center justify-center shrink-0 mt-0.5">
              <UserRound className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {language === 'ru' ? 'Хирург' : 'Jarroh'}
              </div>
              <div className="text-sm font-black text-slate-900 truncate">{doctorVal}</div>
            </div>
          </div>

          {/* Joylash sanasi */}
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-full bg-teal-50 text-[#14b8a6] flex items-center justify-center shrink-0 mt-0.5">
              <Calendar className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {language === 'ru' ? 'Дата установки' : 'Joylash sanasi'}
              </div>
              <div className="text-sm font-black text-slate-900 truncate">{dateVal}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Loading Protocol Badge */}
      <div className="mt-5 pt-4 border-t border-slate-100 flex items-center gap-2.5 flex-wrap">
        <div className="w-7 h-7 rounded-full bg-teal-50 text-[#14b8a6] flex items-center justify-center shrink-0">
          <Activity className="w-3.5 h-3.5" />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {language === 'ru' ? 'Протокол нагрузки' : 'Loading protokoli'}
          </div>
          <span className="inline-flex mt-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-teal-50 text-[#0f766e] border border-teal-200">
            {protocolVal}
          </span>
        </div>
      </div>
    </div>
  );
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

  const displayStatus = normalizeLifecycleStatus(implant?.lifecycle_status || implant?.status);
  const isCompleted = displayStatus === 'Tugallangan';

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 sm:p-6 w-full h-full flex flex-col">
      <div className="flex items-center justify-between mb-5 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-teal-50 text-[#14b8a6] flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 truncate">
            {language === 'ru' ? 'История клинических этапов' : 'Klinik Bosqichlar Tarixi'}
          </h3>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isCompleted && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-teal-50 text-[#0f766e] border border-teal-200">
              <Check className="w-3 h-3" />
              {language === 'ru' ? 'Завершено' : 'Yakunlandi'}
            </span>
          )}
          {onAddMilestone && (
            <button
              type="button"
              onClick={onAddMilestone}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-teal-50 text-teal-800 hover:bg-teal-100/80 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-[#14b8a6]" />
              <span className="hidden sm:inline">{language === 'ru' ? 'Этап' : "Qo'shish"}</span>
            </button>
          )}
        </div>
      </div>

      {historyItems.length === 0 ? (
        <div className="text-xs font-medium text-slate-400 py-4 text-center">
          {language === 'ru' ? 'История этапов пока пуста' : "Klinik bosqichlar tarixi hozircha bo'sh"}
        </div>
      ) : (
        <div className="relative pl-6 space-y-5 flex-1 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-[#14b8a6]">
          {historyItems.map((item) => (
            <div key={item.id} className="relative flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-6">
              <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-[#14b8a6] ring-4 ring-white shrink-0" />
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

      {isCompleted && (
        <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black bg-[#14b8a6] text-white shadow-sm">
            <Check className="w-3.5 h-3.5" />
            {language === 'ru' ? 'Завершено' : 'Yakunlandi'}
          </span>
        </div>
      )}
    </div>
  );
}

const MEDIA_LABELS = [
  { key: 'preop', uz: 'Pre-op', ru: 'Pre-op' },
  { key: 'postop', uz: 'Post-op', ru: 'Post-op' },
  { key: 'healing', uz: 'Healing', ru: 'Healing' },
  { key: 'final', uz: 'Final', ru: 'Final' },
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
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-xl bg-teal-50 text-[#14b8a6] flex items-center justify-center">
          <Camera className="w-4 h-4" />
        </div>
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
          {language === 'ru' ? 'Снимки этапов' : 'Bosqich Rasm va Yozuvlar'}
        </h3>
      </div>

      <div className="grid grid-cols-2 gap-2.5 flex-1">
        {slots.map((slot) => (
          <button
            key={slot.key}
            type="button"
            onClick={() => slot.url && onZoom?.(slot.url)}
            className={cn(
              'relative aspect-[4/3] rounded-xl border overflow-hidden text-left group',
              slot.url
                ? 'border-slate-200 cursor-pointer'
                : 'border-dashed border-slate-200 bg-slate-50 cursor-pointer hover:border-teal-300'
            )}
          >
            {slot.url ? (
              <img src={slot.url} alt={slot.uz} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 gap-1.5 bg-gradient-to-b from-slate-50 to-slate-100/80">
                <div className="w-8 h-8 rounded-full bg-white border border-slate-200 text-[#14b8a6] flex items-center justify-center shadow-sm group-hover:border-teal-300">
                  <Camera className="w-4 h-4" />
                </div>
              </div>
            )}
            <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wide bg-white/90 text-slate-700 border border-slate-200/80">
              {language === 'ru' ? slot.ru : slot.uz}
            </span>
            <span className="absolute top-1.5 right-1.5 w-7 h-7 rounded-lg bg-[#14b8a6] text-white flex items-center justify-center shadow-sm opacity-90 group-hover:opacity-100">
              <Camera className="w-3.5 h-3.5" />
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-dashed border-teal-300/80 bg-teal-50/30 px-3 py-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 min-w-0">
          <FileText className="w-3.5 h-3.5 text-[#14b8a6] shrink-0" />
          <span className="truncate">{language === 'ru' ? 'Паспорт стикер (PDF)' : 'Pasport stikeri (PDF)'}</span>
        </div>
        <button
          type="button"
          onClick={onOpenPassport}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black bg-[#14b8a6] text-white hover:bg-teal-600 cursor-pointer shrink-0 shadow-sm"
        >
          <Download className="w-3 h-3" />
          {language === 'ru' ? 'Смотреть / Скачать' : "Ko'rish / Yuklab olish"}
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
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 sm:p-6 h-full flex flex-col">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-teal-50 text-[#14b8a6] flex items-center justify-center shrink-0">
            <Hash className="w-4 h-4" />
          </div>
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 truncate">
            {language === 'ru' ? 'Услуги (связанные)' : "Xizmatlar (Bog'langan)"}
          </h3>
        </div>
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-black text-[#14b8a6] hover:bg-teal-50 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            {language === 'ru' ? 'Добавить' : "Qo'shish"}
          </button>
        )}
      </div>

      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-100 text-slate-400">
              <th className="pb-2 pr-2 font-bold">{language === 'ru' ? 'Услуга' : 'Xizmat'}</th>
              <th className="pb-2 px-2 font-bold whitespace-nowrap">{language === 'ru' ? 'Дата' : 'Sana'}</th>
              <th className="pb-2 pl-2 font-bold text-right whitespace-nowrap">{language === 'ru' ? 'Цена' : 'Narx'}</th>
            </tr>
          </thead>
          <tbody>
            {services.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-6 text-center text-slate-400 font-medium">
                  {language === 'ru' ? 'Нет связанных услуг' : "Bog'langan xizmatlar yo'q"}
                </td>
              </tr>
            ) : services.map((svc, idx) => (
              <tr key={svc.id || idx} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                <td className="py-3 pr-2 align-top">
                  <div className="font-bold text-slate-900 leading-snug">{svc.service_name || EM}</div>
                  {svc.tooth_number ? (
                    <div className="text-[10px] font-mono font-bold text-slate-400 mt-0.5">#{svc.tooth_number}</div>
                  ) : null}
                  {svc.is_primary && onEditPrimary ? (
                    <button type="button" onClick={onEditPrimary} className="text-[10px] font-bold text-[#14b8a6] hover:underline mt-0.5 cursor-pointer">
                      {language === 'ru' ? 'Редактировать' : 'Tahrirlash'}
                    </button>
                  ) : null}
                </td>
                <td className="py-3 px-2 align-top font-mono text-slate-500 whitespace-nowrap">{svc.date || EM}</td>
                <td className="py-3 pl-2 align-top text-right whitespace-nowrap">
                  <div className="font-mono font-black text-slate-800">
                    {(Number(svc.price) || 0).toLocaleString()} <span className="text-[10px] font-bold text-slate-400">so&apos;m</span>
                  </div>
                  {!svc.is_primary && onDelete ? (
                    <button
                      type="button"
                      onClick={() => onDelete(svc.id)}
                      className="text-slate-300 hover:text-rose-600 cursor-pointer text-sm leading-none mt-1"
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

      <div className="mt-4 pt-4 border-t border-slate-100 flex items-end justify-between gap-3">
        <span className="text-[11px] font-bold text-slate-500">
          {language === 'ru' ? 'Итого (все услуги)' : 'Jami (barcha xizmatlar)'}
        </span>
        <span className="text-xl sm:text-2xl font-black font-mono text-[#14b8a6] leading-none">
          {(Number(total) || 0).toLocaleString()} <span className="text-sm font-bold">so&apos;m</span>
        </span>
      </div>
    </div>
  );
}

