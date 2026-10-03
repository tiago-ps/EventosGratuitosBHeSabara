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
  CACHE_VERSION, CORE_CACHE, DATA_CACHE, IMAGE_CACHE, CORE_ASSETS, DATA_PATHS,
  CURATION_IMAGE_PREFIX
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
  assert.match(sw.CACHE_VERSION, /^mural-cultural-v\d+-/);
  assert.equal(sw.CURATION_IMAGE_PREFIX, '/imagens/curadorias/');
  const corePaths = new Set(sw.CORE_ASSETS.map(asset => String(asset).split('?')[0]));
  for (const asset of [
    './css/styles.css',
    './css/eventos-manuais-ui.css',
    './css/concursos-mural.css',
    './css/temas-visuais.css',
    './css/utilidade-publica.css',
    './css/atividades-lazer.css',
    './js/tema-visual-boot.js',
    './js/core/rotacao.js',
    './js/conteudos/cursos.js',
    './js/conteudos/concursos.js',
    './js/conteudos/filmes.js',
    './js/conteudos/utilidade-publica.js',
    './js/conteudos/atividades-lazer.js',
    './js/curadorias-site.js',
    './js/app.js',
    './js/temas-visuais.js',
    './js/eventos-manuais-ui.js'
  ]) {
    assert.ok(corePaths.has(asset), `Precache ausente: ${asset}`);
  }
  for (const dataPath of [
    '/cursos.json',
    '/concursos.json',
    '/filmes.json',
    '/utilidade-publica.json',
    '/atividades-lazer.json',
    '/curadorias/index.json'
  ]) {
    assert.ok(sw.DATA_PATHS.includes(dataPath), `Dado opcional ausente: ${dataPath}`);
  }
  assert.equal(
    sw.CORE_ASSETS.some(asset => /(?:cursos|concursos|filmes|utilidade-publica|atividades-lazer|curadorias)\.json/.test(asset)),
    false
  );
  assert.equal(sw.CORE_ASSETS.includes('./imagens/curadorias/setembro-amarelo-2026/setembro-amarelo-banner.png'), false);
  assert.equal(sw.CORE_ASSETS.some(asset => String(asset).includes('/imagens/plataformas/')), false);

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

  fetchImplementation = async request => new CacheableResponse(`curadoria:${request.url}`);
  const curationOnline = await dispatch('fetch', {
    request: new Request('http://localhost:8765/curadorias/vestibular-fuvest-2027.json?v=1')
  });
  assert.equal(curationOnline.ok, true);
  const stableCurationUrl = 'http://localhost:8765/curadorias/vestibular-fuvest-2027.json';
  assert.ok(stores.get(sw.DATA_CACHE).has(stableCurationUrl));

  fetchImplementation = async () => { throw new Error('offline'); };
  const curationOffline = await dispatch('fetch', {
    request: new Request('http://localhost:8765/curadorias/vestibular-fuvest-2027.json?v=2')
  });
  assert.equal(curationOffline.body, `curadoria:${stableCurationUrl}`);

  // Imagens da curadoria de vestibular são mutáveis: sempre tentam a rede primeiro.
  const imageUrl = 'http://localhost:8765/imagens/curadorias/vestibular-ufmg-seriado-2026/o-quinze.png';
  const imageRequest = new Request(imageUrl);
  await cacheFor(sw.IMAGE_CACHE).put(imageRequest, new CacheableResponse('imagem-antiga', 'image/png'));

  fetchImplementation = async request => new CacheableResponse(`imagem-nova:${request.url}`, 'image/png');
  const freshImage = await dispatch('fetch', { request: imageRequest });
  assert.equal(freshImage.body, `imagem-nova:${imageUrl}`);
  assert.equal(stores.get(sw.IMAGE_CACHE).get(imageUrl).body, `imagem-nova:${imageUrl}`);

  fetchImplementation = async () => { throw new Error('offline'); };
  const offlineImage = await dispatch('fetch', { request: imageRequest });
  assert.equal(offlineImage.body, `imagem-nova:${imageUrl}`);

  const appSource = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  assert.match(appSource, /loadOptionalJson\(COURSES_URL, \{ cursos: \[\] \}\)/);
  assert.match(appSource, /loadOptionalJson\(CONTESTS_URL, \{ concursos: \[\] \}\)/);
  assert.match(appSource, /loadOptionalJson\(FILMS_URL, \{ filmes: \[\] \}\)/);
  assert.match(appSource, /loadSiteCurations\(\)/);
  assert.match(appSource, /SITE_CURATIONS_INDEX_URL = 'curadorias\/index\.json'/);

  console.log('Testes de cache e dados opcionais do service worker aprovados.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
