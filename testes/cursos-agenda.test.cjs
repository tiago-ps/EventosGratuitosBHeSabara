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
  conteudo_programatico: 'Conteúdo longo fora da busca'
};
for (const field of [
  'titulo', 'instituicao', 'instituicao_parceira', 'area',
  'competencias', 'descricao', 'publico_alvo'
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

// Cada modo exclusivo deve alimentar contador e renderização com a mesma coleção.
assert.match(
  appSource,
  /function agendaVisibleEvents\(\) \{\s*if \(!\['all', 'events'\]\.includes\(state\.mobileContent\)\) return \[\];/
);
assert.match(
  appSource,
  /function agendaVisibleBooks\(\) \{\s*if \(!\['all', 'books'\]\.includes\(state\.mobileContent\)/
);
assert.match(
  appSource,
  /function agendaVisibleCourses\(\) \{\s*if \(!\['all', 'courses'\]\.includes\(state\.mobileContent\)/
);
assert.match(
  appSource,
  /function agendaVisibleContests\(\) \{\s*if \(state\.mobileTheme \|\| !\['all', 'contests'\]\.includes\(state\.mobileContent\)/
);

// Tema existe apenas nos contextos que possuem taxonomia própria.
assert.match(appSource, /if \(content === 'events'\) \{\s*for \(const event of state\.allEvents\)/);
assert.match(appSource, /if \(content === 'books'\) \{\s*for \(const book of state\.allBooks\)/);
assert.match(appSource, /const themeMode = \['events', 'books', 'courses', 'films'\]\.includes\(state\.mobileContent\);/);

// Toda troca de conteúdo passa pelo mesmo normalizador e limpa filtros ocultos.
assert.match(appSource, /function normalizeAgendaFiltersForContent\(content = state\.mobileContent\)/);
assert.match(appSource, /if \(!\['events', 'books', 'courses', 'films'\]\.includes\(state\.mobileContent\)\) \{\s*state\.mobileTheme = '';/);
assert.match(appSource, /if \(state\.mobileContent !== 'events'\) \{\s*state\.mobilePeriod = 'all';/);
assert.match(appSource, /if \(state\.mobileContent !== 'books'\) state\.mobileBookAccess = '';/);
assert.match(appSource, /if \(state\.mobileContent !== 'contests'\) \{\s*state\.mobileContestFormation = '';/);
assert.match(appSource, /normalizeAgendaFiltersForContent\(event\.target\.value\);\s*rerender\(\);/);
assert.match(appSource, /normalizeAgendaFiltersForContent\(button\.dataset\.content \|\| 'all'\);\s*rerender\(\);/);

// Todos contabiliza somente a busca compartilhada; filtros específicos entram
// no contador apenas no respectivo modo.
assert.match(appSource, /const common = \[state\.mobileQuery\];/);
assert.match(appSource, /common\.push\(\s*state\.mobileTheme,\s*state\.mobilePeriod/);
assert.match(appSource, /common\.push\(state\.mobileTheme, state\.mobileBookAccess\);/);

// Em Todos, Eventos permanecem na primeira posição, mas sem cabeçalho,
// contador parcial ou atalho redundante para o filtro de conteúdo.
assert.doesNotMatch(
  appSource,
  /appendAgendaSection\(resultsContainer, 'Agenda Cultural', results\.events/
);
assert.match(
  appSource,
  /const eventsGrid = document\.createElement\('div'\);\s*eventsGrid\.className = 'agenda-section-grid';\s*const eventsProgressiveControl = createAgendaProgressiveControl\(eventsGrid, results\.events, 'events'\);\s*resultsContainer\.append\(eventsGrid\);/
);

console.log('Testes funcionais e contextuais da Agenda de Cursos aprovados.');
