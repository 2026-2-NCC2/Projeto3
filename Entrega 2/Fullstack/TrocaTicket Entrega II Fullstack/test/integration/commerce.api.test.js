'use strict';

const { test,after }=require('node:test');
const assert=require('node:assert/strict');
const { pool,close }=require('../../src/db');
const API=process.env.API_URL||'http://127.0.0.1:3000/api';
const visitor=()=>require('node:crypto').randomUUID();
async function api(method,path,token,body,guest) {
  const response=await fetch(API+path,{method,headers:{
    ...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{}),...(guest?{'X-Visitante':guest}:{})},
    body:body?JSON.stringify(body):undefined});
  const data=await response.json();
  return {status:response.status,data};
}
async function login(email,senha='Demo@2026'){
  const answer=await api('POST','/auth/login',null,{email,senha});
  assert.equal(answer.status,200,JSON.stringify(answer.data));
  return answer.data.token;
}
const unique=Date.now();
after(close);
test('Comércio: reserva, preço protegido, compra idempotente, limite de revenda, transferência e estorno',async()=>{
  const admin=await login('admin@trocaticket.com.br','Admin@2026');
  const org=await login('organizador@demo.com');
  for(const suffix of ['a','b']){
    const created=await api('POST','/auth/cadastro/comprador',null,{nome:'Comprador '+suffix,email:`commerce-${unique}-${suffix}@test.com`,senha:'Comprador123'});
    assert.equal(created.status,201,JSON.stringify(created.data));
  }
  const buyer=await login(`commerce-${unique}-a@test.com`,'Comprador123');
  const buyer2=await login(`commerce-${unique}-b@test.com`,'Comprador123');
  const catalog=await api('GET','/commerce/catalogo');
  assert.equal(catalog.status,200);
  const eid=catalog.data[0].id;
  const detail=await api('GET','/commerce/catalogo/'+eid);
  const lote=detail.data.lotes[0];
  const guest=visitor();
  const reserved=await api('POST','/commerce/reservas',null,{lote_id:lote.id,quantidade:1,visitante:guest});
  assert.equal(reserved.status,200,JSON.stringify(reserved.data));
  const rid=reserved.data.id;
  assert.equal((await api('GET','/commerce/reservas/'+rid,null,null,visitor())).status,404);
  const quote=await api('GET','/commerce/reservas/'+rid,null,null,guest);
  assert.ok(quote.data.pix_qr.startsWith('data:image/png;base64,'));
  const oldRules=(await api('GET','/commerce/regras')).data;
  await api('PATCH','/commerce/admin/regras',admin,{...oldRules,conveniencia_bp:300});
  const again=await api('GET','/commerce/reservas/'+rid,null,null,guest);
  assert.equal(quote.data.total,again.data.total,'reserva preserva a taxa');
  await api('PATCH','/commerce/admin/regras',admin,oldRules);
  const bought=await api('POST','/commerce/pagar',buyer,{reserva_id:rid,visitante:guest,metodo:'pix'});
  assert.equal(bought.status,200,JSON.stringify(bought.data));
  const repeat=await api('POST','/commerce/pagar',buyer,{reserva_id:rid,visitante:guest,metodo:'pix'});
  assert.equal(repeat.data.id,bought.data.id,'repetir pagamento preserva pedido');
  assert.equal((await api('POST','/commerce/pagar',buyer2,{reserva_id:rid,visitante:guest,metodo:'pix'})).status,409);
  const wallet=(await api('GET','/commerce/carteira',buyer)).data;
  const ticket=wallet.tickets.find(t=>t.pedido_id===bought.data.id);
  const qr=(await api('GET','/commerce/ingressos/'+ticket.id+'/qr',buyer)).data;
  assert.equal((await api('GET','/commerce/ingressos/'+ticket.id+'/qr',buyer2)).status,404);
  assert.equal((await api('POST','/commerce/anuncios',buyer,{ingresso_id:ticket.id,preco_centavos:ticket.limite_revenda+1})).status,400);
  const listing=await api('POST','/commerce/anuncios',buyer,{ingresso_id:ticket.id,preco_centavos:12000});
  assert.equal(listing.status,200,JSON.stringify(listing.data));
  assert.equal((await api('GET','/commerce/ingressos/'+ticket.id+'/qr',buyer)).status,409);
  const lid=listing.data.id;
  assert.equal((await api('POST','/commerce/admin/anuncios/'+lid+'/moderar',buyer,{status:'aprovado'})).status,403);
  assert.equal((await api('POST','/commerce/admin/anuncios/'+lid+'/moderar',admin,{status:'aprovado'})).status,200);
  const rg=visitor(),resale=await api('POST','/commerce/reservas',null,{anuncio_id:lid,quantidade:1,visitante:rg});
  assert.equal(resale.status,200,JSON.stringify(resale.data));
  assert.equal((await api('DELETE','/commerce/anuncios/'+lid,buyer)).status,409,'não cancelar durante reserva ativa');
  const transferred=await api('POST','/commerce/pagar',buyer2,{reserva_id:resale.data.id,visitante:rg,metodo:'cartao'});
  assert.equal(transferred.status,200,JSON.stringify(transferred.data));
  assert.equal(transferred.data.taxa_centavos,180);assert.equal(transferred.data.liquido_centavos,11820);
  assert.equal((await api('GET','/commerce/ingressos/'+ticket.id+'/qr',buyer)).status,404);
  const newQR=(await api('GET','/commerce/ingressos/'+ticket.id+'/qr',buyer2)).data;
  assert.notEqual(qr.codigo,newQR.codigo);
  assert.equal((await api('POST',`/commerce/gestao/eventos/${eid}/checkin`,org,{codigo:qr.codigo})).status,404);
  assert.equal((await api('POST','/commerce/admin/pedidos/'+bought.data.id+'/resolver',admin,{acao:'estornar'})).status,409,'evitar duplo estorno de ingresso transferido');
  assert.equal((await api('POST','/commerce/admin/pedidos/'+transferred.data.id+'/resolver',admin,{acao:'repassar'})).status,409,'aguardar evento');
  // Uma revenda pode originar outra, com histórico e resolução da mais recente primeiro.
  const secondListing=await api('POST','/commerce/anuncios',buyer2,{ingresso_id:ticket.id,preco_centavos:12500});
  assert.equal(secondListing.status,200,JSON.stringify(secondListing.data));
  await api('POST','/commerce/admin/anuncios/'+secondListing.data.id+'/moderar',admin,{status:'aprovado'});
  const gv=visitor();
  const secondReservation=await api('POST','/commerce/reservas',null,{anuncio_id:secondListing.data.id,quantidade:1,visitante:gv});
  const secondPurchase=await api('POST','/commerce/pagar',buyer,{reserva_id:secondReservation.data.id,visitante:gv,metodo:'pix'});
  assert.equal(secondPurchase.status,200,JSON.stringify(secondPurchase.data));
  assert.equal((await api('POST','/commerce/admin/pedidos/'+transferred.data.id+'/resolver',admin,{acao:'estornar'})).status,409);
  assert.equal((await api('POST','/commerce/admin/pedidos/'+secondPurchase.data.id+'/resolver',admin,{acao:'estornar'})).status,200);
  const dispute=await api('POST','/commerce/pedidos/'+transferred.data.id+'/contestar',buyer2,{motivo:'Ingresso com problema na entrada'});
  assert.equal(dispute.status,200);
  assert.equal((await api('POST','/commerce/admin/pedidos/'+transferred.data.id+'/resolver',admin,{acao:'estornar'})).status,200);
  const restored=(await api('GET','/commerce/ingressos/'+ticket.id+'/qr',buyer)).data;
  assert.notEqual(restored.codigo,newQR.codigo);
  assert.equal((await api('POST','/commerce/admin/pedidos/'+bought.data.id+'/resolver',admin,{acao:'estornar'})).status,200);
  assert.equal((await api('GET','/commerce/ingressos/'+ticket.id+'/qr',buyer)).status,409);
  const canceled=await api('POST','/commerce/gestao/eventos/'+eid+'/cancelar',org);
  assert.equal(canceled.status,200,JSON.stringify(canceled.data));
  const all=(await api('GET','/commerce/admin',admin)).data;
  assert.ok(all.pedidos.filter(p=>p.evento_nome===catalog.data[0].nome).every(p=>p.status==='estornado'));
  assert.equal((await api('GET','/commerce/catalogo/'+eid)).status,409);
});
test('Estoque concorrente, expiração de reserva e check-in único',async()=>{
  const org=await login('organizador@demo.com'),admin=await login('admin@trocaticket.com.br','Admin@2026');
  const buyer=await login(`commerce-${unique}-a@test.com`,'Comprador123');
  const event=await api('POST','/eventos',org,{nome:'Evento estoque único',descricao:'Teste de reserva concorrente',local_evento:'São Paulo',
    data_inicio:'2099-01-01T18:00',data_fim:'2099-01-02T02:00',publico_minimo:1,publico_maximo:1,publico_esperado:1,margem_lucro_percentual:20});
  assert.equal(event.status,201,JSON.stringify(event.data));
  const eid=event.data.id;
  assert.equal((await api('POST',`/commerce/gestao/eventos/${eid}/catalogo`,org,{cidade:'São Paulo',categoria:'Outros'})).status,200);
  await api('POST',`/commerce/admin/eventos/${eid}/moderar`,admin,{status:'aprovado'});
  const lot=await api('POST',`/commerce/gestao/eventos/${eid}/lotes`,org,{nome:'Único',setor:'Pista',capacidade:1,valor_centavos:10000});
  assert.equal(lot.status,200,JSON.stringify(lot.data));
  const guests=[visitor(),visitor()];
  const competition=await Promise.all(guests.map(v=>api('POST','/commerce/reservas',null,{lote_id:lot.data.id,quantidade:1,visitante:v})));
  assert.deepEqual(competition.map(r=>r.status).sort(),[200,409]);
  const idx=competition.findIndex(r=>r.status===200),rid=competition[idx].data.id;
  await pool.query('UPDATE reservas SET expira_ms=? WHERE id=?',[Date.now()-1000,rid]);
  assert.equal((await api('POST','/commerce/pagar',buyer,{reserva_id:rid,visitante:guests[idx],metodo:'pix'})).status,409);
  const v=visitor(),newR=await api('POST','/commerce/reservas',null,{lote_id:lot.data.id,quantidade:1,visitante:v});
  const purchase=await api('POST','/commerce/pagar',buyer,{reserva_id:newR.data.id,visitante:v,metodo:'pix'});
  const wallet=(await api('GET','/commerce/carteira',buyer)).data;
  const t=wallet.tickets.find(t=>t.pedido_id===purchase.data.id);
  const qr=(await api('GET','/commerce/ingressos/'+t.id+'/qr',buyer)).data;
  assert.equal((await api('POST',`/commerce/gestao/eventos/${eid}/checkin`,org,{codigo:qr.codigo})).status,200);
  assert.equal((await api('POST',`/commerce/gestao/eventos/${eid}/checkin`,org,{codigo:qr.codigo})).status,409);
  await pool.query("UPDATE eventos SET data_fim='2020-01-01 00:00:00',data_inicio='2019-12-31 18:00:00' WHERE id=?",[eid]);
  assert.equal((await api('POST','/commerce/admin/pedidos/'+purchase.data.id+'/resolver',admin,{acao:'repassar'})).status,200);
  assert.equal((await api('POST','/commerce/admin/pedidos/'+purchase.data.id+'/resolver',admin,{acao:'repassar'})).status,409);

});
test('Recuperação com OTP de uso único revoga sessões antigas',async()=>{
  const email=`commerce-${unique}-b@test.com`;
  const token=await login(email,'Comprador123');
  const recovery=await api('POST','/commerce/recuperar-senha',null,{email});
  assert.equal(recovery.status,200);
  let otp=recovery.data.codigo_demo;
  if(process.env.TEST_MAIL_FILE){
    const message=require('node:fs').readFileSync(process.env.TEST_MAIL_FILE,'utf8');
    otp=message.match(/(?:é |C3=A9 )(\d{6})/)?.[1];
  }
  assert.ok(otp,'código entregue pela caixa simulada ou SMTP de teste');
  const body={id:recovery.data.id,codigo:otp,senha:'NovaSenha2026',confirmacao:'NovaSenha2026'};
  assert.equal((await api('POST','/commerce/redefinir-senha',null,{...body,codigo:'000000'})).status,400);
  assert.equal((await api('POST','/commerce/redefinir-senha',null,body)).status,200);
  assert.equal((await api('POST','/commerce/redefinir-senha',null,body)).status,400);
  assert.equal((await api('GET','/auth/me',token)).status,401);
  await login(email,'NovaSenha2026');
});
