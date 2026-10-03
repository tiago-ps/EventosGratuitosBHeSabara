-- Assinaturas técnicas de Web Push.
-- Não armazena nome, e-mail, telefone, IP, User-Agent, localização,
-- favoritos, títulos de eventos ou histórico de navegação.

CREATE TABLE IF NOT EXISTS notificacoes_push (
  endpoint_hash TEXT PRIMARY KEY,
  endpoint TEXT NOT NULL UNIQUE,
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now')),
  proximo_aviso TEXT,
  falhas INTEGER NOT NULL DEFAULT 0 CHECK (falhas >= 0)
);

CREATE INDEX IF NOT EXISTS idx_notificacoes_push_proximo_aviso
  ON notificacoes_push(proximo_aviso)
  WHERE proximo_aviso IS NOT NULL;

-- Guarda apenas a chave operacional VAPID do próprio serviço.
-- Não contém dados de visitantes.
CREATE TABLE IF NOT EXISTS notificacoes_config (
  chave TEXT PRIMARY KEY,
  valor TEXT NOT NULL,
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
