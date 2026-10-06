'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const context = vm.createContext({ Intl, Date, window: {} });
for (const file of ['js/core/rotacao.js', 'js/conteudos/concursos.js']) {
  const moduleSource = fs.readFileSync(path.join(root, file), 'utf8');
  vm.runInContext(moduleSource, context, { filename: file });
}

const contests = context.window.MuralCultural.contents.contests;
const normalizeText = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();
const catalog = JSON.parse(
  fs.readFileSync(path.join(root, 'concursos.json'), 'utf8')
).concursos;

assert.ok(catalog.length > 0);
assert.equal(contests.filter(catalog).length, catalog.filter(contest => contests.isValid(contest) && contests.isTemporallyVisible(contest)).length);

const searchable = catalog.find(contest => contest.titulo);
assert.ok(searchable);
const queryMatches = contests.filter(catalog, { query: searchable.titulo });
assert.ok(queryMatches.some(contest => contest.url === searchable.url));

const formationOptions = contests.formationOptions(catalog);
const ufOptions = contests.ufOptions(catalog);
assert.ok(formationOptions.length > 0);
assert.ok(ufOptions.length > 0);

const [formation] = formationOptions[0];
const formationMatches = contests.filter(catalog, { formation });
assert.ok(formationMatches.length > 0);
assert.ok(formationMatches.every(contest =>
  (contest.formacoes_compativeis || []).includes(formation)
));

const [uf] = ufOptions[0];
const ufMatches = contests.filter(catalog, { uf });
assert.ok(ufMatches.length > 0);
assert.ok(ufMatches.every(contest => contest.uf === uf));

const withDeadline = contests.filter(catalog, { deadline: 'com-data' });
const withoutDeadline = contests.filter(catalog, { deadline: 'sem-data' });
assert.equal(withDeadline.length + withoutDeadline.length, contests.filter(catalog).length);
assert.equal(contests.filter(catalog, { query: 'resultado impossível 9xq7' }).length, 0);

const cityOptions = contests.cityOptions(catalog);
assert.ok(cityOptions.length > 0);
const [cityValue] = cityOptions[0];
const cityMatches = contests.filter(catalog, { city: cityValue });
assert.ok(cityMatches.length > 0);
assert.ok(cityMatches.every(contest => normalizeText(contest.cidade) === cityValue));

const highRemuneration = contests.filter(catalog, { remuneration: 'mais-10000' });
assert.ok(highRemuneration.length > 0);
assert.ok(highRemuneration.every(contest => contests.remunerationMax(contest) > 10000));
assert.equal(
  contests.remunerationMatches({ remuneracao_faixa_texto: 'R$ 2.000,00 a R$ 4.500,00' }, '3000-5000'),
  true
);

const panelSample = contests.sampleForPanel(catalog);
assert.equal(contests.PANEL_CONTEST_LIMIT, 15);
assert.equal(panelSample.length, Math.min(15, contests.filter(catalog).length));
assert.equal(new Set(panelSample.map(contest => contest.url)).size, panelSample.length);
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
