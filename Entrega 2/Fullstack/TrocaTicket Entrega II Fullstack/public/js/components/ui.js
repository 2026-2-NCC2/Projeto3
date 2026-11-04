import { escapeHtml,formatBRL,formatDateTime } from '../utils/format.js';
import { toast } from './toast.js';
export const esc=escapeHtml;
export const money=cents=>formatBRL(Number(cents)/100);
export const date=value=>formatDateTime(value);
export const statusLabel={pendente:'Em análise',publicado:'Disponível',reprovado:'Reprovado',aprovado:'Aprovado',rejeitado:'Rejeitado',
  retido:'Valor protegido',contestado:'Em contestação',repassado:'Repasse concluído',estornado:'Estornado',cancelado:'Cancelado',
  valido:'Válido',utilizado:'Utilizado',vendido:'Vendido',ativo:'Em execução',concluido:'Concluído'};
export const badge=s=>`<span class="badge status-${esc(s)}">${esc(statusLabel[s]||s)}</span>`;
export const heading=(eyebrow,title,subtitle='',actions='')=>`<section class="page-header"><div><p class="eyebrow">${esc(eyebrow)}</p><h1>${esc(title)}</h1>${subtitle?`<p class="muted">${esc(subtitle)}</p>`:''}</div><div class="header-actions">${actions}</div></section>`;
export const empty=(title,detail='',link='')=>`<div class="empty-state"><span class="empty-symbol">✦</span><h2>${esc(title)}</h2><p class="muted">${esc(detail)}</p>${link}</div>`;
export function formAction(form,work) {
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    form.querySelectorAll('[data-validation-error]').forEach(node=>node.remove());
    form.querySelectorAll('[aria-invalid]').forEach(input=>{
      input.removeAttribute('aria-invalid');
      input.removeAttribute('aria-errormessage');
    });
    if(!form.reportValidity())return;
    const btn=form.querySelector('[type=submit]')||form.querySelector('button');
    if(btn?.disabled)return;
    const inline=form.querySelector('[data-form-error]');
    if(inline)inline.textContent='';
    if(btn)btn.disabled=true;
    try{await work(Object.fromEntries(new FormData(form)));}
    catch(error){
      const details=Array.isArray(error.details)?error.details:[];
      const messages=[...new Set(details.map(detail=>detail.message).filter(Boolean))];
      const message=messages.length?messages.join(' '):error.message;
      if(inline?.isConnected)inline.textContent=message;
      for(const [index,detail] of details.entries()){
        const input=form.elements.namedItem(detail.field);
        if(!input?.setAttribute || !form.isConnected)continue;
        const errorId='validation-'+(form.id||'form')+'-'+index;
        input.setAttribute('aria-invalid','true');
        input.setAttribute('aria-errormessage',errorId);
        const note=document.createElement('span');
        note.id=errorId;
        note.dataset.validationError='';
        note.className='field-validation-error';
        note.textContent=detail.message;
        input.insertAdjacentElement('afterend',note);
      }
      if(form.isConnected)form.querySelector('[aria-invalid="true"]')?.focus();
      toast.error(message);
    }
    finally{if(btn)btn.disabled=false;}
  });
}
export async function busy(button,work) {
  if(button.disabled)return;
  button.disabled=true;
  try{await work();}catch(error){toast.error(error.message);}finally{button.disabled=false;}
}
export const field=(name,label,type='text',extra='',value='')=>`<label class="field">${esc(label)}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
export const errorBox='<p class="form-error" data-form-error role="alert"></p>';
export const cents=value=>Math.round(Number(value)*100);
