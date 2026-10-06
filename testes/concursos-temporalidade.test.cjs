'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const context = vm.createContext({
  Intl,
  Date,
  window: {
    MuralCultural: {
      contents: {},
      core: {
        sampleForPanel(items, limit) {
          return items.slice(0, limit);
        }
      }
    }
  }
});

vm.runInContext(
  fs.readFileSync(path.join(root, 'js/conteudos/concursos.js'), 'utf8'),
  context,
  { filename: 'js/conteudos/concursos.js' }
);

const contests = context.window.MuralCultural.contents.contests;
const reference = new Date('2026-10-06T12:00:00-03:00');

assert.equal(
  contests.deadlineState({
    janela_inscricoes: { inicio: '2026-10-19', fim: '2026-11-17' }
  }, reference),
  'futuro'
);
assert.equal(
  contests.deadlineState({
    janela_inscricoes: { inicio: '2026-10-05', fim: '2026-11-10' }
  }, reference),
  'aberto'
);
assert.equal(
  contests.deadlineState({
    janela_inscricoes: { fim: '2026-10-05' }
  }, reference),
  'encerrado'
);
assert.equal(
  contests.deadlineState({ janela_inscricoes: { estado: 'prazo_desconhecido' } }, reference),
  'prazo_desconhecido'
);

assert.equal(
  contests.deadlineState({
    inscricoes_inicio_texto: '5 de outubro de 2026',
    inscricoes_fim_texto: '10 de novembro de 2026'
  }, reference),
  'aberto',
  'Fallback textual continua funcionando antes de todos os catálogos terem o bloco ATC5.'
);

const sample = [
  {
    titulo: 'Encerrado',
    url: 'https://example.org/encerrado',
    janela_inscricoes: { inicio: '2000-01-01', fim: '2000-01-02' }
  },
  {
    titulo: 'Aberto',
    url: 'https://example.org/aberto',
    janela_inscricoes: { inicio: '2000-01-01', fim: '2999-01-02' }
  },
  {
    titulo: 'Futuro',
    url: 'https://example.org/futuro',
    janela_inscricoes: { inicio: '2999-01-01', fim: '2999-02-01' }
  },
  {
    titulo: 'Sem prazo',
    url: 'https://example.org/sem-prazo'
  }
];

assert.deepEqual(
  Array.from(contests.filter(sample)).map(item => item.titulo),
  ['Aberto', 'Futuro', 'Sem prazo'],
  'Filtro padrão exclui encerrados.'
);
assert.deepEqual(
  Array.from(contests.filter(sample, { state: 'encerrado' })).map(item => item.titulo),
  ['Encerrado'],
  'Filtro explícito recupera encerrados.'
);
assert.equal(contests.filter(sample, { state: 'todos' }).length, 4);
assert.deepEqual(
  Array.from(contests.sampleForPanel(sample, 15)).map(item => item.titulo),
  ['Aberto', 'Futuro', 'Sem prazo'],
  'Painel nunca inclui encerrados por padrão.'
);

const appSource = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
const standaloneHtml = fs.readFileSync(path.join(root, 'concursos.html'), 'utf8');
const standaloneJs = fs.readFileSync(path.join(root, 'js/concursos.js'), 'utf8');

assert.ok(appSource.includes('mobileContestState'));
assert.ok(appSource.includes('agenda-contest-state'));
assert.ok(appSource.includes('janela_inscricoes?.fim'));
assert.ok(standaloneHtml.includes('id="situacao"'));
assert.ok(standaloneHtml.includes('value="encerrado"'));
assert.ok(standaloneJs.includes('deadlineStateLabel'));
assert.ok(standaloneJs.includes('state: temporalState.value'));

console.log('Temporalidade de Concursos validada.');
