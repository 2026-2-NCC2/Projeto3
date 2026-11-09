import { escapeHtml, toInputDateTime } from '../utils/format.js';
import { toast } from './toast.js';
import { mensagemDeErro } from '../api/http.js';

const MAX_PUBLICO = 10000000;

function field(name, label, control, { wide = false } = {}) {
  return `
    <div class="field${wide ? ' field-wide' : ''}">
      <label for="f-${name}">${label}</label>
      ${control}
      <small class="field-error" id="err-${name}" aria-live="polite"></small>
    </div>`;
}

/**
 * Formulário do evento (criação e edição). O status NÃO é editável aqui:
 * a publicação e o cancelamento são ações próprias da tela de detalhes.
 */
export function renderEventoFormFields(values = {}, { submitLabel = 'Salvar', cancelHref = '#/eventos' } = {}) {
  const v = {
    nome: '',
    descricao: '',
    local_evento: '',
    data_inicio: '',
    data_fim: '',
    publico_minimo: '',
    publico_maximo: '',
    publico_esperado: '',
    margem_lucro_percentual: '',
    ...values,
  };
  const margem = v.margem_lucro_percentual === '' || v.margem_lucro_percentual === null ? 0 : v.margem_lucro_percentual;

  return `
    <form id="evento-form" class="card form-grid" novalidate>
      ${field('nome', 'Nome do evento *',
        `<input id="f-nome" name="nome" type="text" maxlength="120" autocomplete="off" required value="${escapeHtml(v.nome)}" />`,
        { wide: true })}
      ${field('descricao', 'Descrição',
        `<textarea id="f-descricao" name="descricao" rows="4" maxlength="2000">${escapeHtml(v.descricao ?? '')}</textarea>`,
        { wide: true })}
      ${field('local_evento', 'Local *',
        `<input id="f-local_evento" name="local_evento" type="text" maxlength="200" autocomplete="off" required value="${escapeHtml(v.local_evento)}" />`,
        { wide: true })}
      ${field('data_inicio', 'Início *',
        `<input id="f-data_inicio" name="data_inicio" type="datetime-local" required value="${toInputDateTime(v.data_inicio)}" />`)}
      ${field('data_fim', 'Término *',
        `<input id="f-data_fim" name="data_fim" type="datetime-local" required value="${toInputDateTime(v.data_fim)}" />`)}
      ${field('publico_minimo', 'Público mínimo *',
        `<input id="f-publico_minimo" name="publico_minimo" type="number" min="0" step="1" inputmode="numeric" required value="${escapeHtml(v.publico_minimo)}" />`)}
      ${field('publico_maximo', 'Público máximo *',
        `<input id="f-publico_maximo" name="publico_maximo" type="number" min="1" step="1" inputmode="numeric" required value="${escapeHtml(v.publico_maximo)}" />`)}
      ${field('publico_esperado', 'Público esperado (opcional)',
        `<input id="f-publico_esperado" name="publico_esperado" type="number" min="1" step="1" inputmode="numeric" value="${escapeHtml(v.publico_esperado ?? '')}" />`)}
      ${field('margem_lucro_percentual', 'Margem de lucro (%) sobre a receita',
        `<input id="f-margem_lucro_percentual" name="margem_lucro_percentual" type="number" min="0" max="99.99" step="0.01" inputmode="decimal" value="${escapeHtml(margem)}" />`)}
      <div class="form-actions field-wide">
        <a class="btn btn-secondary" href="${escapeHtml(cancelHref)}">Cancelar</a>
        <button type="submit" class="btn btn-primary" id="submit-btn">${escapeHtml(submitLabel)}</button>
      </div>
    </form>`;
}

const CAMPOS = ['nome', 'descricao', 'local_evento', 'data_inicio', 'data_fim', 'publico_minimo', 'publico_maximo', 'publico_esperado', 'margem_lucro_percentual'];

export function readEventoForm(form) {
  const data = new FormData(form);
  return Object.fromEntries(CAMPOS.map((c) => [c, String(data.get(c) ?? '').trim()]));
}

const isInt = (t) => /^\d+$/.test(t);
const isMoney = (t) => /^\d+(\.\d{1,2})?$/.test(t);

/** Validação no cliente (espelha o servidor para feedback imediato). O servidor é a autoridade. */
export function validateEventoForm(raw) {
  const errors = {};
  const min = isInt(raw.publico_minimo) ? Number(raw.publico_minimo) : null;
  const max = isInt(raw.publico_maximo) ? Number(raw.publico_maximo) : null;
  const esperado = raw.publico_esperado === '' ? null : isInt(raw.publico_esperado) ? Number(raw.publico_esperado) : NaN;
  const margem = raw.margem_lucro_percentual === '' ? 0 : isMoney(raw.margem_lucro_percentual) ? Number(raw.margem_lucro_percentual) : NaN;

  if (raw.nome.length < 3 || raw.nome.length > 120) errors.nome = 'Informe um nome entre 3 e 120 caracteres.';
  if (raw.local_evento.length < 3 || raw.local_evento.length > 200) errors.local_evento = 'Informe um local entre 3 e 200 caracteres.';
  if (!raw.data_inicio) errors.data_inicio = 'Informe a data e a hora de início.';
  if (!raw.data_fim) errors.data_fim = 'Informe a data e a hora de término.';
  else if (raw.data_inicio && raw.data_fim < raw.data_inicio) errors.data_fim = 'O término deve ser igual ou posterior ao início.';
  if (min === null) errors.publico_minimo = 'Informe um número inteiro maior ou igual a zero.';
  if (max === null || max < 1 || max > MAX_PUBLICO) errors.publico_maximo = 'Informe um número inteiro entre 1 e 10.000.000.';
  else if (min !== null && max < min) errors.publico_maximo = 'O público máximo não pode ser menor que o mínimo.';
  if (Number.isNaN(esperado)) errors.publico_esperado = 'Informe um número inteiro positivo.';
  else if (esperado !== null && min !== null && max !== null && (esperado < min || esperado > max)) {
    errors.publico_esperado = 'Deve estar entre o público mínimo e o máximo.';
  }
  if (Number.isNaN(margem) || margem >= 100) errors.margem_lucro_percentual = 'Informe uma margem entre 0 e 99,99 (até 2 casas).';

  const payload = {
    nome: raw.nome,
    descricao: raw.descricao || null,
    local_evento: raw.local_evento,
    data_inicio: raw.data_inicio,
    data_fim: raw.data_fim,
    publico_minimo: min,
    publico_maximo: max,
    publico_esperado: esperado,
    margem_lucro_percentual: Number.isNaN(margem) ? 0 : margem,
  };
  return { errors, payload };
}

export function showFieldErrors(form, errors) {
  form.querySelectorAll('.field').forEach((el) => el.classList.remove('has-error'));
  form.querySelectorAll('.field-error').forEach((el) => {
    el.textContent = '';
  });
  Object.entries(errors).forEach(([name, message]) => {
    const messageEl = form.querySelector(`#err-${name}`);
    if (messageEl) messageEl.textContent = message;
    messageEl?.closest('.field')?.classList.add('has-error');
  });
  const [primeiro] = Object.keys(errors);
  if (primeiro) form.querySelector(`[name="${primeiro}"]`)?.focus();
}

export function bindEventoForm(form, onSubmit) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const { errors, payload } = validateEventoForm(readEventoForm(form));
    showFieldErrors(form, errors);
    if (Object.keys(errors).length) return;

    const btn = form.querySelector('#submit-btn');
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Salvando...';
    try {
      await onSubmit(payload);
    } catch (err) {
      if (err.details?.length) {
        showFieldErrors(form, Object.fromEntries(err.details.map((d) => [d.field, d.message])));
      }
      toast.error(mensagemDeErro(err));
    } finally {
      if (btn.isConnected) {
        btn.disabled = false;
        btn.textContent = original;
      }
    }
  });
}

