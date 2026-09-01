'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const handlers = {};
const stores = new Map();
let installedAssets = [];
let fetchImplementation = async () => { throw new Error('offline'); };

const keyFor = request => String(request?.url || request);
const cacheFor = name => {
  if (!stores.has(name)) stores.set(name, new Map());
  const store = stores.get(name);
  return {
    async addAll(assets) { installedAssets = [...assets]; },
    async put(request, response) { store.set(keyFor(request), response); },
    async match(request) { return store.get(keyFor(request)); },
    async keys() { return [...store.keys()].map(url => new Request(url)); },
    async delete(request) { return store.delete(keyFor(request)); }
  };
};

class CacheableResponse {
  constructor(body, contentType = 'application/json') {
    this.body = body;
    this.ok = true;
    this.type = 'basic';
    this.headers = { get: name => name.toLowerCase() === 'content-type' ? contentType : '' };
  }

  clone() {
    return new CacheableResponse(this.body, this.headers.get('content-type'));
  }
}

const context = vm.createContext({
  URL,
  Request,
  Response,
  fetch: request => fetchImplementation(request),
  caches: {
    open: async name => cacheFor(name),
    keys: async () => [...stores.keys()],
    delete: async name => stores.delete(name),
    match: async request => {
      for (const store of stores.values()) {
        const value = store.get(keyFor(request));
        if (value) return value;
      }
      return undefined;
    }
  },
  self: {
    location: { origin: 'http://localhost:8765' },
    registration: { scope: 'http://localhost:8765/' },
    clients: { claim: async () => {} },
    skipWaiting: async () => {},
    addEventListener(type, handler) { handlers[type] = handler; }
  }
});

const source = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
vm.runInContext(`${source}\n;globalThis.__sw = {
  CACHE_VERSION, CORE_CACHE, DATA_CACHE, CORE_ASSETS, DATA_PATHS
};`, context, { filename: 'service-worker.js' });

const sw = context.__sw;

async function dispatch(type, event) {
  let pending;
  handlers[type]({
    ...event,
    waitUntil(promise) { pending = promise; },
    respondWith(promise) { pending = promise; }
  });
  return pending ? await pending : undefined;
}

(async () => {
  assert.equal(sw.CACHE_VERSION, 'mural-cultural-v93-banner-png-valido');
  for (const asset of [
    './css/styles.css?v=69',
    './css/eventos-manuais-ui.css?v=43',
    './css/concursos-mural.css?v=2',
    './js/core/rotacao.js?v=1',
    './css/temas-visuais.css?v=5',
    './js/tema-visual-boot.js?v=2',
    './js/conteudos/cursos.js?v=3',
    './js/conteudos/concursos.js?v=2',
    './js/conteudos/filmes.js?v=6',
    './js/curadorias-site.js?v=1',
    './js/app.js?v=88',
    './js/temas-visuais.js?v=6',
    './js/eventos-manuais-ui.js?v=44'
  ]) {
    assert.ok(sw.CORE_ASSETS.includes(asset), `Precache ausente: ${asset}`);
  }
  assert.ok(sw.DATA_PATHS.includes('/cursos.json'));
  assert.ok(sw.DATA_PATHS.includes('/concursos.json'));
  assert.ok(sw.DATA_PATHS.includes('/filmes.json'));
  assert.ok(sw.DATA_PATHS.includes('/curadorias-site.json'));
  assert.equal(sw.CORE_ASSETS.some(asset => /(?:cursos|concursos|filmes|curadorias-site)\.json/.test(asset)), false);
  assert.ok(sw.CORE_ASSETS.includes('./imagens/curadorias/setembro-amarelo-banner.png'));

  await dispatch('install', {});
  assert.deepEqual(installedAssets, Array.from(sw.CORE_ASSETS));

  fetchImplementation = async request => new CacheableResponse(`rede:${request.url}`);
  const online = await dispatch('fetch', {
    request: new Request('http://localhost:8765/concursos.json?v=123')
  });
  assert.equal(online.ok, true);
  const stableUrl = 'http://localhost:8765/concursos.json';
  assert.ok(stores.get(sw.DATA_CACHE).has(stableUrl));

  fetchImplementation = async () => { throw new Error('offline'); };
  const cached = await dispatch('fetch', {
    request: new Request('http://localhost:8765/concursos.json?v=456')
  });
  assert.equal(cached.body, `rede:${stableUrl}`);

  const uncachedOptional = await dispatch('fetch', {
    request: new Request('http://localhost:8765/cursos.json?v=789')
  });
  assert.equal(uncachedOptional.type, 'error');

  const appSource = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  assert.match(appSource, /loadOptionalJson\(COURSES_URL, \{ cursos: \[\] \}\)/);
  assert.match(appSource, /loadOptionalJson\(CONTESTS_URL, \{ concursos: \[\] \}\)/);
  assert.match(appSource, /loadOptionalJson\(FILMS_URL, \{ filmes: \[\] \}\)/);
  assert.match(appSource, /loadOptionalJson\(SITE_CURATIONS_URL, null\)/);

  console.log('Testes de cache e dados opcionais do service worker aprovados.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
