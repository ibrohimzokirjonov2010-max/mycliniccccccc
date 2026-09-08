import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Bottom bar: Bugungi reja stepper + Tez to'lov card.
 */
export default function TodayPlanBar({
  steps = [],
  totalDebt = 0,
  onPay,
}) {
  const completed = steps.filter((s) => s.state === 'done').length;
  const total = steps.length || 0;
  const badge = total > 0 ? `${completed}/${total} bajarilgan` : 'Reja yo\'q';

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-3">
      {/* Bugungi reja */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm px-4 py-3.5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className="text-sm font-black text-slate-900">Bugungi reja</h3>
          <span className={cn(
            'px-2.5 py-1 rounded-full text-[10px] font-black',
            total > 0 && completed === total
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-slate-100 text-slate-600 border border-slate-200'
          )}>
            {badge}
          </span>
        </div>

        {steps.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-5 text-center">
            <p className="text-xs font-semibold text-slate-400">Bugun uchun reja topilmadi</p>
            <p className="text-[10px] text-slate-400 mt-1">Faol davolash rejalari yoki bugungi uchrashuvlar shu yerda ko&apos;rinadi</p>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-stretch gap-2 sm:gap-0">
            {steps.map((step, idx) => {
              const isDone = step.state === 'done';
              const isActive = step.state === 'active';
              const isLast = idx === steps.length - 1;
              return (
                <div key={step.id || idx} className="flex sm:flex-1 items-start sm:items-center gap-2 min-w-0">
                  <div className={cn(
                    'flex items-start gap-2.5 rounded-xl border px-3 py-2.5 flex-1 min-w-0',
                    isDone && 'bg-emerald-50/80 border-emerald-200',
                    isActive && 'bg-cyan-50/80 border-[#1499AD]/50 ring-1 ring-[#1499AD]/20',
                    !isDone && !isActive && 'bg-slate-50 border-slate-200'
                  )}>
                    <div className={cn(
                      'w-7 h-7 rounded-full flex items-center justify-center shrink-0',
                      isDone && 'bg-emerald-500 text-white',
                      isActive && 'bg-[#1499AD] text-white',
                      !isDone && !isActive && 'bg-white border border-slate-300 text-slate-400'
                    )}>
                      {isDone ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : (
                        <span className="text-[11px] font-black">{idx + 1}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-slate-900 truncate leading-snug">
                        {step.title}
                        {step.tooth ? ` (#${step.tooth})` : ''}
                      </p>
                      <p className={cn(
                        'text-[10px] font-bold mt-0.5',
                        isDone && 'text-emerald-600',
                        isActive && 'text-[#1499AD]',
                        !isDone && !isActive && 'text-slate-400'
                      )}>
                        {isDone ? 'Bajarildi' : isActive ? 'Jarayonda' : 'Kutilmoqda'}
                      </p>
                    </div>
                  </div>
                  {!isLast && (
                    <div className="hidden sm:block w-4 shrink-0 self-center">
                      <div className="h-0.5 w-full bg-slate-200 rounded-full" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tez to'lov */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm px-4 py-3.5 flex flex-col justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Tez to&apos;lov</p>
          <p className={cn(
            'text-xl font-black font-mono leading-tight',
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
