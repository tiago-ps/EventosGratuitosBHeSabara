'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const context = vm.createContext({ window: {} });
for (const file of ['js/core/rotacao.js', 'js/conteudos/concursos.js']) {
  const moduleSource = fs.readFileSync(path.join(root, file), 'utf8');
  vm.runInContext(moduleSource, context, { filename: file });
}

const contests = context.window.MuralCultural.contents.contests;
const catalog = JSON.parse(
  fs.readFileSync(path.join(root, 'concursos.json'), 'utf8')
).concursos;

assert.ok(catalog.length > 0);
assert.equal(contests.filter(catalog).length, catalog.filter(contests.isValid).length);
assert.ok(contests.filter(catalog, { query: 'Caraguatatuba' }).length >= 1);
const formationMatches = contests.filter(catalog, { formation: 'Técnico em Informática' });
const mgMatches = contests.filter(catalog, { uf: 'MG' });
assert.ok(formationMatches.length > 0);
assert.ok(mgMatches.length > 0);
const combinedMatches = contests.filter(catalog, {
  formation: 'Técnico em Informática',
  uf: 'MG'
});
assert.ok(combinedMatches.length > 0);
assert.ok(combinedMatches.length <= formationMatches.length);
assert.ok(combinedMatches.length <= mgMatches.length);
const withDeadline = contests.filter(catalog, { deadline: 'com-data' });
const withoutDeadline = contests.filter(catalog, { deadline: 'sem-data' });
assert.equal(withDeadline.length + withoutDeadline.length, contests.filter(catalog).length);
assert.equal(contests.filter(catalog, { query: 'resultado impossível' }).length, 0);

assert.ok(contests.formationOptions(catalog).length > 0);
assert.ok(contests.ufOptions(catalog).length > 0);

const panelSample = contests.sampleForPanel(catalog);
assert.equal(contests.PANEL_CONTEST_LIMIT, 15);
assert.equal(panelSample.length, 15);
assert.equal(new Set(panelSample.map(contest => contest.url)).size, 15);
assert.ok(panelSample.every(contest => catalog.some(source => source.url === contest.url)));
assert.ok(panelSample.every(contest => !Object.hasOwn(contest, 'evidencias_formacao')));

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
