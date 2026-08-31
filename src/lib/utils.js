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
  
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  
  return `${day}.${month}.${year}`;
}

const UZ_MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];
const UZ_WEEKDAYS = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];

const RU_MONTHS = ['Января', 'Февраля', 'Марта', 'Апреля', 'Мая', 'Июня', 'Июля', 'Августа', 'Сентября', 'Октября', 'Ноября', 'Декабря'];
const RU_WEEKDAYS = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const EN_WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Format full date with localized month name and weekday
 * Guarantees 100% clean formatting without ICU / M08 bugs on all browsers
 */
export function formatDateWithWeekday(date, lang = 'uz') {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (!d || isNaN(d.getTime())) return String(date || '');
  
  const day = d.getDate();
  const monthIdx = d.getMonth();
  const dayOfWeek = d.getDay();
  const year = d.getFullYear();

  if (lang === 'ru') {
    return `${day} ${RU_MONTHS[monthIdx]} ${year} г., ${RU_WEEKDAYS[dayOfWeek]}`;
  }
  if (lang === 'en') {
    return `${EN_MONTHS[monthIdx]} ${day}, ${year}, ${EN_WEEKDAYS[dayOfWeek]}`;
  }
  return `${day}-${UZ_MONTHS[monthIdx]}, ${year} (${UZ_WEEKDAYS[dayOfWeek]})`;
}

/**
 * Format service status label into current language
 * Converts raw statuses ('planned', 'completed', 'in_progress', etc.) to localized user-friendly strings.
 */
export function getServiceStatusLabel(status, lang = 'uz') {
  const s = String(status || '').toLowerCase().trim();
  if (s === 'completed' || s === 'bajarildi' || s === 'zaversheno' || s === 'bajarilgan' || s === 'done' || s === 'paid') {
    return lang === 'ru' ? 'Выполнено' : lang === 'en' ? 'Completed' : 'Bajarildi';
  }
  if (s === 'in_progress' || s === 'jarayonda' || s === 'v_processe' || s === 'progress') {
    return lang === 'ru' ? 'В процессе' : lang === 'en' ? 'In Progress' : 'Jarayonda';
  }
  if (s === 'cancelled' || s === 'bekor_qilindi' || s === 'otmeneno') {
    return lang === 'ru' ? 'Отменено' : lang === 'en' ? 'Cancelled' : 'Bekor qilindi';
  }
  // Default: planned / rejalashtirilgan
  return lang === 'ru' ? 'Запланировано' : lang === 'en' ? 'Planned' : 'Rejalashtirilgan';
}

/**
 * Format treatment plan name or category
 */
export function getTreatmentTypeLabel(typeOrCategory, lang = 'uz') {
  if (!typeOrCategory) return lang === 'ru' ? 'План лечения' : lang === 'en' ? 'Treatment Plan' : 'Davolash rejasi';
  const str = String(typeOrCategory).trim();
  const lower = str.toLowerCase();
  if (lower === 'treatment' || lower === 'davolash') {
    return lang === 'ru' ? 'Лечение' : lang === 'en' ? 'Treatment' : 'Davolash';
  }
  if (lower === 'treatment plan' || lower === 'davolash rejasi') {
    return lang === 'ru' ? 'План лечения' : lang === 'en' ? 'Treatment Plan' : 'Davolash rejasi';
  }
  if (lower === 'consultation' || lower === 'maslahat') {
    return lang === 'ru' ? 'Консультация' : lang === 'en' ? 'Consultation' : 'Maslahat';
  }
  if (lower === 'filling' || lower === 'plomba' || lower === 'plombirovanie') {
    return lang === 'ru' ? 'Пломбирование' : lang === 'en' ? 'Filling' : 'Plomba';
  }
  if (lower === 'cleaning' || lower === 'tozalash' || lower === 'chiska') {
    return lang === 'ru' ? 'Чистка' : lang === 'en' ? 'Cleaning' : 'Tozalash';
  }
  if (lower === 'implant' || lower === 'implantatsiya') {
    return lang === 'ru' ? 'Имплантация' : lang === 'en' ? 'Implant' : 'Implantatsiya';
  }
  if (lower === 'orthodontics' || lower === 'ortodontiya' || lower === 'breket') {
    return lang === 'ru' ? 'Ортодонтия' : lang === 'en' ? 'Orthodontics' : 'Ortodontiya';
  }
  return str;
}

/**
 * Format service category label
 */
export function getServiceCategoryLabel(category, lang = 'uz') {
  if (!category) return lang === 'ru' ? 'Терапия / Лечение' : lang === 'en' ? 'Therapy / Treatment' : 'Plomba / Davolash';
  const str = String(category).trim();
  const lower = str.toLowerCase();
  if (lower === 'filling' || lower === 'plomba') {
    return lang === 'ru' ? 'Пломба / Лечение' : lang === 'en' ? 'Filling / Treatment' : 'Plomba / Davolash';
  }
  if (lower === 'cleaning' || lower === 'tozalash' || lower === 'chiska') {
    return lang === 'ru' ? 'Чистка / Гигиена' : lang === 'en' ? 'Cleaning / Hygiene' : 'Tozalash / Gigiyena';
  }
  if (lower === 'terapiya' || lower === 'therapy') {
    return lang === 'ru' ? 'Терапия' : lang === 'en' ? 'Therapy' : 'Terapiya';
  }
  if (lower === 'implant' || lower === 'implantologiya') {
    return lang === 'ru' ? 'Имплантология' : lang === 'en' ? 'Implantology' : 'Implantologiya';
  }
  if (lower === 'ortodontiya' || lower === 'orthodontics') {
    return lang === 'ru' ? 'Ортодонтия' : lang === 'en' ? 'Orthodontics' : 'Ortodontiya';
  }
  if (lower === 'protez' || lower === 'prosthetics' || lower === 'ortopediya') {
    return lang === 'ru' ? 'Ортопедия / Протезирование' : lang === 'en' ? 'Prosthetics' : 'Ortopediya / Protez';
  }
  return str;
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
  
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  
  return `${day}.${month}.${year} ${hours}:${minutes}`;
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
