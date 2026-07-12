const CACHE = 'thoth-portal-v1';
const SHELL = ['/', '/home', '/devices', '/manifest.json'];
self.addEventListener('install', (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).catch(() => undefined)));
self.addEventListener('activate', (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))));
self.addEventListener('message', (event) => {
  if (event.data === 'CLEAR_PRIVATE_CACHE') event.waitUntil(caches.delete(CACHE));
});
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;
  const cacheableApi = url.pathname.includes('/device/') || url.pathname.startsWith('/api/data/minutes');
  if (cacheableApi || event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then((response) => {
      if (response.ok) caches.open(CACHE).then((cache) => cache.put(event.request, response.clone()));
      return response;
    }).catch(() => caches.match(event.request).then((cached) => cached || caches.match('/home'))));
    return;
  }
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
    if (response.ok && ['script', 'style', 'image', 'font'].includes(event.request.destination)) caches.open(CACHE).then((cache) => cache.put(event.request, response.clone()));
    return response;
  })));
});
