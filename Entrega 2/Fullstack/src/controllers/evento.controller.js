'use strict';

const service = require('../services/evento.service');
const orcamento = require('../services/orcamento.service');
const propostas = require('../services/proposta.service');
const financeiro = require('../services/financeiro.service');
const { asyncHandler } = require('../errors');
const { parseId } = require('../validators/common');
const { parseEventoQuery } = require('../validators/evento.validator');

exports.list = asyncHandler(async (req, res) => {
  res.json(await service.listar(req.user, parseEventoQuery(req.query)));
});

exports.get = asyncHandler(async (req, res) => {
  res.json(await service.getAutorizado(parseId(req.params.id), req.user));
});

exports.create = asyncHandler(async (req, res) => {
  const evento = await service.criar(req.user, req.body);
  res.status(201).location(`/api/eventos/${evento.id}`).json(evento);
});

exports.replace = asyncHandler(async (req, res) => {
  res.json(await service.atualizar(parseId(req.params.id), req.user, req.body, { parcial: false }));
});

exports.patch = asyncHandler(async (req, res) => {
  res.json(await service.atualizar(parseId(req.params.id), req.user, req.body, { parcial: true }));
});

exports.remove = asyncHandler(async (req, res) => {
  await service.remover(parseId(req.params.id), req.user);
  res.status(204).end();
});

exports.publicar = asyncHandler(async (req, res) => {
  res.json(await service.publicar(parseId(req.params.id), req.user));
});

exports.cancelar = asyncHandler(async (req, res) => {
  res.json(await service.cancelar(parseId(req.params.id), req.user));
});

exports.orcamento = asyncHandler(async (req, res) => {
  res.json(await orcamento.orcamento(parseId(req.params.id), req.user));
});

exports.ticket = asyncHandler(async (req, res) => {
  res.json(await orcamento.ticket(parseId(req.params.id), req.user));
});

exports.cotacoes = asyncHandler(async (req, res) => {
  res.json(await propostas.cotacoes(parseId(req.params.id), req.user));
});

exports.listarItens = asyncHandler(async (req, res) => {
  res.json({ data: await financeiro.listarItens(parseId(req.params.id), req.user) });
});

exports.criarItem = asyncHandler(async (req, res) => {
  const item = await financeiro.criarItem(parseId(req.params.id), req.user, req.body);
  res.status(201).json(item);
});

exports.listarCustos = asyncHandler(async (req, res) => {
  res.json({ data: await financeiro.listarCustos(parseId(req.params.id), req.user) });
});

exports.criarCusto = asyncHandler(async (req, res) => {
  const custo = await financeiro.criarCusto(parseId(req.params.id), req.user, req.body);
  res.status(201).json(custo);
});
