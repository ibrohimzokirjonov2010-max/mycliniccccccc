import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';

/**
 * Sahifa holatini tarix yozuvi (location.key) bo'yicha sessionStorage'da saqlaydi.
 * Orqaga/Oldinga yoki sahifani yangilash — o'sha yozuvga qaytganda holat tiklanadi.
 * Yangi kirish (sidebar, havola) — yangi key, ya'ni boshlang'ich holat.
 */
const PREFIX = 'shifo:rs:';
const INDEX_KEY = 'shifo:rs:__index';
const MAX_ENTRIES = 300;

function safeStorage() {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

function readEntry(locKey, name) {
  const s = safeStorage();
  if (!s) return undefined;
  try {
    const raw = s.getItem(`${PREFIX}${locKey}:${name}`);
    return raw == null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function writeEntry(locKey, name, value) {
  const s = safeStorage();
  if (!s) return;
  try {
    const full = `${PREFIX}${locKey}:${name}`;
    const isNew = s.getItem(full) == null;
    s.setItem(full, JSON.stringify(value));
    if (isNew) {
      let index = [];
      try { index = JSON.parse(s.getItem(INDEX_KEY) || '[]'); } catch { index = []; }
      index.push(full);
      while (index.length > MAX_ENTRIES) {
        const old = index.shift();
        s.removeItem(old);
      }
      s.setItem(INDEX_KEY, JSON.stringify(index));
    }
  } catch {
    /* quota / private mode — holat saqlanmaydi, lekin sahifa ishlayveradi */
  }
}

/** Scroll joyi uchun yordamchilar (useScrollRestoration ishlatadi). */
export const scrollStore = {
  read: (locKey) => {
    const v = readEntry(locKey, '__scroll');
    return typeof v === 'number' ? v : undefined;
  },
  write: (locKey, top) => writeEntry(locKey, '__scroll', Math.max(0, Math.round(top))),
};

/**
 * useRestorableState(name, initial) — useState bilan bir xil API.
 * Qiymat JSON-serializatsiya qilinadigan bo'lishi kerak (string, number, boolean, array, oddiy object).
 */
export function useRestorableState(name, initialValue) {
  const location = useLocation();
  const locKeyRef = useRef(location.key);
  locKeyRef.current = location.key;

  const [value, setValue] = useState(() => {
    const stored = readEntry(location.key, name);
    if (stored !== undefined) return stored;
    return typeof initialValue === 'function' ? initialValue() : initialValue;
  });

  // Har o'zgarishda (va location.key almashganda — replace) joriy yozuv ostida saqlaymiz
  useEffect(() => {
    writeEntry(location.key, name, value);
  }, [location.key, name, value]);

  return [value, setValue];
}

/**
 * useUrlState(name, default) — oddiy string qiymatni URL query (?name=) da saqlaydi
 * (replace: true — tarixga ortiqcha yozuv qo'shmaydi). Tab, sahifa raqami kabilar uchun.
 */
export function useUrlState(name, defaultValue = '') {
  const location = useLocation();
  const locationState = location.state;
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get(name);
  const value = raw == null || raw === '' ? defaultValue : raw;

  const setValue = useCallback((next) => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      const current = params.get(name);
      const resolved = typeof next === 'function' ? next(current == null || current === '' ? defaultValue : current) : next;
      if (resolved == null || resolved === '' || String(resolved) === String(defaultValue)) params.delete(name);
      else params.set(name, String(resolved));
      return params;
    }, { replace: true, state: locationState });
  }, [name, defaultValue, setSearchParams, locationState]);

  return [value, setValue];
}

export default useRestorableState;

/**
 * Date qiymati uchun useRestorableState (ISO string sifatida saqlanadi).
 */
export function useRestorableDate(name, initialValue) {
  const toIso = (d) => (d instanceof Date ? d.toISOString() : new Date(d).toISOString());
  const [iso, setIso] = useRestorableState(name, () => toIso(typeof initialValue === 'function' ? initialValue() : initialValue));
  const date = useMemo(() => new Date(iso), [iso]);
  const setDate = useCallback((next) => {
    setIso((prev) => {
      const resolved = typeof next === 'function' ? next(new Date(prev)) : next;
      return toIso(resolved);
    });
  }, [setIso]);
  return [date, setDate];
}
