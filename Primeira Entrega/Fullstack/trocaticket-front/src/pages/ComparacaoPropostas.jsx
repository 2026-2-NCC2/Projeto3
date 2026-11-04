import { Link, useNavigate } from 'react-router-dom'

export default function ComparacaoPropostas() {
  const navigate = useNavigate();

  return (
    <div>
      <h1>Comparação de Propostas</h1>
      <p style={{ marginBottom: '2rem' }}>Análise de cotações para o serviço de <strong>Segurança</strong>.</p>

      <div className="card">
        <div className="table-wrapper">
          <table className="table" style={{ textAlign: 'center' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Critérios</th>
                <th>Shield Seguranças (Fornecedor A)</th>
                <th>Guardian Eventos (Fornecedor B)</th>
                <th>Águia Segurança (Fornecedor C)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ textAlign: 'left', fontWeight: 'bold' }}>Valor Total da Proposta</td>
                <td style={{ color: '#28a745', fontWeight: 'bold', fontSize: '1.1rem' }}>R$ 7.200,00</td>
                <td style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>R$ 8.500,00</td>
                <td style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>R$ 7.800,00</td>
              </tr>
              <tr>
                <td style={{ textAlign: 'left', fontWeight: 'bold' }}>Avaliação Geral</td>
                <td>⭐⭐⭐⭐ (4.4)</td>
                <td>⭐⭐⭐⭐⭐ (4.9)</td>
                <td>⭐⭐⭐⭐ (4.6)</td>
              </tr>
              <tr>
                <td style={{ textAlign: 'left', fontWeight: 'bold' }}>Efetivo Fornecido</td>
                <td>20 Seguranças</td>
                <td>20 Seguranças + 2 Supervisores</td>
                <td>20 Seguranças</td>
              </tr>
              <tr>
                <td style={{ textAlign: 'left', fontWeight: 'bold' }}>Forma de Pagamento</td>
                <td>50% Sinal / 50% Final</td>
                <td>3x no Boleto</td>
                <td>À vista (10% desconto)</td>
              </tr>
              <tr>
                <td style={{ textAlign: 'left' }}>Ação</td>
                <td><button className="btn btn-success" onClick={() => { alert('Contrato Fechado com Sucesso!'); navigate('/necessidades'); }}>Contratar A</button></td>
                <td><button className="btn btn-success" onClick={() => { alert('Contrato Fechado com Sucesso!'); navigate('/necessidades'); }}>Contratar B</button></td>
                <td><button className="btn btn-success" onClick={() => { alert('Contrato Fechado com Sucesso!'); navigate('/necessidades'); }}>Contratar C</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      
      <div style={{ textAlign: 'center' }}>
        <Link to="/necessidades" className="btn btn-secondary">Voltar às Necessidades</Link>
      </div>
    </div>
  )
}