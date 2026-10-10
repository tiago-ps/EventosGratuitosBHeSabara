'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const swSource = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');

const normalizeText = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

function records(filename, preferredKey) {
  const payload = JSON.parse(fs.readFileSync(path.join(root, filename), 'utf8'));
  if (Array.isArray(payload)) return payload;
  if (preferredKey && Array.isArray(payload[preferredKey])) return payload[preferredKey];
  return Object.values(payload)
    .filter(Array.isArray)
    .sort((a, b) => b.length - a.length)[0] || [];
}

const context = vm.createContext({
  window: {
    MuralCultural: {
      contents: {},
      core: {
        sampleForPanel(items, limit) {
          return items.slice(0, limit);
        }
      }
    }
  }
});
for (const file of [
  'js/conteudos/cursos.js',
  'js/conteudos/concursos.js',
  'js/conteudos/filmes.js',
  'js/conteudos/atividades-lazer.js',
  'js/conteudos/espacos.js'
]) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
}

const contents = context.window.MuralCultural.contents;

// Cursos: catálogo muito maior que a taxonomia de temas, então os filtros usam
// campos estruturados que existem em toda ou boa parte da base.
const coursesData = records('cursos.json', 'cursos');
const courses = contents.courses;
assert.ok(coursesData.length > 1000);
assert.ok(courses.scalarOptions(coursesData, 'instituicao').length > 1);
assert.ok(courses.scalarOptions(coursesData, 'area').length > 10);
const [institutionValue] = courses.scalarOptions(coursesData, 'instituicao')[0];
const byInstitution = courses.filter(coursesData, { institution: institutionValue });
assert.ok(byInstitution.length > 0);
assert.ok(byInstitution.every(item => normalizeText(item.instituicao) === institutionValue));
const shortCourses = courses.filter(coursesData, { workload: 'ate-10' });
assert.ok(shortCourses.length > 0);
assert.ok(shortCourses.every(item => courses.workloadHours(item.carga_horaria) <= 10));
const certificateCourses = courses.filter(coursesData, { certificate: 'yes' });
assert.ok(certificateCourses.length > 0);
assert.ok(certificateCourses.every(item => item.certificado === true));

// Concursos: cidade e faixa de maior remuneração complementam formação, UF e prazo.
const contestsData = records('concursos.json', 'concursos');
const contests = contents.contests;
const contestCities = contests.cityOptions(contestsData);
assert.ok(contestCities.length > 1);
const [contestCity] = contestCities[0];
const byContestCity = contests.filter(contestsData, { city: contestCity });
assert.ok(byContestCity.length > 0);
assert.ok(byContestCity.every(item => normalizeText(item.cidade) === contestCity));
const highPay = contests.filter(contestsData, { remuneration: 'mais-10000' });
assert.ok(highPay.length > 0);
assert.ok(highPay.every(item => contests.remunerationMax(item) > 10000));

// Filmes: aproveita campos já ricos no catálogo.
const filmsData = records('filmes.json', 'filmes');
const films = contents.films;
const accessible = films.filter(filmsData, { accessibility: 'Legendas' }, normalizeText);
assert.ok(accessible.length > 0);
assert.ok(accessible.every(item => (item.acessibilidade || []).some(v => normalizeText(v) === 'legendas')));
const countryRecord = filmsData.find(item => String(item.pais_origem || '').trim());
assert.ok(countryRecord);
const byCountry = films.filter(filmsData, { country: countryRecord.pais_origem }, normalizeText);
assert.ok(byCountry.length > 0);
assert.ok(byCountry.every(item => normalizeText(item.pais_origem) === normalizeText(countryRecord.pais_origem)));
const collections = films.options(filmsData, 'colecoes');
assert.ok(collections.length > 0);
const byCollection = films.filter(filmsData, { collection: collections[0] }, normalizeText);
assert.ok(byCollection.length > 0);

// Esporte e Lazer: dia, forma de participação, público e formato.
const activitiesData = records('atividades-lazer.json', 'atividades');
const activities = contents.activities;
const activityDays = activities.dayOptions(activitiesData);
assert.ok(activityDays.length >= 5);
const [activityDay] = activityDays[0];
const byDay = activities.filter(activitiesData, { day: activityDay }, normalizeText);
assert.ok(byDay.length > 0);
assert.ok(byDay.every(item => (item.agenda?.dias_semana || []).includes(activityDay)));
const participationOptions = activities.participationOptions(activitiesData);
assert.ok(participationOptions.length >= 3);
const [participation] = participationOptions[0];
assert.ok(activities.filter(activitiesData, { participation }, normalizeText).length > 0);
assert.ok(activities.audienceOptions(activitiesData, normalizeText).length > 5);
assert.ok(activities.formatOptions(activitiesData).length >= 2);

// Espaços: instituição mantenedora e dia de funcionamento.
const spacesData = records('espacos_culturais.json', 'espacos');
const spaces = contents.spaces;
assert.ok(spaces.institutionOptions(spacesData, normalizeText).length > 3);
const [spaceInstitution] = spaces.institutionOptions(spacesData, normalizeText)[0];
const byInstitutionSpace = spaces.filter(spacesData, { institution: spaceInstitution }, normalizeText);
assert.ok(byInstitutionSpace.length > 0);
assert.ok(byInstitutionSpace.every(item => normalizeText(item.instituicao) === spaceInstitution));
const openDays = spaces.openDayOptions(spacesData);
assert.ok(openDays.length >= 6);
const [openDay] = openDays[0];
const openOnDay = spaces.filter(spacesData, { openDay }, normalizeText);
assert.ok(openOnDay.length > 0);
assert.ok(openOnDay.every(item => spaces.isOpenOnDay(item, openDay)));

// A interface deve expor todos os filtros implementados na lógica.
for (const className of [
  'agenda-book-library', 'agenda-book-year-from', 'agenda-book-year-to', 'agenda-book-audiobook',
  'agenda-course-institution', 'agenda-course-area', 'agenda-course-workload',
  'agenda-course-type', 'agenda-course-level', 'agenda-course-language', 'agenda-course-certificate',
  'agenda-contest-city', 'agenda-contest-state', 'agenda-contest-remuneration',
  'agenda-film-accessibility', 'agenda-film-country', 'agenda-film-collection',
  'agenda-utility-nature', 'agenda-utility-scope', 'agenda-utility-audience',
  'agenda-activity-day', 'agenda-activity-participation', 'agenda-activity-audience', 'agenda-activity-format',
  'agenda-space-institution', 'agenda-space-open-day'
]) {
  assert.ok(appSource.includes(className), `Controle ausente: ${className}`);
}

for (const stateField of [
  'mobileBookLibrary', 'mobileBookYearFrom', 'mobileBookYearTo', 'mobileBookAudiobook',
  'mobileCourseInstitution', 'mobileCourseArea', 'mobileCourseWorkload', 'mobileCourseType',
  'mobileCourseLevel', 'mobileCourseLanguage', 'mobileCourseCertificate',
  'mobileContestCity', 'mobileContestState', 'mobileContestRemuneration',
  'mobileFilmAccessibility', 'mobileFilmCountry', 'mobileFilmCollection',
  'mobileUtilityNature', 'mobileUtilityScope', 'mobileUtilityAudience',
  'mobileActivityDay', 'mobileActivityParticipation', 'mobileActivityAudience', 'mobileActivityFormat',
  'mobileSpaceInstitution', 'mobileSpaceOpenDay'
]) {
  assert.ok(appSource.includes(stateField), `Estado ausente: ${stateField}`);
}

assert.ok(appSource.includes("'utility', 'spaces', 'activities'].includes(state.mobileContent)"));
assert.ok(appSource.includes('function utilityScopeOptions()'));
assert.ok(appSource.includes('function agendaBookLibraryOptions()'));
assert.ok(appSource.includes('state.mobileUtilityAudience'));
assert.ok(appSource.includes('state.mobileTheme'));

// Cache e HTML precisam apontar para os mesmos assets novos.
for (const asset of [
  'css/styles.css?v=109',
  'js/conteudos/cursos.js?v=6',
  'js/conteudos/concursos.js?v=5',
  'js/conteudos/filmes.js?v=11',
  'js/conteudos/utilidade-publica.js?v=6',
  'js/conteudos/espacos.js?v=5',
  'js/conteudos/atividades-lazer.js?v=6',
  'js/temporalidade-eventos.js?v=1',
  'js/app.js?v=166',
  'js/mapa-espacos.js?v=2',
  'css/mapa-espacos.css?v=2'
]) {
  assert.ok(indexSource.includes(asset), `Asset ausente do index: ${asset}`);
  assert.ok(swSource.includes(`./${asset}`), `Asset ausente do service worker: ${asset}`);
}
assert.ok(swSource.includes('mural-cultural-v209-mapa-multiconteudo'));

// Situação editorial dos Eventos: delimitação exclusiva aos itens do TESTE.
const eventCatalog = JSON.parse(fs.readFileSync(path.join(root, 'eventos.json'), 'utf8'));
const eventRows = eventCatalog.eventos;
const editorialStart = appSource.indexOf('function eventMatchesEditorialStatus(');
const editorialEnd = appSource.indexOf('\n  function agendaVisibleEvents()', editorialStart);
assert.ok(editorialStart > 0 && editorialEnd > editorialStart, 'Função editorial deve existir.');
const editorialContext = vm.createContext({});
vm.runInContext(appSource.slice(editorialStart, editorialEnd), editorialContext);
const matchesEditorial = editorialContext.eventMatchesEditorialStatus;
assert.equal(typeof matchesEditorial, 'function');
const experimentalRows = eventRows.filter(item => matchesEditorial(item, 'experimental'));
const regularRows = eventRows.filter(item => matchesEditorial(item, 'regular'));
assert.ok(eventRows.length > 0, 'Catálogo de TESTE não deve estar vazio.');
// Após aprovação de todos os experimentais, a quantidade pendente pode ser zero.
assert.equal(experimentalRows.length, eventRows.filter(item => item.somente_teste === true).length);
assert.equal(regularRows.length + experimentalRows.length, eventRows.length);
assert.ok(experimentalRows.every(item => item.somente_teste === true));
assert.ok(regularRows.every(item => item.somente_teste !== true));
assert.ok(eventRows.every(item => matchesEditorial(item, '')), 'Filtro "Todos" deve preservar todos.');
assert.ok(appSource.includes('agenda-editorial-status'), 'Falta seletor editorial na interface.');
assert.ok(appSource.includes('state.mobileEditorialStatus = \'\';'), 'Filtro deve ser limpo ao mudar de conteúdo.');
assert.ok(appSource.includes("if (state.mobileContent === 'events' && state.mobileEditorialStatus) return state.allEvents;"), 'Filtro não deve usar amostragem rotativa.');
assert.ok(appSource.includes('if (!eventMatchesEditorialStatus(event, state.mobileEditorialStatus)) return false;'), 'Filtro não aplicado aos eventos.');
assert.ok(appSource.includes('isTestEditorialEnvironment() ?'), 'Seletor editorial deve aparecer no teste.');
assert.ok(appSource.includes('agenda-editorial-shortcut'), 'Atalho visível para análise não encontrado.');
assert.ok(appSource.includes('Ver somente experimentais'), 'Atalho deve mostrar contagem.');
assert.ok(appSource.includes("state.mobileEditorialStatus === 'experimental' ? '' : 'experimental'"), 'Atalho não alterna o filtro.');
const environmentStart = appSource.indexOf('function isTestEditorialEnvironment()');
const environmentEnd = appSource.indexOf('\n  function normalizeAgendaFiltersForContent(', environmentStart);
assert.ok(environmentStart > -1 && environmentEnd > environmentStart);
const environmentScript = appSource.slice(environmentStart, environmentEnd);
for (const [hostname, pathname, enabled] of [
  ['tiago-ps.github.io', '/EventosGratuitosBHeSabara/', true],
  ['tiago-ps.github.io', '/EventosGratuitosBHeSabara/index.html', true],
  ['temsimuai.com.br', '/', false],
  ['tiago-ps.github.io', '/outra-pagina/', false]
]) {
  const envContext = vm.createContext({ window: { location: { hostname, pathname } } });
  vm.runInContext(environmentScript, envContext);
  assert.equal(envContext.isTestEditorialEnvironment(), enabled);
}

console.log('Filtros completos do modo Exploração validados.');

 
// Exploração de Eventos: ELA não deve monopolizar os resultados iniciais.
const schoolStart = appSource.indexOf('function orderAgendaEventsForExploration(');
const schoolEnd = appSource.indexOf('function agendaVisibleEvents()', schoolStart);
assert.ok(schoolStart > 0 && schoolEnd > schoolStart, 'Ordenação especial ELA ausente.');
const schoolContext = vm.createContext({
  isSchoolEvent: item => String(item.programa || '').includes('Escola Livre de Artes Arena da Cultura')
});
vm.runInContext(appSource.slice(schoolStart, schoolEnd), schoolContext);
const isSchool = schoolContext.isSchoolEvent;
const allSchool = eventRows.filter(isSchool);
assert.ok(allSchool.length > 3, 'Base deve conter registros da ELA.');
const orderedEvents = schoolContext.orderAgendaEventsForExploration(eventRows);
assert.equal(orderedEvents.length, eventRows.length, 'Ordenação não pode excluir eventos.');
assert.equal(new Set(orderedEvents.map(item => item.id)).size, eventRows.length);
const firstOrdinary = orderedEvents.findIndex(item => !isSchool(item));
const ordinary = eventRows.filter(item => !isSchool(item));
assert.equal(orderedEvents[0].tipo_registro, 'programa_escola_livre');
assert.ok(firstOrdinary >= 1 && firstOrdinary <= 3, 'Até três registros iniciais da ELA.');
assert.deepEqual(Array.from(orderedEvents.slice(firstOrdinary, firstOrdinary + ordinary.length), item => item.id),
  ordinary.map(item => item.id), 'Outros eventos devem vir antes da lista extensa da ELA.');
assert.ok(orderedEvents.slice(firstOrdinary + ordinary.length).every(isSchool));
assert.ok(appSource.includes('if (specific && !agendaHasSpecificEventFilters())'),
  'Filtros e buscas específicos devem mostrar todas as atividades e ordenação normal.');
assert.ok(appSource.includes('return orderAgendaEventsForExploration(visible);'));

// Modo Interativo: estrela sincronizada com favoritos da Exploração e link de 1 item.
assert.ok(appSource.includes("document.documentElement.dataset.panelExperience !== 'interativo'"),
  'Modo Automático não deve receber as ações sobre a imagem.');
assert.ok(appSource.includes("app.querySelector('.slide .media')"));
assert.ok(appSource.includes('attachInteractiveSlideActions(item);'));
assert.ok(appSource.includes('panel-item-favorite') && appSource.includes('panel-item-share'));
assert.ok(appSource.includes('loadAgendaFavorites().has(favoriteId)'));
assert.ok(appSource.includes('saveAgendaFavorites(favorites)'));
const panelShareStart = appSource.indexOf('async function sharePanelItem(');
const panelShareEnd = appSource.indexOf('function goToNext()', panelShareStart);
const shareCode = appSource.slice(panelShareStart, panelShareEnd);
assert.ok(panelShareStart > -1 && panelShareEnd > panelShareStart);
assert.ok(shareCode.includes('const url = muralItemUrl(item);'));
assert.ok(!shareCode.includes('sharedAgendaUrl(') && !shareCode.includes('createShortSharedAgendaUrl('));
assert.ok(shareCode.includes('navigator.share(data)'));
assert.ok(shareCode.includes('navigator.clipboard.writeText(url)'));
const singleStart = appSource.indexOf('function muralItemUrl(');
const singleEnd = appSource.indexOf('function buildSiteQr(', singleStart);
const singleContext = vm.createContext({
  URL,
  muralPublicUrl: () => 'https://tiago-ps.github.io/EventosGratuitosBHeSabara/',
  agendaFavoriteId: item => item.tipo_conteudo + ':' + item.id
});
vm.runInContext(appSource.slice(singleStart, singleEnd), singleContext);
const singleUrl = new URL(singleContext.muralItemUrl({ tipo_conteudo: 'evento', id: 'teste-1' }));
assert.equal(singleUrl.searchParams.get('modo'), 'agenda');
assert.equal(singleUrl.searchParams.get('item'), 'evento:teste-1');
assert.equal(singleUrl.searchParams.has('selecao'), false);

 
// Testa a diferença real de experiência: ambos são Painel, mas só interativo
// admite botões. No passivo, nem se consulta o local de inserção dos botões.
const panelStart = appSource.indexOf('function attachInteractiveSlideActions(');
const panelEnd = appSource.indexOf('async function sharePanelItem(',panelStart);
assert.ok(panelStart > 0 && panelEnd > panelStart);
let panelSearches = 0;
const contextModes = vm.createContext({
  state: {viewMode:'painel'},
  document: {documentElement:{dataset:{panelExperience:'passivo'}}},
  app: {querySelector(){panelSearches++;return null;}},
  agendaFavoriteId: ()=> 'evento:exemplo'
});
vm.runInContext(appSource.slice(panelStart,panelEnd),contextModes);
contextModes.attachInteractiveSlideActions({tipo_conteudo:'evento',id:'exemplo'});
assert.equal(panelSearches,0,'Painel Automático não pode criar os botões.');
contextModes.document.documentElement.dataset.panelExperience='interativo';
contextModes.attachInteractiveSlideActions({tipo_conteudo:'evento',id:'exemplo'});
assert.equal(panelSearches,1,'Painel Interativo deve poder criar os botões.');

// Na Exploração, o botão Compartilhar deve ficar junto da estrela e
// enviar exatamente o item selecionado, sem alterar a lista de favoritos.
const decorateStart = appSource.indexOf('function decorateAgendaFavorite(');
const decorateEnd = appSource.indexOf('function renderAgendaCard(',decorateStart);
assert.ok(decorateStart > 0 && decorateEnd > decorateStart);
const created = [];
const selectedItem = {id:'exemplo',tipo_conteudo:'evento',titulo:'Exemplo'};
let shared = null;
const favoritesSaved = new Set();
const agendaCtx = vm.createContext({
  state:{curationMode:true,mobileFavoritesOnly:false},
  document:{querySelectorAll(){return [];},createElement(tag){
    const node={
      tag, className:'',dataset:{},attrs:{},listeners:{},
      setAttribute(k,v){this.attrs[k]=v;},
      addEventListener(k,fn){this.listeners[k]=fn;},
      classList:{toggle(){}}
    };
    created.push(node);return node;
  }},
  agendaFavoriteId:item=>item.tipo_conteudo+':'+item.id,
  loadAgendaFavorites:()=>new Set(favoritesSaved),
  saveAgendaFavorites:favs=>{favoritesSaved.clear();for(const id of favs)favoritesSaved.add(id);},
  sharePanelItem:item=>{shared=item;}
});
vm.runInContext(appSource.slice(decorateStart,decorateEnd),agendaCtx);
const card={dataset:{},elements:[],append(...items){this.elements.push(...items);}};
agendaCtx.decorateAgendaFavorite(card,selectedItem);
assert.equal(card.elements.length,2,'Exploração deve ter dois botões sobre a imagem.');
assert.ok(card.elements[0].className.includes('agenda-share-item-button'));
assert.ok(card.elements[1].className.includes('agenda-favorite-button'));
const evt={preventDefault(){},stopPropagation(){}};
card.elements[0].listeners.click(evt);
assert.equal(shared,selectedItem,'Compartilhar deve usar o item do card.');
card.elements[1].listeners.click(evt);
assert.ok(favoritesSaved.has('evento:exemplo'),'Favoritos devem usar a mesma lista.');
const stylesSource=fs.readFileSync(path.join(root,'css/styles.css'),'utf8');
assert.ok(stylesSource.includes('html[data-panel-experience="passivo"] body.panel-mode .panel-item-actions'));
assert.ok(stylesSource.includes('body.agenda-mode .agenda-card .agenda-share-item-button'));
console.log('Visibilidade dos botões e compartilhamento individual: validados.');
