const CACHE = 'apoen-static-v3';
const OFFLINE_PAGE = '/offline';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(OFFLINE_PAGE).catch(() => undefined)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => (await caches.match(OFFLINE_PAGE)) ?? Response.error()));
    return;
  }

  const immutableAsset = /^\/api\/assets\/[0-9a-f-]+$/i.test(url.pathname);
  const staticFile = url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/');
  if ((!staticFile && !immutableAsset) || url.pathname.startsWith('/api/admin/')) return;

  event.respondWith(caches.match(request).then(async (cached) => {
    if (cached) return cached;
    const response = await fetch(request);
    const cacheControl = response.headers.get('Cache-Control') ?? '';
    const canCache = response.ok && staticFile
      ? true
      : response.ok && immutableAsset && /public/.test(cacheControl) && /immutable/.test(cacheControl);
    if (canCache) {
      const copy = response.clone();
      void caches.open(CACHE).then((cache) => cache.put(request, copy));
    }
    return response;
  }));
});
