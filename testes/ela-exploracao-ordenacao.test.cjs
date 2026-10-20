'use strict';

/** Cenários isolados da ordenação editorial dos Eventos da ELA no modo Exploração. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
const start = source.indexOf('function orderAgendaEventsForExploration(');
const end = source.indexOf('function agendaVisibleEvents()', start);
assert.ok(start >= 0 && end > start, 'Ordenação de exploração da ELA ausente');

const isSchoolEvent = item => item.programa === 'Escola Livre de Artes Arena da Cultura';
const eventRealization = item => {
  const period = item.temporalidade?.realizacao || {};
  const classe = item.temporalidade?.classe || 'pontual';
  return {
    classe,
    inicio: classe === 'permanente' || classe === 'atemporal' ? '' : period.inicio || item.data || '',
    fim: classe === 'permanente' || classe === 'atemporal' ? '' : period.fim || item.data_fim || item.data || ''
  };
};
const context = vm.createContext({ isSchoolEvent, eventRealization });
vm.runInContext(source.slice(start, end), context);
const arrange = context.orderAgendaEventsForExploration;

const ela = (id, tipo_registro) => ({
  id,
  tipo_registro,
  programa: 'Escola Livre de Artes Arena da Cultura',
  temporalidade: { classe: 'periodo' },
  data: '2026-03-14', data_fim: '2026-12-14'
});
const ordinary = (id, classe, inicio, fim = inicio) => ({
  id, programa: 'Outra programação',
  temporalidade: { classe, realizacao: { inicio, fim } }
});

const input = [
  ordinary('data-1', 'pontual', '2026-10-20'),
  ela('ela-unidade-1', 'resumo_unidade_escola_livre'),
  ordinary('permanente', 'permanente', '2026-01-01', '2026-12-31'),
  ela('ela-atividade-1', 'atividade_escola_livre'),
  ordinary('data-2', 'periodo', '2026-10-21', '2026-10-23'),
  ela('ela-programa', 'programa_escola_livre'),
  ordinary('sem-data', 'atemporal', '', ''),
  ela('ela-unidade-2', 'resumo_unidade_escola_livre'),
  ela('ela-atividade-2', 'atividade_escola_livre')
];
const expected = [
  'ela-programa', 'ela-unidade-1', 'ela-unidade-2',
  'data-1', 'data-2',
  'ela-atividade-1', 'ela-atividade-2',
  'permanente', 'sem-data'
];
assert.deepEqual(Array.from(arrange(input), item => item.id), expected);
assert.deepEqual(Array.from(arrange(input.filter(item => !isSchoolEvent(item))), item => item.id),
  ['data-1', 'permanente', 'data-2', 'sem-data'], 'Outros eventos não são reordenados sem ELA');
assert.equal(arrange(input).length, input.length);
assert.ok(source.includes('if (specific && !agendaHasSpecificEventFilters())'),
  'Reorganização deve ocorrer somente na lista geral de Eventos');
assert.ok(source.includes('return orderAgendaEventsForExploration(visible);'),
  'O modo Exploração deve usar o ordenador');

const published = JSON.parse(fs.readFileSync(path.join(root, 'eventos.json'), 'utf8')).eventos;
const allSchool = published.filter(isSchoolEvent);
assert.ok(allSchool.length > 3, 'A base real deve conter programas e atividades ELA');
const ordered = arrange(published);
assert.equal(ordered.length, published.length);
assert.equal(new Set(ordered.map(item => item.id)).size, published.length);
const tailStart = ordered.findIndex(item => item.id === 'ela-programa-2026-2');
assert.ok(tailStart >= 0, 'Programa da ELA continua disponível no catálogo');

console.log('Ordenação da ELA: destaques, eventos datados, ELA restante e permanentes — OK.');
