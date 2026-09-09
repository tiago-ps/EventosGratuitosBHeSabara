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

  const CURATION_QUERY_PARAM = 'curadoria';
  const initialRequestedCuration = (() => {
    try {
      return String(new URL(window.location.href).searchParams.get(CURATION_QUERY_PARAM) || '').trim();
    } catch {
      return '';
    }
  })();

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

  function syncCurationUrlFromPanel(profileId = '') {
    try {
      const url = new URL(window.location.href);
      // Um ?perfil= explícito continua sendo a fonte de verdade do Painel.
      if (url.searchParams.get('perfil')) return;

      const curationId = loadedPanelCuration(profileId);
      if (curationId) url.searchParams.set(CURATION_QUERY_PARAM, curationId);
      else url.searchParams.delete(CURATION_QUERY_PARAM);

      if (url.href !== window.location.href) {
        history.replaceState(history.state, '', url);
      }
    } catch {
      /* A troca de filtros continua funcional mesmo sem sincronização de URL. */
    }
  }

  // Um link ?curadoria= precisa funcionar também em sessão limpa/anônima. Ele fica
  // pendente até o perfil editorial correspondente existir no seletor do Painel;
  // então usa o mesmo evento change da seleção manual, sem depender de localStorage.
  window.addEventListener('mural:curations-loaded', () => {
    curationsResolved = true;
    applyPendingInitialCuration();
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
        // apagar ?curadoria= da URL.
        if (applied || pendingInitialCuration) return;
      }
    }

    syncCurationUrlFromPanel(profileId);
  });

  queueMicrotask(applyPendingInitialCuration);
})();
