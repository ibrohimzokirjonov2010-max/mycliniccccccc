import { memo, useMemo } from 'react';

/**
 * Tish qatori (jag) — line-art SVG, FDI raqamlari bilan.
 * Faqat bezak va mockuplar uchun (hech qanday ma'lumot bilan bog'liq emas).
 *
 * marks: { [fdi]: 'caries' | 'filling' | 'implant' | 'crown' | 'plan' } — rangli belgilash.
 */
const UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const LOWER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

// Tish kengligi (nisbiy) va chuqurligi (px) — oxirgi raqamga qarab
const WIDTH = { 1: 0.82, 2: 0.74, 3: 0.92, 4: 0.95, 5: 0.98, 6: 1.28, 7: 1.2, 8: 1.1 };
const DEPTH = { 1: 15, 2: 14, 3: 17, 4: 17, 5: 18, 6: 24, 7: 22, 8: 20 };

const MARK_STYLE = {
  caries: { fill: '#fecaca', stroke: '#ef4444' },
  filling: { fill: '#bae6fd', stroke: '#0284c7' },
  implant: { fill: '#ccfbf1', stroke: '#0d9488' },
  crown: { fill: '#fde68a', stroke: '#d97706' },
  plan: { fill: '#e0e7ff', stroke: '#6366f1' },
};

// θ → yoy uzunligi jadvali (tishlar yoy bo'ylab bir tekis joylashsin)
function arcTable(rx, ry, steps = 360) {
  const lens = [0];
  let prev = { x: -rx, y: 0 };
  for (let i = 1; i <= steps; i += 1) {
    const th = (Math.PI * i) / steps;
    const cur = { x: -rx * Math.cos(th), y: -ry * Math.sin(th) };
    lens.push(lens[i - 1] + Math.hypot(cur.x - prev.x, cur.y - prev.y));
    prev = cur;
  }
  return lens;
}

function thetaAtLength(lens, s) {
  const steps = lens.length - 1;
  let lo = 0;
  let hi = steps;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (lens[mid] < s) lo = mid; else hi = mid;
  }
  const span = lens[hi] - lens[lo] || 1;
  const f = (s - lens[lo]) / span;
  return (Math.PI * (lo + f)) / steps;
}

function buildTeeth(jaw, rx, ry) {
  const list = jaw === 'upper' ? UPPER : LOWER;
  const dir = jaw === 'upper' ? 1 : -1; // yuqori jag: ∩, pastki jag: ∪
  const widths = list.map((n) => WIDTH[n % 10] || 1);
  const total = widths.reduce((a, b) => a + b, 0);
  const lens = arcTable(rx, ry);
  const L = lens[lens.length - 1];
  let acc = 0;
  return list.map((fdi, i) => {
    const mid = acc + widths[i] / 2;
    acc += widths[i];
    const theta = thetaAtLength(lens, L * (0.03 + 0.94 * (mid / total)));
    const px = -rx * Math.cos(theta);
    const py = -dir * ry * Math.sin(theta);
    // urinma vektori dP/dθ
    const tx = rx * Math.sin(theta);
    const ty = -dir * ry * Math.cos(theta);
    const tLen = Math.hypot(tx, ty) || 1;
    const tanX = tx / tLen;
    const tanY = ty / tLen;
    let nx = tanY;
    let ny = -tanX;
    if (nx * px + ny * py < 0) { nx = -nx; ny = -ny; }
    const angle = (Math.atan2(tanY, tanX) * 180) / Math.PI;
    const w = widths[i] * 17;
    const h = DEPTH[fdi % 10] || 18;
    return { fdi, px, py, nx, ny, angle, w, h };
  });
}

function ToothArch({
  jaw = 'upper',
  marks = {},
  showNumbers = true,
  stroke = '#14a3b8',
  fill = '#ffffff',
  numberColor = '#0f766e',
  className = '',
  strokeWidth = 1.5,
}) {
  const rx = 150;
  const ry = 92;
  const teeth = useMemo(() => buildTeeth(jaw, rx, ry), [jaw]);
  const padX = 48;
  const padY = 44;
  const vbW = rx * 2 + padX * 2;
  const vbH = ry + padY * 2 + 12;
  const cx = vbW / 2;
  // yuqori jag: yoy tepada, markaz pastda; pastki jag: aksincha
  const cy = jaw === 'upper' ? padY + ry + 6 : padY + 6;

  return (
    <svg
      viewBox={`0 0 ${vbW} ${vbH}`}
      className={className}
      role="img"
      aria-label={jaw === 'upper' ? 'Yuqori jag tishlari' : 'Pastki jag tishlari'}
      fill="none"
    >
      <g transform={`translate(${cx} ${cy})`}>
        {teeth.map((t) => {
          const mark = MARK_STYLE[marks[t.fdi]];
          const molar = t.fdi % 10 >= 6;
          return (
            <g key={t.fdi}>
              <g transform={`translate(${t.px} ${t.py}) rotate(${t.angle})`}>
                <rect
                  x={-t.w / 2}
                  y={-t.h / 2}
                  width={t.w}
                  height={t.h}
                  rx={molar ? 6 : 7}
                  fill={mark ? mark.fill : fill}
                  stroke={mark ? mark.stroke : stroke}
                  strokeWidth={mark ? strokeWidth + 0.4 : strokeWidth}
                />
                {molar ? (
                  <path
                    d={`M ${-t.w / 4} 0 H ${t.w / 4} M 0 ${-t.h / 4} V ${t.h / 4}`}
                    stroke={mark ? mark.stroke : stroke}
                    strokeWidth={1}
                    strokeLinecap="round"
                    opacity="0.55"
                  />
                ) : (
                  <path
                    d={`M ${-t.w / 4} ${t.h / 5} Q 0 ${t.h / 3.2} ${t.w / 4} ${t.h / 5}`}
                    stroke={mark ? mark.stroke : stroke}
                    strokeWidth={1}
                    strokeLinecap="round"
                    opacity="0.45"
                  />
                )}
              </g>
              {showNumbers ? (
                <text
                  x={t.px + t.nx * (t.h / 2 + 12)}
                  y={t.py + t.ny * (t.h / 2 + 12)}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="9.5"
                  fontWeight="600"
                  fill={numberColor}
                  style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
                >
                  {t.fdi}
                </text>
              ) : null}
            </g>
          );
        })}
      </g>
    </svg>
  );
}

export default memo(ToothArch);
