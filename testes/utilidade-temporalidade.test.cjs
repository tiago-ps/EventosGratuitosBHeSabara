'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/conteudos/utilidade-publica.js'), 'utf8');
const context = vm.createContext({
  console,
  Intl,
  Date,
  URL,
  window: { MuralCultural: { contents: {} } }
});
vm.runInContext(source, context, { filename: 'js/conteudos/utilidade-publica.js' });

const utility = context.window.MuralCultural.contents.utility;
const reference = new Date('2026-10-07T12:00:00-03:00');
const base = {
  id: 'utilidade:teste',
  titulo: 'Teste',
  tipo_conteudo: 'utilidade_publica'
};

assert.equal(utility.isValid(base), true);
assert.equal(utility.isValid({ ...base, tipo_conteudo: 'evento' }), false);

// Referência estatística não é validade: competência antiga continua publicável.
assert.equal(utility.isTemporallyVisible({
  ...base,
  periodo_referencia: '2020-01',
  temporalidade: {
    classe: 'atemporal',
    referencia: [{ tipo: 'competencia', valor: '2020-01' }]
  }
}, reference), true);

// Fim só expira quando a política canônica manda expirar automaticamente.
assert.equal(utility.isTemporallyVisible({
  ...base,
  temporalidade: {
    classe: 'permanente',
    vigencia: { fim: '2026-10-06', expirar_automaticamente: true }
  }
}, reference), false);
assert.equal(utility.isTemporallyVisible({
  ...base,
  temporalidade: {
    classe: 'permanente',
    vigencia: { fim: '2026-10-06', expirar_automaticamente: false }
  }
}, reference), true);

// Uma vigência futura fica oculta, salvo quando a exibição editorial já começou.
assert.equal(utility.isTemporallyVisible({
  ...base,
  temporalidade: {
    classe: 'permanente',
    vigencia: { inicio: '2026-10-10', fim: '2026-10-31', expirar_automaticamente: true }
  }
}, reference), false);
assert.equal(utility.isTemporallyVisible({
  ...base,
  temporalidade: {
    classe: 'permanente',
    vigencia: { inicio: '2026-10-10', fim: '2026-10-31', expirar_automaticamente: true },
    exibicao: { inicio: '2026-10-05', ativa: true }
  }
}, reference), true);
assert.equal(utility.isTemporallyVisible({
  ...base,
  temporalidade: {
    classe: 'permanente',
    exibicao: { ativa: false }
  }
}, reference), false);

// Fallback legado permanece funcional durante a transição.
assert.equal(utility.isTemporallyVisible({
  ...base,
  vigencia: { fim: '2026-10-06', expirar_automaticamente: true }
}, reference), false);
assert.equal(utility.isTemporallyVisible({
  ...base,
  vigencia: { inicio: '2026-10-10', exibir_antes_dias: 5, expirar_automaticamente: false }
}, reference), true);
assert.equal(utility.isTemporallyVisible({
  ...base,
  vigencia: { inicio: '2026-10-20', exibir_antes_dias: 5, expirar_automaticamente: false }
}, reference), false);

const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
assert.match(app, /\.filter\(utilityContent\.isValid\)/);
assert.match(app, /\.filter\(item => utilityContent\.isTemporallyVisible\(item\)\)/);

console.log('ATC5.6: visibilidade temporal de Utilidade Pública validada.');
