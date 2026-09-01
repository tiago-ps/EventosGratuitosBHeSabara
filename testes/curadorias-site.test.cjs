'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const payload = JSON.parse(fs.readFileSync(path.join(root, 'curadorias-site.json'), 'utf8'));
const eventsData = JSON.parse(fs.readFileSync(path.join(root, 'eventos.json'), 'utf8'));
const booksData = JSON.parse(fs.readFileSync(path.join(root, 'livros.json'), 'utf8'));
const coursesData = JSON.parse(fs.readFileSync(path.join(root, 'cursos.json'), 'utf8'));
const filmsData = JSON.parse(fs.readFileSync(path.join(root, 'filmes.json'), 'utf8'));
const source = fs.readFileSync(path.join(root, 'js/curadorias-site.js'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
const context = vm.createContext({ window: {}, URL, console });
vm.runInContext(source, context, { filename: 'js/curadorias-site.js' });
const curations = context.window.MuralCultural.siteCurations;

const catalogs = {
  eventos: eventsData.eventos,
  livros: booksData.livros,
  cursos: coursesData.cursos,
  filmes: filmsData.filmes
};
const snapshot = JSON.stringify(catalogs);
const warnings = [];
const merged = curations.apply(payload, catalogs, {
  today: new Date(2026, 8, 15),
  warn: message => warnings.push(message)
});

assert.equal(curations.isValidPayload(payload), true);
assert.equal(curations.isValidPayload(null), false);
assert.equal(curations.isValidPayload({ schema: 1, escopo: 'site-only' }), false);
assert.equal(JSON.stringify(catalogs), snapshot, 'A fusão não pode mutar os catálogos centrais');
assert.deepEqual(Array.from(merged.curadoriasAtivas), ['setembro-amarelo-2026']);

const event = merged.eventos.find(item => item.id === 'sympla-sabara-3534680');
assert.ok(event);
assert.deepEqual(
  Array.from(event.temas),
  ['Setembro Amarelo', 'Saúde mental', 'Prevenção do suicídio']
);
assert.equal(eventsData.eventos.find(item => item.id === event.id).temas, undefined);

const expectedCourses = new Map([
  ['1089', 'Saúde mental, atenção psicossocial e interculturalidade nas migrações'],
  ['881', 'Direitos Humanos e saúde mental - Curso permanente Damião Ximenes Lopes'],
  ['1207', 'Mídias Digitais e Saúde Mental de Crianças e Adolescentes'],
  ['817', 'Propósito e Qualidade de vida: Descobertas para o Desenvolvimento Pessoal']
]);
for (const [id, title] of expectedCourses) {
  const course = merged.cursos.find(item => item.id_fonte === id);
  assert.equal(course?.titulo, title);
  assert.ok(course.temas.includes('Setembro Amarelo'));
  assert.equal(coursesData.cursos.find(item => item.id_fonte === id).temas, undefined);
}

assert.deepEqual(
  Array.from(curations.mergeLabels(['Cultura', 'Saúde Mental'], [' setembro amarelo ', 'saude mental', 'CULTURA'])),
  ['Cultura', 'Saúde Mental', 'setembro amarelo']
);

const externalCourses = merged.cursos.filter(item => item.site_only);
assert.equal(externalCourses.length, 3);
assert.ok(externalCourses.every(item => item.origem === 'site-only' && item.id.startsWith('site:unasus:')));
assert.ok(externalCourses.every(item => !item.id_fonte));
assert.equal(new Set(externalCourses.map(item => item.id)).size, 3);
assert.equal(externalCourses.filter(item => item.temas.some(theme => curations.normalizeLabel(theme) === 'setembro amarelo')).length, 3);

const externalFilms = merged.filmes.filter(item => item.site_only);
assert.equal(externalFilms.length, 3);
assert.ok(externalFilms.every(item => item.origem === 'site-only' && !item.pagina_oficial));
assert.ok(externalFilms.every(item => item.imagem && fs.existsSync(path.join(root, item.imagem))));
for (const id of externalFilms.map(item => item.fonte_id)) {
  assert.equal(filmsData.filmes.some(item => item.fonte_id === id), false);
}

assert.ok(merged.apoio);
assert.equal(merged.apoio.site_only, true);
assert.equal(merged.apoio.secoes.length, 3);
assert.match(JSON.stringify(merged.apoio), /CVV/);
assert.match(JSON.stringify(merged.apoio), /188/);
assert.match(JSON.stringify(merged.apoio), /SAMU/);
assert.match(JSON.stringify(merged.apoio), /192/);
assert.match(JSON.stringify(merged.apoio), /CERSAM/);
assert.match(JSON.stringify(merged.apoio), /CEAP/);
assert.match(JSON.stringify(merged.apoio), /PUC Minas/);
assert.match(JSON.stringify(merged.apoio), /FUMEC/);
assert.equal(merged.eventos.some(item => item.nome === 'CVV — Centro de Valorização da Vida'), false);

const absent = curations.apply(null, catalogs, { today: new Date(2026, 8, 15) });
assert.equal(absent.cursos.length, catalogs.cursos.length);
assert.equal(absent.apoio, null);
const invalid = curations.apply({ schema: 999, escopo: 'site-only', curadorias: [] }, catalogs);
assert.equal(invalid.eventos.length, catalogs.eventos.length);

const outside = curations.apply(payload, catalogs, { today: new Date(2026, 9, 1) });
assert.equal(outside.curadoriasAtivas.length, 0);
assert.equal(outside.cursos.length, catalogs.cursos.length);
assert.equal(outside.filmes.length, catalogs.filmes.length);
assert.equal(outside.apoio, null);
assert.equal(outside.eventos.find(item => item.id === event.id).temas, undefined);

const missingTargetPayload = JSON.parse(JSON.stringify(payload));
missingTargetPayload.curadorias[0].overlays.eventos['nao-existe'] = { temas: ['Setembro Amarelo'] };
const missingWarnings = [];
const missingTarget = curations.apply(missingTargetPayload, catalogs, {
  today: new Date(2026, 8, 15),
  warn: message => missingWarnings.push(message)
});
assert.equal(missingTarget.eventos.length, catalogs.eventos.length);
assert.ok(missingWarnings.some(message => message.includes('não encontrado')));

assert.match(appSource, /loadOptionalJson\(SITE_CURATIONS_URL, null\)/);
assert.match(appSource, /siteCurationsContent\.apply\(siteCurationsData/);
assert.match(appSource, /siteCurationsContent\.mountSupportArea\(siteLayer\.apoio\)/);
assert.doesNotMatch(appSource, /(?:write|post|put).*curadorias-site\.json/i);

console.log('Testes da camada site-only Setembro Amarelo aprovados (overlays, complementos, janela temporal e isolamento).');
