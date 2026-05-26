import { useEffect, useMemo, useState } from "react";
import { fetchCategoriesMapped, fetchProductsMapped, getQuantityByProduct } from "../services/produit";
import { updateProductStock } from "../services/stock";

const ADMIN_PASSWORD = "tsytadidiko";

export default function RemoveStock() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const [adminPassword, setAdminPassword] = useState("");
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authError, setAuthError] = useState("");

  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [qtyToRemove, setQtyToRemove] = useState("");
  const [processing, setProcessing] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchCategoriesMapped()
      .then((cats) => {
        setCategories(cats || []);
        if (cats && cats.length > 0) {
          setSelectedCategoryId(String(cats[0].id));
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching categories:", err);
        setLoading(false);
      });
  }, []);

  const selectedCategory = useMemo(
    () => categories.find((c) => String(c.id) === String(selectedCategoryId)),
    [categories, selectedCategoryId],
  );

  const handleAuthSubmit = (event) => {
    event.preventDefault();
    if (adminPassword !== ADMIN_PASSWORD) {
      setAuthError("Mot de passe admin incorrect.");
      setIsAuthorized(false);
      return;
    }
    setAuthError("");
    setIsAuthorized(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setReport(null);

    const qty = parseInt(qtyToRemove, 10);
    if (!selectedCategory || !qty || qty <= 0) {
      setError("Veuillez saisir une quantite valide et une categorie.");
      return;
    }

    setProcessing(true);

    try {
      const products = await fetchProductsMapped();
      const filtered = (products || []).filter(
        (p) => p.category === selectedCategory.name,
      );

      const rows = [];
      let totalExpected = qty * filtered.length;
      let totalRealized = 0;

      for (const p of filtered) {
        const currentQty = Number(await getQuantityByProduct(p.id, 0)) || 0;
        const removed = Math.min(qty, currentQty);
        const newQty = currentQty - removed;

        if (removed > 0) {
          await updateProductStock(p.id, 0, -removed);
        }

        totalRealized += removed;

        rows.push({
          id: p.id,
          name: p.name,
          stock_before: currentQty,
          removed,
          stock_after: newQty,
        });
      }

      setReport({
        category: selectedCategory.name,
        qtyRequested: qty,
        productCount: filtered.length,
        totalExpected,
        totalRealized,
        rows,
      });
    } catch (e) {
      console.error(e);
      setError("Erreur lors de la mise a jour du stock.");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <div>Loading categories...</div>;

  return (
    <div className="container py-5">
      <h1>Gestion de Stock - Remove</h1>

      {!isAuthorized ? (
        <form className="card p-4" onSubmit={handleAuthSubmit}>
          <h5 className="mb-3">Acces Admin</h5>
          {authError ? <div className="alert alert-danger">{authError}</div> : null}
          <div className="mb-3">
            <label className="form-label" htmlFor="adminPwd">Mot de passe admin</label>
            <input
              id="adminPwd"
              type="password"
              className="form-control"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary">Entrer</button>
        </form>
      ) : (
        <div className="card p-4">
          <form onSubmit={handleSubmit}>
            {error ? <div className="alert alert-danger">{error}</div> : null}

            <div className="row g-3 align-items-end">
              <div className="col-md-6">
                <label className="form-label" htmlFor="categorySelect">
                  Categorie
                </label>
                <select
                  id="categorySelect"
                  className="form-select"
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-md-4">
                <label className="form-label" htmlFor="qtyInput">
                  Quantite a retirer
                </label>
                <input
                  id="qtyInput"
                  type="number"
                  min="1"
                  className="form-control"
                  value={qtyToRemove}
                  onChange={(e) => setQtyToRemove(e.target.value)}
                  required
                />
              </div>

              <div className="col-md-2">
                <button type="submit" className="btn btn-danger w-100" disabled={processing}>
                  {processing ? "Traitement..." : "Retirer"}
                </button>
              </div>
            </div>
          </form>

          {report ? (
            <div className="mt-4">
              <h5>Rapport</h5>
              <div className="mb-3 text-muted">
                Categorie: <strong>{report.category}</strong> | Produits: <strong>{report.productCount}</strong> | Total attendu: <strong>{report.totalExpected}</strong> | Total realise: <strong>{report.totalRealized}</strong>
              </div>

              <div className="table-responsive">
                <table className="table table-bordered align-middle">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Produit</th>
                      <th>Stock avant</th>
                      <th>Retire</th>
                      <th>Stock apres</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map((row) => (
                      <tr key={row.id}>
                        <td>{row.id}</td>
                        <td>{row.name}</td>
                        <td>{row.stock_before}</td>
                        <td>{row.removed}</td>
                        <td>{row.stock_after}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}