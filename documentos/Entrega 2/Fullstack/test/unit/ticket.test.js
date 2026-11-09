'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { calcularTicket, montarCenarios } = require('../../src/domain/ticket');

describe('Cálculo do ticket (RF13)', () => {
  test('ticket de equilíbrio = custo / público (arredonda para cima no centavo)', () => {
    // R$ 1.000,00 de custo para 300 pessoas = 3,3333... -> R$ 3,34
    const r = calcularTicket({ custoTotalCentavos: 100000, publico: 300, margemPercentual: 0 });
    assert.equal(r.equilibrioCentavos, 334);
    assert.equal(r.alvoCentavos, 334);
  });

  test('ticket-alvo = custo / [público × (1 − margem)]', () => {
    // R$ 1.000,00, público 100, margem 20% -> 1000 / (100 × 0,8) = R$ 12,50
    const r = calcularTicket({ custoTotalCentavos: 100000, publico: 100, margemPercentual: 20 });
    assert.equal(r.equilibrioCentavos, 1000);
    assert.equal(r.alvoCentavos, 1250);
  });

  test('a margem comprovada na receita: (receita − custo) / receita = margem', () => {
    const custo = 123456; // centavos
    const publico = 77;
    const margem = 33.33;
    const { alvoCentavos } = calcularTicket({ custoTotalCentavos: custo, publico, margemPercentual: margem });
    const receita = alvoCentavos * publico;
    const margemObtida = ((receita - custo) / receita) * 100;
    assert.ok(margemObtida >= margem, 'o ticket-alvo nunca deve ficar abaixo da margem pedida');
    assert.ok(margemObtida - margem < 0.5, 'a folga de arredondamento deve ser pequena');
  });

  test('custo zero gera ticket zero', () => {
    assert.deepEqual(calcularTicket({ custoTotalCentavos: 0, publico: 50, margemPercentual: 10 }), {
      equilibrioCentavos: 0,
      alvoCentavos: 0,
    });
  });

  test('rejeita público inválido e margem fora de [0, 99,99]', () => {
    assert.throws(() => calcularTicket({ custoTotalCentavos: 1, publico: 0 }), RangeError);
    assert.throws(() => calcularTicket({ custoTotalCentavos: 1, publico: 10.5 }), RangeError);
    assert.throws(() => calcularTicket({ custoTotalCentavos: 1, publico: 10, margemPercentual: 100 }), RangeError);
    assert.throws(() => calcularTicket({ custoTotalCentavos: 1, publico: 10, margemPercentual: -1 }), RangeError);
  });

  test('montarCenarios gera mínimo, esperado (opcional) e máximo', () => {
    const cenarios = montarCenarios({
      custoTotalCentavos: 100000,
      margemPercentual: 20,
      publicoMinimo: 50,
      publicoEsperado: 100,
      publicoMaximo: 200,
    });
    assert.deepEqual(
      cenarios.map((c) => c.cenario),
      ['minimo', 'esperado', 'maximo']
    );
    assert.equal(cenarios[0].ticket_alvo, 25);
    assert.equal(cenarios[1].ticket_alvo, 12.5);
    assert.equal(cenarios[2].ticket_alvo, 6.25);
  });

  test('montarCenarios omite o cenário esperado quando não informado', () => {
    const cenarios = montarCenarios({
      custoTotalCentavos: 100000,
      margemPercentual: 0,
      publicoMinimo: 50,
      publicoEsperado: null,
      publicoMaximo: 200,
    });
    assert.deepEqual(
      cenarios.map((c) => c.cenario),
      ['minimo', 'maximo']
    );
  });
});
