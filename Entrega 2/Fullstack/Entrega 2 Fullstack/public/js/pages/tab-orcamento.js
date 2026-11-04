import { eventosApi } from '../api/eventos.api.js';
import { renderLoading, renderError } from '../components/state-view.js';
import { mensagemDeErro } from '../api/http.js';
import { escapeHtml, formatBRL, CATEGORIAS_ITEM, TIPOS_CUSTO } from '../utils/format.js';

const NOMES_CENARIO = { minimo: 'Mínimo', esperado: 'Esperado', maximo: 'Máximo' };

/**
 * Aba "Orçamento e ticket" (RF12 e RF13): custos consolidados e ticket estimado por cenário.
 */
export async function renderTabOrcamento(slot, evento) {
  slot.innerHTML = renderLoading('Consolidando orçamento e calculando o ticket...');
  let orc;
  let tk;
  try {
    [orc, tk] = await Promise.all([eventosApi.orcamento(evento.id), eventosApi.ticket(evento.id)]);
  } catch (err) {
    slot.innerHTML = renderError(mensagemDeErro(err), 'retry-orcamento');
    document.getElementById('retry-orcamento').addEventListener('click', () => renderTabOrcamento(slot, evento));
    return;
  }

  slot.innerHTML = `
    <div class="grid-2">
      <section class="card">
        <header class="cabecalho-item">
          <h2>Orçamento consolidado</h2>
          ${orc.completo
            ? '<span class="badge badge-publicado">Completo</span>'
            : '<span class="badge badge-rascunho">Em aberto</span>'}
        </header>
        <div class="table-wrapper"><table class="table compact">
          <thead><tr><th>Item / custo</th><th>Fornecedor</th><th>Valor</th></tr></thead>
          <tbody>
            ${orc.itens.map((i) => `
              <tr>
                <td data-label="Item">${escapeHtml(i.nome)} <span class="muted small">${CATEGORIAS_ITEM[i.categoria] ?? ''}</span></td>
                <td data-label="Fornecedor">${i.fornecedor ? escapeHtml(i.fornecedor) : '<span class="muted">— pendente</span>'}</td>
                <td data-label="Valor">${i.valor !== null ? formatBRL(i.valor) : '—'}</td>
              </tr>`).join('')}
            ${orc.custos.map((c) => `
              <tr>
                <td data-label="Custo">${escapeHtml(c.descricao)} <span class="muted small">${TIPOS_CUSTO[c.tipo] ?? ''}</span></td>
                <td data-label="Fornecedor"><span class="muted">Interno</span></td>
                <td data-label="Valor">${formatBRL(c.valor)}</td>
              </tr>`).join('')}
          </tbody>
          <tfoot>
            <tr><th colspan="2">Custo total</th><th>${formatBRL(orc.totais.total)}</th></tr>
          </tfoot>
        </table></div>
        ${orc.pendencias.length
          ? `<ul class="pendencias">${orc.pendencias.map((p) => `<li>${escapeHtml(p)}</li>`).join('')}</ul>`
          : ''}
      </section>

      <section class="card">
        <header class="cabecalho-item">
          <h2>Ticket estimado</h2>
          <span class="muted">Margem: <strong>${tk.margem_lucro_percentual}%</strong></span>
        </header>
        <div class="table-wrapper"><table class="table compact">
          <thead><tr><th>Cenário</th><th>Público</th><th>Equilíbrio</th><th>Alvo (com margem)</th></tr></thead>
          <tbody>
            ${tk.cenarios.map((c) => `
              <tr>
                <td data-label="Cenário">${NOMES_CENARIO[c.cenario] ?? c.cenario}</td>
                <td data-label="Público">${c.publico.toLocaleString('pt-BR')}</td>
                <td data-label="Equilíbrio">${formatBRL(c.ticket_equilibrio)}</td>
                <td data-label="Alvo"><strong>${formatBRL(c.ticket_alvo)}</strong></td>
              </tr>`).join('')}
          </tbody>
        </table></div>
        ${tk.aviso ? `<p class="aviso">${escapeHtml(tk.aviso)}</p>` : ''}
        <details class="formulas">
          <summary>Fórmulas e critérios de arredondamento</summary>
          <p>${escapeHtml(tk.formulas.ticket_de_equilibrio)}</p>
          <p>${escapeHtml(tk.formulas.ticket_alvo)}</p>
          <p>${escapeHtml(tk.formulas.margem)}</p>
          <p class="muted small">${escapeHtml(tk.arredondamento)}</p>
        </details>
      </section>
    </div>`;
}
