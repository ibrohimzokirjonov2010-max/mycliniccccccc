import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 10;
const BCRYPT_HASH_RE = /^\$2[aby]\$\d{2}\$/;

export function isPasswordHash(value) {
  return typeof value === 'string' && BCRYPT_HASH_RE.test(value);
}

export async function hashPassword(plain) {
  if (!plain || typeof plain !== 'string') return plain;
  if (isPasswordHash(plain)) return plain;
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain, stored) {
  if (!plain || !stored) return false;
  if (isPasswordHash(stored)) {
    try {
      return await bcrypt.compare(String(plain), stored);
    } catch {
      return false;
    }
  }
  return String(stored) === String(plain);
}

export function sanitizeUser(user) {
  if (!user || typeof user !== 'object') return user;
  const { password, ...rest } = user;
  return rest;
}

export function sanitizeUsers(users) {
  if (!Array.isArray(users)) return users;
  return users.map(sanitizeUser);
}

export async function preparePasswordForWrite(password) {
  if (password == null) return undefined;
  const trimmed = typeof password === 'string' ? password.trim() : String(password);
  if (!trimmed) return undefined;
  return hashPassword(trimmed);
}
