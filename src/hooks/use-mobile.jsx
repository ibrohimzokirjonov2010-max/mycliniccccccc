import { useState, useEffect } from 'react';

/**
 * Mobile breakpoint in pixels
 */
const MOBILE_BREAKPOINT = 768;

/**
 * useIsMobile Hook
 * 
 * Custom React hook to detect if the current viewport is mobile size.
 * Uses matchMedia API for efficient responsive detection.
 * 
 * @returns {boolean} True if viewport width is less than mobile breakpoint
 * @example
 * const isMobile = useIsMobile();
 * return isMobile ? <MobileNav /> : <DesktopNav />;
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(undefined);

  useEffect(() => {
    // Create media query list
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    
    /**
     * Handle media query change
     */
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    // Add listener and set initial value
    mql.addEventListener('change', onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);

    // Cleanup listener on unmount
    return () => mql.removeEventListener('change', onChange);
  }, []);

  // Return boolean (false if undefined during SSR)
  return !!isMobile;
}

export default useIsMobile;
