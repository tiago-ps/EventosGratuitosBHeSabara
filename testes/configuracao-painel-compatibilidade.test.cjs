'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
const config = JSON.parse(
  fs.readFileSync(path.join(root, 'configuracao-mural.json'), 'utf8')
);

assert.deepEqual(config.modulos, {
  eventos: true,
  livros: true
});
assert.equal(config.painel, undefined, 'A configuração enxuta do publicador central deve continuar válida.');

// O registro central é a fonte de verdade dos módulos. Todo módulo registrado
// herda "ativo" quando não existe um false explícito no perfil ou config.
assert.match(appSource, /const PANEL_MODULE_CONFIG_KEYS = Object\.freeze\(\{/);
for (const [id, configKey] of [
  ['events', 'eventos'],
  ['books', 'livros'],
  ['courses', 'cursos'],
  ['contests', 'concursos'],
  ['films', 'filmes'],
  ['utility', 'utilidade_publica'],
  ['activities', 'atividades_lazer']
]) {
  assert.match(appSource, new RegExp(`${id}: '${configKey}'`));
}
assert.match(
  appSource,
  /panelModules: Object\.fromEntries\(PANEL_MODULE_IDS\.map\(id => \[id, true\]\)\)/
);
assert.match(
  appSource,
  /panelValue !== undefined \? Boolean\(panelValue\) : globalValue !== false/
);
assert.match(
  appSource,
  /modules\[id\] !== undefined \? Boolean\(modules\[id\]\) : defaults\.modules\[id\]/
);
assert.match(
  appSource,
  /PANEL_NON_EVENT_MODULE_IDS = Object\.freeze/
);

// A programação padrão não depende de pesos absolutos por tipo: o número de
// vagas deriva dos eventos e o núcleo equilibra todos os não-eventos.
assert.match(appSource, /const PANEL_EVENTS_PER_OTHER = 4;/);
assert.match(appSource, /Math\.ceil\(events\.length \/ PANEL_EVENTS_PER_OTHER\)/);
assert.match(appSource, /eventsPerOther: PANEL_EVENTS_PER_OTHER/);
assert.match(appSource, /const customComposition = Boolean\(state\.filters\.theme \|\| activeEditorialPanelProfileId\(\)\)/);

// Uma escolha explícita do usuário continua sendo lida e persistida.
assert.match(appSource, /const contestsEnabled = Boolean\(slide\.querySelector\('\.panel-module-contests'\)\?\.checked\)/);
assert.match(appSource, /contests: contestsEnabled/);
assert.match(appSource, /localStorage\.setItem\(PANEL_SETTINGS_KEY, JSON\.stringify\(value\)\)/);
assert.match(appSource, /mural-cultural-configuracao-painel-v2/);
assert.match(
  appSource,
  /if \(!stored\) \{\s*defaults\.slideDuration = storedSlideDuration\(\);\s*applyPanelSettings\(defaults, false\);/
);

const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert.match(indexSource, /class="panel-module-contests"/);
assert.match(indexSource, /class="panel-module-activities" type="checkbox" checked/);
assert.match(indexSource, /class="panel-module-utility" type="checkbox" checked/);

console.log('Testes de compatibilidade das configurações do Painel aprovados.');
