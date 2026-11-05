'use strict';

const { HttpError } = require('../errors');
const { uid,code,now,endTime,text,integer,one,rows,settings,transact,audit,notify,requireRole } = require('./core');
const market=require('./market.service');
const CATEGORIES=['Eletrônica','Indie & Rock','Jazz & Blues','Universitário','Sertanejo','Pop','Cultura','Outros'];

async function organizerEvent(user,id,db) {
  const e=await one('SELECT * FROM eventos WHERE id=?',[id],db);
  if (!e || user.perfil!=='administrador' && e.organizador_id!==user.id) throw new HttpError(404,'Evento não encontrado.');
  return e;
}
async function sales(user,id) {
  await organizerEvent(user,id);
  const lotes=await market.availableLots(id);
  const orders=await rows(`SELECT p.*,u.nome AS comprador FROM pedidos p JOIN usuarios u ON u.id=p.comprador_id
    JOIN lotes l ON l.id=p.lote_id WHERE l.evento_id=? ORDER BY p.criado_ms DESC`,[id]);
  const checkins=await one(`SELECT COUNT(*) AS n FROM ingressos i JOIN lotes l ON l.id=i.lote_id WHERE l.evento_id=? AND i.status='utilizado'`,[id]);
  const catalog=await one('SELECT * FROM catalogo WHERE evento_id=?',[id]);
  const daily={};
  orders.filter(p=>p.tipo==='primario' && p.status!=='estornado').forEach(p=>{
    const d=new Date(p.criado_ms).toISOString().slice(0,10);
    daily[d]=(daily[d]||0)+p.valor_centavos;
  });
  return { lotes,pedidos:orders,checkins:checkins.n,catalogo:catalog,diario:daily };
}
async function publishCatalog(user,id,body) {
  return transact(async db=>{
    const e=await organizerEvent(user,id,db);
    if (e.status==='cancelado' || endTime(e)<=now()) throw new HttpError(409,'Evento cancelado ou encerrado.');
    const city=text(body.cidade,'cidade',2,120),category=text(body.categoria,'categoria',2,80);
    if (!CATEGORIES.includes(category)) throw new HttpError(400,'Categoria inválida.');
    const old=await one('SELECT * FROM catalogo WHERE evento_id=?',[id],db);
    const moderation=user.perfil==='administrador'?'aprovado':(old?.moderacao==='aprovado'?'aprovado':'pendente');
    if (old) await db.query('UPDATE catalogo SET cidade=?,categoria=?,moderacao=? WHERE evento_id=?',[city,category,moderation,id]);
    else await db.query('INSERT INTO catalogo (evento_id,cidade,categoria,arte,moderacao) VALUES (?,?,?,?,?)',[id,city,category,'sunset',moderation]);
    // Vendas e cotações compartilham o status publicado do evento.
    await db.query("UPDATE eventos SET status='publicado' WHERE id=?",[id]);
    await audit(db,user,'publicar_catalogo',id,moderation);
    return {moderacao:moderation};
  });
}
async function saveLot(user,eventId,body) {
  return transact(async db=>{
    const e=await organizerEvent(user,eventId,db);
    if (e.status==='cancelado' || endTime(e)<=now()) throw new HttpError(409,'Este evento não pode receber lotes.');
    const nome=text(body.nome,'nome do lote',2,100),setor=text(body.setor,'setor',2,100);
    const price=integer(body.valor_centavos,'Preço em centavos',100,100000000);
    const capacity=integer(body.capacidade,'Capacidade',1,1000000);
    const all=await market.availableLots(eventId,db);
    const soldCapacity=all.filter(l=>l.id!==body.id && l.ativo).reduce((sum,l)=>sum+l.capacidade,0);
    if (soldCapacity+capacity>e.publico_maximo) throw new HttpError(409,'A soma das capacidades dos lotes supera o público máximo do evento.');
    const id=body.id||uid();
    if (body.id) {
      const lot=all.find(l=>l.id===body.id);
      if (!lot) throw new HttpError(404,'Lote não encontrado.');
      if (capacity<lot.vendidos+lot.reservados) throw new HttpError(409,'Capacidade menor que os ingressos já vendidos e reservados.');
      await db.query('UPDATE lotes SET nome=?,setor=?,valor_centavos=?,capacidade=?,ativo=? WHERE id=?',
        [nome,setor,price,capacity,body.ativo===false?0:1,id]);
    } else {
      await db.query('INSERT INTO lotes (id,evento_id,nome,setor,valor_centavos,capacidade) VALUES (?,?,?,?,?,?)',
        [id,eventId,nome,setor,price,capacity]);
    }
    await audit(db,user,'salvar_lote',id);
    return {id};
  });
}
async function checkin(user,eventId,body) {
  return transact(async db=>{
    const e=await organizerEvent(user,eventId,db);
    if (e.status!=='publicado') throw new HttpError(409,'Check-in indisponível neste evento.');
    const ticket=await one(`SELECT i.*,u.nome AS titular FROM ingressos i JOIN lotes l ON l.id=i.lote_id
      JOIN usuarios u ON u.id=i.dono_id WHERE i.codigo=? AND l.evento_id=?`,[body.codigo||'',eventId],db);
    if (!ticket) throw new HttpError(404,'Código inválido para este evento.');
    if (ticket.status!=='valido') throw new HttpError(409,'Ingresso já utilizado ou cancelado.');
    const listing=await one("SELECT id FROM anuncios WHERE ingresso_id=? AND status IN ('pendente','publicado')",[ticket.id],db);
    const order=await one('SELECT status FROM pedidos WHERE id=?',[ticket.pedido_id],db);
    if (listing || ['contestado','estornado'].includes(order.status)) throw new HttpError(409,'Ingresso bloqueado para validação.');
    await db.query("UPDATE ingressos SET status='utilizado',checkin_ms=? WHERE id=?",[now(),ticket.id]);
    await audit(db,user,'checkin',ticket.id);
    return {mensagem:'Entrada validada.',titular:ticket.titular};
  });
}
async function adminData() {
  const orders=await rows(`SELECT p.*,e.nome AS evento_nome,e.data_fim,u.nome AS comprador
    FROM pedidos p JOIN lotes l ON l.id=p.lote_id JOIN eventos e ON e.id=l.evento_id
    JOIN usuarios u ON u.id=p.comprador_id ORDER BY p.criado_ms DESC LIMIT 200`);
  return { regras:await settings(), pedidos:orders,
    anuncios:await rows(`SELECT a.*,e.nome AS evento_nome,u.nome AS vendedor,l.setor
      FROM anuncios a JOIN ingressos i ON i.id=a.ingresso_id JOIN lotes l ON l.id=i.lote_id
      JOIN eventos e ON e.id=l.evento_id JOIN usuarios u ON u.id=a.vendedor_id ORDER BY a.criado_ms DESC LIMIT 200`),
    eventos:await rows(`SELECT e.id,e.nome,e.status,c.moderacao,c.cidade FROM eventos e JOIN catalogo c ON c.evento_id=e.id ORDER BY e.id DESC`),
    logs:await rows('SELECT a.*,u.nome AS usuario FROM auditoria a LEFT JOIN usuarios u ON u.id=a.usuario_id ORDER BY a.criado_ms DESC LIMIT 100') };
}
async function saveSettings(user,body) {
  const rules={conveniencia_bp:integer(body.conveniencia_bp,'Taxa de conveniência',0,3000),
    revenda_bp:integer(body.revenda_bp,'Taxa de revenda',0,3000),
    margem_revenda_bp:integer(body.margem_revenda_bp,'Limite de acréscimo na revenda',0,10000),
    moderar_revenda:body.moderar_revenda===true};
  return transact(async db=>{
    await db.query("UPDATE commerce_meta SET value=? WHERE id='regras'",[JSON.stringify(rules)]);
    await audit(db,user,'configurar_taxas','regras',JSON.stringify(rules));
    return rules;
  });
}
async function moderate(user,type,id,body) {
  if (!['aprovado','rejeitado'].includes(body.status)) throw new HttpError(400,'Decisão inválida.');
  return transact(async db=>{
    if (type==='evento') {
      await organizerEvent({perfil:'administrador'},id,db);
      await db.query('UPDATE catalogo SET moderacao=? WHERE evento_id=?',[body.status,id]);
    } else {
      const listing=await one("SELECT a.*,i.status AS ticket_status,e.data_fim FROM anuncios a JOIN ingressos i ON i.id=a.ingresso_id JOIN lotes l ON l.id=i.lote_id JOIN eventos e ON e.id=l.evento_id WHERE a.id=?",[id],db);
      if (!listing || !['pendente','publicado','reprovado'].includes(listing.status)) throw new HttpError(409,'Anúncio indisponível para moderação.');
      if (body.status==='aprovado' && (listing.ticket_status!=='valido' || endTime(listing)<=now())) throw new HttpError(409,'O ingresso já não está válido para venda.');
      await db.query('UPDATE anuncios SET status=? WHERE id=?',[body.status==='aprovado'?'publicado':'reprovado',id]);
      await db.query("UPDATE reservas SET status='cancelada' WHERE anuncio_id=? AND status='ativa'",[id]);
      await notify(db,listing.vendedor_id,body.status==='aprovado'?'Seu anúncio foi aprovado.':'Seu anúncio foi reprovado.');
    }
    await audit(db,user,'moderar_'+type,id,body.status);
  });
}
async function refund(db,p,user) {
  if (p.tipo==='secundario') {
    const a=await one('SELECT * FROM anuncios WHERE pedido_id=?',[p.id],db);
    if (!a) throw new HttpError(409,'Relação da revenda não encontrada.');
    const ticket=await one('SELECT * FROM ingressos WHERE id=?',[a.ingresso_id],db);
    if (ticket.pedido_id!==p.id) throw new HttpError(409,'Ingresso já transferido em outra transação.');
    await db.query("UPDATE reservas SET status='cancelada' WHERE status='ativa' AND anuncio_id IN (SELECT id FROM anuncios WHERE ingresso_id=?)",[a.ingresso_id]);
    await db.query("UPDATE anuncios SET status='cancelado' WHERE ingresso_id=? AND status IN ('pendente','publicado')",[a.ingresso_id]);
    await db.query("UPDATE ingressos SET dono_id=?,pedido_id=?,codigo=?,status='valido',checkin_ms=NULL WHERE id=?", 
      [a.vendedor_id,a.anterior_pedido_id,code(),a.ingresso_id]);
    await db.query("UPDATE anuncios SET status='estornado' WHERE id=?",[a.id]);
  } else {
    const transferred=await one('SELECT id FROM ingressos WHERE lote_id=? AND original_pedido_id=? AND (dono_id<>? OR pedido_id<>?)',[p.lote_id,p.id,p.comprador_id,p.id],db);
    if (transferred) throw new HttpError(409,'Há ingressos transferidos. Resolva as revendas primeiro.');
    await db.query("UPDATE anuncios SET status='cancelado' WHERE ingresso_id IN (SELECT id FROM ingressos WHERE pedido_id=?) AND status IN ('pendente','publicado')",[p.id]);
    await db.query("UPDATE ingressos SET status='cancelado' WHERE pedido_id=?",[p.id]);
  }
  await db.query("UPDATE pedidos SET status='estornado',taxa_centavos=0,liquido_centavos=0 WHERE id=?",[p.id]);
  await audit(db,user,'estornar',p.id,`Estorno integral: ${p.total_centavos} centavos`);
  await notify(db,p.comprador_id,'Seu estorno integral foi confirmado na simulação.');
}
async function resolveOrder(user,id,body) {
  return transact(async db=>{
    const p=await one(`SELECT p.*,e.data_fim,e.status AS evento_status FROM pedidos p JOIN lotes l ON l.id=p.lote_id JOIN eventos e ON e.id=l.evento_id WHERE p.id=?`,[id],db);
    if (!p) throw new HttpError(404,'Transação não encontrada.');
    if (body.acao==='repassar') {
      if (p.status!=='retido' || endTime(p)>now()) throw new HttpError(409,'O repasse requer evento encerrado e ausência de contestação.');
      await db.query("UPDATE pedidos SET status='repassado' WHERE id=?",[id]);
      await notify(db,p.vendedor_id,'Seu repasse foi concluído na simulação.');
      await audit(db,user,'repassar',id,`Líquido: ${p.liquido_centavos} centavos`);
    } else if (body.acao==='estornar') {
      if (!['retido','contestado'].includes(p.status)) throw new HttpError(409,'Transação já encerrada.');
      await refund(db,p,user);
    } else if (body.acao==='liberar') {
      if (p.status!=='contestado') throw new HttpError(409,'Transação sem contestação.');
      await db.query("UPDATE pedidos SET status='retido',motivo=NULL WHERE id=?",[id]);
      await audit(db,user,'resolver_disputa',id,text(body.motivo,'justificativa',8,500));
      await notify(db,p.comprador_id,'A contestação foi analisada e o valor permanece retido.');
    } else throw new HttpError(400,'Ação inválida.');
  });
}
async function cancelEvent(user,id) {
  return transact(async db=>{
    const e=await organizerEvent(user,id,db);
    if (e.status==='cancelado') throw new HttpError(409,'Evento já cancelado.');
    const orders=await rows(`SELECT p.* FROM pedidos p JOIN lotes l ON l.id=p.lote_id
      WHERE l.evento_id=? AND p.status<>'estornado' ORDER BY p.tipo DESC,p.criado_ms DESC`,[id],db);
    if (orders.some(p=>p.status==='repassado')) throw new HttpError(409,'Evento com repasse concluído requer resolução individual pela administração.');
    // Revendas voltam ao titular original antes de cancelar as compras primárias.
    for (const p of orders.filter(p=>p.tipo==='secundario')) await refund(db,p,user);
    for (const p of orders.filter(p=>p.tipo==='primario')) await refund(db,p,user);
    await db.query("UPDATE ingressos SET status='cancelado' WHERE lote_id IN (SELECT id FROM lotes WHERE evento_id=?)",[id]);
    await db.query("UPDATE reservas SET status='cancelada' WHERE status='ativa' AND lote_id IN (SELECT id FROM lotes WHERE evento_id=?)",[id]);
    await db.query("UPDATE anuncios SET status='cancelado' WHERE status IN ('pendente','publicado') AND ingresso_id IN (SELECT id FROM ingressos WHERE lote_id IN (SELECT id FROM lotes WHERE evento_id=?))",[id]);
    await db.query("UPDATE eventos SET status='cancelado' WHERE id=?",[id]);
    await audit(db,user,'cancelar_evento',id,'Compras ativas estornadas integralmente');
    return {mensagem:'Evento cancelado e compras ativas estornadas.'};
  });
}
async function services(user,body) {
  requireRole(user,['fornecedor','administrador']);
  const titulo=text(body.titulo,'título',3,100),categoria=text(body.categoria,'categoria',3,80),descricao=text(body.descricao,'descrição',10,1000);
  integer(body.valor_centavos,'Preço em centavos',0,100000000);
  const url=String(body.portfolio_url||'').trim();
  if (url) {
    let parsed; try { parsed=new URL(url); } catch { throw new HttpError(400,'Link de portfólio inválido.'); }
    if (parsed.protocol!=='https:') throw new HttpError(400,'Use um link de portfólio com HTTPS.');
  }
  return transact(async db=>{
    const id=body.id||uid();
    if (body.id) {
      const old=await one('SELECT * FROM servicos WHERE id=? AND fornecedor_id=?',[id,user.id],db);
      if (!old) throw new HttpError(404,'Serviço não encontrado.');
      await db.query('UPDATE servicos SET titulo=?,categoria=?,descricao=?,valor_centavos=?,portfolio_url=?,ativo=? WHERE id=?',
        [titulo,categoria,descricao,body.valor_centavos,url||null,body.ativo===false?0:1,id]);
    } else await db.query('INSERT INTO servicos (id,fornecedor_id,titulo,categoria,descricao,valor_centavos,portfolio_url) VALUES (?,?,?,?,?,?,?)',
      [id,user.id,titulo,categoria,descricao,body.valor_centavos,url||null]);
    await audit(db,user,'salvar_servico',id);
    return {id};
  });
}
const publicServices=()=>rows(`SELECT s.*,u.nome,u.razao_social,u.area_atuacao FROM servicos s JOIN usuarios u ON u.id=s.fornecedor_id WHERE s.ativo=1 AND u.status='aprovado' ORDER BY s.titulo`);
const ownServices=user=>rows('SELECT * FROM servicos WHERE fornecedor_id=? ORDER BY titulo',[user.id]);
async function contracts(user) {
  return rows(`SELECT p.id AS proposta_id,p.valor,p.descricao,i.nome AS item_nome,e.nome AS evento_nome,
    u.nome AS organizador,COALESCE(c.status,'ativo') AS contrato_status
    FROM propostas p JOIN itens_custo i ON i.id=p.item_custo_id JOIN eventos e ON e.id=i.evento_id
    JOIN usuarios u ON u.id=e.organizador_id LEFT JOIN contratos c ON c.proposta_id=p.id
    WHERE p.fornecedor_id=? AND p.status='selecionada'`,[user.id]);
}
async function completeContract(user,id) {
  return transact(async db=>{
    const p=await one("SELECT id FROM propostas WHERE id=? AND fornecedor_id=? AND status='selecionada'",[id,user.id],db);
    if (!p) throw new HttpError(404,'Contrato não encontrado.');
    const c=await one('SELECT * FROM contratos WHERE proposta_id=?',[id],db);
    if (c) await db.query("UPDATE contratos SET status='concluido',atualizado_ms=? WHERE proposta_id=?",[now(),id]);
    else await db.query("INSERT INTO contratos (id,proposta_id,status,atualizado_ms) VALUES (?,?,'concluido',?)",[uid(),id,now()]);
    await audit(db,user,'concluir_servico',id);
  });
}
module.exports={CATEGORIES,sales,publishCatalog,saveLot,checkin,adminData,saveSettings,moderate,resolveOrder,cancelEvent,
  services,publicServices,ownServices,contracts,completeContract};
