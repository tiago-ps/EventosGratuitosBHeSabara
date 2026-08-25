(() => {
  'use strict';

  const STORAGE_KEY = 'mural:visual-theme';
  const DEFAULT_THEME = 'agosto-lilas-glow';
  const ALLOWED = new Set(['padrao', 'agosto-lilas-glow']);

  let theme = DEFAULT_THEME;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && ALLOWED.has(saved)) theme = saved;
  } catch (_) {
    // localStorage pode estar indisponível em alguns contextos privados.
  }

  document.documentElement.dataset.visualTheme = theme;
})();
