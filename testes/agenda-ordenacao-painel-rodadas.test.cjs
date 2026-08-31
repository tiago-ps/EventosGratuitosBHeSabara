'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
const rotationSource = fs.readFileSync(path.join(root, 'js/core/rotacao.js'), 'utf8');

function functionSource(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `Função ${name} não encontrada.`);
  const bodyStart = source.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Corpo da função ${name} não fechado.`);
}

const orderingContext = vm.createContext({ Intl, Date, Number, String, Object });
for (const name of [
  'parseCalendarDate', 'agendaTitleCompare', 'agendaDateValue', 'contestDeadlineValue',
  'compareAgendaEvents', 'compareAgendaContests'
]) {
  vm.runInContext(functionSource(appSource, name), orderingContext);
}

const compareEvents = orderingContext.compareAgendaEvents;
const compareContests = orderingContext.compareAgendaContests;
const compareTitle = orderingContext.agendaTitleCompare;

assert.deepEqual(
  [...[
    { titulo: 'Zeta', data: '2026-10-01' },
    { titulo: 'Árvore', data: '2026-09-01' },
    { titulo: 'Abelha', data: '2026-09-01' }
  ].sort(compareEvents)].map(item => item.titulo),
  ['Abelha', 'Árvore', 'Zeta'],
  'Eventos devem usar data crescente e título como desempate.'
);

assert.deepEqual(
  [...[
    { titulo: 'Zeta', inscricoes_fim_texto: '20 de setembro de 2026' },
    { titulo: 'Árvore', inscricoes_fim_texto: '10 de setembro de 2026' },
    { titulo: 'Abelha', inscricoes_fim_texto: '10 de setembro de 2026' },
    { titulo: 'Sem prazo' }
  ].sort(compareContests)].map(item => item.titulo),
  ['Abelha', 'Árvore', 'Zeta', 'Sem prazo'],
  'Concursos devem usar prazo crescente, título no empate e prazo ausente ao final.'
);

for (const label of ['Livro', 'Curso', 'Filme']) {
  assert.deepEqual(
    [...[{ titulo: 'Zebra' }, { titulo: 'Árvore' }, { titulo: 'Abelha' }].sort(compareTitle)].map(item => item.titulo),
    ['Abelha', 'Árvore', 'Zebra'],
    `${label}s devem usar colação pt-BR A–Z.`
  );
}

assert.match(appSource, /agendaVisibleCourses\(\)[\s\S]*?\.sort\(agendaTitleCompare\)/);
assert.match(appSource, /createAgendaProgressiveControl\(grid, items, contentValue\)/);
const allAgendaMode = appSource.slice(
  appSource.indexOf("} else if (state.mobileContent === 'all') {"),
  appSource.indexOf('    } else {', appSource.indexOf("} else if (state.mobileContent === 'all') {"))
);
assert.ok(
  allAgendaMode.indexOf("results.events") < allAgendaMode.indexOf("results.books") &&
  allAgendaMode.indexOf("results.books") < allAgendaMode.indexOf("results.courses") &&
  allAgendaMode.indexOf("results.courses") < allAgendaMode.indexOf("results.contests"),
  'Todos deve manter a ordem estrutural dos tipos.'
);
assert.match(appSource, /function createPanelRound\(\)/);
assert.match(appSource, /if \(state\.index === state\.events\.length - 1\) \{\s*createPanelRound\(\);\s*state\.index = 0;/);
assert.match(appSource, /function goToPrevious\(\)[\s\S]*?state\.index = \(state\.index - 1 \+ state\.events\.length\) % state\.events\.length;/);
assert.match(appSource, /function togglePlayPause\(\)[\s\S]*?scheduleNextSlide\(\)/);
assert.match(appSource, /function agendaVisibleContents\(\)[\s\S]*?const events = agendaVisibleEvents\(\);[\s\S]*?const books = agendaVisibleBooks\(\);[\s\S]*?const courses = agendaVisibleCourses\(\);[\s\S]*?const contests = agendaVisibleContests\(\);/);

const random = () => 0;
const panelContext = vm.createContext({ window: {}, Math: Object.assign(Object.create(Math), { random }) });
vm.runInContext(rotationSource, panelContext, { filename: 'rotacao.js' });
const core = panelContext.window.MuralCultural.core;
const catalog = Array.from({ length: 20 }, (_, index) => ({ titulo: `Item ${index + 1}` }));
const firstRound = core.sampleForPanel(catalog, 15);
const stableFirstRound = firstRound.map(item => item.titulo);
assert.deepEqual(firstRound.map(item => item.titulo), stableFirstRound, 'A rodada permanece estável enquanto é exibida.');
const secondRound = core.sampleForPanel(catalog, 15, { previousItems: firstRound });
assert.equal(core.sameSample(firstRound, secondRound), false, 'A rodada seguinte não pode repetir a amostra anterior.');
const thirdRound = core.sampleForPanel(catalog, 15, { previousItems: secondRound });
assert.equal(core.sameSample(secondRound, thirdRound), false, 'Uma terceira rodada deve poder formar outra combinação.');

assert.equal(
  JSON.stringify(core.interleaveContents([
    { items: ['e1', 'e2', 'e3'], weight: 2 },
    { items: ['c1', 'c2'], weight: 1 }
  ])),
  JSON.stringify(['e1', 'e2', 'c1', 'e3', 'c2']),
  'Pesos do Painel devem permanecer respeitados entre rodadas.'
);

console.log('Testes de ordenação da Agenda e rodadas do Painel aprovados.');
