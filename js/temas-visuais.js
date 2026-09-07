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
    if (profile) {
      const selectedTheme = THEMES.find(theme => theme.panelProfile === profile);
      return selectedTheme && panelProfileMatchesCurrentSlide(profile) ? selectedTheme.id : 'padrao';
    }

    // Temas editoriais automáticos acompanham o item da própria curadoria.
    // A janela de datas continua válida, mas não colore itens sem relação com ela.
    const current = dateKey();
    const contextual = THEMES.find(theme => theme.auto_ativar && theme.panelProfile &&
      (!theme.start || current >= theme.start) && (!theme.end || current <= theme.end) &&
      panelProfileMatchesCurrentSlide(theme.panelProfile)
    );
    return contextual?.id || seasonalDefaultTheme();
  }

  function updateBrowserColor(theme) {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    meta.content = THEMES.find(item => item.id === theme)?.themeColor || defaultThemeColor;
  }

  function activePanelProfile() {
    return root.dataset.panelProfile || '';
  }

  function normalizeContentKey(value = '') {
    return String(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function curationTitleKeys(curation) {
    const keys = new Set();
    const add = value => {
      const key = normalizeContentKey(value);
      if (key) keys.add(key);
    };

    const complements = curation?.complementos;
    if (complements && typeof complements === 'object') {
      for (const collection of Object.values(complements)) {
        if (!Array.isArray(collection)) continue;
        for (const item of collection) add(item?.titulo);
      }
    }

    const overlays = curation?.overlays;
    if (overlays && typeof overlays === 'object') {
      for (const collection of Object.values(overlays)) {
        if (!collection || typeof collection !== 'object' || Array.isArray(collection)) continue;
        for (const overlay of Object.values(collection)) {
          add(overlay?.titulo_esperado);
          add(overlay?.titulo);
          add(overlay?.fallback?.titulo);
        }
      }
    }

    return keys;
  }

  function visibleSlideTitle(slide) {
    const selectors = [
      '.book-copy:not([hidden]) .book-title',
      '.event-copy:not([hidden]) .event-title',
      '.book-title',
      '.event-title'
    ];
    for (const selector of selectors) {
      const text = slide?.querySelector(selector)?.textContent;
      const key = normalizeContentKey(text);
      if (key) return key;
    }
    return '';
  }

  function visibleSlideThemeKeys(slide) {
    return new Set(
      [...(slide?.querySelectorAll('.book-themes > *') || [])]
        .map(element => normalizeContentKey(element.textContent))
        .filter(Boolean)
    );
  }

  function bannerMatchesSlide(banner, slide) {
    if (!banner || !slide) return false;
    const profileId = banner.dataset.panelProfile || '';
    if (slide.classList.contains('support-slide') && root.dataset.siteCurationHelp === profileId) {
      return true;
    }

    const title = visibleSlideTitle(slide);
    if (title && banner._curationTitleKeys?.has(title)) return true;

    const themeKey = banner._curationThemeKey || '';
    return Boolean(themeKey && visibleSlideThemeKeys(slide).has(themeKey));
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
      banner._curationTitleKeys = curationTitleKeys(curation);
      banner._curationThemeKey = normalizeContentKey(curation.tema);
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

  function currentPanelMedia() {
    if (!document.body.classList.contains('panel-mode')) return null;
    return [...document.querySelectorAll('#app > .slide:not([hidden]):not([aria-hidden="true"]) > .media')]
      .find(element => element.getClientRects().length > 0) || null;
  }

  function panelProfileMatchesCurrentSlide(profileId) {
    if (!profileId || !bannerContainer) return false;
    const media = currentPanelMedia();
    const slide = media?.closest('.slide') || null;
    if (!slide) return false;
    const banner = [...bannerContainer.querySelectorAll(`.${BANNER_CLASS}`)]
      .find(item => item.dataset.panelProfile === profileId);
    return Boolean(banner && bannerMatchesSlide(banner, slide));
  }

  function syncBanners() {
    const container = bannerContainer;
    const banners = [...(container?.querySelectorAll(`.${BANNER_CLASS}`) || [])];
    const media = currentPanelMedia();
    const slide = media?.closest('.slide') || null;
    let visibleCount = 0;

    for (const banner of banners) {
      const visibleForItem = Boolean(slide && bannerMatchesSlide(banner, slide));
      banner.hidden = !visibleForItem;
      if (visibleForItem) visibleCount += 1;
      syncBannerSelection(banner);
    }

    const visible = visibleCount > 0 && Boolean(media);
    if (container) {
      container.hidden = !visible;
      if (visible && container.parentElement !== media) media.appendChild(container);
      else if (!visible) container.remove();
    }
  }

  function syncHelpButton(theme) {
    const themeConfig = THEMES.find(item => item.id === theme);
    const selectors = bannerContainer;
    const matchingBanner = themeConfig?.panelProfile && selectors
      ? [...selectors.querySelectorAll(`.${BANNER_CLASS}`)]
        .find(item => item.dataset.panelProfile === themeConfig.panelProfile && !item.hidden)
      : null;
    const bannerVisible = Boolean(
      matchingBanner && selectors && !selectors.hidden && selectors.isConnected
    );
    const available = Boolean(
      themeConfig?.helpLabel && themeConfig.panelProfile && bannerVisible &&
      root.dataset.siteCurationHelp === themeConfig.panelProfile
    );
    root.dataset.visualHelp = String(available);
    let button = document.querySelector(`.${HELP_BUTTON_CLASS}`) ||
      selectors?.querySelector(`.${HELP_BUTTON_CLASS}`);

    if (!available) {
      button?.remove();
      if (selectors) {
        selectors.style.flexDirection = '';
        selectors.style.alignItems = '';
        selectors.style.gap = '';
      }
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

    // Ajuda e banner são uma unidade visual da curadoria: o botão nunca vive sozinho.
    if (button.parentElement !== selectors) selectors.appendChild(button);
    selectors.style.flexDirection = 'column';
    selectors.style.alignItems = 'center';
    selectors.style.gap = '8px';
    button.style.position = 'static';
    button.style.top = '';
    button.style.right = '';
    button.style.zIndex = '';
    button.style.alignSelf = 'center';

    button.textContent = themeConfig.helpLabel;
    button.setAttribute('aria-label', `${themeConfig.helpLabel} — ${themeConfig.profileLabel || themeConfig.label}`);
  }

  function syncExperience() {
    // Primeiro sincroniza a curadoria visível; depois visual e ajuda derivam dela.
    syncBanners();
    const requested = automaticTheme();
    const next = allowed.has(requested) ? requested : 'padrao';
    const changed = root.dataset.visualTheme !== next;
    root.dataset.visualTheme = next;
    updateBrowserColor(next);
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