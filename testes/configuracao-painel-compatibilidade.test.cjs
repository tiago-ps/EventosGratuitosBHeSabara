'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
const config = JSON.parse(
  fs.readFileSync(path.join(root, 'configuracao-mural.json'), 'utf8')
);

assert.deepEqual(config.painel.modulos_ativos, {
  eventos: true,
  livros: true,
  cursos: false,
  concursos: false
});
assert.equal(config.painel.frequencia.concursos, 1);

// Configurações/perfis antigos não possuem `modules.contests`. O contrato
// real deve herdar o padrão global somente quando a propriedade está ausente.
assert.match(
  appSource,
  /contests: modules\.contests !== undefined \? Boolean\(modules\.contests\) : defaults\.modules\.contests/
);
assert.match(
  appSource,
  /contests: clampWeight\(weights\.contests \?\? defaults\.weights\.contests\)/
);

// Uma escolha explícita do usuário deve ser lida do compositor e persistida
// junto das demais configurações normalizadas.
assert.match(appSource, /const contestsEnabled = Boolean\(slide\.querySelector\('\.panel-module-contests'\)\?\.checked\)/);
assert.match(appSource, /contests: contestsEnabled/);
assert.match(appSource, /localStorage\.setItem\(PANEL_SETTINGS_KEY, JSON\.stringify\(value\)\)/);

const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert.match(indexSource, /class="panel-module-contests"/);
assert.match(indexSource, /class="panel-contest-weight"/);

console.log('Testes de compatibilidade das configurações do Painel aprovados.');
