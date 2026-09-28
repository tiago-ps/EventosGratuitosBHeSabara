'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'atividades-lazer.json'), 'utf8'));
assert.ok(Array.isArray(catalog.atividades));
assert.ok(catalog.atividades.length >= 10);
assert.ok(catalog.atividades.every(item => item.tipo_conteudo === 'atividade_lazer'));
assert.ok(catalog.atividades.every(item => item.gratuito === true));

const context = vm.createContext({ window: { MuralCultural: { contents: {} } } });
const source = fs.readFileSync(path.join(root, 'js/conteudos/atividades-lazer.js'), 'utf8');
vm.runInContext(source, context, { filename: 'js/conteudos/atividades-lazer.js' });
const activities = context.window.MuralCultural.contents.activities;
assert.equal(typeof activities.filter, 'function');
assert.equal(typeof activities.createAgendaCard, 'function');
assert.equal(typeof activities.createPanelSlide, 'function');
assert.equal(typeof activities.mapUrl, 'function');

assert.match(source, /image\.classList\.add\('loaded'\)/);
assert.match(source, /image\.classList\.remove\('loaded'\)/);
assert.match(source, /image\.complete/);
assert.match(source, /image\.naturalWidth > 0/);

const normalizeText = value => String(value || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

const betim = activities.filter(catalog.atividades, { city: 'betim' }, normalizeText);
assert.ok(betim.length >= 2);
assert.ok(betim.every(item => activities.city(item) === 'Betim'));

const taiChi = activities.filter(catalog.atividades, { query: 'tai chi' }, normalizeText);
assert.ok(taiChi.some(item => /tai chi/i.test(item.titulo)));

const park = catalog.atividades.find(item => item.id === 'atividade:pbh:tai-chi-parque-municipal');
assert.ok(park);
const safeExternalUrl = value => /^https?:\/\//.test(String(value || '')) ? String(value) : '';
const automaticMap = activities.mapUrl(park, { safeExternalUrl });
assert.match(automaticMap, /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/);
assert.ok(automaticMap.includes(encodeURIComponent('Avenida Afonso Pena, 1377')));
const manualMap = 'https://maps.app.goo.gl/exemplo';
assert.equal(activities.mapUrl({ ...park, mapa: manualMap }, { safeExternalUrl }), manualMap);

const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
assert.match(app, /ACTIVITIES_URL = 'atividades-lazer\.json'/);
assert.match(app, /tipo_conteudo === 'atividade_lazer'/);
assert.match(app, /\['activities', 'Esporte e Lazer'\]/);
assert.match(app, /agenda-activity-city/);
assert.match(app, /state\.allActivities/);
assert.match(app, /panelModules: \{[^\n]*activities: false/);
assert.match(app, /panelWeights: \{[^\n]*activities: 1/);
assert.match(app, /activitiesEnabled = state\.panelModules\.activities/);
assert.match(app, /renderActivitySlide/);
assert.match(app, /item\.tipo_conteudo === 'atividade_lazer'\) renderActivitySlide/);
assert.match(app, /panel-module-activities/);
assert.match(app, /panel-activity-weight/);

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert.match(html, /js\/conteudos\/atividades-lazer\.js\?v=4/);
assert.match(html, /panel-module-activities/);
assert.match(html, /<span>Esporte e Lazer<\/span>/);
assert.match(html, /panel-activity-section/);
assert.match(html, /panel-activity-weight/);
assert.match(html, /css\/atividades-lazer\.css\?v=1/);

const sw = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
assert.match(sw, /'\/atividades-lazer\.json'/);
assert.match(sw, /js\/conteudos\/atividades-lazer\.js\?v=4/);
assert.match(sw, /js\/app\.js\?v=125/);

console.log('Esporte e Lazer integrado à Agenda e ao Painel com endereço, Google Maps, catálogo, filtros, perfis e cache.');
