const fs = require('fs');
const assert = require('assert');

const app = fs.readFileSync('js/app.js', 'utf8');
const worker = fs.readFileSync('cloudflare/social-preview-worker.js', 'utf8');
const serviceWorker = fs.readFileSync('service-worker.js', 'utf8');
const schema = fs.readFileSync('cloudflare/sugestoes-curadoria.sql', 'utf8');
const wrangler = JSON.parse(fs.readFileSync('wrangler.jsonc', 'utf8'));

assert(app.includes('Enviar para curadoria'));
assert(app.includes('Consultar sugestão'));
assert(app.includes('Acompanhar sugestão'));
assert(app.includes("/api/sugestoes-curadoria/status?protocolo="));
assert(app.includes('Não pedimos nome, e-mail ou cadastro.'));
assert(app.includes("curationSuggestionApi('/api/sugestoes-curadoria')"));
assert(app.includes('itens: [...selection]'));
assert(app.includes('mensagem: textarea.value'));
assert(app.includes("window.location.hostname === 'tiago-ps.github.io'"));
assert(app.includes("'https://temsimuai.com.br'"));

assert(worker.includes("const SUGGESTION_API_PATH = '/api/sugestoes-curadoria'"));
assert(worker.includes("const SUGGESTION_STATUS_PATH = '/api/sugestoes-curadoria/status'"));
assert(worker.includes('handleSuggestionStatus(request, env)'));
assert(worker.includes('CURADORIA_ADMIN_TOKEN'));
assert(worker.includes('SUGESTOES_DAILY_LIMIT'));
assert(worker.includes('TURNSTILE_SECRET'));
assert(worker.includes("form.append('response', String(token))"));
assert(worker.includes("'https://tiago-ps.github.io'"));
assert(worker.includes("'Access-Control-Allow-Origin'"));
assert(worker.includes("request.method === 'OPTIONS'"));
assert(!worker.includes("form.append('remoteip'"));
assert(!worker.includes("CF-Connecting-IP"));
assert(worker.includes('env.ASSETS.fetch(request)'));
const publicStatusStart = worker.indexOf('async function handleSuggestionStatus');
const publicStatusEnd = worker.indexOf('async function handleSuggestionPost');
assert(publicStatusStart > 0 && publicStatusEnd > publicStatusStart);
const publicStatusHandler = worker.slice(publicStatusStart, publicStatusEnd);
assert(publicStatusHandler.includes('SELECT protocolo, criado_em, atualizado_em, status'));
for (const forbidden of ['mensagem', 'itens_json', 'quantidade']) {
  assert(!publicStatusHandler.includes(forbidden), `consulta pública não deve expor ${forbidden}`);
}
assert(serviceWorker.includes("if (url.pathname.startsWith('/api/')) return;"));
assert(serviceWorker.indexOf("if (url.pathname.startsWith('/api/')) return;") < serviceWorker.indexOf("if (request.mode === 'navigate')"));

assert.equal(wrangler.name, 'muralcultural');
assert.equal(wrangler.main, 'cloudflare/social-preview-worker.js');
assert.equal(wrangler.keep_vars, true);
assert.equal(wrangler.assets.directory, '.');
assert.equal(wrangler.assets.binding, 'ASSETS');
assert.equal(wrangler.observability.enabled, true);
assert.deepEqual(wrangler.assets.run_worker_first, ['/api/*', '/', '/index.html']);
assert.equal(wrangler.d1_databases.length, 1);
assert.equal(wrangler.d1_databases[0].binding, 'SUGESTOES_DB');
assert.equal(wrangler.d1_databases[0].database_name, 'mural-sugestoes-curadoria');
assert.equal(wrangler.d1_databases[0].database_id, '32bc6d5f-4750-452a-bb5e-0a90878fc15a');

for (const forbidden of ['ip ', 'user_agent', 'user-agent', 'fingerprint', 'email', 'telefone']) {
  assert(!schema.toLowerCase().includes(forbidden), `schema não deve conter ${forbidden}`);
}
assert(schema.includes('itens_json'));
assert(schema.includes('protocolo'));
assert(schema.includes('status'));

const assetsIgnore = fs.readFileSync('.assetsignore', 'utf8');
for (const required of ['.github/**', 'cloudflare/**', '*.py', 'README*', '.wrangler/**']) {
  assert(assetsIgnore.includes(required), `.assetsignore deve preservar ${required}`);
}

console.log('Fluxo anônimo de sugestões validado.');
