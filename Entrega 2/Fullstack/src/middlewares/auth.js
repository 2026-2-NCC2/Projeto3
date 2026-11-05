'use strict';

const config = require('../config');
const { verifyToken } = require('../auth/token');
const usuarioRepo = require('../repositories/usuario.repository');
const { HttpError, asyncHandler } = require('../errors');

/**
 * Exige um Bearer token válido e carrega o usuário ATUAL do banco
 * (assim, uma rejeição ou bloqueio feito pelo Administrador vale imediatamente).
 */
const authenticate = asyncHandler(async (req, res, next) => {
  const [scheme, token] = String(req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw new HttpError(401, 'Autenticação necessária. Faça login para continuar.');
  }
  const payload = verifyToken(token, config.auth.secret);
  if (!payload) {
    throw new HttpError(401, 'Sessão inválida ou expirada. Faça login novamente.');
  }
  const usuario = await usuarioRepo.findById(payload.sub);
  if (!usuario) throw new HttpError(401, 'Usuário não encontrado. Faça login novamente.');
  const version = await require('../commerce/core').one('SELECT versao FROM versoes_sessao WHERE usuario_id=?',[usuario.id]);
  if ((payload.v??0)!==(version?.versao??0)) throw new HttpError(401,'Sua senha foi alterada. Entre novamente para continuar.');
  req.user = usuario;
  next();
});

/** Restringe a rota a um ou mais perfis (administrador, organizador, fornecedor). */
const requirePerfil =
  (...perfis) =>
  (req, res, next) => {
    if (!req.user) return next(new HttpError(401, 'Autenticação necessária.'));
    if (!perfis.includes(req.user.perfil)) {
      return next(new HttpError(403, 'Seu perfil não tem permissão para esta operação.'));
    }
    return next();
  };

/**
 * Operações plenas só para cadastros aprovados (RF01/RF02: "pendente até aprovação").
 * O Administrador é sempre considerado aprovado.
 */
function requireAprovado(req, res, next) {
  if (!req.user) return next(new HttpError(401, 'Autenticação necessária.'));
  if (req.user.perfil === 'administrador' || req.user.status === 'aprovado') return next();
  const motivo =
    req.user.status === 'rejeitado'
      ? 'Seu cadastro foi rejeitado pelo Administrador. Entre em contato com a TrocaTicket.'
      : 'Seu cadastro está pendente de aprovação pelo Administrador.';
  return next(new HttpError(403, motivo));
}

module.exports = { authenticate, requirePerfil, requireAprovado };
