'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
const data = JSON.parse(fs.readFileSync(path.join(root, 'cursos.json'), 'utf8'));
const context = vm.createContext({
  window: {
    MuralCultural: {
      core: {
        sampleForPanel(items, limit) {
          return items.slice(0, limit);
        }
      }
    }
  }
});

vm.runInContext(
  fs.readFileSync(path.join(root, 'js/conteudos/cursos.js'), 'utf8'),
  context,
  { filename: 'js/conteudos/cursos.js' }
);

const courses = context.window.MuralCultural.contents.courses;
const catalog = courses.filter(data.cursos);
const normalizeText = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();
const search = query => catalog.filter(course =>
  courses.agendaQueryMatches(course, normalizeText(query), normalizeText)
);

assert.ok(data.cursos.length > 0);
assert.equal(data.total, data.cursos.length);
assert.equal(catalog.length, data.cursos.length);
assert.equal(new Set(catalog.map(course => course.id_fonte)).size, catalog.length);
assert.equal(new Set(catalog.map(course => course.url)).size, catalog.length);

const searchableCourse = catalog.find(course => course.titulo && course.instituicao);
assert.ok(searchableCourse);
assert.ok(search(searchableCourse.titulo).includes(searchableCourse));
assert.ok(search(searchableCourse.instituicao).includes(searchableCourse));
assert.equal(search('termo-inexistente-9xq7').length, 0);
assert.equal(search('').length, catalog.length);

const searchableFields = {
  titulo: 'Título único',
  instituicao: 'Instituição única',
  instituicao_parceira: 'Parceira única',
  area: 'Área única',
  competencias: 'Competência única',
  descricao: 'Descrição única',
  publico_alvo: 'Público único',
  tipo: 'Curso aberto',
  nivel: 'Básico',
  idioma: 'Português',
  carga_horaria: '20 horas',
  conteudo_programatico: 'Conteúdo longo fora da busca'
};
for (const field of [
  'titulo', 'instituicao', 'instituicao_parceira', 'area',
  'competencias', 'descricao', 'publico_alvo', 'tipo', 'nivel',
  'idioma', 'carga_horaria'
]) {
  assert.equal(
    courses.agendaQueryMatches(searchableFields, normalizeText(searchableFields[field]), normalizeText),
    true,
    `Campo pesquisável ausente: ${field}`
  );
}
assert.equal(
  courses.agendaQueryMatches(
    searchableFields,
    normalizeText(searchableFields.conteudo_programatico),
    normalizeText
  ),
  false
);

const institutionOptions = courses.scalarOptions(data.cursos, 'instituicao');
assert.ok(institutionOptions.length > 1);
const [institution] = institutionOptions[0];
const institutionFiltered = courses.filter(data.cursos, { institution });
assert.ok(institutionFiltered.length > 0);
assert.ok(institutionFiltered.every(course => normalizeText(course.instituicao) === institution));

const areaOptions = courses.scalarOptions(data.cursos, 'area');
assert.ok(areaOptions.length > 10);
const [area] = areaOptions[0];
assert.ok(courses.filter(data.cursos, { area }).length > 0);

const shortCourses = courses.filter(data.cursos, { workload: 'ate-10' });
assert.ok(shortCourses.length > 0);
assert.ok(shortCourses.every(course => courses.workloadHours(course.carga_horaria) <= 10));

const certified = courses.filter(data.cursos, { certificate: 'yes' });
assert.ok(certified.length > 0);
assert.ok(certified.every(course => course.certificado === true));

// Cada modo exclusivo deve alimentar contador e renderização com a mesma coleção.
assert.match(appSource, /function agendaVisibleEvents\(\)/);
assert.match(appSource, /function agendaVisibleBooks\(\)/);
assert.match(appSource, /function agendaVisibleCourses\(\)/);
assert.match(appSource, /function agendaVisibleContests\(\)/);

// Tema existe somente nos contextos com taxonomia temática própria.
assert.match(
  appSource,
  /const themeMode = \['events', 'books', 'courses', 'films', 'utility', 'spaces', 'activities'\]\.includes\(state\.mobileContent\)/
);
assert.match(
  appSource,
  /if \(!\['events', 'books', 'courses', 'films', 'utility', 'spaces', 'activities'\]\.includes\(state\.mobileContent\)\)/
);

// Toda troca de conteúdo passa pelo mesmo normalizador e limpa filtros ocultos.
assert.match(appSource, /function normalizeAgendaFiltersForContent\(content = state\.mobileContent\)/);
assert.match(appSource, /if \(state\.mobileContent !== 'events'\)/);
assert.match(appSource, /if \(state\.mobileContent !== 'books'\)/);
assert.match(appSource, /if \(state\.mobileContent !== 'courses'\)/);
assert.match(appSource, /if \(state\.mobileContent !== 'contests'\)/);
assert.match(appSource, /normalizeAgendaFiltersForContent\(event\.target\.value\);\s*rerender\(\);/);
assert.match(appSource, /normalizeAgendaFiltersForContent\(button\.dataset\.content \|\| 'all'\);\s*rerender\(\);/);

// A interface de cursos expõe os campos estruturados mais úteis.
for (const fieldClass of [
  'agenda-course-institution',
  'agenda-course-area',
  'agenda-course-workload',
  'agenda-course-type',
  'agenda-course-level',
  'agenda-course-language',
  'agenda-course-certificate'
]) {
  assert.ok(appSource.includes(fieldClass), `Filtro de curso ausente: ${fieldClass}`);
}
assert.match(appSource, /const common = \[state\.mobileQuery, state\.mobileCuration\]/);

// Em Todos, Eventos permanecem na primeira posição, mas sem cabeçalho redundante.
assert.doesNotMatch(
  appSource,
  /appendAgendaSection\(resultsContainer, 'Agenda Cultural', results\.events/
);
assert.match(
  appSource,
  /const eventsGrid = document\.createElement\('div'\);[\s\S]*?createAgendaProgressiveControl\(eventsGrid, results\.events, 'events'\)/
);

console.log('Testes funcionais e contextuais da Agenda de Cursos aprovados.');
