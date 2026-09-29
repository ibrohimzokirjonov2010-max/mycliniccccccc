import { cn } from '@/lib/utils';

const OPTIONS = [
  { id: 'upper', label: "Tepa jag'" },
  { id: 'lower', label: "Pastki jag'" },
  { id: 'both', label: 'Ikkalasi' },
];

export default function JawChoice({ title, preset, busy = false, onChoose, onClose }) {
  return (
    <div
      data-jaw-choice="true"
      role="group"
      aria-label="Jag' tanlash"
      className="rounded-xl border border-pink-200 bg-pink-50 p-2"
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-xs font-extrabold text-slate-900">{title}</p>
        {onClose && (
          <button type="button" onClick={onClose} className="text-xs font-bold text-slate-500" aria-label="Yopish">
            Yopish
          </button>
        )}
      </div>
      <p className="mb-1.5 text-[11px] font-semibold text-slate-600">Qaysi jag'?</p>
      <div className="grid grid-cols-3 gap-1.5">
        {OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            data-jaw={option.id}
            disabled={busy}
            aria-pressed={preset === option.id}
            onClick={() => onChoose(option.id)}
            className={cn(
              'min-h-10 rounded-lg px-1 text-[11px] font-extrabold disabled:opacity-50',
              preset === option.id
                ? 'bg-pink-600 text-white'
                : 'border border-slate-200 bg-white text-slate-800',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
