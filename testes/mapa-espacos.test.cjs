'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('js/mapa-espacos.js', 'utf8');
const page = fs.readFileSync('index.html', 'utf8');
const serviceWorker = fs.readFileSync('service-worker.js', 'utf8');
const geo = JSON.parse(fs.readFileSync('coordenadas-espacos.json', 'utf8'));
const catalog = JSON.parse(fs.readFileSync('espacos_culturais.json', 'utf8'));

assert.ok(page.includes('js/mapa-espacos.js?v=2'));
assert.ok(page.includes('css/mapa-espacos.css?v=2'));
assert.ok(serviceWorker.includes('./js/mapa-espacos.js?v=2'));
assert.ok(serviceWorker.includes('./css/mapa-espacos.css?v=2'));
assert.ok(serviceWorker.includes('/coordenadas-espacos.json'));

const ctx = { window: { MuralCultural: {} } };
vm.runInNewContext(source, ctx);
const moduleMap = ctx.window.MuralCultural.spaceMap;
assert.equal(typeof moduleMap.mount, 'function');
assert.equal(typeof moduleMap.groupedPoints, 'function');

const spaces = catalog.itens;
const grouped = moduleMap.groupedPoints(spaces, geo.pontos, spaces);
const located = grouped.points.flatMap(point => point.spaces);
assert.ok(grouped.points.length >= 4, 'Mapa precisa ter pontos reais para estrear');
assert.equal(located.length + grouped.unlocated, spaces.length);
assert.ok(located.some(item => item.id === 'ccbb-bh'));
assert.ok(located.some(item => item.id === 'ccbb-bh-teatro-i'), 'Subespaço deve herdar coordenadas do endereço idêntico');

const invalid = moduleMap.groupedPoints([
  { id: 'invalid', endereco: 'Teste, BH' }
], {
  invalid: { latitude: 0, longitude: 0 }
});
assert.equal(invalid.points.length, 0, 'Não posicionar espaços sem coordenadas de MG');

const filtered = spaces.filter(item => item.id === 'ccbb-bh-teatro-i');
const inherited = moduleMap.groupedPoints(filtered, geo.pontos, spaces);
assert.equal(inherited.points.length, 1, 'Filtro deve manter coordenadas herdadas do catálogo completo');

for (const point of grouped.points) {
  assert.ok(point.coords[0] < -15 && point.coords[0] > -23);
  assert.ok(point.coords[1] < -39 && point.coords[1] > -52);
}

const supplementary = JSON.parse(fs.readFileSync('coordenadas-conteudos.json', 'utf8'));
const events = JSON.parse(fs.readFileSync('eventos.json', 'utf8')).eventos;
const books = JSON.parse(fs.readFileSync('livros.json', 'utf8')).livros;
const activities = JSON.parse(fs.readFileSync('atividades-lazer.json', 'utf8')).atividades;
const relations = JSON.parse(fs.readFileSync('relacoes-eventos.json', 'utf8')).relacoes;
const all = moduleMap.mapItems({
  results: { events, books, spaces, activities, contests: [], utility: [] },
  allSpaces: spaces, coordinates: geo.pontos, extra: supplementary, relations
});
assert.ok(all.mapped > located.length, 'Eventos e livros devem contribuir com o mapa');
assert.ok(all.points.some(group => group.items.some(record => record.item.tipo_conteudo === 'livro')),
  'Livro físico deve aparecer no mapa da biblioteca');
assert.ok(all.points.some(group => group.items.some(record => record.item.tipo_conteudo === 'evento')),
  'Evento de local geocodificado deve aparecer no mapa');
assert.ok(!all.points.some(group => group.items.some(record => record.item.tipo_conteudo === 'concurso')),
  'Não inventar local de trabalho para concurso sem lotação verificada');
const virtualOnly = moduleMap.mapItems({
  results: { books: [{ id: 'virtual', titulo: 'Apenas virtual', acesso_fisico: false }] },
  allSpaces: spaces, coordinates: geo.pontos, extra: supplementary, relations
});
assert.equal(virtualOnly.mapped, 0, 'Livro exclusivamente virtual não recebe marcador');
console.log('Mapa da Exploração: espaços, eventos, acervos físicos e filtros verificados.');
