'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const context = vm.createContext({ Intl, Date, console });
vm.runInContext(
  fs.readFileSync(path.join(root, 'js/temporalidade-eventos.js'), 'utf8'),
  context,
  { filename: 'js/temporalidade-eventos.js' }
);

const temporal = context.MuralCultural.eventTemporal;
const reference = new Date('2026-10-06T12:00:00-03:00');

const permanent = {
  id: 'permanente',
  data: '2026-01-01',
  data_fim: '2026-12-31',
  temporalidade: {
    classe: 'permanente',
    exibicao: { ativa: true }
  }
};

assert.equal(temporal.temporalClass(permanent), 'permanente');
assert.deepEqual(
  JSON.parse(JSON.stringify(temporal.realization(permanent))),
  { classe: 'permanente', inicio: '', fim: '', observacao: '', canonica: true }
);
assert.equal(temporal.isPublishable(permanent, new Date('2027-02-01T12:00:00-03:00')), true);
assert.equal(temporal.isCurrent(permanent, new Date('2027-02-01T12:00:00-03:00')), true);
assert.equal(temporal.reminderBaseDate(permanent), '');
assert.equal(
  temporal.intersectsPeriod(
    permanent,
    new Date('2026-10-06T00:00:00-03:00'),
    new Date('2026-10-12T23:59:59-03:00')
  ),
  false,
  'Conteúdo permanente não deve fingir ocorrência em um filtro de período.'
);

const canonicalPeriod = {
  data: '1999-01-01',
  data_fim: '1999-12-31',
  temporalidade: {
    classe: 'periodo',
    realizacao: {
      inicio: '2026-10-20',
      fim: '2026-10-22'
    }
  }
};
assert.deepEqual(
  JSON.parse(JSON.stringify(temporal.realization(canonicalPeriod))),
  {
    classe: 'periodo',
    inicio: '2026-10-20',
    fim: '2026-10-22',
    observacao: '',
    canonica: true
  },
  'Realização canônica deve prevalecer sobre datas legadas conflitantes.'
);
assert.equal(temporal.isPublishable(canonicalPeriod, reference), true);
assert.equal(temporal.reminderBaseDate(canonicalPeriod), '2026-10-20');

const registration = {
  data: '2026-12-01',
  data_fim: '2026-12-20',
  criterio_exibicao: 'inscricao',
  temporalidade: {
    classe: 'periodo',
    realizacao: {
      inicio: '2026-12-01',
      fim: '2026-12-20'
    },
    participacao: [{
      tipo: 'inscricao',
      inicio: '2026-09-01',
      fim: '2026-10-05',
      status: 'aberta'
    }]
  }
};
assert.equal(temporal.isPublishable(registration, reference), false);
assert.equal(temporal.participation(registration, 'inscricao').fim, '2026-10-05');

const legacy = {
  data: '2026-10-10',
  data_fim: '2026-10-12',
  criterio_exibicao: 'realizacao'
};
assert.equal(temporal.temporalClass(legacy), 'periodo');
assert.equal(temporal.realization(legacy).canonica, false);
assert.equal(temporal.isPublishable(legacy, reference), true);

const endedLegacy = {
  data: '2026-09-01',
  data_fim: '2026-10-05'
};
assert.equal(temporal.isPublishable(endedLegacy, reference), false);

const appSource = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
const curationSource = fs.readFileSync(path.join(root, 'js/curadorias-site.js'), 'utf8');
const manualSource = fs.readFileSync(path.join(root, 'js/eventos-manuais-ui.js'), 'utf8');
const workerSource = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

assert.ok(appSource.includes('const eventTemporal = window.MuralCultural.eventTemporal'));
assert.ok(appSource.includes('eventTemporal?.isPublishable'));
assert.ok(appSource.includes("label.textContent = realization.classe === 'atemporal' ? 'Disponível continuamente' : 'Permanente'"));
assert.ok(curationSource.includes('eventTemporal?.isCurrent'));
assert.ok(manualSource.includes('eventTemporal?.realization'));
assert.ok(workerSource.includes("importScripts('./js/temporalidade-eventos.js?v=1')"));
assert.ok(workerSource.includes('SW_EVENT_TEMPORAL?.reminderBaseDate'));
assert.ok(indexSource.includes('js/temporalidade-eventos.js?v=1'));

const appVersion = indexSource.match(/js\/app\.js\?v=(\d+)/)?.[1];
assert.ok(appVersion);
assert.ok(workerSource.includes(`./js/app.js?v=${appVersion}`));
assert.ok(workerSource.includes('mural-cultural-v205-atalho-experimentais-teste'));

console.log('ATC5.5: consumo temporal de Eventos validado.');
