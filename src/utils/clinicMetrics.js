/** Shared formatters and appointment matching for Staff and Reports. */
import { formatCurrency } from '@/lib/utils';

export function dateKey(value) {
  if (!value) return '';
  const clean = String(value).split('T')[0].split(' ')[0];
  if (clean.includes('.')) {
    const dp = clean.split('.');
    if (dp.length !== 3) return clean;
    const [a, b, c] = dp;
    return a.length === 4
      ? `${a}-${b.padStart(2, '0')}-${c.padStart(2, '0')}`
      : `${c}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
  }
  return clean;
}

export function isoDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayISO() {
  return isoDate(new Date());
}

export function timeToMinutes(time) {
  if (!time) return null;
  const parts = String(time).split(':');
  const h = Number(parts[0]);
  const m = Number(parts[1] || 0);
  if (Number.isNaN(h)) return null;
  return h * 60 + (Number.isNaN(m) ? 0 : m);
}

export function minutesToLabel(mins) {
  if (mins == null || Number.isNaN(mins)) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function fmtMoney(n) {
  return formatCurrency(n);
}

export function fmtCompact(n) {
  const v = Number(n) || 0;
  const sign = v < 0 ? '−' : '';
  const abs = Math.abs(v);
  if (abs >= 1_000_000) {
    const mln = abs / 1_000_000;
    const digits = mln >= 100 ? 0 : mln >= 10 ? 1 : 2;
    const s = mln.toFixed(digits).replace(/\.?0+$/, '').replace('.', ',');
    return `${sign}${s} mln`;
  }
  if (abs >= 10_000) {
    return `${sign}${Math.round(abs / 1000)} ming`;
  }
  return `${sign}${fmtMoney(abs)}`;
}

export function personName(user) {
  return (user?.full_name || user?.name || '').trim() || 'Nomsiz';
}

export function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const skip = new Set(['dr', 'dr.', 'doktor']);
  const useful = parts.filter((p) => !skip.has(p.toLowerCase().replace('.', '')));
  const src = useful.length ? useful : parts;
  if (src.length === 1) return src[0].slice(0, 2).toUpperCase();
  return (src[0][0] + src[src.length - 1][0]).toUpperCase();
}

const AVATAR_TONES = [
  'bg-teal-50 text-teal-700',
  'bg-sky-50 text-sky-700',
  'bg-amber-50 text-amber-800',
  'bg-emerald-50 text-emerald-700',
  'bg-violet-50 text-violet-700',
  'bg-rose-50 text-rose-700',
  'bg-slate-100 text-slate-600',
];

export function avatarTone(name) {
  let h = 0;
  const s = String(name || '');
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
}

export function userPhoto(user) {
  return user?.avatar_url || user?.photo_url || user?.photo || user?.avatar || user?.image || '';
}

export function isIncomePayment(p) {
  return String(p?.type || '').toLowerCase() === 'income';
}

export function isCompletedStatus(status) {
  const s = String(status || '').toLowerCase().replace(/\s+/g, ' ').trim();
  return s === 'completed' || s === 'done' || s === 'bajarilgan' || s === 'выполнено';
}

export function isCancelledStatus(status) {
  const s = String(status || '').toLowerCase();
  return s === 'cancelled' || s === 'canceled' || s === 'bekor' || s.includes('no_show') || s.includes('no-show') || s.includes('noshow') || s.includes('kelmagan');
}

export function isInProgressStatus(status) {
  const s = String(status || '').toLowerCase();
  return s.includes('progress') || s === 'qabulda';
}

export function matchStaff(record, staff) {
  if (!record || !staff?.length) return null;
  if (record.doctor_id != null && record.doctor_id !== '') {
    const found = staff.find((s) => String(s.id) === String(record.doctor_id));
    if (found) return found;
  }
  const name = String(record.doctor_name || '').trim();
  if (!name) return null;
  return staff.find((d) => {
    const n = String(d.name || d.full_name || '').trim();
    if (!n || n.length < 2) return false;
    return name === n || name.includes(n) || n.includes(name);
  }) || null;
}

const WEEKDAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export function scheduleForDay(workingHours, jsDay) {
  if (!workingHours || typeof workingHours !== 'object') return null;
  const candidates = [jsDay, String(jsDay), WEEKDAY_NAMES[jsDay]];
  for (const key of candidates) {
    if (workingHours[key] && typeof workingHours[key] === 'object') return workingHours[key];
  }
  return null;
}

/** true / false when the schedule is known, otherwise null. */
export function isScheduledOn(workingHours, jsDay) {
  const day = scheduleForDay(workingHours, jsDay);
  if (!day) return null;
  if ('active' in day) return !!day.active;
  if ('isOpen' in day) return !!day.isOpen;
  if (day.start || day.end) return true;
  return null;
}

export function scheduleHoursLabel(workingHours, jsDay) {
  const day = scheduleForDay(workingHours, jsDay);
  if (!day) return null;
  const open = ('active' in day) ? !!day.active : ('isOpen' in day ? !!day.isOpen : null);
  if (open === false) return 'dam';
  if (day.start && day.end) return `${day.start}–${String(day.end).slice(0, 5)}`;
  return null;
}

export const WEEK_LABELS = [
  { js: 1, short: 'Du' },
  { js: 2, short: 'Se' },
  { js: 3, short: 'Ch' },
  { js: 4, short: 'Pa' },
  { js: 5, short: 'Ju' },
  { js: 6, short: 'Sh' },
  { js: 0, short: 'Ya' },
];

export function startOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Role access mirrors route guards: reports, staff, expenses and payroll are admin-only. */
export const ROLE_ACCESS = {
  admin: [
    ['Bemorlar', true],
    ["To'lovlar", true],
    ['Qarzlar', true],
    ['Qabullar', true],
    ['Hisobotlar', true],
    ['Xarajatlar', true],
    ['Ombor', true],
    ['Xodimlar', true],
  ],
  doctor: [
    ['Bemorlar', true],
    ["To'lovlar", true],
    ['Qarzlar', true],
    ['Qabullar', true],
    ['Hisobotlar', false],
    ['Xarajatlar', false],
    ['Ombor', true],
    ['Xodimlar', false],
  ],
  receptionist: [
    ['Bemorlar', true],
    ["To'lovlar", true],
    ['Qarzlar', true],
    ['Qabullar', true],
    ['Hisobotlar', false],
    ['Xarajatlar', false],
    ['Ombor', true],
    ['Xodimlar', false],
  ],
};

export function roleAccess(role) {
  return ROLE_ACCESS[role] || ROLE_ACCESS.doctor;
}

export function roleLabel(role, language = 'uz') {
  const map = {
    uz: { doctor: 'Shifokor', admin: 'Administrator', receptionist: 'Registratura' },
    ru: { doctor: 'Врач', admin: 'Администратор', receptionist: 'Регистратура' },
    en: { doctor: 'Doctor', admin: 'Administrator', receptionist: 'Reception' },
  };
  return (map[language] || map.uz)[role] || (map[language] || map.uz).doctor;
}
