'use strict';

/** Converte valor monetário (número ou string decimal) em centavos inteiros. */
const toCents = (value) => Math.round(Number(value) * 100);

/** Converte centavos inteiros em número com 2 casas decimais (para JSON). */
const fromCents = (cents) => Math.round(cents) / 100;

module.exports = { toCents, fromCents };
