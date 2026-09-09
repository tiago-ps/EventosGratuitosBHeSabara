(() => {
  'use strict';

  const root = window.MuralCultural = window.MuralCultural || {};
  let supportDialog = null;
  let supportOpener = null;
  let supportListenerBound = false;

  function normalizeLabel(value = '') {
    return String(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function mergeLabels(original, additions) {
    const merged = [];
    const seen = new Set();
    for (const value of [...(Array.isArray(original) ? original : []), ...(Array.isArray(additions) ? additions : [])]) {
      const label = String(value || '').replace(/\s+/g, ' ').trim();
      const key = normalizeLabel(label);
      if (!label || !key || seen.has(key)) continue;
      seen.add(key);
      merged.push(label);
    }
    return merged;
  }

  function dateKey(value = new Date()) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function isActive(curation, today = new Date()) {
    if (curation?.permanente === true) return true;
    const current = dateKey(today);
    const start = String(curation?.ativo_de || '');
    const end = String(curation?.ativo_ate || '');
    return Boolean(current && start && end && current >= start && current <= end);
  }

  // Disponibilidade e promoção são decisões independentes.
  function isPromoted(curation, today = new Date()) {
    if (!isActive(curation, today)) return false;
    const months = curation?.promocao_painel?.meses;
    if (!Array.isArray(months)) return true;
    const date = today instanceof Date ? today : new Date(today);
    return months.includes(date.getMonth() + 1);
  }

  function mergeCurationIds(...collections) {
    return [...new Set(collections.flatMap(value => Array.isArray(value) ? value : [value])
      .map(value => normalizeLabel(value || '').replace(/\s+/g, '-')).filter(Boolean))];
  }

  function matchesCuration(item, curation) {
    const id = mergeCurationIds(curation?.id)[0];
    if (!id) return false;
    if (mergeCurationIds(item?.curadoria_ids).includes(id)) return true;
    // Temas são apenas fallback legado; membros formais usam associação explícita.
    if (curation.permanente || curation.membros) return false;
    const theme = normalizeLabel(curation.perfil_painel?.configuracao?.theme || curation.tema || curation.theme);
    return Boolean(theme && (Array.isArray(item?.temas) ? item.temas : [])
      .some(value => normalizeLabel(value) === theme));
  }

  function isValidPayload(payload) {
    return Boolean(
      payload && typeof payload === 'object' &&
      payload.schema === 1 && payload.escopo === 'site-only' &&
      Array.isArray(payload.curadorias)
    );
  }

  function cloneRecord(record) {
    return {
      ...record,
      curadoria_ids: mergeCurationIds(record?.curadoria_ids),
      temas: Array.isArray(record?.temas) ? [...record.temas] : record?.temas
    };
  }

  function editorialFields(editorial) {
    const fields = {};
    if (!editorial || typeof editorial !== 'object' || Array.isArray(editorial)) return fields;
    for (const field of ['pergunta_curiosidade', 'texto_apoio']) {
      if (typeof editorial[field] === 'string') fields[field] = editorial[field];
    }
    if (editorial.vestibular && typeof editorial.vestibular === 'object' && !Array.isArray(editorial.vestibular)) {
      fields.vestibular = structuredClone(editorial.vestibular);
    }
    return fields;
  }

  function storeEditorialOverlay(target, overlay, options) {
    if (!options.editorial) return;
    const curationId = mergeCurationIds(options.curationId)[0];
    const editorial = editorialFields(overlay?.editorial);
    if (!curationId || !Object.keys(editorial).length) return;
    target.curadoria_overlays = {
      ...target.curadoria_overlays,
      [curationId]: editorial
    };
  }

  function effectiveItemForCuration(item, curationId) {
    const effective = structuredClone(item);
    const id = mergeCurationIds(curationId)[0];
    if (!id || !mergeCurationIds(item?.curadoria_ids).includes(id)) return effective;
    const overlays = item?.curadoria_overlays;
    if (!overlays || !Object.prototype.hasOwnProperty.call(overlays, id)) return effective;
    return Object.assign(effective, editorialFields(overlays[id]));
  }

  const EXTERNAL_URL_FIELDS = Object.freeze([
    'link', 'pagina', 'link_inscricao', 'link_virtual', 'url', 'pagina_oficial'
  ]);

  const OVERLAY_IMAGE_FIELDS = Object.freeze([
    'imagem',
    'imagem_fonte',
    'imagem_origem_url',
    'imagem_credito',
    'imagem_observacao'
  ]);

  function safeExternalUrl(value) {
    try {
      const parsed = new URL(String(value || ''));
      return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '';
    } catch {
      return '';
    }
  }

  function safeImage(value) {
    const candidate = typeof value === 'string' ? value.trim() : '';
    if (!candidate) return '';
    if (/^[a-z][a-z\d+.-]*:/i.test(candidate)) return safeExternalUrl(candidate);
    if (candidate.startsWith('//') || candidate.startsWith('\\')) return '';
    return candidate;
  }

  function applyOverlayImageMetadata(target, overlay, warn, label) {
    if (!overlay || typeof overlay !== 'object') return;

    for (const field of OVERLAY_IMAGE_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(overlay, field)) continue;
      const value = overlay[field];

      if (field === 'imagem') {
        const safeValue = safeImage(value);
        if (safeValue) target[field] = safeValue;
        else warn(`Curadoria site-only: imagem inválida ignorada para ${label}.`);
        continue;
      }

      if (field === 'imagem_origem_url') {
        const safeValue = safeExternalUrl(value);
        if (safeValue) target[field] = safeValue;
        else warn(`Curadoria site-only: URL de origem da imagem inválida ignorada para ${label}.`);
        continue;
      }

      if (typeof value === 'string') target[field] = value;
      else warn(`Curadoria site-only: metadado textual inválido ignorado para ${label} (${field}).`);
    }
  }

  function applyOverlayUrlMetadata(target, overlay, warn, label) {
    if (!overlay || typeof overlay !== 'object') return;
    for (const field of EXTERNAL_URL_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(overlay, field)) continue;
      const safeValue = safeExternalUrl(overlay[field]);
      if (safeValue) target[field] = safeValue;
      else warn(`Curadoria site-only: URL inválida ignorada para ${label} (${field}).`);
    }
  }

  function sanitizeUntrustedRecord(record, warn, label) {
    const item = cloneRecord(record);
    for (const field of EXTERNAL_URL_FIELDS) {
      if (!String(item?.[field] || '').trim()) continue;
      const safeUrl = safeExternalUrl(item[field]);
      if (safeUrl) item[field] = safeUrl;
      else {
        delete item[field];
        warn(`Curadoria site-only: URL inválida removida de ${label} (${field}).`);
      }
    }
    if (Object.prototype.hasOwnProperty.call(item, 'imagem')) {
      const safeValue = safeImage(item.imagem);
      if (safeValue) item.imagem = safeValue;
      else {
        delete item.imagem;
        warn(`Curadoria site-only: imagem inválida removida de ${label}.`);
      }
    }
    return item;
  }

  function eventIsCurrent(event, today = new Date()) {
    const end = String(event?.data_fim || event?.data || '').slice(0, 10);
    const current = dateKey(today);
    return !end || !current || end >= current;
  }

  const MEMBER_ID_FIELDS = Object.freeze({
    eventos: 'id',
    livros: 'id',
    cursos: 'id_fonte',
    filmes: 'id',
    utilidade_publica: 'id'
  });

  function applyMembers(catalogs, curation, warn) {
    const members = curation.membros;
    if (members === undefined) return;
    if (!members || typeof members !== 'object' || Array.isArray(members)) {
      warn(`Curadoria site-only: membros inválidos para ${curation.id}; associações ignoradas.`);
      return;
    }

    for (const [collection, idField] of Object.entries(MEMBER_ID_FIELDS)) {
      const identifiers = members[collection];
      if (identifiers === undefined) continue;
      if (!Array.isArray(identifiers)) {
        warn(`Curadoria site-only: membros.${collection} deve ser uma lista em ${curation.id}; associações ignoradas.`);
        continue;
      }
      const recordsById = new Map(catalogs[collection]
        .filter(item => item?.[idField] !== undefined && item?.[idField] !== null)
        .map(item => [String(item[idField]), item]));
      const seen = new Set();
      for (const identifier of identifiers) {
        if (!((typeof identifier === 'string' && identifier.trim()) ||
          (typeof identifier === 'number' && Number.isFinite(identifier)))) {
          warn(`Curadoria site-only: ID inválido em membros.${collection} de ${curation.id}; associação ignorada.`);
          continue;
        }
        const id = String(identifier);
        if (seen.has(id)) continue;
        seen.add(id);
        const target = recordsById.get(id);
        if (!target) {
          warn(`Curadoria site-only: membro ${collection} ${id} de ${curation.id} não encontrado no catálogo canônico.`);
          continue;
        }
        target.curadoria_ids = mergeCurationIds(target.curadoria_ids, curation.id);
      }
    }
  }

  function applyOverlayCollection(records, overlays, options) {
    const result = (Array.isArray(records) ? records : []).map(cloneRecord);
    const entries = overlays && typeof overlays === 'object' ? Object.entries(overlays) : [];
    for (const [identifier, overlay] of entries) {
      const target = result.find(item => String(item?.[options.idField] || '') === String(identifier));
      if (!target) {
        const fallback = overlay?.fallback;
        const fallbackId = String(fallback?.[options.idField] || '');
        const fallbackTitleMatches = !overlay?.titulo_esperado ||
          normalizeLabel(fallback?.titulo) === normalizeLabel(overlay.titulo_esperado);
        if (fallback && typeof fallback === 'object' && fallbackId === String(identifier) && fallbackTitleMatches) {
          const item = {
            ...sanitizeUntrustedRecord(fallback, options.warn, `${options.label} ${identifier}`),
            origem: 'site-only',
            site_only: true
          };
          item.temas = mergeLabels(item.temas, overlay?.temas);
          if (options.associateByOverlay !== false) {
            item.curadoria_ids = mergeCurationIds(item.curadoria_ids, overlay?.curadoria_ids, options.curationId);
          }
          storeEditorialOverlay(item, overlay, options);
          result.push(item);
          continue;
        }
        options.warn(`Curadoria site-only: ${options.label} ${identifier} não encontrado.`);
        continue;
      }
      if (overlay?.titulo_esperado && normalizeLabel(target.titulo) !== normalizeLabel(overlay.titulo_esperado)) {
        options.warn(`Curadoria site-only: título divergente para ${options.label} ${identifier}; overlay ignorado.`);
        continue;
      }
      target.temas = mergeLabels(target.temas, overlay?.temas);
      if (options.associateByOverlay !== false) {
        target.curadoria_ids = mergeCurationIds(target.curadoria_ids, overlay?.curadoria_ids, options.curationId);
      }
      storeEditorialOverlay(target, overlay, options);
      applyOverlayUrlMetadata(target, overlay, options.warn, `${options.label} ${identifier}`);
      applyOverlayImageMetadata(target, overlay, options.warn, `${options.label} ${identifier}`);
    }
    return result;
  }

  function appendComplements(records, complements, options) {
    const result = [...records];
    const identifiers = new Set(result.flatMap(item => options.identifiers(item)).filter(Boolean).map(String));
    for (const complement of Array.isArray(complements) ? complements : []) {
      if (typeof options.include === 'function' && !options.include(complement)) continue;
      const complementIds = options.identifiers(complement).filter(Boolean).map(String);
      if (!complementIds.length || complementIds.some(identifier => identifiers.has(identifier))) {
        // Reutiliza a identidade já integrada sem sobrescrever seus dados ou associações.
        const existing = result.find(item => options.identifiers(item).filter(Boolean)
          .some(identifier => complementIds.includes(String(identifier))));
        if (existing && normalizeLabel(existing.titulo) === normalizeLabel(complement.titulo)) {
          existing.curadoria_ids = mergeCurationIds(existing.curadoria_ids, complement.curadoria_ids, options.curationId);
        }
        options.warn(`Curadoria site-only: complemento de ${options.label} sem ID próprio ou com colisão; dados do item ignorados.`);
        continue;
      }
      const item = {
        ...sanitizeUntrustedRecord(complement, options.warn, `complemento de ${options.label}`),
        origem: 'site-only',
        site_only: true
      };
      item.curadoria_ids = mergeCurationIds(item.curadoria_ids, options.curationId);
      result.push(item);
      complementIds.forEach(identifier => identifiers.add(identifier));
    }
    return result;
  }

  function apply(payload, catalogs = {}, options = {}) {
    const warn = typeof options.warn === 'function' ? options.warn : message => console.warn(message);
    let result = {
      eventos: (Array.isArray(catalogs.eventos) ? catalogs.eventos : []).map(cloneRecord),
      livros: (Array.isArray(catalogs.livros) ? catalogs.livros : []).map(cloneRecord),
      cursos: (Array.isArray(catalogs.cursos) ? catalogs.cursos : []).map(cloneRecord),
      filmes: (Array.isArray(catalogs.filmes) ? catalogs.filmes : []).map(cloneRecord),
      utilidade_publica: (Array.isArray(catalogs.utilidade_publica) ? catalogs.utilidade_publica : []).map(cloneRecord),
      apoio: null,
      curadoriasAtivas: []
    };

    if (!isValidPayload(payload)) return result;

    // Resolve membros somente nos catálogos canônicos, antes de qualquer fallback ou complemento.
    for (const curation of payload.curadorias.filter(Boolean)) {
      applyMembers(result, curation, warn);
    }

    const permanentCuration = payload.curadorias.find(curation =>
      curation?.complementos?.servicos_apoio?.permanente === true
    );
    if (permanentCuration) {
      result.apoio = {
        ...permanentCuration.complementos.servicos_apoio,
        curationId: permanentCuration.id,
        campaignActive: isPromoted(permanentCuration, options.today || new Date()),
        site_only: true
      };
    }

    // A janela editorial controla a campanha, não a vida útil dos conteúdos.
    for (const curation of payload.curadorias.filter(Boolean)) {
      const active = isActive(curation, options.today || new Date());
      const promoted = isPromoted(curation, options.today || new Date());
      const overlays = curation.overlays || {};
      const complements = curation.complementos || {};
      result.eventos = applyOverlayCollection(result.eventos, overlays.eventos, {
        idField: 'id', label: 'evento', curationId: curation.id, warn
      });
      result.livros = applyOverlayCollection(result.livros, overlays.livros, {
        idField: 'id', label: 'livro', curationId: curation.id, warn,
        editorial: true, associateByOverlay: !curation.membros
      });
      result.cursos = applyOverlayCollection(result.cursos, overlays.cursos, {
        idField: 'id_fonte', label: 'curso', curationId: curation.id, warn
      });
      result.filmes = applyOverlayCollection(result.filmes, overlays.filmes, {
        idField: 'id', label: 'filme', curationId: curation.id, warn
      });
      result.eventos = appendComplements(result.eventos, complements.eventos, {
        label: 'evento', curationId: curation.id, warn,
        identifiers: item => [item?.id],
        include: item => eventIsCurrent(item, options.today || new Date())
      });
      result.livros = appendComplements(result.livros, complements.livros, {
        label: 'livro', curationId: curation.id, warn,
        identifiers: item => [item?.id]
      });
      result.cursos = appendComplements(result.cursos, complements.cursos, {
        label: 'curso', curationId: curation.id, warn,
        identifiers: item => [item?.id, item?.id_fonte]
      });
      result.filmes = appendComplements(result.filmes, complements.filmes, {
        label: 'filme', curationId: curation.id, warn,
        identifiers: item => [item?.id]
      });
      if (promoted && complements.servicos_apoio && typeof complements.servicos_apoio === 'object') {
        result.apoio = {
          ...complements.servicos_apoio,
          curationId: curation.id,
          campaignActive: true,
          site_only: true
        };
      }
      if (active) result.curadoriasAtivas.push(curation.id);
    }
    return result;
  }

  function appendText(parent, tag, text, className = '') {
    if (!String(text || '').trim()) return null;
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = text;
    parent.appendChild(element);
    return element;
  }

  function officialLink(url, label) {
    try {
      const parsed = new URL(String(url || ''), window.location.href);
      if (!['http:', 'https:'].includes(parsed.protocol)) return null;
      const link = document.createElement('a');
      link.href = parsed.href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = label || 'Consultar página oficial';
      return link;
    } catch {
      return null;
    }
  }

  function setPanelSupportImageState(image, fallback, loaded) {
    if (!image) return;
    if (loaded) {
      image.classList.add('loaded');
      image.style.display = '';
      if (fallback) fallback.hidden = true;
      return;
    }
    image.classList.remove('loaded');
    image.removeAttribute('src');
    image.style.display = 'none';
    if (fallback) fallback.hidden = false;
  }

  function createPanelSupportSlide({ movie, index, total, template, helpers }) {
    const {
      buildSiteQr,
      slideDurationFor,
      safeImageUrl
    } = helpers;
    const slide = template.content.firstElementChild.cloneNode(true);
    buildSiteQr(slide);
    slide.classList.add('support-slide');
    slide.setAttribute('aria-label', `Informação de apoio: ${movie.titulo || 'Saúde Mental'}`);

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
      category.textContent = 'UTILIDADE PÚBLICA';
      category.style.background = '#f5c518';
      category.style.color = '#151308';
    }
    const free = slide.querySelector('.free');
    if (free) {
      free.hidden = true;
      free.textContent = '';
    }
    const rating = slide.querySelector('.badge.rating');
    if (rating) {
      rating.hidden = true;
      rating.textContent = '';
    }
    const campaign = slide.querySelector('.badge.city');
    if (campaign) {
      campaign.hidden = false;
      campaign.className = 'badge support-campaign';
      campaign.textContent = 'SAÚDE MENTAL';
      campaign.removeAttribute('style');
      campaign.style.background = '#ffe27a';
      campaign.style.color = '#151308';
    }

    const title = slide.querySelector('.event-title');
    if (title) title.textContent = movie.titulo || 'Onde buscar ajuda';
    const description = slide.querySelector('.description');
    if (description) description.textContent = movie.descricao || '';

    const when = slide.querySelector('.when');
    if (when) {
      const label = when.closest('div')?.querySelector('dt');
      if (label) label.textContent = 'Em destaque';
      when.textContent = movie.destaque || '';
    }
    const where = slide.querySelector('.where-text');
    if (where) {
      const label = where.closest('div')?.querySelector('dt');
      if (label) label.textContent = 'Orientação';
      where.textContent = movie.detalhe || '';
    }
    slide.querySelector('.map-link')?.remove();

    const sourceLabel = slide.querySelector('.source-label');
    if (sourceLabel) sourceLabel.textContent = movie.fonte_label || 'Onde buscar ajuda';
    const source = slide.querySelector('.source-url');
    if (source) {
      const action = document.createElement('button');
      action.type = 'button';
      action.className = 'support-card-action';
      action.textContent = 'Ver informações, contatos e endereços';
      action.addEventListener('click', () => openSupportArea(action, movie.support_target));
      source.replaceChildren(action);
    }
    const updated = slide.querySelector('.updated');
    if (updated) updated.textContent = movie.observacao || '';

    const qrWrap = slide.querySelector('.qr-wrap');
    if (qrWrap) {
      qrWrap.hidden = true;
      slide.querySelector('.qr-code')?.replaceChildren();
    }

    const subtitle = slide.querySelector('.panel-subtitle');
    if (subtitle) subtitle.textContent = 'Informação de apoio';

    const image = slide.querySelector('.event-image');
    const imageUrl = safeImageUrl(movie.imagem);
    const fallback = slide.querySelector('.image-fallback');
    const fallbackIcon = slide.querySelector('.fallback-icon');
    const fallbackLabel = slide.querySelector('.fallback-label');
    if (fallback) {
      fallback.hidden = false;
      fallback.style.display = 'grid';
      fallback.style.background = 'radial-gradient(circle at 35% 28%, rgba(245,197,24,.32), transparent 34%), linear-gradient(145deg, #0b0b08 0%, #211d09 58%, #151308 100%)';
    }
    if (fallbackIcon) fallbackIcon.textContent = movie.icone || '💛';
    if (fallbackLabel) fallbackLabel.textContent = 'Saúde Mental';
    if (image && imageUrl) {
      image.alt = movie.titulo ? `Imagem de apoio: ${movie.titulo}` : 'Imagem de apoio';
      image.onload = () => setPanelSupportImageState(image, fallback, true);
      image.onerror = () => setPanelSupportImageState(image, fallback, false);
      image.src = imageUrl;
    } else if (image) {
      image.removeAttribute('src');
      image.style.display = 'none';
    }

    return slide;
  }

  function appendSupportImage(parent, value, alt) {
    const source = safeImage(value);
    if (!source) return null;
    const image = document.createElement('img');
    image.className = 'support-help-image';
    image.alt = alt || '';
    image.loading = 'lazy';
    image.decoding = 'async';
    image.addEventListener('error', () => image.remove());
    image.src = source;
    parent.appendChild(image);
    return image;
  }

  function createAgendaSupportCard(movie) {
    const article = document.createElement('article');
    article.className = 'agenda-card agenda-support-card';

    const media = document.createElement('div');
    media.className = 'agenda-card-media support-card-media';
    const fallback = document.createElement('div');
    fallback.className = 'film-poster-fallback';
    fallback.setAttribute('role', 'img');
    fallback.setAttribute('aria-label', `Imagem não disponível para ${movie.titulo || 'informação de apoio'}`);
    const fallbackIcon = document.createElement('span');
    fallbackIcon.setAttribute('aria-hidden', 'true');
    fallbackIcon.textContent = movie.icone || '💛';
    const fallbackText = document.createElement('strong');
    fallbackText.textContent = 'Informação de apoio';
    fallback.append(fallbackIcon, fallbackText);
    media.appendChild(fallback);
    const imageUrl = safeImage(movie.imagem);
    if (imageUrl) {
      const image = document.createElement('img');
      image.alt = movie.titulo ? `Imagem de apoio: ${movie.titulo}` : 'Imagem de apoio';
      image.loading = 'lazy';
      image.decoding = 'async';
      image.addEventListener('load', () => fallback.remove());
      image.addEventListener('error', () => image.remove());
      image.src = imageUrl;
      media.appendChild(image);
    }

    const body = document.createElement('div');
    body.className = 'agenda-card-body';
    appendText(body, 'p', 'UTILIDADE PÚBLICA', 'agenda-card-date');
    appendText(body, 'h2', movie.titulo || 'Informação');
    appendText(body, 'p', movie.descricao, 'agenda-card-description');
    const tags = document.createElement('div');
    tags.className = 'film-tags';
    tags.setAttribute('aria-label', 'Tipo de conteúdo');
    appendText(tags, 'span', 'Informação');
    appendText(tags, 'span', 'Utilidade Pública');
    for (const area of Array.isArray(movie.areas_utilidade) ? movie.areas_utilidade : []) {
      appendText(tags, 'span', area);
    }
    body.appendChild(tags);
    const actions = document.createElement('div');
    actions.className = 'agenda-card-actions';
    const action = document.createElement('button');
    action.type = 'button';
    action.className = 'support-card-action';
    action.textContent = 'Ver informações, contatos e endereços';
    action.addEventListener('click', () => openSupportArea(action, movie.support_target));
    actions.appendChild(action);
    body.appendChild(actions);
    article.append(media, body);
    return article;
  }

  function mountSupportArea(data) {
    document.getElementById('support-help-dialog')?.remove();
    supportDialog = null;
    delete document.documentElement.dataset.siteCurationHelp;
    if (!data || !Array.isArray(data.secoes)) {
      window.dispatchEvent(new CustomEvent('mural:site-curation-change'));
      return null;
    }

    const dialog = document.createElement('dialog');
    dialog.id = 'support-help-dialog';
    dialog.className = 'support-help-dialog';
    dialog.setAttribute('aria-labelledby', 'support-help-title');

    const shell = document.createElement('div');
    shell.className = 'support-help-shell';
    const header = document.createElement('header');
    header.className = 'support-help-header';
    const heading = document.createElement('div');
    appendText(heading, 'p', data.selo || 'Piloto no site de teste', 'support-help-eyebrow');
    const title = appendText(heading, 'h2', data.titulo || 'Onde buscar ajuda');
    if (title) title.id = 'support-help-title';
    appendText(heading, 'p', data.introducao, 'support-help-intro');
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'support-help-close';
    close.setAttribute('aria-label', 'Fechar Onde buscar ajuda');
    close.textContent = '×';
    header.append(heading, close);
    shell.appendChild(header);

    if (data.emergencia) {
      const emergency = document.createElement('section');
      emergency.className = 'support-help-emergency';
      appendText(emergency, 'h3', data.emergencia.titulo || 'Emergência');
      appendText(emergency, 'p', data.emergencia.texto);
      if (Array.isArray(data.emergencia.contatos) && data.emergencia.contatos.length) {
        const contacts = document.createElement('ul');
        contacts.className = 'support-help-contacts';
        for (const contact of data.emergencia.contatos) appendText(contacts, 'li', contact);
        emergency.appendChild(contacts);
      }
      const emergencyLink = officialLink(data.emergencia.url, data.emergencia.cta);
      if (emergencyLink) emergency.appendChild(emergencyLink);
      shell.appendChild(emergency);
    }

    const sections = document.createElement('div');
    sections.className = 'support-help-sections';
    for (const sectionData of data.secoes) {
      const section = document.createElement('section');
      section.className = 'support-help-section';
      if (sectionData.id) section.dataset.supportTarget = sectionData.id;
      const sectionTitle = appendText(section, 'h3', sectionData.titulo);
      if (sectionTitle) sectionTitle.tabIndex = -1;
      appendText(section, 'p', sectionData.descricao, 'support-help-section-intro');
      for (const serviceData of Array.isArray(sectionData.servicos) ? sectionData.servicos : []) {
        const service = document.createElement('article');
        service.className = 'support-help-service';
        appendSupportImage(service, serviceData.imagem, serviceData.nome ? `Imagem de ${serviceData.nome}` : 'Imagem do serviço');
        appendText(service, 'h4', serviceData.nome);
        appendText(service, 'p', serviceData.descricao);
        appendText(service, 'p', serviceData.endereco, 'support-help-address');
        if (Array.isArray(serviceData.contatos) && serviceData.contatos.length) {
          const contacts = document.createElement('ul');
          contacts.className = 'support-help-contacts';
          for (const contact of serviceData.contatos) appendText(contacts, 'li', contact);
          service.appendChild(contacts);
        }
        appendText(service, 'p', serviceData.observacao, 'support-help-note');
        const link = officialLink(serviceData.url, serviceData.cta);
        if (link) service.appendChild(link);
        for (const additional of Array.isArray(serviceData.links_adicionais) ? serviceData.links_adicionais : []) {
          const additionalLink = officialLink(additional?.url, additional?.cta);
          if (additionalLink) service.appendChild(additionalLink);
        }
        section.appendChild(service);
      }
      sections.appendChild(section);
    }
    shell.appendChild(sections);

    if (Array.isArray(data.recursos_informativos) && data.recursos_informativos.length) {
      const resources = document.createElement('section');
      resources.className = 'support-help-section support-help-resources';
      resources.dataset.supportTarget = data.informacao_confiavel?.id || 'informacao-confiavel';
      const resourcesTitle = appendText(resources, 'h3', data.informacao_confiavel?.titulo || 'Informação confiável');
      if (resourcesTitle) resourcesTitle.tabIndex = -1;
      appendText(
        resources,
        'p',
        data.informacao_confiavel?.apresentacao || 'Materiais gratuitos de instituições públicas e organizações de referência para conhecer melhor temas relacionados a saúde mental, cuidado e vida escolar.',
        'support-help-section-intro'
      );
      for (const resourceData of data.recursos_informativos) {
        const resource = document.createElement('article');
        resource.className = 'support-help-service support-help-resource';
        appendText(resource, 'p', resourceData.subsecao, 'support-help-resource-section');
        appendText(resource, 'h4', resourceData.titulo);
        const sourceLine = [resourceData.fonte, resourceData.ano].filter(Boolean).join(' • ');
        appendText(resource, 'p', sourceLine, 'support-help-address');
        appendText(resource, 'p', resourceData.conteudo_sensivel, 'support-help-sensitive');
        appendText(resource, 'p', resourceData.descricao);
        appendText(resource, 'p', resourceData.observacao, 'support-help-note');
        const link = officialLink(resourceData.url, resourceData.cta || 'Acessar material oficial');
        if (link) resource.appendChild(link);
        resources.appendChild(resource);
      }
      shell.appendChild(resources);
    }

    appendText(shell, 'p', data.aviso_institucional, 'support-help-disclaimer');
    appendText(shell, 'p', data.chamada_futura, 'support-help-future');
    dialog.appendChild(shell);
    document.body.appendChild(dialog);

    close.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener('close', () => {
      supportOpener?.focus?.();
      supportOpener = null;
    });
    supportDialog = dialog;
    document.documentElement.dataset.siteCurationHelp = data.campaignActive
      ? (data.curationId || 'available')
      : 'available';
    window.dispatchEvent(new CustomEvent('mural:site-curation-change'));
    return dialog;
  }

  function openSupportArea(opener = document.activeElement, target = '') {
    if (!supportDialog) return false;
    supportOpener = opener;
    if (typeof supportDialog.showModal === 'function') supportDialog.showModal();
    else supportDialog.setAttribute('open', '');
    const targetSection = target
      ? [...supportDialog.querySelectorAll('[data-support-target]')]
        .find(section => section.dataset.supportTarget === target)
      : null;
    if (targetSection) {
      targetSection.scrollIntoView?.({ block: 'start' });
      targetSection.querySelector('h3')?.focus();
    } else {
      supportDialog.querySelector('.support-help-close')?.focus();
    }
    return true;
  }

  function bindSupportRequest() {
    if (supportListenerBound) return;
    supportListenerBound = true;
    window.addEventListener('mural:support-help-request', event => {
      openSupportArea(event.detail?.opener || document.activeElement, event.detail?.target || '');
    });
  }

  root.siteCurations = Object.freeze({
    apply,
    bindSupportRequest,
    createAgendaSupportCard,
    createPanelSupportSlide,
    dateKey,
    effectiveItemForCuration,
    eventIsCurrent,
    isActive,
    isPromoted,
    mergeCurationIds,
    matchesCuration,
    isValidPayload,
    mergeLabels,
    mountSupportArea,
    normalizeLabel,
    openSupportArea,
    safeExternalUrl,
    safeImage,
    setPanelSupportImageState
  });

  (() => {
    const CURATION_QUERY_PARAM = 'curadoria';
    const initialRequestedCuration = (() => {
      try {
        return String(new URL(window.location.href).searchParams.get(CURATION_QUERY_PARAM) || '').trim();
      } catch {
        return '';
      }
    })();
    let pendingInitialCuration = initialRequestedCuration;
    let curationsLoaded = false;
    let enhancementScheduled = false;

    function curationUrl(curationId = '') {
      const url = new URL(window.location.href);
      const id = String(curationId || '').trim();
      if (id) url.searchParams.set(CURATION_QUERY_PARAM, id);
      else url.searchParams.delete(CURATION_QUERY_PARAM);
      return url;
    }

    function replaceCurationUrl(curationId = '') {
      try {
        const url = curationUrl(curationId);
        if (url.href !== window.location.href) history.replaceState(history.state, '', url);
      } catch {
        /* A Agenda continua funcional mesmo sem sincronização de URL. */
      }
    }

    async function copyText(value) {
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(value);
          return true;
        } catch {
          /* Usa fallback compatível com navegadores mais antigos. */
        }
      }
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      let copied = false;
      try {
        copied = document.execCommand('copy');
      } catch {
        copied = false;
      }
      textarea.remove();
      return copied;
    }

    async function shareCuration(button, select) {
      const curationId = String(select?.value || '').trim();
      if (!curationId) return;
      const option = select.selectedOptions?.[0];
      const title = String(option?.textContent || 'Curadoria do Mural Cultural').trim();
      const url = curationUrl(curationId).href;

      if (typeof navigator.share === 'function') {
        try {
          await navigator.share({
            title,
            text: 'Confira esta curadoria no Mural Cultural.',
            url
          });
          return;
        } catch (error) {
          if (error?.name === 'AbortError') return;
        }
      }

      const copied = await copyText(url);
      if (!button?.isConnected) return;
      const original = button.textContent;
      button.textContent = copied ? 'Link copiado' : 'Copie o link da barra de endereço';
      window.setTimeout(() => {
        if (button.isConnected) button.textContent = original;
      }, 2200);
    }

    function enhanceAgendaCurationControls() {
      enhancementScheduled = false;
      const select = document.querySelector('.agenda-curation');
      if (!select) return;

      const optionValues = new Set([...select.options].map(option => String(option.value || '')));
      if (pendingInitialCuration) {
        if (optionValues.has(pendingInitialCuration)) {
          const requested = pendingInitialCuration;
          pendingInitialCuration = '';
          if (select.value !== requested) {
            select.value = requested;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            return;
          }
        } else if (curationsLoaded && select.options.length > 1) {
          pendingInitialCuration = '';
          replaceCurationUrl(select.value);
        }
      } else {
        replaceCurationUrl(select.value);
      }

      const label = select.closest('label');
      if (!label?.parentElement) return;
      let button = label.parentElement.querySelector('.agenda-curation-share');
      if (!button) {
        button = document.createElement('button');
        button.type = 'button';
        button.className = 'agenda-section-action agenda-curation-share';
        button.textContent = 'Compartilhar curadoria';
        label.insertAdjacentElement('afterend', button);
        button.addEventListener('click', () => shareCuration(button, select));
      }
      button.hidden = !select.value;
    }

    function scheduleEnhancement() {
      if (enhancementScheduled) return;
      enhancementScheduled = true;
      queueMicrotask(enhanceAgendaCurationControls);
    }

    document.addEventListener('change', event => {
      if (!event.target?.matches?.('.agenda-curation')) return;
      replaceCurationUrl(event.target.value);
      scheduleEnhancement();
    }, true);

    window.addEventListener('mural:curations-loaded', () => {
      curationsLoaded = true;
      scheduleEnhancement();
    });

    const app = document.getElementById('app');
    if (app) {
      const observer = new MutationObserver(scheduleEnhancement);
      observer.observe(app, { childList: true, subtree: true });
    }
    scheduleEnhancement();
  })();
})();
