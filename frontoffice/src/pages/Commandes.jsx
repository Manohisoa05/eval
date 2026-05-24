import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getUserOrders } from "../services/commande";
import { getCachedCustomer } from "../services/auth";

const ORDER_STATES = {
  1: { label: "En attente de chèque", color: "#34209E" },
  2: { label: "Paiement accepté", color: "#3498D8" },
  5: { label: "Livré", color: "#01B887" },
  6: { label: "Annulé", color: "#2C3E50" },
  8: { label: "Erreur de paiement", color: "#E74C3C" },
  10: { label: "En attente de virement", color: "#34209E" },
  13: { label: "Paiement à la livraison", color: "#34209E" },
};

export default function Commandes() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const cachedData = getCachedCustomer();
  const customerId = cachedData?.customer?.id || "1";

  useEffect(() => {
    async function loadOrders() {
      setLoading(true);
      try {
        const data = await getUserOrders(customerId);
        console.log("Commandes récupérées:", data);
        setOrders(data);
      } catch (e) {
        setError("Impossible de charger vos commandes.");
      } finally {
        setLoading(false);
      }
    }
    loadOrders();
  }, [customerId]);

  return (
    <section className="orders-page container py-5">
      <Link to="/product" className="back-link">
        ← Retour aux produits
      </Link>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>Mes Commandes</h1>
        <span className="badge bg-secondary">{orders.length} commande(s)</span>
      </div>

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status"></div>
          <p className="mt-2">Chargement de vos commandes...</p>
        </div>
      ) : error ? (
        <div className="alert alert-danger">{error}</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-5 bg-light rounded">
          <p className="mb-0 text-muted">
            Vous n'avez pas encore passé de commande.
          </p>
        </div>
      ) : (
        <div className="table-responsive shadow-sm rounded">
          <table className="table table-hover align-middle mb-0 bg-white">
            <thead className="bg-light">
              <tr>
                <th>Référence</th>
                <th>Date</th>
                <th>Total</th>
                <th>État (ID)</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                // Extraction sécurisée des valeurs
                const id = order.id;
                const reference = order.reference;
                const dateStr = order.date_add;
                const total = order.total_paid;
                const state = order.current_state;
                const stateInfo = ORDER_STATES[state] || {
                  label: `État ${state}`,
                  color: "#6C757D",
                };

                return (
                  <tr key={id}>
                    <td>
                      <strong>{reference}</strong>
                    </td>
                    <td>
                      {dateStr
                        ? new Date(dateStr).toLocaleDateString()
                        : "Date inconnue"}
                    </td>
                    <td>{total ? parseFloat(total).toFixed(2) : "0.00"} €</td>
                    <td>
                      <span
                        className="badge rounded-pill"
                        style={{
                          backgroundColor: stateInfo.color,
                          color: "#FFFFFF", // Texte en blanc pour assurer la lisibilité
                        }}
                      >
                        {stateInfo.label}
                      </span>
                    </td>
                    <td>
                      <Link
                        to={`/addCommande/${id}`}
                        className="shop-card-media"
                      >
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary mt-2"
                        >
                          Nouvelle commande
                        </button>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
