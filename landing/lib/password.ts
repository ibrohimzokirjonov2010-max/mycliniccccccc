import bcrypt from "bcryptjs";

const HASH_RE = /^\$2[aby]\$\d{2}\$/;

export function isPasswordHash(value: string) {
  return HASH_RE.test(value);
}

function rounds() {
  const parsed = Number(process.env.BCRYPT_ROUNDS || 10);
  if (!Number.isFinite(parsed)) return 10;
  return Math.min(12, Math.max(4, Math.trunc(parsed)));
}

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, rounds());
}

/** Accepts bcrypt hashes and legacy temporary passwords already stored for paid clinics. */
export async function verifyPassword(plain: string, stored: string) {
  if (!plain || !stored) return false;
  if (isPasswordHash(stored)) {
    try {
      return await bcrypt.compare(plain, stored);
    } catch {
      return false;
    }
  }
  return stored === plain;
}
