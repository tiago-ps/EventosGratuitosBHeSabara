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
  panelModesStyles.href = 'css/painel-modos.css?v=2';
  document.head.appendChild(panelModesStyles);

  const panelModesNavigation = document.createElement('script');
  panelModesNavigation.src = 'js/painel-navegacao-modos.js?v=1';
  document.head.appendChild(panelModesNavigation);

  // Preserva a mesma caixa de pesquisa da Agenda durante o debounce da busca,
  // atualizando somente contador e resultados enquanto o usuário digita.
  const agendaSearchFocus = document.createElement('script');
  agendaSearchFocus.src = 'js/agenda-pesquisa-foco.js?v=1';
  document.head.appendChild(agendaSearchFocus);

  // Complemento progressivo da interface do Painel: mantém o QR geral e move
  // as ações específicas dos conteúdos para as respectivas caixas de informação.
  const contextualStyles = document.createElement('link');
  contextualStyles.rel = 'stylesheet';
  contextualStyles.href = 'css/painel-acoes-contextuais.css?v=2';
  document.head.appendChild(contextualStyles);

  const contextualActions = document.createElement('script');
  contextualActions.src = 'js/painel-acoes-contextuais.js?v=3';
  document.head.appendChild(contextualActions);

  // Composição oficial do Painel Tem Sim, Uai, compartilhada entre teste e público.
  const temSimUaiPanelStyles = document.createElement('link');
  temSimUaiPanelStyles.rel = 'stylesheet';
  temSimUaiPanelStyles.href = 'css/tem-sim-uai-painel.css?v=1';
  document.head.appendChild(temSimUaiPanelStyles);

  const temSimUaiPanelLayout = document.createElement('script');
  temSimUaiPanelLayout.src = 'js/tem-sim-uai-painel.js?v=1';
  temSimUaiPanelLayout.defer = true;
  document.head.appendChild(temSimUaiPanelLayout);

  // Somente a identidade de instalação do ambiente de teste permanece exclusiva.
  try {
    const isTestSite =
      window.location.hostname === 'tiago-ps.github.io' &&
      /^\/EventosGratuitosBHeSabara(?:\/|$)/.test(window.location.pathname);

    if (isTestSite) {
      document.documentElement.dataset.temSimUaiTest = '1';

      document.title = 'Tem Sim, Uai';

      const applicationName = document.querySelector('meta[name="application-name"]');
      if (applicationName) applicationName.content = 'Tem Sim, Uai';

      const appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
      if (appleTitle) appleTitle.content = 'Tem Sim, Uai';

      const manifestLink = document.querySelector('link[rel="manifest"]');
      if (manifestLink) {
        manifestLink.href = 'imagens/app-icons/manifest-tem-sim-uai.webmanifest?v=3';
      }

      const favicon = document.querySelector('link[rel="icon"]');
      if (favicon) {
        favicon.type = 'image/png';
        favicon.sizes = '32x32';
        favicon.href = 'imagens/app-icons/favicon-tem-sim-uai-32.png?v=3';
      }

      const appleIcon = document.querySelector('link[rel="apple-touch-icon"]');
      if (appleIcon) {
        appleIcon.href = 'imagens/app-icons/icon-uai-tem-sim-192.png?v=1';
      }
    }
  } catch (_) {
    // Falha silenciosa: o site mantém o layout público normal.
  }
})();