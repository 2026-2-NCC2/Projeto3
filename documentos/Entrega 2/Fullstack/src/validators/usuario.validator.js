'use strict';

const { Validator } = require('./common');
const { normalizeCnpj } = require('../domain/cnpj');

const STATUS_ADMIN = ['aprovado', 'rejeitado'];

/** Cadastro de organizador (RF01) ou fornecedor (RF02). Retorna dados normalizados. */
function validateCadastro(input, perfil, { cnpjDeApresentacao = false } = {}) {
  const campos = ['nome', 'email', 'senha', 'telefone', 'razao_social', 'documento', 'area_atuacao'];
  const v = new Validator(input, 'create', campos);
  v.text('nome', 3, 120);
  v.email('email');
  v.password('senha');
  v.text('telefone', 8, 20, { optional: true });

  if (perfil === 'fornecedor') {
    v.text('razao_social', 3, 160);
    if (cnpjDeApresentacao) {
      const documento = normalizeCnpj(input.documento);
      if (typeof input.documento !== 'string' || !/^[\d.\s/-]+$/.test(input.documento) || documento.length !== 14) {
        v.add('documento', 'Informe um CNPJ de teste com 14 dígitos.');
      } else {
        v.out.documento = documento;
      }
    } else {
      v.cnpj('documento');
    }
    v.text('area_atuacao', 3, 120);
  } else {
    v.text('razao_social', 3, 160, { optional: true });
  }
  return v.done();
}

/** Login: e-mail e senha obrigatórios. */
function validateLogin(input) {
  const v = new Validator(input, 'create', ['email', 'senha']);
  v.email('email');
  if (typeof input?.senha !== 'string' || input.senha.length === 0) {
    v.add('senha', 'Informe a senha.');
  }
  const out = v.done();
  return { email: out.email, senha: input.senha };
}

/** Decisão do Administrador sobre um cadastro (RF03). */
function validateDecisao(input) {
  const v = new Validator(input, 'create', ['status']);
  v.enumField('status', STATUS_ADMIN);
  return v.done();
}

module.exports = { validateCadastro, validateLogin, validateDecisao, STATUS_ADMIN };
