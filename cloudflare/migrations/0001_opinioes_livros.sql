-- D1 migration 0001: permitir opiniões sobre livros na fila comunitária.
-- Aplicada com: npx wrangler d1 migrations apply mural-sugestoes-curadoria --remote

CREATE TABLE contribuicoes_comunidade_v2 (
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

INSERT INTO contribuicoes_comunidade_v2
  (id, protocolo, criado_em, atualizado_em, status, tipo, payload_json, schema_version)
SELECT
  id, protocolo, criado_em, atualizado_em, status, tipo, payload_json, schema_version
FROM contribuicoes_comunidade;

DROP TABLE contribuicoes_comunidade;
ALTER TABLE contribuicoes_comunidade_v2 RENAME TO contribuicoes_comunidade;

CREATE INDEX idx_contribuicoes_comunidade_status_id
  ON contribuicoes_comunidade(status, id DESC);

CREATE INDEX idx_contribuicoes_comunidade_tipo_id
  ON contribuicoes_comunidade(tipo, id DESC);

CREATE INDEX idx_contribuicoes_comunidade_criado_em
  ON contribuicoes_comunidade(criado_em);
