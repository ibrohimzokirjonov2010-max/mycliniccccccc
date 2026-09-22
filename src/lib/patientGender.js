/**
 * Patient gender is stored lowercase to satisfy the DB check
 * (male | female | other). UI used to compare only "Female"/"Male",
 * so a saved "female" rendered as Erkak and the select looked empty.
 */

const FEMALE = new Set(['female', 'f', 'ayol', 'woman', 'girl', 'женский', 'жен']);
const MALE = new Set(['male', 'm', 'erkak', 'man', 'boy', 'мужской', 'муж']);
const OTHER = new Set(['other', 'boshqa', 'unspecified', 'unknown', 'n/a', 'na']);

/** @returns {'male'|'female'|'other'|''} */
export function normalizePatientGender(value) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return '';
  if (FEMALE.has(raw)) return 'female';
  if (MALE.has(raw)) return 'male';
  if (OTHER.has(raw)) return 'other';
  return '';
}

/** Value safe for patients.gender CHECK. Null means omit the column. */
export function patientGenderForDb(value) {
  const g = normalizePatientGender(value);
  if (g === 'male' || g === 'female' || g === 'other') return g;
  return null;
}

export function patientGenderLabel(value, language = 'uz') {
  const g = normalizePatientGender(value);
  if (g === 'female') {
    if (language === 'ru') return 'Женский';
    if (language === 'en') return 'Female';
    return 'Ayol';
  }
  if (g === 'male') {
    if (language === 'ru') return 'Мужской';
    if (language === 'en') return 'Male';
    return 'Erkak';
  }
  if (g === 'other') {
    if (language === 'ru') return 'Другое';
    if (language === 'en') return 'Other';
    return 'Boshqa';
  }
  return '';
}
