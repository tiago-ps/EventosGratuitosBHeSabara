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

const batchMatch = appSource.match(/const AGENDA_BATCH_SIZE = (\d+);/);
assert.ok(batchMatch, 'Tamanho do lote da Agenda não encontrado.');
const batchSize = Number(batchMatch[1]);
assert.equal(batchSize, 24);

const nextCountMatch = appSource.match(
  /function nextAgendaVisibleCount\(visibleCount, total\) \{[\s\S]*?\n  \}/
);
assert.ok(nextCountMatch, 'Função de avanço do lote não encontrada.');
const context = vm.createContext({ AGENDA_BATCH_SIZE: batchSize });
vm.runInContext(`${nextCountMatch[0]}; globalThis.nextCount = nextAgendaVisibleCount;`, context);
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

for (const content of ['events', 'books', 'courses', 'contests']) {
  assert.match(appSource, new RegExp(`${content}: AGENDA_BATCH_SIZE`));
}
assert.match(appSource, /const results = agendaVisibleContents\(\);/);
assert.match(appSource, /<strong>\$\{results\.total\}<\/strong>/);
assert.match(appSource, /document\.createDocumentFragment\(\)/);
assert.match(appSource, /items\.slice\(start, end\)\.forEach/);
assert.match(appSource, /appendAgendaCardRange\(grid, items, previousCount, visibleCount, renderItem\);/);
assert.match(appSource, /const rerender = \(\) => \{\s*resetAgendaBatches\(\);\s*renderAgenda\(\);/);

const allModeStart = appSource.indexOf("} else if (state.mobileContent === 'all') {");
const exclusiveModeStart = appSource.indexOf('    } else {', allModeStart);
const allModeSource = appSource.slice(allModeStart, exclusiveModeStart);
assert.ok(allModeStart >= 0 && exclusiveModeStart > allModeStart);
const eventsIndex = allModeSource.indexOf("createAgendaProgressiveControl(eventsGrid, results.events, 'events')");
const booksIndex = allModeSource.indexOf("'Sugestões de Leitura'");
const coursesIndex = allModeSource.indexOf("'Cursos Online Gratuitos'");
const contestsIndex = allModeSource.indexOf("'Concursos públicos'");
assert.ok(eventsIndex < booksIndex && booksIndex < coursesIndex && coursesIndex < contestsIndex);
assert.match(allModeSource, /createAgendaProgressiveControl\(eventsGrid, results\.events, 'events'\)/);
assert.match(allModeSource, /appendAgendaSection\(resultsContainer, 'Sugestões de Leitura', results\.books, 'books', 'Ver somente livros'\)/);
assert.match(allModeSource, /appendAgendaSection\(resultsContainer, 'Cursos Online Gratuitos', results\.courses, 'courses', 'Ver somente cursos'\)/);
assert.match(allModeSource, /appendAgendaSection\(resultsContainer, 'Concursos públicos', results\.contests, 'contests', 'Ver somente concursos'\)/);

assert.match(appSource, /createAgendaProgressiveControl\(grid, items, contentValue\)/);
assert.match(appSource, /const renderItem = state\.mobileContent === 'events' && !agendaHasSpecificEventFilters\(\)/);
assert.match(appSource, /createAgendaProgressiveControl\(\s*list,\s*items,\s*state\.mobileContent,\s*renderItem\s*\)/);
assert.match(appSource, /aria-label="Mostrar mais \$\{labels\.plural\}" aria-controls="\$\{grid\.id\}"/);
assert.match(appSource, /role="status" aria-live="polite" aria-atomic="true"/);
assert.match(appSource, /button\.setAttribute\('aria-disabled', 'true'\)/);
assert.match(stylesSource, /\.agenda-more \{[\s\S]*?min-height: 44px;/);

const totalsByContent = {
  books: booksData.livros.length,
  courses: courseTotal,
  contests: contestsData.concursos.length
};
for (const [content, total] of Object.entries(totalsByContent)) {
  const rendering = renderedIndexes(total);
  assert.equal(rendering.indexes.length, total, `${content}: catálogo completo deve ser alcançável.`);
  assert.equal(new Set(rendering.indexes).size, total, `${content}: cards não podem ser duplicados.`);
  assert.equal(rendering.batches[0], Math.min(batchSize, total));
}
assert.deepEqual(renderedIndexes(booksData.livros.length).batches, [booksData.livros.length]);
assert.deepEqual(renderedIndexes(contestsData.concursos.length).batches, [24, 27]);

assert.match(appSource, /agenda-card[^`]*agenda-event-card/);
assert.match(appSource, /state\.mobileContent === 'events' && !agendaHasSpecificEventFilters\(\)[\s\S]*?return state\.allEvents;/);
assert.match(appSource, /\[event\.imagem, event\.imagem_local, event\.imagem_programa\][\s\S]*?\.find\(Boolean\)/);
assert.match(eventsUiSource, /document\.querySelectorAll\('#app \.agenda-event-card'\)/);
assert.doesNotMatch(eventsUiSource, /agenda-card:not\(/);
assert.doesNotMatch(eventsUiSource, /expandUnfilteredAgendaEvents/);
assert.doesNotMatch(eventsUiSource, /createAgendaEventCard/);

console.log('Testes da renderização progressiva da Agenda aprovados.');
