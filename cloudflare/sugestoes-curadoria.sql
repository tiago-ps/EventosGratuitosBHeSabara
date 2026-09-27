CREATE TABLE IF NOT EXISTS curadoria_sugestoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  protocolo TEXT NOT NULL UNIQUE,
  criado_em TEXT NOT NULL,
  atualizado_em TEXT,
  status TEXT NOT NULL DEFAULT 'recebido'
    CHECK (status IN ('recebido', 'em_analise', 'aproveitado', 'descartado')),
  mensagem TEXT NOT NULL DEFAULT '',
  itens_json TEXT NOT NULL,
  quantidade INTEGER NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_curadoria_sugestoes_status_id
  ON curadoria_sugestoes(status, id DESC);

CREATE INDEX IF NOT EXISTS idx_curadoria_sugestoes_criado_em
  ON curadoria_sugestoes(criado_em);
