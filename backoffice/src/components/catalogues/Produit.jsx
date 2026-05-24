import { useMemo, useState, useEffect } from "react";
import Sidebar from "../layout/Sidebar.jsx";
import "../../App.css";

function Produit() {
  return (
    <div className="app-shell">
      <Sidebar />

      <div className="main">
        <header className="topbar px-4 py-3 d-flex flex-column flex-md-row gap-3 align-items-md-center justify-content-between">
          <div>
            <h1 className="h4 mb-1">Produits</h1>
            <p className="text-muted mb-0">Liste des produits disponibles.</p>
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
                      <th>ID</th>
                      <th>Référence</th>
                      <th>Désignation</th>
                      <th>Prix</th>
                      <th>Stock</th>
                      <th>Category</th>
                      <th className="text-end">Action</th>
                    </tr>
                  </thead>
                  <tbody></tbody>
                </table>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

export default Produit;
