/**
 * Serviço de API do organizador: eventos (CRUD), itens, custos, cotações, orçamento e ticket.
 */
import { request } from './http.js';

const id = (value) => encodeURIComponent(value);

export const eventosApi = {
  list: (params = {}) => request('/eventos', { query: params }),
  get: (eventoId) => request(`/eventos/${id(eventoId)}`),
  create: (data) => request('/eventos', { method: 'POST', body: data }),
  update: (eventoId, data) => request(`/eventos/${id(eventoId)}`, { method: 'PUT', body: data }),
  remove: (eventoId) => request(`/eventos/${id(eventoId)}`, { method: 'DELETE' }),
  publicar: (eventoId) => request(`/eventos/${id(eventoId)}/publicar`, { method: 'POST' }),
  cancelar: (eventoId) => request(`/eventos/${id(eventoId)}/cancelar`, { method: 'POST' }),

  listarItens: (eventoId) => request(`/eventos/${id(eventoId)}/itens-custo`),
  criarItem: (eventoId, data) => request(`/eventos/${id(eventoId)}/itens-custo`, { method: 'POST', body: data }),
  removerItem: (itemId) => request(`/itens-custo/${id(itemId)}`, { method: 'DELETE' }),

  listarCustos: (eventoId) => request(`/eventos/${id(eventoId)}/custos`),
  criarCusto: (eventoId, data) => request(`/eventos/${id(eventoId)}/custos`, { method: 'POST', body: data }),
  removerCusto: (custoId) => request(`/custos/${id(custoId)}`, { method: 'DELETE' }),

  cotacoes: (eventoId) => request(`/eventos/${id(eventoId)}/cotacoes`),
  selecionarProposta: (propostaId) => request(`/propostas/${id(propostaId)}/selecionar`, { method: 'POST' }),
  liberarProposta: (propostaId) => request(`/propostas/${id(propostaId)}/liberar`, { method: 'POST' }),

  orcamento: (eventoId) => request(`/eventos/${id(eventoId)}/orcamento`),
  ticket: (eventoId) => request(`/eventos/${id(eventoId)}/ticket`),
};
