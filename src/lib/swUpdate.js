/**
 * Pick up a new service worker without waiting for a second manual reload.
 * The installed PWA otherwise keeps the previous precached wizard shell.
 */
export function listenForAppUpdates() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  let reloading = false;
  const reloadOnce = () => {
    if (reloading) return;
    try {
      const last = Number(sessionStorage.getItem('sw-update-reload-at') || 0);
      if (Date.now() - last < 15000) return;
      sessionStorage.setItem('sw-update-reload-at', String(Date.now()));
    } catch (_) { /* private mode */ }
    reloading = true;
    window.location.reload();
  };

  navigator.serviceWorker.addEventListener('controllerchange', reloadOnce);

  const check = () => {
    navigator.serviceWorker.getRegistration()
      .then((registration) => registration?.update())
      .catch(() => {});
  };

  window.addEventListener('load', check);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
  window.setInterval(check, 60 * 1000);
}
