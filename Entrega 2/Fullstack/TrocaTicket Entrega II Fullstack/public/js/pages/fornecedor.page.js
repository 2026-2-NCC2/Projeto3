import { fornecedorApi } from '../api/fornecedor.api.js';
import { renderLoading, renderError, renderEmpty } from '../components/state-view.js';
import { confirmDialog } from '../components/confirm-dialog.js';
import { renderPaginacao } from '../components/paginacao.js';
import { toast } from '../components/toast.js';
import { mensagemDeErro } from '../api/http.js';
import { replaceQuery } from '../router.js';
import { debounce, escapeHtml, formatBRL, formatDate, formatDateTime, formatNumber, CATEGORIAS_ITEM, STATUS_PROPOSTA } from '../utils/format.js';

const hoje = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const badge = (status) => {
  const css = { enviada: 'badge-rascunho', selecionada: 'badge-publicado', cancelada: 'badge-cancelado' }[status] ?? '';
  return `<span class="badge ${css}">${STATUS_PROPOSTA[status] ?? status}</span>`;
};

/* ------------------------------ Oportunidades ----------------------------- */

/** Lista de eventos publicados e abertos para cotação (RF09). */
export async function renderOportunidades(_params, query, isCurrent) {
  const app = document.getElementById('app');
  const state = { page: Math.max(1, Number.parseInt(query.page, 10) || 1), q: query.q ?? '' };
  app.innerHTML = `
    <section class="page-header">
      <div>
        <h1>Oportunidades de cotação</h1>
        <p class="muted">Eventos publicados pelos organizadores. Envie propostas para os itens de custo.</p>
      </div>
    </section>
    <form id="busca" class="card toolbar" role="search">
      <label class="grow">Buscar<input type="search" name="q" value="${escapeHtml(state.q)}" placeholder="Nome ou local" autocomplete="off" /></label>
    </form>
    <div id="corpo"></div>`;
  const corpo = document.getElementById('corpo');

  async function load() {
    if (!isCurrent() || !corpo.isConnected) return;
    replaceQuery({ ...(state.page > 1 ? { page: state.page } : {}), ...(state.q ? { q: state.q } : {}) });
    corpo.innerHTML = renderLoading('Buscando oportunidades...');
    try {
      const { data, meta } = await fornecedorApi.oportunidades({ page: state.page, limit: 9, q: state.q });
      if (!corpo.isConnected) return;
      if (meta.total === 0) {
        corpo.innerHTML = renderEmpty('Nenhuma oportunidade aberta no momento.');
        return;
      }
      corpo.innerHTML = `
        <div class="cards">
          ${data.map((e) => `
            <article class="card oportunidade">
              <h2><a href="#/fornecedor/oportunidades/${e.id}">${escapeHtml(e.nome)}</a></h2>
              <p class="muted small">${formatDateTime(e.data_inicio)} · ${escapeHtml(e.local_evento)}</p>
              <p class="small">Público: ${formatNumber(e.publico_minimo)} – ${formatNumber(e.publico_maximo)}</p>
              <p class="small"><strong>${e.itens}</strong> item(ns) de custo · <strong>${e.minhas_propostas}</strong> sua(s) proposta(s)</p>
              <a class="btn btn-primary btn-sm" href="#/fornecedor/oportunidades/${e.id}">Ver e cotar</a>
            </article>`).join('')}
        </div>
        ${renderPaginacao(meta)}`;
    } catch (err) {
      if (!corpo.isConnected) return;
      corpo.innerHTML = renderError(mensagemDeErro(err), 'retry-op');
      document.getElementById('retry-op').addEventListener('click', load);
    }
  }

  document.getElementById('busca').addEventListener('input', debounce((event) => {
    state.q = String(new FormData(event.currentTarget).get('q') ?? '').trim();
    state.page = 1;
    load();
  }, 300));
  corpo.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-page]');
    if (!btn || btn.disabled) return;
    state.page = Number(btn.dataset.page);
    load();
  });
  load();
}

/* -------------------------------- Propostas ------------------------------- */

function formProposta({ itemId, propostaId, valores = {} }) {
  return `
    <form class="form-proposta stack" data-item-id="${itemId}" data-proposta-id="${propostaId ?? ''}" novalidate>
      <div class="grid-2">
        <div class="field"><label>Valor total (R$) *</label>
          <input name="valor" type="number" min="0.01" step="0.01" required value="${valores.valor ?? ''}" /></div>
        <div class="field"><label>Validade da proposta *</label>
          <input name="validade" type="date" required min="${hoje()}" value="${valores.validade ?? ''}" /></div>
      </div>
      <div class="field"><label>Descrição da proposta * (mín. 5 caracteres)</label>
        <textarea name="descricao" required minlength="5" maxlength="1000" rows="3">${escapeHtml(valores.descricao ?? '')}</textarea></div>
      <div class="field"><label>Observações</label>
        <input name="observacoes" maxlength="1000" value="${escapeHtml(valores.observacoes ?? '')}" /></div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary btn-sm" data-action="voltar">Voltar</button>
        <button type="submit" class="btn btn-primary btn-sm">${propostaId ? 'Salvar alterações' : 'Enviar proposta'}</button>
      </div>
    </form>`;
}

function cardItem(item, propostasHistorico) {
  const minha = item.minha_proposta;
  const historico = minha ? propostasHistorico.find((p) => p.id === minha.id) : null;
  let conteudo;
  if (!minha) {
    conteudo = formProposta({ itemId: item.id });
  } else {
    conteudo = `
      <div class="proposta-resumo">
        <div>${badge(minha.status)} <strong>${formatBRL(minha.valor)}</strong>
          <span class="muted small">· válida até ${formatDate(minha.validade)}</span></div>
        ${minha.status === 'enviada' ? `
          <div class="header-actions">
            <button class="btn btn-secondary btn-sm" data-action="editar" data-id="${minha.id}">Editar</button>
            <button class="btn btn-ghost btn-sm" data-action="cancelar" data-id="${minha.id}">Cancelar proposta</button>
          </div>` : ''}
        ${minha.status === 'selecionada' ? '<p class="muted small">Proposta selecionada pelo organizador.</p>' : ''}
      </div>`;
  }
  return `
    <section class="card item-cotacao" data-item="${item.id}">
      <header class="cabecalho-item">
        <h2>${escapeHtml(item.nome)}</h2>
        <span class="muted">${CATEGORIAS_ITEM[item.categoria] ?? item.categoria}</span>
      </header>
      ${item.descricao ? `<p class="muted small">${escapeHtml(item.descricao)}</p>` : ''}
      <div class="conteudo-item">${conteudo}</div>
      <script type="application/json" class="historico">${JSON.stringify(historico ?? null).replace(/</g, '\\u003c')}</script>
    </section>`;
}

/** Detalhe do evento com os itens de custo e o formulário de proposta por item (RF10). */
export async function renderOportunidadeDetalhe({ id }, _query, isCurrent) {
  const app = document.getElementById('app');
  app.innerHTML = `<div id="det">${renderLoading('Carregando oportunidade...')}</div>`;
  const det = document.getElementById('det');

  async function load() {
    det.innerHTML = renderLoading('Carregando oportunidade...');
    try {
      const [oportunidade, { data: historico }] = await Promise.all([
        fornecedorApi.oportunidade(id),
        fornecedorApi.propostas(),
      ]);
      if (!det.isConnected || !isCurrent()) return;
      const { evento, itens } = oportunidade;
      det.innerHTML = `
        <section class="page-header">
          <div>
            <p class="breadcrumb"><a href="#/fornecedor/oportunidades">Oportunidades</a> / Evento #${evento.id}</p>
            <h1>${escapeHtml(evento.nome)}</h1>
            <p class="muted">${formatDateTime(evento.data_inicio)} a ${formatDateTime(evento.data_fim)} · ${escapeHtml(evento.local_evento)}</p>
          </div>
        </section>
        <article class="card detail-grid">
          <div class="detail-item"><span>Público mínimo</span><strong>${formatNumber(evento.publico_minimo)}</strong></div>
          <div class="detail-item"><span>Público máximo</span><strong>${formatNumber(evento.publico_maximo)}</strong></div>
          <div class="detail-item detail-wide"><span>Descrição</span><p class="pre-line">${evento.descricao ? escapeHtml(evento.descricao) : '<em class="muted">Sem descrição.</em>'}</p></div>
        </article>
        <h2 class="section-title">Itens de custo para cotação</h2>
        ${itens.length ? itens.map((item) => cardItem(item, historico)).join('') : renderEmpty('Nenhum item cadastrado neste evento.')}`;
    } catch (err) {
      if (!det.isConnected) return;
      det.innerHTML = renderError(mensagemDeErro(err), 'retry-op-det');
      document.getElementById('retry-op-det').addEventListener('click', load);
    }
  }

  det.addEventListener('submit', async (event) => {
    const form = event.target.closest('.form-proposta');
    if (!form) return;
    event.preventDefault();
    const d = Object.fromEntries(new FormData(form));
    const body = {
      valor: Number(d.valor),
      validade: d.validade,
      descricao: String(d.descricao).trim(),
      observacoes: String(d.observacoes ?? '').trim() || null,
    };
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      if (form.dataset.propostaId) {
        await fornecedorApi.atualizarProposta(form.dataset.propostaId, body);
        toast.success('Proposta atualizada.');
      } else {
        await fornecedorApi.enviarProposta(form.dataset.itemId, body);
        toast.success('Proposta enviada ao organizador.');
      }
      load();
    } catch (err) {
      toast.error(mensagemDeErro(err));
      btn.disabled = false;
    }
  });

  det.addEventListener('click', async (event) => {
    const btn = event.target.closest('[data-action]');
    if (!btn) return;
    const card = btn.closest('.item-cotacao');
    const historico = JSON.parse(card.querySelector('.historico').textContent || 'null');

    if (btn.dataset.action === 'voltar') return load();
    if (btn.dataset.action === 'editar') {
      card.querySelector('.conteudo-item').innerHTML = formProposta({
        itemId: card.dataset.item,
        propostaId: btn.dataset.id,
        valores: { ...historico, valor: historico.valor },
      });
      return undefined;
    }
    if (btn.dataset.action === 'cancelar') {
      const ok = await confirmDialog({
        title: 'Cancelar proposta',
        message: 'Sua proposta será cancelada e ficará registrada no histórico. Deseja continuar?',
        confirmLabel: 'Cancelar proposta',
        danger: true,
      });
      if (!ok) return undefined;
      try {
        await fornecedorApi.cancelarProposta(btn.dataset.id);
        toast.success('Proposta cancelada.');
        load();
      } catch (err) {
        toast.error(mensagemDeErro(err));
      }
    }
    return undefined;
  });

  load();
}

/** Histórico do fornecedor (RNF rastreabilidade): todas as propostas e seus status. */
export async function renderMinhasPropostas() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <section class="page-header"><div><h1>Minhas propostas</h1>
      <p class="muted">Histórico de propostas enviadas. Propostas enviadas podem ser editadas ou canceladas.</p></div></section>
    <div id="lista">${renderLoading('Carregando histórico...')}</div>`;
  const lista = document.getElementById('lista');

  async function load() {
    try {
      const { data } = await fornecedorApi.propostas();
      if (!lista.isConnected) return;
      if (!data.length) {
        lista.innerHTML = renderEmpty('Você ainda não enviou propostas.', '<a class="btn btn-primary" href="#/fornecedor/oportunidades">Ver oportunidades</a>');
        return;
      }
      lista.innerHTML = `
        <div class="table-wrapper card"><table class="table">
          <thead><tr><th>Evento</th><th>Item</th><th>Valor</th><th>Validade</th><th>Status</th><th>Enviada em</th><th></th></tr></thead>
          <tbody>${data.map((p) => `
            <tr>
              <td data-label="Evento"><a class="link" href="#/fornecedor/oportunidades/${p.evento_id}">${escapeHtml(p.evento_nome)}</a></td>
              <td data-label="Item">${escapeHtml(p.item_nome)}</td>
              <td data-label="Valor">${formatBRL(p.valor)}</td>
              <td data-label="Validade">${formatDate(p.validade)}</td>
              <td data-label="Status">${badge(p.status)}</td>
              <td data-label="Enviada em">${formatDateTime(p.created_at)}</td>
              <td class="actions" data-label="Ações">${p.status === 'enviada'
                ? `<button class="btn btn-ghost btn-sm" data-action="cancelar" data-id="${p.id}">Cancelar</button>` : ''}</td>
            </tr>`).join('')}</tbody>
        </table></div>`;
    } catch (err) {
      if (!lista.isConnected) return;
      lista.innerHTML = renderError(mensagemDeErro(err), 'retry-prop');
      document.getElementById('retry-prop').addEventListener('click', load);
    }
  }

  lista.addEventListener('click', async (event) => {
    const btn = event.target.closest('[data-action="cancelar"]');
    if (!btn) return;
    const ok = await confirmDialog({ title: 'Cancelar proposta', message: 'Confirmar o cancelamento desta proposta?', confirmLabel: 'Cancelar proposta', danger: true });
    if (!ok) return;
    try {
      await fornecedorApi.cancelarProposta(btn.dataset.id);
      toast.success('Proposta cancelada.');
      load();
    } catch (err) {
      toast.error(mensagemDeErro(err));
    }
  });

  load();
}
