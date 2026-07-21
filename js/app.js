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

  let state = { data: null, events: [], index: 0, timer: null };

  function normalizeText(value = '') {
    return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  function safeDate(dateString) {
    if (!dateString) return null;
    const date = new Date(`${dateString}T23:59:59`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function todayAtMidnight() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
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
        return da - db || String(a.horario || '').localeCompare(String(b.horario || ''), 'pt-BR');
      });
  }

  function formatDate(dateString) {
    const date = safeDate(dateString);
    if (!date) return dateString || 'Data não informada';
    return new Intl.DateTimeFormat('pt-BR', {
      weekday: 'long', day: '2-digit', month: 'long'
    }).format(date).replace(/^./, char => char.toUpperCase());
  }

  function formatUpdated(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return `Atualizado em ${value}`;
    return `Atualizado em ${new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }).format(date)}`;
  }

  function shortUrl(url) {
    try {
      const parsed = new URL(url);
      return `${parsed.hostname.replace(/^www\./, '')}${parsed.pathname === '/' ? '' : parsed.pathname}`;
    } catch {
      return url || '';
    }
  }

  function showMessage(type, title, text) {
    clearTimeout(state.timer);
    app.innerHTML = `<section class="${type}"><div><h1>${title}</h1><p>${text}</p></div></section>`;
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

  function renderSlide(index) {
    clearTimeout(state.timer);
    const event = state.events[index];
    const data = state.data;
    const slide = template.content.firstElementChild.cloneNode(true);

    const visualKey = normalizeText(event.categoria);
    const [icon, label] = categoryVisuals[visualKey] || categoryVisuals.default;

    slide.style.setProperty('--slide-seconds', `${Math.max(5, Number(data.tempo_slide) || 12)}s`);
    slide.querySelector('.panel-title').textContent = data.titulo_painel || 'Agenda Cultural Gratuita';
    slide.querySelector('.period').textContent = data.periodo || 'Programação da semana';
    slide.querySelector('.counter').textContent = `${index + 1} / ${state.events.length}`;
    slide.querySelector('.category').textContent = event.categoria || 'Evento';
    slide.querySelector('.event-title').textContent = event.titulo;
    slide.querySelector('.description').textContent = event.descricao || '';

    const dateText = event.data_fim && event.data_fim !== event.data
      ? `${formatDate(event.data)} a ${formatDate(event.data_fim)}`
      : formatDate(event.data);
    slide.querySelector('.when').textContent = `${dateText}${event.horario ? ` • ${event.horario}` : ''}`;
    slide.querySelector('.where').textContent = [event.local, event.cidade].filter(Boolean).join(' • ') || 'Local não informado';

    const registrationRow = slide.querySelector('.registration-row');
    if (event.inscricao) {
      slide.querySelector('.registration').textContent = event.inscricao;
    } else {
      registrationRow.remove();
    }

    const link = event.link || '';
    slide.querySelector('.source-url').textContent = shortUrl(link) || 'Consulte a equipe da biblioteca';
    slide.querySelector('.updated').textContent = formatUpdated(data.atualizado_em);
    buildQr(slide.querySelector('.qr-code'), link);

    const image = slide.querySelector('.event-image');
    const fallback = slide.querySelector('.image-fallback');
    slide.querySelector('.fallback-icon').textContent = icon;
    slide.querySelector('.fallback-label').textContent = label;

    if (event.imagem) {
      image.alt = `Imagem de divulgação: ${event.titulo}`;
      image.onload = () => {
        image.classList.add('loaded');
        fallback.style.display = 'none';
      };
      image.onerror = () => {
        image.removeAttribute('src');
        image.style.display = 'none';
        fallback.style.display = 'grid';
      };
      image.src = event.imagem;
    } else {
      image.style.display = 'none';
    }

    app.replaceChildren(slide);

    const seconds = Math.max(5, Number(data.tempo_slide) || 12);
    state.timer = setTimeout(() => {
      state.index = (state.index + 1) % state.events.length;
      renderSlide(state.index);
    }, seconds * 1000);
  }

  async function load() {
    try {
      const response = await fetch(`${DATA_URL}?v=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!data || !Array.isArray(data.eventos)) throw new Error('Formato inválido');

      state.data = data;
      state.events = filterAndSort(data.eventos);

      if (!state.events.length) {
        showMessage('empty', 'Nenhum evento futuro', 'A programação será atualizada em breve.');
        return;
      }

      renderSlide(0);
    } catch (error) {
      console.error(error);
      showMessage('error', 'Não foi possível carregar a agenda', 'Verifique se o arquivo eventos.json contém um JSON válido.');
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearTimeout(state.timer);
    else if (state.events.length) renderSlide(state.index);
  });

  load();
})();
