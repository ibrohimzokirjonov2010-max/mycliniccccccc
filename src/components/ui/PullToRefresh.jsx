import { useState, useRef, useCallback } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';
import { Loader2 } from 'lucide-react';

/**
 * Native pull-to-refresh.
 * Does NOT create a nested overflow-y-auto scrollport (that collapsed to height 0
 * inside NativeMobileLayout's absolute scroller and blanked /implants + /treatment-plans).
 * Only the indicator moves; page content stays in normal flow so it always paints.
 */
export default function PullToRefresh({ onRefresh, children }) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullProgress, setPullProgress] = useState(0);
  const rootRef = useRef(null);
  const startY = useRef(0);
  const pulling = useRef(false);

  const springConfig = { stiffness: 300, damping: 30 };
  const y = useSpring(0, springConfig);
  const rotate = useTransform(y, [0, 100], [0, 360]);
  const indicatorOpacity = useTransform(y, [0, 50], [0, 1]);

  const getScrollParent = useCallback(() => {
    let el = rootRef.current?.parentElement;
    while (el && el !== document.body) {
      const style = window.getComputedStyle(el);
      const oy = style.overflowY;
      if ((oy === 'auto' || oy === 'scroll' || oy === 'overlay') && el.scrollHeight > el.clientHeight) {
        return el;
      }
      el = el.parentElement;
    }
    return document.scrollingElement || document.documentElement;
  }, []);

  const handleTouchStart = useCallback((e) => {
    const scroller = getScrollParent();
    if ((scroller?.scrollTop ?? 0) <= 0) {
      startY.current = e.touches[0].clientY;
      pulling.current = true;
    } else {
      startY.current = 0;
      pulling.current = false;
    }
  }, [getScrollParent]);

  const handleTouchMove = useCallback((e) => {
    if (!pulling.current || startY.current === 0 || isRefreshing) return;
    const scroller = getScrollParent();
    if ((scroller?.scrollTop ?? 0) > 0) {
      pulling.current = false;
      startY.current = 0;
      setPullProgress(0);
      y.set(0);
      return;
    }
    const diff = e.touches[0].clientY - startY.current;
    if (diff > 0) {
      const progress = Math.min(diff * 0.4, 100);
      setPullProgress(progress);
      y.set(progress);
    }
  }, [getScrollParent, isRefreshing, y]);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current) return;
    pulling.current = false;
    if (pullProgress >= 80 && !isRefreshing && typeof onRefresh === 'function') {
      setIsRefreshing(true);
      y.set(64);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullProgress(0);
        y.set(0);
        startY.current = 0;
      }
    } else {
      setPullProgress(0);
      y.set(0);
      startY.current = 0;
    }
  }, [pullProgress, isRefreshing, onRefresh, y]);

  return (
    <div
      ref={rootRef}
      className="relative w-full min-w-0 max-w-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <motion.div
        style={{ y, opacity: indicatorOpacity }}
        className="pointer-events-none absolute left-0 right-0 top-0 z-10 flex h-14 -translate-y-full items-center justify-center"
        aria-hidden="true"
      >
        <div className="flex flex-col items-center">
          <motion.div style={{ rotate }}>
            <Loader2
              className={`h-5 w-5 ${isRefreshing ? 'animate-spin text-teal-500' : 'text-slate-400'}`}
            />
          </motion.div>
          <span className="mt-0.5 text-[10px] font-semibold text-slate-400">
            {isRefreshing
              ? 'Yangilanmoqda...'
              : pullProgress > 50
                ? 'Yangilash uchun qo\'yib yuboring'
                : 'Yangilash uchun torting'}
          </span>
        </div>
      </motion.div>

      {/* Content stays in normal flow — never translated / never nested overflow clip */}
      <div className="w-full min-w-0">
        {children}
      </div>
    </div>
  );
}
