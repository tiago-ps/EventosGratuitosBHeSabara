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
const expectedImages = new Map([
  ['São Bernardo', 'imagens/curadorias/vestibular-ufmg/sao-bernardo.png'],
  ['Sobrevivendo ao racismo: memórias, cartas e o cotidiano da discriminação no Brasil', 'imagens/curadorias/vestibular-ufmg/sobrevivendo-ao-racismo.png'],
  ['O quinze', 'imagens/curadorias/vestibular-ufmg/o-quinze.png'],
  ['Ideias para adiar o fim do mundo', 'imagens/curadorias/vestibular-ufmg/ideias-para-adiar-o-fim-do-mundo.png'],
  ['Balé de Pé no Chão — a dança afro de Mercedes Baptista', 'imagens/curadorias/vestibular-ufmg/bale-de-pe-no-chao.png'],
  ['Txai', 'imagens/curadorias/vestibular-ufmg/txai.png'],
]);

for (const item of allItems) {
  assert.ok(item.temas.includes('Vestibular UFMG'), `${item.titulo}: tema Vestibular UFMG ausente`);
  assert.equal(item.vestibular.instituicao, 'UFMG');
  assert.equal(item.vestibular.processo, 'Seriado UFMG');
  assert.equal(item.vestibular.ano_prova, 2026);
  assert.equal(item.vestibular.obrigatoria, true);
  assert.equal(item.imagem, expectedImages.get(item.titulo), `${item.titulo}: caminho de imagem inesperado`);
}

const books = new Map(curation.complementos.livros.map(item => [item.titulo, item]));
assert.equal(books.get('São Bernardo').acervos.length, 6);
assert.ok(books.get('São Bernardo').bibliotecas.includes('FMC-PBH'));
assert.ok(books.get('São Bernardo').bibliotecas.includes('Biblioteca Pública Estadual de Minas Gerais'));
assert.ok(books.get('São Bernardo').bibliotecas.includes('BibliON'));
assert.ok(books.get('São Bernardo').bibliotecas.includes('MEC Livros'));
assert.equal(books.get('Sobrevivendo ao racismo: memórias, cartas e o cotidiano da discriminação no Brasil').acervos.length, 2);
assert.equal(books.get('O quinze').acervos.length, 3);
assert.equal(books.get('Ideias para adiar o fim do mundo').acervos.length, 3);

const txai = curation.complementos.filmes.find(item => item.titulo === 'Txai');
assert.ok(txai, 'Txai ausente');
assert.equal(txai.tipo_conteudo_real, 'album_musical');
assert.equal(txai.representacao_temporaria, 'filmes');
assert.ok(txai.generos.includes('Álbum musical'));
assert.equal(txai.link, 'https://open.spotify.com/intl-pt/album/37EITqrt8brFFMNvVDQmrR');

assert.match(appSource, /'vestibular-ufmg-seriado-2026':\s*\{[\s\S]*theme: 'vestibular ufmg'/);
assert.match(themesSource, /id: 'vestibular-ufmg',[\s\S]*panelProfile: 'vestibular-ufmg-seriado-2026'/);
assert.match(themesSource, /src: 'imagens\/curadorias\/vestibular-ufmg-banner\.png'/);

// Protege os perfis já existentes contra remoção acidental.
assert.match(appSource, /'agosto-lilas-2026':/);
assert.match(appSource, /'setembro-amarelo-2026':/);
assert.match(themesSource, /panelProfile: 'agosto-lilas-2026'/);
assert.match(themesSource, /panelProfile: 'setembro-amarelo-2026'/);

// Links corrigidos e protegidos por regressão.
const baleLinkCheck = curation.complementos.filmes.find(item => item.id === 'site:vestibular-ufmg:bale-de-pe-no-chao');
assert.ok(baleLinkCheck, 'Balé de Pé no Chão ausente');
assert.equal(baleLinkCheck.plataforma, 'YouTube');
assert.equal(baleLinkCheck.link, 'https://www.youtube.com/watch?v=x9CMU4aayjU');
assert.equal(baleLinkCheck.pagina_oficial, 'https://www.youtube.com/watch?v=x9CMU4aayjU');

const quinzeLinkCheck = curation.complementos.livros.find(item => item.id === 'site:vestibular-ufmg:o-quinze');
assert.ok(quinzeLinkCheck, 'O quinze ausente');
const quinzeUrls = quinzeLinkCheck.acervos.flatMap(acervo => acervo.registros || []).map(registro => registro.link || registro.link_fisico || registro.link_virtual || '');
assert.ok(quinzeUrls.includes('https://pergamum.ifmg.edu.br/pesquisa_avancada?q=quinze&for=TITULO&condition=AND&q2=queiroz&for2=AUTOR&tipo_obra=49%252C&keyword_type=P&cr=N&orderBy=obra&direction=C'), 'Link avançado do IFMG para O quinze ausente');
assert.ok(quinzeUrls.includes('https://bibliotecasfmc.pbh.gov.br/pesquisa_avancada?q=quinze&for=TITULO&condition=AND&q2=queiroz&for2=AUTOR&keyword_type=P&cr=N&orderBy=obra&direction=C'), 'Link avançado da FMC-PBH para O quinze ausente');
assert.ok(quinzeUrls.includes('http://200.198.28.214/pesquisa_avancada?for=TITULO&q=quinze&condition=AND&for2=AUTOR&q2=queiroz&keyword_type=P'), 'Link avançado da BPEMG para O quinze ausente');

console.log('Curadoria Vestibular UFMG 2026 validada.');
