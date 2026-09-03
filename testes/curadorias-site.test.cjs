'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const readJson = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const payload = readJson('curadorias-site.json');
const eventsData = readJson('eventos.json');
const booksData = readJson('livros.json');
const coursesData = readJson('cursos.json');
const filmsData = readJson('filmes.json');
const source = fs.readFileSync(path.join(root, 'js/curadorias-site.js'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
const context = vm.createContext({ window: {}, URL, console });
vm.runInContext(source, context, { filename: 'js/curadorias-site.js' });
const curations = context.window.MuralCultural.siteCurations;

const catalogs = {
  eventos: eventsData.eventos,
  livros: booksData.livros,
  cursos: coursesData.cursos,
  filmes: filmsData.filmes
};
const snapshot = JSON.stringify(catalogs);
const warnings = [];
const merged = curations.apply(payload, catalogs, {
  today: new Date(2026, 8, 15),
  warn: message => warnings.push(message)
});

assert.equal(curations.isValidPayload(payload), true);
assert.equal(curations.isValidPayload(null), false);
assert.equal(curations.isValidPayload({ schema: 1, escopo: 'site-only' }), false);
assert.equal(JSON.stringify(catalogs), snapshot, 'A fusão não pode mutar os catálogos centrais');
assert.deepEqual(Array.from(merged.curadoriasAtivas), ['setembro-amarelo-2026']);

const curation = payload.curadorias[0];
assert.equal(curation.titulo_editorial, 'Setembro Amarelo — cuidado e saúde mental');
assert.equal(curation.subtitulo_editorial, 'Cuidado, bem-estar e redes de apoio');
assert.match(curation.texto_introdutorio, /pertencimento, escuta, acolhimento e redes de apoio/);
assert.equal(curation.eixos_editoriais[0].titulo, 'Saúde mental e trabalho');
assert.equal(curation.eixos_editoriais[0].descricao, 'Conteúdos sobre condições de trabalho, riscos psicossociais, relações organizacionais e construção de ambientes profissionais mais saudáveis.');

const eventId = 'sympla-sabara-3534680';
const centralEvent = eventsData.eventos.find(item => item.id === eventId);
const event = merged.eventos.find(item => item.id === eventId);
assert.ok(event);
assert.deepEqual(Array.from(event.temas), ['Setembro Amarelo', 'Saúde mental', 'Cuidado', 'Bem-estar emocional']);
assert.equal(event.descricao, 'Palestra promovida pela AMUSA em alusão ao Setembro Amarelo, com foco em saúde mental, cultura do cuidado, acolhimento e valorização da vida.');
if (centralEvent) assert.equal(centralEvent.temas, undefined);
else {
  assert.equal(event.site_only, true);
  assert.equal(event.gratuito, true);
  assert.match(event.link || '', /^https:\/\/www\.sympla\.com\.br\//);
}

const eventIdsAtMidmonth = merged.eventos.map(item => item.id);
assert.ok(eventIdsAtMidmonth.includes('site:setembro-2026:cultura-do-cuidado-crea-mg'));
assert.ok(eventIdsAtMidmonth.includes('site:setembro-2026:juntos-pela-vida'));
assert.equal(eventIdsAtMidmonth.includes('site:setembro-2026:saude-mental-mobilidade-humana'), false);
const unknownAccess = merged.eventos.find(item => item.id === 'site:setembro-2026:cultura-do-cuidado-crea-mg');
assert.equal(unknownAccess.gratuito, undefined);
assert.equal(unknownAccess.condicao_acesso, 'Acesso não informado');
const earlySeptember = curations.apply(payload, catalogs, { today: new Date(2026, 8, 2), warn() {} });
assert.ok(earlySeptember.eventos.some(item => item.id === 'site:setembro-2026:saude-mental-mobilidade-humana'));
assert.equal(curations.eventIsCurrent({ data: '2026-09-09' }, new Date(2026, 8, 10)), false);

const expectedCourses = new Map([
  ['1089', 'Saúde mental, atenção psicossocial e interculturalidade nas migrações'],
  ['881', 'Direitos Humanos e saúde mental - Curso permanente Damião Ximenes Lopes'],
  ['1207', 'Mídias Digitais e Saúde Mental de Crianças e Adolescentes'],
  ['817', 'Propósito e Qualidade de vida: Descobertas para o Desenvolvimento Pessoal']
]);
const expectedCourseUrls = new Map([
  ['1207', 'https://www.escolavirtual.gov.br/curso/1207'],
  ['1089', 'https://www.escolavirtual.gov.br/curso/1089'],
  ['817', 'https://www.escolavirtual.gov.br/curso/817'],
  ['881', 'https://www.escolavirtual.gov.br/curso/881']
]);
for (const [id, title] of expectedCourses) {
  const course = merged.cursos.find(item => item.id_fonte === id);
  assert.equal(course?.titulo, title);
  assert.ok(course.temas.includes('Setembro Amarelo'));
  assert.equal(course.url, expectedCourseUrls.get(id));
  assert.equal(coursesData.cursos.find(item => item.id_fonte === id).temas, undefined);
}

assert.deepEqual(Array.from(curations.mergeLabels(['Cultura', 'Saúde Mental'], [' setembro amarelo ', 'saude mental', 'CULTURA'])), ['Cultura', 'Saúde Mental', 'setembro amarelo']);

const externalCourses = merged.cursos.filter(item => item.site_only);
assert.equal(externalCourses.length, 5);
assert.ok(externalCourses.every(item => item.origem === 'site-only' && item.id.startsWith('site:')));
assert.equal(new Set(externalCourses.map(item => item.id)).size, 5);
assert.equal(externalCourses.filter(item => item.temas.some(theme => curations.normalizeLabel(theme) === 'setembro amarelo')).length, 4);
assert.ok(externalCourses.every(item => item.descricao && item.nivel && /^https:\/\//.test(item.url)));
const sensitiveCourse = externalCourses.find(item => item.id === 'site:unasus:prevencao-suicidio-2026');
assert.equal(sensitiveCourse.temas.includes('Setembro Amarelo'), false);
assert.equal(sensitiveCourse.eixo_curadoria, 'Formação profissional');
assert.equal(sensitiveCourse.conteudo_sensivel, 'Suicídio');
const workCourse = externalCourses.find(item => item.id === 'site:fiocruz:saude-mental-trabalho-2026');
assert.equal(workCourse.carga_horaria, '20');
assert.equal(workCourse.modalidade, 'Autoinstrucional');
assert.match(workCourse.descricao, /condições e organização do trabalho/);

const externalBooks = merged.livros.filter(item => item.site_only);
assert.equal(externalBooks.length, 5);
assert.deepEqual(Array.from(externalBooks.map(item => item.codigo_acervo).sort()), ['230639', '231118', '231508', '232152', '232509']);
assert.ok(externalBooks.every(item => item.acesso_virtual === true && /pergamum\.ifmg\.edu\.br/.test(item.link_virtual)));
assert.ok(externalBooks.every(item => /^https:\/\/pergamum\.ifmg\.edu\.br\/acervo\/\d+$/.test(item.link_virtual)));
assert.ok(externalBooks.every(item => item.imagem?.startsWith('imagens/curadorias/')));
assert.deepEqual(
  Array.from(externalBooks.map(item => item.link_virtual).sort()),
  ['5064668', '5064759', '5065368', '5066485', '5069029'].map(id => `https://pergamum.ifmg.edu.br/acervo/${id}`).sort()
);

const externalFilms = merged.filmes.filter(item => item.site_only && !item.painel_apoio);
assert.equal(externalFilms.length, 5);
assert.equal(new Set(externalFilms.map(item => item.id)).size, 5);
assert.ok(externalFilms.every(item => item.origem === 'site-only'));
assert.ok(externalFilms.every(item => item.temas.includes('Setembro Amarelo')));
for (const film of externalFilms) {
  assert.ok(
    film.imagem && fs.existsSync(path.join(root, film.imagem)),
    `Imagem local ausente para o filme ${film.titulo}: ${film.imagem || 'caminho não informado'}`
  );
}
assert.equal(externalFilms.some(item => item.titulo === 'Poderia me Chamar Adeus'), false);
assert.equal(externalFilms.some(item => item.titulo === 'DEUS AMA TODAS AS PESSOAS'), false);
assert.equal(externalFilms.some(item => item.titulo === 'A solidão das borboletas'), false);
assert.match(externalFilms.find(item => item.titulo === 'Aos Cuidados Dela').pagina_oficial, /^https:\/\/embaubaplay\.com\//);
assert.match(externalFilms.find(item => item.titulo === 'Casa da Água').pagina_oficial, /^https:\/\/flix\.votelgbt\.org\//);
assert.equal(externalFilms.some(item => item.titulo === 'No Céu Não Tem Caldo de Cana'), false);
const nossaDanca = externalFilms.find(item => item.titulo === 'Nossa Dança');
assert.deepEqual([nossaDanca.ano, nossaDanca.duracao_minutos, nossaDanca.classificacao], [2022, 22, 'Livre']);
assert.match(nossaDanca.pagina_oficial, /81fe277e-8a05-11ee-ab4c-0a58a9feac02/);
const cancha = externalFilms.find(item => item.titulo === 'Cancha — Domingo É Dia de Jogo');
assert.deepEqual([cancha.ano, cancha.duracao_minutos, cancha.classificacao, cancha.plataforma], [2020, 18, 'Livre', 'YouTube']);
assert.equal(cancha.pagina_oficial, 'https://www.youtube.com/watch?v=ifhZ0bKW2Bk');
const rexistencia = externalFilms.find(item => item.titulo === '(R)EXISTÊNCIA');
assert.deepEqual([rexistencia.ano, rexistencia.duracao_minutos, rexistencia.classificacao, rexistencia.direcao[0]], [2024, 2, '10 anos', 'Rycleson Rodrigues']);
assert.match(rexistencia.pagina_oficial, /80f32336-326e-11ef-a208-0a58a9feac02/);
const friendshipFilm = merged.filmes.find(item => item.id === 'telabrasil:412');
assert.ok(friendshipFilm?.temas.includes('Setembro Amarelo'));
assert.equal(friendshipFilm.temas.includes('Saúde mental'), false);

const audit = curation.auditoria_dados;
assert.equal(audit?.revisado_em, '2026-09-02');
assert.ok(audit.confirmacoes.some(item => item.id === eventId && item.confirmado.includes('gratuidade')));
assert.ok(audit.confirmacoes.some(item => item.id === 'apoio-informacao-setembro-2026'));
assert.equal(audit.pendencias_manuais.some(item => item.id === 'setembro-2026-sem-url-confirmada'), false);

assert.ok(merged.apoio);
assert.equal(merged.apoio.site_only, true);
assert.equal(merged.apoio.campaignActive, true);
assert.equal(merged.apoio.secoes.length, 3);
const supportText = JSON.stringify(merged.apoio);
for (const expected of ['CVV', '188', 'SAMU', '192', 'UPA Sabará', '3671-9850', 'Pode Falar', 'CERSAM', 'CEAP', 'PUC Minas', 'FUMEC']) {
  assert.ok(supportText.includes(expected), `Conteúdo de apoio ausente: ${expected}`);
}
assert.equal(merged.apoio.informacao_confiavel.titulo, 'Informação confiável');
assert.equal(merged.apoio.secoes[0].id, 'apoio-emocional');
assert.equal(merged.apoio.secoes[1].id, 'rede-publica');
assert.equal(merged.apoio.secoes[2].id, 'atendimento-universitario');
assert.equal(merged.apoio.informacao_confiavel.id, 'informacao-confiavel');
const cvv = merged.apoio.secoes[0].servicos.find(item => item.nome.startsWith('CVV'));
assert.equal(cvv.url, 'https://cvv.org.br/');
assert.equal(cvv.imagem, 'imagens/curadorias/CVV.png');
assert.equal(merged.apoio.recursos_informativos.length, 11);
assert.ok(merged.apoio.recursos_informativos.some(item => item.id === 'see-mg-cuidando-da-sua-mente-15-18'));
assert.ok(merged.apoio.recursos_informativos.some(item => item.id === 'see-mg-saude-mental-acoes-escola'));
const selfHarm = merged.apoio.recursos_informativos.find(item => item.id === 'ufrgs-enfrentando-autolesao-familias');
assert.equal(selfHarm.subsecao, 'Para famílias e responsáveis');
assert.equal(selfHarm.conteudo_sensivel, 'Conteúdo sensível: autolesão');
assert.equal(merged.eventos.some(item => item.nome === 'CVV — Centro de Valorização da Vida'), false);

const absent = curations.apply(null, catalogs, { today: new Date(2026, 8, 15) });
assert.equal(absent.cursos.length, catalogs.cursos.length);
assert.equal(absent.apoio, null);
const invalid = curations.apply({ schema: 999, escopo: 'site-only', curadorias: [] }, catalogs);
assert.equal(invalid.eventos.length, catalogs.eventos.length);

const outside = curations.apply(payload, catalogs, { today: new Date(2026, 9, 1) });
assert.equal(outside.curadoriasAtivas.length, 0);
assert.equal(outside.eventos.length, catalogs.eventos.length);
assert.equal(outside.livros.length, catalogs.livros.length);
assert.equal(outside.cursos.length, catalogs.cursos.length);
assert.equal(outside.filmes.length, catalogs.filmes.length + 4);
assert.ok(outside.apoio);
assert.equal(outside.apoio.campaignActive, false);

const cultureEvent = merged.eventos.find(item => item.id === 'site:setembro-2026:cultura-do-cuidado-crea-mg');
assert.deepEqual(
  [cultureEvent.local, cultureEvent.endereco, cultureEvent.mapa, cultureEvent.imagem],
  ['CREA', 'Av. Álvares Cabral, 1600 - Santo Agostinho, Belo Horizonte - MG, 30170-917', 'https://maps.app.goo.gl/e8NY1ky8bKJjAuMh6', 'imagens/curadorias/crea.jpg']
);
const togetherEvent = merged.eventos.find(item => item.id === 'site:setembro-2026:juntos-pela-vida');
assert.deepEqual(
  [togetherEvent.local, togetherEvent.endereco, togetherEvent.mapa],
  ['Biblioteca Pública Estadual de Minas Gerais', 'Praça da Liberdade, 21 - Savassi, Belo Horizonte - MG, 30140-010', 'https://maps.app.goo.gl/93jy5mVtUwoy3e7G7']
);

for (const image of [
  'saude-mental-no-trabalho.png', 'CVV.png', 'aos-cuidados-dela.jpg', 'saude-mental-na-escola.jpg',
  'o-culto-do-bem-estar.jpg', 'cult.jpg', 'desenvolvimento-positivo-no-esporte.jpg',
  'a-infancia-sequestrada-pelas-telas.jpg', 'a-escola-que-queremos.jpg', 'crea.jpg',
  'atencao-a-saude-mental-do-homem.jpg', 'saude-mental-e-atencao-psicossocial-de-adolescentes-e-jovens.jpg',
  'cancha.jpg', 'pode-falar.png', 'informacao-confiavel.png', 'universidades.png', 'onde-buscar-atendimento.png'
]) {
  assert.ok(JSON.stringify(payload).includes(`imagens/curadorias/${image}`), `Imagem ausente no JSON: ${image}`);
}

const unsafePayload = JSON.parse(JSON.stringify(payload));
unsafePayload.curadorias[0].complementos.cursos.push({
  id: 'site:teste:url-perigosa', titulo: '<img src=x onerror=alert(1)>', nivel: 'Teste', descricao: 'Teste',
  url: 'javascript:alert(1)', temas: ['Setembro Amarelo']
});
const unsafeWarnings = [];
const unsafe = curations.apply(unsafePayload, catalogs, { today: new Date(2026, 8, 15), warn: message => unsafeWarnings.push(message) });
const unsafeCourse = unsafe.cursos.find(item => item.id === 'site:teste:url-perigosa');
assert.equal(unsafeCourse.url, undefined);
assert.equal(unsafeCourse.titulo, '<img src=x onerror=alert(1)>');
assert.ok(unsafeWarnings.some(message => message.includes('URL inválida removida')));
assert.equal(curations.safeExternalUrl('javascript:alert(1)'), '');
assert.match(curations.safeExternalUrl('https://example.org/path'), /^https:\/\/example\.org\/path$/);

const overlayCatalogs = {
  eventos: [{
    id: 'evento-overlay-imagem',
    titulo: 'Evento com Imagem',
    descricao: 'Descrição central',
    link: 'https://central.example/evento',
    imagem: 'imagens/central.jpg'
  }],
  livros: [],
  cursos: [],
  filmes: []
};
const overlayCatalogsSnapshot = JSON.stringify(overlayCatalogs);
const overlayPayload = {
  schema: 1,
  escopo: 'site-only',
  curadorias: [{
    id: 'teste-overlay-imagem',
    ativo_de: '2026-09-01',
    ativo_ate: '2026-09-30',
    overlays: {
      eventos: {
        'evento-overlay-imagem': {
          titulo_esperado: '  EVENTO com imagem ',
          temas: ['Setembro Amarelo'],
          imagem: 'imagens/curadorias/setembro-amarelo-2026/evento.jpg',
          imagem_fonte: 'Fonte <strong>editorial</strong>',
          imagem_origem_url: 'https://example.org/pagina-da-imagem',
          imagem_credito: 'Crédito <img src=x onerror=alert(1)>',
          imagem_observacao: 'Observação & texto',
          titulo: 'Título adulterado',
          descricao: 'Descrição adulterada',
          link: 'https://aprovado.example/evento'
        }
      }
    },
    complementos: {
      eventos: [{
        id: 'site:complemento-com-imagem',
        titulo: 'Complemento com imagem',
        data: '2026-09-30',
        imagem: 'imagens/curadorias/setembro-amarelo-2026/complemento.jpg'
      }]
    }
  }]
};
const overlayWarnings = [];
const overlayMerged = curations.apply(overlayPayload, overlayCatalogs, {
  today: new Date(2026, 8, 15),
  warn: message => overlayWarnings.push(message)
});
const overlayEvent = overlayMerged.eventos.find(item => item.id === 'evento-overlay-imagem');
assert.equal(overlayEvent.imagem, 'imagens/curadorias/setembro-amarelo-2026/evento.jpg');
assert.match(curations.safeImage('https://example.org/imagem.jpg'), /^https:\/\/example\.org\/imagem\.jpg$/);
assert.equal(curations.safeImage('javascript:alert(1)'), '');
assert.equal(curations.safeImage('data:image/png;base64,AAAA'), '');
assert.equal(curations.safeImage('//cdn.example.org/imagem.jpg'), '');
assert.equal(curations.safeImage('\\\\cdn.example.org\\imagem.jpg'), '');
assert.equal(overlayEvent.imagem_origem_url, 'https://example.org/pagina-da-imagem');
assert.equal(overlayEvent.imagem_fonte, 'Fonte <strong>editorial</strong>');
assert.equal(overlayEvent.imagem_credito, 'Crédito <img src=x onerror=alert(1)>');
assert.equal(overlayEvent.imagem_observacao, 'Observação & texto');
assert.equal(overlayEvent.titulo, 'Evento com Imagem');
assert.equal(overlayEvent.descricao, 'Descrição central');
assert.equal(overlayEvent.link, 'https://aprovado.example/evento');
assert.ok(overlayEvent.temas.includes('Setembro Amarelo'));
assert.equal(JSON.stringify(overlayCatalogs), overlayCatalogsSnapshot);
assert.equal(
  overlayMerged.eventos.find(item => item.id === 'site:complemento-com-imagem').imagem,
  'imagens/curadorias/setembro-amarelo-2026/complemento.jpg'
);

const httpsImagePayload = JSON.parse(JSON.stringify(overlayPayload));
httpsImagePayload.curadorias[0].overlays.eventos['evento-overlay-imagem'].imagem = 'https://cdn.example.org/evento.jpg';
const httpsImageMerged = curations.apply(httpsImagePayload, overlayCatalogs, {
  today: new Date(2026, 8, 15), warn() {}
});
assert.equal(httpsImageMerged.eventos[0].imagem, 'https://cdn.example.org/evento.jpg');

const unsafeUrlPayload = JSON.parse(JSON.stringify(overlayPayload));
unsafeUrlPayload.curadorias[0].overlays.eventos['evento-overlay-imagem'].link = 'javascript:alert(1)';
const unsafeUrlMerged = curations.apply(unsafeUrlPayload, overlayCatalogs, { today: new Date(2026, 8, 15), warn() {} });
assert.equal(unsafeUrlMerged.eventos[0].link, 'https://central.example/evento');

for (const unsafeImage of ['javascript:alert(1)', 'data:image/png;base64,AAAA']) {
  const unsafeImagePayload = JSON.parse(JSON.stringify(overlayPayload));
  unsafeImagePayload.curadorias[0].overlays.eventos['evento-overlay-imagem'].imagem = unsafeImage;
  const unsafeImageWarnings = [];
  const unsafeImageMerged = curations.apply(unsafeImagePayload, overlayCatalogs, {
    today: new Date(2026, 8, 15),
    warn: message => unsafeImageWarnings.push(message)
  });
  assert.equal(unsafeImageMerged.eventos[0].imagem, 'imagens/central.jpg');
  assert.ok(unsafeImageWarnings.some(message => message.includes('imagem inválida ignorada')));
}

const invalidOriginPayload = JSON.parse(JSON.stringify(overlayPayload));
invalidOriginPayload.curadorias[0].overlays.eventos['evento-overlay-imagem'].imagem_origem_url = 'file:///segredo.jpg';
const invalidOriginWarnings = [];
const invalidOriginMerged = curations.apply(invalidOriginPayload, overlayCatalogs, {
  today: new Date(2026, 8, 15),
  warn: message => invalidOriginWarnings.push(message)
});
assert.equal(invalidOriginMerged.eventos[0].imagem_origem_url, undefined);
assert.ok(invalidOriginWarnings.some(message => message.includes('URL de origem da imagem inválida ignorada')));

const divergentTitlePayload = JSON.parse(JSON.stringify(overlayPayload));
divergentTitlePayload.curadorias[0].overlays.eventos['evento-overlay-imagem'].titulo_esperado = 'Outro evento';
const divergentTitleMerged = curations.apply(divergentTitlePayload, overlayCatalogs, {
  today: new Date(2026, 8, 15), warn() {}
});
assert.equal(divergentTitleMerged.eventos[0].imagem, 'imagens/central.jpg');
assert.equal(divergentTitleMerged.eventos[0].temas, undefined);

const collisionPayload = JSON.parse(JSON.stringify(payload));
const firstCentralEvent = catalogs.eventos[0];
const firstCentralBook = catalogs.livros[0];
const firstCentralFilm = catalogs.filmes[0];
if (firstCentralEvent) collisionPayload.curadorias[0].complementos.eventos.push({ id: firstCentralEvent.id, titulo: 'Não substituir', data: '2026-09-30' });
if (firstCentralBook) collisionPayload.curadorias[0].complementos.livros.push({ id: firstCentralBook.id, titulo: 'Não substituir' });
if (firstCentralFilm) collisionPayload.curadorias[0].complementos.filmes.push({ id: firstCentralFilm.id, titulo: 'Não substituir' });
collisionPayload.curadorias[0].complementos.cursos.push({ id: 'site:colisao-curso', id_fonte: '1089', titulo: 'Não substituir' });
const collisionWarnings = [];
const collision = curations.apply(collisionPayload, catalogs, { today: new Date(2026, 8, 15), warn: message => collisionWarnings.push(message) });
if (firstCentralEvent) assert.equal(collision.eventos.filter(item => item.id === firstCentralEvent.id).length, 1);
if (firstCentralBook) assert.equal(collision.livros.filter(item => item.id === firstCentralBook.id).length, 1);
if (firstCentralFilm) assert.equal(collision.filmes.filter(item => item.id === firstCentralFilm.id).length, 1);
assert.equal(collision.cursos.some(item => item.id === 'site:colisao-curso'), false);
assert.ok(collisionWarnings.some(message => message.includes('colisão')));

assert.match(source, /fallbackTitleMatches/);
assert.match(source, /textContent = text/);
assert.match(source, /support-help-sensitive/);
assert.match(source, /openSupportArea\(opener = document\.activeElement, target = ''\)/);
assert.match(source, /section\.dataset\.supportTarget === target/);
assert.match(source, /Ver informações, contatos e endereços/);
assert.doesNotMatch(source, /No celular, abra “Onde buscar ajuda”/);
assert.match(appSource, /loadOptionalJson\(SITE_CURATIONS_URL, null\)/);
assert.match(appSource, /siteCurationsContent\.apply\(siteCurationsData/);
assert.match(appSource, /siteCurationsContent\.mountSupportArea\(siteLayer\.apoio\)/);
assert.match(appSource, /Acesso não informado/);
assert.doesNotMatch(appSource, /(?:write|post|put).*curadorias-site\.json/i);

console.log('Testes da camada site-only Setembro Amarelo aprovados: conteúdo, temporalidade, segurança, colisões, apoio e isolamento dos catálogos centrais.');
