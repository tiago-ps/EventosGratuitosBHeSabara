const fs = require('fs');
const assert = require('assert');

const analytics = fs.readFileSync('js/metricas-pontos.js', 'utf8');
const worker = fs.readFileSync('cloudflare/social-preview-worker.js', 'utf8');
const schema = fs.readFileSync('cloudflare/metricas-gerais.sql', 'utf8');
const indexHtml = fs.readFileSync('index.html', 'utf8');
const serviceWorker = fs.readFileSync('service-worker.js', 'utf8');

assert(analytics.includes("const GENERAL_STORAGE_KEY = 'mural:audiencia-geral-v1'"));
assert(analytics.includes("fetch(apiUrl('/api/metricas-gerais')"));
assert(analytics.includes("newGeneralState('direto', 'direto')"));
assert(analytics.includes("newGeneralState('canal', incomingChannel)"));
assert(analytics.includes("newGeneralState('ponto', incomingPoint)"));
assert(analytics.includes("pageUrl.searchParams.get('canal')"));
assert(analytics.includes("pageUrl.searchParams.get('origem')"));
assert(analytics.includes('physicalPanelPoint'));
assert(analytics.includes('Uma instalação física não é audiência do site'));
assert(analytics.includes("'sessao_ativa'"));
assert(analytics.includes("'visualizacao_conteudo'"));
assert(analytics.includes("credentials: 'omit'"));
assert(analytics.includes('sessionStorage'));
assert(!analytics.includes('localStorage.setItem'));
assert(!analytics.toLowerCase().includes('fingerprint'));

assert(worker.includes("const GENERAL_USAGE_API_PATH = '/api/metricas-gerais'"));
assert(worker.includes("const GENERAL_USAGE_ADMIN_PATH = '/api/metricas-gerais/admin'"));
assert(worker.includes('metricas_gerais_diarias'));
assert(worker.includes('handleGeneralUsagePost(request, env)'));
assert(worker.includes('handleGeneralUsageAdmin(request, env)'));
assert(worker.includes('handleGeneralUsageApi(request, env)'));
assert(worker.includes("GENERAL_USAGE_SOURCE_TYPES = new Set(['direto', 'canal', 'ponto'])"));
assert(worker.includes('const generalUsageResponse = await handleGeneralUsageApi(request, env)'));

for (const forbidden of ['ip ', 'user_agent', 'user-agent', 'fingerprint', 'visitante_id', 'usuario_id', 'session_id']) {
  assert(!schema.toLowerCase().includes(forbidden));
}

assert(schema.includes("origem_tipo TEXT NOT NULL CHECK (origem_tipo IN ('direto', 'canal', 'ponto'))"));
assert(schema.includes('PRIMARY KEY ('));
assert(indexHtml.includes('js/metricas-pontos.js?v=3'));
assert(serviceWorker.includes('./js/metricas-pontos.js?v=3'));
assert(serviceWorker.includes("mural-cultural-v211-audiencia-geral"));

console.log('Métricas anônimas de audiência geral validadas.');
