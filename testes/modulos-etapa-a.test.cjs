'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const context = vm.createContext({ window: {} });

for (const file of ['js/core/rotacao.js', 'js/conteudos/cursos.js']) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  vm.runInContext(source, context, { filename: file });
}

const core = context.window.MuralCultural.core;
const courses = context.window.MuralCultural.contents.courses;

const interleaved = core.interleaveContents([
  { items: ['e1', 'e2', 'e3'], weight: 2 },
  { items: ['l1', 'l2'], weight: 1 }
]);
assert.equal(JSON.stringify(interleaved), JSON.stringify(['e1', 'e2', 'l1', 'e3', 'l2']));

const catalog = Array.from({ length: 30 }, (_, index) => ({
  titulo: `Curso ${String(index + 1).padStart(2, '0')}`
}));
const sample = courses.sampleForPanel(catalog);
assert.equal(sample.length, 15);
assert.equal(new Set(sample.map(course => course.titulo)).size, 15);
assert.ok(sample.every(course => catalog.includes(course)));

const filtered = courses.filter([
  { titulo: 'Curso B' },
  { titulo: 'Curso inativo', exibicao_ativa: false },
  { titulo: 'Curso A' },
  { descricao: 'Sem título' }
]);
assert.equal(JSON.stringify(filtered.map(course => course.titulo)), JSON.stringify(['Curso A', 'Curso B']));

const normalizeText = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();
assert.equal(
  courses.agendaQueryMatches(
    { titulo: 'Ética no serviço público', instituicao: 'Enap' },
    'etica',
    normalizeText
  ),
  true
);

console.log('Testes dos módulos da Etapa A aprovados.');
