import { Link } from 'react-router-dom'

export default function MeusEventos() {
  return (
    <div>
      <div className="flex-between">
        <h1>Meus Eventos</h1>
        <Link to="/criar-evento" className="btn">+ Novo Evento</Link>
      </div>
      <p style={{ marginBottom: '2rem', color: '#6c757d' }}>Gerencie seus eventos e acompanhe as contratações em andamento.</p>

      <div className="grid">
        <div className="card">
          <span className="badge">Em Planejamento</span>
          <h2>Festa Universitária 2026</h2>
          <p><strong>Data:</strong> 15 de Novembro, 2026</p>
          <p><strong>Público:</strong> 2.000 pessoas</p>
          <p style={{ marginBottom: '1.5rem' }}><strong>Status:</strong> Aguardando Fornecedores</p>
          <Link to="/necessidades" className="btn btn-block btn-secondary">Gerenciar Necessidades</Link>
        </div>

        <div className="card">
          <span className="badge" style={{background: '#e6f4ea', color: '#28a745'}}>Confirmado</span>
          <h2>Congresso de Tecnologia FECAP</h2>
          <p><strong>Data:</strong> 10 de Dezembro, 2026</p>
          <p><strong>Público:</strong> 500 pessoas</p>
          <p style={{ marginBottom: '1.5rem' }}><strong>Status:</strong> Fornecedores Contratados</p>
          <button className="btn btn-block" disabled style={{ background: '#ccc', cursor: 'not-allowed'}}>Visualizar Painel</button>
        </div>
      </div>
    </div>
  )
}