import { closeModal } from './components/modal.js';
import { esc } from './components/ui.js';
const routes=[];
export function addRoute(pattern,handler){
  const keys=[];
  const source=pattern.replace(/:([A-Za-z_]\w*)/g,(_,key)=>{keys.push(key);return '([^/]+)';});
  routes.push({regex:new RegExp('^'+source+'$'),keys,handler});
}
export function currentRoute(){
  const raw=window.location.hash.slice(1)||'/';
  const at=raw.indexOf('?');
  const path=(at<0?raw:raw.slice(0,at)).replace(/\/+$/,'')||'/';
  return {path,query:Object.fromEntries(new URLSearchParams(at<0?'':raw.slice(at+1)))};
}
export function navigate(path,query={}){
  const qs=new URLSearchParams(query).toString(),hash=path+(qs?'?'+qs:'');
  if(window.location.hash==='#'+hash)window.dispatchEvent(new Event('rota-atualizar'));
  else window.location.hash=hash;
}
export function replaceQuery(query={}){
  const qs=new URLSearchParams(query).toString();
  history.replaceState(null,'',window.location.pathname+window.location.search+'#'+currentRoute().path+(qs?'?'+qs:''));
}
export function startRouter({onNotFound,beforeRender=()=>{}}){
  let seq=0;
  const render=async()=>{
    const current=++seq,isCurrent=()=>current===seq;
    const {path,query}=currentRoute();
    try{
      closeModal();beforeRender();
      const found=routes.find(route=>route.regex.test(path));
      if(!found){onNotFound(path);return;}
      const match=found.regex.exec(path);
      const params=Object.fromEntries(found.keys.map((key,i)=>[key,decodeURIComponent(match[i+1])]));
      await found.handler(params,query,isCurrent);
    }catch(error){
      if(!isCurrent())return;
      document.getElementById('app').innerHTML=`<section class="state state-error"><h1>Não foi possível carregar esta página</h1><p>${esc(error.message)}</p><button class="btn btn-primary" id="retry-route">Tentar novamente</button><a class="btn btn-secondary" href="#/">Explorar eventos</a></section>`;
      document.getElementById('retry-route').onclick=render;
    }
  };
  window.addEventListener('hashchange',render);
  window.addEventListener('rota-atualizar',render);
  render();
}
