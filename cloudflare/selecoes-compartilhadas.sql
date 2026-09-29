CREATE TABLE IF NOT EXISTS selecoes_compartilhadas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT NOT NULL UNIQUE,
  criado_em TEXT NOT NULL,
  contexto TEXT NOT NULL
    CHECK (contexto IN ('mural', 'curadoria_livros')),
  itens_json TEXT NOT NULL,
  quantidade INTEGER NOT NULL,
  hash_selecao TEXT NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_selecoes_compartilhadas_contexto_hash
  ON selecoes_compartilhadas(contexto, hash_selecao);

CREATE INDEX IF NOT EXISTS idx_selecoes_compartilhadas_criado_em
  ON selecoes_compartilhadas(criado_em);
