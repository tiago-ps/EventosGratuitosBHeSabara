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


-- Tempo de exposição das telas físicas. Cada bit representa um minuto da hora.
-- Dois painéis com IDs diferentes contam como horas-tela distintas.
CREATE TABLE IF NOT EXISTS exposicao_paineis_horaria (
  dia TEXT NOT NULL,
  hora INTEGER NOT NULL CHECK (hora >= 0 AND hora <= 23),
  ambiente TEXT NOT NULL CHECK (ambiente IN ('publico', 'teste')),
  ponto TEXT NOT NULL,
  painel TEXT NOT NULL,
  minutos_00_29 INTEGER NOT NULL DEFAULT 0 CHECK (minutos_00_29 >= 0),
  minutos_30_59 INTEGER NOT NULL DEFAULT 0 CHECK (minutos_30_59 >= 0),
  PRIMARY KEY (dia, hora, ambiente, ponto, painel)
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS idx_exposicao_paineis_periodo
  ON exposicao_paineis_horaria(ponto, ambiente, dia, hora);
