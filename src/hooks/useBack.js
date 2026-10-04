import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * True when the SPA has an earlier entry of its own to go back to
 * (react-router stores the entry index in history.state.idx).
 */
export function canGoBackInApp() {
  if (typeof window === 'undefined') return false;
  const idx = window.history?.state?.idx;
  return typeof idx === 'number' && idx > 0;
}

/**
 * useBack(fallback) — returns a stable "Orqaga" handler.
 *  - history bor: navigate(-1)  → oldingi sahifa filtr/tab/scroll holati bilan qaytadi
 *  - to'g'ridan-to'g'ri havola (tarix yo'q): fallback ro'yxat sahifasiga (replace)
 */
export function useBack(fallback = '/') {
  const navigate = useNavigate();
  return useCallback(() => {
    if (canGoBackInApp()) navigate(-1);
    else navigate(fallback, { replace: true });
  }, [navigate, fallback]);
}

/**
 * Bemor profiliga o'tishda `navigate(url, { state: profileState() })` — "kelgan joy" (yo'l + query)
 * `state.from` ga yoziladi. Profildagi "Orqaga" tarix bo'lmaganda (yangi tab, yangilash) yoki tarix
 * noto'g'ri sahifaga olib borganda shu joyga qaytaradi.
 */
export function profileState(extra) {
  if (typeof window === 'undefined') return extra;
  const from = `${window.location.pathname}${window.location.search}`;
  return { ...(extra || {}), from };
}

/**
 * Bemor profilidagi "Orqaga" (desktop va mobil).
 *  - tarix bor: navigate(-1) — kelgan sahifa sana/ko'rinish/filtr/scroll holati bilan qaytadi
 *  - tarix yo'q: state.from, bo'lmasa fallback (Bemorlar)
 *  - navigate(-1) dan keyin boshqa sahifaga (masalan /patients) tushib qolsak va kelgan joy (state.from)
 *    ma'lum bo'lsa — kelgan joyga o'tkazamiz (oyna yopilib profilda qolgan bo'lsa tegmaymiz)
 */
export function useProfileBack(fallback = '/patients') {
  const navigate = useNavigate();
  const location = useLocation();
  const from = typeof location.state?.from === 'string' ? location.state.from : '';
  const here = location.pathname;
  return useCallback(() => {
    if (!canGoBackInApp()) {
      navigate(from || fallback, { replace: true });
      return;
    }
    navigate(-1);
    if (!from) return;
    const want = from.split(/[?#]/)[0];
    window.setTimeout(() => {
      const now = window.location.pathname;
      if (now === want || now === here) return;
      navigate(from, { replace: true });
    }, 800);
  }, [navigate, from, here, fallback]);
}

export default useBack;
