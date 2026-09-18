(() => {
  'use strict';

  const DESKTOP_QUERY = '(min-width: 761px)';
  const media = window.matchMedia(DESKTOP_QUERY);

  function dockSlideQr(slide) {
    if (!(slide instanceof Element)) return;

    const qr = slide.querySelector('.site-qr-wrap');
    const footer = slide.querySelector('.footer');
    const topbar = slide.querySelector('.topbar');
    if (!qr || !footer || !topbar) return;

    const shouldDock = document.body.classList.contains('panel-mode') && media.matches;
    const target = shouldDock ? footer : topbar;

    if (qr.parentElement !== target) {
      target.appendChild(qr);
    }

    slide.dataset.siteQrDocked = shouldDock ? 'footer' : 'topbar';
  }

  function scan(root = document) {
    if (root.matches?.('.slide')) dockSlideQr(root);
    root.querySelectorAll?.('.slide').forEach(dockSlideQr);
  }

  function refresh() {
    scan(document);
  }

  function boot() {
    refresh();

    const observer = new MutationObserver(() => {
      requestAnimationFrame(refresh);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', refresh);
    } else if (typeof media.addListener === 'function') {
      media.addListener(refresh);
    }

    window.addEventListener('pageshow', refresh);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
