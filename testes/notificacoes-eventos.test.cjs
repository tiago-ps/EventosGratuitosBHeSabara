'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
const notifications = fs.readFileSync(path.join(root, 'js/notificacoes.js'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'cloudflare/social-preview-worker.js'), 'utf8');
const wrangler = JSON.parse(fs.readFileSync(path.join(root, 'wrangler.jsonc'), 'utf8'));
const schema = fs.readFileSync(path.join(root, 'cloudflare/notificacoes.sql'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

// Interface e favoritos
assert.match(html, /css\/notificacoes\.css\?v=\d+/);
assert.match(html, /js\/notificacoes\.js\?v=\d+/);
assert.match(app, /notificationsContent\?\.syncFavorites\?\.\(\[\.\.\.favorites\]\)/);
assert.match(app, /notificationsContent\?\.headerButtonMarkup\?\.\(\)/);
assert.match(app, /notificationsContent\?\.bindAgendaHeader\?\.\(header\)/);

// Preferências e favoritos ficam locais. O POST ao servidor contém apenas o
// endpoint técnico e a data do próximo sinal.
assert.match(notifications, /mural-cultural-notificacoes-v1/);
assert.match(notifications, /indexedDB\.open/);
assert.match(notifications, /body: JSON\.stringify\(\{\s*endpoint,\s*proximo_aviso:/);
assert.doesNotMatch(notifications, /body: JSON\.stringify\(\{[^}]*favorites/s);
assert.match(notifications, /nextReminderDate/);
assert.match(notifications, /Notification\.requestPermission/);

// Service Worker: o push recebido vira notificação visível e usa o catálogo
// público + favoritos locais para montar o texto.
assert.match(sw, /self\.addEventListener\('push'/);
assert.match(sw, /self\.registration\.showNotification/);
assert.match(sw, /self\.addEventListener\('notificationclick'/);
assert.match(sw, /self\.registration\.pushManager\.getSubscription/);
assert.match(sw, /swFavoriteEventsForReminder/);
assert.match(sw, /swUpdateServerSchedule/);
assert.match(sw, /\.\/eventos\.json/);

// Backend não guarda favoritos ou dados de perfil do visitante.
assert.match(worker, /NOTIFICATION_API_PATH = '\/api\/notificacoes'/);
assert.match(worker, /CREATE TABLE IF NOT EXISTS notificacoes_push/);
assert.match(worker, /proximo_aviso/);
assert.match(worker, /ensureVapidKeyPair/);
assert.match(worker, /sendDueNotifications/);
assert.match(worker, /async scheduled\(/);
assert.match(worker, /DELETE FROM notificacoes_push/);
const pushTable = schema.match(/CREATE TABLE IF NOT EXISTS notificacoes_push \([\s\S]*?\);/)?.[0] || '';
assert.ok(pushTable);
assert.doesNotMatch(pushTable, /favorit/i);
assert.doesNotMatch(pushTable, /user-agent/i);
assert.doesNotMatch(pushTable, /localiza[cç][aã]o/i);
assert.doesNotMatch(pushTable, /email/i);
assert.doesNotMatch(pushTable, /telefone/i);

// Evita transformar a API em proxy arbitrário: endpoints de push têm hosts
// conhecidos e HTTPS obrigatório.
assert.match(worker, /fcm\.googleapis\.com/);
assert.match(worker, /updates\.push\.services\.mozilla\.com/);
assert.match(worker, /web\.push\.apple\.com/);
assert.match(worker, /notify\.windows\.com/);
assert.match(worker, /url\.protocol !== 'https:'/);

// Disparo diário, sem rastreamento periódico.
assert.deepEqual(wrangler.triggers?.crons, ['0 12 * * *']);

console.log('Notificações de eventos validadas com preferências locais e Web Push mínimo.');
