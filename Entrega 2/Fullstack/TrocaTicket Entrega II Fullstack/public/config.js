/*
 * Configuração do front-end.
 *
 * apiBaseUrl: URL base da API REST.
 *   - Mesma origem (padrão, quando o front é servido pelo próprio Express): '/api'
 *   - API em outro domínio (ex.: front na Netlify, API no Render):
 *       'https://trocaticket-api.onrender.com/api'
 *
 * requestTimeoutMs: tempo máximo de espera de cada requisição, em milissegundos.
 */
window.APP_CONFIG = {
  apiBaseUrl: '/api',
  requestTimeoutMs: 10000,
};
