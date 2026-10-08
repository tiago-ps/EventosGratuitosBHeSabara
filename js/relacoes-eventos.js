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

  /** Imagens canônicas dos espaços e de seus equipamentos pais. */
  function buildSpaceImageIndex(documento) {
    const byId = Object.create(null);
    const byName = Object.create(null);
    const itens = Array.isArray(documento?.itens) ? documento.itens : [];
    for (const item of itens) {
      const id = text(item?.id);
      if (!id) continue;
      byId[id] = {
        imagem: text(item?.imagem),
        equipamentoId: text(item?.equipamento_id)
      };
      const nome = normalize(item?.nome || item?.titulo);
      if (nome.length >= 12) {
        if (Object.prototype.hasOwnProperty.call(byName, nome)) {
          byName[nome] = '';
        } else {
          byName[nome] = id;
        }
      }
    }
    return { byId, byName };
  }

  function imageForEvent(event, relationIndex, spaceImageIndex) {
    if (!spaceImageIndex?.byId) return '';
    const { byId, byName } = spaceImageIndex;
    const imageForId = id => {
      const place = byId[text(id)];
      if (!place) return '';
      return place.imagem || text(byId[place.equipamentoId]?.imagem);
    };
    // Relações editoriais têm precedência sobre o local_id legado.
    const relations = bucketFor(event, relationIndex)?.acontece_em || [];
    for (const item of relations) {
      const image = imageForId(item.destino?.id) ||
        imageForId(item.equipamento?.id);
      if (image) return image;
    }
    for (const id of [event?.espaco_id, event?.local_id, event?.equipamento_id]) {
      const image = imageForId(id);
      if (image) return image;
    }
    // O campo local pode vir sem ID. Evitar correspondências de salas
    // genéricas e nunca usar o organizador como se fosse o local real.
    const local = normalize(event?.local);
    if (local && byName) {
      const direct = imageForId(byName[local]);
      if (direct) return direct;
      const names = Object.keys(byName).filter(name =>
        name.length >= 17 && byName[name] && local.includes(name)
      ).sort((a, b) => b.length - a.length);
      for (const name of names) {
        const image = imageForId(byName[name]);
        if (image) return image;
      }
    }
    return '';
  }

  root.eventRelations = Object.freeze({
    buildIndex,
    institutionName,
    placeParts,
    placeLabel,
    buildSpaceImageIndex,
    imageForEvent
  });
})();
