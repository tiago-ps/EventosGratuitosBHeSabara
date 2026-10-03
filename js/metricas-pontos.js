(() => {
  'use strict';

  const STORAGE_KEY = 'mural:origem-sessao-v1';
  const SESSION_TTL_MS = 30 * 60 * 1000;
  const MAX_OPENED_ITEMS = 500;
  const POINT_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
  const CONTENT_ID_RE = /^[a-z0-9_]+:[^\\s]{1,180}$/u;
  const PUBLIC_ORIGIN = 'https://temsimuai.com.br';

  function metricsApiUrl() {
    if (window.location.hostname === 'tiago-ps.github.io') {
      return PUBLIC_ORIGIN + '/api/metricas-pontos';
    }
    return '/api/metricas-pontos';
  }

  function environmentName() {
    return window.location.hostname === 'tiago-ps.github.io' ? 'teste' : 'publico';
  }

  function normalizePoint(value) {
    const point = String(value || '').trim().toLowerCase();
    return POINT_RE.test(point) ? point : '';
  }

  function readState() {
    try {
      const parsed = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');
      if (!parsed || !normalizePoint(parsed.ponto)) return null;
      if (Number(parsed.expiresAt || 0) <= Date.now()) {
        sessionStorage.removeItem(STORAGE_KEY);
        return null;
      }
      parsed.opened = Array.isArray(parsed.opened) ? parsed.opened.slice(0, MAX_OPENED_ITEMS) : [];
      return parsed;
    } catch {
      return null;
    }
  }

  function writeState(current) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    } catch {
      // Métricas são opcionais: o Mural segue funcionando quando o storage é bloqueado.
    }
  }

  function removeOriginFromVisibleUrl() {
    try {
      const url = new URL(window.location.href);
      if (!url.searchParams.has('origem')) return;
      url.searchParams.delete('origem');
      history.replaceState(history.state, '', url);
    } catch {
      // A navegação continua normalmente mesmo sem History API.
    }
  }

  function sendMetric(current, acao, conteudoId = '') {
    if (!current || !current.ponto) return;
    const payload = {
      ponto: current.ponto,
      ambiente: environmentName(),
      acao
    };
    if (conteudoId && CONTENT_ID_RE.test(conteudoId)) payload.conteudo_id = conteudoId;

    try {
      fetch(metricsApiUrl(), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
        credentials: 'omit'
      }).catch(() => {});
    } catch {
      // Telemetria não pode interromper a experiência.
    }
  }

  function newTrackedSession(point) {
    const current = {
      ponto: point,
      startedAt: Date.now(),
      expiresAt: Date.now() + SESSION_TTL_MS,
      engaged: false,
      opened: []
    };
    writeState(current);
    sendMetric(current, 'entrada');
    return current;
  }

  const incomingPoint = normalizePoint(new URL(window.location.href).searchParams.get('origem'));
  let state = incomingPoint ? newTrackedSession(incomingPoint) : readState();
  if (incomingPoint) removeOriginFromVisibleUrl();
  if (!state) return;

  function touchState() {
    state.expiresAt = Date.now() + SESSION_TTL_MS;
    writeState(state);
  }

  function markEngaged() {
    if (!state || state.engaged) return;
    state.engaged = true;
    touchState();
    sendMetric(state, 'sessao_ativa');
  }

  function contentIdFromElement(element) {
    if (!(element instanceof Element)) return '';
    const own = String(element.dataset.muralContentId || element.dataset.communityItemId || '').trim();
    return CONTENT_ID_RE.test(own) ? own : '';
  }

  function recordContentId(contentId) {
    const normalized = String(contentId || '').trim();
    if (!CONTENT_ID_RE.test(normalized) || state.opened.includes(normalized)) return;
    state.opened.push(normalized);
    if (state.opened.length > MAX_OPENED_ITEMS) state.opened.shift();
    touchState();
    sendMetric(state, 'visualizacao_conteudo', normalized);
  }

  function markContentViewed(element) {
    recordContentId(contentIdFromElement(element));
  }

  ['pointerdown', 'keydown', 'touchstart', 'wheel'].forEach(type => {
    window.addEventListener(type, markEngaged, { passive: true, once: true });
  });

  const pendingViews = new WeakMap();
  const observer = 'IntersectionObserver' in window
    ? new IntersectionObserver(entries => {
        entries.forEach(entry => {
          const element = entry.target;
          const oldTimer = pendingViews.get(element);
          if (oldTimer) {
            clearTimeout(oldTimer);
            pendingViews.delete(element);
          }
          if (!entry.isIntersecting || entry.intersectionRatio < 0.6) return;
          const timer = setTimeout(() => {
            pendingViews.delete(element);
            markContentViewed(element);
          }, 800);
          pendingViews.set(element, timer);
        });
      }, { threshold: [0.6] })
    : null;

  function observeContent(root = document) {
    if (!observer) return;
    const selector = '[data-mural-content-id], [data-community-item-id]';
    if (root instanceof Element && root.matches(selector)) observer.observe(root);
    if (root.querySelectorAll) {
      root.querySelectorAll(selector).forEach(element => observer.observe(element));
    }
  }

  if (observer) {
    observeContent(document);
    const mutations = new MutationObserver(records => {
      records.forEach(record => {
        if (record.type === 'attributes') observeContent(record.target);
        record.addedNodes.forEach(node => {
          if (node instanceof Element) observeContent(node);
        });
      });
    });
    mutations.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-mural-content-id', 'data-community-item-id']
    });
  }

  window.MuralPointMetrics = Object.freeze({
    ponto: () => state && state.ponto ? state.ponto : '',
    registrarVisualizacao: recordContentId
  });
})();
