-- Métricas agregadas dos QR Codes dos pontos de divulgação.
-- Não armazena identificadores pessoais ou persistentes de visitante ou dispositivo.

CREATE TABLE IF NOT EXISTS metricas_pontos_diarias (
  dia TEXT NOT NULL,
  ambiente TEXT NOT NULL CHECK (ambiente IN ('publico', 'teste')),
  ponto TEXT NOT NULL,
  acao TEXT NOT NULL CHECK (acao IN ('entrada', 'sessao_ativa', 'visualizacao_conteudo')),
  tipo_conteudo TEXT NOT NULL DEFAULT '',
  conteudo_id TEXT NOT NULL DEFAULT '',
  quantidade INTEGER NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
  PRIMARY KEY (dia, ambiente, ponto, acao, tipo_conteudo, conteudo_id)
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS idx_metricas_pontos_periodo
  ON metricas_pontos_diarias(ponto, ambiente, dia);
