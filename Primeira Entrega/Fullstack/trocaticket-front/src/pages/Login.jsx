import { Link, useNavigate } from 'react-router-dom'

export default function Login() {
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    navigate('/eventos');
  };

  return (
    <div className="card" style={{ maxWidth: '400px', width: '100%', textAlign: 'center' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Troca<span style={{ color: '#0055ff' }}>Ticket</span></h1>
      <p style={{ color: '#6c757d', marginBottom: '2rem' }}>O ecossistema inteligente para eventos</p>
      
      <form onSubmit={handleLogin}>
        <div className="form-group" style={{ textAlign: 'left' }}>
          <label>E-mail Corporativo</label>
          <input type="email" placeholder="organizador@email.com" required defaultValue="luigi@trocaticket.com" />
        </div>
        <div className="form-group" style={{ textAlign: 'left' }}>
          <label>Senha</label>
          <input type="password" placeholder="••••••••" required defaultValue="123456" />
        </div>
        <button type="submit" className="btn btn-block mt-2">Entrar na Plataforma</button>
      </form>
    </div>
  )
}