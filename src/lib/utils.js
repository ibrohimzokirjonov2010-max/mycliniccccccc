import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility function to merge Tailwind CSS classes
 * 
 * Combines clsx for conditional classes and tailwind-merge for deduplication.
 * 
 * @param {...(string|Object|Array)} inputs - Class values to merge
 * @returns {string} Merged class string
 * @example
 * cn('px-4', 'py-2', { 'bg-blue-500': true, 'text-white': true })
 * // => 'px-4 py-2 bg-blue-500 text-white'
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Check if the application is running inside an iframe
 * 
 * @returns {boolean} True if running in iframe
 */
export const isIframe = typeof window !== 'undefined' && window.self !== window.top;

/**
 * Format number as currency (Uzbek so'm)
 * 
 * @param {number} amount - Amount to format
 * @returns {string} Formatted currency string
 * @example
 * formatCurrency(1500000) // => "1 500 000 so'm"
 */
export function formatCurrency(amount, currency = "so'm", locale = 'uz-UZ') {
  if (amount === null || amount === undefined) return "—";
  return `${amount.toLocaleString(locale)} ${currency}`;
}

/**
 * Format date to Uzbek locale string
 * 
 * @param {string|Date} date - Date to format
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string
 */
export function formatDate(date, options = {}) {
  if (!date) return '—';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '—';
  
  const defaultOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options
  };
  
  return d.toLocaleDateString(options.locale || 'uz-UZ', defaultOptions);
}

/**
 * Format date and time to Uzbek locale string
 * 
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date and time string
 */
export function formatDateTime(date, locale = 'uz-UZ') {
  if (!date) return '—';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '—';
  
  return d.toLocaleString(locale || 'uz-UZ', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Truncate text with ellipsis
 * 
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
export function truncateText(text, maxLength = 50) {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

/**
 * Generate unique ID
 * 
 * @returns {string} Unique identifier
 */
export function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function debounce(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Apply phone mask for Uzbekistan (+998 (XX) XXX-XX-XX)
 * @param {string} value - Raw input value
 * @returns {string} Formatted phone number
 */
export function applyPhoneMask(value) {
  if (!value) return "";
  
  // Remove all non-digits
  let digits = value.replace(/\D/g, "");
  
  // Smart auto-prefix: If user starts with a local 9-digit number
  if (digits.length === 9 && !digits.startsWith("998")) {
    digits = "998" + digits;
  }
  
  // Limit to 12 digits
  const clean = digits.substring(0, 12);
  
  if (clean.length === 0) return "";
  if (clean.length <= 3) return `+${clean}`;
  if (clean.length <= 5) return `+${clean.substring(0, 3)} (${clean.substring(3, 5)}`;
  if (clean.length <= 8) return `+${clean.substring(0, 3)} (${clean.substring(3, 5)}) ${clean.substring(5, 8)}`;
  if (clean.length <= 10) return `+${clean.substring(0, 3)} (${clean.substring(3, 5)}) ${clean.substring(5, 8)}-${clean.substring(8, 10)}`;
  return `+${clean.substring(0, 3)} (${clean.substring(3, 5)}) ${clean.substring(5, 8)}-${clean.substring(8, 10)}-${clean.substring(10, 12)}`;
}

/**
 * Format a stored phone number for display.
 * Input:  "998901234567" | "+998901234567" | "901234567"
 * Output: "+998 90 123-45-67"
 *
 * @param {string} phone - Raw phone string
 * @returns {string} Prettily formatted phone or original if unrecognised
 */
export function formatPhone(phone) {
  if (!phone) return '—';
  const digits = String(phone).replace(/\D/g, '');
  // Uzbek numbers: 998 + 9 digits = 12 digits total
  if (digits.length === 12 && digits.startsWith('998')) {
    const cc  = digits.substring(0, 3);  // 998
    const op  = digits.substring(3, 5);  // operator code (2 digits)
    const p1  = digits.substring(5, 8);  // 3 digits
    const p2  = digits.substring(8, 10); // 2 digits
    const p3  = digits.substring(10, 12);// 2 digits
    return `+${cc} ${op} ${p1}-${p2}-${p3}`;
  }
  // 9-digit local number
  if (digits.length === 9) {
    const op = digits.substring(0, 2);
    const p1 = digits.substring(2, 5);
    const p2 = digits.substring(5, 7);
    const p3 = digits.substring(7, 9);
    return `+998 ${op} ${p1}-${p2}-${p3}`;
  }
  // Fallback: return as-is (may already be formatted or unknown)
  return phone;
}

export function capitalizeName(name) {
  if (!name) return "";
  return name
    .split(' ')
    .map(spacePart => {
      return spacePart
        .split('-')
        .map(dashPart => {
          if (!dashPart) return "";
          return dashPart.charAt(0).toUpperCase() + dashPart.slice(1).toLowerCase();
        })
        .join('-');
    })
    .join(' ');
}

export function capitalizeAsYouType(val) {
  if (!val) return "";
  return val
    .split(' ')
    .map(spacePart => {
      return spacePart
        .split('-')
        .map(dashPart => {
          if (!dashPart) return "";
          return dashPart.charAt(0).toUpperCase() + dashPart.slice(1).toLowerCase();
        })
        .join('-');
    })
    .join(' ');
}

export function validateAddress(address) {
  if (!address) return true;
  const trimmed = address.trim();
  if (trimmed === '') return true;
  
  if (/^\d+$/.test(trimmed)) return false; // purely numbers
  if (trimmed.length < 5) return false;    // too short
  if (!/[a-zA-Zа-яА-ЯўЎқҚғҒҳҲ]/.test(trimmed)) return false; // no letters
  
  // Must contain at least one space to indicate city/street/district, or match common cities
  const commonCities = /^(toshkent|samarqand|buxoro|xorazm|andijon|fargona|namangan|jizzax|sirdaryo|surxondaryo|qashqadaryo|navoiy|nukus|qoraqalpog|tashkent)/i;
  if (!trimmed.includes(' ') && !commonCities.test(trimmed)) {
    return false;
  }
  
  return true;
}

export default cn;
