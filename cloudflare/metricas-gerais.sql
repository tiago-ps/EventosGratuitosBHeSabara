-- Métricas anônimas de audiência geral do Mural.
-- Não armazena IP, cookie persistente, fingerprint ou identificador de visitante.
-- Cada navegador envia apenas eventos agregáveis da sessão atual.

CREATE TABLE IF NOT EXISTS metricas_gerais_diarias (
  dia TEXT NOT NULL,
  ambiente TEXT NOT NULL CHECK (ambiente IN ('publico', 'teste')),
  origem_tipo TEXT NOT NULL CHECK (origem_tipo IN ('direto', 'canal', 'ponto')),
  origem TEXT NOT NULL,
  acao TEXT NOT NULL CHECK (acao IN ('entrada', 'sessao_ativa', 'visualizacao_conteudo')),
  tipo_conteudo TEXT NOT NULL DEFAULT '',
  conteudo_id TEXT NOT NULL DEFAULT '',
  quantidade INTEGER NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
  PRIMARY KEY (
    dia, ambiente, origem_tipo, origem, acao, tipo_conteudo, conteudo_id
  )
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS idx_metricas_gerais_periodo
  ON metricas_gerais_diarias(ambiente, dia, origem_tipo, origem);
