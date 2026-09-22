import { memo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { getToothIllustrationSrcFromStatus } from '@/utils/toothIllustration';

export const FDI_UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
export const FDI_LOWER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

const STATUS_PIP = {
  caries: '#ef4444',
  cavity: '#ef4444',
  completed: '#3b82f6',
  filling: '#3b82f6',
  crown: '#eab308',
  implant: '#94a3b8',
  extracted: '#0f172a',
  missing: '#0f172a',
  in_progress: '#f59e0b',
  planned: '#6366f1',
  veneer: '#06b6d4',
};

export function fdiToInternalId(fdi) {
  const n = parseInt(fdi, 10);
  if (Number.isNaN(n)) return String(fdi || '').toLowerCase();
  if (n >= 11 && n <= 18) return `ur${n - 10}`;
  if (n >= 21 && n <= 28) return `ul${n - 20}`;
  if (n >= 31 && n <= 38) return `ll${n - 30}`;
  if (n >= 41 && n <= 48) return `lr${n - 40}`;
  if (n >= 51 && n <= 55) return `ur${n - 50}c`;
  if (n >= 61 && n <= 65) return `ul${n - 60}c`;
  if (n >= 71 && n <= 75) return `ll${n - 70}c`;
  if (n >= 81 && n <= 85) return `lr${n - 80}c`;
  return String(fdi).toLowerCase();
}

export function internalIdToFdi(id) {
  const match = String(id || '').match(/^(ur|ul|lr|ll)(\d+)(c)?$/);
  if (!match) return String(id || '');
  const [, quad, num, isChild] = match;
  if (isChild) {
    const qMap = { ur: 5, ul: 6, ll: 7, lr: 8 };
    return `${qMap[quad]}${num}`;
  }
  const qMap = { ur: 1, ul: 2, ll: 3, lr: 4 };
  return `${qMap[quad]}${num}`;
}

const ToothPill = memo(function ToothPill({ fdi, selected, statusKey, toothStatus, onSelect }) {
  const pip = statusKey && statusKey !== 'healthy' ? STATUS_PIP[statusKey] : null;
  const imgSrc = getToothIllustrationSrcFromStatus(fdi, toothStatus || { status: statusKey || 'healthy' });
  return (
    <button
      type="button"
      onClick={() => onSelect(fdi)}
      aria-pressed={selected}
      aria-label={`FDI ${fdi}`}
      className={cn(
        'odontogram-tooth odonto-fit-tooth relative z-10 flex flex-col items-center justify-end w-full min-w-0 rounded-xl text-[10px] font-black tabular-nums leading-none transition-transform active:scale-95 touch-manipulation overflow-hidden',
        selected
          ? 'bg-[#14b8a6] text-white shadow-[0_4px_10px_rgba(20,184,166,0.35)] z-20'
          : 'bg-white text-slate-600 border border-slate-200/90 shadow-[0_1px_2px_rgba(15,23,42,0.04)]'
      )}
    >
      {imgSrc && (
        <img
          src={imgSrc}
          alt=""
          draggable={false}
          className="absolute inset-x-0 top-0 h-[34px] w-full object-contain pointer-events-none"
          style={{ filter: selected ? 'brightness(1.05)' : undefined }}
        />
      )}
      {selected && (
        <span className="absolute top-[3px] left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-white/95 z-10" />
      )}
      {!selected && pip && (
        <span
          className="absolute top-[3px] left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full z-10"
          style={{ backgroundColor: pip }}
        />
      )}
      <span className="odontogram-fdi-label relative z-10 mt-auto mb-0.5 max-w-full">{fdi}</span>
    </button>
  );
});

/**
 * Compact FDI odontogram for ~390px phones.
 * Four rows of 8 (18–11, 21–28, 48–41, 31–38) so every label fits
 * without a hidden horizontal scrollbar. Wisdom teeth stay visible.
 */
export default function MobileCompactOdontogram({
  selectedFdi,
  toothStatuses = {},
  onSelect,
}) {
  const handleSelect = useCallback((fdi) => {
    if (onSelect) onSelect(String(fdi));
  }, [onSelect]);

  const renderQuadrant = (fdis) => (
    <div className="grid grid-cols-8 gap-0.5 w-full min-w-0">
      {fdis.map((fdi) => {
        const id = fdiToInternalId(fdi);
        const st = toothStatuses[id] || toothStatuses[String(fdi)];
        return (
          <ToothPill
            key={fdi}
            fdi={fdi}
            selected={String(selectedFdi) === String(fdi)}
            statusKey={st?.status}
            toothStatus={st}
            onSelect={handleSelect}
          />
        );
      })}
    </div>
  );

  return (
    <div className="w-full min-w-0 select-none touch-manipulation overflow-x-hidden">
      <div className="grid grid-cols-1 gap-1">
        {renderQuadrant(FDI_UPPER.slice(0, 8))}
        {renderQuadrant(FDI_UPPER.slice(8))}
      </div>
      <div className="h-px my-2 mx-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
      <div className="grid grid-cols-1 gap-1">
        {renderQuadrant(FDI_LOWER.slice(0, 8))}
        {renderQuadrant(FDI_LOWER.slice(8))}
      </div>
    </div>
  );
}
