import { useAuth } from '../../context/AuthContext.jsx';

function Sidebar({ onLogout }) {
  const { logout } = useAuth()
  const handleLogout = onLogout || logout

  return (
    <header className="sidebar app-topbar">
      <div className="topbar-brand">
        <h2 className="h5 mb-1">Boutique</h2>
        <p className="small mb-0">Vue globale</p>
      </div>

      <nav className="nav topbar-nav">
        <a className="nav-link" href="/accueil">
          <span className="nav-icon">🏠</span>
          Accueil
        </a>
        <a className="nav-link" href="/statistique">
          <span className="nav-icon">📈</span>
          Statistique
        </a>
        <a className="nav-link" href="/commandes">
          <span className="nav-icon">🧾</span>
          Commandes
        </a>
        <a className="nav-link" href="/paniers">
          <span className="nav-icon">🧺</span>
          Paniers
        </a>
        <a className="nav-link" href="/stock">
          <span className="nav-icon">📦</span>
          Stock
        </a>
        <a className="nav-link" href="/produit">
          <span className="nav-icon">🧩</span>
          Produit
        </a>
        <a className="nav-link" href="/import">
          <span className="nav-icon">⬆️</span>
          Import
        </a>
        <a className="nav-link" href="/reset">
          <span className="nav-icon">♻️</span>
          Reset
        </a>
      </nav>

      <div className="topbar-actions">
        <button
          onClick={handleLogout}
          className="btn btn-outline-secondary d-flex align-items-center justify-content-center gap-2"
        >
          <span>🚪</span>
          Déconnexion
        </button>
      </div>
    </header>
  );
}

export default Sidebar;
