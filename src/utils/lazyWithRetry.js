import { lazy } from 'react';

const CHUNK_ERROR_RE =
  /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk [\d]+ failed|ChunkLoadError|error loading dynamically imported module|Unable to preload CSS|Failed to load module script|Load failed|dynamically imported module/i;

export function isChunkLoadError(error) {
  if (!error) return false;
  if (error?.name === 'ChunkLoadError') return true;
  const msg = String(error?.message || error || '');
  if (CHUNK_ERROR_RE.test(msg)) return true;
  // Vite/Safari sometimes surface TypeError without the full phrase
  if (error instanceof TypeError && /fetch|load|module|import/i.test(msg)) return true;
  return false;
}

/**
 * React.lazy wrapper that soft-reloads once when a stale/missing chunk fails after deploy.
 * Pass a unique sessionKey per heavy route (Patients/Settings) so one route's reload
 * does not block soft-retry for another.
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
