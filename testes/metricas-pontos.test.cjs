const fs = require('fs');
const assert = require('assert');

const analytics = fs.readFileSync('js/metricas-pontos.js', 'utf8');
const worker = fs.readFileSync('cloudflare/social-preview-worker.js', 'utf8');
const schema = fs.readFileSync('cloudflare/metricas-pontos.sql', 'utf8');
const app = fs.readFileSync('js/app.js', 'utf8');
const indexHtml = fs.readFileSync('index.html', 'utf8');
const serviceWorker = fs.readFileSync('service-worker.js', 'utf8');
const wrangler = JSON.parse(fs.readFileSync('wrangler.jsonc', 'utf8'));

assert(analytics.includes('sessionStorage.getItem(STORAGE_KEY)'));
assert(analytics.includes("url.searchParams.delete('origem')"));
assert(analytics.includes("'entrada'"));
assert(analytics.includes("'sessao_ativa'"));
assert(analytics.includes("'visualizacao_conteudo'"));
assert(analytics.includes('IntersectionObserver'));
assert(analytics.includes("pageUrl.searchParams.get('ponto')"));
assert(analytics.includes("pageUrl.searchParams.get('painel')"));
assert(analytics.includes("'/api/metricas-pontos/painel'"));
assert(analytics.includes("document.visibilityState !== 'visible'"));
assert(analytics.includes('PANEL_HEARTBEAT_MS = 60 * 1000'));
assert(analytics.includes("credentials: 'omit'"));

for (const forbidden of ['localStorage.setItem(STORAGE_KEY)', 'fingerprint', 'user-agent', 'user_agent']) {
  assert(!analytics.toLowerCase().includes(forbidden.toLowerCase()));
}

assert(worker.includes("const POINT_METRICS_API_PATH = '/api/metricas-pontos'"));
assert(worker.includes("const POINT_PANEL_API_PATH = '/api/metricas-pontos/painel'"));
assert(worker.includes("const POINT_QR_PREFIX = '/q/'"));
assert(worker.includes('handlePointQrRedirect(request)'));
assert(worker.includes('handlePointMetricsApi(request, env)'));
assert(worker.includes('metricas_pontos_diarias'));
assert(worker.includes('exposicao_paineis_horaria'));
assert(worker.includes('handlePointPanelHeartbeat(request, env)'));
assert(worker.includes('minutos_00_29 = minutos_00_29 | excluded.minutos_00_29'));
assert(worker.includes('exposicao: exposureRows'));
assert(worker.includes("action === 'visualizacao_conteudo'"));
assert(!worker.includes('CF-Connecting-IP'));

for (const forbidden of ['ip ', 'user_agent', 'user-agent', 'fingerprint', 'visitante_id', 'usuario_id', 'session_id']) {
  assert(!schema.toLowerCase().includes(forbidden));
}

assert(schema.includes('PRIMARY KEY (dia, ambiente, ponto, acao, tipo_conteudo, conteudo_id)'));
assert(schema.includes('PRIMARY KEY (dia, hora, ambiente, ponto, painel)'));
assert(schema.includes('minutos_00_29 INTEGER'));
assert(schema.includes('minutos_30_59 INTEGER'));
assert(app.includes("url.searchParams.get('ponto')"));
assert(app.includes("url.searchParams.set('origem', point)"));
assert(app.includes('article.dataset.muralContentId = favoriteId'));
assert(indexHtml.includes('js/metricas-pontos.js?v=2'));
assert(serviceWorker.includes('./js/metricas-pontos.js?v=2'));
assert(wrangler.assets.run_worker_first.includes('/q/*'));

console.log('Métricas anônimas por ponto de divulgação validadas.');
