(() => {
  'use strict';

  const DATA_URL = 'eventos.json';
  const RELATIONS_URL = 'relacoes-eventos.json';
  const BOOKS_URL = 'livros.json';
  const CURATION_BOOKS_URL = 'catalogo-curadoria-livros.json';
  const CURATION_BOOK_COVERS_URL = 'capas-curadoria-livros.json';
  const CURATION_BOOKS_ENTRY_URL = 'https://tiago-ps.github.io/EventosGratuitosBHeSabara/';
  const COURSES_URL = 'cursos.json';
  const CONTESTS_URL = 'concursos.json';
  const FILMS_URL = 'filmes.json';
  const PLATFORMS_URL = 'plataformas-audiovisuais.json';
  const UTILITY_URL = 'utilidade-publica.json';
  const ACTIVITIES_URL = 'atividades-lazer.json';
  const SPACES_URL = 'espacos_culturais.json';
  const SITE_CURATIONS_INDEX_URL = 'curadorias/index.json';
  const CONFIG_URL = 'configuracao-mural.json';
  const PUBLICATION_MANIFEST_URL = 'publicacao-manifest.json';
  const LIVE_PUBLICATION_CHECK_MS = 5 * 60 * 1000;
  const app = document.getElementById('app');
  const SCHOOL_ROTATION_SIZE = 6;
  const SCHOOL_ROTATION_KEY = 'agenda-cultural-escola-livre-lote';
  const SLIDE_DURATION_KEY = 'mural-cultural-tempo-slides';
  const PANEL_SETTINGS_KEY = 'mural-cultural-configuracao-painel-v2';
  const PANEL_PROFILES_KEY = 'mural-cultural-perfis-painel-v1';
  const PANEL_PROFILE_ATTRIBUTE = 'panelProfile';
  const AGENDA_BATCH_SIZE = 24;
  const AGENDA_COLOR_SCHEME_KEY = 'tem-sim-uai-agenda-color-scheme';
  const AGENDA_FAVORITES_KEY = 'mural-cultural-favoritos-v1';
  const PUBLIC_CURATION_ALIASES = Object.freeze({
    ufmg: 'vestibular-ufmg-seriado-2026',
    fuvest: 'vestibular-fuvest-2027',
    'saude-mental': 'saude-mental',
    'agosto-lilas': 'agosto-lilas'
  });
  const AGENDA_CONTENT_LABELS = Object.freeze({
    events: { singular: 'evento', plural: 'eventos' },
    books: { singular: 'livro', plural: 'livros' },
    courses: { singular: 'curso', plural: 'cursos' },
    contests: { singular: 'concurso', plural: 'concursos' },
    films: { singular: 'filme', plural: 'filmes' },
    utility: { singular: 'item de utilidade pública', plural: 'itens de utilidade pública' },
    spaces: { singular: 'espaço', plural: 'espaços' },
    activities: { singular: 'atividade de esporte e lazer', plural: 'atividades de esporte e lazer' }
  });
  const PANEL_UTILITY_LIMIT = 4;
  const PANEL_ACTIVITY_LIMIT = 6;
  const PANEL_BOOK_LIMIT = 15;
  const PANEL_EVENTS_PER_OTHER = 4;
  const PANEL_CURATION_EVENTS_PER_BLOCK = 5;
  // Registro central dos módulos do Painel. Um módulo registrado nasce ativo
  // por padrão e só deixa a rotação quando houver um false explícito.
  const PANEL_MODULE_CONFIG_KEYS = Object.freeze({
    events: 'eventos',
    books: 'livros',
    courses: 'cursos',
    contests: 'concursos',
    films: 'filmes',
    utility: 'utilidade_publica',
    spaces: 'espacos',
    activities: 'atividades_lazer'
  });
  const PANEL_MODULE_IDS = Object.freeze(Object.keys(PANEL_MODULE_CONFIG_KEYS));
  const PANEL_NON_EVENT_MODULE_IDS = Object.freeze(
    PANEL_MODULE_IDS.filter(id => id !== 'events')
  );
  const ALLOWED_SLIDE_DURATIONS = new Set([0, 5, 8, 10, 12, 15, 20, 30]);
  const CONTENT_SUBTITLES = Object.freeze({
    evento: 'Agenda Cultural',
    livro: 'Sugestão de Leitura',
    curso: 'Curso Online Gratuito',
    filme: 'Sugestão de Filme',
    jogo: 'Sugestão de Jogo',
    passeio: 'Sugestão de Passeio',
    atividade_lazer: 'Esporte e Lazer',
    espaco: 'Espaços'
  });
  const template = document.getElementById('slide-template');
  const muralCore = window.MuralCultural.core;
  const coursesContent = window.MuralCultural.contents.courses;
  const contestsContent = window.MuralCultural.contents.contests;
  const filmsContent = window.MuralCultural.contents.films;
  const utilityContent = window.MuralCultural.contents.utility;
  const activitiesContent = window.MuralCultural.contents.activities;
  const spacesContent = window.MuralCultural.contents.spaces;
  const eventRelations = window.MuralCultural.eventRelations;
  const eventTemporal = window.MuralCultural.eventTemporal;
  const siteCurationsContent = window.MuralCultural.siteCurations;
  const notificationsContent = window.MuralCultural.notifications;
  let deferredInstallPrompt = null;
  let bookLocationsDialog = null;

  // O tema original é fixo; remove preferências antigas salvas pelo seletor.
  try {
    localStorage.removeItem('agenda-cultural-tema');
  } catch {
    /* O site funciona normalmente quando o armazenamento não está disponível. */
  }

  const categoryVisuals = {
    cinema: ['🎬', 'Cinema'],
    teatro: ['🎭', 'Teatro'],
    música: ['🎵', 'Música'],
    musica: ['🎵', 'Música'],
    oficina: ['🧩', 'Oficina'],
    curso: ['📚', 'Curso'],
    exposição: ['🖼️', 'Exposição'],
    exposicao: ['🖼️', 'Exposição'],
    palestra: ['🎤', 'Palestra'],
    informação: ['ℹ️', 'Informação'],
    informacao: ['ℹ️', 'Informação'],
    literatura: ['📖', 'Literatura'],
    dança: ['💃', 'Dança'],
    danca: ['💃', 'Dança'],
    infantil: ['🪁', 'Infantil'],
    visita: ['🏛️', 'Visita'],
    festival: ['✨', 'Festival'],
    default: ['📅', 'Evento']
  };

  /*
   * Imagens padrão por local.
   *
   * A chave deve estar em minúsculas e sem acentos,
   * pois será comparada com o texto normalizado do campo "local".
   */
  const localImages = {
    'cine santa tereza': 'imagens/CineSantaTerezaBH.png',
    'espaco do conhecimento ufmg': 'https://www.ufmg.br/app/uploads/2026/04/Predio-do-Espaco-do-Conhecimento-UFMG-Creditos-Fernando-Silva-1-2-scaled.jpg'
  };

  /*
   * Imagens padrão por programa.
   *
   * São usadas quando o evento não possui imagem própria e o local também
   * não possui uma imagem padrão cadastrada.
   */
  const programImages = {
    'escola livre de artes arena da cultura':
      'imagens/eventos-manuais/escola-livre-de-artes.png'
  };

  let state = {
    data: null,
    relationsData: null,
    eventRelationsIndex: Object.create(null),
    booksData: null,
    curationBooksData: null,
    curationBookCoversData: null,
    curationMode: false,
    coursesData: null,
    contestsData: null,
    filmsData: null,
    platformsData: null,
    utilityData: null,
    activitiesData: null,
    spacesData: null,
    siteCurationsData: null,
    config: null,
    publicationCourseHash: '',
    publicationWatchTimer: null,
    allEvents: [],
    allBooks: [],
    allCourses: [],
    allContests: [],
    allFilms: [],
    allUtility: [],
    allActivities: [],
    allSpaces: [],
    events: [],
    panelRoundSamples: Object.fromEntries(PANEL_NON_EVENT_MODULE_IDS.map(id => [id, []])),
    panelMemory: muralCore.createPanelMemory(),
    panelRoundSteps: [],
    panelSeenSteps: new WeakSet(),
    index: 0,
    timer: null,
    isPaused: false,
    btnNext: null,
    btnPrev: null,
    btnPlayPause: null,
    btnFilter: null,
    filterOverlay: null,
    panelModules: Object.fromEntries(PANEL_MODULE_IDS.map(id => [id, true])),
    panelEventCities: [],
    panelBookCampuses: [],
    panelWeights: Object.fromEntries(PANEL_MODULE_IDS.map(id => [id, id === 'events' ? 5 : 1])),
    filters: {
      content: 'all',
      theme: '',
      category: '',
      program: '',
      unit: '',
      period: 'all',
      rating: '',
      bookAccess: '',
      filmGenre: '',
      filmPlatform: '',
      filmRating: '',
      filmDuration: ''
    },
    schoolRotationBatch: 0,
    viewMode: 'auto',
    slideDuration: 0,
    mobileQuery: '',
    mobileFiltersOpen: false,
    mobileFavoritesOnly: false,
    mobileSharedSelection: null,
    mobileFocusedItem: '',
    mobileContent: 'all',
    mobileCuration: '',
    mobileTheme: '',
    mobilePeriod: 'all',
    mobileCategory: '',
    mobileCity: '',
    mobileSpace: '',
    mobileInstitution: '',
    mobileRegistration: '',
    mobileBookAccess: '',
    mobileBookCover: '',
    mobileBookLibrary: '',
    mobileBookYearFrom: '',
    mobileBookYearTo: '',
    mobileBookAudiobook: '',
    mobileCourseInstitution: '',
    mobileCourseArea: '',
    mobileCourseWorkload: '',
    mobileCourseType: '',
    mobileCourseLevel: '',
    mobileCourseLanguage: '',
    mobileCourseCertificate: '',
    mobileContestFormation: '',
    mobileContestUf: '',
    mobileContestCity: '',
    mobileContestDeadline: '',
    mobileContestState: '',
    mobileContestRemuneration: '',
    mobileFilmGenre: '',
    mobileFilmPlatform: '',
    mobileFilmLetter: '',
    mobileFilmAccessibility: '',
    mobileFilmCountry: '',
    mobileFilmCollection: '',
    mobileFilmRating: '',
    mobileFilmYearFrom: '',
    mobileFilmYearTo: '',
    mobileFilmDuration: '',
    mobileFilmSort: 'title-asc',
    mobileActivityCity: '',
    mobileActivityCategory: '',
    mobileActivityModality: '',
    mobileActivityDay: '',
    mobileActivityParticipation: '',
    mobileActivityAudience: '',
    mobileActivityFormat: '',
    mobileSpaceCity: '',
    mobileSpaceVocation: '',
    mobileSpaceNature: '',
    mobileSpaceInstitution: '',
    mobileSpaceOpenDay: '',
    mobileUtilityArea: '',
    mobileUtilityType: '',
    mobileUtilityNature: '',
    mobileUtilityScope: '',
    mobileUtilityAudience: '',
    agendaVisibleCounts: {
      events: AGENDA_BATCH_SIZE,
      books: AGENDA_BATCH_SIZE,
      courses: AGENDA_BATCH_SIZE,
      contests: AGENDA_BATCH_SIZE,
      films: AGENDA_BATCH_SIZE,
      utility: AGENDA_BATCH_SIZE,
      spaces: AGENDA_BATCH_SIZE,
      activities: AGENDA_BATCH_SIZE
    }
  };

  function curationModeFromUrl() {
    const params = new URL(window.location.href).searchParams;
    return params.get('modo') === 'curadoria';
  }

  function requestedCurationContentFromUrl() {
    try {
      const value = String(new URL(window.location.href).searchParams.get('conteudo') || '')
        .trim()
        .toLowerCase();
      return value === 'livros' ? 'books' : '';
    } catch {
      return '';
    }
  }

  function requestedAgendaItemFromUrl() {
    try {
      const value = String(new URL(window.location.href).searchParams.get('item') || '').trim();
      if (!value || value.length > 500 || !value.includes(':')) return '';
      return value;
    } catch {
      return '';
    }
  }

  function clearFocusedAgendaItemUrl() {
    try {
      const url = new URL(window.location.href);
      if (!url.searchParams.has('item')) return;
      url.searchParams.delete('item');
      history.replaceState(history.state, '', url);
    } catch {
      // A exploração continua funcional mesmo sem normalizar a URL.
    }
  }

  function exitFocusedAgendaItem() {
    state.mobileFocusedItem = '';
    clearFocusedAgendaItemUrl();
  }

  function curationBooksContributionUrl() {
    try {
      const onCurationHost =
        window.location.hostname === 'tiago-ps.github.io' &&
        /^\/EventosGratuitosBHeSabara(?:\/|$)/.test(window.location.pathname);
      const url = onCurationHost
        ? new URL(window.location.href)
        : new URL(CURATION_BOOKS_ENTRY_URL);
      url.search = '';
      url.hash = '';
      url.searchParams.set('modo', 'curadoria');
      url.searchParams.set('conteudo', 'livros');
      return url.toString();
    } catch {
      return `${CURATION_BOOKS_ENTRY_URL}?modo=curadoria&conteudo=livros`;
    }
  }

  function normalizeCurationBook(item) {
    if (!item || typeof item !== 'object' || !item.id) return null;
    return {
      ...item,
      tipo_conteudo: 'livro',
      titulo: String(item.titulo || item.titulo_completo || 'Livro sem título informado').trim(),
      autor: String(item.autor || item.autoria || '').trim(),
      acesso_fisico: item.acesso_fisico === true || item.acesso?.fisico === true,
      acesso_virtual: item.acesso_virtual === true || item.acesso?.virtual === true,
      pergunta_curiosidade: '',
      texto_apoio: String(item.texto_apoio || '').trim(),
      _catalogo_curadoria: true
    };
  }

  function curationBookPhysicalCode(item) {
    const match = String(item?.id || '').match(/^ifmg-sabara-fisico-(.+)$/);
    return match ? match[1] : '';
  }

  function curationBookCoverUrl(item, coverMap = {}) {
    const code = curationBookPhysicalCode(item);
    return code ? String(coverMap?.[code] || '').trim() : '';
  }

  function publicCurationBookRecord(item, coverMap = {}) {
    const normalized = normalizeCurationBook(item);
    if (!normalized) return null;
    const automaticCover = curationBookCoverUrl(normalized, coverMap);
    const cover = normalized.imagem || automaticCover;
    return {
      id: normalized.id,
      titulo: normalized.titulo,
      autor: normalized.autor,
      acesso_fisico: normalized.acesso_fisico,
      acesso_virtual: normalized.acesso_virtual,
      icone: normalized.icone || '📚',
      imagem: cover,
      temas: Array.isArray(normalized.temas) ? normalized.temas : [],
      tipo_conteudo: 'livro',
      _catalogo_curadoria: true,
      _capa_automatica: normalized.capa_automatica === true ||
        Boolean(automaticCover && cover === automaticCover)
    };
  }

  function mergeCurationBooks(publicBooks, catalogBooks, coverMap = {}) {
    const byId = new Map(publicBooks.map(book => {
      const automaticCover = curationBookCoverUrl(book, coverMap);
      const withCover = book.imagem
        ? book
        : automaticCover
          ? { ...book, imagem: automaticCover, _capa_automatica: true }
          : book;
      return [String(withCover.id), withCover];
    }));
    catalogBooks.map(item => publicCurationBookRecord(item, coverMap)).filter(Boolean).forEach(book => {
      if (!byId.has(String(book.id))) byId.set(String(book.id), book);
    });
    return [...byId.values()];
  }

  function normalizeText(value = '') {
    return String(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function escapeHtml(value = '') {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function safeImageUrl(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    try {
      const parsed = new URL(text, window.location.href);
      return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '';
    } catch {
      return '';
    }
  }

  function normalizeRating(value = '') {
    const raw = String(value || '').trim();
    const normalized = normalizeText(raw);

    if (!normalized) {
      return null;
    }

    if (normalized === 'l' || normalized.includes('livre')) {
      return { label: 'LIVRE', className: 'rating-livre', accessible: 'Livre' };
    }

    const match = normalized.match(/(?:^|\D)(10|12|14|16|18)(?:\D|$)/);
    if (!match) {
      return null;
    }

    const age = match[1];
    return {
      label: `${age} ANOS`,
      className: `rating-${age}`,
      accessible: `${age} anos`
    };
  }

  function joinCityNames(cities) {
    const uniqueCities = [...new Set(
      cities
        .map(city => String(city || '').trim())
        .filter(Boolean)
    )];

    if (uniqueCities.length <= 1) {
      return uniqueCities[0] || '';
    }

    if (uniqueCities.length === 2) {
      return `${uniqueCities[0]} e ${uniqueCities[1]}`;
    }

    return `${uniqueCities.slice(0, -1).join(', ')} e ${uniqueCities.at(-1)}`;
  }

  function getPanelTitleParts(titleValue, events) {
    const fallbackTitle = 'Mural Cultural';
    const rawTitle = String(titleValue || fallbackTitle).trim();
    const parts = rawTitle.split(/\s+(?:-|–|—)\s+/, 2);

    const mainTitle = parts[0] || fallbackTitle;
    const citiesFromTitle = parts[1] || '';
    const citiesFromEvents = joinCityNames(
      events.map(event => event.cidade)
    );

    return {
      mainTitle,
      citiesTitle: citiesFromTitle || citiesFromEvents
    };
  }

  function getLocalImage(event) {
    const explicitImage = String(event.imagem_local || '').trim();
    if (explicitImage) return explicitImage;

    const locals = [
      eventCanonicalPlace(event),
      event.local
    ].map(normalizeText).filter(Boolean);

    for (const local of locals) {
      for (const [localName, imagePath] of Object.entries(localImages)) {
        if (local.includes(localName)) {
          return imagePath;
        }
      }
    }

    return '';
  }

  function getProgramImage(event) {
    const explicitImage = String(event.imagem_programa || '').trim();
    if (explicitImage) return explicitImage;

    const program = normalizeText(event.programa);

    if (!program) {
      return '';
    }

    for (const [programName, imagePath] of Object.entries(programImages)) {
      if (program.includes(programName)) {
        return imagePath;
      }
    }

    return '';
  }

  function safeDate(dateString) {
    if (!dateString) return null;

    const date = new Date(`${dateString}T23:59:59`);

    return Number.isNaN(date.getTime()) ? null : date;
  }

  function todayAtMidnight() {
    const now = new Date();

    return new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
  }

  const CLOSED_ACCESS_STATUSES = new Set([
    'encerrada', 'encerrada provavel', 'esgotado', 'indisponivel'
  ]);

  function displayCriterion(event) {
    if (eventTemporal?.displayCriterion) return eventTemporal.displayCriterion(event);
    const value = normalizeText(event?.criterio_exibicao);
    return ['inscricao', 'acesso', 'manual', 'realizacao'].includes(value)
      ? value
      : 'realizacao';
  }

  function eventRealization(event) {
    if (eventTemporal?.realization) return eventTemporal.realization(event);
    const start = String(event?.data || '').slice(0, 10);
    const end = String(event?.data_fim || start).slice(0, 10);
    return { classe: end && end !== start ? 'periodo' : 'pontual', inicio: start, fim: end };
  }

  function eventParticipation(event, type) {
    if (eventTemporal?.participation) return eventTemporal.participation(event, type);
    const prefix = type === 'acesso' ? 'acesso' : 'inscricao';
    const inicio = String(event?.[`${prefix}_inicio`] || '').slice(0, 10);
    const fim = String(event?.[`${prefix}_fim`] || '').slice(0, 10);
    const status = String(event?.[`status_${prefix}`] || '').trim();
    const observacao = String(event?.[prefix] || '').trim();
    return inicio || fim || status || observacao
      ? { tipo: prefix, inicio, fim, status, observacao, canonica: false }
      : null;
  }


  function isGoogleFormUrl(value) {
    const link = safeExternalUrl(value);
    if (!link) return false;
    try {
      const url = new URL(link);
      const host = url.hostname.toLowerCase();
      return host === 'forms.gle' ||
        ((host === 'docs.google.com' || host === 'forms.google.com') && url.pathname.toLowerCase().includes('/forms'));
    } catch {
      return false;
    }
  }

  function registrationIsClosed(event) {
    const participation = eventParticipation(event, 'inscricao');
    const registrationStatus = normalizeText(
      participation?.status || event?.status_inscricao
    ).replaceAll('_', ' ');
    const formStatus = normalizeText(event?.status_formulario_google).replaceAll('_', ' ');
    return Boolean(
      eventTemporal?.isClosedStatus?.(registrationStatus) ||
      CLOSED_ACCESS_STATUSES.has(registrationStatus) ||
      formStatus === 'fechado'
    );
  }

  function eventPublicLink(event) {
    const registration = safeExternalUrl(event.link_inscricao);
    const primary = safeExternalUrl(event.link);
    const page = safeExternalUrl(event.pagina);
    const formAction = normalizeText(event.formulario_google_acao_aplicada).replaceAll('_', ' ');
    const suppressClosedForm = registrationIsClosed(event) &&
      ['marcar encerrada', 'retirar link'].includes(formAction);

    if (suppressClosedForm) {
      return [page, primary].find(link => link && !isGoogleFormUrl(link)) || '';
    }
    return registration || primary || page;
  }

  function eventIsPublishable(event, today = todayAtMidnight()) {
    if (event?.exibicao_ativa === false) return false;
    if (eventTemporal?.isPublishable && !eventTemporal.isPublishable(event, today)) {
      return false;
    }

    const criterion = displayCriterion(event);
    if (criterion === 'inscricao' && registrationIsClosed(event)) return false;

    if (!eventTemporal?.isPublishable) {
      if (criterion === 'manual') return event.exibicao_ativa !== false;
      if (criterion === 'inscricao' || criterion === 'acesso') {
        const participation = eventParticipation(event, criterion);
        const status = normalizeText(participation?.status).replaceAll('_', ' ');
        if (CLOSED_ACCESS_STATUSES.has(status)) return false;
        const deadline = safeDate(participation?.fim);
        return !deadline || deadline >= today;
      }
      const realization = eventRealization(event);
      const end = safeDate(realization.fim || realization.inicio);
      return !end || end >= today;
    }

    return true;
  }

  function eventSortKey(event) {
    if (eventTemporal?.sortKey) return eventTemporal.sortKey(event);
    const criterion = displayCriterion(event);
    const realizationWindow = eventRealization(event);
    const realization = safeDate(realizationWindow.inicio)?.getTime() || Number.MAX_SAFE_INTEGER;
    if (criterion === 'inscricao' || criterion === 'acesso') {
      const deadline = safeDate(eventParticipation(event, criterion)?.fim)?.getTime();
      return [deadline ? 0 : 1, deadline || realization, realization];
    }
    return [2, realization, realization];
  }

  function filterAndSort(events) {
    const today = todayAtMidnight();

    return events
      .filter(event => event && event.titulo && (
        event.data ||
        eventTemporal?.temporalClass?.(event)
      ))
      .filter(event => eventIsPublishable(event, today))
      .sort((a, b) => {
        const ka = eventSortKey(a);
        const kb = eventSortKey(b);
        return ka[0] - kb[0] || ka[1] - kb[1] || ka[2] - kb[2] ||
          String(a.horario || '').localeCompare(String(b.horario || ''), 'pt-BR') ||
          String(a.titulo || '').localeCompare(String(b.titulo || ''), 'pt-BR');
      });
  }

  function bookIsPublishable(book, today = todayAtMidnight()) {
    if (!book || !book.titulo || book.exibicao_ativa === false) return false;
    const start = parseCalendarDate(book.exibir_de);
    const end = parseCalendarDate(book.exibir_ate, true);
    if (start && today < start) return false;
    if (end && today > end) return false;
    return Boolean(book.link && (book.imagem || book.site_only));
  }

  function bookAcervos(book) {
    if (Array.isArray(book?.acervos) && book.acervos.length) {
      return book.acervos.map(acervo => {
        const registrosOriginais = Array.isArray(acervo?.registros) && acervo.registros.length
          ? acervo.registros
          : [acervo];
        const registros = registrosOriginais.map(registro => ({
          ...registro,
          biblioteca: registro?.biblioteca || acervo?.biblioteca || '',
          biblioteca_rede: registro?.biblioteca_rede || acervo?.biblioteca_rede || '',
          unidade: registro?.unidade || acervo?.unidade || '',
        }));
        return { ...acervo, registros };
      });
    }

    // Compatibilidade com livros.json v1: transforma o registro único em um acervo.
    return [{
      biblioteca: '',
      biblioteca_rede: book?.biblioteca_rede || book?.biblioteca || '',
      unidade: book?.unidade || book?.campus || book?.campus_acervo || '',
      registros: [{
        registro_id: book?.id || '',
        biblioteca_rede: book?.biblioteca_rede || book?.biblioteca || '',
        unidade: book?.unidade || book?.campus || book?.campus_acervo || '',
        numero_chamada: book?.numero_chamada || '',
        codigo_acervo: book?.codigo_acervo || '',
        exemplares_fisicos_catalogados: Number(book?.exemplares_fisicos_catalogados || 0),
        acesso_fisico: Boolean(book?.acesso_fisico),
        acesso_virtual: Boolean(book?.acesso_virtual),
        link_fisico: book?.link_fisico || '',
        link_virtual: book?.link_virtual || '',
        link: book?.link || '',
        fonte: book?.fonte || '',
      }],
    }];
  }

  function bookHoldingLabel(acervo) {
    const explicit = String(acervo?.biblioteca || '').trim();
    const rede = String(acervo?.biblioteca_rede || '').trim();
    const unidade = String(acervo?.unidade || '').trim();
    if (explicit) return explicit;
    if (rede && unidade && !normalizeText(rede).includes(normalizeText(unidade))) {
      return `${rede} — ${unidade}`;
    }
    return unidade || rede || 'Acervo não identificado';
  }

  function bookCampusLabels(book) {
    const values = new Map();
    for (const acervo of bookAcervos(book)) {
      const label = bookHoldingLabel(acervo);
      const value = normalizeText(label);
      if (value && !values.has(value)) values.set(value, label);
    }
    return [...values.values()];
  }

  function bookCampusLabel(book) {
    return bookCampusLabels(book)[0] || String(book?.fonte || state.booksData?.origem || 'Acervo não identificado');
  }

  function bookHoldings(book) {
    return bookAcervos(book).flatMap(acervo =>
      (acervo.registros || []).map(registro => ({
        ...registro,
        biblioteca: bookHoldingLabel(acervo),
        biblioteca_rede: registro.biblioteca_rede || acervo.biblioteca_rede || '',
        unidade: registro.unidade || acervo.unidade || '',
      }))
    );
  }

  function firstBookHoldingUrl(book, field) {
    for (const holding of bookHoldings(book)) {
      const url = safeExternalUrl(holding?.[field]);
      if (url) return url;
    }
    return safeExternalUrl(book?.[field]);
  }

  function bookAudiobookUrl(book) {
    return safeExternalUrl(book?.link_audiolivro);
  }

  function bookAudiobookLabel(book) {
    const source = String(book?.audiolivro_fonte || '').trim();
    return source ? `Ouvir audiolivro — ${source}` : 'Ouvir audiolivro';
  }

  function panelBookRecordLinks(record) {
    const links = new Map();
    const virtualLabel = record?.tipo_registro === 'acesso_integral_legal'
      ? 'Abrir acesso integral legal' : 'Abrir edição virtual';
    for (const [field, label] of [
      ['link_fisico', 'Abrir catálogo'],
      ['link_virtual', virtualLabel],
      ['link', record?.tipo_registro === 'acesso_integral_legal' ? virtualLabel : 'Abrir catálogo']
    ]) {
      const url = safeExternalUrl(record?.[field]);
      if (url && !links.has(url)) links.set(url, label);
    }
    return [...links];
  }

  function panelBookLocations(book) {
    // Mantém os acervos e seus registros; uma busca também é um local de consulta.
    return bookAcervos(book).filter(acervo =>
      acervo.registros.some(record => panelBookRecordLinks(record).length)
    );
  }

  function createBookLocationsButton(book, locations) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'book-locations-button';
    button.textContent = 'Ver locais disponíveis';
    button.setAttribute('aria-haspopup', 'dialog');
    button.setAttribute('aria-controls', 'panel-book-locations');
    button.addEventListener('click', () => openBookLocations(book, locations, button));
    return button;
  }

  function openBookLocations(book, locations, opener) {
    if (!bookLocationsDialog) {
      bookLocationsDialog = document.createElement('dialog');
      bookLocationsDialog.id = 'panel-book-locations';
      bookLocationsDialog.className = 'book-locations-dialog';
      bookLocationsDialog.setAttribute('aria-modal', 'true');
      bookLocationsDialog.setAttribute('aria-labelledby', 'panel-book-locations-title');
      bookLocationsDialog.setAttribute('aria-describedby', 'panel-book-locations-book');
      document.body.append(bookLocationsDialog);
      bookLocationsDialog.addEventListener('click', event => {
        const bounds = bookLocationsDialog.getBoundingClientRect();
        if (event.target === bookLocationsDialog && (
          event.clientX < bounds.left || event.clientX > bounds.right ||
          event.clientY < bounds.top || event.clientY > bounds.bottom
        )) bookLocationsDialog.close();
      });
      bookLocationsDialog.addEventListener('keydown', event => {
        if (event.key !== 'Tab') return;
        const controls = [...bookLocationsDialog.querySelectorAll('a[href], button')];
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      });
    }
    if (bookLocationsDialog.open) return;

    const appendText = (parent, tag, text) => {
      const element = document.createElement(tag);
      element.textContent = text;
      parent.append(element);
      return element;
    };
    bookLocationsDialog.replaceChildren();
    const title = appendText(bookLocationsDialog, 'h2', 'Onde encontrar este livro');
    title.id = 'panel-book-locations-title';
    title.tabIndex = -1;
    appendText(bookLocationsDialog, 'p', book.titulo || '').id = 'panel-book-locations-book';
    const list = document.createElement('ul');
    bookLocationsDialog.append(list);
    for (const location of locations) {
      const entry = document.createElement('li');
      list.append(entry);
      appendText(entry, 'h3', bookHoldingLabel(location));
      for (const [index, record] of location.registros.entries()) {
        const links = panelBookRecordLinks(record);
        const details = [...new Set([
          record.instituicao || location.instituicao || record.biblioteca_rede || location.biblioteca_rede,
          record.unidade || location.unidade || record.campus || location.campus,
          record.localidade || location.localidade || record.cidade || location.cidade
        ].map(value => String(value || '').trim()).filter(value => value && value !== bookHoldingLabel(location)))];
        if (details.length) appendText(entry, 'p', details.join(' • '));
        if (location.registros.length > 1) {
          appendText(entry, 'p', `Registro ${index + 1}${record.codigo_acervo ? ` · ${record.codigo_acervo}` : ''}`);
        }
        if (record.numero_chamada) appendText(entry, 'p', `Número de chamada: ${record.numero_chamada}`);
        if (record.disponibilidade_confirmada === false || record.tipo_registro === 'consulta_catalogo' ||
            (!record.acesso_fisico && !record.acesso_virtual &&
             !['exemplar_fisico_confirmado', 'acesso_integral_legal'].includes(record.tipo_registro))) {
          appendText(entry, 'p', 'Consulta ao catálogo; disponibilidade não confirmada.');
        } else if (record.tipo_registro === 'exemplar_fisico_confirmado' || record.acesso_fisico) {
          const count = Number(record.exemplares_fisicos_catalogados || 0);
          appendText(entry, 'p', count > 0
            ? `${count} ${count === 1 ? 'exemplar físico catalogado' : 'exemplares físicos catalogados'}`
            : 'Exemplar físico catalogado.');
        }
        if (!links.length) appendText(entry, 'p', 'Link de catálogo não informado.');
        for (const [url, label] of links) {
          const link = appendText(entry, 'a', label);
          link.href = url;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.setAttribute('aria-label', `${label} — ${bookHoldingLabel(location)} — registro ${index + 1}`);
        }
      }
    }
    const close = appendText(bookLocationsDialog, 'button', 'Fechar');
    close.type = 'button';
    close.className = 'book-locations-close';
    close.addEventListener('click', () => bookLocationsDialog.close());
    bookLocationsDialog.addEventListener('close', () => {
      document.body.classList.remove('book-locations-open');
      if (opener.isConnected) opener.focus();
      if (!state.isPaused && !document.hidden) scheduleNextSlide();
    }, { once: true });
    // showModal torna o restante da página inerte e oferece fechamento nativo com Esc.
    bookLocationsDialog.showModal();
    clearTimeout(state.timer);
    document.body.classList.add('book-locations-open');
    title.focus();
  }

  function bookLocationsSummary(book) {
    const acervos = bookAcervos(book);
    const labels = bookCampusLabels(book);
    const registros = bookHoldings(book);
    if (acervos.length > 1) {
      return `Disponível em ${acervos.length} acervos: ${labels.join(' • ')}`;
    }
    if (registros.length > 1) {
      return `${labels[0] || 'Acervo'} • ${registros.length} registros catalogados`;
    }
    const registro = registros[0] || {};
    const callNumber = String(registro.numero_chamada || book?.numero_chamada || '').trim();
    return [callNumber ? `Número de chamada: ${callNumber}` : '', labels[0] || ''].filter(Boolean).join(' • ');
  }

  function agendaBookHoldingsHtml(book) {
    const acervos = bookAcervos(book);
    if (!acervos.length) return '';
    const collapseOnMobile = acervos.length > 3;
    const blocks = acervos.map((acervo, acervoIndex) => {
      const label = bookHoldingLabel(acervo);
      const registros = Array.isArray(acervo.registros) ? acervo.registros : [];
      const recordsHtml = registros.map((registro, index) => {
        const call = String(registro.numero_chamada || '').trim();
        const code = String(registro.codigo_acervo || '').trim();
        const physical = safeExternalUrl(registro.link_fisico || registro.link);
        const virtual = safeExternalUrl(registro.link_virtual);
        const recordLabel = registros.length > 1
          ? `Registro ${index + 1}${code ? ` · ${code}` : ''}`
          : (code ? `Registro ${code}` : 'Registro do catálogo');
        const links = [
          physical ? `<a href="${escapeHtml(physical)}" target="_blank" rel="noopener noreferrer">${registros.length > 1 ? 'Abrir este registro' : 'Ver no catálogo'}</a>` : '',
          virtual ? `<a class="secondary" href="${escapeHtml(virtual)}" target="_blank" rel="noopener noreferrer">Edição virtual</a>` : '',
        ].filter(Boolean).join('');
        return `<div class="agenda-book-record">
          ${registros.length > 1 ? `<span class="agenda-book-record-label">${escapeHtml(recordLabel)}</span>` : ''}
          ${call ? `<span class="agenda-book-call">Número de chamada: ${escapeHtml(call)}</span>` : ''}
          ${links ? `<div class="agenda-book-record-actions">${links}</div>` : ''}
        </div>`;
      }).join('');
      const extraClass = collapseOnMobile && acervoIndex >= 3 ? ' agenda-book-holding-extra' : '';
      return `<div class="agenda-book-holding${extraClass}">
        <strong>${escapeHtml(label)}</strong>
        ${recordsHtml}
      </div>`;
    }).join('');
    const toggle = collapseOnMobile
      ? `<button type="button" class="agenda-book-holdings-toggle" aria-expanded="false">Ver todos os ${acervos.length} acervos</button>`
      : '';
    return `<section class="agenda-book-holdings${collapseOnMobile ? ' is-collapsible' : ''}" aria-label="Bibliotecas onde encontrar este livro">
      <h3>Onde encontrar</h3>
      ${blocks}
      ${toggle}
    </section>`;
  }

  function bindAgendaBookHoldingsToggle(article) {
    const holdings = article.querySelector('.agenda-book-holdings.is-collapsible');
    const button = holdings?.querySelector('.agenda-book-holdings-toggle');
    if (!holdings || !button) return;

    button.addEventListener('click', () => {
      const expanded = holdings.classList.toggle('is-expanded');
      button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      const total = holdings.querySelectorAll('.agenda-book-holding').length;
      button.textContent = expanded ? 'Mostrar menos acervos' : `Ver todos os ${total} acervos`;
    });
  }

  function bookMatchesFilters(book) {
    const theme = state.filters.theme;
    const access = state.filters.bookAccess;
    const themes = (Array.isArray(book.temas) ? book.temas : [])
      .map(normalizeText);
    if (theme && !themes.some(value => value === theme || value.includes(theme))) return false;

    if (state.panelBookCampuses.length) {
      const campuses = bookCampusLabels(book).map(normalizeText);
      if (!campuses.some(campus => state.panelBookCampuses.includes(campus))) return false;
    }

    if (access === 'physical' && !book.acesso_fisico) return false;
    if (access === 'virtual' && !book.acesso_virtual) return false;
    if (access === 'both' && !(book.acesso_fisico && book.acesso_virtual)) return false;
    return true;
  }

  function filterBooks(books) {
    const today = todayAtMidnight();
    return books
      .filter(book => bookIsPublishable(book, today))
      .filter(bookMatchesFilters)
      .sort((a, b) =>
        Number(b.prioridade || 0) - Number(a.prioridade || 0) ||
        String(a.titulo || '').localeCompare(String(b.titulo || ''), 'pt-BR')
      );
  }

  function hasEventFilters() {
    return Boolean(
      state.filters.theme || state.panelEventCities.length ||
      state.filters.category || state.filters.program ||
      state.filters.unit || state.filters.rating || state.filters.period !== 'all'
    );
  }

  function visibleEventsForFilters() {
    return hasEventFilters()
      ? applyUserFilters(eventsAvailableForCurrentFilters(state.allEvents))
      : buildDefaultEvents(state.allEvents);
  }

  // Centraliza o início de uma rodada do Painel. Ela é chamada ao carregar,
  // quando filtros/perfis mudam e somente após chegar ao último slide.
  function createPanelRound() {
    const moduleEnabled = id => {
      const configKey = PANEL_MODULE_CONFIG_KEYS[id];
      return state.panelModules[id] !== false &&
        (!configKey || state.config?.modulos?.[configKey] !== false);
    };

    const eventsEnabled = moduleEnabled('events');
    const booksEnabled = moduleEnabled('books');
    const coursesEnabled = moduleEnabled('courses');
    const contestsEnabled = moduleEnabled('contests');
    const filmsEnabled = moduleEnabled('films');
    const utilityEnabled = moduleEnabled('utility');
    const spacesEnabled = moduleEnabled('spaces');
    const activitiesEnabled = moduleEnabled('activities');

    const events = eventsEnabled ? visibleEventsForFilters() : [];
    const themedCourses = state.filters.theme
      ? state.allCourses.filter(course => courseMatchesTheme(course, state.filters.theme))
      : state.allCourses;
    const filmFilters = {
      genre: state.filters.filmGenre,
      platform: state.filters.filmPlatform,
      theme: state.filters.theme,
      rating: state.filters.filmRating,
      duration: state.filters.filmDuration,
      sort: 'title-asc'
    };
    const utilityTheme = normalizeText(state.filters.theme);
    const eligibleUtility = utilityEnabled ? utilitySource().filter(item => {
      if (item.support_target && !(state.siteCurationsData?.curadorias || []).some(curation =>
        siteCurationsContent.matchesCuration(item, curation) && siteCurationsContent.isPromoted(curation))) return false;
      return !utilityTheme || (Array.isArray(item.temas) ? item.temas : [])
        .some(theme => normalizeText(theme) === utilityTheme);
    }) : [];

    const eligibleNonEvents = {
      books: booksEnabled ? filterBooks(state.allBooks) : [],
      courses: coursesEnabled ? coursesContent.filter(themedCourses) : [],
      contests: contestsEnabled && !state.filters.theme
        ? contestsContent.filter(state.allContests).map(contestsContent.publicRecord)
        : [],
      films: filmsEnabled ? filmsContent.filter(state.allFilms, filmFilters, normalizeText) : [],
      utility: eligibleUtility,
      spaces: spacesEnabled
        ? spacesContent.filter(
            state.allSpaces.filter(item => item.exibicao_recorrente === true),
            { theme: state.filters.theme },
            normalizeText
          )
        : [],
      activities: activitiesEnabled
        ? activitiesContent.filter(state.allActivities, { theme: state.filters.theme }, normalizeText)
        : []
    };

    const sampleOptions = module => ({
      previousItems: state.panelRoundSamples[module],
      exposure: state.panelMemory.exposure
    });
    const customComposition = Boolean(state.filters.theme || activeEditorialPanelProfileId());
    const activeGeneralGroups = Object.entries(eligibleNonEvents)
      .filter(([, items]) => items.length);
    const generalSlots = events.length
      ? Math.ceil(events.length / PANEL_EVENTS_PER_OTHER)
      : activeGeneralGroups.length;
    const customLimits = {
      books: PANEL_BOOK_LIMIT,
      courses: coursesContent.PANEL_LIMIT || 15,
      contests: contestsContent.PANEL_CONTEST_LIMIT || 15,
      films: filmsContent.PANEL_LIMIT || 15,
      utility: PANEL_UTILITY_LIMIT,
      spaces: 6,
      activities: PANEL_ACTIVITY_LIMIT
    };

    // Na programação padrão, cada módulo não-evento pode fornecer itens até
    // preencher todas as vagas. A escolha efetiva é equilibrada pelo núcleo
    // de rotação, então nenhum módulo ganha peso fixo só por ter mais itens.
    state.panelRoundSamples = Object.fromEntries(
      PANEL_NON_EVENT_MODULE_IDS.map(id => {
        const items = eligibleNonEvents[id] || [];
        const limit = customComposition ? (customLimits[id] || generalSlots) : generalSlots;
        return [id, muralCore.sampleForPanel(items, limit, sampleOptions(id))];
      })
    );

    // Perfis temáticos explícitos conservam a composição e os pesos já
    // configurados. A programação padrão usa distribuição automática.
    if (customComposition) {
      const weightedGroups = [
        { id: 'events', items: events, weight: state.panelWeights.events },
        ...PANEL_NON_EVENT_MODULE_IDS.map(id => ({
          id,
          items: state.panelRoundSamples[id] || [],
          weight: state.panelWeights[id] || 1
        }))
      ];
      state.events = muralCore.interleaveContents(weightedGroups);
      state.panelRoundSteps = state.events.map(item => ({ item }));
    } else {
      // Curadorias promovidas continuam podendo inserir microblocos, mas a
      // distribuição geral dos tipos não-evento é calculada dinamicamente.
      const eligible = { events, ...eligibleNonEvents };
      const curations = (state.siteCurationsData?.curadorias || [])
        .filter(curation => siteCurationsContent.isPromoted(curation))
        .map(curation => {
          const settings = curation.perfil_painel?.configuracao;
          return {
            id: curation.id,
            items: Object.entries(eligible)
              .filter(([module]) => settings?.modules?.[module] !== false)
              .flatMap(([, items]) => items)
              .filter(item => siteCurationsContent.matchesCuration(item, curation))
          };
        });
      state.panelRoundSteps = muralCore.createPanelSequence(
        events,
        Object.entries(state.panelRoundSamples).map(([id, items]) => ({ id, items })),
        curations,
        state.panelMemory,
        {
          eventsPerOther: PANEL_EVENTS_PER_OTHER,
          eventsPerCuration: PANEL_CURATION_EVENTS_PER_BLOCK
        }
      );
      state.events = state.panelRoundSteps.map(step => step.item);
    }
    state.panelSeenSteps = new WeakSet();
    return state.events;
  }

  function rebuildVisibleItems() {
    return createPanelRound();
  }

  function parseCalendarDate(value, endOfDay = false) {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);

    if (!match) return null;

    const date = new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      endOfDay ? 23 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 999 : 0
    );

    return Number.isNaN(date.getTime()) ? null : date;
  }

  function addCalendarDays(date, amount) {
    const result = new Date(date);
    result.setDate(result.getDate() + amount);
    return result;
  }

  function eventIntersectsPeriod(event, rangeStart, rangeEnd) {
    if (eventTemporal?.intersectsPeriod) {
      return eventTemporal.intersectsPeriod(event, rangeStart, rangeEnd);
    }
    const criterion = displayCriterion(event);
    if (criterion === 'inscricao' || criterion === 'acesso') {
      const startValue = criterion === 'inscricao'
        ? (event.inscricao_inicio || event.data)
        : (event.acesso_inicio || event.data);
      const endValue = criterion === 'inscricao'
        ? event.inscricao_fim
        : event.acesso_fim;
      const windowStart = parseCalendarDate(startValue);
      // Prazo não informado + status disponível = janela aberta sem fim conhecido.
      const windowEnd = endValue
        ? parseCalendarDate(endValue, true)
        : new Date(9999, 11, 31, 23, 59, 59, 999);
      if (!windowStart || !windowEnd) return false;
      return windowStart <= rangeEnd && windowEnd >= rangeStart;
    }

    const eventStart = parseCalendarDate(event.data);
    const eventEnd = parseCalendarDate(event.data_fim || event.data, true);
    if (!eventStart || !eventEnd) return false;
    return eventStart <= rangeEnd && eventEnd >= rangeStart;
  }

  function eventMatchesPeriod(event, period) {
    if (!period || period === 'all') return true;

    const today = todayAtMidnight();
    let rangeStart = today;
    let rangeEnd = new Date(today);
    rangeEnd.setHours(23, 59, 59, 999);

    if (period === 'tomorrow') {
      rangeStart = addCalendarDays(today, 1);
      rangeEnd = new Date(rangeStart);
      rangeEnd.setHours(23, 59, 59, 999);
    } else if (period === 'weekend') {
      const day = today.getDay();
      const daysUntilSaturday = day === 6 ? 0 : day === 0 ? -1 : 6 - day;
      rangeStart = day === 0 ? addCalendarDays(today, -1) : addCalendarDays(today, daysUntilSaturday);
      rangeEnd = addCalendarDays(rangeStart, 1);
      rangeEnd.setHours(23, 59, 59, 999);
    } else if (period === '7days') {
      rangeEnd = addCalendarDays(today, 6);
      rangeEnd.setHours(23, 59, 59, 999);
    } else if (period === '30days') {
      rangeEnd = addCalendarDays(today, 29);
      rangeEnd.setHours(23, 59, 59, 999);
    }

    return eventIntersectsPeriod(event, rangeStart, rangeEnd);
  }

  function ratingFilterValue(value) {
    const rating = normalizeRating(value);

    if (!rating) return '';
    if (rating.label === 'LIVRE') return 'livre';

    return rating.label.match(/\d+/)?.[0] || '';
  }

  function schoolRotationRecords(events) {
    return events.filter(event => event.grupo_rotativo === 'escola_livre_unidades');
  }

  function hasUserFilters() {
    const defaults = defaultPanelSettings();
    const moduleSelectionChanged = PANEL_MODULE_IDS.some(
      id => state.panelModules[id] !== defaults.modules[id]
    );
    return Boolean(
      moduleSelectionChanged ||
      state.filters.theme || state.panelEventCities.length ||
      state.filters.category || state.filters.program || state.filters.unit ||
      state.filters.rating || state.filters.period !== 'all' ||
      state.filters.bookAccess || state.panelBookCampuses.length ||
      state.filters.filmGenre || state.filters.filmPlatform || state.filters.filmRating || state.filters.filmDuration
    );
  }

  function readStoredSchoolBatch() {
    try {
      const value = Number(localStorage.getItem(SCHOOL_ROTATION_KEY));
      return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
    } catch {
      return 0;
    }
  }

  function storeSchoolBatch(value) {
    try {
      localStorage.setItem(SCHOOL_ROTATION_KEY, String(value));
    } catch {
      /* O rodízio continua enquanto a página estiver aberta. */
    }
  }

  function buildDefaultEvents(events) {
    /*
     * Na exibição geral do Painel, a Escola Livre de Artes é representada
     * somente pelo slide institucional do programa. As dezenas de atividades
     * específicas e os antigos resumos rotativos por unidade aparecem apenas
     * quando o usuário procura/filtra explicitamente a Escola Livre, uma área
     * ou um espaço. Isso evita que um único programa domine a rotação geral.
     */
    const defaultEvents = events.filter(event => {
      if (isSchoolEvent(event)) {
        return event.tipo_registro === 'programa_escola_livre';
      }
      return event.exibicao_padrao !== false &&
        event.grupo_rotativo !== 'escola_livre_unidades';
    });

    return filterAndSort(defaultEvents);
  }

  function advanceSchoolRotation(direction = 1) {
    const total = schoolRotationRecords(state.allEvents).length;
    if (!total) return;
    const batches = Math.ceil(total / SCHOOL_ROTATION_SIZE);
    state.schoolRotationBatch =
      (state.schoolRotationBatch + direction + batches) % batches;
    storeSchoolBatch(state.schoolRotationBatch);
    rebuildVisibleItems();
  }

  function eventSearchFacets(event) {
    return [
      event.categoria,
      event.area_artistica,
      ...(Array.isArray(event.areas) ? event.areas : [])
    ].map(normalizeText).filter(Boolean);
  }

  function categoryMatches(event, category) {
    if (!category) return true;
    const facets = eventSearchFacets(event);
    return facets.some(value => value === category || value.includes(category));
  }

  function eventThemeLabels(event) {
    const values = [
      ...(Array.isArray(event.temas) ? event.temas : []),
      ...(Array.isArray(event.tags) ? event.tags : []),
      ...(Array.isArray(event.areas) ? event.areas : []),
      event.area_artistica
    ];
    const ignored = new Set([
      'curso', 'escola livre de artes', 'formacao artistica',
      normalizeText(event.categoria), normalizeText(eventProgram(event))
    ].filter(Boolean));
    const seen = new Set();
    return values
      .map(value => String(value || '').trim())
      .filter(Boolean)
      .filter(value => {
        const normalized = normalizeText(value);
        if (!normalized || ignored.has(normalized) || seen.has(normalized)) return false;
        seen.add(normalized);
        return true;
      });
  }

  function eventMatchesTheme(event, theme) {
    if (!theme) return true;
    return eventThemeLabels(event)
      .map(normalizeText)
      .some(value => value === theme || value.includes(theme));
  }

  function bookMatchesTheme(book, theme) {
    if (!theme) return true;
    return (Array.isArray(book.temas) ? book.temas : [])
      .map(normalizeText)
      .some(value => value === theme || value.includes(theme));
  }

  function courseMatchesTheme(course, theme) {
    if (!theme) return true;
    return (Array.isArray(course.temas) ? course.temas : [])
      .map(normalizeText)
      .some(value => value === theme || value.includes(theme));
  }

  function universalThemeOptions() {
    const values = new Map();
    const add = label => {
      const text = String(label || '').trim();
      const value = normalizeText(text);
      if (text && value && !values.has(value)) values.set(value, text);
    };
    for (const event of state.allEvents) eventThemeLabels(event).forEach(add);
    for (const book of state.allBooks) (Array.isArray(book.temas) ? book.temas : []).forEach(add);
    for (const course of state.allCourses) (Array.isArray(course.temas) ? course.temas : []).forEach(add);
    for (const movie of state.allFilms) (Array.isArray(movie.temas) ? movie.temas : []).forEach(add);
    for (const item of state.allUtility) (Array.isArray(item.temas) ? item.temas : []).forEach(add);
    for (const item of state.allSpaces) (Array.isArray(item.temas) ? item.temas : []).forEach(add);
    for (const item of state.allActivities) (Array.isArray(item.temas) ? item.temas : []).forEach(add);
    return [...values.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  }

  const EVENT_INSTITUTION_NAMES = Object.freeze({
  'ccbb-bh': 'CCBB Belo Horizonte',
  'espaco-conhecimento-ufmg': 'Espaço do Conhecimento UFMG',
  'fcs': 'Fundação Clóvis Salgado',
  'fundacao-municipal-cultura-bh': 'Fundação Municipal de Cultura de Belo Horizonte',
  'prefeitura-sabara': 'Prefeitura Municipal de Sabará',
  'Secretaria de Cultura de Sabará': 'Secretaria de Cultura de Sabará',
  'sesc-mg': 'Sesc em Minas',
  'sesiminas-bh': 'Centro Cultural SESIMINAS BH',
  'associacao-social-paroquia-santa-ines': 'Associação Social Paróquia Santa Inês'
});

function eventCanonicalPlace(event) {
  return eventRelations?.placeLabel?.(event, state.eventRelationsIndex) || '';
}

function eventInstitutionName(event) {
  const canonical = eventRelations?.institutionName?.(event, state.eventRelationsIndex) || '';
  if (canonical) return canonical;

  const legacyName = String(event?.instituicao || '').trim();
  if (legacyName) return legacyName;

  const institutionId = String(event?.instituicao_id || '').trim();
  return institutionId && EVENT_INSTITUTION_NAMES[institutionId]
    ? EVENT_INSTITUTION_NAMES[institutionId]
    : '';
}

function eventPlace(event) {
  return eventCanonicalPlace(event) ||
    String(event?.local || '').trim() ||
    String(event?.unidade || '').trim();
}

function eventProgram(event) {
  const program = String(event?.programa || '').trim();
  if (program) return program;

  const institution = eventInstitutionName(event);
  if (institution) return institution;

  const source = String(event?.fonte || '').trim();
  if (!source || /^instagram\s*(?:—|-|$)/i.test(source)) return '';
  return source;
}

  function eventUnit(event) {
    return eventCanonicalPlace(event) || event.unidade || event.local || '';
  }

  function isSchoolEvent(event) {
    return normalizeText(eventProgram(event)).includes(
      'escola livre de artes arena da cultura'
    );
  }

  function schoolProgramFilterIsActive() {
    return normalizeText(state.filters.program).includes(
      'escola livre de artes arena da cultura'
    );
  }

  function eventsAvailableForCurrentFilters(events) {
    /*
     * O programa Escola Livre libera todas as atividades para permitir a
     * navegação completa. Filtros de área/categoria ou espaço também precisam
     * consultar os registros individuais, mas o próprio filtro já restringe
     * quais deles serão exibidos.
     *
     * Filtros genéricos isolados (período, cidade e classificação) continuam
     * atuando sobre o mural reduzido, evitando liberar dezenas de cursos apenas
     * porque suas inscrições estão abertas no mesmo dia.
     */
    const needsSchoolActivityRecords = Boolean(
      schoolProgramFilterIsActive() ||
      state.filters.category ||
      state.filters.unit
    );

    return needsSchoolActivityRecords ? events : buildDefaultEvents(events);
  }

  function applyUserFilters(events) {
    const { theme, category, program, unit, period, rating } = state.filters;

    return events.filter(event => {
      if (event.exibicao_por_filtro === false) return false;

      /*
       * O registro geral da Escola Livre descreve todas as áreas oferecidas.
       * Em filtros temáticos, porém, devem aparecer apenas as atividades
       * específicas daquela área, e não o slide institucional do programa.
       */
      if (category && event.tipo_registro === 'programa_escola_livre') {
        return false;
      }

      if (!eventMatchesTheme(event, theme)) return false;
      if (state.panelEventCities.length && !state.panelEventCities.includes(normalizeText(event.cidade))) return false;
      if (!categoryMatches(event, category)) return false;
      if (program && normalizeText(eventProgram(event)) !== program) return false;
      if (unit && normalizeText(eventUnit(event)) !== unit) return false;
      if (rating && ratingFilterValue(event.classificacao_indicativa) !== rating) {
        return false;
      }

      return eventMatchesPeriod(event, period);
    });
  }

  function activeFilterCount() {
    const defaults = defaultPanelSettings();
    let count = 0;
    if (PANEL_MODULE_IDS.some(
      id => state.panelModules[id] !== defaults.modules[id]
    )) count += 1;
    if (state.filters.theme) count += 1;
    if (state.panelModules.events) {
      if (state.panelEventCities.length) count += 1;
      if (state.filters.category) count += 1;
      if (state.filters.program) count += 1;
      if (state.filters.unit) count += 1;
    }
    if (state.panelModules.books) {
      if (state.panelBookCampuses.length) count += 1;
      if (state.filters.bookAccess) count += 1;
    }
    if (state.panelModules.films) {
      if (state.filters.filmGenre) count += 1;
      if (state.filters.filmPlatform) count += 1;
      if (state.filters.filmRating) count += 1;
      if (state.filters.filmDuration) count += 1;
    }
    if (state.panelWeights.events !== defaults.weights.events ||
        state.panelWeights.books !== defaults.weights.books ||
        state.panelWeights.courses !== defaults.weights.courses ||
        state.panelWeights.contests !== defaults.weights.contests ||
        state.panelWeights.films !== defaults.weights.films ||
        state.panelWeights.utility !== defaults.weights.utility ||
        state.panelWeights.spaces !== defaults.weights.spaces ||
        state.panelWeights.activities !== defaults.weights.activities) count += 1;
    if (state.slideDuration !== defaults.slideDuration) count += 1;
    return count;
  }

  // Em intervalos acima deste limite, os dias da semana são omitidos
  // para evitar excesso de informação no cartão.
  const LONG_EVENT_THRESHOLD_DAYS = 14;

  function calendarDayNumber(date) {
    return Date.UTC(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    );
  }

  function eventDurationDays(event) {
    const realization = eventRealization(event);
    const start = safeDate(realization.inicio);
    const end = safeDate(realization.fim);

    if (!start || !end || end <= start) {
      return 0;
    }

    return Math.round(
      (calendarDayNumber(end) - calendarDayNumber(start)) /
      86400000
    );
  }

  function formatDayMonth(date, includeYear = false) {
    const day = date.getDate() === 1 ? '1º' : String(date.getDate());
    const month = new Intl.DateTimeFormat('pt-BR', {
      month: 'long'
    }).format(date);
    const year = includeYear ? ` de ${date.getFullYear()}` : '';

    return `${day} de ${month}${year}`;
  }

  function formatDateParts(dateString, includeYear = false) {
    const date = safeDate(dateString);

    if (!date) {
      return {
        weekday: '',
        date: dateString || 'Data não informada'
      };
    }

    const weekday = new Intl.DateTimeFormat('pt-BR', {
      weekday: 'long'
    })
      .format(date)
      .replace(/^./, char => char.toUpperCase());

    return {
      weekday,
      date: formatDayMonth(date, includeYear)
    };
  }

  function appendWhenDate(
    container,
    dateString,
    {
      prefix = '',
      showWeekday = true,
      includeYear = false
    } = {}
  ) {
    const parts = formatDateParts(dateString, includeYear);

    if (prefix) {
      container.append(document.createTextNode(prefix));
    }

    if (showWeekday && parts.weekday) {
      const weekday = document.createElement('span');
      weekday.className = 'when-weekday';
      weekday.textContent = `${parts.weekday}, `;
      container.append(weekday);
    }

    const date = document.createElement('span');
    date.className = 'when-date';
    date.textContent = parts.date;
    container.append(date);
  }

  function renderWhen(container, event) {
    container.replaceChildren();

    const realization = eventRealization(event);
    const permanent = eventTemporal?.isPermanent?.(event) ||
      ['permanente', 'atemporal'].includes(realization.classe);

    if (permanent) {
      const label = document.createElement('span');
      label.className = 'when-date when-permanent';
      label.textContent = realization.classe === 'atemporal' ? 'Disponível continuamente' : 'Permanente';
      container.append(label);
      if (event.horario) {
        const time = document.createElement('span');
        time.className = 'when-time';
        time.textContent = ` • ${event.horario}`;
        container.append(time);
      }
    }

    const hasDateRange = Boolean(
      !permanent && realization.fim && realization.fim !== realization.inicio
    );
    const isLongEvent = hasDateRange &&
      eventDurationDays(event) > LONG_EVENT_THRESHOLD_DAYS;

    if (!permanent && isLongEvent) {
      const start = safeDate(realization.inicio);
      const end = safeDate(realization.fim);
      const differentYears = Boolean(
        start && end && start.getFullYear() !== end.getFullYear()
      );

      appendWhenDate(container, realization.inicio, {
        showWeekday: false,
        includeYear: differentYears
      });
      appendWhenDate(container, realization.fim, {
        prefix: ' a ',
        showWeekday: false,
        includeYear: true
      });
    } else if (!permanent) {
      appendWhenDate(container, realization.inicio);

      if (hasDateRange) {
        appendWhenDate(container, realization.fim, {
          prefix: ' a '
        });
      }
    }

    if (event.horario && !permanent) {
      const time = document.createElement('span');
      time.className = 'when-time';

      if (isLongEvent) {
        container.append(document.createElement('br'));
        time.textContent = event.horario;
      } else {
        time.textContent = ` • ${event.horario}`;
      }

      container.append(time);
    }

    const registrationWindow = eventParticipation(event, 'inscricao');
    if (displayCriterion(event) === 'inscricao' && registrationWindow?.inicio) {
      const registration = document.createElement('span');
      registration.className = 'when-registration';
      const start = formatDateParts(registrationWindow.inicio, true).date;
      const status = normalizeText(registrationWindow.status).replaceAll('_', ' ');
      const closed = Boolean(
        eventTemporal?.isClosedStatus?.(status) ||
        CLOSED_ACCESS_STATUSES.has(status)
      );

      container.append(document.createElement('br'));
      registration.textContent = closed
        ? `Inscrições encerradas — abertas desde ${start}`
        : registrationWindow.fim
          ? `Inscrições: ${start} a ${formatDateParts(registrationWindow.fim, true).date}`
          : `Inscrições abertas desde ${start}, enquanto houver disponibilidade`;
      container.append(registration);
    }

    else if (registrationIsClosed(event)) {
      const registration = document.createElement('span');
      registration.className = 'when-registration';
      container.append(document.createElement('br'));
      registration.textContent = 'Inscrições encerradas';
      container.append(registration);
    }
  }

  function formatUpdated(value) {
    if (!value) return '';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return `Atualizado em ${value}`;
    }

    return `Atualizado em ${new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)}`;
  }

  function shortUrl(url) {
    try {
      const parsed = new URL(url);

      return `${parsed.hostname.replace(/^www\./, '')}${
        parsed.pathname === '/' ? '' : parsed.pathname
      }`;
    } catch {
      return url || '';
    }
  }

  function safeExternalUrl(value) {
    if (!value) return '';

    try {
      const parsed = new URL(value, window.location.href);

      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return '';
      }

      return parsed.href;
    } catch {
      return '';
    }
  }

  function showMessage(type, title, text) {
    clearTimeout(state.timer);
    state.isPaused = true;

    app.innerHTML = `
      <section class="${type}">
        <div>
          <h1>${title}</h1>
          <p>${text}</p>
        </div>
      </section>
    `;
  }

  function buildQr(container, link) {
    container.innerHTML = '';

    if (!link || typeof QRCode === 'undefined') {
      container.style.display = 'none';
      return;
    }

    container.style.display = 'grid';

    new QRCode(container, {
      text: link,
      width: 256,
      height: 256,
      correctLevel: QRCode.CorrectLevel.M
    });
  }

  function muralPublicUrl() {
    try {
      const url = new URL(window.location.href);
      if (!['http:', 'https:'].includes(url.protocol)) return '';

      // O QR geral sempre aponta para a porta de entrada do Mural Cultural.
      // Parâmetros de perfil, filtros e âncoras pertencem apenas à sessão atual.
      url.search = '';
      url.hash = '';
      url.pathname = url.pathname.replace(/\/index\.html?$/i, '/');
      return url.href;
    } catch {
      return '';
    }
  }

  function muralDistributionPoint() {
    try {
      const point = String(new URL(window.location.href).searchParams.get('ponto') || '')
        .trim()
        .toLowerCase();
      return /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(point) ? point : '';
    } catch {
      return '';
    }
  }

  function muralTrackedQrUrl(item = null) {
    const point = muralDistributionPoint();
    if (!point) return '';

    const itemId = agendaFavoriteId(item);
    try {
      // O QR do painel usa a entrada direta do site. Isso evita depender da
      // rota curta /q/ para o acesso funcionar; a origem continua sendo
      // registrada pelo módulo de métricas e removida da URL após a entrada.
      const url = new URL('https://temsimuai.com.br/');
      url.searchParams.set('origem', point);
      if (itemId) {
        url.searchParams.set('modo', 'agenda');
        url.searchParams.set('item', itemId);
      }
      return url.href;
    } catch {
      return '';
    }
  }

  function muralItemUrl(item) {
    const base = muralPublicUrl();
    if (!base) return '';

    const itemId = agendaFavoriteId(item);
    if (!itemId) return base;

    try {
      const url = new URL(base);
      url.searchParams.set('modo', 'agenda');
      url.searchParams.set('item', itemId);
      return url.href;
    } catch {
      return base;
    }
  }

  function buildSiteQr(slide, item = null) {
    const wrap = slide.querySelector('.site-qr-wrap');
    const container = slide.querySelector('.site-qr-code');
    if (!wrap || !container) return;

    const itemId = agendaFavoriteId(item);
    const trackedLink = muralTrackedQrUrl(item);
    const link = trackedLink || (itemId ? muralItemUrl(item) : muralPublicUrl());
    if (!link || typeof QRCode === 'undefined') {
      wrap.hidden = true;
      return;
    }

    const title = wrap.querySelector('.site-qr-copy strong');
    const description = wrap.querySelector('.site-qr-copy span');
    if (itemId) {
      if (title) title.textContent = 'Continuar no celular';
      if (description) description.textContent = 'Abra este conteúdo no Mural';
    } else {
      if (title) title.textContent = 'Abrir no celular';
      if (description) description.textContent = 'Explore todos os conteúdos';
    }

    wrap.hidden = false;
    container.setAttribute('aria-label', itemId
      ? `QR Code para abrir este conteúdo no Mural: ${link}`
      : `QR Code do Mural Cultural: ${link}`);
    container.title = link;
    buildQr(container, link);
  }

  function qrActionLabel(item) {
    const type = item?.tipo_conteudo === 'livro'
      ? 'livro'
      : String(item?.tipo_conteudo || 'evento').toLowerCase();

    return ({
      evento: 'Abrir este evento',
      livro: 'Ver este livro',
      curso: 'Abrir este curso',
      concurso: 'Ver este concurso',
      filme: 'Ver este filme',
      jogo: 'Ver este jogo',
      passeio: 'Ver este passeio',
      atividade_lazer: 'Ver esta atividade',
      espaco: 'Ver este espaço'
    })[type] || 'Abrir este conteúdo';
  }

  function configureItemQrLabel(slide, item, hasQr) {
    const wrap = slide.querySelector('.qr-wrap');
    const label = slide.querySelector('.qr-item-label');
    const container = slide.querySelector('.qr-code');
    if (!wrap) return;

    wrap.hidden = !hasQr;
    if (!hasQr) return;

    const action = qrActionLabel(item);
    if (label) label.textContent = action;
    if (container) container.setAttribute('aria-label', `${action} por QR Code`);
  }

  function contentSubtitle(item) {
    const type = item?.tipo_conteudo === 'livro'
      ? 'livro'
      : String(item?.tipo_conteudo || 'evento').toLowerCase();
    return CONTENT_SUBTITLES[type] || 'Mural Cultural';
  }

  function storedSlideDuration() {
    try {
      const value = Number(localStorage.getItem(SLIDE_DURATION_KEY) || 0);
      return ALLOWED_SLIDE_DURATIONS.has(value) ? value : 0;
    } catch {
      return 0;
    }
  }

  function saveSlideDuration(value) {
    const numeric = Number(value || 0);
    state.slideDuration = ALLOWED_SLIDE_DURATIONS.has(numeric) ? numeric : 0;
    try {
      localStorage.setItem(SLIDE_DURATION_KEY, String(state.slideDuration));
    } catch {
      /* Preferência opcional; o site continua funcionando sem armazenamento. */
    }
  }

  function slideDurationFor(item) {
    if (state.slideDuration >= 5) return state.slideDuration;
    const type = String(item?.tipo_conteudo || 'evento').toLowerCase();
    const defaultSeconds = type === 'livro'
      ? state.config?.tempo_slide?.livro
      : type === 'concurso'
        ? state.config?.tempo_slide?.concurso
        : type === 'utilidade_publica'
          ? state.config?.tempo_slide?.utilidade_publica
          : type === 'atividade_lazer'
            ? state.config?.tempo_slide?.atividade_lazer
          : type === 'filme'
            ? state.config?.tempo_slide?.filme
            : type === 'curso'
              ? state.config?.tempo_slide?.curso
              : state.config?.tempo_slide?.evento;
    return Math.max(
      5,
      Number(item?.tempo_slide) ||
      Number(defaultSeconds) ||
      Number(state.data?.tempo_slide) ||
      12
    );
  }

  function updatePlayPauseButton() {
    if (!state.btnPlayPause) return;

    const pauseIcon = state.btnPlayPause.querySelector('.pause-icon');
    const playIcon = state.btnPlayPause.querySelector('.play-icon');

    if (state.isPaused) {
      pauseIcon.style.display = 'none';
      playIcon.style.display = 'block';
      state.btnPlayPause.setAttribute('aria-label', 'Reproduzir');
      state.btnPlayPause.setAttribute('title', 'Reproduzir');
    } else {
      pauseIcon.style.display = 'block';
      playIcon.style.display = 'none';
      state.btnPlayPause.setAttribute('aria-label', 'Pausar');
      state.btnPlayPause.setAttribute('title', 'Pausar');
    }
  }

  function scheduleNextSlide() {
    if (state.isPaused || bookLocationsDialog?.open) return;

    clearTimeout(state.timer);

    const item = state.events[state.index];
    const seconds = slideDurationFor(item);

    state.timer = setTimeout(goToNext, seconds * 1000);
  }

  function attachPanelCommunityContext(slide, item) {
    if (!slide || !item) return;
    const itemId = agendaFavoriteId(item);
    if (!itemId) return;
    slide.dataset.communityItemId = itemId;
    slide.dataset.communityItemTitle = communityContributionTitle(item);
  }

  function renderEventSlide(index) {
    clearTimeout(state.timer);

    const event = state.events[index];
    const data = state.data;
    const slide = template.content.firstElementChild.cloneNode(true);
    buildSiteQr(slide, event);

    const visualKey = normalizeText(event.categoria);
    const [icon, label] =
      categoryVisuals[visualKey] || categoryVisuals.default;

    const seconds = slideDurationFor(event);

    slide.style.setProperty(
      '--slide-seconds',
      `${seconds}s`
    );

    const panelSubtitle = slide.querySelector('.panel-subtitle');
    if (panelSubtitle) panelSubtitle.textContent = contentSubtitle(event);

    slide.querySelector('.counter').textContent =
      `${index + 1} de ${state.events.length}`;

    slide.querySelector('.category').textContent =
      event.categoria || 'Evento';

    const ratingBadge = slide.querySelector('.badge.rating');
    const rating = normalizeRating(event.classificacao_indicativa);

    if (ratingBadge && rating) {
      ratingBadge.hidden = false;
      ratingBadge.textContent = rating.label;
      ratingBadge.classList.add(rating.className);
      ratingBadge.setAttribute(
        'aria-label',
        `Classificação indicativa: ${rating.accessible}`
      );
      ratingBadge.title = `Classificação indicativa: ${rating.accessible}`;
    } else if (ratingBadge) {
      ratingBadge.remove();
    }

    const accessBadge = slide.querySelector('.badge.free');
    if (accessBadge) {
      const isFree = event.gratuito === true;
      accessBadge.textContent = isFree
        ? 'GRATUITO'
        : String(event.condicao_acesso || 'Acesso não informado').toUpperCase();
      accessBadge.classList.toggle('access-unknown', !isFree);
    }

    // cidade: badge ao lado do "GRATUITO"
    const cityBadge = slide.querySelector('.badge.city');
    const cityRaw = event.cidade || '';
    const cityKey = normalizeText(cityRaw);

    if (cityBadge) {
      // limpar classes anteriores por precaução (não estraga se for clone novo)
      cityBadge.classList.remove('city-bh', 'city-sabara', 'city-caete');

      let cityLabel = '';
      if (cityKey.includes('sabara')) {
        cityLabel = 'Sabará';
        cityBadge.classList.add('city-sabara');
      } else if (cityKey.includes('caete') || cityKey.includes('caete')) {
        cityLabel = 'Caeté';
        cityBadge.classList.add('city-caete');
      } else if (cityKey.includes('belo') || cityKey === 'bh' || cityKey.includes('belo horizonte')) {
        cityLabel = 'BH';
        cityBadge.classList.add('city-bh');
      }

      if (cityLabel) {
        cityBadge.textContent = cityLabel;
        cityBadge.style.display = ''; // garantir visibilidade
      } else {
        // se cidade desconhecida, escondemos a badge para não poluir UI
        cityBadge.style.display = 'none';
      }
    }

    slide.querySelector('.event-title').textContent =
      event.titulo;

    slide.querySelector('.description').textContent =
      event.descricao || '';

    renderWhen(slide.querySelector('.when'), event);

    const whereText = slide.querySelector('.where-text');
    const mapLink = slide.querySelector('.map-link');

    whereText.textContent =
      [eventPlace(event), event.cidade]
        .filter(Boolean)
        .join(' • ') || 'Local não informado';

    const mapUrl = safeExternalUrl(event.mapa);

    if (mapUrl) {
      mapLink.href = mapUrl;
      mapLink.hidden = false;
      mapLink.setAttribute(
        'aria-label',
        `Abrir ${eventPlace(event) || 'o local do evento'} no Google Maps`
      );
    } else {
      mapLink.remove();
    }

    /*
     * FUNCIONALIDADE SOB ANÁLISE DE VIABILIDADE
     *
     * A caixa "Participação" foi retirada temporariamente da interface.
     * As orientações de retirada ou inscrição continuam disponíveis na página
     * oficial do evento, acessada pelo link e pelo QR Code. O campo "inscricao"
     * permanece no eventos.json para permitir uma eventual reativação.
     *
     * Para reativar, remova este comentário e reative também o bloco
     * correspondente em index.html e a regra em css/styles.css.
     *
     * const registrationRow =
     *   slide.querySelector('.registration-row');
     *
     * if (event.inscricao) {
     *   slide.querySelector('.registration').textContent =
     *     event.inscricao;
     * } else if (registrationRow) {
     *   registrationRow.remove();
     * }
     */

    const link = eventPublicLink(event);
    const sourceUrlElement = slide.querySelector('.source-url');
    const sourceLabelElement = slide.querySelector('.source-label');
    const closedRegistration = registrationIsClosed(event);
    if (closedRegistration && normalizeText(event.formulario_google_acao_aplicada) !== 'somente relatorio') {
      sourceLabelElement.textContent = 'Inscrições encerradas';
    }

    if (link) {
      // Criar um link clicável
      const linkElement = document.createElement('a');
      linkElement.href = link;
      linkElement.textContent = shortUrl(link);
      linkElement.target = '_blank';
      linkElement.rel = 'noopener noreferrer';
      sourceUrlElement.replaceChildren(linkElement);
    } else {
      sourceUrlElement.textContent = closedRegistration ? 'Formulário de inscrição encerrado' : 'Consulte a equipe da biblioteca';
    }

    slide.querySelector('.updated').textContent =
      formatUpdated(data.atualizado_em);

    configureItemQrLabel(slide, event, Boolean(link));
    if (link) {
      buildQr(
        slide.querySelector('.qr-code'),
        link
      );
    }

    const image = slide.querySelector('.event-image');
    const fallback = slide.querySelector('.image-fallback');
    const mediaContainer = slide.querySelector('.media');
    const overlay = slide.querySelector('.media-overlay');

    slide.querySelector('.fallback-icon').textContent =
      icon;

    slide.querySelector('.fallback-label').textContent =
      label;

    function showFallback() {
      image.removeAttribute('src');
      image.style.display = 'none';
      fallback.style.display = 'grid';

      if (overlay) {
        overlay.style.display = '';
      }
    }

    function showIframe() {
      image.removeAttribute('src');
      image.style.display = 'none';
      fallback.style.display = 'none';

      if (!link || !mediaContainer) {
        showFallback();
        return;
      }

      if (overlay) {
        overlay.style.display = 'none';
      }

      const iframe = document.createElement('iframe');

      iframe.className = 'event-page';
      iframe.src = link;
      iframe.title = `Página oficial: ${event.titulo}`;
      iframe.loading = 'eager';
      iframe.referrerPolicy = 'no-referrer';

      iframe.style.position = 'absolute';
      iframe.style.inset = '0';
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.minWidth = '100%';
      iframe.style.minHeight = '100%';
      iframe.style.border = '0';
      iframe.style.display = 'block';
      iframe.style.zIndex = '1';
      iframe.style.background = '#fff';

      mediaContainer.appendChild(iframe);
    }

    function loadImage(imageUrl, imageType) {
      if (!imageUrl) {
        return false;
      }

      image.style.display = 'block';
      image.classList.remove('loaded');

      image.alt =
        imageType === 'event'
          ? `Imagem de divulgação: ${event.titulo}`
          : imageType === 'program'
            ? `Imagem do programa: ${event.programa || event.titulo}`
            : `Imagem do local: ${eventPlace(event) || event.titulo}`;

      image.referrerPolicy =
        imageType === 'event'
          ? 'no-referrer'
          : '';

      image.decoding = 'async';

      image.onload = () => {
        image.classList.add('loaded');
        fallback.style.display = 'none';

        if (overlay) {
          overlay.style.display = '';
        }
      };

      image.src = imageUrl;

      return true;
    }

    const localImage = getLocalImage(event);
    const programImage = getProgramImage(event);
    const fallbackImage = localImage || programImage;
    const fallbackImageType = localImage ? 'local' : 'program';

    if (event.imagem) {
      image.onerror = () => {
        image.removeAttribute('src');

        /*
         * Se a imagem específica do evento falhar, tenta primeiro a imagem
         * padrão do local e, na falta dela, a imagem padrão do programa.
         */
        if (fallbackImage) {
          image.onerror = () => {
            image.removeAttribute('src');
            showIframe();
          };

          loadImage(fallbackImage, fallbackImageType);
          return;
        }

        showIframe();
      };

      loadImage(event.imagem, 'event');

    } else if (fallbackImage) {
      /*
       * Sem imagem específica, usa a imagem padrão do local ou do programa.
       */
      image.onerror = () => {
        image.removeAttribute('src');
        showIframe();
      };

      loadImage(fallbackImage, fallbackImageType);

    } else {
      /*
       * Sem imagem do evento, do local ou do programa, tenta incorporar a
       * página oficial.
       */
      showIframe();
    }

    slide.dataset.curadoriaIds = JSON.stringify(siteCurationsContent.mergeCurationIds(state.events[index]?.curadoria_ids));
    attachPanelCommunityContext(slide, state.events[index]);
    app.replaceChildren(slide);

    // Atualizar referências dos botões após renderizar o slide
    state.btnNext = slide.querySelector('.next-btn');
    state.btnPrev = slide.querySelector('.prev-btn');
    state.btnPlayPause = slide.querySelector('.play-pause-btn');
    state.btnFilter = slide.querySelector('.filter-btn');
    state.filterOverlay = slide.querySelector('.filter-overlay');

    // Reconfigurar controles e filtros após a troca do slide.
    setupControls();
    setupFilterPanel(slide);
    updateFilterButton();
    updatePlayPauseButton();

    addPanelViewToggle();
    scheduleNextSlide();
  }

  function setBookDetailVisibility(copy, rowSelector, value) {
    const row = copy.querySelector(rowSelector);
    if (!row) return false;
    const hasValue = Boolean(String(value || '').trim());
    row.hidden = !hasValue;
    return hasValue;
  }

  function fitBookCopy(slide) {
    const copy = slide?.querySelector('.book-copy');
    const question = copy?.querySelector('.book-question');
    const support = copy?.querySelector('.book-support');
    if (!copy || !question || !support || copy.hidden) return;

    copy.classList.remove('book-fit-tight', 'book-fit-very-tight');

    const mobile = window.matchMedia('(max-width: 680px)').matches;
    const questionMaximum = mobile ? 4 : 3;
    const supportMaximum = mobile ? 6 : 9;
    const tolerance = 2;

    function apply(questionLines, supportLines, density = '') {
      copy.style.setProperty('--book-question-lines', String(questionLines));
      copy.style.setProperty('--book-support-lines', String(supportLines));
      copy.classList.toggle('book-fit-tight', density === 'tight' || density === 'very-tight');
      copy.classList.toggle('book-fit-very-tight', density === 'very-tight');
    }

    function fits() {
      return copy.scrollHeight <= copy.clientHeight + tolerance;
    }

    const densities = ['', 'tight', 'very-tight'];
    for (const density of densities) {
      for (let questionLines = questionMaximum; questionLines >= 2; questionLines -= 1) {
        for (let supportLines = supportMaximum; supportLines >= 1; supportLines -= 1) {
          apply(questionLines, supportLines, density);
          if (fits()) return;
        }
      }
    }

    apply(2, 1, 'very-tight');
  }

  function scheduleBookFit(slide) {
    const execute = () => requestAnimationFrame(() => fitBookCopy(slide));
    requestAnimationFrame(execute);
    if (document.fonts?.ready) document.fonts.ready.then(execute).catch(() => {});
  }

  function panelEditorialCurationId(index) {
    const explicitProfileId = activeEditorialPanelProfileId();
    if (explicitProfileId) return explicitProfileId;

    // Na rotação normal, microblocos temáticos carregam a curadoria no próprio
    // passo da sequência. Isso permite aplicar o texto editorial do vestibular
    // mesmo sem o usuário ter ativado explicitamente aquele perfil.
    return String(state.panelRoundSteps[index]?.curationId || '').trim();
  }

  function renderBookSlide(index) {
    clearTimeout(state.timer);
    const book = siteCurationsContent.effectiveItemForCuration(
      state.events[index], panelEditorialCurationId(index)
    );
    const slide = template.content.firstElementChild.cloneNode(true);
    buildSiteQr(slide, book);
    slide.classList.add('book-slide');

    const seconds = slideDurationFor(book);
    slide.style.setProperty('--slide-seconds', `${seconds}s`);
    const subtitle = slide.querySelector('.panel-subtitle');
    if (subtitle) subtitle.textContent = contentSubtitle(book);
    slide.querySelector('.counter').textContent = `${index + 1} de ${state.events.length}`;

    slide.querySelector('.event-copy').hidden = true;
    const copy = slide.querySelector('.book-copy');
    copy.hidden = false;
    copy.querySelector('.book-question').textContent = book.pergunta_curiosidade || 'Descubra uma nova leitura.';
    copy.querySelector('.book-support').textContent = book.texto_apoio || '';
    copy.querySelector('.book-title').textContent = book.titulo || '';
    copy.querySelector('.book-author').textContent = book.autor || '';
    const holdings = bookHoldings(book);
    const acervos = bookAcervos(book);
    const locations = panelBookLocations(book);
    // Edições ou destinos distintos no mesmo acervo também permitem escolha.
    const destinations = new Set(locations.flatMap(location =>
      location.registros.flatMap(record => panelBookRecordLinks(record).map(([url]) => url))
    ));
    const hasMultipleLocations = locations.length > 1 || destinations.size > 1;
    const callText = bookLocationsSummary(book);
    copy.querySelector('.book-call').textContent = callText;

    const accessLabels = [];
    const audiobookUrl = bookAudiobookUrl(book);
    if (book.acesso_fisico) accessLabels.push('Físico');
    if (book.acesso_virtual) accessLabels.push('Virtual');
    if (audiobookUrl) accessLabels.push('Audiolivro');
    if (acervos.length > 1) accessLabels.push(`${acervos.length} acervos`);
    copy.querySelector('.book-access').textContent = accessLabels.join(' · ') || 'Catálogo';
    const availability = [];
    if (book.acesso_fisico) {
      const count = Number(book.exemplares_fisicos_catalogados || 0);
      availability.push(`${count} ${count === 1 ? 'exemplar físico catalogado' : 'exemplares físicos catalogados'}`);
      if (Number(book.outras_edicoes_fisicas || 0) > 0) {
        availability.push(`+ ${book.outras_edicoes_fisicas} outra${Number(book.outras_edicoes_fisicas) === 1 ? '' : 's'} edição${Number(book.outras_edicoes_fisicas) === 1 ? '' : 'ões'} catalogada${Number(book.outras_edicoes_fisicas) === 1 ? '' : 's'}`);
      }
    }
    if (book.acesso_virtual) availability.push('edição virtual');
    if (audiobookUrl) availability.push('audiolivro disponível');
    if (acervos.length > 1) availability.push(`${acervos.length} acervos`);
    const availabilityText = availability.join(' • ');
    copy.querySelector('.book-availability').textContent = availabilityText;

    const details = copy.querySelector('.book-details');
    let visibleDetailCount = 0;
    if (setBookDetailVisibility(copy, '.book-call-row', callText)) visibleDetailCount += 1;
    if (setBookDetailVisibility(copy, '.book-availability-row', availabilityText)) visibleDetailCount += 1;
    if (details) details.dataset.visibleCount = String(visibleDetailCount);

    const themes = copy.querySelector('.book-themes');
    for (const theme of Array.isArray(book.temas) ? book.temas : []) {
      const span = document.createElement('span');
      span.textContent = theme;
      themes.append(span);
    }

    const opinion = copy.querySelector('.book-user-opinion');
    const commentText = String(book.comentario_aprovado || '').trim();
    if (opinion && book.exibir_comentario && commentText) {
      opinion.hidden = false;
      opinion.querySelector('blockquote').textContent = `“${commentText}”`;
      opinion.querySelector('cite').textContent = String(book.credito_comentario || 'Leitor(a) do IFMG').trim();
    } else if (opinion) {
      opinion.hidden = true;
    }

    const physicalLink = copy.querySelector('.book-physical-link');
    const virtualLink = copy.querySelector('.book-virtual-link');
    const audiobookLink = copy.querySelector('.book-audiobook-link');
    const physicalUrl = firstBookHoldingUrl(book, 'link_fisico');
    const virtualUrl = firstBookHoldingUrl(book, 'link_virtual');
    const physicalLinksCount = new Set(holdings.map(item => safeExternalUrl(item.link_fisico)).filter(Boolean)).size;
    const virtualLinksCount = new Set(holdings.map(item => safeExternalUrl(item.link_virtual)).filter(Boolean)).size;
    if (hasMultipleLocations) {
      physicalLink.replaceWith(createBookLocationsButton(book, locations));
      virtualLink.remove();
    } else {
      if (physicalUrl) {
        physicalLink.href = physicalUrl;
        if (physicalLinksCount > 1) physicalLink.textContent = 'Ver um dos catálogos físicos';
      } else physicalLink.remove();
      if (virtualUrl) {
        virtualLink.href = virtualUrl;
        if (virtualLinksCount > 1) virtualLink.textContent = 'Acessar uma edição virtual';
      } else virtualLink.remove();
    }
    if (audiobookLink) {
      if (audiobookUrl) {
        audiobookLink.href = audiobookUrl;
        audiobookLink.textContent = bookAudiobookLabel(book);
        audiobookLink.setAttribute('aria-label', bookAudiobookLabel(book));
      } else {
        audiobookLink.remove();
      }
    }
    const opinionLink = copy.querySelector('.book-opinion-link');
    const opinionBookId = String(book.id || '').trim();
    const opinionsEnabled = Boolean(opinionBookId);
    if (opinionLink) {
      opinionLink.hidden = !(opinionsEnabled && opinionBookId);
      if (opinionsEnabled && opinionBookId) {
        opinionLink.href = '#';
        opinionLink.removeAttribute('target');
        opinionLink.removeAttribute('rel');
        opinionLink.textContent = 'Dê sua opinião sobre este livro';
        opinionLink.addEventListener('click', event => {
          event.preventDefault();
          state.paused = true;
          clearTimeout(state.timer);
          updatePlayPauseButton();
          openCommunityContributionForm('opiniao_livro', {
            item_id: `livro:${opinionBookId}`,
            id_obra: String(book.id_obra || '').trim(),
            item_titulo: String(book.titulo || '').trim(),
            item_autor: String(book.autor || '').trim()
          });
        });
      }
    }

    const link = safeExternalUrl(book.link || book.link_fisico || book.link_virtual);
    slide.querySelector('.source-label').textContent = 'Encontre este livro';
    const source = slide.querySelector('.source-url');
    if (hasMultipleLocations) {
      source.replaceChildren(createBookLocationsButton(book, locations));
    } else if (link) {
      const anchor = document.createElement('a');
      anchor.href = link;
      anchor.textContent = acervos.length > 1
        ? 'Abrir um dos catálogos desta obra'
        : (book.tipo_link_principal === 'virtual' ? 'Abrir edição virtual' : 'Ver no catálogo da biblioteca');
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      source.replaceChildren(anchor);
    } else {
      source.textContent = 'Consulte a equipe da biblioteca';
    }
    slide.querySelector('.updated').textContent = formatUpdated(state.booksData?.atualizado_em);

    const qrContainer = slide.querySelector('.qr-code');
    const hasBookQr = Boolean(book.qr_code || link);
    configureItemQrLabel(slide, book, hasBookQr);
    if (hasBookQr && book.qr_code) {
      const qrImage = document.createElement('img');
      qrImage.src = book.qr_code;
      qrImage.alt = `QR Code para ${book.titulo}`;
      qrImage.onerror = () => buildQr(qrContainer, link);
      qrContainer.replaceChildren(qrImage);
    } else if (hasBookQr) {
      buildQr(qrContainer, link);
    }

    const image = slide.querySelector('.event-image');
    const fallback = slide.querySelector('.image-fallback');
    slide.querySelector('.fallback-icon').textContent = book.icone || '📚';
    slide.querySelector('.fallback-label').textContent = 'Livro';
    image.alt = `Capa do livro ${book.titulo}`;
    image.decoding = 'async';
    image.classList.add('loaded');
    const imageUrl = safeImageUrl(book.imagem);
    image.onload = () => { fallback.style.display = 'none'; };
    image.onerror = () => { image.classList.remove('loaded'); image.style.display = 'none'; fallback.style.display = 'grid'; };
    if (imageUrl) image.src = imageUrl;
    else {
      image.classList.remove('loaded');
      image.style.display = 'none';
      fallback.style.display = 'grid';
    }

    slide.dataset.curadoriaIds = JSON.stringify(siteCurationsContent.mergeCurationIds(state.events[index]?.curadoria_ids));
    attachPanelCommunityContext(slide, state.events[index]);
    app.replaceChildren(slide);
    scheduleBookFit(slide);
    state.btnNext = slide.querySelector('.next-btn');
    state.btnPrev = slide.querySelector('.prev-btn');
    state.btnPlayPause = slide.querySelector('.play-pause-btn');
    state.btnFilter = slide.querySelector('.filter-btn');
    state.filterOverlay = slide.querySelector('.filter-overlay');
    setupControls();
    setupFilterPanel(slide);
    updateFilterButton();
    updatePlayPauseButton();
    addPanelViewToggle();
    scheduleNextSlide();
  }

  function renderCourseSlide(index) {
    clearTimeout(state.timer);
    const course = state.events[index];
    if (!course) return;

    const slide = coursesContent.createPanelSlide({
      course,
      index,
      total: state.events.length,
      template,
      helpers: {
        buildSiteQr,
        slideDurationFor,
        configureItemQrLabel,
        buildQr,
        safeExternalUrl,
        safeImageUrl
      }
    });

    slide.dataset.curadoriaIds = JSON.stringify(siteCurationsContent.mergeCurationIds(state.events[index]?.curadoria_ids));
    attachPanelCommunityContext(slide, state.events[index]);
    app.replaceChildren(slide);

    state.btnNext = slide.querySelector('.next-btn');
    state.btnPrev = slide.querySelector('.prev-btn');
    state.btnPlayPause = slide.querySelector('.play-pause-btn');
    state.btnFilter = slide.querySelector('.filter-btn');
    state.filterOverlay = slide.querySelector('.filter-overlay');

    setupControls();
    setupFilterPanel(slide);
    updateFilterButton();
    updatePlayPauseButton();
    addPanelViewToggle();
    scheduleNextSlide();
  }

  function renderContestSlide(index) {
    clearTimeout(state.timer);
    const contest = state.events[index];
    if (!contest) return;

    const slide = contestsContent.createPanelSlide({
      contest,
      index,
      total: state.events.length,
      template,
      helpers: {
        buildSiteQr,
        slideDurationFor,
        configureItemQrLabel,
        buildQr,
        safeExternalUrl,
        safeImageUrl
      }
    });

    slide.dataset.curadoriaIds = JSON.stringify(siteCurationsContent.mergeCurationIds(state.events[index]?.curadoria_ids));
    attachPanelCommunityContext(slide, state.events[index]);
    app.replaceChildren(slide);

    state.btnNext = slide.querySelector('.next-btn');
    state.btnPrev = slide.querySelector('.prev-btn');
    state.btnPlayPause = slide.querySelector('.play-pause-btn');
    state.btnFilter = slide.querySelector('.filter-btn');
    state.filterOverlay = slide.querySelector('.filter-overlay');

    setupControls();
    setupFilterPanel(slide);
    updateFilterButton();
    updatePlayPauseButton();
    addPanelViewToggle();
    scheduleNextSlide();
  }

  function renderMediaSlide(index, createSlide) {
    clearTimeout(state.timer);
    const movie = state.events[index];
    if (!movie) return;

    const slide = createSlide({
      movie,
      index,
      total: state.events.length,
      template,
      helpers: {
        buildSiteQr,
        slideDurationFor,
        configureItemQrLabel,
        buildQr,
        safeExternalUrl,
        safeImageUrl,
        normalizeRating
      }
    });

    slide.dataset.curadoriaIds = JSON.stringify(siteCurationsContent.mergeCurationIds(state.events[index]?.curadoria_ids));
    attachPanelCommunityContext(slide, state.events[index]);
    app.replaceChildren(slide);
    state.btnNext = slide.querySelector('.next-btn');
    state.btnPrev = slide.querySelector('.prev-btn');
    state.btnPlayPause = slide.querySelector('.play-pause-btn');
    state.btnFilter = slide.querySelector('.filter-btn');
    state.filterOverlay = slide.querySelector('.filter-overlay');
    setupControls();
    setupFilterPanel(slide);
    updateFilterButton();
    updatePlayPauseButton();
    addPanelViewToggle();
    scheduleNextSlide();
  }

  function renderFilmSlide(index) {
    renderMediaSlide(index, filmsContent.createPanelSlide);
  }

  function renderUtilitySlide(index) {
    renderMediaSlide(index, utilityContent.createPanelSlide);
  }

  function renderSpaceSlide(index) {
    renderMediaSlide(index, spacesContent.createPanelSlide);
  }

  function renderActivitySlide(index) {
    renderMediaSlide(index, activitiesContent.createPanelSlide);
  }

  function renderSlide(index) {
    const item = state.events[index];
    if (!item) return;
    const step = state.panelRoundSteps[index];
    if (step && !state.panelSeenSteps.has(step)) {
      muralCore.recordPanelExposure(state.panelMemory, step);
      state.panelSeenSteps.add(step);
    } else {
      muralCore.recordPanelExposure(state.panelMemory, { item });
    }
    if (item.tipo_conteudo === 'livro') renderBookSlide(index);
    else if (item.tipo_conteudo === 'curso') renderCourseSlide(index);
    else if (item.tipo_conteudo === 'concurso') renderContestSlide(index);
    else if (item.tipo_conteudo === 'filme') renderFilmSlide(index);
    else if (item.tipo_conteudo === 'utilidade_publica') renderUtilitySlide(index);
    else if (item.tipo_conteudo === 'espaco') renderSpaceSlide(index);
    else if (item.tipo_conteudo === 'atividade_lazer') renderActivitySlide(index);
    else renderEventSlide(index);
  }

  function goToNext() {
    if (bookLocationsDialog?.open) return;
    if (!state.events.length) return;
    if (state.index === state.events.length - 1) {
      createPanelRound();
      state.index = 0;
    } else {
      state.index += 1;
    }
    renderSlide(state.index);
  }

  function goToPrevious() {
    if (bookLocationsDialog?.open) return;
    if (!state.events.length) return;
    state.index = (state.index - 1 + state.events.length) % state.events.length;
    renderSlide(state.index);
  }

  function setupMobileSwipeNavigation() {
    const mobileQuery = window.matchMedia('(max-width: 680px)');
    const minimumDistance = 50;
    const horizontalBias = 1.25;
    let startX = 0;
    let startY = 0;
    let tracking = false;

    app.addEventListener('touchstart', event => {
      if (!mobileQuery.matches || document.body.classList.contains('agenda-mode') || event.touches.length !== 1) {
        tracking = false;
        return;
      }

      const touch = event.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      tracking = true;
    }, { passive: true });

    app.addEventListener('touchend', event => {
      if (!tracking || !mobileQuery.matches || document.body.classList.contains('agenda-mode') || event.changedTouches.length !== 1) {
        tracking = false;
        return;
      }

      const touch = event.changedTouches[0];
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;
      tracking = false;

      // Só considera swipe quando o gesto é claramente horizontal. Assim,
      // a rolagem vertical da página continua natural no celular.
      if (Math.abs(deltaX) < minimumDistance ||
          Math.abs(deltaX) < Math.abs(deltaY) * horizontalBias) {
        return;
      }

      if (deltaX < 0) goToNext();
      else goToPrevious();
    }, { passive: true });

    app.addEventListener('touchcancel', () => {
      tracking = false;
    }, { passive: true });
  }

  function togglePlayPause() {
    state.isPaused = !state.isPaused;
    updatePlayPauseButton();

    if (!state.isPaused) {
      scheduleNextSlide();
    } else {
      clearTimeout(state.timer);
    }
  }

  function updateFilterButton() {
    if (!state.btnFilter) return;

    const count = activeFilterCount();
    const countElement = state.btnFilter.querySelector('.filter-count');
    const description = count
      ? `Configurar exibição: ${count} ajuste${count === 1 ? '' : 's'} ativo${count === 1 ? '' : 's'}`
      : 'Configurar exibição';

    state.btnFilter.classList.toggle('has-filters', count > 0);
    state.btnFilter.setAttribute('aria-label', description);
    state.btnFilter.setAttribute('title', description);

    if (countElement) {
      countElement.textContent = String(count);
      countElement.hidden = count === 0;
    }
  }

  function uniqueFilterOptions(events, field) {
    const values = new Map();

    for (const event of events) {
      const label = String(event[field] || '').trim();
      const value = normalizeText(label);

      if (label && value && !values.has(value)) {
        values.set(value, label);
      }
    }

    return [...values.entries()].sort((a, b) =>
      a[1].localeCompare(b[1], 'pt-BR')
    );
  }

  function populateDynamicSelect(select, firstLabel, options, selectedValue) {
    if (!select) return;

    select.replaceChildren();

    const firstOption = document.createElement('option');
    firstOption.value = '';
    firstOption.textContent = firstLabel;
    select.append(firstOption);

    for (const [value, label] of options) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      select.append(option);
    }

    select.value = selectedValue || '';
  }

  function panelCityOptions() {
    return uniqueFilterOptions(state.allEvents, 'cidade');
  }

  function panelCampusOptions() {
    const values = new Map();
    for (const book of state.allBooks) {
      for (const label of bookCampusLabels(book)) {
        const value = normalizeText(label);
        if (label && value && !values.has(value)) values.set(value, label);
      }
    }
    return [...values.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  }

  function defaultPanelSettings() {
    const panel = state.config?.painel || {};
    const panelModules = panel.modulos_ativos || {};
    const eventConfig = panel.eventos || {};
    const bookConfig = panel.livros || {};
    const filmConfig = panel.filmes || {};
    const frequency = panel.frequencia || {};
    const modules = Object.fromEntries(
      Object.entries(PANEL_MODULE_CONFIG_KEYS).map(([id, configKey]) => {
        const panelValue = panelModules[configKey];
        const globalValue = state.config?.modulos?.[configKey];
        return [id, panelValue !== undefined ? Boolean(panelValue) : globalValue !== false];
      })
    );
    const weights = Object.fromEntries(
      PANEL_MODULE_IDS.map(id => {
        const configKey = PANEL_MODULE_CONFIG_KEYS[id];
        const fallback = id === 'events'
          ? Number(state.config?.proporcao?.eventos_por_livro) || 5
          : 1;
        return [id, Math.max(1, Number(frequency[configKey]) || fallback)];
      })
    );
    return {
      modules,
      theme: String(panel.tema || ''),
      eventCities: Array.isArray(eventConfig.cidades) ? eventConfig.cidades.map(normalizeText).filter(Boolean) : [],
      eventCategory: String(eventConfig.categoria || ''),
      eventProgram: String(eventConfig.programa || ''),
      eventUnit: String(eventConfig.espaco || ''),
      bookCampuses: Array.isArray(bookConfig.campi_acervos) ? bookConfig.campi_acervos.map(normalizeText).filter(Boolean) : [],
      bookAccess: String(bookConfig.acesso || ''),
      filmGenre: String(filmConfig.genero || ''),
      filmPlatform: String(filmConfig.plataforma || ''),
      filmRating: String(filmConfig.classificacao || ''),
      filmDuration: String(filmConfig.duracao || ''),
      weights,
      slideDuration: ALLOWED_SLIDE_DURATIONS.has(Number(panel.tempo_slides)) ? Number(panel.tempo_slides) : 0
    };
  }

  function normalizePanelSettings(value = {}) {
    const defaults = defaultPanelSettings();
    const modules = value.modules || {};
    const weights = value.weights || {};
    const clampWeight = number => Math.min(10, Math.max(1, Number(number) || 1));

    return {
      modules: Object.fromEntries(
        PANEL_MODULE_IDS.map(id => [
          id,
          modules[id] !== undefined ? Boolean(modules[id]) : defaults.modules[id]
        ])
      ),
      theme: String(value.theme || ''),
      eventCities: Array.isArray(value.eventCities) ? value.eventCities.map(normalizeText).filter(Boolean) : [],
      eventCategory: String(value.eventCategory || ''),
      eventProgram: String(value.eventProgram || ''),
      eventUnit: String(value.eventUnit || ''),
      bookCampuses: Array.isArray(value.bookCampuses) ? value.bookCampuses.map(normalizeText).filter(Boolean) : [],
      bookAccess: String(value.bookAccess || ''),
      filmGenre: String(value.filmGenre || ''),
      filmPlatform: String(value.filmPlatform || ''),
      filmRating: String(value.filmRating || ''),
      filmDuration: String(value.filmDuration || ''),
      weights: Object.fromEntries(
        PANEL_MODULE_IDS.map(id => [
          id,
          clampWeight(weights[id] ?? defaults.weights[id])
        ])
      ),
      slideDuration: ALLOWED_SLIDE_DURATIONS.has(Number(value.slideDuration))
        ? Number(value.slideDuration)
        : defaults.slideDuration
    };
  }

  function currentPanelSettings() {
    return normalizePanelSettings({
      modules: state.panelModules,
      theme: state.filters.theme,
      eventCities: state.panelEventCities,
      eventCategory: state.filters.category,
      eventProgram: state.filters.program,
      eventUnit: state.filters.unit,
      bookCampuses: state.panelBookCampuses,
      bookAccess: state.filters.bookAccess,
      filmGenre: state.filters.filmGenre,
      filmPlatform: state.filters.filmPlatform,
      filmRating: state.filters.filmRating,
      filmDuration: state.filters.filmDuration,
      weights: state.panelWeights,
      slideDuration: state.slideDuration
    });
  }

  function applyPanelSettings(settings, persist = false) {
    const value = normalizePanelSettings(settings);
    state.panelModules = { ...value.modules };
    state.panelEventCities = [...value.eventCities];
    state.panelBookCampuses = [...value.bookCampuses];
    state.panelWeights = { ...value.weights };
    state.filters = {
      content: 'all',
      theme: value.theme,
      category: value.eventCategory,
      program: value.eventProgram,
      unit: value.eventUnit,
      period: 'all',
      rating: '',
      bookAccess: value.bookAccess,
      filmGenre: value.filmGenre,
      filmPlatform: value.filmPlatform,
      filmRating: value.filmRating,
      filmDuration: value.filmDuration
    };
    state.slideDuration = value.slideDuration;

    if (persist) {
      try {
        localStorage.setItem(PANEL_SETTINGS_KEY, JSON.stringify(value));
        localStorage.setItem(SLIDE_DURATION_KEY, String(value.slideDuration));
      } catch {
        /* A programação continua funcionando quando o armazenamento está indisponível. */
      }
    }
  }

  function loadStoredPanelSettings() {
    const requestedProfile = findRequestedPanelProfile();
    if (requestedProfile) {
      applyPanelSettings(requestedProfile, false);
      return;
    }

    // Links públicos de curadoria são fonte de verdade na abertura.
    // ?perfil= continua tendo precedência por ser um perfil explícito do Painel.
    const requestedCurationId = requestedPanelProfile() ? '' : requestedCurationIdFromUrl();
    if (requestedCurationId) {
      const requestedCurationProfile = editorialProfileById(requestedCurationId);
      if (requestedCurationProfile && editorialProfileIsVisible(requestedCurationProfile)) {
        // Persiste a escolha para que o estado salvo passe a refletir o link aberto,
        // em vez de restaurar uma curadoria anterior numa navegação futura.
        applyPanelSettings(requestedCurationProfile.settings, true);
        return;
      }
    }

    const defaults = defaultPanelSettings();
    let stored = null;
    try {
      stored = JSON.parse(localStorage.getItem(PANEL_SETTINGS_KEY) || 'null');
    } catch {
      stored = null;
    }

    if (!stored) {
      defaults.slideDuration = storedSlideDuration();
      applyPanelSettings(defaults, false);
      return;
    }

    applyPanelSettings(stored, false);
  }

  function readPanelProfiles() {
    try {
      const parsed = JSON.parse(localStorage.getItem(PANEL_PROFILES_KEY) || '{}');
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }


  function panelProfileSlug(value = '') {
    return normalizeText(value)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function requestedCurationIdFromUrl() {
    try {
      const url = new URL(window.location.href);
      const short = String(url.searchParams.get('c') || '').trim().toLowerCase();
      if (short) return PUBLIC_CURATION_ALIASES[short] || '';
      return String(url.searchParams.get('curadoria') || '').trim();
    } catch {
      return '';
    }
  }

  function requestedPanelProfile() {
    try {
      return panelProfileSlug(new URLSearchParams(window.location.search).get('perfil') || '');
    } catch {
      return '';
    }
  }

  function configuredPanelProfiles() {
    const configured = state.config?.perfis_painel;
    const profiles = configured && typeof configured === 'object' && !Array.isArray(configured)
      ? configured
      : {};
    const curations = (state.siteCurationsData?.curadorias || []).filter(curation =>
      curation?.id && curation.perfil_painel?.configuracao &&
      typeof curation.perfil_painel.configuracao === 'object' &&
      !Array.isArray(curation.perfil_painel.configuracao)
    );
    const declared = Object.fromEntries(curations.map(curation => [curation.id, {
      ...curation.perfil_painel,
      curation,
      nome: curation.perfil_painel.nome || curation.nome,
      ativo_de: curation.ativo_de,
      ativo_ate: curation.ativo_ate
    }]));
    return { ...profiles, ...declared };
  }

  function configuredPanelProfileEntries() {
    return Object.entries(configuredPanelProfiles()).map(([id, raw]) => {
      const enriched = Boolean(
        raw && typeof raw === 'object' && !Array.isArray(raw) &&
        raw.configuracao && typeof raw.configuracao === 'object' && !Array.isArray(raw.configuracao)
      );
      const settings = enriched ? raw.configuracao : raw;
      return {
        id,
        name: String(enriched ? (raw.nome || id) : id).trim() || id,
        badge: String(enriched ? (raw.destaque || '') : '').trim(),
        start: String(enriched ? (raw.ativo_de || '') : '').trim(),
        end: String(enriched ? (raw.ativo_ate || '') : '').trim(),
        curation: enriched ? raw.curation : undefined,
        settings
      };
    });
  }

  function editorialProfileIsVisible(profile, today = todayAtMidnight()) {
    const start = parseCalendarDate(profile.start);
    const end = parseCalendarDate(profile.end, true);
    if (start && today < start) return false;
    if (end && today > end) return false;
    if (profile.curation?.promocao_painel) {
      return siteCurationsContent.isPromoted(profile.curation, today);
    }
    return true;
  }

  function editorialProfileById(id = '') {
    return configuredPanelProfileEntries().find(profile => profile.id === id) || null;
  }

  function profileOptionValue(source, key) {
    return `${source}:${key}`;
  }

  function parseProfileOptionValue(value = '') {
    const text = String(value || '');
    const separator = text.indexOf(':');
    if (separator < 0) return { source: '', key: '' };
    return {
      source: text.slice(0, separator),
      key: text.slice(separator + 1)
    };
  }

  function selectedProfileSettings(value = '') {
    const { source, key } = parseProfileOptionValue(value);
    if (source === 'editorial') {
      const profile = editorialProfileById(key);
      return profile && editorialProfileIsVisible(profile) ? profile.settings : null;
    }
    if (source === 'personal') return readPanelProfiles()[key] || null;
    return null;
  }

  function panelSettingsMatch(first, second) {
    return JSON.stringify(normalizePanelSettings(first)) === JSON.stringify(normalizePanelSettings(second));
  }

  function activeEditorialPanelProfileId(settings = currentPanelSettings()) {
    return configuredPanelProfileEntries()
      .find(profile => editorialProfileIsVisible(profile) && panelSettingsMatch(settings, profile.settings))?.id || '';
  }

  function syncActivePanelProfile(slide = state.filterOverlay) {
    const profileId = activeEditorialPanelProfileId();
    if (profileId) document.documentElement.dataset[PANEL_PROFILE_ATTRIBUTE] = profileId;
    else delete document.documentElement.dataset[PANEL_PROFILE_ATTRIBUTE];

    const select = slide?.querySelector('.panel-profile-select');
    const selectedValue = profileId ? profileOptionValue('editorial', profileId) : '';
    if (select && [...select.options].some(option => option.value === selectedValue)) {
      select.value = selectedValue;
    }

    window.dispatchEvent(new CustomEvent('mural:panel-profile-change', {
      detail: { profile: profileId }
    }));
    return profileId;
  }

  function findRequestedPanelProfile() {
    const requested = requestedPanelProfile();
    if (!requested) return null;

    for (const profile of configuredPanelProfileEntries()) {
      if (!editorialProfileIsVisible(profile)) continue;
      if (panelProfileSlug(profile.id) === requested || panelProfileSlug(profile.name) === requested) {
        return profile.settings;
      }
    }

    for (const [name, settings] of Object.entries(readPanelProfiles())) {
      if (panelProfileSlug(name) === requested) return settings;
    }
    return null;
  }

  function writePanelProfiles(profiles) {
    try {
      localStorage.setItem(PANEL_PROFILES_KEY, JSON.stringify(profiles));
    } catch {
      /* Perfis são um recurso opcional. */
    }
  }

  function populateProfileSelect(slide, selectedValue = '') {
    const select = slide.querySelector('.panel-profile-select');
    if (!select) return;

    const editorials = configuredPanelProfileEntries()
      .filter(profile => editorialProfileIsVisible(profile))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    const personals = readPanelProfiles();

    select.replaceChildren();
    const current = document.createElement('option');
    current.value = '';
    current.textContent = 'Configuração atual';
    select.append(current);

    if (editorials.length) {
      const group = document.createElement('optgroup');
      group.label = 'Sugestões do Mural';
      for (const profile of editorials) {
        const option = document.createElement('option');
        option.value = profileOptionValue('editorial', profile.id);
        option.textContent = `${profile.badge ? '★ ' : ''}${profile.name}`;
        if (profile.badge) option.title = profile.badge;
        group.append(option);
      }
      select.append(group);
    }

    const personalNames = Object.keys(personals)
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));
    if (personalNames.length) {
      const group = document.createElement('optgroup');
      group.label = 'Meus perfis';
      for (const name of personalNames) {
        const option = document.createElement('option');
        option.value = profileOptionValue('personal', name);
        option.textContent = name;
        group.append(option);
      }
      select.append(group);
    }

    if ([...select.options].some(option => option.value === selectedValue)) {
      select.value = selectedValue;
    } else {
      select.value = '';
    }

    const deleteButton = slide.querySelector('.panel-profile-delete');
    if (deleteButton) {
      deleteButton.disabled = parseProfileOptionValue(select.value).source !== 'personal';
    }
  }

  function populateCheckboxOptions(container, options, selectedValues) {
    if (!container) return;
    container.replaceChildren();
    const selected = new Set((selectedValues || []).map(normalizeText));
    const unrestricted = selected.size === 0;
    container.dataset.unrestricted = unrestricted ? 'true' : 'false';
    const combined = new Map(options);
    for (const value of selected) {
      if (!combined.has(value)) combined.set(value, `${value} · sem itens atuais`);
    }

    if (!combined.size) {
      const empty = document.createElement('span');
      empty.className = 'panel-options-empty';
      empty.textContent = 'Nenhuma opção disponível nos dados atuais.';
      container.append(empty);
      return;
    }

    for (const [value, label] of combined) {
      const option = document.createElement('label');
      option.className = 'panel-check-option';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.value = value;
      input.checked = unrestricted || selected.has(value);
      const text = document.createElement('span');
      text.textContent = label;
      option.append(input, text);
      container.append(option);
    }
  }

  function checkedFilterValues(container) {
    if (!container) return [];
    const inputs = [...container.querySelectorAll('input[type="checkbox"]')];
    if (!inputs.length) return [];
    const checked = inputs.filter(input => input.checked).map(input => input.value);
    if (container.dataset.unrestricted === 'true' && checked.length === inputs.length) return [];
    return checked;
  }

  function bindPanelCheckboxBulkActions(slide) {
    slide.querySelectorAll('.panel-checkbox-actions button[data-target]').forEach(button => {
      if (button.dataset.bulkBound === 'true') return;
      button.dataset.bulkBound = 'true';
      button.addEventListener('click', () => {
        const container = slide.querySelector(button.dataset.target || '');
        if (!container) return;
        const inputs = [...container.querySelectorAll('input[type="checkbox"]')];
        const checkAll = button.classList.contains('panel-checkbox-all');
        inputs.forEach(input => { input.checked = checkAll; });
        container.dataset.unrestricted = checkAll ? 'true' : 'false';
      });
    });
  }

  function showPanelValidation(slide, message = '') {
    const box = slide.querySelector('.panel-validation');
    if (!box) return;
    box.textContent = message;
    box.hidden = !message;
    if (message) box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function readPanelSettingsFromOverlay(slide) {
    const eventsEnabled = Boolean(slide.querySelector('.panel-module-events')?.checked);
    const booksEnabled = Boolean(slide.querySelector('.panel-module-books')?.checked);
    const coursesEnabled = Boolean(slide.querySelector('.panel-module-courses')?.checked);
    const contestsEnabled = Boolean(slide.querySelector('.panel-module-contests')?.checked);
    const filmsEnabled = Boolean(slide.querySelector('.panel-module-films')?.checked);
    const utilityEnabled = Boolean(slide.querySelector('.panel-module-utility')?.checked);
    const spacesEnabled = Boolean(slide.querySelector('.panel-module-spaces')?.checked);
    const activitiesEnabled = Boolean(slide.querySelector('.panel-module-activities')?.checked);
    if (!eventsEnabled && !booksEnabled && !coursesEnabled && !contestsEnabled && !filmsEnabled && !utilityEnabled && !spacesEnabled && !activitiesEnabled) {
      throw new Error('Ative pelo menos um tipo de conteúdo para o painel.');
    }

    const cityContainer = slide.querySelector('.panel-city-options');
    const campusContainer = slide.querySelector('.panel-campus-options');
    if (eventsEnabled && cityContainer?.querySelectorAll('input').length &&
        !cityContainer.querySelector('input:checked')) {
      throw new Error('Selecione pelo menos uma cidade para os eventos ou desative o módulo Eventos.');
    }
    if (booksEnabled && campusContainer?.querySelectorAll('input').length &&
        !campusContainer.querySelector('input:checked')) {
      throw new Error('Selecione pelo menos um campus/acervo para os livros ou desative o módulo Livros.');
    }

    return normalizePanelSettings({
      modules: {
        events: eventsEnabled,
        books: booksEnabled,
        courses: coursesEnabled,
        contests: contestsEnabled,
        films: filmsEnabled,
        utility: utilityEnabled,
        spaces: spacesEnabled,
        activities: activitiesEnabled
      },
      theme: slide.querySelector('.filter-theme')?.value || '',
      eventCities: checkedFilterValues(cityContainer),
      eventCategory: slide.querySelector('.filter-category')?.value || '',
      eventProgram: slide.querySelector('.filter-program')?.value || '',
      eventUnit: slide.querySelector('.filter-unit')?.value || '',
      bookCampuses: checkedFilterValues(campusContainer),
      bookAccess: slide.querySelector('.filter-book-access')?.value || '',
      filmGenre: slide.querySelector('.filter-film-genre')?.value || '',
      filmPlatform: slide.querySelector('.filter-film-platform')?.value || '',
      filmRating: slide.querySelector('.filter-film-rating')?.value || '',
      filmDuration: slide.querySelector('.filter-film-duration')?.value || '',
      weights: {
        events: slide.querySelector('.panel-event-weight')?.value || 5,
        books: slide.querySelector('.panel-book-weight')?.value || 1,
        courses: slide.querySelector('.panel-course-weight')?.value || 1,
        contests: slide.querySelector('.panel-contest-weight')?.value || 1,
        films: slide.querySelector('.panel-film-weight')?.value || 1,
        utility: slide.querySelector('.panel-utility-weight')?.value || 1,
        spaces: slide.querySelector('.panel-space-weight')?.value || 1,
        activities: slide.querySelector('.panel-activity-weight')?.value || 1
      },
      slideDuration: slide.querySelector('.filter-slide-duration')?.value || 0
    });
  }

  function updatePanelModuleVisibility(slide) {
    const eventsEnabled = Boolean(slide.querySelector('.panel-module-events')?.checked);
    const booksEnabled = Boolean(slide.querySelector('.panel-module-books')?.checked);
    const coursesEnabled = Boolean(slide.querySelector('.panel-module-courses')?.checked);
    const contestsEnabled = Boolean(slide.querySelector('.panel-module-contests')?.checked);
    const filmsEnabled = Boolean(slide.querySelector('.panel-module-films')?.checked);
    const utilityEnabled = Boolean(slide.querySelector('.panel-module-utility')?.checked);
    const spacesEnabled = Boolean(slide.querySelector('.panel-module-spaces')?.checked);
    const activitiesEnabled = Boolean(slide.querySelector('.panel-module-activities')?.checked);
    const eventSection = slide.querySelector('.panel-event-section');
    const bookSection = slide.querySelector('.panel-book-section');
    const courseSection = slide.querySelector('.panel-course-section');
    const contestSection = slide.querySelector('.panel-contest-section');
    const filmSection = slide.querySelector('.panel-film-section');
    const utilitySection = slide.querySelector('.panel-utility-section');
    const spaceSection = slide.querySelector('.panel-space-section');
    const activitySection = slide.querySelector('.panel-activity-section');
    if (eventSection) eventSection.hidden = !eventsEnabled;
    if (bookSection) bookSection.hidden = !booksEnabled;
    if (courseSection) courseSection.hidden = !coursesEnabled;
    if (contestSection) contestSection.hidden = !contestsEnabled;
    if (filmSection) filmSection.hidden = !filmsEnabled;
    if (utilitySection) utilitySection.hidden = !utilityEnabled;
    if (spaceSection) spaceSection.hidden = !spacesEnabled;
    if (activitySection) activitySection.hidden = !activitiesEnabled;
  }

  function populateFilterPanel(slide, settings = currentPanelSettings()) {
    const value = normalizePanelSettings(settings);
    const themeSelect = slide.querySelector('.filter-theme');
    const categorySelect = slide.querySelector('.filter-category');
    const programSelect = slide.querySelector('.filter-program');
    const unitSelect = slide.querySelector('.filter-unit');
    const bookAccessSelect = slide.querySelector('.filter-book-access');
    const filmGenreSelect = slide.querySelector('.filter-film-genre');
    const filmPlatformSelect = slide.querySelector('.filter-film-platform');
    const filmRatingSelect = slide.querySelector('.filter-film-rating');
    const filmDurationSelect = slide.querySelector('.filter-film-duration');
    const durationSelect = slide.querySelector('.filter-slide-duration');

    const eventsToggle = slide.querySelector('.panel-module-events');
    const booksToggle = slide.querySelector('.panel-module-books');
    const coursesToggle = slide.querySelector('.panel-module-courses');
    const contestsToggle = slide.querySelector('.panel-module-contests');
    const filmsToggle = slide.querySelector('.panel-module-films');
    const utilityToggle = slide.querySelector('.panel-module-utility');
    const spacesToggle = slide.querySelector('.panel-module-spaces');
    const activitiesToggle = slide.querySelector('.panel-module-activities');
    if (eventsToggle) eventsToggle.checked = value.modules.events;
    if (booksToggle) booksToggle.checked = value.modules.books;
    if (coursesToggle) coursesToggle.checked = value.modules.courses;
    if (contestsToggle) contestsToggle.checked = value.modules.contests;
    if (filmsToggle) filmsToggle.checked = value.modules.films;
    if (utilityToggle) utilityToggle.checked = value.modules.utility;
    if (spacesToggle) spacesToggle.checked = value.modules.spaces;
    if (activitiesToggle) activitiesToggle.checked = value.modules.activities;
    if (durationSelect) durationSelect.value = String(value.slideDuration || 0);
    const eventWeight = slide.querySelector('.panel-event-weight');
    const bookWeight = slide.querySelector('.panel-book-weight');
    const courseWeight = slide.querySelector('.panel-course-weight');
    const contestWeight = slide.querySelector('.panel-contest-weight');
    const filmWeight = slide.querySelector('.panel-film-weight');
    const utilityWeight = slide.querySelector('.panel-utility-weight');
    const spaceWeight = slide.querySelector('.panel-space-weight');
    const activityWeight = slide.querySelector('.panel-activity-weight');
    if (eventWeight) eventWeight.value = String(value.weights.events);
    if (bookWeight) bookWeight.value = String(value.weights.books);
    if (courseWeight) courseWeight.value = String(value.weights.courses);
    if (contestWeight) contestWeight.value = String(value.weights.contests);
    if (filmWeight) filmWeight.value = String(value.weights.films);
    if (utilityWeight) utilityWeight.value = String(value.weights.utility);
    if (spaceWeight) spaceWeight.value = String(value.weights.spaces);
    if (activityWeight) activityWeight.value = String(value.weights.activities);

    populateDynamicSelect(themeSelect, 'Todos os temas', universalThemeOptions(), value.theme);

    const categoryValues = new Map(uniqueFilterOptions(state.allEvents, 'categoria'));
    for (const event of state.allEvents) {
      for (const label of [event.area_artistica, ...(Array.isArray(event.areas) ? event.areas : [])]) {
        const normalized = normalizeText(label);
        if (label && normalized && !categoryValues.has(normalized)) categoryValues.set(normalized, label);
      }
    }
    populateDynamicSelect(
      categorySelect,
      'Todas as categorias e linguagens',
      [...categoryValues.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR')),
      value.eventCategory
    );
    populateDynamicSelect(
      programSelect,
      'Todas as instituições e programas',
      uniqueFilterOptions(state.allEvents.map(event => ({ programa: eventProgram(event) })), 'programa'),
      value.eventProgram
    );
    populateDynamicSelect(
      unitSelect,
      'Todos os espaços',
      uniqueFilterOptions(state.allEvents.map(event => ({ unidade: eventUnit(event) })), 'unidade'),
      value.eventUnit
    );

    populateCheckboxOptions(slide.querySelector('.panel-city-options'), panelCityOptions(), value.eventCities);
    populateCheckboxOptions(slide.querySelector('.panel-campus-options'), panelCampusOptions(), value.bookCampuses);
    bindPanelCheckboxBulkActions(slide);
    if (bookAccessSelect) bookAccessSelect.value = value.bookAccess;
    populateDynamicSelect(
      filmGenreSelect,
      'Todos os gêneros',
      filmsContent.options(state.allFilms, 'generos').map(label => [normalizeText(label), label]),
      normalizeText(value.filmGenre)
    );
    populateDynamicSelect(
      filmPlatformSelect,
      'Todas as plataformas',
      filmsContent.platformOptions(state.allFilms).map(label => [label, label]),
      value.filmPlatform
    );
    if (filmRatingSelect) filmRatingSelect.value = value.filmRating;
    if (filmDurationSelect) filmDurationSelect.value = value.filmDuration;
    updatePanelModuleVisibility(slide);
    showPanelValidation(slide, '');
  }

  function openFilterPanel() {
    if (!state.filterOverlay || !state.btnFilter) return;

    clearTimeout(state.timer);
    state.filterOverlay.hidden = false;
    state.btnFilter.setAttribute('aria-expanded', 'true');

    const firstSelect = state.filterOverlay.querySelector('select');
    window.setTimeout(() => firstSelect?.focus(), 0);
  }

  function closeFilterPanel() {
    if (!state.filterOverlay || state.filterOverlay.hidden) return;

    state.filterOverlay.hidden = true;
    state.btnFilter?.setAttribute('aria-expanded', 'false');
    state.btnFilter?.focus();

    if (!state.isPaused) scheduleNextSlide();
  }

  function restoreDefaultPanelSettings(render = true) {
    const defaults = defaultPanelSettings();
    if (render) {
      applyPanelSettingsAndRender(defaults);
      return;
    }
    applyPanelSettings(defaults, true);
    syncActivePanelProfile();
  }

  function showFilteredEmpty() {
    clearTimeout(state.timer);

    app.innerHTML = `
      <section class="empty filtered-empty">
        <div>
          <h1>Nenhum conteúdo encontrado</h1>
          <p>A programação escolhida não possui itens disponíveis neste momento.</p>
          <button class="empty-clear-filters" type="button">Restaurar programação padrão</button>
        </div>
      </section>
    `;

    app.querySelector('.empty-clear-filters')?.addEventListener('click', () => {
      restoreDefaultPanelSettings();
    });
  }

  function applyPanelSettingsAndRender(settings) {
    applyPanelSettings(settings, true);
    rebuildVisibleItems();
    state.index = 0;
    syncActivePanelProfile();

    if (!state.events.length) {
      showFilteredEmpty();
      return;
    }

    renderCurrentView();
  }

  function applyEditorialPanelProfile(profileId) {
    const profile = editorialProfileById(String(profileId || ''));
    if (!profile || !editorialProfileIsVisible(profile)) return false;
    applyPanelSettingsAndRender(profile.settings);
    return true;
  }

  function toggleEditorialPanelProfile(profileId) {
    const id = String(profileId || '');
    if (activeEditorialPanelProfileId() === id) {
      applyPanelSettingsAndRender(defaultPanelSettings());
      return false;
    }
    return applyEditorialPanelProfile(id);
  }

  function applyFiltersFromPanel() {
    if (!state.filterOverlay) return;
    try {
      const settings = readPanelSettingsFromOverlay(state.filterOverlay);
      applyPanelSettingsAndRender(settings);
    } catch (error) {
      showPanelValidation(state.filterOverlay, error.message || 'Revise a configuração do painel.');
    }
  }

  function clearUserFilters() {
    restoreDefaultPanelSettings();
  }

  function savePanelProfile(slide) {
    try {
      const nameInput = slide.querySelector('.panel-profile-name');
      const name = String(nameInput?.value || '').trim();
      if (!name) throw new Error('Digite um nome para o perfil antes de salvá-lo.');
      const settings = readPanelSettingsFromOverlay(slide);
      const profiles = readPanelProfiles();
      profiles[name] = settings;
      writePanelProfiles(profiles);
      populateProfileSelect(slide, profileOptionValue('personal', name));
      if (nameInput) nameInput.value = '';
      showPanelValidation(slide, '');
    } catch (error) {
      showPanelValidation(slide, error.message || 'Não foi possível salvar o perfil.');
    }
  }

  function deletePanelProfile(slide) {
    const select = slide.querySelector('.panel-profile-select');
    const { source, key } = parseProfileOptionValue(select?.value || '');
    if (source !== 'personal' || !key) return;
    const profiles = readPanelProfiles();
    delete profiles[key];
    writePanelProfiles(profiles);
    populateProfileSelect(slide, '');
  }

  function setupFilterPanel(slide) {
    populateFilterPanel(slide);
    const activeProfile = activeEditorialPanelProfileId();
    populateProfileSelect(
      slide,
      activeProfile ? profileOptionValue('editorial', activeProfile) : ''
    );
    syncActivePanelProfile(slide);

    const overlay = slide.querySelector('.filter-overlay');
    const closeButton = slide.querySelector('.filter-close');
    const applyButton = slide.querySelector('.filter-apply');
    const clearButton = slide.querySelector('.filter-clear');

    closeButton?.addEventListener('click', closeFilterPanel);
    applyButton?.addEventListener('click', applyFiltersFromPanel);
    clearButton?.addEventListener('click', () => {
      restoreDefaultPanelSettings();
    });

    slide.querySelector('.panel-module-events')?.addEventListener('change', () => updatePanelModuleVisibility(slide));
    slide.querySelector('.panel-module-books')?.addEventListener('change', () => updatePanelModuleVisibility(slide));
    slide.querySelector('.panel-module-courses')?.addEventListener('change', () => updatePanelModuleVisibility(slide));
    slide.querySelector('.panel-module-contests')?.addEventListener('change', () => updatePanelModuleVisibility(slide));
    slide.querySelector('.panel-module-films')?.addEventListener('change', () => updatePanelModuleVisibility(slide));
    slide.querySelector('.panel-module-utility')?.addEventListener('change', () => updatePanelModuleVisibility(slide));
    slide.querySelector('.panel-module-activities')?.addEventListener('change', () => updatePanelModuleVisibility(slide));
    slide.querySelector('.panel-profile-save')?.addEventListener('click', () => savePanelProfile(slide));
    slide.querySelector('.panel-profile-delete')?.addEventListener('click', () => deletePanelProfile(slide));
    slide.querySelector('.panel-profile-select')?.addEventListener('change', event => {
      const selected = event.target.value;
      const settings = selectedProfileSettings(selected);
      // Perfis são escolhas imediatas; filtros individuais continuam usando Aplicar.
      applyPanelSettingsAndRender(settings || defaultPanelSettings());
      if (state.filterOverlay?.isConnected) {
        // Preserva o menu aberto e o acesso a excluir perfis pessoais após renderizar.
        populateProfileSelect(state.filterOverlay, selected);
        openFilterPanel();
      }
    });

    overlay?.addEventListener('click', event => {
      if (event.target === overlay) closeFilterPanel();
    });
  }

  function setupControls() {
    // Remover listeners antigos para evitar duplicação
    if (state.btnNext) {
      state.btnNext.removeEventListener('click', goToNext);
      state.btnNext.addEventListener('click', goToNext);
    }
    if (state.btnPrev) {
      state.btnPrev.removeEventListener('click', goToPrevious);
      state.btnPrev.addEventListener('click', goToPrevious);
    }
    if (state.btnPlayPause) {
      state.btnPlayPause.removeEventListener('click', togglePlayPause);
      state.btnPlayPause.addEventListener('click', togglePlayPause);
    }
    if (state.btnFilter) {
      state.btnFilter.removeEventListener('click', openFilterPanel);
      state.btnFilter.addEventListener('click', openFilterPanel);
    }
  }

  function handleKeyPress(event) {
    if (bookLocationsDialog?.open) return;
    if (state.filterOverlay && !state.filterOverlay.hidden && event.key === 'Escape') {
      event.preventDefault();
      closeFilterPanel();
      return;
    }

    // Verificar se o usuário está digitando em um input/textarea
    if (
      event.target.tagName === 'INPUT' ||
      event.target.tagName === 'TEXTAREA' ||
      event.target.tagName === 'SELECT' ||
      event.target.tagName === 'BUTTON' ||
      event.target.isContentEditable
    ) {
      return;
    }

    const key = event.key.toLowerCase();

    // ArrowRight / Direita
    if (key === 'arrowright' || key === 'd') {
      event.preventDefault();
      goToNext();
    }
    // ArrowLeft / Esquerda
    else if (key === 'arrowleft' || key === 'a') {
      event.preventDefault();
      goToPrevious();
    }
    // Espaço / p (play/pause)
    else if (key === ' ' || key === 'p') {
      event.preventDefault();
      togglePlayPause();
    }
    // Filtro
    else if (key === 'f') {
      event.preventDefault();
      openFilterPanel();
    }
  }



  const MOBILE_BREAKPOINT = 760;
  const VIEW_MODE_KEY = 'agenda-cultural-modo-visualizacao';

  function storedViewMode() {
    try {
      const value = localStorage.getItem(VIEW_MODE_KEY);
      return ['auto', 'agenda', 'painel'].includes(value) ? value : 'auto';
    } catch {
      return 'auto';
    }
  }

  function effectiveViewMode() {
    if (state.viewMode === 'agenda' || state.viewMode === 'painel') {
      return state.viewMode;
    }
    return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches
      ? 'agenda'
      : 'painel';
  }

  function saveViewMode(value) {
    state.viewMode = value;
    try { localStorage.setItem(VIEW_MODE_KEY, value); } catch { /* opcional */ }
  }

  function eventImageCandidates(event) {
    return [event.imagem, getLocalImage(event), getProgramImage(event)]
      .map(safeImageUrl)
      .filter(Boolean);
  }

  function exclusiveAgendaEventImage(event) {
    const explicit = [event.imagem, event.imagem_local, event.imagem_programa]
      .map(safeImageUrl)
      .find(Boolean);
    if (explicit) return explicit;

    if (normalizeText(eventPlace(event)).includes('cine santa tereza')) {
      return safeImageUrl('imagens/CineSantaTerezaBH.png');
    }
    if (normalizeText(event.programa).includes('escola livre de artes arena da cultura')) {
      return safeImageUrl('imagens/eventos-manuais/escola-livre-de-artes.png');
    }
    return '';
  }

  function mobileDateLabel(event) {
    const realization = eventRealization(event);
    if (
      eventTemporal?.isPermanent?.(event) ||
      ['permanente', 'atemporal'].includes(realization.classe)
    ) {
      return realization.classe === 'atemporal' ? 'Disponível continuamente' : 'Permanente';
    }
    const start = safeDate(realization.inicio);
    if (!start) return realization.inicio || event.data || 'Data não informada';
    const today = todayAtMidnight();
    const tomorrow = addCalendarDays(today, 1);
    const sameDay = (a, b) => a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    if (sameDay(start, today)) return 'Hoje';
    if (sameDay(start, tomorrow)) return 'Amanhã';
    return new Intl.DateTimeFormat('pt-BR', {
      weekday: 'short', day: '2-digit', month: 'short'
    }).format(start).replace('.', '');
  }

  function agendaCurationEntries() {
    const curations = state.siteCurationsData?.curadorias;
    if (!Array.isArray(curations)) return [];
    return curations.map(curation => ({
      id: String(curation?.id || '').trim(),
      name: String(curation?.nome || curation?.id || '').trim(),
      permanente: curation?.permanente === true,
      membros: curation?.membros,
      theme: normalizeText(curation?.perfil_painel?.configuracao?.theme || '') ||
        normalizeText(curation?.tema || ''),
      start: String(curation?.ativo_de || '').trim(),
      end: String(curation?.ativo_ate || '').trim()
    })).filter(curation => curation.id && (curation.permanente || editorialProfileIsVisible(curation)));
  }

  function agendaItemMatchesCuration(item, curation) {
    if (!state.mobileCuration) return true;
    if (!curation) return false;
    return siteCurationsContent.matchesCuration(item, curation);
  }

  function agendaThemeOptions(content = state.mobileContent) {
    const values = new Map();
    const add = label => {
      const text = String(label || '').trim();
      const value = normalizeText(text);
      if (text && value && !values.has(value)) values.set(value, text);
    };
    if (content === 'events') {
      for (const event of state.allEvents) eventThemeLabels(event).forEach(add);
    }
    if (content === 'books') {
      for (const book of state.allBooks) (Array.isArray(book.temas) ? book.temas : []).forEach(add);
    }
    if (content === 'courses') {
      for (const course of state.allCourses) (Array.isArray(course.temas) ? course.temas : []).forEach(add);
    }
    if (content === 'films') {
      for (const movie of state.allFilms) (Array.isArray(movie.temas) ? movie.temas : []).forEach(add);
    }
    if (content === 'utility') {
      for (const item of state.allUtility) (Array.isArray(item.temas) ? item.temas : []).forEach(add);
    }
    if (content === 'spaces') {
      for (const item of state.allSpaces) (Array.isArray(item.temas) ? item.temas : []).forEach(add);
    }
    if (content === 'activities') {
      for (const item of state.allActivities) (Array.isArray(item.temas) ? item.temas : []).forEach(add);
    }
    return [...values.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  }

  function normalizeAgendaFiltersForContent(content = state.mobileContent) {
    const allowedContents = new Set(['all', 'events', 'books', 'courses', 'contests', 'films', 'utility', 'spaces', 'activities']);
    state.mobileContent = allowedContents.has(content) ? content : 'all';

    // A troca de conteúdo preserva a curadoria; apenas uma opção indisponível expira.
    if (state.mobileCuration && !agendaCurationEntries().some(curation => curation.id === state.mobileCuration)) {
      state.mobileCuration = '';
    }

    if (!['events', 'books', 'courses', 'films', 'utility', 'spaces', 'activities'].includes(state.mobileContent)) {
      state.mobileTheme = '';
    } else {
      const allowedThemes = new Set(agendaThemeOptions(state.mobileContent).map(([value]) => value));
      if (state.mobileTheme && !allowedThemes.has(state.mobileTheme)) state.mobileTheme = '';
    }

    if (state.mobileContent !== 'events') {
      state.mobilePeriod = 'all';
      state.mobileCategory = '';
      state.mobileCity = '';
      state.mobileSpace = '';
      state.mobileInstitution = '';
      state.mobileRegistration = '';
    }
    if (state.mobileContent !== 'books') {
      state.mobileBookAccess = '';
      state.mobileBookCover = '';
      state.mobileBookLibrary = '';
      state.mobileBookYearFrom = '';
      state.mobileBookYearTo = '';
      state.mobileBookAudiobook = '';
    } else if (!state.curationMode) {
      state.mobileBookCover = '';
    }
    if (state.mobileContent !== 'courses') {
      state.mobileCourseInstitution = '';
      state.mobileCourseArea = '';
      state.mobileCourseWorkload = '';
      state.mobileCourseType = '';
      state.mobileCourseLevel = '';
      state.mobileCourseLanguage = '';
      state.mobileCourseCertificate = '';
    }
    if (state.mobileContent !== 'utility') {
      state.mobileUtilityArea = '';
      state.mobileUtilityType = '';
      state.mobileUtilityNature = '';
      state.mobileUtilityScope = '';
      state.mobileUtilityAudience = '';
    }
    if (state.mobileContent !== 'activities') {
      state.mobileActivityCity = '';
      state.mobileActivityCategory = '';
      state.mobileActivityModality = '';
      state.mobileActivityDay = '';
      state.mobileActivityParticipation = '';
      state.mobileActivityAudience = '';
      state.mobileActivityFormat = '';
    }
    if (state.mobileContent !== 'spaces') {
      state.mobileSpaceCity = '';
      state.mobileSpaceVocation = '';
      state.mobileSpaceNature = '';
      state.mobileSpaceInstitution = '';
      state.mobileSpaceOpenDay = '';
    }
    if (state.mobileContent !== 'contests') {
      state.mobileContestFormation = '';
      state.mobileContestUf = '';
      state.mobileContestCity = '';
      state.mobileContestDeadline = '';
      state.mobileContestState = '';
      state.mobileContestRemuneration = '';
    }
    if (state.mobileContent !== 'films') {
      state.mobileFilmGenre = '';
      state.mobileFilmPlatform = '';
      state.mobileFilmLetter = '';
      state.mobileFilmAccessibility = '';
      state.mobileFilmCountry = '';
      state.mobileFilmCollection = '';
      state.mobileFilmRating = '';
      state.mobileFilmYearFrom = '';
      state.mobileFilmYearTo = '';
      state.mobileFilmDuration = '';
      state.mobileFilmSort = 'title-asc';
    }
  }

  function agendaCategoryOptions() {
    const values = new Map();
    const add = label => {
      const text = String(label || '').trim();
      const value = normalizeText(text);
      if (text && value && !values.has(value)) values.set(value, text);
    };
    for (const event of state.allEvents) {
      add(event.categoria);
      add(event.area_artistica);
      (Array.isArray(event.areas) ? event.areas : []).forEach(add);
    }
    return [...values.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  }

  function agendaUsesDetailedEventRecords() {
    return Boolean(
      state.mobileQuery || state.mobileCuration || state.mobileTheme || state.mobileCategory ||
      state.mobileSpace || state.mobileInstitution
    );
  }

  function agendaHasSpecificEventFilters() {
    return Boolean(
      state.mobileQuery || state.mobileCuration || state.mobileTheme || state.mobilePeriod !== 'all' ||
      state.mobileCity || state.mobileCategory || state.mobileSpace ||
      state.mobileInstitution || state.mobileRegistration
    );
  }

  function agendaEventSource() {
    if (state.mobileContent === 'events' && !agendaHasSpecificEventFilters()) {
      return state.allEvents;
    }
    return agendaUsesDetailedEventRecords()
      ? state.allEvents
      : buildDefaultEvents(state.allEvents);
  }

  function eventMatchesRegistrationFilter(event, value) {
    if (!value) return true;
    const registrationWindow = eventParticipation(event, 'inscricao');
    const status = normalizeText(
      registrationWindow?.status || event.status_inscricao
    ).replaceAll('_', ' ');
    const formStatus = normalizeText(event.status_formulario_google).replaceAll('_', ' ');
    const hasRegistrationLink = Boolean(safeExternalUrl(event.link_inscricao));
    const registrationCriterion = displayCriterion(event) === 'inscricao';
    const hasRegistrationText = Boolean(
      registrationWindow?.observacao || String(event.inscricao || '').trim()
    );

    if (value === 'closed') return registrationIsClosed(event);
    if (value === 'open') {
      return !registrationIsClosed(event) && (
        status === 'aberta' || formStatus === 'aberto' || registrationCriterion || hasRegistrationLink
      );
    }
    if (value === 'none') {
      return !registrationIsClosed(event) && !hasRegistrationLink && !registrationCriterion && !hasRegistrationText;
    }
    return true;
  }

  function agendaEventQueryMatches(event, query) {
    if (!query) return true;
    const haystack = normalizeText([
      event.titulo, event.descricao, eventPlace(event), eventUnit(event),
      eventInstitutionName(event), event.local, event.unidade, event.cidade,
      event.categoria, event.area_artistica, event.programa, event.fonte,
      ...(Array.isArray(event.areas) ? event.areas : []),
      ...(Array.isArray(event.tags) ? event.tags : [])
    ].filter(Boolean).join(' '));
    return haystack.includes(query);
  }

  function agendaBookQueryMatches(book, query) {
    if (!query) return true;
    const holdings = bookHoldings(book);
    const haystack = normalizeText([
      book.titulo, book.autor, book.pergunta_curiosidade,
      book.texto_apoio, ...(Array.isArray(book.temas) ? book.temas : []),
      ...bookCampusLabels(book),
      ...holdings.flatMap(item => [item.numero_chamada, item.codigo_acervo])
    ].filter(Boolean).join(' '));
    return haystack.includes(query);
  }

  function agendaVisibleEvents() {
    if (!['all', 'events'].includes(state.mobileContent)) return [];
    const query = normalizeText(state.mobileQuery);
    const specific = state.mobileContent === 'events';
    return agendaEventSource().filter(event => {
      if (event.exibicao_por_filtro === false && agendaUsesDetailedEventRecords()) {
        return false;
      }
      if (!eventMatchesTheme(event, state.mobileTheme)) return false;
      if (specific) {
        if (state.mobileCity && normalizeText(event.cidade) !== state.mobileCity) return false;
        if (!categoryMatches(event, state.mobileCategory)) return false;
        if (state.mobileSpace && normalizeText(eventUnit(event)) !== state.mobileSpace) return false;
        if (state.mobileInstitution && normalizeText(eventProgram(event)) !== state.mobileInstitution) return false;
        if (!eventMatchesPeriod(event, state.mobilePeriod)) return false;
        if (!eventMatchesRegistrationFilter(event, state.mobileRegistration)) return false;
      }
      return agendaEventQueryMatches(event, query);
    }).sort(compareAgendaEvents);
  }

  function agendaTitleCompare(first, second) {
    return String(first?.titulo || '').localeCompare(String(second?.titulo || ''), 'pt-BR');
  }

  function agendaDateValue(value) {
    const parsed = parseCalendarDate(value);
    return parsed ? parsed.getTime() : Number.POSITIVE_INFINITY;
  }

  function contestDeadlineValue(contest) {
    const value = String(
      contest?.janela_inscricoes?.fim ||
      contest?.inscricoes_fim ||
      contest?.inscricoes_fim_texto ||
      ''
    ).trim();
    const isoDate = agendaDateValue(value);
    if (Number.isFinite(isoDate)) return isoDate;

    const match = value.toLocaleLowerCase('pt-BR').match(/(\d{1,2})\s+de\s+([a-zç]+)\s+de\s+(\d{4})/i);
    const months = {
      janeiro: 0, fevereiro: 1, marco: 2, março: 2, abril: 3, maio: 4, junho: 5,
      julho: 6, agosto: 7, setembro: 8, outubro: 9, novembro: 10, dezembro: 11
    };
    if (!match || months[match[2]] === undefined) return Number.POSITIVE_INFINITY;
    return new Date(Number(match[3]), months[match[2]], Number(match[1])).getTime();
  }

  function compareAgendaEvents(first, second) {
    const firstDate = eventRealization(first).inicio;
    const secondDate = eventRealization(second).inicio;
    return agendaDateValue(firstDate) - agendaDateValue(secondDate) || agendaTitleCompare(first, second);
  }

  function compareAgendaContests(first, second) {
    return contestDeadlineValue(first) - contestDeadlineValue(second) || agendaTitleCompare(first, second);
  }

  function agendaBookLibraryOptions() {
    const values = new Map();
    for (const book of state.allBooks) {
      for (const label of bookCampusLabels(book)) {
        const value = normalizeText(label);
        if (value && !values.has(value)) values.set(value, label);
      }
    }
    return [...values.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  }

  function agendaBookYear(book) {
    const value = Number(String(book?.ano || '').match(/\d{4}/)?.[0]);
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  function agendaBookMatchesLibrary(book, wanted) {
    if (!wanted) return true;
    return bookCampusLabels(book).some(label => normalizeText(label) === wanted);
  }

  function agendaVisibleBooks() {
    if (!['all', 'books'].includes(state.mobileContent) || state.config?.modulos?.livros === false) return [];
    const query = normalizeText(state.mobileQuery);
    const today = todayAtMidnight();
    const specific = state.mobileContent === 'books';
    const yearFrom = specific ? Number(state.mobileBookYearFrom) || 0 : 0;
    const yearTo = specific ? Number(state.mobileBookYearTo) || 0 : 0;

    return state.allBooks
      .filter(book => state.curationMode
        ? Boolean(book && book.titulo)
        : bookIsPublishable(book, today))
      .filter(book => bookMatchesTheme(book, state.mobileTheme))
      .filter(book => {
        if (!specific) return true;
        if (state.mobileBookAccess === 'physical' && !book.acesso_fisico) return false;
        if (state.mobileBookAccess === 'virtual' && !book.acesso_virtual) return false;
        if (state.mobileBookAccess === 'both' && !(book.acesso_fisico && book.acesso_virtual)) return false;
        if (!agendaBookMatchesLibrary(book, state.mobileBookLibrary)) return false;
        const year = agendaBookYear(book);
        if (yearFrom && (!year || year < yearFrom)) return false;
        if (yearTo && (!year || year > yearTo)) return false;
        if (state.mobileBookAudiobook === 'with' && !bookAudiobookUrl(book)) return false;
        if (state.mobileBookAudiobook === 'without' && bookAudiobookUrl(book)) return false;
        if (state.curationMode && state.mobileBookCover === 'with' && !safeImageUrl(book.imagem)) return false;
        if (state.curationMode && state.mobileBookCover === 'without' && safeImageUrl(book.imagem)) return false;
        return true;
      })
      .map(book => siteCurationsContent.effectiveItemForCuration(book, state.mobileCuration))
      .filter(book => agendaBookQueryMatches(book, query))
      .sort(agendaTitleCompare);
  }

  function agendaVisibleCourses() {
    if (!['all', 'courses'].includes(state.mobileContent) || state.config?.modulos?.cursos === false) return [];
    const query = normalizeText(state.mobileQuery);
    const specific = state.mobileContent === 'courses';
    return coursesContent.filter(state.allCourses, {
      theme: state.mobileTheme,
      institution: specific ? state.mobileCourseInstitution : '',
      area: specific ? state.mobileCourseArea : '',
      workload: specific ? state.mobileCourseWorkload : '',
      type: specific ? state.mobileCourseType : '',
      level: specific ? state.mobileCourseLevel : '',
      language: specific ? state.mobileCourseLanguage : '',
      certificate: specific ? state.mobileCourseCertificate : ''
    })
      .filter(course => coursesContent.agendaQueryMatches(course, query, normalizeText))
      .sort(agendaTitleCompare);
  }

  function agendaVisibleContests() {
    if (state.mobileTheme || !['all', 'contests'].includes(state.mobileContent) || state.config?.modulos?.concursos === false) {
      return [];
    }
    return contestsContent.filter(state.allContests, {
      query: state.mobileQuery,
      formation: state.mobileContent === 'contests' ? state.mobileContestFormation : '',
      uf: state.mobileContent === 'contests' ? state.mobileContestUf : '',
      city: state.mobileContent === 'contests' ? state.mobileContestCity : '',
      deadline: state.mobileContent === 'contests' ? state.mobileContestDeadline : '',
      state: state.mobileContent === 'contests' ? state.mobileContestState : '',
      remuneration: state.mobileContent === 'contests' ? state.mobileContestRemuneration : ''
    }).sort(compareAgendaContests);
  }

  function agendaVisibleFilms() {
    if (!['all', 'films'].includes(state.mobileContent)) return [];
    return filmsContent.filter(state.allFilms, {
      query: state.mobileQuery,
      genre: state.mobileContent === 'films' ? state.mobileFilmGenre : '',
      platform: state.mobileContent === 'films' ? state.mobileFilmPlatform : '',
      theme: state.mobileContent === 'films' ? state.mobileTheme : '',
      letter: state.mobileContent === 'films' ? state.mobileFilmLetter : '',
      accessibility: state.mobileContent === 'films' ? state.mobileFilmAccessibility : '',
      country: state.mobileContent === 'films' ? state.mobileFilmCountry : '',
      collection: state.mobileContent === 'films' ? state.mobileFilmCollection : '',
      rating: state.mobileContent === 'films' ? state.mobileFilmRating : '',
      yearFrom: state.mobileContent === 'films' ? state.mobileFilmYearFrom : '',
      yearTo: state.mobileContent === 'films' ? state.mobileFilmYearTo : '',
      duration: state.mobileContent === 'films' ? state.mobileFilmDuration : '',
      sort: state.mobileContent === 'films' ? state.mobileFilmSort : 'title-asc'
    }, normalizeText);
  }

  function agendaVisibleActivities() {
    if (!['all', 'activities'].includes(state.mobileContent) || state.config?.modulos?.atividades_lazer === false) return [];
    const specific = state.mobileContent === 'activities';
    return activitiesContent.filter(state.allActivities, {
      query: state.mobileQuery,
      city: specific ? state.mobileActivityCity : '',
      category: specific ? state.mobileActivityCategory : '',
      modality: specific ? state.mobileActivityModality : '',
      theme: specific ? state.mobileTheme : '',
      day: specific ? state.mobileActivityDay : '',
      participation: specific ? state.mobileActivityParticipation : '',
      audience: specific ? state.mobileActivityAudience : '',
      format: specific ? state.mobileActivityFormat : ''
    }, normalizeText).sort(agendaTitleCompare);
  }

  function agendaVisibleSpaces() {
    if (!['all', 'spaces'].includes(state.mobileContent) || state.config?.modulos?.espacos === false) return [];
    const specific = state.mobileContent === 'spaces';
    return spacesContent.filter(state.allSpaces, {
      query: state.mobileQuery,
      city: specific ? state.mobileSpaceCity : '',
      vocation: specific ? state.mobileSpaceVocation : '',
      nature: specific ? state.mobileSpaceNature : '',
      theme: specific ? state.mobileTheme : '',
      institution: specific ? state.mobileSpaceInstitution : '',
      openDay: specific ? state.mobileSpaceOpenDay : ''
    }, normalizeText).sort(agendaTitleCompare);
  }

  function utilitySource() {
    return state.allUtility;
  }

  function agendaUtilityOptions(field) {
    const values = new Map();
    for (const item of utilitySource()) {
      const raw = item?.[field];
      const entries = Array.isArray(raw) ? raw : [raw];
      for (const label of entries) {
        if (label && typeof label === 'object') continue;
        const text = String(label || '').trim();
        const value = normalizeText(text);
        if (value && !values.has(value)) values.set(value, text);
      }
    }
    return [...values.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  }

  function utilityNatureLabel(value) {
    const normalized = normalizeText(value);
    if (normalized === 'indicador') return 'Indicador';
    if (normalized === 'direito_orientacao') return 'Orientação, direitos e serviços';
    return String(value || '').replaceAll('_', ' ').trim();
  }

  function utilityNatureOptions() {
    const values = new Map();
    for (const item of utilitySource()) {
      const raw = String(item?.natureza || '').trim();
      const value = normalizeText(raw);
      if (value && !values.has(value)) values.set(value, utilityNatureLabel(raw));
    }
    return [...values.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  }

  function utilityScopeLabel(item) {
    const scope = item?.escopo_geografico;
    if (!scope || typeof scope !== 'object') return '';
    const type = normalizeText(scope.tipo);
    const municipalities = Array.isArray(scope.municipios)
      ? scope.municipios.map(value => String(value || '').trim()).filter(Boolean)
      : [];
    if (type === 'municipal' && municipalities.length) return municipalities.join(', ');
    if (type === 'estadual' && scope.uf) return scope.uf === 'MG' ? 'Minas Gerais' : String(scope.uf);
    if (type === 'nacional') return 'Brasil';
    return String(scope.descricao || '').trim();
  }

  function utilityScopeOptions() {
    const values = new Map();
    for (const item of utilitySource()) {
      const label = utilityScopeLabel(item);
      const value = normalizeText(label);
      if (label && value && !values.has(value)) values.set(value, label);
    }
    return [...values.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  }

  function agendaVisibleUtility() {
    if (!['all', 'utility'].includes(state.mobileContent)) return [];
    const query = normalizeText(state.mobileQuery);
    const specific = state.mobileContent === 'utility';
    return utilitySource().filter(item => {
      if (specific && state.mobileTheme &&
          !(Array.isArray(item.temas) ? item.temas : []).some(theme => normalizeText(theme) === state.mobileTheme)) return false;
      if (specific && state.mobileUtilityArea &&
          !(Array.isArray(item.areas_utilidade) ? item.areas_utilidade : [])
            .some(area => normalizeText(area) === state.mobileUtilityArea)) return false;
      if (specific && state.mobileUtilityType &&
          !(Array.isArray(item.tipos_recurso) ? item.tipos_recurso : [])
            .some(type => normalizeText(type) === state.mobileUtilityType)) return false;
      if (specific && state.mobileUtilityNature &&
          normalizeText(item.natureza) !== state.mobileUtilityNature) return false;
      if (specific && state.mobileUtilityScope &&
          normalizeText(utilityScopeLabel(item)) !== state.mobileUtilityScope) return false;
      if (specific && state.mobileUtilityAudience &&
          !(Array.isArray(item.publicos_alvo) ? item.publicos_alvo : [])
            .some(audience => normalizeText(audience) === state.mobileUtilityAudience)) return false;
      if (!query) return true;
      return normalizeText([
        item.titulo, item.descricao, item.destaque, item.detalhe,
        utilityNatureLabel(item.natureza), utilityScopeLabel(item),
        ...(Array.isArray(item.termos_busca) ? item.termos_busca : []),
        ...(Array.isArray(item.temas) ? item.temas : []),
        ...(Array.isArray(item.publicos_alvo) ? item.publicos_alvo : []),
        ...(Array.isArray(item.areas_utilidade) ? item.areas_utilidade : []),
        ...(Array.isArray(item.tipos_recurso) ? item.tipos_recurso : [])
      ].join(' ')).includes(query);
    });
  }

  function agendaVisibleContents() {
    if (state.mobileFocusedItem) {
      const items = agendaItemsForIds(new Set([state.mobileFocusedItem]));
      const group = type => items.filter(item => item.tipo_conteudo === type);
      const events = group('evento').sort(compareAgendaEvents);
      const books = group('livro').sort(agendaTitleCompare);
      const courses = group('curso').sort(agendaTitleCompare);
      const contests = group('concurso').sort(agendaTitleCompare);
      const films = group('filme').sort(agendaTitleCompare);
      const utility = group('utilidade_publica').sort(agendaTitleCompare);
      const spaces = group('espaco').sort(agendaTitleCompare);
      const activities = group('atividade_lazer').sort(agendaTitleCompare);
      return { events, books, courses, contests, films, utility, spaces, activities, total: items.length };
    }
    if (state.mobileSharedSelection) {
      const items = agendaItemsForIds(state.mobileSharedSelection);
      const group = type => items.filter(item => item.tipo_conteudo === type);
      const events = group('evento').sort(compareAgendaEvents);
      const books = group('livro').sort(agendaTitleCompare);
      const courses = group('curso').sort(agendaTitleCompare);
      const contests = group('concurso').sort(agendaTitleCompare);
      const films = group('filme').sort(agendaTitleCompare);
      const utility = group('utilidade_publica').sort(agendaTitleCompare);
      const spaces = group('espaco').sort(agendaTitleCompare);
      const activities = group('atividade_lazer').sort(agendaTitleCompare);
      return { events, books, courses, contests, films, utility, spaces, activities, total: items.length };
    }
    if (state.mobileFavoritesOnly) {
      const items = agendaFavoriteItems();
      const group = type => items.filter(item => item.tipo_conteudo === type);
      const events = group('evento').sort(compareAgendaEvents);
      const books = group('livro').sort(agendaTitleCompare);
      const courses = group('curso').sort(agendaTitleCompare);
      const contests = group('concurso').sort(agendaTitleCompare);
      const films = group('filme').sort(agendaTitleCompare);
      const utility = group('utilidade_publica').sort(agendaTitleCompare);
      const spaces = group('espaco').sort(agendaTitleCompare);
      const activities = group('atividade_lazer').sort(agendaTitleCompare);
      return { events, books, courses, contests, films, utility, spaces, activities, total: items.length };
    }
    const curation = agendaCurationEntries().find(entry => entry.id === state.mobileCuration);
    const matchesCuration = item => agendaItemMatchesCuration(item, curation);
    const events = agendaVisibleEvents().filter(matchesCuration);
    const books = agendaVisibleBooks().filter(matchesCuration);
    const courses = agendaVisibleCourses().filter(matchesCuration);
    const contests = agendaVisibleContests().filter(matchesCuration);
    const films = agendaVisibleFilms().filter(matchesCuration);
    const utility = agendaVisibleUtility().filter(matchesCuration);
    const spaces = agendaVisibleSpaces().filter(matchesCuration);
    const activities = agendaVisibleActivities().filter(matchesCuration);
    return {
      events,
      books,
      courses,
      contests,
      films,
      utility,
      spaces,
      activities,
      total: events.length + books.length + courses.length + contests.length + films.length + utility.length + spaces.length + activities.length
    };
  }

  function agendaActiveFilterCount() {
    if (state.mobileContent === 'contests') {
      return [
        state.mobileQuery,
        state.mobileCuration,
        state.mobileContestFormation,
        state.mobileContestUf,
        state.mobileContestCity,
        state.mobileContestDeadline,
        state.mobileContestState,
        state.mobileContestRemuneration
      ].filter(Boolean).length;
    }
    if (state.mobileContent === 'films') {
      return [
        state.mobileQuery,
        state.mobileCuration,
        state.mobileFilmGenre,
        state.mobileFilmPlatform,
        state.mobileTheme,
        state.mobileFilmLetter,
        state.mobileFilmAccessibility,
        state.mobileFilmCountry,
        state.mobileFilmCollection,
        state.mobileFilmRating,
        state.mobileFilmYearFrom,
        state.mobileFilmYearTo,
        state.mobileFilmDuration,
        state.mobileFilmSort !== 'title-asc' ? state.mobileFilmSort : ''
      ].filter(Boolean).length;
    }

    const common = [state.mobileQuery, state.mobileCuration];
    if (state.mobileContent !== 'all') common.push(state.mobileContent);
    if (state.mobileContent === 'events') {
      common.push(
        state.mobileTheme,
        state.mobilePeriod !== 'all' ? state.mobilePeriod : '',
        state.mobileCategory, state.mobileCity, state.mobileSpace,
        state.mobileInstitution, state.mobileRegistration
      );
    } else if (state.mobileContent === 'books') {
      common.push(
        state.mobileTheme,
        state.mobileBookAccess,
        state.mobileBookLibrary,
        state.mobileBookYearFrom,
        state.mobileBookYearTo,
        state.mobileBookAudiobook,
        state.curationMode ? state.mobileBookCover : ''
      );
    } else if (state.mobileContent === 'courses') {
      common.push(
        state.mobileTheme,
        state.mobileCourseInstitution,
        state.mobileCourseArea,
        state.mobileCourseWorkload,
        state.mobileCourseType,
        state.mobileCourseLevel,
        state.mobileCourseLanguage,
        state.mobileCourseCertificate
      );
    } else if (state.mobileContent === 'utility') {
      common.push(
        state.mobileTheme,
        state.mobileUtilityArea,
        state.mobileUtilityType,
        state.mobileUtilityNature,
        state.mobileUtilityScope,
        state.mobileUtilityAudience
      );
    } else if (state.mobileContent === 'activities') {
      common.push(
        state.mobileTheme,
        state.mobileActivityCity,
        state.mobileActivityCategory,
        state.mobileActivityModality,
        state.mobileActivityDay,
        state.mobileActivityParticipation,
        state.mobileActivityAudience,
        state.mobileActivityFormat
      );
    } else if (state.mobileContent === 'spaces') {
      common.push(
        state.mobileTheme,
        state.mobileSpaceCity,
        state.mobileSpaceVocation,
        state.mobileSpaceNature,
        state.mobileSpaceInstitution,
        state.mobileSpaceOpenDay
      );
    }
    return common.filter(Boolean).length;
  }

  function clearAgendaFilters() {
    state.mobileUtilityArea = '';
    state.mobileUtilityType = '';
    state.mobileUtilityNature = '';
    state.mobileUtilityScope = '';
    state.mobileUtilityAudience = '';
    state.mobileActivityCity = '';
    state.mobileActivityCategory = '';
    state.mobileActivityModality = '';
    state.mobileActivityDay = '';
    state.mobileActivityParticipation = '';
    state.mobileActivityAudience = '';
    state.mobileActivityFormat = '';
    state.mobileSpaceCity = '';
    state.mobileSpaceVocation = '';
    state.mobileSpaceNature = '';
    state.mobileSpaceInstitution = '';
    state.mobileSpaceOpenDay = '';
    state.mobileQuery = '';
    state.mobileCuration = '';
    state.mobileContent = 'all';
    state.mobileTheme = '';
    state.mobilePeriod = 'all';
    state.mobileCategory = '';
    state.mobileCity = '';
    state.mobileSpace = '';
    state.mobileInstitution = '';
    state.mobileRegistration = '';
    state.mobileBookAccess = '';
    state.mobileBookCover = '';
    state.mobileBookLibrary = '';
    state.mobileBookYearFrom = '';
    state.mobileBookYearTo = '';
    state.mobileBookAudiobook = '';
    state.mobileCourseInstitution = '';
    state.mobileCourseArea = '';
    state.mobileCourseWorkload = '';
    state.mobileCourseType = '';
    state.mobileCourseLevel = '';
    state.mobileCourseLanguage = '';
    state.mobileCourseCertificate = '';
    state.mobileContestFormation = '';
    state.mobileContestUf = '';
    state.mobileContestCity = '';
    state.mobileContestDeadline = '';
    state.mobileContestState = '';
    state.mobileContestRemuneration = '';
    state.mobileFilmGenre = '';
    state.mobileFilmPlatform = '';
    state.mobileFilmLetter = '';
    state.mobileFilmAccessibility = '';
    state.mobileFilmCountry = '';
    state.mobileFilmCollection = '';
    state.mobileFilmRating = '';
    state.mobileFilmYearFrom = '';
    state.mobileFilmYearTo = '';
    state.mobileFilmDuration = '';
    state.mobileFilmSort = 'title-asc';
  }

  function clearContestAgendaFilters() {
    state.mobileQuery = '';
    state.mobileCuration = '';
    state.mobileContestFormation = '';
    state.mobileContestUf = '';
    state.mobileContestCity = '';
    state.mobileContestDeadline = '';
    state.mobileContestState = '';
    state.mobileContestRemuneration = '';
  }

  function clearFilmAgendaFilters() {
    state.mobileQuery = '';
    state.mobileCuration = '';
    state.mobileFilmGenre = '';
    state.mobileFilmPlatform = '';
    state.mobileTheme = '';
    state.mobileFilmLetter = '';
    state.mobileFilmAccessibility = '';
    state.mobileFilmCountry = '';
    state.mobileFilmCollection = '';
    state.mobileFilmRating = '';
    state.mobileFilmYearFrom = '';
    state.mobileFilmYearTo = '';
    state.mobileFilmDuration = '';
    state.mobileFilmSort = 'title-asc';
  }

  function mobileSelectOptions(events, field) {
    const map = new Map();
    for (const event of events) {
      const label = String(event[field] || '').trim();
      const value = normalizeText(label);
      if (label && value && !map.has(value)) map.set(value, label);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  }

  function setMobileCardImage(img, event) {
    const candidates = eventImageCandidates(event);
    let index = 0;
    const tryNext = () => {
      if (index >= candidates.length) {
        img.closest('.agenda-card-media')?.classList.add('without-image');
        img.remove();
        return;
      }
      img.src = candidates[index++];
    };
    img.onerror = tryNext;
    img.alt = `Imagem de divulgação: ${event.titulo}`;
    img.loading = 'lazy';
    img.decoding = 'async';
    tryNext();
  }



  function isStandaloneApp() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function refreshInstallButtons() {
    document.querySelectorAll('.install-app-btn').forEach(button => {
      button.hidden = !deferredInstallPrompt || isStandaloneApp();
    });
  }

  async function installApp() {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    try { await deferredInstallPrompt.userChoice; } catch { /* navegador encerrou o diálogo */ }
    deferredInstallPrompt = null;
    refreshInstallButtons();
  }

  function storedAgendaColorScheme() {
    try {
      const stored = localStorage.getItem(AGENDA_COLOR_SCHEME_KEY);
      if (stored === 'light' || stored === 'dark') return stored;
    } catch {
      // Sem armazenamento, segue a preferência do sistema.
    }
    return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  function applyAgendaColorScheme(scheme) {
    const value = scheme === 'light' ? 'light' : 'dark';
    document.body.classList.toggle('agenda-theme-light', value === 'light');
    document.body.classList.toggle('agenda-theme-dark', value === 'dark');
    document.body.style.colorScheme = value;
    return value;
  }

  function saveAgendaColorScheme(scheme) {
    const value = applyAgendaColorScheme(scheme);
    try {
      localStorage.setItem(AGENDA_COLOR_SCHEME_KEY, value);
    } catch {
      // A escolha continua válida nesta sessão mesmo sem persistência.
    }
    return value;
  }

  function agendaThemeToggleMarkup() {
    const scheme = storedAgendaColorScheme();
    const light = scheme === 'light';
    return `
      <button
        class="agenda-theme-toggle"
        type="button"
        aria-label="${light ? 'Usar tema escuro na Agenda' : 'Usar tema claro na Agenda'}"
        aria-pressed="${light ? 'true' : 'false'}"
        title="${light ? 'Tema escuro' : 'Tema claro'}"
      >
        <svg class="agenda-theme-icon agenda-theme-icon-sun" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="4"></circle>
          <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41"></path>
        </svg>
        <svg class="agenda-theme-icon agenda-theme-icon-moon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5 8.5 8.5 0 1 0 20.5 14.2Z"></path>
        </svg>
      </button>
    `;
  }

  function agendaSubtitleLabel() {
    if (state.mobileContent === 'events') return 'Agenda Cultural';
    if (state.mobileContent === 'books') return 'Sugestão de Leitura';
    if (state.mobileContent === 'courses') return 'Cursos Online Gratuitos';
    if (state.mobileContent === 'contests') return 'Concursos públicos';
    if (state.mobileContent === 'films') return 'Filmes gratuitos';
    if (state.mobileContent === 'utility') return 'Utilidade Pública';
    if (state.mobileContent === 'spaces') return 'Espaços';
    if (state.mobileContent === 'activities') return 'Esporte e Lazer';
    return 'Descobertas culturais';
  }

  function agendaFavoriteId(item) {
    if (!item) return '';
    const type = String(item.tipo_conteudo || '').trim();
    const id = String(type === 'curso' ? item.id_fonte : item.id || '').trim();
    return type && id ? `${type}:${id}` : '';
  }

  function loadAgendaFavorites() {
    try {
      const parsed = JSON.parse(localStorage.getItem(AGENDA_FAVORITES_KEY) || '[]');
      return new Set(Array.isArray(parsed) ? parsed.filter(value => typeof value === 'string') : []);
    } catch {
      return new Set();
    }
  }

  function saveAgendaFavorites(favorites) {
    try {
      localStorage.setItem(AGENDA_FAVORITES_KEY, JSON.stringify([...favorites]));
    } catch {
      // A interface continua funcional na sessão mesmo quando o armazenamento é bloqueado.
    }
    notificationsContent?.syncFavorites?.([...favorites]);
  }

  function encodeSharedAgendaSelection(ids) {
    const json = JSON.stringify([...ids]);
    const bytes = new TextEncoder().encode(json);
    let binary = '';
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
  }

  function decodeSharedAgendaSelection(value) {
    try {
      const base64 = String(value || '').replaceAll('-', '+').replaceAll('_', '/');
      const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
      const binary = atob(padded);
      const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
      const parsed = JSON.parse(new TextDecoder().decode(bytes));
      if (!Array.isArray(parsed)) return null;
      const ids = parsed.filter(id => typeof id === 'string' && id.includes(':'));
      return new Set(ids.slice(0, 500));
    } catch {
      return null;
    }
  }

  function sharedAgendaSelectionFromUrl() {
    const url = new URL(window.location.href);
    return decodeSharedAgendaSelection(url.searchParams.get('selecao'));
  }

  function sharedAgendaShortCodeFromUrl() {
    try {
      const url = new URL(window.location.href);
      const queryCode = String(url.searchParams.get('lista') || '').trim().toUpperCase();
      if (/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{7}$/.test(queryCode)) return queryCode;
      const match = url.pathname.match(/\/s\/([23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{7})\/?$/i);
      return match ? match[1].toUpperCase() : '';
    } catch {
      return '';
    }
  }

  async function sharedAgendaSelectionFromShortLink() {
    const code = sharedAgendaShortCodeFromUrl();
    if (!code) return null;
    try {
      const response = await fetch(
        curationSuggestionApi(`/api/selecoes-compartilhadas/${encodeURIComponent(code)}`),
        { cache: 'no-store' }
      );
      if (!response.ok) return null;
      const payload = await response.json();
      const ids = Array.isArray(payload?.itens)
        ? payload.itens.filter(id => typeof id === 'string' && id.includes(':')).slice(0, 500)
        : [];
      if (!ids.length) return null;
      return {
        ids: new Set(ids),
        contexto: String(payload?.contexto || 'mural')
      };
    } catch {
      return null;
    }
  }

  function clearSharedAgendaSelectionUrl() {
    try {
      const url = new URL(window.location.href);
      let changed = false;
      if (url.searchParams.has('selecao')) {
        url.searchParams.delete('selecao');
        changed = true;
      }
      if (url.searchParams.has('lista')) {
        url.searchParams.delete('lista');
        changed = true;
      }
      if (/\/s\/[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{7}\/?$/i.test(url.pathname)) {
        url.pathname = '/';
        changed = true;
      }
      if (changed) history.replaceState(history.state, '', url);
    } catch {
      // A navegação continua funcional mesmo quando a URL não puder ser normalizada.
    }
  }

  function exitSharedAgendaSelection() {
    state.mobileSharedSelection = null;
    clearSharedAgendaSelectionUrl();
  }

  function agendaItemsForIds(ids) {
    const catalogs = [
      state.allEvents, state.allBooks, state.allCourses,
      state.allContests, state.allFilms, state.allUtility, state.allSpaces, state.allActivities
    ];
    return catalogs.flat().filter(item => ids.has(agendaFavoriteId(item)));
  }

  function sharedAgendaUrl(ids) {
    const url = new URL(window.location.href);
    url.searchParams.set('selecao', encodeSharedAgendaSelection(ids));
    url.searchParams.delete('painel');
    if (state.curationMode) {
      url.searchParams.set('modo', 'curadoria');
      url.searchParams.set('conteudo', 'livros');
    } else {
      url.searchParams.delete('modo');
      url.searchParams.delete('conteudo');
    }
    return url.toString();
  }

  async function createShortSharedAgendaUrl(ids) {
    const fallback = sharedAgendaUrl(ids);
    try {
      const response = await fetch(curationSuggestionApi('/api/selecoes-compartilhadas'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          itens: [...ids],
          contexto: state.curationMode ? 'curadoria_livros' : 'mural'
        })
      });
      const payload = await response.json().catch(() => ({}));
      const shortUrl = String(payload?.url || '').trim();
      if (response.ok && /^https?:\/\//i.test(shortUrl)) return shortUrl;
    } catch {
      // O compartilhamento continua disponível pelo formato legado.
    }
    return fallback;
  }

  async function shareAgendaFavorites() {
    const favorites = loadAgendaFavorites();
    if (!favorites.size) return;
    const url = await createShortSharedAgendaUrl(favorites);
    const data = {
      title: 'Seleção do Mural Cultural',
      text: `Separei ${favorites.size} ${favorites.size === 1 ? 'conteúdo' : 'conteúdos'} no Mural Cultural.`,
      url
    };
    if (navigator.share) {
      try {
        await navigator.share(data);
        return;
      } catch (error) {
        if (error?.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      window.alert('Link da seleção copiado. Agora é só enviar para quem você quiser.');
    } catch {
      window.prompt('Copie o link da sua seleção:', url);
    }
  }

  function openAboutProjectDialog() {
    document.getElementById('agenda-about-dialog')?.remove();

    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = document.createElement('dialog');
    dialog.id = 'agenda-about-dialog';
    dialog.className = 'agenda-curation-suggestion-dialog agenda-about-dialog';
    dialog.setAttribute('aria-labelledby', 'agenda-about-title');
    dialog.innerHTML = `
      <article class="agenda-curation-suggestion-card agenda-about-card">
        <div class="agenda-curation-suggestion-heading">
          <div>
            <p class="agenda-curation-suggestion-eyebrow">Sobre o projeto</p>
            <h2 id="agenda-about-title">Tem Sim, Uai</h2>
          </div>
          <button type="button" class="agenda-curation-suggestion-close" aria-label="Fechar">×</button>
        </div>

        <p class="agenda-about-lead"><strong>Tem Sim, Uai</strong> é um projeto de ensino e extensão da Biblioteca do Instituto Federal de Minas Gerais (IFMG) — Campus Sabará. A proposta é reunir, organizar e facilitar o acesso a informações culturais, educacionais e de utilidade pública que normalmente ficam espalhadas em diferentes sites, redes sociais, instituições e plataformas.</p>

        <div class="agenda-about-sections">
          <section class="agenda-about-section">
            <h3>Um mural para descobrir e acessar</h3>
            <p>O projeto reúne agenda de eventos gratuitos, livros e acervos, cursos e oportunidades de formação, concursos, filmes e conteúdos culturais, espaços de cultura, esporte e lazer e informações de utilidade pública. O Mural pode ser usado em exibição automática ou interativa em espaços físicos e também no modo Exploração, pelo celular ou computador.</p>
          </section>

          <section class="agenda-about-section">
            <h3>Curadoria também é formação</h3>
            <p>A curadoria de conteúdo faz parte do caráter formativo do projeto. Estudantes participam da seleção, conferência, organização e contextualização dos conteúdos, com acompanhamento da Biblioteca. A comunidade também pode sugerir eventos e indicar correções; as contribuições passam por análise antes de serem incorporadas ao Mural.</p>
          </section>

          <section class="agenda-about-section">
            <h3>Fontes e atualização</h3>
            <p>Sempre que possível, cada conteúdo mantém acesso à fonte original. Como datas, inscrições, horários e condições podem mudar, recomendamos confirmar as informações na fonte indicada antes de se deslocar ou realizar uma inscrição.</p>
          </section>

          <section class="agenda-about-section agenda-about-contact-section">
            <h3>Contato</h3>
            <address class="agenda-about-contact">
              <span><strong>Biblioteca do IFMG Campus Sabará</strong></span>
              <span>Segunda a sexta, das 09h00 às 21h00</span>
              <a href="tel:+553121029374">(31) 2102-9374</a>
              <a href="mailto:temsimuai@ifmg.edu.br">temsimuai@ifmg.edu.br</a>
            </address>
          </section>
        </div>

        <p class="agenda-about-note">O Tem Sim, Uai está em desenvolvimento contínuo. Novas fontes, conteúdos e formas de participação podem ser incorporados à medida que o projeto avança.</p>

        <div class="agenda-curation-suggestion-actions">
          <button type="button" class="agenda-about-close">Fechar</button>
        </div>
      </article>
    `;
    document.body.append(dialog);

    const close = () => {
      if (dialog.open) dialog.close();
      dialog.remove();
      if (opener?.isConnected) opener.focus();
    };

    dialog.querySelector('.agenda-curation-suggestion-close')?.addEventListener('click', close);
    dialog.querySelector('.agenda-about-close')?.addEventListener('click', close);
    dialog.addEventListener('cancel', event => {
      event.preventDefault();
      close();
    });
    dialog.addEventListener('click', event => {
      if (event.target === dialog) close();
    });
    dialog.showModal();
  }

  function openAgendaShareHub() {
    const favorites = loadAgendaFavorites();
    if (!favorites.size) return;

    document.getElementById('agenda-share-hub-dialog')?.remove();
    const dialog = document.createElement('dialog');
    dialog.id = 'agenda-share-hub-dialog';
    dialog.className = 'agenda-curation-suggestion-dialog agenda-community-dialog';
    dialog.innerHTML = `
      <div class="agenda-curation-suggestion-card">
        <div class="agenda-curation-suggestion-heading">
          <div>
            <p class="agenda-curation-suggestion-eyebrow">Compartilhar favoritos</p>
            <h2>Como você quer compartilhar esta seleção?</h2>
          </div>
          <button type="button" class="agenda-curation-suggestion-close" aria-label="Fechar">×</button>
        </div>
        <p>Escolha se deseja enviar um link para outras pessoas ou encaminhar a seleção anonimamente para análise da curadoria.</p>
        <div class="agenda-community-options">
          <button type="button" class="agenda-community-option" data-share-kind="people">
            <strong>Compartilhar com outras pessoas</strong>
            <span>Gere um link da seleção para enviar por WhatsApp, mensagem, e-mail ou outro aplicativo.</span>
          </button>
          <button type="button" class="agenda-community-option" data-share-kind="curation">
            <strong>Enviar para a curadoria</strong>
            <span>Envie os favoritos anonimamente para análise da equipe do Mural.</span>
          </button>
        </div>
      </div>
    `;
    document.body.append(dialog);

    const close = () => {
      if (dialog.open) dialog.close();
      dialog.remove();
    };

    dialog.querySelector('.agenda-curation-suggestion-close').addEventListener('click', close);
    dialog.addEventListener('cancel', event => {
      event.preventDefault();
      close();
    });

    dialog.querySelectorAll('[data-share-kind]').forEach(button => {
      button.addEventListener('click', () => {
        const kind = button.dataset.shareKind;
        close();
        if (kind === 'curation') {
          openCurationSuggestionDialog();
          return;
        }
        shareAgendaFavorites();
      });
    });

    dialog.showModal();
  }

  const CURATION_SUGGESTION_API_ORIGIN =
    window.location.hostname === 'tiago-ps.github.io'
      ? 'https://temsimuai.com.br'
      : '';

  function curationSuggestionApi(path) {
    return `${CURATION_SUGGESTION_API_ORIGIN}${path}`;
  }

  function normalizeCurationSuggestionProtocol(value) {
    return String(value || '').trim().toUpperCase();
  }

  function formatCurationSuggestionDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date);
  }

  async function openCurationSuggestionStatusDialog(prefillProtocol = '') {
    document.getElementById('agenda-curation-status-dialog')?.remove();
    const dialog = document.createElement('dialog');
    dialog.id = 'agenda-curation-status-dialog';
    dialog.className = 'agenda-curation-suggestion-dialog agenda-curation-status-dialog';
    dialog.innerHTML = `
      <form method="dialog" class="agenda-curation-suggestion-card agenda-curation-status-card">
        <div class="agenda-curation-suggestion-heading">
          <div>
            <p class="agenda-curation-suggestion-eyebrow">Acompanhar contribuição</p>
            <h2>Consultar contribuição</h2>
          </div>
          <button type="button" class="agenda-curation-suggestion-close" aria-label="Fechar">×</button>
        </div>
        <p>Digite o protocolo recebido quando você enviou uma contribuição ao Mural.</p>
        <label class="agenda-curation-status-field">
          <span>Protocolo</span>
          <input
            type="text"
            inputmode="text"
            autocomplete="off"
            autocapitalize="characters"
            spellcheck="false"
            maxlength="13"
            placeholder="SUG-XXXX-XXXX ou CON-XXXX-XXXX"
            value="${escapeHtml(normalizeCurationSuggestionProtocol(prefillProtocol))}"
          >
        </label>
        <p class="agenda-curation-suggestion-status" role="status" aria-live="polite"></p>
        <div class="agenda-curation-status-result" hidden></div>
        <div class="agenda-curation-suggestion-actions">
          <button type="button" class="secondary agenda-curation-status-cancel">Fechar</button>
          <button type="button" class="agenda-curation-status-submit">Consultar</button>
        </div>
      </form>
    `;
    document.body.append(dialog);

    const close = () => {
      if (dialog.open) dialog.close();
      dialog.remove();
    };
    dialog.querySelector('.agenda-curation-suggestion-close').addEventListener('click', close);
    dialog.querySelector('.agenda-curation-status-cancel').addEventListener('click', close);
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });

    const input = dialog.querySelector('input');
    const status = dialog.querySelector('.agenda-curation-suggestion-status');
    const resultBox = dialog.querySelector('.agenda-curation-status-result');
    const submit = dialog.querySelector('.agenda-curation-status-submit');

    const consult = async () => {
      const protocol = normalizeCurationSuggestionProtocol(input.value);
      input.value = protocol;
      resultBox.hidden = true;
      resultBox.innerHTML = '';
      status.dataset.error = 'false';

      if (!/^(SUG|CON)-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(protocol)) {
        status.textContent = 'Confira o protocolo. O formato esperado é SUG-XXXX-XXXX ou CON-XXXX-XXXX.';
        status.dataset.error = 'true';
        return;
      }

      submit.disabled = true;
      status.textContent = 'Consultando…';
      try {
        const statusPath = protocol.startsWith('CON-')
          ? '/api/contribuicoes-comunidade/status'
          : '/api/sugestoes-curadoria/status';
        const response = await fetch(
          curationSuggestionApi(`${statusPath}?protocolo=${encodeURIComponent(protocol)}`),
          {cache:'no-store'}
        );
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.erro || 'Não foi possível consultar o protocolo.');

        const received = formatCurationSuggestionDate(payload.criado_em);
        const updated = formatCurationSuggestionDate(payload.atualizado_em);
        resultBox.innerHTML = `
          <p class="agenda-curation-status-protocol">${escapeHtml(payload.protocolo || protocol)}</p>
          ${payload.tipo_label ? `<p class="agenda-curation-status-type">${escapeHtml(payload.tipo_label)}</p>` : ''}
          <p class="agenda-curation-status-badge" data-status="${escapeHtml(payload.status || '')}">${escapeHtml(payload.status_label || 'Recebida')}</p>
          ${received ? `<p><strong>Recebida em:</strong> ${escapeHtml(received)}</p>` : ''}
          ${updated ? `<p><strong>Última atualização:</strong> ${escapeHtml(updated)}</p>` : ''}
          <p class="helper">Esta consulta mostra somente o andamento. Os dados enviados e informações internas da equipe não são exibidos publicamente.</p>
        `;
        resultBox.hidden = false;
        status.textContent = '';
      } catch (error) {
        status.textContent = error.message || 'Não foi possível consultar o protocolo.';
        status.dataset.error = 'true';
      } finally {
        submit.disabled = false;
      }
    };

    submit.addEventListener('click', consult);
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        consult();
      }
    });

    dialog.showModal();
    if (prefillProtocol) consult();
    else input.focus();
  }

  let turnstileLoaderPromise = null;

  function loadTurnstileApi() {
    if (window.turnstile) return Promise.resolve(window.turnstile);
    if (turnstileLoaderPromise) return turnstileLoaderPromise;
    turnstileLoaderPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-mural-turnstile]');
      if (existing) {
        existing.addEventListener('load', () => resolve(window.turnstile), {once:true});
        existing.addEventListener('error', reject, {once:true});
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.dataset.muralTurnstile = '1';
      script.addEventListener('load', () => resolve(window.turnstile), {once:true});
      script.addEventListener('error', reject, {once:true});
      document.head.append(script);
    });
    return turnstileLoaderPromise;
  }

  function communityContributionTitle(item) {
    return String(
      item?.titulo || item?.nome || item?.pergunta_curiosidade ||
      item?.orgao || item?.instituicao || 'Conteúdo do Mural'
    ).trim();
  }

  function openCommunityContributionHub() {
    document.getElementById('agenda-community-hub-dialog')?.remove();
    const dialog = document.createElement('dialog');
    dialog.id = 'agenda-community-hub-dialog';
    dialog.className = 'agenda-curation-suggestion-dialog agenda-community-dialog';
    dialog.innerHTML = `
      <div class="agenda-curation-suggestion-card">
        <div class="agenda-curation-suggestion-heading">
          <div>
            <p class="agenda-curation-suggestion-eyebrow">Ajude a construir o Mural</p>
            <h2>Contribua com o Mural</h2>
          </div>
          <button type="button" class="agenda-curation-suggestion-close" aria-label="Fechar">×</button>
        </div>
        <p>Você pode sugerir conteúdos, ajudar a corrigir informações ou participar da seleção de livros para o Mural.</p>
        <div class="agenda-community-options">
          <button type="button" class="agenda-community-option" data-kind="sugerir_evento">
            <strong>Sugerir um evento</strong>
            <span>Envie um evento gratuito de BH e região metropolitana para a equipe verificar.</span>
          </button>
          <button type="button" class="agenda-community-option" data-kind="corrigir_informacao">
            <strong>Corrigir uma informação</strong>
            <span>Informe qual conteúdo precisa de ajuste e explique a correção.</span>
          </button>
          <button type="button" class="agenda-community-option agenda-community-option-books" data-kind="selecionar_livros">
            <span class="agenda-community-option-kicker">Acervo ampliado</span>
            <strong>Ajude a selecionar livros</strong>
            <span>Explore o acervo completo das bibliotecas, marque seus favoritos e envie uma seleção para o Mural. Os livros desse ambiente ainda não estão necessariamente publicados no site.</span>
          </button>
        </div>
        <div class="agenda-community-followup">
          <div>
            <strong>Já enviou uma contribuição?</strong>
            <span>Acompanhe o andamento usando o protocolo recebido no envio.</span>
          </div>
          <button type="button" class="agenda-community-track">
            <span aria-hidden="true">⌕</span>
            <span>Consultar protocolo</span>
          </button>
        </div>
        <p class="agenda-curation-suggestion-privacy"><strong>Não pedimos nome, e-mail ou cadastro.</strong> Não inclua dados pessoais nos campos de texto.</p>
      </div>
    `;
    document.body.append(dialog);
    const close = () => {
      if (dialog.open) dialog.close();
      dialog.remove();
    };
    dialog.querySelector('.agenda-curation-suggestion-close').addEventListener('click', close);
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
    dialog.querySelector('.agenda-community-track').addEventListener('click', () => {
      close();
      openCurationSuggestionStatusDialog();
    });
    dialog.querySelectorAll('.agenda-community-option').forEach(button => {
      button.addEventListener('click', () => {
        const kind = button.dataset.kind;
        close();
        if (kind === 'selecionar_livros') {
          window.location.assign(curationBooksContributionUrl());
          return;
        }
        openCommunityContributionForm(kind);
      });
    });
    dialog.showModal();
  }

  async function openCommunityContributionForm(kind, context = {}) {
    if (!['sugerir_evento', 'corrigir_informacao', 'opiniao_livro'].includes(kind)) return;
    document.getElementById('agenda-community-form-dialog')?.remove();
    const isEvent = kind === 'sugerir_evento';
    const isBookOpinion = kind === 'opiniao_livro';
    const dialog = document.createElement('dialog');
    dialog.id = 'agenda-community-form-dialog';
    dialog.className = 'agenda-curation-suggestion-dialog agenda-community-dialog';
    const itemTitle = String(context.item_titulo || '').trim();
    const itemAuthor = String(context.item_autor || '').trim();
    const itemWorkId = String(context.id_obra || '').trim();
    dialog.innerHTML = `
      <form class="agenda-curation-suggestion-card agenda-community-form">
        <div class="agenda-curation-suggestion-heading">
          <div>
            <p class="agenda-curation-suggestion-eyebrow">Contribuição anônima</p>
            <h2>${isEvent ? 'Sugerir um evento' : (isBookOpinion ? 'Dê sua opinião sobre este livro' : 'Corrigir uma informação')}</h2>
          </div>
          <button type="button" class="agenda-curation-suggestion-close" aria-label="Fechar">×</button>
        </div>
        <p class="agenda-curation-suggestion-privacy"><strong>Não pedimos nome, e-mail ou cadastro.</strong> Envie somente informações necessárias para a equipe verificar a contribuição.</p>
        ${isBookOpinion ? '<p class="agenda-curation-suggestion-privacy">Suas respostas serão usadas como apoio para a equipe elaborar a mensagem de estímulo e o mini resumo do livro. Elas não substituem automaticamente os textos editoriais nem são publicadas automaticamente.</p>' : ''}
        ${isEvent ? `
          <label class="agenda-community-field"><span>Nome do evento *</span><input name="titulo" maxlength="180" required></label>
          <div class="agenda-community-field-grid">
            <label class="agenda-community-field"><span>Cidade <small>(opcional)</small></span><input name="cidade" maxlength="120" placeholder="Ex.: Belo Horizonte"></label>
            <label class="agenda-community-field"><span>Data ou período <small>(opcional)</small></span><input name="data" maxlength="120" placeholder="Ex.: 12 de outubro, às 15h"></label>
          </div>
          <label class="agenda-community-field"><span>Link de referência <small>(recomendado)</small></span><input name="link_referencia" type="url" inputmode="url" maxlength="1200" placeholder="https://..."></label>
          <label class="agenda-community-field"><span>Onde podemos confirmar / observação <small>(opcional se houver link)</small></span><textarea name="observacao" maxlength="1200" rows="4" placeholder="Ex.: Divulgação no Instagram da instituição, atividade gratuita no parque..."></textarea></label>
        ` : isBookOpinion ? `
          <p class="agenda-curation-suggestion-privacy"><strong>Livro:</strong> ${escapeHtml(itemTitle)}${itemAuthor ? ` · ${escapeHtml(itemAuthor)}` : ''}</p>
          <input name="item_id" type="hidden" value="${escapeHtml(String(context.item_id || ''))}">
          <input name="id_obra" type="hidden" value="${escapeHtml(itemWorkId)}">
          <input name="titulo" type="hidden" value="${escapeHtml(itemTitle)}">
          <input name="autor" type="hidden" value="${escapeHtml(itemAuthor)}">
          <p class="agenda-curation-suggestion-privacy">Responda apenas ao que quiser. <strong>As três opções abaixo são opcionais</strong>; basta preencher pelo menos uma delas.</p>
          <label class="agenda-community-field">
            <span>O que você diria para alguém ficar com vontade de ler este livro? <small>(opcional)</small></span>
            <textarea name="estimulo_leitura" maxlength="1200" rows="4" placeholder="Conte, com suas palavras, o que torna essa leitura interessante."></textarea>
          </label>
          <label class="agenda-community-field">
            <span>Como você resumiria este livro para alguém que ainda não conhece? <small>(opcional)</small></span>
            <textarea name="mini_resumo_leitor" maxlength="1200" rows="4" placeholder="Faça um resumo curto, sem se preocupar em escrever um texto editorial pronto."></textarea>
          </label>
          <label class="agenda-community-field">
            <span>Quer acrescentar alguma coisa? <small>(opcional)</small></span>
            <textarea name="comentario" maxlength="1200" rows="3" placeholder="Impressões, temas, para quem você recomendaria a leitura..."></textarea>
          </label>
        ` : `
          <label class="agenda-community-field"><span>Conteúdo que precisa de correção *</span><input name="item_titulo" maxlength="220" required value="${escapeHtml(itemTitle)}" placeholder="Ex.: nome do evento, livro, curso..."></label>
          <input name="item_id" type="hidden" value="${escapeHtml(String(context.item_id || ''))}">
          <label class="agenda-community-field"><span>O que precisa ser corrigido? *</span><textarea name="correcao" maxlength="1200" rows="5" required placeholder="Explique a informação incorreta e, se souber, qual é a informação correta."></textarea></label>
          <label class="agenda-community-field"><span>Link que confirma a correção <small>(opcional)</small></span><input name="link_referencia" type="url" inputmode="url" maxlength="1200" placeholder="https://..."></label>
        `}
        <div class="agenda-curation-turnstile" hidden></div>
        <p class="agenda-curation-suggestion-status" role="status" aria-live="polite">Verificando disponibilidade do envio…</p>
        <div class="agenda-curation-suggestion-actions">
          <button type="button" class="secondary agenda-community-cancel">Cancelar</button>
          <button type="submit" class="agenda-community-submit" disabled>Enviar contribuição</button>
        </div>
      </form>
    `;
    document.body.append(dialog);

    const form = dialog.querySelector('form');
    const status = dialog.querySelector('.agenda-curation-suggestion-status');
    const submit = dialog.querySelector('.agenda-community-submit');
    const turnstileBox = dialog.querySelector('.agenda-curation-turnstile');
    let turnstileToken = '';
    let turnstileWidgetId = null;
    let config = null;
    const close = () => {
      if (dialog.open) dialog.close();
      dialog.remove();
    };
    dialog.querySelector('.agenda-curation-suggestion-close').addEventListener('click', close);
    dialog.querySelector('.agenda-community-cancel').addEventListener('click', close);
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
    dialog.showModal();

    try {
      const response = await fetch(curationSuggestionApi('/api/contribuicoes-comunidade/config'), {cache:'no-store'});
      config = await response.json();
      if (!response.ok || !config?.disponivel || !Array.isArray(config?.tipos) || !config.tipos.includes(kind)) {
        throw new Error('indisponivel');
      }
      if (config.turnstile_site_key) {
        turnstileBox.hidden = false;
        const api = await loadTurnstileApi();
        turnstileWidgetId = api.render(turnstileBox, {
          sitekey: config.turnstile_site_key,
          action: 'contribuir_mural',
          callback: token => {
            turnstileToken = token;
            submit.disabled = false;
            status.textContent = 'Pronto para enviar.';
          },
          'expired-callback': () => {
            turnstileToken = '';
            submit.disabled = true;
            status.textContent = 'A verificação expirou. Confirme novamente para enviar.';
          },
          'error-callback': () => {
            turnstileToken = '';
            submit.disabled = true;
            status.textContent = 'Não foi possível concluir a verificação. Tente novamente.';
          }
        });
        status.textContent = 'Confirme a verificação para enviar.';
      } else {
        submit.disabled = false;
        status.textContent = 'Pronto para enviar.';
      }
    } catch {
      status.textContent = 'O envio de contribuições está temporariamente indisponível.';
      status.dataset.error = 'true';
    }

    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!config?.disponivel || submit.disabled) return;
      const data = new FormData(form);
      const dados = isEvent ? {
        titulo: data.get('titulo'),
        cidade: data.get('cidade'),
        data: data.get('data'),
        link_referencia: data.get('link_referencia'),
        observacao: data.get('observacao')
      } : isBookOpinion ? {
        item_id: data.get('item_id'),
        id_obra: data.get('id_obra'),
        titulo: data.get('titulo'),
        autor: data.get('autor'),
        estimulo_leitura: data.get('estimulo_leitura'),
        mini_resumo_leitor: data.get('mini_resumo_leitor'),
        comentario: data.get('comentario')
      } : {
        item_id: data.get('item_id'),
        item_titulo: data.get('item_titulo'),
        correcao: data.get('correcao'),
        link_referencia: data.get('link_referencia')
      };

      if (isBookOpinion) {
        const hasOpinionText = [
          dados.estimulo_leitura,
          dados.mini_resumo_leitor,
          dados.comentario
        ].some(value => String(value || '').trim().length > 0);
        if (!hasOpinionText) {
          status.textContent = 'Preencha pelo menos uma das três opções de texto para enviar sua opinião.';
          status.dataset.error = 'true';
          return;
        }
      }

      submit.disabled = true;
      status.dataset.error = 'false';
      status.textContent = 'Enviando contribuição…';
      try {
        const response = await fetch(curationSuggestionApi('/api/contribuicoes-comunidade'), {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({
            schema_version: 1,
            tipo: kind,
            dados,
            turnstile_token: turnstileToken
          })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.erro || 'Não foi possível enviar a contribuição.');
        form.innerHTML = `
          <div class="agenda-curation-suggestion-success">
            <p class="agenda-curation-suggestion-eyebrow">Contribuição recebida</p>
            <h2>Obrigado por ajudar o Mural.</h2>
            <p>A equipe vai verificar as informações enviadas.</p>
            <p>Protocolo: <strong class="agenda-curation-suggestion-protocol">${escapeHtml(result.protocolo || '')}</strong></p>
            <p class="helper">Guarde o protocolo para consultar o andamento desta contribuição.</p>
            <div class="agenda-curation-suggestion-actions">
              <button type="button" class="secondary agenda-community-done">Fechar</button>
              <button type="button" class="agenda-community-track">Acompanhar contribuição</button>
            </div>
          </div>
        `;
        const protocol = String(result.protocolo || '');
        form.querySelector('.agenda-community-done').addEventListener('click', close);
        form.querySelector('.agenda-community-track').addEventListener('click', () => {
          close();
          openCurationSuggestionStatusDialog(protocol);
        });
      } catch (error) {
        status.textContent = error.message || 'Não foi possível enviar a contribuição.';
        status.dataset.error = 'true';
        submit.disabled = false;
        if (turnstileWidgetId !== null && window.turnstile) {
          turnstileToken = '';
          submit.disabled = true;
          window.turnstile.reset(turnstileWidgetId);
        }
      }
    });
  }

  window.openMuralCommunityCorrection = context => {
    state.paused = true;
    clearTimeout(state.timer);
    updatePlayPauseButton();
    openCommunityContributionForm('corrigir_informacao', context || {});
  };

  function curationSuggestionSelection() {
    if (state.mobileSharedSelection?.size) return new Set(state.mobileSharedSelection);
    if (state.mobileFavoritesOnly) return loadAgendaFavorites();
    return new Set();
  }

  async function openCurationSuggestionDialog() {
    const selection = curationSuggestionSelection();
    if (!selection.size) return;

    document.getElementById('agenda-curation-suggestion-dialog')?.remove();
    const dialog = document.createElement('dialog');
    dialog.id = 'agenda-curation-suggestion-dialog';
    dialog.className = 'agenda-curation-suggestion-dialog';
    dialog.innerHTML = `
      <form method="dialog" class="agenda-curation-suggestion-card">
        <div class="agenda-curation-suggestion-heading">
          <div>
            <p class="agenda-curation-suggestion-eyebrow">Contribuição anônima</p>
            <h2>Enviar seleção para a curadoria</h2>
          </div>
          <button type="button" class="agenda-curation-suggestion-close" aria-label="Fechar">×</button>
        </div>
        <p>Você está enviando <strong>${selection.size}</strong> ${selection.size === 1 ? 'conteúdo' : 'conteúdos'} para análise da equipe do Mural.</p>
        <p class="agenda-curation-suggestion-privacy"><strong>Não pedimos nome, e-mail ou cadastro.</strong> A curadoria recebe somente os conteúdos selecionados e a mensagem opcional abaixo. Não inclua dados pessoais na mensagem.</p>
        <label class="agenda-curation-suggestion-message">
          <span>Mensagem para a curadoria <small>(opcional)</small></span>
          <textarea maxlength="1200" rows="4" placeholder="Ex.: Acho que estes conteúdos combinam com uma curadoria sobre…"></textarea>
        </label>
        <div class="agenda-curation-turnstile" hidden></div>
        <p class="agenda-curation-suggestion-status" role="status" aria-live="polite">Verificando disponibilidade do envio…</p>
        <div class="agenda-curation-suggestion-actions">
          <button type="button" class="secondary agenda-curation-suggestion-cancel">Cancelar</button>
          <button type="button" class="agenda-curation-suggestion-submit" disabled>Enviar anonimamente</button>
        </div>
      </form>
    `;
    document.body.append(dialog);

    const close = () => {
      if (dialog.open) dialog.close();
      dialog.remove();
    };
    dialog.querySelector('.agenda-curation-suggestion-close').addEventListener('click', close);
    dialog.querySelector('.agenda-curation-suggestion-cancel').addEventListener('click', close);
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });

    const status = dialog.querySelector('.agenda-curation-suggestion-status');
    const submit = dialog.querySelector('.agenda-curation-suggestion-submit');
    const textarea = dialog.querySelector('textarea');
    const turnstileBox = dialog.querySelector('.agenda-curation-turnstile');
    let turnstileToken = '';
    let turnstileWidgetId = null;
    let config = null;

    dialog.showModal();

    try {
      const response = await fetch(curationSuggestionApi('/api/sugestoes-curadoria/config'), {cache:'no-store'});
      config = await response.json();
      if (!response.ok || !config?.disponivel) throw new Error('indisponivel');

      if (config.turnstile_site_key) {
        turnstileBox.hidden = false;
        const api = await loadTurnstileApi();
        turnstileWidgetId = api.render(turnstileBox, {
          sitekey: config.turnstile_site_key,
          action: 'sugerir_curadoria',
          callback: token => {
            turnstileToken = token;
            submit.disabled = false;
            status.textContent = 'Pronto para enviar.';
          },
          'expired-callback': () => {
            turnstileToken = '';
            submit.disabled = true;
            status.textContent = 'A verificação expirou. Confirme novamente para enviar.';
          },
          'error-callback': () => {
            turnstileToken = '';
            submit.disabled = true;
            status.textContent = 'Não foi possível concluir a verificação. Tente novamente.';
          }
        });
        status.textContent = 'Confirme a verificação para enviar.';
      } else {
        submit.disabled = false;
        status.textContent = 'Pronto para enviar.';
      }
    } catch {
      status.textContent = 'O envio direto à curadoria está temporariamente indisponível neste endereço. Seus favoritos continuam salvos neste dispositivo.';
      status.dataset.error = 'true';
    }

    submit.addEventListener('click', async () => {
      if (!config?.disponivel || submit.disabled) return;
      submit.disabled = true;
      status.dataset.error = 'false';
      status.textContent = 'Enviando sua sugestão…';
      try {
        const response = await fetch(curationSuggestionApi('/api/sugestoes-curadoria'), {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({
            schema_version: 1,
            origem: 'mural',
            itens: [...selection],
            mensagem: textarea.value,
            turnstile_token: turnstileToken
          })
        });
        const result = await response.json();
        if (!response.ok) throw Object.assign(new Error(result.erro || 'Não foi possível enviar a sugestão.'), {status: response.status});
        dialog.querySelector('.agenda-curation-suggestion-card').innerHTML = `
          <div class="agenda-curation-suggestion-success">
            <p class="agenda-curation-suggestion-eyebrow">Sugestão recebida</p>
            <h2>Obrigado por contribuir com o Mural.</h2>
            <p>A seleção foi enviada anonimamente para análise da curadoria.</p>
            <p>Protocolo: <strong class="agenda-curation-suggestion-protocol">${escapeHtml(result.protocolo || '')}</strong></p>
            <p class="helper">Guarde o protocolo: ele permite consultar o andamento desta sugestão. Seus favoritos continuam salvos neste navegador enquanto os dados locais do site forem mantidos.</p>
            <div class="agenda-curation-suggestion-actions">
              <button type="button" class="secondary agenda-curation-suggestion-done">Fechar</button>
              <button type="button" class="agenda-curation-suggestion-track">Acompanhar sugestão</button>
            </div>
          </div>
        `;
        const submittedProtocol = String(result.protocolo || '');
        dialog.querySelector('.agenda-curation-suggestion-done').addEventListener('click', close);
        dialog.querySelector('.agenda-curation-suggestion-track').addEventListener('click', () => {
          close();
          openCurationSuggestionStatusDialog(submittedProtocol);
        });
      } catch (error) {
        status.textContent = error.message || 'Não foi possível enviar a sugestão.';
        status.dataset.error = 'true';
        submit.disabled = false;
        if (turnstileWidgetId !== null && window.turnstile) {
          turnstileToken = '';
          submit.disabled = true;
          window.turnstile.reset(turnstileWidgetId);
        }
      }
    });
  }

  function agendaFavoriteItems() {
    const favorites = loadAgendaFavorites();
    return agendaItemsForIds(favorites);
  }

  function decorateAgendaFavorite(article, item) {
    const favoriteId = agendaFavoriteId(item);
    if (!article || !favoriteId) return article;
    article.dataset.muralContentId = favoriteId;
    article.dataset.muralContentType = favoriteId.split(':', 1)[0] || '';
    const favorites = loadAgendaFavorites();
    const active = favorites.has(favoriteId);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `agenda-favorite-button${active ? ' is-favorite' : ''}`;
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
    button.setAttribute('aria-label', active ? 'Remover dos favoritos' : 'Adicionar aos favoritos');
    button.title = active ? 'Remover dos favoritos' : 'Adicionar aos favoritos';
    button.innerHTML = '<span aria-hidden="true">★</span>';
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      const current = loadAgendaFavorites();
      if (current.has(favoriteId)) current.delete(favoriteId);
      else current.add(favoriteId);
      saveAgendaFavorites(current);
      if (state.mobileFavoritesOnly) renderAgenda();
      else {
        const selected = current.has(favoriteId);
        button.classList.toggle('is-favorite', selected);
        button.setAttribute('aria-pressed', selected ? 'true' : 'false');
        button.setAttribute('aria-label', selected ? 'Remover dos favoritos' : 'Adicionar aos favoritos');
        button.title = selected ? 'Remover dos favoritos' : 'Adicionar aos favoritos';
        document.querySelectorAll('.agenda-favorites-count').forEach(node => {
          node.textContent = String(current.size);
          node.hidden = current.size === 0;
        });
      }
    });
    article.append(button);

    if (!state.curationMode) {
      let actions = article.querySelector('.agenda-card-actions');
      if (!actions) {
        actions = document.createElement('div');
        actions.className = 'agenda-card-actions';
        article.querySelector('.agenda-card-body')?.append(actions);
      }
      if (actions) {
        const correction = document.createElement('button');
        correction.type = 'button';
        correction.className = 'secondary agenda-correction-button';
        correction.textContent = 'Corrigir informação';
        correction.addEventListener('click', event => {
          event.preventDefault();
          event.stopPropagation();
          openCommunityContributionForm('corrigir_informacao', {
            item_id: favoriteId,
            item_titulo: communityContributionTitle(item)
          });
        });
        actions.append(correction);
      }
    }
    return article;
  }

  function renderAgendaCard(item, options = {}) {
    if (item.tipo_conteudo === 'espaco') {
      return decorateAgendaFavorite(spacesContent.createAgendaCard(item, { safeExternalUrl, safeImageUrl }), item);
    }

    if (item.tipo_conteudo === 'atividade_lazer') {
      return decorateAgendaFavorite(activitiesContent.createAgendaCard(item, { safeExternalUrl, safeImageUrl }), item);
    }

    if (item.tipo_conteudo === 'utilidade_publica') {
      return decorateAgendaFavorite(utilityContent.createAgendaCard(item, { safeExternalUrl, safeImageUrl }), item);
    }

    if (item.tipo_conteudo === 'filme') {
      return decorateAgendaFavorite(filmsContent.createAgendaCard(item, {
        escapeHtml,
        safeExternalUrl,
        showDetails: (movie, opener) => filmsContent.showDetails(movie, opener, escapeHtml, safeExternalUrl)
      }), item);
    }

    if (item.tipo_conteudo === 'concurso') {
      return decorateAgendaFavorite(contestsContent.createAgendaCard(item, {
        safeExternalUrl,
        safeImageUrl
      }), item);
    }

    if (item.tipo_conteudo === 'curso') {
      return decorateAgendaFavorite(coursesContent.createAgendaCard(item, {
        safeExternalUrl,
        safeImageUrl,
        escapeHtml
      }), item);
    }

    const article = document.createElement('article');
    article.className = `agenda-card ${item.tipo_conteudo === 'livro' ? 'agenda-book-card' : 'agenda-event-card'}`;

    if (item.tipo_conteudo === 'livro') {
      const holdingsHtml = agendaBookHoldingsHtml(item);
      const acervosCount = bookAcervos(item).length;
      const audiobookUrl = bookAudiobookUrl(item);
      const audiobookLabel = bookAudiobookLabel(item);
      const curationOnly = item._catalogo_curadoria === true;
      const bookImage = safeImageUrl(item.imagem);
      const opinionBookId = String(item.id || '').trim();
      const opinionsEnabled = Boolean(opinionBookId);
      article.innerHTML = `
        <div class="agenda-card-media book-media">${bookImage
          ? `<img src="${escapeHtml(bookImage)}" alt="Capa: ${escapeHtml(item.titulo || '')}" loading="lazy">`
          : `<div class="agenda-book-placeholder" role="img" aria-label="Livro sem capa disponível"><span aria-hidden="true">${escapeHtml(item.icone || '📚')}</span><strong>Livro</strong></div>`}</div>
        <div class="agenda-card-body">
          <div class="agenda-card-badges"><span>Livro</span>${curationOnly ? '<span class="curation-catalog-badge">Acervo — ainda não publicado no Mural</span>' : ''}${item._capa_automatica ? '<span class="curation-auto-cover-badge">Capa automática — não verificada</span>' : ''}${item.acesso_fisico ? '<span>Físico</span>' : ''}${item.acesso_virtual ? '<span>Virtual</span>' : ''}${audiobookUrl ? '<span>Audiolivro</span>' : ''}${acervosCount > 1 ? `<span>${acervosCount} acervos</span>` : ''}</div>
          <p class="agenda-card-date">Sugestão de Leitura</p>
          <h2>${escapeHtml(item.pergunta_curiosidade || item.titulo || 'Livro')}</h2>
          <p class="agenda-card-place"><strong class="agenda-book-title">${escapeHtml(item.titulo || '')}</strong>${item.autor ? ` · ${escapeHtml(item.autor)}` : ''}</p>
          <p class="agenda-card-description">${escapeHtml(item.texto_apoio || '')}</p>
          ${holdingsHtml}
          ${audiobookUrl ? `<div class="agenda-card-actions"><a href="${escapeHtml(audiobookUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(audiobookLabel)}</a></div>` : ''}
          ${item.exibir_comentario && item.comentario_aprovado ? `<blockquote class="agenda-book-opinion">“${escapeHtml(item.comentario_aprovado)}”<cite>${escapeHtml(item.credito_comentario || 'Leitor(a) do IFMG')}</cite></blockquote>` : ''}
          ${opinionsEnabled ? '<div class="agenda-card-actions"><a class="secondary agenda-book-opinion-open" href="#">Dê sua opinião sobre este livro</a></div>' : ''}
        </div>`;
      bindAgendaBookHoldingsToggle(article);
      const opinionAction = article.querySelector('.agenda-book-opinion-open');
      if (opinionAction) {
        opinionAction.addEventListener('click', event => {
          event.preventDefault();
          openCommunityContributionForm('opiniao_livro', {
            item_id: `livro:${opinionBookId}`,
            id_obra: String(item.id_obra || '').trim(),
            item_titulo: String(item.titulo || '').trim(),
            item_autor: String(item.autor || '').trim()
          });
        });
      }
      return decorateAgendaFavorite(article, item);
    }

    const event = item;
    const link = eventPublicLink(event);
    const map = safeExternalUrl(event.mapa);
    const closedRegistration = registrationIsClosed(event);
    const rating = normalizeRating(event.classificacao_indicativa);
    const accessLabel = event.gratuito === true ? 'Gratuito' : (event.condicao_acesso || 'Acesso não informado');
    article.innerHTML = `
      <div class="agenda-card-media"><img></div>
      <div class="agenda-card-body">
        <div class="agenda-card-badges">
          <span>${escapeHtml(event.categoria || 'Evento')}</span><span>${escapeHtml(accessLabel)}</span>${rating ? `<span>${escapeHtml(rating.label)}</span>` : ''}
        </div>
        <p class="agenda-card-date">${escapeHtml(mobileDateLabel(event))}${event.horario ? ` • ${escapeHtml(event.horario)}` : ''}</p>
        <h2>${escapeHtml(event.titulo || 'Evento cultural')}</h2>
        <p class="agenda-card-place">${escapeHtml([eventPlace(event), event.cidade].filter(Boolean).join(' • ') || 'Local não informado')}</p>
        <p class="agenda-card-description">${escapeHtml(event.descricao || '')}</p>
        <div class="agenda-card-actions">
          ${link ? `<a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">${closedRegistration ? 'Programação do evento' : 'Programação e inscrição'}</a>` : closedRegistration ? '<span class="agenda-action-disabled">Inscrições encerradas</span>' : ''}
          ${map ? `<a class="secondary" href="${escapeHtml(map)}" target="_blank" rel="noopener noreferrer">Como chegar</a>` : ''}
        </div>
      </div>`;
    const image = article.querySelector('img');
    if (options.exclusiveUnfilteredEvent) {
      const source = exclusiveAgendaEventImage(event);
      if (source) {
        image.src = source;
        image.alt = `Imagem de divulgação: ${event.titulo || ''}`;
        image.loading = 'lazy';
        image.decoding = 'async';
      } else {
        image.closest('.agenda-card-media')?.remove();
      }
    } else {
      setMobileCardImage(image, event);
    }
    return decorateAgendaFavorite(article, item);
  }

  function resetAgendaBatches() {
    for (const content of Object.keys(AGENDA_CONTENT_LABELS)) {
      state.agendaVisibleCounts[content] = AGENDA_BATCH_SIZE;
    }
  }

  function nextAgendaVisibleCount(visibleCount, total) {
    return Math.min(visibleCount + AGENDA_BATCH_SIZE, total);
  }

  function appendAgendaCardRange(container, items, start, end, renderItem = renderAgendaCard) {
    const fragment = document.createDocumentFragment();
    items.slice(start, end).forEach(item => fragment.append(renderItem(item)));
    container.append(fragment);
  }

  function createAgendaProgressiveControl(grid, items, content, renderItem = renderAgendaCard) {
    const labels = AGENDA_CONTENT_LABELS[content];
    const total = items.length;
    let visibleCount = Math.min(state.agendaVisibleCounts[content], total);
    grid.id = `agenda-grid-${content}`;
    grid.setAttribute('aria-live', 'off');
    appendAgendaCardRange(grid, items, 0, visibleCount, renderItem);

    if (visibleCount >= total) return null;

    const control = document.createElement('div');
    control.className = 'agenda-progressive';
    control.innerHTML = `
      <p class="agenda-progress">Mostrando <strong>${visibleCount}</strong> de <strong>${total}</strong> ${labels.plural}</p>
      <button type="button" class="agenda-more" aria-label="Mostrar mais ${labels.plural}" aria-controls="${grid.id}">Mostrar mais ${labels.plural}</button>
      <p class="agenda-progress-status" role="status" aria-live="polite" aria-atomic="true"></p>
    `;

    const progress = control.querySelector('.agenda-progress');
    const button = control.querySelector('.agenda-more');
    const status = control.querySelector('.agenda-progress-status');

    button.addEventListener('click', () => {
      if (button.getAttribute('aria-disabled') === 'true') return;

      const previousCount = visibleCount;
      visibleCount = nextAgendaVisibleCount(previousCount, total);
      appendAgendaCardRange(grid, items, previousCount, visibleCount, renderItem);
      state.agendaVisibleCounts[content] = visibleCount;

      progress.innerHTML = `Mostrando <strong>${visibleCount}</strong> de <strong>${total}</strong> ${labels.plural}`;
      status.textContent = `Mais ${visibleCount - previousCount} ${labels.plural} carregados. ${visibleCount} de ${total} exibidos.`;

      if (visibleCount >= total) {
        button.textContent = `Todos os ${labels.plural} exibidos`;
        button.setAttribute('aria-label', `Todos os ${labels.plural} estão exibidos`);
        button.setAttribute('aria-disabled', 'true');
        button.classList.add('is-complete');
      }
    });

    return control;
  }

  function filmSourceNotice() {
    const source = document.createElement('div');
    source.className = 'film-source-notice';
    const text = document.createElement('p');
    text.textContent = 'Os filmes são disponibilizados gratuitamente nas plataformas indicadas em cada card. O Mural Cultural não hospeda os vídeos.';
    source.append(text);
    if (filmsContent.catalogUsesTmdb(state.allFilms)) {
      const creditHint = document.createElement('p');
      creditHint.className = 'film-source-credit-hint';
      creditHint.textContent = 'Alguns cartazes ou sinopses usam dados do TMDB. Este produto usa a API do TMDB, mas não é endossado nem certificado pelo TMDB.';
      source.append(creditHint);
    }
    return source;
  }

  function platformIndex(data) {
    const byId = new Map();
    const byName = new Map();
    const items = Array.isArray(data?.plataformas) ? data.plataformas : [];
    for (const platform of items) {
      const id = String(platform?.id || '').trim();
      const name = String(platform?.nome || '').trim();
      if (id) byId.set(id, platform);
      if (name) byName.set(normalizeText(name), platform);
    }
    return { byId, byName };
  }

  function applyFilmPlatformFallback(movie, index) {
    if (!movie || typeof movie !== 'object' || movie.imagem) return movie;
    const platform = index.byId.get(String(movie.plataforma_id || '').trim()) ||
      index.byName.get(normalizeText(movie.plataforma || movie.fonte || ''));
    const image = String(platform?.imagem || '').trim();
    if (!image) return movie;
    return {
      ...movie,
      imagem: image,
      imagem_fonte: String(platform.nome || movie.plataforma || movie.fonte || '').trim(),
      imagem_pagina_origem: String(platform.site || '').trim(),
      imagem_fallback_origem: 'plataforma_audiovisual',
      plataforma_id: String(movie.plataforma_id || platform.id || '').trim()
    };
  }

  function appendAgendaSection(container, title, items, contentValue, actionLabel) {
    if (!items.length) return;
    const section = document.createElement('section');
    section.className = 'agenda-content-section';

    const heading = document.createElement('header');
    heading.className = 'agenda-section-header';
    heading.innerHTML = `
      <div>
        <h2>${escapeHtml(title)}</h2>
        <span>${items.length} ${items.length === 1 ? 'resultado' : 'resultados'}</span>
      </div>
      <button type="button" class="agenda-section-action" data-content="${escapeHtml(contentValue)}">${escapeHtml(actionLabel)} →</button>
    `;

    const grid = document.createElement('div');
    grid.className = 'agenda-section-grid';
    const progressiveControl = createAgendaProgressiveControl(grid, items, contentValue);
    section.append(heading);
    if (contentValue === 'films') section.append(filmSourceNotice());
    section.append(grid);
    if (progressiveControl) section.append(progressiveControl);
    container.append(section);
  }

  function renderAgenda() {
    clearTimeout(state.timer);
    state.isPaused = true;
    document.body.classList.add('agenda-mode');
    document.body.classList.toggle('curation-mode', state.curationMode);
    document.body.classList.remove('panel-mode');
    const agendaColorScheme = applyAgendaColorScheme(storedAgendaColorScheme());

    normalizeAgendaFiltersForContent();

    const results = agendaVisibleContents();
    const activeFilters = state.mobileFavoritesOnly || state.mobileSharedSelection || state.mobileFocusedItem ? 0 : agendaActiveFilterCount();
    const header = document.createElement('header');
    header.className = 'agenda-header';
    const agendaContentTabs = [
      ['all', 'Todos'],
      ['events', 'Eventos'],
      ['books', 'Livros'],
      ['courses', 'Cursos'],
      ['contests', 'Concursos'],
      ['films', 'Filmes'],
      ['spaces', 'Espaços'],
      ['activities', 'Esporte e Lazer'],
      ['utility', 'Utilidade pública']
    ];
    const favoriteCount = loadAgendaFavorites().size;
    header.innerHTML = `
      ${state.curationMode ? `<div class="curation-mode-banner" role="status"><strong>Modo Curadoria</strong><span>Ambiente de seleção — este não é o Mural Cultural público oficial.</span></div>` : ''}
      <div class="agenda-heading">
        <a class="agenda-home-link" href="./" aria-label="Ir para a página inicial do Tem Sim, Uai" title="Voltar ao início">
          <img class="agenda-logo" src="imagens/marca/logo-mural-cultural.png" alt="Tem Sim, Uai">
        </a>
      </div>
      <nav class="agenda-content-nav" aria-label="Tipos de conteúdo">
        ${agendaContentTabs.map(([value, label]) => `
          <button
            type="button"
            class="agenda-content-tab${state.mobileContent === value ? ' is-active' : ''}"
            data-content="${escapeHtml(value)}"
            aria-pressed="${state.mobileContent === value ? 'true' : 'false'}"
          >${escapeHtml(label)}</button>
        `).join('')}
      </nav>
      <div class="agenda-header-actions">
        <button
          class="agenda-favorites-toggle${state.mobileFavoritesOnly ? ' is-active' : ''}"
          type="button"
          aria-pressed="${state.mobileFavoritesOnly ? 'true' : 'false'}"
          title="Meus favoritos"
        ><span aria-hidden="true">★</span><span class="agenda-favorites-label">Favoritos</span><span class="agenda-favorites-count" ${favoriteCount ? '' : 'hidden'}>${favoriteCount}</span></button>
        <button
          class="agenda-search-toggle"
          type="button"
          aria-label="${state.mobileFiltersOpen ? 'Fechar busca e filtros' : 'Abrir busca e filtros'}"
          aria-expanded="${state.mobileFiltersOpen ? 'true' : 'false'}"
          aria-controls="agenda-filter-panel"
          title="Buscar e filtrar"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="6"></circle>
            <path d="m16 16 4 4"></path>
          </svg>
          ${activeFilters ? `<span class="agenda-filter-badge" aria-label="${activeFilters} ${activeFilters === 1 ? 'filtro ativo' : 'filtros ativos'}">${activeFilters}</span>` : ''}
        </button>
        ${agendaThemeToggleMarkup()}
        <details class="agenda-more-menu">
          <summary class="agenda-more-toggle" title="Mais ações" aria-label="Mais ações">
            <span class="agenda-more-icon" aria-hidden="true">⋯</span>
            <span class="agenda-more-label">Mais</span>
          </summary>
          <div class="agenda-more-menu-list" role="group" aria-label="Mais ações">
            <button class="agenda-community-open agenda-more-menu-action" type="button" title="Contribuir com o Mural">
              <span class="agenda-more-action-icon" aria-hidden="true">＋</span><span>Contribua</span>
            </button>
            ${notificationsContent?.headerButtonMarkup?.() || ''}
            ${!state.curationMode ? '<button class="agenda-about-open agenda-more-menu-action" type="button" title="Sobre o projeto" aria-label="Sobre o projeto"><span class="agenda-more-action-icon" aria-hidden="true">ⓘ</span><span>Sobre o projeto</span></button>' : ''}
            ${state.mobileFavoritesOnly && favoriteCount ? '<button class="agenda-share-favorites agenda-more-menu-action" type="button" title="Compartilhar favoritos"><span class="agenda-more-action-icon" aria-hidden="true">↗</span><span>Compartilhar favoritos</span></button>' : ''}
            <button class="install-app-btn agenda-more-menu-action" type="button" hidden>
              <span class="agenda-more-action-icon" aria-hidden="true">⇩</span><span>Instalar app</span>
            </button>
            <div class="agenda-more-menu-separator" role="separator"></div>
            <button class="view-toggle agenda-more-menu-action" type="button" aria-label="Abrir exibição interativa">
              <span class="agenda-more-action-icon" aria-hidden="true">⌨</span><span>Exibição interativa</span>
            </button>
          </div>
        </details>
      </div>
    `;

    const controls = document.createElement('section');
    controls.className = `agenda-tools agenda-tools-${state.mobileContent}`;
    controls.id = 'agenda-filter-panel';
    controls.hidden = !state.mobileFiltersOpen;
    controls.setAttribute('aria-label', 'Pesquisar e filtrar conteúdos');

    const contestMode = state.mobileContent === 'contests';
    const filmMode = state.mobileContent === 'films';
    const utilityMode = state.mobileContent === 'utility';
    const activityMode = state.mobileContent === 'activities';
    const spaceMode = state.mobileContent === 'spaces';
    const courseMode = state.mobileContent === 'courses';
    const themeMode = ['events', 'books', 'courses', 'films', 'utility', 'spaces', 'activities'].includes(state.mobileContent);
    const searchPlaceholder = contestMode
      ? 'Órgão, cargo, cidade, formação…'
      : courseMode
        ? 'Título, instituição, área ou descrição…'
        : state.mobileContent === 'events'
          ? 'Título, local, instituição ou tema…'
        : state.mobileContent === 'books'
          ? 'Título, autor ou tema…'
          : filmMode
            ? 'Título, direção, sinopse, gênero ou tema…'
            : utilityMode
              ? 'Título, descrição, área, público ou tipo de recurso…'
              : activityMode
                ? 'Atividade, modalidade, local, cidade ou público…'
                : spaceMode
                  ? 'Espaço, cidade, tipo, vocação ou instituição…'
                  : 'Título, autor ou instituição…';
    const themeControl = themeMode ? `
      <label><span>Tema</span><select class="agenda-theme"><option value="">Todos os temas</option></select></label>
    ` : '';
    const commonControls = `
      <label class="agenda-search"><span>Pesquisar</span><input type="search" placeholder="${escapeHtml(searchPlaceholder)}" value="${escapeHtml(state.mobileQuery)}"></label>
      <label class="agenda-content-field"><span>Conteúdo</span><select class="agenda-content">
        <option value="all">Todos</option><option value="events">Eventos</option><option value="books">Livros</option><option value="courses">Cursos</option><option value="contests">Concursos</option><option value="films">Filmes</option>
        <option value="spaces">Espaços</option><option value="activities">Esporte e Lazer</option><option value="utility">Utilidade Pública</option>
      </select></label>
      <label><span>Curadoria</span><select class="agenda-curation"><option value="">Todas as curadorias</option></select></label>
      ${themeControl}
    `;

    const eventControls = state.mobileContent === 'events' ? `
      <label><span>Quando</span><select class="agenda-period">
        <option value="all">Todos os eventos futuros</option><option value="today">Hoje</option>
        <option value="tomorrow">Amanhã</option><option value="weekend">Este fim de semana</option>
        <option value="7days">Próximos 7 dias</option><option value="30days">Próximos 30 dias</option>
      </select></label>
      <label><span>Cidade</span><select class="agenda-city"><option value="">Todas as cidades</option></select></label>
      <label><span>Categoria / linguagem</span><select class="agenda-category"><option value="">Todas</option></select></label>
      <label><span>Espaço</span><select class="agenda-space"><option value="">Todos os espaços</option></select></label>
      <label><span>Instituição / programa</span><select class="agenda-institution"><option value="">Todas</option></select></label>
      <label><span>Inscrição</span><select class="agenda-registration">
        <option value="">Todas</option><option value="open">Inscrições abertas</option>
        <option value="none">Sem inscrição informada</option><option value="closed">Inscrições encerradas</option>
      </select></label>
    ` : '';

    const bookCoverControl = state.mobileContent === 'books' && state.curationMode ? `
      <label><span>Capa</span><select class="agenda-book-cover">
        <option value="">Todas</option><option value="with">Com capa</option><option value="without">Sem capa</option>
      </select></label>
      <p class="agenda-book-cover-warning"><strong>Atenção às capas automáticas:</strong> elas podem estar incorretas. Para selecionar uma obra, considere sempre o título e o autor como referência; eles prevalecem sobre a imagem. A capa poderá ser revisada no Editor antes da publicação.</p>
    ` : '';
    const bookControls = state.mobileContent === 'books' ? `
      <label><span>Acesso</span><select class="agenda-book-access">
        <option value="">Físico ou virtual</option><option value="physical">Acervo físico</option>
        <option value="virtual">Biblioteca virtual</option><option value="both">Físico e virtual</option>
      </select></label>
      <label><span>Acervo / biblioteca</span><select class="agenda-book-library"><option value="">Todos os acervos</option></select></label>
      <label><span>Ano inicial</span><input class="agenda-book-year-from" type="number" inputmode="numeric" min="1000" max="2100" placeholder="Todos"></label>
      <label><span>Ano final</span><input class="agenda-book-year-to" type="number" inputmode="numeric" min="1000" max="2100" placeholder="Todos"></label>
      <label><span>Audiolivro</span><select class="agenda-book-audiobook">
        <option value="">Todos</option><option value="with">Com audiolivro</option><option value="without">Sem audiolivro</option>
      </select></label>
      ${bookCoverControl}
    ` : '';

    const courseControls = courseMode ? `
      <label><span>Instituição</span><select class="agenda-course-institution"><option value="">Todas as instituições</option></select></label>
      <label><span>Área</span><select class="agenda-course-area"><option value="">Todas as áreas</option></select></label>
      <label><span>Carga horária</span><select class="agenda-course-workload">
        <option value="">Todas as cargas horárias</option>
        <option value="ate-10">Até 10 horas</option><option value="11-20">11 a 20 horas</option>
        <option value="21-40">21 a 40 horas</option><option value="mais-40">Mais de 40 horas</option>
        <option value="nao-informada">Não informada</option>
      </select></label>
      <label><span>Tipo</span><select class="agenda-course-type"><option value="">Todos os tipos</option></select></label>
      <label><span>Nível</span><select class="agenda-course-level"><option value="">Todos os níveis</option></select></label>
      <label><span>Idioma</span><select class="agenda-course-language"><option value="">Todos os idiomas</option></select></label>
      <label><span>Certificado</span><select class="agenda-course-certificate">
        <option value="">Todos</option><option value="yes">Com certificado informado</option>
        <option value="no">Sem certificado</option><option value="unknown">Não informado</option>
      </select></label>
    ` : '';

    const contestControls = contestMode ? `
      <label><span>Formação</span><select class="agenda-contest-formation"><option value="">Todas as formações</option></select></label>
      <label><span>UF</span><select class="agenda-contest-uf"><option value="">Todos os estados</option></select></label>
      <label><span>Cidade</span><select class="agenda-contest-city"><option value="">Todas as cidades</option></select></label>
      <label><span>Prazo</span><select class="agenda-contest-deadline">
        <option value="">Todos os prazos</option><option value="com-data">Com data de inscrição</option>
        <option value="sem-data">Sem data informada</option>
      </select></label>
      <label><span>Situação</span><select class="agenda-contest-state">
        <option value="">Ativos</option><option value="aberto">Inscrições abertas</option>
        <option value="futuro">Inscrições futuras</option><option value="prazo_desconhecido">Prazo a confirmar</option>
        <option value="encerrado">Encerrados</option><option value="todos">Todos, inclusive encerrados</option>
      </select></label>
      <label><span>Maior remuneração</span><select class="agenda-contest-remuneration">
        <option value="">Todas as faixas</option><option value="ate-3000">Até R$ 3 mil</option>
        <option value="3000-5000">Mais de R$ 3 mil até R$ 5 mil</option>
        <option value="5000-10000">Mais de R$ 5 mil até R$ 10 mil</option>
        <option value="mais-10000">Mais de R$ 10 mil</option><option value="nao-informada">Não informada</option>
      </select></label>
    ` : '';

    const filmControls = filmMode ? `
      <label><span>Gênero</span><select class="agenda-film-genre"><option value="">Todos os gêneros</option></select></label>
      <label><span>Plataforma</span><select class="agenda-film-platform"><option value="">Todas as plataformas</option></select></label>
      <label><span>Letra</span><select class="agenda-film-letter"><option value="">Todas as letras</option></select></label>
      <label><span>Acessibilidade</span><select class="agenda-film-accessibility"><option value="">Todos os recursos</option></select></label>
      <label><span>País de origem</span><select class="agenda-film-country"><option value="">Todos os países</option></select></label>
      <label><span>Coleção</span><select class="agenda-film-collection"><option value="">Todas as coleções</option></select></label>
      <label><span>Classificação</span><select class="agenda-film-rating">
        <option value="">Todas as classificações</option><option value="Livre">Livre</option><option value="10">10</option><option value="12">12</option><option value="14">14</option><option value="16">16</option><option value="18">18</option><option value="Não informada">Não informada</option>
      </select></label>
      <label><span>Ano inicial</span><input class="agenda-film-year-from" type="number" inputmode="numeric" min="1900" max="2100" placeholder="Todos"></label>
      <label><span>Ano final</span><input class="agenda-film-year-to" type="number" inputmode="numeric" min="1900" max="2100" placeholder="Todos"></label>
      <label><span>Duração</span><select class="agenda-film-duration">
        <option value="">Todas as durações</option><option value="ate-30">Até 30 min</option><option value="31-60">31 a 60 min</option><option value="mais-60">Mais de 60 min</option><option value="nao-informada">Não informada</option>
      </select></label>
      <label><span>Ordenar</span><select class="agenda-film-sort">
        <option value="title-asc">Título de A a Z</option><option value="year-desc">Mais recentes</option><option value="year-asc">Mais antigos</option><option value="duration-asc">Menor duração</option><option value="duration-desc">Maior duração</option>
      </select></label>
    ` : '';

    const utilityControls = utilityMode ? `
      <label><span>Área de Utilidade Pública</span><select class="agenda-utility-area"><option value="">Todas as áreas</option></select></label>
      <label><span>Tipo de recurso</span><select class="agenda-utility-type"><option value="">Todos os tipos</option></select></label>
      <label><span>Natureza</span><select class="agenda-utility-nature"><option value="">Todas</option></select></label>
      <label><span>Abrangência</span><select class="agenda-utility-scope"><option value="">Todas as abrangências</option></select></label>
      <label><span>Público-alvo</span><select class="agenda-utility-audience"><option value="">Todos os públicos</option></select></label>
    ` : '';
    const activityControls = activityMode ? `
      <label><span>Cidade</span><select class="agenda-activity-city"><option value="">Todas as cidades</option></select></label>
      <label><span>Categoria</span><select class="agenda-activity-category"><option value="">Todas as categorias</option></select></label>
      <label><span>Modalidade</span><select class="agenda-activity-modality"><option value="">Todas as modalidades</option></select></label>
      <label><span>Dia da semana</span><select class="agenda-activity-day"><option value="">Todos os dias</option></select></label>
      <label><span>Participação</span><select class="agenda-activity-participation"><option value="">Todas as formas</option></select></label>
      <label><span>Público-alvo</span><select class="agenda-activity-audience"><option value="">Todos os públicos</option></select></label>
      <label><span>Formato</span><select class="agenda-activity-format"><option value="">Todos os formatos</option></select></label>
    ` : '';
    const spaceControls = spaceMode ? `
      <label><span>Cidade</span><select class="agenda-space-city"><option value="">Todas as cidades</option></select></label>
      <label><span>Vocação / uso</span><select class="agenda-space-vocation"><option value="">Todas as vocações</option></select></label>
      <label><span>Tipo de espaço</span><select class="agenda-space-nature"><option value="">Todos os tipos</option></select></label>
      <label><span>Instituição</span><select class="agenda-space-institution"><option value="">Todas as instituições</option></select></label>
      <label><span>Abre em</span><select class="agenda-space-open-day"><option value="">Qualquer dia</option></select></label>
    ` : '';

    controls.innerHTML = commonControls + eventControls + bookControls + courseControls + contestControls + filmControls + utilityControls + spaceControls + activityControls;

    controls.querySelector('.agenda-content').value = state.mobileContent;
    if (utilityMode) {
      populateDynamicSelect(controls.querySelector('.agenda-utility-area'), 'Todas as áreas', agendaUtilityOptions('areas_utilidade'), state.mobileUtilityArea);
      populateDynamicSelect(controls.querySelector('.agenda-utility-type'), 'Todos os tipos', agendaUtilityOptions('tipos_recurso'), state.mobileUtilityType);
      populateDynamicSelect(controls.querySelector('.agenda-utility-nature'), 'Todas', utilityNatureOptions(), state.mobileUtilityNature);
      populateDynamicSelect(controls.querySelector('.agenda-utility-scope'), 'Todas as abrangências', utilityScopeOptions(), state.mobileUtilityScope);
      populateDynamicSelect(controls.querySelector('.agenda-utility-audience'), 'Todos os públicos', agendaUtilityOptions('publicos_alvo'), state.mobileUtilityAudience);
    }
    if (spaceMode) {
      populateDynamicSelect(controls.querySelector('.agenda-space-city'), 'Todas as cidades', spacesContent.cityOptions(state.allSpaces, normalizeText), state.mobileSpaceCity);
      populateDynamicSelect(controls.querySelector('.agenda-space-vocation'), 'Todas as vocações', spacesContent.vocationOptions(state.allSpaces, normalizeText), state.mobileSpaceVocation);
      populateDynamicSelect(controls.querySelector('.agenda-space-nature'), 'Todos os tipos', spacesContent.natureOptions(state.allSpaces, normalizeText), state.mobileSpaceNature);
      populateDynamicSelect(controls.querySelector('.agenda-space-institution'), 'Todas as instituições', spacesContent.institutionOptions(state.allSpaces, normalizeText), state.mobileSpaceInstitution);
      populateDynamicSelect(controls.querySelector('.agenda-space-open-day'), 'Qualquer dia', spacesContent.openDayOptions(state.allSpaces), state.mobileSpaceOpenDay);
    }
    if (activityMode) {
      populateDynamicSelect(controls.querySelector('.agenda-activity-city'), 'Todas as cidades', activitiesContent.cityOptions(state.allActivities, normalizeText), state.mobileActivityCity);
      populateDynamicSelect(controls.querySelector('.agenda-activity-category'), 'Todas as categorias', activitiesContent.categoryOptions(state.allActivities), state.mobileActivityCategory);
      populateDynamicSelect(controls.querySelector('.agenda-activity-modality'), 'Todas as modalidades', activitiesContent.modalityOptions(state.allActivities, normalizeText), state.mobileActivityModality);
      populateDynamicSelect(controls.querySelector('.agenda-activity-day'), 'Todos os dias', activitiesContent.dayOptions(state.allActivities), state.mobileActivityDay);
      populateDynamicSelect(controls.querySelector('.agenda-activity-participation'), 'Todas as formas', activitiesContent.participationOptions(state.allActivities), state.mobileActivityParticipation);
      populateDynamicSelect(controls.querySelector('.agenda-activity-audience'), 'Todos os públicos', activitiesContent.audienceOptions(state.allActivities, normalizeText), state.mobileActivityAudience);
      populateDynamicSelect(controls.querySelector('.agenda-activity-format'), 'Todos os formatos', activitiesContent.formatOptions(state.allActivities), state.mobileActivityFormat);
    }
    populateDynamicSelect(
      controls.querySelector('.agenda-curation'),
      'Todas as curadorias',
      agendaCurationEntries().map(curation => [curation.id, curation.name]),
      state.mobileCuration
    );
    populateDynamicSelect(
      controls.querySelector('.agenda-theme'),
      'Todos os temas',
      agendaThemeOptions(state.mobileContent),
      state.mobileTheme
    );

    if (state.mobileContent === 'events') {
      populateDynamicSelect(controls.querySelector('.agenda-city'), 'Todas as cidades', mobileSelectOptions(state.allEvents, 'cidade'), state.mobileCity);
      populateDynamicSelect(controls.querySelector('.agenda-category'), 'Todas as categorias e linguagens', agendaCategoryOptions(), state.mobileCategory);
      populateDynamicSelect(
        controls.querySelector('.agenda-space'),
        'Todos os espaços',
        mobileSelectOptions(state.allEvents.map(event => ({ unidade: eventUnit(event) })), 'unidade'),
        state.mobileSpace
      );
      populateDynamicSelect(
        controls.querySelector('.agenda-institution'),
        'Todas as instituições e programas',
        mobileSelectOptions(state.allEvents.map(event => ({ programa: eventProgram(event) })), 'programa'),
        state.mobileInstitution
      );
      controls.querySelector('.agenda-period').value = state.mobilePeriod;
      controls.querySelector('.agenda-registration').value = state.mobileRegistration;
    } else if (state.mobileContent === 'books') {
      controls.querySelector('.agenda-book-access').value = state.mobileBookAccess;
      populateDynamicSelect(controls.querySelector('.agenda-book-library'), 'Todos os acervos', agendaBookLibraryOptions(), state.mobileBookLibrary);
      controls.querySelector('.agenda-book-year-from').value = state.mobileBookYearFrom;
      controls.querySelector('.agenda-book-year-to').value = state.mobileBookYearTo;
      controls.querySelector('.agenda-book-audiobook').value = state.mobileBookAudiobook;
      const bookCover = controls.querySelector('.agenda-book-cover');
      if (bookCover) bookCover.value = state.mobileBookCover;
    } else if (courseMode) {
      populateDynamicSelect(controls.querySelector('.agenda-course-institution'), 'Todas as instituições', coursesContent.scalarOptions(state.allCourses, 'instituicao'), state.mobileCourseInstitution);
      populateDynamicSelect(controls.querySelector('.agenda-course-area'), 'Todas as áreas', coursesContent.scalarOptions(state.allCourses, 'area'), state.mobileCourseArea);
      populateDynamicSelect(controls.querySelector('.agenda-course-type'), 'Todos os tipos', coursesContent.scalarOptions(state.allCourses, 'tipo'), state.mobileCourseType);
      populateDynamicSelect(controls.querySelector('.agenda-course-level'), 'Todos os níveis', coursesContent.scalarOptions(state.allCourses, 'nivel'), state.mobileCourseLevel);
      populateDynamicSelect(controls.querySelector('.agenda-course-language'), 'Todos os idiomas', coursesContent.scalarOptions(state.allCourses, 'idioma'), state.mobileCourseLanguage);
      controls.querySelector('.agenda-course-workload').value = state.mobileCourseWorkload;
      controls.querySelector('.agenda-course-certificate').value = state.mobileCourseCertificate;
    } else if (contestMode) {
      populateDynamicSelect(
        controls.querySelector('.agenda-contest-formation'),
        'Todas as formações',
        contestsContent.formationOptions(state.allContests),
        state.mobileContestFormation
      );
      populateDynamicSelect(
        controls.querySelector('.agenda-contest-uf'),
        'Todos os estados',
        contestsContent.ufOptions(state.allContests),
        state.mobileContestUf
      );
      populateDynamicSelect(
        controls.querySelector('.agenda-contest-city'),
        'Todas as cidades',
        contestsContent.cityOptions(state.allContests),
        state.mobileContestCity
      );
      controls.querySelector('.agenda-contest-deadline').value = state.mobileContestDeadline;
      controls.querySelector('.agenda-contest-state').value = state.mobileContestState;
      controls.querySelector('.agenda-contest-remuneration').value = state.mobileContestRemuneration;
    } else if (filmMode) {
      populateDynamicSelect(
        controls.querySelector('.agenda-film-genre'),
        'Todos os gêneros',
        filmsContent.options(state.allFilms, 'generos').map(value => [value, value]),
        state.mobileFilmGenre
      );
      populateDynamicSelect(
        controls.querySelector('.agenda-film-platform'),
        'Todas as plataformas',
        filmsContent.platformOptions(state.allFilms).map(value => [value, value]),
        state.mobileFilmPlatform
      );
      populateDynamicSelect(
        controls.querySelector('.agenda-film-letter'),
        'Todas as letras',
        filmsContent.options(state.allFilms, 'letras').map(value => [value, value]),
        state.mobileFilmLetter
      );
      populateDynamicSelect(
        controls.querySelector('.agenda-film-accessibility'),
        'Todos os recursos',
        filmsContent.options(state.allFilms, 'acessibilidade').map(value => [value, value]),
        state.mobileFilmAccessibility
      );
      populateDynamicSelect(
        controls.querySelector('.agenda-film-country'),
        'Todos os países',
        mobileSelectOptions(state.allFilms, 'pais_origem'),
        state.mobileFilmCountry
      );
      populateDynamicSelect(
        controls.querySelector('.agenda-film-collection'),
        'Todas as coleções',
        filmsContent.options(state.allFilms, 'colecoes').map(value => [value, value]),
        state.mobileFilmCollection
      );
      controls.querySelector('.agenda-film-rating').value = state.mobileFilmRating;
      controls.querySelector('.agenda-film-year-from').value = state.mobileFilmYearFrom;
      controls.querySelector('.agenda-film-year-to').value = state.mobileFilmYearTo;
      controls.querySelector('.agenda-film-duration').value = state.mobileFilmDuration;
      controls.querySelector('.agenda-film-sort').value = state.mobileFilmSort;
    }

    const count = document.createElement('div');
    count.className = 'agenda-count';
    count.setAttribute('role', 'status');
    count.setAttribute('aria-live', 'polite');
    count.innerHTML = state.mobileFocusedItem ? `
      <span><strong>${results.total}</strong> ${results.total === 1 ? 'conteúdo aberto pelo QR Code' : 'conteúdos abertos pelo QR Code'}</span>
      <button type="button" class="agenda-focused-exit">Explorar todos os conteúdos</button>
    ` : state.mobileSharedSelection ? `
      <span><strong>${results.total}</strong> ${results.total === 1 ? 'conteúdo nesta seleção compartilhada' : 'conteúdos nesta seleção compartilhada'}</span>
      <button type="button" class="agenda-save-shared">Salvar nos meus favoritos</button>
      <button type="button" class="agenda-send-curation">Enviar para curadoria</button>
    ` : state.mobileFavoritesOnly ? `
      <span><strong>${results.total}</strong> ${results.total === 1 ? 'favorito salvo neste dispositivo' : 'favoritos salvos neste dispositivo'}</span>
    ` : contestMode ? `
      <span><strong>${results.total}</strong> de ${state.allContests.length} oportunidades compatíveis com as formações acompanhadas.${activeFilters ? ` · ${activeFilters} ${activeFilters === 1 ? 'filtro ativo' : 'filtros ativos'}` : ''}</span>
      ${activeFilters ? '<button type="button" class="agenda-clear-filters">Limpar filtros</button>' : ''}
    ` : `
      <span><strong>${results.total}</strong> ${results.total === 1 ? 'conteúdo encontrado' : 'conteúdos encontrados'}${activeFilters ? ` · ${activeFilters} ${activeFilters === 1 ? 'filtro ativo' : 'filtros ativos'}` : ''}</span>
      ${activeFilters ? '<button type="button" class="agenda-clear-filters">Limpar filtros</button>' : ''}
    `;

    const resultsContainer = document.createElement('div');
    resultsContainer.className = 'agenda-results';
    resultsContainer.setAttribute('aria-label', 'Conteúdos culturais');

    if (!results.total) {
      resultsContainer.innerHTML = state.mobileFocusedItem
        ? '<div class="agenda-empty"><h2>Conteúdo não encontrado</h2><p>Este item pode ter sido atualizado ou removido do Mural.</p><button type="button" class="agenda-focused-exit">Explorar todos os conteúdos</button></div>'
        : state.mobileFavoritesOnly
          ? '<div class="agenda-empty"><h2>Nenhum favorito ainda</h2><p>Use a estrela nos conteúdos que quiser guardar neste dispositivo.</p><button type="button" class="agenda-empty-favorites-back">Explorar conteúdos</button></div>'
          : '<div class="agenda-empty"><h2>Nenhum conteúdo encontrado</h2><p>Tente alterar a busca ou os filtros.</p><button type="button" class="agenda-empty-clear">Limpar filtros</button></div>';
    } else if (state.mobileFavoritesOnly || state.mobileSharedSelection || state.mobileContent === 'all') {
      const eventsGrid = document.createElement('div');
      eventsGrid.className = 'agenda-section-grid';
      const eventsProgressiveControl = createAgendaProgressiveControl(eventsGrid, results.events, 'events');
      resultsContainer.append(eventsGrid);
      if (eventsProgressiveControl) resultsContainer.append(eventsProgressiveControl);
      appendAgendaSection(resultsContainer, 'Espaços', results.spaces, 'spaces', 'Ver somente espaços');
      appendAgendaSection(resultsContainer, 'Esporte e Lazer', results.activities, 'activities', 'Ver somente esporte e lazer');
      appendAgendaSection(resultsContainer, 'Utilidade Pública', results.utility, 'utility', 'Ver somente utilidade pública');
      appendAgendaSection(resultsContainer, 'Sugestões de Leitura', results.books, 'books', 'Ver somente livros');
      appendAgendaSection(resultsContainer, 'Cursos Online Gratuitos', results.courses, 'courses', 'Ver somente cursos');
      appendAgendaSection(resultsContainer, 'Concursos públicos', results.contests, 'contests', 'Ver somente concursos');
      appendAgendaSection(resultsContainer, 'Filmes gratuitos', results.films, 'films', 'Ver somente filmes');
    } else {
      const list = document.createElement('section');
      list.className = 'agenda-list';
      const items = state.mobileContent === 'events'
        ? results.events
        : state.mobileContent === 'books'
          ? results.books
          : state.mobileContent === 'contests'
            ? results.contests
            : state.mobileContent === 'films'
              ? results.films
              : state.mobileContent === 'utility'
                ? results.utility
                : state.mobileContent === 'spaces'
                  ? results.spaces
                  : state.mobileContent === 'activities'
                    ? results.activities
                    : results.courses;
      const renderItem = state.mobileContent === 'events' && !agendaHasSpecificEventFilters()
        ? item => renderAgendaCard(item, { exclusiveUnfilteredEvent: true })
        : renderAgendaCard;
      const progressiveControl = createAgendaProgressiveControl(
        list,
        items,
        state.mobileContent,
        renderItem
      );
      resultsContainer.append(list);
      if (progressiveControl) resultsContainer.append(progressiveControl);
    }

    const footer = document.createElement('footer');
    footer.className = 'agenda-footer';
    footer.innerHTML = `
      <div class="agenda-footer-identity">
        <div class="agenda-footer-brand">Tem Sim, Uai</div>
        ${!state.curationMode ? '<button type="button" class="agenda-about-footer">Sobre o projeto</button>' : ''}
      </div>
      <p>Atualizado em ${escapeHtml(formatUpdated(state.data?.atualizado_em).replace(/^Atualizado em\s*/i, ''))}</p>
    `;

    const shell = document.createElement('div');
    shell.className = 'agenda-shell';
    shell.append(header);
    shell.append(controls, count);
    if (filmMode) shell.append(filmSourceNotice());
    shell.append(resultsContainer, footer);
    app.replaceChildren(shell);

    header.querySelector('.agenda-favorites-toggle').addEventListener('click', () => {
      exitFocusedAgendaItem();
      exitSharedAgendaSelection();
      state.mobileFavoritesOnly = !state.mobileFavoritesOnly;
      if (state.mobileFavoritesOnly) {
        state.mobileContent = 'all';
        state.mobileFiltersOpen = false;
      }
      resetAgendaBatches();
      renderAgenda();
    });

    const closeAgendaMoreMenu = () => header.querySelector('.agenda-more-menu')?.removeAttribute('open');
    header.querySelector('.agenda-share-favorites')?.addEventListener('click', () => {
      closeAgendaMoreMenu();
      openAgendaShareHub();
    });
    notificationsContent?.bindAgendaHeader?.(header);
    header.querySelector('.agenda-notifications-button')?.addEventListener('click', closeAgendaMoreMenu);
    header.querySelector('.agenda-community-open')?.addEventListener('click', () => {
      closeAgendaMoreMenu();
      openCommunityContributionHub();
    });
    header.querySelector('.agenda-about-open')?.addEventListener('click', () => {
      closeAgendaMoreMenu();
      openAboutProjectDialog();
    });
    footer.querySelector('.agenda-about-footer')?.addEventListener('click', openAboutProjectDialog);
    count.querySelector('.agenda-send-curation')?.addEventListener('click', openCurationSuggestionDialog);
    count.querySelector('.agenda-save-shared')?.addEventListener('click', () => {
      const current = loadAgendaFavorites();
      for (const id of state.mobileSharedSelection || []) current.add(id);
      saveAgendaFavorites(current);
      exitSharedAgendaSelection();
      state.mobileFavoritesOnly = true;
      renderAgenda();
    });

    const installButton = header.querySelector('.install-app-btn');
    installButton.addEventListener('click', () => {
      closeAgendaMoreMenu();
      installApp();
    });
    refreshInstallButtons();

    const searchToggle = header.querySelector('.agenda-search-toggle');
    searchToggle.addEventListener('click', () => {
      closeAgendaMoreMenu();
      state.mobileFiltersOpen = !state.mobileFiltersOpen;
      controls.hidden = !state.mobileFiltersOpen;
      searchToggle.setAttribute('aria-expanded', state.mobileFiltersOpen ? 'true' : 'false');
      searchToggle.setAttribute('aria-label', state.mobileFiltersOpen ? 'Fechar busca e filtros' : 'Abrir busca e filtros');
      if (state.mobileFiltersOpen) {
        requestAnimationFrame(() => controls.querySelector('.agenda-search input')?.focus());
      }
    });

    const themeToggle = header.querySelector('.agenda-theme-toggle');
    themeToggle.addEventListener('click', () => {
      closeAgendaMoreMenu();
      const next = document.body.classList.contains('agenda-theme-light') ? 'dark' : 'light';
      const applied = saveAgendaColorScheme(next);
      const isLight = applied === 'light';
      themeToggle.setAttribute('aria-pressed', isLight ? 'true' : 'false');
      themeToggle.setAttribute('aria-label', isLight ? 'Usar tema escuro na Agenda' : 'Usar tema claro na Agenda');
      themeToggle.title = isLight ? 'Tema escuro' : 'Tema claro';
    });

    header.querySelectorAll('.agenda-content-tab').forEach(button => {
      button.addEventListener('click', () => {
        const nextContent = button.dataset.content || 'all';
        if (nextContent === state.mobileContent && !state.mobileFavoritesOnly && !state.mobileFocusedItem) return;
        exitFocusedAgendaItem();
        state.mobileFavoritesOnly = false;
        exitSharedAgendaSelection();
        normalizeAgendaFiltersForContent(nextContent);
        resetAgendaBatches();
        renderAgenda();
      });
    });

    header.querySelector('.view-toggle').addEventListener('click', () => {
      closeAgendaMoreMenu();
      exitSharedAgendaSelection();
      resetAgendaBatches();
      saveViewMode('painel');
      state.isPaused = false;
      renderCurrentView();
    });

    const rerender = () => {
      resetAgendaBatches();
      renderAgenda();
    };

    controls.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      state.mobileFiltersOpen = false;
      controls.hidden = true;
      searchToggle.setAttribute('aria-expanded', 'false');
      searchToggle.setAttribute('aria-label', 'Abrir busca e filtros');
      searchToggle.focus();
    });
    controls.querySelector('.agenda-search input').addEventListener('input', event => {
      if (state.mobileFocusedItem) exitFocusedAgendaItem();
      state.mobileQuery = event.target.value;
      window.clearTimeout(state.mobileSearchTimer);
      state.mobileSearchTimer = window.setTimeout(rerender, 180);
    });
    controls.querySelector('.agenda-content').addEventListener('change', event => {
      exitSharedAgendaSelection();
      normalizeAgendaFiltersForContent(event.target.value);
      rerender();
    });
    controls.querySelector('.agenda-curation').addEventListener('change', event => { state.mobileCuration = event.target.value; rerender(); });
    controls.querySelector('.agenda-theme')?.addEventListener('change', event => { state.mobileTheme = event.target.value; rerender(); });

    controls.querySelector('.agenda-utility-area')?.addEventListener('change', event => { state.mobileUtilityArea = event.target.value; rerender(); });
    controls.querySelector('.agenda-utility-type')?.addEventListener('change', event => { state.mobileUtilityType = event.target.value; rerender(); });
    controls.querySelector('.agenda-utility-nature')?.addEventListener('change', event => { state.mobileUtilityNature = event.target.value; rerender(); });
    controls.querySelector('.agenda-utility-scope')?.addEventListener('change', event => { state.mobileUtilityScope = event.target.value; rerender(); });
    controls.querySelector('.agenda-utility-audience')?.addEventListener('change', event => { state.mobileUtilityAudience = event.target.value; rerender(); });

    controls.querySelector('.agenda-space-city')?.addEventListener('change', event => { state.mobileSpaceCity = event.target.value; rerender(); });
    controls.querySelector('.agenda-space-vocation')?.addEventListener('change', event => { state.mobileSpaceVocation = event.target.value; rerender(); });
    controls.querySelector('.agenda-space-nature')?.addEventListener('change', event => { state.mobileSpaceNature = event.target.value; rerender(); });
    controls.querySelector('.agenda-space-institution')?.addEventListener('change', event => { state.mobileSpaceInstitution = event.target.value; rerender(); });
    controls.querySelector('.agenda-space-open-day')?.addEventListener('change', event => { state.mobileSpaceOpenDay = event.target.value; rerender(); });

    controls.querySelector('.agenda-activity-city')?.addEventListener('change', event => { state.mobileActivityCity = event.target.value; rerender(); });
    controls.querySelector('.agenda-activity-category')?.addEventListener('change', event => { state.mobileActivityCategory = event.target.value; rerender(); });
    controls.querySelector('.agenda-activity-modality')?.addEventListener('change', event => { state.mobileActivityModality = event.target.value; rerender(); });
    controls.querySelector('.agenda-activity-day')?.addEventListener('change', event => { state.mobileActivityDay = event.target.value; rerender(); });
    controls.querySelector('.agenda-activity-participation')?.addEventListener('change', event => { state.mobileActivityParticipation = event.target.value; rerender(); });
    controls.querySelector('.agenda-activity-audience')?.addEventListener('change', event => { state.mobileActivityAudience = event.target.value; rerender(); });
    controls.querySelector('.agenda-activity-format')?.addEventListener('change', event => { state.mobileActivityFormat = event.target.value; rerender(); });

    if (state.mobileContent === 'events') {
      controls.querySelector('.agenda-period').addEventListener('change', event => { state.mobilePeriod = event.target.value; rerender(); });
      controls.querySelector('.agenda-category').addEventListener('change', event => { state.mobileCategory = event.target.value; rerender(); });
      controls.querySelector('.agenda-city').addEventListener('change', event => { state.mobileCity = event.target.value; rerender(); });
      controls.querySelector('.agenda-space').addEventListener('change', event => { state.mobileSpace = event.target.value; rerender(); });
      controls.querySelector('.agenda-institution').addEventListener('change', event => { state.mobileInstitution = event.target.value; rerender(); });
      controls.querySelector('.agenda-registration').addEventListener('change', event => { state.mobileRegistration = event.target.value; rerender(); });
    } else if (state.mobileContent === 'books') {
      controls.querySelector('.agenda-book-access').addEventListener('change', event => { state.mobileBookAccess = event.target.value; rerender(); });
      controls.querySelector('.agenda-book-library').addEventListener('change', event => { state.mobileBookLibrary = event.target.value; rerender(); });
      controls.querySelector('.agenda-book-audiobook').addEventListener('change', event => { state.mobileBookAudiobook = event.target.value; rerender(); });
      controls.querySelector('.agenda-book-cover')?.addEventListener('change', event => { state.mobileBookCover = event.target.value; rerender(); });
      controls.querySelector('.agenda-book-year-from').addEventListener('input', event => {
        state.mobileBookYearFrom = event.target.value;
        window.clearTimeout(state.mobileSearchTimer);
        state.mobileSearchTimer = window.setTimeout(rerender, 250);
      });
      controls.querySelector('.agenda-book-year-to').addEventListener('input', event => {
        state.mobileBookYearTo = event.target.value;
        window.clearTimeout(state.mobileSearchTimer);
        state.mobileSearchTimer = window.setTimeout(rerender, 250);
      });
    } else if (courseMode) {
      controls.querySelector('.agenda-course-institution').addEventListener('change', event => { state.mobileCourseInstitution = event.target.value; rerender(); });
      controls.querySelector('.agenda-course-area').addEventListener('change', event => { state.mobileCourseArea = event.target.value; rerender(); });
      controls.querySelector('.agenda-course-workload').addEventListener('change', event => { state.mobileCourseWorkload = event.target.value; rerender(); });
      controls.querySelector('.agenda-course-type').addEventListener('change', event => { state.mobileCourseType = event.target.value; rerender(); });
      controls.querySelector('.agenda-course-level').addEventListener('change', event => { state.mobileCourseLevel = event.target.value; rerender(); });
      controls.querySelector('.agenda-course-language').addEventListener('change', event => { state.mobileCourseLanguage = event.target.value; rerender(); });
      controls.querySelector('.agenda-course-certificate').addEventListener('change', event => { state.mobileCourseCertificate = event.target.value; rerender(); });
    } else if (contestMode) {
      controls.querySelector('.agenda-contest-formation').addEventListener('change', event => { state.mobileContestFormation = event.target.value; rerender(); });
      controls.querySelector('.agenda-contest-uf').addEventListener('change', event => { state.mobileContestUf = event.target.value; rerender(); });
      controls.querySelector('.agenda-contest-city').addEventListener('change', event => { state.mobileContestCity = event.target.value; rerender(); });
      controls.querySelector('.agenda-contest-deadline').addEventListener('change', event => { state.mobileContestDeadline = event.target.value; rerender(); });
      controls.querySelector('.agenda-contest-state').addEventListener('change', event => { state.mobileContestState = event.target.value; rerender(); });
      controls.querySelector('.agenda-contest-remuneration').addEventListener('change', event => { state.mobileContestRemuneration = event.target.value; rerender(); });
    } else if (filmMode) {
      controls.querySelector('.agenda-film-genre').addEventListener('change', event => { state.mobileFilmGenre = event.target.value; rerender(); });
      controls.querySelector('.agenda-film-platform').addEventListener('change', event => { state.mobileFilmPlatform = event.target.value; rerender(); });
      controls.querySelector('.agenda-film-letter').addEventListener('change', event => { state.mobileFilmLetter = event.target.value; rerender(); });
      controls.querySelector('.agenda-film-accessibility').addEventListener('change', event => { state.mobileFilmAccessibility = event.target.value; rerender(); });
      controls.querySelector('.agenda-film-country').addEventListener('change', event => { state.mobileFilmCountry = event.target.value; rerender(); });
      controls.querySelector('.agenda-film-collection').addEventListener('change', event => { state.mobileFilmCollection = event.target.value; rerender(); });
      controls.querySelector('.agenda-film-rating').addEventListener('change', event => { state.mobileFilmRating = event.target.value; rerender(); });
      controls.querySelector('.agenda-film-year-from').addEventListener('input', event => {
        state.mobileFilmYearFrom = event.target.value;
        window.clearTimeout(state.mobileSearchTimer);
        state.mobileSearchTimer = window.setTimeout(rerender, 250);
      });
      controls.querySelector('.agenda-film-year-to').addEventListener('input', event => {
        state.mobileFilmYearTo = event.target.value;
        window.clearTimeout(state.mobileSearchTimer);
        state.mobileSearchTimer = window.setTimeout(rerender, 250);
      });
      controls.querySelector('.agenda-film-duration').addEventListener('change', event => { state.mobileFilmDuration = event.target.value; rerender(); });
      controls.querySelector('.agenda-film-sort').addEventListener('change', event => { state.mobileFilmSort = event.target.value; rerender(); });
    }

    count.querySelector('.agenda-focused-exit')?.addEventListener('click', () => {
      exitFocusedAgendaItem();
      state.mobileContent = 'all';
      resetAgendaBatches();
      renderAgenda();
    });
    resultsContainer.querySelector('.agenda-focused-exit')?.addEventListener('click', () => {
      exitFocusedAgendaItem();
      state.mobileContent = 'all';
      resetAgendaBatches();
      renderAgenda();
    });

    count.querySelector('.agenda-clear-filters')?.addEventListener('click', () => {
      if (contestMode) clearContestAgendaFilters();
      else if (filmMode) clearFilmAgendaFilters();
      else clearAgendaFilters();
      rerender();
    });
    resultsContainer.querySelector('.agenda-empty-favorites-back')?.addEventListener('click', () => {
      state.mobileFavoritesOnly = false;
      renderAgenda();
    });
    resultsContainer.querySelector('.agenda-empty-clear')?.addEventListener('click', () => {
      if (contestMode) clearContestAgendaFilters();
      else if (filmMode) clearFilmAgendaFilters();
      else clearAgendaFilters();
      rerender();
    });

    resultsContainer.querySelectorAll('.agenda-section-action').forEach(button => {
      button.addEventListener('click', () => {
        normalizeAgendaFiltersForContent(button.dataset.content || 'all');
        rerender();
      });
    });
  }

  function addPanelViewToggle() {
    const controls = app.querySelector('.controls');
    if (!controls || controls.querySelector('.view-mode-btn')) return;
    const button = document.createElement('button');
    button.className = 'control-btn view-mode-btn';
    button.type = 'button';
    button.title = 'Explorar conteúdos';
    button.setAttribute('aria-label', 'Explorar conteúdos');
    button.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <circle cx="11" cy="11" r="6"></circle>
        <path d="m16 16 4 4"></path>
      </svg>
    `;
    button.addEventListener('click', () => {
      exitSharedAgendaSelection();
      resetAgendaBatches();
      saveViewMode('agenda');
      renderCurrentView();
    });
    controls.prepend(button);
  }

  function renderCurrentView() {
    if (effectiveViewMode() === 'agenda') {
      renderAgenda();
      return;
    }
    document.body.classList.remove('agenda-mode', 'agenda-theme-light', 'agenda-theme-dark');
    document.body.classList.add('panel-mode');
    document.body.style.colorScheme = 'dark';
    state.isPaused = false;
    renderSlide(Math.min(state.index, Math.max(0, state.events.length - 1)));
    addPanelViewToggle();
  }

  async function loadOptionalJson(url, fallback) {
    try {
      const response = await fetch(`${url}?v=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) return fallback;
      return await response.json();
    } catch (error) {
      console.warn(`Conteúdo opcional indisponível: ${url}`, error);
      return fallback;
    }
  }

  async function publicationCourseHash() {
    try {
      const response = await fetch(`${PUBLICATION_MANIFEST_URL}?v=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) return '';
      const manifest = await response.json();
      return String(manifest?.hashes?.['cursos.json'] || '').trim();
    } catch {
      return '';
    }
  }

  function startLivePublicationWatch() {
    if (state.publicationWatchTimer) clearInterval(state.publicationWatchTimer);

    const check = async () => {
      // O modo Painel é uma exibição contínua. Quando uma nova publicação
      // chegar, recarrega a página para aplicar catálogos e imagens atualizados.
      // No modo Agenda/Curadoria, não interrompe a interação do usuário.
      if (document.hidden || state.curationMode || effectiveViewMode() === 'agenda') return;

      const hash = await publicationCourseHash();
      if (!hash) return;
      if (!state.publicationCourseHash) {
        state.publicationCourseHash = hash;
        return;
      }
      if (hash !== state.publicationCourseHash) {
        window.location.reload();
      }
    };

    void check();
    state.publicationWatchTimer = setInterval(check, LIVE_PUBLICATION_CHECK_MS);
  }

  async function loadSiteCurations() {
    const publish = payload => {
      window.MuralCultural.loadedCurations = payload?.curadorias || [];
      window.dispatchEvent(new CustomEvent('mural:curations-loaded'));
      return payload;
    };
    const index = await loadOptionalJson(SITE_CURATIONS_INDEX_URL, null);
    if (!index || index.schema !== 1 || index.escopo !== 'site-only' || !Array.isArray(index.curadorias)) {
      console.warn('Índice de curadorias indisponível ou inválido.');
      return publish(null);
    }

    const loaded = await Promise.all(index.curadorias.map(async entry => {
      const id = String(entry?.id || '').trim();
      const file = String(entry?.arquivo || '').trim();
      if (!id || !/^curadorias\/[a-z0-9][a-z0-9._-]*\.json$/i.test(file) || file.includes('..')) {
        console.warn(`Entrada inválida no índice de curadorias: ${id || '(sem id)'}`);
        return null;
      }
      const curation = await loadOptionalJson(file, null);
      if (!curation || typeof curation !== 'object' || String(curation.id || '') !== id) {
        console.warn(`Curadoria ${id} ausente, inválida ou com ID divergente.`);
        return null;
      }
      return { ...curation, ativo_de: entry.ativo_de, ativo_ate: entry.ativo_ate };
    }));

    return publish({
      schema: 1,
      escopo: 'site-only',
      descricao: String(index.descricao || ''),
      curadorias: loaded.filter(Boolean)
    });
  }

  async function load() {
    try {
      state.curationMode = curationModeFromUrl();
      const [response, relationsData, booksData, curationBooksData, curationBookCoversData, coursesData, contestsData, filmsData, platformsData, utilityData, activitiesData, spacesData, siteCurationsData, config] = await Promise.all([
        fetch(`${DATA_URL}?v=${Date.now()}`, { cache: 'no-store' }),
        loadOptionalJson(RELATIONS_URL, { relacoes: [] }),
        loadOptionalJson(BOOKS_URL, { livros: [] }),
        state.curationMode ? loadOptionalJson(CURATION_BOOKS_URL, { livros: [] }) : Promise.resolve({ livros: [] }),
        state.curationMode ? loadOptionalJson(CURATION_BOOK_COVERS_URL, { capas: {} }) : Promise.resolve({ capas: {} }),
        loadOptionalJson(COURSES_URL, { cursos: [] }),
        loadOptionalJson(CONTESTS_URL, { concursos: [] }),
        loadOptionalJson(FILMS_URL, { filmes: [] }),
        loadOptionalJson(PLATFORMS_URL, { plataformas: [] }),
        loadOptionalJson(UTILITY_URL, { itens: [] }),
        loadOptionalJson(ACTIVITIES_URL, { atividades: [] }),
        loadOptionalJson(SPACES_URL, { itens: [] }),
        loadSiteCurations(),
        loadOptionalJson(CONFIG_URL, {
          nome: 'Mural Cultural',
          modulos: { eventos: true, livros: false },
          proporcao: { eventos_por_livro: 5 },
          tempo_slide: { evento: 12, livro: 15 },
          filtros: { conteudo_padrao: 'all' }
        })
      ]);

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!data || !Array.isArray(data.eventos)) throw new Error('Formato inválido');

      state.data = data;
      state.relationsData = relationsData && Array.isArray(relationsData.relacoes)
        ? relationsData
        : { relacoes: [] };
      state.eventRelationsIndex = eventRelations?.buildIndex?.(state.relationsData) || Object.create(null);
      state.booksData = booksData && Array.isArray(booksData.livros) ? booksData : { livros: [] };
      state.curationBooksData = curationBooksData && Array.isArray(curationBooksData.livros) ? curationBooksData : { livros: [] };
      state.curationBookCoversData = curationBookCoversData && curationBookCoversData.capas && typeof curationBookCoversData.capas === 'object'
        ? curationBookCoversData
        : { capas: {} };
      state.coursesData = coursesData && Array.isArray(coursesData.cursos) ? coursesData : { cursos: [] };
      state.contestsData = contestsData && Array.isArray(contestsData.concursos)
        ? contestsData
        : { concursos: [] };
      state.filmsData = filmsData && Array.isArray(filmsData.filmes) ? filmsData : { filmes: [] };
      state.platformsData = platformsData && Array.isArray(platformsData.plataformas)
        ? platformsData
        : { plataformas: [] };
      state.utilityData = utilityData && Array.isArray(utilityData.itens) ? utilityData : { itens: [] };
      state.activitiesData = activitiesData && Array.isArray(activitiesData.atividades) ? activitiesData : { atividades: [] };
      state.spacesData = spacesData && Array.isArray(spacesData.itens) ? spacesData : { itens: [] };
      state.siteCurationsData = siteCurationsData;
      state.config = config || {};

      const requestedAgendaCuration = requestedCurationIdFromUrl();
      if (requestedAgendaCuration && agendaCurationEntries()
        .some(curation => curation.id === requestedAgendaCuration)) {
        state.mobileCuration = requestedAgendaCuration;
      }

      const siteLayer = siteCurationsContent.apply(siteCurationsData, {
        eventos: data.eventos,
        livros: state.booksData.livros,
        cursos: state.coursesData.cursos,
        filmes: state.filmsData.filmes,
        utilidade_publica: state.utilityData.itens,
        concursos: state.contestsData.concursos
      });
      state.allEvents = filterAndSort(siteLayer.eventos).map(event => ({ ...event, tipo_conteudo: 'evento' }));
      const publicBooks = siteLayer.livros.map(book => ({ ...book, tipo_conteudo: 'livro' }));
      state.allBooks = state.curationMode
        ? mergeCurationBooks(publicBooks, state.curationBooksData.livros, state.curationBookCoversData.capas)
        : publicBooks;
      state.allCourses = siteLayer.cursos
        .filter(coursesContent.isPublishable)
        .map(course => ({ ...course, tipo_conteudo: 'curso' }));
      state.allContests = (siteLayer.concursos || [])
        .filter(contestsContent.isValid)
        .map(contest => ({
          ...contestsContent.publicRecord(contest),
          tipo_conteudo: 'concurso'
        }));
      const platforms = platformIndex(state.platformsData);
      state.allFilms = siteLayer.filmes.map(movie => applyFilmPlatformFallback({
        ...movie,
        tipo_conteudo: 'filme'
      }, platforms));
      state.allUtility = siteLayer.utilidade_publica
        .filter(utilityContent.isValid)
        .filter(item => utilityContent.isTemporallyVisible(item))
        .map(item => ({
          ...item,
          areas_utilidade: Array.isArray(item.areas_utilidade) ? [...item.areas_utilidade] : [],
          tipos_recurso: Array.isArray(item.tipos_recurso) ? [...item.tipos_recurso] : []
        }));
      state.allSpaces = state.spacesData.itens
        .filter(spacesContent.isValid)
        .map(item => ({
          ...item,
          vocacoes: Array.isArray(item.vocacoes) ? [...item.vocacoes] : [],
          temas: Array.isArray(item.temas) ? [...item.temas] : []
        }));
      state.allActivities = state.activitiesData.atividades
        .filter(activitiesContent.isValid)
        .map(item => ({
          ...item,
          modalidades: Array.isArray(item.modalidades) ? [...item.modalidades] : [],
          publicos_alvo: Array.isArray(item.publicos_alvo) ? [...item.publicos_alvo] : [],
          temas: Array.isArray(item.temas) ? [...item.temas] : [],
          termos_busca: Array.isArray(item.termos_busca) ? [...item.termos_busca] : []
        }));
      siteCurationsContent.mountSupportArea(siteLayer.apoio);
      siteCurationsContent.bindSupportRequest();
      state.schoolRotationBatch = readStoredSchoolBatch();
      loadStoredPanelSettings();
      syncActivePanelProfile();
      rebuildVisibleItems();

      if (!state.events.length) {
        showMessage('empty', 'Nenhum conteúdo disponível', 'A programação será atualizada em breve.');
        return;
      }

      state.viewMode = state.curationMode ? 'agenda' : storedViewMode();
      const requestedCurationContent = state.curationMode ? requestedCurationContentFromUrl() : '';
      if (requestedCurationContent) {
        state.mobileContent = requestedCurationContent;
      }
      const requestedAgendaItem = requestedAgendaItemFromUrl();
      if (requestedAgendaItem && agendaItemsForIds(new Set([requestedAgendaItem])).length) {
        state.mobileFocusedItem = requestedAgendaItem;
        state.mobileSharedSelection = null;
        state.mobileFavoritesOnly = false;
        state.mobileContent = 'all';
        state.viewMode = 'agenda';
        saveViewMode('agenda');
      }

      let sharedSelection = state.mobileFocusedItem ? null : sharedAgendaSelectionFromUrl();
      if (!state.mobileFocusedItem && !sharedSelection?.size) {
        const shortSelection = await sharedAgendaSelectionFromShortLink();
        if (shortSelection?.ids?.size) {
          sharedSelection = shortSelection.ids;
          if (shortSelection.contexto === 'curadoria_livros' && state.curationMode) {
            state.mobileContent = 'books';
          }
        }
      }
      if (sharedSelection?.size) {
        state.mobileSharedSelection = sharedSelection;
        state.mobileFavoritesOnly = false;
        if (!state.curationMode) state.mobileContent = 'all';
        state.viewMode = 'agenda';
        saveViewMode('agenda');
      }
      state.publicationCourseHash = await publicationCourseHash();
      startLivePublicationWatch();
      renderCurrentView();
    } catch (error) {
      console.error(error);
      showMessage(
        'error',
        'Não foi possível carregar o Mural Cultural',
        'Verifique se eventos.json contém um JSON válido.'
      );
    }
  }

  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.hidden) {
        clearTimeout(state.timer);
      } else if (state.events.length && !state.isPaused && !bookLocationsDialog?.open) {
        renderSlide(state.index);
      }
    }
  );

  let resizeFitTimer = null;
  window.addEventListener('resize', () => {
    if (state.viewMode === 'auto' && state.data && !bookLocationsDialog?.open) {
      renderCurrentView();
      return;
    }
    clearTimeout(resizeFitTimer);
    resizeFitTimer = setTimeout(() => {
      const currentBookSlide = app.querySelector('.book-slide');
      if (currentBookSlide) fitBookCopy(currentBookSlide);
    }, 120);
  });



  function activateLoadingAnimation() {
    const animation = document.querySelector('.loading-animation');
    const fallback = document.querySelector('.loading-spinner-fallback');
    if (!animation) return;

    const showAnimation = () => {
      animation.hidden = false;
      if (fallback) fallback.hidden = true;
    };

    if (animation.complete && animation.naturalWidth > 0) {
      showAnimation();
      return;
    }

    animation.addEventListener('load', showAnimation, { once: true });
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    refreshInstallButtons();
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    refreshInstallButtons();
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js').catch(error => {
        console.warn('Não foi possível ativar o modo aplicativo:', error);
      });
    });
  }

  window.addEventListener('mural:panel-profile-request', event => {
    const profileId = String(event.detail?.profile || '').trim();
    if (!profileId) return;

    // O banner é um controle de alternância: clicar novamente na curadoria ativa
    // restaura a programação padrão. Pedidos de URL (?c=...) são idempotentes e
    // nunca desativam um perfil que já esteja aplicado.
    if (event.detail?.toggle === true) {
      toggleEditorialPanelProfile(profileId);
      return;
    }

    if (activeEditorialPanelProfileId() === profileId) return;
    applyEditorialPanelProfile(profileId);
  });

  // Adicionar listeners de teclado e gesto horizontal no celular
  document.addEventListener('keydown', handleKeyPress);
  setupMobileSwipeNavigation();

  activateLoadingAnimation();
  load();
})();
