'use strict';

const QRCode = require('qrcode');
const { HttpError } = require('../errors');
const { pool, uid, code, now, endTime, text, integer, one, rows, settings, transact, audit, notify, requireRole } = require('./core');
const EVENT = `SELECT e.*, c.cidade, c.categoria, c.arte, c.moderacao, c.destaque
  FROM eventos e JOIN catalogo c ON c.evento_id = e.id`;
const TICKET = `SELECT i.*, l.nome AS lote_nome, l.setor, e.id AS evento_id, e.nome AS evento_nome, e.local_evento,
  e.data_inicio,e.data_fim,e.organizador_id,c.arte FROM ingressos i JOIN lotes l ON l.id = i.lote_id
  JOIN eventos e ON e.id = l.evento_id JOIN catalogo c ON c.evento_id = e.id`;

async function event(id, db = pool) {
  const row = await one(EVENT + ' WHERE e.id = ?', [id], db);
  if (!row) throw new HttpError(404, 'Evento não encontrado.');
  return row;
}
function open(event) {
  if (event.status !== 'publicado' || event.moderacao !== 'aprovado' || endTime(event) <= now()) {
    throw new HttpError(409, 'As vendas deste evento estão indisponíveis.');
  }
}
async function lots(eventId, db = pool) {
  return rows(`SELECT l.*,
    (SELECT COUNT(*) FROM ingressos i WHERE i.lote_id = l.id AND i.status <> 'cancelado') AS vendidos,
    (SELECT COALESCE(SUM(r.quantidade),0) FROM reservas r WHERE r.lote_id = l.id AND r.anuncio_id IS NULL
      AND r.status = 'ativa' AND r.expira_ms > ?) AS reservados
    FROM lotes l WHERE l.evento_id = ? ORDER BY l.valor_centavos`, [now(),eventId],db);
}
async function availableLots(eventId, db = pool) {
  return (await lots(eventId,db)).map(l => ({ ...l, disponiveis: Math.max(0,l.capacidade - l.vendidos - l.reservados) }));
}
async function listings(eventId, db = pool) {
  const all = await rows(`SELECT a.id,a.preco_centavos,a.vendedor_id,l.setor,u.nome AS vendedor,
    (SELECT COUNT(*) FROM reservas r WHERE r.anuncio_id = a.id AND r.status = 'ativa' AND r.expira_ms > ?) AS reservas
    FROM anuncios a JOIN ingressos i ON i.id = a.ingresso_id JOIN lotes l ON l.id = i.lote_id
    JOIN usuarios u ON u.id = a.vendedor_id WHERE l.evento_id = ? AND a.status = 'publicado' AND i.status = 'valido'`,
    [now(),eventId],db);
  return all.filter(a => !a.reservas).map(a => ({ ...a, vendedor: a.vendedor.split(' ')[0] }));
}
async function catalog(filters) {
  let all = await rows(EVENT + " WHERE e.status = 'publicado' AND c.moderacao = 'aprovado' ORDER BY e.data_inicio");
  all = all.filter(e => endTime(e)>now());
  const data = [];
  for (const e of all) {
    const [lotes,anuncios] = await Promise.all([availableLots(e.id),listings(e.id)]);
    const prices = [...lotes.filter(l=>l.ativo && l.disponiveis).map(l=>l.valor_centavos),...anuncios.map(a=>a.preco_centavos)];
    data.push({...e, a_partir: prices.length ? Math.min(...prices) : null,
      primarios: lotes.some(l=>l.ativo && l.disponiveis), secundarios: anuncios.length });
  }
  const search = String(filters.q||'').trim().toLocaleLowerCase('pt-BR');
  return data.filter(e => (!search || (e.nome+' '+e.local_evento).toLocaleLowerCase('pt-BR').includes(search))
    && (!filters.cidade || e.cidade === filters.cidade) && (!filters.categoria || e.categoria === filters.categoria)
    && (!filters.data || e.data_inicio.slice(0,10) >= filters.data)
    && (!filters.max || e.a_partir !== null && e.a_partir <= Number(filters.max)*100));
}
async function detail(id) {
  const e = await event(id);
  open(e);
  return { evento: e, lotes: await availableLots(e.id), anuncios: await listings(e.id), regras: await settings() };
}
async function reserve(body) {
  text(body.visitante, 'identificador do carrinho', 20,64);
  const quantidade = integer(body.quantidade, 'Quantidade',1,6);
  return transact(async db => {
    let lote, anuncio;
    if (body.anuncio_id) {
      anuncio = await one('SELECT * FROM anuncios WHERE id = ?', [body.anuncio_id],db);
      if (!anuncio || anuncio.status !== 'publicado' || quantidade!==1) throw new HttpError(409,'Anúncio indisponível.');
      const ticket = await one('SELECT * FROM ingressos WHERE id = ?', [anuncio.ingresso_id],db);
      if (!ticket || ticket.status !== 'valido' || ticket.dono_id!==anuncio.vendedor_id) throw new HttpError(409,'Ingresso indisponível.');
      const held = await one("SELECT id FROM reservas WHERE anuncio_id = ? AND status = 'ativa' AND expira_ms > ?", [anuncio.id,now()],db);
      if (held) throw new HttpError(409,'Este ingresso está reservado por outra pessoa.');
      lote = await one('SELECT * FROM lotes WHERE id = ?',[ticket.lote_id],db);
    } else {
      lote = await one('SELECT * FROM lotes WHERE id = ?', [body.lote_id||''],db);
      if (!lote || !lote.ativo) throw new HttpError(404,'Lote indisponível.');
      const available = (await availableLots(lote.evento_id,db)).find(l=>l.id===lote.id);
      if (available.disponiveis<quantidade) throw new HttpError(409,'Quantidade indisponível. Atualize os ingressos.');
    }
    const e = await event(lote.evento_id,db);
    open(e);
    // Limite de reservas por navegador evita retenção indefinida de todo o lote.
    const active = await one("SELECT COUNT(*) AS n FROM reservas WHERE visitante = ? AND status = 'ativa' AND expira_ms > ?", [body.visitante,now()],db);
    if (active.n>=3) throw new HttpError(409,'Você já tem três reservas. Conclua ou cancele um carrinho.');
    const rules = await settings(db), id = uid();
    await db.query(`INSERT INTO reservas (id,visitante,lote_id,anuncio_id,quantidade,preco_centavos,conveniencia_bp,revenda_bp,expira_ms)
      VALUES (?,?,?,?,?,?,?,?,?)`,[id,body.visitante,lote.id,anuncio?.id??null,quantidade,anuncio?.preco_centavos??lote.valor_centavos,
      rules.conveniencia_bp,rules.revenda_bp,now()+600000]);
    return id;
  });
}
async function reservation(id, visitor, db = pool) {
  const r = await one(`SELECT r.*,l.nome AS lote_nome,l.setor,l.evento_id,e.nome AS evento_nome,e.local_evento,e.data_inicio,
    c.arte FROM reservas r JOIN lotes l ON l.id=r.lote_id JOIN eventos e ON e.id=l.evento_id
    JOIN catalogo c ON c.evento_id=e.id WHERE r.id=? AND r.visitante=?`,[id,visitor],db);
  if (!r) throw new HttpError(404,'Carrinho não encontrado neste navegador.');
  const base = r.preco_centavos*r.quantidade;
  const fee = r.anuncio_id ? 0 : Math.round(base*r.conveniencia_bp/10000);
  const pix='TROCATICKET-DEMO:'+r.id+':'+(base+fee);
  return { ...r, subtotal:base, taxa:fee,total:base+fee,expirada:r.expira_ms<=now(),
    pix_copia:pix,pix_qr:await QRCode.toDataURL(pix,{width:220,margin:2}) };
}
async function release(id, visitor) {
  return transact(db=>db.query("UPDATE reservas SET status='cancelada' WHERE id=? AND visitante=? AND status='ativa'",[id,visitor]));
}
async function pay(user, body) {
  requireRole(user,['comprador']);
  if (!['pix','cartao'].includes(body.metodo)) throw new HttpError(400,'Escolha PIX ou cartão de demonstração.');
  return transact(async db => {
    const r = await reservation(body.reserva_id,body.visitante,db);
    const previous = await one('SELECT * FROM pedidos WHERE reserva_id=?',[r.id],db);
    if (previous) {
      if (previous.comprador_id !== user.id) throw new HttpError(409,'Esta reserva já foi utilizada.');
      return previous;
    }
    if (r.status!=='ativa' || r.expirada) throw new HttpError(409,'Sua reserva expirou. Selecione os ingressos novamente.');
    const e = await event(r.evento_id,db);
    open(e);
    let listing;
    if (r.anuncio_id) {
      listing = await one('SELECT * FROM anuncios WHERE id=?',[r.anuncio_id],db);
      if (!listing || listing.status!=='publicado') throw new HttpError(409,'A revenda foi encerrada.');
      if (listing.vendedor_id===user.id) throw new HttpError(409,'Você já é dono deste ingresso.');
      const ticket = await one('SELECT * FROM ingressos WHERE id=?',[listing.ingresso_id],db);
      if (ticket.status!=='valido' || ticket.dono_id!==listing.vendedor_id) throw new HttpError(409,'Ingresso indisponível.');
    }
    const id = uid(), seller = listing?.vendedor_id ?? e.organizador_id;
    const fee = listing ? Math.round(r.subtotal*r.revenda_bp/10000) : r.taxa;
    const net = listing ? r.subtotal-fee : r.subtotal;
    await db.query(`INSERT INTO pedidos (id,reserva_id,comprador_id,vendedor_id,lote_id,tipo,quantidade,
      valor_centavos,taxa_centavos,total_centavos,liquido_centavos,metodo,criado_ms)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,[id,r.id,user.id,seller,r.lote_id,listing?'secundario':'primario',r.quantidade,
      r.subtotal,fee,r.total,net,body.metodo,now()]);
    if (listing) {
      await db.query("UPDATE ingressos SET dono_id=?,pedido_id=?,codigo=? WHERE id=?", [user.id,id,code(),listing.ingresso_id]);
      await db.query("UPDATE anuncios SET status='vendido',comprador_id=?,pedido_id=? WHERE id=?", [user.id,id,listing.id]);
      await notify(db,seller,'Seu ingresso foi vendido. O valor ficará retido até a conclusão do evento.');
    } else {
      for (let n=0;n<r.quantidade;n++) {
        await db.query('INSERT INTO ingressos (id,lote_id,dono_id,pedido_id,original_pedido_id,valor_original,codigo) VALUES (?,?,?,?,?,?,?)',
          [uid(),r.lote_id,user.id,id,id,r.preco_centavos,code()]);
      }
    }
    await db.query("UPDATE reservas SET status='convertida',usuario_id=? WHERE id=?",[user.id,r.id]);
    await audit(db,user,'compra_simulada',id,`${r.quantidade} ingresso(s); total ${r.total} centavos`);
    await notify(db,user.id,'Compra confirmada. Seus ingressos estão na carteira.');
    return one('SELECT * FROM pedidos WHERE id=?',[id],db);
  });
}
async function wallet(user) {
  const tickets=await rows(TICKET+` WHERE i.dono_id=? ORDER BY e.data_inicio`,[user.id]);
  const listings=await rows(`SELECT a.*,e.nome AS evento_nome,l.setor,p.status AS repasse_status,p.liquido_centavos
    FROM anuncios a JOIN ingressos i ON i.id=a.ingresso_id JOIN lotes l ON l.id=i.lote_id
    JOIN eventos e ON e.id=l.evento_id LEFT JOIN pedidos p ON p.id=a.pedido_id WHERE a.vendedor_id=? ORDER BY a.criado_ms DESC`,[user.id]);
  const rules=await settings();
  return { tickets:tickets.map(({codigo,...t})=>({...t,limite_revenda:Math.floor(t.valor_original*(10000+rules.margem_revenda_bp)/10000)})),anuncios:listings,regras:rules };
}
async function ticketQr(id,user) {
  const ticket=await one(TICKET+' WHERE i.id=? AND i.dono_id=?',[id,user.id]);
  if (!ticket) throw new HttpError(404,'Ingresso não encontrado.');
  const listing=await one("SELECT id FROM anuncios WHERE ingresso_id=? AND status IN ('pendente','publicado')",[id]);
  if (ticket.status!=='valido' || listing) throw new HttpError(409,'Código indisponível para ingresso utilizado, cancelado ou anunciado.');
  return {...ticket,qr:await QRCode.toDataURL(ticket.codigo,{width:300,margin:2})};
}
async function announce(user,body) {
  requireRole(user,['comprador']);
  return transact(async db=>{
    const t=await one(TICKET+' WHERE i.id=? AND i.dono_id=?',[body.ingresso_id,user.id],db);
    if (!t || t.status!=='valido' || endTime(t)<=now()) throw new HttpError(409,'Somente ingressos válidos e futuros podem ser anunciados.');
    const pedido=await one('SELECT * FROM pedidos WHERE id=?',[t.pedido_id],db);
    if (pedido.status==='contestado') throw new HttpError(409,'Este ingresso tem uma transação pendente de resolução.');
    const rules=await settings(db);
    integer(body.preco_centavos,'Preço em centavos',100,Math.floor(t.valor_original*(10000+rules.margem_revenda_bp)/10000));
    const existing=await one("SELECT id FROM anuncios WHERE ingresso_id=? AND status IN ('pendente','publicado')",[t.id],db);
    if(existing) throw new HttpError(409,'Este ingresso já possui um anúncio ativo.');
    const id=uid(),status=rules.moderar_revenda?'pendente':'publicado';
    await db.query('INSERT INTO anuncios (id,ingresso_id,vendedor_id,anterior_pedido_id,preco_centavos,status,criado_ms) VALUES (?,?,?,?,?,?,?)',
      [id,t.id,user.id,t.pedido_id,body.preco_centavos,status,now()]);
    await audit(db,user,'anunciar',id);
    return {id,status};
  });
}
async function cancelListing(user,id) {
  return transact(async db=>{
    const a=await one('SELECT * FROM anuncios WHERE id=? AND vendedor_id=?',[id,user.id],db);
    if (!a || !['pendente','publicado'].includes(a.status)) throw new HttpError(409,'Anúncio indisponível para cancelamento.');
    const reservation=await one("SELECT id FROM reservas WHERE anuncio_id=? AND status='ativa' AND expira_ms>?",[id,now()],db);
    if (reservation) throw new HttpError(409,'Há uma reserva ativa. Aguarde seu prazo de conclusão.');
    await db.query("UPDATE anuncios SET status='cancelado' WHERE id=?",[id]);
    await audit(db,user,'cancelar_anuncio',id);
  });
}
async function orders(user) {
  return rows(`SELECT p.*,e.id AS evento_id,e.nome AS evento_nome,e.data_inicio,e.data_fim,l.setor,c.arte
    FROM pedidos p JOIN lotes l ON l.id=p.lote_id JOIN eventos e ON e.id=l.evento_id
    JOIN catalogo c ON c.evento_id=e.id WHERE p.comprador_id=? ORDER BY p.criado_ms DESC`,[user.id]);
}
async function dispute(user,id,body) {
  const motivo=text(body.motivo,'motivo da contestação',8,500);
  return transact(async db=>{
    const p=await one("SELECT * FROM pedidos WHERE id=? AND comprador_id=?",[id,user.id],db);
    if (!p || p.status!=='retido') throw new HttpError(409,'Pedido indisponível para contestação.');
    const ticket=await one("SELECT id FROM ingressos WHERE pedido_id=? AND dono_id=? AND status<>'cancelado'",[id,user.id],db);
    if (!ticket) throw new HttpError(409,'Você já transferiu os ingressos deste pedido.');
    const a=await one(`SELECT a.id FROM anuncios a JOIN ingressos i ON i.id=a.ingresso_id WHERE i.pedido_id=? AND a.status IN ('pendente','publicado')`,[id],db);
    if (a) throw new HttpError(409,'Cancele o anúncio antes de contestar.');
    await db.query("UPDATE pedidos SET status='contestado',motivo=? WHERE id=?",[motivo,id]);
    await audit(db,user,'contestar',id,motivo);
    await notify(db,p.vendedor_id,'Uma transação recebeu contestação e está em análise.');
  });
}
module.exports={event,open,lots,availableLots,catalog,detail,reserve,reservation,release,pay,wallet,ticketQr,announce,cancelListing,orders,dispute,TICKET};
