const CACHE_VERSION = 'agenda-cultural-v53.2';
const CORE_CACHE = `${CACHE_VERSION}-core`;
const DATA_CACHE = `${CACHE_VERSION}-data`;
const IMAGE_CACHE = `${CACHE_VERSION}-images`;

const CORE_ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './css/eventos-manuais-ui.css',
  './js/app.js',
  './js/eventos-manuais-ui.js',
  './manifest.webmanifest',
  './imagens/app-icons/icon-192.png',
  './imagens/app-icons/icon-512.png',
  './imagens/app-icons/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CORE_CACHE)
      .then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key.startsWith('agenda-cultural-') && ![CORE_CACHE, DATA_CACHE, IMAGE_CACHE].includes(key))
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response && response.ok) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    return (await cache.match(request)) || (fallbackUrl ? await caches.match(fallbackUrl) : undefined) || Response.error();
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) await cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, CORE_CACHE, './index.html'));
    return;
  }

  if (url.pathname.endsWith('/eventos.json')) {
    const stableRequest = new Request(new URL('./eventos.json', self.registration.scope), {
      headers: request.headers,
      mode: 'same-origin',
      credentials: 'same-origin'
    });
    event.respondWith(networkFirst(stableRequest, DATA_CACHE));
    return;
  }

  if (request.destination === 'image') {
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
    return;
  }

  if (['style', 'script', 'manifest', 'font'].includes(request.destination)) {
    event.respondWith(cacheFirst(request, CORE_CACHE));
  }
});
