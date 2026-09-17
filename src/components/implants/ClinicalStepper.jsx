/**
 * Clinical stepper + status helpers for Implant Clinical Passport.
 * Maps UI stage labels to EXISTING lifecycle enums — does not invent new status values.
 */
import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export const LIFECYCLE_MAPPING = {
  planned: "Rejalashtirilgan",
  placed: "O'rnatildi",
  healing: "Integratsiya jarayoni",
  formik: "Formik qo'yildi",
  fomik: "Formik qo'yildi",
  "Formik qo'yildi": "Formik qo'yildi",
  Formik: "Formik qo'yildi",
  abutment: "Abutment qo'yildi",
  crown: "Protez tayyor",
  completed: "Tugallangan",
  failure: "Muvaffaqiyatsiz",
  failed: "Muvaffaqiyatsiz",
};

export const LIFECYCLE_COLORS = {
  Rejalashtirilgan: 'bg-blue-50 text-blue-700 border-blue-200',
  "O'rnatildi": 'bg-teal-50 text-teal-700 border-teal-200',
  'Integratsiya jarayoni': 'bg-yellow-50 text-yellow-800 border-yellow-200',
  'Healing jarayoni': 'bg-yellow-50 text-yellow-800 border-yellow-200',
  "Formik qo'yildi": 'bg-cyan-50 text-cyan-800 border-cyan-200',
  Formik: 'bg-cyan-50 text-cyan-800 border-cyan-200',
  "Abutment qo'yildi": 'bg-purple-50 text-purple-700 border-purple-200',
  'Protez tayyor': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'Crown tayyor': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  Tugallangan: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Muvaffaqiyatsiz: 'bg-rose-50 text-rose-700 border-rose-200',
  Failure: 'bg-rose-50 text-rose-700 border-rose-200',
};

export const SHORT_STATUS_LABEL = {
  Rejalashtirilgan: 'Reja',
  "O'rnatildi": 'Joylandi',
  'Integratsiya jarayoni': 'Integratsiya',
  'Healing jarayoni': 'Integratsiya',
  "Formik qo'yildi": 'Formik',
  Formik: 'Formik',
  "Abutment qo'yildi": 'Abutment',
  'Protez tayyor': 'Protez',
  'Crown tayyor': 'Protez',
  Tugallangan: 'Yakun',
  Muvaffaqiyatsiz: 'Muvaffaqiyatsiz',
  Failure: 'Muvaffaqiyatsiz',
};

export const STATUS_SELECT_OPTIONS = [
  'Rejalashtirilgan',
  "O'rnatildi",
  'Integratsiya jarayoni',
  "Formik qo'yildi",
  "Abutment qo'yildi",
  'Protez tayyor',
  'Tugallangan',
  'Muvaffaqiyatsiz',
];

export const DISPLAY_TO_ENUM = {
  Rejalashtirilgan: 'planned',
  "O'rnatildi": 'placed',
  'Healing jarayoni': 'healing',
  "Formik qo'yildi": 'formik',
  "Abutment qo'yildi": 'abutment',
  'Crown tayyor': 'crown',
  Tugallangan: 'completed',
  Failure: 'failure',
};

export const CLINICAL_STEPS = [
  { id: 'reja', label: 'Reja', labelRu: 'План', lifecycleValue: 'Rejalashtirilgan', enumKeys: ['planned', 'Rejalashtirilgan'], rank: 0 },
  { id: 'joylandi', label: 'Joylandi', labelRu: 'Установлен', lifecycleValue: "O'rnatildi", enumKeys: ['placed', "O'rnatildi"], rank: 1 },
  { id: 'integratsiya', label: 'Integratsiya', labelRu: 'Интеграция', lifecycleValue: 'Integratsiya jarayoni', enumKeys: ['healing', 'Healing jarayoni', 'Integratsiya jarayoni'], rank: 2 },
  { id: 'fomik', label: 'Formik', labelRu: 'Формик', lifecycleValue: "Formik qo'yildi", enumKeys: ['formik', 'fomik', "Formik qo'yildi", 'Formik'], rank: 3 },
  { id: 'abutment', label: 'Abutment', labelRu: 'Абатмент', lifecycleValue: "Abutment qo'yildi", enumKeys: ['abutment', "Abutment qo'yildi"], rank: 4 },
  { id: 'protez', label: 'Protez', labelRu: 'Протез', lifecycleValue: 'Protez tayyor', enumKeys: ['crown', 'Crown tayyor', 'Protez tayyor'], rank: 5 },
  { id: 'yakun', label: 'Yakun', labelRu: 'Финиш', lifecycleValue: 'Tugallangan', enumKeys: ['completed', 'Tugallangan'], rank: 6, isFinish: true },
];

const RANK_BY_STATUS = (() => {
  const map = { failure: -1, failed: -1, Failure: -1 };
  CLINICAL_STEPS.forEach((step) => {
    (step.enumKeys || []).forEach((k) => { map[k] = step.rank; });
  });
  return map;
})();

export function normalizeLifecycleStatus(raw) {
  if (!raw) return 'Rejalashtirilgan';
  return LIFECYCLE_MAPPING[raw] || raw;
}

export function getStatusRank(rawStatus) {
  if (!rawStatus) return 0;
  if (RANK_BY_STATUS[rawStatus] != null) return RANK_BY_STATUS[rawStatus];
  const mapped = LIFECYCLE_MAPPING[rawStatus];
  if (mapped && RANK_BY_STATUS[mapped] != null) return RANK_BY_STATUS[mapped];
  return 0;
}

export function isStepReached(step, rank) {
  if (rank < 0) return false;
  return rank >= step.rank;
}

export function ClinicalStepper({ status, language = 'uz', onSelectStep, className }) {
  const display = normalizeLifecycleStatus(status);
  const rank = getStatusRank(status || display);
  const isFailure = rank < 0;

  const circleClass = (step, reached, isCurrent) => cn(
    'rounded-full flex items-center justify-center transition-all shrink-0',
    reached
      ? 'bg-[#14b8a6] text-white shadow-xs group-hover:bg-[#0f766e]'
      : isFailure
        ? 'bg-rose-50 border-2 border-rose-300 text-rose-400'
        : isCurrent
          ? 'bg-white border-2 border-[#14b8a6] text-[#14b8a6] ring-2 ring-teal-100'
          : step.isFinish
            ? 'bg-white border-2 border-slate-300 text-slate-400 ring-2 ring-slate-100 ring-offset-1 group-hover:border-[#14b8a6]'
            : 'bg-white border-2 border-slate-300 text-slate-300 group-hover:border-[#14b8a6] group-hover:text-[#14b8a6]'
  );

  const mark = (step, reached, isCurrent) => (
    reached ? (
      <Check className="w-4 h-4" strokeWidth={3} />
    ) : isCurrent ? (
      <div className="w-2.5 h-2.5 rounded-full bg-[#14b8a6]" />
    ) : step.isFinish ? (
      <div className="w-2.5 h-2.5 rounded-full border border-slate-300 group-hover:border-[#14b8a6]" />
    ) : null
  );

  return (
    <div className={cn('w-full', className)}>
      {/* Phone / chairside: vertical timeline (no horizontal scroll) */}
      <ol className="md:hidden m-0 p-0 list-none">
        {CLINICAL_STEPS.map((step, idx) => {
          const reached = isStepReached(step, rank);
          const isCurrent = (step.rank === rank) || (step.soft && rank === 3);
          const label = language === 'ru' ? step.labelRu : step.label;
          const effectiveRank = step.soft ? 3 : step.rank;
          const lineTeal = !isFailure && rank > effectiveRank;
          return (
            <li key={step.id} className="flex gap-3">
              <div className="flex flex-col items-center w-10 shrink-0">
                <button
                  type="button"
                  onClick={() => onSelectStep?.(step)}
                  title={onSelectStep ? `${label} bosqichiga o'tkazish uchun bosing` : label}
                  className={cn(
                    'min-h-[44px] min-w-[44px] flex items-center justify-center bg-transparent border-0 p-0',
                    onSelectStep ? 'cursor-pointer active:scale-95 group' : 'cursor-default'
                  )}
                >
                  <div className={cn('w-9 h-9', circleClass(step, reached, isCurrent))}>
                    {mark(step, reached, isCurrent)}
                  </div>
                </button>
                {idx < CLINICAL_STEPS.length - 1 && (
                  <div className={cn('w-0.5 flex-1 min-h-[12px] rounded-full', lineTeal ? 'bg-[#14b8a6]' : 'bg-slate-200')} />
                )}
              </div>
              <button
                type="button"
                onClick={() => onSelectStep?.(step)}
                className={cn(
                  'flex-1 min-h-[44px] flex items-center justify-between gap-2 py-2 pr-1 bg-transparent border-0 text-left',
                  onSelectStep ? 'cursor-pointer active:opacity-80' : 'cursor-default'
                )}
              >
                <span className={cn('text-sm leading-tight', reached || isCurrent ? 'text-[#14b8a6] font-bold' : 'text-slate-700 font-semibold')}>
                  {label}
                </span>
                {isCurrent && (
                  <span className="text-[10px] font-black uppercase tracking-wider text-teal-700 bg-teal-50 border border-teal-200 rounded-full px-2 py-0.5 shrink-0">
                    {language === 'ru' ? 'текущий' : 'joriy'}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>

      {/* Desktop / tablet: compact horizontal stepper (unchanged pattern) */}
      <div className="hidden md:flex items-center justify-between gap-1 overflow-x-auto py-1 scrollbar-none">
        {CLINICAL_STEPS.map((step, idx) => {
          const reached = isStepReached(step, rank);
          const isCurrent = (step.rank === rank) || (step.soft && rank === 3);
          const label = language === 'ru' ? step.labelRu : step.label;
          const effectiveRank = step.soft ? 3 : step.rank;
          const lineTeal = !isFailure && rank > effectiveRank;

          return (
            <React.Fragment key={step.id}>
              <button
                type="button"
                onClick={() => onSelectStep?.(step)}
                title={onSelectStep ? `${label} bosqichiga o'tkazish uchun bosing` : label}
                className={cn(
                  'flex flex-col items-center gap-1.5 shrink-0 min-w-[54px] bg-transparent border-0 p-0 text-left transition-all',
                  onSelectStep ? 'cursor-pointer hover:scale-105 active:scale-95 group' : 'cursor-default'
                )}
              >
                <div className={cn('w-7 h-7', circleClass(step, reached, isCurrent))}>
                  {mark(step, reached, isCurrent)}
                </div>
                <span
                  className={cn(
                    'text-[11px] text-center leading-tight whitespace-nowrap transition-colors',
                    reached || isCurrent ? 'text-[#14b8a6] font-bold' : 'text-slate-500 font-medium group-hover:text-[#14b8a6]'
                  )}
                >
                  {label}
                </span>
              </button>
              {idx < CLINICAL_STEPS.length - 1 && (
                <div
                  className={cn(
                    'h-0.5 flex-1 min-w-[14px] -mt-5 rounded-full transition-colors',
                    lineTeal ? 'bg-[#14b8a6]' : 'bg-slate-200'
                  )}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {isFailure && (
        <p className="text-[11px] font-bold text-rose-600 mt-2 text-center">
          Failure — klinik bosqichlar to&apos;xtatilgan
        </p>
      )}
    </div>
  );
}

export default ClinicalStepper;
