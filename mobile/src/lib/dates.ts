/** Calendar day in Asia/Tashkent, YYYY-MM-DD. */
export function tashkentToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tashkent',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function dateKey(value: unknown): string {
  if (value == null || value === '') return '';
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const dotted = raw.split(/[.\s]/).filter(Boolean);
  if (dotted.length >= 3 && dotted[2].length === 4) {
    return `${dotted[2]}-${dotted[1].padStart(2, '0')}-${dotted[0].padStart(2, '0')}`;
  }
  return raw.slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year, (month || 1) - 1, (day || 1) + days));
  return date.toISOString().slice(0, 10);
}

const WEEKDAYS: Record<string, string[]> = {
  uz: ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'],
  ru: ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
};

const MONTHS: Record<string, string[]> = {
  uz: ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'],
  ru: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};

function parts(iso: string): { year: number; month: number; day: number } | null {
  const key = dateKey(iso);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const [year, month, day] = key.split('-').map(Number);
  return { year, month, day };
}

function langOf(locale: string): string {
  if (locale.startsWith('ru')) return 'ru';
  if (locale.startsWith('en')) return 'en';
  return 'uz';
}

export function formatLongDate(iso: string, locale: string): string {
  const value = parts(iso);
  if (!value) return '';
  const lang = langOf(locale);
  const weekday = WEEKDAYS[lang][new Date(Date.UTC(value.year, value.month - 1, value.day)).getUTCDay()];
  return `${value.day} ${MONTHS[lang][value.month - 1]} ${value.year}, ${weekday}`;
}

export function formatShortDate(iso: string, locale: string): string {
  const value = parts(iso);
  if (!value) return '';
  const month = MONTHS[langOf(locale)][value.month - 1];
  return `${value.day} ${month}`;
}

export function weekdayShort(iso: string, locale: string): string {
  const value = parts(iso);
  if (!value) return '';
  const name = WEEKDAYS[langOf(locale)][new Date(Date.UTC(value.year, value.month - 1, value.day)).getUTCDay()];
  const short = name.slice(0, 2);
  return short.charAt(0).toUpperCase() + short.slice(1);
}

export function nowHHMM(now = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tashkent',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now);
}

export function isExpired(expiresAt?: string | null, now = new Date()): boolean {
  if (!expiresAt) return false;
  const match = String(expiresAt).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return false;
  const end = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 23, 59, 59, 999);
  return now.getTime() > end.getTime();
}
