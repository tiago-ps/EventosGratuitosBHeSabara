'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const readJson = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const index = readJson('curadorias/index.json');
const expectedIds = ["setembro-amarelo-2026", "vestibular-ufmg-seriado-2026", "vestibular-fuvest-2027"];

assert.equal(index.schema, 1);
assert.equal(index.escopo, 'site-only');
assert.deepEqual(index.curadorias.map(item => item.id), expectedIds);
assert.equal(new Set(index.curadorias.map(item => item.id)).size, index.curadorias.length);
for (const entry of index.curadorias) {
  assert.equal(entry.arquivo, `curadorias/${entry.id}.json`);
  const curation = readJson(entry.arquivo);
  assert.equal(curation.id, entry.id);
  assert.equal(curation.nome || curation.titulo_editorial, entry.nome);
  assert.equal(curation.ativo_de, entry.ativo_de);
  assert.equal(curation.ativo_ate, entry.ativo_ate);
}
assert.equal(fs.existsSync(path.join(root, 'curadorias-site.json')), false, 'Arquivo monolítico legado deve ter sido removido');

const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
assert.match(app, /SITE_CURATIONS_INDEX_URL = 'curadorias\/index\.json'/);
assert.match(app, /async function loadSiteCurations\(\)/);
assert.match(app, /loadSiteCurations\(\)/);
assert.doesNotMatch(app, /curadorias-site\.json/);
assert.ok(sw.includes("'/curadorias/index.json'"));
assert.match(sw, /url\.pathname\.includes\('\/curadorias\/'\)/);
assert.doesNotMatch(sw, /curadorias-site\.json/);

console.log('Arquitetura de uma curadoria por JSON validada.');
