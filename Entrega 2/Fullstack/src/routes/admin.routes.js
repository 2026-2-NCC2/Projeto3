'use strict';

const { Router } = require('express');
const c = require('../controllers/admin.controller');
const { authenticate, requirePerfil } = require('../middlewares/auth');

const router = Router();
const SOMENTE_ADMIN = [authenticate, requirePerfil('administrador')];

router.get('/usuarios', SOMENTE_ADMIN, c.usuarios); // RF03: pendentes e histórico
router.patch('/usuarios/:id/status', SOMENTE_ADMIN, c.decidirUsuario); // RF03: aprovar/rejeitar
router.get('/eventos', SOMENTE_ADMIN, c.eventos); // RF14: visão de eventos
router.get('/relatorios/resumo', SOMENTE_ADMIN, c.resumo); // RF14: indicadores

module.exports = router;
