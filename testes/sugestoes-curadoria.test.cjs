const fs = require('fs');
const assert = require('assert');

const app = fs.readFileSync('js/app.js', 'utf8');
const worker = fs.readFileSync('cloudflare/social-preview-worker.js', 'utf8');
const serviceWorker = fs.readFileSync('service-worker.js', 'utf8');
const panelActions = fs.readFileSync('js/painel-acoes-contextuais.js', 'utf8');
const panelNavigation = fs.readFileSync('js/painel-navegacao-modos.js', 'utf8');
const styles = fs.readFileSync('css/styles.css', 'utf8');
const schema = fs.readFileSync('cloudflare/sugestoes-curadoria.sql', 'utf8');
const wrangler = JSON.parse(fs.readFileSync('wrangler.jsonc', 'utf8'));

assert(app.includes('Enviar para curadoria'));
assert(app.includes('Consultar contribuição'));
assert(app.includes('Acompanhar sugestão'));
assert(app.includes("protocol.startsWith('CON-')"));
assert(app.includes("'/api/sugestoes-curadoria/status'"));
assert(app.includes("'/api/contribuicoes-comunidade/status'"));
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


assert(worker.includes("const CONTRIBUTION_API_PATH = '/api/contribuicoes-comunidade'"));
assert(worker.includes("const CONTRIBUTION_STATUS_PATH = '/api/contribuicoes-comunidade/status'"));
assert(worker.includes("const CONTRIBUTION_ADMIN_PATH = '/api/contribuicoes-comunidade/admin'"));
assert(worker.includes("sugerir_evento"));
assert(worker.includes("corrigir_informacao"));
assert(worker.includes("contribuir_mural"));
assert(worker.includes("CON-"));
assert(worker.includes("contribuicoes_comunidade"));
assert(worker.includes("atividade_lazer"));
assert(worker.includes("handleCommunityContributionApi(request, env)"));

const contributionSchema = fs.readFileSync('cloudflare/contribuicoes-comunidade.sql', 'utf8');
assert(contributionSchema.includes('CREATE TABLE IF NOT EXISTS contribuicoes_comunidade'));
assert(contributionSchema.includes("CHECK (tipo IN ('sugerir_evento', 'corrigir_informacao'))"));
for (const forbidden of ['ip ', 'user_agent', 'user-agent', 'fingerprint', 'email', 'telefone']) {
  assert(!contributionSchema.toLowerCase().includes(forbidden), `schema de contribuições não deve conter ${forbidden}`);
}

assert(app.includes('Contribua com o Mural'));
assert(app.includes('Sugerir um evento'));
assert(app.includes('Corrigir informação'));
assert(app.includes("openCommunityContributionForm('corrigir_informacao'"));
assert(app.includes("action: 'contribuir_mural'"));
assert(app.includes('/api/contribuicoes-comunidade'));
assert(app.includes("protocol.startsWith('CON-')"));
assert(app.includes('SUG-XXXX-XXXX ou CON-XXXX-XXXX'));

assert(app.includes('window.openMuralCommunityCorrection'));
assert(app.includes('slide.dataset.communityItemId'));
assert(app.includes('slide.dataset.communityItemTitle'));
assert(panelActions.includes('panel-community-correction'));
assert(panelActions.includes('Corrigir informação'));
assert(panelActions.includes('window.openMuralCommunityCorrection'));


assert(app.includes('function clearSharedAgendaSelectionUrl()'));
assert(app.includes('function exitSharedAgendaSelection()'));
assert(app.includes("url.searchParams.delete('selecao')"));
assert(app.includes("url.searchParams.delete('modo')"));
assert(app.includes("history.replaceState(history.state, '', url)"));
assert(panelNavigation.includes("url.searchParams.delete('selecao')"));
assert(panelNavigation.includes("url.searchParams.set('modo', mode)"));


assert(styles.includes('body.agenda-mode.curation-mode.agenda-theme-light'));
assert(styles.includes('body.agenda-mode.curation-mode.agenda-theme-dark'));
assert(styles.includes('--curation-accent: #f0b429'));
assert(styles.includes('radial-gradient(circle at 12% 0%'));
assert(styles.includes('body.agenda-mode.curation-mode .agenda-header'));
assert(styles.includes('body.agenda-mode.curation-mode .agenda-tools'));
assert(styles.includes('body.agenda-mode.curation-mode .agenda-card'));
