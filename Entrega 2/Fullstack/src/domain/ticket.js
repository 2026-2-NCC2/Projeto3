'use strict';

/**
 * Cálculo do ticket (RF13) - função pura, sem acesso a banco.
 *
 *   Ticket de equilíbrio = Custo Total / Público
 *   Ticket-alvo          = Custo Total / [Público × (1 − Margem)]
 *
 * Margem definida sobre a receita: Margem = (Receita − Custo) / Receita.
 *
 * Critérios de arredondamento (documentados no README):
 *   - Cálculo em centavos inteiros, sem arredondamento intermediário.
 *   - Resultado sempre arredondado PARA CIMA no centavo (Math.ceil), para nunca precificar abaixo do custo.
 *   - A margem é convertida em basis points (1/100 de 1%), eliminando erro de ponto flutuante.
 */

const BP_PER_UNIT = 10000; // 100% = 10000 basis points

/**
 * @param {{custoTotalCentavos: number, publico: number, margemPercentual?: number}} params
 * @returns {{equilibrioCentavos: number, alvoCentavos: number}}
 */
function calcularTicket({ custoTotalCentavos, publico, margemPercentual = 0 }) {
  if (!Number.isInteger(publico) || publico <= 0) {
    throw new RangeError('O público deve ser um inteiro positivo.');
  }
  const margemBp = Math.round(Number(margemPercentual) * 100);
  if (!Number.isInteger(margemBp) || margemBp < 0 || margemBp >= BP_PER_UNIT) {
    throw new RangeError('A margem deve estar entre 0% e 99,99%.');
  }
  const custo = Math.max(0, Math.round(custoTotalCentavos));
  return {
    equilibrioCentavos: Math.ceil(custo / publico),
    alvoCentavos: Math.ceil((custo * BP_PER_UNIT) / (publico * (BP_PER_UNIT - margemBp))),
  };
}

/**
 * Gera os cenários de público (mínimo, esperado opcional e máximo).
 * @returns {Array<{cenario: string, publico: number, ticket_equilibrio: number, ticket_alvo: number}>}
 */
function montarCenarios({ custoTotalCentavos, margemPercentual, publicoMinimo, publicoEsperado, publicoMaximo }) {
  const candidatos = [
    ['minimo', publicoMinimo],
    ['esperado', publicoEsperado],
    ['maximo', publicoMaximo],
  ];
  return candidatos
    .filter(([, publico]) => publico !== null && publico !== undefined)
    .map(([cenario, publico]) => {
      const { equilibrioCentavos, alvoCentavos } = calcularTicket({
        custoTotalCentavos,
        publico,
        margemPercentual,
      });
      return {
        cenario,
        publico,
        ticket_equilibrio: equilibrioCentavos / 100,
        ticket_alvo: alvoCentavos / 100,
      };
    });
}

module.exports = { calcularTicket, montarCenarios, BP_PER_UNIT };
