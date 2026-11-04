'use strict';

const crypto = require('crypto');

/** Assinatura HMAC-SHA256 (formato compatível com JWT HS256, sem dependências externas). */
const sign = (data, secret) => crypto.createHmac('sha256', secret).update(data).digest('base64url');

/**
 * Cria um token assinado com `sub` (id do usuário), `perfil`, `iat` e `exp`.
 */
function createToken(payload, secret, ttlSeconds) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ ...payload, iat: now, exp: now + ttlSeconds })).toString('base64url');
  return `${header}.${body}.${sign(`${header}.${body}`, secret)}`;
}

/**
 * Valida assinatura e expiração. Retorna o payload ou null.
 */
function verifyToken(token, secret, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [header, body, signature] = parts;
  const expected = Buffer.from(sign(`${header}.${body}`, secret));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) return null;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!payload.exp || payload.exp <= nowSeconds) return null;
  return payload;
}

module.exports = { createToken, verifyToken };
