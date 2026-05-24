import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom'
import './App.css'
import Product from './pages/Product'
import Login from './pages/Login'
import Commandes from './pages/Commandes'
import Accueil from './pages/Accueil'
import AddCommande from './pages/AddCommande'
import { getCachedCustomer, clearCachedCustomer } from './services/auth'

function NavbarAuth() {
  const navigate = useNavigate()
  const [customer, setCustomer] = useState(() => getCachedCustomer()?.customer || null)

  useEffect(() => {
    const refresh = () => setCustomer(getCachedCustomer()?.customer || null)
    window.addEventListener('storage', refresh)
    window.addEventListener('ps_customer_changed', refresh)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener('ps_customer_changed', refresh)
    }
  }, [])

  if (!customer) {
    // return <Link to="/login" className="btn btn-outline-primary btn-sm">Se connecter</Link>
    return ''
  }

  const displayName = [customer.firstname, customer.lastname].filter(Boolean).join(' ') || customer.email
  const handleLogout = () => {
    clearCachedCustomer()
    navigate('/', { replace: true })
    window.location.reload()
  }

  return (
    <div className="d-flex align-items-center gap-2">
      <span className="small text-muted">{displayName}</span>
      <button type="button" className="btn btn-outline-secondary btn-sm" onClick={handleLogout}>
        Deconnexion
      </button>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <header className="site-header">
        <div className="container d-flex align-items-center justify-content-between">
          <Link to="/" className="brand">Ma Boutique</Link>
          <NavbarAuth />
          <Link to="/commandes" className="btn btn-outline-primary btn-sm">Mes Commandes</Link>
        </div>
      </header>

      <main className="container main-content">
        <Routes>
          <Route path="/" element={<Accueil />} />
          <Route path="/login" element={<Login />} />
          <Route path="/product" element={<Product />} />
          <Route path="/product/:id" element={<Product />} />
          <Route path="/commandes" element={<Commandes />} />
          <Route path="/addCommande/:id" element={<AddCommande />} />
        </Routes>
      </main>

      <footer className="site-footer">
        <div className="container">© {new Date().getFullYear()} Ma Boutique</div>
      </footer>
    </BrowserRouter>
  )
}

export default App
