/**
 * clinics jadvalida faqat id, name, password, logo, expires_at, status, created_at, monthly_fee,
 * last_payment_date, plan ustunlari bor. Qolgan maydonlar `logo` ustuniga
 * '[EXT]{...json...}[/EXT]<haqiqiy logo>' ko'rinishida yoziladi (src/api/base44Client.jsx -> clinic._encodeClinicNotes).
 * Quyidagi funksiyalar shu formatni server tomonda aynan takrorlaydi.
 */
export function decodeExt(logo) {
  const raw = typeof logo === 'string' ? logo : '';
  if (!raw.startsWith('[EXT]')) return { ext: {}, rawLogo: raw };
  const end = raw.indexOf('[/EXT]');
  if (end === -1) return { ext: {}, rawLogo: raw };
  try {
    return { ext: JSON.parse(raw.substring(5, end)) || {}, rawLogo: raw.substring(end + 6) };
  } catch {
    return { ext: {}, rawLogo: raw };
  }
}

export function encodeExt(ext, rawLogo = '') {
  const clean = {};
  Object.entries(ext || {}).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    if (Array.isArray(v) && v.length === 0) return;
    clean[k] = v;
  });
  return Object.keys(clean).length > 0 ? `[EXT]${JSON.stringify(clean)}[/EXT]${rawLogo}` : rawLogo;
}
