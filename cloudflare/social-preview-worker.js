
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
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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
  }
};
