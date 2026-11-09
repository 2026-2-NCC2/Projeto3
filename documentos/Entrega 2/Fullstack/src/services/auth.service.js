'use strict';

const config = require('../config');
const repo = require('../repositories/usuario.repository');
const { hashPassword, verifyPassword } = require('../auth/password');
const { createToken } = require('../auth/token');
const { validateCadastro, validateLogin } = require('../validators/usuario.validator');
const { HttpError } = require('../errors');

/**
 * Autocadastro (RF01 organizador / RF02 fornecedor).
 * A conta nasce "pendente" e só opera plenamente após aprovação do Administrador (RF03).
 */
async function cadastrar(perfil, input) {
  const fornecedor = perfil === 'fornecedor';
  let dados;
  try {
    dados = validateCadastro(input, perfil, { cnpjDeApresentacao: fornecedor && config.demo });
  } catch (err) {
    if (fornecedor && err instanceof HttpError && err.details?.length) {
      throw new HttpError(err.status, err.details.map(detail => detail.message).join(' '), err.details);
    }
    throw err;
  }

  if (await repo.findByEmailComSenha(dados.email)) {
    if (fornecedor) {
      const message = 'Este e-mail já está cadastrado. Use outro e-mail para criar o fornecedor ou entre na conta existente.';
      throw new HttpError(409, message, [{ field: 'email', message }]);
    }
    throw new HttpError(409, 'Já existe uma conta com este e-mail.');
  }

  if (fornecedor && await repo.findByDocumento(dados.documento)) {
    const message = config.demo
      ? 'Este CNPJ já está cadastrado. Entre na conta existente ou use outro CNPJ de teste.'
      : 'Este CNPJ já está cadastrado. Entre na conta do fornecedor existente.';
    throw new HttpError(409, message, [{ field: 'documento', message }]);
  }

  const senhaHash = await hashPassword(dados.senha);
  let id;
  try {
    id = await repo.insert({
      nome: dados.nome,
      email: dados.email,
      senha_hash: senhaHash,
      perfil,
      status: perfil === 'comprador' ? 'aprovado' : 'pendente',
      telefone: dados.telefone ?? null,
      razao_social: dados.razao_social ?? null,
      documento: dados.documento ?? null,
      area_atuacao: dados.area_atuacao ?? null,
    });
  } catch (err) {
    if (fornecedor && err.code === 'ER_DUP_ENTRY') {
      const emailEmUso = await repo.findByEmailComSenha(dados.email);
      const field = emailEmUso ? 'email' : 'documento';
      const message = emailEmUso ? 'Este e-mail já está cadastrado. Use outro e-mail para criar o fornecedor.' : 'Este CNPJ já está cadastrado. Entre na conta do fornecedor existente.';
      throw new HttpError(409, message, [{ field, message }]);
    }
    if (err.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'E-mail ou CNPJ já cadastrado.');
    throw err;
  }

  return {
    usuario: await repo.findById(id),
    mensagem: perfil === 'comprador' ? 'Sua conta está pronta. Entre para continuar.' : 'Cadastro recebido. Aguarde a aprovação do Administrador.',
  };
}

/** Login: retorna token assinado. O status do usuário é informado para a interface. */
async function login(input) {
  const { email, senha } = validateLogin(input);
  const usuario = await repo.findByEmailComSenha(email);
  const senhaOk = usuario ? await verifyPassword(senha, usuario.senha_hash) : false;
  if (!senhaOk) throw new HttpError(401, 'E-mail ou senha inválidos.');

  return session(usuario);
}

async function session(usuario) {
  const version = await require('../commerce/core').one('SELECT versao FROM versoes_sessao WHERE usuario_id=?',[usuario.id]);
  const token = createToken({ sub: usuario.id, perfil: usuario.perfil, v: version?.versao??0 }, config.auth.secret, config.auth.ttlSeconds);
  return {
    token,
    expira_em_segundos: config.auth.ttlSeconds,
    usuario: await repo.findById(usuario.id),
  };
}

const DEMO_PROFILES = Object.freeze({ administrador: 1, organizador: 2, fornecedor: 4, comprador: 7 });

async function loginDemo(input) {
  const { email, senha, perfil } = input ?? {};
  if (typeof email !== 'string' || !email.trim() || typeof senha !== 'string' || !senha.trim() ||
      typeof perfil !== 'string' || !Object.hasOwn(DEMO_PROFILES, perfil)) {
    throw new HttpError(400, 'Preencha o e-mail, a senha e o perfil de apresentação.');
  }
  const usuario = await repo.findById(DEMO_PROFILES[perfil]);
  if (!usuario || usuario.perfil !== perfil) throw new HttpError(503, 'Conta de demonstração indisponível.');
  return session(usuario);
}

async function me(user) {
  return repo.findById(user.id);
}

module.exports = { cadastrar, login, loginDemo, me };
