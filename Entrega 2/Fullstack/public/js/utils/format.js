/** Constantes compartilhadas com o backend (mesmos valores do validator). */
export const STATUS_LABELS = Object.freeze({
  rascunho: 'Rascunho',
  publicado: 'Publicado',
  cancelado: 'Cancelado',
});

export const STATUS_VALUES = Object.freeze(Object.keys(STATUS_LABELS));

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escapa conteúdo antes de inserir em innerHTML (proteção contra XSS). */
export const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);

/**
 * Converte 'AAAA-MM-DD HH:mm:ss' (formato da API) para 'DD/MM/AAAA HH:mm' (exibição).
 * @returns {string}
 */
export function formatDateTime(value) {
  if (!value) return '—';
  const [date, time = '00:00:00'] = String(value).split(' ');
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year} ${time.slice(0, 5)}`;
}

/** Formata inteiros no padrão brasileiro (ex.: 1.250). */
export const formatNumber = (value) => new Intl.NumberFormat('pt-BR').format(Number(value) || 0);

/**
 * Converte 'AAAA-MM-DD HH:mm:ss' para o valor aceito por <input type="datetime-local">.
 * @returns {string} 'AAAA-MM-DDTHH:mm' ou ''
 */
export const toInputDateTime = (value) => (value ? String(value).replace(' ', 'T').slice(0, 16) : '');

/** Atrasa a execução até o usuário parar de digitar. */
export function debounce(fn, wait = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

/** 'AAAA-MM-DD' -> 'DD/MM/AAAA'. */
export const formatDate = (value) => {
  if (!value) return '—';
  const [y, m, d] = String(value).slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};

/** Valor em reais (pt-BR). Aceita número ou string decimal. */
export const formatBRL = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));
};

export const CATEGORIAS_ITEM = Object.freeze({
  iluminacao: 'Iluminação',
  alimentacao: 'Alimentação',
  bebida: 'Bebidas',
  seguranca: 'Segurança',
  infraestrutura: 'Infraestrutura',
  outros: 'Outros',
});

export const TIPOS_CUSTO = Object.freeze({ fiscal: 'Fiscal', operacional: 'Operacional', variavel: 'Variável' });

export const STATUS_PROPOSTA = Object.freeze({ enviada: 'Enviada', selecionada: 'Selecionada', cancelada: 'Cancelada' });
