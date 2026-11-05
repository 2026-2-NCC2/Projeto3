-- =============================================================================
-- TrocaTicket · Schema MySQL 8.0+ (versão completa: Entregas 1 e 2)
-- Instalação limpa:  mysql -u root -p < db/schema.sql
-- Para atualizar um banco da versão anterior, veja db/migrations/002_fluxo_completo.md
-- =============================================================================

CREATE DATABASE IF NOT EXISTS trocaticket
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE trocaticket;

-- -----------------------------------------------------------------------------
-- USUÁRIOS (RF01 a RF04): organizador, fornecedor e administrador
-- Aprovação pelo Administrador com rastreabilidade (aprovado_por / aprovado_em).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
  id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  nome          VARCHAR(120)  NOT NULL,
  email         VARCHAR(160)  NOT NULL,
  senha_hash    VARCHAR(255)  NOT NULL,
  perfil        ENUM('administrador', 'organizador', 'fornecedor', 'comprador', 'revendedor') NOT NULL,
  status        ENUM('pendente', 'aprovado', 'rejeitado') NOT NULL DEFAULT 'pendente',
  telefone      VARCHAR(20)   NULL,
  razao_social  VARCHAR(160)  NULL,
  documento     CHAR(14)      NULL COMMENT 'CNPJ somente dígitos (obrigatório para fornecedor)',
  area_atuacao  VARCHAR(120)  NULL,
  aprovado_por  INT UNSIGNED  NULL,
  aprovado_em   DATETIME      NULL,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_usuarios_email (email),
  UNIQUE KEY uq_usuarios_documento (documento),
  KEY idx_usuarios_perfil_status (perfil, status),
  CONSTRAINT fk_usuarios_aprovador FOREIGN KEY (aprovado_por)
    REFERENCES usuarios (id) ON DELETE SET NULL,
  CONSTRAINT chk_usuarios_fornecedor CHECK (perfil <> 'fornecedor' OR documento IS NOT NULL)
) ENGINE = InnoDB;

-- -----------------------------------------------------------------------------
-- EVENTOS (RF05, RF08): pertencem a um organizador
-- status: rascunho -> publicado (liberado para cotação) -> cancelado
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS eventos (
  id                        INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  organizador_id            INT UNSIGNED  NOT NULL,
  nome                      VARCHAR(120)  NOT NULL,
  descricao                 TEXT          NULL,
  local_evento              VARCHAR(200)  NOT NULL,
  data_inicio               DATETIME      NOT NULL,
  data_fim                  DATETIME      NOT NULL,
  publico_minimo            INT UNSIGNED  NOT NULL DEFAULT 0,
  publico_maximo            INT UNSIGNED  NOT NULL,
  publico_esperado          INT UNSIGNED  NULL,
  margem_lucro_percentual   DECIMAL(5,2)  NOT NULL DEFAULT 0.00,
  status                    ENUM('rascunho', 'publicado', 'cancelado') NOT NULL DEFAULT 'rascunho',
  created_at                TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_eventos_organizador (organizador_id),
  KEY idx_eventos_status (status),
  KEY idx_eventos_data_inicio (data_inicio),
  CONSTRAINT fk_eventos_organizador FOREIGN KEY (organizador_id)
    REFERENCES usuarios (id) ON DELETE RESTRICT,
  CONSTRAINT chk_eventos_datas CHECK (data_fim >= data_inicio),
  CONSTRAINT chk_eventos_publico CHECK (publico_maximo > 0 AND publico_maximo >= publico_minimo),
  CONSTRAINT chk_eventos_esperado CHECK (publico_esperado IS NULL
    OR (publico_esperado >= publico_minimo AND publico_esperado <= publico_maximo)),
  CONSTRAINT chk_eventos_margem CHECK (margem_lucro_percentual >= 0 AND margem_lucro_percentual < 100)
) ENGINE = InnoDB;

-- -----------------------------------------------------------------------------
-- ITENS DE COMPOSIÇÃO DE CUSTO (RF06): iluminação, alimentação, bebida...
-- Cada item pode receber propostas de fornecedores (RF10).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS itens_custo (
  id          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  evento_id   INT UNSIGNED  NOT NULL,
  nome        VARCHAR(120)  NOT NULL,
  categoria   ENUM('iluminacao', 'alimentacao', 'bebida', 'seguranca', 'infraestrutura', 'outros') NOT NULL,
  descricao   VARCHAR(500)  NULL,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_item_evento_nome (evento_id, nome),
  CONSTRAINT fk_itens_evento FOREIGN KEY (evento_id)
    REFERENCES eventos (id) ON DELETE CASCADE
) ENGINE = InnoDB;

-- -----------------------------------------------------------------------------
-- CUSTOS DO EVENTO (RF07): fiscais, operacionais e variáveis (não vêm de fornecedor)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS custos_evento (
  id          INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  evento_id   INT UNSIGNED   NOT NULL,
  descricao   VARCHAR(160)   NOT NULL,
  tipo        ENUM('fiscal', 'operacional', 'variavel') NOT NULL,
  valor       DECIMAL(14,2)  NOT NULL,
  created_at  TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_custos_evento (evento_id),
  CONSTRAINT fk_custos_evento FOREIGN KEY (evento_id)
    REFERENCES eventos (id) ON DELETE CASCADE,
  CONSTRAINT chk_custos_valor CHECK (valor >= 0)
) ENGINE = InnoDB;

-- -----------------------------------------------------------------------------
-- PROPOSTAS DE FORNECEDORES (RF10 a RF12)
-- status: enviada -> selecionada (pelo organizador) | cancelada (pelo fornecedor)
--
-- Integridade no próprio banco: a coluna gerada `selecao_chave` recebe o id do
-- item somente quando a proposta está "selecionada". A UNIQUE sobre ela garante
-- no MySQL que cada item tenha no máximo UMA proposta selecionada.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS propostas (
  id              INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  item_custo_id   INT UNSIGNED   NOT NULL,
  fornecedor_id   INT UNSIGNED   NOT NULL,
  valor           DECIMAL(14,2)  NOT NULL,
  descricao       TEXT           NOT NULL,
  validade        DATE           NOT NULL,
  observacoes     VARCHAR(1000)  NULL,
  status          ENUM('enviada', 'selecionada', 'cancelada') NOT NULL DEFAULT 'enviada',
  selecao_chave   INT UNSIGNED   GENERATED ALWAYS AS (CASE WHEN status = 'selecionada' THEN item_custo_id END) VIRTUAL,
  created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_proposta_item_fornecedor (item_custo_id, fornecedor_id),
  UNIQUE KEY uq_proposta_selecionada (selecao_chave),
  KEY idx_propostas_fornecedor (fornecedor_id, status),
  KEY idx_propostas_status (status),
  CONSTRAINT fk_propostas_item FOREIGN KEY (item_custo_id)
    REFERENCES itens_custo (id) ON DELETE CASCADE,
  CONSTRAINT fk_propostas_fornecedor FOREIGN KEY (fornecedor_id)
    REFERENCES usuarios (id) ON DELETE RESTRICT,
  CONSTRAINT chk_propostas_valor CHECK (valor > 0)
) ENGINE = InnoDB;

-- Marketplace acadêmico, sem processamento de pagamentos externos.
CREATE TABLE IF NOT EXISTS revendas (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  vendedor_id INT UNSIGNED NOT NULL,
  comprador_id INT UNSIGNED NULL,
  evento VARCHAR(120) NOT NULL,
  fim_evento DATETIME NOT NULL,
  codigo VARCHAR(512) NOT NULL,
  codigo_hash CHAR(64) NOT NULL UNIQUE,
  valor_centavos INT UNSIGNED NOT NULL CHECK (valor_centavos BETWEEN 100 AND 100000000),
  taxa_centavos INT UNSIGNED NOT NULL DEFAULT 0,
  status ENUM('pendente','publicado','reprovado','retido','contestado','repassado','estornado') NOT NULL DEFAULT 'pendente',
  contestacao VARCHAR(500) NULL,
  moderador_id INT UNSIGNED NULL,
  moderado_em DATETIME NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_revenda_publica (status, fim_evento),
  FOREIGN KEY (vendedor_id) REFERENCES usuarios(id),
  FOREIGN KEY (comprador_id) REFERENCES usuarios(id),
  FOREIGN KEY (moderador_id) REFERENCES usuarios(id),
  CHECK (comprador_id IS NULL OR comprador_id <> vendedor_id)
) ENGINE=InnoDB;
