export function formatSom(value: number, currency: string): string {
  const amount = Math.round(Number(value) || 0);
  return `${new Intl.NumberFormat('uz-UZ').format(amount)} ${currency}`;
}

export function formatPhone(value: string): string {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('998')) {
    return `+${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 10)} ${digits.slice(10)}`;
  }
  if (!digits) return '';
  return digits.startsWith('+') ? digits : `+${digits}`;
}

export function digitsOnly(value: string): string {
  return String(value || '').replace(/\D/g, '').slice(0, 15);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('');
}

export function rid(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const stamp = Date.now().toString(36).slice(-4);
  return `${prefix}-${rand}${stamp}`;
}
