(() => {
  'use strict';

  const QR_QUERY = '(min-width: 761px)';
  const HEADER_QUERY = '(min-width: 851px) and (min-aspect-ratio: 5/4)';
  const qrMedia = window.matchMedia(QR_QUERY);
  const headerMedia = window.matchMedia(HEADER_QUERY);

  function dockSlideQr(slide) {
    if (!(slide instanceof Element)) return;

    const qr = slide.querySelector('.site-qr-wrap');
    const footer = slide.querySelector('.footer');
    const topbar = slide.querySelector('.topbar');
    if (!qr || !footer || !topbar) return;

    const shouldDock = document.body.classList.contains('panel-mode') && qrMedia.matches;
    const target = shouldDock ? footer : topbar;

    if (qr.parentElement !== target) {
      target.appendChild(qr);
    }

    slide.dataset.siteQrDocked = shouldDock ? 'footer' : 'topbar';
  }

  function visibleBadges(slide) {
    return (
      slide.querySelector('.event-copy:not([hidden]) > .badges') ||
      slide.querySelector('.book-copy:not([hidden]) > .badges')
    );
  }

  function syncHeaderBadges(slide) {
    if (!(slide instanceof Element)) return;

    const brand = slide.querySelector('.panel-brand');
    if (!brand) return;

    let mirror = brand.querySelector('.panel-badges');
    const shouldDock = document.body.classList.contains('panel-mode') && headerMedia.matches;

    if (!shouldDock) {
      mirror?.remove();
      delete slide.dataset.panelBadgesDocked;
      return;
    }

    const source = visibleBadges(slide);
    if (!source) {
      mirror?.remove();
      delete slide.dataset.panelBadgesDocked;
      return;
    }

    if (!mirror) {
      mirror = document.createElement('div');
      mirror.className = 'panel-badges';
      mirror.setAttribute('aria-label', 'Características do conteúdo');
      brand.appendChild(mirror);
    }

    const signature = source.innerHTML;
    if (mirror.dataset.signature !== signature) {
      mirror.replaceChildren(...[...source.children].map(item => item.cloneNode(true)));
      mirror.dataset.signature = signature;
    }

    slide.dataset.panelBadgesDocked = 'header';
  }

  function syncSlide(slide) {
    dockSlideQr(slide);
    syncHeaderBadges(slide);
  }

  function scan(root = document) {
    if (root.matches?.('.slide')) syncSlide(root);
    root.querySelectorAll?.('.slide').forEach(syncSlide);
  }

  function refresh() {
    scan(document);
  }

  function observeMedia(media) {
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', refresh);
    } else if (typeof media.addListener === 'function') {
      media.addListener(refresh);
    }
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
      attributeFilter: ['class', 'hidden']
    });

    observeMedia(qrMedia);
    observeMedia(headerMedia);
    window.addEventListener('pageshow', refresh);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
