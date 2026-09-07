(() => {
  'use strict';

  try {
    localStorage.removeItem('mural:visual-theme');
  } catch (_) {
    // O boot continua seguro quando localStorage não está disponível.
  }

  // Aguarda o perfil de conteúdo e as curadorias carregadas antes de aplicar temas.
  document.documentElement.dataset.visualTheme = 'padrao';
})();
