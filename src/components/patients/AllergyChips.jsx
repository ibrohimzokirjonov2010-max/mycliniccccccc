import { cn } from '@/lib/utils';

export const COMMON_ALLERGIES = ['Lidokain', 'Penitsillin', 'Lateks', 'Aspirin', 'Yod', 'Sulfanilamid'];

const tokens = (value) => String(value || '').split(/[,;]+/).map((s) => s.trim()).filter(Boolean);

/**
 * Quick-pick chips for the free-text "Muhim ma'lumot (Allergiya...)" field.
 * Clicking a chip only appends / removes that word in the same text — the text itself stays free
 * and is never rewritten into keywords.
 */
export default function AllergyChips({ value, onChange, disabled = false, className }) {
  const current = tokens(value);
  const has = (name) => current.some((token) => token.toLowerCase() === name.toLowerCase());

  const toggle = (name) => {
    if (has(name)) {
      onChange(current.filter((token) => token.toLowerCase() !== name.toLowerCase()).join(', '));
    } else {
      const base = String(value || '').trim().replace(/[,;]\s*$/, '');
      onChange(base ? `${base}, ${name}` : name);
    }
  };

  return (
    <div className={cn('flex flex-wrap gap-1.5 mt-1.5', className)} data-testid="allergy-chips">
      {COMMON_ALLERGIES.map((name) => {
        const on = has(name);
        return (
          <button
            key={name}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            onClick={() => toggle(name)}
            className={cn(
              'px-2.5 py-1 rounded-full border text-[11px] font-bold transition-colors cursor-pointer',
              on ? 'bg-rose-50 border-rose-300 text-rose-700' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
            )}
          >
            {on ? '✓ ' : '+ '}{name}
          </button>
        );
      })}
    </div>
  );
}
