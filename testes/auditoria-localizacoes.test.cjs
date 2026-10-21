'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('js/mapa-espacos.js','utf8');
const ctx = { window: { MuralCultural: {} } };
vm.runInNewContext(source, ctx);
const api = ctx.window.MuralCultural.spaceMap;

const space = [{ id:'espaco-revisado', endereco:'Rua Exemplo, 100', titulo:'Local Revisado' }];
const sample = [
  {id:'1',tipo_conteudo:'evento',titulo:'Oficina',local_id:'pendente',endereco:'Rua A, 10',local:'NUFAC'},
  {id:'2',tipo_conteudo:'evento',titulo:'Outra oficina',local_id:'pendente',endereco:'Rua A, 10',local:'NUFAC'},
  {id:'3',tipo_conteudo:'evento',titulo:'Cultura coletiva',local:'Vários espaços da cidade'},
  {id:'4',tipo_conteudo:'evento',titulo:'Recital',local:'Conservatório UFMG'},
  {id:'5',tipo_conteudo:'evento',titulo:'Peça',local_id:'espaco-revisado'}
];
function audit(extra={}) {
  return api.mapItems({
    results: {events:sample}, allSpaces:space,
    coordinates:{'espaco-revisado':{latitude:-19.9,longitude:-43.9}},
    extra, relations:[]
  });
}
let result=audit();
assert.equal(result.mapped,1);
assert.equal(result.unmapped,4);
assert.equal(result.unmappedRecords.length,4,'mapa deve conservar eventos sem marcador');
assert.equal(new Set(result.unmappedRecords.map(x=>x.item.id)).size,4);
result=audit({locais_por_id:{pendente:{latitude:-19.91,longitude:-43.94}}});
assert.equal(result.mapped,3,'Uma revisão por ID deve localizar dois eventos');
assert.equal(result.unmapped,2);
result=audit({locais_por_nome:{'conservatorio ufmg':{latitude:-19.9,longitude:-43.95}}});
assert.equal(result.mapped,2,'Revisão por nome pode localizar evento sem endereço');
assert.ok(result.unmappedRecords.some(x=>x.item.id==='3'),
 'Evento com vários lugares nunca ganha marcador inventado');
const html=fs.readFileSync('revisar-localizacoes.html','utf8');
const review=fs.readFileSync('js/revisar-localizacoes.js','utf8');
assert.ok(html.includes('js/revisar-localizacoes.js?v=1'));
assert.ok(html.includes('js/mapa-espacos.js?v=4'));
assert.ok(review.includes('localStorage.setItem'));
assert.ok(review.includes('coordenadas-espacos.json'));
assert.ok(review.includes('localizacoes-revisadas-'));
assert.ok(review.includes("somente_teste !== true"));
console.log('Auditoria de endereços: exportação, revisão e fallback sem marcadores falsos verificados.');
