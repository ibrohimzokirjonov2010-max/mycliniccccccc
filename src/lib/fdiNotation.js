/**
 * Canonical FDI tooth numbering for odontogram labels.
 * Display order (dentist view, patient's right on screen-left):
 *   Upper: 18→11 | 21→28
 *   Lower: 48→41 | 31→38
 * Primary (child): 55→51 | 61→65  /  85→81 | 71→75
 * Selection APIs still use internal ids (ur1, ul3c, …).
 */

const ADULT_Q = { ur: 1, ul: 2, ll: 3, lr: 4 };
const CHILD_Q = { ur: 5, ul: 6, ll: 7, lr: 8 };

export const ADULT_FDI_ARCS = {
  upperRight: [18, 17, 16, 15, 14, 13, 12, 11],
  upperLeft: [21, 22, 23, 24, 25, 26, 27, 28],
  lowerLeft: [31, 32, 33, 34, 35, 36, 37, 38],
  lowerRight: [48, 47, 46, 45, 44, 43, 42, 41],
};

export const CHILD_FDI_ARCS = {
  upperRight: [55, 54, 53, 52, 51],
  upperLeft: [61, 62, 63, 64, 65],
  lowerLeft: [71, 72, 73, 74, 75],
  lowerRight: [85, 84, 83, 82, 81],
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
