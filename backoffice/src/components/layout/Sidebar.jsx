import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';

function Sidebar({ onLogout }) {
  const [open, setOpen] = useState({ commandes: false, catalogue: false, configuration: false })
  const { logout } = useAuth()
  const handleLogout = onLogout || logout

  return (
    <aside className="sidebar bg-dark text-white d-flex flex-column">
      <div className="px-4 py-4 border-bottom border-secondary">
        <h2 className="h5 mb-1">Boutique</h2>
        <p className="small text-secondary mb-0">Vue globale</p>
      </div>

      <nav className="nav flex-column px-3 py-3 gap-1">
          <div className="px-3 py-3 sidebar-section">
            <div className="section-title small text-uppercase text-secondary mb-2">Bienvenue</div>
            <nav className="nav flex-column gap-1">
              <a className="nav-link active" href="/">
                <span className="nav-icon">🏠</span>
                Accueil
              </a>
              <a className="nav-link" href="/dashboard">
                <span className="nav-icon">📊</span>
                Tableau de bord
              </a>
              <a className="nav-link" href="/statistique">
                <span className="nav-icon">📈</span>
                Statistique
              </a>
            </nav>
          </div>

          <div className="px-3 py-3 sidebar-section">
            <div className="section-title small text-uppercase text-secondary mb-2">Vendre</div>
            <nav className="nav flex-column gap-1">
              <button
                type="button"
                className="nav-link d-flex justify-content-between align-items-center"
                onClick={() => setOpen((s) => ({ ...s, commandes: !s.commandes }))}
              >
                <span>
                  <span className="nav-icon">🧾</span>
                  Commandes
                </span>
                <span className="chev">{open.commandes ? '▾' : '▸'}</span>
              </button>

              {open.commandes && (
                <div className="nav-sublist ms-3 mt-1">
                  <a className="nav-link small" href="/commandes">Commandes</a>
                  {/* <a className="nav-link small" href="/factures">Factures</a>
                  <a className="nav-link small" href="/avoirs">Avoirs</a>
                  <a className="nav-link small" href="/bons-livraison">Bons de livraison</a> */}
                  <a className="nav-link small" href="/paniers">Paniers</a>
                  <a className="nav-link small" href="/stock">Stock</a>
                </div>
              )}

              <button
                type="button"
                className="nav-link d-flex justify-content-between align-items-center"
                onClick={() => setOpen((s) => ({ ...s, catalogue: !s.catalogue }))}
              >
                <span>
                  <span className="nav-icon">🧾</span>
                  Catalogue
                </span>
                <span className="chev">{open.catalogue ? '▾' : '▸'}</span>
              </button>

              {open.catalogue && (
                <div className="nav-sublist ms-3 mt-1">
                  <a className="nav-link small" href="/produit">Produit</a>
                </div>
              )}
            </nav>
          </div>

          <div className="px-3 py-3 sidebar-section">
            <div className="section-title small text-uppercase text-secondary mb-2">Configuration</div>
            <nav className="nav flex-column gap-1">
              <button
                type="button"
                className="nav-link d-flex justify-content-between align-items-center"
                onClick={() => setOpen((s) => ({ ...s, configuration: !s.configuration }))}
              >
                <span>
                  <span className="nav-icon">🧾</span>
                  Configuration
                </span>
                <span className="chev">{open.configuration ? '▾' : '▸'}</span>
              </button>

              {open.configuration && (
                <div className="nav-sublist ms-3 mt-1">
                  <a className="nav-link small" href="/">Parametre</a>
                  <a className="nav-link small" href="/import">Import</a>
                  <a className="nav-link small" href="/reset">Reset</a>
                </div>
              )}
            </nav>
          </div>
      </nav>

      <div className="px-4 py-4 border-top border-secondary mt-auto">
        <button 
          onClick={handleLogout}
          className="btn btn-outline-danger w-100 d-flex align-items-center justify-content-center gap-2"
        >
          <span>🚪</span>
          Déconnexion
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
