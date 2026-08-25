(() => {
  'use strict';

  const DATA_URL = 'eventos.json';
  const BOOKS_URL = 'livros.json';
  const COURSES_URL = 'cursos.json';
  const CONTESTS_URL = 'concursos.json';
  const FILMS_URL = 'filmes.json';
  const CONFIG_URL = 'configuracao-mural.json';
  const app = document.getElementById('app');
  const SCHOOL_ROTATION_SIZE = 6;
  const SCHOOL_ROTATION_KEY = 'agenda-cultural-escola-livre-lote';
  const SLIDE_DURATION_KEY = 'mural-cultural-tempo-slides';
  const PANEL_SETTINGS_KEY = 'mural-cultural-configuracao-painel-v1';
  const PANEL_PROFILES_KEY = 'mural-cultural-perfis-painel-v1';
  const AGENDA_BATCH_SIZE = 24;
  const AGENDA_CONTENT_LABELS = Object.freeze({
    events: { singular: 'evento', plural: 'eventos' },
    books: { singular: 'livro', plural: 'livros' },
    courses: { singular: 'curso', plural: 'cursos' },
    contests: { singular: 'concurso', plural: 'concursos' },
    films: { singular: 'filme', plural: 'filmes' }
  });
  const ALLOWED_SLIDE_DURATIONS = new Set([0, 5, 8, 10, 12, 15, 20, 30]);
  const CONTENT_SUBTITLES = Object.freeze({
    evento: 'Agenda Cultural',
    livro: 'Sugestão de Leitura',
    curso: 'Curso Online Gratuito',
    filme: 'Sugestão de Filme',
    jogo: 'Sugestão de Jogo',
    passeio: 'Sugestão de Passeio'
  });
  const template = document.getElementById('slide-template');
  const muralCore = window.MuralCultural.core;
  const coursesContent = window.MuralCultural.contents.courses;
  const contestsContent = window.MuralCultural.contents.contests;
  const filmsContent = window.MuralCultural.contents.films;
  let deferredInstallPrompt = null;

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
    'cine santa tereza': 'imagens/CineSantaTerezaBH.png'
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
    booksData: null,
    coursesData: null,
    contestsData: null,
    filmsData: null,
    config: null,
    allEvents: [],
    allBooks: [],
    allCourses: [],
    allContests: [],
    allFilms: [],
    events: [],
    index: 0,
    timer: null,
    isPaused: false,
    btnNext: null,
    btnPrev: null,
    btnPlayPause: null,
    btnFilter: null,
    filterOverlay: null,
    panelModules: { events: true, books: true, courses: true, contests: true, films: true },
    panelEventCities: [],
    panelBookCampuses: [],
    panelWeights: { events: 5, books: 1, courses: 1, contests: 1, films: 1 },
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
      filmRating: '',
      filmDuration: ''
    },
    schoolRotationBatch: 0,
    viewMode: 'auto',
    slideDuration: 0,
    mobileQuery: '',
    mobileContent: 'all',
    mobileTheme: '',
    mobilePeriod: 'all',
    mobileCategory: '',
    mobileCity: '',
    mobileSpace: '',
    mobileInstitution: '',
    mobileRegistration: '',
    mobileBookAccess: '',
    mobileContestFormation: '',
    mobileContestUf: '',
    mobileContestDeadline: '',
    mobileFilmGenre: '',
    mobileFilmLetter: '',
    mobileFilmRating: '',
    mobileFilmYearFrom: '',
    mobileFilmYearTo: '',
    mobileFilmDuration: '',
    mobileFilmSort: 'title-asc',
    agendaVisibleCounts: {
      events: AGENDA_BATCH_SIZE,
      books: AGENDA_BATCH_SIZE,
      courses: AGENDA_BATCH_SIZE,
      contests: AGENDA_BATCH_SIZE,
      films: AGENDA_BATCH_SIZE
    }
  };

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

    const local = normalizeText(event.local);

    if (!local) {
      return '';
    }

    for (const [localName, imagePath] of Object.entries(localImages)) {
      if (local.includes(localName)) {
        return imagePath;
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
    const value = normalizeText(event.criterio_exibicao);
    return ['inscricao', 'acesso', 'manual', 'realizacao'].includes(value)
      ? value
      : 'realizacao';
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
    const registrationStatus = normalizeText(event.status_inscricao).replaceAll('_', ' ');
    const formStatus = normalizeText(event.status_formulario_google).replaceAll('_', ' ');
    return CLOSED_ACCESS_STATUSES.has(registrationStatus) || formStatus === 'fechado';
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
    const criterion = displayCriterion(event);
    if (criterion === 'manual') return event.exibicao_ativa !== false;

    if (criterion === 'inscricao' || criterion === 'acesso') {
      const status = normalizeText(
        criterion === 'inscricao' ? event.status_inscricao : event.status_acesso
      ).replaceAll('_', ' ');
      if (CLOSED_ACCESS_STATUSES.has(status)) return false;
      const deadline = safeDate(
        criterion === 'inscricao' ? event.inscricao_fim : event.acesso_fim
      );
      return !deadline || deadline >= today;
    }

    const end = safeDate(event.data_fim || event.data);
    return !end || end >= today;
  }

  function eventSortKey(event) {
    const criterion = displayCriterion(event);
    const realization = safeDate(event.data)?.getTime() || Number.MAX_SAFE_INTEGER;
    if (criterion === 'inscricao') {
      const deadline = safeDate(event.inscricao_fim)?.getTime();
      return [deadline ? 0 : 1, deadline || realization, realization];
    }
    if (criterion === 'acesso') {
      const deadline = safeDate(event.acesso_fim)?.getTime();
      return [deadline ? 0 : 1, deadline || realization, realization];
    }
    return [2, realization, realization];
  }

  function filterAndSort(events) {
    const today = todayAtMidnight();

    return events
      .filter(event => event && event.titulo && event.data)
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
    return Boolean(book.link && book.imagem);
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
    const blocks = acervos.map(acervo => {
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
      return `<div class="agenda-book-holding">
        <strong>${escapeHtml(label)}</strong>
        ${recordsHtml}
      </div>`;
    }).join('');
    return `<section class="agenda-book-holdings" aria-label="Bibliotecas onde encontrar este livro">
      <h3>Onde encontrar</h3>
      ${blocks}
    </section>`;
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

  function rebuildVisibleItems() {
    const eventsEnabled = state.panelModules.events && state.config?.modulos?.eventos !== false;
    const booksEnabled = state.panelModules.books && state.config?.modulos?.livros !== false;
    const coursesEnabled = state.panelModules.courses && state.config?.modulos?.cursos !== false;
    const contestsEnabled = state.panelModules.contests && state.config?.modulos?.concursos !== false;
    const filmsEnabled = state.panelModules.films && state.config?.modulos?.filmes !== false;
    const events = eventsEnabled ? visibleEventsForFilters() : [];
    const books = booksEnabled ? filterBooks(state.allBooks) : [];
    const themedCourses = state.filters.theme
      ? state.allCourses.filter(course => courseMatchesTheme(course, state.filters.theme))
      : state.allCourses;
    const courses = coursesEnabled ? coursesContent.sampleForPanel(themedCourses) : [];
    const contests = contestsEnabled && !state.filters.theme
      ? contestsContent.sampleForPanel(state.allContests)
      : [];
    const films = filmsEnabled ? filmsContent.sampleForPanel(state.allFilms, {
      genre: state.filters.filmGenre,
      theme: state.filters.theme,
      rating: state.filters.filmRating,
      duration: state.filters.filmDuration,
      sort: 'title-asc'
    }, normalizeText) : [];
    state.events = muralCore.interleaveContents([
      { items: events, weight: state.panelWeights.events },
      { items: books, weight: state.panelWeights.books },
      { items: courses, weight: state.panelWeights.courses },
      { items: contests, weight: state.panelWeights.contests },
      { items: films, weight: state.panelWeights.films }
    ]);
    return state.events;
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
    return Boolean(
      !state.panelModules.events || !state.panelModules.books || !state.panelModules.courses ||
      !state.panelModules.contests || !state.panelModules.films ||
      state.filters.theme || state.panelEventCities.length ||
      state.filters.category || state.filters.program || state.filters.unit ||
      state.filters.rating || state.filters.period !== 'all' ||
      state.filters.bookAccess || state.panelBookCampuses.length ||
      state.filters.filmGenre || state.filters.filmRating || state.filters.filmDuration
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
    return [...values.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  }

  function eventProgram(event) {
    return event.programa || event.fonte || '';
  }

  function eventUnit(event) {
    return event.unidade || event.local || '';
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
    if (state.panelModules.events !== defaults.modules.events ||
        state.panelModules.books !== defaults.modules.books ||
        state.panelModules.courses !== defaults.modules.courses ||
        state.panelModules.contests !== defaults.modules.contests ||
        state.panelModules.films !== defaults.modules.films) count += 1;
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
      if (state.filters.filmRating) count += 1;
      if (state.filters.filmDuration) count += 1;
    }
    if (state.panelWeights.events !== defaults.weights.events ||
        state.panelWeights.books !== defaults.weights.books ||
        state.panelWeights.courses !== defaults.weights.courses ||
        state.panelWeights.contests !== defaults.weights.contests ||
        state.panelWeights.films !== defaults.weights.films) count += 1;
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
    const start = safeDate(event.data);
    const end = safeDate(event.data_fim);

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

    const hasDateRange = Boolean(
      event.data_fim && event.data_fim !== event.data
    );
    const isLongEvent = hasDateRange &&
      eventDurationDays(event) > LONG_EVENT_THRESHOLD_DAYS;

    if (isLongEvent) {
      const start = safeDate(event.data);
      const end = safeDate(event.data_fim);
      const differentYears = Boolean(
        start && end && start.getFullYear() !== end.getFullYear()
      );

      appendWhenDate(container, event.data, {
        showWeekday: false,
        includeYear: differentYears
      });
      appendWhenDate(container, event.data_fim, {
        prefix: ' a ',
        showWeekday: false,
        includeYear: true
      });
    } else {
      appendWhenDate(container, event.data);

      if (hasDateRange) {
        appendWhenDate(container, event.data_fim, {
          prefix: ' a '
        });
      }
    }

    if (event.horario) {
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

    if (displayCriterion(event) === 'inscricao' && event.inscricao_inicio) {
      const registration = document.createElement('span');
      registration.className = 'when-registration';
      const start = formatDateParts(event.inscricao_inicio, true).date;
      const status = normalizeText(event.status_inscricao).replaceAll('_', ' ');
      const closed = CLOSED_ACCESS_STATUSES.has(status);

      container.append(document.createElement('br'));
      registration.textContent = closed
        ? `Inscrições encerradas — abertas desde ${start}`
        : event.inscricao_fim
          ? `Inscrições: ${start} a ${formatDateParts(event.inscricao_fim, true).date}`
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

  function buildSiteQr(slide) {
    const wrap = slide.querySelector('.site-qr-wrap');
    const container = slide.querySelector('.site-qr-code');
    if (!wrap || !container) return;

    const link = muralPublicUrl();
    if (!link || typeof QRCode === 'undefined') {
      wrap.hidden = true;
      return;
    }

    wrap.hidden = false;
    container.setAttribute('aria-label', `QR Code do Mural Cultural: ${link}`);
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
      passeio: 'Ver este passeio'
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
    if (state.isPaused) return;

    clearTimeout(state.timer);

    const item = state.events[state.index];
    const seconds = slideDurationFor(item);

    state.timer = setTimeout(goToNext, seconds * 1000);
  }

  function renderEventSlide(index) {
    clearTimeout(state.timer);

    const event = state.events[index];
    const data = state.data;
    const slide = template.content.firstElementChild.cloneNode(true);
    buildSiteQr(slide);

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
      [event.local, event.cidade]
        .filter(Boolean)
        .join(' • ') || 'Local não informado';

    const mapUrl = safeExternalUrl(event.mapa);

    if (mapUrl) {
      mapLink.href = mapUrl;
      mapLink.hidden = false;
      mapLink.setAttribute(
        'aria-label',
        `Abrir ${event.local || 'o local do evento'} no Google Maps`
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
            : `Imagem do local: ${event.local || event.titulo}`;

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

  function renderBookSlide(index) {
    clearTimeout(state.timer);
    const book = state.events[index];
    const slide = template.content.firstElementChild.cloneNode(true);
    buildSiteQr(slide);
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
    const callText = bookLocationsSummary(book);
    copy.querySelector('.book-call').textContent = callText;

    const accessLabels = [];
    if (book.acesso_fisico) accessLabels.push('Físico');
    if (book.acesso_virtual) accessLabels.push('Virtual');
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
    const physicalUrl = firstBookHoldingUrl(book, 'link_fisico');
    const virtualUrl = firstBookHoldingUrl(book, 'link_virtual');
    const physicalLinksCount = new Set(holdings.map(item => safeExternalUrl(item.link_fisico)).filter(Boolean)).size;
    const virtualLinksCount = new Set(holdings.map(item => safeExternalUrl(item.link_virtual)).filter(Boolean)).size;
    if (physicalUrl) {
      physicalLink.href = physicalUrl;
      if (physicalLinksCount > 1) physicalLink.textContent = 'Ver um dos catálogos físicos';
    } else physicalLink.remove();
    if (virtualUrl) {
      virtualLink.href = virtualUrl;
      if (virtualLinksCount > 1) virtualLink.textContent = 'Acessar uma edição virtual';
    } else virtualLink.remove();
    const opinionLink = copy.querySelector('.book-opinion-link');
    const opinionUrl = safeExternalUrl(book.link_formulario_opiniao || state.config?.opinioes_livros?.url_formulario);
    const opinionsEnabled = state.config?.opinioes_livros?.habilitado === true;
    if (opinionLink) {
      opinionLink.hidden = !(opinionsEnabled && opinionUrl);
      if (opinionsEnabled && opinionUrl) opinionLink.href = opinionUrl;
    }

    const link = safeExternalUrl(book.link || book.link_fisico || book.link_virtual);
    slide.querySelector('.source-label').textContent = 'Encontre este livro';
    const source = slide.querySelector('.source-url');
    if (link) {
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
    image.onload = () => { fallback.style.display = 'none'; };
    image.onerror = () => { image.classList.remove('loaded'); image.style.display = 'none'; fallback.style.display = 'grid'; };
    image.src = book.imagem || '';

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
    clearTimeout(state.timer);
    const movie = state.events[index];
    if (!movie) return;

    const slide = filmsContent.createPanelSlide({
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

  function renderSlide(index) {
    const item = state.events[index];
    if (!item) return;
    if (item.tipo_conteudo === 'livro') renderBookSlide(index);
    else if (item.tipo_conteudo === 'curso') renderCourseSlide(index);
    else if (item.tipo_conteudo === 'concurso') renderContestSlide(index);
    else if (item.tipo_conteudo === 'filme') renderFilmSlide(index);
    else renderEventSlide(index);
  }

  function goToNext() {
    if (!state.events.length) return;
    state.index = (state.index + 1) % state.events.length;
    renderSlide(state.index);
  }

  function goToPrevious() {
    if (!state.events.length) return;
    state.index = (state.index - 1 + state.events.length) % state.events.length;
    renderSlide(state.index);
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
      ? `Configurar painel: ${count} ajuste${count === 1 ? '' : 's'} ativo${count === 1 ? '' : 's'}`
      : 'Configurar painel';

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
    return {
      modules: {
        events: panelModules.eventos !== undefined
          ? Boolean(panelModules.eventos)
          : state.config?.modulos?.eventos !== false,
        books: panelModules.livros !== undefined
          ? Boolean(panelModules.livros)
          : state.config?.modulos?.livros !== false,
        courses: panelModules.cursos !== undefined
          ? Boolean(panelModules.cursos)
          : state.config?.modulos?.cursos !== false,
        contests: panelModules.concursos !== undefined
          ? Boolean(panelModules.concursos)
          : state.config?.modulos?.concursos !== false,
        films: panelModules.filmes !== undefined
          ? Boolean(panelModules.filmes)
          : state.config?.modulos?.filmes !== false
      },
      theme: String(panel.tema || ''),
      eventCities: Array.isArray(eventConfig.cidades) ? eventConfig.cidades.map(normalizeText).filter(Boolean) : [],
      eventCategory: String(eventConfig.categoria || ''),
      eventProgram: String(eventConfig.programa || ''),
      eventUnit: String(eventConfig.espaco || ''),
      bookCampuses: Array.isArray(bookConfig.campi_acervos) ? bookConfig.campi_acervos.map(normalizeText).filter(Boolean) : [],
      bookAccess: String(bookConfig.acesso || ''),
      filmGenre: String(filmConfig.genero || ''),
      filmRating: String(filmConfig.classificacao || ''),
      filmDuration: String(filmConfig.duracao || ''),
      weights: {
        events: Math.max(1, Number(frequency.eventos ?? state.config?.proporcao?.eventos_por_livro) || 5),
        books: Math.max(1, Number(frequency.livros) || 1),
        courses: Math.max(1, Number(frequency.cursos) || 1),
        contests: Math.max(1, Number(frequency.concursos) || 1),
        films: Math.max(1, Number(frequency.filmes) || 1)
      },
      slideDuration: ALLOWED_SLIDE_DURATIONS.has(Number(panel.tempo_slides)) ? Number(panel.tempo_slides) : 0
    };
  }

  function normalizePanelSettings(value = {}) {
    const defaults = defaultPanelSettings();
    const modules = value.modules || {};
    const weights = value.weights || {};
    const clampWeight = number => Math.min(10, Math.max(1, Number(number) || 1));

    return {
      modules: {
        events: modules.events !== undefined ? Boolean(modules.events) : defaults.modules.events,
        books: modules.books !== undefined ? Boolean(modules.books) : defaults.modules.books,
        courses: modules.courses !== undefined ? Boolean(modules.courses) : defaults.modules.courses,
        contests: modules.contests !== undefined ? Boolean(modules.contests) : defaults.modules.contests,
        films: modules.films !== undefined ? Boolean(modules.films) : defaults.modules.films
      },
      theme: String(value.theme || ''),
      eventCities: Array.isArray(value.eventCities) ? value.eventCities.map(normalizeText).filter(Boolean) : [],
      eventCategory: String(value.eventCategory || ''),
      eventProgram: String(value.eventProgram || ''),
      eventUnit: String(value.eventUnit || ''),
      bookCampuses: Array.isArray(value.bookCampuses) ? value.bookCampuses.map(normalizeText).filter(Boolean) : [],
      bookAccess: String(value.bookAccess || ''),
      filmGenre: String(value.filmGenre || ''),
      filmRating: String(value.filmRating || ''),
      filmDuration: String(value.filmDuration || ''),
      weights: {
        events: clampWeight(weights.events ?? defaults.weights.events),
        books: clampWeight(weights.books ?? defaults.weights.books),
        courses: clampWeight(weights.courses ?? defaults.weights.courses),
        contests: clampWeight(weights.contests ?? defaults.weights.contests),
        films: clampWeight(weights.films ?? defaults.weights.films)
      },
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

  function requestedPanelProfile() {
    try {
      return panelProfileSlug(new URLSearchParams(window.location.search).get('perfil') || '');
    } catch {
      return '';
    }
  }

  function configuredPanelProfiles() {
    const profiles = state.config?.perfis_painel;
    return profiles && typeof profiles === 'object' && !Array.isArray(profiles) ? profiles : {};
  }

  function findRequestedPanelProfile() {
    const requested = requestedPanelProfile();
    if (!requested) return null;
    const candidates = {
      ...configuredPanelProfiles(),
      ...readPanelProfiles()
    };
    for (const [name, settings] of Object.entries(candidates)) {
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

  function populateProfileSelect(slide, selectedName = '') {
    const select = slide.querySelector('.panel-profile-select');
    if (!select) return;
    const profiles = readPanelProfiles();
    select.replaceChildren();
    const current = document.createElement('option');
    current.value = '';
    current.textContent = 'Configuração atual';
    select.append(current);
    Object.keys(profiles)
      .sort((a, b) => a.localeCompare(b, 'pt-BR'))
      .forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        select.append(option);
      });
    select.value = Object.hasOwn(profiles, selectedName) ? selectedName : '';
    const deleteButton = slide.querySelector('.panel-profile-delete');
    if (deleteButton) deleteButton.disabled = !select.value;
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
    if (!eventsEnabled && !booksEnabled && !coursesEnabled && !contestsEnabled && !filmsEnabled) {
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
        films: filmsEnabled
      },
      theme: slide.querySelector('.filter-theme')?.value || '',
      eventCities: checkedFilterValues(cityContainer),
      eventCategory: slide.querySelector('.filter-category')?.value || '',
      eventProgram: slide.querySelector('.filter-program')?.value || '',
      eventUnit: slide.querySelector('.filter-unit')?.value || '',
      bookCampuses: checkedFilterValues(campusContainer),
      bookAccess: slide.querySelector('.filter-book-access')?.value || '',
      filmGenre: slide.querySelector('.filter-film-genre')?.value || '',
      filmRating: slide.querySelector('.filter-film-rating')?.value || '',
      filmDuration: slide.querySelector('.filter-film-duration')?.value || '',
      weights: {
        events: slide.querySelector('.panel-event-weight')?.value || 5,
        books: slide.querySelector('.panel-book-weight')?.value || 1,
        courses: slide.querySelector('.panel-course-weight')?.value || 1,
        contests: slide.querySelector('.panel-contest-weight')?.value || 1,
        films: slide.querySelector('.panel-film-weight')?.value || 1
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
    const eventSection = slide.querySelector('.panel-event-section');
    const bookSection = slide.querySelector('.panel-book-section');
    const courseSection = slide.querySelector('.panel-course-section');
    const contestSection = slide.querySelector('.panel-contest-section');
    const filmSection = slide.querySelector('.panel-film-section');
    if (eventSection) eventSection.hidden = !eventsEnabled;
    if (bookSection) bookSection.hidden = !booksEnabled;
    if (courseSection) courseSection.hidden = !coursesEnabled;
    if (contestSection) contestSection.hidden = !contestsEnabled;
    if (filmSection) filmSection.hidden = !filmsEnabled;
  }

  function populateFilterPanel(slide, settings = currentPanelSettings()) {
    const value = normalizePanelSettings(settings);
    const themeSelect = slide.querySelector('.filter-theme');
    const categorySelect = slide.querySelector('.filter-category');
    const programSelect = slide.querySelector('.filter-program');
    const unitSelect = slide.querySelector('.filter-unit');
    const bookAccessSelect = slide.querySelector('.filter-book-access');
    const filmGenreSelect = slide.querySelector('.filter-film-genre');
    const filmRatingSelect = slide.querySelector('.filter-film-rating');
    const filmDurationSelect = slide.querySelector('.filter-film-duration');
    const durationSelect = slide.querySelector('.filter-slide-duration');

    const eventsToggle = slide.querySelector('.panel-module-events');
    const booksToggle = slide.querySelector('.panel-module-books');
    const coursesToggle = slide.querySelector('.panel-module-courses');
    const contestsToggle = slide.querySelector('.panel-module-contests');
    const filmsToggle = slide.querySelector('.panel-module-films');
    if (eventsToggle) eventsToggle.checked = value.modules.events;
    if (booksToggle) booksToggle.checked = value.modules.books;
    if (coursesToggle) coursesToggle.checked = value.modules.courses;
    if (contestsToggle) contestsToggle.checked = value.modules.contests;
    if (filmsToggle) filmsToggle.checked = value.modules.films;
    if (durationSelect) durationSelect.value = String(value.slideDuration || 0);
    const eventWeight = slide.querySelector('.panel-event-weight');
    const bookWeight = slide.querySelector('.panel-book-weight');
    const courseWeight = slide.querySelector('.panel-course-weight');
    const contestWeight = slide.querySelector('.panel-contest-weight');
    const filmWeight = slide.querySelector('.panel-film-weight');
    if (eventWeight) eventWeight.value = String(value.weights.events);
    if (bookWeight) bookWeight.value = String(value.weights.books);
    if (courseWeight) courseWeight.value = String(value.weights.courses);
    if (contestWeight) contestWeight.value = String(value.weights.contests);
    if (filmWeight) filmWeight.value = String(value.weights.films);

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
    if (bookAccessSelect) bookAccessSelect.value = value.bookAccess;
    populateDynamicSelect(
      filmGenreSelect,
      'Todos os gêneros',
      filmsContent.options(state.allFilms, 'generos').map(label => [normalizeText(label), label]),
      normalizeText(value.filmGenre)
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
    applyPanelSettings(defaults, true);
    if (!render) return;
    rebuildVisibleItems();
    state.index = 0;
    renderCurrentView();
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
      restoreDefaultPanelSettings(false);
      rebuildVisibleItems();
      state.index = 0;
      renderCurrentView();
    });
  }

  function applyFiltersFromPanel() {
    if (!state.filterOverlay) return;
    try {
      const settings = readPanelSettingsFromOverlay(state.filterOverlay);
      applyPanelSettings(settings, true);
      rebuildVisibleItems();
      state.index = 0;

      if (!state.events.length) {
        showFilteredEmpty();
        return;
      }

      renderCurrentView();
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
      populateProfileSelect(slide, name);
      if (nameInput) nameInput.value = '';
      showPanelValidation(slide, '');
    } catch (error) {
      showPanelValidation(slide, error.message || 'Não foi possível salvar o perfil.');
    }
  }

  function deletePanelProfile(slide) {
    const select = slide.querySelector('.panel-profile-select');
    const name = select?.value || '';
    if (!name) return;
    const profiles = readPanelProfiles();
    delete profiles[name];
    writePanelProfiles(profiles);
    populateProfileSelect(slide, '');
  }

  function setupFilterPanel(slide) {
    populateFilterPanel(slide);
    populateProfileSelect(slide);

    const overlay = slide.querySelector('.filter-overlay');
    const closeButton = slide.querySelector('.filter-close');
    const applyButton = slide.querySelector('.filter-apply');
    const clearButton = slide.querySelector('.filter-clear');

    closeButton?.addEventListener('click', closeFilterPanel);
    applyButton?.addEventListener('click', applyFiltersFromPanel);
    clearButton?.addEventListener('click', () => {
      const defaults = defaultPanelSettings();
      populateFilterPanel(slide, defaults);
      const profileSelect = slide.querySelector('.panel-profile-select');
      if (profileSelect) profileSelect.value = '';
      showPanelValidation(slide, '');
    });

    slide.querySelector('.panel-module-events')?.addEventListener('change', () => updatePanelModuleVisibility(slide));
    slide.querySelector('.panel-module-books')?.addEventListener('change', () => updatePanelModuleVisibility(slide));
    slide.querySelector('.panel-module-courses')?.addEventListener('change', () => updatePanelModuleVisibility(slide));
    slide.querySelector('.panel-module-contests')?.addEventListener('change', () => updatePanelModuleVisibility(slide));
    slide.querySelector('.panel-module-films')?.addEventListener('change', () => updatePanelModuleVisibility(slide));
    slide.querySelector('.panel-profile-save')?.addEventListener('click', () => savePanelProfile(slide));
    slide.querySelector('.panel-profile-delete')?.addEventListener('click', () => deletePanelProfile(slide));
    slide.querySelector('.panel-profile-select')?.addEventListener('change', event => {
      const profiles = readPanelProfiles();
      const selected = event.target.value;
      if (selected && profiles[selected]) populateFilterPanel(slide, profiles[selected]);
      const deleteButton = slide.querySelector('.panel-profile-delete');
      if (deleteButton) deleteButton.disabled = !selected;
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

    if (normalizeText(event.local).includes('cine santa tereza')) {
      return safeImageUrl('imagens/CineSantaTerezaBH.png');
    }
    if (normalizeText(event.programa).includes('escola livre de artes arena da cultura')) {
      return safeImageUrl('imagens/eventos-manuais/escola-livre-de-artes.png');
    }
    return '';
  }

  function mobileDateLabel(event) {
    const start = safeDate(event.data);
    if (!start) return event.data || 'Data não informada';
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
    return [...values.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  }

  function normalizeAgendaFiltersForContent(content = state.mobileContent) {
    const allowedContents = new Set(['all', 'events', 'books', 'courses', 'contests', 'films']);
    state.mobileContent = allowedContents.has(content) ? content : 'all';

    if (!['events', 'books', 'courses', 'films'].includes(state.mobileContent)) {
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
    if (state.mobileContent !== 'books') state.mobileBookAccess = '';
    if (state.mobileContent !== 'contests') {
      state.mobileContestFormation = '';
      state.mobileContestUf = '';
      state.mobileContestDeadline = '';
    }
    if (state.mobileContent !== 'films') {
      state.mobileFilmGenre = '';
      state.mobileFilmLetter = '';
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
      state.mobileQuery || state.mobileTheme || state.mobileCategory ||
      state.mobileSpace || state.mobileInstitution
    );
  }

  function agendaHasSpecificEventFilters() {
    return Boolean(
      state.mobileQuery || state.mobileTheme || state.mobilePeriod !== 'all' ||
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
    const status = normalizeText(event.status_inscricao).replaceAll('_', ' ');
    const formStatus = normalizeText(event.status_formulario_google).replaceAll('_', ' ');
    const hasRegistrationLink = Boolean(safeExternalUrl(event.link_inscricao));
    const registrationCriterion = displayCriterion(event) === 'inscricao';
    const hasRegistrationText = Boolean(String(event.inscricao || '').trim());

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
      event.titulo, event.descricao, event.local, event.unidade, event.cidade,
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
    });
  }

  function agendaVisibleBooks() {
    if (!['all', 'books'].includes(state.mobileContent) || state.config?.modulos?.livros === false) return [];
    const query = normalizeText(state.mobileQuery);
    const today = todayAtMidnight();
    const specific = state.mobileContent === 'books';
    return state.allBooks
      .filter(book => bookIsPublishable(book, today))
      .filter(book => bookMatchesTheme(book, state.mobileTheme))
      .filter(book => {
        if (!specific) return true;
        if (state.mobileBookAccess === 'physical' && !book.acesso_fisico) return false;
        if (state.mobileBookAccess === 'virtual' && !book.acesso_virtual) return false;
        if (state.mobileBookAccess === 'both' && !(book.acesso_fisico && book.acesso_virtual)) return false;
        return true;
      })
      .filter(book => agendaBookQueryMatches(book, query))
      .sort((a, b) =>
        Number(b.prioridade || 0) - Number(a.prioridade || 0) ||
        String(a.titulo || '').localeCompare(String(b.titulo || ''), 'pt-BR')
      );
  }

  function agendaVisibleCourses() {
    if (!['all', 'courses'].includes(state.mobileContent) || state.config?.modulos?.cursos === false) return [];
    const query = normalizeText(state.mobileQuery);
    return coursesContent.filter(state.allCourses)
      .filter(course => courseMatchesTheme(course, state.mobileTheme))
      .filter(course => coursesContent.agendaQueryMatches(course, query, normalizeText));
  }

  function agendaVisibleContests() {
    if (state.mobileTheme || !['all', 'contests'].includes(state.mobileContent) || state.config?.modulos?.concursos === false) {
      return [];
    }
    return contestsContent.filter(state.allContests, {
      query: state.mobileQuery,
      formation: state.mobileContent === 'contests' ? state.mobileContestFormation : '',
      uf: state.mobileContent === 'contests' ? state.mobileContestUf : '',
      deadline: state.mobileContent === 'contests' ? state.mobileContestDeadline : ''
    });
  }

  function agendaVisibleFilms() {
    if (!['all', 'films'].includes(state.mobileContent)) return [];
    return filmsContent.filter(state.allFilms, {
      query: state.mobileQuery,
      genre: state.mobileContent === 'films' ? state.mobileFilmGenre : '',
      theme: state.mobileContent === 'films' ? state.mobileTheme : '',
      letter: state.mobileContent === 'films' ? state.mobileFilmLetter : '',
      rating: state.mobileContent === 'films' ? state.mobileFilmRating : '',
      yearFrom: state.mobileContent === 'films' ? state.mobileFilmYearFrom : '',
      yearTo: state.mobileContent === 'films' ? state.mobileFilmYearTo : '',
      duration: state.mobileContent === 'films' ? state.mobileFilmDuration : '',
      sort: state.mobileContent === 'films' ? state.mobileFilmSort : 'title-asc'
    }, normalizeText);
  }

  function agendaVisibleContents() {
    const events = agendaVisibleEvents();
    const books = agendaVisibleBooks();
    const courses = agendaVisibleCourses();
    const contests = agendaVisibleContests();
    const films = agendaVisibleFilms();
    return {
      events,
      books,
      courses,
      contests,
      films,
      total: events.length + books.length + courses.length + contests.length + films.length
    };
  }

  function agendaActiveFilterCount() {
    if (state.mobileContent === 'contests') {
      return [
        state.mobileQuery,
        state.mobileContestFormation,
        state.mobileContestUf,
        state.mobileContestDeadline
      ].filter(Boolean).length;
    }
    if (state.mobileContent === 'films') {
      return [
        state.mobileQuery,
        state.mobileFilmGenre,
        state.mobileTheme,
        state.mobileFilmLetter,
        state.mobileFilmRating,
        state.mobileFilmYearFrom,
        state.mobileFilmYearTo,
        state.mobileFilmDuration,
        state.mobileFilmSort !== 'title-asc' ? state.mobileFilmSort : ''
      ].filter(Boolean).length;
    }

    const common = [state.mobileQuery];
    if (state.mobileContent !== 'all') common.push(state.mobileContent);
    if (state.mobileContent === 'events') {
      common.push(
        state.mobileTheme,
        state.mobilePeriod !== 'all' ? state.mobilePeriod : '',
        state.mobileCategory, state.mobileCity, state.mobileSpace,
        state.mobileInstitution, state.mobileRegistration
      );
    } else if (state.mobileContent === 'books') {
      common.push(state.mobileTheme, state.mobileBookAccess);
    }
    return common.filter(Boolean).length;
  }

  function clearAgendaFilters() {
    state.mobileQuery = '';
    state.mobileContent = 'all';
    state.mobileTheme = '';
    state.mobilePeriod = 'all';
    state.mobileCategory = '';
    state.mobileCity = '';
    state.mobileSpace = '';
    state.mobileInstitution = '';
    state.mobileRegistration = '';
    state.mobileBookAccess = '';
    state.mobileContestFormation = '';
    state.mobileContestUf = '';
    state.mobileContestDeadline = '';
  }

  function clearContestAgendaFilters() {
    state.mobileQuery = '';
    state.mobileContestFormation = '';
    state.mobileContestUf = '';
    state.mobileContestDeadline = '';
  }

  function clearFilmAgendaFilters() {
    state.mobileQuery = '';
    state.mobileFilmGenre = '';
    state.mobileTheme = '';
    state.mobileFilmLetter = '';
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

  function agendaSubtitleLabel() {
    if (state.mobileContent === 'events') return 'Agenda Cultural';
    if (state.mobileContent === 'books') return 'Sugestão de Leitura';
    if (state.mobileContent === 'courses') return 'Cursos Online Gratuitos';
    if (state.mobileContent === 'contests') return 'Concursos públicos';
    if (state.mobileContent === 'films') return 'Filmes gratuitos';
    return 'Descobertas culturais';
  }

  function renderAgendaCard(item, options = {}) {
    if (item.tipo_conteudo === 'filme') {
      return filmsContent.createAgendaCard(item, {
        escapeHtml,
        showDetails: (movie, opener) => filmsContent.showDetails(movie, opener, escapeHtml)
      });
    }

    if (item.tipo_conteudo === 'concurso') {
      return contestsContent.createAgendaCard(item, {
        safeExternalUrl,
        safeImageUrl
      });
    }

    if (item.tipo_conteudo === 'curso') {
      return coursesContent.createAgendaCard(item, {
        safeExternalUrl,
        safeImageUrl,
        escapeHtml
      });
    }

    const article = document.createElement('article');
    article.className = `agenda-card ${item.tipo_conteudo === 'livro' ? 'agenda-book-card' : 'agenda-event-card'}`;

    if (item.tipo_conteudo === 'livro') {
      const holdingsHtml = agendaBookHoldingsHtml(item);
      const acervosCount = bookAcervos(item).length;
      const opinionUrl = state.config?.opinioes_livros?.habilitado === true
        ? safeExternalUrl(item.link_formulario_opiniao || state.config?.opinioes_livros?.url_formulario)
        : '';
      article.innerHTML = `
        <div class="agenda-card-media book-media"><img src="${escapeHtml(item.imagem || '')}" alt="Capa: ${escapeHtml(item.titulo || '')}" loading="lazy"></div>
        <div class="agenda-card-body">
          <div class="agenda-card-badges"><span>Livro</span>${item.acesso_fisico ? '<span>Físico</span>' : ''}${item.acesso_virtual ? '<span>Virtual</span>' : ''}${acervosCount > 1 ? `<span>${acervosCount} acervos</span>` : ''}</div>
          <p class="agenda-card-date">Sugestão de Leitura</p>
          <h2>${escapeHtml(item.pergunta_curiosidade || item.titulo || 'Livro')}</h2>
          <p class="agenda-card-place"><strong class="agenda-book-title">${escapeHtml(item.titulo || '')}</strong> · ${escapeHtml(item.autor || '')}</p>
          <p class="agenda-card-description">${escapeHtml(item.texto_apoio || '')}</p>
          ${holdingsHtml}
          ${item.exibir_comentario && item.comentario_aprovado ? `<blockquote class="agenda-book-opinion">“${escapeHtml(item.comentario_aprovado)}”<cite>${escapeHtml(item.credito_comentario || 'Leitor(a) do IFMG')}</cite></blockquote>` : ''}
          ${opinionUrl ? `<div class="agenda-card-actions"><a class="secondary" href="${escapeHtml(opinionUrl)}" target="_blank" rel="noopener noreferrer">Opine sobre este livro</a></div>` : ''}
        </div>`;
      return article;
    }

    const event = item;
    const link = eventPublicLink(event);
    const map = safeExternalUrl(event.mapa);
    const closedRegistration = registrationIsClosed(event);
    const rating = normalizeRating(event.classificacao_indicativa);
    article.innerHTML = `
      <div class="agenda-card-media"><img></div>
      <div class="agenda-card-body">
        <div class="agenda-card-badges">
          <span>${escapeHtml(event.categoria || 'Evento')}</span><span>Gratuito</span>${rating ? `<span>${escapeHtml(rating.label)}</span>` : ''}
        </div>
        <p class="agenda-card-date">${escapeHtml(mobileDateLabel(event))}${event.horario ? ` • ${escapeHtml(event.horario)}` : ''}</p>
        <h2>${escapeHtml(event.titulo || 'Evento cultural')}</h2>
        <p class="agenda-card-place">${escapeHtml([event.local, event.cidade].filter(Boolean).join(' • ') || 'Local não informado')}</p>
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
    return article;
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
    const source = document.createElement('p');
    source.className = 'film-source-notice';
    const platform = String(state.filmsData?.fonte || 'plataforma oficial').trim();
    const site = safeExternalUrl(state.filmsData?.fonte_site);
    source.append(document.createTextNode('Filmes disponibilizados gratuitamente pelo '));
    if (site) {
      const link = document.createElement('a');
      link.href = site;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = platform;
      source.append(link);
    } else {
      source.append(document.createTextNode(platform));
    }
    source.append(document.createTextNode('. O Mural Cultural não hospeda os vídeos.'));
    return source;
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
    document.body.classList.remove('panel-mode');

    normalizeAgendaFiltersForContent();

    const results = agendaVisibleContents();
    const activeFilters = agendaActiveFilterCount();
    const header = document.createElement('header');
    header.className = 'agenda-header';
    header.innerHTML = `
      <div class="agenda-heading">
        <img class="agenda-logo" src="imagens/marca/logo-mural-cultural.png" alt="Mural Cultural">
        <p class="agenda-eyebrow">${escapeHtml(agendaSubtitleLabel())}</p>
        <p class="agenda-updated">${escapeHtml(formatUpdated(state.data?.atualizado_em))}</p>
      </div>
      <div class="agenda-header-actions">
        <button class="install-app-btn" type="button" hidden>Instalar app</button>
        <button class="view-toggle" type="button" aria-label="Abrir modo painel">Modo painel</button>
      </div>
    `;

    const controls = document.createElement('section');
    controls.className = `agenda-tools agenda-tools-${state.mobileContent}`;
    controls.setAttribute('aria-label', 'Pesquisar e filtrar conteúdos');

    const contestMode = state.mobileContent === 'contests';
    const filmMode = state.mobileContent === 'films';
    const themeMode = ['events', 'books', 'courses', 'films'].includes(state.mobileContent);
    const searchPlaceholder = contestMode
      ? 'Órgão, cargo, cidade, formação…'
      : state.mobileContent === 'courses'
        ? 'Título, instituição, área ou descrição…'
        : state.mobileContent === 'events'
          ? 'Título, local, instituição ou tema…'
        : state.mobileContent === 'books'
          ? 'Título, autor ou tema…'
          : filmMode
            ? 'Título, direção, sinopse, gênero ou tema…'
            : 'Título, autor ou instituição…';
    const themeControl = themeMode ? `
      <label><span>Tema</span><select class="agenda-theme"><option value="">Todos os temas</option></select></label>
    ` : '';
    const commonControls = `
      <label class="agenda-search"><span>Pesquisar</span><input type="search" placeholder="${escapeHtml(searchPlaceholder)}" value="${escapeHtml(state.mobileQuery)}"></label>
      <label><span>Conteúdo</span><select class="agenda-content">
        <option value="all">Todos</option><option value="events">Eventos</option><option value="books">Livros</option><option value="courses">Cursos</option><option value="contests">Concursos</option><option value="films">Filmes</option>
      </select></label>
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

    const bookControls = state.mobileContent === 'books' ? `
      <label><span>Acesso</span><select class="agenda-book-access">
        <option value="">Físico ou virtual</option><option value="physical">Acervo físico</option>
        <option value="virtual">Biblioteca virtual</option><option value="both">Físico e virtual</option>
      </select></label>
    ` : '';

    const contestControls = contestMode ? `
      <label><span>Formação</span><select class="agenda-contest-formation"><option value="">Todas as formações</option></select></label>
      <label><span>UF</span><select class="agenda-contest-uf"><option value="">Todos os estados</option></select></label>
      <label><span>Prazo</span><select class="agenda-contest-deadline">
        <option value="">Todos os prazos</option><option value="com-data">Com data de inscrição</option>
        <option value="sem-data">Sem data informada</option>
      </select></label>
    ` : '';

    const filmControls = filmMode ? `
      <label><span>Gênero</span><select class="agenda-film-genre"><option value="">Todos os gêneros</option></select></label>
      <label><span>Letra</span><select class="agenda-film-letter"><option value="">Todas as letras</option></select></label>
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

    controls.innerHTML = commonControls + eventControls + bookControls + contestControls + filmControls;

    controls.querySelector('.agenda-content').value = state.mobileContent;
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
      controls.querySelector('.agenda-contest-deadline').value = state.mobileContestDeadline;
    } else if (filmMode) {
      populateDynamicSelect(
        controls.querySelector('.agenda-film-genre'),
        'Todos os gêneros',
        filmsContent.options(state.allFilms, 'generos').map(value => [value, value]),
        state.mobileFilmGenre
      );
      populateDynamicSelect(
        controls.querySelector('.agenda-film-letter'),
        'Todas as letras',
        filmsContent.options(state.allFilms, 'letras').map(value => [value, value]),
        state.mobileFilmLetter
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
    count.innerHTML = contestMode ? `
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
      resultsContainer.innerHTML = '<div class="agenda-empty"><h2>Nenhum conteúdo encontrado</h2><p>Tente alterar a busca ou os filtros.</p><button type="button" class="agenda-empty-clear">Limpar filtros</button></div>';
    } else if (state.mobileContent === 'all') {
      const eventsGrid = document.createElement('div');
      eventsGrid.className = 'agenda-section-grid';
      const eventsProgressiveControl = createAgendaProgressiveControl(eventsGrid, results.events, 'events');
      resultsContainer.append(eventsGrid);
      if (eventsProgressiveControl) resultsContainer.append(eventsProgressiveControl);
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

    const shell = document.createElement('div');
    shell.className = 'agenda-shell';
    shell.append(header, controls, count);
    if (filmMode) shell.append(filmSourceNotice());
    shell.append(resultsContainer);
    app.replaceChildren(shell);

    const installButton = header.querySelector('.install-app-btn');
    installButton.addEventListener('click', installApp);
    refreshInstallButtons();

    header.querySelector('.view-toggle').addEventListener('click', () => {
      resetAgendaBatches();
      saveViewMode('painel');
      state.isPaused = false;
      renderCurrentView();
    });

    const rerender = () => {
      resetAgendaBatches();
      renderAgenda();
    };
    controls.querySelector('.agenda-search input').addEventListener('input', event => {
      state.mobileQuery = event.target.value;
      window.clearTimeout(state.mobileSearchTimer);
      state.mobileSearchTimer = window.setTimeout(rerender, 180);
    });
    controls.querySelector('.agenda-content').addEventListener('change', event => {
      normalizeAgendaFiltersForContent(event.target.value);
      rerender();
    });
    controls.querySelector('.agenda-theme')?.addEventListener('change', event => { state.mobileTheme = event.target.value; rerender(); });

    if (state.mobileContent === 'events') {
      controls.querySelector('.agenda-period').addEventListener('change', event => { state.mobilePeriod = event.target.value; rerender(); });
      controls.querySelector('.agenda-category').addEventListener('change', event => { state.mobileCategory = event.target.value; rerender(); });
      controls.querySelector('.agenda-city').addEventListener('change', event => { state.mobileCity = event.target.value; rerender(); });
      controls.querySelector('.agenda-space').addEventListener('change', event => { state.mobileSpace = event.target.value; rerender(); });
      controls.querySelector('.agenda-institution').addEventListener('change', event => { state.mobileInstitution = event.target.value; rerender(); });
      controls.querySelector('.agenda-registration').addEventListener('change', event => { state.mobileRegistration = event.target.value; rerender(); });
    } else if (state.mobileContent === 'books') {
      controls.querySelector('.agenda-book-access').addEventListener('change', event => { state.mobileBookAccess = event.target.value; rerender(); });
    } else if (contestMode) {
      controls.querySelector('.agenda-contest-formation').addEventListener('change', event => { state.mobileContestFormation = event.target.value; rerender(); });
      controls.querySelector('.agenda-contest-uf').addEventListener('change', event => { state.mobileContestUf = event.target.value; rerender(); });
      controls.querySelector('.agenda-contest-deadline').addEventListener('change', event => { state.mobileContestDeadline = event.target.value; rerender(); });
    } else if (filmMode) {
      controls.querySelector('.agenda-film-genre').addEventListener('change', event => { state.mobileFilmGenre = event.target.value; rerender(); });
      controls.querySelector('.agenda-film-letter').addEventListener('change', event => { state.mobileFilmLetter = event.target.value; rerender(); });
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

    count.querySelector('.agenda-clear-filters')?.addEventListener('click', () => {
      if (contestMode) clearContestAgendaFilters();
      else if (filmMode) clearFilmAgendaFilters();
      else clearAgendaFilters();
      rerender();
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
    button.title = 'Modo agenda';
    button.setAttribute('aria-label', 'Abrir modo agenda');
    button.textContent = '☷';
    button.addEventListener('click', () => {
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
    document.body.classList.remove('agenda-mode');
    document.body.classList.add('panel-mode');
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

  async function load() {
    try {
      const [response, booksData, coursesData, contestsData, filmsData, config] = await Promise.all([
        fetch(`${DATA_URL}?v=${Date.now()}`, { cache: 'no-store' }),
        loadOptionalJson(BOOKS_URL, { livros: [] }),
        loadOptionalJson(COURSES_URL, { cursos: [] }),
        loadOptionalJson(CONTESTS_URL, { concursos: [] }),
        loadOptionalJson(FILMS_URL, { filmes: [] }),
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
      state.booksData = booksData && Array.isArray(booksData.livros) ? booksData : { livros: [] };
      state.coursesData = coursesData && Array.isArray(coursesData.cursos) ? coursesData : { cursos: [] };
      state.contestsData = contestsData && Array.isArray(contestsData.concursos)
        ? contestsData
        : { concursos: [] };
      state.filmsData = filmsData && Array.isArray(filmsData.filmes) ? filmsData : { filmes: [] };
      state.config = config || {};
      state.allEvents = filterAndSort(data.eventos).map(event => ({ ...event, tipo_conteudo: 'evento' }));
      state.allBooks = (state.booksData.livros || []).map(book => ({ ...book, tipo_conteudo: 'livro' }));
      state.allCourses = (state.coursesData.cursos || []).map(course => ({ ...course, tipo_conteudo: 'curso' }));
      state.allContests = (state.contestsData.concursos || [])
        .filter(contestsContent.isValid)
        .map(contest => ({
          ...contestsContent.publicRecord(contest),
          tipo_conteudo: 'concurso'
        }));
      state.allFilms = (state.filmsData.filmes || []).map(movie => ({
        ...movie,
        tipo_conteudo: 'filme'
      }));
      state.schoolRotationBatch = readStoredSchoolBatch();
      loadStoredPanelSettings();
      rebuildVisibleItems();

      if (!state.events.length) {
        showMessage('empty', 'Nenhum conteúdo disponível', 'A programação será atualizada em breve.');
        return;
      }

      state.viewMode = storedViewMode();
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
      } else if (state.events.length && !state.isPaused) {
        renderSlide(state.index);
      }
    }
  );

  let resizeFitTimer = null;
  window.addEventListener('resize', () => {
    if (state.viewMode === 'auto' && state.data) {
      renderCurrentView();
      return;
    }
    clearTimeout(resizeFitTimer);
    resizeFitTimer = setTimeout(() => {
      const currentBookSlide = app.querySelector('.book-slide');
      if (currentBookSlide) fitBookCopy(currentBookSlide);
    }, 120);
  });



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

  // Adicionar listeners de teclado
  document.addEventListener('keydown', handleKeyPress);

  load();
})();
