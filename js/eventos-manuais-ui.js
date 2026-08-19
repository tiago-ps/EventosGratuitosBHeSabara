(() => {
  'use strict';

  const DATA_URL = 'eventos.json';
  const BLOCKED_IFRAME_HOSTS = [
    'instagram.com',
    'facebook.com',
    'fb.com',
    'threads.net',
    'x.com',
    'twitter.com',
    'tiktok.com',
    'linkedin.com',
    'linktr.ee',
    'docs.google.com',
    'forms.gle',
    'sympla.com.br',
    'eventbrite.com',
    'youtube.com',
    'youtu.be',
    'portalbelohorizonte.com.br',
    'pbh.gov.br'
  ];

  let events = [];
  let updateQueued = false;

  function normalizeText(value = '') {
    return String(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function absoluteUrl(value) {
    if (!value) return '';

    try {
      return new URL(value, window.location.href).href;
    } catch {
      return '';
    }
  }

  function isRegistrationPeriod(event) {
    return normalizeText(event?.tipo_data) === 'inscricao';
  }

  function shouldAvoidIframe(value) {
    try {
      const hostname = new URL(value, window.location.href)
        .hostname
        .toLowerCase()
        .replace(/^www\./, '');

      return BLOCKED_IFRAME_HOSTS.some(host =>
        hostname === host || hostname.endsWith(`.${host}`)
      );
    } catch {
      return true;
    }
  }

  function parseCalendarDate(value) {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (!match) return null;

    const date = new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      12
    );

    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatDayMonth(value) {
    const date = parseCalendarDate(value);

    if (!date) return String(value || 'Data não informada');

    const day = date.getDate() === 1 ? '1º' : String(date.getDate());
    const month = new Intl.DateTimeFormat('pt-BR', {
      month: 'long'
    }).format(date);

    return `${day} de ${month}`;
  }

  function formatAgendaRange(event) {
    if (!event?.data_fim || event.data_fim === event.data) return '';

    const start = parseCalendarDate(event.data);
    const end = parseCalendarDate(event.data_fim);
    if (!start || !end) return '';

    const differentYears = start.getFullYear() !== end.getFullYear();
    const startOptions = {
      weekday: 'short',
      day: '2-digit',
      month: 'short'
    };
    if (differentYears) startOptions.year = 'numeric';

    const startLabel = new Intl.DateTimeFormat('pt-BR', startOptions)
      .format(start)
      .replace(',', '');
    const endLabel = new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(end);

    return `${startLabel} a ${endLabel}`;
  }

  function findCurrentEvent(slide) {
    const title = slide.querySelector('.event-title')?.textContent?.trim() || '';

    if (!title || !events.length) return null;

    let candidates = events.filter(event =>
      String(event?.titulo || '').trim() === title
    );

    if (!candidates.length) return null;

    const displayedLink = absoluteUrl(
      slide.querySelector('.source-url a')?.getAttribute('href') || ''
    );

    if (displayedLink) {
      const sameLink = candidates.filter(event =>
        absoluteUrl(event?.link || event?.pagina || '') === displayedLink
      );

      if (sameLink.length) candidates = sameLink;
    }

    const where = normalizeText(
      slide.querySelector('.where-text')?.textContent || ''
    );

    if (where && candidates.length > 1) {
      const samePlace = candidates.filter(event => {
        const expected = normalizeText(
          [event?.local, event?.cidade].filter(Boolean).join(' • ')
        );
        return expected === where;
      });

      if (samePlace.length) candidates = samePlace;
    }

    if (candidates.length === 1) return candidates[0];

    return candidates.find(isRegistrationPeriod) || candidates[0] || null;
  }

  function findAgendaCardEvent(card) {
    const title = card.querySelector('.agenda-card-body > h2')?.textContent?.trim() || '';
    if (!title || !events.length) return null;

    let candidates = events.filter(event =>
      String(event?.titulo || '').trim() === title
    );
    if (!candidates.length) return null;

    const place = normalizeText(
      card.querySelector('.agenda-card-place')?.textContent || ''
    );

    if (place && candidates.length > 1) {
      const samePlace = candidates.filter(event =>
        normalizeText([event?.local, event?.cidade].filter(Boolean).join(' • ')) === place
      );
      if (samePlace.length) candidates = samePlace;
    }

    return candidates[0] || null;
  }

  function applyAgendaBadgeStyle(badge, background, color = '#fff') {
    if (!badge) return;
    badge.style.background = background;
    badge.style.color = color;
    badge.style.border = '1px solid rgba(255,255,255,.14)';
  }

  function agendaCityBadgeData(cityValue) {
    const city = normalizeText(cityValue);
    if (city.includes('sabara')) {
      return { label: 'Sabará', background: 'var(--city-sabara)', color: 'var(--city-text)' };
    }
    if (city.includes('caete')) {
      return { label: 'Caeté', background: 'var(--city-caete)', color: 'var(--city-text)' };
    }
    if (city.includes('belo') || city === 'bh' || city.includes('belo horizonte')) {
      return { label: 'BH', background: 'var(--city-bh)', color: 'var(--city-text)' };
    }
    return null;
  }

  function styleAgendaBadges(card, event) {
    const badges = card.querySelector('.agenda-card-badges');
    if (!badges || !event) return;

    const items = [...badges.querySelectorAll(':scope > span')];
    const category = items[0];
    const free = items[1];
    const rating = items[2];

    applyAgendaBadgeStyle(category, 'var(--category)', 'var(--category-contrast)');
    applyAgendaBadgeStyle(free, 'var(--accent)', 'var(--accent-contrast)');

    if (rating) {
      const ratingValue = normalizeText(rating.textContent);
      let background = '#24292f';
      let color = '#fff';
      if (ratingValue.includes('livre')) background = '#238636';
      else if (ratingValue.includes('10')) background = '#2563a8';
      else if (ratingValue.includes('12')) {
        background = '#c58a08';
        color = '#111';
      } else if (ratingValue.includes('14')) background = '#d96d1f';
      else if (ratingValue.includes('16')) background = '#bd2c2c';
      else if (ratingValue.includes('18')) background = '#24292f';
      applyAgendaBadgeStyle(rating, background, color);
    }

    const cityData = agendaCityBadgeData(event.cidade);
    let cityBadge = badges.querySelector('.agenda-city-badge');

    if (!cityData) {
      cityBadge?.remove();
      return;
    }

    if (!cityBadge) {
      cityBadge = document.createElement('span');
      cityBadge.className = 'agenda-city-badge';
      badges.append(cityBadge);
    }

    cityBadge.textContent = cityData.label;
    applyAgendaBadgeStyle(cityBadge, cityData.background, cityData.color);
  }

  function enhanceAgendaCards() {
    document.querySelectorAll('#app .agenda-card:not(.agenda-book-card)').forEach(card => {
      const event = findAgendaCardEvent(card);
      if (!event) return;

      styleAgendaBadges(card, event);

      const range = formatAgendaRange(event);
      const date = card.querySelector('.agenda-card-date');
      if (!range || !date) return;

      const expected = `${range}${event.horario ? ` • ${event.horario}` : ''}`;
      if (date.textContent !== expected) date.textContent = expected;
    });
  }

  function appendDate(container, value) {
    const date = document.createElement('span');
    date.className = 'when-date';
    date.textContent = formatDayMonth(value);
    container.append(date);
  }

  function renderRegistrationPeriod(slide, event) {
    if (!isRegistrationPeriod(event)) return;

    const when = slide.querySelector('.when');
    const card = when?.closest('.details > div');
    const heading = card?.querySelector('dt');

    if (!when || !heading) return;

    heading.textContent = 'Inscrições';
    card.classList.add('registration-period-card');
    when.classList.add('when-registration');
    when.replaceChildren();

    const registration = document.createElement('span');
    registration.className = 'registration-period';
    appendDate(registration, event.data);

    if (event.data_fim && event.data_fim !== event.data) {
      registration.append(document.createTextNode(' a '));
      appendDate(registration, event.data_fim);
    }

    when.append(registration);

    if (event.periodo_atividade || event.horario) {
      const activity = document.createElement('span');
      activity.className = 'activity-period';

      const firstLine = document.createElement('span');
      firstLine.className = 'activity-period-line';

      const label = document.createElement('span');
      label.className = 'activity-period-label';
      label.textContent = 'Atividade';
      firstLine.append(label);

      if (event.periodo_atividade) {
        const period = document.createElement('span');
        period.className = 'activity-period-value';
        period.textContent = event.periodo_atividade;
        firstLine.append(document.createTextNode(' '), period);
      }

      activity.append(firstLine);

      if (event.horario) {
        const schedule = document.createElement('span');
        schedule.className = 'activity-period-schedule';
        schedule.textContent = event.horario;
        activity.append(schedule);
      }

      when.append(activity);
    }
  }

  function showCategoryFallback(slide, iframe) {
    const media = slide.querySelector('.media');
    const image = slide.querySelector('.event-image');
    const fallback = slide.querySelector('.image-fallback');
    const overlay = slide.querySelector('.media-overlay');

    iframe?.remove();
    media?.querySelectorAll('iframe.event-page').forEach(item => item.remove());

    if (image) {
      image.removeAttribute('src');
      image.style.display = 'none';
    }

    if (fallback) fallback.style.display = 'grid';
    if (overlay) overlay.style.display = '';
  }

  function replaceBlockedIframes(slide) {
    slide.querySelectorAll('iframe.event-page').forEach(iframe => {
      if (shouldAvoidIframe(iframe.getAttribute('src') || '')) {
        showCategoryFallback(slide, iframe);
      }
    });
  }

  function enhanceCurrentSlide() {
    updateQueued = false;

    const slide = document.querySelector('#app .slide');
    if (slide) {
      replaceBlockedIframes(slide);

      const event = findCurrentEvent(slide);
      if (event) renderRegistrationPeriod(slide, event);
    }

    enhanceAgendaCards();
  }

  function queueEnhancement() {
    if (updateQueued) return;
    updateQueued = true;
    window.requestAnimationFrame(enhanceCurrentSlide);
  }

  async function loadEvents() {
    try {
      const response = await fetch(`${DATA_URL}?ui=${Date.now()}`, {
        cache: 'no-store'
      });

      if (!response.ok) return;

      const data = await response.json();
      events = Array.isArray(data?.eventos) ? data.eventos : [];
      queueEnhancement();
    } catch (error) {
      console.warn('Não foi possível carregar os aprimoramentos de exibição.', error);
    }
  }

  const app = document.getElementById('app');

  if (app) {
    const observer = new MutationObserver(queueEnhancement);
    observer.observe(app, { childList: true, subtree: true });
  }

  loadEvents();
  queueEnhancement();
})();
