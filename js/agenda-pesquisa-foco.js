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

  function activeAgendaContent(shell) {
    const activeTab = shell?.querySelector('.agenda-content-tab.is-active');
    if (activeTab?.dataset.content) return activeTab.dataset.content;

    const toolsMode = agendaToolsMode(shell?.querySelector('.agenda-tools'));
    return toolsMode.startsWith('agenda-tools-')
      ? toolsMode.slice('agenda-tools-'.length)
      : '';
  }

  /*
   * A seleção de tipo de conteúdo na Agenda é exclusiva. Em especial,
   * "Eventos" pode oferecer Espaço como critério de filtro, mas não deve
   * renderizar os cards cadastrais de Espaços entre os resultados de eventos.
   *
   * app.js já separa esses conjuntos na origem; esta barreira de interface
   * evita que uma renderização incremental ou outro aprimoramento de DOM
   * reintroduza cards de Espaços quando a aba Eventos estiver ativa.
   */
  function enforceExclusiveAgendaContent(shell) {
    if (!shell || activeAgendaContent(shell) !== 'events') return;

    shell.querySelectorAll('.agenda-content-section').forEach(section => {
      if (section.querySelector('.agenda-section-action[data-content="spaces"]')) {
        section.remove();
      }
    });

    shell.querySelectorAll('.agenda-space-card').forEach(card => card.remove());
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
          enforceExclusiveAgendaContent(nextShell);
          currentCount.replaceWith(nextCount);
          currentResults.replaceWith(nextResults);
          enforceExclusiveAgendaContent(currentShell);
          return;
        }
      }
    }

    const result = nativeReplaceChildren(...nodes);
    enforceExclusiveAgendaContent(app.querySelector('.agenda-shell'));
    return result;
  };
})();
