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

  function matchingPeople(slide) {
    if (!loaded || !panelIsActive()) return [];
    const point = currentPoint();
    const contentId = safeText(slide?.dataset?.communityItemId);
    if (!point || !contentId) return [];

    const seen = new Set();
    return participations
      .filter(item => item.ponto === point && item.conteudo_id === contentId)
      .map(item => ({
        ...item,
        pessoa: people.get(item.pessoa_id)
      }))
      .filter(item => {
        const personId = safeText(item.pessoa?.id);
        if (!personId || !item.pessoa?.nome || seen.has(personId)) return false;
        seen.add(personId);
        return true;
      });
  }

  function createBanner() {
    const banner = document.createElement('section');
    banner.className = OVERLAY_CLASS;
    banner.setAttribute('aria-label', 'Talentos da Casa');
    banner.setAttribute('data-local-participation', 'true');

    const title = document.createElement('strong');
    title.className = 'local-participation-title';
    title.textContent = 'Talentos da Casa';

    banner.appendChild(title);
    return banner;
  }

  function createPeopleTags(matches) {
    const section = document.createElement('div');
    section.className = PEOPLE_CLASS;
    section.setAttribute('aria-label', 'Pessoas relacionadas a este conteúdo');

    const label = document.createElement('span');
    label.className = 'local-participation-people-label';
    label.textContent = 'Com a participação de nossos talentos:';
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
      scheduleRefresh();
    } catch (error) {
      loaded = false;
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
  window.MuralCultural.localParticipation = Object.freeze({
    refresh: scheduleRefresh
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
