'use strict';

const { Router } = require('express');
const c = require('../controllers/financeiro.controller');
const { authenticate, requirePerfil, requireAprovado } = require('../middlewares/auth');

const router = Router();

const ORGANIZADOR = [authenticate, requirePerfil('organizador', 'administrador'), requireAprovado];
const FORNECEDOR = [authenticate, requirePerfil('fornecedor'), requireAprovado];

// Itens e custos: edição e exclusão pelo dono do evento (RF06, RF07)
router.put('/itens-custo/:id', ORGANIZADOR, c.atualizarItem);
router.patch('/itens-custo/:id', ORGANIZADOR, c.atualizarItem);
router.delete('/itens-custo/:id', ORGANIZADOR, c.removerItem);
router.put('/custos/:id', ORGANIZADOR, c.atualizarCusto);
router.patch('/custos/:id', ORGANIZADOR, c.atualizarCusto);
router.delete('/custos/:id', ORGANIZADOR, c.removerCusto);

// Propostas (RF10): envio, edição e cancelamento pelo fornecedor
router.post('/itens-custo/:itemId/propostas', FORNECEDOR, c.enviarProposta);
router.put('/propostas/:id', FORNECEDOR, c.atualizarProposta);
router.patch('/propostas/:id', FORNECEDOR, c.atualizarProposta);
router.post('/propostas/:id/cancelar', FORNECEDOR, c.cancelarProposta);

// Seleção de propostas pelo organizador (RF12)
router.post('/propostas/:id/selecionar', ORGANIZADOR, c.selecionarProposta);
router.post('/propostas/:id/liberar', ORGANIZADOR, c.liberarProposta);

module.exports = router;
