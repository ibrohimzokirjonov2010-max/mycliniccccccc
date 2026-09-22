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
