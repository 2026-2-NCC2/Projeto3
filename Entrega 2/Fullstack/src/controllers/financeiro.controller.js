'use strict';

const financeiro = require('../services/financeiro.service');
const propostas = require('../services/proposta.service');
const { asyncHandler } = require('../errors');
const { parseId } = require('../validators/common');

exports.atualizarItem = asyncHandler(async (req, res) => {
  res.json(await financeiro.atualizarItem(parseId(req.params.id), req.user, req.body, { parcial: req.method === 'PATCH' }));
});

exports.removerItem = asyncHandler(async (req, res) => {
  await financeiro.removerItem(parseId(req.params.id), req.user);
  res.status(204).end();
});

exports.atualizarCusto = asyncHandler(async (req, res) => {
  res.json(await financeiro.atualizarCusto(parseId(req.params.id), req.user, req.body, { parcial: req.method === 'PATCH' }));
});

exports.removerCusto = asyncHandler(async (req, res) => {
  await financeiro.removerCusto(parseId(req.params.id), req.user);
  res.status(204).end();
});

exports.enviarProposta = asyncHandler(async (req, res) => {
  res.status(201).json(await propostas.criar(parseId(req.params.itemId), req.user, req.body));
});

exports.atualizarProposta = asyncHandler(async (req, res) => {
  res.json(await propostas.atualizar(parseId(req.params.id), req.user, req.body, { parcial: req.method === 'PATCH' }));
});

exports.cancelarProposta = asyncHandler(async (req, res) => {
  res.json(await propostas.cancelar(parseId(req.params.id), req.user));
});

exports.selecionarProposta = asyncHandler(async (req, res) => {
  res.json(await propostas.selecionar(parseId(req.params.id), req.user));
});

exports.liberarProposta = asyncHandler(async (req, res) => {
  res.json(await propostas.liberar(parseId(req.params.id), req.user));
});
