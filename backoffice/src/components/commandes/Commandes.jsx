import { useMemo, useState, useEffect } from "react";
import Sidebar from "../layout/Sidebar.jsx";
import "../../App.css";
import {
  fetchOrdersDetailed,
  updateOrderStatusManual,
} from "../../services/commande.js";
function Commandes() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const detailed = await fetchOrdersDetailed();
      console.log("Orders loaded:", detailed);
      setOrders(detailed);
    } catch (err) {
      console.error("Failed to load orders", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const handleStatusSubmit = async (event, orderId) => {
    event.preventDefault();
    const form = event.currentTarget;
    const status = form.elements.status?.value;
    if (!status) return;
    try {
      await updateOrderStatusManual(orderId, status);
      await loadOrders();
    } catch (err) {
      console.error("Failed to update order status", err);
      setError(err.message || "Erreur lors de la mise a jour du statut");
    }
  };

  return (
    <div className="app-shell">
      <Sidebar />

      <div className="main">
        <header className="topbar px-4 py-3 d-flex flex-column flex-md-row gap-3 align-items-md-center justify-content-between">
          <div>
            <h1 className="h4 mb-1">Commandes</h1>
            <p className="text-muted mb-0">Liste des commandes récentes.</p>
          </div>
          <div className="d-flex gap-2">
            <button className="btn btn-outline-secondary">Exporter</button>
            <button className="btn btn-primary">Nouvelle commande</button>
          </div>
        </header>

        <main className="content p-4">
          <section className="card border-0 shadow-sm">
            <div className="card-body">
              <div className="table-responsive">
                <table className="table align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>ID</th>
                      <th>Référence</th>
                      <th>Livraison</th>
                      <th>Client</th>
                      <th>Total</th>
                      <th>Paiement</th>
                      <th>Etat</th>
                      <th>Date</th>
                      <th className="text-end">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id}>
                        <td>{o.id}</td>
                        <td>{o.reference}</td>
                        <td>{o.delivery}</td>
                        <td>{o.customer}</td>
                        <td>{parseFloat(o.total).toFixed(2)} €</td>
                        <td>{o.payment}</td>
                        <td>
                          {
                            <span
                              style={{
                                borderRadius: "5px",
                                padding: "2px 2px 6px",
                                boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                                color: "#ffffff",
                                backgroundColor: o.color,
                              }}
                            >
                              {o.status}
                            </span>
                          }
                        </td>
                        <td>{o.date}</td>
                        <td className="text-end">
                          {/* <a
                            href={`/commandes/${o.id}`}
                            className="btn btn-outline-primary btn-sm"
                          >
                            Details
                          </a> */}
                          <form
                            className="order-status-form"
                            onSubmit={(event) => handleStatusSubmit(event, o.id)}
                          >
                            <select
                              name="status"
                              className="order-status-select"
                              aria-label="Statut de commande"
                            >
                              <option value="5">Livré</option>
                              <option value="6">Annulé</option>
                            </select>
                            <button type="submit" className="order-status-btn">Mettre à jour</button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

export default Commandes;
