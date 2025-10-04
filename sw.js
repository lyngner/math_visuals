const CACHE_NAMESPACE = 'math-visuals';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.filter((key) => key.startsWith(CACHE_NAMESPACE)).map((key) => caches.delete(key)));
      } catch (error) {
        // Ignore cache cleanup errors – stale caches will simply be skipped.
      }
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (!request) return;
  if (request.method !== 'GET') return;
  if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === '/sw.js') return;

  const networkRequest = new Request(request, { cache: 'no-store' });
  event.respondWith(fetch(networkRequest));
});
