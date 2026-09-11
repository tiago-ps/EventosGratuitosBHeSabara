(() => {
  'use strict';

  try {
    localStorage.removeItem('mural:visual-theme');
  } catch (_) {
    // O boot continua seguro quando localStorage não está disponível.
  }

  // Aguarda o perfil de conteúdo e as curadorias carregadas antes de aplicar temas.
  document.documentElement.dataset.visualTheme = 'padrao';

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
