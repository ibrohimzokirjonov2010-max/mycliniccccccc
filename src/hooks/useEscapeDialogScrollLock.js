import { useEffect } from 'react';

/**
 * A Radix Dialog (modal) locks page scroll with react-remove-scroll, which
 * cancels wheel / touchmove events whose target is outside the dialog
 * content. Overlays we portal to <body> on top of an open dialog (invoice
 * preview, jaw chooser, …) are "outside", so their own scroll areas froze.
 *
 * Stopping propagation at the overlay root keeps the event away from the
 * document-level lock listener; the browser still scrolls the overlay.
 */
export function useEscapeDialogScrollLock(ref, active = true) {
  useEffect(() => {
    const node = ref?.current;
    if (!active || !node) return undefined;
    const stop = (event) => event.stopPropagation();
    const opts = { passive: true };
    node.addEventListener('wheel', stop, opts);
    node.addEventListener('touchmove', stop, opts);
    node.addEventListener('touchstart', stop, opts);
    return () => {
      node.removeEventListener('wheel', stop, opts);
      node.removeEventListener('touchmove', stop, opts);
      node.removeEventListener('touchstart', stop, opts);
    };
  }, [ref, active]);
}

export default useEscapeDialogScrollLock;
