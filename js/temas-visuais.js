(() => {
  'use strict';

  const STORAGE_KEY = 'mural:visual-theme';
  const DEFAULT_THEME = 'agosto-lilas-glow';
  const BANNER_CLASS = 'campaign-profile-banner';

  const THEMES = [
    {
      id: 'padrao',
      label: 'Padrão',
      description: 'Visual atual do Mural',
      swatch: 'is-default'
    },
    {
      id: 'agosto-lilas-glow',
      label: 'Agosto Lilás Glow',
      description: 'Roxo noturno, brilhos difusos e laço',
      swatch: 'is-lilas',
      panelProfile: 'agosto-lilas-2026',
      profileLabel: 'Agosto Lilás',
      banner: {
        src: 'imagens/curadorias/agosto-lilas-banner.png',
        alt: 'Agosto Lilás'
      }
    }
  ];

  const allowed = new Set(THEMES.map(theme => theme.id));
  const root = document.documentElement;
  const defaultThemeColor = document.querySelector('meta[name="theme-color"]')?.content || '#07111f';

  function readTheme() {
    const current = root.dataset.visualTheme;
    if (current && allowed.has(current)) return current;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && allowed.has(saved)) return saved;
    } catch (_) {}
    return DEFAULT_THEME;
  }

  function persistTheme(theme) {
    try { localStorage.setItem(STORAGE_KEY, theme); } catch (_) {}
  }

  function updateBrowserColor(theme) {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    meta.content = theme === 'agosto-lilas-glow' ? '#120626' : defaultThemeColor;
  }

  function activePanelProfile() {
    return root.dataset.panelProfile || '';
  }

  function syncBannerSelection(banner) {
    const active = banner.dataset.panelProfile === activePanelProfile();
    const profileLabel = banner.dataset.profileLabel || 'temático';
    const label = active ? `Desativar perfil ${profileLabel}` : `Ativar perfil ${profileLabel}`;
    banner.classList.toggle('is-profile-active', active);
    banner.setAttribute('aria-pressed', String(active));
    banner.setAttribute('aria-label', label);
    const tooltip = banner.querySelector('.campaign-profile-tooltip');
    if (tooltip) tooltip.textContent = label;
  }

  function ensureBanner(media, theme) {
    let banner = media.querySelector(`.${BANNER_CLASS}`);
    if (banner && banner.dataset.panelProfile !== theme.panelProfile) {
      banner.remove();
      banner = null;
    }
    if (banner) {
      syncBannerSelection(banner);
      return banner;
    }

    banner = document.createElement('button');
    banner.type = 'button';
    banner.className = `${BANNER_CLASS} campaign-agosto-lilas-badge`;
    banner.dataset.panelProfile = theme.panelProfile;
    banner.dataset.profileLabel = theme.profileLabel;
    banner.innerHTML = `
      <img class="campaign-profile-banner-image" src="${theme.banner.src}" alt="${theme.banner.alt}" decoding="async">
      <span class="campaign-profile-check" aria-hidden="true">✓</span>
      <span class="campaign-profile-tooltip" role="tooltip"></span>`;
    const togglePanelProfile = () => {
      window.dispatchEvent(new CustomEvent('mural:panel-profile-request', {
        detail: { profile: banner.dataset.panelProfile }
      }));
    };
    banner.addEventListener('click', togglePanelProfile);
    banner.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      togglePanelProfile();
    });
    syncBannerSelection(banner);
    media.appendChild(banner);
    return banner;
  }

  function syncBanner(theme) {
    const themeConfig = THEMES.find(item => item.id === theme);
    const active = Boolean(
      themeConfig?.banner && themeConfig.panelProfile && document.body.classList.contains('panel-mode')
    );
    document.querySelectorAll('.slide .media').forEach(media => {
      const banner = media.querySelector(`.${BANNER_CLASS}`);
      if (active) ensureBanner(media, themeConfig);
      else if (banner) banner.remove();
    });
  }

  function syncOptions(theme) {
    document.querySelectorAll('[data-visual-theme-option]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.visualThemeOption === theme));
    });
  }

  function applyTheme(theme, { persist = true } = {}) {
    const next = allowed.has(theme) ? theme : DEFAULT_THEME;
    root.dataset.visualTheme = next;
    if (persist) persistTheme(next);
    updateBrowserColor(next);
    syncOptions(next);
    syncBanner(next);
    window.dispatchEvent(new CustomEvent('mural:visual-theme-change', { detail: { theme: next } }));
  }

  function paletteIcon() {
    return `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
        <path d="M12 3a9 9 0 1 0 0 18h1.2a1.8 1.8 0 0 0 1.3-3l-.25-.25a1.6 1.6 0 0 1 1.13-2.73H18a3 3 0 0 0 3-3A9 9 0 0 0 12 3Z"></path>
        <circle cx="7.5" cy="10" r="1"></circle>
        <circle cx="10" cy="6.8" r="1"></circle>
        <circle cx="14.2" cy="7" r="1"></circle>
        <circle cx="16.5" cy="10.2" r="1"></circle>
      </svg>`;
  }

  function buildSwitcher() {
    if (document.querySelector('.visual-theme-switcher')) return;

    const wrapper = document.createElement('aside');
    wrapper.className = 'visual-theme-switcher';
    wrapper.setAttribute('aria-label', 'Aparência do Mural');

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'visual-theme-toggle';
    toggle.title = 'Alterar aparência';
    toggle.setAttribute('aria-label', 'Alterar aparência do Mural');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', 'visual-theme-panel');
    toggle.innerHTML = paletteIcon();

    const panel = document.createElement('section');
    panel.id = 'visual-theme-panel';
    panel.className = 'visual-theme-panel';
    panel.hidden = true;
    panel.innerHTML = `
      <h2 class="visual-theme-heading">Aparência</h2>
      <p class="visual-theme-help">Muda somente o visual. O filtro de conteúdo continua independente.</p>
      <div class="visual-theme-options"></div>`;

    const options = panel.querySelector('.visual-theme-options');
    THEMES.forEach(theme => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'visual-theme-option';
      button.dataset.visualThemeOption = theme.id;
      button.setAttribute('aria-pressed', 'false');
      button.innerHTML = `
        <span class="visual-theme-swatch ${theme.swatch}" aria-hidden="true"></span>
        <span class="visual-theme-option-copy">
          <span class="visual-theme-option-title">${theme.label}</span>
          <span class="visual-theme-option-description">${theme.description}</span>
        </span>
        <span class="visual-theme-check" aria-hidden="true">✓</span>`;
      button.addEventListener('click', () => {
        applyTheme(theme.id);
        panel.hidden = true;
        toggle.setAttribute('aria-expanded', 'false');
        toggle.focus();
      });
      options.appendChild(button);
    });

    toggle.addEventListener('click', () => {
      const open = panel.hidden;
      panel.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
      if (open) panel.querySelector('[aria-pressed="true"]')?.focus();
    });

    document.addEventListener('pointerdown', event => {
      if (panel.hidden || wrapper.contains(event.target)) return;
      panel.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
    });

    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || panel.hidden) return;
      panel.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
      toggle.focus();
    });

    wrapper.append(panel, toggle);
    document.body.appendChild(wrapper);
  }

  let scheduled = false;
  function scheduleSync() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      const theme = readTheme();
      syncOptions(theme);
      syncBanner(theme);
    });
  }

  const observer = new MutationObserver(scheduleSync);

  window.addEventListener('mural:panel-profile-change', scheduleSync);

  function start() {
    buildSwitcher();
    const theme = readTheme();
    applyTheme(theme, { persist: false });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
