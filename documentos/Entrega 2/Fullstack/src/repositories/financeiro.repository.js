'use strict';

const { pool } = require('../db');

/* ----------------------------- Itens de custo ----------------------------- */

async function findItensByEvento(eventoId) {
  const [rows] = await pool.query(
    `SELECT id, evento_id, nome, categoria, descricao, created_at, updated_at
     FROM itens_custo WHERE evento_id = ? ORDER BY categoria, nome`,
    [eventoId]
  );
  return rows;
}

/** Item com dados do evento (dono e status) para checagens de acesso e de estado. */
async function findItemComEvento(id) {
  const [rows] = await pool.query(
    `SELECT i.id, i.evento_id, i.nome, i.categoria, i.descricao,
      e.organizador_id, e.status AS evento_status, e.data_fim AS evento_data_fim, e.nome AS evento_nome
     FROM itens_custo i JOIN eventos e ON e.id = i.evento_id WHERE i.id = ?`,
    [id]
  );
  return rows[0] ?? null;
}

async function insertItem(eventoId, data) {
  const [result] = await pool.query(
    'INSERT INTO itens_custo (evento_id, nome, categoria, descricao) VALUES (?, ?, ?, ?)',
    [eventoId, data.nome, data.categoria, data.descricao ?? null]
  );
  return result.insertId;
}

async function updateItem(id, data) {
  await pool.query('UPDATE itens_custo SET nome = ?, categoria = ?, descricao = ? WHERE id = ?', [
    data.nome,
    data.categoria,
    data.descricao ?? null,
    id,
  ]);
}

async function deleteItem(id) {
  await pool.query('DELETE FROM itens_custo WHERE id = ?', [id]);
}

/** Itens com a proposta selecionada (se houver), para o orçamento consolidado. */
async function findItensComSelecao(eventoId) {
  const [rows] = await pool.query(
    `SELECT i.id, i.nome, i.categoria,
      p.id AS proposta_id, p.valor AS proposta_valor,
      f.razao_social AS fornecedor_razao_social, f.nome AS fornecedor_nome
     FROM itens_custo i
     LEFT JOIN propostas p ON p.item_custo_id = i.id AND p.status = 'selecionada'
     LEFT JOIN usuarios f ON f.id = p.fornecedor_id
     WHERE i.evento_id = ?
     ORDER BY i.categoria, i.nome`,
    [eventoId]
  );
  return rows;
}

/* --------------------------- Custos do evento ----------------------------- */

async function findCustosByEvento(eventoId) {
  const [rows] = await pool.query(
    'SELECT id, evento_id, descricao, tipo, valor FROM custos_evento WHERE evento_id = ? ORDER BY tipo, descricao',
    [eventoId]
  );
  return rows;
}

async function findCustoComEvento(id) {
  const [rows] = await pool.query(
    `SELECT c.id, c.evento_id, c.descricao, c.tipo, c.valor,
      e.organizador_id, e.status AS evento_status
     FROM custos_evento c JOIN eventos e ON e.id = c.evento_id WHERE c.id = ?`,
    [id]
  );
  return rows[0] ?? null;
}

async function insertCusto(eventoId, data) {
  const [result] = await pool.query(
    'INSERT INTO custos_evento (evento_id, descricao, tipo, valor) VALUES (?, ?, ?, ?)',
    [eventoId, data.descricao, data.tipo, data.valor]
  );
  return result.insertId;
}

async function updateCusto(id, data) {
  await pool.query('UPDATE custos_evento SET descricao = ?, tipo = ?, valor = ? WHERE id = ?', [
    data.descricao,
    data.tipo,
    data.valor,
    id,
  ]);
}

async function deleteCusto(id) {
  await pool.query('DELETE FROM custos_evento WHERE id = ?', [id]);
}

module.exports = {
  findItensByEvento,
  findItemComEvento,
  insertItem,
  updateItem,
  deleteItem,
  findItensComSelecao,
  findCustosByEvento,
  findCustoComEvento,
  insertCusto,
  updateCusto,
  deleteCusto,
};
