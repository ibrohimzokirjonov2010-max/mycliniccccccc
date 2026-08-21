import { useState, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * =====================================================
 * PROFESSIONAL DENTAL CHART — FDI Notation System
 * Senior-level SVG Tooth Illustrations + Interactive UI
 * =====================================================
 */

// ── Tooth Status Config ──────────────────────────────────────────────────────
export const TOOTH_STATUS = {
  healthy:    { label: 'Sog\'lom',      color: '#22c55e', bg: '#dcfce7', border: '#16a34a', gum: '#f9a8d4', root: '#fbbf24' },
  cavity:     { label: 'Kariyes',       color: '#ef4444', bg: '#fee2e2', border: '#dc2626', gum: '#fca5a5', root: '#fbbf24' },
  treated:    { label: 'Davolangan',    color: '#3b82f6', bg: '#dbeafe', border: '#2563eb', gum: '#93c5fd', root: '#fbbf24' },
  crown:      { label: 'Toj',           color: '#a855f7', bg: '#f3e8ff', border: '#7c3aed', gum: '#c4b5fd', root: '#fbbf24' },
  extracted:  { label: 'Sug\'urilgan',  color: '#94a3b8', bg: '#f1f5f9', border: '#64748b', gum: '#cbd5e1', root: '#94a3b8' },
  implant:    { label: 'Implant',       color: '#f59e0b', bg: '#fef3c7', border: '#d97706', gum: '#fde68a', root: '#60a5fa' },
  bridge:     { label: 'Ko\'prik',      color: '#06b6d4', bg: '#cffafe', border: '#0891b2', gum: '#67e8f9', root: '#fbbf24' },
  missing:    { label: 'Yo\'q',         color: '#e2e8f0', bg: '#f8fafc', border: '#cbd5e1', gum: '#e2e8f0', root: '#e2e8f0' },
};

// ── FDI Dental Numbering ─────────────────────────────────────────────────────
// Upper Right: 18,17,16,15,14,13,12,11
// Upper Left:  21,22,23,24,25,26,27,28
// Lower Left:  31,32,33,34,35,36,37,38   (reversed display)
// Lower Right: 41,42,43,44,45,46,47,48   (reversed display)

const UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11];
const UPPER_LEFT  = [21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_LEFT  = [31, 32, 33, 34, 35, 36, 37, 38];
const LOWER_RIGHT = [41, 42, 43, 44, 45, 46, 47, 48];

// Tooth type determination for shape
const getToothType = (num) => {
  const n = num % 10;
  if (n === 8) return 'molar3';    // 3rd molar (wisdom)
  if (n === 7) return 'molar2';    // 2nd molar
  if (n === 6) return 'molar1';    // 1st molar
  if (n === 5) return 'premolar2'; // 2nd premolar
  if (n === 4) return 'premolar1'; // 1st premolar
  if (n === 3) return 'canine';    // canine
  if (n === 2) return 'lateral';   // lateral incisor
  if (n === 1) return 'central';   // central incisor
  return 'molar1';
};

// ── SVG Tooth Shapes ─────────────────────────────────────────────────────────
const ToothSVG = memo(({ toothNum, status, isUpper, size = 44, selected, onClick }) => {
  const type = getToothType(toothNum);
  const st = TOOTH_STATUS[status] || TOOTH_STATUS.healthy;
  const isExtracted = status === 'extracted' || status === 'missing';

  // Shape configs per tooth type
  const shapes = {
    central:   { crownW: 22, crownH: 20, rootW: 10, rootH: 28, rx: 5, roots: 1 },
    lateral:   { crownW: 18, crownH: 18, rootW: 8,  rootH: 25, rx: 4, roots: 1 },
    canine:    { crownW: 16, crownH: 20, rootW: 7,  rootH: 32, rx: 4, roots: 1 },
    premolar1: { crownW: 18, crownH: 18, rootW: 10, rootH: 26, rx: 4, roots: 2 },
    premolar2: { crownW: 18, crownH: 17, rootW: 10, rootH: 24, rx: 4, roots: 2 },
    molar1:    { crownW: 26, crownH: 20, rootW: 14, rootH: 24, rx: 5, roots: 3 },
    molar2:    { crownW: 26, crownH: 20, rootW: 14, rootH: 22, rx: 5, roots: 3 },
    molar3:    { crownW: 24, crownH: 18, rootW: 13, rootH: 20, rx: 5, roots: 3 },
  };

  const s = shapes[type];
  const svgW = size;
  const svgH = size;
  const cx = svgW / 2;
  
  // Crown & root Y positions
  const crownY = isUpper ? (svgH * 0.55 - s.crownH) : (svgH * 0.4);
  const rootY  = isUpper ? (crownY - s.rootH) : (crownY + s.crownH);
  const crownX = cx - s.crownW / 2;
  const rootX  = cx - s.rootW / 2;

  const renderRoots = () => {
    if (isExtracted || status === 'missing') return null;
    const rootColor = st.root;
    const rootOpacity = 0.85;

    if (s.roots === 1) {
      return (
        <rect
          x={rootX} y={rootY}
          width={s.rootW} height={s.rootH}
          rx={s.rootW / 2}
          fill={rootColor} opacity={rootOpacity}
        />
      );
    }
    if (s.roots === 2) {
      const gap = 3;
      const rw = (s.rootW - gap) / 2;
      return (
        <>
          <rect x={cx - s.rootW/2} y={rootY} width={rw} height={s.rootH - 4} rx={rw/2} fill={rootColor} opacity={rootOpacity} />
          <rect x={cx + gap/2}      y={rootY} width={rw} height={s.rootH - 4} rx={rw/2} fill={rootColor} opacity={rootOpacity} />
        </>
      );
    }
    // 3 roots
    const gap = 2;
    const rw = (s.rootW - gap * 2) / 3;
    return (
      <>
        <rect x={cx - s.rootW/2}       y={rootY} width={rw} height={s.rootH - 6} rx={rw/2} fill={rootColor} opacity={rootOpacity} />
        <rect x={cx - rw/2}            y={rootY} width={rw} height={s.rootH}     rx={rw/2} fill={rootColor} opacity={rootOpacity} />
        <rect x={cx + s.rootW/2 - rw}  y={rootY} width={rw} height={s.rootH - 6} rx={rw/2} fill={rootColor} opacity={rootOpacity} />
      </>
    );
  };

  const renderCrown = () => {
    if (isExtracted || status === 'missing') {
      // Show dashed outline for missing/extracted
      return (
        <rect
          x={crownX} y={crownY}
          width={s.crownW} height={s.crownH}
          rx={s.rx}
          fill="none"
          stroke="#cbd5e1"
          strokeWidth="1.5"
          strokeDasharray="3 2"
          opacity={0.5}
        />
      );
    }

    return (
      <>
        {/* Crown shadow */}
        <rect
          x={crownX + 1} y={crownY + 2}
          width={s.crownW} height={s.crownH}
          rx={s.rx}
          fill={st.color} opacity={0.15}
        />
        {/* Crown body */}
        <rect
          x={crownX} y={crownY}
          width={s.crownW} height={s.crownH}
          rx={s.rx}
          fill="white"
          stroke={st.border}
          strokeWidth={selected ? 2 : 1.5}
        />
        {/* Crown surface detail (occlusal) */}
        {(type === 'molar1' || type === 'molar2' || type === 'molar3') && (
          <>
            <line x1={cx} y1={crownY + 3} x2={cx} y2={crownY + s.crownH - 3} stroke={st.color} strokeWidth="0.8" opacity={0.4} />
            <line x1={crownX + 5} y1={crownY + s.crownH/2} x2={crownX + s.crownW - 5} y2={crownY + s.crownH/2} stroke={st.color} strokeWidth="0.8" opacity={0.4} />
            <circle cx={crownX + 6} cy={crownY + 5} r={1.5} fill={st.color} opacity={0.3} />
            <circle cx={crownX + s.crownW - 6} cy={crownY + 5} r={1.5} fill={st.color} opacity={0.3} />
            <circle cx={crownX + 6} cy={crownY + s.crownH - 5} r={1.5} fill={st.color} opacity={0.3} />
            <circle cx={crownX + s.crownW - 6} cy={crownY + s.crownH - 5} r={1.5} fill={st.color} opacity={0.3} />
          </>
        )}
        {(type === 'premolar1' || type === 'premolar2') && (
          <>
            <ellipse cx={cx} cy={crownY + s.crownH * 0.45} rx={s.crownW * 0.25} ry={s.crownH * 0.2} fill={st.color} opacity={0.2} />
          </>
        )}
        {/* Crown color overlay for status */}
        <rect
          x={crownX + 1} y={crownY + 1}
          width={s.crownW - 2} height={s.crownH - 2}
          rx={s.rx - 1}
          fill={st.color} opacity={0.12}
        />
        {/* Highlight gloss */}
        <rect
          x={crownX + 3} y={crownY + 2}
          width={s.crownW * 0.45} height={s.crownH * 0.35}
          rx={2}
          fill="white" opacity={0.55}
        />
        {/* Crown implant screw indicator */}
        {status === 'implant' && (
          <>
            <line x1={cx} y1={crownY + 3} x2={cx} y2={crownY + s.crownH - 3} stroke="#d97706" strokeWidth="1.5" opacity={0.8} />
            <line x1={crownX + 4} y1={crownY + s.crownH/2} x2={crownX + s.crownW - 4} y2={crownY + s.crownH/2} stroke="#d97706" strokeWidth="1.5" opacity={0.8} />
          </>
        )}
        {/* Cavity indicator */}
        {status === 'cavity' && (
          <circle cx={cx} cy={crownY + s.crownH * 0.5} r={Math.min(s.crownW, s.crownH) * 0.2} fill="#ef4444" opacity={0.45} />
        )}
        {/* Crown indicator for crown status */}
        {status === 'crown' && (
          <rect
            x={crownX} y={crownY}
            width={s.crownW} height={s.crownH}
            rx={s.rx}
            fill="none"
            stroke="#7c3aed"
            strokeWidth="2"
            strokeDasharray="4 1"
          />
        )}
      </>
    );
  };

  return (
    <motion.div
      whileHover={{ scale: 1.12, y: isUpper ? 2 : -2 }}
      whileTap={{ scale: 0.94 }}
      onClick={() => onClick(toothNum)}
      className={cn(
        'cursor-pointer relative flex flex-col items-center',
        selected && 'drop-shadow-lg'
      )}
      style={{ width: svgW, height: svgH + 4 }}
      title={`Tish #${toothNum} — ${st.label}`}
    >
      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} overflow="visible">
        {/* Roots */}
        {!isUpper ? renderRoots() : null}

        {/* Crown */}
        {renderCrown()}

        {/* Roots (upper teeth roots go up) */}
        {isUpper ? renderRoots() : null}

        {/* Selection ring */}
        {selected && (
          <rect
            x={crownX - 2} y={crownY - 2}
            width={s.crownW + 4} height={s.crownH + 4}
            rx={s.rx + 2}
            fill="none"
            stroke={st.border}
            strokeWidth="2"
            strokeDasharray="4 2"
            opacity={0.8}
          />
        )}
      </svg>

      {/* Status dot */}
      {!isExtracted && (
        <div
          className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: st.color }}
        />
      )}
    </motion.div>
  );
});

// ── Tooth Number Label ────────────────────────────────────────────────────────
const ToothLabel = memo(({ num, isActive, status }) => {
  const st = TOOTH_STATUS[status] || TOOTH_STATUS.healthy;
  return (
    <motion.div
      className={cn(
        'text-center font-black text-[10px] leading-none px-1 py-0.5 rounded-md transition-all',
        isActive
          ? 'text-white'
          : 'text-slate-400'
      )}
      style={isActive ? { backgroundColor: st.color } : {}}
    >
      {num}
    </motion.div>
  );
});

// ── Single Tooth Cell ─────────────────────────────────────────────────────────
const ToothCell = memo(({ toothNum, status, isUpper, selected, onSelect }) => {
  return (
    <div className="flex flex-col items-center gap-0.5">
      {isUpper && (
        <ToothLabel num={toothNum} isActive={selected} status={status} />
      )}
      <ToothSVG
        toothNum={toothNum}
        status={status}
        isUpper={isUpper}
        size={42}
        selected={selected}
        onClick={onSelect}
      />
      {!isUpper && (
        <ToothLabel num={toothNum} isActive={selected} status={status} />
      )}
    </div>
  );
});

// ── Status Picker ─────────────────────────────────────────────────────────────
const StatusPicker = memo(({ toothNum, currentStatus, onStatusChange, onClose }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: -8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: -8 }}
      className="absolute z-50 top-full mt-2 left-1/2 -translate-x-1/2 bg-white rounded-2xl shadow-2xl border border-slate-100 p-3 min-w-[200px]"
      style={{ boxShadow: '0 20px 60px -10px rgba(0,0,0,0.18)' }}
    >
      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 px-1">
        Tish #{toothNum} holati
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {Object.entries(TOOTH_STATUS).map(([key, val]) => (
          <button
            key={key}
            onClick={() => { onStatusChange(toothNum, key); onClose(); }}
            className={cn(
              'flex items-center gap-2 px-2.5 py-2 rounded-xl text-[11px] font-bold transition-all border',
              currentStatus === key
                ? 'border-transparent text-white shadow-md'
                : 'border-slate-100 text-slate-600 hover:border-slate-200 bg-slate-50 hover:bg-white'
            )}
            style={currentStatus === key ? { backgroundColor: val.color, borderColor: val.border } : {}}
          >
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: val.color }} />
            {val.label}
          </button>
        ))}
      </div>
    </motion.div>
  );
});

// ── Legend ────────────────────────────────────────────────────────────────────
const Legend = memo(() => (
  <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
    {Object.entries(TOOTH_STATUS).map(([key, val]) => (
      <div key={key} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white border border-slate-100 shadow-sm">
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: val.color }} />
        <span className="text-[10px] font-bold text-slate-600 whitespace-nowrap">{val.label}</span>
      </div>
    ))}
  </div>
));

// ── Jaw Separator ─────────────────────────────────────────────────────────────
const JawSeparator = memo(({ label }) => (
  <div className="flex items-center gap-3 my-1">
    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
    <span className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-300 whitespace-nowrap">{label}</span>
    <div className="flex-1 h-px bg-gradient-to-l from-transparent via-slate-200 to-transparent" />
  </div>
));

// ── Quadrant Label ────────────────────────────────────────────────────────────
const QuadrantLabel = memo(({ label }) => (
  <div className="text-[8px] font-black uppercase tracking-widest text-slate-300 text-center mb-1">{label}</div>
));

// ── Main Dental Chart Component ───────────────────────────────────────────────
/**
 * DentalChart
 * 
 * @param {Object}   props
 * @param {Object}   props.teethData     - { [toothNum]: status }
 * @param {Function} props.onStatusChange - (toothNum, newStatus) => void
 * @param {boolean}  props.readOnly       - disable interaction
 * @param {string}   props.className
 */
export default function DentalChart({ teethData = {}, onStatusChange, readOnly = false, className }) {
  const [selectedTooth, setSelectedTooth] = useState(null);

  const getStatus = useCallback((num) => {
    return teethData[num] || 'healthy';
  }, [teethData]);

  const handleSelect = useCallback((num) => {
    if (readOnly) return;
    setSelectedTooth(prev => prev === num ? null : num);
  }, [readOnly]);

  const handleStatusChange = useCallback((num, status) => {
    onStatusChange?.(num, status);
    setSelectedTooth(null);
  }, [onStatusChange]);

  const renderRow = (teeth, isUpper, reversed = false) => {
    const displayTeeth = reversed ? [...teeth].reverse() : teeth;
    return displayTeeth.map(num => (
      <div key={num} className="relative flex flex-col items-center">
        <ToothCell
          toothNum={num}
          status={getStatus(num)}
          isUpper={isUpper}
          selected={selectedTooth === num}
          onSelect={handleSelect}
        />
        <AnimatePresence>
          {selectedTooth === num && !readOnly && (
            <StatusPicker
              toothNum={num}
              currentStatus={getStatus(num)}
              onStatusChange={handleStatusChange}
              onClose={() => setSelectedTooth(null)}
            />
          )}
        </AnimatePresence>
      </div>
    ));
  };

  // Click outside to deselect
  const handleBackdropClick = useCallback(() => {
    setSelectedTooth(null);
  }, []);

  return (
    <div className={cn('select-none', className)}>
      {/* Chart container */}
      <div
        className="relative bg-gradient-to-b from-slate-50 to-white rounded-3xl border border-slate-100 p-5 overflow-visible"
        style={{ boxShadow: '0 4px 40px -8px rgba(15,23,42,0.06), 0 0 0 1px rgba(241,245,249,1)' }}
        onClick={e => { if (e.target === e.currentTarget) handleBackdropClick(); }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-black text-slate-800 tracking-tight">Tish Kartasi</h3>
            <p className="text-[10px] text-slate-400 font-bold mt-0.5 uppercase tracking-widest">FDI Tizimi</p>
          </div>
          <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
            <span className="px-2 py-1 bg-slate-100 rounded-lg">O'ng</span>
            <div className="w-px h-4 bg-slate-200" />
            <span className="px-2 py-1 bg-slate-100 rounded-lg">Chap</span>
          </div>
        </div>

        {/* Midline indicator */}
        <div className="relative">
          {/* ═══ UPPER JAW ═══ */}
          <div className="relative">
            <QuadrantLabel label="Yuqori jag'" />

            {/* Upper teeth row — top view */}
            <div className="flex justify-center gap-1">
              {/* Upper Right (18→11, displayed left to right) */}
              <div className="flex gap-0.5 items-end">
                {renderRow(UPPER_RIGHT, true)}
              </div>

              {/* Midline */}
              <div className="w-px bg-gradient-to-b from-transparent via-blue-200 to-transparent mx-0.5 self-stretch" />

              {/* Upper Left (21→28) */}
              <div className="flex gap-0.5 items-end">
                {renderRow(UPPER_LEFT, true)}
              </div>
            </div>
          </div>

          {/* ── Jaw separator ── */}
          <div className="py-2">
            <div className="relative flex items-center justify-center">
              <div className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
              <div className="relative flex items-center gap-3 bg-white px-4 py-1.5 rounded-full border border-slate-100 shadow-sm z-10">
                <div className="w-1.5 h-1.5 rounded-full bg-rose-300 animate-pulse" />
                <span className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-300">Okkluziya</span>
                <div className="w-1.5 h-1.5 rounded-full bg-rose-300 animate-pulse" />
              </div>
            </div>
          </div>

          {/* ═══ LOWER JAW ═══ */}
          <div>
            <div className="flex justify-center gap-1">
              {/* Lower Right (48→41, displayed left to right = reversed) */}
              <div className="flex gap-0.5 items-start">
                {renderRow(LOWER_RIGHT, false, true)}
              </div>

              {/* Midline */}
              <div className="w-px bg-gradient-to-b from-transparent via-blue-200 to-transparent mx-0.5 self-stretch" />

              {/* Lower Left (31→38) */}
              <div className="flex gap-0.5 items-start">
                {renderRow(LOWER_LEFT, false)}
              </div>
            </div>
            <QuadrantLabel label="Pastki jag'" />
          </div>
        </div>

        {/* Click overlay to deselect */}
        {selectedTooth && (
          <div
            className="fixed inset-0 z-40"
            onClick={handleBackdropClick}
          />
        )}
      </div>

      {/* Legend */}
      <Legend />
    </div>
  );
}

// ── Compact Mini Chart (for patient cards) ────────────────────────────────────
export function MiniDentalChart({ teethData = {}, className }) {
  const getStatus = (num) => teethData[num] || 'healthy';
  const allTeeth = [...UPPER_RIGHT, ...UPPER_LEFT, ...LOWER_LEFT.slice().reverse(), ...LOWER_RIGHT.slice().reverse()];

  return (
    <div className={cn('flex flex-wrap gap-0.5 max-w-[200px]', className)}>
      {allTeeth.map(num => {
        const status = getStatus(num);
        const st = TOOTH_STATUS[status];
        return (
          <div
            key={num}
            className="w-3 h-3 rounded-sm border"
            style={{ backgroundColor: st.bg, borderColor: st.border }}
            title={`#${num}: ${st.label}`}
          />
        );
      })}
    </div>
  );
}

// ── Teeth Statistics Summary ──────────────────────────────────────────────────
export function TeethStats({ teethData = {} }) {
  const counts = {};
  Object.keys(TOOTH_STATUS).forEach(k => counts[k] = 0);

  const allTeeth = [...UPPER_RIGHT, ...UPPER_LEFT, ...LOWER_LEFT, ...LOWER_RIGHT];
  allTeeth.forEach(num => {
    const s = teethData[num] || 'healthy';
    counts[s] = (counts[s] || 0) + 1;
  });

  const total = allTeeth.length;
  const healthyCount = counts.healthy || 0;
  const healthPercent = Math.round((healthyCount / total) * 100);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-black text-slate-700 uppercase tracking-widest">Tish holati</span>
        <span className="text-sm font-black" style={{ color: healthPercent > 80 ? '#22c55e' : healthPercent > 60 ? '#f59e0b' : '#ef4444' }}>
          {healthPercent}% Sog'lom
        </span>
      </div>
      {/* Progress bar */}
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: healthPercent > 80 ? '#22c55e' : healthPercent > 60 ? '#f59e0b' : '#ef4444' }}
          initial={{ width: 0 }}
          animate={{ width: `${healthPercent}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
      {/* Count pills */}
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(TOOTH_STATUS)
          .filter(([key]) => counts[key] > 0)
          .map(([key, val]) => (
            <div
              key={key}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border"
              style={{ backgroundColor: val.bg, borderColor: val.border, color: val.color }}
            >
              <span>{counts[key]}</span>
              <span>{val.label}</span>
            </div>
          ))
        }
      </div>
    </div>
  );
}
