const fs = require('fs');
const assert = require('assert');

const worker = fs.readFileSync('cloudflare/social-preview-worker.js', 'utf8');

assert(worker.includes("const GENERAL_ANALYTICS_ADMIN_PATH = '/api/analytics-geral/admin'"));
assert(worker.includes("const CLOUDFLARE_GRAPHQL_URL = 'https://api.cloudflare.com/client/v4/graphql'"));
assert(worker.includes('CLOUDFLARE_ANALYTICS_TOKEN'));
assert(worker.includes('CLOUDFLARE_ANALYTICS_ZONE_ID'));
assert(worker.includes('GENERAL_ANALYTICS_MAX_DAYS = 31'));
assert(worker.includes('handleGeneralAnalyticsAdmin(request, env)'));
assert(worker.includes('handleGeneralAnalyticsApi(request, env)'));
assert(worker.includes('generalAnalyticsFullQuery()'));
assert(worker.includes('generalAnalyticsCoreQuery()'));
assert(worker.includes('generalAnalyticsMinimalQuery()'));
assert(worker.includes('generalAnalyticsBareQuery()'));
assert(worker.includes("mode = 'bare'"));
assert(worker.includes('analytics_geral_historico'));
assert(worker.includes('archiveRecentGeneralAnalytics(env)'));
assert(worker.includes('generalAnalyticsProbeInfo(path)'));
assert(worker.includes("classe: 'varredura'"));
assert(worker.includes('varreduras_provaveis'));
assert(worker.includes('preservado_no_d1: true'));
assert(worker.includes('paginasResumo: httpRequestsAdaptiveGroups'));
assert(worker.includes('visualizacoes_pagina: Math.round(totalPageViews)'));
assert(worker.includes('requestSource: "eyeball"'));
assert(worker.includes('edgeResponseContentTypeName: "html"'));
assert(worker.includes('clientRequestPath'));
assert(worker.includes('clientCountryName'));
assert(worker.includes('clientDeviceType'));
assert(worker.includes('userAgentBrowser'));
assert(worker.includes('userAgentOS'));
assert(worker.includes('clientRefererHost'));

const audiencePathFilterCount = (worker.match(/clientRequestPath: "\/"[\s\S]{0,120}clientRequestPath: "\/index\.html"/g) || []).length;
assert(audiencePathFilterCount >= 7);
assert(worker.includes('Dimensões de audiência são filtradas para os caminhos HTML reais do Mural.'));
assert(worker.includes('sum { visits edgeResponseBytes }'));
assert(worker.includes("fonte: 'Cloudflare GraphQL Analytics API + histórico agregado D1'"));
assert(worker.includes('amostragem: anySampling'));
assert(worker.includes('const generalAnalyticsResponse = await handleGeneralAnalyticsApi(request, env)'));

const handlerStart = worker.indexOf('async function handleGeneralAnalyticsAdmin');
const handlerEnd = worker.indexOf('async function handleGeneralAnalyticsApi');
assert(handlerStart >= 0 && handlerEnd > handlerStart);
const handler = worker.slice(handlerStart, handlerEnd);
assert(handler.indexOf('adminAuthorized(request, env)') < handler.indexOf('generalAnalyticsConfig(env)'));

console.log('Estatísticas gerais da Cloudflare validadas.');
