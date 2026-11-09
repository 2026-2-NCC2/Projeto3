import { request } from './http.js';

export const adminApi = {
  usuarios: (params = {}) => request('/admin/usuarios', { query: params }),
  decidirUsuario: (userId, status) => request(`/admin/usuarios/${encodeURIComponent(userId)}/status`, { method: 'PATCH', body: { status } }),
  eventos: (params = {}) => request('/admin/eventos', { query: params }),
  resumo: () => request('/admin/relatorios/resumo'),
};
