import { useState, useCallback, memo, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/LanguageContext';

/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║   PROFESSIONAL DENTAL ODONTOGRAM — FDI Notation System             ║
 * ║   Uses real cliniccards tooth images (crown + root PNGs)           ║
 * ║   Perfect 2x2 grid crosshair layout matching reference design      ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

// ── Status color system — professional dental chart ──────────────────────────
const STATUS = {
  healthy:             { label: "Sog'lom",                     color: '#22c55e', bg: 'rgba(34,197,94,0.08)',   border: '#16a34a' },
  completed:           { label: 'Davolangan',                   color: '#3b82f6', bg: 'rgba(59,130,246,0.10)', border: '#2563eb' },
  in_progress:         { label: 'Jarayonda',                    color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', border: '#d97706' },
  planned:             { label: 'Rejalashtirilgan',             color: '#6366f1', bg: 'rgba(99,102,241,0.10)', border: '#4f46e5' },
  caries:              { label: 'Kariyes',                      color: '#ef4444', bg: 'rgba(239,68,68,0.10)',  border: '#dc2626' },
  cavity:              { label: 'Cavity',                       color: '#18181b', bg: 'rgba(24,24,27,0.08)',   border: '#18181b' },
  secondary_cavity:    { label: 'Secondary cavity',             color: '#f97316', bg: 'rgba(249,115,22,0.10)', border: '#ea580c' },
  fissure_pigmentation:{ label: 'Fissure pigmentation',         color: '#92400e', bg: 'rgba(146,64,14,0.08)',  border: '#78350f' },
  canal_partial:       { label: 'Canal partially sealed',       color: '#f43f5e', bg: 'rgba(244,63,94,0.10)',  border: '#e11d48' },
  calculus:            { label: 'Dental calculus',              color: '#d97706', bg: 'rgba(217,119,6,0.10)',  border: '#b45309' },
  crown:               { label: 'Toj',                          color: '#a855f7', bg: 'rgba(168,85,247,0.10)', border: '#7c3aed' },
  veneer:              { label: 'Veneer',                       color: '#06b6d4', bg: 'rgba(6,182,212,0.10)',  border: '#0891b2' },
  implant:             { label: 'Implant',                      color: '#f97316', bg: 'rgba(249,115,22,0.10)', border: '#ea580c' },
  extracted:           { label: "Tish olingan",                  color: '#94a3b8', bg: 'rgba(148,163,184,0.08)',border: '#64748b' },
  missing:             { label: "Yo'q (Missing)",               color: '#e2e8f0', bg: 'rgba(226,232,240,0.05)',border: '#94a3b8' },
};

// ── Tooth data — FDI standard ─────────────────────────────────────────────────
// ── Tooth data — FDI standard ─────────────────────────────────────────────────
const UPPER_RIGHT = [
  { id: 'ur8', fdi: 18, baseName: 't28', side: 'right', w: 52 },
  { id: 'ur7', fdi: 17, baseName: 't27', side: 'right', w: 52 },
  { id: 'ur6', fdi: 16, baseName: 't26', side: 'right', w: 58 },
  { id: 'ur5', fdi: 15, baseName: 't25', side: 'right', w: 46 },
  { id: 'ur4', fdi: 14, baseName: 't24', side: 'right', w: 46 },
  { id: 'ur3', fdi: 13, baseName: 't23', side: 'right', w: 42 },
  { id: 'ur2', fdi: 12, baseName: 't22', side: 'right', w: 36 },
  { id: 'ur1', fdi: 11, baseName: 't21', side: 'right', w: 42 },
];
const UPPER_LEFT = [
  { id: 'ul1', fdi: 21, baseName: 't11', side: 'left',  w: 42 },
  { id: 'ul2', fdi: 22, baseName: 't12', side: 'left',  w: 36 },
  { id: 'ul3', fdi: 23, baseName: 't13', side: 'left',  w: 42 },
  { id: 'ul4', fdi: 24, baseName: 't14', side: 'left',  w: 46 },
  { id: 'ul5', fdi: 25, baseName: 't15', side: 'left',  w: 46 },
  { id: 'ul6', fdi: 26, baseName: 't16', side: 'left',  w: 58 },
  { id: 'ul7', fdi: 27, baseName: 't17', side: 'left',  w: 52 },
  { id: 'ul8', fdi: 28, baseName: 't18', side: 'left',  w: 52 },
];
const LOWER_RIGHT = [
  { id: 'lr8', fdi: 48, baseName: 't38', side: 'right', w: 52 },
  { id: 'lr7', fdi: 47, baseName: 't37', side: 'right', w: 52 },
  { id: 'lr6', fdi: 46, baseName: 't36', side: 'right', w: 58 },
  { id: 'lr5', fdi: 45, baseName: 't35', side: 'right', w: 46 },
  { id: 'lr4', fdi: 44, baseName: 't34', side: 'right', w: 46 },
  { id: 'lr3', fdi: 43, baseName: 't33', side: 'right', w: 42 },
  { id: 'lr2', fdi: 42, baseName: 't32', side: 'right', w: 36 },
  { id: 'lr1', fdi: 41, baseName: 't31', side: 'right', w: 42 },
];
const LOWER_LEFT = [
  { id: 'll1', fdi: 31, baseName: 't41', side: 'left',  w: 42 },
  { id: 'll2', fdi: 32, baseName: 't42', side: 'left',  w: 36 },
  { id: 'll3', fdi: 33, baseName: 't43', side: 'left',  w: 42 },
  { id: 'll4', fdi: 34, baseName: 't44', side: 'left',  w: 46 },
  { id: 'll5', fdi: 35, baseName: 't45', side: 'left',  w: 46 },
  { id: 'll6', fdi: 36, baseName: 't46', side: 'left',  w: 58 },
  { id: 'll7', fdi: 37, baseName: 't47', side: 'left',  w: 52 },
  { id: 'll8', fdi: 38, baseName: 't48', side: 'left',  w: 52 },
];

// Child teeth
const CHILD_UPPER_RIGHT = [
  { id: 'ur5c', fdi: 55, baseName: 't15_25', side: 'right', w: 46 },
  { id: 'ur4c', fdi: 54, baseName: 't14_24', side: 'right', w: 46 },
  { id: 'ur3c', fdi: 53, baseName: 't13_23', side: 'right', w: 42 },
  { id: 'ur2c', fdi: 52, baseName: 't12_22', side: 'right', w: 36 },
  { id: 'ur1c', fdi: 51, baseName: 't11_21', side: 'right', w: 42 },
];
const CHILD_UPPER_LEFT = [
  { id: 'ul1c', fdi: 61, baseName: 't11_21', side: 'left',  w: 42 },
  { id: 'ul2c', fdi: 62, baseName: 't12_22', side: 'left',  w: 36 },
  { id: 'ul3c', fdi: 63, baseName: 't13_23', side: 'left',  w: 42 },
  { id: 'ul4c', fdi: 64, baseName: 't14_24', side: 'left',  w: 46 },
  { id: 'ul5c', fdi: 65, baseName: 't15_25', side: 'left',  w: 46 },
];
const CHILD_LOWER_RIGHT = [
  { id: 'lr5c', fdi: 85, baseName: 't45_35', side: 'right', w: 46 },
  { id: 'lr4c', fdi: 84, baseName: 't44_34', side: 'right', w: 46 },
  { id: 'lr3c', fdi: 83, baseName: 't43_33', side: 'right', w: 42 },
  { id: 'lr2c', fdi: 82, baseName: 't42_32', side: 'right', w: 36 },
  { id: 'lr1c', fdi: 81, baseName: 't41_31', side: 'right', w: 42 },
];
const CHILD_LOWER_LEFT = [
  { id: 'll1c', fdi: 71, baseName: 't41_31', side: 'left',  w: 42 },
  { id: 'll2c', fdi: 72, baseName: 't42_32', side: 'left',  w: 36 },
  { id: 'll3c', fdi: 73, baseName: 't43_33', side: 'left',  w: 42 },
  { id: 'll4c', fdi: 74, baseName: 't44_34', side: 'left',  w: 46 },
  { id: 'll5c', fdi: 75, baseName: 't45_35', side: 'left',  w: 46 },
];

const getOverlayStyle = (statusKey) => {
  if (!statusKey || statusKey === 'healthy') return null;
  const st = STATUS[statusKey];
  if (!st) return null;
  return { backgroundColor: st.color, opacity: 0.28, mixBlendMode: 'multiply' };
};

// ── Single Tooth Column ───────────────────────────────────────────────────────
const ToothColumn = memo(function ToothColumn({
  id, fdi, baseName, side, isUpper, w,
  selected, isFocused, toothStatus, isDisabled, onClick,
  isPsrAlert = false,
  showOcclusal = true,
  compact = true,
}) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState(false);
  const statusKey = toothStatus?.status;
  const st = STATUS[statusKey] || STATUS.healthy;
  const hasImplant = statusKey === 'implant' || Boolean(toothStatus?.hasImplant);
  const hasExtractedHistory = Boolean(toothStatus?.isExtracted || statusKey === 'extracted' || statusKey === 'missing');
  const isExtracted = (statusKey === 'extracted' || statusKey === 'missing') && !hasImplant;

  // _root.png  = full LATERAL side view (root pointing UP in source image)
  // _crown.png = small OCCLUSAL top-down view (the oval biting surface)
  const lateralSrc  = `/teeth/cliniccards/${baseName}_root.png`;
  const occlusalSrc = `/teeth/cliniccards/${baseName}_crown.png`;

  // If it's a shared image (e.g. t11_21), it needs mirroring on left side.
  // Unique images (e.g. t11, t12) are mirrored horizontally to align curvature distally.
  const isShared = baseName.includes('_');
  const hFlip = isShared ? (side === 'left') : true;
  const vFlip = isShared ? (!isUpper) : false;

  const lateralTransform = (() => {
    if (hFlip && vFlip) return 'scale(-1, -1)';
    if (vFlip)          return 'scaleY(-1)';
    if (hFlip)          return 'scaleX(-1)';
    return 'none';
  })();
  const occlusalTransform = hFlip ? 'scaleX(-1)' : 'none';

  const overlayStyle = !isExtracted ? getOverlayStyle(statusKey) : null;
  const psrOverlayStyle = !isExtracted && !isUpper && isPsrAlert 
    ? { backgroundColor: '#ef4444', opacity: 0.45, mixBlendMode: 'multiply' } 
    : (!isExtracted && isUpper && isPsrAlert ? { backgroundColor: '#ef4444', opacity: 0.45, mixBlendMode: 'multiply' } : null);

  const containerOpacity = isDisabled && !selected ? 0.35 : 1;

  let filterStyle = '';
  if (selected)                    filterStyle = `drop-shadow(0 0 8px ${st.color}90)`;
  else if (isFocused)              filterStyle = `drop-shadow(0 0 6px #3b82f680)`;
  else if (hovered && !isDisabled) filterStyle = `drop-shadow(0 2px 6px ${st.color}50)`;

  // Lateral view height (the tall side-profile) and occlusal view height (small oval)
  const LATERAL_H  = compact ? 48 : 80;
  const OCCLUSAL_H = compact ? 15 : 24;
  const scaleFactor = compact ? 0.54 : 0.75;

  const ToothImg = ({ src, alt, isCrown, transform }) => {
    const isRootAlert = !isCrown && isPsrAlert;
    const cond = String(toothStatus?.condition || '').toLowerCase();
    const treat = String(toothStatus?.treatment || '').toLowerCase();
    const serviceName = String(toothStatus?.serviceName || toothStatus?.service_name || '').toLowerCase();
    const combined = `${cond} ${treat} ${serviceName}`.trim();

    // Condition detection — matching professional dental chart
    const hasCavity = combined.includes('cavity') || combined.includes('decay') || combined.includes('kariyes') || statusKey === 'caries' || statusKey === 'cavity';
    const hasSecondaryCavity = combined.includes('secondary') || combined.includes('ikkilamchi') || combined.includes('vtorichn') || statusKey === 'secondary_cavity';
    const hasFilling = combined.includes('filling') || combined.includes('plomba') || combined.includes('restavratsiya') || combined.includes('vinir') || combined.includes('crown') || combined.includes('toj') || statusKey === 'completed' || statusKey === 'crown' || statusKey === 'veneer' || statusKey === 'in_progress';
    const hasCanal = combined.includes('canal') || combined.includes('pulpit') || combined.includes('endo') || combined.includes('apical') || combined.includes('sealed') || combined.includes('kanal') || statusKey === 'canal_partial';
    const isCanalPartial = combined.includes('partial') || combined.includes('qisman') || statusKey === 'canal_partial';
    const hasCalculus = combined.includes('calculus') || combined.includes('tosh') || combined.includes('kamen') || statusKey === 'calculus';
    const hasPeriodontit = combined.includes('periodontit') || combined.includes('gingivit');
    const hasFissurePigment = combined.includes('fissure') || combined.includes('pigment') || combined.includes('initial caries') || combined.includes('boshlang') || statusKey === 'fissure_pigmentation';
    const isCrownRestoration = combined.includes('crown') || combined.includes('toj') || combined.includes('karonka') || statusKey === 'crown';
    const hasImplant = combined.includes('implant') || statusKey === 'implant';

    return (
      <div
        className="relative flex justify-center items-center w-full"
        style={{ height: isCrown ? OCCLUSAL_H : LATERAL_H, overflow: 'hidden', flexShrink: 0 }}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            transform,
            filter: isExtracted ? 'grayscale(1) opacity(0.25)' : (hasImplant && hasExtractedHistory ? 'grayscale(0.6) opacity(0.5)' : undefined),
          }}
        />
        {/* Status color overlay — skip for conditions that have dedicated SVG */}
        {overlayStyle && !isExtracted && !hasCavity && !hasFilling && !hasCanal && !hasCalculus && !hasFissurePigment && !hasSecondaryCavity && !hasImplant && (
          <div className="absolute inset-0 pointer-events-none" style={overlayStyle} />
        )}
        {/* PSR alert red overlay on lateral roots view */}
        {isRootAlert && (
          <div className="absolute inset-0 pointer-events-none" style={{ backgroundColor: '#dc2626', opacity: 0.4, mixBlendMode: 'multiply' }} />
        )}

        {/* ═══════ 1. OCCLUSAL CROWN OVERLAYS ═══════ */}

        {/* Implant Hex on occlusal view */}
        {isCrown && !isExtracted && hasImplant && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox="0 0 100 100" preserveAspectRatio="none">
            <circle cx="50" cy="50" r="18" fill="#f97316" fillOpacity="0.3" stroke="#ea580c" strokeWidth="2.5" />
            <polygon points="50,38 60,44 60,56 50,62 40,56 40,44" fill="#ea580c" />
          </svg>
        )}

        {/* Filling / Restoration — pink area with dark fissure lines */}
        {isCrown && !isExtracted && hasFilling && !hasSecondaryCavity && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path
              d="M 22 35 Q 50 20 78 35 Q 88 52 78 72 Q 50 88 22 72 Q 12 52 22 35 Z"
              fill="#f8a5a5"
              fillOpacity="0.85"
              stroke="#1e293b"
              strokeWidth="3.5"
              strokeLinejoin="round"
            />
            <path d="M 32 46 Q 50 56 68 46 M 50 32 L 50 72" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        )}

        {/* Secondary Cavity — filling + orange decay around the filling edge */}
        {isCrown && !isExtracted && hasSecondaryCavity && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox="0 0 100 100" preserveAspectRatio="none">
            {/* Outer orange ring — secondary decay */}
            <path
              d="M 18 30 Q 50 14 82 30 Q 94 52 82 76 Q 50 92 18 76 Q 6 52 18 30 Z"
              fill="#f97316"
              fillOpacity="0.35"
              stroke="#ea580c"
              strokeWidth="2.5"
              strokeDasharray="5,3"
            />
            {/* Inner pink filling */}
            <path
              d="M 26 38 Q 50 24 74 38 Q 84 52 74 68 Q 50 82 26 68 Q 16 52 26 38 Z"
              fill="#f8a5a5"
              fillOpacity="0.85"
              stroke="#1e293b"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            <path d="M 34 48 Q 50 56 66 48" stroke="#1e293b" strokeWidth="2" strokeLinecap="round" />
          </svg>
        )}

        {/* Cavity / Caries — dark black area (bo'shliq) */}
        {isCrown && !isExtracted && hasCavity && !hasFilling && !hasSecondaryCavity && !hasFissurePigment && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path
              d="M 28 36 Q 50 22 72 36 Q 84 52 72 72 Q 50 86 28 72 Q 16 52 28 36 Z"
              fill="#18181b"
              stroke="#000000"
              strokeWidth="3"
            />
            {/* Thin red interior crack lines */}
            <path d="M 38 46 Q 50 54 62 46" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M 44 56 Q 50 62 56 56" stroke="#ef4444" strokeWidth="1" strokeLinecap="round" />
          </svg>
        )}

        {/* Fissure Pigmentation (initial caries) — brown spots in fissures */}
        {isCrown && !isExtracted && hasFissurePigment && !hasFilling && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox="0 0 100 100" preserveAspectRatio="none">
            {/* Brown/amber fissure pigmentation spots */}
            <path d="M 34 44 Q 50 55 66 44" stroke="#92400e" strokeWidth="3.5" fill="none" strokeLinecap="round" opacity="0.8" />
            <path d="M 42 52 Q 50 58 58 52" stroke="#78350f" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.7" />
            <circle cx="50" cy="48" r="4" fill="#92400e" opacity="0.5" />
            <circle cx="42" cy="44" r="2.5" fill="#78350f" opacity="0.45" />
            <circle cx="58" cy="44" r="2.5" fill="#78350f" opacity="0.45" />
          </svg>
        )}

        {/* Canal — red/pink pulp chamber center */}
        {isCrown && !isExtracted && hasCanal && !hasCavity && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox="0 0 100 100" preserveAspectRatio="none">
            <circle cx="50" cy="50" r="16" fill="#f43f5e" stroke="#1e293b" strokeWidth="3" />
            <circle cx="50" cy="50" r="6" fill="#1e293b" />
          </svg>
        )}

        {/* ═══════ 2. LATERAL ROOT & CROWN VIEW OVERLAYS ═══════ */}

        {/* Implant Screw on lateral root view */}
        {!isCrown && !isExtracted && hasImplant && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox="0 0 100 100" preserveAspectRatio="none">
            {/* Implant cylinder screw body */}
            <rect
              x="36"
              y={isUpper ? "15" : "35"}
              width="28"
              height="50"
              rx="3"
              fill="#f97316"
              fillOpacity="0.25"
              stroke="#ea580c"
              strokeWidth="2.5"
            />
            {/* Threads */}
            <line x1="32" y1={isUpper ? "26" : "46"} x2="68" y2={isUpper ? "26" : "46"} stroke="#ea580c" strokeWidth="2.2" strokeLinecap="round" />
            <line x1="32" y1={isUpper ? "38" : "58"} x2="68" y2={isUpper ? "38" : "58"} stroke="#ea580c" strokeWidth="2.2" strokeLinecap="round" />
            <line x1="32" y1={isUpper ? "50" : "70"} x2="68" y2={isUpper ? "50" : "70"} stroke="#ea580c" strokeWidth="2.2" strokeLinecap="round" />
            <line x1="34" y1={isUpper ? "62" : "82"} x2="66" y2={isUpper ? "62" : "82"} stroke="#ea580c" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        )}

        {/* Canal (full) — pink/red line down the full root */}
        {!isCrown && !isExtracted && hasCanal && !isCanalPartial && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox="0 0 100 100" preserveAspectRatio="none">
            <line
              x1="50" y1={isUpper ? "10" : "90"}
              x2="50" y2={isUpper ? "90" : "10"}
              stroke="#f43f5e"
              strokeWidth="7"
              strokeLinecap="round"
              opacity="0.95"
            />
            <line
              x1="50" y1={isUpper ? "10" : "90"}
              x2="50" y2={isUpper ? "90" : "10"}
              stroke="#1e293b"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </svg>
        )}

        {/* Canal partially sealed — line goes only halfway down the root */}
        {!isCrown && !isExtracted && hasCanal && isCanalPartial && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox="0 0 100 100" preserveAspectRatio="none">
            <line
              x1="50" y1={isUpper ? "50" : "50"}
              x2="50" y2={isUpper ? "90" : "10"}
              stroke="#f43f5e"
              strokeWidth="7"
              strokeLinecap="round"
              opacity="0.9"
            />
            <line
              x1="50" y1={isUpper ? "50" : "50"}
              x2="50" y2={isUpper ? "90" : "10"}
              stroke="#1e293b"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            {/* Dashed unfilled portion */}
            <line
              x1="50" y1={isUpper ? "10" : "90"}
              x2="50" y2={isUpper ? "48" : "52"}
              stroke="#f43f5e"
              strokeWidth="3"
              strokeDasharray="4,4"
              strokeLinecap="round"
              opacity="0.5"
            />
          </svg>
        )}

        {/* Filling / Crown restoration on lateral view — pink crown overlay */}
        {!isCrown && !isExtracted && (hasFilling || isCrownRestoration) && !hasSecondaryCavity && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path
              d={isUpper
                ? "M 18 55 Q 50 48 82 55 L 82 85 Q 50 92 18 85 Z"
                : "M 18 15 Q 50 8 82 15 L 82 45 Q 50 52 18 45 Z"
              }
              fill="#f8a5a5"
              fillOpacity="0.8"
              stroke="#1e293b"
              strokeWidth="2.8"
              strokeLinejoin="round"
            />
          </svg>
        )}

        {/* Secondary cavity on lateral view — filling + orange decay band */}
        {!isCrown && !isExtracted && hasSecondaryCavity && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox="0 0 100 100" preserveAspectRatio="none">
            {/* Orange decay band at margin */}
            <path
              d={isUpper
                ? "M 14 52 Q 50 44 86 52 L 86 60 Q 50 52 14 60 Z"
                : "M 14 40 Q 50 48 86 40 L 86 48 Q 50 56 14 48 Z"
              }
              fill="#f97316"
              fillOpacity="0.55"
              stroke="#ea580c"
              strokeWidth="1.5"
              strokeDasharray="4,3"
            />
            {/* Pink filling area */}
            <path
              d={isUpper
                ? "M 18 58 Q 50 52 82 58 L 82 85 Q 50 92 18 85 Z"
                : "M 18 15 Q 50 8 82 15 L 82 42 Q 50 48 18 42 Z"
              }
              fill="#f8a5a5"
              fillOpacity="0.8"
              stroke="#1e293b"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
          </svg>
        )}

        {/* Cavity on lateral view — dark ellipse on crown area */}
        {!isCrown && !isExtracted && hasCavity && !hasFilling && !hasSecondaryCavity && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox="0 0 100 100" preserveAspectRatio="none">
            <ellipse
              cx="50"
              cy={isUpper ? "72" : "28"}
              rx="20"
              ry="14"
              fill="#18181b"
              stroke="#000000"
              strokeWidth="2.5"
            />
            {/* Inner red crack */}
            <ellipse
              cx="50"
              cy={isUpper ? "72" : "28"}
              rx="10"
              ry="6"
              fill="none"
              stroke="#ef4444"
              strokeWidth="1.2"
              opacity="0.7"
            />
          </svg>
        )}

        {/* Fissure pigmentation on lateral — brown dots at crown edge */}
        {!isCrown && !isExtracted && hasFissurePigment && !hasCavity && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox="0 0 100 100" preserveAspectRatio="none">
            <circle cx="40" cy={isUpper ? "75" : "25"} r="5" fill="#92400e" opacity="0.45" />
            <circle cx="60" cy={isUpper ? "75" : "25"} r="5" fill="#92400e" opacity="0.45" />
            <circle cx="50" cy={isUpper ? "70" : "30"} r="4" fill="#78350f" opacity="0.35" />
          </svg>
        )}

        {/* Dental Calculus — yellow-brown deposits at gumline */}
        {!isCrown && !isExtracted && (hasCalculus || hasPeriodontit) && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox="0 0 100 100" preserveAspectRatio="none">
            {/* Irregular calculus deposits at the cervical neck */}
            <path
              d={isUpper
                ? "M 20,54 Q 30,48 40,52 Q 50,46 60,52 Q 70,48 80,54"
                : "M 20,46 Q 30,52 40,48 Q 50,54 60,48 Q 70,52 80,46"
              }
              fill="none"
              stroke="#b45309"
              strokeWidth="5"
              strokeLinecap="round"
              opacity="0.75"
            />
            {/* Lighter inner calculus band */}
            <path
              d={isUpper
                ? "M 25,56 Q 40,50 55,54 Q 65,50 75,56"
                : "M 25,44 Q 40,50 55,46 Q 65,50 75,44"
              }
              fill="none"
              stroke="#d97706"
              strokeWidth="3"
              strokeLinecap="round"
              opacity="0.6"
            />
          </svg>
        )}

        {/* ═══════ 3. MISSING / EXTRACTED ═══════ */}
        {isExtracted && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <svg className="w-6 h-6 text-rose-600/90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </div>
        )}

        {/* Selection border + checkmark */}
        {isCrown && selected && (
          <>
            <div className="absolute pointer-events-none" style={{ inset: '-2px -1px', border: `2px solid ${st.color}`, borderRadius: '4px', zIndex: 15, boxShadow: `0 0 8px ${st.color}40` }} />
            <div className="absolute w-4 h-4 rounded-full flex items-center justify-center shadow-lg pointer-events-none" style={{ backgroundColor: st.color, border: '1.5px solid white', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 20 }}>
              <Check style={{ width: 9, height: 9, color: '#fff', strokeWidth: 3.5 }} />
            </div>
          </>
        )}
      </div>
    );
  };

  const labelCls = cn(
    'relative z-10 text-[9px] font-[900] leading-none px-0.5 rounded transition-all duration-200 text-center tabular-nums w-full',
    selected ? 'text-white' : hovered ? 'text-slate-700' : 'text-slate-400',
  );

  return (
    <motion.div
      className="relative flex flex-col items-center select-none"
      style={{ width: w * scaleFactor, opacity: containerOpacity, cursor: isDisabled && !selected ? 'not-allowed' : 'pointer', filter: filterStyle, transition: 'filter 0.2s ease, opacity 0.2s ease' }}
      whileHover={!isDisabled ? { scale: 1.06 } : {}}
      whileTap={!isDisabled ? { scale: 0.94 } : {}}
      onHoverStart={() => !isDisabled && setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      onClick={() => !isDisabled && onClick(id)}
    >
      {isUpper ? (
        /* UPPER JAW: lateral(roots up) → occlusal(oval) → number */
        <>
          <ToothImg src={lateralSrc}  alt={`#${fdi} yon`}     isCrown={false} transform={lateralTransform}  />
          {showOcclusal && <ToothImg src={occlusalSrc} alt={`#${fdi} oklüzal`} isCrown={true}  transform={occlusalTransform} />}
          <div className={labelCls} style={selected ? { backgroundColor: st.color, marginTop: 2 } : { marginTop: 2 }}>{fdi}</div>
        </>
      ) : (
        /* LOWER JAW: number → occlusal(oval) → lateral(roots down) */
        <>
          <div className={labelCls} style={selected ? { backgroundColor: st.color, marginBottom: 2 } : { marginBottom: 2 }}>{fdi}</div>
          {showOcclusal && <ToothImg src={occlusalSrc} alt={`#${fdi} oklüzal`} isCrown={true}  transform={occlusalTransform} />}
          <ToothImg src={lateralSrc}  alt={`#${fdi} yon`}     isCrown={false} transform={lateralTransform}  />
        </>
      )}

      {/* Hover tooltip */}
      <AnimatePresence>
        {hovered && (statusKey !== 'healthy' || hasExtractedHistory) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: isUpper ? 4 : -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85 }}
            className="absolute z-50 pointer-events-none whitespace-nowrap"
            style={{ [isUpper ? 'bottom' : 'top']: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 4, marginBottom: 4 }}
          >
            <div className="px-2 py-1 rounded-lg text-[9px] font-[800] text-white shadow-xl" style={{ backgroundColor: st.color }}>
              #{fdi} — {hasExtractedHistory && hasImplant ? "Tish olingan + Implantat" : (t('odontogram.statuses.' + statusKey) || st.label)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

ToothColumn.displayName = 'ToothColumn';

// ── Stats Summary ─────────────────────────────────────────────────────────────
const StatsSummary = memo(({ toothStatuses, allTeeth }) => {
  const { t } = useTranslation();
  const counts = useMemo(() => {
    const c = {};
    allTeeth.forEach(t => {
      const stObj = toothStatuses[t.id];
      const s = stObj?.status || 'healthy';
      if (s !== 'healthy') {
        c[s] = (c[s] || 0) + 1;
      } else {
        c.healthy = (c.healthy || 0) + 1;
      }
      // If the tooth was extracted alongside another status
      if (stObj?.isExtracted && s !== 'extracted') {
        c['extracted'] = (c['extracted'] || 0) + 1;
      }
    });
    return c;
  }, [toothStatuses, allTeeth]);

  const total = allTeeth.length;
  const healthy = counts.healthy || 0;
  const pct = Math.round((healthy / total) * 100);
  const barColor = pct >= 80 ? '#22c55e' : pct >= 60 ? '#f59e0b' : '#ef4444';

  const nonHealthy = Object.entries(counts).filter(([k, v]) => k !== 'healthy' && v > 0);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-2.5 border-t border-slate-100 bg-slate-50/60 w-full overflow-hidden">
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-[10px] font-[900] uppercase tracking-wider text-slate-500">{t('odontogram.statuses.healthy')}</span>
        <div className="w-20 h-2 bg-slate-200/80 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: barColor }}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.9, ease: 'easeOut', delay: 0.3 }}
          />
        </div>
        <span className="text-[11px] font-[900]" style={{ color: barColor }}>{pct}%</span>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {nonHealthy.map(([key, cnt]) => {
          const st = STATUS[key];
          if (!st) return null;
          return (
            <div
              key={key}
              className="flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[9px] font-[800]"
              style={{ backgroundColor: st.bg, borderColor: st.border + '60', color: st.color }}
            >
              <span>{cnt}</span>
              <span>×</span>
              <span>{t('odontogram.statuses.' + key) || st.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
});

// ── Legend ────────────────────────────────────────────────────────────────────
const Legend = memo(() => {
  const { t } = useTranslation();
  return (
    <div className="px-4 sm:px-6 py-2.5 border-t border-slate-100 bg-slate-50/40 flex flex-wrap items-center gap-x-3 gap-y-2 w-full">
      {Object.entries(STATUS).map(([key, val]) => (
        <div key={key} className="flex items-center gap-1.5 flex-shrink-0 px-2 py-0.5 rounded-md bg-white border border-slate-200/60 shadow-2xs">
          <div
            className="w-2.5 h-2.5 rounded-xs border shrink-0"
            style={{ backgroundColor: val.bg, borderColor: val.border }}
          />
          <span className="text-[10px] font-[700] text-slate-600 whitespace-nowrap">
            {t('odontogram.statuses.' + key) || val.label}
          </span>
        </div>
      ))}
    </div>
  );
});

// ── Batch Controls ────────────────────────────────────────────────────────────
const BatchControls = memo(({ allUpper, allLower, allTeethIds, onChange }) => {
  const { t } = useTranslation();
  const buttons = [
    { label: t('odontogram.batch.upper') || '▲ Tepa tishlar',  ids: allUpper,    danger: false },
    { label: t('odontogram.batch.lower') || '▼ Pastki tishlar',ids: allLower,    danger: false },
    { label: t('odontogram.batch.all') || '◈ Barchasi',      ids: allTeethIds, danger: false },
    { label: t('odontogram.batch.clear') || '✕ Tozalash',      ids: [],          danger: true  },
  ];
  return (
    <div className="px-5 py-2 border-t border-slate-50 flex flex-wrap gap-2">
      {buttons.map((btn, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(btn.ids)}
          className={cn(
            'px-3 py-1 text-[9px] font-[900] uppercase tracking-widest border rounded-lg transition-all active:scale-95',
            btn.danger
              ? 'bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-100'
              : 'bg-slate-50 text-slate-500 border-slate-100 hover:bg-slate-100'
          )}
        >
          {btn.label}
        </button>
      ))}
    </div>
  );
});

// ── Main ProfessionalOdontogram Component ─────────────────────────────────────
function ProfessionalOdontogram({
  selectedTeeth   = [],
  onChange        = () => {},
  multi           = false,
  toothStatuses   = {},
  onToothClick,
  focusedTooth    = null,
  showBatchControls = false,
  patientType     = 'adult',
  chartView       = 'teeth',
  quadrantFilter  = 'all',
  showOcclusal    = true,
  psrScores       = {},
  onPatientTypeChange,
  occlusionClass  = 'Class I',
  onOcclusionClassChange = () => {},
  occlusionNotes  = '',
  onOcclusionNotesChange = () => {},
  disabledTeeth   = [],
  hideHeader      = false,
  hideLegend      = false,
  hideStats       = false,
  compact         = true,
  patientAge      = null
}) {
  const { t } = useTranslation();

  const [scale, setScale] = useState(1);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const baseWidth = compact ? 390 : 560;
      // Chart base is 390px when compact.
      // We calculate fluid scale to fit the viewport with layout safe margins.
      const margin = width < 380 ? 32 : 48;
      const targetWidth = Math.min(width - margin, baseWidth);
      const calculatedScale = targetWidth / baseWidth;
      setScale(Math.max(calculatedScale, 0.55));
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [compact]);
  const upperRight = patientType === 'child' ? CHILD_UPPER_RIGHT : UPPER_RIGHT;
  const upperLeft  = patientType === 'child' ? CHILD_UPPER_LEFT  : UPPER_LEFT;
  const lowerRight = patientType === 'child' ? CHILD_LOWER_RIGHT : LOWER_RIGHT;
  const lowerLeft  = patientType === 'child' ? CHILD_LOWER_LEFT  : LOWER_LEFT;

  const allTeeth  = useMemo(() => [...upperRight, ...upperLeft, ...lowerRight, ...lowerLeft], [upperRight, upperLeft, lowerRight, lowerLeft]);
  const allUpper  = useMemo(() => [...upperRight, ...upperLeft].map(t => t.id), [upperRight, upperLeft]);
  const allLower  = useMemo(() => [...lowerRight, ...lowerLeft].map(t => t.id), [lowerRight, lowerLeft]);
  const disabledSet = useMemo(() => new Set(disabledTeeth.map(String)), [disabledTeeth]);
  const handleToothClick = useCallback((toothId) => {
    if (onToothClick) onToothClick(toothId);
    if (multi) {
      const next = selectedTeeth.includes(toothId)
        ? selectedTeeth.filter(id => id !== toothId)
        : [...selectedTeeth, toothId];
      onChange(next);
    } else {
      onChange([toothId]);
    }
  }, [onToothClick, multi, selectedTeeth, onChange]);

  const getSextant = (fdi) => {
    const num = parseInt(fdi);
    if (isNaN(num)) return null;
    if (num >= 14 && num <= 18) return 's1';
    if ((num >= 11 && num <= 13) || (num >= 21 && num <= 23)) return 's2';
    if (num >= 24 && num <= 28) return 's3';
    if (num >= 34 && num <= 38) return 's4';
    if ((num >= 31 && num <= 33) || (num >= 41 && num <= 43)) return 's5';
    if (num >= 44 && num <= 48) return 's6';
    return null;
  };

  const renderRow = (teeth, isUpper) =>
    teeth.map(tooth => {
      const sextant = getSextant(tooth.fdi);
      const score = psrScores?.[sextant] || 0;
      const isPsrAlert = score >= 3;
      return (
        <ToothColumn
          key={tooth.id}
          {...tooth}
          isUpper={isUpper}
          selected={selectedTeeth.includes(tooth.id)}
          isFocused={focusedTooth === tooth.id}
          toothStatus={toothStatuses[tooth.id]}
          isDisabled={disabledSet.has(String(tooth.id))}
          onClick={handleToothClick}
          isPsrAlert={isPsrAlert}
          showOcclusal={showOcclusal}
          compact={compact}
        />
      );
    });

  if (chartView === 'occlusion') {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden w-full">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-50 bg-gradient-to-br from-slate-50 to-slate-100/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-sm">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 2v20M2 12h20"/></svg>
            </div>
            <div>
              <p className="text-[13px] font-[900] text-slate-800 uppercase tracking-tight">{t('odontogram.occlusionTitle') || 'Okklyuziya va Tishlam holati'}</p>
              <p className="text-[9px] font-[700] text-slate-400 uppercase tracking-[0.2em]">{t('odontogram.occlusionSubtitle') || 'Jag\'lar kontakti va tishlamni qayd etish'}</p>
            </div>
          </div>
        </div>

        {/* Occlusion Main Panel */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Centered Crosshair / Coordinate System */}
          <div className="flex flex-col items-center justify-center bg-slate-50 rounded-2xl border border-slate-100 p-6 min-h-[300px] relative">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">{t('odontogram.contactLines') || 'Jag\'lar kontakt chiziqlari'}</p>
            
            {/* The Axis Cross */}
            <div className="w-64 h-64 relative border border-dashed border-slate-200 rounded-full flex items-center justify-center bg-white shadow-inner">
              {/* Vertical Line */}
              <div className="absolute w-0.5 h-full bg-slate-300 left-1/2 -translate-x-1/2" />
              {/* Horizontal Line */}
              <div className="absolute h-0.5 w-full bg-slate-300 top-1/2 -translate-y-1/2" />
              
              {/* Centered Target Dot */}
              <div className="absolute w-4 h-4 bg-indigo-600 rounded-full shadow-lg border-2 border-white z-10 animate-pulse" />
              
              {/* Label quadrants */}
              <span className="absolute top-4 left-4 text-[9px] font-bold text-slate-400 uppercase">I (Max Right)</span>
              <span className="absolute top-4 right-4 text-[9px] font-bold text-slate-400 uppercase">II (Max Left)</span>
              <span className="absolute bottom-4 left-4 text-[9px] font-bold text-slate-400 uppercase">IV (Mand Right)</span>
              <span className="absolute bottom-4 right-4 text-[9px] font-bold text-slate-400 uppercase">III (Mand Left)</span>
            </div>
          </div>

          {/* Right: Occlusion Control Form */}
          <div className="space-y-4">
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">{t('odontogram.biteCategory') || 'Tishlam toifasi (Angle Klassifikatsiyasi)'}</label>
              <select 
                value={occlusionClass}
                onChange={e => onOcclusionClassChange(e.target.value)}
                className="w-full h-10 px-3 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              >
                <option value="Class I">{t('odontogram.biteClasses.class1') || 'Class I (Normal tishlam)'}</option>
                <option value="Class II Division 1">{t('odontogram.biteClasses.class2div1') || 'Class II Division 1 (Distal, oldingi tishlar qiyshaygan)'}</option>
                <option value="Class II Division 2">{t('odontogram.biteClasses.class2div2') || 'Class II Division 2 (Distal, oldingi tishlar ichkariga)'}</option>
                <option value="Class III">{t('odontogram.biteClasses.class3') || 'Class III (Mezial, pastki jag\' oldinda)'}</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">{t('odontogram.contactDefects') || 'Kontakt nuqsonlari (Bite Anomalies)'}</label>
              <div className="grid grid-cols-2 gap-2">
                {['Normal', 'Premature', 'Crossbite', 'Open bite', 'Deep bite'].map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      const currentNotes = occlusionNotes ? `${occlusionNotes}\n• ${c} kontakt` : `• ${c} kontakt`;
                      onOcclusionNotesChange(currentNotes);
                    }}
                    className="px-3 py-2 bg-slate-50 border border-slate-100 hover:border-indigo-100 rounded-xl text-[10px] font-semibold text-slate-600 hover:text-indigo-600 hover:bg-indigo-50/30 transition-all text-left"
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">{t('odontogram.doctorNotes') || 'Tishlam bo\'yicha shifokor yozuvlari'}</label>
              <textarea
                value={occlusionNotes}
                onChange={e => onOcclusionNotesChange(e.target.value)}
                placeholder={t('odontogram.doctorNotesPlaceholder') || "Jag'larning o'zaro tishlam holati, kontakt nuqtalari va tahrirlari bo'yicha batafsil izohlar kiriting..."}
                className="w-full h-32 p-3 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "bg-white w-full",
        !hideHeader && "rounded-xl border border-slate-200/90 overflow-hidden shadow-xs"
      )}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      {!hideHeader && onPatientTypeChange && (patientAge === null || patientAge <= 15) && (
        <div
          className="flex items-center justify-end px-3.5 py-1.5 border-b border-slate-100 bg-slate-50/70"
        >
          <div className="flex items-center bg-slate-100/80 rounded-lg p-0.5 border border-slate-200/60">
            {[['adult', t('odontogram.patientTypes.adult') || 'Kattalar'], ['child', t('odontogram.patientTypes.child') || 'Bolalar']].map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => onPatientTypeChange(val)}
                className={cn(
                  'px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer',
                  patientType === val
                    ? 'bg-white text-slate-800 shadow-xs border border-slate-200/80'
                    : 'text-slate-500 hover:text-slate-700',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Chart Area ──────────────────────────────────────────────────── */}
      <div className="pt-3 pb-2 px-2 flex justify-center w-full overflow-hidden">
        {quadrantFilter === 'Q1' ? (
          <div className="flex flex-col items-center gap-2 p-3 bg-slate-50/70 border border-slate-200 rounded-xl shadow-2xs">
            <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-700 font-mono">Q1 — O'ng Yuqori Jag' (18 - 11)</span>
            <div className="flex justify-center items-end gap-0 border-b border-r border-slate-300 pb-1 pr-1 bg-white/80 rounded-lg p-2">
              {renderRow(upperRight, true)}
            </div>
          </div>
        ) : quadrantFilter === 'Q2' ? (
          <div className="flex flex-col items-center gap-2 p-3 bg-slate-50/70 border border-slate-200 rounded-xl shadow-2xs">
            <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-700 font-mono">Q2 — Chap Yuqori Jag' (21 - 28)</span>
            <div className="flex justify-center items-end gap-0 border-b border-l border-slate-300 pb-1 pl-1 bg-white/80 rounded-lg p-2">
              {renderRow(upperLeft, true)}
            </div>
          </div>
        ) : quadrantFilter === 'Q3' ? (
          <div className="flex flex-col items-center gap-2 p-3 bg-slate-50/70 border border-slate-200 rounded-xl shadow-2xs">
            <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-700 font-mono">Q3 — Chap Pastki Jag' (31 - 38)</span>
            <div className="flex justify-center items-start gap-0 border-t border-l border-slate-300 pt-1 pl-1 bg-white/80 rounded-lg p-2">
              {renderRow(lowerLeft, false)}
            </div>
          </div>
        ) : quadrantFilter === 'Q4' ? (
          <div className="flex flex-col items-center gap-2 p-3 bg-slate-50/70 border border-slate-200 rounded-xl shadow-2xs">
            <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-700 font-mono">Q4 — O'ng Pastki Jag' (48 - 41)</span>
            <div className="flex justify-center items-start gap-0 border-t border-r border-slate-300 pt-1 pr-1 bg-white/80 rounded-lg p-2">
              {renderRow(lowerRight, false)}
            </div>
          </div>
        ) : (
          <div
            className="grid grid-cols-2 gap-0 relative select-none origin-top transition-transform duration-200"
            style={{ 
              width: 'fit-content', 
              margin: '0 auto', 
              minWidth: compact ? 390 : 560,
              transform: scale < 1 ? `scale(${scale})` : undefined,
              marginBottom: scale < 1 ? `${-210 * (1 - scale)}px` : undefined
            }}
          >
            {/* Quadrant 1: Upper Right (teeth 18-11) */}
            {chartView !== 'mandible' && (
              <div className="flex justify-end items-end pb-1 pr-0.5 border-b border-r border-slate-200 gap-0">
                {renderRow(upperRight, true)}
              </div>
            )}

            {/* Quadrant 2: Upper Left (teeth 21-28) */}
            {chartView !== 'mandible' && (
              <div className="flex justify-start items-end pb-1 pl-0.5 border-b border-slate-200 gap-0">
                {renderRow(upperLeft, true)}
              </div>
            )}

            {/* Quadrant 4: Lower Right (teeth 48-41) */}
            {chartView !== 'maxilla' && (
              <div className={cn("flex justify-end items-start pt-1 pr-0.5 border-r border-slate-200 gap-0", chartView === 'mandible' && "border-t-0")}>
                {renderRow(lowerRight, false)}
              </div>
            )}

            {/* Quadrant 3: Lower Left (teeth 31-38) */}
            {chartView !== 'maxilla' && (
              <div className="flex justify-start items-start pt-1 pl-0.5 gap-0">
                {renderRow(lowerLeft, false)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Stats ── */}
      {!hideStats && chartView === 'teeth' && (
        <StatsSummary toothStatuses={toothStatuses} allTeeth={quadrantFilter === 'Q1' ? upperRight : quadrantFilter === 'Q2' ? upperLeft : quadrantFilter === 'Q3' ? lowerLeft : quadrantFilter === 'Q4' ? lowerRight : allTeeth} />
      )}

      {/* ── Legend ── */}
      {!hideLegend && <Legend />}

      {/* ── Batch Controls ── */}
      {showBatchControls && chartView === 'teeth' && (
        <BatchControls
          allUpper={allUpper}
          allLower={allLower}
          allTeethIds={allTeeth.map(t => t.id)}
          onChange={onChange}
        />
      )}
    </div>
  );
}

ProfessionalOdontogram.displayName = 'ProfessionalOdontogram';
export default memo(ProfessionalOdontogram);
