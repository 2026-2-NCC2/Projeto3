import { useNavigate } from 'react-router-dom'

export default function CriarEvento() {
  const navigate = useNavigate();

  const handleSave = (e) => {
    e.preventDefault();
    navigate('/necessidades');
  };

  return (
    <div className="card" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h1>Detalhes do Novo Evento</h1>
      <p style={{ marginBottom: '2rem' }}>Preencha os dados base para que os fornecedores entendam a dimensão do seu evento.</p>
      
      <form onSubmit={handleSave}>
        <div className="grid">
          <div className="form-group">
            <label>Nome do Evento</label>
            <input type="text" placeholder="Ex: Baile de Formatura 2026" required />
          </div>
          <div className="form-group">
            <label>Data Prevista</label>
            <input type="date" required />
          </div>
          <div className="form-group">
            <label>Estimativa de Público</label>
            <input type="number" placeholder="Ex: 1500" required />
          </div>
          <div className="form-group">
            <label>Orçamento Base (R$)</label>
            <input type="number" placeholder="Ex: 50000" />
          </div>
        </div>
        <div className="form-group">
          <label>Localização (Cidade/Estado)</label>
          <input type="text" placeholder="Ex: São Paulo, SP" required />
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/eventos')}>Cancelar</button>
          <button type="submit" className="btn">Salvar e Adicionar Necessidades ➔</button>
        </div>
      </form>
    </div>
  )
}