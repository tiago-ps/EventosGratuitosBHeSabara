(() => {
  'use strict';

  const root = window.MuralCultural = window.MuralCultural || {};
  root.contents = root.contents || {};

  const text = value => String(value || '').trim();
  const accessLabel = platform => text(platform?.rotulo_acesso) || ({
    gratuito_sem_cadastro: 'Gratuito sem cadastro',
    gratuito_com_cadastro: 'Gratuito com cadastro',
    gratuito_com_cadastro_govbr: 'Gratuito com conta gov.br',
    gratuito_com_cadastro_educador: 'Gratuito para educadores com cadastro',
    gratuito_com_cadastro_institucional: 'Gratuito com cadastro institucional',
    gratuito_mediante_solicitacao: 'Gratuito mediante solicitação',
    misto_gratuito_e_locacao: 'Gratuito e aluguel',
    acesso_pago_ou_misto_a_confirmar: 'Condição de acesso a confirmar'
  }[text(platform?.tipo_acesso)] || 'Consulte as condições de acesso');

  function filter(platforms, filters = {}, normalizeText = value => text(value).toLowerCase()) {
    const query = normalizeText(filters.query || '');
    return (Array.isArray(platforms) ? platforms : []).filter(platform => {
      if (platform.exibicao_ativa === false && filters.includeInactive !== true) return false;
      if (filters.access && text(platform.tipo_acesso) !== text(filters.access)) return false;
      if (filters.category && text(platform.categoria) !== text(filters.category)) return false;
      if (!query) return true;
      return normalizeText([
        platform.nome, platform.descricao, platform.organizacao,
        platform.categoria, accessLabel(platform), platform.observacao_acesso
      ].join(' ')).includes(query);
    }).sort((a, b) => text(a.nome).localeCompare(text(b.nome), 'pt-BR'));
  }

  function createAgendaCard(platform, helpers = {}) {
    const { safeExternalUrl, safeImageUrl } = helpers;
    const article = document.createElement('article');
    article.className = 'agenda-card agenda-platform-card';

    const media = document.createElement('div');
    media.className = 'agenda-card-media agenda-platform-media';
    const imageUrl = safeImageUrl?.(platform.imagem);
    if (imageUrl) {
      const image = document.createElement('img');
      image.src = imageUrl;
      image.alt = '';
      image.loading = 'lazy';
      media.append(image);
    } else {
      const fallback = document.createElement('div');
      fallback.className = 'agenda-platform-placeholder';
      fallback.setAttribute('aria-hidden', 'true');
      fallback.textContent = '🎬';
      media.append(fallback);
    }

    const body = document.createElement('div');
    body.className = 'agenda-card-body agenda-platform-body';
    const eyebrow = document.createElement('p');
    eyebrow.className = 'agenda-platform-eyebrow';
    eyebrow.textContent = 'PLATAFORMA AUDIOVISUAL';
    const title = document.createElement('h3');
    title.className = 'agenda-card-title';
    title.textContent = text(platform.nome) || 'Plataforma audiovisual';
    const description = document.createElement('p');
    description.className = 'agenda-card-description';
    description.textContent = text(platform.descricao);
    const access = document.createElement('p');
    access.className = 'agenda-platform-access';
    access.textContent = accessLabel(platform);
    body.append(eyebrow, title, description, access);

    if (text(platform.observacao_acesso)) {
      const note = document.createElement('p');
      note.className = 'agenda-platform-note';
      note.textContent = text(platform.observacao_acesso);
      body.append(note);
    }

    const url = safeExternalUrl?.(platform.site);
    if (url) {
      const link = document.createElement('a');
      link.className = 'agenda-card-link';
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'Acessar site oficial';
      body.append(link);
    }

    article.append(media, body);
    return article;
  }

  function createPanelSlide({ movie: platform, index, total, template, helpers }) {
    const {
      buildSiteQr, slideDurationFor, configureItemQrLabel, buildQr,
      safeExternalUrl, safeImageUrl
    } = helpers;
    const slide = template.content.firstElementChild.cloneNode(true);
    buildSiteQr(slide, platform);
    slide.classList.add('platform-slide');

    slide.style.setProperty('--slide-seconds', `${slideDurationFor(platform)}s`);
    slide.querySelector('.counter').textContent = `${index + 1} de ${total}`;

    const eventCopy = slide.querySelector('.event-copy');
    const bookCopy = slide.querySelector('.book-copy');
    if (bookCopy) bookCopy.hidden = true;
    if (eventCopy) eventCopy.hidden = false;

    const category = slide.querySelector('.category');
    if (category) {
      category.hidden = false;
      category.textContent = 'PLATAFORMA';
    }
    const free = slide.querySelector('.free');
    if (free) {
      const isFree = text(platform.tipo_acesso).startsWith('gratuito_');
      free.hidden = !isFree;
      free.textContent = 'ACESSO GRATUITO';
    }

    const rating = slide.querySelector('.badge.rating');
    if (rating) rating.hidden = true;
    const platformBadge = slide.querySelector('.badge.city');
    if (platformBadge) {
      platformBadge.hidden = false;
      platformBadge.className = 'badge film-platform';
      platformBadge.textContent = accessLabel(platform);
      platformBadge.removeAttribute('style');
    }

    const title = slide.querySelector('.event-title');
    if (title) title.textContent = text(platform.nome) || 'Plataforma audiovisual';
    const description = slide.querySelector('.description');
    if (description) description.textContent = text(platform.descricao);

    const when = slide.querySelector('.when');
    if (when) {
      const label = when.closest('div')?.querySelector('dt');
      if (label) label.textContent = 'Acesso';
      when.textContent = accessLabel(platform);
    }
    const where = slide.querySelector('.where-text');
    if (where) {
      const label = where.closest('div')?.querySelector('dt');
      if (label) label.textContent = 'Categoria';
      where.textContent = text(platform.categoria).replaceAll('_', ' ') || 'Audiovisual';
    }
    slide.querySelector('.map-link')?.remove();

    const link = safeExternalUrl(platform.site);
    const sourceLabel = slide.querySelector('.source-label');
    if (sourceLabel) sourceLabel.textContent = 'Acesse a plataforma pelo site oficial';
    const source = slide.querySelector('.source-url');
    if (source) {
      if (link) {
        const anchor = document.createElement('a');
        anchor.href = link;
        anchor.textContent = 'Acessar site oficial';
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        source.replaceChildren(anchor);
      } else {
        source.textContent = 'Endereço oficial não confirmado.';
      }
    }
    const updated = slide.querySelector('.updated');
    if (updated) updated.textContent = text(platform.organizacao);

    const qr = slide.querySelector('.qr-code');
    configureItemQrLabel(slide, platform, Boolean(link));
    if (qr && link) buildQr(qr, link);

    const subtitle = slide.querySelector('.panel-subtitle');
    if (subtitle) subtitle.textContent = 'Plataformas Audiovisuais';

    const imageUrl = safeImageUrl(platform.imagem);
    const image = slide.querySelector('.event-image');
    const fallback = slide.querySelector('.image-fallback');
    const fallbackIcon = slide.querySelector('.fallback-icon');
    const fallbackLabel = slide.querySelector('.fallback-label');
    if (fallbackIcon) fallbackIcon.textContent = '🎬';
    if (fallbackLabel) fallbackLabel.textContent = text(platform.nome);
    if (image) {
      image.hidden = !imageUrl;
      image.alt = imageUrl ? text(platform.nome) : '';
      if (imageUrl) image.src = imageUrl;
    }
    if (fallback) fallback.hidden = Boolean(imageUrl);

    const progress = slide.querySelector('.progress span');
    if (progress) progress.style.animationDuration = `${slideDurationFor(platform)}s`;
    return slide;
  }

  root.contents.platforms = Object.freeze({ accessLabel, filter, createAgendaCard, createPanelSlide });
})();
