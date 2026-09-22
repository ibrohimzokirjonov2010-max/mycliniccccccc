import { memo, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { getToothIllustrationSrcFromStatus, resolveToothIllustrationKind } from '@/utils/toothIllustration';

export const FDI_UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
export const FDI_LOWER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

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

const ToothCell = memo(function ToothCell({ fdi, selected, focused, toothStatus, onSelect, isUpper }) {
  const status = toothStatus || { status: 'healthy' };
  const kind = resolveToothIllustrationKind(status);
  const imgSrc = getToothIllustrationSrcFromStatus(fdi, status);
  return (
    <button
      type="button"
      onClick={() => onSelect(fdi)}
      aria-pressed={selected}
      aria-label={`FDI ${fdi}`}
      data-fdi={fdi}
      data-illustration={kind}
      className={cn(
        'odontogram-tooth odonto-fit-tooth relative flex flex-col items-center w-full min-w-0 bg-transparent p-0 border-0 cursor-pointer touch-manipulation',
        isUpper ? 'justify-end' : 'justify-start',
        selected && 'z-10',
        focused && 'ring-2 ring-[#0d9488] rounded-md'
      )}
    >
      {!isUpper && (
        <span className={cn(
          'odontogram-fdi-label mb-0.5 w-full text-center font-black tabular-nums rounded-sm border',
          selected ? 'bg-[#14b8a6] text-white border-transparent' : 'text-slate-700 bg-white border-slate-200/80'
        )}>{fdi}</span>
      )}
      <span className={cn('odonto-lateral relative flex w-full min-w-0 justify-center', isUpper ? 'items-end' : 'items-start')}>
        {imgSrc && (
          <img
            src={imgSrc}
            alt=""
            draggable={false}
            className="w-full h-full object-contain pointer-events-none"
            style={{ objectPosition: isUpper ? 'center bottom' : 'center top' }}
          />
        )}
        {selected && (
          <span
            className="absolute left-0.5 right-0.5 h-[3px] rounded-full bg-[#14b8a6] pointer-events-none"
            style={{ [isUpper ? 'bottom' : 'top']: 1 }}
          />
        )}
      </span>
      {isUpper && (
        <span className={cn(
          'odontogram-fdi-label mt-0.5 w-full text-center font-black tabular-nums rounded-sm border',
          selected ? 'bg-[#14b8a6] text-white border-transparent' : 'text-slate-700 bg-white border-slate-200/80'
        )}>{fdi}</span>
      )}
    </button>
  );
});

/**
 * Phone patient-profile chart. Same FDI cross as the desktop card
 * (18→11 | 21→28 over 48→41 | 31→38), sized to the card so ~390px
 * has no horizontal slider.
 */
export default function MobileCompactOdontogram({
  selectedFdi,
  selectedFdis,
  toothStatuses = {},
  onSelect,
}) {
  const handleSelect = useCallback((fdi) => {
    if (onSelect) onSelect(String(fdi));
  }, [onSelect]);

  const selectedSet = useMemo(() => {
    const ids = new Set((selectedFdis || []).map((value) => String(value)));
    if (selectedFdi != null && selectedFdi !== '') ids.add(String(selectedFdi));
    return ids;
  }, [selectedFdi, selectedFdis]);

  const focusedFdi = selectedFdi != null && selectedFdi !== '' ? String(selectedFdi) : '';

  const renderHalf = (fdis, isUpper) => (
    <div
      className="odonto-quad"
      data-label={fdis.length ? `${fdis[0]}–${fdis[fdis.length - 1]}` : undefined}
      style={{ gridTemplateColumns: `repeat(${fdis.length}, minmax(0, 1fr))` }}
    >
      {fdis.map((fdi) => {
        const id = fdiToInternalId(fdi);
        const st = toothStatuses[id] || toothStatuses[String(fdi)];
        return (
          <ToothCell
            key={fdi}
            fdi={fdi}
            isUpper={isUpper}
            selected={selectedSet.has(String(fdi))}
            focused={focusedFdi === String(fdi) && selectedSet.size > 1}
            toothStatus={st}
            onSelect={handleSelect}
          />
        );
      })}
    </div>
  );

  return (
    <div className="odonto-fit-frame w-full min-w-0 select-none" data-compact="false" data-odonto-layout="cross">
      <div className="odonto-cross">
        <div className="odonto-jaw odonto-jaw-upper">
          {renderHalf(FDI_UPPER.slice(0, 8), true)}
          <div className="odonto-midline" aria-hidden="true" />
          {renderHalf(FDI_UPPER.slice(8), true)}
        </div>
        <div className="odonto-bite-line" aria-hidden="true" />
        <div className="odonto-jaw odonto-jaw-lower">
          {renderHalf(FDI_LOWER.slice(0, 8), false)}
          <div className="odonto-midline" aria-hidden="true" />
          {renderHalf(FDI_LOWER.slice(8), false)}
        </div>
      </div>
    </div>
  );
}
