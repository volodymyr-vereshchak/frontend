import { useState, useEffect } from 'react';

/**
 * True on narrow (phone) viewports. Override with `?desktop=1` to force the
 * desktop UI on a phone (useful for testing/admin).
 */
export function useIsMobile(maxWidth = 768) {
  const compute = () => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    if (params.get('desktop') === '1') return false;
    return window.matchMedia(`(max-width: ${maxWidth}px)`).matches;
  };

  const [isMobile, setIsMobile] = useState(compute);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const handler = () => setIsMobile(compute());
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [maxWidth]);

  return isMobile;
}
