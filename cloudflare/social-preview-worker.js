const CONFIG_URL =
  'https://bibliotecaifmgsabara.github.io/MuralCultural/curadorias/compartilhamento.json';

class MetaContentHandler {
  constructor(value) {
    this.value = value;
  }

  element(element) {
    element.setAttribute('content', this.value);
  }
}

class LinkHrefHandler {
  constructor(value) {
    this.value = value;
  }

  element(element) {
    element.setAttribute('href', this.value);
  }
}

class TitleHandler {
  constructor(value) {
    this.value = value;
  }

  element(element) {
    element.setInnerContent(this.value);
  }
}

function absoluteUrl(baseUrl, value) {
  return new URL(String(value || ''), baseUrl).href;
}

function requestedCuration(url, config) {
  const short = String(url.searchParams.get('c') || '').trim().toLowerCase();
  if (short && config.aliases?.[short]) {
    return { id: config.aliases[short], alias: short };
  }

  const legacy = String(url.searchParams.get('curadoria') || '').trim();
  if (!legacy || !config.curadorias?.[legacy]) return null;

  const alias = Object.entries(config.aliases || {})
    .find(([, id]) => id === legacy)?.[0] || '';

  return { id: legacy, alias };
}

function socialMetadata(requestUrl, config) {
  const site = config.site || {};
  const selected = requestedCuration(requestUrl, config);
  const curation = selected ? config.curadorias?.[selected.id] : null;
  const chosen = curation || site;
  const baseUrl = site.url || 'https://temsimuai.com.br/';

  const canonical = new URL(baseUrl);
  if (curation && selected?.alias) canonical.searchParams.set('c', selected.alias);

  return {
    title: String(chosen.title || site.title || 'Tem Sim, Uai'),
    description: String(chosen.description || site.description || ''),
    image: absoluteUrl(baseUrl, chosen.image || site.image || ''),
    imageAlt: String(chosen.image_alt || site.image_alt || chosen.title || site.title || 'Tem Sim, Uai'),
    url: canonical.href
  };
}

async function loadConfig() {
  const response = await fetch(CONFIG_URL, {
    headers: { accept: 'application/json' },
    cf: { cacheEverything: true, cacheTtl: 300 }
  });
  if (!response.ok) throw new Error(`Falha ao carregar configuração social: HTTP ${response.status}`);
  return response.json();
}

function rewriteHtml(response, meta) {
  return new HTMLRewriter()
    .on('title', new TitleHandler(meta.title))
    .on('meta[name="description"]', new MetaContentHandler(meta.description))
    .on('meta[property="og:title"]', new MetaContentHandler(meta.title))
    .on('meta[property="og:description"]', new MetaContentHandler(meta.description))
    .on('meta[property="og:url"]', new MetaContentHandler(meta.url))
    .on('meta[property="og:image"]', new MetaContentHandler(meta.image))
    .on('meta[property="og:image:alt"]', new MetaContentHandler(meta.imageAlt))
    .on('meta[name="twitter:title"]', new MetaContentHandler(meta.title))
    .on('meta[name="twitter:description"]', new MetaContentHandler(meta.description))
    .on('meta[name="twitter:image"]', new MetaContentHandler(meta.image))
    .on('meta[name="twitter:image:alt"]', new MetaContentHandler(meta.imageAlt))
    .on('link[rel="canonical"]', new LinkHrefHandler(meta.url))
    .transform(response);
}

export default {
  async fetch(request) {
    const response = await fetch(request);
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) return response;

    try {
      const config = await loadConfig();
      const meta = socialMetadata(new URL(request.url), config);
      return rewriteHtml(response, meta);
    } catch (error) {
      console.warn('Preview social: usando metadados estáticos do HTML.', error);
      return response;
    }
  }
};
