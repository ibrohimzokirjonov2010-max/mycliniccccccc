import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getToothIllustrationSrc } from '@/utils/toothIllustration';

const UPPER_FDI = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_FDI = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

function archT(index, count) {
  return count <= 1 ? 0 : (index / (count - 1)) * 2 - 1;
}

function WizardTooth({ fdi, selected, onClick, numberPosition }) {
  return (
    <button
      type="button"
      onClick={() => onClick(String(fdi))}
      className="odontogram-tooth compact-hit flex flex-col items-center gap-0.5 bg-transparent border-0 p-0 cursor-pointer group"
      title={`#${fdi}`}
    >
      {numberPosition === 'top' && (
        <span className={cn(
          'text-[10px] font-semibold tabular-nums leading-none',
          selected ? 'text-[#0d9488]' : 'text-[#9ca3af]'
        )}>
          {fdi}
        </span>
      )}
      <span
        className={cn(
          'relative flex items-center justify-center w-[30px] h-[36px] rounded-[11px] border transition-all duration-150',
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
          className="w-[22px] h-[28px] object-contain pointer-events-none"
        />
      </span>
      {numberPosition === 'bottom' && (
        <span className={cn(
          'text-[10px] font-semibold tabular-nums leading-none',
          selected ? 'text-[#0d9488]' : 'text-[#9ca3af]'
        )}>
          {fdi}
        </span>
      )}
    </button>
  );
}

function ArchRow({ teeth, selectedSet, onToggle, variant }) {
  const isUpper = variant === 'upper';
  return (
    <div className="relative flex items-end justify-center w-full">
      <div
        className={cn(
          'absolute left-[8%] right-[8%] border-[#e5e7eb]/80 pointer-events-none',
          isUpper ? 'top-[22px] border-t rounded-t-full h-10' : 'bottom-[22px] border-b rounded-b-full h-10'
        )}
      />
      {teeth.map((fdi, i) => {
        const t = archT(i, teeth.length);
        const lift = (1 - t * t) * 22;
        const rotate = (isUpper ? t : -t) * 18;
        return (
          <div
            key={fdi}
            className="relative z-[1] mx-[1px] sm:mx-[2px]"
            style={{
              transform: `translateY(${isUpper ? -lift : lift}px) rotate(${rotate}deg)`,
            }}
          >
            <WizardTooth
              fdi={fdi}
              selected={selectedSet.has(String(fdi))}
              onClick={onToggle}
              numberPosition={isUpper ? 'top' : 'bottom'}
            />
          </div>
        );
      })}
    </div>
  );
}

/**
 * Compact two-arch FDI odontogram for the New Implant wizard.
 */
export default function ImplantWizardArch({ selectedFdis = [], onToggle }) {
  const selectedSet = new Set((selectedFdis || []).map(String));

  return (
    <div className="w-full select-none py-1">
      <div className="h-[118px] flex items-start justify-center overflow-visible">
        <ArchRow teeth={UPPER_FDI} selectedSet={selectedSet} onToggle={onToggle} variant="upper" />
      </div>
      <div className="h-[118px] flex items-end justify-center overflow-visible -mt-1">
        <ArchRow teeth={LOWER_FDI} selectedSet={selectedSet} onToggle={onToggle} variant="lower" />
      </div>
    </div>
  );
}

export { UPPER_FDI, LOWER_FDI };
