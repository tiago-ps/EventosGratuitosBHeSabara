'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('js/app.js', 'utf8');
const styles = fs.readFileSync('css/styles.css', 'utf8');
const panelNavigation = fs.readFileSync('js/painel-navegacao-modos.js', 'utf8');
const themeBoot = fs.readFileSync('js/tema-visual-boot.js', 'utf8');
const indexHtml = fs.readFileSync('index.html', 'utf8');
const serviceWorker = fs.readFileSync('service-worker.js', 'utf8');

const headerStart = app.indexOf('const agendaContentTabs = [');
const headerEnd = app.indexOf("const controls = document.createElement('section');", headerStart);
assert.ok(headerStart >= 0 && headerEnd > headerStart);
const header = app.slice(headerStart, headerEnd);

// A navegação por conteúdo permanece como elemento principal da barra.
assert.ok(header.includes('class="agenda-content-nav"'));
assert.ok(header.indexOf('class="agenda-content-nav"') < header.indexOf('class="agenda-header-actions"'));

// Somente ações rápidas ficam expostas permanentemente.
assert.ok(header.includes('agenda-favorites-toggle'));
assert.ok(header.includes('agenda-search-toggle'));
assert.ok(header.includes('agendaThemeToggleMarkup'));
assert.ok(header.includes('class="agenda-more-menu"'));
assert.ok(header.includes('class="agenda-more-toggle"'));
const moreMenuStart = header.indexOf('class="agenda-more-menu-list"');
const notificationsMarkup = header.indexOf('headerButtonMarkup');
assert.ok(moreMenuStart >= 0 && notificationsMarkup > moreMenuStart, 'Notificações deve ficar dentro do menu Mais');

// Ações secundárias ficam agrupadas no menu Mais.
for (const action of [
  'agenda-community-open agenda-more-menu-action',
  'headerButtonMarkup',
  'agenda-about-open agenda-more-menu-action',
  'agenda-share-favorites agenda-more-menu-action',
  'install-app-btn agenda-more-menu-action',
  'view-toggle agenda-more-menu-action'
]) {
  assert.ok(header.includes(action), `Ação não agrupada no menu Mais: ${action}`);
}

assert.ok(app.includes("const closeAgendaMoreMenu = () => header.querySelector('.agenda-more-menu')?.removeAttribute('open');"));
assert.ok(styles.includes('Agenda v164 — navegação prioritária e menu compacto de ações.'));
assert.ok(styles.includes('.agenda-more-menu-list'));
assert.ok(styles.includes('.agenda-more-menu-action'));
assert.ok(styles.includes('@media (max-width: 1280px)'));
assert.ok(styles.includes('@media (max-width: 900px)'));
assert.ok(styles.includes('Agenda v165 — Notificações dentro do menu Mais.'));
assert.ok(styles.includes('Agenda v166 — no mobile o menu Mais fica ancorado ao botão.'));
const mobileMenuRule = styles.match(/@media \(max-width: 900px\) \{[\s\S]*?\.agenda-more-menu-list \{([\s\S]*?)\n  \}/)?.[1] || '';
assert.ok(mobileMenuRule.includes('position: absolute;'));
assert.ok(mobileMenuRule.includes('top: calc(100% + 8px);'));
assert.ok(mobileMenuRule.includes('bottom: auto;'));
assert.ok(!mobileMenuRule.includes('position: fixed;'));
assert.ok(styles.includes('.agenda-notifications-label'));
assert.ok(styles.includes('.agenda-favorites-label'));

// Os dois modos de painel também pertencem ao mesmo menu.
assert.ok(panelNavigation.includes("const menuList = actions.querySelector('.agenda-more-menu-list');"));
assert.ok(panelNavigation.includes("'view-toggle passive-view-toggle agenda-more-menu-action'"));
assert.ok(panelNavigation.includes("button.closest('.agenda-more-menu')?.removeAttribute('open')"));
assert.ok(themeBoot.includes("js/painel-navegacao-modos.js?v=6"));

// Cache busting deve entregar os mesmos assets/versionamentos no HTML e no SW.
for (const asset of [
  'css/styles.css?v=106',
  'js/tema-visual-boot.js?v=17'
]) {
  assert.ok(indexHtml.includes(asset), `index sem ${asset}`);
  assert.ok(serviceWorker.includes(`./${asset}`), `service worker sem ${asset}`);
}
const appVersion = indexHtml.match(/js\/app\.js\?v=(\d+)/)?.[1];
assert.ok(appVersion, 'index sem versão de js/app.js');
assert.ok(serviceWorker.includes(`./js/app.js?v=${appVersion}`), 'service worker com versão divergente de js/app.js');
assert.ok(serviceWorker.includes("'./js/painel-navegacao-modos.js?v=6'"));
assert.match(serviceWorker, /const CACHE_VERSION = 'mural-cultural-v\d+-[^']+';/);

console.log('Cabeçalho compacto do modo Exploração validado.');
