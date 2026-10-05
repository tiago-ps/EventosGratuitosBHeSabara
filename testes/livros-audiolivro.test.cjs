'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
const swSource = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');

assert.match(indexSource, /class="book-audiobook-link"/);
assert.match(indexSource, /js\/app\.js\?v=146/);

assert.match(appSource, /function bookAudiobookUrl\(book\)/);
assert.match(appSource, /function bookAudiobookLabel\(book\)/);
assert.match(appSource, /book\?\.link_audiolivro/);
assert.match(appSource, /book\?\.audiolivro_fonte/);
assert.match(appSource, /copy\.querySelector\('\.book-audiobook-link'\)/);
assert.match(appSource, /audiobookLink\.href = audiobookUrl/);
assert.match(appSource, /audiobookUrl \? '<span>Audiolivro<\/span>'/);
assert.match(appSource, /escapeHtml\(audiobookLabel\)/);

assert.match(swSource, /\.\/js\/app\.js\?v=146/);
assert.doesNotMatch(swSource, /\.\/js\/app\.js\?v=145/);

console.log('Testes de audiolivro em Livros aprovados.');
