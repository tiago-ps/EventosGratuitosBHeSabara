(() => {
  'use strict';

  try {
    localStorage.removeItem('mural:visual-theme');
  } catch (_) {
    // O boot continua seguro quando localStorage não está disponível.
  }

  // Aguarda o perfil de conteúdo e as curadorias carregadas antes de aplicar temas.
  document.documentElement.dataset.visualTheme = 'padrao';

  // Modos explícitos pela URL:
  // ?modo=agenda      -> busca e exploração completa;
  // ?modo=passivo     -> Painel para TV/monitor/sala de espera;
  // ?modo=interativo  -> Painel para terminal/balcão.
  // Sem parâmetro, o mecanismo histórico do app continua decidindo Agenda/Painel,
  // e qualquer Painel aberto usa a experiência passiva como padrão.
  let panelExperience = 'passivo';
  let requestedMode = '';
  try {
    requestedMode = String(new URLSearchParams(window.location.search).get('modo') || '')
      .trim()
      .toLowerCase();

    if (['interativo', 'interactive', 'terminal'].includes(requestedMode)) {
      panelExperience = 'interativo';
      localStorage.setItem('agenda-cultural-modo-visualizacao', 'painel');
    } else if (['passivo', 'tv', 'painel'].includes(requestedMode)) {
      panelExperience = 'passivo';
      localStorage.setItem('agenda-cultural-modo-visualizacao', 'painel');
    } else if (requestedMode === 'agenda') {
      localStorage.setItem('agenda-cultural-modo-visualizacao', 'agenda');
    }
  } catch (_) {
    // Mantém o comportamento histórico quando URL/storage não estiverem disponíveis.
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
