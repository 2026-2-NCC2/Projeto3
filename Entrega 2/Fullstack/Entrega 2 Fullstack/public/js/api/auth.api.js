import { request } from './http.js';

export const authApi = {
  modo: () => request('/auth/modo', { auth: false }),
  loginDemo: (email, senha, perfil) => request('/auth/demonstracao', { method: 'POST', body: { email, senha, perfil }, auth: false }),
  login: (email, senha) => request('/auth/login', { method: 'POST', body: { email, senha }, auth: false }),
  cadastrarOrganizador: (data) => request('/auth/cadastro/organizador', { method: 'POST', body: data, auth: false }),
  cadastrarFornecedor: (data) => request('/auth/cadastro/fornecedor', { method: 'POST', body: data, auth: false }),
  me: () => request('/auth/me'),
};
