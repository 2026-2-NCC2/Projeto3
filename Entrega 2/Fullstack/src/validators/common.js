'use strict';

const { HttpError } = require('../errors');
const { isValidCnpj, normalizeCnpj } = require('../domain/cnpj');

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATETIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isRealDate = (y, m, d) => {
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
};

/** Data de hoje no fuso local, no formato AAAA-MM-DD. */
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Normaliza data/hora ("AAAA-MM-DD", "AAAA-MM-DDTHH:mm", "AAAA-MM-DD HH:mm:ss")
 * para "AAAA-MM-DD HH:mm:ss". Retorna null se inválida (inclui datas inexistentes, como 30/02).
 */
function normalizeDateTime(value) {
  if (typeof value !== 'string') return null;
  const match = DATETIME_PATTERN.exec(value.trim());
  if (!match) return null;
  const [, y, mo, d, h = '00', mi = '00', s = '00'] = match;
  const date = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
  const valid =
    date.getFullYear() === Number(y) &&
    date.getMonth() === Number(mo) - 1 &&
    date.getDate() === Number(d) &&
    date.getHours() === Number(h) &&
    date.getMinutes() === Number(mi);
  return valid ? `${y}-${mo}-${d} ${h}:${mi}:${s}` : null;
}

/**
 * Coletor de validações. Acumula todos os erros e lança um único 400 com a lista `details`.
 *
 * Modos:
 *   - create:  campos obrigatórios exigidos; opcionais recebem null (ou default)
 *   - replace: obrigatórios exigidos; opcionais ausentes não são alterados (PUT)
 *   - patch:   só valida o que foi enviado (PATCH)
 */
class Validator {
  constructor(input, mode = 'create', allowed = []) {
    if (input === null || typeof input !== 'object' || Array.isArray(input)) {
      throw new HttpError(400, 'O corpo da requisição deve ser um objeto JSON.');
    }
    this.input = input;
    this.mode = mode;
    this.errors = [];
    this.out = {};

    Object.keys(input).forEach((key) => {
      if (allowed.length && !allowed.includes(key)) {
        this.add(
          key,
          key === 'status'
            ? 'Para alterar o status use as ações específicas (publicar, cancelar, aprovar, selecionar).'
            : 'Campo não permitido.'
        );
      }
    });
    if (mode === 'patch' && Object.keys(input).length === 0) {
      this.add('body', 'Informe ao menos um campo para atualizar.');
    }
  }

  add(field, message) {
    this.errors.push({ field, message });
  }

  has(key) {
    return this.input[key] !== undefined;
  }

  missing(key) {
    if (this.mode !== 'patch') this.add(key, 'Campo obrigatório.');
  }

  /** Opcional ausente: null na criação, nada nas demais operações. */
  absentOptional(key, defaultValue = null) {
    if (this.mode === 'create') this.out[key] = defaultValue;
  }

  text(key, min, max, { optional = false } = {}) {
    if (!this.has(key)) return optional ? this.absentOptional(key) : this.missing(key);
    const raw = this.input[key];
    if (optional && (raw === null || raw === '')) return (this.out[key] = null);
    const value = typeof raw === 'string' ? raw.trim() : null;
    if (value === null || value.length < min || value.length > max) {
      return this.add(key, `Informe um texto entre ${min} e ${max} caracteres.`);
    }
    this.out[key] = value;
    return undefined;
  }

  integer(key, min, max, { optional = false } = {}) {
    if (!this.has(key)) return optional ? this.absentOptional(key) : this.missing(key);
    const raw = this.input[key];
    if (optional && (raw === null || raw === '')) return (this.out[key] = null);
    let n = null;
    if (typeof raw === 'number') n = raw;
    else if (typeof raw === 'string' && /^\d+$/.test(raw.trim())) n = Number(raw.trim());
    if (!Number.isSafeInteger(n) || n < min || n > max) {
      return this.add(key, `Informe um número inteiro entre ${min} e ${max}.`);
    }
    this.out[key] = n;
    return undefined;
  }

  /** Número com até 2 casas decimais. */
  decimal(key, min, max, { optional = false, defaultValue } = {}) {
    if (!this.has(key)) {
      if (optional) return this.absentOptional(key, defaultValue ?? null);
      return this.missing(key);
    }
    const raw = this.input[key];
    if (optional && (raw === null || raw === '')) return (this.out[key] = null);
    let n = null;
    if (typeof raw === 'number') n = raw;
    else if (typeof raw === 'string' && /^\d+(\.\d{1,2})?$/.test(raw.trim())) n = Number(raw.trim());
    const doisDecimais = n !== null && Math.round(n * 100) / 100 === n;
    if (n === null || !Number.isFinite(n) || n < min || n > max || !doisDecimais) {
      return this.add(key, `Informe um valor entre ${min} e ${max}, com até 2 casas decimais.`);
    }
    this.out[key] = n;
    return undefined;
  }

  datetime(key) {
    if (!this.has(key)) return this.missing(key);
    const value = normalizeDateTime(this.input[key]);
    if (!value) {
      return this.add(key, 'Use uma data e hora válidas no formato AAAA-MM-DD ou AAAA-MM-DDTHH:mm.');
    }
    this.out[key] = value;
    return undefined;
  }

  date(key, { naoPodeSerPassada = false } = {}) {
    if (!this.has(key)) return this.missing(key);
    const raw = typeof this.input[key] === 'string' ? this.input[key].trim() : '';
    const m = DATE_PATTERN.exec(raw);
    if (!m || !isRealDate(Number(m[1]), Number(m[2]), Number(m[3]))) {
      return this.add(key, 'Use uma data válida no formato AAAA-MM-DD.');
    }
    if (naoPodeSerPassada && raw < todayIso()) {
      return this.add(key, 'A data não pode estar no passado.');
    }
    this.out[key] = raw;
    return undefined;
  }

  enumField(key, valores, { optional = false } = {}) {
    if (!this.has(key)) return optional ? this.absentOptional(key) : this.missing(key);
    if (!valores.includes(this.input[key])) {
      return this.add(key, `Use um dos valores: ${valores.join(', ')}.`);
    }
    this.out[key] = this.input[key];
    return undefined;
  }

  email(key) {
    if (!this.has(key)) return this.missing(key);
    const value = typeof this.input[key] === 'string' ? this.input[key].trim().toLowerCase() : '';
    if (value.length > 160 || !EMAIL_PATTERN.test(value)) return this.add(key, 'Informe um e-mail válido.');
    this.out[key] = value;
    return undefined;
  }

  password(key) {
    if (!this.has(key)) return this.missing(key);
    const value = this.input[key];
    if (typeof value !== 'string' || value.length < 8 || value.length > 72) {
      return this.add(key, 'A senha deve ter entre 8 e 72 caracteres.');
    }
    if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) {
      return this.add(key, 'A senha deve conter pelo menos uma letra e um número.');
    }
    this.out[key] = value;
    return undefined;
  }

  cnpj(key) {
    if (!this.has(key)) return this.missing(key);
    if (!isValidCnpj(this.input[key])) return this.add(key, 'CNPJ inválido. Confira os dígitos.');
    this.out[key] = normalizeCnpj(this.input[key]);
    return undefined;
  }

  done() {
    if (this.errors.length) {
      throw new HttpError(400, 'Dados inválidos. Verifique os campos informados.', this.errors);
    }
    return this.out;
  }
}

/** Valida o identificador de rota (inteiro positivo). */
function parseId(raw) {
  const id = typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : null;
  if (!id || id > 2147483647) throw new HttpError(400, 'Identificador inválido. Use um inteiro positivo.');
  return id;
}

/** Paginação padrão usada pelas listagens. */
function parsePaging(query, { defaultLimit = 10, maxLimit = 100 } = {}) {
  const errors = [];
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? defaultLimit : Number(query.limit);
  if (!Number.isSafeInteger(page) || page < 1 || !/^\d+$/.test(String(query.page ?? '1'))) {
    errors.push({ field: 'page', message: 'Informe um inteiro maior ou igual a 1.' });
  }
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > maxLimit || !/^\d+$/.test(String(query.limit ?? '1'))) {
    errors.push({ field: 'limit', message: `Informe um inteiro entre 1 e ${maxLimit}.` });
  }
  if (errors.length) throw new HttpError(400, 'Parâmetros de consulta inválidos.', errors);
  return { page, limit };
}

module.exports = { Validator, parseId, parsePaging, normalizeDateTime, todayIso };
