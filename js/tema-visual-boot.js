(() => {
  'use strict';

  const STORAGE_KEY = 'mural:visual-theme';
  // Temas declarativos só podem ser restaurados depois de carregar a allowlist.
  const ALLOWED = new Set(['padrao', 'agosto-lilas-glow']);

  function dateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function seasonalDefault(date = new Date()) {
    const current = dateKey(date);
    if (current >= '2026-08-01' && current <= '2026-08-31') return 'agosto-lilas-glow';
    return 'padrao';
  }

  let theme = seasonalDefault();
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && ALLOWED.has(saved)) theme = saved;
  } catch (_) {
    // localStorage pode estar indisponível em alguns contextos privados.
  }

  document.documentElement.dataset.visualTheme = theme;
})();
