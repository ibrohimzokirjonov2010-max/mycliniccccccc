import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

function digitsOf(value) {
  return String(value || '').replace(/\D/g, '');
}

function formatDateDigits(digits) {
  const d = digits.slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}.${d.slice(2)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 4)}.${d.slice(4)}`;
}

function formatDateTimeDigits(digits) {
  const d = digits.slice(0, 12);
  const date = formatDateDigits(d.slice(0, 8));
  if (d.length <= 8) return date;
  const rest = d.slice(8);
  const time = rest.length <= 2 ? rest : `${rest.slice(0, 2)}:${rest.slice(2, 4)}`;
  return `${date} ${time}`;
}

function isoDateToDisplay(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return '';
  return `${match[3]}.${match[2]}.${match[1]}`;
}

// typed-date-parse-v1: "1.5.1990", "01/05/90", "1-5-1990", "010590" used to be mangled
// (1.5.1990 -> 15.19.90) and silently dropped, so the birth date was never saved.
function expandYear(y) {
  const s = String(y || '');
  if (s.length === 4) return s;
  if (s.length !== 2) return '';
  const nowYY = new Date().getFullYear() % 100;
  return Number(s) <= nowYY ? `20${s}` : `19${s}`;
}

const TYPED_SEPARATOR = /[./\-\s]/;

/** Loose typed date -> "dd.mm.yyyy" ('' if it cannot be read). */
function normalizeTypedDate(text) {
  const raw = String(text || '').trim();
  if (!raw) return '';
  if (TYPED_SEPARATOR.test(raw)) {
    const parts = raw.split(/[./\-\s]+/).filter(Boolean);
    if (parts.length !== 3 || parts.some((p) => !/^\d+$/.test(p))) return '';
    let [d, m, y] = parts;
    if (d.length === 4) [y, m, d] = [d, m, y]; // yyyy-mm-dd
    if (d.length > 2 || m.length > 2) return '';
    const yyyy = expandYear(y);
    if (!yyyy) return '';
    return `${d.padStart(2, '0')}.${m.padStart(2, '0')}.${yyyy}`;
  }
  const digits = digitsOf(raw);
  if (digits.length === 8) return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
  if (digits.length === 6) return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${expandYear(digits.slice(4))}`;
  return '';
}

/** True once the typed text is a whole date (no premature value while typing). */
function isCompleteTypedDate(text) {
  const raw = String(text || '').trim();
  if (TYPED_SEPARATOR.test(raw)) {
    const parts = raw.split(/[./\-\s]+/).filter(Boolean);
    return parts.length === 3 && (parts[2].length === 4 || parts[0].length === 4);
  }
  return digitsOf(raw).length === 8;
}

function displayDateToIso(text) {
  const match = normalizeTypedDate(text).match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) return '';
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900) return '';
  // Real calendar day only (31.02 would be rejected by the database).
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return '';
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function valueToDateTimeDisplay(value) {
  const raw = String(value || '').trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (iso) return `${iso[3]}.${iso[2]}.${iso[1]} ${iso[4]}:${iso[5]}`;
  const shown = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2}))?$/);
  if (!shown) return '';
  return shown[4] ? `${shown[1]}.${shown[2]}.${shown[3]} ${shown[4]}:${shown[5]}` : `${shown[1]}.${shown[2]}.${shown[3]}`;
}

function displayDateTimeToLocal(text) {
  const match = String(text || '').trim().match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})$/);
  if (!match) return '';
  const day = Number(match[1]);
  const month = Number(match[2]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return '';
  return `${match[3]}-${match[2]}-${match[1]}T${match[4]}:${match[5]}`;
}

function emitChange(onChange, next) {
  if (typeof onChange === 'function') onChange({ target: { value: next } });
}

function blockedByMin(iso, min) {
  if (!min || !iso) return false;
  return iso < String(min).slice(0, 10);
}

/** Text date field. Value stays YYYY-MM-DD. The box shows dd.mm.yyyy. */
export function ClinicDateField({ value, onChange, className, disabled, id, name, min }) {
  const [text, setText] = useState(() => isoDateToDisplay(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(isoDateToDisplay(value));
  }, [value, focused]);

  return (
    <input
      id={id}
      name={name}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      disabled={disabled}
      placeholder="kk.oo.yyyy"
      value={text}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        const iso = displayDateToIso(text);
        if (iso && !blockedByMin(iso, min)) {
          setText(isoDateToDisplay(iso));
          if (iso !== value) emitChange(onChange, iso);
          return;
        }
        if (!digitsOf(text)) {
          setText('');
          if (value) emitChange(onChange, '');
          return;
        }
        setText(isoDateToDisplay(value));
      }}
      onChange={(event) => {
        const rawInput = String(event.target.value || '');
        // Separators the user typed (1.5.1990) are kept; bare digits get auto dots as before.
        const next = TYPED_SEPARATOR.test(rawInput.replace(/^(\d{2})\.(\d{2})\.?/, '$1$2'))
          ? rawInput.replace(/[^\d./\-\s]/g, '').slice(0, 10)
          : formatDateDigits(digitsOf(rawInput));
        setText(next);
        if (!digitsOf(next)) {
          emitChange(onChange, '');
          return;
        }
        const iso = isCompleteTypedDate(next) ? displayDateToIso(next) : '';
        if (iso && !blockedByMin(iso, min)) emitChange(onChange, iso);
      }}
      className={cn(
        'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring',
        className,
      )}
    />
  );
}

/** Text date-time field. Shows dd.mm.yyyy HH:mm. */
export function ClinicDateTimeField({ value, onChange, className, disabled, id, name, output = 'datetime-local' }) {
  const [text, setText] = useState(() => valueToDateTimeDisplay(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(valueToDateTimeDisplay(value));
  }, [value, focused]);

  const emit = (display) => {
    if (output === 'display') {
      emitChange(onChange, display);
      return;
    }
    emitChange(onChange, displayDateTimeToLocal(display));
  };

  return (
    <input
      id={id}
      name={name}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      disabled={disabled}
      placeholder="kk.oo.yyyy ss:mm"
      value={text}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        const local = displayDateTimeToLocal(text);
        if (local) {
          const shown = valueToDateTimeDisplay(local);
          setText(shown);
          emit(shown);
          return;
        }
        if (!digitsOf(text)) {
          setText('');
          emitChange(onChange, '');
          return;
        }
        setText(valueToDateTimeDisplay(value));
      }}
      onChange={(event) => {
        const next = formatDateTimeDigits(digitsOf(event.target.value));
        setText(next);
        if (!digitsOf(next)) {
          emitChange(onChange, '');
          return;
        }
        if (displayDateTimeToLocal(next)) emit(next);
      }}
      className={cn(
        'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring',
        className,
      )}
    />
  );
}
