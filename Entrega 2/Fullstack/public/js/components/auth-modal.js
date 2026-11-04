import { authApi } from '../api/auth.api.js';
import { request } from '../api/http.js';
import { post } from '../api/commerce.api.js';
import { session } from '../session.js';
import { esc,field,errorBox,formAction } from './ui.js';
import { toast } from './toast.js';
import { openModal } from './modal.js';
import { navigate } from '../router.js';

let modePromise;
export const appMode=()=>modePromise??=(authApi.modo().catch(()=>({apresentacao:false})));
const signalLogin=answer=>{
  session.set({token:answer.token,usuario:answer.usuario});
  window.dispatchEvent(new CustomEvent('sessao-alterada'));
};
const strong='required minlength="8" maxlength="72" autocomplete="new-password"';
export async function mountAuth(slot,{mode='login',onSuccess=()=>{},isCurrent=()=>true}={}) {
  const settings=await appMode();
  if(!slot.isConnected || !isCurrent())return;
  const draw=state=>{
    if(!slot.isConnected)return;
    if(state==='login') {
      slot.innerHTML=`<p class="muted">Entre para guardar seus ingressos e continuar de onde parou.</p>
        <form class="stack" id="auth-login">
          ${field('email','E-mail','email','required autocomplete="username"')}
          ${field('senha','Senha','password','required autocomplete="current-password"')}
          <button type="button" class="text-button" data-state="recover">Esqueci minha senha</button>
          ${errorBox}<button type="submit" class="btn btn-primary full-width">Entrar</button>
        </form><p class="center small">Ainda não tem conta? <button type="button" class="text-button" data-state="signup">Criar conta</button></p>
        ${settings.apresentacao?`<details class="demo-access"><summary>Acessos para apresentar</summary>
          <p class="muted small">Abra uma conta de exemplo com os dados prontos.</p><div class="demo-buttons">
          ${['comprador','organizador','fornecedor','administrador'].map(p=>`<button class="btn btn-secondary btn-sm" data-demo="${p}">${p}</button>`).join('')}
          </div></details>`:''}`;
      formAction(slot.querySelector('form'),async data=>{
        const answer=await authApi.login(data.email,data.senha);
        if(!slot.isConnected)return;
        signalLogin(answer);toast.success('Você entrou na sua conta.');onSuccess(answer.usuario);
      });
      slot.querySelectorAll('[data-demo]').forEach(button=>button.onclick=async()=>{
        button.disabled=true;
        try {
          const answer=await authApi.loginDemo('apresentacao@demo.local','demo',button.dataset.demo);
          if(!slot.isConnected)return;
          signalLogin(answer);toast.success('Conta de apresentação aberta.');onSuccess(answer.usuario);
        } catch(error){if(slot.isConnected)toast.error(error.message);}
        finally{button.disabled=false;}
      });
    }
    if(state==='signup') {
      slot.innerHTML=`<p class="muted">Seu próximo encontro começa com uma conta.</p><form class="stack" id="auth-signup">
        <label class="field">Como você vai usar a TrocaTicket?
        <select name="perfil"><option value="comprador">Quero comprar e revender ingressos</option><option value="organizador">Quero organizar eventos</option><option value="fornecedor">Quero oferecer serviços</option></select></label>
        ${field('nome','Nome completo','text','required minlength="3" maxlength="120" autocomplete="name"')}
        ${field('email','E-mail','email','required autocomplete="email"')}
        ${field('senha','Senha · mínimo 8 caracteres, letras e números','password',strong)}
        <div data-vendor hidden class="stack">
          ${field('razao_social','Razão social','text','minlength="3" maxlength="160"')}
          ${field('documento',settings.apresentacao?'CNPJ de teste · 14 dígitos':'CNPJ','text','maxlength="18" placeholder="00.000.000/0000-00" inputmode="numeric"')}
          ${field('area_atuacao','Área de atuação','text','minlength="3" maxlength="120"')}
        </div>
        ${errorBox}<button type="submit" class="btn btn-primary full-width">Criar minha conta</button>
        </form><p class="center small">Já tem uma conta? <button class="text-button" data-state="login">Entrar</button></p>`;
      const form=slot.querySelector('form');
      form.elements.perfil.onchange=()=>{
        const vendor=form.elements.perfil.value==='fornecedor';
        form.querySelector('[data-vendor]').hidden=!vendor;
        form.querySelectorAll('[data-vendor] input').forEach(el=>el.required=vendor);
      };
      formAction(form,async ({perfil,...data})=>{
        if(perfil!=='fornecedor') {delete data.documento;delete data.area_atuacao;delete data.razao_social;}
        const answer=await request('/auth/cadastro/'+perfil,{method:'POST',body:data,auth:false});
        if(!slot.isConnected)return;
        toast.success(answer.mensagem);
        if(perfil==='comprador'){
          const login=await authApi.login(data.email,data.senha);
          if(!slot.isConnected)return;
          signalLogin(login);onSuccess(login.usuario);
        } else {
          slot.innerHTML=`<div class="empty-state"><span class="empty-symbol">✓</span><h2>Cadastro recebido</h2><p>Um administrador vai analisar seu cadastro. Entre para acompanhar sua aprovação.</p><button class="btn btn-primary" data-state="login">Ir para o login</button></div>`;
          bindStates();
        }
      });
    }
    if(state==='recover') {
      slot.innerHTML=`<p class="muted">Vamos enviar um código válido por 10 minutos para o e-mail da sua conta.</p>
        <form class="stack">${field('email','E-mail cadastrado','email','required autocomplete="email"')}${errorBox}
        <button type="submit" class="btn btn-primary">Enviar código</button></form>
        <p><button class="text-button" data-state="login">Voltar ao login</button></p>`;
      formAction(slot.querySelector('form'),async data=>{
        const answer=await post('/recuperar-senha',data);
        if(!slot.isConnected)return;
        slot.innerHTML=`<p class="muted">${esc(answer.mensagem)}</p>
          ${answer.codigo_demo?`<div class="notice"><strong>Caixa de e-mail da apresentação</strong><p>Seu código de teste é <b>${esc(answer.codigo_demo)}</b>.</p></div>`:''}
          <form class="stack">${field('codigo','Código de 6 dígitos','text','required pattern="[0-9]{6}" inputmode="numeric" autocomplete="one-time-code"')}
            ${field('senha','Nova senha · letras e números','password',strong)}
            ${field('confirmacao','Confirmar nova senha','password',strong)}
            ${errorBox}<button type="submit" class="btn btn-primary">Salvar nova senha</button>
          </form><p><button class="text-button" data-state="recover">Solicitar outro código</button></p>`;
        formAction(slot.querySelector('form'),async data=>{
          await post('/redefinir-senha',{...data,id:answer.id});
          if(!slot.isConnected)return;
          toast.success('Senha redefinida. Entre novamente.');draw('login');
        });
        bindStates();
      });
    }
    bindStates();
  };
  function bindStates(){slot.querySelectorAll('[data-state]').forEach(button=>button.onclick=()=>draw(button.dataset.state));}
  draw(mode==='cadastro'?'signup':mode==='recuperar'?'recover':mode);
}
let authOpen=false;
export function openAuthModal({mode='login',onSuccess=()=>navigate('/')}={}) {
  if(authOpen)return;
  const {element,close}=openModal(mode==='signup'?'Crie sua conta':'Acesse sua conta','<div id="auth-modal-slot"></div>',{onClose:()=>{authOpen=false;}});
  authOpen=true;
  mountAuth(element.querySelector('#auth-modal-slot'),{mode,onSuccess:user=>{close();onSuccess(user);}});
}
