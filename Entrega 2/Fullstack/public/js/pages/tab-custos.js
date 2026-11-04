import { eventosApi } from '../api/eventos.api.js';
import { renderLoading, renderError, renderEmpty } from '../components/state-view.js';
import { confirmDialog } from '../components/confirm-dialog.js';
import { toast } from '../components/toast.js';
import { mensagemDeErro } from '../api/http.js';
import { escapeHtml, formatBRL, CATEGORIAS_ITEM, TIPOS_CUSTO } from '../utils/format.js';

const opcoes = (mapa) => Object.entries(mapa).map(([v, l]) => `<option value="${v}">${l}</option>`).join('');

function formItem(eventoId) {
  return `
    <form class="form-inline" id="form-item" data-evento="${eventoId}">
      <input name="nome" placeholder="Nome do item (ex.: Iluminação de palco)" required minlength="3" maxlength="120" aria-label="Nome do item" />
      <select name="categoria" aria-label="Categoria">${opcoes(CATEGORIAS_ITEM)}</select>
      <input name="descricao" placeholder="Descrição (opcional)" maxlength="500" aria-label="Descrição" />
      <button class="btn btn-primary btn-sm" type="submit">Adicionar item</button>
    </form>`;
}

function formCusto(eventoId) {
  return `
    <form class="form-inline" id="form-custo" data-evento="${eventoId}">
      <input name="descricao" placeholder="Descrição (ex.: Alvará municipal)" required minlength="3" maxlength="160" aria-label="Descrição do custo" />
      <select name="tipo" aria-label="Tipo">${opcoes(TIPOS_CUSTO)}</select>
      <input name="valor" type="number" min="0" step="0.01" placeholder="Valor (R$)" required aria-label="Valor" />
      <button class="btn btn-primary btn-sm" type="submit">Adicionar custo</button>
    </form>`;
}

/**
 * Aba "Itens e custos": composição de custo (RF06) e custos fiscais, operacionais e variáveis (RF07).
 * Somente o organizador dono edita; o administrador apenas consulta.
 */
export async function renderTabCustos(slot, evento, { editavel, recarregar }) {
  slot.innerHTML = renderLoading('Carregando itens e custos...');
  let itens;
  let custos;
  try {
    const [itensResp, custosResp] = await Promise.all([
      eventosApi.listarItens(evento.id),
      eventosApi.listarCustos(evento.id),
    ]);
    itens = itensResp.data;
    custos = custosResp.data;
  } catch (err) {
    slot.innerHTML = renderError(mensagemDeErro(err), 'retry-custos');
    document.getElementById('retry-custos').addEventListener('click', recarregar);
    return;
  }

  const totalCustos = custos.reduce((soma, c) => soma + c.valor, 0);

  slot.innerHTML = `
    <div class="grid-2">
      <section class="card">
        <h2>Itens de composição de custo</h2>
        <p class="muted small">Cada item recebe propostas dos fornecedores (iluminação, alimentação, bebidas, segurança...).</p>
        ${editavel ? formItem(evento.id) : ''}
        ${itens.length
          ? `<ul class="lista">${itens.map((i) => `
              <li>
                <div>
                  <strong>${escapeHtml(i.nome)}</strong>
                  <span class="muted"> · ${CATEGORIAS_ITEM[i.categoria] ?? i.categoria}</span>
                  ${i.descricao ? `<p class="muted small">${escapeHtml(i.descricao)}</p>` : ''}
                </div>
                ${editavel ? `<button class="btn btn-ghost btn-sm" data-action="remover-item" data-id="${i.id}" data-nome="${escapeHtml(i.nome)}">Remover</button>` : ''}
              </li>`).join('')}</ul>`
          : renderEmpty('Nenhum item cadastrado ainda.')}
      </section>

      <section class="card">
        <h2>Custos do evento</h2>
        <p class="muted small">Custos fiscais, operacionais e variáveis que não vêm de fornecedores.</p>
        ${editavel ? formCusto(evento.id) : ''}
        ${custos.length
          ? `<ul class="lista">${custos.map((c) => `
              <li>
                <div>
                  <strong>${escapeHtml(c.descricao)}</strong>
                  <span class="muted"> · ${TIPOS_CUSTO[c.tipo] ?? c.tipo}</span>
                  <p class="small">${formatBRL(c.valor)}</p>
                </div>
                ${editavel ? `<button class="btn btn-ghost btn-sm" data-action="remover-custo" data-id="${c.id}" data-nome="${escapeHtml(c.descricao)}">Remover</button>` : ''}
              </li>`).join('')}</ul>
             <p class="total-linha"><span>Total de custos do evento</span><strong>${formatBRL(totalCustos)}</strong></p>`
          : renderEmpty('Nenhum custo registrado ainda.')}
      </section>
    </div>`;

  const formI = slot.querySelector('#form-item');
  formI?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const dados = Object.fromEntries(new FormData(formI));
    try {
      await eventosApi.criarItem(evento.id, {
        nome: dados.nome.trim(),
        categoria: dados.categoria,
        descricao: dados.descricao.trim() || undefined,
      });
      toast.success('Item adicionado.');
      recarregar();
    } catch (err) {
      toast.error(mensagemDeErro(err));
    }
  });

  const formC = slot.querySelector('#form-custo');
  formC?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const dados = Object.fromEntries(new FormData(formC));
    try {
      await eventosApi.criarCusto(evento.id, {
        descricao: dados.descricao.trim(),
        tipo: dados.tipo,
        valor: Number(dados.valor),
      });
      toast.success('Custo registrado.');
      recarregar();
    } catch (err) {
      toast.error(mensagemDeErro(err));
    }
  });

  slot.addEventListener('click', async (event) => {
    const btn = event.target.closest('[data-action]');
    if (!btn) return;
    const ok = await confirmDialog({
      title: btn.dataset.action === 'remover-item' ? 'Remover item' : 'Remover custo',
      message: `Remover "${btn.dataset.nome}"?`,
      confirmLabel: 'Remover',
      danger: true,
    });
    if (!ok) return;
    try {
      if (btn.dataset.action === 'remover-item') await eventosApi.removerItem(btn.dataset.id);
      else await eventosApi.removerCusto(btn.dataset.id);
      toast.success('Removido com sucesso.');
      recarregar();
    } catch (err) {
      toast.error(mensagemDeErro(err));
    }
  });
}
