-- Histórico agregado das estatísticas gerais da Cloudflare.
-- Uma linha por dia; não armazena IP, cookie, user-agent individual ou identificador de visitante.

CREATE TABLE IF NOT EXISTS analytics_geral_historico (
  dia TEXT PRIMARY KEY,
  requisicoes INTEGER NOT NULL DEFAULT 0,
  visitas INTEGER NOT NULL DEFAULT 0,
  visitas_disponiveis INTEGER NOT NULL DEFAULT 0 CHECK (visitas_disponiveis IN (0, 1)),
  visualizacoes_pagina INTEGER NOT NULL DEFAULT 0,
  bytes INTEGER NOT NULL DEFAULT 0,
  amostragem INTEGER NOT NULL DEFAULT 0 CHECK (amostragem IN (0, 1)),
  sample_interval_max REAL NOT NULL DEFAULT 1,
  paginas_json TEXT NOT NULL DEFAULT '[]',
  paises_json TEXT NOT NULL DEFAULT '[]',
  dispositivos_json TEXT NOT NULL DEFAULT '[]',
  navegadores_json TEXT NOT NULL DEFAULT '[]',
  sistemas_json TEXT NOT NULL DEFAULT '[]',
  referencias_json TEXT NOT NULL DEFAULT '[]',
  coletado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_analytics_geral_historico_dia
  ON analytics_geral_historico(dia);
