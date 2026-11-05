import { get,post,remove } from '../api/commerce.api.js';
import { esc,money,date,badge,heading,empty,formAction,field,errorBox,cents,busy } from './ui.js';
import { renderLoading } from './state-view.js';
import { openModal } from './modal.js';
import { confirmDialog } from './confirm-dialog.js';
import { art } from '../pages/marketplace.page.js';
import { toast } from './toast.js';

export async function renderWallet(_params,query,isCurrent){
  const app=document.getElementById('app');app.innerHTML=renderLoading('Organizando seus ingressos...');
  const {tickets,anuncios,regras}=await get('/carteira');
  if(!isCurrent())return;
  const resale=query.aba==='revendas';
  app.innerHTML=heading('SUA PRÓXIMA HISTÓRIA','Meus ingressos','Seu lugar nos eventos e suas revendas em um só espaço.')+
    `<nav class="tabs" aria-label="Carteira"><a class="tab ${!resale?'ativa':''}" href="#/carteira">Meus ingressos <span>${tickets.length}</span></a><a class="tab ${resale?'ativa':''}" href="#/carteira?aba=revendas">Minhas revendas <span>${anuncios.length}</span></a></nav>
    ${resale?`<div class="notice">Taxa de revenda de <b>${regras.revenda_bp/100}%</b> sobre a venda concluída. O valor permanece retido até o término do evento e a resolução de eventuais contestações.</div>
      <div class="wallet-grid">${anuncios.map(a=>`<article class="card resale-card"><div class="card-row">${badge(a.status)}<span class="small muted">${date(new Date(a.criado_ms).toISOString())}</span></div><h2>${esc(a.evento_nome)}</h2><p class="muted">${esc(a.setor)}</p>
      <div class="summary-row"><span>Valor anunciado</span><strong>${money(a.preco_centavos)}</strong></div>
      <div class="summary-row"><span>Líquido ${a.pedido_id?'registrado':'estimado'}</span><strong>${money(a.pedido_id?a.liquido_centavos:Math.round(a.preco_centavos*(10000-regras.revenda_bp)/10000))}</strong></div>
      ${a.repasse_status?badge(a.repasse_status):''}
      ${['pendente','publicado'].includes(a.status)?`<button class="btn btn-secondary" data-cancel="${a.id}">Cancelar anúncio</button>`:''}</article>`).join('')}</div>`
    :`<div class="wallet-grid">${tickets.map(t=>{
      const listed=anuncios.find(a=>a.ingresso_id===t.id && ['pendente','publicado'].includes(a.status));
      return `<article class="wallet-ticket"><img src="${art(t.arte)}" alt="Cartaz de ${esc(t.evento_nome)}"><div class="wallet-ticket-content"><div class="card-row">${badge(t.status)}${listed?badge(listed.status):''}</div><h2>${esc(t.evento_nome)}</h2><p class="muted small">${esc(date(t.data_inicio))}<br>${esc(t.local_evento)}</p><div class="ticket-perforation"></div>
      <div class="summary-row"><strong>${esc(t.setor)}</strong><span>${esc(t.lote_nome)}</span></div><div class="card-actions">
      ${t.status==='valido'&&!listed?`<button class="btn btn-primary btn-sm" data-qr="${t.id}">Ver ingresso ▦</button><button class="btn btn-secondary btn-sm" data-resell="${t.id}">Revender ↻</button>`:listed?'<span class="muted small">O código fica bloqueado durante o anúncio.</span>':''}</div></div></article>`;
    }).join('')}</div>`}
    ${(resale?anuncios:tickets).length?'':empty(resale?'Nenhuma revenda por enquanto':'Sua próxima experiência está te esperando',resale?'Abra um ingresso válido na carteira e selecione Revender.':'Explore os eventos para encontrar seu lugar.','<a class="btn btn-primary" href="#/">Explorar eventos</a>')}`;
  app.querySelectorAll('[data-qr]').forEach(button=>button.onclick=()=>busy(button,async()=>{
    const t=await get('/ingressos/'+button.dataset.qr+'/qr');
    if(!isCurrent())return;
    openModal('Seu ingresso',`<div class="ticket-qr"><p class="eyebrow">${esc(t.setor)}</p><h3>${esc(t.evento_nome)}</h3><p class="small muted">${esc(date(t.data_inicio))}</p><img src="${t.qr}" alt="QR Code do ingresso"><code>${esc(t.codigo)}</code><p class="small muted">Apresente este código na entrada. Mantenha-o privado.</p><button class="btn btn-secondary" id="print-ticket">Imprimir ingresso</button></div>`);
    document.getElementById('print-ticket').onclick=()=>window.print();
  }));
  app.querySelectorAll('[data-resell]').forEach(button=>button.onclick=()=>{
    const t=tickets.find(t=>t.id===button.dataset.resell);
    const {element,close}=openModal('Revender ingresso',`<p>Defina o valor para <b>${esc(t.evento_nome)}</b>. O limite é ${money(t.limite_revenda)}, com acréscimo máximo de ${regras.margem_revenda_bp/100}% sobre o valor original.</p>
      <form class="stack">${field('preco','Preço de revenda (R$)','number',`required min="1" step=".01" max="${t.limite_revenda/100}"`,t.valor_original/100)}
      <p class="small muted">Taxa de ${regras.revenda_bp/100}% deduzida no repasse. ${regras.moderar_revenda?'O anúncio passará por análise.':''}</p>${errorBox}<button class="btn btn-primary" type="submit">Anunciar ingresso</button></form>`);
    formAction(element.querySelector('form'),async data=>{
      const price=cents(data.preco);
      close();
      if(!await confirmDialog({title:'Confirmar revenda?',message:`Anunciar este ingresso por ${money(price)}? Seu código ficará bloqueado enquanto o anúncio estiver ativo.`,confirmLabel:'Confirmar anúncio'}))return;
      await post('/anuncios',{ingresso_id:t.id,preco_centavos:price});toast.success('Ingresso enviado para revenda.');
      if(isCurrent())window.location.hash='/carteira?aba=revendas';
    });
  });
  app.querySelectorAll('[data-cancel]').forEach(button=>button.onclick=async()=>{
    if(!await confirmDialog({title:'Cancelar anúncio?',message:'O ingresso volta à sua carteira para utilização.',confirmLabel:'Cancelar anúncio',danger:true}))return;
    busy(button,async()=>{await remove('/anuncios/'+button.dataset.cancel);toast.success('Anúncio cancelado.');if(isCurrent())window.dispatchEvent(new Event('rota-atualizar'));});
  });
}
export async function renderOrders(_params,_query,isCurrent){
  const app=document.getElementById('app');app.innerHTML=renderLoading('Buscando seus pedidos...');
  const orders=await get('/pedidos');if(!isCurrent())return;
  app.innerHTML=heading('SEUS ENCONTROS, EM ORDEM','Meus pedidos','Acompanhe as compras, os valores protegidos e eventuais contestações.')+
    `<div class="orders-list">${orders.map(p=>`<article class="card order-card"><div><p class="small muted">PEDIDO ${esc(p.id.slice(0,8).toUpperCase())} · ${p.tipo==='primario'?'Oficial':'Revenda'}</p><h2>${esc(p.evento_nome)}</h2><p class="small muted">${p.quantidade} ingresso(s) · ${esc(p.setor)} · ${p.metodo==='pix'?'PIX':'Cartão'} de demonstração</p>${p.motivo?`<p class="small">Contestação: ${esc(p.motivo)}</p>`:''}</div><div class="order-values"><strong>${money(p.total_centavos)}</strong>${badge(p.status)}
    <div class="card-actions"><a class="btn btn-secondary btn-sm" href="#/carteira">Ver ingressos</a>${p.status==='retido'?`<button class="text-button danger-text" data-dispute="${p.id}">Contestar compra</button>`:''}</div></div></article>`).join('')}</div>`+
    (!orders.length?empty('Nenhum pedido ainda','Os próximos encontros vão aparecer aqui.','<a class="btn btn-primary" href="#/">Explorar eventos</a>'):'');
  app.querySelectorAll('[data-dispute]').forEach(button=>button.onclick=()=>{
    const {element,close}=openModal('Contestar compra',`<p>Conte o que aconteceu. O repasse ficará bloqueado enquanto a administração analisa o pedido.</p><form class="stack"><label class="field">Motivo<textarea name="motivo" required minlength="8" maxlength="500"></textarea></label>${errorBox}<button type="submit" class="btn btn-danger">Registrar contestação</button></form>`);
    formAction(element.querySelector('form'),async data=>{
      await post('/pedidos/'+button.dataset.dispute+'/contestar',data);close();toast.success('Contestação registrada.');
      if(isCurrent())window.dispatchEvent(new Event('rota-atualizar'));
    });
  });
}
