'use strict';

const { Router } = require('express');
const c = require('../controllers/fornecedor.controller');
const { authenticate, requirePerfil, requireAprovado } = require('../middlewares/auth');

const router = Router();
const FORNECEDOR_APROVADO = [authenticate, requirePerfil('fornecedor'), requireAprovado];

router.get('/oportunidades', FORNECEDOR_APROVADO, c.oportunidades); // RF09
router.get('/oportunidades/:id', FORNECEDOR_APROVADO, c.oportunidade); // RF09
router.get('/propostas', FORNECEDOR_APROVADO, c.minhasPropostas); // histórico de propostas

module.exports = router;
