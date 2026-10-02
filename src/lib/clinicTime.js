/** Clinic clock: instants are stored in UTC and shown in Asia/Tashkent. */

export const CLINIC_TZ = 'Asia/Tashkent';

const UZ_WEEKDAYS = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
const RU_WEEKDAYS = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
const EN_WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

const partFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: CLINIC_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  weekday: 'short',
});

function partsOf(date) {
  const map = {};
  for (const part of partFormatter.formatToParts(date)) {
    if (part.type !== 'literal') map[part.type] = part.value;
  }
  return map;
}

/** YYYY-MM-DD calendar key, or a UTC instant. Date-only values stay date-only. */
export function parseClinicValue(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const raw = String(value).trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return { dateOnly: raw };
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(raw)) {
    const [d, m, y] = raw.split('.');
    return { dateOnly: `${y}-${m}-${d}` };
  }
  let iso = raw;
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(raw) && !/(Z|[+-]\d{2}:?\d{2})$/i.test(raw)) {
    iso = raw.replace(' ', 'T') + 'Z';
  }
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function clinicParts(value) {
  const parsed = parseClinicValue(value);
  if (!parsed) return null;
  if (parsed.dateOnly) {
    const [year, month, day] = parsed.dateOnly.split('-');
    const noon = new Date(`${parsed.dateOnly}T12:00:00Z`);
    const weekday = partsOf(noon).weekday;
    return { year, month, day, weekday, hour: '', minute: '', dateOnly: true };
  }
  const p = partsOf(parsed);
  return { ...p, dateOnly: false };
}

export function formatClinicDate(value) {
  const p = clinicParts(value);
  if (!p) return '—';
  return `${p.day}.${p.month}.${p.year}`;
}

export function formatClinicTime(value) {
  const p = clinicParts(value);
  if (!p || p.dateOnly || p.hour === '' || p.hour == null) return '';
  return `${p.hour}:${p.minute}`;
}

export function formatClinicDateTime(value) {
  const p = clinicParts(value);
  if (!p) return '—';
  const date = `${p.day}.${p.month}.${p.year}`;
  if (p.dateOnly || !p.hour) return date;
  return `${date} ${p.hour}:${p.minute}`;
}

export function weekdayName(value, lang = 'uz') {
  const p = clinicParts(value);
  if (!p) return '';
  const idx = WEEKDAY_INDEX[p.weekday] ?? 0;
  if (lang === 'ru') return RU_WEEKDAYS[idx];
  if (lang === 'en') return EN_WEEKDAYS[idx];
  return UZ_WEEKDAYS[idx];
}

export function formatClinicDateWithWeekday(value, lang = 'uz') {
  const p = clinicParts(value);
  if (!p) return '';
  return `${p.day}.${p.month}.${p.year}, ${weekdayName(value, lang)}`;
}

export function tashkentToday() {
  const p = partsOf(new Date());
  return `${p.year}-${p.month}-${p.day}`;
}

export function addDaysKey(key, delta) {
  const base = /^\d{4}-\d{2}-\d{2}$/.test(String(key || '')) ? key : tashkentToday();
  const [y, m, d] = base.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

export function monthKeyFromValue(value) {
  const p = clinicParts(value);
  if (!p) return '';
  return `${p.year}-${p.month}`;
}

function hasClock(value) {
  return /[T ]\d{2}:\d{2}/.test(String(value || ''));
}

/** One instant for a payment: a real timestamp, never a date-only field turned into 05:00. */
export function paymentStamp(payment) {
  if (!payment) return { date: '—', time: '', dateTime: '—' };
  const timed = [payment.created_at, payment.created_date, payment.updated_at].find((v) => v && hasClock(v));
  if (timed) {
    return {
      date: formatClinicDate(timed),
      time: formatClinicTime(timed),
      dateTime: formatClinicDateTime(timed),
    };
  }
  const day = payment.date || payment.created_date || payment.created_at;
  const date = day ? formatClinicDate(day) : '—';
  return { date, time: '', dateTime: date };
}

/** Wall-clock text "dd.mm.yyyy" or "dd.mm.yyyy HH:mm" in Tashkent → UTC ISO. */
export function parseDisplayDateTime(text) {
  const raw = String(text || '').trim();
  const match = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2}))?$/);
  if (!match) return '';
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const hour = match[4] == null ? 0 : Number(match[4]);
  const minute = match[5] == null ? 0 : Number(match[5]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return '';
  const utc = new Date(Date.UTC(year, month - 1, day, hour - 5, minute));
  return utc.toISOString();
}

export function formatAxisAmount(value) {
  const n = Number(value) || 0;
  const abs = Math.abs(n);
  if (abs >= 1_000_000) {
    const mln = abs / 1_000_000;
    const text = mln >= 10 ? String(Math.round(mln)) : mln.toFixed(1).replace(/\.0$/, '');
    return `${n < 0 ? '-' : ''}${text} mln`;
  }
  if (abs >= 1000) return `${n < 0 ? '-' : ''}${Math.round(abs / 1000)} ming`;
  return String(Math.round(n));
}

export function displayDoctorName(name) {
  if (!name) return '';
  const original = String(name).replace(/\s+/g, ' ').trim();
  const stripped = original.replace(/^(?:dr\.?\s*)+/i, '').trim();
  if (!stripped) return '';
  if (/^dr\.?\s*/i.test(original)) return `Dr. ${stripped}`;
  return stripped;
}

const COMPLETED_VISIT = new Set([
  'completed', 'done', 'bajarildi', 'bajarilgan', 'yakunlangan', 'paid', 'tugallangan',
]);

export function isCompletedVisitStatus(status) {
  return COMPLETED_VISIT.has(String(status || '').trim().toLowerCase());
}

export function dateKeyOf(value) {
  const p = clinicParts(value);
  if (!p) return '';
  return `${p.year}-${p.month}-${p.day}`;
}
