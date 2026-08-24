(() => {
  'use strict';

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
    FALLBACK_IMAGE,
    normalizeText,
    escapeHtml,
    isValid,
    publicRecord,
    filter,
    formationOptions,
    ufOptions,
    createAgendaCard
  });
})();
