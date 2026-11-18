/** Self-serve klinika ro'yxati: maydon tekshiruvi (brauzer va server bir xil qoida). */
export const SIGNUP_USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,31}$/;
export const MIN_SIGNUP_PASSWORD = 8;

export function signupFieldErrors({ ownerName, clinicName, username, password } = {}) {
  const errors = {};
  if (!String(ownerName || '').trim()) errors.ownerName = "Ismingizni kiriting";
  if (!String(clinicName || '').trim()) errors.clinicName = "Klinika nomini kiriting";
  const login = String(username || '').trim().toLowerCase();
  if (!SIGNUP_USERNAME_RE.test(login)) {
    errors.username = "Login kamida 3 ta belgi bo'lsin: lotin harf, raqam, . _ -";
  }
  const pass = String(password ?? '');
  if (pass.length < MIN_SIGNUP_PASSWORD) errors.password = "Parol kamida 8 ta belgidan iborat bo'lishi kerak";
  else if (pass.length > 72) errors.password = "Parol juda uzun";
  return errors;
}
