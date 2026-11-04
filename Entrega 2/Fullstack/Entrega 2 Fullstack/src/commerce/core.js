'use strict';

const { randomUUID, randomBytes } = require('node:crypto');
const { pool, withTransaction } = require('../db');
const { HttpError } = require('../errors');
const uid = () => randomUUID();
const code = () => 'TT-' + randomBytes(24).toString('base64url');
const now = () => Date.now();
const endTime = event => Date.parse(event.data_fim.replace(' ', 'T') + '-03:00');
const text = (value, label, min = 1, max = 120) => {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) {
    throw new HttpError(400, `Preencha ${label} com ${min} a ${max} caracteres.`);
  }
  return value.trim();
};
const integer = (value, label, min, max) => {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new HttpError(400, `${label} deve estar entre ${min} e ${max}.`);
  return value;
};
async function rows(sql, params = [], db = pool) { return (await db.query(sql, params))[0]; }
async function one(sql, params = [], db = pool) { return (await rows(sql, params, db))[0] ?? null; }
async function settings(db = pool) { return JSON.parse((await one("SELECT value FROM commerce_meta WHERE id = 'regras'", [], db)).value); }
// Todas as operações financeiras usam a mesma ordem de bloqueio no banco.
const transact = work => withTransaction(async db => {
  await one("SELECT id FROM commerce_meta WHERE id = 'regras' FOR UPDATE", [], db);
  return work(db);
});
const audit = (db, user, action, resource, detail = '') => db.query(
  'INSERT INTO auditoria (id, usuario_id, acao, recurso, detalhe, criado_ms) VALUES (?, ?, ?, ?, ?, ?)',
  [uid(), user?.id ?? null, action, String(resource), String(detail).slice(0,500), now()]);
const notify = (db, userId, message) => db.query(
  'INSERT INTO notificacoes (id, usuario_id, texto, criado_ms) VALUES (?, ?, ?, ?)', [uid(), userId, message, now()]);
function requireRole(user, roles) {
  if (!roles.includes(user.perfil)) throw new HttpError(403, 'Seu perfil não tem acesso a esta operação.');
}
module.exports = { pool, uid, code, now, endTime, text, integer, rows, one, settings, transact, audit, notify, requireRole };
