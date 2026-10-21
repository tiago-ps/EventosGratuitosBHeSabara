(() => {
  'use strict';

  const STORAGE_KEY = 'tem-sim-uai-localizacoes-revisadas-v1';
  const DEFAULT_CENTER = [-19.9227, -43.9451];
  const $ = id => document.getElementById(id);
  const mapTools = window.MuralCultural?.spaceMap;
  const normalize = value => String(value || '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim();

  const escapeUrl = value => {
    try {
      const url = new URL(String(value || ''), window.location.href);
      return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
    } catch { return ''; }
  };
  const placeholder = name => /^(local informado|local a definir|a definir|unidades culturais|v[aá]rios espa[cç]os|diversos locais|online|on-line|pontos de encontro|atividades itinerantes)/i
    .test(String(name || '').trim());

  let data = null;
  let groups = [];
  let selected = null;
  let leaflet = null;
  let pin = null;
  let revisions = {};
  let pointValue = null;

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) revisions = saved;
  } catch { revisions = {}; }

  function notify(message, isError = false) {
    const feedback = $('feedback');
    feedback.textContent = message;
    feedback.style.color = isError ? '#9b311a' : '#176846';
  }

  function eventLink(event) {
    const url = new URL('./', window.location.href);
    url.searchParams.set('modo', 'agenda');
    url.searchParams.set('item', event.id);
    return url.href;
  }

  function groupEvents(events) {
    const records = new Map();
    for (const event of events) {
      const address = String(event.endereco || '').trim();
      const name = String(event.local || event.unidade || '').trim();
      const id = String(event.local_id || '').trim();
      const key = address ? 'endereco:' + normalize(address) :
        id ? 'id:' + normalize(id) :
        'nome:' + normalize(name || event.titulo);
      if (!records.has(key)) {
        records.set(key, {
          key, address, name, id, events: [], mapLinks: [],
          category: address ? 'address' : 'no-address'
        });
      }
      const group = records.get(key);
      group.events.push(event);
      if (event.mapa && !group.mapLinks.includes(event.mapa)) group.mapLinks.push(event.mapa);
      if (!group.id && id) group.id = id;
      if (!group.name && name) group.name = name;
    }
    return [...records.values()].sort((a,b) =>
      b.events.length - a.events.length ||
      (a.name || a.address).localeCompare(b.name || b.address, 'pt-BR'));
  }

  async function load() {
    if (!mapTools?.mapItems || !window.L) {
      $('status').textContent = 'Não foi possível carregar os recursos do mapa.';
      return;
    }
    try {
      const files = await Promise.all([
        'eventos.json', 'espacos_culturais.json',
        'coordenadas-espacos.json', 'coordenadas-conteudos.json',
        'relacoes-eventos.json'
      ].map(async path => {
        const response = await fetch('./' + path, { cache: 'no-store' });
        if (!response.ok) throw new Error(path + ': HTTP ' + response.status);
        return response.json();
      }));
      const [eventsData, spacesData, spacesCoords, contentCoords, relData] = files;
      const publicEvents = (eventsData.eventos || [])
        .filter(event => event.somente_teste !== true)
        .map(event => ({ ...event, tipo_conteudo: 'evento' }));
      const mapped = mapTools.mapItems({
        results: { events: publicEvents },
        allSpaces: spacesData.itens || [],
        coordinates: spacesCoords.pontos || {},
        extra: contentCoords,
        relations: relData.relacoes || []
      });
      groups = groupEvents(mapped.unmappedRecords
        .filter(item => item.item?.tipo_conteudo === 'evento')
        .map(item => item.item));
      data = { publicEvents, spaces: spacesData.itens || [] };
      $('status').textContent = mapped.mapped + ' eventos localizados · ' +
        mapped.unmappedRecords.length + ' pendentes · ' + groups.length + ' grupos para revisar';
      renderList();
    } catch (error) {
      $('status').textContent = 'Falha ao carregar: ' + error.message;
    }
  }

  function renderList() {
    const term = normalize($('search').value);
    const filter = $('filter').value;
    const shown = groups.filter(group => {
      if (term && !normalize([group.name, group.address,
        ...group.events.slice(0, 8).map(x => x.titulo)].join(' ')).includes(term)) return false;
      if (filter === 'address' && group.category !== 'address') return false;
      if (filter === 'no-address' && group.category !== 'no-address') return false;
      if (filter === 'reviewed' && !revisions[group.key]) return false;
      if (filter === 'pending' && revisions[group.key]) return false;
      return true;
    });
    $('count').textContent = shown.length + ' locais na fila · ' +
      Object.keys(revisions).length + ' revisões salvas neste navegador';
    const list = $('records');
    list.replaceChildren();
    for (const group of shown) {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      const done = Boolean(revisions[group.key]);
      button.className = [group.key === selected?.key ? 'is-selected' : '',
        done ? 'is-done' : ''].filter(Boolean).join(' ');
      const title = document.createElement('b');
      title.textContent = (done ? '✓ ' : '') +
        (group.name || group.address || 'Local não informado') +
        ' · ' + group.events.length +
        (group.events.length === 1 ? ' evento' : ' eventos');
      const address = document.createElement('span');
      address.textContent = group.address || 'Sem endereço: requer verificação específica';
      button.append(title, address);
      button.addEventListener('click', () => selectGroup(group));
      item.append(button);
      list.append(item);
    }
  }

  function updatePin(coords) {
    pointValue = coords;
    if (pin && leaflet) leaflet.removeLayer(pin);
    pin = null;
    if (coords && leaflet) {
      pin = window.L.marker(coords, { draggable: true })
        .addTo(leaflet).bindPopup('Ponto a confirmar');
      pin.on('dragend', () => updateInputs(pin.getLatLng()));
      leaflet.setView(coords, 15);
    }
  }

  function updateInputs(position) {
    const latitude = Number(position.lat);
    const longitude = Number(position.lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
    $('lat').value = latitude.toFixed(7);
    $('lon').value = longitude.toFixed(7);
    updatePin([latitude, longitude]);
  }

  function mapInit() {
    if (leaflet) {
      setTimeout(() => leaflet.invalidateSize(), 0);
      return;
    }
    leaflet = window.L.map('review-map', { scrollWheelZoom: false }).setView(DEFAULT_CENTER, 12);
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>'
    }).addTo(leaflet);
    leaflet.on('click', event => updateInputs(event.latlng));
    setTimeout(() => leaflet.invalidateSize(), 0);
  }

  function selectGroup(group) {
    selected = group;
    $('empty').hidden = true;
    $('editor').hidden = false;
    $('venue').textContent = group.name || group.address || 'Local não informado';
    $('address').textContent = group.address || 'Nenhum endereço individual foi informado no cadastro.';
    $('group-info').textContent = group.events.length + ' eventos · ' +
      (group.id ? 'ID do local: ' + group.id : 'Sem ID do local');
    const generic = placeholder(group.name);
    $('warning').hidden = !generic && Boolean(group.address);
    $('warning').textContent = generic ?
      'Esta descrição representa vários locais ou um ponto ainda não definido. Não atribua a todos os eventos um mesmo marcador: corrija os locais individuais na fonte e no cadastro.' :
      !group.address ? 'Sem endereço: confirme o nome exato do equipamento na fonte oficial antes de validar.' : '';
    const mapsLink = group.mapLinks.map(escapeUrl).find(Boolean);
    $('source-maps').hidden = !mapsLink;
    if (mapsLink) $('source-maps').href = mapsLink;
    const osmSearch = group.address || group.name;
    $('osm-search').href = 'https://www.openstreetmap.org/search?query=' + encodeURIComponent(osmSearch);
    $('event-list').replaceChildren();
    for (const event of group.events.slice(0, 25)) {
      const row = document.createElement('li');
      const link = document.createElement('a');
      link.href = eventLink(event);
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = event.titulo || 'Evento';
      row.append(link);
      $('event-list').append(row);
    }
    const current = revisions[group.key];
    $('lat').value = current?.latitude ?? '';
    $('lon').value = current?.longitude ?? '';
    $('evidence').value = current?.fonte || '';
    $('notes').value = current?.observacao || '';
    $('confirmed').checked = Boolean(current);
    $('save').disabled = generic;
    notify(current ? 'Revisão salva neste navegador; exporte para aplicar à base.' :
      generic ? 'Local coletivo/indefinido: atribua endereços específicos no cadastro primeiro.' :
      'Selecione um ponto no mapa, informe a fonte e confirme os dados.');
    mapInit();
    updatePin(current ? [Number(current.latitude), Number(current.longitude)] : null);
    if (!current && leaflet) leaflet.setView(DEFAULT_CENTER, 12);
    renderList();
  }

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(revisions));
    renderList();
  }

  function saveReview() {
    if (!selected || placeholder(selected.name)) return;
    const latitude = Number($('lat').value);
    const longitude = Number($('lon').value);
    const source = escapeUrl($('evidence').value.trim());
    if (!$('lat').value || !$('lon').value || !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) || latitude < -21 || latitude > -18 ||
      longitude < -45 || longitude > -42) {
      notify('Informe uma latitude/longitude válida de BH ou da região metropolitana.', true);
      return;
    }
    if (!source) {
      notify('Informe a URL da fonte usada para confirmar a localização.', true);
      return;
    }
    if (!$('confirmed').checked) {
      notify('Marque a confirmação de que o ponto pertence ao local dos eventos.', true);
      return;
    }
    // Não confiar apenas em uma coordenada: a revisão registra sua origem e vínculo.
    revisions[selected.key] = {
      chave: selected.key,
      local: selected.name || '',
      local_id: selected.id || '',
      endereco: selected.address || '',
      latitude: Number(latitude.toFixed(7)),
      longitude: Number(longitude.toFixed(7)),
      fonte: source,
      observacao: $('notes').value.trim(),
      evento_ids: selected.events.map(event => event.id),
      confirmado_em: new Date().toISOString()
    };
    persist();
    notify('Local conferido! Todos os ' + selected.events.length +
      ' eventos ligados ao grupo serão considerados na importação.');
  }

  function exportReview() {
    const validated = Object.values(revisions);
    if (!validated.length) {
      window.alert('Ainda não há pontos validados para exportar.');
      return;
    }
    const payload = {
      formato: 'tem-sim-uai-localizacoes-revisadas-v1',
      ambiente: 'teste',
      exportado_em: new Date().toISOString(),
      revisoes: validated
    };
    const blob = new Blob([JSON.stringify(payload, null, 2) + '\n'],
      { type: 'application/json;charset=utf-8' });
    const fileUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = 'localizacoes-revisadas-' +
      new Date().toISOString().slice(0, 10) + '.json';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(fileUrl), 1000);
  }

  $('search').addEventListener('input', renderList);
  $('filter').addEventListener('change', renderList);
  $('save').addEventListener('click', saveReview);
  $('discard').addEventListener('click', () => {
    if (!selected) return;
    delete revisions[selected.key];
    persist();
    selectGroup(selected);
  });
  $('export').addEventListener('click', exportReview);
  $('clear').addEventListener('click', () => {
    if (!window.confirm('Descartar TODAS as revisões deste navegador? Exporte o JSON antes, se necessário.')) return;
    revisions = {};
    persist();
    if (selected) selectGroup(selected);
  });
  $('center').addEventListener('click', () => {
    if (leaflet) updateInputs(leaflet.getCenter());
  });
  $('reset').addEventListener('click', () => {
    $('lat').value = '';
    $('lon').value = '';
    updatePin(null);
  });
  for (const id of ['lat', 'lon']) {
    $(id).addEventListener('change', () => {
      if (!$('lat').value || !$('lon').value) return;
      const lat = Number($('lat').value);
      const lon = Number($('lon').value);
      if (Number.isFinite(lat) && Number.isFinite(lon)) updatePin([lat, lon]);
    });
  }
  load();
})();