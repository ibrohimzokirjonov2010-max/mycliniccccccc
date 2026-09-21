import { Fragment } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getToothIllustrationSrc } from '@/utils/toothIllustration';

/** Dentist view, straight rows — not an arch. */
const UPPER_FDI = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_FDI = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

function WizardTooth({ fdi, selected, active, onClick }) {
  return (
    <button
      type="button"
      onClick={() => onClick(String(fdi))}
      className="odontogram-tooth compact-hit implant-wizard-tooth-btn flex flex-col items-center gap-0.5 bg-transparent border-0 p-0 cursor-pointer group"
      title={`#${fdi}`}
      aria-pressed={selected}
      aria-current={active ? 'true' : undefined}
      aria-label={`#${fdi}`}
      data-fdi={fdi}
    >
      <span
        className={cn(
          'implant-wizard-tooth-face relative flex items-center justify-center w-[32px] h-[40px] rounded-[10px] border transition-all duration-150',
          active && 'is-active',
          selected
            ? 'bg-[#0d9488] border-[#0f766e] shadow-sm text-white'
            : 'bg-[#f4efe6] border-[#e4d9c8] text-[#c4b8a4] group-hover:border-[#0d9488]/50 group-hover:bg-[#f0fdfa]'
        )}
      >
        {selected && (
          <Check className="absolute top-0.5 right-0.5 z-10 w-2.5 h-2.5 text-white drop-shadow" strokeWidth={3} />
        )}
        <img
          src={getToothIllustrationSrc(fdi, selected ? 'implant' : 'healthy')}
          alt=""
          draggable={false}
          className="implant-wizard-tooth-img w-[20px] h-[32px] object-contain pointer-events-none"
        />
      </span>
      <span className={cn(
        'implant-wizard-tooth-fdi text-[10px] font-semibold tabular-nums leading-none',
        selected ? 'text-[#0d9488]' : 'text-[#6b7280]'
      )}>
        {fdi}
      </span>
    </button>
  );
}

function LinearRow({ teeth, selectedSet, activeFdi, onToggle, variant }) {
  const isUpper = variant === 'upper';
  return (
    <div
      className={cn('implant-wizard-arch-row', isUpper ? 'is-upper' : 'is-lower')}
      role="group"
      aria-label={isUpper ? 'Upper teeth' : 'Lower teeth'}
    >
      {teeth.map((fdi, i) => (
        <Fragment key={fdi}>
          {i === 8 && <span className="implant-wizard-arch-midline" aria-hidden />}
          <div className="implant-wizard-tooth-slot">
            <WizardTooth
              fdi={fdi}
              selected={selectedSet.has(String(fdi))}
              active={String(activeFdi || '') === String(fdi)}
              onClick={onToggle}
            />
          </div>
        </Fragment>
      ))}
    </div>
  );
}

/**
 * Linear two-row FDI strip for the New Implant wizard.
 * Upper 18→28 and lower 48→38 sit on straight horizontal lines.
 * Dizyner PNGs are already oriented (upper roots up, lower roots down).
 */
export default function ImplantWizardArch({ selectedFdis = [], activeFdi = '', onToggle, scrollHint }) {
  const selectedSet = new Set((selectedFdis || []).map(String));

  return (
    <div
      className="implant-wizard-arch w-full select-none py-1"
      data-testid="implant-wizard-arch"
      data-layout="linear"
    >
      <div className="implant-wizard-arch-scroll">
        <div className="implant-wizard-arch-rows">
          <LinearRow teeth={UPPER_FDI} selectedSet={selectedSet} activeFdi={activeFdi} onToggle={onToggle} variant="upper" />
          <LinearRow teeth={LOWER_FDI} selectedSet={selectedSet} activeFdi={activeFdi} onToggle={onToggle} variant="lower" />
        </div>
      </div>
      {scrollHint ? (
        <p className="implant-wizard-scroll-hint">{scrollHint}</p>
      ) : null}
    </div>
  );
}

export { UPPER_FDI, LOWER_FDI };
