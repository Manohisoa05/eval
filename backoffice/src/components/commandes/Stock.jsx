import { useState, useEffect } from "react";
import { fetchProductsMapped } from "../../services/produit";
import { updateProductStock } from "../../services/stock";
import Sidebar from "../layout/Sidebar.jsx";

export default function Stock() {
  const [products, setProducts] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [selectedIdAttribute, setSelectedIdAttribute] = useState("");
  const [quantityToAdd, setQuantityToAdd] = useState(0);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        // On attend la réponse réelle ici
        const data = await fetchProductsMapped();
        // console.log("Data.stock:", data.stock);
        if (data && data.length > 0) {
          setProducts(data);
        } else {
          console.warn("L'API a répondu, mais le tableau est vide.");
        }
      } catch (err) {
        console.error("Erreur fatale lors du fetch:", err);
      }
    };

    loadData();
  }, []);

  const handleUpdate = async () => {
    try {
      await updateProductStock(selectedId, selectedIdAttribute, quantityToAdd);
      setMessage({ type: "success", text: "Stock mis à jour avec succès !" });
      setQuantityToAdd(0);
    } catch (err) {
      setMessage({ type: "danger", text: "Erreur lors de la mise à jour." });
    }
  };

  return (
    <div className="app-shell">
      <Sidebar />

      <div className="main">
        <header className="topbar px-4 py-3 d-flex flex-column flex-md-row gap-3 align-items-md-center justify-content-between">
          <div>
            <h1 className="h4 mb-1">Gestion des Stocks</h1>
            <p className="text-muted mb-0">
              Liste des produits et leurs stocks.
            </p>
          </div>
          <div className="d-flex gap-2">
            <button className="btn btn-outline-secondary">Exporter</button>
            <button className="btn btn-primary">Nouveau produit</button>
          </div>
        </header>

        <main className="content p-4">
          <section className="card border-0 shadow-sm">
            <div className="card-body">
              <div className="table-responsive">
                <table className="table align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Produit</th>
                      <th>Combinaison ID</th>
                      <th>Stock actuel</th>
                      <th className="text-end">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p) => (
                      <tr key={p.id}>
                        <td>{p.name}</td>
                        <td>{p.comboId ? p.comboId : "-"}</td>
                        <td>{p.stock}</td>
                        <td className="text-end">
                          <button
                            className="btn btn-sm btn-success"
                            onClick={() => {
                              setSelectedId(p.id);
                              setSelectedIdAttribute(p.comboId || "0");
                              setQuantityToAdd(0);
                            }}
                          >
                            Modifier
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {selectedId && (
                <div className="mt-4">
                  <h5>Modifier le stock du produit ID: {selectedId}</h5>
                  <div
                    className="input-group mb-3"
                    style={{ maxWidth: "300px" }}
                  >
                    <input
                      type="number"
                      className="form-control"
                      value={quantityToAdd}
                      onChange={(e) =>
                        setQuantityToAdd(parseInt(e.target.value))
                      }
                    />
                    <button className="btn btn-primary" onClick={handleUpdate}>
                      Ajouter au stock
                    </button>
                  </div>
                  {message && (
                    <div className={`alert alert-${message.type}`}>
                      {message.text}
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
