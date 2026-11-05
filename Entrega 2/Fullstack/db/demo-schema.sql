CREATE TABLE IF NOT EXISTS usuarios (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  nome          TEXT  NOT NULL,
  email         TEXT COLLATE NOCASE  NOT NULL,
  senha_hash    TEXT  NOT NULL,
  perfil        TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pendente',
  telefone      TEXT   NULL,
  razao_social  TEXT  NULL,
  documento     TEXT      NULL,
  area_atuacao  TEXT  NULL,
  aprovado_por  INTEGER  NULL,
  aprovado_em   DATETIME      NULL,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE (email),
  UNIQUE (documento),
  CONSTRAINT fk_usuarios_aprovador FOREIGN KEY (aprovado_por)
    REFERENCES usuarios (id) ON DELETE SET NULL,
  CONSTRAINT chk_usuarios_fornecedor CHECK (perfil <> 'fornecedor' OR documento IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS eventos (
  id                        INTEGER PRIMARY KEY AUTOINCREMENT,
  organizador_id            INTEGER  NOT NULL,
  nome                      TEXT  NOT NULL,
  descricao                 TEXT          NULL,
  local_evento              TEXT  NOT NULL,
  data_inicio               DATETIME      NOT NULL,
  data_fim                  DATETIME      NOT NULL,
  publico_minimo            INTEGER  NOT NULL DEFAULT 0,
  publico_maximo            INTEGER  NOT NULL,
  publico_esperado          INTEGER  NULL,
  margem_lucro_percentual   NUMERIC  NOT NULL DEFAULT 0.00,
  status                    TEXT NOT NULL DEFAULT 'rascunho',
  created_at                TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_eventos_organizador FOREIGN KEY (organizador_id)
    REFERENCES usuarios (id) ON DELETE RESTRICT,
  CONSTRAINT chk_eventos_datas CHECK (data_fim >= data_inicio),
  CONSTRAINT chk_eventos_publico CHECK (publico_maximo > 0 AND publico_maximo >= publico_minimo),
  CONSTRAINT chk_eventos_esperado CHECK (publico_esperado IS NULL
    OR (publico_esperado >= publico_minimo AND publico_esperado <= publico_maximo)),
  CONSTRAINT chk_eventos_margem CHECK (margem_lucro_percentual >= 0 AND margem_lucro_percentual < 100)
);

CREATE TABLE IF NOT EXISTS itens_custo (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  evento_id   INTEGER  NOT NULL,
  nome        TEXT COLLATE NOCASE  NOT NULL,
  categoria   TEXT NOT NULL,
  descricao   TEXT  NULL,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE (evento_id, nome),
  CONSTRAINT fk_itens_evento FOREIGN KEY (evento_id)
    REFERENCES eventos (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS custos_evento (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  evento_id   INTEGER   NOT NULL,
  descricao   TEXT   NOT NULL,
  tipo        TEXT NOT NULL,
  valor       NUMERIC  NOT NULL,
  created_at  TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_custos_evento FOREIGN KEY (evento_id)
    REFERENCES eventos (id) ON DELETE CASCADE,
  CONSTRAINT chk_custos_valor CHECK (valor >= 0)
);

CREATE TABLE IF NOT EXISTS propostas (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  item_custo_id   INTEGER   NOT NULL,
  fornecedor_id   INTEGER   NOT NULL,
  valor           NUMERIC  NOT NULL,
  descricao       TEXT           NOT NULL,
  validade        DATE           NOT NULL,
  observacoes     TEXT  NULL,
  status          TEXT NOT NULL DEFAULT 'enviada',
  selecao_chave   INTEGER   GENERATED ALWAYS AS (CASE WHEN status = 'selecionada' THEN item_custo_id END) VIRTUAL,
  created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE (item_custo_id, fornecedor_id),
  UNIQUE (selecao_chave),
  CONSTRAINT fk_propostas_item FOREIGN KEY (item_custo_id)
    REFERENCES itens_custo (id) ON DELETE CASCADE,
  CONSTRAINT fk_propostas_fornecedor FOREIGN KEY (fornecedor_id)
    REFERENCES usuarios (id) ON DELETE RESTRICT,
  CONSTRAINT chk_propostas_valor CHECK (valor > 0)
);

CREATE TABLE IF NOT EXISTS revendas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vendedor_id INTEGER NOT NULL,
  comprador_id INTEGER NULL,
  evento TEXT NOT NULL,
  fim_evento DATETIME NOT NULL,
  codigo TEXT NOT NULL,
  codigo_hash TEXT NOT NULL UNIQUE,
  valor_centavos INTEGER NOT NULL CHECK (valor_centavos BETWEEN 100 AND 100000000),
  taxa_centavos INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pendente',
  contestacao TEXT NULL,
  moderador_id INTEGER NULL,
  moderado_em DATETIME NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (vendedor_id) REFERENCES usuarios(id),
  FOREIGN KEY (comprador_id) REFERENCES usuarios(id),
  FOREIGN KEY (moderador_id) REFERENCES usuarios(id),
  CHECK (comprador_id IS NULL OR comprador_id <> vendedor_id)
);

CREATE TRIGGER IF NOT EXISTS touch_usuarios AFTER UPDATE ON usuarios
BEGIN
  UPDATE usuarios SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS touch_eventos AFTER UPDATE ON eventos
BEGIN
  UPDATE eventos SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS touch_itens_custo AFTER UPDATE ON itens_custo
BEGIN
  UPDATE itens_custo SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS touch_custos_evento AFTER UPDATE ON custos_evento
BEGIN
  UPDATE custos_evento SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS touch_propostas AFTER UPDATE ON propostas
BEGIN
  UPDATE propostas SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
