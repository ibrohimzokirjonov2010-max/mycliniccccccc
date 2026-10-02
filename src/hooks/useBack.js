import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

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

export default useBack;
