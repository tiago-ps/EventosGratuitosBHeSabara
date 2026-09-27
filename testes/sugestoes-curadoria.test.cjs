const fs = require('fs');
const assert = require('assert');

const app = fs.readFileSync('js/app.js', 'utf8');
const worker = fs.readFileSync('cloudflare/social-preview-worker.js', 'utf8');
const schema = fs.readFileSync('cloudflare/sugestoes-curadoria.sql', 'utf8');

assert(app.includes('Enviar para curadoria'));
assert(app.includes('Não pedimos nome, e-mail ou cadastro.'));
assert(app.includes("fetch('/api/sugestoes-curadoria'"));
assert(app.includes('itens: [...selection]'));
assert(app.includes('mensagem: textarea.value'));

assert(worker.includes("const SUGGESTION_API_PATH = '/api/sugestoes-curadoria'"));
assert(worker.includes('CURADORIA_ADMIN_TOKEN'));
assert(worker.includes('SUGESTOES_DAILY_LIMIT'));
assert(worker.includes('TURNSTILE_SECRET'));
assert(worker.includes("form.append('response', String(token))"));
assert(!worker.includes("form.append('remoteip'"));
assert(!worker.includes("CF-Connecting-IP"));

for (const forbidden of ['ip ', 'user_agent', 'user-agent', 'fingerprint', 'email', 'telefone']) {
  assert(!schema.toLowerCase().includes(forbidden), `schema não deve conter ${forbidden}`);
}
assert(schema.includes('itens_json'));
assert(schema.includes('protocolo'));
assert(schema.includes('status'));

console.log('Fluxo anônimo de sugestões validado.');
