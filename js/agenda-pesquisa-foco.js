(() => {
  'use strict';

  const app = document.getElementById('app');
  if (!app || app.dataset.searchFocusPatch === 'true') return;
  app.dataset.searchFocusPatch = 'true';

  const nativeReplaceChildren = app.replaceChildren.bind(app);

  function agendaToolsMode(tools) {
    if (!tools) return '';
    return [...tools.classList].find(name => name.startsWith('agenda-tools-')) || '';
  }

  /*
   * A pesquisa da Agenda usa debounce e chama renderAgenda(). O render completo
   * recriava a caixa de busca e, por consequência, removia o foco/cursor após
   * cada pequena pausa na digitação.
   *
   * Quando a própria busca está focada e o tipo de conteúdo não mudou, mantém
   * cabeçalho e controles existentes e troca somente contador + resultados.
   * Os novos resultados continuam recebendo os listeners normais de app.js,
   * porque são os mesmos nós criados pela renderização em andamento.
   */
  app.replaceChildren = (...nodes) => {
    const activeElement = document.activeElement;
    const currentShell = app.querySelector('.agenda-shell');
    const nextShell = nodes.length === 1 && nodes[0] instanceof Element
      ? nodes[0]
      : null;

    if (
      document.body.classList.contains('agenda-mode') &&
      currentShell &&
      nextShell?.classList.contains('agenda-shell')
    ) {
      const currentSearch = currentShell.querySelector('.agenda-search input');
      const nextSearch = nextShell.querySelector('.agenda-search input');
      const currentTools = currentShell.querySelector('.agenda-tools');
      const nextTools = nextShell.querySelector('.agenda-tools');
      const sameContentMode = agendaToolsMode(currentTools) === agendaToolsMode(nextTools);

      if (activeElement === currentSearch && nextSearch && sameContentMode) {
        const currentCount = currentShell.querySelector('.agenda-count');
        const currentResults = currentShell.querySelector('.agenda-results');
        const nextCount = nextShell.querySelector('.agenda-count');
        const nextResults = nextShell.querySelector('.agenda-results');

        if (currentCount && currentResults && nextCount && nextResults) {
          currentCount.replaceWith(nextCount);
          currentResults.replaceWith(nextResults);
          return;
        }
      }
    }

    return nativeReplaceChildren(...nodes);
  };
})();
