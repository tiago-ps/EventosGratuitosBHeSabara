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
    const current = dateKey(today);
    const start = String(curation?.ativo_de || '');
    const end = String(curation?.ativo_ate || '');
    return Boolean(current && start && end && current >= start && current <= end);
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
      temas: Array.isArray(record?.temas) ? [...record.temas] : record?.temas
    };
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
        options.warn(`Curadoria site-only: complemento de ${options.label} sem ID próprio ou com colisão; item ignorado.`);
        continue;
      }
      const item = {
        ...sanitizeUntrustedRecord(complement, options.warn, `complemento de ${options.label}`),
        origem: 'site-only',
        site_only: true
      };
      result.push(item);
      complementIds.forEach(identifier => identifiers.add(identifier));
    }
    return result;
  }

  function findSupportSection(data, term) {
    const needle = normalizeLabel(term);
    return (Array.isArray(data?.secoes) ? data.secoes : [])
      .find(section => normalizeLabel(section?.titulo).includes(needle)) || null;
  }

  function supportServiceNames(section) {
    return (Array.isArray(section?.servicos) ? section.servicos : [])
      .map(service => String(service?.nome || '').trim())
      .filter(Boolean);
  }

  function buildPanelSupportItems(data) {
    if (!data || !Array.isArray(data.secoes)) return [];

    const emotionalSection = findSupportSection(data, 'apoio emocional');
    const publicSection = findSupportSection(data, 'rede publica');
    const universitySection = findSupportSection(data, 'universitario');
    const cvv = (Array.isArray(emotionalSection?.servicos) ? emotionalSection.servicos : [])
      .find(service => normalizeLabel(service?.nome).includes('cvv')) || emotionalSection?.servicos?.[0] || null;
    const publicNames = supportServiceNames(publicSection);
    const universityNames = supportServiceNames(universitySection);
    const resources = Array.isArray(data.recursos_informativos) ? data.recursos_informativos : [];
    const resourceSources = [...new Set(resources.map(item => String(item?.fonte || '').trim()).filter(Boolean))];

    return [
      {
        id: 'site:apoio:setembro-cvv-188',
        painel_apoio: true,
        support_target: 'apoio-emocional',
        titulo: 'Se precisar conversar, peça ajuda.',
        descricao: 'Há diferentes caminhos de escuta e apoio. Consulte no Mural os canais do CVV, o serviço Pode Falar e o acesso pelo Meu SUS Digital.',
        destaque: 'CVV • 188 • Pode Falar',
        detalhe: 'Apoio emocional e orientação para adolescentes e jovens',
        fonte_label: 'Canais de apoio emocional',
        imagem: data.imagens_cards?.apoio_emocional,
        termos_busca: ['CVV', '188', 'Pode Falar', 'Meu SUS Digital', 'apoio emocional', 'escuta'],
        observacao: 'Em situação de emergência ou risco imediato, procure um serviço de urgência ou acione o SAMU pelo telefone 192.',
        icone: '💛',
        temas: ['Setembro Amarelo'],
        tempo_slide: 15
      },
      {
        id: 'site:apoio:setembro-rede-publica',
        painel_apoio: true,
        support_target: 'rede-publica',
        titulo: 'Onde buscar atendimento em saúde mental',
        descricao: 'A rede pública oferece serviços de atenção psicossocial. Os contatos completos e orientações estão disponíveis em “Onde buscar ajuda”.',
        destaque: publicNames.filter(name => normalizeLabel(name).includes('sabara')).length
          ? 'Sabará: CAPS Adulto e CAPS Infantil'
          : 'CAPS e serviços da rede pública',
        detalhe: 'Belo Horizonte: CERSAM / CERSAMi • Emergência: SAMU 192',
        fonte_label: 'Rede pública de saúde mental',
        imagem: data.imagens_cards?.rede_publica,
        termos_busca: ['CAPS', 'CERSAM', 'CERSAMi', 'SAMU', 'UPA', 'rede pública', 'atendimento'],
        observacao: 'Confirme diretamente com cada serviço as condições atuais de atendimento e disponibilidade.',
        icone: '🤝',
        temas: ['Setembro Amarelo'],
        tempo_slide: 15
      },
      {
        id: 'site:apoio:setembro-universidades',
        painel_apoio: true,
        support_target: 'atendimento-universitario',
        titulo: 'Atendimento psicológico universitário',
        descricao: 'Clínicas-escola e serviços universitários podem oferecer atendimento psicológico à comunidade, conforme triagem, vagas e condições de cada instituição.',
        destaque: universityNames.length
          ? universityNames.map(name => {
            if (normalizeLabel(name).includes('ufmg')) return 'UFMG';
            if (normalizeLabel(name).includes('puc minas')) return 'PUC Minas';
            if (normalizeLabel(name).includes('fumec')) return 'FUMEC';
            return name;
          }).filter((value, index, values) => values.indexOf(value) === index).join(' • ')
          : 'UFMG • PUC Minas • FUMEC',
        detalhe: 'Atendimento sujeito a triagem, disponibilidade e condições atuais da instituição.',
        fonte_label: 'Serviços universitários de Psicologia',
        imagem: data.imagens_cards?.atendimento_universitario,
        termos_busca: ['UFMG', 'PUC Minas', 'FUMEC', 'clínica-escola', 'psicologia', 'universidade'],
        observacao: 'Esses serviços não substituem CERSAM, SAMU ou pronto atendimento em situações de emergência.',
        icone: '🧠',
        temas: ['Setembro Amarelo'],
        tempo_slide: 15
      },
      {
        id: 'site:apoio:setembro-informacao-confiavel',
        painel_apoio: true,
        support_target: 'informacao-confiavel',
        titulo: 'Informação confiável sobre saúde mental',
        descricao: 'O Mural reúne materiais gratuitos de instituições oficiais para leitura e aprofundamento sobre saúde mental, prevenção, acolhimento e redes de apoio.',
        destaque: resourceSources.length
          ? resourceSources.slice(0, 4).map(source => {
            const normalized = normalizeLabel(source);
            if (normalized.includes('ministerio da saude')) return 'Ministério da Saúde';
            if (normalized.includes('conselho federal de psicologia')) return 'CFP';
            if (normalized.includes('organizacao mundial da saude')) return 'OMS';
            if (normalized.includes('associacao brasileira de psiquiatria')) return 'Setembro Amarelo®';
            return source;
          }).filter((value, index, values) => values.indexOf(value) === index).join(' • ')
          : 'Ministério da Saúde • CFP • OMS • Setembro Amarelo®',
        detalhe: `${resources.length || 0} materiais informativos gratuitos disponíveis em “Onde buscar ajuda”.`,
        fonte_label: 'Materiais informativos gratuitos',
        imagem: data.imagens_cards?.informacao_confiavel,
        termos_busca: ['saúde mental', 'materiais', 'informação', 'Ministério da Saúde', 'CFP', 'OMS'],
        observacao: 'Materiais informativos não substituem avaliação ou atendimento profissional.',
        icone: '📚',
        temas: ['Setembro Amarelo'],
        tempo_slide: 15
      }
    ];
  }

  function appendPanelSupportItems(records, supportData, warn) {
    const result = [...records];
    const existingIds = new Set(result.map(item => String(item?.id || '')).filter(Boolean));
    for (const item of buildPanelSupportItems(supportData)) {
      if (!item.id || existingIds.has(String(item.id))) {
        warn(`Curadoria site-only: apoio de painel ${item.id || '(sem ID)'} ignorado por colisão.`);
        continue;
      }
      result.push({
        ...cloneRecord(item),
        origem: 'site-only',
        site_only: true
      });
      existingIds.add(String(item.id));
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
      apoio: null,
      curadoriasAtivas: []
    };

    if (!isValidPayload(payload)) return result;

    const permanentCuration = payload.curadorias.find(curation =>
      curation?.complementos?.servicos_apoio?.permanente === true
    );
    if (permanentCuration) {
      result.apoio = {
        ...permanentCuration.complementos.servicos_apoio,
        curationId: permanentCuration.id,
        campaignActive: isActive(permanentCuration, options.today || new Date()),
        site_only: true
      };
      result.filmes = appendPanelSupportItems(result.filmes, result.apoio, warn);
    }

    for (const curation of payload.curadorias.filter(item => isActive(item, options.today || new Date()))) {
      const overlays = curation.overlays || {};
      const complements = curation.complementos || {};
      result.eventos = applyOverlayCollection(result.eventos, overlays.eventos, {
        idField: 'id', label: 'evento', warn
      });
      result.livros = applyOverlayCollection(result.livros, overlays.livros, {
        idField: 'id', label: 'livro', warn
      });
      result.cursos = applyOverlayCollection(result.cursos, overlays.cursos, {
        idField: 'id_fonte', label: 'curso', warn
      });
      result.filmes = applyOverlayCollection(result.filmes, overlays.filmes, {
        idField: 'id', label: 'filme', warn
      });
      result.eventos = appendComplements(result.eventos, complements.eventos, {
        label: 'evento', warn,
        identifiers: item => [item?.id],
        include: item => eventIsCurrent(item, options.today || new Date())
      });
      result.livros = appendComplements(result.livros, complements.livros, {
        label: 'livro', warn,
        identifiers: item => [item?.id]
      });
      result.cursos = appendComplements(result.cursos, complements.cursos, {
        label: 'curso', warn,
        identifiers: item => [item?.id, item?.id_fonte]
      });
      result.filmes = appendComplements(result.filmes, complements.filmes, {
        label: 'filme', warn,
        identifiers: item => [item?.id]
      });
      if (complements.servicos_apoio && typeof complements.servicos_apoio === 'object') {
        result.apoio = {
          ...complements.servicos_apoio,
          curationId: curation.id,
          campaignActive: true,
          site_only: true
        };
        if (complements.servicos_apoio.permanente !== true) {
          result.filmes = appendPanelSupportItems(result.filmes, result.apoio, warn);
        }
      }
      result.curadoriasAtivas.push(curation.id);
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

  function isPanelSupportMovie(movie) {
    return movie?.painel_apoio === true;
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

  function supportThemeIsActive(filters = {}) {
    return normalizeLabel(filters?.theme) === 'setembro amarelo';
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
    slide.setAttribute('aria-label', `Informação de apoio: ${movie.titulo || 'Setembro Amarelo'}`);

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
      campaign.textContent = 'SETEMBRO AMARELO';
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
    if (fallbackLabel) fallbackLabel.textContent = 'Setembro Amarelo';
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
    appendText(tags, 'span', 'Utilidade pública');
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

  function installPanelSupportAdapter() {
    const films = root.contents?.films;
    if (!films || films.__panelSupportAdapter === true) return false;

    const originalFilter = films.filter;
    const originalOptions = films.options;
    const originalSampleForPanel = films.sampleForPanel;
    const originalCreatePanelSlide = films.createPanelSlide;
    const originalCreateAgendaCard = films.createAgendaCard;
    if (![originalFilter, originalOptions, originalSampleForPanel, originalCreatePanelSlide, originalCreateAgendaCard].every(fn => typeof fn === 'function')) {
      return false;
    }

    const culturalOnly = movies => (Array.isArray(movies) ? movies : []).filter(movie => !isPanelSupportMovie(movie));
    const supportOnly = movies => (Array.isArray(movies) ? movies : []).filter(isPanelSupportMovie);

    root.contents.films = Object.freeze({
      ...films,
      __panelSupportAdapter: true,
      filter(movies, filters = {}, normalizeText) {
        const cultural = originalFilter(culturalOnly(movies), filters, normalizeText);
        const normalize = typeof normalizeText === 'function' ? normalizeText : normalizeLabel;
        const needle = normalize(filters.query || '');
        if (!needle) return cultural;
        const matchingSupport = supportOnly(movies).filter(movie => normalize([
          movie.titulo,
          movie.descricao,
          movie.destaque,
          movie.detalhe,
          ...(Array.isArray(movie.termos_busca) ? movie.termos_busca : [])
        ].join(' ')).includes(needle));
        return [...cultural, ...matchingSupport];
      },
      options(movies, field) {
        return originalOptions(culturalOnly(movies), field);
      },
      sampleForPanel(movies, filters = {}, normalizeText, limit, sampleOptions = {}) {
        const culturalPrevious = Array.isArray(sampleOptions?.previousItems)
          ? sampleOptions.previousItems.filter(item => !isPanelSupportMovie(item))
          : sampleOptions?.previousItems;
        const cultural = originalSampleForPanel(
          culturalOnly(movies),
          filters,
          normalizeText,
          limit,
          { ...sampleOptions, previousItems: culturalPrevious }
        );
        if (!supportThemeIsActive(filters)) return cultural;

        const support = supportOnly(movies);
        const combined = [];
        const maximum = Math.max(cultural.length, support.length);
        for (let index = 0; index < maximum; index += 1) {
          if (support[index]) combined.push(support[index]);
          if (cultural[index]) combined.push(cultural[index]);
        }
        return combined;
      },
      createPanelSlide(args) {
        return isPanelSupportMovie(args?.movie)
          ? createPanelSupportSlide(args)
          : originalCreatePanelSlide(args);
      },
      createAgendaCard(movie, helpers) {
        return isPanelSupportMovie(movie)
          ? createAgendaSupportCard(movie)
          : originalCreateAgendaCard(movie, helpers);
      }
    });
    return true;
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

  installPanelSupportAdapter();

  root.siteCurations = Object.freeze({
    apply,
    bindSupportRequest,
    buildPanelSupportItems,
    dateKey,
    eventIsCurrent,
    isActive,
    isValidPayload,
    mergeLabels,
    mountSupportArea,
    normalizeLabel,
    openSupportArea,
    safeExternalUrl,
    safeImage,
    setPanelSupportImageState
  });
})();
