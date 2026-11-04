'use strict';

const { pool } = require('../db');

const SELECT = `SELECT e.id, e.organizador_id, u.nome AS organizador_nome, e.nome, e.descricao,
  e.local_evento, e.data_inicio, e.data_fim, e.publico_minimo, e.publico_maximo, e.publico_esperado,
  e.margem_lucro_percentual, e.status, e.created_at, e.updated_at
  FROM eventos e JOIN usuarios u ON u.id = e.organizador_id`;

const ORDENACOES = {
  data_inicio: 'e.data_inicio',
  nome: 'e.nome',
  publico_maximo: 'e.publico_maximo',
  created_at: 'e.created_at',
};

const escapeLike = (texto) => texto.replace(/[\\%_]/g, '\\$&');

/**
 * Lista eventos. `organizadorId` restringe ao dono (perfil organizador);
 * null lista todos (perfil administrador). Valores sempre parametrizados.
 */
async function findAll({ organizadorId, status, q, sortBy, sortDir, page, limit }) {
  const where = [];
  const params = [];
  if (organizadorId) {
    where.push('e.organizador_id = ?');
    params.push(organizadorId);
  }
  if (status) {
    where.push('e.status = ?');
    params.push(status);
  }
  if (q) {
    where.push('(e.nome LIKE ? OR e.local_evento LIKE ?)');
    const like = `%${escapeLike(q)}%`;
    params.push(like, like);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const coluna = ORDENACOES[sortBy] ?? ORDENACOES.data_inicio;
  const direcao = sortDir === 'desc' ? 'DESC' : 'ASC';

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM eventos e ${clause}`,
    params
  );
  const [rows] = await pool.query(
    `${SELECT} ${clause} ORDER BY ${coluna} ${direcao}, e.id ASC LIMIT ? OFFSET ?`,
    [...params, limit, (page - 1) * limit]
  );
  return { rows, total: Number(total) };
}

async function findById(id) {
  const [rows] = await pool.query(`${SELECT} WHERE e.id = ?`, [id]);
  return rows[0] ?? null;
}

const CAMPOS_ESCRITA = [
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

async function insert(data, organizadorId) {
  const colunas = ['organizador_id', ...CAMPOS_ESCRITA, 'status'];
  const valores = [organizadorId, ...CAMPOS_ESCRITA.map((c) => data[c] ?? null), 'rascunho'];
  const [result] = await pool.query(
    `INSERT INTO eventos (${colunas.join(', ')}) VALUES (${colunas.map(() => '?').join(', ')})`,
    valores
  );
  return result.insertId;
}

async function update(id, data) {
  const sets = CAMPOS_ESCRITA.map((c) => `${c} = ?`).join(', ');
  await pool.query(`UPDATE eventos SET ${sets} WHERE id = ?`, [
    ...CAMPOS_ESCRITA.map((c) => data[c] ?? null),
    id,
  ]);
}

async function setStatus(id, status) {
  await pool.query('UPDATE eventos SET status = ? WHERE id = ?', [status, id]);
}

async function remove(id) {
  const [result] = await pool.query('DELETE FROM eventos WHERE id = ?', [id]);
  return result.affectedRows > 0;
}

/** Visão administrativa (RF14): eventos com contagens de itens, propostas e seleções. */
async function findAdminOverview({ status, page, limit }) {
  const params = [];
  const clause = status ? 'WHERE e.status = ?' : '';
  if (status) params.push(status);
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM eventos e ${clause}`, params);
  const [rows] = await pool.query(
    `SELECT e.id, e.nome, e.status, e.data_inicio, u.nome AS organizador_nome,
      (SELECT COUNT(*) FROM itens_custo i WHERE i.evento_id = e.id) AS itens,
      (SELECT COUNT(*) FROM propostas p JOIN itens_custo i ON i.id = p.item_custo_id
        WHERE i.evento_id = e.id AND p.status <> 'cancelada') AS propostas,
      (SELECT COUNT(*) FROM propostas p JOIN itens_custo i ON i.id = p.item_custo_id
        WHERE i.evento_id = e.id AND p.status = 'selecionada') AS itens_cotados
     FROM eventos e JOIN usuarios u ON u.id = e.organizador_id
     ${clause} ORDER BY e.data_inicio ASC, e.id ASC LIMIT ? OFFSET ?`,
    [...params, limit, (page - 1) * limit]
  );
  return { rows, total: Number(total) };
}

/** Contagem de eventos por status (indicadores do administrador). */
async function countPorStatus() {
  const [rows] = await pool.query("SELECT status, COUNT(*) AS total FROM eventos GROUP BY status");
  return rows;
}

/** Oportunidades visíveis ao fornecedor: publicadas e ainda não encerradas. */
async function findOportunidades({ fornecedorId, q, page, limit }) {
  const params = [fornecedorId];
  let filtroBusca = '';
  if (q) {
    filtroBusca = 'AND (e.nome LIKE ? OR e.local_evento LIKE ?)';
    const like = `%${escapeLike(q)}%`;
    params.push(like, like);
  }
  const base = `FROM eventos e
    WHERE e.status = 'publicado' AND e.data_fim >= NOW() ${filtroBusca}`;
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total ${base}`, params.slice(1));
  const [rows] = await pool.query(
    `SELECT e.id, e.nome, e.local_evento, e.data_inicio, e.data_fim, e.publico_minimo, e.publico_maximo,
      (SELECT COUNT(*) FROM itens_custo i WHERE i.evento_id = e.id) AS itens,
      (SELECT COUNT(*) FROM propostas p JOIN itens_custo i ON i.id = p.item_custo_id
        WHERE i.evento_id = e.id AND p.fornecedor_id = ? AND p.status <> 'cancelada') AS minhas_propostas
     ${base} ORDER BY e.data_inicio ASC, e.id ASC LIMIT ? OFFSET ?`,
    [...params, limit, (page - 1) * limit]
  );
  return { rows, total: Number(total) };
}

/** Evento visível ao fornecedor (publicado e não encerrado). */
async function findOportunidadeById(id) {
  const [rows] = await pool.query(
    `SELECT e.id, e.nome, e.descricao, e.local_evento, e.data_inicio, e.data_fim,
      e.publico_minimo, e.publico_maximo
     FROM eventos e WHERE e.id = ? AND e.status = 'publicado' AND e.data_fim >= NOW()`,
    [id]
  );
  return rows[0] ?? null;
}

module.exports = {
  findAll,
  findById,
  insert,
  update,
  setStatus,
  remove,
  findAdminOverview,
  countPorStatus,
  findOportunidades,
  findOportunidadeById,
};
