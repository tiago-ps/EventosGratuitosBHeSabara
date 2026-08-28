'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
const themesSource = fs.readFileSync(path.join(root, 'js/temas-visuais.js'), 'utf8');
const themesCss = fs.readFileSync(path.join(root, 'css/temas-visuais.css'), 'utf8');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const serviceWorkerSource = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');

function functionBody(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `Função ${name} ausente`);
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(open + 1, index);
  }
  assert.fail(`Corpo da função ${name} incompleto`);
}

// O vínculo é declarativo no tema; a configuração editorial permanece somente em app.js.
assert.match(themesSource, /id: 'agosto-lilas-glow',[\s\S]*panelProfile: 'agosto-lilas-2026'/);
assert.doesNotMatch(themesSource, /theme:\s*'agosto lilas'/);
assert.match(appSource, /'agosto-lilas-2026':\s*\{[\s\S]*theme: 'agosto lilas'/);

// O banner é um botão nativo, com estado, rótulo e tooltip sincronizados.
assert.match(themesSource, /document\.createElement\('button'\)/);
assert.match(themesSource, /banner\.type = 'button'/);
assert.match(themesSource, /banner\.setAttribute\('aria-pressed', String\(active\)\)/);
assert.match(themesSource, /Ativar perfil \$\{profileLabel\}/);
assert.match(themesSource, /Desativar perfil \$\{profileLabel\}/);
assert.match(themesSource, /new CustomEvent\('mural:panel-profile-request'/);
assert.doesNotMatch(themesSource, /if \(banner\.getAttribute\('aria-pressed'\) === 'true'\) return/);
assert.match(themesSource, /event\.key !== 'Enter' && event\.key !== ' '/);
assert.match(themesSource, /event\.preventDefault\(\);\s*togglePanelProfile\(\)/);

// A aplicação pelo banner e pelo compositor converge no mesmo caminho e reconstrói uma única vez.
const applyBody = functionBody(appSource, 'applyPanelSettingsAndRender');
assert.equal((applyBody.match(/rebuildVisibleItems\(\)/g) || []).length, 1);
assert.match(functionBody(appSource, 'applyEditorialPanelProfile'), /applyPanelSettingsAndRender\(profile\.settings\)/);
assert.match(functionBody(appSource, 'toggleEditorialPanelProfile'), /activeEditorialPanelProfileId\(\) === id/);
assert.match(functionBody(appSource, 'toggleEditorialPanelProfile'), /applyPanelSettingsAndRender\(defaultPanelSettings\(\)\)/);
assert.match(functionBody(appSource, 'toggleEditorialPanelProfile'), /applyEditorialPanelProfile\(id\)/);
assert.match(functionBody(appSource, 'applyFiltersFromPanel'), /applyPanelSettingsAndRender\(settings\)/);
assert.match(appSource, /new CustomEvent\('mural:panel-profile-change'/);
assert.match(appSource, /profileOptionValue\('editorial', activeProfile\)/);
assert.match(appSource, /window\.addEventListener\('mural:panel-profile-request',[\s\S]*toggleEditorialPanelProfile\(event\.detail\?\.profile\)/);

// O estado ativo usa somente um check verde; o foco continua visível e o tooltip depende de hover/foco.
assert.doesNotMatch(themesCss, /\.campaign-profile-banner\.is-profile-active\s*\{[\s\S]*outline:/);
assert.match(themesCss, /\.campaign-profile-check\s*\{[\s\S]*border: 0;[\s\S]*background: transparent;[\s\S]*color: #22c55e;/);
assert.match(themesCss, /\.campaign-profile-banner:focus-visible\s*\{[\s\S]*outline:/);
assert.match(themesCss, /\.campaign-profile-banner\.is-profile-active \.campaign-profile-check/);
assert.match(themesCss, /@media \(hover: hover\)[\s\S]*:hover \.campaign-profile-tooltip/);
assert.match(themesCss, /:focus-visible \.campaign-profile-tooltip/);

// O bump mínimo mantém HTML e precache apontando para os mesmos artefatos.
for (const asset of [
  'css/temas-visuais.css?v=3',
  'js/app.js?v=87',
  'js/temas-visuais.js?v=4'
]) {
  assert.ok(indexSource.includes(asset), `Referência ausente no HTML: ${asset}`);
  assert.ok(serviceWorkerSource.includes(`./${asset}`), `Referência ausente no precache: ${asset}`);
}

console.log('Testes do atalho de perfil pelo banner aprovados.');
