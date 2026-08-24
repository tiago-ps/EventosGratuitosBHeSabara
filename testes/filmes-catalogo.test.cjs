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

assert.equal(data.filmes.length, 143);
assert.equal(data.filmes.filter(movie => !movie.imagem).length, 1);
assert.equal(data.filmes.filter(movie => !movie.ano).length, 2);
assert.equal(data.filmes.filter(movie => !movie.duracao_minutos).length, 13);
assert.equal(data.filmes.filter(movie => movie.classificacao === 'Não informada').length, 11);
assert.ok(data.filmes.every(movie => movie.status_manual === 'revisar'));
assert.ok(data.filmes.every(movie => movie.pagina_oficial === `https://flix.votelgbt.org/assistir/${movie.fonte_id}`));
assert.ok(data.filmes.every(movie => !Object.hasOwn(movie, 'video_embed')));
assert.equal(data.filmes.filter(movie => movie.video_plataforma === 'youtube').length, 119);
assert.equal(data.filmes.filter(movie => movie.video_plataforma === 'vimeo').length, 23);
assert.equal(data.filmes.filter(movie => movie.video_plataforma === 'nao_identificada').length, 1);

const roma = data.filmes.find(movie => movie.fonte_id === '009a05a4-7286-11ee-8835-0a58a9feac02');
assert.ok(roma);
assert.equal(films.queryMatches(roma, 'roma', normalizeText), true);
assert.equal(films.queryMatches(roma, 'marcos maia', normalizeText), true);
assert.equal(films.queryMatches(roma, 'religiao', normalizeText), true);
assert.equal(films.queryMatches(roma, 'QUESTÕES DE GÊNERO', normalizeText), true);

const combined = films.filter(data.filmes, {
  query: 'familia',
  genre: 'drama',
  theme: 'família',
  rating: '16',
  yearFrom: 2023,
  yearTo: 2023,
  duration: '31-60'
}, normalizeText);
assert.ok(combined.some(movie => movie.fonte_id === roma.fonte_id));
assert.ok(combined.every(movie => movie.classificacao === '16'));

const titleSorted = films.sort(data.filmes, 'title-asc');
assert.ok(titleSorted[0].titulo.localeCompare(titleSorted.at(-1).titulo, 'pt-BR') <= 0);
for (const [order, field, direction] of [
  ['year-asc', 'ano', 1], ['year-desc', 'ano', -1],
  ['duration-asc', 'duracao_minutos', 1], ['duration-desc', 'duracao_minutos', -1]
]) {
  const sorted = films.sort(data.filmes, order);
  const known = sorted.filter(movie => Number(movie[field]) > 0);
  const unknown = sorted.filter(movie => !Number(movie[field]));
  assert.ok(known.every((movie, index) => index === 0 ||
    (Number(movie[field]) - Number(known[index - 1][field])) * direction >= 0));
  assert.deepEqual(sorted.slice(-unknown.length).map(movie => movie.id), unknown.map(movie => movie.id));
}

const webps = fs.readdirSync(path.join(root, 'imagens/filmes')).filter(name => name.endsWith('.webp'));
assert.equal(webps.length, 142);
assert.ok(data.filmes.filter(movie => movie.imagem).every(movie => {
  const imagePath = path.join(root, movie.imagem);
  return fs.existsSync(imagePath) && movie.imagem_largura <= 800 && movie.imagem_altura <= 800;
}));

assert.match(indexSource, /js\/conteudos\/filmes\.js\?v=3/);
assert.doesNotMatch(indexSource, /filmes\.html/);
assert.match(appSource, /<option value="films">Filmes<\/option>/);
assert.match(appSource, /loadOptionalJson\(FILMS_URL, \{ filmes: \[\] \}\)/);
assert.match(appSource, /appendAgendaSection\(resultsContainer, 'Filmes gratuitos'/);
assert.match(source, /target="_blank" rel="noopener noreferrer"/);
assert.doesNotMatch(source, /<(?:iframe|video)\b/i);
assert.doesNotMatch(JSON.stringify(data), /youtube\.com\/embed|player\.vimeo\.com/i);
assert.match(swSource, /'\/filmes\.json'/);
assert.match(swSource, /'\.\/js\/conteudos\/filmes\.js\?v=3'/);
assert.match(stylesSource, /\.agenda-film-card \.film-media\{[^}]*aspect-ratio:16\/9/);
assert.match(stylesSource, /@media\(max-width:760px\)\{\.agenda-film-card\{display:flex;grid-template-columns:none;flex-direction:column/);
assert.match(stylesSource, /\.agenda-film-card \.film-media img\{[^}]*position:static;[^}]*object-fit:cover/);
assert.doesNotMatch(stylesSource, /\.agenda-film-card \.film-media\{[^}]*aspect-ratio:2\/3/);

for (const existing of ['eventos.json', 'livros.json', 'cursos.json', 'concursos.json']) {
  assert.ok(fs.existsSync(path.join(root, existing)), `${existing} deve continuar disponível`);
}

console.log('Testes do catálogo experimental de filmes aprovados.');
