import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Check, CalendarDays, Stethoscope, ClipboardList, ChevronDown } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { groupProgress } from './planStepperModel';

const TEAL = '#14b8a6';

function stepCaption(step) {
  const tooth = step.tooth ? ` (#${step.tooth})` : '';
  return `${step.title || ''}${tooth}`;
}

function StepTrack({ steps, focusId }) {
  const trackRef = useRef(null);
  useEffect(() => {
    if (focusId == null || !trackRef.current) return;
    const node = Array.from(trackRef.current.querySelectorAll('[data-step-id]'))
      .find((el) => el.getAttribute('data-step-id') === String(focusId));
    node?.scrollIntoView?.({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [focusId]);
  const visible = (steps || []).filter((step) => step.state !== 'done');
  if (visible.length === 0) {
    return (
      <p className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
        Barcha bosqichlar bajarilgan
      </p>
    );
  }
  return (
    <div ref={trackRef} className="overflow-x-auto pb-1" data-testid="plan-stepper-scroll">
      <div className="flex items-start w-max">
        {visible.map((step, idx) => {
          const isActive = step.state === 'active';
          const isLast = idx === visible.length - 1;
          return (
            <div key={step.id || idx} data-step-id={step.id} className="flex items-start shrink-0">
              <div className="w-[108px] sm:w-[124px] px-1 flex flex-col items-center text-center">
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                    isActive && 'text-white shadow-md ring-4 ring-teal-100',
                    !isActive && 'bg-white border-2 border-slate-300 text-slate-500'
                  )}
                  style={isActive ? { backgroundColor: TEAL } : undefined}
                >
                  <span className="text-[12px] font-black leading-none">{step.number || idx + 1}</span>
                </div>
                <p className="mt-2 w-full text-[11px] font-black text-slate-900 leading-tight line-clamp-2 break-words">
                  {stepCaption(step)}
                </p>
                <p
                  className={cn('mt-0.5 w-full truncate text-[10px] font-bold', !isActive && 'text-slate-400')}
                  style={isActive ? { color: TEAL } : undefined}
                >
                  <span data-testid="plan-step-status">{step.statusLabel || (isActive ? 'Jarayonda' : 'Kutilmoqda')}</span>
                </p>
              </div>
              {!isLast && (
                <div className="w-4 shrink-0 pt-4" aria-hidden>
                  <div className="h-0.5 w-full rounded-full bg-slate-200" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Plan stepper. Each treatment plan is its own section. Finished steps stay
 * behind a "Bajarilgan" toggle so the row only shows what is still ahead.
 */
export default function TodayPlanBar({
  steps = [],
  groups = null,
  title = 'Bugungi reja',
  totalDebt = 0,
  planRemaining = 0,
  onPay,
  onNextClinical,
  onAdvanceStep,
  onOpenPlan,
  part = 'all',
}) {
  const planGroups = useMemo(() => {
    if (Array.isArray(groups) && groups.length) return groups;
    if (Array.isArray(groups)) return [];
    if (!steps.length) return [];
    return [{ id: 'all', title, steps }];
  }, [groups, steps, title]);

  const [selectedId, setSelectedId] = useState(planGroups[0]?.id || null);
  const [doneOpen, setDoneOpen] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  // Steps started from the "Keyingi" button. Shown as "Jarayonda" right away, before the plan reloads.
  const [startedIds, setStartedIds] = useState(() => new Set());
  const [focusId, setFocusId] = useState(null);

  useEffect(() => {
    if (!planGroups.some((group) => group.id === selectedId)) {
      setSelectedId(planGroups[0]?.id || null);
      setDoneOpen(false);
    }
  }, [planGroups, selectedId]);

  const selected = planGroups.find((group) => group.id === selectedId) || planGroups[0] || null;
  const progress = groupProgress(selected);
  const doneSteps = (selected?.steps || []).filter((step) => step.state === 'done');
  // A saved plan step only looks "Jarayonda" when it really is In Progress (or was just started here).
  // Before, the first waiting step was drawn as active already, so "Keyingi" changed nothing on screen.
  const displaySteps = (selected?.steps || []).map((step) => {
    if (step.planId == null || step.rawState !== 'pending') return step;
    const state = startedIds.has(step.id) ? 'active' : 'pending';
    return state === step.state ? step : { ...step, state };
  });
  const activeStep = (selected?.steps || []).find((step) => step.state === 'active')
    || (selected?.steps || []).find((step) => step.state === 'pending')
    || null;

  const payTarget = Number(planRemaining) > 0
    ? Number(planRemaining)
    : Number(totalDebt) > 0
      ? Number(totalDebt)
      : 0;
  const remainingLabel = Number(planRemaining) > 0
    ? 'Reja qoldig\'i'
    : Number(totalDebt) > 0
      ? 'Qarz'
      : "Qarz yo'q";
  const badge = progress.total > 0 ? `${progress.done}/${progress.total}` : "Reja yo'q";

  const stepperCard = (
      <div data-plan-stepper="true" className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.06)] px-4 sm:px-5 py-3.5 min-w-0">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <CalendarDays className="w-4 h-4 shrink-0" style={{ color: TEAL }} />
            <h3 className="text-sm font-black text-slate-900 truncate">{title}</h3>
          </div>
          <span className={cn(
            'px-2.5 py-1 rounded-full text-[10px] font-black border shrink-0',
            progress.total > 0 && progress.done === progress.total
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : progress.total > 0
                ? 'bg-teal-50 text-teal-800 border-teal-200'
                : 'bg-slate-100 text-slate-600 border-slate-200'
          )}>
            {progress.total > 0 ? `${badge} bajarilgan` : badge}
          </span>
        </div>

        {planGroups.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-4 text-center space-y-3">
            <div>
              <p className="text-xs font-semibold text-slate-400">Bugun uchun reja topilmadi</p>
              <p className="text-[10px] text-slate-400 mt-1">Faol davolash rejalari yoki bugungi uchrashuvlar shu yerda ko&apos;rinadi</p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {typeof onOpenPlan === 'function' && (
                <button
                  type="button"
                  onClick={onOpenPlan}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-wide cursor-pointer hover:bg-slate-800"
                >
                  <ClipboardList className="w-3.5 h-3.5" />
                  Yangi reja
                </button>
              )}
              {typeof onNextClinical === 'function' && (
                <button
                  type="button"
                  onClick={() => onNextClinical(null)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 border-teal-500/70 text-teal-800 bg-teal-50 text-[10px] font-black uppercase tracking-wide cursor-pointer hover:bg-teal-100"
                >
                  <Stethoscope className="w-3.5 h-3.5" />
                  Tashxis / RVG
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {planGroups.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2 mb-1" data-testid="plan-stepper-tabs">
                {planGroups.map((group) => {
                  const item = groupProgress(group);
                  const on = group.id === selected?.id;
                  return (
                    <button
                      key={group.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => { setSelectedId(group.id); setDoneOpen(false); }}
                      className={cn(
                        'shrink-0 max-w-[180px] rounded-xl border px-3 py-1.5 text-left cursor-pointer',
                        on ? 'border-teal-300 bg-teal-50' : 'border-slate-200 bg-white hover:bg-slate-50'
                      )}
                    >
                      <span className="block truncate text-xs font-black text-slate-900">{group.title}</span>
                      <span className={cn('text-[10px] font-bold', on ? 'text-teal-800' : 'text-slate-500')}>
                        {item.done}/{item.total}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {planGroups.length === 1 && selected?.title && selected.title !== title && (
              <p className="mb-2 text-xs font-black text-slate-700 truncate">{selected.title}</p>
            )}

            <StepTrack steps={displaySteps} focusId={focusId} />

            {doneSteps.length > 0 && (
              <div className="mt-2">
                <button
                  type="button"
                  data-testid="plan-done-toggle"
                  aria-expanded={doneOpen}
                  onClick={() => setDoneOpen((open) => !open)}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-black text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" strokeWidth={3} />
                  Bajarilgan: {doneSteps.length}
                  <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', doneOpen && 'rotate-180')} />
                </button>
                {doneOpen && (
                  <ul className="mt-1.5 flex flex-wrap gap-1.5" data-testid="plan-done-list">
                    {doneSteps.map((step) => (
                      <li
                        key={step.id}
                        className="max-w-full truncate rounded-full border border-emerald-100 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-800"
                      >
                        {step.number}. {stepCaption(step)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
              {typeof onNextClinical === 'function' && (() => {
                const planSteps = (selected?.steps || []).filter((step) => step.planId != null);
                if (typeof onAdvanceStep === 'function' && planSteps.length > 0) {
                  const nextStep = planSteps.find((step) => step.rawState === 'pending' && !startedIds.has(step.id));
                  if (!nextStep) {
                    const allDone = planSteps.every((step) => step.state === 'done');
                    return (
                      <button
                        type="button"
                        disabled
                        data-testid="plan-next-step"
                        className="inline-flex max-w-full items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-200 text-slate-500 text-[11px] font-black cursor-not-allowed"
                      >
                        <Check className="w-3.5 h-3.5 shrink-0" strokeWidth={3} />
                        <span className="truncate">{allDone ? 'Reja yakunlangan' : 'Barcha bosqichlar jarayonda'}</span>
                      </button>
                    );
                  }
                  return (
                    <button
                      type="button"
                      data-testid="plan-next-step"
                      disabled={advancing}
                      onClick={async () => {
                        if (advancing) return;
                        setAdvancing(true);
                        let ok = false;
                        try {
                          ok = (await onAdvanceStep(nextStep)) !== false;
                        } finally {
                          setAdvancing(false);
                        }
                        if (!ok) return;
                        setStartedIds((prev) => new Set(prev).add(nextStep.id));
                        setFocusId(nextStep.id);
                        onNextClinical(nextStep, { advanced: true });
                      }}
                      className="inline-flex max-w-full items-center gap-1.5 px-3.5 py-2 rounded-xl text-white text-[11px] font-black shadow-sm cursor-pointer hover:opacity-95 disabled:opacity-60 disabled:cursor-wait"
                      style={{ backgroundColor: TEAL }}
                    >
                      <Stethoscope className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{`Keyingi: ${stepCaption(nextStep)}`}</span>
                    </button>
                  );
                }
                return (
                  <button
                    type="button"
                    onClick={() => {
                      toast.info(activeStep ? `Keyingi bosqich: ${stepCaption(activeStep)}` : "Tashxis / muolaja bo'limi");
                      onNextClinical(activeStep);
                    }}
                    className="inline-flex max-w-full items-center gap-1.5 px-3.5 py-2 rounded-xl text-white text-[11px] font-black shadow-sm cursor-pointer hover:opacity-95"
                    style={{ backgroundColor: TEAL }}
                  >
                    <Stethoscope className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">
                      {activeStep ? `Keyingi: ${stepCaption(activeStep)}` : 'Tashxis / muolaja'}
                    </span>
                  </button>
                );
              })()}
              {typeof onPay === 'function' && (
                <button
                  type="button"
                  onClick={onPay}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black shadow-sm cursor-pointer"
                >
                  To&apos;lov
                  {payTarget > 0 ? ` · ${formatCurrency(payTarget)}` : ''}
                  {' →'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
  );

  const payCard = (
      <div data-tez-tolov="true" className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.06)] px-4 py-3.5 flex flex-col justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Tez to&apos;lov</p>
          <p className={cn(
            'text-xl font-black font-mono leading-tight tracking-tight',
            payTarget > 0 ? 'text-slate-900' : 'text-slate-500'
          )}>
            {formatCurrency(payTarget || 0)}
          </p>
          <p className={cn(
            'text-[11px] font-bold mt-0.5',
            payTarget > 0 ? 'text-rose-600' : 'text-emerald-600'
          )}>
            {remainingLabel}
            {Number(planRemaining) > 0 && Number(totalDebt) > 0 && Number(planRemaining) !== Number(totalDebt)
              ? ` · Qarz: ${formatCurrency(totalDebt)}`
              : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={onPay}
          className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-sm active:scale-[0.98] transition-all cursor-pointer"
        >
          To&apos;lovga o&apos;tish →
        </button>
      </div>
  );

  if (part === 'stepper') return stepperCard;
  if (part === 'pay') return payCard;
  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_280px] gap-3">
      {stepperCard}
      {payCard}
    </div>
  );
}
