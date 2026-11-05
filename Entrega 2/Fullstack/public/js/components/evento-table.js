import { escapeHtml, formatDateTime, formatNumber, STATUS_LABELS } from '../utils/format.js';

/**
 * Renderiza a listagem de eventos.
 * Cada célula tem data-label para o layout em cartões no mobile.
 * @param {Array<object>} eventos
 * @returns {string} HTML
 */
export function renderEventoTable(eventos) {
  return `
    <div class="table-wrapper card">
      <table class="table">
        <caption class="sr-only">Lista de eventos cadastrados</caption>
        <thead>
          <tr>
            <th scope="col">Nome</th>
            <th scope="col">Local</th>
            <th scope="col">Início</th>
            <th scope="col">Público (mín. – máx.)</th>
            <th scope="col">Status</th>
            <th scope="col" class="actions-col">Ações</th>
          </tr>
        </thead>
        <tbody>
          ${eventos.map(renderRow).join('')}
        </tbody>
      </table>
    </div>`;
}

function renderRow(evento) {
  const nome = escapeHtml(evento.nome);
  return `
    <tr>
      <td data-label="Nome"><a class="link" href="#/eventos/${evento.id}">${nome}</a></td>
      <td data-label="Local">${escapeHtml(evento.local_evento)}</td>
      <td data-label="Início">${formatDateTime(evento.data_inicio)}</td>
      <td data-label="Público">${formatNumber(evento.publico_minimo)} – ${formatNumber(evento.publico_maximo)}</td>
      <td data-label="Status">
        <span class="badge badge-${escapeHtml(evento.status)}">${STATUS_LABELS[evento.status] ?? escapeHtml(evento.status)}</span>
      </td>
      <td class="actions" data-label="Ações">
        <a class="btn btn-ghost btn-sm" href="#/eventos/${evento.id}" aria-label="Ver detalhes de ${nome}">Ver</a>
        <a class="btn btn-secondary btn-sm" href="#/eventos/${evento.id}/editar" aria-label="Editar ${nome}">Editar</a>
        <button type="button" class="btn btn-danger btn-sm" data-action="delete"
          data-id="${evento.id}" data-name="${nome}" aria-label="Excluir ${nome}">Excluir</button>
      </td>
    </tr>`;
}
