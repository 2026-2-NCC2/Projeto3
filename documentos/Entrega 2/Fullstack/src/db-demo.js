'use strict';

const { DatabaseSync } = require('node:sqlite');
const { mkdirSync, readFileSync } = require('node:fs');
const { dirname, join, resolve } = require('node:path');
const { createHash } = require('node:crypto');

const file = resolve(process.env.DEMO_DB_PATH || join(__dirname, '..', '.dados', 'apresentacao.sqlite'));
mkdirSync(dirname(file), { recursive: true });
const database = new DatabaseSync(file);
database.exec('PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');

const execFile = filename => database.exec(readFileSync(join(__dirname, '..', 'db', filename), 'utf8'));
database.exec('BEGIN IMMEDIATE');
try {
  execFile('demo-schema.sql');
  if (!database.prepare('SELECT 1 FROM usuarios WHERE id = 1').get()) {
    execFile('demo-seed.sql');
    const insert = database.prepare(`
      INSERT INTO revendas (vendedor_id, comprador_id, evento, fim_evento, codigo, codigo_hash, valor_centavos, status)
      VALUES (8, ?, ?, datetime('now', '-3 hours', ?), ?, ?, ?, ?)`);
    for (const [buyer, event, offset, code, price, status] of [
      [null, 'Sunset Festival · Pista', '+30 days', 'DEMO-SUNSET-PISTA', 12000, 'publicado'],
      [null, 'Sunset Festival · Área VIP', '+30 days', 'DEMO-SUNSET-VIP', 20000, 'pendente'],
      [7, 'Noite Universitária · Pista', '-1 day', 'DEMO-NOITE-PISTA', 12000, 'retido'],
    ]) {
      insert.run(buyer, event, offset, code, createHash('sha256').update(code).digest('hex'), price, status);
    }
  }
  database.exec('COMMIT');
} catch (error) {
  database.exec('ROLLBACK');
  throw error;
}

function execute(sql, params = []) {
  const statement = database.prepare(sql
    .replace(/\s+FOR UPDATE\s*$/i, '')
    .replace(/\(UTC_TIMESTAMP\(\) - INTERVAL 3 HOUR\)/g, "datetime('now', '-3 hours')")
    .replace(/CAST\(\? AS DATETIME\)/g, 'datetime(?)')
    .replace(/\bNOW\(\)/g, "datetime('now', '-3 hours')")
    .replace(/ LIKE \?/g, " LIKE ? ESCAPE '\\'"));
  const values = params.map(value => typeof value === 'boolean' ? Number(value) : value);
  try {
    if (/^\s*SELECT\b/i.test(sql)) return [statement.all(...values)];
    const result = statement.run(...values);
    return [{ affectedRows: result.changes, insertId: result.lastInsertRowid }];
  } catch (error) {
    if ([1555, 2067].includes(error.errcode)) error.code = 'ER_DUP_ENTRY';
    throw error;
  }
}

// Serializa as consultas e mantém exclusividade durante uma transação inteira.
let queue = Promise.resolve();
function serial(work) {
  const result = queue.then(work);
  queue = result.catch(() => {});
  return result;
}
const query = (sql, params) => serial(() => execute(sql, params));
const pool = { query, execute: query };
const ping = () => query('SELECT 1 FROM usuarios, eventos, itens_custo, custos_evento, propostas, revendas LIMIT 0');
const close = () => serial(() => database.close());
const withTransaction = work => serial(async () => {
  database.exec('BEGIN IMMEDIATE');
  try {
    const result = await work({ query: execute, execute });
    database.exec('COMMIT');
    return result;
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
});

module.exports = { pool, ping, close, withTransaction };
