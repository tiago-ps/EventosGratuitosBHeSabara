(() => {
  'use strict';

  const root = typeof globalThis !== 'undefined'
    ? globalThis
    : (typeof self !== 'undefined' ? self : window);
  const mural = root.MuralCultural || (root.MuralCultural = {});

  const CLASSES = new Set(['pontual', 'periodo', 'recorrente', 'permanente', 'atemporal']);
  const CLOSED_STATUSES = new Set([
    'encerrada', 'encerrada provavel', 'encerrada provável',
    'esgotado', 'indisponivel', 'indisponível'
  ]);

  function normalize(value = '') {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replaceAll('_', ' ');
  }

  function isoDate(value = '') {
    const match = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return '';
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day, 12);
    if (
      Number.isNaN(date.getTime()) ||
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) return '';
    return `${match[1]}-${match[2]}-${match[3]}`;
  }

  function dateFromIso(value, endOfDay = false) {
    const key = isoDate(value);
    if (!key) return null;
    const [year, month, day] = key.split('-').map(Number);
    return new Date(
      year,
      month - 1,
      day,
      endOfDay ? 23 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 999 : 0
    );
  }

  function saoPauloDateKey(value = new Date()) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).formatToParts(date);
      const fields = Object.fromEntries(parts.map(part => [part.type, part.value]));
      if (fields.year && fields.month && fields.day) {
        return `${fields.year}-${fields.month}-${fields.day}`;
      }
    } catch {
      // Fallback local para navegadores muito antigos.
    }
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0')
    ].join('-');
  }

  function temporalClass(event) {
    const canonical = String(event?.temporalidade?.classe || '').trim();
    if (CLASSES.has(canonical)) return canonical;
    const start = isoDate(event?.data || event?.data_inicio);
    const end = isoDate(event?.data_fim);
    if (start && end && end !== start) return 'periodo';
    if (start) return 'pontual';
    return '';
  }

  function realization(event) {
    const temporal = event?.temporalidade;
    const className = temporalClass(event);
    if (temporal && typeof temporal === 'object') {
      const canonical = temporal.realizacao;
      if (canonical && typeof canonical === 'object') {
        const start = isoDate(canonical.inicio);
        const end = isoDate(canonical.fim) || (className === 'pontual' ? start : '');
        return {
          classe: className,
          inicio: start,
          fim: end,
          observacao: String(canonical.observacao || '').trim(),
          canonica: true
        };
      }
      if (className === 'permanente' || className === 'atemporal') {
        return {
          classe: className,
          inicio: '',
          fim: '',
          observacao: '',
          canonica: true
        };
      }
    }

    const start = isoDate(event?.data || event?.data_inicio);
    const explicitEnd = isoDate(event?.data_fim);
    return {
      classe: className,
      inicio: start,
      fim: explicitEnd || start,
      observacao: String(event?.horario || '').trim(),
      canonica: false
    };
  }

  function participation(event, type) {
    const wanted = String(type || '').trim();
    const list = event?.temporalidade?.participacao;
    if (Array.isArray(list)) {
      const canonical = list.find(item =>
        item && typeof item === 'object' && String(item.tipo || '').trim() === wanted
      );
      if (canonical) {
        return {
          tipo: wanted,
          inicio: isoDate(canonical.inicio),
          fim: isoDate(canonical.fim),
          status: String(canonical.status || '').trim(),
          observacao: String(canonical.observacao || '').trim(),
          canonica: true
        };
      }
    }

    if (!['inscricao', 'acesso'].includes(wanted)) return null;
    const prefix = wanted === 'inscricao' ? 'inscricao' : 'acesso';
    const start = isoDate(event?.[`${prefix}_inicio`]);
    const end = isoDate(event?.[`${prefix}_fim`]);
    const status = String(event?.[`status_${prefix}`] || '').trim();
    const observation = String(event?.[prefix] || '').trim();
    if (!(start || end || status || observation)) return null;
    return {
      tipo: wanted,
      inicio: start,
      fim: end,
      status,
      observacao: observation,
      canonica: false
    };
  }

  function displayCriterion(event) {
    const value = normalize(event?.criterio_exibicao);
    return ['inscricao', 'acesso', 'manual', 'realizacao'].includes(value)
      ? value
      : 'realizacao';
  }

  function isClosedStatus(value) {
    return CLOSED_STATUSES.has(normalize(value));
  }

  function isPermanent(event) {
    return ['permanente', 'atemporal'].includes(temporalClass(event));
  }

  function isPublishable(event, reference = new Date()) {
    if (!event || event.exibicao_ativa === false) return false;
    if (event?.temporalidade?.exibicao?.ativa === false) return false;

    const criterion = displayCriterion(event);
    if (criterion === 'manual') return true;

    if (criterion === 'inscricao' || criterion === 'acesso') {
      const window = participation(event, criterion);
      if (window) {
        if (isClosedStatus(window.status)) return false;
        const today = saoPauloDateKey(reference);
        if (window.fim && today && window.fim < today) return false;
        return true;
      }
    }

    if (isPermanent(event)) return true;
    const window = realization(event);
    const today = saoPauloDateKey(reference);
    if (!window.inicio && !window.fim) return false;
    return !window.fim || !today || window.fim >= today;
  }

  function sortKey(event) {
    const criterion = displayCriterion(event);
    const realizationWindow = realization(event);
    const realizationTime = dateFromIso(realizationWindow.inicio)?.getTime()
      ?? Number.MAX_SAFE_INTEGER;

    if (criterion === 'inscricao' || criterion === 'acesso') {
      const window = participation(event, criterion);
      const deadline = dateFromIso(window?.fim)?.getTime();
      return [
        deadline ? 0 : 1,
        deadline ?? realizationTime,
        realizationTime
      ];
    }

    return [2, realizationTime, realizationTime];
  }

  function intersectsPeriod(event, rangeStart, rangeEnd) {
    if (!(rangeStart instanceof Date) || !(rangeEnd instanceof Date)) return false;
    const criterion = displayCriterion(event);

    if (criterion === 'inscricao' || criterion === 'acesso') {
      const window = participation(event, criterion);
      const realizationWindow = realization(event);
      const start = dateFromIso(window?.inicio || realizationWindow.inicio);
      const end = window?.fim
        ? dateFromIso(window.fim, true)
        : new Date(9999, 11, 31, 23, 59, 59, 999);
      if (!start || !end) return false;
      return start <= rangeEnd && end >= rangeStart;
    }

    if (isPermanent(event)) return false;
    const window = realization(event);
    const start = dateFromIso(window.inicio);
    const end = dateFromIso(window.fim || window.inicio, true);
    if (!start || !end) return false;
    return start <= rangeEnd && end >= rangeStart;
  }

  function isCurrent(event, reference = new Date()) {
    if (isPermanent(event)) return true;
    const window = realization(event);
    const today = saoPauloDateKey(reference);
    return !window.fim || !today || window.fim >= today;
  }

  function reminderBaseDate(event) {
    if (isPermanent(event)) return '';
    return realization(event).inicio;
  }

  mural.eventTemporal = Object.freeze({
    CLOSED_STATUSES,
    normalize,
    isoDate,
    dateFromIso,
    saoPauloDateKey,
    temporalClass,
    realization,
    participation,
    displayCriterion,
    isClosedStatus,
    isPermanent,
    isPublishable,
    sortKey,
    intersectsPeriod,
    isCurrent,
    reminderBaseDate
  });
})();
