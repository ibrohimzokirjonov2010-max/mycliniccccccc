/** Browser helpers. Password hashing stays on the server (/api/auth). */

export function sanitizeUser(user) {
  if (!user || typeof user !== 'object') return user;
  const { password, ...rest } = user;
  return rest;
}

export function sanitizeUsers(users) {
  if (!Array.isArray(users)) return users;
  return users.map(sanitizeUser);
}
