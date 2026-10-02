/**
 * One implant lifecycle mapping for the patient card, the plan, and the implants list.
 * Stored values stay as they are. Empty or unknown values display as planned.
 */

export const IMPLANT_STATUS_ORDER = [
  'planned',
  'placed',
  'healing',
  'formik',
  'abutment',
  'crown',
  'completed',
  'failure',
];

const LABELS = {
  planned: { uz: 'Rejalashtirilgan', ru: 'Запланирован', en: 'Planned' },
  placed: { uz: "O'rnatildi", ru: 'Установлен', en: 'Placed' },
  healing: { uz: 'Integratsiyada', ru: 'В интеграции', en: 'Integrating' },
  formik: { uz: "Formik qo'yildi", ru: 'Формирователь', en: 'Healing abutment' },
  abutment: { uz: "Abutment qo'yildi", ru: 'Абатмент установлен', en: 'Abutment placed' },
  crown: { uz: 'Koronka', ru: 'Коронка', en: 'Crown' },
  completed: { uz: 'Tugallangan', ru: 'Завершено', en: 'Completed' },
  failure: { uz: 'Rad etildi', ru: 'Отклонено', en: 'Failed' },
};

const TONE = {
  planned: 'bg-blue-50 text-blue-800 border-blue-200',
  placed: 'bg-teal-50 text-teal-800 border-teal-200',
  healing: 'bg-purple-50 text-purple-800 border-purple-200',
  formik: 'bg-cyan-50 text-cyan-800 border-cyan-200',
  abutment: 'bg-violet-50 text-violet-800 border-violet-200',
  crown: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  completed: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  failure: 'bg-rose-50 text-rose-800 border-rose-200',
};

const ALIASES = [
  ['completed', ['completed', 'complete', 'tugallangan', 'done', 'bajarildi']],
  ['failure', ['failure', 'failed', 'rad etildi', 'muvaffaqiyatsiz', 'rad']],
  ['healing', ['healing jarayoni', 'integratsiya jarayoni', 'in integration', 'integratsiyada', 'integratsiya', 'healing']],
  ['abutment', ['abutment qoyildi', 'abutment']],
  ['formik', ['formik qoyildi', 'formik', 'fomik']],
  ['crown', ['protez tayyor', 'crown tayyor', 'koronka', 'karonka', 'crown', 'toj']],
  ['placed', ['ornatildi', 'ornatilgan', 'joylandi', 'installed', 'placed']],
  ['planned', ['rejalashtirilgan', 'kutilmoqda', 'pending', 'waiting', 'planned', 'reja']],
];

function fold(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[''`ʻʼ]/g, '')
    .replace(/\s+/g, ' ');
}

export function normalizeImplantStatus(raw) {
  const folded = fold(raw);
  if (!folded) return 'planned';
  for (const [code, list] of ALIASES) {
    if (list.some((alias) => folded === alias || folded.includes(alias))) return code;
  }
  return 'planned';
}

export function implantStatusLabel(raw, language = 'uz') {
  const code = normalizeImplantStatus(raw);
  const row = LABELS[code] || LABELS.planned;
  if (language === 'ru') return row.ru;
  if (language === 'en') return row.en;
  return row.uz;
}

/** Exact status words only. Free-text notes stay as written. */
export function implantStatusLabelIfKnown(raw, language = 'uz') {
  const folded = fold(raw);
  if (!folded) return null;
  for (const [code, list] of ALIASES) {
    if (list.some((alias) => folded === alias)) {
      const row = LABELS[code];
      if (language === 'ru') return row.ru;
      if (language === 'en') return row.en;
      return row.uz;
    }
  }
  return null;
}

export function implantStatusClass(raw) {
  return TONE[normalizeImplantStatus(raw)] || TONE.planned;
}

export function isImplantService(value) {
  return /implant/i.test(String(value || ''));
}

export function implantMatchingTooth(implants, tooth) {
  const fdi = String(tooth || '').replace(/^#/, '').trim();
  if (!fdi) return null;
  return (implants || []).find((imp) => {
    const raw = Array.isArray(imp?.tooth_numbers)
      ? imp.tooth_numbers
      : String(imp?.tooth_numbers || imp?.tooth_number || '').split(/[,·]/);
    return raw.map((n) => String(n).replace(/^#/, '').trim()).includes(fdi);
  }) || null;
}

/** Label for an implant service step. Null when the service is not an implant. */
export function implantStepStatusLabel({ name, tooth, implants, language = 'uz' }) {
  if (!isImplantService(name)) return null;
  const match = implantMatchingTooth(implants, tooth);
  return implantStatusLabel(match?.lifecycle_status || match?.status || '', language);
}
