(() => {
  'use strict';

  const DATA_URL = 'eventos.json';
  const app = document.getElementById('app');
  const template = document.getElementById('slide-template');
  const btnPrev = document.getElementById('btn-prev');
  const btnNext = document.getElementById('btn-next');
  const btnPlayPause = document.getElementById('btn-play-pause');

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
    isPaused: false
  };

  function normalizeText(value = '') {
    return String(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
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

  function formatDate(dateString) {
    const date = safeDate(dateString);

    if (!date) {
      return dateString || 'Data não informada';
    }

    return new Intl.DateTimeFormat('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long'
    })
      .format(date)
      .replace(/^./, char => char.toUpperCase());
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
    updatePlayPauseButton();

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
    const pauseIcon = btnPlayPause.querySelector('.pause-icon');
    const playIcon = btnPlayPause.querySelector('.play-icon');

    if (state.isPaused) {
      pauseIcon.style.display = 'none';
      playIcon.style.display = 'block';
      btnPlayPause.setAttribute('aria-label', 'Reproduzir');
      btnPlayPause.setAttribute('title', 'Reproduzir');
    } else {
      pauseIcon.style.display = 'block';
      playIcon.style.display = 'none';
      btnPlayPause.setAttribute('aria-label', 'Pausar');
      btnPlayPause.setAttribute('title', 'Pausar');
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

    slide.querySelector('.panel-title').textContent =
      data.titulo_painel || 'Agenda Cultural Gratuita';

    slide.querySelector('.period').textContent =
      data.periodo || 'Programação da semana';

    slide.querySelector('.counter').textContent =
      `${index + 1} / ${state.events.length}`;

    slide.querySelector('.category').textContent =
      event.categoria || 'Evento';

    slide.querySelector('.event-title').textContent =
      event.titulo;

    slide.querySelector('.description').textContent =
      event.descricao || '';

    const dateText =
      event.data_fim && event.data_fim !== event.data
        ? `${formatDate(event.data)} a ${formatDate(event.data_fim)}`
        : formatDate(event.data);

    slide.querySelector('.when').textContent =
      `${dateText}${event.horario ? ` • ${event.horario}` : ''}`;

    slide.querySelector('.where').textContent =
      [event.local, event.cidade]
        .filter(Boolean)
        .join(' • ') || 'Local não informado';

    const registrationRow =
      slide.querySelector('.registration-row');

    if (event.inscricao) {
      slide.querySelector('.registration').textContent =
        event.inscricao;
    } else if (registrationRow) {
      registrationRow.remove();
    }

    const link = event.link || '';

    slide.querySelector('.source-url').textContent =
      shortUrl(link) || 'Consulte a equipe da biblioteca';

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
    btnNext.addEventListener('click', goToNext);
    btnPrev.addEventListener('click', goToPrevious);
    btnPlayPause.addEventListener('click', togglePlayPause);
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

      setupControls();
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

  load();
})();
