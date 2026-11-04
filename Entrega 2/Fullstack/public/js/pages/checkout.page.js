import { get,pay,remove } from '../api/commerce.api.js';
import { session } from '../session.js';
import { esc,money,date,heading,empty,busy } from '../components/ui.js';
import { renderLoading } from '../components/state-view.js';
import { openAuthModal } from '../components/auth-modal.js';
import { confirmDialog } from '../components/confirm-dialog.js';
import { navigate } from '../router.js';
import { art } from './marketplace.page.js';
import { toast } from '../components/toast.js';
export async function renderCheckout({id},_query,isCurrent){
  const app=document.getElementById('app');app.innerHTML=renderLoading('Preparando sua reserva...');
  const r=await get('/reservas/'+id);
  if(!isCurrent())return;
  if(r.status==='convertida'){
    app.innerHTML=heading('COMPRA CONCLUÍDA','Seu encontro está confirmado.')+empty('Ingressos na sua carteira','A compra desta reserva já foi registrada.','<a class="btn btn-primary" href="#/carteira">Ver meus ingressos</a>');return;
  }
  if(r.expirada || r.status!=='ativa'){
    app.innerHTML=empty('Esta reserva terminou','Seus ingressos voltaram a ficar disponíveis. Selecione uma nova opção.',`<a class="btn btn-primary" href="#/explorar/${r.evento_id}">Voltar ao evento</a>`);return;
  }
  const buyer=session.user()?.perfil==='comprador';
  app.innerHTML=heading('FALTA POUCO PARA VIVER ESSA HISTÓRIA','Finalize sua experiência')+
    `<nav class="checkout-stepper" aria-label="Etapas da compra"><span class="${buyer?'done':'active'}"><b>1</b> Identificação</span><span class="${buyer?'done':''}"><b>2</b> Cadastro</span><span class="${buyer?'active':''}"><b>3</b> Pagamento</span><span><b>4</b> Confirmação</span></nav>
      <div class="checkout-layout"><section class="card checkout-main">
      ${!session.user()?`<p class="eyebrow">SEU CARRINHO ESTÁ GUARDADO</p><h2>Como podemos te encontrar?</h2><p class="muted">Entre ou crie sua conta para concluir a compra. Seus ingressos continuam reservados.</p><div class="card-actions"><button class="btn btn-primary" id="checkout-login">Entrar</button><button class="btn btn-secondary" id="checkout-signup">Criar conta</button></div>`
      :!buyer?`<h2>A compra precisa de uma conta de comprador</h2><p>Use Sair no menu e entre como comprador. Esta reserva continuará neste navegador.</p><a class="btn btn-secondary" href="#/cadastro?next=${encodeURIComponent('/checkout/'+id)}">Criar conta de comprador</a>`
      :`<div class="buyer-identification"><span class="avatar">${esc(session.user().nome.slice(0,1))}</span><div><strong>${esc(session.user().nome)}</strong><p class="small muted">${esc(session.user().email)}</p></div><span class="badge status-aprovado">Identificado</span></div>
        <h2>Escolha como pagar</h2><p class="notice small">Pagamento de demonstração. As opções abaixo registram a compra simulada.</p>
        <div class="payment-tabs"><button class="active" data-payment="pix">◈ PIX</button><button data-payment="cartao">▣ Cartão de crédito</button></div>
        <div id="payment-content"></div><label class="check-label"><input type="checkbox" id="accept-simulation"> Estou ciente de que este pagamento é simulado.</label>
        <button class="btn btn-primary full-width" id="pay-button">Confirmar pagamento · ${money(r.total)}</button>`}
      </section><aside class="card order-summary"><img src="${art(r.arte)}" alt="Cartaz de ${esc(r.evento_nome)}">
        <div class="reservation-timer">◷ Reserva por <strong id="countdown"></strong></div>
        <h2>${esc(r.evento_nome)}</h2><p class="muted small">${esc(date(r.data_inicio))}<br>${esc(r.local_evento)}</p>
        <div class="summary-row"><span>${r.quantidade} × ${esc(r.setor)} · ${esc(r.lote_nome)}</span><strong>${money(r.subtotal)}</strong></div>
        <div class="summary-row"><span>Conveniência</span><strong>${money(r.taxa)}</strong></div>
        <div class="summary-row total"><span>Total</span><strong>${money(r.total)}</strong></div>
        <span class="badge ${r.anuncio_id?'status-retido':'status-aprovado'}">${r.anuncio_id?'Revenda entre fãs':'Ingresso oficial'}</span>
        <button class="text-button danger-text small" id="release-reservation">Cancelar reserva</button>
      </aside></div>`;
  const tick=()=>{
    if(!isCurrent() || !app.querySelector('#countdown'))return;
    const seconds=Math.max(0,Math.ceil((r.expira_ms-Date.now())/1000));
    app.querySelector('#countdown').textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
    if(!seconds){window.dispatchEvent(new Event('rota-atualizar'));return;}
    setTimeout(tick,1000);
  };tick();
  app.querySelector('#release-reservation').onclick=async e=>{
    const button=e.currentTarget;
    if(!await confirmDialog({title:'Cancelar esta reserva?',message:'Os ingressos voltarão a ficar disponíveis para outras pessoas.',confirmLabel:'Cancelar reserva',danger:true}))return;
    busy(button,async()=>{await remove('/reservas/'+id);localStorage.removeItem('trocaticket.carrinho');if(isCurrent())navigate('/explorar/'+r.evento_id);});
  };
  app.querySelector('#checkout-login')?.addEventListener('click',()=>openAuthModal());
  app.querySelector('#checkout-signup')?.addEventListener('click',()=>openAuthModal({mode:'signup'}));
  if(!buyer)return;
  let method='pix';
  const payment=method=>{
    app.querySelectorAll('[data-payment]').forEach(b=>b.classList.toggle('active',b.dataset.payment===method));
    app.querySelector('#payment-content').innerHTML=method==='pix'?`<div class="pix-panel"><img src="${r.pix_qr}" alt="QR Code de teste para o pagamento simulado"><div><strong>PIX de demonstração</strong><p class="muted small">Este código identifica a simulação no projeto.</p><textarea readonly aria-label="PIX Copia e Cola de demonstração">${esc(r.pix_copia)}</textarea><button type="button" class="text-button" id="copy-pix">Copiar código</button></div></div>`
      :`<div class="demo-credit-card"><span>troca<b>ticket</b></span><strong>•••• &nbsp; •••• &nbsp; •••• &nbsp; 4242</strong><small>CARTÃO DE TESTE · APROVAÇÃO SIMULADA</small></div><p class="small muted">A confirmação registra a compra com um cartão fictício aprovado.</p>`;
    app.querySelector('#copy-pix')?.addEventListener('click',async()=>{
      try{await navigator.clipboard.writeText(r.pix_copia);toast.success('Código copiado.');}
      catch{app.querySelector('textarea').select();toast.info('Selecione e copie o código com Ctrl+C.');}
    });
  };payment(method);
  app.querySelectorAll('[data-payment]').forEach(b=>b.onclick=()=>{method=b.dataset.payment;payment(method);});
  app.querySelector('#pay-button').onclick=async e=>{
    const button=e.currentTarget;
    if(!app.querySelector('#accept-simulation').checked){toast.info('Confirme que está ciente da simulação.');return;}
    if(!await confirmDialog({title:'Confirmar sua compra?',message:`Registrar o pagamento simulado de ${money(r.total)} por ${r.quantidade} ingresso(s)?`,confirmLabel:'Confirmar compra'}))return;
    busy(button,async()=>{
      const order=await pay(id,method);
      localStorage.removeItem('trocaticket.carrinho');
      if(!isCurrent())return;
      app.innerHTML=`<section class="success-receipt"><span class="success-ring">✓</span><p class="eyebrow">COMPRA CONFIRMADA</p><h1>Seu lugar está garantido.</h1><p>${esc(r.evento_nome)} te espera. Encontre os códigos de acesso na sua carteira.</p>
        <div class="receipt-number">Pedido ${esc(order.id.slice(0,8).toUpperCase())} · ${money(order.total_centavos)}</div><a class="btn btn-primary" href="#/carteira">Abrir meus ingressos ↗</a><a class="btn btn-secondary" href="#/pedidos">Ver meus pedidos</a></section>`;
    });
  };
}
