import { Routes, Route, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import Login from './pages/Login'
import MeusEventos from './pages/MeusEventos'
import CriarEvento from './pages/CriarEvento'
import NecessidadesEvento from './pages/NecessidadesEvento'
import Fornecedores from './pages/Fornecedores'
import ComparacaoPropostas from './pages/ComparacaoPropostas'

function App() {
  const location = useLocation();
  const isLoginPage = location.pathname === '/';

  return (
    <div className="app-container">
      {!isLoginPage && <Navbar />}
      <main className="main-content" style={isLoginPage ? { display: 'flex', alignItems: 'center', justifyContent: 'center' } : {}}>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/eventos" element={<MeusEventos />} />
          <Route path="/criar-evento" element={<CriarEvento />} />
          <Route path="/necessidades" element={<NecessidadesEvento />} />
          <Route path="/fornecedores" element={<Fornecedores />} />
          <Route path="/comparar" element={<ComparacaoPropostas />} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}

export default App
