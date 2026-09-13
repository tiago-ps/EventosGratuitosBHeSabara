(() => {
  'use strict';

  try {
    localStorage.removeItem('mural:visual-theme');
  } catch (_) {
    // O boot continua seguro quando localStorage não está disponível.
  }

  // Aguarda o perfil de conteúdo e as curadorias carregadas antes de aplicar temas.
  document.documentElement.dataset.visualTheme = 'padrao';

  // Experiência do Painel:
  // - passivo é o padrão para TV/monitor/sala de espera;
  // - interativo preserva controles e ações para terminais/balcões.
  // A Agenda continua sendo decidida pelo app.js e não é afetada por este atributo.
  let panelExperience = 'passivo';
  try {
    const requestedMode = String(new URLSearchParams(window.location.search).get('modo') || '')
      .trim()
      .toLowerCase();
    if (['interativo', 'interactive', 'terminal'].includes(requestedMode)) {
      panelExperience = 'interativo';
    }
  } catch (_) {
    // Mantém o padrão passivo quando a URL não puder ser interpretada.
  }
  document.documentElement.dataset.panelExperience = panelExperience;

  const panelModesStyles = document.createElement('link');
  panelModesStyles.rel = 'stylesheet';
  panelModesStyles.href = 'css/painel-modos.css?v=1';
  document.head.appendChild(panelModesStyles);

  // Complemento progressivo da interface do Painel: mantém o QR geral e move
  // as ações específicas dos conteúdos para as respectivas caixas de informação.
  const contextualStyles = document.createElement('link');
  contextualStyles.rel = 'stylesheet';
  contextualStyles.href = 'css/painel-acoes-contextuais.css?v=1';
  document.head.appendChild(contextualStyles);

  const contextualActions = document.createElement('script');
  contextualActions.src = 'js/painel-acoes-contextuais.js?v=2';
  document.head.appendChild(contextualActions);
})();
