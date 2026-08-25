'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'filmes.json'), 'utf8'));
const source = fs.readFileSync(path.join(root, 'js/conteudos/filmes.js'), 'utf8');
const stylesSource = fs.readFileSync(path.join(root, 'css/styles.css'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const swSource = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const context = vm.createContext({ window: {} });
vm.runInContext(source, context, { filename: 'js/conteudos/filmes.js' });
const films = context.window.MuralCultural.contents.films;
const normalizeText = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

assert.equal(data.schema_versao, 1);
assert.ok(Array.isArray(data.filmes));
assert.ok(data.filmes.length > 0);
assert.ok(data.filmes.every(movie => movie.id && movie.fonte_id && movie.titulo));
assert.ok(data.filmes.every(movie => movie.status_manual === 'revisar'));
assert.ok(data.filmes.every(movie => /^https:\/\//.test(String(movie.pagina_oficial || ''))));
assert.ok(data.filmes.every(movie => !Object.hasOwn(movie, 'video_embed')));
assert.ok(data.filmes.every(movie => movie.plataforma));

for (const movie of data.filmes) {
  if (!movie.imagem) continue;
  if (/^https:\/\//.test(movie.imagem)) continue;
  const imagePath = path.join(root, movie.imagem);
  assert.ok(fs.existsSync(imagePath), `Imagem local ausente: ${movie.imagem}`);
  if (movie.imagem_largura) assert.ok(movie.imagem_largura <= 800);
  if (movie.imagem_altura) assert.ok(movie.imagem_altura <= 800);
}

const searchable = data.filmes.find(movie => movie.titulo && (movie.sinopse || movie.direcao?.length || movie.generos?.length));
assert.ok(searchable);
assert.equal(films.queryMatches(searchable, searchable.titulo, normalizeText), true);
if (searchable.direcao?.length) {
  assert.equal(films.queryMatches(searchable, searchable.direcao[0], normalizeText), true);
}
if (searchable.generos?.length) {
  assert.equal(films.queryMatches(searchable, searchable.generos[0], normalizeText), true);
}
assert.equal(films.queryMatches(searchable, searchable.plataforma, normalizeText), true);
assert.equal(films.platformName(searchable), searchable.plataforma);
assert.equal(films.platformName({}), 'plataforma oficial');

const titleSorted = films.sort(data.filmes, 'title-asc');
assert.equal(titleSorted.length, data.filmes.length);
assert.ok(titleSorted[0].titulo.localeCompare(titleSorted.at(-1).titulo, 'pt-BR') <= 0);
for (const [order, field, direction] of [
  ['year-asc', 'ano', 1], ['year-desc', 'ano', -1],
  ['duration-asc', 'duracao_minutos', 1], ['duration-desc', 'duracao_minutos', -1]
]) {
  const sorted = films.sort(data.filmes, order);
  const known = sorted.filter(movie => Number(movie[field]) > 0);
  for (let index = 1; index < known.length; index += 1) {
    assert.ok((Number(known[index][field]) - Number(known[index - 1][field])) * direction >= 0);
  }
  const firstUnknown = sorted.findIndex(movie => !Number(movie[field]));
  if (firstUnknown >= 0) {
    assert.ok(sorted.slice(firstUnknown).every(movie => !Number(movie[field])));
  }
}

assert.match(indexSource, /js\/conteudos\/filmes\.js\?v=5/);
assert.doesNotMatch(indexSource, /filmes\.html/);
assert.match(appSource, /<option value="films">Filmes<\/option>/);
assert.match(appSource, /loadOptionalJson\(FILMS_URL, \{ filmes: \[\] \}\)/);
assert.match(appSource, /appendAgendaSection\(resultsContainer, 'Filmes gratuitos'/);
assert.match(source, /platformName/);
assert.equal(typeof films.createPanelSlide, 'function');
assert.equal(typeof films.sampleForPanel, 'function');
assert.match(indexSource, /panel-module-films/);
assert.match(indexSource, /panel-film-section/);
assert.match(appSource, /renderFilmSlide/);
assert.match(appSource, /panel-film-weight/);
assert.match(appSource, /tipo_conteudo === 'filme'/);
assert.match(source, /Acessar na plataforma/);
assert.match(source, /target="_blank" rel="noopener noreferrer"/);
assert.doesNotMatch(source, /Filme gratuito no LGBTFlix/);
assert.doesNotMatch(source, /Assistir gratuitamente no LGBTFlix/);
assert.doesNotMatch(source, /<(?:iframe|video)\b/i);
assert.doesNotMatch(JSON.stringify(data), /youtube\.com\/embed|player\.vimeo\.com/i);
assert.match(swSource, /'\/filmes\.json'/);
assert.match(swSource, /'\.\/js\/conteudos\/filmes\.js\?v=5'/);
assert.match(stylesSource, /\.agenda-film-card \.film-media\{[^}]*aspect-ratio:16\/9/);
assert.match(stylesSource, /@media\(max-width:760px\)\{\.agenda-film-card\{display:flex;grid-template-columns:none;flex-direction:column/);
assert.match(stylesSource, /\.agenda-film-card \.film-media img\{[^}]*position:static;[^}]*object-fit:cover/);
assert.doesNotMatch(stylesSource, /\.agenda-film-card \.film-media\{[^}]*aspect-ratio:2\/3/);

for (const existing of ['eventos.json', 'livros.json', 'cursos.json', 'concursos.json']) {
  assert.ok(fs.existsSync(path.join(root, existing)), `${existing} deve continuar disponível`);
}

console.log(`Testes do catálogo de filmes aprovados (${data.filmes.length} registros, fonte: ${data.fonte || 'múltiplas'}).`);
