(() => {
  'use strict';

  const PANEL_CONTEST_LIMIT = 15;
  const FALLBACK_IMAGE = 'https://raw.githubusercontent.com/tiago-ps/ColetorEventosGratuitos/main/imagens/concursos/concurso-fallback.png';

  function normalizeText(value = '') {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function escapeHtml(value = '') {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  const MONTHS_PT = Object.freeze({
    janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
    julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12
  });

  function isoDateFromLegacy(value = '') {
    const normalized = normalizeText(value).replace(/\s+/g, ' ');
    let match = normalized.match(/^(\d{1,2}) de ([a-z]+) de (20\d{2})$/);
    if (match && MONTHS_PT[match[2]]) {
      return `${match[3]}-${String(MONTHS_PT[match[2]]).padStart(2, '0')}-${String(match[1]).padStart(2, '0')}`;
    }
    match = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(20\d{2})$/);
    if (match) {
      return `${match[3]}-${String(match[2]).padStart(2, '0')}-${String(match[1]).padStart(2, '0')}`;
    }
    return '';
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
      if (values.year && values.month && values.day) return `${values.year}-${values.month}-${values.day}`;
    } catch {
      /* fallback local abaixo */
    }
    return [
      referenceDate.getFullYear(),
      String(referenceDate.getMonth() + 1).padStart(2, '0'),
      String(referenceDate.getDate()).padStart(2, '0')
    ].join('-');
  }

  function deadlineWindow(contest) {
    const structured = contest?.janela_inscricoes && typeof contest.janela_inscricoes === 'object'
      ? contest.janela_inscricoes
      : {};
    const inicio = String(structured.inicio || '').trim() || isoDateFromLegacy(contest?.inscricoes_inicio_texto);
    const fim = String(structured.fim || '').trim() || isoDateFromLegacy(contest?.inscricoes_fim_texto);
    return { inicio, fim };
  }

  function deadlineState(contest, referenceDate = new Date()) {
    const { inicio, fim } = deadlineWindow(contest);
    const today = muralDateKey(referenceDate);
    if (fim && fim < today) return 'encerrado';
    if (inicio && inicio > today) return 'futuro';
    if (fim && (!inicio || inicio <= today)) return 'aberto';
    const stored = String(contest?.janela_inscricoes?.estado || '').trim();
    return ['futuro', 'aberto', 'encerrado', 'prazo_desconhecido'].includes(stored)
      ? stored
      : 'prazo_desconhecido';
  }

  function deadlineStateLabel(contest, referenceDate = new Date()) {
    const state = deadlineState(contest, referenceDate);
    return {
      futuro: 'Inscrições futuras',
      aberto: 'Inscrições abertas',
      encerrado: 'Inscrições encerradas',
      prazo_desconhecido: 'Prazo a confirmar'
    }[state] || 'Prazo a confirmar';
  }

  function isTemporallyVisible(contest, referenceDate = new Date()) {
    return deadlineState(contest, referenceDate) !== 'encerrado';
  }

  function isValid(contest) {
    return Boolean(
      contest &&
      String(contest.titulo || '').trim() &&
      String(contest.url || '').trim()
    );
  }

  function publicRecord(contest) {
    if (!contest || typeof contest !== 'object') return contest;
    const { evidencias_formacao: _privateEvidence, ...publicContest } = contest;
    return publicContest;
  }

  function remunerationValues(value = '') {
    const matches = String(value || '').match(/R\$\s*[\d.]+(?:,\d{1,2})?/g) || [];
    return matches.map(match => Number(
      match.replace(/R\$\s*/g, '').replaceAll('.', '').replace(',', '.')
    )).filter(number => Number.isFinite(number) && number >= 0);
  }

  function remunerationMax(contest) {
    const values = remunerationValues(contest?.remuneracao_faixa_texto);
    return values.length ? Math.max(...values) : null;
  }

  function remunerationMatches(contest, band = '') {
    if (!band) return true;
    const value = remunerationMax(contest);
    if (value === null) return band === 'nao-informada';
    if (band === 'ate-3000') return value <= 3000;
    if (band === '3000-5000') return value > 3000 && value <= 5000;
    if (band === '5000-10000') return value > 5000 && value <= 10000;
    if (band === 'mais-10000') return value > 10000;
    return true;
  }

  function filter(contests, filters = {}) {
    const query = normalizeText(filters.query);
    const formation = String(filters.formation || '');
    const uf = String(filters.uf || '');
    const city = normalizeText(filters.city || '');
    const deadline = String(filters.deadline || '');
    const temporalState = String(filters.state || '');
    const remuneration = String(filters.remuneration || '');

    return (Array.isArray(contests) ? contests : [])
      .filter(isValid)
      .filter(contest => {
        const formations = Array.isArray(contest.formacoes_compativeis)
          ? contest.formacoes_compativeis
          : [];
        const positions = (Array.isArray(contest.cargos_compativeis)
          ? contest.cargos_compativeis
          : [])
          .map(item => item?.cargo)
          .filter(Boolean);
        const window = deadlineWindow(contest);
        const hasDeadline = Boolean(window.inicio || window.fim || contest.inscricoes_texto);
        const state = deadlineState(contest);

        if (!temporalState && state === 'encerrado') return false;
        if (temporalState && temporalState !== 'todos' && state !== temporalState) return false;
        if (formation && !formations.includes(formation)) return false;
        if (uf && contest.uf !== uf) return false;
        if (city && normalizeText(contest.cidade) !== city) return false;
        if (deadline === 'com-data' && !hasDeadline) return false;
        if (deadline === 'sem-data' && hasDeadline) return false;
        if (!remunerationMatches(contest, remuneration)) return false;
        if (!query) return true;

        return normalizeText([
          contest.titulo,
          contest.cidade,
          contest.uf,
          ...positions,
          ...formations
        ].filter(Boolean).join(' ')).includes(query);
      });
  }

  function formationOptions(contests) {
    return [...new Set(
      (Array.isArray(contests) ? contests : [])
        .filter(isValid)
        .flatMap(contest => Array.isArray(contest.formacoes_compativeis)
          ? contest.formacoes_compativeis
          : [])
        .filter(Boolean)
    )]
      .sort((a, b) => a.localeCompare(b, 'pt-BR'))
      .map(label => [label, label]);
  }

  function ufOptions(contests) {
    return [...new Set(
      (Array.isArray(contests) ? contests : [])
        .filter(isValid)
        .map(contest => contest.uf)
        .filter(Boolean)
    )]
      .sort((a, b) => a.localeCompare(b, 'pt-BR'))
      .map(label => [label, label]);
  }

  function cityOptions(contests) {
    const values = new Map();
    for (const contest of Array.isArray(contests) ? contests : []) {
      if (!isValid(contest)) continue;
      const label = String(contest.cidade || '').trim();
      const value = normalizeText(label);
      if (label && value && !values.has(value)) values.set(value, label);
    }
    return [...values.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  }

  function sampleForPanel(contests, limit = PANEL_CONTEST_LIMIT, options = {}) {
    const available = (Array.isArray(contests) ? contests : [])
      .filter(isValid)
      .filter(contest => isTemporallyVisible(contest))
      .map(publicRecord);
    return window.MuralCultural.core.sampleForPanel(available, limit, options);
  }

  function summarizedList(items, limit = 2) {
    const values = (Array.isArray(items) ? items : []).filter(Boolean);
    const visible = values.slice(0, limit);
    const remaining = values.length - visible.length;
    return remaining > 0
      ? `${visible.join(' • ')} • + ${remaining} ${remaining === 1 ? 'item' : 'itens'}`
      : visible.join(' • ');
  }

  function createPanelSlide({ contest, index, total, template, helpers }) {
    const {
      buildSiteQr,
      slideDurationFor,
      configureItemQrLabel,
      buildQr,
      safeExternalUrl,
      safeImageUrl
    } = helpers;

    // Cada Concurso nasce de um clone novo para não herdar estado visual
    // do Evento, Livro, Curso ou Concurso exibido anteriormente.
    const slide = template.content.firstElementChild.cloneNode(true);
    slide.classList.add('contest-slide');
    buildSiteQr(slide, contest);

    const seconds = slideDurationFor(contest);
    slide.style.setProperty('--slide-seconds', `${seconds}s`);
    slide.querySelector('.counter').textContent = `${index + 1} de ${total}`;

    const eventCopy = slide.querySelector('.event-copy');
    const bookCopy = slide.querySelector('.book-copy');
    if (bookCopy) bookCopy.hidden = true;
    if (eventCopy) eventCopy.hidden = false;

    const formations = Array.isArray(contest.formacoes_compativeis)
      ? contest.formacoes_compativeis.filter(Boolean)
      : [];
    const positions = (Array.isArray(contest.cargos_compativeis)
      ? contest.cargos_compativeis
      : [])
      .filter(position => position?.cargo)
      .map(position => position.vagas_texto
        ? `${position.cargo} — ${position.vagas_texto}`
        : position.cargo);
    const location = [contest.cidade, contest.uf].filter(Boolean).join(' · ');

    const badges = slide.querySelector('.badges');
    if (badges) {
      badges.replaceChildren();
      const badgeValues = [
        ['badge category', 'CONCURSO'],
        ['badge contest-deadline-state', deadlineStateLabel(contest)],
        ['badge contest-uf', contest.uf || 'BR'],
        ['badge contest-formation', formations[0] || 'FORMAÇÃO NO EDITAL']
      ];
      for (const [className, label] of badgeValues) {
        const badge = document.createElement('span');
        badge.className = className;
        badge.textContent = label;
        badges.append(badge);
      }
    }

    const title = slide.querySelector('.event-title');
    if (title) title.textContent = contest.titulo || 'Concurso público';

    const description = slide.querySelector('.description');
    if (description) {
      description.textContent = summarizedList(positions) ||
        'Consulte no edital os cargos e requisitos disponíveis.';
    }

    const details = slide.querySelector('.details');
    if (details) {
      details.replaceChildren();
      const detailValues = [
        ['Inscrições', contest.inscricoes_texto || 'Consulte o edital'],
        ['Remuneração', contest.remuneracao_faixa_texto || 'Consulte o edital']
      ];
      for (const [label, value] of detailValues) {
        const row = document.createElement('div');
        const term = document.createElement('dt');
        const descriptionValue = document.createElement('dd');
        term.textContent = label;
        descriptionValue.textContent = value;
        row.append(term, descriptionValue);
        details.append(row);
      }
    }

    const link = safeExternalUrl(contest.url);
    const sourceLabel = slide.querySelector('.source-label');
    if (sourceLabel) sourceLabel.textContent = 'Concurso público';

    const source = slide.querySelector('.source-url');
    if (source) {
      if (link) {
        const anchor = document.createElement('a');
        anchor.href = link;
        anchor.textContent = 'Ver concurso e edital';
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        source.replaceChildren(anchor);
      } else {
        source.textContent = 'Consulte o edital oficial';
      }
    }

    const formationSummary = summarizedList(formations, 2) || 'consulte o edital';
    const updated = slide.querySelector('.updated');
    if (updated) {
      updated.textContent = `${location || 'Localidade no edital'} · Formação compatível: ${formationSummary}`;
    }

    const qr = slide.querySelector('.qr-code');
    configureItemQrLabel(slide, contest, Boolean(link));
    if (qr && link) buildQr(qr, link);
    else if (qr) qr.replaceChildren();

    const subtitle = slide.querySelector('.panel-subtitle');
    if (subtitle) subtitle.textContent = 'Concursos públicos';

    configurePanelImage(slide, contest, safeImageUrl);
    return slide;
  }

  function configurePanelImage(slide, contest, safeImageUrl) {
    const image = slide.querySelector('.event-image');
    const fallback = slide.querySelector('.image-fallback');
    const imageCandidates = [...new Set([
      safeImageUrl(contest.imagem),
      safeImageUrl(FALLBACK_IMAGE)
    ].filter(Boolean))];

    if (fallback) {
      const fallbackIcon = fallback.querySelector('.fallback-icon');
      const fallbackLabel = fallback.querySelector('.fallback-label');
      if (fallbackIcon) fallbackIcon.textContent = '🏛️';
      if (fallbackLabel) fallbackLabel.textContent = contest.titulo || 'Concurso público';
      fallback.hidden = false;
      fallback.style.display = imageCandidates.length ? 'none' : 'grid';
    }
    if (!image) return;

    let candidateIndex = 0;
    const showFallback = () => {
      image.classList.remove('loaded');
      image.style.display = 'none';
      image.removeAttribute('src');
      if (fallback) fallback.style.display = 'grid';
    };
    const loadNextImage = () => {
      const candidate = imageCandidates[candidateIndex++];
      if (!candidate) {
        showFallback();
        return;
      }
      image.style.display = '';
      image.src = candidate;
    };
    image.alt = `Imagem: ${contest.titulo || 'Concurso público'}`;
    image.decoding = 'async';
    image.loading = 'eager';
    image.classList.remove('loaded');
    image.onload = () => {
      image.classList.add('loaded');
      if (fallback) fallback.style.display = 'none';
    };
    image.onerror = loadNextImage;
    loadNextImage();
  }

  function createAgendaCard(contest, helpers) {
    const { safeExternalUrl, safeImageUrl } = helpers;
    const article = document.createElement('article');
    article.className = 'agenda-card agenda-contest-card';

    const link = safeExternalUrl(contest.url);
    const imageUrl = safeImageUrl(contest.imagem) || FALLBACK_IMAGE;
    const location = [contest.cidade, contest.uf].filter(Boolean).join(' · ');
    const formations = Array.isArray(contest.formacoes_compativeis)
      ? contest.formacoes_compativeis
      : [];
    const positions = (Array.isArray(contest.cargos_compativeis)
      ? contest.cargos_compativeis
      : []).slice(0, 5);

    article.innerHTML = `
      <div class="agenda-card-media contest-media">
        <img src="${escapeHtml(imageUrl)}" alt="Imagem de divulgação: ${escapeHtml(contest.titulo || 'Concurso público')}" loading="lazy" referrerpolicy="no-referrer">
      </div>
      <div class="agenda-card-body">
        <div class="agenda-card-badges contest-badges">
          <span>Concurso</span>
          <span class="contest-deadline-state">${escapeHtml(deadlineStateLabel(contest))}</span>
          ${formations.map(formation => `<span class="contest-formation-badge">${escapeHtml(formation)}</span>`).join('')}
        </div>
        <h2>${escapeHtml(contest.titulo || 'Concurso público')}</h2>
        ${location ? `<p class="agenda-card-place"><strong>Localidade:</strong> ${escapeHtml(location)}</p>` : ''}
        <p class="agenda-card-date"><strong>Inscrições:</strong> ${escapeHtml(contest.inscricoes_texto || 'consulte o edital')}</p>
        ${contest.remuneracao_faixa_texto ? `<p class="contest-remuneration"><strong>Faixa de remuneração do concurso:</strong> ${escapeHtml(contest.remuneracao_faixa_texto)}</p>` : ''}
        ${positions.length ? `<section class="contest-positions" aria-label="Cargos possivelmente compatíveis"><h3>Cargos possivelmente compatíveis</h3><ul>${positions.map(position => `<li>${escapeHtml(position.cargo || '')}${position.vagas_texto ? ` <span>— ${escapeHtml(position.vagas_texto)}</span>` : ''}</li>`).join('')}</ul></section>` : ''}
        <p class="contest-source">Fonte: ${escapeHtml(contest.fonte || 'PCI Concursos')} · seleção automática. Confirme requisitos, remuneração e vagas no edital.</p>
        <div class="agenda-card-actions">
          ${link ? `<a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">Ver concurso e edital ↗</a>` : ''}
        </div>
      </div>`;

    const image = article.querySelector('.contest-media img');
    if (image) {
      image.onerror = () => {
        if (image.dataset.fallbackApplied === '1') {
          image.remove();
          article.querySelector('.contest-media')?.classList.add('without-image');
          return;
        }
        image.dataset.fallbackApplied = '1';
        image.src = FALLBACK_IMAGE;
      };
    }

    return article;
  }

  const mural = window.MuralCultural || (window.MuralCultural = {});
  const contents = mural.contents || (mural.contents = {});
  contents.contests = Object.freeze({
    PANEL_CONTEST_LIMIT,
    FALLBACK_IMAGE,
    normalizeText,
    escapeHtml,
    isoDateFromLegacy,
    muralDateKey,
    deadlineWindow,
    deadlineState,
    deadlineStateLabel,
    isTemporallyVisible,
    isValid,
    publicRecord,
    filter,
    formationOptions,
    ufOptions,
    cityOptions,
    remunerationValues,
    remunerationMax,
    remunerationMatches,
    sampleForPanel,
    createPanelSlide,
    createAgendaCard
  });
})();
