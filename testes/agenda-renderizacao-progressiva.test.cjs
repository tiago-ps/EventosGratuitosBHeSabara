'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
const eventsUiSource = fs.readFileSync(path.join(root, 'js/eventos-manuais-ui.js'), 'utf8');
const stylesSource = fs.readFileSync(path.join(root, 'css/styles.css'), 'utf8');
const coursesData = JSON.parse(fs.readFileSync(path.join(root, 'cursos.json'), 'utf8'));
const booksData = JSON.parse(fs.readFileSync(path.join(root, 'livros.json'), 'utf8'));
const contestsData = JSON.parse(fs.readFileSync(path.join(root, 'concursos.json'), 'utf8'));

const batchMatch = appSource.match(/const AGENDA_COURSE_BATCH_SIZE = (\d+);/);
assert.ok(batchMatch, 'Tamanho do lote da Agenda não encontrado.');
const batchSize = Number(batchMatch[1]);
assert.equal(batchSize, 24);

const nextCountMatch = appSource.match(
  /function nextAgendaCourseCount\(visibleCount, total\) \{[\s\S]*?\n  \}/
);
assert.ok(nextCountMatch, 'Função de avanço do lote não encontrada.');
const context = vm.createContext({ AGENDA_COURSE_BATCH_SIZE: batchSize });
vm.runInContext(`${nextCountMatch[0]}; globalThis.nextCount = nextAgendaCourseCount;`, context);
const nextCount = context.nextCount;

const courseTotal = coursesData.cursos.length;
assert.ok(courseTotal > batchSize);
assert.equal(booksData.livros.length, 10);
assert.equal(contestsData.concursos.length, 27);

function renderedIndexes(total) {
  let visible = Math.min(batchSize, total);
  const indexes = Array.from({ length: visible }, (_, index) => index);
  const batches = [visible];

  while (visible < total) {
    const previous = visible;
    visible = nextCount(previous, total);
    for (let index = previous; index < visible; index += 1) indexes.push(index);
    batches.push(visible);
  }

  return { indexes, batches };
}

const completeCatalog = renderedIndexes(courseTotal);
assert.equal(completeCatalog.batches[0], 24);
assert.equal(completeCatalog.batches[1], 48);
assert.equal(completeCatalog.batches[2], 72);
assert.equal(completeCatalog.batches.at(-1), courseTotal);
assert.ok(completeCatalog.batches.at(-1) - completeCatalog.batches.at(-2) <= batchSize);
assert.equal(completeCatalog.indexes.length, courseTotal);
assert.equal(new Set(completeCatalog.indexes).size, courseTotal);

const normalizeText = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();
const leadershipResults = coursesData.cursos.filter(course => normalizeText([
  course.titulo,
  course.instituicao,
  course.instituicao_parceira,
  course.area,
  course.competencias,
  course.descricao,
  course.publico_alvo
].filter(Boolean).join(' ')).includes('lideranca'));
assert.ok(leadershipResults.length > 72);
const searchedCatalog = renderedIndexes(leadershipResults.length);
assert.deepEqual(searchedCatalog.batches.slice(0, 4), [24, 48, 72, leadershipResults.length]);
assert.equal(renderedIndexes(0).indexes.length, 0);
assert.equal(renderedIndexes(courseTotal).batches[0], 24, 'Limpar a busca deve voltar ao primeiro lote.');

assert.match(appSource, /agendaVisibleCourseCount: AGENDA_COURSE_BATCH_SIZE/);
assert.match(appSource, /const results = agendaVisibleContents\(\);/);
assert.match(appSource, /<strong>\$\{results\.total\}<\/strong>/);
assert.match(appSource, /document\.createDocumentFragment\(\)/);
assert.match(appSource, /items\.slice\(start, end\)\.forEach/);
assert.match(appSource, /appendAgendaCardRange\(grid, courses, previousCount, visibleCount\);/);
assert.match(appSource, /const rerender = \(\) => \{\s*resetAgendaCourseBatch\(\);\s*renderAgenda\(\);/);

const allModeStart = appSource.indexOf("} else if (state.mobileContent === 'all') {");
const exclusiveModeStart = appSource.indexOf('    } else {', allModeStart);
const allModeSource = appSource.slice(allModeStart, exclusiveModeStart);
assert.ok(allModeStart >= 0 && exclusiveModeStart > allModeStart);
const eventsIndex = allModeSource.indexOf('results.events.forEach');
const booksIndex = allModeSource.indexOf("'Sugestões de Leitura'");
const coursesIndex = allModeSource.indexOf("'Cursos Online Gratuitos'");
const contestsIndex = allModeSource.indexOf("'Concursos públicos'");
assert.ok(eventsIndex < booksIndex && booksIndex < coursesIndex && coursesIndex < contestsIndex);
assert.match(allModeSource, /results\.events\.forEach\(item => eventsGrid\.append\(renderAgendaCard\(item\)\)\)/);
assert.match(allModeSource, /'Sugestões de Leitura', results\.books, 'books', 'Ver somente livros'\)/);
assert.match(allModeSource, /'Cursos Online Gratuitos', results\.courses, 'courses', 'Ver somente cursos', true\)/);
assert.match(allModeSource, /'Concursos públicos', results\.contests, 'contests', 'Ver somente concursos'\)/);

assert.match(appSource, /state\.mobileContent === 'courses'\s*\? createAgendaCourseProgressiveControl\(list, items\)/);
assert.match(appSource, /if \(state\.mobileContent !== 'courses'\) \{\s*items\.forEach/);
assert.match(appSource, /aria-label="Mostrar mais cursos">Mostrar mais<\/button>/);
assert.match(appSource, /role="status" aria-live="polite" aria-atomic="true"/);
assert.match(appSource, /button\.setAttribute\('aria-disabled', 'true'\)/);
assert.match(stylesSource, /\.agenda-course-more \{[\s\S]*?min-height: 44px;/);

assert.match(
  eventsUiSource,
  /\.agenda-card:not\(\.agenda-book-card\):not\(\.agenda-course-card\):not\(\.agenda-contest-card\)/
);

console.log('Testes da renderização progressiva da Agenda aprovados.');
