'use strict';

require('dotenv').config();

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const isProduction = (process.env.NODE_ENV || 'development') === 'production';

const config = Object.freeze({
  demo: process.env.TROCATICKET_APRESENTACAO === '1' && !isProduction,
  env: process.env.NODE_ENV || 'development',
  port: toInt(process.env.PORT, 3000),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  auth: Object.freeze({
    // Em produção é obrigatório definir AUTH_SECRET (validado abaixo).
    secret: process.env.AUTH_SECRET || (isProduction ? '' : 'dev-only-troque-em-producao'),
    ttlSeconds: toInt(process.env.AUTH_TOKEN_TTL_HORAS, 8) * 3600,
  }),
  db: Object.freeze({
    host: process.env.DB_HOST || '127.0.0.1',
    port: toInt(process.env.DB_PORT, 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'trocaticket',
    connectionLimit: toInt(process.env.DB_POOL_LIMIT, 10),
  }),
});

if (isProduction && !config.auth.secret) {
  throw new Error('AUTH_SECRET é obrigatório em produção. Defina uma chave longa e aleatória.');
}

module.exports = config;
