-- =============================================================================
-- Dados de demonstração (fictícios). Execute UMA vez, após db/schema.sql.
-- Senhas de demonstração: admin = Admin@2026 | demais = Demo@2026
-- TROQUE essas senhas antes de publicar o sistema.
-- =============================================================================
USE trocaticket;
START TRANSACTION;
SET @calouros_inicio = TIMESTAMP(CURRENT_DATE + INTERVAL 30 DAY, '20:00:00');
SET @workshop_inicio = TIMESTAMP(CURRENT_DATE + INTERVAL 40 DAY, '09:00:00');

INSERT INTO usuarios (id, nome, email, senha_hash, perfil, status, telefone, razao_social, documento, area_atuacao, aprovado_por, aprovado_em) VALUES
(1, 'Administrador TrocaTicket', 'admin@trocaticket.com.br', 'scrypt$890d4db964176573ae7ef3257b126f06$d446c361d398494dd329f2f3643f1eeaf93c8a4cf520660fecfa33a3af41ecd6c38c5600bfdb420fd7af1c0f7b6e400f131dcb3249ecb3ff861a607de3c1bbd6', 'administrador', 'aprovado', NULL, NULL, NULL, NULL, NULL, NOW()),
(2, 'Organizador Demo', 'organizador@demo.com', 'scrypt$658466e325434ac2c4a400e2ca9bf417$d4b660f8fa15bfd797386e54aaf54e26bcee2899a1dac0e863957f4993a0af2fc848e5d7b5f7f647c3efc0a51d36e9582f32d7c068dd01a308151c673c54dade', 'organizador', 'aprovado', '11999990001', 'Demo Produções Ltda', NULL, NULL, 1, NOW()),
(3, 'Organizador Pendente', 'pendente@demo.com', 'scrypt$658466e325434ac2c4a400e2ca9bf417$d4b660f8fa15bfd797386e54aaf54e26bcee2899a1dac0e863957f4993a0af2fc848e5d7b5f7f647c3efc0a51d36e9582f32d7c068dd01a308151c673c54dade', 'organizador', 'pendente', NULL, NULL, NULL, NULL, NULL, NULL),
(4, 'Sabor & Cia Eventos', 'fornecedor@demo.com', 'scrypt$658466e325434ac2c4a400e2ca9bf417$d4b660f8fa15bfd797386e54aaf54e26bcee2899a1dac0e863957f4993a0af2fc848e5d7b5f7f647c3efc0a51d36e9582f32d7c068dd01a308151c673c54dade', 'fornecedor', 'aprovado', '11999990002', 'Sabor & Cia Eventos Ltda', '11222333000181', 'Alimentação e bebidas', 1, NOW()),
(5, 'LuzCena Iluminação', 'luz@demo.com', 'scrypt$658466e325434ac2c4a400e2ca9bf417$d4b660f8fa15bfd797386e54aaf54e26bcee2899a1dac0e863957f4993a0af2fc848e5d7b5f7f647c3efc0a51d36e9582f32d7c068dd01a308151c673c54dade', 'fornecedor', 'aprovado', '11999990003', 'LuzCena Iluminação e Som Ltda', '04252011000110', 'Iluminação e som', 1, NOW()),
(6, 'Fornecedor Pendente', 'fornecedor.pendente@demo.com', 'scrypt$658466e325434ac2c4a400e2ca9bf417$d4b660f8fa15bfd797386e54aaf54e26bcee2899a1dac0e863957f4993a0af2fc848e5d7b5f7f647c3efc0a51d36e9582f32d7c068dd01a308151c673c54dade', 'fornecedor', 'pendente', NULL, NULL, '00000000000191', 'Segurança patrimonial', NULL, NULL);

INSERT INTO eventos (id, organizador_id, nome, descricao, local_evento, data_inicio, data_fim, publico_minimo, publico_maximo, publico_esperado, margem_lucro_percentual, status) VALUES
(1, 2, 'Festa de Calouros 2026', 'Recepção dos calouros com DJ e área de alimentação.', 'Espaço Cultural FECAP, São Paulo', @calouros_inicio, @calouros_inicio + INTERVAL 7 HOUR, 200, 800, 500, 20.00, 'publicado'),
(2, 2, 'Workshop de Cálculo Aplicado', 'Oficina prática de Polinômio de Taylor.', 'Auditório Principal', @workshop_inicio, @workshop_inicio + INTERVAL 8 HOUR, 30, 120, NULL, 15.00, 'rascunho');

INSERT INTO itens_custo (id, evento_id, nome, categoria, descricao) VALUES
(1, 1, 'Iluminação de palco', 'iluminacao', 'Refletores, moving heads e controle DMX.'),
(2, 1, 'Buffet de alimentação', 'alimentacao', 'Serviço para 500 pessoas.'),
(3, 1, 'Bebidas não alcoólicas e drinks', 'bebida', 'Água, refrigerantes e sucos.'),
(4, 1, 'Segurança e controle de acesso', 'seguranca', 'Equipe de segurança e portaria.');

INSERT INTO custos_evento (id, evento_id, descricao, tipo, valor) VALUES
(1, 1, 'Alvará e taxas municipais', 'fiscal', 1800.00),
(2, 1, 'Limpeza e manutenção do local', 'operacional', 1200.00),
(3, 1, 'Reserva para contingências', 'variavel', 900.00);

INSERT INTO propostas (id, item_custo_id, fornecedor_id, valor, descricao, validade, observacoes, status) VALUES
(1, 1, 5, 4300.00, 'Locação de 20 refletores LED e 4 moving heads com operador.', CURRENT_DATE + INTERVAL 20 DAY, 'Montagem inclusa.', 'selecionada'),
(2, 2, 4, 9500.00, 'Buffet completo para 500 pessoas, com cardápio vegetariano.', CURRENT_DATE + INTERVAL 18 DAY, NULL, 'selecionada'),
(3, 3, 4, 6200.00, 'Bebidas não alcoólicas e drinks sem álcool para 500 pessoas.', CURRENT_DATE + INTERVAL 18 DAY, NULL, 'enviada'),
(4, 3, 5, 5800.00, 'Pacote de bebidas com dispensers e copos reutilizáveis.', CURRENT_DATE + INTERVAL 22 DAY, 'Inclui reposição.', 'enviada');

COMMIT;
