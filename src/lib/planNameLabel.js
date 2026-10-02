const GENERIC = /(davolash rejasi|план лечения|treatment plan)/gi;

/** Shows a stored plan name in the UI language ("План лечения" never leaks into the uz UI). */
export function localizePlanName(name, language = 'uz') {
  const raw = String(name || '');
  const target = language === 'ru' ? 'План лечения' : language === 'en' ? 'Treatment plan' : 'Davolash rejasi';
  return raw.replace(GENERIC, target);
}
