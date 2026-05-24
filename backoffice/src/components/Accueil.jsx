import { useMemo } from "react";
import { useState, useEffect } from "react";
import Sidebar from "./layout/Sidebar.jsx";
import "../App.css";
import { getOrdersStatsByDate } from "../services/commande.js";
import {
  fetchStockDailyEvolution,
  fetchProductsWithCombinations,
} from "../services/stock.js";

function Accueil() {
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalPaid, setTotalPaid] = useState(0);
  const [generalCount, setGeneralCount] = useState(0);
  const [generalPaid, setGeneralPaid] = useState(0);
  const date = new Date().toISOString().split("T")[0];
  const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 2)
    .toISOString()
    .split("T")[0];
  const [dateInf, setDateInf] = useState(firstDay);
  const [dateSup, setDateSup] = useState(date);
  const [productIdToWatch, setProductIdToWatch] = useState("");
  const [stockHistory, setStockHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [productsList, setProductsList] = useState([]);

  // 2. useEffect combiné pour les statistiques ET le stock
  useEffect(() => {
    async function loadData() {
      // Chargement des stats (déjà existant)
      const stats = await getOrdersStatsByDate(dateInf, dateSup);
      setTotalOrders(stats.count);
      setTotalPaid(stats.totalPaid);
      setGeneralCount(stats.generalCount);
      setGeneralPaid(stats.generalPaid);

      // Chargement de l'historique de stock avec filtres
      if (productIdToWatch) {
        const [productId, attributeId] = productIdToWatch.split(":");

        const data = await fetchStockDailyEvolution(
          productId,
          dateInf,
          dateSup,
          attributeId || 0,
        );

        setStockHistory(data);
      }
    }
    async function loadProducts() {
      const products = await fetchProductsWithCombinations();
      setProductsList(products);
    }
    loadData();
    loadProducts();
  }, [dateInf, dateSup, productIdToWatch]);

  const dashboardCards = [
    {
      title: "Stats General",
      value: `${generalCount} commandes`,
      helper: generalPaid,
    },
    {
      title: "Stats Day",
      value: `${totalOrders} commandes`,
      helper: totalPaid,
    },
  ];

  return (
    <div className="app-shell">
      <Sidebar />

      <div className="main">
        <header className="topbar px-4 py-3 d-flex flex-column flex-md-row gap-3 align-items-md-center justify-content-between">
          <div>
            <h1 className="h4 mb-1">Tableau de bord</h1>
            <p className="text-muted mb-0">Bilan rapide des operations.</p>
          </div>
          <div className="d-flex gap-2">
            <button className="btn btn-outline-secondary">Exporter</button>
            <button className="btn btn-primary">Nouvelle action</button>
          </div>
        </header>

        <main className="content p-4">
          {/* FILTRE  */}
          <div className="row mb-4">
            <div className="col-md-3">
              <label htmlFor="">Date début :</label>
              <input
                type="date"
                className="form-control"
                placeholder="Date début"
                value={dateInf}
                onChange={(e) => setDateInf(e.target.value)}
              />
            </div>
            <div className="col-md-3">
              <label htmlFor="">Date fin :</label>
              <input
                type="date"
                className="form-control"
                placeholder="Date fin"
                value={dateSup}
                onChange={(e) => setDateSup(e.target.value)}
              />
            </div>
          </div>
          {/* ------------- */}
          <section className="content-grid mb-4">
            {dashboardCards.map((card) => (
              <div className="card shadow-sm border-0" key={card.title}>
                <div className="card-body">
                  <p className="text-uppercase text-muted small mb-2">
                    {card.title}
                  </p>
                  <h3 className="h4 mb-1">{card.value}</h3>
                  <p className="text-success small mb-0">
                    {parseFloat(card.helper).toFixed(2)} €
                  </p>
                </div>
              </div>
            ))}
          </section>

          <section className="mt-4 mb-5">
            <div className="card shadow-sm border-0">
              <div className="card-header bg-white py-3">
                <h5 className="mb-0">
                  📦 Évolution du stock (Produit #{productIdToWatch})
                </h5>
                {/* Filtre par ID Produit */}
                <br />
                <div className="d-flex align-items-center gap-2">
                  <label className="small text-muted">ID Produit:</label>
                  <select
                    className="form-select form-select-sm"
                    style={{ width: "300px" }}
                    value={productIdToWatch}
                    onChange={(e) => setProductIdToWatch(e.target.value)}
                  >
                    <option value="">Choisir un produit</option>

                    {productsList.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
                {/* --------------------- */}
              </div>
              <div className="card-body">
                {historyLoading ? (
                  <div className="text-center py-4">
                    Chargement de l'historique...
                  </div>
                ) : stockHistory.length > 0 ? (
                  <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Date</th>
                          <th>Variation</th>
                          <th className="text-end">Type de mouvement</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stockHistory.map((item, index) => (
                          <tr key={index}>
                            <td>
                              {new Date(item.date).toLocaleDateString("fr-FR")}
                            </td>
                            <td
                              className={
                                item.variation >= 0
                                  ? "text-success fw-bold"
                                  : "text-danger fw-bold"
                              }
                            >
                              {item.variation >= 0
                                ? `+${item.variation}`
                                : item.variation}
                            </td>
                            <td className="text-end">
                              <span
                                className={`badge ${item.variation >= 0 ? "bg-success-subtle text-success" : "bg-danger-subtle text-danger"} border`}
                              >
                                {item.variation >= 0
                                  ? "Entrée / Réappro."
                                  : "Sortie / Vente"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center text-muted py-4">
                    Aucun mouvement récent trouvé pour ce produit.
                  </div>
                )}
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

export default Accueil;
