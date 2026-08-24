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

  function sampleForPanel(items, limit) {
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
    return sample.slice(0, maximum);
  }

  const mural = window.MuralCultural || (window.MuralCultural = {});
  mural.core = Object.freeze({
    interleaveContents,
    sampleForPanel
  });
})();
