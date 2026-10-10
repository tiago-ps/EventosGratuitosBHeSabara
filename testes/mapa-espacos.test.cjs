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
const events = JSON.parse(fs.readFileSync('eventos.json', 'utf8')).eventos.map(item => ({ ...item, tipo_conteudo: 'evento' }));
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
assert.ok(all.points.some(group => group.items.some(record => record.item.tipo_conteudo === 'atividade_lazer')),
  'Atividade com endereço físico verificado deve aparecer no mapa');
assert.ok(!all.points.some(group => group.items.some(record => record.item.tipo_conteudo === 'concurso')),
  'Não inventar local de trabalho para concurso sem lotação verificada');
const virtualOnly = moduleMap.mapItems({
  results: { books: [{ id: 'virtual', titulo: 'Apenas virtual', acesso_fisico: false }] },
  allSpaces: spaces, coordinates: geo.pontos, extra: supplementary, relations
});
assert.equal(virtualOnly.mapped, 0, 'Livro exclusivamente virtual não recebe marcador');
const coverage = {};
for (const point of all.points) {
  for (const record of point.items) {
    const type = record.item.tipo_conteudo;
    coverage[type] = (coverage[type] || 0) + 1;
  }
}
console.log('Cobertura do mapa por tipo:', JSON.stringify(coverage));

// Eventos com título igual e sessões diferentes não são duplicatas.
const toySessions = events.filter(item => item.titulo === 'Oficina de brinquedos e brincadeiras');
assert.ok(toySessions.length >= 3, 'Catálogo de teste contém sessões reais do mesmo evento');
const sessionsGroup = {
  coords: [-19.9, -43.9],
  items: [
    ...toySessions.map(item => ({ item, venue: 'Museu de História Natural e Jardim Botânico', address: item.endereco })),
    { item: toySessions[0], venue: 'Museu de História Natural e Jardim Botânico', address: toySessions[0].endereco }
  ]
};
const distinctSessions = moduleMap.popupEntries(sessionsGroup);
assert.equal(distinctSessions.length, toySessions.length,
  'Remover repetição do mesmo ID sem apagar sessões com outros dias/horários');
assert.equal(new Set(distinctSessions.map(record => moduleMap.popupEventDate(record.item))).size,
  toySessions.length, 'Sessões devem ter datas e horários reconhecíveis');
assert.equal(moduleMap.popupPlaceName(sessionsGroup), 'Museu de História Natural e Jardim Botânico');

// DOM mínimo para validar o resumo e a expansão dos pop-ups sem navegador.
class FakeElement {
  constructor(tag) {
    this.tagName = tag;
    this.children = [];
    this.attributes = {};
    this.hidden = false;
    this.className = '';
    this.textContent = '';
    this.listeners = {};
    this.classList = { toggle: () => {} };
  }
  append(...children) { this.children.push(...children); }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  getAttribute(key) { return this.attributes[key] ?? null; }
  removeAttribute(key) { delete this.attributes[key]; }
  addEventListener(type, handler) { this.listeners[type] = handler; }
}
ctx.document = { createElement: tag => new FakeElement(tag) };
ctx.window.location = { href: 'https://tiago-ps.github.io/EventosGratuitosBHeSabara/' };
ctx.URL = URL;
const largeGroup = all.points.find(group => moduleMap.popupEntries(group).length > 10);
assert.ok(largeGroup, 'Ao menos um equipamento reúne muitos conteúdos');
let resized = 0;
const popup = moduleMap.createPopup(largeGroup, item =>
  'https://tiago-ps.github.io/EventosGratuitosBHeSabara/?item=' + encodeURIComponent(item.id), () => { resized += 1; });
const list = popup.children.find(child => child.className === 'agenda-map-popup-items');
const more = popup.children.find(child => child.className === 'agenda-map-popup-more');
assert.ok(list && more, 'Lista compacta oferece opção de expandir');
assert.equal(list.children.filter(child => !child.hidden).length, 4);
more.listeners.click();
assert.equal(list.children.filter(child => !child.hidden).length, moduleMap.popupEntries(largeGroup).length);
assert.equal(more.getAttribute('aria-expanded'), 'true');
more.listeners.click();
assert.equal(list.children.filter(child => !child.hidden).length, 4);
assert.equal(resized, 2, 'Leaflet reposiciona popup após expandir ou recolher');

const publicLibraryGroup = all.points.find(group =>
  group.items.some(record => record.item.tipo_conteudo === 'livro' &&
    record.venue === 'Biblioteca Pública Estadual de Minas Gerais'));
assert.ok(publicLibraryGroup, 'Biblioteca estadual é encontrada');
const publicLibraryPopup = moduleMap.createPopup(publicLibraryGroup, () => 'https://temsimuai.com.br/');
assert.ok(!publicLibraryPopup.children.some(child => child.className === 'agenda-map-popup-precision'),
  'Localização de equipamento validada não deve receber aviso genérico de entrada');
const campusGroup = all.points.find(group =>
  group.items.some(record => String(record.precision).includes('campus')));
assert.ok(campusGroup, 'Ponto aproximado do campus é encontrado');
const campusPopup = moduleMap.createPopup(campusGroup, () => 'https://temsimuai.com.br/');
assert.ok(campusPopup.children.some(child => child.className === 'agenda-map-popup-precision'),
  'Ponto do campus mantém aviso específico sobre entrada');
console.log('Popups: datas das sessões, expansão e avisos de precisão verificados.');

console.log('Mapa da Exploração: espaços, eventos, acervos físicos e filtros verificados.');
