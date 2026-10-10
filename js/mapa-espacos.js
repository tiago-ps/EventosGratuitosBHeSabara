(() => {
  "use strict";

  const root = window.MuralCultural = window.MuralCultural || {};
  const LEAFLET_JS = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js";
  const LEAFLET_CSS = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css";
  const DEFAULT_CENTER = [-19.9227, -43.9451];
  let selectedView = "list";
  let leafletPromise = null;
  let map = null;
  let generation = 0;

  function coordinatesOf(item, byId, byAddress) {
    const point = byId[item.id] || byAddress[String(item.endereco || "").trim().toLowerCase()];
    if (!point) return null;
    const lat = Number(point.latitude);
    const lon = Number(point.longitude);
    // Não utilizar coordenadas nulas, globais ou de outra região por engano.
    if (!Number.isFinite(lat) || !Number.isFinite(lon) ||
        lat < -23 || lat > -15 || lon < -52 || lon > -39) return null;
    return [lat, lon];
  }

  function groupedPoints(spaces, geo, allSpaces = spaces) {
    const byId = geo && typeof geo === "object" ? geo : {};
    const byAddress = Object.create(null);
    // Subespaços com endereço exatamente igual compartilham a localização
    // validada do equipamento; nomes semelhantes nunca são suficientes.
    for (const space of allSpaces) {
      const point = byId[space.id];
      const address = String(space.endereco || "").trim().toLowerCase();
      if (point && address && !byAddress[address]) byAddress[address] = point;
    }
    const groups = new Map();
    let unlocated = 0;
    for (const space of spaces) {
      const coords = coordinatesOf(space, byId, byAddress);
      if (!coords) { unlocated += 1; continue; }
      const key = coords.map(value => value.toFixed(6)).join(",");
      if (!groups.has(key)) groups.set(key, { coords, spaces: [] });
      groups.get(key).spaces.push(space);
    }
    return { points: Array.from(groups.values()), unlocated };
  }

  function externalUrl(value) {
    try {
      const url = new URL(String(value || ""), window.location.href);
      return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
    } catch { return ""; }
  }

  function locationLink(space) {
    const explicit = externalUrl(space.mapa);
    if (explicit) return explicit;
    const query = [space.titulo, space.endereco, space.cidade].filter(Boolean).join(", ");
    return query ? "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(query) : "";
  }

  function loadLeaflet() {
    if (window.L && window.L.map) return Promise.resolve(window.L);
    if (leafletPromise) return leafletPromise;
    leafletPromise = new Promise((resolve, reject) => {
      if (!document.querySelector('link[data-space-map-leaflet]')) {
        const stylesheet = document.createElement("link");
        stylesheet.rel = "stylesheet";
        stylesheet.href = LEAFLET_CSS;
        stylesheet.dataset.spaceMapLeaflet = "true";
        document.head.appendChild(stylesheet);
      }
      const script = document.createElement("script");
      script.src = LEAFLET_JS;
      script.async = true;
      script.onload = () => window.L ? resolve(window.L) : reject(new Error("Leaflet indisponível"));
      script.onerror = () => reject(new Error("Falha ao carregar a biblioteca de mapas"));
      document.head.appendChild(script);
    }).catch(error => { leafletPromise = null; throw error; });
    return leafletPromise;
  }

  function createPopup(L, group, toItemUrl) {
    const content = document.createElement("div");
    content.className = "agenda-space-map-popup";
    const heading = document.createElement("strong");
    heading.textContent = group.spaces.length === 1
      ? group.spaces[0].titulo : group.spaces.length + " espaços neste endereço";
    content.appendChild(heading);
    const address = document.createElement("p");
    address.textContent = group.spaces[0].endereco || group.spaces[0].cidade || "";
    content.appendChild(address);
    const list = document.createElement("ul");
    for (const space of group.spaces) {
      const entry = document.createElement("li");
      const anchor = document.createElement("a");
      const details = externalUrl(toItemUrl(space));
      anchor.href = details || locationLink(space) || "#";
      if (!details) { anchor.target = "_blank"; anchor.rel = "noopener noreferrer"; }
      anchor.textContent = space.titulo || "Espaço";
      entry.appendChild(anchor);
      list.appendChild(entry);
    }
    content.appendChild(list);
    const navigate = document.createElement("a");
    navigate.className = "agenda-space-map-directions";
    navigate.href = locationLink(group.spaces[0]);
    navigate.target = "_blank";
    navigate.rel = "noopener noreferrer";
    navigate.textContent = "Como chegar ↗";
    if (navigate.href) content.appendChild(navigate);
    return content;
  }

  function clearMap() {
    if (map) { map.remove(); map = null; }
    generation += 1;
  }

  function mount(options) {
    clearMap();
    const { shell, resultsContainer, count, spaces, allSpaces, coordinates, content,
      blocked, toItemUrl } = options;
    if (!shell || !resultsContainer || !count || blocked ||
        !["all", "spaces"].includes(content)) {
      selectedView = "list";
      return;
    }
    const located = groupedPoints(spaces, coordinates, allSpaces);
    const wrap = document.createElement("div");
    wrap.className = "agenda-map-view-toggle";
    wrap.setAttribute("role", "group");
    wrap.setAttribute("aria-label", "Visualizar espaços");
    const listButton = document.createElement("button");
    listButton.type = "button";
    listButton.textContent = "☷ Lista";
    listButton.className = "agenda-map-view-button";
    const mapButton = document.createElement("button");
    mapButton.type = "button";
    mapButton.textContent = "⌖ Mapa";
    mapButton.className = "agenda-map-view-button";
    wrap.append(listButton, mapButton);
    count.append(wrap);

    const section = document.createElement("section");
    section.className = "agenda-space-map-section";
    section.hidden = true;
    section.setAttribute("aria-label", "Mapa dos espaços culturais cadastrados");
    const information = document.createElement("p");
    information.className = "agenda-space-map-info";
    section.append(information);
    const mapHost = document.createElement("div");
    mapHost.className = "agenda-space-map-canvas";
    mapHost.setAttribute("aria-label", "Mapa interativo com os locais encontrados");
    section.append(mapHost);
    shell.insertBefore(section, resultsContainer);
    const myGeneration = generation;

    async function drawMap() {
      if (map || myGeneration !== generation) return;
      if (!located.points.length) {
        mapHost.textContent = "Os locais encontrados ainda não possuem coordenadas verificadas. Consulte os endereços na Lista.";
        mapHost.classList.add("agenda-space-map-empty");
        return;
      }
      mapHost.textContent = "Carregando mapa…";
      try {
        const L = await loadLeaflet();
        if (myGeneration !== generation || section.hidden) return;
        mapHost.textContent = "";
        map = L.map(mapHost, { scrollWheelZoom: false }).setView(DEFAULT_CENTER, 12);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
          maxZoom: 19
        }).addTo(map);
        const bounds = [];
        located.points.forEach(group => {
          const marker = L.marker(group.coords).addTo(map);
          const label = group.spaces.length === 1
            ? group.spaces[0].titulo : group.spaces.length + " espaços";
          marker.bindTooltip(label);
          marker.bindPopup(createPopup(L, group, toItemUrl), { maxWidth: 300 });
          bounds.push(group.coords);
        });
        if (bounds.length > 1) map.fitBounds(bounds, { padding: [32, 32], maxZoom: 14 });
        else map.setView(bounds[0], 15);
        requestAnimationFrame(() => map?.invalidateSize());
      } catch {
        mapHost.textContent = "Não foi possível carregar o mapa. A visualização em lista continua disponível.";
        mapHost.classList.add("agenda-space-map-empty");
      }
    }

    function setView(value) {
      selectedView = value;
      const showMap = value === "map";
      section.hidden = !showMap;
      resultsContainer.hidden = showMap;
      listButton.setAttribute("aria-pressed", String(!showMap));
      mapButton.setAttribute("aria-pressed", String(showMap));
      listButton.classList.toggle("is-active", !showMap);
      mapButton.classList.toggle("is-active", showMap);
      information.textContent = located.points.reduce((sum, group) => sum + group.spaces.length, 0) +
        " espaços localizados de " + spaces.length + " encontrados. " +
        (located.unlocated ? located.unlocated + " ainda sem coordenadas verificadas. " : "") +
        (content === "all" ? "O mapa exibe apenas os espaços; outros conteúdos aparecem na Lista." : "");
      if (showMap) {
        requestAnimationFrame(() => {
          if (map) map.invalidateSize();
          else drawMap();
        });
      }
    }

    listButton.addEventListener("click", () => setView("list"));
    mapButton.addEventListener("click", () => setView("map"));
    setView(selectedView);
  }

  root.spaceMap = Object.freeze({ mount, clearMap, groupedPoints });
})();