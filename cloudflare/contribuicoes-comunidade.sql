CREATE TABLE IF NOT EXISTS contribuicoes_comunidade (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  protocolo TEXT NOT NULL UNIQUE,
  criado_em TEXT NOT NULL,
  atualizado_em TEXT,
  status TEXT NOT NULL DEFAULT 'recebido'
    CHECK (status IN ('recebido', 'em_analise', 'aproveitado', 'descartado')),
  tipo TEXT NOT NULL
    CHECK (tipo IN ('sugerir_evento', 'corrigir_informacao', 'opiniao_livro')),
  payload_json TEXT NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_contribuicoes_comunidade_status_id
  ON contribuicoes_comunidade(status, id DESC);

CREATE INDEX IF NOT EXISTS idx_contribuicoes_comunidade_tipo_id
  ON contribuicoes_comunidade(tipo, id DESC);

CREATE INDEX IF NOT EXISTS idx_contribuicoes_comunidade_criado_em
  ON contribuicoes_comunidade(criado_em);
