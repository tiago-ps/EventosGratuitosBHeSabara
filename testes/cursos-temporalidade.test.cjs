'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/conteudos/cursos.js'), 'utf8');
const context = vm.createContext({
  console,
  Intl,
  Date,
  window: {
    MuralCultural: {
      contents: {},
      core: { sampleForPanel(items) { return items; } }
    }
  }
});
vm.runInContext(source, context, { filename: 'js/conteudos/cursos.js' });

const courses = context.window.MuralCultural.contents.courses;
const reference = new Date('2026-10-07T12:00:00-03:00');
const base = {
  id_fonte: 'curso-1',
  titulo: 'Curso de teste',
  exibicao_ativa: true
};

// Lançamento antigo e duração relativa não são validade.
assert.equal(courses.isPublishable({
  ...base,
  data_lancamento: '2020-01-01',
  prazo_conclusao_dias: '30',
  temporalidade: {
    classe: 'atemporal',
    referencia: [{ tipo: 'publicacao', valor: '2020-01-01' }]
  }
}, reference), true);

// Prazo absoluto canônico encerra a oferta somente depois da data final.
assert.equal(courses.isPublishable({
  ...base,
  temporalidade: {
    classe: 'atemporal',
    participacao: [{ tipo: 'acesso', fim: '2026-10-06' }]
  }
}, reference), false);
assert.equal(courses.isPublishable({
  ...base,
  temporalidade: {
    classe: 'atemporal',
    participacao: [{ tipo: 'acesso', fim: '2026-10-07' }]
  }
}, reference), true);

// Janela futura de acesso ainda não deve aparecer.
assert.equal(courses.isPublishable({
  ...base,
  temporalidade: {
    classe: 'atemporal',
    participacao: [{ tipo: 'acesso', inicio: '2026-10-08', fim: '2026-11-01' }]
  }
}, reference), false);

// Referências não substituem uma janela de participação.
assert.equal(courses.isPublishable({
  ...base,
  data_limite_conclusao: '2020-01-01',
  temporalidade: {
    classe: 'atemporal',
    referencia: [{ tipo: 'publicacao', valor: '2020-01-01' }]
  }
}, reference), true);

// Catálogo legado ainda respeita a data limite absoluta.
assert.equal(courses.isPublishable({
  ...base,
  data_limite_conclusao: '06/10/2026'
}, reference), false);
assert.equal(courses.isPublishable({
  ...base,
  data_limite_conclusao: '2027-01-31',
  prazo_conclusao_dias: '6'
}, reference), true);

assert.equal(courses.isPublishable({ ...base, exibicao_ativa: false }, reference), false);

const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
assert.match(app, /state\.allCourses = siteLayer\.cursos\s*\.filter\(coursesContent\.isPublishable\)/);

console.log('ATC5.7: visibilidade temporal de Cursos validada.');
