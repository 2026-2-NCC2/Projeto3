import { Link } from 'react-router-dom'

export default function Fornecedores() {
  return (
    <div>
      <h1>Busca de Fornecedores</h1>
      <p style={{ marginBottom: '2rem' }}>Filtrando especialistas em <strong>Iluminação e Som</strong> em São Paulo, SP.</p>

      <div className="grid">
        <div className="card">
          <h2>MegaSom Eventos</h2>
          <p>⭐⭐⭐⭐⭐ (4.8 / 120 avaliações)</p>
          <p><strong>Especialidade:</strong> Grandes shows e formaturas.</p>
          <p><strong>Local:</strong> São Paulo, SP (12km do evento)</p>
          <br/>
          <Link to="/comparar" className="btn btn-block">Solicitar Cotação</Link>
        </div>

        <div className="card">
          <h2>Luz & Cia Produções</h2>
          <p>⭐⭐⭐⭐ (4.5 / 85 avaliações)</p>
          <p><strong>Especialidade:</strong> Iluminação cênica e som corporativo.</p>
          <p><strong>Local:</strong> Guarulhos, SP (25km do evento)</p>
          <br/>
          <Link to="/comparar" className="btn btn-block">Solicitar Cotação</Link>
        </div>

        <div className="card">
          <h2>AudioTech Pro</h2>
          <p>⭐⭐⭐⭐⭐ (4.9 / 200 avaliações)</p>
          <p><strong>Especialidade:</strong> Equipamentos de ponta e painéis LED.</p>
          <p><strong>Local:</strong> São Bernardo, SP (18km do evento)</p>
          <br/>
          <Link to="/comparar" className="btn btn-block">Solicitar Cotação</Link>
        </div>
      </div>
      
      <div style={{ textAlign: 'center', marginTop: '1rem' }}>
        <Link to="/necessidades" className="btn btn-secondary">Voltar às Necessidades</Link>
      </div>
    </div>
  )
}