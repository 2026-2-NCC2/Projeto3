'use strict';

const { Validator, parseId, parsePaging } = require('./common');
const { HttpError } = require('../errors');

const MAX_PUBLICO = 10000000;
const CAMPOS = [
  'nome',
  'descricao',
  'local_evento',
  'data_inicio',
  'data_fim',
  'publico_minimo',
  'publico_maximo',
  'publico_esperado',
  'margem_lucro_percentual',
  'status',
];
const STATUS_EVENTO = ['rascunho', 'publicado', 'cancelado'];
const SORTABLE = ['data_inicio', 'nome', 'publico_maximo', 'created_at'];

/**
 * Valida criação (create), substituição (replace = PUT) ou atualização parcial (patch = PATCH).
 * Regras cruzadas são verificadas sempre que os campos envolvidos estiverem presentes.
 */
function validateEvento(input, mode = 'create') {
  const campos = CAMPOS.filter((c) => c !== 'status');
  const v = new Validator(input, mode, campos);

  v.text('nome', 3, 120);
  v.text('descricao', 0, 2000, { optional: true });
  v.text('local_evento', 3, 200);
  v.datetime('data_inicio');
  v.datetime('data_fim');
  v.integer('publico_minimo', 0, MAX_PUBLICO);
  v.integer('publico_maximo', 1, MAX_PUBLICO);
  v.integer('publico_esperado', 1, MAX_PUBLICO, { optional: true });
  v.decimal('margem_lucro_percentual', 0, 99.99, { optional: true, defaultValue: 0 });

  const o = v.out;
  if (o.data_inicio && o.data_fim && o.data_fim < o.data_inicio) {
    v.add('data_fim', 'A data de término não pode ser anterior à data de início.');
  }
  if (o.publico_minimo !== undefined && o.publico_maximo !== undefined && o.publico_maximo < o.publico_minimo) {
    v.add('publico_maximo', 'O público máximo não pode ser menor que o público mínimo.');
  }
  if (
    o.publico_esperado !== undefined &&
    o.publico_esperado !== null &&
    o.publico_minimo !== undefined &&
    o.publico_maximo !== undefined &&
    (o.publico_esperado < o.publico_minimo || o.publico_esperado > o.publico_maximo)
  ) {
    v.add('publico_esperado', 'O público esperado deve estar entre o público mínimo e o máximo.');
  }
  return v.done();
}

/** Query da listagem de eventos: paginação, status, busca e ordenação. */
function parseEventoQuery(query) {
  const errors = [];
  const out = {};
  if (query.status !== undefined && query.status !== '') {
    if (STATUS_EVENTO.includes(query.status)) out.status = query.status;
    else errors.push({ field: 'status', message: `Use um dos valores: ${STATUS_EVENTO.join(', ')}.` });
  }
  out.q = typeof query.q === 'string' ? query.q.trim().slice(0, 100) : '';
  const sortBy = query.sort === undefined ? 'data_inicio' : query.sort;
  if (SORTABLE.includes(sortBy)) out.sortBy = sortBy;
  else errors.push({ field: 'sort', message: `Use um dos valores: ${SORTABLE.join(', ')}.` });
  const order = query.order === undefined ? 'asc' : String(query.order).toLowerCase();
  if (order === 'asc' || order === 'desc') out.sortDir = order;
  else errors.push({ field: 'order', message: 'Use asc ou desc.' });
  if (errors.length) throw new HttpError(400, 'Parâmetros de consulta inválidos.', errors);
  return { ...out, ...parsePaging(query) };
}

module.exports = { validateEvento, parseEventoQuery, parseId, STATUS_EVENTO, MAX_PUBLICO };
