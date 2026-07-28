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

  function formatDayMonth(value) {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (!match) return String(value || 'Data não informada');

    const date = new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      12
    );

    if (Number.isNaN(date.getTime())) {
      return String(value || 'Data não informada');
    }

    const day = date.getDate() === 1 ? '1º' : String(date.getDate());
    const month = new Intl.DateTimeFormat('pt-BR', {
      month: 'long'
    }).format(date);

    return `${day} de ${month}`;
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
    if (!slide) return;

    replaceBlockedIframes(slide);

    const event = findCurrentEvent(slide);
    if (event) renderRegistrationPeriod(slide, event);
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
