import { mountAuth } from '../components/auth-modal.js';
import { navigate } from '../router.js';
import { esc } from '../components/ui.js';

export function homeDoPerfil(user) {
  return {organizador:'/eventos',fornecedor:'/fornecedor/oportunidades',administrador:'/admin/resumo',comprador:'/carteira'}[user.perfil]||'/';
}
export function renderAguardandoAprovacao(user) {
  document.getElementById('app').innerHTML=`<section class="empty-state"><span class="empty-symbol">◷</span>
    <h1>${user.status==='rejeitado'?'Cadastro não aprovado':'Seu cadastro está em análise'}</h1>
    <p>${esc(user.nome)}, acompanhe aqui o acesso à sua área de gestão.</p>
    <button class="btn btn-primary" id="recheck-approval">Consultar aprovação</button>
    <a class="btn btn-secondary" href="#/">Explorar eventos</a></section>`;
  document.getElementById('recheck-approval').onclick=()=>window.dispatchEvent(new Event('sessao-revalidar'));
}
function authPage(mode,query,isCurrent) {
  const app=document.getElementById('app');
  app.innerHTML=`<section class="auth-layout"><div class="auth-story"><p class="eyebrow">ENCONTRE SEU LUGAR</p>
    <h1>Histórias boas<br>começam com<br>um encontro<span>.</span></h1><p>Ingressos oficiais, revenda entre fãs e tudo para tirar seu evento do papel.</p>
    <img src="assets/sunset.svg" alt="Arte abstrata do Sunset Festival"></div>
    <section class="card auth-panel"><h2>${mode==='cadastro'?'Crie sua conta':mode==='recuperar'?'Recuperar senha':'Que bom ter você aqui'}</h2><div id="auth-slot"></div></section></section>`;
  return mountAuth(app.querySelector('#auth-slot'),{mode,isCurrent,onSuccess:()=>navigate('/')});
}
export const renderLoginPage=(_p,q,current)=>authPage('login',q,current);
export const renderCadastroPage=(_p,q,current)=>authPage('cadastro',q,current);
export const renderRecoveryPage=(_p,q,current)=>authPage('recuperar',q,current);
