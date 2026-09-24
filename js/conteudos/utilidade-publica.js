(() => {
  'use strict';

  const root = window.MuralCultural = window.MuralCultural || {};
  root.contents = root.contents || {};

  function text(value) {
    return String(value == null ? '' : value).trim();
  }

  function appendText(parent, tag, value, className) {
    const content = text(value);
    if (!content) return null;
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = content;
    parent.appendChild(element);
    return element;
  }

  function pathValue(source, path) {
    const parts = text(path).split('.').filter(Boolean);
    let current = source;
    for (const part of parts) {
      if (!current || typeof current !== 'object' || !Object.prototype.hasOwnProperty.call(current, part)) return undefined;
      current = current[part];
    }
    return current;
  }

  function periodLabel(value) {
    const match = text(value).match(/^(\d{4})-(\d{2})$/);
    if (!match) return text(value);
    const month = Number(match[2]);
    const labels = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    return month >= 1 && month <= 12 ? labels[month - 1] + '/' + match[1] : text(value);
  }

  function formatMetric(value, unit) {
    const number = Number(value);
    if (!Number.isFinite(number)) return '';
    if (text(unit).toUpperCase() === 'BRL') {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(number);
    }
    return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(number);
  }

  function visualizationModel(item) {
    const visual = item && item.visualizacao;
    if (!visual || typeof visual !== 'object') return null;
    const type = text(visual.tipo);
    const period = text(item.periodo_referencia);
    const unit = text(visual.unidade || 'BRL');

    if (type === 'comparacao_barras') {
      const rawItems = Array.isArray(visual.itens) ? visual.itens : [];
      const items = rawItems.map(function(entry) {
        const value = Number(pathValue(item, entry && entry.campo));
        return {
          field: text(entry && entry.campo),
          label: text(entry && entry.rotulo),
          value: value,
          formatted: formatMetric(value, unit)
        };
      }).filter(function(entry) {
        return entry.label && Number.isFinite(entry.value) && entry.value >= 0;
      });
      if (!items.length) return null;
      const maxValue = Math.max.apply(null, items.map(function(entry) { return entry.value; }).concat([1]));
      items.forEach(function(entry) {
        entry.ratio = Math.max(0, Math.min(1, entry.value / maxValue));
      });
      const multiplier = Number(item && item.dados && item.dados.multiplicador);
      const difference = Number(item && item.dados && item.dados.diferenca && item.dados.diferenca.valor);
      return {
        type: type,
        title: text(visual.titulo || item.titulo),
        period: period,
        periodLabel: periodLabel(period),
        unit: unit,
        items: items,
        multiplier: Number.isFinite(multiplier) ? multiplier : null,
        difference: Number.isFinite(difference) ? difference : null,
        differenceFormatted: Number.isFinite(difference) ? formatMetric(difference, unit) : ''
      };
    }

    if (type === 'linha') {
      const rows = (Array.isArray(item && item.dados && item.dados.serie_mensal) ? item.dados.serie_mensal : [])
        .filter(function(row) {
          return row && typeof row === 'object' && /^\d{4}-\d{2}$/.test(text(row.periodo));
        })
        .map(function(row) {
          return Object.assign({}, row, { periodo: text(row.periodo) });
        })
        .sort(function(a, b) { return a.periodo.localeCompare(b.periodo); });
      const specs = Array.isArray(visual.series) ? visual.series : [];
      if (rows.length < 2 || !specs.length) return null;
      const series = specs.map(function(spec, index) {
        const field = text(spec && spec.campo);
        return {
          index: index,
          field: field,
          label: text(spec && spec.rotulo),
          values: rows.map(function(row) { return Number(row && row[field]); })
        };
      }).filter(function(seriesItem) {
        return seriesItem.label && seriesItem.values.some(Number.isFinite);
      });
      if (!series.length) return null;
      const values = [];
      series.forEach(function(seriesItem) {
        seriesItem.values.forEach(function(value) {
          if (Number.isFinite(value)) values.push(value);
        });
      });
      const maxValue = Math.max.apply(null, values.concat([1]));
      const latest = rows[rows.length - 1];
      return {
        type: type,
        title: text(visual.titulo || item.titulo),
        period: period,
        periodLabel: periodLabel(period),
        unit: unit,
        rows: rows,
        series: series,
        maxValue: maxValue,
        firstPeriodLabel: periodLabel(rows[0].periodo),
        middlePeriodLabel: periodLabel(rows[Math.floor((rows.length - 1) / 2)].periodo),
        lastPeriodLabel: periodLabel(latest.periodo),
        latestValues: series.map(function(seriesItem) {
          const value = Number(latest && latest[seriesItem.field]);
          return Object.assign({}, seriesItem, {
            value: value,
            formatted: Number.isFinite(value) ? formatMetric(value, unit) : ''
          });
        })
      };
    }

    return null;
  }

  function metricSummary(model, compact) {
    const wrapper = document.createElement('div');
    wrapper.className = compact ? 'utility-metric-summary utility-metric-summary--compact' : 'utility-metric-summary';
    const entries = model.type === 'comparacao_barras' ? model.items : model.latestValues;
    entries.forEach(function(entry) {
      const card = document.createElement('div');
      card.className = 'utility-metric-card';
      appendText(card, 'span', entry.label, 'utility-metric-label');
      appendText(card, 'strong', entry.formatted, 'utility-metric-value');
      wrapper.appendChild(card);
    });
    if (model.type === 'comparacao_barras' && model.multiplier !== null) {
      const card = document.createElement('div');
      card.className = 'utility-metric-card utility-metric-card--accent';
      appendText(card, 'span', 'Equivale a', 'utility-metric-label');
      appendText(card, 'strong', new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(model.multiplier) + '×', 'utility-metric-value');
      wrapper.appendChild(card);
    }
    return wrapper;
  }

  function barChart(model) {
    const chart = document.createElement('div');
    chart.className = 'utility-bars';
    model.items.forEach(function(entry) {
      const row = document.createElement('div');
      row.className = 'utility-bar-row';
      const heading = document.createElement('div');
      heading.className = 'utility-bar-heading';
      appendText(heading, 'span', entry.label, 'utility-bar-label');
      appendText(heading, 'strong', entry.formatted, 'utility-bar-value');
      const track = document.createElement('div');
      track.className = 'utility-bar-track';
      track.setAttribute('role', 'img');
      track.setAttribute('aria-label', entry.label + ': ' + entry.formatted);
      const fill = document.createElement('span');
      fill.className = 'utility-bar-fill';
      fill.style.setProperty('--utility-bar-size', Math.max(2, entry.ratio * 100).toFixed(2) + '%');
      track.appendChild(fill);
      row.append(heading, track);
      chart.appendChild(row);
    });
    return chart;
  }

  function svgElement(tag, attributes) {
    const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attributes || {}).forEach(function(entry) {
      element.setAttribute(entry[0], String(entry[1]));
    });
    return element;
  }

  function lineChart(model) {
    const wrapper = document.createElement('div');
    wrapper.className = 'utility-line-chart';
    const width = 760;
    const height = 270;
    const left = 74;
    const right = 24;
    const top = 18;
    const bottom = 48;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;
    const svg = svgElement('svg', {
      viewBox: '0 0 ' + width + ' ' + height,
      role: 'img',
      'aria-label': model.title + '. Série de ' + model.firstPeriodLabel + ' a ' + model.lastPeriodLabel + '.'
    });
    svg.classList.add('utility-line-svg');

    [0, 0.5, 1].forEach(function(fraction) {
      const y = top + plotHeight * (1 - fraction);
      svg.appendChild(svgElement('line', {
        x1: left, y1: y, x2: width - right, y2: y, class: 'utility-grid-line'
      }));
      const label = svgElement('text', {
        x: left - 12, y: y + 5, 'text-anchor': 'end', class: 'utility-axis-label'
      });
      label.textContent = fraction === 0 ? 'R$ 0' : formatMetric(model.maxValue * fraction, model.unit).replace(/\u00a0/g, ' ');
      svg.appendChild(label);
    });

    function xFor(index) {
      return left + (index / (model.rows.length - 1)) * plotWidth;
    }
    function yFor(value) {
      return top + plotHeight - (Math.max(0, Number(value) || 0) / model.maxValue) * plotHeight;
    }

    model.series.forEach(function(seriesItem) {
      const points = seriesItem.values.map(function(value, index) {
        return Number.isFinite(value) ? xFor(index).toFixed(1) + ',' + yFor(value).toFixed(1) : null;
      }).filter(Boolean).join(' ');
      svg.appendChild(svgElement('polyline', {
        points: points,
        fill: 'none',
        class: 'utility-series-line utility-series-' + seriesItem.index
      }));
      let lastIndex = -1;
      seriesItem.values.forEach(function(value, index) {
        if (Number.isFinite(value)) lastIndex = index;
      });
      if (lastIndex >= 0) {
        svg.appendChild(svgElement('circle', {
          cx: xFor(lastIndex),
          cy: yFor(seriesItem.values[lastIndex]),
          r: 5,
          class: 'utility-series-dot utility-series-' + seriesItem.index
        }));
      }
    });

    [
      { x: left, value: model.firstPeriodLabel, anchor: 'start' },
      { x: left + plotWidth / 2, value: model.middlePeriodLabel, anchor: 'middle' },
      { x: width - right, value: model.lastPeriodLabel, anchor: 'end' }
    ].forEach(function(entry) {
      const label = svgElement('text', {
        x: entry.x, y: height - 12, 'text-anchor': entry.anchor,
        class: 'utility-axis-label utility-axis-label--x'
      });
      label.textContent = entry.value;
      svg.appendChild(label);
    });
    wrapper.appendChild(svg);

    const legend = document.createElement('div');
    legend.className = 'utility-line-legend';
    model.latestValues.forEach(function(entry) {
      const item = document.createElement('div');
      item.className = 'utility-line-legend-item';
      const swatch = document.createElement('span');
      swatch.className = 'utility-line-swatch utility-series-' + entry.index;
      swatch.setAttribute('aria-hidden', 'true');
      const copy = document.createElement('div');
      appendText(copy, 'span', entry.label, 'utility-line-label');
      appendText(copy, 'strong', entry.formatted, 'utility-line-value');
      item.append(swatch, copy);
      legend.appendChild(item);
    });
    wrapper.appendChild(legend);
    return wrapper;
  }

  function visualization(item, compact) {
    const model = visualizationModel(item);
    if (!model) return null;
    if (compact) return metricSummary(model, true);
    const section = document.createElement('section');
    section.className = 'utility-visualization utility-visualization--' + model.type;
    const heading = document.createElement('div');
    heading.className = 'utility-viz-heading';
    appendText(heading, 'h2', model.title || 'Indicador', 'utility-viz-title');
    appendText(heading, 'span', model.periodLabel, 'utility-viz-period');
    section.appendChild(heading);
    if (model.type === 'comparacao_barras') {
      section.appendChild(barChart(model));
      const summary = document.createElement('div');
      summary.className = 'utility-viz-summary';
      if (model.multiplier !== null) {
        appendText(summary, 'strong', new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(model.multiplier) + '× o salário mínimo nominal');
      }
      if (model.differenceFormatted) appendText(summary, 'span', 'Diferença: ' + model.differenceFormatted);
      section.appendChild(summary);
    } else {
      section.appendChild(lineChart(model));
    }
    return section;
  }

  function mainMetric(model) {
    if (!model) return null;
    if (model.type === 'comparacao_barras') {
      return model.items.find(function(entry) { return entry.field.includes('necessario'); }) || model.items[model.items.length - 1];
    }
    return model.latestValues.find(function(entry) { return entry.field.includes('necessario'); }) || model.latestValues[model.latestValues.length - 1];
  }

  function configureMedia(slide, item, model, helpers) {
    const image = slide.querySelector('.event-image');
    const fallback = slide.querySelector('.image-fallback');
    if (!fallback) return;

    // Indicadores com visualização estruturada usam o painel numérico.
    if (model) {
      if (image) {
        image.removeAttribute('src');
        image.style.display = 'none';
      }
      fallback.hidden = false;
      fallback.style.display = 'grid';
      fallback.classList.add('utility-data-fallback');
      fallback.replaceChildren();
      appendText(fallback, 'span', model.periodLabel || 'Utilidade Pública', 'utility-hero-period');
      const metric = mainMetric(model);
      if (metric) {
        appendText(fallback, 'strong', metric.formatted, 'utility-hero-value');
        appendText(fallback, 'span', metric.label, 'utility-hero-label');
      }
      if (model.type === 'comparacao_barras' && model.multiplier !== null) {
        appendText(fallback, 'span', new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(model.multiplier) + '× o mínimo nominal', 'utility-hero-secondary');
      } else if (model.type === 'linha') {
        appendText(fallback, 'span', String(model.rows.length) + ' meses na série', 'utility-hero-secondary');
      }
      appendText(fallback, 'span', 'Fonte: ' + (item.fontes && item.fontes[0] ? item.fontes[0].nome : item.fonte_label || 'fonte oficial'), 'utility-hero-source');
      return;
    }

    // Conteúdos antigos preservam a imagem editorial já existente no catálogo.
    fallback.classList.remove('utility-data-fallback');
    const imageUrl = helpers.safeImageUrl(item.imagem);
    const fallbackIcon = fallback.querySelector('.fallback-icon');
    const fallbackLabel = fallback.querySelector('.fallback-label');
    if (fallbackIcon) fallbackIcon.textContent = item.icone || 'ℹ️';
    if (fallbackLabel) fallbackLabel.textContent = (item.areas_utilidade || [])[0] || 'Utilidade Pública';
    fallback.hidden = false;
    fallback.style.display = imageUrl ? 'none' : 'grid';

    if (!image) return;
    image.classList.remove('loaded');
    image.alt = item.titulo ? 'Imagem de apoio: ' + item.titulo : 'Imagem de apoio';
    image.decoding = 'async';
    image.loading = 'eager';
    image.style.display = imageUrl ? '' : 'none';
    image.onload = function() {
      image.classList.add('loaded');
      fallback.style.display = 'none';
    };
    image.onerror = function() {
      image.classList.remove('loaded');
      image.removeAttribute('src');
      image.style.display = 'none';
      fallback.style.display = 'grid';
    };
    if (imageUrl) image.src = imageUrl;
    else image.removeAttribute('src');
  }

  function configureAction(slide, item, helpers) {
    const link = helpers.safeExternalUrl(item.link);
    const sourceLabel = slide.querySelector('.source-label');
    if (sourceLabel) sourceLabel.textContent = item.fonte_label || 'Fonte do indicador';
    const source = slide.querySelector('.source-url');
    if (source) {
      source.replaceChildren();
      if (link) {
        const anchor = document.createElement('a');
        anchor.href = link;
        anchor.textContent = item.natureza === 'indicador' ? 'Consultar fonte e metodologia' : 'Consultar fonte';
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        source.appendChild(anchor);
      }
    }
    const updated = slide.querySelector('.updated');
    if (updated) updated.textContent = item.observacao || '';
    const qr = slide.querySelector('.qr-code');
    helpers.configureItemQrLabel(slide, item, Boolean(link));
    if (qr && link) helpers.buildQr(qr, link);
  }

  function createPanelSlide(args) {
    const item = args.movie;
    const slide = args.template.content.firstElementChild.cloneNode(true);
    const helpers = args.helpers;
    const model = visualizationModel(item);
    helpers.buildSiteQr(slide);
    slide.classList.add('support-slide', 'utility-slide');
    if (model) slide.classList.add('utility-data-slide', 'utility-data-slide--' + model.type);
    slide.setAttribute('aria-label', 'Utilidade Pública: ' + (item.titulo || 'Informação'));
    const seconds = helpers.slideDurationFor(item);
    slide.style.setProperty('--slide-seconds', String(seconds) + 's');
    slide.querySelector('.counter').textContent = String(args.index + 1) + ' de ' + String(args.total);

    const eventCopy = slide.querySelector('.event-copy');
    const bookCopy = slide.querySelector('.book-copy');
    if (bookCopy) bookCopy.hidden = true;
    if (eventCopy) eventCopy.hidden = false;

    const category = slide.querySelector('.category');
    if (category) {
      category.hidden = false;
      category.textContent = 'UTILIDADE PÚBLICA';
    }
    const free = slide.querySelector('.free');
    if (free) free.hidden = true;
    const rating = slide.querySelector('.badge.rating');
    if (rating) rating.hidden = true;
    const area = (Array.isArray(item.areas_utilidade) ? item.areas_utilidade : []).find(Boolean) || 'Informação';
    const areaBadge = slide.querySelector('.badge.city');
    if (areaBadge) {
      areaBadge.hidden = false;
      areaBadge.className = 'badge utility-area-badge';
      areaBadge.textContent = String(area).toUpperCase();
    }

    const title = slide.querySelector('.event-title');
    if (title) title.textContent = item.titulo || 'Utilidade Pública';
    const description = slide.querySelector('.description');
    if (description) description.textContent = item.descricao || '';

    const details = slide.querySelector('.details');
    if (model && eventCopy) {
      if (details) details.hidden = true;
      const viz = visualization(item, false);
      if (viz) eventCopy.appendChild(viz);
    } else if (details) {
      details.hidden = false;
      const when = slide.querySelector('.when');
      if (when) {
        const label = when.closest('div') && when.closest('div').querySelector('dt');
        if (label) label.textContent = 'Em destaque';
        when.textContent = item.destaque || '';
      }
      const where = slide.querySelector('.where-text');
      if (where) {
        const label = where.closest('div') && where.closest('div').querySelector('dt');
        if (label) label.textContent = 'Orientação';
        where.textContent = item.detalhe || '';
      }
    }
    const mapLink = slide.querySelector('.map-link');
    if (mapLink) mapLink.remove();

    const subtitle = slide.querySelector('.panel-subtitle');
    if (subtitle) subtitle.textContent = (Array.isArray(item.tipos_recurso) ? item.tipos_recurso : []).find(Boolean) || (item.natureza === 'indicador' ? 'Indicador' : 'Informação');

    configureAction(slide, item, helpers);
    configureMedia(slide, item, model, helpers);
    return slide;
  }

  function createAgendaCard(item, helpers) {
    const article = document.createElement('article');
    article.className = 'agenda-card agenda-support-card agenda-utility-card';
    const model = visualizationModel(item);

    const media = document.createElement('div');
    media.className = 'agenda-card-media utility-agenda-media';
    if (model) {
      const metric = mainMetric(model);
      appendText(media, 'span', model.periodLabel, 'utility-agenda-period');
      appendText(media, 'strong', metric && metric.formatted, 'utility-agenda-value');
      appendText(media, 'span', metric && metric.label, 'utility-agenda-label');
    } else {
      const imageUrl = helpers.safeImageUrl(item.imagem);
      if (imageUrl) {
        media.classList.add('utility-agenda-media--image');
        const image = document.createElement('img');
        image.src = imageUrl;
        image.alt = item.titulo ? 'Imagem de apoio: ' + item.titulo : 'Imagem de apoio';
        image.loading = 'lazy';
        image.decoding = 'async';
        image.addEventListener('error', function() {
          image.remove();
          media.classList.remove('utility-agenda-media--image');
          appendText(media, 'strong', item.icone || 'ℹ️', 'utility-agenda-icon');
          appendText(media, 'span', (item.areas_utilidade || [])[0] || 'Utilidade Pública', 'utility-agenda-label');
        });
        media.appendChild(image);
      } else {
        appendText(media, 'strong', item.icone || 'ℹ️', 'utility-agenda-icon');
        appendText(media, 'span', (item.areas_utilidade || [])[0] || 'Utilidade Pública', 'utility-agenda-label');
      }
    }

    const body = document.createElement('div');
    body.className = 'agenda-card-body';
    appendText(body, 'p', 'UTILIDADE PÚBLICA', 'agenda-card-date');
    appendText(body, 'h2', item.titulo || 'Informação');
    appendText(body, 'p', item.descricao, 'agenda-card-description');
    if (model) body.appendChild(metricSummary(model, true));

    const tags = document.createElement('div');
    tags.className = 'film-tags';
    tags.setAttribute('aria-label', 'Tipo de conteúdo');
    appendText(tags, 'span', item.natureza === 'indicador' ? 'Indicador' : 'Informação');
    (Array.isArray(item.areas_utilidade) ? item.areas_utilidade : []).forEach(function(area) {
      appendText(tags, 'span', area);
    });
    body.appendChild(tags);

    const link = helpers.safeExternalUrl(item.link);
    if (link) {
      const actions = document.createElement('div');
      actions.className = 'agenda-card-actions';
      const anchor = document.createElement('a');
      anchor.href = link;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.textContent = item.natureza === 'indicador' ? 'Consultar fonte' : 'Saiba mais';
      actions.appendChild(anchor);
      body.appendChild(actions);
    }
    article.append(media, body);
    return article;
  }

  root.contents.utility = Object.freeze({
    createAgendaCard: createAgendaCard,
    createPanelSlide: createPanelSlide,
    visualizationModel: visualizationModel,
    formatMetric: formatMetric,
    periodLabel: periodLabel
  });
})();
