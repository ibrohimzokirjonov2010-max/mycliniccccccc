import bcrypt from 'bcryptjs';

const BCRYPT_HASH_RE = /^\$2[aby]\$\d{2}\$/;

export function isPasswordHash(value: unknown): value is string {
  return typeof value === 'string' && BCRYPT_HASH_RE.test(value);
}

/** Same rules as the web CRM: bcrypt hashes, with legacy plaintext still accepted. */
export async function verifyPassword(plain: string, stored: unknown): Promise<boolean> {
  if (!plain || stored == null || stored === '') return false;
  const saved = String(stored);
  if (isPasswordHash(saved)) {
    try {
      return await bcrypt.compare(String(plain), saved);
    } catch {
      return false;
    }
  }
  return saved === String(plain);
}
