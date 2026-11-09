'use strict';

const admin = require('../services/admin.service');
const { asyncHandler } = require('../errors');
const { parseId, parsePaging } = require('../validators/common');

exports.usuarios = asyncHandler(async (req, res) => {
  const status = ['pendente', 'aprovado', 'rejeitado'].includes(req.query.status) ? req.query.status : undefined;
  const perfil = ['organizador', 'fornecedor', 'comprador', 'administrador'].includes(req.query.perfil) ? req.query.perfil : undefined;
  res.json(await admin.listarUsuarios({ status, perfil, ...parsePaging(req.query, { defaultLimit: 20 }) }));
});

exports.decidirUsuario = asyncHandler(async (req, res) => {
  res.json(await admin.decidirCadastro(parseId(req.params.id), req.body, req.user));
});

exports.eventos = asyncHandler(async (req, res) => {
  const status = ['rascunho', 'publicado', 'cancelado'].includes(req.query.status) ? req.query.status : undefined;
  res.json(await admin.listarEventos({ status, ...parsePaging(req.query, { defaultLimit: 20 }) }));
});

exports.resumo = asyncHandler(async (req, res) => {
  res.json(await admin.resumo());
});
