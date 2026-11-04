'use strict';

const { pool } = require('../db');

const COLUNAS = `id, nome, email, perfil, status, telefone, razao_social, documento,
  area_atuacao, aprovado_por, aprovado_em, created_at`;

async function findById(id) {
  const [rows] = await pool.query(`SELECT ${COLUNAS} FROM usuarios WHERE id = ?`, [id]);
  return rows[0] ?? null;
}

/** Usado apenas no login: inclui o hash da senha. */
async function findByEmailComSenha(email) {
  const [rows] = await pool.query(
    'SELECT id, nome, email, senha_hash, perfil, status FROM usuarios WHERE email = ?',
    [email]
  );
  return rows[0] ?? null;
}

async function findByDocumento(documento) {
  const [rows] = await pool.query('SELECT id FROM usuarios WHERE documento = ?', [documento]);
  return rows[0] ?? null;
}

async function insert(data) {
  const [result] = await pool.query(
    `INSERT INTO usuarios (nome, email, senha_hash, perfil, status, telefone, razao_social, documento, area_atuacao)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.nome,
      data.email,
      data.senha_hash,
      data.perfil,
      data.status,
      data.telefone,
      data.razao_social,
      data.documento,
      data.area_atuacao,
    ]
  );
  return result.insertId;
}

async function findAll({ status, perfil, page, limit }) {
  const where = [];
  const params = [];
  if (status) {
    where.push('status = ?');
    params.push(status);
  }
  if (perfil) {
    where.push('perfil = ?');
    params.push(perfil);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM usuarios ${clause}`, params);
  const [rows] = await pool.query(
    `SELECT ${COLUNAS} FROM usuarios ${clause} ORDER BY created_at ASC, id ASC LIMIT ? OFFSET ?`,
    [...params, limit, (page - 1) * limit]
  );
  return { rows, total: Number(total) };
}

/** Registra a decisão e quem decidiu (rastreabilidade mínima das aprovações). */
async function setStatus(id, status, adminId) {
  await pool.query('UPDATE usuarios SET status = ?, aprovado_por = ?, aprovado_em = NOW() WHERE id = ?', [
    status,
    adminId,
    id,
  ]);
}

async function countPorPerfilStatus() {
  const [rows] = await pool.query(
    'SELECT perfil, status, COUNT(*) AS total FROM usuarios GROUP BY perfil, status'
  );
  return rows;
}

module.exports = { findById, findByEmailComSenha, findByDocumento, insert, findAll, setStatus, countPorPerfilStatus };
