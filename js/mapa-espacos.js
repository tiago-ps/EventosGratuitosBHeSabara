(() => {
  'use strict';

  const root = window.MuralCultural = window.MuralCultural || {};
  const LEAFLET_JS = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js';
  const LEAFLET_CSS = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css';
  const DEFAULT_CENTER = [-19.9227, -43.9451];
  const CONTENT_TYPES = new Set(['all', 'events', 'books', 'spaces', 'activities', 'contests', 'utility']);
  const LABELS = {
    evento: 'Evento', livro: 'Livro', espaco: 'Espaço',
    atividade_lazer: 'Esporte e Lazer', concurso: 'Concurso', utilidade_publica: 'Utilidade pública'
  };
  let selectedView = 'list';
  let leafletPromise = null;
  let map = null;
  let generation = 0;

  function normalize(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function pointOf(value) {
    if (!value || typeof value !== 'object') return null;
    const latitude = Number(value.latitude ?? value.lat);
    const longitude = Number(value.longitude ?? value.lng ?? value.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
        latitude < -35 || latitude > 6 || longitude < -75 || longitude > -30 ||
        (latitude === 0 && longitude === 0)) return null;
    return [latitude, longitude];
  }

  function hasStreetAddress(text) {
    const value = normalize(text);
    return Boolean(value && /\b\d{1,6}\b/.test(value) &&
      /^(rua|r |avenida|av |praca|travessa|alameda|rodovia|estrada|largo|beco|passagem)\b/.test(value));
  }

  function spaceIndex(spaces, geo) {
    const ids = new Map();
    const addresses = new Map();
    const names = new Map();
    const raw = geo && typeof geo === 'object' ? geo : {};
    for (const space of spaces || []) {
      const coords = pointOf(raw[space.id]);
      if (!coords) continue;
      ids.set(normalize(space.id), coords);
      if (space.equipamento_id) ids.set(normalize(space.equipamento_id), coords);
      const address = normalize(space.endereco);
      if (address && !addresses.has(address)) addresses.set(address, coords);
    }
    for (const space of spaces || []) {
      const coords = ids.get(normalize(space.id)) || addresses.get(normalize(space.endereco));
      if (!coords) continue;
      ids.set(normalize(space.id), coords);
      if (space.equipamento_id) ids.set(normalize(space.equipamento_id), coords);
      for (const name of [space.titulo, space.nome, ...(space.aliases || [])]) {
        const key = normalize(name);
        // Só nomes completos e suficientemente específicos.
        if (key.length > 8 && !names.has(key)) names.set(key, coords);
      }
    }
    return { ids, addresses, names };
  }

  function resolvePhysical(item, index, extra, identifiers = []) {
    const ids = [item?.local_id, item?.espaco_id, item?.equipamento_id, ...identifiers];
    for (const id of ids) {
      const coords = index.ids.get(normalize(id));
      if (coords) return coords;
    }
    const explicit = pointOf(item?.coordenadas || item?.local?.coordenadas || item?.localizacao);
    if (explicit) return explicit;
    const rawAddress = typeof item?.local === 'object'
      ? [item.local.endereco, item.local.bairro, item.local.cidade, item.local.uf].filter(Boolean).join(', ')
      : String(item?.endereco || item?.local_endereco || '');
    const address = normalize(rawAddress);
    if (address && index.addresses.has(address)) return index.addresses.get(address);
    const additional = extra?.locais_por_endereco || {};
    if (hasStreetAddress(rawAddress)) {
      for (const [key, value] of Object.entries(additional)) {
        if (normalize(key) === address) return pointOf(value);
      }
    }
    const names = [item?.local?.nome, item?.unidade, item?.local, item?.espaco_principal]
      .filter(name => typeof name === 'string');
    for (const name of names) {
      const coords = index.names.get(normalize(name));
      if (coords) return coords;
    }
    return null;
  }

  function locationLabel(item) {
    if (item?.tipo_conteudo === 'atividade_lazer') {
      return item.local?.nome || item.local?.endereco || '';
    }
    return item?.local || item?.espaco_principal || item?.endereco || item?.cidade || '';
  }

  function libraryPlace(acervo, indexes, extra) {
    if (!acervo?.acesso_fisico &&
        !(acervo?.registros || []).some(record => record.acesso_fisico)) return null;
    const library = String(acervo.biblioteca || acervo.biblioteca_rede || '').trim();
    const unit = String(acervo.unidade || '').trim();
    const combo = normalize(library + ' ' + unit);
    if (!combo) return null;
    let key = '';
    if (combo.includes('ifmg sabara') || (combo.includes('ifmg') && combo.includes('campus sabara'))) key = 'ifmg-sabara';
    else if (combo.includes('biblioteca publica estadual de minas gerais')) key = 'biblioteca-publica-estadual-mg';
    const special = key ? extra?.bibliotecas?.[key] : null;
    if (special && pointOf(special)) return {
      coords: pointOf(special),
      name: special.nome || library || unit,
      address: special.endereco || '',
      precision: special.precisao || ''
    };
    // Outras bibliotecas só entram se houver equipamento cadastrado com nome exato.
    const candidate = indexes.names.get(normalize(library)) ||
      indexes.names.get(normalize(unit));
    if (!candidate) return null;
    return { coords: candidate, name: unit || library, address: '' };
  }

  function eventPlaceIds(id, relations) {
    return (relations || []).filter(rel => String(rel.evento_id) === String(id) && rel.tipo === 'acontece_em')
      .flatMap(rel => [rel.destino?.id, rel.equipamento?.id].filter(Boolean));
  }

  function mapItems(options) {
    const { results, allSpaces, coordinates, extra, relations } = options;
    const index = spaceIndex(allSpaces || [], coordinates || {});
    const items = [];
    let unmapped = 0;
    const add = (item, coords, venue, address, precision) => {
      if (!coords) { unmapped += 1; return; }
      items.push({ item, coords, venue: venue || item.titulo || '',
        address: address || '', precision: precision || '' });
    };
    for (const space of results.spaces || []) {
      add(space, resolvePhysical(space, index, extra, [space.id]), space.titulo, space.endereco);
    }
    for (const event of results.events || []) {
      const coords = resolvePhysical(event, index, extra, eventPlaceIds(event.id, relations));
      add(event, coords, locationLabel(event), event.endereco);
    }
    for (const activity of results.activities || []) {
      const local = activity.local && typeof activity.local === 'object' ? activity.local : {};
      const address = [local.endereco, local.bairro, local.cidade, local.uf].filter(Boolean).join(', ');
      // Atividades sem unidade física explicitada não são colocadas no centro da cidade.
      const coords = (local.nome || hasStreetAddress(local.endereco))
        ? resolvePhysical(activity, index, extra) : null;
      add(activity, coords, local.nome || activity.titulo, address);
    }
    for (const book of results.books || []) {
      if (!book.acesso_fisico) continue;
      const holdings = Array.isArray(book.acervos) && book.acervos.length
        ? book.acervos : [{ biblioteca: book.biblioteca_rede || book.biblioteca || book.fonte,
          unidade: book.unidade, acesso_fisico: book.acesso_fisico }];
      const seen = new Set();
      for (const acervo of holdings) {
        const place = libraryPlace(acervo, index, extra);
        if (!place) { unmapped += 1; continue; }
        const fingerprint = place.coords.join(',');
        if (seen.has(fingerprint)) continue;
        seen.add(fingerprint);
        add(book, place.coords, place.name, place.address, place.precision);
      }
    }
    for (const contest of results.contests || []) {
      // Sede da instituição, cidade de lotação e local de prova não são
      // automaticamente locais de trabalho. Exigir endereço concreto.
      const local = contest.local_trabalho || contest.local_lotacao || contest.endereco_trabalho;
      const address = typeof local === 'object' ? local.endereco : local;
      const coords = hasStreetAddress(address) ? resolvePhysical({
        ...contest, endereco: address, local: typeof local === 'object' ? local : address
      }, index, extra) : null;
      add(contest, coords, typeof local === 'object' ? local.nome : String(local || ''),
        typeof address === 'string' ? address : '');
    }
    for (const service of results.utility || []) {
      const location = service.local_atendimento || service.local;
      const address = typeof location === 'object' ? location.endereco : location;
      const coords = hasStreetAddress(address) ? resolvePhysical({
        ...service, endereco: address, local: location
      }, index, extra) : null;
      add(service, coords, typeof location === 'object' ? location.nome : '',
        typeof address === 'string' ? address : '');
    }
    const grouped = new Map();
    for (const record of items) {
      const key = record.coords.map(value => value.toFixed(6)).join(',');
      if (!grouped.has(key)) grouped.set(key, { coords: record.coords, items: [] });
      grouped.get(key).items.push(record);
    }
    return { points: [...grouped.values()], mapped: items.length, unmapped };
  }

  // API mantida para testes do agrupamento de espaços e compatibilidade.
  function groupedPoints(spaces, geo, allSpaces = spaces) {
    const resolved = mapItems({ results: { spaces }, coordinates: geo,
      allSpaces, extra: {}, relations: [] });
    return { points: resolved.points.map(group => ({
      coords: group.coords, spaces: group.items.map(record => record.item)
    })), unlocated: resolved.unmapped };
  }

  function externalUrl(value) {
    try {
      const url = new URL(String(value || ''), window.location.href);
      return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
    } catch { return ''; }
  }

  function loadLeaflet() {
    if (window.L?.map) return Promise.resolve(window.L);
    if (leafletPromise) return leafletPromise;
    leafletPromise = new Promise((resolve, reject) => {
      if (!document.querySelector('link[data-space-map-leaflet]')) {
        const stylesheet = document.createElement('link');
        stylesheet.rel = 'stylesheet';
        stylesheet.href = LEAFLET_CSS;
        stylesheet.dataset.spaceMapLeaflet = 'true';
        document.head.appendChild(stylesheet);
      }
      const script = document.createElement('script');
      script.src = LEAFLET_JS;
      script.async = true;
      script.onload = () => window.L ? resolve(window.L) : reject(new Error('Leaflet indisponível'));
      script.onerror = () => reject(new Error('Não foi possível baixar a biblioteca de mapas'));
      document.head.appendChild(script);
    }).catch(error => { leafletPromise = null; throw error; });
    return leafletPromise;
  }

  function createPopup(group, toItemUrl) {
    const root = document.createElement('div');
    root.className = 'agenda-space-map-popup';
    const heading = document.createElement('strong');
    heading.textContent = group.items.length === 1
      ? group.items[0].venue : group.items.length + ' conteúdos neste local';
    root.appendChild(heading);
    const address = document.createElement('p');
    address.textContent = group.items.find(record => record.address)?.address || '';
    if (address.textContent) root.appendChild(address);
    const list = document.createElement('ul');
    for (const record of group.items.slice(0, 35)) {
      const row = document.createElement('li');
      const link = document.createElement('a');
      const url = externalUrl(toItemUrl(record.item));
      link.href = url || '#';
      link.textContent = (LABELS[record.item.tipo_conteudo] || 'Conteúdo') + ': ' +
        (record.item.titulo || 'Ver detalhes');
      row.appendChild(link);
      list.appendChild(row);
    }
    root.appendChild(list);
    if (group.items.length > 35) {
      const note = document.createElement('p');
      note.textContent = '+' + (group.items.length - 35) + ' resultados; use os filtros para refinar.';
      root.appendChild(note);
    }
    if (group.items.some(record => record.precision)) {
      const note = document.createElement('p');
      note.textContent = 'Localização do campus/equipamento; confirme a entrada da biblioteca.';
      root.appendChild(note);
    }
    const navigate = document.createElement('a');
    navigate.className = 'agenda-space-map-directions';
    navigate.href = 'https://www.google.com/maps/dir/?api=1&destination=' +
      encodeURIComponent(group.coords.join(','));
    navigate.rel = 'noopener noreferrer';
    navigate.target = '_blank';
    navigate.textContent = 'Como chegar ↗';
    root.appendChild(navigate);
    return root;
  }

  function clearMap() {
    generation += 1;
    if (map) { map.remove(); map = null; }
  }

  function mount(options) {
    clearMap();
    const { shell, resultsContainer, count, results, content, blocked, toItemUrl } = options;
    if (!shell || !resultsContainer || !count || blocked || !CONTENT_TYPES.has(content)) {
      selectedView = 'list';
      return;
    }
    const located = mapItems(options);
    const wrap = document.createElement('div');
    wrap.className = 'agenda-map-view-toggle';
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', 'Alternar entre lista e mapa');
    const listButton = document.createElement('button');
    listButton.type = 'button';
    listButton.className = 'agenda-map-view-button';
    listButton.textContent = '☷ Lista';
    const mapButton = document.createElement('button');
    mapButton.type = 'button';
    mapButton.className = 'agenda-map-view-button';
    mapButton.textContent = '⌖ Mapa';
    wrap.append(listButton, mapButton);
    count.append(wrap);

    const section = document.createElement('section');
    section.className = 'agenda-space-map-section';
    section.hidden = true;
    section.setAttribute('aria-label', 'Mapa dos conteúdos com localização');
    const information = document.createElement('p');
    information.className = 'agenda-space-map-info';
    section.append(information);
    const locationButton = document.createElement('button');
    locationButton.type = 'button';
    locationButton.className = 'agenda-space-map-nearby';
    locationButton.textContent = '◎ Perto de mim';
    locationButton.title = 'Usar minha localização somente nesta consulta';
    section.append(locationButton);
    const mapHost = document.createElement('div');
    mapHost.className = 'agenda-space-map-canvas';
    mapHost.setAttribute('aria-label', 'Mapa interativo de locais');
    section.append(mapHost);
    shell.insertBefore(section, resultsContainer);
    const myGeneration = generation;

    async function drawMap() {
      if (map || myGeneration !== generation) return;
      if (!located.points.length) {
        mapHost.textContent = 'Nenhum endereço físico validado para os resultados atuais. A lista continua disponível. Para concursos, só aparecem locais de trabalho confirmados.';
        mapHost.classList.add('agenda-space-map-empty');
        return;
      }
      mapHost.textContent = 'Carregando mapa…';
      try {
        const L = await loadLeaflet();
        if (myGeneration !== generation || section.hidden) return;
        mapHost.textContent = '';
        map = L.map(mapHost, { scrollWheelZoom: false }).setView(DEFAULT_CENTER, 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
          maxZoom: 19
        }).addTo(map);
        const bounds = [];
        for (const group of located.points) {
          const label = group.items.length === 1
            ? group.items[0].venue : group.items.length + ' conteúdos';
          L.marker(group.coords).addTo(map)
            .bindTooltip(label)
            .bindPopup(createPopup(group, toItemUrl), { maxWidth: 330 });
          bounds.push(group.coords);
        }
        if (bounds.length > 1) map.fitBounds(bounds, { padding: [32, 32], maxZoom: 14 });
        else map.setView(bounds[0], 15);
        requestAnimationFrame(() => map?.invalidateSize());
      } catch {
        mapHost.textContent = 'Não foi possível carregar o mapa. Os conteúdos continuam disponíveis na lista.';
        mapHost.classList.add('agenda-space-map-empty');
      }
    }

    locationButton.addEventListener('click', () => {
      if (!navigator.geolocation) {
        information.textContent = 'Este navegador não oferece acesso à localização.';
        return;
      }
      locationButton.disabled = true;
      locationButton.textContent = 'Obtendo localização…';
      navigator.geolocation.getCurrentPosition(position => {
        locationButton.disabled = false;
        locationButton.textContent = '◎ Perto de mim';
        if (myGeneration !== generation || !map) return;
        const coords = [position.coords.latitude, position.coords.longitude];
        const L = window.L;
        L.circleMarker(coords, { radius: 9, color: '#13694f', fillColor: '#ffffff',
          fillOpacity: 1, weight: 3 }).addTo(map).bindPopup('Sua localização aproximada');
        map.setView(coords, 13);
      }, () => {
        locationButton.disabled = false;
        locationButton.textContent = '◎ Perto de mim';
        information.textContent = 'Não foi possível acessar sua localização. Verifique a permissão do navegador.';
      }, { enableHighAccuracy: false, maximumAge: 300000, timeout: 10000 });
    });

    function setView(value) {
      selectedView = value;
      const showMap = value === 'map';
      section.hidden = !showMap;
      resultsContainer.hidden = showMap;
      listButton.classList.toggle('is-active', !showMap);
      mapButton.classList.toggle('is-active', showMap);
      listButton.setAttribute('aria-pressed', String(!showMap));
      mapButton.setAttribute('aria-pressed', String(showMap));
      information.textContent = located.mapped + ' ocorrências localizadas em ' +
        located.points.length + ' pontos do mapa. ' +
        (located.unmapped ? located.unmapped + ' registros/locais ainda sem coordenadas verificadas. ' : '') +
        (content === 'all' ? 'Somente conteúdos com localização física aparecem no mapa.' : '');
      if (showMap) {
        requestAnimationFrame(() => {
          if (map) map.invalidateSize();
          else drawMap();
        });
      }
    }
    listButton.addEventListener('click', () => setView('list'));
    mapButton.addEventListener('click', () => setView('map'));
    setView(selectedView);
  }

  root.spaceMap = Object.freeze({ mount, clearMap, groupedPoints, mapItems, pointOf });
})();