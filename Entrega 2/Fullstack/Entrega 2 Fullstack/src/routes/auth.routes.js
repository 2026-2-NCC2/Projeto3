'use strict';

const { Router } = require('express');
const c = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth');

const router = Router();

const config = require('../config');
const { asyncHandler } = require('../errors');
const { loginDemo } = require('../services/auth.service');

router.get('/modo', (_req, res) => res.json({ apresentacao: config.demo }));
if (config.demo) {
  router.post('/demonstracao', asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'no-store').json(await loginDemo(req.body));
  }));
}

router.post('/cadastro/comprador', asyncHandler(async (req,res) => res.status(201).json(await require('../services/auth.service').cadastrar('comprador',req.body))));
router.post('/cadastro/organizador', c.cadastrarOrganizador); // RF01
router.post('/cadastro/fornecedor', c.cadastrarFornecedor); // RF02
router.post('/login', c.login); // RF04
router.get('/me', authenticate, c.me);

module.exports = router;
