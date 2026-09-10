import React, { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * 32 Teeth Standard FDI Dental Arch (Occlusal View)
 * Exact anatomical occlusal crowns arranged in a mathematically uniform,
 * continuous, contiguous horseshoe dental arch matching the reference design.
 * Center: (160, 160), rx = 104, ry = 108, viewBox: 0 0 320 320.
 */

const TOOTH_NAMES = {
  // Upper Jaw (Maxilla)
  '11': "Yuqori o'ng 1-markaziy kesuvchi (#11)",
  '12': "Yuqori o'ng 2-yon kesuvchi (#12)",
  '13': "Yuqori o'ng qoziq tish (#13)",
  '14': "Yuqori o'ng 1-premolyar (#14)",
  '15': "Yuqori o'ng 2-premolyar (#15)",
  '16': "Yuqori o'ng 1-molyar (#16)",
  '17': "Yuqori o'ng 2-molyar (#17)",
  '18': "Yuqori o'ng 3-molyar (#18)",

  '21': "Yuqori chap 1-markaziy kesuvchi (#21)",
  '22': "Yuqori chap 2-yon kesuvchi (#22)",
  '23': "Yuqori chap qoziq tish (#23)",
  '24': "Yuqori chap 1-premolyar (#24)",
  '25': "Yuqori chap 2-premolyar (#25)",
  '26': "Yuqori chap 1-molyar (#26)",
  '27': "Yuqori chap 2-molyar (#27)",
  '28': "Yuqori chap 3-molyar (#28)",

  // Lower Jaw (Mandibula)
  '31': "Pastki chap 1-markaziy kesuvchi (#31)",
  '32': "Pastki chap 2-yon kesuvchi (#32)",
  '33': "Pastki chap qoziq tish (#33)",
  '34': "Pastki chap 1-premolyar (#34)",
  '35': "Pastki chap 2-premolyar (#35)",
  '36': "Pastki chap 1-molyar (#36)",
  '37': "Pastki chap 2-molyar (#37)",
  '38': "Pastki chap 3-molyar (#38)",

  '41': "Pastki o'ng 1-markaziy kesuvchi (#41)",
  '42': "Pastki o'ng 2-yon kesuvchi (#42)",
  '43': "Pastki o'ng qoziq tish (#43)",
  '44': "Pastki o'ng 1-premolyar (#44)",
  '45': "Pastki o'ng 2-premolyar (#45)",
  '46': "Pastki o'ng 1-molyar (#46)",
  '47': "Pastki o'ng 2-molyar (#47)",
  '48': "Pastki o'ng 3-molyar (#48)",
};

const CX = 160;
const CY = 160;
const RX = 104;
const RY = 108;
const STEP = 360 / 32; // 11.25° per tooth

function buildTeethData() {
  const list = [];

  // Quadrant 1 (Upper Right): 11 -> 18
  for (let i = 1; i <= 8; i++) {
    const fdi = '1' + i;
    const type = i <= 2 ? 'incisor' : i === 3 ? 'canine' : i <= 5 ? 'premolar' : 'molar';
    const angle = -90 + (i - 0.5) * STEP;
    list.push({ fdi, type, angle });
  }

  // Quadrant 4 (Lower Right): 48 -> 41
  for (let i = 8; i >= 1; i--) {
    const fdi = '4' + i;
    const type = i <= 2 ? 'incisor' : i === 3 ? 'canine' : i <= 5 ? 'premolar' : 'molar';
    const angle = 0 + (8.5 - i) * STEP;
    list.push({ fdi, type, angle });
  }

  // Quadrant 3 (Lower Left): 31 -> 38
  for (let i = 1; i <= 8; i++) {
    const fdi = '3' + i;
    const type = i <= 2 ? 'incisor' : i === 3 ? 'canine' : i <= 5 ? 'premolar' : 'molar';
    const angle = 90 + (i - 0.5) * STEP;
    list.push({ fdi, type, angle });
  }

  // Quadrant 2 (Upper Left): 28 -> 21
  for (let i = 8; i >= 1; i--) {
    const fdi = '2' + i;
    const type = i <= 2 ? 'incisor' : i === 3 ? 'canine' : i <= 5 ? 'premolar' : 'molar';
    const angle = 180 + (8.5 - i) * STEP;
    list.push({ fdi, type, angle });
  }

  return list.map((t) => {
    const rad = (t.angle * Math.PI) / 180;
    const x = Math.round((CX + RX * Math.cos(rad)) * 10) / 10;
    const y = Math.round((CY + RY * Math.sin(rad)) * 10) / 10;
    const tangentRad = Math.atan2(RY * Math.cos(rad), -RX * Math.sin(rad));
    const rot = Math.round(((tangentRad * 180) / Math.PI) * 10) / 10;

    return {
      ...t,
      x,
      y,
      rot,
      name: TOOTH_NAMES[t.fdi] || `Tish #${t.fdi}`,
    };
  });
}

const TEETH_DATA = buildTeethData();

/**
 * Anatomically authentic occlusal tooth crown representations
 */
function ToothCrown({ type, isSelected, isHovered }) {
  const primaryTeal = '#1499AD';
  const strokeTeal = '#0e7490';
  const naturalFill = isHovered ? '#f0fdfa' : '#ffffff';
  const naturalStroke = isHovered ? '#1499AD' : '#94a3b8';

  const fill = isSelected ? primaryTeal : naturalFill;
  const stroke = isSelected ? strokeTeal : naturalStroke;
  const strokeWidth = isSelected ? 1.75 : 1.25;
  const fissureColor = isSelected ? '#ffffff' : '#cbd5e1';

  if (type === 'molar') {
    return (
      <g>
        {/* Outer crown contour */}
        <rect
          x="-9.5"
          y="-8"
          width="19"
          height="16"
          rx="5"
          ry="5"
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
        {isSelected ? (
          /* Implant crown internal pattern */
          <g>
            <ellipse cx="0" cy="0" rx="4.8" ry="4" fill="none" stroke="#ffffff" strokeWidth="1.2" opacity="0.9" />
            <circle cx="0" cy="0" r="1.3" fill="#ffffff" />
          </g>
        ) : (
          /* Anatomical occlusal table rim & developmental fissures */
          <g>
            <rect
              x="-6.5"
              y="-5"
              width="13"
              height="10"
              rx="2.5"
              fill="none"
              stroke={fissureColor}
              strokeWidth="0.75"
              opacity="0.7"
            />
            <line x1="-5" y1="0" x2="5" y2="0" stroke={fissureColor} strokeWidth="0.9" strokeLinecap="round" />
            <line x1="0" y1="-4" x2="0" y2="4" stroke={fissureColor} strokeWidth="0.9" strokeLinecap="round" />
            <circle cx="0" cy="0" r="1.1" fill={fissureColor} />
          </g>
        )}
      </g>
    );
  }

  if (type === 'premolar') {
    return (
      <g>
        {/* Bicuspid oval crown */}
        <ellipse
          cx="0"
          cy="0"
          rx="8.2"
          ry="6.8"
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
        {isSelected ? (
          /* Implant crown internal pattern */
          <g>
            <ellipse cx="0" cy="0" rx="4.2" ry="3.5" fill="none" stroke="#ffffff" strokeWidth="1.2" opacity="0.9" />
            <circle cx="0" cy="0" r="1.3" fill="#ffffff" />
          </g>
        ) : (
          /* Central developmental groove */
          <g>
            <line x1="-4.2" y1="0" x2="4.2" y2="0" stroke={fissureColor} strokeWidth="0.95" strokeLinecap="round" />
            <circle cx="-2.8" cy="0" r="0.75" fill={fissureColor} />
            <circle cx="2.8" cy="0" r="0.75" fill={fissureColor} />
          </g>
        )}
      </g>
    );
  }

  if (type === 'canine') {
    return (
      <g>
        {/* Conical canine cusp contour */}
        <path
          d="M0 -6.5 C3.8 -6.5 6.5 -2.5 6.5 1 C6.5 4.5 3.8 6.5 0 6.5 C-3.8 6.5 -6.5 4.5 -6.5 1 C-6.5 -2.5 -3.8 -6.5 0 -6.5 Z"
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
        {isSelected ? (
          <circle cx="0" cy="0" r="1.8" fill="#ffffff" />
        ) : (
          <circle cx="0" cy="0" r="1.1" fill={fissureColor} />
        )}
      </g>
    );
  }

  // Incisor
  return (
    <g>
      {/* Incisal crown */}
      <rect
        x="-7"
        y="-4.2"
        width="14"
        height="8.4"
        rx="2.6"
        ry="2.6"
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
      {isSelected ? (
        <circle cx="0" cy="0" r="1.5" fill="#ffffff" />
      ) : (
        <line x1="-3.8" y1="0" x2="3.8" y2="0" stroke={fissureColor} strokeWidth="0.85" strokeLinecap="round" />
      )}
    </g>
  );
}

export function DentalArchFdi({
  activeFdis = ['15'],
  caseFdis = [],
  onSelectTooth,
  className,
}) {
  const [hoveredTooth, setHoveredTooth] = useState(null);

  const activeSet = useMemo(() => new Set(activeFdis.map(String)), [activeFdis]);
  const primaryFdi = activeFdis.length > 0 ? String(activeFdis[0]) : '15';

  // Find currently active tooth coordinates for floating pointer badge
  const activeTooth = useMemo(() => {
    return TEETH_DATA.find((t) => t.fdi === primaryFdi) || TEETH_DATA.find((t) => t.fdi === '15');
  }, [primaryFdi]);

  // Floating badge position calculation
  const badgePos = useMemo(() => {
    if (!activeTooth) return { bx: 280, by: 40, tx: 240, ty: 90 };
    // If tooth is in right half (x >= 160)
    if (activeTooth.x >= 160) {
      return {
        bx: Math.min(300, activeTooth.x + 38),
        by: Math.max(25, activeTooth.y - 35),
        tx: activeTooth.x + 6,
        ty: activeTooth.y - 6,
      };
    }
    // If tooth is in left half (x < 160)
    return {
      bx: Math.max(25, activeTooth.x - 45),
      by: Math.max(25, activeTooth.y - 35),
      tx: activeTooth.x - 6,
      ty: activeTooth.y - 6,
    };
  }, [activeTooth]);

  return (
    <div className={cn('relative flex flex-col items-center select-none w-full', className)}>
      {/* Centered Realistic Dental Arch SVG */}
      <div className="relative w-full max-w-[280px] sm:max-w-[300px] aspect-[1/1] flex items-center justify-center my-1">
        <svg
          viewBox="0 0 320 320"
          className="w-full h-full overflow-visible"
        >
          {/* Subtle dental arch guideline */}
          <ellipse
            cx={CX}
            cy={CY}
            rx={RX}
            ry={RY}
            fill="none"
            stroke="#f8fafc"
            strokeWidth="1.5"
            strokeDasharray="3 3"
          />

          {/* 32 Teeth neatly contiguous along the arch */}
          {TEETH_DATA.map((t) => {
            // Highlight the active tooth (#15), and in reference screenshot, #14 is paired highlighted
            const isDirectSelected = activeSet.has(t.fdi);
            const isPairedHighlight = primaryFdi === '15' && (t.fdi === '15' || t.fdi === '14');
            const isSelected = isDirectSelected || isPairedHighlight;
            const isHovered = hoveredTooth?.fdi === t.fdi;
            const scale = isHovered ? 1.15 : 1;

            return (
              <g
                key={t.fdi}
                transform={`translate(${t.x}, ${t.y}) rotate(${t.rot}) scale(${scale})`}
                onClick={() => onSelectTooth?.(t.fdi)}
                onMouseEnter={() => setHoveredTooth(t)}
                onMouseLeave={() => setHoveredTooth(null)}
                className="cursor-pointer transition-transform duration-100"
              >
                <ToothCrown
                  type={t.type}
                  isSelected={isSelected}
                  isHovered={isHovered}
                />
              </g>
            );
          })}

          {/* Floating badge for active tooth matching reference screenshot */}
          {activeTooth && (
            <g className="pointer-events-none transition-all duration-300">
              {/* Leader pointer line */}
              <line
                x1={badgePos.tx}
                y1={badgePos.ty}
                x2={badgePos.bx}
                y2={badgePos.by + 11}
                stroke="#1499AD"
                strokeWidth="1.2"
                strokeDasharray="2 2"
              />
              {/* Badge container */}
              <g transform={`translate(${badgePos.bx - 18}, ${badgePos.by})`}>
                <rect
                  x="0"
                  y="0"
                  width="38"
                  height="22"
                  rx="6"
                  fill="#f0fdfa"
                  stroke="#99f6e4"
                  strokeWidth="1.2"
                />
                <text
                  x="19"
                  y="15"
                  textAnchor="middle"
                  fill="#0f766e"
                  fontSize="11"
                  fontWeight="900"
                  fontFamily="monospace"
                >
                  #{primaryFdi}
                </text>
              </g>
            </g>
          )}
        </svg>

        {/* Interactive Hover Tooltip */}
        {hoveredTooth && (
          <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white px-2.5 py-1 rounded-lg text-[10px] font-bold pointer-events-none shadow-md whitespace-nowrap z-20 flex items-center gap-1">
            <span className="font-mono text-[#2dd4bf]">#{hoveredTooth.fdi}</span>
            <span>·</span>
            <span>{hoveredTooth.name}</span>
          </div>
        )}
      </div>

      {/* Legend below the arch matching reference screenshot */}
      <div className="flex items-center justify-center gap-5 pt-3 text-[11px] font-bold text-slate-500 border-t border-slate-100 w-full mt-1">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#1499AD] ring-2 ring-teal-100" />
          <span className="text-slate-700 font-semibold">Implant joylashgan (#{primaryFdi})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full border border-slate-400 bg-white" />
          <span className="text-slate-500">Tabiiy tish / Yo&apos;q</span>
        </div>
      </div>
    </div>
  );
}

export default DentalArchFdi;
