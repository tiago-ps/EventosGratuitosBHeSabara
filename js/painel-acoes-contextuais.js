(() => {
  'use strict';

  const GENERIC_SOURCE_LABELS = new Set([
    'programação e inscrição',
    'programacao e inscricao',
    'curso online gratuito',
    'concurso público',
    'concurso publico',
    'filme gratuito em plataforma oficial',
    'encontre este livro',
    'serviço público',
    'servico publico'
  ]);

  function normalize(value = '') {
    return String(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function visibleBook(slide) {
    const book = slide.querySelector('.book-copy');
    return Boolean(book && !book.hidden);
  }

  function slideType(slide) {
    if (visibleBook(slide)) return 'book';
    if (slide.classList.contains('course-slide')) return 'course';
    if (slide.classList.contains('contest-slide')) return 'contest';
    if (slide.classList.contains('film-slide')) return 'film';
    if (slide.classList.contains('utility-slide')) return 'utility';
    return 'event';
  }

  function rendered(slide) {
    if (visibleBook(slide)) {
      return Boolean(slide.querySelector('.book-title')?.textContent.trim());
    }
    return Boolean(slide.querySelector('.event-title')?.textContent.trim());
  }

  function sourceAnchor(slide) {
    return slide.querySelector('.source-url a[href]');
  }

  function safeHref(anchor) {
    if (!anchor) return '';
    try {
      const url = new URL(anchor.href, window.location.href);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch {
      return '';
    }
  }

  function sourceFromHref(href) {
    if (!href) return '';
    try {
      const host = new URL(href).hostname.replace(/^www\./, '').toLowerCase();
      const known = [
        ['telabrasil.cultura.gov.br', 'Tela Brasil'],
        ['ccbb.com.br', 'CCBB'],
        ['gov.br', 'Portal oficial do Governo'],
        ['pciconcursos.com.br', 'PCI Concursos'],
        ['ifmg.edu.br', 'IFMG']
      ];
      const hit = known.find(([domain]) => host === domain || host.endsWith(`.${domain}`));
      return hit?.[1] || host;
    } catch {
      return '';
    }
  }

  function preferredSource(slide, type, href) {
    if (type === 'book') return 'Catálogo da biblioteca';

    const current = slide.querySelector('.source-label')?.textContent.trim() || '';
    if (current && !GENERIC_SOURCE_LABELS.has(normalize(current))) {
      return current;
    }

    return sourceFromHref(href) || 'Fonte oficial';
  }

  function actionConfig(type, currentText = '') {
    const normalized = normalize(currentText);

    if (type === 'course') {
      return { label: 'Acesso', button: 'Acessar curso' };
    }
    if (type === 'contest') {
      return { label: 'Edital e inscrição', button: 'Ver concurso e edital' };
    }
    if (type === 'film') {
      return {
        label: 'Onde assistir',
        button: currentText && !/^https?:/i.test(currentText) ? currentText : 'Assistir filme'
      };
    }
    if (type === 'utility') {
      const help = /ajuda|contato|endere|atendimento|telefone/.test(normalized);
      return {
        label: help ? 'Onde buscar ajuda' : 'Como acessar',
        button: currentText && !/^https?:/i.test(currentText) ? currentText : (help ? 'Ver contatos e endereços' : 'Ver informações')
      };
    }
    return { label: 'Participação', button: 'Ver página oficial' };
  }

  function supportText(slide, type) {
    const current = slide.querySelector('.source-label')?.textContent.trim() || '';
    if (!current || GENERIC_SOURCE_LABELS.has(normalize(current))) return '';

    if (type === 'utility') return current;
    if (type === 'film') return current;
    return '';
  }

  function appendDetail(details, label, value, className = '') {
    if (!details || !value) return;
    const row = document.createElement('div');
    if (className) row.className = className;
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = label;
    dd.textContent = value;
    row.append(dt, dd);
    details.appendChild(row);
  }

  function moveCourseArea(slide, details) {
    if (!slide.classList.contains('course-slide')) return;
    const updated = slide.querySelector('.updated');
    const text = updated?.textContent.trim() || '';
    if (!text || /atualizad|\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}/i.test(text)) return;

    const already = [...details.querySelectorAll('dt')]
      .some(dt => normalize(dt.textContent) === 'area');
    if (!already) appendDetail(details, 'Área', text, 'panel-context-info');
    updated.textContent = '';
  }

  function addContextAction(slide, type, anchor, href) {
    if (type === 'book' || !href) return;

    const details = slide.querySelector('.details');
    if (!details || details.querySelector('.panel-context-action')) return;

    moveCourseArea(slide, details);

    const cfg = actionConfig(type, anchor?.textContent.trim() || '');
    const row = document.createElement('div');
    row.className = 'panel-context-action';

    const dt = document.createElement('dt');
    dt.textContent = cfg.label;

    const dd = document.createElement('dd');
    const support = supportText(slide, type);
    if (support) {
      const p = document.createElement('p');
      p.className = 'panel-context-support';
      p.textContent = support;
      dd.appendChild(p);
    }

    const action = document.createElement('a');
    action.className = 'panel-context-action-link';
    action.href = href;
    action.target = '_blank';
    action.rel = 'noopener noreferrer';
    action.textContent = cfg.button;
    action.setAttribute('aria-label', cfg.button);
    dd.appendChild(action);

    row.append(dt, dd);
    details.appendChild(row);
    details.classList.add('has-context-action');
  }

  function simplifyFooter(slide, type, href) {
    const footer = slide.querySelector('.footer');
    if (!footer) return;

    footer.classList.add('panel-provenance-footer');

    const sourceLabel = footer.querySelector('.source-label');
    const sourceUrl = footer.querySelector('.source-url');
    const updated = footer.querySelector('.updated');

    const source = preferredSource(slide, type, href);
    if (sourceLabel) {
      sourceLabel.replaceChildren();
      const strong = document.createElement('strong');
      strong.textContent = 'Fonte: ';
      sourceLabel.append(strong, document.createTextNode(source));
    }

    if (sourceUrl) sourceUrl.hidden = true;

    if (updated) {
      const text = updated.textContent.trim();
      if (!text) {
        updated.hidden = true;
      } else {
        updated.hidden = false;
      }
    }
  }

  function enhanceSlide(slide) {
    if (!(slide instanceof Element)) return;
    if (slide.dataset.contextActionsReady === 'true') return;
    if (!rendered(slide)) return;

    const type = slideType(slide);
    const anchor = sourceAnchor(slide);
    const href = safeHref(anchor);

    addContextAction(slide, type, anchor, href);
    simplifyFooter(slide, type, href);

    slide.dataset.contextActionsReady = 'true';
  }

  function scan(root = document) {
    if (root.matches?.('.slide')) enhanceSlide(root);
    root.querySelectorAll?.('.slide').forEach(enhanceSlide);
  }

  function boot() {
    const app = document.getElementById('app');
    if (!app) return;

    scan(app);

    let scheduled = false;
    const observer = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        scan(app);
      });
    });

    observer.observe(app, { childList: true, subtree: true, characterData: true, attributes: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
