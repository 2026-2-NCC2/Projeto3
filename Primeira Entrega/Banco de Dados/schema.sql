-- =================================================================
-- Projeto Interdisciplinar: TrocaTicket
-- Script Inicial do Banco de Dados (Entrega 1)
-- =================================================================

-- Criar e usar o banco de dados
CREATE DATABASE IF NOT EXISTS trocaticket_db;
USE trocaticket_db;

-- =================================================================
-- 1. Tabela: USUARIOS
-- =================================================================
CREATE TABLE IF NOT EXISTS usuarios (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    nome_completo VARCHAR(150) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    senha_hash VARCHAR(255) NOT NULL,
    tipo_perfil ENUM('Organizador', 'Fornecedor', 'Participante', 'Admin') NOT NULL,
    documento VARCHAR(20) NOT NULL, -- Serve para CPF ou CNPJ
    telefone VARCHAR(20),
    status_aprovacao ENUM('Pendente', 'Aprovado', 'Rejeitado') DEFAULT 'Pendente',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- =================================================================
-- 2. Tabela: EVENTOS
-- =================================================================
CREATE TABLE IF NOT EXISTS eventos (
    id_evento INT AUTO_INCREMENT PRIMARY KEY,
    id_organizador INT NOT NULL,
    nome_evento VARCHAR(150) NOT NULL,
    data_evento DATE NOT NULL,
    local_evento VARCHAR(200),
    publico_minimo INT NOT NULL,
    publico_maximo INT NOT NULL,
    margem_lucro DECIMAL(5,2) DEFAULT 0.00, -- Ex: 20.50 (representa 20,5%)
    status_evento ENUM('Planejamento', 'Cotação Aberta', 'Finalizado') DEFAULT 'Planejamento',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Chave Estrangeira
    CONSTRAINT fk_evento_organizador 
        FOREIGN KEY (id_organizador) 
        REFERENCES usuarios(id_usuario) 
        ON DELETE CASCADE
);

-- =================================================================
-- 3. Tabela: ITENS_CUSTO
-- =================================================================
CREATE TABLE IF NOT EXISTS itens_custo (
    id_item INT AUTO_INCREMENT PRIMARY KEY,
    id_evento INT NOT NULL,
    categoria VARCHAR(100) NOT NULL, -- Ex: Segurança, Iluminação, Bebidas
    descricao_item VARCHAR(255) NOT NULL,
    valor_estimado DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Chave Estrangeira
    CONSTRAINT fk_item_evento 
        FOREIGN KEY (id_evento) 
        REFERENCES eventos(id_evento) 
        ON DELETE CASCADE
);

-- =================================================================
-- 4. Tabela: PROPOSTAS
-- =================================================================
CREATE TABLE IF NOT EXISTS propostas (
    id_proposta INT AUTO_INCREMENT PRIMARY KEY,
    id_item INT NOT NULL,
    id_fornecedor INT NOT NULL,
    valor_ofertado DECIMAL(10,2) NOT NULL,
    validade_proposta DATE NOT NULL,
    observacoes TEXT,
    status_proposta ENUM('Pendente', 'Aprovada', 'Rejeitada') DEFAULT 'Pendente',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Chaves Estrangeiras
    CONSTRAINT fk_proposta_item 
        FOREIGN KEY (id_item) 
        REFERENCES itens_custo(id_item) 
        ON DELETE CASCADE,
        
    CONSTRAINT fk_proposta_fornecedor 
        FOREIGN KEY (id_fornecedor) 
        REFERENCES usuarios(id_usuario) 
        ON DELETE CASCADE
);
