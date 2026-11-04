import { Link, useNavigate } from 'react-router-dom'

export default function NecessidadesEvento() {
  const navigate = useNavigate();

  return (
    <div>
      <div className="flex-between">
        <div>
          <h1>Necessidades do Evento</h1>
          <p style={{ color: '#6c757d' }}>Festa Universitária 2026 • O que você precisa contratar?</p>
        </div>
        <button className="btn btn-secondary">+ Adicionar Rubrica</button>
      </div>

      <div className="card mt-2">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Categoria de Serviço</th>
                <th>Descrição Específica</th>
                <th>Orçamento Teto</th>
                <th>Status</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Iluminação e Som</strong></td>
                <td>Palco principal e pista, som para 2k pessoas</td>
                <td>R$ 15.000</td>
                <td><span style={{ color: 'orange', fontWeight: 'bold' }}>Sem propostas</span></td>
                <td><button className="btn" onClick={() => navigate('/fornecedores')}>Buscar Fornecedores</button></td>
              </tr>
              <tr>
                <td><strong>Segurança</strong></td>
                <td>Equipe de 20 seguranças credenciados</td>
                <td>R$ 8.000</td>
                <td><span style={{ color: '#0055ff', fontWeight: 'bold' }}>3 Propostas</span></td>
                <td><button className="btn" onClick={() => navigate('/comparar')}>Comparar Propostas</button></td>
              </tr>
              <tr>
                <td><strong>Bar e Bebidas</strong></td>
                <td>Open bar (Cerveja, Vodka, Água, Refri)</td>
                <td>R$ 25.000</td>
                <td><span style={{ color: '#28a745', fontWeight: 'bold' }}>Contratado</span></td>
                <td><button className="btn btn-secondary" disabled>Resolvido</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      
      <div style={{ textAlign: 'center' }}>
         <Link to="/eventos" className="btn btn-secondary">Voltar ao Painel</Link>
      </div>
    </div>
  )
}