import { eventosApi } from '../api/eventos.api.js';
import { session } from '../session.js';
import { navigate } from '../router.js';
import { renderLoading, renderError } from '../components/state-view.js';
import { confirmDialog } from '../components/confirm-dialog.js';
import { toast } from '../components/toast.js';
import { mensagemDeErro } from '../api/http.js';
import { renderTabCustos } from './tab-custos.js';
import { renderTabCotacoes } from './tab-cotacoes.js';
import { renderTabOrcamento } from './tab-orcamento.js';
import { escapeHtml, formatDateTime, formatNumber, STATUS_LABELS } from '../utils/format.js';

const ABAS = [
  ['visao', 'Visão geral'],
  ['custos', 'Itens e custos'],
  ['cotacoes', 'Cotações'],
  ['orcamento', 'Orçamento e ticket'],
];

function renderCabecalho(evento, { podeGerenciar }) {
  const acoes = [`<a class="btn btn-primary" href="#/gestao/eventos/${evento.id}">Vendas, lotes e check-in ↗</a>`];
  if (podeGerenciar) {
    if (evento.status === 'rascunho') acoes.push('<button class="btn btn-primary" data-action="publicar">Publicar para cotação</button>');
    if (evento.status !== 'cancelado') acoes.push('<a class="btn btn-secondary" href="#/eventos/' + evento.id + '/editar">Editar</a>');
    if (evento.status === 'publicado') acoes.push('<button class="btn btn-secondary" data-action="cancelar">Cancelar evento</button>');
    if (evento.status !== 'publicado') acoes.push('<button class="btn btn-danger" data-action="excluir">Excluir</button>');
  }
  return `
    <section class="page-header">
      <div>
        <p class="breadcrumb"><a href="#/eventos">Eventos</a> / Evento #${evento.id}</p>
        <h1>${escapeHtml(evento.nome)}</h1>
        <span class="badge badge-${escapeHtml(evento.status)}">${STATUS_LABELS[evento.status] ?? ''}</span>
      </div>
      <div class="header-actions">${acoes.join('')}</div>
    </section>
    <nav class="tabs" aria-label="Seções do evento">
      ${ABAS.map(([chave, rotulo]) =>
        `<a role="tab" class="tab ${chave === abaAtual ? 'ativa' : ''}" href="#/eventos/${evento.id}?aba=${chave}">${rotulo}</a>`
      ).join('')}
    </nav>`;
}

let abaAtual = 'visao';

function renderVisao(evento) {
  return `
    <article class="card detail-grid">
      <div class="detail-item"><span>Local</span><strong>${escapeHtml(evento.local_evento)}</strong></div>
      <div class="detail-item"><span>Organizador</span><strong>${escapeHtml(evento.organizador_nome)}</strong></div>
      <div class="detail-item"><span>Início</span><strong>${formatDateTime(evento.data_inicio)}</strong></div>
      <div class="detail-item"><span>Término</span><strong>${formatDateTime(evento.data_fim)}</strong></div>
      <div class="detail-item"><span>Público mínimo</span><strong>${formatNumber(evento.publico_minimo)}</strong></div>
      <div class="detail-item"><span>Público máximo</span><strong>${formatNumber(evento.publico_maximo)}</strong></div>
      <div class="detail-item"><span>Público esperado</span><strong>${evento.publico_esperado ? formatNumber(evento.publico_esperado) : '—'}</strong></div>
      <div class="detail-item"><span>Margem de lucro (sobre a receita)</span><strong>${evento.margem_lucro_percentual}%</strong></div>
      <div class="detail-item detail-wide">
        <span>Descrição</span>
        <p class="pre-line">${evento.descricao ? escapeHtml(evento.descricao) : '<em class="muted">Sem descrição.</em>'}</p>
      </div>
    </article>
    <p class="muted small">Eventos publicados aparecem para fornecedores aprovados, que podem enviar propostas por item de custo.</p>`;
}

/**
 * Tela de detalhes com abas. Organizador dono: gerencia tudo.
 * Administrador: somente leitura (visão gerencial, RF14).
 */
export async function renderDetailPage({ id }, query, isCurrent) {
  const app = document.getElementById('app');
  const usuario = session.user();
  abaAtual = ['visao', 'custos', 'cotacoes', 'orcamento'].includes(query.aba) ? query.aba : 'visao';
  app.innerHTML = `<div id="detail-slot">${renderLoading('Carregando evento...')}</div>`;
  const slot = document.getElementById('detail-slot');

  let evento;
  try {
    evento = await eventosApi.get(id);
  } catch (err) {
    if (!slot.isConnected) return;
    slot.innerHTML = renderError(mensagemDeErro(err), 'retry-detail');
    document.getElementById('retry-detail').addEventListener('click', () => renderDetailPage({ id }, query, isCurrent));
    return;
  }
  if (!slot.isConnected || !isCurrent()) return;

  const podeGerenciar = usuario.perfil === 'organizador' && evento.organizador_id === usuario.id;
  const editavel = podeGerenciar && evento.status !== 'cancelado';
  const recarregar = () => renderDetailPage({ id }, { aba: abaAtual }, isCurrent);

  slot.innerHTML = `${renderCabecalho(evento, { podeGerenciar })}<div id="aba-conteudo" class="stack"></div>`;
  const conteudo = document.getElementById('aba-conteudo');

  slot.addEventListener('click', async (event) => {
    const btn = event.target.closest('[data-action]');
    if (!btn) return;
    const acoes = {
      publicar: () => eventosApi.publicar(evento.id).then(() => 'Evento publicado. Fornecedores já podem cotar.'),
      cancelar: async () => {
        const ok = await confirmDialog({ title: 'Cancelar evento', message: 'O evento será cancelado e as compras ativas serão estornadas integralmente. Deseja continuar?', confirmLabel: 'Cancelar evento', danger: true });
        if (!ok) return null;
        await eventosApi.cancelar(evento.id);
        return 'Evento cancelado.';
      },
      excluir: async () => {
        const ok = await confirmDialog({ title: 'Excluir evento', message: `Excluir "${evento.nome}"? Esta ação não pode ser desfeita.`, confirmLabel: 'Excluir', danger: true });
        if (!ok) return null;
        await eventosApi.remove(evento.id);
        navigate('/eventos');
        toast.success('Evento excluído.');
        return null;
      },
    };
    try {
      const mensagem = await acoes[btn.dataset.action]();
      if (mensagem) {
        toast.success(mensagem);
        recarregar();
      }
    } catch (err) {
      toast.error(mensagemDeErro(err));
    }
  });

  if (abaAtual === 'visao') conteudo.innerHTML = renderVisao(evento);
  if (abaAtual === 'custos') await renderTabCustos(conteudo, evento, { editavel, recarregar });
  if (abaAtual === 'cotacoes') await renderTabCotacoes(conteudo, evento, { editavel, recarregar });
  if (abaAtual === 'orcamento') await renderTabOrcamento(conteudo, evento);
}
