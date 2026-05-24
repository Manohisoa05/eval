import { useMemo, useState, useEffect } from "react";
import Sidebar from "../layout/Sidebar.jsx";
import "../../App.css";
import { unvalideCartMapped } from "../../services/panier.js";
function Paniers() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      // const detailed = await fetchOrdersDetailed();
      const detailed = await unvalideCartMapped();
      console.log("liste des paniers invalide :", await unvalideCartMapped());
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

  return (
    <div className="app-shell">
      <Sidebar />

      <div className="main">
        <header className="topbar px-4 py-3 d-flex flex-column flex-md-row gap-3 align-items-md-center justify-content-between">
          <div>
            <h1 className="h4 mb-1">Paniers</h1>
            <p className="text-muted mb-0">Liste des paniers non validés.</p>
          </div>
          <div className="d-flex gap-2">
            <button className="btn btn-outline-secondary">Exporter</button>
            <button className="btn btn-primary">Nouveau panier</button>
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
                      <th>Livraison</th>
                      <th>Client</th>
                      <th>Date</th>
                      <th>Etat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id}>
                        <td>{o.id}</td>
                        <td>{o.id_address_delivery}</td>
                        <td>{o.customer_name}</td>
                        <td>{o.date_add}</td>
                        <td>
                          <span
                            style={{
                              borderRadius: "5px",
                              padding: "7px 10px 6px",
                              boxShadow: "0 2px 4px rgba(0, 0, 0, 0.2)",
                              color: "#000000",
                              backgroundColor: "#fff4a2",
                            }}
                          >
                            Dans le panier
                          </span>
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

export default Paniers;
