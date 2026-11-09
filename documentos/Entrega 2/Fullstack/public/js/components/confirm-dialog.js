import { escapeHtml } from '../utils/format.js';
import { openModal } from './modal.js';

export function confirmDialog({title,message,confirmLabel='Confirmar',danger=false}) {
  return new Promise(resolve=>{
    let result=false;
    const {element,close}=openModal(title,`<p>${escapeHtml(message)}</p><div class="modal-actions">
      <button type="button" class="btn btn-secondary" data-cancel>Voltar</button>
      <button type="button" class="btn ${danger?'btn-danger':'btn-primary'}" data-confirm>${escapeHtml(confirmLabel)}</button></div>`,{onClose:()=>resolve(result)});
    element.querySelector('[data-cancel]').onclick=close;
    element.querySelector('[data-confirm]').onclick=()=>{result=true;close();};
  });
}
