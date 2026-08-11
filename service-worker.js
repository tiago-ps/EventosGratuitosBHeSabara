const CACHE_VERSION = 'mural-cultural-v63.2-obras-multiacervo';
const CORE_CACHE = `${CACHE_VERSION}-core`;
const DATA_CACHE = `${CACHE_VERSION}-data`;
const IMAGE_CACHE = `${CACHE_VERSION}-images`;
const MAX_IMAGE_CACHE_ITEMS = 140;
const BRAND_LOGO_PATH = '/imagens/marca/logo-mural-cultural.png';

const CORE_ASSETS = [
  './', './index.html', './css/styles.css', './css/eventos-manuais-ui.css',
  './js/app.js', './js/eventos-manuais-ui.js', './manifest.webmanifest',
  './imagens/app-icons/icon-192.png', './imagens/app-icons/icon-512.png',
  './imagens/app-icons/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CORE_CACHE)
    .then(cache => cache.addAll(CORE_ASSETS))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys
      .filter(key => (key.startsWith('agenda-cultural-') || key.startsWith('mural-cultural-')) &&
        ![CORE_CACHE, DATA_CACHE, IMAGE_CACHE].includes(key))
      .map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});

function isCacheableResponse(response) {
  return Boolean(response && response.ok && response.type === 'basic');
}

async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  const excess = keys.length - maxItems;
  if (excess > 0) await Promise.all(keys.slice(0, excess).map(key => cache.delete(key)));
}

async function networkFirst(request, cacheName, fallbackUrl = '', expectedContentType = '') {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    const contentType = response.headers.get('content-type') || '';
    if (expectedContentType && !contentType.includes(expectedContentType)) {
      throw new Error(`Tipo inesperado: ${contentType || 'ausente'}`);
    }
    if (isCacheableResponse(response)) await cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) ||
      (fallbackUrl ? await caches.match(fallbackUrl) : undefined) ||
      Response.error();
  }
}

async function networkFirstBrandImage(request) {
  const freshRequest = new Request(request, { cache: 'no-store' });
  return networkFirst(freshRequest, IMAGE_CACHE, '', 'image/');
}

async function cacheFirstImage(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  const contentType = response.headers.get('content-type') || '';
  if (isCacheableResponse(response) && contentType.startsWith('image/')) {
    await cache.put(request, response.clone());
    await trimCache(IMAGE_CACHE, MAX_IMAGE_CACHE_ITEMS);
  }
  return response;
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, CORE_CACHE, './index.html', 'text/html'));
  } else if (['/eventos.json', '/livros.json', '/configuracao-mural.json'].some(path => url.pathname.endsWith(path))) {
    const fileName = url.pathname.split('/').pop();
    const stableRequest = new Request(new URL(`./${fileName}`, self.registration.scope), {
      mode: 'same-origin', credentials: 'same-origin'
    });
    event.respondWith(networkFirst(stableRequest, DATA_CACHE, '', 'application/json'));
  } else if (url.pathname.endsWith(BRAND_LOGO_PATH)) {
    // A marca pode ser trocada no repositório mantendo o mesmo nome.
    // Busca sempre a versão da rede e usa a cópia local apenas se estiver offline.
    event.respondWith(networkFirstBrandImage(request));
  } else if (request.destination === 'image') {
    event.respondWith(cacheFirstImage(request));
  } else if (['style', 'script', 'manifest', 'font'].includes(request.destination)) {
    event.respondWith(networkFirst(request, CORE_CACHE));
  }
});
