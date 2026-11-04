import { eventosApi } from '../api/eventos.api.js';
import { renderLoading, renderError, renderEmpty } from '../components/state-view.js';
import { renderEventoTable } from '../components/evento-table.js';
import { confirmDialog } from '../components/confirm-dialog.js';
import { toast } from '../components/toast.js';
import { replaceQuery } from '../router.js';
import { debounce, escapeHtml, formatNumber, STATUS_LABELS } from '../utils/format.js';

const PAGE_SIZE = 10;
const DEFAULTS = Object.freeze({ page: 1, status: '', q: '', sort: 'data_inicio', order: 'asc' });

const SORT_OPTIONS = [
  ['data_inicio', 'Data de início'],
  ['nome', 'Nome'],
  ['publico_maximo', 'Público máximo'],
  ['created_at', 'Data de cadastro'],
];

const option = (value, label, selected) =>
  `<option value="${escapeHtml(value)}" ${selected ? 'selected' : ''}>${escapeHtml(label)}</option>`;

/** Monta a query string apenas com valores diferentes do padrão (URL limpa e compartilhável). */
function toQuery(state) {
  const query = {};
  if (state.page !== DEFAULTS.page) query.page = state.page;
  if (state.status) query.status = state.status;
  if (state.q) query.q = state.q;
  if (state.sort !== DEFAULTS.sort) query.sort = state.sort;
  if (state.order !== DEFAULTS.order) query.order = state.order;
  return query;
}

function renderPagination({ page, totalPages }) {
  return `
    <button type="button" class="btn btn-secondary btn-sm" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>← Anterior</button>
    <span class="muted">Página ${page} de ${totalPages}</span>
    <button type="button" class="btn btn-secondary btn-sm" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>Próxima →</button>`;
}

/**
 * @param {object} _params
 * @param {Record<string, string>} query
 * @param {() => boolean} isCurrent
 */
export function renderListPage(_params, query, isCurrent) {
  const app = document.getElementById('app');
  const state = {
    page: Math.max(1, Number.parseInt(query.page, 10) || DEFAULTS.page),
    status: query.status ?? DEFAULTS.status,
    q: query.q ?? DEFAULTS.q,
    sort: query.sort ?? DEFAULTS.sort,
    order: query.order ?? DEFAULTS.order,
  };
  let requestSeq = 0;

  app.innerHTML = `
    <section class="page-header">
      <div>
        <h1>Eventos</h1>
        <p class="muted">Cadastre, consulte, edite e remova os eventos do planejamento.</p>
      </div>
      <a class="btn btn-primary" href="#/eventos/novo">+ Novo evento</a>
    </section>

    <form id="filters" class="card toolbar" role="search" aria-label="Filtrar eventos">
      <label>Buscar
        <input type="search" name="q" placeholder="Nome ou local" value="${escapeHtml(state.q)}" autocomplete="off" />
      </label>
      <label>Status
        <select name="status">
          ${option('', 'Todos', !state.status)}
          ${Object.entries(STATUS_LABELS).map(([value, label]) => option(value, label, state.status === value)).join('')}
        </select>
      </label>
      <label>Ordenar por
        <select name="sort">
          ${SORT_OPTIONS.map(([value, label]) => option(value, label, state.sort === value)).join('')}
        </select>
      </label>
      <label>Ordem
        <select name="order">
          ${option('asc', 'Crescente', state.order === 'asc')}
          ${option('desc', 'Decrescente', state.order === 'desc')}
        </select>
      </label>
    </form>

    <p id="list-summary" class="list-summary muted" aria-live="polite"></p>
    <div id="list-body"></div>
    <nav id="pagination" class="pagination" aria-label="Paginação"></nav>`;

  const body = document.getElementById('list-body');
  const summary = document.getElementById('list-summary');
  const pagination = document.getElementById('pagination');
  const filters = document.getElementById('filters');

  async function load() {
    if (!isCurrent() || !body.isConnected) return;
    const id = ++requestSeq;

    replaceQuery(toQuery(state));
    body.innerHTML = renderLoading('Carregando eventos...');
    summary.textContent = '';
    pagination.innerHTML = '';

    try {
      const { data, meta } = await eventosApi.list({
        page: state.page,
        limit: PAGE_SIZE,
        status: state.status,
        q: state.q,
        sort: state.sort,
        order: state.order,
      });
      if (id !== requestSeq || !body.isConnected) return;

      // Após excluir o último item de uma página, volta para a anterior.
      if (data.length === 0 && state.page > 1) {
        state.page -= 1;
        return load();
      }

      if (meta.total === 0) {
        body.innerHTML = renderEmpty(
          'Nenhum evento encontrado com os filtros atuais.',
          '<a class="btn btn-primary" href="#/eventos/novo">Criar primeiro evento</a>'
        );
        return;
      }

      summary.textContent = `${formatNumber(meta.total)} evento(s) encontrado(s)`;
      body.innerHTML = renderEventoTable(data);
      pagination.innerHTML = renderPagination(meta);
    } catch (err) {
      if (id !== requestSeq || !body.isConnected) return;
      body.innerHTML = renderError(err.message, 'retry-list');
      document.getElementById('retry-list').addEventListener('click', load);
    }
  }

  const applyFilters = () => {
    const data = new FormData(filters);
    state.q = String(data.get('q') ?? '').trim();
    state.status = String(data.get('status') ?? '');
    state.sort = String(data.get('sort') ?? DEFAULTS.sort);
    state.order = String(data.get('order') ?? DEFAULTS.order);
    state.page = 1;
    load();
  };

  // 'input' dispara para texto e para selects; o debounce evita uma requisição por tecla.
  filters.addEventListener('input', debounce(applyFilters, 300));

  pagination.addEventListener('click', (event) => {
    const button = event.target.closest('[data-page]');
    if (!button || button.disabled) return;
    state.page = Number(button.dataset.page);
    load();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  body.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action="delete"]');
    if (!button) return;

    const confirmed = await confirmDialog({
      title: 'Excluir evento',
      message: `Tem certeza que deseja excluir "${button.dataset.name}"? Esta ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!confirmed) return;

    button.disabled = true;
    try {
      await eventosApi.remove(button.dataset.id);
      toast.success('Evento excluído com sucesso.');
      load();
    } catch (err) {
      button.disabled = false;
      toast.error(err.message);
    }
  });

  load();
}
