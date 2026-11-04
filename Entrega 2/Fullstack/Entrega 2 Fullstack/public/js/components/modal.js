import { escapeHtml } from '../utils/format.js';

let currentClose;
export function closeModal() { currentClose?.(); }
export function openModal(title, body, { wide=false, onClose=()=>{} }={}) {
  closeModal();
  const root=document.getElementById('modal-root');
  const previous=document.activeElement;
  root.innerHTML=`<div class="modal-backdrop"><section class="modal ${wide?'wide':''}" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
    <header class="dialog-head"><h2 id="dialog-title">${escapeHtml(title)}</h2><button type="button" class="icon-button" aria-label="Fechar" data-close>×</button></header>
    <div class="modal-body">${body}</div></section></div>`;
  document.body.classList.add('modal-open');
  const dialog=root.querySelector('.modal');
  let closed=false;
  const close=()=>{
    if(closed)return;
    closed=true; document.removeEventListener('keydown',key);
    document.body.classList.remove('modal-open');root.innerHTML='';
    currentClose=null; previous?.isConnected && previous.focus(); onClose();
  };
  const key=e=>{
    if(e.key==='Escape') close();
    if(e.key==='Tab'){
      const items=[...dialog.querySelectorAll('button,input,select,textarea,a[href]')].filter(el=>!el.disabled && el.getClientRects().length);
      const first=items[0],last=items.at(-1);
      if(e.shiftKey && document.activeElement===first){e.preventDefault();last?.focus();}
      if(!e.shiftKey && document.activeElement===last){e.preventDefault();first?.focus();}
    }
  };
  root.querySelector('[data-close]').onclick=close;
  root.querySelector('.modal-backdrop').onclick=e=>{if(e.target===e.currentTarget)close();};
  document.addEventListener('keydown',key);
  currentClose=close;
  queueMicrotask(()=>dialog.querySelector('input,button')?.focus());
  return {element:dialog,close};
}
