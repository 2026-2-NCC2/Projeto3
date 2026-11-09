'use strict';

/**
 * Cria (ou mantém) a conta de administrador da TrocaTicket.
 * Uso:  ADMIN_EMAIL=admin@seudominio.com ADMIN_SENHA='SenhaForte1' npm run criar-admin
 * Idempotente: se o e-mail já existir, garante perfil administrador e status aprovado.
 */

require('dotenv').config();
const { hashPassword } = require('../src/auth/password');
const { pool, close } = require('../src/db');

async function main() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const senha = process.env.ADMIN_SENHA || '';
  if (!email || senha.length < 8 || !/[A-Za-z]/.test(senha) || !/\d/.test(senha)) {
    console.error('Defina ADMIN_EMAIL e ADMIN_SENHA (mínimo 8 caracteres, com letras e números).');
    process.exitCode = 1;
    return;
  }
  const senhaHash = await hashPassword(senha);
  await pool.query(
    `INSERT INTO usuarios (nome, email, senha_hash, perfil, status, aprovado_em)
     VALUES ('Administrador', ?, ?, 'administrador', 'aprovado', NOW())
     ON DUPLICATE KEY UPDATE perfil = 'administrador', status = 'aprovado', senha_hash = VALUES(senha_hash)`,
    [email, senhaHash]
  );
  console.log(`Administrador pronto: ${email}`);
}

main()
  .catch((err) => {
    console.error('Falha ao criar administrador:', err.message);
    process.exitCode = 1;
  })
  .finally(() => close());
