'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { validateEvento } = require('../../src/validators/evento.validator');
const { validateCadastro, validateLogin } = require('../../src/validators/usuario.validator');
const { validateItem, validateCusto, validateProposta } = require('../../src/validators/financeiro.validator');
const { normalizeDateTime } = require('../../src/validators/common');

const eventoValido = (extra = {}) => ({
  nome: 'Festa de Teste',
  local_evento: 'Pátio FECAP',
  data_inicio: '2026-12-10T20:00',
  data_fim: '2026-12-10T23:00',
  publico_minimo: 100,
  publico_maximo: 400,
  ...extra,
});

const detalhes = (fn) => {
  try {
    fn();
    return null;
  } catch (err) {
    return err.details.map((d) => d.field);
  }
};

describe('Evento (RF05)', () => {
  test('aceita um evento válido e aplica defaults', () => {
    const out = validateEvento(eventoValido());
    assert.equal(out.data_inicio, '2026-12-10 20:00:00');
    assert.equal(out.margem_lucro_percentual, 0);
    assert.equal(out.publico_esperado, null);
  });

  test('bloqueia alteração direta de status (deve usar as ações próprias)', () => {
    assert.deepEqual(detalhes(() => validateEvento(eventoValido({ status: 'publicado' }))), ['status']);
  });

  test('rejeita data inexistente (30 de fevereiro) e término antes do início', () => {
    assert.deepEqual(detalhes(() => validateEvento(eventoValido({ data_inicio: '2026-02-30T10:00' }))), ['data_inicio']);
    assert.deepEqual(detalhes(() => validateEvento(eventoValido({ data_fim: '2026-12-09T10:00' }))), ['data_fim']);
  });

  test('rejeita máximo menor que mínimo e esperado fora da faixa', () => {
    assert.deepEqual(detalhes(() => validateEvento(eventoValido({ publico_maximo: 50 }))), ['publico_maximo']);
    assert.deepEqual(detalhes(() => validateEvento(eventoValido({ publico_esperado: 999 }))), ['publico_esperado']);
  });

  test('margem aceita no máximo 2 casas e menor que 100', () => {
    assert.deepEqual(detalhes(() => validateEvento(eventoValido({ margem_lucro_percentual: 12.345 }))), [
      'margem_lucro_percentual',
    ]);
    assert.deepEqual(detalhes(() => validateEvento(eventoValido({ margem_lucro_percentual: 100 }))), [
      'margem_lucro_percentual',
    ]);
  });

  test('PATCH aceita campos isolados sem exigir os demais', () => {
    const out = validateEvento({ nome: 'Novo nome' }, 'patch');
    assert.deepEqual(out, { nome: 'Novo nome' });
  });

  test('PATCH vazio é rejeitado', () => {
    assert.deepEqual(detalhes(() => validateEvento({}, 'patch')), ['body']);
  });

  test('campos desconhecidos são rejeitados', () => {
    assert.deepEqual(detalhes(() => validateEvento(eventoValido({ organizador_id: 1 }))), ['organizador_id']);
  });

  test('normalizeDateTime aceita os formatos aceitos pela interface', () => {
    assert.equal(normalizeDateTime('2026-11-28'), '2026-11-28 00:00:00');
    assert.equal(normalizeDateTime('2026-11-28T20:30'), '2026-11-28 20:30:00');
    assert.equal(normalizeDateTime('2026-11-28 20:30:15'), '2026-11-28 20:30:15');
    assert.equal(normalizeDateTime('28/11/2026'), null);
    assert.equal(normalizeDateTime('2026-11-28T25:00'), null);
  });
});

describe('Cadastro (RF01, RF02)', () => {
  const organizador = { nome: 'Ana Souza', email: 'Ana@Exemplo.com', senha: 'Senha1234' };
  const fornecedor = {
    nome: 'Sabor Buffet',
    email: 'buffet@exemplo.com',
    senha: 'Senha1234',
    razao_social: 'Sabor Buffet Ltda',
    documento: '11.222.333/0001-81',
    area_atuacao: 'Alimentação',
  };

  test('organizador: e-mail é normalizado para minúsculas', () => {
    assert.equal(validateCadastro(organizador, 'organizador').email, 'ana@exemplo.com');
  });

  test('fornecedor exige CNPJ válido, razão social e área de atuação', () => {
    assert.deepEqual(detalhes(() => validateCadastro({ ...fornecedor, documento: '11.222.333/0001-82' }, 'fornecedor')), [
      'documento',
    ]);
    assert.deepEqual(detalhes(() => validateCadastro({ ...organizador }, 'fornecedor')), [
      'razao_social',
      'documento',
      'area_atuacao',
    ]);
    assert.equal(validateCadastro(fornecedor, 'fornecedor').documento, '11222333000181');
  });

  test('senha precisa de letra e número, entre 8 e 72 caracteres', () => {
    assert.deepEqual(detalhes(() => validateCadastro({ ...organizador, senha: 'somente-letras' }, 'organizador')), [
      'senha',
    ]);
    assert.deepEqual(detalhes(() => validateCadastro({ ...organizador, senha: '1234567' }, 'organizador')), ['senha']);
  });

  test('perfil não pode ser escolhido pelo cadastro (campo desconhecido)', () => {
    assert.deepEqual(detalhes(() => validateCadastro({ ...organizador, perfil: 'administrador' }, 'organizador')), [
      'perfil',
    ]);
  });

  test('login exige e-mail válido e senha', () => {
    assert.deepEqual(validateLogin({ email: 'a@b.com', senha: 'x' }), { email: 'a@b.com', senha: 'x' });
    assert.deepEqual(detalhes(() => validateLogin({ email: 'nao-e-email', senha: 'x' })), ['email']);
  });
});

describe('Financeiro (RF06, RF07, RF10)', () => {
  test('item exige nome e categoria da lista permitida', () => {
    assert.deepEqual(validateItem({ nome: 'Refletores', categoria: 'iluminacao' }).categoria, 'iluminacao');
    assert.deepEqual(detalhes(() => validateItem({ nome: 'Refletores', categoria: 'pirotecnia' })), ['categoria']);
  });

  test('custo aceita apenas tipos fiscal, operacional e variável, com valor não negativo', () => {
    assert.deepEqual(validateCusto({ descricao: 'Alvará municipal', tipo: 'fiscal', valor: 1800 }).valor, 1800);
    assert.deepEqual(detalhes(() => validateCusto({ descricao: 'Alvará municipal', tipo: 'outro', valor: -5 })), [
      'tipo',
      'valor',
    ]);
  });

  test('proposta: valor com até 2 casas, validade válida e não passada', () => {
    const base = { valor: 4300.5, descricao: 'Locação de refletores LED', validade: '2099-12-31' };
    assert.equal(validateProposta(base).valor, 4300.5);
    assert.deepEqual(detalhes(() => validateProposta({ ...base, valor: 10.555 })), ['valor']);
    assert.deepEqual(detalhes(() => validateProposta({ ...base, validade: '2000-01-01' })), ['validade']);
    assert.deepEqual(detalhes(() => validateProposta({ ...base, validade: '2026-02-31' })), ['validade']);
  });
});
