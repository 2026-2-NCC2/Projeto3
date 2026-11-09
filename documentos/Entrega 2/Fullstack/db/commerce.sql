CREATE TABLE IF NOT EXISTS commerce_meta (
  id VARCHAR(64) PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS catalogo (
  evento_id INT UNSIGNED PRIMARY KEY,
  cidade VARCHAR(120) NOT NULL,
  categoria VARCHAR(80) NOT NULL,
  arte VARCHAR(30) NOT NULL DEFAULT 'sunset',
  moderacao VARCHAR(30) NOT NULL DEFAULT 'pendente',
  destaque INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (evento_id) REFERENCES eventos(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS lotes (
  id VARCHAR(64) PRIMARY KEY,
  evento_id INT UNSIGNED NOT NULL,
  nome VARCHAR(100) NOT NULL,
  setor VARCHAR(100) NOT NULL,
  valor_centavos INTEGER NOT NULL CHECK (valor_centavos >= 100),
  capacidade INTEGER NOT NULL CHECK (capacidade > 0),
  ativo INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (evento_id) REFERENCES eventos(id) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS reservas (
  id VARCHAR(64) PRIMARY KEY,
  visitante VARCHAR(64) NOT NULL,
  usuario_id INT UNSIGNED NULL,
  lote_id VARCHAR(64) NOT NULL,
  anuncio_id VARCHAR(64) NULL,
  quantidade INTEGER NOT NULL,
  preco_centavos INTEGER NOT NULL DEFAULT 0,
  conveniencia_bp INTEGER NOT NULL DEFAULT 0,
  revenda_bp INTEGER NOT NULL DEFAULT 150,
  expira_ms BIGINT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'ativa',
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  FOREIGN KEY (lote_id) REFERENCES lotes(id)
);
CREATE TABLE IF NOT EXISTS pedidos (
  id VARCHAR(64) PRIMARY KEY,
  reserva_id VARCHAR(64) NOT NULL UNIQUE,
  comprador_id INT UNSIGNED NOT NULL,
  vendedor_id INT UNSIGNED NOT NULL,
  lote_id VARCHAR(64) NOT NULL,
  tipo VARCHAR(30) NOT NULL,
  quantidade INTEGER NOT NULL,
  valor_centavos INTEGER NOT NULL,
  taxa_centavos INTEGER NOT NULL,
  total_centavos INTEGER NOT NULL,
  liquido_centavos INTEGER NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'retido',
  metodo VARCHAR(20) NOT NULL,
  motivo VARCHAR(500) NULL,
  criado_ms BIGINT NOT NULL,
  FOREIGN KEY (reserva_id) REFERENCES reservas(id),
  FOREIGN KEY (comprador_id) REFERENCES usuarios(id),
  FOREIGN KEY (vendedor_id) REFERENCES usuarios(id),
  FOREIGN KEY (lote_id) REFERENCES lotes(id)
);
CREATE TABLE IF NOT EXISTS ingressos (
  id VARCHAR(64) PRIMARY KEY,
  lote_id VARCHAR(64) NOT NULL,
  dono_id INT UNSIGNED NOT NULL,
  pedido_id VARCHAR(64) NOT NULL,
  original_pedido_id VARCHAR(64) NOT NULL,
  valor_original INTEGER NOT NULL,
  codigo VARCHAR(100) NOT NULL UNIQUE,
  status VARCHAR(30) NOT NULL DEFAULT 'valido',
  checkin_ms BIGINT NULL,
  FOREIGN KEY (lote_id) REFERENCES lotes(id),
  FOREIGN KEY (dono_id) REFERENCES usuarios(id),
  FOREIGN KEY (pedido_id) REFERENCES pedidos(id)
);
CREATE TABLE IF NOT EXISTS anuncios (
  id VARCHAR(64) PRIMARY KEY,
  ingresso_id VARCHAR(64) NOT NULL,
  vendedor_id INT UNSIGNED NOT NULL,
  comprador_id INT UNSIGNED NULL,
  pedido_id VARCHAR(64) NULL,
  anterior_pedido_id VARCHAR(64) NOT NULL,
  chave_ativa VARCHAR(64) GENERATED ALWAYS AS (CASE WHEN status IN ('pendente','publicado') THEN ingresso_id ELSE NULL END) VIRTUAL,
  preco_centavos INTEGER NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pendente',
  criado_ms BIGINT NOT NULL,
  UNIQUE (chave_ativa),
  FOREIGN KEY (ingresso_id) REFERENCES ingressos(id),
  FOREIGN KEY (vendedor_id) REFERENCES usuarios(id),
  FOREIGN KEY (comprador_id) REFERENCES usuarios(id),
  FOREIGN KEY (pedido_id) REFERENCES pedidos(id),
  FOREIGN KEY (anterior_pedido_id) REFERENCES pedidos(id)
);
CREATE TABLE IF NOT EXISTS auditoria (
  id VARCHAR(64) PRIMARY KEY,
  usuario_id INT UNSIGNED NULL,
  acao VARCHAR(100) NOT NULL,
  recurso VARCHAR(120) NOT NULL,
  detalhe VARCHAR(500) NOT NULL,
  criado_ms BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS notificacoes (
  id VARCHAR(64) PRIMARY KEY,
  usuario_id INT UNSIGNED NOT NULL,
  texto VARCHAR(500) NOT NULL,
  lida INTEGER NOT NULL DEFAULT 0,
  criado_ms BIGINT NOT NULL,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);
CREATE TABLE IF NOT EXISTS servicos (
  id VARCHAR(64) PRIMARY KEY,
  fornecedor_id INT UNSIGNED NOT NULL,
  titulo VARCHAR(100) NOT NULL,
  categoria VARCHAR(80) NOT NULL,
  descricao VARCHAR(1000) NOT NULL,
  valor_centavos INTEGER NOT NULL CHECK (valor_centavos >= 0),
  portfolio_url VARCHAR(500) NULL,
  ativo INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (fornecedor_id) REFERENCES usuarios(id)
);
CREATE TABLE IF NOT EXISTS contratos (
  id VARCHAR(64) PRIMARY KEY,
  proposta_id INT UNSIGNED NOT NULL UNIQUE,
  status VARCHAR(30) NOT NULL DEFAULT 'ativo',
  atualizado_ms BIGINT NOT NULL,
  FOREIGN KEY (proposta_id) REFERENCES propostas(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS recuperacoes (
  id VARCHAR(64) PRIMARY KEY,
  usuario_id INT UNSIGNED NULL,
  email VARCHAR(160) NOT NULL,
  codigo_hash VARCHAR(64) NOT NULL,
  expira_ms BIGINT NOT NULL,
  tentativas INTEGER NOT NULL DEFAULT 0,
  usado INTEGER NOT NULL DEFAULT 0,
  criado_ms BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS versoes_sessao (
  usuario_id INT UNSIGNED PRIMARY KEY,
  versao INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);
