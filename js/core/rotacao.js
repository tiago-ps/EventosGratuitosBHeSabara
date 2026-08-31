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
    return String(item?.url || item?.id || item?.titulo || '');
  }

  function sameSample(first, second) {
    if (!Array.isArray(first) || !Array.isArray(second) || first.length !== second.length) return false;
    const firstKeys = new Set(first.map(panelItemKey));
    const secondKeys = new Set(second.map(panelItemKey));
    return firstKeys.size === secondKeys.size && [...firstKeys].every(key => secondKeys.has(key));
  }

  function sampleForPanel(items, limit, options = {}) {
    const available = Array.isArray(items) ? items : [];
    const maximum = Math.max(0, Number(limit) || 0);
    if (available.length <= maximum) return available.slice();

    // Embaralhamento parcial de Fisher-Yates: somente os itens necessários
    // para a programação do Painel consomem posições aleatórias.
    const sample = available.slice();
    for (let i = 0; i < maximum; i += 1) {
      const j = i + Math.floor(Math.random() * (sample.length - i));
      [sample[i], sample[j]] = [sample[j], sample[i]];
    }
    const selected = sample.slice(0, maximum);
    const previousItems = Array.isArray(options.previousItems) ? options.previousItems : [];

    // Uma nova rodada não repete a amostra anterior quando há itens de sobra.
    if (previousItems.length === maximum && sameSample(selected, previousItems)) {
      const previousKeys = new Set(previousItems.map(panelItemKey));
      const replacement = available.find(item => !previousKeys.has(panelItemKey(item)));
      if (replacement) selected[selected.length - 1] = replacement;
    }

    return selected;
  }

  const mural = window.MuralCultural || (window.MuralCultural = {});
  mural.core = Object.freeze({
    interleaveContents,
    sampleForPanel,
    sameSample
  });
})();
