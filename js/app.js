(() => {
  'use strict';

  const DATA_URL = 'eventos.json';
  const BOOKS_URL = 'livros.json';
  const CONFIG_URL = 'configuracao-mural.json';
  const app = document.getElementById('app');
  const SCHOOL_ROTATION_SIZE = 6;
  const SCHOOL_ROTATION_KEY = 'agenda-cultural-escola-livre-lote';
  const SLIDE_DURATION_KEY = 'mural-cultural-tempo-slides';
  const ALLOWED_SLIDE_DURATIONS = new Set([0, 5, 8, 10, 12, 15, 20, 30]);
  const CONTENT_SUBTITLES = Object.freeze({
    evento: 'Agenda Cultural',
    livro: 'Sugestão de Leitura',
    filme: 'Sugestão de Filme',
    jogo: 'Sugestão de Jogo',
    passeio: 'Sugestão de Passeio'
  });
  const template = document.getElementById('slide-template');
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
    config: null,
    allEvents: [],
    allBooks: [],
    events: [],
    index: 0,
    timer: null,
    isPaused: false,
    btnNext: null,
    btnPrev: null,
    btnPlayPause: null,
    btnFilter: null,
    filterOverlay: null,
    panelMoreFiltersOpen: false,
    filters: {
      content: 'all',
      theme: '',
      city: '',
      category: '',
      program: '',
      unit: '',
      period: 'all',
      rating: '',
      bookAccess: ''
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
    mobileBookAccess: ''
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

  function bookMatchesFilters(book) {
    const theme = state.filters.theme;
    const access = state.filters.bookAccess;
    const themes = (Array.isArray(book.temas) ? book.temas : [])
      .map(normalizeText);
    if (theme && !themes.some(value => value === theme || value.includes(theme))) return false;
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

  function interleaveContents(events, books, eventsPerBook) {
    if (!books.length) return events;
    if (!events.length) return books;
    const interval = Math.max(1, Number(eventsPerBook) || 9);
    const combined = [];
    let bookIndex = 0;
    for (let i = 0; i < events.length; i += 1) {
      combined.push(events[i]);
      if ((i + 1) % interval === 0) {
        combined.push(books[bookIndex % books.length]);
        bookIndex += 1;
      }
    }
    if (!combined.some(item => item.tipo_conteudo === 'livro')) {
      combined.push(books[0]);
    }
    return combined;
  }

  function hasEventFilters() {
    return Boolean(
      state.filters.theme || state.filters.city || state.filters.category || state.filters.program ||
      state.filters.unit || state.filters.rating || state.filters.period !== 'all'
    );
  }

  function visibleEventsForFilters() {
    return hasEventFilters()
      ? applyUserFilters(eventsAvailableForCurrentFilters(state.allEvents))
      : buildDefaultEvents(state.allEvents);
  }

  function rebuildVisibleItems() {
    const content = state.filters.content || 'all';
    const events = content === 'books' ? [] : visibleEventsForFilters();
    const booksEnabled = state.config?.modulos?.livros !== false;
    const books = content === 'events' || !booksEnabled
      ? []
      : filterBooks(state.allBooks);
    if (content === 'events') state.events = events;
    else if (content === 'books') state.events = books;
    else state.events = interleaveContents(
      events, books, state.config?.proporcao?.eventos_por_livro || 5
    );
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
      state.filters.content !== 'all' || state.filters.theme ||
      state.filters.city || state.filters.category || state.filters.program ||
      state.filters.unit || state.filters.rating || state.filters.period !== 'all' ||
      state.filters.bookAccess
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
    const ordinary = events.filter(event =>
      event.exibicao_padrao !== false &&
      event.grupo_rotativo !== 'escola_livre_unidades'
    );
    const rotating = schoolRotationRecords(events)
      .filter(event => event.exibicao_padrao !== false)
      .sort((a, b) => String(a.unidade || a.local || a.titulo || '')
        .localeCompare(String(b.unidade || b.local || b.titulo || ''), 'pt-BR'));

    if (!rotating.length) return ordinary;

    const batches = Math.ceil(rotating.length / SCHOOL_ROTATION_SIZE);
    state.schoolRotationBatch %= batches;
    const start = state.schoolRotationBatch * SCHOOL_ROTATION_SIZE;
    const selected = rotating.slice(start, start + SCHOOL_ROTATION_SIZE);

    return filterAndSort([...ordinary, ...selected]);
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

  function universalThemeOptions() {
    const values = new Map();
    const add = label => {
      const text = String(label || '').trim();
      const value = normalizeText(text);
      if (text && value && !values.has(value)) values.set(value, text);
    };
    for (const event of state.allEvents) eventThemeLabels(event).forEach(add);
    for (const book of state.allBooks) (Array.isArray(book.temas) ? book.temas : []).forEach(add);
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
    const { theme, city, category, program, unit, period, rating } = state.filters;

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
      if (city && normalizeText(event.cidade) !== city) return false;
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
    const content = state.filters.content || 'all';
    const common = [
      content !== 'all' ? content : '',
      state.filters.theme
    ];
    const eventSpecific = content === 'events'
      ? [state.filters.city, state.filters.category, state.filters.program, state.filters.unit]
      : [];
    const bookSpecific = content === 'books' ? [state.filters.bookAccess] : [];
    return [...common, ...eventSpecific, ...bookSpecific].filter(Boolean).length;
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
    const defaultSeconds = item?.tipo_conteudo === 'livro'
      ? state.config?.tempo_slide?.livro
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

    buildQr(
      slide.querySelector('.qr-code'),
      link
    );

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
    const callText = String(book.numero_chamada || '').trim();
    copy.querySelector('.book-call').textContent = callText;

    const accessLabels = [];
    if (book.acesso_fisico) accessLabels.push('Físico');
    if (book.acesso_virtual) accessLabels.push('Virtual');
    copy.querySelector('.book-access').textContent = accessLabels.join(' + ') || 'Catálogo';
    const availability = [];
    if (book.acesso_fisico) {
      const count = Number(book.exemplares_fisicos_catalogados || 0);
      availability.push(`${count} ${count === 1 ? 'exemplar físico catalogado' : 'exemplares físicos catalogados'}`);
      if (Number(book.outras_edicoes_fisicas || 0) > 0) {
        availability.push(`+ ${book.outras_edicoes_fisicas} outra${Number(book.outras_edicoes_fisicas) === 1 ? '' : 's'} edição${Number(book.outras_edicoes_fisicas) === 1 ? '' : 'ões'} em Sabará`);
      }
    }
    if (book.acesso_virtual) availability.push('edição virtual');
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
    const physicalUrl = safeExternalUrl(book.link_fisico);
    const virtualUrl = safeExternalUrl(book.link_virtual);
    if (physicalUrl) physicalLink.href = physicalUrl; else physicalLink.remove();
    if (virtualUrl) virtualLink.href = virtualUrl; else virtualLink.remove();
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
      anchor.textContent = book.tipo_link_principal === 'virtual' ? 'Abrir edição virtual' : 'Ver no catálogo da biblioteca';
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      source.replaceChildren(anchor);
    } else {
      source.textContent = 'Consulte a equipe da biblioteca';
    }
    slide.querySelector('.updated').textContent = formatUpdated(state.booksData?.atualizado_em);

    const qrContainer = slide.querySelector('.qr-code');
    if (book.qr_code) {
      const qrImage = document.createElement('img');
      qrImage.src = book.qr_code;
      qrImage.alt = `QR Code para ${book.titulo}`;
      qrImage.onerror = () => buildQr(qrContainer, link);
      qrContainer.replaceChildren(qrImage);
    } else {
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

  function renderSlide(index) {
    const item = state.events[index];
    if (!item) return;
    if (item.tipo_conteudo === 'livro') renderBookSlide(index);
    else renderEventSlide(index);
  }

  function goToNext() {
    const completedCycle = state.index >= state.events.length - 1;
    if (completedCycle && !hasUserFilters()) {
      advanceSchoolRotation(1);
      state.index = 0;
    } else {
      state.index = (state.index + 1) % state.events.length;
    }
    renderSlide(state.index);
  }

  function goToPrevious() {
    const crossedStart = state.index === 0;
    if (crossedStart && !hasUserFilters()) {
      advanceSchoolRotation(-1);
      state.index = Math.max(0, state.events.length - 1);
    } else {
      state.index = (state.index - 1 + state.events.length) % state.events.length;
    }
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
      ? `Filtrar conteúdos: ${count} filtro${count === 1 ? '' : 's'} ativo${count === 1 ? '' : 's'}`
      : 'Filtrar conteúdos';

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

  function populateFilterPanel(slide) {
    const contentSelect = slide.querySelector('.filter-content');
    const themeSelect = slide.querySelector('.filter-theme');
    const citySelect = slide.querySelector('.filter-city');
    const categorySelect = slide.querySelector('.filter-category');
    const programSelect = slide.querySelector('.filter-program');
    const unitSelect = slide.querySelector('.filter-unit');
    const bookAccessSelect = slide.querySelector('.filter-book-access');
    const durationSelect = slide.querySelector('.filter-slide-duration');

    if (contentSelect) contentSelect.value = state.filters.content || 'all';
    if (durationSelect) durationSelect.value = String(state.slideDuration || 0);

    populateDynamicSelect(
      themeSelect,
      'Todos os temas',
      universalThemeOptions(),
      state.filters.theme
    );

    populateDynamicSelect(
      citySelect,
      'Todas as cidades',
      uniqueFilterOptions(state.allEvents, 'cidade'),
      state.filters.city
    );

    const categoryValues = new Map(uniqueFilterOptions(state.allEvents, 'categoria'));
    for (const event of state.allEvents) {
      for (const label of [event.area_artistica, ...(Array.isArray(event.areas) ? event.areas : [])]) {
        const value = normalizeText(label);
        if (label && value && !categoryValues.has(value)) categoryValues.set(value, label);
      }
    }
    populateDynamicSelect(
      categorySelect,
      'Todas as categorias e linguagens',
      [...categoryValues.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR')),
      state.filters.category
    );

    populateDynamicSelect(
      programSelect,
      'Todas as instituições e programas',
      uniqueFilterOptions(state.allEvents.map(event => ({ programa: eventProgram(event) })), 'programa'),
      state.filters.program
    );

    populateDynamicSelect(
      unitSelect,
      'Todos os espaços',
      uniqueFilterOptions(state.allEvents.map(event => ({ unidade: eventUnit(event) })), 'unidade'),
      state.filters.unit
    );

    if (bookAccessSelect) bookAccessSelect.value = state.filters.bookAccess || '';
    updateFilterFieldVisibility(slide);
  }

  function updateFilterFieldVisibility(slide) {
    const content = slide.querySelector('.filter-content')?.value || 'all';
    const toggle = slide.querySelector('.filter-more-toggle');
    const canShowMore = content === 'events' || content === 'books';

    if (toggle) {
      const wrap = toggle.closest('.filter-more-wrap');
      if (wrap) wrap.hidden = !canShowMore;
      toggle.hidden = !canShowMore;
      toggle.textContent = state.panelMoreFiltersOpen ? 'Menos filtros' : 'Mais filtros';
      toggle.setAttribute('aria-expanded', String(canShowMore && state.panelMoreFiltersOpen));
    }

    slide.querySelectorAll('.event-filter-field').forEach(field => {
      field.hidden = !(content === 'events' && state.panelMoreFiltersOpen);
    });
    slide.querySelectorAll('.book-filter-field').forEach(field => {
      field.hidden = !(content === 'books' && state.panelMoreFiltersOpen);
    });
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

    if (!state.isPaused) {
      scheduleNextSlide();
    }
  }

  function showFilteredEmpty() {
    clearTimeout(state.timer);

    app.innerHTML = `
      <section class="empty filtered-empty">
        <div>
          <h1>Nenhum conteúdo encontrado</h1>
          <p>Não há eventos ou livros que correspondam aos filtros selecionados.</p>
          <button class="empty-clear-filters" type="button">Limpar filtros</button>
        </div>
      </section>
    `;

    app.querySelector('.empty-clear-filters')?.addEventListener('click', () => {
      state.filters = { content: 'all', theme: '', city: '', category: '', program: '', unit: '', period: 'all', rating: '', bookAccess: '' };
      state.panelMoreFiltersOpen = false;
      rebuildVisibleItems();
      state.index = 0;
      renderSlide(0);
    });
  }

  function applyFiltersFromPanel() {
    if (!state.filterOverlay) return;

    saveSlideDuration(state.filterOverlay.querySelector('.filter-slide-duration')?.value || 0);

    const content = state.filterOverlay.querySelector('.filter-content')?.value || 'all';
    state.filters = {
      content,
      theme: state.filterOverlay.querySelector('.filter-theme')?.value || '',
      city: content === 'events' ? state.filterOverlay.querySelector('.filter-city')?.value || '' : '',
      category: content === 'events' ? state.filterOverlay.querySelector('.filter-category')?.value || '' : '',
      program: content === 'events' ? state.filterOverlay.querySelector('.filter-program')?.value || '' : '',
      unit: content === 'events' ? state.filterOverlay.querySelector('.filter-unit')?.value || '' : '',
      period: 'all',
      rating: '',
      bookAccess: content === 'books' ? state.filterOverlay.querySelector('.filter-book-access')?.value || '' : ''
    };

    rebuildVisibleItems();
    state.index = 0;

    if (!state.events.length) {
      showFilteredEmpty();
      return;
    }

    renderCurrentView();
  }

  function clearUserFilters() {
    state.filters = { content: 'all', theme: '', city: '', category: '', program: '', unit: '', period: 'all', rating: '', bookAccess: '' };
    state.panelMoreFiltersOpen = false;
    rebuildVisibleItems();
    state.index = 0;
    renderCurrentView();
  }

  function setupFilterPanel(slide) {
    populateFilterPanel(slide);

    const overlay = slide.querySelector('.filter-overlay');
    const closeButton = slide.querySelector('.filter-close');
    const applyButton = slide.querySelector('.filter-apply');
    const clearButton = slide.querySelector('.filter-clear');

    closeButton?.addEventListener('click', closeFilterPanel);
    applyButton?.addEventListener('click', applyFiltersFromPanel);
    clearButton?.addEventListener('click', clearUserFilters);
    slide.querySelector('.filter-content')?.addEventListener('change', () => {
      state.panelMoreFiltersOpen = false;
      updateFilterFieldVisibility(slide);
    });
    slide.querySelector('.filter-more-toggle')?.addEventListener('click', () => {
      state.panelMoreFiltersOpen = !state.panelMoreFiltersOpen;
      updateFilterFieldVisibility(slide);
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
    if (content !== 'books') {
      for (const event of state.allEvents) eventThemeLabels(event).forEach(add);
    }
    if (content !== 'events') {
      for (const book of state.allBooks) (Array.isArray(book.temas) ? book.temas : []).forEach(add);
    }
    return [...values.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
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

  function agendaEventSource() {
    const needsDetailedRecords = Boolean(
      state.mobileQuery || state.mobileTheme || state.mobileCategory || state.mobileSpace
    );
    return needsDetailedRecords ? state.allEvents : buildDefaultEvents(state.allEvents);
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
    const haystack = normalizeText([
      book.titulo, book.autor, book.pergunta_curiosidade,
      book.texto_apoio, ...(Array.isArray(book.temas) ? book.temas : [])
    ].filter(Boolean).join(' '));
    return haystack.includes(query);
  }

  function agendaVisibleEvents() {
    if (state.mobileContent === 'books') return [];
    const query = normalizeText(state.mobileQuery);
    const specific = state.mobileContent === 'events';
    return agendaEventSource().filter(event => {
      if (event.exibicao_por_filtro === false && (state.mobileQuery || state.mobileTheme || state.mobileCategory || state.mobileSpace)) {
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
    if (state.mobileContent === 'events' || state.config?.modulos?.livros === false) return [];
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

  function agendaVisibleContents() {
    const events = agendaVisibleEvents();
    const books = agendaVisibleBooks();
    return { events, books, total: events.length + books.length };
  }

  function agendaActiveFilterCount() {
    const common = [state.mobileQuery, state.mobileTheme];
    if (state.mobileContent !== 'all') common.push(state.mobileContent);
    if (state.mobileContent === 'events') {
      common.push(
        state.mobilePeriod !== 'all' ? state.mobilePeriod : '',
        state.mobileCategory, state.mobileCity, state.mobileSpace,
        state.mobileInstitution, state.mobileRegistration
      );
    } else if (state.mobileContent === 'books') {
      common.push(state.mobileBookAccess);
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
    return 'Descobertas culturais';
  }

  function renderAgendaCard(item) {
    const article = document.createElement('article');
    article.className = `agenda-card ${item.tipo_conteudo === 'livro' ? 'agenda-book-card' : ''}`;

    if (item.tipo_conteudo === 'livro') {
      const link = safeExternalUrl(item.link || item.link_fisico || item.link_virtual);
      article.innerHTML = `
        <div class="agenda-card-media book-media"><img src="${escapeHtml(item.imagem || '')}" alt="Capa: ${escapeHtml(item.titulo || '')}" loading="lazy"></div>
        <div class="agenda-card-body">
          <div class="agenda-card-badges"><span>Livro</span>${item.acesso_fisico ? '<span>Físico</span>' : ''}${item.acesso_virtual ? '<span>Virtual</span>' : ''}</div>
          <p class="agenda-card-date">Sugestão de Leitura</p>
          <h2>${escapeHtml(item.pergunta_curiosidade || item.titulo || 'Livro')}</h2>
          <p class="agenda-card-place"><strong class="agenda-book-title">${escapeHtml(item.titulo || '')}</strong> · ${escapeHtml(item.autor || '')}</p>
          <p class="agenda-card-description">${escapeHtml(item.texto_apoio || '')}</p>
          ${item.numero_chamada ? `<p class="agenda-card-call">Número de chamada: ${escapeHtml(item.numero_chamada)}</p>` : ''}
          ${item.exibir_comentario && item.comentario_aprovado ? `<blockquote class="agenda-book-opinion">“${escapeHtml(item.comentario_aprovado)}”<cite>${escapeHtml(item.credito_comentario || 'Leitor(a) do IFMG')}</cite></blockquote>` : ''}
          <div class="agenda-card-actions">
            ${link ? `<a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">Encontrar este livro</a>` : ''}
            ${item.link_virtual ? `<a class="secondary" href="${escapeHtml(item.link_virtual)}" target="_blank" rel="noopener noreferrer">Edição virtual</a>` : ''}
            ${state.config?.opinioes_livros?.habilitado === true && safeExternalUrl(item.link_formulario_opiniao || state.config?.opinioes_livros?.url_formulario) ? `<a class="secondary" href="${escapeHtml(safeExternalUrl(item.link_formulario_opiniao || state.config?.opinioes_livros?.url_formulario))}" target="_blank" rel="noopener noreferrer">Opine sobre este livro</a>` : ''}
          </div>
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
    setMobileCardImage(article.querySelector('img'), event);
    return article;
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
    items.forEach(item => grid.append(renderAgendaCard(item)));
    section.append(heading, grid);
    container.append(section);
  }

  function renderAgenda() {
    clearTimeout(state.timer);
    state.isPaused = true;
    document.body.classList.add('agenda-mode');
    document.body.classList.remove('panel-mode');

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

    const commonControls = `
      <label class="agenda-search"><span>Pesquisar</span><input type="search" placeholder="Título, autor, instituição ou tema" value="${escapeHtml(state.mobileQuery)}"></label>
      <label><span>Conteúdo</span><select class="agenda-content">
        <option value="all">Todos</option><option value="events">Eventos</option><option value="books">Livros</option>
      </select></label>
      <label><span>Tema</span><select class="agenda-theme"><option value="">Todos os temas</option></select></label>
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

    controls.innerHTML = commonControls + eventControls + bookControls;

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
    }

    const count = document.createElement('div');
    count.className = 'agenda-count';
    count.innerHTML = `
      <span><strong>${results.total}</strong> ${results.total === 1 ? 'conteúdo encontrado' : 'conteúdos encontrados'}${activeFilters ? ` · ${activeFilters} ${activeFilters === 1 ? 'filtro ativo' : 'filtros ativos'}` : ''}</span>
      ${activeFilters ? '<button type="button" class="agenda-clear-filters">Limpar filtros</button>' : ''}
    `;

    const resultsContainer = document.createElement('div');
    resultsContainer.className = 'agenda-results';
    resultsContainer.setAttribute('aria-label', 'Conteúdos culturais');

    if (!results.total) {
      resultsContainer.innerHTML = '<div class="agenda-empty"><h2>Nenhum conteúdo encontrado</h2><p>Tente alterar a busca ou os filtros.</p></div>';
    } else if (state.mobileContent === 'all') {
      appendAgendaSection(resultsContainer, 'Agenda Cultural', results.events, 'events', 'Ver somente eventos');
      appendAgendaSection(resultsContainer, 'Sugestões de Leitura', results.books, 'books', 'Ver somente livros');
    } else {
      const list = document.createElement('section');
      list.className = 'agenda-list';
      const items = state.mobileContent === 'events' ? results.events : results.books;
      items.forEach(item => list.append(renderAgendaCard(item)));
      resultsContainer.append(list);
    }

    const shell = document.createElement('div');
    shell.className = 'agenda-shell';
    shell.append(header, controls, count, resultsContainer);
    app.replaceChildren(shell);

    const installButton = header.querySelector('.install-app-btn');
    installButton.addEventListener('click', installApp);
    refreshInstallButtons();

    header.querySelector('.view-toggle').addEventListener('click', () => {
      saveViewMode('painel');
      state.isPaused = false;
      renderCurrentView();
    });

    const rerender = () => renderAgenda();
    controls.querySelector('.agenda-search input').addEventListener('input', event => {
      state.mobileQuery = event.target.value;
      window.clearTimeout(state.mobileSearchTimer);
      state.mobileSearchTimer = window.setTimeout(rerender, 180);
    });
    controls.querySelector('.agenda-content').addEventListener('change', event => {
      state.mobileContent = event.target.value;
      const allowedThemes = new Set(agendaThemeOptions(state.mobileContent).map(([value]) => value));
      if (state.mobileTheme && !allowedThemes.has(state.mobileTheme)) state.mobileTheme = '';
      rerender();
    });
    controls.querySelector('.agenda-theme').addEventListener('change', event => { state.mobileTheme = event.target.value; rerender(); });

    if (state.mobileContent === 'events') {
      controls.querySelector('.agenda-period').addEventListener('change', event => { state.mobilePeriod = event.target.value; rerender(); });
      controls.querySelector('.agenda-category').addEventListener('change', event => { state.mobileCategory = event.target.value; rerender(); });
      controls.querySelector('.agenda-city').addEventListener('change', event => { state.mobileCity = event.target.value; rerender(); });
      controls.querySelector('.agenda-space').addEventListener('change', event => { state.mobileSpace = event.target.value; rerender(); });
      controls.querySelector('.agenda-institution').addEventListener('change', event => { state.mobileInstitution = event.target.value; rerender(); });
      controls.querySelector('.agenda-registration').addEventListener('change', event => { state.mobileRegistration = event.target.value; rerender(); });
    } else if (state.mobileContent === 'books') {
      controls.querySelector('.agenda-book-access').addEventListener('change', event => { state.mobileBookAccess = event.target.value; rerender(); });
    }

    count.querySelector('.agenda-clear-filters')?.addEventListener('click', () => {
      clearAgendaFilters();
      rerender();
    });

    resultsContainer.querySelectorAll('.agenda-section-action').forEach(button => {
      button.addEventListener('click', () => {
        state.mobileContent = button.dataset.content || 'all';
        const allowedThemes = new Set(agendaThemeOptions(state.mobileContent).map(([value]) => value));
        if (state.mobileTheme && !allowedThemes.has(state.mobileTheme)) state.mobileTheme = '';
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
      const [response, booksData, config] = await Promise.all([
        fetch(`${DATA_URL}?v=${Date.now()}`, { cache: 'no-store' }),
        loadOptionalJson(BOOKS_URL, { livros: [] }),
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
      state.config = config || {};
      state.allEvents = filterAndSort(data.eventos).map(event => ({ ...event, tipo_conteudo: 'evento' }));
      state.allBooks = (state.booksData.livros || []).map(book => ({ ...book, tipo_conteudo: 'livro' }));
      state.filters.content = state.config?.filtros?.conteudo_padrao || 'all';
      state.schoolRotationBatch = readStoredSchoolBatch();
      rebuildVisibleItems();

      if (!state.events.length) {
        showMessage('empty', 'Nenhum conteúdo disponível', 'A programação será atualizada em breve.');
        return;
      }

      state.viewMode = storedViewMode();
      state.slideDuration = storedSlideDuration();
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
