'use strict';

const service = require('../services/auth.service');
const { asyncHandler } = require('../errors');

exports.cadastrarOrganizador = asyncHandler(async (req, res) => {
  res.status(201).json(await service.cadastrar('organizador', req.body));
});

exports.cadastrarFornecedor = asyncHandler(async (req, res) => {
  res.status(201).json(await service.cadastrar('fornecedor', req.body));
});

exports.login = asyncHandler(async (req, res) => {
  res.json(await service.login(req.body));
});

exports.me = asyncHandler(async (req, res) => {
  res.json({ usuario: await service.me(req.user) });
});
