/** Sana yordamchilari: barcha sanalar 'YYYY-MM-DD' (Asia/Tashkent kalendari). */
export function tashkentToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

function parse(day) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(day || ''));
  if (!m) return null;
  return { y: Number(m[1]), mo: Number(m[2]), d: Number(m[3]) };
}

function fmt(date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(day, n) {
  const p = parse(day);
  if (!p) return null;
  const date = new Date(Date.UTC(p.y, p.mo - 1, p.d));
  date.setUTCDate(date.getUTCDate() + Number(n || 0));
  return fmt(date);
}

/** Oy qo'shish (oy oxiridan oshib ketmaslik uchun: 31 yanvar + 1 oy = 28/29 fevral). */
export function addMonths(day, n) {
  const p = parse(day);
  if (!p) return null;
  const target = new Date(Date.UTC(p.y, p.mo - 1 + Number(n || 0), 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(p.d, lastDay));
  return fmt(target);
}
