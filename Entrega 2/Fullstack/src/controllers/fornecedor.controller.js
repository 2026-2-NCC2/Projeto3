'use strict';

const fornecedor = require('../services/fornecedor.service');
const propostas = require('../services/proposta.service');
const { asyncHandler, HttpError } = require('../errors');
const { parseId, parsePaging } = require('../validators/common');

exports.oportunidades = asyncHandler(async (req, res) => {
  const { page, limit } = parsePaging(req.query);
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
  res.json(await fornecedor.listarOportunidades(req.user, { q, page, limit }));
});

exports.oportunidade = asyncHandler(async (req, res) => {
  res.json(await fornecedor.detalheOportunidade(parseId(req.params.id), req.user));
});

exports.minhasPropostas = asyncHandler(async (req, res) => {
  res.json({ data: await propostas.historicoDoFornecedor(req.user) });
});

exports.semRota = (req, res, next) => next(new HttpError(404, 'Rota não encontrada.'));
