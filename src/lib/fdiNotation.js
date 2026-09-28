/**
 * Canonical FDI tooth numbering for odontogram labels.
 * Display order:
 *   Upper (patient's right on screen-left): 18→11 | 21→28
 *   Lower (quadrant 3 on screen-left, 31/71 at the midline): 38→31 | 41→48
 * Primary (child): 55→51 | 61→65  /  75→71 | 81→85
 * Selection APIs still use internal ids (ur1, ul3c, …).
 */

const ADULT_Q = { ur: 1, ul: 2, ll: 3, lr: 4 };
const CHILD_Q = { ur: 5, ul: 6, ll: 7, lr: 8 };

export const ADULT_FDI_ARCS = {
  upperRight: [18, 17, 16, 15, 14, 13, 12, 11],
  upperLeft: [21, 22, 23, 24, 25, 26, 27, 28],
  lowerLeft: [38, 37, 36, 35, 34, 33, 32, 31],
  lowerRight: [41, 42, 43, 44, 45, 46, 47, 48],
};

export const CHILD_FDI_ARCS = {
  upperRight: [55, 54, 53, 52, 51],
  upperLeft: [61, 62, 63, 64, 65],
  lowerLeft: [75, 74, 73, 72, 71],
  lowerRight: [81, 82, 83, 84, 85],
};

const INTERNAL_ID_RE = /^(ur|ul|lr|ll)(\d+)(c)?$/i;

/** Internal chairside id → FDI string ("18", "62"). Empty string if unknown. */
export function internalIdToFdi(id) {
  const match = String(id || '').trim().match(INTERNAL_ID_RE);
  if (!match) return '';
  const quad = match[1].toLowerCase();
  const num = match[2];
  const child = Boolean(match[3]);
  const qMap = child ? CHILD_Q : ADULT_Q;
  return `${qMap[quad]}${num}`;
}

export function internalIdToFdiNumber(id) {
  const s = internalIdToFdi(id);
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

export function flattenArcs(arcs) {
  return [
    ...arcs.upperRight,
    ...arcs.upperLeft,
    ...arcs.lowerLeft,
    ...arcs.lowerRight,
  ];
}

export function findDuplicateFdis(fdis) {
  const counts = new Map();
  for (const raw of fdis) {
    const n = Number(raw);
    if (!Number.isFinite(n)) continue;
    counts.set(n, (counts.get(n) || 0) + 1);
  }
  return [...counts.entries()].filter(([, c]) => c > 1).map(([n]) => n);
}

/** Internal id or "#16" / "16" / "ur6" → canonical FDI string. */
export function toImplantFdi(id) {
  const raw = String(id ?? '').trim().replace(/^#/, '');
  if (!raw) return '';
  const internal = internalIdToFdi(raw);
  return internal || raw;
}

/** One key per FDI, first occurrence wins (so ur6 + 16 collapse). */
export function uniqueImplantToothKeys(values = []) {
  const seen = new Set();
  const out = [];
  const list = Array.isArray(values)
    ? values
    : String(values || '').split(/[,·]/);
  for (const item of list) {
    const fdi = toImplantFdi(item);
    if (!fdi || seen.has(fdi)) continue;
    seen.add(fdi);
    out.push(String(item).trim());
  }
  return out;
}

/** Unique FDI labels for an implant row (tooth_numbers + tooth_number + tooth_id). */
export function implantRecordFdis(record) {
  if (!record) return [];
  const raw = [];
  const tn = record.tooth_numbers;
  if (Array.isArray(tn)) raw.push(...tn);
  else if (typeof tn === 'string' && tn.trim()) raw.push(...tn.split(/[,·]/));
  if (record.tooth_number) raw.push(record.tooth_number);
  if (record.tooth_id) raw.push(record.tooth_id);
  return uniqueImplantToothKeys(raw).map(toImplantFdi);
}

/**
 * Tooth count across implant rows. A row with several FDIs counts each once.
 * A row with no FDI still counts as one record so the tab badge does not vanish.
 */
export function countImplantTeeth(records = []) {
  return (records || []).reduce((sum, rec) => {
    if (!rec) return sum;
    const n = implantRecordFdis(rec).length;
    return sum + (n > 0 ? n : 1);
  }, 0);
}

/** Position 1–8 (or 1–5 for primary teeth) from an FDI number. */
export function fdiPosition(fdi) {
  const n = Number(fdi);
  if (!Number.isFinite(n)) return 0;
  return Math.abs(n) % 10;
}

/** Relative mesio-distal width. Molars widest, laterals narrowest. */
const FDI_WIDTH = { 1: 0.82, 2: 0.64, 3: 0.74, 4: 0.92, 5: 0.96, 6: 1.32, 7: 1.2, 8: 1.08 };

/** Relative crown-root length. Canines longest. */
const FDI_LENGTH = { 1: 0.9, 2: 0.8, 3: 1, 4: 0.86, 5: 0.84, 6: 0.82, 7: 0.8, 8: 0.76 };

export function fdiWidthWeight(fdi) {
  return FDI_WIDTH[fdiPosition(fdi)] || 1;
}

export function fdiLengthWeight(fdi) {
  return FDI_LENGTH[fdiPosition(fdi)] || 0.86;
}

/** CSS grid columns that mirror across the midline (same weights on both halves). */
export function fdiGridTemplate(fdis) {
  return (fdis || []).map((n) => `minmax(0, ${fdiWidthWeight(n)}fr)`).join(' ');
}

/** Upper permanent (11–28) and upper primary (51–65) crowns point down. */
export function fdiCrownDown(fdi) {
  const n = Number(fdi);
  return n <= 28 || (n >= 51 && n <= 65);
}

/**
 * Screen side of the mesial surface after the lower row is mirrored.
 * Upper quads 1 and 5 still face right. Lower quads 3 and 7 now sit on
 * the viewer's left, so their mesial faces the midline on the right.
 */
export function fdiMesialIsRight(fdi) {
  const q = Math.floor(Number(fdi) / 10);
  return q === 1 || q === 3 || q === 5 || q === 7;
}

/** Lower illustrations were drawn for 48→41 | 31→38. Mirror them so mesial meets the new midline. */
export function fdiLowerImageFlip(fdi) {
  return !fdiCrownDown(fdi);
}

export function assertUniqueFdis(fdis, expectedCount) {
  const nums = fdis.map(Number).filter((n) => Number.isFinite(n));
  const dupes = findDuplicateFdis(nums);
  if (dupes.length) {
    throw new Error(`Duplicate FDI labels: ${dupes.join(', ')}`);
  }
  if (expectedCount != null && nums.length !== expectedCount) {
    throw new Error(`Expected ${expectedCount} FDI labels, got ${nums.length}`);
  }
  return true;
}
