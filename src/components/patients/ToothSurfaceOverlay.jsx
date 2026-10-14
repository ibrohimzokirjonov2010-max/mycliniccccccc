// Tish yuzalari (V M O D L) va toj qismi bo'yog'i.
// Keyinchalik real rasmlar kelganda: SURFACE_OVERLAY_IMAGES ga `${kind}/${surface}` -> url qo'shiladi,
// SurfaceDiagram / CrownTint o'sha rasmni rang o'rniga shu yuza ustiga qo'yadi.
export const SURFACE_OVERLAY_IMAGES = {};
export function surfaceOverlaySrc(kind, surface) {
  return SURFACE_OVERLAY_IMAGES[`${kind}/${surface}`] || SURFACE_OVERLAY_IMAGES[`${kind}/*`] || null;
}

// Emaldan aniq ajraladigan soyalar (plomba — kulrang-ko'k kompozit, karies — to'q jigarrang).
export const CROWN_TINT = {
  plomba: 'rgba(37, 99, 235, 0.38)',
  caries: 'rgba(120, 53, 15, 0.55)',
};

export function crownTintKind(name) {
  const n = String(name || '').toLowerCase();
  if (/karies|kariyes|caries/.test(n)) return 'caries';
  if (/plomba|restavr|fotopolimer/.test(n)) return 'plomba';
  return null;
}

// 5 yuzali sxema: markaz O; yuqori/past V va L(P); chap/o'ng M/D — kvadrantga qarab.
export function surfaceLayout(fdi) {
  const q = Math.floor(Number(fdi) / 10);
  const upper = [1, 2, 5, 6].includes(q);
  const screenLeftHalf = [1, 4, 5, 8].includes(q);
  return {
    top: upper ? 'V' : 'L',
    bottom: upper ? 'L' : 'V',
    left: screenLeftHalf ? 'D' : 'M',
    right: screenLeftHalf ? 'M' : 'D',
    upper,
  };
}

const SURFACE_POLY = {
  top: '6,6 94,6 66,34 34,34',
  bottom: '6,94 94,94 66,66 34,66',
  left: '6,6 34,34 34,66 6,94',
  right: '94,6 66,34 66,66 94,94',
};
const SURFACE_LABEL_POS = { top: [50, 22], bottom: [50, 82], left: [19, 53], right: [81, 53], center: [50, 53] };

export function SurfaceDiagram({ fdi, colors = {}, selected = [], onToggle, size = 64, labels = false, overlayKinds = {}, className, style }) {
  const lay = surfaceLayout(fdi);
  const parts = [['top', lay.top], ['bottom', lay.bottom], ['left', lay.left], ['right', lay.right], ['center', 'O']];
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} style={style} data-testid={onToggle ? 'surface-diagram' : undefined} aria-hidden={onToggle ? undefined : 'true'}>
      {parts.map(([pos, sf]) => {
        const fill = colors[sf] || (selected.includes(sf) ? '#D1FAE5' : '#FFFFFF');
        const img = overlayKinds[sf] ? surfaceOverlaySrc(overlayKinds[sf], sf) : null;
        const sel = selected.includes(sf);
        const common = {
          key: pos,
          fill,
          stroke: sel ? '#059669' : '#94A3B8',
          strokeWidth: sel ? 5 : (onToggle ? 2 : 4),
          strokeLinejoin: 'round',
          onClick: onToggle ? () => onToggle(sf) : undefined,
          style: onToggle ? { cursor: 'pointer' } : undefined,
          'data-surface': sf,
        };
        const shape = pos === 'center'
          ? <rect {...common} x="34" y="34" width="32" height="32" />
          : <polygon {...common} points={SURFACE_POLY[pos]} />;
        if (!img) return shape;
        return (
          <g key={pos}>
            {shape}
            <clipPath id={`sf-${fdi}-${pos}`}>{pos === 'center' ? <rect x="34" y="34" width="32" height="32" /> : <polygon points={SURFACE_POLY[pos]} />}</clipPath>
            <image href={img} x="0" y="0" width="100" height="100" clipPath={`url(#sf-${fdi}-${pos})`} preserveAspectRatio="xMidYMid slice" pointerEvents="none" />
          </g>
        );
      })}
      {labels && parts.map(([pos, sf]) => (
        <text key={`t-${pos}`} x={SURFACE_LABEL_POS[pos][0]} y={SURFACE_LABEL_POS[pos][1]} textAnchor="middle" dominantBaseline="middle" fontSize="14" fontWeight="700" fill={colors[sf] ? '#FFFFFF' : '#475569'} pointerEvents="none">
          {sf === 'L' && lay.upper ? 'P' : sf}
        </text>
      ))}
    </svg>
  );
}

// Toj qismini bo'yash (32 tishli kartada plomba/karies ko'rinsin). crownDown: toj pastda (yuqori jag').
export function CrownTint({ kind, crownDown, className = '' }) {
  const color = CROWN_TINT[kind];
  if (!color) return null;
  const img = surfaceOverlaySrc(kind, 'crown');
  return (
    <span
      aria-hidden="true"
      data-crown-tint={kind}
      className={`pointer-events-none absolute left-[18%] right-[18%] ${className}`}
      style={{
        [crownDown ? 'bottom' : 'top']: '4%',
        height: '30%',
        borderRadius: crownDown ? '40% 40% 45% 45%' : '45% 45% 40% 40%',
        background: img ? `center / contain no-repeat url(${img})` : color,
        mixBlendMode: img ? 'normal' : 'multiply',
      }}
    />
  );
}
