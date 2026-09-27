const fs = require('fs');
const assert = require('assert');

const app = fs.readFileSync('js/app.js', 'utf8');
const worker = fs.readFileSync('cloudflare/social-preview-worker.js', 'utf8');
const schema = fs.readFileSync('cloudflare/sugestoes-curadoria.sql', 'utf8');
const wrangler = JSON.parse(fs.readFileSync('wrangler.jsonc', 'utf8'));

assert(app.includes('Enviar para curadoria'));
assert(app.includes('Não pedimos nome, e-mail ou cadastro.'));
assert(app.includes("curationSuggestionApi('/api/sugestoes-curadoria')"));
assert(app.includes('itens: [...selection]'));
assert(app.includes('mensagem: textarea.value'));
assert(app.includes("window.location.hostname === 'tiago-ps.github.io'"));
assert(app.includes("'https://temsimuai.com.br'"));

assert(worker.includes("const SUGGESTION_API_PATH = '/api/sugestoes-curadoria'"));
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

assert.equal(wrangler.name, 'muralcultural');
assert.equal(wrangler.main, 'cloudflare/social-preview-worker.js');
assert.equal(wrangler.keep_vars, true);
assert.equal(wrangler.assets.directory, '.');
assert.equal(wrangler.assets.binding, 'ASSETS');
assert.equal(wrangler.observability.enabled, true);
assert.deepEqual(wrangler.assets.run_worker_first, ['/api/*', '/', '/index.html']);

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
