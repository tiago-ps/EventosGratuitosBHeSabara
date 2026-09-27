(() => {
  'use strict';

  const root = window.MuralCultural = window.MuralCultural || {};
  root.contents = root.contents || {};

  const WEEKDAYS = Object.freeze({
    segunda: 'segunda', terca: 'terça', quarta: 'quarta', quinta: 'quinta',
    sexta: 'sexta', sabado: 'sábado', domingo: 'domingo'
  });

  function text(value) {
    return String(value == null ? '' : value).trim();
  }

  function appendText(parent, tag, value, className) {
    const content = text(value);
    if (!content) return null;
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = content;
    parent.appendChild(element);
    return element;
  }

  function isValid(item) {
    return Boolean(item && item.tipo_conteudo === 'atividade_lazer' && item.id && item.titulo && item.gratuito === true);
  }

  function city(item) {
    return text(item?.local?.cidade || item?.abrangencia?.cidade);
  }

  function categoryLabel(value) {
    return ({
      atividade_fisica: 'Atividade física',
      esporte: 'Esporte',
      lazer_recreacao: 'Lazer e recreação',
      pratica_integrativa: 'Prática integrativa',
      trilha_passeio: 'Trilha e passeio'
    })[text(value)] || text(value);
  }

  function scheduleLabel(item) {
    const agenda = item?.agenda || {};
    const days = (Array.isArray(agenda.dias_semana) ? agenda.dias_semana : [])
      .map(day => WEEKDAYS[text(day)] || text(day))
      .filter(Boolean);
    const times = (Array.isArray(agenda.horarios) ? agenda.horarios : []).map(text).filter(Boolean);
    if (days.length && times.length) return days.join(', ') + ' · ' + times.join(' · ');
    if (days.length) return days.join(', ');
    if (times.length) return times.join(' · ');
    return text(agenda.observacao);
  }

  function searchText(item) {
    return [
      item.titulo, item.descricao, item.programa_id, categoryLabel(item.categoria),
      city(item), item?.local?.nome, item?.local?.bairro,
      ...(Array.isArray(item.modalidades) ? item.modalidades : []),
      ...(Array.isArray(item.publicos_alvo) ? item.publicos_alvo : []),
      ...(Array.isArray(item.temas) ? item.temas : []),
      ...(Array.isArray(item.termos_busca) ? item.termos_busca : [])
    ].filter(Boolean).join(' ');
  }

  function filter(items, filters, normalizeText) {
    const query = normalizeText(filters?.query || '');
    const wantedCity = normalizeText(filters?.city || '');
    const wantedCategory = text(filters?.category);
    const wantedModality = normalizeText(filters?.modality || '');
    const wantedTheme = normalizeText(filters?.theme || '');
    return (Array.isArray(items) ? items : []).filter(isValid).filter(item => {
      if (wantedCity && normalizeText(city(item)) !== wantedCity) return false;
      if (wantedCategory && text(item.categoria) !== wantedCategory) return false;
      if (wantedModality && !(Array.isArray(item.modalidades) ? item.modalidades : [])
        .some(value => normalizeText(value) === wantedModality)) return false;
      if (wantedTheme && !(Array.isArray(item.temas) ? item.temas : [])
        .some(value => normalizeText(value) === wantedTheme)) return false;
      return !query || normalizeText(searchText(item)).includes(query);
    });
  }

  function optionPairs(items, extractor, normalizeText) {
    const values = new Map();
    for (const item of Array.isArray(items) ? items : []) {
      for (const raw of extractor(item)) {
        const label = text(raw);
        const value = normalizeText(label);
        if (label && value && !values.has(value)) values.set(value, label);
      }
    }
    return [...values.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  }

  function cityOptions(items, normalizeText) {
    return optionPairs(items, item => [city(item)], normalizeText);
  }

  function categoryOptions(items) {
    const values = new Map();
    for (const item of Array.isArray(items) ? items : []) {
      const value = text(item?.categoria);
      if (value && !values.has(value)) values.set(value, categoryLabel(value));
    }
    return [...values.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  }

  function modalityOptions(items, normalizeText) {
    return optionPairs(items, item => Array.isArray(item?.modalidades) ? item.modalidades : [], normalizeText);
  }

  function createPanelSlide(args) {
    const item = args.movie;
    const slide = args.template.content.firstElementChild.cloneNode(true);
    const helpers = args.helpers;
    helpers.buildSiteQr(slide);
    slide.classList.add('activity-slide');
    slide.setAttribute('aria-label', 'Esporte e Lazer: ' + (item.titulo || 'Atividade gratuita'));

    const seconds = helpers.slideDurationFor(item);
    slide.style.setProperty('--slide-seconds', String(seconds) + 's');
    slide.querySelector('.counter').textContent = String(args.index + 1) + ' de ' + String(args.total);

    const eventCopy = slide.querySelector('.event-copy');
    const bookCopy = slide.querySelector('.book-copy');
    if (bookCopy) bookCopy.hidden = true;
    if (eventCopy) eventCopy.hidden = false;

    const category = slide.querySelector('.category');
    if (category) {
      category.hidden = false;
      category.textContent = 'ESPORTE E LAZER';
    }
    const free = slide.querySelector('.free');
    if (free) {
      free.hidden = false;
      free.textContent = 'GRATUITO';
    }
    const rating = slide.querySelector('.badge.rating');
    if (rating) rating.hidden = true;

    const cityBadge = slide.querySelector('.badge.city');
    const cityLabel = city(item);
    if (cityBadge) {
      cityBadge.hidden = !cityLabel;
      cityBadge.textContent = cityLabel.toUpperCase();
      cityBadge.setAttribute('aria-hidden', cityLabel ? 'false' : 'true');
    }

    const title = slide.querySelector('.event-title');
    if (title) title.textContent = item.titulo || 'Atividade gratuita';
    const description = slide.querySelector('.description');
    if (description) description.textContent = item.descricao || '';

    const when = slide.querySelector('.when');
    if (when) when.textContent = scheduleLabel(item) || 'Consulte a programação';
    const where = slide.querySelector('.where-text');
    const local = item?.local || {};
    const location = [local.nome, local.endereco, local.bairro, cityLabel].map(text).filter(Boolean);
    if (where) where.textContent = [...new Set(location)].join(' · ') || 'Consulte o local';
    const mapLink = slide.querySelector('.map-link');
    if (mapLink) mapLink.remove();

    const subtitle = slide.querySelector('.panel-subtitle');
    if (subtitle) subtitle.textContent = (Array.isArray(item.modalidades) ? item.modalidades : []).find(Boolean) || categoryLabel(item.categoria) || 'Esporte e Lazer';

    const image = slide.querySelector('.event-image');
    const fallback = slide.querySelector('.image-fallback');
    const imageUrl = helpers.safeImageUrl(item.imagem);
    if (imageUrl && image) {
      image.src = imageUrl;
      image.alt = 'Imagem de apoio: ' + (item.titulo || 'atividade');
      image.style.display = 'block';
      image.addEventListener('load', () => {
        if (fallback) fallback.style.display = 'none';
      }, { once: true });
      image.addEventListener('error', () => {
        image.style.display = 'none';
        if (fallback) fallback.style.display = 'grid';
      }, { once: true });
    } else {
      if (image) image.style.display = 'none';
      if (fallback) fallback.style.display = 'grid';
    }
    const fallbackIcon = slide.querySelector('.fallback-icon');
    const fallbackLabel = slide.querySelector('.fallback-label');
    if (fallbackIcon) fallbackIcon.textContent = item.icone || '🏃';
    if (fallbackLabel) fallbackLabel.textContent = (Array.isArray(item.modalidades) ? item.modalidades : []).find(Boolean) || categoryLabel(item.categoria) || 'Esporte e Lazer';

    const registration = helpers.safeExternalUrl(item?.participacao?.url_inscricao);
    const source = helpers.safeExternalUrl(item?.fontes?.[0]?.url);
    const link = registration || source;
    const sourceLabel = slide.querySelector('.source-label');
    const sourceUrl = slide.querySelector('.source-url');
    const updated = slide.querySelector('.updated');
    if (sourceLabel) sourceLabel.textContent = registration ? 'Participação e inscrição' : 'Fonte oficial';
    if (sourceUrl) sourceUrl.textContent = item?.organizador?.nome || item?.fontes?.[0]?.nome || '';
    if (updated) {
      const verified = text(item?.verificacao?.ultima_verificacao);
      updated.textContent = verified ? 'Verificado em ' + verified.split('-').reverse().join('/') : '';
    }

    helpers.configureItemQrLabel(slide, item, Boolean(link));
    const qr = slide.querySelector('.qr-code');
    if (qr && link) helpers.buildQr(qr, link);
    return slide;
  }

  function createAgendaCard(item, helpers) {
    const article = document.createElement('article');
    article.className = 'agenda-card agenda-activity-card';

    const media = document.createElement('div');
    media.className = 'agenda-card-media activity-agenda-media';
    const imageUrl = helpers.safeImageUrl(item.imagem);
    if (imageUrl) {
      media.classList.add('activity-agenda-media--image');
      const image = document.createElement('img');
      image.src = imageUrl;
      image.alt = 'Imagem de apoio: ' + (item.titulo || 'atividade');
      image.loading = 'lazy';
      image.decoding = 'async';
      image.addEventListener('error', () => {
        image.remove();
        media.classList.remove('activity-agenda-media--image');
        appendText(media, 'strong', item.icone || '🏃', 'activity-agenda-icon');
        appendText(media, 'span', (item.modalidades || [])[0] || categoryLabel(item.categoria), 'activity-agenda-label');
      });
      media.appendChild(image);
    } else {
      appendText(media, 'strong', item.icone || '🏃', 'activity-agenda-icon');
      appendText(media, 'span', (item.modalidades || [])[0] || categoryLabel(item.categoria), 'activity-agenda-label');
    }

    const body = document.createElement('div');
    body.className = 'agenda-card-body';
    appendText(body, 'p', 'ESPORTE E LAZER', 'agenda-card-date');
    appendText(body, 'h2', item.titulo || 'Atividade gratuita');

    const meta = document.createElement('div');
    meta.className = 'activity-agenda-meta';
    const location = [item?.local?.nome, item?.local?.bairro, city(item)].map(text).filter(Boolean);
    appendText(meta, 'p', location.join(' · '), 'activity-agenda-location');
    appendText(meta, 'p', scheduleLabel(item), 'activity-agenda-schedule');
    body.appendChild(meta);

    appendText(body, 'p', item.descricao, 'agenda-card-description');

    const tags = document.createElement('div');
    tags.className = 'film-tags activity-tags';
    tags.setAttribute('aria-label', 'Modalidades e público');
    appendText(tags, 'span', categoryLabel(item.categoria));
    (Array.isArray(item.modalidades) ? item.modalidades : []).slice(0, 3).forEach(value => appendText(tags, 'span', value));
    if (city(item)) appendText(tags, 'span', city(item));
    body.appendChild(tags);

    const registration = helpers.safeExternalUrl(item?.participacao?.url_inscricao);
    const source = helpers.safeExternalUrl(item?.fontes?.[0]?.url);
    const link = registration || source;
    if (link) {
      const actions = document.createElement('div');
      actions.className = 'agenda-card-actions';
      const anchor = document.createElement('a');
      anchor.href = link;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.textContent = registration ? 'Como participar' : 'Consultar fonte oficial';
      actions.appendChild(anchor);
      body.appendChild(actions);
    }

    article.append(media, body);
    return article;
  }

  root.contents.activities = Object.freeze({
    isValid,
    filter,
    city,
    categoryLabel,
    cityOptions,
    categoryOptions,
    modalityOptions,
    scheduleLabel,
    createPanelSlide,
    createAgendaCard
  });
})();
