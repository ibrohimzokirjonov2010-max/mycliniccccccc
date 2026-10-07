import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import './implantWizard.css';
import { fdiCrownDown, fdiGridTemplate, fdiLengthWeight, fdiWidthWeight } from '@/lib/fdiNotation';
import { getToothIllustrationSrc } from '@/utils/toothIllustration';
import { useIsMobile } from '@/hooks/useIsMobile';

/** Same adult FDI order as the profile Tish kartasi. */
const UPPER_FDI = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_FDI = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

/** Profile implant status color — dot on the drawing, no digit. */
const IMPLANT_BADGE = '#64748B';

function WizardTooth({ fdi, selected, active, onClick }) {
  const crownDown = fdiCrownDown(fdi);
  const picked = selected || active;
  return (
    <button
      type="button"
      onClick={() => onClick(String(fdi))}
      data-fdi={fdi}
      aria-pressed={selected}
      aria-current={active ? 'true' : undefined}
      aria-label={`${fdi}-tish`}
      title={`${fdi}-tish`}
      className={cn(
        'compact-hit flex w-full min-w-0 max-w-full flex-col border-0 bg-transparent p-0 cursor-pointer',
        crownDown ? 'justify-end' : 'justify-start',
      )}
      style={{ '--fdi-len': fdiLengthWeight(fdi) }}
    >
      <span
        className="tooth-face relative flex w-full max-w-full items-center justify-center overflow-hidden rounded-md"
        style={{
          boxSizing: 'border-box',
          border: '2px solid transparent',
          background: 'transparent',
          boxShadow: picked ? 'inset 0 0 0 2px #0F172A' : 'none',
          alignItems: crownDown ? 'flex-end' : 'flex-start',
        }}
      >
        <img
          src={getToothIllustrationSrc(fdi, 'healthy')}
          alt=""
          draggable={false}
          className="h-[94%] w-full max-w-full min-w-0 object-contain pointer-events-none"
          style={{ objectPosition: crownDown ? 'center bottom' : 'center top' }}
        />
        {selected && (
          <span
            className={cn('tooth-status-dot', crownDown ? 'is-upper' : 'is-lower')}
            style={{ background: IMPLANT_BADGE }}
            aria-hidden="true"
          />
        )}
      </span>
    </button>
  );
}

function Half({ fdis, phone, selectedSet, activeFdi, onToggle }) {
  return (
    <div
      className="odonto-quad"
      style={{
        gridTemplateColumns: phone
          ? fdis.map((n) => `minmax(40px, ${fdiWidthWeight(n)}fr)`).join(' ')
          : fdiGridTemplate(fdis),
      }}
    >
      {fdis.map((n) => (
        <WizardTooth
          key={n}
          fdi={n}
          selected={selectedSet.has(String(n))}
          active={String(activeFdi || '') === String(n)}
          onClick={onToggle}
        />
      ))}
    </div>
  );
}

function splitAt(list) {
  return Math.ceil(list.length / 2);
}

/**
 * Profile-sized realistic tooth chart for the New Implant wizard.
 * Uses the same FDI order, width weights, illustrations, and tooth-face
 * metrics as Tish kartasi. Selection is an inset ring plus a number badge.
 */
export default function ImplantWizardArch({ selectedFdis = [], activeFdi = '', onToggle, scrollHint }) {
  const phone = useIsMobile(768);
  const selectedSet = new Set((selectedFdis || []).map(String));
  const scrollRef = useRef(null);
  const [archHalf, setArchHalf] = useState('right');

  return (
    <div
      className="implant-wizard-arch tooth-chart-root w-full select-none"
      data-testid="implant-wizard-arch"
      data-layout="profile-chart"
    >
      <div className="odonto-fit-frame" data-compact={phone ? 'true' : 'false'}>
        <div className={cn('odonto-scroll-shell', phone && 'is-hint')}>
          {phone && (
            <>
              <div className="mb-2 grid grid-cols-2 gap-1.5" data-testid="arch-half-tabs">
                <button
                  type="button"
                  data-testid="arch-half-right"
                  onClick={() => {
                    setArchHalf('right');
                    scrollRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
                  }}
                  className={cn(
                    'h-9 rounded-xl text-[12px] font-extrabold',
                    archHalf === 'right' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700',
                  )}
                >
                  O‘ng · 18–11
                </button>
                <button
                  type="button"
                  data-testid="arch-half-left"
                  onClick={() => {
                    setArchHalf('left');
                    const node = scrollRef.current;
                    if (!node) return;
                    node.scrollTo({ left: Math.max(0, node.scrollWidth - node.clientWidth), behavior: 'smooth' });
                  }}
                  className={cn(
                    'h-9 rounded-xl text-[12px] font-extrabold',
                    archHalf === 'left' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700',
                  )}
                >
                  Chap · 21–28
                </button>
              </div>
              <p className="odonto-scroll-hint">
                {scrollHint || 'Chap yarmi yashirin. «Chap · 21–28» ni bosing yoki suring →'}
              </p>
            </>
          )}
          <div
            ref={scrollRef}
            className="odonto-scroll"
            data-arch="scroll"
            onScroll={(event) => {
              if (!phone) return;
              const node = event.currentTarget;
              const max = node.scrollWidth - node.clientWidth;
              if (max <= 8) return;
              setArchHalf(node.scrollLeft > max / 2 ? 'left' : 'right');
            }}
          >
            <div className="odonto-cross">
              <div className="odonto-jaw-band">
                <span className="odonto-side odonto-side-r">O‘NG</span>
                <span className="odonto-side odonto-side-l">CHAP</span>
                <div className="odonto-jaw odonto-jaw-upper">
                  <Half fdis={UPPER_FDI.slice(0, splitAt(UPPER_FDI))} phone={phone} selectedSet={selectedSet} activeFdi={activeFdi} onToggle={onToggle} />
                  <div className="odonto-midline" aria-hidden="true" />
                  <Half fdis={UPPER_FDI.slice(splitAt(UPPER_FDI))} phone={phone} selectedSet={selectedSet} activeFdi={activeFdi} onToggle={onToggle} />
                </div>
              </div>
              <div className="odonto-bite-line" aria-hidden="true" />
              <div className="odonto-jaw-band">
                <span className="odonto-side odonto-side-r">O‘NG</span>
                <span className="odonto-side odonto-side-l">CHAP</span>
                <div className="odonto-jaw odonto-jaw-lower">
                  <Half fdis={LOWER_FDI.slice(0, splitAt(LOWER_FDI))} phone={phone} selectedSet={selectedSet} activeFdi={activeFdi} onToggle={onToggle} />
                  <div className="odonto-midline" aria-hidden="true" />
                  <Half fdis={LOWER_FDI.slice(splitAt(LOWER_FDI))} phone={phone} selectedSet={selectedSet} activeFdi={activeFdi} onToggle={onToggle} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { UPPER_FDI, LOWER_FDI };
