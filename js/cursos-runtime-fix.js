(() => {
  'use strict';

  // Compatibilidade temporária com renderCourseSlide em app.js.
  // Essas funções eram chamadas pelo renderizador de cursos, mas não existiam.
  window.updateCounter = function updateCounter() {
    const slide = document.querySelector('#app .slide');
    const counter = slide?.querySelector('.counter');
    if (!counter) return;
    // O contador correto já é mantido pelos renderizadores nativos de evento/livro.
    // No curso, preserva o valor existente em vez de interromper toda a interface.
  };

  window.restartProgress = function restartProgress() {
    const progress = document.querySelector('#app .progress span');
    if (!progress) return;
    progress.style.animation = 'none';
    // Força reflow para reiniciar a animação CSS sem gerar exceção.
    void progress.offsetWidth;
    progress.style.removeProperty('animation');
  };
})();

(() => {
  'use strict';

  const LEGACY_CURATION_QUERY_PARAM = 'curadoria';
  const SHORT_CURATION_QUERY_PARAM = 'c';
  const PUBLIC_CURATION_ALIASES = Object.freeze({
    'ufmg': 'vestibular-ufmg-seriado-2026',
    'fuvest': 'vestibular-fuvest-2027',
    'saude-mental': 'saude-mental',
    'agosto-lilas': 'agosto-lilas'
  });
  const CURATION_PUBLIC_SLUGS = Object.freeze(
    Object.fromEntries(Object.entries(PUBLIC_CURATION_ALIASES).map(([slug, id]) => [id, slug]))
  );

  function shortCurationFromUrl() {
    try {
      const slug = String(
        new URL(window.location.href).searchParams.get(SHORT_CURATION_QUERY_PARAM) || ''
      ).trim().toLowerCase();
      return slug ? (PUBLIC_CURATION_ALIASES[slug] || '') : '';
    } catch {
      return '';
    }
  }

  function requestedCurationFromUrl() {
    try {
      const url = new URL(window.location.href);
      const slug = String(url.searchParams.get(SHORT_CURATION_QUERY_PARAM) || '').trim().toLowerCase();
      if (slug) return PUBLIC_CURATION_ALIASES[slug] || '';
      return String(url.searchParams.get(LEGACY_CURATION_QUERY_PARAM) || '').trim();
    } catch {
      return '';
    }
  }

  const initialRequestedCuration = requestedCurationFromUrl();
  let pendingInitialCuration = initialRequestedCuration;
  let curationsResolved = Array.isArray(window.MuralCultural?.loadedCurations);

  function loadedPanelCuration(profileId = '') {
    const id = String(profileId || '').trim();
    if (!id) return '';
    const curations = window.MuralCultural?.loadedCurations;
    if (!Array.isArray(curations)) return '';
    const curation = curations.find(item => String(item?.id || '').trim() === id);
    const settings = curation?.perfil_painel?.configuracao;
    return settings && typeof settings === 'object' && !Array.isArray(settings) ? id : '';
  }

  function sharedCurationUrl(curationId = '') {
    const url = new URL(window.location.href);
    const id = String(curationId || '').trim();
    const slug = CURATION_PUBLIC_SLUGS[id] || '';

    url.searchParams.delete(LEGACY_CURATION_QUERY_PARAM);
    url.searchParams.delete(SHORT_CURATION_QUERY_PARAM);

    if (slug) url.searchParams.set(SHORT_CURATION_QUERY_PARAM, slug);
    else if (id) url.searchParams.set(LEGACY_CURATION_QUERY_PARAM, id);
    return url;
  }

  function replaceSharedCurationUrl(curationId = '') {
    try {
      const url = sharedCurationUrl(curationId);
      if (url.href !== window.location.href) {
        history.replaceState(history.state, '', url);
      }
    } catch {
      /* A navegação continua funcional mesmo sem sincronização de URL. */
    }
  }

  function applyPendingInitialCuration() {
    const requested = String(pendingInitialCuration || '').trim();
    if (!requested) return false;

    const curationId = loadedPanelCuration(requested);
    if (!curationId) {
      // Antes do carregamento das curadorias, preserve o parâmetro da URL.
      if (curationsResolved) pendingInitialCuration = '';
      return false;
    }

    const select = document.querySelector('.panel-profile-select');
    if (!select) return false;

    const value = `editorial:${curationId}`;
    const hasOption = [...select.options].some(option => option.value === value);
    if (!hasOption) return false;

    // Limpa antes do change para evitar recursão quando o Painel publicar o novo perfil.
    pendingInitialCuration = '';
    if (select.value !== value) {
      select.value = value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }

    return false;
  }

  function applyShortLinkToAgenda() {
    const curationId = shortCurationFromUrl();
    if (!curationId) return false;

    const select = document.querySelector('.agenda-curation');
    if (!select) return false;
    if (![...select.options].some(option => String(option.value || '') === curationId)) return false;
    if (select.value === curationId) return false;

    select.value = curationId;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function syncCurationUrlFromPanel(profileId = '') {
    try {
      const url = new URL(window.location.href);
      // Um ?perfil= explícito continua sendo a fonte de verdade do Painel.
      if (url.searchParams.get('perfil')) return;

      const curationId = loadedPanelCuration(profileId);
      replaceSharedCurationUrl(curationId);
    } catch {
      /* A troca de filtros continua funcional mesmo sem sincronização de URL. */
    }
  }

  async function copyText(value) {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(value);
        return true;
      } catch {
        /* Usa fallback abaixo. */
      }
    }

    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();

    let copied = false;
    try {
      copied = document.execCommand('copy');
    } catch {
      copied = false;
    }
    textarea.remove();
    return copied;
  }

  async function shareShortCuration(button, select) {
    const curationId = String(select?.value || '').trim();
    const slug = CURATION_PUBLIC_SLUGS[curationId] || '';
    if (!curationId || !slug) return false;

    const option = select.selectedOptions?.[0];
    const title = String(option?.textContent || 'Curadoria do Mural Cultural').trim();
    const url = sharedCurationUrl(curationId).href;

    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title,
          text: 'Confira esta curadoria no Mural Cultural.',
          url
        });
        return true;
      } catch (error) {
        if (error?.name === 'AbortError') return true;
      }
    }

    const copied = await copyText(url);
    if (button?.isConnected) {
      const original = button.textContent;
      button.textContent = copied ? 'Link copiado' : 'Copie o link da barra de endereço';
      window.setTimeout(() => {
        if (button.isConnected) button.textContent = original;
      }, 2200);
    }
    return true;
  }

  // Um link de curadoria precisa funcionar também em sessão limpa/anônima. Ele fica
  // pendente até o perfil editorial correspondente existir no seletor do Painel.
  window.addEventListener('mural:curations-loaded', () => {
    curationsResolved = true;
    applyPendingInitialCuration();
    queueMicrotask(applyShortLinkToAgenda);
  });

  window.addEventListener('mural:panel-profile-change', event => {
    const profileId = String(event.detail?.profile || '').trim();

    if (pendingInitialCuration) {
      // Se o próprio Painel já resolveu a curadoria, basta encerrar a pendência.
      if (profileId === pendingInitialCuration) {
        pendingInitialCuration = '';
      } else {
        const applied = applyPendingInitialCuration();
        // Enquanto a inicialização ainda não terminou, não deixe o perfil padrão
        // apagar o link da curadoria da URL.
        if (applied || pendingInitialCuration) return;
      }
    }

    syncCurationUrlFromPanel(profileId);
  });

  // A camada antiga atualiza ?curadoria=. Esta camada roda depois e normaliza
  // imediatamente para o formato público curto quando houver apelido definido.
  document.addEventListener('change', event => {
    if (!event.target?.matches?.('.agenda-curation')) return;
    pendingInitialCuration = '';
    replaceSharedCurationUrl(event.target.value);
  }, true);

  // O botão original continua responsável pelos links sem apelido. Para as
  // curadorias com link curto, intercepta antes do listener original.
  document.addEventListener('click', event => {
    const button = event.target?.closest?.('.agenda-curation-share');
    if (!button) return;
    const select = document.querySelector('.agenda-curation');
    const curationId = String(select?.value || '').trim();
    if (!CURATION_PUBLIC_SLUGS[curationId]) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    void shareShortCuration(button, select);
  }, true);

  const app = document.getElementById('app');
  if (app) {
    new MutationObserver(() => queueMicrotask(() => {
      applyPendingInitialCuration();
      applyShortLinkToAgenda();
    })).observe(app, { childList: true, subtree: true });
  }

  queueMicrotask(() => {
    applyPendingInitialCuration();
    applyShortLinkToAgenda();

    // Se o usuário chegou por um link legado já reconhecido, converte visualmente
    // para o formato curto sem alterar a curadoria selecionada.
    const requested = requestedCurationFromUrl();
    if (requested && CURATION_PUBLIC_SLUGS[requested]) replaceSharedCurationUrl(requested);
  });
})();
