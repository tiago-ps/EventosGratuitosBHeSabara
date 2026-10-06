(() => {
  'use strict';

  const root = document.documentElement;
  const PASSIVE_HIDE_DELAY = 4500;
  let passiveHideTimer = null;

  function modeUrl(mode) {
    const url = new URL(window.location.href);
    url.searchParams.delete('selecao');
    url.searchParams.delete('lista');
    if (/\/s\/[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{7}\/?$/i.test(url.pathname)) {
      url.pathname = '/';
    }
    url.searchParams.set('modo', mode);
    return url.href;
  }

  function navigate(mode) {
    window.location.assign(modeUrl(mode));
  }

  function makePassiveButton(className, compact = false) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.setAttribute('aria-label', 'Abrir exibição automática');
    button.title = 'Exibição automática';

    if (compact) {
      button.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <rect x="3" y="5" width="18" height="12" rx="2"></rect>
          <path d="M8 21h8M12 17v4"></path>
        </svg>
      `;
    } else if (className.includes('agenda-more-menu-action')) {
      button.innerHTML = '<span class="agenda-more-action-icon" aria-hidden="true">▶</span><span>Exibição automática</span>';
    } else {
      button.textContent = 'Exibição automática';
    }

    button.addEventListener('click', () => {
      button.closest('.agenda-more-menu')?.removeAttribute('open');
      navigate('passivo');
    });
    return button;
  }

  function prepareAgendaNavigation() {
    if (!document.body.classList.contains('agenda-mode')) return;

    const actions = document.querySelector('.agenda-header-actions');
    const interactiveButton = actions?.querySelector('.view-toggle:not(.passive-view-toggle)');
    if (!actions || !interactiveButton) return;
    const menuList = actions.querySelector('.agenda-more-menu-list');

    if (interactiveButton.dataset.explicitPanelMode !== 'true') {
      interactiveButton.dataset.explicitPanelMode = 'true';
      if (interactiveButton.classList.contains('agenda-more-menu-action')) {
        interactiveButton.innerHTML = '<span class="agenda-more-action-icon" aria-hidden="true">⌨</span><span>Exibição interativa</span>';
      } else {
        interactiveButton.textContent = 'Exibição interativa';
      }
      interactiveButton.title = 'Abrir exibição interativa';
      interactiveButton.setAttribute('aria-label', 'Abrir exibição interativa');
      interactiveButton.addEventListener('click', event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        interactiveButton.closest('.agenda-more-menu')?.removeAttribute('open');
        navigate('interativo');
      }, true);
    }

    if (!actions.querySelector('.passive-view-toggle')) {
      const parent = menuList || actions;
      parent.appendChild(makePassiveButton(
        menuList
          ? 'view-toggle passive-view-toggle agenda-more-menu-action'
          : 'view-toggle passive-view-toggle'
      ));
    }
  }

  function prepareInteractiveNavigation() {
    if (!document.body.classList.contains('panel-mode')) return;
    if (root.dataset.panelExperience !== 'interativo') return;

    const controls = document.querySelector('.controls');
    if (!controls || controls.querySelector('.panel-passive-btn')) return;

    const button = makePassiveButton('control-btn panel-passive-btn', true);
    const agendaButton = controls.querySelector('.view-mode-btn');
    if (agendaButton?.nextSibling) {
      controls.insertBefore(button, agendaButton.nextSibling);
    } else if (agendaButton) {
      controls.appendChild(button);
    } else {
      controls.prepend(button);
    }
  }

  function ensurePassiveExitButton() {
    if (root.dataset.panelExperience !== 'passivo') return;
    if (!document.body.classList.contains('panel-mode')) return;
    if (document.querySelector('.passive-mode-exit')) return;

    const media = document.querySelector('.slide .media');
    if (!media) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'passive-mode-exit';
    button.textContent = 'Exibição interativa';
    button.setAttribute('aria-label', 'Abrir exibição interativa');
    button.addEventListener('click', () => navigate('interativo'));
    media.appendChild(button);
  }

  function showPassiveNavigation() {
    if (root.dataset.panelExperience !== 'passivo') return;
    if (!document.body.classList.contains('panel-mode')) return;

    ensurePassiveExitButton();
    document.body.classList.add('passive-navigation-visible');
    clearTimeout(passiveHideTimer);
    passiveHideTimer = setTimeout(() => {
      document.body.classList.remove('passive-navigation-visible');
    }, PASSIVE_HIDE_DELAY);
  }

  function syncNavigation() {
    prepareAgendaNavigation();
    prepareInteractiveNavigation();
    ensurePassiveExitButton();
  }

  function boot() {
    syncNavigation();

    let scheduled = false;
    const observer = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        syncNavigation();
      });
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

    window.addEventListener('mousemove', showPassiveNavigation, { passive: true });
    window.addEventListener('pointerdown', showPassiveNavigation, { passive: true });
    window.addEventListener('touchstart', showPassiveNavigation, { passive: true });
    window.addEventListener('keydown', showPassiveNavigation);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
