import { session } from '../session.js';
import { esc } from './ui.js';
import { navigate } from '../router.js';
import { openAuthModal } from './auth-modal.js';
import { closeModal } from './modal.js';
import { toast } from './toast.js';
const links={
  comprador:[['/carteira','Meus ingressos'],['/carteira?aba=revendas','Minhas revendas'],['/pedidos','Meus pedidos']],
  organizador:[['/eventos','Meus eventos'],['/eventos/novo','Criar evento'],['/servicos','Fornecedores']],
  fornecedor:[['/fornecedor/oportunidades','Oportunidades'],['/fornecedor/propostas','Minhas propostas'],['/fornecedor/servicos','Meus serviços'],['/fornecedor/contratos','Contratos']],
  administrador:[['/admin/resumo','Visão geral'],['/admin/usuarios','Usuários'],['/admin/eventos','Eventos'],['/admin/moderacao','Moderação'],['/admin/financeiro','Financeiro'],['/admin/regras','Taxas e regras'],['/admin/logs','Auditoria']],
};
export function renderNav(){
  const user=session.user(),current=window.location.hash.slice(1)||'/';
  const nav=document.getElementById('topnav');
  nav.innerHTML=`<a href="#/" class="header-explore">Explorar</a><a href="#/servicos" class="header-services">Para seu evento</a>
    <form class="header-search" role="search"><span aria-hidden="true">⌕</span><input name="q" aria-label="Buscar eventos" placeholder="Qual é o seu próximo encontro?"><button aria-label="Pesquisar" type="submit">↵</button></form>
    ${localStorage.getItem('trocaticket.carrinho')?`<a href="#/checkout/${esc(localStorage.getItem('trocaticket.carrinho'))}" class="icon-button" aria-label="Retomar carrinho">▣</a>`:''}
    <button class="icon-button" id="theme-toggle"  aria-label="Alternar tema">${document.documentElement.dataset.theme==='dark'?'☀':'☾'}</button>
    ${user?`<a class="icon-button" href="#/notificacoes" aria-label="Notificações">♧</a><a href="#/perfil" class="avatar" aria-label="Meu perfil">${esc(user.nome.slice(0,1))}</a>
      <button class="text-button" id="btn-sair">Sair</button>`:`<button class="text-button" id="nav-login">Entrar</button><a class="btn btn-primary btn-sm" href="#/cadastro">Criar conta <span aria-hidden="true">↗</span></a>`}`;
  nav.querySelector('form').onsubmit=e=>{e.preventDefault();navigate('/',{q:new FormData(e.currentTarget).get('q')});};
  nav.querySelector('#theme-toggle').onclick=()=>{
    const theme=document.documentElement.dataset.theme==='dark'?'light':'dark';
    document.documentElement.dataset.theme=theme;localStorage.setItem('trocaticket.tema',theme);renderNav();
  };
  nav.querySelector('#nav-login')?.addEventListener('click',()=>openAuthModal());
  nav.querySelector('#btn-sair')?.addEventListener('click',()=>{
    session.clear();closeModal();renderNav();toast.info('Você saiu da sua conta.');
    window.dispatchEvent(new Event('rota-atualizar'));
  });
  document.getElementById('context-nav').innerHTML=user?`<div class="context-inner"><span class="context-title">${{comprador:'Sua experiência',organizador:'Portal do organizador',fornecedor:'Portal do fornecedor',administrador:'Administração'}[user.perfil]||'Minha conta'}</span><nav aria-label="Menu da conta">
    ${(links[user.perfil]||[]).map(([path,title])=>`<a href="#${path}" class="${current===path?'active':''}">${title}</a>`).join('')}
    <a href="#/perfil" class="${current==='/perfil'?'active':''}">Perfil</a></nav></div>`:'';
}
