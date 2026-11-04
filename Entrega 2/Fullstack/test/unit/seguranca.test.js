'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { hashPassword, verifyPassword } = require('../../src/auth/password');
const { createToken, verifyToken } = require('../../src/auth/token');
const { isValidCnpj, normalizeCnpj } = require('../../src/domain/cnpj');

describe('Senhas (RNF Segurança)', () => {
  test('o hash não contém a senha e confere com a senha correta', async () => {
    const hash = await hashPassword('Senha123');
    assert.ok(!hash.includes('Senha123'));
    assert.ok(hash.startsWith('scrypt$'));
    assert.equal(await verifyPassword('Senha123', hash), true);
  });

  test('senha errada e hash malformado são rejeitados', async () => {
    const hash = await hashPassword('Senha123');
    assert.equal(await verifyPassword('senha123', hash), false);
    assert.equal(await verifyPassword('Senha123', 'texto-qualquer'), false);
  });

  test('o mesmo texto gera hashes diferentes (sal aleatório)', async () => {
    assert.notEqual(await hashPassword('Senha123'), await hashPassword('Senha123'));
  });
});

describe('Tokens assinados', () => {
  const secret = 'segredo-de-teste';

  test('token válido devolve o payload', () => {
    const token = createToken({ sub: 7, perfil: 'organizador' }, secret, 60);
    const payload = verifyToken(token, secret);
    assert.equal(payload.sub, 7);
    assert.equal(payload.perfil, 'organizador');
  });

  test('token com segredo diferente é rejeitado', () => {
    const token = createToken({ sub: 7 }, secret, 60);
    assert.equal(verifyToken(token, 'outro-segredo'), null);
  });

  test('token adulterado (perfil alterado no payload) é rejeitado', () => {
    const token = createToken({ sub: 7, perfil: 'fornecedor' }, secret, 60);
    const [h, , s] = token.split('.');
    const forjado = Buffer.from(JSON.stringify({ sub: 7, perfil: 'administrador', exp: 9999999999 })).toString('base64url');
    assert.equal(verifyToken(`${h}.${forjado}.${s}`, secret), null);
  });

  test('token expirado é rejeitado', () => {
    const token = createToken({ sub: 7 }, secret, 60);
    const agora = Math.floor(Date.now() / 1000);
    assert.equal(verifyToken(token, secret, agora + 3600), null);
  });
});

describe('CNPJ', () => {
  test('aceita CNPJ válido com ou sem máscara', () => {
    assert.equal(isValidCnpj('11.222.333/0001-81'), true);
    assert.equal(isValidCnpj('11222333000181'), true);
  });

  test('rejeita dígitos verificadores errados, sequências repetidas e tamanho errado', () => {
    assert.equal(isValidCnpj('11.222.333/0001-82'), false);
    assert.equal(isValidCnpj('11111111111111'), false);
    assert.equal(isValidCnpj('1122233300018'), false);
  });

  test('normalizeCnpj mantém somente dígitos', () => {
    assert.equal(normalizeCnpj('11.222.333/0001-81'), '11222333000181');
  });
});
