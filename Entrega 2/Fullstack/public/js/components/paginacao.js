import { escapeHtml } from '../utils/format.js';

/** Controles de paginação com data-page (usar com delegação de eventos no contêiner). */
export function renderPaginacao({ page, totalPages, total }) {
  return `
    <nav class="pagination" aria-label="Paginação">
      <button type="button" class="btn btn-secondary btn-sm" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>← Anterior</button>
      <span class="muted">Página ${page} de ${totalPages} · ${escapeHtml(total)} registro(s)</span>
      <button type="button" class="btn btn-secondary btn-sm" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>Próxima →</button>
    </nav>`;
}
