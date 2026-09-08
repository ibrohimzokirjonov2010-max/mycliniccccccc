/**
 * Clinical stepper + status helpers for Implant Clinical Passport.
 * Maps UI stage labels to EXISTING lifecycle enums — does not invent new status values.
 */
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export const LIFECYCLE_MAPPING = {
  planned: "Rejalashtirilgan",
  placed: "O'rnatildi",
  healing: "Healing jarayoni",
  abutment: "Abutment qo'yildi",
  crown: "Crown tayyor",
  completed: "Tugallangan",
  failure: "Failure",
  failed: "Failure",
};

export const LIFECYCLE_COLORS = {
  Rejalashtirilgan: 'bg-blue-50 text-blue-700 border-blue-200',
  "O'rnatildi": 'bg-teal-50 text-teal-700 border-teal-200',
  'Healing jarayoni': 'bg-yellow-50 text-yellow-800 border-yellow-200',
  "Abutment qo'yildi": 'bg-purple-50 text-purple-700 border-purple-200',
  'Crown tayyor': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  Tugallangan: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Failure: 'bg-rose-50 text-rose-700 border-rose-200',
};

export const SHORT_STATUS_LABEL = {
  Rejalashtirilgan: 'Reja',
  "O'rnatildi": 'Joylandi',
  'Healing jarayoni': 'Integratsiya',
  "Abutment qo'yildi": 'Abutment',
  'Crown tayyor': 'Protez',
  Tugallangan: 'Yakun',
  Failure: 'Failure',
};

export const STATUS_SELECT_OPTIONS = [
  'Rejalashtirilgan',
  "O'rnatildi",
  'Healing jarayoni',
  "Abutment qo'yildi",
  'Crown tayyor',
  'Tugallangan',
  'Failure',
];

export const DISPLAY_TO_ENUM = {
  Rejalashtirilgan: 'planned',
  "O'rnatildi": 'placed',
  'Healing jarayoni': 'healing',
  "Abutment qo'yildi": 'abutment',
  'Crown tayyor': 'crown',
  Tugallangan: 'completed',
  Failure: 'failure',
};

export const CLINICAL_STEPS = [
  { id: 'reja', label: 'Reja', labelRu: 'План', enumKeys: ['planned', 'Rejalashtirilgan'], rank: 0 },
  { id: 'joylandi', label: 'Joylandi', labelRu: 'Установлен', enumKeys: ['placed', "O'rnatildi"], rank: 1 },
  { id: 'integratsiya', label: 'Integratsiya', labelRu: 'Интеграция', enumKeys: ['healing', 'Healing jarayoni'], rank: 2 },
  { id: 'formik', label: 'Formik', labelRu: 'Формик', enumKeys: [], rank: 3, soft: true },
  { id: 'abutment', label: 'Abutment', labelRu: 'Абатмент', enumKeys: ['abutment', "Abutment qo'yildi"], rank: 4 },
  { id: 'protez', label: 'Protez', labelRu: 'Протез', enumKeys: ['crown', 'Crown tayyor'], rank: 5 },
  { id: 'yakun', label: 'Yakun', labelRu: 'Финиш', enumKeys: ['completed', 'Tugallangan'], rank: 6 },
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

/** Non-soft: reached when rank >= step.rank. Soft Formik: reached when rank >= 4 (abutment+). */
export function isStepReached(step, rank) {
  if (rank < 0) return false;
  if (step.soft) return rank >= 4;
  return rank >= step.rank;
}

export function ClinicalStepper({ status, language = 'uz', className }) {
  const display = normalizeLifecycleStatus(status);
  const rank = getStatusRank(status || display);
  const isFailure = rank < 0;

  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <div className="flex items-center min-w-[640px] px-1 py-2">
        {CLINICAL_STEPS.map((step, idx) => {
          const reached = isStepReached(step, rank);
          const label = language === 'ru' ? step.labelRu : step.label;
          const effectiveRank = step.soft ? 3 : step.rank;
          const lineTeal = !isFailure && rank > effectiveRank;

          return (
            <div key={step.id} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1.5 min-w-[72px]">
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all shadow-sm',
                    reached
                      ? 'bg-teal-600 border-teal-600 text-white'
                      : isFailure
                        ? 'bg-rose-50 border-rose-300 text-rose-400'
                        : 'bg-white border-slate-200 text-slate-400'
                  )}
                >
                  {reached ? (
                    <Check className="w-4 h-4" strokeWidth={3} />
                  ) : (
                    <span className="text-[11px] font-black">{idx + 1}</span>
                  )}
                </div>
                <span
                  className={cn(
                    'text-[10px] font-black uppercase tracking-wide text-center leading-tight whitespace-nowrap',
                    reached ? 'text-teal-700' : 'text-slate-400'
                  )}
                >
                  {label}
                </span>
              </div>
              {idx < CLINICAL_STEPS.length - 1 && (
                <div className={cn('h-0.5 flex-1 mx-1 rounded-full min-w-[12px]', lineTeal ? 'bg-teal-500' : 'bg-slate-200')} />
              )}
            </div>
          );
        })}
      </div>
      {isFailure && (
        <p className="text-[11px] font-bold text-rose-600 mt-1 px-2">
          Failure — klinik bosqichlar to&apos;xtatilgan
        </p>
      )}
    </div>
  );
}

export default ClinicalStepper;
