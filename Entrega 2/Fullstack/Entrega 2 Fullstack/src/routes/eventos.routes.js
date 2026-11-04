'use strict';

const { Router } = require('express');
const c = require('../controllers/evento.controller');
const { authenticate, requirePerfil, requireAprovado } = require('../middlewares/auth');

const router = Router();

const LEITURA = [authenticate, requirePerfil('organizador', 'administrador'), requireAprovado];
const ESCRITA = [authenticate, requirePerfil('organizador', 'administrador'), requireAprovado];

// CRUD do evento (Entrega 1)
router.get('/', LEITURA, c.list);
router.post('/', ESCRITA, c.create);
router.get('/:id', LEITURA, c.get);
router.put('/:id', ESCRITA, c.replace);
router.patch('/:id', ESCRITA, c.patch);
router.delete('/:id', ESCRITA, c.remove);

// Ciclo de vida e publicação para cotação (RF08)
router.post('/:id/publicar', ESCRITA, c.publicar);
router.post('/:id/cancelar', ESCRITA, c.cancelar);

// Composição de custo (RF06) e custos do evento (RF07)
router.get('/:id/itens-custo', LEITURA, c.listarItens);
router.post('/:id/itens-custo', ESCRITA, c.criarItem);
router.get('/:id/custos', LEITURA, c.listarCustos);
router.post('/:id/custos', ESCRITA, c.criarCusto);

// Cotações, orçamento e ticket (RF11 a RF13)
router.get('/:id/cotacoes', LEITURA, c.cotacoes);
router.get('/:id/orcamento', LEITURA, c.orcamento);
router.get('/:id/ticket', LEITURA, c.ticket);

module.exports = router;
