'use strict';

const { Router } = require('express');
const { asyncHandler } = require('../errors');
const { authenticate,requireAprovado,requirePerfil } = require('../middlewares/auth');
const market=require('./market.service');
const manage=require('./management.service');
const account=require('./account.service');
const { settings,rows }=require('./core');
const router=Router();
router.use((req,_res,next)=>{req.body??={};next();});
const read=fn=>asyncHandler(async(req,res)=>{res.set('Cache-Control','no-store');res.json(await fn(req));});
const action=fn=>read(async req=> (await fn(req)) ?? {ok:true});
const approved=[authenticate,requireAprovado];
const admin=[...approved,requirePerfil('administrador')];
const organizer=[...approved,requirePerfil('organizador','administrador')];
const supplier=[...approved,requirePerfil('fornecedor','administrador')];

router.get('/opcoes-catalogo',read(()=>rows("SELECT DISTINCT c.cidade,c.categoria FROM catalogo c JOIN eventos e ON e.id=c.evento_id WHERE c.moderacao='aprovado' AND e.status='publicado'")));
router.get('/catalogo',read(req=>market.catalog(req.query)));
router.get('/catalogo/:id',read(req=>market.detail(req.params.id)));
router.get('/regras',read(()=>settings()));
router.get('/servicos',read(()=>manage.publicServices()));
router.post('/reservas',read(async req=>({id:await market.reserve(req.body)})));
router.get('/reservas/:id',read(req=>market.reservation(req.params.id,req.get('X-Visitante')||'')));
router.delete('/reservas/:id',action(req=>market.release(req.params.id,req.get('X-Visitante')||'')));
router.post('/pagar',...approved,read(req=>market.pay(req.user,req.body)));
router.get('/carteira',...approved,read(req=>market.wallet(req.user)));
router.get('/ingressos/:id/qr',...approved,read(req=>market.ticketQr(req.params.id,req.user)));
router.post('/anuncios',...approved,read(req=>market.announce(req.user,req.body)));
router.delete('/anuncios/:id',...approved,action(req=>market.cancelListing(req.user,req.params.id)));
router.get('/pedidos',...approved,read(req=>market.orders(req.user)));
router.post('/pedidos/:id/contestar',...approved,action(req=>market.dispute(req.user,req.params.id,req.body)));

router.post('/recuperar-senha',read(req=>account.requestRecovery(req.body)));
router.post('/redefinir-senha',read(req=>account.resetPassword(req.body)));
router.patch('/perfil',authenticate,action(req=>account.updateProfile(req.user,req.body)));
router.get('/notificacoes',authenticate,read(req=>account.notifications(req.user)));
router.post('/notificacoes/lidas',authenticate,action(req=>account.readNotifications(req.user)));

router.get('/gestao/eventos/:id',...organizer,read(req=>manage.sales(req.user,req.params.id)));
router.post('/gestao/eventos/:id/catalogo',...organizer,read(req=>manage.publishCatalog(req.user,req.params.id,req.body)));
router.post('/gestao/eventos/:id/lotes',...organizer,read(req=>manage.saveLot(req.user,req.params.id,req.body)));
router.post('/gestao/eventos/:id/checkin',...organizer,read(req=>manage.checkin(req.user,req.params.id,req.body)));
router.post('/gestao/eventos/:id/cancelar',...organizer,read(req=>manage.cancelEvent(req.user,req.params.id)));
router.get('/gestao/servicos',...supplier,read(req=>manage.ownServices(req.user)));
router.post('/gestao/servicos',...supplier,read(req=>manage.services(req.user,req.body)));
router.get('/gestao/contratos',...supplier,read(req=>manage.contracts(req.user)));
router.post('/gestao/contratos/:id/concluir',...supplier,action(req=>manage.completeContract(req.user,req.params.id)));
router.get('/admin',...admin,read(()=>manage.adminData()));
router.patch('/admin/regras',...admin,read(req=>manage.saveSettings(req.user,req.body)));
router.post('/admin/eventos/:id/moderar',...admin,action(req=>manage.moderate(req.user,'evento',req.params.id,req.body)));
router.post('/admin/anuncios/:id/moderar',...admin,action(req=>manage.moderate(req.user,'anuncio',req.params.id,req.body)));
router.post('/admin/pedidos/:id/resolver',...admin,action(req=>manage.resolveOrder(req.user,req.params.id,req.body)));
// Publicação de um perfil de serviços sempre respeita aprovação do fornecedor.
router.get('/fornecedores/:id',read(async req=>({
  fornecedor:(await rows('SELECT id,nome,razao_social,area_atuacao FROM usuarios WHERE id=? AND perfil=\'fornecedor\' AND status=\'aprovado\'',[req.params.id]))[0]??null,
  servicos:await rows('SELECT * FROM servicos WHERE fornecedor_id=? AND ativo=1',[req.params.id]),
})));
module.exports=router;
