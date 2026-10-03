
const SUGGESTION_API_PATH = '/api/sugestoes-curadoria';
const SUGGESTION_STATUS_PATH = '/api/sugestoes-curadoria/status';
const SUGGESTION_ADMIN_PATH = '/api/sugestoes-curadoria/admin';
const SUGGESTION_STATUSES = new Set(['recebido', 'em_analise', 'aproveitado', 'descartado']);
const PUBLIC_SUGGESTION_STATUS_LABELS = {
  recebido: 'Recebida',
  em_analise: 'Em análise',
  aproveitado: 'Aproveitada',
  descartado: 'Não aproveitada'
};
const SUGGESTION_ITEM_RE = /^(evento|livro|curso|concurso|filme|utilidade_publica|atividade_lazer):[^\s:][^\s]{0,260}$/u;

const CONTRIBUTION_API_PATH = '/api/contribuicoes-comunidade';
const CONTRIBUTION_STATUS_PATH = '/api/contribuicoes-comunidade/status';
const CONTRIBUTION_ADMIN_PATH = '/api/contribuicoes-comunidade/admin';
const CONTRIBUTION_TYPES = new Set(['sugerir_evento', 'corrigir_informacao']);
const CONTRIBUTION_TYPE_LABELS = {
  sugerir_evento: 'Sugestão de evento',
  corrigir_informacao: 'Correção de informação'
};

const SHARED_SELECTION_API_PATH = '/api/selecoes-compartilhadas';
const SHARED_SELECTION_SHORT_PREFIX = '/s/';
const SHARED_SELECTION_CONTEXTS = new Set(['mural', 'curadoria_livros']);
const SHARED_SELECTION_CODE_RE = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{7}$/;
const SHARED_SELECTION_PUBLIC_BASE = 'https://temsimuai.com.br/';
const SHARED_SELECTION_CURATION_BASE = 'https://tiago-ps.github.io/EventosGratuitosBHeSabara/';

const POINT_METRICS_API_PATH = '/api/metricas-pontos';
const POINT_PANEL_API_PATH = '/api/metricas-pontos/painel';
const POINT_METRICS_ADMIN_PATH = '/api/metricas-pontos/admin';
const POINT_QR_PREFIX = '/q/';
const POINT_SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const POINT_METRIC_ACTIONS = new Set(['entrada', 'sessao_ativa', 'visualizacao_conteudo']);
const POINT_METRIC_ENVIRONMENTS = new Set(['publico', 'teste']);
const POINT_METRIC_CONTENT_TYPE_RE = /^[a-z0-9_]+$/;

const NOTIFICATION_API_PATH = '/api/notificacoes';
const NOTIFICATION_CONFIG_PATH = '/api/notificacoes/config';
const NOTIFICATION_ALLOWED_PUSH_HOSTS = new Set([
  'fcm.googleapis.com',
  'updates.push.services.mozilla.com',
  'web.push.apple.com'
]);

function suggestionCorsOrigin(request, env) {
  const origin = String(request.headers.get('origin') || '').trim();
  if (!origin) return '';
  const configured = String(env.SUGESTOES_ALLOWED_ORIGINS || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  const allowed = new Set([
    'https://temsimuai.com.br',
    'https://www.temsimuai.com.br',
    'https://tiago-ps.github.io',
    ...configured
  ]);
  return allowed.has(origin) ? origin : '';
}

function withSuggestionCors(request, env, response) {
  const origin = suggestionCorsOrigin(request, env);
  if (!origin) return response;
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  headers.set('Access-Control-Max-Age', '86400');
  headers.append('Vary', 'Origin');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function jsonResponse(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers
    }
  });
}

function normalizeMessage(value) {
  const text = String(value || '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();
  if (text.length > 1200) throw new Error('mensagem_longa');
  return text;
}

function normalizeSuggestionItems(raw) {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 500) {
    throw new Error('itens_invalidos');
  }
  const unique = [];
  const seen = new Set();
  for (const value of raw) {
    const item = String(value || '').trim();
    if (!SUGGESTION_ITEM_RE.test(item)) throw new Error('itens_invalidos');
    if (!seen.has(item)) {
      seen.add(item);
      unique.push(item);
    }
  }
  if (!unique.length) throw new Error('itens_invalidos');
  return unique;
}

function normalizeSharedSelectionContext(value) {
  const context = String(value || '').trim().toLowerCase();
  if (!SHARED_SELECTION_CONTEXTS.has(context)) throw new Error('contexto_invalido');
  return context;
}

function sharedSelectionCode() {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const bytes = new Uint8Array(7);
  crypto.getRandomValues(bytes);
  return [...bytes].map(value => alphabet[value % alphabet.length]).join('');
}

async function sharedSelectionHash(context, items) {
  const canonical = [context, ...[...items].sort()].join('\n');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
}

async function sharedSelectionsTableAvailable(env) {
  if (!env.SUGESTOES_DB) return false;
  try {
    await env.SUGESTOES_DB.prepare('SELECT 1 FROM selecoes_compartilhadas LIMIT 1').first();
    return true;
  } catch {
    return false;
  }
}

async function countSharedSelectionsToday(env) {
  const row = await env.SUGESTOES_DB
    .prepare("SELECT COUNT(*) AS total FROM selecoes_compartilhadas WHERE criado_em >= datetime('now','start of day')")
    .first();
  return Number(row?.total || 0);
}

async function sharedSelectionRow(env, code) {
  return env.SUGESTOES_DB.prepare(
    'SELECT codigo, contexto, criado_em, itens_json, quantidade, schema_version FROM selecoes_compartilhadas WHERE codigo = ? LIMIT 1'
  ).bind(code).first();
}

function sharedSelectionItemsFromRow(row) {
  try {
    const parsed = JSON.parse(row?.itens_json || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function insertOrReuseSharedSelection(env, context, items) {
  const hash = await sharedSelectionHash(context, items);
  const existing = await env.SUGESTOES_DB.prepare(
    'SELECT codigo FROM selecoes_compartilhadas WHERE contexto = ? AND hash_selecao = ? LIMIT 1'
  ).bind(context, hash).first();
  if (existing?.codigo) return String(existing.codigo);

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = sharedSelectionCode();
    try {
      await env.SUGESTOES_DB.prepare(
        `INSERT INTO selecoes_compartilhadas
          (codigo, criado_em, contexto, itens_json, quantidade, hash_selecao, schema_version)
         VALUES (?, datetime('now'), ?, ?, ?, ?, 1)`
      ).bind(code, context, JSON.stringify([...items].sort()), items.length, hash).run();
      return code;
    } catch (error) {
      const message = String(error?.message || error).toLowerCase();
      if (message.includes('hash_selecao') || message.includes('idx_selecoes_compartilhadas_contexto_hash')) {
        const reused = await env.SUGESTOES_DB.prepare(
          'SELECT codigo FROM selecoes_compartilhadas WHERE contexto = ? AND hash_selecao = ? LIMIT 1'
        ).bind(context, hash).first();
        if (reused?.codigo) return String(reused.codigo);
      }
      if (!message.includes('unique')) throw error;
    }
  }
  throw new Error('codigo_indisponivel');
}

async function handleSharedSelectionPost(request, env) {
  if (!(await sharedSelectionsTableAvailable(env))) {
    return jsonResponse({ erro: 'Os links curtos estão temporariamente indisponíveis.' }, 503);
  }
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > 32 * 1024) {
    return jsonResponse({ erro: 'A seleção excede o limite permitido.' }, 413);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ erro: 'Seleção inválida.' }, 400);
  }

  let items;
  let context;
  try {
    items = normalizeSuggestionItems(body?.itens);
    context = normalizeSharedSelectionContext(body?.contexto);
  } catch {
    return jsonResponse({ erro: 'Seleção inválida.' }, 422);
  }

  const dailyLimit = Math.max(1, Number(env.SELECOES_COMPARTILHADAS_DAILY_LIMIT || 3000));
  if ((await countSharedSelectionsToday(env)) >= dailyLimit) {
    return jsonResponse({
      erro: 'Não foi possível criar um novo link curto agora. Tente novamente mais tarde.',
      codigo: 'LIMITE_DIARIO'
    }, 429);
  }

  const code = await insertOrReuseSharedSelection(env, context, items);
  return jsonResponse({
    ok: true,
    codigo: code,
    contexto: context,
    quantidade: items.length,
    url: new URL(`s/${code}`, SHARED_SELECTION_PUBLIC_BASE).href
  }, 201);
}

async function handleSharedSelectionGet(code, env) {
  if (!(await sharedSelectionsTableAvailable(env))) {
    return jsonResponse({ erro: 'Os links curtos estão temporariamente indisponíveis.' }, 503);
  }
  const row = await sharedSelectionRow(env, code);
  if (!row) return jsonResponse({ erro: 'Seleção não encontrada.' }, 404);
  const items = sharedSelectionItemsFromRow(row);
  return jsonResponse({
    codigo: String(row.codigo),
    contexto: String(row.contexto),
    quantidade: Number(row.quantidade || items.length),
    itens: items,
    schema_version: Number(row.schema_version || 1)
  });
}

async function handleSharedSelectionApi(request, env) {
  const url = new URL(request.url);
  const isCollection = url.pathname === SHARED_SELECTION_API_PATH;
  const codeMatch = url.pathname.match(/^\/api\/selecoes-compartilhadas\/([23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{7})$/);

  if ((isCollection || codeMatch) && request.method === 'OPTIONS') {
    return withSuggestionCors(request, env, new Response(null, {
      status: 204,
      headers: {'cache-control': 'no-store'}
    }));
  }
  if (isCollection && request.method === 'POST') {
    return withSuggestionCors(request, env, await handleSharedSelectionPost(request, env));
  }
  if (codeMatch && request.method === 'GET') {
    return withSuggestionCors(request, env, await handleSharedSelectionGet(codeMatch[1], env));
  }
  return null;
}

async function handleSharedSelectionShortLink(request, env) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null;
  const url = new URL(request.url);
  const match = url.pathname.match(/^\/s\/([23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{7})\/?$/);
  if (!match) return null;
  const code = match[1];

  if (!(await sharedSelectionsTableAvailable(env))) {
    return Response.redirect(SHARED_SELECTION_PUBLIC_BASE, 302);
  }
  const row = await sharedSelectionRow(env, code);
  if (!row) return Response.redirect(SHARED_SELECTION_PUBLIC_BASE, 302);

  if (String(row.contexto) === 'curadoria_livros') {
    const target = new URL(SHARED_SELECTION_CURATION_BASE);
    target.searchParams.set('modo', 'curadoria');
    target.searchParams.set('conteudo', 'livros');
    target.searchParams.set('lista', code);
    return Response.redirect(target.href, 302);
  }

  const indexUrl = new URL('/index.html', request.url);
  const assetRequest = new Request(indexUrl.href, request);
  const response = await env.ASSETS.fetch(assetRequest);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  const quantity = Number(row.quantidade || 0);
  return rewriteHtml(response, {
    title: 'Seleção compartilhada — Tem Sim, Uai',
    description: quantity === 1
      ? 'Uma indicação compartilhada no Tem Sim, Uai.'
      : `${quantity} indicações compartilhadas no Tem Sim, Uai.`,
    image: new URL('imagens/marca/logo-mural-cultural.png', SHARED_SELECTION_PUBLIC_BASE).href,
    imageAlt: 'Tem Sim, Uai',
    url: new URL(`s/${code}`, SHARED_SELECTION_PUBLIC_BASE).href
  });
}

function protocolCode() {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const token = [...bytes].map(value => alphabet[value % alphabet.length]).join('');
  return `SUG-${token.slice(0, 4)}-${token.slice(4)}`;
}

async function verifyTurnstile(token, env, expectedAction = 'sugerir_curadoria') {
  const secret = String(env.TURNSTILE_SECRET || '').trim();
  if (!secret) return true;
  if (!token) return false;
  const form = new FormData();
  form.append('secret', secret);
  form.append('response', String(token));
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: form
  });
  if (!response.ok) return false;
  const result = await response.json();
  if (result.success !== true) return false;
  if (result.action && result.action !== expectedAction) return false;
  const expectedHost = String(env.PUBLIC_HOSTNAME || '').trim().toLowerCase();
  if (expectedHost && String(result.hostname || '').toLowerCase() !== expectedHost) return false;
  return true;
}

function adminAuthorized(request, env) {
  const expected = String(env.CURADORIA_ADMIN_TOKEN || '').trim();
  if (!expected) return false;
  const supplied = String(request.headers.get('authorization') || '');
  return supplied === `Bearer ${expected}`;
}

async function countToday(env) {
  const row = await env.SUGESTOES_DB
    .prepare("SELECT COUNT(*) AS total FROM curadoria_sugestoes WHERE criado_em >= datetime('now','start of day')")
    .first();
  return Number(row?.total || 0);
}

async function insertSuggestion(env, items, message) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const protocol = protocolCode();
    try {
      await env.SUGESTOES_DB.prepare(
        `INSERT INTO curadoria_sugestoes
          (protocolo, criado_em, status, mensagem, itens_json, quantidade, schema_version)
         VALUES (?, datetime('now'), 'recebido', ?, ?, ?, 1)`
      ).bind(protocol, message, JSON.stringify(items), items.length).run();
      return protocol;
    } catch (error) {
      if (!String(error?.message || error).toLowerCase().includes('unique')) throw error;
    }
  }
  throw new Error('protocolo_indisponivel');
}

async function handleSuggestionConfig(env) {
  return jsonResponse({
    disponivel: Boolean(env.SUGESTOES_DB),
    turnstile_site_key: String(env.TURNSTILE_SITE_KEY || '').trim(),
    mensagem_max: 1200,
    itens_max: 500
  });
}

function sqliteUtcToIso(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(text)) {
    return text.replace(' ', 'T') + 'Z';
  }
  return text;
}

async function handleSuggestionStatus(request, env) {
  if (!env.SUGESTOES_DB) {
    return jsonResponse({ erro: 'A consulta de sugestões está temporariamente indisponível.' }, 503);
  }
  const url = new URL(request.url);
  const protocol = String(url.searchParams.get('protocolo') || '').trim().toUpperCase();
  if (!/^SUG-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(protocol)) {
    return jsonResponse({ erro: 'Protocolo não encontrado.' }, 404);
  }

  const row = await env.SUGESTOES_DB.prepare(
    'SELECT protocolo, criado_em, atualizado_em, status FROM curadoria_sugestoes WHERE protocolo = ? LIMIT 1'
  ).bind(protocol).first();

  if (!row) return jsonResponse({ erro: 'Protocolo não encontrado.' }, 404);

  const status = SUGGESTION_STATUSES.has(String(row.status)) ? String(row.status) : 'recebido';
  return jsonResponse({
    protocolo: String(row.protocolo || protocol),
    status,
    status_label: PUBLIC_SUGGESTION_STATUS_LABELS[status] || 'Recebida',
    criado_em: sqliteUtcToIso(row.criado_em),
    atualizado_em: sqliteUtcToIso(row.atualizado_em)
  });
}

async function handleSuggestionPost(request, env) {
  if (!env.SUGESTOES_DB) {
    return jsonResponse({ erro: 'O envio à curadoria está temporariamente indisponível.' }, 503);
  }
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > 32 * 1024) {
    return jsonResponse({ erro: 'A sugestão excede o limite permitido.' }, 413);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ erro: 'Sugestão inválida.' }, 400);
  }

  let items;
  let message;
  try {
    items = normalizeSuggestionItems(body?.itens);
    message = normalizeMessage(body?.mensagem);
  } catch (error) {
    const key = String(error?.message || '');
    return jsonResponse({
      erro: key === 'mensagem_longa'
        ? 'A mensagem opcional pode ter no máximo 1200 caracteres.'
        : 'A seleção enviada está inválida.'
    }, 422);
  }

  if (!(await verifyTurnstile(body?.turnstile_token, env))) {
    return jsonResponse({ erro: 'Não foi possível confirmar o envio. Tente novamente.' }, 403);
  }

  const dailyLimit = Math.max(1, Number(env.SUGESTOES_DAILY_LIMIT || 500));
  if ((await countToday(env)) >= dailyLimit) {
    return jsonResponse({
      erro: 'Ficamos muito felizes por você se dispor a ajudar, mas hoje tivemos muitas contribuições e excedemos nosso limite de processamento. Não desista de nós. Volte amanhã e contribua com o projeto.',
      codigo: 'LIMITE_DIARIO'
    }, 429);
  }

  const protocol = await insertSuggestion(env, items, message);
  return jsonResponse({
    ok: true,
    protocolo: protocol,
    quantidade: items.length,
    mensagem: 'Sugestão enviada para a curadoria.'
  }, 201);
}

async function handleSuggestionAdminList(request, env) {
  if (!env.SUGESTOES_DB) return jsonResponse({ erro: 'Base de sugestões não configurada.' }, 503);
  if (!adminAuthorized(request, env)) return jsonResponse({ erro: 'Não autorizado.' }, 401);

  const url = new URL(request.url);
  const status = String(url.searchParams.get('status') || '').trim();
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limite') || 50)));
  if (status && !SUGGESTION_STATUSES.has(status)) {
    return jsonResponse({ erro: 'Status inválido.' }, 422);
  }

  const statement = status
    ? env.SUGESTOES_DB.prepare(
        'SELECT id, protocolo, criado_em, status, mensagem, itens_json, quantidade, schema_version FROM curadoria_sugestoes WHERE status = ? ORDER BY id DESC LIMIT ?'
      ).bind(status, limit)
    : env.SUGESTOES_DB.prepare(
        'SELECT id, protocolo, criado_em, status, mensagem, itens_json, quantidade, schema_version FROM curadoria_sugestoes ORDER BY id DESC LIMIT ?'
      ).bind(limit);
  const result = await statement.all();
  const sugestoes = (result.results || []).map(row => ({
    protocolo: row.protocolo,
    criado_em: row.criado_em,
    status: row.status,
    mensagem: row.mensagem || '',
    quantidade: Number(row.quantidade || 0),
    schema_version: Number(row.schema_version || 1),
    itens: (() => {
      try {
        const parsed = JSON.parse(row.itens_json || '[]');
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    })()
  }));
  return jsonResponse({ sugestoes, total: sugestoes.length });
}

async function handleSuggestionAdminUpdate(request, env, protocol) {
  if (!env.SUGESTOES_DB) return jsonResponse({ erro: 'Base de sugestões não configurada.' }, 503);
  if (!adminAuthorized(request, env)) return jsonResponse({ erro: 'Não autorizado.' }, 401);
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ erro: 'Solicitação inválida.' }, 400);
  }
  const status = String(body?.status || '').trim();
  if (!SUGGESTION_STATUSES.has(status)) return jsonResponse({ erro: 'Status inválido.' }, 422);
  const result = await env.SUGESTOES_DB.prepare(
    'UPDATE curadoria_sugestoes SET status = ?, atualizado_em = datetime(\'now\') WHERE protocolo = ?'
  ).bind(status, protocol).run();
  if (!Number(result.meta?.changes || 0)) return jsonResponse({ erro: 'Sugestão não encontrada.' }, 404);
  return jsonResponse({ ok: true, protocolo: protocol, status });
}

async function handleSuggestionApi(request, env) {
  const url = new URL(request.url);
  const publicApi = url.pathname === SUGGESTION_API_PATH
    || url.pathname === `${SUGGESTION_API_PATH}/config`
    || url.pathname === SUGGESTION_STATUS_PATH;

  if (publicApi && request.method === 'OPTIONS') {
    return withSuggestionCors(request, env, new Response(null, {
      status: 204,
      headers: {'cache-control': 'no-store'}
    }));
  }
  if (url.pathname === `${SUGGESTION_API_PATH}/config` && request.method === 'GET') {
    return withSuggestionCors(request, env, await handleSuggestionConfig(env));
  }
  if (url.pathname === SUGGESTION_STATUS_PATH && request.method === 'GET') {
    return withSuggestionCors(request, env, await handleSuggestionStatus(request, env));
  }
  if (url.pathname === SUGGESTION_API_PATH && request.method === 'POST') {
    return withSuggestionCors(request, env, await handleSuggestionPost(request, env));
  }
  if (url.pathname === SUGGESTION_ADMIN_PATH && request.method === 'GET') {
    return handleSuggestionAdminList(request, env);
  }
  if (url.pathname.startsWith(`${SUGGESTION_ADMIN_PATH}/`) && request.method === 'PATCH') {
    const protocol = decodeURIComponent(url.pathname.slice(SUGGESTION_ADMIN_PATH.length + 1));
    if (!/^SUG-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(protocol)) {
      return jsonResponse({ erro: 'Protocolo inválido.' }, 422);
    }
    return handleSuggestionAdminUpdate(request, env, protocol);
  }
  return null;
}


function contributionProtocolCode() {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const token = [...bytes].map(value => alphabet[value % alphabet.length]).join('');
  return `CON-${token.slice(0, 4)}-${token.slice(4)}`;
}

function normalizeShortText(value, max = 180) {
  const text = String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length > max) throw new Error('campo_longo');
  return text;
}

function normalizeOptionalUrl(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  let parsed;
  try {
    parsed = new URL(text);
  } catch {
    throw new Error('url_invalida');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('url_invalida');
  if (text.length > 1200) throw new Error('url_invalida');
  return parsed.href;
}

function normalizeContributionPayload(type, raw) {
  const payload = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  if (type === 'sugerir_evento') {
    const titulo = normalizeShortText(payload.titulo, 180);
    const cidade = normalizeShortText(payload.cidade, 120);
    const data = normalizeShortText(payload.data, 120);
    const link_referencia = normalizeOptionalUrl(payload.link_referencia);
    const observacao = normalizeMessage(payload.observacao);
    if (titulo.length < 2) throw new Error('titulo_obrigatorio');
    if (!link_referencia && observacao.length < 10) throw new Error('referencia_obrigatoria');
    return { titulo, cidade, data, link_referencia, observacao };
  }
  if (type === 'corrigir_informacao') {
    const item_id = normalizeShortText(payload.item_id, 300);
    const item_titulo = normalizeShortText(payload.item_titulo, 220);
    const correcao = normalizeMessage(payload.correcao);
    const link_referencia = normalizeOptionalUrl(payload.link_referencia);
    if (!item_id && !item_titulo) throw new Error('item_obrigatorio');
    if (item_id && !SUGGESTION_ITEM_RE.test(item_id)) throw new Error('item_invalido');
    if (correcao.length < 5) throw new Error('correcao_obrigatoria');
    return { item_id, item_titulo, correcao, link_referencia };
  }
  throw new Error('tipo_invalido');
}

async function contributionTableAvailable(env) {
  if (!env.SUGESTOES_DB) return false;
  try {
    await env.SUGESTOES_DB.prepare('SELECT 1 FROM contribuicoes_comunidade LIMIT 1').first();
    return true;
  } catch {
    return false;
  }
}

async function countContributionsToday(env) {
  const row = await env.SUGESTOES_DB
    .prepare("SELECT COUNT(*) AS total FROM contribuicoes_comunidade WHERE criado_em >= datetime('now','start of day')")
    .first();
  return Number(row?.total || 0);
}

async function insertCommunityContribution(env, type, payload) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const protocol = contributionProtocolCode();
    try {
      await env.SUGESTOES_DB.prepare(
        `INSERT INTO contribuicoes_comunidade
          (protocolo, criado_em, status, tipo, payload_json, schema_version)
         VALUES (?, datetime('now'), 'recebido', ?, ?, 1)`
      ).bind(protocol, type, JSON.stringify(payload)).run();
      return protocol;
    } catch (error) {
      if (!String(error?.message || error).toLowerCase().includes('unique')) throw error;
    }
  }
  throw new Error('protocolo_indisponivel');
}

async function handleContributionConfig(env) {
  return jsonResponse({
    disponivel: await contributionTableAvailable(env),
    turnstile_site_key: String(env.TURNSTILE_SITE_KEY || '').trim(),
    tipos: [...CONTRIBUTION_TYPES]
  });
}

async function handleContributionPost(request, env) {
  if (!(await contributionTableAvailable(env))) {
    return jsonResponse({ erro: 'O envio de contribuições está temporariamente indisponível.' }, 503);
  }
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > 32 * 1024) {
    return jsonResponse({ erro: 'A contribuição excede o limite permitido.' }, 413);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ erro: 'Contribuição inválida.' }, 400);
  }

  const type = String(body?.tipo || '').trim();
  if (!CONTRIBUTION_TYPES.has(type)) {
    return jsonResponse({ erro: 'Tipo de contribuição inválido.' }, 422);
  }

  let payload;
  try {
    payload = normalizeContributionPayload(type, body?.dados);
  } catch (error) {
    const code = String(error?.message || '');
    const messages = {
      titulo_obrigatorio: 'Informe o nome do evento.',
      referencia_obrigatoria: 'Informe um link de referência ou explique onde a equipe pode confirmar o evento.',
      item_obrigatorio: 'Informe qual conteúdo precisa de correção.',
      item_invalido: 'O identificador do conteúdo está inválido.',
      correcao_obrigatoria: 'Explique o que precisa ser corrigido.',
      url_invalida: 'O link de referência está inválido.',
      campo_longo: 'Um dos campos excede o limite permitido.',
      mensagem_longa: 'O texto pode ter no máximo 1200 caracteres.'
    };
    return jsonResponse({ erro: messages[code] || 'Os dados enviados estão inválidos.' }, 422);
  }

  if (!(await verifyTurnstile(body?.turnstile_token, env, 'contribuir_mural'))) {
    return jsonResponse({ erro: 'Não foi possível confirmar o envio. Tente novamente.' }, 403);
  }

  const dailyLimit = Math.max(1, Number(env.CONTRIBUICOES_DAILY_LIMIT || env.SUGESTOES_DAILY_LIMIT || 500));
  if ((await countContributionsToday(env)) >= dailyLimit) {
    return jsonResponse({
      erro: 'Ficamos muito felizes por você se dispor a ajudar, mas hoje tivemos muitas contribuições e excedemos nosso limite de processamento. Não desista de nós. Volte amanhã e contribua com o projeto.',
      codigo: 'LIMITE_DIARIO'
    }, 429);
  }

  const protocol = await insertCommunityContribution(env, type, payload);
  return jsonResponse({
    ok: true,
    protocolo: protocol,
    tipo: type,
    tipo_label: CONTRIBUTION_TYPE_LABELS[type],
    mensagem: 'Contribuição enviada para análise.'
  }, 201);
}

async function handleContributionStatus(request, env) {
  if (!(await contributionTableAvailable(env))) {
    return jsonResponse({ erro: 'A consulta de contribuições está temporariamente indisponível.' }, 503);
  }
  const url = new URL(request.url);
  const protocol = String(url.searchParams.get('protocolo') || '').trim().toUpperCase();
  if (!/^CON-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(protocol)) {
    return jsonResponse({ erro: 'Protocolo não encontrado.' }, 404);
  }
  const row = await env.SUGESTOES_DB.prepare(
    'SELECT protocolo, criado_em, atualizado_em, status, tipo FROM contribuicoes_comunidade WHERE protocolo = ? LIMIT 1'
  ).bind(protocol).first();
  if (!row) return jsonResponse({ erro: 'Protocolo não encontrado.' }, 404);
  const status = SUGGESTION_STATUSES.has(String(row.status)) ? String(row.status) : 'recebido';
  return jsonResponse({
    protocolo: String(row.protocolo || protocol),
    tipo: String(row.tipo || ''),
    tipo_label: CONTRIBUTION_TYPE_LABELS[String(row.tipo || '')] || 'Contribuição',
    status,
    status_label: PUBLIC_SUGGESTION_STATUS_LABELS[status] || 'Recebida',
    criado_em: sqliteUtcToIso(row.criado_em),
    atualizado_em: sqliteUtcToIso(row.atualizado_em)
  });
}

async function handleContributionAdminList(request, env) {
  if (!(await contributionTableAvailable(env))) return jsonResponse({ erro: 'Base de contribuições não configurada.' }, 503);
  if (!adminAuthorized(request, env)) return jsonResponse({ erro: 'Não autorizado.' }, 401);
  const url = new URL(request.url);
  const status = String(url.searchParams.get('status') || '').trim();
  const type = String(url.searchParams.get('tipo') || '').trim();
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limite') || 50)));
  if (status && !SUGGESTION_STATUSES.has(status)) return jsonResponse({ erro: 'Status inválido.' }, 422);
  if (type && !CONTRIBUTION_TYPES.has(type)) return jsonResponse({ erro: 'Tipo inválido.' }, 422);

  const clauses = [];
  const binds = [];
  if (status) { clauses.push('status = ?'); binds.push(status); }
  if (type) { clauses.push('tipo = ?'); binds.push(type); }
  const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
  const statement = env.SUGESTOES_DB.prepare(
    `SELECT id, protocolo, criado_em, atualizado_em, status, tipo, payload_json, schema_version
       FROM contribuicoes_comunidade${where} ORDER BY id DESC LIMIT ?`
  ).bind(...binds, limit);
  const result = await statement.all();
  const contribuicoes = (result.results || []).map(row => ({
    protocolo: row.protocolo,
    criado_em: row.criado_em,
    atualizado_em: row.atualizado_em || '',
    status: row.status,
    tipo: row.tipo,
    tipo_label: CONTRIBUTION_TYPE_LABELS[row.tipo] || row.tipo,
    schema_version: Number(row.schema_version || 1),
    dados: (() => {
      try {
        const parsed = JSON.parse(row.payload_json || '{}');
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
      } catch {
        return {};
      }
    })()
  }));
  return jsonResponse({ contribuicoes, total: contribuicoes.length });
}

async function handleContributionAdminUpdate(request, env, protocol) {
  if (!(await contributionTableAvailable(env))) return jsonResponse({ erro: 'Base de contribuições não configurada.' }, 503);
  if (!adminAuthorized(request, env)) return jsonResponse({ erro: 'Não autorizado.' }, 401);
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ erro: 'Solicitação inválida.' }, 400);
  }
  const status = String(body?.status || '').trim();
  if (!SUGGESTION_STATUSES.has(status)) return jsonResponse({ erro: 'Status inválido.' }, 422);
  const result = await env.SUGESTOES_DB.prepare(
    "UPDATE contribuicoes_comunidade SET status = ?, atualizado_em = datetime('now') WHERE protocolo = ?"
  ).bind(status, protocol).run();
  if (!Number(result.meta?.changes || 0)) return jsonResponse({ erro: 'Contribuição não encontrada.' }, 404);
  return jsonResponse({ ok: true, protocolo: protocol, status });
}

async function handleCommunityContributionApi(request, env) {
  const url = new URL(request.url);
  const publicApi = url.pathname === CONTRIBUTION_API_PATH
    || url.pathname === `${CONTRIBUTION_API_PATH}/config`
    || url.pathname === CONTRIBUTION_STATUS_PATH;

  if (publicApi && request.method === 'OPTIONS') {
    return withSuggestionCors(request, env, new Response(null, {
      status: 204,
      headers: {'cache-control': 'no-store'}
    }));
  }
  if (url.pathname === `${CONTRIBUTION_API_PATH}/config` && request.method === 'GET') {
    return withSuggestionCors(request, env, await handleContributionConfig(env));
  }
  if (url.pathname === CONTRIBUTION_STATUS_PATH && request.method === 'GET') {
    return withSuggestionCors(request, env, await handleContributionStatus(request, env));
  }
  if (url.pathname === CONTRIBUTION_API_PATH && request.method === 'POST') {
    return withSuggestionCors(request, env, await handleContributionPost(request, env));
  }
  if (url.pathname === CONTRIBUTION_ADMIN_PATH && request.method === 'GET') {
    return handleContributionAdminList(request, env);
  }
  if (url.pathname.startsWith(`${CONTRIBUTION_ADMIN_PATH}/`) && request.method === 'PATCH') {
    const protocol = decodeURIComponent(url.pathname.slice(CONTRIBUTION_ADMIN_PATH.length + 1));
    if (!/^CON-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(protocol)) {
      return jsonResponse({ erro: 'Protocolo inválido.' }, 422);
    }
    return handleContributionAdminUpdate(request, env, protocol);
  }
  return null;
}

function normalizePointSlug(value) {
  const point = String(value || '').trim().toLowerCase();
  return POINT_SLUG_RE.test(point) ? point : '';
}

function validPointMetricContentId(value) {
  const contentId = String(value || '').trim();
  const separator = contentId.indexOf(':');
  if (separator < 1 || separator === contentId.length - 1) return false;
  const type = contentId.slice(0, separator);
  const id = contentId.slice(separator + 1);
  if (!POINT_METRIC_CONTENT_TYPE_RE.test(type) || id.length > 180) return false;
  return !Array.from(id).some(char => char.trim() === '');
}

function pointMetricsClock() {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return {
      dia: values.year + '-' + values.month + '-' + values.day,
      hora: Number(values.hour),
      minuto: Number(values.minute)
    };
  } catch {
    const now = new Date();
    return {
      dia: now.toISOString().slice(0, 10),
      hora: now.getUTCHours(),
      minuto: now.getUTCMinutes()
    };
  }
}

function pointMetricsDate() {
  return pointMetricsClock().dia;
}

function shiftIsoDate(value, days) {
  const date = new Date(String(value || '') + 'T12:00:00Z');
  if (Number.isNaN(date.getTime())) return '';
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function normalizeMetricDate(value, fallback) {
  const normalized = String(value || '').trim();
  if (normalized.length !== 10 || normalized[4] !== '-' || normalized[7] !== '-') return fallback;
  const parsed = new Date(normalized + 'T12:00:00Z');
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized
    ? fallback
    : normalized;
}

function bitCount30(value) {
  let current = Number(value || 0) >>> 0;
  let count = 0;
  while (current) {
    current &= current - 1;
    count += 1;
  }
  return count;
}

async function ensurePointMetricsTable(env) {
  if (!env.SUGESTOES_DB) return false;
  try {
    await env.SUGESTOES_DB.prepare(
      "CREATE TABLE IF NOT EXISTS metricas_pontos_diarias (" +
      "dia TEXT NOT NULL, " +
      "ambiente TEXT NOT NULL CHECK (ambiente IN ('publico', 'teste')), " +
      "ponto TEXT NOT NULL, " +
      "acao TEXT NOT NULL CHECK (acao IN ('entrada', 'sessao_ativa', 'visualizacao_conteudo')), " +
      "tipo_conteudo TEXT NOT NULL DEFAULT '', " +
      "conteudo_id TEXT NOT NULL DEFAULT '', " +
      "quantidade INTEGER NOT NULL DEFAULT 0 CHECK (quantidade >= 0), " +
      "PRIMARY KEY (dia, ambiente, ponto, acao, tipo_conteudo, conteudo_id)" +
      ") WITHOUT ROWID"
    ).run();
    await env.SUGESTOES_DB.prepare(
      'CREATE INDEX IF NOT EXISTS idx_metricas_pontos_periodo ' +
      'ON metricas_pontos_diarias(ponto, ambiente, dia)'
    ).run();
    await env.SUGESTOES_DB.prepare(
      "CREATE TABLE IF NOT EXISTS exposicao_paineis_horaria (" +
      "dia TEXT NOT NULL, " +
      "hora INTEGER NOT NULL CHECK (hora >= 0 AND hora <= 23), " +
      "ambiente TEXT NOT NULL CHECK (ambiente IN ('publico', 'teste')), " +
      "ponto TEXT NOT NULL, " +
      "painel TEXT NOT NULL, " +
      "minutos_00_29 INTEGER NOT NULL DEFAULT 0 CHECK (minutos_00_29 >= 0), " +
      "minutos_30_59 INTEGER NOT NULL DEFAULT 0 CHECK (minutos_30_59 >= 0), " +
      "PRIMARY KEY (dia, hora, ambiente, ponto, painel)" +
      ") WITHOUT ROWID"
    ).run();
    await env.SUGESTOES_DB.prepare(
      'CREATE INDEX IF NOT EXISTS idx_exposicao_paineis_periodo ' +
      'ON exposicao_paineis_horaria(ponto, ambiente, dia, hora)'
    ).run();
    return true;
  } catch (error) {
    console.warn('Métricas por ponto: não foi possível preparar as tabelas.', error);
    return false;
  }
}

async function handlePointMetricsPost(request, env) {
  if (!(await ensurePointMetricsTable(env))) {
    return jsonResponse({ erro: 'Métricas temporariamente indisponíveis.' }, 503);
  }

  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > 4096) return jsonResponse({ erro: 'Métrica inválida.' }, 413);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ erro: 'Métrica inválida.' }, 400);
  }

  const point = normalizePointSlug(body?.ponto);
  const action = String(body?.acao || '').trim();
  const environment = String(body?.ambiente || '').trim();
  if (!point || !POINT_METRIC_ACTIONS.has(action) || !POINT_METRIC_ENVIRONMENTS.has(environment)) {
    return jsonResponse({ erro: 'Métrica inválida.' }, 422);
  }

  let contentId = '';
  let contentType = '';
  if (action === 'visualizacao_conteudo') {
    contentId = String(body?.conteudo_id || '').trim();
    if (!validPointMetricContentId(contentId)) {
      return jsonResponse({ erro: 'Conteúdo inválido.' }, 422);
    }
    contentType = contentId.split(':', 1)[0];
  }

  await env.SUGESTOES_DB.prepare(
    'INSERT INTO metricas_pontos_diarias ' +
    '(dia, ambiente, ponto, acao, tipo_conteudo, conteudo_id, quantidade) ' +
    'VALUES (?, ?, ?, ?, ?, ?, 1) ' +
    'ON CONFLICT(dia, ambiente, ponto, acao, tipo_conteudo, conteudo_id) ' +
    'DO UPDATE SET quantidade = quantidade + 1'
  ).bind(
    pointMetricsDate(),
    environment,
    point,
    action,
    contentType,
    contentId
  ).run();

  return jsonResponse({ ok: true }, 202);
}

async function handlePointPanelHeartbeat(request, env) {
  if (!(await ensurePointMetricsTable(env))) {
    return jsonResponse({ erro: 'Métricas temporariamente indisponíveis.' }, 503);
  }

  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > 2048) return jsonResponse({ erro: 'Métrica inválida.' }, 413);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ erro: 'Métrica inválida.' }, 400);
  }

  const point = normalizePointSlug(body?.ponto);
  const panel = normalizePointSlug(body?.painel || 'principal');
  const environment = String(body?.ambiente || '').trim();
  if (!point || !panel || !POINT_METRIC_ENVIRONMENTS.has(environment)) {
    return jsonResponse({ erro: 'Métrica inválida.' }, 422);
  }

  const clock = pointMetricsClock();
  if (!Number.isInteger(clock.hora) || clock.hora < 0 || clock.hora > 23 ||
      !Number.isInteger(clock.minuto) || clock.minuto < 0 || clock.minuto > 59) {
    return jsonResponse({ erro: 'Horário indisponível.' }, 503);
  }

  const lowBit = clock.minuto < 30 ? 2 ** clock.minuto : 0;
  const highBit = clock.minuto >= 30 ? 2 ** (clock.minuto - 30) : 0;

  await env.SUGESTOES_DB.prepare(
    'INSERT INTO exposicao_paineis_horaria ' +
    '(dia, hora, ambiente, ponto, painel, minutos_00_29, minutos_30_59) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?) ' +
    'ON CONFLICT(dia, hora, ambiente, ponto, painel) DO UPDATE SET ' +
    'minutos_00_29 = minutos_00_29 | excluded.minutos_00_29, ' +
    'minutos_30_59 = minutos_30_59 | excluded.minutos_30_59'
  ).bind(
    clock.dia,
    clock.hora,
    environment,
    point,
    panel,
    lowBit,
    highBit
  ).run();

  return jsonResponse({ ok: true }, 202);
}

async function handlePointMetricsAdmin(request, env) {
  if (!(await ensurePointMetricsTable(env))) {
    return jsonResponse({ erro: 'Métricas temporariamente indisponíveis.' }, 503);
  }
  if (!adminAuthorized(request, env)) return jsonResponse({ erro: 'Não autorizado.' }, 401);

  const url = new URL(request.url);
  const today = pointMetricsDate();
  const end = normalizeMetricDate(url.searchParams.get('fim'), today);
  const start = normalizeMetricDate(url.searchParams.get('inicio'), shiftIsoDate(end, -29));
  if (!start || start > end) return jsonResponse({ erro: 'Período inválido.' }, 422);

  const maxStart = shiftIsoDate(end, -365);
  if (maxStart && start < maxStart) {
    return jsonResponse({ erro: 'O período máximo para uma consulta é de 366 dias.' }, 422);
  }

  const [summary, daily, contents, exposure] = await Promise.all([
    env.SUGESTOES_DB.prepare(
      "SELECT ponto, ambiente, " +
      "SUM(CASE WHEN acao = 'entrada' THEN quantidade ELSE 0 END) AS entradas, " +
      "SUM(CASE WHEN acao = 'sessao_ativa' THEN quantidade ELSE 0 END) AS sessoes_ativas, " +
      "SUM(CASE WHEN acao = 'visualizacao_conteudo' THEN quantidade ELSE 0 END) AS visualizacoes " +
      'FROM metricas_pontos_diarias WHERE dia >= ? AND dia <= ? ' +
      'GROUP BY ponto, ambiente ORDER BY entradas DESC, ponto'
    ).bind(start, end).all(),
    env.SUGESTOES_DB.prepare(
      "SELECT dia, ponto, ambiente, " +
      "SUM(CASE WHEN acao = 'entrada' THEN quantidade ELSE 0 END) AS entradas, " +
      "SUM(CASE WHEN acao = 'sessao_ativa' THEN quantidade ELSE 0 END) AS sessoes_ativas, " +
      "SUM(CASE WHEN acao = 'visualizacao_conteudo' THEN quantidade ELSE 0 END) AS visualizacoes " +
      'FROM metricas_pontos_diarias WHERE dia >= ? AND dia <= ? ' +
      'GROUP BY dia, ponto, ambiente ORDER BY dia, ponto'
    ).bind(start, end).all(),
    env.SUGESTOES_DB.prepare(
      "SELECT ponto, ambiente, tipo_conteudo, conteudo_id, SUM(quantidade) AS visualizacoes " +
      "FROM metricas_pontos_diarias " +
      "WHERE dia >= ? AND dia <= ? AND acao = 'visualizacao_conteudo' " +
      'GROUP BY ponto, ambiente, tipo_conteudo, conteudo_id ' +
      'ORDER BY visualizacoes DESC LIMIT 1000'
    ).bind(start, end).all(),
    env.SUGESTOES_DB.prepare(
      'SELECT dia, hora, ambiente, ponto, painel, minutos_00_29, minutos_30_59 ' +
      'FROM exposicao_paineis_horaria WHERE dia >= ? AND dia <= ? ' +
      'ORDER BY dia, hora, ponto, painel'
    ).bind(start, end).all()
  ]);

  const exposureRows = (exposure.results || []).map(row => ({
    dia: String(row.dia || ''),
    hora: Number(row.hora || 0),
    ambiente: String(row.ambiente || ''),
    ponto: String(row.ponto || ''),
    painel: String(row.painel || 'principal'),
    minutos: bitCount30(row.minutos_00_29) + bitCount30(row.minutos_30_59)
  }));

  return jsonResponse({
    inicio: start,
    fim: end,
    resumo: summary.results || [],
    diario: daily.results || [],
    conteudos: contents.results || [],
    exposicao: exposureRows
  });
}

async function handlePointMetricsApi(request, env) {
  const url = new URL(request.url);
  if ((url.pathname === POINT_METRICS_API_PATH || url.pathname === POINT_PANEL_API_PATH) &&
      request.method === 'OPTIONS') {
    return withSuggestionCors(request, env, new Response(null, {
      status: 204,
      headers: { 'cache-control': 'no-store' }
    }));
  }
  if (url.pathname === POINT_METRICS_API_PATH && request.method === 'POST') {
    return withSuggestionCors(request, env, await handlePointMetricsPost(request, env));
  }
  if (url.pathname === POINT_PANEL_API_PATH && request.method === 'POST') {
    return withSuggestionCors(request, env, await handlePointPanelHeartbeat(request, env));
  }
  if (url.pathname === POINT_METRICS_ADMIN_PATH && request.method === 'GET') {
    return handlePointMetricsAdmin(request, env);
  }
  return null;
}

function handlePointQrRedirect(request) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null;
  const url = new URL(request.url);
  if (!url.pathname.startsWith(POINT_QR_PREFIX)) return null;

  let rawPoint = url.pathname.slice(POINT_QR_PREFIX.length);
  if (rawPoint.endsWith('/')) rawPoint = rawPoint.slice(0, -1);
  if (!rawPoint || rawPoint.includes('/')) {
    return new Response('Ponto de divulgação inválido.', { status: 404 });
  }

  const point = normalizePointSlug(rawPoint);
  if (!point) return new Response('Ponto de divulgação inválido.', { status: 404 });

  const target = new URL('https://temsimuai.com.br/');
  target.searchParams.set('origem', point);
  for (const key of ['modo', 'item', 'c', 'curadoria']) {
    const value = String(url.searchParams.get(key) || '').trim();
    if (value) target.searchParams.set(key, value);
  }
  if (target.searchParams.has('item') && !target.searchParams.has('modo')) {
    target.searchParams.set('modo', 'agenda');
  }

  return Response.redirect(target.href, 302);
}


function bytesBase64Url(value) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
}

function textBase64Url(value) {
  return bytesBase64Url(new TextEncoder().encode(String(value)));
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value)));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function validPushEndpoint(value) {
  const text = String(value || '').trim();
  if (!text || text.length > 4096) return '';
  try {
    const url = new URL(text);
    if (url.protocol !== 'https:' || url.username || url.password) return '';
    const host = url.hostname.toLowerCase();
    const allowed =
      NOTIFICATION_ALLOWED_PUSH_HOSTS.has(host) ||
      host.endsWith('.notify.windows.com');
    if (!allowed) return '';
    return url.href;
  } catch {
    return '';
  }
}

function validReminderDate(value) {
  if (value === null || value === undefined || value === '') return '';
  const text = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const parsed = new Date(`${text}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) return null;
  const now = new Date();
  const min = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  const max = new Date(Date.UTC(now.getUTCFullYear() + 10, now.getUTCMonth(), now.getUTCDate() + 2));
  if (parsed < min || parsed > max) return null;
  return text;
}

async function ensureNotificationTables(env) {
  if (!env.SUGESTOES_DB) return false;
  try {
    await env.SUGESTOES_DB.prepare(
      "CREATE TABLE IF NOT EXISTS notificacoes_push (" +
      "endpoint_hash TEXT PRIMARY KEY, " +
      "endpoint TEXT NOT NULL UNIQUE, " +
      "criado_em TEXT NOT NULL DEFAULT (datetime('now')), " +
      "atualizado_em TEXT NOT NULL DEFAULT (datetime('now')), " +
      "proximo_aviso TEXT, " +
      "falhas INTEGER NOT NULL DEFAULT 0 CHECK (falhas >= 0)" +
      ")"
    ).run();
    await env.SUGESTOES_DB.prepare(
      "CREATE INDEX IF NOT EXISTS idx_notificacoes_push_proximo_aviso " +
      "ON notificacoes_push(proximo_aviso) WHERE proximo_aviso IS NOT NULL"
    ).run();
    await env.SUGESTOES_DB.prepare(
      "CREATE TABLE IF NOT EXISTS notificacoes_config (" +
      "chave TEXT PRIMARY KEY, " +
      "valor TEXT NOT NULL, " +
      "atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))" +
      ")"
    ).run();
    return true;
  } catch (error) {
    console.warn('Notificações: não foi possível preparar as tabelas.', error);
    return false;
  }
}

async function ensureVapidKeyPair(env) {
  if (!(await ensureNotificationTables(env))) return null;

  const existing = await env.SUGESTOES_DB.prepare(
    "SELECT valor FROM notificacoes_config WHERE chave = 'vapid_keypair' LIMIT 1"
  ).first();
  if (existing?.valor) {
    try {
      const parsed = JSON.parse(existing.valor);
      if (parsed?.private_jwk && parsed?.public_key) return parsed;
    } catch {
      // Um valor inválido será substituído por um novo par.
    }
  }

  const keys = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify']
  );
  const privateJwk = await crypto.subtle.exportKey('jwk', keys.privateKey);
  const publicRaw = await crypto.subtle.exportKey('raw', keys.publicKey);
  const generated = {
    private_jwk: privateJwk,
    public_key: bytesBase64Url(publicRaw)
  };

  await env.SUGESTOES_DB.prepare(
    "INSERT OR IGNORE INTO notificacoes_config (chave, valor, atualizado_em) " +
    "VALUES ('vapid_keypair', ?, datetime('now'))"
  ).bind(JSON.stringify(generated)).run();

  const stored = await env.SUGESTOES_DB.prepare(
    "SELECT valor FROM notificacoes_config WHERE chave = 'vapid_keypair' LIMIT 1"
  ).first();
  if (!stored?.valor) return generated;
  try {
    return JSON.parse(stored.valor);
  } catch {
    return generated;
  }
}

function derLength(bytes, offset) {
  let length = bytes[offset++];
  if ((length & 0x80) === 0) return { length, offset };
  const count = length & 0x7f;
  length = 0;
  for (let i = 0; i < count; i += 1) length = (length << 8) | bytes[offset++];
  return { length, offset };
}

function ecdsaJoseSignature(value) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  if (bytes.length === 64) return bytes;
  if (bytes[0] !== 0x30) throw new Error('assinatura_ecdsa_invalida');

  let offset = 1;
  ({ offset } = derLength(bytes, offset));
  if (bytes[offset++] !== 0x02) throw new Error('assinatura_ecdsa_invalida');
  let parsed = derLength(bytes, offset);
  const r = bytes.slice(parsed.offset, parsed.offset + parsed.length);
  offset = parsed.offset + parsed.length;
  if (bytes[offset++] !== 0x02) throw new Error('assinatura_ecdsa_invalida');
  parsed = derLength(bytes, offset);
  const s = bytes.slice(parsed.offset, parsed.offset + parsed.length);

  const normalize = part => {
    let clean = part;
    while (clean.length > 32 && clean[0] === 0) clean = clean.slice(1);
    if (clean.length > 32) throw new Error('assinatura_ecdsa_invalida');
    const out = new Uint8Array(32);
    out.set(clean, 32 - clean.length);
    return out;
  };

  const signature = new Uint8Array(64);
  signature.set(normalize(r), 0);
  signature.set(normalize(s), 32);
  return signature;
}

async function vapidAuthorization(endpoint, keyPair, env) {
  const privateKey = await crypto.subtle.importKey(
    'jwk',
    keyPair.private_jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
  const header = textBase64Url(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const payload = textBase64Url(JSON.stringify({
    aud: new URL(endpoint).origin,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: String(env.WEB_PUSH_SUBJECT || 'https://temsimuai.com.br/')
  }));
  const unsigned = `${header}.${payload}`;
  const rawSignature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(unsigned)
  );
  const signature = bytesBase64Url(ecdsaJoseSignature(rawSignature));
  return `vapid t=${unsigned}.${signature}, k=${keyPair.public_key}`;
}

async function handleNotificationConfig(env) {
  const keyPair = await ensureVapidKeyPair(env);
  return jsonResponse({
    disponivel: Boolean(keyPair?.public_key),
    public_key: String(keyPair?.public_key || ''),
    lembrete_dias: 1,
    preferencias_locais: true
  }, keyPair?.public_key ? 200 : 503);
}

async function handleNotificationPost(request, env) {
  if (!(await ensureNotificationTables(env))) {
    return jsonResponse({ erro: 'Notificações temporariamente indisponíveis.' }, 503);
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ erro: 'Assinatura inválida.' }, 400);
  }
  const endpoint = validPushEndpoint(body?.endpoint);
  const reminder = validReminderDate(body?.proximo_aviso);
  if (!endpoint || reminder === null) {
    return jsonResponse({ erro: 'Assinatura inválida.' }, 422);
  }
  const hash = await sha256Hex(endpoint);
  await env.SUGESTOES_DB.prepare(
    "INSERT INTO notificacoes_push " +
    "(endpoint_hash, endpoint, criado_em, atualizado_em, proximo_aviso, falhas) " +
    "VALUES (?, ?, datetime('now'), datetime('now'), ?, 0) " +
    "ON CONFLICT(endpoint_hash) DO UPDATE SET " +
    "endpoint = excluded.endpoint, atualizado_em = datetime('now'), " +
    "proximo_aviso = excluded.proximo_aviso, falhas = 0"
  ).bind(hash, endpoint, reminder || null).run();
  return jsonResponse({ ok: true, agendado: reminder || null }, 202);
}

async function handleNotificationDelete(request, env) {
  if (!(await ensureNotificationTables(env))) {
    return jsonResponse({ erro: 'Notificações temporariamente indisponíveis.' }, 503);
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ erro: 'Assinatura inválida.' }, 400);
  }
  const endpoint = validPushEndpoint(body?.endpoint);
  if (!endpoint) return jsonResponse({ erro: 'Assinatura inválida.' }, 422);
  const hash = await sha256Hex(endpoint);
  await env.SUGESTOES_DB.prepare(
    'DELETE FROM notificacoes_push WHERE endpoint_hash = ?'
  ).bind(hash).run();
  return jsonResponse({ ok: true });
}

async function handleNotificationApi(request, env) {
  const url = new URL(request.url);
  const relevant = url.pathname === NOTIFICATION_API_PATH || url.pathname === NOTIFICATION_CONFIG_PATH;
  if (!relevant) return null;

  if (request.method === 'OPTIONS') {
    return withSuggestionCors(request, env, new Response(null, {
      status: 204,
      headers: { 'cache-control': 'no-store' }
    }));
  }
  if (url.pathname === NOTIFICATION_CONFIG_PATH && request.method === 'GET') {
    return withSuggestionCors(request, env, await handleNotificationConfig(env));
  }
  if (url.pathname === NOTIFICATION_API_PATH && request.method === 'POST') {
    return withSuggestionCors(request, env, await handleNotificationPost(request, env));
  }
  if (url.pathname === NOTIFICATION_API_PATH && request.method === 'DELETE') {
    return withSuggestionCors(request, env, await handleNotificationDelete(request, env));
  }
  return withSuggestionCors(request, env, jsonResponse({ erro: 'Método não permitido.' }, 405));
}

async function sendWebPush(endpoint, keyPair, env) {
  const authorization = await vapidAuthorization(endpoint, keyPair, env);
  return fetch(endpoint, {
    method: 'POST',
    headers: {
      TTL: '86400',
      Urgency: 'normal',
      Topic: 'mural-eventos',
      Authorization: authorization
    }
  });
}

async function sendDueNotifications(env) {
  if (!(await ensureNotificationTables(env))) return;
  const keyPair = await ensureVapidKeyPair(env);
  if (!keyPair?.private_jwk || !keyPair?.public_key) return;

  const today = new Date().toISOString().slice(0, 10);
  const rows = await env.SUGESTOES_DB.prepare(
    "SELECT endpoint_hash, endpoint, proximo_aviso, falhas " +
    "FROM notificacoes_push " +
    "WHERE proximo_aviso IS NOT NULL AND proximo_aviso <= ? " +
    "ORDER BY proximo_aviso, criado_em LIMIT 500"
  ).bind(today).all();

  const pending = rows.results || [];
  for (let start = 0; start < pending.length; start += 20) {
    const batch = pending.slice(start, start + 20);
    await Promise.allSettled(batch.map(async row => {
      // Limpa antes do envio. O Service Worker registra a próxima data após
      // mostrar a notificação, evitando disparos duplicados no mesmo dia.
      await env.SUGESTOES_DB.prepare(
        "UPDATE notificacoes_push SET proximo_aviso = NULL, atualizado_em = datetime('now') " +
        "WHERE endpoint_hash = ?"
      ).bind(row.endpoint_hash).run();

      try {
        const response = await sendWebPush(String(row.endpoint), keyPair, env);
        if (response.ok) return;
        if (response.status === 404 || response.status === 410) {
          await env.SUGESTOES_DB.prepare(
            'DELETE FROM notificacoes_push WHERE endpoint_hash = ?'
          ).bind(row.endpoint_hash).run();
          return;
        }
        await env.SUGESTOES_DB.prepare(
          "UPDATE notificacoes_push SET proximo_aviso = ?, falhas = falhas + 1, atualizado_em = datetime('now') " +
          "WHERE endpoint_hash = ?"
        ).bind(today, row.endpoint_hash).run();
      } catch {
        await env.SUGESTOES_DB.prepare(
          "UPDATE notificacoes_push SET proximo_aviso = ?, falhas = falhas + 1, atualizado_em = datetime('now') " +
          "WHERE endpoint_hash = ?"
        ).bind(today, row.endpoint_hash).run();
      }
    }));
  }
}

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
  async fetch(request, env) {
    const pointQrResponse = handlePointQrRedirect(request);
    if (pointQrResponse) return pointQrResponse;

    const pointMetricsResponse = await handlePointMetricsApi(request, env);
    if (pointMetricsResponse) return pointMetricsResponse;

    const notificationResponse = await handleNotificationApi(request, env);
    if (notificationResponse) return notificationResponse;

    const shortSelectionResponse = await handleSharedSelectionShortLink(request, env);
    if (shortSelectionResponse) return shortSelectionResponse;

    const sharedSelectionResponse = await handleSharedSelectionApi(request, env);
    if (sharedSelectionResponse) return sharedSelectionResponse;

    const contributionResponse = await handleCommunityContributionApi(request, env);
    if (contributionResponse) return contributionResponse;

    const apiResponse = await handleSuggestionApi(request, env);
    if (apiResponse) return apiResponse;

    const response = await env.ASSETS.fetch(request);
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
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(sendDueNotifications(env));
  }
};
