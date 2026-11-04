'use strict';

const mysql = require('mysql2/promise');
const config = require('./config');

const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: config.db.connectionLimit,
  queueLimit: 0,
  // DATE/DATETIME chegam como string 'YYYY-MM-DD HH:mm:ss' (sem conversão de fuso).
  // DECIMAL chega como string, que convertemos para número/centavos na camada de domínio.
  dateStrings: true,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
});

async function ping() {
  const connection = await pool.getConnection();
  try {
    await connection.query('SELECT 1 FROM usuarios, eventos, itens_custo, custos_evento, propostas, revendas LIMIT 0');
  } finally {
    connection.release();
  }
}

/**
 * Executa `fn(conn)` dentro de uma transação. Commit em sucesso, rollback em erro.
 * Usado nas operações que alteram mais de uma linha (ex.: trocar a proposta selecionada).
 */
async function withTransaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function close() {
  await pool.end();
}

module.exports = { pool, ping, withTransaction, close };
