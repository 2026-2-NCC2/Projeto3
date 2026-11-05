import { eventosApi } from '../api/eventos.api.js';
import { renderLoading, renderError, renderEmpty } from '../components/state-view.js';
import { toast } from '../components/toast.js';
import { mensagemDeErro } from '../api/http.js';
import { escapeHtml, formatBRL, formatDate, CATEGORIAS_ITEM, STATUS_PROPOSTA } from '../utils/format.js';

const badge = (status) => {
  const css = { enviada: 'badge-rascunho', selecionada: 'badge-publicado', cancelada: 'badge-cancelado' }[status] ?? '';
  return `<span class="badge ${css}">${STATUS_PROPOSTA[status] ?? status}</span>`;
};

function renderItem(item, editavel) {
  const est = item.estatisticas;
  const linhas = item.propostas.map((p) => `
    <tr class="${p.status === 'selecionada' ? 'linha-selecionada' : ''}">
      <td data-label="Fornecedor">${escapeHtml(p.fornecedor)}
        ${p.menor_valor ? '<span class="badge badge-publicado">Menor valor</span>' : ''}
        ${p.area_atuacao ? `<br><span class="muted small">${escapeHtml(p.area_atuacao)}</span>` : ''}</td>
      <td data-label="Valor"><strong>${formatBRL(p.valor)}</strong></td>
      <td data-label="Validade">${formatDate(p.validade)}</td>
      <td data-label="Proposta">${escapeHtml(p.descricao)}
        ${p.observacoes ? `<br><span class="muted small">${escapeHtml(p.observacoes)}</span>` : ''}</td>
      <td data-label="Status">${badge(p.status)}</td>
      <td class="actions" data-label="Ações">
        ${editavel && p.status === 'enviada' ? `<button class="btn btn-primary btn-sm" data-action="selecionar" data-id="${p.id}">Selecionar</button>` : ''}
        ${editavel && p.status === 'selecionada' ? `<button class="btn btn-secondary btn-sm" data-action="liberar" data-id="${p.id}">Liberar</button>` : ''}
      </td>
    </tr>`).join('');

  return `
    <section class="card">
      <header class="cabecalho-item">
        <h2>${escapeHtml(item.nome)}</h2>
        <span class="muted">${CATEGORIAS_ITEM[item.categoria] ?? item.categoria} · ${est.quantidade} proposta(s)</span>
      </header>
      ${item.propostas.length
        ? `<div class="table-wrapper"><table class="table">
             <thead><tr><th>Fornecedor</th><th>Valor</th><th>Validade</th><th>Proposta</th><th>Status</th><th></th></tr></thead>
             <tbody>${linhas}</tbody>
           </table></div>`
        : '<p class="muted">Nenhuma proposta recebida para este item ainda.</p>'}
      <p class="muted small">Menor: ${formatBRL(est.menor)} · Maior: ${formatBRL(est.maior)} · Média: ${formatBRL(est.media)}</p>
    </section>`;
}

/**
 * Aba "Cotações" (RF11 e RF12): comparação de propostas por item e seleção.
 * Regra: uma proposta selecionada por item; liberar devolve o item para comparação.
 */
export async function renderTabCotacoes(slot, evento, { editavel, recarregar }) {
  slot.innerHTML = renderLoading('Carregando cotações...');
  let dados;
  try {
    dados = await eventosApi.cotacoes(evento.id);
  } catch (err) {
    slot.innerHTML = renderError(mensagemDeErro(err), 'retry-cotacoes');
    document.getElementById('retry-cotacoes').addEventListener('click', recarregar);
    return;
  }

  if (!dados.itens.length) {
    slot.innerHTML = renderEmpty('Cadastre itens de custo para receber propostas.');
    return;
  }

  slot.innerHTML = `
    <p class="muted">Propostas por item, do menor para o maior valor. Selecione uma proposta por item para compor o orçamento.</p>
    ${dados.itens.map((item) => renderItem(item, editavel)).join('')}`;

  slot.addEventListener('click', async (event) => {
    const btn = event.target.closest('[data-action]');
    if (!btn) return;
    try {
      if (btn.dataset.action === 'selecionar') {
        await eventosApi.selecionarProposta(btn.dataset.id);
        toast.success('Proposta selecionada e incluída no orçamento.');
      } else {
        await eventosApi.liberarProposta(btn.dataset.id);
        toast.info('Proposta liberada para nova seleção.');
      }
      recarregar();
    } catch (err) {
      toast.error(mensagemDeErro(err));
    }
  });
}
