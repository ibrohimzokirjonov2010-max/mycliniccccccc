/** Per-tooth implant diameter (Ø) and length (L), millimetres. */

export const DIAMETER_MIN = 1.5;
export const DIAMETER_MAX = 8;
export const LENGTH_MIN = 4;
export const LENGTH_MAX = 30;

export function parseImplantMm(raw) {
  if (raw == null) return { state: 'empty' };
  const original = String(raw).trim();
  if (!original) return { state: 'empty' };
  const text = original.replace(',', '.');
  if (text.endsWith('.')) return { state: 'partial' };
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return { state: 'invalid' };
  const value = Number(text);
  if (!Number.isFinite(value) || value <= 0) return { state: 'invalid' };
  return { state: 'ok', value };
}

function outOfRange(parsed, min, max) {
  return parsed.state === 'ok' && (parsed.value < min || parsed.value > max);
}

/**
 * @returns {''|'missing'|'need-diameter'|'need-length'|'bad-diameter'|'bad-length'}
 * Empty sizes are allowed while typing. `strict` is for Next / save:
 * both diameter and length are required, matching the clinical entry request.
 * The database schema still treats the columns as optional.
 */
export function toothSizeIssue(entry, { strict = false } = {}) {
  const d = parseImplantMm(entry?.diameter);
  const l = parseImplantMm(entry?.length);

  if (!strict) {
    if (d.state === 'invalid' || outOfRange(d, DIAMETER_MIN, DIAMETER_MAX)) return 'bad-diameter';
    if (l.state === 'invalid' || outOfRange(l, LENGTH_MIN, LENGTH_MAX)) return 'bad-length';
    return '';
  }

  if (d.state === 'empty' && l.state === 'empty') return 'missing';
  if (d.state === 'empty') return 'need-diameter';
  if (d.state !== 'ok' || outOfRange(d, DIAMETER_MIN, DIAMETER_MAX)) return 'bad-diameter';
  if (l.state === 'empty') return 'need-length';
  if (l.state !== 'ok' || outOfRange(l, LENGTH_MIN, LENGTH_MAX)) return 'bad-length';
  return '';
}

export function firstToothSizeIssue(fdis, map, options) {
  for (const fdi of fdis || []) {
    const issue = toothSizeIssue(map?.[fdi], options);
    if (issue) return { fdi, issue };
  }
  return null;
}

export function formatToothSizeSummary(entry) {
  const d = parseImplantMm(entry?.diameter);
  const l = parseImplantMm(entry?.length);
  if (d.state !== 'ok' || l.state !== 'ok') return '';
  if (outOfRange(d, DIAMETER_MIN, DIAMETER_MAX) || outOfRange(l, LENGTH_MIN, LENGTH_MAX)) return '';
  const dText = Number.isInteger(d.value) ? d.value.toFixed(1) : String(d.value);
  const lText = Number.isInteger(l.value) ? String(l.value) : String(l.value);
  return `Ø${dText}×${lText}`;
}

export function applyToothSizes(entry) {
  const next = { ...(entry || {}) };
  ['diameter', 'length'].forEach((key) => {
    const parsed = parseImplantMm(next[key]);
    if (parsed.state === 'ok') next[key] = parsed.value;
    else delete next[key];
  });
  return next;
}
