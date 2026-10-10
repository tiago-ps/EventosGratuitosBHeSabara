importScripts('./js/relacoes-eventos.js?v=3');
importScripts('./js/temporalidade-eventos.js?v=1');

const SW_EVENT_RELATIONS = self.MuralCultural?.eventRelations;
const SW_EVENT_TEMPORAL = self.MuralCultural?.eventTemporal;
const CACHE_VERSION = 'mural-cultural-v209-mapa-multiconteudo';
const CORE_CACHE = `${CACHE_VERSION}-core`;
const DATA_CACHE = `${CACHE_VERSION}-data`;
const IMAGE_CACHE = `${CACHE_VERSION}-images`;
const MAX_IMAGE_CACHE_ITEMS = 140;
const BRAND_LOGO_PATH = '/imagens/marca/logo-mural-cultural.png';
const CURATION_IMAGE_PREFIX = '/imagens/curadorias/';
const PLATFORM_IMAGE_PREFIX = '/imagens/plataformas/';

const CORE_ASSETS = [
  './', './index.html',
  './css/styles.css?v=109',
  './css/mapa-espacos.css?v=2',
  './css/eventos-manuais-ui.css?v=43',
  './css/concursos-mural.css?v=3',
  './css/temas-visuais.css?v=11',
  './css/utilidade-publica.css?v=2',
  './css/atividades-lazer.css?v=1',
  './css/notificacoes.css?v=1',
  './css/painel-modos.css?v=2',
  './css/painel-acoes-contextuais.css?v=3',
  './css/tem-sim-uai-painel.css?v=1',
  './js/tema-visual-boot.js?v=17',
  './js/core/rotacao.js?v=2',
  './js/notificacoes.js?v=1',
  './js/conteudos/cursos.js?v=6',
  './js/conteudos/concursos.js?v=5',
  './js/conteudos/filmes.js?v=11',
  './js/conteudos/utilidade-publica.js?v=6',
  './js/conteudos/espacos.js?v=5',
  './js/mapa-espacos.js?v=2',
  './js/conteudos/atividades-lazer.js?v=6',
  './js/curadorias-site.js?v=13',
  './js/metricas-pontos.js?v=2',
  './js/relacoes-eventos.js?v=3',
  './js/temporalidade-eventos.js?v=1',
  './js/app.js?v=166',
  './js/temas-visuais.js?v=14',
  './js/eventos-manuais-ui.js?v=46',
  './js/ios-install.js?v=3',
  './js/painel-navegacao-modos.js?v=6',
  './js/agenda-pesquisa-foco.js?v=1',
  './js/painel-acoes-contextuais.js?v=6',
  './js/tem-sim-uai-painel.js?v=1',
  './js/cursos-runtime-fix.js?v=2',
  './imagens/curadorias/agosto-lilas-banner.png',
  './manifest.webmanifest',
  './imagens/app-icons/icon-192.png?v=3', './imagens/app-icons/icon-512.png?v=3',
  './imagens/app-icons/apple-touch-icon.png?v=3'
];

const DATA_PATHS = [
  '/eventos.json',
  '/relacoes-eventos.json',
  '/livros.json',
  '/catalogo-curadoria-livros.json',
  '/capas-curadoria-livros.json',
  '/cursos.json',
  '/concursos.json',
  '/filmes.json',
  '/plataformas-audiovisuais.json',
  '/utilidade-publica.json',
  '/espacos_culturais.json',
  '/coordenadas-espacos.json',
  '/coordenadas-conteudos.json',
  '/atividades-lazer.json',
  '/curadorias/index.json',
  '/configuracao-mural.json'
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

async function networkFirstMutableImage(request) {
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



const NOTIFICATION_DB_NAME = 'mural-cultural-notificacoes-v1';
const NOTIFICATION_DB_VERSION = 1;
const NOTIFICATION_STORE_NAME = 'state';
const NOTIFICATION_PREFS_KEY = 'preferences';

function notificationApiOrigin() {
  try {
    const scope = new URL(self.registration.scope);
    return scope.hostname === 'tiago-ps.github.io' ? 'https://temsimuai.com.br' : scope.origin;
  } catch {
    return '';
  }
}

function notificationApiUrl(path) {
  return `${notificationApiOrigin()}${path}`;
}

function openNotificationDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(NOTIFICATION_DB_NAME, NOTIFICATION_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(NOTIFICATION_STORE_NAME)) {
        db.createObjectStore(NOTIFICATION_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('indexeddb_erro'));
  });
}

async function notificationState(key, fallback = null) {
  try {
    const db = await openNotificationDb();
    return await new Promise(resolve => {
      const tx = db.transaction(NOTIFICATION_STORE_NAME, 'readonly');
      const request = tx.objectStore(NOTIFICATION_STORE_NAME).get(key);
      request.onsuccess = () => resolve(request.result ?? fallback);
      request.onerror = () => resolve(fallback);
      tx.oncomplete = () => db.close();
    });
  } catch {
    return fallback;
  }
}

async function writeNotificationState(key, value) {
  try {
    const db = await openNotificationDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(NOTIFICATION_STORE_NAME, 'readwrite');
      tx.objectStore(NOTIFICATION_STORE_NAME).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('indexeddb_erro'));
    });
    db.close();
  } catch {
    // O lembrete continua funcionando mesmo se o navegador bloquear armazenamento.
  }
}

function swLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function swShiftDateKey(value, days) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return '';
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  date.setDate(date.getDate() + Number(days || 0));
  return swLocalDateKey(date);
}

async function swEventCatalog() {
  const url = new URL('./eventos.json', self.registration.scope);
  try {
    const response = await fetch(url, {
      headers: { accept: 'application/json' },
      cache: 'no-store'
    });
    if (!response.ok) throw new Error('catalogo_indisponivel');
    const payload = await response.json();
    return Array.isArray(payload) ? payload : (Array.isArray(payload?.eventos) ? payload.eventos : []);
  } catch {
    try {
      const cached = await caches.match(url);
      if (!cached) return [];
      const payload = await cached.json();
      return Array.isArray(payload) ? payload : (Array.isArray(payload?.eventos) ? payload.eventos : []);
    } catch {
      return [];
    }
  }
}

async function swEventRelationIndex() {
  const empty = () => Object.create(null);
  if (!SW_EVENT_RELATIONS?.buildIndex) return empty();

  const url = new URL('./relacoes-eventos.json', self.registration.scope);
  try {
    const response = await fetch(url, {
      headers: { accept: 'application/json' },
      cache: 'no-store'
    });
    if (!response.ok) throw new Error('relacoes_indisponiveis');
    return SW_EVENT_RELATIONS.buildIndex(await response.json());
  } catch {
    try {
      const cached = await caches.match(url);
      if (!cached) return empty();
      return SW_EVENT_RELATIONS.buildIndex(await cached.json());
    } catch {
      return empty();
    }
  }
}

function swEventPlace(event, relationIndex) {
  return SW_EVENT_RELATIONS?.placeLabel?.(event, relationIndex) ||
    String(event?.local || '').trim() ||
    String(event?.unidade || '').trim();
}

function swEventReminderBaseDate(event) {
  return SW_EVENT_TEMPORAL?.reminderBaseDate?.(event) ||
    String(event?.data || event?.data_inicio || '').slice(0, 10);
}

function swFavoriteEventsForReminder(events, favorites, reminderDate) {
  const favoriteSet = new Set(Array.isArray(favorites) ? favorites : []);
  return (Array.isArray(events) ? events : []).filter(event => {
    const id = `evento:${String(event?.id || '').trim()}`;
    if (!favoriteSet.has(id)) return false;
    const baseDate = swEventReminderBaseDate(event);
    return Boolean(baseDate && swShiftDateKey(baseDate, -1) === reminderDate);
  });
}

function swNextReminderDate(events, favorites, afterDate) {
  const favoriteSet = new Set(Array.isArray(favorites) ? favorites : []);
  const dates = (Array.isArray(events) ? events : [])
    .filter(event => favoriteSet.has(`evento:${String(event?.id || '').trim()}`))
    .map(event => swEventReminderBaseDate(event))
    .filter(Boolean)
    .map(date => swShiftDateKey(date, -1))
    .filter(date => date && date > afterDate)
    .sort();
  return dates[0] || '';
}

async function swUpdateServerSchedule(nextReminder) {
  try {
    const subscription = await self.registration.pushManager.getSubscription();
    if (!subscription?.endpoint) return;
    await fetch(notificationApiUrl('/api/notificacoes'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        proximo_aviso: nextReminder || null
      }),
      cache: 'no-store'
    });
  } catch {
    // A próxima interação com o site também recalcula o agendamento.
  }
}

function eventReminderUrl(event) {
  const url = new URL('./', self.registration.scope);
  url.searchParams.set('modo', 'agenda');
  if (event?.id) url.searchParams.set('item', `evento:${event.id}`);
  return url.href;
}

async function handleMuralPush() {
  const prefs = await notificationState(NOTIFICATION_PREFS_KEY, {});

  // Todo push recebido resulta em notificação visível. Normalmente o servidor
  // só envia quando existe uma data agendada; o fallback cobre mudanças locais
  // ou de catálogo ocorridas depois do agendamento.
  const today = swLocalDateKey();
  const [events, relationIndex] = await Promise.all([
    swEventCatalog(),
    swEventRelationIndex()
  ]);
  const favorites = Array.isArray(prefs.favorites) ? prefs.favorites : [];
  const due = swFavoriteEventsForReminder(events, favorites, today);
  const nextReminder = swNextReminderDate(events, favorites, today);

  let title = 'Tem Sim, Uai';
  let body = 'Confira seus eventos favoritados no Mural.';
  let url = new URL('./?modo=agenda', self.registration.scope).href;

  if (due.length === 1) {
    const event = due[0];
    title = `Amanhã: ${String(event.titulo || 'evento favoritado')}`;
    body = [event.horario, swEventPlace(event, relationIndex), event.cidade]
      .filter(Boolean).join(' • ') || 'Veja os detalhes no Mural.';
    url = eventReminderUrl(event);
  } else if (due.length > 1) {
    title = `${due.length} eventos favoritados amanhã`;
    const names = due.slice(0, 2).map(event => String(event.titulo || '').trim()).filter(Boolean);
    body = names.join(' • ');
    if (due.length > 2) body += ` • +${due.length - 2}`;
  }

  await self.registration.showNotification(title, {
    body,
    icon: new URL('./imagens/app-icons/icon-192.png?v=3', self.registration.scope).href,
    badge: new URL('./imagens/app-icons/favicon-32.png?v=3', self.registration.scope).href,
    tag: `mural-eventos-${today}`,
    renotify: false,
    data: { url }
  });

  await swUpdateServerSchedule(nextReminder);
}

self.addEventListener('push', event => {
  event.waitUntil(handleMuralPush());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = String(event.notification?.data?.url || new URL('./?modo=agenda', self.registration.scope).href);
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const sameOrigin = windows.find(client => {
      try { return new URL(client.url).origin === new URL(targetUrl).origin; } catch { return false; }
    });
    if (sameOrigin) {
      try { await sameOrigin.navigate(targetUrl); } catch { /* navegação pode não ser suportada */ }
      return sameOrigin.focus();
    }
    return self.clients.openWindow(targetUrl);
  })());
});

self.addEventListener('pushsubscriptionchange', event => {
  event.waitUntil((async () => {
    try {
      const configResponse = await fetch(notificationApiUrl('/api/notificacoes/config'), {
        headers: { accept: 'application/json' },
        cache: 'no-store'
      });
      if (!configResponse.ok) return;
      const config = await configResponse.json();
      const key = String(config?.public_key || '');
      if (!key) return;

      const normalized = key.replaceAll('-', '+').replaceAll('_', '/');
      const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
      const raw = atob(padded);
      const applicationServerKey = Uint8Array.from(raw, char => char.charCodeAt(0));
      const subscription = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
      });

      const prefs = await notificationState(NOTIFICATION_PREFS_KEY, {});
      const events = await swEventCatalog();
      const today = swLocalDateKey();
      const nextReminder = swNextReminderDate(events, prefs.favorites || [], today);
      await fetch(notificationApiUrl('/api/notificacoes'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          proximo_aviso: nextReminder || null
        }),
        cache: 'no-store'
      });
    } catch {
      // O site tentará restabelecer a assinatura quando for aberto novamente.
    }
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, CORE_CACHE, './index.html', 'text/html'));
  } else if (
    DATA_PATHS.some(path => url.pathname.endsWith(path)) ||
    (url.pathname.includes('/curadorias/') && url.pathname.endsWith('.json'))
  ) {
    const scopePath = new URL(self.registration.scope).pathname;
    const normalizedScope = scopePath.endsWith('/') ? scopePath : `${scopePath}/`;
    const relativePath = url.pathname.startsWith(normalizedScope)
      ? url.pathname.slice(normalizedScope.length)
      : url.pathname.replace(/^\/+/, '');
    // Sempre consulta a rede sem reutilizar a resposta HTTP anterior. O Cache
    // Storage continua servindo como fallback somente quando a rede falha.
    const stableRequest = new Request(new URL(`./${relativePath}`, self.registration.scope), {
      mode: 'same-origin',
      credentials: 'same-origin',
      cache: 'no-store'
    });
    event.respondWith(networkFirst(stableRequest, DATA_CACHE, '', 'application/json'));
  } else if (
    url.pathname.endsWith(BRAND_LOGO_PATH) ||
    url.pathname.includes(CURATION_IMAGE_PREFIX) ||
    url.pathname.includes(PLATFORM_IMAGE_PREFIX)
  ) {
    // Imagens mutáveis podem ser substituídas no repositório mantendo o mesmo nome.
    // Busca sempre a versão atual da rede e usa a cópia local apenas se estiver offline.
    event.respondWith(networkFirstMutableImage(request));
  } else if (request.destination === 'image') {
    event.respondWith(cacheFirstImage(request));
  } else if (['style', 'script', 'manifest', 'font'].includes(request.destination)) {
    const coreRequest = ['style', 'script'].includes(request.destination)
      ? new Request(request, { cache: 'no-store' })
      : request;
    event.respondWith(networkFirst(coreRequest, CORE_CACHE));
  }
});
