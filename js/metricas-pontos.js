(() => {
  'use strict';

  const POINT_STORAGE_KEY = 'mural:origem-sessao-v1';
  const GENERAL_STORAGE_KEY = 'mural:audiencia-geral-v1';
  const SESSION_TTL_MS = 30 * 60 * 1000;
  const PANEL_HEARTBEAT_MS = 60 * 1000;
  const MAX_OPENED_ITEMS = 500;
  const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
  const CONTENT_TYPE_RE = /^[a-z0-9_]+$/;
  const PUBLIC_ORIGIN = 'https://temsimuai.com.br';

  function apiUrl(path) {
    if (window.location.hostname === 'tiago-ps.github.io') {
      return PUBLIC_ORIGIN + path;
    }
    return path;
  }

  function environmentName() {
    return window.location.hostname === 'tiago-ps.github.io' ? 'teste' : 'publico';
  }

  function normalizeSlug(value) {
    const slug = String(value || '').trim().toLowerCase();
    return SLUG_RE.test(slug) ? slug : '';
  }

  function normalizePanel(value) {
    const panel = normalizeSlug(value);
    return panel || (String(value || '').trim() ? '' : 'principal');
  }

  function isContentId(value) {
    const contentId = String(value || '').trim();
    const separator = contentId.indexOf(':');
    if (separator < 1 || separator === contentId.length - 1) return false;
    const type = contentId.slice(0, separator);
    const id = contentId.slice(separator + 1);
    if (!CONTENT_TYPE_RE.test(type) || id.length > 180) return false;
    return !Array.from(id).some(char => char.trim() === '');
  }

  function safeRead(key) {
    try {
      const parsed = JSON.parse(sessionStorage.getItem(key) || 'null');
      if (!parsed || Number(parsed.expiresAt || 0) <= Date.now()) {
        sessionStorage.removeItem(key);
        return null;
      }
      parsed.opened = Array.isArray(parsed.opened) ? parsed.opened.slice(0, MAX_OPENED_ITEMS) : [];
      return parsed;
    } catch {
      return null;
    }
  }

  function safeWrite(key, value) {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      // As métricas são opcionais. O Mural continua funcionando sem storage.
    }
  }

  function safeRemove(key) {
    try {
      sessionStorage.removeItem(key);
    } catch {}
  }

  function removeTrackingParams() {
    try {
      const url = new URL(window.location.href);
      let changed = false;
      for (const key of ['origem', 'canal']) {
        if (url.searchParams.has(key)) {
          url.searchParams.delete(key);
          changed = true;
        }
      }
      if (changed) history.replaceState(history.state, '', url);
    } catch {}
  }

  function startPanelExposureTracking(pageUrl) {
    const point = normalizeSlug(pageUrl.searchParams.get('ponto'));
    if (!point) return;
    const panel = normalizePanel(pageUrl.searchParams.get('painel'));
    if (!panel) return;

    const heartbeat = () => {
      if (document.visibilityState !== 'visible') return;
      try {
        fetch(apiUrl('/api/metricas-pontos/painel'), {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            ponto: point,
            painel: panel,
            ambiente: environmentName()
          }),
          keepalive: true,
          credentials: 'omit'
        }).catch(() => {});
      } catch {}
    };

    window.setInterval(heartbeat, PANEL_HEARTBEAT_MS);
  }

  function sendPointMetric(state, acao, conteudoId = '') {
    if (!state?.ponto) return;
    const payload = {
      ponto: state.ponto,
      ambiente: environmentName(),
      acao
    };
    if (conteudoId && isContentId(conteudoId)) payload.conteudo_id = conteudoId;
    try {
      fetch(apiUrl('/api/metricas-pontos'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
        credentials: 'omit'
      }).catch(() => {});
    } catch {}
  }

  function sendGeneralMetric(state, acao, conteudoId = '') {
    if (!state?.origem_tipo || !state?.origem) return;
    const payload = {
      origem_tipo: state.origem_tipo,
      origem: state.origem,
      ambiente: environmentName(),
      acao
    };
    if (conteudoId && isContentId(conteudoId)) payload.conteudo_id = conteudoId;
    try {
      fetch(apiUrl('/api/metricas-gerais'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
        credentials: 'omit'
      }).catch(() => {});
    } catch {}
  }

  function newPointState(point) {
    const state = {
      ponto: point,
      expiresAt: Date.now() + SESSION_TTL_MS,
      engaged: false,
      opened: []
    };
    safeWrite(POINT_STORAGE_KEY, state);
    sendPointMetric(state, 'entrada');
    return state;
  }

  function newGeneralState(sourceType, source) {
    const state = {
      origem_tipo: sourceType,
      origem: source,
      expiresAt: Date.now() + SESSION_TTL_MS,
      engaged: false,
      opened: []
    };
    safeWrite(GENERAL_STORAGE_KEY, state);
    sendGeneralMetric(state, 'entrada');
    return state;
  }

  const pageUrl = new URL(window.location.href);
  startPanelExposureTracking(pageUrl);

  const incomingPoint = normalizeSlug(pageUrl.searchParams.get('origem'));
  const incomingChannel = normalizeSlug(pageUrl.searchParams.get('canal'));

  let pointState = null;
  if (incomingPoint) {
    pointState = newPointState(incomingPoint);
  } else if (incomingChannel) {
    safeRemove(POINT_STORAGE_KEY);
  } else {
    const restored = safeRead(POINT_STORAGE_KEY);
    if (restored && normalizeSlug(restored.ponto)) pointState = restored;
  }

  let generalState;
  if (incomingPoint) {
    generalState = newGeneralState('ponto', incomingPoint);
  } else if (incomingChannel) {
    generalState = newGeneralState('canal', incomingChannel);
  } else {
    const restored = safeRead(GENERAL_STORAGE_KEY);
    if (restored &&
        ['direto', 'canal', 'ponto'].includes(String(restored.origem_tipo || '')) &&
        (restored.origem_tipo === 'direto' || normalizeSlug(restored.origem))) {
      generalState = restored;
    } else if (pointState?.ponto) {
      generalState = newGeneralState('ponto', pointState.ponto);
    } else {
      generalState = newGeneralState('direto', 'direto');
    }
  }

  if (incomingPoint || incomingChannel) removeTrackingParams();

  function touchState(key, state) {
    if (!state) return;
    state.expiresAt = Date.now() + SESSION_TTL_MS;
    safeWrite(key, state);
  }

  function markEngaged() {
    if (generalState && !generalState.engaged) {
      generalState.engaged = true;
      touchState(GENERAL_STORAGE_KEY, generalState);
      sendGeneralMetric(generalState, 'sessao_ativa');
    }
    if (pointState && !pointState.engaged) {
      pointState.engaged = true;
      touchState(POINT_STORAGE_KEY, pointState);
      sendPointMetric(pointState, 'sessao_ativa');
    }
  }

  function contentIdFromElement(element) {
    if (!(element instanceof Element)) return '';
    const own = String(element.dataset.muralContentId || element.dataset.communityItemId || '').trim();
    return isContentId(own) ? own : '';
  }

  function recordContentId(contentId) {
    const normalized = String(contentId || '').trim();
    if (!isContentId(normalized)) return;

    if (generalState && !generalState.opened.includes(normalized)) {
      generalState.opened.push(normalized);
      if (generalState.opened.length > MAX_OPENED_ITEMS) generalState.opened.shift();
      touchState(GENERAL_STORAGE_KEY, generalState);
      sendGeneralMetric(generalState, 'visualizacao_conteudo', normalized);
    }

    if (pointState && !pointState.opened.includes(normalized)) {
      pointState.opened.push(normalized);
      if (pointState.opened.length > MAX_OPENED_ITEMS) pointState.opened.shift();
      touchState(POINT_STORAGE_KEY, pointState);
      sendPointMetric(pointState, 'visualizacao_conteudo', normalized);
    }
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
            recordContentId(contentIdFromElement(element));
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
    ponto: () => pointState?.ponto || '',
    registrarVisualizacao: recordContentId
  });

  window.MuralAudienceMetrics = Object.freeze({
    origemTipo: () => generalState?.origem_tipo || '',
    origem: () => generalState?.origem || '',
    registrarVisualizacao: recordContentId
  });
})();
