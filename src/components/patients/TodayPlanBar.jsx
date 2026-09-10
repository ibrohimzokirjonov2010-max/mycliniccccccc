import { Check, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';

const TEAL = '#14b8a6';

/**
 * Bottom bar: Bugungi reja horizontal stepper + Tez to'lov card.
 * Mockup: check → active teal → pending grey circles with connectors (not tall cards).
 */
export default function TodayPlanBar({
  steps = [],
  totalDebt = 0,
  onPay,
}) {
  const completed = steps.filter((s) => s.state === 'done').length;
  const total = steps.length || 0;
  const badge = total > 0 ? `${completed}/${total}` : "Reja yo'q";

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_260px] gap-3">
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.06)] px-4 sm:px-5 py-3.5">
        <div className="flex items-center justify-between gap-3 mb-3.5">
          <div className="flex items-center gap-2 min-w-0">
            <CalendarDays className="w-4 h-4 shrink-0" style={{ color: TEAL }} />
            <h3 className="text-sm font-black text-slate-900 truncate">Bugungi reja</h3>
          </div>
          <span className={cn(
            'px-2.5 py-1 rounded-full text-[10px] font-black border shrink-0',
            total > 0 && completed === total
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : total > 0
                ? 'bg-teal-50 text-teal-800 border-teal-200'
                : 'bg-slate-100 text-slate-600 border-slate-200'
          )}>
            {total > 0 ? `${badge} bajarilgan` : badge}
          </span>
        </div>

        {steps.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-4 text-center">
            <p className="text-xs font-semibold text-slate-400">Bugun uchun reja topilmadi</p>
            <p className="text-[10px] text-slate-400 mt-1">Faol davolash rejalari yoki bugungi uchrashuvlar shu yerda ko&apos;rinadi</p>
          </div>
        ) : (
          <div className="flex items-start w-full overflow-x-auto no-scrollbar pb-0.5">
            {steps.map((step, idx) => {
              const isDone = step.state === 'done';
              const isActive = step.state === 'active';
              const isLast = idx === steps.length - 1;
              return (
                <div key={step.id || idx} className={cn('flex items-start min-w-0', !isLast ? 'flex-1' : 'shrink-0')}>
                  <div className="flex flex-col items-center text-center px-1 sm:px-2 min-w-[96px] max-w-[160px]">
                    <div
                      className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all',
                        isDone && 'bg-emerald-500 text-white shadow-sm',
                        isActive && 'text-white shadow-md ring-4 ring-teal-100',
                        !isDone && !isActive && 'bg-white border-2 border-slate-300 text-slate-400'
                      )}
                      style={isActive ? { backgroundColor: TEAL } : undefined}
                    >
                      {isDone ? (
                        <Check className="w-4 h-4" strokeWidth={3} />
                      ) : (
                        <span className="text-[12px] font-black leading-none">{idx + 1}</span>
                      )}
                    </div>
                    <p className="mt-2 text-[11px] sm:text-xs font-black text-slate-900 leading-snug line-clamp-2">
                      {step.title}
                      {step.tooth ? ` (#${step.tooth})` : ''}
                    </p>
                    <p
                      className={cn(
                        'text-[10px] font-bold mt-0.5',
                        isDone && 'text-emerald-600',
                        !isDone && !isActive && 'text-slate-400'
                      )}
                      style={isActive ? { color: TEAL } : undefined}
                    >
                      {isDone ? 'Bajarildi' : isActive ? 'Jarayonda' : 'Kutilmoqda'}
                    </p>
                  </div>
                  {!isLast && (
                    <div className="flex-1 min-w-[20px] max-w-[64px] pt-4 px-0.5">
                      <div
                        className={cn(
                          'h-0.5 w-full rounded-full',
                          isDone ? 'bg-emerald-400' : 'bg-slate-200'
                        )}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.06)] px-4 py-3.5 flex flex-col justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Tez to&apos;lov</p>
          <p className={cn(
            'text-xl font-black font-mono leading-tight tracking-tight',
            totalDebt > 0 ? 'text-slate-900' : 'text-slate-500'
          )}>
            {Number(totalDebt || 0).toLocaleString('uz-UZ')} <span className="text-xs font-black">UZS</span>
          </p>
          {totalDebt > 0 ? (
            <p className="text-[11px] font-bold text-rose-600 mt-0.5">Qarzni to&apos;lash</p>
          ) : (
            <p className="text-[11px] font-bold text-emerald-600 mt-0.5">Qarz yo&apos;q</p>
          )}
        </div>
        <button
          type="button"
          onClick={onPay}
          className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-sm active:scale-[0.98] transition-all cursor-pointer"
        >
          To&apos;lovga o&apos;tish →
        </button>
      </div>
    </div>
  );
}
