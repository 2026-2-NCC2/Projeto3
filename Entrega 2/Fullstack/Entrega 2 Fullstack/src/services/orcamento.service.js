'use strict';

const financeiro = require('../repositories/financeiro.repository');
const eventoService = require('./evento.service');
const { montarCenarios } = require('../domain/ticket');
const { fromCents, toCents } = require('../domain/money');

/**
 * Consolidação do orçamento (RF12): custos das propostas selecionadas + custos do evento.
 * Itens sem proposta selecionada geram pendências e deixam o orçamento incompleto.
 */
async function montar(eventoId, user) {
  const evento = await eventoService.getAutorizado(eventoId, user);
  const itensRows = await financeiro.findItensComSelecao(eventoId);
  const custosRows = await financeiro.findCustosByEvento(eventoId);

  const itens = itensRows.map((i) => {
    const centavos = i.proposta_id ? toCents(i.proposta_valor) : 0;
    return {
      id: i.id,
      nome: i.nome,
      categoria: i.categoria,
      proposta_id: i.proposta_id ?? null,
      fornecedor: i.proposta_id ? i.fornecedor_razao_social || i.fornecedor_nome : null,
      valor: i.proposta_id ? fromCents(centavos) : null,
      valor_centavos: centavos,
    };
  });

  const custos = custosRows.map((c) => ({
    id: c.id,
    descricao: c.descricao,
    tipo: c.tipo,
    valor: Number(c.valor),
    valor_centavos: toCents(c.valor),
  }));

  const itensCentavos = itens.reduce((s, i) => s + i.valor_centavos, 0);
  const custosCentavos = custos.reduce((s, c) => s + c.valor_centavos, 0);
  const totalCentavos = itensCentavos + custosCentavos;

  const pendencias = [];
  if (itens.length === 0) pendencias.push('Nenhum item de composição de custo cadastrado.');
  itens
    .filter((i) => i.proposta_id === null)
    .forEach((i) => pendencias.push(`O item "${i.nome}" ainda não tem proposta selecionada.`));

  return {
    evento,
    itens,
    custos,
    totais: {
      itens: fromCents(itensCentavos),
      custos: fromCents(custosCentavos),
      total: fromCents(totalCentavos),
      total_centavos: totalCentavos,
    },
    pendencias,
    completo: pendencias.length === 0,
  };
}

/** Orçamento consolidado (RF12). É o mesmo resultado de montar(). */
const orcamento = montar;

/**
 * Ticket estimado (RF13). Fórmulas e critérios de arredondamento estão em src/domain/ticket.js.
 */
async function ticket(eventoId, user) {
  const orc = await montar(eventoId, user);
  const { evento } = orc;

  const cenarios = montarCenarios({
    custoTotalCentavos: orc.totais.total_centavos,
    margemPercentual: evento.margem_lucro_percentual,
    publicoMinimo: evento.publico_minimo,
    publicoEsperado: evento.publico_esperado,
    publicoMaximo: evento.publico_maximo,
  });

  return {
    evento: { id: evento.id, nome: evento.nome, status: evento.status },
    custo_total: orc.totais.total,
    margem_lucro_percentual: evento.margem_lucro_percentual,
    formulas: {
      ticket_de_equilibrio: 'Ticket de equilíbrio = Custo Total / Público',
      ticket_alvo: 'Ticket-alvo = Custo Total / [Público × (1 − Margem)]',
      margem: 'Margem definida sobre a receita: (Receita − Custo) / Receita',
    },
    arredondamento: 'Resultados arredondados para cima, no centavo, para não precificar abaixo do custo.',
    cenarios,
    completo: orc.completo,
    aviso: orc.completo ? null : 'Cálculo parcial: há itens sem proposta selecionada.',
    pendencias: orc.pendencias,
  };
}

module.exports = { montar, orcamento, ticket };
