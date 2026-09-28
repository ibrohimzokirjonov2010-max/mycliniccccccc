/** Collapse a repeated "Dr." prefix to a single title. Names without a title stay unchanged. */
export function formatDoctorName(value) {
  const raw = String(value || '').replace(/\s+/g, ' ').trim();
  if (!raw) return '';
  const prefix = /^(?:dr\.?\s*)+/i;
  if (!prefix.test(raw)) return raw;
  const rest = raw.replace(prefix, '').trim();
  return rest ? `Dr. ${rest}` : 'Dr.';
}

/** Visible spelling fix. Stored rows can still say "karonka". */
export function displayServiceName(value) {
  return String(value || '').replace(/karonka/gi, (match) => {
    if (match === match.toUpperCase()) return 'KORONKA';
    if (match[0] === match[0].toUpperCase()) return 'Koronka';
    return 'koronka';
  });
}

export function formatTableDate(value) {
  if (!value) return '—';
  const raw = String(value);
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}.${iso[2]}.${iso[1]}`;
  const dmy = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  if (dmy) return `${dmy[1]}.${dmy[2]}.${dmy[3]}`;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${date.getFullYear()}`;
}

export function formatBirthDate(value) {
  const formatted = formatTableDate(value);
  return formatted === '—' ? '' : formatted;
}
