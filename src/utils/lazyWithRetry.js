import { lazy } from 'react';

const CHUNK_ERROR_RE =
  /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk [\d]+ failed|ChunkLoadError|error loading dynamically imported module/i;

export function isChunkLoadError(error) {
  if (!error) return false;
  if (error?.name === 'ChunkLoadError') return true;
  const msg = String(error?.message || error);
  return CHUNK_ERROR_RE.test(msg);
}

/**
 * React.lazy wrapper that soft-reloads once when a stale/missing chunk fails after deploy.
 * Prevents permanent white-screen / "dynamically imported module" failures on Bemorlar/Sozlamalar.
 */
export function lazyWithRetry(factory, sessionKey = 'chunk_soft_reload') {
  return lazy(async () => {
    try {
      const mod = await factory();
      try {
        sessionStorage.removeItem(sessionKey);
      } catch (_) { /* ignore */ }
      return mod;
    } catch (error) {
      if (typeof window !== 'undefined' && isChunkLoadError(error)) {
        let alreadyReloaded = false;
        try {
          alreadyReloaded = sessionStorage.getItem(sessionKey) === '1';
        } catch (_) { /* ignore */ }

        if (!alreadyReloaded) {
          try {
            sessionStorage.setItem(sessionKey, '1');
          } catch (_) { /* ignore */ }
          window.location.reload();
          // Keep Suspense pending until the soft reload completes.
          return new Promise(() => {});
        }
      }
      throw error;
    }
  });
}

export default lazyWithRetry;
