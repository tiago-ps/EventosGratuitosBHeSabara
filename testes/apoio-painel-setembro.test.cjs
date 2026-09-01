'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const payload = JSON.parse(fs.readFileSync(path.join(root, 'curadorias-site.json'), 'utf8'));
const source = fs.readFileSync(path.join(root, 'js/curadorias-site.js'), 'utf8');

const originalFilms = {
  filter(movies) {
    return Array.isArray(movies) ? [...movies] : [];
  },
  options(movies, field) {
    const values = [];
    for (const movie of Array.isArray(movies) ? movies : []) {
      for (const value of Array.isArray(movie?.[field]) ? movie[field] : []) {
        if (!values.includes(value)) values.push(value);
      }
    }
    return values;
  },
  sampleForPanel(movies) {
    return (Array.isArray(movies) ? movies : []).slice(0, 15);
  },
  createPanelSlide() {
    return { cultural: true };
  }
};

const context = vm.createContext({
  URL,
  console,
  window: {
    MuralCultural: {
      contents: { films: originalFilms }
    }
  }
});

vm.runInContext(source, context, { filename: 'js/curadorias-site.js' });

const curations = context.window.MuralCultural.siteCurations;
const films = context.window.MuralCultural.contents.films;
const merged = curations.apply(payload, {
  eventos: [],
  livros: [],
  cursos: [],
  filmes: [
    {
      id: 'filme-cultural-teste',
      titulo: 'Filme cultural de teste',
      temas: ['Setembro Amarelo'],
      generos: ['Documentário']
    }
  ]
}, {
  today: new Date(2026, 8, 15),
  warn() {}
});

const support = merged.filmes.filter(item => item.painel_apoio === true);
assert.equal(support.length, 4);
assert.deepEqual(
  Array.from(support.map(item => item.id)),
  [
    'site:apoio:setembro-cvv-188',
    'site:apoio:setembro-rede-publica',
    'site:apoio:setembro-universidades',
    'site:apoio:setembro-informacao-confiavel'
  ]
);
assert.ok(support.every(item => item.origem === 'site-only'));
assert.ok(support.every(item => item.temas.includes('Setembro Amarelo')));

const agendaFilms = films.filter(merged.filmes, { theme: 'Setembro Amarelo' }, value => String(value || '').toLowerCase());
assert.equal(agendaFilms.some(item => item.painel_apoio === true), false);
assert.equal(agendaFilms.some(item => item.id === 'filme-cultural-teste'), true);

const panelSeptember = films.sampleForPanel(
  merged.filmes,
  { theme: 'setembro amarelo' },
  value => String(value || '').toLowerCase(),
  15,
  { previousItems: [] }
);
assert.equal(panelSeptember.filter(item => item.painel_apoio === true).length, 4);
assert.equal(panelSeptember[0].painel_apoio, true, 'O primeiro slot do grupo deve priorizar utilidade pública');
assert.ok(panelSeptember.some(item => item.id === 'filme-cultural-teste'));

const panelWithoutTheme = films.sampleForPanel(
  merged.filmes,
  { theme: '' },
  value => String(value || '').toLowerCase(),
  15,
  { previousItems: [] }
);
assert.equal(panelWithoutTheme.some(item => item.painel_apoio === true), false);

assert.equal(typeof curations.buildPanelSupportItems, 'function');
assert.equal(films.__panelSupportAdapter, true);

console.log('Slides rotativos de utilidade pública do Setembro Amarelo aprovados.');
