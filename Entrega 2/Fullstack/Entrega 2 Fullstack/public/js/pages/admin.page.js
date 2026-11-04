import { adminApi } from '../api/admin.api.js';
import { renderLoading, renderError, renderEmpty } from '../components/state-view.js';
import { renderPaginacao } from '../components/paginacao.js';
import { toast } from '../components/toast.js';
import { mensagemDeErro } from '../api/http.js';
import { escapeHtml, formatDateTime, formatBRL, STATUS_LABELS, STATUS_PROPOSTA } from '../utils/format.js';
import { replaceQuery } from '../router.js';

const PERFIS = { organizador: 'Organizador', fornecedor: 'Fornecedor', comprador: 'Comprador', administrador: 'Administrador' };
const STATUS_CADASTRO = { pendente: 'Pendente', aprovado: 'Aprovado', rejeitado: 'Rejeitado' };

function abas(ativa, base, opcoes) {
  return `<nav class="tabs" aria-label="Filtro">${opcoes.map(([v, l]) =>
    `<a role="tab" class="tab ${v === ativa ? 'ativa' : ''}" href="${base}${v ? `?status=${v}` : ''}">${l}</a>`).join('')}</nav>`;
}

/** Aprovação de cadastros (RF03): pendentes primeiro, com histórico de decisões. */
export async function renderAdminUsuarios(_params, query, isCurrent) {
  const app = document.getElementById('app');
  const status = ['pendente', 'aprovado', 'rejeitado'].includes(query.status) ? query.status : 'pendente';
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  app.innerHTML = `
    <section class="page-header"><div><h1>Aprovação de cadastros</h1>
      <p class="muted">Aprove organizadores e fornecedores e gerencie o acesso dos usuários.</p></div></section>
    ${abas(status, '#/admin/usuarios', [['pendente', 'Pendentes'], ['aprovado', 'Aprovados'], ['rejeitado', 'Rejeitados']])}
    <div id="corpo">${renderLoading()}</div>`;
  const corpo = document.getElementById('corpo');

  async function load(pagina = page) {
    if (!corpo.isConnected || !isCurrent()) return;
    try {
      const { data, meta } = await adminApi.usuarios({ status, page: pagina, limit: 20 });
      if (!corpo.isConnected) return;
      if (!data.length) {
        corpo.innerHTML = renderEmpty(`Nenhum cadastro ${STATUS_CADASTRO[status].toLowerCase()}.`);
        return;
      }
      corpo.innerHTML = `
        <div class="table-wrapper card"><table class="table">
          <thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Empresa / CNPJ</th><th>Cadastro</th><th>Status</th><th></th></tr></thead>
          <tbody>${data.map((u) => `
            <tr>
              <td data-label="Nome">${escapeHtml(u.nome)}</td>
              <td data-label="E-mail">${escapeHtml(u.email)}</td>
              <td data-label="Perfil">${PERFIS[u.perfil] ?? u.perfil}${u.area_atuacao ? `<br><span class="muted small">${escapeHtml(u.area_atuacao)}</span>` : ''}</td>
              <td data-label="Empresa">${escapeHtml(u.razao_social ?? '—')}${u.documento ? `<br><span class="muted small">${escapeHtml(u.documento)}</span>` : ''}</td>
              <td data-label="Cadastro">${formatDateTime(u.created_at)}</td>
              <td data-label="Status">${STATUS_CADASTRO[u.status]}</td>
              <td class="actions" data-label="Ações">
                ${u.status !== 'aprovado' ? `<button class="btn btn-primary btn-sm" data-action="aprovado" data-id="${u.id}">Aprovar</button>` : ''}
                ${u.status !== 'rejeitado' ? `<button class="btn btn-danger btn-sm" data-action="rejeitado" data-id="${u.id}">Rejeitar</button>` : ''}
              </td>
            </tr>`).join('')}</tbody>
        </table></div>
        ${renderPaginacao(meta)}`;
    } catch (err) {
      if (!corpo.isConnected) return;
      corpo.innerHTML = renderError(mensagemDeErro(err), 'retry-adm');
      document.getElementById('retry-adm').addEventListener('click', () => load());
    }
  }

  corpo.addEventListener('click', async (event) => {
    const pag = event.target.closest('[data-page]');
    if (pag && !pag.disabled) {
      replaceQuery({ status, page: Number(pag.dataset.page) });
      return load(Number(pag.dataset.page));
    }
    const btn = event.target.closest('[data-action]');
    if (!btn) return undefined;
    try {
      await adminApi.decidirUsuario(btn.dataset.id, btn.dataset.action);
      toast.success(btn.dataset.action === 'aprovado' ? 'Cadastro aprovado.' : 'Cadastro rejeitado.');
      return load();
    } catch (err) {
      toast.error(mensagemDeErro(err));
      return undefined;
    }
  });

  load();
}

/** Visão de eventos (RF14): status, organizador e andamento das cotações. */
export async function renderAdminEventos(_params, query, isCurrent) {
  const app = document.getElementById('app');
  const status = ['rascunho', 'publicado', 'cancelado'].includes(query.status) ? query.status : '';
  app.innerHTML = `
    <section class="page-header"><div><h1>Eventos da plataforma</h1>
      <p class="muted">Visão gerencial de todos os eventos cadastrados.</p></div></section>
    ${abas(status, '#/admin/eventos', [['', 'Todos'], ['rascunho', 'Rascunhos'], ['publicado', 'Publicados'], ['cancelado', 'Cancelados']])}
    <div id="corpo">${renderLoading()}</div>`;
  const corpo = document.getElementById('corpo');
  try {
    const { data, meta } = await adminApi.eventos({ status: status || undefined, limit: 50 });
    if (!corpo.isConnected || !isCurrent()) return;
    if (!data.length) {
      corpo.innerHTML = renderEmpty('Nenhum evento encontrado.');
      return;
    }
    corpo.innerHTML = `
      <div class="table-wrapper card"><table class="table">
        <thead><tr><th>Evento</th><th>Organizador</th><th>Início</th><th>Status</th><th>Itens cotados</th><th>Propostas</th></tr></thead>
        <tbody>${data.map((e) => `
          <tr>
            <td data-label="Evento"><a class="link" href="#/eventos/${e.id}">${escapeHtml(e.nome)}</a></td>
            <td data-label="Organizador">${escapeHtml(e.organizador_nome)}</td>
            <td data-label="Início">${formatDateTime(e.data_inicio)}</td>
            <td data-label="Status"><span class="badge badge-${e.status}">${STATUS_LABELS[e.status]}</span></td>
            <td data-label="Itens cotados">${e.itens_cotados} de ${e.itens}</td>
            <td data-label="Propostas">${e.propostas}</td>
          </tr>`).join('')}</tbody>
      </table></div>
      <p class="muted small">${meta.total} evento(s) no total.</p>`;
  } catch (err) {
    if (!corpo.isConnected) return;
    corpo.innerHTML = renderError(mensagemDeErro(err), 'retry-adm-ev');
    document.getElementById('retry-adm-ev').addEventListener('click', () => renderAdminEventos(_params, query, isCurrent));
  }
}

/** Indicadores gerenciais (RF14). */
export async function renderAdminResumo() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <section class="page-header"><div><h1>Indicadores</h1>
      <p class="muted">Resumo da plataforma TrocaTicket.</p></div></section>
    <div id="corpo">${renderLoading()}</div>`;
  const corpo = document.getElementById('corpo');
  try {
    const r = await adminApi.resumo();
    if (!corpo.isConnected) return;
    const bloco = (titulo, itens) => `
      <section class="card">
        <h2>${titulo}</h2>
        <ul class="lista">${itens.map(([rotulo, valor]) => `<li><span>${rotulo}</span><strong>${valor}</strong></li>`).join('')}</ul>
      </section>`;
    const usuarios = Object.entries(r.usuarios).map(([perfil, s]) =>
      [`${PERFIS[perfil] ?? perfil} · pendentes`, s.pendente]);
    const usuariosAprov = Object.entries(r.usuarios).map(([perfil, s]) =>
      [`${PERFIS[perfil] ?? perfil} · aprovados`, s.aprovado]);
    corpo.innerHTML = `
      <div class="grid-2">
        ${bloco('Cadastros', [...usuarios, ...usuariosAprov])}
        ${bloco('Eventos', Object.entries(r.eventos).map(([s, n]) => [STATUS_LABELS[s] ?? s, n]))}
        ${bloco('Propostas', Object.entries(r.propostas).map(([s, n]) => [STATUS_PROPOSTA[s] ?? s, n]))}
        <section class="card">
          <h2>Valor em propostas selecionadas</h2>
          <p class="kpi">${formatBRL(r.valor_total_propostas_selecionadas)}</p>
          <p class="muted small">Soma das propostas selecionadas pelos organizadores, em todos os eventos.</p>
        </section>
      </div>`;
  } catch (err) {
    if (!corpo.isConnected) return;
    corpo.innerHTML = renderError(mensagemDeErro(err), 'retry-res');
    document.getElementById('retry-res').addEventListener('click', renderAdminResumo);
  }
}
