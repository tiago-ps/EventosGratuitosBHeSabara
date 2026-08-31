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

  function filter(contests, filters = {}) {
    const query = normalizeText(filters.query);
    const formation = String(filters.formation || '');
    const uf = String(filters.uf || '');
    const deadline = String(filters.deadline || '');

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
        const hasDeadline = Boolean(contest.inscricoes_texto);

        if (formation && !formations.includes(formation)) return false;
        if (uf && contest.uf !== uf) return false;
        if (deadline === 'com-data' && !hasDeadline) return false;
        if (deadline === 'sem-data' && hasDeadline) return false;
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

  function sampleForPanel(contests, limit = PANEL_CONTEST_LIMIT, options = {}) {
    const available = (Array.isArray(contests) ? contests : [])
      .filter(isValid)
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
    buildSiteQr(slide);

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
    isValid,
    publicRecord,
    filter,
    formationOptions,
    ufOptions,
    sampleForPanel,
    createPanelSlide,
    createAgendaCard
  });
})();
