(() => {
  'use strict';

  const BANNER_CLASS = 'campaign-profile-banner';
  const BANNERS_ID = 'panel-profile-banners';
  const HELP_BUTTON_CLASS = 'campaign-help-button';
  // Mantém o mesmo conjunto e seus listeners quando app.js substitui o slide.
  let bannerContainer = null;

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

  const BASE_THEMES = [
    { id: 'padrao', label: 'Padrão' },
    { id: 'agosto-lilas-glow', label: 'Agosto Lilás Glow', themeColor: '#120626' }
  ];

  let THEMES = [...BASE_THEMES];
  const allowed = new Set(THEMES.map(theme => theme.id));
  let themeRegistrationVersion = 0;
  const stylesheetLoads = new Map();
  const root = document.documentElement;
  const defaultThemeColor = document.querySelector('meta[name="theme-color"]')?.content || '#07111f';

  function loadCurationStylesheet(path) {
    if (stylesheetLoads.has(path)) return stylesheetLoads.get(path);
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = path;
    link.dataset.curationStylesheet = path;
    const entry = { link, loaded: null, cancel: null, promise: null };
    entry.promise = new Promise(resolve => {
      let settled = false;
      let timeout;
      const finish = (loaded, warn = false) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        link.onload = null;
        link.onerror = null;
        entry.loaded = loaded;
        if (!loaded) link.remove();
        if (warn) console.warn(`Stylesheet de curadoria indisponível: ${path}; tema não registrado.`);
        resolve(loaded);
      };
      entry.cancel = () => finish(false);
      link.onload = () => finish(true);
      link.onerror = () => finish(false, true);
      timeout = setTimeout(() => finish(false, true), 10000);
    });
    stylesheetLoads.set(path, entry);
    document.head.appendChild(link);
    return entry;
  }

  function registerLoadedThemes() {
    const curations = window.MuralCultural?.loadedCurations;
    if (!Array.isArray(curations)) return;
    registerPanelBanners(curations);
    const version = ++themeRegistrationVersion;
    const nextThemes = [...BASE_THEMES];
    const ids = new Set(nextThemes.map(theme => theme.id));
    for (const curation of curations) {
      const profile = curation?.perfil_visual;
      if (!profile || typeof profile !== 'object' || Array.isArray(profile) || !curation.id) continue;
      const id = String(profile.id || '');
      if (!/^[a-z0-9][a-z0-9-]*$/.test(id) || ids.has(id)) continue;
      let stylesheet = '';
      if (profile.stylesheet !== undefined) {
        const curationId = String(curation.id);
        if (!/^[a-z0-9][a-z0-9._-]*$/.test(curationId) || curationId.includes('..') ||
            profile.stylesheet !== `css/curadorias/${curationId}.css`) {
          console.warn(`Stylesheet inválido para a curadoria ${curationId}; tema não registrado.`);
          continue;
        }
        stylesheet = profile.stylesheet;
      }
      nextThemes.push({
        id,
        label: String(profile.label || curation.nome || id),
        panelProfile: curation.perfil_painel ? String(curation.id) : '',
        profileLabel: String(profile.profileLabel || curation.nome || ''),
        helpLabel: String(profile.helpLabel || ''),
        themeColor: String(profile.themeColor || defaultThemeColor),
        stylesheet,
        auto_ativar: profile.auto_ativar === true,
        start: String(curation.ativo_de || ''),
        end: String(curation.ativo_ate || '')
      });
      ids.add(id);
    }
    const paths = new Set(nextThemes.map(theme => theme.stylesheet).filter(Boolean));
    for (const [path, entry] of stylesheetLoads) {
      if (paths.has(path)) continue;
      entry.cancel();
      entry.link.remove();
      stylesheetLoads.delete(path);
    }
    const refresh = () => {
      if (version !== themeRegistrationVersion) return;
      const ready = nextThemes.filter(theme => !theme.stylesheet || stylesheetLoads.get(theme.stylesheet)?.loaded === true);
      updateRegisteredThemes(ready);
    };
    for (const path of paths) {
      const entry = loadCurationStylesheet(path);
      if (entry.loaded === null) entry.promise.then(refresh);
    }
    refresh();
  }

  function updateRegisteredThemes(nextThemes) {
    THEMES = nextThemes;
    allowed.clear();
    THEMES.forEach(theme => allowed.add(theme.id));
    syncExperience();
  }

  function automaticTheme() {
    const profile = activePanelProfile();
    // A escolha de conteúdo sempre prevalece, inclusive quando não há tema próprio.
    if (profile) return THEMES.find(theme => theme.panelProfile === profile)?.id || 'padrao';
    const current = dateKey();
    const seasonal = THEMES.find(theme => theme.auto_ativar &&
      /^\d{4}-\d{2}-\d{2}$/.test(theme.start) && /^\d{4}-\d{2}-\d{2}$/.test(theme.end) &&
      current >= theme.start && current <= theme.end
    );
    return seasonal?.id || seasonalDefaultTheme();
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
    const label = banner.disabled ? `Perfil ${profileLabel} fora do período de disponibilidade`
      : active ? `Desativar perfil ${profileLabel}` : `Ativar perfil ${profileLabel}`;
    if (banner.classList.contains('is-profile-active') !== active) {
      banner.classList.toggle('is-profile-active', active);
    }
    banner.setAttribute('aria-pressed', String(active));
    banner.setAttribute('aria-label', label);
    banner.title = label;
  }

  function registerPanelBanners(curations) {
    let container = bannerContainer;
    if (!container) {
      container = document.createElement('section');
      container.id = BANNERS_ID;
      container.className = 'campaign-profile-selectors';
      container.setAttribute('aria-label', 'Perfis de conteúdo');
      container.hidden = true;
      const options = document.createElement('div');
      options.className = 'campaign-profile-options';
      options.setAttribute('role', 'group');
      options.setAttribute('aria-label', 'Selecionar perfil de conteúdo');
      container.appendChild(options);
      bannerContainer = container;
    }
    const options = container.querySelector('.campaign-profile-options');
    options.replaceChildren();
    const ids = new Set();
    for (const curation of curations) {
      const profile = curation?.perfil_painel;
      if (!curation?.id || !profile?.banner?.src || ids.has(curation.id)) continue;
      let src;
      try {
        const url = new URL(profile.banner.src, window.location.href);
        if (!['http:', 'https:'].includes(url.protocol)) continue;
        src = url.href;
      } catch (_) { continue; }
      const banner = document.createElement('button');
      banner.type = 'button';
      banner.className = BANNER_CLASS;
      banner.dataset.panelProfile = String(curation.id);
      banner.dataset.profileLabel = String(curation.nome || curation.id);
      const today = dateKey();
      banner.disabled = Boolean(
        (curation.ativo_de && today < curation.ativo_de) ||
        (curation.ativo_ate && today > curation.ativo_ate)
      );
      const image = document.createElement('img');
      image.className = 'campaign-profile-banner-image';
      image.src = src;
      image.alt = String(profile.banner.alt || curation.nome || curation.id);
      image.decoding = 'async';
      const check = document.createElement('span');
      check.className = 'campaign-profile-check';
      check.setAttribute('aria-hidden', 'true');
      check.textContent = '✓';
      banner.append(image, check);
      // Botão nativo: clique, Enter e Espaço usam o mesmo evento, sem duplicação.
      banner.addEventListener('click', () => {
        window.dispatchEvent(new CustomEvent('mural:panel-profile-request', {
          detail: { profile: banner.dataset.panelProfile }
        }));
        // A troca do slide pode desconectar o botão durante o clique por teclado.
        if (banner.isConnected) banner.focus({ preventScroll: true });
      });
      syncBannerSelection(banner);
      options.appendChild(banner);
      ids.add(curation.id);
    }
    syncBanners();
  }

  function syncBanners() {
    const container = bannerContainer;
    const banners = container?.querySelectorAll(`.${BANNER_CLASS}`) || [];
    const media = document.body.classList.contains('panel-mode')
      ? [...document.querySelectorAll('#app > .slide:not([hidden]):not([aria-hidden="true"]) > .media')]
        .find(element => element.getClientRects().length > 0)
      : null;
    const visible = banners.length > 0 && Boolean(media);
    if (container) {
      container.hidden = !visible;
      if (visible && container.parentElement !== media) media.appendChild(container);
      else if (!visible) container.remove();
    }
    banners.forEach(syncBannerSelection);
  }

  function syncHelpButton(theme) {
    const themeConfig = THEMES.find(item => item.id === theme);
    const available = Boolean(
      themeConfig?.helpLabel && themeConfig.panelProfile &&
      root.dataset.siteCurationHelp === themeConfig.panelProfile
    );
    root.dataset.visualHelp = String(available);
    let button = document.querySelector(`.${HELP_BUTTON_CLASS}`) ||
      bannerContainer?.querySelector(`.${HELP_BUTTON_CLASS}`);
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
    const selectors = bannerContainer;
    const container = selectors && !selectors.hidden ? selectors : document.body;
    if (button.parentElement !== container) container.appendChild(button);
    button.textContent = themeConfig.helpLabel;
    button.setAttribute('aria-label', `${themeConfig.helpLabel} — ${themeConfig.profileLabel || themeConfig.label}`);
  }

  function syncExperience() {
    const requested = automaticTheme();
    const next = allowed.has(requested) ? requested : 'padrao';
    const changed = root.dataset.visualTheme !== next;
    root.dataset.visualTheme = next;
    updateBrowserColor(next);
    syncBanners();
    syncHelpButton(next);
    if (changed) {
      window.dispatchEvent(new CustomEvent('mural:visual-theme-change', { detail: { theme: next } }));
    }
  }

  let scheduled = false;
  function scheduleSync() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      syncExperience();
    });
  }

  const observer = new MutationObserver(scheduleSync);

  window.addEventListener('mural:curations-loaded', registerLoadedThemes);
  window.addEventListener('mural:panel-profile-change', syncExperience);
  window.addEventListener('mural:site-curation-change', scheduleSync);

  function start() {
    try { localStorage.removeItem('mural:visual-theme'); } catch (_) {}
    if (Array.isArray(window.MuralCultural?.loadedCurations)) registerLoadedThemes();
    else syncExperience();

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class']
    });
    // Observa só a troca do conteúdo principal, sem reagir às próprias atualizações.
    const app = document.getElementById('app');
    if (app) observer.observe(app, { childList: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
