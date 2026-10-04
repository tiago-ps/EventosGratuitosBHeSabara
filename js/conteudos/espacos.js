(() => {
  'use strict';

  const root = window.MuralCultural = window.MuralCultural || {};
  root.contents = root.contents || {};

  const WEEKDAYS = Object.freeze([
    ['segunda', 'Segunda'],
    ['terca', 'Terça'],
    ['quarta', 'Quarta'],
    ['quinta', 'Quinta'],
    ['sexta', 'Sexta'],
    ['sabado', 'Sábado'],
    ['domingo', 'Domingo']
  ]);

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

  function list(value) {
    return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
  }

  function isValid(item) {
    return Boolean(item && item.tipo_conteudo === 'espaco' && item.id && item.titulo);
  }

  function city(item) {
    return text(item?.cidade);
  }

  function nature(item) {
    return text(item?.natureza_espaco || item?.tipo_espaco);
  }

  function vocations(item) {
    return list(item?.vocacoes);
  }

  function icon(item) {
    const value = [nature(item), ...vocations(item), item?.titulo].join(' ')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (/parque|praca|jardim|area verde/.test(value)) return '🌳';
    if (/esporte|quadra|ginasio|campo|piscina|ceu das artes/.test(value)) return '⚽';
    if (/biblioteca|leitura/.test(value)) return '📚';
    if (/cinema|cine/.test(value)) return '🎬';
    if (/teatro/.test(value)) return '🎭';
    if (/museu|centro cultural|galeria|cultura|artes/.test(value)) return '🏛️';
    return '📍';
  }

  function locationParts(item) {
    return [...new Set([
      text(item?.espaco_principal),
      text(item?.endereco),
      city(item)
    ].filter(Boolean))];
  }

  function scheduleLabel(item) {
    const schedule = item?.funcionamento && typeof item.funcionamento === 'object'
      ? item.funcionamento
      : {};
    const observation = text(schedule.observacao);
    if (observation) return observation;

    const values = [];
    for (const [key, label] of WEEKDAYS) {
      const value = text(schedule[key]);
      if (value) values.push(`${label}: ${value}`);
    }
    return values.join(' · ');
  }

  function searchText(item) {
    return [
      item?.titulo, item?.descricao, nature(item), city(item), item?.endereco,
      item?.espaco_principal, item?.instituicao, ...vocations(item),
      ...(Array.isArray(item?.temas) ? item.temas : [])
    ].filter(Boolean).join(' ');
  }

  function filter(items, filters, normalizeText) {
    const query = normalizeText(filters?.query || '');
    const wantedCity = normalizeText(filters?.city || '');
    const wantedVocation = normalizeText(filters?.vocation || '');
    const wantedNature = normalizeText(filters?.nature || '');
    const wantedTheme = normalizeText(filters?.theme || '');

    return (Array.isArray(items) ? items : []).filter(isValid).filter(item => {
      if (wantedCity && normalizeText(city(item)) !== wantedCity) return false;
      if (wantedVocation && !vocations(item).some(value => normalizeText(value) === wantedVocation)) return false;
      if (wantedNature && normalizeText(nature(item)) !== wantedNature) return false;
      if (wantedTheme && !(Array.isArray(item?.temas) ? item.temas : [])
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

  function vocationOptions(items, normalizeText) {
    return optionPairs(items, item => vocations(item), normalizeText);
  }

  function natureOptions(items, normalizeText) {
    return optionPairs(items, item => [nature(item)], normalizeText);
  }

  function mapUrl(item, helpers) {
    const explicit = helpers?.safeExternalUrl?.(item?.mapa);
    if (explicit) return explicit;
    const parts = [item?.titulo, item?.endereco, city(item)].map(text).filter(Boolean);
    if (!parts.length) return '';
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(parts.join(', '));
  }

  function createPanelSlide(args) {
    const item = args.movie;
    const slide = args.template.content.firstElementChild.cloneNode(true);
    const helpers = args.helpers;
    helpers.buildSiteQr(slide, item);
    slide.classList.add('space-slide');
    slide.setAttribute('aria-label', 'Espaço: ' + (item.titulo || 'Espaço'));

    const seconds = helpers.slideDurationFor(item);
    slide.style.setProperty('--slide-seconds', String(seconds) + 's');
    slide.querySelector('.counter').textContent = String(args.index + 1) + ' de ' + String(args.total);

    const bookCopy = slide.querySelector('.book-copy');
    const eventCopy = slide.querySelector('.event-copy');
    if (bookCopy) bookCopy.hidden = true;
    if (eventCopy) eventCopy.hidden = false;

    const category = slide.querySelector('.category');
    if (category) {
      category.hidden = false;
      category.textContent = 'ESPAÇOS';
    }
    const free = slide.querySelector('.free');
    if (free) free.hidden = true;
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
    if (title) title.textContent = item.titulo || 'Espaço';
    const description = slide.querySelector('.description');
    if (description) description.textContent = item.descricao || '';

    const details = slide.querySelectorAll('.details > div');
    if (details[0]) {
      const dt = details[0].querySelector('dt');
      if (dt) dt.textContent = 'Funcionamento';
    }
    const when = slide.querySelector('.when');
    if (when) when.textContent = scheduleLabel(item) || 'Consulte o funcionamento na fonte oficial';

    if (details[1]) {
      const dt = details[1].querySelector('dt');
      if (dt) dt.textContent = 'Onde';
    }
    const where = slide.querySelector('.where-text');
    if (where) where.textContent = locationParts(item).join(' · ') || 'Localização não informada';

    const map = mapUrl(item, helpers);
    const mapLink = slide.querySelector('.map-link');
    if (mapLink && map) {
      mapLink.href = map;
      mapLink.hidden = false;
      mapLink.setAttribute('aria-label', 'Abrir ' + (item.titulo || 'este espaço') + ' no mapa');
    } else if (mapLink) {
      mapLink.remove();
    }

    const subtitle = slide.querySelector('.panel-subtitle');
    if (subtitle) subtitle.textContent = vocations(item)[0] || nature(item) || 'Espaços';

    const image = slide.querySelector('.event-image');
    const fallback = slide.querySelector('.image-fallback');
    const imageUrl = helpers.safeImageUrl(item.imagem);
    if (imageUrl && image) {
      const showImage = () => {
        image.classList.add('loaded');
        image.style.display = 'block';
        if (fallback) fallback.style.display = 'none';
      };
      const showFallback = () => {
        image.classList.remove('loaded');
        image.style.display = 'none';
        if (fallback) fallback.style.display = 'grid';
      };
      image.alt = 'Imagem de ' + (item.titulo || 'espaço');
      image.decoding = 'async';
      image.onload = showImage;
      image.onerror = showFallback;
      image.style.display = 'block';
      image.src = imageUrl;
      if (image.complete) {
        if (image.naturalWidth > 0) showImage();
        else showFallback();
      }
    } else {
      if (image) {
        image.classList.remove('loaded');
        image.style.display = 'none';
      }
      if (fallback) fallback.style.display = 'grid';
    }

    const fallbackIcon = slide.querySelector('.fallback-icon');
    const fallbackLabel = slide.querySelector('.fallback-label');
    if (fallbackIcon) fallbackIcon.textContent = icon(item);
    if (fallbackLabel) fallbackLabel.textContent = nature(item) || vocations(item)[0] || 'Espaço';

    const site = helpers.safeExternalUrl(item.site);
    const link = site || map;
    const sourceLabel = slide.querySelector('.source-label');
    const sourceUrl = slide.querySelector('.source-url');
    const updated = slide.querySelector('.updated');
    if (sourceLabel) sourceLabel.textContent = site ? 'Site oficial' : 'Localização';
    if (sourceUrl) sourceUrl.textContent = item.instituicao || nature(item) || '';
    if (updated) updated.textContent = '';

    helpers.configureItemQrLabel(slide, item, Boolean(link));
    const qr = slide.querySelector('.qr-code');
    if (qr && link) helpers.buildQr(qr, link);
    return slide;
  }

  function createAgendaCard(item, helpers) {
    const article = document.createElement('article');
    article.className = 'agenda-card agenda-space-card';

    const media = document.createElement('div');
    media.className = 'agenda-card-media activity-agenda-media';
    const imageUrl = helpers.safeImageUrl(item.imagem);
    if (imageUrl) {
      media.classList.add('activity-agenda-media--image');
      const image = document.createElement('img');
      image.src = imageUrl;
      image.alt = 'Imagem de ' + (item.titulo || 'espaço');
      image.loading = 'lazy';
      image.decoding = 'async';
      image.addEventListener('error', () => {
        image.remove();
        media.classList.remove('activity-agenda-media--image');
        appendText(media, 'strong', icon(item), 'activity-agenda-icon');
        appendText(media, 'span', nature(item) || 'Espaço', 'activity-agenda-label');
      });
      media.appendChild(image);
    } else {
      appendText(media, 'strong', icon(item), 'activity-agenda-icon');
      appendText(media, 'span', nature(item) || vocations(item)[0] || 'Espaço', 'activity-agenda-label');
    }

    const body = document.createElement('div');
    body.className = 'agenda-card-body';
    appendText(body, 'p', 'ESPAÇOS', 'agenda-card-date');
    appendText(body, 'h2', item.titulo || 'Espaço');
    appendText(body, 'p', locationParts(item).join(' · '), 'agenda-card-place');
    appendText(body, 'p', item.descricao, 'agenda-card-description');

    const schedule = scheduleLabel(item);
    if (schedule) appendText(body, 'p', schedule, 'activity-agenda-schedule');

    const tags = document.createElement('div');
    tags.className = 'film-tags activity-tags';
    tags.setAttribute('aria-label', 'Características do espaço');
    appendText(tags, 'span', nature(item));
    vocations(item).slice(0, 4).forEach(value => appendText(tags, 'span', value));
    if (city(item)) appendText(tags, 'span', city(item));
    if (tags.childElementCount) body.appendChild(tags);

    const site = helpers.safeExternalUrl(item.site);
    const map = mapUrl(item, helpers);
    if (site || map) {
      const actions = document.createElement('div');
      actions.className = 'agenda-card-actions';
      if (site) {
        const anchor = document.createElement('a');
        anchor.href = site;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        anchor.textContent = 'Site oficial';
        actions.appendChild(anchor);
      }
      if (map) {
        const anchor = document.createElement('a');
        anchor.className = 'secondary';
        anchor.href = map;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        anchor.textContent = 'Como chegar';
        actions.appendChild(anchor);
      }
      body.appendChild(actions);
    }

    article.append(media, body);
    return article;
  }

  root.contents.spaces = Object.freeze({
    isValid,
    filter,
    city,
    nature,
    vocations,
    icon,
    scheduleLabel,
    cityOptions,
    vocationOptions,
    natureOptions,
    createPanelSlide,
    createAgendaCard
  });
})();
