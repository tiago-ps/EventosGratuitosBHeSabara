'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'curadorias-site.json'), 'utf8'));
const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const c = data.curadorias.find(x => x.id === 'vestibular-fuvest-2027');
assert.ok(c); assert.equal(c.ativo_de, '2026-08-17'); assert.equal(c.ativo_ate, '2026-12-07');
assert.equal(c.perfil_visual, null); assert.equal(c.complementos.livros.length, 9);
const expected = [
['Opúsculo Humanitário','Nísia Floresta',1853,'opusculo-humanitario'],
['Nebulosas','Narcisa Amália',1872,'nebulosas'],
['Memórias de Martha','Julia Lopes de Almeida',1899,'memorias-de-martha'],
['Caminho de pedras','Rachel de Queiroz',1937,'caminho-de-pedras'],
['A paixão segundo G. H.','Clarice Lispector',1964,'a-paixao-segundo-g-h'],
['Geografia','Sophia de Mello Breyner Andresen',1967,'geografia'],
['Balada de amor ao vento','Paulina Chiziane',1990,'balada-de-amor-ao-vento'],
['Canção para ninar menino grande','Conceição Evaristo',2018,'cancao-para-ninar-menino-grande'],
['A visão das plantas','Djaimilia Pereira de Almeida',2019,'a-visao-das-plantas']];
const books = new Map(c.complementos.livros.map(x => [x.titulo,x]));
for (const [t,a,y,s] of expected) {
  const b=books.get(t); assert.ok(b,t); assert.equal(b.autor,a); assert.equal(b.ano,y);
  assert.equal(b.imagem,`imagens/curadorias/vestibular-fuvest-2027/${s}.png`);
  assert.equal(b.vestibular.instituicao,'FUVEST / USP'); assert.equal(b.vestibular.ano_vestibular,2027);
  assert.ok(b.acervos.length); for (const r of b.acervos.flatMap(x=>x.registros))
    if (r.tipo_registro==='consulta_catalogo') assert.equal(r.disponibilidade_confirmada,false);
}
assert.equal(books.get('Opúsculo Humanitário').link,'https://www2.senado.leg.br/bdsf/bitstream/handle/id/658727/Opusculo_humanitario_3.ed.pdf');
assert.equal(books.get('Nebulosas').link,'https://digital.bbm.usp.br/handle/bbm/8413');
assert.equal(books.get('Memórias de Martha').link,'https://digital.bbm.usp.br/handle/bbm/7037');
assert.equal(books.get('A paixão segundo G. H.').codigo_acervo,'109238');
assert.equal(books.get('Canção para ninar menino grande').codigo_acervo,'108962');
assert.match(app,/'vestibular-fuvest-2027':\s*\{[\s\S]*theme: 'vestibular fuvest'/);
assert.match(sw,/VESTIBULAR_FUVEST_IMAGE_PREFIX = '\/imagens\/curadorias\/vestibular-fuvest-2027\/'/);
console.log('Curadoria Vestibular FUVEST 2027 validada.');

