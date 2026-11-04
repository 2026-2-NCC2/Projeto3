/**
 * Cliente HTTP único do front-end: anexa o token, aplica timeout e padroniza erros.
 * Em 401 com sessão ativa, solicita renovação e mantém a rota.
 */
import { session } from '../session.js';

const settings = window.APP_CONFIG ?? {};
const BASE_URL = String(settings.apiBaseUrl ?? '/api').replace(/\/+$/, '');
const TIMEOUT_MS = Number(settings.requestTimeoutMs) || 10000;

export class ApiError extends Error {
  constructor(message, status = 0, details = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export async function request(path, { method = 'GET', body, query, auth = true } = {}) {
  const url = new URL(`${BASE_URL}${path}`, window.location.href);
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  });

  const headers = { Accept: 'application/json', 'X-Visitante': visitorId() };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = auth ? session.token() : null;
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') throw new ApiError('A API demorou demais para responder. Tente novamente.');
    throw new ApiError('Não foi possível conectar à API. Verifique a conexão e a URL em config.js.');
  }
  clearTimeout(timer);

  if (response.status === 204) return null;

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    if (response.status === 401 && token) {
      window.dispatchEvent(new CustomEvent('sessao-expirada'));
    }
    throw new ApiError(
      payload?.error?.message ?? `Erro ${response.status} ao comunicar com a API.`,
      response.status,
      payload?.error?.details ?? []
    );
  }
  return payload;
}

/** Monta uma mensagem única para o usuário a partir de um ApiError (inclui o primeiro detalhe). */
export function mensagemDeErro(err) {
  const primeiro = err.details?.[0]?.message;
  return primeiro && primeiro !== err.message ? `${err.message} ${primeiro}` : err.message;
}

export function visitorId() {
  let id=localStorage.getItem('trocaticket.visitante');
  if(!id){id=crypto.randomUUID();localStorage.setItem('trocaticket.visitante',id);}
  return id;
}
