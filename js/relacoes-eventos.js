(() => {
  'use strict';

  const text = value => String(value || '').trim();

  function buildIndex(payload) {
    const index = new Map();
    if (!payload || payload.versao !== 1 || !Array.isArray(payload.relacoes)) {
      return index;
    }

    for (const raw of payload.relacoes) {
      if (!raw || typeof raw !== 'object') continue;
      const eventId = text(raw.evento_id);
      const type = text(raw.tipo);
      const destination = raw.destino;
      if (
        !eventId ||
        !['organizado_por', 'acontece_em'].includes(type) ||
        !destination ||
        typeof destination !== 'object'
      ) {
        continue;
      }
      const destinationType = text(destination.tipo);
      const destinationId = text(destination.id);
      const destinationName = text(destination.nome);
      if (!destinationType || !destinationId || !destinationName) continue;

      const item = {
        tipo: type,
        destino: {
          tipo: destinationType,
          id: destinationId,
          nome: destinationName
        }
      };

      if (raw.equipamento && typeof raw.equipamento === 'object') {
        const equipmentId = text(raw.equipamento.id);
        const equipmentName = text(raw.equipamento.nome);
        if (equipmentId && equipmentName) {
          item.equipamento = { id: equipmentId, nome: equipmentName };
        }
      }

      if (!index.has(eventId)) index.set(eventId, []);
      index.get(eventId).push(item);
    }

    for (const relations of index.values()) {
      relations.sort((a, b) =>
        a.tipo.localeCompare(b.tipo, 'pt-BR') ||
        a.destino.tipo.localeCompare(b.destino.tipo, 'pt-BR') ||
        a.destino.nome.localeCompare(b.destino.nome, 'pt-BR') ||
        a.destino.id.localeCompare(b.destino.id, 'pt-BR')
      );
    }
    return index;
  }

  function forEvent(index, event) {
    if (!(index instanceof Map)) return [];
    const eventId = text(event?.id);
    return eventId ? (index.get(eventId) || []) : [];
  }

  function organizerName(index, event) {
    const relation = forEvent(index, event).find(item =>
      item.tipo === 'organizado_por' &&
      item.destino.tipo === 'instituicao' &&
      text(item.destino.nome)
    );
    return relation ? text(relation.destino.nome) : '';
  }

  function location(index, event) {
    const relations = forEvent(index, event).filter(item => item.tipo === 'acontece_em');
    const internal = relations.find(item => item.destino.tipo === 'espaco_interno');
    if (internal) {
      return {
        tipo: 'espaco_interno',
        id: internal.destino.id,
        nome: internal.destino.nome,
        equipamento: internal.equipamento || null
      };
    }
    const equipment = relations.find(item => item.destino.tipo === 'equipamento_cultural');
    return equipment
      ? { tipo: 'equipamento_cultural', id: equipment.destino.id, nome: equipment.destino.nome, equipamento: null }
      : null;
  }

  window.MuralCultural = window.MuralCultural || {};
  window.MuralCultural.eventRelations = Object.freeze({
    buildIndex,
    forEvent,
    organizerName,
    location
  });
})();
