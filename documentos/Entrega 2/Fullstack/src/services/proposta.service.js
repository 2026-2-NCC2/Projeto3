'use strict';

const repo = require('../repositories/proposta.repository');
const financeiro = require('../repositories/financeiro.repository');
const eventoService = require('./evento.service');
const { withTransaction } = require('../db');
const { HttpError } = require('../errors');
const { validateProposta } = require('../validators/financeiro.validator');
const { fromCents, toCents } = require('../domain/money');

const toDto = (p) => ({
  id: p.id,
  item_custo_id: p.item_custo_id,
  item_nome: p.item_nome,
  item_categoria: p.item_categoria,
  evento_id: p.evento_id,
  evento_nome: p.evento_nome,
  fornecedor: p.fornecedor_razao_social || p.fornecedor_nome,
  valor: Number(p.valor),
  descricao: p.descricao,
  validade: p.validade,
  observacoes: p.observacoes,
  status: p.status,
  created_at: p.created_at,
  updated_at: p.updated_at,
});

/** Evento aberto para cotação: publicado e ainda não encerrado. */
function assertAbertoParaCotacao(contexto) {
  const encerrado = new Date(String(contexto.evento_data_fim).replace(' ', 'T')) < new Date();
  if (contexto.evento_status !== 'publicado' || encerrado) {
    throw new HttpError(409, 'Este evento não está aberto para cotação.');
  }
}

/** Fornecedor envia proposta para um item (RF10). Uma proposta por item e fornecedor. */
async function criar(itemId, user, body) {
  const item = await financeiro.findItemComEvento(itemId);
  if (!item) throw new HttpError(404, 'Item não encontrado.');
  assertAbertoParaCotacao({ evento_status: item.evento_status, evento_data_fim: item.evento_data_fim });

  const dados = validateProposta(body, 'create');
  let id;
  try {
    id = await repo.insert({ ...dados, itemId }, user.id);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      throw new HttpError(409, 'Você já enviou uma proposta para este item. Edite-a em "Minhas propostas".');
    }
    throw err;
  }
  return toDto(await repo.findByIdComContexto(id));
}

async function getDoFornecedor(id, user) {
  const proposta = await repo.findByIdComContexto(id);
  if (!proposta || proposta.fornecedor_id !== user.id) throw new HttpError(404, 'Proposta não encontrada.');
  return proposta;
}

/** Edição só enquanto a proposta estiver "enviada" e o evento aberto (regra de edição do projeto). */
async function atualizar(id, user, body, { parcial }) {
  const atual = await getDoFornecedor(id, user);
  if (atual.status !== 'enviada') {
    throw new HttpError(409, 'Proposta selecionada ou cancelada não pode mais ser editada.');
  }
  assertAbertoParaCotacao(atual);

  const dados = validateProposta(body, parcial ? 'patch' : 'replace');
  const mesclado = {
    valor: dados.valor ?? Number(atual.valor),
    descricao: dados.descricao ?? atual.descricao,
    validade: dados.validade ?? atual.validade,
    observacoes: dados.observacoes !== undefined ? dados.observacoes : atual.observacoes,
  };
  await repo.update(id, mesclado);
  return toDto(await repo.findByIdComContexto(id));
}

/** Cancelamento pelo fornecedor: mantém o histórico (status "cancelada"). */
async function cancelar(id, user) {
  const atual = await getDoFornecedor(id, user);
  if (atual.status !== 'enviada') {
    throw new HttpError(409, 'Somente propostas enviadas (não selecionadas) podem ser canceladas.');
  }
  await repo.setStatus(id, 'cancelada');
  return toDto(await repo.findByIdComContexto(id));
}

async function getDoOrganizador(id, user) {
  const proposta = await repo.findByIdComContexto(id);
  if (!proposta || (user.perfil !== 'administrador' && proposta.organizador_id !== user.id)) {
    throw new HttpError(404, 'Proposta não encontrada.');
  }
  return proposta;
}

/**
 * Seleção de proposta pelo organizador (RF12). Uma por item: a anterior volta a "enviada"
 * na mesma transação. O banco também garante a unicidade (coluna gerada + UNIQUE).
 */
async function selecionar(id, user) {
  const proposta = await getDoOrganizador(id, user);
  if (proposta.status === 'cancelada') throw new HttpError(409, 'Proposta cancelada não pode ser selecionada.');
  if (proposta.evento_status === 'cancelado') throw new HttpError(409, 'Evento cancelado não pode ser alterado.');
  if (proposta.status === 'selecionada') return toDto(proposta);

  await withTransaction(async (conn) => {
    await repo.liberarSelecaoDoItem(proposta.item_custo_id, conn);
    await repo.setStatus(id, 'selecionada', conn);
  });
  return toDto(await repo.findByIdComContexto(id));
}

async function liberar(id, user) {
  const proposta = await getDoOrganizador(id, user);
  if (proposta.status !== 'selecionada') throw new HttpError(409, 'Esta proposta não está selecionada.');
  await repo.setStatus(id, 'enviada');
  return toDto(await repo.findByIdComContexto(id));
}

async function historicoDoFornecedor(user) {
  return (await repo.findByFornecedor(user.id)).map(toDto);
}

/**
 * Comparativo para o organizador (RF11): propostas por item, da menor para a maior,
 * com estatísticas e marcação da melhor oferta.
 */
async function cotacoes(eventoId, user) {
  const evento = await eventoService.getAutorizado(eventoId, user);
  const itens = await financeiro.findItensByEvento(eventoId);
  const propostas = await repo.findComparativoPorEvento(eventoId);

  return {
    evento: { id: evento.id, nome: evento.nome, status: evento.status },
    itens: itens.map((item) => {
      const lista = propostas
        .filter((p) => p.item_custo_id === item.id)
        .map((p) => ({
          id: p.id,
          fornecedor: p.fornecedor_razao_social || p.fornecedor_nome,
          area_atuacao: p.area_atuacao,
          valor: Number(p.valor),
          descricao: p.descricao,
          validade: p.validade,
          observacoes: p.observacoes,
          status: p.status,
        }));
      const ativas = lista.filter((p) => p.status !== 'cancelada');
      const menor = ativas.length ? Math.min(...ativas.map((p) => toCents(p.valor))) : null;
      const maior = ativas.length ? Math.max(...ativas.map((p) => toCents(p.valor))) : null;
      const media = ativas.length
        ? fromCents(Math.round(ativas.reduce((s, p) => s + toCents(p.valor), 0) / ativas.length))
        : null;
      const selecionada = lista.find((p) => p.status === 'selecionada') ?? null;
      return {
        id: item.id,
        nome: item.nome,
        categoria: item.categoria,
        selecionada_id: selecionada ? selecionada.id : null,
        propostas: lista.map((p) => ({ ...p, menor_valor: menor !== null && toCents(p.valor) === menor && p.status !== 'cancelada' })),
        estatisticas: {
          quantidade: ativas.length,
          menor: menor === null ? null : fromCents(menor),
          maior: maior === null ? null : fromCents(maior),
          media,
        },
      };
    }),
  };
}

module.exports = {
  criar,
  atualizar,
  cancelar,
  selecionar,
  liberar,
  historicoDoFornecedor,
  cotacoes,
};
