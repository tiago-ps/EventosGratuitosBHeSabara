'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/tema-visual-boot.js'), 'utf8');
const STORAGE_KEY = 'mural:visual-theme';
const MIGRATION_KEY = 'mural:visual-theme:migrated:agosto-setembro-2026';
const AUTO_KEY = 'mural:visual-theme:auto:setembro-2026';

function runAt(isoDate, initial = {}) {
  const values = new Map(Object.entries(initial));
  const RealDate = Date;
  class FixedDate extends RealDate {
    constructor(...args) {
      super(...(args.length ? args : [isoDate]));
    }
  }
  const document = { documentElement: { dataset: {} } };
  const localStorage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
  vm.runInNewContext(source, { Date: FixedDate, document, localStorage }, { filename: 'js/tema-visual-boot.js' });
  return { theme: document.documentElement.dataset.visualTheme, values };
}

assert.equal(runAt('2026-09-01T12:00:00-03:00').theme, 'setembro-amarelo-glow');
assert.equal(runAt('2026-09-30T12:00:00-03:00').theme, 'setembro-amarelo-glow');
assert.equal(runAt('2026-09-15T12:00:00-03:00', { [STORAGE_KEY]: 'padrao' }).theme, 'padrao');

const migrated = runAt('2026-09-15T12:00:00-03:00', { [STORAGE_KEY]: 'agosto-lilas-glow' });
assert.equal(migrated.theme, 'setembro-amarelo-glow');
assert.equal(migrated.values.get(MIGRATION_KEY), '1');
assert.equal(migrated.values.get(AUTO_KEY), '1');

assert.equal(runAt('2026-09-16T12:00:00-03:00', {
  [STORAGE_KEY]: 'agosto-lilas-glow', [MIGRATION_KEY]: '1'
}).theme, 'agosto-lilas-glow');

const afterCampaign = runAt('2026-10-01T12:00:00-03:00', {
  [STORAGE_KEY]: 'setembro-amarelo-glow', [MIGRATION_KEY]: '1', [AUTO_KEY]: '1'
});
assert.equal(afterCampaign.theme, 'padrao');
assert.equal(afterCampaign.values.has(STORAGE_KEY), false);
assert.equal(afterCampaign.values.has(AUTO_KEY), false);

assert.equal(runAt('2026-10-01T12:00:00-03:00', {
  [STORAGE_KEY]: 'setembro-amarelo-glow'
}).theme, 'setembro-amarelo-glow', 'Escolha manual permanece respeitada');
assert.equal(runAt('2026-10-01T12:00:00-03:00').theme, 'padrao');

console.log('Testes do padrão sazonal e da migração única Agosto → Setembro aprovados.');
