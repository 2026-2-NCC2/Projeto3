'use strict';

/** Mantém apenas os dígitos do CNPJ (aceita 00.000.000/0000-00 ou 00000000000000). */
const normalizeCnpj = (raw) => String(raw ?? '').replace(/\D/g, '');

/** Valida CNPJ pelos dígitos verificadores (módulo 11). */
function isValidCnpj(raw) {
  const cnpj = normalizeCnpj(raw);
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;

  const digito = (base, pesos) => {
    const soma = base.split('').reduce((acc, d, i) => acc + Number(d) * pesos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = digito(cnpj.slice(0, 12), pesos1);
  const d2 = digito(cnpj.slice(0, 12) + d1, pesos2);
  return d1 === Number(cnpj[12]) && d2 === Number(cnpj[13]);
}

module.exports = { normalizeCnpj, isValidCnpj };
