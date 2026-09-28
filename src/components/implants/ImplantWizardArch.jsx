import { Fragment } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import './implantWizard.css';
import { fdiCrownDown, fdiLengthWeight, fdiLowerImageFlip, fdiWidthWeight } from '@/lib/fdiNotation';
import { getToothIllustrationSrc } from '@/utils/toothIllustration';

/** Dentist view, straight rows — not an arch. */
const UPPER_FDI = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_FDI = [38, 37, 36, 35, 34, 33, 32, 31, 41, 42, 43, 44, 45, 46, 47, 48];

function WizardTooth({ fdi, selected, active, onClick }) {
  const crownDown = fdiCrownDown(fdi);
  return (
    <button
      type="button"
      onClick={() => onClick(String(fdi))}
      className="odontogram-tooth compact-hit implant-wizard-tooth-btn flex w-full flex-col items-center gap-0 bg-transparent border-0 p-0 cursor-pointer group"
      title={`#${fdi}`}
      aria-pressed={selected}
      aria-current={active ? 'true' : undefined}
      aria-label={`#${fdi}`}
      data-fdi={fdi}
    >
      <span
        className={cn(
          'implant-wizard-tooth-face relative flex w-full justify-center rounded-[10px] border transition-all duration-150 overflow-hidden',
          crownDown ? 'items-end' : 'items-start',
          active && 'is-active',
          selected
            ? 'bg-[#0d9488] border-[#0f766e] shadow-sm text-white'
            : 'bg-[#f4efe6] border-[#e4d9c8] text-[#c4b8a4] group-hover:border-[#0d9488]/50 group-hover:bg-[#f0fdfa]'
        )}
        style={{ height: `calc(48px * ${fdiLengthWeight(fdi)})` }}
      >
        {selected && (
          <Check className="absolute top-0.5 right-0.5 z-10 w-2.5 h-2.5 text-white drop-shadow" strokeWidth={3} />
        )}
        <img
          src={getToothIllustrationSrc(fdi, selected ? 'implant' : 'healthy')}
          alt=""
          draggable={false}
          className="tooth-illus implant-wizard-tooth-img w-full h-[94%] max-w-full max-h-full object-contain pointer-events-none"
          style={{
            objectPosition: crownDown ? 'center bottom' : 'center top',
            transform: fdiLowerImageFlip(fdi) ? 'scaleX(-1)' : undefined,
          }}
        />
        <span className={cn(
          'fdi-on-crown implant-wizard-tooth-fdi',
          crownDown ? 'is-upper' : 'is-lower',
          selected ? 'text-white' : 'text-[#111827]'
        )} style={selected ? { color: '#fff', textShadow: '0 0 2px #0f766e' } : undefined}>
          {fdi}
        </span>
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
      style={{ display: 'flex', flexWrap: 'nowrap', transform: 'none' }}
    >
      {teeth.map((fdi, i) => (
        <Fragment key={fdi}>
          {i === 8 && <span className="implant-wizard-arch-midline" aria-hidden />}
          <div
            className="implant-wizard-tooth-slot"
            style={{ '--fdi-w': fdiWidthWeight(fdi), transform: 'none' }}
          >
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
 * Upper 18→28 and lower 38→48 sit on straight horizontal lines.
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
        <div className="implant-wizard-arch-rows" style={{ display: 'flex', flexDirection: 'column', transform: 'none' }}>
          <div className="odonto-jaw-band">
            <span className="odonto-side odonto-side-r">O‘NG</span>
            <span className="odonto-side odonto-side-l">CHAP</span>
            <LinearRow teeth={UPPER_FDI} selectedSet={selectedSet} activeFdi={activeFdi} onToggle={onToggle} variant="upper" />
          </div>
          <div className="implant-wizard-bite" aria-hidden="true" />
          <div className="odonto-jaw-band">
            <span className="odonto-side odonto-side-r">CHAP</span>
            <span className="odonto-side odonto-side-l">O‘NG</span>
            <LinearRow teeth={LOWER_FDI} selectedSet={selectedSet} activeFdi={activeFdi} onToggle={onToggle} variant="lower" />
          </div>
        </div>
      </div>
      {scrollHint ? (
        <p className="implant-wizard-scroll-hint">{scrollHint}</p>
      ) : null}
    </div>
  );
}

export { UPPER_FDI, LOWER_FDI };
