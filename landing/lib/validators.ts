const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  const withCode = digits.length === 9 ? `998${digits}` : digits;
  if (!/^998\d{9}$/.test(withCode)) return null;
  return `+${withCode}`;
}

export function normalizeName(input: string): string | null {
  const name = input.replace(/\s+/g, " ").trim();
  if (name.length < 2 || name.length > 80) return null;
  return name;
}

export function normalizeEmail(input: string): string | null {
  const email = input.trim().toLowerCase();
  if (email.length > 120 || !EMAIL.test(email)) return null;
  return email;
}

export function normalizeClinic(input: string): string | null {
  const clinic = input.replace(/\s+/g, " ").trim();
  if (clinic.length < 2 || clinic.length > 80) return null;
  return clinic;
}

export function normalizePassword(input: string): string | null {
  const password = input.trim();
  if (password.length < 8 || password.length > 72) return null;
  return password;
}
