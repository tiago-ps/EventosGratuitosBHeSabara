(() => {
  'use strict';

  const PANEL_COURSE_LIMIT = 15;
  const originalFilter = Array.prototype.filter;
  let panelCourseSample = null;

  function isCourseArray(items) {
    return Array.isArray(items) && items.length > 0 && items.some(item => item?.tipo_conteudo === 'curso');
  }

  function shuffle(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function courseKey(course) {
    return String(course?.id || course?.titulo || '').trim();
  }

  function sampleCourses(items) {
    const publishable = originalFilter.call(items, item => item && item.titulo && item.exibicao_ativa !== false);
    const available = new Map(publishable.map(item => [courseKey(item), item]));
    const sampleStillValid = panelCourseSample && panelCourseSample.every(key => available.has(key));
    if (!sampleStillValid) {
      panelCourseSample = shuffle(publishable).slice(0, PANEL_COURSE_LIMIT).map(courseKey);
    }
    return panelCourseSample.map(key => available.get(key)).filter(Boolean);
  }

  // O app usa filterCourses tanto na Agenda quanto no Painel. A pilha permite
  // limitar apenas rebuildVisibleItems, preservando todos os cursos na Agenda.
  Array.prototype.filter = function muralPanelCourseFilter(callback, thisArg) {
    const result = originalFilter.call(this, callback, thisArg);
    if (!isCourseArray(this)) return result;
    const stack = String(new Error().stack || '');
    if (!stack.includes('filterCourses') || !stack.includes('rebuildVisibleItems')) return result;
    return sampleCourses(result);
  };

  window.addEventListener('beforeunload', () => {
    Array.prototype.filter = originalFilter;
  }, { once: true });

  // Compatibilidade temporária com renderCourseSlide em app.js.
  window.updateCounter = function updateCounter() {
    const slide = document.querySelector('#app .slide');
    const counter = slide?.querySelector('.counter');
    if (!counter) return;
  };

  window.restartProgress = function restartProgress() {
    const progress = document.querySelector('#app .progress span');
    if (!progress) return;
    progress.style.animation = 'none';
    void progress.offsetWidth;
    progress.style.removeProperty('animation');
  };

  function explainCourseLimit() {
    document.querySelectorAll('.panel-course-section p').forEach(text => {
      text.textContent = `Cursos online gratuitos de instituições consolidadas. O painel sorteia até ${PANEL_COURSE_LIMIT} cursos por carregamento.`;
    });

    const panel = document.querySelector('.panel-composer');
    if (!panel) return;
    const events = panel.querySelector('.panel-module-events')?.checked;
    const books = panel.querySelector('.panel-module-books')?.checked;
    const courses = panel.querySelector('.panel-module-courses')?.checked;
    const theme = panel.querySelector('.filter-theme')?.closest('label');
    if (theme) {
      const coursesOnly = courses && !events && !books;
      theme.hidden = coursesOnly;
      theme.title = coursesOnly ? 'O filtro geral de tema não se aplica aos cursos.' : '';
    }
  }

  new MutationObserver(() => requestAnimationFrame(explainCourseLimit))
    .observe(document.getElementById('app') || document.body, { childList: true, subtree: true });
  document.addEventListener('change', event => {
    if (event.target?.matches?.('.panel-module-events, .panel-module-books, .panel-module-courses')) {
      requestAnimationFrame(explainCourseLimit);
    }
  });
  explainCourseLimit();
})();
