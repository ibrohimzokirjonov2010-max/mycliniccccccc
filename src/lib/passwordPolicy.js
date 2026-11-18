/** New and changed passwords. Existing shorter passwords keep working until they are changed. */
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 72;

export function passwordError(password) {
  const value = String(password ?? '');
  if (value.length < MIN_PASSWORD_LENGTH || value.length > MAX_PASSWORD_LENGTH) return 'weak_password';
  return '';
}
