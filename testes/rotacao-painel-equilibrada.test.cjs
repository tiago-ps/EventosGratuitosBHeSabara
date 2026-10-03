'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/core/rotacao.js'), 'utf8');
const context = vm.createContext({ window: { MuralCultural: {} }, Math });
vm.runInContext(source, context, { filename: 'js/core/rotacao.js' });
const core = context.window.MuralCultural.core;

const MODULES = ['books', 'courses', 'contests', 'films', 'utility', 'activities'];
const makeEvents = count => Array.from({ length: count }, (_, index) => ({
  id: `evento-${index}`,
  tipo_conteudo: 'evento',
  titulo: `Evento ${index}`
}));
const makeGroups = (itemsPerGroup = 80) => MODULES.map(moduleId => ({
  id: moduleId,
  items: Array.from({ length: itemsPerGroup }, (_, index) => ({
    id: `${moduleId}-${index}`,
    tipo_conteudo: moduleId,
    titulo: `${moduleId} ${index}`
  }))
}));

function generalSteps(sequence) {
  return sequence.filter(step => step.moduleId);
}

for (const [eventCount, expectedOtherCount] of [
  [189, 48],
  [100, 25],
  [30, 8],
  [10, 3]
]) {
  const memory = core.createPanelMemory();
  const sequence = core.createPanelSequence(
    makeEvents(eventCount),
    makeGroups(),
    [],
    memory,
    { eventsPerOther: 4, eventsPerCuration: 5 }
  );
  const others = generalSteps(sequence);
  assert.equal(
    others.length,
    expectedOtherCount,
    `${eventCount} eventos devem gerar ${expectedOtherCount} vagas não-evento`
  );

  const counts = MODULES.map(id => others.filter(step => step.moduleId === id).length);
  assert.ok(
    Math.max(...counts) - Math.min(...counts) <= 1,
    `distribuição deve ser equilibrada para ${eventCount} eventos: ${counts.join(', ')}`
  );
}

// Quando há menos vagas do que tipos, a memória garante que os tipos que não
// apareceram na primeira rodada tenham prioridade na seguinte.
{
  const memory = core.createPanelMemory();
  const first = core.createPanelSequence(
    makeEvents(10), makeGroups(), [], memory,
    { eventsPerOther: 4, eventsPerCuration: 5 }
  );
  generalSteps(first).forEach(step => core.recordPanelExposure(memory, step));

  const second = core.createPanelSequence(
    makeEvents(10), makeGroups(), [], memory,
    { eventsPerOther: 4, eventsPerCuration: 5 }
  );
  const firstModules = new Set(generalSteps(first).map(step => step.moduleId));
  const secondModules = new Set(generalSteps(second).map(step => step.moduleId));

  assert.equal(firstModules.size, 3);
  assert.equal(secondModules.size, 3);
  assert.equal(
    new Set([...firstModules, ...secondModules]).size,
    6,
    'duas rodadas de 10 eventos devem dar oportunidade aos seis tipos não-evento'
  );
}

// Sem eventos, o painel continua vivo e oferece uma passagem equilibrada por
// todos os módulos que tenham conteúdo.
{
  const memory = core.createPanelMemory();
  const sequence = core.createPanelSequence(
    [], makeGroups(), [], memory,
    { eventsPerOther: 4, eventsPerCuration: 5 }
  );
  const others = generalSteps(sequence);
  assert.equal(others.length, 6);
  assert.equal(new Set(others.map(step => step.moduleId)).size, 6);
}

console.log('Rotação proporcional e equilibrada do Painel aprovada.');
