'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/curadorias-site.js'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');

const documentStub = {
  addEventListener() {},
  getElementById() { return null; },
  querySelector() { return null; }
};
const windowStub = {
  location: { href: 'https://example.test/' },
  addEventListener() {},
  dispatchEvent() {}
};
const context = vm.createContext({
  window: windowStub,
  document: documentStub,
  navigator: {},
  history: { state: null, replaceState() {} },
  URL,
  console,
  queueMicrotask() {}
});
vm.runInContext(source, context, { filename: 'js/curadorias-site.js' });

const curations = context.window.MuralCultural.siteCurations;
const contestId = 'pci:noticia:concurso-curadoria-teste';
const catalogs = {
  eventos: [],
  livros: [],
  cursos: [],
  filmes: [],
  utilidade_publica: [],
  concursos: [{
    id: contestId,
    titulo: 'Concurso de teste',
    url: 'https://www.pciconcursos.com.br/noticias/concurso-curadoria-teste'
  }]
};
const snapshot = JSON.stringify(catalogs);
const payload = {
  schema: 1,
  escopo: 'site-only',
  curadorias: [{
    id: 'curadoria-concurso',
    permanente: true,
    membros: { concursos: [contestId] }
  }]
};

const merged = curations.apply(payload, catalogs, { warn() {} });

assert.equal(merged.concursos.length, 1);
assert.deepEqual(Array.from(merged.concursos[0].curadoria_ids), ['curadoria-concurso']);
assert.equal(
  curations.matchesCuration(merged.concursos[0], payload.curadorias[0]),
  true
);
assert.equal(
  JSON.stringify(catalogs),
  snapshot,
  'Membership de Concurso não pode mutar o catálogo central'
);

const ausenteWarnings = [];
const ausente = curations.apply({
  schema: 1,
  escopo: 'site-only',
  curadorias: [{
    id: 'curadoria-concurso',
    permanente: true,
    membros: { concursos: ['pci:noticia:ausente'] }
  }]
}, catalogs, { warn: message => ausenteWarnings.push(message) });
assert.equal(ausente.concursos[0].curadoria_ids.length, 0);
assert.ok(ausenteWarnings.some(message => message.includes('não encontrado no catálogo canônico')));

assert.match(source, /concursos:\s*'id'/);
assert.match(source, /concursos:\s*\(Array\.isArray\(catalogs\.concursos\)/);
assert.match(appSource, /concursos:\s*state\.contestsData\.concursos/);
assert.match(appSource, /state\.allContests\s*=\s*\(siteLayer\.concursos\s*\|\|\s*\[\]\)/);

console.log('Curadorias de Concursos: membership canônico e integração do runtime aprovados.');
