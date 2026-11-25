(() => {
  'use strict';

  const PEOPLE_URL = 'pessoas.json';
  const PARTICIPATIONS_URL = 'participacoes-locais.json';
  const OVERLAY_CLASS = 'local-participation-banner';
  const OVERLAY_ID_PREFIX = 'local-participation-';
  let people = new Map();
  let participations = [];
  let loaded = false;
  let observer = null;
  let scheduled = false;

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

    return participations
      .filter(item => item.ponto === point && item.conteudo_id === contentId)
      .map(item => ({
        ...item,
        pessoa: people.get(item.pessoa_id)
      }))
      .filter(item => item.pessoa?.nome);
  }

  function createOverlay(slide, matches) {
    const overlay = document.createElement('section');
    overlay.className = OVERLAY_CLASS;
    overlay.id = `local-participation-${matches.map(item => item.pessoa.id).join('-')}`;
    overlay.setAttribute('aria-label', 'Talentos da Casa');
    overlay.setAttribute('data-local-participation', 'true');

    const eyebrow = document.createElement('span');
    eyebrow.className = 'local-participation-eyebrow';
    eyebrow.textContent = 'Talentos da Casa';

    const label = document.createElement('span');
    label.className = 'local-participation-label';
    label.textContent = 'Com participação de';

    const names = document.createElement('div');
    names.className = 'local-participation-names';

    for (const match of matches) {
      const person = document.createElement('span');
      person.className = 'local-participation-person';

      const name = document.createElement('strong');
      name.textContent = match.pessoa.nome;
      person.appendChild(name);

      if (match.papel) {
        const role = document.createElement('small');
        role.textContent = match.papel;
        person.appendChild(role);
      }

      names.appendChild(person);
    }

    overlay.append(eyebrow, label, names);
    return overlay;
  }

  function decorateSlide(slide) {
    if (!slide?.classList?.contains('slide')) return;
    slide.querySelectorAll(`.${OVERLAY_CLASS}`).forEach(node => node.remove());

    const matches = matchingPeople(slide);
    if (!matches.length) return;

    const media = slide.querySelector('.media');
    if (!media) return;

    media.appendChild(createOverlay(slide, matches));
  }

  function refresh() {
    scheduled = false;
    const slides = document.querySelectorAll('#app > .slide');
    slides.forEach(decorateSlide);
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

      if (!peopleResponse.ok || !participationsResponse.ok) throw new Error('dados_locais_indisponiveis');

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
