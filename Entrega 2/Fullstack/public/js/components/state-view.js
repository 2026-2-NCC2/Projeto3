import { escapeHtml } from '../utils/format.js';

/** Indicador de carregamento acessível (role=status). */
export function renderLoading(label = 'Carregando...') {
  return `
    <div class="skeleton-state" role="status" aria-label="${escapeHtml(label)}">
      <div class="skeleton skeleton-title"></div><div class="skeleton-row">
      <div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div></div>
      <p class="muted small">${escapeHtml(label)}</p>
    </div>`;
}

/**
 * Mensagem de erro com botão de nova tentativa.
 * O botão deve receber listener pelo chamador, usando o id informado.
 */
export function renderError(message, retryId = 'retry') {
  return `
    <div class="state state-error" role="alert">
      <p>${escapeHtml(message)}</p>
      <button type="button" class="btn btn-secondary" id="${escapeHtml(retryId)}">Tentar novamente</button>
    </div>`;
}

/** Estado vazio com ação opcional (HTML confiável fornecido pelo chamador). */
export function renderEmpty(message, actionHtml = '') {
  return `
    <div class="state state-empty">
      <p>${escapeHtml(message)}</p>
      ${actionHtml}
    </div>`;
}
