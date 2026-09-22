'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const context = vm.createContext({ window: {} });
const source = fs.readFileSync(path.join(root, 'js/relacoes-eventos.js'), 'utf8');
vm.runInContext(source, context, { filename: 'js/relacoes-eventos.js' });

const relations = context.window.MuralCultural.eventRelations;
assert.ok(relations);

const index = relations.buildIndex({
  versao: 1,
  relacoes: [
    {
      evento_id: 'e1',
      tipo: 'organizado_por',
      destino: { tipo: 'instituicao', id: 'i1', nome: 'Instituição Canônica' }
    },
    {
      evento_id: 'e1',
      tipo: 'acontece_em',
      destino: { tipo: 'equipamento_cultural', id: 'eq1', nome: 'Equipamento' }
    },
    {
      evento_id: 'e1',
      tipo: 'acontece_em',
      destino: { tipo: 'espaco_interno', id: 's1', nome: 'Sala 1' },
      equipamento: { id: 'eq1', nome: 'Equipamento' }
    },
    { evento_id: '', tipo: 'organizado_por', destino: { tipo: 'instituicao', id: 'x', nome: 'Inválida' } }
  ]
});

assert.equal(relations.organizerName(index, { id: 'e1' }), 'Instituição Canônica');
assert.equal(relations.organizerName(index, { id: 'e2' }), '');
assert.deepEqual(
  JSON.parse(JSON.stringify(relations.location(index, { id: 'e1' }))),
  {
    tipo: 'espaco_interno',
    id: 's1',
    nome: 'Sala 1',
    equipamento: { id: 'eq1', nome: 'Equipamento' }
  }
);
assert.equal(relations.forEvent(index, { id: 'e1' }).length, 3);
assert.equal(relations.buildIndex({ versao: 2, relacoes: [] }).size, 0);

const appSource = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
assert.match(appSource, /EVENT_RELATIONS_URL = 'relacoes-eventos\.json'/);
assert.match(appSource, /eventRelationsContent\.organizerName\(\s*state\.eventRelationsByEvent,\s*event\s*\)/);
const organizerPosition = appSource.indexOf('eventRelationsContent.organizerName');
const legacyPosition = appSource.indexOf("event?.instituicao_id");
assert.ok(organizerPosition > 0 && legacyPosition > organizerPosition, 'relação deve preceder instituicao_id');

console.log('Testes do consumo público de relações dos Eventos aprovados.');
