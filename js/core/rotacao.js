(() => {
  'use strict';

  function interleaveContents(groups) {
    const active = groups
      .map(group => ({
        items: group.items || [],
        weight: Math.max(1, Number(group.weight) || 1),
        index: 0
      }))
      .filter(group => group.items.length);

    if (!active.length) return [];

    const combined = [];
    while (active.some(group => group.index < group.items.length)) {
      for (const group of active) {
        for (
          let i = 0;
          i < group.weight && group.index < group.items.length;
          i += 1
        ) {
          combined.push(group.items[group.index++]);
        }
      }
    }

    return combined;
  }

  function panelItemKey(item) {
    return `${item?.tipo_conteudo || ''}:${item?.id || item?.id_fonte || item?.url || item?.titulo || ''}`;
  }

  function sameSample(first, second) {
    if (!Array.isArray(first) || !Array.isArray(second) || first.length !== second.length) return false;
    const firstKeys = new Set(first.map(panelItemKey));
    const secondKeys = new Set(second.map(panelItemKey));
    return firstKeys.size === secondKeys.size && [...firstKeys].every(key => secondKeys.has(key));
  }

  function sampleForPanel(items, limit, options = {}) {
    const available = [...new Map((Array.isArray(items) ? items : [])
      .map(item => [panelItemKey(item), item])).values()];
    const maximum = Math.max(0, Number(limit) || 0);
    if (!maximum) return [];

    // Fisher-Yates também renova a ordem quando todo o catálogo cabe na amostra.
    const sample = available.slice();
    for (let i = 0; i < sample.length; i += 1) {
      const j = i + Math.floor(Math.random() * (sample.length - i));
      [sample[i], sample[j]] = [sample[j], sample[i]];
    }
    const exposure = options.exposure || new Map();
    const recency = new Map([...exposure.keys()].map((key, index) => [key, index + 1]));
    sample.sort((a, b) => (recency.get(panelItemKey(a)) || 0) - (recency.get(panelItemKey(b)) || 0));
    const selected = sample.slice(0, maximum);
    const previousItems = Array.isArray(options.previousItems) ? options.previousItems : [];

    // Uma nova rodada não repete a amostra anterior quando há itens de sobra.
    if (previousItems.length === maximum && sameSample(selected, previousItems)) {
      const previousKeys = new Set(previousItems.map(panelItemKey));
      const replacement = sample.find(item => !previousKeys.has(panelItemKey(item)));
      if (replacement) selected[selected.length - 1] = replacement;
    }

    return selected;
  }

  function createPanelMemory() {
    return { exposure: new Map(), curations: new Map(), pendingCurations: [] };
  }

  function recordPanelExposure(memory, step) {
    if (!step?.item) return;
    const key = panelItemKey(step.item);
    memory.exposure.delete(key);
    memory.exposure.set(key, true);
    // Preferência recente limitada à sessão, nunca um veto à publicação.
    if (memory.exposure.size > 100) memory.exposure.delete(memory.exposure.keys().next().value);
    if (step.curationId) {
      if (step.resetCycle || !memory.curations.has(step.curationId)) {
        memory.curations.set(step.curationId, new Set());
      }
      memory.curations.get(step.curationId).add(key);
      if (step.pendingCurations) memory.pendingCurations = [...step.pendingCurations];
    }
  }

  function createPanelSequence(events, groups, curations, session) {
    // Simula a passagem para escolher os próximos itens sem registrar exibição real.
    const memory = {
      exposure: new Map(session.exposure),
      curations: new Map([...session.curations].map(([id, seen]) => [id, new Set(seen)])),
      pendingCurations: [...session.pendingCurations]
    };
    const shuffle = items => sampleForPanel(items, items.length);
    const general = shuffle(groups.filter(group => group.items.length).map(group => ({
      id: group.id, items: [...group.items]
    })));
    const active = new Map(curations.filter(curation => curation.items.length).map(curation => [curation.id, curation]));
    memory.pendingCurations = memory.pendingCurations.filter(id => active.has(id));
    const steps = [];
    const append = step => {
      steps.push(step);
      recordPanelExposure(memory, step);
    };
    const orderedEvents = events;
    // Com Eventos, a rodada termina ao consumir a fila temporal: os próximos
    // entremeios virão na próxima rodada, sem uma longa cauda sem Eventos.
    const blocks = orderedEvents.length ? Math.ceil(orderedEvents.length / 5) : Math.max(
      general.reduce((total, group) => total + group.items.length, 0), active.size);
    let groupIndex = 0;
    for (let block = 0; block < blocks; block += 1) {
      orderedEvents.slice(block * 5, block * 5 + 5).forEach(item => append({ item }));
      if (general.length && general.every(group => !group.items.length)) {
        general.forEach(group => { group.items = [...groups.find(source => source.id === group.id).items]; });
      }
      const availableGroups = general.filter(group => group.items.length);
      if (availableGroups.length) {
        // Percorre os módulos na ordem sorteada, saltando os já esgotados.
        while (!general[groupIndex % general.length].items.length) groupIndex += 1;
        const group = general[groupIndex++ % general.length];
        const [item] = sampleForPanel(group.items, 1, { exposure: memory.exposure });
        group.items = group.items.filter(candidate => panelItemKey(candidate) !== panelItemKey(item));
        append({ item });
      }
      if (!active.size) continue;
      if (!memory.pendingCurations.length) {
        memory.pendingCurations = shuffle([...active.values()]).map(curation => curation.id);
      }
      const curationId = memory.pendingCurations.shift();
      const curation = active.get(curationId);
      const seen = memory.curations.get(curationId) || new Set();
      let remaining = curation.items.filter(item => !seen.has(panelItemKey(item)));
      const resetCycle = !remaining.length;
      if (resetCycle) remaining = curation.items;
      const selected = sampleForPanel(remaining, 3, { exposure: memory.exposure });
      selected.forEach((item, index) => append({
        item, curationId, resetCycle: resetCycle && index === 0,
        pendingCurations: [...memory.pendingCurations]
      }));
    }
    return steps;
  }

  const mural = window.MuralCultural || (window.MuralCultural = {});
  mural.core = Object.freeze({
    interleaveContents,
    sampleForPanel,
    sameSample,
    createPanelMemory,
    recordPanelExposure,
    createPanelSequence
  });
})();
