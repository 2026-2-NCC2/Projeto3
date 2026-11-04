'use strict';

const repo = require('../repositories/evento.repository');
const financeiro = require('../repositories/financeiro.repository');
const { HttpError } = require('../errors');
const { validateEvento } = require('../validators/evento.validator');

const CAMPOS_EVENTO = [
  'nome',
  'descricao',
  'local_evento',
  'data_inicio',
  'data_fim',
  'publico_minimo',
  'publico_maximo',
  'publico_esperado',
  'margem_lucro_percentual',
];

/** Converte colunas DECIMAL (strings no mysql2) em números. */
const toDto = (row) => ({
  ...row,
  margem_lucro_percentual: Number(row.margem_lucro_percentual),
});

const isAdmin = (user) => user.perfil === 'administrador';

/**
 * Busca um evento respeitando o dono. Outro organizador recebe 404 (não revelamos a existência).
 */
async function getAutorizado(id, user) {
  const evento = await repo.findById(id);
  if (!evento || (!isAdmin(user) && evento.organizador_id !== user.id)) {
    throw new HttpError(404, 'Evento não encontrado.');
  }
  return toDto(evento);
}

function assertEditavel(evento) {
  if (evento.status === 'cancelado') {
    throw new HttpError(409, 'Evento cancelado não pode ser alterado.');
  }
}

async function listar(user, filtros) {
  const { rows, total } = await repo.findAll({
    ...filtros,
    organizadorId: isAdmin(user) ? null : user.id,
  });
  const totalPages = Math.max(1, Math.ceil(total / filtros.limit));
  return {
    data: rows.map(toDto),
    meta: { page: filtros.page, limit: filtros.limit, total, totalPages, sort: filtros.sortBy, order: filtros.sortDir },
  };
}

async function criar(user, body) {
  const dados = validateEvento(body, 'create');
  const id = await repo.insert(dados, user.id);
  return getAutorizado(id, user);
}

/** PUT (parcial = false) e PATCH (parcial = true). A validação final é feita sobre o estado mesclado. */
async function atualizar(id, user, body, { parcial }) {
  const atual = await getAutorizado(id, user);
  assertEditavel(atual);

  const alteracoes = validateEvento(body, parcial ? 'patch' : 'replace');
  const mesclado = validateEvento(
    { ...Object.fromEntries(CAMPOS_EVENTO.map((c) => [c, atual[c]])), ...alteracoes },
    'replace'
  );
  const {one}=require('../commerce/core');
  const capacity=await one('SELECT COALESCE(SUM(capacidade),0) AS total FROM lotes WHERE evento_id=? AND ativo=1',[id]);
  if(capacity.total>mesclado.publico_maximo) throw new HttpError(409,'O público máximo não pode ficar abaixo da soma das capacidades dos lotes ativos.');
  await repo.update(id, mesclado);
  return getAutorizado(id, user);
}

/**
 * Publicação para cotação (RF08). Regras:
 *  - somente rascunhos;
 *  - ao menos um item de composição de custo;
 *  - data de término ainda não passou.
 */
async function publicar(id, user) {
  const evento = await getAutorizado(id, user);
  if (evento.status !== 'rascunho') {
    throw new HttpError(409, 'Somente eventos em rascunho podem ser publicados.');
  }
  const pendencias = [];
  const itens = await financeiro.findItensByEvento(id);
  if (itens.length === 0) {
    pendencias.push({ field: 'itens', message: 'Cadastre ao menos um item de composição de custo antes de publicar.' });
  }
  if (new Date(evento.data_fim.replace(' ', 'T')) < new Date()) {
    pendencias.push({ field: 'data_fim', message: 'A data de término já passou. Ajuste as datas antes de publicar.' });
  }
  if (pendencias.length) {
    throw new HttpError(409, 'Não é possível publicar o evento ainda.', pendencias);
  }
  await repo.setStatus(id, 'publicado');
  return getAutorizado(id, user);
}

async function cancelar(id,user) {
  await require('../commerce/management.service').cancelEvent(user,id);
  return getAutorizado(id,user);
}

async function remover(id, user) {
  const evento = await getAutorizado(id, user);
  if (evento.status === 'publicado') {
    throw new HttpError(409, 'Cancele o evento antes de excluí-lo. Eventos publicados não podem ser apagados.');
  }
  const lots=await require('../commerce/core').one('SELECT id FROM lotes WHERE evento_id=? LIMIT 1',[id]);
  if(lots) throw new HttpError(409,'Este evento possui lotes de venda. Preserve o histórico usando o cancelamento.');
  await repo.remove(id);
}

module.exports = { getAutorizado, assertEditavel, listar, criar, atualizar, publicar, cancelar, remover, toDto };
