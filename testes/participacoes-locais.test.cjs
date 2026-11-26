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

assert.equal(people.schema, 2);
assert.equal(people.pessoas.length, 2);

const luiza = people.pessoas.find(person => person.id === 'luiza-cordeiro-martines');
const jose = people.pessoas.find(person => person.id === 'jose-marcello-sales-giffoni');

assert.ok(luiza);
assert.ok(jose);

assert.ok(luiza.vinculos.some(vinculo =>
  vinculo.instituicao === 'IFMG Campus Sabará' && vinculo.tipo === 'aluna'
));
assert.ok(luiza.vinculos.some(vinculo =>
  vinculo.instituicao === 'Sociedade Musical Santa Cecília' && vinculo.papel === 'violinista'
));
assert.ok(luiza.talentos.some(talento =>
  talento.ponto === 'ifmg-sabara-balcao-biblioteca' &&
  talento.nome_ponto === 'Biblioteca do IFMG Campus Sabará' &&
  talento.papel === 'violinista'
));

assert.equal(jose.vinculos.length, 1);
assert.ok(jose.vinculos.some(vinculo =>
  vinculo.instituicao === 'IFMG Campus Sabará' &&
  vinculo.tipo === 'servidor' &&
  vinculo.papel === 'técnico-administrativo'
));
assert.ok(jose.talentos.some(talento =>
  talento.ponto === 'ifmg-sabara-balcao-biblioteca' &&
  talento.papel === 'professor de Tai Chi Chuan'
));
assert.ok(!jose.vinculos.some(vinculo => vinculo.instituicao === 'UFMG'));

assert.equal(participations.schema, 1);
assert.equal(participations.participacoes.length, 3);
assert.ok(participations.participacoes.every(item =>
  item.ponto === 'ifmg-sabara-balcao-biblioteca'
));
assert.ok(participations.participacoes.some(item =>
  item.conteudo_id === 'evento:manual-santa-cecilia-conectando-geracoes-2026-11-28' &&
  item.pessoa_id === 'luiza-cordeiro-martines'
));
assert.ok(participations.participacoes.some(item =>
  item.conteudo_id === 'evento:sympla-sabara-3644413' &&
  item.pessoa_id === 'luiza-cordeiro-martines'
));
assert.ok(participations.participacoes.some(item =>
  item.conteudo_id === 'atividade_lazer:atividade:pbh:tai-chi-parque-municipal' &&
  item.pessoa_id === 'jose-marcello-sales-giffoni'
));

assert.ok(events.eventos.some(item => item.id === 'manual-santa-cecilia-conectando-geracoes-2026-11-28'));
assert.match(source, /searchParams\.get\('ponto'\)/);
assert.match(source, /dataset\.communityItemId/);
assert.match(source, /Talentos da Casa/);
assert.match(source, /imagens\/selos\/talentos-da-casa-banner\.png/);
assert.match(source, /personIsTalentAtPoint/);
assert.match(source, /curationAgendaItemMatches/);
assert.match(source, /CURATION_MEMBER_COLLECTIONS/);
assert.match(source, /talentos/);
assert.match(source, /TALENT_POINT_KEY/);
assert.match(source, /selectedPoint/);
assert.match(source, /pointOptions/);
assert.doesNotMatch(source, /personBelongsToPlace/);
assert.doesNotMatch(source, /selectedPlace/);

assert.match(css, /\.local-participation-banner-image/);
assert.match(css, /1200 \/ 260/);
assert.ok(fs.existsSync(path.join(root, 'imagens/selos/talentos-da-casa-banner.png')));
assert.match(css, /\.local-participation-banner/);
assert.match(css, /\.local-participation-person-tag/);
assert.match(css, /agenda-talent-point-button/);
assert.match(css, /\.local-participation-agenda-banner/);
assert.match(css, /\.agenda-activity-card \.activity-agenda-media \.local-participation-agenda-banner \.local-participation-banner-image\s*\{[^}]*min-height:\s*0[^}]*object-fit:\s*contain/s);
assert.match(css, /agenda-talent-point-option/);

assert.match(source, /localParticipationTheme/);
assert.match(source, /mural:local-participation-change/);
assert.match(source, /mural:talent-point-change/);
assert.match(source, /selectedPoint/);
assert.match(source, /personIsTalentAtPoint/);
assert.match(source, /decorateAgendaCard/);
assert.match(themesSource, /talentos-casa-glow/);
assert.match(themesSource, /localParticipationTheme/);
assert.match(appSource, /openTalentPointDialog/);
assert.match(appSource, /filterAgendaItemsByTalentPoint/);
assert.match(appSource, /agenda-talent-point-button/);
assert.match(appSource, /localParticipation\?\.decorateAgendaCard/);
assert.match(source, /local-participation-agenda-banner/);
assert.match(appSource, /localParticipation\?\.selectedPoint/);
assert.match(appSource, /localParticipation\?\.points/);
assert.match(appSource, /mural:agenda-curation-filter-request/);
assert.match(appSource, /mural:agenda-talent-filter-request/);
assert.match(source, /mural:agenda-talent-filter-request/);
assert.match(source, /interactive: true/);
assert.doesNotMatch(appSource, /localParticipation\?\.selectedPlace/);
assert.doesNotMatch(appSource, /localParticipation\?\.places/);

console.log('Participações locais: vínculo institucional separado de talento por ponto de exibição.');
