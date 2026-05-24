import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
} from 'react-router-dom'
import Accueil from './components/Accueil.jsx'
import Stock from './components/commandes/Stock.jsx'
import Paniers from './components/commandes/Paniers.jsx'
import Commandes from './components/commandes/Commandes.jsx'
import CommandeDetails from './components/commandes/CommandeDetails.jsx'
import Import from './components/configuration/Import.jsx'
import Reset from './components/configuration/Reset.jsx'
import Produit from './components/catalogues/Produit.jsx'
import LoginPage from './context/LoginContext.jsx'
import Statistique from './components/Statistique.jsx'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'

function RequireAuth() {
  const { isAuthenticated } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  return <Outlet />
}

export function RootRouter() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            {/* Commandes et details */}
            <Route path="/" element={<Navigate to="/accueil" replace />} />
            <Route path="/statistique" element={<Statistique />} />
            <Route path="/accueil" element={<Accueil />} />
            <Route path="/stock" element={<Stock />} />
            <Route path="/paniers" element={<Paniers />} />
            <Route path="/commandes" element={<Commandes />} />
            <Route path="/commandes/:id" element={<CommandeDetails />} />

            {/* Catalogue */}
            <Route path="/produit" element={<Produit />} />

            {/* Configurations */}
            <Route path="/import" element={<Import />} />
            <Route path="/reset" element={<Reset />} />

            <Route path="*" element={<Navigate to="/accueil" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </Router>
  )
}

export default RootRouter

