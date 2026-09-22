/**
 * Prompt clients onto a new deploy without leaving index.html sticky.
 * First install must not reload (that would loop). Later controller
 * changes mean a new service worker claimed the page.
 */
export function registerAppUpdate(registerSW) {
  if (!import.meta.env.PROD || typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;

  let hadController = Boolean(navigator.serviceWorker.controller);
  let reloading = false;
  const reloadOnce = () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  };

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) {
      hadController = true;
      return;
    }
    reloadOnce();
  });

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateSW(true);
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      const check = () => {
        registration.update().catch(() => {});
      };
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
      window.addEventListener('focus', check);
      window.setInterval(check, 60 * 1000);
      check();
    },
  });
}
