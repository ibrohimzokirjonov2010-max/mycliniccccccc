import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { priceForJawService } from '@/lib/jawServices';

const OPTIONS = [
  { id: 'upper', label: "Tepa jag'" },
  { id: 'lower', label: "Pastki jag'" },
  { id: 'both', label: 'Ikkalasi' },
];

const fmt = (n) => Math.round(Number(n) || 0).toLocaleString('ru-RU').replace(/[\s,\u00a0\u202f]/g, ' ');

/**
 * jaw-choice-popup-v3: the chooser is a centred popup over the open modal
 * (same colours/fonts as the old inline card). Portalled into the nearest
 * dialog so Radix does not treat a click as "outside", or into <body>.
 * One click on a jaw calls onChoose; every caller then clears the prompt.
 */
export default function JawChoice({ title, preset, busy = false, onChoose, onClose, family, services }) {
  const anchorRef = useRef(null);
  const [host, setHost] = useState(null);

  // Some screens render desktop + phone layouts at once (one hidden by CSS):
  // only the copy whose anchor is laid out opens the popup.
  useLayoutEffect(() => {
    const pick = () => {
      const el = anchorRef.current;
      const parent = el?.parentElement;
      if (!parent || parent.getClientRects().length === 0) { setHost(null); return; }
      setHost(el.closest('[role="dialog"]') || document.body);
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
      className="fixed inset-0 z-[2147482000] flex items-center justify-center bg-slate-900/40 p-4"
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
        className="w-full max-w-sm rounded-xl border border-pink-200 bg-pink-50 p-3 shadow-xl"
      >
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="text-sm font-extrabold text-slate-900">{title}</p>
          {onClose && (
            <button type="button" onClick={onClose} className="text-xs font-bold text-slate-500" aria-label="Yopish">
              Yopish
            </button>
          )}
        </div>
        <p className="mb-2 text-xs font-semibold text-slate-600">Qaysi jag'?</p>
        <div className="grid grid-cols-3 gap-2">
          {OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              data-jaw={option.id}
              disabled={busy}
              aria-pressed={preset === option.id}
              onClick={() => onChoose(option.id)}
              className={cn(
                'flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-xs font-extrabold disabled:opacity-50',
                preset === option.id
                  ? 'bg-pink-600 text-white'
                  : 'border border-slate-200 bg-white text-slate-800',
              )}
            >
              <span>{option.label}</span>
              {prices[option.id] > 0 && (
                <span className={cn('text-[10px] font-bold', preset === option.id ? 'text-pink-100' : 'text-slate-500')}>
                  +{fmt(prices[option.id])}
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
