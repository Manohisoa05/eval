import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchCustomersDetailed } from "../services/customer";
import { cacheCustomer } from "../services/auth";

export default function Accueil() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchCustomersDetailed()
      .then((data) => {
        const root = data?.prestashop || data;
        const list = root?.customers?.customer || [];
        // On s'assure d'avoir un tableau
        setCustomers(Array.isArray(list) ? list : [list]);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const handleLoginAs = (customer) => {
    if (customer === "anonymous") {
      // Pour anonyme, on vide le cache et on redirige
      localStorage.removeItem("ps_customer");
      navigate("/product");
      return;
    }

    // On stocke le client choisi dans le localStorage/Cookies via ta fonction existante
    // On passe 'true' pour le paramètre 'remember' par défaut
    cacheCustomer(customer, true);
    navigate("/product");
  };

  if (loading)
    return (
      <div className="text-center py-5">Chargement des utilisateurs...</div>
    );

  return (
    <div className="container py-5">
      <section className="popular-section">
        <div className="text-center mb-5">
          <span className="badge text-bg-primary px-3 py-2 mb-2">
            Bienvenue
          </span>
          <h1 className="display-4">Qui êtes-vous ?</h1>
          <p className="text-muted">
            Choisissez un profil pour commencer vos achats
          </p>
        </div>

        <div className="row g-4 justify-content-center">
          {/* Option Anonyme */}
          <div className="col-6 col-md-3">
            <div className="shop-card border-dashed">
              <div
                className="shop-card-media d-flex align-items-center justify-content-center bg-light"
                style={{ height: "200px" }}
              >
                <span style={{ fontSize: "4rem" }}>👤</span>
              </div>
              <div className="shop-card-body text-center">
                <div className="shop-card-title">Utilisateur Anonyme</div>
                <button
                  type="button"
                  className="btn btn-outline-secondary w-100 mt-3"
                  onClick={() => handleLoginAs("anonymous")}
                >
                  Continuer
                </button>
              </div>
            </div>
          </div>

          {/* Liste des clients issus de PrestaShop */}
          {customers.map((c) => (
            <div key={c.id._text} className="col-6 col-md-3">
              <div className="shop-card shadow-sm">
                <span className="badge-new bg-info">CLIENT</span>
                <div
                  className="shop-card-media d-flex align-items-center justify-content-center bg-white"
                  style={{ height: "200px" }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="80"
                    height="80"
                    fill="#adb5bd"
                    viewBox="0 0 16 16"
                  >
                    <path d="M3 14s-1 0-1-1 1-4 6-4 6 3 6 4-1 1-1 1H3Zm5-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                  </svg>
                </div>
                <div className="shop-card-body">
                  <div className="shop-card-title text-capitalize">
                    {c.firstname}
                  </div>
                  <div className="text-muted small mb-3">{c.email}</div>
                  <button
                    type="button"
                    className="btn btn-primary w-100"
                    onClick={() => handleLoginAs(c)}
                  >
                    Se connecter
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
