/**
 * Klinika ish vaqti (Sozlamalar → Ish vaqti) asosida kalendar slotlari.
 * Standart: 08:00 – 00:00 (avvalgi xatti-harakat).
 */
export const DEFAULT_WORK_START_HOUR = 8;
export const DEFAULT_WORK_END_HOUR = 24;

export function normalizeWorkHours(start, end) {
  let s = Number.parseInt(start, 10);
  let e = Number.parseInt(end, 10);
  if (!Number.isFinite(s) || s < 0 || s > 23) s = DEFAULT_WORK_START_HOUR;
  if (!Number.isFinite(e) || e < 1 || e > 24) e = DEFAULT_WORK_END_HOUR;
  if (e <= s) e = Math.min(24, s + 1);
  return { start: s, end: e };
}

/** Hourly slot labels from start to end (end exclusive; 24 keeps legacy 23:30 + 00:00). */
export function buildClinicTimeSlots(start, end) {
  const h = normalizeWorkHours(start, end);
  const slots = [];
  for (let i = h.start; i < h.end; i += 1) slots.push(`${String(i).padStart(2, '0')}:00`);
  if (h.end === 24) slots.push('23:30', '00:00');
  return slots;
}
