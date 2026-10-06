import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { priceForJawService } from '@/lib/jawServices';

const OPTIONS = [
  { id: 'upper', label: "Tepa jag'" },
  { id: 'lower', label: "Pastki jag'" },
  { id: 'both', label: 'Ikkalasi' },
];

const fmt = (n) => `${Math.round(Number(n) || 0).toLocaleString('ru-RU').replace(/[\s,\u00a0\u202f]/g, ' ')} so'm`;

/**
 * jaw-choice-popup-v2: one centred popup over the open modal.
 * Portalled into the nearest dialog (so Radix does not treat a click as
 * "outside" and close the wizard) or into <body> when there is no dialog.
 * One click on a jaw adds the service; every caller then clears the prompt.
 */
export default function JawChoice({ title, preset, busy = false, onChoose, onClose, family, services }) {
  const anchorRef = useRef(null);
  const [host, setHost] = useState(null);

  // Some screens render a desktop and a phone layout at once (one hidden by
  // CSS). Only the copy whose anchor is actually laid out shows the popup.
  useLayoutEffect(() => {
    const pick = () => {
      const el = anchorRef.current;
      const parent = el?.parentElement;
      const shown = !!parent && parent.getClientRects().length > 0;
      if (!shown) { setHost(null); return; }
      const dialog = el.closest('[role="dialog"]');
      setHost(dialog || document.body);
    };
    pick();
    window.addEventListener('resize', pick);
    return () => window.removeEventListener('resize', pick);
  }, []);

  useEffect(() => {
    if (!onClose) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      e.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const priceOf = (jaw) => (family && Array.isArray(services) ? priceForJawService(services, family, jaw) : 0);
  const prices = { upper: priceOf('upper'), lower: priceOf('lower') };
  prices.both = prices.upper + prices.lower;

  const popup = (
    <div
      data-jaw-choice-overlay="true"
      className="fixed inset-0 z-[2147482000] flex items-center justify-center bg-slate-900/45 p-4"
      style={{ pointerEvents: 'auto' }}
      onMouseDown={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget && onClose) onClose();
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        data-jaw-choice="true"
        role="group"
        aria-label="Jag' tanlash"
        className="relative w-full max-w-md rounded-2xl border border-pink-200 bg-white p-5 shadow-2xl"
      >
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Yopish"
            data-jaw-close="true"
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <p className="pr-10 text-lg font-extrabold text-slate-900">{title}</p>
        <p className="mb-4 mt-0.5 text-sm font-semibold text-slate-500">Qaysi jag'?</p>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              data-jaw={option.id}
              disabled={busy}
              aria-pressed={preset === option.id}
              onClick={() => onChoose(option.id)}
              className={cn(
                'flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-xl px-2 py-3 text-base font-extrabold transition disabled:opacity-50',
                preset === option.id
                  ? 'bg-pink-600 text-white shadow-md hover:bg-pink-700'
                  : 'border-2 border-slate-200 bg-white text-slate-800 hover:border-pink-300 hover:bg-pink-50',
              )}
            >
              <span>{option.label}</span>
              {prices[option.id] > 0 && (
                <span className={cn('text-xs font-bold', preset === option.id ? 'text-pink-100' : 'text-emerald-600')}>
                  {option.id === 'both' ? '+' : ''}{fmt(prices[option.id])}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <span ref={anchorRef} data-jaw-choice-anchor="true" hidden />
      {host ? createPortal(popup, host) : null}
    </>
  );
}
