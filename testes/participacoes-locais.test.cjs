const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const people = JSON.parse(fs.readFileSync(path.join(root, 'pessoas.json'), 'utf8'));
const participations = JSON.parse(fs.readFileSync(path.join(root, 'participacoes-locais.json'), 'utf8'));
const events = JSON.parse(fs.readFileSync(path.join(root, 'eventos.json'), 'utf8'));
const source = fs.readFileSync(path.join(root, 'js/participacoes-locais.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/participacoes-locais.css'), 'utf8');

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
assert.equal(participations.participacoes.length, 2);
assert.ok(participations.participacoes.some(item =>
  item.ponto === 'ifmg-sabara-balcao-biblioteca' &&
  item.conteudo_id === 'evento:manual-santa-cecilia-conectando-geracoes-2026-11-28' &&
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
assert.match(css, /\.local-participation-banner/);

console.log('Participações locais: cadastro, vínculo por ponto/conteúdo e selo visual verificados.');
