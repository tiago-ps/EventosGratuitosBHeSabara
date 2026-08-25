(() => {
  'use strict';

  const THEME = 'agosto lilas';
  const BODY_CLASS = 'theme-agosto-lilas';
  const BADGE_CLASS = 'campaign-agosto-lilas-badge';
  const BANNER_SRC = 'imagens/curadorias/agosto-lilas-banner.svg';

  function normalize(value = '') {
    return String(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function themeIsActive() {
    if (!document.body.classList.contains('panel-mode')) return false;
    const select = document.querySelector('.filter-theme');
    if (!select) return false;
    const option = select.options?.[select.selectedIndex];
    return normalize(select.value) === THEME || normalize(option?.textContent) === THEME;
  }

  function ensureBadge(media) {
    let badge = media.querySelector(`.${BADGE_CLASS}`);
    if (badge) return badge;

    badge = document.createElement('img');
    badge.className = BADGE_CLASS;
    badge.src = BANNER_SRC;
    badge.alt = 'Agosto Lilás';
    badge.decoding = 'async';
    badge.setAttribute('aria-label', 'Curadoria temática: Agosto Lilás');
    media.appendChild(badge);
    return badge;
  }

  function sync() {
    const active = themeIsActive();
    document.body.classList.toggle(BODY_CLASS, active);

    document.querySelectorAll('.slide .media').forEach(media => {
      const badge = media.querySelector(`.${BADGE_CLASS}`);
      if (active) {
        ensureBadge(media);
      } else if (badge) {
        badge.remove();
      }
    });
  }

  let scheduled = false;
  function scheduleSync() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      sync();
    });
  }

  document.addEventListener('change', event => {
    if (event.target?.matches?.('.filter-theme')) scheduleSync();
  });

  document.addEventListener('click', event => {
    if (event.target?.closest?.('.filter-apply, .filter-clear, .view-toggle')) {
      scheduleSync();
    }
  });

  window.addEventListener('popstate', scheduleSync);
  window.addEventListener('hashchange', scheduleSync);

  const observer = new MutationObserver(scheduleSync);

  function start() {
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });
    scheduleSync();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
