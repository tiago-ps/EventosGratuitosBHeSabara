(() => {
  'use strict';

  const DATA_URL = 'eventos.json';
  const app = document.getElementById('app');
  const template = document.getElementById('slide-template');

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

  let state = {
    data: null,
    events: [],
    index: 0,
    timer: null,
    isPaused: false,
    btnNext: null,
    btnPrev: null,
    btnPlayPause: null
  };

  function normalizeText(value = '') {
    return String(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
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

  function eventEndDate(event) {
    return safeDate(event.data_fim || event.data);
  }

  function filterAndSort(events) {
    const today = todayAtMidnight();

    return events
      .filter(event => event && event.titulo && event.data)
      .filter(event => {
        const end = eventEndDate(event);
        return !end || end >= today;
      })
      .sort((a, b) => {
        const da = safeDate(a.data)?.getTime() || 0;
        const db = safeDate(b.data)?.getTime() || 0;

        return da - db ||
          String(a.horario || '').localeCompare(
            String(b.horario || ''),
            'pt-BR'
          );
      });
  }

  function formatDateParts(dateString) {
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

    const formattedDate = new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'long'
    }).format(date);

    return {
      weekday,
      date: formattedDate
    };
  }

  function appendWhenDate(container, dateString, prefix = '') {
    const parts = formatDateParts(dateString);

    if (prefix) {
      container.append(document.createTextNode(prefix));
    }

    if (parts.weekday) {
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

    appendWhenDate(container, event.data);

    if (event.data_fim && event.data_fim !== event.data) {
      appendWhenDate(container, event.data_fim, ' a ');
    }

    if (event.horario) {
      const time = document.createElement('span');
      time.className = 'when-time';
      time.textContent = ` • ${event.horario}`;
      container.append(time);
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

    state.timer = setTimeout(() => {
      state.index = (state.index + 1) % state.events.length;
      renderSlide(state.index);
    }, seconds * 1000);
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
      `${index + 1} / ${state.events.length}`;

    slide.querySelector('.category').textContent =
      event.categoria || 'Evento';

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

    slide.querySelector('.where').textContent =
      [event.local, event.cidade]
        .filter(Boolean)
        .join(' • ') || 'Local não informado';

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

    if (event.imagem) {
      image.onerror = () => {
        image.removeAttribute('src');

        /*
         * Se a imagem específica do evento falhar,
         * tenta a imagem padrão do local.
         */
        if (localImage) {
          image.onerror = () => {
            image.removeAttribute('src');
            showIframe();
          };

          loadImage(localImage, 'local');
          return;
        }

        /*
         * Sem imagem padrão do local,
         * tenta abrir a página oficial.
         */
        showIframe();
      };

      loadImage(event.imagem, 'event');

    } else if (localImage) {
      /*
       * Quando não há imagem específica do evento,
       * usa primeiro a imagem padrão do local.
       */
      image.onerror = () => {
        image.removeAttribute('src');
        showIframe();
      };

      loadImage(localImage, 'local');

    } else {
      /*
       * Sem imagem do evento e sem imagem do local,
       * tenta incorporar a página oficial.
       */
      showIframe();
    }

    app.replaceChildren(slide);

    // Atualizar referências dos botões após renderizar o slide
    state.btnNext = slide.querySelector('.next-btn');
    state.btnPrev = slide.querySelector('.prev-btn');
    state.btnPlayPause = slide.querySelector('.play-pause-btn');

    // Reconfigurar event listeners
    setupControls();
    updatePlayPauseButton();

    scheduleNextSlide();
  }

  function goToNext() {
    state.index = (state.index + 1) % state.events.length;
    renderSlide(state.index);
  }

  function goToPrevious() {
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
  }

  function handleKeyPress(event) {
    // Verificar se o usuário está digitando em um input/textarea
    if (
      event.target.tagName === 'INPUT' ||
      event.target.tagName === 'TEXTAREA'
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
      state.events = filterAndSort(data.eventos);

      if (!state.events.length) {
        showMessage(
          'empty',
          'Nenhum evento futuro',
          'A programação será atualizada em breve.'
        );

        return;
      }

      renderSlide(0);

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

  // Adicionar listeners de teclado
  document.addEventListener('keydown', handleKeyPress);

  load();
})();
