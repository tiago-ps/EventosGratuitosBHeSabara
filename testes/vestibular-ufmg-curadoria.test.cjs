'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const payload = JSON.parse(fs.readFileSync(path.join(root, 'curadorias-site.json'), 'utf8'));
const appSource = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const themesSource = fs.readFileSync(path.join(root, 'js', 'temas-visuais.js'), 'utf8');

const curation = payload.curadorias.find(item => item.id === 'vestibular-ufmg-seriado-2026');
assert.ok(curation, 'Curadoria Vestibular UFMG ausente');
assert.equal(curation.tema, 'Vestibular UFMG');
assert.equal(curation.ativo_de, '2026-09-01');
assert.equal(curation.ativo_ate, '2026-12-13');
assert.equal(curation.complementos.livros.length, 4);
assert.equal(curation.complementos.filmes.length, 2);

const allItems = [...curation.complementos.livros, ...curation.complementos.filmes];
assert.equal(allItems.length, 6);
for (const item of allItems) {
  assert.ok(item.temas.includes('Vestibular UFMG'), `${item.titulo}: tema Vestibular UFMG ausente`);
  assert.equal(item.vestibular.instituicao, 'UFMG');
  assert.equal(item.vestibular.processo, 'Seriado UFMG');
  assert.equal(item.vestibular.ano_prova, 2026);
  assert.equal(item.vestibular.obrigatoria, true);
}

const txai = curation.complementos.filmes.find(item => item.titulo === 'Txai');
assert.ok(txai, 'Txai ausente');
assert.equal(txai.tipo_conteudo_real, 'album_musical');
assert.equal(txai.representacao_temporaria, 'filmes');
assert.ok(txai.generos.includes('Álbum musical'));

assert.match(appSource, /'vestibular-ufmg-seriado-2026':\s*\{[\s\S]*theme: 'vestibular ufmg'/);
assert.match(themesSource, /id: 'vestibular-ufmg',[\s\S]*panelProfile: 'vestibular-ufmg-seriado-2026'/);
assert.match(themesSource, /src: 'imagens\/curadorias\/vestibular-ufmg-banner\.png'/);

// Protege os perfis já existentes contra remoção acidental.
assert.match(appSource, /'agosto-lilas-2026':/);
assert.match(appSource, /'setembro-amarelo-2026':/);
assert.match(themesSource, /panelProfile: 'agosto-lilas-2026'/);
assert.match(themesSource, /panelProfile: 'setembro-amarelo-2026'/);

console.log('Curadoria Vestibular UFMG 2026 validada.');
