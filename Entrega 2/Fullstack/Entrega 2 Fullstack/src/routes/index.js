'use strict';

const { Router } = require('express');
const { ping } = require('../db');
const authRouter = require('./auth.routes');
const adminRouter = require('./admin.routes');
const fornecedorRouter = require('./fornecedor.routes');
const eventosRouter = require('./eventos.routes');
const financeiroRouter = require('./financeiro.routes');

const router = Router();

/** GET /api/health: 200 se API e MySQL respondem; 503 caso contrário. */
router.get('/health', async (req, res) => {
  try {
    await ping();
    res.json({ status: 'ok', database: 'up', uptime: Math.round(process.uptime()) });
  } catch {
    res.status(503).json({ status: 'degraded', database: 'down' });
  }
});

router.use('/commerce', require('../commerce/routes'));
router.use('/auth', authRouter);
router.use('/admin', adminRouter);
router.use('/fornecedor', fornecedorRouter);
router.use('/eventos', eventosRouter);
router.use('/revendas', (_req,res)=>res.status(410).json({error:{status:410,message:'A revenda agora é feita pela carteira do comprador em /api/commerce/anuncios.'}}));
router.use(financeiroRouter); // /api/itens-custo, /api/custos, /api/propostas

module.exports = router;
