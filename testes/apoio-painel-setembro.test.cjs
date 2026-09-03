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
  },
  createAgendaCard() {
    return { culturalAgenda: true };
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
assert.ok(support.every(item => item.site_only === true));
assert.ok(support.every(item => item.temas.includes('Setembro Amarelo')));
assert.deepEqual(
  Array.from(support.map(item => item.support_target)),
  ['apoio-emocional', 'rede-publica', 'atendimento-universitario', 'informacao-confiavel']
);

const agendaFilms = films.filter(merged.filmes, { theme: 'Setembro Amarelo', query: '' }, value => String(value || '').toLowerCase());
assert.equal(agendaFilms.some(item => item.painel_apoio === true), false);
assert.equal(agendaFilms.some(item => item.id === 'filme-cultural-teste'), true);
const agendaSupport = films.filter(merged.filmes, { query: 'pode falar', genre: 'Terror', rating: '18' }, value => String(value || '').toLowerCase());
assert.equal(agendaSupport.some(item => item.support_target === 'apoio-emocional'), true);

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

const october = curations.apply(payload, { eventos: [], livros: [], cursos: [], filmes: [] }, {
  today: new Date(2026, 9, 1), warn() {}
});
assert.equal(october.curadoriasAtivas.length, 0);
assert.ok(october.apoio);
assert.equal(october.apoio.campaignActive, false);
assert.equal(october.filmes.filter(item => item.painel_apoio).length, 4);
assert.equal(films.sampleForPanel(october.filmes, { theme: '' }, value => String(value || '').toLowerCase(), 15).some(item => item.painel_apoio), false);
assert.equal(films.filter(october.filmes, { query: 'universidade' }, value => String(value || '').toLowerCase()).some(item => item.support_target === 'atendimento-universitario'), true);

assert.equal(typeof curations.buildPanelSupportItems, 'function');
assert.equal(films.__panelSupportAdapter, true);

const classes = new Set();
const image = {
  classList: {
    add(value) { classes.add(value); },
    remove(value) { classes.delete(value); }
  },
  style: { display: 'none' },
  src: 'imagens/curadorias/pode-falar.png',
  removeAttribute(name) { if (name === 'src') delete this.src; }
};
const fallback = { hidden: false };
curations.setPanelSupportImageState(image, fallback, true);
assert.equal(classes.has('loaded'), true);
assert.equal(image.style.display, '');
assert.equal(fallback.hidden, true);
curations.setPanelSupportImageState(image, fallback, false);
assert.equal(classes.has('loaded'), false);
assert.equal(image.src, undefined);
assert.equal(image.style.display, 'none');
assert.equal(fallback.hidden, false);

console.log('Slides rotativos de utilidade pública do Setembro Amarelo aprovados.');
