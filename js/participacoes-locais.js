(() => {
  'use strict';

  const PEOPLE_URL = 'pessoas.json';
  const PARTICIPATIONS_URL = 'participacoes-locais.json';
  const OVERLAY_CLASS = 'local-participation-banner';
  const PEOPLE_CLASS = 'local-participation-people';
  const LOCAL_THEME = 'talentos-casa-glow';
  let people = new Map();
  let participations = [];
  let loaded = false;
  let observer = null;
  let scheduled = false;
  let localThemeActive = false;
  const TALENT_PLACE_KEY = 'tem-sim-uai-talento-lugar-v1';
  const TALENT_PLACE_EVENT = 'mural:talent-place-change';
  let selectedPlace = '';

  function currentPoint() {
    try {
      const value = String(new URL(window.location.href).searchParams.get('ponto') || '')
        .trim()
        .toLowerCase();
      return /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(value) ? value : '';
    } catch {
      return '';
    }
  }

  function panelIsActive() {
    return document.body?.classList.contains('panel-mode');
  }

  function selectedPlaceFromStorage() {
    try { return safeText(localStorage.getItem(TALENT_PLACE_KEY)); } catch { return ''; }
  }

  function placeOptions() {
    const counts = new Map();
    for (const person of people.values()) {
      for (const vinculo of Array.isArray(person?.vinculos) ? person.vinculos : []) {
        if (vinculo?.ativo === false) continue;
        const label = safeText(vinculo?.instituicao);
        if (!label) continue;
        const key = label.toLowerCase();
        counts.set(key, { value: label, count: (counts.get(key)?.count || 0) + 1 });
      }
    }
    return [...counts.values()].sort((a, b) => a.value.localeCompare(b.value, 'pt-BR'));
  }

  function personBelongsToPlace(person, place) {
    const wanted = safeText(place).toLowerCase();
    if (!wanted || !person) return false;
    return (Array.isArray(person.vinculos) ? person.vinculos : []).some(vinculo =>
      vinculo?.ativo !== false && safeText(vinculo?.instituicao).toLowerCase() === wanted
    );
  }

  function safeText(value) {
    return String(value || '').trim();
  }

  function normalizeParticipation(value) {
    if (!value || typeof value !== 'object') return null;
    const point = safeText(value.ponto).toLowerCase();
    const contentId = safeText(value.conteudo_id);
    const personId = safeText(value.pessoa_id);
    if (!point || !contentId || !personId) return null;
    return {
      ponto: point,
      conteudo_id: contentId,
      pessoa_id: personId,
      papel: safeText(value.papel)
    };
  }

  function peopleForContent(contentId, options = {}) {
    if (!loaded) return [];
    const id = safeText(contentId);
    if (!id) return [];
    const point = safeText(options.point ?? currentPoint()).toLowerCase();
    const place = safeText(options.place ?? selectedPlace);
    const seen = new Set();
    return participations
      .filter(item => item.conteudo_id === id)
      .filter(item => point ? item.ponto === point : Boolean(place))
      .filter(item => !place || personBelongsToPlace(people.get(item.pessoa_id), place))
      .map(item => ({ ...item, pessoa: people.get(item.pessoa_id) }))
      .filter(item => {
        const personId = safeText(item.pessoa?.id);
        if (!personId || !item.pessoa?.nome || seen.has(personId)) return false;
        seen.add(personId);
        return true;
      });
  }

  function matchingPeople(slide) {
    const point = currentPoint();
    // O selo no painel é específico de um ponto de divulgação. Sem ?ponto=,
    // não associamos conteúdos a uma comunidade por inferência.
    if (!panelIsActive() || !point) return [];
    return peopleForContent(slide?.dataset?.communityItemId, { point, place: '' });
  }

  function createBanner() {
    const banner = document.createElement('section');
    banner.className = OVERLAY_CLASS;
    banner.setAttribute('aria-label', 'Talentos da Casa');
    banner.setAttribute('data-local-participation', 'true');

    const image = document.createElement('img');
    image.className = 'local-participation-banner-image';
    image.src = './imagens/selos/talentos-da-casa-banner.png?v=1';
    image.alt = 'Talentos da Casa';
    image.width = 1200;
    image.height = 260;
    image.decoding = 'async';
    image.draggable = false;

    banner.appendChild(image);
    return banner;
  }

  function createPeopleTags(matches) {
    const section = document.createElement('div');
    section.className = PEOPLE_CLASS;
    section.setAttribute('aria-label', 'Pessoas relacionadas a este conteúdo');

    const label = document.createElement('span');
    label.className = 'local-participation-people-label';
    label.textContent = matches.length === 1
      ? 'Com a participação de nosso talento:'
      : 'Com a participação de nossos talentos:';
    section.appendChild(label);

    for (const match of matches) {
      const tag = document.createElement('span');
      tag.className = 'local-participation-person-tag';

      const name = document.createElement('strong');
      name.textContent = match.pessoa.nome;
      tag.appendChild(name);

      if (match.papel) {
        const role = document.createElement('small');
        role.textContent = match.papel;
        tag.appendChild(role);
      }

      section.appendChild(tag);
    }

    return section;
  }

  function informationHost(slide) {
    return slide.querySelector('.event-copy:not([hidden])') ||
      slide.querySelector('.book-copy:not([hidden])') ||
      slide.querySelector('.content');
  }

  function insertPeopleTags(slide, matches) {
    const host = informationHost(slide);
    if (!host) return;

    const tags = createPeopleTags(matches);
    const details = host.querySelector('.details, .book-details');
    if (details) host.insertBefore(tags, details);
    else host.appendChild(tags);
  }

  function decorateSlide(slide) {
    if (!slide?.classList?.contains('slide')) return;
    slide.querySelectorAll('.' + OVERLAY_CLASS + ', .' + PEOPLE_CLASS).forEach(node => node.remove());

    const matches = matchingPeople(slide);
    if (!matches.length) return;

    const media = slide.querySelector('.media');
    if (media) media.appendChild(createBanner());

    insertPeopleTags(slide, matches);
  }

  function visibleSlide(slides) {
    return slides.find(slide =>
      !slide.hidden &&
      slide.getAttribute('aria-hidden') !== 'true' &&
      slide.getClientRects().length > 0
    ) || null;
  }

  function syncLocalTheme(slides) {
    const slide = visibleSlide(slides);
    const active = Boolean(panelIsActive() && slide && matchingPeople(slide).length);
    const root = document.documentElement;

    if (active) root.dataset.localParticipationTheme = LOCAL_THEME;
    else delete root.dataset.localParticipationTheme;

    if (active !== localThemeActive) {
      localThemeActive = active;
      window.dispatchEvent(new CustomEvent('mural:local-participation-change', {
        detail: { active, theme: active ? LOCAL_THEME : 'padrao' }
      }));
    }
  }

  function decorateAgendaCard(article, contentId) {
    if (!article || !selectedPlace || !contentId) return article;
    article.querySelectorAll('.' + PEOPLE_CLASS).forEach(node => node.remove());
    const matches = peopleForContent(contentId, { point: '', place: selectedPlace });
    if (!matches.length) return article;
    const body = article.querySelector('.agenda-card-body');
    if (!body) return article;
    const section = createPeopleTags(matches);
    section.classList.add('local-participation-agenda-people');
    body.insertBefore(section, body.firstChild);
    article.dataset.talentosCasa = 'true';
    return article;
  }

  function refresh() {
    scheduled = false;
    const slides = [...document.querySelectorAll('#app > .slide')];
    slides.forEach(decorateSlide);
    syncLocalTheme(slides);
  }

  function scheduleRefresh() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(refresh);
  }

  async function loadData() {
    try {
      const [peopleResponse, participationsResponse] = await Promise.all([
        fetch(`${PEOPLE_URL}?v=1`, { cache: 'no-store' }),
        fetch(`${PARTICIPATIONS_URL}?v=1`, { cache: 'no-store' })
      ]);

      if (!peopleResponse.ok || !participationsResponse.ok) {
        throw new Error('dados_locais_indisponiveis');
      }

      const peopleData = await peopleResponse.json();
      const participationsData = await participationsResponse.json();

      people = new Map(
        (Array.isArray(peopleData?.pessoas) ? peopleData.pessoas : [])
          .filter(item => safeText(item?.id) && safeText(item?.nome))
          .map(item => [safeText(item.id), item])
      );

      participations = (Array.isArray(participationsData?.participacoes)
        ? participationsData.participacoes
        : [])
        .map(normalizeParticipation)
        .filter(Boolean);

      loaded = true;
      selectedPlace = selectedPlaceFromStorage();
      window.dispatchEvent(new CustomEvent(TALENT_PLACE_EVENT, {
        detail: { loaded: true, places: placeOptions(), selectedPlace }
      }));
      scheduleRefresh();
    } catch (error) {
      loaded = false;
      window.dispatchEvent(new CustomEvent(TALENT_PLACE_EVENT, {
        detail: { loaded: false, places: [], selectedPlace: '' }
      }));
      console.warn('Participações locais indisponíveis.', error);
      scheduleRefresh();
    }
  }

  function start() {
    if (observer) return;
    observer = new MutationObserver(scheduleRefresh);

    const app = document.getElementById('app');
    if (app) observer.observe(app, { childList: true });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class']
    });

    window.addEventListener('popstate', scheduleRefresh);
    void loadData();
  }

  window.MuralCultural = window.MuralCultural || {};
  window.MuralCultural.localParticipation = {
    refresh: scheduleRefresh,
    isLoaded: () => loaded,
    places: () => placeOptions(),
    selectedPlace: () => selectedPlace,
    setSelectedPlace: value => {
      const next = safeText(value);
      selectedPlace = placeOptions().some(item => item.value === next) ? next : '';
      try {
        if (selectedPlace) localStorage.setItem(TALENT_PLACE_KEY, selectedPlace);
        else localStorage.removeItem(TALENT_PLACE_KEY);
      } catch { /* a escolha continua válida nesta sessão */ }
      window.dispatchEvent(new CustomEvent(TALENT_PLACE_EVENT, {
        detail: { loaded, places: placeOptions(), selectedPlace }
      }));
      scheduleRefresh();
      return selectedPlace;
    },
    clearSelectedPlace: () => {
      selectedPlace = '';
      try { localStorage.removeItem(TALENT_PLACE_KEY); } catch { /* opcional */ }
      window.dispatchEvent(new CustomEvent(TALENT_PLACE_EVENT, {
        detail: { loaded, places: placeOptions(), selectedPlace: '' }
      }));
      scheduleRefresh();
    },
    peopleForContent,
    matchesContent: contentId => Boolean(selectedPlace && peopleForContent(contentId, { point: '', place: selectedPlace }).length),
    decorateAgendaCard,
    TALENT_PLACE_EVENT
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
