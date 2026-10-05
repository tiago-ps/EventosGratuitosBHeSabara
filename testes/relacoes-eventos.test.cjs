'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const context = vm.createContext({ window: {} });
vm.runInContext(
  fs.readFileSync(path.join(root, 'js/relacoes-eventos.js'), 'utf8'),
  context,
  { filename: 'js/relacoes-eventos.js' }
);

const relations = context.window.MuralCultural.eventRelations;
const index = relations.buildIndex({
  versao: 1,
  relacoes: [
    {
      evento_id: 'e1',
      tipo: 'acontece_em',
      destino: { tipo: 'equipamento_cultural', id: 'eq1', nome: 'Equipamento 1' }
    },
    {
      evento_id: 'e1',
      tipo: 'acontece_em',
      destino: { tipo: 'espaco_interno', id: 's1', nome: 'Sala 1' },
      equipamento: { id: 'eq1', nome: 'Equipamento 1' }
    },
    {
      evento_id: 'e1',
      tipo: 'organizado_por',
      destino: { tipo: 'instituicao', id: 'i1', nome: 'Instituição 1' }
    },
    {
      evento_id: 'antigo',
      tipo: 'organizado_por',
      destino: { tipo: 'instituicao', id: 'i2', nome: 'Instituição antiga' }
    }
  ]
});

assert.equal(
  relations.placeLabel({ id: 'e1' }, index),
  'Equipamento 1 — Sala 1'
);
assert.deepEqual(
  Array.from(relations.placeParts({ id: 'e1' }, index)),
  ['Equipamento 1', 'Sala 1']
);
assert.equal(relations.institutionName({ id: 'e1' }, index), 'Instituição 1');
assert.equal(relations.placeLabel({ id: 'sem-relacao' }, index), '');
assert.equal(relations.institutionName({ id: 'sem-relacao' }, index), '');

const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
assert.ok(app.includes("const RELATIONS_URL = 'relacoes-eventos.json';"));
assert.ok(app.includes('loadOptionalJson(RELATIONS_URL, { relacoes: [] })'));
assert.ok(app.includes('eventRelations?.buildIndex?.(state.relationsData)'));
assert.ok(app.includes('[eventPlace(event), event.cidade]'));
assert.ok(app.includes('eventInstitutionName(event)'));

const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert.ok(indexHtml.includes('js/relacoes-eventos.js?v=1'));
assert.ok(indexHtml.includes('js/app.js?v=145'));

const serviceWorker = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
assert.ok(serviceWorker.includes("'./js/relacoes-eventos.js?v=1'"));
assert.ok(serviceWorker.includes("'/relacoes-eventos.json'"));
assert.ok(serviceWorker.includes("'./js/app.js?v=145'"));
assert.ok(serviceWorker.includes("mural-cultural-v192-opinioes-livros-opcionais"));

console.log('ATC4.6.3: consumo relacional da interface aprovado.');
