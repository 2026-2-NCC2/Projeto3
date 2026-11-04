import { request } from './http.js';

const id = (value) => encodeURIComponent(value);

export const fornecedorApi = {
  oportunidades: (params = {}) => request('/fornecedor/oportunidades', { query: params }),
  oportunidade: (eventoId) => request(`/fornecedor/oportunidades/${id(eventoId)}`),
  propostas: () => request('/fornecedor/propostas'),
  enviarProposta: (itemId, data) => request(`/itens-custo/${id(itemId)}/propostas`, { method: 'POST', body: data }),
  atualizarProposta: (propostaId, data) => request(`/propostas/${id(propostaId)}`, { method: 'PUT', body: data }),
  cancelarProposta: (propostaId) => request(`/propostas/${id(propostaId)}/cancelar`, { method: 'POST' }),
};
