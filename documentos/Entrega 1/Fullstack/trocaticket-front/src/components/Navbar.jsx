import { Link } from 'react-router-dom'

export default function Navbar() {
  return (
    <nav className="navbar">
      <Link to="/eventos" className="logo">Troca<span>Ticket</span></Link>
      <div className="navbar-links">
        <Link to="/eventos">Meus Eventos</Link>
        <Link to="/criar-evento">Criar Evento</Link>
        <Link to="/">Sair</Link>
      </div>
    </nav>
  )
}