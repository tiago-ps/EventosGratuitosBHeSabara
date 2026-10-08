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

const workerContext = vm.createContext({});
vm.runInContext(
  fs.readFileSync(path.join(root, 'js/relacoes-eventos.js'), 'utf8'),
  workerContext,
  { filename: 'js/relacoes-eventos.js' }
);
assert.ok(workerContext.MuralCultural?.eventRelations?.buildIndex);

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
assert.ok(indexHtml.includes('js/relacoes-eventos.js?v=3'));
const appVersion = indexHtml.match(/js\/app\.js\?v=(\d+)/)?.[1];
assert.ok(appVersion, 'index sem versão de js/app.js');

const serviceWorker = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
assert.ok(serviceWorker.includes("'./js/relacoes-eventos.js?v=3'"));
assert.ok(serviceWorker.includes("'/relacoes-eventos.json'"));
assert.ok(serviceWorker.includes(`'./js/app.js?v=${appVersion}'`));
assert.match(serviceWorker, /const CACHE_VERSION = 'mural-cultural-v\d+-[^']+';/);
assert.ok(serviceWorker.includes("swEventRelationIndex"));
assert.ok(serviceWorker.includes("swEventPlace(event, relationIndex)"));

const manualUi = fs.readFileSync(path.join(root, 'js/eventos-manuais-ui.js'), 'utf8');
assert.ok(manualUi.includes("const RELATIONS_URL = 'relacoes-eventos.json';"));
assert.ok(manualUi.includes('eventRelations.buildIndex'));
assert.ok(manualUi.includes('[eventPlace(event), event?.cidade]'));

console.log('ATC4.6.3: consumo relacional da interface aprovado.');

// ATC4.6.5: fallback via catálogo, relações, equipamento-pai e texto do local.
const imageIndex = relations.buildSpaceImageIndex({ itens: [
  {id:'eq1',nome:'Centro Cultural de Testes',imagem:'fachada-eq.jpg'},
  {id:'s1',nome:'Auditório do Centro de Testes',equipamento_id:'eq1',imagem:''},
  {id:'outro',nome:'Outro Local Cultural',imagem:'outro.jpg'}
] });
assert.equal(relations.imageForEvent({id:'e1',local_id:'outro'}, index, imageIndex), 'fachada-eq.jpg');
assert.equal(relations.imageForEvent({local_id:'s1'}, {}, imageIndex), 'fachada-eq.jpg');
assert.equal(relations.imageForEvent({local:'Centro Cultural de Testes'}, {}, imageIndex), 'fachada-eq.jpg');
assert.equal(relations.imageForEvent({local:'Praça pública externa',instituicao_id:'i1'}, {}, imageIndex), '');
assert.equal(relations.imageForEvent({local_id:'inexistente'}, {}, imageIndex), '');

const spacesData = JSON.parse(fs.readFileSync(path.join(root,'espacos_culturais.json'),'utf8'));
const eventsData = JSON.parse(fs.readFileSync(path.join(root,'eventos.json'),'utf8'));
const relationData = JSON.parse(fs.readFileSync(path.join(root,'relacoes-eventos.json'),'utf8'));
const spaceIndex = relations.buildSpaceImageIndex(spacesData);
const relationIndex = relations.buildIndex(relationData);
const noImage = eventsData.eventos.filter(ev => !String(ev.imagem || '').trim());
const covered = noImage.filter(ev => relations.imageForEvent(ev, relationIndex, spaceIndex));
assert.ok(covered.length >= 50, 'Esperada cobertura de pelo menos 50 eventos sem imagem.');
for (const id of ['mhnjb-ufmg','conservatorio-ufmg','mm-gerdau','galpao-cine-horto']) {
  assert.ok(spaceIndex.byId[id]?.imagem, 'Equipamento sem fotografia: '+id);
}
assert.ok(app.includes('eventRelations?.imageForEvent?.('));
assert.ok(app.includes('state.spaceImageIndex = eventRelations?.buildSpaceImageIndex?.('));
assert.ok(!app.includes('exclusiveAgendaEventImage(event)'));
console.log('Fallback por Espaços: '+covered.length+'/'+noImage.length+' eventos sem imagem própria.');
