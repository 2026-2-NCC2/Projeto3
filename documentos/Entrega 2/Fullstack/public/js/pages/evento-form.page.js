import { eventosApi } from '../api/eventos.api.js';
import { renderEventoFormFields, bindEventoForm } from '../components/evento-form.js';
import { renderLoading, renderError } from '../components/state-view.js';
import { toast } from '../components/toast.js';
import { navigate } from '../router.js';

/** Tela de criação: POST /api/eventos. */
export function renderCreatePage() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <section class="page-header">
      <div>
        <h1>Novo evento</h1>
        <p class="muted">Preencha os dados de planejamento. Campos com * são obrigatórios.</p>
      </div>
    </section>
    ${renderEventoFormFields({}, { submitLabel: 'Criar evento', cancelHref: '#/eventos' })}`;

  bindEventoForm(document.getElementById('evento-form'), async (payload) => {
    const created = await eventosApi.create(payload);
    toast.success('Evento criado com sucesso.');
    navigate(`/eventos/${created.id}`);
  });
}

/** Tela de edição: GET para carregar, PUT para salvar. */
export async function renderEditPage({ id }) {
  const app = document.getElementById('app');
  app.innerHTML = `
    <section class="page-header">
      <div>
        <h1>Editar evento</h1>
        <p class="muted">Altere os dados e salve. As alterações são gravadas no MySQL.</p>
      </div>
    </section>
    <div id="edit-slot">${renderLoading('Carregando evento...')}</div>`;

  const slot = document.getElementById('edit-slot');

  const loadForm = async () => {
    slot.innerHTML = renderLoading('Carregando evento...');
    try {
      const evento = await eventosApi.get(id);
      if (!slot.isConnected) return;

      slot.innerHTML = renderEventoFormFields(evento, {
        submitLabel: 'Salvar alterações',
        cancelHref: `#/eventos/${id}`,
      });

      bindEventoForm(document.getElementById('evento-form'), async (payload) => {
        await eventosApi.update(id, payload);
        toast.success('Evento atualizado com sucesso.');
        navigate(`/eventos/${id}`);
      });
    } catch (err) {
      if (!slot.isConnected) return;
      slot.innerHTML = renderError(err.message, 'retry-edit');
      document.getElementById('retry-edit').addEventListener('click', loadForm);
    }
  };

  loadForm();
}
