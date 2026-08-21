import { useState, useEffect } from 'react';

/**
 * Professional Breakpoint Hook
 * Standardizes mobile detection across the application
 */
export function useIsMobile(breakpoint = 768) {
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
