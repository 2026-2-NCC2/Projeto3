'use strict';

const crypto = require('crypto');
const { promisify } = require('util');

const scrypt = promisify(crypto.scrypt);
const KEY_LENGTH = 64;

/**
 * Gera hash da senha com scrypt (função de derivação com custo e sal aleatório).
 * Formato armazenado: scrypt$<salt-hex>$<hash-hex>. Nunca guardamos a senha em texto puro.
 */
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = await scrypt(password, salt, KEY_LENGTH);
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

/** Compara a senha informada com o hash armazenado em tempo constante. */
async function verifyPassword(password, stored) {
  const [algorithm, salt, hashHex] = String(stored ?? '').split('$');
  if (algorithm !== 'scrypt' || !salt || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scrypt(password, salt, expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

module.exports = { hashPassword, verifyPassword };
