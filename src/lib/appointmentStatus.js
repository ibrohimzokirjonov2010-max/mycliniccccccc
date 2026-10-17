/**
 * Appointment status — yagona manba (calendar, bemor kartasi, modal, eksport).
 * DB qiymatlari: Scheduled | Waiting | In Progress | Completed | Cancelled | No-Show.
 * Tezkor tugmalar: Keldi = Waiting, Qabulda = In Progress, Kelmadi = No-Show.
 */
export const APPOINTMENT_STATUSES = ['Scheduled', 'Waiting', 'In Progress', 'Completed', 'Cancelled', 'No-Show'];

const LABELS = {
  Scheduled: { uz: 'Rejalashtirilgan', ru: 'Запланировано', en: 'Scheduled' },
  Waiting: { uz: 'Keldi', ru: 'Пришёл', en: 'Arrived' },
  'In Progress': { uz: 'Qabulda', ru: 'На приёме', en: 'In chair' },
  Completed: { uz: 'Tugallangan', ru: 'Завершено', en: 'Completed' },
  Cancelled: { uz: 'Bekor qilingan', ru: 'Отменено', en: 'Cancelled' },
  'No-Show': { uz: 'Kelmadi', ru: 'Не пришёл', en: 'No-show' },
};

/** Any legacy/localized value -> canonical DB status. */
export function normalizeAppointmentStatus(raw) {
  const s = String(raw || '').trim().toLowerCase().replace(/[_\s-]+/g, '');
  if (!s) return 'Scheduled';
  if (['completed', 'complete', 'done', 'tugallandi', 'tugallangan', 'bajarildi', 'завершено'].includes(s)) return 'Completed';
  if (s.startsWith('cancel') || s.startsWith('bekor') || s === 'отменено') return 'Cancelled';
  if (['noshow', 'kelmadi', 'kelmagan', 'неявился', 'непришёл', 'непришел'].includes(s)) return 'No-Show';
  if (['inprogress', 'jarayonda', 'qabulda', 'наприёме'].includes(s)) return 'In Progress';
  if (['waiting', 'arrived', 'keldi', 'kutmoqda', 'kutilmoqda', 'пришёл'].includes(s)) return 'Waiting';
  return 'Scheduled'; // scheduled / planned / confirmed / tasdiqlangan
}

export function appointmentStatusLabel(raw, language = 'uz') {
  const key = normalizeAppointmentStatus(raw);
  const l = LABELS[key];
  return l[language] || l.uz;
}

/** Calendar card background/border/text. */
export const APPOINTMENT_STATUS_CARD_CLASS = {
  Scheduled: 'bg-[#E3F2FD] border-[#BBDEFB] text-[#1976D2]',
  Waiting: 'bg-[#FFF3E0] border-[#FFE0B2] text-[#E65100]',
  'In Progress': 'bg-[#E1F5FE] border-[#B3E5FC] text-[#01579B]',
  Completed: 'bg-[#E8F5E9] border-[#C8E6C9] text-[#2E7D32]',
  Cancelled: 'bg-rose-50 border-rose-100 text-rose-600',
  'No-Show': 'bg-slate-50 border-slate-200 text-slate-400',
};

/** Small pill badge colours. */
export const APPOINTMENT_STATUS_BADGE_CLASS = {
  Scheduled: 'bg-blue-50 text-blue-700 border-blue-200',
  Waiting: 'bg-amber-50 text-amber-800 border-amber-200',
  'In Progress': 'bg-cyan-50 text-cyan-700 border-cyan-200',
  Completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Cancelled: 'bg-rose-50 text-rose-700 border-rose-200',
  'No-Show': 'bg-slate-100 text-slate-600 border-slate-200',
};

export const QUICK_STATUS_ACTIONS = [
  { status: 'Waiting', label: 'Keldi' },
  { status: 'In Progress', label: 'Qabulda' },
  { status: 'No-Show', label: 'Kelmadi' },
];
