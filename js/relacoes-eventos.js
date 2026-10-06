(() => {
  'use strict';

  const host = typeof window !== 'undefined' ? window : globalThis;
  const root = host.MuralCultural = host.MuralCultural || {};

  function text(value) {
    return String(value == null ? '' : value).trim();
  }

  function normalize(value) {
    return text(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  function buildIndex(documento) {
    const index = Object.create(null);
    const relacoes = Array.isArray(documento?.relacoes) ? documento.relacoes : [];

    for (const relacao of relacoes) {
      const eventoId = text(relacao?.evento_id);
      const tipo = text(relacao?.tipo);
      const destinoTipo = text(relacao?.destino?.tipo);
      const destinoId = text(relacao?.destino?.id);
      const destinoNome = text(relacao?.destino?.nome);
      if (!eventoId || !tipo || !destinoTipo || !destinoId || !destinoNome) continue;

      const item = {
        tipo,
        destino: { tipo: destinoTipo, id: destinoId, nome: destinoNome }
      };
      const equipamentoId = text(relacao?.equipamento?.id);
      const equipamentoNome = text(relacao?.equipamento?.nome);
      if (equipamentoId && equipamentoNome) {
        item.equipamento = { id: equipamentoId, nome: equipamentoNome };
      }

      const bucket = index[eventoId] || (index[eventoId] = {
        acontece_em: [],
        organizado_por: []
      });

      if (
        tipo === 'acontece_em' &&
        ['equipamento_cultural', 'espaco_interno'].includes(destinoTipo)
      ) {
        bucket.acontece_em.push(item);
      } else if (tipo === 'organizado_por' && destinoTipo === 'instituicao') {
        bucket.organizado_por.push(item);
      }
    }

    for (const bucket of Object.values(index)) {
      bucket.acontece_em.sort((a, b) => {
        const prioridadeA = a.destino.tipo === 'espaco_interno' ? 0 : 1;
        const prioridadeB = b.destino.tipo === 'espaco_interno' ? 0 : 1;
        return prioridadeA - prioridadeB ||
          a.destino.nome.localeCompare(b.destino.nome, 'pt-BR');
      });
      bucket.organizado_por.sort((a, b) =>
        a.destino.nome.localeCompare(b.destino.nome, 'pt-BR')
      );
    }

    return index;
  }

  function bucketFor(event, index) {
    const id = text(event?.id);
    return id && index && typeof index === 'object' ? index[id] : null;
  }

  function institutionName(event, index) {
    const relation = bucketFor(event, index)?.organizado_por?.[0];
    return text(relation?.destino?.nome);
  }

  function placeParts(event, index) {
    const relation = bucketFor(event, index)?.acontece_em?.[0];
    if (!relation) return [];

    const parts = [];
    if (relation.destino?.tipo === 'espaco_interno') {
      const equipamento = text(relation.equipamento?.nome);
      if (equipamento) parts.push(equipamento);
    }

    const destino = text(relation.destino?.nome);
    if (destino && !parts.some(value => normalize(value) === normalize(destino))) {
      parts.push(destino);
    }
    return parts;
  }

  function placeLabel(event, index) {
    return placeParts(event, index).join(' — ');
  }

  root.eventRelations = Object.freeze({
    buildIndex,
    institutionName,
    placeParts,
    placeLabel
  });
})();
