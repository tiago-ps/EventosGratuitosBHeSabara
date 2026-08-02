(() => {
  'use strict';

  const DATA_URL = 'eventos.json';
  const app = document.getElementById('app');
  const SCHOOL_ROTATION_SIZE = 6;
  const SCHOOL_ROTATION_KEY = 'agenda-cultural-escola-livre-lote';
  const template = document.getElementById('slide-template');

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
    allEvents: [],
    events: [],
    index: 0,
    timer: null,
    isPaused: false,
    btnNext: null,
    btnPrev: null,
    btnPlayPause: null,
    btnFilter: null,
    filterOverlay: null,
    filters: {
      city: '',
      category: '',
      program: '',
      unit: '',
      period: 'all',
      rating: ''
    },
    schoolRotationBatch: 0,
    viewMode: 'auto',
    mobileQuery: '',
    mobileCategory: '',
    mobileCity: '',
    mobilePeriod: 'all'
  };

  function normalizeText(value = '') {
    return String(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
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
    const fallbackTitle = 'Agenda Cultural Gratuita';
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

  function eventIsPublishable(event, today = todayAtMidnight()) {
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
    } else if (period === '7days') {
      rangeEnd = addCalendarDays(today, 6);
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
      state.filters.city ||
      state.filters.category ||
      state.filters.program ||
      state.filters.unit ||
      state.filters.rating ||
      state.filters.period !== 'all'
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
    state.events = buildDefaultEvents(state.allEvents);
  }

  function eventSearchFacets(event) {
    return [
      event.categoria,
      event.area_artistica,
      ...(Array.isArray(event.areas) ? event.areas : []),
      ...(Array.isArray(event.tags) ? event.tags : []),
      event.titulo
    ].map(normalizeText).filter(Boolean);
  }

  function categoryMatches(event, category) {
    if (!category) return true;
    const facets = eventSearchFacets(event);
    return facets.some(value => value === category || value.includes(category));
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
    const { city, category, program, unit, period, rating } = state.filters;

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
    return [
      state.filters.city,
      state.filters.category,
      state.filters.program,
      state.filters.unit,
      state.filters.rating,
      state.filters.period !== 'all' ? state.filters.period : ''
    ].filter(Boolean).length;
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

    const event = state.events[state.index];
    const data = state.data;

    const seconds = Math.max(
      5,
      Number(data.tempo_slide) || 12
    );

    state.timer = setTimeout(goToNext, seconds * 1000);
  }

  function renderSlide(index) {
    clearTimeout(state.timer);

    const event = state.events[index];
    const data = state.data;
    const slide = template.content.firstElementChild.cloneNode(true);

    const visualKey = normalizeText(event.categoria);
    const [icon, label] =
      categoryVisuals[visualKey] || categoryVisuals.default;

    const seconds = Math.max(
      5,
      Number(data.tempo_slide) || 12
    );

    slide.style.setProperty(
      '--slide-seconds',
      `${seconds}s`
    );

    const { mainTitle, citiesTitle } = getPanelTitleParts(
      data.titulo_painel,
      state.events
    );

    slide.querySelector('.panel-title-main').textContent =
      mainTitle;

    const citiesTitleElement =
      slide.querySelector('.panel-title-cities');

    citiesTitleElement.textContent = citiesTitle;
    citiesTitleElement.hidden = !citiesTitle;

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

    const link = event.link || '';
    const sourceUrlElement = slide.querySelector('.source-url');

    if (link) {
      // Criar um link clicável
      const linkElement = document.createElement('a');
      linkElement.href = link;
      linkElement.textContent = shortUrl(link);
      linkElement.target = '_blank';
      linkElement.rel = 'noopener noreferrer';
      sourceUrlElement.replaceChildren(linkElement);
    } else {
      sourceUrlElement.textContent = 'Consulte a equipe da biblioteca';
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
      ? `Filtrar eventos: ${count} filtro${count === 1 ? '' : 's'} ativo${count === 1 ? '' : 's'}`
      : 'Filtrar eventos';

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
    const citySelect = slide.querySelector('.filter-city');
    const categorySelect = slide.querySelector('.filter-category');
    const programSelect = slide.querySelector('.filter-program');
    const unitSelect = slide.querySelector('.filter-unit');
    const periodSelect = slide.querySelector('.filter-period');
    const ratingSelect = slide.querySelector('.filter-rating');

    populateDynamicSelect(
      citySelect,
      'Todas as cidades',
      uniqueFilterOptions(state.allEvents, 'cidade'),
      state.filters.city
    );

    const categoryValues = new Map(uniqueFilterOptions(state.allEvents, 'categoria'));
    for (const event of state.allEvents) {
      for (const label of [event.area_artistica, ...(Array.isArray(event.tags) ? event.tags : [])]) {
        const value = normalizeText(label);
        if (label && value && !categoryValues.has(value)) categoryValues.set(value, label);
      }
    }
    populateDynamicSelect(
      categorySelect,
      'Todas as categorias e áreas',
      [...categoryValues.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR')),
      state.filters.category
    );

    populateDynamicSelect(
      programSelect,
      'Todos os programas',
      uniqueFilterOptions(state.allEvents.map(event => ({ programa: eventProgram(event) })), 'programa'),
      state.filters.program
    );

    populateDynamicSelect(
      unitSelect,
      'Todos os espaços',
      uniqueFilterOptions(state.allEvents.map(event => ({ unidade: eventUnit(event) })), 'unidade'),
      state.filters.unit
    );

    if (periodSelect) periodSelect.value = state.filters.period || 'all';
    if (ratingSelect) ratingSelect.value = state.filters.rating || '';
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
          <h1>Nenhum evento encontrado</h1>
          <p>Não há eventos que correspondam aos filtros selecionados.</p>
          <button class="empty-clear-filters" type="button">Limpar filtros</button>
        </div>
      </section>
    `;

    app.querySelector('.empty-clear-filters')?.addEventListener('click', () => {
      state.filters = { city: '', category: '', program: '', unit: '', period: 'all', rating: '' };
      state.events = buildDefaultEvents(state.allEvents);
      state.index = 0;
      renderSlide(0);
    });
  }

  function applyFiltersFromPanel() {
    if (!state.filterOverlay) return;

    state.filters = {
      city: state.filterOverlay.querySelector('.filter-city')?.value || '',
      category: state.filterOverlay.querySelector('.filter-category')?.value || '',
      program: state.filterOverlay.querySelector('.filter-program')?.value || '',
      unit: state.filterOverlay.querySelector('.filter-unit')?.value || '',
      period: state.filterOverlay.querySelector('.filter-period')?.value || 'all',
      rating: state.filterOverlay.querySelector('.filter-rating')?.value || ''
    };

    state.events = applyUserFilters(eventsAvailableForCurrentFilters(state.allEvents));
    state.index = 0;

    if (!state.events.length) {
      showFilteredEmpty();
      return;
    }

    renderCurrentView();
  }

  function clearUserFilters() {
    state.filters = { city: '', category: '', program: '', unit: '', period: 'all', rating: '' };
    state.events = buildDefaultEvents(state.allEvents);
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
    return [
      String(event.imagem || '').trim(),
      getLocalImage(event),
      getProgramImage(event)
    ].filter(Boolean);
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

  function mobileVisibleEvents() {
    const query = normalizeText(state.mobileQuery);
    return state.events.filter(event => {
      if (state.mobileCity && normalizeText(event.cidade) !== state.mobileCity) return false;
      if (state.mobileCategory && !categoryMatches(event, state.mobileCategory)) return false;
      if (!eventMatchesPeriod(event, state.mobilePeriod)) return false;
      if (!query) return true;
      const haystack = normalizeText([
        event.titulo, event.descricao, event.local, event.cidade,
        event.categoria, event.area_artistica, event.programa, event.fonte
      ].filter(Boolean).join(' '));
      return haystack.includes(query);
    });
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

  function renderAgenda() {
    clearTimeout(state.timer);
    state.isPaused = true;
    document.body.classList.add('agenda-mode');
    document.body.classList.remove('panel-mode');

    const events = mobileVisibleEvents();
    const header = document.createElement('header');
    header.className = 'agenda-header';
    header.innerHTML = `
      <div class="agenda-heading">
        <p class="agenda-eyebrow">Belo Horizonte e Sabará</p>
        <h1>Agenda Cultural Gratuita</h1>
        <p class="agenda-updated">${formatUpdated(state.data?.atualizado_em)}</p>
      </div>
      <button class="view-toggle" type="button" aria-label="Abrir modo painel">Modo painel</button>
    `;

    const controls = document.createElement('section');
    controls.className = 'agenda-tools';
    controls.setAttribute('aria-label', 'Pesquisar e filtrar eventos');
    controls.innerHTML = `
      <label class="agenda-search"><span>Pesquisar</span><input type="search" placeholder="Evento, local ou atividade" value="${String(state.mobileQuery).replaceAll('"', '&quot;')}"></label>
      <label><span>Período</span><select class="agenda-period">
        <option value="all">Todos os eventos futuros</option><option value="today">Hoje</option>
        <option value="tomorrow">Amanhã</option><option value="7days">Próximos 7 dias</option>
      </select></label>
      <label><span>Categoria</span><select class="agenda-category"><option value="">Todas</option></select></label>
      <label><span>Cidade</span><select class="agenda-city"><option value="">Todas</option></select></label>
    `;

    const category = controls.querySelector('.agenda-category');
    const categoryMap = new Map(mobileSelectOptions(state.allEvents, 'categoria'));
    for (const event of state.allEvents) {
      for (const label of [event.area_artistica, ...(Array.isArray(event.areas) ? event.areas : [])]) {
        const value = normalizeText(label);
        if (label && value && !categoryMap.has(value)) categoryMap.set(value, label);
      }
    }
    for (const [value, label] of [...categoryMap.entries()].sort((a,b)=>a[1].localeCompare(b[1], 'pt-BR'))) {
      category.add(new Option(label, value));
    }
    const city = controls.querySelector('.agenda-city');
    for (const [value, label] of mobileSelectOptions(state.allEvents, 'cidade')) city.add(new Option(label, value));
    controls.querySelector('.agenda-period').value = state.mobilePeriod;
    category.value = state.mobileCategory;
    city.value = state.mobileCity;

    const count = document.createElement('p');
    count.className = 'agenda-count';
    count.textContent = `${events.length} ${events.length === 1 ? 'evento encontrado' : 'eventos encontrados'}`;

    const list = document.createElement('section');
    list.className = 'agenda-list';
    list.setAttribute('aria-label', 'Eventos');

    if (!events.length) {
      list.innerHTML = '<div class="agenda-empty"><h2>Nenhum evento encontrado</h2><p>Tente alterar a busca ou os filtros.</p></div>';
    }

    for (const event of events) {
      const article = document.createElement('article');
      article.className = 'agenda-card';
      const link = safeExternalUrl(event.link || event.pagina);
      const map = safeExternalUrl(event.mapa);
      const rating = normalizeRating(event.classificacao_indicativa);
      article.innerHTML = `
        <div class="agenda-card-media"><img></div>
        <div class="agenda-card-body">
          <div class="agenda-card-badges">
            <span>${event.categoria || 'Evento'}</span><span>Gratuito</span>${rating ? `<span>${rating.label}</span>` : ''}
          </div>
          <p class="agenda-card-date">${mobileDateLabel(event)}${event.horario ? ` • ${event.horario}` : ''}</p>
          <h2>${event.titulo || 'Evento cultural'}</h2>
          <p class="agenda-card-place">${[event.local, event.cidade].filter(Boolean).join(' • ') || 'Local não informado'}</p>
          <p class="agenda-card-description">${event.descricao || ''}</p>
          <div class="agenda-card-actions">
            ${link ? `<a href="${link}" target="_blank" rel="noopener noreferrer">Programação e inscrição</a>` : ''}
            ${map ? `<a class="secondary" href="${map}" target="_blank" rel="noopener noreferrer">Como chegar</a>` : ''}
          </div>
        </div>`;
      setMobileCardImage(article.querySelector('img'), event);
      list.append(article);
    }

    const shell = document.createElement('div');
    shell.className = 'agenda-shell';
    shell.append(header, controls, count, list);
    app.replaceChildren(shell);

    header.querySelector('.view-toggle').addEventListener('click', () => {
      saveViewMode('painel');
      state.isPaused = false;
      renderCurrentView();
    });
    const rerender = () => renderAgenda();
    controls.querySelector('input').addEventListener('input', event => {
      state.mobileQuery = event.target.value;
      window.clearTimeout(state.mobileSearchTimer);
      state.mobileSearchTimer = window.setTimeout(rerender, 180);
    });
    controls.querySelector('.agenda-period').addEventListener('change', event => { state.mobilePeriod = event.target.value; rerender(); });
    category.addEventListener('change', event => { state.mobileCategory = event.target.value; rerender(); });
    city.addEventListener('change', event => { state.mobileCity = event.target.value; rerender(); });
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

  async function load() {
    try {
      const response = await fetch(
        `${DATA_URL}?v=${Date.now()}`,
        {
          cache: 'no-store'
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!data || !Array.isArray(data.eventos)) {
        throw new Error('Formato inválido');
      }

      state.data = data;
      state.allEvents = filterAndSort(data.eventos);
      state.schoolRotationBatch = readStoredSchoolBatch();
      state.events = buildDefaultEvents(state.allEvents);

      if (!state.events.length) {
        showMessage(
          'empty',
          'Nenhum evento futuro',
          'A programação será atualizada em breve.'
        );

        return;
      }

      state.viewMode = storedViewMode();
      renderCurrentView();

    } catch (error) {
      console.error(error);

      showMessage(
        'error',
        'Não foi possível carregar a agenda',
        'Verifique se o arquivo eventos.json contém um JSON válido.'
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

  window.addEventListener('resize', () => {
    if (state.viewMode === 'auto' && state.data) renderCurrentView();
  });

  // Adicionar listeners de teclado
  document.addEventListener('keydown', handleKeyPress);

  load();
})();
