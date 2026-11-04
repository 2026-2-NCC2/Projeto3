'use strict';

const { pool } = require('../db');

const CONTEXTO = `SELECT p.id, p.item_custo_id, p.fornecedor_id, p.valor, p.descricao, p.validade,
    p.observacoes, p.status, p.created_at, p.updated_at,
    i.nome AS item_nome, i.categoria AS item_categoria,
    e.id AS evento_id, e.nome AS evento_nome, e.status AS evento_status,
    e.data_fim AS evento_data_fim, e.organizador_id,
    f.razao_social AS fornecedor_razao_social, f.nome AS fornecedor_nome
  FROM propostas p
  JOIN itens_custo i ON i.id = p.item_custo_id
  JOIN eventos e ON e.id = i.evento_id
  JOIN usuarios f ON f.id = p.fornecedor_id`;

async function findByIdComContexto(id, conn = pool) {
  const [rows] = await conn.query(`${CONTEXTO} WHERE p.id = ?`, [id]);
  return rows[0] ?? null;
}

async function findByItemEFornecedor(itemId, fornecedorId) {
  const [rows] = await pool.query(
    'SELECT id FROM propostas WHERE item_custo_id = ? AND fornecedor_id = ?',
    [itemId, fornecedorId]
  );
  return rows[0] ?? null;
}

async function insert(data, fornecedorId) {
  const [result] = await pool.query(
    `INSERT INTO propostas (item_custo_id, fornecedor_id, valor, descricao, validade, observacoes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [data.itemId, fornecedorId, data.valor, data.descricao, data.validade, data.observacoes ?? null]
  );
  return result.insertId;
}

async function update(id, data) {
  await pool.query(
    'UPDATE propostas SET valor = ?, descricao = ?, validade = ?, observacoes = ? WHERE id = ?',
    [data.valor, data.descricao, data.validade, data.observacoes ?? null, id]
  );
}

async function setStatus(id, status, conn = pool) {
  await conn.query('UPDATE propostas SET status = ? WHERE id = ?', [status, id]);
}

/** Libera a seleção anterior do item (dentro da mesma transação da nova seleção). */
async function liberarSelecaoDoItem(itemId, conn) {
  await conn.query(
    "UPDATE propostas SET status = 'enviada' WHERE item_custo_id = ? AND status = 'selecionada'",
    [itemId]
  );
}

/** Histórico do fornecedor com dados do item e do evento. */
async function findByFornecedor(fornecedorId) {
  const [rows] = await pool.query(
    `${CONTEXTO} WHERE p.fornecedor_id = ? ORDER BY p.created_at DESC, p.id DESC`,
    [fornecedorId]
  );
  return rows;
}

/** Propostas de um evento para comparação (exclui canceladas). */
async function findComparativoPorEvento(eventoId) {
  const [rows] = await pool.query(
    `SELECT p.id, p.item_custo_id, p.valor, p.descricao, p.validade, p.observacoes, p.status,
      f.razao_social AS fornecedor_razao_social, f.nome AS fornecedor_nome, f.area_atuacao
     FROM propostas p
     JOIN itens_custo i ON i.id = p.item_custo_id
     JOIN usuarios f ON f.id = p.fornecedor_id
     WHERE i.evento_id = ? AND p.status <> 'cancelada'
     ORDER BY p.item_custo_id, p.valor ASC, p.id ASC`,
    [eventoId]
  );
  return rows;
}

async function countSelecionadasNoItem(itemId) {
  const [[row]] = await pool.query(
    "SELECT COUNT(*) AS total FROM propostas WHERE item_custo_id = ? AND status = 'selecionada'",
    [itemId]
  );
  return Number(row.total);
}

async function countPorStatus() {
  const [rows] = await pool.query('SELECT status, COUNT(*) AS total FROM propostas GROUP BY status');
  return rows;
}

async function somaSelecionadas() {
  const [[row]] = await pool.query(
    "SELECT COALESCE(SUM(valor), 0) AS total FROM propostas WHERE status = 'selecionada'"
  );
  return Number(row.total);
}

module.exports = {
  findByIdComContexto,
  findByItemEFornecedor,
  insert,
  update,
  setStatus,
  liberarSelecaoDoItem,
  findByFornecedor,
  findComparativoPorEvento,
  countPorStatus,
  countSelecionadasNoItem,
  somaSelecionadas,
};
