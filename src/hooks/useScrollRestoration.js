import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { scrollStore } from './useRestorableState';

const RESTORE_TIMEOUT_MS = 3000;
const SETTLE_MS = 400;

/**
 * Asosiy scroll konteyneri uchun scroll joyini tiklash.
 *  - Orqaga/Oldinga (yoki yangilash): o'sha tarix yozuvidagi scroll joyi tiklanadi
 *    (kontent yuklanguncha qayta urinadi).
 *  - Yangi sahifaga o'tish: tepadan boshlanadi.
 *  - Shu sahifa ichida (?tab=, ?q= replace): scroll tegilmaydi.
 * getEl — scroll bo'ladigan elementni qaytaruvchi funksiya (ref.current).
 */
export function useScrollRestoration(getEl) {
  const location = useLocation();
  const keyRef = useRef(location.key);
  const pathRef = useRef(location.pathname);
  const recordingRef = useRef(true);
  const cancelRef = useRef(null);
  const getElRef = useRef(getEl);
  getElRef.current = getEl;

  // Scrollni yozib borish (capture — element mount vaqtiga bog'liq emas)
  useEffect(() => {
    const onScroll = (e) => {
      const el = getElRef.current && getElRef.current();
      if (!el || e.target !== el) return;
      if (recordingRef.current) scrollStore.write(keyRef.current, el.scrollTop);
    };
    document.addEventListener('scroll', onScroll, true);
    return () => document.removeEventListener('scroll', onScroll, true);
  }, []);

  useLayoutEffect(() => {
    const prevPath = pathRef.current;
    const samePath = prevPath === location.pathname;
    keyRef.current = location.key;
    pathRef.current = location.pathname;

    if (cancelRef.current) { cancelRef.current(); cancelRef.current = null; }

    const el = getElRef.current && getElRef.current();
    const saved = scrollStore.read(location.key);

    // Shu sahifa ichida replace (filtr/tab o'zgarishi): scrollni o'sha holicha qoldiramiz
    if (saved === undefined && samePath) {
      if (el) scrollStore.write(location.key, el.scrollTop);
      recordingRef.current = true;
      return undefined;
    }

    const target = saved === undefined ? 0 : saved;
    recordingRef.current = false; // sahifa almashayotganda kontent qisqarib scroll 0 bo'lib qolishini yozmaymiz

    let rafId = 0;
    let settleTimer = 0;
    let finished = false;
    const startedAt = Date.now();

    const finish = () => {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(rafId);
      detach();
      const wait = Math.max(0, SETTLE_MS - (Date.now() - startedAt));
      settleTimer = window.setTimeout(() => { recordingRef.current = true; }, wait);
    };

    const onUser = () => finish();
    const detach = () => {
      window.removeEventListener('wheel', onUser, true);
      window.removeEventListener('touchstart', onUser, true);
      window.removeEventListener('keydown', onUser, true);
      window.removeEventListener('pointerdown', onUser, true);
    };

    window.addEventListener('wheel', onUser, { capture: true, passive: true });
    window.addEventListener('touchstart', onUser, { capture: true, passive: true });
    window.addEventListener('keydown', onUser, true);
    window.addEventListener('pointerdown', onUser, true);

    if (target === 0) {
      const tick = () => {
        const node = getElRef.current && getElRef.current();
        if (node) node.scrollTop = 0;
        if (Date.now() - startedAt < SETTLE_MS) rafId = requestAnimationFrame(tick);
        else finish();
      };
      tick();
    } else {
      const tick = () => {
        const node = getElRef.current && getElRef.current();
        if (node) {
          node.scrollTop = target;
          if (Math.abs(node.scrollTop - target) <= 2) {
            // Kontent hali o'sib borayotgan bo'lishi mumkin — qisqa vaqt ushlab turamiz
            if (Date.now() - startedAt > 700) { finish(); return; }
          }
        }
        if (Date.now() - startedAt > RESTORE_TIMEOUT_MS) { finish(); return; }
        rafId = requestAnimationFrame(tick);
      };
      tick();
    }

    cancelRef.current = () => {
      finished = true;
      cancelAnimationFrame(rafId);
      window.clearTimeout(settleTimer);
      detach();
    };
    return undefined;
  }, [location.key, location.pathname]);

  useEffect(() => () => { if (cancelRef.current) cancelRef.current(); }, []);
}

export default useScrollRestoration;
