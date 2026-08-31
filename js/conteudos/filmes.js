(() => {
  'use strict';

  const root = window.MuralCultural = window.MuralCultural || {};
  root.contents = root.contents || {};

  const text = value => String(value || '').trim();
  const list = value => Array.isArray(value) ? value.map(text).filter(Boolean) : [];
  const titleCompare = (a, b) => text(a.titulo).localeCompare(text(b.titulo), 'pt-BR');
  const platformName = movie => text(movie?.plataforma) || 'plataforma oficial';
  const PANEL_LIMIT = 15;

  function queryMatches(movie, query, normalizeText) {
    const needle = normalizeText(query);
    if (!needle) return true;
    const haystack = normalizeText([
      movie.titulo,
      ...list(movie.direcao),
      ...list(movie.elenco),
      movie.sinopse,
      ...list(movie.generos),
      ...list(movie.temas),
      ...list(movie.acessibilidade),
      platformName(movie)
    ].join(' '));
    return haystack.includes(needle);
  }

  function valueMatches(values, expected, normalizeText) {
    if (!expected) return true;
    const needle = normalizeText(expected);
    return list(values).some(value => normalizeText(value) === needle);
  }

  function durationMatches(duration, band) {
    if (!band) return true;
    const minutes = Number(duration);
    if (!Number.isFinite(minutes) || minutes <= 0) return band === 'nao-informada';
    if (band === 'ate-30') return minutes <= 30;
    if (band === '31-60') return minutes >= 31 && minutes <= 60;
    if (band === 'mais-60') return minutes > 60;
    return true;
  }

  function sort(movies, order = 'title-asc') {
    const numeric = (movie, field) => {
      const value = Number(movie[field]);
      return Number.isFinite(value) && value > 0 ? value : null;
    };
    const compareNumeric = (a, b, field, direction) => {
      const left = numeric(a, field);
      const right = numeric(b, field);
      if (left === null && right === null) return titleCompare(a, b);
      if (left === null) return 1;
      if (right === null) return -1;
      return (left - right) * direction || titleCompare(a, b);
    };

    return [...movies].sort((a, b) => {
      if (order === 'year-desc') return compareNumeric(a, b, 'ano', -1);
      if (order === 'year-asc') return compareNumeric(a, b, 'ano', 1);
      if (order === 'duration-asc') return compareNumeric(a, b, 'duracao_minutos', 1);
      if (order === 'duration-desc') return compareNumeric(a, b, 'duracao_minutos', -1);
      return titleCompare(a, b);
    });
  }

  function filter(movies, filters = {}, normalizeText = value => text(value).toLowerCase()) {
    const yearFrom = Number(filters.yearFrom) || 0;
    const yearTo = Number(filters.yearTo) || 0;
    return sort((Array.isArray(movies) ? movies : []).filter(movie => {
      if (!queryMatches(movie, filters.query, normalizeText)) return false;
      if (!valueMatches(movie.generos, filters.genre, normalizeText)) return false;
      if (!valueMatches(movie.temas, filters.theme, normalizeText)) return false;
      if (!valueMatches(movie.letras, filters.letter, normalizeText)) return false;
      if (filters.rating && text(movie.classificacao) !== text(filters.rating)) return false;
      if (yearFrom && (!Number(movie.ano) || Number(movie.ano) < yearFrom)) return false;
      if (yearTo && (!Number(movie.ano) || Number(movie.ano) > yearTo)) return false;
      return durationMatches(movie.duracao_minutos, filters.duration);
    }), filters.sort);
  }

  function options(movies, field) {
    const values = new Map();
    for (const movie of Array.isArray(movies) ? movies : []) {
      for (const value of list(movie[field])) {
        const key = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        if (!values.has(key)) values.set(key, value);
      }
    }
    return [...values.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  function sampleForPanel(movies, filters = {}, normalizeText = value => text(value).toLowerCase(), limit = PANEL_LIMIT, sampleOptions = {}) {
    const available = filter(movies, { ...filters, sort: filters.sort || 'title-asc' }, normalizeText);
    const sampler = root.core?.sampleForPanel;
    return typeof sampler === 'function' ? sampler(available, limit, sampleOptions) : available.slice(0, limit);
  }

  function createPanelSlide({ movie, index, total, template, helpers }) {
    const {
      buildSiteQr,
      slideDurationFor,
      configureItemQrLabel,
      buildQr,
      safeExternalUrl,
      safeImageUrl,
      normalizeRating
    } = helpers;
    const slide = template.content.firstElementChild.cloneNode(true);
    buildSiteQr(slide);
    slide.classList.add('film-slide');

    const seconds = slideDurationFor(movie);
    slide.style.setProperty('--slide-seconds', `${seconds}s`);
    slide.querySelector('.counter').textContent = `${index + 1} de ${total}`;

    const eventCopy = slide.querySelector('.event-copy');
    const bookCopy = slide.querySelector('.book-copy');
    if (bookCopy) bookCopy.hidden = true;
    if (eventCopy) eventCopy.hidden = false;

    const category = slide.querySelector('.category');
    if (category) {
      category.hidden = false;
      category.textContent = 'FILME';
    }
    const free = slide.querySelector('.free');
    if (free) {
      free.hidden = false;
      free.textContent = 'GRATUITO';
    }

    const ratingBadge = slide.querySelector('.badge.rating');
    const rating = normalizeRating?.(movie.classificacao);
    if (ratingBadge && rating) {
      ratingBadge.hidden = false;
      ratingBadge.className = `badge rating ${rating.className}`;
      ratingBadge.textContent = rating.label;
      ratingBadge.setAttribute('aria-label', `Classificação indicativa: ${rating.accessible}`);
    } else if (ratingBadge) {
      ratingBadge.hidden = true;
      ratingBadge.textContent = '';
    }

    const platform = platformName(movie);
    const platformBadge = slide.querySelector('.badge.city');
    if (platformBadge) {
      platformBadge.hidden = false;
      platformBadge.className = 'badge film-platform';
      platformBadge.textContent = platform;
      platformBadge.removeAttribute('style');
    }

    const title = slide.querySelector('.event-title');
    if (title) title.textContent = movie.titulo || 'Filme';
    const description = slide.querySelector('.description');
    if (description) description.textContent = movie.sinopse || movie.tagline || '';

    const when = slide.querySelector('.when');
    if (when) {
      const label = when.closest('div')?.querySelector('dt');
      if (label) label.textContent = 'Informações';
      when.textContent = [
        movie.ano ? String(movie.ano) : '',
        movie.duracao_minutos ? `${movie.duracao_minutos} min` : ''
      ].filter(Boolean).join(' · ') || 'Informações não disponíveis';
    }

    const where = slide.querySelector('.where-text');
    if (where) {
      const label = where.closest('div')?.querySelector('dt');
      if (label) label.textContent = 'Direção';
      const direction = list(movie.direcao).join(', ');
      const genres = list(movie.generos).join(' · ');
      where.textContent = direction || genres || 'Consulte a ficha do filme';
    }
    const mapLink = slide.querySelector('.map-link');
    if (mapLink) mapLink.remove();

    const link = safeExternalUrl(movie.pagina_oficial);
    const sourceLabel = slide.querySelector('.source-label');
    if (sourceLabel) sourceLabel.textContent = 'Filme gratuito na plataforma oficial';
    const source = slide.querySelector('.source-url');
    if (source) {
      if (link) {
        const anchor = document.createElement('a');
        anchor.href = link;
        anchor.textContent = `Acessar no ${platform}`;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        source.replaceChildren(anchor);
      } else {
        source.textContent = platform;
      }
    }
    const updated = slide.querySelector('.updated');
    if (updated) updated.textContent = list(movie.generos).slice(0, 3).join(' · ');

    const qr = slide.querySelector('.qr-code');
    configureItemQrLabel(slide, movie, Boolean(link));
    if (qr && link) buildQr(qr, link);

    const subtitle = slide.querySelector('.panel-subtitle');
    if (subtitle) subtitle.textContent = 'Sugestão de Filme';

    const imageUrl = safeImageUrl(movie.imagem);
    const image = slide.querySelector('.event-image');
    const fallback = slide.querySelector('.image-fallback');
    const fallbackIcon = slide.querySelector('.fallback-icon');
    const fallbackLabel = slide.querySelector('.fallback-label');
    if (fallbackIcon) fallbackIcon.textContent = '🎬';
    if (fallbackLabel) fallbackLabel.textContent = 'Filme';
    if (fallback) {
      fallback.hidden = false;
      fallback.style.display = imageUrl ? 'none' : 'grid';
    }
    if (image) {
      image.alt = `Cartaz do filme ${movie.titulo || 'Filme'}`;
      image.decoding = 'async';
      image.loading = 'eager';
      image.referrerPolicy = 'no-referrer';
      image.classList.remove('loaded');
      image.style.display = imageUrl ? '' : 'none';
      image.onload = () => {
        image.classList.add('loaded');
        if (fallback) fallback.style.display = 'none';
      };
      image.onerror = () => {
        image.classList.remove('loaded');
        image.style.display = 'none';
        if (fallback) fallback.style.display = 'grid';
      };
      if (imageUrl) image.src = imageUrl;
      else image.removeAttribute('src');
    }

    return slide;
  }

  function createAgendaCard(movie, helpers) {
    const escapeHtml = helpers.escapeHtml;
    const article = document.createElement('article');
    article.className = 'agenda-card agenda-film-card';
    const genres = list(movie.generos);
    const themes = list(movie.temas);
    const tags = [...genres, ...themes].slice(0, 3);
    const direction = list(movie.direcao).join(', ');
    const platform = platformName(movie);
    const dimensions = movie.imagem_largura && movie.imagem_altura
      ? ` width="${Number(movie.imagem_largura)}" height="${Number(movie.imagem_altura)}"`
      : '';
    const imageRatio = Number(movie.imagem_largura) / Number(movie.imagem_altura);
    const mediaClass = Number.isFinite(imageRatio) && imageRatio > 0 && imageRatio < 1.35
      ? 'film-media film-media-atypical'
      : 'film-media';
    const poster = movie.imagem
      ? `<img src="${escapeHtml(movie.imagem)}" alt="Cartaz do filme ${escapeHtml(movie.titulo)}" loading="lazy" decoding="async"${dimensions}>`
      : `<div class="film-poster-fallback" role="img" aria-label="Cartaz não disponível para o filme ${escapeHtml(movie.titulo)}"><span aria-hidden="true">🎬</span><strong>Cartaz não disponível</strong></div>`;
    const metadata = [
      movie.ano || 'Ano não informado',
      movie.duracao_minutos ? `${movie.duracao_minutos} min` : 'Duração não informada'
    ].join(' · ');

    article.innerHTML = `
      <div class="agenda-card-media ${mediaClass}">${poster}</div>
      <div class="agenda-card-body">
        <p class="agenda-card-date">${escapeHtml(metadata)}</p>
        <h2>${escapeHtml(movie.titulo || 'Filme')}</h2>
        ${direction ? `<p class="agenda-card-place">Direção: ${escapeHtml(direction)}</p>` : ''}
        <div class="film-tags" aria-label="Etiquetas do filme">
          <span>Filme</span>
          <span>${escapeHtml(movie.classificacao || 'Não informada')}</span>
          <span>${escapeHtml(platform)}</span>
          ${tags.map(tag => `<span>${escapeHtml(tag)}</span>`).join('')}
        </div>
        ${movie.sinopse ? `<p class="agenda-card-description">${escapeHtml(movie.sinopse)}</p>` : ''}
        <div class="agenda-card-actions">
          <button type="button" class="film-details-button">Ver detalhes</button>
          <a href="${escapeHtml(movie.pagina_oficial)}" target="_blank" rel="noopener noreferrer" aria-label="Acessar ${escapeHtml(movie.titulo)} no ${escapeHtml(platform)} (abre em nova guia)">Acessar na plataforma</a>
        </div>
      </div>`;
    article.querySelector('.film-details-button').addEventListener('click', event => {
      helpers.showDetails(movie, event.currentTarget);
    });
    return article;
  }

  function detailSection(label, value, escapeHtml) {
    const values = Array.isArray(value) ? list(value) : [text(value)].filter(Boolean);
    if (!values.length) return '';
    return `<section><h3>${escapeHtml(label)}</h3><p>${escapeHtml(values.join(' · '))}</p></section>`;
  }

  function showDetails(movie, opener, escapeHtml) {
    let dialog = document.getElementById('film-details-dialog');
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.id = 'film-details-dialog';
      dialog.className = 'film-dialog';
      dialog.setAttribute('aria-labelledby', 'film-dialog-title');
      dialog.addEventListener('keydown', event => {
        if (event.key === 'Escape' && dialog.open) {
          event.preventDefault();
          dialog.close();
        }
      });
      document.body.append(dialog);
    }
    const platform = platformName(movie);
    const poster = movie.imagem
      ? `<img src="${escapeHtml(movie.imagem)}" alt="Cartaz do filme ${escapeHtml(movie.titulo)}">`
      : `<div class="film-poster-fallback" role="img" aria-label="Cartaz não disponível para o filme ${escapeHtml(movie.titulo)}"><span aria-hidden="true">🎬</span><strong>Cartaz não disponível</strong></div>`;
    const facts = [
      movie.ano ? String(movie.ano) : '',
      movie.duracao_minutos ? `${movie.duracao_minutos} min` : '',
      movie.classificacao ? `Classificação ${movie.classificacao}` : ''
    ].filter(Boolean).join(' · ');
    dialog.innerHTML = `
      <div class="film-dialog-shell">
        <button type="button" class="film-dialog-close" aria-label="Fechar detalhes">×</button>
        <div class="film-dialog-poster">${poster}</div>
        <div class="film-dialog-copy">
          <p class="agenda-eyebrow">Filme gratuito em ${escapeHtml(platform)}</p>
          <h2 id="film-dialog-title">${escapeHtml(movie.titulo)}</h2>
          ${facts ? `<p class="film-dialog-facts">${escapeHtml(facts)}</p>` : ''}
          ${movie.tagline ? `<p class="film-dialog-tagline">${escapeHtml(movie.tagline)}</p>` : ''}
          ${movie.sinopse ? `<p class="film-dialog-synopsis">${escapeHtml(movie.sinopse)}</p>` : ''}
          <div class="film-dialog-sections">
            ${detailSection('Direção', movie.direcao, escapeHtml)}
            ${detailSection('Elenco', movie.elenco, escapeHtml)}
            ${detailSection('Gêneros', movie.generos, escapeHtml)}
            ${detailSection('Temas', movie.temas, escapeHtml)}
            ${detailSection('Acessibilidade', movie.acessibilidade, escapeHtml)}
            ${detailSection('Letras', movie.letras, escapeHtml)}
            ${detailSection('Coleções', movie.colecoes, escapeHtml)}
            ${detailSection('Alertas de conteúdo', movie.alertas, escapeHtml)}
            ${detailSection('Prêmios', movie.premios, escapeHtml)}
            ${detailSection('Plataforma', platform, escapeHtml)}
          </div>
          <a class="film-watch-link" href="${escapeHtml(movie.pagina_oficial)}" target="_blank" rel="noopener noreferrer">Acessar no ${escapeHtml(platform)} <span aria-hidden="true">↗</span></a>
          <p class="film-rights-note">O Mural Cultural não hospeda este filme. ${movie.imagem ? `Imagem fornecida pela plataforma ${escapeHtml(platform)}; licença específica de reutilização não verificada.` : 'Cartaz não fornecido pela fonte.'}</p>
        </div>
      </div>`;
    const close = dialog.querySelector('.film-dialog-close');
    close.addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => opener?.focus(), { once: true });
    dialog.showModal();
    close.focus();
  }

  root.contents.films = {
    PANEL_LIMIT,
    createAgendaCard,
    createPanelSlide,
    durationMatches,
    filter,
    options,
    platformName,
    queryMatches,
    sampleForPanel,
    showDetails,
    sort
  };
})();
