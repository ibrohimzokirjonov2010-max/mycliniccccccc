// Per-user page access (Staff drawer → "Kirish huquqlari").
// user.page_access = { patients?: boolean, ... }. A missing key keeps the legacy role behaviour,
// false hides the page and blocks its URL, true shows it (also for the admin-only pages).

export const PAGE_ACCESS = [
  { key: 'patients', label: 'Bemorlar', path: '/patients' },
  { key: 'debts', label: 'Qarzlar', path: '/debts' },
  { key: 'inventory', label: 'Ombor', path: '/inventory' },
  { key: 'payments', label: "To'lovlar", path: '/payments' },
  { key: 'appointments', label: 'Qabullar', path: '/appointments' },
  { key: 'reports', label: 'Hisobotlar', path: '/reports' },
  { key: 'expenses', label: 'Xarajatlar', path: '/expenses' },
  { key: 'staff', label: 'Xodimlar', path: '/staff' },
];

export const PAGE_KEY_BY_LABEL = Object.fromEntries(PAGE_ACCESS.map((p) => [p.label, p.key]));

export function readPageAccess(user) {
  let raw = user?.page_access;
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch { raw = null; }
  }
  return raw && typeof raw === 'object' ? raw : {};
}

export function pageKeyForPath(pathname) {
  const path = String(pathname || '');
  const hit = PAGE_ACCESS.find((p) => path === p.path || path.startsWith(`${p.path}/`));
  return hit ? hit.key : null;
}

export function isPageBlocked(user, pathname) {
  if (!user || user.role === 'admin') return false;
  const key = pageKeyForPath(pathname);
  return !!key && readPageAccess(user)[key] === false;
}

export function isPageGranted(user, pathname) {
  if (!user) return false;
  const key = pageKeyForPath(pathname);
  return !!key && readPageAccess(user)[key] === true;
}

export function firstAllowedPath(user) {
  const candidates = ['/chairside', '/appointments', '/patients', '/payments', '/settings'];
  return candidates.find((p) => !isPageBlocked(user, p)) || '/settings';
}
