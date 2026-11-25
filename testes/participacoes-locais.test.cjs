const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const people = JSON.parse(fs.readFileSync(path.join(root, 'pessoas.json'), 'utf8'));
const participations = JSON.parse(fs.readFileSync(path.join(root, 'participacoes-locais.json'), 'utf8'));
const events = JSON.parse(fs.readFileSync(path.join(root, 'eventos.json'), 'utf8'));
const source = fs.readFileSync(path.join(root, 'js/participacoes-locais.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/participacoes-locais.css'), 'utf8');
const themesSource = fs.readFileSync(path.join(root, 'js/temas-visuais.js'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');

assert.equal(people.schema, 1);
assert.equal(people.pessoas.length, 2);
assert.ok(people.pessoas.some(person => person.id === 'jose-marcello-sales-giffoni'));
assert.ok(people.pessoas.find(person => person.id === 'jose-marcello-sales-giffoni').vinculos.some(vinculo =>
  vinculo.instituicao === 'IFMG Campus Sabará' && vinculo.tipo === 'servidor'
));
assert.ok(people.pessoas.find(person => person.id === 'jose-marcello-sales-giffoni').vinculos.some(vinculo =>
  vinculo.instituicao === 'UFMG' && vinculo.tipo === 'aluno'
));

assert.equal(participations.schema, 1);
assert.equal(participations.participacoes.length, 3);
assert.ok(participations.participacoes.some(item =>
  item.ponto === 'ifmg-sabara-balcao-biblioteca' &&
  item.conteudo_id === 'evento:manual-santa-cecilia-conectando-geracoes-2026-11-28' &&
  item.pessoa_id === 'luisa-cordeiro-martines'
));
assert.ok(participations.participacoes.some(item =>
  item.ponto === 'ifmg-sabara-balcao-biblioteca' &&
  item.conteudo_id === 'evento:sympla-sabara-3644413' &&
  item.pessoa_id === 'luisa-cordeiro-martines'
));
assert.ok(participations.participacoes.some(item =>
  item.ponto === 'ifmg-sabara-balcao-biblioteca' &&
  item.conteudo_id === 'atividade_lazer:atividade:pbh:tai-chi-parque-municipal' &&
  item.pessoa_id === 'jose-marcello-sales-giffoni'
));

assert.ok(events.eventos.some(item => item.id === 'manual-santa-cecilia-conectando-geracoes-2026-11-28'));
assert.match(source, /searchParams\.get\('ponto'\)/);
assert.match(source, /dataset\.communityItemId/);
assert.match(source, /Talentos da Casa/);
assert.match(source, /imagens\/selos\/talentos-da-casa-banner\.png/);
assert.match(css, /\.local-participation-banner-image/);
assert.match(css, /1200 \/ 260/);
assert.ok(fs.existsSync(path.join(root, 'imagens/selos/talentos-da-casa-banner.png')));
assert.match(css, /\.local-participation-banner/);
assert.match(css, /\.local-participation-person-tag/);
assert.match(source, /localParticipationTheme/);
assert.match(source, /mural:local-participation-change/);
assert.match(source, /mural:talent-place-change/);
assert.match(source, /selectedPlace/);
assert.match(source, /personBelongsToPlace/);
assert.match(source, /decorateAgendaCard/);
assert.match(themesSource, /talentos-casa-glow/);
assert.match(themesSource, /localParticipationTheme/);
assert.match(appSource, /openTalentPlaceDialog/);
assert.match(appSource, /filterAgendaItemsByTalentPlace/);
assert.match(appSource, /agenda-talent-place-button/);
assert.match(appSource, /localParticipation\?\.decorateAgendaCard/);

console.log('Participações locais: cadastro, vínculo por ponto/conteúdo e selo visual verificados.');
