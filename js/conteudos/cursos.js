(() => {
  'use strict';

  const PANEL_LIMIT = 15;

  function normalizeTheme(value = '') {
    return String(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function formatWorkload(value = '') {
    const text = String(value || '').trim();
    if (!text) return '';
    if (/\b(?:hora|horas|h)\b/i.test(text)) return text;
    return `${text} horas`;
  }

  function muralDateKey(referenceDate = new Date()) {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).formatToParts(referenceDate);
      const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
      if (values.year && values.month && values.day) {
        return values.year + '-' + values.month + '-' + values.day;
      }
    } catch {
      /* fallback local abaixo */
    }
    return [
      referenceDate.getFullYear(),
      String(referenceDate.getMonth() + 1).padStart(2, '0'),
      String(referenceDate.getDate()).padStart(2, '0')
    ].join('-');
  }

  function normalizeDateKey(value = '') {
    const raw = String(value || '').trim();
    let match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) return raw;
    match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return '';
    return match[3] + '-' + match[2] + '-' + match[1];
  }

  function isTemporallyVisible(course, referenceDate = new Date()) {
    if (!course || course.exibicao_ativa === false) return false;
    const today = muralDateKey(referenceDate);
    const temporal = course.temporalidade && typeof course.temporalidade === 'object'
      ? course.temporalidade
      : null;

    if (temporal) {
      const exhibition = temporal.exibicao && typeof temporal.exibicao === 'object'
        ? temporal.exibicao
        : {};
      if (exhibition.ativa === false) return false;
      const exhibitionStart = normalizeDateKey(exhibition.inicio);
      const exhibitionEnd = normalizeDateKey(exhibition.fim);
      if (exhibitionStart && today < exhibitionStart) return false;
      if (exhibitionEnd && today > exhibitionEnd) return false;

      const accessWindows = (Array.isArray(temporal.participacao) ? temporal.participacao : [])
        .filter(window => window && window.tipo === 'acesso');

      if (accessWindows.length) {
        return accessWindows.some(window => {
          const start = normalizeDateKey(window.inicio);
          const end = normalizeDateKey(window.fim);
          const status = normalizeTheme(window.status);
          if (['encerrado', 'fechado', 'indisponivel'].includes(status)) return false;
          if (start && today < start) return false;
          if (end && today > end) return false;
          return true;
        });
      }

      // Com contrato canônico presente, data_lancamento e prazo em dias não são
      // usados como fallback de validade.
      return true;
    }

    // Compatibilidade com catálogos anteriores a ATC5.7.
    const legacyDeadline = normalizeDateKey(course.data_limite_conclusao);
    return !legacyDeadline || today <= legacyDeadline;
  }

  function isPublishable(course, referenceDate = new Date()) {
    return Boolean(
      course &&
      course.titulo &&
      course.exibicao_ativa !== false &&
      isTemporallyVisible(course, referenceDate)
    );
  }

  function matchesTheme(course, theme = '') {
    const wanted = normalizeTheme(theme);
    if (!wanted) return true;

    return (Array.isArray(course?.temas) ? course.temas : [])
      .map(normalizeTheme)
      .some(value => value === wanted || value.includes(wanted));
  }

  function normalizeOption(value = '') {
    return normalizeTheme(value);
  }

  function workloadHours(value = '') {
    const match = String(value || '').replace(',', '.').match(/\d+(?:\.\d+)?/);
    if (!match) return null;
    const hours = Number(match[0]);
    return Number.isFinite(hours) && hours >= 0 ? hours : null;
  }

  function workloadMatches(value, band = '') {
    if (!band) return true;
    const hours = workloadHours(value);
    if (hours === null) return band === 'nao-informada';
    if (band === 'ate-10') return hours <= 10;
    if (band === '11-20') return hours > 10 && hours <= 20;
    if (band === '21-40') return hours > 20 && hours <= 40;
    if (band === 'mais-40') return hours > 40;
    return true;
  }

  function certificateMatches(course, value = '') {
    if (!value) return true;
    if (value === 'yes') return course?.certificado === true;
    if (value === 'no') return course?.certificado === false;
    if (value === 'unknown') return typeof course?.certificado !== 'boolean';
    return true;
  }

  function scalarOptions(courses, field) {
    const values = new Map();
    for (const course of Array.isArray(courses) ? courses : []) {
      if (!isPublishable(course)) continue;
      const label = String(course?.[field] || '').trim();
      const value = normalizeOption(label);
      if (label && value && !values.has(value)) values.set(value, label);
    }
    return [...values.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  }

  function filter(courses, options = {}) {
    const filters = options && typeof options === 'object' ? options : {};
    const theme = filters.theme || '';
    const institution = normalizeOption(filters.institution || '');
    const area = normalizeOption(filters.area || '');
    const type = normalizeOption(filters.type || '');
    const level = normalizeOption(filters.level || '');
    const language = normalizeOption(filters.language || '');

    return (Array.isArray(courses) ? courses : [])
      .filter(isPublishable)
      .filter(course => matchesTheme(course, theme))
      .filter(course => !institution || normalizeOption(course.instituicao) === institution)
      .filter(course => !area || normalizeOption(course.area) === area)
      .filter(course => !type || normalizeOption(course.tipo) === type)
      .filter(course => !level || normalizeOption(course.nivel) === level)
      .filter(course => !language || normalizeOption(course.idioma) === language)
      .filter(course => workloadMatches(course.carga_horaria, filters.workload || ''))
      .filter(course => certificateMatches(course, filters.certificate || ''))
      .sort((a, b) =>
        String(a.titulo || '').localeCompare(String(b.titulo || ''), 'pt-BR')
      );
  }

  function sampleForPanel(courses, limit = PANEL_LIMIT, options = {}) {
    const available = filter(courses, options);
    return window.MuralCultural.core.sampleForPanel(available, limit, options);
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
      course.publico_alvo,
      course.tipo,
      course.nivel,
      course.idioma,
      course.carga_horaria
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
    slide.classList.add('course-slide');
    buildSiteQr(slide, course);

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
      when.textContent = formatWorkload(course.carga_horaria) || 'Curso online';
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
    if (sourceLabel) {
      sourceLabel.textContent = course.site_only
        ? 'Curso externo • Curadoria site-only'
        : 'Curso online gratuito';
    }

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
    if (updated) updated.textContent = course.situacao || course.area || '';

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
    const summary = item.descricao || item.competencias || item.publico_alvo || '';
    const schedule = [
      formatWorkload(item.carga_horaria) || 'Formação online',
      item.situacao || ''
    ].filter(Boolean).join(' · ');
    article.innerHTML = `<div class="agenda-card-media course-media">${image ? `<img src="${escapeHtml(image)}" alt="Imagem: ${escapeHtml(item.titulo || 'Curso')}" loading="lazy">` : '<div class="film-poster-fallback" role="img" aria-label="Imagem não disponível para este curso"><span aria-hidden="true">🎓</span><strong>Imagem não disponível</strong></div>'}</div><div class="agenda-card-body"><div class="agenda-card-badges"><span>Curso</span><span>Online</span><span>Gratuito</span>${item.site_only ? '<span>Curadoria site-only</span>' : ''}</div><p class="agenda-card-date">${escapeHtml(schedule)}</p><h2>${escapeHtml(item.titulo || 'Curso')}</h2><p class="agenda-card-place">${escapeHtml([item.instituicao, item.fonte].filter(Boolean).join(' · ') || 'Instituição')}</p><p class="agenda-card-description">${escapeHtml(summary)}</p><div class="agenda-card-actions">${link ? `<a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">Acessar curso</a>` : ''}</div></div>`;

    return article;
  }

  const mural = window.MuralCultural || (window.MuralCultural = {});
  const contents = mural.contents || (mural.contents = {});
  contents.courses = Object.freeze({
    PANEL_LIMIT,
    muralDateKey,
    normalizeDateKey,
    isTemporallyVisible,
    isPublishable,
    matchesTheme,
    filter,
    scalarOptions,
    workloadHours,
    workloadMatches,
    certificateMatches,
    sampleForPanel,
    agendaQueryMatches,
    createPanelSlide,
    createAgendaCard
  });
})();
