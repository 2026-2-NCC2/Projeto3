'use strict';

const { Validator } = require('./common');

const CATEGORIAS_ITEM = ['iluminacao', 'alimentacao', 'bebida', 'seguranca', 'infraestrutura', 'outros'];
const TIPOS_CUSTO = ['fiscal', 'operacional', 'variavel'];
const MAX_VALOR = 1000000000;

/** Item de composição de custo (RF06). */
function validateItem(input, mode = 'create') {
  const v = new Validator(input, mode, ['nome', 'categoria', 'descricao']);
  v.text('nome', 3, 120);
  v.enumField('categoria', CATEGORIAS_ITEM);
  v.text('descricao', 0, 500, { optional: true });
  return v.done();
}

/** Custo do evento não vindo de fornecedor (RF07): fiscal, operacional ou variável. */
function validateCusto(input, mode = 'create') {
  const v = new Validator(input, mode, ['descricao', 'tipo', 'valor']);
  v.text('descricao', 3, 160);
  v.enumField('tipo', TIPOS_CUSTO);
  v.decimal('valor', 0, MAX_VALOR);
  return v.done();
}

/** Proposta de fornecedor (RF10): valor, descrição, validade e observações. */
function validateProposta(input, mode = 'create') {
  const v = new Validator(input, mode, ['valor', 'descricao', 'validade', 'observacoes']);
  v.decimal('valor', 0.01, MAX_VALOR);
  v.text('descricao', 5, 1000);
  v.date('validade', { naoPodeSerPassada: true });
  v.text('observacoes', 0, 1000, { optional: true });
  return v.done();
}

module.exports = { validateItem, validateCusto, validateProposta, CATEGORIAS_ITEM, TIPOS_CUSTO };
