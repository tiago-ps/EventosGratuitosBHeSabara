'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const context = vm.createContext({ window: {} });
const moduleSource = fs.readFileSync(
  path.join(root, 'js/conteudos/concursos.js'),
  'utf8'
);
vm.runInContext(moduleSource, context, {
  filename: 'js/conteudos/concursos.js'
});

const contests = context.window.MuralCultural.contents.contests;
const catalog = JSON.parse(
  fs.readFileSync(path.join(root, 'concursos.json'), 'utf8')
).concursos;

assert.equal(catalog.length, 27);
assert.equal(contests.filter(catalog).length, 27);
assert.equal(contests.filter(catalog, { query: 'Caraguatatuba' }).length, 1);
assert.equal(contests.filter(catalog, { formation: 'Técnico em Informática' }).length, 16);
assert.equal(contests.filter(catalog, { uf: 'MG' }).length, 16);
assert.equal(contests.filter(catalog, {
  formation: 'Técnico em Informática',
  uf: 'MG'
}).length, 9);
assert.equal(contests.filter(catalog, { deadline: 'com-data' }).length, 27);
assert.equal(contests.filter(catalog, { deadline: 'sem-data' }).length, 0);
assert.equal(contests.filter(catalog, { query: 'resultado impossível' }).length, 0);

assert.equal(contests.formationOptions(catalog).length, 5);
assert.equal(contests.ufOptions(catalog).length, 6);

const sourceRecord = catalog[0];
assert.ok(Object.hasOwn(sourceRecord, 'evidencias_formacao'));
const publicRecord = contests.publicRecord(sourceRecord);
assert.equal(Object.hasOwn(publicRecord, 'evidencias_formacao'), false);
assert.equal(publicRecord.titulo, sourceRecord.titulo);
assert.notEqual(publicRecord, sourceRecord);

assert.equal(contests.isValid({ titulo: 'Válido', url: 'https://example.org' }), true);
assert.equal(contests.isValid({ titulo: 'Sem URL' }), false);
assert.equal(contests.isValid({ url: 'https://example.org' }), false);

console.log('Testes de dados e filtros da Agenda de Concursos aprovados.');
