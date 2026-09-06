(() => {
  'use strict';

  const STORAGE_KEY = 'mural:visual-theme';
  const BANNER_CLASS = 'campaign-profile-banner';
  const HELP_BUTTON_CLASS = 'campaign-help-button';
  const CAMPAIGN_LAYOUT_STYLE_ID = 'campaign-layout-overrides';

  function ensureCampaignLayoutStyles() {
    if (document.getElementById(CAMPAIGN_LAYOUT_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = CAMPAIGN_LAYOUT_STYLE_ID;
    style.textContent = `
      /* O botão acompanha a altura real do banner: mesma porcentagem e mesmos limites. */
      html[data-visual-help="true"] body.panel-mode .media > .campaign-help-button {
        top: calc(1.25% + clamp(64px, 14.285%, 148px) + 8px);
      }

      /* O tooltip do botão-banner fica depois do atalho de ajuda, sem disputar o mesmo espaço. */
      html[data-visual-help="true"] body.panel-mode .campaign-profile-tooltip {
        top: calc(100% + 60px);
      }

      /* Sem URL utilizável não deve restar quadrado, QR ou chamada de ação vazia. */
      .qr-wrap[hidden] {
        display: none !important;
      }

      @media (max-width: 720px) {
        html[data-visual-help="true"] body.panel-mode .media > .campaign-help-button {
          top: calc(1% + clamp(52px, 15%, 96px) + 8px);
        }
      }
    `;
    document.head.appendChild(style);
  }

  function dateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function seasonalDefaultTheme(date = new Date()) {
    const current = dateKey(date);
    if (current >= '2026-08-01' && current <= '2026-08-31') return 'agosto-lilas-glow';
    return 'padrao';
  }

  const DEFAULT_THEME = seasonalDefaultTheme();

  const BASE_THEMES = [
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
      themeColor: '#120626',
      panelProfile: 'agosto-lilas-2026',
      profileLabel: 'Agosto Lilás',
      banner: {
        src: 'imagens/curadorias/agosto-lilas-banner.png',
        alt: 'Agosto Lilás'
      }
    }
  ];

  let THEMES = [...BASE_THEMES];
  const allowed = new Set(THEMES.map(theme => theme.id));
  let selectedTheme = null;
  const root = document.documentElement;
  const defaultThemeColor = document.querySelector('meta[name="theme-color"]')?.content || '#07111f';

  function escapeMarkup(value) {
    return String(value || '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
  }

  function registerLoadedThemes() {
    const curations = window.MuralCultural?.loadedCurations;
    if (!Array.isArray(curations)) return;
    const nextThemes = [...BASE_THEMES];
    const ids = new Set(nextThemes.map(theme => theme.id));
    for (const curation of curations) {
      const profile = curation?.perfil_visual;
      if (!profile || typeof profile !== 'object' || Array.isArray(profile) || !curation.id) continue;
      const id = String(profile.id || '');
      if (!/^[a-z0-9][a-z0-9-]*$/.test(id) || ids.has(id)) continue;
      let banner = null;
      if (profile.banner?.src) {
        try {
          const url = new URL(profile.banner.src, window.location.href);
          if (['http:', 'https:'].includes(url.protocol)) {
            banner = { src: url.href, alt: String(profile.banner.alt || curation.nome || '') };
          }
        } catch (_) {}
      }
      nextThemes.push({
        id,
        label: String(profile.label || curation.nome || id),
        description: String(profile.description || ''),
        swatch: /^[a-z][a-z0-9-]*$/.test(profile.swatch || '') ? profile.swatch : 'is-default',
        panelProfile: curation.perfil_painel ? String(curation.id) : '',
        profileLabel: String(profile.profileLabel || curation.nome || ''),
        helpLabel: String(profile.helpLabel || ''),
        themeColor: String(profile.themeColor || defaultThemeColor),
        banner,
        auto_ativar: profile.auto_ativar === true,
        start: String(curation.ativo_de || ''),
        end: String(curation.ativo_ate || '')
      });
      ids.add(id);
    }
    THEMES = nextThemes;
    allowed.clear();
    THEMES.forEach(theme => allowed.add(theme.id));
    const current = dateKey();
    const automatic = THEMES.find(theme => theme.auto_ativar &&
      /^\d{4}-\d{2}-\d{2}$/.test(theme.start) && /^\d{4}-\d{2}-\d{2}$/.test(theme.end) &&
      current >= theme.start && current <= theme.end
    );
    let next = automatic?.id || DEFAULT_THEME;
    let saved = selectedTheme;
    try { saved = saved || localStorage.getItem(STORAGE_KEY); } catch (_) {}
    if (saved) {
      next = allowed.has(saved) ? saved : 'padrao';
      if (!allowed.has(saved)) {
        selectedTheme = 'padrao';
        try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
      }
    }
    // Reconstrói apenas as opções; listeners e estado aberto do seletor são preservados.
    const panel = document.getElementById('visual-theme-panel');
    const toggle = document.querySelector('.visual-theme-toggle');
    if (panel && toggle) populateThemeOptions(panel.querySelector('.visual-theme-options'), panel, toggle);
    document.querySelectorAll(`.${BANNER_CLASS}`).forEach(banner => banner.remove());
    applyTheme(next, { persist: false });
  }

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
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (_) {}
  }

  function updateBrowserColor(theme) {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    meta.content = THEMES.find(item => item.id === theme)?.themeColor || defaultThemeColor;
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
    banner.className = `${BANNER_CLASS} campaign-profile-badge campaign-${theme.id}-badge`;
    banner.dataset.panelProfile = theme.panelProfile;
    banner.dataset.profileLabel = theme.profileLabel;
    banner.innerHTML = `
      <img class="campaign-profile-banner-image" src="${escapeMarkup(theme.banner.src)}" alt="${escapeMarkup(theme.banner.alt)}" decoding="async">
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

  function syncHelpButton(theme) {
    const themeConfig = THEMES.find(item => item.id === theme);
    const available = Boolean(
      themeConfig?.helpLabel && themeConfig.panelProfile &&
      root.dataset.siteCurationHelp === themeConfig.panelProfile
    );
    root.dataset.visualHelp = String(available);
    let button = document.querySelector(`.${HELP_BUTTON_CLASS}`);
    if (!available) {
      button?.remove();
      return;
    }
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = HELP_BUTTON_CLASS;
      button.addEventListener('click', () => {
        window.dispatchEvent(new CustomEvent('mural:support-help-request', {
          detail: { opener: button }
        }));
      });
    }
    const bannerMedia = document.querySelector(`.${BANNER_CLASS}`)?.closest('.media');
    const container = bannerMedia || document.body;
    if (button.parentElement !== container) container.appendChild(button);
    button.textContent = themeConfig.helpLabel;
    button.setAttribute('aria-label', `${themeConfig.helpLabel} — ${themeConfig.profileLabel || themeConfig.label}`);
  }

  function syncThemeExperience(theme) {
    syncBanner(theme);
    syncHelpButton(theme);
  }

  function syncOptions(theme) {
    document.querySelectorAll('[data-visual-theme-option]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.visualThemeOption === theme));
    });
  }

  function applyTheme(theme, { persist = true } = {}) {
    const next = allowed.has(theme) ? theme : DEFAULT_THEME;
    root.dataset.visualTheme = next;
    if (persist) {
      selectedTheme = next;
      persistTheme(next);
    }
    updateBrowserColor(next);
    syncOptions(next);
    syncThemeExperience(next);
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

  function populateThemeOptions(options, panel, toggle) {
    options.replaceChildren();
    THEMES.forEach(theme => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'visual-theme-option';
      button.dataset.visualThemeOption = theme.id;
      button.setAttribute('aria-pressed', 'false');
      button.innerHTML = `
        <span class="visual-theme-swatch ${escapeMarkup(theme.swatch)}" aria-hidden="true"></span>
        <span class="visual-theme-option-copy">
          <span class="visual-theme-option-title">${escapeMarkup(theme.label)}</span>
          <span class="visual-theme-option-description">${escapeMarkup(theme.description)}</span>
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
    populateThemeOptions(options, panel, toggle);

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
      syncThemeExperience(theme);
    });
  }

  const observer = new MutationObserver(scheduleSync);

  window.addEventListener('mural:curations-loaded', registerLoadedThemes);
  window.addEventListener('mural:panel-profile-change', scheduleSync);
  window.addEventListener('mural:site-curation-change', scheduleSync);

  function start() {
    ensureCampaignLayoutStyles();
    buildSwitcher();
    if (Array.isArray(window.MuralCultural?.loadedCurations)) registerLoadedThemes();
    else applyTheme(readTheme(), { persist: false });

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
