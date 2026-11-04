'use strict';

/**
 * Erro com status HTTP e detalhes opcionais (ex.: lista de campos inválidos).
 */
class HttpError extends Error {
  /**
   * @param {number} status
   * @param {string} message
   * @param {Array<{field: string, message: string}>} [details]
   */
  constructor(status, message, details) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.details = details;
  }
}

/** Encaminha exceções de handlers async para o errorHandler (Express 4 não faz isso sozinho). */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Formato único de erro: { error: { status, message, details? } } */
function sendError(res, status, message, details) {
  return res.status(status).json({
    error: { status, message, ...(details ? { details } : {}) },
  });
}

/** Rota inexistente. */
function notFound(req, res) {
  sendError(res, 404, `Rota não encontrada: ${req.method} ${req.originalUrl}`);
}

/** Tratamento central de erros. Nunca expõe stack trace ao cliente. */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err instanceof HttpError) {
    return sendError(res, err.status, err.message, err.details);
  }
  if (err.type === 'entity.parse.failed') {
    return sendError(res, 400, 'Corpo da requisição não é um JSON válido.');
  }
  if (err.type === 'entity.too.large') {
    return sendError(res, 413, 'Corpo da requisição excede o limite permitido.');
  }
  if (['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'PROTOCOL_CONNECTION_LOST'].includes(err.code)) {
    return sendError(res, 503, 'Banco de dados indisponível no momento. Tente novamente.');
  }

  console.error('[erro interno]', err);
  return sendError(res, 500, 'Erro interno do servidor. Tente novamente mais tarde.');
}

module.exports = { HttpError, asyncHandler, notFound, errorHandler };
