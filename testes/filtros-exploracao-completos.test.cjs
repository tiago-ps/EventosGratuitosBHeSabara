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
  'css/styles.css?v=106',
  'js/conteudos/cursos.js?v=5',
  'js/conteudos/concursos.js?v=5',
  'js/conteudos/filmes.js?v=11',
  'js/conteudos/espacos.js?v=5',
  'js/conteudos/atividades-lazer.js?v=6',
  'js/temporalidade-eventos.js?v=1',
  'js/app.js?v=156'
]) {
  assert.ok(indexSource.includes(asset), `Asset ausente do index: ${asset}`);
  assert.ok(swSource.includes(`./${asset}`), `Asset ausente do service worker: ${asset}`);
}
assert.ok(swSource.includes('mural-cultural-v199-eventos-temporalidade'));

console.log('Filtros completos do modo Exploração validados.');
