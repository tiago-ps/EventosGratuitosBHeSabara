(() => {
  'use strict';

  const STORAGE_KEY = 'mural:visual-theme';
  const SEPTEMBER_MIGRATION_KEY = 'mural:visual-theme:migrated:agosto-setembro-2026';
  const SEPTEMBER_AUTO_THEME_KEY = 'mural:visual-theme:auto:setembro-2026';
  const ALLOWED = new Set(['padrao', 'agosto-lilas-glow', 'setembro-amarelo-glow']);

  function dateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function seasonalDefault(date = new Date()) {
    const current = dateKey(date);
    if (current >= '2026-09-01' && current <= '2026-09-30') return 'setembro-amarelo-glow';
    if (current >= '2026-08-01' && current <= '2026-08-31') return 'agosto-lilas-glow';
    return 'padrao';
  }

  let theme = seasonalDefault();
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const septemberIsActive = seasonalDefault() === 'setembro-amarelo-glow';
    const migrated = localStorage.getItem(SEPTEMBER_MIGRATION_KEY) === '1';
    const autoSeptemberTheme = localStorage.getItem(SEPTEMBER_AUTO_THEME_KEY) === '1';
    if (septemberIsActive && saved === 'agosto-lilas-glow' && !migrated) {
      theme = 'setembro-amarelo-glow';
      localStorage.setItem(STORAGE_KEY, theme);
      localStorage.setItem(SEPTEMBER_MIGRATION_KEY, '1');
      localStorage.setItem(SEPTEMBER_AUTO_THEME_KEY, '1');
    } else if (!septemberIsActive && saved === 'setembro-amarelo-glow' && autoSeptemberTheme) {
      theme = seasonalDefault();
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(SEPTEMBER_AUTO_THEME_KEY);
    } else if (saved && ALLOWED.has(saved)) {
      theme = saved;
    }
  } catch (_) {
    // localStorage pode estar indisponível em alguns contextos privados.
  }

  document.documentElement.dataset.visualTheme = theme;
})();
