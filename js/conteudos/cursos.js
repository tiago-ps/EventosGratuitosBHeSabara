(() => {
  'use strict';

  const PANEL_LIMIT = 15;

  function isPublishable(course) {
    return Boolean(course && course.titulo && course.exibicao_ativa !== false);
  }

  function filter(courses) {
    return (Array.isArray(courses) ? courses : [])
      .filter(isPublishable)
      .sort((a, b) =>
        String(a.titulo || '').localeCompare(String(b.titulo || ''), 'pt-BR')
      );
  }

  function sampleForPanel(courses, limit = PANEL_LIMIT) {
    const available = filter(courses);
    return window.MuralCultural.core.sampleForPanel(available, limit);
  }

  function agendaQueryMatches(course, query, normalizeText) {
    if (!query) return true;
    return normalizeText([
      course.titulo,
      course.instituicao,
      course.instituicao_parceira,
      course.area,
      course.competencias,
      course.descricao,
      course.publico_alvo
    ].filter(Boolean).join(' ')).includes(query);
  }

  function createPanelSlide({
    course,
    index,
    total,
    template,
    helpers
  }) {
    const {
      buildSiteQr,
      slideDurationFor,
      configureItemQrLabel,
      buildQr,
      safeExternalUrl,
      safeImageUrl
    } = helpers;

    // Cursos seguem o mesmo ciclo de Eventos/Livros: cada navegação parte
    // de um template novo, evitando herdar classes/hidden/estilos do slide anterior.
    const slide = template.content.firstElementChild.cloneNode(true);
    buildSiteQr(slide);

    const seconds = slideDurationFor(course);
    slide.style.setProperty('--slide-seconds', `${seconds}s`);
    slide.querySelector('.counter').textContent = `${index + 1} de ${total}`;

    const eventCopy = slide.querySelector('.event-copy');
    const bookCopy = slide.querySelector('.book-copy');
    if (bookCopy) bookCopy.hidden = true;
    if (eventCopy) eventCopy.hidden = false;

    const category = slide.querySelector('.category');
    if (category) {
      category.hidden = false;
      category.textContent = 'CURSO';
    }

    const free = slide.querySelector('.free');
    if (free) {
      free.hidden = false;
      free.textContent = 'GRATUITO';
    }

    const rating = slide.querySelector('.rating');
    if (rating) {
      rating.hidden = true;
      rating.textContent = '';
      rating.className = 'rating';
    }

    // A antiga classe .city é reaproveitada apenas como posição no template.
    // Removemos classes/estilos residuais e aplicamos uma classe própria de curso.
    const online = slide.querySelector('.city');
    if (online) {
      online.hidden = false;
      online.className = 'badge course-online';
      online.textContent = 'ONLINE';
      online.removeAttribute('style');
    }

    const title = slide.querySelector('.event-title');
    if (title) title.textContent = course.titulo || 'Curso online';

    const description = slide.querySelector('.description');
    if (description) {
      description.textContent = course.descricao || course.competencias || '';
    }

    const when = slide.querySelector('.when');
    if (when) {
      when.textContent = course.carga_horaria
        ? `${course.carga_horaria} horas`
        : 'Curso online';
    }

    const where = slide.querySelector('.where-text');
    if (where) {
      where.textContent = course.instituicao || course.fonte || 'Instituição';
    }

    const mapLink = slide.querySelector('.map-link');
    if (mapLink) {
      mapLink.hidden = true;
      mapLink.removeAttribute('href');
    }

    const link = safeExternalUrl(course.url || course.link);
    const sourceLabel = slide.querySelector('.source-label');
    if (sourceLabel) sourceLabel.textContent = 'Curso online gratuito';

    const source = slide.querySelector('.source-url');
    if (source) {
      if (link) {
        const anchor = document.createElement('a');
        anchor.href = link;
        anchor.textContent = 'Acessar página deste curso';
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        source.replaceChildren(anchor);
      } else {
        source.textContent = course.instituicao || '';
      }
    }

    const updated = slide.querySelector('.updated');
    if (updated) updated.textContent = course.area || '';

    const qr = slide.querySelector('.qr-code');
    configureItemQrLabel(slide, course, Boolean(link));
    if (qr && link) {
      buildQr(qr, link);
    } else if (qr) {
      qr.replaceChildren();
    }

    const subtitle = slide.querySelector('.panel-subtitle');
    if (subtitle) subtitle.textContent = 'Curso Online Gratuito';

    const image = safeImageUrl(course.imagem);
    const img = slide.querySelector('.event-image');
    const fallback = slide.querySelector('.image-fallback');
    if (fallback) {
      const fallbackIcon = fallback.querySelector('.fallback-icon');
      const fallbackLabel = fallback.querySelector('.fallback-label');
      if (fallbackIcon) fallbackIcon.textContent = '🎓';
      if (fallbackLabel) {
        fallbackLabel.textContent = course.instituicao || 'Curso online';
      }
      fallback.style.display = image ? 'none' : 'grid';
      fallback.hidden = false;
    }
    if (img) {
      img.alt = `Imagem: ${course.titulo || 'Curso'}`;
      img.decoding = 'async';
      img.loading = 'eager';
      img.classList.remove('loaded');
      img.style.display = image ? '' : 'none';
      img.onload = () => {
        img.classList.add('loaded');
        if (fallback) fallback.style.display = 'none';
      };
      img.onerror = () => {
        img.classList.remove('loaded');
        img.style.display = 'none';
        if (fallback) fallback.style.display = 'grid';
      };
      if (image) img.src = image;
      else img.removeAttribute('src');
    }

    return slide;
  }

  function createAgendaCard(item, helpers) {
    const { safeExternalUrl, safeImageUrl, escapeHtml } = helpers;
    const article = document.createElement('article');
    article.className = 'agenda-card agenda-course-card';

    const link = safeExternalUrl(item.url || item.link);
    const image = safeImageUrl(item.imagem);
    article.innerHTML = `<div class="agenda-card-media course-media">${image ? `<img src="${escapeHtml(image)}" alt="Imagem: ${escapeHtml(item.titulo || 'Curso')}" loading="lazy">` : ''}</div><div class="agenda-card-body"><div class="agenda-card-badges"><span>Curso</span><span>Online</span><span>Gratuito</span></div><p class="agenda-card-date">${escapeHtml(item.carga_horaria ? `${item.carga_horaria} horas` : 'Formação online')}</p><h2>${escapeHtml(item.titulo || 'Curso')}</h2><p class="agenda-card-place">${escapeHtml(item.instituicao || item.fonte || 'Instituição')}</p><p class="agenda-card-description">${escapeHtml(item.descricao || item.competencias || '')}</p><div class="agenda-card-actions">${link ? `<a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">Acessar curso</a>` : ''}</div></div>`;

    return article;
  }

  const mural = window.MuralCultural || (window.MuralCultural = {});
  const contents = mural.contents || (mural.contents = {});
  contents.courses = Object.freeze({
    PANEL_LIMIT,
    isPublishable,
    filter,
    sampleForPanel,
    agendaQueryMatches,
    createPanelSlide,
    createAgendaCard
  });
})();
