'use strict';

const repo = require('../repositories/evento.repository');
const financeiro = require('../repositories/financeiro.repository');
const propostaRepo = require('../repositories/proposta.repository');
const { HttpError } = require('../errors');

/** Eventos visíveis ao fornecedor aprovado (RF09): publicados e não encerrados. */
async function listarOportunidades(user, { q, page, limit }) {
  const { rows, total } = await repo.findOportunidades({ fornecedorId: user.id, q, page, limit });
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return { data: rows, meta: { page, limit, total, totalPages } };
}

async function detalheOportunidade(eventoId, user) {
  const evento = await repo.findOportunidadeById(eventoId);
  if (!evento) throw new HttpError(404, 'Oportunidade não encontrada ou encerrada.');

  const itens = await financeiro.findItensByEvento(eventoId);
  const minhas = (await propostaRepo.findByFornecedor(user.id)).filter((p) => p.evento_id === evento.id);

  return {
    evento,
    itens: itens.map((item) => {
      const minha = minhas.find((p) => p.item_custo_id === item.id && p.status !== 'cancelada');
      return {
        id: item.id,
        nome: item.nome,
        categoria: item.categoria,
        descricao: item.descricao,
        minha_proposta: minha
          ? { id: minha.id, valor: Number(minha.valor), status: minha.status, validade: minha.validade }
          : null,
      };
    }),
  };
}

module.exports = { listarOportunidades, detalheOportunidade };
