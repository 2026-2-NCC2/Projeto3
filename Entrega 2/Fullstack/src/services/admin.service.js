'use strict';

const usuarios = require('../repositories/usuario.repository');
const eventos = require('../repositories/evento.repository');
const propostas = require('../repositories/proposta.repository');
const { HttpError } = require('../errors');
const { validateDecisao } = require('../validators/usuario.validator');

async function listarUsuarios({ status, perfil, page, limit }) {
  const { rows, total } = await usuarios.findAll({ status, perfil, page, limit });
  return { data: rows, meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } };
}

/** Aprovação ou rejeição de cadastro (RF03), com registro de quem decidiu e quando. */
async function decidirCadastro(id, body, admin) {
  const { status } = validateDecisao(body);
  const alvo = await usuarios.findById(id);
  if (!alvo) throw new HttpError(404, 'Usuário não encontrado.');
  if (alvo.perfil === 'administrador') {
    throw new HttpError(409, 'Contas de administrador não passam por aprovação.');
  }
  await usuarios.setStatus(id, status, admin.id);
  const { pool,audit,notify } = require('../commerce/core');
  await audit(pool,admin,'decidir_cadastro',id,status);
  await notify(pool,id,status==='aprovado'?'Seu cadastro foi aprovado. Sua área de gestão já está disponível.':'Seu cadastro foi rejeitado. Consulte a administração.');
  return usuarios.findById(id);
}

async function listarEventos({ status, page, limit }) {
  const { rows, total } = await eventos.findAdminOverview({ status, page, limit });
  return { data: rows, meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } };
}

/** Indicadores gerenciais (RF14). */
async function resumo() {
  const [usuariosRows, eventosRows, propostasRows, selecionadas] = await Promise.all([
    usuarios.countPorPerfilStatus(),
    eventos.countPorStatus(),
    propostas.countPorStatus(),
    propostas.somaSelecionadas(),
  ]);

  const usuariosPorPerfil = {};
  usuariosRows.forEach((r) => {
    usuariosPorPerfil[r.perfil] ??= { pendente: 0, aprovado: 0, rejeitado: 0 };
    usuariosPorPerfil[r.perfil][r.status] = Number(r.total);
  });

  const porStatus = (linhas) => Object.fromEntries(linhas.map((r) => [r.status, Number(r.total)]));

  return {
    usuarios: usuariosPorPerfil,
    eventos: porStatus(eventosRows),
    propostas: porStatus(propostasRows),
    valor_total_propostas_selecionadas: selecionadas,
  };
}

module.exports = { listarUsuarios, decidirCadastro, listarEventos, resumo };
