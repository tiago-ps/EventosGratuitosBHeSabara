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

  function loadedPanelCuration(profileId = '') {
    const id = String(profileId || '').trim();
    if (!id) return '';
    const curations = window.MuralCultural?.loadedCurations;
    if (!Array.isArray(curations)) return '';
    const curation = curations.find(item => String(item?.id || '').trim() === id);
    const settings = curation?.perfil_painel?.configuracao;
    return settings && typeof settings === 'object' && !Array.isArray(settings) ? id : '';
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

  // O link de curadoria serve para inicializar o estado. Depois disso, o estado
  // real do Painel passa a atualizar a URL: outra curadoria substitui o id e
  // filtros personalizados removem ?curadoria=, evitando reativação automática.
  window.addEventListener('mural:panel-profile-change', event => {
    syncCurationUrlFromPanel(event.detail?.profile);
  });
})();
