'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/conteudos/utilidade-publica.js'), 'utf8');
const preview = JSON.parse(fs.readFileSync(
  path.join(root, 'previews/utilidade-publica-salario-minimo.json'),
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
assert.equal(preview.preview, 'salario-minimo');
assert.equal(preview.itens.length, 2);

const comparison = preview.itens.find(item => item.visualizacao?.tipo === 'comparacao_barras');
const evolution = preview.itens.find(item => item.visualizacao?.tipo === 'linha');
assert.ok(comparison, 'Slide de comparação ausente');
assert.ok(evolution, 'Slide de evolução ausente');

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

const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
assert.match(app, /preview_utilidade/);
assert.match(app, /utilityContent\.createPanelSlide/);
assert.match(app, /utilityContent\.createAgendaCard/);

const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert.match(index, /css\/utilidade-publica\.css\?v=1/);
assert.match(index, /js\/conteudos\/utilidade-publica\.js\?v=1/);

console.log('Visualizações de salário mínimo em Utilidade Pública aprovadas.');
