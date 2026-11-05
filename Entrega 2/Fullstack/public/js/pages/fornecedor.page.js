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
        <div class="field"><label for="cotacao-valor">Valor total (R$) *</label>
          <input id="cotacao-valor" name="valor" type="number" min="0.01" step="0.01" required value="${escapeHtml(valores.valor ?? '')}" /></div>
        <div class="field"><label for="cotacao-validade">Validade da proposta *</label>
          <input id="cotacao-validade" name="validade" type="date" required min="${hoje()}" value="${escapeHtml(valores.validade ?? '')}" /></div>
      </div>
      <div class="field"><label for="cotacao-descricao">Descrição da proposta * (mín. 5 caracteres)</label>
        <textarea id="cotacao-descricao" name="descricao" required minlength="5" maxlength="1000" rows="3">${escapeHtml(valores.descricao ?? '')}</textarea></div>
      <div class="field"><label for="cotacao-observacoes">Observações</label>
        <input id="cotacao-observacoes" name="observacoes" maxlength="1000" value="${escapeHtml(valores.observacoes ?? '')}" /></div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary btn-sm" data-action="voltar">Voltar</button>
        <button type="submit" class="btn btn-primary btn-sm">${propostaId ? 'Salvar alterações' : 'Enviar proposta'}</button>
      </div>
    </form>`;
}

const ESPECIALIDADES_COTACAO = Object.freeze({
  alimentacao: { titulo: 'Alimentação e Buffet', empresa: 'Mesa & Sabor Eventos' },
  bebida: { titulo: 'Bebidas', empresa: 'Brisa Bebidas' },
  iluminacao: { titulo: 'Som e Iluminação', empresa: 'Lume Produções' },
  seguranca: { titulo: 'Segurança e Acesso', empresa: 'Guarda Eventos' },
  infraestrutura: { titulo: 'Infraestrutura', empresa: 'Base Estruturas' },
  outros: { titulo: 'Outros serviços', empresa: 'Conecta Eventos' },
});

function gruposCotacao(itens) {
  const categorias = [...new Set(itens.map((item) => item.categoria))];
  return categorias.map((categoria) => ({
    id: categoria,
    ...(ESPECIALIDADES_COTACAO[categoria] ?? {
      titulo: CATEGORIAS_ITEM[categoria] ?? categoria,
      empresa: 'Conecta Eventos',
    }),
    itens: itens.filter((item) => item.categoria === categoria),
  }));
}

function propostaDoItem(item, historico) {
  return (item.minha_proposta
    ? historico.find((p) => String(p.id) === String(item.minha_proposta.id)) ?? item.minha_proposta
    : historico.find((p) => String(p.item_custo_id) === String(item.id))) ?? null;
}

/** Detalhe da oportunidade com seleção de solicitação e um formulário central (RF10). */
export async function renderOportunidadeDetalhe({ id }, _query, isCurrent) {
  const app = document.getElementById('app');
  app.innerHTML = `<div id="det">${renderLoading('Carregando oportunidade...')}</div>`;
  const det = document.getElementById('det');
  let grupos = [];
  let historico = [];
  let grupoSelecionado = '';
  let itemSelecionado = null;
  let ocupada = false;
  const rascunhos = new Map();
  const editando = new Set();
  const atual = () => det.isConnected && isCurrent();
  const grupoAtual = () => grupos.find((g) => g.id === grupoSelecionado);
  const itemAtual = () => grupoAtual()?.itens.find((item) => String(item.id) === itemSelecionado);

  function guardarRascunho() {
    const form = det.querySelector('.form-proposta');
    if (form) rascunhos.set(form.dataset.itemId, Object.fromEntries(new FormData(form)));
  }

  function renderSolicitacao() {
    const painel = det.querySelector('[data-solicitacao]');
    if (!painel) return;
    const grupo = grupoAtual();
    if (!grupo) {
      painel.innerHTML = '<p class="muted">Selecione uma solicitação para consultar os itens pedidos pelo organizador.</p>';
      return;
    }
    const item = itemAtual();
    const proposta = item ? propostaDoItem(item, historico) : null;
    painel.innerHTML = `
      <header>
        <h3>${escapeHtml(grupo.titulo)}</h3>
        <p class="muted small">Empresa ilustrativa de referência · ${escapeHtml(grupo.empresa)}</p>
      </header>
      <div class="table-wrapper">
        <table class="table">
          <caption class="sr-only">Itens solicitados pelo organizador para ${escapeHtml(grupo.titulo)}</caption>
          <thead><tr><th>Item solicitado</th><th>Situação</th><th>Ação</th></tr></thead>
          <tbody>${grupo.itens.map((solicitado) => {
            const minha = propostaDoItem(solicitado, historico);
            const selecionado = String(solicitado.id) === itemSelecionado;
            return `<tr>
              <td data-label="Item solicitado"><strong>${escapeHtml(solicitado.nome)}</strong>
                ${solicitado.descricao ? `<p class="muted small">${escapeHtml(solicitado.descricao)}</p>` : ''}</td>
              <td data-label="Situação">${minha ? badge(minha.status) : '<span class="muted small">Aguardando sua proposta</span>'}</td>
              <td data-label="Ação"><button type="button" class="btn ${selecionado ? 'btn-primary' : 'btn-secondary'} btn-sm"
                data-action="selecionar-item" data-item-id="${escapeHtml(solicitado.id)}" aria-pressed="${selecionado}">
                ${selecionado ? 'Selecionado' : minha ? 'Ver proposta' : 'Cotar item'}</button></td>
            </tr>`;
          }).join('')}</tbody>
        </table>
      </div>
      ${!item ? '<p class="muted small">Escolha um item para abrir os detalhes e preparar sua proposta.</p>' : `
        <section class="stack item-cotacao" data-item="${escapeHtml(item.id)}" aria-labelledby="titulo-cotacao">
          <div><h3 id="titulo-cotacao">Sua proposta para ${escapeHtml(item.nome)}</h3>
            ${item.descricao ? `<p class="muted small">${escapeHtml(item.descricao)}</p>` : ''}</div>
          ${!proposta || (proposta.status === 'enviada' && editando.has(itemSelecionado))
            ? formProposta({ itemId: item.id, propostaId: proposta?.id, valores: rascunhos.get(itemSelecionado) ?? proposta ?? {} })
            : `<div class="proposta-resumo stack">
                <div>${badge(proposta.status)} <strong>${formatBRL(proposta.valor)}</strong>
                  <span class="muted small">· válida até ${formatDate(proposta.validade)}</span></div>
                ${proposta.descricao ? `<p class="pre-line">${escapeHtml(proposta.descricao)}</p>` : ''}
                ${proposta.observacoes ? `<p class="muted small">${escapeHtml(proposta.observacoes)}</p>` : ''}
                ${proposta.status === 'enviada' ? `<div class="header-actions">
                  <button type="button" class="btn btn-secondary btn-sm" data-action="editar">Editar</button>
                  <button type="button" class="btn btn-ghost btn-sm" data-action="cancelar">Cancelar proposta</button>
                </div>` : `<p class="muted small">${proposta.status === 'selecionada'
                  ? 'Proposta selecionada pelo organizador.'
                  : 'Proposta cancelada. O registro permanece disponível em Minhas propostas.'}</p>`}
              </div>`}
        </section>`}`;
  }

  async function load() {
    if (!atual()) return;
    det.innerHTML = renderLoading('Carregando oportunidade...');
    try {
      const [oportunidade, { data: propostas }] = await Promise.all([
        fornecedorApi.oportunidade(id),
        fornecedorApi.propostas(),
      ]);
      if (!det.isConnected || !isCurrent()) return;
      const { evento, itens } = oportunidade;
      historico = propostas.filter((p) => String(p.evento_id) === String(evento.id));
      const habilitada = String(evento.nome).trim().toLocaleLowerCase('pt-BR') === 'sunset festival';
      grupos = habilitada ? gruposCotacao(itens) : [];
      if (!grupoAtual()) grupoSelecionado = '';
      if (!itemAtual()) itemSelecionado = null;
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
        ${grupos.length ? `
          <section class="card stack" data-cotacao>
            <div class="field">
              <label for="solicitacao-cotacao">Solicitação do organizador</label>
              <select id="solicitacao-cotacao" aria-describedby="orientacao-cotacao">
                <option value="">Selecione uma solicitação</option>
                ${grupos.map((g) => `<option value="${escapeHtml(g.id)}" ${g.id === grupoSelecionado ? 'selected' : ''}>
                  ${escapeHtml(g.titulo)} · ${escapeHtml(g.empresa)} · ${g.itens.length} item(ns)</option>`).join('')}
              </select>
              <p id="orientacao-cotacao" class="muted small">Consulte os itens por especialidade. Sua proposta será enviada pela sua conta de fornecedor.</p>
            </div>
            <div class="stack" data-solicitacao aria-live="polite"></div>
          </section>` : renderEmpty(habilitada
            ? 'Nenhum item cadastrado neste evento.'
            : 'Este evento não possui solicitações de cotação disponíveis. As cotações estão habilitadas apenas para o Sunset Festival.')}`;
      renderSolicitacao();
    } catch (err) {
      if (!atual()) return;
      det.innerHTML = renderError(mensagemDeErro(err), 'retry-op-det');
      document.getElementById('retry-op-det').addEventListener('click', load);
    }
  }

  async function salvarAlteracao(operacao, mensagem, itemId) {
    if (ocupada || !atual()) return;
    ocupada = true;
    const controles = [...det.querySelectorAll('[data-cotacao] input, [data-cotacao] select, [data-cotacao] textarea, [data-cotacao] button')]
      .map((controle) => [controle, controle.disabled]);
    controles.forEach(([controle]) => { controle.disabled = true; });
    try {
      await operacao();
      rascunhos.delete(itemId);
      editando.delete(itemId);
      if (atual()) {
        toast.success(mensagem);
        await load();
      }
    } catch (err) {
      if (atual()) toast.error(mensagemDeErro(err));
    } finally {
      ocupada = false;
      controles.forEach(([controle, desabilitado]) => {
        if (controle.isConnected) controle.disabled = desabilitado;
      });
    }
  }

  det.addEventListener('change', (event) => {
    if (event.target.id !== 'solicitacao-cotacao' || ocupada) return;
    guardarRascunho();
    grupoSelecionado = event.target.value;
    const itens = grupoAtual()?.itens ?? [];
    itemSelecionado = itens.length === 1 ? String(itens[0].id) : null;
    renderSolicitacao();
  });

  det.addEventListener('submit', async (event) => {
    const form = event.target.closest('.form-proposta');
    if (!form) return;
    event.preventDefault();
    const item = itemAtual();
    if (ocupada || !item || String(item.id) !== form.dataset.itemId) return;
    if (!form.reportValidity()) return;
    guardarRascunho();
    const d = Object.fromEntries(new FormData(form));
    const body = {
      valor: Number(d.valor),
      validade: d.validade,
      descricao: String(d.descricao).trim(),
      observacoes: String(d.observacoes ?? '').trim() || null,
    };
    const propostaId = form.dataset.propostaId;
    await salvarAlteracao(
      () => propostaId ? fornecedorApi.atualizarProposta(propostaId, body) : fornecedorApi.enviarProposta(item.id, body),
      propostaId ? 'Proposta atualizada.' : 'Proposta enviada ao organizador.',
      String(item.id),
    );
  });

  det.addEventListener('click', async (event) => {
    const btn = event.target.closest('[data-action]');
    if (!btn || ocupada) return;
    if (btn.dataset.action === 'selecionar-item') {
      guardarRascunho();
      itemSelecionado = btn.dataset.itemId;
      renderSolicitacao();
      return;
    }
    const item = itemAtual();
    if (!item) return;
    const proposta = propostaDoItem(item, historico);

    if (btn.dataset.action === 'voltar') {
      guardarRascunho();
      editando.delete(itemSelecionado);
      if (!proposta) itemSelecionado = null;
      renderSolicitacao();
      return;
    }
    if (btn.dataset.action === 'editar') {
      if (proposta?.status !== 'enviada') return;
      editando.add(itemSelecionado);
      renderSolicitacao();
      return undefined;
    }
    if (btn.dataset.action === 'cancelar') {
      if (proposta?.status !== 'enviada') return;
      const ok = await confirmDialog({
        title: 'Cancelar proposta',
        message: 'Sua proposta será cancelada e ficará registrada no histórico. Deseja continuar?',
        confirmLabel: 'Cancelar proposta',
        danger: true,
      });
      if (!ok) return undefined;
      await salvarAlteracao(() => fornecedorApi.cancelarProposta(proposta.id), 'Proposta cancelada.', String(item.id));
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
