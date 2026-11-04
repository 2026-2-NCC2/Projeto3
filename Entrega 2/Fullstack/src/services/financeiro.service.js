'use strict';

const repo = require('../repositories/financeiro.repository');
const propostaRepo = require('../repositories/proposta.repository');
const eventoService = require('./evento.service');
const { HttpError } = require('../errors');
const { validateItem, validateCusto } = require('../validators/financeiro.validator');

const toCustoDto = (c) => ({ ...c, valor: Number(c.valor) });

/* --------------------------- Itens de custo (RF06) ------------------------ */

async function listarItens(eventoId, user) {
  await eventoService.getAutorizado(eventoId, user);
  return repo.findItensByEvento(eventoId);
}

async function getItemAutorizado(itemId, user) {
  const item = await repo.findItemComEvento(itemId);
  if (!item || (user.perfil !== 'administrador' && item.organizador_id !== user.id)) {
    throw new HttpError(404, 'Item não encontrado.');
  }
  return item;
}

async function criarItem(eventoId, user, body) {
  const evento = await eventoService.getAutorizado(eventoId, user);
  eventoService.assertEditavel(evento);
  const dados = validateItem(body, 'create');
  try {
    await repo.insertItem(eventoId, dados);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'Já existe um item com este nome neste evento.');
    throw err;
  }
  return (await repo.findItensByEvento(eventoId)).find((i) => i.nome === dados.nome);
}

async function atualizarItem(itemId, user, body, { parcial }) {
  const item = await getItemAutorizado(itemId, user);
  if (item.evento_status === 'cancelado') throw new HttpError(409, 'Evento cancelado não pode ser alterado.');
  const dados = validateItem(body, parcial ? 'patch' : 'replace');
  const mesclado = {
    nome: dados.nome ?? item.nome,
    categoria: dados.categoria ?? item.categoria,
    descricao: dados.descricao !== undefined ? dados.descricao : item.descricao,
  };
  try {
    await repo.updateItem(itemId, mesclado);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'Já existe um item com este nome neste evento.');
    throw err;
  }
  return { id: itemId, evento_id: item.evento_id, ...mesclado };
}

async function removerItem(itemId, user) {
  const item = await getItemAutorizado(itemId, user);
  if (item.evento_status === 'cancelado') throw new HttpError(409, 'Evento cancelado não pode ser alterado.');
  if ((await propostaRepo.countSelecionadasNoItem(itemId)) > 0) {
    throw new HttpError(409, 'Este item tem proposta selecionada. Libere a seleção antes de removê-lo.');
  }
  await repo.deleteItem(itemId);
}

/* ------------------------ Custos do evento (RF07) ------------------------- */

async function listarCustos(eventoId, user) {
  await eventoService.getAutorizado(eventoId, user);
  return (await repo.findCustosByEvento(eventoId)).map(toCustoDto);
}

async function getCustoAutorizado(custoId, user) {
  const custo = await repo.findCustoComEvento(custoId);
  if (!custo || (user.perfil !== 'administrador' && custo.organizador_id !== user.id)) {
    throw new HttpError(404, 'Custo não encontrado.');
  }
  return custo;
}

async function criarCusto(eventoId, user, body) {
  const evento = await eventoService.getAutorizado(eventoId, user);
  eventoService.assertEditavel(evento);
  const dados = validateCusto(body, 'create');
  const id = await repo.insertCusto(eventoId, dados);
  return toCustoDto({ id, evento_id: eventoId, ...dados });
}

async function atualizarCusto(custoId, user, body, { parcial }) {
  const custo = await getCustoAutorizado(custoId, user);
  if (custo.evento_status === 'cancelado') throw new HttpError(409, 'Evento cancelado não pode ser alterado.');
  const dados = validateCusto(body, parcial ? 'patch' : 'replace');
  const mesclado = {
    descricao: dados.descricao ?? custo.descricao,
    tipo: dados.tipo ?? custo.tipo,
    valor: dados.valor ?? Number(custo.valor),
  };
  await repo.updateCusto(custoId, mesclado);
  return toCustoDto({ id: custoId, evento_id: custo.evento_id, ...mesclado });
}

async function removerCusto(custoId, user) {
  const custo = await getCustoAutorizado(custoId, user);
  if (custo.evento_status === 'cancelado') throw new HttpError(409, 'Evento cancelado não pode ser alterado.');
  await repo.deleteCusto(custoId);
}

module.exports = {
  listarItens,
  criarItem,
  atualizarItem,
  removerItem,
  listarCustos,
  criarCusto,
  atualizarCusto,
  removerCusto,
};
