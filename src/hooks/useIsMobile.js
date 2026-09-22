import { useState, useEffect } from 'react';

/**
 * Professional Breakpoint Hook
 * Standardizes mobile detection across the application
 */
/** Matches NativeMobileLayout / App shell (width < 1024). */
export function useIsMobile(breakpoint = 1024) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < breakpoint);

  useEffect(() => {
    let raf;
    const handler = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setIsMobile(window.innerWidth < breakpoint);
      });
    };

    window.addEventListener('resize', handler, { passive: true });
    return () => {
      window.removeEventListener('resize', handler);
      cancelAnimationFrame(raf);
    };
  }, [breakpoint]);

  return isMobile;
}
