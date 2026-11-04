import { session } from './session.js';
import { addRoute,startRouter } from './router.js';
import { renderNav } from './components/nav.js';
import { toast } from './components/toast.js';
import { renderLoading } from './components/state-view.js';
import { empty } from './components/ui.js';
import { openAuthModal } from './components/auth-modal.js';
import { authApi } from './api/auth.api.js';
import { renderMarketplace,renderPublicEvent,renderServiceDirectory } from './pages/marketplace.page.js';
import { renderCheckout } from './pages/checkout.page.js';
import { renderWallet,renderOrders } from './components/tickets-view.js';
import { renderEventSales,renderSupplierServices,renderContracts,renderAccount,renderNotifications,renderAdminCommerce } from './pages/management.page.js';
import { renderLoginPage,renderCadastroPage,renderRecoveryPage,renderAguardandoAprovacao } from './pages/auth.page.js';
import { renderListPage } from './pages/eventos-list.page.js';
import { renderCreatePage,renderEditPage } from './pages/evento-form.page.js';
import { renderDetailPage } from './pages/evento-detail.page.js';
import { renderOportunidades,renderOportunidadeDetalhe,renderMinhasPropostas } from './pages/fornecedor.page.js';
import { renderAdminUsuarios,renderAdminEventos,renderAdminResumo } from './pages/admin.page.js';

let expired=false,expiredNotice=false;
const all=['comprador','organizador','fornecedor','administrador'];
function guarded(handler,roles=all){
  return (params,query,isCurrent)=>{
    const user=session.user(),app=document.getElementById('app');
    if(!user || expired){
      const next=window.location.hash.slice(1)||'/';
      app.innerHTML=empty('Entre para continuar','Sua navegação e seu carrinho continuam guardados.',
        `<button class="btn btn-primary" id="guard-login">Entrar</button><a class="btn btn-secondary" href="#/cadastro?next=${encodeURIComponent(next)}">Criar conta</a>`);
      app.querySelector('#guard-login').onclick=()=>openAuthModal();return;
    }
    if(!roles.includes(user.perfil)){
      app.innerHTML=empty('Esta área usa outro perfil','Você pode explorar eventos ou trocar de conta pelo menu.','<a class="btn btn-secondary" href="#/">Explorar eventos</a>');return;
    }
    if(user.perfil!=='administrador' && user.status!=='aprovado'){
      renderAguardandoAprovacao(user);return;
    }
    return handler(params,query,isCurrent);
  };
}
addRoute('/',renderMarketplace);
addRoute('/explorar/:id',renderPublicEvent);
addRoute('/servicos',renderServiceDirectory);
addRoute('/fornecedores/:id',renderServiceDirectory);
addRoute('/login',renderLoginPage);
addRoute('/cadastro',renderCadastroPage);
addRoute('/recuperar',renderRecoveryPage);
addRoute('/checkout/:id',renderCheckout);
addRoute('/carteira',guarded(renderWallet,['comprador']));
addRoute('/pedidos',guarded(renderOrders,['comprador']));
addRoute('/perfil',guarded(renderAccount));
addRoute('/notificacoes',guarded(renderNotifications));
addRoute('/eventos',guarded(renderListPage,['organizador','administrador']));
addRoute('/eventos/novo',guarded(renderCreatePage,['organizador','administrador']));
addRoute('/eventos/:id/editar',guarded(renderEditPage,['organizador','administrador']));
addRoute('/eventos/:id',guarded(renderDetailPage,['organizador','administrador']));
addRoute('/gestao/eventos/:id',guarded(renderEventSales,['organizador','administrador']));
addRoute('/fornecedor/oportunidades',guarded(renderOportunidades,['fornecedor','administrador']));
addRoute('/fornecedor/oportunidades/:id',guarded(renderOportunidadeDetalhe,['fornecedor','administrador']));
addRoute('/fornecedor/propostas',guarded(renderMinhasPropostas,['fornecedor','administrador']));
addRoute('/fornecedor/servicos',guarded(renderSupplierServices,['fornecedor','administrador']));
addRoute('/fornecedor/contratos',guarded(renderContracts,['fornecedor','administrador']));
addRoute('/admin/usuarios',guarded(renderAdminUsuarios,['administrador']));
addRoute('/admin/eventos',guarded(renderAdminEventos,['administrador']));
addRoute('/admin/resumo',guarded(renderAdminResumo,['administrador']));
for(const aba of ['moderacao','financeiro','regras','logs']){
  addRoute('/admin/'+aba,guarded((_p,q,current)=>renderAdminCommerce({aba},q,current),['administrador']));
}
// Endereços antigos conservam a tela e abrem o conteúdo integrado da carteira.
addRoute('/revendas',guarded(renderWallet,['comprador']));
addRoute('/revendas/anuncios',guarded((p,q,c)=>renderWallet(p,{aba:'revendas'},c),['comprador']));
addRoute('/revendas/compras',guarded(renderOrders,['comprador']));

window.addEventListener('sessao-alterada',()=>{expired=false;expiredNotice=false;renderNav();});
window.addEventListener('sessao-expirada',()=>{
  expired=true;
  if(expiredNotice)return;
  expiredNotice=true;
  toast.info('Sua sessão precisa ser renovada. Sua página e seu carrinho foram mantidos.');
  openAuthModal();
});
window.addEventListener('sessao-revalidar',async()=>{
  try {
    const answer=await authApi.me();session.updateUser(answer.usuario);expired=false;
    renderNav();window.dispatchEvent(new Event('rota-atualizar'));
  }catch(error){toast.error(error.message);}
});
async function boot(){
  document.getElementById('app').innerHTML=renderLoading('Preparando sua experiência...');
  renderNav();
  if(session.token()){
    try{const answer=await authApi.me();session.updateUser(answer.usuario);}
    catch(error){
      if(error.status===401)expired=true;
      else toast.info('Não foi possível verificar a sessão agora. Você pode tentar novamente.');
    }
  }
  startRouter({beforeRender:renderNav,onNotFound:()=>{
    document.getElementById('app').innerHTML=empty('Esta página não foi encontrada','Confira o endereço ou volte à busca de eventos.','<a class="btn btn-primary" href="#/">Explorar eventos</a>');
  }});
}
boot();
