import { useState, useEffect } from "react";
import Sidebar from "./layout/Sidebar.jsx";
import { fetchCategoryProfitStats } from "../services/statistique.js";

function Statistique() {
  const [stats, setStats] = useState({
    totals: {
      salesHT: 0,
      purchaseHT: 0,
      totalStockPurchaseHT: 0,
      benefit: 0,
    },
    categories: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadStats() {
      try {
        setLoading(true);
        setError("");
        const data = await fetchCategoryProfitStats();
        if (active) setStats(data);
      } catch (err) {
        if (active) setError("Impossible de charger les statistiques.");
      } finally {
        if (active) setLoading(false);
      }
    }
    loadStats();
    return () => {
      active = false;
    };
  }, []);

  const formatMoney = (value) => {
    const amount = Number.isFinite(value) ? value : 0;
    return amount.toFixed(2);
  };

  return (
    <div className="app-shell">
      <Sidebar />

      <div className="main">
        <header className="topbar px-4 py-3 d-flex flex-column flex-md-row gap-3 align-items-md-center justify-content-between">
          <div>
            <h1 className="h4 mb-1">Statistique</h1>
            <p className="text-muted mb-0">
              Bilan par categorie: ventes, achats et benefices.
            </p>
          </div>
        </header>

        <main className="content p-4">
          <section className="content-grid mb-4">
            <div className="card shadow-sm border-0">
              <div className="card-body">
                <p className="text-uppercase text-muted small mb-2">
                  Total Ventes (HT)
                </p>
                <h3 className="h4 mb-1">{formatMoney(stats.totals.salesHT)} €</h3>
                <p className="text-muted small mb-0">
                  Somme des produits vendus (HT)
                </p>
              </div>
            </div>
            <div className="card shadow-sm border-0">
              <div className="card-body">
                <p className="text-uppercase text-muted small mb-2">
                  Total Achats Stock (HT)
                </p>
                <h3 className="h4 mb-1">
                  {formatMoney(stats.totals.totalStockPurchaseHT)} €
                </h3>
                <p className="text-muted small mb-0">
                  Valeur d'achat de tout le stock insere
                </p>
              </div>
            </div>
            <div className="card shadow-sm border-0">
              <div className="card-body">
                <p className="text-uppercase text-muted small mb-2">
                  Cout des Achat (HT)
                </p>
                <h3 className="h4 mb-1">
                  {formatMoney(stats.totals.purchaseHT)} €
                </h3>
                <p className="text-muted small mb-0">
                  Prix d'achat des produits vendus 
                </p>
              </div>
            </div>
            <div className="card shadow-sm border-0">
              <div className="card-body">
                <p className="text-uppercase text-muted small mb-2">
                  Benefice realise 
                </p>
                <h3 className="h4 mb-1">{formatMoney(stats.totals.benefit)} €</h3>
                <p className="text-muted small mb-0">
                  Ventes HT - Cout des ventes HT 
                </p>
              </div>
            </div>
          </section>

          <section className="card shadow-sm border-0">
            <div className="card-header bg-white py-3">
              <h5 className="mb-0">Detail par categorie</h5>
            </div>
            <div className="card-body">
              {loading && <p className="text-muted mb-0">Chargement...</p>}
              {error && <p className="text-danger mb-0">{error}</p>}
              {!loading && !error && (
                <div className="table-responsive">
                  <table className="table align-middle">
                    <thead>
                      <tr>
                        <th>Categorie</th>
                        <th className="text-end">Ventes HT</th>
                        <th className="text-end">Cout Achat HT</th>
                        <th className="text-end">Benefice</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.categories.map((row) => (
                        <tr key={row.id}>
                          <td>{row.name}</td>
                          <td className="text-end">
                            {formatMoney(row.salesHT)} €
                          </td>
                          <td className="text-end">
                            {formatMoney(row.purchaseHT)} €
                          </td>
                          <td className="text-end">
                            {formatMoney(row.benefit)} €
                          </td>
                        </tr>
                      ))}
                      {!stats.categories.length && (
                        <tr>
                          <td colSpan="8" className="text-muted">
                            Aucune donnee disponible.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  <table className="table align-middle">
                    <thead>
                      <tr>
                        <th>Categorie</th>
                        <th className="text-end">Qte physique</th>
                        <th className="text-end">Qte reservee</th>
                        <th className="text-end">Qte disponible</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.categories.map((row) => (
                        <tr key={row.id}>
                          <td>{row.name}</td>
                          <td className="text-end">{row.physicalQty}</td>
                          <td className="text-end">{row.reservedQty}</td>
                          <td className="text-end">{row.availableQty}</td>
                        </tr>
                      ))}
                      {!stats.categories.length && (
                        <tr>
                          <td colSpan="8" className="text-muted">
                            Aucune donnee disponible.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

export default Statistique;
