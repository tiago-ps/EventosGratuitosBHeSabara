const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const people = JSON.parse(fs.readFileSync(path.join(root, 'pessoas.json'), 'utf8'));
const participations = JSON.parse(fs.readFileSync(path.join(root, 'participacoes-locais.json'), 'utf8'));
const events = JSON.parse(fs.readFileSync(path.join(root, 'eventos.json'), 'utf8'));
const source = fs.readFileSync(path.join(root, 'js/participacoes-locais.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/participacoes-locais.css'), 'utf8');
const themesSource = fs.readFileSync(path.join(root, 'js/temas-visuais.js'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');

assert.equal(people.schema, 2);
assert.equal(people.pessoas.length, 4);

const luiza = people.pessoas.find(person => person.id === 'luiza-cordeiro-martines');
const jose = people.pessoas.find(person => person.id === 'jose-marcello-sales-giffoni');
const mario = people.pessoas.find(person => person.id === 'mario-matheus-de-oliveira-silva');
const luisaMartins = people.pessoas.find(person => person.id === 'luisa-martins-vieira');

assert.ok(luiza);
assert.ok(jose);
assert.ok(mario);
assert.ok(luisaMartins);
assert.ok(mario.talentos.some(talento =>
  talento.ponto === 'ifmg-sabara-balcao-biblioteca' && talento.papel === 'coral'
));
assert.ok(luisaMartins.talentos.some(talento =>
  talento.ponto === 'ifmg-sabara-balcao-biblioteca' && talento.papel === 'violinista'
));

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
assert.equal(participations.participacoes.length, 7);
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
for (const personId of ['mario-matheus-de-oliveira-silva', 'luisa-martins-vieira']) {
  for (const contentId of [
    'evento:manual-santa-cecilia-conectando-geracoes-2026-11-28',
    'evento:sympla-sabara-3644413'
  ]) {
    assert.ok(participations.participacoes.some(item =>
      item.conteudo_id === contentId && item.pessoa_id === personId
    ));
  }
}

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

// O link individual da Agenda prevalece sobre preferências antigas do dispositivo.
const selectionStart = source.indexOf('function selectedPointFromStorage()');
const selectionEnd = source.indexOf('function pointOptions()', selectionStart);
assert.ok(selectionStart >= 0 && selectionEnd > selectionStart);
const selectionCode = source.slice(selectionStart, selectionEnd);

function resolveSharedTalentContext(href, storedValue, availablePoints) {
  let storageValue = storedValue;
  const context = vm.createContext({
    URL,
    window: { location: { href } },
    safeText: value => String(value ?? '').trim(),
    TALENT_POINT_KEY: 'tem-sim-uai-talento-ponto-v2',
    localStorage: {
      getItem: () => storageValue,
      setItem: (_key, value) => { storageValue = value; },
      removeItem: () => { storageValue = null; }
    }
  });
  vm.runInContext(selectionCode, context);
  return {
    selectedPoint: context.resolveSelectedPoint(availablePoints),
    storedPoint: storageValue
  };
}

const sharedPoint = 'ifmg-sabara-balcao-biblioteca';
const availableTalentPoints = [{ value: sharedPoint }];
const itemId = encodeURIComponent('evento:teste-1');

assert.deepEqual(
  resolveSharedTalentContext(
    'https://tiago-ps.github.io/EventosGratuitosBHeSabara/?modo=agenda&item=' + itemId + '&talentos=' + sharedPoint,
    'outro-ponto-salvo',
    availableTalentPoints
  ),
  { selectedPoint: sharedPoint, storedPoint: sharedPoint }
);
assert.deepEqual(
  resolveSharedTalentContext(
    'https://tiago-ps.github.io/EventosGratuitosBHeSabara/?modo=agenda&item=' + itemId,
    sharedPoint,
    availableTalentPoints
  ),
  { selectedPoint: '', storedPoint: null }
);
assert.deepEqual(
  resolveSharedTalentContext(
    'https://tiago-ps.github.io/EventosGratuitosBHeSabara/?modo=agenda&item=' + itemId + '&talentos=ponto-inexistente',
    sharedPoint,
    availableTalentPoints
  ),
  { selectedPoint: '', storedPoint: null }
);
assert.deepEqual(
  resolveSharedTalentContext(
    'https://tiago-ps.github.io/EventosGratuitosBHeSabara/?modo=agenda',
    sharedPoint,
    availableTalentPoints
  ),
  { selectedPoint: sharedPoint, storedPoint: sharedPoint }
);

assert.match(appSource, /url\.searchParams\.set\('talentos', talentPoint\)/);
assert.match(appSource, /url\.searchParams\.delete\('talentos'\)/);
assert.match(appSource, /const items = filterAgendaItemsByTalentPoint\(/);

console.log('Participações locais: vínculos, filtro por ponto e contexto de compartilhamento validados.');
