/* After a deploy, the previous service worker keeps serving its precached
   index.html (cache-first navigation). The clinic PWA then stays on the old
   Yangi implant wizard until a second full reload. Claiming clients and
   navigating them once per build token loads the new shell immediately.
   Later deploys still refresh via the page controllerchange listener. */
const SW_RELOAD_TOKEN = 'linear-click-v2';
const SW_RELOAD_FLAG = `https://sw-reload.local/${SW_RELOAD_TOKEN}`;

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    await self.clients.claim();
    const cache = await caches.open('sw-reload-guard');
    if (await cache.match(SW_RELOAD_FLAG)) return;
    await cache.put(SW_RELOAD_FLAG, new Response(SW_RELOAD_TOKEN));
    const windows = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });
    // Navigate after activate finishes. Awaiting client.navigate inside
    // waitUntil can deadlock: the navigation waits for activate, and
    // activate would wait for the navigation.
    setTimeout(() => {
      windows.forEach((client) => {
        const url = client.url || '';
        if (!url.startsWith('http') || typeof client.navigate !== 'function') return;
        client.navigate(url).catch(() => {});
      });
    }, 50);
  })());
});
