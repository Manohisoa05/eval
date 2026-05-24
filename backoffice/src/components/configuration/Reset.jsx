import { useState } from "react";
import Sidebar from "../layout/Sidebar.jsx";
import { resetEntities, RESET_ENTITIES } from "../../services/reset.js";

function Reset() {
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [status, setStatus] = useState(null);

  const allKeys = RESET_ENTITIES.map((item) => item.key);
  const allSelected = selected.size === allKeys.length && allKeys.length > 0;

  function toggleEntity(key) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      if (prev.size === allKeys.length) return new Set();
      return new Set(allKeys);
    });
  }

  async function handleReset() {
    if (selected.size === 0) return;
    setLoading(true);
    setStatus(null);
    try {
      const res = await resetEntities(Array.from(selected), {
        resetAutoIncrement: true,
        ignoreAutoIncrementErrors: true,
      });
      setStatus({ ok: true, message: `Reset effectue (${res.length} tables)` });
    } catch (err) {
      const msg = err?.details || err?.message || "Erreur reset";
      setStatus({ ok: false, message: msg });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main p-4">
        <h1 className="h4">Reset des tables</h1>
        <p className="text-muted">Clique sur les tables pour les selectionner, puis lance le reset.</p>

        <div className="card p-3 mb-3">
          <div className="form-check mb-3">
            <input
              className="form-check-input"
              type="checkbox"
              id="reset-select-all"
              checked={allSelected}
              onChange={toggleAll}
            />
            <label className="form-check-label" htmlFor="reset-select-all">
              Tout selectionner
            </label>
          </div>
          <div className="d-flex flex-wrap gap-2">
            {RESET_ENTITIES.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`btn ${selected.has(item.key) ? "btn-primary" : "btn-outline-primary"}`}
                onClick={() => toggleEntity(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="d-flex gap-2 mt-3">
            <button
              className="btn btn-danger"
              onClick={handleReset}
              disabled={selected.size === 0 || loading}
            >
              Reset selection
            </button>
            <button
              className="btn btn-outline-secondary"
              onClick={() => setSelected(new Set())}
              disabled={loading}
            >
              Vider la selection
            </button>
          </div>
        </div>

        {loading && <div>Traitement...</div>}

        {status && (
          <div className={`alert ${status.ok ? "alert-success" : "alert-danger"}`}>
            {status.message}
          </div>
        )}
      </div>
    </div>
  );
}

export default Reset;
