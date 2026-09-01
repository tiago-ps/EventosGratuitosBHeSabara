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

  function applyOverlayCollection(records, overlays, options) {
    const result = (Array.isArray(records) ? records : []).map(cloneRecord);
    const entries = overlays && typeof overlays === 'object' ? Object.entries(overlays) : [];
    for (const [identifier, overlay] of entries) {
      const target = result.find(item => String(item?.[options.idField] || '') === String(identifier));
      if (!target) {
        options.warn(`Curadoria site-only: ${options.label} ${identifier} não encontrado.`);
        continue;
      }
      if (overlay?.titulo_esperado && normalizeLabel(target.titulo) !== normalizeLabel(overlay.titulo_esperado)) {
        options.warn(`Curadoria site-only: título divergente para ${options.label} ${identifier}; overlay ignorado.`);
        continue;
      }
      target.temas = mergeLabels(target.temas, overlay?.temas);
    }
    return result;
  }

  function appendComplements(records, complements, options) {
    const result = [...records];
    const identifiers = new Set(result.flatMap(item => options.identifiers(item)).filter(Boolean).map(String));
    for (const complement of Array.isArray(complements) ? complements : []) {
      const complementIds = options.identifiers(complement).filter(Boolean).map(String);
      if (!complementIds.length || complementIds.some(identifier => identifiers.has(identifier))) {
        options.warn(`Curadoria site-only: complemento de ${options.label} sem ID próprio ou com colisão; item ignorado.`);
        continue;
      }
      const item = {
        ...cloneRecord(complement),
        origem: 'site-only',
        site_only: true
      };
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
      apoio: null,
      curadoriasAtivas: []
    };

    if (!isValidPayload(payload)) return result;

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
          site_only: true
        };
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
      const emergencyLink = officialLink(data.emergencia.url, data.emergencia.cta);
      if (emergencyLink) emergency.appendChild(emergencyLink);
      shell.appendChild(emergency);
    }

    const sections = document.createElement('div');
    sections.className = 'support-help-sections';
    for (const sectionData of data.secoes) {
      const section = document.createElement('section');
      section.className = 'support-help-section';
      appendText(section, 'h3', sectionData.titulo);
      appendText(section, 'p', sectionData.descricao, 'support-help-section-intro');
      for (const serviceData of Array.isArray(sectionData.servicos) ? sectionData.servicos : []) {
        const service = document.createElement('article');
        service.className = 'support-help-service';
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
        section.appendChild(service);
      }
      sections.appendChild(section);
    }
    shell.appendChild(sections);
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
    document.documentElement.dataset.siteCurationHelp = data.curationId || 'available';
    window.dispatchEvent(new CustomEvent('mural:site-curation-change'));
    return dialog;
  }

  function openSupportArea(opener = document.activeElement) {
    if (!supportDialog) return false;
    supportOpener = opener;
    if (typeof supportDialog.showModal === 'function') supportDialog.showModal();
    else supportDialog.setAttribute('open', '');
    supportDialog.querySelector('.support-help-close')?.focus();
    return true;
  }

  function bindSupportRequest() {
    if (supportListenerBound) return;
    supportListenerBound = true;
    window.addEventListener('mural:support-help-request', event => {
      openSupportArea(event.detail?.opener || document.activeElement);
    });
  }

  root.siteCurations = Object.freeze({
    apply,
    bindSupportRequest,
    dateKey,
    isActive,
    isValidPayload,
    mergeLabels,
    mountSupportArea,
    normalizeLabel,
    openSupportArea
  });
})();
