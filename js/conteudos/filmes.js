(() => {
  'use strict';

  const root = window.MuralCultural = window.MuralCultural || {};
  root.contents = root.contents || {};

  const text = value => String(value || '').trim();
  const list = value => Array.isArray(value) ? value.map(text).filter(Boolean) : [];
  const titleCompare = (a, b) => text(a.titulo).localeCompare(text(b.titulo), 'pt-BR');

  function queryMatches(movie, query, normalizeText) {
    const needle = normalizeText(query);
    if (!needle) return true;
    const haystack = normalizeText([
      movie.titulo,
      ...list(movie.direcao),
      movie.sinopse,
      ...list(movie.generos),
      ...list(movie.temas)
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

  function createAgendaCard(movie, helpers) {
    const escapeHtml = helpers.escapeHtml;
    const article = document.createElement('article');
    article.className = 'agenda-card agenda-film-card';
    const genres = list(movie.generos);
    const themes = list(movie.temas);
    const tags = [...genres, ...themes].slice(0, 3);
    const direction = list(movie.direcao).join(', ');
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
          <span>${escapeHtml(movie.plataforma || 'LGBTFlix')}</span>
          ${tags.map(tag => `<span>${escapeHtml(tag)}</span>`).join('')}
        </div>
        ${movie.sinopse ? `<p class="agenda-card-description">${escapeHtml(movie.sinopse)}</p>` : ''}
        <div class="agenda-card-actions">
          <button type="button" class="film-details-button">Ver detalhes</button>
          <a href="${escapeHtml(movie.pagina_oficial)}" target="_blank" rel="noopener noreferrer" aria-label="Assistir gratuitamente ${escapeHtml(movie.titulo)} no LGBTFlix (abre em nova guia)">Assistir gratuitamente</a>
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
          <p class="agenda-eyebrow">Filme gratuito no LGBTFlix</p>
          <h2 id="film-dialog-title">${escapeHtml(movie.titulo)}</h2>
          ${facts ? `<p class="film-dialog-facts">${escapeHtml(facts)}</p>` : ''}
          ${movie.sinopse ? `<p class="film-dialog-synopsis">${escapeHtml(movie.sinopse)}</p>` : ''}
          <div class="film-dialog-sections">
            ${detailSection('Direção', movie.direcao, escapeHtml)}
            ${detailSection('Gêneros', movie.generos, escapeHtml)}
            ${detailSection('Temas', movie.temas, escapeHtml)}
            ${detailSection('Letras', movie.letras, escapeHtml)}
            ${detailSection('Coleções', movie.colecoes, escapeHtml)}
            ${detailSection('Alertas de conteúdo', movie.alertas, escapeHtml)}
            ${detailSection('Prêmios', movie.premios, escapeHtml)}
            ${detailSection('Plataforma', movie.plataforma, escapeHtml)}
          </div>
          <a class="film-watch-link" href="${escapeHtml(movie.pagina_oficial)}" target="_blank" rel="noopener noreferrer">Assistir gratuitamente no LGBTFlix <span aria-hidden="true">↗</span></a>
          <p class="film-rights-note">O Mural Cultural não hospeda este filme. ${movie.imagem ? 'Imagem oficial do LGBTFlix; licença não verificada.' : 'Cartaz não fornecido pela fonte.'}</p>
        </div>
      </div>`;
    const close = dialog.querySelector('.film-dialog-close');
    close.addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => opener?.focus(), { once: true });
    dialog.showModal();
    close.focus();
  }

  root.contents.films = {
    createAgendaCard,
    durationMatches,
    filter,
    options,
    queryMatches,
    showDetails,
    sort
  };
})();
