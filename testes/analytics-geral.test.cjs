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
assert(worker.includes('sum { visits edgeResponseBytes }'));
assert(worker.includes("fonte: 'Cloudflare GraphQL Analytics API'"));
assert(worker.includes('amostragem: maxSampleInterval > 1'));
assert(worker.includes('const generalAnalyticsResponse = await handleGeneralAnalyticsApi(request, env)'));

const handlerStart = worker.indexOf('async function handleGeneralAnalyticsAdmin');
const handlerEnd = worker.indexOf('async function handleGeneralAnalyticsApi');
assert(handlerStart >= 0 && handlerEnd > handlerStart);
const handler = worker.slice(handlerStart, handlerEnd);
assert(handler.indexOf('adminAuthorized(request, env)') < handler.indexOf('generalAnalyticsConfig(env)'));

console.log('Estatísticas gerais da Cloudflare validadas.');
