'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/conteudos/utilidade-publica.js'), 'utf8');
const catalog = JSON.parse(fs.readFileSync(
  path.join(root, 'utilidade-publica.json'),
  'utf8'
));

const context = vm.createContext({
  console,
  Intl,
  URL,
  window: { MuralCultural: { contents: {} } }
});

vm.runInContext(source, context, { filename: 'js/conteudos/utilidade-publica.js' });

const utility = context.window.MuralCultural.contents.utility;
assert.equal(typeof utility.visualizationModel, 'function');
assert.equal(catalog.itens.length, 9);

const comparison = catalog.itens.find(item => item.id === 'utilidade:salario-minimo:comparacao-dieese');
const evolution = catalog.itens.find(item => item.id === 'utilidade:salario-minimo:evolucao-dieese');
const ipeadComparison = catalog.itens.find(item => item.id === 'utilidade:salario-minimo:cesta-basica-bh-ipead');
const ipeadEvolution = catalog.itens.find(item => item.id === 'utilidade:salario-minimo:evolucao-cesta-basica-bh-ipead');
assert.ok(comparison, 'Slide de comparação ausente');
assert.ok(evolution, 'Slide de evolução ausente');
assert.ok(ipeadComparison, 'Slide de cesta básica IPEAD ausente');
assert.ok(ipeadEvolution, 'Slide de evolução da cesta IPEAD ausente');

const bars = utility.visualizationModel(comparison);
assert.equal(bars.type, 'comparacao_barras');
assert.equal(bars.periodLabel, 'ago/2026');
assert.equal(bars.items.length, 2);
assert.equal(bars.items[0].value, 1621);
assert.equal(bars.items[1].value, 7565.86);
assert.equal(bars.multiplier, 4.67);
assert.equal(bars.difference, 5944.86);
assert.ok(bars.items[0].ratio > 0.21 && bars.items[0].ratio < 0.22);
assert.equal(bars.items[1].ratio, 1);

const line = utility.visualizationModel(evolution);
assert.equal(line.type, 'linha');
assert.equal(line.rows.length, 20);
assert.equal(line.rows[0].periodo, '2025-01');
assert.equal(line.rows.at(-1).periodo, '2026-08');
assert.equal(line.firstPeriodLabel, 'jan/2025');
assert.equal(line.lastPeriodLabel, 'ago/2026');
assert.equal(line.latestValues.length, 2);
assert.equal(line.latestValues[0].value, 1621);
assert.equal(line.latestValues[1].value, 7565.86);
assert.ok(line.maxValue >= 8110.92);

const ipeadBars = utility.visualizationModel(ipeadComparison);
assert.equal(ipeadBars.type, 'comparacao_barras');
assert.equal(ipeadBars.items[0].value, 1621);
assert.equal(ipeadBars.items[1].value, 757.19);
assert.equal(ipeadBars.summary.value, 46.71);
assert.equal(ipeadBars.summary.formatted, '46,71%');
assert.equal(ipeadBars.summary.label, 'do salário mínimo');

const ipeadLine = utility.visualizationModel(ipeadEvolution);
assert.equal(ipeadLine.type, 'linha');
assert.equal(ipeadLine.rows.length, 13);
assert.equal(ipeadLine.rows[0].periodo, '2025-08');
assert.equal(ipeadLine.rows.at(-1).periodo, '2026-08');
assert.equal(ipeadLine.latestValues.length, 1);
assert.equal(ipeadLine.latestValues[0].value, 757.19);
assert.ok(ipeadLine.maxValue >= 800.76);

const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
assert.doesNotMatch(app, /preview_utilidade|UTILITY_PREVIEW_URL|utilityPreviewId|previewUtility/);
assert.match(app, /utilityContent\.createPanelSlide/);
assert.match(app, /utilityContent\.createAgendaCard/);

const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert.match(index, /css\/utilidade-publica\.css\?v=2/);
assert.match(index, /js\/conteudos\/utilidade-publica\.js\?v=3/);
assert.match(index, /js\/app\.js\?v=110/);

const utilitySource = fs.readFileSync(path.join(root, 'js/conteudos/utilidade-publica.js'), 'utf8');
assert.match(utilitySource, /helpers\.safeImageUrl\(item\.imagem\)/);
assert.match(utilitySource, /utility-agenda-media--image/);
const utilityCss = fs.readFileSync(path.join(root, 'css/utilidade-publica.css'), 'utf8');
assert.match(utilityCss, /\.utility-data-slide \.details\[hidden\]/);
assert.match(utilityCss, /max-height: 840px/);

console.log('Utilidade Pública integrada ao catálogo normal com visualizações aprovadas.');
